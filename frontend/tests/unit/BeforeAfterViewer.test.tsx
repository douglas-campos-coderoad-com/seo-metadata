import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BeforeAfterViewer } from '@/features/analysis/components/BeforeAfterViewer';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedClient = vi.mocked(apiClient, true);

const OPTIMIZATION = {
  id: 1,
  analysis_id: 42,
  optimized_html: '<p>optimized</p>',
  optimized_json_ld: null,
  optimized_content: { optimized_title: 'New title' },
  changes: null,
  copy_paste_ready: null,
  score_before: null,
  score_after_estimated: { overall: 90, seo: 88, geo: 92 },
  roi_projection: null,
  status: 'completed',
  error: null,
};

const GEO_SCORE = { total_score: 80, dimensions: {}, summary: {}, has_optimization: true };

describe('BeforeAfterViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders preloaded after-data immediately with no POST or GET triggered', async () => {
    const user = userEvent.setup();
    render(
      <BeforeAfterViewer
        analysisId={42}
        originalUrl="https://example.com"
        initialScore={70}
        initialSeoScore={65}
        initialGeoScore={60}
        findings={[]}
        preloadedOptimization={OPTIMIZATION}
        preloadedAfterGeoScore={GEO_SCORE}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /before \/ after/i }));

    expect(screen.getByText('Optimized')).toBeInTheDocument();
    expect(screen.getByText('New title')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /run geo\/aeo optimizer/i })).not.toBeInTheDocument();
    expect(mockedClient.post).not.toHaveBeenCalled();
    expect(mockedClient.get).not.toHaveBeenCalled();
  });

  it('without preloaded props, the existing live-run pending state is unchanged', async () => {
    const user = userEvent.setup();
    render(
      <BeforeAfterViewer
        analysisId={42}
        originalUrl="https://example.com"
        initialScore={70}
        initialSeoScore={65}
        initialGeoScore={60}
        findings={[]}
      />,
    );

    await user.click(screen.getByRole('tab', { name: /before \/ after/i }));

    expect(screen.getByText('Pending')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run geo\/aeo optimizer/i })).toBeInTheDocument();
    expect(mockedClient.post).not.toHaveBeenCalled();
  });
});
