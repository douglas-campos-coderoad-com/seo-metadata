"""
LangGraph nodes for the SEO/GEO/AEO Analyzer.

Nodes:
  1. parse_html  - Extract structured data from HTML (no LLM)
  2. analyze_seo_geo - Evaluate SEO + GEO scores via the configured LLM
  3. generate_json_ld - Generate JSON-LD Knowledge Graph via the configured LLM
  4. compile_report - Consolidate results into final report

The LLM is reached through the src.llm repository, so the provider (Gemini,
Anthropic, ...) is a configuration choice and these nodes see the same output
whichever model answers.
"""
import json
import logging
from typing import Any

from bs4 import BeautifulSoup

from src.llm import get_llm_repository

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = 'You are a precise SEO/GEO analyst. Always respond with valid JSON.'


def _call_llm(prompt: str, response_format: str = 'json') -> Any:
    """Call the configured LLM and return the parsed JSON response."""
    repository = get_llm_repository()
    if response_format == 'json':
        return repository.complete_json(prompt, system_prompt=SYSTEM_PROMPT)
    return repository.complete_text(prompt)


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

SEO_GEO_PROMPT= """You are an expert in traditional SEO and in GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization). You audit a single web page and return a strict, machine-consumable JSON report. Your recommendations must be concrete enough that a developer can apply the exact HTML changes without further interpretation.

## INPUT — PAGE DATA
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
- First 1000 chars of visible text:
{visible_text_preview}

## ANALYSIS PROCEDURE (follow in order)
1. Infer the page's PRIMARY TOPIC and 1 primary + up to 3 secondary keywords from the title, headings, and visible text. Any input that is empty, null, "None", or "[]" MUST be treated as MISSING and scored as 0 for its dimension — never assume a value.
2. Score every dimension using the rubric below. Award PARTIAL credit proportional to how well the criterion is met (e.g. a 45-char title that includes the keyword is a near-miss, not a zero). State the observed evidence for each finding.
3. Produce findings, each mapped to exactly one scoring dimension and one category.
4. For every finding whose status is "warning" or "fail", produce a matching recommendation that includes the exact HTML change required — most findings should have exactly one. It is fine to leave a rare, low-impact finding without one. If a finding genuinely needs more than one distinct fix, emit multiple recommendations that share its finding_id rather than combining them into one.
5. Verify that seo_breakdown values sum to seo_score and geo_breakdown values sum to geo_score. Clamp all scores to their allowed ranges before returning.

## SEO RUBRIC (0-100)
- title (0-15): 50-60 chars, contains primary keyword, unique/descriptive.
- meta_description (0-15): 150-160 chars, contains keyword + clear call-to-action.
- headings (0-10): exactly one h1, no skipped levels, keyword-relevant.
- images_alt (0-10): proportional to (images_with_alt / images_total); descriptive, not filename-like.
- opengraph (0-10): og:title, og:description, og:image, og:url, og:type present; Twitter card present.
- json_ld (0-15): valid JSON-LD present and matches the page's content type (Article, Product, FAQ, etc.).
- canonical (0-5): present and self-referential/absolute.
- robots (0-5): does not contain noindex/nofollow that would block indexing.
- performance (0-5): responsive viewport set + favicon present.
- content (0-10): >300 chars of relevant text; scale down below that threshold.

## GEO / AEO RUBRIC (0-100)
- question_answering (0-20): content directly answers concrete questions a user would ask.
- natural_language (0-15): natural, conversational, entity-rich phrasing.
- completeness (0-20): answers are complete and actionable, not teaser fragments.
- structured_data (0-20): JSON-LD an LLM can parse and cite (FAQPage, HowTo, Article, etc.).
- llm_citability (0-15): title + meta description are self-contained, factual, quotable.
- featured_snippet (0-10): content is formatted for snippets / AI Overviews (definitions, lists, direct answers up top).

## ALLOWED ENUM VALUES
- category: "metadata" | "content" | "headings" | "images" | "structured_data" | "social" | "crawlability" | "performance" | "geo_aeo"
- severity: "critical" | "high" | "medium" | "low"
- status: "pass" | "warning" | "fail"
- impact: "seo" | "geo" | "both"
- priority: "high" | "medium" | "low"
- effort: "low" | "medium" | "high"
- change_type: "add" | "modify" | "remove"

## OUTPUT
Return EXACTLY the following JSON and nothing else. No markdown, no code fences, no commentary. Every recommendation MUST reference the id of the finding it resolves and MUST include an html_change object with copy-paste-ready markup. If nothing needs changing for a criterion, emit a finding with status "pass" and no recommendation. Most findings should have exactly one matching recommendation; it is fine to leave a rare, low-impact finding without one, and fine to give a finding multiple recommendations (sharing its finding_id) when there are genuinely separate fixes.

{{
  "seo_score": <int 0-100>,
  "geo_score": <int 0-100>,
  "primary_keyword": "<inferred primary keyword>",
  "secondary_keywords": ["<keyword>", ...],
  "geo_visibility": "<2-3 sentences on how visible/citable this page is to generative AI engines and why>",
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
  }},
  "findings": [
    {{
      "id": "F1",
      "category": "<category enum>",
      "dimension": "<scoring key this maps to, e.g. 'title' or 'structured_data'>",
      "impact": "<impact enum>",
      "severity": "<severity enum>",
      "status": "<status enum>",
      "title": "<short finding title>",
      "detail": "<what was observed, with the concrete evidence, e.g. 'Title is 34 chars and omits the primary keyword'>"
    }}
  ],
  "recommendations": [
    {{
      "id": "R1",
      "finding_id": "<id of the finding this resolves, e.g. 'F1'>",
      "category": "<category enum>",
      "priority": "<priority enum>",
      "effort": "<effort enum>",
      "impact": "<impact enum>",
      "action": "<what to do, in one sentence>",
      "rationale": "<why it improves SEO and/or GEO/AEO>",
      "html_change": {{
        "change_type": "<change_type enum>",
        "location": "<where in the document, e.g. 'inside <head>', 'the single <h1>', 'the <img> for hero.jpg'>",
        "current_html": "<the exact current markup, or empty string if it does not exist yet>",
        "suggested_html": "<the exact markup to add or replace it with>"
      }}
    }}
  ]
}}
"""
# SEO_GEO_PROMPT = """You are an expert in traditional SEO and GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization).

# Analyze the following web page and return a JSON with scores, findings and recommendations.

# PAGE DATA:
# - Title: {title}
# - Meta description: {meta_description}
# - Meta keywords: {meta_keywords}
# - Canonical: {canonical}
# - OpenGraph tags: {og_tags}
# - Twitter tags: {twitter_tags}
# - Headings: {headings}
# - Total images: {images_total} (with alt: {images_with_alt}, without alt: {images_without_alt})
# - Links: {links}
# - Existing JSON-LD: {json_ld}
# - Language: {lang}
# - Robots meta: {robots}
# - Viewport: {viewport}
# - Has favicon: {has_favicon}
# - Visible text length: {visible_text_length} characters

# FIRST 1000 CHARACTERS OF VISIBLE TEXT:
# {visible_text_preview}

# EVALUATION RULES:

# 1. SEO Score (0-100):
#    - Title: should be 50-60 characters, include primary keyword (15 pts)
#    - Meta description: should be 150-160 characters, include keyword and call-to-action (15 pts)
#    - Headings: correct hierarchical structure (single h1, hierarchical h2-h6) (10 pts)
#    - Images: all should have descriptive alt text (10 pts)
#    - OpenGraph / Twitter Cards: present and complete (10 pts)
#    - JSON-LD structured data: present (15 pts)
#    - Canonical URL: present (5 pts)
#    - Robots meta: should not block indexing (5 pts)
#    - Perceived speed: optimized viewport, favicon present (5 pts)
#    - Content: relevant and sufficient text (>300 chars) (10 pts)

# 2. GEO/AEO Score (0-100):
#    - Does the content answer direct questions a user would ask? (20 pts)
#    - Does it use natural and conversational language? (15 pts)
#    - Does it provide complete and actionable answers? (20 pts)
#    - Does it have structured JSON-LD data that an LLM can parse? (20 pts)
#    - Are the title and meta description "citable" by an LLM? (15 pts)
#    - Is the page optimized for featured snippets / AI Overviews? (10 pts)

# Return EXACTLY this JSON (without markdown):
# {{
#   "seo_score": <int 0-100>,
#   "geo_score": <int 0-100>,
#   "findings": ["<finding 1>", "<finding 2>", ...],
#   "recommendations": ["<recommendation 1>", "<recommendation 2>", ...],
#   "geo_visibility": "<2-3 sentence explanatory text on how visible the content is for generative AI>",
#   "seo_breakdown": {{
#     "title": <int 0-15>,
#     "meta_description": <int 0-15>,
#     "headings": <int 0-10>,
#     "images_alt": <int 0-10>,
#     "opengraph": <int 0-10>,
#     "json_ld": <int 0-15>,
#     "canonical": <int 0-5>,
#     "robots": <int 0-5>,
#     "performance": <int 0-5>,
#     "content": <int 0-10>
#   }},
#   "geo_breakdown": {{
#     "question_answering": <int 0-20>,
#     "natural_language": <int 0-15>,
#     "completeness": <int 0-20>,
#     "structured_data": <int 0-20>,
#     "llm_citability": <int 0-15>,
#     "featured_snippet": <int 0-10>
#   }}
# }}
# """


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
        result = _call_llm(prompt, response_format='json')
        seo_score = result.get('seo_score', 0)
        geo_score = result.get('geo_score', 0)

        # Clamp scores to 0-100
        seo_score = max(0, min(100, seo_score))
        geo_score = max(0, min(100, geo_score))

        return {
            'seo_score': seo_score,
            'geo_score': geo_score,
            'findings': result.get('findings', []),
            'recommendations': result.get('recommendations', []),
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
            'recommendations': [],
            'geo_visibility': 'Could not complete the analysis',
            'seo_breakdown': {},
            'geo_breakdown': {},
            'seo_geo_error': str(exc),
        }


def _error_finding(message: str) -> dict:
    """A plain finding dict in the analyser's raw shape describing an analysis
    failure. Consumers (report_mappings.collapse_severity/normalise_category,
    AnalysisApiService.mapSeverity/mapCategory) coerce raw shapes like this one —
    nothing here needs to validate against a strict schema."""
    return {
        'id': 'F1',
        'category': 'content',
        'dimension': None,
        'impact': 'both',
        'severity': 'critical',
        'status': 'fail',
        'title': 'Analysis failed',
        'detail': f'Error during analysis: {message}',
    }


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
        result = _call_llm(prompt, response_format='json')
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
    recommendations = state.get('recommendations', [])
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
        'recommendations': recommendations,
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