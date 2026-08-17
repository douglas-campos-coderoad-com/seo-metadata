"""Provider-agnostic LLM layer.

Usage from any node or agent::

    from src.llm import get_llm_repository

    result = get_llm_repository().complete_json(prompt, system_prompt=SYSTEM_PROMPT)

Which model actually answers is decided by `LLM_PROVIDER` / `LLM_MODEL` in the
environment; the parsed value handed back is the same either way.
"""
from src.llm.base import (
    LangChainChatRepository,
    LLMMessage,
    LLMRepository,
    strip_code_fences,
)
from src.llm.config import LLMSettings, load_settings
from src.llm.factory import (
    available_providers,
    build_repository,
    get_llm_repository,
    register_provider,
    reset_llm_repository,
    set_llm_repository,
)
from src.llm.providers import AnthropicRepository, GeminiRepository

__all__ = [
    'AnthropicRepository',
    'GeminiRepository',
    'LLMMessage',
    'LLMRepository',
    'LLMSettings',
    'LangChainChatRepository',
    'available_providers',
    'build_repository',
    'get_llm_repository',
    'load_settings',
    'register_provider',
    'reset_llm_repository',
    'set_llm_repository',
    'strip_code_fences',
]
