import logging
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import IngestedUrl, UrlAnalysis, UrlOptimization
from src.services.optimizer_nodes import (
    read_analysis,
    search_web_node,
    plan_changes,
    apply_changes,
    compile_optimization,
)

logger = logging.getLogger(__name__)


class OptimizerService:
    """Orchestrates the LangGraph SEO/GEO/AEO optimizer pipeline."""

    def __init__(self, session: AsyncSession):
        self.session = session

    def _build_graph(self) -> dict:
        """Build the LangGraph state machine with the 5 optimizer nodes."""
        from langgraph.graph import StateGraph, END
        from typing import TypedDict, Optional, Any

        class OptimizationState(TypedDict, total=False):
            html: str
            url: str
            analysis: dict
            search_context: str
            search_error: Optional[str]
            plan: list
            estimated_scores: dict
            plan_error: Optional[str]
            optimized_html: str
            optimized_json_ld: Optional[dict]
            optimized_content: dict
            changes_applied: list
            copy_paste_ready: dict
            apply_error: Optional[str]
            read_error: Optional[str]
            changes: list
            score_before: dict
            score_after_estimated: dict
            status: str
            error: Optional[str]

        workflow = StateGraph(OptimizationState)

        workflow.add_node('read_analysis', read_analysis)
        workflow.add_node('search_web', search_web_node)
        workflow.add_node('plan_changes', plan_changes)
        workflow.add_node('apply_changes', apply_changes)
        workflow.add_node('compile_optimization', compile_optimization)

        workflow.set_entry_point('read_analysis')
        workflow.add_edge('read_analysis', 'search_web')
        workflow.add_edge('search_web', 'plan_changes')
        workflow.add_edge('plan_changes', 'apply_changes')
        workflow.add_edge('apply_changes', 'compile_optimization')
        workflow.add_edge('compile_optimization', END)

        return workflow.compile()

    def _optimize_sync(self, analysis: dict, html: str, url: str) -> dict:
        """Run the optimizer graph synchronously."""
        compiled = self._build_graph()

        initial_state = {
            'html': html,
            'url': url,
            'analysis': analysis,
        }

        try:
            result = compiled.invoke(initial_state)
            return result
        except Exception as exc:
            logger.error(f'Optimizer graph failed: {exc}')
            return {
                'optimized_html': '',
                'optimized_json_ld': None,
                'optimized_content': {},
                'changes': [],
                'score_before': {'seo': 0, 'geo': 0, 'overall': 0},
                'score_after_estimated': {'seo': 0, 'geo': 0, 'overall': 0},
                'status': 'failed',
                'error': str(exc),
            }

    async def _run_optimization_in_executor(self, analysis: dict, html: str, url: str) -> dict:
        """Run the (blocking) optimizer graph in a thread executor."""
        import asyncio
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._optimize_sync, analysis, html, url)

    def _build_analysis_dict(self, analysis: UrlAnalysis) -> dict:
        """Convert UrlAnalysis model to dict for the graph."""
        return {
            'seo_score': analysis.seo_score,
            'geo_score': analysis.geo_score,
            'overall_score': analysis.overall_score,
            'findings': (analysis.analysis or {}).get('findings', []) if analysis.analysis else [],
            'recommendations': (analysis.analysis or {}).get('recommendations', []) if analysis.analysis else [],
            'geo_visibility': (analysis.analysis or {}).get('geo_visibility', '') if analysis.analysis else '',
            'json_ld': analysis.json_ld,
            'scores': {
                'seo': analysis.seo_score or 0,
                'geo': analysis.geo_score or 0,
                'overall': analysis.overall_score or 0,
            },
        }

    async def optimize_analysis(self, analysis_id: int) -> UrlOptimization:
        """Load the analysis + HTML, run the optimizer graph, and persist results."""
        # 1. Fetch the analysis
        analysis = await self.session.get(UrlAnalysis, analysis_id)
        if analysis is None:
            raise ValueError(f'Analysis with id {analysis_id} not found')

        if analysis.status != 'completed':
            raise ValueError(f'Cannot optimize analysis with status {analysis.status}')

        # 2. Fetch the ingested URL to get HTML
        ingested = await self.session.get(IngestedUrl, analysis.ingested_url_id)
        if ingested is None or not ingested.html:
            raise ValueError('Cannot optimize: original HTML not available')

        # 3. Create pending optimization record
        optimization = UrlOptimization(
            analysis_id=analysis_id,
            status='running',
            optimized_html=None,
            optimized_json_ld=None,
            optimized_content=None,
            changes=None,
            copy_paste_ready=None,
            score_before=None,
            score_after_estimated=None,
            error=None,
        )
        self.session.add(optimization)
        await self.session.commit()

        # 4. Build analysis dict and run the graph
        analysis_dict = self._build_analysis_dict(analysis)
        result = await self._run_optimization_in_executor(
            analysis_dict, ingested.html, ingested.url
        )

        # 5. Update the optimization record with results
        optimization.optimized_html = result.get('optimized_html')
        optimization.optimized_json_ld = result.get('optimized_json_ld')
        optimization.optimized_content = result.get('optimized_content')
        optimization.changes = result.get('changes')
        optimization.copy_paste_ready = result.get('copy_paste_ready')
        optimization.score_before = result.get('score_before')
        optimization.score_after_estimated = result.get('score_after_estimated')
        optimization.status = result.get('status', 'failed')
        optimization.error = result.get('error')

        await self.session.commit()
        await self.session.refresh(optimization)
        return optimization

    async def get_latest_optimization(self, analysis_id: int) -> Optional[UrlOptimization]:
        """Retrieve the latest optimization for a given analysis."""
        result = await self.session.execute(
            select(UrlOptimization)
            .where(UrlOptimization.analysis_id == analysis_id)
            .order_by(UrlOptimization.created_at.desc(), UrlOptimization.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()