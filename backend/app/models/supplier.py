from sqlalchemy import Column, String
from sqlalchemy.orm import relationship

from .base import Base, TimestampMixin


class Supplier(Base, TimestampMixin):
    """공급업체"""
    __tablename__ = "suppliers"

    name = Column(String(100), nullable=False)
    contact = Column(String(50), nullable=True)     # 연락처
    email = Column(String(100), nullable=True)      # 이메일 (발주서 수신)
    memo = Column(String(255), nullable=True)

    items = relationship("Item", back_populates="supplier")
