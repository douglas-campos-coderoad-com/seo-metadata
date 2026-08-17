'use client';

import { useParams } from 'next/navigation';
import { useAppStore } from '@/shared/store/useAppStore';
import { ScoreSummary } from '@/features/analysis/components/ScoreSummary';
import { FindingsList } from '@/features/analysis/components/FindingsList';
import { BeforeAfterViewer } from '@/features/analysis/components/BeforeAfterViewer';
import { Alert } from '@/shared/components/ui/alert';
import type { Finding } from '@/shared/types';

export default function RunResultsPage() {
  const { runId } = useParams<{ runId: string }>();
  const run = useAppStore((state) => state.runs[runId]);
  const url = useAppStore((state) => state.targets[run.targetId]?.displayUrl ?? '');
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

  // If the run came from the real backend, show the Before/After optimization dashboard.
  if (run.backendAnalysisId) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-bold">Analysis Results</h1>
          <p className="text-sm text-muted-foreground">URL: {url}</p>
        </div>
        <BeforeAfterViewer
          analysisId={run.backendAnalysisId}
          originalUrl={url}
          initialScore={run.score}
          initialSeoScore={run.seoScore}
          initialGeoScore={run.geoScore}
          findings={findings}
        />
      </div>
    );
  }

  // Fallback: legacy / mock-only view.
  return (
    <div className="flex flex-col gap-8">
      <ScoreSummary scores={{ overall: run.score }} />
      <FindingsList findings={findings} />
    </div>
  );
}
