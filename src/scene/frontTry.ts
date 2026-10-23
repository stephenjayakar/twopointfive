// A HOUSE FRONT DRESSED BY HAND, A TRIAL (the look page only: main.ts, with ?look; ?front=0 leaves it out — off on every other page, and nothing here keeps state).
// The pass's tea house faces its yard with one wall the level kit laid out: the same window twice, the same red panel either side of the door, a clean line from
// end to end. Seen from over the yard it reads as made by a rule. Here that ONE wall is gone over as a person would have left it, every piece placed by hand
// (the numbers below are authored, not rolled), after the level loads and before its boxes go to the world:
//   THE OPENINGS DIFFER  the first window is boarded (four planks, one hanging by a nail), the second has shutters (one shut, one swung out), the third a blanket
//                        nailed over it with a corner loose
//   THE PAINT DIFFERS    the first red panel is worn at its top; the second was plastered over (a strip of it shows under fresh mud); the far one by the yard
//                        wall's door is another colour and height
//   THE WALL WAS MENDED  patches of newer and older mud in three places, a spout with its streak and ice at the foot
//   THE ROOF SHOWS       beam ends through the wall under the roof line, unevenly spaced, one snapped short
//   THINGS WERE LEFT     split wood stacked under the second window, a ladder leaned over the level's own planks, a plank bench with a can and a pot, a can on
//                        its side, a few mud bricks at the wall's end
// ONE MODEL: what closes a window is a real box (a round, a look and the room's lamp stop at a plank, a shutter, the blanket, and pass between the planks), and so is
// what stands on the ground (none within a stride of a door) and the beam ends over every head. Only what lies flat ON the wall is picture only (NoShadow), as the
// level's own panels are. Colours are the level palette's rows, darkened in one piece, so the look's maps know mud from wood from paint (render/gbuffer.ts
// lookClass). KNOWN: a tilted box (Box.rot: the planks, the ladder, the blanket) takes no map and no clinging snow from the look; a wall charge here leaves the
// pieces above a hand's height hanging (scene/lookTidy.ts takes a decal with its wall only from the foot).
import { BoxFlag, type Box } from './boxes';
import { cutPlane, cutRecord, fitCutBox, type CutPlane } from './cut';
import { quat, type Quat, type Vec3 } from '../math/vec';

const D = Math.PI / 180;
type More = Partial<Box>;
const box = (c: Vec3, h: Vec3, albedo: Vec3, o: More = {}): Box => ({ c, h, yaw: 0, albedo, emissive: [0, 0, 0], flags: 0, owner: 0, cutHeight: 1000000, rough: 0.95, ...o });
/** a palette row darkened in one piece (0.55 < k < 0.99 keeps the row's class; 1 = the row) */
const of = (row: Vec3, k = 1): Vec3 => [row[0] * k, row[1] * k, row[2] * k];
/** the eight planes that make a box of square section a twelve-sided prism about its own y (2) or z (3) */
const round = (r: number, axis: 2 | 3): CutPlane[] => [30, 60, 120, 150, 210, 240, 300, 330].map(d => cutPlane(axis === 3 ? [Math.cos(d * D), Math.sin(d * D), 0] : [Math.cos(d * D), 0, Math.sin(d * D)], r));
/** a flat shape on a wall face at z: a thin box about (x, y), w × h half-sizes, its outline cut by planes given as [degrees round the face, share of the way out 0‥1] */
function flat(x: number, y: number, z: number, w: number, h: number, albedo: Vec3, edges: readonly (readonly [number, number])[], o: More = {}): Box | null {
  const b = box([x, y, z], [w, h, 0.003], albedo, { flags: BoxFlag.NoShadow, ...o });
  if (edges.length) { b.cut = cutRecord(b.h, edges.map(([a, k]) => cutPlane([Math.cos(a * D), Math.sin(a * D), 0], k * (Math.abs(Math.cos(a * D)) * w + Math.abs(Math.sin(a * D)) * h)))).cut; if (!fitCutBox(b)) return null; }
  return b;
}
/** a round timber lying along its own z, r thick and len long, with its pale end grain showing on the +z end */
function log(out: Box[], c: Vec3, r: number, len: number, bark: Vec3, grain: Vec3, o: More = {}) {
  const b = box(c, [r, r, len / 2], bark, { rough: 0.9, ...o }); b.cut = cutRecord(b.h, round(r, 3)).cut; b.cutRound = 3; out.push(b);
  const yaw = o.yaw ?? 0, e = len / 2 + 0.002, cap = box([c[0] + Math.sin(yaw) * e, c[1], c[2] + Math.cos(yaw) * e], [r * 0.93, r * 0.93, 0.002], grain, { flags: BoxFlag.NoShadow, rough: 0.9, yaw });
  cap.cut = cutRecord(cap.h, round(r * 0.93, 3)).cut; out.push(cap);
}

// the level palette's rows this wall is made of (scene/gwotPalette.ts)
const MUD: Vec3 = [0.42, 0.32, 0.21], MUD_LIGHT: Vec3 = [0.56, 0.46, 0.33], MUD_DARK: Vec3 = [0.29, 0.22, 0.15], POPLAR: Vec3 = [0.47, 0.36, 0.22], WOOD_GREY: Vec3 = [0.33, 0.29, 0.23], PLY: Vec3 = [0.55, 0.43, 0.27];
const RUST_PAINT: Vec3 = [0.3, 0.075, 0.04], GREEN_PAINT: Vec3 = [0.08, 0.24, 0.16], BLUE_PAINT: Vec3 = [0.06, 0.19, 0.32], BLANKET: Vec3 = [0.3, 0.3, 0.31], IRON: Vec3 = [0.098, 0.1, 0.112], OLIVE: Vec3 = [0.15, 0.17, 0.09], JERRY: Vec3 = [0.62, 0.46, 0.05];
const WOOD_A = of(POPLAR, 0.66), WOOD_B = of(WOOD_GREY, 0.66), WOOD_C = WOOD_GREY, BARK = of(WOOD_GREY, 0.57), BARK_B = of(POPLAR, 0.57), GRAIN = of(PLY, 0.92), GRAIN_B = of(POPLAR, 0.95);

/** the pass's tea house, by the boxes its file gives the wall: the two red panels and the second window's first pane */
function isFront(B: readonly Box[]): boolean {
  const p = B[61], p2 = B[62], g = B[29];
  return !!p && !!p2 && !!g && Math.abs(p.c[0] - 16.2) < 0.01 && Math.abs(p.c[2] - 11.124) < 0.01 && !!(p.flags & BoxFlag.NoShadow) && Math.abs(p2.c[0] - 18.3) < 0.01 && !!(p2.flags & BoxFlag.NoShadow)
    && Math.abs(g.c[0] - 19.65) < 0.01 && Math.abs(g.c[2] - 11) < 0.01 && !!(g.flags & BoxFlag.Glass);
}

/** dress the front (see the head). Returns how many boxes it added: 0 = not this house, nothing touched. */
export function dressFront(level: { boxes: Box[] }): number {
  const B = level.boxes; if (!isFront(B)) return 0;
  const out: Box[] = [], add = (b: Box | null) => { if (b) out.push(b); };
  const Z = 11.12;   // the wall's yard face (the yard is +z)
  const lean = (yaw: number, back: number): Quat => quat.mul(quat.yaw(yaw), quat.axisAngle([1, 0, 0], -back));   // stood up, its top tipped `back` toward the wall, then turned

  // ---- the paint ----
  const p1 = B[61]; p1.albedo = of(RUST_PAINT, 0.9);   // worn at the top, a bite out of one corner
  p1.cut = cutRecord(p1.h, [cutPlane([0.16, 1, 0], 0.47), cutPlane([1, 0.9, 0], 0.62), cutPlane([-1, 0.35, 0], 0.6)]).cut; fitCutBox(p1);
  const p2 = B[62]; p2.c = [18.3, 0.2, p2.c[2]]; p2.h = [0.5, 0.2, p2.h[2]]; p2.albedo = of(RUST_PAINT, 0.8);   // plastered over: a strip is left under the patch
  add(flat(18.42, 0.82, Z + 0.011, 0.58, 0.5, of(MUD_LIGHT, 0.9), [[18, 0.9], [72, 0.86], [141, 0.8], [203, 0.93], [262, 0.84], [318, 0.8]]));
  const p4 = B[64]; if (p4 && Math.abs(p4.c[0] - 27.88) < 0.02 && (p4.flags & BoxFlag.NoShadow)) { p4.albedo = of(BLUE_PAINT, 0.75); p4.c = [p4.c[0], 0.42, p4.c[2]]; p4.h = [p4.h[0], 0.42, p4.h[2]]; }

  // ---- mended wall ----
  add(flat(23.3, 2.28, Z + 0.003, 0.95, 0.4, of(MUD, 0.8), [[8, 0.94], [64, 0.8], [118, 0.88], [171, 0.9], [236, 0.78], [305, 0.86]]));
  add(flat(12.86, 0.55, Z + 0.003, 0.3, 0.55, MUD_DARK, [[25, 0.85], [80, 0.9], [150, 0.95], [334, 0.8]]));
  // a spout under the roof, the streak its water left and the ice at the foot
  add(box([12.26, 2.36, Z + 0.1], [0.035, 0.035, 0.13], IRON, { rot: quat.axisAngle([1, 0, 0], 16 * D), rough: 0.6, metal: true }));
  add(flat(12.26, 1.18, Z + 0.007, 0.1, 1.14, of(MUD, 0.6), [[4, 0.55], [176, 0.5], [90, 0.97]]));
  { const ice = box([12.28, 0.05, Z + 0.17], [0.2, 0.05, 0.15], [0.62, 0.7, 0.78], { rough: 0.12, flags: BoxFlag.NoShadow, yaw: 0.2 }); ice.cut = cutRecord(ice.h, [cutPlane([0.5, 1, 0.2], 0.035), cutPlane([-0.6, 1, 0.5], 0.04), cutPlane([0.1, 1, -0.8], 0.05)]).cut; if (fitCutBox(ice)) out.push(ice); }

  // ---- the first window, boarded (real boards: a look passes between them, not through them) ----
  const plank = (x: number, y: number, w: number, roll: number, a: Vec3, hh: number, over = 0) => add(box([x, y, Z + 0.016 + over], [w, hh, 0.012], a, { rot: quat.axisAngle([0, 0, 1], roll * D), rough: 0.9 }));
  plank(14.08, 1.68, 1.04, -2.5, WOOD_A, 0.07); plank(14.14, 1.36, 0.99, 3.5, WOOD_B, 0.085);
  plank(13.42, 0.95, 0.5, 78, WOOD_C, 0.06, 0.024); plank(14.52, 1.08, 0.5, -27, WOOD_C, 0.055, 0.024);   // one hangs by its last nail, one was nailed across the others

  // ---- the second window: one shutter shut, one swung out, split wood stacked under it ----
  add(box([19.66, 1.375, Z + 0.016], [0.46, 0.5, 0.014], of(GREEN_PAINT, 0.9), { rough: 0.8 }));
  add(box([19.66, 1.66, Z + 0.034], [0.44, 0.035, 0.006], of(GREEN_PAINT, 0.6), { flags: BoxFlag.NoShadow })); add(box([19.66, 1.1, Z + 0.034], [0.44, 0.035, 0.006], of(GREEN_PAINT, 0.6), { flags: BoxFlag.NoShadow }));
  { const a = 62 * D, hx = 21.02, len = 0.45; add(box([hx + Math.cos(a) * len, 1.375, Z + 0.01 + Math.sin(a) * len], [len, 0.5, 0.014], of(GREEN_PAINT, 0.98), { yaw: -a, rough: 0.8 })); }
  const stack: [number, number, number, number][] = [   // x, row, r, how far it stands out from the wall
    [19.36, 0, 0.085, 0.02], [19.54, 0, 0.075, 0.05], [19.7, 0, 0.09, 0.0], [19.89, 0, 0.07, 0.04], [20.05, 0, 0.085, 0.02], [20.23, 0, 0.08, 0.06], [20.4, 0, 0.07, 0.01], [20.56, 0, 0.09, 0.03], [20.75, 0, 0.075, 0.05],
    [19.45, 1, 0.08, 0.04], [19.62, 1, 0.07, 0.0], [19.79, 1, 0.085, 0.05], [19.98, 1, 0.08, 0.02], [20.15, 1, 0.07, 0.06], [20.32, 1, 0.085, 0.01], [20.5, 1, 0.075, 0.04],
    [19.56, 2, 0.075, 0.03], [19.72, 2, 0.07, 0.06], [19.9, 2, 0.08, 0.01], [20.08, 2, 0.07, 0.04]];
  stack.forEach(([x, row, r, off], i) => log(out, [x, 0.05 + r + row * 0.145, Z + 0.21 + off], r, 0.38 + 0.04 * ((i * 7) % 3), i % 4 === 1 ? BARK_B : BARK, i % 3 === 2 ? GRAIN_B : GRAIN));
  log(out, [21.05, 0.09, Z + 0.72], 0.08, 0.42, BARK, GRAIN, { yaw: 1.05 }); log(out, [20.6, 0.075, Z + 0.78], 0.07, 0.36, BARK_B, GRAIN, { yaw: -0.5 });   // two that rolled off

  // ---- a ladder leaned over the level's own stack of planks ----
  { const yaw = 0.09, back = 15 * D, q = lean(yaw, back), L = 1.42, mid: Vec3 = [21.72, L * Math.cos(back), Z + 0.05 + L * Math.sin(back)];
    const ax: Vec3 = [Math.cos(yaw), 0, -Math.sin(yaw)], up: Vec3 = [-Math.sin(back) * Math.sin(yaw), Math.cos(back), -Math.sin(back) * Math.cos(yaw)];
    for (const s of [-1, 1]) add(box([mid[0] + ax[0] * 0.2 * s, mid[1], mid[2] + ax[2] * 0.2 * s], [0.022, L, 0.03], s < 0 ? WOOD_A : WOOD_C, { rot: q, yaw, rough: 0.9 }));
    for (let k = 0; k < 7; k++) { if (k === 4) continue; const t = -1.1 + k * 0.36; add(box([mid[0] + up[0] * t, mid[1] + up[1] * t, mid[2] + up[2] * t], [0.2, 0.016, 0.018], WOOD_B, { rot: q, yaw, rough: 0.9 })); }   // (a rung is gone)
  }

  // ---- a plank bench on two stacks of brick, a can and a pot on it, a can on its side in front ----
  add(box([23.08, 0.19, Z + 0.24], [0.13, 0.19, 0.15], of(MUD, 0.93), { yaw: 0.06 })); add(box([23.92, 0.17, Z + 0.25], [0.15, 0.17, 0.14], of(MUD_LIGHT, 0.78), { yaw: -0.09 }));
  add(box([23.5, 0.385, Z + 0.25], [0.56, 0.024, 0.17], WOOD_A, { yaw: 0.035, rough: 0.9 }));
  add(box([23.2, 0.58, Z + 0.24], [0.11, 0.17, 0.07], of(JERRY, 0.8), { yaw: 0.35, rough: 0.55 })); add(box([23.2, 0.77, Z + 0.24], [0.03, 0.02, 0.03], [0.1, 0.1, 0.1], { yaw: 0.35, flags: BoxFlag.NoShadow }));
  { const pot = box([23.76, 0.48, Z + 0.25], [0.13, 0.07, 0.13], IRON, { rough: 0.5, metal: true }); pot.cut = cutRecord(pot.h, round(0.13, 2)).cut; pot.cutRound = 2; out.push(pot); }
  add(box([23.44, 0.085, Z + 0.66], [0.17, 0.075, 0.11], OLIVE, { yaw: -0.55, rough: 0.6 }));

  // ---- the third window: a blanket nailed over it, one corner loose ----
  { const t = box([26.8, 1.37, Z + 0.014], [0.72, 0.6, 0.008], of(BLANKET, 0.85), { rough: 0.98, rot: quat.axisAngle([0, 0, 1], -1.5 * D) });
    t.cut = cutRecord(t.h, [cutPlane([0.42, -1, 0], 0.46), cutPlane([-0.06, 1, 0], 0.57), cutPlane([-1, -0.05, 0], 0.69)]).cut; if (fitCutBox(t)) out.push(t); }
  add(box([26.78, 1.96, Z + 0.026], [0.74, 0.03, 0.008], WOOD_B, { flags: BoxFlag.NoShadow, rot: quat.axisAngle([0, 0, 1], 1 * D) }));

  // ---- beam ends under the roof line: x, how far out, r ----
  const beams: [number, number, number][] = [[12.4, 0.3, 0.07], [14.55, 0.36, 0.065], [16.3, 0.24, 0.075], [18.05, 0.34, 0.06], [19.0, 0.07, 0.07], [20.9, 0.38, 0.07], [23.1, 0.27, 0.075], [24.05, 0.33, 0.06], [26.3, 0.3, 0.07]];
  for (const [x, o, r] of beams) log(out, [x, 2.64 + (x * 7.3 % 1) * 0.05, Z + o / 2 - 0.01], r, o + 0.02, of(WOOD_GREY, 0.6), of(POPLAR, 0.78));

  // ---- a few mud bricks left at the wall's end, by the spout ----
  const brick = (x: number, y: number, z: number, yaw: number, a: Vec3) => add(box([x, y, z], [0.14, 0.045, 0.065], a, { yaw }));
  brick(12.62, 0.045, Z + 0.2, 0.04, of(MUD, 0.95)); brick(12.93, 0.045, Z + 0.22, -0.07, of(MUD, 0.86)); brick(12.76, 0.135, Z + 0.21, -0.12, of(MUD, 0.9)); brick(12.98, 0.135, Z + 0.2, 0.3, of(MUD_LIGHT, 0.75));
  brick(12.7, 0.045, Z + 0.52, 0.9, of(MUD, 0.95));

  for (const b of out) B.push(b);
  return out.length;
}
