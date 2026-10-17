// THE GAME'S OWN MATHS — sin, cos, tan, asin, acos, atan, atan2, exp, log, log2, log10, pow, tanh and hypot worked out here, from + − × ÷ and √ alone.
//
// WHY: those five operations are exact by the IEEE standard on every machine and in every JavaScript engine; the functions above are not. The language lets an
// engine round them as it likes in the last place, and the engines do: JavaScriptCore (bun, Safari) asks the system's C library, V8 (Chrome, node) carries ports
// of its own, and Chrome's sin is not node's. One unit in the last place of a facing angle at frame 0 is a different fight a minute later — the same seed and the
// same inputs played apart on two engines (measured: tools/qa/exact-check.ts). A server and a client that are to agree, or a page and the headless harness, need
// one arithmetic. With EXACT.on the functions below stand in Math's place (`Math.sin = sin` …: no call site changes, new code is covered by writing Math.sin as
// ever, and the lengths of math/hyp.ts go to one algorithm on every engine); off, Math is the engine's own and nothing here runs — the build as it was.
//
// WHAT IT IS NOT: correctly rounded. These are within a unit or two in the last place of the true value (exact-check.ts measures it against the engine's own),
// the same on every engine, and that is all the game needs of them. NOT replaced, because nothing under src/ calls them: cbrt, expm1, log1p, sinh, cosh, asinh,
// acosh, atanh — exact-check.ts is red on a call to one from the simulation's folders.
//
// THE SWITCH is a property with a setter, so every road that writes a knob table (the page's URL, a stand, the journal's applyKnobs, the debugger panel) puts the
// functions in or takes them out by writing it; a recording carries it, and one from before it replays on the engine's maths.
//
// The algorithms and constants are those of the Go standard library's portable math package (pure Go: sin.go, tan.go, atan.go, asin.go, atan2.go, exp.go, log.go,
// log10.go, pow.go, tanh.go, frexp.go, ldexp.go, trig_reduce.go), rewritten for doubles held in JavaScript numbers. Their notices:
//
//   Copyright 2009 The Go Authors.
//
//   Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
//      * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
//      * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation
//        and/or other materials provided with the distribution.
//      * Neither the name of Google LLC nor the names of its contributors may be used to endorse or promote products derived from this software without
//        specific prior written permission.
//   THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
//   WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY
//   DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF
//   USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
//   NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
//   sin, cos, tan, atan, asin, tanh — from the Cephes Math Library Release 2.8: June, 2000. Copyright 1984, 1987, 1989, 1992, 2000 by Stephen L. Moshier.
//   The readme file at http://netlib.sandia.gov/cephes/ says: Some software in this archive may be from the book _Methods and Programs for Mathematical
//   Functions_ (Prentice-Hall or Simon & Schuster International, 1989) or from the Cephes Mathematical Library, a commercial product. In either event, it is
//   copyrighted by the author. What you see here may be used freely but it comes with no support or guarantee.
//
//   exp, log — from FreeBSD's /usr/src/lib/msun/src/e_exp.c and e_log.c: Copyright (C) 2004 by Sun Microsystems, Inc. All rights reserved. Developed at SunPro, a
//   Sun Microsystems, Inc. business. Permission to use, copy, modify, and distribute this software is freely granted, provided that this notice is preserved.
//
// (Imports math/hyp.ts alone: src/math is below everything.)
import { hypExact, kahanN } from './hyp';

const INF = Infinity, PI = Math.PI, PI2 = Math.PI / 2, PI4 = Math.PI / 4;
const sqrt = Math.sqrt, abs = Math.abs, floor = Math.floor, trunc = Math.trunc;   // (exact by the standard, on every engine)
const F = new Float64Array(1), U = new Uint32Array(F.buffer);   // (a double's two words: U[0] low, U[1] high — every machine a browser runs on is little-endian)

// ---- the pieces of a double
let FE = 0;   // frexp's second answer
/** f = frac × 2^FE with ½ ≤ |frac| < 1 (0, the infinities and NaN come back as they are, FE 0) */
function frexp(f: number): number {
  if (f === 0 || f !== f || f === INF || f === -INF) { FE = 0; return f; }
  let e = 0; if (abs(f) < 2.2250738585072014e-308) { f *= 4503599627370496; e = -52; }
  F[0] = f; const hi = U[1];
  FE = e + ((hi >>> 20) & 0x7ff) - 1022;
  U[1] = (hi & 0x800fffff) | 0x3fe00000;
  return F[0];
}
/** frac × 2^exp */
function ldexp(frac: number, exp: number): number {
  if (frac === 0 || frac !== frac || frac === INF || frac === -INF) return frac;
  if (abs(frac) < 2.2250738585072014e-308) { frac *= 4503599627370496; exp -= 52; }
  F[0] = frac; const hi = U[1];
  exp += ((hi >>> 20) & 0x7ff) - 1023;
  if (exp < -1075) return frac < 0 ? -0 : 0;
  if (exp > 1023) return frac < 0 ? -INF : INF;
  let m = 1; if (exp < -1022) { exp += 53; m = 1 / 9007199254740992; }
  U[1] = (hi & 0x800fffff) | ((exp + 1023) << 20);
  return m * F[0];
}

// ---- sine, cosine, tangent: reduced into eighths of a turn by a π/4 held in three pieces, then one of two polynomials
const SIN0 = 1.58962301576546568060e-10, SIN1 = -2.50507477628578072866e-8, SIN2 = 2.75573136213857245213e-6, SIN3 = -1.98412698295895385996e-4, SIN4 = 8.33333333332211858878e-3, SIN5 = -1.66666666666666307295e-1;
const COS0 = -1.13585365213876817300e-11, COS1 = 2.08757008419747316778e-9, COS2 = -2.75573141792967388112e-7, COS3 = 2.48015872888517045348e-5, COS4 = -1.38888888888730564116e-3, COS5 = 4.16666666666665929218e-2;
const PI4A = 7.85398125648498535156e-1, PI4B = 3.77489470793079817668e-8, PI4C = 2.69515142907905952645e-15;
const FOPI = 1.2732395447351628;   // 4/π, rounded once
const REDUCE = 536870912;   // 2^29: from here up the three-piece π/4 has lost too much, and the reduction is done on the bits (trigReduce)
const sinPoly = (z: number, zz: number): number => z + z * zz * ((((((SIN0 * zz) + SIN1) * zz + SIN2) * zz + SIN3) * zz + SIN4) * zz + SIN5);
const cosPoly = (zz: number): number => 1.0 - 0.5 * zz + zz * zz * ((((((COS0 * zz) + COS1) * zz + COS2) * zz + COS3) * zz + COS4) * zz + COS5);

// 4/π to 1280 bits, sixty-four at a time (the first word is the whole part)
const MPI4: bigint[] = [0x0000000000000001n, 0x45f306dc9c882a53n, 0xf84eafa3ea69bb81n, 0xb6c52b3278872083n, 0xfca2c757bd778ac3n, 0x6e48dc74849ba5c0n, 0x0c925dd413a32439n,
  0xfc3bd63962534e7dn, 0xd1046bea5d768909n, 0xd338e04d68befc82n, 0x7323ac7306a673e9n, 0x3908bf177bf25076n, 0x3ff12fffbc0b301fn, 0xde5e2316b414da3en, 0xda6cfd9e4f96136en,
  0x9e8c7ecd3cbfd45an, 0xea4f758fd7cbe2f6n, 0x7a0e73ef14a525d4n, 0xd7f6bf623f1aba10n, 0xac06608df8f6d757n];
const M64 = 0xffffffffffffffffn;
let TJ = 0;   // trigReduce's second answer: the eighth of the turn
/** x ≥ 2^29 reduced by multiples of π/4 (Payne and Hanek: the bits of x against the bits of 4/π). Never on a path the game takes — an angle that large is a bug
 *  somewhere else — but the answer has to be the same everywhere for those too. */
function trigReduce(x: number): number {
  F[0] = x; const hw = U[1], lw = U[0];
  const exp = ((hw >>> 20) & 0x7ff) - 1023 - 52;
  const ix = (BigInt((hw & 0xfffff) | 0x100000) << 32n) | BigInt(lw);
  const digit = floor((exp + 61) / 64), bs = BigInt((exp + 61) % 64), inv = 64n - bs;
  const z0 = ((MPI4[digit] << bs) | (MPI4[digit + 1] >> inv)) & M64;
  const z1 = ((MPI4[digit + 1] << bs) | (MPI4[digit + 2] >> inv)) & M64;
  const z2 = ((MPI4[digit + 2] << bs) | (MPI4[digit + 3] >> inv)) & M64;
  const z2hi = (z2 * ix) >> 64n;
  const z1p = z1 * ix, z1hi = z1p >> 64n, z1lo = z1p & M64;
  const z0lo = (z0 * ix) & M64;
  const s = z1lo + z2hi, lo = s & M64, c = s >> 64n;
  let hi = (z0lo + z1hi + c) & M64;
  let j = Number(hi >> 61n);
  hi = ((hi << 3n) & M64) | (lo >> 61n);
  const lz = BigInt(64 - (hi === 0n ? 0 : hi.toString(2).length));
  const e = 1023n - (lz + 1n);
  hi = ((hi << (lz + 1n)) & M64) | (lo >> (64n - (lz + 1n)));
  hi >>= 12n;
  hi |= e << 52n;
  U[1] = Number(hi >> 32n); U[0] = Number(hi & 0xffffffffn);
  let z = F[0];
  if (j & 1) { j = (j + 1) & 7; z--; }
  TJ = j;
  return z * PI4;
}

export function sin(x: number): number {
  if (x === 0 || x !== x) return x;
  if (x === INF || x === -INF) return NaN;
  let sign = false; if (x < 0) { x = -x; sign = true; }
  let j: number, z: number;
  if (x >= REDUCE) { z = trigReduce(x); j = TJ; }
  else { j = floor(x * FOPI); let y = j; if (j & 1) { j++; y++; } j &= 7; z = ((x - y * PI4A) - y * PI4B) - y * PI4C; }
  if (j > 3) { sign = !sign; j -= 4; }
  const zz = z * z;
  const y = j === 1 || j === 2 ? cosPoly(zz) : sinPoly(z, zz);
  return sign ? -y : y;
}
export function cos(x: number): number {
  if (x !== x || x === INF || x === -INF) return NaN;
  let sign = false; x = abs(x);
  let j: number, z: number;
  if (x >= REDUCE) { z = trigReduce(x); j = TJ; }
  else { j = floor(x * FOPI); let y = j; if (j & 1) { j++; y++; } j &= 7; z = ((x - y * PI4A) - y * PI4B) - y * PI4C; }
  if (j > 3) { j -= 4; sign = !sign; }
  if (j > 1) sign = !sign;
  const zz = z * z;
  const y = j === 1 || j === 2 ? sinPoly(z, zz) : cosPoly(zz);
  return sign ? -y : y;
}
const TANP0 = -1.30936939181383777646e4, TANP1 = 1.15351664838587416140e6, TANP2 = -1.79565251976484877988e7;
const TANQ1 = 1.36812963470692954678e4, TANQ2 = -1.32089234440210967447e6, TANQ3 = 2.50083801823357915839e7, TANQ4 = -5.38695755929454629881e7;
export function tan(x: number): number {
  if (x === 0 || x !== x) return x;
  if (x === INF || x === -INF) return NaN;
  let sign = false; if (x < 0) { x = -x; sign = true; }
  let j: number, z: number;
  if (x >= REDUCE) { z = trigReduce(x); j = TJ; }
  else { j = floor(x * FOPI); let y = j; if (j & 1) { j++; y++; } z = ((x - y * PI4A) - y * PI4B) - y * PI4C; }
  const zz = z * z;
  let y = zz > 1e-17 ? z + z * (zz * (((TANP0 * zz) + TANP1) * zz + TANP2) / ((((zz + TANQ1) * zz + TANQ2) * zz + TANQ3) * zz + TANQ4)) : z;
  if ((j & 2) === 2) y = -1 / y;
  return sign ? -y : y;
}

// ---- the arc functions, all of them through one arctangent
const ATP0 = -8.750608600031904122785e-01, ATP1 = -1.615753718733365076637e+01, ATP2 = -7.500855792314704667340e+01, ATP3 = -1.228866684490136173410e+02, ATP4 = -6.485021904942025371773e+01;
const ATQ0 = +2.485846490142306297962e+01, ATQ1 = +1.650270098316988542046e+02, ATQ2 = +4.328810604912902668951e+02, ATQ3 = +4.853903996359136964868e+02, ATQ4 = +1.945506571482613964425e+02;
const MOREBITS = 6.123233995736765886130e-17, TAN3PIO8 = 2.41421356237309504880;
/** arctangent on [0, 0.66] */
function xatan(x: number): number {
  let z = x * x;
  z = z * ((((ATP0 * z + ATP1) * z + ATP2) * z + ATP3) * z + ATP4) / (((((z + ATQ0) * z + ATQ1) * z + ATQ2) * z + ATQ3) * z + ATQ4);
  return x * z + x;
}
/** arctangent of x ≥ 0 */
function satan(x: number): number {
  if (x <= 0.66) return xatan(x);
  if (x > TAN3PIO8) return PI2 - xatan(1 / x) + MOREBITS;
  return PI4 + xatan((x - 1) / (x + 1)) + 0.5 * MOREBITS;
}
export function atan(x: number): number {
  if (x === 0) return x;
  return x > 0 ? satan(x) : -satan(-x);
}
/** arcsine on [0, ½]: no digits are lost in 1 − x² there */
const asinLow = (x: number): number => satan(x / sqrt(1 - x * x));
// (past ½ both go through the half angle, asin x = π/2 − 2 asin √((1 − x)/2): 1 − x is exact there, where 1 − x² would have thrown digits away near 1 — an
// angle between two nearly parallel directions is what the game asks most)
export function asin(x: number): number {
  if (x === 0) return x;
  let sign = false; if (x < 0) { x = -x; sign = true; }
  if (x > 1) return NaN;
  const t = x > 0.5 ? PI2 - 2 * asinLow(sqrt((1 - x) / 2)) : asinLow(x);
  return sign ? -t : t;
}
export function acos(x: number): number {
  if (x > 0.5) return x > 1 ? NaN : 2 * asinLow(sqrt((1 - x) / 2));
  if (x < -0.5) return x < -1 ? NaN : PI - 2 * asinLow(sqrt((1 + x) / 2));
  return PI2 - asin(x);
}
const PI34 = 2.356194490192345;   // 3π/4, rounded once
const signed = (m: number, s: number): number => (s < 0 || (s === 0 && 1 / s < 0)) ? -m : m;   // m ≥ 0 with s's sign (a negative zero's too)
export function atan2(y: number, x: number): number {
  if (y !== y || x !== x) return NaN;
  if (y === 0) return x > 0 || (x === 0 && 1 / x > 0) ? signed(0, y) : signed(PI, y);   // (x ≥ 0 and not −0)
  if (x === 0) return signed(PI2, y);
  if (x === INF) return y === INF || y === -INF ? signed(PI4, y) : signed(0, y);
  if (x === -INF) return y === INF || y === -INF ? signed(PI34, y) : signed(PI, y);
  if (y === INF || y === -INF) return signed(PI2, y);
  const q = atan(y / x);
  if (x < 0) return y < 0 ? q - PI : q + PI;   // (by y's sign, not the quotient's: a quotient that underflows to zero has lost it)
  return q;
}

// ---- e^x and the logarithms
const LN2HI = 6.93147180369123816490e-01, LN2LO = 1.90821492927058770002e-10, LOG2E = 1.44269504088896338700e+00;
const EXP_OVER = 7.09782712893383973096e+02, EXP_UNDER = -7.45133219101941108420e+02, NEAR_ZERO = 1 / 268435456;
const EP1 = 1.66666666666666657415e-01, EP2 = -2.77777777770155933842e-03, EP3 = 6.61375632143793436117e-05, EP4 = -1.65339022054652515390e-06, EP5 = 4.13813679705723846039e-08;
export function exp(x: number): number {
  if (x !== x || x === INF) return x;
  if (x === -INF) return 0;
  if (x > EXP_OVER) return INF;
  if (x < EXP_UNDER) return 0;
  if (-NEAR_ZERO < x && x < NEAR_ZERO) return 1 + x;
  const k = x < 0 ? trunc(LOG2E * x - 0.5) : x > 0 ? trunc(LOG2E * x + 0.5) : 0;
  const hi = x - k * LN2HI, lo = k * LN2LO;
  const r = hi - lo, t = r * r;
  const c = r - t * (EP1 + t * (EP2 + t * (EP3 + t * (EP4 + t * EP5))));
  return ldexp(1 - ((lo - (r * c) / (2 - c)) - hi), k);
}
const L1 = 6.666666666666735130e-01, L2 = 3.999999999940941908e-01, L3 = 2.857142874366239149e-01, L4 = 2.222219843214978396e-01, L5 = 1.818357216161805012e-01, L6 = 1.531383769920937332e-01, L7 = 1.479819860511658591e-01;
export function log(x: number): number {
  if (x !== x || x === INF) return x;
  if (x < 0) return NaN;
  if (x === 0) return -INF;
  let f1 = frexp(x), ki = FE;
  if (f1 < Math.SQRT1_2) { f1 *= 2; ki--; }
  const f = f1 - 1, k = ki;
  const s = f / (2 + f), s2 = s * s, s4 = s2 * s2;
  const t1 = s2 * (L1 + s4 * (L3 + s4 * (L5 + s4 * L7)));
  const t2 = s4 * (L2 + s4 * (L4 + s4 * L6));
  const R = t1 + t2, hfsq = 0.5 * f * f;
  return k * LN2HI - ((hfsq - (s * (hfsq + R) + k * LN2LO)) - f);
}
const INV_LN10 = 0.4342944819032518, INV_LN2 = 1.4426950408889634;   // 1/ln 10, 1/ln 2, each rounded once
export function log10(x: number): number { return log(x) * INV_LN10; }
export function log2(x: number): number {
  let frac = frexp(x), e = FE;
  if (frac === 0.5) return e - 1;   // (a power of two: its exponent, exactly)
  if (frac < Math.SQRT1_2) { frac *= 2; e--; }   // (the fraction about 1, as log takes it: near x = 1 the two terms would otherwise all but cancel)
  return log(frac) * INV_LN2 + e;
}

// ---- x^y: the whole part of y by squaring on the fraction of x, the rest through e^(y ln x)
export function pow(x: number, y: number): number {
  // (what the language asks of the corners, where it and the algorithm's own table part)
  if (y !== y) return NaN;
  if (y === 0) return 1;
  if (x !== x) return NaN;
  if ((x === 1 || x === -1) && (y === INF || y === -INF)) return NaN;
  if (x === 1) return 1;
  if (y === 1) return x;
  const ay = abs(y);
  const oddInt = ay < 9007199254740992 && floor(ay) === ay && ay % 2 === 1;
  if (x === 0) {
    const neg = 1 / x < 0;
    if (y < 0) return neg && oddInt ? -INF : INF;
    return neg && oddInt ? x : 0;
  }
  if (y === INF || y === -INF) return (abs(x) < 1) === (y === INF) ? 0 : INF;
  if (x === INF) return y < 0 ? 0 : INF;
  if (x === -INF) return y < 0 ? (oddInt ? -0 : 0) : (oddInt ? -INF : INF);
  if (y === 0.5) return sqrt(x);
  if (y === -0.5) return 1 / sqrt(x);
  let yi = floor(ay), yf = ay - yi;
  if (yf !== 0 && x < 0) return NaN;
  if (yi >= 9223372036854775808) return x === -1 ? 1 : (abs(x) < 1) === (y > 0) ? 0 : INF;
  let a1 = 1.0, ae = 0;
  if (yf !== 0) { if (yf > 0.5) { yf--; yi++; } a1 = exp(yf * log(x)); }
  let x1 = frexp(x), xe = FE;
  for (let i = yi; i !== 0; i = floor(i / 2)) {
    if (xe < -4096 || 4096 < xe) { ae += xe; break; }   // (over or under: the answer is already an infinity or a zero)
    if (i % 2 === 1) { a1 *= x1; ae += xe; }
    x1 *= x1; xe *= 2;
    if (x1 < 0.5) { x1 += x1; xe--; }
  }
  if (y < 0) { a1 = 1 / a1; ae = -ae; }
  return ldexp(a1, ae);
}

const TANHP0 = -9.64399179425052238628e-1, TANHP1 = -9.92877231001918586564e1, TANHP2 = -1.61468768441708447952e3;
const TANHQ0 = 1.12811678491632931402e2, TANHQ1 = 2.23548839060100448583e3, TANHQ2 = 4.84406305325125486048e3;
const HALF_MAXLOG = 0.5 * 8.8029691931113054295988e+01;
export function tanh(x: number): number {
  let z = abs(x);
  if (z > HALF_MAXLOG) return x < 0 ? -1 : 1;
  if (z >= 0.625) { const s = exp(2 * z); z = 1 - 2 / (s + 1); return x < 0 ? -z : z; }
  if (x === 0) return x;
  const s = x * x;
  return x + x * s * ((TANHP0 * s + TANHP1) * s + TANHP2) / (((s + TANHQ0) * s + TANHQ1) * s + TANHQ2);
}

/** Math.hypot's answer by one algorithm everywhere (math/hyp.ts kahanN: the largest scaled out, the squares in a compensated sum — the page's own in Chrome) */
export function hypot(): number { return kahanN(arguments as unknown as ArrayLike<number>); }

// ---- THE SWITCH
/** the engine's own, as they were when this module loaded (presentation that wants the engine's speed and does not feed the game may call these) */
export const SYS = { sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan, atan2: Math.atan2, exp: Math.exp, log: Math.log, log2: Math.log2, log10: Math.log10, pow: Math.pow, tanh: Math.tanh, hypot: Math.hypot };
const OWN: typeof SYS = { sin, cos, tan, asin, acos, atan, atan2, exp, log, log2, log10, pow, tanh, hypot };
/** the functions of Math that an engine may round as it likes and that are NOT replaced: nothing in the simulation may call one (exact-check.ts) */
export const EXACT_UNCOVERED: readonly string[] = ['cbrt', 'expm1', 'log1p', 'sinh', 'cosh', 'asinh', 'acosh', 'atanh'];
let installed = false;
/** how many times the switch has changed: a value KEPT from one of the functions (a prop's cached frame, a sorted table) is remade when this has moved */
export let mathsEpoch = 0;
const remade: (() => void)[] = [];
/** A CONSTANT A MODULE WORKS OUT AS IT LOADS from one of the functions above (`const C = Math.cos(…)` at the top of a file) is made before any switch is
 *  written, on the engine's maths. Make it here instead: `fn` runs now, and again each time the switch changes, so the constant is the engine's with the switch
 *  off and the game's own with it on. exact-check.ts is red on a load-time call that is not inside one of these. */
export function onExact(fn: () => void): void { remade.push(fn); fn(); }
function install(on: boolean): void {
  installed = on; mathsEpoch++;
  const from = on ? OWN : SYS, M = Math as unknown as Record<string, unknown>;
  for (const k of Object.keys(SYS) as (keyof typeof SYS)[]) M[k] = from[k];
  hypExact(on);
  for (const fn of remade) fn();
}
/** `on` = the simulation (and everything else on the page) computes on the functions above; off (the module's default) = on the engine's own, as it always did.
 *  ON in the page (?noexact takes it out), OFF on the frozen stand (TPS_EXACT=1 raises it there). Writing it does the work. */
export const EXACT = {
  get on(): boolean { return installed; },
  set on(v: boolean) { if (!!v !== installed) install(!!v); },
};
