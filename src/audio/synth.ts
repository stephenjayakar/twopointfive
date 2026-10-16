// THE SOUND TABLE'S INSTRUMENTS (audio/sfx.ts builds its voices from these). The table used to be a line of arithmetic a voice — a sine under a hiss, one decay over both — and
// a good few of them sounded like toys for it: a pure tone that starts at phase zero and dies on a ruler is a synthesizer. A thing that is HIT is many modes, each dying at its
// own rate, set going by a contact that has a length; a BANG is a pressure front, the room's first slaps a few milliseconds behind it and a tail that goes dark as it dies; a
// BEEPER is a square wave gated hard through a small resonant disc; a THROAT is pulses through formants. Those are the pieces here. Everything works on plain Float32Arrays
// at the context's rate off a small generator of the voice's own (never the game's die, never Math.random): the table is the same on every boot, and nothing here is game state.
const TAU = Math.PI * 2;

/** a mode of a struck thing: frequency (Hz), the seconds it takes to fall 60 dB, its level */
export type Mode = readonly [f: number, t60: number, g: number];
/** a band of a room's tail: from, to (Hz), the seconds it takes to fall 60 dB, its level */
export type Band = readonly [lo: number, hi: number, t60: number, g: number];
/** an early reflection: how late (ms), how strong (signed: a slap off a hard wall comes back as it left, off an edge turned over), where it is rolled off (Hz) */
export type Tap = readonly [ms: number, g: number, lpHz: number];
/** a formant: centre (Hz), width (Hz), level */
export type Formant = readonly [f: number, bw: number, g: number];

/** ONE CALL OF AN INSTRUMENT, as a tuner sees it: its number in the voice (call order), which instrument, the numbers it was called with (seconds, Hz, levels) and, for a
 *  struck thing, its modes */
export interface Layer { k: number; kind: string; p: Record<string, number>; modes?: Mode[] }
/** A VOICE MADE ANOTHER WAY, for the replay page's sound lanes and nobody else: another seed, other numbers for a layer's parameters, layers muted or one heard alone.
 *  `log` is filled with every layer as the recipe wrote it. `levelK` / `norms` = the scales a whole render used (`level`, each `peakTo`), `fixedK` / `fixedNorms` = use those
 *  instead of measuring — so one layer heard alone is as loud as it is in the mix. */
export interface Tune { seed?: number; over?: Record<number, Record<string, number>>; mute?: readonly number[]; solo?: number; fixedK?: number; fixedNorms?: readonly number[]; log?: Layer[]; levelK?: number; norms?: number[]; /** the seed the recipe wrote (told back) */ wrote?: number }
/** THE HOOK. null (always, but inside the lanes' own render) = every instrument exactly as written; a Tune with nothing in it = the same samples to the bit (a gain of
 *  one, a pitch of one). Nothing in the game sets it. */
export const TUNING: { on: Tune | null; ni: number } = { on: null, ni: 0 };

/** an RBJ peaking bell over x, in place: dB up or down at f, q wide */
export function peaking(x: Float32Array, sr: number, f: number, dB: number, q = 1): Float32Array {
  const A = Math.pow(10, dB / 40), w = TAU * Math.min(f, sr * 0.49) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al / A;
  const b0 = (1 + al * A) / a0, b1 = -2 * c / a0, b2 = (1 - al * A) / a0, a1 = b1, a2 = (1 - al / A) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
/** what is laid over a finished voice: a high-pass (Hz), one bell [Hz, dB, Q], a low-pass (Hz) — in that order, in place; each absent = not there */
export interface Post { hp?: number; bell?: readonly [f: number, dB: number, q: number]; lp?: number }
export function post(x: Float32Array, sr: number, p: Post): Float32Array { if (p.hp) biquad(x, sr, 'hp', p.hp); if (p.bell && p.bell[1]) peaking(x, sr, p.bell[0], p.bell[1], p.bell[2]); if (p.lp) biquad(x, sr, 'lp', p.lp); return x; }

/** an RBJ biquad over x[from, to), in place: 'lp' / 'hp' (12 dB an octave; q 0.707 = flat to the corner) or 'bp' (unit gain at f) */
export function biquad(x: Float32Array, sr: number, kind: 'lp' | 'hp' | 'bp', f: number, q = 0.7071, from = 0, to = x.length): Float32Array {
  const w = TAU * Math.min(f, sr * 0.49) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b0 = (kind === 'lp' ? (1 - c) / 2 : kind === 'hp' ? (1 + c) / 2 : al) / a0, b1 = (kind === 'lp' ? 1 - c : kind === 'hp' ? -(1 + c) : 0) / a0, b2 = (kind === 'bp' ? -al : kind === 'lp' ? (1 - c) / 2 : (1 + c) / 2) / a0;
  const a1 = -2 * c / a0, a2 = (1 - al) / a0;
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = from; i < to; i++) { const v = x[i], y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = v; y2 = y1; y1 = y; x[i] = y; }
  return x;
}
/** x kept between lo and hi Hz (either end left open: lo ≤ 0, hi ≥ the top) */
export function band(x: Float32Array, sr: number, lo: number, hi: number): Float32Array { if (lo > 0) biquad(x, sr, 'hp', lo); if (hi < sr * 0.45) biquad(x, sr, 'lp', hi); return x; }
/** the loudest 50 ms of x, as an RMS: what a short sound's level is heard as */
export function loudest(x: Float32Array, sr: number): number {
  const W = Math.min(x.length, Math.round(0.05 * sr)); let best = 0, acc = 0;
  for (let i = 0; i < x.length; i++) { acc += x[i] * x[i]; if (i >= W) acc -= x[i - W] * x[i - W]; if (acc > best) best = acc; }
  return Math.sqrt(best / W);
}

/** how loud x is HEARD: its loudest 50 ms with the bottom rolled off as an ear rolls it off (12 dB an octave under 300 Hz). The yardstick a redone voice is levelled by:
 *  a thump that was a 90 Hz sine and is now a knock with a body to it has to come out as loud to the ear, not to a meter. */
export function heard(x: Float32Array, sr: number): number { return loudest(biquad(x.slice(), sr, 'hp', 300, 0.5), sr); }
/** x scaled so its largest sample is p */
export function peakTo(x: Float32Array, p = 1): Float32Array { let pk = 1e-9; for (let i = 0; i < x.length; i++) { const m = Math.abs(x[i]); if (m > pk) pk = m; } let k = p / pk; const T = TUNING.on; if (T) { const f = T.fixedNorms?.[TUNING.ni++]; if (f !== undefined) k = f; else T.norms?.push(k); } for (let i = 0; i < x.length; i++) x[i] *= k; return x; }

/** one voice being made: its samples, its own dice, and the instruments that add to it */
export class Voice {
  readonly n: number; readonly out: Float32Array;
  private s: number; private sn: number; private scratch: Float32Array;
  constructor(readonly sr: number, readonly dur: number, seed: number) { this.n = Math.max(1, Math.floor(dur * sr)); this.out = new Float32Array(this.n); this.scratch = new Float32Array(this.n); this.s = seed >>> 0 || 1; this.sn = (Math.imul(this.s, 0x9E3779B1) ^ 0x5bd1e995) >>> 0 || 1; TUNING.ni = 0; }
  private k = 0;
  /** (only under TUNING) this call is layer k: filed as written, its numbers replaced by the tuner's, `mul` = its gain (0 muted or not the one heard alone; an effect —
   *  `fx` — is never silenced by another layer heard alone, and muted is passed by) */
  private lay(kind: string, p: Record<string, number>, modes?: readonly Mode[], fx = false): Record<string, number> {
    const T = TUNING.on!, k = this.k++; p.dB = 0;
    T.log?.push({ k, kind, p: { ...p }, modes: modes ? modes.map(m => [m[0], m[1], m[2]] as const) : undefined });
    const o = T.over?.[k]; if (o) for (const key in o) { const v = o[key]; if (key in p && typeof v === 'number' && Number.isFinite(v)) p[key] = v; }
    p.mul = T.mute?.includes(k) || (!fx && T.solo !== undefined && T.solo !== k) ? 0 : Math.pow(10, p.dB / 20);
    return p;
  }
  // TWO DICE: `rnd` / `u` decide what the voice IS (when a bit lands, a part's pitch) and are drawn a fixed number of times; `nz` is the noise in it, drawn per sample.
  // Kept apart so a voice is the same arrangement at 44.1 kHz as at 48 (one stream would hand the next 'when' a different draw at every sample rate).
  /** −1‥1: a choice */
  rnd = (): number => { let s = this.s; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.s = s; return ((s >>> 0) / 4294967296) * 2 - 1; };
  /** 0‥1: a choice */
  u = (): number => this.rnd() * 0.5 + 0.5;
  /** −1‥1: one sample of noise */
  nz = (): number => { let s = this.sn; s ^= s << 13; s ^= s >>> 17; s ^= s << 5; this.sn = s; return ((s >>> 0) / 4294967296) * 2 - 1; };
  /** an empty layer of the voice's own length (to be shaped by itself — slapped, filtered — then `add`ed) */
  layer(): Float32Array { return new Float32Array(this.n); }
  add(src: Float32Array, g = 1, dst = this.out): void { const n = Math.min(src.length, dst.length); for (let i = 0; i < n; i++) dst[i] += src[i] * g; }

  /** a per-sample layer the way the table was always written: t, the sample rate, the voice's noise and sixteen slots of filter state */
  gen(f: (t: number, sr: number, rnd: () => number, st: Float32Array) => number, dst = this.out): void { const st = new Float32Array(16), sr = this.sr, rnd = this.nz; const mul = TUNING.on ? this.lay('gen', {}).mul : 1; for (let i = 0; i < dst.length; i++) dst[i] += f(i / sr, sr, rnd, st) * mul; }

  /** AIR OR GRIT: noise between lo and hi Hz starting `at`, up in `a` seconds and falling by e every `d`; g is its level whatever the band's width */
  hiss(at: number, lo: number, hi: number, a: number, d: number, g: number, dst = this.out): void {
    let mul = 1; if (TUNING.on) { const p = this.lay('hiss', { at, lo, hi, a, d, g }); at = p.at; lo = p.lo; hi = p.hi; a = p.a; d = p.d; mul = p.mul; }
    const sr = this.sr, i0 = Math.floor(at * sr); if (i0 >= dst.length || g === 0) return;
    const len = Math.min(dst.length - i0, Math.ceil((a + d * 8) * sr)), s = this.scratch.subarray(0, len);
    for (let i = 0; i < len; i++) { const t = i / sr; s[i] = this.nz() * (t < a ? t / a : Math.exp(-(t - a) / d)); }
    band(s, sr, lo, hi);
    const k = g * mul * Math.sqrt(sr * 0.5 / Math.max(50, Math.min(hi, sr * 0.5) - Math.max(lo, 0)));
    for (let i = 0; i < len; i++) dst[i0 + i] += s[i] * k;
  }

  /** A THING STRUCK: a contact `hard` seconds long (a windowed burst of noise: short = steel on steel, long = a boot heel, a body) setting each mode ringing — every mode
   *  starts where the contact left it (no two phases alike) and dies at its own rate. `click` = how much of the contact itself is heard. HOW LOUD EACH MODE RINGS IS
   *  ITS OWN WEIGHT in the list, whatever the contact (each is set to its peak): `hard` shapes the onset and the click, not the balance of the modes. */
  ring(at: number, modes: readonly Mode[], hard: number, g = 1, click = 0, dst = this.out): void {
    let mul = 1, pm = 1, tm = 1; if (TUNING.on) { const p = this.lay('ring', { at, hard, g, click, pitch: 1, t60: 1 }, modes); at = p.at; hard = p.hard; click = p.click; pm = p.pitch; tm = p.t60; mul = p.mul; }
    const sr = this.sr, i0 = Math.floor(at * sr); if (i0 >= dst.length) return;
    const L = Math.max(2, Math.floor(hard * sr)), exc = new Float32Array(L), room = dst.length - i0, s = this.scratch;
    for (let i = 0; i < L; i++) exc[i] = this.nz() * (0.5 - 0.5 * Math.cos(TAU * (i + 1) / (L + 1)));
    for (const [f0, t0, a] of modes) {
      const f = f0 * pm, t60 = t0 * tm; if (f >= sr * 0.45 || a === 0) continue;
      const w = TAU * f / sr, r = Math.exp(-6.908 / (t60 * sr)), c1 = 2 * r * Math.cos(w), c2 = r * r, len = Math.min(room, L + Math.ceil(t60 * 1.15 * sr));
      let y1 = 0, y2 = 0, pk = 1e-9;
      for (let i = 0; i < len; i++) { const y = (i < L ? exc[i] : 0) + c1 * y1 - c2 * y2; y2 = y1; y1 = y; s[i] = y; const m = y < 0 ? -y : y; if (m > pk) pk = m; }
      const k = a * g * mul / pk; for (let i = 0; i < len; i++) dst[i0 + i] += s[i] * k;
    }
    if (click) { const n = Math.min(L, room); for (let i = 0; i < n; i++) dst[i0 + i] += exc[i] * click * g * mul; }
  }

  /** A PRESSURE FRONT (Friedlander's blast wave): up at once, through zero after T seconds, a shallow suck behind it. T is the size of the bang — a pistol 0.3 ms, a
   *  canister 0.9 — and puts its weight where a real one's is with no tone in it. */
  blast(at: number, T: number, g: number, dst = this.out): void { let mul = 1; if (TUNING.on) { const p = this.lay('blast', { at, T, g }); at = p.at; T = p.T; mul = p.mul; } const sr = this.sr, i0 = Math.floor(at * sr), len = Math.min(dst.length - i0, Math.ceil(T * 12 * sr)); for (let i = 0; i < len; i++) { const x = i / (T * sr); dst[i0 + i] += (1 - x) * Math.exp(-x) * g * mul; } }

  /** THE ROOM AFTER IT: each band of noise swelling in over `rise` and dying at its own rate — the top goes first, so a tail darkens as it fades */
  tail(at: number, bands: readonly Band[], rise = 0.008, dst = this.out): void {
    let mul = 1, tm = 1; if (TUNING.on) { const p = this.lay('tail', { at, rise, t60: 1, n: bands.length }); at = p.at; rise = p.rise; tm = p.t60; mul = p.mul; }
    const sr = this.sr, i0 = Math.floor(at * sr); if (i0 >= dst.length) return;
    for (const [lo, hi, t0, g] of bands) { const t60 = t0 * tm;
      const len = Math.min(dst.length - i0, Math.ceil(t60 * 1.15 * sr)), s = this.scratch.subarray(0, len), kd = 6.908 / t60;
      for (let i = 0; i < len; i++) { const t = i / sr; s[i] = this.nz() * (1 - Math.exp(-t / rise)) * Math.exp(-t * kd); }
      band(s, sr, lo, hi);
      const k = g * mul * Math.sqrt(sr * 0.5 / Math.max(50, Math.min(hi, sr * 0.5) - lo));
      for (let i = 0; i < len; i++) dst[i0 + i] += s[i] * k;
    }
  }

  /** THE FIRST SLAPS: x heard again off the floor, the walls, the ceiling — each a little later, weaker and duller. In place (the taps read the dry signal). */
  slaps(x: Float32Array, taps: readonly Tap[]): Float32Array {
    let mul = 1, tk = 1; if (TUNING.on) { const p = this.lay('slaps', { time: 1, n: taps.length }, undefined, true); tk = p.time; mul = p.mul; if (mul === 0) return x; }
    const sr = this.sr, dry = x.slice();
    for (const [ms, g0, hz] of taps) { const g = g0 * mul, d = Math.round(ms * tk * 0.001 * sr), a = 1 - Math.exp(-TAU * hz / sr); let y = 0; for (let i = d; i < x.length; i++) { y += a * (dry[i - d] - y); x[i] += y * g; } }
    return x;
  }

  /** A PIEZO: a square wave at f switched on and off (half a millisecond each way) through the disc's own resonance at `res` Hz — level steady while it sounds, the gate's
   *  edges ticking; nothing decays like a plucked string */
  piezo(at: number, len: number, f: number | ((t: number) => number), g: number, res = 0, q = 5, dst = this.out): void {
    let mul = 1, pm = 1; if (TUNING.on) { const p = this.lay('piezo', typeof f === 'number' ? { at, len, f, g, res, q, pitch: 1 } : { at, len, g, res, q, pitch: 1 }); at = p.at; len = p.len; res = p.res; q = p.q; pm = p.pitch; mul = p.mul; }
    const sr = this.sr, i0 = Math.floor(at * sr), n = Math.min(dst.length - i0, Math.ceil((len + 0.01) * sr)); if (n <= 0) return;
    const s = this.scratch.subarray(0, n); let ph = this.u(), fMean = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, fi = (typeof f === 'number' ? f : f(t)) * pm; fMean += fi; ph += fi / sr; const gate = Math.min(1, t / 0.0005, Math.max(0, (len - t) / 0.0005)); s[i] = ((ph % 1) < 0.5 ? 1 : -1) * gate; }
    biquad(s, sr, 'bp', res || fMean / n, q); biquad(s, sr, 'hp', 700);
    for (let i = 0; i < n; i++) dst[i0 + i] += s[i] * g * mul;
  }

  /** A THROAT: glottal pulses (their rate f0(t), each cycle a little off the last in length and strength; `open` = the share of a cycle the folds are apart — 0.6 a relaxed
   *  voice, 0.3 a pressed one) with breath in them, through formants that may move. amp(t) is the syllables. */
  throat(at: number, len: number, f0: (t: number) => number, amp: (t: number) => number, formants: (t: number) => readonly Formant[], o: { open?: number; jitter?: number; shimmer?: number; breath?: number; voice?: number } = {}, dst = this.out): void {
    let open = o.open ?? 0.6, jit = o.jitter ?? 0.02, shim = o.shimmer ?? 0.08, breath = o.breath ?? 0.2, voice = o.voice ?? 1, mul = 1, pm = 1;
    if (TUNING.on) { const p = this.lay('throat', { at, len, pitch: 1, open, jitter: jit, shimmer: shim, breath, voice }); at = p.at; len = p.len; pm = p.pitch; open = p.open; jit = p.jitter; shim = p.shimmer; breath = p.breath; voice = p.voice; mul = p.mul; }
    const sr = this.sr, i0 = Math.floor(at * sr), n = Math.min(dst.length - i0, Math.ceil(len * sr)); if (n <= 0) return;
    const src = this.scratch.subarray(0, n); let ph = 0, per = 1, cyc = 1, last = 0;
    for (let i = 0; i < n; i++) {
      ph += f0(i / sr) * pm * per / sr; if (ph >= 1) { ph -= 1; per = 1 + jit * this.nz(); cyc = 1 + shim * this.nz(); }
      const up = open * 0.66, gl = ph < up ? 0.5 - 0.5 * Math.cos(Math.PI * ph / up) : ph < open ? Math.cos(Math.PI * 0.5 * (ph - up) / (open - up)) : 0;
      src[i] = (gl - last) * (sr / 3400) * cyc * voice + this.nz() * breath * (0.35 + 0.65 * gl); last = gl;   // (the difference = what leaves the lips: the closing edge is the sharp one)
    }
    const F0 = formants(0), st = new Float64Array(F0.length * 2), co = new Float64Array(F0.length * 3);
    for (let i = 0; i < n; i++) {
      if ((i & 63) === 0) { const F = formants(i / sr); for (let k = 0; k < F0.length; k++) { const [f, bw, g] = F[k], r = Math.exp(-Math.PI * bw / sr); co[k * 3] = 2 * r * Math.cos(TAU * f / sr); co[k * 3 + 1] = r * r; co[k * 3 + 2] = g * (1 - r); } }
      let y = 0; const x = src[i];
      for (let k = 0; k < F0.length; k++) { const v = x * co[k * 3 + 2] + co[k * 3] * st[k * 2] - co[k * 3 + 1] * st[k * 2 + 1]; st[k * 2 + 1] = st[k * 2]; st[k * 2] = v; y += (k & 1) ? -v : v; }
      dst[i0 + i] += y * amp(i / sr) * mul;
    }
  }

  /** driven into tanh (a loud thing overloading the ear and the room alike) */
  drive(k: number, x = this.out): void { if (TUNING.on) { const p = this.lay('drive', { k }, undefined, true); k = p.k; if (p.mul === 0) return; } for (let i = 0; i < x.length; i++) x[i] = Math.tanh(x[i] * k); }
  /** set the voice's level: as loud to the ear (`heard`) as `as` — the number the game's gains were tuned against — and never a sample past `peak` */
  level(as: number, peak = 0.98): void {
    const x = this.out, th = peak * 0.5, room = peak - th, T = TUNING.on;
    if (T && T.fixedK !== undefined) {   // (a layer heard alone, a layer muted: the scale the whole voice was given, and tips rounded once if they still pass the peak)
      const k = T.fixedK; let pk = 0; for (let i = 0; i < x.length; i++) { x[i] *= k; const m = Math.abs(x[i]); if (m > pk) pk = m; }
      if (pk > peak) for (let i = 0; i < x.length; i++) { const m = Math.abs(x[i]); if (m > th) x[i] = Math.sign(x[i]) * (th + room * Math.tanh((m - th) / room)); }
      return;
    }
    let all = 1;
    for (let pass = 0; pass < 4; pass++) {
      const k = as / Math.max(1e-9, heard(x, this.sr)); let pk = 0;
      for (let i = 0; i < x.length; i++) { x[i] *= k; const m = Math.abs(x[i]); if (m > pk) pk = m; }
      all *= k; if (T) T.levelK = all;
      if (pk <= peak) return;
      // a voice that is all crest (a click, a ping): its tips are rounded over the way a recording chain rounds them, and it is levelled again
      for (let i = 0; i < x.length; i++) { const m = Math.abs(x[i]); if (m > th) x[i] = Math.sign(x[i]) * (th + room * Math.tanh((m - th) / room)); }
    }
  }
}
