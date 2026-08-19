'use client';

import { useState } from 'react';
import type { CopyPasteReady } from '../hooks/useOptimize';

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for insecure contexts / older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-md border border-input bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}

function SnippetBlock({
  title,
  description,
  code,
}: {
  title: string;
  description: string;
  code: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">{title}</h4>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <CopyButton text={code} label="Copy" />
      </div>
      <pre className="max-h-56 overflow-auto rounded-lg bg-muted/40 p-3 text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function CopyPasteReadyPanel({ copyPasteReady }: { copyPasteReady: CopyPasteReady | null }) {
  if (!copyPasteReady) return null;

  const blocks = [
    {
      key: 'head_tags_html',
      title: 'Head Tags (HTML)',
      description: 'Copy and paste inside the <head>',
      code: copyPasteReady.head_tags_html,
    },
    {
      key: 'json_ld_script',
      title: 'JSON-LD Script',
      description: 'Schema.org structured data with @graph',
      code: copyPasteReady.json_ld_script,
    },
    {
      key: 'body_snippet_html',
      title: 'Body Snippet',
      description: 'Copy and paste in the <body> where it belongs',
      code: copyPasteReady.body_snippet_html,
    },
  ].filter((block) => typeof block.code === 'string' && block.code.length > 0);

  if (blocks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h3 className="mb-1 text-lg font-bold">Copy-Paste Ready Snippets</h3>
      <p className="mb-4 text-sm text-muted-foreground">
        Drop these into your page to apply the SEO/GEO optimization instantly.
      </p>
      <div className="space-y-4">
        {blocks.map((block) => (
          <SnippetBlock
            key={block.key}
            title={block.title}
            description={block.description}
            code={block.code}
          />
        ))}
      </div>
    </div>
  );
}