import logging
from typing import Optional

from langgraph.graph import StateGraph, END
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import IngestedUrl, UrlAnalysis
from src.services.graph_nodes import (
    parse_html,
    analyze_seo_geo,
    generate_json_ld,
    compile_report,
    _error_finding,
)

logger = logging.getLogger(__name__)


class AnalysisService:
    """Orchestrates the LangGraph SEO/GEO analysis pipeline."""

    def __init__(self, session: AsyncSession):
        self.session = session

    def _build_graph(self) -> dict:
        """
        Build the LangGraph state machine with the 4 nodes.

        Returns a compiled graph.
        """
        from langgraph.graph import StateGraph

        # Define the graph state schema
        from typing import TypedDict, Any, Optional

        class AnalysisState(TypedDict, total=False):
            html: str
            url: str
            page_data: dict
            parse_error: Optional[str]
            seo_score: int
            geo_score: int
            findings: list
            geo_visibility: str
            seo_breakdown: dict
            geo_breakdown: dict
            seo_geo_error: Optional[str]
            json_ld: Optional[dict]
            json_ld_error: Optional[str]
            overall_score: int
            analysis: dict
            status: str
            error: Optional[str]

        # Create state graph
        workflow = StateGraph(AnalysisState)

        # Add nodes
        workflow.add_node('parse_html', parse_html)
        workflow.add_node('analyze_seo_geo', analyze_seo_geo)
        workflow.add_node('generate_json_ld', generate_json_ld)
        workflow.add_node('compile_report', compile_report)

        # Connect nodes sequentially
        workflow.set_entry_point('parse_html')
        workflow.add_edge('parse_html', 'analyze_seo_geo')
        workflow.add_edge('analyze_seo_geo', 'generate_json_ld')
        workflow.add_edge('generate_json_ld', 'compile_report')
        workflow.add_edge('compile_report', END)

        # Compile
        return workflow.compile()

    def _analyze_sync(self, html: str, url: str) -> dict:
        """Run the graph synchronously (LangGraph's invocation is sync)."""
        compiled = self._build_graph()

        initial_state = {
            'html': html,
            'url': url,
        }

        try:
            result = compiled.invoke(initial_state)
            return result
        except Exception as exc:
            logger.error(f'Analysis graph failed: {exc}')
            return {
                'seo_score': 0,
                'geo_score': 0,
                'overall_score': 0,
                'analysis': {
                    'findings': [_error_finding(str(exc))],
                    'geo_visibility': '',
                    'seo_breakdown': {},
                    'geo_breakdown': {},
                    'errors': [str(exc)],
                },
                'json_ld': None,
                'status': 'failed',
                'error': str(exc),
            }

    async def analyze_url(self, ingested_url_id: int) -> UrlAnalysis:
        """
        Fetch the ingested URL's HTML, run the LangGraph analysis, and persist results.
        """
        # 1. Fetch the ingested URL record
        ingested = await self.session.get(IngestedUrl, ingested_url_id)
        if ingested is None:
            raise ValueError(f'Ingested URL with id {ingested_url_id} not found')

        if not ingested.html:
            raise ValueError(f'Ingested URL with id {ingested_url_id} has no HTML content')

        # 2. Create pending analysis record
        analysis = UrlAnalysis(
            ingested_url_id=ingested_url_id,
            status='running',
            seo_score=None,
            geo_score=None,
            overall_score=None,
            analysis=None,
            json_ld=None,
            error=None,
        )
        self.session.add(analysis)
        await self.session.commit()

        # 3. Run the LangGraph analysis (sync call in executor to avoid blocking)
        #    Note: The graph is synchronous since LangGraph invoke is sync.
        result = await self._run_analysis_in_executor(ingested.html, ingested.url)

        # 4. Update the analysis record with results
        analysis.seo_score = result.get('seo_score')
        analysis.geo_score = result.get('geo_score')
        analysis.overall_score = result.get('overall_score')
        analysis.analysis = result.get('analysis')
        analysis.json_ld = result.get('json_ld')
        analysis.status = result.get('status', 'failed')
        analysis.error = result.get('error')

        await self.session.commit()
        await self.session.refresh(analysis)
        return analysis

    async def _run_analysis_in_executor(self, html: str, url: str) -> dict:
        """Run the (blocking) LangGraph analysis in a thread executor."""
        import asyncio
        loop = asyncio.get_running_loop()
        result = await loop.run_in_executor(None, self._analyze_sync, html, url)
        return result

    async def get_latest_analysis(self, ingested_url_id: int) -> Optional[UrlAnalysis]:
        """Retrieve the latest analysis for a given ingested URL."""
        result = await self.session.execute(
            select(UrlAnalysis)
            .where(UrlAnalysis.ingested_url_id == ingested_url_id)
            .order_by(UrlAnalysis.created_at.desc(), UrlAnalysis.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()