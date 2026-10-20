import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Building2, ChevronDown, Copy, Download, ExternalLink, Eye, Pencil, Plus, Search, Star, Trash2,
} from 'lucide-react';
import { ConfirmDialog, PageHeader, Panel, Tabs } from '@/components/admin/AdminUI';
import EasyBrokerImportModal from '@/components/admin/EasyBrokerImportModal';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import {
  assignAgent, deleteProperty, duplicateProperty, getStatusCounts, listAdminProperties, toggleFeatured, updatePropertyStatus,
} from '@/services/properties.service';
import { listAssignableAgents } from '@/services/agents.service';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PATHS, editPropertyUrl, propertyUrl } from '@/app/paths';
import { OPERATION_LABELS, PROPERTY_TYPE_LABELS, STATUS_LABELS } from '@/utils/constants';
import { IMAGES } from '@/utils/content';
import { cx, formatDate, formatNumber, formatPrice, locationLabel } from '@/utils/format';
import type { AgentRef, Property, PropertyStatus } from '@/types';
import styles from './AdminPropertiesPage.module.scss';

type TabValue = PropertyStatus | 'all';
const PAGE_SIZE = 15;

export default function AdminPropertiesPage() {
  useDocumentTitle('Propiedades');
  const toast = useToast();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const agentFilter = (isAdmin && searchParams.get('agent')) || 'all';
  const [agents, setAgents] = useState<AgentRef[]>([]);

  useEffect(() => {
    if (isAdmin) listAssignableAgents().then(setAgents).catch(() => {});
  }, [isAdmin]);

  const setAgentFilter = (v: string) => {
    const next = new URLSearchParams(searchParams);
    if (v === 'all') next.delete('agent');
    else next.set('agent', v);
    setSearchParams(next, { replace: true });
  };

  const [tab, setTab] = useState<TabValue>('all');
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 400);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Property[]>([]);
  const [count, setCount] = useState(0);
  const [counts, setCounts] = useState<Record<TabValue, number>>({ all: 0, active: 0, draft: 0, finished: 0, paused: 0 });
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Property | null>(null);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, c] = await Promise.all([
        listAdminProperties({ status: tab, q, page, pageSize: PAGE_SIZE, agent: agentFilter }),
        getStatusCounts(agentFilter),
      ]);
      setRows(list.data);
      setCount(list.count);
      setCounts(c);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, q, page, agentFilter, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => setPage(1), [tab, q, agentFilter]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const changeStatus = async (p: Property, status: PropertyStatus) => {
    try {
      await updatePropertyStatus(p.id, status);
      toast(`"${p.title}" ahora está en ${STATUS_LABELS[status]}`);
      load();
    } catch {
      toast('No se pudo cambiar el estado', 'error');
    }
  };

  const onAssign = async (p: Property, agentId: string) => {
    const agent = agents.find((a) => a.id === agentId) ?? null;
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, agent_id: agentId || null, agent } : x)));
    try {
      await assignAgent(p.id, agentId || null);
      toast(agent ? `Asignada a ${agent.full_name}` : 'Propiedad sin asignar');
    } catch {
      toast('No se pudo asignar', 'error');
      load();
    }
  };

  const onFeatured = async (p: Property) => {
    setRows((r) => r.map((x) => (x.id === p.id ? { ...x, featured: !p.featured } : x)));
    try {
      await toggleFeatured(p.id, !p.featured);
    } catch {
      toast('No se pudo actualizar', 'error');
      load();
    }
  };

  const onDuplicate = async (p: Property) => {
    try {
      const copy = await duplicateProperty(p.id);
      toast('Propiedad duplicada como borrador');
      navigate(editPropertyUrl(copy.id));
    } catch {
      toast('No se pudo duplicar', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteProperty(toDelete.id);
      toast('Propiedad eliminada');
      setToDelete(null);
      load();
    } catch {
      toast('No se pudo eliminar', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title={isAdmin ? 'Propiedades' : 'Mis propiedades'}
        subtitle={
          isAdmin
            ? 'Administra tu inventario: activas, borradores y finalizadas (vendidas o rentadas).'
            : 'Propiedades asignadas a ti. Puedes subir nuevas, editarlas y cambiar su estado.'
        }
        actions={
          !isAdmin ? (
            <Link to={PATHS.admin.newProperty} className="btn btn--primary">
              <Plus /> Subir propiedad
            </Link>
          ) : (
          <div className={styles.uploadWrap} ref={menuRef}>
            <button className="btn btn--primary" onClick={() => setMenuOpen((v) => !v)} aria-expanded={menuOpen}>
              <Plus /> Subir propiedad <ChevronDown />
            </button>
            {menuOpen && (
              <div className={styles.menu}>
                <Link to={PATHS.admin.newProperty} onClick={() => setMenuOpen(false)}>
                  <Pencil />
                  <div>
                    <strong>Captura manual</strong>
                    <span>Llena el formulario y sube fotos</span>
                  </div>
                </Link>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    setImportOpen(true);
                  }}
                >
                  <Download />
                  <div>
                    <strong>Importar de EasyBroker</strong>
                    <span>Trae propiedades con fotos y datos</span>
                  </div>
                </button>
              </div>
            )}
          </div>
          )
        }
      />

      <Panel padded={false}>
        <Tabs<TabValue>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'Todas', count: counts.all },
            { value: 'active', label: 'Activo', count: counts.active },
            { value: 'draft', label: 'Borrador', count: counts.draft },
            { value: 'finished', label: 'Finalizado', count: counts.finished },
            { value: 'paused', label: 'En pausa', count: counts.paused },
          ]}
        />
        <div className={styles.toolbar}>
          <div className={styles.search}>
            <Search />
            <input className="input" placeholder="Buscar por título, colonia, ciudad, ID o ID de EasyBroker" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isAdmin && (
            <select className={cx('select', styles.agentFilter)} value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} aria-label="Filtrar por asesor">
              <option value="all">Todos los asesores</option>
              <option value="none">Sin asignar</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.full_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="page-loader" style={{ minHeight: 260 }}>
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Building2 />
            <h3>No hay propiedades {tab !== 'all' ? `en ${STATUS_LABELS[tab as PropertyStatus]}` : ''}</h3>
            <p>{isAdmin ? 'Sube tu primera propiedad manualmente o impórtala desde EasyBroker.' : 'Sube una propiedad o pide al administrador que te asigne una.'}</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {rows.map((p) => (
              <li key={p.id} className={styles.row}>
                <Link to={editPropertyUrl(p.id)} className={styles.thumb}>
                  <img src={p.cover_image_url || IMAGES.placeholder} alt="" loading="lazy" />
                </Link>
                <div className={styles.info}>
                  <div className={styles.titleRow}>
                    <Link to={editPropertyUrl(p.id)} className={styles.title}>
                      {p.title}
                    </Link>
                    {p.source === 'easybroker' && <span className="badge badge--info badge--plain">EasyBroker</span>}
                  </div>
                  <span className={styles.sub}>
                    {OPERATION_LABELS[p.operation_type]} · {PROPERTY_TYPE_LABELS[p.property_type]}
                    {locationLabel(p) && ` · ${locationLabel(p)}`}
                  </span>
                  <span className={styles.meta}>
                    <span className={styles.code}>ID {p.code}</span>
                    <strong>{formatPrice(p.price, p.currency, p.operation_type)}</strong>
                    <span>
                      <Eye /> {formatNumber(p.views_count)}
                    </span>
                    <span>Actualizada {formatDate(p.updated_at)}</span>
                  </span>
                  {isAdmin && (
                    <span className={styles.agentRow}>
                      <Avatar name={p.agent?.full_name ?? '—'} src={p.agent?.avatar_url} size={22} />
                      <select className={styles.assign} value={p.agent_id ?? ''} onChange={(e) => onAssign(p, e.target.value)} aria-label="Asesor asignado">
                        <option value="">Sin asignar</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.full_name}
                          </option>
                        ))}
                        {p.agent && !agents.some((a) => a.id === p.agent_id) && <option value={p.agent_id ?? ''}>{p.agent.full_name} (inactivo)</option>}
                      </select>
                    </span>
                  )}
                </div>
                <div className={styles.controls}>
                  <select
                    className={cx('select', styles.statusSelect, styles[`status_${p.status}`])}
                    value={p.status}
                    onChange={(e) => changeStatus(p, e.target.value as PropertyStatus)}
                    aria-label="Estado"
                  >
                    <option value="active">Activo</option>
                    <option value="draft">Borrador</option>
                    <option value="finished">Finalizado ({p.operation_type === 'sale' ? 'vendida' : 'rentada'})</option>
                    <option value="paused">En pausa</option>
                  </select>
                  <div className={styles.actions}>
                    {isAdmin && (
                      <button onClick={() => onFeatured(p)} title={p.featured ? 'Quitar de destacadas' : 'Destacar en inicio'} className={cx(p.featured && styles.starred)}>
                        <Star />
                      </button>
                    )}
                    {p.status !== 'draft' && (
                      <a href={propertyUrl(p.slug)} target="_blank" rel="noreferrer" title="Ver en el sitio">
                        <ExternalLink />
                      </a>
                    )}
                    <Link to={editPropertyUrl(p.id)} title="Editar">
                      <Pencil />
                    </Link>
                    <button onClick={() => onDuplicate(p)} title="Duplicar">
                      <Copy />
                    </button>
                    {isAdmin && (
                      <button onClick={() => setToDelete(p)} title="Eliminar">
                        <Trash2 />
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Pagination page={page} total={count} pageSize={PAGE_SIZE} onChange={setPage} />

      <EasyBrokerImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar propiedad"
        message={
          <>
            ¿Eliminar <strong>{toDelete?.title}</strong> y todas sus fotos? Si solo se vendió o rentó, mejor cámbiala a <em>Finalizado</em> para conservar el historial.
          </>
        }
        confirmLabel="Eliminar"
        danger
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
