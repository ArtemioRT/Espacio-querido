import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AuthLayout from '@/components/auth/AuthLayout';
import PasswordInput from '@/components/auth/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { passwordStrength, updatePassword } from '@/services/auth.service';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PATHS } from '@/app/paths';

export default function ResetPasswordPage() {
  useDocumentTitle('Nueva contraseña');
  const { session, loading, recoveryMode } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Supabase manda errores en el hash si el enlace expiró
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const desc = hash.get('error_description');
    if (desc) setLinkError(desc.includes('expired') ? 'El enlace expiró. Solicita uno nuevo.' : desc);
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (passwordStrength(password).score < 2) return setError('Usa una contraseña más segura (mayúsculas, números o símbolos).');
    if (password !== confirm) return setError('Las contraseñas no coinciden.');
    setSubmitting(true);
    try {
      await updatePassword(password);
      setDone(true);
      setTimeout(() => navigate(PATHS.admin.dashboard, { replace: true }), 1800);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const validLink = !!session || recoveryMode;

  return (
    <AuthLayout title="Crea una nueva contraseña" footer={<Link to={PATHS.admin.login}>← Volver a iniciar sesión</Link>}>
      {loading ? (
        <div className="page-loader" style={{ minHeight: 160 }}>
          <div className="spinner" />
        </div>
      ) : linkError || !validLink ? (
        <div style={{ marginTop: 24 }}>
          <div className="alert alert--error">{linkError || 'El enlace no es válido o ya fue utilizado.'}</div>
          <Link to={PATHS.admin.forgot} className="btn btn--primary btn--block" style={{ marginTop: 16 }}>
            Solicitar nuevo enlace
          </Link>
        </div>
      ) : done ? (
        <div className="alert alert--success" style={{ marginTop: 24 }}>
          ¡Listo! Tu contraseña se actualizó. Te llevamos al panel…
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {error && <div className="alert alert--error">{error}</div>}
          <div className="field">
            <label htmlFor="pw">Nueva contraseña</label>
            <PasswordInput id="pw" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} showStrength autoFocus />
          </div>
          <div className="field">
            <label htmlFor="pw2">Confirmar contraseña</label>
            <PasswordInput id="pw2" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? <span className="spinner spinner--sm spinner--light" /> : 'Guardar contraseña'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
