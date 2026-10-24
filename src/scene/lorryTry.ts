// A LORRY WITH CURVES, A TRIAL (the look page only: main.ts lorryTryOn; ?lorry=0 = the lorry as its file has it). Asked 2026-10-24 on a picture of the pass's
// yard: "some curved surfaces on the truck would go a long way". The pass's lorry is twenty plain boxes under four flat slabs of snow; from above every
// line of it is straight. Here it is gone over by hand after the level loads (as the house front is, scene/frontTry.ts; levels/pass.json is not touched):
//   · the canvas tilt is BOWED over its hoops, and its snow lies on the bow;
//   · the cab's roof is an arch from the windscreen back, the windscreen leans, and the roof's snow lies on the arch;
//   · the bonnet is a narrow engine cover with a rounded top between two FENDERS that arch over the front wheels; snow on each;
//   · the wheels are round, with hubs; the headlamps are round in pods; a round tank hangs under the bed on each side.
// Made of what the engine has: a round prism (Box.cutRound: twelve sides about the box's own middle) for what is round all the way, and for a shallow curve
// AN ARC (Box.cutArc): a box whose top is cut to seven facets of a circle whose axis lies well under the box, shaded as one round face about that axis.
// ONE MODEL: each piece is a real box to every ray (sight, a round, a lamp's shadow), and what pushes against it meets the uncut box, as with every cut box.
// WHAT A RAY AND A BODY MEET IS NOT THE LEVEL'S LORRY: the bonnet (1.5 m high, 0.98 m a side) is a hump 0.56 m a side that tops out at 1.46 m, with a fender
// of at most 1.08 m beside it and, for 0.63 m in front of each fender, only the 0.78 m bumper; the tilt's eaves come down from 1.95 m to 1.6 m; a tank closes a
// metre of the gap under the bed on each side. Sight and rounds across the nose change on this page. Never seen on a GPU.
import { BoxFlag, type Box } from './boxes';
import { cutPlane, cutRecord, type CutPlane } from './cut';
import type { Vec3 } from '../math/vec';
import { GWOT_PALETTE } from './gwotPalette';

const D = Math.PI / 180;
type More = Partial<Box>;
// where the pass's lorry stands (tools/levels/pass.ts LORRY): its nose toward local +x, local z across it
const LX = 17.1, LZ = 17.0, YAW = Math.PI * 0.75, CS = Math.cos(YAW), SN = Math.sin(YAW);
const at = (lx: number, y: number, lz: number): Vec3 => [LX + lx * CS + lz * SN, y, LZ - lx * SN + lz * CS];
// the level palette's rows it is made of (scene/gwotPalette.ts): a piece's colour is a row, or a row darkened in one piece, so the look gives it its map
const RED = GWOT_PALETTE.truckRed, CANVAS = GWOT_PALETTE.canvas, IRON = GWOT_PALETTE.iron, GALV = GWOT_PALETTE.galv;
const of = (row: Vec3, k: number): Vec3 => [row[0] * k, row[1] * k, row[2] * k];
const box = (lx: number, lz: number, y0: number, y1: number, hx: number, hz: number, albedo: Vec3, o: More = {}): Box =>
  ({ c: at(lx, (y0 + y1) / 2, lz), h: [hx, (y1 - y0) / 2, hz], yaw: YAW, albedo, emissive: [0, 0, 0], flags: 0, owner: 0, cutHeight: 1000000, rough: 0.5, ...o });
/** the eight planes that make a box of square section a twelve-sided prism of radius r about its own x (1) or z (3) */
const ring = (r: number, axis: 1 | 3): CutPlane[] => [30, 60, 120, 150, 210, 240, 300, 330].map(d => cutPlane(axis === 1 ? [0, Math.sin(d * D), Math.cos(d * D)] : [Math.cos(d * D), Math.sin(d * D), 0], r));
/** make `b` AN ARC: its top a round of radius R about its own x (1) or z (3), the round's highest line the box's top face, six more facets `step` degrees apart */
function arc(b: Box, R: number, axis: 1 | 3, step: number): Box {
  const k = R - b.h[1];   // how far under the box's centre the round's axis lies
  b.cut = cutRecord(b.h, [-3, -2, -1, 1, 2, 3].map(i => { const a = i * step * D; return cutPlane(axis === 1 ? [0, Math.cos(a), Math.sin(a)] : [Math.sin(a), Math.cos(a), 0], R - k * Math.cos(a)); })).cut;
  b.cutRound = axis; b.cutArc = k; delete b.marks;
  return b;
}
/** the radius of the round that rises `rise` over a chord of half-width w */
const radiusOf = (w: number, rise: number) => (w * w + rise * rise) / (2 * rise);

/** give the pass's lorry its curves (see the head). Returns how many boxes it added: 0 = not this lorry, nothing touched. */
export function dressLorry(level: { boxes: Box[] }): number {
  const B = level.boxes;
  const find = (lx: number, lz: number, y0: number, y1: number, hx: number, hz: number): Box | undefined => {
    const c = at(lx, (y0 + y1) / 2, lz);
    return B.find(b => Math.abs(b.c[0] - c[0]) < 0.01 && Math.abs(b.c[1] - c[1]) < 0.01 && Math.abs(b.c[2] - c[2]) < 0.01 && Math.abs(b.h[0] - hx) < 0.01 && Math.abs(b.h[1] - (y1 - y0) / 2) < 0.01 && Math.abs(b.h[2] - hz) < 0.01);
  };
  const tilt = find(-1.15, 0, 0.9, 1.95, 1.95, 1.06), tiltSnow = find(-1.15, 0, 1.95, 2.05, 1.84, 0.96), tiltSnow2 = find(-1.15, 0, 2.05, 2.11, 1.84, 0.96);
  const roof = find(1.5, 0, 2.08, 2.2, 0.62, 1.1), roofSnow = find(1.5, 0, 2.2, 2.27, 0.55, 1.02), glass = find(1.55, 0, 1.5, 2.08, 0.58, 1.06);
  const bonnet = find(2.75, 0, 0.74, 1.5, 0.62, 0.98), bonnetSnow = find(2.8, 0, 1.5, 1.555, 0.52, 0.9);
  const wheels = [2.2, -1.2, -2.25].flatMap(lx => [-1, 1].map(s => find(lx, s * 0.98, 0, 0.96, 0.48, 0.15))), lamps = [-1, 1].map(s => find(3.38, s * 0.7, 0.86, 1.02, 0.02, 0.1));
  if (!tilt || !tiltSnow || !tiltSnow2 || !roof || !roofSnow || !glass || !bonnet || !bonnetSnow || wheels.some(w => !w) || lamps.some(l => !l)) return 0;
  const out: Box[] = [];
  const set = (b: Box, lx: number, lz: number, y0: number, y1: number, hx: number, hz: number) => { b.c = at(lx, (y0 + y1) / 2, lz); b.h = [hx, (y1 - y0) / 2, hz]; return b; };
  const snowOf = (like: Box, lx: number, lz: number, y0: number, y1: number, hx: number, hz: number): Box => box(lx, lz, y0, y1, hx, hz, like.albedo, { flags: like.flags, rough: like.rough });

  // ---- the tilt: straight to the eave, then bowed over its hoops; the snow lies on the middle of the bow and has slid off its shoulders ----
  { const R = radiusOf(1.06, 0.45), y0 = 2.05 - R;   // the bow's axis
    set(tilt, -1.15, 0, 0.9, 1.6, 1.95, 1.06);
    out.push(arc(box(-1.15, 0, 1.6, 2.05, 1.95, 1.06, CANVAS, { rough: tilt.rough }), R, 1, 11.5));
    for (const lx of [-2.65, -1.65, -0.65, 0.35]) out.push(arc(box(lx, 0, 1.6, 2.062, 0.02, Math.sqrt((R + 0.012) ** 2 - (1.6 - y0) ** 2), of(CANVAS, 0.72), { rough: 0.9, flags: BoxFlag.NoShadow }), R + 0.012, 1, 11.5));
    arc(set(tiltSnow, -1.15, 0, 1.8, 2.11, 1.84, 0.8), R + 0.06, 1, 8);
    tiltSnow2.flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow; tiltSnow2.c = at(-1.15, 1.7, 0); tiltSnow2.h = [0.01, 0.01, 0.01]; }

  // ---- the cab: the roof an arch from the windscreen back, the windscreen leaned ----
  { const R = radiusOf(0.64, 0.2);
    arc(set(roof, 1.5, 0, 2.04, 2.24, 0.64, 1.1), R, 3, 9);
    arc(set(roofSnow, 1.5, 0, 2.11, 2.285, 0.5, 1.02), R + 0.045, 3, 7);
    const t = 14 * D; glass.cut = cutRecord(glass.h, [cutPlane([Math.cos(t), Math.sin(t), 0], Math.cos(t) * glass.h[0] - Math.sin(t) * glass.h[1])]).cut; }

  // ---- the nose: a narrow engine cover with a round top, a fender arched over each front wheel, the lamps in round pods ----
  { const R = radiusOf(0.56, 0.26);
    set(bonnet, 2.75, 0, 0.74, 1.2, 0.62, 0.56);
    out.push(arc(box(2.75, 0, 1.2, 1.46, 0.62, 0.56, RED, { rough: bonnet.rough }), R, 1, 12.5));
    arc(set(bonnetSnow, 2.75, 0, 1.33, 1.5, 0.52, 0.4), R + 0.04, 1, 9);
    out.push(box(3.376, 0, 0.8, 1.3, 0.006, 0.4, IRON, { rough: 0.5, metal: true, flags: BoxFlag.NoShadow }));   // the grille
    for (const s of [-1, 1]) {
      out.push(arc(box(2.2, s * 0.855, 0.74, 1.08, 0.54, 0.295, RED, { rough: bonnet.rough }), 0.6, 3, 16));     // (its axis is the wheel's own: 0.48 m up)
      out.push(arc(snowOf(bonnetSnow, 2.2, s * 0.855, 0.99, 1.11, 0.3, 0.22), 0.63, 3, 8));
      const pod = box(3.18, s * 0.68, 0.86, 1.1, 0.14, 0.12, RED, { rough: bonnet.rough }); pod.cut = cutRecord(pod.h, ring(0.12, 1)).cut; pod.cutRound = 1; out.push(pod);
      const lamp = lamps[s < 0 ? 0 : 1]!; set(lamp, 3.325, s * 0.68, 0.88, 1.08, 0.006, 0.1); lamp.cut = cutRecord(lamp.h, ring(0.1, 1)).cut;
    } }

  // ---- what is round all the way: the wheels and their hubs, a tank under the bed on each side ----
  for (const w of wheels) { w!.cut = cutRecord(w!.h, ring(0.48, 3)).cut; w!.cutRound = 3; delete w!.marks; }
  for (const lx of [2.2, -1.2, -2.25]) for (const s of [-1, 1]) {
    const hub = box(lx, s * 1.134, 0.28, 0.68, 0.2, 0.004, of(GALV, 0.6), { rough: 0.45, metal: true, flags: BoxFlag.NoShadow }); hub.cut = cutRecord(hub.h, ring(0.2, 3)).cut; out.push(hub);
  }
  for (const s of [-1, 1]) { const tank = box(0.1, s * 0.82, 0.25, 0.69, 0.5, 0.22, of(GALV, 0.6), { rough: 0.45, metal: true }); tank.cut = cutRecord(tank.h, ring(0.22, 1)).cut; tank.cutRound = 1; out.push(tank); }

  for (const b of out) B.push(b);
  return out.length;
}
