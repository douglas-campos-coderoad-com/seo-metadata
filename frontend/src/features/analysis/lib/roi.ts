// Client-side mirror of the backend's `calculate_full_roi`
// (backend/src/services/geo_score_service.py). Kept in sync so the user can
// explore "what-if" business assumptions instantly without re-running the
// (LLM-costly) optimizer. `products_count` is fixed at 1 because the API only
// exposes BusinessMetrics in the request body.

export interface BusinessMetricsInput {
  monthly_organic_traffic: number;
  generative_search_share: number;
  conversion_rate: number;
  avg_order_value: number;
  cost_per_product: number;
}

export interface RoiProjection {
  metrics_used: BusinessMetricsInput;
  incremental_traffic_monthly: {
    seo_traditional: number;
    geo_ai: number;
    total: number;
  };
  financial_impact_annual: {
    incremental_revenue: number;
    optimization_cost: number;
    net_profit: number;
    roi_percentage: number;
  };
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;

export function calculateFullRoi(
  currentSeoScore: number,
  improvedSeoScore: number,
  currentGeoScore: number,
  improvedGeoScore: number,
  metrics: BusinessMetricsInput,
): RoiProjection {
  const aiShare = metrics.generative_search_share;
  const seoShare = 1 - aiShare;

  const seoTrafficBase = metrics.monthly_organic_traffic * seoShare;
  const aiTrafficBase = metrics.monthly_organic_traffic * aiShare;

  const currentSeoVis = currentSeoScore / 100;
  const improvedSeoVis = improvedSeoScore / 100;
  const currentGeoVis = currentGeoScore / 100;
  const improvedGeoVis = improvedGeoScore / 100;

  const incrementalSeoTraffic =
    seoTrafficBase * (improvedSeoVis - currentSeoVis);
  const incrementalAiTraffic = aiTrafficBase * (improvedGeoVis - currentGeoVis);
  const totalIncrementalTraffic = incrementalSeoTraffic + incrementalAiTraffic;

  const revenuePerVisit = metrics.conversion_rate * metrics.avg_order_value;
  const incrementalRevenueAnnual =
    totalIncrementalTraffic * revenuePerVisit * 12;
  const totalCost = metrics.cost_per_product;

  const netProfit = incrementalRevenueAnnual - totalCost;
  const roiPercentage = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    metrics_used: { ...metrics },
    incremental_traffic_monthly: {
      seo_traditional: Math.round(incrementalSeoTraffic),
      geo_ai: Math.round(incrementalAiTraffic),
      total: Math.round(totalIncrementalTraffic),
    },
    financial_impact_annual: {
      incremental_revenue: round2(incrementalRevenueAnnual),
      optimization_cost: round2(totalCost),
      net_profit: round2(netProfit),
      roi_percentage: round1(roiPercentage),
    },
  };
}

/** Months needed for the incremental revenue to recover the optimization cost. */
export function monthsToRecover(
  annualIncrementalRevenue: number,
  optimizationCost: number,
): number | null {
  if (optimizationCost <= 0) return 0;
  if (annualIncrementalRevenue <= 0) return null;
  return (optimizationCost / annualIncrementalRevenue) * 12;
}

const usd = (notation: 'standard' | 'compact', fractionDigits: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation,
    maximumFractionDigits: fractionDigits,
  });

export function formatCurrency(value: number, compact = false): string {
  return usd(compact ? 'compact' : 'standard', compact ? 1 : 0).format(value);
}

export function formatCount(value: number, compact = false): string {
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(
    value,
  );
}

export function formatRoiPercent(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10000) {
    const compact = new Intl.NumberFormat('en-US', {
      notation: 'compact',
      maximumFractionDigits: 1,
    });
    return `${sign}${compact.format(abs)}%`;
  }
  return `${sign}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(abs)}%`;
}
