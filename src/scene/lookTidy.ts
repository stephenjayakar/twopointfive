// A DECAL THE LOOK LAID ON A WALL'S FACE GOES WITH ITS WALL — picture only (scene/look.ts; tools/levels/gwotSkin.ts lays them: a painted dado, the damp foot
// of an outside wall). When a wall is holed (game/wallbreak.ts: the authored box is hidden — NoPrimary | NoShadow — and its standing pieces are drawn in its
// place) nothing takes the decal off it: no ray or query ever returned a decal, so the destruction never knew it was there, and a painted sheet would hang
// across the hole. `lookTidy(world)` hides each such decal while its wall is hidden and puts it back with it (a restart restores the wall: the decal follows).
// Called by the PAGE once a frame (main.ts); it reads and writes the flags of drawn-only boxes and nothing else — the game cannot tell it ran.
import { BoxFlag, type Box } from './boxes';
import { GWOT_PALETTE, gwotSimOf } from './gwotPalette';
import type { Vec3 } from '../math/vec';
import { hashStr } from '../math/dice';

interface Tidy { pairs: [decal: number, walls: number[]][]; flags0: number[]; serial: number; wet: WetRow[] }
interface WetRow { d: number; g: number; flags0: number; rough0: number | undefined; aniso0: boolean | undefined; on: boolean }
const tidies = new WeakMap<object, Tidy | null>();
const HIDE = BoxFlag.NoPrimary | BoxFlag.NoShadow;
const DECAL_MASK = HIDE | BoxFlag.Glass | BoxFlag.Dynamic;

/** the wall decals of a level and the wall(s) each lies on: a thin upright NoShadow sheet standing on the floor, flat against a BROAD face of a solid box (never
 *  the end face of a wall that meets its plane at a corner); a hand-laid sheet may run along several wall boxes. And the ground decals with the ground each lies on. */
function find(statics: Box[]): Tidy | null {
  if (!statics.some(b => gwotSimOf(b.albedo) !== undefined)) return null;   // (a level that wears none of the look's paints is left exactly as it is: the office's own painted lines and notices are not the look's)
  const pairs: [number, number[]][] = [], flags0: number[] = [];
  const walls: number[] = []; statics.forEach((b, i) => { if (!(b.flags & DECAL_MASK) && !b.yaw && b.c[1] - b.h[1] <= 0.1 && b.c[1] + b.h[1] >= 0.85 && Math.min(b.h[0], b.h[2]) <= 0.3) walls.push(i); });
  statics.forEach((d, i) => {
    if ((d.flags & DECAL_MASK) !== BoxFlag.NoShadow || d.yaw || d.c[1] - d.h[1] > 0.06 || d.h[1] < 0.1 || Math.min(d.h[0], d.h[2]) > 0.006) return;
    const ax = d.h[0] <= d.h[2] ? 0 : 2, al = 2 - ax;   // ax: the sheet's thin axis = the wall's normal; al: along the wall
    const on = walls.filter(w => { const b = statics[w]; return b.h[ax] <= b.h[al] && Math.abs(Math.abs(d.c[ax] - b.c[ax]) - b.h[ax]) <= 0.02 && Math.min(d.c[al] + d.h[al], b.c[al] + b.h[al]) - Math.max(d.c[al] - d.h[al], b.c[al] - b.h[al]) >= 0.2; });
    if (on.length) { pairs.push([i, on]); flags0.push(d.flags); }
  });
  // ground decals: a flat NoShadow sheet at the floor, and the topmost solid flat under its centre
  const wet: WetRow[] = [];
  const grounds: number[] = []; statics.forEach((b, i) => { if (!(b.flags & DECAL_MASK) && !b.yaw && b.c[1] + b.h[1] <= 0.06 && b.h[0] > 0.4 && b.h[2] > 0.4) grounds.push(i); });
  statics.forEach((d, i) => {
    if ((d.flags & DECAL_MASK) !== BoxFlag.NoShadow || d.h[1] > 0.02 || d.c[1] + d.h[1] > 0.03 || d.c[1] - d.h[1] < 0) return;
    let g = -1, top = -1e9; for (const k of grounds) { const b = statics[k]; if (Math.abs(b.c[0] - d.c[0]) <= b.h[0] && Math.abs(b.c[2] - d.c[2]) <= b.h[2] && b.c[1] + b.h[1] > top) { top = b.c[1] + b.h[1]; g = k; } }
    if (g >= 0) wet.push({ d: i, g, flags0: d.flags, rough0: d.rough, aniso0: d.aniso, on: false });
  });
  return pairs.length || wet.length ? { pairs, flags0, serial: -1, wet } : null;
}
/** WET GROUND TAKES ITS WEAR WITH IT — picture only. The storm wets the ground in place (game/weather.ts setWet: the lot's slab at half its tone and glossy; under
 *  a picked rain every open slab, through the render-only Box.wetK) and knows nothing of what the look laid on it: door wear, a wall's trodden strip and the
 *  dice's patches would stay dry and matte — paler than the wet ground they are meant to be darker than. Each ground decal follows the ground under it: wet
 *  with it (the same render-only factor and finish), dry with it. `albedo` is never written, so anything that reads paint reads what it always read. */
function wetIs(b: Box): boolean { return b.wetK !== undefined || (!!(b.flags & BoxFlag.Gloss) && b.aniso === true && b.c[1] < 0); }   // (the lot's slab soaked in place: weather.ts sets Gloss + a stretched lobe on it and takes both off again)
function wetTidy(statics: Box[], T: Tidy): void {
  for (const r of T.wet) { const d = statics[r.d], g = statics[r.g]; if (!d || !g) continue; const on = wetIs(g); if (on === r.on) continue; r.on = on;
    if (on) { d.wetK = g.wetK ?? 0.5; d.flags = r.flags0 | BoxFlag.Gloss; d.rough = g.rough; d.aniso = true; }
    else { delete d.wetK; d.flags = r.flags0; if (r.rough0 === undefined) delete d.rough; else d.rough = r.rough0; if (r.aniso0 === undefined) delete d.aniso; else d.aniso = r.aniso0; } }
}
/** once a frame, from the page: cheap while nothing has broken (one compare of the world's geometry serial) and nothing has got wet or dried (one test a
 *  ground decal). A wall's decals go and come back WHOLE with the wall's box — a hole in one cell bares that wall's foot along its length, and the frame the
 *  wall breaks on still shows the sheet (the page tidies before it steps). */
export function lookTidy(world: { statics: Box[]; geomSerial: number }): void {
  let T = tidies.get(world.statics); if (T === undefined) { T = find(world.statics); tidies.set(world.statics, T); }
  if (!T) return;
  wetTidy(world.statics, T);
  if (T.serial === world.geomSerial) return;
  let changed = false;
  T.pairs.forEach(([d, ws], k) => { const box = world.statics[d]; if (!box) return; const want = ws.some(w => world.statics[w] && world.statics[w].flags & BoxFlag.NoPrimary) ? T!.flags0[k] | BoxFlag.NoPrimary : T!.flags0[k]; if (box.flags !== want) { box.flags = want; changed = true; } });
  if (changed) world.geomSerial++;
  T.serial = world.geomSerial;
}

// DOOR LEAVES IN THE LOOK — picture only, as above. A leaf is built in the office's colours whatever the level (game/doors.ts: a veneer inside, the fire
// exits' blue-grey outside), and on a mud compound those read as office doors. `lookDoors` repaints the leaves of a level that WEARS the look, once, after the
// game is stood up: an outside door in the level's own accent paint (its row in look.ts LOOK_DOORS, else the one its dado is painted in — counted off the
// level's boxes; army green where it has none), an inside one in weathered grey wood (one in four with that paint faded on it), each a shade of its own by its name. Steel doors are left alone. Nothing in the game asks what colour a leaf is
// (a round into one is wood whatever its paint — particleFx.ts; the chips take the colour), no dice are drawn, and a level that carries none of the look's
// paints — the office under the switch — is not touched.

const ACCENTS = ['paintBlue', 'paintGreen', 'paintRust'] as const;
const near = (a: Vec3, b: Vec3): boolean => Math.abs(a[0] - b[0]) < 0.004 && Math.abs(a[1] - b[1]) < 0.004 && Math.abs(a[2] - b[2]) < 0.004;   // (a paint or one of its stand-ins: gwotAs shifts by ≤ 0.0024)
/** the page calls it once the game stands, with the switch on (main.ts); returns how many leaves it painted */
export function lookDoors(doors: readonly { def: { name: string; exterior?: boolean; steel?: boolean }; box: Box }[], statics: readonly Box[], paint?: { out: readonly [number, number, number]; in?: readonly [number, number, number] }): number {
  const count = [0, 0, 0]; let wears = false;
  for (const b of statics) { if (gwotSimOf(b.albedo) === undefined) continue; wears = true; ACCENTS.forEach((a, i) => { if (near(b.albedo, GWOT_PALETTE[a])) count[i]++; }); }
  if (!wears) return 0;
  const top = Math.max(...count), accent: Vec3 = paint ? [paint.out[0], paint.out[1], paint.out[2]] : GWOT_PALETTE[top > 0 ? ACCENTS[count.indexOf(top)] : 'paintGreen'];   // (a level with a row in look.ts LOOK_DOORS wears that row; else the paint counted off its boxes)
  let n = 0;
  const wood: Vec3 = paint?.in ? [paint.in[0], paint.in[1], paint.in[2]] : GWOT_PALETTE.woodGrey, faded: Vec3 = [accent[0] * 0.7 + wood[0] * 0.3, accent[1] * 0.7 + wood[1] * 0.3, accent[2] * 0.7 + wood[2] * 0.3];
  for (const d of doors) { if (d.def.steel) continue;
    const h = hashStr(d.def.name), k = 0.9 + (h % 1000) / 1000 * 0.2, a = d.def.exterior ? accent : (h >>> 10) % 4 === 0 ? faded : wood;   // (one inside door in four keeps some old paint)
    d.box.albedo = [a[0] * k, a[1] * k, a[2] * k]; n++; }
  return n;
}
