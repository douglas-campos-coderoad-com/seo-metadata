import { Badge } from '@/shared/components/ui/badge';
import { severityLabel, SEVERITY_CLASSES } from '@/shared/lib/severity';
import type { FindingSeverity } from '@/shared/types';

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  // Data from the analysis API can carry a severity outside the union; fall back
  // rather than crashing the whole results tree on an unknown value.
  const classes = SEVERITY_CLASSES[severity] ?? SEVERITY_CLASSES.warning;
  return <Badge variant={classes.badge}>{severityLabel(severity) ?? severity}</Badge>;
}
