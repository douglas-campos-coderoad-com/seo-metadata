import { useAppStore } from '@/shared/store/useAppStore';
import { isValidUrl } from '@/shared/lib/url';
import { buildRunOutcome } from '@/features/analysis/mocks/scenarios';
import { computeSharedIssues } from '@/shared/lib/sharedIssues';
import { computeNextRunAt, formatRecurrence } from '@/features/automations/lib/recurrence';
import type { AnalysisRun, Automation, Finding, Project, Recurrence, RunTrigger, SharedIssue } from '@/shared/types';
import type { AnalysisService } from './AnalysisService';
import type { RunStatusEvent } from './events';

// EventTarget-based simulated push channel (research.md §2): startAnalysis schedules
// queued -> fetching -> analyzing -> complete|failed via setTimeout, emitting the same
// RunStatusEvent shape a real WebSocket/SSE stream would deliver.

const DELAY_TO_FETCHING_MS = 400;
const DELAY_TO_ANALYZING_MS = 500;
const DELAY_TO_OUTCOME_MS = 800;

function runEventName(runId: string): string {
  return `run:${runId}`;
}

export class MockAnalysisService implements AnalysisService {
  private bus = new EventTarget();

  async startAnalysis(input: { url: string; projectId?: string }): Promise<{ targetId: string; runId: string }> {
    if (!isValidUrl(input.url)) {
      throw new Error('Enter a valid http(s) URL.');
    }

    const store = useAppStore.getState();
    const target = store.upsertTargetByUrl(input.url);
    if (input.projectId) {
      store.addTargetToProject(input.projectId, target.id);
    }

    const run = this.createAndScheduleRun(target.id, input.url, 'manual');

    return { targetId: target.id, runId: run.id };
  }

  subscribeToRun(runId: string, onEvent: (event: RunStatusEvent) => void): () => void {
    const listener = (event: Event) => onEvent((event as CustomEvent<RunStatusEvent>).detail);
    this.bus.addEventListener(runEventName(runId), listener);
    return () => this.bus.removeEventListener(runEventName(runId), listener);
  }

  getRun(runId: string): AnalysisRun | undefined {
    return useAppStore.getState().runs[runId];
  }

  listRuns(targetId: string): AnalysisRun[] {
    const state = useAppStore.getState();
    const target = state.targets[targetId];
    if (!target) return [];
    return target.runIds.map((id) => state.runs[id]).filter((run): run is AnalysisRun => Boolean(run));
  }

  createProject(input: { name: string }): Project {
    return useAppStore.getState().createProject(input.name);
  }

  addTargetToProject(projectId: string, url: string): { targetId: string } {
    if (!isValidUrl(url)) {
      throw new Error('Enter a valid http(s) URL.');
    }
    const store = useAppStore.getState();
    const target = store.upsertTargetByUrl(url);
    store.addTargetToProject(projectId, target.id);
    return { targetId: target.id };
  }

  removeTargetFromProject(projectId: string, targetId: string): void {
    useAppStore.getState().removeTargetFromProject(projectId, targetId);
  }

  listSharedIssues(projectId: string): SharedIssue[] {
    const state = useAppStore.getState();
    const project = state.projects[projectId];
    if (!project) return [];
    return computeSharedIssues(project, { targets: state.targets, runs: state.runs, findings: state.findings });
  }

  createAutomation(input: { targetId: string; recurrence: Recurrence }): Automation {
    const automation: Automation = {
      id: crypto.randomUUID(),
      targetId: input.targetId,
      recurrence: input.recurrence,
      recurrenceLabel: formatRecurrence(input.recurrence),
      active: true,
      lastRunId: null,
      nextRunAt: computeNextRunAt(input.recurrence),
    };

    useAppStore.getState().upsertAutomation(automation);

    return automation;
  }

  setAutomationActive(automationId: string, active: boolean): void {
    useAppStore.getState().setAutomationActive(automationId, active);
  }

  deleteAutomation(automationId: string): void {
    useAppStore.getState().deleteAutomation(automationId);
  }

  /**
   * Demo-only: forces a scheduled automation to fire immediately, since there is no real
   * job runner in this phase (spec Assumptions — automation execution is simulated).
   * Not part of AnalysisService: a real backend wouldn't need a manual "run it now" escape hatch.
   */
  triggerAutomationNow(automationId: string): { targetId: string; runId: string } | null {
    const store = useAppStore.getState();
    const automation = store.automations[automationId];
    if (!automation) return null;

    const target = store.targets[automation.targetId];
    if (!target) return null;

    const run = this.createAndScheduleRun(target.id, target.url, 'automation');

    useAppStore.getState().upsertAutomation({
      ...automation,
      lastRunId: run.id,
      nextRunAt: computeNextRunAt(automation.recurrence),
    });

    return { targetId: target.id, runId: run.id };
  }

  private createAndScheduleRun(targetId: string, url: string, triggeredBy: RunTrigger): AnalysisRun {
    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      targetId,
      triggeredBy,
      status: 'queued',
      startedAt: new Date().toISOString(),
      completedAt: null,
      score: null,
      failureReason: null,
      findingIds: [],
      httpStatus: null,
      contentType: null,
      contentSizeBytes: null,
    };
    useAppStore.getState().addRun(run);
    this.scheduleProgression(run.id, url);
    return run;
  }

  private emit(runId: string, event: RunStatusEvent): void {
    this.bus.dispatchEvent(new CustomEvent(runEventName(runId), { detail: event }));
  }

  private scheduleProgression(runId: string, url: string): void {
    // A designated URL substring lets the connection-lost/recovery UI be exercised on demand.
    const isSimulatedDisconnect = /simulate-disconnect/i.test(url);

    setTimeout(() => {
      useAppStore.getState().updateRun(runId, { status: 'fetching' });
      this.emit(runId, { type: 'status', runId, status: 'fetching', at: new Date().toISOString() });

      if (isSimulatedDisconnect) {
        this.emit(runId, { type: 'connection-lost', runId, at: new Date().toISOString() });
        return;
      }

      setTimeout(() => {
        useAppStore.getState().updateRun(runId, { status: 'analyzing' });
        this.emit(runId, { type: 'status', runId, status: 'analyzing', at: new Date().toISOString() });

        setTimeout(() => this.resolveOutcome(runId, url), DELAY_TO_OUTCOME_MS);
      }, DELAY_TO_ANALYZING_MS);
    }, DELAY_TO_FETCHING_MS);
  }

  private resolveOutcome(runId: string, url: string): void {
    const at = new Date().toISOString();

    const outcome = /simulate-fail/i.test(url)
      ? ({
          status: 'failed',
          failureReason: 'Simulated failure for testing.',
          httpStatus: null,
          contentType: null,
        } as const)
      : buildRunOutcome(url);

    if (outcome.status === 'failed') {
      useAppStore.getState().updateRun(runId, {
        status: 'failed',
        completedAt: at,
        failureReason: outcome.failureReason,
        httpStatus: outcome.httpStatus,
        contentType: outcome.contentType,
      });
      this.emit(runId, { type: 'failed', runId, status: 'failed', at, failureReason: outcome.failureReason });
      return;
    }

    const findings: Finding[] = outcome.findingTemplates.map((template) => ({
      ...template,
      id: crypto.randomUUID(),
      runId,
    }));

    useAppStore.getState().addFindings(findings);
    useAppStore.getState().updateRun(runId, {
      status: 'complete',
      completedAt: at,
      score: outcome.score,
      findingIds: findings.map((finding) => finding.id),
      httpStatus: outcome.httpStatus,
      contentType: outcome.contentType,
      contentSizeBytes: outcome.contentSizeBytes,
    });
    this.emit(runId, {
      type: 'complete',
      runId,
      status: 'complete',
      at,
      score: outcome.score,
      findingIds: findings.map((finding) => finding.id),
    });
  }
}

export const mockAnalysisService = new MockAnalysisService();
