import { Navigate, Outlet, useLocation } from 'react-router';

import { useAuth } from '../features/auth/useAuth.js';

export default function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <p role="status" className="p-6 text-sm text-[#6B6B6B]">
        Loading…
      </p>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
