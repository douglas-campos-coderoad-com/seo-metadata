import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { RecentTargetsList } from '@/features/history/components/RecentTargetsList';
import { useAppStore } from '@/shared/store/useAppStore';
import { mockFailingIngest, mockSuccessfulAnalysisPipeline } from './mockAnalysisApi';

const URL_PLACEHOLDER = /paste any e-commerce product url/i;

function resetStore() {
  useAppStore.setState({ targets: {}, targetIdByUrl: {}, runs: {}, findings: {}, projects: {} });
}

describe('submit analysis flow (User Story 1)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows an inline validation error for an invalid URL and never starts a run', async () => {
    const onStarted = vi.fn();
    const user = userEvent.setup();
    render(<UrlSubmitForm onStarted={onStarted} />);

    await user.type(screen.getByPlaceholderText(URL_PLACEHOLDER), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument();
    expect(onStarted).not.toHaveBeenCalled();
    expect(Object.keys(useAppStore.getState().runs)).toHaveLength(0);
  });

  it('starting analysis for a valid URL creates a queued run that progresses to complete', async () => {
    mockSuccessfulAnalysisPipeline();
    const onStarted = vi.fn();
    render(<UrlSubmitForm onStarted={onStarted} />);

    fireEvent.change(screen.getByPlaceholderText(URL_PLACEHOLDER), {
      target: { value: 'https://example.com/integration-test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    const { runId } = onStarted.mock.calls[0][0] as { runId: string };

    // 'queued' flips to 'fetching' synchronously the instant runPipeline() is kicked off inside
    // startAnalysis(), before this component even re-renders — so it's not an observable state here.
    await waitFor(() => expect(useAppStore.getState().runs[runId].status).toBe('complete'));
    expect(useAppStore.getState().runs[runId].score).not.toBeNull();
  });

  it('surfaces a specific failure reason for a URL that simulates a failure', async () => {
    mockFailingIngest();
    const onStarted = vi.fn();
    render(<UrlSubmitForm onStarted={onStarted} />);

    fireEvent.change(screen.getByPlaceholderText(URL_PLACEHOLDER), {
      target: { value: 'https://simulate-fail.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));

    await waitFor(() => expect(onStarted).toHaveBeenCalledTimes(1));
    const { runId } = onStarted.mock.calls[0][0] as { runId: string };

    await waitFor(() => expect(useAppStore.getState().runs[runId].status).toBe('failed'));
    expect(useAppStore.getState().runs[runId].failureReason).toBeTruthy();
  });

  it('lists a submitted URL under "Previously analyzed" without duplicating status logic', async () => {
    mockSuccessfulAnalysisPipeline();
    const user = userEvent.setup();
    render(
      <div>
        <UrlSubmitForm onStarted={() => {}} />
        <RecentTargetsList />
      </div>,
    );

    expect(screen.queryByText('Previously analyzed')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(URL_PLACEHOLDER), 'https://recent-test.example.com');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('Previously analyzed')).toBeInTheDocument();
    expect(screen.getByText('https://recent-test.example.com')).toBeInTheDocument();
  });
});
