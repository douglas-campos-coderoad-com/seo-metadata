'use client';

import { useCallback, useEffect, useState } from 'react';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { RunStatus } from '@/shared/types';

interface RunStatusSnapshot {
  status: RunStatus;
  score: number | null;
  failureReason: string | null;
  findingIds: string[];
  connectionLost: boolean;
}

const INITIAL_SNAPSHOT: RunStatusSnapshot = {
  status: 'queued',
  score: null,
  failureReason: null,
  findingIds: [],
  connectionLost: false,
};

export function useRunStatus(runId: string | null) {
  const [snapshot, setSnapshot] = useState<RunStatusSnapshot>(INITIAL_SNAPSHOT);

  const refresh = useCallback(() => {
    if (!runId) return;
    const run = analysisApiService.getRun(runId);
    setSnapshot({
      status: run?.status ?? 'queued',
      score: run?.score ?? null,
      failureReason: run?.failureReason ?? null,
      findingIds: run?.findingIds ?? [],
      connectionLost: false,
    });
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    refresh();

    const unsubscribe = analysisApiService.subscribeToRun(runId, (event) => {
      if (event.type === 'connection-lost') {
        setSnapshot((prev) => ({ ...prev, connectionLost: true }));
        return;
      }
      setSnapshot((prev) => ({
        ...prev,
        status: event.status,
        score: event.type === 'complete' ? event.score : prev.score,
        failureReason: event.type === 'failed' ? event.failureReason : prev.failureReason,
        findingIds: event.type === 'complete' ? event.findingIds : prev.findingIds,
        connectionLost: false,
      }));
    });

    return unsubscribe;
  }, [runId, refresh]);

  return { ...snapshot, refresh };
}
