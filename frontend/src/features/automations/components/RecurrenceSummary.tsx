import type { Automation } from '@/shared/types';

interface RecurrenceSummaryProps {
  automation: Automation;
  targetLabel?: string;
}

export function RecurrenceSummary({ automation, targetLabel }: RecurrenceSummaryProps) {
  return (
    <div>
      {targetLabel && <p className="text-xs font-medium text-muted-foreground">{targetLabel}</p>}
      <p className="font-semibold">{automation.recurrenceLabel}</p>
      <p className="font-mono text-xs tabular-nums text-muted-foreground">
        {automation.active ? 'Active' : 'Paused'} · Next run {new Date(automation.nextRunAt).toLocaleString()}
        {automation.lastRunId && ' · Last run recorded in history'}
      </p>
    </div>
  );
}
