import { ScoreRadial } from '@/shared/components/ScoreRadial';
import { ScoreInfo } from '@/shared/components/ScoreInfo';
import { scoreToSeverity, severityLabel } from '@/shared/lib/severity';
import type { ScoreKey } from '@/shared/lib/scoreDefinitions';

function SubScore({ label, score, definition }: { label: string; score: number; definition: ScoreKey }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <ScoreRadial score={score} size="sm" />
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {label}
        <ScoreInfo score={definition} />
      </p>
    </div>
  );
}

export interface ScoreSummaryScores {
  overall: number;
  seo?: number | null;
  geo?: number | null;
}

export function ScoreSummary({ scores }: { scores: ScoreSummaryScores }) {
  const { overall, seo = null, geo = null } = scores;
  const severity = scoreToSeverity(overall);
  const hasBreakdown = seo !== null && geo !== null;

  return (
    <div className="flex items-center justify-center gap-6">
      <div className="flex items-center gap-4">
        <ScoreRadial score={overall} size="lg" />
        <div>
          <p className="text-lg font-semibold">{severityLabel(severity)}</p>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            Overall Score
            <ScoreInfo score="overall" />
          </p>
        </div>
      </div>
      {hasBreakdown && (
        <div className="flex gap-4">
          <SubScore label="SEO" score={seo} definition="seo" />
          <SubScore label="GEO" score={geo} definition="geo" />
        </div>
      )}
    </div>
  );
}
