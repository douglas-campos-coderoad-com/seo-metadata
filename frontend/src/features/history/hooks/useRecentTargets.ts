'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import type { AnalysisRun, AnalysisTarget } from '@/shared/types';

function latestActivityTimestamp(target: AnalysisTarget, runs: Record<string, AnalysisRun>): string {
  const latestRun = target.latestRunId ? runs[target.latestRunId] : undefined;
  return latestRun?.startedAt ?? target.createdAt;
}

/** All known targets, most recently active first. Pass `limit` to cap the list. */
export function useRecentTargets(limit?: number) {
  return useAppStore((state) => {
    const sorted = Object.values(state.targets).sort(
      (a, b) =>
        new Date(latestActivityTimestamp(b, state.runs)).getTime() -
        new Date(latestActivityTimestamp(a, state.runs)).getTime(),
    );
    return limit ? sorted.slice(0, limit) : sorted;
  });
}
