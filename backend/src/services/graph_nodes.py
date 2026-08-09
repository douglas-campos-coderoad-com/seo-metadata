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


SEO_GEO_PROMPT = """Eres un analizador experto en SEO tradicional y GEO (Generative Engine Optimization) / AEO (Answer Engine Optimization).

Analiza la siguiente página web y devuelve un JSON con scores, hallazgos y recomendaciones.

DATOS DE LA PÁGINA:
- Título: {title}
- Meta description: {meta_description}
- Meta keywords: {meta_keywords}
- Canonical: {canonical}
- OpenGraph tags: {og_tags}
- Twitter tags: {twitter_tags}
- Headings: {headings}
- Imágenes totales: {images_total} (con alt: {images_with_alt}, sin alt: {images_without_alt})
- Links: {links}
- JSON-LD existente: {json_ld}
- Idioma: {lang}
- Robots meta: {robots}
- Viewport: {viewport}
- Tiene favicon: {has_favicon}
- Longitud del texto visible: {visible_text_length} caracteres

PRIMEROS 1000 CARACTERES DEL TEXTO VISIBLE:
{visible_text_preview}

REGLAS DE EVALUACIÓN:

1. SEO Score (0-100):
   - Título: debe tener entre 50-60 caracteres, incluir keyword principal (15 pts)
   - Meta description: debe tener 150-160 caracteres, incluir keyword y call-to-action (15 pts)
   - Headings: estructura jerárquica correcta (h1 único, h2-h6 jerárquicos) (10 pts)
   - Imágenes: todas deben tener alt text descriptivo (10 pts)
   - OpenGraph / Twitter Cards: presentes y completos (10 pts)
   - JSON-LD structured data: presente (15 pts)
   - Canonical URL: presente (5 pts)
   - Robots meta: no debe bloquear indexing (5 pts)
   - Velocidad percibida: viewport optimizado, favicon presente (5 pts)
   - Contenido: texto relevante y suficiente (>300 chars) (10 pts)

2. GEO/AEO Score (0-100):
   - ¿El contenido responde preguntas directas que un usuario haría? (20 pts)
   - ¿Usa lenguaje natural y conversacional? (15 pts)
   - ¿Proporciona respuestas completas y accionables? (20 pts)
   - ¿Tiene datos estructurados JSON-LD que un LLM pueda parsear? (20 pts)
   - ¿El título y meta description son "citable" por un LLM? (15 pts)
   - ¿La página está optimizada para featured snippets / AI Overviews? (10 pts)

Devuelve EXACTAMENTE este JSON (sin markdown):
{{
  "seo_score": <int 0-100>,
  "geo_score": <int 0-100>,
  "findings": ["<hallazgo 1>", "<hallazgo 2>", ...],
  "recommendations": ["<recomendación 1>", "<recomendación 2>", ...],
  "geo_visibility": "<texto explicativo de 2-3 oraciones sobre qué tan visible es el contenido para IA generativa>",
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
            'findings': [f'Error during analysis: {str(exc)}'],
            'recommendations': ['Reintentar el análisis más tarde'],
            'geo_visibility': 'No se pudo completar el análisis',
            'seo_breakdown': {},
            'geo_breakdown': {},
            'seo_geo_error': str(exc),
        }


# ── Node 3: generate_json_ld ──────────────────────────────────────────────


JSON_LD_PROMPT = """Eres un experto en datos estructurados schema.org y Knowledge Graphs.

Basado en el siguiente contenido de una página web, genera un JSON-LD Knowledge Graph enriquecido que represente semánticamente el contenido de la página.

DATOS DE LA PÁGINA:
- Título: {title}
- Meta description: {meta_description}
- Headings: {headings}
- JSON-LD existente (si hay): {existing_json_ld}
- Texto visible: {visible_text}

REGLAS:
1. Identifica el tipo principal de la página (Product, Article, WebPage, ItemPage, etc.)
2. Genera relaciones semánticas ricas:
   - Si es un producto: fabricante/creador, material, dimensiones, color, estilo, SKU, ofertas, reseñas, categoría
   - Si es un artículo: autor, fecha de publicación, editor, sobre (about)
   - Siempre incluye: breadcrumb, sitio web, publisher/organization
3. Usa URIs de schema.org estándar
4. El JSON-LD debe ser válido y completo
5. Si no hay suficiente información para un campo, usa null

Devuelve EXACTAMENTE este JSON (sin markdown, sin decoración):
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

Genera el JSON-LD más completo posible basado en la información disponible.
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