import pytest
from unittest.mock import AsyncMock, patch

from src.models import IngestedUrl, UrlAnalysis


@pytest.mark.asyncio
async def test_analyze_url_success(client, db_session_factory):
    """Test POST /api/v1/analyze/{id} runs analysis and returns results."""
    from src.services.analysis_service import AnalysisService

    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/analyze',
            html='<html><body><h1>Test Product</h1><p>Description</p></body></html>',
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)
        ingested_id = ingested.id

    mock_finding = {
        'id': 'F1',
        'category': 'metadata',
        'severity': 'critical',
        'status': 'fail',
        'title': 'Missing meta description',
        'detail': 'The page has no meta description tag.',
    }
    mock_recommendation = {
        'id': 'R1',
        'finding_id': 'F1',
        'action': 'Add meta description',
    }
    mock_result = {
        'seo_score': 65,
        'geo_score': 45,
        'overall_score': 55,
        'analysis': {
            'findings': [mock_finding],
            'recommendations': [mock_recommendation],
            'geo_visibility': 'Moderate visibility',
            'seo_breakdown': {},
            'geo_breakdown': {},
            'errors': [],
        },
        'json_ld': {'@context': 'https://schema.org', '@type': 'Product'},
        'status': 'completed',
        'error': None,
    }

    with patch.object(AnalysisService, '_run_analysis_in_executor', new=AsyncMock(return_value=mock_result)):
        response = await client.post(f'/api/v1/analyze/{ingested_id}')

    assert response.status_code == 200
    data = response.json()
    assert data['ingested_url_id'] == ingested_id
    assert data['seo_score'] == 65
    assert data['geo_score'] == 45
    assert data['overall_score'] == 55
    assert data['status'] == 'completed'
    assert data['json_ld'] is not None
    assert data['analysis']['findings'][0]['title'] == 'Missing meta description'
    assert data['analysis']['findings'][0]['severity'] == 'critical'


@pytest.mark.asyncio
async def test_analyze_url_not_found(client):
    """Test POST /api/v1/analyze/{id} with non-existent id returns 404."""
    response = await client.post('/api/v1/analyze/99999')

    assert response.status_code == 404
    data = response.json()
    assert 'detail' in data


@pytest.mark.asyncio
async def test_get_analysis_success(client, db_session_factory):
    """Test GET /api/v1/analyze/{id} returns latest analysis."""
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/get-analysis',
            html='<html><body><h1>Test</h1></body></html>',
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
            seo_score=70,
            geo_score=50,
            overall_score=60,
            analysis={
                'findings': [
                    {
                        'id': 'F1',
                        'category': 'content',
                        'severity': 'medium',
                        'status': 'warning',
                        'title': 'Test finding',
                        'detail': 'A test finding.',
                    }
                ],
                'recommendations': [
                    {'id': 'R1', 'finding_id': 'F1', 'action': 'Do the test fix'}
                ],
            },
            json_ld={'@context': 'https://schema.org'},
            status='completed',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)
        ingested_id = ingested.id

    response = await client.get(f'/api/v1/analyze/{ingested_id}')

    assert response.status_code == 200
    data = response.json()
    assert data['ingested_url_id'] == ingested_id
    assert data['seo_score'] == 70
    assert data['geo_score'] == 50
    assert data['status'] == 'completed'
    assert data['json_ld'] is not None


@pytest.mark.asyncio
async def test_get_analysis_not_found(client, db_session_factory):
    """Test GET /api/v1/analyze/{id} with no analysis returns 404."""
    from src.models import IngestedUrl

    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/no-analysis',
            html='<html><body><h1>Test</h1></body></html>',
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(ingested)
        await session.commit()
        await session.refresh(ingested)
        ingested_id = ingested.id

    response = await client.get(f'/api/v1/analyze/{ingested_id}')

    assert response.status_code == 404
    data = response.json()
    assert 'detail' in data