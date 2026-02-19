from sqlalchemy import Column, String, Float, Integer, ForeignKey, Enum
from sqlalchemy.orm import relationship
import enum

from .base import Base, TimestampMixin


class ItemCategory(str, enum.Enum):
    MEAT = "meat"           # 육류
    VEGETABLE = "vegetable" # 채소
    SAUCE = "sauce"         # 소스/양념
    DRINK = "drink"         # 음료
    OTHER = "other"         # 기타


class Item(Base, TimestampMixin):
    """품목 마스터"""
    __tablename__ = "items"

    barcode = Column(String(50), unique=True, index=True, nullable=True)
    name = Column(String(100), nullable=False)
    category = Column(Enum(ItemCategory), default=ItemCategory.OTHER)
    unit = Column(String(20), nullable=False)       # 단위: kg, 개, 봉, 팩 등
    unit_price = Column(Float, default=0.0)         # 단가
    min_stock = Column(Float, default=0.0)          # 최소 재고 (알림 기준)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    supplier = relationship("Supplier", back_populates="items")

    inventory = relationship("Inventory", back_populates="item", uselist=False)
    transactions = relationship("Transaction", back_populates="item")
