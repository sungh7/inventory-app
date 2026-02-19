from sqlalchemy import Column, String

from .base import Base, TimestampMixin


class PushToken(Base, TimestampMixin):
    __tablename__ = "push_tokens"

    token = Column(String(200), unique=True, nullable=False)
