from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Optional

from ..core.database import get_db
from ..core.ai_forecast import predict_consumption, calculate_smart_order, auto_create_orders
from ..core.scheduler import scheduler
from apscheduler.triggers.cron import CronTrigger

router = APIRouter()


@router.get("/forecast/{item_id}")
def forecast_item(item_id: int, days: int = 14, db: Session = Depends(get_db)):
    """특정 품목 소비량 AI 예측"""
    from ..models import Item
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="품목 없음")
    result = predict_consumption(db, item_id, forecast_days=days)
    return {
        "item_id": item_id,
        "item_name": item.name,
        "unit": item.unit,
        **result,
        "weekday_labels": ["월", "화", "수", "목", "금", "토", "일"],
    }


@router.get("/forecast")
def forecast_all(days: int = 14, db: Session = Depends(get_db)):
    """
    전체 품목 소비량 예측 (재고 있는 품목만)
    
    [W-4] TODO: 캐싱 도입 권장
    - 품목 수가 많아지면 응답 시간 선형 증가
    - Redis 또는 메모리 캐시 (TTL 1시간) 적용 고려
    """
    from ..models import Item, Inventory
    items = db.query(Item).join(Inventory).all()
    results = []
    for item in items:
        pred = predict_consumption(db, item.id, forecast_days=days)
        results.append({
            "item_id": item.id,
            "item_name": item.name,
            "unit": item.unit,
            "current_stock": item.inventory.quantity if item.inventory else 0,
            **pred,
        })
    # 소비량 많은 순
    return sorted(results, key=lambda x: x["forecast_total"], reverse=True)


@router.get("/smart-order")
def smart_order_recommend(db: Session = Depends(get_db)):
    """
    AI 기반 발주 추천 (전 품목 분석)
    
    [W-4] TODO: 캐싱 도입 권장
    - 품목 수 증가 시 성능 저하
    - 결과를 1시간 캐싱하거나 백그라운드 작업으로 전환 고려
    """
    from ..models import Item
    items = db.query(Item).all()
    recommendations = []
    for item in items:
        result = calculate_smart_order(db, item.id)
        if result:
            recommendations.append(result)

    recommendations.sort(key=lambda x: x["estimated_cost"], reverse=True)
    return {
        "count": len(recommendations),
        "total_estimated_cost": sum(r["estimated_cost"] for r in recommendations),
        "items": recommendations,
    }


@router.post("/auto-order")
def trigger_auto_order(dry_run: bool = True, db: Session = Depends(get_db)):
    """
    AI 자동 발주 실행
    dry_run=true (기본): 추천만, 실제 발주서 생성 안 함
    dry_run=false: 발주서 자동 생성
    """
    result = auto_create_orders(db, dry_run=dry_run)
    return result


@router.post("/auto-order/schedule")
def set_auto_order_schedule(hour: int = 8, minute: int = 0, db: Session = Depends(get_db)):
    """
    자동 발주 스케줄 등록 (매일 특정 시간)
    기본: 매일 오전 8시
    """
    from ..core.database import SessionLocal

    async def _job():
        _db = SessionLocal()
        try:
            result = auto_create_orders(_db, dry_run=False)
            print(f"[AutoOrder] {result['message']} / 비용: ₩{result.get('total_cost', 0):,.0f}")
        finally:
            _db.close()

    scheduler.add_job(
        _job,
        trigger=CronTrigger(hour=hour, minute=minute, timezone="Asia/Seoul"),
        id="auto_order",
        replace_existing=True,
    )
    return {"ok": True, "schedule": f"매일 {hour:02d}:{minute:02d} 자동 발주 활성화"}
