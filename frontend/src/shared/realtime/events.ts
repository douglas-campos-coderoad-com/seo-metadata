// The live-status "socket update" contract. In this phase emitted by an in-browser
// EventTarget (see MockAnalysisService); in a future real backend this would be the
// payload of a WebSocket/SSE message. UI code must depend only on this shape, never
// on the transport. See specs/003-seo-analyzer-frontend/contracts/realtime-events.md.

export type RunStatusEvent =
  | { type: 'status'; runId: string; status: 'queued' | 'fetching' | 'analyzing'; at: string }
  | { type: 'complete'; runId: string; status: 'complete'; at: string; score: number; findingIds: string[] }
  | { type: 'failed'; runId: string; status: 'failed'; at: string; failureReason: string }
  | { type: 'connection-lost'; runId: string; at: string };
