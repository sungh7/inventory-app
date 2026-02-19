from sqlalchemy import Column, String, Integer, Boolean
from .base import Base, TimestampMixin


class Staff(Base, TimestampMixin):
    """직원 마스터"""
    __tablename__ = "staff"

    name = Column(String(50), nullable=False)
    role = Column(String(30), default="staff")   # manager / staff
    pin = Column(String(6), nullable=True)        # 4~6자리 PIN (선택)
    is_active = Column(Boolean, default=True)
