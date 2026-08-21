'use client';

/**
 * Before and after side by side: a radial meter for the overall score in each
 * column, with SEO and GEO printed beneath it, and the after column carrying the
 * signed delta so the improvement is stated and not just implied.
 *
 * A meter is the right form for one value against a fixed limit (0–100). The fill
 * carries severity and the unfilled track is a lighter step of that same hue, so
 * state reads around the whole ring. Colours are the app's own success/warning/
 * destructive tokens; each ring shows exactly one of them, so they are never
 * adjacent and hue never has to separate one series from another. The score is
 * always printed in ink at the centre, which is what keeps the sub-3:1 amber fill
 * legible — the value is never carried by colour alone.
 */

const METER_TONES = {
  good: { fill: '#358d6d', track: '#b5e3d2' },
  fair: { fill: '#d6931f', track: '#f2d6a6' },
  poor: { fill: '#c43131', track: '#f3cece' },
} as const;

/** The same thresholds the competitor tiles score on: >=70 good, >=40 fair. */
function meterTone(value: number) {
  if (value >= 70) return METER_TONES.good;
  if (value >= 40) return METER_TONES.fair;
  return METER_TONES.poor;
}

export interface ScoreSet {
  overall: number | null;
  seo: number | null;
  geo: number | null;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, value));
}

function formatDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

function deltaClass(delta: number): string {
  if (delta > 0) return 'text-success';
  if (delta < 0) return 'text-destructive';
  return 'text-muted-foreground';
}

function RadialMeter({ value, label }: { value: number | null; label: string }) {
  const size = 84;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const tone = value === null ? null : meterTone(value);
  const fraction = value === null ? 0 : clampScore(value) / 100;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={value === null ? `${label} score not available` : `${label} score ${value} out of 100`}
      className="text-foreground"
    >
      {/* Unfilled remainder — a lighter step of the fill's own hue, neutral when
          there is no score to tone it by. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={stroke}
        style={{ stroke: tone ? tone.track : 'hsl(var(--border))' }}
      />

      {tone && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ stroke: tone.fill }}
        />
      )}

      {/* Ink, never the ring's colour — and proportional figures, since this is a
          single large number rather than a column of them. */}
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        fill="currentColor"
        fontSize="24"
        fontWeight="600"
      >
        {value ?? '—'}
      </text>
    </svg>
  );
}

/** SEO and GEO as linear meters — the same severity fill and same-hue track as the
 * ring above, so the two sub-scores carry magnitude at a glance instead of being
 * read digit by digit. The number stays beside the bar, so nothing is colour-only. */
function MetricRow({ label, value, delta }: { label: string; value: number | null; delta: number | null }) {
  const tone = value === null ? null : meterTone(value);

  return (
    <div className="flex items-center gap-2">
      <span className="w-7 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>

      <div
        className="h-1.5 min-w-6 flex-1 overflow-hidden rounded-full"
        style={{ backgroundColor: tone ? tone.track : 'hsl(var(--border))' }}
        aria-hidden="true"
      >
        {tone && value !== null && (
          <div
            className="h-full rounded-full"
            style={{ width: `${clampScore(value)}%`, backgroundColor: tone.fill }}
          />
        )}
      </div>

      <span className="w-7 shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">
        {value ?? '—'}
      </span>
      {delta !== null && (
        <span className={`w-7 shrink-0 text-right text-xs font-medium tabular-nums ${deltaClass(delta)}`}>
          {formatDelta(delta)}
        </span>
      )}
    </div>
  );
}

function ScoreColumn({
  title,
  scores,
  reference,
}: {
  title: string;
  scores: ScoreSet;
  /** When given, each metric shows its change against this set. */
  reference?: ScoreSet;
}) {
  const delta = (key: keyof ScoreSet): number | null => {
    const current = scores[key];
    const previous = reference?.[key];
    if (current === null || previous === null || previous === undefined) return null;
    return current - previous;
  };

  const overallDelta = delta('overall');

  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-border p-3">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
        {overallDelta !== null && (
          <span className={`text-[10px] font-semibold tabular-nums ${deltaClass(overallDelta)}`}>
            {formatDelta(overallDelta)}
          </span>
        )}
      </div>

      <RadialMeter value={scores.overall} label={`${title} overall`} />

      <div className="flex w-full max-w-[13rem] flex-col gap-1.5">
        <MetricRow label="SEO" value={scores.seo} delta={delta('seo')} />
        <MetricRow label="GEO" value={scores.geo} delta={delta('geo')} />
      </div>
    </div>
  );
}

export function BeforeAfterScoreChart({ before, after }: { before: ScoreSet; after: ScoreSet }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <ScoreColumn title="Before" scores={before} />
      <ScoreColumn title="After" scores={after} reference={before} />
    </div>
  );
}
