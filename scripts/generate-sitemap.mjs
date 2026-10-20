#!/usr/bin/env node
/**
 * Genera dist/sitemap.xml al compilar (npm run build).
 * Incluye páginas fijas, facetas de ubicación y todas las propiedades activas/finalizadas.
 * Lee VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y VITE_SITE_URL del entorno (Render) o de .env.
 */
import { readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

// Carga .env local si existe (en Render las variables ya vienen en el entorno)
try {
  const env = await readFile(path.join(ROOT, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
} catch {
  /* sin .env */
}

const SITE = (process.env.VITE_SITE_URL || 'https://espacioquerido.mx').replace(/\/$/, '');
const SB_URL = process.env.VITE_SUPABASE_URL;
const SB_KEY = process.env.VITE_SUPABASE_ANON_KEY;

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

const urls = [
  { loc: '/', priority: '1.0', changefreq: 'weekly' },
  { loc: '/propiedades', priority: '0.9', changefreq: 'daily' },
  { loc: '/propiedades?operation=sale', priority: '0.8', changefreq: 'daily' },
  { loc: '/propiedades?operation=rent', priority: '0.8', changefreq: 'daily' },
  { loc: '/aviso-de-privacidad', priority: '0.2', changefreq: 'yearly' },
];

let props = 0;
if (SB_URL && SB_KEY) {
  try {
    const headers = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` };
    const res = await fetch(
      `${SB_URL}/rest/v1/properties?select=slug,title,updated_at,status,cover_image_url,state,city,neighborhood&status=in.(active,finished)&order=updated_at.desc&limit=5000`,
      { headers },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = await res.json();

    const facets = new Set();
    for (const p of rows) {
      urls.push({
        loc: `/propiedades/${encodeURIComponent(p.slug)}`,
        lastmod: day(p.updated_at),
        priority: p.status === 'active' ? '0.8' : '0.3',
        changefreq: 'weekly',
        image: p.cover_image_url ? { loc: p.cover_image_url, title: p.title } : null,
      });
      if (p.status === 'active' && p.state) {
        facets.add(`state=${encodeURIComponent(p.state)}`);
        if (p.city) facets.add(`state=${encodeURIComponent(p.state)}&city=${encodeURIComponent(p.city)}`);
        if (p.city && p.neighborhood)
          facets.add(`state=${encodeURIComponent(p.state)}&city=${encodeURIComponent(p.city)}&neighborhood=${encodeURIComponent(p.neighborhood)}`);
      }
      props++;
    }
    for (const f of facets) urls.push({ loc: `/propiedades?${f}`, priority: '0.6', changefreq: 'daily' });
  } catch (err) {
    console.warn('[sitemap] No se pudieron leer las propiedades:', err.message);
  }
} else {
  console.warn('[sitemap] Sin VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY: solo páginas fijas.');
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(SITE + u.loc)}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${
      u.image ? `\n    <image:image><image:loc>${esc(u.image.loc)}</image:loc><image:title>${esc(u.image.title)}</image:title></image:image>` : ''
    }
  </url>`,
  )
  .join('\n')}
</urlset>
`;

const exists = await access(DIST).then(() => true, () => false);
if (!exists) {
  console.warn('[sitemap] No existe dist/. Ejecuta primero vite build.');
  process.exit(0);
}
await writeFile(path.join(DIST, 'sitemap.xml'), xml);

// robots.txt con la URL real del sitio
const robots = (await readFile(path.join(ROOT, 'public', 'robots.txt'), 'utf8')).replace(/https:\/\/espacioquerido\.mx/g, SITE);
await writeFile(path.join(DIST, 'robots.txt'), robots);

// llms.txt y canonical de index.html con el dominio configurado
for (const file of ['llms.txt', 'index.html']) {
  const p = path.join(DIST, file);
  const txt = await readFile(p, 'utf8');
  await writeFile(p, txt.replace(/https:\/\/espacioquerido\.mx/g, SITE));
}

console.log(`[sitemap] ${urls.length} URLs (${props} propiedades) → dist/sitemap.xml · dominio ${SITE}`);
