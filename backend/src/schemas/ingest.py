from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional, List
from urllib.parse import urlparse

from src.schemas import BaseSchema


class IngestUrlRequest(BaseModel):
    url: str = Field(..., description='URL to ingest')

    @field_validator('url')
    @classmethod
    def validate_url(cls, value: str) -> str:
        parsed = urlparse(value)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ValueError('Invalid URL format. Must be a valid http/https URL.')
        return value


class IngestUrlResponse(BaseSchema):
    id: int
    url: str
    status: str
    html_size_bytes: Optional[int] = None
    http_status: Optional[int] = None
    content_type: Optional[str] = None
    created_at: datetime


class IngestUrlDetailResponse(IngestUrlResponse):
    html: Optional[str] = None
    error: Optional[str] = None
    updated_at: datetime


class IngestUrlListResponse(BaseSchema):
    items: List[IngestUrlResponse]
    total: int