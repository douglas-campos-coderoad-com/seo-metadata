"""
Entity / Knowledge Graph Agent (entity_agent.py)

Converts a page's flat description into a Knowledge Graph
in JSON-LD format with rich semantics (Creator, Material, Dimensions,
Style, Offers, Brand).
"""
import json
import logging
from typing import Any

from src.llm import get_llm_repository

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    'You are a precise schema.org Knowledge Graph generator. Always respond with valid JSON.'
)


def _call_llm(prompt: str) -> Any:
    """Call the configured LLM and return the parsed JSON response."""
    return get_llm_repository().complete_json(prompt, system_prompt=SYSTEM_PROMPT)


ENTITY_PROMPT = """You are an expert in schema.org structured data and Knowledge Graphs.

Convert the page information into an enriched JSON-LD Knowledge Graph
with semantic relationships between entities.

URL: {url}
PAGE TYPE: {page_type}

DATA EXTRACTED FROM HTML:
{page_data}

EXISTING JSON-LD (if any):
{existing_json_ld}

Return EXACTLY this JSON (without markdown):
{{
  "json_ld": {{
    "@context": "https://schema.org",
    "@graph": [
      {{
        "@type": "<Product | CreativeWork | Article | Organization | Person | Place>",
        "name": "<product/work name>",
        "description": "<description>",
        "creator": {{ "@type": "Person", "name": "<creator/artist name>" }},
        "material": "<materials used>",
        "dimensions": {{ "@type": "QuantitativeValue", "value": "<value>", "unitCode": "CM" }},
        "style": "<artistic style or design>",
        "brand": {{ "@type": "Brand", "name": "<brand>" }},
        "offers": {{
          "@type": "Offer",
          "price": "<price>",
          "priceCurrency": "USD",
          "availability": "https://schema.org/InStock"
        }}
      }}
    ]
  }},
  "entities": [
    {{ "type": "<entity type>", "name": "<entity name>", "properties": {{}} }}
  ],
  "relationships": [
    {{ "from": "<source>", "to": "<target>", "relation": "<relationship>" }}
  ]
}}

RULES:
- Use null for fields not available in the HTML.
- Include only entities/relationships inferable from the content.
- The JSON-LD must be valid schema.org.
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
            result = _call_llm(prompt)
            result['error'] = None
            return result
        except Exception as exc:
            logger.error(f'Entity agent failed: {exc}')
            return {'json_ld': None, 'entities': [], 'relationships': [], 'error': str(exc)}