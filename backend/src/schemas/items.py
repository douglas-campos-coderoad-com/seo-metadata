from src.schemas import BaseSchema, TimestampSchema, PaginatedResponse
from typing import Optional, List
from datetime import datetime


class DealerInfoSchema(BaseSchema):
    id: int
    name: str
    inquiries_enabled: bool


class CategoryInfoSchema(BaseSchema):
    id: int
    name: str


class PeriodInfoSchema(BaseSchema):
    id: int
    name: str


class ItemListSchema(TimestampSchema):
    id: int
    title: str
    category: CategoryInfoSchema
    period: PeriodInfoSchema
    dealer: DealerInfoSchema
    image_urls: List[str]
    status: str


class ItemDetailSchema(TimestampSchema):
    id: int
    title: str
    description: Optional[str]
    category: CategoryInfoSchema
    period: PeriodInfoSchema
    dealer: DealerInfoSchema
    image_urls: List[str]
    condition: Optional[str]
    asking_price: Optional[float]
    status: str


class ItemListResponseSchema(BaseSchema):
    items: List[ItemListSchema]
    total: int
    skip: int
    limit: int


class ItemCreateSchema(BaseSchema):
    title: str
    description: Optional[str] = None
    category_id: int
    period_id: int
    dealer_id: int
    image_urls: List[str] = []
    condition: Optional[str] = None
    asking_price: Optional[float] = None
    status: str = 'available'


class ItemFilterQuerySchema(BaseSchema):
    category_id: Optional[int] = None
    period_id: Optional[int] = None
    skip: int = 0
    limit: int = 20
    status: str = 'available'
