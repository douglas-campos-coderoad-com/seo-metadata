'use client';

import Link from 'next/link';
import { useAppStore } from '@/shared/store/useAppStore';
import type { AnalysisTarget } from '@/shared/types';

function TargetTrend({ target }: { target: AnalysisTarget }) {
  const completedRuns = useAppStore((state) =>
    target.runIds
      .map((id) => state.runs[id])
      .filter((run) => run && run.status === 'complete' && run.score !== null),
  );

  if (completedRuns.length === 0) {
    return <span className="text-xs text-muted-foreground">No completed runs yet</span>;
  }

  const first = completedRuns[0];
  const latest = completedRuns[completedRuns.length - 1];

  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      {completedRuns.length} run{completedRuns.length === 1 ? '' : 's'}
      {first.id === latest.id ? ` · score ${first.score}` : ` · score ${first.score} → ${latest.score}`}
    </span>
  );
}

interface ProjectHistorySummaryProps {
  targets: AnalysisTarget[];
  sharedIssueCount: number;
}

export function ProjectHistorySummary({ targets, sharedIssueCount }: ProjectHistorySummaryProps) {
  if (targets.length === 0) {
    return <p className="text-sm text-muted-foreground">Add URLs to this project to start tracking history.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <p className="text-sm">
        <span className="font-semibold">{sharedIssueCount}</span> shared issue{sharedIssueCount === 1 ? '' : 's'}{' '}
        currently detected across this project.
      </p>
      <ul className="flex flex-col gap-1">
        {targets.map((target) => (
          <li key={target.id} className="flex items-center justify-between gap-2">
            <Link href={`/targets/${target.id}/history`} className="truncate text-sm underline-offset-4 hover:underline">
              {target.displayUrl}
            </Link>
            <TargetTrend target={target} />
          </li>
        ))}
      </ul>
    </div>
  );
}
