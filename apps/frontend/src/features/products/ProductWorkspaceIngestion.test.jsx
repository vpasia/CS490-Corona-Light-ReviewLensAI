import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/lib/api.js';

import ProductWorkspacePage from './ProductWorkspacePage.jsx';
import { getProduct, importReviews, listIngestionRuns, listReviews } from './productsApi.js';

vi.mock('@/lib/firebase.js', () => ({ auth: {} }));
vi.mock('firebase/auth', () => ({ signOut: vi.fn() }));
vi.mock('./productsApi.js');

const product = {
  productId: 'p1',
  productName: 'Echo Dot',
  platform: 'amazon',
  amazonUrl: 'https://www.amazon.com/dp/B0ABCDEF12',
};
const failedRun = {
  ingestionRunId: 'run-1',
  status: 'failed',
  startedAt: { _seconds: 100, _nanoseconds: 0 },
  error: { code: 'UPSTREAM_PROVIDER_ERROR', message: 'Reviews could not be retrieved.' },
};
const succeededRun = {
  ingestionRunId: 'run-2',
  status: 'succeeded',
  reused: false,
  startedAt: { _seconds: 200, _nanoseconds: 0 },
  error: null,
};

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={['/products/p1/overview']}>
      <Routes>
        <Route path="/products/:productId/overview" element={<ProductWorkspacePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProductWorkspacePage import status', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getProduct.mockResolvedValue(product);
    listReviews.mockResolvedValue({ reviews: [], status: 'notImported', summary: null });
    listIngestionRuns.mockResolvedValue([]);
  });

  it('shows that nothing has been imported yet', async () => {
    renderWorkspace();

    expect(
      await screen.findByText('No import has been run for this product yet.'),
    ).toBeInTheDocument();
    expect(listIngestionRuns).toHaveBeenCalledWith('p1');
  });

  it('shows the newest saved import result without importing again', async () => {
    listIngestionRuns.mockResolvedValue([failedRun, succeededRun]);
    renderWorkspace();

    expect(await screen.findByText('Import succeeded')).toBeInTheDocument();
    expect(screen.queryByText('Import failed')).not.toBeInTheDocument();
    expect(importReviews).not.toHaveBeenCalled();
  });

  it('shows a failed import from the saved history', async () => {
    listIngestionRuns.mockResolvedValue([failedRun]);
    renderWorkspace();

    expect(await screen.findByText('Import failed')).toBeInTheDocument();
    expect(screen.getByText('Reviews could not be retrieved.')).toBeInTheDocument();
  });

  it('refreshes the status after a successful import', async () => {
    listIngestionRuns.mockResolvedValueOnce([]).mockResolvedValueOnce([succeededRun]);
    importReviews.mockResolvedValue({ savedCount: 1 });
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByText('No import has been run for this product yet.');
    await user.click(screen.getByRole('button', { name: 'Import reviews' }));

    expect(await screen.findByText('Import succeeded')).toBeInTheDocument();
    expect(listIngestionRuns).toHaveBeenCalledTimes(2);
  });

  it('refreshes the status after a failed import so the failure is visible', async () => {
    listIngestionRuns.mockResolvedValueOnce([]).mockResolvedValueOnce([failedRun]);
    importReviews.mockRejectedValue(
      new ApiError({
        status: 502,
        code: 'UPSTREAM_PROVIDER_ERROR',
        message: 'The review provider could not complete the import.',
      }),
    );
    const user = userEvent.setup();
    renderWorkspace();

    await screen.findByText('No import has been run for this product yet.');
    await user.click(screen.getByRole('button', { name: 'Import reviews' }));

    expect(await screen.findByText('Import failed')).toBeInTheDocument();
    expect(screen.getByText('Reviews could not be retrieved.')).toBeInTheDocument();
    expect(listIngestionRuns).toHaveBeenCalledTimes(2);
  });
});
