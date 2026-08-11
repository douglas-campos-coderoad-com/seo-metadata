from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.models import UrlAnalysis, IngestedUrl
from src.services.optimizer_service import OptimizerService
from src.agents import EntityAgent, GEOContentAgent, LLMSimulatorAgent

router = APIRouter(prefix='/api/v1/geo', tags=['geo'])


class SimulateRequest(BaseModel):
    query: str


class SimulateResponse(BaseModel):
    cited: bool
    confidence: float
    quote: str | None
    response_snippet: str
    reason: str
    query: str


@router.post('/optimize/{analysis_id}')
async def geo_optimize(analysis_id: int, session: AsyncSession = Depends(get_session)):
    """Run the GEO/AEO agent suite: entity + content optimization."""
    service = OptimizerService(session)
    try:
        optimization = await service.optimize_analysis(analysis_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f'GEO optimization failed: {exc}')

    return {
        'analysis_id': optimization.analysis_id,
        'optimized_html': optimization.optimized_html,
        'optimized_json_ld': optimization.optimized_json_ld,
        'optimized_content': optimization.optimized_content,
        'changes': optimization.changes,
        'score_before': optimization.score_before,
        'score_after_estimated': optimization.score_after_estimated,
        'status': optimization.status,
        'error': optimization.error,
    }


@router.post('/simulate/{analysis_id}', response_model=SimulateResponse)
async def geo_simulate(analysis_id: int, request: SimulateRequest, session: AsyncSession = Depends(get_session)):
    """Simulate a user query against the page content to check LLM citability."""
    analysis = await session.get(UrlAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analysis not found')

    ingested = await session.get(IngestedUrl, analysis.ingested_url_id)
    if ingested is None or not ingested.html:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='HTML content not available')

    content = ingested.html
    if analysis.analysis and isinstance(analysis.analysis, dict):
        content = analysis.analysis.get('content', content)

    agent = LLMSimulatorAgent()
    result = agent.simulate(request.query, content)
    return SimulateResponse(**result)