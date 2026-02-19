from sqlalchemy import Column, Float, Integer, ForeignKey, Date
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Inventory(Base, TimestampMixin):
    """현재 재고량"""
    __tablename__ = "inventory"

    item_id = Column(Integer, ForeignKey("items.id"), unique=True, nullable=False)
    quantity = Column(Float, default=0.0)           # 현재 수량
    expiry_date = Column(Date, nullable=True)       # 유통기한 (최근 입고 기준)

    item = relationship("Item", back_populates="inventory")
