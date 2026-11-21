import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ImportResultCounts from './ImportResultCounts.jsx';

describe('ImportResultCounts', () => {
  it('shows nothing when there is no run or the import is still running', () => {
    const { container, rerender } = render(<ImportResultCounts run={null} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<ImportResultCounts run={{ status: 'processing' }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows only the saved count when nothing was skipped', () => {
    render(
      <ImportResultCounts
        run={{
          status: 'succeeded',
          reused: false,
          acceptedCount: 13,
          rejectedCount: 0,
          savedCount: 13,
        }}
      />,
    );

    expect(screen.getByText('13 reviews saved.')).toBeInTheDocument();
    expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();
    expect(screen.queryByText(/duplicate/)).not.toBeInTheDocument();
  });

  it('shows skipped records and does not count them as saved reviews', () => {
    render(
      <ImportResultCounts
        run={{
          status: 'succeeded',
          reused: false,
          acceptedCount: 13,
          rejectedCount: 2,
          savedCount: 12,
        }}
      />,
    );

    expect(screen.getByText('12 reviews saved.')).toBeInTheDocument();
    expect(screen.getByText(/2 records couldn’t be used and were skipped/)).toBeInTheDocument();
    expect(screen.getByText(/not part of the review dataset/)).toBeInTheDocument();
    expect(screen.getByText('1 duplicate review was left out.')).toBeInTheDocument();
    expect(screen.queryByText(/14 reviews/)).not.toBeInTheDocument();
  });

  it('uses singular wording for one review and one skipped record', () => {
    render(
      <ImportResultCounts
        run={{
          status: 'succeeded',
          reused: false,
          acceptedCount: 1,
          rejectedCount: 1,
          savedCount: 1,
        }}
      />,
    );

    expect(screen.getByText('1 review saved.')).toBeInTheDocument();
    expect(screen.getByText(/1 record couldn’t be used and was skipped/)).toBeInTheDocument();
  });

  it('says saved reviews were reused instead of reporting zero skipped', () => {
    render(
      <ImportResultCounts
        run={{
          status: 'succeeded',
          reused: true,
          rejectedCount: 0,
          savedCount: 0,
          reviewCount: 30,
        }}
      />,
    );

    expect(
      screen.getByText('Using 30 saved reviews. No new records were checked.'),
    ).toBeInTheDocument();
    expect(screen.queryByText(/skipped/)).not.toBeInTheDocument();
  });

  it('says nothing was saved when an import failed, and still reports skipped records', () => {
    render(<ImportResultCounts run={{ status: 'failed', rejectedCount: 13, savedCount: 0 }} />);

    expect(screen.getByText('No reviews were saved from this import.')).toBeInTheDocument();
    expect(screen.getByText(/13 records couldn’t be used and were skipped/)).toBeInTheDocument();
  });
});
