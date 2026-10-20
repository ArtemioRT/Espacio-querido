import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordInput from '@/components/auth/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PATHS } from '@/app/paths';
import { isValidEmail } from '@/utils/format';

export default function LoginPage() {
  useDocumentTitle('Iniciar sesión');
  const { signIn, session, isStaff, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from || PATHS.admin.dashboard;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session && isStaff) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) return setError('Escribe un correo válido.');
    if (!password) return setError('Escribe tu contraseña.');
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Bienvenido de nuevo"
      subtitle="Ingresa con tu cuenta de administrador."
      footer={<Link to={PATHS.home}>← Volver al sitio</Link>}
    >
      <form onSubmit={onSubmit} noValidate>
        {error && <div className="alert alert--error">{error}</div>}
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@espacioquerido.mx" autoFocus />
        </div>
        <div className="field">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <label htmlFor="password" className="field__label">
              Contraseña
            </label>
            <Link to={PATHS.admin.forgot} style={{ fontSize: 12, color: '#9b1b3a' }}>
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordInput id="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
          {submitting ? <span className="spinner spinner--sm spinner--light" /> : 'Iniciar sesión'}
        </button>
      </form>
    </AuthLayout>
  );
}
