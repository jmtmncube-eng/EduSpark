// ─── Question generators ──────────────────────────────────────────
// Every generator is difficulty-aware: it takes a GenDiff and scales the
// numbers / step-count accordingly, so "Stretch" genuinely produces harder
// work than "Warm-up". Topics with more than one entry in their array give
// real variety — the registry picks a random variant each call, so you
// never get three identical questions in a row.

const Ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const Rf = (a: number, b: number, d = 1) =>
  parseFloat((Math.random() * (b - a) + a).toFixed(d));
const pickOne = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export type GenDiff = 'EASY' | 'MEDIUM' | 'HARD';
const DIFF_LABEL: Record<GenDiff, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' };

// Difficulty-scaled random integer: the same base range, widened as the
// requested difficulty rises. Keeps EASY clean and small, HARD bigger/messier.
const SCALE: Record<GenDiff, number> = { EASY: 1, MEDIUM: 1.8, HARD: 3 };
function di(d: GenDiff, lo: number, hi: number): number {
  const s = SCALE[d];
  return Ri(Math.max(1, Math.round(lo * s)), Math.round(hi * s));
}

export interface GeneratedQuestion {
  q: string;
  opts: string[];
  ans: string;
  sol: string;
  diff: string;
}

export type GeneratorFn = (d: GenDiff) => GeneratedQuestion;

// Build a unique 4-option set: correct answer + 3 distinct distractors.
function options(correct: string, distractors: string[]): string[] {
  const seen = new Set([correct]);
  const out = [correct];
  for (const x of distractors) {
    if (out.length >= 4) break;
    if (!seen.has(x)) { seen.add(x); out.push(x); }
  }
  // pad if distractors collided
  let pad = 1;
  while (out.length < 4) {
    const filler = `${correct} (≠)${'*'.repeat(pad)}`;
    if (!seen.has(filler)) { seen.add(filler); out.push(filler); }
    pad++;
  }
  // shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Per-topic generator variants. Each topic maps to an array of difficulty-aware
 * generators; the registry picks one at random for variety.
 */
export const QG: Record<string, GeneratorFn[]> = {
  // ─── Mathematics ────────────────────────────────────────────────
  Algebra: [
    (d) => { // ax + b = c
      const a = di(d, 2, 6), x = di(d, 2, 9), b = di(d, 1, 8), c = a * x + b;
      return {
        q: `Solve for x:  ${a}x + ${b} = ${c}`,
        opts: options(`x = ${x}`, [`x = ${x + 1}`, `x = ${x - 1}`, `x = ${c - b}`]),
        ans: `x = ${x}`,
        sol: `Formula: isolate x by inverse operations.\nStep 1: Subtract ${b}: ${a}x = ${c} − ${b} = ${c - b}\nStep 2: Divide by ${a}: x = ${c - b} ÷ ${a} = ${x}\nTherefore: x = ${x}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // a(x + b) = c
      const a = di(d, 2, 5), x = di(d, 1, 8), b = di(d, 1, 6), c = a * (x + b);
      return {
        q: `Solve for x:  ${a}(x + ${b}) = ${c}`,
        opts: options(`x = ${x}`, [`x = ${x + b}`, `x = ${c / a}`, `x = ${x - 1}`]),
        ans: `x = ${x}`,
        sol: `Step 1: Divide both sides by ${a}: x + ${b} = ${c} ÷ ${a} = ${c / a}\nStep 2: Subtract ${b}: x = ${c / a} − ${b} = ${x}\nTherefore: x = ${x}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // ax + b = cx + e
      const x = di(d, 2, 7), a = di(d, 3, 6), c = Ri(1, a - 1), b = di(d, 1, 6);
      const e = (a - c) * x + b;
      return {
        q: `Solve for x:  ${a}x + ${b} = ${c}x + ${e}`,
        opts: options(`x = ${x}`, [`x = ${x + 1}`, `x = ${b}`, `x = ${e - b}`]),
        ans: `x = ${x}`,
        sol: `Step 1: Group x terms — ${a}x − ${c}x = ${e} − ${b}\nStep 2: ${a - c}x = ${e - b}\nStep 3: x = ${e - b} ÷ ${a - c} = ${x}\nTherefore: x = ${x}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Functions & Graphs': [
    (d) => { // y-intercept
      const a = Ri(1, 4), b = di(d, 1, 5) * (Math.random() < .5 ? 1 : -1), c = di(d, 1, 8) * (Math.random() < .5 ? 1 : -1);
      return {
        q: `What is the y-intercept of  y = ${a}x² ${b >= 0 ? '+ ' + b : '− ' + -b}x ${c >= 0 ? '+ ' + c : '− ' + -c}?`,
        opts: options(`y = ${c}`, [`y = ${a}`, `y = ${b}`, `y = ${a + b + c}`]),
        ans: `y = ${c}`,
        sol: `Step 1: The y-intercept is where x = 0.\nStep 2: y = ${a}(0)² + ${b}(0) + ${c} = ${c}\nTherefore: y-intercept = ${c} (always the constant term)`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // evaluate f(x)
      const a = Ri(1, 3), b = di(d, 1, 5), c = di(d, 1, 6), x = di(d, 1, 5);
      const y = a * x * x + b * x + c;
      return {
        q: `Given f(x) = ${a}x² + ${b}x + ${c}, find f(${x}).`,
        opts: options(`${y}`, [`${y + x}`, `${y - a}`, `${a * x + b + c}`]),
        ans: `${y}`,
        sol: `Step 1: Substitute x = ${x}: ${a}(${x})² + ${b}(${x}) + ${c}\nStep 2: ${a}×${x * x} + ${b * x} + ${c} = ${a * x * x} + ${b * x} + ${c}\nTherefore: f(${x}) = ${y}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // axis of symmetry
      const a = Ri(1, 3), bHalf = di(d, 1, 4), b = 2 * a * bHalf * (Math.random() < .5 ? 1 : -1);
      const axis = -b / (2 * a);
      return {
        q: `Axis of symmetry of  y = ${a}x² ${b >= 0 ? '+ ' + b : '− ' + -b}x + ${Ri(-4, 4)}?`,
        opts: options(`x = ${axis}`, [`x = ${-axis}`, `x = ${b}`, `x = ${a}`]),
        ans: `x = ${axis}`,
        sol: `Formula: axis of symmetry x = −b ÷ (2a)\nStep 1: a = ${a}, b = ${b}\nStep 2: x = −(${b}) ÷ (2×${a}) = ${axis}\nTherefore: x = ${axis}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Trigonometry: [
    (d) => { // special-angle value
      const A = [30, 45, 60];
      const S = ['½', '√2/2', '√3/2'], C = ['√3/2', '√2/2', '½'], T = ['1/√3', '1', '√3'];
      const i = Ri(0, 2), f = Ri(0, 2);
      const fn = ['sin', 'cos', 'tan'], V = [S, C, T];
      return {
        q: `Calculate  ${fn[f]}(${A[i]}°)`,
        opts: options(V[f][i], [V[(f + 1) % 3][i], V[(f + 2) % 3][i], '2']),
        ans: V[f][i],
        sol: `Step 1: Recall the special-angle triangle for ${A[i]}°.\nStep 2: Apply SOHCAHTOA for ${fn[f]}.\nTherefore: ${fn[f]}(${A[i]}°) = ${V[f][i]}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // SOHCAHTOA find opposite side
      const ang = pickOne([30, 45, 60]);
      const adj = di(d, 4, 12);
      const opp = +(adj * Math.tan(ang * Math.PI / 180)).toFixed(1);
      return {
        q: `A right triangle has a ${ang}° angle with adjacent side ${adj}. Find the opposite side (1 d.p.).`,
        opts: options(`${opp}`, [`${(opp + 2).toFixed(1)}`, `${(adj / 2).toFixed(1)}`, `${(opp - 1.5).toFixed(1)}`]),
        ans: `${opp}`,
        sol: `Formula: tan θ = opposite ÷ adjacent\nStep 1: opposite = adjacent × tan(${ang}°) = ${adj} × ${(Math.tan(ang * Math.PI / 180)).toFixed(3)}\nTherefore: opposite ≈ ${opp}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // Pythagoras hypotenuse
      const a = di(d, 3, 8), b = di(d, 3, 8);
      const h = +Math.sqrt(a * a + b * b).toFixed(2);
      return {
        q: `Right triangle with legs ${a} and ${b}. Find the hypotenuse (2 d.p.).`,
        opts: options(`${h}`, [`${(a + b)}`, `${(h + 1).toFixed(2)}`, `${(Math.abs(a - b))}`]),
        ans: `${h}`,
        sol: `Formula: h² = a² + b²\nStep 1: h² = ${a}² + ${b}² = ${a * a} + ${b * b} = ${a * a + b * b}\nStep 2: h = √${a * a + b * b} ≈ ${h}\nTherefore: hypotenuse ≈ ${h}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Statistics: [
    (d) => { // mean
      const n = d === 'HARD' ? Ri(6, 8) : Ri(4, 6);
      const data = Array.from({ length: n }, () => di(d, 5, 40)).sort((a, b) => a - b);
      const sum = data.reduce((s, v) => s + v, 0);
      const m = +(sum / n).toFixed(1);
      return {
        q: `Find the mean of {${data.join(', ')}}.`,
        opts: options(`${m}`, [`${data[Math.floor(n / 2)]}`, `${data[n - 1] - data[0]}`, `${(m + 4).toFixed(1)}`]),
        ans: `${m}`,
        sol: `Formula: mean = Σx ÷ n\nStep 1: Σx = ${sum}\nStep 2: n = ${n}\nStep 3: mean = ${sum} ÷ ${n} = ${m}\nTherefore: mean = ${m}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // range
      const n = Ri(5, 7);
      const data = Array.from({ length: n }, () => di(d, 5, 50)).sort((a, b) => a - b);
      const range = data[n - 1] - data[0];
      return {
        q: `Find the range of {${data.join(', ')}}.`,
        opts: options(`${range}`, [`${data[n - 1]}`, `${data[0]}`, `${range + data[0]}`]),
        ans: `${range}`,
        sol: `Formula: range = maximum − minimum\nStep 1: max = ${data[n - 1]}, min = ${data[0]}\nStep 2: range = ${data[n - 1]} − ${data[0]} = ${range}\nTherefore: range = ${range}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // median (odd count)
      const data = Array.from({ length: 5 }, () => di(d, 5, 40)).sort((a, b) => a - b);
      const med = data[2];
      return {
        q: `Find the median of {${data.join(', ')}}.`,
        opts: options(`${med}`, [`${data[0]}`, `${data[4]}`, `${(data.reduce((s, v) => s + v, 0) / 5).toFixed(1)}`]),
        ans: `${med}`,
        sol: `Step 1: Order the data (already ordered): ${data.join(', ')}\nStep 2: With 5 values, the median is the 3rd value.\nTherefore: median = ${med}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Finance & Growth': [
    (d) => { // compound interest
      const P = di(d, 4, 30) * 1000, r = Rf(5, 14, 1), n = di(d, 1, 4);
      const A = +(P * Math.pow(1 + r / 100, n)).toFixed(2);
      return {
        q: `R${P.toLocaleString()} invested at ${r}% compound interest for ${n} year(s). Final amount?`,
        opts: options(`R${A}`, [`R${(P * (1 + r / 100 * n)).toFixed(2)}`, `R${(P + P * r / 100).toFixed(2)}`, `R${P * 2}`]),
        ans: `R${A}`,
        sol: `Formula: A = P(1 + r)ⁿ\nStep 1: P = R${P}, r = ${r / 100}, n = ${n}\nStep 2: A = ${P} × (${(1 + r / 100).toFixed(3)})^${n}\nTherefore: A = R${A}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Quadratic Equations': [
    (d) => { // factorise x² − (p+q)x + pq
      const p = di(d, 1, 5), q = di(d, 1, 6);
      return {
        q: `Solve:  x² − ${p + q}x + ${p * q} = 0`,
        opts: options(`x = ${p} or x = ${q}`, [`x = ${-p} or x = ${-q}`, `x = ${p + q}`, `x = ${p * q}`]),
        ans: `x = ${p} or x = ${q}`,
        sol: `Step 1: Find two numbers multiplying to ${p * q}, adding to ${p + q}: ${p} and ${q}\nStep 2: (x − ${p})(x − ${q}) = 0\nTherefore: x = ${p} or x = ${q}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // difference of squares
      const k = di(d, 2, 8);
      return {
        q: `Solve:  x² − ${k * k} = 0`,
        opts: options(`x = ${k} or x = ${-k}`, [`x = ${k}`, `x = ${k * k}`, `x = ${-k * k}`]),
        ans: `x = ${k} or x = ${-k}`,
        sol: `Step 1: Difference of squares — x² − ${k * k} = (x − ${k})(x + ${k})\nStep 2: Set each factor to 0\nTherefore: x = ${k} or x = ${-k}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // discriminant
      const a = Ri(1, 3), b = di(d, 2, 8), c = Ri(1, 4);
      const disc = b * b - 4 * a * c;
      const nature = disc > 0 ? 'two real roots' : disc === 0 ? 'one real root' : 'no real roots';
      return {
        q: `For ${a}x² + ${b}x + ${c} = 0, what does the discriminant tell you?`,
        opts: options(nature, ['two real roots', 'one real root', 'no real roots'].filter((x) => x !== nature).concat('cannot tell')),
        ans: nature,
        sol: `Formula: Δ = b² − 4ac\nStep 1: Δ = ${b}² − 4(${a})(${c}) = ${b * b} − ${4 * a * c} = ${disc}\nStep 2: Δ ${disc > 0 ? '> 0' : disc === 0 ? '= 0' : '< 0'} → ${nature}\nTherefore: ${nature}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Differential Calculus': [
    (d) => { // derivative of polynomial
      const a = di(d, 1, 4), n = Ri(2, d === 'HARD' ? 5 : 3), b = di(d, 1, 6);
      return {
        q: `Find f'(x) if  f(x) = ${a}x^${n} + ${b}x`,
        opts: options(`${a * n}x^${n - 1} + ${b}`, [`${a}x^${n + 1}`, `${a * n}x^${n}`, `${n}x^${n - 1} + ${b}`]),
        ans: `${a * n}x^${n - 1} + ${b}`,
        sol: `Formula: d/dx[axⁿ] = a·n·xⁿ⁻¹\nStep 1: d/dx[${a}x^${n}] = ${a * n}x^${n - 1}\nStep 2: d/dx[${b}x] = ${b}\nTherefore: f'(x) = ${a * n}x^${n - 1} + ${b}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // gradient at a point
      const a = Ri(1, 3), b = di(d, 1, 5), x0 = di(d, 1, 4);
      const grad = 2 * a * x0 + b;
      return {
        q: `f(x) = ${a}x² + ${b}x. Find the gradient of the tangent at x = ${x0}.`,
        opts: options(`${grad}`, [`${grad + a}`, `${a * x0 * x0 + b * x0}`, `${2 * a * x0}`]),
        ans: `${grad}`,
        sol: `Step 1: f'(x) = ${2 * a}x + ${b}\nStep 2: f'(${x0}) = ${2 * a}×${x0} + ${b} = ${grad}\nTherefore: gradient = ${grad}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // turning point x-coordinate
      const a = Ri(1, 3), bHalf = di(d, 1, 4), b = 2 * a * bHalf;
      const tx = -b / (2 * a);
      return {
        q: `Find the x-coordinate of the turning point of  f(x) = ${a}x² + ${b}x + ${Ri(1, 9)}.`,
        opts: options(`x = ${tx}`, [`x = ${-tx}`, `x = ${b}`, `x = ${a}`]),
        ans: `x = ${tx}`,
        sol: `Step 1: f'(x) = ${2 * a}x + ${b}\nStep 2: Set f'(x) = 0 → ${2 * a}x = −${b} → x = ${tx}\nTherefore: turning point at x = ${tx}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Sequences & Series': [
    (d) => { // arithmetic sum
      const a = di(d, 2, 10), diff = di(d, 1, 5), n = Ri(5, d === 'HARD' ? 14 : 9);
      const Sn = Math.round((n / 2) * (2 * a + (n - 1) * diff));
      return {
        q: `Arithmetic series: a = ${a}, d = ${diff}. Find S${n}.`,
        opts: options(`${Sn}`, [`${Sn + diff}`, `${a + (n - 1) * diff}`, `${n * a}`]),
        ans: `${Sn}`,
        sol: `Formula: Sₙ = n/2 (2a + (n−1)d)\nStep 1: 2a + (n−1)d = ${2 * a} + ${(n - 1) * diff} = ${2 * a + (n - 1) * diff}\nStep 2: Sₙ = ${n}/2 × ${2 * a + (n - 1) * diff} = ${Sn}\nTherefore: S${n} = ${Sn}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // nth term
      const a = di(d, 2, 9), diff = di(d, 1, 6), n = Ri(4, 12);
      const tn = a + (n - 1) * diff;
      return {
        q: `Arithmetic sequence: a = ${a}, d = ${diff}. Find the ${n}th term.`,
        opts: options(`${tn}`, [`${tn + diff}`, `${a * n}`, `${tn - diff}`]),
        ans: `${tn}`,
        sol: `Formula: Tₙ = a + (n−1)d\nStep 1: T${n} = ${a} + (${n}−1)×${diff} = ${a} + ${(n - 1) * diff}\nTherefore: T${n} = ${tn}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Euclidean Geometry': [
    (d) => {
      const a = di(d, 20, 70), b = Ri(20, 100 - Math.min(a, 79));
      const c = 180 - a - b;
      return {
        q: `A triangle has angles ${a}° and ${b}°. Find the third angle.`,
        opts: options(`${c}°`, [`${a + b}°`, `${180 - a}°`, `${Math.abs(a - b)}°`]),
        ans: `${c}°`,
        sol: `Formula: angles of a triangle sum to 180°\nStep 1: ${a}° + ${b}° = ${a + b}°\nStep 2: 180° − ${a + b}° = ${c}°\nTherefore: third angle = ${c}°`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Trigonometric Functions': [
    (d) => {
      const A = [30, 60, 90, 120, 150]; const a = pickOne(A);
      const v = +Math.sin(a * Math.PI / 180).toFixed(2);
      return {
        q: `Evaluate sin(${a}°) to 2 decimal places.`,
        opts: options(`${v}`, [`${(1 - v).toFixed(2)}`, `${(v * 2 > 1 ? v / 2 : v * 2).toFixed(2)}`, `${(a / 100).toFixed(2)}`]),
        ans: `${v}`,
        sol: `Step 1: ${a}° on the unit circle.\nStep 2: sin(${a}°) ≈ ${v}\nTherefore: sin(${a}°) = ${v}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Analytical Geometry': [
    (d) => { // distance
      const x1 = di(d, -6, 6), y1 = di(d, -6, 6), x2 = di(d, -6, 6), y2 = di(d, -6, 6);
      const dist = +Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2).toFixed(2);
      return {
        q: `Distance between (${x1}, ${y1}) and (${x2}, ${y2})?`,
        opts: options(`${dist}`, [`${Math.abs(x2 - x1)}`, `${Math.abs(y2 - y1)}`, `${(dist + 1).toFixed(2)}`]),
        ans: `${dist}`,
        sol: `Formula: d = √((x₂−x₁)² + (y₂−y₁)²)\nStep 1: Δx = ${x2 - x1}, Δy = ${y2 - y1}\nStep 2: d = √(${(x2 - x1) ** 2} + ${(y2 - y1) ** 2}) ≈ ${dist}\nTherefore: d ≈ ${dist}`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // midpoint
      const x1 = di(d, -8, 8), y1 = di(d, -8, 8), x2 = di(d, -8, 8), y2 = di(d, -8, 8);
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
      return {
        q: `Midpoint of (${x1}, ${y1}) and (${x2}, ${y2})?`,
        opts: options(`(${mx}, ${my})`, [`(${x1 + x2}, ${y1 + y2})`, `(${mx + 1}, ${my})`, `(${x2 - x1}, ${y2 - y1})`]),
        ans: `(${mx}, ${my})`,
        sol: `Formula: M = ((x₁+x₂)/2, (y₁+y₂)/2)\nStep 1: x: (${x1}+${x2})/2 = ${mx}\nStep 2: y: (${y1}+${y2})/2 = ${my}\nTherefore: midpoint = (${mx}, ${my})`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Finance: [
    (d) => {
      const P = di(d, 4, 30) * 1000, r = Rf(5, 16, 1), n = di(d, 2, 6);
      const A = +(P * (1 + r / 100 * n)).toFixed(2);
      return {
        q: `Simple interest: R${P.toLocaleString()} at ${r}% for ${n} years. Final amount?`,
        opts: options(`R${A}`, [`R${(P * Math.pow(1 + r / 100, n)).toFixed(2)}`, `R${(P * r * n / 100).toFixed(2)}`, `R${P * 2}`]),
        ans: `R${A}`,
        sol: `Formula: A = P(1 + r·n)\nStep 1: 1 + ${r / 100}×${n} = ${(1 + r / 100 * n).toFixed(3)}\nStep 2: A = ${P} × ${(1 + r / 100 * n).toFixed(3)} = R${A}\nTherefore: A = R${A}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Counting & Probability': [
    (d) => {
      const n = Ri(d === 'HARD' ? 5 : 3, d === 'HARD' ? 8 : 6), r = Ri(2, n - 1);
      const C = factorial(n) / (factorial(r) * factorial(n - r));
      return {
        q: `How many ways to choose ${r} items from ${n}?`,
        opts: options(`${C}`, [`${n * r}`, `${factorial(n) / factorial(n - r)}`, `${n + r}`]),
        ans: `${C}`,
        sol: `Formula: C(n,r) = n! ÷ (r!(n−r)!)\nStep 1: ${n}! ÷ (${r}! × ${n - r}!)\nStep 2: = ${C}\nTherefore: ${C} ways`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Inequalities: [
    (d) => {
      const a = di(d, 2, 5), x = di(d, 1, 8), b = di(d, 1, 6), c = a * x + b;
      return {
        q: `Solve:  ${a}x + ${b} > ${c}`,
        opts: options(`x > ${x}`, [`x < ${x}`, `x ≥ ${x}`, `x = ${x}`]),
        ans: `x > ${x}`,
        sol: `Step 1: Subtract ${b}: ${a}x > ${c - b}\nStep 2: Divide by ${a} (positive — sign stays): x > ${x}\nTherefore: x > ${x}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Polynomials: [
    (d) => {
      const r = di(d, 1, 5);
      return {
        q: `Factorise:  x³ − ${3 * r}x² + ${3 * r * r}x − ${r * r * r}`,
        opts: options(`(x − ${r})³`, [`(x + ${r})³`, `(x − ${r})(x² − ${r}x + 1)`, `x(x − ${r})²`]),
        ans: `(x − ${r})³`,
        sol: `Formula: (x − a)³ = x³ − 3ax² + 3a²x − a³\nStep 1: Match a = ${r}: 3a = ${3 * r}, 3a² = ${3 * r * r}, a³ = ${r * r * r} ✓\nTherefore: (x − ${r})³`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Exponential & Logarithms': [
    (d) => {
      const b = pickOne([2, 3, 5, 10]), e = Ri(2, d === 'HARD' ? 5 : 3);
      const v = Math.pow(b, e);
      return {
        q: `Evaluate:  log${sub(b)}(${v})`,
        opts: options(`${e}`, [`${b}`, `${v - b}`, `${b * e}`]),
        ans: `${e}`,
        sol: `Formula: log_b(x) = y ⇔ bʸ = x\nStep 1: ${v} = ${b}^${e}\nTherefore: log${sub(b)}(${v}) = ${e}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Regression Analysis': [
    (d) => {
      const m = Rf(1.5, 4.5, 2), c = di(d, 2, 8), x = di(d, 3, 10);
      const y = +(m * x + c).toFixed(2);
      return {
        q: `Line of best fit: ŷ = ${m}x + ${c}. Predict y when x = ${x}.`,
        opts: options(`${y}`, [`${(m * x).toFixed(2)}`, `${(m + c).toFixed(2)}`, `${(x + c).toFixed(2)}`]),
        ans: `${y}`,
        sol: `Formula: ŷ = mx + c\nStep 1: ŷ = ${m}×${x} + ${c} = ${(m * x).toFixed(2)} + ${c}\nTherefore: ŷ = ${y}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Trigonometry Advanced': [
    (d) => {
      const ids = [
        { q: 'sin²θ + cos²θ ≡ ?', ans: '1', distract: ['0', 'tan θ', '2'] },
        { q: 'tan θ ≡ ?', ans: 'sin θ / cos θ', distract: ['cos θ / sin θ', '1 / sin θ', 'sin θ · cos θ'] },
        { q: '1 + tan²θ ≡ ?', ans: 'sec²θ', distract: ['cosec²θ', 'cos²θ', '2'] },
      ];
      const it = pickOne(ids);
      return {
        q: `Simplify the identity:  ${it.q}`,
        opts: options(it.ans, it.distract),
        ans: it.ans,
        sol: `This is a standard trigonometric identity.\nTherefore: ${it.q.replace('?', it.ans)}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],

  // ─── Physical Sciences ──────────────────────────────────────────
  "Newton's Laws": [
    (d) => { // F = ma
      const m = di(d, 2, 20), a = Rf(1, 9, 1);
      const F = +(m * a).toFixed(1);
      return {
        q: `A ${m} kg object accelerates at ${a} m/s². Find the net force.`,
        opts: options(`${F} N`, [`${(m + a).toFixed(1)} N`, `${(m / a).toFixed(1)} N`, `${(2 * F).toFixed(1)} N`]),
        ans: `${F} N`,
        sol: `Formula: F = ma\nStep 1: F = ${m} × ${a}\nTherefore: F = ${F} N`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // find acceleration
      const m = di(d, 2, 15), a = Ri(2, 8), F = m * a;
      return {
        q: `A net force of ${F} N acts on a ${m} kg object. Find its acceleration.`,
        opts: options(`${a} m/s²`, [`${F} m/s²`, `${(F * m)} m/s²`, `${a + 1} m/s²`]),
        ans: `${a} m/s²`,
        sol: `Formula: a = F ÷ m\nStep 1: a = ${F} ÷ ${m} = ${a}\nTherefore: a = ${a} m/s²`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // find mass
      const m = di(d, 2, 18), a = Ri(2, 7), F = m * a;
      return {
        q: `A force of ${F} N gives an object an acceleration of ${a} m/s². Find its mass.`,
        opts: options(`${m} kg`, [`${F} kg`, `${(F * a)} kg`, `${m + 2} kg`]),
        ans: `${m} kg`,
        sol: `Formula: m = F ÷ a\nStep 1: m = ${F} ÷ ${a} = ${m}\nTherefore: m = ${m} kg`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Momentum: [
    (d) => { // p = mv
      const m = di(d, 2, 16), v = Rf(2, 16, 1);
      const p = +(m * v).toFixed(1);
      return {
        q: `Find the momentum of a ${m} kg object moving at ${v} m/s.`,
        opts: options(`${p} kg·m/s`, [`${(m + v).toFixed(1)} kg·m/s`, `${(m / v).toFixed(1)} kg·m/s`, `${(2 * p).toFixed(1)} kg·m/s`]),
        ans: `${p} kg·m/s`,
        sol: `Formula: p = mv\nStep 1: p = ${m} × ${v}\nTherefore: p = ${p} kg·m/s`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // find velocity
      const m = di(d, 2, 12), v = Ri(3, 12), p = m * v;
      return {
        q: `An object of mass ${m} kg has momentum ${p} kg·m/s. Find its velocity.`,
        opts: options(`${v} m/s`, [`${p} m/s`, `${(p * m)} m/s`, `${v + 1} m/s`]),
        ans: `${v} m/s`,
        sol: `Formula: v = p ÷ m\nStep 1: v = ${p} ÷ ${m} = ${v}\nTherefore: v = ${v} m/s`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Energy & Power': [
    (d) => { // KE
      const m = di(d, 2, 20), v = Rf(2, 12, 1);
      const KE = +(0.5 * m * v * v).toFixed(1);
      return {
        q: `Find the kinetic energy of a ${m} kg object moving at ${v} m/s.`,
        opts: options(`${KE} J`, [`${(m * v).toFixed(1)} J`, `${(m * v * v).toFixed(1)} J`, `${(KE / 2).toFixed(1)} J`]),
        ans: `${KE} J`,
        sol: `Formula: KE = ½mv²\nStep 1: v² = ${(v * v).toFixed(2)}\nStep 2: KE = 0.5 × ${m} × ${(v * v).toFixed(2)} = ${KE}\nTherefore: KE = ${KE} J`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // PE = mgh
      const m = di(d, 2, 15), h = di(d, 2, 12), g = 9.8;
      const PE = +(m * g * h).toFixed(1);
      return {
        q: `Find the gravitational potential energy of a ${m} kg object ${h} m above the ground (g = 9.8 m/s²).`,
        opts: options(`${PE} J`, [`${(m * h).toFixed(1)} J`, `${(m + g + h).toFixed(1)} J`, `${(PE / 2).toFixed(1)} J`]),
        ans: `${PE} J`,
        sol: `Formula: PE = mgh\nStep 1: PE = ${m} × 9.8 × ${h}\nTherefore: PE = ${PE} J`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // Power = W / t
      const W = di(d, 50, 400), t = Ri(2, 10);
      const P = +(W / t).toFixed(1);
      return {
        q: `${W} J of work is done in ${t} s. Find the power.`,
        opts: options(`${P} W`, [`${(W * t)} W`, `${(W + t)} W`, `${(P + 5).toFixed(1)} W`]),
        ans: `${P} W`,
        sol: `Formula: P = W ÷ t\nStep 1: P = ${W} ÷ ${t} = ${P}\nTherefore: P = ${P} W`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Electricity & Magnetism': [
    (d) => { // Ohm's law I = V/R
      const V = di(d, 6, 24), R = di(d, 10, 80);
      const I = +(V / R).toFixed(3);
      return {
        q: `A ${V} V supply across a ${R} Ω resistor. Find the current.`,
        opts: options(`${I} A`, [`${(V * R)} A`, `${(R / V).toFixed(3)} A`, `${(V + R)} A`]),
        ans: `${I} A`,
        sol: `Formula: I = V ÷ R\nStep 1: I = ${V} ÷ ${R} = ${I}\nTherefore: I = ${I} A`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Waves & Sound': [
    (d) => { // wavelength
      const f = di(d, 100, 2000), v = 340;
      const l = +(v / f).toFixed(4);
      return {
        q: `A sound wave has frequency ${f} Hz (v = 340 m/s). Find the wavelength.`,
        opts: options(`${l} m`, [`${(f * v)} m`, `${(f / v).toFixed(4)} m`, `${(l * 2).toFixed(4)} m`]),
        ans: `${l} m`,
        sol: `Formula: λ = v ÷ f\nStep 1: λ = 340 ÷ ${f} = ${l}\nTherefore: λ = ${l} m`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // wave speed v = fλ
      const f = di(d, 50, 500), l = Rf(0.5, 4, 2);
      const v = +(f * l).toFixed(1);
      return {
        q: `A wave has frequency ${f} Hz and wavelength ${l} m. Find its speed.`,
        opts: options(`${v} m/s`, [`${(f / l).toFixed(1)} m/s`, `${(f + l).toFixed(1)} m/s`, `${(v / 2).toFixed(1)} m/s`]),
        ans: `${v} m/s`,
        sol: `Formula: v = fλ\nStep 1: v = ${f} × ${l} = ${v}\nTherefore: v = ${v} m/s`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Chemistry: Matter': [
    (d) => {
      const A: [string, number][] = [['H', 1], ['C', 12], ['O', 16], ['N', 14], ['Na', 23], ['Cl', 35.5], ['Ca', 40], ['S', 32]];
      const a = pickOne(A);
      return {
        q: `What is the approximate atomic mass of ${a[0]}?`,
        opts: options(`${a[1]}`, [`${a[1] * 2}`, `${a[1] + 1}`, `${Math.max(1, a[1] - 2)}`]),
        ans: `${a[1]}`,
        sol: `Step 1: Read ${a[0]} from the periodic table.\nTherefore: atomic mass ≈ ${a[1]} u`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Projectile Motion': [
    (d) => {
      const v0 = di(d, 10, 35), ang = pickOne([30, 45, 60]);
      const r = ang * Math.PI / 180;
      const H = +((v0 * v0 * Math.sin(r) ** 2) / (2 * 9.8)).toFixed(2);
      return {
        q: `A projectile is launched at ${v0} m/s and ${ang}°. Find its maximum height.`,
        opts: options(`${H} m`, [`${(H * 2).toFixed(2)} m`, `${v0} m`, `${(H / 2).toFixed(2)} m`]),
        ans: `${H} m`,
        sol: `Formula: H = (v₀sinθ)² ÷ (2g)\nStep 1: v₀sinθ = ${(v0 * Math.sin(r)).toFixed(2)}\nStep 2: H = ${(v0 * Math.sin(r)).toFixed(2)}² ÷ 19.6 = ${H}\nTherefore: H = ${H} m`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Electrostatics: [
    (d) => {
      const q1 = Rf(1, 8, 2) * 1e-6, q2 = Rf(1, 8, 2) * 1e-6, sep = Rf(0.1, 1.5, 2);
      const F = +((9e9 * q1 * q2) / (sep * sep)).toFixed(3);
      return {
        q: `Two charges q₁ = ${(q1 * 1e6).toFixed(2)} μC and q₂ = ${(q2 * 1e6).toFixed(2)} μC are ${sep} m apart. Find the force between them.`,
        opts: options(`${F} N`, [`${(F * 2).toFixed(3)} N`, `${(F / 2).toFixed(3)} N`, `${sep} N`]),
        ans: `${F} N`,
        sol: `Formula: F = kq₁q₂ ÷ r², k = 9×10⁹\nStep 1: numerator = 9×10⁹ × ${q1.toExponential(2)} × ${q2.toExponential(2)}\nStep 2: ÷ ${sep}² = ${F}\nTherefore: F = ${F} N`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Electric Circuits': [
    (d) => { // series current
      const V = di(d, 6, 24), R1 = di(d, 10, 60), R2 = di(d, 10, 60);
      const I = +(V / (R1 + R2)).toFixed(3);
      return {
        q: `R₁ = ${R1} Ω and R₂ = ${R2} Ω in series across ${V} V. Find the current.`,
        opts: options(`${I} A`, [`${(V / R1).toFixed(3)} A`, `${(V / R2).toFixed(3)} A`, `${(V / (R1 * R2)).toFixed(4)} A`]),
        ans: `${I} A`,
        sol: `Formula: series — Rₜ = R₁ + R₂, I = V ÷ Rₜ\nStep 1: Rₜ = ${R1} + ${R2} = ${R1 + R2}\nStep 2: I = ${V} ÷ ${R1 + R2} = ${I}\nTherefore: I = ${I} A`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // parallel resistance
      const R1 = di(d, 4, 20), R2 = di(d, 4, 20);
      const Rp = +((R1 * R2) / (R1 + R2)).toFixed(2);
      return {
        q: `R₁ = ${R1} Ω and R₂ = ${R2} Ω in parallel. Find the total resistance.`,
        opts: options(`${Rp} Ω`, [`${R1 + R2} Ω`, `${(R1 * R2)} Ω`, `${(Rp + 2).toFixed(2)} Ω`]),
        ans: `${Rp} Ω`,
        sol: `Formula: 1/Rₜ = 1/R₁ + 1/R₂  →  Rₜ = R₁R₂ ÷ (R₁+R₂)\nStep 1: Rₜ = (${R1}×${R2}) ÷ (${R1}+${R2}) = ${Rp}\nTherefore: Rₜ = ${Rp} Ω`,
        diff: DIFF_LABEL[d],
      };
    },
    (d) => { // power P = VI
      const V = di(d, 6, 24), I = Rf(0.5, 4, 1);
      const P = +(V * I).toFixed(2);
      return {
        q: `A device draws ${I} A at ${V} V. Find its power.`,
        opts: options(`${P} W`, [`${(V / I).toFixed(2)} W`, `${(V + I).toFixed(2)} W`, `${(P / 2).toFixed(2)} W`]),
        ans: `${P} W`,
        sol: `Formula: P = VI\nStep 1: P = ${V} × ${I} = ${P}\nTherefore: P = ${P} W`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Intermolecular Forces': [
    (d) => {
      const items = [
        { q: 'Which substance has the highest boiling point?', ans: 'Water (H₂O) — hydrogen bonding', distract: ['Methane (CH₄)', 'CO₂', 'N₂'] },
        { q: 'Which has the weakest intermolecular forces?', ans: 'N₂ — London forces only', distract: ['Water (H₂O)', 'Ethanol', 'HF'] },
      ];
      const it = pickOne(items);
      return {
        q: it.q,
        opts: options(it.ans, it.distract),
        ans: it.ans,
        sol: `Rank intermolecular forces: hydrogen bonds > dipole–dipole > London dispersion.\nTherefore: ${it.ans}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Chemical Equilibrium': [
    (d) => ({
      q: 'N₂ + 3H₂ ⇌ 2NH₃ with [N₂]=0.5, [H₂]=1.5, [NH₃]=3. Find Kc.',
      opts: options('Kc = 32.0', ['Kc = 16.0', 'Kc = 8.0', 'Kc = 64.0']),
      ans: 'Kc = 32.0',
      sol: `Formula: Kc = [products] ÷ [reactants], coefficients as powers\nStep 1: Kc = [NH₃]² ÷ ([N₂][H₂]³) = 3² ÷ (0.5 × 1.5³)\nStep 2: = 9 ÷ 1.6875 ≈ 32.0\nTherefore: Kc = 32.0`,
      diff: DIFF_LABEL[d],
    }),
  ],
  'Vectors & Scalars': [
    (d) => {
      const ax = di(d, -7, 7), ay = di(d, -7, 7);
      const mag = +Math.sqrt(ax * ax + ay * ay).toFixed(2);
      return {
        q: `Find the magnitude of the vector (${ax}, ${ay}).`,
        opts: options(`${mag}`, [`${Math.abs(ax) + Math.abs(ay)}`, `${ax + ay}`, `${(mag + 1).toFixed(2)}`]),
        ans: `${mag}`,
        sol: `Formula: |a| = √(aₓ² + aᵧ²)\nStep 1: ${ax}² + ${ay}² = ${ax * ax + ay * ay}\nStep 2: √${ax * ax + ay * ay} ≈ ${mag}\nTherefore: |a| ≈ ${mag}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Momentum & Impulse': [
    (d) => {
      const m = di(d, 2, 15), v1 = Rf(2, 12, 1), v2 = Rf(2, 14, 1), t = Rf(0.2, 3, 2);
      const dp = +(m * (v2 - v1)).toFixed(2);
      const Fa = +(Math.abs(dp) / t).toFixed(2);
      return {
        q: `A ${m} kg object changes velocity from ${v1} to ${v2} m/s in ${t} s. Find the average force.`,
        opts: options(`${Fa} N`, [`${(m * v2).toFixed(2)} N`, `${t} N`, `${(m * v1).toFixed(2)} N`]),
        ans: `${Fa} N`,
        sol: `Formula: F = Δp ÷ Δt, Δp = m(v₂−v₁)\nStep 1: Δp = ${m} × (${v2} − ${v1}) = ${dp}\nStep 2: F = |${dp}| ÷ ${t} = ${Fa}\nTherefore: F = ${Fa} N`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Vertical Projectile Motion': [
    (d) => {
      const v0 = di(d, 12, 35), g = 9.8;
      const tUp = +(v0 / g).toFixed(2);
      return {
        q: `A ball is thrown up at ${v0} m/s. How long to reach maximum height? (g = 9.8 m/s²)`,
        opts: options(`${tUp} s`, [`${(v0 / 2).toFixed(2)} s`, `${(v0 * g).toFixed(2)} s`, `${(tUp + 0.5).toFixed(2)} s`]),
        ans: `${tUp} s`,
        sol: `Formula: v = u − gt, at max height v = 0\nStep 1: 0 = ${v0} − 9.8t → t = ${v0} ÷ 9.8\nTherefore: t = ${tUp} s`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Electrodynamics: [
    (d) => {
      const N = di(d, 50, 400), B = Rf(0.05, 1.4, 2), A = Rf(0.005, 0.05, 4), dt = Rf(0.02, 0.5, 2);
      const emf = +((N * B * A) / dt).toFixed(2);
      return {
        q: `A ${N}-turn coil, B = ${B} T, A = ${A} m², flux collapses in ${dt} s. Find the induced EMF.`,
        opts: options(`${emf} V`, [`${(N * B).toFixed(2)} V`, `${(B * A).toFixed(4)} V`, `${(N / dt).toFixed(2)} V`]),
        ans: `${emf} V`,
        sol: `Formula: ε = N·B·A ÷ Δt\nStep 1: N·B·A = ${(N * B * A).toFixed(4)}\nStep 2: ÷ ${dt} = ${emf}\nTherefore: ε = ${emf} V`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  'Organic Chemistry': [
    (d) => {
      const A: [string, string, number][] = [
        ['Methane', 'CH₄', 1], ['Ethane', 'C₂H₆', 2], ['Propane', 'C₃H₈', 3], ['Butane', 'C₄H₁₀', 4], ['Pentane', 'C₅H₁₂', 5],
      ];
      const a = pickOne(A);
      return {
        q: `${a[0]} has ${a[2]} carbon atom(s). What is its molecular formula?`,
        opts: options(a[1], [`C${a[2]}H${2 * a[2]}`, `C${a[2] + 1}H${2 * (a[2] + 1) + 2}`, `C${a[2]}H${2 * a[2] + 4}`]),
        ans: a[1],
        sol: `Formula: alkanes follow CₙH₂ₙ₊₂\nStep 1: n = ${a[2]} → H = 2(${a[2]}) + 2 = ${2 * a[2] + 2}\nTherefore: ${a[1]}`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
  Electrochemistry: [
    (d) => ({
      q: 'Galvanic cell: Zn (E° = −0.76 V), Cu (E° = +0.34 V). Find the cell EMF.',
      opts: options('1.10 V', ['0.42 V', '−0.42 V', '1.52 V']),
      ans: '1.10 V',
      sol: `Formula: E°cell = E°cathode − E°anode\nStep 1: Cu is cathode (+0.34), Zn is anode (−0.76)\nStep 2: E°cell = 0.34 − (−0.76) = 1.10 V\nTherefore: EMF = 1.10 V`,
      diff: DIFF_LABEL[d],
    }),
  ],
  'Optical Phenomena': [
    (d) => {
      const f = Rf(4e14, 8e14, 2), h = 6.63e-34;
      const E = (h * f).toExponential(2);
      return {
        q: `Find the energy of a photon of frequency ${f.toExponential(2)} Hz (h = 6.63×10⁻³⁴ J·s).`,
        opts: options(`${E} J`, [`${(f / h).toExponential(2)} J`, `${h} J`, `${f} J`]),
        ans: `${E} J`,
        sol: `Formula: E = hf\nStep 1: E = 6.63×10⁻³⁴ × ${f.toExponential(2)}\nTherefore: E = ${E} J`,
        diff: DIFF_LABEL[d],
      };
    },
  ],
};

function factorial(n: number): number { return n <= 1 ? 1 : n * factorial(n - 1); }
function sub(n: number): string {
  return String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c] || c).join('');
}

/**
 * Generate one question for a topic at a given difficulty. Picks a random
 * variant for variety. Falls back to a sensible default for unknown topics.
 */
export function generateQuestion(
  topic: string,
  subject: string,
  _grade: number,
  difficulty: GenDiff = 'MEDIUM',
): GeneratedQuestion {
  const variants = QG[topic];
  if (variants && variants.length) return pickOne(variants)(difficulty);
  const fallback = subject === 'mathematics' ? QG['Algebra'] : QG["Newton's Laws"];
  return pickOne(fallback)(difficulty);
}

/**
 * Compute a fair per-question time-limit (seconds) for the live quiz timer.
 */
export function expectedSecondsFor(input: {
  difficulty?: string | null;
  question?: string;
  options?: string[];
  solution?: string | null;
  imageData?: string | null;
}): number {
  const diff = (input.difficulty || 'EASY').toUpperCase();
  const base = diff === 'HARD' ? 120 : diff === 'MEDIUM' ? 75 : 45;
  const words = (input.question || '').trim().split(/\s+/).length;
  const readBonus = Math.min(60, Math.round(words * 0.4));
  const optBonus = Math.min(25, ((input.options?.length ?? 0) - 4) * 5);
  const imgBonus = input.imageData ? 20 : 0;
  const solWords = (input.solution || '').trim().split(/\s+/).length;
  const complexity = Math.min(40, Math.round(solWords * 0.2));
  return Math.max(25, Math.min(240, base + readBonus + optBonus + imgBonus + complexity));
}

export const CAPS_TOPICS: Record<string, Record<number, string[]>> = {
  mathematics: {
    10: ['Algebra', 'Functions & Graphs', 'Trigonometry', 'Statistics', 'Finance & Growth', 'Euclidean Geometry'],
    11: ['Quadratic Equations', 'Trigonometric Functions', 'Analytical Geometry', 'Finance', 'Counting & Probability', 'Inequalities'],
    12: ['Differential Calculus', 'Sequences & Series', 'Polynomials', 'Exponential & Logarithms', 'Regression Analysis', 'Trigonometry Advanced'],
  },
  physical_sciences: {
    10: ["Newton's Laws", 'Momentum', 'Energy & Power', 'Waves & Sound', 'Electricity & Magnetism', 'Chemistry: Matter'],
    11: ['Projectile Motion', 'Electrostatics', 'Electric Circuits', 'Intermolecular Forces', 'Chemical Equilibrium', 'Vectors & Scalars'],
    12: ['Momentum & Impulse', 'Vertical Projectile Motion', 'Electrodynamics', 'Organic Chemistry', 'Electrochemistry', 'Optical Phenomena'],
  },
};
