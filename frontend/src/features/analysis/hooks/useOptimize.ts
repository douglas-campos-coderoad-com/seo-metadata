'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import type { RoiProjection } from '../lib/roi';

// ── Backend response shapes ─────────────────────────────────────────────

export type { RoiProjection } from '../lib/roi';

export interface CopyPasteReady {
  head_tags_html: string;
  json_ld_script: string;
  body_snippet_html: string;
}

export interface OptimizationData {
  id: number;
  analysis_id: number;
  optimized_html: string | null;
  optimized_json_ld: Record<string, unknown> | null;
  optimized_content: {
    optimized_title?: string;
    optimized_meta_description?: string;
    geo_content?: string;
    alt_texts?: Record<string, string>;
    qa_pairs?: Array<{ question: string; answer: string }>;
    fact_density_score?: number;
  } | null;
  changes: Array<Record<string, unknown>> | null;
  copy_paste_ready: CopyPasteReady | null;
  score_before: { seo?: number; geo?: number; overall?: number } | null;
  score_after_estimated: { seo?: number; geo?: number; overall?: number } | null;
  roi_projection: RoiProjection | null;
  status: string;
  error: string | null;
}

export interface GeoScoreData {
  total_score: number;
  dimensions: Record<string, { score: number; weight: number }>;
  summary: Record<string, number>;
  has_optimization: boolean;
}

export interface OptimizeState {
  optimization: OptimizationData | null;
  geoScore: GeoScoreData | null;
  isLoading: boolean;
  error: string | null;
  run: (analysisId: number) => Promise<void>;
  reset: () => void;
}

export function useOptimize(): OptimizeState {
  const [optimization, setOptimization] = useState<OptimizationData | null>(null);
  const [geoScore, setGeoScore] = useState<GeoScoreData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (analysisId: number) => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Run the optimizer
      const optimizationResult = await apiClient.post<OptimizationData>(`/optimize/${analysisId}`, {});
      setOptimization(optimizationResult);

      // 2. Fetch the GEO citation score
      const geoScoreResult = await apiClient.post<GeoScoreData>(`/geo/score/${analysisId}`, {});
      setGeoScore(geoScoreResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Optimization failed.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setOptimization(null);
    setGeoScore(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return { optimization, geoScore, isLoading, error, run, reset };
}