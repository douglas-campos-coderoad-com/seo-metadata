'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Modal } from '@/shared/components/ui/modal';
import { ProjectForm } from './ProjectForm';
import { useProjects } from '../hooks/useProjects';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { Project } from '@/shared/types';

interface AddToProjectActionProps {
  analysisId: number;
}

/**
 * "Add analysis to a project" (specs/009-project-analysis-ux User Story 1) — opens as a
 * modal offering either an existing project or creating a new one. Dismissing the modal
 * (backdrop click, Escape, or the close/cancel affordance) attaches nothing (FR-003).
 */
export function AddToProjectAction({ analysisId }: AddToProjectActionProps) {
  const { projects } = useProjects();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [attachedProject, setAttachedProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpen = () => {
    setMode(projects.length > 0 ? 'existing' : 'new');
    setSelectedProjectId(null);
    setError(null);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSelectedProjectId(null);
    setError(null);
  };

  const handleAttach = async (projectId: number) => {
    setIsSubmitting(true);
    setError(null);
    try {
      await analysisApiService.attachAnalysisToProject(projectId, analysisId);
      const project = projects.find((p) => p.id === projectId) ?? (await analysisApiService.getProject(projectId));
      setAttachedProject(project);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add this analysis to the project.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Already attached this session — reflect that rather than offering to add it again.
  if (attachedProject) {
    return (
      <p className="text-sm text-muted-foreground">
        Added to project: <span className="font-medium text-foreground">{attachedProject.title}</span>
      </p>
    );
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={handleOpen}>
        Add analysis to a project
      </Button>

      <Modal open={isOpen} onClose={handleClose} ariaLabel="Add analysis to a project">
        {mode === 'new' ? (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Create a new project</h3>
            <ProjectForm onCreated={handleAttach} />
            {projects.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setMode('existing')}>
                Choose an existing project instead
              </Button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">Choose a project</h3>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={selectedProjectId ?? ''}
              onChange={(event) => setSelectedProjectId(event.target.value ? Number(event.target.value) : null)}
            >
              <option value="">Select a project…</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button
                type="button"
                disabled={selectedProjectId === null || isSubmitting}
                onClick={() => selectedProjectId !== null && handleAttach(selectedProjectId)}
              >
                {isSubmitting ? 'Adding…' : 'Add to project'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode('new')}>
                Create a new project instead
              </Button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
