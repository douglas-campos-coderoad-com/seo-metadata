"""
LLM Citation Simulator Agent (llm_simulator_agent.py)

Simula una consulta de usuario contra un LLM (Gemini) usando el contenido
de la página como contexto, y evalúa si el producto/entidad es citado.
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
            SystemMessage(content='You are a precise LLM citation evaluator for GEO/AEO. Respond with valid JSON.'),
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


SIMULATE_PROMPT = """Eres un evaluador de citas para Generative Engine Optimization (GEO) y Answer Engine Optimization (AEO).

Actúas como un motor de respuestas (p. ej., ChatGPT, Perplexity, SearchGPT, Google AI Overviews).

CONSULTA DEL USUARIO:
{query}

CONTENIDO DISPONIBLE DE LA PÁGINA (por el que un LLM podría citar el producto):
{content}

Devuelve EXACTAMENTE este JSON (sin markdown):
{{
  "cited": true/false,
  "confidence": <float 0-1>,
  "quote": "<fragmento exacto del contenido que citaría, o null>",
  "response_snippet": "<respuesta generada por el LLM que menciona el producto>",
  "reason": "<explicación breve de por qué cita o no>"
}}

REGLAS:
- "cited" es true solo si el producto/nombre/entidad principal aparece explícitamente en la respuesta.
- "confidence" indica qué tan probable es que el LLM cite este contenido.
- Si el contenido es insuficiente, poco estructurado, o carece de datos del producto, "cited" debe ser false.
"""


class LLMSimulatorAgent:
    """Agent that simulates a user query against an LLM to check page citability."""

    def simulate(self, query: str, content: str) -> dict:
        if not content or len(content.strip()) < 50:
            return {
                'cited': False,
                'confidence': 0.0,
                'quote': None,
                'response_snippet': '',
                'reason': 'Contenido insuficiente para ser citado por un LLM',
                'query': query,
            }

        try:
            result = _call_gemini(
                SIMULATE_PROMPT.format(query=query, content=content[:6000])
            )
            result['query'] = query
            return result
        except Exception as exc:
            logger.error(f'Simulator failed: {exc}')
            return {
                'cited': False,
                'confidence': 0.0,
                'quote': None,
                'response_snippet': '',
                'reason': f'Error en simulación: {exc}',
                'query': query,
            }