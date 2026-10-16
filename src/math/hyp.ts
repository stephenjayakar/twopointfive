// LENGTHS — Math.hypot's own answer without Math.hypot's call.
//
// Math.hypot is the one Math function that is slow where this game runs. In V8 every call goes out to a builtin and comes back with a boxed number; up to V8 12
// (node 22) that builtin also ALLOCATES a scratch array per call (~100 ns and ~a hundred bytes of garbage), and for four arguments or more it still does in
// Chrome. In JavaScriptCore (bun: the headless harness) it is a host call at ~45 ns. The step asks for several thousand lengths a frame. sqrt(a² + b² + c²) is no
// substitute: it differs from hypot in the last bit about one time in three, and lengths feed everything the digests hash.
//
// So this file carries two ALGORITHMS over scalars and picks per arity — at load, by trial against the runtime's own Math.hypot on a fixed sample — the one that
// gives that runtime's bits; where neither does, the export IS Math.hypot. The answer is therefore the runtime's own in every case:
//   · V8 (node, Chrome): the max-scaled Kahan sum of builtins/math.tq — kahan2 / 3 / 4 below, statement for statement (the newer fast path for two and three
//     arguments is the same operations in the same order).
//   · bun on linux x64: three arguments go to the C++ library's std::hypot(x, y, z) — libstdc++'s max-scaled plain sum = scaled3; two go to libm's hypot and four
//     to a streaming fused sum, neither reproduced here, so hyp2 and hyp4 stay the builtin there.
//   · anything else (Safari and bun on a Mac: libc++; Firefox; an FMA-contracted build): whatever the trial finds — where nothing matches, the builtin, no gain.
// THE TRIAL IS A SAMPLED MATCH, NOT A PROOF: TRIALS fixed inputs an arity (unit vectors, metres, millimetres, whole numbers, zeros of both signs, huge and tiny
// mixed, subnormals, the ends of the range, NaN, the infinities). An algorithm that differs from a candidate less than about once in ten thousand ordinary inputs
// could pass it; the ones known (the table in the goal's notes) differ at one in 700 or more. tools/qa/hypot-ident.ts holds every export against Math.hypot over
// tens of millions of inputs (bun and node); the play-through digests hold the rest.
// (No imports: src/math is below everything, and this runs at load.)

const INF = Infinity;

// ---- V8's: |x| scaled by the largest, Kahan-summed squares
function kahan2(a: number, b: number): number {
  const x = Math.abs(a), y = Math.abs(b);
  let max = 0; if (x > max) max = x; if (y > max) max = y;
  if (max === INF) return INF; if (x !== x || y !== y) return NaN; if (max === 0) return 0;
  let n = x / max, s = n * n - 0, p = 0 + s, comp = (p - 0) - s, sum = p;
  n = y / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  return Math.sqrt(sum) * max;
}
function kahan3(a: number, b: number, c: number): number {
  const x = Math.abs(a), y = Math.abs(b), z = Math.abs(c);
  let max = 0; if (x > max) max = x; if (y > max) max = y; if (z > max) max = z;
  if (max === INF) return INF; if (x !== x || y !== y || z !== z) return NaN; if (max === 0) return 0;
  let n = x / max, s = n * n - 0, p = 0 + s, comp = (p - 0) - s, sum = p;
  n = y / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  n = z / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  return Math.sqrt(sum) * max;
}
function kahan4(a: number, b: number, c: number, d: number): number {
  const x = Math.abs(a), y = Math.abs(b), z = Math.abs(c), w = Math.abs(d);
  let max = 0; if (x > max) max = x; if (y > max) max = y; if (z > max) max = z; if (w > max) max = w;
  if (max === INF) return INF; if (x !== x || y !== y || z !== z || w !== w) return NaN; if (max === 0) return 0;
  let n = x / max, s = n * n - 0, p = 0 + s, comp = (p - 0) - s, sum = p;
  n = y / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  n = z / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  n = w / max; s = n * n - comp; p = sum + s; comp = (p - sum) - s; sum = p;
  return Math.sqrt(sum) * max;
}

// ---- JavaScriptCore's: scaled by the largest |x|, squares summed in order
function scaled2(a: number, b: number): number {
  const x = Math.abs(a), y = Math.abs(b);
  if (x === INF || y === INF) return INF; if (x !== x || y !== y) return NaN;
  let max = 0; if (x > max) max = x; if (y > max) max = y; if (max === 0) max = 1;
  const p = a / max, q = b / max;
  return Math.sqrt(0 + p * p + q * q) * max;
}
function scaled3(a: number, b: number, c: number): number {
  const x = Math.abs(a), y = Math.abs(b), z = Math.abs(c);
  if (x === INF || y === INF || z === INF) return INF; if (x !== x || y !== y || z !== z) return NaN;
  let max = 0; if (x > max) max = x; if (y > max) max = y; if (z > max) max = z; if (max === 0) max = 1;
  const p = a / max, q = b / max, r = c / max;
  return Math.sqrt(0 + p * p + q * q + r * r) * max;
}
function scaled4(a: number, b: number, c: number, d: number): number {
  const x = Math.abs(a), y = Math.abs(b), z = Math.abs(c), w = Math.abs(d);
  if (x === INF || y === INF || z === INF || w === INF) return INF; if (x !== x || y !== y || z !== z || w !== w) return NaN;
  let max = 0; if (x > max) max = x; if (y > max) max = y; if (z > max) max = z; if (w > max) max = w; if (max === 0) max = 1;
  const p = a / max, q = b / max, r = c / max, t = d / max;
  return Math.sqrt(0 + p * p + q * q + r * r + t * t) * max;
}

const native2 = (a: number, b: number) => Math.hypot(a, b);
const native3 = (a: number, b: number, c: number) => Math.hypot(a, b, c);
const native4 = (a: number, b: number, c: number, d: number) => Math.hypot(a, b, c, d);

/** the trial's inputs: a fixed stream (never Math.random) over the magnitudes lengths take and the ones they do not — unit vectors, metres, millimetres, zeros
 *  of both signs, one huge or tiny component among ordinary ones, subnormals, the ends of the range, NaN and the infinities */
function sample(n: number): Float64Array {
  let s = 0x9e3779b9 >>> 0; const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const odd = [0, -0, 1, -1, 0.5, 3, 4, 1e-320, -5e-324, 1.7976931348623157e308, 1e200, -1e-200, 2 ** 52 + 1, 2 ** -27, NaN, INF, -INF, 1e154, 1.5e-154];
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const k = r();
    out[i] = k < 0.35 ? (r() - 0.5) * 2 : k < 0.6 ? (r() - 0.5) * 60 : k < 0.72 ? (r() - 0.5) * 2e-3 : k < 0.8 ? (r() - 0.5) * 10 ** Math.floor(r() * 40 - 20)
      : k < 0.86 ? (r() - 0.5) * 2 ** Math.floor(r() * 2000 - 1000) : k < 0.92 ? Math.round((r() - 0.5) * 16) / 4 : odd[Math.floor(r() * odd.length)];
  }
  return out;
}
const same = (a: number, b: number) => a === b ? (a !== 0 || 1 / a === 1 / b) : (a !== a && b !== b);   // (the same number, zeros by sign; NaN is NaN)
const TRIALS = 40000;
function agrees(f: (...a: number[]) => number, arity: number): boolean {
  const v = sample(TRIALS + 3);
  for (let i = 0; i < TRIALS; i++) {
    const a = v[i], b = v[i + 1], c = v[i + 2], d = v[i + 3];
    if (arity === 2 ? !same(f(a, b), Math.hypot(a, b)) : arity === 3 ? !same(f(a, b, c), Math.hypot(a, b, c)) : !same(f(a, b, c, d), Math.hypot(a, b, c, d))) return false;
  }
  return true;
}
/** TPS_NOHYP=1 (bun / node) or ?nohyp (the page): every length through Math.hypot itself — the build as it was, for an A/B of what this file saves */
const held = (() => { try { const g = globalThis as any; return g.process?.env?.TPS_NOHYP === '1' || /[?&]nohyp\b/.test(String(g.location?.search ?? '')); } catch { return false; } })();

const pick2 = held ? 'native' : agrees(kahan2, 2) ? 'kahan' : agrees(scaled2, 2) ? 'scaled' : 'native';
const pick3 = held ? 'native' : agrees(kahan3, 3) ? 'kahan' : agrees(scaled3, 3) ? 'scaled' : 'native';
const pick4 = held ? 'native' : agrees(kahan4, 4) ? 'kahan' : agrees(scaled4, 4) ? 'scaled' : 'native';

/** Math.hypot(a, b) — this runtime's own bits (see the file's head) */
export const hyp2: (a: number, b: number) => number = pick2 === 'kahan' ? kahan2 : pick2 === 'scaled' ? scaled2 : native2;
/** Math.hypot(a, b, c) — this runtime's own bits */
export const hyp3: (a: number, b: number, c: number) => number = pick3 === 'kahan' ? kahan3 : pick3 === 'scaled' ? scaled3 : native3;
/** Math.hypot(a, b, c, d) — this runtime's own bits */
export const hyp4: (a: number, b: number, c: number, d: number) => number = pick4 === 'kahan' ? kahan4 : pick4 === 'scaled' ? scaled4 : native4;
/** which way each arity went on this runtime (QA; `trials` = the inputs each candidate was held to — a sampled match, not a proof) */
export const HYP = { two: pick2, three: pick3, four: pick4, trials: TRIALS, held };
// the page says once which way it went (a browser nobody has measured shows here; headless stays silent: tools parse its output)
try { if (typeof (globalThis as any).document !== 'undefined') console.info(`lengths: hyp2 ${pick2} · hyp3 ${pick3} · hyp4 ${pick4} (each held to Math.hypot on ${TRIALS} inputs at load${held ? '; ?nohyp' : ''})`); } catch { /* no console */ }
