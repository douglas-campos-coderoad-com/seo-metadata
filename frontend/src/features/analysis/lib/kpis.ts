// The four business KPIs shown in the Executive Summary and in the After
// (Optimized) panel. Every number here is derived from data the analysis and the
// optimization already carry — no extra LLM call — so the panels can render the
// KPIs the moment the optimization loads. Each function documents the exact
// numerator/denominator it stands for, because the cards print the formula.

import type { Finding, FindingCategory, FindingSeverity } from '@/shared/types';
import type { OptimizationData } from '../hooks/useOptimize';

/* ─────────────── shared shape ─────────────── */

export interface RatioKpi {
  numerator: number;
  denominator: number;
  /** numerator / denominator × 100, rounded. Null when nothing was evaluated. */
  percent: number | null;
}

function ratio(numerator: number, denominator: number): RatioKpi {
  return {
    numerator,
    denominator,
    percent: denominator > 0 ? Math.round((numerator / denominator) * 100) : null,
  };
}

/* ─────────────── change → category mapping ─────────────── */

/** The `element` values the optimizer's plan/apply nodes emit in `changes[]`
 * (backend/src/services/optimizer_nodes.py), mapped onto finding categories. */
const CHANGE_ELEMENT_CATEGORY: Record<string, FindingCategory> = {
  title: 'metadata',
  meta_description: 'metadata',
  lang: 'metadata',
  canonical: 'crawlability',
  og_tags: 'social',
  twitter_tags: 'social',
  headings: 'headings',
  images_alt: 'images',
  json_ld: 'structured_data',
  content: 'content',
  geo_content: 'geo_aeo',
  qa_pairs: 'geo_aeo',
};

/** Categories the optimizer can fix on its own by rewriting the page's markup and
 * copy. Crawlability and performance are excluded: they need server, hosting, or
 * asset-pipeline changes, so counting them would understate the resolution rate. */
export const AUTO_FIXABLE_CATEGORIES: readonly FindingCategory[] = [
  'metadata',
  'content',
  'headings',
  'structured_data',
  'geo_aeo',
  'images',
  'social',
];

/** Categories this optimization actually touched — from the change log, plus the
 * artifacts the optimizer delivers outside it (optimized copy, Q&A, alt texts,
 * JSON-LD), which count on their own even when the LLM omitted the change entry. */
export function resolvedCategories(optimization: OptimizationData | null): Set<FindingCategory> {
  const categories = new Set<FindingCategory>();
  if (!optimization) return categories;

  for (const change of optimization.changes ?? []) {
    const element = String(change.element ?? '').trim().toLowerCase();
    const category = CHANGE_ELEMENT_CATEGORY[element];
    if (category) categories.add(category);
  }

  const content = optimization.optimized_content ?? {};
  if (content.optimized_title || content.optimized_meta_description) categories.add('metadata');
  if (content.geo_content) {
    categories.add('content');
    categories.add('geo_aeo');
  }
  if (content.qa_pairs && content.qa_pairs.length > 0) categories.add('geo_aeo');
  if (content.alt_texts && Object.keys(content.alt_texts).length > 0) categories.add('images');
  if (optimization.optimized_json_ld) categories.add('structured_data');

  return categories;
}

/* ─────────────── KPI 1: AI Recommendation Rate ─────────────── */

export interface AiRecommendationRateKpi {
  /** Total test queries: the optimizer's generated Q&A set — the questions an
   * answer engine is expected to field about this page. 0 when none exists. */
  queries: number;
  recommendedBefore: number;
  recommendedAfter: number;
  percentBefore: number | null;
  percentAfter: number | null;
  /** False when there is no Q&A set to count over and the rate falls back to the
   * GEO citability score alone. */
  hasQuerySet: boolean;
}

function recommendedCount(geoScore: number | null, queries: number): number {
  if (geoScore == null || queries <= 0) return 0;
  const clamped = Math.min(Math.max(geoScore, 0), 100);
  return Math.min(Math.round((queries * clamped) / 100), queries);
}

/**
 * AI Recommendation Rate = queries where the product is recommended / total test
 * queries × 100.
 *
 * The recommended count is estimated, not observed: the GEO citation score is the
 * modeled likelihood that an answer engine cites this page for such a query, so it
 * sets how many of the test queries are expected to name the product. Running the
 * AEO Live Test measures a single query for real; this KPI covers the whole set.
 */
export function aiRecommendationRate(
  geoBefore: number | null,
  geoAfter: number | null,
  optimization: OptimizationData | null,
): AiRecommendationRateKpi {
  const queries = optimization?.optimized_content?.qa_pairs?.length ?? 0;
  const recommendedBefore = recommendedCount(geoBefore, queries);
  const recommendedAfter = recommendedCount(geoAfter, queries);

  const percent = (recommended: number, geoScore: number | null): number | null => {
    if (queries > 0) return Math.round((recommended / queries) * 100);
    // No query set: the citability score is the best rate estimate available.
    return geoScore == null ? null : Math.round(Math.min(Math.max(geoScore, 0), 100));
  };

  return {
    queries,
    recommendedBefore,
    recommendedAfter,
    percentBefore: percent(recommendedBefore, geoBefore),
    percentAfter: percent(recommendedAfter, geoAfter),
    hasQuerySet: queries > 0,
  };
}

/* ─────────────── KPI 2: Attribute Accuracy ─────────────── */

export interface AttributeCheck {
  key: string;
  label: string;
  /** True when the attribute is present in the optimized output AND its value is
   * usable by an answer engine (numeric price, in-range rating, non-empty text). */
  correct: boolean;
}

export interface AttributeAccuracyKpi extends RatioKpi {
  checks: AttributeCheck[];
  /** False when the optimizer returned no JSON-LD at all — the cards say that
   * outright instead of listing every attribute as individually missing. */
  hasStructuredData: boolean;
}

type JsonRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Flattens a JSON-LD payload — single node, array, or `@graph` — into its nodes. */
function jsonLdNodes(jsonLd: unknown): JsonRecord[] {
  if (Array.isArray(jsonLd)) return jsonLd.flatMap(jsonLdNodes);
  if (!isRecord(jsonLd)) return [];
  const graph = jsonLd['@graph'];
  if (Array.isArray(graph)) return [jsonLd, ...graph.flatMap(jsonLdNodes)];
  return [jsonLd];
}

const PRODUCT_TYPES = new Set(['product', 'productgroup', 'individualproduct', 'offer', 'vehicle', 'book']);

function nodeTypes(node: JsonRecord): string[] {
  const raw = node['@type'];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase());
}

/** JSON-LD keys that carry no product data of their own, so a node holding only
 * these is an empty shell rather than structured data an answer engine can use. */
const STRUCTURAL_KEYS = new Set(['@context', '@type', '@id', '@graph']);

/** The product-ish node of the graph, falling back to the first node with real
 * content so a page modeled as something else still gets evaluated instead of
 * scoring 0. Null when the payload carries nothing but empty shells. */
function productNode(jsonLd: unknown): JsonRecord | null {
  const nodes = jsonLdNodes(jsonLd).filter((node) =>
    Object.keys(node).some((key) => !STRUCTURAL_KEYS.has(key)),
  );
  const product = nodes.find((node) => nodeTypes(node).some((type) => PRODUCT_TYPES.has(type)));
  return product ?? nodes[0] ?? null;
}

/** Follows `key` through a node, unwrapping arrays and `{ '@value': … }` wrappers. */
function field(node: JsonRecord | null, ...keys: string[]): unknown {
  if (!node) return undefined;
  for (const key of keys) {
    let value = node[key];
    if (Array.isArray(value)) value = value[0];
    if (isRecord(value) && '@value' in value) value = value['@value'];
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

const hasText = (value: unknown): boolean => {
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return true;
  // Schema.org nests brands, organizations, and images as objects.
  if (isRecord(value)) return hasText(field(value, 'name', 'url', '@id', 'contentUrl'));
  return false;
};

const isNumeric = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string') return value.trim() !== '' && Number.isFinite(Number(value));
  return false;
};

/** The product attributes an answer engine needs before it can answer about — and
 * recommend — this product. This fixed set is the KPI's denominator. */
const ATTRIBUTE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'name', label: 'Name' },
  { key: 'description', label: 'Description' },
  { key: 'brand', label: 'Brand' },
  { key: 'price', label: 'Price' },
  { key: 'currency', label: 'Currency' },
  { key: 'availability', label: 'Availability' },
  { key: 'image', label: 'Image' },
  { key: 'identifier', label: 'SKU / GTIN' },
  { key: 'url', label: 'URL' },
  { key: 'rating', label: 'Rating' },
];

/**
 * Attribute Accuracy = correct product attributes returned / attributes evaluated
 * × 100, evaluated over the optimized JSON-LD plus the optimized title and meta
 * description (the copy an answer engine reads alongside the structured data).
 */
export function attributeAccuracy(optimization: OptimizationData | null): AttributeAccuracyKpi {
  const node = productNode(optimization?.optimized_json_ld ?? null);
  const offers = (() => {
    const raw = field(node, 'offers');
    return isRecord(raw) ? raw : null;
  })();
  const content = optimization?.optimized_content ?? {};

  const rating = (() => {
    const aggregate = field(node, 'aggregateRating');
    const value = isRecord(aggregate) ? field(aggregate, 'ratingValue') : undefined;
    if (isNumeric(value)) {
      const numeric = Number(value);
      return numeric >= 0 && numeric <= 5;
    }
    return hasText(field(node, 'review'));
  })();

  const results: Record<string, boolean> = {
    name: hasText(field(node, 'name')) || hasText(content.optimized_title),
    description: hasText(field(node, 'description')) || hasText(content.optimized_meta_description),
    brand: hasText(field(node, 'brand', 'manufacturer')),
    price: isNumeric(field(offers, 'price', 'lowPrice')),
    currency: hasText(field(offers, 'priceCurrency')),
    availability: hasText(field(offers, 'availability')),
    image: hasText(field(node, 'image', 'thumbnailUrl')),
    identifier: hasText(field(node, 'sku', 'gtin13', 'gtin', 'mpn', 'productID')),
    url: hasText(field(node, 'url')) || hasText(field(offers, 'url')),
    rating,
  };

  const checks = ATTRIBUTE_LABELS.map(({ key, label }) => ({
    key,
    label,
    correct: results[key] ?? false,
  }));

  return {
    ...ratio(checks.filter((check) => check.correct).length, checks.length),
    checks,
    hasStructuredData: node !== null,
  };
}

/* ─────────────── KPI 3: Issue Resolution Rate ─────────────── */

export interface IssueResolutionRateKpi extends RatioKpi {
  /** Detected issues left out of the denominator because no content rewrite can
   * fix them (crawlability, performance) — surfaced so the rate reads honestly. */
  ineligible: number;
  /** The eligible-but-unresolved issues, for the "still pending" copy. */
  pending: number;
}

/**
 * Issue Resolution Rate = automatically resolved issues / detected eligible issues
 * × 100. Eligible means a non-good finding in a category the optimizer can rewrite;
 * resolved means the optimization touched that category.
 */
export function issueResolutionRate(
  findings: Finding[],
  optimization: OptimizationData | null,
): IssueResolutionRateKpi {
  const autoFixable = new Set<FindingCategory>(AUTO_FIXABLE_CATEGORIES);
  const issues = findings.filter((finding) => finding.severity !== 'good');
  const eligible = issues.filter((finding) => autoFixable.has(finding.category));
  const touched = resolvedCategories(optimization);
  const resolved = eligible.filter((finding) => touched.has(finding.category));

  return {
    ...ratio(resolved.length, eligible.length),
    ineligible: issues.length - eligible.length,
    pending: eligible.length - resolved.length,
  };
}

/* ─────────────── KPI 4: Optimization Time ─────────────── */

/** Hand-fixing effort per issue by severity — the manual baseline the optimizer is
 * measured against. Deliberately conservative: audit, write, review, ship. */
export const MANUAL_HOURS_PER_ISSUE: Record<FindingSeverity, number> = {
  critical: 1,
  warning: 0.5,
  medium: 0.25,
  good: 0,
};

/** An optimizer run walks a five-node graph with several LLM calls, so a gap this
 * small means the row's timestamps never straddled the run (a backfilled or
 * re-persisted record) rather than a sub-second optimization. Below this floor the
 * duration is reported as unknown instead of producing a fantasy speedup. */
export const MIN_PLAUSIBLE_RUN_SECONDS = 5;

/** Above this the multiplier stops informing and starts sounding like a sales
 * claim, so the cards show the two durations alone. */
export const MAX_CREDIBLE_SPEEDUP = 100;

export interface OptimizationTimeKpi {
  /** Manual effort for the issues the optimizer resolved, at MANUAL_HOURS_PER_ISSUE. */
  manualHours: number;
  /** Wall-clock of the optimizer run. Null when the timestamps are missing or too
   * close together to be the real run (see MIN_PLAUSIBLE_RUN_SECONDS). */
  visoraMinutes: number | null;
  hoursSaved: number | null;
  /** manualHours ÷ run duration, whole number. Null when the duration is unknown,
   * zero, or so short the ratio would not be credible. */
  speedupFactor: number | null;
  /** Issues behind `manualHours` — the same numerator as the resolution rate. */
  issuesResolved: number;
}

/** Optimization Time = time required before vs. after Visora. */
export function optimizationTime(
  findings: Finding[],
  optimization: OptimizationData | null,
): OptimizationTimeKpi {
  const autoFixable = new Set<FindingCategory>(AUTO_FIXABLE_CATEGORIES);
  const touched = resolvedCategories(optimization);
  const resolved = findings.filter(
    (finding) =>
      finding.severity !== 'good' && autoFixable.has(finding.category) && touched.has(finding.category),
  );

  // Two decimals, so the 15-minute (0.25 h) medium-issue increment survives the sum.
  const manualHours =
    Math.round(resolved.reduce((total, finding) => total + MANUAL_HOURS_PER_ISSUE[finding.severity], 0) * 100) / 100;

  const started = optimization?.created_at ? Date.parse(optimization.created_at) : NaN;
  const finished = optimization?.updated_at ? Date.parse(optimization.updated_at) : NaN;
  const elapsedMs = Number.isFinite(started) && Number.isFinite(finished) ? finished - started : NaN;

  if (!Number.isFinite(elapsedMs) || elapsedMs < MIN_PLAUSIBLE_RUN_SECONDS * 1_000) {
    return { manualHours, visoraMinutes: null, hoursSaved: null, speedupFactor: null, issuesResolved: resolved.length };
  }

  const visoraMinutes = Math.round((elapsedMs / 60_000) * 10) / 10;
  const visoraHours = elapsedMs / 3_600_000;
  const speedup = Math.round(manualHours / visoraHours);

  return {
    manualHours,
    visoraMinutes,
    hoursSaved: Math.round(Math.max(manualHours - visoraHours, 0) * 10) / 10,
    speedupFactor: speedup >= 2 && speedup <= MAX_CREDIBLE_SPEEDUP ? speedup : null,
    issuesResolved: resolved.length,
  };
}

/* ─────────────── formatting ─────────────── */

export function formatPercent(value: number | null): string {
  return value == null ? '—' : `${value}%`;
}

/** "45 min" under an hour, "2.5 h" above — the manual baseline and the run
 * duration land at wildly different magnitudes and share one formatter. */
export function formatDuration(hours: number | null): string {
  if (hours == null) return '—';
  if (hours === 0) return '0 min';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${Math.round(hours * 10) / 10} h`;
}

/** "1 issue needs" / "3 issues need" — the KPI footnotes read as sentences. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function formatMinutes(minutes: number | null): string {
  if (minutes == null) return '—';
  if (minutes < 1) return `${Math.max(Math.round(minutes * 60), 1)} s`;
  if (minutes < 60) return `${Math.round(minutes * 10) / 10} min`;
  return formatDuration(minutes / 60);
}
