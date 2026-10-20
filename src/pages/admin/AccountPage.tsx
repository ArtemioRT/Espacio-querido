import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera } from 'lucide-react';
import Avatar from '@/components/ui/Avatar';
import { uploadAgentAvatar } from '@/services/agents.service';
import { PageHeader, Panel } from '@/components/admin/AdminUI';
import PasswordInput from '@/components/auth/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { passwordStrength, reauthenticate, updatePassword, updateProfile } from '@/services/auth.service';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { formatDate, onlyDigits } from '@/utils/format';

export default function AccountPage() {
  useDocumentTitle('Mi cuenta');
  const { user, profile, refreshProfile } = useAuth();
  const toast = useToast();

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp ?? '');
  const [title, setTitle] = useState(profile?.title ?? '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
    setWhatsapp(profile?.whatsapp ?? '');
    setTitle(profile?.title ?? '');
  }, [profile]);

  const onPhoto = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const url = await uploadAgentAvatar(user.id, file);
      await updateProfile(user.id, { avatar_url: url });
      await refreshProfile();
      toast('Foto actualizada');
    } catch {
      toast('No se pudo subir la foto', 'error');
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSavingProfile(true);
    try {
      await updateProfile(user.id, {
        full_name: fullName.trim() || null,
        phone: phone || null,
        whatsapp: whatsapp || null,
        title: title.trim() || null,
      });
      await refreshProfile();
      toast('Perfil actualizado');
    } catch {
      toast('No se pudo actualizar el perfil', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!user?.email) return;
    if (next.length < 8) return setPwError('La nueva contraseña debe tener al menos 8 caracteres.');
    if (passwordStrength(next).score < 2) return setPwError('Usa una contraseña más segura.');
    if (next !== confirm) return setPwError('Las contraseñas no coinciden.');
    setSavingPw(true);
    try {
      await reauthenticate(user.email, current);
      await updatePassword(next);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast('Contraseña actualizada');
    } catch (err) {
      setPwError((err as Error).message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <>
      <PageHeader title="Mi cuenta" subtitle="Datos de acceso y seguridad." />
      <div style={{ display: 'grid', gap: 20, maxWidth: 760 }}>
        <Panel title="Perfil">
          <form onSubmit={saveProfile} className="form-grid">
            <div className="span-full" style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Avatar name={fullName || user?.email} src={profile?.avatar_url} size={72} />
              <div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <span className="spinner spinner--sm" /> : <Camera />} Cambiar foto
                </button>
                <p className="field__hint" style={{ margin: '6px 0 0' }}>
                  Tu foto, nombre, teléfono y WhatsApp aparecen en el detalle de tus propiedades.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPhoto(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <div className="field">
              <label htmlFor="name">Nombre</label>
              <input id="name" className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="title">Puesto</label>
              <input id="title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Asesor inmobiliario" />
            </div>
            <div className="field">
              <label htmlFor="phone">Teléfono</label>
              <input id="phone" className="input" inputMode="tel" value={phone} onChange={(e) => setPhone(onlyDigits(e.target.value).slice(0, 13))} />
            </div>
            <div className="field">
              <label htmlFor="wa">WhatsApp</label>
              <input id="wa" className="input" inputMode="tel" value={whatsapp} onChange={(e) => setWhatsapp(onlyDigits(e.target.value).slice(0, 13))} />
            </div>
            <div className="field">
              <label>Correo</label>
              <input className="input" value={user?.email ?? ''} disabled />
            </div>
            <div className="field">
              <label>Rol</label>
              <input className="input" value={profile?.role === 'admin' ? 'Administrador' : 'Asesor'} disabled />
            </div>
            <div className="field">
              <label>Miembro desde</label>
              <input className="input" value={formatDate(profile?.created_at)} disabled />
            </div>
            <div className="span-full">
              <button className="btn btn--primary" disabled={savingProfile}>
                {savingProfile ? <span className="spinner spinner--sm spinner--light" /> : 'Guardar perfil'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel title="Cambiar contraseña">
          <form onSubmit={savePassword} className="form-grid">
            {pwError && <div className="alert alert--error span-full">{pwError}</div>}
            <div className="field span-full">
              <label htmlFor="cur">Contraseña actual</label>
              <PasswordInput id="cur" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="new">Nueva contraseña</label>
              <PasswordInput id="new" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} showStrength />
            </div>
            <div className="field">
              <label htmlFor="conf">Confirmar nueva contraseña</label>
              <PasswordInput id="conf" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <div className="span-full">
              <button className="btn btn--primary" disabled={savingPw || !current || !next}>
                {savingPw ? <span className="spinner spinner--sm spinner--light" /> : 'Actualizar contraseña'}
              </button>
            </div>
          </form>
        </Panel>
      </div>
    </>
  );
}
