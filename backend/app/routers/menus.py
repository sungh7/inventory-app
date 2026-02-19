from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from ..core.database import get_db
from ..models import Menu, RecipeItem, Item

router = APIRouter()


# --- Schemas ---
class RecipeItemOut(BaseModel):
    item_id: int
    item_name: str
    unit: str
    quantity: float
    unit_price: float
    sub_total: float

    class Config:
        from_attributes = True


class MenuOut(BaseModel):
    id: int
    name: str
    category: str
    sell_price: float
    description: Optional[str]
    is_active: int
    cost_price: float
    margin: float
    margin_rate: float
    recipe_items: List[RecipeItemOut]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class MenuCreate(BaseModel):
    name: str
    category: str = "main"
    sell_price: float = 0.0
    description: Optional[str] = None
    is_active: int = 1


class MenuUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    sell_price: Optional[float] = None
    description: Optional[str] = None
    is_active: Optional[int] = None


class RecipeItemInput(BaseModel):
    item_id: int
    quantity: float


class RecipeSetBody(BaseModel):
    items: List[RecipeItemInput]


class CostOut(BaseModel):
    menu_id: int
    menu_name: str
    cost_price: float
    sell_price: float
    margin: float
    margin_rate: float


# --- Helpers ---
def _calc_cost(menu: Menu) -> float:
    return sum(
        ri.quantity * (ri.item.unit_price if ri.item else 0.0)
        for ri in menu.recipe_items
    )


def _build_menu_out(menu: Menu) -> MenuOut:
    cost = _calc_cost(menu)
    margin = menu.sell_price - cost
    margin_rate = (margin / menu.sell_price * 100) if menu.sell_price else 0.0

    recipe_out = []
    for ri in menu.recipe_items:
        recipe_out.append(RecipeItemOut(
            item_id=ri.item_id,
            item_name=ri.item.name if ri.item else "",
            unit=ri.item.unit if ri.item else "",
            quantity=ri.quantity,
            unit_price=ri.item.unit_price if ri.item else 0.0,
            sub_total=ri.quantity * (ri.item.unit_price if ri.item else 0.0),
        ))

    return MenuOut(
        id=menu.id,
        name=menu.name,
        category=menu.category,
        sell_price=menu.sell_price,
        description=menu.description,
        is_active=menu.is_active,
        cost_price=cost,
        margin=margin,
        margin_rate=margin_rate,
        recipe_items=recipe_out,
        created_at=menu.created_at,
    )


def _load_menu(db: Session, menu_id: int) -> Menu:
    menu = (
        db.query(Menu)
        .options(
            joinedload(Menu.recipe_items).joinedload(RecipeItem.item)
        )
        .filter(Menu.id == menu_id)
        .first()
    )
    if not menu:
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다")
    return menu


# --- Routes ---
@router.get("/", response_model=List[MenuOut])
def list_menus(db: Session = Depends(get_db)):
    menus = (
        db.query(Menu)
        .options(joinedload(Menu.recipe_items).joinedload(RecipeItem.item))
        .order_by(Menu.id)
        .all()
    )
    return [_build_menu_out(m) for m in menus]


@router.post("/", response_model=MenuOut, status_code=201)
def create_menu(payload: MenuCreate, db: Session = Depends(get_db)):
    menu = Menu(**payload.model_dump())
    db.add(menu)
    db.commit()
    db.refresh(menu)
    return _build_menu_out(menu)


@router.get("/{menu_id}", response_model=MenuOut)
def get_menu(menu_id: int, db: Session = Depends(get_db)):
    return _build_menu_out(_load_menu(db, menu_id))


@router.patch("/{menu_id}", response_model=MenuOut)
def update_menu(menu_id: int, payload: MenuUpdate, db: Session = Depends(get_db)):
    menu = _load_menu(db, menu_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(menu, field, value)
    db.commit()
    return _build_menu_out(_load_menu(db, menu_id))


@router.delete("/{menu_id}", status_code=204)
def delete_menu(menu_id: int, db: Session = Depends(get_db)):
    menu = db.query(Menu).filter(Menu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다")
    db.delete(menu)
    db.commit()


@router.post("/{menu_id}/recipe", response_model=MenuOut)
def set_recipe(menu_id: int, body: RecipeSetBody, db: Session = Depends(get_db)):
    menu = db.query(Menu).filter(Menu.id == menu_id).first()
    if not menu:
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다")

    # 아이템 존재 여부 검증
    for entry in body.items:
        item = db.query(Item).filter(Item.id == entry.item_id).first()
        if not item:
            raise HTTPException(status_code=404, detail=f"품목 ID {entry.item_id}를 찾을 수 없습니다")

    # 기존 레시피 삭제 후 새로 삽입 (replace 방식)
    db.query(RecipeItem).filter(RecipeItem.menu_id == menu_id).delete()
    for entry in body.items:
        ri = RecipeItem(menu_id=menu_id, item_id=entry.item_id, quantity=entry.quantity)
        db.add(ri)

    db.commit()
    return _build_menu_out(_load_menu(db, menu_id))


@router.get("/{menu_id}/cost", response_model=CostOut)
def get_cost(menu_id: int, db: Session = Depends(get_db)):
    menu = _load_menu(db, menu_id)
    cost = _calc_cost(menu)
    margin = menu.sell_price - cost
    margin_rate = (margin / menu.sell_price * 100) if menu.sell_price else 0.0
    return CostOut(
        menu_id=menu.id,
        menu_name=menu.name,
        cost_price=cost,
        sell_price=menu.sell_price,
        margin=margin,
        margin_rate=margin_rate,
    )
