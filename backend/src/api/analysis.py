from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.services.analysis_service import AnalysisService
from src.schemas.analysis import AnalysisResponse

router = APIRouter(prefix='/api/v1', tags=['analysis'])


@router.post('/analyze/{ingested_url_id}', response_model=AnalysisResponse)
async def analyze_url(
    ingested_url_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Run the LangGraph SEO/GEO analysis for a given ingested URL."""
    service = AnalysisService(session)
    try:
        analysis = await service.analyze_url(ingested_url_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Analysis failed: {str(exc)}',
        )

    return AnalysisResponse(
        id=analysis.id,
        ingested_url_id=analysis.ingested_url_id,
        seo_score=analysis.seo_score,
        geo_score=analysis.geo_score,
        overall_score=analysis.overall_score,
        analysis=analysis.analysis,
        json_ld=analysis.json_ld,
        status=analysis.status,
        error=analysis.error,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


@router.get('/analyze/{ingested_url_id}', response_model=AnalysisResponse)
async def get_analysis(
    ingested_url_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve the latest analysis for a given ingested URL."""
    service = AnalysisService(session)
    analysis = await service.get_latest_analysis(ingested_url_id)

    if analysis is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'No analysis found for ingested URL with id {ingested_url_id}',
        )

    return AnalysisResponse(
        id=analysis.id,
        ingested_url_id=analysis.ingested_url_id,
        seo_score=analysis.seo_score,
        geo_score=analysis.geo_score,
        overall_score=analysis.overall_score,
        analysis=analysis.analysis,
        json_ld=analysis.json_ld,
        status=analysis.status,
        error=analysis.error,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
    )


from fastapi.responses import StreamingResponse


@router.get('/analyze/{ingested_url_id}/stream')
async def stream_analysis_progress(
    ingested_url_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Stream real-time Server-Sent Events (SSE) progress during analysis."""
    service = AnalysisService(session)

    async def event_generator():
        async for event in service.stream_analysis_progress(ingested_url_id):
            evt_type = event.get('event', 'message')
            evt_data = event.get('data', '{}')
            yield f'event: {evt_type}\ndata: {evt_data}\n\n'

    return StreamingResponse(
        event_generator(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    )