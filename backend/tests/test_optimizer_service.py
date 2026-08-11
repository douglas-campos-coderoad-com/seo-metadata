import pytest
from unittest.mock import AsyncMock, patch

from src.services.optimizer_nodes import (
    read_analysis,
    search_web_node,
    plan_changes,
    apply_changes,
    compile_optimization,
)
from src.services.optimizer_service import OptimizerService
from src.models import IngestedUrl, UrlAnalysis, UrlOptimization


SAMPLE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Modern Dining Chair</title>
    <meta name="description" content="Beautiful chair">
</head>
<body>
    <h1>Modern Dining Chair</h1>
    <p>This chair is made from exotic Argentine wood.</p>
    <img src="/chair.jpg" alt="">
</body>
</html>
"""


# ── read_analysis tests ───────────────────────────────────────────────────


def test_read_analysis_success():
    state = {
        'analysis': {'scores': {'seo': 55, 'geo': 30, 'overall': 42}},
        'html': SAMPLE_HTML,
        'url': 'https://example.com/chair',
    }
    result = read_analysis(state)
    assert result['read_error'] is None
    assert result['url'] == 'https://example.com/chair'


def test_read_analysis_missing():
    result = read_analysis({'analysis': {}, 'html': ''})
    assert result['read_error'] == 'Missing analysis or HTML'


# ── search_web_node tests ─────────────────────────────────────────────────


def test_search_web_node_no_key():
    with patch('src.services.optimizer_nodes.SERPER_API_KEY', ''):
        result = search_web_node({
            'url': 'https://example.com',
            'analysis': {'json_ld': {'@type': 'Product'}},
        })
    assert 'search_context' in result
    assert 'No search results available' in result['search_context']


def test_search_web_node_with_results():
    mock_results = {
        'organic': [
            {'title': 'SEO Best Practices', 'link': 'https://example.com/seo', 'snippet': 'Tips...'}
        ],
        'error': None,
    }
    with patch('src.services.optimizer_nodes.search_web', return_value=mock_results):
        result = search_web_node({
            'url': 'https://example.com',
            'analysis': {'json_ld': {'@type': 'Product'}},
        })
    assert 'SEO Best Practices' in result['search_context']


# ── plan_changes tests ────────────────────────────────────────────────────


def test_plan_changes_success():
    state = {
        'analysis': {
            'scores': {'seo': 55, 'geo': 30, 'overall': 42},
            'findings': ['Missing JSON-LD'],
            'recommendations': ['Add JSON-LD'],
            'geo_visibility': 'Low',
            'json_ld': {'@type': 'Product'},
        },
        'html': SAMPLE_HTML,
        'url': 'https://example.com/chair',
        'search_context': 'Best practices...',
    }

    mock_result = {
        'plan': [
            {
                'element': 'title',
                'action': 'updated',
                'priority': 'high',
                'reason': 'Title too short',
                'snippet_hint': '<title>Optimized Title</title>',
            }
        ],
        'estimated_scores': {'seo': 80, 'geo': 70, 'overall': 75},
    }

    with patch('src.services.optimizer_nodes._call_gemini', return_value=mock_result):
        result = plan_changes(state)

    assert result['plan_error'] is None
    assert len(result['plan']) == 1
    assert result['estimated_scores']['seo'] == 80


def test_plan_changes_error():
    state = {
        'analysis': {'scores': {}},
        'html': SAMPLE_HTML,
        'url': 'https://example.com',
        'search_context': '',
    }

    with patch('src.services.optimizer_nodes._call_gemini', side_effect=Exception('API error')):
        result = plan_changes(state)

    assert result['plan_error'] is not None
    assert result['plan'] == []


# ── apply_changes tests ───────────────────────────────────────────────────


def test_apply_changes_success():
    state = {
        'analysis': {
            'scores': {'seo': 55, 'geo': 30, 'overall': 42},
            'json_ld': {'@type': 'Product'},
        },
        'html': SAMPLE_HTML,
        'url': 'https://example.com/chair',
        'plan': [{'element': 'title', 'action': 'updated'}],
        'search_context': 'Best practices...',
    }

    mock_result = {
        'optimized_html': '<!DOCTYPE html><html><head><title>Optimized</title></head></html>',
        'optimized_json_ld': {'@context': 'https://schema.org', '@type': 'Product'},
        'optimized_content': {
            'title': 'Optimized Title',
            'meta_description': 'Optimized description',
            'alt_texts': {'/chair.jpg': 'Modern dining chair'},
            'geo_content': '¿Buscas una silla moderna?',
        },
        'changes_applied': [
            {
                'element': 'title',
                'action': 'updated',
                'before': 'Modern Dining Chair',
                'after': 'Optimized Title',
                'severity': 'high',
                'reason': 'Title too short',
                'snippet': '<title>Optimized Title</title>',
            }
        ],
    }

    with patch('src.services.optimizer_nodes._call_gemini', return_value=mock_result):
        result = apply_changes(state)

    assert result['apply_error'] is None
    assert 'Optimized' in result['optimized_html']
    assert result['optimized_json_ld'] is not None
    assert len(result['changes_applied']) == 1


def test_apply_changes_error():
    state = {
        'analysis': {'scores': {}},
        'html': SAMPLE_HTML,
        'url': 'https://example.com',
        'plan': [],
        'search_context': '',
    }

    with patch('src.services.optimizer_nodes._call_gemini', side_effect=Exception('API error')):
        result = apply_changes(state)

    assert result['apply_error'] is not None
    assert result['optimized_html'] == ''


# ── compile_optimization tests ────────────────────────────────────────────


def test_compile_optimization_success():
    state = {
        'analysis': {'scores': {'seo': 55, 'geo': 30, 'overall': 42}},
        'optimized_html': '<html>optimized</html>',
        'optimized_json_ld': {'@context': 'https://schema.org'},
        'optimized_content': {'title': 'Optimized'},
        'changes_applied': [{'element': 'title'}],
        'estimated_scores': {'seo': 80, 'geo': 70, 'overall': 75},
        'read_error': None,
        'plan_error': None,
        'apply_error': None,
    }

    result = compile_optimization(state)

    assert result['status'] == 'completed'
    assert result['score_before']['seo'] == 55
    assert result['score_after_estimated']['seo'] == 80
    assert result['error'] is None


def test_compile_optimization_with_errors():
    state = {
        'analysis': {'scores': {}},
        'optimized_html': '',
        'optimized_json_ld': None,
        'optimized_content': {},
        'changes_applied': [],
        'estimated_scores': {'seo': 0, 'geo': 0, 'overall': 0},
        'read_error': 'Missing analysis or HTML',
        'plan_error': None,
        'apply_error': None,
    }

    result = compile_optimization(state)

    assert result['status'] == 'failed'
    assert result['error'] == 'Missing analysis or HTML'


# ── OptimizerService tests ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_optimize_analysis_not_found(db_session_factory):
    async with db_session_factory() as session:
        service = OptimizerService(session)
        with pytest.raises(ValueError, match='not found'):
            await service.optimize_analysis(999)


@pytest.mark.asyncio
async def test_optimize_analysis_not_completed(db_session_factory):
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/pending',
            html=SAMPLE_HTML,
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
            geo_score=40,
            overall_score=45,
            analysis={},
            json_ld=None,
            status='running',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        service = OptimizerService(session)
        with pytest.raises(ValueError, match='Cannot optimize'):
            await service.optimize_analysis(analysis.id)


@pytest.mark.asyncio
async def test_optimize_analysis_success(db_session_factory):
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/optimize',
            html=SAMPLE_HTML,
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
            seo_score=55,
            geo_score=30,
            overall_score=42,
            analysis={
                'findings': ['Missing JSON-LD'],
                'recommendations': ['Add JSON-LD'],
                'geo_visibility': 'Low',
            },
            json_ld={'@type': 'Product'},
            status='completed',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        service = OptimizerService(session)

        mock_result = {
            'optimized_html': '<!DOCTYPE html><html><head><title>Optimized</title></head></html>',
            'optimized_json_ld': {'@context': 'https://schema.org', '@type': 'Product'},
            'optimized_content': {'title': 'Optimized Title'},
            'changes': [{'element': 'title', 'action': 'updated'}],
            'score_before': {'seo': 55, 'geo': 30, 'overall': 42},
            'score_after_estimated': {'seo': 80, 'geo': 70, 'overall': 75},
            'status': 'completed',
            'error': None,
        }

        with patch.object(service, '_run_optimization_in_executor', new=AsyncMock(return_value=mock_result)):
            optimization = await service.optimize_analysis(analysis.id)

        assert optimization.analysis_id == analysis.id
        assert optimization.status == 'completed'
        assert 'Optimized' in optimization.optimized_html
        assert optimization.score_before['seo'] == 55
        assert optimization.score_after_estimated['seo'] == 80


@pytest.mark.asyncio
async def test_get_latest_optimization(db_session_factory):
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/latest-opt',
            html=SAMPLE_HTML,
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
            seo_score=60,
            geo_score=50,
            overall_score=55,
            analysis={},
            json_ld=None,
            status='completed',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)

        opt1 = UrlOptimization(
            analysis_id=analysis.id,
            optimized_html='<html>v1</html>',
            status='completed',
            error=None,
        )
        session.add(opt1)
        await session.commit()

        opt2 = UrlOptimization(
            analysis_id=analysis.id,
            optimized_html='<html>v2</html>',
            status='completed',
            error=None,
        )
        session.add(opt2)
        await session.commit()

        service = OptimizerService(session)
        latest = await service.get_latest_optimization(analysis.id)

        assert latest is not None
        assert latest.optimized_html == '<html>v2</html>'