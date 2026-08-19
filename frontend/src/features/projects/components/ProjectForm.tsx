'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { CompetitorListEditor } from './CompetitorListEditor';
import { PROJECT_CATEGORIES, type ProjectCategory, type Project } from '@/shared/types';
import type { CompetitorInput, ProjectInput } from '@/shared/realtime/AnalysisService';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import { useProjects } from '../hooks/useProjects';

interface ProjectFormProps {
  onCreated?: (projectId: number) => void;
  /** Edit mode when present — pre-fills the form and calls updateProject on submit
   * instead of createProject (FR-014). Pass a stable `key={project.id}` at the call
   * site so the form remounts (and re-syncs its initial state) when the target project
   * changes, rather than trying to reconcile prop changes into local state. */
  editingProject?: Project;
  onSaved?: (project: Project) => void;
}

export function ProjectForm({ onCreated, editingProject, onSaved }: ProjectFormProps) {
  const isEditing = Boolean(editingProject);
  const [title, setTitle] = useState(editingProject?.title ?? '');
  const [description, setDescription] = useState(editingProject?.description ?? '');
  const [category, setCategory] = useState<ProjectCategory>(editingProject?.category ?? PROJECT_CATEGORIES[0]);
  const [country, setCountry] = useState(editingProject?.country ?? '');
  const [region, setRegion] = useState(editingProject?.region ?? '');
  const [competitors, setCompetitors] = useState<CompetitorInput[]>(
    editingProject?.competitors.map((c) => ({ url: c.url, description: c.description })) ?? [],
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { createProject } = useProjects();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !description.trim() || !country.trim()) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const input: ProjectInput = {
        title: title.trim(),
        description: description.trim(),
        category,
        country: country.trim(),
        region: region.trim() || null,
        competitors,
      };

      if (isEditing && editingProject) {
        const project = await analysisApiService.updateProject(editingProject.id, input);
        onSaved?.(project);
        return;
      }

      const project = await createProject(input);
      setTitle('');
      setDescription('');
      setCategory(PROJECT_CATEGORIES[0]);
      setCountry('');
      setRegion('');
      setCompetitors([]);
      onCreated?.(project.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Could not ${isEditing ? 'save' : 'create'} project.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Title</span>
          <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Project title" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Category</span>
          <select
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as ProjectCategory)}
          >
            {PROJECT_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Site description</span>
        <Input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What does this site sell or offer?"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Country</span>
          <Input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="United States"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Region (optional)</span>
          <Input type="text" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="California" />
        </label>
      </div>

      <CompetitorListEditor
        competitors={competitors}
        onChange={setCompetitors}
        smartSearchContext={{ description, category, country, region }}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? (isEditing ? 'Saving…' : 'Creating…') : isEditing ? 'Save changes' : 'Create project'}
      </Button>
    </form>
  );
}
