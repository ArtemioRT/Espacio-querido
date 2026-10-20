import { useCallback, useEffect, useState } from 'react';
import { Download, Inbox, Mail, MessageCircle, Phone, Search, Trash2 } from 'lucide-react';
import { ConfirmDialog, Modal, PageHeader, Panel } from '@/components/admin/AdminUI';
import Pagination from '@/components/ui/Pagination';
import { deleteLead, listAllLeadsForExport, listLeads, updateLead, type LeadFilters } from '@/services/leads.service';
import { listAssignableAgents } from '@/services/agents.service';
import { useToast } from '@/context/ToastContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { propertyUrl } from '@/app/paths';
import { LEAD_INTEREST_LABELS, LEAD_STATUS_BADGE, LEAD_STATUS_LABELS } from '@/utils/constants';
import { cx, downloadFile, formatDate, toCsv } from '@/utils/format';
import type { AgentRef, Lead, LeadInterest, LeadStatus } from '@/types';
import styles from './LeadsPage.module.scss';

const PAGE_SIZE = 20;

export default function LeadsPage() {
  useDocumentTitle('Leads');
  const toast = useToast();
  const [filters, setFilters] = useState<LeadFilters>({ status: 'all', interest: 'all', agent: 'all', page: 1 });
  const [agents, setAgents] = useState<AgentRef[]>([]);
  useEffect(() => {
    listAssignableAgents().then(setAgents).catch(() => {});
  }, []);
  const [search, setSearch] = useState('');
  const q = useDebounce(search, 400);
  const [rows, setRows] = useState<Lead[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notes, setNotes] = useState('');
  const [toDelete, setToDelete] = useState<Lead | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLeads({ ...filters, q, pageSize: PAGE_SIZE });
      setRows(res.data);
      setCount(res.count);
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filters, q, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setFilters((f) => (f.page === 1 ? f : { ...f, page: 1 }));
  }, [q]);

  const changeStatus = async (lead: Lead, status: LeadStatus) => {
    setRows((r) => r.map((x) => (x.id === lead.id ? { ...x, status } : x)));
    if (selected?.id === lead.id) setSelected({ ...lead, status });
    try {
      await updateLead(lead.id, { status });
    } catch {
      toast('No se pudo actualizar el estado', 'error');
      load();
    }
  };

  const openLead = (l: Lead) => {
    setSelected(l);
    setNotes(l.notes ?? '');
  };

  const saveNotes = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await updateLead(selected.id, { notes });
      setRows((r) => r.map((x) => (x.id === selected.id ? { ...x, notes } : x)));
      toast('Notas guardadas');
      setSelected(null);
    } catch {
      toast('No se pudieron guardar las notas', 'error');
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteLead(toDelete.id);
      toast('Lead eliminado');
      setToDelete(null);
      setSelected(null);
      load();
    } catch {
      toast('No se pudo eliminar', 'error');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await listAllLeadsForExport({ status: filters.status, interest: filters.interest, agent: filters.agent, q });
      const csv = toCsv(
        all.map((l) => ({
          Fecha: formatDate(l.created_at, true),
          Nombre: l.name,
          Correo: l.email,
          Teléfono: l.phone,
          Interés: LEAD_INTEREST_LABELS[l.interest],
          Propiedad: l.property ? `${l.property.code} · ${l.property.title}` : '',
          Asesor: l.agent?.full_name ?? '',
          Estado: LEAD_STATUS_LABELS[l.status],
          Mensaje: l.message ?? '',
          Notas: l.notes ?? '',
          Fuente: l.utm_source || l.referrer || 'Directo',
          Campaña: l.utm_campaign ?? '',
        })),
      );
      downloadFile(csv, `leads-espacio-querido-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      toast('No se pudo exportar', 'error');
    } finally {
      setExporting(false);
    }
  };

  const waLink = (l: Lead) => {
    const digits = l.phone.replace(/\D/g, '');
    const intl = digits.length === 10 ? `52${digits}` : digits;
    return `https://wa.me/${intl}?text=${encodeURIComponent(`Hola ${l.name.split(' ')[0]}, te contacto de Espacio Querido.`)}`;
  };

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${count} contactos recibidos desde tu sitio web`}
        actions={
          <button className="btn btn--ghost" onClick={exportCsv} disabled={exporting || !count}>
            {exporting ? <span className="spinner spinner--sm" /> : <Download />} Exportar CSV
          </button>
        }
      />

      <Panel padded={false}>
        <div className={styles.filters}>
          <div className={styles.search}>
            <Search />
            <input className="input" placeholder="Buscar por nombre, correo o teléfono" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="select" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as LeadFilters['status'], page: 1 }))} aria-label="Estado">
            <option value="all">Todos los estados</option>
            {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select" value={filters.interest} onChange={(e) => setFilters((f) => ({ ...f, interest: e.target.value as LeadFilters['interest'], page: 1 }))} aria-label="Interés">
            <option value="all">Todos los intereses</option>
            {Object.entries(LEAD_INTEREST_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select className="select" value={filters.agent} onChange={(e) => setFilters((f) => ({ ...f, agent: e.target.value, page: 1 }))} aria-label="Asesor">
            <option value="all">Todos los asesores</option>
            <option value="none">Sin asignar</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="page-loader" style={{ minHeight: 240 }}>
            <div className="spinner" />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <Inbox />
            <h3>Sin leads</h3>
            <p>Cuando alguien llene un formulario en tu sitio aparecerá aquí.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className={cx('table', styles.table)}>
              <thead>
                <tr>
                  <th>Contacto</th>
                  <th>Interés</th>
                  <th>Propiedad</th>
                  <th>Asesor</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className={cx(l.status === 'new' && styles.unread)}>
                    <td>
                      <button className={styles.nameBtn} onClick={() => openLead(l)}>
                        <strong>{l.name}</strong>
                        <span>{l.email}</span>
                        <span>{l.phone}</span>
                      </button>
                    </td>
                    <td>{LEAD_INTEREST_LABELS[l.interest]}</td>
                    <td className={styles.propCol}>
                      {l.property ? (
                        <a href={propertyUrl(l.property.slug)} target="_blank" rel="noreferrer">
                          {l.property.title}
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{l.agent?.full_name ?? <span className="text-muted">—</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(l.created_at, true)}</td>
                    <td>
                      <select className={cx('select', styles.statusSelect)} value={l.status} onChange={(e) => changeStatus(l, e.target.value as LeadStatus)} aria-label="Estado del lead">
                        {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <a href={waLink(l)} target="_blank" rel="noreferrer" title="WhatsApp">
                          <MessageCircle />
                        </a>
                        <a href={`tel:${l.phone}`} title="Llamar">
                          <Phone />
                        </a>
                        <a href={`mailto:${l.email}`} title="Correo">
                          <Mail />
                        </a>
                        <button onClick={() => setToDelete(l)} title="Eliminar">
                          <Trash2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Pagination page={filters.page ?? 1} total={count} pageSize={PAGE_SIZE} onChange={(page) => setFilters((f) => ({ ...f, page }))} />

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title="Detalle del lead"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => selected && setToDelete(selected)}>
              <Trash2 /> Eliminar
            </button>
            <button className="btn btn--primary" onClick={saveNotes} disabled={busy}>
              Guardar
            </button>
          </>
        }
      >
        {selected && (
          <div className={styles.detail}>
            <div className={styles.detailHead}>
              <div>
                <h3>{selected.name}</h3>
                <span className={cx('badge', LEAD_STATUS_BADGE[selected.status])}>{LEAD_STATUS_LABELS[selected.status]}</span>
              </div>
              <div className={styles.quick}>
                <a className="btn btn--sm btn--ghost" href={waLink(selected)} target="_blank" rel="noreferrer">
                  <MessageCircle /> WhatsApp
                </a>
                <a className="btn btn--sm btn--ghost" href={`tel:${selected.phone}`}>
                  <Phone /> Llamar
                </a>
              </div>
            </div>

            <dl className={styles.dl}>
              <dt>Correo</dt>
              <dd>
                <a href={`mailto:${selected.email}`}>{selected.email}</a>
              </dd>
              <dt>Teléfono</dt>
              <dd>{selected.phone}</dd>
              <dt>Interés</dt>
              <dd>{LEAD_INTEREST_LABELS[selected.interest as LeadInterest]}</dd>
              {selected.property && (
                <>
                  <dt>Propiedad</dt>
                  <dd>
                    <a href={propertyUrl(selected.property.slug)} target="_blank" rel="noreferrer">
                      {selected.property.title}
                    </a>
                  </dd>
                </>
              )}
              <dt>Asesor</dt>
              <dd>{selected.agent?.full_name ?? 'Sin asignar'}</dd>
              <dt>Recibido</dt>
              <dd>{formatDate(selected.created_at, true)}</dd>
              <dt>Origen</dt>
              <dd>
                {selected.utm_source ? `${selected.utm_source} / ${selected.utm_medium ?? '—'}` : selected.referrer || 'Directo'}
                {selected.utm_campaign && ` · ${selected.utm_campaign}`}
              </dd>
              {selected.page_url && (
                <>
                  <dt>Página</dt>
                  <dd className={styles.url}>{selected.page_url}</dd>
                </>
              )}
            </dl>

            {selected.message && (
              <div className={styles.message}>
                <span>Mensaje</span>
                <p>{selected.message}</p>
              </div>
            )}

            <div className="field">
              <label>Estado</label>
              <select className="select" value={selected.status} onChange={(e) => changeStatus(selected, e.target.value as LeadStatus)}>
                {Object.entries(LEAD_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="lead-notes">Notas internas</label>
              <textarea id="lead-notes" className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seguimiento, presupuesto, horarios de contacto…" />
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar lead"
        message={`¿Seguro que quieres eliminar a ${toDelete?.name}? Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        loading={busy}
        onConfirm={confirmDelete}
        onCancel={() => setToDelete(null)}
      />
    </>
  );
}
