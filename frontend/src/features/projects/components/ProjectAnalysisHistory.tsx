'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/shared/components/ui/button';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import { useProjects } from '../hooks/useProjects';
import type { ProjectAnalysis } from '@/shared/types';

interface ProjectAnalysisHistoryProps {
  analyses: ProjectAnalysis[];
  projectId: number;
  /** Called after a successful remove or reassign so the caller can refetch (User Story 6). */
  onAnalysisRemoved?: () => void;
}

function scoreFromJson(json: Record<string, unknown> | null | undefined, key: string): number | null {
  const value = json?.[key];
  return typeof value === 'number' ? value : null;
}

/** Renders a project's persisted analysis history, chronological, with before/after
 * results (FR-004, FR-008). Each entry renders cleanly with no error when the
 * analysis has no optimization yet — "before" only, per the spec's edge case. */
export function ProjectAnalysisHistory({ analyses, projectId, onAnalysisRemoved }: ProjectAnalysisHistoryProps) {
  const { projects } = useProjects();
  const [reassignTarget, setReassignTarget] = useState<Record<number, string>>({});
  const [busyAnalysisId, setBusyAnalysisId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  if (analyses.length === 0) {
    return <p className="text-sm text-muted-foreground">No analyses in this project yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {actionError && <p className="text-sm text-destructive">{actionError}</p>}
      <ul className="flex flex-col gap-4">
        {analyses.map((analysis) => {
          const after = analysis.optimization?.scoreAfterEstimated;
          const isBusy = busyAnalysisId === analysis.id;
          return (
            <li key={analysis.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{analysis.url}</p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(analysis.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Before</p>
                  <p className="mt-1 font-mono text-lg font-bold tabular-nums">{analysis.overallScore ?? '—'}</p>
                  <p className="text-[11px] text-muted-foreground">
                    SEO {analysis.seoScore ?? '—'} · GEO {analysis.geoScore ?? '—'}
                  </p>
                </div>

                {analysis.optimization ? (
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">After</p>
                    <p className="mt-1 font-mono text-lg font-bold tabular-nums">
                      {scoreFromJson(after, 'overall') ?? '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      SEO {scoreFromJson(after, 'seo') ?? '—'} · GEO {scoreFromJson(after, 'geo') ?? '—'}
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center rounded-lg border border-dashed border-border p-3">
                    <p className="text-[11px] text-muted-foreground">No optimization run for this analysis yet.</p>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link href={`/runs/history/${projectId}/${analysis.id}`}>
                  <Button type="button" size="sm" variant="outline">
                    View
                  </Button>
                </Link>

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
