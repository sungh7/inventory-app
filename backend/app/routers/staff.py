from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from ..core.database import get_db
from ..models import Staff, Transaction, Sale, TransactionType

router = APIRouter()


# --- Schemas ---
class StaffCreate(BaseModel):
    name: str
    role: str = "staff"
    pin: Optional[str] = None


class StaffUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    pin: Optional[str] = None
    is_active: Optional[bool] = None


class StaffOut(BaseModel):
    id: int
    name: str
    role: str
    pin: Optional[str]
    is_active: bool
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class TransactionHistoryItem(BaseModel):
    id: int
    item_id: int
    item_name: Optional[str]
    type: str
    quantity: float
    memo: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class SaleHistoryItem(BaseModel):
    id: int
    menu_id: int
    menu_name: Optional[str]
    quantity: int
    total_cost: float
    total_revenue: float
    memo: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class StaffHistorySummary(BaseModel):
    in_count: int
    out_count: int
    dispose_count: int
    sale_count: int


class StaffHistoryOut(BaseModel):
    staff: StaffOut
    transactions: List[TransactionHistoryItem]
    sales: List[SaleHistoryItem]
    summary: StaffHistorySummary


class StaffActivitySummary(BaseModel):
    staff_id: int
    name: str
    role: str
    in_count: int
    out_count: int
    dispose_count: int
    sale_count: int
    last_activity: Optional[datetime]


# --- Routes ---
@router.get("/summary", response_model=List[StaffActivitySummary])
def get_staff_summary(days: int = 30, db: Session = Depends(get_db)):
    """전체 직원 활동 요약 — /staff/summary (GET /staff/{id}/history 보다 먼저 등록해야 함)"""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    staffs = db.query(Staff).filter(Staff.is_active == True).all()
    result = []

    for s in staffs:
        txs = (
            db.query(Transaction)
            .filter(Transaction.staff_id == s.id, Transaction.created_at >= since)
            .all()
        )
        sales = (
            db.query(Sale)
            .filter(Sale.staff_id == s.id, Sale.created_at >= since)
            .all()
        )

        in_count = sum(1 for t in txs if t.type == TransactionType.IN)
        out_count = sum(1 for t in txs if t.type == TransactionType.OUT)
        dispose_count = sum(1 for t in txs if t.type == TransactionType.DISPOSE)
        sale_count = sum(s2.quantity for s2 in sales)

        # 마지막 활동일
        all_times = [t.created_at for t in txs if t.created_at] + \
                    [s2.created_at for s2 in sales if s2.created_at]
        last_activity = max(all_times) if all_times else None

        result.append(StaffActivitySummary(
            staff_id=s.id,
            name=s.name,
            role=s.role,
            in_count=in_count,
            out_count=out_count,
            dispose_count=dispose_count,
            sale_count=sale_count,
            last_activity=last_activity,
        ))

    # 활동 많은 순 정렬
    result.sort(key=lambda x: (x.in_count + x.out_count + x.dispose_count + x.sale_count), reverse=True)
    return result


@router.get("/", response_model=List[StaffOut])
def list_staff(db: Session = Depends(get_db)):
    """전체 직원 목록 (is_active=True만)"""
    return db.query(Staff).filter(Staff.is_active == True).order_by(Staff.name).all()


@router.post("/", response_model=StaffOut, status_code=201)
def create_staff(payload: StaffCreate, db: Session = Depends(get_db)):
    """직원 등록"""
    staff = Staff(
        name=payload.name,
        role=payload.role,
        pin=payload.pin,
    )
    db.add(staff)
    db.commit()
    db.refresh(staff)
    return staff


@router.patch("/{staff_id}", response_model=StaffOut)
def update_staff(staff_id: int, payload: StaffUpdate, db: Session = Depends(get_db)):
    """직원 정보 수정"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(staff, field, value)

    db.commit()
    db.refresh(staff)
    return staff


@router.delete("/{staff_id}", status_code=204)
def deactivate_staff(staff_id: int, db: Session = Depends(get_db)):
    """직원 비활성화 (실제 삭제 아님)"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    staff.is_active = False
    db.commit()


@router.get("/{staff_id}/history", response_model=StaffHistoryOut)
def get_staff_history(staff_id: int, days: int = 30, db: Session = Depends(get_db)):
    """특정 직원의 입출고/판매 이력"""
    staff = db.query(Staff).filter(Staff.id == staff_id).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    since = datetime.now(timezone.utc) - timedelta(days=days)

    # 트랜잭션 이력
    from sqlalchemy.orm import joinedload
    txs = (
        db.query(Transaction)
        .options(joinedload(Transaction.item))
        .filter(Transaction.staff_id == staff_id, Transaction.created_at >= since)
        .order_by(Transaction.created_at.desc())
        .all()
    )

    # 판매 이력
    sales = (
        db.query(Sale)
        .options(joinedload(Sale.menu))
        .filter(Sale.staff_id == staff_id, Sale.created_at >= since)
        .order_by(Sale.created_at.desc())
        .all()
    )

    tx_items = [
        TransactionHistoryItem(
            id=t.id,
            item_id=t.item_id,
            item_name=t.item.name if t.item else None,
            type=t.type.value if hasattr(t.type, 'value') else t.type,
            quantity=t.quantity,
            memo=t.memo,
            created_at=t.created_at,
        )
        for t in txs
    ]

    sale_items = [
        SaleHistoryItem(
            id=s.id,
            menu_id=s.menu_id,
            menu_name=s.menu.name if s.menu else None,
            quantity=s.quantity,
            total_cost=s.total_cost,
            total_revenue=s.total_revenue,
            memo=s.memo,
            created_at=s.created_at,
        )
        for s in sales
    ]

    in_count = sum(1 for t in txs if t.type == TransactionType.IN)
    out_count = sum(1 for t in txs if t.type == TransactionType.OUT)
    dispose_count = sum(1 for t in txs if t.type == TransactionType.DISPOSE)
    sale_count = sum(s.quantity for s in sales)

    return StaffHistoryOut(
        staff=StaffOut.model_validate(staff),
        transactions=tx_items,
        sales=sale_items,
        summary=StaffHistorySummary(
            in_count=in_count,
            out_count=out_count,
            dispose_count=dispose_count,
            sale_count=sale_count,
        ),
    )
