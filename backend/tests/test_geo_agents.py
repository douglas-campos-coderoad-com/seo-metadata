import pytest
from unittest.mock import patch

from src.agents.entity_agent import EntityAgent
from src.agents.geo_content_agent import GEOContentAgent
from src.agents.llm_simulator_agent import LLMSimulatorAgent


@pytest.fixture
def entity_agent():
    return EntityAgent()


@pytest.fixture
def geo_agent():
    return GEOContentAgent()


@pytest.fixture
def simulator_agent():
    return LLMSimulatorAgent()


@patch('src.agents.entity_agent._call_gemini')
def test_entity_agent_generate_success(mock_call_gemini, entity_agent):
    page_data = {
        'title': 'Sax Berlin - Banksy On The Grave Yard Shift',
        'meta_description': 'Compra la obra de arte de Sax Berlin en InCollect.',
        'headings': {'h1': ['Sax Berlin - Banksy On The Grave Yard Shift'], 'h2': []},
        'images': [],
        'links': [],
        'word_count': 500,
    }
    mock_call_gemini.return_value = {
        'json_ld': {'@context': 'https://schema.org', '@graph': []},
        'entities': [{'type': 'Product', 'name': 'Sax Berlin', 'properties': {}}],
        'relationships': [{'from': 'Product', 'to': 'Creator', 'relation': 'createdBy'}],
    }
    result = entity_agent.generate(
        url='https://www.incollect.com/listing/873915',
        page_type='Product',
        page_data=page_data,
    )
    assert result['error'] is None
    assert 'json_ld' in result
    assert 'entities' in result
    assert 'relationships' in result
    mock_call_gemini.assert_called_once()


def test_entity_agent_generate_no_data(entity_agent):
    result = entity_agent.generate(url='https://example.com', page_type='Product', page_data={})
    assert result['error'] == 'No page data provided'
    assert result['json_ld'] is None


def test_geo_content_agent_optimize_success(geo_agent):
    analysis = {
        'seo_score': 55,
        'geo_score': 30,
        'overall_score': 42,
        'findings': [
            {
                'severity': 'critical',
                'category': 'html-structure',
                'title': 'Missing JSON-LD',
                'description': 'No structured data was found on the page.',
                'suggestion': 'Add JSON-LD structured data',
                'is_missing': True,
                'metric_value': None,
                'code_snippet': None,
            }
        ],
    }
    html = '<html><head><title>Test</title></head><body><h1>Product</h1></body></html>'
    result = geo_agent.optimize(
        url='https://www.incollect.com/listing/873915',
        page_type='Product',
        analysis=analysis,
        html=html,
    )
    assert result['error'] is None
    assert 'optimized_title' in result
    assert 'geo_content' in result
    assert 'qa_pairs' in result
    assert len(result['qa_pairs']) >= 3


def test_geo_content_agent_optimize_no_html(geo_agent):
    result = geo_agent.optimize(
        url='https://example.com',
        page_type='Product',
        analysis={},
        html='',
    )
    assert result['error'] == 'No HTML content provided'
    assert result['geo_content'] == ''


def test_llm_simulator_agent_simulate_success(simulator_agent):
    content = 'Sax Berlin - Banksy On The Grave Yard Shift. Fixing the Acetate. Compra esta obra de arte en InCollect.'
    result = simulator_agent.simulate(
        query='Recomiéndame obras de arte contemporáneo',
        content=content,
    )
    assert 'cited' in result
    assert 'confidence' in result
    assert 'quote' in result
    assert 'response_snippet' in result
    assert 'reason' in result
    assert result['query'] == 'Recomiéndame obras de arte contemporáneo'


def test_llm_simulator_agent_simulate_short_content(simulator_agent):
    result = simulator_agent.simulate(query='test', content='short')
    assert result['cited'] is False
    assert result['confidence'] == 0.0
    assert 'insufficient' in result['reason'].lower()
