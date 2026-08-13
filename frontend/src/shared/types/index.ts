// Cross-feature entity types. Mirrors specs/003-seo-analyzer-frontend/data-model.md.
// All data here is session-scoped (in-memory only) — see spec.md Clarifications.

export type RunStatus = 'queued' | 'fetching' | 'analyzing' | 'complete' | 'failed';

export type RunTrigger = 'manual' | 'automation';

export type FindingCategory = 'meta-tags' | 'content' | 'html-structure' | 'file-size';

export type FindingSeverity = 'good' | 'warning' | 'critical';

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly';

export interface AnalysisTarget {
  id: string;
  /** Normalized (trimmed, lowercased scheme/host) form — the uniqueness key. */
  url: string;
  /** Original as-entered URL, for display. */
  displayUrl: string;
  createdAt: string; // ISO datetime
  latestRunId: string | null;
  projectIds: string[];
  /** Ordered (chronological) list of all AnalysisRun ids — the history timeline. */
  runIds: string[];
}

export interface Project {
  id: string;
  name: string;
  createdAt: string; // ISO datetime
  targetIds: string[];
}

export interface AnalysisRun {
  id: string;
  targetId: string;
  triggeredBy: RunTrigger;
  status: RunStatus;
  startedAt: string; // ISO datetime
  completedAt: string | null;
  score: number | null; // 0-100, set only when status === 'complete'
  failureReason: string | null; // set only when status === 'failed'
  findingIds: string[];
  httpStatus: number | null;
  contentType: string | null;
  contentSizeBytes: number | null;
  /** Backend analysis record id (from POST /analyze/{ingested_id}). Optional; only set when the real API produced it. */
  backendAnalysisId?: number;
  /** Backend optimization record id (from POST /optimize/{analysis_id}). Optional. */
  backendOptimizationId?: number;
}

export interface Finding {
  id: string;
  runId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  metricValue: string | number | null;
  /** True when the underlying element was absent — flag as missing, never blank. */
  isMissing: boolean;
  suggestion: string;
  codeSnippet: string | null;
}

export interface SharedIssue {
  /** Grouping key: same category + normalized title across findings. */
  signature: string;
  projectId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  /** Targets (>= 2) whose latest completed run has a matching finding. */
  affectedTargetIds: string[];
}

export interface Recurrence {
  frequency: RecurrenceFrequency;
  time: string; // HH:mm
  weekday?: number; // 0-6, for 'weekly'
  dayOfMonth?: number; // 1-31, for 'monthly'
}

export interface Automation {
  id: string;
  /** A target may hold multiple independent automations. */
  targetId: string;
  recurrence: Recurrence;
  recurrenceLabel: string; // human-readable rendering of `recurrence`
  active: boolean;
  lastRunId: string | null;
  nextRunAt: string; // ISO datetime
}
