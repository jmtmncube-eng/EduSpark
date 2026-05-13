import type { Level } from '../types';

export function getLvl(xp: number): Level {
  if (xp < 500) return { name: 'Beginner', cl: 'lvl-b', ic: '🌱', min: 0, next: 500 };
  if (xp < 1500) return { name: 'Intermediate', cl: 'lvl-m', ic: '📚', min: 500, next: 1500 };
  if (xp < 3000) return { name: 'Advanced', cl: 'lvl-a', ic: '🔥', min: 1500, next: 3000 };
  return { name: 'Expert', cl: 'lvl-e', ic: '🏆', min: 3000, next: 5000 };
}

export function calcStreak(results: { completedAt: string }[]): number {
  if (!results.length) return 0;
  let s = 0;
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  const ch = new Date(t);
  for (let i = 0; i < 30; i++) {
    const ds = ch.getTime();
    if (results.some((r) => new Date(r.completedAt).getTime() >= ds && new Date(r.completedAt).getTime() < ds + 86400000)) {
      s++;
      ch.setDate(ch.getDate() - 1);
    } else break;
  }
  return s;
}

export function fmtDate(ts: string | number): string {
  return new Date(ts).toLocaleDateString('en-ZA');
}

export function fmtD(ts?: number): string {
  const d = ts ? new Date(ts) : new Date();
  return d.toISOString().split('T')[0];
}

export function subjectLabel(s: string): string {
  return s === 'MATHEMATICS' ? '📐 Mathematics' : '⚗️ Physical Sciences';
}

export function subjectBadge(s: string): string {
  return s === 'MATHEMATICS' ? 'bma' : 'bph';
}

export function diffBadge(d: string): string {
  return d === 'EASY' ? 'bea' : d === 'MEDIUM' ? 'bme' : 'bha';
}

export function visLabel(v: string): string {
  return { ALL: 'All', GR10: 'Gr10', GR11: 'Gr11', GR12: 'Gr12', NONE: 'Hidden' }[v] || v;
}

/**
 * Accepted by every modern browser via the <Image> element:
 *   image/png, image/jpeg, image/jpg, image/gif, image/webp, image/bmp, image/svg+xml, image/avif
 *
 * Edge cases handled:
 *   • HEIC/HEIF (iOS) — most desktop browsers can't decode. We detect by extension
 *     and ask the user to use the iOS share menu's "Save as JPEG" option.
 *   • Non-image MIME (e.g. application/pdf accidentally dragged in) → rejected
 *   • Large files → downscaled to MAX_DIM via canvas
 *   • Animated GIFs/WebP → flattened to JPEG (first frame)
 *   • SVG → re-rasterised through canvas (loses interactivity, keeps look)
 */
const ACCEPTED_MIMES = new Set([
  'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
  'image/webp', 'image/bmp', 'image/svg+xml', 'image/avif',
]);
const HEIC_PATTERN = /\.(heic|heif)$/i;

export function compressImage(file: File, maxDim = 400): Promise<string> {
  return new Promise((resolve, reject) => {
    // HEIC guardrail — most browsers can't decode this natively
    if (HEIC_PATTERN.test(file.name) || file.type === 'image/heic' || file.type === 'image/heif') {
      reject(new Error('HEIC/HEIF photos aren\'t supported here. On iPhone, open the photo → Share → "Save as JPEG", then upload that file.'));
      return;
    }
    // Reject anything that's not an image
    if (file.type && !file.type.startsWith('image/')) {
      reject(new Error(`"${file.type}" is not an image. Please pick a PNG, JPG, GIF, WEBP, BMP, SVG or AVIF file.`));
      return;
    }
    if (file.type && !ACCEPTED_MIMES.has(file.type)) {
      // Some browsers report exotic types — try anyway via <img>
      console.warn('Unusual image MIME', file.type, '— attempting to decode anyway.');
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read this file. Please try a different image.'));
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string | null;
      if (!dataUrl) { reject(new Error('Empty image file.')); return; }

      const img = new Image();
      // SVGs sometimes need crossOrigin to draw to canvas; harmless for others
      img.crossOrigin = 'anonymous';
      img.onerror = () => reject(new Error('That image format couldn\'t be decoded by your browser. Please save it as JPG or PNG and try again.'));
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width || 400, h = img.height || 400;
          if (w === 0 || h === 0) { reject(new Error('Image has zero dimensions.')); return; }
          if (w > maxDim || h > maxDim) {
            if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
            else { w = Math.round(w * maxDim / h); h = maxDim; }
          }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('Browser denied canvas drawing.')); return; }
          // Fill white so transparent PNGs / SVGs export cleanly as JPEG
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } catch (err) {
          reject(err instanceof Error ? err : new Error('Image compression failed.'));
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}

export function launchConfetti() {
  const cols = ['#0D9488', '#059669', '#06B6D4', '#34D399', '#FFFFFF'];
  const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
  for (let i = 0; i < 65; i++) {
    const p = document.createElement('div');
    p.className = 'cnf';
    p.style.cssText = `left:${Math.random() * 100}vw;width:${ri(6, 12)}px;height:${ri(6, 12)}px;background:${cols[ri(0, 4)]};border-radius:${Math.random() > 0.5 ? '50%' : '2px'};animation-delay:${Math.random()}s;animation-duration:${2 + Math.random() * 2}s;`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 4500);
  }
}
