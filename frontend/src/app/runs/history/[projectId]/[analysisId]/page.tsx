'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import { useOptimize } from '@/features/analysis/hooks/useOptimize';
import { buildFindings, type RawAnalysisData } from '@/shared/lib/findingMappers';
import { BeforeAfterViewer } from '@/features/analysis/components/BeforeAfterViewer';
import { ExportReportButton } from '@/features/analysis/components/ExportReportButton';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { LiveStatusTracker } from '@/features/analysis/components/LiveStatusTracker';
import { ProjectLabelLink } from '@/features/projects/components/ProjectLabelLink';
import type { Project, ProjectAnalysis } from '@/shared/types';

/**
 * Re-hydrates the interactive results page for one historical analysis
 * (specs/009-project-analysis-ux User Story 2 + User Story 3) — a separate route from
 * the live `/runs/[runId]` page since a historical entry has no client-session run
 * record, only a backend-persisted integer id (research.md §1).
 */
export default function HistoricalAnalysisPage() {
  const { projectId, analysisId } = useParams<{ projectId: string; analysisId: string }>();
  const numericProjectId = Number(projectId);
  const numericAnalysisId = Number(analysisId);
  const router = useRouter();

  const [project, setProject] = useState<Project | null>(null);
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);

  const optimizeLoader = useOptimize();

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    Promise.all([
      analysisApiService.getProject(numericProjectId),
      analysisApiService.getAnalysis(numericProjectId, numericAnalysisId),
    ])
      .then(([fetchedProject, fetchedAnalysis]) => {
        if (cancelled) return;
        setProject(fetchedProject);
        setAnalysis(fetchedAnalysis);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Could not load this historical analysis.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [numericProjectId, numericAnalysisId]);

  useEffect(() => {
    optimizeLoader.loadExisting(numericAnalysisId);
    // Deliberately keyed only on the analysis id — loadExisting is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericAnalysisId]);

  const handleStarted = (result: { runId: string }) => {
    setActiveRunId(result.runId);
  };

  // A fresh analysis from this view attaches to the same project and creates a new,
  // separate history entry (FR-011/FR-012) — the historical record above is never
  // touched by this. Land on the live run page to show its own results once complete.
  const handleRunComplete = async (runId: string) => {
    const run = analysisApiService.getRun(runId);
    if (run?.backendAnalysisId) {
      try {
        await analysisApiService.attachAnalysisToProject(numericProjectId, run.backendAnalysisId);
      } finally {
        router.push(`/runs/${runId}`);
      }
      return;
    }
    setActiveRunId(null);
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading historical analysis…</p>;
  }

  if (error || !project || !analysis) {
    return <p className="text-muted-foreground">{error ?? 'This historical analysis could not be found.'}</p>;
  }

  const findings = buildFindings(String(analysis.id), analysis.analysis as RawAnalysisData | null);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-muted-foreground">
            Project: <ProjectLabelLink projectId={project.id} title={project.title} />
          </p>
          <h1 className="text-2xl font-bold">Historical Analysis</h1>
          <p className="text-sm text-muted-foreground">URL: {analysis.url}</p>
        </div>
        <ExportReportButton analysisId={analysis.id} />
      </div>

      <BeforeAfterViewer
        analysisId={analysis.id}
        originalUrl={analysis.url}
        initialScore={analysis.overallScore ?? 0}
        initialSeoScore={analysis.seoScore}
        initialGeoScore={analysis.geoScore}
        findings={findings}
        preloadedOptimization={optimizeLoader.optimization}
        preloadedAfterGeoScore={optimizeLoader.geoScore}
      />

      <section>
        <h2 className="mb-2 text-lg font-semibold">Run a fresh analysis of this URL</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          This creates a new, separate entry in the project&apos;s history — the analysis above is never overwritten.
        </p>
        <UrlSubmitForm onStarted={handleStarted} projectId={numericProjectId} initialUrl={analysis.url} />
        {activeRunId && (
          <div className="mt-4 rounded-xl border border-border bg-card p-4">
            <LiveStatusTracker runId={activeRunId} onComplete={handleRunComplete} />
          </div>
        )}
      </section>
    </div>
  );
}
