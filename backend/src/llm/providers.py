"""Concrete LLM providers.

Each provider only knows how to build its own client. Response handling lives
in :mod:`src.llm.base`, so every provider returns the same thing for the same
prompt shape. Provider SDKs are imported lazily inside ``_build_client`` so the
app starts even when only one provider's package is installed.
"""
from __future__ import annotations

from typing import Any

from pydantic import SecretStr

from src.llm.base import LangChainChatRepository
from src.llm.config import LLMSettings


class GeminiRepository(LangChainChatRepository):
    """Google Gemini via ``langchain-google-genai``."""

    provider = 'gemini'

    def _build_client(self, model: str) -> Any:
        try:
            from langchain_google_genai import ChatGoogleGenerativeAI
        except ImportError as exc:  # pragma: no cover - depends on install
            raise RuntimeError(
                'The gemini provider requires the langchain-google-genai package. '
                'Install it or set LLM_PROVIDER to another provider.'
            ) from exc

        return ChatGoogleGenerativeAI(
            model=model,
            api_key=SecretStr(self.api_key),
            temperature=self.temperature,
            max_retries=self.max_retries,
        )


class AnthropicRepository(LangChainChatRepository):
    """Anthropic Claude via ``langchain-anthropic``."""

    provider = 'anthropic'

    def _build_client(self, model: str) -> Any:
        try:
            from langchain_anthropic import ChatAnthropic
        except ImportError as exc:  # pragma: no cover - depends on install
            raise RuntimeError(
                'The anthropic provider requires the langchain-anthropic package. '
                'Install it or set LLM_PROVIDER to another provider.'
            ) from exc

        return ChatAnthropic(
            model_name=model,
            api_key=SecretStr(self.api_key),
            temperature=self.temperature,
            max_retries=self.max_retries,
            default_headers={'anthropic-beta': 'prompt-caching-2024-07-31'},
            timeout=None,
            stop=None,
        )


def build_gemini(settings: LLMSettings) -> GeminiRepository:
    return GeminiRepository(
        model=settings.model,
        fallback_model=settings.fallback_model,
        api_key=settings.api_key,
        temperature=settings.temperature,
        max_retries=settings.max_retries,
    )


def build_anthropic(settings: LLMSettings) -> AnthropicRepository:
    return AnthropicRepository(
        model=settings.model,
        fallback_model=settings.fallback_model,
        api_key=settings.api_key,
        temperature=settings.temperature,
        max_retries=settings.max_retries,
    )
