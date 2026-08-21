import { apiClient } from '@/lib/api-client';
import { useAppStore } from '@/shared/store/useAppStore';
import { isValidUrl } from '@/shared/lib/url';
import { buildFindings, type RawAnalysisData } from '@/shared/lib/findingMappers';
import type {
  AnalysisRun,
  Competitor,
  Project,
  ProjectAnalysis,
  ProjectAnalysisOptimization,
  ProjectCategory,
} from '@/shared/types';
import type { AnalysisService, AuditCompetitorDto, AuditResponseDto, CompetitorSuggestion, ProjectInput } from './AnalysisService';
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
  analysis: RawAnalysisData | null;
  json_ld: unknown;
  created_at: string;
}

// ── Project backend response shapes (specs/008-project-centric-analysis) ─

interface CompetitorDto {
  id: number;
  project_id: number;
  url: string;
  description: string;
  seo_score: number | null;
  geo_score: number | null;
  status: string | null;
  analyzed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectDto {
  id: number;
  title: string;
  description: string;
  category: string;
  country: string;
  region: string | null;
  competitors: CompetitorDto[];
  created_at: string;
  updated_at: string;
}

interface ProjectListDto {
  items: ProjectDto[];
  total: number;
}

function mapCompetitor(dto: CompetitorDto): Competitor {
  return {
    id: dto.id,
    projectId: dto.project_id,
    url: dto.url,
    description: dto.description,
    seoScore: dto.seo_score,
    geoScore: dto.geo_score,
    status: dto.status,
    analyzedAt: dto.analyzed_at,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapProject(dto: ProjectDto): Project {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    category: dto.category as ProjectCategory,
    country: dto.country,
    region: dto.region,
    competitors: dto.competitors.map(mapCompetitor),
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function toCompetitorPayload(input: ProjectInput['competitors']) {
  return (input ?? []).map((c) => ({ url: c.url, description: c.description }));
}

interface OptimizationDto {
  id: number;
  analysis_id: number;
  optimized_html: string | null;
  optimized_json_ld: Record<string, unknown> | null;
  optimized_content: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  copy_paste_ready: Record<string, unknown> | null;
  score_before: Record<string, unknown> | null;
  score_after_estimated: Record<string, unknown> | null;
  roi_projection: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectAnalysisDto {
  id: number;
  ingested_url_id: number;
  url: string;
  seo_score: number | null;
  geo_score: number | null;
  overall_score: number | null;
  analysis: Record<string, unknown> | null;
  json_ld: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
  optimization: OptimizationDto | null;
}

interface ProjectAnalysisListDto {
  items: ProjectAnalysisDto[];
  total: number;
}

function mapOptimization(dto: OptimizationDto): ProjectAnalysisOptimization {
  return {
    id: dto.id,
    analysisId: dto.analysis_id,
    optimizedHtml: dto.optimized_html,
    optimizedJsonLd: dto.optimized_json_ld,
    optimizedContent: dto.optimized_content,
    changes: dto.changes,
    copyPasteReady: dto.copy_paste_ready,
    scoreBefore: dto.score_before,
    scoreAfterEstimated: dto.score_after_estimated,
    roiProjection: dto.roi_projection,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapProjectAnalysis(dto: ProjectAnalysisDto): ProjectAnalysis {
  return {
    id: dto.id,
    ingestedUrlId: dto.ingested_url_id,
    url: dto.url,
    seoScore: dto.seo_score,
    geoScore: dto.geo_score,
    overallScore: dto.overall_score,
    analysis: dto.analysis,
    jsonLd: dto.json_ld,
    status: dto.status,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    optimization: dto.optimization ? mapOptimization(dto.optimization) : null,
  };
}

// ── Event bus for live status ────────────────────────────────────────────

function runEventName(runId: string): string {
  return `run:${runId}`;
}

export class AnalysisApiService implements AnalysisService {
  private bus = new EventTarget();

  async startAnalysis(input: { url: string; projectId?: number }): Promise<{ targetId: string; runId: string }> {
    if (!isValidUrl(input.url)) {
      throw new Error('Enter a valid http(s) URL.');
    }

    const store = useAppStore.getState();
    const target = store.upsertTargetByUrl(input.url);
    // input.projectId: auto-attaching the resulting analysis to a project when
    // analysis is started from within that project's own view is wired up in
    // specs/008-project-centric-analysis User Story 4 (T029), once
    // attachAnalysisToProject exists and this run has a backendAnalysisId to attach.

    const run: AnalysisRun = {
      id: crypto.randomUUID(),
      targetId: target.id,
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

  // ── Projects (backend-persisted, specs/008-project-centric-analysis) ────

  async createProject(input: ProjectInput): Promise<Project> {
    const dto = await apiClient.post<ProjectDto>('/projects', {
      title: input.title,
      description: input.description,
      category: input.category,
      country: input.country,
      region: input.region ?? null,
      competitors: toCompetitorPayload(input.competitors),
    });
    return mapProject(dto);
  }

  async listProjects(): Promise<Project[]> {
    const dto = await apiClient.get<ProjectListDto>('/projects');
    return dto.items.map(mapProject);
  }

  async getProject(projectId: number): Promise<Project> {
    const dto = await apiClient.get<ProjectDto>(`/projects/${projectId}`);
    return mapProject(dto);
  }

  async updateProject(projectId: number, input: Partial<ProjectInput>): Promise<Project> {
    const payload: Record<string, unknown> = { ...input };
    if (input.competitors) payload.competitors = toCompetitorPayload(input.competitors);
    const dto = await apiClient.patch<ProjectDto>(`/projects/${projectId}`, payload);
    return mapProject(dto);
  }

  async deleteProject(projectId: number): Promise<void> {
    await apiClient.delete<void>(`/projects/${projectId}`);
  }

  async listProjectAnalyses(projectId: number): Promise<ProjectAnalysis[]> {
    const dto = await apiClient.get<ProjectAnalysisListDto>(`/projects/${projectId}/analyses`);
    return dto.items.map(mapProjectAnalysis);
  }

  async getAnalysis(projectId: number, analysisId: number): Promise<ProjectAnalysis> {
    const dto = await apiClient.get<ProjectAnalysisDto>(`/projects/${projectId}/analyses/${analysisId}`);
    return mapProjectAnalysis(dto);
  }

  async attachAnalysisToProject(projectId: number, analysisId: number): Promise<ProjectAnalysis> {
    const dto = await apiClient.post<ProjectAnalysisDto>(`/projects/${projectId}/analyses`, {
      analysis_id: analysisId,
    });
    return mapProjectAnalysis(dto);
  }

  async removeAnalysisFromProject(projectId: number, analysisId: number): Promise<void> {
    await apiClient.delete<void>(`/projects/${projectId}/analyses/${analysisId}`);
  }

  async smartSearchCompetitors(input: {
    description: string;
    category: ProjectCategory;
    country: string;
    region?: string | null;
  }): Promise<CompetitorSuggestion[]> {
    const dto = await apiClient.post<{ suggestions: CompetitorSuggestion[] }>('/projects/competitors/smart-search', {
      description: input.description,
      category: input.category,
      country: input.country,
      region: input.region ?? null,
    });
    return dto.suggestions;
  }

  async auditCompetitors(projectId: number): Promise<AuditResponseDto> {
    const dto = await apiClient.post<AuditResponseDto>(`/projects/${projectId}/competitors/audit`, {});
    return dto;
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
    const findings = buildFindings(runId, analysis.analysis);
    useAppStore.getState().addFindings(findings);

    // 4. Complete the run
    const completeAt = new Date().toISOString();
    const score = analysis.overall_score ?? 0;
    useAppStore.getState().updateRun(runId, {
      status: 'complete',
      completedAt: completeAt,
      score,
      seoScore: analysis.seo_score,
      geoScore: analysis.geo_score,
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

  private emit(runId: string, event: RunStatusEvent): void {
    this.bus.dispatchEvent(new CustomEvent(runEventName(runId), { detail: event }));
  }
}

export const analysisApiService = new AnalysisApiService();