"""
AI 소비량 예측 + 자동 발주 엔진
- 최근 거래 이력 기반 선형 회귀 예측
- 요일별 패턴 반영
- 안전 재고 계산 후 발주 추천 / 자동 생성
"""
import logging
import numpy as np
from datetime import date, timedelta
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..models import Transaction, TransactionType, Item, Inventory, Order, OrderItem

logger = logging.getLogger(__name__)


def _get_daily_consumption(db: Session, item_id: int, days: int = 30) -> dict[str, float]:
    """최근 N일간 날짜별 소비량 반환"""
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(
            func.date(Transaction.created_at).label("day"),
            func.sum(Transaction.quantity).label("qty"),
        )
        .filter(
            Transaction.item_id == item_id,
            Transaction.type == TransactionType.OUT,
            func.date(Transaction.created_at) >= since,
        )
        .group_by(func.date(Transaction.created_at))
        .all()
    )
    return {str(r.day): float(r.qty) for r in rows}


def predict_consumption(db: Session, item_id: int, forecast_days: int = 14) -> dict:
    """
    선형 회귀 + 요일 패턴으로 N일치 소비량 예측
    반환: { "daily_avg": float, "forecast_total": float, "confidence": str, "weekday_pattern": list }
    """
    history = _get_daily_consumption(db, item_id, days=60)

    if len(history) < 3:
        # 데이터 부족 시 단순 평균
        avg = sum(history.values()) / max(len(history), 1) if history else 0
        return {
            "daily_avg": round(avg, 3),
            "forecast_total": round(avg * forecast_days, 2),
            "confidence": "low",
            "weekday_pattern": [round(avg, 2)] * 7,
            "data_points": len(history),
        }

    # 요일별 평균 패턴 (0=월, 6=일)
    weekday_totals = defaultdict(list)
    for day_str, qty in history.items():
        wd = date.fromisoformat(day_str).weekday()
        weekday_totals[wd].append(qty)

    weekday_avg = [
        round(sum(weekday_totals[wd]) / len(weekday_totals[wd]), 3)
        if weekday_totals[wd] else 0
        for wd in range(7)
    ]

    # 선형 회귀로 트렌드 파악
    sorted_days = sorted(history.keys())
    x = np.array(range(len(sorted_days)), dtype=float)
    y = np.array([history[d] for d in sorted_days], dtype=float)

    # numpy 선형 회귀
    if len(x) >= 2:
        coeffs = np.polyfit(x, y, 1)
        trend_slope = coeffs[0]  # 양수=증가 추세, 음수=감소 추세
    else:
        trend_slope = 0.0

    daily_avg = float(np.mean(y))

    # N일 예측: 요일 패턴 기반
    today = date.today()
    forecast_total = 0.0
    for i in range(forecast_days):
        wd = (today + timedelta(days=i + 1)).weekday()
        base = weekday_avg[wd] if weekday_avg[wd] > 0 else daily_avg
        # 트렌드 반영 (작게)
        adjusted = base + trend_slope * 0.1 * i
        forecast_total += max(adjusted, 0)

    confidence = "high" if len(history) >= 14 else ("medium" if len(history) >= 7 else "low")

    return {
        "daily_avg": round(daily_avg, 3),
        "forecast_total": round(forecast_total, 2),
        "forecast_days": forecast_days,
        "trend": "up" if trend_slope > 0.01 else ("down" if trend_slope < -0.01 else "stable"),
        "confidence": confidence,
        "weekday_pattern": weekday_avg,  # [월,화,수,목,금,토,일]
        "data_points": len(history),
    }


def calculate_smart_order(db: Session, item_id: int, lead_days: int = 3) -> dict | None:
    """
    AI 예측 기반 발주 수량 계산
    lead_days: 발주 → 입고까지 걸리는 일수 (기본 3일)
    반환: None (발주 불필요) or { "suggested_qty", "reason", ... }
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        return None

    inv = item.inventory
    current_stock = inv.quantity if inv else 0.0

    forecast = predict_consumption(db, item_id, forecast_days=14)
    daily_avg = forecast["daily_avg"]

    # 리드타임 동안 소비량 (발주 넣고 받을 때까지)
    lead_consumption = daily_avg * lead_days

    # 안전 재고 = 1.5배 (변동성 대응)
    safety_stock = daily_avg * 3

    # 발주 기준: 현재 재고가 (리드타임 소비 + 안전재고) 이하이면 발주
    reorder_point = lead_consumption + safety_stock

    if current_stock > reorder_point and current_stock > item.min_stock:
        return None  # 발주 불필요

    # 발주 수량: 14일치 예측 소비 - 현재재고 + 안전재고
    raw_qty = forecast["forecast_total"] - current_stock + safety_stock
    suggested_qty = max(raw_qty, item.min_stock * 2, daily_avg * 7)

    return {
        "item_id": item_id,
        "item_name": item.name,
        "unit": item.unit,
        "current_stock": current_stock,
        "reorder_point": round(reorder_point, 2),
        "daily_avg": daily_avg,
        "suggested_qty": round(suggested_qty, 2),
        "estimated_cost": round(suggested_qty * item.unit_price, 0),
        "forecast": forecast,
        "reason": f"예측 일평균 {daily_avg:.1f}{item.unit}/일, {lead_days}일 리드타임 기준",
    }


def auto_create_orders(db: Session, dry_run: bool = False) -> dict:
    """
    모든 품목 스캔 → AI 발주 필요 품목만 발주서 자동 생성
    dry_run=True: 실제 생성 없이 추천만 반환
    """
    items = db.query(Item).all()
    recommendations = []

    for item in items:
        result = calculate_smart_order(db, item.id)
        if result:
            recommendations.append(result)

    if not recommendations:
        return {"created": 0, "recommendations": [], "message": "발주 필요 품목 없음 ✅"}

    if dry_run:
        return {
            "created": 0,
            "recommendations": recommendations,
            "total_cost": sum(r["estimated_cost"] for r in recommendations),
        }

    # [C-5] 공급업체별 묶기 — 루프 전에 item 일괄 조회
    item_ids = [r["item_id"] for r in recommendations]
    items_map = {i.id: i for i in db.query(Item).filter(Item.id.in_(item_ids)).all()}

    by_supplier: dict[int | None, list] = defaultdict(list)
    for rec in recommendations:
        item = items_map[rec["item_id"]]
        by_supplier[item.supplier_id].append(rec)

    orders_created = []
    for supplier_id, items_list in by_supplier.items():
        order = Order(
            supplier_id=supplier_id,
            memo=f"AI 자동 발주 ({date.today()})",
        )
        db.add(order)
        db.flush()

        for rec in items_list:
            item = items_map[rec["item_id"]]
            db.add(OrderItem(
                order_id=order.id,
                item_id=rec["item_id"],
                quantity=rec["suggested_qty"],
                unit_price=item.unit_price,
            ))
        orders_created.append(order.id)

    db.commit()

    logger.info(f"[AI] 발주서 {len(orders_created)}개 자동 생성 완료")
    return {
        "created": len(orders_created),
        "order_ids": orders_created,
        "recommendations": recommendations,
        "total_cost": sum(r["estimated_cost"] for r in recommendations),
        "message": f"{len(orders_created)}개 발주서 자동 생성 완료",
    }
