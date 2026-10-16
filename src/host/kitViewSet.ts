// THE KIT VIEW'S SET LOADER (the Team & kit picture, src/host/kitView.ts): `kitViewSetLevel(levelData, way) → levelData'`. Where the way being staged names
// a BESPOKE SET (scene/scenarios.ts KitViewSet — the owner, 10-15: "feel free to make a bespoke set for the gear screen if there isn't a good existing one in
// the level already. it should then just show off the vibe of the level / be recognizable"), the `?kitview` page loads the SET's boxes, doors and lights
// INSTEAD of the level's geometry and keeps what makes the level the level. main.ts bootLevel calls it between parseLevelData and loadLevel, under `?kitview`
// only; a way with no set — every level today — gets the very object it handed in, so nothing downstream can differ.
//
// PURE, as the planner beside it (kitViewPlan.ts): plain level data in, plain level data out; no Math.random, no clock, no DOM, no import of src/game (one
// runtime import cycle) nor of src/host/kitView.ts. Nothing of the data handed in is written to: what is kept is carried by reference (loadLevel copies).
//
// KEPT, the level's own: `name` (what the weather's snow levels and the look's door paint are keyed by), `version`, `meta`, `floors`, `materials` (the set's
// boxes take the level's paint by name: in a look file, the look's), `surfaces` (the footsteps), `sky`, `daylight` (less the lamps it names that are gone),
// every DIRECTIONAL light (the `moon` the picture's night is read off, a sun) and `scenarios.issue` (a kit, no place). The hour and the weather are the
// query's and are not touched here.
// SWAPPED: `boxes`, `doors` and the lamps are the set's. Box i of the set is box i of the level that loads (kitViewPlan's `hidden` indexes hold).
// GONE: props, switchables, routes (so no shift of guards), chokepoints, civilians, volumes, devices, vents, connectors, beacons, the clear and breach
// plans, and every scenario block but the two below: each of them names a place in the level that is no longer there.
//
// STOOD IN — what the level format (scene/levelData.ts validateLevelData) and the room clear's own check (game/roomclear.ts checkStructure, which is not
// this file's to edit) ask of ANY level, satisfied here and nowhere else:
//   · the breaker's two boxes: two 10 cm boxes sunk 30 m under the floor, AFTER the set's boxes (KIT_SET.panel / .led) — no ray, no raster, no floor;
//   · the mission's three objectives: on the stand-in room below (nobody plays the solo thread in a picture);
//   · `scenarios.roomClear`: the picture is a room clear (the child stages on `game.roomClear`). Its `team` is the PLAN's five places on the set's `ref`
//     side (Sam, then four marks: all on free floor by the plan's own test), repeated as `starts` so that way k of the block is still way k of the game;
//     ONE room (KIT_SET.room): a 2 m square of free floor a man can walk to from the team, behind the anchor where there is any, 3 m at least from every
//     place of the team; one man on it (the child parks every defender far off and dark at every frame, as on a level); its two doors are the set's own —
//     the one leaf named twice where the set has one (the check wants a room with two ways in), and where the set has no leaf at all (an open gate, a blank
//     wall) ONE stand-in leaf in the corner of the world furthest from the anchor (KIT_SET.door): over 20 m off, never seen on a GPU.
// WHAT THIS CANNOT SEE: the page. That the set is DRAWN, that its doorway can be walked (a doorway is free floor on the nav grid only where its middle
// falls near a 0.5 m cell's middle), and anything the child still reads off a level's own names are the wiring step's and tools/qa/kitview-plan.ts's rows.
import type { LevelData, BoxData, DoorData, LightData } from '../scene/levelData';
import type { KitViewWay, KitViewSet, StructureData, TeamStart } from '../scene/scenarios';
import type { Vec3 } from '../math/vec';
import { kitViewPlan, kitPlanFloor, kitPlanAdd, KIT_PLAN, type KitViewPlanned, type V2 } from './kitViewPlan';

/** the stand-ins' names and numbers (see the head) */
export const KIT_SET = {
  panel: 'kitset_breaker_panel', led: 'kitset_breaker_led', door: 'kitset_door', room: 'kitset_room',
  /** the breaker's boxes: this far under the floor, this big (half) · the stand-in leaf: its width, in from the world's corner */
  sunk: -30, stub: 0.05, leaf: 0.86, corner: 2,
  /** the stand-in room: its half-size · the man is put this far behind the wall's far face where he can be · no nearer any place of the team than */
  roomHalf: 1, behind: 1.75, apart: 3,
};

/** THE WAY the page will stage, as the game folds the link's `way` (host/profile.ts ROOMCLEAR.way; game/roomclear.ts wayNow): absent / 1 = the level's own
 *  (0), N = its Nth, one past the last = the last; 'any' (a dealt way: no picture) = 0. `data` = the level file as parsed. */
export function kitViewWayOfQuery(way: string | null, data: Pick<LevelData, 'scenarios'>): number {
  const R = data.scenarios?.roomClear, n = R?.team ? 1 + (R.starts?.length ?? 0) : 1, w = way !== null && /^\d+$/.test(way) ? +way : 0;
  return w >= 1 ? Math.min(n, w) - 1 : 0;
}
/** THE WAY THE PICTURE STAGES, off the WHOLE link — what main.ts bootLevel lays a way's set or its `add` by, and it is the child's own answer (kitView.ts
 *  stagedWay, read off the game that started): only a ROOM CLEAR stands its team on a way in of its own — the link's `way`, folded as above. A rescue, the
 *  night breach, a quiet mission and the solo night have the level's one start: way 0, WHATEVER `way` the link still carries (a rescue's link with `way=2`
 *  laid the second way's pieces under a picture staged on the first). The kind as the page starts it (scene/scenarioList.ts specOfQuery: `roomclear`, or
 *  `squad4` with no other kind beside it); tools/qa/kitview-plan.ts F holds the two readings together over every row of the mission list. */
export function kitViewWayOfLink(q: URLSearchParams, data: Pick<LevelData, 'scenarios'>): number {
  const roomClear = q.has('roomclear') || (q.has('squad4') && !['nightbreach', 'rescue', 'quiet'].some(k => q.has(k)));
  return roomClear ? kitViewWayOfQuery(q.get('way'), data) : 0;
}
/** the set the way names, or null (no block, no such way, no `set` on it, or a set the block does not have: the level itself is staged) */
export function kitViewSetOf(data: Pick<LevelData, 'scenarios'>, way: number): { name: string; set: KitViewSet; way: KitViewWay } | null {
  const K = data.scenarios?.kitView, Y = K?.ways?.[way], T = Y?.set !== undefined ? K?.sets?.[Y.set] : undefined;
  return K && Y && T && Y.set !== undefined ? { name: Y.set, set: T, way: Y } : null;
}
/** THE QUERY a set is staged with: the picture is a room clear whatever the mission's own kind (a rescue's, the night breach's blocks are gone with the
 *  level's rooms), so the kind's key is swapped for `roomclear` and every other key — the hour, the weather, the kit — is left as it is.
 *  THE TEAM'S SIZE IS THE MISSION'S, not the room clear's reading of the same keys: a QUIET mission (the kind as scene/scenarioList.ts specOfQuery reads the
 *  link: `quiet` with no louder kind beside it) is Sam alone unless `squad=N` asks for a partner, and then ONE partner, and it never read `squad4`; a link
 *  that names NO mission (the solo night, `?solo`) is Sam alone. A room clear with no size key is Sam and two — so those two say their size outright,
 *  `squad=0` / `squad=1`. A room clear's, a rescue's, the night breach's own link: its size keys as they are. A copy: the page's own query is not written to. */
export function kitViewSetQuery(q: URLSearchParams): URLSearchParams {
  const o = new URLSearchParams(q), loud = ['roomclear', 'nightbreach', 'rescue'].some(k => q.has(k)), quiet = !loud && q.has('quiet'), none = !loud && !quiet && !q.has('squad4');
  if (quiet || none) { const n = quiet && /^[1-4]$/.test((q.get('squad') ?? '').trim()) ? 1 : 0; o.delete('squad4'); o.set('squad', String(n)); }
  for (const k of ['rescue', 'nightbreach', 'quiet', 'solo']) o.delete(k); if (!o.has('roomclear')) o.set('roomclear', ''); return o;
}
/** THE DRESS a set's men wear is THE MISSION'S, not the room clear's it is staged as (a quiet mission's men stood there in the issue dress, helmet and
 *  plates, the rifle slung in front): read off the mission's own link by the very reading above. A QUIET mission: `suit` 'quiet' — Sam and the staged team in
 *  the sneaking suit; a link that names NO mission (the solo night): `suit` null — Sam alone in it, as the plain night has him; both with the rifle across the
 *  BACK (`sling` 2, game/kitanim.ts KITANIM.sling's own word for it: what those two missions show by its 0). A loud mission's link: null — nothing is said
 *  and the scenario that is up decides, as ever. Data only: main.ts says it in ?kitview's OWN window (an iframe: its own page, its own modules — scene/look.ts
 *  setSuitAs, KITANIM.sling), on a set and nowhere else. */
export function kitViewSetDress(q: URLSearchParams): { suit: 'quiet' | null; sling: 2 } | null {
  const loud = ['roomclear', 'nightbreach', 'rescue'].some(k => q.has(k)), quiet = !loud && q.has('quiet'), none = !loud && !quiet && !q.has('squad4');
  return quiet ? { suit: 'quiet', sling: 2 } : none ? { suit: null, sling: 2 } : null;
}

/** LOOK TWINS: a set box's `material` may name alternatives, 'a|b|…' — the first the file's palette holds is the one it takes, so ONE block text serves a
 *  level's plain file and its look file (whose palette carries the look's names beside the plain ones). No '|': the box as it is, the same object. */
export function kitSetPaint(b: BoxData, materials: LevelData['materials']): BoxData {
  if (b.material === undefined || !b.material.includes('|')) return b;
  const alts = b.material.split('|'); return { ...b, material: alts.find(m => Object.prototype.hasOwnProperty.call(materials, m)) ?? alts[0] };
}

/** A LEVEL'S OWN WAY WITH A PIECE OR A LAMP MORE (scenarios.ts KitViewWay.add): the level the picture loads for `way` is the level itself with the way's
 *  boxes and lamps laid in AFTER its own (kitViewPlan.ts kitPlanAdd — box i of the level is still box i; a box's look alternatives resolved as a set's
 *  are, kitSetPaint), and NOTHING ELSE touched: the mission's kind, its men, its rooms and devices are the level's. main.ts bootLevel calls it under
 *  `?kitview` only, on a way with no set — a mission to play never comes here, so the pieces are never in it. No `add` on that way, a way on a set, no
 *  block: `data` itself, the same object. */
export function kitViewAddLevel(data: LevelData, way: number): LevelData {
  const Y = data.scenarios?.kitView?.ways?.[way]; if (!Y) return data;
  const L = kitPlanAdd({ boxes: data.boxes, doors: data.doors, lights: data.lights }, Y); if (L.boxes === data.boxes) return data;   // (nothing to lay, or laid already)
  // (…and the block that rides on it SAYS so — `add.laid`: the level validator then asks that the records are in the level, where a file's must be new to it)
  //  — AND NO OTHER WAY'S `add` RIDES ALONG: one way is laid in a level, ever, so two ways may write a piece under the same id (the same drum at two doors);
  //  left on the block, the other way's records were judged against a level that now held that id, and the picture's loadLevel refused BOTH ways' levels.
  const K = data.scenarios!.kitView!, ways = K.ways.map((y, i) => { if (i === way) return { ...y, add: { ...y.add, laid: true } }; if (y.add === undefined) return y; const { add: _gone, ...rest } = y; return rest; });
  return { ...data, boxes: (L.boxes as BoxData[]).map((b, i) => i < data.boxes.length ? b : kitSetPaint(b, data.materials)), lights: [...(L.lights as LightData[])], scenarios: { ...data.scenarios, kitView: { ...K, ways } } };
}

/** THE LEVEL THE PICTURE LOADS for `way` (an index into scenarios.kitView.ways). No set on that way: `data` itself, the same object. */
export function kitViewSetLevel(data: LevelData, way: number): LevelData {
  const hit = kitViewSetOf(data, way); if (!hit) return data;
  const T = hit.set, Y = hit.way, K = KIT_SET, N = KIT_PLAN.nav, WX = N.W * N.cell, WZ = N.H * N.cell;
  const P = kitViewPlan({ boxes: T.boxes, doors: T.doors ?? [], lights: T.lights ?? [] }, Y, [T.ref[0], T.ref[1]]);
  // the doors: the set's (the anchor's first), else one stand-in leaf in the corner furthest from the anchor
  const own: DoorData[] = [...(T.doors ?? [])].sort((a, b) => +(b.id === P.anchor.door) - +(a.id === P.anchor.door));
  const far = ([[K.corner, K.corner], [WX - K.corner, K.corner], [K.corner, WZ - K.corner], [WX - K.corner, WZ - K.corner]] as V2[]).sort((a, b) => Math.hypot(b[0] - P.anchor.mid[0], b[1] - P.anchor.mid[1]) - Math.hypot(a[0] - P.anchor.mid[0], a[1] - P.anchor.mid[1]))[0];
  const doors: DoorData[] = own.length ? (T.doors as DoorData[]) : [{ id: K.door, hinge: [far[0], far[1]], closedDir: 0, width: K.leaf }];
  const two = own.length ? [own[0].id, (own[1] ?? own[0]).id] : [K.door, K.door];
  // the team: the plan's five places
  const at = (p: readonly number[]): Vec3 => [p[0], 0, p[1]], RAD = Math.PI / 180;
  const team: TeamStart = { sam: at(P.slots[0]), samYaw: P.slots[0][2] * RAD, ops: P.slots.slice(1).map(at), opsYaw: P.slots[1][2] * RAD };
  // the stand-in room: a free cell a man can walk to from Sam's (the nav grid's own floor, four ways), nearest the spot behind the anchor
  const M = standIn(T.boxes, P), B = { x0: M.pos[0] - K.roomHalf, x1: M.pos[0] + K.roomHalf, z0: M.pos[2] - K.roomHalf, z1: M.pos[2] + K.roomHalf };
  const was = data.scenarios?.roomClear, ways = data.scenarios!.kitView!.ways;
  const roomClear: StructureData = { name: was?.name ?? data.name, team, ...(ways.length > 1 ? { starts: ways.slice(1).map(() => team) } : {}),
    rooms: [{ id: K.room, name: 'the set', bounds: B, doors: two.map(id => ({ id, from: 'outside' })), garrison: 1, marks: [{ pos: M.pos, watch: two[0], aimAt: M.aimAt }] }] };
  const stub = (id: string, k: number): BoxData => ({ id, c: [far[0] + k * 4 * K.stub, K.sunk, far[1]], h: [K.stub, K.stub, K.stub], albedo: [0, 0, 0], flags: ['NoPrimary', 'NoShadow'] });
  const lights: LightData[] = [...data.lights.filter(l => l.kind === 'dir'), ...(T.lights ?? [])], lit = new Set(lights.map(l => l.id));
  return {
    version: data.version, name: data.name, meta: data.meta, floors: data.floors, materials: data.materials, ...(data.surfaces ? { surfaces: data.surfaces } : {}),
    boxes: [...T.boxes.map(b => kitSetPaint(b, data.materials)), stub(K.panel, 0), stub(K.led, 1)], props: [], lights, switchables: [], doors, routes: [], chokepoints: [], volumes: [], devices: [], connectors: [],
    mission: { playerSpawn: team.sam, objectives: [{ id: 'reach_room', kind: 'reach', area: B, door: two[0] }, { id: 'pull_drive', kind: 'drive', rackIndex: 0, front: M.pos, halfW: 0 }, { id: 'exfil', kind: 'exfil', door: two[0], x: far[0], z: far[1] }] },
    breaker: { pos: [far[0], K.sunk, far[1]], panel: K.panel, led: K.led }, beacons: [],
    sky: data.sky, ...(data.daylight ? { daylight: { ...data.daylight, lightsOff: data.daylight.lightsOff.filter(id => lit.has(id)) } } : {}),
    plans: { roomClear: [] },
    // (every way of the block on THIS set keeps its place; a way that is the level's own, or another set's, stands in as the staged one: its door is gone)
    scenarios: { kitView: { ways: ways.map(y => y.set === hit.name ? y : Y), sets: { [hit.name]: T } }, roomClear, ...(data.scenarios?.issue ? { issue: data.scenarios.issue } : {}) },
  };
}

/** where the stand-in man stands and the point his gun rests on: of the free cells joined on foot to Sam's place with a free cell beside them, KIT_SET.apart
 *  from every place of the team, the nearest to the spot KIT_SET.behind m behind the wall's far face (no such cell: beside Sam, and the game's check says so) */
function standIn(boxes: readonly BoxData[], P: KitViewPlanned): { pos: Vec3; aimAt: Vec3 } {
  const N = KIT_PLAN.nav, K = KIT_SET, F = kitPlanFloor(boxes), mid = (i: number) => (i + 0.5) * N.cell, free = (x: number, z: number) => x >= 0 && z >= 0 && x < N.W && z < N.H && !F.blocked(mid(x), mid(z));
  const sx = Math.floor(P.slots[0][0] / N.cell), sz = Math.floor(P.slots[0][1] / N.cell), seen = new Uint8Array(N.W * N.H), todo: number[] = [];
  if (free(sx, sz)) { seen[sz * N.W + sx] = 1; todo.push(sx, sz); }
  for (let i = 0; i < todo.length; i += 2) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = todo[i] + dx, z = todo[i + 1] + dz; if (free(x, z) && !seen[z * N.W + x]) { seen[z * N.W + x] = 1; todo.push(x, z); } }
  const want: V2 = [P.anchor.mid[0] - P.anchor.n[0] * (K.behind - P.wall.back), P.anchor.mid[1] - P.anchor.n[1] * (K.behind - P.wall.back)];
  let best: { pos: Vec3; aimAt: Vec3 } | null = null, bestD = Infinity;
  for (let i = 0; i < todo.length; i += 2) { const x = todo[i], z = todo[i + 1], px = mid(x), pz = mid(z), d = Math.hypot(px - want[0], pz - want[1]);
    if (d >= bestD || P.slots.some(p => Math.hypot(p[0] - px, p[1] - pz) < K.apart)) continue;
    const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as V2[]).find(([dx, dz]) => free(x + dx, z + dz) && seen[(z + dz) * N.W + x + dx]); if (!nb) continue;
    best = { pos: [px, 0, pz], aimAt: [mid(x + nb[0]), 1.2, mid(z + nb[1])] }; bestD = d; }
  return best ?? { pos: [P.slots[0][0], 0, P.slots[0][1]], aimAt: [P.slots[0][0] + P.anchor.n[0] * -0.5, 1.2, P.slots[0][1] + P.anchor.n[1] * -0.5] };
}
