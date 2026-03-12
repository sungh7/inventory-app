from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from ..core.database import get_db
from ..core.auth import require_admin
from ..models import Supplier

router = APIRouter()


class SupplierCreate(BaseModel):
    name: str
    contact: Optional[str] = None
    email: Optional[str] = None
    memo: Optional[str] = None


class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact: Optional[str] = None
    email: Optional[str] = None
    memo: Optional[str] = None


class SupplierOut(BaseModel):
    id: int
    name: str
    contact: Optional[str]
    email: Optional[str]
    memo: Optional[str]

    class Config:
        from_attributes = True


@router.get("/", response_model=List[SupplierOut])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(Supplier).all()


@router.post("/", response_model=SupplierOut, status_code=201)
def create_supplier(payload: SupplierCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    supplier = Supplier(**payload.model_dump())
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierOut)
def update_supplier(supplier_id: int, payload: SupplierUpdate, db: Session = Depends(get_db), _=Depends(require_admin)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="공급업체를 찾을 수 없습니다")
    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(supplier, key, value)
    db.commit()
    db.refresh(supplier)
    return supplier


@router.delete("/{supplier_id}", status_code=204)
def delete_supplier(supplier_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="공급업체를 찾을 수 없습니다")
    db.delete(supplier)
    db.commit()
