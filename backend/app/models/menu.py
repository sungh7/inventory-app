from sqlalchemy import Column, String, Float, Integer, ForeignKey, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Menu(Base, TimestampMixin):
    """메뉴 마스터 (예: 삼겹살 1인분, 목살 2인분)"""
    __tablename__ = "menus"

    name = Column(String(100), nullable=False)          # 메뉴명
    category = Column(String(50), default="main")       # main/side/drink
    sell_price = Column(Float, default=0.0)             # 판매가 (원)
    description = Column(Text, nullable=True)
    is_active = Column(Integer, default=1)              # 0=비활성

    recipe_items = relationship(
        "RecipeItem", back_populates="menu", cascade="all, delete-orphan"
    )
    sales = relationship("Sale", back_populates="menu")


class RecipeItem(Base, TimestampMixin):
    """메뉴별 레시피 재료"""
    __tablename__ = "recipe_items"

    menu_id = Column(Integer, ForeignKey("menus.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Float, nullable=False)            # 소요량

    menu = relationship("Menu", back_populates="recipe_items")
    item = relationship("Item")
