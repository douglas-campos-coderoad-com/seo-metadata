from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.services.optimizer_service import OptimizerService
from src.schemas.optimization import OptimizationResponse

router = APIRouter(prefix='/api/v1', tags=['optimization'])


@router.post('/optimize/{analysis_id}', response_model=OptimizationResponse)
async def optimize_analysis(
    analysis_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Run the LangGraph SEO/GEO/AEO optimizer for a given analysis."""
    service = OptimizerService(session)
    try:
        optimization = await service.optimize_analysis(analysis_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f'Optimization failed: {str(exc)}',
        )

    return OptimizationResponse(
        id=optimization.id,
        analysis_id=optimization.analysis_id,
        optimized_html=optimization.optimized_html,
        optimized_json_ld=optimization.optimized_json_ld,
        optimized_content=optimization.optimized_content,
        changes=optimization.changes,
        copy_paste_ready=optimization.copy_paste_ready,
        score_before=optimization.score_before,
        score_after_estimated=optimization.score_after_estimated,
        status=optimization.status,
        error=optimization.error,
        created_at=optimization.created_at,
        updated_at=optimization.updated_at,
    )


@router.get('/optimize/{analysis_id}', response_model=OptimizationResponse)
async def get_optimization(
    analysis_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Retrieve the latest optimization for a given analysis."""
    service = OptimizerService(session)
    optimization = await service.get_latest_optimization(analysis_id)

    if optimization is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f'No optimization found for analysis with id {analysis_id}',
        )

    return OptimizationResponse(
        id=optimization.id,
        analysis_id=optimization.analysis_id,
        optimized_html=optimization.optimized_html,
        optimized_json_ld=optimization.optimized_json_ld,
        optimized_content=optimization.optimized_content,
        changes=optimization.changes,
        copy_paste_ready=optimization.copy_paste_ready,
        score_before=optimization.score_before,
        score_after_estimated=optimization.score_after_estimated,
        status=optimization.status,
        error=optimization.error,
        created_at=optimization.created_at,
        updated_at=optimization.updated_at,
    )
