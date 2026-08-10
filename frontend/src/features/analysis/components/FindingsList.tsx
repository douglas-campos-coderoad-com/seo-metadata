import type { Finding, FindingCategory } from '@/shared/types';
import { FindingCard } from './FindingCard';

const CATEGORY_LABELS: Record<FindingCategory, string> = {
  'meta-tags': 'Meta Tags',
  content: 'Content',
  'html-structure': 'HTML Structure',
  'file-size': 'File Size',
};

const CATEGORY_ORDER: FindingCategory[] = ['meta-tags', 'content', 'html-structure', 'file-size'];

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">No findings recorded for this run.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {CATEGORY_ORDER.map((category) => {
        const categoryFindings = findings.filter((finding) => finding.category === category);
        if (categoryFindings.length === 0) return null;

        return (
          <section key={category}>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="flex flex-col gap-3">
              {categoryFindings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
