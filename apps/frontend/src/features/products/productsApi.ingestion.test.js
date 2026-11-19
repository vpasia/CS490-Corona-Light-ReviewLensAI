import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiRequest } from '../../lib/api.js';

import { listIngestionRuns } from './productsApi.js';

vi.mock('../../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  apiRequest: vi.fn(),
}));
vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));

describe('listIngestionRuns', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('requests the product’s import history', async () => {
    apiRequest.mockResolvedValue({
      data: [{ ingestionRunId: 'run1', status: 'succeeded' }],
      count: 1,
    });

    await expect(listIngestionRuns('p 1')).resolves.toEqual([
      { ingestionRunId: 'run1', status: 'succeeded' },
    ]);
    expect(apiRequest).toHaveBeenCalledWith('/api/products/p%201/ingestion-runs');
  });

  it('returns an empty list when the response has no data', async () => {
    apiRequest.mockResolvedValue({});

    await expect(listIngestionRuns('p1')).resolves.toEqual([]);
  });
});
