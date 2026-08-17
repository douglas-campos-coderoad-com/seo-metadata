"""
GEO Content Optimizer Agent (geo_content_agent.py)

Rewrites content using GEO (Generative Engine Optimization)
and AEO (Answer Engine Optimization) principles:
- High Fact-Density
- Direct Question/Answer responses for assistants
- Authoritative industry terminology
"""
import json
import logging
from typing import Any

from src.llm import get_llm_repository

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    'You are a precise GEO/AEO content optimizer. Always respond with valid JSON.'
)


def _call_llm(prompt: str) -> Any:
    """Call the configured LLM and return the parsed JSON response."""
    return get_llm_repository().complete_json(prompt, system_prompt=SYSTEM_PROMPT)


GEO_CONTENT_PROMPT = """You are an expert in GEO (Generative Engine Optimization) and AEO (Answer Engine Optimization).

Your task is to rewrite a web page's content to maximize its citability by LLMs
(ChatGPT, Perplexity, SearchGPT, Google AI Overviews).

GEO/AEO PRINCIPLES:
1. Fact-Density: High density of verifiable facts (dimensions, materials, prices, availability, history, technique).
2. AEO (Question/Answer): Include direct answers to questions a user would ask about the product.
3. Authoritative terminology: Use precise industry vocabulary.
4. Citable structure: Title and description that an LLM can cite directly.

URL: {url}
PAGE TYPE: {page_type}

PREVIOUS ANALYSIS (scores, findings — each finding includes its own suggested fix):
{analysis_context}

ORIGINAL HTML (truncated):
{html_preview}

WEB SEARCH CONTEXT:
{search_context}

Return EXACTLY this JSON (without markdown):
{{
  "optimized_title": "<optimized citable title with primary keyword>",
  "optimized_meta_description": "<optimized meta description answering a question with facts>",
  "geo_content": "<content rewritten with high fact-density, Q&A format, authoritative terminology>",
  "alt_texts": {{ "<image_src>": "<technical and descriptive alt text>" }},
  "qa_pairs": [
    {{ "question": "<question a user would ask>", "answer": "<direct and complete answer>" }}
  ],
  "fact_density_score": <int 0-100>,
  "changes": [
    {{
      "element": "<element>",
      "action": "<updated | added | rewritten>",
      "before": "<previous value>",
      "after": "<new value>",
      "severity": "high | medium | low",
      "reason": "<GEO/AEO reason>",
      "snippet": "<code ready to copy>"
    }}
  ]
}}

RULES:
- Do NOT invent information that is not in the original HTML.
- If information is missing, use null or indicate "information not available".
- Generate at least 3 relevant Q&A pairs.
- The geo_content must be a complete rewrite, not just a summary.
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
            result = _call_llm(prompt)
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