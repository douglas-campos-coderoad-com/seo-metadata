'use client';

import { useCallback, useEffect, useState } from 'react';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { Project, ProjectAnalysis } from '@/shared/types';

/** Fetches a project's own persisted metadata and its analysis history
 * (specs/008-project-centric-analysis User Story 2 + User Story 4). */
export function useProjectDetail(projectId: number) {
  const [project, setProject] = useState<Project | null>(null);
  const [analyses, setAnalyses] = useState<ProjectAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [fetchedProject, fetchedAnalyses] = await Promise.all([
        analysisApiService.getProject(projectId),
        analysisApiService.listProjectAnalyses(projectId),
      ]);
      setProject(fetchedProject);
      setAnalyses(fetchedAnalyses);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load project.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  const refreshAnalyses = useCallback(async () => {
    const fetchedAnalyses = await analysisApiService.listProjectAnalyses(projectId);
    setAnalyses(fetchedAnalyses);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { project, analyses, isLoading, error, refresh, refreshAnalyses };
}
