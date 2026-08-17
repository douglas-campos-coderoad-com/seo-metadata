'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { ScoreSummary } from '@/features/analysis/components/ScoreSummary';
import { FindingsList } from '@/features/analysis/components/FindingsList';
import { Alert } from '@/shared/components/ui/alert';
import type { AnalysisRun, Finding } from '@/shared/types';

export function RunSnapshotView({ run }: { run: AnalysisRun }) {
  const findings = useAppStore((state) =>
    run.findingIds.map((id) => state.findings[id]).filter((finding): finding is Finding => Boolean(finding)),
  );

  if (run.status === 'failed') {
    return <Alert variant="destructive">{run.failureReason ?? 'This analysis failed.'}</Alert>;
  }

  if (run.status !== 'complete' || run.score === null) {
    return <p className="text-muted-foreground">This run is still in progress.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <ScoreSummary scores={{ overall: run.score, seo: run.seoScore, geo: run.geoScore }} />
      <FindingsList findings={findings} />
    </div>
  );
}
