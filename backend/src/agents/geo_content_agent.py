"""
GEO Content Optimizer Agent (geo_content_agent.py)

Reescribe contenido usando principios de GEO (Generative Engine Optimization)
y AEO (Answer Engine Optimization):
- Alta densidad de hechos (Fact-Density)
- Respuestas en formato Pregunta/Respuesta directa para asistentes
- Terminología autoritativa de la industria
"""
import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
GEMINI_MODEL_FALLBACK = os.getenv('GEMINI_MODEL_FALLBACK', 'gemini-3.6-flash')


def _call_gemini(prompt: str) -> Any:
    from langchain_google_genai import ChatGoogleGenerativeAI
    from langchain_core.messages import HumanMessage, SystemMessage

    def _invoke(model: str):
        llm = ChatGoogleGenerativeAI(
            model=model, google_api_key=GEMINI_API_KEY, temperature=0.2, max_retries=2,
        )
        messages = [
            SystemMessage(content='You are a precise GEO/AEO content optimizer. Always respond with valid JSON.'),
            HumanMessage(content=prompt),
        ]
        return llm.invoke(messages).content.strip()

    try:
        content = _invoke(GEMINI_MODEL)
    except Exception as exc:
        logger.warning(f'Gemini {GEMINI_MODEL} failed: {exc}')
        content = _invoke(GEMINI_MODEL_FALLBACK)

    if content.startswith('```'):
        content = content.split('\n', 1)[1]
        content = content.rsplit('```', 1)[0]
    return json.loads(content)


GEO_CONTENT_PROMPT = """Eres un experto en GEO (Generative Engine Optimization) y AEO (Answer Engine Optimization).

Tu tarea es reescribir el contenido de una página web para maximizar su citabilidad por LLMs
(ChatGPT, Perplexity, SearchGPT, Google AI Overviews).

PRINCIPIOS DE GEO/AEO:
1. Fact-Density: Alta densidad de hechos verificables (dimensiones, materiales, precios, disponibilidad, historia, técnica).
2. AEO (Pregunta/Respuesta): Incluir respuestas directas a preguntas que un usuario haría sobre el producto.
3. Terminología autoritativa: Usar vocabulario preciso de la industria.
4. Estructura citables: Título y descripción que un LLM pueda citar directamente.

URL: {url}
TIPO DE PÁGINA: {page_type}

ANÁLISIS PREVIO (scores, findings, recomendaciones):
{analysis_context}

HTML ORIGINAL (truncado):
{html_preview}

CONTEXTO DE BÚSQUEDA WEB:
{search_context}

Devuelve EXACTAMENTE este JSON (sin markdown):
{{
  "optimized_title": "<título optimizado, citables, con keyword principal>",
  "optimized_meta_description": "<meta description optimizada, responde una pregunta, con hechos>",
  "geo_content": "<contenido reescrito con alta fact-density, formato Q&A, terminología autoritativa>",
  "alt_texts": {{ "<image_src>": "<alt text técnico y descriptivo>" }},
  "qa_pairs": [
    {{ "question": "<pregunta que haría un usuario>", "answer": "<respuesta directa y completa>" }}
  ],
  "fact_density_score": <int 0-100>,
  "changes": [
    {{
      "element": "<elemento>",
      "action": "<updated | added | rewritten>",
      "before": "<valor anterior>",
      "after": "<nuevo valor>",
      "severity": "high | medium | low",
      "reason": "<razón GEO/AEO>",
      "snippet": "<código listo para copiar>"
    }}
  ]
}}

REGLAS:
- NO inventar información que no esté en el HTML original.
- Si falta información, usa null o indica "información no disponible".
- Genera al menos 3 Q&A pairs relevantes.
- El geo_content debe ser una reescritura completa, no solo un resumen.
"""


class GEOContentAgent:
    """Agent that rewrites content for GEO/AEO citability."""

    def optimize(self, url: str, page_type: str, analysis: dict, html: str, search_context: str = '') -> dict:
        if not html:
            return {
                'optimized_title': None,
                'optimized_meta_description': None,
                'geo_content': '',
                'alt_texts': {},
                'qa_pairs': [],
                'fact_density_score': 0,
                'changes': [],
                'error': 'No HTML content provided',
            }

        analysis_context = json.dumps(analysis, ensure_ascii=False, default=str)[:3000]
        html_preview = html[:10000]

        prompt = GEO_CONTENT_PROMPT.format(
            url=url,
            page_type=page_type,
            analysis_context=analysis_context,
            html_preview=html_preview,
            search_context=search_context,
        )

        try:
            result = _call_gemini(prompt)
            result['error'] = None
            return result
        except Exception as exc:
            logger.error(f'GEO content agent failed: {exc}')
            return {
                'optimized_title': None,
                'optimized_meta_description': None,
                'geo_content': '',
                'alt_texts': {},
                'qa_pairs': [],
                'fact_density_score': 0,
                'changes': [],
                'error': str(exc),
            }