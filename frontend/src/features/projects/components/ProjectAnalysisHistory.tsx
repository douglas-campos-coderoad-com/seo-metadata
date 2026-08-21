'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Sparkles } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { BeforeAfterScoreChart } from '@/features/analysis/components/BeforeAfterScoreChart';
import { ExportReportButton } from '@/features/analysis/components/ExportReportButton';
import { StrategicImpactList } from '@/features/analysis/components/StrategicImpactList';
import { useOptimize } from '@/features/analysis/hooks/useOptimize';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import { useProjects } from '../hooks/useProjects';
import type { ProjectAnalysis } from '@/shared/types';

interface ProjectAnalysisHistoryProps {
  analyses: ProjectAnalysis[];
  projectId: number;
  /** Called after a successful remove, reassign, or optimize so the caller can refetch. */
  onAnalysisRemoved?: () => void;
}

function scoreFromJson(json: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = json?.[key];
  return typeof value === 'number' ? value : null;
}

/** Renders a project's persisted analysis history, chronological, with before/after
 * results (FR-004, FR-008). The "after" card offers an Optimize action whenever no
 * optimized score exists yet, and turns green as the estimate nears 100. */
export function ProjectAnalysisHistory({ analyses, projectId, onAnalysisRemoved }: ProjectAnalysisHistoryProps) {
  const { projects } = useProjects();
  const [reassignTarget, setReassignTarget] = useState<Record<number, string>>({});
  const [busyAnalysisId, setBusyAnalysisId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [optimizingId, setOptimizingId] = useState<number | null>(null);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const optimize = useOptimize();

  const otherProjects = projects.filter((p) => p.id !== projectId);

  const handleRemove = async (analysisId: number) => {
    if (!window.confirm('Remove this analysis from the project? This permanently deletes it.')) return;
    setBusyAnalysisId(analysisId);
    setActionError(null);
    try {
      await analysisApiService.removeAnalysisFromProject(projectId, analysisId);
      onAnalysisRemoved?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not remove this analysis.');
    } finally {
      setBusyAnalysisId(null);
    }
  };

  const handleReassign = async (analysisId: number) => {
    const targetId = reassignTarget[analysisId];
    if (!targetId) return;
    setBusyAnalysisId(analysisId);
    setActionError(null);
    try {
      await analysisApiService.attachAnalysisToProject(Number(targetId), analysisId);
      onAnalysisRemoved?.();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reassign this analysis.');
    } finally {
      setBusyAnalysisId(null);
    }
  };

  const handleOptimize = async (analysis: ProjectAnalysis) => {
    setOptimizingId(analysis.id);
    setOptimizeError(null);
    try {
      await optimize.run(analysis.id);
      // Refresh so the freshly persisted optimization appears in the history list.
      onAnalysisRemoved?.();
    } catch (err) {
      setOptimizeError(err instanceof Error ? err.message : 'Optimization failed.');
    } finally {
      setOptimizingId(null);
    }
  };

  if (analyses.length === 0) {
    return <p className="text-sm text-muted-foreground">No analyses in this project yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {(actionError || optimizeError) && (
        <p className="text-sm text-destructive">{optimizeError ?? actionError}</p>
      )}
      <ul className="flex flex-col gap-4">
        {analyses.map((analysis) => {
          const after = analysis.optimization?.scoreAfterEstimated;
          const afterScore = scoreFromJson(after, 'overall');
          const strategicImpacts = analysis.optimization?.strategicImpacts ?? [];
          const isBusy = busyAnalysisId === analysis.id;
          // Only surface the Optimize action when there's no persisted score yet.
          const showOptimize = afterScore === null;

          return (
            <li key={analysis.id} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{analysis.url}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(analysis.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="mt-3 rounded-lg border border-border bg-card p-3">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Before vs after
                  </p>
                  {afterScore !== null ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-success">
                      <CheckCircle2 className="h-3 w-3" />
                      Optimized
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Not optimized yet</span>
                  )}
                </div>

                <BeforeAfterScoreChart
                  before={{
                    overall: analysis.overallScore,
                    seo: analysis.seoScore,
                    geo: analysis.geoScore,
                  }}
                  after={{
                    overall: afterScore,
                    seo: scoreFromJson(after, 'seo'),
                    geo: scoreFromJson(after, 'geo'),
                  }}
                />

                {strategicImpacts.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <StrategicImpactList impacts={strategicImpacts} variant="compact" />
                  </div>
                )}

                {showOptimize && (
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 w-full gap-1.5"
                    disabled={optimizingId !== null}
                    onClick={() => handleOptimize(analysis)}
                  >
                    {optimizingId === analysis.id ? (
                      <>
                        <Spinner className="h-3.5 w-3.5" />
                        Optimizing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        Optimize
                      </>
                    )}
                  </Button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/runs/history/${projectId}/${analysis.id}`}>
                  <Button type="button" size="sm" variant="outline">
                    View
                  </Button>
                </Link>

                <ExportReportButton analysisId={analysis.id} size="sm" label="Export PDF Report" />

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={isBusy}
                  onClick={() => handleRemove(analysis.id)}
                >
                  Remove from project
                </Button>

                {otherProjects.length > 0 && (
                  <>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                      value={reassignTarget[analysis.id] ?? ''}
                      onChange={(event) =>
                        setReassignTarget((prev) => ({ ...prev, [analysis.id]: event.target.value }))
                      }
                    >
                      <option value="">Reassign to…</option>
                      {otherProjects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isBusy || !reassignTarget[analysis.id]}
                      onClick={() => handleReassign(analysis.id)}
                    >
                      Move
                    </Button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}