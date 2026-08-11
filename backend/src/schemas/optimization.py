from datetime import datetime
from typing import Any, Optional

from src.schemas import BaseSchema


class OptimizationResponse(BaseSchema):
    id: int
    analysis_id: int
    optimized_html: Optional[str] = None
    optimized_json_ld: Optional[Any] = None
    optimized_content: Optional[Any] = None
    changes: Optional[Any] = None
    score_before: Optional[Any] = None
    score_after_estimated: Optional[Any] = None
    status: str
    error: Optional[str] = None
    created_at: datetime
    updated_at: datetime