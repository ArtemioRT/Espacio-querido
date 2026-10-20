import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckSquare, RefreshCw, Square, XCircle } from 'lucide-react';
import { Modal } from './AdminUI';
import Pagination from '@/components/ui/Pagination';
import {
  importEasyBrokerProperties, listAllEasyBrokerIds, listEasyBrokerProperties, type EbStatus, type ImportStatus,
} from '@/services/easybroker.service';

/** Filtros por estado de EasyBroker */
const EB_FILTERS: Array<{ value: string; label: string; statuses: EbStatus[]; suggest?: ImportStatus }> = [
  { value: 'all', label: 'Todas', statuses: [] },
  { value: 'published', label: 'Publicadas (activas)', statuses: ['published'], suggest: 'active' },
  { value: 'inactive', label: 'Inactivas (no publicadas y suspendidas)', statuses: ['not_published', 'suspended'], suggest: 'paused' },
  { value: 'not_published', label: 'No publicadas', statuses: ['not_published'], suggest: 'paused' },
  { value: 'suspended', label: 'Suspendidas', statuses: ['suspended'], suggest: 'paused' },
  { value: 'reserved', label: 'Reservadas', statuses: ['reserved'], suggest: 'draft' },
  { value: 'closed', label: 'Vendidas o rentadas', statuses: ['sold', 'rented'], suggest: 'finished' },
  { value: 'sold', label: 'Vendidas', statuses: ['sold'], suggest: 'finished' },
  { value: 'rented', label: 'Rentadas', statuses: ['rented'], suggest: 'finished' },
];
import { listAssignableAgents } from '@/services/agents.service';
import { cx } from '@/utils/format';
import { STATUS_LABELS } from '@/utils/constants';
import type { AgentRef, EasyBrokerImportResult, EasyBrokerListItem } from '@/types';
import styles from './EasyBrokerImportModal.module.scss';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

export default function EasyBrokerImportModal({ open, onClose, onImported }: Props) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<EasyBrokerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<ImportStatus>('draft');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<EasyBrokerImportResult[] | null>(null);
  const [agents, setAgents] = useState<AgentRef[]>([]);
  const [agentId, setAgentId] = useState<string>('auto');
  const [ebFilter, setEbFilter] = useState('all');
  const filterDef = EB_FILTERS.find((f) => f.value === ebFilter) ?? EB_FILTERS[0];
  // Selección masiva (todas las páginas)
  const [allIds, setAllIds] = useState<Array<{ public_id: string; imported: boolean }> | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const cancelRef = useRef(false);

  useEffect(() => {
    if (open && !agents.length) listAssignableAgents().then(setAgents).catch(() => {});
  }, [open, agents.length]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await listEasyBrokerProperties(page, filterDef.statuses);
      setItems(res.items);
      setTotal(res.pagination.total ?? res.items.length);
      setLimit(res.pagination.limit ?? 20);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, ebFilter]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setResults(null);
      setAllIds(null);
      setProgress(null);
    }
  }, [open]);

  /** Trae los IDs de todas las páginas (una sola vez) y selecciona según el filtro */
  const selectAll = async (onlyNew: boolean) => {
    setError('');
    let ids = allIds;
    if (!ids) {
      setLoadingAll(true);
      try {
        ids = await listAllEasyBrokerIds(filterDef.statuses);
        setAllIds(ids);
      } catch (err) {
        setError((err as Error).message);
        return;
      } finally {
        setLoadingAll(false);
      }
    }
    setSelected(new Set(ids.filter((i) => !onlyNew || !i.imported).map((i) => i.public_id)));
  };

  const pendingCount = allIds?.filter((i) => !i.imported).length;

  // Cambiar el filtro reinicia página, selección y lista completa; sugiere cómo importarlas
  const changeFilter = (value: string) => {
    setEbFilter(value);
    setPage(1);
    setSelected(new Set());
    setAllIds(null);
    setResults(null);
    setProgress(null);
    const def = EB_FILTERS.find((f) => f.value === value);
    if (def?.suggest) setStatus(def.suggest);
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const allOnPage = items.length > 0 && items.every((i) => selected.has(i.public_id));
  const toggleAll = () =>
    setSelected((s) => {
      const n = new Set(s);
      items.forEach((i) => (allOnPage ? n.delete(i.public_id) : n.add(i.public_id)));
      return n;
    });

  const BATCH = 10;

  const runImport = async () => {
    const ids = [...selected];
    setImporting(true);
    setError('');
    setResults(null);
    cancelRef.current = false;
    setProgress({ done: 0, total: ids.length });
    const all: EasyBrokerImportResult[] = [];
    try {
      for (let i = 0; i < ids.length; i += BATCH) {
        if (cancelRef.current) break;
        const chunk = ids.slice(i, i + BATCH);
        try {
          const { results } = await importEasyBrokerProperties(chunk, status, agentId);
          all.push(...results);
        } catch (err) {
          // Un lote fallido no detiene el resto
          all.push(...chunk.map((public_id) => ({ public_id, ok: false, error: (err as Error).message })));
        }
        setProgress({ done: Math.min(i + BATCH, ids.length), total: ids.length });
        setResults([...all]);
      }
      const okIds = new Set(all.filter((r) => r.ok).map((r) => r.public_id));
      setSelected((s) => new Set([...s].filter((id) => !okIds.has(id))));
      setAllIds((list) => list?.map((x) => (okIds.has(x.public_id) ? { ...x, imported: true } : x)) ?? null);
      onImported();
      load();
    } finally {
      setImporting(false);
    }
  };

  const okCount = results?.filter((r) => r.ok).length ?? 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Importar desde EasyBroker"
      size="lg"
      footer={
        <>
          <div className={styles.footLeft}>
            <label className="field__label" htmlFor="eb-status">
              Importar como
            </label>
            <select id="eb-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as ImportStatus)}>
              <option value="draft">Borrador</option>
              <option value="active">Activo (publicar)</option>
              <option value="paused">En pausa</option>
              <option value="finished">Finalizado (vendida / rentada)</option>
            </select>
            <select className="select" value={agentId} onChange={(e) => setAgentId(e.target.value)} aria-label="Asignar a">
              <option value="auto">Asesor: automático (por correo)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  Asignar a {a.full_name}
                </option>
              ))}
            </select>
          </div>
          {importing ? (
            <button className="btn btn--ghost" onClick={() => (cancelRef.current = true)}>
              Detener
            </button>
          ) : (
            <button className="btn btn--ghost" onClick={onClose}>
              Cerrar
            </button>
          )}
          <button className="btn btn--primary" onClick={runImport} disabled={!selected.size || importing}>
            {importing ? <span className="spinner spinner--sm spinner--light" /> : `Importar ${selected.size ? selected.size.toLocaleString('es-MX') : ''}`}
          </button>
        </>
      }
    >
      <p className={styles.help}>
        Selecciona las propiedades de tu cuenta de EasyBroker. Si una ya fue importada, se actualizarán sus datos y fotos sin cambiar su estado.
        En modo automático, cada propiedad se asigna al asesor cuyo correo coincide con el agente de EasyBroker.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      {progress && (
        <div className={styles.progress}>
          <div className={styles.progressBar}>
            <span style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
          </div>
          <small>
            {importing
              ? `Importando ${progress.done.toLocaleString('es-MX')} de ${progress.total.toLocaleString('es-MX')}… puedes dejar esta ventana abierta`
              : `Proceso terminado: ${progress.done.toLocaleString('es-MX')} de ${progress.total.toLocaleString('es-MX')}`}
          </small>
        </div>
      )}

      {results && !importing && (
        <div className={cx('alert', okCount === results.length ? 'alert--success' : 'alert--info')} style={{ marginBottom: 14 }}>
          {okCount.toLocaleString('es-MX')} de {results.length.toLocaleString('es-MX')} propiedades importadas correctamente.
          {results
            .filter((r) => !r.ok)
            .slice(0, 20)
            .map((r) => (
              <div key={r.public_id} style={{ marginTop: 4 }}>
                <XCircle style={{ width: 13, height: 13, verticalAlign: -2 }} /> {r.public_id}: {r.error}
              </div>
            ))}
        </div>
      )}

      <div className={styles.filterRow}>
        <label className="field__label" htmlFor="eb-filter">
          Estado en EasyBroker
        </label>
        <select id="eb-filter" className="select" value={ebFilter} onChange={(e) => changeFilter(e.target.value)} disabled={importing}>
          {EB_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        {filterDef.suggest && <small className="text-muted">Sugerencia aplicada: importar como “{STATUS_LABELS[filterDef.suggest]}”.</small>}
      </div>

      <div className={styles.toolbar}>
        <label className="checkbox">
          <input type="checkbox" checked={allOnPage} onChange={toggleAll} disabled={!items.length || importing} />
          Seleccionar página
        </label>
        <button className="btn btn--ghost btn--sm" onClick={() => selectAll(false)} disabled={loadingAll || importing || !total}>
          {loadingAll ? <span className="spinner spinner--sm" /> : <CheckSquare />} Seleccionar todas ({total.toLocaleString('es-MX')})
        </button>
        <button className="btn btn--ghost btn--sm" onClick={() => selectAll(true)} disabled={loadingAll || importing || !total}>
          Solo no importadas{pendingCount !== undefined ? ` (${pendingCount.toLocaleString('es-MX')})` : ''}
        </button>
        {selected.size > 0 && (
          <button className="btn btn--ghost btn--sm" onClick={() => setSelected(new Set())} disabled={importing}>
            <Square /> Quitar selección
          </button>
        )}
        <span className="text-muted" style={{ fontSize: 12 }}>
          {selected.size ? `${selected.size.toLocaleString('es-MX')} seleccionadas · ` : ''}
          {total.toLocaleString('es-MX')} {ebFilter === 'all' ? 'en EasyBroker' : `${filterDef.label.toLowerCase()} en EasyBroker`}
        </span>
        <button className="btn btn--ghost btn--sm" onClick={load} disabled={loading}>
          <RefreshCw /> Actualizar
        </button>
      </div>

      {loading ? (
        <div className="page-loader" style={{ minHeight: 220 }}>
          <div className="spinner" />
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((i) => (
            <li key={i.public_id} className={cx(selected.has(i.public_id) && styles.selected)}>
              <label>
                <input type="checkbox" checked={selected.has(i.public_id)} onChange={() => toggle(i.public_id)} />
                {i.thumbnail ? <img src={i.thumbnail} alt="" /> : <span className={styles.noImg} />}
                <div className={styles.info}>
                  <strong>{i.title}</strong>
                  <span>
                    {i.public_id} · {i.property_type} · {i.location}
                  </span>
                  {i.agent && <span>Agente EB: {i.agent}</span>}
                </div>
                <div className={styles.meta}>
                  {i.price && <strong>{i.price}</strong>}
                  {i.imported && (
                    <span className="badge badge--success">Importada</span>
                  )}
                </div>
              </label>
            </li>
          ))}
          {!items.length && !error && <li className="text-muted" style={{ padding: 20, textAlign: 'center' }}>No hay propiedades.</li>}
        </ul>
      )}

      <Pagination page={page} total={total} pageSize={limit} onChange={setPage} />
    </Modal>
  );
}
