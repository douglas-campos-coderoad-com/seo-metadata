import type { Finding, FindingRecommendation } from '@/shared/types';

// Mirrors report_mappings.py's CATEGORY_LABELS keys.
const KNOWN_CATEGORIES: ReadonlySet<Finding['category']> = new Set([
  'metadata',
  'content',
  'headings',
  'images',
  'structured_data',
  'social',
  'crawlability',
  'performance',
  'geo_aeo',
]);

// Normalize-and-validate against the analyser's 9 categories, mirroring
// report_mappings.normalise_category — unrecognized/missing falls back to 'content'.
// Extracted here (rather than kept private on AnalysisApiService) so any code reading
// the backend's raw finding JSON — including project-analysis-history grouping
// (specs/008-project-centric-analysis) — uses the exact same mapping, not a
// second, potentially drifting copy.
export function mapFindingCategory(category?: string): Finding['category'] {
  const key = category?.trim().toLowerCase();
  return key && (KNOWN_CATEGORIES as ReadonlySet<string>).has(key) ? (key as Finding['category']) : 'content';
}

/** Recommendations carry a priority rather than a severity — reuse the same badge scale. */
export function mapFindingPriority(priority?: string): Finding['severity'] {
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
export function mapFindingSeverity(severity?: string): Finding['severity'] {
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

// The analyzer prompt returns structured findings/recommendations, but older stored
// analyses (and the backend's own error path) still emit plain strings — both shapes
// have to survive this mapper.
export interface BackendFinding {
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

export interface BackendRecommendation {
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

export interface RawAnalysisData {
  findings?: Array<BackendFinding | string>;
  recommendations?: Array<BackendRecommendation | string>;
  geo_visibility?: string;
  seo_breakdown?: Record<string, number>;
  geo_breakdown?: Record<string, number>;
  errors?: string[];
}

function toFindingRecommendation(rec: BackendRecommendation): FindingRecommendation {
  const location = rec.html_change?.location;
  const action = [rec.action, location && `Where: ${location}`].filter(Boolean).join(' ');
  return {
    id: crypto.randomUUID(),
    action,
    rationale: rec.rationale || '',
    codeSnippet: rec.html_change?.suggested_html || null,
  };
}

/**
 * Turns a raw backend analysis JSON payload into the client `Finding[]` shape.
 * `ownerId` is stamped onto each `Finding.runId` purely as a grouping/lookup key —
 * a client run's runId for the live pipeline (AnalysisApiService), or an arbitrary id
 * (e.g. the analysis id) for a historical view (specs/009-project-analysis-ux) — it's
 * never validated against the store, so any string is safe here (research.md §4).
 */
export function buildFindings(ownerId: string, analysisData: RawAnalysisData | null | undefined): Finding[] {
  const findings: Finding[] = [];
  const data = analysisData || {};

  // Each recommendation points back at the finding it resolves. Usually one per
  // finding, but several can share a finding_id when there are genuinely separate
  // fixes — all of them stay attached, none silently dropped or overwritten.
  const rawRecommendations = data.recommendations || [];
  const recsByFindingId = new Map<string, BackendRecommendation[]>();
  const orphanRecs: BackendRecommendation[] = [];
  for (const raw of rawRecommendations) {
    const rec: BackendRecommendation = typeof raw === 'string' ? { action: raw } : raw;
    if (rec.finding_id) {
      const existing = recsByFindingId.get(rec.finding_id);
      if (existing) existing.push(rec);
      else recsByFindingId.set(rec.finding_id, [rec]);
    } else {
      orphanRecs.push(rec);
    }
  }

  const rawFindings = data.findings || [];
  for (const raw of rawFindings) {
    const finding: BackendFinding = typeof raw === 'string' ? { detail: raw } : raw;
    const recs = finding.id ? recsByFindingId.get(finding.id) ?? [] : [];
    if (finding.id) recsByFindingId.delete(finding.id);

    findings.push({
      id: crypto.randomUUID(),
      runId: ownerId,
      category: mapFindingCategory(finding.category),
      severity: mapFindingSeverity(finding.severity),
      title: finding.title || finding.type || finding.detail || 'Finding',
      description: finding.detail || '',
      metricValue: null,
      // "add" + no current markup is the backend's way of saying the element is absent;
      // a plain "fail" status can still mean the element exists but scores badly.
      isMissing: recs.some((rec) => rec.html_change?.change_type === 'add' && !rec.html_change.current_html),
      recommendations: recs.map((rec) => toFindingRecommendation(rec)),
    });
  }

  // Recommendations that reference no finding (or an unknown one) still get shown.
  for (const rec of [...orphanRecs, ...recsByFindingId.values()].flat()) {
    const action = rec.action || rec.rationale || '';
    if (!action) continue;
    findings.push({
      id: crypto.randomUUID(),
      runId: ownerId,
      category: mapFindingCategory(rec.category),
      severity: mapFindingPriority(rec.priority),
      title: action,
      description: rec.rationale || '',
      metricValue: null,
      isMissing: false,
      recommendations: [toFindingRecommendation(rec)],
    });
  }

  // If no findings, add a default "good" one
  if (findings.length === 0) {
    findings.push({
      id: crypto.randomUUID(),
      runId: ownerId,
      category: 'content',
      severity: 'good',
      title: 'Analysis completed',
      description: 'No critical issues detected.',
      metricValue: null,
      isMissing: false,
      recommendations: [],
    });
  }

  return findings;
}
