# Contract: AnalysisService

The backend-agnostic interface required by FR-005. `MockAnalysisService` (this phase) and any future real-backend-backed implementation both satisfy this same contract — UI code depends only on this interface, never on the mock directly.

```ts
interface AnalysisService {
  /**
   * Start analysis for a URL. Reuses the existing AnalysisTarget if the
   * (normalized) URL is already known (global identity — see data-model.md).
   * Resolves immediately with the created run id; the run's progress is
   * delivered asynchronously via subscribeToRun.
   */
  startAnalysis(input: {
    url: string;
    projectId?: string; // omit for a standalone run (FR-017)
  }): Promise<{ targetId: string; runId: string }>;

  /**
   * Subscribe to live status events for one run (FR-003). Returns an
   * unsubscribe function. Must support multiple concurrent subscriptions
   * to different runIds without cross-talk (FR-003 concurrency).
   */
  subscribeToRun(runId: string, onEvent: (event: RunStatusEvent) => void): () => void;

  /** One-shot read of current run state (e.g., on page load/deep link). */
  getRun(runId: string): AnalysisRun | undefined;

  /** All runs for a target, chronological — backs the history timeline (FR-019). */
  listRuns(targetId: string): AnalysisRun[];

  // --- Projects ---
  createProject(input: { name: string }): Project;
  addTargetToProject(projectId: string, url: string): { targetId: string };
  removeTargetFromProject(projectId: string, targetId: string): void;
  listSharedIssues(projectId: string): SharedIssue[]; // FR-016, computed per data-model.md

  // --- Automations (belong to a target/URL only — see spec.md Clarifications; a
  //     target may hold multiple independent automations) ---
  createAutomation(input: { targetId: string; recurrence: Recurrence }): Automation;
  setAutomationActive(automationId: string, active: boolean): void; // pause/resume (FR-023)
  deleteAutomation(automationId: string): void;
}
```

See `data-model.md` for `AnalysisRun`, `Project`, `SharedIssue`, `Automation`, `Recurrence` field shapes, and `realtime-events.md` for `RunStatusEvent`.

## Failure behavior (contract, not implementation)

- `startAnalysis` rejects synchronously only for client-side-invalid input (malformed URL, FR-002); reachability/content-type failures surface as a `failed` run via `subscribeToRun`/`getRun`, never as a thrown promise rejection after the run is created — so the UI always has a run id to show status against (FR-004, FR-012, SC-007).
- Every `failed` run MUST set a specific `failureReason` (not a generic string) distinguishing at minimum: invalid input, unreachable, unsupported content type (spec FR-005/SC-007).

## Mock vs. future real implementation

| Aspect | `MockAnalysisService` (this phase) | Future real implementation |
|---|---|---|
| Data source | In-memory store (`shared/store`), seeded/derived from `features/*/mocks` fixtures | Real backend (e.g., `specs/002-url-ingestion/` scrape + a future analysis endpoint) |
| Status delivery | `EventTarget`-based emitter, `setTimeout`-driven transitions | WebSocket/SSE from the real backend |
| Persistence | None — session-scoped (resets on reload) | Real database |

Swapping implementations requires no change to any component or hook that consumes `AnalysisService` — only the composition point that constructs the service instance changes.
