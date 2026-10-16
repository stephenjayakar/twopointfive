// A SOUND TUNED ON ITS CARD (the sound lanes, replay pages only: replay/soundlanes.ts). The maintainer, 10-13: "having a few options, ways to tune them (i'm familiar
// with audio engineering!), parameters for the generation, etc. would go a long way to cut down on iteration times". A voice of the table is a recipe of instrument
// calls (audio/synth.ts: hiss, ring, blast, tail, slaps, piezo, throat, drive); under the instruments' hook (`TUNING`) each call is a numbered LAYER whose numbers can be
// replaced, which can be muted or heard alone, and the whole can be made off another seed. This file is the tune as it is KEPT (plain JSON in the pick, read back as
// what it may be), how it is RENDERED (the take it starts from under the tune, then a high-pass and a bell laid over the result), its PARAMETERS in an engineer's units
// (ms, Hz, dB, cents) and how it is SAID as one line of text. Nothing here is read by the game.
import type { SfxBuffer, SfxContext } from '../audio/backend';
import { buildOne } from '../audio/sfx';
import { altOne } from '../audio/sfxAlt';
import { biquad, post, type Layer, type Tune } from '../audio/synth';

/** a tune as the pick keeps it: the take it starts from, another seed, numbers laid over layers (by layer number, then by parameter), layers muted, a high-pass (Hz)
 *  and one bell [Hz, dB, Q] over the result. Every field but `base` optional: absent = as written. */
export interface SoundTune { base: string; seed?: number; over?: Record<string, Record<string, number>>; mute?: number[]; hp?: number; bell?: [number, number, number] }
export type Unit = 'ms' | 'Hz' | 'dB' | '¢' | '×' | '';
/** one dial of a layer: the instrument's own argument, its word on the card, its unit there, its range (in the instrument's units: seconds, Hz, a factor) */
export interface Param { key: string; word: string; unit: Unit; lo: number; hi: number; log?: boolean }

export const HP_LO = 20, HP_HI = 2000, BELL_LO = 40, BELL_HI = 16000, BELL_DB = 18, Q_LO = 0.3, Q_HI = 8, LAYER_MAX = 200, SEED_MAX = 999999;
/** what a kept number of each parameter may be, whatever layer it is on (the card's own dials are narrower: `paramsOf`) */
const RANGE: Record<string, readonly [number, number]> = {
  at: [0, 10], lo: [10, 24000], hi: [10, 24000], a: [0.00002, 2], d: [0.0001, 5], dB: [-60, 24], pitch: [0.25, 4], t60: [0.05, 20], hard: [0.00002, 0.2], click: [0, 4],
  T: [0.00002, 0.05], rise: [0.0002, 1], time: [0.1, 8], len: [0.001, 10], res: [20, 20000], q: [0.2, 50], open: [0.05, 0.95], jitter: [0, 0.5], shimmer: [0, 1], breath: [0, 4],
  voice: [0, 4], k: [0.05, 20],
};
const P = (key: string, word: string, unit: Unit, lo: number, hi: number, log = false): Param => ({ key, word, unit, lo, hi, log });
const GAIN = P('dB', 'gain', 'dB', -24, 24), PITCH = P('pitch', 'pitch', '¢', 0.25, 4, true);
/** the dials of one layer (`dur` = the sound's length in seconds: how far a layer's start can be moved) */
export function paramsOf(l: Layer, dur: number): Param[] {
  const at = P('at', 'at', 'ms', 0, Math.max(0.05, dur, l.p.at ?? 0));
  switch (l.kind) {
    case 'hiss': return [at, P('lo', 'lo', 'Hz', 20, 20000, true), P('hi', 'hi', 'Hz', 20, 20000, true), P('a', 'A', 'ms', 0.00005, 0.5, true), P('d', 'D', 'ms', 0.0002, 2, true), GAIN];
    case 'ring': return [at, PITCH, P('t60', 'T60', '×', 0.1, 10, true), P('hard', 'contact', 'ms', 0.00005, 0.05, true), P('click', 'click', '', 0, 2), GAIN];
    case 'blast': return [at, P('T', 'T', 'ms', 0.00005, 0.02, true), GAIN];
    case 'tail': return [at, P('rise', 'rise', 'ms', 0.0005, 0.2, true), P('t60', 'T60', '×', 0.1, 10, true), GAIN];
    case 'slaps': return [P('time', 'time', '×', 0.25, 4, true), GAIN];
    case 'piezo': return [at, P('len', 'len', 'ms', 0.001, 2, true), PITCH, ...(l.p.res > 0 ? [P('res', 'res', 'Hz', 100, 12000, true)] : []), P('q', 'Q', '', 0.3, 30, true), GAIN];
    case 'throat': return [at, P('len', 'len', 'ms', 0.01, 3, true), PITCH, P('open', 'open', '', 0.1, 0.9), P('jitter', 'jitter', '', 0, 0.2), P('shimmer', 'shimmer', '', 0, 0.5), P('breath', 'breath', '', 0, 2), GAIN];
    case 'drive': return [P('k', 'drive', '×', 0.1, 8, true)];
    case 'gen': return [GAIN];
    default: return [];
  }
}
const WORDS: Record<string, readonly [string, Unit]> = { at: ['at', 'ms'], lo: ['lo', 'Hz'], hi: ['hi', 'Hz'], a: ['A', 'ms'], d: ['D', 'ms'], dB: ['gain', 'dB'], pitch: ['pitch', '¢'], t60: ['T60', '×'], hard: ['contact', 'ms'],
  click: ['click', ''], T: ['T', 'ms'], rise: ['rise', 'ms'], time: ['time', '×'], len: ['len', 'ms'], res: ['res', 'Hz'], q: ['Q', ''], open: ['open', ''], jitter: ['jitter', ''], shimmer: ['shimmer', ''], breath: ['breath', ''],
  voice: ['voice', ''], k: ['drive', '×'] };

const trim0 = (s: string) => s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
const sign = (v: number, s: string) => (v > 0 ? '+' : '') + s;
/** a value in the instrument's units as the card's number (no unit): 0.15 s → '150', a pitch factor → cents */
export function shown(unit: Unit, v: number): string {
  if (unit === 'ms') { const m = v * 1000; return trim0(m < 10 ? m.toFixed(2) : m < 100 ? m.toFixed(1) : m.toFixed(0)); }
  if (unit === 'Hz') return trim0(v < 100 ? v.toFixed(1) : v.toFixed(0));
  if (unit === '¢') { const c = Math.round(1200 * Math.log2(v)); return sign(c, String(c)); }
  if (unit === 'dB') { const d = Math.round(v * 10) / 10; return sign(d, trim0(d.toFixed(1))); }
  return trim0(v.toFixed(2));
}
/** the card's number back to the instrument's units; NaN = not a number */
export function typed(unit: Unit, s: string): number {
  const v = parseFloat(s.replace(/[^0-9.+\-eE]/g, '')); if (!isFinite(v)) return NaN;
  return unit === 'ms' ? v / 1000 : unit === '¢' ? Math.pow(2, v / 1200) : v;
}
/** with its unit, as the copied line says it: '150 ms', '-200 ¢', '× 1.5' */
export const said = (unit: Unit, v: number): string => unit === '×' ? `× ${shown(unit, v)}` : unit ? `${shown(unit, v)} ${unit}` : shown(unit, v);
/** a gain factor as dB, a rate as cents */
export const dBOf = (g: number) => 20 * Math.log10(Math.max(1e-6, g)), centsOf = (r: number) => 1200 * Math.log2(r);

/** one layer in a few words: where its band or its modes lie, how long it is */
export function layerSays(l: Layer): string {
  const p = l.p, ms = (v: number) => `${shown('ms', v)} ms`, b: string[] = [];
  if (p.at > 0) b.push(`@ ${ms(p.at)}`);
  if (l.kind === 'hiss') b.push(`${shown('Hz', p.lo)}–${shown('Hz', p.hi)} Hz`, `A ${ms(p.a)}`, `D ${ms(p.d)}`);
  else if (l.kind === 'ring') { const fs = (l.modes ?? []).map(m => m[0]); b.push(fs.length > 1 ? `${fs.length} modes ${shown('Hz', Math.min(...fs))}–${shown('Hz', Math.max(...fs))} Hz` : fs.length ? `${shown('Hz', fs[0])} Hz` : 'no modes', `contact ${ms(p.hard)}`); }
  else if (l.kind === 'blast') b.push(`T ${ms(p.T)}`);
  else if (l.kind === 'tail') b.push(`${p.n} bands`, `rise ${ms(p.rise)}`);
  else if (l.kind === 'slaps') b.push(`${p.n} taps`);
  else if (l.kind === 'piezo') b.push(...(p.f ? [`${shown('Hz', p.f)} Hz`] : []), ms(p.len));
  else if (l.kind === 'throat') b.push(ms(p.len));
  else if (l.kind === 'drive') b.push(`× ${shown('', p.k)}`);
  return b.join(' · ');
}

const fin = (v: unknown): v is number => typeof v === 'number' && isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const tuneEmpty = (t: SoundTune) => t.seed === undefined && !t.over && !t.mute?.length && !t.hp && !t.bell;
/** a kept tune read as what it MAY be (another build's, a hand edit, garbage): every number clamped, anything of another shape dropped; null = no tune in it */
export function tuneOf(v: unknown, baseOk: (base: string) => boolean): SoundTune | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>; if (typeof o.base !== 'string' || !baseOk(o.base)) return null;
  const t: SoundTune = { base: o.base };
  if (fin(o.seed) && Number.isInteger(o.seed) && o.seed >= 1 && o.seed <= SEED_MAX) t.seed = o.seed;
  const layer = (k: string) => /^\d{1,3}$/.test(k) && +k < LAYER_MAX;
  if (o.over && typeof o.over === 'object' && !Array.isArray(o.over)) {
    const over: Record<string, Record<string, number>> = {}; let n = 0;
    for (const [k, row] of Object.entries(o.over)) {
      if (!layer(k) || !row || typeof row !== 'object' || Array.isArray(row) || n >= 64) continue;
      const r: Record<string, number> = {};
      for (const [key, x] of Object.entries(row)) { const R = Object.prototype.hasOwnProperty.call(RANGE, key) ? RANGE[key] : null; if (R && fin(x)) r[key] = clamp(x, R[0], R[1]); }
      if (Object.keys(r).length) { over[String(+k)] = r; n++; }
    }
    if (n) t.over = over;
  }
  if (Array.isArray(o.mute)) { const m = [...new Set(o.mute.filter((k): k is number => fin(k) && Number.isInteger(k) && k >= 0 && k < LAYER_MAX))].slice(0, 64).sort((a, b) => a - b); if (m.length) t.mute = m; }
  if (fin(o.hp) && o.hp > HP_LO) t.hp = clamp(o.hp, HP_LO, HP_HI);
  if (Array.isArray(o.bell) && o.bell.length === 3 && o.bell.every(fin) && o.bell[1] !== 0) t.bell = [clamp(o.bell[0], BELL_LO, BELL_HI), clamp(o.bell[1], -BELL_DB, BELL_DB), clamp(o.bell[2], Q_LO, Q_HI)];
  return tuneEmpty(t) ? null : t;
}

/** the tune as text, only what differs from the take as written, in units: 'tuned from after · seed 141 · L1 hiss lo 180 Hz, D 150 ms · L3 mute · hp 90 Hz · bell 2400 Hz -4 dB Q 1.2'.
 *  `layers` = the take's layers as written (their kinds, and the numbers a kept value is held against); without them every kept number is said, with no kind. */
export function tuneText(t: SoundTune, layers?: readonly Layer[]): string {
  const b = [`tuned from ${t.base}`]; if (t.seed !== undefined) b.push(`seed ${t.seed}`);
  const ks = new Set<number>([...Object.keys(t.over ?? {}).map(Number), ...(t.mute ?? [])]);
  for (const k of [...ks].sort((x, y) => x - y)) {
    const l = layers?.[k], row = t.over?.[k] ?? {}, w: string[] = []; if (layers && !l) continue;   // (a number kept for a layer this take does not have: nothing is changed by it)
    for (const [key, v] of Object.entries(row)) { const W = WORDS[key]; if (!W || (l && (!(key in l.p) || l.p[key] === v))) continue; w.push(`${W[0]} ${said(W[1], v)}`); }
    if (t.mute?.includes(k)) w.push('mute');
    if (w.length) b.push(`L${k}${l ? ` ${l.kind}` : ''} ${w.join(', ')}`);
  }
  if (t.hp) b.push(`hp ${said('Hz', t.hp)}`);
  if (t.bell) b.push(`bell ${said('Hz', t.bell[0])} ${said('dB', t.bell[1])} Q ${shown('', t.bell[2])}`);
  return b.join(' · ');
}

/** a take made under a tune, before anything is laid over it: its samples, its layers as written, the seed it is written with */
export interface Made { raw: Float32Array; sr: number; layers: Layer[]; wrote?: number }
const KEPT = new Map<string, Made | null>();
/** the synthesis half (kept: a dial of the high-pass or the bell does not make the voice again). `plain(base)` = the page's own buffer of a take: what a take with no
 *  layers (the old per-sample rows, the 'before' table) is. null = this page has no such take. */
export function madeOf(ctx: SfxContext, name: string, t: SoundTune, plain: (base: string) => SfxBuffer | null, solo?: number): Made | null {
  const key = `${name}|${ctx.sampleRate}|${JSON.stringify([t.base, t.seed ?? null, t.over ?? null, t.mute ?? null, solo ?? null])}`, had = KEPT.get(key); if (had !== undefined) return had;
  const T: Tune = { log: [] }; if (t.seed !== undefined) T.seed = t.seed; if (t.over) T.over = t.over as unknown as Record<number, Record<string, number>>; if (t.mute?.length) T.mute = t.mute; if (solo !== undefined) T.solo = solo;
  const k = /^new ([1-9])$/.exec(t.base);
  let buf = t.base === 'after' ? buildOne(ctx, name, T) : k ? altOne(ctx, name, +k[1] - 1, T) : null, layers = T.log ?? [];
  if (!buf) { buf = plain(t.base); layers = []; }
  const out: Made | null = buf ? { raw: buf.getChannelData(0), sr: buf.sampleRate, layers, wrote: layers.length ? T.wrote : undefined } : null;
  if (KEPT.size >= 12) KEPT.delete(KEPT.keys().next().value as string);
  KEPT.set(key, out); return out;
}
/** the take as written: its layers (none for a take that is not built of the instruments) and its seed */
export const writtenOf = (ctx: SfxContext, name: string, base: string, plain: (base: string) => SfxBuffer | null): Made | null => madeOf(ctx, name, { base }, plain);
/** the tuned buffer the mixer is handed: the take under the tune, then the high-pass and the bell, then the guard (below). Always a buffer of its own. */
export function renderTune(ctx: SfxContext, name: string, t: SoundTune, plain: (base: string) => SfxBuffer | null, solo?: number): SfxBuffer | null {
  const m = madeOf(ctx, name, t, plain, solo); if (!m) return null;
  const buf = ctx.createBuffer(1, m.raw.length, m.sr), x = buf.getChannelData(0); x.set(m.raw);
  post(x, m.sr, { hp: t.hp, bell: t.bell });
  // THE GUARD: a bell's boost (or a layer turned up) can take the baked buffer past full scale, and then what he hears is the mixer's compressor, not his dial.
  // Past 0 dBFS the whole buffer is pulled down to GUARD_PEAK; `pulledOf` says by how much, and the card shows it.
  let pk = 0; for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > pk) pk = a; }
  if (pk > 1) { const k = GUARD_PEAK / pk; for (let i = 0; i < x.length; i++) x[i] *= k; PULLED.set(buf, 20 * Math.log10(pk / GUARD_PEAK)); }
  return buf;
}
/** what a tuned buffer that came out past full scale is pulled down to */
export const GUARD_PEAK = 0.98;
const PULLED = new WeakMap<object, number>();
/** how many dB the guard pulled this tuned buffer down by (0 = it was under full scale as made) */
export const pulledOf = (buf: object): number => PULLED.get(buf) ?? 0;

/** how loud x is across the band, for a picture: `bins` log-spaced from f0 to f1 Hz, dB (the strongest line in each). `lp` = a low-pass laid over a copy first (the
 *  mixer's own, which is not in the buffer); `rate` = played that much faster (every line that much higher). */
export function spectrum(x: Float32Array, sr: number, bins = 120, f0 = 30, f1 = 20000, lp = 0, rate = 1): Float32Array {
  let N = 1024; while (N < x.length && N < 65536) N <<= 1;
  const re = new Float64Array(N), im = new Float64Array(N), src = lp ? biquad(x.slice(0, N), sr, 'lp', lp) : x, n = Math.min(N, src.length);
  for (let i = 0; i < n; i++) re[i] = src[i];
  for (let i = 1, j = 0; i < N; i++) { let b = N >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; } }
  for (let len = 2; len <= N; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), h = len >> 1;
    for (let i = 0; i < N; i += len) { let cr = 1, ci = 0; for (let j = 0; j < h; j++) { const a = i + j, b = a + h, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  const out = new Float32Array(bins).fill(-140), kHz = sr * rate / N, w = Math.log(f1 / f0);
  for (let i = 1; i < N / 2; i++) { const f = i * kHz; if (f < f0 || f >= f1) continue; const b = Math.floor(Math.log(f / f0) / w * bins), d = 10 * Math.log10((re[i] * re[i] + im[i] * im[i]) / N + 1e-14); if (d > out[b]) out[b] = d; }
  for (let b = 1; b < bins; b++) if (out[b] === -140) out[b] = out[b - 1];   // (a bin at the bottom narrower than one line of the transform: the line below it)
  for (let b = bins - 2; b >= 0; b--) if (out[b] === -140) out[b] = out[b + 1];
  return out;
}
