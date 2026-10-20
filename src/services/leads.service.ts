import { supabase } from '@/lib/supabase';
import { getAttribution, trackEvent } from '@/services/analytics.service';
import type { Lead, LeadInput, LeadInterest, LeadStatus } from '@/types';

export const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '';

export async function submitLead(input: LeadInput, captchaToken?: string | null) {
  const attr = getAttribution();

  // Con reCAPTCHA configurado, el lead pasa por la Edge Function que lo verifica
  if (RECAPTCHA_SITE_KEY) {
    if (!captchaToken) throw new Error('Confirma que no eres un robot.');
    const { data, error } = await supabase.functions.invoke('submit-lead', {
      body: {
        ...input,
        token: captchaToken,
        page_url: window.location.href.slice(0, 500),
        ...attr,
      },
    });
    if (error || (data as { error?: string })?.error) {
      throw new Error((data as { error?: string })?.error || 'No pudimos enviar tus datos. Inténtalo de nuevo.');
    }
    trackEvent('lead_submit', { label: input.interest, propertyId: input.property_id ?? null });
    return;
  }

  const { error } = await supabase.from('leads').insert({
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    interest: input.interest,
    message: input.message?.trim() || null,
    property_id: input.property_id ?? null,
    source: input.source ?? 'contact_form',
    page_url: window.location.href.slice(0, 500),
    ...attr,
  });
  if (error) throw new Error('No pudimos enviar tus datos. Inténtalo de nuevo en un momento.');
  trackEvent('lead_submit', { label: input.interest, propertyId: input.property_id ?? null });
}

export interface LeadFilters {
  status?: LeadStatus | 'all';
  agent?: string | 'all' | 'none';
  interest?: LeadInterest | 'all';
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listLeads(f: LeadFilters): Promise<{ data: Lead[]; count: number }> {
  const pageSize = f.pageSize ?? 20;
  const page = Math.max(1, f.page ?? 1);
  let query = supabase
    .from('leads')
    .select('*, property:properties(id,title,slug,code), agent:profiles(id,full_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (f.status && f.status !== 'all') query = query.eq('status', f.status);
  if (f.interest && f.interest !== 'all') query = query.eq('interest', f.interest);
  if (f.agent === 'none') query = query.is('agent_id', null);
  else if (f.agent && f.agent !== 'all') query = query.eq('agent_id', f.agent);
  if (f.from) query = query.gte('created_at', f.from);
  if (f.to) query = query.lte('created_at', f.to);
  if (f.q) {
    const t = f.q.replace(/[,()*%\\]/g, ' ').trim();
    if (t) query = query.or(`name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`);
  }

  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { data: (data ?? []) as Lead[], count: count ?? 0 };
}

export async function listAllLeadsForExport(f: Omit<LeadFilters, 'page' | 'pageSize'>): Promise<Lead[]> {
  const all: Lead[] = [];
  let page = 1;
  // Paginado por bloques de 1000 (límite de PostgREST)
  for (;;) {
    const { data } = await listLeads({ ...f, page, pageSize: 1000 });
    all.push(...data);
    if (data.length < 1000) break;
    page++;
  }
  return all;
}

export async function updateLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes'>>) {
  const { error } = await supabase.from('leads').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from('leads').delete().eq('id', id);
  if (error) throw error;
}

export async function getRecentLeads(limit = 6): Promise<Lead[]> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, property:properties(id,title,slug,code), agent:profiles(id,full_name)')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

export async function countNewLeads(): Promise<number> {
  const { count } = await supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new');
  return count ?? 0;
}
