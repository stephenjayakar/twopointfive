// STEALTH STRIP: stick figures of Sam's hands-empty stealth poses (src/game/stealthpose.ts) as rows of moments, with no GPU — the crouch at a stand, the crouch
// walk, standing up and crouching down on the move, the creep near a man, the look under a door with the wand. Each is staged in the real game stood up
// headless (the page's stand unless TPS_PROFILE says otherwise) and driven by keys; what is drawn is the SKELETON as the picture has it.
//   bun run tools/qa/stealth-strip.ts [--out dir] [--tag name] [--move a,b,…] [--list] [--dump]   → dir/<move>[-tag].svg (+ .png where a headless Chromium is found)
//   TPS_STEALTHPOSE=0 in front = the poses as they were.
// Three rows a strip, in his own frame at each moment: from his right side (he faces right), from behind (or in front), from above. The darker limb is his
// right; a dot = a hand; the tick on the head = where the face points. --dump prints, per moment, the hands / knees / head in his frame (left, up, forward).
if (import.meta.main) process.env.TPS_PROFILE ??= 'shipped';   // (imported by stealthpose-check.ts: the stand is then the caller's)
import { writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
const { standUp, ROOT } = await import('./headless.ts');
const { m4 } = await import(`${ROOT}/src/math/vec.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { WAND } = await import(`${ROOT}/src/game/wand.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
type P3 = number[];
const DT = 1 / 60, EAST = Math.PI / 2;
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const log = console.log; const hush = () => { console.log = console.warn = console.error = () => {}; }, loud = () => { console.log = log; };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- what a moment keeps
/** a man as chains of points in SAM's frame (left, up, forward) + where his face points */
export interface Man { legL: P3[]; legR: P3[]; trunk: P3[]; armL: P3[]; armR: P3[]; head: P3; face: P3 }
export interface Moment { label: string; a: Man; v: Man | null; door?: number }
/** the drawn skeleton's joints (the picture's — not `bones`, which the game reads), through `rel` */
export function manOf(c: any, rel: (p: P3) => P3, dir: (d: P3) => P3): Man {
  const n = c.anim.nodes, P = (k: string): P3 => rel(m4.transformPoint(c.world, c.skel.nodePos(n[k])));
  const y = c.bodyYaw + (c.anim?.headYawShown ?? 0);
  return { legL: [P('hips'), P('thighL'), P('shinL'), P('footL'), P('toeL')], legR: [P('hips'), P('thighR'), P('shinR'), P('footR'), P('toeR')], trunk: [P('hips'), P('spine2'), P('spine3'), P('neck'), P('head')],
    armL: [P('spine3'), P('upperArmL'), P('forearmL'), P('handL'), P('middle1L')], armR: [P('spine3'), P('upperArmR'), P('forearmR'), P('handR'), P('middle1R')], head: P('head'), face: dir([Math.sin(y), 0, Math.cos(y)]) };
}
/** Sam's own frame this moment: origin at his feet, forward his body's */
export function frameOf(c: any) {
  const o = [c.pos[0], 0, c.pos[2]], y = c.bodyYaw, f = [Math.sin(y), 0, Math.cos(y)], L = [f[2], 0, -f[0]];
  const dir = (d: P3): P3 => [d[0] * L[0] + d[2] * L[2], d[1], d[0] * f[0] + d[2] * f[2]];
  return { dir, rel: (p: P3): P3 => dir([p[0] - o[0], p[1], p[2] - o[2]]) };
}
function recorder(g: any, other: any = null) {
  const moments: Moment[] = [];
  return { moments, snap(label: string, door?: number) { const F = frameOf(g.player.char); moments.push({ label, a: manOf(g.player.char, F.rel, F.dir), v: other ? manOf(other.char, F.rel, F.dir) : null, door }); } };
}

// ---------------------------------------------------------------- the stagings
export function place(gd: any, p: P3, yaw: number) { gd.char.pos = [...p]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
function park(gd: any, i: number) { gd.hold = true; gd.pinned = true; place(gd, [37.5, 0, 6 + i * 1.5], EAST); gd.heardUpTo = 1e12; }
/** the lobby's open floor: Sam alone on it (the shift parked far off, nobody perceiving anything), hands empty, crouched or not */
export async function lobby(seed: number, crouch = true, at: P3 = [6.5, 0, 19.5], first?: () => void) {
  Math.random = seeded(seed); hush(); const W: any = await standUp(); loud(); const g = W.game; first?.();   // (`first`: a check's switches, written before the first step)
  g.godMode = true; g.aiEnabled = false; g.player.visibility = 0.02; g.player.slot = 'pistol'; g.player.holstered = true;
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => park(gd, i));
  W.cam.yaw = 0; W.cam.rebuild?.();
  g.teleportPlayer(at); g.player.crouch = crouch; g.player.char.bodyYaw = g.player.char.aimYaw = EAST;
  const ahead = () => { const c = g.player.char; W.cursorAt([c.pos[0] + 7, 1.0, c.pos[2]]); };
  const step = (n = 1) => { for (let i = 0; i < n; i++) { ahead(); W.step(DT); g.player.visibility = 0.02; } };
  step(90);
  return { W, g, step };
}
async function crouchIdle() {
  const S = await lobby(7101), R = recorder(S.g);
  for (let i = 0; i <= 8; i++) { if (i) S.step(17); R.snap(`${(i * 17 / 60).toFixed(2)} s`); }
  return R.moments;
}
async function crouchWalk() {
  const S = await lobby(7102), R = recorder(S.g); S.W.input.keys.add('KeyD'); S.step(50);
  for (let i = 0; i <= 9; i++) { if (i) S.step(6); R.snap(`${(i * 0.1).toFixed(1)} s`); }
  return R.moments;
}
async function rise() {
  const S = await lobby(7103), R = recorder(S.g), pl = S.g.player; S.W.input.keys.add('KeyD'); S.step(50);
  R.snap('crouch walk'); pl.crouch = false; let f = 0;
  const to = (t: number, label: string) => { const n = Math.round(t * 60); S.step(n - f); f = n; R.snap(label); };
  for (const t of [0.1, 0.2, 0.35, 0.5, 0.75, 1.1]) to(t, `up ${t.toFixed(2)} s`);
  pl.crouch = true; const t0 = 1.1;
  for (const t of [0.1, 0.2, 0.35, 0.5, 0.8]) to(t0 + t, `down ${t.toFixed(2)} s`);
  return R.moments;
}
async function creep() {
  const S = await lobby(7104, true, [5.6, 0, 19.5]), g = S.g; CLOSE.on = true;
  const A = g.guards[0]; place(A, [10.2, 0, 19.5], EAST); A.hold = true; A.pinned = true;
  const R = recorder(g, A); S.W.input.keys.add('KeyD');
  let n = 0; while (g.player.char.pos[0] < 10.2 - 2.7 && n++ < 400) S.step(1);
  for (let i = 0; i <= 9; i++) { if (i) S.step(9); R.snap(`${(i * 0.15).toFixed(2)} s · ${(10.2 - g.player.char.pos[0]).toFixed(1)} m`); }
  return R.moments;
}
/** the office's four-man room clear (fog of war, so the wand's row is offered), Sam at the server room's door */
export async function atDoor(seed: number, first?: () => void) {
  Math.random = seeded(seed); hush(); const W: any = await standUp({ uploadEvery: 4 }); const g = W.game; WAND.on = true; first?.();
  await startFromQuery(g, 'roomclear&squad4'); for (let i = 0; i < 30; i++) W.step(DT);
  const d = g.doors.list.find((x: any) => x.def.name === 'server'), T = g.guards.find((x: any) => x.callsign === 'Tango 5');
  if (!d || !T) { loud(); throw new Error('no server door / Tango 5'); }
  const side = -g.doors.side(d, T.char.pos), u = d.dir(), [hx, hz] = d.def.hinge, w = d.def.width * 0.5;
  const nx = -u[1] * side, nz = u[0] * side, mid = [hx + u[0] * w, 0, hz + u[1] * w];
  let spot = [mid[0] + nx * 0.9, 0, mid[2] + nz * 0.9]; if (g.doors.side(d, spot) !== side) spot = [mid[0] - nx * 0.9, 0, mid[2] - nz * 0.9];
  g.aiEnabled = false; g.godMode = true; g.teleportPlayer(spot); g.player.wand = true; g.player.holstered = true;
  for (let i = 0; i < 30; i++) W.step(DT); loud();
  const begin = () => { const ok = g.selectVerb('door', 'wand'); if (ok) { W.input.pressed.add('Space'); W.step(DT); } return ok && !!g.player.wanding; };
  return { W, g, d, mid, begin };
}
async function cable() {
  const S = await atDoor(7105), g = S.g, R = recorder(g), c = g.player.char;
  const dd = () => Math.hypot(S.mid[0] - c.pos[0], S.mid[2] - c.pos[2]);
  R.snap('at the door', dd()); if (!S.begin()) throw new Error(`cable: the wand's row was not offered (rows ${g.nearby.map((x: any) => `${x.kind}:${x.verb}`).join(' ')})`);
  let f = 0; const to = (t: number, label: string) => { const n = Math.round(t * 60); for (; f < n; f++) S.W.step(DT); R.snap(label, dd()); };
  for (const t of [0.15, 0.3, 0.45, 0.7, 1.2, 2.4]) to(t, `${t.toFixed(2)} s`);
  S.W.input.pressed.add('Space'); const t0 = 2.4;
  for (const t of [0.1, 0.2, 0.35, 0.6, 1.0]) to(t0 + t, `out ${t.toFixed(2)} s`);
  return R.moments;
}
const MOVES: Record<string, { title: string; mid: 'behind' | 'front'; run: () => Promise<Moment[]> }> = {
  'crouch-idle': { title: 'the crouch at a stand, hands empty (two seconds)', mid: 'behind', run: crouchIdle },
  'crouch-walk': { title: 'the crouch walk, hands empty', mid: 'front', run: crouchWalk },
  'rise': { title: 'standing up, then crouching down, on the move', mid: 'behind', run: rise },
  'creep': { title: 'the creep near a man (the close-in mode)', mid: 'front', run: creep },
  'cable': { title: 'the look under a door (the optical wand)', mid: 'behind', run: cable },
};

// ---------------------------------------------------------------- the drawing
const K = 150, CW = 232, RH = 250, TOPH = 200, PAD = 14, HEAD = 46;
const COL = { a: { l: '#7d93b8', r: '#3f5f96', t: '#23324d' }, v: { l: '#e9c9ad', r: '#d9a987', t: '#c79474' } };
function draw(title: string, mid: 'behind' | 'front', ms: Moment[]): string {
  const Wd = PAD * 2 + ms.length * CW, Ht = HEAD + RH * 2 + TOPH + 26;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Ht}" font-family="system-ui, sans-serif" font-size="12"><rect width="100%" height="100%" fill="#f6f4ee"/><text x="${PAD}" y="20" font-size="15" font-weight="600">${title}</text><text x="${PAD}" y="37" fill="#555">darker limb = his right · row 1 from his right side (he faces right) · row 2 from ${mid === 'behind' ? 'behind him' : 'in front of him'} · row 3 from above (he faces right) · the heavy line is the floor</text>`;
  ms.forEach((m, i) => { const ox = PAD + i * CW, cx = ox + CW / 2, sx = mid === 'behind' ? -1 : 1;
    const views: [(p: P3) => number, (p: P3) => number, number][] = [
      [p => cx - 30 + p[2] * K, p => HEAD + RH - 22 - p[1] * K, 0],
      [p => cx + sx * p[0] * K, p => HEAD + RH * 2 - 22 - p[1] * K, 1],
      [p => cx - 30 + p[2] * K, p => HEAD + RH * 2 + TOPH / 2 + p[0] * K, 2]];
    for (const [x, y, vi] of views) { const top = HEAD + (vi === 2 ? RH * 2 : vi * RH), h = vi === 2 ? TOPH : RH;
      s += `<clipPath id="c${i}_${vi}"><rect x="${ox + 2}" y="${top + 2}" width="${CW - 4}" height="${h - 6}"/></clipPath><rect x="${ox + 2}" y="${top + 2}" width="${CW - 4}" height="${h - 6}" fill="#fff" stroke="#d9d4c7"/>`;
      if (vi < 2) s += `<line x1="${ox + 2}" y1="${top + RH - 22}" x2="${ox + CW - 2}" y2="${top + RH - 22}" stroke="#8a8272" stroke-width="2"/>`;
      s += `<g clip-path="url(#c${i}_${vi})">`;
      if (m.door !== undefined && vi !== 1) { const dx = x([0, 0, m.door]); s += vi === 0 ? `<line x1="${dx}" y1="${top + 4}" x2="${dx}" y2="${top + RH - 22}" stroke="#b9a37a" stroke-width="5"/>` : `<line x1="${dx}" y1="${top + 20}" x2="${dx}" y2="${top + TOPH - 24}" stroke="#b9a37a" stroke-width="5"/>`; }
      const men: ['a' | 'v', Man][] = m.v ? [['v', m.v], ['a', m.a]] : [['a', m.a]];
      for (const [who, M] of men) { const c = COL[who]; const line = (pts: P3[], col: string, w: number) => `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="0.92" points="${pts.map(p => `${x(p).toFixed(1)},${y(p).toFixed(1)}`).join(' ')}"/>`;
        // far limbs first: from his right side the left ones; from behind / in front the order is by depth of the hand
        const parts: [P3[], string, number][] = vi === 0 ? [[M.legL, c.l, 9], [M.armL, c.l, 7], [M.trunk, c.t, 13], [M.legR, c.r, 9], [M.armR, c.r, 7]] : [[M.legL, c.l, 9], [M.legR, c.r, 9], [M.trunk, c.t, 13], [M.armL, c.l, 7], [M.armR, c.r, 7]];
        for (const [pts, col, w] of parts) s += line(pts, col, w);
        const hx = x(M.head), hy = y(M.head) - (vi < 2 ? 9 : 0); s += `<circle cx="${hx.toFixed(1)}" cy="${hy.toFixed(1)}" r="13" fill="${c.t}" opacity="0.92"/>`;
        if (vi !== 1) { const tip: P3 = [M.head[0] + M.face[0] * 0.16, M.head[1], M.head[2] + M.face[2] * 0.16]; s += `<line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${x(tip).toFixed(1)}" y2="${(y(tip) - (vi < 2 ? 9 : 0)).toFixed(1)}" stroke="${c.t}" stroke-width="5" stroke-linecap="round"/>`; }
        for (const [h, col] of [[M.armL[3], c.l], [M.armR[3], c.r]] as [P3, string][]) s += `<circle cx="${x(h).toFixed(1)}" cy="${y(h).toFixed(1)}" r="5" fill="#fff" stroke="${col}" stroke-width="2.5"/>`; }
      s += '</g>'; }
    s += `<text x="${cx}" y="${HEAD + RH * 2 + TOPH + 14}" text-anchor="middle">${m.label}</text>`; });
  return s + '</svg>';
}

// ---------------------------------------------------------------- run
if (import.meta.main) {
  if (process.argv.includes('--list')) { for (const [k, m] of Object.entries(MOVES)) log(`${k.padEnd(14)} ${m.title}`); process.exit(0); }
  const want = arg('--move')?.split(',') ?? Object.keys(MOVES), tag = arg('--tag'), dir = resolve(arg('--out') ?? `${ROOT}/docs/shots/stealth`); mkdirSync(dir, { recursive: true });
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; let SHELL: string | null = null; if (existsSync(base)) for (const dd of readdirSync(base)) { const x = `${base}/${dd}/chrome-linux/headless_shell`; if (existsSync(x)) SHELL = x; }
  const f2 = (p: P3) => `(${p.map(v => v.toFixed(2)).join(' ')})`;
  let bad = 0;
  for (const id of want) { const M = MOVES[id]; if (!M) { log(`unknown move '${id}' (--list)`); bad++; continue; }
    try { const ms = await M.run(); loud(); const s = draw(`${M.title}${tag ? ` — ${tag}` : ''}`, M.mid, ms), out = `${dir}/${id}${tag ? '-' + tag : ''}`; writeFileSync(`${out}.svg`, s);
      const m = /width="(\d+)" height="(\d+)"/.exec(s)!; const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--screenshot=${out}.png`, `--window-size=${m[1]},${m[2]}`, `file://${out}.svg`]) : null;
      log(`${out}.svg${r && r.status === 0 ? ' (+ .png)' : ''} · ${ms.length} moments`);
      if (process.argv.includes('--dump')) for (const mm of ms) { const a = mm.a; log(`  ${mm.label.padEnd(22)} head ${f2(a.head)} sho ${f2(a.armL[1])} ${f2(a.armR[1])} elb ${f2(a.armL[2])} ${f2(a.armR[2])} hand ${f2(a.armL[3])} ${f2(a.armR[3])} knee ${f2(a.legL[2])} ${f2(a.legR[2])} foot ${f2(a.legL[3])} ${f2(a.legR[3])} hips ${f2(a.legL[0])}`); } }
    catch (e) { loud(); log(`${id}: ${e instanceof Error ? e.stack : String(e)}`); bad++; } }
  process.exit(bad ? 1 : 0);
}
