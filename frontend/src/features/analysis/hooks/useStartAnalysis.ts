'use client';

import { useCallback, useState } from 'react';
import { mockAnalysisService } from '@/shared/realtime/MockAnalysisService';

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
      return await mockAnalysisService.startAnalysis(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start analysis.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  return { start, isSubmitting, error };
}
