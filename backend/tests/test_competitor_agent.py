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
