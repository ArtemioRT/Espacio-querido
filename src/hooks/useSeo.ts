import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { COMPANY, SITE_URL } from '@/utils/constants';

export interface SeoOptions {
  title?: string;
  description?: string | null;
  /** Ruta canónica (sin dominio). Por defecto, la ruta actual sin parámetros de seguimiento */
  canonical?: string;
  image?: string | null;
  type?: 'website' | 'article' | 'product';
  noindex?: boolean;
  /** Objetos schema.org que se insertan como JSON-LD */
  jsonLd?: Array<Record<string, unknown>>;
}

const DEFAULT_TITLE = 'Espacio Querido | Bienes raíces en Monterrey';
const DEFAULT_DESCRIPTION =
  'Compra, venta, renta e inversión inmobiliaria en Monterrey y su área metropolitana. Asesoría experta, financiamientos y catálogo de propiedades con Espacio Querido.';
const DEFAULT_IMAGE = '/images/hero.webp';

const absolute = (url: string) => (/^https?:\/\//.test(url) ? url : `${SITE_URL}${url.startsWith('/') ? '' : '/'}${url}`);

function setMeta(attr: 'name' | 'property', key: string, content: string | null) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (content == null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.content = content;
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** Recorta en límite de palabra para meta descripciones (~155 caracteres) */
export function summarize(text: string | null | undefined, max = 155): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, clean.lastIndexOf(' ', max - 1))}…`;
}

/**
 * Título, descripción, canonical, Open Graph, Twitter, robots y JSON-LD por página.
 * Al salir de la página se restauran los valores por defecto.
 */
export function useSeo(opts: SeoOptions) {
  const { pathname } = useLocation();
  const key = JSON.stringify(opts);

  useEffect(() => {
    const title = opts.title ? `${opts.title} | ${COMPANY.name}` : DEFAULT_TITLE;
    const description = summarize(opts.description) || DEFAULT_DESCRIPTION;
    const url = absolute(opts.canonical ?? pathname);
    const image = absolute(opts.image || DEFAULT_IMAGE);

    document.title = title;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', opts.noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setLink('canonical', url);

    setMeta('property', 'og:site_name', COMPANY.name);
    setMeta('property', 'og:locale', 'es_MX');
    setMeta('property', 'og:type', opts.type === 'product' ? 'product' : opts.type ?? 'website');
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:image:alt', opts.title ?? COMPANY.name);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    // JSON-LD propio de la página
    document.head.querySelectorAll('script[data-seo="page"]').forEach((s) => s.remove());
    (opts.jsonLd ?? []).forEach((data) => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.dataset.seo = 'page';
      s.textContent = JSON.stringify(data);
      document.head.appendChild(s);
    });

    return () => {
      document.head.querySelectorAll('script[data-seo="page"]').forEach((s) => s.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);
}
