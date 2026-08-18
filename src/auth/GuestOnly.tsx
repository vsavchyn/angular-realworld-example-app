import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './useAuth';

/** Angular canActivate on /login and /register: only when not authenticated. */
export function GuestOnly() {
  const { isAuthenticated, authState } = useAuth();

  if (authState === 'loading') {
    return null;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
