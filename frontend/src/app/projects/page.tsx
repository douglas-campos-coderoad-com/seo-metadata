'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useProjects } from '@/features/projects/hooks/useProjects';
import { ProjectForm } from '@/features/projects/components/ProjectForm';

export default function ProjectsPage() {
  const { projects } = useProjects();
  const router = useRouter();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Projects</h1>
        <p className="text-muted-foreground">Group related URLs to spot SEO issues shared across pages.</p>
      </div>

      <ProjectForm onCreated={(id) => router.push(`/projects/${id}`)} />

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
                <p className="font-semibold">{project.name}</p>
                <p className="text-xs text-muted-foreground">
                  {project.targetIds.length} URL{project.targetIds.length === 1 ? '' : 's'}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
