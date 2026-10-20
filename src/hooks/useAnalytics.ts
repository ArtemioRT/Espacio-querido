import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { sendHeartbeat, trackEvent, trackPageView, trackingAllowed } from '@/services/analytics.service';
import type { TrackEventType } from '@/types';

const HEARTBEAT_SECONDS = 15;

/**
 * Tracking automático del sitio público:
 *  - page_view en cada cambio de ruta
 *  - latido cada 15 s con la pestaña visible (tiempo de permanencia)
 *  - clicks en tel:, mailto:, WhatsApp y cualquier elemento con data-track
 */
export function useAnalytics() {
  const location = useLocation();

  useEffect(() => {
    if (!trackingAllowed()) return;
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') sendHeartbeat(HEARTBEAT_SECONDS);
    }, HEARTBEAT_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>('a, button, [data-track]');
      if (!el) return;

      const tracked = el.dataset.track as TrackEventType | undefined;
      const label = el.dataset.trackLabel || el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 80) || null;
      const propertyId = el.dataset.trackProperty || null;
      const href = el instanceof HTMLAnchorElement ? el.href : '';

      let type: TrackEventType | null = tracked ?? null;
      if (!type) {
        if (href.startsWith('tel:')) type = 'phone_click';
        else if (href.startsWith('mailto:')) type = 'email_click';
        else if (/wa\.me|whatsapp\.com/.test(href)) type = 'whatsapp_click';
      }
      if (type) trackEvent(type, { label, propertyId });
    };
    document.addEventListener('click', onClick, { capture: true });
    return () => document.removeEventListener('click', onClick, { capture: true });
  }, []);
}
