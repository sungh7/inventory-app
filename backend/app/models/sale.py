from sqlalchemy import Column, Integer, Float, ForeignKey, Text
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin



class Sale(Base, TimestampMixin):
    """판매 기록"""
    __tablename__ = "sales"

    menu_id = Column(Integer, ForeignKey("menus.id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)   # 판매 수량 (인분/개)
    unit_cost = Column(Float, default=0.0)                  # 판매 시점 원가 (계산해서 저장)
    total_cost = Column(Float, default=0.0)                 # unit_cost * quantity
    total_revenue = Column(Float, default=0.0)              # sell_price * quantity
    memo = Column(Text, nullable=True)

    menu = relationship("Menu", back_populates="sales")

    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    staff = relationship("Staff")
