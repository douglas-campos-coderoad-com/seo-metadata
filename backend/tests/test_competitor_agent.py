import pytest
from unittest.mock import patch

from src.agents.competitor_agent import CompetitorAgent


@pytest.fixture
def competitor_agent():
    return CompetitorAgent()


@patch('src.agents.competitor_agent._call_llm')
def test_generate_returns_multiple_suggestions(mock_call_llm, competitor_agent):
    mock_call_llm.return_value = {
        'suggestions': [
            {'url': 'https://a-competitor.com', 'description': 'Sells similar home goods.'},
            {'url': 'https://b-competitor.com', 'description': 'Regional e-commerce rival.'},
        ]
    }

    result = competitor_agent.generate(
        description='A small e-commerce site selling home goods',
        category='e-commerce',
        country='United States',
        region='California',
    )

    assert result['error'] is None
    assert len(result['suggestions']) == 2
    assert result['suggestions'][0]['url'] == 'https://a-competitor.com'
    mock_call_llm.assert_called_once()


@patch('src.agents.competitor_agent._call_llm')
def test_generate_returns_empty_suggestions(mock_call_llm, competitor_agent):
    mock_call_llm.return_value = {'suggestions': []}

    result = competitor_agent.generate(
        description='A hyper-niche business with no clear competitors',
        category='other',
        country='Freedonia',
    )

    assert result['error'] is None
    assert result['suggestions'] == []


@patch('src.agents.competitor_agent._call_llm')
def test_generate_handles_malformed_llm_response(mock_call_llm, competitor_agent):
    # Not a dict at all, and/or entries missing required fields — must degrade
    # gracefully rather than raising.
    mock_call_llm.return_value = {
        'suggestions': [
            {'url': 'https://valid-one.com', 'description': 'Valid entry.'},
            {'url': 'https://missing-description.com'},
            'not-even-a-dict',
            {'description': 'Missing url entirely.'},
        ]
    }

    result = competitor_agent.generate(
        description='A site', category='saas', country='Canada',
    )

    assert result['error'] is None
    assert result['suggestions'] == [{'url': 'https://valid-one.com', 'description': 'Valid entry.'}]


@patch('src.agents.competitor_agent._call_llm')
def test_generate_handles_llm_failure(mock_call_llm, competitor_agent):
    mock_call_llm.side_effect = Exception('LLM provider unavailable')

    result = competitor_agent.generate(
        description='A site', category='saas', country='Canada',
    )

    assert result['suggestions'] == []
    assert 'LLM provider unavailable' in result['error']


# ── Competitor Audit Agent: description fallback scoring ──────────────────

from src.agents.competitor_audit_agent import _description_fallback_score


def test_description_fallback_returns_bounded_scores():
    # A rich descriptive sentence must yield mid-range, non-zero estimates —
    # not the previous misleading 0 that happened when a site blocked scraping.
    result = _description_fallback_score(
        'eBay competes by offering a massive marketplace for buying and '
        'selling various new and used general merchandise.'
    )
    assert result['seo_score'] >= 40
    assert result['geo_score'] >= 35
    assert result['seo_score'] <= 100
    assert result['geo_score'] <= 100


def test_description_fallback_scales_with_richness():
    rich = _description_fallback_score(
        'Top online marketplace for new and used goods — compare prices, '
        'features and reviews across thousands of sellers, services and '
        'products with fast shipping and buyer protection.'
    )
    thin = _description_fallback_score('A small online shop.')
    # A long, descriptive, hint-rich text should outscore a thin one.
    assert rich['seo_score'] >= thin['seo_score']
    assert rich['geo_score'] >= thin['geo_score']


def test_description_fallback_handles_empty_description():
    # Empty/None descriptions should still return safe bounded scores, never raise.
    for empty in ('', None):
        result = _description_fallback_score(empty)
        assert 0 <= result['seo_score'] <= 100
        assert 0 <= result['geo_score'] <= 100
