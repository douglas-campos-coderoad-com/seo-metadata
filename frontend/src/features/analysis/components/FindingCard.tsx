import { Card, CardContent, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import type { Finding } from '@/shared/types';
import { CodeSnippetCard } from './CodeSnippetCard';

export function FindingCard({
  finding
 }: { finding: Finding }) {
  const suggestionLabel = finding.severity === 'good' ? 'Why this works' : 'Suggestion';

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {finding.title}
          </CardTitle>
          <SeverityBadge severity={finding.severity} />
        </div>
        <p className="text-sm text-foreground/80">
          {finding.description}
        </p>
        {finding.metricValue !== null && (
          <Badge variant="outline" className="w-fit font-mono text-xs font-normal tabular-nums text-muted-foreground">
            {finding.metricValue}
          </Badge>
        )}
        <div className="text-sm font-medium">
          {suggestionLabel}:
        </div>
        <p className="text-sm">
          {finding.suggestion}
        </p>
        {finding.codeSnippet && <CodeSnippetCard code={finding.codeSnippet} />}
      </CardContent>
    </Card>
  );
}
