// Strips of Sam handling his kit (src/game/kitanim.ts) as stick figures WITH THE PROPS DRAWN: the whole Game stepped headless, his joints and every prop box
// bolted to him (pistol, holster, slung / held rifle, sheath, cans, magazines) drawn per cell in three views centred on his pelvis, in his own frame —
// FRONT (looking at his face: his right on the page's left), SIDE (from his right: he faces the page's right), TOP (from above, he faces up the page: the
// game camera's own view, near enough). No skin, no light: how a hand motion is looked at on a box with no GPU.
//
//   bun run tools/qa/kitanim-strip.ts [--out dir] [--only pistol,rifle,swap,can,reload-pistol,reload-rifle,close,wall,rifle-can,sling,nv] [--tiles dir [--tile-cols 8]] [--no-copy] [--trace 'rifle:after:84-100']
//     → dir/kitanim-<scenario>.svg (+ .png where a headless Chromium is found; the PNGs are also copied to COPY below unless --no-copy)
//     → --tiles dir: the AFTER rows again, cut into images of --tile-cols cells (for looking at closely)
//     → stdout: per scenario the worst one-frame jump of each wrist and each prop box (measured EVERY frame, in his pelvis frame), how far kit that is
//       moving gets from the nearer hand, how near hands / moving kit come to the trunk line and the head, non-finite numbers, and scenario tables
//
// Every scenario is run from a FRESH standUp() per variant: KITANIM.on false = 'before' (the kit jumps between hand and holster on the key's frame), true = 'after'.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const { MOVES } = await import(`${ROOT}/src/game/character.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
type P3 = [number, number, number];
const DT = 1 / 60;
const COPY = 'rebuild/kit-animations/strips';
const SHELL = (() => { const base = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'; if (!existsSync(base)) return null; for (const d of readdirSync(base)) { const f = `${base}/${d}/chrome-linux/headless_shell`; if (existsSync(f)) return f; } return null; })();
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
const out = resolve(arg('--out') ?? `${ROOT}/docs/shots/kitanim`); mkdirSync(out, { recursive: true });
const tiles = arg('--tiles') ? resolve(arg('--tiles')!) : null; if (tiles) mkdirSync(tiles, { recursive: true });
const TILE_COLS = +(arg('--tile-cols') ?? 8);
const only = arg('--only')?.split(',') ?? null;
const noCopy = process.argv.includes('--no-copy');
/** --trace '<scenario as in the table>:<before|after>:<f0>-<f1>' = those frames one by one */
const TRACE = (() => { const t = arg('--trace'); if (!t) return null; const m = /^(.*):(before|after):(\d+)-(\d+)$/.exec(t); if (!m) throw new Error(`--trace wants name:before|after:f0-f1, got ${t}`); return [m[1], m[2], +m[3], +m[4]] as [string, string, number, number]; })();

// ---------------------------------------------------------------- what is kept of a frame
const BONES = ['hips', 'spine2', 'chest', 'neck', 'head', 'headTop', 'upperArmL', 'forearmL', 'handL', 'fingerL', 'upperArmR', 'forearmR', 'handR', 'fingerR', 'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR'];
/** bone chains: [joints, colour, width] — his LEFT drawn first and lighter, the trunk, then his RIGHT darker; the hands (wrist → knuckle) their own colour so a wrist's turn reads */
const CHAINS: [string[], string, number][] = [
  [['hips', 'thighL', 'shinL', 'footL', 'toeL'], '#9db3d6', 5], [['chest', 'upperArmL', 'forearmL', 'handL'], '#9db3d6', 4.5],
  [['hips', 'spine2', 'chest', 'neck', 'head'], '#4a5568', 7],
  [['hips', 'thighR', 'shinR', 'footR', 'toeR'], '#1f3a6e', 5], [['chest', 'upperArmR', 'forearmR', 'handR'], '#1f3a6e', 4.5],
  [['handL', 'fingerL'], '#3fa37a', 3.5], [['handR', 'fingerR'], '#0b5d3b', 3.5],
];
interface BoxRec { key: string; name: string; c: P3; cw: P3; corners: P3[]; h: P3; q: [number, number, number, number]; extra: boolean; }
interface Frame { f: number; tag: string; b: Record<string, P3>; floor: number; hipsW: P3; boxes: BoxRec[]; guard: [P3, P3] | null; bad: number; cut: boolean; }
interface Cell { fr: Frame; label: string[]; }
interface Row { name: string; variant: 'before' | 'after'; cells: Cell[]; }

/** one fresh world: Sam at (21, 12) facing +z, hands empty (pistol selected, holstered), the shift parked, the cursor straight ahead */
/** where the other man of the close-in strip stands (facing +z, Sam behind him on −z): the asked-for spot if 3.6 m of floor behind it is free, else the first free one found */
let SPOT: P3 | null = null;
function spotFor(g: any): P3 {
  if (SPOT) return SPOT;
  const free = (p: P3) => { for (const h of [0.3, 1.0, 1.6]) { for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; if (g.col.raycast([p[0], h, p[2]], [Math.sin(a), 0, Math.cos(a)], 0.9)) return false; }
    for (const dx of [-0.4, 0, 0.4]) if (g.col.raycast([p[0] + dx, h, p[2] + 0.3], [0, 0, -1], 4.2)) return false; } return true; };
  const tries: P3[] = [[21, 0, 15], [9.5, 0, 19.5], [9.5, 0, 20.5], [8.5, 0, 20]]; for (let x = 6; x <= 34; x += 0.5) for (let z = 8; z <= 22; z += 0.5) tries.push([x, 0, z]);
  SPOT = tries.find(free) ?? tries[0]; if (SPOT !== tries[0]) console.log(`close: the asked-for spot (21, 15) is not free (a man put there is pushed off it); using (${SPOT[0]}, ${SPOT[2]})`);
  return SPOT; }
async function world(on: boolean, o: { guard?: boolean; sling?: 0 | 1 | 2 } = {}) {
  Math.random = mulberry32(5);
  const W: any = await standUp(); const g = W.game, input = W.input;
  KITANIM.on = on; MOVES.on = 1; CLOSE.on = true; KITANIM.sling = o.sling ?? 0;
  g.playerInvisible = true; g.godMode = true; g.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  const A = o.guard ? g.guards[0] : null;
  g.guards.forEach((gd: any, i: number) => { if (gd === A) return; gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.update(0); });
  const pl = g.player, c = pl.char, an = c.anim;
  g.teleportPlayer([21, 0, 12]); c.bodyYaw = c.aimYaw = 0;
  const S = { W, g, input, pl, c, an, A, on, cursor: [21, 1.2, 16] as P3, log: [] as Frame[], f: 0, base: null as Map<string, number> | null, cut: true,
    at: (o.guard ? spotFor(g) : [21, 0, 15]) as P3,
    pin() { if (!A) return; A.hold = true; A.char.pos = [S.at[0], 0, S.at[2]]; A.char.vel = [0, 0, 0]; A.speed = 0; A.path = []; A.pathGoal = null; A.char.bodyYaw = A.char.aimYaw = 0; },
    /** n frames; every one is measured into S.log; → the last frame */
    step(n = 1): Frame { let fr!: Frame; for (let i = 0; i < n; i++) { S.pin(); W.cursorAt(S.cursor); W.step(DT); if (A) pl.visibility = 0.02; S.f++; fr = measure(S); S.log.push(fr); S.cut = false; } return fr; },
    tap(code: string) { input.pressed.add(code); }, click() { input.clicked |= 1; },
    /** Sam somewhere else: the next frame is not a jump of his */
    put(p: P3) { g.teleportPlayer(p); c.bodyYaw = c.aimYaw = 0; S.cut = true; },
    /** from here on a prop box that was not there now is drawn as NEW (green): a magazine in the support hand */
    markBase() { const fr = S.log[S.log.length - 1]; S.base = new Map(); for (const b of fr.boxes) { const k = b.key.replace(/#\d+$/, ''); S.base.set(k, (S.base.get(k) ?? 0) + 1); } },
    state() { return `slot ${pl.slot} holstered ${pl.holstered} pistolUp ${pl.pistolUp} rifleUp ${pl.rifleUp} hasRifle ${pl.hasRifle} kitHold ${an.kitHold} equipT ${(+pl.equipT).toFixed(2)}`; },
  };
  if (A) { S.pin(); A.char.update(0); pl.visibility = 0.02; }
  S.step(1);
  return S;
}
type World = Awaited<ReturnType<typeof world>>;

/** Sam's joints and prop boxes this frame, in HIS frame: [to his right, up from the floor, forward], the origin under his pelvis */
function measure(S: any): Frame {
  const { g, c } = S; const yaw = c.bodyYaw, sn = Math.sin(yaw), cs = Math.cos(yaw), hp = c.bones.hips as P3;
  let bad = 0;
  const rel = (p: ArrayLike<number>): P3 => { const dx = p[0] - hp[0], dz = p[2] - hp[2]; const r: P3 = [-(dx * cs - dz * sn), p[1] - c.pos[1], dx * sn + dz * cs]; if (!r.every(Number.isFinite)) bad++; return r; };
  const b: Record<string, P3> = {}; for (const k of BONES) b[k] = c.bones[k] ? rel(c.bones[k]) : [NaN, NaN, NaN];
  for (const k of BONES) if (!c.bones[k]) bad++;
  const headC: P3 = [(c.bones.head[0] + c.bones.headTop[0]) / 2, (c.bones.head[1] + c.bones.headTop[1]) / 2, (c.bones.head[2] + c.bones.headTop[2]) / 2];
  const all: any[] = []; handProps(g, all); const mine = all.filter(x => (x.owner & 0xff) === (c.id & 0xff));
  const seen = new Map<string, number>(); const boxes: BoxRec[] = [];
  for (const x of mine) {
    if (!S.goggles && !x.name && Math.max(x.h[0], x.h[1], x.h[2]) < 0.06 && Math.hypot(x.c[0] - headC[0], x.c[1] - headC[1], x.c[2] - headC[2]) < 0.27) continue;   // the goggles (small untagged boxes on the head: the lenses sit ~0.2 m off its centre)
    const q = (x.rot ?? [0, Math.sin((x.yaw ?? 0) / 2), 0, Math.cos((x.yaw ?? 0) / 2)]) as [number, number, number, number];
    const corners: P3[] = []; for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) { const d = quat.rotate(q, [sx * x.h[0], sy * x.h[1], sz * x.h[2]]); corners.push(rel([x.c[0] + d[0], x.c[1] + d[1], x.c[2] + d[2]])); }
    const k0 = `${x.name ?? '-'}|${x.h.map((v: number) => Math.round(v * 1000)).join('x')}`, n = seen.get(k0) ?? 0; seen.set(k0, n + 1);
    const extra = !!S.base && n >= (S.base.get(k0) ?? 0);
    boxes.push({ key: `${k0}#${n}`, name: x.name ?? '-', c: rel(x.c), cw: [...x.c] as P3, corners, h: [...x.h] as P3, q, extra });
  }
  const A = S.A; const guard = A ? [rel(A.char.bones.hips), rel(A.char.bones.head)] as [P3, P3] : null;
  return { f: S.f, tag: `${S.an.kitHold === undefined ? '—' : S.an.kitHold} stow ${(+S.an.kitStow || 0).toFixed(2)} eq ${(+S.pl.equipT || 0).toFixed(2)}${S.an.reloading ? ' reloading' : ''}`, b, floor: 0, hipsW: [...hp] as P3, boxes, guard, bad, cut: S.cut };
}

// ---------------------------------------------------------------- the picture
const K = 150, CW = 196, FH = 300, SH = 300, TH = 200, LAB = 40, PAD = 16, HEAD = 62, NAMEH = 18, NCOL = 13;
const CELLH = FH + SH + TH + LAB;
const hull = (pts: [number, number][]): [number, number][] => { const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]); const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = []; for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  const up: [number, number][] = []; for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); };
const boxCol = (b: BoxRec) => b.extra ? ['#0a8f4f', 'rgba(10,160,90,0.45)'] : b.name === 'sheath' ? ['#7a3fa0', 'rgba(122,63,160,0.25)'] : b.name === 'sc20k' ? ['#8a4a1f', 'rgba(150,82,36,0.28)'] : ['#b5302a', 'rgba(200,60,48,0.3)'];
let clipN = 0;
function cellSvg(cl: Cell, ox: number, oy: number): string {
  const fr = cl.fr; let s = '';
  const panel = (y: number, h: number, tag: string, px: (p: P3) => number, py: (p: P3) => number, floorY: number | null, top: boolean) => {
    const id = `c${clipN++}`;
    s += `<clipPath id="${id}"><rect x="${ox + 1}" y="${y}" width="${CW - 2}" height="${h - 2}"/></clipPath><rect x="${ox + 1}" y="${y}" width="${CW - 2}" height="${h - 2}" fill="#fff" stroke="#d9d4c7"/><g clip-path="url(#${id})">`;
    if (floorY !== null) s += `<line x1="${ox + 1}" y1="${floorY}" x2="${ox + CW - 1}" y2="${floorY}" stroke="#8a8272" stroke-width="1.5"/>`;
    if (top && fr.guard) { const [a, b] = fr.guard; s += `<line x1="${px(a).toFixed(1)}" y1="${py(a).toFixed(1)}" x2="${px(b).toFixed(1)}" y2="${py(b).toFixed(1)}" stroke="#9a9a9a" stroke-width="6" stroke-linecap="round"/><circle cx="${px(b).toFixed(1)}" cy="${py(b).toFixed(1)}" r="8" fill="#9a9a9a"/>`; }
    const good = (p: P3) => p.every(Number.isFinite);
    for (const [ch, col, w] of CHAINS) { const pts = ch.map(k => fr.b[k]).filter(good); if (pts.length > 1) s += `<polyline fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" points="${pts.map(p => `${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(' ')}"/>`; }
    if (good(fr.b.head) && good(fr.b.headTop)) { const hc: P3 = [(fr.b.head[0] + fr.b.headTop[0]) / 2, (fr.b.head[1] + fr.b.headTop[1]) / 2, (fr.b.head[2] + fr.b.headTop[2]) / 2]; s += `<circle cx="${px(hc).toFixed(1)}" cy="${py(hc).toFixed(1)}" r="${(0.1 * K).toFixed(1)}" fill="${top ? 'rgba(74,85,104,0.45)' : '#4a5568'}"/>`; }
    for (const b of fr.boxes) { if (!b.corners.every(good)) continue; const [st, fill] = boxCol(b); const hl = hull(b.corners.map(p => [px(p), py(p)] as [number, number])); if (hl.length > 1) s += `<polygon points="${hl.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')}" fill="${fill}" stroke="${st}" stroke-width="1"/>`; }
    // the hands again over the props (a fist round a grip is otherwise under its box)
    for (const [ch, col] of CHAINS.slice(5)) { const pts = ch.map(k => fr.b[k]); if (pts.every(good)) s += `<line x1="${px(pts[0]).toFixed(1)}" y1="${py(pts[0]).toFixed(1)}" x2="${px(pts[1]).toFixed(1)}" y2="${py(pts[1]).toFixed(1)}" stroke="${col}" stroke-width="2.5" stroke-linecap="round"/><circle cx="${px(pts[0]).toFixed(1)}" cy="${py(pts[0]).toFixed(1)}" r="2.6" fill="${col}"/>`; }
    s += `</g><text x="${ox + 5}" y="${y + 11}" font-size="9" fill="#9a927f">${tag}</text>`;
  };
  const fy = oy + FH - 12, sy = oy + FH + SH - 12, ty = oy + FH + SH;
  panel(oy, FH, 'FRONT', p => ox + CW / 2 - p[0] * K, p => fy - p[1] * K, fy, false);
  panel(oy + FH, SH, 'SIDE (his right)', p => ox + 66 + p[2] * K, p => sy - p[1] * K, sy, false);
  panel(ty, TH, 'TOP', p => ox + CW / 2 + p[0] * K, p => ty + 136 - p[2] * K, null, true);
  cl.label.forEach((t, i) => { s += `<text x="${ox + CW / 2}" y="${ty + TH + 10 + i * 11}" text-anchor="middle" font-size="10" fill="${fr.bad ? '#c00' : '#1c2433'}">${esc(t)}</text>`; });
  return s;
}
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const LEGEND = 'per cell, top to bottom: FRONT (looking at his face: his right is on the LEFT of the page) · SIDE (seen from his right: he faces the page\'s right) · TOP (from above: he faces UP the page, his right on the right) — all in his own frame, the pelvis fixed · dark blue = his right limbs, pale = his left, green = the hands (wrist → knuckle; dark = right) · red = pistol / cans / magazines, brown = the rifle, purple = the knife\'s sheath, green box = a box that was not there when the reload began · grey (TOP) = the other man';
/** rows wrapped at ncol cells; the rows of one GROUP are wrapped together, chunk by chunk, so every 'before' line sits over its 'after' line */
function figure(title: string, note: string, groups: Row[][], ncol = NCOL): string {
  const lines: { name: string; cells: Cell[] }[] = [];
  for (const grp of groups) { const n = Math.max(...grp.map(r => r.cells.length)), chunks = Math.max(1, Math.ceil(n / ncol));
    for (let k = 0; k < chunks; k++) for (const r of grp) { const cells = r.cells.slice(k * ncol, (k + 1) * ncol); if (cells.length) lines.push({ name: `${r.name}${chunks > 1 ? `  (${k + 1} / ${chunks})` : ''}`, cells }); } }
  const most = Math.max(1, ...lines.map(l => l.cells.length)), Wd = Math.max(PAD * 2 + most * CW, 900), Ht = HEAD + lines.length * (CELLH + NAMEH) + 22;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${Wd}" height="${Ht}" font-family="system-ui, sans-serif" font-size="12"><rect width="100%" height="100%" fill="#f6f4ee"/><text x="${PAD}" y="22" font-size="15" font-weight="600" fill="#1c2433">${esc(title)}</text><text x="${PAD}" y="38" fill="#5a6373">${esc(note)}</text>`;
  wrap(LEGEND, Math.floor((Wd - PAD * 2) / 5.1)).slice(0, 2).forEach((t, i) => { s += `<text x="${PAD}" y="${50 + i * 10}" font-size="9" fill="#5a6373">${esc(t)}</text>`; });
  lines.forEach((l, li) => { const y0 = HEAD + li * (CELLH + NAMEH); s += `<text x="${PAD}" y="${y0 + 12}" font-weight="600" fill="#1c2433">${esc(l.name)}</text>`; l.cells.forEach((c, i) => { s += cellSvg(c, PAD + i * CW, y0 + NAMEH); }); });
  return s + `<text x="${PAD}" y="${Ht - 7}" font-size="10" fill="#5a6373">150 px = 1 m · the whole Game stepped headless at 60 frames a second · skeleton and prop boxes only, no renderer</text></svg>`;
}
const wrap = (t: string, n: number) => { const o: string[] = []; let cur = ''; for (const w of t.split(' ')) { if ((cur + ' ' + w).length > n) { o.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; } if (cur) o.push(cur); return o; };
const written: string[] = [];
function png(dir: string, name: string, svg: string): boolean { const f = `${dir}/${name}.svg`; writeFileSync(f, svg); const m = /width="(\d+)" height="(\d+)"/.exec(svg)!;
  const r = SHELL ? spawnSync(SHELL, ['--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--screenshot=${dir}/${name}.png`, `--window-size=${m[1]},${m[2]}`, `file://${f}`]) : null; return !!r && r.status === 0 && existsSync(`${dir}/${name}.png`); }
function write(name: string, title: string, note: string, groups: Row[][]) {
  const ok = png(out, name, figure(title, note, groups)); written.push(`${out}/${name}.svg`); console.log(`${out}/${name}.svg${ok ? ' (+ .png)' : ' (no png: no headless shell)'}`);
  if (ok) { written.push(`${out}/${name}.png`); if (!noCopy) try { mkdirSync(COPY, { recursive: true }); copyFileSync(`${out}/${name}.png`, `${COPY}/${name}.png`); written.push(`${COPY}/${name}.png`); } catch (e) { console.log(`  could not copy to ${COPY}: ${(e as Error).message}`); } }
  if (tiles) { let t = 0; for (const grp of groups) { const rows = grp.filter(r => r.variant === 'after'); if (!rows.length) continue; const n = Math.max(...rows.map(r => r.cells.length));
    for (let k = 0; k * TILE_COLS < n; k++) png(tiles, `${name}-t${String(++t).padStart(2, '0')}`, figure(`${title} — tile ${t}`, note, [rows.map(r => ({ ...r, cells: r.cells.slice(k * TILE_COLS, (k + 1) * TILE_COLS) })).filter(r => r.cells.length)], TILE_COLS)); } }
}

// ---------------------------------------------------------------- the numbers
const dist = (a: P3, b: P3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const mid = (a: P3, b: P3): P3 => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
const segDist = (p: P3, a: P3, b: P3) => { const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ap = [p[0] - a[0], p[1] - a[1], p[2] - a[2]]; const L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2]; const t = L > 0 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)) : 0; return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t); };
/** a point to a box, both in his frame: against the box's own corners' frame (corner 0 = −−−, 1 = −−+, 2 = −+−, 4 = +−−) */
function boxDist(p: P3, b: BoxRec): number { const o = b.c, ax = [4, 2, 1].map(i => { const e = b.corners[i], z = b.corners[0]; const v = [e[0] - z[0], e[1] - z[1], e[2] - z[2]], l = Math.hypot(v[0], v[1], v[2]) || 1; return { v: v.map(x => x / l), h: l / 2 }; });
  let d2 = 0; for (const a of ax) { const t = (p[0] - o[0]) * a.v[0] + (p[1] - o[1]) * a.v[1] + (p[2] - o[2]) * a.v[2], e = Math.max(0, Math.abs(t) - a.h); d2 += e * e; } return Math.sqrt(d2); }
const handPts = (fr: Frame, side: 'L' | 'R'): P3[] => [fr.b['hand' + side], mid(fr.b['hand' + side], fr.b['finger' + side]), fr.b['finger' + side]];
const trunkDist = (fr: Frame, p: P3) => Math.min(segDist(p, fr.b.hips, fr.b.spine2), segDist(p, fr.b.spine2, fr.b.chest), segDist(p, fr.b.chest, fr.b.neck));
/** points down the trunk line, 3 cm apart or so */
const trunkPts = (fr: Frame): P3[] => { const o: P3[] = []; for (const [a, b] of [['hips', 'spine2'], ['spine2', 'chest'], ['chest', 'neck']]) for (let i = 0; i <= 6; i++) { const t = i / 6, A = fr.b[a], B = fr.b[b]; o.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); } return o; };
const headDist = (fr: Frame, p: P3) => dist(p, mid(fr.b.head, fr.b.headTop));
const kind = (b: BoxRec) => b.key.replace(/#\d+$/, '');
/** this frame's boxes → the box each was last frame: boxes of one tag and size are told apart by where they are (nearest first), so one more lens of a size coming
 *  into the list does not read as the others jumping */
function pair(pv: Frame, fr: Frame): Map<BoxRec, BoxRec> { const m = new Map<BoxRec, BoxRec>(); const by = new Map<string, [BoxRec[], BoxRec[]]>();
  for (const b of pv.boxes) { const k = kind(b); if (!by.has(k)) by.set(k, [[], []]); by.get(k)![0].push(b); } for (const b of fr.boxes) { const k = kind(b); if (!by.has(k)) by.set(k, [[], []]); by.get(k)![1].push(b); }
  for (const [olds, news] of by.values()) { const cand: [number, BoxRec, BoxRec][] = []; for (const o of olds) for (const n of news) cand.push([dist(o.c, n.c), o, n]); cand.sort((x, y) => x[0] - y[0]); const uo = new Set<BoxRec>(), un = new Set<BoxRec>();
    for (const [, o, n] of cand) { if (uo.has(o) || un.has(n)) continue; uo.add(o); un.add(n); m.set(n, o); } }
  return m; }
interface Worst { v: number; f: number; what: string; }
const worse = (w: Worst, v: number, f: number, what: string) => { if (v > w.v) { w.v = v; w.f = f; w.what = what; } };
const less = (w: Worst, v: number, f: number, what: string) => { if (v < w.v) { w.v = v; w.f = f; w.what = what; } };
const MOVING = 0.005;   // m a frame in his own frame: kit that is being carried, not kit riding a thigh
/** a box that keeps its distance to both ends of one bone this frame is RIDING that bone (the slung rifle on a turning back, the holster on a thigh), not being carried */
const RIDE: [string, string][] = [['spine2', 'chest'], ['chest', 'neck'], ['hips', 'spine2'], ['thighR', 'shinR'], ['thighL', 'shinL']];
const riding = (fr: Frame, pv: Frame, b: BoxRec, o: BoxRec) => RIDE.some(([p, q]) => Math.abs(dist(b.c, fr.b[p]) - dist(o.c, pv.b[p])) < 0.0025 && Math.abs(dist(b.c, fr.b[q]) - dist(o.c, pv.b[q])) < 0.0025);
interface Stats { name: string; variant: string; frames: number; handR: Worst; handL: Worst; box: Worst; hips: Worst; float: Worst; trunkHand: Worst; headHand: Worst; trunkKit: Worst; headKit: Worst; bad: number; came: string[]; }
const table: Stats[] = [];
function stats(name: string, variant: string, log: Frame[]): Stats {
  const W0 = (): Worst => ({ v: 0, f: -1, what: '' }), M0 = (): Worst => ({ v: Infinity, f: -1, what: '' });
  const st: Stats = { name, variant, frames: log.length, handR: W0(), handL: W0(), box: W0(), hips: W0(), float: W0(), trunkHand: M0(), headHand: M0(), trunkKit: M0(), headKit: M0(), bad: 0, came: [] };
  for (let i = 0; i < log.length; i++) { const fr = log[i], pv = i > 0 ? log[i - 1] : null; st.bad += fr.bad;
    for (const side of ['L', 'R'] as const) for (const p of handPts(fr, side)) { less(st.trunkHand, trunkDist(fr, p), fr.f, `hand${side}`); less(st.headHand, headDist(fr, p), fr.f, `hand${side}`); }
    if (!pv) continue;
    worse(st.handR, dist(fr.b.handR, pv.b.handR), fr.f, 'handR'); worse(st.handL, dist(fr.b.handL, pv.b.handL), fr.f, 'handL');
    if (!fr.cut) worse(st.hips, dist(fr.hipsW, pv.hipsW), fr.f, 'hips (world)');
    const was = pair(pv, fr);
    for (const b of fr.boxes) if (!was.has(b)) st.came.push(`f${fr.f} +${kind(b)}`); { const kept = new Set(was.values()); for (const b of pv.boxes) if (!kept.has(b)) st.came.push(`f${fr.f} -${kind(b)}`); }
    // kit on the move, by tag: how far the nearest of its moving boxes is from the nearer hand
    const near = new Map<string, number>();
    for (const b of fr.boxes) { const o = was.get(b); if (!o) continue; const d = dist(b.c, o.c); worse(st.box, d, fr.f, kind(b));
      if (d < MOVING || riding(fr, pv, b, o)) continue;
      const dh = Math.min(...handPts(fr, 'L').concat(handPts(fr, 'R')).map(p => boxDist(p, b))); near.set(b.name, Math.min(near.get(b.name) ?? Infinity, dh));
      less(st.trunkKit, Math.min(...trunkPts(fr).map(p => boxDist(p, b))), fr.f, kind(b)); less(st.headKit, boxDist(mid(fr.b.head, fr.b.headTop), b), fr.f, kind(b)); }
    for (const [tag, d] of near) worse(st.float, d, fr.f, tag);
  }
  if (TRACE && TRACE[0] === name && TRACE[1] === variant) { console.log(`--- trace ${name} / ${variant}: frame · kit · right wrist · left wrist (right, up, fwd in his frame) · the two boxes that moved most (cm, where to)`);
    const p3 = (p: P3) => `(${p.map(x => x.toFixed(2)).join(', ')})`;
    for (let i = 1; i < log.length; i++) { const fr = log[i], pv = log[i - 1]; if (fr.f < TRACE[2] || fr.f > TRACE[3]) continue; const was = pair(pv, fr);
      const mv = fr.boxes.filter(b => was.has(b)).map(b => ({ b, d: dist(b.c, was.get(b)!.c) })).sort((x, y) => y.d - x.d).slice(0, 2);
      console.log(`f${fr.f}  ${fr.tag.padEnd(34)} R ${p3(fr.b.handR)} ${(dist(fr.b.handR, pv.b.handR) * 100).toFixed(1).padStart(5)}  L ${p3(fr.b.handL)} ${(dist(fr.b.handL, pv.b.handL) * 100).toFixed(1).padStart(5)}  ${mv.map(m => `${kind(m.b)} ${(m.d * 100).toFixed(1)} → ${p3(m.b.c)}`).join('  ')}`); } }
  table.push(st); return st;
}
const cm = (w: Worst) => w.f < 0 || !Number.isFinite(w.v) ? '—' : `${(w.v * 100).toFixed(1)} cm @f${w.f}${w.what ? ' ' + w.what : ''}`;

// ---------------------------------------------------------------- driving
const kitLabel = (S: World) => { const an = S.an, pl = S.pl; const h = an.kitHold; return `${h === undefined ? 'hold —' : `hold ${h}`}${an.kitStow ? ` stow ${(+an.kitStow).toFixed(2)}` : ''}${pl.equipT > 0 ? ` eq ${(+pl.equipT).toFixed(2)}` : ''}`; };
/** n frames from now, a cell every `every`-th; the first label line is `tag f · ms` counted from the call */
function run(S: World, cells: Cell[], n: number, tag: string, every = 3, extra: (S: World, i: number) => string[] = () => []) {
  for (let i = 1; i <= n; i++) { const fr = S.step(1); if (i % every === 0) cells.push({ fr, label: [`${tag} ${i} f · ${Math.round(i * DT * 1000)} ms`, kitLabel(S), ...extra(S, i)] }); } }
const want = (name: string) => !only || only.includes(name);
const notes: string[] = [];
const say = (s: string) => { console.log(s); notes.push(s); };
const VARS: [boolean, 'before' | 'after'][] = [[false, 'before'], [true, 'after']];
const NOTE = 'before = KITANIM off (the kit changes place on the key\'s frame) · after = KITANIM on · MOVES on, CLOSE on';

// 1 ---- the pistol: out of the holster and back
if (want('pistol')) { const rows: Row[] = [];
  for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = [];
    run(S, cells, 40, 'idle'); S.tap('KeyE'); run(S, cells, 30, 'E draw'); if (!S.pl.pistolUp) say(`pistol/${v}: after E the pistol is NOT up: ${S.state()}`);
    run(S, cells, 20, 'wait'); S.tap('KeyE'); run(S, cells, 30, 'E holster'); if (S.pl.pistolUp) say(`pistol/${v}: after the second E the pistol is still up: ${S.state()}`);
    rows.push({ name: `${v}: holstered · E draws · E holsters`, variant: v, cells }); stats('pistol', v, S.log); }
  write('kitanim-pistol', 'The pistol: out of the thigh holster, and back', NOTE + ' · a cell every 3rd frame', [rows]); }

// 2 ---- the rifle: off the back and back onto it
if (want('rifle')) { const rows: Row[] = [];
  for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = [];
    run(S, cells, 12, 'idle'); S.tap('Digit2'); S.step(1); if (!S.pl.rifleUp) { say(`rifle/${v}: Digit2 alone did not bring the rifle up (${S.state()}): pressing E`); S.tap('KeyE'); }
    cells.push({ fr: S.log[S.log.length - 1], label: ['2: the key\'s frame', kitLabel(S)] }); run(S, cells, 50, '2 unsling'); if (!S.pl.rifleUp) say(`rifle/${v}: the rifle never came up: ${S.state()}`);
    run(S, cells, 20, 'wait'); S.tap('KeyE'); run(S, cells, 50, 'E sling'); if (S.pl.rifleUp) say(`rifle/${v}: after E the rifle is still up: ${S.state()}`);
    rows.push({ name: `${v}: slung · 2 takes it off his back · E slings it`, variant: v, cells }); stats('rifle', v, S.log); }
  write('kitanim-rifle', 'The rifle: off his back into his hands, and back onto the sling', NOTE + ' · a cell every 3rd frame', [rows]); }

// 3 ---- rifle ↔ pistol
if (want('swap')) { const rows: Row[] = [];
  for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = [];
    S.tap('Digit2'); S.step(90); if (!S.pl.rifleUp) say(`swap/${v}: could not get the rifle up to begin with: ${S.state()}`); S.log.length = 0;
    cells.push({ fr: S.step(1), label: ['rifle up, settled', kitLabel(S)] });
    S.tap('Digit1'); run(S, cells, 70, '1 →pistol'); if (!S.pl.pistolUp) say(`swap/${v}: Digit1 did not put the pistol up: ${S.state()}`);
    S.tap('Digit2'); run(S, cells, 70, '2 →rifle'); if (!S.pl.rifleUp) say(`swap/${v}: Digit2 did not put the rifle back up: ${S.state()}`);
    rows.push({ name: `${v}: rifle in hands · 1 (rifle away, pistol out) · 2 (pistol away, rifle out)`, variant: v, cells }); stats('swap', v, S.log); }
  write('kitanim-swap', 'Rifle to pistol and back', NOTE + ' · a cell every 3rd frame', [rows]); }

// 3b ---- rifle ↔ grenade (the long way: shoulder ↔ belt)
if (want('rifle-can')) { const rows: Row[] = [];
  for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = [];
    S.tap('Digit2'); S.step(90); if (!S.pl.rifleUp) say(`rifle-can/${v}: could not get the rifle up to begin with: ${S.state()}`); S.log.length = 0;
    cells.push({ fr: S.step(1), label: ['rifle up, settled', kitLabel(S)] });
    S.tap('Digit5'); run(S, cells, 66, '5 →frag'); if (S.pl.slot !== 'frag' || S.pl.holstered) say(`rifle-can/${v}: Digit5 did not put a grenade in the hand: ${S.state()}`);
    S.tap('Digit2'); run(S, cells, 70, '2 →rifle'); if (!S.pl.rifleUp) say(`rifle-can/${v}: Digit2 did not put the rifle back up: ${S.state()}`);
    rows.push({ name: `${v}: rifle in hands · 5 (rifle onto his back, grenade off the belt) · 2 (grenade away, rifle out)`, variant: v, cells }); stats('rifle-can', v, S.log); }
  write('kitanim-rifle-can', 'Rifle to grenade and back', NOTE + ' · a cell every 3rd frame', [rows]); }

// 3c ---- the rifle's two homes: across his back (a quiet kit) and on its sling in front (a loud kit) — both rows with kit handling ON
if (want('sling')) { const rows: Row[] = [];
  for (const [sl, v, name] of [[2, 'after', 'on his back (a quiet mission)'], [1, 'after', 'on its sling in front (a loud mission)']] as const) { const S = await world(true, { sling: sl }); const cells: Cell[] = [];
    S.tap('Digit2'); S.step(90); if (!S.pl.rifleUp) say(`sling/${name}: could not get the rifle up to begin with: ${S.state()}`); S.log.length = 0;
    cells.push({ fr: S.step(1), label: ['rifle up, settled', kitLabel(S)] });
    S.tap('Digit1'); run(S, cells, 66, '1 →pistol'); if (!S.pl.pistolUp) say(`sling/${name}: Digit1 did not put the pistol up: ${S.state()}`);
    S.tap('Digit2'); run(S, cells, 66, '2 →rifle'); if (!S.pl.rifleUp) say(`sling/${name}: Digit2 did not put the rifle back up: ${S.state()}`);
    rows.push({ name: `the rifle lives ${name}: 1 (rifle away, pistol out) · 2 (pistol away, rifle out)`, variant: v, cells }); stats('sling', name, S.log); }
  write('kitanim-sling', 'The rifle away and out again: over the shoulder, and on a sling in front', 'kit handling on in both rows · a cell every 3rd frame', [rows]); }

// 3d ---- night vision: by hand with the hands empty, by a nod with the rifle up
if (want('nv')) { const rows: Row[] = [];
  for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = []; (S as any).goggles = true; S.step(30); S.log.length = 0;   // (this strip DRAWS the goggles: every other one leaves them out)
    cells.push({ fr: S.step(1), label: ['hands empty', kitLabel(S)] });
    S.tap('KeyN'); run(S, cells, 60, 'N →down'); if (!S.pl.nv) say(`nv/${v}: N did not turn night vision on: ${S.state()}`);
    S.tap('KeyN'); run(S, cells, 60, 'N →up'); if (S.pl.nv) say(`nv/${v}: N did not turn night vision off: ${S.state()}`);
    rows.push({ name: `${v}: hands empty · N (goggles down) · N (up again)`, variant: v, cells }); stats('nv', v, S.log); }
  { const S = await world(true); const cells: Cell[] = []; (S as any).goggles = true; S.tap('Digit2'); S.step(90); if (!S.pl.rifleUp) say(`nv/nod: could not get the rifle up to begin with: ${S.state()}`); S.log.length = 0;
    cells.push({ fr: S.step(1), label: ['rifle up', kitLabel(S)] });
    S.tap('KeyN'); run(S, cells, 30, 'N →down', 2); S.tap('KeyN'); run(S, cells, 30, 'N →up', 2);
    rows.push({ name: 'after: the rifle in his hands · N is a nod of the head, down and up again', variant: 'after', cells }); stats('nv', 'nod', S.log); }
  write('kitanim-nv', 'Night vision on and off: by hand, or by a nod', NOTE + ' · a cell every 3rd frame (every 2nd in the nod row)', [rows]); }

if (want('can')) { const rows: Row[] = [];
  for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = [];
    S.tap('KeyE'); S.step(70); if (!S.pl.pistolUp) say(`can/${v}: could not draw the pistol to begin with: ${S.state()}`); S.log.length = 0;
    cells.push({ fr: S.step(1), label: ['pistol up, settled', kitLabel(S)] });
    S.tap('Digit3'); run(S, cells, 50, '3 →can'); if (S.pl.slot !== 'smoke' || S.pl.holstered) say(`can/${v}: Digit3 did not put a smoke can in the hand: ${S.state()} cans ${S.g.throwCount?.('smoke')}`);
    S.tap('Digit1'); run(S, cells, 50, '1 →pistol'); if (!S.pl.pistolUp) say(`can/${v}: Digit1 did not bring the pistol back: ${S.state()}`);
    rows.push({ name: `${v}: pistol drawn · 3 (pistol away, smoke can out) · 1 (can away, pistol out)`, variant: v, cells }); stats('can', v, S.log); }
  write('kitanim-can', 'Pistol to smoke can and back', NOTE + ' · a cell every 3rd frame', [rows]); }

// 5, 6 ---- the magazine changes
async function reloads(gun: 'pistol' | 'rifle') {
  const groups: Row[][] = [];
  for (const kind of ['tactical', 'empty'] as const) { const rows: Row[] = [];
    for (const [on, v] of VARS) { const S = await world(on); const cells: Cell[] = []; const pl = S.pl, an = S.an, fa = () => gun === 'pistol' ? pl.pistol : pl.rifle;
      S.tap(gun === 'pistol' ? 'KeyE' : 'Digit2'); S.step(90); if (gun === 'pistol' ? !pl.pistolUp : !pl.rifleUp) say(`reload-${gun}/${kind}/${v}: the ${gun} is not up: ${S.state()}`);
      // the rounds: three for the tactical change; for the empty one until nothing is chambered (the pistol a click every 20 frames, ≤ 20; the rifle holds 30 + 1 so every 14 frames, ≤ 40)
      const gap = gun === 'pistol' ? 20 : 14, cap = kind === 'tactical' ? 3 : gun === 'pistol' ? 20 : 40; let shots = 0;
      while (shots < cap && (kind === 'tactical' || fa().chamber !== 0)) { const m0 = fa().mag + fa().chamber; S.click(); S.step(gap); if (fa().mag + fa().chamber < m0) shots++; else { say(`reload-${gun}/${kind}/${v}: a click fired nothing (mag ${fa().mag} chamber ${fa().chamber}; ${S.state()})`); break; } }
      if (kind === 'tactical') S.step(20 - Math.min(20, gap)); S.step(6);
      const before = `mag ${fa().mag} + ${fa().chamber} · spare [${fa().spare}]`; if (kind === 'empty' && fa().chamber !== 0) say(`reload-${gun}/${kind}/${v}: after ${shots} rounds a round is still chambered (${before})`);
      S.log.length = 0; const f0 = S.step(1); S.markBase(); cells.push({ fr: f0, label: [`${shots} fired`, before] });
      S.tap('KeyR'); let n = 0, magL: number[] = [], minus: number[] = []; const CAP = gun === 'pistol' ? 140 : 190; let started = false;
      for (n = 1; n <= CAP; n++) { const fr = S.step(1); const busy = an.reloading || fa().reloading; started ||= busy;
        const ex = fr.boxes.filter(b => b.extra); if (ex.length) magL.push(n); if (fr.boxes.length - ex.length < f0.boxes.length) minus.push(n);
        const dL = ex.length ? Math.min(...ex.map(b => Math.min(...handPts(fr, 'L').map(p => boxDist(p, b))))) : NaN;
        if (n % 6 === 0 || !busy) cells.push({ fr, label: [`R + ${(n * DT).toFixed(2)} s${busy ? '' : ' done'}`, `mag ${fa().mag}+${fa().chamber} sp [${fa().spare}]`, `${ex.length ? `NEW box ×${ex.length}, ${(dL * 100).toFixed(0)} cm off L` : 'no new box'}${fr.boxes.length - ex.length < f0.boxes.length ? ' · one gone' : ''}`] });
        if (!busy && n > 2) break; }
      if (!started) say(`reload-${gun}/${kind}/${v}: R started no reload (${before}; ${S.state()})`);
      const span = (a: number[]) => a.length ? `${(a[0] * DT).toFixed(2)}‥${(a[a.length - 1] * DT).toFixed(2)} s (${a.length} f)` : 'never';
      say(`reload-${gun}/${kind}/${v}: ${shots} fired, ${before} → mag ${fa().mag} + ${fa().chamber} · spare [${fa().spare}] · took ${(Math.min(n, CAP) * DT).toFixed(2)} s${n > CAP ? ' (CAPPED: still reloading)' : ''} · a new box (magazine in the hand) ${span(magL)} · a box of the start missing (magazine out of the gun) ${span(minus)}`);
      rows.push({ name: `${kind.toUpperCase()} · ${v}: ${shots} fired (${before}), then R`, variant: v, cells }); stats(`reload-${gun} ${kind}`, v, S.log); }
    groups.push(rows); }
  write(`kitanim-reload-${gun}`, `The ${gun}'s magazine change: tactical (rounds left) and empty (dry, nothing chambered)`, NOTE + ' · a cell every 6th frame, labelled with the seconds since R', groups); }
if (want('reload-pistol')) await reloads('pistol');
if (want('reload-rifle')) await reloads('rifle');

// 7 ---- closer than ever: by distance, and standing still
if (want('close')) { const app: Row[] = [], hold: Row[] = []; const DS = [3.4, 2.8, 2.4, 2.0, 1.6, 1.3, 1.0, 0.85];
  const sheathD = (fr: Frame) => { const sh = fr.boxes.filter(b => b.name === 'sheath'); return sh.length ? Math.min(...sh.map(b => Math.min(...handPts(fr, 'R').map(p => boxDist(p, b))))) : NaN; };
  const lab = (S: World, fr: Frame) => [`closeK ${(+S.an.closeK).toFixed(2)} creep ${S.an.creep ? 'Y' : 'n'}`, `ready ${S.an.ready ?? '—'} reach ${(+S.an.reachShown).toFixed(2)}`, `hips ${fr.b.hips[1].toFixed(3)} · R→sheath ${(sheathD(fr) * 100).toFixed(0)} cm`];
  for (const [on, v] of VARS) { const S = await world(on, { guard: true }); S.cursor = [S.at[0], 1.2, S.at[2]]; const cells: Cell[] = []; S.log.length = 0;
    say(`close/${v}:   d    closeK creep ready     reach  hipsY   handR→sheath  handR (right, up, fwd)`);
    for (const d of DS) { S.put([S.at[0], 0, S.at[2] - d]); const fr = S.step(45); const real = Math.hypot(S.c.pos[0] - S.A.char.pos[0], S.c.pos[2] - S.A.char.pos[2]); if (Math.abs(real - d) > 0.03) say(`close/${v}: asked for ${d} m, he stands ${real.toFixed(2)} m off the man (Sam ${S.c.pos[0].toFixed(2)}, ${S.c.pos[2].toFixed(2)} · the man ${S.A.char.pos[0].toFixed(2)}, ${S.A.char.pos[2].toFixed(2)})`);
      cells.push({ fr, label: [`d ${d.toFixed(2)} m`, ...lab(S, fr)] });
      say(`close/${v}: ${real.toFixed(2)}  ${(+S.an.closeK).toFixed(2).padStart(5)}  ${S.an.creep ? 'Y' : 'n'}     ${String(S.an.ready ?? '—').padEnd(8)} ${(+S.an.reachShown).toFixed(2)}   ${fr.b.hips[1].toFixed(3)}   ${(sheathD(fr) * 100).toFixed(1).padStart(5)} cm     (${fr.b.handR.map(x => x.toFixed(2)).join(', ')})`); }
    app.push({ name: `${v}: walked in on a man's back — 45 frames stood at each distance`, variant: v, cells }); stats('close approach', v, S.log);
    // standing still at 1.6 m: are the hands alive
    const S2 = await world(on, { guard: true }); S2.cursor = [S2.at[0], 1.2, S2.at[2]]; S2.put([S2.at[0], 0, S2.at[2] - 1.6]); S2.step(45); S2.log.length = 0; const c2: Cell[] = []; const f0 = S2.step(1); c2.push({ fr: f0, label: ['d 1.60 m · settled', ...lab(S2, f0)] });
    let pR = 0, pL = 0, lo = { R: [Infinity, Infinity, Infinity], L: [Infinity, Infinity, Infinity] }, hi = { R: [-Infinity, -Infinity, -Infinity], L: [-Infinity, -Infinity, -Infinity] };
    for (let i = 1; i <= 90; i++) { const fr = S2.step(1); for (const s of ['R', 'L'] as const) { const p = mid(fr.b['hand' + s], fr.b['finger' + s]); for (let k = 0; k < 3; k++) { lo[s][k] = Math.min(lo[s][k], p[k]); hi[s][k] = Math.max(hi[s][k], p[k]); } }
      if (i % 15 === 0) c2.push({ fr, label: [`still + ${i} f · ${(i * DT).toFixed(2)} s`, ...lab(S2, fr)] }); }
    pR = Math.hypot(...hi.R.map((x, k) => x - lo.R[k])); pL = Math.hypot(...hi.L.map((x, k) => x - lo.L[k]));
    const fing = (s: 'R' | 'L') => { let a = Infinity, b = -Infinity; for (const fr of S2.log) { const d = dist(fr.b['hand' + s], fr.b['finger' + s]); a = Math.min(a, d); b = Math.max(b, d); } return (b - a) * 100; };
    say(`close/${v}: stood still at 1.6 m for 90 frames — the right palm ranges over ${(pR * 100).toFixed(1)} cm (box diagonal, his own frame), the left ${(pL * 100).toFixed(1)} cm; wrist→knuckle length changes ${fing('R').toFixed(2)} / ${fing('L').toFixed(2)} cm (R / L: the skeleton kept here stops at the knuckle, so finger curls are NOT seen by this tool)`);
    hold.push({ name: `${v}: stood still at 1.6 m, a cell every 15 frames`, variant: v, cells: c2 }); stats('close still', v, S2.log); }
  write('kitanim-close', 'Closer than ever: the carriage and the knife hand by distance to the man (grey, TOP view), hands empty', NOTE + ' · Sam teleported to each distance behind a man stood with his back to him, 45 frames at each, in the dark', [app, hold]); }

// 8 ---- on a wall (Q): the pistol goes to the thigh as he takes the wall and comes out again as he leaves it; the rifle is slung by hand off the stack
if (want('wall')) { const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`); const was = WALLSNAP.on; const pist: Row[] = [], rif: Row[] = [];   // (the switch is put on AFTER each stand-up: the frozen stand pins it off)
  for (const [on, v] of VARS) { const S = await world(on); WALLSNAP.on = true; const cells: Cell[] = []; S.tap('KeyE'); S.step(60); S.put([21.5, 0, 10.7]); S.step(10); S.log.length = 0;
    run(S, cells, 6, 'pistol up'); S.tap('KeyQ'); run(S, cells, 42, 'Q take'); if (!S.pl.wall) say(`wall/${v}: Q did not take the wall: ${S.state()}`);
    S.tap('KeyQ'); run(S, cells, 42, 'Q off'); if (S.pl.wall) say(`wall/${v}: the second Q did not let go: ${S.state()}`);
    pist.push({ name: `${v}: pistol up · Q takes the wall (pistol to the thigh) · Q lets go (pistol out)`, variant: v, cells }); stats('wall pistol', v, S.log); }
  for (const [on, v] of VARS) { const S = await world(on); WALLSNAP.on = true; const cells: Cell[] = []; S.tap('Digit2'); S.step(1); if (!S.pl.rifleUp) S.tap('KeyE'); S.step(80); S.put([21.5, 0, 10.7]); S.step(10); S.tap('KeyQ'); S.step(50); S.log.length = 0;
    if (S.pl.wall?.kind !== 'stack') say(`wall/${v}: Q with the rifle did not stack (${S.pl.wall ? S.pl.wall.kind ?? 'back hold' : 'no wall'}): ${S.state()}`);
    run(S, cells, 6, 'stacked'); S.tap('KeyE'); run(S, cells, 60, 'E sling'); if (S.pl.rifleUp) say(`wall/${v}: E on the stack left the rifle up: ${S.state()}`);
    rif.push({ name: `${v}: stacked with the rifle · E slings it (the hold becomes the back hold)`, variant: v, cells }); stats('wall rifle', v, S.log); }
  write('kitanim-wall', 'On a wall: the pistol to the thigh and out again, the rifle slung off the stack', NOTE + ' · WALLSNAP on · a cell every 3rd frame', [pist, rif]); WALLSNAP.on = was; }

KITANIM.on = false;

// ---------------------------------------------------------------- the table
console.log('\n=== worst one-frame jumps (every frame measured, in his pelvis frame; hips in the world, teleports left out) ===');
const padr = (s: string, n: number) => s.length >= n ? s : s + ' '.repeat(n - s.length);
console.log(padr('scenario', 24) + padr('variant', 8) + padr('frames', 7) + padr('right wrist', 20) + padr('left wrist', 20) + padr('prop box', 44) + padr('hips', 18) + 'non-finite');
for (const s of table) console.log(padr(s.name, 24) + padr(s.variant, 8) + padr(String(s.frames), 7) + padr(cm(s.handR).replace(/ hand[LR]$/, ''), 20) + padr(cm(s.handL).replace(/ hand[LR]$/, ''), 20) + padr(cm(s.box), 44) + padr(cm(s.hips).replace(' hips (world)', ''), 18) + s.bad);
console.log('\n=== kit on the move (a box moving > 5 mm a frame in his frame and not riding a bone): the farthest its nearest moving box of one tag gets from the nearer hand · and the nearest approaches to the trunk line (hips–spine–chest–neck) and the head\'s centre (a head is ~10 cm in radius, a trunk ~10 cm front to back off its line: less than that is THROUGH him) ===');
console.log(padr('scenario', 24) + padr('variant', 8) + padr('moving kit off a hand', 28) + padr('hand to trunk line', 26) + padr('hand to head centre', 26) + padr('moving kit (box surface) to trunk line', 44) + 'moving kit (box surface) to head centre');
for (const s of table) console.log(padr(s.name, 24) + padr(s.variant, 8) + padr(cm(s.float), 28) + padr(cm(s.trunkHand), 26) + padr(cm(s.headHand), 26) + padr(cm(s.trunkKit), 44) + cm(s.headKit));
console.log('\n=== prop boxes that came (+) or went (−), by frame ===');
for (const s of table) console.log(`${padr(s.name, 24)}${padr(s.variant, 8)}${s.came.length ? s.came.slice(0, 14).join('  ') + (s.came.length > 14 ? `  … ${s.came.length - 14} more` : '') : 'none'}`);
if (notes.length) { console.log('\n=== notes ==='); for (const n of notes) console.log(n); }
console.log(`\n${written.length} files written`);
