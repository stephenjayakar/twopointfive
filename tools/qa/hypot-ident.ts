// HYPOT IDENTITY — src/math/hyp.ts's hyp2 / hyp3 / hyp4 against the runtime's own Math.hypot, bit for bit, over many inputs of every magnitude lengths take and
// the ones they do not (zeros of both signs, subnormals, the ends of the range, one huge or tiny component among ordinary ones, NaN, the infinities).
//   bun run tools/qa/hypot-ident.ts [--n 20000000] [--seed 1]        (JavaScriptCore: the headless harness)
//   node tools/qa/hypot-ident.ts [--n …]                              (V8: the page's engine)
//   TPS_NOHYP=1 …                                                     every arity through Math.hypot itself (the A/B arm): trivially equal
// exit 0 = every answer the same · 1 = one differs (printed) — a runtime where that happens must not ship hyp.ts's pick for that arity
import { hyp2, hyp3, hyp4, HYP } from '../../src/math/hyp.ts';
const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const N = Number(flag('--n') ?? 20000000); let s = (Number(flag('--seed') ?? 1) * 2654435761) >>> 0;
const r = () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const odd = [0, -0, 1, -1, 0.5, 3, 4, 5e-324, -5e-324, 1e-320, 2.2250738585072014e-308, 1.7976931348623157e308, -1.7976931348623157e308, 1e200, -1e-200, 2 ** 52 + 1, 2 ** 53, 2 ** -27, 2 ** -537, 2 ** 511, 2 ** 512, NaN, Infinity, -Infinity, 1e154, 1.5e-154, 0.1, 1 / 3];
const buf = new Float64Array(1), bits = new BigUint64Array(buf.buffer);
const gen = (): number => { const k = r();
  if (k < 0.3) return (r() - 0.5) * 2;                                   // unit-vector and quaternion components
  if (k < 0.55) return (r() - 0.5) * 80;                                  // metres across a level
  if (k < 0.65) return (r() - 0.5) * 2e-3;                                // sub-millimetre differences
  if (k < 0.72) return Math.round((r() - 0.5) * 64) / 8;                  // lattice values: exact squares, ties
  if (k < 0.8) return (r() - 0.5) * 10 ** Math.floor(r() * 40 - 20);
  if (k < 0.88) return (r() - 0.5) * 2 ** Math.floor(r() * 2100 - 1070);  // the whole exponent range, subnormals included
  if (k < 0.94) { bits[0] = (BigInt(Math.floor(r() * 0x100000)) << 44n) | (BigInt(Math.floor(r() * 0x100000)) << 24n) | BigInt(Math.floor(r() * 0x1000000)); return buf[0]; }   // raw bit patterns (positive: sign bit clear)
  return odd[Math.floor(r() * odd.length)]; };
const same = (a: number, b: number) => Object.is(a, b);
let bad = 0, first = '';
const t0 = performance.now();
for (let i = 0; i < N; i++) {
  const a = gen(), b = gen(), c = gen(), d = gen();
  const h2 = Math.hypot(a, b), h3 = Math.hypot(a, b, c), h4 = Math.hypot(a, b, c, d);
  if (!same(hyp2(a, b), h2)) { bad++; first ||= `hyp2(${a}, ${b}) = ${hyp2(a, b)} ≠ ${h2}`; }
  if (!same(hyp3(a, b, c), h3)) { bad++; first ||= `hyp3(${a}, ${b}, ${c}) = ${hyp3(a, b, c)} ≠ ${h3}`; }
  if (!same(hyp4(a, b, c, d), h4)) { bad++; first ||= `hyp4(${a}, ${b}, ${c}, ${d}) = ${hyp4(a, b, c, d)} ≠ ${h4}`; }
  // the shapes the game asks: a difference of two points, a normalised vector's length
  const e = a - b, f = c - d; if (!same(hyp2(e, f), Math.hypot(e, f)) || !same(hyp3(e, f, a), Math.hypot(e, f, a))) { bad++; first ||= `difference shape at ${a}, ${b}, ${c}, ${d}`; }
}
const rt = typeof (globalThis as any).Bun !== 'undefined' ? `bun ${(globalThis as any).Bun.version}` : `node ${process.version}`;
console.log(`${rt}: hyp2 = ${HYP.two}, hyp3 = ${HYP.three}, hyp4 = ${HYP.four} · ${N} inputs an arity (+ ${2 * N} difference shapes) in ${((performance.now() - t0) / 1000).toFixed(1)} s · ${bad ? `FAIL — ${bad} differ, first: ${first}` : 'PASS — every length is Math.hypot\'s own, bit for bit'}`);
process.exit(bad ? 1 : 0);
