// FALLEN GLASS, PLOTTED (no GPU): the same shots at the conference partition's pane with the cut switch off and on, drawn as outlines.
//   bun run tools/qa/cutglass-plot.ts --out DIR [--seed N] [--png]
//   → DIR/cutglass-shapes.svg   every cell that fell out of the pane (dashed) with the plate(s) made of it AS MADE (solid), seen square on: rectangles | cut plates
//     DIR/cutglass-rest.svg     the plates lying on the floor once everything has come to rest, seen from above
// A PLOT OF THE SIMULATION'S SHAPES, not a render: it says what the pieces ARE, not how the picture draws them (tools/qa/cutglass-stills.cjs is the picture).
// --png rasterises both with the pre-installed headless Chromium (skipped with a line if it will not run).
import { mkdirSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { standUp, ROOT, fake } from './headless.ts';
import { CONF_PANE } from './office-pane.ts';
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const { Particles } = await import(`${ROOT}/src/render/particles.ts`);
const { cutConfig } = await import(`${ROOT}/src/scene/cut.ts`);

type Vec3 = [number, number, number]; type Pt = [number, number];
const argv = process.argv.slice(2); const arg = (k: string) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = arg('--out'); const SEED = Number(arg('--seed') ?? 7); const PNG = argv.includes('--png');
if (!OUT) { console.error('usage: bun run tools/qa/cutglass-plot.ts --out DIR [--seed N] [--png]'); process.exit(2); }
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'; const CHROME_PAD = 87;   // (the headless window's own chrome: the viewport is that much shorter than --window-size)

const DT = 1 / 60; const PANE = CONF_PANE;
// (the stills driver's shots, in the same order: ten, a pause, the last six again)
const SHOTS: Pt[] = [[0.1, 0.1], [0.11, 0.1], [0.12, 0.11], [-0.5, -0.3], [-0.49, -0.3], [0.6, 0.4], [0.61, 0.41], [-0.2, 0.6], [-0.21, 0.6], [0.3, -0.6]];
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

interface Plate { world: Vec3[]; cut: boolean; tint: Vec3 }
/** a plate's outline in the world: its cut outline, or the big face of the plain box (the thin axis is the smallest half extent) */
function outlineOf(c: any): Plate {
  const b = c.box; const rot = b.rot ?? quat.yaw(b.yaw); const poly: Pt[] | undefined = b.cut ? c.glass.poly : undefined;
  let local: Vec3[];
  if (poly) local = poly.map(p => [p[0], p[1], 0] as Vec3);
  else { const h = b.h as Vec3; const t = h[0] <= h[1] && h[0] <= h[2] ? 0 : h[1] <= h[2] ? 1 : 2; const a = (t + 1) % 3, e = (t + 2) % 3;
    local = ([[-1, -1], [1, -1], [1, 1], [-1, 1]] as Pt[]).map(s => { const p: Vec3 = [0, 0, 0]; p[a] = s[0] * h[a]; p[e] = s[1] * h[e]; return p; }); }
  return { world: local.map(p => v3.add(b.c, quat.rotate(rot, p)) as Vec3), cut: !!poly, tint: c.glass.tint };
}

async function run(on: boolean) {
  const was = cutConfig.on; const keys = ['CUTBOXES', 'CUT_BOXES'].filter(k => process.env[k] !== undefined), had = keys.map(k => process.env[k]!); cutConfig.on = on; for (const k of keys) process.env[k] = on ? '1' : '0';
  try {
    Math.random = seeded(SEED);
    const W = await standUp(); const { game, engine } = W;
    engine.particles = new Particles(fake('device'), fake('sceneLayout')); engine.settings.gpuParticles = true;
    game.godMode = true; game.player.visibility = 0.02; game.tune.chaos = 0.5; game.tune.glassBreak = true; game.tune.glassShards = true;
    for (let i = 0; i < 5; i++) W.step(DT);
    game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.pinned = true; gd.char.pos = [37.5, 0, 6 + i * 1.5]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.path = []; gd.pathGoal = null; gd.heardUpTo = 1e12; gd.dazzledUntil = 1e9; gd.flashlight.enabled = false; });
    game.teleportPlayer([30, 0, 20]); W.step(DT); W.step(DT);
    const P = engine.particles; const flush = () => { P.pending.length = 0; P.pendingImpulses.length = 0; };
    const S = game.shards, D = game.destr.debris, gb = game.glassBreak;
    const made: { cell: Vec3[]; plates: Plate[] }[] = []; const orig = S.release.bind(S);
    S.release = (f: any) => { const before = new Set(D.list); const r = orig(f); made.push({ cell: f.outline.map((p: Vec3) => p.slice() as Vec3), plates: D.list.filter((c: any) => c.glass && !before.has(c)).map(outlineOf) }); return r; };
    let peak = 0; const step = (n: number) => { for (let f = 0; f < n; f++) { W.step(DT); flush(); peak = Math.max(peak, D.list.length); } };
    const hit = (s: Pt) => gb.hit(PANE, [7.5 + s[0], 1.5 + s[1], 10], [0, 0, -1], 1);
    for (const s of SHOTS) { hit(s); step(18); }
    step(90); for (const s of SHOTS.slice(-6)) hit(s); step(609);
    const rest = D.list.filter((c: any) => c.glass).map(outlineOf);
    return { made, rest, peak, cap: D.cap(), atRest: D.list.filter((c: any) => c.glass && c.rest).length };
  } finally { cutConfig.on = was; keys.forEach((k, i) => { process.env[k] = had[i]; }); }
}

const off = await run(false), on = await run(true);

// ---------------------------------------------------------------- drawing
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const rgb = (t: Vec3, k = 1) => `rgb(${t.map(x => Math.round(Math.min(1, x * k) * 255)).join(',')})`;
function panel(title: string, sub: string, ox: number, w: number, h: number, box: [number, number, number, number], draw: (X: (x: number) => number, Y: (y: number) => number) => string): string {
  const [x0, y0, x1, y1] = box; const M = 14, T = 44; const s = Math.min((w - 2 * M) / (x1 - x0), (h - T - M) / (y1 - y0));
  const X = (x: number) => ox + M + (x - x0) * s, Y = (y: number) => T + (y1 - y) * s;
  return `<text x="${ox + M}" y="20" class="t">${esc(title)}</text><text x="${ox + M}" y="36" class="s">${esc(sub)}</text><rect x="${X(x0)}" y="${Y(y1)}" width="${(x1 - x0) * s}" height="${(y1 - y0) * s}" class="f"/>${draw(X, Y)}`;
}
const path = (pts: Pt[], X: (x: number) => number, Y: (y: number) => number) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)} ${Y(p[1]).toFixed(1)}`).join('') + 'Z';
const STYLE = `<style>text{font-family:ui-sans-serif,system-ui,sans-serif;fill:#d8dde3}.t{font-size:14px;font-weight:600}.s{font-size:11px;fill:#8f99a5}.f{fill:#15191e;stroke:#39424d}.cell{fill:none;stroke:#e8b04a;stroke-width:1;stroke-dasharray:3 2}.pl{stroke:#eaf4ff;stroke-width:1;fill-opacity:.55}</style>`;
function sheet(file: string, w: number, h: number, box: [number, number, number, number], proj: (p: Vec3) => Pt, a: { title: string; sub: string; body: (X: any, Y: any) => string }, b: { title: string; sub: string; body: (X: any, Y: any) => string }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${2 * w}" height="${h}" viewBox="0 0 ${2 * w} ${h}"><rect width="100%" height="100%" fill="#0e1114"/>${STYLE}${panel(a.title, a.sub, 0, w, h, box, a.body)}${panel(b.title, b.sub, w, w, h, box, b.body)}</svg>`;
  writeFileSync(file, svg); console.log(`wrote ${file}`); return { svg: file, w: 2 * w, h };
}
const front = (p: Vec3): Pt => [p[0], p[1]];          // square on to the pane (it stands in the plane z = 10)
const above = (p: Vec3): Pt => [p[0], -p[2]];         // from above, the corridor side at the bottom
const shapes = (r: typeof off) => (X: any, Y: any) => r.made.map(m =>
  m.plates.map(p => `<path d="${path(p.world.map(front), X, Y)}" class="pl" fill="${rgb(p.tint, 0.9)}"/>`).join('') + `<path d="${path(m.cell.map(front), X, Y)}" class="cell"/>`).join('');
const rest = (r: typeof off) => (X: any, Y: any) => r.rest.map((p: any) => `<path d="${path(p.world.map(above), X, Y)}" class="pl" fill="${rgb(p.tint, 0.9)}"/>`).join('');
const count = (r: typeof off) => r.made.reduce((n, m) => n + m.plates.length, 0);

mkdirSync(resolve(OUT), { recursive: true });
const sheets = [
  sheet(resolve(OUT, 'cutglass-shapes.svg'), 620, 520, [6.7, 0.2, 8.3, 2.8], front,
    { title: 'Before: each fallen cell as rectangles', sub: `${off.made.length} cells (dashed) became ${count(off)} plates · pool peak ${off.peak} of ${off.cap}`, body: shapes(off) },
    { title: 'After: each fallen cell is one plate, cut to its outline', sub: `${on.made.length} cells (dashed) became ${count(on)} plates · pool peak ${on.peak} of ${on.cap}`, body: shapes(on) }),
  sheet(resolve(OUT, 'cutglass-rest.svg'), 620, 520, [6.3, -10.5, 8.9, -8.7], above,
    { title: 'Before: the plates at rest, from above', sub: `${off.rest.length} plates on the floor, ${off.atRest} at rest`, body: rest(off) },
    { title: 'After: the plates at rest, from above', sub: `${on.rest.length} plates on the floor, ${on.atRest} at rest`, body: rest(on) }),
];
console.log(`cells ${off.made.length} / ${on.made.length} · plates as made ${count(off)} → ${count(on)} · on the floor ${off.rest.length} → ${on.rest.length} · pool peak ${off.peak} → ${on.peak} of ${on.cap}`);
if (PNG) {
  if (!existsSync(CHROME)) console.log(`--png: no Chromium at ${CHROME}: PNGs skipped`);
  else for (const m of sheets) {
    const png = m.svg.replace(/\.svg$/, '.png'); const prof = mkdtempSync(resolve(tmpdir(), 'cutglass-plot-'));
    const r = Bun.spawnSync([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--user-data-dir=${prof}`, `--screenshot=${png}`, `--window-size=${m.w},${m.h + CHROME_PAD}`, `file://${m.svg}`], { stdout: 'pipe', stderr: 'pipe', timeout: 60000 });
    console.log(r.exitCode === 0 && existsSync(png) ? `wrote ${png}` : `--png: Chromium refused (exit ${r.exitCode}): ${png} skipped`);
  }
}
process.exit(0);
