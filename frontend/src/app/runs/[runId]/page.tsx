'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/shared/store/useAppStore';
import { ScoreSummary } from '@/features/analysis/components/ScoreSummary';
import { FindingsList } from '@/features/analysis/components/FindingsList';
import { Alert } from '@/shared/components/ui/alert';
import type { Finding } from '@/shared/types';

export default function RunResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const run = useAppStore((state) => state.runs[runId]);
  const findings = useAppStore((state) =>
    run ? run.findingIds.map((id) => state.findings[id]).filter((f): f is Finding => Boolean(f)) : [],
  );

  if (!run) {
    return <p className="text-muted-foreground">This analysis run could not be found in the current session.</p>;
  }

  if (run.status === 'failed') {
    return <Alert variant="destructive">{run.failureReason ?? 'This analysis failed.'}</Alert>;
  }

  if (run.status !== 'complete' || run.score === null) {
    return <p className="text-muted-foreground">This analysis is still in progress.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <ScoreSummary score={run.score} />
      <FindingsList findings={findings} />
    </div>
  );
}
