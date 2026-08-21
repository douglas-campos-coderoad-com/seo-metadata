'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { Button } from '@/shared/components/ui/button';

export default function ProjectsPage() {
  const { projects } = useProjects();
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-muted-foreground">Group related URLs to spot SEO issues shared across pages.</p>
      </div>

      {isCreating ? (
        <div className="flex flex-col gap-2">
          <ProjectForm onCreated={(id) => router.push(`/projects/${id}`)} />
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsCreating(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button type="button" size="md" onClick={() => setIsCreating(true)}>
          Create Project
        </Button>
      )}

      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects yet — create one above.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="block rounded-xl border border-border bg-card p-4 hover:border-primary"
              >
                <p className="font-semibold">{project.title}</p>
                <p className="text-xs text-muted-foreground">
                  {project.category} · {project.country}
                  {project.region ? `, ${project.region}` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
