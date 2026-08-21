import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExecutiveSummary } from '@/features/analysis/components/ExecutiveSummary';
import type { OptimizationData } from '@/features/analysis/hooks/useOptimize';

vi.mock('@/shared/lib/apiClient', () => ({
  apiClient: { get: vi.fn().mockRejectedValue(new Error('no roi')), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

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

function renderSummary(optimizationData: OptimizationData | null) {
  return render(
    <ExecutiveSummary
      analysisId={42}
      originalUrl="https://coderoad.com"
      initialScore={46}
      initialSeoScore={53}
      initialGeoScore={40}
      findings={[]}
      optimization={optimizationData}
      geoScore={null}
    />,
  );
}

describe('ExecutiveSummary — Strategic Impact', () => {
  it('lists each impact with its supporting detail', () => {
    renderSummary(
      optimization({
        strategic_impacts: [
          { impact: 'Increase organic traffic 30-70%', detail: 'Richer structured data.', competitors: [] },
          { impact: 'Reduce reliance on paid ads', detail: null, competitors: [] },
        ],
      }),
    );

    expect(screen.getByText('Strategic Impact')).toBeInTheDocument();
    expect(screen.getByText('Increase organic traffic 30-70%')).toBeInTheDocument();
    expect(screen.getByText('Richer structured data.')).toBeInTheDocument();
    expect(screen.getByText('Reduce reliance on paid ads')).toBeInTheDocument();
  });

  it('names the competitors an impact is about, stripped to brand names', () => {
    renderSummary(
      optimization({
        strategic_impacts: [
          {
            impact: 'Strengthen positioning',
            detail: null,
            competitors: ['https://www.toptal.com', 'https://epam.com/'],
          },
        ],
      }),
    );

    expect(screen.getByText('toptal.com')).toBeInTheDocument();
    expect(screen.getByText('epam.com')).toBeInTheDocument();
  });

  it('omits the section entirely when there are no impacts', () => {
    renderSummary(optimization({ strategic_impacts: [] }));

    expect(screen.queryByText('Strategic Impact')).not.toBeInTheDocument();
  });

  it('omits the section for optimizations that predate the field', () => {
    renderSummary(optimization({ strategic_impacts: null }));

    expect(screen.queryByText('Strategic Impact')).not.toBeInTheDocument();
  });

  it('omits the section when nothing is optimized yet', () => {
    renderSummary(null);

    expect(screen.queryByText('Strategic Impact')).not.toBeInTheDocument();
  });
});
