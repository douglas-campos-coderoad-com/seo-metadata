import { highestSeverity } from './severity';
import type {
  AnalysisRun,
  AnalysisTarget,
  Finding,
  FindingCategory,
  FindingSeverity,
  Project,
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
 * current state of a project's targets' latest completed runs. A Finding pattern (same
 * category + normalized title) counts as shared once it appears on >= 2 targets (FR-016).
 */
export function computeSharedIssues(project: Project, source: SharedIssueSource): SharedIssue[] {
  const groups = new Map<string, SharedIssueGroup>();

  for (const targetId of project.targetIds) {
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
      projectId: project.id,
      category: group.category,
      severity: highestSeverity(group.severities),
      title: group.title,
      affectedTargetIds: Array.from(group.targetIds),
    });
  }

  return sharedIssues;
}
