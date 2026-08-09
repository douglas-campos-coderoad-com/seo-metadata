from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.models import IngestedUrl
from src.services.ingest_service import IngestService
from src.schemas.ingest import (
    IngestUrlDetailResponse,
    IngestUrlListResponse,
    IngestUrlRequest,
    IngestUrlResponse,
)

router = APIRouter(prefix='/api/v1', tags=['ingest'])


def _to_response(record: IngestedUrl) -> IngestUrlResponse:
    return IngestUrlResponse(
        id=record.id,
        url=record.url,
        status=record.status,
        html_size_bytes=(
            len(record.html.encode('utf-8')) if record.html else None
        ),
        http_status=record.http_status,
        content_type=record.content_type,
        created_at=record.created_at,
    )


@router.post('/ingest/url', response_model=IngestUrlResponse)
async def ingest_url(
    request: IngestUrlRequest,
    session: AsyncSession = Depends(get_session),
):
    service = IngestService(session)
    try:
        record = await service.ingest_url(request.url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    if record.status == 'failed':
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Failed to ingest URL: {record.error}',
        )

    return _to_response(record)


@router.get('/ingest/url/{url_id}', response_model=IngestUrlDetailResponse)
async def get_ingested_url(
    url_id: int,
    session: AsyncSession = Depends(get_session),
):
    record = await session.get(IngestedUrl, url_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'Ingested URL with id {url_id} not found',
        )

    return IngestUrlDetailResponse(
        id=record.id,
        url=record.url,
        status=record.status,
        html_size_bytes=(
            len(record.html.encode('utf-8')) if record.html else None
        ),
        http_status=record.http_status,
        content_type=record.content_type,
        created_at=record.created_at,
        updated_at=record.updated_at,
        html=record.html,
        error=record.error,
    )


@router.get('/ingest/urls', response_model=IngestUrlListResponse)
async def list_ingested_urls(
    skip: int = 0,
    limit: int = 100,
    session: AsyncSession = Depends(get_session),
):
    if skip < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='skip must be >= 0',
        )
    if limit < 1 or limit > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='limit must be between 1 and 500',
        )

    # Count total
    total_result = await session.execute(select(func.count()).select_from(IngestedUrl))
    total = total_result.scalar() or 0

    # Fetch items ordered by most recent first
    result = await session.execute(
        select(IngestedUrl)
        .order_by(IngestedUrl.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    records = result.scalars().all()

    return IngestUrlListResponse(
        items=[_to_response(record) for record in records],
        total=total,
    )