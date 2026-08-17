"""Provider-agnostic LLM contract (repository pattern).

Every LLM call in the codebase goes through an :class:`LLMRepository`. Swapping
Gemini for Anthropic — or any future provider — is a configuration change, not a
code change, because the repository normalises the response identically for
every provider:

  * the same code-fence stripping,
  * the same ``json.loads`` parsing,
  * the same "primary model, then fallback model" retry,
  * the same temperature / max_retries defaults.

Call sites therefore keep receiving exactly the value they received when they
talked to ``ChatGoogleGenerativeAI`` directly.
"""
from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)

#: Defaults every provider inherits — these are the values the inline Gemini
#: calls used before this layer existed, so behaviour is unchanged.
DEFAULT_TEMPERATURE = 0.2
DEFAULT_MAX_RETRIES = 2


@dataclass(frozen=True)
class LLMMessage:
    """A single chat message, in provider-neutral form."""

    role: str  # 'system' | 'user'
    content: str


def strip_code_fences(content: str) -> str:
    """Drop a wrapping markdown code fence, if the model emitted one.

    Mirrors the stripping that used to be inlined at every call site, so a
    response that parsed before still parses now.
    """
    content = content.strip()
    if not content.startswith('```'):
        return content
    _fence, newline, remainder = content.partition('\n')
    if not newline:
        return content
    return remainder.rsplit('```', 1)[0]


def content_to_text(content: Any) -> str:
    """Flatten a chat response body into plain text.

    Gemini returns a string; Anthropic can return a list of content blocks.
    Both collapse to the same string so downstream parsing is identical.
    """
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and 'text' in block:
                parts.append(str(block['text']))
        return ''.join(parts)
    return str(content)


class LLMRepository(ABC):
    """Provider-neutral access to a chat completion model.

    Subclasses implement :meth:`_generate` for their provider; everything that
    shapes the *output* (fence stripping, JSON parsing, fallback) lives here so
    that it cannot drift between providers.
    """

    #: Human-readable provider name, used in log messages.
    provider: str = 'unknown'

    def __init__(
        self,
        *,
        model: str,
        fallback_model: str | None = None,
        api_key: str = '',
        temperature: float = DEFAULT_TEMPERATURE,
        max_retries: int = DEFAULT_MAX_RETRIES,
    ) -> None:
        self.model = model
        self.fallback_model = fallback_model
        self.api_key = api_key
        self.temperature = temperature
        self.max_retries = max_retries

    # ── Provider hook ────────────────────────────────────────────────────

    @abstractmethod
    def _generate(self, model: str, messages: list[LLMMessage]) -> str:
        """Return the assistant's raw text for ``messages`` using ``model``."""

    # ── Public API (identical for every provider) ────────────────────────

    def complete_json(self, prompt: str, system_prompt: str | None = None) -> Any:
        """Send ``prompt`` and return the parsed JSON the model replied with.

        Raises whatever the provider raised if both the primary and the
        fallback model fail — same as the previous inline implementation.
        """
        return self._complete(prompt, system_prompt, parse_json=True)

    def complete_text(self, prompt: str, system_prompt: str | None = None) -> str:
        """Send ``prompt`` and return the model's raw text reply."""
        result = self._complete(prompt, system_prompt, parse_json=False)
        return str(result)

    # ── Internals ────────────────────────────────────────────────────────

    def _complete(self, prompt: str, system_prompt: str | None, parse_json: bool) -> Any:
        try:
            return self._invoke(self.model, prompt, system_prompt, parse_json)
        except Exception as exc:
            if not self.fallback_model:
                logger.error(f'{self.provider} call failed with {self.model}: {exc}')
                raise
            logger.warning(f'{self.provider} call failed with {self.model}: {exc}')
            try:
                return self._invoke(self.fallback_model, prompt, system_prompt, parse_json)
            except Exception as fallback_exc:
                logger.error(f'{self.provider} fallback also failed: {fallback_exc}')
                raise

    def _invoke(
        self, model: str, prompt: str, system_prompt: str | None, parse_json: bool
    ) -> Any:
        messages: list[LLMMessage] = []
        if system_prompt:
            messages.append(LLMMessage(role='system', content=system_prompt))
        messages.append(LLMMessage(role='user', content=prompt))

        raw = self._generate(model, messages)
        if not parse_json:
            return raw
        return json.loads(strip_code_fences(raw))

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return (
            f'<{type(self).__name__} provider={self.provider!r} model={self.model!r} '
            f'fallback={self.fallback_model!r}>'
        )


class LangChainChatRepository(LLMRepository):
    """Base for providers exposed through a LangChain ``BaseChatModel``.

    Subclasses only have to build the client; message construction and response
    flattening are shared, which is what keeps the output identical across
    providers.
    """

    @abstractmethod
    def _build_client(self, model: str) -> Any:
        """Return a LangChain chat model configured for ``model``."""

    def _generate(self, model: str, messages: list[LLMMessage]) -> str:
        from langchain_core.messages import HumanMessage, SystemMessage

        client = self._build_client(model)
        lc_messages = [
            SystemMessage(content=message.content)
            if message.role == 'system'
            else HumanMessage(content=message.content)
            for message in messages
        ]
        response = client.invoke(lc_messages)
        return content_to_text(response.content)
