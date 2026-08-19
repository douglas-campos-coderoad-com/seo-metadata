import { create } from 'zustand';
import { normalizeUrl } from '@/shared/lib/url';
import type {
  AnalysisRun,
  AnalysisTarget,
  Finding
} from '@/shared/types';

// Session-scoped, in-memory store (Clarifications: no persistence — a full reload
// resets everything). This is the single authoritative place entity identity and
// relationships live: notably, upsertTargetByUrl is what guarantees the "global
// URL identity" rule (one URL = one AnalysisTarget with one shared history).

interface AppState {
  targets: Record<string, AnalysisTarget>;
  /** Reverse index: normalized URL -> target id, backing global identity lookups. */
  targetIdByUrl: Record<string, string>;
  runs: Record<string, AnalysisRun>;
  findings: Record<string, Finding>;

  upsertTargetByUrl: (url: string) => AnalysisTarget;
  addRun: (run: AnalysisRun) => void;
  updateRun: (runId: string, patch: Partial<AnalysisRun>) => void;
  addFindings: (findings: Finding[]) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  targets: {},
  targetIdByUrl: {},
  runs: {},
  findings: {},

  upsertTargetByUrl: (url) => {
    const normalized = normalizeUrl(url);
    const existingId = get().targetIdByUrl[normalized];
    if (existingId) {
      return get().targets[existingId];
    }

    const target: AnalysisTarget = {
      id: crypto.randomUUID(),
      url: normalized,
      displayUrl: url.trim(),
      createdAt: new Date().toISOString(),
      latestRunId: null,
      runIds: [],
    };

    set((state) => ({
      targets: { ...state.targets, [target.id]: target },
      targetIdByUrl: { ...state.targetIdByUrl, [normalized]: target.id },
    }));

    return target;
  },

  addRun: (run) => {
    set((state) => {
      const target = state.targets[run.targetId];
      if (!target) return state;
      return {
        runs: { ...state.runs, [run.id]: run },
        targets: {
          ...state.targets,
          [target.id]: { ...target, latestRunId: run.id, runIds: [...target.runIds, run.id] },
        },
      };
    });
  },

  updateRun: (runId, patch) => {
    set((state) => {
      const existing = state.runs[runId];
      if (!existing) return state;
      return { runs: { ...state.runs, [runId]: { ...existing, ...patch } } };
    });
  },

  addFindings: (findings) => {
    set((state) => {
      const next = { ...state.findings };
      for (const finding of findings) next[finding.id] = finding;
      return { findings: next };
    });
  },
}));
