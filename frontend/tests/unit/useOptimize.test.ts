import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOptimize } from '@/features/analysis/hooks/useOptimize';
import { apiClient } from '@/lib/api-client';

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedClient = vi.mocked(apiClient, true);

const OPTIMIZATION = {
  id: 1,
  analysis_id: 42,
  optimized_html: '<p>optimized</p>',
  optimized_json_ld: null,
  optimized_content: null,
  changes: null,
  copy_paste_ready: null,
  score_before: null,
  score_after_estimated: null,
  roi_projection: null,
  status: 'completed',
  error: null,
};

describe('useOptimize.loadExisting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('issues a GET (never a POST) and populates optimization state', async () => {
    mockedClient.get.mockResolvedValue(OPTIMIZATION);

    const { result } = renderHook(() => useOptimize());
    await act(async () => {
      await result.current.loadExisting(42);
    });

    expect(mockedClient.get).toHaveBeenCalledWith('/optimize/42');
    expect(mockedClient.post).not.toHaveBeenCalled();
    expect(result.current.optimization).toEqual(OPTIMIZATION);
    expect(result.current.error).toBeNull();
  });

  it('treats a "no optimization found" 404 as no error (FR-010)', async () => {
    mockedClient.get.mockRejectedValue(new Error('No optimization found for analysis with id 42'));

    const { result } = renderHook(() => useOptimize());
    await act(async () => {
      await result.current.loadExisting(42);
    });

    expect(result.current.optimization).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('surfaces a genuine failure as an error', async () => {
    mockedClient.get.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useOptimize());
    await act(async () => {
      await result.current.loadExisting(42);
    });

    expect(result.current.error).toBe('Network error');
  });

  it('run() still POSTs, unaffected by loadExisting existing', async () => {
    mockedClient.post
      .mockResolvedValueOnce(OPTIMIZATION)
      .mockResolvedValueOnce({ total_score: 80, dimensions: {}, summary: {}, has_optimization: true });

    const { result } = renderHook(() => useOptimize());
    await act(async () => {
      await result.current.run(42);
    });

    expect(mockedClient.post).toHaveBeenCalledWith('/optimize/42', {});
    expect(result.current.optimization).toEqual(OPTIMIZATION);
  });
});
