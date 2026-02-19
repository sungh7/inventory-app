"""
월간 비용 리포트 API
- GET /reports/monthly   : 월간 종합 리포트
- GET /reports/weekly    : 최근 N주 주간 추세
- GET /reports/menu-performance : 메뉴 성과 분석
"""
from datetime import date, timedelta
import calendar

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..core.database import get_db
from ..models.sale import Sale
from ..models.menu import Menu
from ..models.transaction import Transaction, TransactionType
from ..models.item import Item

router = APIRouter()


# ─── 유틸 ────────────────────────────────────────────────────────────────────

def _month_weeks(year: int, month: int) -> list[tuple[date, date]]:
    """해당 월을 7일 단위 주차로 분할. 마지막 주는 짧을 수 있음."""
    first = date(year, month, 1)
    last_day = calendar.monthrange(year, month)[1]
    last = date(year, month, last_day)

    weeks: list[tuple[date, date]] = []
    start = first
    while start <= last:
        end = min(start + timedelta(days=6), last)
        weeks.append((start, end))
        start = end + timedelta(days=1)
    return weeks


def _safe_rate(numerator: float, denominator: float, digits: int = 2) -> float:
    if denominator == 0:
        return 0.0
    return round(numerator / denominator * 100, digits)


# ─── 월간 종합 리포트 ─────────────────────────────────────────────────────────

@router.get("/monthly")
def monthly_report(
    year: int = Query(default=None),
    month: int = Query(default=None),
    db: Session = Depends(get_db),
):
    today = date.today()
    if year is None:
        year = today.year
    if month is None:
        month = today.month

    last_day = calendar.monthrange(year, month)[1]
    period_start = date(year, month, 1)
    period_end = date(year, month, last_day)

    # ── 주차 정의 ──
    weeks = _month_weeks(year, month)

    # ── 판매 데이터 (Sale) ──
    sales_rows = (
        db.query(
            Sale.total_revenue,
            Sale.total_cost,
            Sale.menu_id,
            Sale.created_at,
        )
        .filter(
            func.date(Sale.created_at) >= period_start,
            func.date(Sale.created_at) <= period_end,
        )
        .all()
    )

    # 주차별 매출/원가 집계
    revenue_by_week = [0.0] * len(weeks)
    cost_by_week = [0.0] * len(weeks)

    for row in sales_rows:
        row_date = row.created_at.date() if hasattr(row.created_at, "date") else row.created_at
        for i, (ws, we) in enumerate(weeks):
            if ws <= row_date <= we:
                revenue_by_week[i] += row.total_revenue or 0.0
                cost_by_week[i] += row.total_cost or 0.0
                break

    total_revenue = sum(revenue_by_week)
    total_ingredient = sum(cost_by_week)
    total_margin = total_revenue - total_ingredient
    margin_by_week = [round(r - c, 0) for r, c in zip(revenue_by_week, cost_by_week)]

    # ── 구매비 합계 (Transaction IN × unit_price) ──
    purchase_rows = (
        db.query(func.sum(Transaction.quantity * Transaction.unit_price))
        .filter(
            Transaction.type == TransactionType.IN,
            Transaction.unit_price.isnot(None),
            func.date(Transaction.created_at) >= period_start,
            func.date(Transaction.created_at) <= period_end,
        )
        .scalar()
    ) or 0.0

    # ── 폐기 손실 (Transaction DISPOSE × unit_price from Item) ──
    dispose_rows = (
        db.query(
            Item.id,
            Item.name,
            Item.unit,
            Item.unit_price,
            func.sum(Transaction.quantity).label("disposed_qty"),
        )
        .join(Transaction, Transaction.item_id == Item.id)
        .filter(
            Transaction.type == TransactionType.DISPOSE,
            func.date(Transaction.created_at) >= period_start,
            func.date(Transaction.created_at) <= period_end,
        )
        .group_by(Item.id, Item.name, Item.unit, Item.unit_price)
        .all()
    )

    total_disposal = sum((r.disposed_qty * (r.unit_price or 0.0)) for r in dispose_rows)

    disposal_items = [
        {
            "item_id": r.id,
            "name": r.name,
            "disposed_qty": round(r.disposed_qty, 2),
            "unit": r.unit,
            "loss_krw": round(r.disposed_qty * (r.unit_price or 0.0), 0),
        }
        for r in dispose_rows
    ]

    # ── 메뉴별 집계 ──
    menu_agg: dict[int, dict] = {}
    for row in sales_rows:
        mid = row.menu_id
        if mid not in menu_agg:
            menu_agg[mid] = {"count": 0, "revenue": 0.0, "cost": 0.0}
        menu_agg[mid]["count"] += 1
        menu_agg[mid]["revenue"] += row.total_revenue or 0.0
        menu_agg[mid]["cost"] += row.total_cost or 0.0

    # 메뉴 이름 조회
    if menu_agg:
        menus = db.query(Menu.id, Menu.name).filter(Menu.id.in_(list(menu_agg.keys()))).all()
        menu_names = {m.id: m.name for m in menus}
    else:
        menu_names = {}

    top_menus = sorted(
        [
            {
                "menu_id": mid,
                "name": menu_names.get(mid, f"메뉴#{mid}"),
                "count": v["count"],
                "revenue": round(v["revenue"], 0),
                "cost": round(v["cost"], 0),
                "margin_rate": _safe_rate(v["revenue"] - v["cost"], v["revenue"]),
            }
            for mid, v in menu_agg.items()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )

    low_margin_menus = [m for m in top_menus if m["margin_rate"] < 40.0]

    return {
        "year": year,
        "month": month,
        "period": f"{year}-{month:02d}",
        "revenue": {
            "total": round(total_revenue, 0),
            "by_week": [round(v, 0) for v in revenue_by_week],
        },
        "cost": {
            "total_ingredient": round(total_ingredient, 0),
            "total_purchase": round(purchase_rows, 0),
            "total_disposal": round(total_disposal, 0),
            "by_week": [round(v, 0) for v in cost_by_week],
        },
        "margin": {
            "total": round(total_margin, 0),
            "rate": _safe_rate(total_margin, total_revenue),
            "by_week": [round(v, 0) for v in margin_by_week],
        },
        "cost_rate": _safe_rate(total_ingredient, total_revenue),
        "disposal_rate": _safe_rate(total_disposal, total_revenue),
        "top_menus": top_menus,
        "disposal_items": disposal_items,
        "low_margin_menus": low_margin_menus,
    }


# ─── 주간 추세 ────────────────────────────────────────────────────────────────

@router.get("/weekly")
def weekly_report(
    weeks: int = Query(default=8, ge=1, le=52),
    db: Session = Depends(get_db),
):
    today = date.today()
    # 이번 주 월요일부터 역산
    this_monday = today - timedelta(days=today.weekday())

    data = []
    for i in range(weeks - 1, -1, -1):
        week_start = this_monday - timedelta(weeks=i)
        week_end = week_start + timedelta(days=6)

        # 판매
        sale_agg = (
            db.query(
                func.sum(Sale.total_revenue).label("revenue"),
                func.sum(Sale.total_cost).label("cost"),
                func.count(Sale.id).label("cnt"),
            )
            .filter(
                func.date(Sale.created_at) >= week_start,
                func.date(Sale.created_at) <= week_end,
            )
            .first()
        )
        revenue = float(sale_agg.revenue or 0.0)
        ingredient_cost = float(sale_agg.cost or 0.0)
        sale_count = int(sale_agg.cnt or 0)

        # 폐기 손실
        disposal_cost_row = (
            db.query(func.sum(Transaction.quantity * Item.unit_price))
            .join(Item, Item.id == Transaction.item_id)
            .filter(
                Transaction.type == TransactionType.DISPOSE,
                func.date(Transaction.created_at) >= week_start,
                func.date(Transaction.created_at) <= week_end,
            )
            .scalar()
        ) or 0.0
        disposal_cost = float(disposal_cost_row)

        margin = revenue - ingredient_cost

        # 레이블: M/D~M/D 형식
        label = f"{week_start.month}/{week_start.day}~{week_end.month}/{week_end.day}"

        data.append(
            {
                "week_label": label,
                "start_date": week_start.isoformat(),
                "end_date": week_end.isoformat(),
                "revenue": round(revenue, 0),
                "ingredient_cost": round(ingredient_cost, 0),
                "disposal_cost": round(disposal_cost, 0),
                "margin": round(margin, 0),
                "margin_rate": _safe_rate(margin, revenue),
                "sale_count": sale_count,
            }
        )

    return {"weeks": weeks, "data": data}


# ─── 메뉴 성과 분석 ───────────────────────────────────────────────────────────

@router.get("/menu-performance")
def menu_performance(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
):
    since = date.today() - timedelta(days=days)

    rows = (
        db.query(
            Sale.menu_id,
            func.sum(Sale.quantity).label("sale_count"),
            func.sum(Sale.total_revenue).label("total_revenue"),
            func.sum(Sale.total_cost).label("total_cost"),
        )
        .filter(func.date(Sale.created_at) >= since)
        .group_by(Sale.menu_id)
        .order_by(func.sum(Sale.quantity).desc())
        .all()
    )

    if not rows:
        return {"period_days": days, "menus": []}

    menu_ids = [r.menu_id for r in rows]
    menus_db = db.query(Menu).filter(Menu.id.in_(menu_ids)).all()
    menu_map = {m.id: m for m in menus_db}

    result = []
    for rank, row in enumerate(rows, start=1):
        m = menu_map.get(row.menu_id)
        revenue = float(row.total_revenue or 0.0)
        cost = float(row.total_cost or 0.0)
        result.append(
            {
                "menu_id": row.menu_id,
                "name": m.name if m else f"메뉴#{row.menu_id}",
                "sell_price": m.sell_price if m else 0.0,
                "cost_price": round(cost / float(row.sale_count), 0) if row.sale_count else 0.0,
                "margin_rate": _safe_rate(revenue - cost, revenue),
                "sale_count": int(row.sale_count or 0),
                "total_revenue": round(revenue, 0),
                "total_cost": round(cost, 0),
                "rank": rank,
            }
        )

    return {"period_days": days, "menus": result}
