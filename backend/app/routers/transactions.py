from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import date, datetime

from ..core.database import get_db
from ..core.config import settings
from ..models import Transaction, TransactionType, Item, Inventory, Staff

router = APIRouter()


# --- Schemas ---
class TransactionCreate(BaseModel):
    item_id: int
    type: TransactionType
    quantity: float
    unit_price: Optional[float] = None
    expiry_date: Optional[date] = None
    memo: Optional[str] = None
    staff_id: Optional[int] = None

class TransactionOut(BaseModel):
    id: int
    item_id: int
    item_name: Optional[str] = None
    type: TransactionType
    quantity: float
    unit_price: Optional[float]
    expiry_date: Optional[date]
    memo: Optional[str]
    created_at: Optional[datetime] = None
    staff_id: Optional[int] = None
    staff_name: Optional[str] = None

    class Config:
        from_attributes = True


# --- Routes ---
@router.get("/", response_model=List[TransactionOut])
def list_transactions(
    item_id: Optional[int] = None,
    type: Optional[TransactionType] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(Transaction)
    if item_id:
        query = query.filter(Transaction.item_id == item_id)
    if type:
        query = query.filter(Transaction.type == type)
    # [W-2] joinedload로 N+1 쿼리 해결
    txs = (
        query
        .options(joinedload(Transaction.item), joinedload(Transaction.staff))
        .order_by(Transaction.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for tx in txs:
        data = TransactionOut.model_validate(tx)
        data.item_name = tx.item.name if tx.item else None
        data.staff_name = tx.staff.name if tx.staff else None
        result.append(data)
    return result


@router.post("/", response_model=TransactionOut, status_code=201)
def create_transaction(payload: TransactionCreate, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="품목을 찾을 수 없습니다")

    # staff_id 유효성 검사
    if payload.staff_id is not None:
        staff = db.query(Staff).filter(Staff.id == payload.staff_id, Staff.is_active == True).first()
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    inv = item.inventory
    if not inv:
        inv = Inventory(item_id=item.id, quantity=0.0)
        db.add(inv)
        db.flush()

    # 재고 증감
    if payload.type == TransactionType.IN:
        inv.quantity += payload.quantity
        if payload.expiry_date:
            inv.expiry_date = payload.expiry_date
    else:
        # [C-4] 출고/폐기: with_for_update() — SQLite는 미지원이므로 조건부 적용
        q = db.query(Inventory).filter(Inventory.item_id == payload.item_id)
        if not settings.DATABASE_URL.startswith("sqlite"):
            q = q.with_for_update()
        inv = q.first()

        if inv is None:
            raise HTTPException(status_code=400, detail="재고 정보를 찾을 수 없습니다")

        # 재고 부족 체크
        if inv.quantity < payload.quantity:
            raise HTTPException(status_code=400, detail=f"재고 부족 (현재: {inv.quantity}{item.unit})")
        inv.quantity -= payload.quantity

    tx = Transaction(**payload.model_dump())
    db.add(tx)
    db.commit()
    db.refresh(tx)
    # staff 관계 로드
    if tx.staff_id:
        db.refresh(tx)
        tx_staff = db.query(Staff).filter(Staff.id == tx.staff_id).first()
    else:
        tx_staff = None
    data = TransactionOut.model_validate(tx)
    data.item_name = item.name
    data.staff_name = tx_staff.name if tx_staff else None
    return data
