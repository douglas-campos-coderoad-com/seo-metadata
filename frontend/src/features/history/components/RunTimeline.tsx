import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { Badge } from '@/shared/components/ui/badge';
import { scoreToSeverity } from '@/shared/lib/severity';
import { cn } from '@/shared/lib/cn';
import type { AnalysisRun } from '@/shared/types';

interface RunTimelineProps {
  runs: AnalysisRun[];
  selectedRunId: string | null;
  onSelectRun: (runId: string) => void;
}

export function RunTimeline({ runs, selectedRunId, onSelectRun }: RunTimelineProps) {
  if (runs.length === 0) {
    return <p className="text-sm text-muted-foreground">No analysis runs yet for this URL.</p>;
  }

  return (
    <ul className="flex flex-col gap-4 border-l border-border pl-4">
      {runs.map((run) => (
        <li key={run.id} className="relative">
          <span
            className={cn(
              'absolute -left-[21px] top-1 h-3 w-3 rounded-full',
              run.id === selectedRunId ? 'bg-primary' : 'bg-muted',
            )}
          />
          <button type="button" className="flex flex-col items-start gap-1 text-left" onClick={() => onSelectRun(run.id)}>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">
              {new Date(run.startedAt).toLocaleString()}
            </span>
            <span className="flex items-center gap-2">
              {run.status === 'complete' && run.score !== null && <SeverityBadge severity={scoreToSeverity(run.score)} />}
              {run.status === 'failed' && <Badge variant="destructive">Failed</Badge>}
              {run.status !== 'complete' && run.status !== 'failed' && <Badge variant="secondary">{run.status}</Badge>}
              {run.status === 'complete' && run.score !== null && (
                <span className="font-mono font-semibold tabular-nums">{run.score}</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
