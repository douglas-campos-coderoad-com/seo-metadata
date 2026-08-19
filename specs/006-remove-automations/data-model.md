# Phase 1 Data Model: Remove Automations Feature

This feature removes model surface; it adds none. Documented here for traceability against the spec's Key Entities section.

## Removed entities

### `Automation` (type, `frontend/src/shared/types/index.ts`)

Previously:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | |
| `targetId` | `string` | FK to `AnalysisTarget` |
| `recurrence` | `Recurrence` | |
| `recurrenceLabel` | `string` | human-readable rendering |
| `active` | `boolean` | |
| `lastRunId` | `string \| null` | FK to `AnalysisRun` |
| `nextRunAt` | `string` (ISO datetime) | computed, never actually scheduled by a job runner |

**Disposition**: Delete the type. No replacement.

### `Recurrence` / `RecurrenceFrequency` (types)

Previously: `{ frequency: 'daily' | 'weekly' | 'monthly'; time: string; weekday?: number; dayOfMonth?: number }`.

**Disposition**: Delete both types along with `frontend/src/features/automations/lib/recurrence.ts` (`formatRecurrence`, `computeNextRunAt`), which existed only to serve `Automation`.

### `useAppStore` slice: `automations: Record<string, Automation>`

**Disposition**: Remove the field and its three actions (`upsertAutomation`, `setAutomationActive`, `deleteAutomation`) from `AppState`.

## Modified entity

### `AnalysisRun.triggeredBy` (field) / `RunTrigger` (type)

Previously: `triggeredBy: RunTrigger` where `RunTrigger = 'manual' | 'automation'`.

**Disposition**: Remove the field from `AnalysisRun` and delete `RunTrigger`. See [research.md §3](research.md) for rationale — the field is never displayed and, post-removal, can only ever hold `'manual'`.

**Resulting shape** (relevant excerpt):

```ts
export interface AnalysisRun {
  id: string;
  targetId: string;
  status: RunStatus;
  startedAt: string;
  completedAt: string | null;
  score: number | null;
  seoScore: number | null;
  geoScore: number | null;
  failureReason: string | null;
  findingIds: string[];
  httpStatus: number | null;
  contentType: string | null;
  contentSizeBytes: number | null;
  backendAnalysisId?: number;
  backendOptimizationId?: number;
}
```

(`triggeredBy` line removed; every other field is untouched.)

## Unaffected entities

`AnalysisTarget`, `Project`, `Finding`, `FindingRecommendation`, `SharedIssue` are untouched — none reference `Automation`/`Recurrence`, so no changes ripple into them.
