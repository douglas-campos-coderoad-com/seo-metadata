'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { Badge } from '@/shared/components/ui/badge';
import { Spinner } from '@/shared/components/Spinner';
import { scoreToSeverity } from '@/shared/lib/severity';
import type { AnalysisTarget } from '@/shared/types';

/** A target's latest-run status as a badge — shared by ProjectUrlList and RecentTargetsList. */
export function TargetStatusBadge({ target }: { target: AnalysisTarget }) {
  const run = useAppStore((state) => (target.latestRunId ? state.runs[target.latestRunId] : undefined));

  if (!run) return <Badge variant="outline">Not analyzed yet</Badge>;
  if (run.status === 'complete' && run.score !== null) {
    return <SeverityBadge severity={scoreToSeverity(run.score)} />;
  }
  if (run.status === 'failed') {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Spinner className="h-3 w-3" />
      {run.status}
    </Badge>
  );
}
