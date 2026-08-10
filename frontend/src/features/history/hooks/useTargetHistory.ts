'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import type { AnalysisRun } from '@/shared/types';

export function useTargetHistory(targetId: string) {
  const target = useAppStore((state) => state.targets[targetId]);
  const runs = useAppStore((state) =>
    (state.targets[targetId]?.runIds ?? [])
      .map((id) => state.runs[id])
      .filter((run): run is AnalysisRun => Boolean(run)),
  );

  return { target, runs };
}
