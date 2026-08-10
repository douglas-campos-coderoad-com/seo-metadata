import { Button } from '@/shared/components/ui/button';
import { RecurrenceSummary } from './RecurrenceSummary';
import type { Automation } from '@/shared/types';

interface AutomationListProps {
  automations: Automation[];
  onToggleActive: (automation: Automation) => void;
  onDelete: (automationId: string) => void;
  onTriggerNow: (automationId: string) => void;
  getTargetLabel?: (automation: Automation) => string;
}

export function AutomationList({ automations, onToggleActive, onDelete, onTriggerNow, getTargetLabel }: AutomationListProps) {
  if (automations.length === 0) {
    return <p className="text-sm text-muted-foreground">No automations configured yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {automations.map((automation) => (
        <li
          key={automation.id}
          className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <RecurrenceSummary automation={automation} targetLabel={getTargetLabel?.(automation)} />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={() => onTriggerNow(automation.id)}>
              Run now
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => onToggleActive(automation)}>
              {automation.active ? 'Pause' : 'Resume'}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => onDelete(automation.id)}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
