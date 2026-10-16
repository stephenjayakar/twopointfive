// THE SOUND SHEET: every voice of the synthesized table (src/audio/sfx.ts) as NUMBERS and PICTURES, for judging a sound nobody here can hear. Per voice: how it starts
// (attack), how it dies (the seconds its envelope takes to fall 30 dB, and how straight that fall is in dB — a ruler-straight exponential under a few pure partials is the
// tell of a synthesizer beep), what it is made of (tonal share = the energy in its strongest spectral lines, how many lines carry it, the flatness of the rest), where it
// sits (centroid, the share under 150 Hz = body, over 6 kHz = air) and whether its colour MOVES while it sounds (the centroid's travel in octaves: a recorded impact
// starts bright and ends dull, a toy stays put). With --out it also writes contact sheets: one row a voice, its waveform over its log-frequency spectrogram, 1.5 s across.
//   bun run tools/qa/sound-sheet.ts [name …]              # the table, a line a voice (all of them when none is named)
//   bun run tools/qa/sound-sheet.ts --out <dir>           # + <dir>/sheet-N.png (13 rows each; the order is the table's, printed beside each sheet's name) and sheet.json
//   bun run tools/qa/sound-sheet.ts --table <module.ts>   # another build of the table (a module exporting buildSfx): a before for an after —
//                                                         # `--table src/audio/sfxWas.ts` is the table as it was before the sounds were redone
import { resolve } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const ROOT = resolve(import.meta.dir, '../..');
const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v ?? null; };
const OUT = opt('--out'), TABLE = opt('--table');
const M = await import(TABLE ? resolve(TABLE) : `${ROOT}/src/audio/sfx.ts`); const buildSfx = M.buildSfx ?? M.buildSfxWas;   // (sfxWas.ts = the table before the redo)
const SR = 48000;
const shim = { sampleRate: SR, createBuffer(ch: number, n: number, sr: number) { const c = Array.from({ length: ch }, () => new Float32Array(n)); return { sampleRate: sr, length: n, duration: n / sr, numberOfChannels: ch, getChannelData: (k: number) => c[k] }; } };
const table = buildSfx(shim) as Record<string, { getChannelData(c: number): Float32Array; duration: number }>;
const names = args.length ? args.filter(n => table[n]) : Object.keys(table);

// ---- an FFT (radix 2, in place) and the frames ----
const N = 2048, HOP = 256, HANN = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) { const a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(a * k), s = Math.sin(a * k), x = i + k, y = x + len / 2;
      const tr = re[y] * c - im[y] * s, ti = re[y] * s + im[y] * c; re[y] = re[x] - tr; im[y] = im[x] - ti; re[x] += tr; im[x] += ti; } }
}
/** power spectra of the voice's frames: [frame][bin 0‥N/2) */
function frames(d: Float32Array): Float64Array[] {
  const out: Float64Array[] = []; const re = new Float64Array(N), im = new Float64Array(N);
  for (let at = -N / 2; at < d.length; at += HOP) { for (let i = 0; i < N; i++) { const s = at + i; re[i] = s >= 0 && s < d.length ? d[s] * HANN[i] : 0; im[i] = 0; }
    fft(re, im); const p = new Float64Array(N / 2); for (let k = 0; k < N / 2; k++) p[k] = re[k] * re[k] + im[k] * im[k]; out.push(p); }
  return out;
}
const hz = (bin: number) => bin * SR / N, db = (x: number) => 10 * Math.log10(Math.max(x, 1e-20));

interface Row { name: string; dur: number; peak: number; attackMs: number; fall30: number; straight: number; tonal: number; lines: number; top: number[]; flat: number; centroid: number; travel: number; body: number; air: number; width: number; toy: number; why: string }
function measure(name: string): Row {
  const d = table[name].getChannelData(0); const F = frames(d);
  let peak = 0; for (const s of d) peak = Math.max(peak, Math.abs(s));
  // the envelope: 5 ms RMS, in dB
  const W = Math.round(SR * 0.005); const env: number[] = []; for (let a = 0; a + W <= d.length; a += W) { let e = 0; for (let i = a; i < a + W; i++) e += d[i] * d[i]; env.push(db(e / W)); }
  let pk = 0; for (let i = 1; i < env.length; i++) if (env[i] > env[pk]) pk = i;
  let first = 0; while (first < pk && env[first] < env[pk] - 40) first++;
  let end = pk; while (end < env.length - 1 && env[end] > env[pk] - 30) end++;
  // how straight the fall is, in dB against time (R² of a line through it): 1 = one clean exponential
  let straight = 0; { const n = end - pk + 1; if (n >= 6) { let sx = 0, sy = 0, sxx = 0, sxy = 0, syy = 0; for (let i = pk; i <= end; i++) { const x = i - pk, y = env[i]; sx += x; sy += y; sxx += x * x; sxy += x * y; syy += y * y; }
    const cov = n * sxy - sx * sy, vx = n * sxx - sx * sx, vy = n * syy - sy * sy; straight = vx > 0 && vy > 0 ? cov * cov / (vx * vy) : 0; } }
  // the whole voice's spectrum (the frames summed), 40 Hz up
  const S = new Float64Array(N / 2); for (const p of F) for (let k = 0; k < N / 2; k++) S[k] += p[k];
  const lo = Math.ceil(40 * N / SR); let tot = 0; for (let k = lo; k < N / 2; k++) tot += S[k];
  // its spectral LINES: local maxima that stand 12 dB over the median of their neighbourhood, each taken with ±2 bins
  const lines: { f: number; e: number }[] = []; const used = new Uint8Array(N / 2);
  for (let k = lo + 2; k < N / 2 - 2; k++) { if (S[k] < S[k - 1] || S[k] < S[k + 1]) continue; const a = Math.max(lo, k - 40), b = Math.min(N / 2, k + 40); const nb = Array.from(S.subarray(a, b)).sort((x, y) => x - y); if (S[k] < nb[nb.length >> 1] * 16) continue;
    let e = 0; for (let j = k - 2; j <= k + 2; j++) if (!used[j]) { e += S[j]; used[j] = 1; } lines.push({ f: hz(k), e }); }
  lines.sort((x, y) => y.e - x.e); const strong = lines.filter(l => l.e > tot * 0.02);
  const tonal = strong.reduce((a, l) => a + l.e, 0) / tot;
  // flatness (geometric over arithmetic mean) of what is between 100 Hz and 12 kHz: 1 = white noise, 0 = lines
  let g = 0, a = 0, n = 0; for (let k = Math.ceil(100 * N / SR); k < 12000 * N / SR; k++) { g += Math.log(S[k] + 1e-30); a += S[k]; n++; } const flat = Math.exp(g / n) / (a / n + 1e-30);
  let cen = 0, body = 0, air = 0; for (let k = lo; k < N / 2; k++) { cen += hz(k) * S[k]; if (hz(k) < 150) body += S[k]; if (hz(k) > 6000) air += S[k]; }
  // the band that holds the middle 80 % of the energy, in octaves
  let acc = 0, f10 = 0, f90 = 0; for (let k = lo; k < N / 2; k++) { acc += S[k]; if (!f10 && acc > tot * 0.1) f10 = hz(k); if (!f90 && acc > tot * 0.9) { f90 = hz(k); break; } }
  // does the colour move: the centroid of the loud frames, first third against last third, in octaves
  const loud = F.map((p, i) => { let e = 0, c = 0; for (let k = lo; k < N / 2; k++) { e += p[k]; c += hz(k) * p[k]; } return { i, e, c: c / (e + 1e-30) }; }); const top = Math.max(...loud.map(l => l.e));
  const live = loud.filter(l => l.e > top * 0.003); const third = Math.max(1, Math.floor(live.length / 3));
  const mean = (xs: typeof live) => xs.reduce((s, l) => s + l.c * l.e, 0) / (xs.reduce((s, l) => s + l.e, 0) + 1e-30);
  const travel = live.length >= 6 ? Math.abs(Math.log2(mean(live.slice(0, third)) / mean(live.slice(-third)))) : 0;
  const r: Row = { name, dur: table[name].duration, peak, attackMs: (pk - first) * 5, fall30: (end - pk) * 0.005, straight, tonal, lines: strong.length, top: strong.slice(0, 4).map(l => Math.round(l.f)), flat, centroid: cen / tot, travel, body: body / tot, air: air / tot, width: Math.log2((f90 || 1) / (f10 || 1)), toy: 0, why: '' };
  // the tells, each 0‥1, and the words for them
  const why: string[] = [];
  const beep = Math.max(0, (r.tonal - 0.45) / 0.5) * (r.lines <= 3 ? 1 : r.lines <= 5 ? 0.6 : 0.3); if (beep > 0.3) why.push(`${r.lines} pure line${r.lines === 1 ? '' : 's'}`);
  const ruler = r.tonal > 0.3 && r.fall30 > 0.04 ? Math.max(0, (r.straight - 0.9) / 0.1) : 0; if (ruler > 0.5) why.push('ruler-straight decay');
  const still = r.dur > 0.08 ? Math.max(0, 1 - r.travel / 0.6) : 0; if (still > 0.6) why.push('colour never moves');
  const thin = Math.max(0, 1 - r.width / 3); if (thin > 0.4) why.push(`narrow (${r.width.toFixed(1)} oct)`);
  r.toy = Math.min(1, 0.4 * beep + 0.2 * ruler + 0.2 * still + 0.2 * thin); r.why = why.join(', ');
  return r;
}

const rows = names.map(measure);
console.log(`\n=== sound-sheet: ${rows.length} voices${TABLE ? ' of ' + TABLE : ''} ===`);
console.log('name               dur  atk ms  -30dB s  straight  tonal lines  flat   centroid  travel  body  air  width   toy  why / strongest lines');
for (const r of rows) console.log(`${r.name.padEnd(17)} ${r.dur.toFixed(2).padStart(5)} ${String(r.attackMs).padStart(6)}  ${r.fall30.toFixed(2).padStart(6)}   ${r.straight.toFixed(2)}     ${r.tonal.toFixed(2)}  ${String(r.lines).padStart(3)}   ${r.flat.toFixed(2)}  ${(r.centroid.toFixed(0) + ' Hz').padStart(8)}   ${r.travel.toFixed(2)}   ${(r.body * 100).toFixed(0).padStart(3)}% ${(r.air * 100).toFixed(0).padStart(3)}%  ${r.width.toFixed(1).padStart(4)}   ${r.toy.toFixed(2)}  ${r.why}${r.top.length ? '  [' + r.top.join(', ') + ' Hz]' : ''}`);

// ---- the pictures ----
if (OUT) {
  mkdirSync(OUT, { recursive: true });
  const PW = 900, WH = 28, SH = 96, GAP = 6, RH = WH + SH + GAP, SPAN = 1.5, PER = 13;
  const crcT = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Uint8Array) => { const o = new Uint8Array(12 + data.length), v = new DataView(o.buffer); v.setUint32(0, data.length); for (let i = 0; i < 4; i++) o[4 + i] = type.charCodeAt(i); o.set(data, 8); v.setUint32(8 + data.length, crc(o.subarray(4, 8 + data.length))); return o; };
  const png = (w: number, h: number, rgb: Uint8Array) => { const raw = new Uint8Array((w * 3 + 1) * h); for (let y = 0; y < h; y++) raw.set(rgb.subarray(y * w * 3, (y + 1) * w * 3), y * (w * 3 + 1) + 1);
    const hd = new Uint8Array(13), v = new DataView(hd.buffer); v.setUint32(0, w); v.setUint32(4, h); hd[8] = 8; hd[9] = 2;
    return Buffer.concat([Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), chunk('IHDR', hd), chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array(0))]); };
  const heat = (t: number): [number, number, number] => { t = Math.max(0, Math.min(1, t)); return [Math.round(255 * Math.min(1, t * 2.2)), Math.round(255 * Math.max(0, Math.min(1, t * 2.2 - 0.7))), Math.round(255 * (t < 0.35 ? t * 1.6 : Math.max(0, t * 3 - 2)))]; };
  for (let s = 0; s * PER < rows.length; s++) {
    const part = rows.slice(s * PER, (s + 1) * PER); const H = part.length * RH; const img = new Uint8Array(PW * H * 3);
    const px = (x: number, y: number, c: [number, number, number]) => { if (x < 0 || x >= PW || y < 0 || y >= H) return; const o = (y * PW + x) * 3; img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; };
    part.forEach((r, k) => { const y0 = k * RH; const d = table[r.name].getChannelData(0); const F = frames(d); const span = Math.max(SPAN, r.dur) * SR;   // (a voice longer than 1.5 s is squeezed to fit; the table says how long it is)
      for (let x = 0; x < PW; x++) { const a = Math.floor(x * span / PW), b = Math.min(d.length, Math.floor((x + 1) * span / PW)); if (a >= d.length) break; let lo = 0, hi = 0; for (let i = a; i < b; i++) { if (d[i] < lo) lo = d[i]; if (d[i] > hi) hi = d[i]; }
        for (let y = Math.round(WH / 2 - hi * WH / 2); y <= Math.round(WH / 2 - lo * WH / 2); y++) px(x, y0 + y, [150, 200, 180]); }
      let ref = 1e-12; for (const p of F) for (const v of p) if (v > ref) ref = v;
      for (let x = 0; x < PW; x++) { const fi = Math.floor((x + 0.5) * span / PW / HOP); if (fi >= F.length) break; const p = F[fi];
        for (let y = 0; y < SH; y++) { const f = 40 * Math.pow(20000 / 40, 1 - y / (SH - 1)), f2 = 40 * Math.pow(20000 / 40, 1 - (y - 1) / (SH - 1)); const b0 = Math.max(1, Math.floor(f * N / SR)), b1 = Math.max(b0 + 1, Math.ceil(f2 * N / SR)); let v = 0; for (let j = b0; j < b1 && j < N / 2; j++) v = Math.max(v, p[j]);
          px(x, y0 + WH + y, heat((db(v / ref) + 72) / 72)); } }
      for (const f of [100, 1000, 10000]) { const y = Math.round((1 - Math.log(f / 40) / Math.log(20000 / 40)) * (SH - 1)); for (let x = 0; x < 8; x++) px(x, y0 + WH + y, [255, 255, 255]); }   // ticks at 100 Hz, 1 kHz, 10 kHz
    });
    const file = `${OUT}/sheet-${s + 1}.png`; writeFileSync(file, png(PW, H, img)); console.log(`${file}: ${part.map(r => r.name).join(' · ')}`);
  }
  writeFileSync(`${OUT}/sheet.json`, JSON.stringify(rows, null, 1));
}
