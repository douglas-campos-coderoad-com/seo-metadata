'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { CompetitorInput } from '@/shared/realtime/AnalysisService';
import type { ProjectCategory } from '@/shared/types';

interface SmartSearchContext {
  description: string;
  category: ProjectCategory;
  country: string;
  region?: string | null;
}

interface CompetitorListEditorProps {
  competitors: CompetitorInput[];
  onChange: (competitors: CompetitorInput[]) => void;
  /** Current form values Smart Search infers suggestions from (US5, FR-007). */
  smartSearchContext: SmartSearchContext;
}

/** Dynamic, repeatable {url, description} list (FR-006) — both fields required per entry.
 * Smart Search proposes entries into this same editable list; nothing is ever
 * auto-saved (FR-007) — the user still reviews/edits/removes before saving the form. */
export function CompetitorListEditor({ competitors, onChange, smartSearchContext }: CompetitorListEditorProps) {
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);

  const handleAdd = () => {
    const trimmedUrl = url.trim();
    const trimmedDescription = description.trim();
    if (!trimmedUrl || !trimmedDescription) return;
    onChange([...competitors, { url: trimmedUrl, description: trimmedDescription }]);
    setUrl('');
    setDescription('');
  };

  const handleRemove = (index: number) => {
    onChange(competitors.filter((_, i) => i !== index));
  };

  const handleSmartSearch = async () => {
    const { description: desc, category, country } = smartSearchContext;
    if (!desc.trim() || !category || !country.trim()) {
      setSearchMessage('Fill in the site description, category, and country first, then try Smart Search again.');
      return;
    }

    setIsSearching(true);
    setSearchMessage(null);
    try {
      const suggestions = await analysisApiService.smartSearchCompetitors(smartSearchContext);
      if (suggestions.length === 0) {
        setSearchMessage('Smart Search could not find any confident suggestions for this project.');
      } else {
        onChange([...competitors, ...suggestions]);
      }
    } catch (err) {
      setSearchMessage(err instanceof Error ? err.message : 'Smart Search failed. Try again.');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">Competitors (optional)</span>
        <Button type="button" size="sm" variant="outline" onClick={handleSmartSearch} disabled={isSearching}>
          <Sparkles className="h-3.5 w-3.5" />
          {isSearching ? 'Searching…' : 'Smart Search'}
        </Button>
      </div>

      {searchMessage && <p className="text-xs text-muted-foreground">{searchMessage}</p>}

      {competitors.length > 0 && (
        <ul className="flex flex-col gap-2">
          {competitors.map((competitor, index) => (
            <li
              key={`${competitor.url}-${index}`}
              className="flex items-start justify-between gap-2 rounded-lg border border-border p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{competitor.url}</p>
                <p className="text-xs text-muted-foreground">{competitor.description}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => handleRemove(index)}>
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          placeholder="https://competitor.com"
          className="flex-1"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
        />
        <Input
          type="text"
          placeholder="Why they're a competitor"
          className="flex-1"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Button type="button" variant="secondary" onClick={handleAdd}>
          Add competitor
        </Button>
      </div>
    </div>
  );
}
