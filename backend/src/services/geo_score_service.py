"""
GEO Score & ROI SaaS Service (geo_score_service.py)

Calculates:
  3.1. GEO Citation Score (0-100) evaluating:
       - Fact Density
       - AEO Structure
       - Entity Coverage
       - JSON-LD Validity
  3.2. Full ROI Calculator:
       - Combined SEO traditional (Google) + GEO/AI (Perplexity, SearchGPT) impact
       - Uses real analysis scores and optional business metrics (with fallbacks)
"""
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

# ── Scoring weights ───────────────────────────────────────────────────────
WEIGHTS = {
    'fact_density': 0.25,
    'aeo_structure': 0.25,
    'entity_coverage': 0.25,
    'json_ld_validity': 0.25,
}

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


# ── 3.2 Full ROI Calculator ───────────────────────────────────────────────


class BusinessMetrics(BaseModel):
    monthly_organic_traffic: int = Field(default=10000, ge=0)
    generative_search_share: float = Field(default=0.20, ge=0.0, le=1.0)  # 20% IA, 80% SEO Tradicional
    conversion_rate: float = Field(default=0.015, ge=0.0, le=1.0)  # 1.5% Conversión
    avg_order_value: float = Field(default=150.0, ge=0.0)  # $150 Ticket promedio
    cost_per_product: float = Field(default=1.0, ge=0.0)  # $1 USD costo API/Página
    # ── Productividad / ROI Visora ──
    manual_minutes_saved_per_listing: float = Field(default=0.0, ge=0.0, description="Minutos manuales ahorrados por listing")
    listings_per_month: int = Field(default=0, ge=0, description="Listings procesados por mes")
    labor_cost_per_hour: float = Field(default=0.0, ge=0.0, description="Costo laboral USD/hora")
    annual_visora_cost: Optional[float] = Field(default=None, ge=0.0, description="Costo anual de Visora; si es None se deriva de cost_per_product*products_count*12")


# ── Productivity helpers ────────────────────────────────────────────────


def calculate_annual_productivity_value(
    manual_minutes_saved_per_listing: float,
    listings_per_month: int,
    labor_cost_per_hour: float,
) -> float:
    """
    Annual Productivity Value = (Manual minutes saved per listing / 60)
                                * listings per month * labor cost per hour * 12

    Retorna valor anual en USD redondeado a 2 decimales.
    Si algún input es 0 o negativo, retorna 0.0.
    """
    if manual_minutes_saved_per_listing <= 0 or listings_per_month <= 0 or labor_cost_per_hour <= 0:
        return 0.0
    hours_saved_per_listing = manual_minutes_saved_per_listing / 60.0
    monthly_value = hours_saved_per_listing * listings_per_month * labor_cost_per_hour
    annual_value = monthly_value * 12
    return round(annual_value, 2)


def calculate_productivity_roi(
    annual_quantified_benefit: float,
    annual_visora_cost: float,
) -> float:
    """
    ROI % = (Annual quantified benefit - Annual Visora cost) / Annual Visora cost * 100

    Si annual_visora_cost <= 0 retorna 0.0 para evitar división por cero.
    Redondeado a 1 decimal (consistente con roi_percentage existente).
    """
    if annual_visora_cost is None or annual_visora_cost <= 0:
        return 0.0
    roi = ((annual_quantified_benefit - annual_visora_cost) / annual_visora_cost) * 100
    return round(roi, 1)


def calculate_full_roi(
    current_seo_score: int,
    improved_seo_score: int,
    current_geo_score: int,
    improved_geo_score: int,
    products_count: int = 1,
    metrics: Optional[BusinessMetrics] = None,
) -> dict:
    """Estimate the combined SEO + GEO/AI financial impact and net ROI."""
    if metrics is None:
        metrics = BusinessMetrics()

    # 1. Distribución de Tráfico Base (SEO vs IA)
    ai_share = metrics.generative_search_share
    seo_share = 1.0 - ai_share

    seo_traffic_base = metrics.monthly_organic_traffic * seo_share
    ai_traffic_base = metrics.monthly_organic_traffic * ai_share

    # 2. Factores de Visibilidad (Score 0-100 a Ratio 0.0 - 1.0)
    current_seo_vis = current_seo_score / 100.0
    improved_seo_vis = improved_seo_score / 100.0

    current_geo_vis = current_geo_score / 100.0
    improved_geo_vis = improved_geo_score / 100.0

    # 3. Tráfico Incremental Mensual
    incremental_seo_traffic = seo_traffic_base * (improved_seo_vis - current_seo_vis)
    incremental_ai_traffic = ai_traffic_base * (improved_geo_vis - current_geo_vis)
    total_incremental_traffic = incremental_seo_traffic + incremental_ai_traffic

    # 4. Proyección Financiera Anual (12 meses)
    revenue_per_visit = metrics.conversion_rate * metrics.avg_order_value
    incremental_revenue_annual = (total_incremental_traffic * revenue_per_visit) * 12
    total_cost = products_count * metrics.cost_per_product

    # 5. Cálculo de ROI Neto (SEO/GEO incremental)
    net_profit = incremental_revenue_annual - total_cost
    roi_percentage = (net_profit / total_cost) * 100 if total_cost > 0 else 0.0

    # 6. Productividad — Annual Productivity Value + ROI Visora
    #    Annual Productivity Value = (manual_minutes_saved / 60) * listings_per_month * labor_cost_per_hour * 12
    #    ROI % = (Annual quantified benefit - Annual Visora cost) / Annual Visora cost * 100
    annual_productivity_value = calculate_annual_productivity_value(
        metrics.manual_minutes_saved_per_listing,
        metrics.listings_per_month,
        metrics.labor_cost_per_hour,
    )
    # Annual Visora cost: si el usuario lo provee se usa tal cual, si no se deriva del costo de optimización anualizado
    if metrics.annual_visora_cost is not None:
        annual_visora_cost = round(metrics.annual_visora_cost, 2)
    else:
        # fallback: costo mensual (total_cost) * 12 como estimación anual
        annual_visora_cost = round(total_cost * 12, 2) if total_cost > 0 else 0.0

    annual_quantified_benefit = round(incremental_revenue_annual + annual_productivity_value, 2)
    productivity_roi_percentage = calculate_productivity_roi(annual_quantified_benefit, annual_visora_cost)
    productivity_only_roi_percentage = calculate_productivity_roi(annual_productivity_value, annual_visora_cost)

    return {
        'metrics_used': metrics.model_dump(),
        'incremental_traffic_monthly': {
            'seo_traditional': round(incremental_seo_traffic),
            'geo_ai': round(incremental_ai_traffic),
            'total': round(total_incremental_traffic),
        },
        'financial_impact_annual': {
            'incremental_revenue': round(incremental_revenue_annual, 2),
            'optimization_cost': round(total_cost, 2),
            'net_profit': round(net_profit, 2),
            'roi_percentage': round(roi_percentage, 1),
        },
        'productivity_impact_annual': {
            'annual_productivity_value': annual_productivity_value,
            'annual_visora_cost': annual_visora_cost,
            'annual_quantified_benefit': annual_quantified_benefit,
            'productivity_roi_percentage': productivity_roi_percentage,
            'productivity_only_roi_percentage': productivity_only_roi_percentage,
        },
    }