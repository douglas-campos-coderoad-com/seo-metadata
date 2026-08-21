import { describe, expect, it } from 'vitest';
import {
  aiRecommendationRate,
  attributeAccuracy,
  formatDuration,
  formatMinutes,
  formatPercent,
  issueResolutionRate,
  optimizationTime,
  resolvedCategories,
} from '@/features/analysis/lib/kpis';
import type { OptimizationData } from '@/features/analysis/hooks/useOptimize';
import type { Finding, FindingCategory, FindingSeverity } from '@/shared/types';

function optimization(overrides: Partial<OptimizationData> = {}): OptimizationData {
  return {
    id: 1,
    analysis_id: 42,
    optimized_html: '<p>x</p>',
    optimized_json_ld: null,
    optimized_content: null,
    changes: null,
    copy_paste_ready: null,
    score_before: { seo: 53, geo: 40, overall: 46 },
    score_after_estimated: { seo: 92, geo: 88, overall: 90 },
    strategic_impacts: null,
    roi_projection: null,
    status: 'completed',
    error: null,
    ...overrides,
  };
}

function finding(category: FindingCategory, severity: FindingSeverity, id = `${category}-${severity}`): Finding {
  return {
    id,
    runId: '42',
    category,
    severity,
    title: `${category} issue`,
    description: 'desc',
    metricValue: null,
    isMissing: false,
    recommendations: [],
  };
}

describe('resolvedCategories', () => {
  it('maps the optimizer change elements onto finding categories', () => {
    const categories = resolvedCategories(
      optimization({
        changes: [
          { element: 'meta_description' },
          { element: 'og_tags' },
          { element: 'images_alt' },
          { element: 'canonical' },
        ],
      }),
    );

    expect([...categories].sort()).toEqual(['crawlability', 'images', 'metadata', 'social']);
  });

  it('counts artifacts delivered outside the change log', () => {
    const categories = resolvedCategories(
      optimization({
        changes: [],
        optimized_json_ld: { '@type': 'Product' },
        optimized_content: { qa_pairs: [{ question: 'q', answer: 'a' }] },
      }),
    );

    expect([...categories].sort()).toEqual(['geo_aeo', 'structured_data']);
  });

  it('is empty without an optimization', () => {
    expect(resolvedCategories(null).size).toBe(0);
  });
});

describe('aiRecommendationRate', () => {
  it('counts the Q&A set as the test queries and scales by citability', () => {
    const result = aiRecommendationRate(
      25,
      75,
      optimization({
        optimized_content: {
          qa_pairs: [
            { question: 'q1', answer: 'a' },
            { question: 'q2', answer: 'a' },
            { question: 'q3', answer: 'a' },
            { question: 'q4', answer: 'a' },
          ],
        },
      }),
    );

    expect(result.queries).toBe(4);
    expect(result.hasQuerySet).toBe(true);
    expect(result.recommendedBefore).toBe(1); // round(4 × 0.25)
    expect(result.recommendedAfter).toBe(3); // round(4 × 0.75)
    expect(result.percentBefore).toBe(25);
    expect(result.percentAfter).toBe(75);
  });

  it('falls back to the citability score when no Q&A set exists', () => {
    const result = aiRecommendationRate(40, 88, optimization());

    expect(result.queries).toBe(0);
    expect(result.hasQuerySet).toBe(false);
    expect(result.percentBefore).toBe(40);
    expect(result.percentAfter).toBe(88);
  });

  it('reports no rate when the GEO score is unknown', () => {
    const result = aiRecommendationRate(null, null, optimization());
    expect(result.percentBefore).toBeNull();
    expect(result.percentAfter).toBeNull();
  });
});

describe('attributeAccuracy', () => {
  it('scores a complete product graph at 100%', () => {
    const result = attributeAccuracy(
      optimization({
        optimized_json_ld: {
          '@type': 'Product',
          name: 'Oak Dining Chair',
          description: 'A solid oak chair.',
          brand: { '@type': 'Brand', name: 'Coderoad' },
          image: 'https://example.com/chair.jpg',
          sku: 'CHR-001',
          url: 'https://example.com/chair',
          aggregateRating: { ratingValue: '4.6', reviewCount: 12 },
          offers: {
            '@type': 'Offer',
            price: '499.00',
            priceCurrency: 'USD',
            availability: 'https://schema.org/InStock',
          },
        },
      }),
    );

    expect(result.denominator).toBe(10);
    expect(result.numerator).toBe(10);
    expect(result.percent).toBe(100);
    expect(result.checks.filter((check) => !check.correct)).toEqual([]);
  });

  it('finds the product inside an @graph and flags what is missing', () => {
    const result = attributeAccuracy(
      optimization({
        optimized_json_ld: {
          '@graph': [
            { '@type': 'WebPage', name: 'Chair page' },
            {
              '@type': 'Product',
              name: 'Oak Dining Chair',
              description: 'A solid oak chair.',
              offers: { '@type': 'Offer', price: 499, priceCurrency: 'USD' },
            },
          ],
        },
      }),
    );

    expect(result.numerator).toBe(4); // name, description, price, currency
    expect(result.percent).toBe(40);
    expect(result.checks.filter((c) => !c.correct).map((c) => c.key).sort()).toEqual([
      'availability',
      'brand',
      'identifier',
      'image',
      'rating',
      'url',
    ]);
  });

  it('falls back to the optimized copy for name and description', () => {
    const result = attributeAccuracy(
      optimization({
        optimized_json_ld: null,
        optimized_content: {
          optimized_title: 'Oak Dining Chair — Coderoad',
          optimized_meta_description: 'A solid oak chair built to last.',
        },
      }),
    );

    expect(result.numerator).toBe(2);
    expect(result.percent).toBe(20);
  });

  it('rejects a non-numeric price and an out-of-range rating', () => {
    const result = attributeAccuracy(
      optimization({
        optimized_json_ld: {
          '@type': 'Product',
          aggregateRating: { ratingValue: '92' },
          offers: { price: 'call us' },
        },
      }),
    );

    const byKey = Object.fromEntries(result.checks.map((check) => [check.key, check.correct]));
    expect(byKey.price).toBe(false);
    expect(byKey.rating).toBe(false);
  });

  it('evaluates every attribute as missing without an optimization', () => {
    const result = attributeAccuracy(null);
    expect(result.numerator).toBe(0);
    expect(result.percent).toBe(0);
    expect(result.hasStructuredData).toBe(false);
  });

  it('treats an empty JSON-LD shell as no structured data', () => {
    expect(attributeAccuracy(optimization({ optimized_json_ld: null })).hasStructuredData).toBe(false);
    expect(attributeAccuracy(optimization({ optimized_json_ld: {} })).hasStructuredData).toBe(false);
    // Type and context alone carry no product data.
    expect(
      attributeAccuracy(
        optimization({ optimized_json_ld: { '@context': 'https://schema.org', '@type': 'Product' } }),
      ).hasStructuredData,
    ).toBe(false);
    expect(
      attributeAccuracy(optimization({ optimized_json_ld: { '@type': 'Product', name: 'Chair' } }))
        .hasStructuredData,
    ).toBe(true);
  });
});

describe('issueResolutionRate', () => {
  const findings = [
    finding('metadata', 'critical'),
    finding('structured_data', 'warning'),
    finding('images', 'medium'),
    finding('performance', 'critical'), // ineligible — needs infrastructure work
    finding('crawlability', 'warning'), // ineligible
    finding('metadata', 'good', 'metadata-good'), // passing, never counted
  ];

  it('divides the resolved issues by the eligible ones only', () => {
    const result = issueResolutionRate(
      findings,
      optimization({ changes: [{ element: 'title' }, { element: 'json_ld' }] }),
    );

    expect(result.denominator).toBe(3); // metadata, structured_data, images
    expect(result.numerator).toBe(2); // metadata + structured_data touched
    expect(result.percent).toBe(67);
    expect(result.pending).toBe(1);
    expect(result.ineligible).toBe(2);
  });

  it('reports no rate when nothing auto-fixable was detected', () => {
    const result = issueResolutionRate([finding('performance', 'critical')], optimization({ changes: [] }));
    expect(result.denominator).toBe(0);
    expect(result.percent).toBeNull();
  });
});

describe('optimizationTime', () => {
  const findings = [
    finding('metadata', 'critical'), // 1 h
    finding('metadata', 'warning', 'metadata-warning'), // 0.5 h
    finding('images', 'medium'), // 0.25 h
    finding('performance', 'critical', 'perf-critical'), // ineligible
  ];

  it('weighs the manual baseline against the measured run duration', () => {
    const result = optimizationTime(
      findings,
      optimization({
        changes: [{ element: 'title' }, { element: 'images_alt' }],
        created_at: '2026-08-21T10:00:00Z',
        updated_at: '2026-08-21T10:03:00Z',
      }),
    );

    expect(result.issuesResolved).toBe(3);
    expect(result.manualHours).toBe(1.75);
    expect(result.visoraMinutes).toBe(3);
    expect(result.hoursSaved).toBe(1.7);
    expect(result.speedupFactor).toBe(35);
  });

  it('leaves the duration unknown when the timestamps are missing', () => {
    const result = optimizationTime(findings, optimization({ changes: [{ element: 'title' }] }));

    expect(result.manualHours).toBe(1.5); // metadata critical + high
    expect(result.visoraMinutes).toBeNull();
    expect(result.speedupFactor).toBeNull();
  });

  it('rejects a timestamp gap too short to have been the run', () => {
    const result = optimizationTime(
      findings,
      optimization({
        changes: [{ element: 'title' }],
        created_at: '2026-08-21T10:00:00Z',
        updated_at: '2026-08-21T10:00:01Z',
      }),
    );

    // A one-second gap would otherwise report "5400× faster".
    expect(result.manualHours).toBe(1.5);
    expect(result.visoraMinutes).toBeNull();
    expect(result.hoursSaved).toBeNull();
    expect(result.speedupFactor).toBeNull();
  });

  it('withholds a multiplier that would not be credible', () => {
    const result = optimizationTime(
      findings,
      optimization({
        changes: [{ element: 'title' }],
        created_at: '2026-08-21T10:00:00Z',
        updated_at: '2026-08-21T10:00:10Z', // 10 s → 540×, past MAX_CREDIBLE_SPEEDUP
      }),
    );

    expect(result.visoraMinutes).toBe(0.2);
    expect(result.speedupFactor).toBeNull();
  });
});

describe('formatters', () => {
  it('formats percentages and unknown values', () => {
    expect(formatPercent(67)).toBe('67%');
    expect(formatPercent(null)).toBe('—');
  });

  it('formats durations across magnitudes', () => {
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(0.25)).toBe('15 min');
    expect(formatDuration(2.5)).toBe('2.5 h');
    expect(formatDuration(null)).toBe('—');
  });

  it('formats run durations from minutes', () => {
    expect(formatMinutes(0.5)).toBe('30 s');
    expect(formatMinutes(3)).toBe('3 min');
    expect(formatMinutes(90)).toBe('1.5 h');
    expect(formatMinutes(null)).toBe('—');
  });
});
