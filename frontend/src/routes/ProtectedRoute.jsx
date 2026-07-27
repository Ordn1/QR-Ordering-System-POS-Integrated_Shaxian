import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuthStore } from '../store/authStore';

export default function ProtectedRoute({ roles, loginPath }) {
  const staff = useAuthStore((state) => state.staff);
  const status = useAuthStore((state) => state.status);
  const restore = useAuthStore((state) => state.restore);
  const location = useLocation();

  useEffect(() => {
    if (status === 'unknown') {
      restore();
    }
  }, [status, restore]);

  if (status === 'unknown') {
    return null;
  }

  if (status === 'anonymous') {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
  }

  if (!roles.includes(staff.role)) {
    return <Navigate to="/staff" replace />;
  }

  return <Outlet />;
}
