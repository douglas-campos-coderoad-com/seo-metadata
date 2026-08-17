"""Tests for the provider-agnostic LLM repository layer (src/llm).

The point of the layer is that the *output* does not depend on the provider, so
most of these tests assert that two different providers, given the same raw
model text, hand the call sites the exact same value.
"""
import json

import pytest

from src.llm import (
    LLMMessage,
    LLMRepository,
    LLMSettings,
    available_providers,
    build_repository,
    get_llm_repository,
    load_settings,
    register_provider,
    reset_llm_repository,
    set_llm_repository,
    strip_code_fences,
)
from src.llm.providers import AnthropicRepository, GeminiRepository

RAW_JSON = '{"seo_score": 80, "geo_score": 60}'
PARSED = {'seo_score': 80, 'geo_score': 60}


class FakeRepository(LLMRepository):
    """Repository whose provider call is scripted, to exercise shared behaviour."""

    provider = 'fake'

    def __init__(self, responses: dict[str, object], **kwargs: object) -> None:
        kwargs.setdefault('model', 'primary-model')
        kwargs.setdefault('fallback_model', 'fallback-model')
        super().__init__(**kwargs)  # type: ignore[arg-type]
        self.responses = responses
        self.calls: list[tuple[str, list[LLMMessage]]] = []

    def _generate(self, model: str, messages: list[LLMMessage]) -> str:
        self.calls.append((model, messages))
        response = self.responses[model]
        if isinstance(response, Exception):
            raise response
        return str(response)


@pytest.fixture(autouse=True)
def _clean_repository_cache():
    reset_llm_repository()
    yield
    reset_llm_repository()


@pytest.fixture
def clean_env(monkeypatch):
    for var in (
        'LLM_PROVIDER', 'LLM_MODEL', 'LLM_MODEL_FALLBACK', 'LLM_API_KEY',
        'LLM_TEMPERATURE', 'LLM_MAX_RETRIES', 'GEMINI_API_KEY', 'GEMINI_MODEL',
        'GEMINI_MODEL_FALLBACK', 'GOOGLE_API_KEY', 'ANTHROPIC_API_KEY',
        'ANTHROPIC_MODEL', 'ANTHROPIC_MODEL_FALLBACK',
    ):
        monkeypatch.delenv(var, raising=False)
    return monkeypatch


# ── Response normalisation ────────────────────────────────────────────────


@pytest.mark.parametrize(
    'raw,expected',
    [
        (RAW_JSON, RAW_JSON),
        (f'```json\n{RAW_JSON}\n```', f'{RAW_JSON}\n'),
        (f'```\n{RAW_JSON}\n```', f'{RAW_JSON}\n'),
        (f'  \n{RAW_JSON}  ', RAW_JSON),
        ('```', '```'),
    ],
)
def test_strip_code_fences(raw, expected):
    assert strip_code_fences(raw) == expected


@pytest.mark.parametrize(
    'raw',
    [RAW_JSON, f'```json\n{RAW_JSON}\n```', f'```\n{RAW_JSON}\n```', f'\n{RAW_JSON}\n'],
)
def test_complete_json_parses_every_fence_variant(raw):
    repo = FakeRepository({'primary-model': raw})
    assert repo.complete_json('prompt', system_prompt='system') == PARSED


def test_complete_json_sends_system_then_user_message():
    repo = FakeRepository({'primary-model': RAW_JSON})
    repo.complete_json('the prompt', system_prompt='the system prompt')

    model, messages = repo.calls[0]
    assert model == 'primary-model'
    assert [m.role for m in messages] == ['system', 'user']
    assert messages[0].content == 'the system prompt'
    assert messages[1].content == 'the prompt'


def test_complete_text_returns_raw_content_unparsed():
    repo = FakeRepository({'primary-model': 'plain text answer'})
    assert repo.complete_text('prompt') == 'plain text answer'


def test_complete_text_omits_system_message_when_not_given():
    repo = FakeRepository({'primary-model': 'answer'})
    repo.complete_text('prompt')

    _model, messages = repo.calls[0]
    assert [m.role for m in messages] == ['user']


# ── Primary → fallback behaviour ──────────────────────────────────────────


def test_falls_back_to_second_model_when_primary_raises():
    repo = FakeRepository({
        'primary-model': RuntimeError('429 rate limited'),
        'fallback-model': RAW_JSON,
    })
    assert repo.complete_json('prompt', system_prompt='system') == PARSED
    assert [model for model, _ in repo.calls] == ['primary-model', 'fallback-model']


def test_falls_back_when_primary_returns_unparsable_json():
    repo = FakeRepository({
        'primary-model': 'Sure! Here is your report:',
        'fallback-model': RAW_JSON,
    })
    assert repo.complete_json('prompt', system_prompt='system') == PARSED


def test_raises_when_both_models_fail():
    repo = FakeRepository({
        'primary-model': RuntimeError('primary down'),
        'fallback-model': RuntimeError('fallback down'),
    })
    with pytest.raises(RuntimeError, match='fallback down'):
        repo.complete_json('prompt', system_prompt='system')


def test_raises_immediately_when_no_fallback_configured():
    repo = FakeRepository({'primary-model': RuntimeError('primary down')}, fallback_model=None)
    with pytest.raises(RuntimeError, match='primary down'):
        repo.complete_json('prompt', system_prompt='system')
    assert len(repo.calls) == 1


# ── Provider parity: same raw text in, same value out ─────────────────────


class _StubChatModel:
    """Stands in for a LangChain chat model."""

    def __init__(self, content):
        self.content = content
        self.invoked_with = None

    def invoke(self, messages):
        self.invoked_with = messages
        return type('Response', (), {'content': self.content})()


def _patched(repo_class, content, monkeypatch):
    repo = repo_class(model='m', fallback_model=None, api_key='key')
    stub = _StubChatModel(content)
    monkeypatch.setattr(repo, '_build_client', lambda model: stub)
    return repo, stub


def test_gemini_and_anthropic_return_identical_values(monkeypatch):
    """Gemini answers with a string, Anthropic with content blocks — same result."""
    gemini, _ = _patched(GeminiRepository, f'```json\n{RAW_JSON}\n```', monkeypatch)
    anthropic, _ = _patched(
        AnthropicRepository,
        [{'type': 'text', 'text': '```json\n'}, {'type': 'text', 'text': f'{RAW_JSON}\n```'}],
        monkeypatch,
    )

    assert gemini.complete_json('p', system_prompt='s') == PARSED
    assert anthropic.complete_json('p', system_prompt='s') == PARSED


def test_langchain_providers_build_the_same_message_sequence(monkeypatch):
    gemini, gemini_stub = _patched(GeminiRepository, RAW_JSON, monkeypatch)
    anthropic, anthropic_stub = _patched(AnthropicRepository, RAW_JSON, monkeypatch)

    for repo in (gemini, anthropic):
        repo.complete_json('the prompt', system_prompt='the system prompt')

    assert [type(m).__name__ for m in gemini_stub.invoked_with] == ['SystemMessage', 'HumanMessage']
    assert [m.content for m in gemini_stub.invoked_with] == [
        m.content for m in anthropic_stub.invoked_with
    ]


# ── Configuration & factory ───────────────────────────────────────────────


def test_defaults_to_gemini_with_the_previous_model_defaults(clean_env):
    settings = load_settings()
    assert settings.provider == 'gemini'
    assert settings.model == 'gemini-3.5-flash-lite'
    assert settings.fallback_model == 'gemini-3.6-flash'
    assert settings.temperature == 0.2
    assert settings.max_retries == 2


def test_provider_specific_env_vars_still_apply(clean_env):
    clean_env.setenv('GEMINI_MODEL', 'gemini-custom')
    clean_env.setenv('GEMINI_API_KEY', 'gkey')
    settings = load_settings()
    assert (settings.model, settings.api_key) == ('gemini-custom', 'gkey')


def test_neutral_env_vars_win_over_provider_specific_ones(clean_env):
    clean_env.setenv('GEMINI_MODEL', 'gemini-custom')
    clean_env.setenv('LLM_MODEL', 'neutral-model')
    assert load_settings().model == 'neutral-model'


def test_switching_provider_only_needs_an_env_var(clean_env):
    clean_env.setenv('LLM_PROVIDER', 'anthropic')
    clean_env.setenv('ANTHROPIC_API_KEY', 'akey')

    settings = load_settings()
    assert settings.provider == 'anthropic'
    assert settings.model.startswith('claude-')
    assert settings.api_key == 'akey'
    assert isinstance(build_repository(settings), AnthropicRepository)


def test_unknown_provider_is_rejected_with_a_helpful_message(clean_env):
    clean_env.setenv('LLM_PROVIDER', 'not-a-provider')
    with pytest.raises(ValueError, match='Unknown LLM provider'):
        build_repository()


def test_builtin_providers_are_registered():
    assert {'anthropic', 'gemini'} <= set(available_providers())


def test_a_new_provider_can_be_registered_without_touching_call_sites(clean_env):
    class EchoRepository(LLMRepository):
        provider = 'echo'

        def _generate(self, model: str, messages: list[LLMMessage]) -> str:
            return json.dumps({'model': model})

    register_provider(
        'echo',
        lambda settings: EchoRepository(model=settings.model, fallback_model=None),
    )
    clean_env.setenv('LLM_PROVIDER', 'echo')
    clean_env.setenv('LLM_MODEL', 'echo-1')

    repo = build_repository()
    assert repo.complete_json('prompt') == {'model': 'echo-1'}


def test_get_llm_repository_is_cached_until_reset(clean_env):
    first = get_llm_repository()
    assert get_llm_repository() is first

    reset_llm_repository()
    assert get_llm_repository() is not first


def test_set_llm_repository_overrides_the_configured_provider():
    injected = FakeRepository({'primary-model': RAW_JSON})
    set_llm_repository(injected)
    assert get_llm_repository() is injected


def test_build_repository_passes_settings_through(clean_env):
    settings = LLMSettings(
        provider='gemini',
        model='m1',
        fallback_model='m2',
        api_key='k',
        temperature=0.7,
        max_retries=5,
    )
    repo = build_repository(settings)
    assert (repo.model, repo.fallback_model, repo.api_key) == ('m1', 'm2', 'k')
    assert (repo.temperature, repo.max_retries) == (0.7, 5)


# ── Call sites go through the repository ──────────────────────────────────


def test_graph_nodes_use_the_injected_repository():
    from src.services import graph_nodes

    set_llm_repository(FakeRepository({'primary-model': RAW_JSON}))
    assert graph_nodes._call_llm('prompt') == PARSED


def test_optimizer_nodes_use_the_injected_repository():
    from src.services import optimizer_nodes

    set_llm_repository(FakeRepository({'primary-model': RAW_JSON}))
    assert optimizer_nodes._call_llm('prompt') == PARSED


@pytest.mark.parametrize(
    'module_name',
    ['src.agents.entity_agent', 'src.agents.geo_content_agent', 'src.agents.llm_simulator_agent'],
)
def test_agents_use_the_injected_repository(module_name):
    import importlib

    module = importlib.import_module(module_name)
    set_llm_repository(FakeRepository({'primary-model': RAW_JSON}))
    assert module._call_llm('prompt') == PARSED
