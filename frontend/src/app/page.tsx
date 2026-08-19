'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hero } from '@/features/landing/components/Hero';
import { FeatureHighlights } from '@/features/landing/components/FeatureHighlights';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { LiveStatusTracker } from '@/features/analysis/components/LiveStatusTracker';
import { useProjects } from '@/features/projects/hooks/useProjects';

export default function LandingPage() {
  const { projects } = useProjects();
  const [runId, setRunId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-12">
      <Hero>
        <div className="flex flex-col gap-4">
          <UrlSubmitForm onStarted={({ runId: newRunId }) => setRunId(newRunId)} />
          {runId && (
            <div className="rounded-xl border border-border bg-background p-4 text-left">
              <LiveStatusTracker runId={runId} onComplete={(id) => router.push(`/runs/${id}`)} />
            </div>
          )}
        </div>
      </Hero>

      <FeatureHighlights />

      {projects.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your projects</h2>
            <Link href="/projects" className="text-sm underline-offset-4 hover:underline">
              View all
            </Link>
          </div>
          <ul className="flex flex-col gap-2">
            {projects.slice(0, 3).map((project) => (
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
        </section>
      )}
    </div>
  );
}
