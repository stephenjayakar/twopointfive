// Small geometry helpers the editor's tools share (pure): box corners / faces in world space, point tests, snapping, yaw frames, and the two
// ports from the legacy generator the format note asked for — 'frame this door' (jambs, head, stops: officeGen.ts's frame loop verbatim in
// its numbers) and 'cut an opening' (split the wall slabs a doorway crosses into left / right / lintel pieces, as wallX / wallZ laid them).
import type { Vec3 } from '../math/vec';
import type { BoxData, DoorData, LevelData } from '../scene/levelData';

export const snapTo = (v: number, step: number) => step > 0 ? Math.round(v / step) * step : v;
export const snapVec = (p: Vec3, step: number, y = false): Vec3 => [snapTo(p[0], step), y ? snapTo(p[1], step) : p[1], snapTo(p[2], step)];
export const round6 = (v: number) => +v.toFixed(6);
export const roundVec = (p: readonly number[]): Vec3 => [round6(p[0]), round6(p[1]), round6(p[2])];

/** box local axes in world XZ for a yaw (the renderer's convention: local +X → (cos, 0, −sin), local +Z → (sin, 0, cos)) */
export function yawAxes(yaw: number): { ax: Vec3; az: Vec3 } { const cs = Math.cos(yaw), sn = Math.sin(yaw); return { ax: [cs, 0, -sn], az: [sn, 0, cs] }; }
/** the 8 world-space corners of a yawed box (c, h, yaw) — bit 0 = +x, bit 1 = +y, bit 2 = +z */
export function boxCorners(c: Vec3, h: Vec3, yaw = 0): Vec3[] {
  const { ax, az } = yawAxes(yaw); const out: Vec3[] = [];
  for (let k = 0; k < 8; k++) { const sx = k & 1 ? 1 : -1, sy = k & 2 ? 1 : -1, sz = k & 4 ? 1 : -1; out.push([c[0] + ax[0] * h[0] * sx + az[0] * h[2] * sz, c[1] + h[1] * sy, c[2] + ax[2] * h[0] * sx + az[2] * h[2] * sz]); }
  return out;
}
export const BOX_EDGES: [number, number][] = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
export type Face = 0 | 1 | 2 | 3 | 4 | 5;   // +x −x +y −y +z −z (box local)
export const FACE_NAMES = ['+x', '−x', '+y', '−y', '+z', '−z'];
/** world-space centre of a face and its outward normal */
export function faceCentre(c: Vec3, h: Vec3, yaw: number, f: Face): { p: Vec3; n: Vec3 } {
  const { ax, az } = yawAxes(yaw); const a = f >> 1; const s = f & 1 ? -1 : 1;
  const n: Vec3 = a === 0 ? [ax[0] * s, 0, ax[2] * s] : a === 1 ? [0, s, 0] : [az[0] * s, 0, az[2] * s];
  return { p: [c[0] + n[0] * h[a], c[1] + n[1] * h[a], c[2] + n[2] * h[a]], n };
}
/** move ONE face of a box by `delta` metres along its outward normal (the opposite face stays put): new c / h, h clamped ≥ minHalf */
export function pushFace(c: Vec3, h: Vec3, yaw: number, f: Face, delta: number, minHalf = 0.005): { c: Vec3; h: Vec3 } {
  const a = f >> 1; const { n } = faceCentre(c, h, yaw, f);
  const nh = Math.max(minHalf, h[a] + delta / 2); const d = nh - h[a];   // actual half-extent change after the clamp
  const h2: Vec3 = [h[0], h[1], h[2]]; h2[a] = nh;
  return { c: [c[0] + n[0] * d, c[1] + n[1] * d, c[2] + n[2] * d], h: h2 };
}

// ---------------------------------------------------------------- doors: frame + opening (ported from officeGen.ts)
/** The frame the generator built round every leaf: two jambs and a head slightly proud of the wall, and the two stops in the leaf's plane that close
 *  the knuckle slot and the latch seam (numbers verbatim from officeGen.ts). Wall thickness t: 0.12 interior / 0.24 exterior unless given. Returns
 *  BoxData WITHOUT ids (the caller names them) in group `doorframe.<door id>`. */
export function doorFrameBoxes(d: DoorData, opts: { t?: number; floor?: string; albedo?: Vec3 } = {}): Omit<BoxData, 'id'>[] {
  const t = opts.t ?? (d.exterior ? 0.24 : 0.12); const gap = d.width + 0.04; const alongX = Math.abs(Math.sin(d.closedDir)) < 0.5;
  const sgn = alongX ? Math.sign(Math.cos(d.closedDir)) || 1 : Math.sign(Math.sin(d.closedDir)) || 1;   // (the generator's doors all run +x / +z; a leaf authored the other way runs its gap backwards from the hinge)
  const hu = alongX ? d.hinge[0] : d.hinge[1]; const w = alongX ? d.hinge[1] : d.hinge[0];               // along-wall coordinate of the hinge, wall line coordinate
  const a = sgn > 0 ? hu - 0.02 : hu - gap + 0.02;                                                          // gap start along the wall (lower coordinate)
  const albedo: Vec3 = opts.albedo ?? (d.exterior ? [0.2, 0.21, 0.23] : [0.3, 0.24, 0.17]);
  const group = `doorframe.${d.id}`; const floor = opts.floor;
  const out: Omit<BoxData, 'id'>[] = [];
  const mk = (c: Vec3, h: Vec3) => out.push({ ...(floor ? { floor } : {}), group, c: roundVec(c), h: roundVec(h), albedo: [...albedo] as Vec3 });
  const jamb = (u: number) => alongX ? mk([u, 1.1, w], [0.03, 1.1, t / 2 + 0.012]) : mk([w, 1.1, u], [t / 2 + 0.012, 1.1, 0.03]);
  jamb(a - 0.01); jamb(a + gap + 0.01);
  if (alongX) mk([a + gap / 2, 2.23, w], [gap / 2 + 0.04, 0.035, t / 2 + 0.012]); else mk([w, 2.23, a + gap / 2], [t / 2 + 0.012, 0.035, gap / 2 + 0.04]);
  const stop = (u0: number, u1: number) => { const m = (u0 + u1) / 2 * sgn, hw = (u1 - u0) / 2; if (alongX) mk([d.hinge[0] + m, 1.1, w], [hw, 1.1, 0.02]); else mk([w, 1.1, d.hinge[1] + m], [0.02, 1.1, hw]); };   // (u along the closed leaf from the hinge line)
  stop(-0.012, 0.024); stop(d.width - 0.004, d.width + 0.012);
  return out;
}

/** Cut the doorway `d` needs through whatever axis-aligned wall slabs cross its gap: each such box is replaced by up to three (the run either side of
 *  the gap, and the lintel from y1 = 2.2 up to the slab's top — what wallX / wallZ emit for an opening { a, b } with y0 0, y1 2.2). Returns the plan:
 *  boxes to remove (ids) and boxes to add (no ids). Yawed / tilted boxes and boxes that do not span the gap's height band are left alone. */
export function cutOpeningPlan(data: LevelData, d: DoorData, opts: { y1?: number } = {}): { remove: string[]; add: Omit<BoxData, 'id'>[] } {
  const y1 = opts.y1 ?? 2.2; const gap = d.width + 0.04; const alongX = Math.abs(Math.sin(d.closedDir)) < 0.5;
  const sgn = alongX ? Math.sign(Math.cos(d.closedDir)) || 1 : Math.sign(Math.sin(d.closedDir)) || 1;
  const hu = alongX ? d.hinge[0] : d.hinge[1]; const w = alongX ? d.hinge[1] : d.hinge[0];
  const a = sgn > 0 ? hu - 0.02 : hu - gap + 0.02, b = a + gap;
  const remove: string[] = []; const add: Omit<BoxData, 'id'>[] = [];
  for (const bx of data.boxes) {
    if (bx.rot || Math.abs(Math.sin(bx.yaw ?? 0)) > 1e-6 || (bx.flags ?? []).includes('NoShadow')) continue;
    const lo = bx.c[1] - bx.h[1], hi = bx.c[1] + bx.h[1]; if (lo > 0.3 || hi < 1.8) continue;   // must cover the doorway's height band
    const U = alongX ? 0 : 2, Wa = alongX ? 2 : 0;
    if (Math.abs(bx.c[Wa] - w) > bx.h[Wa] + 0.02) continue;                                    // on the wall line
    const u0 = bx.c[U] - bx.h[U], u1 = bx.c[U] + bx.h[U]; if (u1 <= a + 1e-6 || u0 >= b - 1e-6) continue;   // crosses the gap
    remove.push(bx.id);
    const base: Omit<BoxData, 'id' | 'c' | 'h'> = { ...(bx.floor ? { floor: bx.floor } : {}), ...(bx.group ? { group: bx.group } : {}), ...(bx.name ? { name: bx.name } : {}), ...(bx.material !== undefined ? { material: bx.material } : { albedo: [...bx.albedo!] as Vec3 }), ...(bx.emissive ? { emissive: [...bx.emissive] as Vec3 } : {}), ...(bx.flags?.length ? { flags: [...bx.flags] } : {}) };
    const piece = (p0: number, p1: number, q0: number, q1: number) => {   // along-wall span p0..p1, height q0..q1, wall-line extent as the original
      if (p1 - p0 < 1e-4 || q1 - q0 < 1e-4) return;
      const c: Vec3 = [0, (q0 + q1) / 2, 0], h: Vec3 = [0, (q1 - q0) / 2, 0];
      c[U] = (p0 + p1) / 2; h[U] = (p1 - p0) / 2; c[Wa] = bx.c[Wa]; h[Wa] = bx.h[Wa];
      add.push({ ...base, c: roundVec(c), h: roundVec(h) });
    };
    piece(u0, Math.max(u0, a), lo, hi); piece(Math.min(u1, b), u1, lo, hi);   // the runs either side
    if (hi > y1 + 1e-4) piece(Math.max(u0, a), Math.min(u1, b), Math.max(lo, y1), hi);   // the lintel over the gap
  }
  return { remove, add };
}

// ---------------------------------------------------------------- presets
export interface BoxPreset { key: string; label: string; title: string;
  /** full height (m) and, for wall-like presets, the fixed thickness (m); `y0` = bottom (default 0); `top` = place hanging from the ceiling */
  height: number; thick?: number; y0?: number; fromCeiling?: number; material?: string; albedo?: Vec3; emissive?: Vec3; flags?: BoxData['flags'];
  /** default footprint (full size x, z) when placed with a click rather than a drag */
  size: [number, number];
  /** create a switchable owning the new box (ceiling panels, screens) */
  switchable?: { group: string; on: boolean };
}
export const BOX_PRESETS: BoxPreset[] = [
  { key: 'wall', label: 'wall', title: 'interior partition: 3.0 m tall (to the ceiling), 12 cm thick, along the longer side of the drag', height: 3.0, thick: 0.12, material: 'wall', size: [2, 0.12] },
  { key: 'wall.ext', label: 'ext. wall', title: 'exterior wall: 3.0 m × 24 cm concrete', height: 3.0, thick: 0.24, material: 'concrete', size: [2, 0.24] },
  { key: 'lowwall', label: 'low wall', title: 'cubicle partition / low wall: 1.4 m tall, 8 cm thick', height: 1.4, thick: 0.08, material: 'partTan', size: [2, 0.08] },
  { key: 'block', label: 'block', title: 'a plain block the size of the drag, 1.1 m tall (counter, planter, low cabinet)', height: 1.1, material: 'woodDark', size: [1, 0.6] },
  { key: 'desk', label: 'desk', title: 'desk-height block 0.75 m (a real desk is four boxes: top + sides + modesty panel — duplicate and resize)', height: 0.75, material: 'wood', size: [1.6, 0.8] },
  { key: 'crate', label: 'crate', title: '0.9 m crate / cabinet block', height: 0.9, material: 'cardboard', size: [0.9, 0.9] },
  { key: 'tall', label: 'cabinet', title: 'tall cabinet / rack / vending machine block, 2.0 m', height: 2.0, albedo: [0.3, 0.31, 0.33], size: [0.7, 0.6] },
  { key: 'pillar', label: 'pillar', title: 'floor-to-ceiling pillar 0.3 × 0.3', height: 3.0, material: 'concrete', size: [0.3, 0.3] },
  { key: 'floor', label: 'floor finish', title: 'floor finish decal: 4 mm proud of the base slab (lino / stone are Gloss = polished under the glossy-floor experiment)', height: 0.004, material: 'lino', flags: ['Gloss'], size: [4, 4] },
  { key: 'rug', label: 'rug', title: 'rug / mat: a 6 mm decal at 18 mm, invisible to rays (NoShadow)', height: 0.012, y0: 0.012, albedo: [0.24, 0.22, 0.2], flags: ['NoShadow'], size: [2, 1.4] },
  { key: 'slab', label: 'ceiling slab', title: 'ceiling / roof slab piece: 20 cm at ceiling height, hidden from the camera (NoPrimary), lights the rooms below by bounce', height: 0.2, y0: 3.0, material: 'ceiling', flags: ['NoPrimary'], size: [4, 4] },
  { key: 'panel', label: 'ceiling panel', title: 'emissive ceiling panel 1.2 × 0.6 hung 2 cm under the ceiling (NoPrimary) + a switchable in group <room> — it becomes an analytic area light in the game', height: 0.04, fromCeiling: 0.0, material: 'white', emissive: [11, 10.5, 9.5], flags: ['NoPrimary'], size: [1.2, 0.6], switchable: { group: 'ceiling', on: true } },
  { key: 'screen', label: 'screen', title: 'a lit screen / sign card 4 mm thick at 1.5 m (switchable, group monitors)', height: 0.3, y0: 1.35, thick: 0.008, material: 'screenOff', emissive: [0.9, 1.3, 2.2], size: [0.5, 0.008], switchable: { group: 'monitors', on: true } },
  { key: 'glow', label: 'glow strip', title: 'thin emissive strip invisible to the camera (NoPrimary + NoShadow): a light SOURCE without a visible fixture, like the rack LED glow strips', height: 0.6, y0: 0.4, thick: 0.006, albedo: [0.04, 0.04, 0.045], emissive: [0.2, 1.9, 0.45], flags: ['NoShadow', 'NoPrimary'], size: [0.06, 0.006], switchable: { group: 'glow', on: true } },
];
export interface LightPreset { key: string; label: string; title: string; def: { kind: 'point' | 'spot'; color: Vec3; intensity: number; range: number; innerDeg: number; outerDeg: number; volumetric: number; radius?: number; broad?: boolean }; height: number }
export const LIGHT_PRESETS: LightPreset[] = [
  { key: 'bulb', label: 'bulb', title: 'bare warm bulb (point, like the storage room\'s): 2.6 m up', def: { kind: 'point', color: [1, 0.85, 0.65], intensity: 10, range: 8, innerDeg: 0, outerDeg: 180, volumetric: 0.35, radius: 0.05 }, height: 2.6 },
  { key: 'desk', label: 'desk lamp', title: 'desk lamp spot: warm, short, wide cone, at desk height + 0.4', def: { kind: 'spot', color: [1, 0.75, 0.45], intensity: 9, range: 6, innerDeg: 30, outerDeg: 62, volumetric: 0.25, radius: 0.06 }, height: 1.16 },
  { key: 'down', label: 'downlight', title: 'ceiling downlight spot: neutral, 60° cone, from just under the ceiling', def: { kind: 'spot', color: [1, 0.95, 0.88], intensity: 30, range: 9, innerDeg: 25, outerDeg: 60, volumetric: 0.15, radius: 0.08 }, height: 2.9 },
  { key: 'sodium', label: 'street lamp', title: 'sodium street lamp head (spot, broad class, street supply — mains false): 5 m up', def: { kind: 'spot', color: [1, 0.62, 0.22], intensity: 260, range: 22, innerDeg: 35, outerDeg: 65, volumetric: 0.12, radius: 0.18, broad: true }, height: 5.05 },
];
export const VOLUME_KINDS = ['hide', 'utility', 'trigger'] as const;
