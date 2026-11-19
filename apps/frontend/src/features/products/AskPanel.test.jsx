import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import AskPanel from './AskPanel.jsx';

function renderPanel(props = {}) {
  const onAsk = props.onAsk ?? vi.fn().mockResolvedValue(true);
  render(
    <AskPanel
      productName="Wireless Earbuds"
      reviewsStatus="ready"
      reviewCount={15}
      status="idle"
      question=""
      answer=""
      errorMessage=""
      {...props}
      onAsk={onAsk}
    />,
  );
  return { onAsk };
}

describe('AskPanel', () => {
  it('names the active product (S2-009, S2-018)', () => {
    renderPanel();
    expect(screen.getByText('Wireless Earbuds')).toBeInTheDocument();
  });

  it('sends the typed question and clears the box on success', async () => {
    const user = userEvent.setup();
    const { onAsk } = renderPanel();

    await user.type(screen.getByLabelText('Your question'), 'Is the battery good?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(onAsk).toHaveBeenCalledWith('Is the battery good?');
    expect(screen.getByLabelText('Your question')).toHaveValue('');
  });

  it('keeps the typed question when asking fails', async () => {
    const user = userEvent.setup();
    renderPanel({ onAsk: vi.fn().mockResolvedValue(false) });

    await user.type(screen.getByLabelText('Your question'), 'Is the battery good?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    expect(screen.getByLabelText('Your question')).toHaveValue('Is the battery good?');
  });

  it('disables Ask until something is typed', async () => {
    const user = userEvent.setup();
    renderPanel();

    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    await user.type(screen.getByLabelText('Your question'), '   ');
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
  });

  it('shows a loading state and blocks a second question', () => {
    renderPanel({ status: 'loading', question: 'Is it loud?' });

    expect(screen.getByText('Analyzing reviews…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    expect(screen.getByLabelText('Your question')).toBeDisabled();
  });

  it('shows the question and answer', () => {
    renderPanel({
      status: 'success',
      question: 'Is it loud?',
      answer: 'Most reviewers say the sound is clear.',
    });

    expect(screen.getByText('Is it loud?')).toBeInTheDocument();
    expect(screen.getByText('Most reviewers say the sound is clear.')).toBeInTheDocument();
  });

  it('shows answer text as plain text, not HTML', () => {
    renderPanel({ status: 'success', question: 'Q', answer: '<img src=x onerror=alert(1)>' });

    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });

  it('shows an error message', () => {
    renderPanel({ status: 'error', errorMessage: 'We couldn’t get an answer right now.' });

    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t get an answer right now.');
  });

  it('hides the question box when there are no reviews (S2-020)', () => {
    renderPanel({ reviewCount: 0 });

    expect(
      screen.getByText(/No reviews have been imported for this product yet/),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask' })).not.toBeInTheDocument();
  });

  it('hides the question box while reviews are still loading (S2-020)', () => {
    renderPanel({ reviewsStatus: 'loading', reviewCount: 0 });

    expect(screen.getByText('Checking for saved reviews…')).toBeInTheDocument();
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
  });

  it('hides the question box when reviews failed to load (S2-020)', () => {
    renderPanel({ reviewsStatus: 'error', reviewCount: 0 });

    expect(screen.getByText(/Saved reviews couldn’t be loaded/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Your question')).not.toBeInTheDocument();
  });
});
