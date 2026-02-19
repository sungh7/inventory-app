from sqlalchemy import Column, String, Float, Integer, ForeignKey, Enum, Date, Text
from sqlalchemy.orm import relationship
import enum

from .base import Base, TimestampMixin



class TransactionType(str, enum.Enum):
    IN = "in"           # 입고
    OUT = "out"         # 출고 (사용)
    DISPOSE = "dispose" # 폐기


class Transaction(Base, TimestampMixin):
    """입출고/폐기 이력"""
    __tablename__ = "transactions"

    item_id = Column(Integer, ForeignKey("items.id"), nullable=False)
    type = Column(Enum(TransactionType), nullable=False)
    quantity = Column(Float, nullable=False)        # 수량
    unit_price = Column(Float, nullable=True)       # 단가 (입고 시)
    expiry_date = Column(Date, nullable=True)       # 유통기한 (입고 시)
    memo = Column(Text, nullable=True)              # 메모

    item = relationship("Item", back_populates="transactions")

    staff_id = Column(Integer, ForeignKey("staff.id"), nullable=True)
    staff = relationship("Staff")
