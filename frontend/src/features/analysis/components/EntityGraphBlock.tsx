'use client';

import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { EntityGraph, type EntityGraphProps } from './EntityGraph';
import { CodeSnippetCard } from './CodeSnippetCard';

type ViewMode = 'visualizer' | 'code';

function ModeSwitch({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-full bg-muted p-0.5">
      {(['visualizer', 'code'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={cn(
            'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
            mode === option ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function EntityGraphBlock({ jsonld, showLabels, height, onStats }: EntityGraphProps) {
  const [mode, setMode] = useState<ViewMode>('visualizer');

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between p-4">
        <h4 className="text-sm font-semibold uppercase text-muted-foreground">Knowledge Graph</h4>
        <ModeSwitch mode={mode} onChange={setMode} />
      </div>
      {mode === 'visualizer' ? (
        <EntityGraph jsonld={jsonld} showLabels={showLabels} height={height} onStats={onStats} />
      ) : (
        <div className="p-4 pt-0">
          <CodeSnippetCard code={JSON.stringify(jsonld, null, 2)} />
        </div>
      )}
    </div>
  );
}
