import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import { listIngestionRuns } from './productsApi.js';
import { useIngestionStatus } from './useIngestionStatus.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const olderRun = {
  ingestionRunId: 'run-1',
  status: 'failed',
  startedAt: { _seconds: 100, _nanoseconds: 0 },
};
const newerRun = {
  ingestionRunId: 'run-2',
  status: 'succeeded',
  startedAt: { _seconds: 200, _nanoseconds: 0 },
};

describe('useIngestionStatus', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads the import history and reports the newest run', async () => {
    listIngestionRuns.mockResolvedValue([olderRun, newerRun]);

    const { result } = renderHook(() => useIngestionStatus('p1'));

    expect(result.current.status).toBe('loading');
    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.latestRun).toBe(newerRun);
    expect(listIngestionRuns).toHaveBeenCalledWith('p1');
  });

  it('reports no run when the product has never been imported', async () => {
    listIngestionRuns.mockResolvedValue(undefined);

    const { result } = renderHook(() => useIngestionStatus('p1'));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.latestRun).toBeNull();
  });

  it('shows the server’s message and recovers on reload', async () => {
    listIngestionRuns
      .mockRejectedValueOnce(
        new ApiError({ status: 503, code: 'UNAVAILABLE', message: 'Status unavailable.' }),
      )
      .mockResolvedValueOnce([newerRun]);

    const { result } = renderHook(() => useIngestionStatus('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe('Status unavailable.');
    expect(result.current.latestRun).toBeNull();

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.status).toBe('ready'));
    expect(result.current.latestRun).toBe(newerRun);
    expect(result.current.errorMessage).toBe('');
  });

  it('hides unexpected error details', async () => {
    listIngestionRuns.mockRejectedValue(new Error('TypeError: boom'));

    const { result } = renderHook(() => useIngestionStatus('p1'));

    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.errorMessage).toBe(
      'We couldn’t load the import status right now. Please try again.',
    );
  });
});
