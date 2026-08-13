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

// Demo product URLs to showcase the agnostic URL input panel.
const DEMO_URLS = [
  {
    label: 'InCollect',
    description: 'InCollect art listing',
    url: 'https://www.incollect.com/listings/fine-art/paintings/sax-berlin-banksy-on-the-grave-yard-shift-fixing-the-acetate-873915',
  },
  {
    label: '1stDibs',
    description: '1stDibs furniture listing',
    url: 'https://www.1stdibs.com/furniture/seating/armchairs/',
  },
  {
    label: 'Shopify Store',
    description: 'Shopify product demo',
    url: 'https://furniture-demo-store.myshopify.com/products/',
  },
];

export function UrlSubmitForm({ onStarted, projectId }: UrlSubmitFormProps) {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const { start, isSubmitting, error } = useStartAnalysis();

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>, presetUrl?: string) => {
    event?.preventDefault();
    const targetUrl = presetUrl ?? url;
    if (!isValidUrl(targetUrl)) {
      setValidationError('Enter a valid URL starting with http:// or https://');
      return;
    }
    setValidationError(null);
    setUrl(targetUrl);
    const result = await start({ url: targetUrl, projectId });
    if (result) {
      onStarted(result);
    }
  };

  const message = validationError ?? error;

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => handleSubmit(e)} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Input
            type="text"
            inputMode="url"
            placeholder="Paste any e-commerce product URL (InCollect, 1stDibs, Shopify...)"
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

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">Or try a demo product:</p>
        <div className="flex flex-wrap gap-2">
          {DEMO_URLS.map((demo) => (
            <Button
              key={demo.label}
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => handleSubmit(undefined, demo.url)}
              title={demo.url}
            >
              {isSubmitting ? <Spinner /> : demo.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}