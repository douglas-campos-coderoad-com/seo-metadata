from sqlalchemy.orm import declarative_base, configure_mappers
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


from src.models.project import Project  # noqa: E402
from src.models.competitor import Competitor  # noqa: E402
from src.models.ingested_url import IngestedUrl  # noqa: E402
from src.models.url_analysis import UrlAnalysis  # noqa: E402
from src.models.url_optimization import UrlOptimization  # noqa: E402

__all__ = [
    'Base',
    'TimestampMixin',
    'Project',
    'Competitor',
    'IngestedUrl',
    'UrlAnalysis',
    'UrlOptimization',
]

# Backref-created attributes (e.g. Project.competitors, Project.analyses) aren't
# installed onto their target class until mapper configuration runs — normally
# triggered lazily by the first query. Forcing it here, right after every model is
# imported, means any code path that touches a backref attribute before running its
# own first query (e.g. building a selectinload() option) sees it correctly instead
# of hitting "type object 'X' has no attribute 'y'".
configure_mappers()
