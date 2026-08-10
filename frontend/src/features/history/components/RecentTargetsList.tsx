'use client';

import Link from 'next/link';
import { TargetStatusBadge } from '@/shared/components/TargetStatusBadge';
import { useRecentTargets } from '../hooks/useRecentTargets';

export function RecentTargetsList({ limit = 5 }: { limit?: number }) {
  const targets = useRecentTargets(limit);

  if (targets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-muted-foreground">Previously analyzed</h2>
      <ul className="flex flex-col gap-2">
        {targets.map((target) => (
          <li key={target.id}>
            <Link
              href={`/targets/${target.id}/history`}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card p-3 hover:border-primary"
            >
              <span className="truncate text-sm">{target.displayUrl}</span>
              <TargetStatusBadge target={target} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
