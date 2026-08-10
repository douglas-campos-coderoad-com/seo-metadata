# Contract: Live Status Events (`RunStatusEvent`)

The event shape delivered through `AnalysisService.subscribeToRun` (see `analysis-service.md`). This is the "socket update" contract referenced in the spec — in this phase emitted by an in-browser `EventTarget`; in a future real backend it would be the payload of a WebSocket/SSE message. UI code must not assume anything about the transport, only this shape.

```ts
type RunStatusEvent =
  | { type: 'status'; runId: string; status: 'queued' | 'fetching' | 'analyzing'; at: string /* ISO datetime */ }
  | { type: 'complete'; runId: string; status: 'complete'; at: string; score: number; findingIds: string[] }
  | { type: 'failed'; runId: string; status: 'failed'; at: string; failureReason: string }
  | { type: 'connection-lost'; runId: string; at: string };
```

## Rules

- Events for a given `runId` are delivered in the order the state machine progresses (`data-model.md` → AnalysisRun state transitions); no event type repeats after a terminal (`complete`/`failed`) event for that run.
- `connection-lost` is a UI-facing signal only (spec Acceptance Scenario: "the UI indicates it lost the live connection and offers a way to recover") — it does not itself change `AnalysisRun.status`. The mock implementation MUST be able to simulate this (e.g., for a designated test/demo URL) so the recovery UI is exercisable without waiting for a real, flaky network.
- Multiple targets' runs may be in flight and emitting concurrently; a subscriber for `runId: A` must never receive events for `runId: B` (FR-003 concurrency guarantee).
- Automation-triggered runs (`AnalysisRun.triggeredBy === 'automation'`) emit the identical event sequence as manual runs — no special-cased event types (FR-024: no distinction required for the user to understand history).
