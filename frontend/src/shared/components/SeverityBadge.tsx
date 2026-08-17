import { Badge } from '@/shared/components/ui/badge';
import { severityLabel, SEVERITY_CLASSES } from '@/shared/lib/severity';
import type { FindingSeverity } from '@/shared/types';

export function SeverityBadge({ severity }: { severity: FindingSeverity }) {
  return <Badge 
    variant={SEVERITY_CLASSES[severity].badge} 
    className="text-white"
  >
    {severityLabel(severity)}
  </Badge>;
}
