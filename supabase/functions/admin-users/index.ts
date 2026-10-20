// Supabase Edge Function · admin-users
// Alta y baja de asesores (requiere la service role key, por eso vive aquí).
//   supabase functions deploy admin-users
//
// Body:
//   { action: 'create', email, full_name, phone?, whatsapp?, title?, role: 'agent'|'admin',
//     mode: 'invite' | 'password', password?, redirect_to? }
//   { action: 'set_password', id, password }
//   { action: 'delete', id }
//
// Los demás cambios (nombre, teléfono, rol, activar/desactivar, foto) los hace el admin
// directamente sobre la tabla profiles gracias a RLS.

import { corsHeaders, json, requireAdmin, serviceClient } from '../_shared/utils.ts';

const isEmail = (v: unknown) => typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
const clean = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const adminId = await requireAdmin(req);
    if (!adminId) return json({ error: 'Solo un administrador puede gestionar asesores.' }, 403);

    const admin = serviceClient();
    const body = await req.json().catch(() => ({}));

    if (body.action === 'create') {
      if (!isEmail(body.email)) return json({ error: 'Correo no válido' }, 400);
      const email = String(body.email).trim().toLowerCase();
      const full_name = clean(body.full_name);
      if (!full_name) return json({ error: 'El nombre es obligatorio' }, 400);
      const role = body.role === 'admin' ? 'admin' : 'agent';

      let userId: string;
      if (body.mode === 'password') {
        if (typeof body.password !== 'string' || body.password.length < 8) {
          return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
        }
        const { data, error } = await admin.auth.admin.createUser({
          email,
          password: body.password,
          email_confirm: true,
          user_metadata: { full_name },
        });
        if (error) return json({ error: error.message.includes('already') ? 'Ya existe un usuario con ese correo' : error.message }, 400);
        userId = data.user.id;
      } else {
        const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name },
          redirectTo: typeof body.redirect_to === 'string' ? body.redirect_to : undefined,
        });
        if (error) return json({ error: error.message.includes('already') ? 'Ya existe un usuario con ese correo' : error.message }, 400);
        userId = data.user.id;
      }

      const { error: profErr } = await admin.from('profiles').upsert({
        id: userId,
        email,
        full_name,
        phone: clean(body.phone, 20),
        whatsapp: clean(body.whatsapp, 20),
        title: clean(body.title, 80),
        role,
        active: true,
      });
      if (profErr) return json({ error: profErr.message }, 500);

      return json({ id: userId });
    }

    if (body.action === 'set_password') {
      if (typeof body.id !== 'string') return json({ error: 'Falta el usuario' }, 400);
      if (typeof body.password !== 'string' || body.password.length < 8) {
        return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400);
      }
      const { error } = await admin.auth.admin.updateUserById(body.id, { password: body.password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (body.action === 'delete') {
      if (typeof body.id !== 'string') return json({ error: 'Falta el usuario' }, 400);
      if (body.id === adminId) return json({ error: 'No puedes eliminar tu propia cuenta' }, 400);
      // Las propiedades y leads del asesor quedan "sin asignar" (on delete set null)
      const { error } = await admin.auth.admin.deleteUser(body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Acción no válida' }, 400);
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});
