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

// The analyzer prompt returns structured findings/recommendations, but older stored
// analyses (and the backend's own error path) still emit plain strings — both shapes
// have to survive this mapper.
interface BackendFinding {
  id?: string;
  category?: string;
  dimension?: string;
  impact?: string;
  severity?: string;
  status?: string;
  title?: string;
  detail?: string;
  /** Legacy field name for `title`. */
  type?: string;
}

interface BackendRecommendation {
  id?: string;
  finding_id?: string;
  category?: string;
  priority?: string;
  effort?: string;
  impact?: string;
  action?: string;
  rationale?: string;
  html_change?: {
    change_type?: string;
    location?: string;
    current_html?: string;
    suggested_html?: string;
  };
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
    findings?: Array<BackendFinding | string>;
    recommendations?: Array<BackendRecommendation | string>;
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

    // Each recommendation points back at the finding it resolves, so fold it into
    // that finding's suggestion/snippet instead of listing it as its own card.
    const rawRecommendations = analysisData.recommendations || [];
    const recsByFindingId = new Map<string, BackendRecommendation>();
    const orphanRecs: BackendRecommendation[] = [];
    for (const raw of rawRecommendations) {
      const rec: BackendRecommendation = typeof raw === 'string' ? { action: raw } : raw;
      if (rec.finding_id) {
        recsByFindingId.set(rec.finding_id, rec);
      } else {
        orphanRecs.push(rec);
      }
    }

    const rawFindings = analysisData.findings || [];
    for (const raw of rawFindings) {
      const finding: BackendFinding = typeof raw === 'string' ? { detail: raw } : raw;
      const rec = finding.id ? recsByFindingId.get(finding.id) : undefined;
      if (finding.id) recsByFindingId.delete(finding.id);

      findings.push({
        id: crypto.randomUUID(),
        runId,
        category: this.mapCategory(finding.category),
        severity: this.mapSeverity(finding.severity),
        title: finding.title || finding.type || finding.detail || 'Finding',
        description: finding.detail || '',
        metricValue: null,
        // "add" + no current markup is the backend's way of saying the element is absent;
        // a plain "fail" status can still mean the element exists but scores badly.
        isMissing: rec?.html_change?.change_type === 'add' && !rec.html_change.current_html,
        suggestion: this.recommendationText(rec),
        codeSnippet: rec?.html_change?.suggested_html || null,
      });
    }

    // Recommendations that reference no finding (or an unknown one) still get shown.
    for (const rec of [...orphanRecs, ...recsByFindingId.values()]) {
      const action = rec.action || rec.rationale || '';
      if (!action) continue;
      findings.push({
        id: crypto.randomUUID(),
        runId,
        category: this.mapCategory(rec.category),
        severity: this.mapPriority(rec.priority),
        title: action,
        description: rec.rationale || '',
        metricValue: null,
        isMissing: false,
        suggestion: this.recommendationText(rec),
        codeSnippet: rec.html_change?.suggested_html || null,
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

  /** Flatten a recommendation object into the single suggestion line the UI renders. */
  private recommendationText(rec?: BackendRecommendation): string {
    if (!rec) return '';
    const location = rec.html_change?.location;
    return [rec.action, rec.rationale, location && `Where: ${location}`].filter(Boolean).join(' ');
  }

  // The backend prompt emits 9 categories; the UI groups findings into 4.
  private mapCategory(category?: string): Finding['category'] {
    switch (category?.toLowerCase()) {
      case 'metadata':
      case 'social':
      case 'crawlability':
        return 'meta-tags';
      case 'headings':
      case 'images':
      case 'structured_data':
        return 'html-structure';
      case 'performance':
        return 'file-size';
      default:
        return 'content';
    }
  }

  /** Recommendations carry a priority rather than a severity — reuse the same badge scale. */
  private mapPriority(priority?: string): Finding['severity'] {
    switch (priority?.toLowerCase()) {
      case 'high':
        return 'critical';
      case 'medium':
        return 'medium';
      default:
        return 'warning';
    }
  }

  // The backend prompt emits severity as "critical" | "high" | "medium" | "low";
  // the UI only knows good/warning/critical/medium, so collapse here at the boundary.
  private mapSeverity(severity?: string): Finding['severity'] {
    switch (severity?.toLowerCase()) {
      case 'critical':
      case 'high':
        return 'critical';
      case 'medium':
        return 'medium';
      case 'warning':
      case 'low':
        return 'warning';
      case 'good':
      case 'pass':
        return 'good';
      default:
        return 'warning';
    }
  }

  private emit(runId: string, event: RunStatusEvent): void {
    this.bus.dispatchEvent(new CustomEvent(runEventName(runId), { detail: event }));
  }
}

export const analysisApiService = new AnalysisApiService();