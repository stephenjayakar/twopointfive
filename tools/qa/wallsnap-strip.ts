// Strips of the wall hold (src/game/wallsnap.ts) as stick figures: the whole Game stepped headless, Sam's joints drawn frame by frame from above and in
// elevation along the wall. What it shows is the skeleton and where the gun points — no skin, no light: how a motion is looked at on a box with no GPU.
//
//   bun run tools/qa/wallsnap-strip.ts [--out dir]     → dir/wallsnap-take.svg, wallsnap-stack.svg, wallsnap-cover.svg (+ .png where a headless Chromium is found)
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { ROOT } from './headless.ts';
import { world } from './wallsnap-probes.ts';
const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
type P3 = [number, number, number];
const SHELL = (() => { const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; if (!existsSync(base)) return null; for (const d of readdirSync(base)) { const f = `${base}/${d}/chrome-linux/headless_shell`; if (existsSync(f)) return f; } return null; })();

interface Fig { b: Record<string, P3>; gun: [P3, P3] | null; label: string; }
const CHAINS: [string[], string, number][] = [
  [['hips', 'thighL', 'shinL', 'footL', 'toeL'], '#7d93b8', 7], [['hips', 'thighR', 'shinR', 'footR', 'toeR'], '#3f5f96', 7],
  [['hips', 'spine2', 'chest', 'neck', 'head'], '#23324d', 11],
  [['chest', 'upperArmL', 'forearmL', 'handL'], '#7d93b8', 6], [['chest', 'upperArmR', 'forearmR', 'handR'], '#3f5f96', 6],
];
const snap = (S: any, label: string): Fig => { const c = S.c, pl = S.pl; const b: Record<string, P3> = {}; for (const k of new Set(CHAINS.flatMap(x => x[0]))) b[k] = [...c.bones[k]] as P3;
  const gun = pl.gunInHand?.() ?? (!pl.holstered) ? [[...c.bones.handR] as P3, [...c.muzzle] as P3] as [P3, P3] : null; return { b, gun, label }; };

/** one strip: a row of cells from above (north up: the wall along the top) and a row in elevation looking along the wall (the wall on the left) */
function strip(title: string, rows: { name: string; figs: Fig[]; wallZ: number; x0: (f: Fig) => number; corner?: number }[], note: string): string {
  const K = 95, CW = 190, TOPH = 200, ELH = 215, PAD = 16, HEAD = 46, ROWH = TOPH + ELH + 34;
  const n = Math.max(...rows.map(r => r.figs.length)), Wd = PAD * 2 + n * CW, Ht = HEAD + rows.length * ROWH + 30;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Ht}" font-family="system-ui, sans-serif" font-size="12"><rect width="100%" height="100%" fill="#f6f4ee"/><text x="${PAD}" y="22" font-size="15" font-weight="600" fill="#1c2433">${title}</text><text x="${PAD}" y="38" fill="#5a6373">${note}</text>`;
  rows.forEach((r, ri) => { const y0 = HEAD + ri * ROWH;
    s += `<text x="${PAD}" y="${y0 + 12}" font-weight="600" fill="#1c2433">${r.name}</text>`;
    r.figs.forEach((f, i) => { const ox = PAD + i * CW, cx = r.x0(f);
      // from above: north up (the wall along the top), +x to the right — the game camera's own view at yaw 0
      const tx = (p: P3) => ox + CW / 2 + (p[0] - cx) * K, ty = (p: P3) => y0 + 34 + (p[2] - r.wallZ) * K;
      s += `<rect x="${ox + 2}" y="${y0 + 20}" width="${CW - 4}" height="${TOPH - 8}" fill="#fff" stroke="#d9d4c7"/>`;
      const wx0 = r.corner !== undefined ? Math.max(ox + 2, Math.min(ox + CW - 2, tx([r.corner, 0, 0]))) : ox + 2;
      s += `<rect x="${wx0}" y="${y0 + 20}" width="${ox + CW - 2 - wx0}" height="14" fill="#8a8272"/>`;
      for (const [ch, col, w] of CHAINS) s += `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" points="${ch.map(k => `${tx(f.b[k]).toFixed(1)},${ty(f.b[k]).toFixed(1)}`).join(' ')}"/>`;
      s += `<circle cx="${tx(f.b.head).toFixed(1)}" cy="${ty(f.b.head).toFixed(1)}" r="9" fill="#23324d"/>`;
      if (f.gun) s += `<line x1="${tx(f.gun[0]).toFixed(1)}" y1="${ty(f.gun[0]).toFixed(1)}" x2="${tx(f.gun[1]).toFixed(1)}" y2="${ty(f.gun[1]).toFixed(1)}" stroke="#b5462f" stroke-width="4" stroke-linecap="round"/>`;
      // elevation: looking along the wall, the wall on the left, the floor along the bottom
      const ey0 = y0 + 20 + TOPH, ex = (p: P3) => ox + 26 + (p[2] - r.wallZ) * K, ey = (p: P3) => ey0 + ELH - 22 - p[1] * K;
      s += `<rect x="${ox + 2}" y="${ey0}" width="${CW - 4}" height="${ELH - 8}" fill="#fff" stroke="#d9d4c7"/><rect x="${ox + 2}" y="${ey0}" width="24" height="${ELH - 22}" fill="#8a8272"/><line x1="${ox + 2}" y1="${ey0 + ELH - 22}" x2="${ox + CW - 2}" y2="${ey0 + ELH - 22}" stroke="#8a8272" stroke-width="2"/>`;
      for (const [ch, col, w] of CHAINS) s += `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" points="${ch.map(k => `${ex(f.b[k]).toFixed(1)},${ey(f.b[k]).toFixed(1)}`).join(' ')}"/>`;
      s += `<circle cx="${ex(f.b.head).toFixed(1)}" cy="${(ey(f.b.head) - 6).toFixed(1)}" r="9" fill="#23324d"/>`;
      if (f.gun) s += `<line x1="${ex(f.gun[0]).toFixed(1)}" y1="${ey(f.gun[0]).toFixed(1)}" x2="${ex(f.gun[1]).toFixed(1)}" y2="${ey(f.gun[1]).toFixed(1)}" stroke="#b5462f" stroke-width="4" stroke-linecap="round"/>`;
      s += `<text x="${ox + CW / 2}" y="${ey0 + ELH + 8}" text-anchor="middle" fill="#1c2433">${f.label}</text>`; }); });
  return s + `<text x="${PAD}" y="${Ht - 8}" fill="#5a6373">top of each pair: from above, the wall along the top · bottom: looking along the wall, the wall on the left · dark limbs = his right · red = the gun</text></svg>`;
}

const oi = process.argv.indexOf('--out'); const out = resolve(oi >= 0 ? process.argv[oi + 1] : `${ROOT}/docs/shots/wallsnap`); mkdirSync(out, { recursive: true });
const write = (name: string, svg: string) => { const f = `${out}/${name}.svg`; writeFileSync(f, svg); const m = /width="(\d+)" height="(\d+)"/.exec(svg)!;
  const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${out}/${name}.png`, `--window-size=${m[1]},${m[2]}`, `file://${f}`]) : null; console.log(`${f}${r && r.status === 0 ? ' (+ .png)' : ''}`); };
const NORTH = 10.06;

// ---- the take: nose to the wall, half a metre off it, the pistol in hand; every third frame
{ const takes: Fig[][] = [];
  for (const on of [false, true]) { const S = await world(on); S.place(21, 11.0, 180, 'pistol'); const figs: Fig[] = [snap(S, 'the key')]; S.tap('KeyQ');
    for (let f = 1; f <= 21; f++) { S.step(1); if (f % 3 === 0) figs.push(snap(S, `${f} f · ${Math.round(f / 60 * 1000)} ms`)); } takes.push(figs); }
  WALLSNAP.on = false;
  write('wallsnap-take', strip('Back to the wall: the take, from nose-to-wall half a metre off', [
    { name: 'before (switch off): one fixed glide, the feet carried', figs: takes[0], wallZ: NORTH, x0: f => 21 },
    { name: 'after (switch on): off the mark on the key, the turn ahead of the glide, the feet step, the pelvis settles', figs: takes[1], wallZ: NORTH, x0: f => 21 },
  ], 'stick figure of the skeleton, 60 frames a second, no renderer')); }

// ---- the stack: the rifle in his hands when Q goes down; before = it is slung and his back goes to the wall
{ const rows: Fig[][] = [];
  for (const on of [false, true]) { const S = await world(on); S.place(21.5, 10.95, 270, 'rifle'); S.setCursor([15, 1.2, 10.95]); S.step(20); const figs: Fig[] = [snap(S, 'the key')]; S.tap('KeyQ');
    for (const [n, l] of [[6, '6 f'], [8, '14 f'], [40, 'settled']] as [number, string][]) { S.step(n); figs.push(snap(S, l)); }
    if (on) { S.keys('KeyA'); S.step(40); figs.push(snap(S, 'walking along it')); S.keys(); S.step(30); S.setCursor([21.5 - 3, 1.2, 12]); S.step(20); S.click(); S.step(14); figs.push(snap(S, 'a click: up, then the round')); S.step(100); figs.push(snap(S, '1.2 s on: low again')); }
    rows.push(figs); }
  WALLSNAP.on = false;
  write('wallsnap-stack', strip('Q with the rifle in his hands', [
    { name: 'before (switch off): the rifle is slung, his back goes to the wall', figs: rows[0], wallZ: NORTH, x0: f => f.b.hips[0] },
    { name: 'after (switch on): he stacks — shoulder to the wall, facing along it, low ready; a click raises it', figs: rows[1], wallZ: NORTH, x0: f => f.b.hips[0] },
  ], 'stick figure of the skeleton, no renderer')); }

// ---- cover: parked at the conference doorway's jamb (the corner at x 10.2), the cursor into the room
{ const S = await world(true); const CX = 10.2; S.place(CX + 0.7, 10.8, 270, 'rifle'); S.setCursor([7, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(40); S.keys('KeyA'); S.step(60); S.keys(); S.step(20);
  const figs: Fig[] = [snap(S, 'parked at the end')]; S.setCursor([CX - 0.5, 1.2, 8.4]);
  for (const [n, l] of [[5, 'cursor in: 5 f'], [5, '10 f'], [6, '16 f: out, rifle up']] as [number, string][]) { S.step(n); figs.push(snap(S, l)); }
  S.click(); S.step(3); figs.push(snap(S, 'a click fires')); S.setCursor([CX - 4, 1.2, 11.2]); S.step(45); figs.push(snap(S, 'cursor back: in'));
  WALLSNAP.on = false;
  write('wallsnap-cover', strip('On the stack at an open end: the cursor round the corner steps him out', [
    { name: 'the conference room doorway (the wall ends where the grey bar ends)', figs, wallZ: NORTH, x0: () => CX - 0.1, corner: CX },
  ], 'stick figure of the skeleton, no renderer')); }
