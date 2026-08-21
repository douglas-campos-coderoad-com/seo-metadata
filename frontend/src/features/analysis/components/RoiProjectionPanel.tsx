'use client';

import { useMemo, useState } from 'react';
import { Badge } from '@/shared/components/ui/badge';
import { cn } from '@/shared/lib/cn';
import type { OptimizationData } from '../hooks/useOptimize';
import type { BusinessMetricsInput } from '../lib/roi';
import {
  calculateFullRoi,
  formatCount,
  formatCurrency,
  formatRoiPercent,
  monthsToRecover,
} from '../lib/roi';

interface RoiProjectionPanelProps {
  optimization: OptimizationData | null;
}

type MetricKey = keyof BusinessMetricsInput;

interface MetricField {
  key: MetricKey;
  label: string;
  suffix: string;
  step: string;
  hint: string;
}

const METRIC_FIELDS: MetricField[] = [
  {
    key: 'monthly_organic_traffic',
    label: 'Monthly organic traffic',
    suffix: 'visits',
    step: '1000',
    hint: 'Total organic visits per month',
  },
  {
    key: 'generative_search_share',
    label: 'AI search share',
    suffix: '%',
    step: '0.05',
    hint: 'Share coming from ChatGPT, Perplexity, Gemini…',
  },
  {
    key: 'conversion_rate',
    label: 'Conversion rate',
    suffix: '%',
    step: '0.005',
    hint: 'Visitors that become customers',
  },
  {
    key: 'avg_order_value',
    label: 'Average order value',
    suffix: '$',
    step: '10',
    hint: 'Revenue per converted visit',
  },
  {
    key: 'cost_per_product',
    label: 'Optimization cost',
    suffix: '$',
    step: '0.25',
    hint: 'Per-page cost to apply the optimization',
  },
  {
    key: 'manual_minutes_saved_per_listing',
    label: 'Manual minutes saved per listing',
    suffix: 'min',
    step: '5',
    hint: 'Avg. manual time saved per listing (realistic: 15)',
  },
  {
    key: 'listings_per_month',
    label: 'Listings per month',
    suffix: 'listings',
    step: '50',
    hint: 'Listings processed per month (realistic: 200)',
  },
  {
    key: 'labor_cost_per_hour',
    label: 'Labor cost per hour',
    suffix: '$/h',
    step: '5',
    hint: 'Fully-loaded labor cost (realistic: $25)',
  },
  {
    key: 'annual_visora_cost',
    label: 'Annual Visora cost',
    suffix: '$/yr',
    step: '100',
    hint: 'Annual subscription (realistic: $2,400)',
  },
];

function NumberField({
  label,
  suffix,
  value,
  step,
  hint,
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  step: string;
  hint: string;
  onChange: (raw: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="mt-1 flex items-center overflow-hidden rounded-md border border-input bg-background focus-within:border-ring focus-within:ring-2 focus-within:ring-ring">
        <input
          type="number"
          inputMode="decimal"
          value={value}
          step={step}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent px-3 py-1.5 font-mono text-sm tabular-nums outline-none"
        />
        <span className="shrink-0 pr-3 text-xs text-muted-foreground">
          {suffix}
        </span>
      </div>
      <span className="mt-1 block text-[11px] text-muted-foreground/70">
        {hint}
      </span>
    </label>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'success' | 'destructive' | 'muted';
}) {
  const tones: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-success',
    destructive: 'text-destructive',
    muted: 'text-muted-foreground',
  };
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          'mt-1 font-mono font-bold tabular-nums',
          tones[tone],
        )}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{sub}</p>
      )}
    </div>
  );
}

function TrafficSplitBar({ seo, ai }: { seo: number; ai: number }) {
  const total = seo + ai;
  if (total <= 0) return null;
  const seoPct = (seo / total) * 100;
  return (
    <div>
      <div
        className="flex h-2 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Traffic mix: ${formatCount(seo)} from traditional SEO, ${formatCount(ai)} from AI search`}
      >
        <div className="bg-primary" style={{ width: `${seoPct}%` }} />
        <div className="bg-teal-500" style={{ width: `${100 - seoPct}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Traditional SEO — {formatCount(seo)}/mo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-teal-500" />
          AI / GEO — {formatCount(ai)}/mo
        </span>
      </div>
    </div>
  );
}

export function RoiProjectionPanel({ optimization }: RoiProjectionPanelProps) {
  const serverProjection = optimization?.roi_projection;
  const hasScores = Boolean(
    optimization?.score_before != null && optimization?.score_after_estimated != null,
  );
  const [metrics, setMetrics] = useState<Record<MetricKey, string>>(() => {
    const base = serverProjection?.metrics_used as unknown as BusinessMetricsInput | undefined;
    return {
      monthly_organic_traffic: base
        ? String(base.monthly_organic_traffic)
        : '10000',
      generative_search_share: base
        ? String(base.generative_search_share)
        : '0.2',
      conversion_rate: base ? String(base.conversion_rate) : '0.015',
      avg_order_value: base ? String(base.avg_order_value) : '150',
      cost_per_product: base ? String(base.cost_per_product) : '1',
      manual_minutes_saved_per_listing: base?.manual_minutes_saved_per_listing != null ? String(base.manual_minutes_saved_per_listing) : '15',
      listings_per_month: base?.listings_per_month != null ? String(base.listings_per_month) : '200',
      labor_cost_per_hour: base?.labor_cost_per_hour != null ? String(base.labor_cost_per_hour) : '25',
      annual_visora_cost: base?.annual_visora_cost != null ? String(base.annual_visora_cost) : '2400',
    };
  });

  const scores = {
    currentSeo: optimization?.score_before?.seo ?? 0,
    improvedSeo: optimization?.score_after_estimated?.seo ?? 0,
    currentGeo: optimization?.score_before?.geo ?? 0,
    improvedGeo: optimization?.score_after_estimated?.geo ?? 0,
  };

  const projection = useMemo(() => {
    const parsed = Object.fromEntries(
      Object.entries(metrics).map(([key, raw]) => {
        const value = parseFloat(raw);
        return [key, Number.isFinite(value) ? value : 0];
      }),
    ) as unknown as BusinessMetricsInput;
    return calculateFullRoi(
      scores.currentSeo,
      scores.improvedSeo,
      scores.currentGeo,
      scores.improvedGeo,
      parsed,
    );
  }, [
    metrics,
    scores.currentSeo,
    scores.improvedSeo,
    scores.currentGeo,
    scores.improvedGeo,
  ]);

  // Always render when we have score data — if no server projection exists,
  // the interactive section still lets users enter their own business metrics
  // and see projected results based on the score lift.
  if (!hasScores) return null;

  const projectionToUse = serverProjection ?? projection;
  const { financial_impact_annual: f, incremental_traffic_monthly: t, productivity_impact_annual: p } =
    projection;
  const paybackMonths = monthsToRecover(
    f.incremental_revenue,
    f.optimization_cost,
  );
  const positiveRoi = f.roi_percentage >= 0;
  const prodPositive = p.productivity_roi_percentage >= 0;

  const paybackText =
    paybackMonths === null
      ? 'Under these assumptions the optimization has not paid for itself yet.'
      : paybackMonths <= 1
        ? 'The optimization pays for itself within the first month.'
        : `The optimization pays for itself in about ${Math.ceil(paybackMonths)} months.`;

  const recoverLine = `Assumes a ${projection.metrics_used.conversion_rate * 100}% conversion rate on a ${formatCurrency(projection.metrics_used.avg_order_value)} average order.`;

  const handleMetricChange = (key: MetricKey, raw: string) =>
    setMetrics((prev) => ({ ...prev, [key]: raw }));

  const resetMetrics = () => {
    // If server projection exists use its values, otherwise reset to realistic defaults
    if (serverProjection?.metrics_used) {
      const base = serverProjection.metrics_used as unknown as BusinessMetricsInput;
      setMetrics({
        monthly_organic_traffic: String(base.monthly_organic_traffic),
        generative_search_share: String(base.generative_search_share),
        conversion_rate: String(base.conversion_rate),
        avg_order_value: String(base.avg_order_value),
        cost_per_product: String(base.cost_per_product),
        manual_minutes_saved_per_listing: base.manual_minutes_saved_per_listing != null ? String(base.manual_minutes_saved_per_listing) : '15',
        listings_per_month: base.listings_per_month != null ? String(base.listings_per_month) : '200',
        labor_cost_per_hour: base.labor_cost_per_hour != null ? String(base.labor_cost_per_hour) : '25',
        annual_visora_cost: base.annual_visora_cost != null ? String(base.annual_visora_cost) : '2400',
      });
    } else {
      setMetrics({
        monthly_organic_traffic: '10000',
        generative_search_share: '0.2',
        conversion_rate: '0.015',
        avg_order_value: '150',
        cost_per_product: '1',
        manual_minutes_saved_per_listing: '15',
        listings_per_month: '200',
        labor_cost_per_hour: '25',
        annual_visora_cost: '2400',
      });
    }
  };

  return (
    <div className="space-y-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold">ROI Projection</h3>
          <p className="text-sm text-muted-foreground">
            What this optimization is worth to your business
          </p>
        </div>
        <Badge className="whitespace-nowrap" variant={positiveRoi ? 'success' : 'warning'}>
          {positiveRoi ? 'Positive ROI' : 'Below break-even'}
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="min-w-[10rem] text-center sm:text-left">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Projected annual ROI
          </p>
          <p
            className={cn(
              'font-mono text-4xl font-bold tabular-nums',
              positiveRoi ? 'text-success' : 'text-destructive',
            )}
          >
            {formatRoiPercent(f.roi_percentage)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/20 p-4">
          <p className="text-sm font-medium">{paybackText}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {recoverLine}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Incremental monthly traffic
        </h4>
        <TrafficSplitBar seo={t.seo_traditional} ai={t.geo_ai} />
        <div className="grid grid-cols-3 gap-3">
          <Stat
            label="Traditional SEO"
            value={`+${formatCount(t.seo_traditional)}`}
            sub="visits / month"
          />
          <Stat
            label="AI / GEO"
            value={`+${formatCount(t.geo_ai)}`}
            sub="visits / month"
          />
          <Stat
            label="Total"
            value={`+${formatCount(t.total)}`}
            sub="visits / month"
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Annual financial impact
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            label="Incremental revenue"
            value={formatCurrency(f.incremental_revenue, true)}
            sub={`${formatCurrency(f.incremental_revenue)}/yr`}
            tone="success"
          />
          <Stat
            label="Optimization cost"
            value={formatCurrency(f.optimization_cost, true)}
            sub="one-time"
            tone="muted"
          />
          <Stat
            label="Net profit"
            value={formatCurrency(f.net_profit, true)}
            sub={`${formatCurrency(f.net_profit)}/yr`}
            tone={f.net_profit >= 0 ? 'success' : 'destructive'}
          />
          <Stat
            label="ROI"
            value={formatRoiPercent(f.roi_percentage)}
            sub="per year"
            tone={positiveRoi ? 'success' : 'destructive'}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Productivity Value
        </h4>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Annual Productivity Value" value={formatCurrency(p.annual_productivity_value, true)} sub={`${formatCurrency(p.annual_productivity_value)}/yr`} tone="success" />
          <Stat label="Annual Visora Cost" value={formatCurrency(p.annual_visora_cost, true)} sub="per year" tone="muted" />
          <Stat label="Annual Quantified Benefit" value={formatCurrency(p.annual_quantified_benefit, true)} sub={`${formatCurrency(p.annual_quantified_benefit)}/yr`} tone={p.annual_quantified_benefit >= p.annual_visora_cost ? 'success' : 'destructive'} />
          <Stat label="Productivity ROI" value={formatRoiPercent(p.productivity_roi_percentage)} sub="per year" tone={prodPositive ? 'success' : 'destructive'} />
        </div>
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3">
          <p className="font-mono text-xs">
            ({projection.metrics_used.manual_minutes_saved_per_listing ?? 15} min ÷ 60) × {projection.metrics_used.listings_per_month ?? 200} × {formatCurrency(projection.metrics_used.labor_cost_per_hour ?? 25)}/h × 12 = {formatCurrency(p.annual_productivity_value)}/yr
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatCurrency(p.annual_productivity_value)} + {formatCurrency(f.incremental_revenue)} = {formatCurrency(p.annual_quantified_benefit)}; ROI = ({formatCurrency(p.annual_quantified_benefit)} − {formatCurrency(p.annual_visora_cost)}) ÷ {formatCurrency(p.annual_visora_cost)} × 100 = {formatRoiPercent(p.productivity_roi_percentage)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground/70">Productivity-only ROI: {formatRoiPercent(p.productivity_only_roi_percentage)} — defaults 15 min, 200 listings, $25/h, $2,400/yr. Adjust below.</p>
        </div>
      </div>

      <details className="group rounded-xl border border-border bg-muted/10 p-4">
        <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-medium text-muted-foreground [&::-webkit-details-marker]:hidden">
          <span>Adjust business assumptions</span>
          <span className="text-xs text-muted-foreground/70 group-open:hidden">
            Tune to your real numbers
          </span>
          {!serverProjection && (
            <span className="hidden text-xs text-muted-foreground/70 group-open:inline">
              Default assumptions — adjust to see projections
            </span>
          )}
          {serverProjection && (
            <span className="hidden text-xs text-muted-foreground/70 group-open:inline">
              Based on the defaults the optimizer used
            </span>
          )}
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {METRIC_FIELDS.map((field) => (
            <NumberField
              key={field.key}
              label={field.label}
              suffix={field.suffix}
              value={metrics[field.key]}
              step={field.step}
              hint={field.hint}
              onChange={(raw) => handleMetricChange(field.key, raw)}
            />
          ))}
          <div className="flex items-end">
            <button
              type="button"
              onClick={resetMetrics}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Reset to defaults
            </button>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground/70">
          Estimates based on the score lift from {scores.currentSeo} →{' '}
          {scores.improvedSeo} (SEO) and {scores.currentGeo} →{' '}
          {scores.improvedGeo} (GEO/AI). Figures update instantly — adjust them
          to your business.
        </p>
      </details>
    </div>
  );
}
