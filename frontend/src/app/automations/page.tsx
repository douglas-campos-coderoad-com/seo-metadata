'use client';

import { useAutomations } from '@/features/automations/hooks/useAutomations';
import { AutomationList } from '@/features/automations/components/AutomationList';
import { useAppStore } from '@/shared/store/useAppStore';
import type { Automation } from '@/shared/types';

export default function AutomationsPage() {
  const { automations, setActive, remove, triggerNow } = useAutomations();
  const targets = useAppStore((state) => state.targets);

  const targetLabel = (automation: Automation) => targets[automation.targetId]?.displayUrl ?? 'Unknown URL';

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">Automations</h1>
        <p className="text-muted-foreground">Recurring analysis schedules across all your URLs.</p>
      </div>

      <AutomationList
        automations={automations}
        getTargetLabel={targetLabel}
        onToggleActive={(automation) => setActive(automation.id, !automation.active)}
        onDelete={remove}
        onTriggerNow={triggerNow}
      />
    </div>
  );
}
