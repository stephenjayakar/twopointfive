// THE GRAB'S THREE VOICES AS FILES AND NUMBERS (src/audio/sfx.ts grabCatch / gunStrip / gunDown and their other takes in src/audio/sfxAlt.ts), for listening to
// outside the game and for judging where nobody can listen. No browser: the table renders into plain Float32Arrays (audio/backend.ts sfxContext), a rate is a
// linear resample (what a buffer source's playbackRate does), a mix is a sum at the game's gains with no room on it (no distance, no reverb, no occlusion).
//   bun run tools/qa/grab-sounds-render.ts [outDir] [--shape]
//     outDir   48 kHz mono 16-bit WAVs written there: each take alone at its game gain (catch|strip|down-game|new1|new2.wav; a take he picked is the `game` file and has none of its own), grab-old.wav (what the grab was:
//              the scuffle, the knocked-out pistol's borrowed magazine drop, his muffled protest), grab-new-pistol.wav and grab-new-carbine.wav (catch at 0, strip
//              at 0.25 s, the protest at 0.47, the gun down at 0.70, read off the listening page's row, which grabvoice-check.ts ties to the game; the carbine = strip and down at rate 0.8)
//     --shape  each take's envelope too, 10 ms a column (dB under its own peak, a digit per 6 dB: 0 = within 6 dB of the peak, 9 = 54 dB under or more)
//   exit 0 = every take rendered finite, unclipped and no mix went over full scale; 1 otherwise
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { gameSfx } from '../../src/audio/audio';
import { altPicked, altSay, altTake, altTakes } from '../../src/audio/sfxAlt';
import { sfxContext, type SfxBuffer } from '../../src/audio/backend';
import { heard, loudest } from '../../src/audio/synth';
import { SOUNDS } from '../../src/sounds/catalog';

const SR = 48000, ctx = sfxContext(SR);
const args = process.argv.slice(2), SHAPE = args.includes('--shape'), OUT = args.find(a => !a.startsWith('--')) ?? null;
/** the gains and times the grab plays them at (seconds after the catch) and the carbine's rate on the two that are the gun: the listening page's own 'whole grab'
 *  rows (sounds/catalog.ts), which tools/qa/grabvoice-check.ts holds to the game's beats */
const WHOLE = SOUNDS.grabCatch.also!, cueOf = (n: string) => { const l = WHOLE[0].plus!.find(x => x.name === n)!; return { name: n, gain: l.gain, at: l.after ?? 0 }; };
const GRAB = { catch: { name: 'grabCatch', gain: SOUNDS.grabCatch.gain, at: 0 }, strip: cueOf('gunStrip'), down: cueOf('gunDown'), protest: cueOf('heldProtest'), carbine: WHOLE[1].plus!.find(x => x.name === 'gunStrip')!.rate ?? 1 };
/** about what the grab was (the knocked-out gun was thrown on the dice: when and how hard it landed differed from grab to grab) */
const OLD: [name: string, gain: number, rate: number, at: number][] = [['grabScuffle', 0.4, 1, 0], ['heldProtest', 0.18, 1, 0.47], ['magDrop', 0.5, 0.72, 0.6], ['magDrop', 0.15, 0.72, 0.78]];

const table = gameSfx(ctx) as Record<string, SfxBuffer>;
const data = (b: SfxBuffer) => b.getChannelData(0);
/** x as a source played at `rate` hears it: 1 / rate as long, everything in it that much lower */
function atRate(x: Float32Array, rate: number): Float32Array {
  if (rate === 1) return x;
  const n = Math.floor((x.length - 1) / rate) + 1, y = new Float32Array(n);
  for (let i = 0; i < n; i++) { const p = i * rate, k = Math.floor(p), f = p - k; y[i] = x[k] * (1 - f) + (x[k + 1] ?? 0) * f; }
  return y;
}
function mix(cues: [x: Float32Array, gain: number, rate: number, at: number][]): Float32Array {
  const parts = cues.map(([x, g, r, at]) => ({ y: atRate(x, r), g, off: Math.round(at * SR) }));
  const out = new Float32Array(Math.max(...parts.map(p => p.off + p.y.length)) + Math.round(0.05 * SR));
  for (const p of parts) for (let i = 0; i < p.y.length; i++) out[p.off + i] += p.y[i] * p.g;
  return out;
}
function wav16(d: Float32Array): Uint8Array {
  const out = new Uint8Array(44 + d.length * 2), v = new DataView(out.buffer), str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, SR, true); v.setUint32(28, SR * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) v.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, d[i])) * 32767), true);
  return out;
}
function fft(re: Float64Array, im: Float64Array) {   // in place, radix 2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), x = i + k, y = x + len / 2;
      const tr = re[y] * c - im[y] * s, ti = re[y] * s + im[y] * c; re[y] = re[x] - tr; im[y] = im[x] - ti; re[x] += tr; im[x] += ti; } }
}
const db = (x: number) => x > 1e-9 ? 20 * Math.log10(x) : -180;
/** a whole buffer measured: its spectrum is the whole of it (zero-padded), not its loudest window */
function read(x: Float32Array) {
  let pk = 0, e = 0, fin = true; for (const s of x) { if (!Number.isFinite(s)) fin = false; const m = Math.abs(s); if (m > pk) pk = m; e += s * s; }
  let N = 1; while (N < x.length) N <<= 1; const re = new Float64Array(N), im = new Float64Array(N); re.set(x); fft(re, im);
  let num = 0, den = 0, u500 = 0, mid = 0, top = 0;
  for (let k = 1; k < N / 2; k++) { const f = k * SR / N, p = re[k] * re[k] + im[k] * im[k]; num += f * p; den += p; if (f < 500) u500 += p; if (f >= 100 && f < 500) mid += p; if (f >= 2000) top += p; }
  // when it lands: the 5 ms it is loudest in
  const W = Math.round(0.005 * SR); let best = 0, bestAt = 0; for (let a = 0; a + W <= x.length; a += W) { let q = 0; for (let i = a; i < a + W; i++) q += x[i] * x[i]; if (q > best) { best = q; bestAt = a / SR; } }
  return { secs: x.length / SR, pk, fin, rms: Math.sqrt(e / Math.max(1, x.length)), loud: loudest(x, SR), heard: heard(x, SR), centroid: den ? num / den : 0, u500: den ? u500 / den : 0, mid: den ? mid / den : 0, top: den ? top / den : 0, bestAt };
}
function shape(x: Float32Array): string {
  const W = Math.round(0.01 * SR), e: number[] = []; for (let a = 0; a < x.length; a += W) { let q = 0, n = 0; for (let i = a; i < Math.min(x.length, a + W); i++) { q += x[i] * x[i]; n++; } e.push(Math.sqrt(q / Math.max(1, n))); }
  const top = Math.max(...e, 1e-9); return e.map(v => String(Math.min(9, Math.floor(-db(v / top) / 6)))).join('');
}

let bad = 0; const files: [string, Float32Array][] = [];
console.log(`=== the grab's voices at ${SR} Hz: each take as rendered (its file = × the game's gain) ===`);
console.log('take          length   peak    RMS (dB)   loudest 50 ms (dB)  heard   centroid   under 500 Hz  100-500 Hz  over 2 kHz  loudest at   × gain → peak in the game');
for (const [short, row] of [['catch', GRAB.catch], ['strip', GRAB.strip], ['down', GRAB.down]] as const) {
  const takes: [string, Float32Array | null, string][] = [['game', table[row.name] ? data(table[row.name]) : null, "the game's own"]];
  for (let k = 0; k < altTakes(row.name); k++) { if (altPicked(row.name, k)) continue;   // (a take he picked is the game's own row now)
    const b = altTake(ctx, row.name, k); takes.push([`new${k + 1}`, b ? data(b) : null, altSay(row.name, k)]); }
  for (const [take, x, say] of takes) {
    if (!x) { console.log(`${short}-${take}: NOT RENDERED`); bad++; continue; }
    const r = read(x); if (!r.fin || r.pk > 1 || r.pk < 0.05) bad++;
    console.log(`${`${short}-${take}`.padEnd(12)} ${r.secs.toFixed(3)} s  ${r.pk.toFixed(3)}  ${r.rms.toFixed(4)} (${db(r.rms).toFixed(1)})  ${r.loud.toFixed(3)} (${db(r.loud).toFixed(1)})      ${r.heard.toFixed(3)}  ${r.centroid.toFixed(0).padStart(5)} Hz   ${(r.u500 * 100).toFixed(0).padStart(3)} %         ${(r.mid * 100).toFixed(0).padStart(3)} %       ${(r.top * 100).toFixed(0).padStart(3)} %      ${r.bestAt.toFixed(3)} s     × ${row.gain} → ${(r.pk * row.gain).toFixed(3)}   ${say}`);
    if (SHAPE) console.log(`             ${shape(x)}`);
    files.push([`${short}-${take}.wav`, x.map(s => s * row.gain)]);
  }
}
const one = (n: string) => data(table[n]);
const seqs: [string, Float32Array, string][] = [
  ['grab-old.wav', mix(OLD.map(([n, g, r, at]) => [one(n), g, r, at])), OLD.map(([n, g, r, at]) => `${n} × ${g}${r !== 1 ? ` at rate ${r}` : ''} at ${at} s`).join(' · ')],
  ...([['pistol', 1], ['carbine', GRAB.carbine]] as const).map(([gun, rate]): [string, Float32Array, string] => [`grab-new-${gun}.wav`,
    mix([[one(GRAB.catch.name), GRAB.catch.gain, 1, GRAB.catch.at], [one(GRAB.strip.name), GRAB.strip.gain, rate, GRAB.strip.at], [one(GRAB.protest.name), GRAB.protest.gain, 1, GRAB.protest.at], [one(GRAB.down.name), GRAB.down.gain, rate, GRAB.down.at]]),
    `grabCatch × ${GRAB.catch.gain} at 0 · gunStrip × ${GRAB.strip.gain} at ${GRAB.strip.at} s · heldProtest × ${GRAB.protest.gain} at ${GRAB.protest.at} s · gunDown × ${GRAB.down.gain} at ${GRAB.down.at} s${rate !== 1 ? ` · strip and down at rate ${rate}` : ''}`]),
];
console.log('\n=== the grab in order, at the game\'s gains, no room on it ===');
for (const [file, x, say] of seqs) { const r = read(x); if (!r.fin || r.pk > 1) bad++;
  console.log(`${file.padEnd(22)} ${r.secs.toFixed(2)} s  peak ${r.pk.toFixed(3)}  RMS ${db(r.rms).toFixed(1)} dB  loudest 50 ms ${db(r.loud).toFixed(1)} dB   ${say}`);
  if (SHAPE) console.log(`  ${shape(x)}`);
  files.push([file, x]); }
if (OUT) { const dir = resolve(OUT); mkdirSync(dir, { recursive: true }); for (const [f, x] of files) writeFileSync(resolve(dir, f), wav16(x)); console.log(`\nwrote ${files.length} files (${SR} Hz, mono, 16 bit) to ${dir}`); }
console.log(bad ? `=== grab-sounds-render: ${bad} FAILED ===` : '=== grab-sounds-render: ALL RENDERED ===');
process.exit(bad ? 1 : 0);
