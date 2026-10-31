import * as THREE from 'three';
import type { Site } from '@/types/archive';

export type CaseTextureKind = 'spine' | 'cover' | 'back';

const textureCache = new Map<string, Promise<THREE.CanvasTexture>>();

export const SPINE_PX = { w: 192, h: 1280 };
export const COVER_PX = { w: 768, h: 1075 };

const INK = '#e9e4d8';
const MUTED = '#8a8578';
const MARIGOLD = '#ff9e00';

/** Resolves the real family name next/font assigned to one of our CSS variables. */
function family(cssVar: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value ? `${value}, ${fallback}` : fallback;
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  const n = m ? parseInt(m[1], 16) : 0xff9e00;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h.toFixed(1)}, ${(s * 100).toFixed(1)}%, ${(l * 100).toFixed(1)}%)`;
}

interface Palette {
  bg: string;
  bgEdge: string;
  ink: string;
  sub: string;
  band: string;
}

/** Deterministic spine palette: one of three Criterion-like treatments derived from the site's accent. */
export function spinePalette(site: Site): Palette {
  const [h0, s0] = hexToHsl(site.accentColor);
  const seed = hashString(site.id);
  // Greys and near-blacks get a hue from the id so the shelf stays varied.
  const h = s0 < 0.12 ? seed % 360 : h0;
  const s = Math.min(Math.max(s0, 0.35), 0.7);
  switch (seed % 3) {
    case 0:
      return { bg: hsl(h, s * 0.55, 0.15), bgEdge: hsl(h, s * 0.55, 0.09), ink: INK, sub: hsl(h, 0.35, 0.68), band: hsl(h, s, 0.55) };
    case 1:
      return { bg: hsl(h, 0.22, 0.86), bgEdge: hsl(h, 0.2, 0.74), ink: '#16130f', sub: hsl(h, s * 0.8, 0.32), band: hsl(h, s, 0.45) };
    default:
      return { bg: hsl(h, s, 0.36), bgEdge: hsl(h, s, 0.24), ink: '#fbf6ea', sub: hsl(h, 0.5, 0.85), band: '#16130f' };
  }
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return lines;
}

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: string, fam: string, max: number, min: number, width: number): number {
  let size = max;
  ctx.font = `${weight} ${size}px ${fam}`;
  while (size > min && ctx.measureText(text).width > width) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${fam}`;
  }
  return size;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, width: number): string {
  if (ctx.measureText(text).width <= width) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > width) t = t.slice(0, -1);
  return `${t}…`;
}

export const spineNumber = (n: number): string => `#${String(n).padStart(3, '0')}`;

function drawSpine(ctx: CanvasRenderingContext2D, site: Site): void {
  const { w, h } = SPINE_PX;
  const p = spinePalette(site);
  const label = family('--nf-label', 'sans-serif');
  const mono = family('--nf-mono', 'monospace');
  const display = family('--nf-display', 'serif');

  const bg = ctx.createLinearGradient(0, 0, w, 0);
  bg.addColorStop(0, p.bgEdge);
  bg.addColorStop(0.18, p.bg);
  bg.addColorStop(0.82, p.bg);
  bg.addColorStop(1, p.bgEdge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Spine number + band
  ctx.fillStyle = p.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 34px ${mono}`;
  ctx.fillText(spineNumber(site.spine), w / 2, 74);
  ctx.fillStyle = p.band;
  ctx.fillRect(22, 98, w - 44, 10);

  // Vertical title, reading top to bottom
  const title = site.title.toUpperCase();
  const available = 860;
  ctx.save();
  ctx.translate(w / 2, 150);
  ctx.rotate(Math.PI / 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = p.ink;
  const size = fitFont(ctx, title, '700', label, 84, 40, available);
  ctx.font = `700 ${size}px ${label}`;
  ctx.fillText(ellipsize(ctx, title, available), 0, -14);
  ctx.fillStyle = p.sub;
  ctx.font = `500 24px ${mono}`;
  ctx.fillText(ellipsize(ctx, site.url, available), 2, size / 2 + 22);
  ctx.restore();

  // Years + closet mark
  ctx.fillStyle = p.band;
  ctx.fillRect(22, h - 236, w - 44, 4);
  ctx.fillStyle = p.ink;
  ctx.textAlign = 'center';
  ctx.font = `500 30px ${mono}`;
  ctx.fillText(String(site.firstCaptured), w / 2, h - 182);
  ctx.fillStyle = p.sub;
  ctx.fillText('—', w / 2, h - 146);
  ctx.fillStyle = p.ink;
  ctx.fillText(String(site.lastCaptured), w / 2, h - 110);
  ctx.font = `italic 400 40px ${display}`;
  ctx.fillText('404', w / 2, h - 44);

  grain(ctx, w, h, 14);
}

function drawCover(ctx: CanvasRenderingContext2D, site: Site): void {
  const { w, h } = COVER_PX;
  const p = spinePalette(site);
  const label = family('--nf-label', 'sans-serif');
  const mono = family('--nf-mono', 'monospace');
  const display = family('--nf-display', 'serif');
  const f = site.forensics;

  ctx.fillStyle = '#0f0e12';
  ctx.fillRect(0, 0, w, h);

  // Art area: a period browser window rendered from the scraped page text.
  const ax = 44;
  const ay = 44;
  const aw = w - 88;
  const ah = 640;
  const tint = ctx.createLinearGradient(0, ay, 0, ay + ah);
  tint.addColorStop(0, p.bg);
  tint.addColorStop(1, p.bgEdge);
  ctx.fillStyle = tint;
  ctx.fillRect(ax - 20, ay - 20, aw + 40, ah + 40);

  ctx.fillStyle = '#c3c0b8';
  ctx.fillRect(ax, ay, aw, ah);
  const bar = ctx.createLinearGradient(ax, 0, ax + aw, 0);
  bar.addColorStop(0, '#0b1a5c');
  bar.addColorStop(1, p.band);
  ctx.fillStyle = bar;
  ctx.fillRect(ax + 4, ay + 4, aw - 8, 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 22px ${label}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(ellipsize(ctx, f.title || site.title, aw - 140), ax + 16, ay + 25);
  for (let i = 0; i < 3; i++) {
    const bx = ax + aw - 36 - i * 30;
    ctx.fillStyle = '#c3c0b8';
    ctx.fillRect(bx, ay + 12, 24, 22);
    ctx.strokeStyle = '#ffffff';
    ctx.strokeRect(bx + 0.5, ay + 12.5, 23, 21);
  }

  // Address bar
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(ax + 14, ay + 56, aw - 28, 34);
  ctx.strokeStyle = '#6d6a64';
  ctx.strokeRect(ax + 14.5, ay + 56.5, aw - 29, 33);
  ctx.fillStyle = '#1a1714';
  ctx.font = `400 18px ${mono}`;
  ctx.fillText(ellipsize(ctx, `http://${site.url.replace(/^https?:\/\//, '')}`, aw - 52), ax + 24, ay + 74);

  // Page body (real scraped text)
  const px = ax + 14;
  const py = ay + 102;
  const pw = aw - 28;
  ctx.fillStyle = '#fdfcf7';
  ctx.fillRect(px, py, pw, ah - 116);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0000ee';
  ctx.font = `700 34px "Times New Roman", Times, serif`;
  const headline = wrapLines(ctx, f.title || site.title, pw - 40, 2);
  headline.forEach((line, i) => ctx.fillText(line, px + 20, py + 46 + i * 38));
  let y = py + 50 + headline.length * 38;
  ctx.fillStyle = '#1a1714';
  ctx.font = `400 22px "Times New Roman", Times, serif`;
  const body = wrapLines(ctx, f.bodyText, pw - 40, f.comments.length > 0 ? 9 : 12);
  body.forEach((line) => {
    ctx.fillText(line, px + 20, y);
    y += 29;
  });
  if (f.comments.length > 0) {
    y += 12;
    ctx.font = `400 17px ${mono}`;
    ctx.fillStyle = '#e6efe1';
    ctx.fillRect(px + 16, y - 22, pw - 32, 34);
    ctx.fillStyle = '#2b6a2e';
    ctx.fillText(ellipsize(ctx, `<!-- ${f.comments[0]} -->`, pw - 52), px + 26, y);
  }

  // Scanlines over the art
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let sy = ay; sy < ay + ah; sy += 3) ctx.fillRect(ax, sy, aw, 1);

  // Title block
  ctx.fillStyle = MARIGOLD;
  ctx.font = `700 18px ${mono}`;
  ctx.textAlign = 'left';
  ctx.fillText(`THE CLOSET 404 COLLECTION  ${spineNumber(site.spine)}`, 44, 744);
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(44, 760, w - 88, 1);
  ctx.fillStyle = INK;
  const tsize = fitFont(ctx, site.title, '400', display, 92, 54, w - 88);
  ctx.font = `400 ${tsize}px ${display}`;
  ctx.fillText(ellipsize(ctx, site.title, w - 88), 40, 760 + tsize + 6);
  ctx.fillStyle = MUTED;
  ctx.font = `400 22px ${mono}`;
  ctx.fillText(ellipsize(ctx, site.url, w - 88), 44, 900);
  ctx.fillStyle = INK;
  ctx.font = `500 18px ${mono}`;
  ctx.fillText(`FIRST CAPTURED ${site.firstCaptured}`, 44, 990);
  ctx.textAlign = 'right';
  ctx.fillText(`LAST CAPTURED ${site.lastCaptured}`, w - 44, 990);
  ctx.textAlign = 'left';
  ctx.fillStyle = MUTED;
  ctx.font = `400 15px ${mono}`;
  ctx.fillText('SOURCE: INTERNET ARCHIVE WAYBACK MACHINE', 44, 1030);

  grain(ctx, w, h, 10);
}

function drawBack(ctx: CanvasRenderingContext2D, site: Site): void {
  const { w, h } = COVER_PX;
  const p = spinePalette(site);
  const mono = family('--nf-mono', 'monospace');
  const display = family('--nf-display', 'serif');

  ctx.fillStyle = '#121116';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = p.band;
  ctx.fillRect(44, 44, 64, 6);

  ctx.textAlign = 'left';
  ctx.fillStyle = MARIGOLD;
  ctx.font = `700 18px ${mono}`;
  ctx.fillText('EULOGY', 44, 96);
  ctx.fillStyle = MUTED;
  ctx.font = `400 15px ${mono}`;
  ctx.fillText(`AI-GENERATED BY ${site.generatedBy.toUpperCase()} (OPEN WEIGHTS)`, 44, 124);

  ctx.fillStyle = INK;
  ctx.font = `italic 400 40px ${display}`;
  const lines = wrapLines(ctx, site.eulogy, w - 88, 13);
  lines.forEach((line, i) => ctx.fillText(line, 44, 196 + i * 50));

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(44, h - 190, w - 88, 1);
  ctx.fillStyle = MUTED;
  ctx.font = `400 16px ${mono}`;
  const src = wrapLines(ctx, site.viewUrl, w - 88, 2);
  src.forEach((line, i) => ctx.fillText(line, 44, h - 150 + i * 24));
  ctx.fillText(`TODAY: ${site.liveStatus.note.toUpperCase()}`, 44, h - 80);

  grain(ctx, w, h, 8);
}

async function build(site: Site, kind: CaseTextureKind, gl: THREE.WebGLRenderer): Promise<THREE.CanvasTexture> {
  if (typeof document !== 'undefined' && document.fonts) {
    const display = family('--nf-display', 'serif');
    const label = family('--nf-label', 'sans-serif');
    const mono = family('--nf-mono', 'monospace');
    await Promise.all([
      document.fonts.load(`400 40px ${display}`),
      document.fonts.load(`italic 400 40px ${display}`),
      document.fonts.load(`700 40px ${label}`),
      document.fonts.load(`500 20px ${mono}`),
      document.fonts.load(`700 20px ${mono}`),
    ]).catch(() => undefined);
  }

  const size = kind === 'spine' ? SPINE_PX : COVER_PX;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    if (kind === 'spine') drawSpine(ctx, site);
    else if (kind === 'cover') drawCover(ctx, site);
    else drawBack(ctx, site);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;
  return texture;
}

/** Cached per site + kind; the canvas is drawn once after fonts load. */
export function getCaseTexture(site: Site, kind: CaseTextureKind, gl: THREE.WebGLRenderer): Promise<THREE.CanvasTexture> {
  const key = `${site.id}:${kind}:${site.spine}`;
  let entry = textureCache.get(key);
  if (!entry) {
    entry = build(site, kind, gl);
    textureCache.set(key, entry);
  }
  return entry;
}
