import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AddToProjectAction } from '@/features/projects/components/AddToProjectAction';
import { analysisApiService } from '@/shared/realtime/AnalysisApiService';

vi.mock('@/shared/realtime/AnalysisApiService', () => ({
  analysisApiService: {
    listProjects: vi.fn(),
    createProject: vi.fn(),
    attachAnalysisToProject: vi.fn(),
    getProject: vi.fn(),
  },
}));

const mockedService = vi.mocked(analysisApiService, true);

const EXISTING_PROJECT = {
  id: 1,
  title: 'Existing Project',
  url: null,
  description: 'desc',
  category: 'saas' as const,
  country: 'United States',
  region: null,
  competitors: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('AddToProjectAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedService.listProjects.mockResolvedValue([EXISTING_PROJECT]);
  });

  it('opens as a modal (not inline content) offering to choose an existing project', async () => {
    render(<AddToProjectAction analysisId={42} />);
    await waitFor(() => expect(mockedService.listProjects).toHaveBeenCalled());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /add analysis to a project/i }));

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Choose a project')).toBeInTheDocument();
    expect(mockedService.attachAnalysisToProject).not.toHaveBeenCalled();
  });

  it('supports switching to create-a-new-project within the same modal', async () => {
    render(<AddToProjectAction analysisId={42} />);
    await waitFor(() => expect(mockedService.listProjects).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add analysis to a project/i }));
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('button', { name: /create a new project instead/i }));

    expect(screen.getByText('Create a new project')).toBeInTheDocument();
  });

  it('dismissing the modal (Escape) attaches nothing and creates no project', async () => {
    render(<AddToProjectAction analysisId={42} />);
    await waitFor(() => expect(mockedService.listProjects).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add analysis to a project/i }));
    await screen.findByRole('dialog');

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mockedService.attachAnalysisToProject).not.toHaveBeenCalled();
    expect(mockedService.createProject).not.toHaveBeenCalled();
  });

  it('attaches to the chosen project and shows the confirmation', async () => {
    mockedService.attachAnalysisToProject.mockResolvedValue({
      id: 42,
      ingestedUrlId: 42,
      url: 'https://example.com',
      seoScore: 80,
      geoScore: 70,
      overallScore: 75,
      analysis: null,
      jsonLd: null,
      status: 'completed',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      optimization: null,
    });

    render(<AddToProjectAction analysisId={42} />);
    await waitFor(() => expect(mockedService.listProjects).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: /add analysis to a project/i }));
    await screen.findByRole('dialog');

    await userEvent.selectOptions(screen.getByRole('combobox'), '1');
    await userEvent.click(screen.getByRole('button', { name: /^add to project$/i }));

    await waitFor(() => expect(mockedService.attachAnalysisToProject).toHaveBeenCalledWith(1, 42));
    expect(await screen.findByText(/added to project/i)).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
