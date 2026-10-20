#!/usr/bin/env node
/**
 * Después de `vite build`: pre-renderiza las páginas públicas y genera sitemap.xml.
 * Usa las mismas funciones de SEO de la app (src/utils/seo.ts), compiladas con esbuild.
 * Variables: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_SITE_URL (Render o .env).
 */
import { readFile, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
const out = path.join(ROOT, 'node_modules', '.cache', 'prerender', 'main.mjs');
await mkdir(path.dirname(out), { recursive: true });

const env = (k, fallback = '') => JSON.stringify(process.env[k] ?? fallback);
await build({
  entryPoints: [path.join(ROOT, 'src', 'prerender', 'main.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  logLevel: 'warning',
  alias: { '@': path.join(ROOT, 'src') },
  define: {
    'import.meta.env.VITE_SITE_URL': JSON.stringify(SITE),
    'import.meta.env.VITE_WHATSAPP_NUMBER': env('VITE_WHATSAPP_NUMBER'),
    'import.meta.env.VITE_SUPABASE_URL': env('VITE_SUPABASE_URL'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': env('VITE_SUPABASE_ANON_KEY'),
    'import.meta.env.VITE_RECAPTCHA_SITE_KEY': env('VITE_RECAPTCHA_SITE_KEY'),
  },
});

const { run } = await import(pathToFileURL(out).href);
await run({
  site: SITE,
  dist: path.join(ROOT, 'dist'),
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  anonKey: process.env.VITE_SUPABASE_ANON_KEY,
});
await rm(path.dirname(out), { recursive: true, force: true });
