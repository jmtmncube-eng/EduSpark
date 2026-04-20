const Ri = (a: number, b: number) => Math.floor(Math.random() * (b - a + 1)) + a;
const Rf = (a: number, b: number, d = 1) =>
  parseFloat((Math.random() * (b - a) + a).toFixed(d));

interface GeneratedQuestion {
  q: string;
  opts: string[];
  ans: string;
  sol: string;
  diff: string;
}

type GeneratorFn = () => GeneratedQuestion;

const QG: Record<string, GeneratorFn> = {
  Algebra: () => {
    const a = Ri(2, 8), b = Ri(1, 12), c = Ri(b + 1, 24);
    const ans = ((c - b) / a).toFixed(2);
    return {
      q: `Solve: ${a}x + ${b} = ${c}`,
      opts: [`x=${ans}`, `x=${((c + b) / a).toFixed(2)}`, `x=${(c / a).toFixed(2)}`, `x=${a * b}`],
      ans: `x=${ans}`,
      sol: `Formula: To solve a linear equation ax + b = c, isolate x by performing inverse operations on both sides\nStep 1: Subtract ${b} from both sides: ${a}x + ${b} − ${b} = ${c} − ${b}  →  ${a}x = ${c - b}\nStep 2: Divide both sides by ${a}: x = ${c - b} ÷ ${a} = ${ans}\nStep 3: Verify by substituting back: ${a}(${ans}) + ${b} = ${(a * +ans).toFixed(2)} + ${b} = ${(a * +ans + b).toFixed(2)} ✓\nTherefore: x = ${ans}`,
      diff: 'Easy',
    };
  },
  'Functions & Graphs': () => {
    const a = Ri(1, 4), b = Ri(-5, 5), c = Ri(-8, 8);
    return {
      q: `y-intercept of y = ${a}x² ${b >= 0 ? '+ ' + b : '− ' + Math.abs(b)}x ${c >= 0 ? '+ ' + c : '− ' + Math.abs(c)}?`,
      opts: [`y=${c}`, `y=${a}`, `y=${b}`, `y=${a + b + c}`],
      ans: `y=${c}`,
      sol: `Formula: The y-intercept is the point where the graph crosses the y-axis, i.e. where x = 0\nStep 1: Substitute x = 0 into y = ${a}(0)² + ${b}(0) + ${c}\nStep 2: Evaluate each term: ${a}(0)² = 0, ${b}(0) = 0, constant = ${c}\nStep 3: y = 0 + 0 + ${c} = ${c}\nStep 4: The y-intercept is always the constant term 'c' in a quadratic y = ax² + bx + c because all terms with x vanish when x = 0\nTherefore: y-intercept = ${c}`,
      diff: 'Easy',
    };
  },
  Trigonometry: () => {
    const A = [30, 45, 60];
    const S = ['½', '√2/2', '√3/2'];
    const C = ['√3/2', '√2/2', '½'];
    const T = ['1/√3', '1', '√3'];
    const i = Ri(0, 2), f = Ri(0, 2);
    const fn = ['sin', 'cos', 'tan'];
    const V = [S, C, T];
    const angleExplanations: Record<number, string> = {
      30: 'In a 30-60-90 triangle, sides are in ratio 1 : √3 : 2',
      45: 'In a 45-45-90 triangle, sides are in ratio 1 : 1 : √2',
      60: 'In a 30-60-90 triangle, sides are in ratio 1 : √3 : 2',
    };
    const fnExplanations: Record<string, string> = {
      sin: 'sin = opposite / hypotenuse',
      cos: 'cos = adjacent / hypotenuse',
      tan: 'tan = opposite / adjacent',
    };
    return {
      q: `Calculate ${fn[f]}(${A[i]}°)`,
      opts: [V[f][i], V[(f + 1) % 3][i], V[(f + 2) % 3][i], '2'],
      ans: V[f][i],
      sol: `Formula: ${fnExplanations[fn[f]]}\nStep 1: Recall the special angle triangle for ${A[i]}°: ${angleExplanations[A[i]]}\nStep 2: Identify the relevant sides for ${fn[f]}(${A[i]}°) using the SOHCAHTOA mnemonic\nStep 3: Apply the ratio to get the exact value: ${fn[f]}(${A[i]}°) = ${V[f][i]}\nStep 4: This is a standard trigonometric value that should be memorised for special angles (30°, 45°, 60°)\nTherefore: ${fn[f]}(${A[i]}°) = ${V[f][i]}`,
      diff: 'Easy',
    };
  },
  Statistics: () => {
    const d = Array.from({ length: Ri(5, 7) }, () => Ri(10, 80)).sort((a, b) => a - b);
    const m = (d.reduce((s, v) => s + v, 0) / d.length).toFixed(1);
    return {
      q: `Mean of {${d.join(', ')}}?`,
      opts: [`${m}`, `${d[Math.floor(d.length / 2)]}`, `${d[d.length - 1] - d[0]}`, `${(+m + 5).toFixed(1)}`],
      ans: `${m}`,
      sol: `Formula: Mean = (Sum of all values) ÷ (Number of values) = Σx / n\nStep 1: List all values in the data set: {${d.join(', ')}}\nStep 2: Add all values together: ${d.join(' + ')} = ${d.reduce((s, v) => s + v, 0)}\nStep 3: Count the number of values: n = ${d.length}\nStep 4: Divide the sum by n: Mean = ${d.reduce((s, v) => s + v, 0)} ÷ ${d.length} = ${m}\nStep 5: The mean represents the 'balance point' or average of the data set\nTherefore: Mean = ${m}`,
      diff: 'Easy',
    };
  },
  'Finance & Growth': () => {
    const P = Ri(5, 50) * 1000, r = Rf(5, 15, 1), n = Ri(1, 5);
    const A = (P * Math.pow(1 + r / 100, n)).toFixed(2);
    return {
      q: `R${P.toLocaleString()} at ${r}% compound, ${n} yr(s). Amount?`,
      opts: [`R${A}`, `R${(P * (1 + (r / 100) * n)).toFixed(2)}`, `R${(P + P * r / 100).toFixed(0)}`, `R${P * 2}`],
      ans: `R${A}`,
      sol: `Formula: Compound Interest — A = P(1 + r)ⁿ, where P = principal, r = annual interest rate (as decimal), n = number of years\nStep 1: Identify the values: P = R${P}, r = ${r}% = ${r / 100}, n = ${n} year(s)\nStep 2: Calculate the growth factor: (1 + r) = 1 + ${r / 100} = ${(1 + r / 100).toFixed(4)}\nStep 3: Raise the growth factor to the power of n: (${(1 + r / 100).toFixed(4)})^${n} = ${Math.pow(1 + r / 100, n).toFixed(6)}\nStep 4: Multiply by the principal: A = ${P} × ${Math.pow(1 + r / 100, n).toFixed(6)} = R${A}\nStep 5: Compound interest earns interest on interest, so it grows faster than simple interest\nTherefore: Accumulated amount = R${A}`,
      diff: 'Medium',
    };
  },
  'Quadratic Equations': () => {
    const p = Ri(1, 7), q = Ri(1, 7);
    return {
      q: `Solve: x² − ${p + q}x + ${p * q} = 0`,
      opts: [`x=${p} or x=${q}`, `x=${-p} or x=${-q}`, `x=${p + 1} or x=${q - 1}`, `x=${p * q}`],
      ans: `x=${p} or x=${q}`,
      sol: `Formula: To factorise a quadratic x² + bx + c = 0, find two numbers that multiply to c and add to b\nStep 1: Identify coefficients: a = 1, b = −${p + q}, c = ${p * q}\nStep 2: Find two numbers that multiply to +${p * q} and add to −${p + q}: those numbers are −${p} and −${q}\nStep 3: Check: (−${p}) × (−${q}) = +${p * q} ✓ and (−${p}) + (−${q}) = −${p + q} ✓\nStep 4: Write in factored form: (x − ${p})(x − ${q}) = 0\nStep 5: Apply the Zero Product Property — if A × B = 0, then A = 0 or B = 0\nStep 6: Solve each factor: x − ${p} = 0 → x = ${p};  x − ${q} = 0 → x = ${q}\nTherefore: x = ${p} or x = ${q}`,
      diff: 'Medium',
    };
  },
  'Differential Calculus': () => {
    const a = Ri(1, 5), n = Ri(2, 5), b = Ri(1, 6);
    return {
      q: `f'(x) if f(x) = ${a}x^${n} + ${b}x?`,
      opts: [`${a * n}x^${n - 1} + ${b}`, `${a}x^${n + 1}`, `${a * n}x^${n}`, `${n}x^${n - 1}`],
      ans: `${a * n}x^${n - 1} + ${b}`,
      sol: `Formula: Power Rule — d/dx[axⁿ] = a·n·xⁿ⁻¹; and d/dx[bx] = b (derivative of a linear term is its coefficient)\nStep 1: Differentiate the first term ${a}x^${n} using the power rule: bring down the exponent as a coefficient, then reduce the exponent by 1\nStep 2: d/dx[${a}x^${n}] = ${a} × ${n} × x^(${n}−1) = ${a * n}x^${n - 1}\nStep 3: Differentiate the second term ${b}x: the derivative of any term cx is simply c\nStep 4: d/dx[${b}x] = ${b}\nStep 5: Combine the results using the Sum Rule (differentiate term by term)\nTherefore: f'(x) = ${a * n}x^${n - 1} + ${b}`,
      diff: 'Medium',
    };
  },
  'Sequences & Series': () => {
    const a = Ri(2, 15), d = Ri(1, 8), n = Ri(5, 12);
    const Sn = Math.round((n / 2) * (2 * a + (n - 1) * d));
    return {
      q: `a=${a}, d=${d}. Find S${n}.`,
      opts: [`S${n}=${Sn}`, `S${n}=${Sn + d}`, `S${n}=${a + (n - 1) * d}`, `S${n}=${n * a}`],
      ans: `S${n}=${Sn}`,
      sol: `Formula: Sum of an Arithmetic Series — Sₙ = n/2 × (2a + (n − 1)d), where a = first term, d = common difference, n = number of terms\nStep 1: Identify the values: a = ${a}, d = ${d}, n = ${n}\nStep 2: Calculate the bracket term (2a + (n − 1)d): 2(${a}) + (${n} − 1)(${d}) = ${2 * a} + ${(n - 1) * d} = ${2 * a + (n - 1) * d}\nStep 3: Multiply by n/2: Sₙ = ${n}/2 × ${2 * a + (n - 1) * d}\nStep 4: Calculate: ${n}/2 = ${n / 2}, then ${n / 2} × ${2 * a + (n - 1) * d} = ${Sn}\nStep 5: The formula works because the series is an arithmetic progression where terms increase by a fixed amount d each time\nTherefore: S${n} = ${Sn}`,
      diff: 'Medium',
    };
  },
  "Newton's Laws": () => {
    const m = Ri(2, 25), av = Rf(1, 12, 1);
    const F = (m * av).toFixed(1);
    return {
      q: `${m}kg object, a=${av}m/s². Net force?`,
      opts: [`F=${F}N`, `F=${(m + av).toFixed(1)}N`, `F=${(m / av).toFixed(1)}N`, `F=${2 * m * av}N`],
      ans: `F=${F}N`,
      sol: `Formula: Newton's Second Law of Motion — F = ma, where F = net force (N), m = mass (kg), a = acceleration (m/s²)\nStep 1: Identify the given values: mass m = ${m} kg, acceleration a = ${av} m/s²\nStep 2: Recall that Newton's Second Law states the net force acting on an object equals its mass multiplied by its acceleration\nStep 3: Substitute the values into F = ma: F = ${m} × ${av}\nStep 4: Perform the multiplication: F = ${F} N\nStep 5: The unit of force is the Newton (N), which equals 1 kg·m/s²\nTherefore: Net force F = ${F} N`,
      diff: 'Easy',
    };
  },
  Momentum: () => {
    const m = Ri(2, 20), v = Rf(2, 20, 1);
    const p = (m * v).toFixed(1);
    return {
      q: `Momentum: ${m}kg at ${v}m/s?`,
      opts: [`p=${p}kg·m/s`, `p=${(m + v).toFixed(1)}kg·m/s`, `p=${(m / v).toFixed(1)}kg·m/s`, `p=${2 * m * v}kg·m/s`],
      ans: `p=${p}kg·m/s`,
      sol: `Formula: Linear Momentum — p = mv, where p = momentum (kg·m/s), m = mass (kg), v = velocity (m/s)\nStep 1: Identify the given values: mass m = ${m} kg, velocity v = ${v} m/s\nStep 2: Recall that momentum is a vector quantity representing the 'quantity of motion' of an object\nStep 3: Substitute the values into p = mv: p = ${m} × ${v}\nStep 4: Perform the multiplication: p = ${p} kg·m/s\nStep 5: The unit is kg·m/s, which comes directly from multiplying kg × m/s\nTherefore: Momentum p = ${p} kg·m/s`,
      diff: 'Easy',
    };
  },
  'Energy & Power': () => {
    const m = Ri(2, 30), v = Rf(2, 15, 1);
    const KE = (0.5 * m * v * v).toFixed(1);
    return {
      q: `KE of ${m}kg at ${v}m/s?`,
      opts: [`KE=${KE}J`, `KE=${(m * v).toFixed(1)}J`, `KE=${(m * v * v).toFixed(1)}J`, `KE=${(+KE / 2).toFixed(1)}J`],
      ans: `KE=${KE}J`,
      sol: `Formula: Kinetic Energy — KE = ½mv², where m = mass (kg), v = speed (m/s), KE = kinetic energy (J)\nStep 1: Identify the given values: mass m = ${m} kg, speed v = ${v} m/s\nStep 2: Recall that kinetic energy is the energy an object possesses due to its motion\nStep 3: Calculate v²: v² = (${v})² = ${(v * v).toFixed(2)} m²/s²\nStep 4: Multiply by mass: m × v² = ${m} × ${(v * v).toFixed(2)} = ${(m * v * v).toFixed(2)}\nStep 5: Multiply by ½: KE = 0.5 × ${(m * v * v).toFixed(2)} = ${KE} J\nStep 6: The unit Joule (J) = kg·m²/s², which is consistent with the formula units\nTherefore: Kinetic Energy KE = ${KE} J`,
      diff: 'Easy',
    };
  },
  'Electricity & Magnetism': () => {
    const V = Ri(6, 24), R = Ri(10, 100);
    const I = (V / R).toFixed(3);
    return {
      q: `V=${V}V, R=${R}Ω. Find I.`,
      opts: [`I=${I}A`, `I=${V * R}A`, `I=${(R / V).toFixed(3)}A`, `I=${V + R}A`],
      ans: `I=${I}A`,
      sol: `Formula: Ohm's Law — V = IR, rearranged to I = V/R, where V = voltage (V), I = current (A), R = resistance (Ω)\nStep 1: Identify the given values: voltage V = ${V} V, resistance R = ${R} Ω\nStep 2: Recall Ohm's Law: the current through a conductor is directly proportional to the voltage and inversely proportional to the resistance\nStep 3: Rearrange V = IR to solve for current I: I = V ÷ R\nStep 4: Substitute the values: I = ${V} ÷ ${R}\nStep 5: Perform the division: I = ${I} A\nStep 6: The unit of current is the Ampere (A), representing the flow of charge (Coulombs per second)\nTherefore: Current I = ${I} A`,
      diff: 'Easy',
    };
  },
  'Waves & Sound': () => {
    const f = Ri(100, 3000);
    const l = (340 / f).toFixed(4);
    return {
      q: `f=${f}Hz, v=340m/s. Find λ.`,
      opts: [`λ=${l}m`, `λ=${f * 340}m`, `λ=${(f / 340).toFixed(4)}m`, `λ=${340 + f}m`],
      ans: `λ=${l}m`,
      sol: `Formula: Wave Equation — v = fλ, rearranged to λ = v/f, where v = wave speed (m/s), f = frequency (Hz), λ = wavelength (m)\nStep 1: Identify the given values: frequency f = ${f} Hz, wave speed v = 340 m/s (speed of sound in air at room temperature)\nStep 2: Recall the wave equation: speed equals frequency multiplied by wavelength\nStep 3: Rearrange v = fλ to solve for wavelength λ: λ = v ÷ f\nStep 4: Substitute the values: λ = 340 ÷ ${f}\nStep 5: Perform the division: λ = ${l} m\nStep 6: Higher frequency waves have shorter wavelengths — this is the inverse relationship between f and λ\nTherefore: Wavelength λ = ${l} m`,
      diff: 'Easy',
    };
  },
  'Projectile Motion': () => {
    const v0 = Ri(10, 40), ang = Ri(30, 60);
    const r = (ang * Math.PI) / 180;
    const H = ((v0 * v0 * Math.sin(r) * Math.sin(r)) / (2 * 9.8)).toFixed(2);
    return {
      q: `${v0}m/s at ${ang}°. Max height?`,
      opts: [`H=${H}m`, `H=${(+H * 2).toFixed(2)}m`, `H=${v0}m`, `H=${(+H / 2).toFixed(2)}m`],
      ans: `H=${H}m`,
      sol: `Formula: Maximum Height in Projectile Motion — H = (v₀ sinθ)² / (2g), where v₀ = initial speed, θ = launch angle, g = 9.8 m/s²\nStep 1: Identify the given values: initial speed v₀ = ${v0} m/s, launch angle θ = ${ang}°, g = 9.8 m/s²\nStep 2: Calculate the vertical component of initial velocity: v₀y = v₀ sin(θ) = ${v0} × sin(${ang}°) = ${(v0 * Math.sin(r)).toFixed(4)} m/s\nStep 3: At maximum height, the vertical velocity = 0 (the object momentarily stops moving upward)\nStep 4: Calculate v₀y²: (${(v0 * Math.sin(r)).toFixed(4)})² = ${(v0 * v0 * Math.sin(r) * Math.sin(r)).toFixed(4)} m²/s²\nStep 5: Calculate 2g: 2 × 9.8 = 19.6 m/s²\nStep 6: Divide to get H: H = ${(v0 * v0 * Math.sin(r) * Math.sin(r)).toFixed(4)} ÷ 19.6 = ${H} m\nTherefore: Maximum height H = ${H} m`,
      diff: 'Hard',
    };
  },
  Electrostatics: () => {
    const q1 = Rf(1, 8, 2) * 1e-6, q2 = Rf(1, 8, 2) * 1e-6, r = Rf(0.1, 1.5, 2);
    const F = ((9e9 * q1 * q2) / (r * r)).toFixed(3);
    return {
      q: `q₁=${(q1 * 1e6).toFixed(2)}μC,q₂=${(q2 * 1e6).toFixed(2)}μC,r=${r}m. Force?`,
      opts: [`F=${F}N`, `F=${(+F * 2).toFixed(3)}N`, `F=${(+F / 2).toFixed(3)}N`, `F=${r}N`],
      ans: `F=${F}N`,
      sol: `Formula: Coulomb's Law — F = kq₁q₂/r², where k = 9×10⁹ N·m²/C², q = charge (C), r = separation (m)\nStep 1: Identify the given values: q₁ = ${(q1 * 1e6).toFixed(2)} μC = ${q1.toExponential(4)} C, q₂ = ${(q2 * 1e6).toFixed(2)} μC = ${q2.toExponential(4)} C, r = ${r} m\nStep 2: Convert μC to Coulombs by multiplying by 10⁻⁶ (this step is critical to get the correct answer)\nStep 3: Calculate the numerator: k × q₁ × q₂ = 9×10⁹ × ${q1.toExponential(2)} × ${q2.toExponential(2)} = ${(9e9 * q1 * q2).toExponential(4)} N·m²\nStep 4: Calculate r²: (${r})² = ${(r * r).toFixed(4)} m²\nStep 5: Divide numerator by r²: F = ${(9e9 * q1 * q2).toExponential(4)} ÷ ${(r * r).toFixed(4)} = ${F} N\nStep 6: The force is attractive if charges are opposite in sign, and repulsive if same sign\nTherefore: Electrostatic force F = ${F} N`,
      diff: 'Hard',
    };
  },
  'Electric Circuits': () => {
    const V = Ri(6, 24), R1 = Ri(10, 80), R2 = Ri(10, 80);
    const Is = (V / (R1 + R2)).toFixed(3);
    return {
      q: `R₁=${R1}Ω,R₂=${R2}Ω series,V=${V}V. Current?`,
      opts: [`I=${Is}A`, `I=${(V / R1).toFixed(3)}A`, `I=${(V / R2).toFixed(3)}A`, `I=${(V / (R1 * R2)).toFixed(5)}A`],
      ans: `I=${Is}A`,
      sol: `Formula: Series Circuit — Rₜₒₜₐₗ = R₁ + R₂ + ..., then I = V/Rₜₒₜₐₗ (Ohm's Law)\nStep 1: Identify the circuit configuration: R₁ = ${R1} Ω and R₂ = ${R2} Ω are connected in series, with voltage V = ${V} V\nStep 2: In a series circuit, resistances add directly because the same current flows through all components\nStep 3: Calculate total resistance: Rₜₒₜₐₗ = R₁ + R₂ = ${R1} + ${R2} = ${R1 + R2} Ω\nStep 4: Apply Ohm's Law to find the current: I = V ÷ Rₜₒₜₐₗ\nStep 5: Substitute values: I = ${V} ÷ ${R1 + R2} = ${Is} A\nStep 6: This same current ${Is} A flows through both R₁ and R₂ because they are in series\nTherefore: Current I = ${Is} A`,
      diff: 'Medium',
    };
  },
  'Momentum & Impulse': () => {
    const m = Ri(2, 20), v1 = Rf(2, 15, 1), v2 = Rf(2, 15, 1), t = Rf(0.1, 4, 2);
    const dp = (m * (v2 - v1)).toFixed(2);
    const Fa = (Math.abs(+dp) / t).toFixed(2);
    return {
      q: `${m}kg, v:${v1}→${v2}m/s in ${t}s. Avg force?`,
      opts: [`F=${Fa}N`, `F=${(m * v2).toFixed(2)}N`, `F=${t}N`, `F=${(m * v1).toFixed(2)}N`],
      ans: `F=${Fa}N`,
      sol: `Formula: Impulse-Momentum Theorem — FΔt = Δp = m(v₂ − v₁), rearranged to F = Δp / Δt\nStep 1: Identify the given values: mass m = ${m} kg, initial velocity v₁ = ${v1} m/s, final velocity v₂ = ${v2} m/s, time Δt = ${t} s\nStep 2: Calculate the change in momentum Δp: Δp = m(v₂ − v₁) = ${m} × (${v2} − ${v1}) = ${m} × ${(v2 - v1).toFixed(1)} = ${dp} kg·m/s\nStep 3: The impulse FΔt equals the change in momentum Δp (Newton's Second Law in impulse form)\nStep 4: Rearrange to solve for average force: F = |Δp| ÷ Δt\nStep 5: Substitute values: F = |${dp}| ÷ ${t} = ${Math.abs(+dp).toFixed(2)} ÷ ${t} = ${Fa} N\nStep 6: The magnitude is used because the question asks for the average force magnitude\nTherefore: Average force F = ${Fa} N`,
      diff: 'Medium',
    };
  },
  'Organic Chemistry': () => {
    const A: [string, string, number][] = [
      ['Methane', 'CH₄', 1], ['Ethane', 'C₂H₆', 2], ['Propane', 'C₃H₈', 3], ['Butane', 'C₄H₁₀', 4],
    ];
    const a = A[Ri(0, 3)];
    return {
      q: `${a[0]}: ${a[2]} carbon(s). Formula?`,
      opts: [a[1], `C${a[2]}H${2 * a[2]}`, `C${a[2] + 1}H${2 * (a[2] + 1) + 2}`, `C${a[2]}H${2 * a[2] + 4}`],
      ans: a[1],
      sol: `Formula: General formula for alkanes (saturated hydrocarbons) — CₙH₂ₙ₊₂\nStep 1: Identify the compound: ${a[0]} is an alkane with n = ${a[2]} carbon atom(s)\nStep 2: Alkanes are saturated hydrocarbons — they contain only single C–C and C–H bonds\nStep 3: Apply the general formula CₙH₂ₙ₊₂: substitute n = ${a[2]}\nStep 4: Calculate hydrogen atoms: 2n + 2 = 2(${a[2]}) + 2 = ${2 * a[2]} + 2 = ${2 * a[2] + 2}\nStep 5: Write the molecular formula with ${a[2]} carbon(s) and ${2 * a[2] + 2} hydrogen(s): ${a[1]}\nStep 6: This pattern holds for all straight-chain alkanes in the homologous series\nTherefore: Molecular formula = ${a[1]}`,
      diff: 'Easy',
    };
  },
  Electrochemistry: () => ({
    q: 'Galvanic cell: Zn(E°=−0.76V), Cu(E°=+0.34V). EMF?',
    opts: ['1.10V', '0.42V', '−0.42V', '1.52V'],
    ans: '1.10V',
    sol: `Formula: Standard EMF of a galvanic cell — E°cell = E°cathode − E°anode\nStep 1: Identify the two half-cells: Zinc (Zn) with E° = −0.76 V and Copper (Cu) with E° = +0.34 V\nStep 2: Determine which electrode is the cathode and which is the anode: the electrode with the higher (more positive) standard reduction potential acts as the cathode (where reduction occurs)\nStep 3: Cu has E° = +0.34 V (higher), so Cu is the cathode (reduction: Cu²⁺ + 2e⁻ → Cu)\nStep 4: Zn has E° = −0.76 V (lower), so Zn is the anode (oxidation: Zn → Zn²⁺ + 2e⁻)\nStep 5: Apply the formula: E°cell = E°cathode − E°anode = +0.34 − (−0.76)\nStep 6: Simplify: E°cell = 0.34 + 0.76 = 1.10 V\nStep 7: A positive E°cell confirms the reaction is spontaneous (a galvanic cell produces electrical energy)\nTherefore: EMF = 1.10 V`,
    diff: 'Hard',
  }),
  'Chemical Equilibrium': () => ({
    q: 'N₂+3H₂⇌2NH₃: [N₂]=0.5,[H₂]=1.5,[NH₃]=3. Kc?',
    opts: ['Kc=32.0', 'Kc=16.0', 'Kc=8.0', 'Kc=64.0'],
    ans: 'Kc=32.0',
    sol: `Formula: Equilibrium Constant Expression — Kc = [products]^stoich / [reactants]^stoich\nStep 1: Write the balanced equation: N₂ + 3H₂ ⇌ 2NH₃\nStep 2: Write the Kc expression using the stoichiometric coefficients as exponents: Kc = [NH₃]² / ([N₂]¹[H₂]³)\nStep 3: Note: products go in the numerator, reactants go in the denominator; only aqueous and gaseous species are included\nStep 4: Substitute equilibrium concentrations: [NH₃] = 3 mol/L, [N₂] = 0.5 mol/L, [H₂] = 1.5 mol/L\nStep 5: Calculate numerator: [NH₃]² = (3)² = 9\nStep 6: Calculate denominator: [N₂] × [H₂]³ = 0.5 × (1.5)³ = 0.5 × 3.375 = 1.6875\nStep 7: Divide: Kc = 9 ÷ 1.6875 ≈ 32.0 (Kc has no units when using the standard concentration convention)\nTherefore: Kc = 32.0`,
    diff: 'Hard',
  }),
  'Intermolecular Forces': () => ({
    q: 'Highest boiling point (H-bonding)?',
    opts: ['Water (H₂O)', 'Methane (CH₄)', 'CO₂', 'N₂'],
    ans: 'Water (H₂O)',
    sol: `Formula: Boiling point is determined by the strength of intermolecular forces — stronger forces require more energy (higher temperature) to overcome\nStep 1: Identify the type of intermolecular forces in each substance:\n  • H₂O: Hydrogen bonding (strongest type of dipole–dipole interaction)\n  • CH₄: London dispersion forces only (weakest, non-polar molecule)\n  • CO₂: London dispersion forces + weak dipole interactions (linear, non-polar overall)\n  • N₂: London dispersion forces only (very weak, small non-polar molecule)\nStep 2: Hydrogen bonding occurs when H is bonded to a highly electronegative atom (F, O, or N) — in H₂O, the O–H bonds create strong intermolecular attractions\nStep 3: Rank intermolecular forces from strongest to weakest: Hydrogen bonds > Dipole–dipole > London dispersion\nStep 4: The stronger the intermolecular forces, the more energy is needed to separate molecules into the gas phase, resulting in a higher boiling point\nStep 5: Water's boiling point is 100°C; methane boils at −161°C; CO₂ sublimes at −78.5°C; N₂ boils at −196°C\nTherefore: Water (H₂O) has the highest boiling point due to its strong hydrogen bonding`,
    diff: 'Easy',
  }),
};

export function generateQuestion(topic: string, subject: string, grade: number): GeneratedQuestion {
  const fn = QG[topic];
  if (fn) {
    const r = fn();
    if (r) return r;
  }
  return subject === 'mathematics' ? QG['Algebra']() : QG["Newton's Laws"]();
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
