'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useTargetHistory } from '@/features/history/hooks/useTargetHistory';
import { RunTimeline } from '@/features/history/components/RunTimeline';
import { RunSnapshotView } from '@/features/history/components/RunSnapshotView';
import { useAutomations } from '@/features/automations/hooks/useAutomations';
import { ScheduleForm } from '@/features/automations/components/ScheduleForm';
import { AutomationList } from '@/features/automations/components/AutomationList';
import { Button } from '@/shared/components/ui/button';
import type { Recurrence } from '@/shared/types';

export default function TargetHistoryPage() {
  const { targetId } = useParams<{ targetId: string }>();
  const { target, runs } = useTargetHistory(targetId);
  const { automations, createAutomation, setActive, remove, triggerNow } = useAutomations(targetId);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  if (!target) {
    return <p className="text-muted-foreground">This URL could not be found in the current session.</p>;
  }

  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? runs[runs.length - 1] ?? null;

  const handleCreateAutomation = (recurrence: Recurrence) => {
    createAutomation(recurrence);
    setShowAddForm(false);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold">History</h1>
        <p className="break-all text-muted-foreground">{target.displayUrl}</p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
        <RunTimeline runs={runs} selectedRunId={selectedRun?.id ?? null} onSelectRun={setSelectedRunId} />
        {selectedRun ? (
          <RunSnapshotView run={selectedRun} />
        ) : (
          <p className="text-sm text-muted-foreground">Select a run to view its results.</p>
        )}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Automations</h2>
          {!showAddForm && (
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              Add automation
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <AutomationList
            automations={automations}
            onToggleActive={(automation) => setActive(automation.id, !automation.active)}
            onDelete={remove}
            onTriggerNow={triggerNow}
          />
          {showAddForm && <ScheduleForm onSubmit={handleCreateAutomation} />}
        </div>
      </section>
    </div>
  );
}
