// A GEOMETRY TRIAL (the look page only: main.ts, with ?look; ?geo=0 leaves it out — off on every other page, and nothing here keeps state).
// What else can a box-only level be made of? The answer tried here is the CUT BOX (scene/cut.ts): a box clipped by up to eight planes, which the raster, every GPU
// ray and every CPU ray already meet as one solid. Two things are rebuilt from the level's own boxes, after it loads and before the world is filled:
//   ROUND THINGS. The kit (scene/gwotKit.ts round) stands a drum, a tyre, a stove up as four slabs 45° apart: an octagon of four boxes. Here the first slab becomes
//     a regular TWELVE-sided prism (the box's four faces + eight planes: the record's whole room), marked ROUND (Box.cutRound) so the picture shades its sides with
//     one turning normal; the other three are left in the list (a level file's box indices are names) as specks no pass and no ray meets.
//   A BROKEN WALL TOP. A yard wall (a long thin box with a coping slab along its top) loses a bite out of its top: the wall is split at the bite, and the gap is
//     three boxes whose tops are cut on a slant, each at its own height, so the line is ragged and the shadow it throws is too. The coping stops at the break, the
//     snow lying on it is cut back, and the faces of the break show the wall's core. No bite goes lower than a standing man's eyes.
// What pushes against a box still meets the UNCUT box: a man slides round the prism's square, a hand's width out from the round at its four corners.
import { BoxFlag, type Box } from './boxes';
import { cutPlane, cutRecord, fitCutBox } from './cut';
import { MARKING_TEXEL, MAX_MARKS_PER_BOX, mkHash, texelOf, type MarkingDef, type MarkFace } from './markings';
import type { Vec3 } from '../math/vec';

const h01 = (s: number, a: number, b = 0) => mkHash(s, a, b) / 4294967296;
/** take a box out of the picture and out of every ray's way without moving the list (a level file's box indices are names) */
function hide(b: Box, at: Vec3) { b.flags |= BoxFlag.NoPrimary | BoxFlag.NoShadow; b.c = [at[0], at[1], at[2]]; b.h = [0.01, 0.01, 0.01]; delete b.marks; }
const near = (a: number, b: number, e = 1e-4) => Math.abs(a - b) < e;
const TAN8 = Math.tan(Math.PI / 8);
/** the kit's octagon: boxes[i‥i+3] are four slabs through one centre, 45° apart, tan 22.5° as deep as they are long, their tops stepped 2 mm */
function octagonAt(B: readonly Box[], i: number): boolean {
  const a = B[i];
  if (i + 3 >= B.length || a.rot || a.cut || a.flags !== 0 || !near(a.h[2], a.h[0] * TAN8, a.h[0] * 0.01)) return false;
  for (let k = 1; k < 4; k++) {
    const b = B[i + k];
    if (b.rot || b.cut || b.flags !== 0 || !near(b.c[0], a.c[0]) || !near(b.c[2], a.c[2]) || !near(b.h[0], a.h[0]) || !near(b.h[2], a.h[2])) return false;
    if (!near(b.yaw - a.yaw, k * Math.PI / 4, 1e-3) || !near(b.c[1] - b.h[1], a.c[1] - a.h[1], 1e-3) || !near(b.c[1] + b.h[1], a.c[1] + a.h[1] - 0.002 * k, 1e-3)) return false;
    if (b.albedo[0] !== a.albedo[0] || b.albedo[1] !== a.albedo[1] || b.albedo[2] !== a.albedo[2]) return false;
  }
  return true;
}
/** a round patch on a lid (a tyre's hole, an oven's mouth): the slab's own +y mark was cut to the slab, so it is drawn again as a disc of radius R */
function discMark(like: MarkingDef, R: number, texel: number): MarkingDef {
  const t = texelOf(like, texel), N = Math.min(32, 2 * Math.ceil(R / t) + 2), cells: string[] = [];
  for (let j = N - 1; j >= 0; j--) { let row = ''; for (let i = 0; i < N; i++) row += Math.hypot(i + 0.5 - N / 2, j + 0.5 - N / 2) * t < R ? 'a' : '.'; cells.push(row); }
  return { face: '+y', ...(like.res ? { res: like.res } : {}), at: [-N / 2, -N / 2], size: [N, N], pal: [like.pal[0]], cells };
}
const SIDES: readonly MarkFace[] = ['+x', '-x', '+z', '-z'];
/** every octagon of the level → one round prism. Returns how many were made. */
export function roundStacks(boxes: Box[], texel = MARKING_TEXEL): number {
  let made = 0;
  for (let i = 0; i + 3 < boxes.length; i++) {
    if (!octagonAt(boxes, i)) continue;
    const a = boxes[i], r = a.h[0] / 0.96, ap = r * 0.985;   // (the kit's slab is 0.96 r long; a twelve-sided prism of this apothem has the round's area to a percent)
    const all = [0, 1, 2, 3].flatMap(k => boxes[i + k].marks ?? []);
    const band = all.find(m => m.face === '+z' || m.face === '-z');   // a slab's long face carries the whole band (a drum's ribs); its short ends carry a cut of it
    const lid = (a.marks ?? []).find(m => m.face === '+y');
    const marks: MarkingDef[] = [];
    if (lid && lid.pal.length === 1) marks.push(discMark(lid, r * 0.5, texel));   // (a lid of two paints is a drum's: its rim is the shader's, its bung is let go)
    if (band) for (const f of SIDES) if (marks.length < MAX_MARKS_PER_BOX) marks.push({ ...band, face: f });
    a.h = [ap, a.h[1], ap];
    const planes = [30, 60, 120, 150, 210, 240, 300, 330].map(d => cutPlane([Math.cos(d * Math.PI / 180), 0, Math.sin(d * Math.PI / 180)], ap));
    a.cut = cutRecord(a.h, planes).cut; a.cutRound = 2;
    if (marks.length) a.marks = marks; else delete a.marks;
    for (let k = 1; k < 4; k++) hide(boxes[i + k], a.c);
    made++; i += 3;
  }
  return made;
}

/** every yard wall (a plain upright box 3.4 m or longer and under 0.4 m thick, standing on the ground, with a coping slab of its own length on its top) gets ONE
 *  bite out of its top, where nothing tall stands against it and no lamp hangs. Pieces are appended to `boxes`; nothing is removed. Returns how many walls were broken. */
export function breakWallTops(boxes: Box[], lights: readonly { pos: Vec3 }[] = []): number {
  const n0 = boxes.length; let made = 0;
  for (let wi = 0; wi < n0; wi++) {
    const w = boxes[wi];
    if (w.rot || w.cut || w.marks || w.flags !== 0 || w.yaw !== 0) continue;
    const A = w.h[0] >= w.h[2] ? 0 : 2, X = 2 - A, L = w.h[A], T = w.h[X], H = w.c[1] + w.h[1];
    if (L < 1.7 || T > 0.2 || T < 0.06 || !near(w.c[1], w.h[1], 0.02) || H < 2.1 || H > 3.2) continue;
    const ci = boxes.findIndex((b, i) => i < n0 && i !== wi && !b.rot && !b.cut && !b.marks && b.flags === 0 && b.yaw === 0 && near(b.c[A], w.c[A], 1e-3) && near(b.c[X], w.c[X], 1e-3)
      && near(b.h[A], L, 1e-3) && b.h[X] >= T && b.h[X] < T + 0.08 && near(b.c[1] - b.h[1], H, 0.01) && b.h[1] < 0.08);
    if (ci < 0) continue;
    const cp = boxes[ci], seed = mkHash(Math.round(w.c[0] * 100), Math.round(w.c[2] * 100), 7);
    const W = Math.min(1.3 + 0.8 * h01(seed, 1), L * 0.9), D = Math.min(0.4, H - 2.0);   // the bite: its length along the wall and how far down it goes (never to the 2 m line a sound is carried over, nor near a standing eye)
    // where: three places tried along the wall, the first with nothing tall against it (a pier, a post, a lean-to, a lamp)
    let s0 = NaN;
    for (let k = 0; k < 3 && isNaN(s0); k++) {
      const f = 0.18 + 0.64 * ((h01(seed, 2) + k * 0.37) % 1), a = w.c[A] - L + f * (2 * L - W), b = a + W;
      const hit = boxes.some((o, i) => i < n0 && i !== wi && i !== ci && !(o.flags & (BoxFlag.NoShadow | BoxFlag.NoPrimary)) && o.c[1] + o.h[1] > 1.6
        && Math.abs(o.c[A] - (a + b) / 2) < W / 2 + 0.15 + Math.max(o.h[0], o.h[2]) && Math.abs(o.c[X] - w.c[X]) < T + 0.4 + Math.max(o.h[0], o.h[2]));
      const lamp = lights.some(l => Math.abs(l.pos[A] - (a + b) / 2) < W / 2 + 0.3 && Math.abs(l.pos[X] - w.c[X]) < T + 0.6 && l.pos[1] > 1.6 && l.pos[1] < H + 1);
      if (!hit && !lamp) s0 = a;
    }
    if (isNaN(s0)) continue;
    const s1 = s0 + W, u0 = w.c[A] - L, u1 = w.c[A] + L, flip = h01(seed, 3) < 0.5, core = cp.albedo;
    const span = (b: Box, a: number, z: number): Box => { const c: Vec3 = [b.c[0], b.c[1], b.c[2]], h: Vec3 = [b.h[0], b.h[1], b.h[2]]; c[A] = (a + z) / 2; h[A] = (z - a) / 2; return { ...b, c, h }; };
    // the wall and its coping, either side of the bite (the first stretch keeps the box's place in the list)
    boxes.push(span(w, s1, u1), span(cp, s1, u1));
    Object.assign(w, span(w, u0, s0)); Object.assign(cp, span(cp, u0, s0));
    // the bite: three stretches, each a box of the wall's section whose top is one slanted plane — from height ya at ta to yb at tb (t = 0‥1 along the bite),
    // leaning `tz` across the wall. Each starts a step off where its neighbour ended: that is the ragged line
    const at = (t: number) => flip ? s1 - t * W : s0 + t * W;
    const piece = (ta: number, tb: number, ya: number, yb: number, tz: number) => {
      const ua = at(ta), ub = at(tb), c: Vec3 = [w.c[0], H / 2, w.c[2]], h: Vec3 = [T, H / 2, T]; c[A] = (ua + ub) / 2; h[A] = Math.abs(ub - ua) / 2;
      const n: Vec3 = [0, 1, 0]; n[A] = -(yb - ya) / (ub - ua); n[X] = tz;                    // the top: y = ya + (yb − ya)(u − ua) / (ub − ua) − tz · across
      const b: Box = { ...w, c, h, cut: [cutPlane(n, n[A] * (ua - c[A]) + (ya - c[1]))], cutCore: [core[0], core[1], core[2]], cutOld: true };
      if (fitCutBox(b)) boxes.push(b);
    };
    piece(0, 0.42, H - 0.03, H - 0.8 * D, 0.35);
    piece(0.42, 0.62, H - D, H - 0.85 * D, -0.5);
    piece(0.62, 1, H - 0.55 * D, H - 0.08 * D, 0.25);
    // the snow lying on the coping (the level's own cap boxes) is cut back to the break
    for (let i = 0; i < n0; i++) {
      const o = boxes[i];
      if (!(o.flags & BoxFlag.NoShadow) || (o.flags & BoxFlag.NoPrimary) || o.yaw !== 0 || Math.abs(o.c[X] - w.c[X]) > T || o.c[1] - o.h[1] < H - 0.01 || o.c[1] - o.h[1] > H + 0.2) continue;
      const a = o.c[A] - o.h[A], b = o.c[A] + o.h[A]; if (b < s0 - 0.04 || a > s1 + 0.04) continue;
      const left = s0 - 0.04 - a, right = b - (s1 + 0.04), keepL = left >= 0.15, keepR = right >= 0.15;   // what is left of it on either side (a stub is let go)
      if (keepL && keepR) boxes.push(span(o, s1 + 0.04, b));
      if (keepL) Object.assign(o, span(o, a, s0 - 0.04)); else if (keepR) Object.assign(o, span(o, s1 + 0.04, b)); else hide(o, [w.c[0], H / 2, w.c[2]]);
    }
    // what fell: a few lumps at the wall's foot, half sunk in what lies there. Picture only (no shadow, so nothing pushes against them and no ray stops)
    for (let k = 0; k < 5; k++) {
      const side = h01(seed, 10, k) < 0.6 ? 1 : -1, hx = 0.05 + 0.07 * h01(seed, 11, k), hy = 0.03 + 0.04 * h01(seed, 12, k), hz = 0.04 + 0.05 * h01(seed, 13, k);
      const c: Vec3 = [w.c[0], hy * 0.5, w.c[2]]; c[A] = s0 + W * (0.1 + 0.8 * h01(seed, 14, k)); c[X] += side * (T + 0.1 + 0.4 * h01(seed, 15, k));
      const b: Box = { ...w, c, h: [hx, hy, hz], yaw: h01(seed, 16, k) * Math.PI, flags: BoxFlag.NoShadow,
        cut: [cutPlane([h01(seed, 17, k) - 0.5, 1, h01(seed, 18, k) - 0.5], hy * 0.35), cutPlane([1, 0.3, h01(seed, 19, k) - 0.5], hx * 0.6)], cutCore: [core[0], core[1], core[2]], cutOld: true };
      if (fitCutBox(b)) boxes.push(b);
    }
    made++;
  }
  return made;
}

/** the whole trial on a loaded level, before its boxes go to the world: { round things made, walls broken } */
export function geoTryLevel(level: { boxes: Box[]; lights?: readonly { pos: Vec3 }[]; markTexel?: number }): { rounds: number; walls: number } {
  return { rounds: roundStacks(level.boxes, level.markTexel ?? MARKING_TEXEL), walls: breakWallTops(level.boxes, level.lights) };
}
