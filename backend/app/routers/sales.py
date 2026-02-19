from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from ..core.database import get_db
from ..models import Sale, Menu, RecipeItem, Inventory, Transaction, TransactionType, Item, Staff

router = APIRouter()


# --- Schemas ---
class SaleCreate(BaseModel):
    menu_id: int
    quantity: int = 1
    memo: Optional[str] = None
    staff_id: Optional[int] = None


class DeductedItem(BaseModel):
    item_id: int
    item_name: str
    unit: str
    deducted_quantity: float


class SaleCreateOut(BaseModel):
    sale_id: int
    menu_name: str
    quantity: int
    total_cost: float
    total_revenue: float
    deducted_items: List[DeductedItem]


class SaleOut(BaseModel):
    id: int
    menu_id: int
    menu_name: str
    quantity: int
    unit_cost: float
    total_cost: float
    total_revenue: float
    memo: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class MenuSummary(BaseModel):
    menu_id: int
    menu_name: str
    count: int
    revenue: float
    cost: float
    margin: float


class SaleSummaryOut(BaseModel):
    total_sales_count: int
    total_revenue: float
    total_cost: float
    total_margin: float
    by_menu: List[MenuSummary]


# --- Routes ---
@router.post("/", response_model=SaleCreateOut, status_code=201)
def create_sale(payload: SaleCreate, db: Session = Depends(get_db)):
    # staff_id 유효성 검사
    if payload.staff_id is not None:
        staff = db.query(Staff).filter(Staff.id == payload.staff_id, Staff.is_active == True).first()
        if not staff:
            raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다")

    # 1. 메뉴 + 레시피 조회
    menu = (
        db.query(Menu)
        .options(joinedload(Menu.recipe_items).joinedload(RecipeItem.item))
        .filter(Menu.id == payload.menu_id)
        .first()
    )
    if not menu:
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다")

    if not menu.recipe_items:
        raise HTTPException(status_code=422, detail="레시피가 등록되지 않은 메뉴입니다")

    # 2. 재고 체크
    insufficient = []
    for ri in menu.recipe_items:
        need = ri.quantity * payload.quantity
        inv = db.query(Inventory).filter(Inventory.item_id == ri.item_id).first()
        current = inv.quantity if inv else 0.0
        if current < need:
            item_name = ri.item.name if ri.item else f"item#{ri.item_id}"
            insufficient.append(
                f"{item_name}: 필요 {need}{ri.item.unit if ri.item else ''}, 현재 {current}{ri.item.unit if ri.item else ''}"
            )

    if insufficient:
        raise HTTPException(
            status_code=422,
            detail="재고 부족:\n" + "\n".join(insufficient),
        )

    # 3. 원가 계산
    unit_cost = sum(
        ri.quantity * (ri.item.unit_price if ri.item else 0.0)
        for ri in menu.recipe_items
    )
    total_cost = unit_cost * payload.quantity
    total_revenue = menu.sell_price * payload.quantity

    deducted_items: List[DeductedItem] = []

    for ri in menu.recipe_items:
        deduct_qty = ri.quantity * payload.quantity
        item: Item = ri.item

        # 3a. Transaction(OUT) 생성
        tx = Transaction(
            item_id=ri.item_id,
            type=TransactionType.OUT,
            quantity=deduct_qty,
            memo=f"판매: {menu.name} {payload.quantity}인분",
        )
        db.add(tx)

        # 3b. Inventory 차감
        inv = db.query(Inventory).filter(Inventory.item_id == ri.item_id).first()
        inv.quantity -= deduct_qty

        deducted_items.append(DeductedItem(
            item_id=ri.item_id,
            item_name=item.name if item else "",
            unit=item.unit if item else "",
            deducted_quantity=deduct_qty,
        ))

    # 4. Sale 저장
    sale = Sale(
        menu_id=payload.menu_id,
        quantity=payload.quantity,
        unit_cost=unit_cost,
        total_cost=total_cost,
        total_revenue=total_revenue,
        memo=payload.memo,
        staff_id=payload.staff_id,
    )
    db.add(sale)
    db.commit()
    db.refresh(sale)

    return SaleCreateOut(
        sale_id=sale.id,
        menu_name=menu.name,
        quantity=payload.quantity,
        total_cost=total_cost,
        total_revenue=total_revenue,
        deducted_items=deducted_items,
    )


@router.get("/summary", response_model=SaleSummaryOut)
def get_summary(days: int = 30, db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    sales = (
        db.query(Sale)
        .options(joinedload(Sale.menu))
        .filter(Sale.created_at >= since)
        .all()
    )

    total_count = sum(s.quantity for s in sales)
    total_revenue = sum(s.total_revenue for s in sales)
    total_cost = sum(s.total_cost for s in sales)

    # by_menu 집계
    by_menu_map: dict = {}
    for s in sales:
        mid = s.menu_id
        mname = s.menu.name if s.menu else f"menu#{mid}"
        if mid not in by_menu_map:
            by_menu_map[mid] = {"menu_id": mid, "menu_name": mname, "count": 0, "revenue": 0.0, "cost": 0.0}
        by_menu_map[mid]["count"] += s.quantity
        by_menu_map[mid]["revenue"] += s.total_revenue
        by_menu_map[mid]["cost"] += s.total_cost

    by_menu = sorted(
        [
            MenuSummary(
                menu_id=v["menu_id"],
                menu_name=v["menu_name"],
                count=v["count"],
                revenue=v["revenue"],
                cost=v["cost"],
                margin=v["revenue"] - v["cost"],
            )
            for v in by_menu_map.values()
        ],
        key=lambda x: x.count,
        reverse=True,
    )

    return SaleSummaryOut(
        total_sales_count=total_count,
        total_revenue=total_revenue,
        total_cost=total_cost,
        total_margin=total_revenue - total_cost,
        by_menu=by_menu,
    )


@router.get("/", response_model=List[SaleOut])
def list_sales(days: int = 30, db: Session = Depends(get_db)):
    since = datetime.now(timezone.utc) - timedelta(days=days)

    sales = (
        db.query(Sale)
        .options(joinedload(Sale.menu))
        .filter(Sale.created_at >= since)
        .order_by(Sale.created_at.desc())
        .all()
    )

    result = []
    for s in sales:
        out = SaleOut(
            id=s.id,
            menu_id=s.menu_id,
            menu_name=s.menu.name if s.menu else "",
            quantity=s.quantity,
            unit_cost=s.unit_cost,
            total_cost=s.total_cost,
            total_revenue=s.total_revenue,
            memo=s.memo,
            created_at=s.created_at,
        )
        result.append(out)
    return result


@router.delete("/{sale_id}", status_code=204)
def cancel_sale(sale_id: int, db: Session = Depends(get_db)):
    sale = (
        db.query(Sale)
        .options(joinedload(Sale.menu).joinedload(Menu.recipe_items).joinedload(RecipeItem.item))
        .filter(Sale.id == sale_id)
        .first()
    )
    if not sale:
        raise HTTPException(status_code=404, detail="판매 기록을 찾을 수 없습니다")

    menu = sale.menu
    if menu and menu.recipe_items:
        for ri in menu.recipe_items:
            restore_qty = ri.quantity * sale.quantity

            # 재고 복구
            inv = db.query(Inventory).filter(Inventory.item_id == ri.item_id).first()
            if inv:
                inv.quantity += restore_qty

            # 관련 Transaction 삭제 (판매 시 생성된 OUT 거래 중 최신 것)
            tx = (
                db.query(Transaction)
                .filter(
                    Transaction.item_id == ri.item_id,
                    Transaction.type == TransactionType.OUT,
                    Transaction.memo.like(f"판매: {menu.name}%"),
                )
                .order_by(Transaction.created_at.desc())
                .first()
            )
            if tx:
                db.delete(tx)

    db.delete(sale)
    db.commit()
