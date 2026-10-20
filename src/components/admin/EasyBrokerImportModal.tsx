import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckSquare, RefreshCw, Square, XCircle } from 'lucide-react';
import { Modal } from './AdminUI';
import Pagination from '@/components/ui/Pagination';
import { importEasyBrokerProperties, listAllEasyBrokerIds, listEasyBrokerProperties } from '@/services/easybroker.service';
import { listAssignableAgents } from '@/services/agents.service';
import { cx } from '@/utils/format';
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
  const [status, setStatus] = useState<'draft' | 'active'>('draft');
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<EasyBrokerImportResult[] | null>(null);
  const [agents, setAgents] = useState<AgentRef[]>([]);
  const [agentId, setAgentId] = useState<string>('auto');
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
      const res = await listEasyBrokerProperties(page);
      setItems(res.items);
      setTotal(res.pagination.total ?? res.items.length);
      setLimit(res.pagination.limit ?? 20);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page]);

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
        ids = await listAllEasyBrokerIds();
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
            <select id="eb-status" className="select" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'active')}>
              <option value="draft">Borrador</option>
              <option value="active">Activo (publicar)</option>
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
          {total.toLocaleString('es-MX')} en EasyBroker
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
