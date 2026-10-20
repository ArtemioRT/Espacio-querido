import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PATHS } from '@/app/paths';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isStaff, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-loader" style={{ minHeight: '100vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!session || !isStaff) {
    return <Navigate to={PATHS.admin.login} replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
