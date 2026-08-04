from sqlalchemy import Column, Integer, String
from src.models import Base, TimestampMixin


class Period(Base, TimestampMixin):
    __tablename__ = 'periods'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    start_year = Column(Integer, nullable=False)
    end_year = Column(Integer, nullable=False)
