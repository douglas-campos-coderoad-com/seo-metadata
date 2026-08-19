"""
Competitor Suggestion Agent (competitor_agent.py)

Proposes candidate competitor sites for a project, inferred from its
description, category, and geography (specs/008-project-centric-analysis
User Story 5 / FR-007). A single-shot LLM suggestion, not a live web search —
see specs/008-project-centric-analysis/research.md §5.
"""
import logging
from typing import Any, Optional

from src.llm import get_llm_repository

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    'You are a market research analyst who identifies competing websites. '
    'Always respond with valid JSON.'
)


def _call_llm(prompt: str) -> Any:
    """Call the configured LLM and return the parsed JSON response."""
    return get_llm_repository().complete_json(prompt, system_prompt=SYSTEM_PROMPT)


COMPETITOR_PROMPT = """You are researching competitors for a business.

PROJECT DESCRIPTION: {description}
CATEGORY: {category}
COUNTRY: {country}
REGION: {region}

Suggest up to 5 real, plausible competitor websites that operate in the same
category and geography, based on your knowledge.

Return EXACTLY this JSON (without markdown):
{{
  "suggestions": [
    {{ "url": "<competitor homepage URL>", "description": "<one sentence on why they compete>" }}
  ]
}}

RULES:
- Only include entries you are reasonably confident about; return an empty list if none.
- Never invent a URL you are not confident is a real, operating site.
"""


class CompetitorAgent:
    """Agent that proposes candidate competitor sites for a project."""

    def generate(self, description: str, category: str, country: str, region: Optional[str] = None) -> dict:
        prompt = COMPETITOR_PROMPT.format(
            description=description,
            category=category,
            country=country,
            region=region or 'Not specified',
        )

        try:
            result = _call_llm(prompt)
            raw_suggestions = result.get('suggestions', []) if isinstance(result, dict) else []
            # Defensive: a slightly malformed LLM response degrades to fewer
            # suggestions, never an error — this is a convenience feature, not
            # something that should ever block project creation/editing.
            suggestions = [
                {'url': s['url'], 'description': s['description']}
                for s in raw_suggestions
                if isinstance(s, dict) and isinstance(s.get('url'), str) and isinstance(s.get('description'), str)
            ]
            return {'suggestions': suggestions, 'error': None}
        except Exception as exc:
            logger.error(f'Competitor agent failed: {exc}')
            return {'suggestions': [], 'error': str(exc)}
