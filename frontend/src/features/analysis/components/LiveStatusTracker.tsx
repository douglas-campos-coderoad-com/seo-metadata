'use client';

import { useEffect } from 'react';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { useRunStatus } from '../hooks/useRunStatus';

const STEP_ORDER = ['queued', 'fetching', 'analyzing', 'complete'] as const;

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  fetching: 'Fetching & cleaning page',
  analyzing: 'Analyzing SEO & GEO',
  complete: 'Complete',
};

const STEP_DETAILS: Record<string, string> = {
  queued: 'Initializing analysis pipeline...',
  fetching: 'Extracting content and stripping non-semantic DOM tags...',
  analyzing: 'Auditing technical SEO rules in Python and evaluating GEO citability with AI...',
  complete: 'Report compiled successfully.',
};

interface LiveStatusTrackerProps {
  runId: string;
  onComplete?: (runId: string) => void;
}

export function LiveStatusTracker({ runId, onComplete }: LiveStatusTrackerProps) {
  const { status, failureReason, connectionLost, refresh } = useRunStatus(runId);

  useEffect(() => {
    if (status === 'complete') {
      onComplete?.(runId);
    }
  }, [status, runId, onComplete]);

  if (connectionLost) {
    return (
      <Alert variant="warning" className="flex items-center justify-between gap-3">
        <span>Lost connection to analysis stream.</span>
        <Button type="button" size="sm" onClick={refresh}>
          Check status
        </Button>
      </Alert>
    );
  }

  if (status === 'failed') {
    return <Alert variant="destructive">{failureReason ?? 'Analysis failed.'}</Alert>;
  }

  const currentStepIndex = STEP_ORDER.indexOf(status as (typeof STEP_ORDER)[number]);
  const activeStep = status in STATUS_LABEL ? status : 'analyzing';

  return (
    <div className="flex w-full flex-col gap-3">
      <ol className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:gap-0">
        {STEP_ORDER.map((step, index) => {
          const isActive = index <= currentStepIndex;
          const isCurrent = step === status;
          return (
            <li key={step} className="flex flex-1 items-center gap-2">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                  isCurrent && 'ring-2 ring-primary/40'
                )}
              >
                {index + 1}
              </span>
              <span className={cn('text-sm', isActive ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {STATUS_LABEL[step]}
              </span>
              {index < STEP_ORDER.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" />}
            </li>
          );
        })}
      </ol>

      {status !== 'complete' && (
        <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground mr-1.5">{STATUS_LABEL[activeStep]}:</span>
          {STEP_DETAILS[activeStep]}
        </div>
      )}
    </div>
  );
}
