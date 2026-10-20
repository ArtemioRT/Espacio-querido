import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import { sendPasswordReset } from '@/services/auth.service';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PATHS } from '@/app/paths';
import { isValidEmail } from '@/utils/format';

export default function ForgotPasswordPage() {
  useDocumentTitle('Recuperar contraseña');
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!isValidEmail(email)) return setError('Escribe un correo válido.');
    setSubmitting(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title={sent ? 'Revisa tu correo' : 'Recuperar contraseña'}
      subtitle={sent ? undefined : 'Te enviaremos un enlace para crear una nueva contraseña.'}
      footer={<Link to={PATHS.admin.login}>← Volver a iniciar sesión</Link>}
    >
      {sent ? (
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <MailCheck style={{ width: 48, height: 48, color: '#1f8a52', margin: '0 auto 12px' }} />
          <p className="text-muted" style={{ fontSize: 14 }}>
            Si <strong>{email}</strong> está registrado, recibirás un enlace para restablecer tu contraseña. Revisa también la carpeta de spam.
          </p>
          <button className="btn btn--ghost btn--sm" onClick={() => setSent(false)}>
            Enviar de nuevo
          </button>
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          {error && <div className="alert alert--error">{error}</div>}
          <div className="field">
            <label htmlFor="email">Correo electrónico</label>
            <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <button type="submit" className="btn btn--primary btn--block" disabled={submitting}>
            {submitting ? <span className="spinner spinner--sm spinner--light" /> : 'Enviar enlace'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
