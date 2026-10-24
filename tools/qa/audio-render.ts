// Offline render of the synthesized SFX table (src/audio/sfx.ts) under Bun — no WebAudio needed: buildSfx only asks its context for `sampleRate` and
// `createBuffer`, so a two-method shim stands in for the AudioContext and every voice renders into a Float32Array exactly as it does in the page.
// What it is for: the hold's voices (grabScuffle, chokeStrain, chokeLimp, whipThud, shove, murmur, heldProtest) were written blind; this grades them
// STRUCTURALLY — duration, peak, loudest-50-ms RMS, DC, NaN / clipping, tail level, where the energy sits (low / mid / high thirds and the spectral
// centroid of the loudest window), and their level IN THE GAME (window RMS × the gain player.ts plays them at) beside the references everybody knows by
// ear: the takedown's bodyHit at 0.55, bodyFall, a footstep, the drag's propScrape. Plus the one property the choke depends on: grains of chokeStrain
// retriggered every 0.4 s must overlap-add into one continuous strained sound (no holes between grains deeper than the tremor itself).
//   bun run tools/qa/audio-render.ts                # the hold's voices + references, PASS / FAIL, exit 1 on a failed check
//   bun run tools/qa/audio-render.ts --all          # every voice in the table
//   bun run tools/qa/audio-render.ts --sr 44100     # at another context rate (the one-pole coefficients are per sample: timbres shift a little with it)
//   bun run tools/qa/audio-render.ts --wav <dir>    # also write 16-bit mono WAVs there: one per voice rendered, plus hold_sequence.wav — the whole hold in
//                                                   # order at the game's gains (grab, his first muffle, a question and answer, a choke eased off, a choke
//                                                   # through to the fold, the whip, the shove) for auditioning outside the game
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';

const ROOT = resolve(import.meta.dir, '../..');
const { buildSfx } = await import(`${ROOT}/src/audio/sfx.ts`);

const args = process.argv.slice(2);
const srI = args.indexOf('--sr'); const SR = srI >= 0 ? Number(args[srI + 1]) || 48000 : 48000;
/** the two things buildSfx touches on a BaseAudioContext */
const shim = {
  sampleRate: SR,
  createBuffer(channels: number, n: number, sr: number) {
    const chans = Array.from({ length: channels }, () => new Float32Array(n));
    return { sampleRate: sr, length: n, duration: n / sr, numberOfChannels: channels, getChannelData: (c: number) => chans[c] };
  },
};

const ALL = args.includes('--all');
const wavI = args.indexOf('--wav'); const WAV_DIR = wavI >= 0 ? resolve(args[wavI + 1] ?? '.') : null;

/** the gains player.ts plays the hold's voices at, and the references' usual gains (player.ts / game.ts call sites) */
const GAME_GAIN: Record<string, number> = {
  grabScuffle: 0.4, grabCatch: 0.5, gunStrip: 0.45, gunDown: 0.4, chokeStrain: 0.25, chokeLimp: 0.35, whipThud: 0.7, shove: 0.55, murmur: 0.2, heldProtest: 0.18,
  bodyHit: 0.55 /* the takedown */, bodyFall: 0.6 /* a ragdoll meeting the floor, mid-weight hit */, propScrape: 0.25 /* the drag */, footSoft: 0.55 /* Sam walking */, doorLatch: 0.6, radio: 0.6,
};
/** what each new voice was asked to be: duration window (s) and where its energy should sit */
const SPEC: Record<string, { dur: [number, number]; note: string }> = {
  grabScuffle: { dur: [0.25, 0.4], note: 'cloth rustle + choked gasp, 120–200 ms of bursts' },
  chokeStrain: { dur: [0.5, 0.7], note: 'one grain of pressed, creaky strain, slow tremolo; retriggered every 0.4 s' },
  chokeLimp: { dur: [0.6, 0.9], note: 'exhale + cloth slump, no floor hit' },
  whipThud: { dur: [0.25, 0.4], note: 'the blow (low, dead) + a dull knock + the slide answering + cloth; the loudest' },
  shove: { dur: [0.35, 0.5], note: 'cloth burst + foot scuff' },
  murmur: { dur: [0.2, 0.32], note: "Sam's question: three quiet breathy syllables, ~250 ms" },
  heldProtest: { dur: [0.7, 0.9], note: 'muffled syllables, starting 0.3 s in' },
  grabCatch: { dur: [0.26, 0.34], note: 'the grab, beat one (his pick): the forearm dragged over his collar, a soft bump, his breath pinched off' },
  gunStrip: { dur: [0.13, 0.2], note: 'beat two, 0.25 s on (his pick): one snap and one click, nothing between them (also at rate 0.8)' },
  gunDown: { dur: [0.26, 0.34], note: 'beat three, 0.70 s on: one dull knock on the floor and a short settle (also at rate 0.8)' },
};
const NEW = Object.keys(SPEC);   // (the hold's seven, and the grab's three beats)
const REFS = ['bodyHit', 'bodyFall', 'propScrape', 'footSoft', 'doorLatch', 'radio'];

// ---------------------------------------------------------------- analysis
const db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -180);
function fft(re: Float64Array, im: Float64Array) {   // in-place radix-2
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len; const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const ar = re[i + k], ai = im[i + k]; const br = re[i + k + len / 2] * cr - im[i + k + len / 2] * ci, bi = re[i + k + len / 2] * ci + im[i + k + len / 2] * cr;
        re[i + k] = ar + br; im[i + k] = ai + bi; re[i + k + len / 2] = ar - br; im[i + k + len / 2] = ai - bi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
}
interface Metrics { dur: number; peak: number; rms: number; winRms: number; winAt: number; dc: number; nan: number; clipped: number; tail: number; centroid: number; low: number; mid: number; high: number; onset: number; }
function analyse(d: Float32Array, sr: number): Metrics {
  let peak = 0, sum2 = 0, sum = 0, nan = 0, clipped = 0;
  for (let i = 0; i < d.length; i++) { const x = d[i]; if (!Number.isFinite(x)) { nan++; continue; } peak = Math.max(peak, Math.abs(x)); sum2 += x * x; sum += x; if (Math.abs(x) >= 0.999) clipped++; }
  // loudest 50 ms window (hop 5 ms)
  const W = Math.round(0.05 * sr), hop = Math.round(0.005 * sr); let winRms = 0, winAt = 0;
  for (let s = 0; s + W <= d.length; s += hop) { let e = 0; for (let i = s; i < s + W; i++) e += d[i] * d[i]; const r = Math.sqrt(e / W); if (r > winRms) { winRms = r; winAt = s / sr; } }
  if (d.length < W) winRms = Math.sqrt(sum2 / d.length);
  // first sample above 2 % of peak = onset (a voice with built-in lead silence shows it here)
  let onset = 0; for (let i = 0; i < d.length; i++) if (Math.abs(d[i]) > 0.02 * peak) { onset = i / sr; break; }
  // tail: peak over the last 5 ms
  let tail = 0; for (let i = Math.max(0, d.length - Math.round(0.005 * sr)); i < d.length; i++) tail = Math.max(tail, Math.abs(d[i]));
  // spectrum of the loudest 4096-sample window (Hann)
  const N = 4096; const s0 = Math.min(Math.max(0, Math.round(winAt * sr) - N / 4), Math.max(0, d.length - N));
  const re = new Float64Array(N), im = new Float64Array(N);
  for (let i = 0; i < N; i++) { const x = s0 + i < d.length ? d[s0 + i] : 0; re[i] = x * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (N - 1))); }
  fft(re, im);
  let num = 0, den = 0, low = 0, mid = 0, high = 0;
  for (let k = 1; k < N / 2; k++) { const f = k * sr / N; const p = re[k] * re[k] + im[k] * im[k]; num += f * p; den += p; if (f < 300) low += p; else if (f < 2000) mid += p; else high += p; }
  const tot = low + mid + high || 1;
  return { dur: d.length / sr, peak, rms: Math.sqrt(sum2 / d.length), winRms, winAt, dc: sum / d.length, nan, clipped, tail, centroid: den > 0 ? num / den : 0, low: low / tot, mid: mid / tot, high: high / tot, onset };
}

// ---------------------------------------------------------------- render
const t0 = performance.now();
const table: Record<string, { getChannelData(c: number): Float32Array; duration: number }> = buildSfx(shim as any);
const buildMs = performance.now() - t0;
const names = ALL ? Object.keys(table) : [...NEW, ...REFS];
const M: Record<string, Metrics> = {};
for (const n of names) { const b = table[n]; if (!b) { console.log(`✗ ${n}: not in the table`); process.exit(1); } M[n] = analyse(b.getChannelData(0), SR); }

const fails: string[] = [];
const takedownLevel = M.bodyHit ? M.bodyHit.winRms * GAME_GAIN.bodyHit : 1;
console.log(`\n=== audio-render: ${Object.keys(table).length} voices built in ${buildMs.toFixed(0)} ms at ${SR} Hz (offline shim of the AudioContext) ===`);
console.log('name            dur    peak   dBpk  win50ms(dB) @s     DC      tail   onset  centroid  low/mid/high      ×gain → in-game (dB re takedown)   spec');
for (const n of names) {
  const m = M[n]; const g = GAME_GAIN[n] ?? 1; const lvl = m.winRms * g; const rel = db(lvl / takedownLevel);
  const spec = SPEC[n];
  const row = `${n.padEnd(15)} ${m.dur.toFixed(2).padStart(5)}  ${m.peak.toFixed(3)}  ${db(m.peak).toFixed(1).padStart(5)}  ${db(m.winRms).toFixed(1).padStart(6)}  ${m.winAt.toFixed(2).padStart(5)}  ${m.dc.toFixed(4).padStart(7)}  ${m.tail.toFixed(3)}  ${m.onset.toFixed(2).padStart(5)}  ${m.centroid.toFixed(0).padStart(6)} Hz  ${(m.low * 100).toFixed(0).padStart(3)}/${(m.mid * 100).toFixed(0).padStart(3)}/${(m.high * 100).toFixed(0).padStart(3)} %   ×${g.toFixed(2)} → ${db(lvl).toFixed(1).padStart(6)} (${(rel >= 0 ? '+' : '') + rel.toFixed(1)})   ${spec ? spec.note : '(reference)'}`;
  console.log(row);
  // checks: finite everywhere; the NEW voices inside [-1, 1] with no DC to speak of, ending quiet, the length asked for (a reference over full scale is only noted —
  // bodyFall grazes it at 44.1 kHz and always has; the gain node after the source scales it, nothing clips)
  if (m.nan) fails.push(`${n}: ${m.nan} non-finite samples`);
  if (spec) {
    if (m.peak > 1.0001 || m.clipped > 0) fails.push(`${n}: peak ${m.peak.toFixed(3)}, ${m.clipped} samples at full scale`);
    if (Math.abs(m.dc) > 0.02) fails.push(`${n}: DC offset ${m.dc.toFixed(4)}`);
    if (m.tail > 0.03) fails.push(`${n}: ends at ${m.tail.toFixed(3)} (a click at the cut)`);
    if (m.dur < spec.dur[0] || m.dur > spec.dur[1]) fails.push(`${n}: duration ${m.dur.toFixed(2)} s outside ${spec.dur[0]}–${spec.dur[1]}`);
    if (m.peak < 0.15) fails.push(`${n}: peak only ${m.peak.toFixed(3)} — inaudible next to the references`);
  } else if (m.peak > 1.0001) console.log(`  (note: reference ${n} peaks at ${m.peak.toFixed(3)} at this rate)`);
}
// per-voice intent checks (the recipe doing what it says)
{
  const w = M.whipThud, s = M.grabScuffle, c = M.chokeStrain, l = M.chokeLimp, sh = M.shove, mu = M.murmur, hp = M.heldProtest;
  const lvl = (n: string) => M[n].winRms * (GAME_GAIN[n] ?? 1);
  if (!(lvl('whipThud') > lvl('grabScuffle') && lvl('whipThud') > lvl('shove') && lvl('whipThud') > lvl('chokeLimp'))) fails.push('whipThud is not the loudest of the hold\'s voices in-game');
  if (db(lvl('whipThud') / takedownLevel) < -3) fails.push(`whipThud sits ${db(lvl('whipThud') / takedownLevel).toFixed(1)} dB under the takedown's thud (want at least as loud: WHIP_NOISE is the loudest hold event)`);
  if (db(lvl('murmur') / takedownLevel) > -12) fails.push(`murmur only ${db(lvl('murmur') / takedownLevel).toFixed(1)} dB under the takedown (want ≤ −12: under his breath)`);
  if (db(lvl('heldProtest') / takedownLevel) > -10) fails.push(`heldProtest only ${db(lvl('heldProtest') / takedownLevel).toFixed(1)} dB under the takedown (want ≤ −10: muffled)`);
  if (db(lvl('chokeStrain') / takedownLevel) > -8) fails.push(`chokeStrain only ${db(lvl('chokeStrain') / takedownLevel).toFixed(1)} dB under the takedown (want ≤ −8: it runs for 2.6 s)`);
  if (w.low < 0.35) fails.push(`whipThud: only ${(w.low * 100).toFixed(0)} % of its energy under 300 Hz (want the thump to carry it)`);
  if (mu.high > 0.35) fails.push(`murmur: ${(mu.high * 100).toFixed(0)} % of its energy above 2 kHz (want a low murmur, not hiss)`);
  if (hp.onset < 0.28 || hp.onset > 0.36) fails.push(`heldProtest starts at ${hp.onset.toFixed(2)} s (want its 0.3 s lead)`);
  if (hp.centroid > 900) fails.push(`heldProtest centroid ${hp.centroid.toFixed(0)} Hz (want muffled: < 900)`);
  if (c.centroid > 1800) fails.push(`chokeStrain centroid ${c.centroid.toFixed(0)} Hz (want low / throttled: < 1800)`);
  if (s.dur - s.onset < 0.2) fails.push('grabScuffle: less than 200 ms of sound');
  if (l.low + l.mid < 0.4) fails.push(`chokeLimp: ${((l.low + l.mid) * 100).toFixed(0)} % under 2 kHz (want breath AND body in it)`);
  void sh;
  // the grab's three beats AS THE MAINTAINER PICKED THEM BY EAR (10-24; the lines below hold his picks' character, where they held the first takes'): cloth
  // and a soft bump, a snap and a click, a dull knock — the catch about as loud as the scuffle it stands in for and under the whip, the knock landing once
  const gc = M.grabCatch, gs = M.gunStrip, gd = M.gunDown;
  if (!(Math.abs(db(lvl('grabCatch')) - db(lvl('grabScuffle'))) <= 4 && lvl('grabCatch') < lvl('whipThud'))) fails.push(`grabCatch in-game ${db(lvl('grabCatch')).toFixed(1)} dB is not within 4 dB of the scuffle's ${db(lvl('grabScuffle')).toFixed(1)} and under the whip's ${db(lvl('whipThud')).toFixed(1)}`);
  if (!(lvl('gunStrip') < lvl('grabCatch') && lvl('gunDown') < lvl('grabCatch'))) fails.push('the strip or the gun let down is louder in-game than the catch');
  if (gc.high < 0.3 || gc.mid < 0.2 || gc.centroid > 4000 || gc.low < 0.04) fails.push(`grabCatch: centroid ${gc.centroid.toFixed(0)} Hz, ${(gc.low * 100).toFixed(0)} % low, ${(gc.mid * 100).toFixed(0)} % in the middle and ${(gc.high * 100).toFixed(0)} % above 2 kHz (want more sleeve than thump, with the bump still under it: 4 % or more in the low band)`);
  if (gc.winAt > 0.04 || gd.winAt > 0.02) fails.push(`the catch's loudest 50 ms starts at ${gc.winAt.toFixed(2)} s and the knock's at ${gd.winAt.toFixed(2)} s (want each on its beat: at the buffer's start)`);
  if (gs.centroid < 2 * gd.centroid || gs.low > 0.1 || gs.mid < 0.6) fails.push(`gunStrip centroid ${gs.centroid.toFixed(0)} Hz against the knock's ${gd.centroid.toFixed(0)}, ${(gs.mid * 100).toFixed(0)} % in the middle (want a dry snap, harder than the knock that follows it and with no weight under it)`);
  if (gd.centroid > 1200 || gd.high > 0.15) fails.push(`gunDown: centroid ${gd.centroid.toFixed(0)} Hz, ${(gd.high * 100).toFixed(0)} % above 2 kHz (want a dull knock, not a clatter)`);
}
// the choke's continuity: grains every 0.4 s at the game's gain, overlap-added; short-time RMS (20 ms) between the first grain's rise and the last one's start
{
  const g = table.chokeStrain.getChannelData(0); const GRAIN = 0.4, N_GR = 7; const total = Math.round(((N_GR - 1) * GRAIN + g.length / SR + 0.1) * SR);
  const mixd = new Float32Array(total);
  for (let k = 0; k < N_GR; k++) { const off = Math.round(k * GRAIN * SR); for (let i = 0; i < g.length && off + i < total; i++) mixd[off + i] += g[i] * GAME_GAIN.chokeStrain; }
  const hopN = Math.round(0.02 * SR); const env: number[] = [];
  for (let s = Math.round(0.12 * SR); s + hopN < Math.round((N_GR - 1) * GRAIN * SR); s += hopN) { let e = 0; for (let i = s; i < s + hopN; i++) e += mixd[i] * mixd[i]; env.push(Math.sqrt(e / hopN)); }
  const mx = Math.max(...env), mn = Math.min(...env); const spread = db(mx / Math.max(mn, 1e-9));
  let peakMix = 0; for (const x of mixd) peakMix = Math.max(peakMix, Math.abs(x));
  // where the deepest dip sits relative to the grain boundaries (a hole AT every 0.4 s = the windows do not meet)
  const iMin = env.indexOf(mn); const tMin = 0.12 + iMin * 0.02; const toBoundary = Math.min(...Array.from({ length: N_GR }, (_, k) => Math.abs(tMin - k * GRAIN)));
  console.log(`\nchokeStrain ×${N_GR} grains @ ${GRAIN} s (the full 2.6 s choke), gain ${GAME_GAIN.chokeStrain}: summed peak ${peakMix.toFixed(3)}, 20 ms envelope ${db(mn).toFixed(1)} … ${db(mx).toFixed(1)} dB → spread ${spread.toFixed(1)} dB (tremolo alone ≈ ${db(1 / 0.32).toFixed(1)} dB at 52 % depth); deepest dip at ${tMin.toFixed(2)} s, ${toBoundary.toFixed(2)} s off a grain boundary; grains per second ≤ ${Math.ceil(1 / GRAIN + 1e-9)}`);
  if (spread > 16) fails.push(`chokeStrain grains leave holes: envelope spread ${spread.toFixed(1)} dB across the sustained choke (want ≤ 16)`);
  if (peakMix > 0.6) fails.push(`chokeStrain grains pile up to ${peakMix.toFixed(2)} at gain ${GAME_GAIN.chokeStrain} (want ≤ 0.6: it should stay under the thuds)`);
  if (1 / GRAIN > 3) fails.push('more than 3 grains a second');
}

// ---------------------------------------------------------------- WAVs (optional)
function wav16(d: Float32Array, sr: number): Uint8Array {
  const out = new Uint8Array(44 + d.length * 2); const v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) { const x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, Math.round(x * 32767), true); }
  return out;
}
if (WAV_DIR) {
  mkdirSync(WAV_DIR, { recursive: true });
  for (const n of names) writeFileSync(resolve(WAV_DIR, `${n}.wav`), wav16(table[n].getChannelData(0), SR));
  // the hold in order, at the game's gains: what a player will hear in the page, minus the room (no HRTF / reverb / occlusion here)
  const cues: [number, string, number][] = [
    [0.3, 'grabCatch', GAME_GAIN.grabCatch], [0.75, 'heldProtest', GAME_GAIN.heldProtest],                       // the grab; the hold locks 0.45 s later and he makes his first sound (0.3 s into that buffer)
    [2.5, 'murmur', GAME_GAIN.murmur], [2.5, 'heldProtest', 0.2],                                                     // a question and its answer
    [5.0, 'bodyHit', 0.3],                                                                                            // the elbow closing (startChoke's own thud, rate 0.55 in the game) …
    ...Array.from({ length: 4 }, (_, k): [number, string, number] => [5.0 + k * 0.4, 'chokeStrain', GAME_GAIN.chokeStrain]),   // … 1.5 s of choke …
    [6.55, 'propScrape', 0.1],                                                                                        // … eased off (the game plays this cloth at rate 2.2)
    [8.5, 'bodyHit', 0.3], ...Array.from({ length: 7 }, (_, k): [number, string, number] => [8.5 + k * 0.4, 'chokeStrain', GAME_GAIN.chokeStrain]),   // the full choke: 7 grains over 2.6 s …
    [11.1, 'chokeLimp', GAME_GAIN.chokeLimp], [11.9, 'bodyFall', 0.5],                                                // … the fold, and the ragdoll meeting the floor a moment later
    [14.0, 'propScrape', 0.12], [14.6, 'whipThud', GAME_GAIN.whipThud], [15.3, 'bodyFall', 0.55],                     // the whip: the sleeve going back (rate 2.6 in the game), the blow 0.6 s later, the fall
    [17.5, 'shove', GAME_GAIN.shove],                                                                                 // the release
  ];
  const len = Math.round(19 * SR); const seq = new Float32Array(len);
  for (const [at, n, g] of cues) { const d = table[n].getChannelData(0); const off = Math.round(at * SR); for (let i = 0; i < d.length && off + i < len; i++) seq[off + i] += d[i] * g; }
  let pk = 0; for (const x of seq) pk = Math.max(pk, Math.abs(x)); if (pk > 1) for (let i = 0; i < len; i++) seq[i] /= pk;
  writeFileSync(resolve(WAV_DIR, 'hold_sequence.wav'), wav16(seq, SR));
  console.log(`\nwrote ${names.length} voice WAVs + hold_sequence.wav (19 s: grab 0.3 · first muffle · question+answer 2.5 · choke 5.0 eased off 6.5 · choke 8.5 → limp 11.1 → floor · whip 14.6 · shove 17.5) to ${WAV_DIR}`);
}

console.log(fails.length ? `\n✗ ${fails.join('\n✗ ')}\n=== audio-render: FAIL ===` : '\n=== audio-render: PASS ===');
process.exit(fails.length ? 1 : 0);
