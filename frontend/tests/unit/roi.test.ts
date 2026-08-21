import { describe, expect, it } from 'vitest';
import {
  calculateFullRoi,
  formatCount,
  formatCurrency,
  formatRoiPercent,
  monthsToRecover,
} from '@/features/analysis/lib/roi';

describe('calculateFullRoi', () => {
  it('mirrors the backend calculation with default metrics', () => {
    const result = calculateFullRoi(45, 92, 30, 85, {
      monthly_organic_traffic: 10000,
      generative_search_share: 0.2,
      conversion_rate: 0.015,
      avg_order_value: 150,
      cost_per_product: 1,
    });

    expect(result.incremental_traffic_monthly).toEqual({
      seo_traditional: 3760, // 8000 * (0.92 - 0.45)
      geo_ai: 1100, // 2000 * (0.85 - 0.30)
      total: 4860,
    });
    expect(result.financial_impact_annual.incremental_revenue).toBe(131220.0); // 4860 * 2.25 * 12
    expect(result.financial_impact_annual.optimization_cost).toBe(1.0);
    expect(result.financial_impact_annual.net_profit).toBe(131219.0);
    expect(result.financial_impact_annual.roi_percentage).toBe(13121900.0);
  });

  it('respects custom business metrics', () => {
    const result = calculateFullRoi(30, 90, 30, 90, {
      monthly_organic_traffic: 50000,
      generative_search_share: 0.3,
      conversion_rate: 0.03,
      avg_order_value: 1000,
      cost_per_product: 0.05,
    });

    const seoTrafficBase = 50000 * 0.7; // 35000
    const aiTrafficBase = 50000 * 0.3; // 15000
    const incrementalSeo = seoTrafficBase * 0.6;
    const incrementalAi = aiTrafficBase * 0.6;
    const total = incrementalSeo + incrementalAi;

    expect(result.incremental_traffic_monthly.seo_traditional).toBe(
      Math.round(incrementalSeo),
    );
    expect(result.incremental_traffic_monthly.geo_ai).toBe(
      Math.round(incrementalAi),
    );
    expect(result.incremental_traffic_monthly.total).toBe(Math.round(total));
    expect(result.financial_impact_annual.optimization_cost).toBe(0.05);
    expect(result.metrics_used).toEqual(
      expect.objectContaining({
        monthly_organic_traffic: 50000,
        generative_search_share: 0.3,
        conversion_rate: 0.03,
        avg_order_value: 1000,
        cost_per_product: 0.05,
      }),
    );
    // productivity defaults are filled when not provided
    expect(result.metrics_used.manual_minutes_saved_per_listing).toBe(0);
    expect(result.metrics_used.listings_per_month).toBe(0);
    expect(result.metrics_used.labor_cost_per_hour).toBe(0);
    expect(result.metrics_used.annual_visora_cost).toBeNull();
    expect(result.productivity_impact_annual.annual_productivity_value).toBe(0);
  });

  it('yields zero ROI when there is no score improvement', () => {
    const result = calculateFullRoi(50, 50, 50, 50, {
      monthly_organic_traffic: 10000,
      generative_search_share: 0.2,
      conversion_rate: 0.015,
      avg_order_value: 150,
      cost_per_product: 1,
    });

    expect(result.incremental_traffic_monthly.total).toBe(0);
    expect(result.financial_impact_annual.incremental_revenue).toBe(0.0);
    expect(result.financial_impact_annual.net_profit).toBe(-1.0);
    expect(result.financial_impact_annual.roi_percentage).toBe(-100.0);
  });

  it('does not divide by zero when the optimization cost is zero', () => {
    const result = calculateFullRoi(30, 90, 30, 90, {
      monthly_organic_traffic: 10000,
      generative_search_share: 0.2,
      conversion_rate: 0.015,
      avg_order_value: 150,
      cost_per_product: 0,
    });

    expect(result.financial_impact_annual.optimization_cost).toBe(0.0);
    expect(result.financial_impact_annual.roi_percentage).toBe(0.0);
  });
});

describe('monthsToRecover', () => {
  it('returns fractional months when revenue eventually covers the cost', () => {
    // $120/yr revenue against $10 cost → 1 month
    expect(monthsToRecover(120, 10)).toBeCloseTo(1);
    // $120/yr against $30 → 3 months
    expect(monthsToRecover(120, 30)).toBeCloseTo(3);
  });

  it('returns 0 when there is no cost', () => {
    expect(monthsToRecover(1000, 0)).toBe(0);
  });

  it('returns null when there is no revenue to recover it', () => {
    expect(monthsToRecover(0, 10)).toBeNull();
    expect(monthsToRecover(-5, 10)).toBeNull();
  });
});

describe('formatters', () => {
  it('formats currency with and without compact notation', () => {
    expect(formatCurrency(131220)).toBe('$131,220');
    expect(formatCurrency(131220, true)).toBe('$131.2K');
  });

  it('formats large counts compactly only when they are large', () => {
    expect(formatCount(4860)).toBe('4,860');
    expect(formatCount(48600, true)).toBe('48.6K');
  });

  it('formats ROI percentages with a sign and compact notation for huge values', () => {
    expect(formatRoiPercent(13121900)).toBe('+13.1M%');
    expect(formatRoiPercent(-100)).toBe('-100%');
    expect(formatRoiPercent(0)).toBe('0%');
  });
});
