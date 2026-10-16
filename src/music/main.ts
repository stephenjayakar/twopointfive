// THE SCORE'S LISTENING PAGE (music.html): every piece of the score (audio/music.ts: the theme, and audio/pieces.ts's newer seven) on one row each, played by the game's own
// sequencer through the game's own voices and master chain, with the tension under the listener's hand and a keep / cut mark per piece to paste back. No game code is loaded.
// The page never deals: the piece picked plays until another is (MUSIC.pieces stays off here; setPiece is by hand).
// UNDER THE PIECES, THE LEVELS (audio/setlist.ts): one row a level with the two pieces written down for it — the one that opens it, the one that follows — each with its own
// play button and each a picker: a pairing the listener changes is kept with the marks and comes back in the same pasted line (`records: Paper Walls, Cold Storage`).
// `window.__music` is the QA hook (tools/qa/music-page.cjs): `render(piece, x, secs)` plays a piece into an OfflineAudioContext on the same chain and measures what came out.
import { Music, WebAudioMusicBackend, PIECE_NAMES } from '../audio/music';
import { PIECES, THEME } from '../audio/pieces';
import { setlistKey, setlistNames } from '../audio/setlist';
import { ALL_MISSIONS, pickSearch } from '../scene/scenarioList';
import { masterChain } from '../audio/webaudio';
import { VOLUME_DEFAULTS } from '../audio/mixlaw';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const METRE: Record<number, string> = { 16: '4/4', 12: '12/8' };
const ROWS = PIECE_NAMES.map((name, i) => { const p = i ? PIECES[i - 1] : THEME; return { name, meta: `${p.bpm} · ${METRE[p.steps] ?? p.steps} · ${p.key}` }; });
const LS = 'twopointsix.music.marks';
const LS_LV = 'twopointsix.music.levels';
/** the levels in the mission list's order, the solo night first: a row per list in setlist.ts (missions that share one share a row, under the first one's title) */
const LEVELS = (() => { const seen = new Set<string>(), out: { key: string; title: string; names: readonly string[] }[] = [];
  for (const m of [{ title: 'Solo night', search: '?solo' }, ...ALL_MISSIONS.map(e => ({ title: e.title, search: pickSearch(e) }))]) {
    const k = setlistKey(m.search), r = setlistNames(k.level, k.kind); if (seen.has(r.key)) continue; seen.add(r.key);
    out.push({ key: r.key, title: m.title.replace(/, (alone|as two)$/, ''), names: r.names }); }
  return out; })();
/** the listener's own pairings, by level key (only the rows changed) */
const mine: Record<string, string[]> = (() => { try { return JSON.parse(localStorage.getItem(LS_LV) ?? '{}'); } catch { return {}; } })();
const pair = (l: { key: string; names: readonly string[] }) => [0, 1].map(k => { const n = mine[l.key]?.[k]; return n && PIECE_NAMES.indexOf(n) > 0 ? n : l.names[k]; });

/** the game's master chain (audio/webaudio.ts masterChain) at the mixer's default level */
const chain = (ctx: BaseAudioContext) => masterChain(ctx, VOLUME_DEFAULTS.master);

let ctx: AudioContext | null = null, music: Music | null = null, scope: AnalyserNode | null = null, playing = -1;
const marks: Record<string, 'keep' | 'cut'> = (() => { try { return JSON.parse(localStorage.getItem(LS) ?? '{}'); } catch { return {}; } })();
const tension = () => +$<HTMLInputElement>('tension').value;

function play(i: number) {
  if (!ctx) {
    ctx = new AudioContext(); const master = chain(ctx);
    scope = ctx.createAnalyser(); scope.fftSize = 256; scope.smoothingTimeConstant = 0.75; master.connect(scope);
    music = new Music(new WebAudioMusicBackend(ctx, master)); music.setVolume(VOLUME_DEFAULTS.music);
  }
  if (playing === i) { void ctx.suspend(); playing = -1; requestAnimationFrame(draw); } else { void ctx.resume(); music!.intensity = tension(); music!.setPiece(i, true); if (playing < 0) requestAnimationFrame(draw); playing = i; }
  paint();
}

function paint() {
  document.querySelectorAll<HTMLElement>('.row').forEach((r, i) => {
    r.classList.toggle('playing', i === playing);
    const b = r.querySelector<HTMLButtonElement>('.play')!; b.textContent = i === playing ? '■' : '▶'; b.setAttribute('aria-pressed', String(i === playing));
    r.querySelectorAll<HTMLButtonElement>('.mark').forEach(m => m.setAttribute('aria-pressed', String(marks[ROWS[i].name] === m.dataset.mark)));
  });
  document.querySelectorAll<HTMLElement>('.lrow').forEach((r, i) => { const names = pair(LEVELS[i]);
    r.classList.toggle('mine', names.some((n, k) => n !== LEVELS[i].names[k]));
    r.querySelectorAll<HTMLButtonElement>('.play').forEach((b, k) => { const on = playing >= 0 && PIECE_NAMES[playing] === names[k]; b.textContent = on ? '■' : '▶'; b.setAttribute('aria-pressed', String(on)); });
    r.querySelectorAll<HTMLSelectElement>('select').forEach((sel, k) => { sel.value = names[k]; }); });
  const said = [...ROWS.filter(r => marks[r.name]).map(r => `${r.name}: ${marks[r.name]}`), ...LEVELS.filter(l => pair(l).some((n, k) => n !== l.names[k])).map(l => `${l.key}: ${pair(l).join(', ')}`)].join(' · ');
  $('copy').hidden = !said; $<HTMLTextAreaElement>('out').value = said;
}

let bins: Uint8Array<ArrayBuffer> | null = null, ink = '';
/** the spectrum, a frame at a time while something plays (stopped: one last frame of the flat line, then no more) */
function draw() {
  const c = $<HTMLCanvasElement>('scope'), g = c.getContext('2d'); if (!g || !scope) return;
  if (playing >= 0) requestAnimationFrame(draw);
  const w = Math.round(c.clientWidth * devicePixelRatio), h = Math.round(c.clientHeight * devicePixelRatio); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  bins ??= new Uint8Array(new ArrayBuffer(scope.frequencyBinCount)); ink ||= getComputedStyle(c).color; scope.getByteFrequencyData(bins);
  g.clearRect(0, 0, w, h); g.fillStyle = ink;
  const n = 64, bw = w / n; for (let k = 0; k < n; k++) { const v = (playing < 0 ? 0 : bins[Math.floor(Math.pow(k / n, 1.6) * bins.length)] / 255) * h; g.fillRect(k * bw, h - Math.max(1, v), bw - 1, Math.max(1, v)); }
}

function build() {
  const list = $('list');
  ROWS.forEach((r, i) => {
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<button class="play" type="button" aria-pressed="false" aria-label="Play ${r.name}">▶</button><span class="name"></span><span class="meta"></span><span class="marks"><button class="mark" type="button" data-mark="keep" aria-pressed="false">keep</button><button class="mark" type="button" data-mark="cut" aria-pressed="false">cut</button></span>`;
    row.querySelector('.name')!.textContent = r.name; row.querySelector('.meta')!.textContent = r.meta;
    row.querySelector<HTMLButtonElement>('.play')!.onclick = () => play(i);
    row.querySelectorAll<HTMLButtonElement>('.mark').forEach(m => m.onclick = () => { const k = m.dataset.mark as 'keep' | 'cut'; if (marks[r.name] === k) delete marks[r.name]; else marks[r.name] = k; try { localStorage.setItem(LS, JSON.stringify(marks)); } catch { /* a private window: the marks last the visit */ } paint(); });
    list.appendChild(row);
  });
  const levels = $('levels'), opts = PIECE_NAMES.slice(1).map(n => `<option>${n}</option>`).join('');
  LEVELS.forEach(l => {
    const row = document.createElement('div'); row.className = 'lrow';
    row.innerHTML = `<span class="name"></span>` + ['opens', 'then'].map(() => `<span class="slot"><button class="play" type="button" aria-pressed="false">▶</button><select>${opts}</select></span>`).join('');
    row.querySelector('.name')!.textContent = l.title;
    row.querySelectorAll<HTMLElement>('.slot').forEach((slot, k) => { const w = `${l.title}, ${k ? 'then' : 'opens on'}`; slot.querySelector('.play')!.setAttribute('aria-label', `Play: ${w}`); slot.querySelector('select')!.setAttribute('aria-label', w); });
    row.querySelectorAll<HTMLElement>('.slot').forEach((slot, k) => {
      slot.querySelector<HTMLButtonElement>('.play')!.onclick = () => play(PIECE_NAMES.indexOf(pair(l)[k]));
      slot.querySelector<HTMLSelectElement>('select')!.onchange = e => { const now = pair(l); now[k] = (e.target as HTMLSelectElement).value; if (now[0] === now[1]) now[1 - k] = pair(l)[k];   // (picking the other slot's piece swaps the two)
        if (now.every((n, j) => n === l.names[j])) delete mine[l.key]; else mine[l.key] = now;
        try { localStorage.setItem(LS_LV, JSON.stringify(mine)); } catch { /* a private window: the pairings last the visit */ }
        const i = PIECE_NAMES.indexOf(now[k]); if (playing !== i) play(i); else paint(); };
    });
    levels.appendChild(row);
  });
  $<HTMLInputElement>('tension').oninput = () => { if (music) music.intensity = tension(); };
  $('copy').onclick = () => { const out = $<HTMLTextAreaElement>('out'); const done = () => { $('copy').textContent = 'copied'; setTimeout(() => { $('copy').textContent = 'copy marks'; }, 1200); };
    const byHand = () => { out.hidden = false; out.select(); };   // (no clipboard here — an http page on a LAN address, an older app view: the marks shown, selected, to copy by hand)
    try { navigator.clipboard.writeText(out.value).then(done, byHand); } catch { byHand(); } };
  addEventListener('keydown', e => { if (e.code === 'Space' && playing >= 0 && (e.target === document.body || e.target === document.documentElement)) { e.preventDefault(); play(playing); } });   // (Space on the page stops the music; on a button it is that button's)
  paint();
}

// ---- the QA hook: a piece rendered off line on the same chain, and what came out measured ----
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; const b = im[i]; im[i] = im[j]; im[j] = b; } }
  for (let len = 2; len <= n; len <<= 1) { const ang = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) for (let k = 0; k < len / 2; k++) { const c = Math.cos(ang * k), s = Math.sin(ang * k), a = i + k, b = a + len / 2, xr = re[b] * c - im[b] * s, xi = re[b] * s + im[b] * c; re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi; } }
}
const dB = (v: number) => 20 * Math.log10(Math.max(1e-9, v));
/** piece i at tension x for `secs`, optionally handing over to piece `to` at `at` seconds; `dry` = no compressor (what the score hands the master). Levels are measured from 4 s on. */
async function render(i: number, x: number, secs: number, o: { to?: number; at?: number; dry?: boolean } = {}) {
  const sr = 48000, off = new OfflineAudioContext(2, sr * secs, sr);
  let dest: AudioNode; if (o.dry) { const m = off.createGain(); m.gain.value = VOLUME_DEFAULTS.master; m.connect(off.destination); dest = m; } else dest = chain(off);
  const m = new Music(new WebAudioMusicBackend(off, dest), false); m.setVolume(VOLUME_DEFAULTS.music); m.intensity = x; m.setPiece(i, true);
  let swapped = false;
  for (let k = 1; k * 0.025 < secs - 0.05; k++) { const t = k * 0.025; void off.suspend(t).then(() => { if (o.to !== undefined && !swapped && t >= (o.at ?? 0)) { swapped = true; m.setPiece(o.to); } m.pump(); void off.resume(); }); }
  const buf = await off.startRendering(), L = buf.getChannelData(0), R = buf.getChannelData(1), from = Math.min(L.length, 4 * sr);
  let peak = 0, sum = 0, dc = 0, jump = 0, hot = 0, quietest = 0, loudest = -200; const win = sr;
  for (let s = from; s < L.length; s++) { const a = Math.max(Math.abs(L[s]), Math.abs(R[s])); if (a > peak) peak = a; if (a > 0.98) hot++; const mid = (L[s] + R[s]) / 2; sum += mid * mid; dc += mid; const j = Math.abs(L[s] - L[s - 1]); if (j > jump) jump = j; }
  for (let s = from; s + win <= L.length; s += win) { let w = 0; for (let k = 0; k < win; k++) { const mid = (L[s + k] + R[s + k]) / 2; w += mid * mid; } const d = dB(Math.sqrt(w / win)); if (d < quietest) quietest = d; if (d > loudest) loudest = d; }
  // the spectrum, averaged over windows: where the centre of the sound sits, and how much of it is under 120 Hz and over 5 kHz
  const N = 8192, mag = new Float64Array(N / 2); let wins = 0;
  for (let s = from; s + N <= L.length; s += N * 4) { const re = new Float64Array(N), im = new Float64Array(N); for (let k = 0; k < N; k++) re[k] = (L[s + k] + R[s + k]) / 2 * (0.5 - 0.5 * Math.cos(2 * Math.PI * k / N)); fft(re, im); for (let k = 0; k < N / 2; k++) mag[k] += re[k] * re[k] + im[k] * im[k]; wins++; }
  let tot = 0, cen = 0, low = 0, high = 0; const band = [0, 0, 0, 0]; for (let k = 1; k < N / 2; k++) { const f = k * sr / N, e = mag[k]; tot += e; cen += e * f; if (f < 120) low += e; else band[f < 500 ? 0 : f < 2000 ? 1 : f < 5000 ? 2 : 3] += e; if (f > 5000) high += e; }
  const n = L.length - from;
  return { piece: PIECE_NAMES[i], x, secs, peak: +peak.toFixed(3), rms: +dB(Math.sqrt(sum / n)).toFixed(1), quietest: +quietest.toFixed(1), loudest: +loudest.toFixed(1), hot, dc: +(dc / n).toFixed(5), jump: +jump.toFixed(3),
    centroid: Math.round(cen / Math.max(1e-12, tot)), low: +(low / Math.max(1e-12, tot)).toFixed(3), high: +(high / Math.max(1e-12, tot)).toFixed(4), notes: m.notes, ended: m.pieceName, wins,
    /** the four bands over the lows (120‥500 Hz, ‥2 kHz, ‥5 kHz, above), each in dB under the whole */
    bands: band.map(e => Math.round(10 * Math.log10(Math.max(1e-12, e / Math.max(1e-12, tot))))) };
}

build();
(window as unknown as { __music: unknown }).__music = { names: PIECE_NAMES, rows: ROWS, levels: LEVELS, render, play, state: () => ({ playing, started: !!ctx, running: ctx?.state ?? 'none', notes: music?.notes ?? 0, piece: music?.pieceName ?? null }) };
