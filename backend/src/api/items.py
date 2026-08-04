from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.services.item_service import ItemService
from src.schemas.items import ItemListResponseSchema, ItemDetailSchema
from typing import Optional

router = APIRouter(prefix='/api/v1', tags=['items'])


@router.get('/items', response_model=ItemListResponseSchema)
async def list_items(
    category_id: Optional[int] = Query(None),
    period_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
):
    service = ItemService(session)
    items, total = await service.get_items(
        category_id=category_id,
        period_id=period_id,
        skip=skip,
        limit=limit,
    )
    return {
        'items': items,
        'total': total,
        'skip': skip,
        'limit': limit,
    }


@router.get('/items/{item_id}', response_model=ItemDetailSchema)
async def get_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
):
    service = ItemService(session)
    item = await service.get_item_by_id(item_id)

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Item not found',
        )

    return item
