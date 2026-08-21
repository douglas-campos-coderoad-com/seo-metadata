import pytest
from unittest.mock import AsyncMock, patch

from src.services.graph_nodes import (
    parse_html,
    analyze_seo_geo,
    generate_json_ld,
    compile_report,
)
from src.services.analysis_service import AnalysisService
from src.models import IngestedUrl, UrlAnalysis


SAMPLE_HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <title>Modern Dining Chair in Exotic Argentine Wood | InCollect</title>
    <meta name="description" content="Beautiful modern dining chair crafted from exotic Argentine wood. Perfect for contemporary dining rooms.">
    <meta name="keywords" content="dining chair, modern, wood, argentine">
    <meta property="og:title" content="Modern Dining Chair">
    <meta property="og:description" content="Beautiful modern dining chair">
    <link rel="canonical" href="https://example.com/chair">
    <link rel="icon" href="/favicon.ico">
</head>
<body>
    <h1>Modern Dining Chair</h1>
    <h2>Materials</h2>
    <p>This chair is made from exotic Argentine wood with a modern design.</p>
    <img src="/chair.jpg" alt="Modern dining chair in wood">
    <img src="/chair2.jpg" alt="">
    <a href="/related">Related</a>
    <a href="https://external.com" rel="nofollow">External</a>
    <script type="application/ld+json">
    {"@context": "https://schema.org", "@type": "Product", "name": "Modern Dining Chair"}
    </script>
</body>
</html>
"""


# ── parse_html tests ──────────────────────────────────────────────────────


def test_parse_html_extracts_title():
    result = parse_html({'html': SAMPLE_HTML})
    page_data = result['page_data']
    assert page_data['title'] == 'Modern Dining Chair in Exotic Argentine Wood | InCollect'
    assert result['parse_error'] is None


def test_parse_html_extracts_meta():
    result = parse_html({'html': SAMPLE_HTML})
    page_data = result['page_data']
    assert 'Beautiful modern dining chair' in page_data['meta_description']
    assert page_data['canonical'] == 'https://example.com/chair'
    assert page_data['lang'] == 'en'
    assert page_data['has_favicon'] is True


def test_parse_html_extracts_headings():
    result = parse_html({'html': SAMPLE_HTML})
    page_data = result['page_data']
    assert 'h1' in page_data['headings']
    assert page_data['headings']['h1'] == ['Modern Dining Chair']
    assert 'h2' in page_data['headings']
    assert page_data['headings']['h2'] == ['Materials']


def test_parse_html_extracts_images():
    result = parse_html({'html': SAMPLE_HTML})
    page_data = result['page_data']
    assert page_data['images_total'] == 2
    assert page_data['images_with_alt'] == 1
    assert page_data['images_without_alt'] == 1


def test_parse_html_extracts_links():
    result = parse_html({'html': SAMPLE_HTML})
    page_data = result['page_data']
    assert page_data['links']['total'] == 2
    assert page_data['links']['internal'] == 1
    assert page_data['links']['external'] == 1
    assert page_data['links']['nofollow'] == 1


def test_parse_html_extracts_json_ld():
    result = parse_html({'html': SAMPLE_HTML})
    page_data = result['page_data']
    assert len(page_data['json_ld']) == 1
    assert page_data['json_ld'][0]['@type'] == 'Product'


def test_parse_html_empty():
    result = parse_html({'html': ''})
    assert result['page_data'] == {}
    assert result['parse_error'] == 'No HTML provided'


# ── analyze_seo_geo tests ─────────────────────────────────────────────────


def test_analyze_seo_geo_success():
    page_data = {
        'title': 'Test Title',
        'meta_description': 'Test description',
        'meta_keywords': 'test',
        'canonical': 'https://example.com',
        'og_tags': {'og:title': 'Test'},
        'twitter_tags': {},
        'headings': {'h1': ['Test']},
        'images_total': 1,
        'images_with_alt': 1,
        'images_without_alt': 0,
        'links': {'internal': 1, 'external': 0, 'nofollow': 0, 'total': 1},
        'json_ld': [],
        'visible_text_preview': 'This is a test page with content',
        'visible_text_length': 35,
        'robots': 'index,follow',
        'viewport': 'width=device-width',
        'lang': 'en',
        'has_favicon': True,
        'raw_html_length': 100,
    }

    mock_finding = {
        'id': 'F1',
        'category': 'structured_data',
        'dimension': 'json_ld',
        'impact': 'both',
        'severity': 'medium',
        'status': 'warning',
        'title': 'Missing JSON-LD',
        'detail': 'No structured data was found on the page.',
    }
    mock_recommendation = {
        'id': 'R1',
        'finding_id': 'F1',
        'category': 'structured_data',
        'priority': 'medium',
        'effort': 'low',
        'impact': 'both',
        'action': 'Add JSON-LD structured data',
        'rationale': 'Helps search engines and LLMs parse the product.',
        'html_change': {
            'change_type': 'add',
            'location': 'inside <head>',
            'current_html': '',
            'suggested_html': '<script type="application/ld+json">{"@type":"Product"}</script>',
        },
    }
    mock_result = {
        'seo_score': 75,
        'geo_score': 60,
        'findings': [mock_finding],
        'recommendations': [mock_recommendation],
        'geo_visibility': 'The content is moderately visible to AI.',
        'seo_breakdown': {'title': 10, 'meta_description': 10},
        'geo_breakdown': {'question_answering': 15},
    }

    with patch('src.services.graph_nodes._call_llm', return_value=mock_result):
        result = analyze_seo_geo({'page_data': page_data})

    assert result['seo_score'] == 75
    assert result['geo_score'] == 60
    assert result['findings'] == [mock_finding]
    assert result['recommendations'] == [mock_recommendation]
    assert result['seo_geo_error'] is None


def test_analyze_seo_geo_passes_through_raw_findings():
    """The analyser never validates/drops findings — malformed shapes must survive
    unchanged, since each consumer (report_mappings, AnalysisApiService) coerces at
    its own boundary instead."""
    page_data = {'title': 'Test', 'raw_html_length': 10}

    mock_result = {
        'seo_score': 50,
        'geo_score': 50,
        'findings': [{'severity': 'not-a-real-severity', 'category': 'content', 'title': 'Bad'}],
        'recommendations': [],
        'geo_visibility': '',
        'seo_breakdown': {},
        'geo_breakdown': {},
    }

    with patch('src.services.graph_nodes._call_llm', return_value=mock_result):
        result = analyze_seo_geo({'page_data': page_data})

    assert result['findings'] == mock_result['findings']


def test_analyze_seo_geo_error():
    page_data = {'title': 'Test'}

    with patch('src.services.graph_nodes._call_llm', side_effect=Exception('API error')):
        result = analyze_seo_geo({'page_data': page_data})

    assert result['seo_score'] == 18
    assert result['geo_score'] == 0
    assert result['seo_geo_error'] is not None
    assert any('API error' in f.get('detail', '') for f in result['findings'])


def test_analyze_seo_geo_no_data():
    result = analyze_seo_geo({'page_data': {}})
    assert result['seo_geo_error'] == 'No page data available'


# ── generate_json_ld tests ────────────────────────────────────────────────


def test_generate_json_ld_success():
    page_data = {
        'title': 'Modern Dining Chair',
        'meta_description': 'Beautiful chair',
        'headings': {'h1': ['Modern Dining Chair']},
        'json_ld': [],
        'visible_text_preview': 'This chair is made from exotic Argentine wood.',
    }

    mock_json_ld = {
        '@context': 'https://schema.org',
        '@graph': [
            {'@type': 'Product', 'name': 'Modern Dining Chair', 'material': 'Wood'}
        ],
    }

    with patch('src.services.graph_nodes._call_llm', return_value=mock_json_ld):
        result = generate_json_ld({'page_data': page_data})

    assert result['json_ld'] is not None
    assert result['json_ld']['@context'] == 'https://schema.org'
    assert result['json_ld_error'] is None


def test_generate_json_ld_error():
    page_data = {'title': 'Test'}

    with patch('src.services.graph_nodes._call_llm', side_effect=Exception('API error')):
        result = generate_json_ld({'page_data': page_data})

    assert result['json_ld'] is None
    assert result['json_ld_error'] is not None


# ── compile_report tests ──────────────────────────────────────────────────


def test_compile_report_success():
    state = {
        'seo_score': 80,
        'geo_score': 60,
        'findings': [{'id': 'F1', 'severity': 'warning', 'category': 'content', 'title': 'Finding 1', 'detail': 'x'}],
        'recommendations': [{'id': 'R1', 'finding_id': 'F1', 'action': 'Rec 1'}],
        'geo_visibility': 'Good visibility',
        'seo_breakdown': {'title': 10},
        'geo_breakdown': {'question_answering': 15},
        'json_ld': {'@context': 'https://schema.org'},
        'parse_error': None,
        'seo_geo_error': None,
        'json_ld_error': None,
    }

    result = compile_report(state)

    assert result['seo_score'] == 80
    assert result['geo_score'] == 60
    assert result['overall_score'] == 70
    assert result['status'] == 'completed'
    assert result['error'] is None
    assert result['analysis']['findings'][0]['title'] == 'Finding 1'
    assert result['analysis']['recommendations'][0]['action'] == 'Rec 1'


def test_compile_report_with_errors():
    state = {
        'seo_score': 0,
        'geo_score': 0,
        'findings': [],
        'geo_visibility': '',
        'seo_breakdown': {},
        'geo_breakdown': {},
        'json_ld': None,
        'parse_error': 'No HTML provided',
        'seo_geo_error': None,
        'json_ld_error': None,
    }

    result = compile_report(state)

    assert result['status'] == 'failed'
    assert result['error'] == 'No HTML provided'


# ── AnalysisService tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_analyze_url_not_found(db_session_factory):
    async with db_session_factory() as session:
        service = AnalysisService(session)
        with pytest.raises(ValueError, match='not found'):
            await service.analyze_url(999)


@pytest.mark.asyncio
async def test_analyze_url_no_html(db_session_factory):
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/no-html',
            html=None,
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)

        service = AnalysisService(session)
        with pytest.raises(ValueError, match='no HTML'):
            await service.analyze_url(ingested.id)


@pytest.mark.asyncio
async def test_analyze_url_success(db_session_factory):
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/product',
            html=SAMPLE_HTML,
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)

        service = AnalysisService(session)

        mock_result = {
            'seo_score': 72,
            'geo_score': 55,
            'overall_score': 63,
            'analysis': {
                'findings': [
                    {
                        'id': 'F1',
                        'category': 'metadata',
                        'severity': 'critical',
                        'status': 'fail',
                        'title': 'Missing meta description',
                        'detail': 'The page has no meta description tag.',
                    }
                ],
                'recommendations': [
                    {
                        'id': 'R1',
                        'finding_id': 'F1',
                        'action': 'Add meta description',
                    }
                ],
                'geo_visibility': 'Moderate visibility',
                'seo_breakdown': {},
                'geo_breakdown': {},
                'errors': [],
            },
            'json_ld': {'@context': 'https://schema.org', '@type': 'Product'},
            'status': 'completed',
            'error': None,
        }

        with patch.object(service, '_run_analysis_in_executor', new=AsyncMock(return_value=mock_result)):
            analysis = await service.analyze_url(ingested.id)

        assert analysis.ingested_url_id == ingested.id
        assert analysis.seo_score == 72
        assert analysis.geo_score == 55
        assert analysis.overall_score == 63
        assert analysis.status == 'completed'
        assert analysis.json_ld is not None


@pytest.mark.asyncio
async def test_get_latest_analysis(db_session_factory):
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/latest',
            html='<html><body><h1>Test</h1></body></html>',
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)

        analysis1 = UrlAnalysis(
            ingested_url_id=ingested.id,
            seo_score=50,
            geo_score=40,
            overall_score=45,
            analysis={},
            json_ld=None,
            status='completed',
            error=None,
        )
        session.add(analysis1)
        await session.commit()

        analysis2 = UrlAnalysis(
            ingested_url_id=ingested.id,
            seo_score=80,
            geo_score=70,
            overall_score=75,
            analysis={},
            json_ld=None,
            status='completed',
            error=None,
        )
        session.add(analysis2)
        await session.commit()

        service = AnalysisService(session)
        latest = await service.get_latest_analysis(ingested.id)

        assert latest is not None
        assert latest.seo_score == 80