import { useAppStore } from '@/shared/store/useAppStore';
import { isValidUrl } from '@/shared/lib/url';
import { buildRunOutcome } from '@/features/analysis/mocks/scenarios';
import type { AnalysisRun, Finding, Project, ProjectAnalysis, ProjectCategory } from '@/shared/types';
import type { AnalysisService, Competitor, CompetitorSuggestion, ProjectInput } from './AnalysisService';
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
  private projects = new Map<number, Project>();
  private nextProjectId = 1;
  private nextCompetitorId = 1;
  /** analysisId -> (analysis, owning projectId) — a self-contained fixture world, since
   * mock runs use string UUIDs while attach/reassign works over numeric backend ids. */
  private projectAnalyses = new Map<number, { analysis: ProjectAnalysis; projectId: number }>();

  async startAnalysis(input: { url: string; projectId?: number }): Promise<{ targetId: string; runId: string }> {
    if (!isValidUrl(input.url)) {
      throw new Error('Enter a valid http(s) URL.');
    }

    const store = useAppStore.getState();
    const target = store.upsertTargetByUrl(input.url);
    // input.projectId: auto-attach wiring lands in specs/008-project-centric-analysis
    // User Story 4 (T029), same as AnalysisApiService.

    const run = this.createAndScheduleRun(target.id, input.url);

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

  // ── Projects (in-memory fixture store — mirrors AnalysisApiService's shape) ──

  async createProject(input: ProjectInput): Promise<Project> {
    const project: Project = {
      id: this.nextProjectId++,
      title: input.title,
      description: input.description,
      category: input.category,
      country: input.country,
      region: input.region ?? null,
      competitors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    project.competitors = (input.competitors ?? []).map((c) => ({
      id: this.nextCompetitorId++,
      projectId: project.id,
      url: c.url,
      description: c.description,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })) as Competitor[];
    this.projects.set(project.id, project);
    return project;
  }

  async listProjects(): Promise<Project[]> {
    return Array.from(this.projects.values());
  }

  async getProject(projectId: number): Promise<Project> {
    const project = this.projects.get(projectId);
    if (!project) throw new Error(`Project with id ${projectId} not found`);
    return project;
  }

  async updateProject(projectId: number, input: Partial<ProjectInput>): Promise<Project> {
    const project = await this.getProject(projectId);
    const updated: Project = {
      ...project,
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.category !== undefined && { category: input.category }),
      ...(input.country !== undefined && { country: input.country }),
      ...(input.region !== undefined && { region: input.region }),
      updatedAt: new Date().toISOString(),
    };
    if (input.competitors) {
      updated.competitors = input.competitors.map((c) => ({
        id: this.nextCompetitorId++,
        projectId,
        url: c.url,
        description: c.description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })) as Competitor[];
    }
    this.projects.set(projectId, updated);
    return updated;
  }

  async deleteProject(projectId: number): Promise<void> {
    await this.getProject(projectId); // throws if the project doesn't exist
    this.projects.delete(projectId);
    for (const [analysisId, entry] of this.projectAnalyses) {
      if (entry.projectId === projectId) this.projectAnalyses.delete(analysisId);
    }
  }

  async listProjectAnalyses(projectId: number): Promise<ProjectAnalysis[]> {
    return Array.from(this.projectAnalyses.values())
      .filter((entry) => entry.projectId === projectId)
      .map((entry) => entry.analysis)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getAnalysis(projectId: number, analysisId: number): Promise<ProjectAnalysis> {
    const entry = this.projectAnalyses.get(analysisId);
    if (!entry || entry.projectId !== projectId) {
      throw new Error(`Analysis with id ${analysisId} not found in project ${projectId}`);
    }
    return entry.analysis;
  }

  async attachAnalysisToProject(projectId: number, analysisId: number): Promise<ProjectAnalysis> {
    await this.getProject(projectId); // throws if the project doesn't exist

    const existing = this.projectAnalyses.get(analysisId)?.analysis;
    const analysis: ProjectAnalysis = existing ?? {
      id: analysisId,
      ingestedUrlId: analysisId,
      url: `https://mock.example.com/analysis-${analysisId}`,
      seoScore: 70,
      geoScore: 60,
      overallScore: 65,
      analysis: null,
      jsonLd: null,
      status: 'completed',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      optimization: null,
    };
    this.projectAnalyses.set(analysisId, { analysis, projectId });
    return analysis;
  }

  async removeAnalysisFromProject(projectId: number, analysisId: number): Promise<void> {
    const entry = this.projectAnalyses.get(analysisId);
    if (!entry || entry.projectId !== projectId) {
      throw new Error(`Analysis with id ${analysisId} not found in project ${projectId}`);
    }
    this.projectAnalyses.delete(analysisId);
  }

  async smartSearchCompetitors(input: {
    description: string;
    category: ProjectCategory;
    country: string;
    region?: string | null;
  }): Promise<CompetitorSuggestion[]> {
    return [
      {
        url: 'https://mock-competitor.example.com',
        description: `A plausible competitor in ${input.category} (${input.country}).`,
      },
    ];
  }

  private createAndScheduleRun(targetId: string, url: string): AnalysisRun {
    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      targetId,
      status: 'queued',
      startedAt: new Date().toISOString(),
      completedAt: null,
      score: null,
      seoScore: null,
      geoScore: null,
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
