from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any
from src.schemas import BaseSchema


class AnalysisResponse(BaseSchema):
    id: int
    ingested_url_id: int
    seo_score: Optional[int] = None
    geo_score: Optional[int] = None
    overall_score: Optional[int] = None
    analysis: Optional[Any] = None
    json_ld: Optional[Any] = None
    status: str
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AnalysisListResponse(BaseSchema):
    items: List[AnalysisResponse]
    total: int