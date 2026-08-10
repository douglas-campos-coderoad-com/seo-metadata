'use client';

import { useState, type FormEvent } from 'react';
import { isValidUrl } from '@/shared/lib/url';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Spinner } from '@/shared/components/Spinner';
import { cn } from '@/shared/lib/cn';
import { useStartAnalysis } from '../hooks/useStartAnalysis';

interface UrlSubmitFormProps {
  onStarted: (result: { targetId: string; runId: string }) => void;
  projectId?: string;
}

export function UrlSubmitForm({ onStarted, projectId }: UrlSubmitFormProps) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { start, isSubmitting, error } = useStartAnalysis();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidUrl(url)) {
      setValidationError('Enter a valid URL starting with http:// or https://');
      return;
    }
    setValidationError(null);
    const result = await start({ url, projectId });
    if (result) {
      onStarted(result);
    }
  };

  const message = validationError ?? error;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex-1">
        <Input
          type="text"
          inputMode="url"
          placeholder="https://example.com/page"
          className={cn(message && 'border-destructive focus-visible:ring-destructive')}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          aria-invalid={Boolean(message)}
          aria-describedby="url-submit-error"
        />
        {message && (
          <p id="url-submit-error" className="mt-1 text-sm text-destructive">
            {message}
          </p>
        )}
      </div>
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? <Spinner /> : 'Analyze'}
      </Button>
    </form>
  );
}
