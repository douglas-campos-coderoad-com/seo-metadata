from sqlalchemy import Column, Integer, String, Boolean, Text
from src.models import Base, TimestampMixin


class Dealer(Base, TimestampMixin):
    __tablename__ = 'dealers'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    inquiries_enabled = Column(Boolean, default=True, nullable=False)
