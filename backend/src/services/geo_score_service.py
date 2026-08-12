"""
GEO Score & ROI SaaS Service (geo_score_service.py)

Calculates:
  3.1. GEO Citation Score (0-100) evaluating:
       - Fact Density
       - AEO Structure
       - Entity Coverage
       - JSON-LD Validity
  3.2. AI Financial Impact Calculator:
       - Generative search traffic share (SearchGPT / Perplexity)
       - Operational savings vs marginal AI API cost ($0.03 USD/product)
"""
import json
import logging
import re
from typing import Optional

logger = logging.getLogger(__name__)

# ── Scoring weights ───────────────────────────────────────────────────────
WEIGHTS = {
    'fact_density': 0.25,
    'aeo_structure': 0.25,
    'entity_coverage': 0.25,
    'json_ld_validity': 0.25,
}

# Default ROI parameters
DEFAULT_COST_PER_PRODUCT = 0.03  # USD
DEFAULT_GENERATIVE_SEARCH_SHARE = 0.10  # 10%
DEFAULT_CONVERSION_RATE = 0.02  # 2%
DEFAULT_AVG_ORDER_VALUE = 500.0  # USD


# ── 3.1 GEO Citation Score ────────────────────────────────────────────────


def _extract_facts(text: str) -> list:
    """Extract verifiable facts from text (numbers, dimensions, materials, prices...)."""
    facts = []
    if not text:
        return facts

    # Numeric facts (dimensions, prices, dates, quantities)
    numeric_patterns = [
        r'\b\d+(?:\.\d+)?\s*(?:cm|mm|m|in|ft|kg|g|lb|oz|USD|EUR|GBP)\b',
        r'\b\d{4}\b',  # years
        r'\$\s?\d+(?:,\d{3})*(?:\.\d{2})?',
        r'\b\d+\s*x\s*\d+\s*x\s*\d+\b',  # dimensions like 45x45x80
    ]
    for pattern in numeric_patterns:
        facts.extend(re.findall(pattern, text, re.IGNORECASE))

    # Known materials / terminology
    material_keywords = [
        'wood', 'oak', 'walnut', 'mahogany', 'ebony', 'rosewood', 'teak',
        'bronze', 'brass', 'copper', 'steel', 'iron', 'aluminum', 'marble',
        'limestone', 'granite', 'glass', 'ceramic', 'porcelain', 'leather',
        'canvas', 'linen', 'silk', 'velvet', 'acrylic', 'oil', 'tempera',
        'watercolor', 'gouache', 'charcoal', 'ink', 'pastel', 'gesso',
    ]
    text_lower = text.lower()
    for material in material_keywords:
        if material in text_lower:
            facts.append(material)

    return list(set(facts))


def _aeo_structure_score(content: dict) -> int:
    """Score AEO structure (Q&A format + direct answers) 0-100."""
    qa_pairs = content.get('qa_pairs', []) or []
    geo_content = content.get('geo_content', '') or ''

    score = 0
    # Q&A pairs present
    score += min(50, len(qa_pairs) * 16.7)  # 3+ pairs = 50 pts

    # Direct questions answered in content
    question_markers = len(re.findall(r'\?', geo_content))
    score += min(25, question_markers * 5)

    # Has structured content length
    if len(geo_content) > 500:
        score += 15
    elif len(geo_content) > 200:
        score += 10
    elif len(geo_content) > 50:
        score += 5

    # Has semantic lists / tables
    if '\n- ' in geo_content or '\n* ' in geo_content:
        score += 10

    return min(100, int(score))


def _entity_coverage_score(json_ld: Optional[dict]) -> int:
    """Score entity coverage from JSON-LD 0-100."""
    if not json_ld:
        return 0

    graph = json_ld.get('@graph', []) if isinstance(json_ld, dict) else []
    if not graph and isinstance(json_ld, dict):
        graph = [json_ld]

    if not graph:
        return 0

    score = 0
    main_entity = graph[0] if graph else {}

    # Main type present
    if main_entity.get('@type'):
        score += 20

    # Key entity fields
    entity_fields = {
        'name': 10,
        'description': 10,
        'creator': 10,
        'material': 10,
        'dimensions': 10,
        'brand': 10,
        'offers': 10,
        'image': 10,
    }
    for field, pts in entity_fields.items():
        if main_entity.get(field):
            score += pts

    # Multiple entities in graph
    if len(graph) > 1:
        score += min(10, len(graph) * 2)

    return min(100, score)


def _json_ld_validity_score(json_ld: Optional[dict]) -> int:
    """Score JSON-LD validity 0-100."""
    if not json_ld:
        return 0

    score = 0

    # @context present and correct
    if json_ld.get('@context') == 'https://schema.org':
        score += 30
    elif json_ld.get('@context'):
        score += 15

    # @type present
    if json_ld.get('@type') or json_ld.get('@graph'):
        score += 20

    # Can be parsed as JSON (already validated by dict type)
    score += 25

    # Has graph or main entity structure
    if '@graph' in json_ld or json_ld.get('@type'):
        score += 25

    return min(100, score)


def calculate_geo_citation_score(
    optimized_content: Optional[dict] = None,
    optimized_json_ld: Optional[dict] = None,
    original_content: Optional[str] = None,
) -> dict:
    """
    Calculate the 0-100 GEO Citation Score from 4 weighted dimensions.
    """
    optimized_content = optimized_content or {}
    original_text = original_content or ''
    geo_content = optimized_content.get('geo_content', '') or ''

    # Fact Density: facts in GEO content vs original
    original_facts = len(_extract_facts(original_text))
    geo_facts = len(_extract_facts(geo_content))
    density_increase = geo_facts - original_facts
    fact_density = min(100, int(density_increase * 20)) if density_increase > 0 else (
        min(100, int(geo_facts * 15)) if geo_facts > 0 else 0
    )

    # AEO Structure
    aeo_structure = _aeo_structure_score(optimized_content)

    # Entity Coverage
    entity_coverage = _entity_coverage_score(optimized_json_ld)

    # JSON-LD Validity
    json_ld_validity = _json_ld_validity_score(optimized_json_ld)

    # Weighted total
    total = (
        fact_density * WEIGHTS['fact_density']
        + aeo_structure * WEIGHTS['aeo_structure']
        + entity_coverage * WEIGHTS['entity_coverage']
        + json_ld_validity * WEIGHTS['json_ld_validity']
    )
    total = round(total)

    return {
        'total_score': total,
        'dimensions': {
            'fact_density': {'score': fact_density, 'weight': WEIGHTS['fact_density'], 'facts_found': geo_facts},
            'aeo_structure': {'score': aeo_structure, 'weight': WEIGHTS['aeo_structure'], 'qa_pairs': len(optimized_content.get('qa_pairs', []) or [])},
            'entity_coverage': {'score': entity_coverage, 'weight': WEIGHTS['entity_coverage'], 'entities': len((optimized_json_ld or {}).get('@graph', []) or [])},
            'json_ld_validity': {'score': json_ld_validity, 'weight': WEIGHTS['json_ld_validity']},
        },
        'summary': {
            'fact_density': fact_density,
            'aeo_structure': aeo_structure,
            'entity_coverage': entity_coverage,
            'json_ld_validity': json_ld_validity,
        },
    }


# ── 3.2 ROI Calculator ────────────────────────────────────────────────────


def calculate_ai_roi(
    monthly_organic_traffic: int = 10000,
    generative_search_share: float = DEFAULT_GENERATIVE_SEARCH_SHARE,
    current_geo_score: int = 0,
    improved_geo_score: int = 100,
    products_count: int = 100,
    cost_per_product: float = DEFAULT_COST_PER_PRODUCT,
    conversion_rate: float = DEFAULT_CONVERSION_RATE,
    avg_order_value: float = DEFAULT_AVG_ORDER_VALUE,
) -> dict:
    """
    Estimate financial impact from generative search (SearchGPT / Perplexity).

    Returns:
    - Current and post-optimization AI traffic share
    - Revenue from AI traffic
    - API / operational cost
    - Net ROI
    """
    if current_geo_score < 0 or current_geo_score > 100:
        raise ValueError('current_geo_score must be between 0 and 100')
    if improved_geo_score < 0 or improved_geo_score > 100:
        raise ValueError('improved_geo_score must be between 0 and 100')

    # Visibility factor: geo_score is a proxy for AI citability (0-1)
    current_visibility = current_geo_score / 100.0
    improved_visibility = improved_geo_score / 100.0

    # AI traffic share
    current_ai_traffic = monthly_organic_traffic * generative_search_share * current_visibility
    improved_ai_traffic = monthly_organic_traffic * generative_search_share * improved_visibility
    incremental_ai_traffic = improved_ai_traffic - current_ai_traffic

    # Revenue from AI traffic
    current_ai_revenue = current_ai_traffic * conversion_rate * avg_order_value
    improved_ai_revenue = improved_ai_traffic * conversion_rate * avg_order_value
    incremental_ai_revenue = improved_ai_revenue - current_ai_revenue

    # Operational cost: marginal AI API cost per product
    ai_api_cost = products_count * cost_per_product

    # Operational savings / net ROI
    net_savings = incremental_ai_revenue - ai_api_cost
    roi_percentage = (net_savings / ai_api_cost) * 100 if ai_api_cost > 0 else 0.0

    return {
        'inputs': {
            'monthly_organic_traffic': monthly_organic_traffic,
            'generative_search_share': generative_search_share,
            'current_geo_score': current_geo_score,
            'improved_geo_score': improved_geo_score,
            'products_count': products_count,
            'cost_per_product': cost_per_product,
            'conversion_rate': conversion_rate,
            'avg_order_value': avg_order_value,
        },
        'ai_traffic': {
            'current': round(current_ai_traffic),
            'improved': round(improved_ai_traffic),
            'incremental': round(incremental_ai_traffic),
        },
        'revenue': {
            'current': round(current_ai_revenue, 2),
            'improved': round(improved_ai_revenue, 2),
            'incremental': round(incremental_ai_revenue, 2),
        },
        'costs': {
            'ai_api_cost': round(ai_api_cost, 2),
        },
        'roi': {
            'net_savings': round(net_savings, 2),
            'roi_percentage': round(roi_percentage, 1),
        },
    }