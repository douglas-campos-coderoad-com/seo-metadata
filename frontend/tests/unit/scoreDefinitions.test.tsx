import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreSummary } from '@/features/analysis/components/ScoreSummary';
import { BeforeAfterScoreChart } from '@/features/analysis/components/BeforeAfterScoreChart';
import { ExecutiveSummary } from '@/features/analysis/components/ExecutiveSummary';
import { SCORE_DEFINITIONS, scoreTooltip } from '@/shared/lib/scoreDefinitions';
import type { OptimizationData } from '@/features/analysis/hooks/useOptimize';

vi.mock('@/shared/lib/apiClient', () => ({
  apiClient: { get: vi.fn().mockRejectedValue(new Error('no roi')), post: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

describe('scoreTooltip', () => {
  it('pairs the score name with its definition', () => {
    expect(scoreTooltip('overall')).toBe(`Overall Score — ${SCORE_DEFINITIONS.overall.description}`);
    expect(scoreTooltip('seo')).toContain('technical SEO health');
    expect(scoreTooltip('geo')).toContain('AI-powered search and answer engines');
  });

  it('states how the overall score is derived', () => {
    expect(SCORE_DEFINITIONS.overall.description).toContain('average of the SEO Score and the GEO Score');
  });
});

describe('ScoreSummary', () => {
  it('explains all three scores', () => {
    render(<ScoreSummary scores={{ overall: 62, seo: 70, geo: 55 }} />);

    expect(screen.getByLabelText(scoreTooltip('overall'))).toBeInTheDocument();
    expect(screen.getByLabelText(scoreTooltip('seo'))).toBeInTheDocument();
    expect(screen.getByLabelText(scoreTooltip('geo'))).toBeInTheDocument();
  });

  it('still explains the overall score with no breakdown to show', () => {
    render(<ScoreSummary scores={{ overall: 62 }} />);

    expect(screen.getByLabelText(scoreTooltip('overall'))).toBeInTheDocument();
    expect(screen.queryByLabelText(scoreTooltip('seo'))).not.toBeInTheDocument();
  });
});

describe('BeforeAfterScoreChart', () => {
  it('carries the definitions on the ring and the sub-score rows', () => {
    const { container } = render(
      <BeforeAfterScoreChart
        before={{ overall: 46, seo: 53, geo: 40 }}
        after={{ overall: 90, seo: 92, geo: 88 }}
      />,
    );

    // One ring title per column.
    expect(container.querySelectorAll('svg > title')).toHaveLength(2);
    expect(container.querySelector('svg > title')?.textContent).toBe(scoreTooltip('overall'));
    expect(screen.getAllByTitle(scoreTooltip('seo'))).toHaveLength(2);
    expect(screen.getAllByTitle(scoreTooltip('geo'))).toHaveLength(2);
  });
});

describe('ExecutiveSummary score cards', () => {
  const optimization: OptimizationData = {
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
  };

  it('prints each definition as visible copy on its card', () => {
    render(
      <ExecutiveSummary
        analysisId={42}
        originalUrl="https://coderoad.com"
        initialScore={46}
        initialSeoScore={53}
        initialGeoScore={40}
        findings={[]}
        optimization={optimization}
        geoScore={null}
      />,
    );

    expect(screen.getByText(SCORE_DEFINITIONS.overall.description)).toBeInTheDocument();
    expect(screen.getByText(SCORE_DEFINITIONS.seo.description)).toBeInTheDocument();
    expect(screen.getByText(SCORE_DEFINITIONS.geo.description)).toBeInTheDocument();
  });

  it('explains the current score while optimization is still pending', () => {
    render(
      <ExecutiveSummary
        analysisId={42}
        originalUrl="https://coderoad.com"
        initialScore={46}
        initialSeoScore={53}
        initialGeoScore={40}
        findings={[]}
        optimization={null}
        geoScore={null}
      />,
    );

    expect(screen.getByLabelText(scoreTooltip('overall'))).toBeInTheDocument();
  });
});
