import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useProjectDetail } from '@/features/projects/hooks/useProjectDetail';
import { ProjectUrlList } from '@/features/projects/components/ProjectUrlList';
import { SharedIssuesPanel } from '@/features/projects/components/SharedIssuesPanel';
import { mockAnalysisService } from '@/shared/realtime/MockAnalysisService';
import { useAppStore } from '@/shared/store/useAppStore';
import type { AnalysisRun, Finding } from '@/shared/types';

function resetStore() {
  useAppStore.setState({ targets: {}, targetIdByUrl: {}, runs: {}, findings: {}, projects: {}, automations: {} });
}

function ProjectHarness({ projectId }: { projectId: string }) {
  const { targets, sharedIssues, addUrl, removeTarget, analyzeTarget } = useProjectDetail(projectId);
  return (
    <div>
      <ProjectUrlList
        targets={targets}
        onAddUrl={addUrl}
        onRemoveTarget={removeTarget}
        onAnalyzeTarget={(target) => analyzeTarget(target.displayUrl)}
      />
      <SharedIssuesPanel sharedIssues={sharedIssues} />
    </div>
  );
}

function completedRun(id: string, targetId: string, findingId: string): AnalysisRun {
  return {
    id,
    targetId,
    triggeredBy: 'manual',
    status: 'complete',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    score: 60,
    seoScore: null,
    geoScore: null,
    failureReason: null,
    findingIds: [findingId],
    httpStatus: 200,
    contentType: 'text/html',
    contentSizeBytes: 1000,
  };
}

function missingMetaFinding(id: string, runId: string): Finding {
  return {
    id,
    runId,
    category: 'meta-tags',
    severity: 'critical',
    title: 'Missing meta description',
    description: 'No meta description tag was found.',
    metricValue: null,
    isMissing: true,
    suggestion: 'Add a meta description.',
    codeSnippet: null,
  };
}

describe('create project and detect shared issues (User Story 2)', () => {
  beforeEach(() => {
    resetStore();
  });

  it('lists both URLs after adding them to a project', () => {
    const project = mockAnalysisService.createProject({ name: 'Shared Issue Project' });
    mockAnalysisService.addTargetToProject(project.id, 'https://shared.example.com/a');
    mockAnalysisService.addTargetToProject(project.id, 'https://shared.example.com/b');

    render(<ProjectHarness projectId={project.id} />);

    expect(screen.getByText('https://shared.example.com/a')).toBeInTheDocument();
    expect(screen.getByText('https://shared.example.com/b')).toBeInTheDocument();
    expect(screen.getByText(/no shared issues detected yet/i)).toBeInTheDocument();
  });

  it('surfaces a finding as a shared issue once it appears on both project URLs', async () => {
    const project = mockAnalysisService.createProject({ name: 'Shared Issue Project' });
    const { targetId: targetIdA } = mockAnalysisService.addTargetToProject(project.id, 'https://shared.example.com/a');
    const { targetId: targetIdB } = mockAnalysisService.addTargetToProject(project.id, 'https://shared.example.com/b');

    const store = useAppStore.getState();
    store.addRun(completedRun('run-a', targetIdA, 'finding-a'));
    store.addRun(completedRun('run-b', targetIdB, 'finding-b'));
    store.addFindings([missingMetaFinding('finding-a', 'run-a'), missingMetaFinding('finding-b', 'run-b')]);

    render(<ProjectHarness projectId={project.id} />);

    expect(await screen.findByText('Missing meta description')).toBeInTheDocument();
    expect(screen.getByText(/found on 2 pages/i)).toBeInTheDocument();
  });

  it('does not treat a finding present on only one URL as shared', () => {
    const project = mockAnalysisService.createProject({ name: 'Shared Issue Project' });
    const { targetId: targetIdA } = mockAnalysisService.addTargetToProject(project.id, 'https://shared.example.com/a');
    mockAnalysisService.addTargetToProject(project.id, 'https://shared.example.com/b');

    useAppStore.getState().addRun(completedRun('run-a', targetIdA, 'finding-a'));
    useAppStore.getState().addFindings([missingMetaFinding('finding-a', 'run-a')]);

    render(<ProjectHarness projectId={project.id} />);

    expect(screen.getByText(/no shared issues detected yet/i)).toBeInTheDocument();
  });
});
