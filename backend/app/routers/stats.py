"""
통계 API
- 품목별 주간/월간 소비량
- 폐기율 + 원가 손실
- 카테고리별 재고 비율
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta

from ..core.database import get_db
from ..models import Transaction, TransactionType, Item, Inventory, ItemCategory

router = APIRouter()


@router.get("/consumption")
def consumption_stats(days: int = 7, db: Session = Depends(get_db)):
    """기간별 품목 소비량 (출고 기준)"""
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(Item.id, Item.name, Item.unit, func.sum(Transaction.quantity).label("total"))
        .join(Transaction, Transaction.item_id == Item.id)
        .filter(
            Transaction.type == TransactionType.OUT,
            func.date(Transaction.created_at) >= since,
        )
        .group_by(Item.id, Item.name, Item.unit)
        .order_by(func.sum(Transaction.quantity).desc())
        .all()
    )
    return [
        {"item_id": r.id, "name": r.name, "unit": r.unit, "total": round(r.total, 2)}
        for r in rows
    ]


@router.get("/disposal")
def disposal_stats(days: int = 30, db: Session = Depends(get_db)):
    """폐기 통계 + 원가 손실 계산"""
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(
            Item.id, Item.name, Item.unit, Item.unit_price,
            func.sum(Transaction.quantity).label("disposed_qty"),
        )
        .join(Transaction, Transaction.item_id == Item.id)
        .filter(
            Transaction.type == TransactionType.DISPOSE,
            func.date(Transaction.created_at) >= since,
        )
        .group_by(Item.id, Item.name, Item.unit, Item.unit_price)
        .all()
    )
    result = []
    total_loss = 0.0
    for r in rows:
        loss = round(r.disposed_qty * r.unit_price, 0)
        total_loss += loss
        result.append({
            "item_id": r.id,
            "name": r.name,
            "unit": r.unit,
            "disposed_qty": round(r.disposed_qty, 2),
            "loss_krw": loss,
        })
    return {"period_days": days, "total_loss_krw": total_loss, "items": result}


@router.get("/category-stock")
def category_stock(db: Session = Depends(get_db)):
    """카테고리별 현재 재고 수량 합계"""
    rows = (
        db.query(Item.category, func.count(Item.id).label("item_count"),
                 func.sum(Inventory.quantity).label("total_qty"))
        .join(Inventory, Inventory.item_id == Item.id)
        .group_by(Item.category)
        .all()
    )
    labels = {
        ItemCategory.MEAT: "육류", ItemCategory.VEGETABLE: "채소",
        ItemCategory.SAUCE: "소스", ItemCategory.DRINK: "음료",
        ItemCategory.OTHER: "기타",
    }
    return [
        {
            "category": r.category.value,
            "label": labels.get(r.category, r.category.value),
            "item_count": r.item_count,
            "total_qty": round(r.total_qty or 0, 2),
        }
        for r in rows
    ]


@router.get("/summary")
def summary(db: Session = Depends(get_db)):
    """대시보드 요약 카드"""
    total_items = db.query(Item).count()
    low_stock = (
        db.query(Inventory)
        .join(Item)
        .filter(Inventory.quantity <= Item.min_stock, Item.min_stock > 0)
        .count()
    )
    expiring = (
        db.query(Inventory)
        .filter(
            Inventory.expiry_date.isnot(None),
            Inventory.expiry_date >= date.today(),
            Inventory.expiry_date <= date.today() + timedelta(days=3),
        )
        .count()
    )
    today_in = (
        db.query(func.sum(Transaction.quantity))
        .filter(
            Transaction.type == TransactionType.IN,
            func.date(Transaction.created_at) == date.today(),
        )
        .scalar() or 0
    )
    today_out = (
        db.query(func.sum(Transaction.quantity))
        .filter(
            Transaction.type == TransactionType.OUT,
            func.date(Transaction.created_at) == date.today(),
        )
        .scalar() or 0
    )
    return {
        "total_items": total_items,
        "low_stock_count": low_stock,
        "expiring_soon_count": expiring,
        "today_in": round(today_in, 2),
        "today_out": round(today_out, 2),
    }
