import { describe, expect, it } from 'vitest';
import { computeSharedIssues } from '@/shared/lib/sharedIssues';
import type { AnalysisRun, AnalysisTarget, Finding, Project } from '@/shared/types';

function makeTarget(id: string, runIds: string[]): AnalysisTarget {
  return {
    id,
    url: `https://example.com/${id}`,
    displayUrl: `https://example.com/${id}`,
    createdAt: new Date().toISOString(),
    latestRunId: runIds[runIds.length - 1] ?? null,
    projectIds: [],
    runIds,
  };
}

function makeRun(id: string, targetId: string, findingIds: string[]): AnalysisRun {
  return {
    id,
    targetId,
    triggeredBy: 'manual',
    status: 'complete',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    score: 80,
    failureReason: null,
    findingIds,
    httpStatus: 200,
    contentType: 'text/html',
    contentSizeBytes: 1000,
  };
}

function makeFinding(id: string, runId: string, title: string): Finding {
  return {
    id,
    runId,
    category: 'meta-tags',
    severity: 'warning',
    title,
    description: 'desc',
    metricValue: null,
    isMissing: false,
    suggestion: 'fix it',
    codeSnippet: null,
  };
}

describe('computeSharedIssues', () => {
  it('surfaces a finding that recurs on 2+ targets in the project', () => {
    const project: Project = {
      id: 'p1',
      name: 'Project',
      createdAt: new Date().toISOString(),
      targetIds: ['t1', 't2'],
    };

    const source = {
      targets: { t1: makeTarget('t1', ['r1']), t2: makeTarget('t2', ['r2']) },
      runs: { r1: makeRun('r1', 't1', ['f1']), r2: makeRun('r2', 't2', ['f2']) },
      findings: {
        f1: makeFinding('f1', 'r1', 'Missing meta description'),
        f2: makeFinding('f2', 'r2', 'Missing meta description'),
      },
    };

    const shared = computeSharedIssues(project, source);

    expect(shared).toHaveLength(1);
    expect(shared[0].title).toBe('Missing meta description');
    expect(shared[0].affectedTargetIds.sort()).toEqual(['t1', 't2']);
  });

  it('does not surface a finding present on only one target', () => {
    const project: Project = {
      id: 'p1',
      name: 'Project',
      createdAt: new Date().toISOString(),
      targetIds: ['t1', 't2'],
    };

    const source = {
      targets: { t1: makeTarget('t1', ['r1']), t2: makeTarget('t2', ['r2']) },
      runs: { r1: makeRun('r1', 't1', ['f1']), r2: makeRun('r2', 't2', []) },
      findings: { f1: makeFinding('f1', 'r1', 'Missing meta description') },
    };

    expect(computeSharedIssues(project, source)).toHaveLength(0);
  });

  it('only considers each target\'s latest completed run', () => {
    const project: Project = {
      id: 'p1',
      name: 'Project',
      createdAt: new Date().toISOString(),
      targetIds: ['t1', 't2'],
    };

    const staleRun = makeRun('r1-old', 't1', ['f-old']);
    const latestRun: AnalysisRun = { ...makeRun('r1-new', 't1', []), status: 'complete' };

    const source = {
      targets: { t1: makeTarget('t1', ['r1-old', 'r1-new']), t2: makeTarget('t2', ['r2']) },
      runs: { 'r1-old': staleRun, 'r1-new': latestRun, r2: makeRun('r2', 't2', ['f2']) },
      findings: {
        'f-old': makeFinding('f-old', 'r1-old', 'Missing meta description'),
        f2: makeFinding('f2', 'r2', 'Missing meta description'),
      },
    };

    // t1's latest run has no findings, so the stale finding must not count toward sharing.
    expect(computeSharedIssues(project, source)).toHaveLength(0);
  });
});
