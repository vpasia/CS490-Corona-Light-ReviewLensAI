import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import IngestionStatusCard from './IngestionStatusCard.jsx';

const succeededRun = {
  status: 'succeeded',
  reused: false,
  receivedCount: 15,
  acceptedCount: 13,
  rejectedCount: 2,
  savedCount: 12,
  reviewCount: 12,
};

function renderCard(props) {
  return render(
    <IngestionStatusCard
      status="ready"
      latestRun={succeededRun}
      errorMessage=""
      onRetry={vi.fn()}
      {...props}
    />,
  );
}

describe('IngestionStatusCard import counts', () => {
  it('shows the saved and skipped counts under the import result', () => {
    renderCard({});

    expect(screen.getByText('Import succeeded')).toBeInTheDocument();
    expect(screen.getByText('12 reviews saved.')).toBeInTheDocument();
    expect(screen.getByText(/2 records couldn’t be used and were skipped/)).toBeInTheDocument();
  });

  it('shows no counts while the status is loading or could not be loaded', () => {
    const { rerender } = renderCard({ status: 'loading' });
    expect(screen.queryByText('12 reviews saved.')).not.toBeInTheDocument();

    rerender(
      <IngestionStatusCard
        status="error"
        latestRun={succeededRun}
        errorMessage="Status unavailable."
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText('12 reviews saved.')).not.toBeInTheDocument();
  });

  it('shows no counts for an import that is still running', () => {
    renderCard({ latestRun: { status: 'processing' } });

    expect(screen.getByText('Import in progress')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Import results' })).not.toBeInTheDocument();
  });
});
