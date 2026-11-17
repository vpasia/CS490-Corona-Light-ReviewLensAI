import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ReviewSummaryCard from './ReviewSummaryCard.jsx';

const reviews = [
  { reviewId: 'r1', text: 'a', rating: 5 },
  { reviewId: 'r2', text: 'b', rating: 5 },
  { reviewId: 'r3', text: 'c', rating: 4 },
  { reviewId: 'r4', text: 'd', rating: 3 },
  { reviewId: 'r5', text: 'e', rating: 1 },
];

describe('ReviewSummaryCard', () => {
  it('shows the review count and average rating', () => {
    render(<ReviewSummaryCard reviews={reviews} />);

    expect(screen.getByRole('heading', { name: 'Review summary' })).toBeInTheDocument();
    expect(screen.getByText('Total reviews').nextElementSibling).toHaveTextContent('5');
    expect(screen.getByText('3.6 out of 5')).toBeInTheDocument();
  });

  it('shows how many reviews gave each star rating', () => {
    render(<ReviewSummaryCard reviews={reviews} />);

    const items = within(screen.getByRole('list', { name: 'Ratings breakdown' })).getAllByRole(
      'listitem',
    );

    expect(items).toHaveLength(5);
    expect(items[0]).toHaveTextContent('5 stars');
    expect(items[0]).toHaveTextContent('2');
    expect(items[1]).toHaveTextContent('4 stars');
    expect(items[3]).toHaveTextContent('2 stars');
    expect(items[4]).toHaveTextContent('1 star');
  });

  it('shows nothing when there are no reviews', () => {
    const { container } = render(<ReviewSummaryCard reviews={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
