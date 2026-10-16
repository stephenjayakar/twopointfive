// Offline render of the WALL CHARGE's report (src/audio/sfx.ts wallCrack / wallThump / wallDebris, layered by src/game/blastFeel.ts) beside the stun can's report it
// used to borrow and a carbine round — for ears that are not at the game: WAVs to listen to, and the numbers a page can quote (length, peak, loudest-50-ms RMS,
// energy under 120 Hz and under 300 Hz, spectral centroid). No WebAudio: buildSfx only needs a sample rate and a buffer factory (as tools/qa/audio-render.ts).
//   bun run tools/qa/wall-report-render.ts [outDir]      # default: prints the table only; with a directory, writes the WAVs there too
// The MIXES are the three layers summed at the gains and delays blastFeel.ts report() gives them for a listener `d` metres off in the open (the mixer's own
// inverse-distance law, audio.ts REF_DIST / ROLLOFF; no occlusion, no room, no compressor), every file scaled by the same OUT so levels compare by ear.
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '../..');
const { buildSfx } = await import(`${ROOT}/src/audio/sfx.ts`);
const { FEEL } = await import(`${ROOT}/src/game/blastFeel.ts`);
const SR = 48000, OUT = 0.5, REF_DIST = 1.6, ROLLOFF = 1.1;
const shim = { sampleRate: SR, createBuffer(channels: number, n: number, sr: number) { const chans = Array.from({ length: channels }, () => new Float32Array(n)); return { sampleRate: sr, length: n, duration: n / sr, numberOfChannels: channels, getChannelData: (c: number) => chans[c] }; } };
const table = buildSfx(shim as never) as Record<string, { getChannelData(c: number): Float32Array }>;
const buf = (n: string) => table[n].getChannelData(0);

function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const a = i + k, b = a + len / 2; const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
}
const db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
function analyse(d: Float32Array) {
  let peak = 0, sum2 = 0; for (const x of d) { peak = Math.max(peak, Math.abs(x)); sum2 += x * x; }
  const W = Math.floor(SR * 0.05); let win = 0, best = 0; for (let i = 0; i < d.length; i++) { win += d[i] * d[i]; if (i >= W) win -= d[i - W] * d[i - W]; if (win > best) best = win; }
  let N = 1; while (N < d.length) N <<= 1; const re = new Float64Array(N), im = new Float64Array(N); re.set(d); fft(re, im);
  let e120 = 0, e300 = 0, tot = 0, num = 0; for (let k = 1; k < N / 2; k++) { const f = k * SR / N, p = re[k] * re[k] + im[k] * im[k]; tot += p; num += f * p; if (f < 120) e120 += p; if (f < 300) e300 += p; }
  // seconds until the level (50 ms RMS) last stands above −40 dB of its loudest: how long it is HEARD, not how long the buffer is
  const thr = best / W * 1e-4; let heard = 0; { let w = 0; for (let i = 0; i < d.length; i++) { w += d[i] * d[i]; if (i >= W) w -= d[i - W] * d[i - W]; if (w / W > thr) heard = i / SR; } }
  // energies in the signal's own units (sum of squares ÷ rate = amplitude² · seconds), so two sounds compare in absolute terms as well as by share
  const E = sum2 / SR, k = tot > 0 ? E / tot : 0;
  return { dur: d.length / SR, heard, peak, win: Math.sqrt(best / W), E, e120: e120 * k, e300: e300 * k, s120: tot ? e120 / tot : 0, s300: tot ? e300 / tot : 0, centroid: tot ? num / tot : 0 };
}
const law = (d: number) => REF_DIST / (REF_DIST + ROLLOFF * (Math.max(d, REF_DIST) - REF_DIST));
/** the wall charge as blastFeel.ts report() layers it for a listener d metres off (rates 1), in the open */
function wallAt(d: number): Float32Array {
  const K = FEEL.sound, late = Math.min(K.lateMax, d / K.c), dull = 1 / (1 + (d / K.dullM) * (d / K.dullM)), g = law(d);
  const out = new Float32Array(Math.ceil((late + K.debrisAfter + 2.8 + 0.6) * SR));
  const add = (name: string, at: number, gain: number) => { const s = buf(name), o = Math.floor(at * SR); for (let i = 0; i < s.length && o + i < out.length; i++) out[o + i] += s[i] * gain * g; };
  const carry = 1 + K.carry * Math.min(1, Math.max(0, (d - K.carryFrom) / K.carryOver));
  add('wallCrack', late, K.crack * (0.25 + 0.75 * dull) * carry); add('wallThump', late + K.thumpAfter, K.thump * carry); add('wallDebris', late + K.debrisAfter, K.debris * (0.4 + 0.6 * dull) * carry);
  return out;
}
const scaled = (s: Float32Array, k: number) => { const o = new Float32Array(s.length); for (let i = 0; i < s.length; i++) o[i] = s[i] * k; return o; };
const seq = (parts: Float32Array[], gap = 1.2) => { const n = parts.reduce((a, p) => a + p.length + Math.floor(gap * SR), 0); const o = new Float32Array(n); let at = 0; for (const p of parts) { o.set(p, at); at += p.length + Math.floor(gap * SR); } return o; };

const voices: Record<string, Float32Array> = {
  'stunBang (the can: what a wall charge played before)': buf('stunBang'),
  'wallCrack': buf('wallCrack'), 'wallThump': buf('wallThump'), 'wallDebris': buf('wallDebris'),
  'carbineReport (one round, for scale)': buf('carbineReport'),
  'WALL CHARGE at 2 m (the three layered)': wallAt(2), 'WALL CHARGE at 8 m': wallAt(8), 'WALL CHARGE at 20 m': wallAt(20),
  'stunBang at 2 m': scaled(buf('stunBang'), law(2)), 'stunBang at 8 m': scaled(buf('stunBang'), law(8)), 'stunBang at 20 m': scaled(buf('stunBang'), law(20)),
  'carbineReport at 8 m': scaled(buf('carbineReport'), law(8)),
};
console.log('voice                                                    length  heard   peak   peak dB  50ms RMS dB   energy   <120 Hz (share)   <300 Hz (share)   centroid');
for (const [n, d] of Object.entries(voices)) { const a = analyse(d);
  console.log(`${n.padEnd(56)} ${a.dur.toFixed(2).padStart(5)} s ${a.heard.toFixed(2).padStart(5)} s  ${a.peak.toFixed(3)}  ${db(a.peak).toFixed(1).padStart(6)}  ${db(a.win).toFixed(1).padStart(9)}   ${a.E.toFixed(4).padStart(7)}   ${a.e120.toFixed(4)} (${(a.s120 * 100).toFixed(0).padStart(2)} %)   ${a.e300.toFixed(4)} (${(a.s300 * 100).toFixed(0).padStart(2)} %)   ${a.centroid.toFixed(0).padStart(5)} Hz`); }

function wav16(d: Float32Array): Uint8Array {
  const b = new ArrayBuffer(44 + d.length * 2), v = new DataView(b); const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
  let clipped = 0; for (let i = 0; i < d.length; i++) { const x = d[i] * OUT; if (Math.abs(x) > 1) clipped++; v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 32767, true); }
  if (clipped) console.log(`  (! ${clipped} samples clipped at the file's scale ${OUT})`);
  return new Uint8Array(b);
}
const dir = process.argv[2];
if (dir) {
  const D = resolve(dir); mkdirSync(D, { recursive: true });
  const files: Record<string, Float32Array> = {
    'wall-charge-2m.wav': wallAt(2), 'wall-charge-8m.wav': wallAt(8), 'wall-charge-20m.wav': wallAt(20),
    'stun-bang-2m.wav': scaled(buf('stunBang'), law(2)),
    'layer-wallCrack.wav': buf('wallCrack'), 'layer-wallThump.wav': buf('wallThump'), 'layer-wallDebris.wav': buf('wallDebris'),
    // one file to play on a phone: before (the can's report), then after at 2 m, 8 m and 20 m, then three carbine rounds and the charge at 8 m for scale against gunfire
    'compare-before-then-after.wav': seq([scaled(buf('stunBang'), law(2)), wallAt(2), wallAt(8), wallAt(20), seq([scaled(buf('carbineReport'), law(8)), scaled(buf('carbineReport'), law(8)), scaled(buf('carbineReport'), law(8))], 0.12), wallAt(8)]),
  };
  for (const [n, d] of Object.entries(files)) writeFileSync(resolve(D, n), wav16(d));
  console.log(`\nwrote ${Object.keys(files).length} WAVs to ${D} (16-bit mono ${SR} Hz, every file × ${OUT}; compare-before-then-after.wav = the can at 2 m · the charge at 2 m · 8 m · 20 m · three carbine rounds at 8 m · the charge at 8 m)`);
}
