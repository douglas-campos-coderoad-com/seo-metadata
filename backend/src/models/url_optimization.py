from sqlalchemy import JSON, Column, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from src.models import Base, TimestampMixin

# Use JSONB on PostgreSQL, JSON on other dialects (e.g. SQLite for tests)
JSONType = JSON().with_variant(JSONB, 'postgresql')


class UrlOptimization(Base, TimestampMixin):
    __tablename__ = 'url_optimizations'

    id = Column(Integer, primary_key=True, index=True)
    analysis_id = Column(
        Integer,
        ForeignKey('url_analyses.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    optimized_html = Column(Text, nullable=True)
    optimized_json_ld = Column(JSONType, nullable=True)
    optimized_content = Column(JSONType, nullable=True)
    changes = Column(JSONType, nullable=True)
    copy_paste_ready = Column(JSONType, nullable=True)
    score_before = Column(JSONType, nullable=True)
    score_after_estimated = Column(JSONType, nullable=True)
    status = Column(String(50), nullable=False, default='pending')
    error = Column(Text, nullable=True)

    analysis = relationship('UrlAnalysis', backref='optimizations')