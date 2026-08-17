"""Provider registry and repository lookup.

Call sites ask for :func:`get_llm_repository` and get whichever provider the
environment selects. A third provider only needs
``register_provider('name', builder)`` — no call site changes.
"""
from __future__ import annotations

import logging
import threading
from collections.abc import Callable

from src.llm.base import LLMRepository
from src.llm.config import LLMSettings, load_settings

logger = logging.getLogger(__name__)

RepositoryBuilder = Callable[[LLMSettings], LLMRepository]

_registry: dict[str, RepositoryBuilder] = {}
_lock = threading.Lock()
_repository: LLMRepository | None = None


def register_provider(name: str, builder: RepositoryBuilder) -> None:
    """Register (or replace) the builder for a provider name."""
    _registry[name.strip().lower()] = builder


def available_providers() -> list[str]:
    """Names accepted by ``LLM_PROVIDER``."""
    return sorted(_registry)


def _register_builtin_providers() -> None:
    from src.llm.providers import build_anthropic, build_gemini

    register_provider('gemini', build_gemini)
    register_provider('anthropic', build_anthropic)


_register_builtin_providers()


def build_repository(settings: LLMSettings | None = None) -> LLMRepository:
    """Construct a repository for ``settings`` (env-derived when omitted)."""
    resolved = settings or load_settings()
    builder = _registry.get(resolved.provider)
    if builder is None:
        raise ValueError(
            f'Unknown LLM provider {resolved.provider!r}. '
            f'Available providers: {", ".join(available_providers())}'
        )
    return builder(resolved)


def get_llm_repository() -> LLMRepository:
    """Return the process-wide repository, building it on first use."""
    global _repository
    if _repository is None:
        with _lock:
            if _repository is None:
                _repository = build_repository()
                logger.info(
                    f'LLM provider: {_repository.provider} '
                    f'(model={_repository.model}, fallback={_repository.fallback_model})'
                )
    return _repository


def set_llm_repository(repository: LLMRepository | None) -> None:
    """Override the process-wide repository (dependency injection / tests)."""
    global _repository
    with _lock:
        _repository = repository


def reset_llm_repository() -> None:
    """Forget the cached repository so the next call re-reads the environment."""
    set_llm_repository(None)
