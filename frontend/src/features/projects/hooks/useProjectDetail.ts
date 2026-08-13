'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { AnalysisTarget } from '@/shared/types';

export function useProjectDetail(projectId: string) {
  const project = useAppStore((state) => state.projects[projectId]);
  const targets = useAppStore((state) =>
    (state.projects[projectId]?.targetIds ?? [])
      .map((id) => state.targets[id])
      .filter((target): target is AnalysisTarget => Boolean(target)),
  );
  // Re-derives on every store change so it stays current as runs/findings complete (FR-016).
  const sharedIssues = useAppStore(() => analysisApiService.listSharedIssues(projectId));

  const addUrl = (url: string) => analysisApiService.addTargetToProject(projectId, url);
  const removeTarget = (targetId: string) => analysisApiService.removeTargetFromProject(projectId, targetId);
  const analyzeTarget = (url: string) => analysisApiService.startAnalysis({ url, projectId });
  const analyzeAll = () => targets.map((target) => analysisApiService.startAnalysis({ url: target.displayUrl, projectId }));

  return { project, targets, sharedIssues, addUrl, removeTarget, analyzeTarget, analyzeAll };
}
