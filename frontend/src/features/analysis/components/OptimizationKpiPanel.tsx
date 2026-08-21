'use client';

import { useMemo } from 'react';
import { Bot, CheckCircle2, Gauge, Timer, type LucideIcon } from 'lucide-react';
import { scoreToSeverity } from '@/shared/lib/severity';
import type { Finding, FindingSeverity } from '@/shared/types';
import type { OptimizationData } from '../hooks/useOptimize';
import {
  aiRecommendationRate,
  attributeAccuracy,
  formatDuration,
  formatMinutes,
  formatPercent,
  issueResolutionRate,
  optimizationTime,
  pluralize,
} from '../lib/kpis';

interface OptimizationKpiPanelProps {
  findings: Finding[];
  optimization: OptimizationData | null;
  /** GEO citation scores that drive the recommendation rate. */
  geoScoreBefore: number | null;
  geoScoreAfter: number | null;
  /** `compact` fits the narrow After column: tighter cards, no formula lines. */
  variant?: 'full' | 'compact';
}

/** Meter fills come from the app's severity bands, never ad hoc colors (FR-007). */
const METER_FILL: Record<FindingSeverity, string> = {
  good: 'bg-success',
  warning: 'bg-warning',
  medium: 'bg-medium',
  critical: 'bg-destructive',
};

const clampPercent = (value: number) => Math.min(Math.max(value, 0), 100);

/* ─────────────── meters ─────────────── */

/** A rate as a filled track, with a tick marking where it stood before. */
function RateMeter({ percent, before }: { percent: number | null; before?: number | null }) {
  if (percent == null) return null;
  const after = clampPercent(percent);

  return (
    <div
      className="relative mt-3 h-1.5 w-full rounded-full bg-muted"
      role="img"
      aria-label={before != null ? `${after}% now, ${clampPercent(before)}% before` : `${after}%`}
    >
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${METER_FILL[scoreToSeverity(after)]}`}
        style={{ width: `${after}%` }}
      />
      {before != null && (
        <span
          className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/40"
          style={{ left: `${clampPercent(before)}%` }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

/** Manual effort against the optimizer's run, drawn to the same scale so the gap
 * is the point of the card. */
function TimeBars({ manualHours, visoraMinutes }: { manualHours: number; visoraMinutes: number | null }) {
  const manualMinutes = manualHours * 60;
  const scale = Math.max(manualMinutes, visoraMinutes ?? 0, 1);

  const rows: Array<{ label: string; value: string; minutes: number | null; fill: string }> = [
    { label: 'By hand', value: formatDuration(manualHours), minutes: manualMinutes, fill: 'bg-muted-foreground/40' },
    { label: 'Visora', value: formatMinutes(visoraMinutes), minutes: visoraMinutes, fill: 'bg-success' },
  ];

  return (
    <div className="mt-3 flex flex-col gap-1.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-[11px]">
          <span className="w-12 shrink-0 text-muted-foreground">{row.label}</span>
          <div className="h-1.5 flex-1 rounded-full bg-muted">
            {row.minutes != null && (
              // Floor at 1.5% so a run that is minutes against hours still reads as a bar.
              <div
                className={`h-full rounded-full ${row.fill}`}
                style={{ width: `${Math.max((row.minutes / scale) * 100, 1.5)}%` }}
              />
            )}
          </div>
          <span className="w-14 shrink-0 text-right font-medium tabular-nums">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────── card ─────────────── */

interface KpiCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  /** Where the KPI stood before optimizing, shown as "from X". */
  before?: string;
  delta?: string;
  /** "Estimated" and friends — how the number was arrived at. */
  note?: string;
  footnote: string;
  /** The KPI's definition: the card's tooltip, and printed in the full variant. */
  formula: string;
  compact: boolean;
  children?: React.ReactNode;
}

function KpiCard({
  icon: Icon,
  label,
  value,
  before,
  delta,
  note,
  footnote,
  formula,
  compact,
  children,
}: KpiCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-muted/20 p-4" title={formula}>
      <div className="mb-2 flex min-h-[2rem] items-start justify-between gap-2">
        <div className="flex items-start gap-1.5">
          <Icon className="mt-px h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">
            {label}
          </p>
        </div>
        {note && (
          <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {note}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-3xl font-bold leading-none tabular-nums">{value}</span>
        {before && <span className="text-xs text-muted-foreground">from {before}</span>}
        {delta && <span className="text-xs font-medium text-success">{delta}</span>}
      </div>

      {children}

      <p className="mt-auto pt-3 text-[11px] leading-snug text-muted-foreground">{footnote}</p>
      {!compact && (
        <p className="mt-1.5 border-t border-border/60 pt-1.5 text-[10px] leading-snug text-muted-foreground/70">
          {formula}
        </p>
      )}
    </div>
  );
}

/* ─────────────── panel ─────────────── */

/**
 * The four business KPIs for an optimization: AI Recommendation Rate, Attribute
 * Accuracy, Issue Resolution Rate, and Optimization Time. All four are derived
 * from the analysis findings and the stored optimization (see `lib/kpis.ts`), so
 * they render without any extra request. Each card carries its own formula and
 * says when a number is modeled rather than measured.
 */
export function OptimizationKpiPanel({
  findings,
  optimization,
  geoScoreBefore,
  geoScoreAfter,
  variant = 'full',
}: OptimizationKpiPanelProps) {
  const compact = variant === 'compact';

  const recommendation = useMemo(
    () => aiRecommendationRate(geoScoreBefore, geoScoreAfter, optimization),
    [geoScoreBefore, geoScoreAfter, optimization],
  );
  const attributes = useMemo(() => attributeAccuracy(optimization), [optimization]);
  const resolution = useMemo(() => issueResolutionRate(findings, optimization), [findings, optimization]);
  const time = useMemo(() => optimizationTime(findings, optimization), [findings, optimization]);

  if (!optimization) return null;

  const recommendationDelta =
    recommendation.percentBefore != null && recommendation.percentAfter != null
      ? recommendation.percentAfter - recommendation.percentBefore
      : null;

  const missing = attributes.checks.filter((check) => !check.correct);
  const missingSummary =
    missing.length > 0
      ? `Missing: ${missing
          .slice(0, 3)
          .map((check) => check.label)
          .join(', ')}${missing.length > 3 ? ` +${missing.length - 3} more` : ''}`
      : null;

  const resolutionFootnote = (() => {
    if (resolution.denominator === 0) return 'No auto-fixable issues were detected on this page.';
    const parts = [
      `${resolution.numerator} of ${resolution.denominator} auto-fixable ${
        resolution.denominator === 1 ? 'issue' : 'issues'
      } resolved`,
    ];
    if (resolution.pending > 0) parts.push(`${resolution.pending} still pending`);
    if (resolution.ineligible > 0) {
      parts.push(
        `${pluralize(resolution.ineligible, 'issue')} ${
          resolution.ineligible === 1 ? 'needs' : 'need'
        } infrastructure work`,
      );
    }
    return `${parts.join(' · ')}.`;
  })();

  return (
    <div className={compact ? '' : 'rounded-2xl border border-border bg-card p-5'}>
      <h4
        className={`mb-4 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground ${
          compact ? 'text-[11px]' : 'text-sm'
        }`}
      >
        <Gauge className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} aria-hidden="true" /> Key Performance Indicators
      </h4>

      <div className={`grid items-stretch gap-3 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
        {/* ── AI Recommendation Rate ── */}
        <KpiCard
          icon={Bot}
          label="AI Recommendation Rate"
          value={formatPercent(recommendation.percentAfter)}
          before={recommendation.percentBefore != null ? formatPercent(recommendation.percentBefore) : undefined}
          delta={
            recommendationDelta != null && recommendationDelta > 0 ? `+${recommendationDelta} pts` : undefined
          }
          note="Estimated"
          footnote={
            recommendation.hasQuerySet
              ? `${recommendation.recommendedAfter} of ${recommendation.queries} AEO test queries expected to recommend the product, up from ${recommendation.recommendedBefore}.`
              : 'No Q&A test set was generated, so this is the GEO citability score on its own.'
          }
          formula="Queries where the product is recommended ÷ total test queries × 100. Test queries are the optimizer's generated Q&A set; the recommended count is modeled from the GEO citation score."
          compact={compact}
        >
          <RateMeter percent={recommendation.percentAfter} before={recommendation.percentBefore} />
        </KpiCard>

        {/* ── Attribute Accuracy ── */}
        <KpiCard
          icon={CheckCircle2}
          label="Attribute Accuracy"
          value={formatPercent(attributes.percent)}
          note="Measured"
          footnote={
            attributes.hasStructuredData
              ? `${attributes.numerator} of ${attributes.denominator} attributes an answer engine needs are returned correctly.${
                  missingSummary ? ` ${missingSummary}.` : ''
                }`
              : 'The optimizer returned no structured data for this page, so none of the 10 product attributes are available to an answer engine.'
          }
          formula="Correct product attributes returned ÷ attributes evaluated × 100, checked against the optimized JSON-LD, title, and meta description."
          compact={compact}
        >
          <RateMeter percent={attributes.percent} />
        </KpiCard>

        {/* ── Issue Resolution Rate ── */}
        <KpiCard
          icon={Gauge}
          label="Issue Resolution Rate"
          value={formatPercent(resolution.percent)}
          footnote={resolutionFootnote}
          formula="Automatically resolved issues ÷ detected eligible issues × 100. Eligible issues are non-passing findings in categories the optimizer rewrites — crawlability and performance are excluded."
          compact={compact}
        >
          <RateMeter percent={resolution.percent} />
        </KpiCard>

        {/* ── Optimization Time ── */}
        <KpiCard
          icon={Timer}
          label="Optimization Time"
          value={time.visoraMinutes != null ? formatMinutes(time.visoraMinutes) : formatDuration(time.manualHours)}
          delta={time.speedupFactor != null ? `${time.speedupFactor}× faster` : undefined}
          note="Estimated baseline"
          footnote={
            time.issuesResolved === 0
              ? 'No resolved issues to compare against manual work.'
              : time.visoraMinutes == null
                ? `${formatDuration(time.manualHours)} of manual work across ${pluralize(
                    time.issuesResolved,
                    'resolved issue',
                  )}. This run's duration was not recorded.`
                : `${formatDuration(time.manualHours)} of manual work across ${pluralize(
                    time.issuesResolved,
                    'resolved issue',
                  )}${time.hoursSaved ? ` — ${formatDuration(time.hoursSaved)} saved` : ''}.`
          }
          formula="Time required before vs. after Visora: estimated manual effort (1 h critical, 30 min high, 15 min medium per resolved issue) against the optimizer's measured run duration."
          compact={compact}
        >
          {time.issuesResolved > 0 && (
            <TimeBars manualHours={time.manualHours} visoraMinutes={time.visoraMinutes} />
          )}
        </KpiCard>
      </div>
    </div>
  );
}
