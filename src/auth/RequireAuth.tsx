import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

/** Angular canActivate requireAuth → redirect to /login when currentUser is missing. */
export function RequireAuth() {
  const { isAuthenticated, authState } = useAuth();

  if (authState === 'loading') {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
