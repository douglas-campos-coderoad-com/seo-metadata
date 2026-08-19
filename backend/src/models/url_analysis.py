from sqlalchemy import JSON, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from src.models import Base, TimestampMixin

# Use JSONB on PostgreSQL, JSON on other dialects (e.g. SQLite for tests)
JSONType = JSON().with_variant(JSONB, 'postgresql')


class UrlAnalysis(Base, TimestampMixin):
    __tablename__ = 'url_analyses'

    id = Column(Integer, primary_key=True, index=True)
    ingested_url_id = Column(
        Integer,
        ForeignKey('ingested_urls.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    project_id = Column(
        Integer,
        ForeignKey('projects.id', ondelete='CASCADE'),
        nullable=True,
        index=True,
    )
    seo_score = Column(Integer, nullable=True)
    geo_score = Column(Integer, nullable=True)
    overall_score = Column(Integer, nullable=True)
    analysis = Column(JSONType, nullable=True)
    json_ld = Column(JSONType, nullable=True)
    status = Column(String(50), nullable=False, default='pending')
    error = Column(Text, nullable=True)

    ingested_url = relationship('IngestedUrl', backref='analyses')
    project = relationship('Project', backref='analyses')