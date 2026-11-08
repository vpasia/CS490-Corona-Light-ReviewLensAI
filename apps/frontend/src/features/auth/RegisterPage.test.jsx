import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RegisterPage from './RegisterPage.jsx';
import { useAuth } from './useAuth.js';

vi.mock('./useAuth.js');

function renderRegisterPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>,
  );
}

describe('RegisterPage', () => {
  const register = vi.fn();
  const loginWithGoogle = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    useAuth.mockReturnValue({ user: null, loading: false, register, loginWithGoogle });
  });

  it('rejects a password shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('creates the account with the entered email and password', async () => {
    register.mockResolvedValue({});
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'long-enough-pass');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith('student@example.com', 'long-enough-pass'),
    );
  });

  it('tells the user when that email already has an account', async () => {
    register.mockRejectedValue({ code: 'auth/email-already-in-use' });
    const user = userEvent.setup();
    renderRegisterPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'long-enough-pass');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });
});
