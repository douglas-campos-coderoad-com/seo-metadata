import type { Finding, FindingCategory } from '@/shared/types';
import { SEVERITY_RANK } from '@/shared/lib/severity';
import { CATEGORY_ICONS } from '@/shared/lib/categoryIcons';
import { FindingCard } from './FindingCard';

// Mirrors report_mappings.py's CATEGORY_LABELS and CATEGORY_ORDER.
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

const CATEGORY_ORDER: FindingCategory[] = [
  'metadata',
  'content',
  'headings',
  'structured_data',
  'geo_aeo',
  'images',
  'social',
  'crawlability',
  'performance',
];

export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-muted-foreground">No findings recorded for this run.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      {CATEGORY_ORDER.map((category) => {
        const categoryFindings = findings
          .filter((finding) => finding.category === category)
          .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
        if (categoryFindings.length === 0) return null;

        const CategoryIcon = CATEGORY_ICONS[category];

        return (
          <section key={category}>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <CategoryIcon className="h-4 w-4" />
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="flex flex-col gap-3">
              {categoryFindings.map((finding) => (
                <FindingCard
                  key={finding.id}
                  finding={finding}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
