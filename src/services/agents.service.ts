import { supabase, STORAGE_BUCKET } from '@/lib/supabase';
import { PATHS } from '@/app/paths';
import type { AgentOverview, AgentRef, Profile, PublicAgent, UserRole } from '@/types';

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', { body });
  if (error) {
    let message = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') {
        const payload = await ctx.json();
        if (payload?.error) message = payload.error;
      }
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
  return data as T;
}

// ---------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------
const publicCache = new Map<string, Promise<PublicAgent | null>>();

export function getPublicAgent(id: string): Promise<PublicAgent | null> {
  if (!publicCache.has(id)) {
    publicCache.set(
      id,
      Promise.resolve(supabase.rpc('get_public_agent', { p_agent_id: id })).then(({ data, error }) => {
        if (error || !data?.length) return null;
        const a = data[0] as PublicAgent;
        return { ...a, properties_count: Number(a.properties_count) };
      }),
    );
  }
  return publicCache.get(id)!;
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------
export async function getAgentsOverview(): Promise<AgentOverview[]> {
  const { data, error } = await supabase.rpc('get_agents_overview');
  if (error) throw error;
  return ((data ?? []) as AgentOverview[]).map((a) => ({
    ...a,
    active_count: Number(a.active_count),
    draft_count: Number(a.draft_count),
    finished_count: Number(a.finished_count),
    leads_count: Number(a.leads_count),
  }));
}

/** Asesores activos para los selectores de asignación */
export async function listAssignableAgents(): Promise<AgentRef[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,avatar_url')
    .in('role', ['admin', 'agent'])
    .eq('active', true)
    .order('full_name');
  if (error) throw error;
  return (data ?? []) as AgentRef[];
}

export interface NewAgentInput {
  email: string;
  full_name: string;
  phone?: string;
  whatsapp?: string;
  title?: string;
  role: Exclude<UserRole, 'user'>;
  mode: 'invite' | 'password';
  password?: string;
}

export const createAgent = (input: NewAgentInput) =>
  invoke<{ id: string }>({
    action: 'create',
    ...input,
    redirect_to: `${window.location.origin}${PATHS.admin.reset}`,
  });

export const setAgentPassword = (id: string, password: string) => invoke({ action: 'set_password', id, password });

export const deleteAgent = (id: string) => invoke({ action: 'delete', id });

export async function updateAgent(
  id: string,
  patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'whatsapp' | 'title' | 'avatar_url' | 'role' | 'active'>>,
) {
  const { error } = await supabase.from('profiles').update(patch).eq('id', id);
  if (error) throw error;
}

export async function sendAgentResetLink(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${PATHS.admin.reset}`,
  });
  if (error) throw error;
}

export async function uploadAgentAvatar(userId: string, file: File): Promise<string> {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `agents/${userId}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    contentType: file.type,
  });
  if (error) throw error;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Normaliza un teléfono a formato wa.me (México por defecto) */
export function toWhatsappNumber(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '');
  if (!d) return null;
  if (d.length === 10) return `52${d}`;
  return d;
}
