import { useState, useEffect } from 'react';

export interface AnalysisStreamProgress {
  step: 'ingestion' | 'seo_audit' | 'geo_evaluation' | 'analysis' | 'json_ld' | 'completed' | 'error';
  progress: number;
  message: string;
  detail?: string;
  analysis_id?: number;
  seo_score?: number;
  geo_score?: number;
  overall_score?: number;
  error?: string;
}

export function useAnalysisStream(ingestedUrlId: number | null) {
  const [progressState, setProgressState] = useState<AnalysisStreamProgress>({
    step: 'ingestion',
    progress: 0,
    message: 'Initializing analysis...',
  });
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!ingestedUrlId) return;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
    const streamUrl = `${apiBaseUrl}/api/v1/analyze/${ingestedUrlId}/stream`;

    const eventSource = new EventSource(streamUrl);

    eventSource.addEventListener('progress', (event: MessageEvent) => {
      try {
        const data: AnalysisStreamProgress = JSON.parse(event.data);
        setProgressState(data);
      } catch (err) {
        console.error('Failed to parse SSE progress data:', err);
      }
    });

    eventSource.addEventListener('completed', (event: MessageEvent) => {
      try {
        const data: AnalysisStreamProgress = JSON.parse(event.data);
        setProgressState(data);
        setIsComplete(true);
        eventSource.close();
      } catch (err) {
        console.error('Failed to parse SSE completion data:', err);
      }
    });

    eventSource.addEventListener('error', (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        setProgressState({
          step: 'error',
          progress: 0,
          message: data.error || 'Streaming error occurred',
          error: data.error,
        });
      } catch {
        setProgressState((prev) => ({
          ...prev,
          step: 'error',
          message: 'Connection error during analysis stream',
        }));
      }
      eventSource.close();
    });

    return () => {
      eventSource.close();
    };
  }, [ingestedUrlId]);

  return { progressState, isComplete };
}
