'use client';

import { useState, type FormEvent } from 'react';
import { useAppStore } from '@/shared/store/useAppStore';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { scoreToSeverity } from '@/shared/lib/severity';
import type { AnalysisTarget } from '@/shared/types';

interface ProjectUrlListProps {
  targets: AnalysisTarget[];
  onAddUrl: (url: string) => void;
  onRemoveTarget: (targetId: string) => void;
  onAnalyzeTarget: (target: AnalysisTarget) => void;
}

function TargetStatus({ target }: { target: AnalysisTarget }) {
  const run = useAppStore((state) => (target.latestRunId ? state.runs[target.latestRunId] : undefined));

  if (!run) return <Badge variant="outline">Not analyzed yet</Badge>;
  if (run.status === 'complete' && run.score !== null) {
    return <SeverityBadge severity={scoreToSeverity(run.score)} />;
  }
  if (run.status === 'failed') {
    return <Badge variant="destructive">Failed</Badge>;
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <Spinner className="h-3 w-3" />
      {run.status}
    </Badge>
  );
}

export function ProjectUrlList({ targets, onAddUrl, onRemoveTarget, onAnalyzeTarget }: ProjectUrlListProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!url.trim()) return;
    onAddUrl(url.trim());
    setUrl('');
  };

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="text"
          inputMode="url"
          placeholder="https://example.com/page"
          className="flex-1"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Button type="submit" variant="secondary">
          Add URL
        </Button>
      </form>

      {targets.length === 0 ? (
        <p className="text-sm text-muted-foreground">No URLs yet — add one above to start analyzing this project.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {targets.map((target) => (
            <li
              key={target.id}
              className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <span className="truncate text-sm">{target.displayUrl}</span>
              <div className="flex items-center gap-2">
                <TargetStatus target={target} />
                <Button type="button" size="sm" onClick={() => onAnalyzeTarget(target)}>
                  Analyze
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => onRemoveTarget(target.id)}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
