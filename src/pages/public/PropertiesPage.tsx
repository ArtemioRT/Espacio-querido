import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchX, SlidersHorizontal, X } from 'lucide-react';
import PropertyCard, { PropertyCardSkeleton } from '@/components/properties/PropertyCard';
import PropertyFilters from '@/components/properties/PropertyFilters';
import Pagination from '@/components/ui/Pagination';
import {
  facetNames, getLocationSuggestions, getLocationTree, searchProperties, type LocationTree, type PropertySearchFilters, type SortOption,
} from '@/services/properties.service';
import { trackEvent } from '@/services/analytics.service';
import { getPublicAgent } from '@/services/agents.service';
import Avatar from '@/components/ui/Avatar';
import { useSeo } from '@/hooks/useSeo';
import Breadcrumbs from '@/components/ui/Breadcrumbs';
import { breadcrumbLd, itemListLd } from '@/utils/seo';
import { propertyUrl } from '@/app/paths';
import { useLockBody } from '@/hooks/useLockBody';
import { OPERATION_LABELS, PAGE_SIZE, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { catalogPath, facetCrumbs, facetHeading, parseCatalogPath, slugify, type CatalogFacet } from '@/utils/catalog';
import { cx, formatNumber } from '@/utils/format';
import type { OperationType, Property, PropertyType, PublicAgent } from '@/types';
import styles from './PropertiesPage.module.scss';

const num = (v: string | null) => (v && Number(v) > 0 ? Number(v) : undefined);

/** Filtros de zona salen de la ruta; el resto, de la query (?minPrice=…) */
function parseFilters(facet: CatalogFacet, sp: URLSearchParams): PropertySearchFilters {
  return {
    ...facet,
    q: sp.get('q') || undefined,
    minPrice: num(sp.get('minPrice')),
    maxPrice: num(sp.get('maxPrice')),
    bedrooms: num(sp.get('bedrooms')),
    bathrooms: num(sp.get('bathrooms')),
    parking: num(sp.get('parking')),
    minM2: num(sp.get('minM2')),
    maxM2: num(sp.get('maxM2')),
    minLand: num(sp.get('minLand')),
    maxLand: num(sp.get('maxLand')),
    amenities: sp.get('amenities')?.split(',').filter(Boolean) ?? [],
    agent: sp.get('agent') || undefined,
    sort: (sp.get('sort') as SortOption) || 'recent',
    page: num(sp.get('page')) ?? 1,
  };
}

const FACET_KEYS = ['operation', 'type', 'state', 'city', 'neighborhood'] as const;

/** URL completa (ruta por zona + query de los demás filtros) */
export function filtersToUrl(f: PropertySearchFilters): string {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if ((FACET_KEYS as readonly string[]).includes(k)) return;
    if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return;
    if (k === 'sort' && v === 'recent') return;
    if (k === 'page' && v === 1) return;
    p.set(k, Array.isArray(v) ? v.join(',') : String(v));
  });
  const path = catalogPath({ operation: f.operation || undefined, type: f.type || undefined, state: f.state, city: f.city, neighborhood: f.neighborhood });
  return `${path}${p.toString() ? `?${p}` : ''}`;
}

/** Enlaces antiguos /propiedades?operation=sale&state=Nuevo%20León → ruta por zona */
function legacyRedirect(pathname: string, sp: URLSearchParams): string | null {
  if (pathname !== '/propiedades') return null;
  if (!FACET_KEYS.some((k) => sp.get(k))) return null;
  const op = sp.get('operation');
  const type = sp.get('type');
  const facet: CatalogFacet = {
    operation: op === 'sale' || op === 'rent' ? (op as OperationType) : undefined,
    type: type && type in PROPERTY_TYPE_LABELS ? (type as PropertyType) : undefined,
    state: sp.get('state') ? slugify(sp.get('state')) : undefined,
    city: sp.get('city') ? slugify(sp.get('city')) : undefined,
    neighborhood: sp.get('neighborhood') ? slugify(sp.get('neighborhood')) : undefined,
  };
  const rest = new URLSearchParams(sp);
  FACET_KEYS.forEach((k) => rest.delete(k));
  return `${catalogPath(facet)}${rest.toString() ? `?${rest}` : ''}`;
}

export default function PropertiesPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const facet = useMemo<CatalogFacet>(() => parseCatalogPath(location.pathname) ?? {}, [location.pathname]);
  const filters = useMemo(() => parseFilters(facet, searchParams), [facet, searchParams]);
  const redirect = legacyRedirect(location.pathname, searchParams);

  const [items, setItems] = useState<Property[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawer, setDrawer] = useState(false);
  const [locations, setLocations] = useState<Array<{ label: string; kind: string }>>([]);
  const [agent, setAgent] = useState<PublicAgent | null>(null);
  const [tree, setTree] = useState<LocationTree>({});

  useEffect(() => {
    getLocationTree().then(setTree);
  }, []);

  useEffect(() => {
    if (filters.agent) getPublicAgent(filters.agent).then(setAgent);
    else setAgent(null);
  }, [filters.agent]);

  // ---------- SEO ----------
  const names = facetNames(tree, facet);
  const heading = agent ? `Propiedades de ${agent.full_name}` : facetHeading(facet, names);
  const crumbs = facetCrumbs(facet, names);
  // La ruta por zona es indexable; combinaciones con precio, medidas, texto libre, etc. no
  const hasNonIndexable = [...searchParams.keys()].some((k) => k !== 'page' && k !== 'sort');
  const page = filters.page ?? 1;

  useSeo({
    title: page > 1 ? `${heading} – página ${page}` : heading,
    description: `${heading}. ${count ? `${count} opciones disponibles` : 'Catálogo actualizado'} con fotos, precios y asesoría de Espacio Querido.`,
    canonical: `${catalogPath(facet)}${page > 1 ? `?page=${page}` : ''}`,
    noindex: hasNonIndexable || (!loading && count === 0),
    jsonLd: [breadcrumbLd(crumbs), ...(items.length ? [itemListLd(items, (p) => propertyUrl(p.slug))] : [])],
  });
  useLockBody(drawer);

  useEffect(() => {
    getLocationSuggestions().then(setLocations);
  }, []);

  useEffect(() => {
    if (redirect) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    searchProperties(filters)
      .then(({ data, count }) => {
        if (cancelled) return;
        setItems(data);
        setCount(count);
      })
      .catch(() => !cancelled && setError('No pudimos cargar las propiedades. Intenta de nuevo.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [filters, redirect]);

  // Registro de búsquedas para el panel (solo cuando cambian los criterios, no la página)
  const searchKey = useMemo(() => {
    const { page: _p, sort: _s, ...rest } = filters;
    return JSON.stringify(rest);
  }, [filters]);
  useEffect(() => {
    const t = setTimeout(() => {
      const { page: _p, sort: _s, ...rest } = filters;
      const hasCriteria = Object.values(rest).some((v) => (Array.isArray(v) ? v.length : v !== undefined));
      if (hasCriteria) trackEvent('search', { label: filters.q ?? null, metadata: { ...rest } });
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchKey]);

  const update = useCallback(
    (patch: Partial<PropertySearchFilters>) => {
      const next = { ...filters, ...patch };
      if (!('page' in patch)) next.page = 1;
      navigate(filtersToUrl(next), { replace: true });
    },
    [filters, navigate],
  );

  const clear = () => navigate('/propiedades', { replace: true });

  const goToPage = (p: number) => {
    update({ page: p });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Sub-zonas con propiedades (enlaces internos, buenos para SEO)
  const subzones = useMemo(() => {
    const st = facet.state ? tree[facet.state] : undefined;
    if (!facet.state) return Object.entries(tree).map(([slug, n]) => ({ slug, name: n.name, total: n.total, to: catalogPath({ ...facet, state: slug }) }));
    if (st && !facet.city)
      return Object.entries(st.cities).map(([slug, n]) => ({ slug, name: n.name, total: n.total, to: catalogPath({ ...facet, city: slug }) }));
    const ct = st && facet.city ? st.cities[facet.city] : undefined;
    if (ct && !facet.neighborhood) return ct.neighborhoods.map((n) => ({ ...n, to: catalogPath({ ...facet, neighborhood: n.slug }) }));
    return [];
  }, [tree, facet]);

  // Chips de filtros activos
  const activeChips: Array<{ key: string; label: string; remove: () => void }> = [];
  if (filters.agent) activeChips.push({ key: 'agent', label: `Asesor: ${agent?.full_name ?? '…'}`, remove: () => update({ agent: undefined }) });
  if (filters.q) activeChips.push({ key: 'q', label: `“${filters.q}”`, remove: () => update({ q: undefined }) });
  if (filters.operation) activeChips.push({ key: 'op', label: OPERATION_LABELS[filters.operation], remove: () => update({ operation: undefined }) });
  if (filters.type) activeChips.push({ key: 'type', label: PROPERTY_TYPE_LABELS[filters.type], remove: () => update({ type: undefined }) });
  if (filters.minPrice) activeChips.push({ key: 'min', label: `Desde $${formatNumber(filters.minPrice)}`, remove: () => update({ minPrice: undefined }) });
  if (filters.maxPrice) activeChips.push({ key: 'max', label: `Hasta $${formatNumber(filters.maxPrice)}`, remove: () => update({ maxPrice: undefined }) });
  if (filters.bedrooms) activeChips.push({ key: 'bed', label: `${filters.bedrooms}+ recámaras`, remove: () => update({ bedrooms: undefined }) });
  if (filters.bathrooms) activeChips.push({ key: 'bath', label: `${filters.bathrooms}+ baños`, remove: () => update({ bathrooms: undefined }) });
  if (filters.parking) activeChips.push({ key: 'park', label: `${filters.parking}+ estac.`, remove: () => update({ parking: undefined }) });
  if (filters.state) activeChips.push({ key: 'state', label: names.state ?? filters.state, remove: () => update({ state: undefined, city: undefined, neighborhood: undefined }) });
  if (filters.city) activeChips.push({ key: 'city', label: names.city ?? filters.city, remove: () => update({ city: undefined, neighborhood: undefined }) });
  if (filters.neighborhood) activeChips.push({ key: 'col', label: names.neighborhood ?? filters.neighborhood, remove: () => update({ neighborhood: undefined }) });
  const rangeLabel = (min?: number, max?: number, unit = 'm²') =>
    min && max ? `${formatNumber(min)}–${formatNumber(max)} ${unit}` : min ? `Desde ${formatNumber(min)} ${unit}` : `Hasta ${formatNumber(max)} ${unit}`;
  if (filters.minM2 || filters.maxM2)
    activeChips.push({ key: 'm2', label: `Construcción ${rangeLabel(filters.minM2, filters.maxM2)}`, remove: () => update({ minM2: undefined, maxM2: undefined }) });
  if (filters.minLand || filters.maxLand)
    activeChips.push({ key: 'land', label: `Terreno ${rangeLabel(filters.minLand, filters.maxLand)}`, remove: () => update({ minLand: undefined, maxLand: undefined }) });
  filters.amenities?.forEach((a) =>
    activeChips.push({ key: `a-${a}`, label: a, remove: () => update({ amenities: filters.amenities!.filter((x) => x !== a) }) }),
  );

  if (redirect) return <Navigate to={redirect} replace />;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className="container">
          <Breadcrumbs items={crumbs} light />
          {agent ? (
            <div className={styles.agentHead}>
              <Avatar name={agent.full_name} src={agent.avatar_url} size={64} />
              <div>
                <h1>Propiedades de {agent.full_name}</h1>
                <p>{agent.title || 'Asesor inmobiliario'} · {agent.properties_count} propiedades activas</p>
              </div>
            </div>
          ) : (
            <>
              <h1>{heading}</h1>
              <p>Casas, departamentos, terrenos y locales seleccionados por nuestros asesores.</p>
            </>
          )}
        </div>
      </div>

      <div className={cx('container', styles.layout)}>
        <aside className={cx(styles.sidebar, drawer && styles.sidebarOpen)} aria-label="Filtros">
          <div className={styles.drawerHead}>
            <strong>Filtros</strong>
            <button onClick={() => setDrawer(false)} aria-label="Cerrar filtros">
              <X />
            </button>
          </div>
          <div className={styles.drawerBody}>
            <PropertyFilters value={filters} onChange={update} onClear={clear} locations={locations} tree={tree} />
          </div>
          <div className={styles.drawerFoot}>
            <button className="btn btn--primary btn--block" onClick={() => setDrawer(false)}>
              Ver {formatNumber(count)} resultados
            </button>
          </div>
        </aside>
        {drawer && <div className={styles.backdrop} onClick={() => setDrawer(false)} />}

        <section className={styles.results}>
          <div className={styles.toolbar}>
            <button className={cx('btn btn--ghost btn--sm', styles.filterBtn)} onClick={() => setDrawer(true)}>
              <SlidersHorizontal /> Filtros {activeChips.length > 0 && `(${activeChips.length})`}
            </button>
            <span className={styles.count}>
              {loading ? 'Buscando…' : `${formatNumber(count)} ${count === 1 ? 'propiedad' : 'propiedades'}`}
            </span>
            <select className={cx('select', styles.sort)} value={filters.sort} onChange={(e) => update({ sort: e.target.value as SortOption })} aria-label="Ordenar">
              <option value="recent">Más recientes</option>
              <option value="price_asc">Menor precio</option>
              <option value="price_desc">Mayor precio</option>
              <option value="size_desc">Mayor construcción</option>
            </select>
          </div>

          {activeChips.length > 0 && (
            <div className={styles.chips}>
              {activeChips.map((c) => (
                <button key={c.key} className={styles.chip} onClick={c.remove}>
                  {c.label} <X />
                </button>
              ))}
              <button className={styles.clearAll} onClick={clear}>
                Limpiar todo
              </button>
            </div>
          )}

          {error && <div className="alert alert--error">{error}</div>}

          <div className={styles.grid}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <PropertyCardSkeleton key={i} />)
              : items.map((p) => <PropertyCard key={p.id} property={p} />)}
          </div>

          {!loading && !error && items.length === 0 && (
            <div className="empty-state">
              <SearchX />
              <h3>No encontramos propiedades</h3>
              <p>Prueba ajustando los filtros o déjanos tus datos y te ayudamos a encontrarla.</p>
              <button className="btn btn--outline" onClick={clear}>
                Limpiar filtros
              </button>
            </div>
          )}

          <Pagination page={filters.page ?? 1} total={count} pageSize={PAGE_SIZE} onChange={goToPage} />

          {subzones.length > 0 && (
            <nav className={styles.zones} aria-label="Buscar por zona">
              <h2>{facet.city ? 'Colonias' : facet.state ? 'Municipios' : 'Estados'} con propiedades</h2>
              <ul>
                {subzones.map((z) => (
                  <li key={z.slug}>
                    <Link to={z.to}>
                      {z.name} <span>({z.total})</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
