import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Activity, Clock, Eye, Home, MousePointerClick, RefreshCw, Search, TrendingDown, UserCheck, Users,
} from 'lucide-react';
import { PageHeader, Panel, StatCard } from '@/components/admin/AdminUI';
import { getDashboardStats } from '@/services/analytics.service';
import { getRecentLeads } from '@/services/leads.service';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { PATHS, propertyUrl } from '@/app/paths';
import { EVENT_LABELS, LEAD_INTEREST_LABELS, LEAD_STATUS_BADGE, LEAD_STATUS_LABELS } from '@/utils/constants';
import { cx, formatDuration, formatNumber, timeAgo } from '@/utils/format';
import type { DashboardStats, Lead, LeadInterest, LeadStatus } from '@/types';
import styles from './DashboardPage.module.scss';

const RANGES = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '90 días' },
];

const PRIMARY = '#9b1b3a';
const NEUTRAL = '#9a9a9a';

const DEVICE_LABELS: Record<string, string> = { mobile: 'Móvil', desktop: 'Escritorio', tablet: 'Tablet' };

function BarList({ items, format = (n: number) => formatNumber(n) }: { items: Array<{ label: string; value: number }>; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const total = items.reduce((a, b) => a + b.value, 0) || 1;
  if (!items.length) return <p className={styles.empty}>Sin datos en este periodo.</p>;
  return (
    <ul className={styles.barList}>
      {items.map((i) => (
        <li key={i.label}>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(i.value / max) * 100}%` }} />
            <span className={styles.barLabel}>{i.label}</span>
          </div>
          <span className={styles.barValue}>
            {format(i.value)} <small>{Math.round((i.value / total) * 100)}%</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recent, setRecent] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    from.setHours(0, 0, 0, 0);
    try {
      const [s, r] = await Promise.all([getDashboardStats(from, new Date(to.getTime() + 1)), getRecentLeads(6)]);
      setStats(s);
      setRecent(r);
    } catch (err) {
      setError((err as Error).message || 'No se pudieron cargar las métricas.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    load();
  }, [load]);

  const daily = useMemo(
    () =>
      (stats?.daily ?? []).map((d) => ({
        ...d,
        label: new Date(`${d.date}T12:00:00`).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }),
      })),
    [stats],
  );

  const t = stats?.totals;
  const conversion = t && t.sessions ? ((t.leads / t.sessions) * 100).toFixed(1) : '0.0';

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Visitas, permanencia, clics y leads de tu sitio web."
        actions={
          <>
            <div className={styles.range} role="group" aria-label="Periodo">
              {RANGES.map((r) => (
                <button key={r.days} className={cx(days === r.days && styles.rangeActive)} onClick={() => setDays(r.days)}>
                  {r.label}
                </button>
              ))}
            </div>
            <button className="btn btn--ghost btn--icon" onClick={load} aria-label="Actualizar" disabled={loading}>
              <RefreshCw />
            </button>
          </>
        }
      />

      {error && (
        <div className="alert alert--error" style={{ marginBottom: 20 }}>
          {error}. Verifica que ejecutaste <code>supabase/schema.sql</code> y que tu usuario tenga rol de administrador.
        </div>
      )}

      {t && (
        <div className={styles.liveBar}>
          <span className={styles.dot} /> <strong>{t.active_now}</strong> {t.active_now === 1 ? 'visitante' : 'visitantes'} en el sitio ahora mismo
        </div>
      )}

      <div className={cx(styles.stats, loading && styles.loading)}>
        <StatCard icon={Users} label="Visitas (sesiones)" value={formatNumber(t?.sessions)} tone="primary" />
        <StatCard icon={UserCheck} label="Visitantes únicos" value={formatNumber(t?.visitors)} />
        <StatCard icon={Eye} label="Páginas vistas" value={formatNumber(t?.page_views)} hint={t?.sessions ? `${(t.page_views / t.sessions).toFixed(1)} por visita` : undefined} />
        <StatCard icon={Clock} label="Tiempo promedio" value={formatDuration(t?.avg_duration ?? 0)} tone="info" />
        <StatCard icon={TrendingDown} label="Tasa de rebote" value={`${t?.bounce_rate ?? 0}%`} hint="Visitas de una sola página" />
        <StatCard icon={Activity} label="Leads" value={formatNumber(t?.leads)} tone="success" hint={`Conversión ${conversion}%`} />
        <StatCard icon={MousePointerClick} label="Clics registrados" value={formatNumber(t?.clicks)} tone="warning" />
        <StatCard icon={Home} label="Vistas de propiedades" value={formatNumber(t?.property_views)} hint={`${formatNumber(t?.searches)} búsquedas`} />
      </div>

      <Panel title="Tráfico y leads por día" className={styles.chartPanel}>
        <div className={styles.legend}>
          <span><i style={{ background: PRIMARY }} /> Visitas</span>
          <span><i style={{ background: NEUTRAL }} /> Leads</span>
        </div>
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="gSessions" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PRIMARY} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={PRIMARY} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#888' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: 8, border: '1px solid #eee', fontSize: 12 }}
                formatter={(v: number, name: string) => [formatNumber(v), name === 'sessions' ? 'Visitas' : 'Leads']}
              />
              <Area type="monotone" dataKey="sessions" stroke={PRIMARY} strokeWidth={2} fill="url(#gSessions)" />
              <Area type="monotone" dataKey="leads" stroke={NEUTRAL} strokeWidth={2} fill="transparent" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <div className={styles.grid3}>
        <Panel title="Fuentes de tráfico">
          <BarList items={(stats?.sources ?? []).map((s) => ({ label: s.name, value: s.sessions ?? 0 }))} />
        </Panel>
        <Panel title="Dispositivos">
          <BarList items={(stats?.devices ?? []).map((s) => ({ label: DEVICE_LABELS[s.name] ?? s.name, value: s.sessions ?? 0 }))} />
        </Panel>
        <Panel title="Clics por tipo">
          <BarList items={(stats?.clicks_by_type ?? []).map((s) => ({ label: EVENT_LABELS[s.name] ?? s.name, value: s.total ?? 0 }))} />
        </Panel>
      </div>

      <div className={styles.grid2}>
        <Panel title="Propiedades más vistas" padded={false} action={<Link to={PATHS.admin.properties} className={styles.more}>Ver todas</Link>}>
          {stats?.top_properties.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Propiedad</th>
                    <th style={{ textAlign: 'right' }}>Vistas</th>
                    <th style={{ textAlign: 'right' }}>Leads</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_properties.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <a href={propertyUrl(p.slug)} target="_blank" rel="noreferrer" className={styles.propCell}>
                          {p.cover_image_url ? <img src={p.cover_image_url} alt="" /> : <span />}
                          {p.title}
                        </a>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(p.views)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(p.leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty} style={{ padding: 20 }}>Sin vistas de propiedades en este periodo.</p>
          )}
        </Panel>

        <Panel title="Páginas más visitadas" padded={false}>
          {stats?.top_pages.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Página</th>
                    <th style={{ textAlign: 'right' }}>Vistas</th>
                    <th style={{ textAlign: 'right' }}>Sesiones</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_pages.map((p) => (
                    <tr key={p.path}>
                      <td className={styles.path}>{p.path || '/'}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(p.views)}</td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(p.sessions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty} style={{ padding: 20 }}>Sin datos.</p>
          )}
        </Panel>
      </div>

      <div className={styles.grid3}>
        <Panel title="Leads por interés">
          <BarList
            items={(stats?.leads_by_interest ?? []).map((s) => ({ label: LEAD_INTEREST_LABELS[s.name as LeadInterest] ?? s.name, value: s.total ?? 0 }))}
          />
        </Panel>
        <Panel title="Leads por asesor">
          <BarList items={(stats?.leads_by_agent ?? []).map((s) => ({ label: s.name, value: s.total ?? 0 }))} />
        </Panel>
        <Panel title="Leads por fuente">
          <BarList items={(stats?.leads_by_source ?? []).map((s) => ({ label: s.name, value: s.total ?? 0 }))} />
        </Panel>
        <Panel title="Búsquedas frecuentes">
          {stats?.top_searches.length ? (
            <ul className={styles.searches}>
              {stats.top_searches.map((s) => (
                <li key={s.term}>
                  <Search /> <span>{s.term}</span> <strong>{s.total}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>Aún no hay búsquedas con texto.</p>
          )}
        </Panel>
      </div>

      <div className={styles.grid2}>
        <Panel title="Botones con más clics" padded={false}>
          {stats?.top_clicks.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Elemento</th>
                    <th>Tipo</th>
                    <th style={{ textAlign: 'right' }}>Clics</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.top_clicks.map((c) => (
                    <tr key={c.label + c.event_type}>
                      <td>{c.label}</td>
                      <td>
                        <span className="badge badge--muted badge--plain">{EVENT_LABELS[c.event_type] ?? c.event_type}</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>{formatNumber(c.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className={styles.empty} style={{ padding: 20 }}>Sin clics registrados.</p>
          )}
        </Panel>

        <Panel title="Leads recientes" padded={false} action={<Link to={PATHS.admin.leads} className={styles.more}>Ver todos</Link>}>
          {recent.length ? (
            <ul className={styles.recent}>
              {recent.map((l) => (
                <li key={l.id}>
                  <div className={styles.recentAvatar}>{l.name.charAt(0).toUpperCase()}</div>
                  <div className={styles.recentText}>
                    <strong>{l.name}</strong>
                    <span>
                      {LEAD_INTEREST_LABELS[l.interest]}
                      {l.property ? ` · ${l.property.title}` : ''}
                    </span>
                  </div>
                  <div className={styles.recentMeta}>
                    <span className={cx('badge', LEAD_STATUS_BADGE[l.status as LeadStatus])}>{LEAD_STATUS_LABELS[l.status as LeadStatus]}</span>
                    <small>{timeAgo(l.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty} style={{ padding: 20 }}>Todavía no hay leads.</p>
          )}
        </Panel>
      </div>
    </>
  );
}
