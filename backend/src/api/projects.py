from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from src.agents.competitor_audit_agent import run_audit
from src.db import get_session
from src.models import UrlAnalysis
from src.schemas.project import (
    AttachAnalysisRequest,
    CompetitorAuditItem,
    CompetitorAuditResponse,
    ProjectAnalysisListResponse,
    ProjectAnalysisResponse,
    ProjectCreate,
    ProjectListResponse,
    ProjectResponse,
    ProjectUpdate,
    SmartSearchRequest,
    SmartSearchResponse,
)
from src.services.project_service import ProjectService
from src.schemas.optimization import OptimizationResponse

router = APIRouter(prefix='/api/v1', tags=['projects'])


def _to_project_analysis_response(analysis: UrlAnalysis) -> ProjectAnalysisResponse:
    """Shapes a UrlAnalysis (with `ingested_url`/`optimizations` eager-loaded) into the
    contract's before/after shape — reused by every endpoint that returns analysis
    history entries (contracts/projects-api.md)."""
    optimization = analysis.optimizations[0] if analysis.optimizations else None

    return ProjectAnalysisResponse(
        id=analysis.id,
        ingested_url_id=analysis.ingested_url_id,
        url=analysis.ingested_url.url,
        seo_score=analysis.seo_score,
        geo_score=analysis.geo_score,
        overall_score=analysis.overall_score,
        analysis=analysis.analysis,
        json_ld=analysis.json_ld,
        status=analysis.status,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at,
        optimization=OptimizationResponse(
            id=optimization.id,
            analysis_id=optimization.analysis_id,
            optimized_html=optimization.optimized_html,
            optimized_json_ld=optimization.optimized_json_ld,
            optimized_content=optimization.optimized_content,
            changes=optimization.changes,
            copy_paste_ready=optimization.copy_paste_ready,
            score_before=optimization.score_before,
            score_after_estimated=optimization.score_after_estimated,
            strategic_impacts=optimization.strategic_impacts,
            roi_projection=None,  # computed on demand by GET /optimize/{id}, not recomputed here
            status=optimization.status,
            error=optimization.error,
            created_at=optimization.created_at,
            updated_at=optimization.updated_at,
        )
        if optimization
        else None,
    )


@router.post('/projects', response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    session: AsyncSession = Depends(get_session),
):
    """Create a project, optionally with an initial competitor list."""
    service = ProjectService(session)
    project = await service.create(payload)
    return project


@router.get('/projects', response_model=ProjectListResponse)
async def list_projects(
    session: AsyncSession = Depends(get_session),
):
    """List all projects."""
    service = ProjectService(session)
    projects = await service.list()
    return ProjectListResponse(items=projects, total=len(projects))


@router.get('/projects/{project_id}', response_model=ProjectResponse)
async def get_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    service = ProjectService(session)
    try:
        return await service.get(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.patch('/projects/{project_id}', response_model=ProjectResponse)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    session: AsyncSession = Depends(get_session),
):
    """Edit a project's metadata and/or replace its competitor list (FR-014). If
    `competitors` is present it replaces the entire list, not a merge."""
    service = ProjectService(session)
    try:
        return await service.update(project_id, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete('/projects/{project_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Permanently delete a project along with its competitors and analyses (FR-015).
    The frontend is responsible for confirming with the user before calling this."""
    service = ProjectService(session)
    try:
        await service.delete(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.delete('/projects/{project_id}/analyses/{analysis_id}', status_code=status.HTTP_204_NO_CONTENT)
async def remove_analysis(
    project_id: int,
    analysis_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Remove an analysis from a project — permanently deletes the record (FR-016),
    not a detach-to-null."""
    service = ProjectService(session)
    try:
        await service.remove_analysis(project_id, analysis_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


@router.get('/projects/{project_id}/analyses/{analysis_id}', response_model=ProjectAnalysisResponse)
async def get_project_analysis(
    project_id: int,
    analysis_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Single historical analysis within a project (specs/009-project-analysis-ux User
    Story 2) — the same shape a list-endpoint item already returns, ownership-checked."""
    service = ProjectService(session)
    try:
        analysis = await service.get_analysis(project_id, analysis_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return _to_project_analysis_response(analysis)


@router.post('/projects/competitors/smart-search', response_model=SmartSearchResponse)
async def smart_search_competitors(
    payload: SmartSearchRequest,
    session: AsyncSession = Depends(get_session),
):
    """Propose competitor entries from project context (FR-007). Not nested under an
    existing project id — this must work while a project is still being created,
    before it has one (contracts/projects-api.md)."""
    service = ProjectService(session)
    suggestions = await service.smart_search_competitors(
        description=payload.description,
        category=payload.category,
        country=payload.country,
        region=payload.region,
    )
    return SmartSearchResponse(suggestions=suggestions)


@router.post('/projects/{project_id}/analyses', response_model=ProjectAnalysisResponse)
async def attach_analysis(
    project_id: int,
    payload: AttachAnalysisRequest,
    session: AsyncSession = Depends(get_session),
):
    """Attach an existing analysis to this project, or reassign it here from another
    project — the same operation either way (contracts/projects-api.md)."""
    service = ProjectService(session)
    try:
        analysis = await service.attach_analysis(project_id, payload.analysis_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return _to_project_analysis_response(analysis)


@router.get('/projects/{project_id}/analyses', response_model=ProjectAnalysisListResponse)
async def list_project_analyses(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """A project's analysis history, chronological, each with its persisted
    before/after results (FR-004, FR-008)."""
    service = ProjectService(session)
    try:
        analyses = await service.list_analyses(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    items = [_to_project_analysis_response(a) for a in analyses]
    return ProjectAnalysisListResponse(items=items, total=len(items))


@router.post('/projects/{project_id}/competitors/audit', response_model=CompetitorAuditResponse)
async def audit_competitors(
    project_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Run a lightweight SEO & GEO audit on all competitors of a project.
    
    Fetches each competitor URL concurrently, extracts HTML signals via BeautifulSoup,
    scores them with Gemini through the LLM repository, and persistently saves
    seo_score, geo_score, status and analyzed_at back to the database.
    """
    try:
        results = await run_audit(project_id=project_id, session=session)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    audit_items = []
    for r in results:
        audit_items.append(
            CompetitorAuditItem(
                id=r.id,
                url=r.url,
                description=r.description,
                seo_score=r.seo_score,
                geo_score=r.geo_score,
                status=r.status,
                analyzed_at=r.analyzed_at,
            )
        )

    return CompetitorAuditResponse(id=project_id, competitors=audit_items)
