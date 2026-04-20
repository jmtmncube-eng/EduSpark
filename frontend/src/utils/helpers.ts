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

export function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX = 400;
        let w = img.width, h = img.height;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      };
      img.src = e.target!.result as string;
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
