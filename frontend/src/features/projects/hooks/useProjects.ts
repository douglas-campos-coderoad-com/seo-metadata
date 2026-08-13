'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';

export function useProjects() {
  const projects = useAppStore((state) =>
    Object.values(state.projects).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  const createProject = (name: string) => analysisApiService.createProject({ name });

  return { projects, createProject };
}
