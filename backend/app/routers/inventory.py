from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from datetime import date, timedelta
from sqlalchemy import and_

from ..core.database import get_db
from ..models import Inventory, Item

router = APIRouter()


class InventoryOut(BaseModel):
    item_id: int
    item_name: str
    category: str
    unit: str
    quantity: float
    min_stock: float
    expiry_date: date | None
    is_low_stock: bool
    is_expiring_soon: bool  # 3일 이내

    class Config:
        from_attributes = True


@router.get("/", response_model=List[InventoryOut])
def list_inventory(db: Session = Depends(get_db)):
    inventories = db.query(Inventory).join(Item).all()
    today = date.today()
    result = []
    for inv in inventories:
        item = inv.item
        expiring = (
            inv.expiry_date is not None
            and inv.expiry_date <= today + timedelta(days=3)
        )
        result.append(InventoryOut(
            item_id=item.id,
            item_name=item.name,
            category=item.category.value,
            unit=item.unit,
            quantity=inv.quantity,
            min_stock=item.min_stock,
            expiry_date=inv.expiry_date,
            is_low_stock=(item.min_stock > 0 and inv.quantity <= item.min_stock),
            is_expiring_soon=expiring,
        ))
    return result


@router.get("/alerts")
def get_alerts(db: Session = Depends(get_db)):
    """재고 부족 + 유통기한 임박 항목만 반환"""
    today = date.today()
    soon = today + timedelta(days=3)

    inventories = db.query(Inventory).join(Item).all()
    low_stock = []
    expiring = []

    for inv in inventories:
        item = inv.item
        if inv.quantity <= item.min_stock:
            low_stock.append({"item_id": item.id, "name": item.name, "quantity": inv.quantity, "unit": item.unit})
        if inv.expiry_date and inv.expiry_date <= soon:
            expiring.append({"item_id": item.id, "name": item.name, "expiry_date": str(inv.expiry_date)})

    return {"low_stock": low_stock, "expiring_soon": expiring}
