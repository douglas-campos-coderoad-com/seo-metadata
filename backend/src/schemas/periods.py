from src.schemas import BaseSchema, TimestampSchema


class PeriodSchema(TimestampSchema):
    id: int
    name: str
    start_year: int
    end_year: int


class PeriodCreateSchema(BaseSchema):
    name: str
    start_year: int
    end_year: int
