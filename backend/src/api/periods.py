from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.services.period_service import PeriodService
from src.schemas.periods import PeriodSchema
from typing import List

router = APIRouter(prefix='/api/v1', tags=['periods'])


@router.get('/periods', response_model=List[PeriodSchema])
async def list_periods(session: AsyncSession = Depends(get_session)):
    service = PeriodService(session)
    return await service.list_periods()
