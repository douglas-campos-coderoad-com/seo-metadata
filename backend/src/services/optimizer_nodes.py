"""
LangGraph nodes for the SEO/GEO/AEO Optimizer.

Nodes:
  1. read_analysis - Load analysis + original HTML
  2. search_web - Serper API web search for best practices
  3. plan_changes - The configured LLM plans prioritized changes
  4. apply_changes - The configured LLM applies changes (HTML, JSON-LD, content)
  5. compile_optimization - Consolidate final report

The LLM is reached through the src.llm repository, so the provider (Gemini,
Anthropic, ...) is a configuration choice and these nodes see the same output
whichever model answers.
"""
import json
import logging
import os
from typing import Any, Optional

import httpx

from src.llm import get_llm_repository
from src.services.graph_nodes import _clean_html_for_llm

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = 'You are a precise SEO/GEO/AEO optimizer. Always respond with valid JSON.'

# ── Serper setup ──────────────────────────────────────────────────────────
SERPER_API_KEY = os.getenv('SERPER_API_KEY', '')
SERPER_ENDPOINT = 'https://google.serper.dev/search'


def _call_llm(prompt: str, response_format: str = 'json') -> Any:
    """Call the configured LLM and return the parsed JSON response."""
    repository = get_llm_repository()
    if response_format == 'json':
        return repository.complete_json(prompt, system_prompt=SYSTEM_PROMPT)
    return repository.complete_text(prompt)


def search_web(query: str) -> dict:
    """Perform a web search using Serper API."""
    if not SERPER_API_KEY:
        return {'organic': [], 'error': 'SERPER_API_KEY not configured'}

    try:
        headers = {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json',
        }
        payload = {'q': query, 'num': 5}

        response = httpx.post(SERPER_ENDPOINT, json=payload, headers=headers, timeout=15)
        if response.status_code != 200:
            return {'organic': [], 'error': f'Serper error {response.status_code}'}

        data = response.json()
        results = []
        for item in data.get('organic', [])[:5]:
            results.append({
                'title': item.get('title', ''),
                'link': item.get('link', ''),
                'snippet': item.get('snippet', ''),
            })
        return {'organic': results, 'error': None}
    except Exception as exc:
        return {'organic': [], 'error': f'Serper error: {exc}'}


# ── Node 1: read_analysis ─────────────────────────────────────────────────


def read_analysis(state: dict) -> dict:
    """
    Load the analysis and original HTML from the state.

    The analysis and HTML are passed in via the initial state.
    """
    analysis = state.get('analysis', {})
    html = state.get('html', '')
    url = state.get('url', '')

    if not analysis or not html:
        return {'read_error': 'Missing analysis or HTML'}

    return {
        'analysis': analysis,
        'html': html,
        'url': url,
        'read_error': None,
    }


# ── Node 2: search_web ────────────────────────────────────────────────────


def search_web_node(state: dict) -> dict:
    """
    Search the web for SEO/GEO best practices relevant to the page.
    """
    url = state.get('url', '')
    analysis = state.get('analysis', {})

    # Determine page type from analysis
    page_type = 'Product'
    json_ld = analysis.get('json_ld') or {}
    if isinstance(json_ld, dict):
        page_type = json_ld.get('@type', 'Product')

    query = f'seo geo aeo best practices {page_type} page schema.org 2025'

    results = search_web(query)
    search_results = results.get('organic', [])

    # If Serper fails, provide fallback context
    if not search_results:
        search_context = (
            'No search results available. Use general SEO/GEO/AEO best practices: '
            'structured data, meta tags, heading hierarchy, alt texts, '
            'conversational content, question-answering format.'
        )
        return {'search_context': search_context, 'search_error': 'SERPER_API_KEY not configured'}
    else:
        search_context = json.dumps(search_results, ensure_ascii=False, indent=2)

    return {
        'search_context': search_context,
        'search_error': results.get('error'),
    }


# ── Node 3: plan_changes ──────────────────────────────────────────────────


PLAN_CHANGES_PROMPT = """You are an expert in traditional SEO and GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization).

Analyze the following web page and generate a PLAN of prioritized changes to improve its SEO, GEO and AEO.

URL: {url}
PAGE TYPE: {page_type}

PREVIOUS ANALYSIS:
{scores_and_findings}

ORIGINAL HTML (truncated):
{html_preview}

WEB SEARCH CONTEXT (best practices):
{search_context}

PROJECT AND COMPETITORS:
{project_context}

Return EXACTLY this JSON (without markdown):
{{
  "plan": [
    {{
      "element": "<element to change: title, meta_description, og_tags, twitter_tags, headings, images_alt, json_ld, content, canonical, lang>",
      "action": "<updated | added | removed | rewritten>",
      "priority": "high | medium | low",
      "reason": "<why this change improves SEO/GEO/AEO>",
      "snippet_hint": "<code suggestion to use>"
    }}
  ],
  "estimated_scores": {{
    "seo": <int 0-100 estimated after>,
    "geo": <int 0-100 estimated after>,
    "overall": <int 0-100 estimated after>
  }},
  "strategic_impacts": [
    {{
      "impact": "<short business outcome, e.g. 'Increase organic traffic 30-70%'>",
      "detail": "<one sentence on why this plan produces that outcome>",
      "competitors": ["<exact competitor name from the list above, when this outcome is about competing with them>"]
    }}
  ]
}}

Generate a complete and prioritized plan (5-10 changes). Be specific and actionable.

For "strategic_impacts", return between 3 and 5 entries describing what this
optimization means for the BUSINESS, not for the markup — the outcome a stakeholder
would care about. Write them as consequences of the plan above ("If done well, this
could…"). Ground every number in the score movement you just estimated rather than
inventing a figure. At least one entry MUST be about competitive positioning and
MUST list the relevant competitors in its "competitors" array, using their names
exactly as given above. Use an empty array for entries that are not about a specific
competitor. If no competitors were supplied, omit the competitive entry rather than
naming a company that was not listed.
"""


def _format_project_context(project: Optional[dict]) -> str:
    """Renders the owning project and its competitors for the planning prompt.

    Competitors are what let the strategic impacts name real rivals instead of
    generalities; with no project attached there is simply nothing to name."""
    if not project:
        return 'No project attached to this analysis — no competitor set available.'

    lines = [
        f"Project: {project.get('title') or 'Untitled'}",
        f"Description: {project.get('description') or 'N/A'}",
        f"Category: {project.get('category') or 'N/A'}",
        f"Market: {', '.join(p for p in [project.get('country'), project.get('region')] if p) or 'N/A'}",
    ]

    competitors = project.get('competitors') or []
    if competitors:
        lines.append('Competitors:')
        for competitor in competitors:
            name = competitor.get('name') or competitor.get('url') or 'unknown'
            description = competitor.get('description') or ''
            lines.append(f'  - {name}: {description}'.rstrip(': '))
    else:
        lines.append('Competitors: none recorded for this project.')

    return '\n'.join(lines)


def _normalize_strategic_impacts(raw: Any, competitor_names: list) -> list:
    """Coerces the model's impacts into a stable shape and caps them at 5.

    Tolerates a bare list of strings, since that is the most common way the shape
    drifts. Competitor names are filtered against the project's real list so a
    hallucinated rival never reaches the UI."""
    if not isinstance(raw, list):
        return []

    allowed = {name.lower(): name for name in competitor_names}
    impacts = []

    for entry in raw[:5]:
        if isinstance(entry, str):
            text, detail, named = entry.strip(), None, []
        elif isinstance(entry, dict):
            text = str(entry.get('impact') or '').strip()
            detail = str(entry.get('detail') or '').strip() or None
            claimed = entry.get('competitors')
            claimed = claimed if isinstance(claimed, list) else []
            named = [allowed[str(c).lower()] for c in claimed if str(c).lower() in allowed]
        else:
            continue

        if text:
            impacts.append({'impact': text, 'detail': detail, 'competitors': named})

    return impacts


def plan_changes(state: dict) -> dict:
    """
    Use Gemini to plan prioritized changes based on analysis + search context.
    """
    analysis = state.get('analysis', {})
    html = state.get('html', '')
    url = state.get('url', '')
    search_context = state.get('search_context', '')
    project = state.get('project')

    if not analysis or not html:
        return {'plan_error': 'Missing analysis or HTML'}

    # Extract scores, findings, and their recommendations
    scores = analysis.get('scores', {})
    findings = analysis.get('findings', [])
    recommendations = analysis.get('recommendations', [])

    scores_and_findings = f'''
    Scores: {json.dumps(scores, ensure_ascii=False)}
    Findings: {json.dumps(findings, ensure_ascii=False)}
    Recommendations (each references the finding id it resolves via "finding_id"): {json.dumps(recommendations, ensure_ascii=False)}
    Geo visibility: {analysis.get('geo_visibility', 'N/A')}
    '''

    # Determine page type
    json_ld = analysis.get('json_ld') or {}
    page_type = json_ld.get('@type', 'Product') if isinstance(json_ld, dict) else 'Product'

    # Truncate and clean HTML
    html_preview = _clean_html_for_llm(html)[:6000]

    competitor_names = [
        (c.get('name') or c.get('url') or '')
        for c in ((project or {}).get('competitors') or [])
    ]
    competitor_names = [name for name in competitor_names if name]

    prompt = PLAN_CHANGES_PROMPT.format(
        url=url,
        page_type=page_type,
        scores_and_findings=scores_and_findings,
        html_preview=html_preview,
        search_context=search_context,
        project_context=_format_project_context(project),
    )

    try:
        result = _call_llm(prompt, response_format='json')
        return {
            'plan': result.get('plan', []),
            'estimated_scores': result.get('estimated_scores', {'seo': 0, 'geo': 0, 'overall': 0}),
            'strategic_impacts': _normalize_strategic_impacts(
                result.get('strategic_impacts'), competitor_names
            ),
            'plan_error': None,
        }
    except Exception as exc:
        logger.error(f'plan_changes failed: {exc}')
        return {
            'plan': [],
            'estimated_scores': {'seo': 0, 'geo': 0, 'overall': 0},
            'strategic_impacts': [],
            'plan_error': str(exc),
        }


# ── Node 4: apply_changes ─────────────────────────────────────────────────


APPLY_CHANGES_PROMPT = """You are a Senior Technical SEO + GEO (Generative Engine Optimization) Engineer. Your job is to process the JSON audit of a web page (obtained via the analysis) and produce an unified optimized output. Your goal is to raise the page's overall score to +85/100, ensuring content is understandable by both traditional search engines (Google) and AI answer engines (SearchGPT, Perplexity, Gemini, ChatGPT).

URL: {url}
PAGE TYPE: {page_type}

CHANGE PLAN:
{plan}

ORIGINAL HTML (truncated):
{html_preview}

PREVIOUS ANALYSIS (including existing JSON-LD):
{analysis_json}

WEB SEARCH CONTEXT:
{search_context}

# OPTIMIZATION INSTRUCTIONS (SEO + GEO FUSION)

## 1. Structured Data (JSON-LD with Schema @graph)
- Generate a single <script type="application/ld+json"> using @graph.
- Mandatorily include the main entity (e.g. VisualArtwork or Product with creator, material, seller and URL details).
- Include an FAQPage entity directly inside the @graph with key information (authorship, provenance, availability).

## 2. Metadata & Social Networks
- Meta Description: adjust length between 150 and 160 characters and include a clear call-to-action (CTA).
- OG/Twitter synchronization: assign to og:description the same updated meta description value. Add missing tags (og:url, twitter:card, twitter:title, twitter:description, twitter:image).

## 3. Content and HTML Images (Human GEO)
- Alt Text: add accessible, informative descriptions to main images missing the alt attribute.
- GEO Section in HTML: add a readable, natural information block in the HTML. Use clean tags (e.g. <h3>About [Title]</h3> and <p>[Narrative description of origin and availability]</p>) instead of rigid "Q: / A:" formats.

Return EXACTLY this JSON (without markdown):
{{
  "status": "completed",
  "score_before": {{
    "geo": <int 0-100 original geo score>,
    "seo": <int 0-100 original seo score>,
    "overall": <int 0-100 original overall score>
  }},
  "score_after_estimated": {{
    "geo": <int 0-100, >=85>,
    "seo": <int 0-100, >=85>,
    "overall": <int 0-100, >=85>
  }},
  "copy_paste_ready": {{
    "head_tags_html": "<!-- Copy and paste inside the <head> -->\\n<meta name=\\"description\\" content=\\"...\\">\\n<meta property=\\"og:url\\" content=\\"...\\">\\n...",
    "json_ld_script": "<script type=\\"application/ld+json\\">\\n{\\n  \\"@context\\": \\"https://schema.org\\",\\n  \\"@graph\\": [...]\\n}\\n</script>",
    "body_snippet_html": "<!-- Copy and paste in the <body> where it belongs -->\\n<div class=\\"artwork-faq-section\\">\\n  <h3>...</h3>\\n  <p>...</p>\\n</div>"
  }},
  "optimized_html": "<complete optimized HTML>",
  "optimized_json_ld": {{
    "@context": "https://schema.org",
    "@graph": [...]
  }},
  "optimized_content": {{
    "title": "<optimized title>",
    "meta_description": "<optimized meta description 150-160 chars with CTA>",
    "alt_texts": {{
      "<image_src>": "<optimized alt text>"
    }},
    "geo_content": "<content rewritten for GEO/AEO with natural narrative block>"
  }},
  "changes_applied": [
    {{
      "element": "meta_description | json_ld | og_tags | twitter_tags | images_alt | content",
      "action": "updated | added",
      "severity": "high | medium | low",
      "before": "<previous value>",
      "after": "<new value>",
      "reason": "<reason for the change>",
      "snippet": "<code fragment ready to copy>"
    }}
  ]
}}

RULES:
1. The optimized HTML must be the complete HTML with all changes applied.
2. The JSON-LD must be valid, semantically enriched and use @graph (Creator, Material, Dimensions, Offers, Brand, FAQPage if applicable).
3. The GEO/AEO content must be a natural narrative block, not a rigid "Q:/A:" list.
4. Each change must include a code snippet ready to copy/paste.
5. Do NOT invent information that is not in the original HTML. Use null if info is missing.
6. score_after_estimated must target +85/100 on overall while remaining plausible.
"""


def apply_changes(state: dict) -> dict:
    """
    Use Gemini to apply the planned changes and generate optimized output.
    """
    analysis = state.get('analysis', {})
    html = state.get('html', '')
    url = state.get('url', '')
    plan = state.get('plan', [])
    search_context = state.get('search_context', '')

    if not analysis or not html:
        return {'apply_error': 'Missing analysis or HTML'}

    # Determine page type
    json_ld = analysis.get('json_ld') or {}
    page_type = json_ld.get('@type', 'Product') if isinstance(json_ld, dict) else 'Product'

    # Truncate and clean HTML
    html_preview = _clean_html_for_llm(html)[:6000]

    analysis_json = json.dumps(analysis, ensure_ascii=False, default=str)[:5000]
    plan_json = json.dumps(plan, ensure_ascii=False, indent=2)

    prompt = (
        APPLY_CHANGES_PROMPT
        .replace('{url}', url)
        .replace('{page_type}', page_type)
        .replace('{plan}', plan_json)
        .replace('{html_preview}', html_preview)
        .replace('{analysis_json}', analysis_json)
        .replace('{search_context}', search_context)
    )

    try:
        result = _call_llm(prompt, response_format='json')
        return {
            'optimized_html': result.get('optimized_html', ''),
            'optimized_json_ld': result.get('optimized_json_ld', None),
            'optimized_content': result.get('optimized_content', {}),
            'changes_applied': result.get('changes_applied', []),
            'copy_paste_ready': result.get('copy_paste_ready', {}),
            'apply_error': None,
        }
    except Exception as exc:
        logger.error(f'apply_changes failed: {exc}')
        return {
            'optimized_html': '',
            'optimized_json_ld': None,
            'optimized_content': {},
            'changes_applied': [],
            'copy_paste_ready': {},
            'apply_error': str(exc),
        }


# ── Node 5: compile_optimization ──────────────────────────────────────────


def compile_optimization(state: dict) -> dict:
    """
    Consolidate all optimization results into the final report.
    """
    analysis = state.get('analysis', {})
    scores = analysis.get('scores', {}) if analysis else {}

    optimized_html = state.get('optimized_html', '')
    optimized_json_ld = state.get('optimized_json_ld')
    optimized_content = state.get('optimized_content', {})
    changes = state.get('changes_applied', [])
    copy_paste_ready = state.get('copy_paste_ready', {})
    estimated_scores = state.get('estimated_scores', {'seo': 0, 'geo': 0, 'overall': 0})

    read_error = state.get('read_error')
    plan_error = state.get('plan_error')
    apply_error = state.get('apply_error')

    errors = [e for e in [read_error, plan_error, apply_error] if e]

    score_before = {
        'seo': scores.get('seo', 0),
        'geo': scores.get('geo', 0),
        'overall': scores.get('overall', 0),
    }

    return {
        'optimized_html': optimized_html,
        'optimized_json_ld': optimized_json_ld,
        'optimized_content': optimized_content,
        'changes': changes,
        'copy_paste_ready': copy_paste_ready,
        'score_before': score_before,
        'score_after_estimated': estimated_scores,
        'strategic_impacts': state.get('strategic_impacts', []),
        'status': 'completed' if not errors else 'failed',
        'error': errors[0] if errors else None,
    }
