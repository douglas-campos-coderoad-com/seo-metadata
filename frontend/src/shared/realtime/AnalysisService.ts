import type { Competitor, Project, ProjectAnalysis, ProjectCategory, AnalysisRun } from '@/shared/types';
import type { RunStatusEvent } from './events';

/** Shared shape for both project creation and editing (specs/008-project-centric-analysis). */
export interface ProjectInput {
  title: string;
  description: string;
  category: ProjectCategory;
  country: string;
  region?: string | null;
  /** Whole-list-replace on update (contracts/projects-api.md) — omit to leave untouched. */
  competitors?: CompetitorInput[];
}

export interface CompetitorInput {
  url: string;
  description: string;
}

export interface CompetitorSuggestion {
  url: string;
  description: string;
}

/**
 * Backend-agnostic service contract (FR-005). MockAnalysisService (this phase) and
 * any future real-backend-backed implementation both satisfy this same interface —
 * UI code (hooks/components) must depend only on this, never on a concrete implementation.
 * See specs/003-seo-analyzer-frontend/contracts/analysis-service.md and
 * specs/008-project-centric-analysis/contracts/projects-api.md.
 */
export interface AnalysisService {
  /**
   * Start analysis for a URL. Reuses the existing AnalysisTarget if the
   * (normalized) URL is already known (global identity). Resolves immediately
   * with the created run id; progress is delivered via subscribeToRun.
   */
  startAnalysis(input: { url: string; projectId?: number }): Promise<{ targetId: string; runId: string }>;

  /**
   * Subscribe to live status events for one run (FR-003). Returns an unsubscribe
   * function. Supports multiple concurrent subscriptions to different runIds
   * without cross-talk.
   */
  subscribeToRun(runId: string, onEvent: (event: RunStatusEvent) => void): () => void;

  /** One-shot read of current run state (e.g., on page load/deep link). */
  getRun(runId: string): AnalysisRun | undefined;

  /** All runs for a target, chronological — backs the history timeline (FR-019). */
  listRuns(targetId: string): AnalysisRun[];

  // --- Projects (backend-persisted, specs/008-project-centric-analysis) ---
  createProject(input: ProjectInput): Promise<Project>;
  listProjects(): Promise<Project[]>;
  getProject(projectId: number): Promise<Project>;
  updateProject(projectId: number, input: Partial<ProjectInput>): Promise<Project>;
  deleteProject(projectId: number): Promise<void>;

  // --- Project analysis history ---
  listProjectAnalyses(projectId: number): Promise<ProjectAnalysis[]>;
  /** Single historical analysis within a project, ownership-checked (specs/009-project-analysis-ux). */
  getAnalysis(projectId: number, analysisId: number): Promise<ProjectAnalysis>;
  /** Attaches an unattached analysis, or reassigns one already belonging to another project. */
  attachAnalysisToProject(projectId: number, analysisId: number): Promise<ProjectAnalysis>;
  /** Permanently deletes the analysis record (FR-016) — not a detach-to-null. */
  removeAnalysisFromProject(projectId: number, analysisId: number): Promise<void>;

  // --- Smart Search ---
  smartSearchCompetitors(input: {
    description: string;
    category: ProjectCategory;
    country: string;
    region?: string | null;
  }): Promise<CompetitorSuggestion[]>;

  // --- Competitor audit ---
  auditCompetitors?(projectId: number): Promise<AuditResponseDto>;
}

/** Shape returned by the lightweight SEO/GEO competitor audit endpoint. */
export interface AuditResponseDto {
  id: number;
  competitors: AuditCompetitorDto[];
}

export interface AuditCompetitorDto {
  id: number;
  url: string;
  description: string;
  seo_score: number;
  geo_score: number;
  status: string;
  analyzed_at: string | null;
}

// Re-exported for convenience so callers don't need a second import for the entity shape.
export type { Competitor };
