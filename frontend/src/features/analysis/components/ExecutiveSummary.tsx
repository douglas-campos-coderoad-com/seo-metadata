'use client';

import { useMemo } from 'react';
import { AlertCircle, AlertTriangle, BarChart3, Check, ClipboardCheck, Clock, DollarSign, Info, type LucideIcon } from 'lucide-react';
import { ScoreRadial } from '@/shared/components/ScoreRadial';
import { ScoreDescription, ScoreInfo } from '@/shared/components/ScoreInfo';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { scoreToSeverity, SEVERITY_RANK } from '@/shared/lib/severity';
import type { ScoreKey } from '@/shared/lib/scoreDefinitions';
import { CATEGORY_ICONS } from '@/shared/lib/categoryIcons';
import { Badge } from '@/shared/components/ui/badge';
import type { Finding, FindingCategory, FindingSeverity } from '@/shared/types';
import type { OptimizationData, GeoScoreData } from '../hooks/useOptimize';
import { formatCurrency, formatRoiPercent, monthsToRecover } from '../lib/roi';
import type { RoiProjection } from '../lib/roi';
import { RoiProjectionPanel } from './RoiProjectionPanel';
import { StrategicImpactList } from './StrategicImpactList';
import { OptimizationKpiPanel } from './OptimizationKpiPanel';

/* ─────────────── types ─────────────── */

interface ExecutiveSummaryProps {
  analysisId: number;
  originalUrl: string;
  initialScore: number;
  initialSeoScore: number | null;
  initialGeoScore: number | null;
  findings: Finding[];
  optimization: OptimizationData | null;
  geoScore: GeoScoreData | null;
  onNavigateDetail?: (category: FindingCategory | null) => void;
}

/* ─────────────── helpers ─────────────── */

function delta(before: number, after: number): number {
  return Math.round(after - before);
}

function countBySeverity(findings: Finding[], severity: FindingSeverity): number {
  return findings.filter((f) => f.severity === severity).length;
}

function countByCategory(findings: Finding[], category: FindingCategory): number {
  return findings.filter((f) => f.category === category).length;
}

function impactBadge(sev: FindingSeverity): React.ReactNode {
  const map: Record<FindingSeverity, { label: string; className: string }> = {
    critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200' },
    warning: { label: 'High', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-200' },
    medium: { label: 'Medium', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200' },
    good: { label: 'Good', className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' },
  };
  const c = map[sev];
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.className}`}>{c.label}</span>;
}

/* category list matching backend report_mappings.py + ui constants */
const ALL_CATEGORIES: FindingCategory[] = [
  'metadata',
  'content',
  'headings',
  'structured_data',
  'geo_aeo',
  'images',
  'social',
  'crawlability',
  'performance',
];

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  metadata: 'Metadata',
  content: 'Content',
  headings: 'Headings',
  structured_data: 'Structured data',
  geo_aeo: 'Generative and answer engines',
  images: 'Images',
  social: 'Social sharing',
  crawlability: 'Crawlability',
  performance: 'Performance',
};

/* ─────────────── sub-components ─────────────── */

const clampScore = (value: number) => Math.min(Math.max(value, 0), 100);

/**
 * Both scores on one 0–100 track: the muted stretch is where the page already
 * stood, and the coloured stretch on top of it is what the optimization moved —
 * so the gain is a length rather than a number the reader has to subtract.
 * A regression paints that same stretch in the destructive tone instead.
 */
function ProgressionTrack({ before, after }: { before: number; after: number }) {
  const start = clampScore(Math.min(before, after));
  const end = clampScore(Math.max(before, after));
  const improved = after >= before;

  return (
    <div
      className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
      role="img"
      aria-label={`Before ${before} out of 100, after ${after} out of 100`}
    >
      <div className="h-full bg-muted-foreground/30" style={{ width: `${start}%` }} />
      <div className={`h-full ${improved ? 'bg-success' : 'bg-destructive'}`} style={{ width: `${end - start}%` }} />
    </div>
  );
}

/** One score: what it measures, where it landed, and how far it moved. */
function ScoreCard({
  title,
  definition,
  before,
  after,
  delta: d,
  size = 'md',
}: {
  title: string;
  /** Which score this card is, so it can print what the number measures. */
  definition: ScoreKey;
  before: number;
  after: number;
  delta: number;
  size?: 'lg' | 'md';
}) {
  const severity = scoreToSeverity(after);
  const isPositive = d > 0;
  const isNegative = d < 0;

  const trendColor = isPositive ? 'text-success' : isNegative ? 'text-destructive' : 'text-muted-foreground';
  const trendLabel = isPositive ? `+${d} pts` : isNegative ? `${d} pts` : 'No change';

  return (
    <div className={`flex flex-col rounded-2xl border border-border bg-card p-5 ${size === 'lg' ? 'sm:col-span-2' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`text-xs font-semibold tabular-nums ${trendColor}`}>{trendLabel}</span>
          <SeverityBadge severity={severity} />
        </div>
      </div>

      <ScoreDescription score={definition} className="mt-1 max-w-prose" />

      {/* The ring carries the score itself — no second copy of the number beside it. */}
      <div className="mt-4 flex items-center gap-4">
        <ScoreRadial score={after} size={size === 'lg' ? 'lg' : 'sm'} />

        <div className="min-w-0 flex-1">
          <ProgressionTrack before={before} after={after} />
          <div className="mt-2 flex items-baseline justify-between text-xs text-muted-foreground">
            <span>
              Before <span className="font-semibold tabular-nums text-foreground">{before}</span>
            </span>
            <span>
              After <span className="font-semibold tabular-nums text-foreground">{after}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Impact overview: changes applied, severity breakdown, categories */
function ImpactOverview({
  changesApplied,
  criticalBefore,
  warningBefore,
  mediumBefore,
  totalFindings,
  categoryIssues,
  onNavigateDetail,
}: {
  changesApplied: number;
  criticalBefore: number;
  warningBefore: number;
  mediumBefore: number;
  totalFindings: number;
  categoryIssues: Array<{ category: FindingCategory; label: string; icon: React.ComponentType<{ className?: string }>; issues: number }>;
  onNavigateDetail?: (category: FindingCategory | null) => void;
}) {
  const solvedOrAddressed = Math.min(changesApplied, totalFindings);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h4 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Improvement Impact</h4>

      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="text-center">
          <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{changesApplied}</p>
          <p className="text-xs text-muted-foreground">Changes Applied</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">{criticalBefore}</p>
          <p className="text-xs text-muted-foreground">Critical Detected</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">{warningBefore}</p>
          <p className="text-xs text-muted-foreground">High Detected</p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold">{solvedOrAddressed}</p>
          <p className="text-xs text-muted-foreground">Addressed</p>
        </div>
      </div>

      {/* categories row */}
      {categoryIssues.length > 0 && (
        <div className="space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Issues by Category</h5>
          <div className="flex flex-wrap gap-2">
            {categoryIssues.map((ci) => (
              <button
                key={ci.category}
                onClick={() => onNavigateDetail?.(ci.category)}
                className={`flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-left transition hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-primary`}
                aria-label={`${ci.label}: ${ci.issues} problem${ci.issues > 1 ? 's' : ''}. Click to view details.`}
                title={`${ci.label}: ${ci.issues} problem${ci.issues > 1 ? 's' : ''}`}
              >
                <ci.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{ci.label}</span>
                <Badge variant="secondary" className="ml-auto">{ci.issues}</Badge>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Top recommendations — best practices implemented */
function TopRecommendations({
  items,
  changesApplied,
}: {
  items: Array<{
    id: string;
    title: string;
    rationale: string;
    severity: FindingSeverity;
    category: FindingCategory;
  }>;
  changesApplied: number;
}) {
  // group by severity buckets
  const groups: Record<string, typeof items> = {
    critical: [],
    high: [],
    medium: [],
  };

  for (const it of items) {
    if (it.severity === 'critical') groups.critical.push(it);
    else if (it.severity === 'warning') groups.high.push(it);
    else groups.medium.push(it);
  }

  const groupMeta: Record<string, { label: string; icon: LucideIcon; iconClassName: string; count: number }> = {
    critical: { label: 'Critical Resolved', icon: AlertCircle, iconClassName: 'text-red-500', count: groups.critical.length },
    high: { label: 'High Priority', icon: AlertTriangle, iconClassName: 'text-amber-500', count: groups.high.length },
    medium: { label: 'Recommendations', icon: Info, iconClassName: 'text-blue-500', count: groups.medium.length },
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Implemented Best Practices</h4>
        <Badge variant="outline">{changesApplied} total changes</Badge>
      </div>

      <div className="space-y-5">
        {Object.entries(groupMeta).map(([key, meta]) => {
          const groupItems = groups[key];
          if (groupItems.length === 0) return null;

          return (
            <div key={key}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <meta.icon className={`h-4 w-4 ${meta.iconClassName}`} />
                <span>{meta.label}</span>
                <Badge variant="secondary" className="ml-0">{meta.count}</Badge>
              </div>
              <ul className="space-y-2">
                {groupItems.map((item) => {
                  const CatIcon = CATEGORY_ICONS[item.category];
                  return (
                    <li key={item.id} className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                          Before
                          <svg className="h-3 w-3 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                          </svg>
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          After
                        </span>
                        <span className="ml-auto">{impactBadge(item.severity)}</span>
                      </div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.rationale}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{CATEGORY_LABELS[item.category]}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Cost savings & time section — now includes Productivity Value (realistic defaults: 15 min, 200 listings, $25/h, $2400/yr) */
function CostSavingsSection({
  roi,
  monthlyRecovery: mr,
  changesApplied,
  criticalBefore,
}: {
  roi: RoiProjection;
  monthlyRecovery: string | null;
  changesApplied: number;
  criticalBefore: number;
}) {
  const fi = roi.financial_impact_annual;
  const it = roi.incremental_traffic_monthly;
  const prod = (roi as unknown as { productivity_impact_annual?: RoiProjection['productivity_impact_annual'] }).productivity_impact_annual;
  const m = roi.metrics_used;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Financial impact */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h4 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><DollarSign className="h-4 w-4" /> Projected Financial Impact</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Incremental Revenue/Year</dt>
          <dd className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(fi.incremental_revenue)}</dd>

          <dt className="text-muted-foreground">Optimization Cost</dt>
          <dd className="font-semibold">{formatCurrency(fi.optimization_cost)}</dd>

          <dt className="text-muted-foreground">Net Profit</dt>
          <dd className={`font-semibold ${fi.net_profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
            {formatCurrency(fi.net_profit)}
          </dd>

          <dt className="text-muted-foreground">ROI</dt>
          <dd className="font-semibold">{formatRoiPercent(fi.roi_percentage)}</dd>

          <dt className="col-span-2 mt-2 border-t border-border pt-2 text-muted-foreground">Time to Recover Investment</dt>
          <dd className="col-span-2 font-semibold">
            {mr != null ? `${mr} months` : 'Not available'}
          </dd>
        </dl>
      </div>

      {/* Traffic impact */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <h4 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><BarChart3 className="h-4 w-4" /> Monthly Traffic Impact</h4>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <dt className="text-muted-foreground">Traditional Traffic (+)</dt>
          <dd className="font-semibold">+{it.seo_traditional}/mo</dd>

          <dt className="text-muted-foreground">AI/GEO (+)</dt>
          <dd className="font-semibold">+{it.geo_ai}/mo</dd>

          <dt className="col-span-2 border-t border-border pt-2 font-semibold text-primary">
            Total estimated incremental: +{it.total} visits/mo
          </dt>
        </dl>

        {/* estimated time saved */}
        <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <h5 className="mb-1 flex items-center gap-1 text-xs font-medium text-muted-foreground"><Clock className="h-3.5 w-3.5" /> Time Saved (estimated)</h5>
          <p className="text-xs text-muted-foreground">
            {changesApplied ?? 0} changes applied (including {criticalBefore} critical). 
            Based on priority and quantity of automated fixes.
            Actual time may vary depending on implementation complexity.
          </p>
        </div>
      </div>

      {/* Productivity Value — subtitle + calculation */}
      {prod && (
        <div className="rounded-2xl border border-border bg-card p-5 md:col-span-2">
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><Clock className="h-4 w-4" /> Productivity Value</h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Annual Productivity Value</dt>
            <dd className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(prod.annual_productivity_value)}</dd>

            <dt className="text-muted-foreground">Annual Visora Cost</dt>
            <dd className="font-semibold">{formatCurrency(prod.annual_visora_cost)}</dd>

            <dt className="text-muted-foreground">Annual Quantified Benefit</dt>
            <dd className="font-semibold">{formatCurrency(prod.annual_quantified_benefit)}</dd>

            <dt className="text-muted-foreground">Productivity ROI</dt>
            <dd className={`font-semibold ${prod.productivity_roi_percentage >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>{formatRoiPercent(prod.productivity_roi_percentage)}</dd>

            <dt className="col-span-2 mt-2 border-t border-border pt-2 text-[11px] text-muted-foreground">Formula</dt>
            <dd className="col-span-2 font-mono text-xs">
              ({m.manual_minutes_saved_per_listing ?? 15} min ÷ 60) × {m.listings_per_month ?? 200} listings/mo × {formatCurrency(m.labor_cost_per_hour ?? 25)}/h × 12 = {formatCurrency(prod.annual_productivity_value)}/yr
              <span className="mx-1 text-muted-foreground">→</span>
              {formatCurrency(prod.annual_productivity_value)} + {formatCurrency(fi.incremental_revenue)} revenue = {formatCurrency(prod.annual_quantified_benefit)} benefit; ROI = ({formatCurrency(prod.annual_quantified_benefit)} − {formatCurrency(prod.annual_visora_cost)}) ÷ {formatCurrency(prod.annual_visora_cost)} × 100 = {formatRoiPercent(prod.productivity_roi_percentage)}
            </dd>

            <dt className="text-muted-foreground">Productivity-only ROI</dt>
            <dd className="font-semibold">{formatRoiPercent(prod.productivity_only_roi_percentage)}</dd>
          </dl>
          <p className="mt-3 text-[11px] text-muted-foreground/70">
            Based on {m.manual_minutes_saved_per_listing ?? 15} min saved per listing, {m.listings_per_month ?? 200} listings/mo at {formatCurrency(m.labor_cost_per_hour ?? 25)}/h and an annual Visora cost of {formatCurrency(prod.annual_visora_cost)}. Adjust these assumptions in the ROI Projection panel to match your reality.
          </p>
        </div>
      )}
    </div>
  );
}

/** Implementation checklist */
function ImplementationChecklist({
  checklist,
  onNavigateDetail,
}: {
  checklist: Array<{ label: string; done: boolean; category: FindingCategory }>;
  onNavigateDetail?: (category: FindingCategory) => void;
}) {
  const doneCount = checklist.filter((c) => c.done).length;
  const pending = checklist.filter((c) => !c.done).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><ClipboardCheck className="h-4 w-4" /> Implementation Checklist</h4>
        <Badge variant="outline">{doneCount} of {checklist.length} completed</Badge>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {checklist.map((item) => {
          const Icon = CATEGORY_ICONS[item.category];
          return (
            <button
              key={item.category}
              onClick={() => onNavigateDetail?.(item.category)}
              className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary ${
                item.done
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/50'
                  : 'border-border bg-muted/20'
              }`}
              aria-label={`${item.label}${item.done ? ' — completed' : ' — pending'}`}
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
                item.done
                  ? 'border-emerald-400 bg-emerald-500 text-white'
                  : 'border-muted-foreground/40 bg-muted'
              }`}>
                {item.done ? <Check className="h-3 w-3" /> : ''}
              </span>
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1">{item.label}</span>
              {item.done && <Badge className="h-5 bg-emerald-100 px-1.5 text-[10px] font-semibold text-emerald-700">Done</Badge>}
              {!item.done && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-semibold">Pending</Badge>}
            </button>
          );
        })}
      </div>

      {pending > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">
          Click any category to view corresponding details.
        </p>
      )}
    </div>
  );
}

/* ─────────────── main component ─────────────── */

export function ExecutiveSummary({
  analysisId,
  originalUrl,
  initialScore,
  initialSeoScore,
  initialGeoScore,
  findings,
  optimization,
  geoScore,
  onNavigateDetail,
}: ExecutiveSummaryProps) {
  const hasOptimization = Boolean(optimization && optimization.score_after_estimated?.overall != null);
  // Older optimizations predate the field, and a failed planning call persists none.
  const strategicImpacts = optimization?.strategic_impacts ?? [];

  const afterOverall = hasOptimization ? optimization?.score_after_estimated?.overall ?? 0 : 0;
  const afterSeo = hasOptimization ? optimization?.score_after_estimated?.seo ?? null : null;
  const afterGeo = hasOptimization ? optimization?.score_after_estimated?.geo ?? null : null;

  const overallDelta = hasOptimization ? delta(initialScore, afterOverall) : 0;
  const seoDelta = afterSeo != null && initialSeoScore != null ? delta(initialSeoScore, afterSeo) : null;
  const geoDelta = afterGeo != null && initialGeoScore != null ? delta(initialGeoScore, afterGeo) : null;

  /* categorisation counts (before optimisation — i.e. raw findings) */
  const totalFindings = findings.length;
  const criticalCount = countBySeverity(findings, 'critical');
  const warningCount = countBySeverity(findings, 'warning');
  const mediumCount = countBySeverity(findings, 'medium');
  const goodCount = countBySeverity(findings, 'good');

  /* changes applied count */
  const changesApplied = optimization?.changes?.length ?? 0;

  /* per-category issue counts */
  const categoryIssues = useMemo(() => {
    return ALL_CATEGORIES.map((cat) => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      icon: CATEGORY_ICONS[cat],
      issues: countByCategory(findings, cat),
    })).filter((c) => c.issues > 0);
  }, [findings]);

  /* ROI helpers */
  const roi: RoiProjection | null = hasOptimization ? optimization?.roi_projection ?? null : null;

  const monthlyRecovery = useMemo(() => {
    if (!roi) return null;
    const annualRev = roi.financial_impact_annual.incremental_revenue;
    const cost = roi.financial_impact_annual.optimization_cost;
    const m = monthsToRecover(annualRev, cost);
    return m == null ? null : m.toFixed(1);
  }, [roi]);

  /* status message */
  const statusMessage = useMemo(() => {
    if (!hasOptimization) return null;
    if (overallDelta >= 20) return 'Significant improvement detected in overall scores.';
    if (overallDelta >= 10) return 'Notable improvement in SEO and GEO/AEO after applying optimizations.';
    if (overallDelta >= 1) return 'Small improvements applied. Review technical details to optimize further.';
    if (overallDelta === 0) return 'No significant changes. Review remaining findings.';
    return 'Optimization did not produce the expected improvement. Review applied changes.';
  }, [hasOptimization, overallDelta]);

  /* top recommendations derived from findings grouped by severity then category */
  interface RecommendationItem {
    id: string;
    title: string;
    rationale: string;
    severity: FindingSeverity;
    category: FindingCategory;
  }

  const topRecommendations = useMemo((): RecommendationItem[] => {
    const sorted = [...findings]
      .filter((f) => f.severity !== 'good') // exclude "good" ones for the exec summary
      .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

    const seen = new Set<string>();
    const items: RecommendationItem[] = [];

    for (const f of sorted) {
      if (items.length >= 8) break; // cap to avoid overflow in the executive card
      const key = `${f.category}-${f.title}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const action = f.recommendations?.[0]?.action ?? f.title;
      const rationale = f.recommendations?.[0]?.rationale ?? f.description;

      items.push({
        id: f.id,
        title: f.title,
        rationale: action || rationale || f.description,
        severity: f.severity,
        category: f.category,
      });
    }

    return items;
  }, [findings]);

  /* checklist derived from categories that have at least one resolved finding or change */
  interface ChecklistItem {
    label: string;
    done: boolean;
    category: FindingCategory;
  }

  const implementationChecklist = useMemo((): ChecklistItem[] => {
    const catsWithIssues = new Set(categoryIssues.map((c) => c.category));
    const changesSet = new Set(optimization?.changes?.map((ch) => String(ch.element ?? '')) ?? []);

    const items: ChecklistItem[] = ALL_CATEGORIES.map((cat) => {
      const hasIssue = catsWithIssues.has(cat);
      const addressed = hasIssue && changesApplied > 0;
      return {
        label: CATEGORY_LABELS[cat],
        done: addressed,
        category: cat,
      };
    }).filter((c) => true); // keep all so checklist feels complete

    return items;
  }, [categoryIssues, changesApplied, optimization?.changes]);

  /* percentage bar helper */
  function pctBar(current: number, max: number, colorClass: string, showValue = true): React.ReactNode {
    const pct = max === 0 ? 0 : Math.round((current / max) * 100);
    return (
      <div className="w-full">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{current}</span>
          {showValue && <span>{pct}%</span>}
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }

  /* empty state when optimization is not yet available */
  if (!hasOptimization) {
    return (
      <section className="flex flex-col gap-8" aria-label="Executive summary pending optimization">
        {/* header */}
        <div className="flex flex-col gap-2">
          <h3 className="text-xl font-bold">Executive Summary</h3>
          <p className="text-sm text-muted-foreground">{originalUrl}</p>
        </div>

        {/* CTA card */}
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-base font-medium">Run optimization to see your executive summary.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Before/after scores, category improvements, and impact projections will be displayed.
          </p>
        </div>

        {/* current state snapshot */}
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="flex items-center justify-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
              Current Score
              <ScoreInfo score="overall" />
            </p>
            <div className="mt-2 flex justify-center">
              <ScoreRadial score={initialScore} size="lg" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Total Findings</p>
            <p className="mt-2 text-3xl font-bold">{totalFindings}</p>
            <div className="mt-2 flex justify-center gap-2 text-xs">
              {criticalCount > 0 && <Badge variant="destructive">{criticalCount} critical</Badge>}
              {warningCount > 0 && <Badge className="bg-orange-100 text-orange-700">{warningCount} high</Badge>}
              {mediumCount > 0 && <Badge className="bg-amber-100">{mediumCount} medium</Badge>}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Categories with Issues</p>
            <p className="mt-2 text-3xl font-bold">{categoryIssues.length}</p>
          </div>
        </div>

        {/* priority breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Distribution by Severity</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="mb-1 text-sm font-medium text-red-600 dark:text-red-400">Critical</p>
              {pctBar(criticalCount, Math.max(totalFindings, 1), 'bg-red-500', false)}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-orange-600 dark:text-orange-400">High</p>
              {pctBar(warningCount, Math.max(totalFindings, 1), 'bg-orange-500', false)}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-amber-600 dark:text-amber-400">Medium</p>
              {pctBar(mediumCount, Math.max(totalFindings, 1), 'bg-amber-500', false)}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">Good</p>
              {pctBar(goodCount, Math.max(totalFindings, 1), 'bg-emerald-500', false)}
            </div>
          </div>
        </div>

        {/* categories grid */}
        {categoryIssues.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-5">
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Issues by Category</h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categoryIssues.map((ci) => (
                <div key={ci.category} className="rounded-lg border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <ci.icon className="h-4 w-4 text-muted-foreground" />
                      {ci.label}
                    </div>
                    <Badge variant="outline">{ci.issues}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  /* ── Full post-optimization view ── */
  return (
    <section className="flex flex-col gap-8" aria-label="Executive summary">
      {/* ===== HEADER ===== */}
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold">Executive Summary</h3>
            <p className="text-sm text-muted-foreground">{originalUrl}</p>
          </div>
          <Badge className="inline-flex shrink-0 items-center gap-1 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200">
            Optimized <Check className="h-3.5 w-3.5" />
          </Badge>
        </div>
        {statusMessage && <p className="text-sm font-medium text-muted-foreground">{statusMessage}</p>}
      </div>

      {/* ===== SCORE CARDS (before → after) ===== */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Overall */}
        <ScoreCard
          title="Overall"
          definition="overall"
          before={initialScore}
          after={afterOverall}
          delta={overallDelta}
          size="lg"
        />
        {/* SEO */}
        {initialSeoScore != null && afterSeo != null && (
          <ScoreCard
            title="SEO"
            definition="seo"
            before={initialSeoScore}
            after={afterSeo}
            delta={seoDelta ?? 0}
            size="md"
          />
        )}
        {/* GEO/AEO */}
        {initialGeoScore != null && afterGeo != null && (
          <ScoreCard
            title="GEO/AEO"
            definition="geo"
            before={initialGeoScore}
            after={afterGeo}
            delta={geoDelta ?? 0}
            size="md"
          />
        )}
      </div>


      {/* ===== STRATEGIC IMPACT ===== */}
      <StrategicImpactList impacts={strategicImpacts} />

      {/* ===== KEY PERFORMANCE INDICATORS ===== */}
      <OptimizationKpiPanel
        findings={findings}
        optimization={optimization}
        geoScoreBefore={initialGeoScore}
        geoScoreAfter={afterGeo ?? geoScore?.total_score ?? null}
      />

      {/* ===== ROI PROJECTION (full interactive panel) ===== */}
      {hasOptimization && optimization && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <h4 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground"><DollarSign className="h-4 w-4" /> ROI Projection</h4>
          <RoiProjectionPanel optimization={optimization} />
        </div>
      )}

      {/* ===== IMPACT OVERVIEW ===== */}
      <ImpactOverview
        changesApplied={changesApplied}
        criticalBefore={criticalCount}
        warningBefore={warningCount}
        mediumBefore={mediumCount}
        totalFindings={totalFindings}
        categoryIssues={categoryIssues}
        onNavigateDetail={onNavigateDetail}
      />

      {/* ===== IMPLEMENTATION CHECKLIST ===== */}
      <ImplementationChecklist
        checklist={implementationChecklist}
        onNavigateDetail={(cat) => onNavigateDetail?.(cat)}
      />

      {/* ===== TOP RECOMMENDATIONS (best practices) ===== */}
      {topRecommendations.length > 0 && (
        <TopRecommendations
          items={topRecommendations}
          changesApplied={changesApplied}
        />
      )}

      {/* ===== FOOTER: next action ===== */}
      <div className="rounded-xl border border-border bg-card p-4 text-center">
        <p className="text-sm font-medium">
          Recommendation: Prioritize implementing pending changes and monitor organic traffic impact over 30 days.
        </p>
      </div>
    </section>
  );
}