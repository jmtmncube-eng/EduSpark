/**
 * Topic-aware diagram generator.
 *
 * Returns a base64 data-URI ready to drop into `Question.imageData`. Each
 * template is a parametric SVG so two questions on the same topic don't share
 * the *exact* same picture.
 *
 * Coverage:
 *   • triangle           — Trigonometry / Trig Functions / Trig Advanced
 *   • parabola           — Functions & Graphs / Quadratics / Calculus / Polynomials
 *   • coord-grid         — Analytical Geometry / Regression
 *   • bar-chart          — Statistics
 *   • vector             — Vectors & Scalars / Forces / Momentum
 *   • incline            — Newton's Laws
 *   • circuit            — Electric Circuits / Electricity
 *   • wave               — Waves & Sound / Optical Phenomena
 *   • projectile         — Projectile Motion (incl. Vertical)
 *   • generic-axes       — fallback for "graphy" topics
 */

type DiagramKind =
  | 'triangle' | 'parabola' | 'coord-grid' | 'bar-chart'
  | 'vector' | 'incline' | 'circuit' | 'wave'
  | 'projectile' | 'generic-axes';

// Map CAPS topics → diagram kinds. Order matters when topic matches more than one.
const TOPIC_DIAGRAMS: { match: RegExp; kinds: DiagramKind[] }[] = [
  { match: /trig/i,                     kinds: ['triangle'] },
  { match: /quadratic|polynomial|calculus|exponential|logarith/i, kinds: ['parabola'] },
  { match: /functions? & graphs?|regression|analytical geometry/i, kinds: ['coord-grid', 'parabola'] },
  { match: /statistic|probability/i,    kinds: ['bar-chart'] },
  { match: /vector|scalar/i,            kinds: ['vector'] },
  { match: /newton'?s? laws/i,          kinds: ['incline', 'vector'] },
  { match: /momentum/i,                 kinds: ['vector'] },
  { match: /electric circuit|electricity/i, kinds: ['circuit'] },
  { match: /electrostatic|electrodynamic/i, kinds: ['circuit'] },
  { match: /wave|sound|optical/i,       kinds: ['wave'] },
  { match: /projectile/i,               kinds: ['projectile'] },
  { match: /energy|power/i,             kinds: ['incline', 'wave'] },
  { match: /euclidean|geometr/i,        kinds: ['triangle'] },
  { match: /inequalit/i,                kinds: ['generic-axes'] },
  { match: /sequence|series/i,          kinds: ['bar-chart'] },
];

const ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const pick = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

// Subject-level fallbacks so a topic that matches no specific pattern still
// gets a relevant-looking diagram. Maths → graph/grid, Physics → vector/wave.
const ALL_KINDS: DiagramKind[] = [
  'triangle', 'parabola', 'coord-grid', 'bar-chart',
  'vector', 'incline', 'circuit', 'wave', 'projectile',
];
function fallbackKind(subject?: string): DiagramKind {
  const s = (subject || '').toLowerCase();
  if (s.includes('phys')) return pick(['vector', 'incline', 'circuit', 'wave', 'projectile']);
  if (s.includes('math')) return pick(['parabola', 'coord-grid', 'bar-chart', 'triangle']);
  return pick(ALL_KINDS);
}

/**
 * ALWAYS returns a diagram data-URI. Topic-aware where possible, subject-aware
 * fallback otherwise. Every generated question in EduSpark carries a visual.
 */
export function makeDiagram(topic: string, subject?: string): string {
  const match = TOPIC_DIAGRAMS.find((m) => m.match.test(topic));
  const kind = match ? pick(match.kinds) : fallbackKind(subject);
  return svgToDataUrl(renderSvg(kind));
}

/**
 * Legacy probabilistic variant — kept for backwards-compat. When
 * `includeProbability` is 1 it now ALWAYS returns a diagram (topic-aware or
 * subject-fallback) instead of null.
 */
export function maybeMakeDiagram(topic: string, includeProbability = 1, subject?: string): string | null {
  if (includeProbability < 1 && Math.random() > includeProbability) return null;
  return makeDiagram(topic, subject);
}

function svgToDataUrl(svg: string): string {
  // base64-encode (handles unicode safely)
  const b64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

function renderSvg(kind: DiagramKind): string {
  switch (kind) {
    case 'triangle':       return triangle();
    case 'parabola':       return parabola();
    case 'coord-grid':     return coordGrid();
    case 'bar-chart':      return barChart();
    case 'vector':         return vector();
    case 'incline':        return incline();
    case 'circuit':        return circuit();
    case 'wave':           return wave();
    case 'projectile':     return projectile();
    case 'generic-axes':   return coordGrid();
  }
}

// ─── Wrapper ───────────────────────────────────────────────────────
function frame(inner: string, width = 360, height = 220): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="white"/>
    ${inner}
  </svg>`;
}

// ─── Templates ─────────────────────────────────────────────────────

function triangle(): string {
  const angles = [30, 45, 60];
  const a = pick(angles);
  // Right triangle with angle a at the bottom-left
  const w = 240, h = 140;
  const ox = 60, oy = 180;
  const adj = w;
  const opp = Math.round(adj * Math.tan(a * Math.PI / 180));
  const hypLen = Math.round(Math.sqrt(adj * adj + opp * opp));
  const labelA = `${a}°`;
  const inner = `
    <polygon points="${ox},${oy} ${ox + adj},${oy} ${ox + adj},${oy - Math.min(opp, h)}"
             fill="rgba(20,184,166,.10)" stroke="#0D9488" stroke-width="2"/>
    <!-- right-angle marker -->
    <polyline points="${ox + adj - 12},${oy} ${ox + adj - 12},${oy - 12} ${ox + adj},${oy - 12}"
              fill="none" stroke="#0D9488" stroke-width="1.6"/>
    <!-- angle arc -->
    <path d="M ${ox + 28},${oy} A 28 28 0 0 0 ${ox + 28 * Math.cos(a * Math.PI / 180)},${oy - 28 * Math.sin(a * Math.PI / 180)}"
          fill="none" stroke="#0F172A" stroke-width="1.4"/>
    <text x="${ox + 36}" y="${oy - 6}" font-family="Helvetica" font-size="14" fill="#0F172A">${labelA}</text>
    <text x="${ox + adj / 2}" y="${oy + 18}" font-family="Helvetica" font-size="12" fill="#475569" text-anchor="middle">adjacent</text>
    <text x="${ox + adj + 8}" y="${oy - Math.min(opp, h) / 2}" font-family="Helvetica" font-size="12" fill="#475569">opposite</text>
    <text x="${ox + adj / 2 - 30}" y="${oy - Math.min(opp, h) / 2 - 4}" font-family="Helvetica" font-size="12" fill="#475569" transform="rotate(-${Math.round(Math.atan2(opp, adj) * 180 / Math.PI)} ${ox + adj / 2 - 30} ${oy - Math.min(opp, h) / 2 - 4})">hyp = ${hypLen}</text>`;
  return frame(inner);
}

function parabola(): string {
  // Random-ish quadratic y = a x^2 + b x + c, drawn on axes
  const a = pick([0.5, -0.5, 1, -1, 0.8, -0.8]);
  const b = ri(-3, 3);
  const c = ri(-2, 2);
  const W = 360, H = 220;
  const cx = W / 2, cy = H / 2 + 20;
  const scaleX = 25, scaleY = 18;
  const points: string[] = [];
  for (let x = -6; x <= 6; x += 0.3) {
    const y = a * x * x + b * x + c;
    points.push(`${(cx + x * scaleX).toFixed(1)},${(cy - y * scaleY).toFixed(1)}`);
  }
  const inner = `
    <line x1="20" y1="${cy}" x2="${W - 20}" y2="${cy}" stroke="#94a3b8" stroke-width="1"/>
    <line x1="${cx}" y1="20" x2="${cx}" y2="${H - 20}" stroke="#94a3b8" stroke-width="1"/>
    <text x="${W - 14}" y="${cy - 4}" font-size="11" fill="#475569">x</text>
    <text x="${cx + 4}" y="18" font-size="11" fill="#475569">y</text>
    <polyline points="${points.join(' ')}" fill="none" stroke="#0D9488" stroke-width="2.4"/>`;
  return frame(inner);
}

function coordGrid(): string {
  const W = 360, H = 220;
  const cx = W / 2, cy = H / 2 + 10;
  const lines: string[] = [];
  for (let i = -6; i <= 6; i++) {
    lines.push(`<line x1="${cx + i * 25}" y1="20" x2="${cx + i * 25}" y2="${H - 20}" stroke="#e2e8f0" stroke-width="${i === 0 ? 1.4 : 0.6}"/>`);
    lines.push(`<line x1="20" y1="${cy + i * 16}" x2="${W - 20}" y2="${cy + i * 16}" stroke="#e2e8f0" stroke-width="${i === 0 ? 1.4 : 0.6}"/>`);
  }
  // Place 3 random points + a line of best fit
  const pts: { x: number; y: number }[] = [];
  const m = (Math.random() * 1.4) - 0.7;
  const c = ri(-2, 2);
  for (let i = 0; i < 5; i++) {
    const x = ri(-5, 5);
    const y = +(m * x + c + (Math.random() - 0.5) * 1.5).toFixed(1);
    pts.push({ x, y });
  }
  const dots = pts.map((p) => `<circle cx="${cx + p.x * 25}" cy="${cy - p.y * 16}" r="3.5" fill="#7c3aed"/>`).join('');
  // Line of best fit
  const x1 = -5, x2 = 5;
  const lineSvg = `<line x1="${cx + x1 * 25}" y1="${cy - (m * x1 + c) * 16}" x2="${cx + x2 * 25}" y2="${cy - (m * x2 + c) * 16}" stroke="#0D9488" stroke-width="2"/>`;
  return frame(lines.join('') + dots + lineSvg);
}

function barChart(): string {
  const W = 360, H = 220;
  const baseY = H - 30;
  const n = ri(4, 6);
  const bars: string[] = [];
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  const bw = (W - 80) / n;
  for (let i = 0; i < n; i++) {
    const v = ri(20, 130);
    const x = 40 + i * bw + bw * 0.15;
    const w = bw * 0.7;
    bars.push(`<rect x="${x.toFixed(1)}" y="${(baseY - v).toFixed(1)}" width="${w.toFixed(1)}" height="${v}"
                rx="4" fill="rgba(20,184,166,.70)" stroke="#0D9488" stroke-width="1"/>`);
    bars.push(`<text x="${(x + w / 2).toFixed(1)}" y="${baseY + 16}" font-size="11" fill="#475569" text-anchor="middle">${labels[i]}</text>`);
    bars.push(`<text x="${(x + w / 2).toFixed(1)}" y="${(baseY - v - 4).toFixed(1)}" font-size="10" fill="#0F172A" text-anchor="middle">${v}</text>`);
  }
  return frame(
    `<line x1="40" y1="${baseY}" x2="${W - 30}" y2="${baseY}" stroke="#94a3b8" stroke-width="1"/>` +
    `<line x1="40" y1="20" x2="40" y2="${baseY}" stroke="#94a3b8" stroke-width="1"/>` +
    bars.join('')
  );
}

function vector(): string {
  const W = 360, H = 220;
  const cx = W / 2, cy = H / 2;
  const a = ri(20, 60) * (Math.random() > 0.5 ? 1 : -1);
  const len = ri(60, 130);
  const x2 = cx + Math.cos(a * Math.PI / 180) * len;
  const y2 = cy - Math.sin(a * Math.PI / 180) * len;
  return frame(`
    <line x1="20" y1="${cy}" x2="${W - 20}" y2="${cy}" stroke="#cbd5e1" stroke-width="1"/>
    <line x1="${cx}" y1="20" x2="${cx}" y2="${H - 20}" stroke="#cbd5e1" stroke-width="1"/>
    <defs>
      <marker id="arr" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="#0D9488"/>
      </marker>
    </defs>
    <line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#0D9488" stroke-width="2.6" marker-end="url(#arr)"/>
    <circle cx="${cx}" cy="${cy}" r="3.5" fill="#0F172A"/>
    <text x="${(cx + x2) / 2 + 6}" y="${(cy + y2) / 2 - 6}" font-size="13" font-weight="700" fill="#0D9488">F = ${ri(5, 50)} N</text>
    <text x="${cx + 8}" y="${cy + 14}" font-size="11" fill="#475569">origin</text>
  `);
}

function incline(): string {
  const W = 360, H = 220;
  const ang = ri(20, 45);
  const baseY = H - 30;
  const startX = 50;
  const rise = Math.tan(ang * Math.PI / 180) * 220;
  return frame(`
    <line x1="${startX}" y1="${baseY}" x2="${W - 20}" y2="${baseY}" stroke="#475569" stroke-width="1.6"/>
    <polygon points="${startX},${baseY} ${startX + 220},${baseY} ${startX + 220},${baseY - rise}"
             fill="rgba(124,58,237,.10)" stroke="#7c3aed" stroke-width="2"/>
    <!-- block on slope -->
    <g transform="translate(${startX + 120},${baseY - rise / 220 * 120}) rotate(-${ang})">
      <rect x="-22" y="-44" width="44" height="44" rx="4" fill="rgba(20,184,166,.7)" stroke="#0D9488" stroke-width="2"/>
      <text x="0" y="-18" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">m</text>
    </g>
    <text x="${startX + 80}" y="${baseY - 6}" font-size="12" fill="#0F172A">${ang}°</text>
    <text x="${W - 70}" y="${baseY + 18}" font-size="11" fill="#475569">surface</text>
  `);
}

function circuit(): string {
  const W = 360, H = 220;
  // simple loop: battery — wire — resistor — wire — back
  return frame(`
    <rect x="40" y="50" width="280" height="120" fill="none" stroke="#0F172A" stroke-width="2"/>
    <!-- battery -->
    <line x1="40" y1="100" x2="40" y2="80" stroke="white" stroke-width="6"/>
    <line x1="30" y1="100" x2="50" y2="100" stroke="#0F172A" stroke-width="3"/>
    <line x1="34" y1="115" x2="46" y2="115" stroke="#0F172A" stroke-width="2"/>
    <text x="14" y="100" font-size="12" font-weight="700" fill="#0F172A">+</text>
    <text x="14" y="120" font-size="12" font-weight="700" fill="#0F172A">−</text>
    <text x="60" y="108" font-size="12" fill="#0F172A">${ri(6, 24)} V</text>
    <!-- resistor (top) -->
    <rect x="160" y="42" width="50" height="16" fill="white" stroke="#0D9488" stroke-width="2"/>
    <text x="185" y="36" font-size="12" fill="#0D9488" text-anchor="middle">R = ${ri(10, 80)} Ω</text>
    <!-- current arrow -->
    <defs>
      <marker id="iarr" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="#dc2626"/>
      </marker>
    </defs>
    <line x1="280" y1="50" x2="280" y2="170" stroke="#dc2626" stroke-width="1.6" marker-end="url(#iarr)" opacity=".7"/>
    <text x="290" y="115" font-size="11" fill="#dc2626">I</text>
  `);
}

function wave(): string {
  const W = 360, H = 220;
  const midY = H / 2;
  const cycles = ri(2, 4);
  const amp = 40;
  const pts: string[] = [];
  for (let x = 20; x <= W - 20; x += 2) {
    const t = (x - 20) / (W - 40);
    const y = midY - amp * Math.sin(t * cycles * 2 * Math.PI);
    pts.push(`${x},${y.toFixed(1)}`);
  }
  return frame(`
    <line x1="20" y1="${midY}" x2="${W - 20}" y2="${midY}" stroke="#cbd5e1" stroke-width="1"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="#0D9488" stroke-width="2.6"/>
    <!-- wavelength indicator -->
    <line x1="20" y1="${midY + amp + 12}" x2="${20 + (W - 40) / cycles}" y2="${midY + amp + 12}" stroke="#7c3aed" stroke-width="1.4" stroke-dasharray="4 3"/>
    <text x="${20 + (W - 40) / cycles / 2}" y="${midY + amp + 26}" font-size="11" fill="#7c3aed" text-anchor="middle">λ</text>
    <text x="${W - 80}" y="20" font-size="11" fill="#475569">f = ${(cycles * 100).toLocaleString()} Hz</text>
  `);
}

function projectile(): string {
  const W = 360, H = 220;
  const v0 = ri(15, 35);
  const angle = ri(30, 60);
  const g = 9.8;
  const r = (angle * Math.PI) / 180;
  const range = (v0 * v0 * Math.sin(2 * r)) / g;       // metres
  const maxH = (v0 * v0 * Math.sin(r) * Math.sin(r)) / (2 * g);
  // Scale to fit canvas
  const startX = 30, startY = H - 30;
  const sx = (W - 60) / range;
  const sy = (H - 60) / maxH;
  const s = Math.min(sx, sy);
  const pts: string[] = [];
  for (let t = 0; t <= 2 * v0 * Math.sin(r) / g; t += 0.05) {
    const x = startX + v0 * Math.cos(r) * t * s;
    const y = startY - (v0 * Math.sin(r) * t - 0.5 * g * t * t) * s;
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return frame(`
    <line x1="20" y1="${startY}" x2="${W - 20}" y2="${startY}" stroke="#475569" stroke-width="1.6"/>
    <line x1="${startX}" y1="20" x2="${startX}" y2="${startY}" stroke="#cbd5e1" stroke-width="0.8"/>
    <defs>
      <marker id="parr" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L6,3 z" fill="#0D9488"/>
      </marker>
    </defs>
    <line x1="${startX}" y1="${startY}" x2="${startX + 40 * Math.cos(r)}" y2="${startY - 40 * Math.sin(r)}"
          stroke="#0D9488" stroke-width="2" marker-end="url(#parr)"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="#7c3aed" stroke-width="2.4" stroke-dasharray="6 4"/>
    <text x="${startX + 6}" y="${startY - 8}" font-size="12" font-weight="700" fill="#0D9488">${v0} m/s @ ${angle}°</text>
    <text x="${W - 70}" y="${startY + 18}" font-size="11" fill="#475569">ground</text>
  `);
}
