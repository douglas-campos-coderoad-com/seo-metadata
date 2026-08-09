from sqlalchemy import Column, Integer, String, Text
from src.models import Base, TimestampMixin


class IngestedUrl(Base, TimestampMixin):
    __tablename__ = 'ingested_urls'

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String(2048), nullable=False, unique=True, index=True)
    html = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default='success')
    http_status = Column(Integer, nullable=True)
    content_type = Column(String(255), nullable=True)
    error = Column(Text, nullable=True)