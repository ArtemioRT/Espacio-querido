import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { PATHS } from './paths';
import PublicLayout from '@/components/layout/PublicLayout';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import RequireAdmin from '@/components/auth/RequireAdmin';
import HomePage from '@/pages/public/HomePage';
import NotFoundPage from '@/pages/public/NotFoundPage';

// Carga diferida: el sitio público no descarga el código del panel
const PropertiesPage = lazy(() => import('@/pages/public/PropertiesPage'));
const PropertyDetailPage = lazy(() => import('@/pages/public/PropertyDetailPage'));
const PrivacyPage = lazy(() => import('@/pages/public/PrivacyPage'));
const PropertySheetPage = lazy(() => import('@/pages/public/PropertySheetPage'));

const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage'));

const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const LeadsPage = lazy(() => import('@/pages/admin/LeadsPage'));
const AdminPropertiesPage = lazy(() => import('@/pages/admin/AdminPropertiesPage'));
const PropertyEditorPage = lazy(() => import('@/pages/admin/PropertyEditorPage'));
const AccountPage = lazy(() => import('@/pages/admin/AccountPage'));
const AgentsPage = lazy(() => import('@/pages/admin/AgentsPage'));

const Loader = () => (
  <div className="page-loader">
    <div className="spinner" />
  </div>
);

export default function AppRouter() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        {/* Sitio público */}
        <Route element={<PublicLayout />}>
          <Route path={PATHS.home} element={<HomePage />} />
          <Route path={PATHS.properties} element={<PropertiesPage />} />
          <Route path={PATHS.propertyDetail} element={<PropertyDetailPage />} />
          <Route path={PATHS.privacy} element={<PrivacyPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Ficha técnica imprimible / PDF */}
        <Route path={PATHS.propertySheet} element={<PropertySheetPage />} />

        {/* Autenticación */}
        <Route path={PATHS.admin.login} element={<LoginPage />} />
        <Route path={PATHS.admin.forgot} element={<ForgotPasswordPage />} />
        <Route path={PATHS.admin.reset} element={<ResetPasswordPage />} />

        {/* Panel de administración */}
        <Route
          path={PATHS.admin.root}
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          {/* Solo administrador */}
          <Route index element={<RequireAdmin><DashboardPage /></RequireAdmin>} />
          <Route path="leads" element={<RequireAdmin><LeadsPage /></RequireAdmin>} />
          <Route path="asesores" element={<RequireAdmin><AgentsPage /></RequireAdmin>} />
          {/* Administrador y asesores */}
          <Route path="propiedades" element={<AdminPropertiesPage />} />
          <Route path="propiedades/nueva" element={<PropertyEditorPage />} />
          <Route path="propiedades/:id/editar" element={<PropertyEditorPage />} />
          <Route path="cuenta" element={<AccountPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
