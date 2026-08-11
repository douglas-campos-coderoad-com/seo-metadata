"""
Entity / Knowledge Graph Agent (entity_agent.py)

Convierte la descripción plana de una página en un Knowledge Graph
en formato JSON-LD con semántica rica (Creator, Material, Dimensions,
Style, Offers, Brand).
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
            SystemMessage(content='You are a precise schema.org Knowledge Graph generator. Always respond with valid JSON.'),
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


ENTITY_PROMPT = """Eres un experto en datos estructurados schema.org y Knowledge Graphs.

Convierte la información de la página en un Knowledge Graph JSON-LD enriquecido
con relaciones semánticas entre entidades.

URL: {url}
TIPO DE PÁGINA: {page_type}

DATOS EXTRAÍDOS DEL HTML:
{page_data}

JSON-LD EXISTENTE (si lo hay):
{existing_json_ld}

Devuelve EXACTAMENTE este JSON (sin markdown):
{{
  "json_ld": {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "<Product | CreativeWork | Article | Organization | Person | Place>",
        "name": "<nombre del producto/obra>",
        "description": "<descripción>",
        "creator": {{ "@type": "Person", "name": "<nombre del creador/artista>" }},
        "material": "<materiales usados>",
        "dimensions": {{ "@type": "QuantitativeValue", "value": "<valor>", "unitCode": "CM" }},
        "style": "<estilo artístico o diseño>",
        "brand": {{ "@type": "Brand", "name": "<marca>" }},
        "offers": {{
          "@type": "Offer",
          "price": "<precio>",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }}
      }}
    ]
  }},
  "entities": [
    {{ "type": "<tipo>", "name": "<nombre>", "properties": {{}} }}
  ],
  "relationships": [
    {{ "from": "<origen>", "to": "<destino>", "relation": "<relación>" }}
  ]
}}

REGLAS:
- Usa null para campos no disponibles.
- Incluye solo entidades/relaciones inferibles del contenido.
- JSON-LD debe ser válido schema.org.
"""


class EntityAgent:
    """Agent that generates a Knowledge Graph from page data."""

    def generate(self, url: str, page_type: str, page_data: dict, existing_json_ld: dict = None) -> dict:
        if not page_data:
            return {'json_ld': None, 'entities': [], 'relationships': [], 'error': 'No page data provided'}

        page_data_str = json.dumps(page_data, ensure_ascii=False, default=str)[:5000]
        existing_str = json.dumps(existing_json_ld, ensure_ascii=False, default=str)[:2000] if existing_json_ld else 'null'

        prompt = ENTITY_PROMPT.format(
            url=url, page_type=page_type,
            page_data=page_data_str, existing_json_ld=existing_str,
        )

        try:
            result = _call_gemini(prompt)
            result['error'] = None
            return result
        except Exception as exc:
            logger.error(f'Entity agent failed: {exc}')
            return {'json_ld': None, 'entities': [], 'relationships': [], 'error': str(exc)}