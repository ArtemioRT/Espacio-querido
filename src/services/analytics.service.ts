import { supabase } from '@/lib/supabase';
import { safeGet, safeSet } from '@/utils/storage';
import type { DashboardStats, TrackEventType } from '@/types';

const VISITOR_KEY = 'eq_vid';
const SESSION_KEY = 'eq_sid';
const SESSION_TS_KEY = 'eq_sts';
const ATTR_KEY = 'eq_attr';
export const CONSENT_KEY = 'eq_cookie_consent';
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const uuid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const trackingAllowed = () => safeGet(CONSENT_KEY) !== 'rejected';

function getVisitorId(): string {
  let id = safeGet(VISITOR_KEY);
  if (!id) {
    id = uuid();
    safeSet(VISITOR_KEY, id);
  }
  return id;
}

interface Attribution {
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export function getAttribution(): Attribution & { session_id: string | null; visitor_id: string | null } {
  let attr: Attribution = { referrer: null, utm_source: null, utm_medium: null, utm_campaign: null };
  try {
    const raw = safeGet(ATTR_KEY, 'session');
    if (raw) attr = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { ...attr, session_id: safeGet(SESSION_KEY), visitor_id: safeGet(VISITOR_KEY) };
}

function deviceInfo() {
  const ua = navigator.userAgent;
  const w = window.innerWidth;
  const device = /iPad|Tablet/i.test(ua) || (w >= 600 && w < 1024 && 'ontouchstart' in window)
    ? 'tablet'
    : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari'
    : /Firefox\//.test(ua) ? 'Firefox' : 'Otro';
  const os = /Windows/.test(ua) ? 'Windows'
    : /iPhone|iPad|iOS/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Mac OS/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : 'Otro';
  return { device, browser, os, screen: `${window.screen.width}x${window.screen.height}`, language: navigator.language };
}

let sessionPromise: Promise<string | null> | null = null;

/** Devuelve la sesión actual; crea una nueva tras 30 min de inactividad. */
async function ensureSession(): Promise<string | null> {
  if (!trackingAllowed()) return null;
  const now = Date.now();
  const lastTs = Number(safeGet(SESSION_TS_KEY) || 0);
  let sid = safeGet(SESSION_KEY);

  if (sid && now - lastTs < SESSION_TIMEOUT_MS) {
    safeSet(SESSION_TS_KEY, String(now));
    return sid;
  }
  if (sessionPromise) return sessionPromise;

  sessionPromise = (async () => {
    sid = uuid();
    const params = new URLSearchParams(window.location.search);
    const ref = document.referrer && !document.referrer.startsWith(window.location.origin) ? document.referrer : null;
    const attr: Attribution = {
      referrer: ref,
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),
      utm_campaign: params.get('utm_campaign'),
    };
    safeSet(ATTR_KEY, JSON.stringify(attr), 'session');
    safeSet(SESSION_KEY, sid);
    safeSet(SESSION_TS_KEY, String(now));

    const d = deviceInfo();
    const { error } = await supabase.rpc('track_session_start', {
      p_session_id: sid,
      p_visitor_id: getVisitorId(),
      p_landing_page: window.location.pathname + window.location.search,
      p_referrer: attr.referrer,
      p_utm_source: attr.utm_source,
      p_utm_medium: attr.utm_medium,
      p_utm_campaign: attr.utm_campaign,
      p_device: d.device,
      p_browser: d.browser,
      p_os: d.os,
      p_screen: d.screen,
      p_language: d.language,
    });
    if (error) console.debug('[analytics]', error.message);
    return sid;
  })().finally(() => {
    sessionPromise = null;
  });

  return sessionPromise;
}

export async function trackEvent(
  type: TrackEventType,
  opts: { label?: string | null; propertyId?: string | null; metadata?: Record<string, unknown>; path?: string } = {},
) {
  try {
    const sid = await ensureSession();
    if (!sid) return;
    await supabase.rpc('track_event', {
      p_session_id: sid,
      p_visitor_id: getVisitorId(),
      p_event_type: type,
      p_path: opts.path ?? window.location.pathname + window.location.search,
      p_label: opts.label ?? null,
      p_property_id: opts.propertyId ?? null,
      p_metadata: opts.metadata ?? {},
    });
  } catch (err) {
    console.debug('[analytics]', err);
  }
}

export const trackPageView = (path: string) => trackEvent('page_view', { path });

export async function sendHeartbeat(seconds: number) {
  try {
    const sid = safeGet(SESSION_KEY);
    if (!sid || !trackingAllowed()) return;
    safeSet(SESSION_TS_KEY, String(Date.now()));
    await supabase.rpc('track_heartbeat', { p_session_id: sid, p_seconds: seconds });
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------
export async function getDashboardStats(from: Date, to: Date): Promise<DashboardStats> {
  const { data, error } = await supabase.rpc('get_dashboard_stats', {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City',
  });
  if (error) throw error;
  return data as DashboardStats;
}
