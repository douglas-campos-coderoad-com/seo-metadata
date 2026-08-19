from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents import LLMSimulatorAgent
from src.db import get_session
from src.models import IngestedUrl, UrlAnalysis
from src.services.geo_score_service import calculate_geo_citation_score
from src.services.optimizer_service import OptimizerService

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