// THE LEVEL KIT — the office's building blocks (walls, glass, door frames + leaves, furniture, loose props, lamps, the breaker) as plain functions over a `LevelKit`
// context, for the generators under tools/levels that are not built on officeGen.ts officeKit (mousehole, defuse, floodlit,
// records): a generator makes a kit (newKit), calls the pieces, and hands the kit's lists to a Level (kitLevel). Doors are sized by scene/doorSize.ts and a prop's
// footprint is fitted by levelLoad.ts fitPropFootprint, as officeKit's are; officeGen.ts does not import this file. Units: metres. +X east, +Z south, +Y up. Floor top y = 0.
import { Vec3 } from '../math/vec';
import { Box, BoxFlag, makeBox } from './boxes';
import { WORLD } from './world';
import type { Level, LightDef, LevelDoorDef, PropKind, PropPart, PropDef } from './level';
import { MarkingDef, MARKING_TEXEL } from './markings';
import * as MD from './markingDefaults';
import { fitOpenings, fitDoorDef, fitSlot, JAMB_FACE, DOOR_HEAD, DOOR_GAP, LEAF_W, LEAF_H } from './doorSize';
import { fitPropFootprint } from './levelLoad';
export { DOOR_GAP, LEAF_W };

/** the ceiling's underside (walls run floor to here) */
export const KIT_H = WORLD.ceilingY;

/** the office's paint, by name (officeGen.ts C, value for value — a generator's file writes these as its `materials`) */
export const KIT_PALETTE = {
  carpet: [0.13, 0.14, 0.17] as Vec3, carpetBlue: [0.09, 0.11, 0.2] as Vec3, carpetRed: [0.22, 0.07, 0.07] as Vec3,
  lino: [0.33, 0.33, 0.31] as Vec3, stone: [0.38, 0.37, 0.35] as Vec3, asphalt: [0.09, 0.09, 0.1] as Vec3, grass: [0.1, 0.16, 0.08] as Vec3,
  wall: [0.66, 0.64, 0.6] as Vec3, wallDark: [0.36, 0.38, 0.4] as Vec3, concrete: [0.42, 0.41, 0.4] as Vec3, ceiling: [0.72, 0.72, 0.7] as Vec3,
  partRed: [0.5, 0.13, 0.1] as Vec3, partBlue: [0.13, 0.17, 0.42] as Vec3, partTan: [0.55, 0.47, 0.35] as Vec3,
  wood: [0.52, 0.4, 0.27] as Vec3, woodDark: [0.25, 0.18, 0.12] as Vec3, metal: [0.3, 0.31, 0.33] as Vec3, black: [0.04, 0.04, 0.045] as Vec3,
  chair: [0.14, 0.2, 0.45] as Vec3, cardboard: [0.58, 0.44, 0.26] as Vec3, white: [0.8, 0.8, 0.78] as Vec3, plant: [0.12, 0.3, 0.1] as Vec3,
  glassFrame: [0.2, 0.22, 0.25] as Vec3, screenOff: [0.02, 0.02, 0.025] as Vec3, red: [0.55, 0.08, 0.06] as Vec3,
  glass: [0.8, 0.87, 0.83] as Vec3, glassExt: [0.7, 0.75, 0.79] as Vec3,   // a pane's albedo is its transmission tint: clear float inside, a faint solar coat on exterior glazing
};
const C = KIT_PALETTE;
/** the finish of each paint (officeGen.ts OFFICE_FINISH, value for value): GGX roughness and bare metal; absent = matte */
export const KIT_FINISH: Readonly<Record<string, { rough: number; metal?: boolean }>> = {
  stone: { rough: 0.15 }, lino: { rough: 0.22 },
  glass: { rough: 0.03 }, glassExt: { rough: 0.03 },
  metal: { rough: 0.28, metal: true }, glassFrame: { rough: 0.4, metal: true },
  screenOff: { rough: 0.08 }, white: { rough: 0.5 },
  wood: { rough: 0.55 }, woodDark: { rough: 0.6 },
  wall: { rough: 0.85 }, wallDark: { rough: 0.85 }, concrete: { rough: 0.9 }, ceiling: { rough: 0.9 },
  carpet: { rough: 0.95 }, carpetBlue: { rough: 0.95 }, carpetRed: { rough: 0.95 },
  asphalt: { rough: 0.92 },
  black: { rough: 0.6 }, cardboard: { rough: 0.9 }, chair: { rough: 0.9 }, plant: { rough: 0.9 }, grass: { rough: 1.0 },
  partRed: { rough: 0.9 }, partBlue: { rough: 0.9 }, partTan: { rough: 0.9 }, red: { rough: 0.45 },
};
const FINISH_BY_ALBEDO = new Map<string, { rough: number; metal?: boolean }>();
{ const seen = new Set<string>(); for (const [name, alb] of Object.entries(C)) { const k = alb.join(','); if (seen.has(k)) continue; seen.add(k); const f = KIT_FINISH[name]; if (f) FINISH_BY_ALBEDO.set(k, f); } }   // first palette name per albedo, as levelToData's matByAlbedo
export interface KitOpts { /** the objects carry their pixel-art markings (keyboards, cartons, cabinets, papers, racks); default on */ markings?: boolean; /** the base texel the bitmaps are generated for */ texel?: number; }
/** What a generator accumulates: the Level's lists in add() order (box indices held by switchables / fixtures / beacons / the breaker all come from this one
 *  sequence), + the editor group of every box (`groups[i]` ≡ `boxes[i]`, for the level file). */
export interface LevelKit {
  boxes: Box[]; groups: string[]; props: PropDef[]; lights: LightDef[]; switchables: Level['switchables']; beacons: Level['beacons']; doors: LevelDoorDef[];
  section: string; marks: boolean; texel: number; paperSeed: number;
}
export function newKit(opts: KitOpts = {}): LevelKit {
  return { boxes: [], groups: [], props: [], lights: [], switchables: [], beacons: [], doors: [], section: 'level', marks: opts.markings ?? true, texel: opts.texel ?? MARKING_TEXEL, paperSeed: 0 };
}
/** start an editor group: every box added from here on is recorded under it (no effect on the level) */
export function grp(k: LevelKit, name: string): void { k.section = name; }
/** a box's markings, if the kit's markings are on (spread into an add() / a prop part) */
const mk = (k: LevelKit, ms: MarkingDef[]): { marks?: MarkingDef[] } => k.marks && ms.length ? { marks: ms } : {};

/** one box; the palette's finish is stamped on by colour unless the call names its own rough / metal. Returns its index. */
export function add(k: LevelKit, b: Partial<Box> & { c: Vec3; h: Vec3 }): number {
  const box = makeBox(b);
  if (b.rough === undefined && b.metal === undefined) { const f = FINISH_BY_ALBEDO.get(box.albedo.join(',')); if (f) { box.rough = f.rough; if (f.metal) box.metal = true; } }
  k.boxes.push(box); k.groups.push(k.section); return k.boxes.length - 1;
}
/** axis-aligned box from min/max corners */
export function slab(k: LevelKit, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, albedo: Vec3, extra: Partial<Box> = {}): number {
  return add(k, { c: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], h: [Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2], albedo, ...extra });
}

// ---- walls, openings, glass ----
/** A hole in a wall, `a`‥`b` along it: a doorway (y0 0, y1 2.2 — the defaults) or a window (y0 0.9, y1 2.4, say). glass: 'bay' = one pane per mullion bay,
 *  'whole' = one pane across the opening (the mullions stand through it); tint = the pane's albedo (default the exterior glazing's). */
export type Opening = { a: number; b: number; y0?: number; y1?: number; mullions?: number; glass?: 'bay' | 'whole'; tint?: Vec3 };
/** exterior / interior wall thickness (a doorway's width and its leaf's: doorSize.ts DOOR_GAP, LEAF_W) · the door SLOT the levels are drawn with: the walls
 *  cut the real doorway inside it and `door` hangs the real leaf there (doorSize.ts) */
export const WALL_EXT = 0.24, WALL_INT = 0.12, DOOR_SLOT = 1.2;
const PANE_HALF_T = 0.006;
/** a 12 mm pane flagged Glass in the centre plane of a wall along X (fixed z): sight passes it, rounds / feet / sound do not */
export const paneX = (k: LevelKit, z: number, x0: number, x1: number, y0: number, y1: number, tint: Vec3 = C.glassExt) => add(k, { c: [(x0 + x1) / 2, (y0 + y1) / 2, z], h: [(x1 - x0) / 2, (y1 - y0) / 2, PANE_HALF_T], albedo: tint, flags: BoxFlag.Glass });
/** …in a wall along Z (fixed x) */
export const paneZ = (k: LevelKit, x: number, z0: number, z1: number, y0: number, y1: number, tint: Vec3 = C.glassExt) => add(k, { c: [x, (y0 + y1) / 2, (z0 + z1) / 2], h: [PANE_HALF_T, (y1 - y0) / 2, (z1 - z0) / 2], albedo: tint, flags: BoxFlag.Glass });
const glaze = (o: Opening, pane: (u0: number, u1: number) => void) => {
  if (!o.glass) return;
  const n = o.glass === 'bay' && o.mullions ? o.mullions : 1;
  for (let i = 0; i < n; i++) pane(o.a + (o.b - o.a) * i / n, o.a + (o.b - o.a) * (i + 1) / n);
};
/** Wall running along X at fixed z (thickness t) from x0 to x1, with openings. */
export function wallX(k: LevelKit, z: number, x0: number, x1: number, t: number, albedo: Vec3, openings: Opening[] = [], extra: Partial<Box> = {}, height = KIT_H): void {
  const ops = fitOpenings(openings, x0, x1); let cur = x0;
  for (const o of ops) {
    if (o.a > cur) slab(k, cur, 0, z - t / 2, o.a, height, z + t / 2, albedo, extra);
    const y0 = o.y0 ?? 0, y1 = o.y1 ?? 2.2;
    if (y0 > 0) slab(k, o.a, 0, z - t / 2, o.b, y0, z + t / 2, albedo, extra);
    if (y1 < height) slab(k, o.a, y1, z - t / 2, o.b, height, z + t / 2, albedo, extra);
    if (o.mullions) { const n = o.mullions; for (let i = 1; i < n; i++) { const mx = o.a + (o.b - o.a) * i / n; slab(k, mx - 0.04, y0, z - t * 0.4, mx + 0.04, y1, z + t * 0.4, C.glassFrame, extra); } }
    glaze(o, (u0, u1) => paneX(k, z, u0, u1, y0, Math.min(y1, height), o.tint ?? C.glassExt));
    cur = o.b;
  }
  if (cur < x1) slab(k, cur, 0, z - t / 2, x1, height, z + t / 2, albedo, extra);
}
/** Wall running along Z at fixed x. */
export function wallZ(k: LevelKit, x: number, z0: number, z1: number, t: number, albedo: Vec3, openings: Opening[] = [], extra: Partial<Box> = {}, height = KIT_H): void {
  const ops = fitOpenings(openings, z0, z1); let cur = z0;
  for (const o of ops) {
    if (o.a > cur) slab(k, x - t / 2, 0, cur, x + t / 2, height, o.a, albedo, extra);
    const y0 = o.y0 ?? 0, y1 = o.y1 ?? 2.2;
    if (y0 > 0) slab(k, x - t / 2, 0, o.a, x + t / 2, y0, o.b, albedo, extra);
    if (y1 < height) slab(k, x - t / 2, y1, o.a, x + t / 2, height, o.b, albedo, extra);
    if (o.mullions) { const n = o.mullions; for (let i = 1; i < n; i++) { const mz = o.a + (o.b - o.a) * i / n; slab(k, x - t * 0.4, y0, mz - 0.04, x + t * 0.4, y1, mz + 0.04, C.glassFrame, extra); } }
    glaze(o, (u0, u1) => paneZ(k, x, u0, u1, y0, Math.min(y1, height), o.tint ?? C.glassExt));
    cur = o.b;
  }
  if (cur < z1) slab(k, x - t / 2, 0, cur, x + t / 2, height, z1, albedo, extra);
}

// ---- doors ----
/** A hinged leaf + its frame (two jambs, the head, the two stops that close the hinge / latch sight slots) for a doorway gap already cut in a wall.
 *  `hinge` = [x, z] of the hinge line: for a wall along X (closedDir 0, the leaf runs +X) it is [gapStart + 0.02, wallZ]; for a wall along Z (closedDir π/2,
 *  the leaf runs +Z) it is [wallX, gapStart + 0.02] — `doorAt` below does that arithmetic. exterior = the frame spans the 0.24 m wall. */
export function door(k: LevelKit, d: LevelDoorDef): LevelDoorDef {
  fitDoorDef(d);   // (doorSize.ts: a leaf drawn for a 1.2 m slot becomes the real door inside it — the same doorway wallX / wallZ cut for that slot)
  k.doors.push(d);
  const was = k.section; grp(k, 'doorframe.' + d.name);
  const t = d.exterior ? WALL_EXT : WALL_INT; const gap = d.width + 2 * JAMB_FACE; const alongX = Math.abs(Math.sin(d.closedDir)) < 0.5;
  const fwd = (alongX ? Math.cos(d.closedDir) : Math.sin(d.closedDir)) > 0, hl = alongX ? d.hinge[0] : d.hinge[1];
  const a = fwd ? hl - JAMB_FACE : hl + JAMB_FACE - gap; const w = alongX ? d.hinge[1] : d.hinge[0];   // gap start along the wall, wall line coordinate
  const frameCol: Vec3 = d.exterior ? [0.2, 0.21, 0.23] : [0.3, 0.24, 0.17]; const hy = DOOR_HEAD / 2;
  const jamb = (u: number) => alongX ? add(k, { c: [u, hy, w], h: [0.03, hy, t / 2 + 0.012], albedo: frameCol }) : add(k, { c: [w, hy, u], h: [t / 2 + 0.012, hy, 0.03], albedo: frameCol });
  jamb(a - 0.01); jamb(a + gap + 0.01);
  const hb = LEAF_H + 0.005, hc = (hb + DOOR_HEAD + 0.065) / 2, hh = (DOOR_HEAD + 0.065 - hb) / 2;   // the HEAD comes down past the top of the shut leaf (the leaf stands 1 cm off the floor: its top is LEAF_H + 0.01) — no slot over a shut door for light to pass through
  if (alongX) add(k, { c: [a + gap / 2, hc, w], h: [gap / 2 + 0.04, hh, t / 2 + 0.012], albedo: frameCol }); else add(k, { c: [w, hc, a + gap / 2], h: [t / 2 + 0.012, hh, gap / 2 + 0.04], albedo: frameCol });
  const sg = fwd ? 1 : -1;
  const stop = (u0: number, u1: number) => { const m = sg * (u0 + u1) / 2, hu = (u1 - u0) / 2; return alongX ? add(k, { c: [d.hinge[0] + m, hy, w], h: [hu, hy, 0.02], albedo: frameCol }) : add(k, { c: [w, hy, d.hinge[1] + m], h: [0.02, hy, hu], albedo: frameCol }); };   // (u along the closed leaf from the hinge line)
  stop(-0.012, 0.024); stop(d.width - 0.004, d.width + 0.012);
  grp(k, was);
  return d;
}
/** The standard leaf in a door SLOT (1.2 m, the way the levels are drawn) that starts at `a` along a wall: axis 'x' = the wall runs along X at z = `line`,
 *  'z' = along Z at x = `line`. Returns the Opening to hand wallX / wallZ for the same doorway — the real one inside the slot (doorSize.ts) — so the hole and
 *  the leaf cannot disagree. */
export function doorAt(k: LevelKit, name: string, axis: 'x' | 'z', line: number, a: number, extra: Partial<LevelDoorDef> = {}): Opening {
  const [s, e] = fitSlot(a, a + DOOR_SLOT);
  door(k, { name, hinge: axis === 'x' ? [s + JAMB_FACE, line] : [line, s + JAMB_FACE], closedDir: axis === 'x' ? 0 : Math.PI / 2, width: LEAF_W, ...extra });
  return { a: s, b: e, y1: DOOR_HEAD };
}

// ---- floors, ceiling ----
/** a floor finish: a thin slab 4 mm proud of the base (below every shadow-ray origin, so its edge never draws a hairline shadow) */
export const floorFinish = (k: LevelKit, x0: number, z0: number, x1: number, z1: number, albedo: Vec3, extra: Partial<Box> = {}) => slab(k, x0, 0, z0, x1, 0.004, z1, albedo, extra);
/** the hard finishes are polished (lino, stone): spread into floorFinish's `extra` */
export const POLISHED: Partial<Box> = { flags: BoxFlag.Gloss };
/** the ceiling over a footprint: light-only (NoPrimary — the top-down camera looks through it) */
export const ceiling = (k: LevelKit, x0: number, z0: number, x1: number, z1: number) => slab(k, x0, KIT_H, z0, x1, KIT_H + 0.2, z1, C.ceiling, { flags: BoxFlag.NoPrimary });
/** a rug / mat: a decal (no rays, no footstep material) */
export const rug = (k: LevelKit, x: number, z: number, w: number, d: number, albedo: Vec3, yaw = 0) => add(k, { c: [x, 0.018, z], h: [w / 2, 0.006, d / 2], yaw, albedo, flags: BoxFlag.NoShadow });

// ---- fixed furniture ----
/** Local→world frame of a yawed piece at (x, z): local +X → world (cos yaw, −sin yaw), local +Z → (sin yaw, cos yaw). */
export const frameAt = (x: number, z: number, yaw: number) => { const cs = Math.cos(yaw), sn = Math.sin(yaw); return (lx: number, ly: number, lz: number): Vec3 => [x + cs * lx + sn * lz, ly, z - sn * lx + cs * lz]; };
/** a desk: top (0.76 m), two side panels, a modesty panel on local −Z (the sitter is on +Z) */
export function desk(k: LevelKit, x: number, z: number, w: number, d: number, yaw = 0, albedo: Vec3 = C.wood): void {
  const at = frameAt(x, z, yaw);
  add(k, { c: at(0, 0.735, 0), h: [w / 2, 0.025, d / 2], yaw, albedo });
  add(k, { c: at(-w / 2 + 0.03, 0.36, 0), h: [0.025, 0.36, d / 2 - 0.02], yaw, albedo });
  add(k, { c: at(w / 2 - 0.03, 0.36, 0), h: [0.025, 0.36, d / 2 - 0.02], yaw, albedo });
  add(k, { c: at(0, 0.45, -d / 2 + 0.03), h: [w / 2 - 0.05, 0.25, 0.012], yaw, albedo });
}
/** a monitor (screen faces local +Z) on a surface at `baseY` (a desk 0.76) + its keyboard; `on` = a lit screen, a switchable in group 'monitors'. Returns the screen's box. */
export function monitor(k: LevelKit, x: number, z: number, yaw: number, on: boolean, baseY = 0.76, keyboard = true): number {
  const at = frameAt(x, z, yaw);
  add(k, { c: at(0, baseY + 0.03, 0), h: [0.1, 0.03, 0.08], yaw, albedo: C.black });
  add(k, { c: at(0, baseY + 0.17, 0), h: [0.02, 0.12, 0.02], yaw, albedo: C.black });
  add(k, { c: at(0, baseY + 0.32, 0), h: [0.27, 0.17, 0.02], yaw, albedo: C.black });
  const scr = add(k, { c: at(0, baseY + 0.32, 0.022), h: [0.25, 0.15, 0.004], yaw, albedo: C.screenOff, emissive: on ? [0.9, 1.3, 2.2] : [0, 0, 0], ...mk(k, MD.monitorMarks([0.25, 0.15, 0.004], on, k.texel)) });
  if (on) k.switchables.push({ name: `monitor${k.switchables.length}`, boxes: [scr], group: 'monitors', on: true, baseEmissive: [0.9, 1.3, 2.2] });
  if (keyboard) add(k, { c: at(0, baseY + 0.01, 0.28), h: [0.2, 0.012, 0.07], yaw, albedo: [0.08, 0.08, 0.09], ...mk(k, MD.keyboardMarks([0.2, 0.012, 0.07], k.texel)) });
  return scr;
}
/** a filing cabinet (0.46 × 1.32 × 0.6), drawer fronts on local −Z */
export function cabinet(k: LevelKit, x: number, z: number, yaw: number): number {
  return add(k, { c: [x, 0.66, z], h: [0.23, 0.66, 0.3], yaw, albedo: [0.58, 0.58, 0.56], ...mk(k, MD.cabinetMarks([0.23, 0.66, 0.3], k.texel)) });
}
/** two sheets of paper on a surface at height y */
export function papers(k: LevelKit, x: number, y: number, z: number, yaw = 0, scribble = false): void {
  add(k, { c: [x, y + 0.02, z], h: [0.11, 0.02, 0.15], yaw, albedo: [0.86, 0.86, 0.82], flags: BoxFlag.NoShadow, ...mk(k, MD.paperMarks([0.11, 0.02, 0.15], 31 + k.paperSeed, false, k.texel)) });
  add(k, { c: [x + 0.03, y + 0.05, z - 0.02], h: [0.1, 0.012, 0.14], yaw: yaw + 0.25, albedo: [0.9, 0.88, 0.8], flags: BoxFlag.NoShadow, ...mk(k, MD.paperMarks([0.1, 0.012, 0.14], 32 + k.paperSeed, scribble, k.texel)) });
  k.paperSeed += 2;
}
/** a flat panel on a wall (a canvas, a noticeboard, a whiteboard): alongX = it hangs on a wall running along X */
export const wallArt = (k: LevelKit, x: number, y: number, z: number, w: number, h: number, albedo: Vec3, alongX: boolean, marks: MarkingDef[] = []) =>
  add(k, { c: [x, y, z], h: alongX ? [w / 2, h / 2, 0.015] : [0.015, h / 2, w / 2], albedo, flags: BoxFlag.NoShadow, ...mk(k, marks) });
/** a slatted bench 1.4 m long (its length along local X) */
export function bench(k: LevelKit, x: number, z: number, yaw: number): void {
  const at = frameAt(x, z, yaw);
  add(k, { c: [x, 0.42, z], h: [0.7, 0.03, 0.2], yaw, albedo: C.woodDark });
  for (const sx of [-0.6, 0.6]) add(k, { c: at(sx, 0.2, 0), h: [0.03, 0.2, 0.18], yaw, albedo: C.metal });
}
/** a parked car, 4.4 × 1.7 m, local +X forward */
export function car(k: LevelKit, x: number, z: number, yaw: number, body: Vec3): void {
  const at = frameAt(x, z, yaw);
  add(k, { c: [x, 0.62, z], h: [2.2, 0.34, 0.86], yaw, albedo: body });
  add(k, { c: at(-0.25, 1.2, 0), h: [1.25, 0.27, 0.8], yaw, albedo: [0.07, 0.08, 0.1] });
  add(k, { c: at(-0.25, 1.49, 0), h: [1.15, 0.03, 0.76], yaw, albedo: body });
  for (const [lx, lz] of [[1.35, 0.8], [1.35, -0.8], [-1.4, 0.8], [-1.4, -0.8]]) add(k, { c: at(lx, 0.3, lz), h: [0.32, 0.3, 0.12], yaw, albedo: [0.04, 0.04, 0.045] });
  for (const lz of [0.62, -0.62]) { add(k, { c: at(2.2, 0.7, lz), h: [0.02, 0.07, 0.14], yaw, albedo: [0.8, 0.8, 0.75], flags: BoxFlag.NoShadow }); add(k, { c: at(-2.2, 0.75, lz), h: [0.02, 0.06, 0.16], yaw, albedo: [0.3, 0.02, 0.02], emissive: [0.5, 0.03, 0.02], flags: BoxFlag.NoShadow }); }
}
/** open steel shelving w × d, `levels` shelves up to `hgt`, cartons on most of them (see-through between the cartons: it is NOT a wall to eyes or rounds) */
export function shelf(k: LevelKit, x: number, z: number, w: number, d: number, yaw: number, levels = 4, hgt = 2.0): void {
  const at = frameAt(x, z, yaw);
  add(k, { c: at(-w / 2 + 0.02, hgt / 2, 0), h: [0.02, hgt / 2, d / 2], yaw, albedo: C.metal });
  add(k, { c: at(w / 2 - 0.02, hgt / 2, 0), h: [0.02, hgt / 2, d / 2], yaw, albedo: C.metal });
  for (let i = 0; i < levels; i++) {
    const y = 0.15 + (hgt - 0.2) * i / (levels - 1); add(k, { c: at(0, y, 0), h: [w / 2, 0.015, d / 2], yaw, albedo: C.metal });
    if (i < levels - 1 && ((i * 7 + Math.floor(x * 3)) % 3 !== 0)) add(k, { c: at((i % 2 ? -0.15 : 0.12) * w, y + 0.17, 0), h: [w * 0.22, 0.15, d * 0.4], yaw, albedo: C.cardboard, ...mk(k, MD.shelfCartonMarks([w * 0.22, 0.15, d * 0.4], k.texel)) });
  }
}
/** a low sofa (the manager's office's): seat 1.8 × 0.9 with the back along local −Z */
export function sofa(k: LevelKit, x: number, z: number, yaw: number, albedo: Vec3 = [0.22, 0.2, 0.19]): void {
  const at = frameAt(x, z, yaw);
  add(k, { c: at(0, 0.3, 0), h: [0.9, 0.3, 0.45], yaw, albedo }); add(k, { c: at(0, 0.62, -0.45), h: [0.9, 0.32, 0.12], yaw, albedo });
}
/** a server rack (0.66 × 2.1 × 1.0, LED face on +Z at z + 0.5): the body with its LED markings + the unseen glow strip that lights the floor in front of it.
 *  `index` names its switchables `rack<index>_leds` / `rack<index>_glow` (what Level.mission.rack.index refers to); on the UPS, not the mains. Returns the
 *  marker point on its LED face at chest height (Level.mission.rack.front). */
export function rack(k: LevelKit, x: number, z: number, index: number, flicker = false): Vec3 {
  const slots: { u: number; y: number; amber: boolean }[] = [];
  for (let u = 0; u < 10; u++) { if (((u * 7 + index * 3) % 5) > 1) continue; slots.push({ u, y: 0.32 + u * 0.178, amber: (u + index) % 7 === 3 }); }
  const body = add(k, { c: [x, 1.05, z], h: [0.33, 1.05, 0.5], albedo: [0.06, 0.06, 0.07], rough: 0.3, ...mk(k, MD.rackMarks([0.33, 1.05, 0.5], slots.map(sl => ({ v: sl.y - 1.05, amber: sl.amber })), k.texel)) });
  let lo = 10, hi = -10; for (const sl of slots) { lo = Math.min(lo, sl.y); hi = Math.max(hi, sl.y); }
  if (slots.length) {
    k.switchables.push({ name: `rack${index}_leds`, boxes: [body], group: 'server_leds', on: true, baseEmissive: [0, 0, 0], flicker, mains: false });
    const strip = add(k, { c: [x - 0.222, (lo + hi) / 2, z + 0.506], h: [0.03, (hi - lo) / 2 + 0.06, 0.003], albedo: C.black, emissive: [0.2, 1.9, 0.45], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
    k.switchables.push({ name: `rack${index}_glow`, boxes: [strip], group: 'server_glow', on: true, baseEmissive: [0.2, 1.9, 0.45], flicker, mains: false });
  }
  return [x, 1.1, z + 0.53];
}

// ---- loose props (the physics layer owns them: never in `boxes`) ----
const fitProp = (p: PropDef) => {   // the footprint (bounding rectangle of the parts in the prop frame) and height; the origin re-centred on that rectangle
  const fit = fitPropFootprint(p.parts); const mx = fit.mid[0], mz = fit.mid[1];
  if (Math.abs(mx) > 1e-6 || Math.abs(mz) > 1e-6) { const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw); p.x += cs * mx + sn * mz; p.z += -sn * mx + cs * mz; for (const q of p.parts) q.off = [q.off[0] - mx, q.off[1], q.off[2] - mz]; }
  p.half = fit.half; p.height = fit.height;
};
export function prop(k: LevelKit, kind: PropKind, x: number, z: number, yaw: number, mass: number, parts: PropPart[], half?: [number, number]): PropDef {
  const p: PropDef = { kind, name: `${kind}${k.props.length}`, x, z, yaw, parts, half: [0, 0], height: 0, mass };
  fitProp(p); if (half) p.half = half; k.props.push(p); return p;
}
/** an office chair on casters; the sitter faces local −Z (the back is on +Z) */
export function chair(k: LevelKit, x: number, z: number, yaw: number, albedo: Vec3 = C.chair): void {
  prop(k, 'chair', x, z, yaw, 12, [
    { off: [0, 0.46, 0], h: [0.24, 0.04, 0.24], yaw: 0, albedo }, { off: [0, 0.8, 0.22], h: [0.23, 0.3, 0.035], yaw: 0, albedo },
    { off: [0, 0.22, 0], h: [0.04, 0.22, 0.04], yaw: 0, albedo: C.black }, { off: [0, 0.03, 0], h: [0.25, 0.03, 0.05], yaw: 0, albedo: C.black }, { off: [0, 0.03, 0], h: [0.05, 0.03, 0.25], yaw: 0, albedo: C.black },
  ]);
}
/** a carton of side s on the floor — or, with y > 0, on top of an earlier floor carton it stands over (joins that prop so the stack moves as one) */
export function cardboardBox(k: LevelKit, x: number, z: number, s: number, yaw: number, y = 0): void {
  if (y > 0) {
    for (let i = k.props.length - 1; i >= 0; i--) {
      const p = k.props[i]; if (p.kind !== 'cardboard') continue;
      const cs = Math.cos(p.yaw), sn = Math.sin(p.yaw), dx = x - p.x, dz = z - p.z; const lx = cs * dx - sn * dz, lz = sn * dx + cs * dz;
      if (Math.abs(lx) > p.half[0] || Math.abs(lz) > p.half[1]) continue;
      p.parts.push({ off: [lx, y + s / 2, lz], h: [s / 2, s / 2, s / 2], yaw: yaw - p.yaw, albedo: C.cardboard, ...mk(k, MD.cartonMarks([s / 2, s / 2, s / 2], k.texel)) }); p.mass += 1 + 22 * s ** 3; fitProp(p); return;
    }
  }
  prop(k, 'cardboard', x, z, yaw, 1 + 22 * s ** 3, [{ off: [0, y + s / 2, 0], h: [s / 2, s / 2, s / 2], yaw: 0, albedo: C.cardboard, ...mk(k, MD.cartonMarks([s / 2, s / 2, s / 2], k.texel)) }]);
}
/** a potted plant (scale s) */
export function plant(k: LevelKit, x: number, z: number, s = 1): void {
  prop(k, 'plant', x, z, 0, 14 * s ** 3, [
    { off: [0, 0.22 * s, 0], h: [0.2 * s, 0.22 * s, 0.2 * s], yaw: 0, albedo: [0.36, 0.3, 0.26] },
    { off: [0, 0.7 * s, 0], h: [0.26 * s, 0.28 * s, 0.26 * s], yaw: 0.6, albedo: C.plant },
    { off: [0.04 * s, 1.08 * s, -0.03 * s], h: [0.19 * s, 0.18 * s, 0.19 * s], yaw: 0.2, albedo: [C.plant[0] * 1.15, C.plant[1] * 1.15, C.plant[2] * 1.1] },
  ], [0.26 * s, 0.26 * s]);
}
export const bin = (k: LevelKit, x: number, z: number) => prop(k, 'bin', x, z, 0.3, 2.5, [{ off: [0, 0.2, 0], h: [0.13, 0.2, 0.13], yaw: 0, albedo: [0.12, 0.12, 0.13] }]);

// ---- light ----
/** a recessed ceiling panel (an emissive box the engine turns into an area light), a switchable in `group`, on the mains. Returns its box. */
export function ceilingPanel(k: LevelKit, x: number, z: number, on: boolean, group: string, flicker = false, w = 1.2, d = 0.6, radiance: Vec3 = [11, 10.5, 9.5]): number {
  const bi = add(k, { c: [x, KIT_H - 0.02, z], h: [w / 2, 0.02, d / 2], albedo: C.white, emissive: on ? radiance : [0, 0, 0], flags: BoxFlag.NoPrimary });
  k.switchables.push({ name: `panel_${group}_${k.switchables.length}`, boxes: [bi], group, on, baseEmissive: radiance, flicker });
  return bi;
}
/** a desk lamp standing on a surface at `baseY` (a desk: 0.76), its warm spot thrown along `aim` (XZ direction, any length) — about an eighth of a torch */
export function deskLamp(k: LevelKit, x: number, z: number, aim: [number, number], name: string, group: string, baseY = 0.76, on = true): void {
  const l = Math.hypot(aim[0], aim[1]) || 1, ax = aim[0] / l, az = aim[1] / l;
  add(k, { c: [x, baseY + 0.02, z], h: [0.08, 0.02, 0.08], albedo: C.black }); add(k, { c: [x, baseY + 0.22, z], h: [0.015, 0.2, 0.015], albedo: C.black });
  const head = add(k, { c: [x + ax * 0.11, baseY + 0.44, z + az * 0.11], h: [0.07, 0.05, 0.07], albedo: C.black, emissive: [0, 0, 0] });
  k.lights.push({ kind: 'spot', pos: [x + ax * 0.14, baseY + 0.4, z + az * 0.14], dir: [ax * 0.4, -0.9, az * 0.4], color: [1.0, 0.75, 0.45], intensity: 9, range: 6, innerDeg: 30, outerDeg: 62, name, group, enabled: on, volumetric: 0.25, fixtureBox: head, radius: 0.06 });
}
/** a bare bulb hanging on its flex (a warm point light, on the mains) */
export function bulb(k: LevelKit, x: number, z: number, name: string, group: string, on = true, intensity = 28): void {
  add(k, { c: [x, 2.7, z], h: [0.005, 0.3, 0.005], albedo: C.black, flags: BoxFlag.NoShadow });
  const b = add(k, { c: [x, 2.36, z], h: [0.04, 0.05, 0.04], albedo: C.white, emissive: on ? [30, 22, 12] : [0, 0, 0], flags: BoxFlag.NoShadow });
  k.lights.push({ kind: 'point', pos: [x, 2.33, z], dir: [0, -1, 0], color: [1.0, 0.7, 0.42], intensity, range: 7, innerDeg: 0, outerDeg: 180, name, group, enabled: on, volumetric: 0.25, fixtureBox: b, radius: 0.06 });
}
/** a sodium street lamp: a 5.2 m pole at (x, z), its head out along `dir` (a unit XZ direction as a Vec3); street supply, not the building's breaker */
export function streetLamp(k: LevelKit, x: number, z: number, name: string, dir: Vec3, on = true): void {
  const yawL = Math.atan2(dir[0], dir[2]);
  add(k, { c: [x, 2.6, z], h: [0.06, 2.6, 0.06], albedo: C.metal });
  add(k, { c: [x + dir[0] * 0.28, 5.24, z + dir[2] * 0.28], h: [0.04, 0.04, 0.32], yaw: yawL, albedo: C.metal });
  add(k, { c: [x + dir[0] * 0.55, 5.22, z + dir[2] * 0.55], h: [0.17, 0.05, 0.27], yaw: yawL, albedo: [0.16, 0.17, 0.18] });
  const head = add(k, { c: [x + dir[0] * 0.55, 5.15, z + dir[2] * 0.55], h: [0.13, 0.025, 0.22], yaw: yawL, albedo: C.metal, emissive: on ? [40, 24, 7] : [0, 0, 0], flags: BoxFlag.NoShadow });
  k.lights.push({ kind: 'spot', pos: [x + dir[0] * 0.55, 5.05, z + dir[2] * 0.55], dir: [dir[0] * 0.35, -1, dir[2] * 0.35], color: [1.0, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, name, group: 'exterior', enabled: on, volumetric: 0.12, fixtureBox: head, radius: 0.18, mains: false, broad: true });
}
/** the moon: cool, dim, low from the south-west (the office's) — long window shadows; name 'moon', group 'exterior' */
export function moon(k: LevelKit, dir: Vec3 = [0.45, -0.5, -0.74], intensity = 0.9): void {
  k.lights.push({ kind: 'dir', pos: [0, 0, 0], dir: normalize3(dir), color: [0.55, 0.7, 1.0], intensity, range: 1e6, innerDeg: 0, outerDeg: 0, name: 'moon', group: 'exterior', enabled: true, volumetric: 0, radius: 0.009, mains: false });
}
/** an emergency beacon under the ceiling (dark until a blackout; battery-backed) */
export function beacon(k: LevelKit, x: number, z: number): void {
  add(k, { c: [x, KIT_H - 0.06, z], h: [0.07, 0.06, 0.07], albedo: [0.2, 0.2, 0.22], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  const dome = add(k, { c: [x, KIT_H - 0.19, z], h: [0.055, 0.07, 0.055], albedo: [0.35, 0.08, 0.05], flags: BoxFlag.NoShadow | BoxFlag.NoPrimary });
  k.switchables.push({ name: `beacon${k.beacons.length}`, boxes: [dome], group: 'emergency', on: false, baseEmissive: [9, 1.2, 0.35], mains: false });
  k.beacons.push({ pos: [x, KIT_H - 0.3, z], box: dome });
}
/** a green exit sign on a wall at (x, z), 2.45 m up: alongX = on a wall running along X; battery-backed, its own switchable `name` in `group` */
export function exitSign(k: LevelKit, x: number, z: number, alongX: boolean, name: string, group: string): number {
  const b = add(k, { c: [x, 2.45, z], h: alongX ? [0.3, 0.12, 0.02] : [0.02, 0.12, 0.3], albedo: C.white, emissive: [0.3, 3.2, 0.6] });
  k.switchables.push({ name, boxes: [b], group, on: true, baseEmissive: [0.3, 3.2, 0.6], mains: false });
  return b;
}
/** The mains breaker panel on a wall: `pos` = the panel's centre ON the wall face, `out` = the unit XZ normal off that face into the room. Returns
 *  Level.breaker (the interaction point a hand's width off the panel + its two boxes). */
export function breakerPanel(k: LevelKit, pos: Vec3, out: [number, number]): Level['breaker'] {
  const alongX = Math.abs(out[1]) > 0.5;   // the wall runs along X when its normal is ±Z
  const at = (o: number, s: number, y: number): Vec3 => alongX ? [pos[0] + s, y, pos[2] + out[1] * o] : [pos[0] + out[0] * o, y, pos[2] + s];
  const hx = (w: number, t: number): [number, number] => alongX ? [w, t] : [t, w];
  const [pw, pt] = hx(0.28, 0.04); const brk = add(k, { c: at(0.04, 0, pos[1]), h: [pw, 0.36, pt], albedo: [0.42, 0.44, 0.45], name: 'breaker_panel' });
  const [lw, lt] = hx(0.015, 0.01); const led = add(k, { c: at(0.09, -0.18, pos[1] + 0.27), h: [lw, 0.015, lt], albedo: C.black, emissive: [0.3, 4, 0.6], flags: BoxFlag.NoShadow });
  add(k, { c: at(0.04, 0, pos[1] + 0.95), h: [0.03, 0.6, 0.03], albedo: [0.3, 0.3, 0.32], flags: BoxFlag.NoShadow });   // conduit up to the ceiling
  return { pos: at(0.14, 0, pos[1]), boxes: [brk, led] };
}

function normalize3(v: Vec3): Vec3 { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; }

/** The kit's lists as a Level, with the fields only the generator knows. Posts, clear plans and devices default to none (the lists a loaded level always
 *  carries, so the file reloads to this Level key for key); a level nobody patrols passes `routes: []`. */
export function kitLevel(k: LevelKit, rest: Omit<Level, 'boxes' | 'props' | 'lights' | 'switchables' | 'doors' | 'beacons'>): Level {
  return { boxes: k.boxes, props: k.props, lights: k.lights, switchables: k.switchables, doors: k.doors, beacons: k.beacons, chokepoints: [], clearPlans: [], devices: [], ...rest };
}
