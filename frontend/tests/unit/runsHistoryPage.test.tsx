import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HistoricalAnalysisPage from '@/app/runs/history/[projectId]/[analysisId]/page';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import { apiClient } from '@/lib/api-client';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: '7', analysisId: '555' }),
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/shared/realtime/AnalysisApiService', () => ({
  analysisApiService: {
    getProject: vi.fn(),
    getAnalysis: vi.fn(),
    startAnalysis: vi.fn(),
    getRun: vi.fn(),
    subscribeToRun: vi.fn(() => () => {}),
    attachAnalysisToProject: vi.fn(),
  },
}));

const mockedService = vi.mocked(analysisApiService, true);
const mockedClient = vi.mocked(apiClient, true);

const HISTORICAL_ANALYSIS = {
  id: 555,
  ingestedUrlId: 555,
  url: 'https://example.com/historical-product',
  seoScore: 70,
  geoScore: 60,
  overallScore: 65,
  analysis: { findings: [], recommendations: [] },
  jsonLd: null,
  status: 'completed',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  optimization: null,
};

const PROJECT = {
  id: 7,
  title: 'My Project',
  description: '',
  category: 'saas' as const,
  country: 'US',
  region: null,
  competitors: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('HistoricalAnalysisPage — view and re-run (specs/009 US2/US3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.getProject.mockResolvedValue(PROJECT);
    mockedService.getAnalysis.mockResolvedValue(HISTORICAL_ANALYSIS);
    mockedClient.get.mockRejectedValue(new Error('No optimization found for analysis with id 555'));
  });

  it('shows the original historical analysis and the owning project as a label', async () => {
    render(<HistoricalAnalysisPage />);

    expect(await screen.findByText('My Project')).toBeInTheDocument();
    expect(mockedService.getAnalysis).toHaveBeenCalledWith(7, 555);
    expect(screen.getByText(/historical-product/)).toBeInTheDocument();
  });

  it('a fresh analysis attaches the NEW analysis id to the project, never the historical one', async () => {
    mockedService.startAnalysis.mockResolvedValue({ targetId: 'target-1', runId: 'run-abc' });
    mockedService.getRun.mockReturnValue({
      id: 'run-abc',
      targetId: 'target-1',
      status: 'complete',
      startedAt: '2026-01-01T00:00:00Z',
      completedAt: '2026-01-01T00:00:05Z',
      score: 80,
      seoScore: 78,
      geoScore: 82,
      failureReason: null,
      findingIds: [],
      httpStatus: 200,
      contentType: 'text/html',
      contentSizeBytes: 1000,
      backendAnalysisId: 999,
    });
    mockedService.attachAnalysisToProject.mockResolvedValue({ ...HISTORICAL_ANALYSIS, id: 999 });

    render(<HistoricalAnalysisPage />);
    await screen.findByText('My Project');

    // Pre-filled with the historical analysis's own URL (spec.md Assumptions).
    const urlInput = screen.getByPlaceholderText(/paste any e-commerce product url/i);
    expect(urlInput).toHaveValue(HISTORICAL_ANALYSIS.url);

    await userEvent.click(screen.getByRole('button', { name: /^analyze$/i }));

    await waitFor(() => expect(mockedService.attachAnalysisToProject).toHaveBeenCalledWith(7, 999));
    // Never touches the original historical analysis id (FR-012).
    expect(mockedService.attachAnalysisToProject).not.toHaveBeenCalledWith(7, 555);
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/runs/run-abc'));
    // The historical record itself is read once and never re-fetched/mutated by this flow.
    expect(mockedService.getAnalysis).toHaveBeenCalledTimes(1);
  });
});
