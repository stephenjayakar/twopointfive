// THE KIT VIEW'S PLAN (the Team & kit picture, src/host/kitView.ts): everything the picture needs to know about ONE way in, worked out from the level's own
// data and nothing else, so that the staging can be level-free: `kitViewPlan(level, way, ref) → KitViewPlanned`. The owner, 10-15: "can we also start fanning
// out and doing the gear selection screen per level? can we make it nicely abstracted so tweaks to one of them don't require churn elsewhere?" — a level
// then writes a way's ANCHOR (a `door`, or a `span`: two points on a blank wall to breach or the two posts of an open gate) and whatever it wants to pin;
// every other value is MEASURED here, the same way for every level.
//
// PURE: plain level data in (the file's boxes, doors and lights as docs/level-format.md gives them — scene/levelData.ts BoxData / DoorData / LightData),
// plain data out; no Math.random, no clock, no DOM, and NO IMPORT of src/game (one runtime import cycle) nor of src/host/kitView.ts (which imports it): the
// types below are erased. The picture's own numbers are repeated in KIT_PLAN; tools/qa/kitview-plan.ts holds them equal to KIT_VIEW_STAGE / _LOOP / _LIGHT
// and the door slots equal to kitViewSlots, place for place.
//
// A LEVEL OR A SET. The plan is made from whatever geometry it is handed and reaches for nothing else: a way that names a BESPOKE SET (scenarios.ts
// KitViewSet — a small stage the picture loads instead of the level) is planned from the set's own boxes, doors and lights and the set's `ref`, with not
// one record of the level's in reach (kitViewPlanWay below is the one place that chooses).
//
// AUTHORED KEYS ALWAYS WIN. Every value the plan measures can be written on the way (scene/scenarios.ts KitViewWay) and is then taken as written, key by
// key, never corrected: level numbers tuned in the viewer are authored data. `src` says, per value, which it was.
//
// FREE FLOOR is the nav grid's own question, asked of the file's boxes: a 0.5 m cell is shut when a 0.34 m circle at its middle is pushed more than 5 mm
// by the boxes that stand between knee and shoulder (scene/collision.ts NavGrid's constructor over collideCircle, step for step — kitPlanFloor). So it agrees with the game's grid
// wherever the level's statics are the file's boxes (the check counts the cells that differ). WHAT IT CANNOT SEE: loose props (chairs, cartons, bins —
// not in the nav grid either, but a man is pushed off one), door leaves, anything the game adds or takes at run time (a blown wall, a broken pane, the
// porch lamp's own box), boxes a stand leaves out (lived-in rooms / dressing switched off: hand it the boxes that stand loads), a tilted box (`rot`)
// beyond its yawed footprint — as the grid itself — and the PICTURE: the camera here is the worked-out pin BEFORE the page's `frame` message slides and
// scales it, so `occluders` is what stands in THAT line; nothing here has been seen on a GPU.
import type { BoxData, DoorData, LightData } from '../scene/levelData';
import type { KitViewWay, KitViewData } from '../scene/scenarios';
import type { Vec3 } from '../math/vec';

export type V2 = [number, number];
export type KitPlanSrc = 'authored' | 'derived';
/** the level as the planner reads it: the file's own records (the page's stand loads every box: lived-in rooms and dressing on) */
export interface KitPlanLevel { boxes: readonly BoxData[]; doors: readonly DoorData[]; lights?: readonly LightData[];
  /** the file's LOOSE PROPS as the stand loaded them (index for index the game's: scene/levelLoad.ts) — a chair, a stool, a carton: no box of the level's.
   *  A prop is OF a group when its id is the group's name and a dotted tail ('lived.forecourt.stool0' of 'lived.forecourt'). Absent: none */
  props?: readonly { id: string; x: number; z: number }[];
  /** names of what the stand LEFT OUT of the file (scene/levelLoad.ts levelFileOf: lived-in rooms or the dressing switched off — box ids and groups, prop
   *  ids): a `hide` / `show` that names one names nothing here, and is no problem */
  left?: readonly string[] }
/** a way as the planner takes it: `door` may be absent where there is a `span` (KitViewWay keeps `door` a string until the child stages from the plan) */
export type KitViewWayIn = Omit<KitViewWay, 'door'> & { door?: string };

/** the picture's numbers, repeated (see the head) */
export const KIT_PLAN = {
  /** KIT_VIEW_STAGE: a wall man off the wall's FACE (its `off` 0.82 less the 12 cm half-wall it was measured on) · between men · the first man past the
   *  jamb · Sam off the face (1.2 less the same) · his turn onto the door · no nearer the anchor's middle than · what the records file's slots were laid at */
  offFace: 0.70, gap: 1.1, jamb: 0.45, samOffFace: 1.08, samTurnDeg: 35, samClear: 1.8, authored: 0.9,
  /** a leaf's open stop where the door writes none (game/doors.ts: ±1.92 rad) */
  leafStop: 1.92,
  /** the camera (KIT_VIEW_STAGE.yaw / pitch / dist / distPerM) */
  yaw: 1.206, pitch: 0.96, dist: 8.8, distPerM: 0.85,
  /** a man: the radius he is clear of a box by · no two men nearer than (twice KIT_VIEW_STAGE.body) · his feet, belt and head for the camera's lines */
  man: 0.3, apart: 0.9, heights: [0.3, 1.0, 1.7],
  /** KIT_VIEW_LOOP: the card switch's lane, m out from the file · the throws' spots in from the anchor's line (inM), first choice and nearest */
  lane: 0.7, inM: 2.0, inMin: 1.6,
  /** THE STAGE the camera must see: its floor runs out to the lane or to where the fourth man goes round Sam (KIT_VIEW_LOOP.round out from him), and this much more · a THING (what goes whole when a piece of it is in the way) is no taller
   *  and no longer than */
  round: 0.75, act4: [0.2, 0.9] as [number, number], actClear: 0.7, actStep: 0.05, stageOut: 0.3, thingTop: 2.2, thingHalf: 3, lowTop: 0.25, propNear: 0.8,   // (lowTop: what tops out under it — a drift, a kerb, a sill a man wades or steps over — is never in the camera's way: it hides no man, and sinking it would take the ground from under the picture)
  /** the nav bake (scene/collision.ts NavGrid over StaticCollision): its cell, the circle, how far it must be moved to count, the heights, the grid, the
   *  collision cells the boxes are filed in (scene/world.ts WORLD.gridCell) */
  nav: { cell: 0.5, r: 0.34, moved: 0.005, y0: 0.25, y1: 1.5, W: 80, H: 56, coarse: 1 },
  /** depths are walked this far at most (m), in steps of · a threshold's shut cells (the jambs' circles meet in a doorway) are passed over up to */
  reach: 20, step: 0.25, sill: 1.2,
  /** a WALL box: no thicker across the anchor's line than · a COVER (a ceiling, a roof): its underside at least this high and its footprint this wide ·
   *  A WALL A MAN STACKS ON comes down to his shoulder at least (its underside below `wallFoot`: a header beam over an open gateway is no wall to stand
   *  at; a window is one, by its pane or its sill) — or is another door of the level, on the line within `doorOn` across it (a lintel and a leaf: no box below the shoulder) */
  wallHalf: 0.6, coverY: 1.9, coverHalf: 0.5, wallFoot: 1.5, doorOn: 0.15,
  /** THE LAMPS (KIT_VIEW_LIGHT): the porch lamp off the face, up, and no nearer the wall's top than · its box off the face and under the lamp · the
   *  fill out from the face and up, and no nearer the end of the free floor in front than · AT A GAP (no wall over the opening): the lamp and its box
   *  hang this far past the jamb onto the wall or post beside it (a hand's width: the box's half and a little; half of it where the post is that thin), and
   *  only on one that tops out this high at least */
  porchOut: 0.55, porchUp: 2.4, porchUnder: 0.2, fixOut: 0.05, fixDown: 0.13, porchAim: [0, 2.35, 0], fillOut: 6.5, fillUp: 2.0, fillBack: 0.6, fillAim: [0.6, 0.8, 0.9],
  porchHand: 0.2, porchCarry: 2.0,
  /** A ROOF, as the weather has it (game/weather.ts roofsOf: WORLD.ceilingY − 0.25 ‥ + 0.45, 0.45 m half-size at least, the four largest, ROOF_PAD) */
  roof: { y0: 2.75, y1: 3.45, half: 0.45, most: 4, pad: 0.3 },
  /** A PANE to shoot through, AS THE CHILD'S GUN ROW PICKS IT (host/kitView.ts fireLine — KIT_VIEW_LOOP.paneReach and its own three numbers): glass in the
   *  anchor's OWN wall (its middle within `paneWall` of the anchor's line), no further ALONG it from the anchor's middle than `paneAlong`, its bottom no
   *  higher and its top no lower than `paneY` · a man's gun is at `gunY` · he stands this far off it (first that is free). `paneWall` and `paneY` are READ
   *  by the child (it wrote the three numbers out itself); `paneAlong` is its KIT_VIEW_LOOP.paneReach, held equal by tools/qa/kitview-plan.ts A */
  gunY: 1.3, paneOff: [1.0, 1.3, 0.8, 1.6], paneWall: 0.5, paneAlong: 6, paneY: [1.5, 1.2] as [number, number],
  /** THE WEDGE BEHIND THE WALL (a way's `litInside`): the point the picture shows behind the anchor — this far behind the wall's far face, at the anchor's
   *  middle, this high — and a lamp lights it from no further off than (and no further than its own range) */
  litIn: 1, litY: 1, litReach: 6,
};

export interface KitViewPlanned {
  /** THE ANCHOR: what the team is stood at. `a` → `b` are its two ends on the wall's line (a door: hinge → latch jamb; a span: as written), `t` the unit
   *  vector a → b, `n` the unit normal OUT of the wall toward the team, `door` the leaf's id (null: a wall or a gap — no leaf to push, crack or charge) */
  anchor: { kind: 'door' | 'wall' | 'gap'; door: string | null; a: V2; b: V2; mid: V2; t: V2; n: V2; width: number; steel: boolean; locked: boolean; exterior: boolean };
  /** a point on the team's side (what `n` was turned by) */
  ref: V2;
  /** which way along the wall the stack forms: 1 = past `b`, -1 = past `a` (a door: the hinge's side) · `s` = the unit vector from the anchor toward the stack */
  side: 1 | -1; s: V2;
  /** where the stack falls ON SCREEN beside the anchor under `cam`: 'left' is the hand the parent's frame was drawn for (the records office's); 'right' =
   *  the child mirrors `door / left / right` */
  hand: 'left' | 'right';
  /** the wall at the anchor, measured: its face on the team's side and its far face as distances from the anchor's line along `n` (a 12 cm half-wall: 0.12
   *  and -0.12), its thickness, its top over the anchor (0: no wall there — an open gate), and the boxes it was read off */
  wall: { face: number; back: number; thickness: number; top: number; boxes: string[] };
  /** THE FIVE PLACES, final (an authored stack slot already spread to the picture's spacing): [x, z, yaw°] — [0] Sam, [1‥3] the stack from the anchor
   *  outward, [4] the fourth teammate behind Sam · per place, authored or worked out */
  slots: [number, number, number][]; slotSrc: KitPlanSrc[];
  /** how many of the five stand on free floor, clear of every box and of each other · places the worked-out lines stepped over for the men they place (a
   *  place the way writes is not counted) · the spacing the authored
   *  stack was laid out at (= `gap` where nothing is authored) */
  fit: number; stepped: number; slotGap: number;
  /** the lane beside the stack for the card switch: `out` m from the wall's line, from beside the head of the stack to a place behind its last man;
   *  `free` = every step of it is free floor (false: the child's straight-walk fallback), `clearM` = how far along it is */
  lane: { out: number; a: V2; b: V2; free: boolean; clearM: number };
  /** free floor in front of the face (m: the fill lamp, the lane) · BEHIND the anchor's line (m: the room a can or a round has; a gap: the far side of
   *  the gate; a blank wall: 0) · and behind a blank wall's far face (what a wall charge opens onto) */
  out: number; inside: number; beyond: number;
  /** THE PANE THE GUN ROW SHOOTS THROUGH, or null — written on the way: that one (it must pass the same tests: one that does not is a problem, and null);
   *  worked out: the one the child's gun row tries FIRST (glass in the anchor's own wall, the nearest along it: KIT_PLAN.paneWall / paneAlong / paneY) that a
   *  man can stand before. KNOWN, NOT THE SAME: the child tries each pane from the man's OWN PLACE first and only then from a post before it, and takes the
   *  first he has a clear line to; this plan has no man and no line of fire, and passes over a pane with no free place in front of it — so with two panes in
   *  the wall the two can name different ones (a nearer pane shot from his slot with its front blocked; a nearer pane he has no line to). A level that
   *  cares writes the box. The box, its middle, width and the unit
   *  normal toward the man, where he stands for it [x, z, yaw°], how far that is from the nearest of the five places, whether the pane is in the anchor's
   *  own wall, and how far ALONG the wall from the anchor's middle it is (m, + toward the stack: a pane far along is a long walk, or off the frame) */
  pane: { box: string; index: number; at: Vec3; width: number; n: V2; stand: [number, number, number]; from: number; onWall: boolean; along: number } | null;
  /** boxes that stand between the camera and the men, the anchor or the floor they walk for a beat ('line'), with the rest of the thing each is a piece of
   *  ('part'), worked out — and everything out of the picture as indexes into `level.boxes`: the
   *  way's `hide` / `hidePaint` / `hideMore` — and, where the way writes no `hide`, the occluders less its `show` (an authored `hide` wins outright;
   *  `hideMore` is added to either) */
  occluders: { id: string; index: number; group: string; why: 'line' | 'part' }[]; hidden: number[];
  /** …and THE LOOSE PROPS that go with them, as indexes into `level.props`: a prop the way's `hide` names (its id, or the group it is of) — and, where the
   *  way writes no `hide`, a prop of a hidden box's group standing within `propNear` of that box (the chairs of a table that goes), less its `show` */
  hiddenProps: number[];
  /** lamp places, anchor-relative as a KitViewLamp's are ([along the wall toward the stack, out on the team's side, up]) and in the world: the porch
   *  lamp and its glowing box (null: no wall to carry one), the fill. Over a door or a stretch of wall the porch lamp hangs at along 0; at a GAP on the
   *  jamb's wall at the stack's end of the opening (else the other end's), and with no wall tall enough at either end the light alone, overhead */
  lamps: { porch: { offset: Vec3; aim: Vec3; pos: Vec3; fixture: { at: Vec3; pos: Vec3 } | null }; fill: { offset: Vec3; aim: Vec3; pos: Vec3 } };
  /** light groups with a lamp under the open sky: the yard's own, which a picture with the room lights out must leave lit ('exterior' is always left;
   *  BY DAY the way's own lamps among them are out all the same, lamp by lamp: kitPlanDayOut) —
   *  and, where the way writes `litInside`, the groups of the lamps that light the wedge behind the anchor (kitPlanLitInside); and the groups of
   *  the lamps the way adds (`add.lamps`) */
  keepLights: string[];
  /** the team stands under a roof (no weather on the men) · how many of the five places are */
  indoors: boolean; covered: number;
  /** THE CAMERA'S PIN, BEFORE THE PAGE'S FRAME — NOT the camera the page ends with: the child (host/kitView.ts aim()) keeps this yaw and pitch and then
   *  slides the look point along the camera's right and the ground's forward and scales the distance, to seat the five places in the figure column of
   *  whatever window it has (the parent's `frame` message and the view's aspect: the page's size, which no plan has). Worked through headless for three
   *  real page sizes the camera ends 5 to 8 m from `pos` and a third further back (never measured on a page). So: `occluders` — and what goes for them —
   *  is what stands in the PIN's lines to the men, the anchor and the stage's floor; do not ray-test from `pos` what the page shows or hides behind a wall.
   *  On the ways measured the pin named a few boxes the slid camera's lines did not meet, never the reverse */
  cam: { look: Vec3; yaw: number; pitch: number; dist: number; pos: Vec3 };
  /** per value: written on the way, or measured here */
  src: Record<string, KitPlanSrc>;
  /** what is wrong with this way, in plain words (empty: it stages) */
  problems: string[];
}

const RAD = Math.PI / 180;
const dot = (a: V2, b: V2) => a[0] * b[0] + a[1] * b[1];
const r2 = (v: number) => Math.round(v * 100) / 100;
const flag = (b: BoxData, f: string) => !!b.flags && (b.flags as readonly string[]).includes(f);
/** the floor distance from (x, z) to a box's yawed footprint (0 inside) — scene/collision.ts's own arithmetic */
function gapTo(b: BoxData, x: number, z: number): number {
  const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0), dx = x - b.c[0], dz = z - b.c[2], lx = c * dx - s * dz, lz = s * dx + c * dz;
  return Math.hypot(lx - Math.max(-b.h[0], Math.min(b.h[0], lx)), lz - Math.max(-b.h[2], Math.min(b.h[2], lz)));
}
/** the floor gap between two boxes' yawed footprints, to a few cm (corners of each against the other; 0 where they overlap) */
function gapBoxes(p: BoxData, q: BoxData): number {
  const pts = (b: BoxData): V2[] => { const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0), o: V2[] = []; for (const kx of [-1, 0, 1]) for (const kz of [-1, 0, 1]) { const lx = kx * b.h[0], lz = kz * b.h[2]; o.push([b.c[0] + c * lx + s * lz, b.c[2] - s * lx + c * lz]); } return o; };
  return Math.min(...pts(p).map(v => gapTo(q, v[0], v[1])), ...pts(q).map(v => gapTo(p, v[0], v[1])));
}
/** half a box's reach along a floor direction */
function reach(b: BoxData, d: V2): number { const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0); return Math.abs(d[0] * c - d[1] * s) * b.h[0] + Math.abs(d[0] * s + d[1] * c) * b.h[2]; }
/** does the segment p → q meet the box (yawed; a tilted one by its yaw alone)? */
function segBox(b: BoxData, p: Vec3, q: Vec3): boolean {
  const c = Math.cos(b.yaw ?? 0), s = Math.sin(b.yaw ?? 0), L = (v: Vec3): Vec3 => { const dx = v[0] - b.c[0], dz = v[2] - b.c[2]; return [c * dx - s * dz, v[1] - b.c[1], s * dx + c * dz]; };
  const o = L(p), e = L(q); let t0 = 0, t1 = 1;
  for (let ax = 0; ax < 3; ax++) { const d = e[ax] - o[ax], h = b.h[ax];
    if (Math.abs(d) < 1e-12) { if (Math.abs(o[ax]) > h) return false; continue; }
    let ta = (-h - o[ax]) / d, tb = (h - o[ax]) / d; if (ta > tb) { const t = ta; ta = tb; tb = t; }
    if (ta > t0) t0 = ta; if (tb < t1) t1 = tb; if (t0 > t1) return false; }
  return true;
}

/** UNDER A COVER: a box over the point (x, z) with its underside at `coverY` at least and no lower than `y` (a lamp's own height), `coverHalf` wide both
 *  ways — a ceiling, a roof. What `keepLights` leaves out as a room's lamp, and what the day's photocell leaves burning (kitPlanDayOut). */
export function kitPlanCovered(boxes: readonly BoxData[], x: number, z: number, y: number): boolean {
  const K = KIT_PLAN; return boxes.some(b => b.c[1] - b.h[1] >= Math.max(K.coverY, y - 0.05) && Math.min(b.h[0], b.h[2]) >= K.coverHalf && gapTo(b, x, z) < 0.02);
}
/** THE FLOOR of a level's boxes, as the nav grid bakes it (see the head): built once per level, shared by its ways. `out` = boxes (indexes) that do not
 *  stand on it */
export interface KitPlanFloor { /** the nav grid's answer for the cell (x, z) lies in */ blocked(x: number, z: number): boolean; /** the indexes of the boxes that stand between knee and shoulder */ solid: number[] }
export function kitPlanFloor(boxes: readonly BoxData[], out?: ReadonlySet<number>): KitPlanFloor {
  const N = KIT_PLAN.nav, solid: number[] = [], grid = new Uint8Array(N.W * N.H);
  boxes.forEach((b, i) => { if (!out?.has(i) && !flag(b, 'NoShadow') && b.c[1] + b.h[1] >= N.y0 && b.c[1] - b.h[1] <= N.y1) solid.push(i); });
  // the game's own bake, step for step (StaticCollision.collideCircle, one pass): the circle is pushed out of each box IN TURN — the turn being the 1 m
  // collision cells' (rows of z, then x; a box in the first of its cells the circle's reach meets), then the file's order — and the cell is shut when it
  // ends up more than 5 mm from where it began. (So a circle squeezed back by a second box, or nudged twice, answers as the game's does.)
  const cs = N.coarse, CW = N.W * N.cell / cs, CH = N.H * N.cell / cs, clampi = (v: number, hi: number) => Math.max(0, Math.min(hi, v));
  const reg = solid.map(i => { const b = boxes[i], c = Math.abs(Math.cos(b.yaw ?? 0)), sn = Math.abs(Math.sin(b.yaw ?? 0)), ex = c * b.h[0] + sn * b.h[2], ez = sn * b.h[0] + c * b.h[2];
    return { i, x0: Math.max(0, Math.floor((b.c[0] - ex) / cs)), x1: Math.min(CW - 1, Math.floor((b.c[0] + ex) / cs)), z0: Math.max(0, Math.floor((b.c[2] - ez) / cs)), z1: Math.min(CH - 1, Math.floor((b.c[2] + ez) / cs)) }; });
  const coarse: number[][] = Array.from({ length: CW * CH }, () => []);
  reg.forEach((r, k) => { for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) coarse[z * CW + x].push(k); });
  const seen = new Int32Array(reg.length).fill(-1); let stamp = 0;
  for (let gz = 0; gz < N.H; gz++) for (let gx = 0; gx < N.W; gx++) {
    const px = (gx + 0.5) * N.cell, pz = (gz + 0.5) * N.cell; let x = px, z = pz, touched = false; const id = stamp++;
    const x0 = clampi(Math.floor((x - N.r) / cs), CW - 1), x1 = clampi(Math.floor((x + N.r) / cs), CW - 1), z0 = clampi(Math.floor((z - N.r) / cs), CH - 1), z1 = clampi(Math.floor((z + N.r) / cs), CH - 1);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) for (const k of coarse[cz * CW + cx]) { if (seen[k] === id) continue; seen[k] = id;
      const b = boxes[reg[k].i], c = Math.cos(b.yaw ?? 0), sn = Math.sin(b.yaw ?? 0), dx = x - b.c[0], dz = z - b.c[2], lx = c * dx - sn * dz, lz = sn * dx + c * dz;
      const qx = Math.max(-b.h[0], Math.min(b.h[0], lx)), qz = Math.max(-b.h[2], Math.min(b.h[2], lz)), ddx = lx - qx, ddz = lz - qz, d2 = ddx * ddx + ddz * ddz;
      if (d2 >= N.r * N.r) continue;
      let nx: number, nz: number, pen: number;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ddx / d; nz = ddz / d; pen = N.r - d; }
      else { const ox = b.h[0] - Math.abs(lx), oz = b.h[2] - Math.abs(lz); if (ox < oz) { nx = Math.sign(lx) || 1; nz = 0; pen = ox + N.r; } else { nx = 0; nz = Math.sign(lz) || 1; pen = oz + N.r; } }
      x += (c * nx + sn * nz) * pen; z += (-sn * nx + c * nz) * pen; touched = true; }
    if (touched && Math.hypot(x - px, z - pz) > N.moved) grid[gz * N.W + gx] = 1; }
  return { solid, blocked: (wx, wz) => { const x = Math.floor(wx / N.cell), z = Math.floor(wz / N.cell); return x < 0 || z < 0 || x >= N.W || z >= N.H || grid[z * N.W + x] === 1; } };
}

/** A door's (or a span's) places, [x, z, yaw°]: Sam, then the teammates from the anchor outward — src/host/kitView.ts kitViewSlots, place for place, with
 *  the wall man's and Sam's distances given from the anchor's LINE (there: 0.82 and 1.2 off a 12 cm half-wall). `stepped` = places passed over, all five —
 *  `steps` = the same PER PLACE: how many were passed over to find THAT man's (a place the way writes itself is not the line's to answer for). */
export function kitPlanSlots(a: V2, t: V2, width: number, n: V2, side: 1 | -1, off: number, samOff0: number, free: (x: number, z: number) => boolean): { slots: [number, number, number][]; stepped: number; steps: number[] } {
  const K = KIT_PLAN, J: V2 = [a[0] + t[0] * width, a[1] + t[1] * width], s: V2 = [t[0] * side, t[1] * side], near = side > 0 ? J : a, far = side > 0 ? a : J;
  let stepped = 0; const lines = [0, 0];
  const take = (line: 0 | 1, o: number): V2 => {
    const from = line ? far : near, dir = line ? -1 : 1, at = (al: number): V2 => [from[0] + s[0] * dir * al + n[0] * o, from[1] + s[1] * dir * al + n[1] * o];
    for (let tries = 0; tries < 10; tries++) { const p = at(K.jamb + K.gap * lines[line]++); if (free(p[0], p[1])) return p; stepped++; }
    return at(K.jamb);
  };
  const c = Math.cos(K.samTurnDeg * RAD), sn = Math.sin(K.samTurnDeg * RAD), yawOf = (d: V2) => Math.atan2(d[0], d[1]) / RAD;
  const along = width / 2 + K.jamb, samOff = Math.max(samOff0, Math.sqrt(Math.max(0, K.samClear * K.samClear - along * along)));
  const slots: [number, number, number][] = [], steps: number[] = []; let was = 0; const told = () => { steps.push(stepped - was); was = stepped; };
  { const p = take(1, samOff); told(); slots.push([p[0], p[1], yawOf([s[0] * c - n[0] * sn, s[1] * c - n[1] * sn])]); }
  for (let i = 0; i < 4; i++) { const behind = i >= 3, p = take(behind ? 1 : 0, off); told(); slots.push([p[0], p[1], yawOf(behind ? s : [-s[0], -s[1]])]); }
  return { slots, stepped, steps };
}

/** THE FOURTH MAN'S PLACE WHILE HIS CARD IS OPEN (KIT_VIEW_LOOP.act4: past Sam's jamb by `act4[0]`, `act4[1]` off the anchor's line, on Sam's side of it) —
 *  and A BODY'S CLEARANCE of every other man's place (`actClear`, centre to centre). Sam's place is laid `jamb` past the same jamb and no nearer the anchor's
 *  middle than `samClear`: at a 0.86 m door that is 1.57 m out and the two are 0.72 m apart, but past a 2 m opening Sam stands at his plain 1.2 m and the
 *  acting place was 0.39 m from him — two men in one place, or a walk that never arrives. Where the place as written is that near anybody's it is slid
 *  along the wall toward the anchor's middle, `actStep` at a time, to the first that is clear (and, a `free` given, on free floor): the SLOTS are never
 *  moved for it. Clear as written: the place as written, to the bit. `clear` 0 = as written whatever stands there (a check's break). Pure. */
export function kitPlanAct4(mid: V2, s: V2, n: V2, width: number, slots: readonly (readonly number[])[], free?: (x: number, z: number) => boolean, clear = KIT_PLAN.actClear): V2 {
  const K = KIT_PLAN, hw = width / 2, at = (al: number): V2 => [mid[0] + s[0] * al + n[0] * K.act4[1], mid[1] + s[1] * al + n[1] * K.act4[1]];
  const others = slots.slice(0, 4), ok = (p: V2) => others.every(q => Math.hypot(p[0] - q[0], p[1] - q[1]) >= clear - 1e-9);
  const a0 = -(hw + K.act4[0]), p0 = at(a0); if (ok(p0)) return p0;
  for (let k = 1; a0 + k * K.actStep <= 1e-9; k++) { const p = at(a0 + k * K.actStep); if (ok(p) && (!free || free(p[0], p[1]))) return p; }
  return p0;
}
/** where every man stands with member `card`'s card open (1‥`squad`; 0: Sam's), a squad of `squad`: Sam on his place, the stack on its first places — the
 *  card switch only changes who stands on which —, the fourth man on his own or, his card open, on `act4` */
export function kitPlanStands(slots: readonly (readonly number[])[], act4: V2, squad: number, card: number): V2[] {
  const o: V2[] = []; for (let i = 0; i <= Math.min(4, squad) && i < slots.length; i++) o.push(i === 4 && card === 4 ? act4 : [slots[i][0], slots[i][1]]); return o;
}

/** THE LAMPS THAT LIGHT THE WEDGE BEHIND THE ANCHOR (a way's `litInside`: their groups stay lit with the room lights out): every lamp that is no sun or
 *  moon, standing BEHIND the wall's far face (`back`, from the anchor's line along `n`), with the wedge point (KIT_PLAN.litIn behind that face at the
 *  anchor's middle, litY up) inside its range and inside litReach. A spot's cone is not asked about, nor a wall between: the level writes `keepLights`
 *  where that matters. Pure; never seen on a GPU. */
export function kitPlanLitInside(lights: readonly LightData[], mid: V2, n: V2, back: number): LightData[] {
  const K = KIT_PLAN, w: Vec3 = [mid[0] + n[0] * (back - K.litIn), K.litY, mid[1] + n[1] * (back - K.litIn)];
  return lights.filter(l => l.kind !== 'dir' && dot([l.pos[0] - mid[0], l.pos[2] - mid[1]], n) < back && Math.hypot(l.pos[0] - w[0], l.pos[1] - w[1], l.pos[2] - w[2]) <= Math.min(l.range, K.litReach));
}

/** THE PORCH LAMP IS ON THE LEVEL'S PHOTOCELL (the child, where it hangs the lamps): how bright it burns. `lampsOut` = the hour has the level's outside
 *  lamps out (game/hours.ts: an HourDef whose `lamps` is false — midday, the grey day; dawn, dusk and the night burn them). Under the open sky the lamp is
 *  then at the way's `light.porch.day` — not written: 0, no lamp and no glowing box in full sun (a barracks picked by day opened with its porch lamp lit at
 *  noon). A way under a roof (`indoors`: the plan's, or the way's own word) is as the game leaves indoors at every hour: `lit`, as written or as the table
 *  has it. Pure: the hour is the caller's to ask. */
export function kitPlanPorchLit(lit: number, day: number | undefined, indoors: boolean, lampsOut: boolean): number { return lampsOut && !indoors ? day ?? 0 : lit; }
/** THE WAY'S OWN LAMPS: the lights of the set it stands on, or — a level's own way — the lamps it adds (`add.lamps`). Never a lamp of the level's. */
export function kitPlanOwnLamps(block: Pick<KitViewData, 'sets'> | undefined, way: Pick<KitViewWayIn, 'add' | 'set'>): readonly LightData[] { return way.set !== undefined ? block?.sets?.[way.set]?.lights ?? [] : way.add?.lamps ?? []; }
/** …AND THEY ARE ON THE SAME PHOTOCELL (the child, where it hangs the lamps): the ids of the way's own lamps that are OUT. At an hour with the level's
 *  outside lamps out, on a way under the open sky: every own lamp that is no sun or moon, not of the group `exterior` (the game's own photocell has
 *  those — game/hours.ts) and NOT UNDER A COVER (`boxes`: the set's, or the level's as built — a lamp with a ceiling over it is a room's, and the game
 *  leaves rooms lit at every hour: kitPlanCovered, the test `keepLights` is measured by) — less the ones the way's `dayLights` names, by id or by group. A set's gate lamp was in the plan's `keepLights` (a lamp under
 *  the open sky stays lit with the room lights out) and nothing took it out at noon: the lamp burned and its fixture box glowed in full sun. BY ID, never
 *  by group: an added lamp may share a group with the level's own lamps, which the mission leaves as they are. Any other hour, or under a roof: none.
 *  Pure: the hour is the caller's to ask; putting them out (the lamp and its fixture's glow together: the game's own light switch) is the child's. */
export function kitPlanDayOut(own: readonly LightData[], boxes: readonly BoxData[], day: readonly string[] | undefined, indoors: boolean, lampsOut: boolean): string[] {
  return lampsOut && !indoors ? own.filter(l => l.kind !== 'dir' && l.group !== 'exterior' && !kitPlanCovered(boxes, l.pos[0], l.pos[2], l.pos[1]) && !(day ?? []).some(nm => nm === l.id || nm === l.group)).map(l => l.id) : [];
}
/** A WAY'S OWN PIECES (its `add`: boxes and lamps in level coordinates, in the picture only) laid in AFTER the level's own — box i of the level is still box
 *  i, the added ones follow in the order written. BY ID, ONCE: the child plans from the records of the level the page BUILT, which carry them already
 *  (src/host/kitViewSet.ts kitViewAddLevel laid them in before the build; the validator holds their ids new to the level) — a record whose id the level
 *  has is not laid again, and a block that says `laid` (that level's own) lays nothing. Nothing to add (no `add`, a way on a set, all laid): the very object handed in. Pure. */
export function kitPlanAdd(level: KitPlanLevel, way: Pick<KitViewWayIn, 'add' | 'set'>): KitPlanLevel {
  const A = way.set === undefined ? way.add : undefined; if (!A || A.laid) return level;
  const hasB = new Set(level.boxes.map(b => b.id)), hasL = new Set((level.lights ?? []).map(l => l.id)), nb = (A.boxes ?? []).filter(b => !hasB.has(b.id)), nl = (A.lamps ?? []).filter(l => !hasL.has(l.id));
  return nb.length || nl.length ? { ...level, boxes: [...level.boxes, ...nb], lights: [...(level.lights ?? []), ...nl] } : level;
}
/** THE WAY AS THE CHILD PLANS IT (src/host/kitView.ts planFor): its `add` said to be LAID — the child's records are the level the page BUILT, by definition,
 *  so nothing is ever laid into them. Where the built world lacks a piece the way writes (a Level whose block carries no `laid` word: the bundled office's;
 *  a piece of a `lived.*` group with the lived-in rooms off; another way laid than the one staged), laying it by id gave a plan one box longer than the
 *  world. No `add`: the very object. */
export function kitPlanWayBuilt<T extends Pick<KitViewWayIn, 'add'>>(way: T): T { return way.add ? { ...way, add: { ...way.add, laid: true } } : way; }
/** THE GEOMETRY a way is planned from, and the point on the team's side: the way's SET where it names one (the set alone), else the level — with the
 *  way's own `add` laid in (kitPlanAdd) — and `ref` (Sam's start for that way). null = the way names a set the block does not have. */
export function kitPlanGeometry(level: KitPlanLevel, block: Pick<KitViewData, 'sets'> | undefined, way: KitViewWayIn, ref: V2): { level: KitPlanLevel; ref: V2; set: string | null } | null {
  if (way.set === undefined) return { level: kitPlanAdd(level, way), ref, set: null };
  const T = block?.sets?.[way.set]; return T ? { level: { boxes: T.boxes, doors: T.doors ?? [], lights: T.lights ?? [] }, ref: [T.ref[0], T.ref[1]], set: way.set } : null;
}
/** …and the plan from it: `set` = the set it was planned on (null: the level itself) */
export function kitViewPlanWay(level: KitPlanLevel, block: Pick<KitViewData, 'sets'> | undefined, way: KitViewWayIn, ref: V2, opts: KitPlanOpts = {}): KitViewPlanned & { set: string | null } {
  const G = kitPlanGeometry(level, block, way, ref);
  if (!G) { const p = kitViewPlan({ boxes: [], doors: [] }, way, ref); return { ...p, set: way.set ?? null, problems: [`no set '${way.set}' in the block's sets`] }; }
  // (a set has its own floor, and so has a level with a piece added HERE: the level's `floor` is not handed on — NOR ITS `free`, on a set or under a piece
  //  laid here: `free` answers before the floor does (kitViewPlan), and one made on the bare level put a man inside the added crate and said nothing —
  //  the review, 10-16. The child does not come this way: kitPlanGeometry, then kitViewPlanChild with the game's own grid, which has the piece; and a
  //  level that already carries it (`add.laid`: kitPlanAdd lays nothing) is the caller's own, every option kept. What the caller says of the way's `hide` (`hiddenStand`, `alsoHide`) is the way's, whatever
  //  it is planned on: it was dropped with the floor)
  const own = G.set === null && G.level === level, { floor: _f, free: _g, ...said } = opts;
  return { ...kitViewPlan(G.level, way, G.ref, own ? opts : said), set: G.set };
}

/** how the problem "an occluder that is no thing was worked out" begins (kitViewPlan; kitViewPlanChild carries the first pass's across by it) */
export const KIT_PLAN_IN_WAY = "in the camera's way and not a thing to sink";
/** THE PLAN AS THE CHILD MAKES IT (src/host/kitView.ts planFor — and tools/qa/kitview-plan.ts, which holds this very function to its rows): TWO PASSES on the
 *  floor as the game has it. The first plans with the way's `hide` still standing on that floor and hands what is out of the picture to `sink` (the child
 *  puts those boxes under the ground and rebakes the grid; `free` must answer for the floor that leaves). The second plans again on that floor with the
 *  first's occluders named as already out (`alsoHide` — none where the way WRITES its `hide`: that wins outright) and sinks what it finds.
 *  The plan handed back is the second's, with the occluders of both — and THE FIRST PASS'S PROBLEM OF A NON-THING OCCLUDER (a wall, a box carrying a door or a
 *  lamp, sunk all the same): the second pass is told those ids are out and would never say it, so a way that sank a piece of its building said nothing. */
export function kitViewPlanChild(level: KitPlanLevel, way: KitViewWayIn, ref: V2, free: (x: number, z: number) => boolean, sink: (hidden: readonly number[]) => void): KitViewPlanned {
  const P0 = kitViewPlan(level, way, ref, { free, hiddenStand: true }); sink(P0.hidden);
  const P1 = kitViewPlan(level, way, ref, { free, alsoHide: way.hide === undefined ? P0.occluders.map(o => o.id) : [] }); sink(P1.hidden);
  const first = P0.problems.filter(p => p.startsWith(KIT_PLAN_IN_WAY) && !P1.problems.includes(p));
  return { ...P1, occluders: [...P0.occluders, ...P1.occluders.filter(o => !P0.occluders.some(q => q.index === o.index))], problems: [...P1.problems, ...first] };
}

/** `floor` = this level's floor built once (kitPlanFloor) · `free` = the game's own grid in its place (the child: `!nav.isBlocked`) · `hiddenStand` = the
 *  boxes the way's `hide` names still stand on the floor (absent: they are out of it, as they are out of the picture) · `alsoHide` = ids the caller has
 *  ALREADY taken out of the picture (the child's first pass: the occluders it worked out and sank) — out of the floor and among `hidden`, without the way's
 *  `hide` counting as written */
export interface KitPlanOpts { floor?: KitPlanFloor; free?: (x: number, z: number) => boolean; hiddenStand?: boolean; alsoHide?: readonly string[] }
/** THE PLAN for one way. `ref` = a point on the team's side (Sam's start for this way: scenarios.roomClear.team / starts[k − 1]; the way's own `ref`
 *  wins). */
export function kitViewPlan(level: KitPlanLevel, way: KitViewWayIn, ref: V2, opts: KitPlanOpts = {}): KitViewPlanned {
  const K = KIT_PLAN, B = level.boxes;
  // (what the way HIDES — its `hide`, its `hideMore` — is out of the picture, so out of the picture's floor: the records front's parked car. The game's own grid still holds a sunk box
  //  until the child rebakes it — `hiddenStand` plans on the floor as that grid has it)
  const hideMore = new Set(way.hideMore ?? []), named = new Set([...(way.hide ?? []), ...hideMore, ...(opts.alsoHide ?? [])]), sunk = new Set<number>(); if (!opts.hiddenStand) B.forEach((bx, i) => { if (named.has(bx.id) || (bx.group !== undefined && named.has(bx.group))) sunk.add(i); });
  const F = sunk.size ? kitPlanFloor(B, sunk) : opts.floor ?? kitPlanFloor(B), free = opts.free ?? ((x: number, z: number) => !F.blocked(x, z));
  const problems: string[] = [], src: Record<string, KitPlanSrc> = {};
  const say = <T>(key: string, authored: T | undefined, derive: () => T): T => { if (authored !== undefined) { src[key] = 'authored'; return authored; } src[key] = 'derived'; return derive(); };
  /** boxes (indexes) whose footprint holds the floor point */
  const over = (x: number, z: number, list: readonly number[]) => list.filter(i => gapTo(B[i], x, z) < 0.02);
  const all = B.map((_, i) => i);
  const clear = (x: number, z: number, r: number) => F.solid.every(i => gapTo(B[i], x, z) >= r);
  const covered = (x: number, z: number, y: number) => kitPlanCovered(B, x, z, y);

  // THE ANCHOR: a door's frame, or the span as written
  const D = way.door !== undefined ? level.doors.find(d => d.id === way.door) : undefined;
  let a: V2 = [0, 0], t: V2 = [1, 0], width = 1, got = true;
  if (way.span) { const [p, q] = way.span, len = Math.hypot(q[0] - p[0], q[1] - p[1]); a = [p[0], p[1]]; width = len; t = len > 1e-6 ? [(q[0] - p[0]) / len, (q[1] - p[1]) / len] : [1, 0]; if (len < 0.4) problems.push(`the span is ${r2(len)} m long: nothing to stand at`); }
  else if (D) { a = [D.hinge[0], D.hinge[1]]; t = [Math.cos(D.closedDir), Math.sin(D.closedDir)]; width = D.width; }
  else { got = false; problems.push(way.door !== undefined ? `no door '${way.door}' in the level` : 'no anchor: the way names neither a door nor a span'); }
  src.anchor = 'authored';
  const b: V2 = [a[0] + t[0] * width, a[1] + t[1] * width], mid: V2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const R: V2 = say('ref', way.ref, () => ref);
  const n0: V2 = [-t[1], t[0]], outK = dot([R[0] - mid[0], R[1] - mid[1]], n0) >= 0 ? 1 : -1, n: V2 = [n0[0] * outK, n0[1] * outK];
  const P = (al: number, o: number): V2 => [mid[0] + t[0] * al + n[0] * o, mid[1] + t[1] * al + n[1] * o];   // (along a → b from the middle, out toward the team)
  // what stands ON the anchor's line: wall boxes, thin across it
  const wallish = F.solid.filter(i => !flag(B[i], 'Glass') && reach(B[i], n) <= K.wallHalf);
  const onLine = (al: number) => { const p = P(al, 0); return over(p[0], p[1], wallish); };
  const within = [0.1, 0.3, 0.5, 0.7, 0.9].map(k => (k - 0.5) * width), shut = within.filter(al => onLine(al).length > 0).length;
  const kind: 'door' | 'wall' | 'gap' = say('kind', way.kind, () => !way.span ? 'door' : shut * 2 > within.length ? 'wall' : 'gap');
  if (way.span && kind === 'wall' && shut < within.length) problems.push(`the span is not all wall (${shut} of ${within.length} points along it are in one): a wall anchor lies on a wall`);
  if (way.span && kind === 'gap' && shut > 0) problems.push(`the span is not all open (${shut} of ${within.length} points along it are in a wall): a gap anchor is a real gap`);
  if (way.span && kind === 'door') problems.push("a span is a 'wall' or a 'gap', never a 'door'");

  // THE WALL beside the anchor (both ways along it, the nearest first), and over it
  const beside = [0.15, 0.45, 0.8, 1.2, 1.7, 2.3, 3.0], hits: number[] = [];
  for (const d of kind === 'wall' ? [0] : beside.slice(0, 5)) for (const sg of [1, -1]) for (const i of onLine(sg * (kind === 'wall' ? 0 : width / 2 + d))) if (!hits.includes(i)) hits.push(i);
  if (kind === 'wall') for (const al of within) for (const i of onLine(al)) if (!hits.includes(i)) hits.push(i);
  const faceOf = (i: number, k: 1 | -1) => dot([B[i].c[0] - mid[0], B[i].c[2] - mid[1]], n) + k * reach(B[i], n);
  const med = (v: number[]) => { const q = [...v].sort((x, y) => x - y); return q.length ? q[(q.length - 1) >> 1] : 0; };
  const W = way.wall ?? {};
  const face = say('wall.face', W.face, () => med(hits.map(i => faceOf(i, 1))));
  const thickness = say('wall.thickness', W.thickness, () => hits.length ? r2(med(hits.map(i => faceOf(i, 1))) - med(hits.map(i => faceOf(i, -1)))) : 0);
  const back = face - thickness;
  // (its top over the anchor: the lintel there, else the lower of the two sides — whatever stands on the line and is thin across it, any height, ceilings apart)
  const column = (al: number) => { const p = P(al, 0); return over(p[0], p[1], all).filter(i => !flag(B[i], 'NoPrimary') && !flag(B[i], 'Glass') && reach(B[i], n) <= K.wallHalf && B[i].c[1] + B[i].h[1] > 0.3); };
  const topAt = (al: number) => Math.max(0, ...column(al).map(i => B[i].c[1] + B[i].h[1]));
  const top = say('wall.top', W.top, () => { const m = topAt(0); return r2(m > 0 ? m : Math.min(topAt(width / 2 + 0.3), topAt(-width / 2 - 0.3))); });
  if (got && kind !== 'gap' && !hits.length) problems.push('the anchor is not on a wall: nothing stands on its line beside it');
  if (got && kind === 'gap' && onLine(width / 2 + 0.15).length + onLine(-width / 2 - 0.15).length === 0) problems.push('the gap has no post: nothing stands on its line at either end');

  // THE SIDE and THE PLACES
  const off = face + K.offFace, samOff = face + K.samOffFace;
  const line = (sd: 1 | -1) => kitPlanSlots(a, t, width, n, sd, off, samOff, free);
  const leftOf = (sd: 1 | -1) => (n[0] * t[1] - n[1] * t[0]) * sd > 0;   // (under the worked-out camera: the stack falls left of the anchor where n × s is positive — the records office's hand)
  const side: 1 | -1 = say('side', way.side, () => { const p = line(1).stepped, m = line(-1).stepped; return p < m ? 1 : m < p ? -1 : leftOf(1) ? 1 : leftOf(-1) ? -1 : 1; });
  // (`passed`: the places the chosen side's line passed over, in the order it asked — an added piece standing on one is named below)
  const passed: V2[] = [], s: V2 = [t[0] * side, t[1] * side], L = kitPlanSlots(a, t, width, n, side, off, samOff, (x, z) => { const ok = free(x, z); if (!ok) passed.push([x, z]); return ok; });
  // (an authored stack slot is spread from the head of the stack to the picture's spacing, as the child spreads it: by gap over what the file was laid out at)
  const A = way.slots ?? [], head = A[1];
  const laid = A[1] && A[2] ? Math.abs(dot([A[2][0] - A[1][0], A[2][1] - A[1][1]], s)) : K.gap;
  const slotGap = say('slotGap', way.slotGap, () => r2(laid));
  // (A PLACE CAN BE WRITTEN ALONE: a `null` in `slots` — or a list that stops short — leaves that place to the line worked out above)
  const spread = (i: number): [number, number, number] | undefined => { const p = A[i] ?? undefined; if (!p || !head || i < 2 || i > 3 || slotGap >= K.gap || slotGap <= 0) return p;
    const k = K.gap / slotGap - 1, al = dot([p[0] - head[0], p[1] - head[1]], s); return [p[0] + s[0] * al * k, p[1] + s[1] * al * k, p[2]]; };
  const slotSrc: KitPlanSrc[] = [], slots = L.slots.map((w, i): [number, number, number] => { const p = spread(i); slotSrc.push(p ? 'authored' : 'derived'); return p ? [p[0], p[1], p[2]] : w; });
  src.slots = slotSrc.every(x => x === 'authored') ? 'authored' : 'derived';
  // (ONLY THE PLACES LEFT TO THE LINE COUNT: a man the way writes stands where he is written, whatever the line stepped over to find a place it then did not
  //  use — the whole line's count said "N places stepped over" of a way that had written the stepped place itself, and nothing the level could write cleared it)
  const stepped = L.steps.reduce((q, k, i) => q + (slotSrc[i] === 'derived' ? k : 0), 0);
  let fit = 0;
  if (got) slots.forEach((p, i) => { const why: string[] = [], depth = dot([p[0] - mid[0], p[1] - mid[1]], n);
    if (!free(p[0], p[1])) why.push('not on free floor');
    const inBox = F.solid.find(j => gapTo(B[j], p[0], p[1]) < K.man); if (inBox !== undefined) why.push(gapTo(B[inBox], p[0], p[1]) < 0.02 ? `inside the box ${B[inBox].id}` : `within a body of the box ${B[inBox].id}`);
    if (depth < face + K.man) why.push(depth < back ? 'on the far side of the wall' : 'inside the wall');
    for (let j = 0; j < i; j++) { const d = Math.hypot(p[0] - slots[j][0], p[1] - slots[j][1]), need = i >= 2 && i <= 3 && j === i - 1 ? K.gap - 0.01 : K.apart; if (d < need) why.push(`${r2(d)} m from place ${j} (${r2(need)} m at least)`); }
    if (why.length) problems.push(`place ${i} (${r2(p[0])}, ${r2(p[1])}): ${why.join(', ')}`); else fit++; });
  const pastAt = problems.length;   // (A STACK MAN STANDS ON THE WALL HE STACKS ON — asked below, once what is out of the picture is known; said HERE, where it always was)
  if (got && stepped) problems.push(`no free floor for five in line: ${stepped} place${stepped === 1 ? '' : 's'} stepped over`);
  // (A WRITTEN STACK PLACE AND THE DOOR ITSELF: the worked-out line starts `jamb` past the jamb and `offFace` off the wall — outside the leaf's sweep by
  //  construction; a WRITTEN place is taken as it is, and could be put anywhere down to the leaf. Two things are said of places 1‥3 where the way writes
  //  them: IN THE OPENING — past the jamb the wrong way, his feet before the doorway the stack stands BESIDE (a door or a gap) — and INSIDE THE LEAF'S
  //  SWING — on the team's side, nearer the hinge than the leaf is wide and within the leaf's stop ON THAT SIDE of its shut line: the door opens onto
  //  him. THE STOP IS THE TEAM'S SIDE'S OWN (doors.ts: angles of the sign of `into = n0 × swing`, n0 = the shut line turned a quarter left — `turn`
  //  here is that sign for the team's side): the door's `maxAngle` where the team stands on the positive side, minus its `minAngle` on the other, else
  //  doors.ts's 1.92 rad — never the wider of the two: a door that cannot open toward the team (`maxAngle: 0` on their side) or stops at a right angle
  //  short of the place said "inside the leaf's swing" of a place the leaf never reaches (the review, 10-16). A door whose written `swing` is away
  //  from the team is not asked; one with none is dealt its side by the game (an outside door toward the open air — toward a team in the yard), so it
  //  is asked. PAST THE FAR JAMB — further the wrong way than the anchor is wide, on Sam's side of it — is said as that, not as "inside the opening".)
  if (got && kind !== 'wall') { const near: V2 = side > 0 ? b : a, turn = D ? (n[0] * -t[1] + n[1] * t[0] >= 0 ? 1 : -1) : 0, stop = D ? (turn > 0 ? D.maxAngle ?? K.leafStop : -(D.minAngle ?? -K.leafStop)) : 0;
    for (let i = 1; i <= 3; i++) { if (slotSrc[i] !== 'authored') continue; const p = slots[i], al = dot([p[0] - near[0], p[1] - near[1]], s), v: V2 = [p[0] - a[0], p[1] - a[1]], dh = Math.hypot(v[0], v[1]), o = dot(v, n);
      if (al < -width) problems.push(`place ${i} (${r2(p[0])}, ${r2(p[1])}) is written ${r2(-al - width)} m PAST THE FAR JAMB, on Sam's side of the ${kind}: the stack stands on the other side of it, from ${K.jamb} m past its own jamb — move it across, or write the way's \`side\``);
      else if (al < 0) problems.push(`place ${i} (${r2(p[0])}, ${r2(p[1])}) is written ${r2(-al)} m INSIDE the opening (past the jamb the wrong way): the stack stands beside the ${kind}, from ${K.jamb} m past its jamb — move it along the wall`);
      else if (kind === 'door' && D && (D.swing === undefined || D.swing === turn) && stop > 0 && o > 0 && dh < width - 0.005 && Math.atan2(o, dot(v, t)) <= stop)
        problems.push(`place ${i} (${r2(p[0])}, ${r2(p[1])}) is written inside the leaf's swing (${r2(dh)} m from the hinge of a ${r2(width)} m leaf${D.swing === undefined ? ', should it open toward the team' : ''}): the door opens onto him — move it out of the leaf's reach`); } }
  // (THE FOURTH MAN IS BEHIND SAM: the card switch — host/kitView.ts rotate() — walks him round Sam's yard side to his acting place by Sam's jamb and back, and
  //  never across the anchor. The worked-out place is always there; one WRITTEN nearer the anchor than Sam, or on the stack's side, is said)
  { const al = (i: number) => dot([slots[i][0] - mid[0], slots[i][1] - mid[1]], s); if (got && (slotSrc[4] === 'authored' || slotSrc[0] === 'authored') && al(4) > al(0) - 0.01)
      problems.push(`place 4 (${r2(slots[4][0])}, ${r2(slots[4][1])}) is not behind Sam (${r2(al(4))} m along the wall toward the stack, Sam ${r2(al(0))}): the card switch walks the fourth man round Sam's yard side and never across the anchor — write him past Sam, away from the anchor`); }

  // THE LANE beside the stack (the card switch), the free floor in front, the room behind
  const laneOut = say('lane', way.lane, () => K.lane), l0 = dot([slots[1][0] - mid[0], slots[1][1] - mid[1]], s), l1 = dot([slots[3][0] - mid[0], slots[3][1] - mid[1]], s) + K.gap, lo = dot([slots[1][0] - mid[0], slots[1][1] - mid[1]], n) + laneOut;
  const laneAt = (al: number): V2 => [mid[0] + s[0] * al + n[0] * lo, mid[1] + s[1] * al + n[1] * lo];
  let clearM = 0, laneFree = true; for (let al = l0; al <= l1 + 1e-6; al += K.step) { const p = laneAt(al); if (!free(p[0], p[1])) { laneFree = false; break; } clearM = al - l0; }
  const walk = (from: number, dir: 1 | -1) => { let last = 0, seen = false;   // (free floor from `from` m off the anchor's line, going out (1) or in (-1): how far from the line it runs)
    for (let d = 0; d <= K.reach; d += K.step) { const o = from + dir * d, p = P(0, o), ok = free(p[0], p[1]); if (ok) { seen = true; last = Math.abs(o); } else if (seen || d > K.sill) break; }
    return r2(last); };
  const out = say('out', way.out, () => Math.max(0, r2(walk(face + K.man, 1) - face)));
  const behind = got ? walk(back - 0.05, -1) : 0;
  const inside = say('inside', way.inside, () => kind === 'wall' ? 0 : behind), beyond = kind === 'wall' ? Math.max(0, r2(behind + back)) : 0;
  if (got && kind !== 'wall' && inside < K.inM) problems.push(`no room behind the anchor for a throw: ${inside} m of floor (a can is put ${K.inM} m in, ${K.inMin} at the nearest)`);
  if (got && !laneFree) problems.push(`the lane beside the stack is shut ${r2(clearM)} m along (the card switch walks straight instead)`);

  // THE CAMERA's pin: into the wall, turned toward the stack; at the middle of the five places
  const lookXZ: V2 = [slots.reduce((q, p) => q + p[0], 0) / slots.length, slots.reduce((q, p) => q + p[1], 0) / slots.length], alongs = slots.map(p => dot([p[0], p[1]], s)), len = Math.max(...alongs) - Math.min(...alongs);
  const pin: { yaw: number; pitch: number; dist?: number } = say('cam', way.pin, () => { const c = Math.cos(K.yaw), sn = Math.sin(K.yaw), f: V2 = [-n[0] * c + s[0] * sn, -n[1] * c + s[1] * sn]; return { yaw: Math.atan2(-f[0], -f[1]), pitch: K.pitch }; });
  const dist = pin.dist ?? K.dist + K.distPerM * len, fw: Vec3 = [-Math.sin(pin.yaw) * Math.cos(pin.pitch), -Math.sin(pin.pitch), -Math.cos(pin.yaw) * Math.cos(pin.pitch)];
  const cam = { look: [lookXZ[0], 1, lookXZ[1]] as Vec3, yaw: pin.yaw, pitch: pin.pitch, dist, pos: [lookXZ[0] - fw[0] * dist, 1 - fw[1] * dist, lookXZ[1] - fw[2] * dist] as Vec3 };
  const right: V2 = [Math.cos(pin.yaw), -Math.sin(pin.yaw)];   // (game/camera.ts planarBasis: right = [-f.z, f.x] of the planar forward [-sin yaw, -cos yaw])
  const hand: 'left' | 'right' = say('hand', way.hand, () => dot(s, right) < 0 ? 'left' : 'right');

  // A PANE to shoot through: glass at a gun's height, a free place to stand on the team's side of it, open air beyond
  const pane = ((): KitViewPlanned['pane'] => {
    if (way.pane === false) { src.pane = 'authored'; return null; }
    const asked = way.pane ? way.pane.box : undefined; src.pane = asked !== undefined ? 'authored' : 'derived';
    let best: KitViewPlanned['pane'] = null, unplayable = false;
    // (NOT WRITTEN: the planner named the pane nearest any of the five places, in whatever wall — the child's gun row never looked at that one. Its own
    //  filter and its own order, so the pane said here is the pane it tries first: in the anchor's wall, within `paneAlong`, the nearest along the wall)
    B.forEach((g, i) => { if (!flag(g, 'Glass') || (asked !== undefined && g.id !== asked)) return;
      const gl = dot([g.c[0] - mid[0], g.c[2] - mid[1]], s), go = dot([g.c[0] - mid[0], g.c[2] - mid[1]], n);
      // (WRITTEN, the same tests: the child's gun row puts every pane through them, the way's own too — one that fails them is never shot through, the burst
      //  goes through the doorway instead. Written data that cannot be played is a problem, as a place in a wall is; the plan's pane is then none)
      const no = [Math.abs(go) > K.paneWall ? `${r2(Math.abs(go))} m off the anchor's line (${K.paneWall} m at most)` : '', Math.abs(gl) > K.paneAlong ? `${r2(Math.abs(gl))} m along the wall from the anchor's middle (${K.paneAlong} m at most)` : '',
        g.c[1] - g.h[1] > K.paneY[0] ? `its bottom ${r2(g.c[1] - g.h[1])} m up (${K.paneY[0]} m at most)` : '', g.c[1] + g.h[1] < K.paneY[1] ? `its top ${r2(g.c[1] + g.h[1])} m up (${K.paneY[1]} m at least)` : ''].filter(x => x);
      if (no.length) { if (asked !== undefined && !unplayable) { unplayable = true; problems.push(`the pane '${asked}' is not one the gun row shoots through: ${no.join(', ')} — a pane is glass in the anchor's own wall, at a gun's height: write that box, or \`false\``); } return; }
      const c = Math.cos(g.yaw ?? 0), sn = Math.sin(g.yaw ?? 0), thinX = g.h[0] < g.h[2], pn0: V2 = thinX ? [c, -sn] : [sn, c], pt: V2 = [-pn0[1], pn0[0]], half = thinX ? g.h[2] : g.h[0];
      const k = dot([R[0] - g.c[0], R[1] - g.c[2]], pn0) >= 0 ? 1 : -1, pn: V2 = [pn0[0] * k, pn0[1] * k];
      const us: number[] = [0]; for (let u = 0.3; u <= half - 0.2; u += 0.3) us.push(u, -u);
      const given = way.pane && way.pane.stand;
      let stand: [number, number, number] | null = given ? [given[0], given[1], given[2]] : null;
      for (const d of K.paneOff) { if (stand) break; for (const u of us) { const x = g.c[0] + pn[0] * d + pt[0] * u, z = g.c[2] + pn[1] * d + pt[1] * u;
        if (!free(x, z) || !clear(x, z, K.man) || F.solid.some(j => j !== i && segBox(B[j], [x, K.gunY, z], [g.c[0] + pt[0] * u, K.gunY, g.c[2] + pt[1] * u]))) continue;
        stand = [r2(x), r2(z), Math.round(Math.atan2(-pn[0], -pn[1]) / RAD)]; break; } }
      if (!stand) return;
      const from = Math.min(...slots.map(p => Math.hypot(p[0] - stand![0], p[1] - stand![1])));
      if (!best || Math.abs(gl) < Math.abs(best.along)) best = { box: g.id, index: i, at: [g.c[0], g.c[1], g.c[2]], width: r2(half * 2), n: pn, stand, from: r2(from), onWall: Math.abs(dot([g.c[0] - mid[0], g.c[2] - mid[1]], n)) < Math.max(0.3, thickness) && Math.abs(dot(pn0, n)) > 0.9, along: r2(gl) }; });
    if (asked !== undefined && !best && !unplayable) problems.push(`no pane '${asked}' a man can stand at`);
    return best;
  })();

  // WHAT STANDS IN THE CAMERA'S WAY: every box a line from the camera to a man (or to the anchor) meets — paint, glass and what the camera never draws apart
  const show = new Set(way.show ?? []), marks: Vec3[] = [];
  for (const p of slots) for (const y of K.heights) for (const [ox, oz] of [[0, 0], [K.man, 0], [-K.man, 0], [0, K.man], [0, -K.man]]) marks.push([p[0] + ox, y, p[1] + oz]);
  const nMen = marks.length;   // (the marks so far are the MEN's own: what an added piece is asked about below)
  // (THE WAY'S OWN ADDED PIECES — `add.boxes`: written for this picture, so SHOWN in it. Never an occluder, never sunk by what is worked out here: a piece
  //  the level's author stood by the door went under the ground, without a word, wherever the camera's line met it. Where one does stand in the men's way
  //  it is a PROBLEM that names it, below — the author's to move)
  const added = new Set<string>(way.set === undefined ? (way.add?.boxes ?? []).map(bx => bx.id) : []);
  { const p = P(0, face + K.man); for (const y of K.heights) marks.push([p[0], y, p[1]]); }   // (the anchor, from just in front of its face)
  // (…and THE STAGE's floor: from the face out past the lane, from a place behind the stack's last man to Sam's side — where the men walk for a beat)
  { const al = slots.map(p => dot([p[0] - mid[0], p[1] - mid[1]], s)), o1 = Math.max(lo, dot([slots[0][0] - mid[0], slots[0][1] - mid[1]], n) + K.round) + K.stageOut; for (let x = Math.min(...al) - 0.5; x <= l1 + 1e-6; x += 0.5) for (let o = face + K.man; o <= o1 + 1e-6; o += 0.5) for (const y of [0.05, K.heights[1]]) marks.push([mid[0] + s[0] * x + n[0] * o, y, mid[1] + s[1] * x + n[1] * o]); }
  const solidTo = (bx: BoxData) => bx.c[1] + bx.h[1] > K.lowTop && !flag(bx, 'NoPrimary') && !flag(bx, 'Glass'), shown = (bx: BoxData) => show.has(bx.id) || (bx.group !== undefined && show.has(bx.group));
  const drawn = (bx: BoxData) => solidTo(bx) && !shown(bx) && !added.has(bx.id);
  const thing = (bx: BoxData) => bx.c[1] + bx.h[1] <= K.thingTop && Math.max(bx.h[0], bx.h[2]) <= K.thingHalf;
  const occluders: KitViewPlanned['occluders'] = [], inWay = new Set<number>();
  if (got) B.forEach((bx, i) => { if (drawn(bx) && marks.some(m => segBox(bx, cam.pos, m))) inWay.add(i); });
  // (a THING in the way goes whole: the boxes of its group that touch it, and theirs — a car's wheels and mirrors with its body; a wall is never grown)
  const touch = (p: BoxData, q: BoxData) => [0, 1, 2].every(ax => { const ep = ax === 1 ? p.h[1] : Math.hypot(p.h[0], p.h[2]), eq = ax === 1 ? q.h[1] : Math.hypot(q.h[0], q.h[2]); return Math.abs(p.c[ax] - q.c[ax]) <= ep + eq + 0.03; }) && gapBoxes(p, q) <= 0.03;
  const part = new Set<number>(); let grew = true; const seeds = [...inWay].filter(i => thing(B[i]));
  while (grew) { grew = false; B.forEach((bx, i) => { if (inWay.has(i) || part.has(i) || !drawn(bx) || !thing(bx)) return; if ([...seeds, ...part].some(j => B[j].group === bx.group && touch(B[j], bx))) { part.add(i); grew = true; } }); }
  B.forEach((bx, i) => { if (inWay.has(i) || part.has(i)) occluders.push({ id: bx.id, index: i, group: bx.group ?? '', why: inWay.has(i) ? 'line' : 'part' }); });
  // WHAT GOES OUT OF THE PICTURE. AN AUTHORED `hide` WINS OUTRIGHT (the head: authored keys always win): the boxes it names and nothing else — `hide: []` is
  // "nothing goes", and what still stands in the camera's line is the level's to show. NO `hide`: the occluders worked out above go (less `show`) — and one
  // that is NOT A THING is said as a problem, for sinking it takes a piece of the building out of the picture: a wall or a tall or long box (`thingTop`,
  // `thingHalf`), a box that carries a door (a frame, a lintel) or a lamp (its post, its fitting). The way then writes its `hide`, a `pin`, or stands on a set.
  // `hideMore` IS ADDED, NEVER INSTEAD: the boxes it names go as well — with the worked-out occluders where no `hide` is written (the list is still the plan's:
  // `src.hide` 'derived'), with the written `hide` where one is. One thing more no longer means copying the plan's list out by hand.
  const hideAuth = way.hide !== undefined; src.hide = hideAuth ? 'authored' : 'derived';
  const ids = named, paint = new Set(way.hidePaint ?? []), hidden: number[] = [];
  B.forEach((bx, i) => { const named = ids.has(bx.id) || (bx.group !== undefined && (ids.has(bx.group) || (paint.has(bx.group) && bx.h[1] < 0.01))); if (named || (!hideAuth && occluders.some(o => o.index === i))) hidden.push(i); });
  // A STACK MAN STANDS ON THE WALL HE STACKS ON: a worked-out wall place (1 ‥ 3: the line runs `jamb` + k × `gap` out from the jamb whatever the wall's
  // length — and 4, the fourth man, the same line run the other way behind Sam) past the END of the anchor's wall stands in the open, and every row passed —
  // a dock door 2.4 m from its wall's corner put the third man 0.2 m past it. Asked where he stands along the wall: something must stand on the anchor's
  // line there that comes DOWN TO HIS SHOULDER (`wallFoot`: a header beam alone, 2.6 m up over an open 3 m gateway, was a wall to this test and the third
  // man stood in the gateway without a word; a window passes by its pane or its sill — glass is a wall to stand at —, a ceiling does not) — thin or thick (the wall that turns the corner IS the wall's
  // end) — or ANOTHER DOOR of the level on the line (a neighbouring door is a lintel and a leaf: wall to the eye, no box below the shoulder). WHAT THE
  // PLAN ITSELF TAKES OUT OF THE PICTURE IS NO WALL TO STAND AT: `hidden` — the way's `hide` / `hideMore`, the occluders that go, the child's first pass.
  // NOT TIGHTENED to fit: `gap` is the picture's own (KIT_VIEW_STAGE.gap — at 0.9 two men overlap in the image; the step back and the lane are laid by it).
  // A place the way WRITES is the author's word, never asked; a GAP's stack stands off a post, not a wall, and is not asked either.
  if (got && kind !== 'gap' && hits.length) { const gone = new Set(hidden), said: string[] = [];
    const doorAt = (p: V2) => level.doors.some(dr => { if (dr === D) return false; const u: V2 = [Math.cos(dr.closedDir), Math.sin(dr.closedDir)], v: V2 = [p[0] - dr.hinge[0], p[1] - dr.hinge[1]], along = dot(v, u); return along > -0.05 && along < dr.width + 0.05 && Math.abs(v[1] * u[0] - v[0] * u[1]) < K.doorOn; });
    const wallAt = (x: number) => { const p = P(x, 0); return doorAt(p) || over(p[0], p[1], all).some(j => !gone.has(j) && !flag(B[j], 'NoPrimary') && B[j].c[1] + B[j].h[1] > 0.3 && B[j].c[1] - B[j].h[1] < K.wallFoot); };
    for (let i = 1; i <= 4; i++) { if (slotSrc[i] !== 'derived') continue;
      const al = dot([slots[i][0] - mid[0], slots[i][1] - mid[1]], t); if (wallAt(al)) continue;
      const lim = Math.max(0.02, Math.abs(al) - width / 2); let past = 0.01; while (past < lim && !wallAt(al - Math.sign(al) * past)) past += 0.01;   // (back toward the anchor, no further than its own jamb)
      said.push(i < 4 ? `place ${i} (${r2(slots[i][0])}, ${r2(slots[i][1])}) is ${r2(past + 0.02)} m past the end of the wall the stack stands on: write the way's \`side\` (the stack on the other side of the anchor) or his place in \`slots\` (a written place is taken as it is: \`null\` leaves the others to the plan)`
        : `place 4 (${r2(slots[4][0])}, ${r2(slots[4][1])}) is ${r2(past + 0.02)} m past the end of the wall the fourth man stands at, behind Sam: write the way's \`side\` (Sam and he on the other side of the anchor) or his place in \`slots\` (a written place is taken as it is: \`null\` leaves the others to the plan)`); }
    problems.splice(pastAt, 0, ...said); }
  if (!hideAuth) { const ends = level.doors.flatMap((dr): V2[] => { const dt: V2 = [Math.cos(dr.closedDir), Math.sin(dr.closedDir)]; return [[dr.hinge[0], dr.hinge[1]], [dr.hinge[0] + dt[0] * dr.width / 2, dr.hinge[1] + dt[1] * dr.width / 2], [dr.hinge[0] + dt[0] * dr.width, dr.hinge[1] + dt[1] * dr.width]]; });
    const why = (bx: BoxData): string | null => !thing(bx) ? (bx.c[1] + bx.h[1] > K.thingTop ? `${r2(bx.c[1] + bx.h[1])} m tall` : `${r2(2 * Math.max(bx.h[0], bx.h[2]))} m long`)
      : ends.some(e => gapTo(bx, e[0], e[1]) < 0.12) ? 'it carries a door'
      : (level.lights ?? []).some(l => l.kind !== 'dir' && gapTo(bx, l.pos[0], l.pos[2]) < 0.2 && l.pos[1] >= bx.c[1] - bx.h[1] - 0.4 && l.pos[1] <= bx.c[1] + bx.h[1] + 0.4) ? 'it carries a lamp' : null;
    const bad = occluders.filter(o => !named.has(o.id) && !hideMore.has(o.group)).map(o => ({ o, y: why(B[o.index]) })).filter(x => x.y !== null);
    if (bad.length) problems.push(`${KIT_PLAN_IN_WAY}: ${bad.slice(0, 6).map(x => `${x.o.id}${x.o.group ? ` (${x.o.group})` : ''}: ${x.y}`).join(', ')}${bad.length > 6 ? `, … ${bad.length - 6} more` : ''} — write the way's \`hide\` (what goes; [] = nothing), a \`pin\`, or stand it on a set`); }
  // AN ADDED PIECE IN THE MEN'S WAY (authored data wins over what is worked out, and is never dropped without a word): one that still stands — an authored
  // `hide` naming it takes it, as it takes anything — and is met by a line from the camera to a MAN, or stands on a place the line of places passed over for
  // a man it places, is said BY NAME. (A way's `show` with its name is the author's word that it stays in front of him: the first is then not said.)
  // (…only where it IS the thing on the place: a place the floor shuts WITHOUT the added pieces — a wall's, a crate of the level's — is that box's, and an
  //  added piece that merely stands within a body of it was blamed for it. The floor without them is baked once, and only when a piece is that near.)
  if (got && added.size) { const reach = K.nav.r + K.nav.cell * 0.71, mine: V2[] = []; let k = 0, F0: KitPlanFloor | null = null;
    const bare = () => F0 ??= kitPlanFloor(B, new Set([...sunk, ...B.map((bx, i) => added.has(bx.id) ? i : -1).filter(i => i >= 0)])); L.steps.forEach((nSt, i) => { if (slotSrc[i] === 'derived') mine.push(...passed.slice(k, k + nSt)); k += nSt; });
    B.forEach((bx, i) => { if (!added.has(bx.id) || hidden.includes(i)) return;
      if (solidTo(bx) && !shown(bx) && marks.slice(0, nMen).some(m => segBox(bx, cam.pos, m))) problems.push(`the added '${bx.id}' hides the stack: move it (it stands between the camera and a man; the way's \`show\` with its name keeps it there, in front of him)`);
      const over = F.solid.includes(i) ? mine.filter(p => gapTo(bx, p[0], p[1]) < reach && !bare().blocked(p[0], p[1])).length : 0;
      if (over) problems.push(`the added '${bx.id}' stands on the line of places (${over} stepped over it): move it, or write the men's \`slots\``); }); }
  // …AND ITS LOOSE PROPS (the file's `props` are no boxes: a `hide` of the scribe's pitch took his table and left his stool standing alone on the pavement)
  const Pr = level.props ?? [], ofName = (id: string, nm: string) => id === nm || id.startsWith(nm + '.'), hiddenProps: number[] = [];
  Pr.forEach((p, i) => { if ([...show].some(nm => ofName(p.id, nm))) return;
    if ([...ids].some(nm => ofName(p.id, nm)) || (!hideAuth && hidden.some(j => B[j].group !== undefined && B[j].c[1] + B[j].h[1] > K.lowTop && ofName(p.id, B[j].group!) && gapTo(B[j], p.x, p.z) <= K.propNear))) hiddenProps.push(i); });
  for (const id of [...(way.hide ?? []), ...hideMore, ...show]) if (!B.some(bx => bx.id === id || bx.group === id) && !Pr.some(p => ofName(p.id, id)) && !(level.left ?? []).some(nm => ofName(nm, id))) problems.push(`hide / show names '${id}': no box, group or prop by that name`);
  // (ONE NAME, BOTH WORDS: a name the way writes in `show` AND in `hide` / `hideMore` split the thing — its boxes went, hidden by name, and its loose props
  //  stayed, shown by name: a yard's stools on bare ground. Said, never guessed at)
  { const both = [...new Set([...(way.hide ?? []), ...hideMore])].filter(id => show.has(id));
    if (both.length) problems.push(`'${both.join("', '")}' ${both.length === 1 ? 'is' : 'are'} written in \`show\` and in \`hide\` / \`hideMore\`: its boxes would go and its loose props stay — write the name in one of the two`); }

  // UNDER A COVER, and the lamps: the porch lamp from the wall's top, the fill from the free floor in front
  // (the game's own roofs — game/weather.ts roofsOf: a slab in the ceiling's height band, 0.9 m across both ways, the four largest — are where no rain falls)
  const roofs = B.filter(bx => bx.c[1] - bx.h[1] >= K.roof.y0 && bx.c[1] + bx.h[1] <= K.roof.y1 && bx.h[0] >= K.roof.half && bx.h[2] >= K.roof.half).sort((p, q) => q.h[0] * q.h[2] - p.h[0] * p.h[2]).slice(0, K.roof.most);
  const nCov = slots.filter(p => roofs.some(bx => Math.abs(p[0] - bx.c[0]) <= bx.h[0] + K.roof.pad && Math.abs(p[1] - bx.c[2]) <= bx.h[2] + K.roof.pad)).length;
  const indoors = say('indoors', way.indoors, () => nCov * 2 > slots.length);
  // (A GAP has no wall over its middle — `top` there is the lower of its two sides, and a lamp hung at along 0 under it hangs in the open air. Its lamp and
  //  the lamp's box go on what CAN carry them: the wall or post at the STACK'S end of the opening, else the other end's, `porchHand` past the jamb and under
  //  THAT wall's own top; neither end `porchCarry` tall: the light alone, overhead, and no box. An authored `wall.top` is the stack end's. A door and a
  //  stretch of wall: along 0, under `top`, as ever.)
  const carrier = kind !== 'gap' ? { al: 0, top } : W.top !== undefined ? { al: top > 0 ? r2(width / 2 + K.porchHand) : 0, top }
    : ([side, -side] as const).flatMap(sd => [K.porchHand, K.porchHand / 2].map(h => ({ al: r2(sd * side * (width / 2 + h)), top: r2(topAt(sd * (width / 2 + h))) }))).find(c => c.top >= K.porchCarry) ?? { al: 0, top: 0 };
  const O = way.light ?? {}, up = carrier.top > 0 ? Math.min(K.porchUp, r2(carrier.top - K.porchUnder)) : K.porchUp, world = (o: Vec3): Vec3 => [mid[0] + s[0] * o[0] + n[0] * o[1], o[2], mid[1] + s[1] * o[0] + n[1] * o[1]];
  const pOff: Vec3 = say('porch.offset', O.porch?.offset, () => [carrier.al, r2(face + K.porchOut), up]), pAim: Vec3 = O.porch?.aim ?? [K.porchAim[0], K.porchAim[1], K.porchAim[2]];
  const fixAt: Vec3 | null = say('porch.fixture', O.porch?.fixture?.at as Vec3 | undefined, () => carrier.top > 0 ? [carrier.al, r2(face + K.fixOut), r2(up - K.fixDown)] : null as unknown as Vec3);
  const fOff: Vec3 = say('fill.offset', O.fill?.offset, () => [0, r2(Math.max(face + 1, Math.min(face + K.fillOut, face + out - K.fillBack))), K.fillUp]), fAim: Vec3 = O.fill?.aim ?? [K.fillAim[0], K.fillAim[1], K.fillAim[2]];
  const lamps = { porch: { offset: pOff, aim: pAim, pos: world(pOff), fixture: fixAt ? { at: fixAt, pos: world(fixAt) } : null }, fill: { offset: fOff, aim: fAim, pos: world(fOff) } };
  if (got && kind !== 'gap' && top > 0 && top < K.porchUp - 0.4) problems.push(`the wall at the anchor is ${top} m tall: the porch lamp hangs at ${up} m`);
  const keep0 = say('keepLights', way.keepLights, () => [...new Set((level.lights ?? []).filter(l => l.kind !== 'dir' && l.group !== 'exterior' && !covered(l.pos[0], l.pos[2], l.pos[1])).map(l => l.group))].sort());
  // (…and, THE WAY'S WORD FOR IT — `litInside`: the room behind the anchor. Not the default: a staged door with a lit room behind it would change its picture)
  // (…and THE LAMPS THE WAY ADDS — `add.lamps`: hung for the picture, so lit in it, whatever their group)
  const more = [...(way.litInside ? kitPlanLitInside(level.lights ?? [], mid, n, back) : []), ...(way.set === undefined ? way.add?.lamps ?? [] : [])].map(l => l.group).filter(g => g !== 'exterior');
  const keepLights = more.length ? [...new Set([...keep0, ...more])].sort() : keep0;
  // (`dayLights` names the way's OWN lamps — its set's lights, here the geometry's; the lamps it adds: a name that is none of them keeps nothing burning)
  { const own = way.set !== undefined ? level.lights ?? [] : way.add?.lamps ?? []; for (const nm of way.dayLights ?? []) if (!own.some(l => l.kind !== 'dir' && (l.id === nm || l.group === nm))) problems.push(`dayLights names '${nm}': no lamp of the way's own (its set's lights, its \`add.lamps\`) by that id or group`); }

  const DD = kind === 'door' ? D : undefined;
  return {
    anchor: { kind, door: DD ? DD.id : null, a, b, mid, t, n, width, steel: !!DD?.steel, locked: !!DD?.locked, exterior: !!DD?.exterior },
    ref: R, side, s, hand, wall: { face: r2(face), back: r2(back), thickness: r2(thickness), top, boxes: hits.map(i => B[i].id) },
    slots: slots.map(p => [r2(p[0]), r2(p[1]), Math.round(p[2] * 10) / 10]), slotSrc, fit, stepped, slotGap,
    lane: { out: laneOut, a: laneAt(l0), b: laneAt(l1), free: laneFree, clearM: r2(clearM) }, out, inside, beyond, pane, occluders, hidden, hiddenProps, lamps, keepLights, indoors, covered: nCov, cam, src, problems,
  };
}
