#!/usr/bin/env node
/**
 * Descarga las imágenes del sitio actual en alta resolución, las convierte a WebP
 * (y a SVG los logos de un solo color) y las guarda en public/images/.
 *
 *   npm run images            → descarga y convierte todo
 *   npm run images -- --force → vuelve a descargar aunque ya existan
 *
 * Después abre scripts/team-preview.html para confirmar que cada foto del equipo
 * tenga el nombre correcto (se corrige en src/utils/team.json).
 */
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import potrace from 'potrace';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'public', 'images');
const FORCE = process.argv.includes('--force');

const manifest = JSON.parse(await readFile(path.join(__dirname, 'images.manifest.json'), 'utf8'));

/** Agranda la miniatura de Wix (fill/w_X,h_Y) y quita la conversión a AVIF */
function hiResUrl(url, scale = 1, maxWidth = 2400) {
  return url
    .replace(/fill\/w_(\d+),h_(\d+)/, (_, w, h) => {
      let nw = Math.round(Number(w) * scale);
      let nh = Math.round(Number(h) * scale);
      if (nw > maxWidth) {
        nh = Math.round((nh * maxWidth) / nw);
        nw = maxWidth;
      }
      return `fill/w_${nw},h_${nh}`;
    })
    .replace(',enc_avif,quality_auto', '');
}

const exists = (p) => access(p).then(() => true, () => false);

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (EspacioQuerido image sync)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Color dominante de los píxeles visibles (para pintar el SVG del logo) */
async function dominantColor(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] > 200) {
      r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
    }
  }
  if (!n) return '#000000';
  const hex = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Vectoriza usando la transparencia como máscara (logos PNG de un color) */
async function toSvg(buf) {
  const meta = await sharp(buf).metadata();
  const color = await dominantColor(buf);
  const mask = meta.hasAlpha
    ? await sharp(buf).extractChannel('alpha').negate().png().toBuffer()
    : await sharp(buf).greyscale().png().toBuffer();
  const svg = await new Promise((resolve, reject) =>
    potrace.trace(mask, { color, background: 'transparent', threshold: 128, turdSize: 2, optTolerance: 0.3 }, (err, out) =>
      err ? reject(err) : resolve(out),
    ),
  );
  return svg;
}

async function processItem({ out, url, scale = 1, maxWidth, svg, white }) {
  const target = path.join(OUT, `${out}.webp`);
  if (!FORCE && (await exists(target))) return `= ${out}.webp (ya existe)`;

  await mkdir(path.dirname(target), { recursive: true });
  const buf = await download(hiResUrl(url, scale, maxWidth));
  const img = sharp(buf);
  const meta = await img.metadata();
  const pipeline = maxWidth && meta.width > maxWidth ? img.resize({ width: maxWidth }) : img;
  await pipeline.webp({ quality: meta.hasAlpha ? 90 : 82, alphaQuality: 100, effort: 5 }).toFile(target);
  const done = [`${out}.webp`];

  if (svg) {
    await writeFile(path.join(OUT, `${out}.svg`), await toSvg(buf));
    done.push(`${out}.svg`);
  }

  // Versión blanca del logo para fondos oscuros (panel, login)
  if (white) {
    const whiteBuf = await sharp(buf)
      .ensureAlpha()
      .composite([{ input: { create: { width: meta.width, height: meta.height, channels: 4, background: '#ffffff' } }, blend: 'in' }])
      .png()
      .toBuffer();
    await sharp(whiteBuf).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(OUT, `${white}.webp`));
    await writeFile(path.join(OUT, `${white}.svg`), await toSvg(whiteBuf));
    done.push(`${white}.webp`, `${white}.svg`);
  }
  return `✓ ${done.join(', ')}`;
}

const jobs = [
  ...manifest.items,
  ...manifest.team.map((url, i) => ({ out: `team/${String(i + 1).padStart(2, '0')}`, url, scale: 3 })),
];

let ok = 0;
let failed = 0;
for (const job of jobs) {
  try {
    console.log(await processItem(job));
    ok++;
  } catch (err) {
    console.error(`✗ ${job.out}: ${err.message}`);
    failed++;
  }
}

// Favicon PNG a partir del ícono circular
try {
  const icon = path.join(OUT, 'logo-icon.webp');
  if (await exists(icon)) {
    await sharp(icon).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(path.join(OUT, 'favicon.png'));
    console.log('✓ favicon.png');
  }
} catch (err) {
  console.error('✗ favicon:', err.message);
}

// Hoja de contacto para revisar nombres del equipo
const TEAM_PREVIEW = JSON.parse(await readFile(path.join(ROOT, 'src', 'utils', 'team.json'), 'utf8')).map((m) => [m.name, m.photo]);
const html = `<!doctype html><meta charset="utf-8"><title>Equipo · revisión</title>
<style>body{font-family:system-ui;margin:24px;background:#f4f4f4}h1{font-size:20px}p{color:#666}
ul{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:16px}
li{background:#fff;border-radius:10px;padding:12px;text-align:center;font-size:13px}
img{width:120px;height:120px;border-radius:50%;object-fit:cover;display:block;margin:0 auto 8px;background:#eee}
code{font-size:11px;color:#9b1b3a}</style>
<h1>Equipo: ¿coincide cada foto con su nombre?</h1>
<p>Si alguna no coincide, cambia el campo <code>photo</code> de esa persona en <code>src/utils/team.json</code>.</p>
<ul>${TEAM_PREVIEW.map(([name, file]) => `<li><img src="../public/images/team/${file}"><strong>${name}</strong><br><code>${file}</code></li>`).join('')}</ul>`;
await writeFile(path.join(__dirname, 'team-preview.html'), html);

console.log(`\nListo: ${ok} correctas, ${failed} con error. Revisa scripts/team-preview.html`);
if (failed) process.exitCode = 1;
