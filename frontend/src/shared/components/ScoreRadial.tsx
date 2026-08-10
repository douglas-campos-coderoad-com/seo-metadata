import { scoreToSeverity, SEVERITY_CLASSES } from '@/shared/lib/severity';
import { cn } from '@/shared/lib/cn';

export function ScoreRadial({ score, size = 'lg' }: { score: number; size?: 'sm' | 'lg' }) {
  const severity = scoreToSeverity(score);
  const dimension = size === 'lg' ? 128 : 64;
  const strokeWidth = size === 'lg' ? 10 : 6;
  const radius = (dimension - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: dimension, height: dimension }}
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={dimension} height={dimension} className="-rotate-90">
        <circle cx={dimension / 2} cy={dimension / 2} r={radius} strokeWidth={strokeWidth} className="fill-none stroke-muted" />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('fill-none transition-all duration-500', SEVERITY_CLASSES[severity].stroke)}
        />
      </svg>
      <span className={cn('absolute font-mono font-bold tabular-nums', size === 'lg' ? 'text-2xl' : 'text-sm')}>
        {score}
      </span>
    </div>
  );
}
