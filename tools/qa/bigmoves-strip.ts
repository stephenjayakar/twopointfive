// Strips of THE BIG SLOT'S TOOLS IN A MAN'S HANDS (src/game/character.ts bigLayer / BIGMOVE, src/game/rigProps.ts BIGRIG) as stick figures WITH THE PROPS DRAWN:
// the dynamic hammer off his back — equip, ready, wind-up, the blow, the rebound, stowed — and the breaching shotgun the same way, for Sam (hands empty, and
// with his rifle up) and for a guard-kit man. The Game is stood up headless and then HELD: only the one character is updated, with `anim.bigTool` written by
// hand each frame on a clock of this tool's own (the game's beat — bigkit.ts — is not run: this looks at the pose and the boxes, nothing else). Per cell three
// views in his own frame, centred on his pelvis: FRONT (looking at his face: his right on the page's left), SIDE (from his right: he faces the page's right),
// TOP (from above, he faces up the page: the game camera's view, near enough). No skin, no light: how a move is looked at on a box with no GPU.
//
//   bun run tools/qa/bigmoves-strip.ts [--out dir] [--only hammer,hammer-slow,hammer-rifle,hammer-mate,shotgun,shotgun-rifle] [--cols 12] [--every 3]
//     → dir/bigmoves-<scenario>-<n>.svg (+ .png where a headless Chromium is found), at most two lines of cells an image
//     → stdout: per scenario how far the hammer's head is from the point at each blow's frame, the worst one-frame jump of each wrist and of the tool, and
//       when his own gun is away (hideHeldItem) and the tool leaves his back (bigK)
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const { BIGSLOT } = await import(`${ROOT}/src/game/kit.ts`);
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { rigBoxes, BIG_TAG } = await import(`${ROOT}/src/game/rigProps.ts`);
const { rigOf } = await import(`${ROOT}/src/game/guards.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
type P3 = [number, number, number];
const DT = 1 / 60;
const SHELL = (() => { const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; if (!existsSync(base)) return null; for (const d of readdirSync(base)) { const f = `${base}/${d}/chrome-linux/headless_shell`; if (existsSync(f)) return f; } return null; })();
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const out = resolve(arg('--out') ?? `${ROOT}/docs/shots/bigmoves`); mkdirSync(out, { recursive: true });
const only = arg('--only')?.split(',') ?? null, NCOL = +(arg('--cols') ?? 12), EVERY = +(arg('--every') ?? 3);

const BONES = ['hips', 'spine2', 'chest', 'neck', 'head', 'headTop', 'upperArmL', 'forearmL', 'handL', 'fingerL', 'upperArmR', 'forearmR', 'handR', 'fingerR', 'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR'];
const CHAINS: [string[], string, number][] = [
  [['hips', 'thighL', 'shinL', 'footL', 'toeL'], '#9db3d6', 5], [['chest', 'upperArmL', 'forearmL', 'handL'], '#9db3d6', 4.5],
  [['hips', 'spine2', 'chest', 'neck', 'head'], '#4a5568', 7],
  [['hips', 'thighR', 'shinR', 'footR', 'toeR'], '#1f3a6e', 5], [['chest', 'upperArmR', 'forearmR', 'handR'], '#1f3a6e', 4.5],
  [['handL', 'fingerL'], '#3fa37a', 3.5], [['handR', 'fingerR'], '#0b5d3b', 3.5],
];
interface BoxRec { name: string; c: P3; cw: P3; corners: P3[]; h: P3; }
interface Frame { b: Record<string, P3>; boxes: BoxRec[]; at: P3; atW: P3; bad: number; }
interface Cell { fr: Frame; label: string[]; mark: boolean; }
type Tool = { kind: 'hammer' | 'shotgun'; t: number; equip: number; windup: number; stow: number; blows: number[]; end: number; at: P3 };

/** the man's joints and prop boxes this frame in HIS frame: [to his right, up from the floor, forward], the origin under his pelvis */
function measure(c: any, boxesW: any[], atW: P3): Frame {
  const yaw = c.bodyYaw, sn = Math.sin(yaw), cs = Math.cos(yaw), hp = c.bones.hips as P3; let bad = 0;
  const rel = (p: ArrayLike<number>): P3 => { const dx = p[0] - hp[0], dz = p[2] - hp[2]; const r: P3 = [-(dx * cs - dz * sn), p[1] - c.pos[1], dx * sn + dz * cs]; if (!r.every(Number.isFinite)) bad++; return r; };
  const b: Record<string, P3> = {}; for (const k of BONES) b[k] = c.bones[k] ? rel(c.bones[k]) : [NaN, NaN, NaN];
  const headC: P3 = [(c.bones.head[0] + c.bones.headTop[0]) / 2, (c.bones.head[1] + c.bones.headTop[1]) / 2, (c.bones.head[2] + c.bones.headTop[2]) / 2];
  const boxes: BoxRec[] = [];
  for (const x of boxesW) {
    if ((x.owner & 0xff) !== (c.id & 0xff)) continue;
    if (!x.name && Math.max(x.h[0], x.h[1], x.h[2]) < 0.06 && Math.hypot(x.c[0] - headC[0], x.c[1] - headC[1], x.c[2] - headC[2]) < 0.27) continue;   // (the goggles: left out, as kitanim-strip does)
    const q = (x.rot ?? [0, Math.sin((x.yaw ?? 0) / 2), 0, Math.cos((x.yaw ?? 0) / 2)]) as [number, number, number, number];
    const corners: P3[] = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const d = quat.rotate(q, [sx * x.h[0], sy * x.h[1], sz * x.h[2]]); corners.push(rel([x.c[0] + d[0], x.c[1] + d[1], x.c[2] + d[2]])); }
    boxes.push({ name: x.name ?? '-', c: rel(x.c), cw: [...x.c] as P3, corners, h: [...x.h] as P3 });
  }
  return { b, boxes, at: rel(atW), atW, bad };
}

// ---------------------------------------------------------------- the picture
const K = 150, CW = 200, FH = 340, SH = 340, TH = 230, LAB = 44, PAD = 16, HEAD = 46, NAMEH = 18;
const CELLH = FH + SH + TH + LAB;
const hull = (pts: [number, number][]): [number, number][] => { const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up: [number, number][] = []; for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); };
const boxCol = (b: BoxRec) => b.name === BIG_TAG ? (b.h[0] > 0.05 ? ['#111', 'rgba(20,20,24,0.85)'] : ['#a07a00', 'rgba(230,180,20,0.8)']) : b.name === 'sc20k' ? ['#8a4a1f', 'rgba(150,82,36,0.28)'] : b.name === 'sheath' ? ['#7a3fa0', 'rgba(122,63,160,0.25)'] : ['#b5302a', 'rgba(200,60,48,0.3)'];
let clipN = 0;
function cellSvg(cl: Cell, ox: number, oy: number): string {
  const fr = cl.fr; let s = '';
  const panel = (y: number, h: number, tag: string, px: (p: P3) => number, py: (p: P3) => number, floorY: number | null) => {
    const id = `c${clipN++}`;
    s += `<clipPath id="${id}"><rect x="${ox + 1}" y="${y}" width="${CW - 2}" height="${h - 2}"/></clipPath><rect x="${ox + 1}" y="${y}" width="${CW - 2}" height="${h - 2}" fill="${cl.mark ? '#fff3d6' : '#fff'}" stroke="#d9d4c7"/><g clip-path="url(#${id})">`;
    if (floorY !== null) s += `<line x1="${ox + 1}" y1="${floorY}" x2="${ox + CW - 1}" y2="${floorY}" stroke="#8a8272" stroke-width="1.5"/>`;
    const good = (p: P3) => p.every(Number.isFinite);
    for (const [ch, col, w] of CHAINS) { const pts = ch.map(k => fr.b[k]).filter(good); if (pts.length > 1) s += `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" points="${pts.map(p => `${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(' ')}"/>`; }
    if (good(fr.b.head) && good(fr.b.headTop)) { const hc: P3 = [(fr.b.head[0] + fr.b.headTop[0]) / 2, (fr.b.head[1] + fr.b.headTop[1]) / 2, (fr.b.head[2] + fr.b.headTop[2]) / 2]; s += `<circle cx="${px(hc).toFixed(1)}" cy="${py(hc).toFixed(1)}" r="${(0.1 * K).toFixed(1)}" fill="rgba(74,85,104,0.55)"/>`; }
    for (const b of fr.boxes) { if (!b.corners.every(good)) continue; const [st, fill] = boxCol(b); const hl = hull(b.corners.map(p => [px(p), py(p)] as [number, number])); if (hl.length > 1) s += `<polygon points="${hl.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${st}" stroke-width="1"/>`; }
    for (const [ch, col] of CHAINS.slice(5)) { const pts = ch.map(k => fr.b[k]); if (pts.every(good)) s += `<line x1="${px(pts[0]).toFixed(1)}" y1="${py(pts[0]).toFixed(1)}" x2="${px(pts[1]).toFixed(1)}" y2="${py(pts[1]).toFixed(1)}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${px(pts[0]).toFixed(1)}" cy="${py(pts[0]).toFixed(1)}" r="2.6" fill="${col}"/>`; }
    { const x = px(fr.at), yy = py(fr.at); s += `<path d="M${(x - 6).toFixed(1)} ${yy.toFixed(1)}H${(x + 6).toFixed(1)}M${x.toFixed(1)} ${(yy - 6).toFixed(1)}V${(yy + 6).toFixed(1)}" stroke="#d0281e" stroke-width="1.6"/>`; }   // the point struck
    s += `</g><text x="${ox + 5}" y="${y + 11}" font-size="9" fill="#9a927f">${tag}</text>`;
  };
  const fy = oy + FH - 12, sy = oy + FH + SH - 12, ty = oy + FH + SH;
  panel(oy, FH, 'FRONT', p => ox + CW / 2 - p[0] * K, p => fy - p[1] * K, fy);
  panel(oy + FH, SH, 'SIDE (his right)', p => ox + 62 + p[2] * K, p => sy - p[1] * K, sy);
  panel(ty, TH, 'TOP', p => ox + CW / 2 + p[0] * K, p => ty + 130 - p[2] * K, null);
  cl.label.forEach((t, i) => { s += `<text x="${ox + CW / 2}" y="${ty + TH + 10 + i * 11}" text-anchor="middle" font-size="10" fill="${fr.bad ? '#c00' : '#1c2433'}">${esc(t)}</text>`; });
  return s;
}
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
function figure(title: string, note: string, lines: Cell[][]): string {
  const most = Math.max(1, ...lines.map(l => l.length)), Wd = Math.max(PAD * 2 + most * CW, 900), Ht = HEAD + lines.length * (CELLH + NAMEH) + 18;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Ht}" font-family="system-ui, sans-serif" font-size="12"><rect width="100%" height="100%" fill="#f6f4ee"/><text x="${PAD}" y="20" font-size="15" font-weight="600" fill="#1c2433">${esc(title)}</text><text x="${PAD}" y="36" font-size="10" fill="#5a6373">${esc(note)}</text>`;
  lines.forEach((l, li) => { const y0 = HEAD + li * (CELLH + NAMEH); l.forEach((c, i) => { s += cellSvg(c, PAD + i * CW, y0 + NAMEH); }); });
  return s + `<text x="${PAD}" y="${Ht - 5}" font-size="10" fill="#5a6373">150 px = 1 m · one character updated headless at 60 frames a second, anim.bigTool written by this tool · skeleton and prop boxes only, no renderer · yellow = the hammer's handle, black = its head, red cross = the point struck, shaded cell = a blow's frame</text></svg>`;
}
const written: string[] = [];
function write(name: string, title: string, note: string, cells: Cell[]) {
  const per = NCOL * 2;
  for (let k = 0; k * per < cells.length; k++) { const part = cells.slice(k * per, (k + 1) * per), lines = [part.slice(0, NCOL), part.slice(NCOL)].filter(l => l.length);
    const svg = figure(`${title} — ${k + 1} / ${Math.ceil(cells.length / per)}`, note, lines), f = `${out}/${name}-${k + 1}.svg`; writeFileSync(f, svg); const m = /width="(\d+)" height="(\d+)"/.exec(svg)!;
    const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--screenshot=${out}/${name}-${k + 1}.png`, `--window-size=${m[1]},${m[2]}`, `file://${f}`]) : null;
    const ok = !!r && r.status === 0 && existsSync(`${out}/${name}-${k + 1}.png`); written.push(ok ? `${out}/${name}-${k + 1}.png` : f); console.log(`  ${ok ? `${out}/${name}-${k + 1}.png` : f + ' (no png: no headless shell)'}`); }
}

// ---------------------------------------------------------------- driving
/** one fresh world, the game held from here on: Sam at (21, 12) facing +z; `rifle` = his rifle brought up first; `mate` = a guard stood beside him instead (the man the strip is of) */
async function world(o: { rifle?: boolean; front?: boolean } = {}) {
  Math.random = mulberry32(5);
  const W: any = await standUp(); const g = W.game;
  MOVES.on = 1; KITANIM.on = true; KITANIM.sling = o.front ? 1 : 2; BIGSLOT.on = true; BIGSLOT.moves = true;
  g.playerInvisible = true; g.godMode = true; g.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.update(0); });
  g.teleportPlayer([21, 0, 12]); g.player.char.bodyYaw = g.player.char.aimYaw = 0;
  if (o.rifle) { W.input.pressed.add('Digit2'); W.cursorAt([21, 1.2, 16]); W.step(DT); if (!g.player.rifleUp) W.input.pressed.add('KeyE'); }
  for (let i = 0; i < 90; i++) { W.cursorAt([21, 1.2, 16]); W.step(DT); }
  return { W, g };
}
const dist = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** the beat run on `c`: T.t stepped a frame at a time from −lead to `until`, boxes by `draw` */
function beat(name: string, c: any, T: Tool, until: number, draw: (out: any[]) => void, lead = 0.1): Cell[] {
  const cells: Cell[] = [], an = c.anim; let pv: Frame | null = null, n = 0;
  const worst = { R: 0, L: 0, tool: 0, fR: 0, fL: 0, fT: 0 }; let hideOn = NaN, hideOff = NaN, kOff = NaN, kOn = NaN, bad = 0; const blows: string[] = [];
  for (let t = -lead; t <= until + 1e-9; t += DT, n++) {
    const tt = Math.round(t / DT) * DT; an.bigTool = tt >= 0 ? { ...T, t: tt } : null; c.update(DT);
    const all: any[] = []; draw(all); const fr = measure(c, all, T.at); bad += fr.bad;
    const blow = T.blows.some(b => Math.abs(b - tt) < DT / 2), head = fr.boxes.find(b => b.name === BIG_TAG && b.h[0] > 0.05), tool = head ?? fr.boxes.find(b => b.name === '-' && b.h[2] > 0.1);
    if (blow) blows.push(`t ${tt.toFixed(2)}: ${T.kind === 'hammer' ? (head ? `head's middle ${(dist(head.cw, T.at) * 100).toFixed(1)} cm off the point` : 'NO HEAD BOX') : 'shell'} · arms: right ${(dist(c.bones.upperArmR, c.bones.handR) * 100).toFixed(0)} cm, left ${(dist(c.bones.upperArmL, c.bones.handL) * 100).toFixed(0)} cm shoulder to wrist`);
    if (pv) { const dR = dist(fr.b.handR, pv.b.handR), dL = dist(fr.b.handL, pv.b.handL); if (dR > worst.R) { worst.R = dR; worst.fR = tt; } if (dL > worst.L) { worst.L = dL; worst.fL = tt; }
      const was = pv.boxes.find(b => b.name === BIG_TAG && b.h[0] > 0.05); if (head && was) { const d = dist(head.c, was.c); if (d > worst.tool) { worst.tool = d; worst.fT = tt; } } }
    if (an.hideHeldItem && Number.isNaN(hideOn)) hideOn = tt; if (!an.hideHeldItem && !Number.isNaN(hideOn) && Number.isNaN(hideOff)) hideOff = tt;
    if (an.bigK > 0 && Number.isNaN(kOff)) kOff = tt; if (an.bigK >= 1 && Number.isNaN(kOn)) kOn = tt;
    if (n % EVERY === 0 || blow) cells.push({ fr, mark: blow, label: [`t ${tt.toFixed(2)} s${blow ? ' · BLOW' : ''}`, `bigK ${(+an.bigK).toFixed(2)}${an.hideHeldItem ? ' · own gun away' : ''}`, tool ? `${T.kind === 'hammer' ? 'head' : 'gun'} ${tool.c.map(x => x.toFixed(2)).join(', ')}` : 'no tool box'] });
    pv = fr;
  }
  an.bigTool = null; c.update(DT);
  console.log(`${name}: ${n} frames · own gun away ${hideOn.toFixed(2)}‥${Number.isNaN(hideOff) ? '(still, at the end)' : hideOff.toFixed(2)} s · the tool off his back from ${kOff.toFixed(2)} s, all in his hands at ${kOn.toFixed(2)} s · worst one-frame jump: right wrist ${(worst.R * 100).toFixed(1)} cm @${worst.fR.toFixed(2)}, left wrist ${(worst.L * 100).toFixed(1)} cm @${worst.fL.toFixed(2)}, the head ${(worst.tool * 100).toFixed(1)} cm @${worst.fT.toFixed(2)} · non-finite ${bad} · after the beat: bigK ${an.bigK}, hideHeldItem ${an.hideHeldItem}`);
  for (const b of blows) console.log(`    ${b}`);
  return cells;
}
const want = (n: string) => !only || only.includes(n);
/** the point: `fwd` m in front of him and `side` m to his left, 1 m up */
const pointOf = (c: any, fwd = 0.8, side = 0, h = 1.0): P3 => { const sn = Math.sin(c.bodyYaw), cs = Math.cos(c.bodyYaw); return [c.pos[0] + sn * fwd + cs * side, c.pos[1] + h, c.pos[2] + cs * fwd - sn * side]; };
const NOTE = (T: Tool) => `equip ${T.equip} s · wind-up ${T.windup} s · ${T.kind === 'hammer' ? 'blows land' : 'shells go'} at ${T.blows.map(b => b.toFixed(2)).join(', ')} s · stowed from ${T.end.toFixed(2)} over ${T.stow} s · a cell every ${EVERY}${EVERY === 1 ? 'st' : EVERY === 2 ? 'nd' : EVERY === 3 ? 'rd' : 'th'} frame + each blow's own`;

if (want('hammer')) { const { g } = await world(); const pl = g.player, c = pl.char; pl.bigKit = 'hammer';
  const T: Tool = { kind: 'hammer', t: 0, equip: BIGSLOT.equip ?? 0.6, windup: BIGSLOT.heft, stow: BIGSLOT.stow ?? 0.45, blows: [1.3, 2.25], end: 2.25 + 0.25, at: pointOf(c) };
  write('bigmoves-hammer', 'The hammer, Sam, hands empty: off his back, ready, two blows at the game\'s own times, stowed', NOTE(T), beat('hammer', c, T, T.end + T.stow + 0.1, o => handProps(g, o))); }
if (want('hammer-slow')) { const { g } = await world(); const pl = g.player, c = pl.char; pl.bigKit = 'hammer';
  const T: Tool = { kind: 'hammer', t: 0, equip: 0.7, windup: 1.2, stow: 0.5, blows: [2.1], end: 2.5, at: pointOf(c, 0.7, 0.25) };
  write('bigmoves-hammer-slow', 'The hammer at the reference footage\'s pace (a 1.2 s wind-up), the point a quarter metre to his left', NOTE(T), beat('hammer-slow', c, T, T.end + T.stow + 0.1, o => handProps(g, o))); }
if (want('hammer-rifle')) { for (const front of [false, true]) { const { g } = await world({ rifle: true, front }); const pl = g.player, c = pl.char; pl.bigKit = 'hammer';
  if (!pl.rifleUp) console.log('hammer-rifle: the rifle did not come up');
  const T: Tool = { kind: 'hammer', t: 0, equip: BIGSLOT.equip, windup: BIGSLOT.heft, stow: BIGSLOT.stow, blows: [1.3], end: 1.55, at: pointOf(c, 1.0) };
  const nm = `hammer-rifle-${front ? 'front' : 'back'}`;
  write(`bigmoves-${nm}`, `The hammer, Sam with his rifle up (it lives ${front ? 'on its sling in front' : 'across his back'}): the rifle away, one blow at a point a metre off, the rifle back`, NOTE(T), beat(nm, c, T, T.end + T.stow + 0.1, o => handProps(g, o))); } }
if (want('hammer-mate')) { const { g } = await world(); const gd = g.guards.find((m: any) => rigOf(m) === 'carbine') ?? g.guards[0], c = gd.char, rk = rigOf(gd);
  c.pos = [24, 0, 12]; c.bodyYaw = c.aimYaw = 0; c.vel = [0, 0, 0]; for (let i = 0; i < 30; i++) c.update(DT);
  const T: Tool = { kind: 'hammer', t: 0, equip: BIGSLOT.equip, windup: BIGSLOT.heft, stow: BIGSLOT.stow, blows: [1.3, 2.25], end: 2.5, at: pointOf(c) };
  // (a guard-kit man drawn through rigBoxes itself, as combat.ts guardProps asks it: no team is staged here, so bigCarried has nothing to say of him)
  const draw = (o: any[]) => { const an = c.anim; rigBoxes(c, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, weapon: rk === 'carbine' ? 'carbine' : 'pistol', ...(an.bigTool && an.hideHeldItem ? { hang: true } : null), big: 'hammer', bigK: an.bigK }, o); };
  write('bigmoves-hammer-mate', `The hammer, a guard-kit man (${rk}${c.anim.longGun ? ', the long-gun arms under it' : ''}): his own gun hung down his front, two blows, his gun back`, NOTE(T), beat('hammer-mate', c, T, T.end + T.stow + 0.1, draw)); }
for (const rifle of [false, true]) { const nm = rifle ? 'shotgun-rifle' : 'shotgun'; if (!want(nm)) continue;
  const { g } = await world({ rifle }); const pl = g.player, c = pl.char; pl.bigKit = 'shotgun';
  const T: Tool = { kind: 'shotgun', t: 0, equip: BIGSLOT.draw, windup: 0, stow: BIGSLOT.stow, blows: [0.8, 1.7], end: 1.87, at: pointOf(c, 0.75, 0.1) };
  write(`bigmoves-${nm}`, `The breaching shotgun, Sam${rifle ? ' with his rifle up' : ', hands empty'}: off his back into the shoulder, two shells, slung`, NOTE(T), beat(nm, c, T, T.end + T.stow + 0.1, o => handProps(g, o))); }
console.log(`\n${written.length} files written`);
process.exit(0);
