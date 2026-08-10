'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UrlSubmitForm } from '@/features/analysis/components/UrlSubmitForm';
import { LiveStatusTracker } from '@/features/analysis/components/LiveStatusTracker';

export default function AnalyzePage() {
  const [runId, setRunId] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Analyze a URL</h1>
        <p className="text-muted-foreground">Enter a page URL to get an SEO score and actionable fixes.</p>
      </div>

      <UrlSubmitForm onStarted={({ runId: newRunId }) => setRunId(newRunId)} />

      {runId && (
        <div className="rounded-xl border border-border bg-card p-6">
          <LiveStatusTracker runId={runId} onComplete={(id) => router.push(`/runs/${id}`)} />
        </div>
      )}
    </div>
  );
}
