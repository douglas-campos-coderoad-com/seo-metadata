import { SeverityBadge } from '@/shared/components/SeverityBadge';
import type { FindingCategory, SharedIssue } from '@/shared/types';

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  'meta-tags': 'Meta Tags',
  content: 'Content',
  'html-structure': 'HTML Structure',
  'file-size': 'File Size',
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
      {sharedIssues.map((issue) => (
        <div
          key={issue.signature}
          className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div>
            <p className="font-semibold">{issue.title}</p>
            <p className="text-xs text-muted-foreground">
              {CATEGORY_LABELS[issue.category]} · found on {issue.affectedTargetIds.length} pages
            </p>
          </div>
          <SeverityBadge severity={issue.severity} />
        </div>
      ))}
    </div>
  );
}
