// Pose strips: the real Character / CharacterAnimator stepped headless at 1/60 and drawn as a capsule figure (the same 15 proxies the renderer shadows him with) in
// two views — from the side, and from a top-down three-quarter view near the game camera's pitch — as one SVG (and a PNG beside it through the box's headless Chromium when it is
// there). No renderer, no browser: this is how a motion is LOOKED at in a box with no GPU. What it shows is the skeleton's pose; skinning, cloth and light it does not.
//
//   bun run tools/qa/pose-strip.ts list                     → the scenarios
//   bun run tools/qa/pose-strip.ts <name> [--out dir]       → dir/<name>.svg (+ .png)
//   bun run tools/qa/pose-strip.ts all [--out dir]
//   bun run tools/qa/pose-strip.ts <name> --moves off       → the same scenario with the MOVES and TURN switches off (the build as it was)
//
// A scenario is a function (S) => void that makes one or two Characters, steps them, and calls S.shot(label) when a frame should be drawn.
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
// the PNG beside each SVG comes from the box's pre-installed headless Chromium (PLAYWRIGHT_BROWSERS_PATH), if there is one
const SHELL = (() => { const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; if (!existsSync(base)) return null; for (const d of readdirSync(base)) { const f = `${base}/${d}/chrome-linux/headless_shell`; if (existsSync(f)) return f; } return null; })();
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const { loadCharacter } = await import(`${ROOT}/tools/qa/headless.ts`);
const CH = await import(`${ROOT}/src/game/character.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
type Vec3 = [number, number, number];
const ch: any = await loadCharacter();
export const DT = 1 / 60;

// ---- seeded dice: the constructors and the ragdoll's shove draw from Math.random
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);

interface Fig { caps: number[][]; gun: [Vec3, Vec3] | null; mag: [Vec3, Vec3] | null; tone: number; }
interface Shot { label: string; figs: Fig[]; marks: [Vec3, Vec3, string][]; }
export interface Stage {
  /** a fresh figure: `rifle` puts a long gun in his hands (the squad / the defenders' carbine), `steady` = the operators' steadied carriage */
  man(o?: { id?: number; pos?: Vec3; yaw?: number; rifle?: boolean; steady?: number; tone?: number }): any;
  /** step every figure n frames (each man's `drive` callback, if set, runs before his update) */
  step(n?: number): void;
  /** run for `secs`, calling fn(t) each frame before the step */
  run(secs: number, fn?: (t: number) => void): void;
  shot(label: string): void;
  /** a world-space line drawn in every later shot (a wall, a door, a round's line) */
  mark(a: Vec3, b: Vec3, colour?: string): void;
  t: number;
}

function makeStage(): { S: Stage; shots: Shot[] } {
  const men: any[] = []; const shots: Shot[] = []; const marks: [Vec3, Vec3, string][] = [];
  const S: Stage = {
    t: 0,
    man(o = {}) {
      const c = new CH.Character(ch, { id: o.id ?? men.length + 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: o.pos ?? [0, 0, 0], yaw: o.yaw ?? 0 });
      c.anim.phase = 0; c.__tone = o.tone ?? men.length;
      if (o.rifle) { c.anim.longGun = true; c.anim.longSteady = o.steady ?? 0; c.muzzleAhead = 0.5; c.__rifle = true; }
      c.anim.upper = 'relaxed'; men.push(c); c.update(0); return c;
    },
    step(n = 1) { for (let i = 0; i < n; i++) { for (const c of men) { c.drive?.(S.t); if (c.vel && !c.ragdoll) { c.pos = [c.pos[0] + c.vel[0] * DT, c.pos[1], c.pos[2] + c.vel[2] * DT]; } c.update(DT); } S.t += DT; } },
    run(secs, fn) { const n = Math.round(secs / DT); for (let i = 0; i < n; i++) { fn?.(S.t); S.step(1); } },
    shot(label) {
      shots.push({ label, marks: marks.map(m => [m[0], m[1], m[2]]), figs: men.map(c => {
        const caps = c.capsules().caps.map((k: number[]) => [...k]);
        const b = c.bones; let gun: [Vec3, Vec3] | null = null;
        if (b.handR && !c.ragdoll && (c.__rifle || c.__pistol || c.anim.upper === 'aim' || c.anim.upper === 'relaxed')) { const back = c.__rifle ? 0.28 : 0.02, ahead = c.__rifle ? 0.5 : 0.2; gun = [v3.mad(b.handR, c.gunDir, -back), v3.mad(b.handR, c.gunDir, ahead)]; }
        // the long gun's magazine where the rig draws it (rigProps: ahead of the grip on the carbine, behind it on the bullpup), so a hand going to it can be read
        let mag: [Vec3, Vec3] | null = null;
        if (gun && c.__rifle) { const u = c.gunUnder(), z = c.anim.reloadBack ? -0.12 : 0.1, top = v3.mad(v3.mad(b.handR, c.gunDir, z), u, 0.04); mag = [top, v3.mad(v3.mad(top, u, c.anim.reloadBack ? 0.13 : 0.19), c.gunDir, c.anim.reloadBack ? 0 : 0.06)]; }
        return { caps, gun, mag, tone: c.__tone };
      }) });
    },
    mark(a, b, colour = '#888') { marks.push([a, b, colour]); },
  };
  return { S, shots };
}

// ---- drawing: orthographic, two views per shot
interface View { r: Vec3; u: Vec3; d: Vec3; name: string; }
const norm = (a: Vec3): Vec3 => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function view(name: string, azDeg: number, pitchDeg: number): View {   // the camera looks along d: az = where it looks in the ground plane (0 = +z, 90 = +x), pitch = degrees down
  const az = azDeg * Math.PI / 180, p = pitchDeg * Math.PI / 180;
  const d: Vec3 = [Math.sin(az) * Math.cos(p), -Math.sin(p), Math.cos(az) * Math.cos(p)];
  const r = norm(cross([0, 1, 0], d)); const u = cross(d, r);
  return { r, u, d, name };
}
const SIDE_L = view('side', -90, 0);        // from his LEFT (opts.side 'left': what the support hand does shows): forward runs to the RIGHT
const SIDE = view('side', 90, 0);          // looking along +x from his right: forward (+z) runs to the LEFT of the picture
const TOP = view('game', 200, 55);         // the game camera's pitch, from ahead and a little to one side
// capsule index → what it is: 0 lower torso, 1 chest, 2 shoulder line, 3 pelvis, 4 head, 5/6 arm L, 7/8 arm R, 9/10/11 leg L, 12/13/14 leg R
const PART = ['trunk', 'trunk', 'trunk', 'trunk', 'head', 'armL', 'armL', 'armR', 'armR', 'legL', 'legL', 'legL', 'legR', 'legR', 'legR'];
const COL: Record<string, string[]> = {
  trunk: ['#5b6470', '#7a6a55'], head: ['#c9a98a', '#c9a98a'], armL: ['#3f7fb5', '#5f9fd5'], legL: ['#35699a', '#5589ba'], armR: ['#c8762f', '#e0964f'], legR: ['#a8601f', '#c8803f'],
};
function drawView(sh: Shot, V: View, ox: number, oy: number, W: number, H: number, scale: number, centre: Vec3, floorY: number): string {
  const P = (p: number[] | Vec3): [number, number, number] => { const q: Vec3 = [p[0] - centre[0], p[1] - centre[1], p[2] - centre[2]]; return [ox + W / 2 + dot(q, V.r) * scale, oy + floorY - dot(q, V.u) * scale, dot(q, V.d)]; };
  let s = `<g clip-path="url(#c${ox}_${oy})"><clipPath id="c${ox}_${oy}"><rect x="${ox}" y="${oy}" width="${W}" height="${H}"/></clipPath>`;
  // floor: a half-metre grid in the world (so travel shows), drawn only where it projects sensibly
  const gx0 = Math.floor(centre[0]) - 3, gz0 = Math.floor(centre[2]) - 3;
  if (Math.abs(V.d[1]) > 0.2) {
    for (let i = 0; i <= 12; i++) {
      const a = P([gx0 + i * 0.5, 0, gz0]), b = P([gx0 + i * 0.5, 0, gz0 + 6]), c2 = P([gx0, 0, gz0 + i * 0.5]), d2 = P([gx0 + 6, 0, gz0 + i * 0.5]);
      s += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#d8d8d8" stroke-width="${i % 2 ? 0.5 : 1}"/>`;
      s += `<line x1="${c2[0].toFixed(1)}" y1="${c2[1].toFixed(1)}" x2="${d2[0].toFixed(1)}" y2="${d2[1].toFixed(1)}" stroke="#d8d8d8" stroke-width="${i % 2 ? 0.5 : 1}"/>`;
    }
  } else {
    const a = P([centre[0], 0, centre[2]]); s += `<line x1="${ox}" y1="${a[1].toFixed(1)}" x2="${ox + W}" y2="${a[1].toFixed(1)}" stroke="#999" stroke-width="1"/>`;
    for (let i = -6; i <= 6; i++) { const z = Math.round(centre[2] * 2) / 2 + i * 0.5; const t = P([centre[0], 0, z]); s += `<line x1="${t[0].toFixed(1)}" y1="${t[1].toFixed(1)}" x2="${t[0].toFixed(1)}" y2="${(t[1] + (Math.abs(z % 1) < 1e-6 ? 8 : 4)).toFixed(1)}" stroke="#999" stroke-width="1"/>`; }
  }
  for (const m of sh.marks) { const a = P(m[0]), b = P(m[1]); s += `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${m[2]}" stroke-width="3"/>`; }
  // every capsule of every figure, far to near
  const items: { z: number; svg: string }[] = [];
  for (const f of sh.figs) {
    f.caps.forEach((k, i) => {
      const a = P([k[0], k[1], k[2]]), b = P([k[4], k[5], k[6]]); const w = k[3] * 2 * scale; const col = COL[PART[i]][f.tone % 2];
      const line = (stroke: string, sw: number) => `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="${stroke}" stroke-width="${sw.toFixed(1)}" stroke-linecap="round"/>`;
      items.push({ z: (a[2] + b[2]) / 2, svg: line('#1b1b1b', w + 2.4) + line(col, w) });
    });
    if (f.gun) { const a = P(f.gun[0]), b = P(f.gun[1]); items.push({ z: (a[2] + b[2]) / 2 - 0.02, svg: `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#111" stroke-width="${(0.05 * scale).toFixed(1)}" stroke-linecap="butt"/>` }); }
    if (f.mag) { const a = P(f.mag[0]), b = P(f.mag[1]); items.push({ z: (a[2] + b[2]) / 2 - 0.02, svg: `<line x1="${a[0].toFixed(1)}" y1="${a[1].toFixed(1)}" x2="${b[0].toFixed(1)}" y2="${b[1].toFixed(1)}" stroke="#7a2d2d" stroke-width="${(0.04 * scale).toFixed(1)}" stroke-linecap="butt"/>` }); }
  }
  items.sort((x, y) => y.z - x.z); for (const it of items) s += it.svg;
  return s + '</g>';
}
function render(name: string, title: string, shots: Shot[], opts: { scale?: number; follow?: boolean; side?: 'left' } = {}): string {
  const scale = opts.scale ?? 150, W = 300, Hs = 330, Ht = 330, pad = 6, head = 40;
  const cols = shots.length; const width = cols * (W + pad) + pad, height = head + Hs + Ht + 3 * pad + 18;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif"><rect width="100%" height="100%" fill="#fff"/>`;
  s += `<text x="${pad}" y="22" font-size="17" font-weight="bold">${name}</text><text x="${pad + 8 + name.length * 10.5}" y="22" font-size="13" fill="#444">${title}</text>`;
  shots.forEach((sh, i) => {
    const ox = pad + i * (W + pad);
    // centre each cell on the first figure's pelvis (so a walk shows the grid going by under him), or on the first shot's when not following
    const ref = (opts.follow === false ? shots[0] : sh).figs[0].caps[3]; const centre: Vec3 = [(ref[0] + ref[4]) / 2, 0, (ref[2] + ref[6]) / 2];
    s += `<rect x="${ox}" y="${head}" width="${W}" height="${Hs}" fill="#fafafa" stroke="#ccc"/>` + drawView(sh, opts.side === 'left' ? SIDE_L : SIDE, ox, head, W, Hs, scale, centre, Hs - 24);
    s += `<rect x="${ox}" y="${head + Hs + pad}" width="${W}" height="${Ht}" fill="#fafafa" stroke="#ccc"/>` + drawView(sh, TOP, ox, head + Hs + pad, W, Ht, scale, centre, Ht * 0.62);
    s += `<text x="${ox + 4}" y="${head + 15}" font-size="13" fill="#222">${sh.label}</text>`;
  });
  s += `<text x="${pad}" y="${height - 6}" font-size="11" fill="#666">top row: ${opts.side === 'left' ? 'from his left side (forward is to the right)' : 'from his right side (forward is to the left)'} · bottom row: 55° down from ahead, as the game looks · orange = his right arm and leg, blue = his left · dark red = the magazine · black bar = the weapon · grid 0.5 m</text>`;
  return s + '</svg>';
}

// ---------------------------------------------------------------- scenarios
type Scenario = { title: string; opts?: { scale?: number; follow?: boolean; side?: 'left' }; run: (S: Stage) => void };
export const SCENARIOS: Record<string, Scenario> = {};
const scenariosMod = await import(`${ROOT}/tools/qa/pose-scenarios.ts`);
scenariosMod.register(SCENARIOS, CH);

// ---------------------------------------------------------------- main
if (import.meta.main) {
  const args = process.argv.slice(2); const want = args.find(a => !a.startsWith('--')) ?? 'list';
  const oi = args.indexOf('--out'); const out = resolve(oi >= 0 ? args[oi + 1] : `${ROOT}/docs/shots/moves`);
  const mi = args.indexOf('--moves'); const movesOff = mi >= 0 && args[mi + 1] === 'off';
  const suffix = movesOff ? '-before' : '';
  if (want === 'list') { for (const [k, v] of Object.entries(SCENARIOS)) console.log(k.padEnd(18), v.title); process.exit(0); }
  const names = want === 'all' ? Object.keys(SCENARIOS) : want.split(',');
  mkdirSync(out, { recursive: true });
  for (const name of names) {
    const sc = SCENARIOS[name]; if (!sc) { console.error(`unknown scenario ${name}`); process.exit(2); }
    Math.random = mulberry32(7);
    if (CH.MOVES) CH.setMoves?.(!movesOff);
    if (CH.TURN) CH.TURN.on = movesOff ? 0 : 1;   // (the turn weight goes with it: only the turn-* scenarios weigh a man)
    const { S, shots } = makeStage(); sc.run(S);
    const svg = render(name + suffix, sc.title + (movesOff ? ' — MOVES off (the build as it was)' : ''), shots, sc.opts);
    const f = `${out}/${name}${suffix}.svg`; writeFileSync(f, svg);
    const m = /width="(\d+)" height="(\d+)"/.exec(svg)!;
    const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${out}/${name}${suffix}.png`, `--window-size=${m[1]},${m[2]}`, `file://${f}`]) : null;
    console.log(`${f}${r && r.status === 0 ? ' (+ .png)' : ' (no png: no headless Chromium found)'}`);
  }
}
