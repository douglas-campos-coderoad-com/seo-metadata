import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/shared/store/useAppStore';
import { isValidUrl } from '@/shared/lib/url';
import type { AnalysisRun, Automation, Finding, Project, Recurrence, SharedIssue } from '@/shared/types';
import type { AnalysisService } from './AnalysisService';
import type { RunStatusEvent } from './events';

// Real backend-backed implementation of AnalysisService.
// Maps the FastAPI responses to the frontend entity shapes.

// ── Backend response shapes (subset we consume) ──────────────────────────

interface IngestResponse {
  id: number;
  url: string;
  status: string;
  html_size_bytes: number | null;
  http_status: number | null;
  content_type: string | null;
  created_at: string;
}

interface AnalysisResponse {
  id: number;
  ingested_url_id: number;
  url: string;
  seo_score: number | null;
  geo_score: number | null;
  overall_score: number | null;
  status: string;
  analysis: {
    findings?: Array<{ severity?: string; message?: string; type?: string }>;
    recommendations?: string[];
    geo_visibility?: string;
    seo_breakdown?: Record<string, number>;
    geo_breakdown?: Record<string, number>;
    errors?: string[];
  } | null;
  json_ld: unknown;
  created_at: string;
}

// ── Event bus for live status ────────────────────────────────────────────

function runEventName(runId: string): string {
  return `run:${runId}`;
}

export class AnalysisApiService implements AnalysisService {
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

    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      targetId: target.id,
      triggeredBy: 'manual',
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
    store.addRun(run);

    // Fire-and-forget the async pipeline; progress is delivered via subscribeToRun.
    this.runPipeline(run.id, input.url).catch((err) => {
      const at = new Date().toISOString();
      const message = err instanceof Error ? err.message : 'Analysis failed.';
      useAppStore.getState().updateRun(run.id, {
        status: 'failed',
        completedAt: at,
        failureReason: message,
      });
      this.emit(run.id, { type: 'failed', runId: run.id, status: 'failed', at, failureReason: message });
    });

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
    // Real backend would compute this; for now return empty (no cross-target aggregation).
    return [];
  }

  createAutomation(input: { targetId: string; recurrence: Recurrence }): Automation {
    // Real backend would persist; for now create a local automation.
    const automation: Automation = {
      id: crypto.randomUUID(),
      targetId: input.targetId,
      recurrence: input.recurrence,
      recurrenceLabel: `${input.recurrence.frequency} at ${input.recurrence.time}`,
      active: true,
      lastRunId: null,
      nextRunAt: new Date().toISOString(),
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

  triggerAutomationNow(automationId: string): { targetId: string; runId: string } | null {
    const store = useAppStore.getState();
    const automation = store.automations[automationId];
    if (!automation) return null;

    const target = store.targets[automation.targetId];
    if (!target) return null;

    // Create a run scoped to the automation target and run the real pipeline.
    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      targetId: target.id,
      triggeredBy: 'automation',
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
    store.addRun(run);

    this.runPipeline(run.id, target.displayUrl).catch((err) => {
      const at = new Date().toISOString();
      const message = err instanceof Error ? err.message : 'Analysis failed.';
      useAppStore.getState().updateRun(run.id, {
        status: 'failed',
        completedAt: at,
        failureReason: message,
      });
      this.emit(run.id, { type: 'failed', runId: run.id, status: 'failed', at, failureReason: message });
    });

    store.upsertAutomation({
      ...automation,
      lastRunId: run.id,
      nextRunAt: new Date().toISOString(),
    });

    return { targetId: target.id, runId: run.id };
  }

  // ── Backend pipeline ───────────────────────────────────────────────────

  private async runPipeline(runId: string, url: string): Promise<void> {
    const at = new Date().toISOString();

    // 1. Ingest URL (scrape HTML)
    useAppStore.getState().updateRun(runId, { status: 'fetching' });
    this.emit(runId, { type: 'status', runId, status: 'fetching', at });

    const ingest = await apiClient.post<IngestResponse>('/ingest/url', { url });
    if (ingest.status === 'failed') {
      throw new Error('Failed to ingest URL.');
    }

    // 2. Analyze
    useAppStore.getState().updateRun(runId, { status: 'analyzing' });
    this.emit(runId, { type: 'status', runId, status: 'analyzing', at });

    const analysis = await apiClient.post<AnalysisResponse>(`/analyze/${ingest.id}`, {});

    // 3. Build findings from analysis
    const findings = this.buildFindings(runId, analysis);
    useAppStore.getState().addFindings(findings);

    // 4. Complete the run
    const completeAt = new Date().toISOString();
    const score = analysis.overall_score ?? 0;
    useAppStore.getState().updateRun(runId, {
      status: 'complete',
      completedAt: completeAt,
      score,
      findingIds: findings.map((f) => f.id),
      httpStatus: ingest.http_status,
      contentType: ingest.content_type,
      contentSizeBytes: ingest.html_size_bytes,
      backendAnalysisId: analysis.id,
    });
    this.emit(runId, {
      type: 'complete',
      runId,
      status: 'complete',
      at: completeAt,
      score,
      findingIds: findings.map((f) => f.id),
    });
  }

  private buildFindings(runId: string, analysis: AnalysisResponse): Finding[] {
    const findings: Finding[] = [];
    const analysisData = analysis.analysis || {};

    // Map backend findings to frontend Finding shape
    const rawFindings = analysisData.findings || [];
    for (const raw of rawFindings) {
      const severity = this.mapSeverity(raw.severity);
      findings.push({
        id: crypto.randomUUID(),
        runId,
        category: 'content',
        severity,
        title: raw.message || raw.type || 'Finding',
        description: raw || '',
        metricValue: null,
        isMissing: false,
        suggestion: '',
        codeSnippet: null,
      });
    }

    // Map recommendations to findings
    const recommendations = analysisData.recommendations || [];
    for (const rec of recommendations) {
      findings.push({
        id: crypto.randomUUID(),
        runId,
        category: 'content',
        severity: 'warning',
        title: rec,
        description: rec,
        metricValue: null,
        isMissing: false,
        suggestion: rec,
        codeSnippet: null,
      });
    }

    // If no findings, add a default "good" one
    if (findings.length === 0) {
      findings.push({
        id: crypto.randomUUID(),
        runId,
        category: 'content',
        severity: 'good',
        title: 'Analysis completed',
        description: 'No critical issues detected.',
        metricValue: null,
        isMissing: false,
        suggestion: '',
        codeSnippet: null,
      });
    }

    return findings;
  }

  private mapSeverity(severity?: string): Finding['severity'] {
    switch (severity) {
      case 'high':
      case 'critical':
        return 'critical';
      case 'medium':
      case 'warning':
        return 'warning';
      default:
        return 'good';
    }
  }

  private emit(runId: string, event: RunStatusEvent): void {
    this.bus.dispatchEvent(new CustomEvent(runEventName(runId), { detail: event }));
  }
}

export const analysisApiService = new AnalysisApiService();