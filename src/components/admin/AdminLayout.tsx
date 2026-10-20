import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Building2, ExternalLink, Inbox, LayoutDashboard, LogOut, Menu, UserCircle, Users, X } from 'lucide-react';
import { PATHS } from '@/app/paths';
import { useAuth } from '@/context/AuthContext';
import { countNewLeads } from '@/services/leads.service';
import { useLockBody } from '@/hooks/useLockBody';
import { IMAGES } from '@/utils/content';
import { cx } from '@/utils/format';
import styles from './AdminLayout.module.scss';

export default function AdminLayout() {
  const { profile, user, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [newLeads, setNewLeads] = useState(0);

  useLockBody(open);
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (isAdmin) countNewLeads().then(setNewLeads).catch(() => {});
  }, [location.pathname, isAdmin]);

  const nav = [
    { to: PATHS.admin.dashboard, label: 'Dashboard', icon: LayoutDashboard, end: true, adminOnly: true },
    { to: PATHS.admin.leads, label: 'Leads', icon: Inbox, badge: newLeads, adminOnly: true },
    { to: PATHS.admin.properties, label: isAdmin ? 'Propiedades' : 'Mis propiedades', icon: Building2 },
    { to: PATHS.admin.agents, label: 'Asesores', icon: Users, adminOnly: true },
    { to: PATHS.admin.account, label: 'Mi cuenta', icon: UserCircle },
  ].filter((n) => isAdmin || !n.adminOnly);

  const logout = async () => {
    await signOut();
    navigate(PATHS.admin.login, { replace: true });
  };

  const name = profile?.full_name || user?.email || '';

  return (
    <div className={styles.shell}>
      <aside className={cx(styles.sidebar, open && styles.open)}>
        <div className={styles.brand}>
          <img src={IMAGES.logoWhite} alt="Espacio Querido" />
          <button className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Cerrar menú">
            <X />
          </button>
        </div>
        <nav className={styles.nav}>
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => cx(styles.link, isActive && styles.active)}>
              <n.icon />
              <span>{n.label}</span>
              {!!n.badge && <em>{n.badge > 99 ? '99+' : n.badge}</em>}
            </NavLink>
          ))}
        </nav>
        <div className={styles.sideFooter}>
          <Link to={PATHS.home} target="_blank" className={styles.link}>
            <ExternalLink />
            <span>Ver sitio</span>
          </Link>
          <button className={styles.link} onClick={logout}>
            <LogOut />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      <div className={styles.content}>
        <header className={styles.topbar}>
          <button className={styles.burger} onClick={() => setOpen(true)} aria-label="Abrir menú">
            <Menu />
          </button>
          <div className={styles.user}>
            <div className={styles.avatar}>
              {profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : name.charAt(0).toUpperCase()}
            </div>
            <div className={styles.userText}>
              <strong>{name}</strong>
              <span>{profile?.role === 'admin' ? 'Administrador' : 'Asesor'}</span>
            </div>
          </div>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
