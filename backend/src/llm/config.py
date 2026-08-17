"""Environment-driven configuration for the LLM repository layer.

Provider selection is `LLM_PROVIDER` (default `gemini`, so existing deployments
behave exactly as before). Models and credentials can be given either with the
provider-neutral `LLM_*` variables or with the provider-specific ones
(`GEMINI_*`, `ANTHROPIC_*`); the neutral variables win when both are set.
"""
from __future__ import annotations

import os
from dataclasses import dataclass

from src.llm.base import DEFAULT_MAX_RETRIES, DEFAULT_TEMPERATURE

DEFAULT_PROVIDER = 'gemini'


@dataclass(frozen=True)
class ProviderDefaults:
    """Per-provider env var names and model defaults."""

    env_prefix: str
    model: str
    fallback_model: str
    api_key_vars: tuple[str, ...]


PROVIDER_DEFAULTS: dict[str, ProviderDefaults] = {
    'gemini': ProviderDefaults(
        env_prefix='GEMINI',
        model='gemini-3.5-flash-lite',
        fallback_model='gemini-3.6-flash',
        api_key_vars=('GEMINI_API_KEY', 'GOOGLE_API_KEY'),
    ),
    'anthropic': ProviderDefaults(
        env_prefix='ANTHROPIC',
        model='claude-sonnet-5',
        fallback_model='claude-haiku-4-5-20251001',
        api_key_vars=('ANTHROPIC_API_KEY',),
    ),
}


@dataclass(frozen=True)
class LLMSettings:
    """Everything needed to construct a repository for one provider."""

    provider: str
    model: str
    fallback_model: str | None
    api_key: str
    temperature: float = DEFAULT_TEMPERATURE
    max_retries: int = DEFAULT_MAX_RETRIES


def _first_env(*names: str, default: str = '') -> str:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return default


def _float_env(name: str, default: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _int_env(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def load_settings(provider: str | None = None) -> LLMSettings:
    """Read the LLM configuration from the environment.

    Read lazily (at first use, not at import time) so tests and runtime config
    changes are picked up without reimporting modules.
    """
    resolved = (provider or os.getenv('LLM_PROVIDER') or DEFAULT_PROVIDER).strip().lower()
    defaults = PROVIDER_DEFAULTS.get(resolved)

    if defaults is None:
        # Unknown provider: still allow a fully explicit LLM_* configuration.
        prefix = resolved.upper().replace('-', '_')
        defaults = ProviderDefaults(
            env_prefix=prefix,
            model=_first_env('LLM_MODEL', f'{prefix}_MODEL'),
            fallback_model=_first_env('LLM_MODEL_FALLBACK', f'{prefix}_MODEL_FALLBACK'),
            api_key_vars=(f'{prefix}_API_KEY',),
        )

    prefix = defaults.env_prefix
    fallback_model = _first_env(
        'LLM_MODEL_FALLBACK', f'{prefix}_MODEL_FALLBACK', default=defaults.fallback_model
    )

    return LLMSettings(
        provider=resolved,
        model=_first_env('LLM_MODEL', f'{prefix}_MODEL', default=defaults.model),
        fallback_model=fallback_model or None,
        api_key=_first_env('LLM_API_KEY', *defaults.api_key_vars),
        temperature=_float_env('LLM_TEMPERATURE', DEFAULT_TEMPERATURE),
        max_retries=_int_env('LLM_MAX_RETRIES', DEFAULT_MAX_RETRIES),
    )
