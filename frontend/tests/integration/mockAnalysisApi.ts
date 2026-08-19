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
    if (endpoint.startsWith('/optimize/')) {
      return {
        id: 1,
        analysis_id: 1,
        optimized_html: '<html><head><title>Optimized</title></head><body></body></html>',
        optimized_json_ld: { '@context': 'https://schema.org', '@graph': [] },
        optimized_content: {
          optimized_title: 'Optimized Title',
          optimized_meta_description: 'Optimized meta description with CTA.',
          geo_content: 'Optimized GEO content.',
          alt_texts: {},
          qa_pairs: [],
          fact_density_score: 85,
        },
        changes: [],
        copy_paste_ready: {
          head_tags_html: '<!-- Copy and paste inside the <head> -->\n<meta name="description" content="Optimized meta description with CTA.">',
          json_ld_script: '<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n  "@graph": []\n}\n</script>',
          body_snippet_html: '<!-- Copy and paste in the <body> -->\n<div class="artwork-faq-section">\n  <h3>About</h3>\n  <p>Optimized content.</p>\n</div>',
        },
        score_before: { seo: 70, geo: 60, overall: 65 },
        score_after_estimated: { seo: 92, geo: 85, overall: 89 },
        status: 'completed',
        error: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as never;
    }
    if (endpoint.startsWith('/geo/score/')) {
      return {
        total_score: 85,
        dimensions: {
          fact_density: { score: 80, weight: 0.25 },
          aeo_structure: { score: 90, weight: 0.25 },
          entity_coverage: { score: 85, weight: 0.25 },
          json_ld_validity: { score: 100, weight: 0.25 },
        },
        summary: { fact_density: 80, aeo_structure: 90, entity_coverage: 85, json_ld_validity: 100 },
        has_optimization: true,
      } as never;
    }
    throw new Error(`mockSuccessfulAnalysisPipeline: unexpected endpoint ${endpoint}`);
  });
}

export function mockFailingIngest(message = 'Ingest service unavailable') {
  return vi.spyOn(apiClient, 'post').mockRejectedValue(new Error(message));
}
