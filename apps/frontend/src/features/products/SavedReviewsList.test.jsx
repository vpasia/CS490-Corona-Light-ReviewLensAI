import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import SavedReviewsList from './SavedReviewsList.jsx';

const fullReview = {
  reviewId: 'r1',
  text: 'Works great',
  rating: 5,
  title: 'Love it',
  reviewDate: '2026-10-01',
  isVerifiedPurchase: true,
};
const bareReview = { reviewId: 'r2', text: 'Meh', rating: 2 };

function renderList(props) {
  return render(
    <SavedReviewsList status="ready" reviews={[]} errorMessage="" onRetry={vi.fn()} {...props} />,
  );
}

describe('SavedReviewsList', () => {
  it('shows placeholder rows while loading', () => {
    renderList({ status: 'loading' });

    expect(screen.getByRole('status', { name: 'Loading saved reviews' })).toBeInTheDocument();
  });

  it('shows each review’s text and rating', () => {
    renderList({ reviews: [fullReview, bareReview] });

    const list = screen.getByRole('list', { name: 'Saved reviews' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Saved reviews (2)' })).toBeInTheDocument();
    expect(screen.getByText('Works great')).toBeInTheDocument();
    expect(screen.getByText('Meh')).toBeInTheDocument();
    expect(screen.getByText('Love it')).toBeInTheDocument();
    expect(screen.getByText('2026-10-01')).toBeInTheDocument();
    expect(screen.getAllByText('Verified purchase')).toHaveLength(1);
    expect(screen.getByRole('img', { name: 'Rated 5 out of 5' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rated 2 out of 5' })).toBeInTheDocument();
  });

  it('leaves out details a review doesn’t have', () => {
    renderList({ reviews: [bareReview] });

    expect(screen.getByText('Meh')).toBeInTheDocument();
    expect(screen.queryByText(/undefined/)).not.toBeInTheDocument();
    expect(screen.queryByText('Verified purchase')).not.toBeInTheDocument();
  });

  it('shows review text literally', () => {
    renderList({ reviews: [{ ...bareReview, text: '<b>bold</b><script>x</script>' }] });

    expect(screen.getByText('<b>bold</b><script>x</script>')).toBeInTheDocument();
  });

  it('shows the empty state when there are no reviews', () => {
    renderList({ reviews: [] });

    expect(screen.getByText('No reviews imported')).toBeInTheDocument();
    expect(screen.getByText('Import reviews to see them here.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the error with Try again', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    renderList({ status: 'error', errorMessage: 'Review data needs to be refreshed.', onRetry });

    expect(screen.getByText('Review data needs to be refreshed.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('describes half-star ratings accurately', () => {
    renderList({ reviews: [{ ...bareReview, rating: 4.5 }] });

    expect(screen.getByRole('img', { name: 'Rated 4.5 out of 5' })).toBeInTheDocument();
  });
});
