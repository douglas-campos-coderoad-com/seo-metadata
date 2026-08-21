// What the three scores mean — one source of truth, so the Executive Summary, the
// Before/After panels, and the project history chart all explain them identically.
// The overall wording matches the backend: `overall_score = (seo_score + geo_score) // 2`
// in backend/src/services/graph_nodes.py.

export type ScoreKey = 'overall' | 'seo' | 'geo';

export interface ScoreDefinition {
  label: string;
  description: string;
}

export const SCORE_DEFINITIONS: Record<ScoreKey, ScoreDefinition> = {
  overall: {
    label: 'Overall Score',
    description:
      "The website's overall search optimization quality, calculated as the average of the SEO Score and the GEO Score.",
  },
  seo: {
    label: 'SEO Score',
    description:
      'Measures technical SEO health, content structure, metadata, links, structured data, and other SEO factors.',
  },
  geo: {
    label: 'GEO Score',
    description:
      'Measures how well the content can be understood, cited, and surfaced by AI-powered search and answer engines.',
  },
};

/** "SEO Score — Measures technical SEO health…", for a tooltip on a bare label. */
export function scoreTooltip(key: ScoreKey): string {
  const { label, description } = SCORE_DEFINITIONS[key];
  return `${label} — ${description}`;
}
