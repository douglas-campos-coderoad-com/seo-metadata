# Contract Change: `AnalysisService` interface

`frontend/src/shared/realtime/AnalysisService.ts` is the internal contract that both `AnalysisApiService` (real backend) and `MockAnalysisService` (demo/test) implement. UI code depends only on this interface (never on a concrete implementation), so it is the one "external interface" this frontend-only feature exposes to its own consumers — its shrinkage is the contract change worth documenting.

## Before

```ts
export interface AnalysisService {
  startAnalysis(input: { url: string; projectId?: string }): Promise<{ targetId: string; runId: string }>;
  subscribeToRun(runId: string, onEvent: (event: RunStatusEvent) => void): () => void;
  getRun(runId: string): AnalysisRun | undefined;
  listRuns(targetId: string): AnalysisRun[];

  createProject(input: { name: string }): Project;
  addTargetToProject(projectId: string, url: string): { targetId: string };
  removeTargetFromProject(projectId: string, targetId: string): void;
  listSharedIssues(projectId: string): SharedIssue[];

  // --- Automations ---
  createAutomation(input: { targetId: string; recurrence: Recurrence }): Automation;
  setAutomationActive(automationId: string, active: boolean): void;
  deleteAutomation(automationId: string): void;
}
```

`MockAnalysisService` additionally exposes `triggerAutomationNow(automationId: string)` as a demo-only escape hatch, outside the formal interface.

## After

```ts
export interface AnalysisService {
  startAnalysis(input: { url: string; projectId?: string }): Promise<{ targetId: string; runId: string }>;
  subscribeToRun(runId: string, onEvent: (event: RunStatusEvent) => void): () => void;
  getRun(runId: string): AnalysisRun | undefined;
  listRuns(targetId: string): AnalysisRun[];

  createProject(input: { name: string }): Project;
  addTargetToProject(projectId: string, url: string): { targetId: string };
  removeTargetFromProject(projectId: string, targetId: string): void;
  listSharedIssues(projectId: string): SharedIssue[];
}
```

- `createAutomation`, `setAutomationActive`, `deleteAutomation` removed from the interface.
- Both implementations (`AnalysisApiService`, `MockAnalysisService`) drop their method bodies and the now-unused `Automation`/`Recurrence` imports.
- `MockAnalysisService.triggerAutomationNow` (never part of the formal interface) is deleted along with its private `createAndScheduleRun(..., triggeredBy)` parameter — that helper keeps `createAndScheduleRun(targetId, url)` with no trigger-source parameter (see [data-model.md](../data-model.md) for the corresponding `AnalysisRun.triggeredBy` removal).

## Consumers affected

- `frontend/src/features/automations/hooks/useAutomations.ts` — the only caller of the three removed methods. Deleted along with the rest of the `features/automations` module (spec User Story 3 / FR-004, FR-005).
- No other hook or component calls these methods (confirmed by repo search), so no other consumer code changes as a result of this interface shrinkage.
