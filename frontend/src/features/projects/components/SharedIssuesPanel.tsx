import { SeverityBadge } from '@/shared/components/SeverityBadge';
import { CATEGORY_ICONS } from '@/shared/lib/categoryIcons';
import type { FindingCategory, SharedIssue } from '@/shared/types';

// Mirrors report_mappings.py's CATEGORY_LABELS (and FindingsList.tsx's copy of it).
const CATEGORY_LABELS: Record<FindingCategory, string> = {
  metadata: 'Metadata',
  content: 'Content',
  headings: 'Headings',
  structured_data: 'Structured data',
  geo_aeo: 'Generative and answer engines',
  images: 'Images',
  social: 'Social sharing',
  crawlability: 'Crawlability',
  performance: 'Performance',
};

export function SharedIssuesPanel({ sharedIssues }: { sharedIssues: SharedIssue[] }) {
  if (sharedIssues.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No shared issues detected yet — issues appearing on 2+ URLs in this project will show up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sharedIssues.map((issue) => {
        const CategoryIcon = CATEGORY_ICONS[issue.category];
        return (
          <div
            key={issue.signature}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
          >
            <div>
              <p className="font-semibold">{issue.title}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CategoryIcon className="h-3 w-3" />
                {CATEGORY_LABELS[issue.category]} · found on {issue.affectedTargetIds.length} pages
              </p>
            </div>
            <SeverityBadge severity={issue.severity} />
          </div>
        );
      })}
    </div>
  );
}
