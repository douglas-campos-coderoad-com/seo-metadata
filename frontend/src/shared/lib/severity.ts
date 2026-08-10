import type { FindingSeverity } from '@/shared/types';

// Single source of truth for severity -> color mapping (FR-007): every scored
// metric in the app (overall score, individual findings) must derive its
// color from here, never from ad hoc classes in a component.

export const SEVERITY_CLASSES: Record<
  FindingSeverity,
  { badge: 'success' | 'warning' | 'destructive'; text: string; stroke: string }
> = {
  good: { badge: 'success', text: 'text-success', stroke: 'stroke-success' },
  warning: { badge: 'warning', text: 'text-warning', stroke: 'stroke-warning' },
  critical: { badge: 'destructive', text: 'text-destructive', stroke: 'stroke-destructive' },
};

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  good: 'Good',
  warning: 'Needs improvement',
  critical: 'Critical',
};

export function severityLabel(severity: FindingSeverity): string {
  return SEVERITY_LABELS[severity];
}

/** 0-100 overall score -> severity, using the same good/warning/critical bands as individual findings. */
export function scoreToSeverity(score: number): FindingSeverity {
  if (score >= 80) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

const SEVERITY_RANK: Record<FindingSeverity, number> = { good: 0, warning: 1, critical: 2 };

/** Worst (highest-rank) severity among a set — used e.g. for a Shared Issue's aggregate severity. */
export function highestSeverity(severities: FindingSeverity[]): FindingSeverity {
  return severities.reduce<FindingSeverity>(
    (worst, current) => (SEVERITY_RANK[current] > SEVERITY_RANK[worst] ? current : worst),
    'good',
  );
}
