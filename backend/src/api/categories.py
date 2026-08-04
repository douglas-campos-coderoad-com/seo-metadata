from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.services.category_service import CategoryService
from src.schemas.categories import CategorySchema
from typing import List

router = APIRouter(prefix='/api/v1', tags=['categories'])


@router.get('/categories', response_model=List[CategorySchema])
async def list_categories(session: AsyncSession = Depends(get_session)):
    service = CategoryService(session)
    return await service.list_categories()
