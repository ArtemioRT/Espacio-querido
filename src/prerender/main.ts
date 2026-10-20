/**
 * Pre-renderizado estático (se ejecuta en Node después de `vite build`).
 *
 * Genera un HTML por página pública con el contenido real y las metas/JSON-LD,
 * para que buscadores y bots de IA que no ejecutan JavaScript lean la página completa.
 * Al cargar, React reemplaza este contenido por la app normal.
 *
 *   dist/index.html                       → inicio
 *   dist/propiedades/index.html           → catálogo (todas las activas)
 *   dist/propiedades/<slug>/index.html    → cada propiedad
 *   dist/aviso-de-privacidad/index.html
 *   dist/sitemap.xml, robots.txt, llms.txt (con el dominio configurado)
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { COMPANY, OPERATION_LABELS, PROPERTY_TYPE_LABELS } from '@/utils/constants';
import { BANKS, FAQS, SERVICES, WHY_US } from '@/utils/content';
import { formatNumber, formatPrice, locationLabel } from '@/utils/format';
import {
  breadcrumbLd, faqLd, itemListLd, listingLd, organizationLd, websiteLd, type Crumb,
} from '@/utils/seo';
import { catalogPath, facetCrumbs, facetHeading, slugify, TYPE_PLURAL, type CatalogFacet, type FacetNames } from '@/utils/catalog';
import type { OperationType, Property, PropertyImage, PropertyType, PublicAgent } from '@/types';

interface Ctx {
  site: string;
  dist: string;
  supabaseUrl?: string;
  anonKey?: string;
}

interface PageMeta {
  path: string;
  title: string;
  description: string;
  image?: string | null;
  type?: string;
  jsonLd: Array<Record<string, unknown>>;
  body: string;
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------
const esc = (s: unknown) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const summarize = (text: string | null | undefined, max = 155) => {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, clean.lastIndexOf(' ', max - 1))}…`;
};

const zoneOf = (p: Property) => ({
  state: p.state_slug || slugify(p.state) || undefined,
  city: p.city_slug || slugify(p.city) || undefined,
  neighborhood: p.neighborhood_slug || slugify(p.neighborhood) || undefined,
});

const matches = (p: Property, f: CatalogFacet) => {
  const z = zoneOf(p);
  return (
    (!f.operation || p.operation_type === f.operation) &&
    (!f.type || p.property_type === f.type) &&
    (!f.state || z.state === f.state) &&
    (!f.city || z.city === f.city) &&
    (!f.neighborhood || z.neighborhood === f.neighborhood)
  );
};

const typeOp = (p: Property) => `${PROPERTY_TYPE_LABELS[p.property_type]} en ${p.operation_type === 'sale' ? 'venta' : 'renta'}`;

function crumbsHtml(items: Crumb[]) {
  return `<nav aria-label="Ruta de navegación" class="pr-crumbs"><ol>${items
    .map((c, i) =>
      c.to && i < items.length - 1 ? `<li><a href="${esc(c.to)}">${esc(c.label)}</a></li>` : `<li aria-current="page">${esc(c.label)}</li>`,
    )
    .join('')}</ol></nav>`;
}

const header = () => `<header class="pr-header">
  <a href="/" class="pr-logo"><img src="/images/logo-icon.svg" alt="" width="36" height="36"><img src="/images/logo.svg" alt="Espacio Querido" height="26"></a>
  <nav aria-label="Principal"><a href="/#nosotros">Nosotros</a> <a href="/#servicios">Servicios</a> <a href="/propiedades">Propiedades</a> <a href="/#financiamientos">Financiamientos</a> <a href="/#faq">FAQ</a> <a href="/#contacto">¡Contáctanos!</a></nav>
</header>`;

const footer = () => `<footer class="pr-footer">
  <p><strong>${esc(COMPANY.name)}</strong> · ${esc(COMPANY.addressLine1)}, ${esc(COMPANY.addressLine2)}</p>
  <p>Tel. <a href="${esc(COMPANY.phoneHref)}">${esc(COMPANY.phone)}</a> · <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a> · <a href="/aviso-de-privacidad">Aviso de privacidad</a></p>
</footer>`;

const card = (p: Property) => `<li><a href="/propiedades/${esc(p.slug)}">
  ${p.cover_image_url ? `<img src="${esc(p.cover_image_url)}" alt="${esc(`${typeOp(p)} en ${locationLabel(p)}: ${p.title}`)}" loading="lazy" width="320" height="240">` : ''}
  <strong>${esc(formatPrice(p.price, p.currency, p.operation_type))}</strong>
  <span>${esc(p.title)}</span>
  <small>${esc(typeOp(p))}${locationLabel(p) ? ` · ${esc(locationLabel(p))}` : ''}</small>
  <small>${[
    p.bedrooms ? `${p.bedrooms} recámaras` : '',
    p.bathrooms ? `${p.bathrooms} baños` : '',
    p.parking_spaces ? `${p.parking_spaces} estacionamientos` : '',
    p.construction_m2 ? `${formatNumber(p.construction_m2)} m² construcción` : '',
    p.land_m2 ? `${formatNumber(p.land_m2)} m² terreno` : '',
  ]
    .filter(Boolean)
    .join(' · ')}</small>
</a></li>`;

// ---------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------
async function sb<T>(ctx: Ctx, pathAndQuery: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ctx.supabaseUrl}${pathAndQuery}`, {
    ...init,
    headers: { apikey: ctx.anonKey!, Authorization: `Bearer ${ctx.anonKey}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 160)}`);
  return res.json() as Promise<T>;
}

async function loadData(ctx: Ctx): Promise<{ properties: Property[]; agents: Map<string, PublicAgent> }> {
  const agents = new Map<string, PublicAgent>();
  if (!ctx.supabaseUrl || !ctx.anonKey) {
    console.warn('[prerender] Sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: solo páginas fijas.');
    return { properties: [], agents };
  }
  try {
    const properties = await sb<Property[]>(
      ctx,
      '/rest/v1/properties?select=*,images:property_images(id,property_id,url,storage_path,caption,position)&status=in.(active,finished)&order=updated_at.desc&limit=5000',
    );
    properties.forEach((p) => p.images?.sort((a: PropertyImage, b: PropertyImage) => a.position - b.position));

    const ids = [...new Set(properties.map((p) => p.agent_id).filter(Boolean))] as string[];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const rows = await sb<PublicAgent[]>(ctx, '/rest/v1/rpc/get_public_agent', { method: 'POST', body: JSON.stringify({ p_agent_id: id }) });
          if (rows[0]) agents.set(id, rows[0]);
        } catch {
          /* asesor no disponible */
        }
      }),
    );
    return { properties, agents };
  } catch (err) {
    console.warn('[prerender] No se pudieron leer las propiedades:', (err as Error).message);
    return { properties: [], agents };
  }
}

// ---------------------------------------------------------------------
// Páginas
// ---------------------------------------------------------------------
function homePage(featured: Property[]): PageMeta {
  const body = `${header()}
<main class="pr">
  <section><h1>Deja el proceso de elegir una casa en nuestras manos</h1>
    <p>Inmobiliaria en Monterrey, Nuevo León: compra, venta, renta e inversión de casas, departamentos, terrenos y locales.</p>
    <p><a href="/#contacto">¡Agenda tu cita con un experto!</a> · <a href="/propiedades">Conoce nuestro catálogo de propiedades</a></p>
  </section>
  <section id="servicios"><h2>Servicios</h2>${SERVICES.map((s) => `<article><h3>${esc(s.title)}</h3>${s.lines.map((l) => `<p>${esc(l)}</p>`).join('')}</article>`).join('')}</section>
  ${featured.length ? `<section><h2>Propiedades destacadas</h2><ul class="pr-grid">${featured.map(card).join('')}</ul><p><a href="/propiedades">Ver todas las propiedades</a></p></section>` : ''}
  <section id="nosotros"><h2>¿Por qué trabajar con nosotros?</h2>${WHY_US.map((p) => `<p>${esc(p)}</p>`).join('')}</section>
  <section id="financiamientos"><h2>Financiamientos</h2><ul>${BANKS.map((b) => `<li>${esc(b.name)}</li>`).join('')}</ul></section>
  <section id="faq"><h2>Preguntas frecuentes</h2>${FAQS.map((f) => `<h3>${esc(f.q)}</h3><p>${esc(f.a)}</p>`).join('')}</section>
</main>
${footer()}`;
  return {
    path: '/',
    title: 'Espacio Querido | Bienes raíces en Monterrey',
    description:
      'Compra, venta, renta e inversión inmobiliaria en Monterrey y su área metropolitana. Asesoría experta, financiamientos y catálogo de propiedades con Espacio Querido.',
    image: '/images/hero.webp',
    jsonLd: [organizationLd(), websiteLd(), faqLd()],
    body,
  };
}

function catalogPage(properties: Property[]): PageMeta {
  const active = properties.filter((p) => p.status === 'active');
  const crumbs: Crumb[] = [{ label: 'Inicio', to: '/' }, { label: 'Propiedades' }];

  // Índice por ubicación (enlaces internos a las páginas por zona)
  const byPlace = new Map<string, { label: string; n: number; to: string }>();
  active.forEach((p) => {
    const z = zoneOf(p);
    if (z.state && z.city) {
      const to = catalogPath({ state: z.state, city: z.city });
      const cur = byPlace.get(to) ?? { label: `${p.city}, ${p.state}`, n: 0, to };
      cur.n++;
      byPlace.set(to, cur);
    }
  });
  const places = [...byPlace.values()]
    .sort((a, b) => b.n - a.n)
    .map((x) => `<li><a href="${esc(x.to)}">${esc(x.label)}</a> (${x.n})</li>`)
    .join('');

  const body = `${header()}
<main class="pr">
  ${crumbsHtml(crumbs)}
  <h1>Propiedades en venta y renta en Monterrey y Nuevo León</h1>
  <p>${active.length} propiedades disponibles: casas, departamentos, terrenos y locales seleccionados por los asesores de Espacio Querido.</p>
  <p><a href="/venta">En venta</a> · <a href="/renta">En renta</a> · ${(Object.keys(TYPE_PLURAL) as PropertyType[])
    .filter((t) => active.some((p) => p.property_type === t))
    .map((t) => `<a href="${catalogPath({ type: t })}">${esc(TYPE_PLURAL[t])}</a>`)
    .join(' · ')}</p>
  ${places ? `<h2>Por ubicación</h2><ul>${places}</ul>` : ''}
  <h2>Catálogo</h2>
  <ul class="pr-grid">${active.map(card).join('')}</ul>
</main>
${footer()}`;

  return {
    path: '/propiedades',
    title: 'Propiedades en venta y renta en Monterrey y Nuevo León | Espacio Querido',
    description: `${active.length} propiedades en venta y renta en Monterrey y Nuevo León con fotos, precios y asesoría de Espacio Querido.`,
    jsonLd: [breadcrumbLd(crumbs), itemListLd(active.slice(0, 100), (p) => `/propiedades/${p.slug}`)],
    body,
  };
}

function propertyPage(p: Property, agent: PublicAgent | null, similar: Property[]): PageMeta {
  const url = `/propiedades/${p.slug}`;
  const zone: CatalogFacet = { operation: p.operation_type, type: p.property_type, ...zoneOf(p) };
  const crumbs: Crumb[] = [
    ...facetCrumbs(zone, { state: p.state ?? undefined, city: p.city ?? undefined, neighborhood: p.neighborhood ?? undefined }),
    { label: `ID ${p.code} · ${p.title}` },
  ];

  const where = [p.neighborhood, p.city].filter(Boolean).join(', ');
  const title = `${typeOp(p)} en ${where || p.title} · ID ${p.code} | Espacio Querido`;
  const facts = [
    ['Precio', `${formatPrice(p.price, p.currency, p.operation_type)}${p.currency === 'MXN' ? ' MXN' : ''}`],
    ['Operación', OPERATION_LABELS[p.operation_type]],
    ['Tipo', PROPERTY_TYPE_LABELS[p.property_type]],
    p.bedrooms ? ['Recámaras', p.bedrooms] : null,
    p.bathrooms ? ['Baños', `${p.bathrooms}${p.half_bathrooms ? ` y ${p.half_bathrooms} medio` : ''}`] : null,
    p.parking_spaces ? ['Estacionamientos', p.parking_spaces] : null,
    p.construction_m2 ? ['Construcción', `${formatNumber(p.construction_m2)} m²`] : null,
    p.land_m2 ? ['Terreno', `${formatNumber(p.land_m2)} m²`] : null,
    p.floors ? ['Plantas', p.floors] : null,
    p.year_built ? ['Año de construcción', p.year_built] : null,
    p.maintenance_fee ? ['Mantenimiento', formatPrice(p.maintenance_fee, p.currency)] : null,
  ].filter(Boolean) as Array<[string, string | number]>;

  const images = (p.images?.length ? p.images : p.cover_image_url ? [{ url: p.cover_image_url, caption: null }] : []) as Array<Pick<PropertyImage, 'url' | 'caption'>>;
  const contact = agent?.full_name || COMPANY.name;
  const phone = agent?.phone || COMPANY.phone;

  const body = `${header()}
<main class="pr">
  ${crumbsHtml(crumbs)}
  <article>
    <p class="pr-code">ID ${p.code}</p>
    <h1>${esc(p.title)}</h1>
    <p>${esc(typeOp(p))}${locationLabel(p) ? ` en ${esc([p.address, locationLabel(p)].filter(Boolean).join(', '))}` : ''}</p>
    ${p.status === 'finished' ? `<p><strong>Esta propiedad ya fue ${p.operation_type === 'sale' ? 'vendida' : 'rentada'}.</strong></p>` : ''}
    <p class="pr-price">${esc(facts[0][1])}</p>
    <div class="pr-gallery">${images
      .slice(0, 12)
      .map((img, i) => `<img src="${esc(img.url)}" alt="${esc(img.caption || `${typeOp(p)} en ${where} – foto ${i + 1} de ${images.length}`)}" ${i ? 'loading="lazy"' : ''} width="640" height="480">`)
      .join('')}</div>
    <h2>Características</h2>
    <dl class="pr-facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    ${p.description ? `<h2>Descripción</h2>${p.description.split(/\n+/).map((t) => `<p>${esc(t)}</p>`).join('')}` : ''}
    ${p.amenities.length ? `<h2>Amenidades</h2><ul>${p.amenities.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
    ${
      p.latitude != null && p.longitude != null
        ? `<h2>Ubicación</h2><p><a href="https://www.google.com/maps/search/?api=1&amp;query=${p.latitude},${p.longitude}">Ver ubicación en Google Maps</a></p>`
        : ''
    }
    <h2>Contacta al asesor</h2>
    <p><strong>${esc(contact)}</strong>${agent?.title ? ` · ${esc(agent.title)}` : ''} · Tel. <a href="tel:${esc(phone.replace(/\s/g, ''))}">${esc(phone)}</a></p>
  </article>
  <p><a href="${esc(catalogPath(zone))}">Ver más ${esc(TYPE_PLURAL[p.property_type].toLowerCase())} en ${p.operation_type === 'sale' ? 'venta' : 'renta'}${p.neighborhood ? ` en ${esc(p.neighborhood)}` : p.city ? ` en ${esc(p.city)}` : ''}</a></p>
  ${similar.length ? `<section><h2>Propiedades similares</h2><ul class="pr-grid">${similar.map(card).join('')}</ul></section>` : ''}
</main>
${footer()}`;

  return {
    path: url,
    title,
    description: summarize(
      `${facts[0][1]}${p.bedrooms ? ` · ${p.bedrooms} recámaras` : ''}${p.bathrooms ? ` · ${p.bathrooms} baños` : ''}${
        p.construction_m2 ? ` · ${formatNumber(p.construction_m2)} m² de construcción` : ''
      }${p.land_m2 ? ` · ${formatNumber(p.land_m2)} m² de terreno` : ''}. ${summarize(p.description, 90)}`,
    ),
    image: p.cover_image_url,
    type: 'article',
    jsonLd: [listingLd(p, url, agent), breadcrumbLd(crumbs)],
    body,
  };
}

/** Todas las combinaciones operación × tipo × zona que tienen al menos una propiedad activa */
function zoneFacets(active: Property[]): CatalogFacet[] {
  const set = new Map<string, CatalogFacet>();
  const ops: Array<OperationType | undefined> = [undefined, 'sale', 'rent'];
  for (const p of active) {
    const z = zoneOf(p);
    const levels: Array<Pick<CatalogFacet, 'state' | 'city' | 'neighborhood'>> = [{}];
    if (z.state) levels.push({ state: z.state });
    if (z.state && z.city) levels.push({ state: z.state, city: z.city });
    if (z.state && z.city && z.neighborhood) levels.push({ state: z.state, city: z.city, neighborhood: z.neighborhood });
    for (const op of ops) {
      if (op && p.operation_type !== op) continue;
      for (const type of [undefined, p.property_type]) {
        for (const lv of levels) {
          const f: CatalogFacet = { operation: op, type, ...lv };
          const key = catalogPath(f);
          if (key !== '/propiedades') set.set(key, f);
        }
      }
    }
  }
  return [...set.values()];
}

function namesFor(items: Property[]): FacetNames {
  const p = items[0];
  return p ? { state: p.state ?? undefined, city: p.city ?? undefined, neighborhood: p.neighborhood ?? undefined } : {};
}

function zonePage(f: CatalogFacet, active: Property[]): PageMeta {
  const items = active.filter((p) => matches(p, f));
  const names = namesFor(items);
  const heading = facetHeading(f, names);
  const crumbs = facetCrumbs(f, names) as Crumb[];
  const path = catalogPath(f);

  // Resumen único por página (evita contenido delgado/duplicado)
  const mxn = items.filter((p) => p.currency === 'MXN').map((p) => p.price).filter((n) => n > 0);
  const lo = mxn.length ? Math.min(...mxn) : 0;
  const hi = mxn.length ? Math.max(...mxn) : 0;
  const range = !mxn.length ? '' : lo === hi ? `con precio de ${formatPrice(lo)}` : `con precios desde ${formatPrice(lo)} hasta ${formatPrice(hi)}`;
  const types = [...new Set(items.map((p) => TYPE_PLURAL[p.property_type].toLowerCase()))];
  const intro = `Hay ${items.length} ${items.length === 1 ? 'opción disponible' : 'opciones disponibles'}${range ? ` ${range}` : ''}${
    !f.type && types.length > 1 ? `, entre ${types.slice(0, -1).join(', ')} y ${types.slice(-1)}` : ''
  }. Cada propiedad incluye fotos, características, ubicación y contacto directo con un asesor de ${COMPANY.name}.`;

  // Sub-zonas y operaciones relacionadas
  const childKey = f.neighborhood ? null : f.city ? 'neighborhood' : f.state ? 'city' : 'state';
  const children = new Map<string, { label: string; n: number }>();
  if (childKey) {
    for (const p of items) {
      const z = zoneOf(p);
      const slug = z[childKey];
      if (!slug) continue;
      const label = (childKey === 'state' ? p.state : childKey === 'city' ? p.city : p.neighborhood) ?? slug;
      const to = catalogPath({ ...f, [childKey]: slug });
      const cur = children.get(to) ?? { label, n: 0 };
      cur.n++;
      children.set(to, cur);
    }
  }
  const related = (['sale', 'rent', undefined] as Array<OperationType | undefined>)
    .filter((op) => op !== f.operation)
    .map((op) => ({ f: { ...f, operation: op }, label: facetHeading({ ...f, operation: op }, names) }))
    .filter((r) => active.some((p) => matches(p, r.f)));

  const body = `${header()}
<main class="pr">
  ${crumbsHtml(crumbs)}
  <h1>${esc(heading)}</h1>
  <p>${esc(intro)}</p>
  ${
    children.size
      ? `<h2>${childKey === 'state' ? 'Por estado' : childKey === 'city' ? 'Por municipio' : 'Por colonia'}</h2><ul>${[...children.entries()]
          .sort((a, b) => b[1].n - a[1].n)
          .map(([to, c]) => `<li><a href="${esc(to)}">${esc(c.label)}</a> (${c.n})</li>`)
          .join('')}</ul>`
      : ''
  }
  <ul class="pr-grid">${items.map(card).join('')}</ul>
  ${related.length ? `<p>${related.map((r) => `<a href="${esc(catalogPath(r.f))}">${esc(r.label)}</a>`).join(' · ')}</p>` : ''}
</main>
${footer()}`;

  return {
    path,
    title: `${heading} | ${COMPANY.name}`,
    description: summarize(`${heading}: ${intro}`),
    image: items.find((p) => p.cover_image_url)?.cover_image_url,
    jsonLd: [breadcrumbLd(crumbs), itemListLd(items.slice(0, 100), (p) => `/propiedades/${p.slug}`)],
    body,
  };
}

function privacyPage(): PageMeta {
  const crumbs: Crumb[] = [{ label: 'Inicio', to: '/' }, { label: 'Aviso de privacidad' }];
  return {
    path: '/aviso-de-privacidad',
    title: 'Aviso de privacidad | Espacio Querido',
    description: 'Conoce cómo Espacio Querido recolecta, usa y protege tus datos personales, y cómo ejercer tus derechos ARCO.',
    jsonLd: [breadcrumbLd(crumbs)],
    body: `${header()}<main class="pr">${crumbsHtml(crumbs)}<h1>Aviso de Privacidad</h1><p>Política de Privacidad de Espacio Querido. Espacio Querido se compromete a proteger la privacidad de nuestros usuarios y clientes.</p><p>Para ejercer tus derechos ARCO escribe a <a href="mailto:${esc(COMPANY.email)}">${esc(COMPANY.email)}</a>.</p></main>${footer()}`,
  };
}

// ---------------------------------------------------------------------
// Plantilla
// ---------------------------------------------------------------------
const PRERENDER_CSS = `<style id="prerender-css">
.pr-header,.pr,.pr-footer{font-family:'Space Mono',ui-monospace,monospace;max-width:1160px;margin:0 auto;padding:16px;color:#2d2d2d}
.pr-header{display:flex;flex-wrap:wrap;gap:16px;align-items:center;justify-content:space-between}.pr-header nav a{margin-right:14px;font-size:12px;text-transform:uppercase;font-weight:700;color:#0e0e0e;text-decoration:none}
.pr-logo{display:inline-flex;gap:10px;align-items:center}.pr h1,.pr h2,.pr h3{font-family:'Albra','Playfair Display',Georgia,serif;font-weight:400;color:#9b1b3a}
.pr img{max-width:100%;height:auto}.pr a{color:#9b1b3a}.pr-crumbs ol{list-style:none;display:flex;flex-wrap:wrap;gap:6px;padding:0;font-size:12px}.pr-crumbs li+li:before{content:'›';margin-right:6px}
.pr-grid{list-style:none;padding:0;display:grid;gap:18px;grid-template-columns:repeat(auto-fill,minmax(240px,1fr))}.pr-grid a{display:flex;flex-direction:column;gap:4px;text-decoration:none;color:inherit}
.pr-gallery{display:grid;gap:8px;grid-template-columns:repeat(auto-fill,minmax(200px,1fr))}.pr-price{font-size:28px;font-weight:700;color:#9b1b3a}.pr-code{color:#9b1b3a;font-weight:700}
.pr-facts{display:grid;grid-template-columns:max-content 1fr;gap:6px 18px}.pr-facts dd{margin:0;font-weight:700}.pr-footer{background:#000;color:#fff;max-width:none}.pr-footer a{color:#fff}
</style>`;

function renderHtml(template: string, page: PageMeta, site: string): string {
  // El inicio también es la página de respaldo de la SPA (panel, login…): ahí se borra el
  // contenido estático antes de pintar si la ruta no es "/".
  const guard =
    page.path === '/' ? `<script>if(location.pathname!=='/'){document.getElementById('root').innerHTML='';}</script>` : '';
  const abs = (u: string) => (/^https?:\/\//.test(u) ? u : `${site}${u}`);
  const image = abs(page.image || '/images/hero.webp');
  const url = abs(page.path);

  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${esc(COMPANY.name)}" />`,
    `<meta property="og:locale" content="es_MX" />`,
    `<meta property="og:type" content="${esc(page.type ?? 'website')}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    // data-seo="page": useSeo los reemplaza al navegar dentro de la app
    ...page.jsonLd.map((d) => `<script type="application/ld+json" data-seo="page">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`),
    PRERENDER_CSS,
  ].join('\n    ');

  return template
    .replace(/<title>[\s\S]*?<\/title>\s*/, '')
    .replace(/\s*<meta name="(description|robots|twitter:[^"]+)"[^>]*>/g, '')
    .replace(/\s*<meta property="og:[^"]+"[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<noscript>[\s\S]*?<\/noscript>/, '')
    .replace('</head>', `    ${head}\n  </head>`)
    .replace('<div id="root"></div>', `<div id="root">${page.body}${guard}</div>`);
}

// ---------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------
function sitemap(site: string, properties: Property[]): string {
  const urls: Array<{ loc: string; lastmod?: string; priority: string; changefreq: string; image?: { loc: string; title: string } }> = [
    { loc: '/', priority: '1.0', changefreq: 'weekly' },
    { loc: '/propiedades', priority: '0.9', changefreq: 'daily' },
    { loc: '/aviso-de-privacidad', priority: '0.2', changefreq: 'yearly' },
  ];
  for (const p of properties) {
    urls.push({
      loc: `/propiedades/${encodeURIComponent(p.slug)}`,
      lastmod: p.updated_at?.slice(0, 10),
      priority: p.status === 'active' ? '0.8' : '0.3',
      changefreq: 'weekly',
      image: p.cover_image_url ? { loc: p.cover_image_url, title: p.title } : undefined,
    });
  }
  for (const f of zoneFacets(properties.filter((p) => p.status === 'active'))) {
    const depth = [f.type, f.state, f.city, f.neighborhood].filter(Boolean).length;
    urls.push({ loc: catalogPath(f), priority: depth <= 1 ? '0.8' : depth === 2 ? '0.7' : '0.6', changefreq: 'daily' });
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url>\n    <loc>${esc(site + u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${
        u.image ? `\n    <image:image><image:loc>${esc(u.image.loc)}</image:loc><image:title>${esc(u.image.title)}</image:title></image:image>` : ''
      }\n  </url>`,
  )
  .join('\n')}
</urlset>
`;
}

// ---------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------
export async function run(ctx: Ctx) {
  const template = await readFile(path.join(ctx.dist, 'index.html'), 'utf8');
  const { properties, agents } = await loadData(ctx);
  const active = properties.filter((p) => p.status === 'active');

  // Se escribe como /ruta/index.html y como /ruta.html: así funciona con URLs limpias
  // tanto en `vite preview` (Web Service) como en hostings estáticos.
  const write = async (route: string, html: string) => {
    if (route === '/') {
      await writeFile(path.join(ctx.dist, 'index.html'), html);
      return;
    }
    const parts = route.split('/').filter(Boolean);
    const dirFile = path.join(ctx.dist, ...parts, 'index.html');
    const flatFile = path.join(ctx.dist, ...parts.slice(0, -1), `${parts[parts.length - 1]}.html`);
    await mkdir(path.dirname(dirFile), { recursive: true });
    await writeFile(dirFile, html);
    await writeFile(flatFile, html);
  };

  // Copia limpia de la app para rutas sin pre-render (panel, login, etc.)
  await writeFile(path.join(ctx.dist, 'app.html'), template);

  const featured = [...active].sort((a, b) => Number(b.featured) - Number(a.featured)).slice(0, 6);
  const pages: PageMeta[] = [homePage(featured), catalogPage(properties), privacyPage()];
  const facets = zoneFacets(active);
  facets.forEach((f) => pages.push(zonePage(f, active)));

  for (const p of properties) {
    const similar = active
      .filter((o) => o.id !== p.id && o.operation_type === p.operation_type && (!p.city || o.city === p.city))
      .slice(0, 3);
    pages.push(propertyPage(p, p.agent_id ? agents.get(p.agent_id) ?? null : null, similar));
  }

  for (const page of pages) {
    const html = renderHtml(template, page, ctx.site);
    await write(page.path, html);
  }

  // sitemap, robots y llms con el dominio real
  await writeFile(path.join(ctx.dist, 'sitemap.xml'), sitemap(ctx.site, properties));
  for (const file of ['robots.txt', 'llms.txt']) {
    try {
      const p = path.join(ctx.dist, file);
      await writeFile(p, (await readFile(p, 'utf8')).replace(/https:\/\/espacioquerido\.mx/g, ctx.site));
    } catch {
      /* archivo opcional */
    }
  }

  console.log(
    `[prerender] ${pages.length} páginas (${properties.length} propiedades, ${facets.length} páginas por zona) + sitemap.xml · dominio ${ctx.site}`,
  );
}
