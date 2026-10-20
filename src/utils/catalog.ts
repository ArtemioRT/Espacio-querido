/**
 * URLs del catálogo por zona (indexables y pre-renderizadas).
 *
 *   /propiedades                                  catálogo general
 *   /venta  · /renta  · /inmuebles                operación (inmuebles = venta y renta)
 *   /venta/casas                                  + tipo
 *   /venta/nuevo-leon/monterrey/cumbres-elite     + estado / municipio / colonia
 *   /venta/casas/nuevo-leon/monterrey             tipo + ubicación
 *
 * Los filtros que no son de zona (precio, recámaras, m², amenidades…) van como ?query
 * y esas combinaciones no se indexan.
 *
 * Lo usan la app, el pre-render y el sitemap, para que las URLs siempre coincidan.
 */
import type { OperationType, PropertyType } from '@/types';

/** Igual que public.slugify() en Postgres: minúsculas, sin acentos, guiones */
export function slugify(v: string | null | undefined): string {
  return (v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const OPERATION_SEGMENT: Record<OperationType | 'all', string> = {
  sale: 'venta',
  rent: 'renta',
  all: 'inmuebles',
};
const SEGMENT_OPERATION: Record<string, OperationType | undefined> = { venta: 'sale', renta: 'rent', inmuebles: undefined };
export const CATALOG_ROOTS = Object.keys(SEGMENT_OPERATION);

export const TYPE_SLUG: Record<PropertyType, string> = {
  casa: 'casas',
  departamento: 'departamentos',
  terreno: 'terrenos',
  oficina: 'oficinas',
  local: 'locales',
  bodega: 'bodegas',
  otro: 'otros',
};
const SLUG_TYPE = Object.fromEntries(Object.entries(TYPE_SLUG).map(([k, v]) => [v, k])) as Record<string, PropertyType>;

export const TYPE_PLURAL: Record<PropertyType, string> = {
  casa: 'Casas',
  departamento: 'Departamentos',
  terreno: 'Terrenos',
  oficina: 'Oficinas',
  local: 'Locales comerciales',
  bodega: 'Bodegas y naves',
  otro: 'Propiedades',
};

export interface CatalogFacet {
  operation?: OperationType;
  type?: PropertyType;
  /** slugs */
  state?: string;
  city?: string;
  neighborhood?: string;
}

/** Ruta canónica de una faceta */
export function catalogPath(f: CatalogFacet): string {
  const hasAny = f.operation || f.type || f.state;
  if (!hasAny) return '/propiedades';
  const parts = [OPERATION_SEGMENT[f.operation ?? 'all']];
  if (f.type) parts.push(TYPE_SLUG[f.type]);
  if (f.state) {
    parts.push(f.state);
    if (f.city) {
      parts.push(f.city);
      if (f.neighborhood) parts.push(f.neighborhood);
    }
  }
  return `/${parts.join('/')}`;
}

/** Interpreta /venta/casas/nuevo-leon/... ; null si la ruta no es del catálogo por zona */
export function parseCatalogPath(pathname: string): CatalogFacet | null {
  const segs = pathname.split('/').filter(Boolean).map((s) => decodeURIComponent(s).toLowerCase());
  if (!segs.length || !(segs[0] in SEGMENT_OPERATION)) return null;
  const facet: CatalogFacet = { operation: SEGMENT_OPERATION[segs[0]] };
  let i = 1;
  if (segs[i] && SLUG_TYPE[segs[i]]) facet.type = SLUG_TYPE[segs[i++]];
  if (segs[i]) facet.state = segs[i++];
  if (segs[i]) facet.city = segs[i++];
  if (segs[i]) facet.neighborhood = segs[i++];
  return facet;
}

export interface FacetNames {
  state?: string;
  city?: string;
  neighborhood?: string;
}

/** "Casas en venta en Cumbres Elite, Monterrey" */
export function facetHeading(f: CatalogFacet, names: FacetNames = {}): string {
  const what = f.type ? TYPE_PLURAL[f.type] : 'Propiedades';
  const op = f.operation === 'sale' ? ' en venta' : f.operation === 'rent' ? ' en renta' : ' en venta y renta';
  const n = { state: names.state ?? unslug(f.state), city: names.city ?? unslug(f.city), neighborhood: names.neighborhood ?? unslug(f.neighborhood) };
  const where = f.neighborhood
    ? `${n.neighborhood}, ${n.city}`
    : f.city
      ? `${n.city}, ${n.state}`
      : f.state
        ? n.state
        : 'Monterrey y Nuevo León';
  return `${what}${op} en ${where}`;
}

/** Respaldo legible si aún no llegan los nombres reales: "san-pedro" → "San Pedro" */
export function unslug(s?: string): string {
  return (s ?? '').split('-').filter(Boolean).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Ruta de navegación para una faceta */
export function facetCrumbs(f: CatalogFacet, names: FacetNames = {}): Array<{ label: string; to?: string }> {
  const crumbs: Array<{ label: string; to?: string }> = [
    { label: 'Inicio', to: '/' },
    { label: 'Propiedades', to: '/propiedades' },
  ];
  if (f.operation || f.type || f.state) {
    const opLabel = f.operation === 'sale' ? 'Venta' : f.operation === 'rent' ? 'Renta' : 'Venta y renta';
    crumbs.push({ label: opLabel, to: catalogPath({ operation: f.operation }) });
  }
  if (f.type) crumbs.push({ label: TYPE_PLURAL[f.type], to: catalogPath({ operation: f.operation, type: f.type }) });
  if (f.state) crumbs.push({ label: names.state ?? unslug(f.state), to: catalogPath({ ...f, city: undefined, neighborhood: undefined }) });
  if (f.state && f.city) crumbs.push({ label: names.city ?? unslug(f.city), to: catalogPath({ ...f, neighborhood: undefined }) });
  if (f.state && f.city && f.neighborhood) crumbs.push({ label: names.neighborhood ?? unslug(f.neighborhood), to: catalogPath(f) });
  return crumbs;
}
