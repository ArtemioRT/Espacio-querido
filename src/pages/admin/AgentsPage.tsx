import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Camera, KeyRound, Mail, Pencil, Phone, Plus, Search, Trash2, UserPlus, Users } from 'lucide-react';
import { ConfirmDialog, Modal, PageHeader, Panel } from '@/components/admin/AdminUI';
import PasswordInput from '@/components/auth/PasswordInput';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import {
  createAgent, deleteAgent, getAgentsOverview, sendAgentResetLink, setAgentPassword, updateAgent, uploadAgentAvatar,
} from '@/services/agents.service';
import { PATHS } from '@/app/paths';
import { cx, formatDate, isValidEmail, onlyDigits, timeAgo } from '@/utils/format';
import type { AgentOverview } from '@/types';
import styles from './AgentsPage.module.scss';

type Role = 'agent' | 'admin';

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  title: string;
  role: Role;
  mode: 'invite' | 'password';
  password: string;
}

const EMPTY: FormValues = {
  full_name: '',
  email: '',
  phone: '',
  whatsapp: '',
  title: 'Asesor inmobiliario',
  role: 'agent',
  mode: 'invite',
  password: '',
};

export default function AgentsPage() {
  useDocumentTitle('Asesores');
  const toast = useToast();
  const { user } = useAuth();

  const [agents, setAgents] = useState<AgentOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormValues>(EMPTY);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<AgentOverview | null>(null);
  const [editValues, setEditValues] = useState<FormValues>(EMPTY);
  const [newPassword, setNewPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [toDelete, setToDelete] = useState<AgentOverview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAgents(await getAgentsOverview());
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = agents.filter((a) => {
    if (!showInactive && !a.active) return false;
    const t = search.trim().toLowerCase();
    if (!t) return true;
    return [a.full_name, a.email, a.phone].some((v) => v?.toLowerCase().includes(t));
  });

  const set = (k: keyof FormValues, v: string) =>
    setForm((f) => ({ ...f, [k]: k === 'phone' || k === 'whatsapp' ? onlyDigits(v).slice(0, 13) : v }));
  const setEdit = (k: keyof FormValues, v: string) =>
    setEditValues((f) => ({ ...f, [k]: k === 'phone' || k === 'whatsapp' ? onlyDigits(v).slice(0, 13) : v }));

  // ---------- Crear ----------
  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (form.full_name.trim().length < 3) return setFormError('Escribe el nombre completo.');
    if (!isValidEmail(form.email)) return setFormError('Correo no válido.');
    if (form.mode === 'password' && form.password.length < 8) return setFormError('La contraseña debe tener al menos 8 caracteres.');
    setSaving(true);
    try {
      await createAgent({
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        phone: form.phone,
        whatsapp: form.whatsapp || form.phone,
        title: form.title,
        role: form.role,
        mode: form.mode,
        password: form.mode === 'password' ? form.password : undefined,
      });
      toast(form.mode === 'invite' ? `Invitación enviada a ${form.email}` : 'Asesor creado');
      setCreateOpen(false);
      setForm(EMPTY);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // ---------- Editar ----------
  const openEdit = (a: AgentOverview) => {
    setEditing(a);
    setNewPassword('');
    setEditValues({
      ...EMPTY,
      full_name: a.full_name ?? '',
      email: a.email ?? '',
      phone: a.phone ?? '',
      whatsapp: a.whatsapp ?? '',
      title: a.title ?? '',
      role: a.role === 'admin' ? 'admin' : 'agent',
    });
  };

  const isSelf = editing?.id === user?.id;

  const onSaveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      await updateAgent(editing.id, {
        full_name: editValues.full_name.trim() || null,
        phone: editValues.phone || null,
        whatsapp: editValues.whatsapp || null,
        title: editValues.title.trim() || null,
        ...(isSelf ? {} : { role: editValues.role }),
      });
      if (newPassword) {
        if (newPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
        await setAgentPassword(editing.id, newPassword);
      }
      toast('Asesor actualizado');
      setEditing(null);
      load();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (file: File) => {
    if (!editing) return;
    setUploading(true);
    try {
      const url = await uploadAgentAvatar(editing.id, file);
      await updateAgent(editing.id, { avatar_url: url });
      setEditing({ ...editing, avatar_url: url });
      setAgents((list) => list.map((a) => (a.id === editing.id ? { ...a, avatar_url: url } : a)));
      toast('Foto actualizada');
    } catch (err) {
      toast((err as Error).message || 'No se pudo subir la foto', 'error');
    } finally {
      setUploading(false);
    }
  };

  const toggleActive = async (a: AgentOverview) => {
    if (a.id === user?.id) return toast('No puedes desactivar tu propia cuenta', 'error');
    try {
      await updateAgent(a.id, { active: !a.active });
      toast(a.active ? `${a.full_name} ya no puede entrar al panel` : `${a.full_name} reactivado`);
      load();
    } catch {
      toast('No se pudo actualizar', 'error');
    }
  };

  const sendReset = async (a: AgentOverview) => {
    if (!a.email) return;
    try {
      await sendAgentResetLink(a.email);
      toast(`Enlace de contraseña enviado a ${a.email}`);
    } catch {
      toast('No se pudo enviar el enlace', 'error');
    }
  };

  const onDelete = async () => {
    if (!toDelete) return;
    setSaving(true);
    try {
      await deleteAgent(toDelete.id);
      toast('Asesor eliminado. Sus propiedades quedaron sin asignar.');
      setToDelete(null);
      setEditing(null);
      load();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Asesores"
        subtitle="Da de alta a tu equipo. Los asesores solo pueden subir, editar y cambiar el estado de las propiedades que tienen asignadas."
        actions={
          <button className="btn btn--primary" onClick={() => setCreateOpen(true)}>
            <UserPlus /> Nuevo asesor
          </button>
        }
      />

      <Panel padded={false}>
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Search />
            <input className="input" placeholder="Buscar por nombre, correo o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
            Mostrar desactivados
          </label>
        </div>

        {loading ? (
          <div className="page-loader" style={{ minHeight: 240 }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <Users />
            <h3>Sin asesores</h3>
            <p>Agrega a tu primer asesor para asignarle propiedades.</p>
          </div>
        ) : (
          <ul className={styles.grid}>
            {filtered.map((a) => (
              <li key={a.id} className={cx(styles.card, !a.active && styles.inactive)}>
                <div className={styles.cardHead}>
                  <Avatar name={a.full_name} src={a.avatar_url} size={56} />
                  <div className={styles.who}>
                    <strong>{a.full_name || a.email}</strong>
                    <span>{a.title || (a.role === 'admin' ? 'Administrador' : 'Asesor')}</span>
                    <div className={styles.badges}>
                      <span className={cx('badge badge--plain', a.role === 'admin' ? 'badge--primary' : 'badge--muted')}>
                        {a.role === 'admin' ? 'Administrador' : 'Asesor'}
                      </span>
                      {!a.active && <span className="badge badge--danger">Desactivado</span>}
                      {a.id === user?.id && <span className="badge badge--info badge--plain">Tú</span>}
                    </div>
                  </div>
                  <button className={styles.editBtn} onClick={() => openEdit(a)} aria-label="Editar">
                    <Pencil />
                  </button>
                </div>

                <div className={styles.contact}>
                  {a.email && (
                    <a href={`mailto:${a.email}`}>
                      <Mail /> {a.email}
                    </a>
                  )}
                  {a.phone && (
                    <a href={`tel:${a.phone}`}>
                      <Phone /> {a.phone}
                    </a>
                  )}
                </div>

                <div className={styles.stats}>
                  <div>
                    <strong>{a.active_count}</strong>
                    <span>Activas</span>
                  </div>
                  <div>
                    <strong>{a.draft_count}</strong>
                    <span>Borrador</span>
                  </div>
                  <div>
                    <strong>{a.paused_count}</strong>
                    <span>En pausa</span>
                  </div>
                  <div>
                    <strong>{a.finished_count}</strong>
                    <span>Finalizadas</span>
                  </div>
                  <div>
                    <strong>{a.leads_count}</strong>
                    <span>Leads</span>
                  </div>
                </div>

                <div className={styles.foot}>
                  <small>{a.last_sign_in_at ? `Último acceso ${timeAgo(a.last_sign_in_at)}` : 'Aún no ha entrado'}</small>
                  <Link to={`${PATHS.admin.properties}?agent=${a.id}`} className={styles.link}>
                    Ver propiedades
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {/* ---------- Alta ---------- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Nuevo asesor"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setCreateOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn--primary" form="agent-create" disabled={saving}>
              {saving ? <span className="spinner spinner--sm spinner--light" /> : <Plus />} Crear asesor
            </button>
          </>
        }
      >
        <form id="agent-create" onSubmit={onCreate} className="form-grid" noValidate>
          {formError && <div className="alert alert--error span-full">{formError}</div>}
          <div className="field span-full">
            <label htmlFor="a-name">Nombre completo *</label>
            <input id="a-name" className="input" value={form.full_name} onChange={(e) => set('full_name', e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="a-email">Correo (usuario de acceso) *</label>
            <input id="a-email" type="email" className="input" value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-title">Puesto</label>
            <input id="a-title" className="input" value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-phone">Teléfono (llamadas)</label>
            <input id="a-phone" className="input" inputMode="tel" placeholder="10 dígitos" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="a-wa">WhatsApp</label>
            <input id="a-wa" className="input" inputMode="tel" placeholder="Igual al teléfono si se deja vacío" value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} />
          </div>
          <div className="field span-full">
            <label>Rol</label>
            <div className={styles.choice}>
              <label className={cx(form.role === 'agent' && styles.choiceOn)}>
                <input type="radio" checked={form.role === 'agent'} onChange={() => set('role', 'agent')} />
                <div>
                  <strong>Asesor</strong>
                  <span>Sube, edita y cambia el estado de sus propiedades asignadas</span>
                </div>
              </label>
              <label className={cx(form.role === 'admin' && styles.choiceOn)}>
                <input type="radio" checked={form.role === 'admin'} onChange={() => set('role', 'admin')} />
                <div>
                  <strong>Administrador</strong>
                  <span>Acceso total: leads, analítica, asesores y EasyBroker</span>
                </div>
              </label>
            </div>
          </div>
          <div className="field span-full">
            <label>Acceso</label>
            <div className={styles.choice}>
              <label className={cx(form.mode === 'invite' && styles.choiceOn)}>
                <input type="radio" checked={form.mode === 'invite'} onChange={() => set('mode', 'invite')} />
                <div>
                  <strong>Enviar invitación por correo</strong>
                  <span>El asesor crea su propia contraseña desde el enlace</span>
                </div>
              </label>
              <label className={cx(form.mode === 'password' && styles.choiceOn)}>
                <input type="radio" checked={form.mode === 'password'} onChange={() => set('mode', 'password')} />
                <div>
                  <strong>Definir contraseña ahora</strong>
                  <span>Tú se la compartes; puede cambiarla en "Mi cuenta"</span>
                </div>
              </label>
            </div>
          </div>
          {form.mode === 'password' && (
            <div className="field span-full">
              <label htmlFor="a-pw">Contraseña *</label>
              <PasswordInput id="a-pw" autoComplete="new-password" value={form.password} onChange={(e) => set('password', e.target.value)} showStrength />
            </div>
          )}
        </form>
      </Modal>

      {/* ---------- Edición ---------- */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar asesor"
        footer={
          <>
            {!isSelf && (
              <button className="btn btn--ghost" style={{ marginRight: 'auto', color: '#cf3a2f' }} onClick={() => editing && setToDelete(editing)}>
                <Trash2 /> Eliminar
              </button>
            )}
            <button className="btn btn--ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="btn btn--primary" onClick={onSaveEdit} disabled={saving}>
              {saving ? <span className="spinner spinner--sm spinner--light" /> : 'Guardar'}
            </button>
          </>
        }
      >
        {editing && (
          <div className="form-grid">
            <div className={cx('span-full', styles.photoRow)}>
              <Avatar name={editValues.full_name} src={editing.avatar_url} size={84} />
              <div>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading ? <span className="spinner spinner--sm" /> : <Camera />} Cambiar foto
                </button>
                <p className="field__hint">Se muestra en el detalle de sus propiedades. Ideal: cuadrada, 400×400 px.</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAvatar(f);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
            <div className="field span-full">
              <label htmlFor="e-name">Nombre completo</label>
              <input id="e-name" className="input" value={editValues.full_name} onChange={(e) => setEdit('full_name', e.target.value)} />
            </div>
            <div className="field">
              <label>Correo</label>
              <input className="input" value={editValues.email} disabled />
            </div>
            <div className="field">
              <label htmlFor="e-title">Puesto</label>
              <input id="e-title" className="input" value={editValues.title} onChange={(e) => setEdit('title', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-phone">Teléfono</label>
              <input id="e-phone" className="input" inputMode="tel" value={editValues.phone} onChange={(e) => setEdit('phone', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-wa">WhatsApp</label>
              <input id="e-wa" className="input" inputMode="tel" value={editValues.whatsapp} onChange={(e) => setEdit('whatsapp', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="e-role">Rol</label>
              <select id="e-role" className="select" value={editValues.role} onChange={(e) => setEdit('role', e.target.value)} disabled={isSelf}>
                <option value="agent">Asesor</option>
                <option value="admin">Administrador</option>
              </select>
              {isSelf && <span className="field__hint">No puedes cambiar tu propio rol.</span>}
            </div>
            <div className="field">
              <label>Acceso al panel</label>
              <button type="button" className={cx('btn btn--sm', editing.active ? 'btn--ghost' : 'btn--primary')} onClick={() => toggleActive(editing).then(() => setEditing(null))} disabled={isSelf}>
                {editing.active ? 'Desactivar cuenta' : 'Reactivar cuenta'}
              </button>
            </div>

            <div className={cx('span-full', styles.security)}>
              <strong>
                <KeyRound /> Contraseña
              </strong>
              <div className={styles.securityRow}>
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => sendReset(editing)}>
                  <Mail /> Enviar enlace para restablecer
                </button>
                <span className="text-muted" style={{ fontSize: 12 }}>
                  o asigna una nueva:
                </span>
              </div>
              <PasswordInput autoComplete="new-password" placeholder="Nueva contraseña (opcional)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} showStrength />
            </div>

            <p className="field__hint span-full">
              Alta: {formatDate(editing.created_at)} · {editing.active_count + editing.draft_count + editing.finished_count + editing.paused_count} propiedades asignadas
            </p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar asesor"
        message={
          <>
            ¿Eliminar a <strong>{toDelete?.full_name}</strong>? Perderá el acceso y sus {(toDelete?.active_count ?? 0) + (toDelete?.draft_count ?? 0) + (toDelete?.finished_count ?? 0) + (toDelete?.paused_count ?? 0)} propiedades quedarán
            sin asignar. Si solo quieres quitarle el acceso, mejor <em>desactiva</em> su cuenta.
          </>
        }
        confirmLabel="Eliminar"
        danger
        loading={saving}
        onConfirm={onDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
