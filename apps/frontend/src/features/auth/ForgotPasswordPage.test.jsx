import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ForgotPasswordPage from './ForgotPasswordPage.jsx';
import { useAuth } from './useAuth.js';

vi.mock('./useAuth.js');

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordPage', () => {
  const resetPassword = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    useAuth.mockReturnValue({ resetPassword });
  });

  it('asks for an email and sends nothing when the field is empty', async () => {
    const user = userEvent.setup();
    renderForgotPasswordPage();

    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('sends a reset link and confirms without revealing whether the account exists', async () => {
    resetPassword.mockResolvedValue();
    const user = userEvent.setup();
    renderForgotPasswordPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(
      await screen.findByText(/If an account exists for student@example.com/),
    ).toBeInTheDocument();
    expect(resetPassword).toHaveBeenCalledWith('student@example.com');
  });

  it('shows a plain-language message when the request fails', async () => {
    resetPassword.mockRejectedValue({ code: 'auth/network-request-failed' });
    const user = userEvent.setup();
    renderForgotPasswordPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText(/couldn’t reach the sign-in service/)).toBeInTheDocument();
  });
});
