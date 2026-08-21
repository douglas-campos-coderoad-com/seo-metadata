'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { apiClient } from '@/lib/api-client';

interface LiveResult {
  response: string;
  cited: boolean;
  quote: string | null;
  reason: string;
  query: string;
}

interface AeoTestResponse {
  query: string;
  has_optimization: boolean;
  before: LiveResult;
  after: LiveResult;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function ChatWindow({ messages, label, cited }: { messages: ChatMessage[]; label: string; cited?: boolean }) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <span className="text-sm font-semibold">{label}</span>
        {cited !== undefined && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${cited ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {cited ? <><Check className="h-3 w-3" /> Cited</> : 'Not cited'}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3 p-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              msg.role === 'user'
                ? 'self-end bg-primary text-primary-foreground'
                : 'self-start bg-muted text-foreground'
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>
    </div>
  );
}

export function AeoLiveTest({ analysisId }: { analysisId: number }) {
  const [query, setQuery] = useState('Recommend a premium dining chair for my living room.');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AeoTestResponse | null>(null);

  const runTest = async () => {
    setRunning(true);
    setError(null);
    try {
      const data = await apiClient.post<AeoTestResponse>(`/geo/aeo-test/${analysisId}`, { query });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AEO test failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="aeo-query" className="mb-1 block text-sm font-medium text-muted-foreground">
            Ask an AI assistant
          </label>
          <input
            id="aeo-query"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What would you ask a chatbot?"
          />
        </div>
        <Button onClick={runTest} disabled={running || !query.trim()}>
          {running ? <><Spinner /> Testing...</> : 'Run AEO Live Test'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {result && (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChatWindow
            label="Before (Original content)"
            cited={result.before.cited}
            messages={[
              { role: 'user', content: result.query },
              { role: 'assistant', content: result.before.response },
            ]}
          />
          <ChatWindow
            label="After (Optimized content)"
            cited={result.after.cited}
            messages={[
              { role: 'user', content: result.query },
              { role: 'assistant', content: result.after.response },
            ]}
          />
        </div>
      )}

      {result?.after.quote && (
        <blockquote className="rounded-lg border-l-4 border-primary bg-muted/40 p-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Source quote:</span> “{result.after.quote}”
        </blockquote>
      )}
    </div>
  );
}