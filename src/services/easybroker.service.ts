import { supabase } from '@/lib/supabase';
import type { EasyBrokerImportResult, EasyBrokerListResponse } from '@/types';

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('easybroker-import', { body });
  if (error) {
    // Intenta leer el mensaje real de la función
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

export const listEasyBrokerProperties = (page = 1) =>
  invoke<EasyBrokerListResponse>({ action: 'list', page });

/** agentId: id de un asesor, o 'auto' para asignar por el correo del agente en EasyBroker */
export const importEasyBrokerProperties = (ids: string[], status: 'draft' | 'active', agentId: string | 'auto' = 'auto') =>
  invoke<{ results: EasyBrokerImportResult[] }>({ action: 'import', ids, status, agent_id: agentId });
