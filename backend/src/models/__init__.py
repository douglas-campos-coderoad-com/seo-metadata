from sqlalchemy.orm import declarative_base
from sqlalchemy import Column, DateTime, func
from datetime import datetime

Base = declarative_base()


class TimestampMixin:
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


from src.models.ingested_url import IngestedUrl  # noqa: E402
from src.models.url_analysis import UrlAnalysis  # noqa: E402
from src.models.url_optimization import UrlOptimization  # noqa: E402

__all__ = ['Base', 'TimestampMixin', 'IngestedUrl', 'UrlAnalysis', 'UrlOptimization']
