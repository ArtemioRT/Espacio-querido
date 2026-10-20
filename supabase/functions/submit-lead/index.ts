// Supabase Edge Function · submit-lead
// Verifica Google reCAPTCHA v2 y guarda el lead con la service role.
//   supabase secrets set RECAPTCHA_SECRET=tu_secret
//   supabase functions deploy submit-lead --no-verify-jwt
//
// Una vez activo, quita la inserción pública directa:
//   drop policy "leads_public_insert" on public.leads;

// ---------------------------------------------------------------------
// Utilidades (autocontenidas: este archivo se puede pegar tal cual en
// Supabase → Edge Functions → editor, o desplegar con el CLI)
// ---------------------------------------------------------------------
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

/** Llave de servicio: funciona con llaves clásicas (service_role) y nuevas (sb_secret_…) */
function serviceKey(): string {
  const direct = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SECRET_KEY');
  if (direct) return direct;
  const many = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (many) {
    try {
      const parsed = JSON.parse(many);
      const first = typeof parsed === 'string' ? parsed : Object.values(parsed)[0];
      if (typeof first === 'string') return first;
    } catch {
      return many;
    }
  }
  throw new Error('No se encontró la llave de servicio de Supabase en la función.');
}

function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

// ---------------------------------------------------------------------

const INTERESTS = ['venta', 'compra', 'renta', 'inversion', 'propiedad', 'otro'];
const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const uuid = (v: unknown) =>
  typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v) ? v : null;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const secret = Deno.env.get('RECAPTCHA_SECRET');
    if (!secret) return json({ error: 'reCAPTCHA no está configurado en el servidor.' }, 500);

    const body = await req.json().catch(() => ({}));

    // 1) Verificar captcha
    const form = new URLSearchParams({ secret, response: String(body.token ?? '') });
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (ip) form.set('remoteip', ip);
    const verify = await fetch('https://www.google.com/recaptcha/api/siteverify', { method: 'POST', body: form });
    const result = await verify.json();
    if (!result.success) return json({ error: 'No pudimos verificar el captcha. Inténtalo de nuevo.' }, 400);

    // 2) Validar datos
    const name = str(body.name, 120);
    const email = str(body.email, 160)?.toLowerCase() ?? null;
    const phone = str(body.phone, 20);
    if (!name || name.length < 2 || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !phone) {
      return json({ error: 'Revisa tus datos.' }, 400);
    }

    // 3) Guardar (el trigger asigna el asesor de la propiedad)
    const { error } = await serviceClient().from('leads').insert({
      name,
      email,
      phone,
      interest: INTERESTS.includes(body.interest) ? body.interest : 'otro',
      message: str(body.message, 2000),
      property_id: uuid(body.property_id),
      source: str(body.source, 40) ?? 'contact_form',
      page_url: str(body.page_url, 500),
      referrer: str(body.referrer, 500),
      utm_source: str(body.utm_source, 120),
      utm_medium: str(body.utm_medium, 120),
      utm_campaign: str(body.utm_campaign, 120),
      session_id: uuid(body.session_id),
      visitor_id: uuid(body.visitor_id),
    });
    if (error) return json({ error: 'No pudimos guardar tus datos.' }, 500);

    return json({ ok: true });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
