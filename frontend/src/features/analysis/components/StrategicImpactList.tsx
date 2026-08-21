'use client';

import { Target, TrendingUp } from 'lucide-react';
import { Badge } from '@/shared/components/ui/badge';
import type { StrategicImpact } from '@/shared/types';

/** Competitors are stored by URL; strip the scheme so they read as brand names. */
export function competitorLabel(name: string): string {
  return name.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/+$/, '');
}

interface StrategicImpactListProps {
  impacts: StrategicImpact[];
  /** `full` is the executive-summary block; `compact` drops the detail lines so it
   * can sit inside a history card without burying the scores above it. */
  variant?: 'full' | 'compact';
}

/**
 * The business case for applying an optimization: 3–5 outcomes from the optimizer,
 * with the project's own competitors named on the entries about positioning.
 */
export function StrategicImpactList({ impacts, variant = 'full' }: StrategicImpactListProps) {
  if (impacts.length === 0) return null;

  const compact = variant === 'compact';

  return (
    <div className={compact ? '' : 'rounded-2xl border border-border bg-card p-5'}>
      <h4
        className={`flex items-center gap-1.5 font-semibold uppercase tracking-wide text-muted-foreground ${
          compact ? 'mb-2 text-[11px]' : 'mb-1 text-sm'
        }`}
      >
        <Target className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} /> Strategic Impact
      </h4>
      {!compact && (
        <p className="mb-4 text-sm text-muted-foreground">If done well, this optimization could:</p>
      )}

      <ul className={`flex flex-col ${compact ? 'gap-1.5' : 'gap-3'}`}>
        {impacts.map((item, index) => (
          <li key={`${index}-${item.impact}`} className="flex gap-2">
            <TrendingUp
              className={`shrink-0 text-success ${compact ? 'mt-0.5 h-3 w-3' : 'mt-0.5 h-4 w-4'}`}
              aria-hidden="true"
            />
            <div className="flex flex-col gap-1">
              <p className={`font-medium text-foreground ${compact ? 'text-xs leading-snug' : 'text-sm'}`}>
                {item.impact}
              </p>
              {!compact && item.detail && (
                <p className="text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
              )}
              {item.competitors.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    vs
                  </span>
                  {item.competitors.map((competitor) => (
                    <Badge key={competitor} variant="secondary" className="px-2 py-0 text-[10px]">
                      {competitorLabel(competitor)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
