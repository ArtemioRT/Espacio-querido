// Supabase Edge Function · easybroker-import
// Lista e importa propiedades desde la API de EasyBroker.
// La API key vive como secreto del servidor, nunca en el navegador.
//
//   supabase secrets set EASYBROKER_API_KEY=tu_api_key
//   supabase functions deploy easybroker-import
//
// Body:
//   { action: 'list', page?: number }
//   { action: 'import', ids: string[], status?: 'draft' | 'active', agent_id?: string | 'auto' }
//     agent_id 'auto' (o vacío): asigna al asesor cuyo correo coincida con el agente de EasyBroker
// Solo administradores.

import { corsHeaders, json, requireAdmin, serviceClient } from '../_shared/utils.ts';

const EB_API = 'https://api.easybroker.com/v1';

// deno-lint-ignore no-explicit-any
type Any = any;

async function ebFetch(path: string, apiKey: string): Promise<Any> {
  const res = await fetch(`${EB_API}${path}`, {
    headers: { 'X-Authorization': apiKey, accept: 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EasyBroker ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Mapea nombres de amenidades de EasyBroker a las del portal
const AMENITY_MAP: Array<[RegExp, string]> = [
  [/alberca|piscina/, 'Alberca'],
  [/jardin/, 'Jardín'],
  [/gimnasio|gym/, 'Gimnasio'],
  [/seguridad|vigilancia/, 'Seguridad 24/7'],
  [/acceso controlado|caseta/, 'Acceso controlado'],
  [/roof/, 'Roof garden'],
  [/terraza/, 'Terraza'],
  [/cuarto de servicio/, 'Cuarto de servicio'],
  [/juegos infantiles|area de juegos/, 'Área de juegos'],
  [/salon de (fiestas|eventos|usos)/, 'Salón de eventos'],
  [/asador|bbq/, 'Asador'],
  [/elevador/, 'Elevador'],
  [/aire acondicionado|clima/, 'Aire acondicionado'],
  [/calefaccion/, 'Calefacción'],
  [/cocina integral|cocina equipada/, 'Cocina integral'],
  [/amueblad/, 'Amueblado'],
  [/mascota/, 'Mascotas permitidas'],
  [/vista/, 'Vista panorámica'],
  [/bodega/, 'Bodega'],
  [/estudio/, 'Estudio'],
  [/vestidor|walk/, 'Walk-in closet'],
  [/lavanderia|cuarto de lavado|area de lavado/, 'Lavandería'],
  [/solar/, 'Paneles solares'],
  [/cisterna/, 'Cisterna'],
  [/casa club|club house/, 'Casa club'],
  [/padel/, 'Cancha de pádel'],
  [/coworking|business center/, 'Coworking'],
];

function mapAmenities(features: Any[] = []): string[] {
  const out = new Set<string>();
  for (const f of features) {
    const name = typeof f === 'string' ? f : f?.name;
    if (!name) continue;
    const n = normalize(name);
    const hit = AMENITY_MAP.find(([re]) => re.test(n));
    out.add(hit ? hit[1] : name);
  }
  return [...out];
}

function mapType(t = ''): string {
  const n = normalize(t);
  if (n.includes('departamento') || n.includes('depa')) return 'departamento';
  if (n.includes('terreno') || n.includes('lote')) return 'terreno';
  if (n.includes('oficina')) return 'oficina';
  if (n.includes('local')) return 'local';
  if (n.includes('bodega') || n.includes('nave')) return 'bodega';
  if (n.includes('casa')) return 'casa';
  return 'otro';
}

function parseLocation(loc: Any) {
  const name: string = typeof loc === 'string' ? loc : loc?.name ?? '';
  const parts = name.split(',').map((p) => p.trim()).filter(Boolean);
  const state = parts.length >= 1 ? parts[parts.length - 1] : null;
  const city = parts.length >= 2 ? parts[parts.length - 2] : null;
  const neighborhood = parts.length >= 3 ? parts.slice(0, parts.length - 2).join(', ') : null;
  return {
    state,
    city,
    neighborhood,
    address: typeof loc === 'object' ? [loc?.street, loc?.exterior_number].filter(Boolean).join(' ') || null : null,
    postal_code: typeof loc === 'object' ? loc?.postal_code ?? null : null,
    latitude: typeof loc === 'object' ? loc?.latitude ?? null : null,
    longitude: typeof loc === 'object' ? loc?.longitude ?? null : null,
  };
}

function mapProperty(p: Any) {
  const op = (p.operations ?? [])[0] ?? {};
  const operation_type = op.type === 'sale' ? 'sale' : 'rent';
  return {
    title: p.title ?? `Propiedad ${p.public_id}`,
    description: p.description ?? null,
    operation_type,
    property_type: mapType(p.property_type),
    price: Number(op.amount ?? 0),
    currency: op.currency === 'USD' ? 'USD' : 'MXN',
    bedrooms: p.bedrooms ?? 0,
    bathrooms: p.bathrooms ?? 0,
    half_bathrooms: p.half_bathrooms ?? 0,
    parking_spaces: p.parking_spaces ?? 0,
    construction_m2: p.construction_size ?? null,
    land_m2: p.lot_size ?? null,
    floors: p.floors ?? null,
    year_built: p.age && Number(p.age) > 1800 ? Number(p.age) : null,
    ...parseLocation(p.location),
    amenities: mapAmenities(p.features),
    cover_image_url: p.property_images?.[0]?.url ?? p.title_image_full ?? null,
    source: 'easybroker',
    easybroker_id: p.public_id,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('EASYBROKER_API_KEY');
    if (!apiKey) return json({ error: 'Falta configurar EASYBROKER_API_KEY en los secretos de Supabase.' }, 500);

    const adminId = await requireAdmin(req);
    if (!adminId) return json({ error: 'Solo un administrador puede importar desde EasyBroker.' }, 403);

    const admin = serviceClient();
    const body = await req.json().catch(() => ({}));

    // 2) Listar
    if (body.action === 'list') {
      const page = Math.max(1, Number(body.page) || 1);
      const res = await ebFetch(`/properties?page=${page}&limit=20`, apiKey);
      const content: Any[] = res.content ?? [];
      const ids = content.map((p) => p.public_id);
      const { data: existing } = ids.length
        ? await admin.from('properties').select('easybroker_id').in('easybroker_id', ids)
        : { data: [] as Any[] };
      const imported = new Set((existing ?? []).map((r: Any) => r.easybroker_id));

      return json({
        pagination: res.pagination ?? { page, limit: 20, total: content.length },
        items: content.map((p) => ({
          public_id: p.public_id,
          title: p.title,
          thumbnail: p.title_image_thumb ?? p.title_image_full ?? null,
          location: typeof p.location === 'string' ? p.location : p.location?.name ?? '',
          property_type: p.property_type,
          operation: p.operations?.[0]?.type ?? null,
          price: p.operations?.[0]?.formatted_amount ?? null,
          agent: p.agent?.email ?? p.agent?.name ?? null,
          imported: imported.has(p.public_id),
        })),
      });
    }

    // 3) Importar
    if (body.action === 'import') {
      const ids: string[] = Array.isArray(body.ids) ? body.ids.slice(0, 50) : [];
      const status = body.status === 'active' ? 'active' : 'draft';
      if (!ids.length) return json({ error: 'No se enviaron propiedades' }, 400);

      const fixedAgent = typeof body.agent_id === 'string' && /^[0-9a-f-]{36}$/i.test(body.agent_id) ? body.agent_id : null;
      // Mapa correo → asesor para la asignación automática
      const { data: staff } = await admin.from('profiles').select('id,email').in('role', ['admin', 'agent']).eq('active', true);
      const byEmail = new Map((staff ?? []).filter((s: Any) => s.email).map((s: Any) => [String(s.email).toLowerCase(), s.id]));

      const results: Array<{ public_id: string; ok: boolean; id?: string; error?: string; updated?: boolean; agent_id?: string | null }> = [];

      for (const publicId of ids) {
        try {
          const detail = await ebFetch(`/properties/${encodeURIComponent(publicId)}`, apiKey);
          const ebEmail = String(detail.agent?.email ?? '').toLowerCase();
          const agentId = fixedAgent ?? (ebEmail ? byEmail.get(ebEmail) ?? null : null);
          const row: Any = mapProperty(detail);
          if (agentId) row.agent_id = agentId;

          const { data: found } = await admin
            .from('properties').select('id').eq('easybroker_id', publicId).maybeSingle();

          let propertyId: string;
          if (found) {
            const { error } = await admin.from('properties').update(row).eq('id', found.id);
            if (error) throw error;
            propertyId = found.id;
          } else {
            const { data, error } = await admin
              .from('properties').insert({ ...row, status }).select('id').single();
            if (error) throw error;
            propertyId = data.id;
          }

          const images: Any[] = detail.property_images ?? [];
          await admin.from('property_images').delete().eq('property_id', propertyId).is('storage_path', null);
          if (images.length) {
            const { error: imgErr } = await admin.from('property_images').insert(
              images.map((img, i) => ({
                property_id: propertyId,
                url: img.url,
                caption: img.title ?? null,
                position: i,
                storage_path: null,
              })),
            );
            if (imgErr) throw imgErr;
          }

          results.push({ public_id: publicId, ok: true, id: propertyId, updated: !!found, agent_id: agentId });
        } catch (err) {
          results.push({ public_id: publicId, ok: false, error: (err as Error).message });
        }
      }

      return json({ results });
    }

    return json({ error: 'Acción no válida' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
