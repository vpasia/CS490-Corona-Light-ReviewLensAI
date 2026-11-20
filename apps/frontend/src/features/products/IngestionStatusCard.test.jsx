import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import IngestionStatusCard from './IngestionStatusCard.jsx';

function renderCard(props) {
  return render(
    <IngestionStatusCard
      status="ready"
      latestRun={null}
      errorMessage=""
      onRetry={vi.fn()}
      {...props}
    />,
  );
}

describe('IngestionStatusCard', () => {
  it('shows placeholders while the status loads', () => {
    renderCard({ status: 'loading' });

    expect(screen.getByRole('status', { name: 'Loading import status' })).toBeInTheDocument();
  });

  it('says no import has been run when there is no run yet', () => {
    renderCard({ latestRun: null });

    expect(screen.getByText('No import yet')).toBeInTheDocument();
    expect(screen.getByText('No import has been run for this product yet.')).toBeInTheDocument();
  });

  it('shows that an import is in progress', () => {
    renderCard({ latestRun: { status: 'processing' } });

    expect(screen.getByText('Import in progress')).toBeInTheDocument();
  });

  it('shows that an import succeeded', () => {
    renderCard({ latestRun: { status: 'succeeded', reused: false } });

    expect(screen.getByText('Import succeeded')).toBeInTheDocument();
    expect(screen.getByText(/finished and the reviews are saved/)).toBeInTheDocument();
  });

  it('says when a successful import reused saved reviews', () => {
    renderCard({ latestRun: { status: 'succeeded', reused: true } });

    expect(screen.getByText('Import succeeded')).toBeInTheDocument();
    expect(screen.getByText(/reused reviews that were already saved/)).toBeInTheDocument();
  });

  it('shows the safe failure message when an import failed', () => {
    renderCard({
      latestRun: {
        status: 'failed',
        error: { code: 'X', message: 'Reviews could not be retrieved.' },
      },
    });

    expect(screen.getByText('Import failed')).toBeInTheDocument();
    expect(screen.getByText('Reviews could not be retrieved.')).toBeInTheDocument();
  });

  it('shows a plain message when a failed import has no error message', () => {
    renderCard({ latestRun: { status: 'failed', error: null } });

    expect(screen.getByText('Import failed')).toBeInTheDocument();
    expect(screen.getByText(/could not be completed/)).toBeInTheDocument();
  });

  it('does not claim success for a status it does not recognize', () => {
    renderCard({ latestRun: { status: 'weird' } });

    expect(screen.getByText('Import status unknown')).toBeInTheDocument();
    expect(screen.queryByText('Import succeeded')).not.toBeInTheDocument();
  });

  it('shows the error with Try again when the status cannot be loaded', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderCard({ status: 'error', errorMessage: 'Status unavailable.', onRetry });

    expect(screen.getByText('Status unavailable.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
