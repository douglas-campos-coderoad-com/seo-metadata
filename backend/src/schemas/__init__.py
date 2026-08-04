from pydantic import BaseModel
from typing import Generic, TypeVar, List, Optional
from datetime import datetime

T = TypeVar('T')


class BaseSchema(BaseModel):
    model_config = {'from_attributes': True}


class PaginatedResponse(BaseSchema, Generic[T]):
    items: List[T]
    total: int
    skip: int
    limit: int

    @property
    def pages(self) -> int:
        return (self.total + self.limit - 1) // self.limit


class TimestampSchema(BaseSchema):
    created_at: datetime
    updated_at: datetime


__all__ = ['BaseSchema', 'PaginatedResponse', 'TimestampSchema']
