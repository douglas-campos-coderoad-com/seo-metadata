import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAutomations } from '@/features/automations/hooks/useAutomations';
import { ScheduleForm } from '@/features/automations/components/ScheduleForm';
import { AutomationList } from '@/features/automations/components/AutomationList';
import { useAppStore } from '@/shared/store/useAppStore';
import { mockSuccessfulAnalysisPipeline } from './mockAnalysisApi';

function resetStore() {
  useAppStore.setState({ targets: {}, targetIdByUrl: {}, runs: {}, findings: {}, projects: {}, automations: {} });
}

function AutomationHarness({ targetId }: { targetId: string }) {
  const { automations, createAutomation, setActive, remove, triggerNow } = useAutomations(targetId);
  return (
    <div>
      <AutomationList
        automations={automations}
        onToggleActive={(automation) => setActive(automation.id, !automation.active)}
        onDelete={remove}
        onTriggerNow={triggerNow}
      />
      <ScheduleForm onSubmit={(recurrence) => createAutomation(recurrence)} />
    </div>
  );
}

describe('schedule recurring analysis flow (User Story 4)', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('saving the default schedule creates an active automation with a human-readable label', async () => {
    const target = useAppStore.getState().upsertTargetByUrl('https://schedule-test.example.com');
    const user = userEvent.setup();
    render(<AutomationHarness targetId={target.id} />);

    await user.click(screen.getByRole('button', { name: /save schedule/i }));

    expect(await screen.findByText(/every monday at 9:00 am/i)).toBeInTheDocument();
    expect(screen.getByText(/^active/i)).toBeInTheDocument();
  });

  it('pausing an automation flips it to paused', async () => {
    const target = useAppStore.getState().upsertTargetByUrl('https://schedule-pause-test.example.com');
    const user = userEvent.setup();
    render(<AutomationHarness targetId={target.id} />);

    await user.click(screen.getByRole('button', { name: /save schedule/i }));
    await user.click(await screen.findByRole('button', { name: /pause/i }));

    expect(await screen.findByText(/^paused/i)).toBeInTheDocument();
  });

  it('running an automation now records an automation-triggered run in the target history', async () => {
    mockSuccessfulAnalysisPipeline();
    const target = useAppStore.getState().upsertTargetByUrl('https://schedule-trigger-test.example.com');
    render(<AutomationHarness targetId={target.id} />);

    // Creating the schedule is a synchronous store update — the "Run now" button appears immediately.
    fireEvent.click(screen.getByRole('button', { name: /save schedule/i }));
    const runNowButton = screen.getByRole('button', { name: /run now/i });

    fireEvent.click(runNowButton);

    await waitFor(() => {
      const runs = Object.values(useAppStore.getState().runs).filter((run) => run.targetId === target.id);
      expect(runs.some((run) => run.triggeredBy === 'automation' && run.status === 'complete')).toBe(true);
    });
  });

  it('a URL can hold multiple independent automations', async () => {
    const target = useAppStore.getState().upsertTargetByUrl('https://schedule-multi-test.example.com');
    const user = userEvent.setup();
    render(<AutomationHarness targetId={target.id} />);

    await user.click(screen.getByRole('button', { name: /save schedule/i }));
    await user.selectOptions(screen.getByLabelText(/frequency/i), 'daily');
    await user.click(screen.getByRole('button', { name: /save schedule/i }));

    expect(screen.getAllByRole('button', { name: /run now/i })).toHaveLength(2);
    expect(screen.getByText(/every monday at 9:00 am/i)).toBeInTheDocument();
    expect(screen.getByText(/every day at 9:00 am/i)).toBeInTheDocument();

    // Pausing one automation must not affect the other.
    const [firstPauseButton] = screen.getAllByRole('button', { name: /pause/i });
    await user.click(firstPauseButton);

    expect(screen.getByText(/^paused/i)).toBeInTheDocument();
    expect(screen.getByText(/^active/i)).toBeInTheDocument();
  });
});
