'use client';

import { useState } from 'react';
import { Button } from '@/shared/components/ui/button';

export function CodeSnippetCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-secondary p-4 font-mono text-xs text-secondary-foreground">
        <code className="whitespace-pre-wrap">{code}</code>
      </pre>
      <Button type="button" size="sm" variant="outline" onClick={handleCopy} className="absolute right-2 top-2 bg-background">
        {copied ? 'Copied!' : 'Copy'}
      </Button>
    </div>
  );
}
