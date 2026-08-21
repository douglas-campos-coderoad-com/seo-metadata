"""Strategic impacts: the business-level outcomes attached to an optimization.

Covers the normalization boundary specifically, because the shape comes straight
from an LLM and is the part most likely to drift.
"""
from unittest.mock import patch

import pytest

from src.models import Competitor, IngestedUrl, Project, UrlAnalysis
from src.services.optimizer_nodes import (
    _format_project_context,
    _normalize_strategic_impacts,
    compile_optimization,
    plan_changes,
)
from src.services.optimizer_service import OptimizerService


PROJECT = {
    'title': 'CodeRoad',
    'description': 'Nearshore engineering',
    'category': 'marketplace',
    'country': 'United States',
    'region': None,
    'competitors': [
        {'name': 'https://www.toptal.com', 'description': 'freelance network'},
        {'name': 'https://www.epam.com', 'description': 'enterprise dev'},
    ],
}


class TestNormalizeStrategicImpacts:
    def test_keeps_well_formed_entries(self):
        raw = [
            {
                'impact': 'Increase organic traffic 30-70%',
                'detail': 'Structured data lifts eligibility for rich results.',
                'competitors': [],
            }
        ]
        assert _normalize_strategic_impacts(raw, []) == [
            {
                'impact': 'Increase organic traffic 30-70%',
                'detail': 'Structured data lifts eligibility for rich results.',
                'competitors': [],
            }
        ]

    def test_accepts_bare_strings(self):
        """The most common way the shape drifts — a plain list of sentences."""
        result = _normalize_strategic_impacts(['Reduce reliance on paid ads'], [])

        assert result == [{'impact': 'Reduce reliance on paid ads', 'detail': None, 'competitors': []}]

    def test_keeps_only_competitors_the_project_actually_has(self):
        raw = [
            {
                'impact': 'Strengthen positioning',
                'detail': None,
                'competitors': ['https://www.toptal.com', 'https://www.invented-rival.com'],
            }
        ]

        result = _normalize_strategic_impacts(raw, ['https://www.toptal.com', 'https://www.epam.com'])

        # The hallucinated rival is dropped rather than shown to the user.
        assert result[0]['competitors'] == ['https://www.toptal.com']

    def test_matches_competitor_names_case_insensitively(self):
        raw = [{'impact': 'Win head to head', 'competitors': ['HTTPS://WWW.TOPTAL.COM']}]

        result = _normalize_strategic_impacts(raw, ['https://www.toptal.com'])

        # Normalized back to the project's own spelling, not the model's.
        assert result[0]['competitors'] == ['https://www.toptal.com']

    def test_caps_at_five_entries(self):
        raw = [{'impact': f'Impact {i}'} for i in range(9)]

        assert len(_normalize_strategic_impacts(raw, [])) == 5

    def test_drops_entries_with_no_text(self):
        raw = [{'impact': '   ', 'competitors': []}, {'impact': 'Real one'}, 42, None]

        result = _normalize_strategic_impacts(raw, [])

        assert [entry['impact'] for entry in result] == ['Real one']

    def test_returns_empty_for_a_non_list(self):
        for value in (None, {}, 'nope', 7):
            assert _normalize_strategic_impacts(value, []) == []


class TestProjectContext:
    def test_lists_competitors_for_the_prompt(self):
        rendered = _format_project_context(PROJECT)

        assert 'CodeRoad' in rendered
        assert 'https://www.toptal.com: freelance network' in rendered
        assert 'https://www.epam.com' in rendered

    def test_says_so_when_no_project_is_attached(self):
        rendered = _format_project_context(None)

        assert 'No project attached' in rendered

    def test_says_so_when_the_project_has_no_competitors(self):
        rendered = _format_project_context({**PROJECT, 'competitors': []})

        assert 'none recorded' in rendered


class TestPlanChangesIntegration:
    def _state(self):
        return {
            'analysis': {'scores': {'seo': 50, 'geo': 40, 'overall': 45}, 'findings': [], 'recommendations': []},
            'html': '<html><head><title>t</title></head><body>x</body></html>',
            'url': 'https://coderoad.com',
            'search_context': '',
            'project': PROJECT,
        }

    def test_passes_competitors_into_the_prompt_and_returns_impacts(self):
        llm_response = {
            'plan': [],
            'estimated_scores': {'seo': 90, 'geo': 88, 'overall': 89},
            'strategic_impacts': [
                {
                    'impact': 'Strengthen positioning',
                    'detail': 'Richer entity markup than rivals.',
                    'competitors': ['https://www.toptal.com'],
                }
            ],
        }

        with patch('src.services.optimizer_nodes._call_llm', return_value=llm_response) as mocked:
            result = plan_changes(self._state())

        prompt = mocked.call_args[0][0]
        assert 'https://www.toptal.com' in prompt
        assert result['strategic_impacts'][0]['competitors'] == ['https://www.toptal.com']

    def test_yields_no_impacts_when_the_llm_call_fails(self):
        with patch('src.services.optimizer_nodes._call_llm', side_effect=RuntimeError('boom')):
            result = plan_changes(self._state())

        assert result['strategic_impacts'] == []
        assert result['plan_error'] == 'boom'

    def test_compile_carries_impacts_into_the_final_payload(self):
        impacts = [{'impact': 'Reduce paid spend', 'detail': None, 'competitors': []}]

        compiled = compile_optimization({'analysis': {'scores': {}}, 'strategic_impacts': impacts})

        assert compiled['strategic_impacts'] == impacts

    def test_compile_defaults_to_an_empty_list(self):
        compiled = compile_optimization({'analysis': {'scores': {}}})

        assert compiled['strategic_impacts'] == []


# ── Service level: the project's competitors reach the graph, impacts persist ──


@pytest.mark.asyncio
async def test_optimize_persists_impacts_and_passes_competitors(db_session_factory):
    """The competitor set has to survive the hop into the graph (which runs in a
    thread executor and cannot touch the async session), and the impacts have to
    survive the hop back into the DB."""
    async with db_session_factory() as session:
        project = Project(
            title='CodeRoad',
            description='Nearshore engineering',
            category='marketplace',
            country='United States',
        )
        session.add(project)
        await session.flush()
        session.add(
            Competitor(
                project_id=project.id,
                url='https://www.toptal.com',
                description='freelance network',
            )
        )

        ingested = IngestedUrl(
            url='https://coderoad.com',
            html='<html><head><title>t</title></head><body>x</body></html>',
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)
        await session.refresh(project)

        analysis = UrlAnalysis(
            ingested_url_id=ingested.id,
            project_id=project.id,
            seo_score=53,
            geo_score=40,
            overall_score=46,
            analysis={},
            json_ld=None,
            status='completed',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        service = OptimizerService(session)
        impacts = [
            {'impact': 'Strengthen positioning', 'detail': None, 'competitors': ['https://www.toptal.com']}
        ]
        captured = {}

        async def fake_run(analysis_dict, html, url, project_dict=None):
            captured['project'] = project_dict
            return {
                'optimized_html': '<html></html>',
                'score_before': {'seo': 53, 'geo': 40, 'overall': 46},
                'score_after_estimated': {'seo': 92, 'geo': 88, 'overall': 90},
                'strategic_impacts': impacts,
                'status': 'completed',
                'error': None,
            }

        with patch.object(service, '_run_optimization_in_executor', new=fake_run):
            optimization = await service.optimize_analysis(analysis.id)

        # The graph received the project's real competitor list...
        assert captured['project']['title'] == 'CodeRoad'
        assert captured['project']['competitors'] == [
            {'name': 'https://www.toptal.com', 'description': 'freelance network'}
        ]
        # ...and the impacts round-tripped through the column.
        assert optimization.strategic_impacts == impacts


@pytest.mark.asyncio
async def test_optimize_without_a_project_passes_no_competitors(db_session_factory):
    """An unattached analysis still optimizes; there is simply nobody to name."""
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://orphan.example',
            html='<html><head><title>t</title></head><body>x</body></html>',
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)

        analysis = UrlAnalysis(
            ingested_url_id=ingested.id,
            seo_score=50,
            geo_score=50,
            overall_score=50,
            analysis={},
            json_ld=None,
            status='completed',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        service = OptimizerService(session)
        captured = {}

        async def fake_run(analysis_dict, html, url, project_dict=None):
            captured['project'] = project_dict
            return {'status': 'completed', 'error': None, 'strategic_impacts': []}

        with patch.object(service, '_run_optimization_in_executor', new=fake_run):
            optimization = await service.optimize_analysis(analysis.id)

        assert captured['project'] is None
        assert optimization.strategic_impacts == []


# ── The compiled graph itself ──────────────────────────────────────────────


def test_the_compiled_graph_carries_project_in_and_impacts_out():
    """Regression: `project` and `strategic_impacts` must be declared on the graph's
    state schema. LangGraph drops undeclared keys silently, which meant the prompt
    never saw the competitors and the impacts never came back — while every
    node-level and service-level test still passed because they bypass the graph."""
    from src.services.optimizer_service import OptimizerService

    service = OptimizerService(session=None)
    compiled = service._build_graph()

    llm_response = {
        'plan': [{'element': 'title', 'action': 'updated', 'priority': 'high'}],
        'estimated_scores': {'seo': 90, 'geo': 88, 'overall': 89},
        'strategic_impacts': [
            {'impact': 'Strengthen positioning', 'detail': None, 'competitors': ['https://www.toptal.com']}
        ],
        # apply_changes reads from the same mocked call.
        'optimized_html': '<html><head><title>Better</title></head><body>x</body></html>',
        'optimized_json_ld': {'@type': 'Product'},
        'optimized_content': {},
        'changes_applied': [],
        'copy_paste_ready': {},
    }

    seen_prompts = []

    def fake_llm(prompt, response_format='json'):
        seen_prompts.append(prompt)
        return llm_response

    with patch('src.services.optimizer_nodes._call_llm', side_effect=fake_llm):
        result = compiled.invoke(
            {
                'html': '<html><head><title>t</title></head><body>x</body></html>',
                'url': 'https://coderoad.com',
                'analysis': {
                    'scores': {'seo': 53, 'geo': 40, 'overall': 46},
                    'findings': [],
                    'recommendations': [],
                },
                'project': PROJECT,
            }
        )

    # The competitor list survived the hop INTO the graph...
    assert any('https://www.toptal.com' in p for p in seen_prompts)
    # ...and the impacts survived the hop back OUT.
    assert result.get('strategic_impacts') == [
        {'impact': 'Strengthen positioning', 'detail': None, 'competitors': ['https://www.toptal.com']}
    ]
