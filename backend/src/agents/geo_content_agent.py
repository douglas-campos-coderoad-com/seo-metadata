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
import os
from typing import Any

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
GEMINI_MODEL = os.getenv('GEMINI_MODEL', 'gemini-3.5-flash-lite')
GEMINI_MODEL_FALLBACK = os.getenv('GEMINI_MODEL_FALLBACK', 'gemini-3.6-flash')


def _call_gemini(prompt: str) -> Any:
    """Call Gemini and return parsed JSON."""
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