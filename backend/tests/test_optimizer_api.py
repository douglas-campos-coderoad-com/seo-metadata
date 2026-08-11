import pytest
from unittest.mock import AsyncMock, patch

from src.models import IngestedUrl, UrlAnalysis, UrlOptimization


@pytest.mark.asyncio
async def test_optimize_analysis_success(client, db_session_factory):
    """Test POST /api/v1/optimize/{id} runs optimization and returns results."""
    from src.services.optimizer_service import OptimizerService

    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/optimize-api',
            html='<html><body><h1>Test Product</h1><p>Description</p></body></html>',
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
            analysis={'findings': ['Missing JSON-LD'], 'recommendations': ['Add JSON-LD']},
            json_ld={'@type': 'Product'},
            status='completed',
            error=None,
        )
        session.add(analysis)
        await session.commit()
        await session.refresh(analysis)
        analysis_id = analysis.id

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

    with patch.object(OptimizerService, '_run_optimization_in_executor', new=AsyncMock(return_value=mock_result)):
        response = await client.post(f'/api/v1/optimize/{analysis_id}')

    assert response.status_code == 200
    data = response.json()
    assert data['analysis_id'] == analysis_id
    assert data['status'] == 'completed'
    assert 'Optimized' in data['optimized_html']
    assert data['score_before']['seo'] == 55
    assert data['score_after_estimated']['seo'] == 80


@pytest.mark.asyncio
async def test_optimize_analysis_not_found(client):
    """Test POST /api/v1/optimize/{id} with non-existent id returns 404."""
    response = await client.post('/api/v1/optimize/99999')

    assert response.status_code == 404
    data = response.json()
    assert 'detail' in data


@pytest.mark.asyncio
async def test_get_optimization_success(client, db_session_factory):
    """Test GET /api/v1/optimize/{id} returns latest optimization."""
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/get-opt',
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

        optimization = UrlOptimization(
            analysis_id=analysis.id,
            optimized_html='<html>optimized</html>',
            optimized_json_ld={'@context': 'https://schema.org'},
            optimized_content={'title': 'Optimized'},
            changes=[{'element': 'title'}],
            score_before={'seo': 60, 'geo': 50, 'overall': 55},
            score_after_estimated={'seo': 85, 'geo': 75, 'overall': 80},
            status='completed',
            error=None,
        )
        session.add(optimization)
        await session.commit()
        await session.refresh(optimization)
        analysis_id = analysis.id

    response = await client.get(f'/api/v1/optimize/{analysis_id}')

    assert response.status_code == 200
    data = response.json()
    assert data['analysis_id'] == analysis_id
    assert data['status'] == 'completed'
    assert data['optimized_html'] == '<html>optimized</html>'
    assert data['score_after_estimated']['seo'] == 85


@pytest.mark.asyncio
async def test_get_optimization_not_found(client, db_session_factory):
    """Test GET /api/v1/optimize/{id} with no optimization returns 404."""
    async with db_session_factory() as session:
        ingested = IngestedUrl(
            url='https://example.com/no-opt',
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
        analysis_id = analysis.id

    response = await client.get(f'/api/v1/optimize/{analysis_id}')

    assert response.status_code == 404
    data = response.json()
    assert 'detail' in data