import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuth } from '../features/auth/useAuth.js';
import ProtectedRoute from './ProtectedRoute.jsx';

vi.mock('../features/auth/useAuth.js');

function renderAtHome() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<p>Login screen</p>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<p>Private home</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends signed-out users to the login page without showing private content', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderAtHome();

    expect(screen.getByText('Login screen')).toBeInTheDocument();
    expect(screen.queryByText('Private home')).not.toBeInTheDocument();
  });

  it('shows the page to signed-in users', () => {
    useAuth.mockReturnValue({ user: { email: 'student@example.com' }, loading: false });
    renderAtHome();

    expect(screen.getByText('Private home')).toBeInTheDocument();
  });

  it('shows nothing private while the sign-in state is still loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderAtHome();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Private home')).not.toBeInTheDocument();
  });
});
