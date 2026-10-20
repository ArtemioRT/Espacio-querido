import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { PAGE_SIZE } from '@/utils/constants';
import type { OperationType, Property, PropertyImage, PropertyInput, PropertyStatus, PropertyType } from '@/types';

export type SortOption = 'recent' | 'price_asc' | 'price_desc' | 'size_desc';

export interface PropertySearchFilters {
  q?: string;
  operation?: OperationType | '';
  type?: PropertyType | '';
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: number;
  bathrooms?: number;
  parking?: number;
  minM2?: number;
  maxM2?: number;
  minLand?: number;
  maxLand?: number;
  state?: string;
  city?: string;
  neighborhood?: string;
  amenities?: string[];
  agent?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

const LIST_FIELDS =
  'id,code,agent_id,slug,title,status,operation_type,property_type,price,currency,bedrooms,bathrooms,half_bathrooms,parking_spaces,construction_m2,land_m2,state,city,neighborhood,cover_image_url,featured,amenities,source,views_count,created_at,updated_at';

const ADMIN_LIST_FIELDS = `${LIST_FIELDS},agent:profiles(id,full_name,avatar_url)`;

// Evita romper la sintaxis de .or() de PostgREST
const sanitize = (v: string) => v.replace(/[,()*%\\]/g, ' ').trim();

// ---------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------
export async function searchProperties(f: PropertySearchFilters): Promise<{ data: Property[]; count: number }> {
  const pageSize = f.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, f.page ?? 1);

  let query = supabase.from('properties').select(LIST_FIELDS, { count: 'exact' }).eq('status', 'active');

  if (f.q) {
    const terms = sanitize(f.q).split(/\s+/).filter(Boolean).slice(0, 4);
    for (const t of terms) {
      query = query.or(`title.ilike.%${t}%,neighborhood.ilike.%${t}%,city.ilike.%${t}%,state.ilike.%${t}%,address.ilike.%${t}%`);
    }
  }
  if (f.operation) query = query.eq('operation_type', f.operation);
  if (f.type) query = query.eq('property_type', f.type);
  if (f.minPrice) query = query.gte('price', f.minPrice);
  if (f.maxPrice) query = query.lte('price', f.maxPrice);
  if (f.bedrooms) query = query.gte('bedrooms', f.bedrooms);
  if (f.bathrooms) query = query.gte('bathrooms', f.bathrooms);
  if (f.parking) query = query.gte('parking_spaces', f.parking);
  if (f.minM2) query = query.gte('construction_m2', f.minM2);
  if (f.maxM2) query = query.lte('construction_m2', f.maxM2);
  if (f.minLand) query = query.gte('land_m2', f.minLand);
  if (f.maxLand) query = query.lte('land_m2', f.maxLand);
  if (f.state) query = query.eq('state', f.state);
  if (f.city) query = query.eq('city', f.city);
  if (f.neighborhood) query = query.eq('neighborhood', f.neighborhood);
  if (f.amenities?.length) query = query.contains('amenities', f.amenities);
  if (f.agent && /^[0-9a-f-]{36}$/i.test(f.agent)) query = query.eq('agent_id', f.agent);

  switch (f.sort) {
    case 'price_asc':
      query = query.order('price', { ascending: true });
      break;
    case 'price_desc':
      query = query.order('price', { ascending: false });
      break;
    case 'size_desc':
      query = query.order('construction_m2', { ascending: false, nullsFirst: false });
      break;
    default:
      query = query.order('featured', { ascending: false }).order('published_at', { ascending: false, nullsFirst: false });
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: (data ?? []) as unknown as Property[], count: count ?? 0 };
}

export async function getFeaturedProperties(limit = 6): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select(LIST_FIELDS)
    .eq('status', 'active')
    .order('featured', { ascending: false })
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as Property[];
}

export async function getPropertyBySlug(slug: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*, images:property_images(*)')
    .eq('slug', slug)
    .order('position', { referencedTable: 'property_images', ascending: true })
    .maybeSingle();
  if (error) throw error;
  return data as Property | null;
}

export async function getSimilarProperties(p: Property, limit = 3): Promise<Property[]> {
  let query = supabase
    .from('properties')
    .select(LIST_FIELDS)
    .eq('status', 'active')
    .eq('operation_type', p.operation_type)
    .neq('id', p.id)
    .limit(limit);
  if (p.city) query = query.eq('city', p.city);
  const { data, error } = await query;
  if (error) throw error;
  if ((data?.length ?? 0) > 0 || !p.city) return (data ?? []) as unknown as Property[];
  // Sin coincidencias en la ciudad: misma operación en cualquier lugar
  const { data: any } = await supabase
    .from('properties')
    .select(LIST_FIELDS)
    .eq('status', 'active')
    .eq('operation_type', p.operation_type)
    .neq('id', p.id)
    .limit(limit);
  return (any ?? []) as unknown as Property[];
}

export interface LocationTree {
  /** estado → municipio → colonias (con conteo de propiedades) */
  [state: string]: { total: number; cities: { [city: string]: { total: number; neighborhoods: Array<{ name: string; total: number }> } } };
}

let treeCache: Promise<LocationTree> | null = null;

export function getLocationTree(): Promise<LocationTree> {
  if (!treeCache) {
    treeCache = Promise.resolve(supabase.rpc('get_location_tree')).then(({ data, error }) => {
      const tree: LocationTree = {};
      if (error) {
        treeCache = null;
        return tree;
      }
      for (const row of (data ?? []) as Array<{ state: string; city: string; neighborhood: string | null; total: number }>) {
        const n = Number(row.total);
        const st = (tree[row.state] ??= { total: 0, cities: {} });
        st.total += n;
        const ct = (st.cities[row.city] ??= { total: 0, neighborhoods: [] });
        ct.total += n;
        if (row.neighborhood) ct.neighborhoods.push({ name: row.neighborhood, total: n });
      }
      return tree;
    });
  }
  return treeCache;
}

export async function getLocationSuggestions(): Promise<Array<{ label: string; kind: string }>> {
  const { data, error } = await supabase.rpc('get_property_locations');
  if (error) return [];
  return (data ?? []) as Array<{ label: string; kind: string }>;
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export async function listAdminProperties(opts: {
  status?: PropertyStatus | 'all';
  agent?: string | 'all' | 'none';
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: Property[]; count: number }> {
  const pageSize = opts.pageSize ?? 15;
  const page = Math.max(1, opts.page ?? 1);
  let query = supabase.from('properties').select(ADMIN_LIST_FIELDS, { count: 'exact' });
  if (opts.status && opts.status !== 'all') query = query.eq('status', opts.status);
  if (opts.agent === 'none') query = query.is('agent_id', null);
  else if (opts.agent && opts.agent !== 'all') query = query.eq('agent_id', opts.agent);
  if (opts.q) {
    const t = sanitize(opts.q);
    if (t) {
      const byCode = /^\d+$/.test(t) ? `,code.eq.${t}` : '';
      query = query.or(`title.ilike.%${t}%,neighborhood.ilike.%${t}%,city.ilike.%${t}%,easybroker_id.ilike.%${t}%${byCode}`);
    }
  }
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.order('updated_at', { ascending: false }).range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: (data ?? []) as unknown as Property[], count: count ?? 0 };
}

export async function getStatusCounts(agent?: string | 'all' | 'none'): Promise<Record<PropertyStatus | 'all', number>> {
  const head = (status?: PropertyStatus) => {
    let q = supabase.from('properties').select('id', { count: 'exact', head: true });
    if (status) q = q.eq('status', status);
    if (agent === 'none') q = q.is('agent_id', null);
    else if (agent && agent !== 'all') q = q.eq('agent_id', agent);
    return q;
  };
  const [all, active, draft, finished] = await Promise.all([head(), head('active'), head('draft'), head('finished')]);
  return {
    all: all.count ?? 0,
    active: active.count ?? 0,
    draft: draft.count ?? 0,
    finished: finished.count ?? 0,
  };
}

export async function getPropertyById(id: string): Promise<Property | null> {
  const { data, error } = await supabase
    .from('properties')
    .select('*, images:property_images(*), agent:profiles(id,full_name,avatar_url)')
    .eq('id', id)
    .order('position', { referencedTable: 'property_images', ascending: true })
    .maybeSingle();
  if (error) throw error;
  return data as Property | null;
}

export async function createProperty(input: PropertyInput): Promise<Property> {
  const { data, error } = await supabase.from('properties').insert(input).select('*').single();
  if (error) throw error;
  return data as Property;
}

export async function updateProperty(id: string, patch: Partial<PropertyInput>): Promise<Property> {
  const { data, error } = await supabase.from('properties').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data as Property;
}

export async function assignAgent(id: string, agentId: string | null) {
  const { error } = await supabase.from('properties').update({ agent_id: agentId }).eq('id', id);
  if (error) throw error;
}

export async function updatePropertyStatus(id: string, status: PropertyStatus) {
  const { error } = await supabase.from('properties').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function toggleFeatured(id: string, featured: boolean) {
  const { error } = await supabase.from('properties').update({ featured }).eq('id', id);
  if (error) throw error;
}

export async function deleteProperty(id: string) {
  const { data: imgs } = await supabase.from('property_images').select('storage_path').eq('property_id', id);
  const paths = (imgs ?? []).map((i) => i.storage_path).filter(Boolean) as string[];
  if (paths.length) await supabase.storage.from(STORAGE_BUCKET).remove(paths);
  const { error } = await supabase.from('properties').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateProperty(id: string): Promise<Property> {
  const original = await getPropertyById(id);
  if (!original) throw new Error('Propiedad no encontrada');
  const { id: _id, code: _code, agent: _agent, slug: _s, images, views_count: _v, published_at: _p, finished_at: _f, created_at: _c, updated_at: _u, ...rest } = original;
  const copy = await createProperty({ ...rest, title: `${rest.title} (copia)`, status: 'draft', easybroker_id: null, source: 'manual' });
  if (images?.length) {
    await supabase.from('property_images').insert(
      images.map((img) => ({ property_id: copy.id, url: img.url, storage_path: null, caption: img.caption, position: img.position })),
    );
  }
  return copy;
}

// ---------------------------------------------------------------------
// Imágenes
// ---------------------------------------------------------------------
export interface EditableImage {
  key: string;
  url: string;
  file?: File;
  storage_path?: string | null;
  caption?: string | null;
}

export async function uploadPropertyImage(propertyId: string, file: File): Promise<{ url: string; path: string }> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * Sube las imágenes nuevas, borra del storage las eliminadas
 * y reescribe property_images respetando el orden. La primera es la portada.
 */
export async function syncPropertyImages(
  propertyId: string,
  images: EditableImage[],
  removedStoragePaths: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<PropertyImage[]> {
  const pending = images.filter((i) => i.file).length;
  let done = 0;

  const resolved: Array<{ url: string; storage_path: string | null; caption: string | null }> = [];
  for (const img of images) {
    if (img.file) {
      const up = await uploadPropertyImage(propertyId, img.file);
      resolved.push({ url: up.url, storage_path: up.path, caption: img.caption ?? null });
      done++;
      onProgress?.(done, pending);
    } else {
      resolved.push({ url: img.url, storage_path: img.storage_path ?? null, caption: img.caption ?? null });
    }
  }

  if (removedStoragePaths.length) {
    await supabase.storage.from(STORAGE_BUCKET).remove(removedStoragePaths);
  }

  const { error: delErr } = await supabase.from('property_images').delete().eq('property_id', propertyId);
  if (delErr) throw delErr;

  let rows: PropertyImage[] = [];
  if (resolved.length) {
    const { data, error } = await supabase
      .from('property_images')
      .insert(resolved.map((r, i) => ({ ...r, property_id: propertyId, position: i })))
      .select('*');
    if (error) throw error;
    rows = (data ?? []) as PropertyImage[];
  }

  await supabase.from('properties').update({ cover_image_url: resolved[0]?.url ?? null }).eq('id', propertyId);
  return rows;
}
