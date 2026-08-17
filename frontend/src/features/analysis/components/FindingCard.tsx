import { Card, CardContent, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import type { Finding } from '@/shared/types';
import { CodeSnippetCard } from './CodeSnippetCard';

export function FindingCard({
  finding
 }: { finding: Finding }) {
  const recommendationLabel = finding.severity === 'good' 
    ? 'Why this works' 
    : 'Recommendation';

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">
            {finding.title}
          </CardTitle>
          <SeverityBadge severity={finding.severity} />
        </div>
        <p className="text-sm">
          {finding.description}
        </p>
        {finding.metricValue !== null && (
          <Badge variant="outline" className="w-fit font-mono text-xs font-normal tabular-nums text-muted-foreground">
            {finding.metricValue}
          </Badge>
        )}
        {finding.recommendations.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold">
              {recommendationLabel}
              {finding.recommendations.length > 1 ? 's' : ''}:
            </div>
            {finding.recommendations.map((rec) => (
              <div key={rec.id} className="flex flex-col gap-1">
                <p className="text-sm">{rec.action}</p>
                {rec.codeSnippet && <CodeSnippetCard code={rec.codeSnippet} />}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
