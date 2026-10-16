// PLOTS OF THE GLASS TUNING INSTRUMENT'S RUNS (tools/qa/glass-tune.ts writes <tag>.<scene>.json; this reads them — it stands no game up and imports nothing of src/).
//
//   bun run tools/qa/glass-tune-plot.ts --in DIR --tag r0[,r2,…] --out DIR [--scene a,b] [--png] [--raw]
//
// Per scene and tag ONE self-contained SVG (<out>/<tag>.<scene>.svg, 900 px wide, white ground, system fonts) of stacked strips on one time axis (0 → the scene's length):
//   (a) open share of the pane, 0‥100 %, with a marker where it starts running / is half open / is gone / becomes walkable
//   (b) live shard particles (line, left scale) + particles born per frame (bars, their own scale)
//   (c) rigid debris + plates
//   (d) every sound played, a tick row per sfx name (tick height ∝ gain), the count at the right
//   (e) hearing events, a tick row per kind (height ∝ level; a level-less event = a full-height dashed tick)
//   (f) rounds fired, coloured by whether that round crossed the pane (cross[].t matched to rounds[].t within two frames; the stun charge is a diamond)
// and, when the file carries `left` + `hu` / `hv` (the newer format), the pane to scale at the right with the pieces still in the frame (teeth pale, pieces in the way —
// not a tooth and reaching below 1.9 m — dark) and a dashed line at 1.9 m.
// With several tags also <out>/compare.<tagA>-<tagB>.md (the first tag against each other one): a row per scene present in both, 'A → B' per headline number.
// --png rasterises each SVG with the pre-installed headless Chromium (CHROME below); if Chromium will not run the PNGs are skipped with a line saying so.
// --raw keeps the staging's own noise (parked men, furniture: the names glass-tune.ts itself filters since the newer format) in the sound rows of old files.
//
// OLD FILES (no `hu`): cross[].t there runs 7 frames (0.117 s) behind the round that made it; the matcher tries that lag as well as none and keeps whichever pairs more
// rounds (an old file prefers the lag on a tie). The lag used is printed in the rounds strip's header when it is not zero.
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const argv = process.argv.slice(2);
const arg = (k: string, d: string | null = null) => { const i = argv.indexOf(k); return i >= 0 && i + 1 < argv.length ? argv[i + 1] : d; };
const IN = arg('--in'), OUT = arg('--out'), TAGS = (arg('--tag', '') as string).split(',').filter(Boolean);
if (!IN || !OUT || !TAGS.length) { console.error('usage: bun run tools/qa/glass-tune-plot.ts --in DIR --tag r0[,r2,…] --out DIR [--scene a,b] [--png] [--raw]'); process.exit(2); }
const ONLY = arg('--scene') ? (arg('--scene') as string).split(',') : null;
const PNG = argv.includes('--png'), RAW = argv.includes('--raw');
const NOT_GLASS = /^(footstep|heldProtest|propScrape|propThud|click|magDrop|earRing)$/;   // glass-tune.ts's own list (the staging's noise)
const FRAME = 1 / 60;
const CHROME_PAD = 96;   // --headless=new takes its window furniture out of --window-size: without this the screenshot loses the foot of the plot (the PNG gains a white margin there)

interface Scene { tag: string; id: string; sum: any; rows: any[]; rounds: any[]; events: any[]; audio: any[]; cross: any[]; left: any[]; hu: number | null; hv: number | null }
function load(tag: string, id: string): Scene | null {
  const p = resolve(IN!, `${tag}.${id}.json`); if (!existsSync(p)) return null;
  let j: any; try { j = JSON.parse(readFileSync(p, 'utf8')); } catch (e) { console.error(`  ! ${p}: ${(e as Error).message}`); return null; }
  const arr = (x: any) => Array.isArray(x) ? x : [];
  let audio = arr(j.audio).filter((a: any) => a && typeof a.name === 'string' && Number.isFinite(a.t));
  if (!RAW) audio = audio.filter((a: any) => !NOT_GLASS.test(a.name));
  return { tag, id, sum: j.sum ?? {}, rows: arr(j.rows).filter((r: any) => r && Number.isFinite(r.t)), rounds: arr(j.rounds).filter((r: any) => r && Number.isFinite(r.t)), events: arr(j.events).filter((e: any) => e && Number.isFinite(e.t)), audio, cross: arr(j.cross).filter((c: any) => c && Number.isFinite(c.t)), left: arr(j.left), hu: Number.isFinite(j.hu) ? j.hu : null, hv: Number.isFinite(j.hv) ? j.hv : null };
}
function scenesOf(tag: string): string[] {
  const pre = `${tag}.`; return readdirSync(IN!).filter(f => f.startsWith(pre) && f.endsWith('.json') && f !== `${tag}.summary.json`).map(f => f.slice(pre.length, -5)).filter(id => !ONLY || ONLY.includes(id)).sort();
}

// ---------------------------------------------------------------- what a scene says (sum where present, else derived)
const countBy = <T,>(xs: T[], key: (x: T) => string) => { const m: Record<string, number> = {}; for (const x of xs) m[key(x)] = (m[key(x)] ?? 0) + 1; return m; };
function marksOf(s: Scene): Record<string, number> {
  const m: Record<string, number> = { ...(s.sum.marks ?? {}) };
  const first = (p: (r: any) => boolean) => { const r = s.rows.find(p); return r ? r.t : undefined; };
  const put = (k: string, v: number | undefined) => { if (m[k] == null && v != null) m[k] = v; };
  put('run', first(r => !!r.run)); put('gone', first(r => !!r.gone)); put('walk', first(r => !!r.walk)); put('firstOpen', first(r => r.open > 0)); put('half', first(r => r.open >= 0.5));
  return m;
}
/** which rounds crossed the pane: cross[].t against rounds[].t within two frames, at the lag (0 or 7 frames) that pairs the most */
function crossedRounds(s: Scene): { hit: boolean[]; lag: number; unmatched: number } {
  const tol = 2 * FRAME + 1e-3; const lags = s.hu == null ? [7 * FRAME, 0] : [0, 7 * FRAME];
  let best = { hit: s.rounds.map(() => false), lag: 0, unmatched: s.cross.length, n: -1 };
  for (const lag of lags) {
    const hit = s.rounds.map(() => false); let n = 0;
    for (const c of s.cross) {
      let bi = -1, bd = tol;
      for (let i = 0; i < s.rounds.length; i++) { if (hit[i]) continue; const d = Math.abs(c.t - lag - s.rounds[i].t); if (d <= bd) { bd = d; bi = i; } }
      if (bi >= 0) { hit[bi] = true; n++; }
    }
    if (n > best.n) best = { hit, lag, unmatched: s.cross.length - n, n };
  }
  return best;
}
function headline(s: Scene) {
  const sum = s.sum, last = s.rows[s.rows.length - 1] ?? {}; const m = marksOf(s);
  const audio = (RAW || !sum.audio) ? countBy(s.audio, a => a.name) : sum.audio as Record<string, number>;
  const events = sum.events ?? countBy(s.events, e => String(e.kind));
  const eOut = sum.eOutMean ?? (s.cross.length ? s.cross.reduce((a, c) => a + (c.eOut ?? 0), 0) / s.cross.length : null);
  return {
    open: sum.open ?? last.open ?? null, half: m.half ?? null, walk: m.walk ?? null, run: m.run ?? null, gone: m.gone ?? null,
    fragments: sum.fragments ?? null, born: sum.born ?? last.born ?? null, trimmed: sum.trimmed ?? null, peakLive: sum.peakLive ?? (s.rows.length ? Math.max(...s.rows.map(r => r.live ?? 0)) : null),
    plates: sum.plates ?? null, audio, events, rounds: sum.rounds ?? s.rounds.filter(r => r.k != null).length, crossed: sum.crossed ?? s.cross.length, eOut: eOut as number | null,
    left: sum.left ?? (s.left.length || null), leftBlocking: sum.leftBlocking ?? null, leftArea: sum.leftArea ?? null,
  };
}

// ---------------------------------------------------------------- SVG
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const C = { ink: '#1b1b1b', dim: '#666', grid: '#e4e4e4', axis: '#9a9a9a', open: '#0072B2', live: '#0072B2', born: '#E69F00', debris: '#D55E00', plates: '#009E73', sound: '#333', glassSound: '#0072B2', hear: '#CC79A7', hit: '#009E73', miss: '#D55E00', stun: '#7b3fa0', tooth: '#cfe3f1', held: '#74a9cf', block: '#1f4e79' };
const FONT = 'font-family="Helvetica, Arial, sans-serif"';
function niceMax(v: number): number { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= v) return k * p; return 10 * p; }
const sOf = (t: number | null | undefined) => t == null ? '—' : `${(+t).toFixed(2)} s`;

function plot(s: Scene): { svg: string; w: number; h: number } {
  const W = 900; const H = headline(s); const marks = marksOf(s);
  const pane = s.left.length > 0 && s.hu != null && s.hv != null;
  const x0 = 108, x1 = pane ? 596 : 800, pw = x1 - x0;
  const T = Math.max(1e-3, s.rows.length ? s.rows[s.rows.length - 1].t : 0, ...s.audio.map(a => a.t), ...s.rounds.map(r => r.t));
  const X = (t: number) => x0 + Math.max(0, Math.min(1, t / T)) * pw;
  const out: string[] = []; const strips: [number, number][] = [];   // (top, bottom) of every plot area, for the time grid
  let y = 0;
  const text = (x: number, yy: number, t: string, o: { size?: number; fill?: string; anchor?: string; bold?: boolean } = {}) => `<text x="${n1(x)}" y="${n1(yy)}" font-size="${o.size ?? 11}" fill="${o.fill ?? C.ink}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.bold ? ' font-weight="bold"' : ''}>${t}</text>`;
  const header = (t: string) => { y += 18; out.push(text(x0, y - 5, t, { bold: true })); };
  const frame = (top: number, h: number) => { strips.push([top, top + h]); out.push(`<rect x="${x0}" y="${top}" width="${pw}" height="${h}" fill="none" stroke="${C.axis}" stroke-width="0.8"/>`); };
  const yTicks = (top: number, h: number, max: number, vals: number[], fmt: (v: number) => string) => { for (const v of vals) { const yy = top + h - (v / max) * h; out.push(`<line x1="${x0 - 3}" y1="${n1(yy)}" x2="${x0}" y2="${n1(yy)}" stroke="${C.axis}"/>`, text(x0 - 6, yy + 3.5, fmt(v), { size: 10, fill: C.dim, anchor: 'end' })); if (v > 0 && v < max) out.push(`<line x1="${x0}" y1="${n1(yy)}" x2="${x1}" y2="${n1(yy)}" stroke="${C.grid}" stroke-width="0.6"/>`); } };
  const line = (top: number, h: number, max: number, get: (r: any) => number, col: string, wd = 1.6) => `<polyline fill="none" stroke="${col}" stroke-width="${wd}" stroke-linejoin="round" points="${s.rows.map(r => `${n1(X(r.t))},${n1(top + h - Math.max(0, Math.min(1, (get(r) ?? 0) / max)) * h)}`).join(' ')}"/>`;
  const sw = (col: string, word: string) => `<tspan fill="${col}">■</tspan> ${esc(word)}`;

  // ---- title
  const sm = s.sum; const state = H.gone != null ? 'GONE' : H.run != null ? 'run' : '';
  out.push(text(12, 20, `${esc(s.tag)} · ${esc(s.id)}`, { size: 15, bold: true }));
  const bits = [
    sm.pane != null ? `pane ${sm.pane} ${sm.type ?? ''}${Array.isArray(sm.size) ? ` ${sm.size[0]}×${sm.size[1]} m` : ''}` : null,
    `open ${H.open != null ? (H.open * 100).toFixed(0) + ' %' : '—'}${state ? ' ' + state : ''}`, `half ${sOf(H.half)}`, `walk ${sOf(H.walk)}`,
    `crossed ${H.crossed}/${H.rounds}${H.eOut != null ? ` (e out ${(+H.eOut).toFixed(2)})` : ''}`,
    `frags ${H.fragments ?? '—'}`, `plates ${H.plates ?? '—'}`, `born ${H.born ?? '—'}`, `trimmed ${H.trimmed ?? '—'}`, `peak live ${H.peakLive ?? '—'}`,
  ].filter(Boolean) as string[];
  out.push(text(12, 37, esc(bits.join(' · ')), { size: 11, fill: C.dim }));
  y = 46;

  // ---- (a) open share + markers
  {
    const groups: { t: number; names: string[] }[] = [];
    for (const [k, word] of [['run', 'runs'], ['half', 'half open'], ['gone', 'gone'], ['walk', 'walkable']] as const) { const t = marks[k]; if (t == null) continue; const g = groups.find(q => Math.abs(q.t - t) < 0.02); if (g) g.names.push(word); else groups.push({ t, names: [word] }); }
    groups.sort((a, b) => a.t - b.t);
    const labels = groups.map(g => ({ x: X(g.t), t: `${g.names.join(' + ')} ${g.t.toFixed(2)} s`, lvl: 0 }));
    // a label whose words would run under the next marker's line sits one level ABOVE that marker's label (levels fall left to right, so no line crosses any words)
    for (let i = labels.length - 2; i >= 0; i--) if (labels[i].x + labels[i].t.length * 5.6 + 8 > labels[i + 1].x) labels[i].lvl = labels[i + 1].lvl + 1;
    const levels = Math.max(1, ...labels.map(l => l.lvl + 1));
    header('open share of the pane');
    const lab0 = y; y += levels * 12 + 2; const top = y, h = 84; frame(top, h); yTicks(top, h, 100, [0, 50, 100], v => `${v} %`);
    labels.forEach(l => { const ly = lab0 + (levels - l.lvl) * 12 - 2; const tx = Math.min(l.x + 3, W - 8 - l.t.length * 5.6); out.push(`<line x1="${n1(l.x)}" y1="${n1(ly - 8)}" x2="${n1(l.x)}" y2="${top + h}" stroke="${C.ink}" stroke-width="0.9" stroke-dasharray="3 2"/>`, text(tx, ly, esc(l.t), { size: 10 })); });
    out.push(line(top, h, 1, r => r.open, C.open, 2)); y = top + h;
  }
  // ---- (b) shard particles
  {
    const born = s.rows.map((r, i) => Math.max(0, (r.born ?? 0) - (i ? s.rows[i - 1].born ?? 0 : 0))); const bMax = Math.max(0, ...born); const lMax = Math.max(0, ...s.rows.map(r => r.live ?? 0));
    y += 8;
    if (lMax <= 0 && bMax <= 0) { header('shard particles — none'); }
    else {
      const m = niceMax(lMax);
      out.push(`<text x="${x0}" y="${y + 13}" font-size="11" fill="${C.ink}"><tspan font-weight="bold">shard particles</tspan>  ${sw(C.live, `live (peak ${lMax})`)}   ${sw(C.born, `born per frame (peak ${bMax}; bars on their own scale, full height = ${bMax})`)}</text>`); y += 18;
      const top = y, h = 70; frame(top, h); yTicks(top, h, m, [0, m / 2, m], v => String(v));
      const bw = Math.max(1, pw / Math.max(1, s.rows.length));
      born.forEach((b, i) => { if (b > 0) { const bh = (b / bMax) * (h - 2); out.push(`<rect x="${n1(X(s.rows[i].t) - bw / 2)}" y="${n1(top + h - bh)}" width="${n1(bw)}" height="${n1(bh)}" fill="${C.born}" opacity="0.75"/>`); } });
      out.push(line(top, h, m, r => r.live, C.live)); y = top + h;
    }
  }
  // ---- (c) rigid debris + plates
  {
    const dMax = Math.max(0, ...s.rows.map(r => r.debris ?? 0)), pMax = Math.max(0, ...s.rows.map(r => r.plates ?? 0));
    y += 8;
    if (dMax <= 0 && pMax <= 0) header('rigid debris + plates — none');
    else {
      const m = niceMax(Math.max(dMax, pMax));
      out.push(`<text x="${x0}" y="${y + 13}" font-size="11" fill="${C.ink}"><tspan font-weight="bold">rigid pieces</tspan>  ${sw(C.debris, `debris (peak ${dMax})`)}   ${sw(C.plates, `plates (peak ${pMax}, dashed)`)}</text>`); y += 18;
      const top = y, h = 50; frame(top, h); yTicks(top, h, m, [0, m], v => String(v));
      out.push(line(top, h, m, r => r.debris, C.debris, 2.4), line(top, h, m, r => r.plates, C.plates).replace('<polyline', '<polyline stroke-dasharray="5 3"')); y = top + h;
    }
  }
  // ---- tick rows (d) sounds, (e) hearing events
  const tickRows = (title: string, groups: [string, { t: number; k: number | null }[]][], colOf: (name: string) => string, none: string) => {
    y += 8;
    if (!groups.length) { header(`${title} — ${none}`); return; }
    header(title);
    const rh = 17, top = y, h = groups.length * rh; frame(top, h);
    groups.forEach(([name, xs], i) => {
      const base = top + (i + 1) * rh - 1.5; const col = colOf(name);
      if (i) out.push(`<line x1="${x0}" y1="${top + i * rh}" x2="${x1}" y2="${top + i * rh}" stroke="${C.grid}" stroke-width="0.6"/>`);
      out.push(text(x0 - 6, base - 3, esc(name), { size: 10.5, anchor: 'end' }), text(x1 + 6, base - 3, `×${xs.length}`, { size: 10.5, fill: C.dim }));
      for (const e of xs) { const hh = e.k == null ? rh - 4 : Math.max(2, Math.min(1, e.k) * (rh - 4)); out.push(`<line x1="${n1(X(e.t))}" y1="${n1(base)}" x2="${n1(X(e.t))}" y2="${n1(base - hh)}" stroke="${col}" stroke-width="1.3" opacity="0.6"${e.k == null ? ' stroke-dasharray="2 1.5"' : ''}/>`); }
    });
    y = top + h;
  };
  const grouped = <T,>(xs: T[], key: (x: T) => string, val: (x: T) => { t: number; k: number | null }) => { const m = new Map<string, { t: number; k: number | null }[]>(); for (const x of xs) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k)!.push(val(x)); } return [...m.entries()]; };
  const sounds = grouped(s.audio, a => a.name, a => ({ t: a.t, k: Number.isFinite(a.gain) ? a.gain : 1 }));
  sounds.sort((a, b) => (/^glass/.test(b[0]) ? 1 : 0) - (/^glass/.test(a[0]) ? 1 : 0) || a[0].localeCompare(b[0]));
  tickRows(`sounds played (tick height ∝ gain)${RAW ? '' : s.hu == null ? ' — the staging\'s own noise left out' : ''}`, sounds, n => /^glass/.test(n) ? C.glassSound : C.sound, 'none');
  const hears = grouped(s.events, e => String(e.kind), e => ({ t: e.t, k: Number.isFinite(e.level) ? e.level : null })).sort((a, b) => a[0].localeCompare(b[0]));
  tickRows(`hearing events (tick height ∝ level${s.events.some(e => !Number.isFinite(e.level)) ? '; dashed = no level' : ''})`, hears, () => C.hear, 'none');
  // ---- (f) rounds
  {
    const cr = crossedRounds(s); const shots = s.rounds.filter(r => r.stun == null); const nHit = cr.hit.filter(Boolean).length;
    y += 8;
    out.push(`<text x="${x0}" y="${y + 13}" font-size="11" fill="${C.ink}"><tspan font-weight="bold">rounds fired</tspan>  ${sw(C.hit, 'crossed the pane')}   ${sw(C.miss, 'did not')}${s.rounds.some(r => r.stun != null) ? `   ${sw(C.stun, 'stun charge (◆)')}` : ''}${cr.lag > 1e-6 ? `   <tspan fill="${C.dim}">(old file: crossings matched ${cr.lag.toFixed(3)} s back)</tspan>` : ''}${cr.unmatched ? `   <tspan fill="${C.miss}">${cr.unmatched} crossing(s) matched no round</tspan>` : ''}</text>`); y += 18;
    const top = y, h = 20; frame(top, h);
    s.rounds.forEach((r, i) => { const xx = X(r.t); if (r.stun != null) out.push(`<polygon points="${n1(xx)},${top + 2} ${n1(xx + 6)},${top + h / 2} ${n1(xx)},${top + h - 2} ${n1(xx - 6)},${top + h / 2}" fill="${C.stun}"/>`); else out.push(`<line x1="${n1(xx)}" y1="${top + 3}" x2="${n1(xx)}" y2="${top + h - 3}" stroke="${cr.hit[i] ? C.hit : C.miss}" stroke-width="2"/>`); });
    out.push(text(x1 + 6, top + 14, shots.length ? `${nHit}/${shots.length}` : '—', { size: 10.5, fill: C.dim })); y = top + h;
  }
  // ---- the time axis, and its grid behind everything
  const step = T <= 3 ? 0.25 : T <= 8 ? 0.5 : T <= 20 ? 1 : 5; const grid: string[] = [];
  for (let k = 0; k * step <= T + 1e-6; k++) { const t = k * step, xx = X(t); const major = Math.abs(t / (step * 2) - Math.round(t / (step * 2))) < 1e-6; for (const [a, b] of strips) grid.push(`<line x1="${n1(xx)}" y1="${a}" x2="${n1(xx)}" y2="${b}" stroke="${C.grid}" stroke-width="${major ? 0.9 : 0.5}"/>`); out.push(`<line x1="${n1(xx)}" y1="${y}" x2="${n1(xx)}" y2="${y + (major ? 5 : 3)}" stroke="${C.axis}"/>`); if (major) out.push(text(xx, y + 16, `${+t.toFixed(2)}`, { size: 10, fill: C.dim, anchor: 'middle' })); }
  out.push(text(x1 + 6, y + 16, 's', { size: 10, fill: C.dim })); y += 26;

  // ---- the pane with what is left in it
  let paneH = 0;
  if (pane) {
    const hu = s.hu!, hv = s.hv!; const px0 = 668, pwMax = 200, phMax = 330; const sc = Math.min(pwMax / (2 * hu), phMax / (2 * hv)); const top = 92;
    const cx = px0 + pwMax / 2, cy = top + hv * sc; const U = (u: number) => cx + u * sc, V = (v: number) => cy - v * sc;
    const blocking = (f: any) => !f.tooth && (f.vMin ?? 99) < 1.9;
    out.push(text(px0 - 14, 64, 'left in the frame', { bold: true }), text(px0 - 14, 78, esc(`${s.left.length} pieces · ${H.leftArea ?? n1(s.left.reduce((a, f) => a + (f.area ?? 0), 0))} m² · ${H.leftBlocking ?? s.left.filter(blocking).length} in the way`), { size: 10.5, fill: C.dim }));
    out.push(`<rect x="${n1(U(-hu))}" y="${n1(V(hv))}" width="${n1(2 * hu * sc)}" height="${n1(2 * hv * sc)}" fill="#fafafa" stroke="${C.ink}" stroke-width="1.2"/>`);
    for (const f of s.left) { if (!Array.isArray(f.pts) || f.pts.length < 3) continue; out.push(`<polygon points="${f.pts.map((p: number[]) => `${n1(U(p[0]))},${n1(V(p[1]))}`).join(' ')}" fill="${f.tooth ? C.tooth : blocking(f) ? C.block : C.held}" stroke="#fff" stroke-width="0.6"/>`); }
    // 1.9 m: above the FLOOR when the pieces give the pane's height away (vMin is a world height, pts are pane-local), else above the sill
    const offs = s.left.filter(f => Number.isFinite(f.vMin) && Array.isArray(f.pts) && f.pts.length).map(f => f.vMin - Math.min(...f.pts.map((p: number[]) => p[1]))).sort((a, b) => a - b);
    const cY = offs.length && offs[offs.length - 1] - offs[0] < 0.05 ? offs[offs.length >> 1] : null;
    const vLine = cY != null ? 1.9 - cY : -hv + 1.9; const word = cY != null ? `1.9 m above the floor (sill at ${(cY - hv).toFixed(2)} m)` : '1.9 m above the sill';
    let yb = V(-hv) + 14;
    if (vLine > -hv && vLine < hv) out.push(`<line x1="${n1(U(-hu) - 10)}" y1="${n1(V(vLine))}" x2="${n1(U(hu) + 10)}" y2="${n1(V(vLine))}" stroke="${C.miss}" stroke-width="1.1" stroke-dasharray="5 3"/>`);
    out.push(text(cx, yb, `${(2 * hu).toFixed(2)} × ${(2 * hv).toFixed(2)} m`, { size: 10, fill: C.dim, anchor: 'middle' })); yb += 16;
    const leg: [string, string, boolean][] = [[C.block, 'in the way (not a tooth, below 1.9 m)', false], [C.held, 'other piece', false], [C.tooth, 'tooth', false], [C.miss, vLine > -hv && vLine < hv ? word : `${word}: outside this pane`, true]];
    for (const [col, w, dash] of leg) { out.push(dash ? `<line x1="${px0 - 14}" y1="${yb - 4}" x2="${px0 - 2}" y2="${yb - 4}" stroke="${col}" stroke-width="1.4" stroke-dasharray="4 2"/>` : `<rect x="${px0 - 14}" y="${yb - 9}" width="11" height="9" fill="${col}"/>`, text(px0 + 3, yb, esc(w), { size: 10 })); yb += 14; }
    paneH = yb + 4;
  }
  const Hh = Math.ceil(Math.max(y, paneH) + 6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${Hh}" viewBox="0 0 ${W} ${Hh}" ${FONT}>\n<rect width="${W}" height="${Hh}" fill="#fff"/>\n${grid.join('\n')}\n${out.join('\n')}\n</svg>\n`;
  return { svg, w: W, h: Hh };
}

// ---------------------------------------------------------------- compare table
function compare(a: string, b: string, sa: Map<string, Scene>, sb: Map<string, Scene>): string | null {
  const ids = [...sa.keys()].filter(id => sb.has(id)).sort(); if (!ids.length) return null;
  const pct = (x: number | null) => x == null ? '—' : `${(x * 100).toFixed(0)}`; const sec = (x: number | null) => x == null ? '—' : (+x).toFixed(2); const num = (x: any) => x == null ? '—' : String(x);
  const pair = (x: string, y: string) => x === y ? x : `${x} → ${y}`;
  const kinds = (m: Record<string, number>) => Object.entries(m).sort((p, q) => p[0].localeCompare(q[0])).map(([k, v]) => `${k} ${v}`).join(', ') || '—';
  const cols = ['scene', 'open %', 'half open, s', 'walkable at, s', 'fragments', 'born', 'trimmed', 'peak live', 'glassCrack', 'glassTinkle', 'glassShatter', 'glassCrunch', 'heard (by kind)', 'crossed / rounds', 'mean e out'];
  const lines = [`# glass-tune: ${a} → ${b}`, '', `${ids.length} scenes present in both. A cell reads \`${a} → ${b}\`; one value = no change. Sound counts are the scene's \`sum.audio\` where the file has one.`, '', `| ${cols.join(' | ')} |`, `|${cols.map((_, i) => i ? ' ---: ' : ' --- ').join('|')}|`];
  for (const id of ids) {
    const A = headline(sa.get(id)!), B = headline(sb.get(id)!);
    const cell = (f: (h: ReturnType<typeof headline>) => string) => pair(f(A), f(B));
    lines.push(`| ${[id, cell(h => pct(h.open)), cell(h => sec(h.half)), cell(h => sec(h.walk)), cell(h => num(h.fragments)), cell(h => num(h.born)), cell(h => num(h.trimmed)), cell(h => num(h.peakLive)),
      ...['glassCrack', 'glassTinkle', 'glassShatter', 'glassCrunch'].map(n => cell(h => String(h.audio[n] ?? 0))), cell(h => kinds(h.events)), cell(h => `${h.crossed}/${h.rounds}`), cell(h => h.eOut == null ? '—' : (+h.eOut).toFixed(3))].join(' | ')} |`);
  }
  const onlyA = [...sa.keys()].filter(id => !sb.has(id)), onlyB = [...sb.keys()].filter(id => !sa.has(id));
  if (onlyA.length) lines.push('', `Only in ${a}: ${onlyA.join(', ')}`); if (onlyB.length) lines.push('', `Only in ${b}: ${onlyB.join(', ')}`);
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------- run
mkdirSync(OUT!, { recursive: true });
const byTag = new Map<string, Map<string, Scene>>(); const made: { svg: string; w: number; h: number }[] = [];
for (const tag of TAGS) {
  const m = new Map<string, Scene>(); byTag.set(tag, m);
  const ids = scenesOf(tag); if (!ids.length) console.error(`  ! no scenes for tag ${tag} in ${IN}`);
  for (const id of ids) { const s = load(tag, id); if (!s) continue; m.set(id, s); const p = plot(s); const f = resolve(OUT!, `${tag}.${id}.svg`); writeFileSync(f, p.svg); made.push({ svg: f, w: p.w, h: p.h }); }
  console.log(`${tag}: ${m.size} scenes plotted`);
}
for (let i = 1; i < TAGS.length; i++) {
  const a = TAGS[0], b = TAGS[i]; const md = compare(a, b, byTag.get(a)!, byTag.get(b)!); const f = resolve(OUT!, `compare.${a}-${b}.md`);
  if (md) { writeFileSync(f, md); console.log(`wrote ${f}`); } else console.log(`no scene in both ${a} and ${b}: no compare table`);
}
if (PNG) {
  if (!existsSync(CHROME)) console.log(`--png: no Chromium at ${CHROME} — PNGs skipped`);
  else {
    const prof = resolve(OUT!, '.chrome-profile'); let ok = 0; let refused = '';
    for (const m of made) {
      const png = m.svg.replace(/\.svg$/, '.png');
      const r = Bun.spawnSync([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${prof}`, `--screenshot=${png}`, `--window-size=${m.w},${m.h + CHROME_PAD}`, `file://${m.svg}`], { stdout: 'pipe', stderr: 'pipe', timeout: 60000 });
      if (r.exitCode === 0 && existsSync(png)) ok++; else { refused = `exit ${r.exitCode}: ${r.stderr.toString().trim().split('\n').slice(-2).join(' | ')}`; if (!ok) break; }
    }
    try { rmSync(prof, { recursive: true, force: true }); } catch { /* the profile is scratch */ }
    console.log(refused ? `--png: Chromium refused (${refused}) — ${ok}/${made.length} PNGs written, the rest skipped` : `--png: ${ok} PNGs written`);
  }
}
console.log(`${made.length} SVGs → ${resolve(OUT!)}`);
