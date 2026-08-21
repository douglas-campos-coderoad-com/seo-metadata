// Cross-feature entity types. Mirrors specs/003-seo-analyzer-frontend/data-model.md.
// All data here is session-scoped (in-memory only) — see spec.md Clarifications.

export type RunStatus = 'queued' | 'fetching' | 'analyzing' | 'complete' | 'failed';

// Mirrors the analyser prompt's category enum (backend/src/services/graph_nodes.py) and
// backend/src/services/report_mappings.py's CATEGORY_LABELS keys — keep both in sync.
export type FindingCategory =
  | 'metadata'
  | 'content'
  | 'headings'
  | 'images'
  | 'structured_data'
  | 'social'
  | 'crawlability'
  | 'performance'
  | 'geo_aeo';

export type FindingSeverity = 'good' | 'warning' | 'critical' | 'medium';

export interface AnalysisTarget {
  id: string;
  /** Normalized (trimmed, lowercased scheme/host) form — the uniqueness key. */
  url: string;
  /** Original as-entered URL, for display. */
  displayUrl: string;
  createdAt: string; // ISO datetime
  latestRunId: string | null;
  /** Ordered (chronological) list of all AnalysisRun ids — the history timeline. */
  runIds: string[];
}

// FR-011's finalized 21-category-plus-other list — keep in sync with
// backend/src/schemas/project.py's ProjectCategory literal.
export const PROJECT_CATEGORIES = [
  'e-commerce',
  'marketplace',
  'saas',
  'content/blog/media',
  'news/journalism',
  'local business/services',
  'restaurant/food & beverage',
  'real estate',
  'healthcare/medical',
  'legal services',
  'travel/hospitality',
  'education',
  'finance/fintech',
  'nonprofit',
  'agency/professional services',
  'automotive',
  'b2b/manufacturing',
  'entertainment/events',
  'directory/listings',
  'community/forum',
  'government/public sector',
  'other',
] as const;

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number];

export interface Competitor {
  id: number;
  projectId: number;
  url: string;
  description: string;
  seoScore: number | null;
  geoScore: number | null;
  status: string | null;
  analyzedAt: string | null;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** Backend-persisted (specs/008-project-centric-analysis) — no longer a client-only entity. */
export interface Project {
  id: number;
  title: string;
  /** The site this project tracks; pre-fills the project's "analyze a URL" input.
   * Null for projects created before the field existed (migration 007). */
  url: string | null;
  description: string;
  category: ProjectCategory;
  country: string;
  region: string | null;
  competitors: Competitor[];
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** The "after" (optimized) half of a project analysis history entry, when it exists. */
/** One business-level outcome of applying an optimization (migration 009).
 * `competitors` names the project rivals the entry bears on — already filtered
 * to the project's real competitors server-side. */
export interface StrategicImpact {
  impact: string;
  detail: string | null;
  competitors: string[];
}

export interface ProjectAnalysisOptimization {
  id: number;
  analysisId: number;
  optimizedHtml: string | null;
  optimizedJsonLd: Record<string, unknown> | null;
  optimizedContent: Record<string, unknown> | null;
  changes: Record<string, unknown> | null;
  copyPasteReady: Record<string, unknown> | null;
  scoreBefore: Record<string, unknown> | null;
  scoreAfterEstimated: Record<string, unknown> | null;
  strategicImpacts: StrategicImpact[] | null;
  roiProjection: Record<string, unknown> | null;
  status: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
}

/** One entry in a project's persisted analysis history (FR-004, FR-008). */
export interface ProjectAnalysis {
  id: number;
  ingestedUrlId: number;
  url: string;
  seoScore: number | null;
  geoScore: number | null;
  overallScore: number | null;
  analysis: Record<string, unknown> | null;
  jsonLd: Record<string, unknown> | null;
  status: string;
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  /** Absent when optimization was never run for this analysis — render "before" only. */
  optimization: ProjectAnalysisOptimization | null;
}

export interface AnalysisRun {
  id: string;
  targetId: string;
  status: RunStatus;
  startedAt: string; // ISO datetime
  completedAt: string | null;
  score: number | null; // 0-100, set only when status === 'complete'
  /** SEO/GEO sub-scores (0-100). Only populated for real-backend runs (FR: BeforeAfterViewer breakdown). */
  seoScore: number | null;
  geoScore: number | null;
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

export interface FindingRecommendation {
  id: string;
  action: string;
  rationale: string;
  codeSnippet: string | null;
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
  /** Usually one; empty is fine for a rare, low-impact finding; more than one when
   *  genuinely separate fixes apply — never collapsed into a single entry. */
  recommendations: FindingRecommendation[];
}

export interface SharedIssue {
  /** Grouping key: same category + normalized title across findings. */
  signature: string;
  projectId: Project['id'];
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  /** Targets (>= 2) whose latest completed run has a matching finding. */
  affectedTargetIds: string[];
}
