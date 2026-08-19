'use client';

import { useCallback, useEffect, useState } from 'react';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { Project } from '@/shared/types';
import type { ProjectInput } from '@/shared/realtime/AnalysisService';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const items = await analysisApiService.listProjects();
      setProjects(items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load projects.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createProject = useCallback(async (input: ProjectInput) => {
    const project = await analysisApiService.createProject(input);
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  return { projects, isLoading, error, createProject, refresh };
}
