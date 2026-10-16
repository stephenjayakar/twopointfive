// LIVED-IN ROOMS for the seven training lessons (the maintainer, 10-10: "the office level is awesome and it has a lot of personality per
// room, we should makes sure all levels are like that"). What is here: the small furniture vocabulary the seven `furnish()` steps are
// written in (each lesson's own things live in ITS generator, tools/levels/train-<name>.ts), and the seven SIGNATURE PIECES — one per
// corner of the compound, stood inside its own corner and again outside the walls of the two lessons next door, so a neighbour's
// landmark is the same place:
//   motor pool = the engine hoist · kitchen court = the row of cauldrons · generator yard = the cable spools · the range = the red flag
//   · quarters = the wash bench · the white house = the pigeon loft · the well court = the water cart.
//
// The contract (src/scene/lived.ts, rebuild/play-style-levels/rooms/read-first.md): every box is in a group
// `lived.<place>`, every prop is named `lived.<place>.<kind><n>`, all of it the TAIL of the generator's lists — so a furnish step runs
// AFTER `T.finish()` — and NO LIGHT is added on any of the seven (lesson 3 is about the lights; the quiet lessons' dark ways are measured).
// Boxes only, flat colours off the GWOT kit's palette, no dice: the same file every run.
import { BoxFlag } from '../../src/scene/boxes';
import { GW_SHELL, type GwotMat } from '../../src/scene/gwotKit';
import type { PropKind } from '../../src/scene/level';
import type { trainGround } from './train-ground';

type Ground = ReturnType<typeof trainGround>;
const NS = BoxFlag.NoShadow;
interface Part { off: [number, number, number]; h: [number, number, number]; m: GwotMat; yaw?: number; }

export function livedTrain(T: Ground) {
  const { G, K } = T, M = G.M;
  let room = '', from = K.props.length; const count = new Map<string, number>();
  /** the props added since the last place get their lived names */
  const seal = () => { for (let i = from; i < K.props.length; i++) { const p = K.props[i], k = `${room}.${p.kind}`, n = count.get(k) ?? 0; count.set(k, n + 1); p.name = `lived.${k}${n}`; } from = K.props.length; };
  /** everything from here on belongs to `lived.<id>` */
  const place = (id: string) => { seal(); room = id; T.grp(`lived.${id}`); };
  const done = () => seal();

  // ---- boxes, in world rectangles
  const bx = (x0: number, z0: number, x1: number, z1: number, y0: number, y1: number, m: GwotMat, flags = 0, yaw = 0) =>
    T.add({ c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, (y1 - y0) / 2, Math.abs(z1 - z0) / 2], ...M[m], ...(flags ? { flags } : {}), ...(yaw ? { yaw } : {}) });
  /** a round thing: two squares an eighth of a turn apart */
  const rd = (x: number, z: number, r: number, y0: number, y1: number, m: GwotMat, flags = 0) => {
    const k = r * 0.9; bx(x - k, z - k, x + k, z + k, y0, y1, m, flags); bx(x - k, z - k, x + k, z + k, y0, y1 - 0.003, m, flags, Math.PI / 4);
  };
  /** drawn on the ground (never solid) */
  const flat = (x0: number, z0: number, x1: number, z1: number, m: GwotMat, y = 0.03, yaw = 0) => bx(x0, z0, x1, z1, y - 0.003, y + 0.003, m, NS, yaw);
  /** hung on a wall's face, drawn only: `axis` 'x' = a wall along X at z = line; a‥b along it; side ±1 = the face it hangs on;
   *  `proud` = how thick, `stand` = how far off the face it starts (a thing ON a board stands the board's thickness off) */
  const hung = (axis: 'x' | 'z', line: number, a: number, b: number, side: 1 | -1, y0: number, y1: number, m: GwotMat, proud = 0.02, stand = 0, flags = NS) => {
    const n = line + side * (GW_SHELL / 2 + 0.014 + stand), f = n + side * proud;
    return axis === 'x' ? bx(a, Math.min(n, f), b, Math.max(n, f), y0, y1, m, flags) : bx(Math.min(n, f), a, Math.max(n, f), b, y0, y1, m, flags);
  };
  /** a frame at (x, z): turn 0 = local x along the world's x, 1 = along its z */
  const at = (x: number, z: number, turn: 0 | 1 = 0) => ({
    b: (lx0: number, lz0: number, lx1: number, lz1: number, y0: number, y1: number, m: GwotMat, flags = 0) =>
      turn ? bx(x + lz0, z + lx0, x + lz1, z + lx1, y0, y1, m, flags) : bx(x + lx0, z + lz0, x + lx1, z + lz1, y0, y1, m, flags),
    r: (lx: number, lz: number, rad: number, y0: number, y1: number, m: GwotMat, flags = 0) => turn ? rd(x + lz, z + lx, rad, y0, y1, m, flags) : rd(x + lx, z + lz, rad, y0, y1, m, flags),
  });

  // ---- furniture
  /** a table: a top on four legs */
  const table = (x0: number, z0: number, x1: number, z1: number, top = 0.75, m: GwotMat = 'ply', leg: GwotMat = 'woodGrey') => {
    bx(x0, z0, x1, z1, top - 0.04, top, m);
    for (const [x, z] of [[x0 + 0.04, z0 + 0.04], [x1 - 0.1, z0 + 0.04], [x0 + 0.04, z1 - 0.1], [x1 - 0.1, z1 - 0.1]]) bx(x, z, x + 0.06, z + 0.06, 0, top - 0.04, leg);
  };
  /** a plank on two blocks: a bench, a low stand */
  const plank = (x0: number, z0: number, x1: number, z1: number, h = 0.42, m: GwotMat = 'poplar', foot: GwotMat = 'block') => {
    bx(x0, z0, x1, z1, h - 0.04, h, m);
    if (x1 - x0 > z1 - z0) { bx(x0 + 0.08, z0 + 0.03, x0 + 0.2, z1 - 0.03, 0, h - 0.04, foot); bx(x1 - 0.2, z0 + 0.03, x1 - 0.08, z1 - 0.03, 0, h - 0.04, foot); }
    else { bx(x0 + 0.03, z0 + 0.08, x1 - 0.03, z0 + 0.2, 0, h - 0.04, foot); bx(x0 + 0.03, z1 - 0.2, x1 - 0.03, z1 - 0.08, 0, h - 0.04, foot); }
  };
  /** open shelving: two ends and a board at each of `levels` */
  const rack = (x0: number, z0: number, x1: number, z1: number, height: number, levels: number[], m: GwotMat = 'woodGrey') => {
    if (x1 - x0 > z1 - z0) { bx(x0, z0, x0 + 0.04, z1, 0, height, m); bx(x1 - 0.04, z0, x1, z1, 0, height, m); for (const y of levels) bx(x0 + 0.04, z0 + 0.01, x1 - 0.04, z1 - 0.01, y - 0.03, y, m); }
    else { bx(x0, z0, x1, z0 + 0.04, 0, height, m); bx(x0, z1 - 0.04, x1, z1, 0, height, m); for (const y of levels) bx(x0 + 0.01, z0 + 0.04, x1 - 0.01, z1 - 0.04, y - 0.03, y, m); }
  };
  /** a row of things standing along a line: n boxes w × d, from y0 to y1, gap g, colours in turn */
  const row = (x: number, z: number, axis: 'x' | 'z', n: number, w: number, d: number, g: number, y0: number, y1: number, ms: GwotMat[], flags = 0) => {
    for (let i = 0; i < n; i++) { const o = i * (w + g); if (axis === 'x') bx(x + o, z, x + o + w, z + d, y0, y1 - (i % 2) * 0.012, ms[i % ms.length], flags); else bx(x, z + o, x + d, z + o + w, y0, y1 - (i % 2) * 0.012, ms[i % ms.length], flags); }
  };

  // ---- loose things (props: shoved, thrown by a blast)
  const loose = (kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: Part[]) =>
    K.prop(kind, x, z, yaw, mass, parts.map(p => ({ off: p.off, h: p.h, yaw: p.yaw ?? 0, albedo: M[p.m].albedo })));
  const stool = (x: number, z: number, m: GwotMat = 'poplar', yaw = 0) => loose('chair', x, z, yaw, 3, [
    { off: [0, 0.4, 0], h: [0.17, 0.02, 0.17], m },
    ...([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([a, b]): Part => ({ off: [a * 0.13, 0.19, b * 0.13], h: [0.02, 0.19, 0.02], m: 'woodGrey' })),
  ]);
  const bucket = (x: number, z: number, m: GwotMat = 'tin', fill: GwotMat = 'rubber') => loose('bin', x, z, 0, 2, [
    { off: [0, 0.14, 0], h: [0.13, 0.14, 0.13], m }, { off: [0, 0.283, 0], h: [0.11, 0.004, 0.11], m: fill },
  ]);
  /** a clay pot (or, in straw, a basket): round, a neck on it */
  const pot = (x: number, z: number, m: GwotMat = 'mudDark') => loose('bin', x, z, 0, 4, [
    { off: [0, 0.15, 0], h: [0.14, 0.15, 0.14], m }, { off: [0, 0.149, 0], h: [0.14, 0.149, 0.14], m, yaw: Math.PI / 4 }, { off: [0, 0.32, 0], h: [0.09, 0.02, 0.09], m },
  ]);
  /** a jerry can */
  const jerry = (x: number, z: number, yaw: number, m: GwotMat) => loose('bin', x, z, yaw, 5, [
    { off: [0, 0.2, 0], h: [0.17, 0.2, 0.07], m }, { off: [0.08, 0.43, 0], h: [0.04, 0.03, 0.03], m: 'plasticBlack' },
  ]);
  /** a helmet set down on its rim */
  const helmet = (x: number, z: number, yaw = 0, m: GwotMat = 'olive') => loose('bin', x, z, yaw, 1.5, [
    { off: [0, 0.08, 0], h: [0.12, 0.08, 0.1], m }, { off: [0, 0.02, 0.01], h: [0.13, 0.02, 0.12], m },
  ]);
  /** a canvas roll of tools or cleaning kit, tied */
  const toolRoll = (x: number, z: number, yaw = 0) => loose('cardboard', x, z, yaw, 1.5, [
    { off: [0, 0.05, 0], h: [0.24, 0.05, 0.07], m: 'canvas' }, { off: [0, 0.052, 0], h: [0.02, 0.052, 0.074], m: 'rubber' },
  ]);
  const chest = (x: number, z: number, yaw: number, m: GwotMat, hx = 0.28, hy = 0.15, hz = 0.18, lid: GwotMat = 'tin') => loose('cardboard', x, z, yaw, 6, [
    { off: [0, hy, 0], h: [hx, hy, hz], m }, { off: [0, hy * 2 + 0.008, 0], h: [hx + 0.01, 0.008, hz + 0.01], m: lid },
  ]);

  // ---- the seven signature pieces
  /** MOTOR POOL: an engine hoist, the engine hanging on its chain over a drip tray (beam along the frame's x) */
  const hoist = (x: number, z: number, turn: 0 | 1 = 0) => {
    const f = at(x, z, turn);
    for (const lx of [-0.72, 0.72]) for (const lz of [-0.45, 0.45]) f.b(lx - 0.03, lz - 0.03, lx + 0.03, lz + 0.03, 0, 2.3, 'rust');
    for (const lx of [-0.72, 0.72]) f.b(lx - 0.03, -0.48, lx + 0.03, 0.48, 2.24, 2.3, 'rust');   // a cross rail over each pair of legs: what the beam sits on
    f.b(-0.8, -0.05, 0.8, 0.05, 2.3, 2.42, 'rust');
    f.b(-0.012, -0.012, 0.012, 0.012, 1.42, 2.3, 'iron', NS); f.b(-0.06, -0.06, 0.06, 0.06, 1.3, 1.42, 'genYellow', NS);
    f.b(-0.3, -0.22, 0.3, 0.22, 0.72, 1.2, 'iron'); f.b(-0.26, -0.16, 0.26, 0.16, 1.2, 1.3, 'galv'); f.b(0.3, -0.14, 0.34, 0.14, 0.82, 1.12, 'rust');
    f.b(-0.42, -0.32, 0.42, 0.32, 0, 0.06, 'tin'); f.b(-0.36, -0.26, 0.36, 0.26, 0.06, 0.066, 'oil', NS);
  };
  /** KITCHEN COURT: n black cauldrons in a row on a mud hearth */
  const cauldrons = (x: number, z: number, turn: 0 | 1, n: number) => {
    const f = at(x, z, turn), L = n * 0.78;
    f.b(-L / 2, -0.36, L / 2, 0.36, 0, 0.32, 'mud');
    for (let i = 0; i < n; i++) { const c = -L / 2 + 0.39 + i * 0.78; f.r(c, 0, 0.29, 0.32, 0.72, 'iron'); f.b(c - 0.19, -0.19, c + 0.19, 0.19, 0.72, 0.727, 'rubber', NS); f.b(c - 0.11, 0.36, c + 0.11, 0.372, 0.04, 0.24, 'rubber', NS); }
    f.b(-L / 2 + 0.3, 0.06, -L / 2 + 0.36, 0.52, 0.74, 0.77, 'tin', NS);
  };
  /** GENERATOR YARD: a cable spool stood on its rim and one laid flat */
  const spools = (x: number, z: number, turn: 0 | 1 = 0) => {
    const f = at(x, z, turn);
    f.b(-0.6, -0.4, 0.6, -0.33, 0, 1.2, 'woodGrey'); f.b(-0.6, 0.33, 0.6, 0.4, 0, 1.2, 'woodGrey'); f.b(-0.33, -0.33, 0.33, 0.33, 0.27, 0.93, 'plasticBlack');
    f.r(1.45, 0.25, 0.55, 0, 0.07, 'woodGrey'); f.r(1.45, 0.25, 0.3, 0.07, 0.5, 'plasticBlack'); f.r(1.45, 0.25, 0.55, 0.5, 0.57, 'woodGrey');
  };
  /** THE RANGE: the red flag on its pole, a red and white square painted round the foot */
  const flag = (x: number, z: number) => {
    flat(x - 0.5, z - 0.5, x + 0.5, z + 0.5, 'truckRed', 0.026); flat(x - 0.32, z - 0.32, x + 0.32, z + 0.32, 'whitewash', 0.034);
    bx(x - 0.18, z - 0.18, x + 0.18, z + 0.18, 0, 0.3, 'block'); bx(x - 0.03, z - 0.03, x + 0.03, z + 0.03, 0.3, 3.5, 'galv');
    bx(x + 0.03, z - 0.012, x + 1.0, z + 0.012, 2.8, 3.45, 'truckRed', NS);
  };
  /** QUARTERS: the wash bench — tin basins in a row, towels on a rail behind */
  const basins = (x: number, z: number, turn: 0 | 1 = 0) => {
    const f = at(x, z, turn);
    f.b(-1.0, -0.2, 1.0, 0.2, 0.6, 0.66, 'poplar'); f.b(-0.92, -0.16, -0.8, 0.16, 0, 0.6, 'block'); f.b(0.8, -0.16, 0.92, 0.16, 0, 0.6, 'block');
    for (const c of [-0.66, 0, 0.66]) { f.b(c - 0.19, -0.15, c + 0.19, 0.15, 0.66, 0.76, 'tin'); f.b(c - 0.15, -0.11, c + 0.15, 0.11, 0.76, 0.766, 'plasticBlue', NS); }
    f.b(-1.0, -0.35, -0.95, -0.3, 0, 1.3, 'woodGrey'); f.b(0.95, -0.35, 1.0, -0.3, 0, 1.3, 'woodGrey'); f.b(-0.95, -0.34, 0.95, -0.31, 1.26, 1.29, 'woodGrey', NS);
    f.b(-0.7, -0.345, -0.25, -0.305, 0.75, 1.262, 'rugCream', NS); f.b(0.2, -0.345, 0.6, -0.305, 0.85, 1.264, 'blanketGrey', NS);
  };
  /** THE WHITE HOUSE: the headman's pigeon loft — a white box with a green roof up a pole (not blue: BLUE is a pair in the lesson it stands in) */
  const loft = (x: number, z: number) => {
    bx(x - 0.05, z - 0.05, x + 0.05, z + 0.05, 0, 1.9, 'woodGrey'); bx(x - 0.45, z - 0.35, x + 0.45, z + 0.35, 1.9, 2.45, 'whitewash');
    bx(x - 0.54, z - 0.44, x + 0.54, z + 0.44, 2.45, 2.51, 'paintGreen'); bx(x - 0.45, z + 0.35, x + 0.45, z + 0.5, 1.9, 1.93, 'woodGrey', NS);
    for (const o of [-0.28, 0, 0.28]) bx(x + o - 0.07, z + 0.35, x + o + 0.07, z + 0.357, 2.04, 2.26, 'rubber', NS);
    flat(x - 0.5, z + 0.2, x + 0.5, z + 0.9, 'straw', 0.026);
  };
  /** THE WELL COURT: the water cart — two barrels on a flat cart, shafts down on a prop */
  const waterCart = (x: number, z: number, turn: 0 | 1 = 0) => {
    const f = at(x, z, turn);
    f.b(-0.85, -0.45, 0.85, 0.45, 0.5, 0.56, 'woodGrey'); f.b(-0.32, -0.56, 0.32, -0.48, 0, 0.64, 'rubber'); f.b(-0.32, 0.48, 0.32, 0.56, 0, 0.64, 'rubber');
    f.b(0.85, -0.36, 1.7, -0.3, 0.5, 0.55, 'woodGrey'); f.b(0.85, 0.3, 1.7, 0.36, 0.5, 0.55, 'woodGrey'); f.b(1.6, -0.36, 1.66, 0.36, 0, 0.5, 'woodGrey');
    f.b(-0.8, -0.29, 0, 0.29, 0.56, 1.14, 'drumBlue'); f.b(0.04, -0.29, 0.84, 0.29, 0.56, 1.14, 'plasticBlue'); f.b(-0.86, -0.04, -0.8, 0.04, 0.62, 0.7, 'tin', NS);
  };

  return { place, done, bx, rd, flat, hung, at, table, plank, rack, row, loose, stool, bucket, pot, jerry, helmet, toolRoll, chest, hoist, cauldrons, spools, flag, basins, loft, waterCart, NS, G, T };
}
