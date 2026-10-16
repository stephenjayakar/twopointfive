// THE ACOUSTIC VOICES of the score's newer pieces (pieces.ts), as plain arithmetic on arrays: physical models of things that are struck, plucked or shaken, each rendered
// ONCE into a buffer the page's backend then plays like a recording (musicBackend.ts). Nothing here is recorded or sampled from anywhere: a string is a delay line with a
// loss in its loop (Karplus and Strong's), a drum head / a bar / a gong is a handful of decaying partials at the ratios such a thing rings at with the noise of what hit it,
// a cymbal is a dense cluster of partials no chord could hold. The maintainer, 10-14: "more diverse instrumentation and making them sound more acoustic rather than synth
// (specifically the accents and percussion ...)".
// Pure and deterministic: no audio device, no clock, and its only die is seeded per voice (a buffer is the same every time it is made), so tools/qa/music-check.ts can hold
// what every voice IS — in tune, struck not swelled, dead by its end — without a browser. What they sound like together is a listener's ears.
import { mulberry32 } from '../math/dice';

type F = Float32Array;
const TAU = Math.PI * 2;

/** one biquad over `a`, in place (the cookbook's): lowpass, highpass, bandpass (unity at its peak) or a peak of `db` */
function bq(a: F, sr: number, type: 'lp' | 'hp' | 'bp' | 'pk', f: number, q: number, db = 0): F {
  const w = TAU * Math.min(f, sr * 0.45) / sr, cs = Math.cos(w), al = Math.sin(w) / (2 * q), A = Math.pow(10, db / 40);
  let b0: number, b1: number, b2: number, a0 = 1 + al, a1 = -2 * cs, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
  else { b0 = 1 + al * A; b1 = -2 * cs; b2 = 1 - al * A; a0 = 1 + al / A; a2 = 1 - al / A; }
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i], y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0; x2 = x1; x1 = x; y2 = y1; y1 = y; a[i] = y; }
  return a;
}
/** scaled to a peak of `peak`, its last few milliseconds faded to nothing (a buffer never ends on a step) */
function finish(a: F, sr: number, peak = 0.9): F {
  let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i]));
  const k = m > 1e-9 ? peak / m : 0, fade = Math.min(a.length, Math.floor(sr * 0.008));
  for (let i = 0; i < a.length; i++) a[i] *= k;
  for (let i = 0; i < fade; i++) a[a.length - 1 - i] *= i / fade;
  return a;
}
const mix = (into: F, a: F, g: number, at = 0) => { for (let i = 0; i < a.length && i + at < into.length; i++) into[i + at] += a[i] * g; return into; };
/** `secs` of noise that dies away to a thousandth in `t60` seconds after `atk` seconds of coming in */
function burst(sr: number, secs: number, t60: number, rnd: () => number, atk = 0): F {
  const n = Math.floor(sr * secs), a = new Float32Array(n), k = 6.91 / (t60 * sr), an = atk * sr;
  for (let i = 0; i < n; i++) a[i] = (rnd() * 2 - 1) * Math.exp(-k * i) * (i < an ? i / an : 1);
  return a;
}

/** a partial of something struck: its pitch (Hz), its weight, the seconds it takes to die to a thousandth, and (a gong's) the seconds it takes to bloom */
export type Partial = readonly [f: number, amp: number, t60: number, bloom?: number];
/** partials ringing down. `glide`: every pitch starts (1 + glide) times itself and settles in about `glideT` seconds — a struck skin's fall, or (negative) a hand
 *  pressed into one */
export function modal(sr: number, secs: number, parts: readonly Partial[], glide = 0, glideT = 0.02): F {
  const n = Math.floor(sr * secs), out = new Float32Array(n);
  for (const [f, amp, t60, bloom] of parts) {
    if (f * (1 + Math.max(0, glide)) > sr * 0.45) continue;
    if (!glide) {   // a decaying resonator, two multiplies a sample — and a bloom is that less a twin of it that dies in the bloom's own time
      for (const [sign, rate] of bloom ? [[1, 6.91 / t60], [-1, 6.91 / t60 + 1 / bloom]] : [[1, 6.91 / t60]]) {
        const r = Math.exp(-rate / sr), w = TAU * f / sr, c = 2 * r * Math.cos(w); let y1 = 0, y2 = -sign * amp * Math.sin(w) / r;   // (so that y[-1] = 0 and y[0] = amp·r·sin w)
        for (let i = 0; i < n; i++) { const y = c * y1 - r * r * y2; y2 = y1; y1 = y; out[i] += y; }
      }
      continue;
    }
    const k = 6.91 / (t60 * sr), gk = 1 / (glideT * sr); let ph = 0;
    for (let i = 0; i < n; i++) { ph += TAU * f * (1 + glide * Math.exp(-i * gk)) / sr; out[i] += Math.sin(ph) * amp * Math.exp(-k * i); }
  }
  return out;
}

export interface StringSpec {
  /** how hard the thing that plucked it was: 1 = a nail or a hammer (every harmonic), 0.1 = the flesh of a finger */
  bright: number;
  /** where along the string it was plucked (0.5 = the middle: hollow; 0.1 = by the bridge: nasal) */
  pos: number;
  /** seconds for the note to die to a thousandth */
  t60: number;
  /** the loop's loss of its highs each time round: 0.5 = a dull string, 0.05 = a bright wire */
  loss: number;
  /** the pitch starts this fraction off and settles in a few hundredths of a second (a koto string let go: sharp; a finger sliding up a bass: flat) */
  bend?: number;
  /** strings to a course, each this many cents from the last (a piano's three, a dulcimer's two); or players to a section */
  course?: readonly number[];
  /** seconds each further string of the course starts after the last (a section's players are never together) */
  stagger?: number;
  /** the string starts as the triangle a finger pulled it into (a little grit on it), not as noise: every note has its fundamental on top and its harmonics falling away
   *  as a plucked string's do — what a bass needs, where a noise burst gives each note a spectrum of its own */
  pulled?: boolean;
  /** the knock of the body under the note: its weight, and the pitch it is felt at */
  thump?: readonly [amp: number, hz: number];
  /** the body the string sits on: resonances as [Hz, Q, dB] */
  body?: readonly (readonly [number, number, number])[];
  /** nothing above this is let out (Hz) */
  top?: number;
  seed?: number;
}
/** a plucked or hammered string */
export function plucked(sr: number, f: number, secs: number, o: StringSpec): F {
  const n = Math.floor(sr * secs), raw = new Float32Array(n + Math.floor(sr * 0.05)), rnd = mulberry32(o.seed ?? 7);
  const one = (freq: number, gain: number, at: number) => {
    // the loop is N whole samples, the loss's own `d` of one, and an allpass for what is left over: the note is in tune at any pitch
    const total = sr / freq, d = o.loss, N = Math.max(2, Math.floor(total - d - 0.1)), frac = total - d - N, c = (1 - frac) / (1 + frac), g = Math.pow(10, -3 / (o.t60 * freq));
    const buf = new Float32Array(N); let lp = 0, mean = 0;
    const M = Math.max(1, Math.round(o.pos * N));
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { const x = pass ? buf[i] : o.pulled ? (i < M ? i / M : (N - i) / (N - M)) + 0.08 * (rnd() * 2 - 1) : rnd() * 2 - 1; lp += (x - lp) * o.bright; buf[i] = lp; }
    if (!o.pulled) { const src = buf.slice(); for (let i = 0; i < N; i++) buf[i] = src[i] - src[(i - M + N) % N]; }   // (noise through a comb: the notch a pluck at `pos` leaves; the pulled shape carries it already)
    for (let i = 0; i < N; i++) mean += buf[i]; mean /= N; for (let i = 0; i < N; i++) buf[i] -= mean;
    let idx = 0, prev = 0, ax = 0, ay = 0;
    for (let i = at; i < raw.length; i++) { const y = buf[idx]; raw[i] += y * gain; const v = g * ((1 - d) * y + d * prev); prev = y; const ap = c * v + ax - c * ay; ax = v; ay = ap; buf[idx] = ap; if (++idx === N) idx = 0; }
  };
  const course = o.course ?? [0];
  course.forEach((cents, k) => one(f * Math.pow(2, cents / 1200), 1 / course.length, Math.floor((o.stagger ?? 0) * k * sr)));
  let out = raw.subarray(0, n) as F;
  if (o.bend) {   // read it back at a speed that starts off and settles
    const bent = new Float32Array(n), k = 1 / (0.035 * sr); let p = 0;
    for (let i = 0; i < n; i++) { const j = Math.floor(p), u = p - j; bent[i] = j + 1 < raw.length ? raw[j] * (1 - u) + raw[j + 1] * u : 0; p += 1 + o.bend * Math.exp(-i * k); }
    out = bent;
  } else out = out.slice();
  if (o.thump) mix(out, bq(burst(sr, 0.08, 0.05, rnd), sr, 'lp', o.thump[1], 0.8), o.thump[0] * 3);
  for (const [bf, q, db] of o.body ?? []) bq(out, sr, 'pk', bf, q, db);
  if (o.top) bq(out, sr, 'lp', o.top, 0.7);
  return finish(out, sr);
}

/** `secs` of a cymbal's body: `count` partials scattered between lo and hi on no scale at all, each a whole number of turns long (the buffer loops with no seam) */
function metal(sr: number, secs: number, lo: number, hi: number, count: number, rnd: () => number): F {
  const n = Math.floor(sr * secs), out = new Float32Array(n);
  for (let k = 0; k < count; k++) {
    const f = Math.round(lo * Math.pow(hi / lo, (k + rnd()) / count) * secs) / secs; if (f > sr * 0.45) continue;
    const w = TAU * f / sr, c = 2 * Math.cos(w), ph = rnd() * TAU, a = 1 / Math.sqrt(f / lo); let y1 = a * Math.sin(ph - w), y2 = a * Math.sin(ph - 2 * w);
    for (let i = 0; i < n; i++) { const y = c * y1 - y2; y2 = y1; y1 = y; out[i] += y; }
  }
  return out;
}
/** `a` under an envelope: in over `atk` seconds, dying to a thousandth `t60` seconds later */
function shaped(a: F, sr: number, t60: number, atk = 0.0005): F { const k = 6.91 / (t60 * sr), an = atk * sr; for (let i = 0; i < a.length; i++) a[i] *= Math.exp(-k * Math.max(0, i - an)) * (i < an ? i / an : 1); return a; }

/** the drums, cymbals and things shaken that a piece can ask for by name (musicBackend.ts PercKind is this list) */
export const STRUCK = ['kick', 'snare', 'rim', 'tomLo', 'tomHi', 'hat', 'hatOpen', 'ride', 'rideBell', 'crash', 'roll', 'brush', 'brushTap', 'taiko', 'congaLo', 'congaHi', 'tabla',
  'frame', 'wood', 'shaker', 'tamb', 'gong'] as const;
export type Struck = typeof STRUCK[number];
/** one hit of `kind`, whole: `take` picks between a few hands' worth of the same hit (no two strokes of a drum are one stroke) */
export function struck(sr: number, kind: Struck, take = 0): F {
  const rnd = mulberry32(0x51ed + STRUCK.indexOf(kind) * 977 + take * 131), j = 1 + (rnd() - 0.5) * 0.03;   // (each take a hair off the last in pitch)
  const hit = (secs: number, hz: number, q: number, t60: number, type: 'lp' | 'hp' | 'bp' = 'bp') => bq(burst(sr, secs, t60, rnd), sr, type, hz, q);
  switch (kind) {
    case 'kick': {   // a felt beater on a big soft head: the fall of the pitch, the shell, the beater's own knock
      const a = modal(sr, 0.6, [[56 * j, 1, 0.42], [91 * j, 0.3, 0.16], [168 * j, 0.12, 0.08]], 0.9, 0.016);
      return finish(bq(mix(mix(a, hit(0.03, 1700, 0.8, 0.012), 0.5), hit(0.06, 240, 1.2, 0.04), 0.5), sr, 'lp', 6000, 0.7), sr);
    }
    case 'snare': {   // the head's two notes, the wires under it answering, the stick
      const head = modal(sr, 0.4, [[186 * j, 1, 0.15], [279 * j, 0.5, 0.1], [412 * j, 0.22, 0.07]], 0.1, 0.02), wires = bq(bq(burst(sr, 0.4, 0.21, rnd, 0.0015), sr, 'hp', 1300, 0.7), sr, 'pk', 4600, 0.8, 5);
      return finish(mix(mix(head, wires, 0.85), hit(0.01, 2600, 1, 0.004), 0.6), sr);
    }
    case 'rim': return finish(mix(modal(sr, 0.12, [[432 * j, 0.6, 0.07], [1040 * j, 1, 0.05], [1730 * j, 0.7, 0.04], [2610 * j, 0.3, 0.03]]), hit(0.006, 3000, 1, 0.002, 'hp'), 0.5), sr);
    case 'tomLo': case 'tomHi': { const f = (kind === 'tomLo' ? 92 : 138) * j; return finish(mix(modal(sr, 0.9, [[f, 1, 0.7], [f * 1.59, 0.4, 0.35], [f * 2.14, 0.2, 0.22], [f * 2.65, 0.1, 0.15]], 0.12, 0.03), hit(0.02, 1500, 0.9, 0.006), 0.45), sr); }
    case 'taiko': {   // a barrel a metre across: the long low note, the hide's own slap, the shell knocking back
      const a = modal(sr, 1.6, [[58.3 * j, 1, 1.4], [95 * j, 0.5, 0.7], [131 * j, 0.3, 0.4], [156 * j, 0.2, 0.3], [418 * j, 0.12, 0.05]], 0.22, 0.04);
      return finish(mix(a, hit(0.05, 850, 0.7, 0.022), 0.8), sr);
    }
    case 'congaLo': return finish(mix(modal(sr, 0.45, [[194 * j, 1, 0.33], [296 * j, 0.3, 0.12], [402 * j, 0.15, 0.08]], 0.06, 0.015), hit(0.02, 1500, 1, 0.008), 0.3), sr);
    case 'congaHi': return finish(mix(modal(sr, 0.3, [[288 * j, 1, 0.22], [438 * j, 0.35, 0.09], [612 * j, 0.15, 0.06]], 0.06, 0.012), hit(0.02, 2700, 1, 0.009), 0.5), sr);
    case 'tabla': return finish(mix(modal(sr, 0.6, [[138 * j, 1, 0.5], [212 * j, 0.25, 0.2]], -0.42, 0.09), hit(0.01, 1300, 1, 0.004), 0.2), sr);   // (the bass drum: bent UP under the heel of the hand)
    case 'frame': return finish(mix(modal(sr, 0.8, [[88 * j, 1, 0.6], [140 * j, 0.5, 0.3], [188 * j, 0.35, 0.22], [203 * j, 0.3, 0.2], [233 * j, 0.2, 0.15]], 0.05, 0.02), hit(0.012, 3200, 0.8, 0.004), 0.3), sr);
    case 'wood': return finish(modal(sr, 0.15, [[1050 * j, 1, 0.07], [2180 * j, 0.45, 0.045], [3400 * j, 0.2, 0.03]]), sr);
    case 'shaker': { const n = Math.floor(sr * 0.09), a = new Float32Array(n);   // seeds thrown forward and falling back: two soft clouds of grains
      for (let g = 0; g < 70; g++) { const u = rnd(), at = Math.floor((u < 0.65 ? 0.004 + rnd() * 0.02 : 0.035 + rnd() * 0.03) * sr), w = 0.4 + rnd() * 0.6; for (let i = 0; i < sr * 0.0012 && at + i < n; i++) a[at + i] += (rnd() * 2 - 1) * w; }
      return finish(bq(bq(a, sr, 'hp', 3500, 0.7), sr, 'pk', 6800, 1.2, 6), sr); }
    case 'tamb': { const n = Math.floor(sr * 0.3), a = new Float32Array(n);   // the jingles: pairs of small discs, each grain setting them ringing again
      for (let g = 0; g < 26; g++) { const at = Math.floor(rnd() * rnd() * 0.07 * sr), w = 0.5 + rnd() * 0.5; for (let i = 0; i < sr * 0.0008 && at + i < n; i++) a[at + i] += (rnd() * 2 - 1) * w; }
      const out = new Float32Array(n); for (const f of [5230, 6840, 7910, 9420, 10650]) mix(out, bq(a.slice(), sr, 'bp', f * j, 14), 1); mix(out, bq(a, sr, 'hp', 6000, 0.7), 0.25);
      return finish(shaped(out, sr, 0.22), sr); }
    case 'brush': case 'brushTap': {   // wire on a coated head: hiss with the grain of the wires in it — swept, or let fall
      const tap = kind === 'brushTap', n = Math.floor(sr * (tap ? 0.12 : 0.34)), a = new Float32Array(n); let gr = 1;
      for (let i = 0; i < n; i++) { if (i % 24 === 0) gr += (0.45 + rnd() * 0.9 - gr) * 0.5; a[i] = (rnd() * 2 - 1) * gr; }
      bq(bq(a, sr, 'hp', 700, 0.7), sr, 'pk', 3200, 0.9, 7);
      return finish(mix(shaped(a, sr, tap ? 0.07 : 0.2, tap ? 0.002 : 0.06), modal(sr, 0.1, [[190 * j, 1, 0.08]]), tap ? 0.25 : 0.08), sr); }
    case 'hat': case 'hatOpen': { const open = kind === 'hatOpen', secs = open ? 0.6 : 0.16, a = metal(sr, secs, 3300, 15000, 44, rnd);
      mix(a, bq(burst(sr, secs, 9, rnd), sr, 'hp', 7000, 0.7), 5);
      return finish(mix(shaped(bq(a, sr, 'hp', 5200, 0.7), sr, open ? 0.42 : 0.09), hit(0.004, 4200, 1, 0.0015), 3), sr); }
    case 'ride': case 'rideBell': { const bell = kind === 'rideBell', wash = shaped(metal(sr, 1.6, 2400, 12000, 46, rnd), sr, 1.3, 0.004);
      const ping: Partial[] = bell ? [[642 * j, 0.6, 0.7], [1468 * j, 0.8, 1.1], [2390 * j, 0.6, 0.8], [3553 * j, 0.4, 0.5], [4870 * j, 0.3, 0.4], [6210 * j, 0.2, 0.3]] : [[517 * j, 0.2, 0.9], [1131 * j, 0.3, 0.8], [2893 * j, 0.5, 0.5], [4270 * j, 0.6, 0.35], [5630 * j, 0.4, 0.3]];
      return finish(mix(mix(modal(sr, 1.6, ping), wash, bell ? 0.05 : 0.06), hit(0.004, 5000, 1, 0.0015), 0.5), sr); }
    case 'crash': { const a = shaped(metal(sr, 2.6, 520, 13000, 64, rnd), sr, 2.2, 0.012); mix(a, shaped(bq(burst(sr, 2.6, 9, rnd), sr, 'hp', 4200, 0.7), sr, 1.1, 0.008), 6); return finish(a, sr); }
    case 'roll': {   // soft mallets on a hung cymbal: three seconds rising under many small strokes, then left to ring
      const a = metal(sr, 4.4, 380, 12000, 44, rnd), up = 3 * sr, k = 6.91 / (1.6 * sr);
      for (let i = 0; i < a.length; i++) a[i] *= i < up ? Math.pow(i / up, 2.3) * (0.86 + 0.14 * Math.sin(TAU * 11.5 * i / sr)) : Math.exp(-k * (i - up));
      return finish(bq(a, sr, 'pk', 3000, 0.7, 4), sr); }
    case 'gong': { const parts: Partial[] = [];   // a great flat gong: the low note at once, the shimmer blooming up over it after the stroke
      for (let k = 0; k < 20; k++) parts.push([61 * Math.pow(k + 1, 1.25) * (0.94 + rnd() * 0.12), 1 / (1 + k * 0.22), Math.max(1.2, 4.6 - k * 0.16), k < 2 ? 0 : 0.03 + 0.9 * (k / 20)]);   // (partials that spread as they climb, to 2.6 kHz: a shimmer, not a buzz on one pitch)
      return finish(mix(modal(sr, 4.6, parts), hit(0.05, 300, 0.8, 0.03, 'lp'), 1.2), sr); }
  }
}

/** kinds whose every partial sits low enough that a buffer at half the rate holds all of it */
const LOW: readonly Struck[] = ['kick', 'tomLo', 'tomHi', 'taiko', 'congaLo', 'congaHi', 'tabla', 'frame', 'gong'];
const made = new Map<string, { data: F; rate: number }>();
/** a hit of `kind` for a device running at `sr`, made once (and the rate it was made at: a low drum at half of `sr`) */
export function struckAt(sr: number, kind: Struck, take: number): { data: F; rate: number } {
  const key = `${kind}:${take}:${sr}`; let m = made.get(key);
  if (!m) { const rate = LOW.includes(kind) && sr >= 44100 ? sr / 2 : sr; made.set(key, m = { data: struck(rate, kind, take), rate }); }
  return m;
}
/** the tuned kinds that are strings (the rest are bars and heads: modes, which lose their top partials at the half rate, so only their low notes are made there) */
const STRUNG: string[] = ['bass', 'koto', 'harp', 'guitar', 'dulcimer', 'piano', 'pizz'];
/** a note of `kind` nearest `f` on the piano's keys for a device running at `sr`, made once: the note's own pitch, and the rate it was made at (a string's brightness
 *  and loss are per sample, so one rate holds across the whole range a piece plays: at two, the top notes would ring on brighter than the ones under them) */
export function tunedAt(sr: number, kind: Tuned, f: number): { data: F; rate: number; f: number } {
  const note = Math.round(69 + 12 * Math.log2(f / 440)), nf = 440 * Math.pow(2, (note - 69) / 12), key = `${kind}:${note}:${sr}`; let m = made.get(key);
  if (!m) { const rate = nf < (STRUNG.includes(kind) ? 1700 : 700) && sr >= 44100 ? sr / 2 : sr; made.set(key, m = { data: tuned(rate, kind, nf), rate }); }
  return { ...m, f: nf };
}

/** the tuned things a piece can ask for by name (musicBackend.ts KeyKind holds these beside its own electric ones) */
export const TUNED = ['bass', 'koto', 'harp', 'guitar', 'dulcimer', 'piano', 'pizz', 'marimba', 'kalimba', 'celesta', 'timp'] as const;
export type Tuned = typeof TUNED[number];
/** seconds of `kind` at `f` worth keeping */
export const tunedSecs = (kind: Tuned, f: number): number => kind === 'bass' ? 2.6 : kind === 'timp' ? 2.4 : kind === 'pizz' ? 0.7 : kind === 'marimba' || kind === 'kalimba' ? 1.2 : kind === 'koto' || kind === 'guitar' ? 1.8 : f > 700 ? 1.6 : 2.6;
/** one note of `kind` at `f` Hz, whole */
export function tuned(sr: number, kind: Tuned, f: number): F {
  const secs = tunedSecs(kind, f), seed = 0x7a11 + TUNED.indexOf(kind) * 389 + Math.round(f * 8);
  switch (kind) {
    // an upright bass, plucked with the side of a finger that slid up into the note: gut on a big box
    case 'bass': return plucked(sr, f, secs, { pulled: true, bright: 0.22, pos: 0.16, t60: 2.4, loss: 0.5, bend: -0.022, thump: [0.5, 190], body: [[105, 2, 5], [215, 2.5, 4], [520, 2, 2]], top: 1900, seed });
    // a koto: a pick by the bridge on silk, let go a touch sharp
    case 'koto': return plucked(sr, f, secs, { bright: 0.85, pos: 0.09, t60: 1.5, loss: 0.22, bend: 0.014, body: [[310, 3, 4], [640, 2.5, 3], [2600, 1.5, 3]], seed });
    case 'harp': return plucked(sr, f, secs, { bright: 0.45, pos: 0.42, t60: 2.8, loss: 0.2, body: [[240, 2, 3]], seed });
    case 'guitar': return plucked(sr, f, secs, { bright: 0.5, pos: 0.2, t60: 1.7, loss: 0.32, thump: [0.12, 110], body: [[105, 3, 4], [205, 3, 3], [410, 2, 2]], seed });   // (nylon)
    // a hammered dulcimer: two wires to a note, never quite one pitch, a wooden hammer
    case 'dulcimer': return plucked(sr, f, secs, { bright: 0.75, pos: 0.13, t60: 2.6, loss: 0.1, course: [-4, 5], body: [[330, 2, 3], [900, 1.5, 2]], seed });
    // an upright piano with the felt down: three strings, a soft hammer, the soundboard's knock
    case 'piano': return plucked(sr, f, secs, { bright: Math.min(0.6, 0.2 + f / 2600), pos: 0.12, t60: f > 500 ? 1.7 : 3.2, loss: 0.3, course: [-2.5, 0, 3], thump: [0.2, 170], body: [[190, 1.5, 3], [420, 1.5, 2]], top: 5200, seed });
    // a string section plucking: three players, never together, never one pitch, each note gone at once
    case 'pizz': return plucked(sr, f, secs, { bright: 0.5, pos: 0.18, t60: f > 300 ? 0.32 : 0.55, loss: 0.5, course: [-7, 0, 6], stagger: 0.007, body: [[285, 3, 5], [470, 3, 4], [1150, 2, 3]], top: 4500, seed });
    case 'marimba': { const T = Math.max(0.22, Math.min(1.6, 1.3 * Math.pow(220 / f, 0.6))); return finish(mix(modal(sr, secs, [[f, 1, T], [f * 3.98, 0.3, T * 0.22], [f * 9.9, 0.07, T * 0.08]]), bq(burst(sr, 0.02, 0.008, mulberry32(seed)), sr, 'lp', 1400, 0.7), 0.25), sr); }
    case 'kalimba': return finish(mix(modal(sr, secs, [[f, 1, 1.1], [f * 5.42, 0.16, 0.22], [f * 2.02, 0.05, 0.6]]), bq(burst(sr, 0.01, 0.004, mulberry32(seed)), sr, 'bp', 2400, 1), 0.3), sr);   // (a tine and the thumbnail that let it go)
    case 'celesta': return finish(modal(sr, secs, [[f, 1, 1.6], [f * 2.76, 0.32, 0.7], [f * 5.4, 0.14, 0.35], [f * 8.93, 0.05, 0.2]]), sr);
    // a kettledrum under a felt mallet: its partials near enough a fifth and an octave that it has a note
    case 'timp': return finish(mix(modal(sr, secs, [[f, 1, 2.1], [f * 1.5, 0.6, 1.6], [f * 1.99, 0.35, 1.1], [f * 2.44, 0.2, 0.8], [f * 2.89, 0.12, 0.6]], 0.02, 0.05), bq(burst(sr, 0.04, 0.02, mulberry32(seed)), sr, 'lp', 520, 0.7), 1.3), sr);
  }
}
