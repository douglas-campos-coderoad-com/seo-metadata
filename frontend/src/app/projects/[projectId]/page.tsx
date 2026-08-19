'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useProjectDetail } from '@/features/projects/hooks/useProjectDetail';
import { ProjectAnalysisHistory } from '@/features/projects/components/ProjectAnalysisHistory';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { LiveStatusTracker } from '@/features/analysis/components/LiveStatusTracker';
import { Button } from '@/shared/components/ui/button';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const numericProjectId = Number(projectId);
  const router = useRouter();
  const { project, analyses, isLoading, error, refresh, refreshAnalyses } = useProjectDetail(numericProjectId);
  const [activeRunIds, setActiveRunIds] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleStarted = (result: { runId: string }) => {
    setActiveRunIds((prev) => [...prev, result.runId]);
  };

  // Analyzing from within a project already knows the project — attach the result
  // automatically instead of leaving it in ephemeral client run state (User Story 4).
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
        <h2 className="mb-2 text-lg font-semibold">Competitors</h2>
        {project.competitors.length === 0 ? (
          <p className="text-sm text-muted-foreground">No competitors added yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {project.competitors.map((competitor) => (
              <li key={competitor.id} className="rounded-lg border border-border p-3">
                <p className="truncate text-sm font-medium">{competitor.url}</p>
                <p className="text-xs text-muted-foreground">{competitor.description}</p>
              </li>
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
