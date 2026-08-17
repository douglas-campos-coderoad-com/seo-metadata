"""
LangGraph nodes for the SEO/GEO/AEO Analyzer.

Nodes:
  1. parse_html  - Extract structured data from HTML (no LLM)
  2. analyze_seo_geo - Evaluate SEO + GEO scores via Gemini
  3. generate_json_ld - Generate JSON-LD Knowledge Graph via Gemini
  4. compile_report - Consolidate results into final report
"""
import json
import logging
import os
from typing import Any, Optional

from bs4 import BeautifulSoup
from pydantic import ValidationError

from src.schemas.analysis import FindingItem

logger = logging.getLogger(__name__)

# ── Gemini setup ──────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
GEMINI_MODEL_FALLBACK = os.getenv('GEMINI_MODEL_FALLBACK', 'gemini-3.6-flash')


def _get_llm():
    """Return a configured ChatGoogleGenerativeAI instance."""
    from langchain_google_genai import ChatGoogleGenerativeAI

    return ChatGoogleGenerativeAI(
        model=GEMINI_MODEL,
        google_api_key=GEMINI_API_KEY,
        temperature=0.2,
        max_retries=2,
    )


def _call_gemini(prompt: str, response_format: str = 'json') -> Any:
    """Call Gemini with the given prompt and return parsed JSON response."""
    try:
        llm = _get_llm()
        if response_format == 'json':
            from langchain_core.messages import HumanMessage, SystemMessage

            messages = [
                SystemMessage(
                    content='You are a precise SEO/GEO analyst. Always respond with valid JSON.'
                ),
                HumanMessage(content=prompt),
            ]
            response = llm.invoke(messages)
            content = response.content.strip()
            # Strip markdown code fences if present
            if content.startswith('```'):
                content = content.split('\n', 1)[1]
                content = content.rsplit('```', 1)[0]
            return json.loads(content)
        else:
            response = llm.invoke(prompt)
            return response.content
    except Exception as exc:
        logger.warning(f'Gemini call failed with {GEMINI_MODEL}: {exc}')
        # Fallback to second model
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI

            llm = ChatGoogleGenerativeAI(
                model=GEMINI_MODEL_FALLBACK,
                google_api_key=GEMINI_API_KEY,
                temperature=0.2,
                max_retries=2,
            )
            from langchain_core.messages import HumanMessage, SystemMessage

            messages = [
                SystemMessage(
                    content='You are a precise SEO/GEO analyst. Always respond with valid JSON.'
                ),
                HumanMessage(content=prompt),
            ]
            response = llm.invoke(messages)
            content = response.content.strip()
            if content.startswith('```'):
                content = content.split('\n', 1)[1]
                content = content.rsplit('```', 1)[0]
            return json.loads(content)
        except Exception as fallback_exc:
            logger.error(f'Gemini fallback also failed: {fallback_exc}')
            raise


# ── Node 1: parse_html ────────────────────────────────────────────────────


def parse_html(state: dict) -> dict:
    """
    Extract structured data from raw HTML using BeautifulSoup.

    Returns a dict with keys: title, meta_description, meta_keywords, canonical,
    og_tags, twitter_tags, headings, images, links, json_ld, visible_text, robots,
    viewport, lang, has_favicon, raw_text_length
    """
    html = state.get('html', '')
    if not html:
        return {'page_data': {}, 'parse_error': 'No HTML provided'}

    soup = BeautifulSoup(html, 'html.parser')

    # ── Title ──
    title_tag = soup.find('title')
    title = title_tag.get_text(strip=True) if title_tag else None

    # ── Meta tags ──
    meta_description = None
    meta_keywords = None
    canonical = None
    robots = None
    viewport = None

    for meta in soup.find_all('meta'):
        name = (meta.get('name') or '').lower()
        prop = (meta.get('property') or '').lower()
        content = meta.get('content', '')

        if name == 'description':
            meta_description = content
        elif name == 'keywords':
            meta_keywords = content
        elif name == 'robots':
            robots = content
        elif name == 'viewport':
            viewport = content

    # Canonical link
    link_canonical = soup.find('link', rel='canonical')
    if link_canonical:
        canonical = link_canonical.get('href')

    # ── OpenGraph tags ──
    og_tags = {}
    for meta in soup.find_all('meta'):
        prop = meta.get('property', '')
        if prop.startswith('og:'):
            og_tags[prop] = meta.get('content', '')

    # ── Twitter card tags ──
    twitter_tags = {}
    for meta in soup.find_all('meta'):
        name = meta.get('name', '')
        if name.startswith('twitter:'):
            twitter_tags[name] = meta.get('content', '')

    # ── Headings ──
    headings = {}
    for level in range(1, 7):
        tags = soup.find_all(f'h{level}')
        if tags:
            headings[f'h{level}'] = [h.get_text(strip=True) for h in tags if h.get_text(strip=True)]

    # ── Images with alt text ──
    images = []
    for img in soup.find_all('img'):
        src = img.get('src', '')
        alt = img.get('alt', '')
        if src:
            images.append({'src': src, 'alt': alt, 'has_alt': bool(alt)})

    images_with_alt = sum(1 for img in images if img['has_alt'])
    images_without_alt = sum(1 for img in images if not img['has_alt'])

    # ── Links ──
    links = {'internal': 0, 'external': 0, 'nofollow': 0, 'total': 0}
    for a_tag in soup.find_all('a', href=True):
        href = a_tag['href']
        links['total'] += 1
        if href.startswith('http') or href.startswith('//'):
            links['external'] += 1
        else:
            links['internal'] += 1
        rel = a_tag.get('rel', [])
        if 'nofollow' in rel:
            links['nofollow'] += 1

    # ── Existing JSON-LD ──
    json_ld_data = []
    for script in soup.find_all('script', type='application/ld+json'):
        try:
            data = json.loads(script.string)
            json_ld_data.append(data)
        except (json.JSONDecodeError, TypeError):
            pass

    # ── Visible text (first 5000 chars) ──
    for tag in soup(['script', 'style', 'noscript', 'iframe', 'svg']):
        tag.decompose()
    visible_text = soup.get_text(separator=' ', strip=True)
    visible_text_preview = visible_text[:5000]

    # ── Language ──
    html_tag = soup.find('html')
    lang = html_tag.get('lang', '') if html_tag else ''

    # ── Favicon ──
    favicon = soup.find('link', rel=lambda v: v and 'icon' in v.lower()) if soup.find else None
    has_favicon = favicon is not None

    page_data = {
        'title': title,
        'meta_description': meta_description,
        'meta_keywords': meta_keywords,
        'canonical': canonical,
        'og_tags': og_tags,
        'twitter_tags': twitter_tags,
        'headings': headings,
        'images_total': len(images),
        'images_with_alt': images_with_alt,
        'images_without_alt': images_without_alt,
        'links': links,
        'json_ld': json_ld_data,
        'visible_text_preview': visible_text_preview,
        'visible_text_length': len(visible_text),
        'robots': robots,
        'viewport': viewport,
        'lang': lang,
        'has_favicon': has_favicon,
        'raw_html_length': len(html),
    }

    return {'page_data': page_data, 'parse_error': None}


# ── Node 2: analyze_seo_geo ──────────────────────────────────────────────


SEO_GEO_PROMPT = """You are an expert in traditional SEO and GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization).

Analyze the following web page and return a JSON with scores, findings and recommendations.

PAGE DATA:
- Title: {title}
- Meta description: {meta_description}
- Meta keywords: {meta_keywords}
- Canonical: {canonical}
- OpenGraph tags: {og_tags}
- Twitter tags: {twitter_tags}
- Headings: {headings}
- Total images: {images_total} (with alt: {images_with_alt}, without alt: {images_without_alt})
- Links: {links}
- Existing JSON-LD: {json_ld}
- Language: {lang}
- Robots meta: {robots}
- Viewport: {viewport}
- Has favicon: {has_favicon}
- Visible text length: {visible_text_length} characters

FIRST 1000 CHARACTERS OF VISIBLE TEXT:
{visible_text_preview}

EVALUATION RULES:

1. SEO Score (0-100):
   - Title: should be 50-60 characters, include primary keyword (15 pts)
   - Meta description: should be 150-160 characters, include keyword and call-to-action (15 pts)
   - Headings: correct hierarchical structure (single h1, hierarchical h2-h6) (10 pts)
   - Images: all should have descriptive alt text (10 pts)
   - OpenGraph / Twitter Cards: present and complete (10 pts)
   - JSON-LD structured data: present (15 pts)
   - Canonical URL: present (5 pts)
   - Robots meta: should not block indexing (5 pts)
   - Perceived speed: optimized viewport, favicon present (5 pts)
   - Content: relevant and sufficient text (>300 chars) (10 pts)

2. GEO/AEO Score (0-100):
   - Does the content answer direct questions a user would ask? (20 pts)
   - Does it use natural and conversational language? (15 pts)
   - Does it provide complete and actionable answers? (20 pts)
   - Does it have structured JSON-LD data that an LLM can parse? (20 pts)
   - Are the title and meta description "citable" by an LLM? (15 pts)
   - Is the page optimized for featured snippets / AI Overviews? (10 pts)

FINDINGS:
Produce one object per notable issue or strength you observe (aim for 5-10). Each finding must be
self-contained: its "suggestion" is the specific fix for that finding, not a separate general tip list.

- "severity": one of "critical" (missing or actively harmful), "warning" (present but suboptimal),
  "good" (a genuine strength worth calling out — include at least one if the page does something well)
- "category": one of "meta-tags" (title, meta description, OG/Twitter tags, canonical),
  "content" (headings, answer-directness, citability, text quality), "html-structure" (JSON-LD,
  viewport, robots, favicon), "file-size" (image alt coverage, page weight)
- "title": short label for the issue, e.g. "Meta description missing"
- "description": 1-2 sentences on what you observed and why it matters
- "suggestion": the specific, actionable fix for this finding
- "is_missing": true only if the underlying element is fully absent from the page (not just weak)
- "metric_value": a short measured value if relevant, e.g. "62 characters", "3 of 5 images", else null
- "code_snippet": a ready-to-use HTML/meta snippet if the fix is a concrete tag, else null

Return EXACTLY this JSON (without markdown):
{{
  "seo_score": <int 0-100>,
  "geo_score": <int 0-100>,
  "findings": [
    {{
      "severity": "critical" | "warning" | "good",
      "category": "meta-tags" | "content" | "html-structure" | "file-size",
      "title": "<short label>",
      "description": "<1-2 sentences>",
      "suggestion": "<specific fix>",
      "is_missing": <bool>,
      "metric_value": "<string>" | null,
      "code_snippet": "<string>" | null
    }},
    ...
  ],
  "geo_visibility": "<2-3 sentence explanatory text on how visible the content is for generative AI>",
  "seo_breakdown": {{
    "title": <int 0-15>,
    "meta_description": <int 0-15>,
    "headings": <int 0-10>,
    "images_alt": <int 0-10>,
    "opengraph": <int 0-10>,
    "json_ld": <int 0-15>,
    "canonical": <int 0-5>,
    "robots": <int 0-5>,
    "performance": <int 0-5>,
    "content": <int 0-10>
  }},
  "geo_breakdown": {{
    "question_answering": <int 0-20>,
    "natural_language": <int 0-15>,
    "completeness": <int 0-20>,
    "structured_data": <int 0-20>,
    "llm_citability": <int 0-15>,
    "featured_snippet": <int 0-10>
  }}
}}
"""


def analyze_seo_geo(state: dict) -> dict:
    """
    Use Gemini to evaluate SEO and GEO scores based on parsed page data.
    """
    page_data = state.get('page_data', {})
    if not page_data:
        return {'seo_geo_error': 'No page data available'}

    prompt = SEO_GEO_PROMPT.format(
        title=page_data.get('title', 'N/A'),
        meta_description=page_data.get('meta_description', 'N/A'),
        meta_keywords=page_data.get('meta_keywords', 'N/A'),
        canonical=page_data.get('canonical', 'N/A'),
        og_tags=json.dumps(page_data.get('og_tags', {}), ensure_ascii=False),
        twitter_tags=json.dumps(page_data.get('twitter_tags', {}), ensure_ascii=False),
        headings=json.dumps(page_data.get('headings', {}), ensure_ascii=False),
        images_total=page_data.get('images_total', 0),
        images_with_alt=page_data.get('images_with_alt', 0),
        images_without_alt=page_data.get('images_without_alt', 0),
        links=json.dumps(page_data.get('links', {}), ensure_ascii=False),
        json_ld=json.dumps(page_data.get('json_ld', []), ensure_ascii=False),
        lang=page_data.get('lang', 'N/A'),
        robots=page_data.get('robots', 'N/A'),
        viewport=page_data.get('viewport', 'N/A'),
        has_favicon=page_data.get('has_favicon', False),
        visible_text_length=page_data.get('visible_text_length', 0),
        visible_text_preview=(page_data.get('visible_text_preview', '')[:1000]),
    )

    try:
        result = _call_gemini(prompt, response_format='json')
        seo_score = result.get('seo_score', 0)
        geo_score = result.get('geo_score', 0)

        # Clamp scores to 0-100
        seo_score = max(0, min(100, seo_score))
        geo_score = max(0, min(100, geo_score))

        return {
            'seo_score': seo_score,
            'geo_score': geo_score,
            'findings': _validate_findings(result.get('findings', [])),
            'geo_visibility': result.get('geo_visibility', ''),
            'seo_breakdown': result.get('seo_breakdown', {}),
            'geo_breakdown': result.get('geo_breakdown', {}),
            'seo_geo_error': None,
        }
    except Exception as exc:
        logger.error(f'analyze_seo_geo failed: {exc}')
        return {
            'seo_score': 0,
            'geo_score': 0,
            'findings': [_error_finding(str(exc))],
            'geo_visibility': 'Could not complete the analysis',
            'seo_breakdown': {},
            'geo_breakdown': {},
            'seo_geo_error': str(exc),
        }


def _validate_findings(raw_findings: list) -> list:
    """Validate Gemini's findings against FindingItem, dropping malformed entries."""
    validated = []
    for item in raw_findings:
        try:
            validated.append(FindingItem.model_validate(item).model_dump())
        except ValidationError as exc:
            logger.warning(f'Dropping malformed finding from Gemini: {exc}')
    return validated


def _error_finding(message: str) -> dict:
    """A single well-formed finding describing an analysis failure."""
    return FindingItem(
        severity='critical',
        category='content',
        title='Analysis failed',
        description=f'Error during analysis: {message}',
        suggestion='Retry the analysis later',
        is_missing=False,
        metric_value=None,
        code_snippet=None,
    ).model_dump()


# ── Node 3: generate_json_ld ──────────────────────────────────────────────


JSON_LD_PROMPT = """You are an expert in schema.org structured data and Knowledge Graphs.

Based on the following web page content, generate a rich JSON-LD Knowledge Graph that semantically represents the page content.

PAGE DATA:
- Title: {title}
- Meta description: {meta_description}
- Headings: {headings}
- Existing JSON-LD (if any): {existing_json_ld}
- Visible text: {visible_text}

RULES:
1. Identify the main page type (Product, Article, WebPage, ItemPage, etc.)
2. Generate rich semantic relationships:
   - If it is a product: manufacturer/creator, material, dimensions, color, style, SKU, offers, reviews, category
   - If it is an article: author, publication date, publisher, about
   - Always include: breadcrumb, website, publisher/organization
3. Use standard schema.org URIs
4. The JSON-LD must be valid and complete
5. If there is not enough information for a field, use null

Return EXACTLY this JSON (without markdown, without decoration):
{{
  "@context": "https://schema.org",
  "@graph": [
    {{
      "@type": "WebPage",
      ...
    }},
    ...
  ]
}}

Generate the most complete JSON-LD possible based on the available information.
"""


def generate_json_ld(state: dict) -> dict:
    """
    Use Gemini to generate a JSON-LD Knowledge Graph from page data.
    """
    page_data = state.get('page_data', {})
    if not page_data:
        return {'json_ld': None, 'json_ld_error': 'No page data available'}

    visible_text = (page_data.get('visible_text_preview', '') or '')[:3000]
    existing_json_ld = json.dumps(page_data.get('json_ld', []), ensure_ascii=False)

    prompt = JSON_LD_PROMPT.format(
        title=page_data.get('title', 'N/A'),
        meta_description=page_data.get('meta_description', 'N/A'),
        headings=json.dumps(page_data.get('headings', {}), ensure_ascii=False),
        existing_json_ld=existing_json_ld,
        visible_text=visible_text,
    )

    try:
        result = _call_gemini(prompt, response_format='json')
        return {'json_ld': result, 'json_ld_error': None}
    except Exception as exc:
        logger.error(f'generate_json_ld failed: {exc}')
        return {'json_ld': None, 'json_ld_error': str(exc)}


# ── Node 4: compile_report ────────────────────────────────────────────────


def compile_report(state: dict) -> dict:
    """
    Consolidate all analysis results into the final report.
    Computes overall_score = average of seo_score and geo_score.
    """
    seo_score = state.get('seo_score', 0) or 0
    geo_score = state.get('geo_score', 0) or 0
    overall_score = (seo_score + geo_score) // 2

    findings = state.get('findings', [])
    geo_visibility = state.get('geo_visibility', '')
    seo_breakdown = state.get('seo_breakdown', {})
    geo_breakdown = state.get('geo_breakdown', {})
    json_ld = state.get('json_ld')
    parse_error = state.get('parse_error')
    seo_geo_error = state.get('seo_geo_error')
    json_ld_error = state.get('json_ld_error')

    errors = [e for e in [parse_error, seo_geo_error, json_ld_error] if e]

    analysis = {
        'findings': findings,
        'geo_visibility': geo_visibility,
        'seo_breakdown': seo_breakdown,
        'geo_breakdown': geo_breakdown,
        'errors': errors,
    }

    return {
        'seo_score': seo_score,
        'geo_score': geo_score,
        'overall_score': overall_score,
        'analysis': analysis,
        'json_ld': json_ld,
        'status': 'completed' if not errors else 'failed',
        'error': errors[0] if errors else None,
    }