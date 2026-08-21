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
    score_before: { seo: 70, geo: 42, overall: 56 },
    score_after_estimated: { seo: 95, geo: 85, overall: 90 },
    strategic_impacts: null,
    roi_projection: null,
    status: 'completed',
    error: null,
    ...overrides,
  };
}

function renderSummary(data: OptimizationData) {
  return render(
    <ExecutiveSummary
      analysisId={42}
      originalUrl="https://coderoad.com"
      initialScore={56}
      initialSeoScore={70}
      initialGeoScore={42}
      findings={[]}
      optimization={data}
      geoScore={null}
    />,
  );
}

/** The two coloured segments of a progression track, as percentage widths. */
function trackSegments(label: RegExp): string[] {
  const track = screen.getByLabelText(label);
  return Array.from(track.children).map((child) => (child as HTMLElement).style.width);
}

describe('ExecutiveSummary score cards', () => {
  it('draws the score as the filled length, not the remainder', () => {
    renderSummary(optimization());

    // Regression: the old card painted the whole track in the fill colour and then
    // masked `after`% of it, so the visible colour was everything the page had NOT
    // scored. The muted stretch is the before score; the coloured one is the gain.
    expect(trackSegments(/Before 56 out of 100, after 90 out of 100/)).toEqual(['56%', '34%']);
    expect(trackSegments(/Before 70 out of 100, after 95 out of 100/)).toEqual(['70%', '25%']);
    expect(trackSegments(/Before 42 out of 100, after 85 out of 100/)).toEqual(['42%', '43%']);
  });

  it('paints a regression in the destructive tone instead of the success tone', () => {
    renderSummary(optimization({ score_after_estimated: { seo: 70, geo: 42, overall: 40 } }));

    const track = screen.getByLabelText(/Before 56 out of 100, after 40 out of 100/);
    const [existing, lost] = Array.from(track.children) as HTMLElement[];

    expect(existing.style.width).toBe('40%');
    expect(lost.style.width).toBe('16%');
    expect(lost.className).toContain('bg-destructive');
    expect(screen.getByText('-16 pts')).toBeInTheDocument();
  });

  it('states each score once, in its ring, with the before/after values on the track', () => {
    renderSummary(optimization());

    // One radial per card, each carrying its own score.
    const rings = screen.getAllByRole('progressbar');
    expect(rings.map((ring) => ring.getAttribute('aria-valuenow'))).toEqual(['90', '95', '85']);
    // The headline number is not repeated beside the ring any more.
    expect(screen.getAllByText('90')).toHaveLength(2); // the ring and the track's "After" label
    // Each card states where it landed, once, as a severity badge.
    expect(screen.getAllByText('Good')).toHaveLength(3);
  });
});
