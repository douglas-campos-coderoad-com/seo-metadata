import { Info } from 'lucide-react';
import { SCORE_DEFINITIONS, scoreTooltip, type ScoreKey } from '@/shared/lib/scoreDefinitions';

/**
 * The "what does this score mean?" affordance next to a score label. Focusable, so
 * the definition is reachable by keyboard and read out by screen readers rather
 * than being hover-only.
 */
export function ScoreInfo({ score, className = '' }: { score: ScoreKey; className?: string }) {
  return (
    <span
      tabIndex={0}
      role="note"
      title={scoreTooltip(score)}
      aria-label={scoreTooltip(score)}
      className={`inline-flex cursor-help text-muted-foreground/70 transition hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary ${className}`}
    >
      <Info className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

/** The same definition as visible copy, for the roomier report-style cards. */
export function ScoreDescription({ score, className = '' }: { score: ScoreKey; className?: string }) {
  return (
    <p className={`text-xs leading-snug text-muted-foreground ${className}`}>
      {SCORE_DEFINITIONS[score].description}
    </p>
  );
}
