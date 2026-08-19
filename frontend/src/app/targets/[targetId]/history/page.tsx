'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTargetHistory } from '@/features/history/hooks/useTargetHistory';
import { RunTimeline } from '@/features/history/components/RunTimeline';
import { RunSnapshotView } from '@/features/history/components/RunSnapshotView';

export default function TargetHistoryPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const { target, runs } = useTargetHistory(targetId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  if (!target) {
    return <p className="text-muted-foreground">This URL could not be found in the current session.</p>;
  }

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[runs.length - 1] ?? null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="break-all text-muted-foreground">{target.displayUrl}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <RunTimeline runs={runs} selectedRunId={selectedRun?.id ?? null} onSelectRun={setSelectedRunId} />
        {selectedRun ? (
          <RunSnapshotView run={selectedRun} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a run to view its results.</p>
        )}
      </div>
    </div>
  );
}
