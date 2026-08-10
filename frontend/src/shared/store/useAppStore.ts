import { create } from 'zustand';
import { normalizeUrl } from '@/shared/lib/url';
import type { AnalysisRun, AnalysisTarget, Automation, Finding, Project } from '@/shared/types';

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
  projects: Record<string, Project>;
  automations: Record<string, Automation>;

  upsertTargetByUrl: (url: string) => AnalysisTarget;
  addRun: (run: AnalysisRun) => void;
  updateRun: (runId: string, patch: Partial<AnalysisRun>) => void;
  addFindings: (findings: Finding[]) => void;

  createProject: (name: string) => Project;
  addTargetToProject: (projectId: string, targetId: string) => void;
  removeTargetFromProject: (projectId: string, targetId: string) => void;

  upsertAutomation: (automation: Automation) => void;
  setAutomationActive: (automationId: string, active: boolean) => void;
  deleteAutomation: (automationId: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  targets: {},
  targetIdByUrl: {},
  runs: {},
  findings: {},
  projects: {},
  automations: {},

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
      projectIds: [],
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

  createProject: (name) => {
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date().toISOString(),
      targetIds: [],
    };
    set((state) => ({ projects: { ...state.projects, [project.id]: project } }));
    return project;
  },

  addTargetToProject: (projectId, targetId) => {
    set((state) => {
      const project = state.projects[projectId];
      const target = state.targets[targetId];
      if (!project || !target) return state;
      if (project.targetIds.includes(targetId)) return state;
      return {
        projects: { ...state.projects, [projectId]: { ...project, targetIds: [...project.targetIds, targetId] } },
        targets: { ...state.targets, [targetId]: { ...target, projectIds: [...target.projectIds, projectId] } },
      };
    });
  },

  removeTargetFromProject: (projectId, targetId) => {
    set((state) => {
      const project = state.projects[projectId];
      const target = state.targets[targetId];
      if (!project || !target) return state;
      return {
        projects: {
          ...state.projects,
          [projectId]: { ...project, targetIds: project.targetIds.filter((id) => id !== targetId) },
        },
        targets: {
          ...state.targets,
          [targetId]: { ...target, projectIds: target.projectIds.filter((id) => id !== projectId) },
        },
      };
    });
  },

  upsertAutomation: (automation) => {
    set((state) => ({ automations: { ...state.automations, [automation.id]: automation } }));
  },

  setAutomationActive: (automationId, active) => {
    set((state) => {
      const automation = state.automations[automationId];
      if (!automation) return state;
      return { automations: { ...state.automations, [automationId]: { ...automation, active } } };
    });
  },

  deleteAutomation: (automationId) => {
    set((state) => {
      const next = { ...state.automations };
      delete next[automationId];
      return { automations: next };
    });
  },
}));
