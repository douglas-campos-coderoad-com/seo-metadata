"""
LLM Citation Simulator Agent (llm_simulator_agent.py)

Simulates a user query against an LLM (Gemini) using the page content
as context, and evaluates whether the product/entity is cited.
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


SIMULATE_PROMPT = """You are a citation evaluator for Generative Engine Optimization (GEO) and Answer Engine Optimization (AEO).

You act as an answer engine (e.g., ChatGPT, Perplexity, SearchGPT, Google AI Overviews).

USER QUERY:
{query}

AVAILABLE PAGE CONTENT (from which an LLM could cite the product):
{content}

Return EXACTLY this JSON (without markdown):
{{
  "cited": true/false,
  "confidence": <float 0-1>,
  "quote": "<exact content fragment that would be cited, or null>",
  "response_snippet": "<LLM-generated response mentioning the product>",
  "reason": "<brief explanation of why it cites or not>"
}}

RULES:
- "cited" is true only if the product/name/primary entity appears explicitly in the response.
- "confidence" indicates how likely the LLM is to cite this content.
- If the content is insufficient, poorly structured, or lacks product data, "cited" must be false.
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
                'reason': 'Insufficient content to be cited by an LLM',
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
                'reason': f'Simulation error: {exc}',
                'query': query,
            }