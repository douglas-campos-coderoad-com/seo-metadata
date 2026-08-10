import { Card, CardContent, CardTitle } from '@/shared/components/ui/card';
import { SeverityBadge } from '@/shared/components/SeverityBadge';
import type { Finding } from '@/shared/types';
import { CodeSnippetCard } from './CodeSnippetCard';

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{finding.title}</CardTitle>
          <SeverityBadge severity={finding.severity} />
        </div>
        <p className="text-sm text-foreground/80">{finding.description}</p>
        {finding.isMissing && <p className="text-xs italic text-muted-foreground">Not found on the page.</p>}
        {finding.metricValue !== null && (
          <p className="font-mono text-xs tabular-nums text-muted-foreground">Measured: {finding.metricValue}</p>
        )}
        <p className="text-sm">{finding.suggestion}</p>
        {finding.codeSnippet && <CodeSnippetCard code={finding.codeSnippet} />}
      </CardContent>
    </Card>
  );
}
