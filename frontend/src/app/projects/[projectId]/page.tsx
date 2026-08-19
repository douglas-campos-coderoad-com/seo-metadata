'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useProjectDetail } from '@/features/projects/hooks/useProjectDetail';
import { ProjectUrlList } from '@/features/projects/components/ProjectUrlList';
import { SharedIssuesPanel } from '@/features/projects/components/SharedIssuesPanel';
import { LiveStatusTracker } from '@/features/analysis/components/LiveStatusTracker';
import { ProjectHistorySummary } from '@/features/history/components/ProjectHistorySummary';
import { Button } from '@/shared/components/ui/button';
import type { AnalysisTarget } from '@/shared/types';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, targets, sharedIssues, addUrl, removeTarget, analyzeTarget, analyzeAll } =
    useProjectDetail(projectId);
  const [activeRunIds, setActiveRunIds] = useState<string[]>([]);

  if (!project) {
    return <p className="text-muted-foreground">This project could not be found in the current session.</p>;
  }

  const trackRun = (result: { runId: string }) => {
    setActiveRunIds((prev) => [...prev, result.runId]);
  };

  const handleAnalyzeTarget = (target: AnalysisTarget) => {
    analyzeTarget(target.displayUrl).then(trackRun);
  };

  const handleAnalyzeAll = () => {
    analyzeAll().forEach((resultPromise) => resultPromise.then(trackRun));
  };

  const handleRunComplete = (runId: string) => {
    setActiveRunIds((prev) => prev.filter((id) => id !== runId));
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <p className="text-muted-foreground">
            {targets.length} URL{targets.length === 1 ? '' : 's'} in this project
          </p>
        </div>
        {targets.length > 0 && (
          <Button type="button" onClick={handleAnalyzeAll}>
            Analyze all
          </Button>
        )}
      </div>

      {activeRunIds.length > 0 && (
        <div className="flex flex-col gap-2">
          {activeRunIds.map((runId) => (
            <div key={runId} className="rounded-xl border border-border bg-card p-4">
              <LiveStatusTracker runId={runId} onComplete={handleRunComplete} />
            </div>
          ))}
        </div>
      )}

      <section>
        <h2 className="mb-2 text-lg font-semibold">URLs</h2>
        <ProjectUrlList
          targets={targets}
          onAddUrl={addUrl}
          onRemoveTarget={removeTarget}
          onAnalyzeTarget={handleAnalyzeTarget}
        />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Shared issues</h2>
        <SharedIssuesPanel sharedIssues={sharedIssues} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">History</h2>
        <ProjectHistorySummary targets={targets} sharedIssueCount={sharedIssues.length} />
      </section>
    </div>
  );
}
