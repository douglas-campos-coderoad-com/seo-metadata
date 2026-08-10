'use client';

import { useState, type FormEvent } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { TargetStatusBadge } from '@/shared/components/TargetStatusBadge';
import type { AnalysisTarget } from '@/shared/types';

interface ProjectUrlListProps {
  targets: AnalysisTarget[];
  onAddUrl: (url: string) => void;
  onRemoveTarget: (targetId: string) => void;
  onAnalyzeTarget: (target: AnalysisTarget) => void;
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
              <div className="flex gap-2">
                <TargetStatusBadge target={target} />
                <span className="truncate text-sm">{target.displayUrl}</span>
              </div>
              <div className="flex items-center gap-2">
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
