import pytest
from unittest.mock import AsyncMock, patch

from src.services.ingest_service import IngestService


@pytest.mark.asyncio
async def test_ingest_url_invalid_format():
    """Test that an invalid URL raises ValueError."""
    session = AsyncMock()
    service = IngestService(session)

    with pytest.raises(ValueError, match='Invalid URL format'):
        await service.ingest_url('not-a-url')


@pytest.mark.asyncio
async def test_ingest_url_success(db_session_factory):
    """Test successful ingestion stores HTML in DB."""
    html = (
        '<html><body>'
        '<h1>Test Product</h1>'
        '<p>This is a detailed product description with plenty of text '
        'that definitely exceeds the fifty character threshold.</p>'
        '</body></html>'
    )
    async with db_session_factory() as session:
        service = IngestService(session)

        with patch.object(
            service,
            '_scrape_with_httpx',
            new=AsyncMock(
                return_value=(html, 200, 'text/html; charset=utf-8', None)
            ),
        ):
            record = await service.ingest_url('https://example.com/product')

        assert record.url == 'https://example.com/product'
        assert record.status == 'success'
        assert record.http_status == 200
        assert record.content_type == 'text/html; charset=utf-8'
        assert record.html is not None
        assert '<h1>Test Product</h1>' in record.html


@pytest.mark.asyncio
async def test_ingest_url_upsert_updates_existing(db_session_factory):
    """Test that ingesting the same URL twice updates the existing record."""
    async with db_session_factory() as session:
        service = IngestService(session)

        # First ingestion. _has_content() requires >50 chars of extracted text, or
        # ingest_url() falls back to a real (unmocked) Playwright fetch — so the body
        # needs enough text to satisfy that check on its own.
        with patch.object(
            service,
            '_scrape_with_httpx',
            new=AsyncMock(
                return_value=(
                    '<html><body><h1>Version 1</h1>'
                    '<p>This is the first version of the page content, long enough to count.</p>'
                    '</body></html>',
                    200,
                    'text/html',
                    None,
                )
            ),
        ):
            record1 = await service.ingest_url('https://example.com/product')

        # Second ingestion (same URL, different content)
        with patch.object(
            service,
            '_scrape_with_httpx',
            new=AsyncMock(
                return_value=(
                    '<html><body><h1>Version 2</h1>'
                    '<p>This is the second version of the page content, long enough to count.</p>'
                    '</body></html>',
                    200,
                    'text/html',
                    None,
                )
            ),
        ):
            record2 = await service.ingest_url('https://example.com/product')

        assert record1.id == record2.id
        assert record2.html is not None
        assert 'Version 2' in record2.html


@pytest.mark.asyncio
async def test_ingest_url_http_error(db_session_factory):
    """Test that an HTTP error results in a failed record."""
    async with db_session_factory() as session:
        service = IngestService(session)

        with patch.object(
            service,
            '_scrape_with_httpx',
            new=AsyncMock(
                return_value=(None, 404, 'text/html', 'HTTP error 404')
            ),
        ), patch.object(
            service,
            '_scrape_with_playwright',
            new=AsyncMock(return_value=(None, None)),
        ):
            record = await service.ingest_url('https://example.com/not-found')

        assert record.status == 'failed'
        assert record.http_status == 404
        assert record.error == 'HTTP error 404'


@pytest.mark.asyncio
async def test_ingest_url_playwright_fallback(db_session_factory):
    """Test that Playwright fallback is used when httpx returns no content."""
    async with db_session_factory() as session:
        service = IngestService(session)

        with patch.object(
            service,
            '_scrape_with_httpx',
            new=AsyncMock(return_value=(None, None, None, 'Request error')),
        ), patch.object(
            service,
            '_scrape_with_playwright',
            new=AsyncMock(
                return_value=(
                    '<html><body><h1>JS Rendered</h1></body></html>',
                    None,
                )
            ),
        ):
            record = await service.ingest_url('https://example.com/spa')

        assert record.status == 'success'
        assert record.html is not None
        assert 'JS Rendered' in record.html


@pytest.mark.asyncio
async def test_clean_html_removes_scripts():
    """Test that _clean_html removes script/style tags."""
    session = AsyncMock()
    service = IngestService(session)

    dirty_html = '''
    <html>
      <head>
        <style>body { color: red; }</style>
        <script>alert('xss');</script>
      </head>
      <body>
        <h1>Title</h1>
        <script>console.log('remove me');</script>
        <p>Content</p>
      </body>
    </html>
    '''

    cleaned = service._clean_html(dirty_html)

    assert '<script' not in cleaned
    assert '<style' not in cleaned
    assert '<h1>Title</h1>' in cleaned
    assert '<p>Content</p>' in cleaned


@pytest.mark.asyncio
async def test_has_content():
    """Test _has_content detects meaningful content."""
    session = AsyncMock()
    service = IngestService(session)

    long_text = (
        '<html><body><p>This is a long meaningful content that should definitely '
        'exceed the fifty character threshold for content detection.</p></body></html>'
    )
    assert service._has_content(long_text) is True
    assert service._has_content('<html><body></body></html>') is False
