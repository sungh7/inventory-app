from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel

from ..core.database import get_db
from ..models import Item, Inventory, ItemCategory

router = APIRouter()


# --- Schemas ---
class ItemCreate(BaseModel):
    barcode: Optional[str] = None
    name: str
    category: ItemCategory = ItemCategory.OTHER
    unit: str
    unit_price: float = 0.0
    min_stock: float = 0.0
    supplier_id: Optional[int] = None

class ItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[ItemCategory] = None
    unit: Optional[str] = None
    unit_price: Optional[float] = None
    min_stock: Optional[float] = None
    supplier_id: Optional[int] = None

class ItemOut(BaseModel):
    id: int
    barcode: Optional[str]
    name: str
    category: ItemCategory
    unit: str
    unit_price: float
    min_stock: float
    supplier_id: Optional[int]
    current_stock: Optional[float] = None  # inventory에서 join

    class Config:
        from_attributes = True


# --- Routes ---
@router.get("/", response_model=List[ItemOut])
def list_items(category: Optional[ItemCategory] = None, db: Session = Depends(get_db)):
    query = db.query(Item)
    if category:
        query = query.filter(Item.category == category)
    # [W-1] joinedload로 N+1 쿼리 해결
    items = query.options(joinedload(Item.inventory), joinedload(Item.supplier)).all()
    result = []
    for item in items:
        data = ItemOut.model_validate(item)
        data.current_stock = item.inventory.quantity if item.inventory else 0.0
        result.append(data)
    return result


@router.get("/barcode/{barcode}", response_model=ItemOut)
def get_by_barcode(barcode: str, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.barcode == barcode).first()
    if not item:
        raise HTTPException(status_code=404, detail="품목을 찾을 수 없습니다")
    data = ItemOut.model_validate(item)
    data.current_stock = item.inventory.quantity if item.inventory else 0.0
    return data


@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="품목을 찾을 수 없습니다")
    data = ItemOut.model_validate(item)
    data.current_stock = item.inventory.quantity if item.inventory else 0.0
    return data


@router.post("/", response_model=ItemOut, status_code=201)
def create_item(payload: ItemCreate, db: Session = Depends(get_db)):
    if payload.barcode:
        exists = db.query(Item).filter(Item.barcode == payload.barcode).first()
        if exists:
            raise HTTPException(status_code=400, detail="이미 등록된 바코드입니다")
    item = Item(**payload.model_dump())
    db.add(item)
    db.flush()
    # 재고 초기화
    inv = Inventory(item_id=item.id, quantity=0.0)
    db.add(inv)
    db.commit()
    db.refresh(item)
    return ItemOut.model_validate(item)


@router.patch("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="품목을 찾을 수 없습니다")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    db.commit()
    db.refresh(item)
    data = ItemOut.model_validate(item)
    data.current_stock = item.inventory.quantity if item.inventory else 0.0
    return data


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="품목을 찾을 수 없습니다")
    db.delete(item)
    db.commit()
