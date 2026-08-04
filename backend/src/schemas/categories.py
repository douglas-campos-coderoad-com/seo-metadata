from src.schemas import BaseSchema, TimestampSchema
from datetime import datetime
from typing import Optional


class CategorySchema(TimestampSchema):
    id: int
    name: str
    description: Optional[str] = None


class CategoryCreateSchema(BaseSchema):
    name: str
    description: Optional[str] = None
