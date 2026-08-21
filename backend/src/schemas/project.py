from datetime import datetime
from typing import List, Literal, Optional

from src.schemas import BaseSchema
from src.schemas.optimization import OptimizationResponse

# FR-011's finalized 21-category-plus-other list.
ProjectCategory = Literal[
    'e-commerce',
    'marketplace',
    'saas',
    'content/blog/media',
    'news/journalism',
    'local business/services',
    'restaurant/food & beverage',
    'real estate',
    'healthcare/medical',
    'legal services',
    'travel/hospitality',
    'education',
    'finance/fintech',
    'nonprofit',
    'agency/professional services',
    'automotive',
    'b2b/manufacturing',
    'entertainment/events',
    'directory/listings',
    'community/forum',
    'government/public sector',
    'other',
]


class CompetitorCreate(BaseSchema):
    url: str
    description: str


class CompetitorResponse(BaseSchema):
    id: int
    project_id: int
    url: str
    description: str
    seo_score: Optional[int] = None
    geo_score: Optional[int] = None
    status: Optional[str] = None
    analyzed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class CompetitorAuditItem(BaseSchema):
    """One competitor's lightweight SEO/GEO audit result."""
    id: int
    url: str
    description: str
    seo_score: int = 0
    geo_score: int = 0
    status: str = 'analyzed'
    analyzed_at: Optional[datetime] = None


class CompetitorAuditResponse(BaseSchema):
    """Response payload for POST /projects/{id}/competitors/analyze."""
    id: int
    competitors: List[CompetitorAuditItem] = []


class ProjectCreate(BaseSchema):
    title: str
    url: Optional[str] = None
    description: str
    category: ProjectCategory
    country: str
    region: Optional[str] = None
    competitors: List[CompetitorCreate] = []


class ProjectUpdate(BaseSchema):
    title: Optional[str] = None
    url: Optional[str] = None
    description: Optional[str] = None
    category: Optional[ProjectCategory] = None
    country: Optional[str] = None
    region: Optional[str] = None
    # None = leave the competitor list untouched; a list (including []) replaces it entirely.
    competitors: Optional[List[CompetitorCreate]] = None


class ProjectResponse(BaseSchema):
    id: int
    title: str
    url: Optional[str] = None
    description: str
    category: str
    country: str
    region: Optional[str] = None
    competitors: List[CompetitorResponse] = []
    created_at: datetime
    updated_at: datetime


class ProjectListResponse(BaseSchema):
    items: List[ProjectResponse]
    total: int


class ProjectAnalysisResponse(BaseSchema):
    id: int
    ingested_url_id: int
    url: str
    seo_score: Optional[int] = None
    geo_score: Optional[int] = None
    overall_score: Optional[int] = None
    analysis: Optional[dict] = None
    json_ld: Optional[dict] = None
    status: str
    created_at: datetime
    updated_at: datetime
    optimization: Optional[OptimizationResponse] = None


class ProjectAnalysisListResponse(BaseSchema):
    items: List[ProjectAnalysisResponse]
    total: int


class AttachAnalysisRequest(BaseSchema):
    analysis_id: int


class SmartSearchRequest(BaseSchema):
    description: str
    category: ProjectCategory
    country: str
    region: Optional[str] = None


class SmartSearchSuggestion(BaseSchema):
    url: str
    description: str


class SmartSearchResponse(BaseSchema):
    suggestions: List[SmartSearchSuggestion]
