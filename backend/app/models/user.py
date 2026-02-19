from sqlalchemy import Column, String, Boolean, Enum
from .base import Base, TimestampMixin
import enum


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class User(Base, TimestampMixin):
    __tablename__ = "users"

    username = Column(String(50), unique=True, nullable=False, index=True)
    hashed_password = Column(String(200), nullable=False)
    role = Column(Enum(UserRole), default=UserRole.STAFF)
    is_active = Column(Boolean, default=True)
