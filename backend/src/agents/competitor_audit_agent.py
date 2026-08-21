"""Lightweight SEO & GEO Audit Agent for competitor URLs.

Fetches each competitor URL concurrently, extracts light HTML signals via
BeautifulSoup, scores them with Gemini through the LLM repository, and
persistently saves ``seo_score``, ``geo_score``, ``status`` and
``analyzed_at`` back to the database (FR-008 extended).

Usage::

    from src.agents.competitor_audit_agent import run_audit

    results = await run_audit(project_id=1, session=session)
    # → [{"url": "...", "seo_score": 72, "geo_score": 45, ...}, ...]
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from bs4 import BeautifulSoup
from sqlalchemy.ext.asyncio import AsyncSession

from src.llm import get_llm_repository
from src.models import Competitor

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

_MAX_CONCURRENT_FETCHES = 5
_HTTP_TIMEOUT = 15.0  # seconds — big sites (Amazon, eBay) respond slowly past 5s
_MAX_TEXT_CHARS = 1_500
_PRIVATE_CIDRS = [
    "10.",
    "172.16.", "172.17.", "172.18.", "172.19.",
    "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.",
    "172.28.", "172.29.", "172.30.", "172.31.",
    "192.168.",
    "127.",
    "0.",
]

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)

# ── Data classes ─────────────────────────────────────────────────────────────

@dataclass
class ExtractionSignals:
    """Lightweight HTML extraction result."""
    title: str = ""
    title_length: int = 0
    meta_description: str = ""
    meta_description_length: int = 0
    h1_count: int = 0
    h2_count: int = 0
    h1_texts: list[str] = field(default_factory=list)
    h2_texts: list[str] = field(default_factory=list)
    json_ld_present: bool = False
    og_title: str = ""
    og_description: str = ""
    og_image: str = ""
    canonical_present: bool = False
    visible_text: str = ""
    text_length: int = 0


@dataclass
class AuditResult:
    """Final audit result for one competitor."""
    id: int
    url: str
    description: str
    seo_score: int = 0
    geo_score: int = 0
    status: str = "unreachable"
    analyzed_at: Optional[datetime] = None


# ── SSRF Protection ──────────────────────────────────────────────────────────

def _is_safe_url(url: str) -> bool:
    """Basic SSRF protection — only allow public http/https URLs."""
    if not url.startswith(("http://", "https://")):
        return False

    # Extract host
    host = re.sub(r'^https?://', '', url).split('/')[0].split(':')[0]

    # Block private/reserved ranges
    for cidr in _PRIVATE_CIDRS:
        if host.startswith(cidr):
            return False

    # Block localhost variations
    if host in ("localhost", "0.0.0.0", "127.0.0.1", "::1", "localhost.localdomain"):
        return False

    return True


# ── HTTP Fetch ───────────────────────────────────────────────────────────────

async def _fetch_html(session: httpx.AsyncClient, url: str) -> Optional[str]:
    """Fetch HTML content with timeout and SSRF protection.

    Returns the HTML string on success, or None on failure.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    try:
        response = await session.get(
            url,
            follow_redirects=True,
            headers=headers,
            timeout=_HTTP_TIMEOUT,
        )
        response.raise_for_status()
        return response.text
    except httpx.HTTPStatusError as exc:
        # Log the concrete status code (403/429/408…) so failures are diagnosable,
        # e.g. a bot-blocked site vs a genuine timeout.
        status_code = exc.response.status_code if exc.response is not None else None
        logger.warning(f"HTTP {status_code} fetching {url}: {exc}")
        return None
    except httpx.HTTPError as exc:
        logger.warning(f"Network error fetching {url}: {exc}")
        return None
    except Exception as exc:
        logger.warning(f"Unexpected error fetching {url}: {exc}")
        return None


# ── HTML Extraction ─────────────────────────────────────────────────────────

def _extract_signals(html: str) -> ExtractionSignals:
    """Parse HTML and extract lightweight SEO/GEO signals via BeautifulSoup."""
    signals = ExtractionSignals()

    try:
        soup = BeautifulSoup(html, 'html.parser')

        # Title tag
        title_tag = soup.find('title')
        if title_tag and title_tag.string:
            signals.title = title_tag.string.strip()[:300]
            signals.title_length = len(signals.title)

        # Meta description
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if meta_desc and meta_desc.get('content'):
            signals.meta_description = meta_desc['content'].strip()[:500]
            signals.meta_description_length = len(signals.meta_description)

        # Headings
        signals.h1_texts = [
            h1.get_text(strip=True)
            for h1 in soup.find_all('h1')
            if h1.get_text(strip=True)
        ]
        signals.h1_count = len(signals.h1_texts)

        signals.h2_texts = [
            h2.get_text(strip=True)
            for h2 in soup.find_all('h2')
            if h2.get_text(strip=True)
        ]
        signals.h2_count = len(signals.h2_texts)

        # Canonical link
        canonical = soup.find('link', rel='canonical')
        signals.canonical_present = canonical is not None

        # JSON-LD structured data
        json_ld_scripts = soup.find_all(
            'script', type='application/ld+json'
        )
        signals.json_ld_present = len(json_ld_scripts) > 0

        # OpenGraph tags
        og_map = {
            'title': ('property', 'og:title'),
            'description': ('property', 'og:description'),
            'image': ('property', 'og:image'),
        }
        for key, (attr_name, attr_value) in og_map.items():
            og_tag = soup.find('meta', attrs={attr_name: attr_value})
            if og_tag and og_tag.get('content'):
                setattr(signals, f'og_{key}', og_tag['content'].strip()[:300])

        # Visible text (first N characters)
        for tag_name in ['script', 'style', 'noscript', 'nav', 'footer', 'header']:
            for tag in soup.find_all(tag_name):
                tag.decompose()

        raw_text = soup.get_text(separator='\n', strip=True)
        lines = [line for line in raw_text.splitlines() if line.strip()]
        signals.visible_text = '\n'.join(lines)[:_MAX_TEXT_CHARS]
        signals.text_length = len(signals.visible_text)

    except Exception as exc:
        logger.warning(f"Error extracting signals from {html[:100]}...: {exc}")

    return signals


# ── LLM Scoring ─────────────────────────────────────────────────────────────

_SCORE_SYSTEM_PROMPT = """\
You are an expert SEO and GEO analyst. Evaluate web page content and return EXACTLY valid JSON (no markdown fences).

Scoring criteria:
- seo_score (0-100): Based on presence/quality of title tag (< 60 chars bonus), meta description (70-160 ideal), proper H1/H2 structure, canonical link presence, JSON-LD schema.
- geo_score (0-100): Based on JSON-LD structured data graphs, entity-rich content, fact density, Q&A format, direct answers in first 1500 characters.
"""

_SCORE_USER_TEMPLATE = """Evaluate this webpage for SEO and GEO optimization. Return JSON only.

INPUT SIGNALS:
{signals}

Return ONLY this JSON structure:
{{
  "seo_score": <integer 0-100>,
  "geo_score": <integer 0-100>
}}
"""


def _signals_to_string(signals: ExtractionSignals) -> str:
    """Convert extracted signals to a human-readable prompt string."""
    parts = []
    parts.append(f"TITLE: '{signals.title}' ({signals.title_length} chars)")
    parts.append(f"META DESCRIPTION: '{signals.meta_description}' ({signals.meta_description_length} chars)")
    parts.append(f"H1 COUNT: {signals.h1_count}")
    if signals.h1_texts:
        parts.extend([f"  - {t}" for t in signals.h1_texts[:3]])
    parts.append(f"H2 COUNT: {signals.h2_count}")
    if signals.h2_texts:
        parts.extend([f"  - {t}" for t in signals.h2_texts[:3]])
    parts.append(f"CANONICAL PRESENT: {signals.canonical_present}")
    parts.append(f"JSON-LD PRESENT: {signals.json_ld_present}")
    parts.append(f"OG_TITLE: '{signals.og_title}'")
    parts.append(f"OG_DESCRIPTION: '{signals.og_description}'")
    parts.append(f"VISIBLE TEXT ({signals.text_length} chars):\n{signals.visible_text}")
    return '\n'.join(parts)


async def _score_with_llm_async(signals: ExtractionSignals) -> dict:
    """Call LLM synchronously in a thread to avoid blocking the event loop."""
    prompt = _SCORE_USER_TEMPLATE.format(signals=_signals_to_string(signals))
    llm_repo = get_llm_repository()

    def _sync_call():
        return llm_repo.complete_json(prompt, system_prompt=_SCORE_SYSTEM_PROMPT)

    result = await asyncio.to_thread(_sync_call)

    # Normalize result to dict with score keys
    if isinstance(result, dict):
        return {
            'seo_score': min(max(int(result.get('seo_score', 0)), 0), 100),
            'geo_score': min(max(int(result.get('geo_score', 0)), 0), 100),
        }

    # Fallback if result isn't a clean dict
    return {'seo_score': 50, 'geo_score': 50}


# ── Description-Based Fallback ──────────────────────────────────────────────

# Keywords signaling an entity-rich / GEO-friendly description.
_GEO_DESCRIPTION_HINTS = (
    'what is',
    'how to',
    'why',
    'best',
    'top',
    'guide',
    'review',
    'compare',
    'price',
    'cost',
    'benefit',
    'vs',
    'alternative',
    'features',
    'services',
    'product',
    'marketplace',
    'platform',
)


def _description_fallback_score(description: str) -> dict:
    """Estimate SEO/GEO scores purely from the competitor's description text.

    Used when the URL is unreachable or its HTML yields no usable signals (bot
    blocks, SPA shells, timeouts). Keeps the audit useful instead of returning
    a permanent 0/unreachable.
    """
    text = (description or '').lower()
    word_count = len(text.split())

    # SEO heuristic from description richness.
    seo_score = 40
    if word_count >= 12:
        seo_score += 10
    if len(description) >= 80:
        seo_score += 10
    if any(kw in text for kw in ('product', 'service', 'marketplace', 'platform', 'store', 'online')):
        seo_score += 10
    if word_count >= 25:
        seo_score += 10

    # GEO heuristic from entity/descriptive hints.
    geo_score = 35
    hits = sum(1 for hint in _GEO_DESCRIPTION_HINTS if hint in text)
    geo_score += min(hits * 5, 20)
    if word_count >= 15:
        geo_score += 5
    if len(description) >= 100:
        geo_score += 5

    return {
        'seo_score': min(seo_score, 100),
        'geo_score': min(geo_score, 100),
    }


# ── Deterministic Fallback ──────────────────────────────────────────────────

def _deterministic_fallback_score(signals: ExtractionSignals) -> dict:
    """Quick heuristic scoring when LLM fails."""
    seo_score = 0
    geo_score = 0

    # SEO scoring (max 60 points)
    if signals.title:
        seo_score += 15
        if 40 <= signals.title_length <= 60:
            seo_score += 10
    if signals.meta_description:
        seo_score += 15
        if 100 <= signals.meta_description_length <= 160:
            seo_score += 10
    if signals.h1_count >= 1:
        seo_score += 10
    if signals.canonical_present:
        seo_score += 5
    if signals.json_ld_present:
        seo_score += 5

    # GEO scoring (max 40 points)
    if signals.json_ld_present:
        geo_score += 15
    if signals.visible_text and signals.text_length >= 200:
        word_count = len(signals.visible_text.split())
        if word_count >= 100:
            geo_score += 10
    if any(q in signals.visible_text.lower() for q in ['what is', 'how to', 'why does', 'benefit']):
        geo_score += 5
    if signals.og_title and signals.og_description:
        geo_score += 10

    return {
        'seo_score': min(seo_score, 100),
        'geo_score': min(geo_score, 100),
    }


# ── Single Competitor Audit ─────────────────────────────────────────────────

async def _audit_single_competitor(
    competitor: Competitor,
    semaphore: asyncio.Semaphore,
) -> AuditResult:
    """Fetch, extract signals, score, and return result for one competitor."""
    async with semaphore:
        result = AuditResult(
            id=competitor.id,
            url=competitor.url,
            description=competitor.description,
        )

        # Validate URL
        if not _is_safe_url(competitor.url):
            logger.warning(f"URL blocked by SSRF filter: {competitor.url}")
            return result

        # Fetch HTML
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT, follow_redirects=True) as session:
            html = await _fetch_html(session, competitor.url)

        # If the page is unreachable (bot block, Cloudflare, timeout), fall back to
        # scoring from the description so the competitor still gets a useful estimate.
        if html is None:
            fallback = _description_fallback_score(competitor.description)
            result.seo_score = fallback['seo_score']
            result.geo_score = fallback['geo_score']
            result.status = "unreachable"
            result.analyzed_at = datetime.now(timezone.utc)
            logger.warning(
                f"Unreachable {competitor.url}, scored from description "
                f"(seo={fallback['seo_score']}, geo={fallback['geo_score']})"
            )
            return result

        # Extract signals
        signals = _extract_signals(html)

        # If the extracted HTML is a barren shell (SPA without SSR, JS-only page),
        # fall back to the description rather than reporting a misleading 0.
        if not signals.title and not signals.meta_description and not signals.visible_text:
            fallback = _description_fallback_score(competitor.description)
            result.seo_score = fallback['seo_score']
            result.geo_score = fallback['geo_score']
            result.status = "analyzed"
            result.analyzed_at = datetime.now(timezone.utc)
            logger.warning(
                f"Empty HTML shell for {competitor.url}, scored from description "
                f"(seo={fallback['seo_score']}, geo={fallback['geo_score']})"
            )
            return result

        # Score with LLM
        try:
            scores = await _score_with_llm_async(signals)
        except Exception as exc:
            logger.error(f"LLM scoring failed for {competitor.url}: {exc}")
            scores = _deterministic_fallback_score(signals)

        result.seo_score = scores['seo_score']
        result.geo_score = scores['geo_score']
        result.status = "analyzed"
        result.analyzed_at = datetime.now(timezone.utc)

        return result


# ── Main Audit Function ─────────────────────────────────────────────────────

async def run_audit(
    project_id: int,
    session: AsyncSession,
    max_concurrent: int = _MAX_CONCURRENT_FETCHES,
) -> list[AuditResult]:
    """Execute a lightweight SEO/GEO audit for all competitors of a project.

    Args:
        project_id: The project whose competitors should be audited.
        session: Async SQLAlchemy session for DB access.
        max_concurrent: Max number of concurrent HTTP fetches.

    Returns:
        List of AuditResult objects (also persisted to the DB).
    """
    from src.services.project_service import ProjectService

    service = ProjectService(session)

    try:
        project = await service.get(project_id)
    except ValueError:
        raise ValueError(f'Project with id {project_id} not found')

    competitors = project.competitors
    if not competitors:
        logger.info(f"No competitors found for project {project_id}")
        return []

    semaphore = asyncio.Semaphore(max_concurrent)

    # Run audits concurrently
    tasks = [
        _audit_single_competitor(comp, semaphore)
        for comp in competitors
    ]
    audit_results = await asyncio.gather(*tasks, return_exceptions=True)

    # Process results and persist to DB
    saved_results: list[AuditResult] = []
    for i, task_result in enumerate(audit_results):
        comp = competitors[i]
        if isinstance(task_result, Exception):
            logger.error(f"Competitor audit failed for {comp.url}: {task_result}")
            continue

        if not isinstance(task_result, AuditResult):
            continue

        # Persist to DB
        comp.seo_score = task_result.seo_score
        comp.geo_score = task_result.geo_score
        comp.status = task_result.status
        comp.analyzed_at = task_result.analyzed_at
        saved_results.append(task_result)

    # Single commit for all updates
    await session.commit()

    logger.info(
        f"Audit complete for project {project_id}: "
        f"{len(saved_results)}/{len(competitors)} competitors analyzed"
    )

    return saved_results