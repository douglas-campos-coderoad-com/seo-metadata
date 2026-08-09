import os
from typing import Optional
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models import IngestedUrl

USER_AGENT = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
)
TIMEOUT = float(os.getenv('INGEST_TIMEOUT', '15'))
MAX_HTML_SIZE = int(os.getenv('INGEST_MAX_HTML_SIZE', '5000000'))  # 5MB
USE_PLAYWRIGHT_FALLBACK = os.getenv('INGEST_PLAYWRIGHT_FALLBACK', 'true').lower() == 'true'


class IngestService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def ingest_url(self, url: str) -> IngestedUrl:
        """Scrape a URL and store the HTML in the database."""
        # 1. Validate URL format
        parsed = urlparse(url)
        if parsed.scheme not in ('http', 'https') or not parsed.netloc:
            raise ValueError('Invalid URL format. Must be a valid http/https URL.')

        # 2. Try base scraping with httpx
        html, http_status, content_type, error = await self._scrape_with_httpx(url)

        # 3. Fallback to Playwright if no useful content
        if USE_PLAYWRIGHT_FALLBACK and (not html or not self._has_content(html)):
            playwright_html, playwright_error = await self._scrape_with_playwright(url)
            if playwright_html:
                html = playwright_html
                error = None
            elif playwright_error:
                error = playwright_error

        # 4. Upsert: check if URL already exists, otherwise create new record
        existing = await self.session.execute(
            select(IngestedUrl).where(IngestedUrl.url == url)
        )
        record = existing.scalar_one_or_none()

        if record is not None:
            # Update existing record
            record.html = html
            record.status = 'success' if html and not error else 'failed'
            record.http_status = http_status
            record.content_type = content_type
            record.error = error
        else:
            # Create new record
            record = IngestedUrl(
                url=url,
                html=html,
                status='success' if html and not error else 'failed',
                http_status=http_status,
                content_type=content_type,
                error=error,
            )
            self.session.add(record)

        await self.session.commit()
        await self.session.refresh(record)
        return record

    async def _scrape_with_httpx(
        self, url: str
    ) -> tuple[Optional[str], Optional[int], Optional[str], Optional[str]]:
        """Base scraping using httpx. Returns (html, http_status, content_type, error)."""
        try:
            async with httpx.AsyncClient(
                follow_redirects=True,
                timeout=TIMEOUT,
                headers={'User-Agent': USER_AGENT},
            ) as client:
                response = await client.get(url)
                content_type = response.headers.get('content-type')

                if response.status_code >= 400:
                    return (
                        None,
                        response.status_code,
                        content_type,
                        f'HTTP error {response.status_code}',
                    )

                if 'text/html' not in (content_type or '').lower():
                    return (
                        None,
                        response.status_code,
                        content_type,
                        f'Unsupported content type: {content_type}',
                    )

                html = response.text
                if len(html.encode('utf-8')) > MAX_HTML_SIZE:
                    return (
                        None,
                        response.status_code,
                        content_type,
                        f'HTML too large ({len(html.encode("utf-8"))} bytes)',
                    )

                cleaned = self._clean_html(html)
                return cleaned, response.status_code, content_type, None

        except httpx.TimeoutException:
            return None, None, None, 'Request timed out'
        except httpx.RequestError as exc:
            return None, None, None, f'Request error: {exc}'
        except Exception as exc:
            return None, None, None, f'Unexpected error: {exc}'

    async def _scrape_with_playwright(
        self, url: str
    ) -> tuple[Optional[str], Optional[str]]:
        """Fallback scraping using Playwright for JS-rendered pages."""
        try:
            from playwright.async_api import async_playwright
        except ImportError:
            return None, 'Playwright not installed'

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(user_agent=USER_AGENT)
                await page.goto(url, wait_until='networkidle', timeout=TIMEOUT * 1000)
                html = await page.content()
                await browser.close()

                if len(html.encode('utf-8')) > MAX_HTML_SIZE:
                    return None, f'HTML too large ({len(html.encode("utf-8"))} bytes)'

                cleaned = self._clean_html(html)
                return cleaned, None
        except Exception as exc:
            return None, f'Playwright error: {exc}'

    def _clean_html(self, html: str) -> str:
        """Remove scripts/styles and normalize HTML using BeautifulSoup."""
        soup = BeautifulSoup(html, 'html.parser')
        for tag in soup(['script', 'style', 'noscript', 'iframe', 'svg']):
            tag.decompose()
        return str(soup)

    def _has_content(self, html: str) -> bool:
        """Check if the HTML has meaningful content (not just empty shell)."""
        soup = BeautifulSoup(html, 'html.parser')
        text = soup.get_text(strip=True)
        return len(text) > 50