'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useProjectDetail } from '@/features/projects/hooks/useProjectDetail';
import { ProjectAnalysisHistory } from '@/features/projects/components/ProjectAnalysisHistory';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { LiveStatusTracker } from '@/features/analysis/components/LiveStatusTracker';
import { Button } from '@/shared/components/ui/button';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';

function ScoreBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  const color = value >= 70 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200'
    : value >= 40 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200'
    : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200';
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{value}</span>;
}

function CompetitorCard({ competitor }: { competitor: { id: number; url: string; description: string; seoScore?: number | null; geoScore?: number | null; status?: string | null; analyzedAt?: string | null } }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className="truncate text-sm font-medium">{competitor.url}</p>
        {competitor.status === 'unreachable' ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-200">
            <AlertTriangle className="h-3 w-3" /> Unreachable
          </span>
        ) : competitor.analyzedAt && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-3 w-3" /> Analyzed
          </span>
        )}
      </div>
      <p className="mb-2 text-xs text-muted-foreground">{competitor.description}</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">SEO:</span>
          <ScoreBadge value={competitor.seoScore ?? null} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">GEO:</span>
          <ScoreBadge value={competitor.geoScore ?? null} />
        </div>

      </div>
    </li>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const numericProjectId = Number(projectId);
  const router = useRouter();
  const { project, analyses, isLoading, error, refresh, refreshAnalyses } = useProjectDetail(numericProjectId);
  const [activeRunIds, setActiveRunIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const handleStarted = (result: { runId: string }) => {
    setActiveRunIds((prev) => [...prev, result.runId]);
  };

  const handleRunComplete = async (runId: string) => {
    setActiveRunIds((prev) => prev.filter((id) => id !== runId));
    const run = analysisApiService.getRun(runId);
    if (run?.backendAnalysisId) {
      try {
        await analysisApiService.attachAnalysisToProject(numericProjectId, run.backendAnalysisId);
      } finally {
        refreshAnalyses();
      }
    }
  };

  const handleDelete = async () => {
    if (!project) return;
    if (!window.confirm(`Delete "${project.title}"? This permanently removes it and its analysis history.`)) {
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await analysisApiService.deleteProject(project.id);
      router.push('/projects');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete project.');
      setIsDeleting(false);
    }
  };

  const handleAudit = async () => {
    if (!project) return;
    setIsAuditing(true);
    setAuditError(null);
    try {
      await analysisApiService.auditCompetitors(project.id);
      // Refresh project to get updated competitors with scores
      await refresh();
    } catch (err) {
      setAuditError(err instanceof Error ? err.message : 'Audit failed.');
    } finally {
      setIsAuditing(false);
    }
  };

  if (isLoading) {
    return <p className="text-muted-foreground">Loading project…</p>;
  }

  if (error || !project) {
    return <p className="text-muted-foreground">{error ?? 'This project could not be found.'}</p>;
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold">Edit project</h1>
        <ProjectForm
          key={project.id}
          editingProject={project}
          onSaved={() => {
            setIsEditing(false);
            refresh();
          }}
        />
        <Button type="button" variant="ghost" onClick={() => setIsEditing(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{project.title}</h1>
          <p className="text-muted-foreground">{project.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {project.category} · {project.country}
            {project.region ? `, ${project.region}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit
          </Button>
          <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={isDeleting}>
            {isDeleting ? 'Deleting…' : 'Delete'}
          </Button>
        </div>
      </div>
      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}

      <section>
        <h2 className="mb-2 text-lg font-semibold">Analyze a URL for this project</h2>
        <UrlSubmitForm onStarted={handleStarted} projectId={numericProjectId} />
        {activeRunIds.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            {activeRunIds.map((runId) => (
              <div key={runId} className="rounded-xl border border-border bg-card p-4">
                <LiveStatusTracker runId={runId} onComplete={handleRunComplete} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Competitors</h2>
          <Button
            type="button"
            size="sm"
            onClick={handleAudit}
            disabled={isAuditing || project.competitors.length === 0}
          >
            {isAuditing ? 'Analyzing…' : 'Analyze competitors'}
          </Button>
        </div>
        {(auditError || (project as any)._auditError) && <p className="mb-2 text-sm text-destructive">{auditError ?? (project as any)._auditError}</p>}
        {project.competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No competitors added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {project.competitors.map((competitor) => (
              <CompetitorCard key={competitor.id} competitor={competitor} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-semibold">Analysis history</h2>
        <ProjectAnalysisHistory
          analyses={analyses}
          projectId={numericProjectId}
          onAnalysisRemoved={refreshAnalyses}
        />
      </section>
    </div>
  );
}