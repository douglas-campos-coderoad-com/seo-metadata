'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { mockAnalysisService } from '@/shared/realtime/MockAnalysisService';
import type { Recurrence } from '@/shared/types';

/** Pass a targetId to scope to one URL's automations, or omit for every automation system-wide. */
export function useAutomations(targetId?: string) {
  const automations = useAppStore((state) => {
    const all = Object.values(state.automations);
    if (!targetId) return all;
    return all.filter((automation) => automation.targetId === targetId);
  });

  const createAutomation = (recurrence: Recurrence) => mockAnalysisService.createAutomation({ targetId: targetId!, recurrence });
  const setActive = (automationId: string, active: boolean) => mockAnalysisService.setAutomationActive(automationId, active);
  const remove = (automationId: string) => mockAnalysisService.deleteAutomation(automationId);
  const triggerNow = (automationId: string) => mockAnalysisService.triggerAutomationNow(automationId);

  return { automations, createAutomation, setActive, remove, triggerNow };
}
