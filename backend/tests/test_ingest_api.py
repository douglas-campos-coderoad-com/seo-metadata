import pytest


@pytest.mark.asyncio
async def test_ingest_url_success(client, monkeypatch):
    """Test POST /api/v1/ingest/url returns expected response."""
    from src.services.ingest_service import IngestService

    async def mock_ingest_url(self, url):
        from src.models import IngestedUrl
        record = IngestedUrl(
            url=url,
            html='<html><body><h1>Test Product</h1></body></html>',
            status='success',
            http_status=200,
            content_type='text/html; charset=utf-8',
            error=None,
        )
        self.session.add(record)
        await self.session.commit()
        await self.session.refresh(record)
        return record

    monkeypatch.setattr(IngestService, 'ingest_url', mock_ingest_url)

    response = await client.post(
        '/api/v1/ingest/url',
        json={'url': 'https://example.com/product'},
    )

    assert response.status_code == 200
    data = response.json()
    assert data['url'] == 'https://example.com/product'
    assert data['status'] == 'success'
    assert data['html_size_bytes'] is not None
    assert data['http_status'] == 200
    assert data['content_type'] == 'text/html; charset=utf-8'
    assert 'created_at' in data


@pytest.mark.asyncio
async def test_ingest_url_invalid(client):
    """Test POST /api/v1/ingest/url with invalid URL returns 422."""
    response = await client.post(
        '/api/v1/ingest/url',
        json={'url': 'not-a-valid-url'},
    )

    assert response.status_code == 422
    data = response.json()
    assert 'detail' in data
    assert 'Invalid request' in data['detail']


@pytest.mark.asyncio
async def test_get_ingested_url_detail(client, db_session_factory):
    """Test GET /api/v1/ingest/url/{id} returns HTML content."""
    from src.models import IngestedUrl

    async with db_session_factory() as session:
        record = IngestedUrl(
            url='https://example.com/detail',
            html='<html><body><h1>Detail Page</h1></body></html>',
            status='success',
            http_status=200,
            content_type='text/html',
            error=None,
        )
        session.add(record)
        await session.commit()
        await session.refresh(record)
        record_id = record.id

    response = await client.get(f'/api/v1/ingest/url/{record_id}')

    assert response.status_code == 200
    data = response.json()
    assert data['id'] == record_id
    assert data['url'] == 'https://example.com/detail'
    assert data['status'] == 'success'
    assert data['html'] is not None
    assert 'Detail Page' in data['html']
    assert 'updated_at' in data


@pytest.mark.asyncio
async def test_get_ingested_url_not_found(client):
    """Test GET /api/v1/ingest/url/{id} with non-existent id returns 404."""
    response = await client.get('/api/v1/ingest/url/99999')

    assert response.status_code == 404
    data = response.json()
    assert 'detail' in data


@pytest.mark.asyncio
async def test_list_ingested_urls(client, db_session_factory):
    """Test GET /api/v1/ingest/urls returns list of records."""
    from src.models import IngestedUrl

    async with db_session_factory() as session:
        for i in range(3):
            record = IngestedUrl(
                url=f'https://example.com/item-{i}',
                html=f'<html><body><h1>Item {i}</h1></body></html>',
                status='success',
                http_status=200,
                content_type='text/html',
                error=None,
            )
            session.add(record)
        await session.commit()

    response = await client.get('/api/v1/ingest/urls')

    assert response.status_code == 200
    data = response.json()
    assert data['total'] == 3
    assert len(data['items']) == 3
    assert data['items'][0]['url'].startswith('https://example.com/')


@pytest.mark.asyncio
async def test_list_ingested_urls_pagination(client, db_session_factory):
    """Test GET /api/v1/ingest/urls respects skip/limit params."""
    from src.models import IngestedUrl

    async with db_session_factory() as session:
        for i in range(5):
            record = IngestedUrl(
                url=f'https://example.com/page-{i}',
                html='<html><body><p>Content</p></body></html>',
                status='success',
                http_status=200,
                content_type='text/html',
                error=None,
            )
            session.add(record)
        await session.commit()

    response = await client.get('/api/v1/ingest/urls?skip=1&limit=2')

    assert response.status_code == 200
    data = response.json()
    assert data['total'] == 5
    assert len(data['items']) == 2


@pytest.mark.asyncio
async def test_list_ingested_urls_invalid_limit(client):
    """Test GET /api/v1/ingest/urls with invalid limit returns 400."""
    response = await client.get('/api/v1/ingest/urls?limit=0')

    assert response.status_code == 400
    data = response.json()
    assert 'detail' in data