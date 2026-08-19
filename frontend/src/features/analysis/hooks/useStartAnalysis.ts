'use client';

import { useCallback, useState } from 'react';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import { useAppStore } from '@/shared/store/useAppStore';
import type { RunStatus } from '@/shared/types';

interface StartAnalysisInput {
  url: string;
  projectId?: number;
}

const ACTIVE_STATUSES = new Set<RunStatus>(['queued', 'fetching', 'analyzing']);

export function useStartAnalysis() {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Driven by the store's run status (queued -> fetching -> analyzing -> complete/failed), which
  // transitions over real awaited network calls in runPipeline — unlike the startAnalysis() promise
  // itself, which resolves on the next microtask and gives the button nothing visible to show.
  const runStatus = useAppStore((state) => (activeRunId ? state.runs[activeRunId]?.status : undefined));
  const isSubmitting = activeRunId !== null && runStatus !== undefined && ACTIVE_STATUSES.has(runStatus);

  const start = useCallback(async (input: StartAnalysisInput) => {
    setError(null);
    try {
      const result = await analysisApiService.startAnalysis(input);
      setActiveRunId(result.runId);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start analysis.');
      return null;
    }
  }, []);

  return { start, isSubmitting, error };
}
