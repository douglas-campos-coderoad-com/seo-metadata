"""
LangGraph nodes for the SEO/GEO/AEO Optimizer.

Nodes:
  1. read_analysis - Load analysis + original HTML
  2. search_web - Serper API web search for best practices
  3. plan_changes - Gemini plans prioritized changes
  4. apply_changes - Gemini applies changes (HTML, JSON-LD, content)
  5. compile_optimization - Consolidate final report
"""
import json
import logging
import os
import httpx
from typing import Any

logger = logging.getLogger(__name__)

# ── Gemini setup ──────────────────────────────────────────────────────────
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
GEMINI_MODEL_FALLBACK = os.getenv('GEMINI_MODEL_FALLBACK', 'gemini-3.6-flash')

# ── Serper setup ──────────────────────────────────────────────────────────
SERPER_API_KEY = os.getenv('SERPER_API_KEY', '')
SERPER_ENDPOINT = 'https://google.serper.dev/search'


def _call_gemini(prompt: str, response_format: str = 'json') -> Any:
    """Call Gemini with the given prompt and return parsed JSON response."""
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        from langchain_core.messages import HumanMessage, SystemMessage

        llm = ChatGoogleGenerativeAI(
            model=GEMINI_MODEL,
            google_api_key=GEMINI_API_KEY,
            temperature=0.2,
            max_retries=2,
        )
        messages = [
            SystemMessage(
                content='You are a precise SEO/GEO/AEO optimizer. Always respond with valid JSON.'
            ),
            HumanMessage(content=prompt),
        ]
        response = llm.invoke(messages)
        content = response.content.strip()
        if content.startswith('```'):
            content = content.split('\n', 1)[1]
            content = content.rsplit('```', 1)[0]
        return json.loads(content)
    except Exception as exc:
        logger.warning(f'Gemini call failed with {GEMINI_MODEL}: {exc}')
        # Fallback to second model
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
            from langchain_core.messages import HumanMessage, SystemMessage

            llm = ChatGoogleGenerativeAI(
                model=GEMINI_MODEL_FALLBACK,
                google_api_key=GEMINI_API_KEY,
                temperature=0.2,
                max_retries=2,
            )
            messages = [
                SystemMessage(
                    content='You are a precise SEO/GEO/AEO optimizer. Always respond with valid JSON.'
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
    else:
        search_context = json.dumps(search_results, ensure_ascii=False, indent=2)

    return {
        'search_context': search_context,
        'search_error': results.get('error'),
    }


# ── Node 3: plan_changes ──────────────────────────────────────────────────


PLAN_CHANGES_PROMPT = """Eres un experto en SEO tradicional y GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization).

Analiza la siguiente página web y genera un PLAN de cambios priorizados para mejorar su SEO, GEO y AEO.

URL: {url}
TIPO DE PÁGINA: {page_type}

ANÁLISIS PREVIO:
{scores_and_findings}

HTML ORIGINAL (truncado):
{html_preview}

CONTEXTO DE BÚSQUEDA WEB (mejores prácticas):
{search_context}

Devuelve EXACTAMENTE este JSON (sin markdown):
{{
  "plan": [
    {{
      "element": "<elemento a cambiar: title, meta_description, og_tags, twitter_tags, headings, images_alt, json_ld, content, canonical, lang>",
      "action": "<updated | added | removed | rewritten>",
      "priority": "high | medium | low",
      "reason": "<por qué este cambio mejora SEO/GEO/AEO>",
      "snippet_hint": "<sugerencia del código a usar>"
    }}
  ],
  "estimated_scores": {{
    "seo": <int 0-100 estimado después>,
    "geo": <int 0-100 estimado después>,
    "overall": <int 0-100 estimado después>
  }}
}}

Genera un plan completo y priorizado (5-10 cambios). Sé específico y accionable.
"""


def plan_changes(state: dict) -> dict:
    """
    Use Gemini to plan prioritized changes based on analysis + search context.
    """
    analysis = state.get('analysis', {})
    html = state.get('html', '')
    url = state.get('url', '')
    search_context = state.get('search_context', '')

    if not analysis or not html:
        return {'plan_error': 'Missing analysis or HTML'}

    # Extract scores and findings
    scores = analysis.get('scores', {})
    findings = analysis.get('findings', [])

    scores_and_findings = f'''
    Scores: {json.dumps(scores, ensure_ascii=False)}
    Findings: {json.dumps(findings, ensure_ascii=False)}
    Recommendations: {json.dumps(analysis.get('recommendations', []), ensure_ascii=False)}
    Geo visibility: {analysis.get('geo_visibility', 'N/A')}
    '''

    # Determine page type
    json_ld = analysis.get('json_ld') or {}
    page_type = json_ld.get('@type', 'Product') if isinstance(json_ld, dict) else 'Product'

    # Truncate HTML
    html_preview = html[:10000]

    prompt = PLAN_CHANGES_PROMPT.format(
        url=url,
        page_type=page_type,
        scores_and_findings=scores_and_findings,
        html_preview=html_preview,
        search_context=search_context,
    )

    try:
        result = _call_gemini(prompt, response_format='json')
        return {
            'plan': result.get('plan', []),
            'estimated_scores': result.get('estimated_scores', {'seo': 0, 'geo': 0, 'overall': 0}),
            'plan_error': None,
        }
    except Exception as exc:
        logger.error(f'plan_changes failed: {exc}')
        return {
            'plan': [],
            'estimated_scores': {'seo': 0, 'geo': 0, 'overall': 0},
            'plan_error': str(exc),
        }


# ── Node 4: apply_changes ─────────────────────────────────────────────────


APPLY_CHANGES_PROMPT = """Eres un experto en SEO, GEO/AEO y datos estructurados schema.org.

Basado en el plan de cambios y el HTML original, genera el HTML optimizado completo, el JSON-LD enriquecido, y el contenido reescrito.

URL: {url}
TIPO DE PÁGINA: {page_type}

PLAN DE CAMBIOS:
{plan}

HTML ORIGINAL (truncado):
{html_preview}

ANÁLISIS PREVIO (incluye JSON-LD existente):
{analysis_json}

CONTEXTO DE BÚSQUEDA WEB:
{search_context}

Devuelve EXACTAMENTE este JSON (sin markdown):
{{
  "optimized_html": "<HTML completo optimizado>",
  "optimized_json_ld": {{
    "@context": "https://schema.org",
    "@graph": [...]
  }},
  "optimized_content": {{
    "title": "<título optimizado>",
    "meta_description": "<meta description optimizada>",
    "alt_texts": {{
      "<image_src>": "<alt text optimizado>"
    }},
    "geo_content": "<contenido reescrito para GEO/AEO, respondiendo preguntas conversacionales>"
  }},
  "changes_applied": [
    {{
      "element": "<elemento>",
      "action": "<updated | added | removed | rewritten>",
      "before": "<valor anterior>",
      "after": "<nuevo valor>",
      "severity": "high | medium | low",
      "reason": "<razón del cambio>",
      "snippet": "<fragmento de código listo para copiar>"
    }}
  ]
}}

REGLAS:
1. El HTML optimizado debe ser el HTML completo con todos los cambios aplicados.
2. El JSON-LD debe ser válido y enriquecido semánticamente (Creator, Material, Dimensions, Offers, Brand si aplica).
3. El contenido GEO/AEO debe responder preguntas conversacionales de usuarios.
4. Cada cambio debe incluir un snippet de código listo para copiar/pegar.
5. NO inventes información que no esté en el HTML original. Usa null si falta info.
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

    # Truncate HTML
    html_preview = html[:10000]

    analysis_json = json.dumps(analysis, ensure_ascii=False, default=str)[:5000]
    plan_json = json.dumps(plan, ensure_ascii=False, indent=2)

    prompt = APPLY_CHANGES_PROMPT.format(
        url=url,
        page_type=page_type,
        plan=plan_json,
        html_preview=html_preview,
        analysis_json=analysis_json,
        search_context=search_context,
    )

    try:
        result = _call_gemini(prompt, response_format='json')
        return {
            'optimized_html': result.get('optimized_html', ''),
            'optimized_json_ld': result.get('optimized_json_ld', None),
            'optimized_content': result.get('optimized_content', {}),
            'changes_applied': result.get('changes_applied', []),
            'apply_error': None,
        }
    except Exception as exc:
        logger.error(f'apply_changes failed: {exc}')
        return {
            'optimized_html': '',
            'optimized_json_ld': None,
            'optimized_content': {},
            'changes_applied': [],
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
        'score_before': score_before,
        'score_after_estimated': estimated_scores,
        'status': 'completed' if not errors else 'failed',
        'error': errors[0] if errors else None,
    }