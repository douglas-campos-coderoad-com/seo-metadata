"""HTML -> PDF rendering for the exported report.

Uses the Playwright Chromium the backend image already installs for the ingestion
path, so this feature adds no new system dependency (research.md section 1).

Two things this module is responsible for beyond "make a PDF":

1. **Resource bounds.** A page render is memory-heavy. One long-lived browser is
   shared (launching per request costs 0.3-1s and a large spike), each export gets
   its own ``BrowserContext`` so two concurrent exports can never interleave, and
   a semaphore caps how many render at once so a burst queues instead of taking
   the API container down with it.

2. **Containment.** The document embeds markup that came from a third-party page
   and from an LLM. It is rendered as *text*, but the rendering context is locked
   down anyway: JavaScript disabled, every outbound request aborted, content
   loaded via ``set_content`` rather than a URL. That kills SSRF through an
   injected ``<img src="http://169.254.169.254/...">`` and simultaneously
   guarantees FR-020 — nothing external can be referenced because nothing
   external can load.
"""

import asyncio
import html
import logging
import os
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape
from playwright.async_api import Browser, BrowserContext, Playwright, Route, async_playwright

logger = logging.getLogger(__name__)

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / 'templates' / 'report'

#: Schemes the render context is allowed to load. Everything else is aborted.
_ALLOWED_URL_PREFIXES = ('about:', 'data:', 'blob:')


def _render_concurrency() -> int:
    try:
        value = int(os.getenv('REPORT_RENDER_CONCURRENCY', '2'))
    except ValueError:
        value = 2
    return max(1, value)


class PdfRenderer:
    """Owns the shared Chromium and the Jinja2 environment."""

    def __init__(self) -> None:
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        # Playwright objects are bound to the event loop that created them.
        # Tracking that loop lets a consumer running on a different one (each
        # pytest-asyncio test gets a fresh loop) relaunch instead of deadlocking
        # on primitives owned by a loop that is no longer running.
        self._loop: asyncio.AbstractEventLoop | None = None
        self._launch_lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(_render_concurrency())
        self._env = Environment(
            loader=FileSystemLoader(str(TEMPLATE_DIR)),
            # Autoescaping is the primary control against rendering untrusted
            # markup as live HTML. No template may use the |safe filter.
            autoescape=select_autoescape(enabled_extensions=('j2', 'html'), default=True),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    # -- lifecycle ---------------------------------------------------------

    async def start(self) -> None:
        """Launch Chromium up front so the first export does not pay for it."""
        await self._ensure_browser()

    async def stop(self) -> None:
        if self._browser is not None:
            try:
                await self._browser.close()
            except Exception as exc:  # pragma: no cover - shutdown best effort
                logger.warning('Error closing report browser: %s', exc)
            self._browser = None
        if self._playwright is not None:
            try:
                await self._playwright.stop()
            except Exception as exc:  # pragma: no cover - shutdown best effort
                logger.warning('Error stopping playwright: %s', exc)
            self._playwright = None
        self._loop = None

    def _reset_if_loop_changed(self) -> None:
        """Drop browser state that belongs to a different event loop.

        The old objects are abandoned rather than closed: awaiting a close on a
        loop that is no longer running would hang, which is the failure this
        method exists to prevent. Under uvicorn there is exactly one loop for the
        process lifetime, so this is a no-op in production.
        """
        current = asyncio.get_running_loop()
        if self._loop is None or self._loop is current:
            return

        logger.debug('Event loop changed; relaunching the report browser')
        self._playwright = None
        self._browser = None
        self._loop = current
        # These primitives bind to the loop that first awaits them.
        self._launch_lock = asyncio.Lock()
        self._semaphore = asyncio.Semaphore(_render_concurrency())

    async def _ensure_browser(self) -> Browser:
        """Return a connected browser, relaunching if a previous one died.

        A crashed Chromium degrades to a slow export rather than a permanently
        broken endpoint.
        """
        self._reset_if_loop_changed()

        if self._browser is not None and self._browser.is_connected():
            return self._browser

        async with self._launch_lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser

            if self._playwright is None:
                self._playwright = await async_playwright().start()
                self._loop = asyncio.get_running_loop()

            logger.info('Launching Chromium for PDF report rendering')
            self._browser = await self._playwright.chromium.launch(
                args=['--no-sandbox', '--disable-dev-shm-usage'],
            )
            return self._browser

    # -- templating --------------------------------------------------------

    def render_html(self, template_name: str, context: dict[str, Any]) -> str:
        """Render a template to an HTML string with autoescaping on."""
        template = self._env.get_template(template_name)
        return template.render(**context)

    def read_asset(self, name: str) -> str:
        """Read a template-directory asset (the CSS) for inlining.

        Inlined rather than linked so the render needs no network and the PDF is
        self-contained (FR-020).
        """
        return (TEMPLATE_DIR / name).read_text(encoding='utf-8')

    # -- rendering ---------------------------------------------------------

    async def render_pdf(self, html: str, footer_text: str = '') -> bytes:
        """Print an HTML string to PDF bytes.

        The full document is buffered and returned in one piece: FR-021 forbids
        surfacing a partial or corrupt file, so a failure must raise rather than
        yield a truncated stream.
        """
        browser = await self._ensure_browser()

        async with self._semaphore:
            context: BrowserContext = await browser.new_context(
                java_script_enabled=False,
                # A fixed viewport keeps layout identical across renders (SC-007).
                viewport={'width': 1240, 'height': 1754},
            )
            try:
                await context.route('**/*', _block_external_requests)
                page = await context.new_page()
                await page.set_content(html, wait_until='load')
                return await page.pdf(
                    format='A4',
                    print_background=True,
                    display_header_footer=bool(footer_text),
                    header_template='<div></div>',
                    footer_template=_footer_template(footer_text),
                    margin={
                        'top': '14mm',
                        'bottom': '18mm',
                        'left': '14mm',
                        'right': '14mm',
                    },
                )
            finally:
                await context.close()


async def _block_external_requests(route: Route) -> None:
    """Abort anything the document tries to fetch.

    The report is self-contained by construction; if a render ever attempts a
    network call it is either a template regression or injected content, and
    both should fail closed.
    """
    url = route.request.url
    if url.startswith(_ALLOWED_URL_PREFIXES):
        await route.continue_()
        return
    logger.warning('Blocked outbound request during report render: %s', url[:200])
    await route.abort()


def _footer_template(footer_text: str) -> str:
    """Running footer carrying the analysed URL and the page number (FR-015).

    Chromium's footer template is the only page-number mechanism available when
    printing, and it applies uniformly to every page — there is no per-page
    exclusion, so the cover carries the footer too. FR-015's requirement that
    every page *after* the cover be attributable is satisfied; the cover simply
    also carries it.
    """
    if not footer_text:
        return '<div></div>'
    # The footer carries the analysed URL, which is third-party input and does
    # not pass through Jinja2's autoescaping on this path — escape it here.
    safe_text = html.escape(footer_text, quote=True)
    return (
        '<div style="width:100%;font-size:8px;color:#6b7280;'
        'padding:0 14mm;display:flex;justify-content:space-between;'
        'font-family:sans-serif;">'
        f'<span>{safe_text}</span>'
        '<span><span class="pageNumber"></span> / <span class="totalPages"></span></span>'
        '</div>'
    )


#: Module-level singleton wired into the app lifecycle in ``main.py``.
pdf_renderer = PdfRenderer()
