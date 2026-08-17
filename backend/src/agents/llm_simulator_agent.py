"""
LLM Citation Simulator Agent (llm_simulator_agent.py)

Simulates a user query against the configured LLM using the page content
as context, and evaluates whether the product/entity is cited.
"""
import logging
from typing import Any

from src.llm import get_llm_repository

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    'You are a precise LLM citation evaluator for GEO/AEO. Respond with valid JSON.'
)


def _call_llm(prompt: str) -> Any:
    """Call the configured LLM and return the parsed JSON response."""
    return get_llm_repository().complete_json(prompt, system_prompt=SYSTEM_PROMPT)


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


LIVE_SIMULATE_PROMPT = """You are a helpful, conversational AI assistant (like ChatGPT) answering a user's question.

USER QUERY:
{query}

AVAILABLE PAGE CONTENT (context you may use to answer):
{content}

You must answer as a natural language chat assistant. IMPORTANT:
- Only mention / recommend the specific product or brand if it is clearly described in the available content with sufficient detail (name, facts).
- If the content is generic, vague, or lacks product specifics, answer generically WITHOUT naming any brand or product.
- If you do mention the product, include the most relevant exact quote from the content as your "quote".

Return EXACTLY this JSON (without markdown):
{{
  "response": "<your conversational answer to the user query>",
  "cited": true/false,
  "quote": "<exact quote from content that supports the recommendation, or null if not mentioned>",
  "reason": "<brief explanation of why you cited or did not cite the product>"
}}
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
            result = _call_llm(
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

    def simulate_live(self, query: str, content: str) -> dict:
        """Generate a conversational (ChatGPT-style) response and whether it cites the product."""
        if not content or len(content.strip()) < 50:
            return {
                'response': 'I do not have enough information about this product to answer specifically.',
                'cited': False,
                'quote': None,
                'reason': 'Insufficient content to cite the product',
                'query': query,
            }

        try:
            result = _call_llm(
                LIVE_SIMULATE_PROMPT.format(query=query, content=content[:6000])
            )
            result['query'] = query
            return result
        except Exception as exc:
            logger.error(f'Live simulator failed: {exc}')
            return {
                'response': 'I could not generate a response at this time.',
                'cited': False,
                'quote': None,
                'reason': f'Simulation error: {exc}',
                'query': query,
            }
