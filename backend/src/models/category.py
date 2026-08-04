from sqlalchemy import Column, Integer, String, Text
from src.models import Base, TimestampMixin


class Category(Base, TimestampMixin):
    __tablename__ = 'categories'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
