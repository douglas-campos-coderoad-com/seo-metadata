'use client';

import { useEffect } from 'react';
import { Alert } from '@/shared/components/ui/alert';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/shared/lib/cn';
import { useRunStatus } from '../hooks/useRunStatus';

const STEP_ORDER = ['queued', 'fetching', 'analyzing', 'complete'] as const;

const STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  fetching: 'Fetching page',
  analyzing: 'Analyzing SEO',
  complete: 'Complete',
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
        <span>Lost the live connection for this analysis.</span>
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

  return (
    <ol className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:gap-0">
      {STEP_ORDER.map((step, index) => {
        const isActive = index <= currentStepIndex;
        return (
          <li key={step} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
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
  );
}
