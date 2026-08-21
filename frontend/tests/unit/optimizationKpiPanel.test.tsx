import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OptimizationKpiPanel } from '@/features/analysis/components/OptimizationKpiPanel';
import { ExecutiveSummary } from '@/features/analysis/components/ExecutiveSummary';
import type { OptimizationData } from '@/features/analysis/hooks/useOptimize';
import type { Finding, FindingCategory, FindingSeverity } from '@/shared/types';

vi.mock('@/shared/lib/apiClient', () => ({
  apiClient: { get: vi.fn().mockRejectedValue(new Error('no roi')), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

function optimization(overrides: Partial<OptimizationData> = {}): OptimizationData {
  return {
    id: 1,
    analysis_id: 42,
    optimized_html: '<p>x</p>',
    optimized_json_ld: {
      '@type': 'Product',
      name: 'Oak Dining Chair',
      description: 'A solid oak chair.',
      brand: 'Coderoad',
      image: 'https://example.com/chair.jpg',
      offers: { price: '499.00', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
    },
    optimized_content: {
      optimized_title: 'Oak Dining Chair',
      qa_pairs: [
        { question: 'q1', answer: 'a' },
        { question: 'q2', answer: 'a' },
        { question: 'q3', answer: 'a' },
        { question: 'q4', answer: 'a' },
      ],
    },
    changes: [{ element: 'title' }, { element: 'json_ld' }],
    copy_paste_ready: null,
    score_before: { seo: 53, geo: 25, overall: 46 },
    score_after_estimated: { seo: 92, geo: 75, overall: 90 },
    strategic_impacts: null,
    roi_projection: null,
    status: 'completed',
    error: null,
    created_at: '2026-08-21T10:00:00Z',
    updated_at: '2026-08-21T10:03:00Z',
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

const findings = [
  finding('metadata', 'critical'),
  finding('structured_data', 'warning'),
  finding('images', 'medium'),
  finding('performance', 'critical'),
];

describe('OptimizationKpiPanel', () => {
  it('renders all four KPIs with their values', () => {
    render(
      <OptimizationKpiPanel
        findings={findings}
        optimization={optimization()}
        geoScoreBefore={25}
        geoScoreAfter={75}
      />,
    );

    expect(screen.getByText('AI Recommendation Rate')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument(); // 3 of 4 test queries
    expect(screen.getByText(/3 of 4 AEO test queries/)).toBeInTheDocument();

    expect(screen.getByText('Attribute Accuracy')).toBeInTheDocument();
    expect(screen.getByText(/7 of 10 attributes an answer engine needs/)).toBeInTheDocument();
    // The three missing ones are summarised inline, not dumped as a badge per attribute.
    expect(screen.getByText(/Missing: SKU \/ GTIN, URL, Rating/)).toBeInTheDocument();

    expect(screen.getByText('Issue Resolution Rate')).toBeInTheDocument();
    expect(screen.getByText('67%')).toBeInTheDocument(); // metadata + structured_data of 3 eligible
    expect(screen.getByText(/2 of 3 auto-fixable issues resolved/)).toBeInTheDocument();
    expect(screen.getByText(/1 issue needs infrastructure work/)).toBeInTheDocument();

    expect(screen.getByText('Optimization Time')).toBeInTheDocument();
    // Once as the headline value, once on the "Visora" row of the comparison bars.
    expect(screen.getAllByText('3 min')).toHaveLength(2);
    expect(screen.getByText('By hand')).toBeInTheDocument();
    expect(screen.getByText('30× faster')).toBeInTheDocument();
    expect(screen.getByText(/1.5 h of manual work across 2 resolved issues/)).toBeInTheDocument();
  });

  it('says so plainly when the optimizer returned no structured data', () => {
    render(
      <OptimizationKpiPanel
        findings={findings}
        optimization={optimization({ optimized_json_ld: null, optimized_content: null })}
        geoScoreBefore={25}
        geoScoreAfter={75}
      />,
    );

    expect(screen.getByText(/returned no structured data for this page/)).toBeInTheDocument();
    expect(screen.queryByText(/Missing:/)).not.toBeInTheDocument();
  });

  it('drops the run duration and the multiplier when the timestamps are implausible', () => {
    render(
      <OptimizationKpiPanel
        findings={findings}
        optimization={optimization({ updated_at: '2026-08-21T10:00:01Z' })}
        geoScoreBefore={25}
        geoScoreAfter={75}
      />,
    );

    expect(screen.getByText(/This run's duration was not recorded/)).toBeInTheDocument();
    expect(screen.queryByText(/× faster/)).not.toBeInTheDocument();
  });

  it('states the fallback when no Q&A test set was generated', () => {
    render(
      <OptimizationKpiPanel
        findings={findings}
        optimization={optimization({ optimized_content: { optimized_title: 'Oak Dining Chair' } })}
        geoScoreBefore={25}
        geoScoreAfter={88}
      />,
    );

    expect(screen.getByText('88%')).toBeInTheDocument();
    expect(screen.getByText(/No Q&A test set was generated/)).toBeInTheDocument();
  });

  it('renders nothing before an optimization exists', () => {
    const { container } = render(
      <OptimizationKpiPanel findings={findings} optimization={null} geoScoreBefore={25} geoScoreAfter={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ExecutiveSummary — KPIs', () => {
  it('includes the KPI panel once the optimization is available', () => {
    render(
      <ExecutiveSummary
        analysisId={42}
        originalUrl="https://coderoad.com"
        initialScore={46}
        initialSeoScore={53}
        initialGeoScore={25}
        findings={findings}
        optimization={optimization()}
        geoScore={null}
      />,
    );

    expect(screen.getByText('Key Performance Indicators')).toBeInTheDocument();
    expect(screen.getByText('AI Recommendation Rate')).toBeInTheDocument();
    expect(screen.getByText('Attribute Accuracy')).toBeInTheDocument();
    expect(screen.getByText('Issue Resolution Rate')).toBeInTheDocument();
    expect(screen.getByText('Optimization Time')).toBeInTheDocument();
  });

  it('omits the KPI panel while optimization is still pending', () => {
    render(
      <ExecutiveSummary
        analysisId={42}
        originalUrl="https://coderoad.com"
        initialScore={46}
        initialSeoScore={53}
        initialGeoScore={25}
        findings={findings}
        optimization={null}
        geoScore={null}
      />,
    );

    expect(screen.queryByText('Key Performance Indicators')).not.toBeInTheDocument();
  });
});
