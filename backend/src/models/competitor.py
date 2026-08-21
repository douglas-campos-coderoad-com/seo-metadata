from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from src.models import Base, TimestampMixin


class Competitor(Base, TimestampMixin):
    __tablename__ = 'competitors'

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer,
        ForeignKey('projects.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    url = Column(String(2048), nullable=False)
    description = Column(Text, nullable=False)
    seo_score = Column(Integer, nullable=True)
    geo_score = Column(Integer, nullable=True)
    status = Column(String(50), nullable=True)
    analyzed_at = Column(DateTime(timezone=True), nullable=True)

    project = relationship('Project', backref='competitors')
