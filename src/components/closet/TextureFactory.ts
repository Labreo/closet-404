import * as THREE from 'three';
import type { Site } from '@/types/archive';

const textureCache = new Map<string, THREE.CanvasTexture>();

/**
 * Creates and caches a 256x1024 CanvasTexture for a site spine.
 * Awaits document.fonts.ready before drawing text.
 */
export async function getSpineTexture(
  site: Site,
  gl?: THREE.WebGLRenderer
): Promise<THREE.CanvasTexture> {
  const cached = textureCache.get(site.id);
  if (cached) return cached;

  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Continue even if font loading status fails
    }
  }

  const width = 256;
  const height = 1024;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    const fallbackTexture = new THREE.CanvasTexture(canvas);
    return fallbackTexture;
  }

  // Base background: dark charcoal case with subtle gradient
  const bgGrad = ctx.createLinearGradient(0, 0, width, 0);
  bgGrad.addColorStop(0, '#100f13');
  bgGrad.addColorStop(0.15, '#1e1c24');
  bgGrad.addColorStop(0.85, '#19181f');
  bgGrad.addColorStop(1, '#0c0b0e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Procedural grain / texture
  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 18;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Subtle border groove / hairline highlights
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 2;
  ctx.strokeRect(6, 6, width - 12, height - 12);

  // Category stripe in accentColor
  const accent = site.accentColor || '#ff9e00';
  ctx.fillStyle = accent;
  ctx.fillRect(16, 28, width - 32, 12);

  // Category label
  ctx.fillStyle = '#8a8578';
  ctx.font = '600 16px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.letterSpacing = '2px';
  ctx.fillText(site.category.toUpperCase(), width / 2, 68);
  ctx.letterSpacing = '0px';

  // Captured years badge
  ctx.fillStyle = '#ff9e00';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${site.firstCaptured} — ${site.lastCaptured}`, width / 2, 108);

  // Hairline divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 130);
  ctx.lineTo(width - 32, 130);
  ctx.stroke();

  // Vertical title (Space Grotesk)
  ctx.save();
  ctx.translate(width / 2, 530);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#e9e4d8';
  ctx.font = 'bold 36px "Space Grotesk", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const rawTitle = site.title || site.url;
  const maxTitleLength = 32;
  const displayTitle =
    rawTitle.length > maxTitleLength
      ? rawTitle.slice(0, maxTitleLength - 1) + '…'
      : rawTitle;
  ctx.fillText(displayTitle, 0, 0);
  ctx.restore();

  // Bottom hairline divider
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(32, 920);
  ctx.lineTo(width - 32, 920);
  ctx.stroke();

  // Mono spine number #001 format at bottom
  ctx.fillStyle = '#8a8578';
  ctx.font = '600 32px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  const spineNumber = '#' + site.spine.toString().padStart(3, '0');
  ctx.fillText(spineNumber, width / 2, 968);

  // Setup CanvasTexture settings
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;

  if (gl) {
    texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  }

  texture.needsUpdate = true;
  textureCache.set(site.id, texture);

  return texture;
}

