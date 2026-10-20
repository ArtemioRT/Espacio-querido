import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { PATHS } from '@/app/paths';

/** Secciones solo para administradores (dashboard, leads, asesores). Los asesores van a sus propiedades. */
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to={PATHS.admin.properties} replace />;
  return <>{children}</>;
}
