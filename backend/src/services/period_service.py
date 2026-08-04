from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.models.period import Period
from src.schemas.periods import PeriodSchema
from typing import List, Optional


class PeriodService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_periods(self) -> List[PeriodSchema]:
        query = select(Period)
        result = await self.session.execute(query)
        periods = result.scalars().all()

        return [
            PeriodSchema(
                id=period.id,
                name=period.name,
                start_year=period.start_year,
                end_year=period.end_year,
                created_at=period.created_at,
                updated_at=period.updated_at,
            )
            for period in periods
        ]

    async def get_period(self, period_id: int) -> Optional[PeriodSchema]:
        query = select(Period).where(Period.id == period_id)
        result = await self.session.execute(query)
        period = result.scalar_one_or_none()

        if not period:
            return None

        return PeriodSchema(
            id=period.id,
            name=period.name,
            start_year=period.start_year,
            end_year=period.end_year,
            created_at=period.created_at,
            updated_at=period.updated_at,
        )
