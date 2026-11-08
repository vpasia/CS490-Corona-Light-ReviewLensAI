import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from './LoginPage.jsx';
import { useAuth } from './useAuth.js';

vi.mock('./useAuth.js');

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  const login = vi.fn();
  const loginWithGoogle = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    useAuth.mockReturnValue({ user: null, loading: false, login, loginWithGoogle });
  });

  it('shows the email and password fields and a Sign in button', () => {
    renderLoginPage();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows field errors and does not sign in when the form is empty', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('rejects an email that is not formatted like an email', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText(/look like an email address/)).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in with the entered email and password', async () => {
    login.mockResolvedValue({});
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret-pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('student@example.com', 'secret-pass'));
  });

  it('shows a plain-language message instead of the raw code when the password is wrong', async () => {
    login.mockRejectedValue({ code: 'auth/invalid-credential' });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText('Email'), 'student@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-pass');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText(/don’t match/)).toBeInTheDocument();
    expect(screen.queryByText(/auth\/invalid-credential/)).not.toBeInTheDocument();
  });
});
