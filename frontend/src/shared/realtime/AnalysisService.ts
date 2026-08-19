import type { AnalysisRun, Project, SharedIssue } from '@/shared/types';
import type { RunStatusEvent } from './events';

/**
 * Backend-agnostic service contract (FR-005). MockAnalysisService (this phase) and
 * any future real-backend-backed implementation both satisfy this same interface —
 * UI code (hooks/components) must depend only on this, never on a concrete implementation.
 * See specs/003-seo-analyzer-frontend/contracts/analysis-service.md.
 */
export interface AnalysisService {
  /**
   * Start analysis for a URL. Reuses the existing AnalysisTarget if the
   * (normalized) URL is already known (global identity). Resolves immediately
   * with the created run id; progress is delivered via subscribeToRun.
   */
  startAnalysis(input: { url: string; projectId?: string }): Promise<{ targetId: string; runId: string }>;

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

  // --- Projects ---
  createProject(input: { name: string }): Project;
  addTargetToProject(projectId: string, url: string): { targetId: string };
  removeTargetFromProject(projectId: string, targetId: string): void;
  listSharedIssues(projectId: string): SharedIssue[]; // FR-016
}
