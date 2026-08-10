import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { RecentTargetsList } from '@/features/history/components/RecentTargetsList';
import { useAppStore } from '@/shared/store/useAppStore';

function resetStore() {
  useAppStore.setState({ targets: {}, targetIdByUrl: {}, runs: {}, findings: {}, projects: {}, automations: {} });
}

describe('submit analysis flow (User Story 1)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows an inline validation error for an invalid URL and never starts a run', async () => {
    const onStarted = vi.fn();
    const user = userEvent.setup();
    render(<UrlSubmitForm onStarted={onStarted} />);

    await user.type(screen.getByPlaceholderText('https://example.com/page'), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(screen.getByText(/enter a valid url/i)).toBeInTheDocument();
    expect(onStarted).not.toHaveBeenCalled();
    expect(Object.keys(useAppStore.getState().runs)).toHaveLength(0);
  });

  it('starting analysis for a valid URL creates a queued run that progresses to complete', async () => {
    vi.useFakeTimers();
    const onStarted = vi.fn();
    render(<UrlSubmitForm onStarted={onStarted} />);

    fireEvent.change(screen.getByPlaceholderText('https://example.com/page'), {
      target: { value: 'https://example.com/integration-test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(onStarted).toHaveBeenCalledTimes(1);
    const { runId } = onStarted.mock.calls[0][0] as { runId: string };
    expect(useAppStore.getState().runs[runId].status).toBe('queued');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const run = useAppStore.getState().runs[runId];
    expect(run.status).toBe('complete');
    expect(run.score).not.toBeNull();
  });

  it('surfaces a specific failure reason for a URL that simulates a failure', async () => {
    vi.useFakeTimers();
    const onStarted = vi.fn();
    render(<UrlSubmitForm onStarted={onStarted} />);

    fireEvent.change(screen.getByPlaceholderText('https://example.com/page'), {
      target: { value: 'https://simulate-fail.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /analyze/i }));
    await act(async () => {
      await Promise.resolve();
    });

    const { runId } = onStarted.mock.calls[0][0] as { runId: string };
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    const run = useAppStore.getState().runs[runId];
    expect(run.status).toBe('failed');
    expect(run.failureReason).toBeTruthy();
  });

  it('lists a submitted URL under "Previously analyzed" without duplicating status logic', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <UrlSubmitForm onStarted={() => {}} />
        <RecentTargetsList />
      </div>,
    );

    expect(screen.queryByText('Previously analyzed')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('https://example.com/page'), 'https://recent-test.example.com');
    await user.click(screen.getByRole('button', { name: /analyze/i }));

    expect(await screen.findByText('Previously analyzed')).toBeInTheDocument();
    expect(screen.getByText('https://recent-test.example.com')).toBeInTheDocument();
  });
});
