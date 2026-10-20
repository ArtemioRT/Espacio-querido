import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, XCircle } from 'lucide-react';
import { Modal } from './AdminUI';
import Pagination from '@/components/ui/Pagination';
import { importEasyBrokerProperties, listEasyBrokerProperties } from '@/services/easybroker.service';
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
    }
  }, [open]);

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

  const runImport = async () => {
    setImporting(true);
    setError('');
    try {
      const { results } = await importEasyBrokerProperties([...selected], status, agentId);
      setResults(results);
      setSelected(new Set());
      onImported();
      load();
    } catch (err) {
      setError((err as Error).message);
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
          <button className="btn btn--ghost" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn btn--primary" onClick={runImport} disabled={!selected.size || importing}>
            {importing ? <span className="spinner spinner--sm spinner--light" /> : `Importar ${selected.size || ''}`}
          </button>
        </>
      }
    >
      <p className={styles.help}>
        Selecciona las propiedades de tu cuenta de EasyBroker. Si una ya fue importada, se actualizarán sus datos y fotos sin cambiar su estado.
        En modo automático, cada propiedad se asigna al asesor cuyo correo coincide con el agente de EasyBroker.
      </p>

      {error && <div className="alert alert--error">{error}</div>}

      {results && (
        <div className={cx('alert', okCount === results.length ? 'alert--success' : 'alert--info')} style={{ marginBottom: 14 }}>
          {okCount} de {results.length} propiedades importadas correctamente.
          {results
            .filter((r) => !r.ok)
            .map((r) => (
              <div key={r.public_id} style={{ marginTop: 4 }}>
                <XCircle style={{ width: 13, height: 13, verticalAlign: -2 }} /> {r.public_id}: {r.error}
              </div>
            ))}
        </div>
      )}

      <div className={styles.toolbar}>
        <label className="checkbox">
          <input type="checkbox" checked={allOnPage} onChange={toggleAll} disabled={!items.length} />
          Seleccionar página
        </label>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {total} propiedades en EasyBroker
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
