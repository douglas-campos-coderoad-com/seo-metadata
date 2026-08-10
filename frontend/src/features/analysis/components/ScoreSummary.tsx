import { ScoreRadial } from '@/shared/components/ScoreRadial';
import { scoreToSeverity, severityLabel } from '@/shared/lib/severity';

export function ScoreSummary({ score }: { score: number }) {
  const severity = scoreToSeverity(score);

  return (
    <div className="flex items-center justify-center gap-4">
      <ScoreRadial score={score} />
      <div>
        <p className="text-lg font-semibold">{severityLabel(severity)}</p>
        <p className="text-sm text-muted-foreground">Overall SEO score</p>
      </div>
    </div>
  );
}
