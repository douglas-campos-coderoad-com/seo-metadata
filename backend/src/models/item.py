from sqlalchemy import Column, Integer, String, Text, Float, ForeignKey, ARRAY
from src.models import Base, TimestampMixin


class Item(Base, TimestampMixin):
    __tablename__ = 'items'

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False, index=True)
    period_id = Column(Integer, ForeignKey('periods.id'), nullable=False, index=True)
    dealer_id = Column(Integer, ForeignKey('dealers.id'), nullable=False, index=True)
    image_urls = Column(ARRAY(String), nullable=True, default=[])
    condition = Column(String(255), nullable=True)
    asking_price = Column(Float, nullable=True)
    status = Column(String(50), default='available', nullable=False, index=True)
