'use client';

import { useAppStore } from '@/shared/store/useAppStore';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';
import type { Recurrence } from '@/shared/types';

/** Pass a targetId to scope to one URL's automations, or omit for every automation system-wide. */
export function useAutomations(targetId?: string) {
  const automations = useAppStore((state) => {
    const all = Object.values(state.automations);
    if (!targetId) return all;
    return all.filter((automation) => automation.targetId === targetId);
  });

  const createAutomation = (recurrence: Recurrence) => analysisApiService.createAutomation({ targetId: targetId!, recurrence });
  const setActive = (automationId: string, active: boolean) => analysisApiService.setAutomationActive(automationId, active);
  const remove = (automationId: string) => analysisApiService.deleteAutomation(automationId);
  const triggerNow = (automationId: string) => analysisApiService.triggerAutomationNow(automationId);

  return { automations, createAutomation, setActive, remove, triggerNow };
}
