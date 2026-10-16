// WHAT A GLASS-TUNE SCENE SOUNDED LIKE, OFFLINE — a dry mix of its `audio[]` log (tools/qa/glass-tune.ts writes <tag>.<scene>.json; every sound the scene played:
// {t, name, gain, rate, d}). The synthesized SFX table (src/audio/sfx.ts buildSfx) is rendered under Bun the way tools/qa/audio-render.ts does it — buildSfx only asks
// its context for a rate and a buffer factory, so audio/backend.ts's plain stand-in serves — and each log entry is laid in at its time `t`, scaled by `gain` and by a
// plain distance roll-off 1 ∕ max(1, d ∕ 2), resampled by `rate` (linear interpolation). Mono, the table's rate.
//
//   bun run tools/qa/glass-mix.ts --in DIR --tag r0 --scene tempered-rifle-one[,…] --out DIR [--sr 48000] [--raw]
//
// Per scene: <out>/<tag>.<scene>.wav (16-bit mono; scaled down ONLY when the peak would clip — the stats say by how much), <tag>.<scene>.mix.json (peak, RMS, crest
// factor, the fraction of samples that would have clipped, the most voices sounding at once and when — a voice lasts its buffer ÷ rate —, the busiest 100 ms of sound
// STARTS, counts per sfx, names the table does not have) and <tag>.<scene>.mix.svg (the RMS envelope in 10 ms windows over a tick row of the sound starts). A table row
// per scene on stdout.
// THIS IS A DRY MIX: no occlusion, no reverb, no panning / HRTF, no voice cap or stealing, none of the mixer's bus gains — it is for hearing the density and the rhythm
// of the glass, not the game's level. An old file without `rate` / `d` plays every sound at rate 1 from 2 m (roll-off 1). The staging's own noise (the names
// glass-tune.ts filters itself since the newer format: parked men, the furniture Sam was teleported into) is left out of old files unless --raw; the JSON lists it.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { gameSfx } from '../../src/audio/audio.ts';   // (the table the game plays: the redone one with the voices picked as better before laid over)
import { sfxContext } from '../../src/audio/backend.ts';

const argv = process.argv.slice(2);
const arg = (k: string, d: string | null = null) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const IN = arg('--in'), OUT = arg('--out'), TAG = arg('--tag'), SCENES = (arg('--scene', '') as string).split(',').filter(Boolean);
if (!IN || !OUT || !TAG || !SCENES.length) { console.error('usage: bun run tools/qa/glass-mix.ts --in DIR --tag r0 --scene tempered-rifle-one[,…] --out DIR [--sr 48000] [--raw]'); process.exit(2); }
const SR = Number(arg('--sr', '48000')) || 48000; const RAW = argv.includes('--raw');
const NOT_GLASS = /^(footstep|heldProtest|propScrape|propThud|click|magDrop|earRing)$/;   // glass-tune.ts's own list
const db = (x: number) => (x > 1e-9 ? 20 * Math.log10(x) : -180);

const table = gameSfx(sfxContext(SR) as never) as Record<string, { getChannelData(c: number): Float32Array; length: number } | undefined>;

function wav16(d: Float32Array, sr: number): Uint8Array {
  const out = new Uint8Array(44 + d.length * 2); const v = new DataView(out.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); v.setUint32(4, 36 + d.length * 2, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, d.length * 2, true);
  for (let i = 0; i < d.length; i++) { const x = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, Math.round(x * 32767), true); }
  return out;
}

interface Voice { t: number; name: string; gain: number; rate: number; d: number; amp: number; dur: number }
function mixScene(id: string) {
  const p = resolve(IN!, `${TAG}.${id}.json`); if (!existsSync(p)) { console.error(`  ! ${p}: not there — skipped`); return null; }
  const j = JSON.parse(readFileSync(p, 'utf8')); const log: any[] = Array.isArray(j.audio) ? j.audio : []; const rows: any[] = Array.isArray(j.rows) ? j.rows : [];
  const missing: Record<string, number> = {}, dropped: Record<string, number> = {}, counts: Record<string, number> = {}; const voices: Voice[] = [];
  for (const a of log) {
    if (!a || typeof a.name !== 'string' || !Number.isFinite(a.t)) continue;
    if (!RAW && NOT_GLASS.test(a.name)) { dropped[a.name] = (dropped[a.name] ?? 0) + 1; continue; }
    const buf = table[a.name]; if (!buf) { missing[a.name] = (missing[a.name] ?? 0) + 1; continue; }
    const gain = Number.isFinite(a.gain) ? a.gain : 1, rate = Number.isFinite(a.rate) && a.rate > 0 ? a.rate : 1, d = Number.isFinite(a.d) ? a.d : 2;
    voices.push({ t: Math.max(0, a.t), name: a.name, gain, rate, d, amp: gain / Math.max(1, d / 2), dur: buf.length / SR / rate }); counts[a.name] = (counts[a.name] ?? 0) + 1;
  }
  voices.sort((a, b) => a.t - b.t);
  const secs = Math.max(rows.length ? rows[rows.length - 1].t ?? 0 : 0, ...voices.map(v => v.t + v.dur), 0.1) + 0.05;
  const N = Math.ceil(secs * SR); const mix = new Float32Array(N);
  for (const v of voices) {
    const src = table[v.name]!.getChannelData(0); const off = Math.round(v.t * SR); const n = Math.floor((src.length - 1) / v.rate);
    for (let i = 0; i <= n && off + i < N; i++) { const x = i * v.rate; const k = Math.floor(x); const f = x - k; const s = k + 1 < src.length ? src[k] * (1 - f) + src[k + 1] * f : src[k]; mix[off + i] += s * v.amp; }
  }
  // the numbers, before any normalisation
  let peak = 0, sum2 = 0, over = 0, peakAt = 0;
  for (let i = 0; i < N; i++) { const x = Math.abs(mix[i]); if (x > peak) { peak = x; peakAt = i / SR; } sum2 += x * x; if (x > 1) over++; }
  const rms = Math.sqrt(sum2 / N);
  // the most voices at once (ends before starts at a tie)
  const edges: [number, number][] = []; for (const v of voices) edges.push([v.t, 1], [v.t + v.dur, -1]); edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0, maxVoices = 0, maxAt = 0; for (const [t, k] of edges) { cur += k; if (cur > maxVoices) { maxVoices = cur; maxAt = t; } }
  // the busiest 100 ms of starts (a window opening on a start)
  let busy = { from: 0, n: 0, names: {} as Record<string, number> };
  for (let i = 0, k = 0; i < voices.length; i++) { while (k < voices.length && voices[k].t < voices[i].t + 0.1) k++; if (k - i > busy.n) { const names: Record<string, number> = {}; for (let q = i; q < k; q++) names[voices[q].name] = (names[voices[q].name] ?? 0) + 1; busy = { from: voices[i].t, n: k - i, names }; } }
  const env: number[] = []; const hop = Math.round(0.01 * SR);   // RMS in 10 ms windows, of the mix as summed
  for (let s = 0; s < N; s += hop) { let e = 0; const end = Math.min(N, s + hop); for (let i = s; i < end; i++) e += mix[i] * mix[i]; env.push(Math.sqrt(e / (end - s))); }
  const scale = peak > 1 ? 0.999 / peak : 1; const outBuf = scale === 1 ? mix : mix.map(x => x * scale);
  const r3 = (x: number) => +x.toFixed(4);
  const stats = {
    tag: TAG, scene: id, sampleRate: SR, seconds: r3(N / SR), sounds: voices.length, dry: 'no occlusion, reverb, panning, voice cap or bus gains; amplitude = gain × 1/max(1, d/2); linear resampling by rate',
    peak: r3(peak), peakDb: +db(peak).toFixed(2), peakAt: r3(peakAt), rms: r3(rms), rmsDb: +db(rms).toFixed(2), crest: rms > 0 ? r3(peak / rms) : null, crestDb: rms > 0 ? +db(peak / rms).toFixed(2) : null,
    wouldClip: +(over / N).toFixed(6), wouldClipSamples: over, normalised: scale !== 1, normaliseGain: r3(scale), normaliseDb: +db(scale).toFixed(2),
    maxVoices, maxVoicesAt: r3(maxAt), busiest100ms: { from: r3(busy.from), starts: busy.n, names: busy.names }, counts, missing, dropped,
    defaults: { rate: log.some(a => a && !Number.isFinite(a.rate)), d: log.some(a => a && !Number.isFinite(a.d)) },
  };
  return { stats, outBuf, env, voices, secs: N / SR };
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const PALETTE = ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#7b3fa0', '#444444', '#999999'];
function envelopeSvg(m: NonNullable<ReturnType<typeof mixScene>>): string {
  const { stats: st, env, voices, secs } = m; const W = 900, x0 = 150, x1 = 880, pw = x1 - x0; const top = 76, h = 190;
  const hi = Math.max(0, Math.ceil(db(st.peak) / 6) * 6), lo = -60; const X = (t: number) => x0 + (t / secs) * pw; const Y = (d: number) => top + h - ((Math.max(lo, Math.min(hi, d)) - lo) / (hi - lo)) * h;
  const o: string[] = [];
  const text = (x: number, y: number, t: string, a = '') => `<text x="${n1(x)}" y="${n1(y)}" ${a}>${t}</text>`;
  o.push(text(12, 20, `${esc(st.tag!)} · ${esc(st.scene)} — offline mix`, 'font-size="15" font-weight="bold" fill="#1b1b1b"'));
  o.push(text(12, 36, esc(`DRY MIX: no occlusion, reverb or panning (nor the mixer's voice cap) — gain × 1/max(1, d/2), resampled by rate, mono ${st.sampleRate} Hz${st.defaults.d ? ' · old log: every sound at rate 1 from 2 m' : ''}`), 'font-size="11" fill="#666"'));
  o.push(text(12, 51, esc(`${st.sounds} sounds · peak ${st.peak.toFixed(2)} (${st.peakDb.toFixed(1)} dBFS) at ${st.peakAt.toFixed(2)} s · RMS ${st.rmsDb.toFixed(1)} dB · crest ${st.crestDb ?? '—'} dB · would clip ${(st.wouldClip * 100).toFixed(2)} % of samples${st.normalised ? ` (WAV scaled ${st.normaliseDb.toFixed(1)} dB)` : ''}`), 'font-size="11" fill="#1b1b1b"'));
  o.push(text(12, 65, esc(`≤ ${st.maxVoices} voices at ${st.maxVoicesAt.toFixed(2)} s · busiest 100 ms: ${st.busiest100ms.starts} starts from ${st.busiest100ms.from.toFixed(2)} s`), 'font-size="11" fill="#1b1b1b"'));
  const step = secs <= 3 ? 0.25 : secs <= 8 ? 0.5 : 1; const rowsTop = top + h + 26; const names = Object.keys(st.counts).sort((a, b) => (/^glass/.test(b) ? 1 : 0) - (/^glass/.test(a) ? 1 : 0) || a.localeCompare(b)); const rh = 16; const rowsH = Math.max(1, names.length) * rh;
  for (let k = 0; k * step <= secs + 1e-6; k++) { const t = k * step, xx = X(t), major = k % 2 === 0; o.push(`<line x1="${n1(xx)}" y1="${top}" x2="${n1(xx)}" y2="${top + h}" stroke="#e4e4e4" stroke-width="${major ? 0.9 : 0.5}"/>`, `<line x1="${n1(xx)}" y1="${rowsTop}" x2="${n1(xx)}" y2="${rowsTop + rowsH}" stroke="#e4e4e4" stroke-width="${major ? 0.9 : 0.5}"/>`); if (major) o.push(text(xx, rowsTop + rowsH + 14, `${+t.toFixed(2)}`, 'font-size="10" fill="#666" text-anchor="middle"')); }
  o.push(text(x1 + 4, rowsTop + rowsH + 14, 's', 'font-size="10" fill="#666"'));
  for (let d = lo; d <= hi; d += 12) o.push(`<line x1="${x0}" y1="${n1(Y(d))}" x2="${x1}" y2="${n1(Y(d))}" stroke="#e4e4e4" stroke-width="0.6"/>`, text(x0 - 6, Y(d) + 3.5, `${d}`, 'font-size="10" fill="#666" text-anchor="end"'));
  o.push(text(104, top + h / 2, 'RMS per 10 ms, dBFS', `font-size="10" fill="#666" text-anchor="middle" transform="rotate(-90 104 ${top + h / 2})"`));
  const pts = env.map((e, i) => `${n1(X(Math.min(secs, (i + 0.5) * 0.01)))},${n1(Y(db(e)))}`);
  o.push(`<polygon points="${n1(x0)},${top + h} ${pts.join(' ')} ${n1(x1)},${top + h}" fill="#0072B2" opacity="0.25"/>`, `<polyline points="${pts.join(' ')}" fill="none" stroke="#0072B2" stroke-width="1.2"/>`);
  o.push(`<line x1="${x0}" y1="${n1(Y(0))}" x2="${x1}" y2="${n1(Y(0))}" stroke="#D55E00" stroke-width="1" stroke-dasharray="5 3"/>`, text(x1 - 4, Y(0) + (hi > 0 ? 12 : 12), 'full scale (0 dBFS)', 'font-size="10" fill="#D55E00" text-anchor="end"'));
  o.push(`<rect x="${x0}" y="${top}" width="${pw}" height="${h}" fill="none" stroke="#9a9a9a" stroke-width="0.8"/>`);
  o.push(text(x0, rowsTop - 6, 'sound starts (tick height ∝ gain × roll-off)', 'font-size="11" font-weight="bold" fill="#1b1b1b"'));
  o.push(`<rect x="${x0}" y="${rowsTop}" width="${pw}" height="${rowsH}" fill="none" stroke="#9a9a9a" stroke-width="0.8"/>`);
  names.forEach((nm, i) => {
    const base = rowsTop + (i + 1) * rh - 1.5; const col = PALETTE[i % PALETTE.length];
    o.push(text(x0 - 6, base - 3, `${esc(nm)} ×${st.counts[nm]}`, `font-size="10" fill="${col}" text-anchor="end"`));
    for (const v of voices) if (v.name === nm) o.push(`<line x1="${n1(X(v.t))}" y1="${n1(base)}" x2="${n1(X(v.t))}" y2="${n1(base - Math.max(2, Math.min(1, v.amp) * (rh - 3)))}" stroke="${col}" stroke-width="1.3" opacity="0.65"/>`);
  });
  if (!names.length) o.push(text(x0 + 6, rowsTop + 12, 'no sound in the table was played', 'font-size="10" fill="#666"'));
  let H = rowsTop + rowsH + 24;
  const miss = Object.keys(st.missing); if (miss.length) { o.push(text(12, H + 4, esc(`not in the SFX table (skipped): ${miss.map(k => `${k} ×${st.missing[k]}`).join(', ')}`), 'font-size="10" fill="#D55E00"')); H += 16; }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, sans-serif">\n<rect width="${W}" height="${H}" fill="#fff"/>\n${o.join('\n')}\n</svg>\n`;
}

mkdirSync(OUT!, { recursive: true });
console.log(`glass-mix: ${Object.keys(table).length} voices built at ${SR} Hz · dry mix (no occlusion / reverb / panning)`);
console.log('scene                       sounds   peak  dBFS  would-clip  RMS dB  crest dB  max voices @ s   busiest 100 ms          WAV');
for (const id of SCENES) {
  let m: ReturnType<typeof mixScene>; try { m = mixScene(id); } catch (e) { console.error(`  ! ${id}: ${(e as Error).message}`); continue; }
  if (!m) continue; const st = m.stats; const base = resolve(OUT!, `${TAG}.${id}`);
  writeFileSync(`${base}.wav`, wav16(m.outBuf, SR)); writeFileSync(`${base}.mix.json`, JSON.stringify(st, null, 1)); writeFileSync(`${base}.mix.svg`, envelopeSvg(m));
  console.log(`${id.padEnd(27)} ${String(st.sounds).padStart(6)}  ${st.peak.toFixed(2).padStart(5)} ${st.peakDb.toFixed(1).padStart(5)}  ${(st.wouldClip * 100).toFixed(2).padStart(8)} %  ${st.rmsDb.toFixed(1).padStart(6)}  ${String(st.crestDb ?? '—').padStart(8)}  ${String(st.maxVoices).padStart(6)} @ ${st.maxVoicesAt.toFixed(2).padEnd(5)}  ${`${st.busiest100ms.starts} from ${st.busiest100ms.from.toFixed(2)} s`.padEnd(22)}  ${st.normalised ? `scaled ${st.normaliseDb.toFixed(1)} dB` : 'as summed'}${Object.keys(st.missing).length ? `  · missing ${Object.keys(st.missing).join(',')}` : ''}`);
}
console.log(`→ ${resolve(OUT!)}/${TAG}.<scene>.{wav,mix.json,mix.svg}`);
