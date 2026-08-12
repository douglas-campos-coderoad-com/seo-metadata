"""Tests for the GEO Score & ROI SaaS service."""
import pytest

from src.services.geo_score_service import (
    calculate_geo_citation_score,
    calculate_ai_roi,
    _extract_facts,
    _aeo_structure_score,
    _entity_coverage_score,
    _json_ld_validity_score,
)


# ── 3.1 GEO Citation Score tests ─────────────────────────────────────────


def test_extract_facts_returns_numeric_and_material_facts():
    text = (
        'This dining chair is made of polished walnut wood, measures 45x45x80 cm, '
        'and costs $1,200 USD. Created in the year 2024 by John Doe.'
    )
    facts = _extract_facts(text)
    assert len(facts) >= 4
    assert 'walnut' in facts
    assert 'wood' in facts


def test_extract_facts_empty_text():
    assert _extract_facts('') == []


def test_aeo_structure_scores_qa_pairs():
    content = {
        'qa_pairs': [
            {'question': 'Q1', 'answer': 'A1'},
            {'question': 'Q2', 'answer': 'A2'},
            {'question': 'Q3', 'answer': 'A3'},
        ],
        'geo_content': 'What material is this? It is walnut wood. How much is it? $1,200.',
    }
    score = _aeo_structure_score(content)
    assert score >= 50
    assert score <= 100


def test_aeo_structure_empty():
    assert _aeo_structure_score({}) == 0


def test_entity_coverage_scores_json_ld():
    json_ld = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Product',
                'name': 'Dining Chair',
                'description': 'A walnut chair',
                'creator': {'@type': 'Person', 'name': 'John Doe'},
                'material': 'walnut',
                'dimensions': {'@type': 'QuantitativeValue', 'value': '45', 'unitCode': 'CM'},
                'brand': {'@type': 'Brand', 'name': 'InCollect'},
                'offers': {'@type': 'Offer', 'price': '1200', 'priceCurrency': 'USD'},
            }
        ],
    }
    score = _entity_coverage_score(json_ld)
    assert score >= 80


def test_entity_coverage_no_json_ld():
    assert _entity_coverage_score(None) == 0


def test_json_ld_validity_scores_context():
    json_ld = {'@context': 'https://schema.org', '@type': 'Product', 'name': 'Chair'}
    score = _json_ld_validity_score(json_ld)
    assert score >= 75


def test_json_ld_validity_no_json_ld():
    assert _json_ld_validity_score(None) == 0


def test_calculate_geo_citation_score_success():
    optimized_content = {
        'geo_content': (
            'This chair is made of walnut wood, measures 45x45x80 cm, costs $1,200 USD. '
            'What is it? A premium dining chair. What material? Walnut.'
        ),
        'qa_pairs': [
            {'question': 'What is it?', 'answer': 'A walnut dining chair.'},
            {'question': 'What material?', 'answer': 'Walnut wood.'},
            {'question': 'Price?', 'answer': '$1,200 USD.'},
        ],
    }
    optimized_json_ld = {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Product',
                'name': 'Dining Chair',
                'description': 'A walnut chair',
                'creator': {'@type': 'Person', 'name': 'John Doe'},
                'material': 'walnut',
                'dimensions': {'@type': 'QuantitativeValue', 'value': '45', 'unitCode': 'CM'},
                'brand': {'@type': 'Brand', 'name': 'InCollect'},
                'offers': {'@type': 'Offer', 'price': '1200', 'priceCurrency': 'USD'},
            }
        ],
    }
    original_content = 'A chair for sale.'
    result = calculate_geo_citation_score(
        optimized_content=optimized_content,
        optimized_json_ld=optimized_json_ld,
        original_content=original_content,
    )
    assert 0 <= result['total_score'] <= 100
    assert result['dimensions']['fact_density']['score'] >= 0
    assert result['dimensions']['aeo_structure']['score'] >= 50
    assert result['dimensions']['entity_coverage']['score'] >= 80
    assert result['dimensions']['json_ld_validity']['score'] >= 75


def test_calculate_geo_citation_score_empty():
    result = calculate_geo_citation_score()
    assert result['total_score'] == 0
    assert result['dimensions']['fact_density']['score'] == 0


# ── 3.2 ROI Calculator tests ─────────────────────────────────────────────


def test_calculate_ai_roi_defaults():
    result = calculate_ai_roi()
    assert result['inputs']['monthly_organic_traffic'] == 10000
    assert result['inputs']['cost_per_product'] == 0.03
    assert result['costs']['ai_api_cost'] == 3.0  # 100 products * $0.03
    assert result['roi']['roi_percentage'] >= 0


def test_calculate_ai_roi_custom():
    result = calculate_ai_roi(
        monthly_organic_traffic=50000,
        generative_search_share=0.20,
        current_geo_score=30,
        improved_geo_score=80,
        products_count=500,
        cost_per_product=0.05,
        conversion_rate=0.03,
        avg_order_value=1000.0,
    )
    assert result['ai_traffic']['incremental'] >= 0
    assert result['revenue']['incremental'] >= 0
    assert result['costs']['ai_api_cost'] == 25.0  # 500 * $0.05
    assert result['roi']['net_savings'] >= 0


def test_calculate_ai_roi_no_improvement():
    result = calculate_ai_roi(current_geo_score=50, improved_geo_score=50)
    assert result['ai_traffic']['incremental'] == 0
    assert result['revenue']['incremental'] == 0
    # Cost still applies
    assert result['costs']['ai_api_cost'] == 3.0
    assert result['roi']['net_savings'] == -3.0


def test_calculate_ai_roi_invalid_score():
    with pytest.raises(ValueError):
        calculate_ai_roi(current_geo_score=150)
    with pytest.raises(ValueError):
        calculate_ai_roi(improved_geo_score=-5)