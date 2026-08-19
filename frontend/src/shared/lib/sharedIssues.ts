import { highestSeverity } from './severity';
import { mapFindingCategory, mapFindingSeverity } from './findingMappers';
import type {
  AnalysisRun,
  AnalysisTarget,
  Finding,
  FindingCategory,
  FindingSeverity,
  Project,
  ProjectAnalysis,
  SharedIssue,
} from '@/shared/types';

interface SharedIssueSource {
  targets: Record<string, AnalysisTarget>;
  runs: Record<string, AnalysisRun>;
  findings: Record<string, Finding>;
}

interface SharedIssueGroup {
  category: FindingCategory;
  title: string;
  severities: FindingSeverity[];
  targetIds: Set<string>;
}

function normalizeTitle(title: string): string {
  return title.trim().toLowerCase();
}

function latestCompletedFindings(target: AnalysisTarget | undefined, source: SharedIssueSource): Finding[] {
  if (!target) return [];
  for (let i = target.runIds.length - 1; i >= 0; i -= 1) {
    const run = source.runs[target.runIds[i]];
    if (run && run.status === 'complete') {
      return run.findingIds.map((id) => source.findings[id]).filter((finding): finding is Finding => Boolean(finding));
    }
  }
  return [];
}

/**
 * Computed on read (data-model.md SharedIssue) — never persisted, always reflects the
 * current state of the given targets' latest completed runs. A Finding pattern (same
 * category + normalized title) counts as shared once it appears on >= 2 targets (FR-016).
 *
 * Decoupled from the `Project` type (specs/008-project-centric-analysis) so it can be fed
 * either client-side target ids or, once User Story 4 lands, ids derived from a project's
 * fetched, persisted analysis history — the grouping logic itself doesn't change.
 */
export function computeSharedIssues(
  projectId: Project['id'],
  targetIds: string[],
  source: SharedIssueSource,
): SharedIssue[] {
  const groups = new Map<string, SharedIssueGroup>();

  for (const targetId of targetIds) {
    const findings = latestCompletedFindings(source.targets[targetId], source);
    for (const finding of findings) {
      const signature = `${finding.category}::${normalizeTitle(finding.title)}`;
      const group =
        groups.get(signature) ?? { category: finding.category, title: finding.title, severities: [], targetIds: new Set() };
      group.severities.push(finding.severity);
      group.targetIds.add(targetId);
      groups.set(signature, group);
    }
  }

  const sharedIssues: SharedIssue[] = [];
  for (const [signature, group] of groups) {
    if (group.targetIds.size < 2) continue;
    sharedIssues.push({
      signature,
      projectId,
      category: group.category,
      severity: highestSeverity(group.severities),
      title: group.title,
      affectedTargetIds: Array.from(group.targetIds),
    });
  }

  return sharedIssues;
}

interface RawFinding {
  category?: unknown;
  title?: unknown;
  severity?: unknown;
}

function extractRawFindings(analysis: ProjectAnalysis): RawFinding[] {
  const findings = analysis.analysis?.findings;
  if (!Array.isArray(findings)) return [];
  return findings.filter((f): f is RawFinding => typeof f === 'object' && f !== null);
}

/**
 * The specs/008-project-centric-analysis equivalent of `computeSharedIssues`, operating
 * on a project's persisted analysis history (each analysis's raw backend `analysis.findings`
 * JSON) instead of the client-only target/run/finding store — same grouping rule (a
 * category + normalized title pattern shared across >= 2 analyses), reusing the exact
 * category/severity normalization AnalysisApiService applies to the same raw JSON shape.
 */
export function computeProjectSharedIssues(projectId: Project['id'], analyses: ProjectAnalysis[]): SharedIssue[] {
  const groups = new Map<
    string,
    { category: FindingCategory; title: string; severities: FindingSeverity[]; analysisIds: Set<number> }
  >();

  for (const analysis of analyses) {
    for (const finding of extractRawFindings(analysis)) {
      const rawTitle = typeof finding.title === 'string' ? finding.title.trim() : '';
      if (!rawTitle) continue;

      const category = mapFindingCategory(typeof finding.category === 'string' ? finding.category : undefined);
      const signature = `${category}::${normalizeTitle(rawTitle)}`;
      const group =
        groups.get(signature) ?? { category, title: rawTitle, severities: [], analysisIds: new Set<number>() };
      group.severities.push(mapFindingSeverity(typeof finding.severity === 'string' ? finding.severity : undefined));
      group.analysisIds.add(analysis.id);
      groups.set(signature, group);
    }
  }

  const sharedIssues: SharedIssue[] = [];
  for (const [signature, group] of groups) {
    if (group.analysisIds.size < 2) continue;
    sharedIssues.push({
      signature,
      projectId,
      category: group.category,
      severity: highestSeverity(group.severities),
      title: group.title,
      affectedTargetIds: Array.from(group.analysisIds).map(String),
    });
  }

  return sharedIssues;
}
