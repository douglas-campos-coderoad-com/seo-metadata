from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from src.db import get_session
from src.models import UrlAnalysis, IngestedUrl
from src.services.optimizer_service import OptimizerService
from src.services.geo_score_service import calculate_geo_citation_score, calculate_ai_roi
from src.agents import LLMSimulatorAgent

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


class RoiRequest(BaseModel):
    monthly_organic_traffic: int = Field(default=10000, ge=0)
    generative_search_share: float = Field(default=0.10, ge=0.0, le=1.0)
    current_geo_score: int = Field(default=0, ge=0, le=100)
    improved_geo_score: int = Field(default=100, ge=0, le=100)
    products_count: int = Field(default=100, ge=1)
    cost_per_product: float = Field(default=0.03, ge=0.0)
    conversion_rate: float = Field(default=0.02, ge=0.0, le=1.0)
    avg_order_value: float = Field(default=500.0, ge=0.0)


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


@router.post('/aeo-test/{analysis_id}')
async def geo_aeo_test(analysis_id: int, request: SimulateRequest, session: AsyncSession = Depends(get_session)):
    """Run the AEO Live Test: simulate the user query against the original (Before) and optimized (After) content."""
    analysis = await session.get(UrlAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analysis not found')

    ingested = await session.get(IngestedUrl, analysis.ingested_url_id)
    if ingested is None or not ingested.html:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='HTML content not available')

    # Before: use the original page text (from visible text preview if available, else HTML)
    original_content = ingested.html
    if analysis.analysis and isinstance(analysis.analysis, dict):
        original_content = analysis.analysis.get('visible_text_preview', '') or original_content

    # After: use the optimized content from the latest optimization, if present
    optimization = await OptimizerService(session).get_latest_optimization(analysis_id)
    optimized_content = original_content
    if optimization and optimization.optimized_content and isinstance(optimization.optimized_content, dict):
        opt = optimization.optimized_content
        parts = []
        if opt.get('optimized_title'):
            parts.append(opt.get('optimized_title'))
        if opt.get('optimized_meta_description'):
            parts.append(opt.get('optimized_meta_description'))
        if opt.get('geo_content'):
            parts.append(opt.get('geo_content'))
        if opt.get('qa_pairs') and isinstance(opt.get('qa_pairs'), list):
            for qa in opt['qa_pairs']:
                if isinstance(qa, dict):
                    parts.append(f"Q: {qa.get('question', '')}\nA: {qa.get('answer', '')}")
        if parts:
            optimized_content = '\n\n'.join(parts)

    agent = LLMSimulatorAgent()
    before = agent.simulate_live(request.query, original_content)
    after = agent.simulate_live(request.query, optimized_content)

    return {
        'query': request.query,
        'has_optimization': optimization is not None,
        'before': before,
        'after': after,
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


@router.post('/score/{analysis_id}')
async def geo_score(analysis_id: int, session: AsyncSession = Depends(get_session)):
    """Calculate the 0-100 GEO Citation Score for an analysis (using latest optimization if available)."""
    analysis = await session.get(UrlAnalysis, analysis_id)
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Analysis not found')

    optimization = await OptimizerService(session).get_latest_optimization(analysis_id)

    optimized_content = optimization.optimized_content if optimization else None
    optimized_json_ld = optimization.optimized_json_ld if optimization else None

    original_content = ''
    if analysis.analysis and isinstance(analysis.analysis, dict):
        original_content = analysis.analysis.get('visible_text_preview', '') or analysis.analysis.get('geo_content', '')

    result = calculate_geo_citation_score(
        optimized_content=optimized_content,
        optimized_json_ld=optimized_json_ld,
        original_content=original_content or None,
    )
    result['has_optimization'] = optimization is not None
    return result


@router.post('/roi')
async def geo_roi(request: RoiRequest):
    """Calculate the AI financial impact (ROI) for GEO optimization."""
    try:
        result = calculate_ai_roi(
            monthly_organic_traffic=request.monthly_organic_traffic,
            generative_search_share=request.generative_search_share,
            current_geo_score=request.current_geo_score,
            improved_geo_score=request.improved_geo_score,
            products_count=request.products_count,
            cost_per_product=request.cost_per_product,
            conversion_rate=request.conversion_rate,
            avg_order_value=request.avg_order_value,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))