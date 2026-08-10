'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { mockAnalysisService } from '@/shared/realtime/MockAnalysisService';

export function useProjects() {
  const projects = useAppStore((state) =>
    Object.values(state.projects).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  );

  const createProject = (name: string) => mockAnalysisService.createProject({ name });

  return { projects, createProject };
}
