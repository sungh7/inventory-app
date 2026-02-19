from sqlalchemy import Column, String, Float, Integer, ForeignKey, Enum, Text, Date
from sqlalchemy.orm import relationship
import enum

from .base import Base, TimestampMixin


class OrderStatus(str, enum.Enum):
    DRAFT = "draft"         # 초안
    SENT = "sent"           # 발주 완료
    RECEIVED = "received"   # 입고 완료
    CANCELLED = "cancelled" # 취소


class Order(Base, TimestampMixin):
    """발주서"""
    __tablename__ = "orders"

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)
    status = Column(Enum(OrderStatus), default=OrderStatus.DRAFT)
    memo = Column(Text, nullable=True)
    expected_date = Column(Date, nullable=True)  # 예상 입고일

    supplier = relationship("Supplier")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base, TimestampMixin):
    """발주 품목"""
    __tablename__ = "order_items"

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    quantity = Column(Float, nullable=False)       # 발주 수량
    unit_price = Column(Float, nullable=True)      # 발주 단가

    order = relationship("Order", back_populates="items")
    item = relationship("Item")
