import { vi } from 'vitest';
import { apiClient } from '@/lib/api-client';

// AnalysisApiService.runPipeline() calls apiClient.post('/ingest/url', ...) then
// apiClient.post(`/analyze/${id}`, ...) — mock both legs so integration tests don't hit a real backend.
export function mockSuccessfulAnalysisPipeline() {
  return vi.spyOn(apiClient, 'post').mockImplementation(async (endpoint: string) => {
    if (endpoint === '/ingest/url') {
      return {
        id: 1,
        url: 'https://example.com',
        status: 'success',
        html_size_bytes: 1200,
        http_status: 200,
        content_type: 'text/html',
        created_at: new Date().toISOString(),
      } as never;
    }
    if (endpoint.startsWith('/analyze/')) {
      return {
        id: 1,
        ingested_url_id: 1,
        url: 'https://example.com',
        seo_score: 70,
        geo_score: 60,
        overall_score: 65,
        status: 'completed',
        analysis: { findings: [], geo_visibility: '', seo_breakdown: {}, geo_breakdown: {}, errors: [] },
        json_ld: null,
        created_at: new Date().toISOString(),
      } as never;
    }
    throw new Error(`mockSuccessfulAnalysisPipeline: unexpected endpoint ${endpoint}`);
  });
}

export function mockFailingIngest(message = 'Ingest service unavailable') {
  return vi.spyOn(apiClient, 'post').mockRejectedValue(new Error(message));
}
