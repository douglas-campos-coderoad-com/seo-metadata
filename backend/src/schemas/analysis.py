from enum import Enum
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Any
from src.schemas import BaseSchema


class FindingSeverity(str, Enum):
    good = 'good'
    warning = 'warning'
    critical = 'critical'


class FindingCategory(str, Enum):
    meta_tags = 'meta-tags'
    content = 'content'
    html_structure = 'html-structure'
    file_size = 'file-size'


class FindingItem(BaseModel):
    severity: FindingSeverity
    category: FindingCategory
    title: str
    description: str
    suggestion: str = ''
    is_missing: bool = False
    metric_value: Optional[str] = None
    code_snippet: Optional[str] = None


class AnalysisPayload(BaseModel):
    findings: List[FindingItem] = Field(default_factory=list)
    geo_visibility: str = ''
    seo_breakdown: dict = Field(default_factory=dict)
    geo_breakdown: dict = Field(default_factory=dict)
    errors: List[str] = Field(default_factory=list)


class AnalysisResponse(BaseSchema):
    id: int
    ingested_url_id: int
    seo_score: Optional[int] = None
    geo_score: Optional[int] = None
    overall_score: Optional[int] = None
    analysis: Optional[AnalysisPayload] = None
    json_ld: Optional[Any] = None
    status: str
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AnalysisListResponse(BaseSchema):
    items: List[AnalysisResponse]
    total: int