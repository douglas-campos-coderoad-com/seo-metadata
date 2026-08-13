'use client';

import { useCallback, useState } from 'react';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';

interface StartAnalysisInput {
  url: string;
  projectId?: string;
}

export function useStartAnalysis() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (input: StartAnalysisInput) => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await analysisApiService.startAnalysis(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start analysis.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { start, isSubmitting, error };
}
