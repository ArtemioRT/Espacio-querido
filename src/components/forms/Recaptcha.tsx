import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { RECAPTCHA_SITE_KEY } from '@/services/leads.service';

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void;
      render: (el: HTMLElement, opts: Record<string, unknown>) => number;
      reset: (id?: number) => void;
    };
    __eqRecaptchaLoaded?: () => void;
  }
}

let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    if (window.grecaptcha?.render) return resolve();
    window.__eqRecaptchaLoaded = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.google.com/recaptcha/api.js?onload=__eqRecaptchaLoaded&render=explicit&hl=es';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export interface RecaptchaHandle {
  reset: () => void;
}

/** Google reCAPTCHA v2 (casilla). No renderiza nada si no hay VITE_RECAPTCHA_SITE_KEY. */
const Recaptcha = forwardRef<RecaptchaHandle, { onChange: (token: string | null) => void }>(function Recaptcha({ onChange }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (widgetId.current !== null) window.grecaptcha?.reset(widgetId.current);
      cb.current(null);
    },
  }));

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY) return;
    let cancelled = false;
    loadScript().then(() => {
      if (cancelled || !el.current || widgetId.current !== null || !window.grecaptcha) return;
      widgetId.current = window.grecaptcha.render(el.current, {
        sitekey: RECAPTCHA_SITE_KEY,
        callback: (token: string) => cb.current(token),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!RECAPTCHA_SITE_KEY) return null;
  return <div ref={el} style={{ minHeight: 78 }} />;
});

export default Recaptcha;
