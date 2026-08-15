// LevelData: the level as DATA — the JSON schema every level file (levels/*.json) is written in, its validator, canonical serializer and digest.
//
// What lives here vs elsewhere:
//   scene/level.ts      the RUNTIME shape the game consumes (Level: Box[] with bit flags and array indices, LightDef[], PropDef[], plans…) + buildLevel()
//   scene/levelData.ts  (this) the AUTHORED shape: string ids everywhere, flags by name, materials by key, box references by id, nothing derived
//   scene/levelLoad.ts  the two conversions: loadLevel(LevelData) → Level (what the game boots from) and levelToData(Level, opts) → LevelData (the exporter's
//                       direction: tools/level-export.ts runs the legacy procedural generator once and writes levels/office.json)
//
// Design rules (the in-browser editor — lane G1b — and later lanes G2 floors / G4 devices build on this, and the designer hand-edits the JSON):
//   - every entity carries a stable string `id`, unique within its array; cross references are ALWAYS by id (a light's fixture box, a switchable's boxes,
//     the breaker's two boxes, a beacon's dome, a plan's door, an objective's door), never by array index — the loader resolves ids to the indices the
//     runtime wants. Array ORDER is still preserved by the loader (boxes[i] of the file is world.statics[i]), so a file diff is an entity diff.
//   - no derived data: nothing the loader or the game computes is stored (area lights off emissive fixtures, AreaLit / Emissive flags, door-leaf boxes,
//     nav / reach / collision bakes). Two deliberate exceptions, both flagged where they occur: PropData.half / height MAY be stored to pin a footprint
//     the fit would not reproduce (plants author theirs), and door FRAME boxes are plain boxes today (group 'doorframe.<door>') because the generator
//     emitted them as geometry — the editor may regenerate them from the door when it moves one.
//   - optional fields mean "the default": absent yaw = 0, absent flags = none, absent mains = fed from the breaker, absent floor = the first floor.
//     The exporter writes a field iff the source had it, so levels/office.json round-trips the procedural level key for key.
//   - numbers are stored at full double precision (JSON's shortest round-trip form): rounding even to 4 decimals moves wall slabs whose centres are
//     sums like (x0 + x1) / 2, and the identity gate (tools/qa/level-probes.ts) is bit-for-bit.
//   - versioned: `version` is bumped on any breaking change; the loader refuses versions it does not know.
import type { Vec3, Quat } from '../math/vec';
import type { WeaponId } from '../game/weapons';   // type only (erased): what a route may hand its man
import type { RoomClearPlan, BreachPlan, CivilianTask } from './level';
import { CIVILIAN_TASKS } from './level';
import { BoxFlag } from './boxes';
import { MarkingDef, MAX_MARKS_PER_BOX, MARKING_TEXEL, markingErrors } from './markings';
export type { MarkingDef } from './markings';

export const LEVEL_DATA_VERSION = 1 as const;

/** Box flags by NAME as they appear in a level file. Only the authored subset: Dynamic / Emissive / AreaLit / Rot are set by the runtime (props, upload,
 *  game.ts area lights, Box.rot presence) and SoundSeal is a CPU-only door-leaf state — none of them is ever authored, and the validator rejects them. */
export const AUTHORED_FLAGS = ['NoPrimary', 'NoShadow', 'Cutaway', 'Gloss', 'Glass'] as const;   // (Glass: experiment E3 — a pane; boxes.ts BoxFlag.Glass)
export type FlagName = typeof AUTHORED_FLAGS[number];
const FLAG_BITS: Record<FlagName, number> = { NoPrimary: BoxFlag.NoPrimary, NoShadow: BoxFlag.NoShadow, Cutaway: BoxFlag.Cutaway, Gloss: BoxFlag.Gloss, Glass: BoxFlag.Glass };
/** flag names → the Box.flags bit word (unknown names throw: validate first) */
export function flagsToBits(names: readonly string[] | undefined): number {
  let bits = 0; for (const n of names ?? []) { const b = FLAG_BITS[n as FlagName]; if (b === undefined) throw new Error(`unknown box flag '${n}'`); bits |= b; } return bits;
}
/** Box.flags bit word → flag names in AUTHORED_FLAGS order (bits outside the authored subset throw — a level box never carries them at build time) */
export function bitsToFlags(bits: number): FlagName[] {
  const out: FlagName[] = []; let rest = bits;
  for (const n of AUTHORED_FLAGS) if (bits & FLAG_BITS[n]) { out.push(n); rest &= ~FLAG_BITS[n]; }
  if (rest) throw new Error(`box flags 0x${bits.toString(16)}: bits 0x${rest.toString(16)} are runtime-only and cannot be authored`);
  return out;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ schema
export type Rect = { x0: number; x1: number; z0: number; z1: number };

/** One storey. v1 has exactly one (y 0, ceiling 3); lane G2 adds a mezzanine: boxes / doors / props / volumes name the floor they belong to. */
export interface FloorData { id: string; name?: string; /** world Y of the walkable surface */ y: number; /** ceiling height above y (WORLD.ceilingY today) */ ceiling: number; }
/** A named paint: linear diffuse albedo. Boxes and prop parts reference materials by key OR carry an inline albedo (one-offs). `rough` / `metal` = the FINISH the
 *  ray-traced reflection pass reads (boxes.ts Box.rough / metal; docs/internal/exp-rtreflect.md): GGX roughness 0‥1 (absent = matte, ROUGH_DEFAULT: no ray is
 *  spent) and bare metal (F0 = albedo). A box may override either (BoxData.rough / metal). Old files carry neither and load exactly as before. */
export interface MaterialData { albedo: Vec3; rough?: number; metal?: boolean; notes?: string; }
/** What is underfoot for everyone who listens to a footstep (game/floor.ts: the mixer, the guards' ears and the SOUND meter read ONE map). Zones are floor
 *  rectangles over the interior's default; outside the building it is `outside` except where x or z < grassEdge. TODAY floor.ts still owns its copy of these
 *  numbers (FINISHES / BUILDING / GRASS_EDGE) — level-probes.ts 'level-validate' asserts the two agree; wiring floor.ts to read this is a follow-up. */
export interface SurfacesData { building: Rect; grassEdge: number; inside: SurfaceMat; outside: SurfaceMat; verge: SurfaceMat; zones: { id: string; mat: SurfaceMat; x0: number; z0: number; x1: number; z1: number; notes?: string }[]; }
export type SurfaceMat = 'carpet' | 'lino' | 'stone' | 'tile' | 'asphalt' | 'grass';

/** One static box (scene/boxes.ts Box, minus everything the runtime owns: owner, the Emissive / AreaLit / Rot / Dynamic bits). */
export interface BoxData {
  id: string;
  /** FloorData.id; absent = floors[0] */
  floor?: string;
  /** editor grouping only (the generator's section: 'lobby', 'walls.interior', 'doorframe.server', …) — no runtime meaning */
  group?: string;
  /** Box.name: a tag the game may look up ('breaker_panel') */
  name?: string;
  c: Vec3; h: Vec3;
  /** rotation about +Y, radians; absent = 0 */
  yaw?: number;
  /** full orientation (unit quaternion x y z w) for the few tilted things (the bike's tubes); absent = yaw only */
  rot?: Quat;
  /** exactly one of material (a key of LevelData.materials) / albedo (inline linear rgb) */
  material?: string; albedo?: Vec3;
  /** emitted radiance (linear HDR); absent = none. Fixtures that switch (panels, screens, signs) are ALSO listed in `switchables` with their lit value. */
  emissive?: Vec3;
  /** the finish (see MaterialData): overrides the material's / gives an inline-albedo one-off one; absent = the material's, else matte / dielectric */
  rough?: number; metal?: boolean;
  flags?: FlagName[];
  /** Box.cutHeight (viewer stage back wall only); absent = never cut */
  cutHeight?: number;
  /** MARKINGS on the box's faces (scene/markings.ts MarkingDef: face, kind, rect from the face centre, res, palette a/b/c, emit, rough, p, id) — the pixel-art
   *  signifiers (key caps, tape, seams, the vending window, text bars, LEDs, glyphs); ≤ MAX_MARKS_PER_BOX; absent = none */
  markings?: MarkingDef[];
}

export type PropKindName = 'chair' | 'cardboard' | 'bin' | 'plant';
export interface PropPartData { off: Vec3; h: Vec3; /** relative to the prop's heading; absent = 0 */ yaw?: number; material?: string; albedo?: Vec3; /** markings on the part's faces (as BoxData.markings) */ markings?: MarkingDef[]; }
/** Loose furniture (game/props.ts): a rigid group of parts standing on the floor at (x, z). `half` / `height` are normally FITTED from the parts by the loader
 *  (levelLoad.ts fitPropFootprint — the generator's own rule); store them only to override the fit (a plant's footprint is its foliage's flat sides). */
export interface PropData { id: string; kind: PropKindName; /** PropDef.name; absent = id */ name?: string; floor?: string; x: number; z: number; /** heading; absent = 0 */ yaw?: number; mass: number; parts: PropPartData[]; half?: [number, number]; height?: number; }

/** An analytic light (scene/level.ts LightDef, every field the renderer reads). `id` is the LightDef.name the game keys targets / panels on. */
export interface LightData {
  id: string;
  kind: 'point' | 'spot' | 'dir';
  pos: Vec3; dir: Vec3; color: Vec3;
  /** point/spot: candela-ish; dir: irradiance on a surface square to it */
  intensity: number; range: number; innerDeg: number; outerDeg: number;
  /** light-target group for the Lights panel / OCP / daylight ('exterior', 'manager', …) */
  group: string;
  enabled: boolean;
  /** haze scattering multiplier for beams */
  volumetric: number;
  /** emitter size (m) → penumbra; for 'dir' the angular radius (rad). absent = the renderer's default (0.05 / 0) */
  radius?: number;
  /** fed from the building breaker; absent = true (false: street lighting, moon, sun) */
  mains?: boolean;
  /** wide soft emitter → the direct pass's 'broad' denoise class */
  broad?: boolean;
  /** BoxData.id of the emissive glow card that represents the fixture (goes dark with the light) */
  fixture?: string;
}
/** Emissive fixtures the OCP / panel / blackout can switch: the boxes glow `baseEmissive` when on. */
export interface SwitchableData { id: string; boxes: string[]; group: string; on: boolean; baseEmissive: Vec3; flicker?: boolean; /** absent = true */ mains?: boolean; }
/** A hinged leaf in a doorway gap (game/doors.ts DoorDef minus the runtime albedo). The FRAME (jambs, head, stops) is ordinary boxes, group 'doorframe.<id>'. */
export interface DoorData { id: string; floor?: string; hinge: [number, number]; closedDir: number; width: number; angle?: number; exterior?: boolean; closer?: boolean; minAngle?: number; maxAngle?: number; locked?: boolean; /** which key turns it; absent = the floor key */ lock?: string; keySide?: 1 | -1; /** a steel fire door: a boot only rings off it, no pick opens it (doors.ts DoorDef.steel — the QRF's west stair door) */ steel?: boolean; }
/** One man's beat (scene/level.ts PatrolRoute). `id` doubles as the route name the radio uses unless `name` says otherwise. */
export interface RouteData { id: string; name?: string; points: Vec3[]; wait: number[]; weapon?: WeaponId; keys?: string[]; }
export interface ChokepointData { id: string; name?: string; floor?: string; pos: Vec3; yaw: number; }
/** One of the building's night people (scene/level.ts CivilianDef — game/civilians.ts): her loop is a route's shape (points walked, wait stood at each) plus what
 *  she does at each waypoint (`tasks`, one per point, CIVILIAN_TASKS) facing which way (`face`, yaws, one per point). `name` = what the men call her (the id if absent). */
export interface CivilianData { id: string; name?: string; kind: 'cleaner' | 'worker'; floor?: string; tint: Vec3; tint2?: Vec3; points: Vec3[]; wait: number[]; tasks?: CivilianTask[]; face?: number[]; notes?: string; }
/** Authored volumes (none in the office yet): a hide spot the AI treats as cover-dark, a utility closet, a scripted trigger. Oriented box on a floor. */
export interface VolumeData { id: string; kind: 'hide' | 'utility' | 'trigger'; floor?: string; c: Vec3; h: Vec3; yaw?: number; notes?: string; }

/** The level-design devices (game/devices.ts runs them; docs/level-format.md 'Devices'). Every one is drawn by the game itself from its record (a camera's body,
 *  lens and LED; a keypad's plate and LED; a laser's emitter, receiver and beam) — none of it is in `boxes` — and every one but the keypad is a light TARGET
 *  (game.ts LightTarget kind 'device'): the pistol's OCP knocks it out for the OCP's spell, a round kills it for the encounter, `mains` (absent = true) puts
 *  it on the breaker so a blackout takes it down and the restrike brings it back; `group` (absent = 'security') is the Lights-panel / daylight group.
 *   camera  at `pos` (the lens), looking along `yaw` (Character convention: forward = [sin yaw, 0, cos yaw]) tilted `pitch` (radians, negative = down; absent
 *           −0.35), panning between `sweep[0]`‥`sweep[1]` (absolute yaws) over `sweepPeriod` seconds there and back (absent 9; no sweep = fixed); `fovDeg` = the full cone
 *           (absent 70), `range` metres (absent 14). It sees Sam through the guards' own eye test and light meter (devices.ts).
 *   keypad  the plate at `pos` facing `yaw` (out of the wall) beside DoorData `door`, which must be `locked` with `lock` = this keypad's id (the lock IS the
 *           link: doors.ts Door.lockId); `code` = four digits. Sam opens it once he knows the code (interrogation / overheard); staff always do.
 *   laser   a beam from `from` (the emitter) to `to` (the receiver) — its height is simply their y (0.35 = shin: no way over; ~1.0 = waist: crouch under);
 *           `alarm` = what breaking it does (absent 'suspicion': the radio and the nearest man over; 'alarm': the floor goes up a step). */
export type DeviceData =
  | { id: string; kind: 'camera'; floor?: string; pos: Vec3; yaw: number; pitch?: number; sweep?: [number, number]; sweepPeriod?: number; fovDeg?: number; range?: number; group?: string; mains?: boolean; notes?: string }
  | { id: string; kind: 'keypad'; floor?: string; pos: Vec3; yaw: number; /** DoorData.id it unlocks */ door: string; code: string; notes?: string }
  | { id: string; kind: 'laser'; floor?: string; from: Vec3; to: Vec3; group?: string; mains?: boolean; alarm?: 'suspicion' | 'alarm'; notes?: string };
export type CameraData = Extract<DeviceData, { kind: 'camera' }>;
export type KeypadData = Extract<DeviceData, { kind: 'keypad' }>;
export type LaserData = Extract<DeviceData, { kind: 'laser' }>;
/** the defaults an absent optional device field means (devices.ts and the editor read them from here) */
export const DEVICE_DEFAULTS = { pitch: -0.35, fovDeg: 70, range: 14, sweepPeriod: 9, group: 'security', alarm: 'suspicion' as 'suspicion' | 'alarm', codeRe: /^\d{4}$/ };
/** An HVAC supply VENT (game/wind.ts runs the air; docs/level-format.md 'Vents'; scene/level.ts VentDef is the runtime shape): a diffuser at `pos` (its face centre,
 *  just under the ceiling for a ceiling one) blowing along `dir` (need not be unit) at `speed` m/s at the face, a cone of half-angle `spread` DEGREES; the air slows to
 *  half by `reach` m and is gone by 2.5 × reach; a jet aimed down turns along its floor in its last half metre. `size?` = face width (m, absent 0.6), `period?` /
 *  `duty?` / `phase?` = slow cycling (seconds, on-fraction 0‥1, offset s; absent = steady), `mains?` (absent = true: on the breaker — a blackout stops the air),
 *  `floor?` as everywhere. The grille itself is an ordinary box (group 'ceiling.vents') like a door's frame is. */
export interface VentData { id: string; floor?: string; pos: Vec3; dir: Vec3; speed: number; spread: number; reach: number; size?: number; period?: number; duty?: number; phase?: number; mains?: boolean; notes?: string; }
/** the defaults an absent optional vent field means (wind.ts and the editor read them from here) */
export const VENT_DEFAULTS = { size: 0.6, duty: 1, phase: 0, mains: true };
/** TODO(G2): links between floors (a stair volume joining nav cells of two floors, with a traversal cost and a footstep material). */
export type ConnectorData =
  | { id: string; kind: 'stair' | 'ladder'; from: { floor: string; c: Vec3; h: Vec3 }; to: { floor: string; c: Vec3; h: Vec3 }; cost?: number; mat?: SurfaceMat; notes?: string };

/** The one mission thread, as objectives the fixed stage machine (game/mission.ts) maps onto: v1 wants exactly one of each kind. */
export type ObjectiveData =
  | { id: string; kind: 'reach'; /** the room's floor inside its walls */ area: Rect; /** DoorData.id the HUD points at for it */ door: string }
  | { id: string; kind: 'drive'; /** rack n → switchables rack<n>_leds / rack<n>_glow go dark */ rackIndex: number; /** marker point on its LED face */ front: Vec3; halfW: number }
  | { id: string; kind: 'exfil'; door: string; /** past this x you are out */ x: number; z: number };
export interface MissionData { playerSpawn: Vec3; objectives: ObjectiveData[]; }

export interface SkyData { zenith: Vec3; horizon: Vec3; }
/** The daytime variant (scene/level.ts DaylightDef): the sun is a LightData of kind 'dir'. */
export interface DaylightData { sun: LightData; sky: SkyData; groupsOn: string[]; groupsOff: string[]; /** LightData.id list */ lightsOff: string[]; haze: number; exposure: number; }

/** The drill plans are the RUNTIME structs verbatim (scene/level.ts RoomClearPlan / BreachPlan — marks, facings, aim lists, lines) plus an id; `door` is a
 *  DoorData.id. Deliberately typed BY REFERENCE and handled generically below (canonical order = known keys first, anything else after, alphabetically;
 *  validation = the RoomClearPlan fields squad.ts indexes blind + 'every leaf finite'), so a lane that re-choreographs the breach and grows BreachPlan
 *  changes level.ts + the generator and re-exports — nothing here drops, reorders unstably or rejects its new fields. */
export type RoomClearPlanData = RoomClearPlan & { id: string };
export type BreachPlanData = BreachPlan & { id: string };

export interface LevelData {
  version: typeof LEVEL_DATA_VERSION;
  name: string;
  meta: { /** editor snap (m) */ grid?: number; /** the traceable world this level must fit (scene/world.ts WORLD.min/max at export) */ bounds?: { min: Vec3; max: Vec3 }; generator?: string; notes?: string; /** the base texel (m) the file's marking bitmaps were generated for (scene/markings.ts MARKING_TEXEL when absent) */ markTexel?: number };
  floors: FloorData[];
  materials: Record<string, MaterialData>;
  surfaces?: SurfacesData;
  boxes: BoxData[];
  props: PropData[];
  lights: LightData[];
  switchables: SwitchableData[];
  doors: DoorData[];
  routes: RouteData[];
  chokepoints: ChokepointData[];
  /** the cleaner / the late worker (game/civilians.ts) — absent = nobody but the shift on the floor */
  civilians?: CivilianData[];
  volumes: VolumeData[];
  devices: DeviceData[];
  /** HVAC supply vents (game/wind.ts) — optional block: absent = still air indoors */
  vents?: VentData[];
  connectors: ConnectorData[];
  mission: MissionData;
  /** the mains panel: `panel` / `led` are BoxData ids (OCP the panel for a blackout, shoot it for a permanent one) */
  breaker: { pos: Vec3; panel: string; led: string };
  /** emergency beacons: `box` is the dome's BoxData id — it MUST also be a switchable's box (game.ts slaves the beam to that target) */
  beacons: { id: string; pos: Vec3; box: string }[];
  sky: SkyData;
  daylight?: DaylightData;
  plans: { roomClear: RoomClearPlanData[]; breach?: BreachPlanData };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ key registry
/** The keys every record may carry, in canonical (serialized) order — ONE list read by both the validator (anything else is reported as an unknown key: a
 *  hand-edit typo like "emmisive" must fail loudly, not vanish on the next save) and canonicalLevelData (which keeps exactly these). Adding a field to the
 *  format = add it to its interface above, to this list, and to both directions in levelLoad.ts. The drill plans are NOT here: they are handled generically. */
export const KEYS = {
  top: ['version', 'name', 'meta', 'floors', 'materials', 'surfaces', 'boxes', 'props', 'lights', 'switchables', 'doors', 'routes', 'chokepoints', 'civilians', 'volumes', 'devices', 'vents', 'connectors', 'mission', 'breaker', 'beacons', 'sky', 'daylight', 'plans'],
  meta: ['grid', 'bounds', 'generator', 'notes', 'markTexel'], bounds: ['min', 'max'], rect: ['x0', 'x1', 'z0', 'z1'],
  floor: ['id', 'name', 'y', 'ceiling'], material: ['albedo', 'rough', 'metal', 'notes'],
  surfaces: ['building', 'grassEdge', 'inside', 'outside', 'verge', 'zones'], zone: ['id', 'mat', 'x0', 'z0', 'x1', 'z1', 'notes'],
  box: ['id', 'floor', 'group', 'name', 'c', 'h', 'yaw', 'rot', 'material', 'albedo', 'emissive', 'rough', 'metal', 'flags', 'cutHeight', 'markings'],
  prop: ['id', 'kind', 'name', 'floor', 'x', 'z', 'yaw', 'mass', 'parts', 'half', 'height'], part: ['off', 'h', 'yaw', 'material', 'albedo', 'markings'],
  marking: ['face', 'res', 'at', 'size', 'pal', 'cells'], markpal: ['albedo', 'mul', 'rough', 'emit'],   // (scene/markings.ts marking() / palEntry() write exactly these, in this order)
  light: ['id', 'kind', 'pos', 'dir', 'color', 'intensity', 'range', 'innerDeg', 'outerDeg', 'group', 'enabled', 'volumetric', 'radius', 'mains', 'broad', 'fixture'],
  switchable: ['id', 'boxes', 'group', 'on', 'baseEmissive', 'flicker', 'mains'],
  door: ['id', 'floor', 'hinge', 'closedDir', 'width', 'angle', 'exterior', 'closer', 'minAngle', 'maxAngle', 'locked', 'lock', 'keySide', 'steel'],
  route: ['id', 'name', 'points', 'wait', 'weapon', 'keys'], chokepoint: ['id', 'name', 'floor', 'pos', 'yaw'], civilian: ['id', 'name', 'kind', 'floor', 'tint', 'tint2', 'points', 'wait', 'tasks', 'face', 'notes'], volume: ['id', 'kind', 'floor', 'c', 'h', 'yaw', 'notes'],
  camera: ['id', 'kind', 'floor', 'pos', 'yaw', 'pitch', 'sweep', 'sweepPeriod', 'fovDeg', 'range', 'group', 'mains', 'notes'], keypad: ['id', 'kind', 'floor', 'pos', 'yaw', 'door', 'code', 'notes'], laser: ['id', 'kind', 'floor', 'from', 'to', 'group', 'mains', 'alarm', 'notes'],
  vent: ['id', 'floor', 'pos', 'dir', 'speed', 'spread', 'reach', 'size', 'period', 'duty', 'phase', 'mains', 'notes'],
  connector: ['id', 'kind', 'from', 'to', 'cost', 'mat', 'notes'], connEnd: ['floor', 'c', 'h'],
  mission: ['playerSpawn', 'objectives'], reach: ['id', 'kind', 'area', 'door'], drive: ['id', 'kind', 'rackIndex', 'front', 'halfW'], exfil: ['id', 'kind', 'door', 'x', 'z'],
  breaker: ['pos', 'panel', 'led'], beacon: ['id', 'pos', 'box'], sky: ['zenith', 'horizon'], daylight: ['sun', 'sky', 'groupsOn', 'groupsOff', 'lightsOff', 'haze', 'exposure'],
  plans: ['roomClear', 'breach'],   // (the container only — what is INSIDE a plan is generic, see canonBlob)
} as const;

// ------------------------------------------------------------------------------------------------------------------------------------------------ validation
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isVec = (v: unknown, n = 3): boolean => Array.isArray(v) && v.length === n && v.every(isNum);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const isRect = (r: any): boolean => !!r && isNum(r.x0) && isNum(r.x1) && isNum(r.z0) && isNum(r.z1) && r.x0 <= r.x1 && r.z0 <= r.z1;

/** Every structural / referential / range problem in `d`, one line each ('' = valid). Cheap enough to run at every boot (loadLevel does). It checks the
 *  SCHEMA — shapes, finiteness, unique ids, that every id reference resolves, enum values, array arities the drills index blind — not level DESIGN
 *  (reachability, sealing, budgets: that is tools/qa/level-lint.ts, lane G1b). */
export function validateLevelData(d: LevelData): string[] {
  const errs: string[] = [];
  const err = (where: string, msg: string) => { errs.push(`${where}: ${msg}`); };
  if (!d || typeof d !== 'object' || Array.isArray(d)) return ['level: not an object'];
  /** a raw value quoted for a message: strings as they are, anything else as JSON — never String(v), which throws on records with a non-callable toString */
  const show = (v: unknown): string => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v) ?? String(v); } catch { return typeof v; } })().slice(0, 40);
  const isObj = (x: unknown): boolean => !!x && typeof x === 'object' && !Array.isArray(x);
  const uniq = (where: string, ids: (string | undefined)[]) => { const seen = new Set<string>(); ids.forEach((id, i) => { if (!isStr(id)) err(`${where}[${i}]`, 'missing id'); else if (seen.has(id)) err(`${where}[${i}]`, `duplicate id '${id}'`); else seen.add(id); }); return seen; };
  const arr = <T>(where: string, v: T[] | undefined): T[] => { if (!Array.isArray(v)) { err(where, 'must be an array'); return []; } return v; };
  /** an array whose entries must be records: non-objects are reported here and skipped by the per-entry checks (a `null` left by a hand edit must not throw) */
  const recs = <T>(where: string, v: T[] | undefined): T[] => { const a = arr(where, v); a.forEach((x, i) => { if (!isObj(x)) err(`${where}[${i}]`, 'must be an object'); }); return a; };
  /** every key of record o must be one the format knows (KEYS): a typo'd key is data that would be ignored on load and dropped on save */
  const known = (where: string, o: unknown, keys: readonly string[]) => { if (!isObj(o)) return; for (const k of Object.keys(o as object)) if ((o as any)[k] !== undefined && !keys.includes(k)) err(where, `unknown key '${k}' (allowed: ${keys.join(', ')})`); };
  known('level', d, KEYS.top);
  if (d.version !== LEVEL_DATA_VERSION) err('version', `expected ${LEVEL_DATA_VERSION}, got ${show((d as any).version)}`);
  if (!isStr(d.name)) err('name', 'missing');
  if (!isObj(d.meta)) err('meta', 'must be an object (may be {})');
  else {
    known('meta', d.meta, KEYS.meta); if (d.meta.grid !== undefined && !(isNum(d.meta.grid) && d.meta.grid > 0)) err('meta.grid', 'must be > 0');
    const b = d.meta.bounds; if (b !== undefined) { if (!(isObj(b) && isVec(b.min) && isVec(b.max))) err('meta.bounds', '{ min: Vec3, max: Vec3 }'); else known('meta.bounds', b, KEYS.bounds); }
    if (d.meta.generator !== undefined && typeof d.meta.generator !== 'string') err('meta.generator', 'string'); if (d.meta.notes !== undefined && typeof d.meta.notes !== 'string') err('meta.notes', 'string');
    if (d.meta.markTexel !== undefined && !(isNum(d.meta.markTexel) && d.meta.markTexel >= 0.005 && d.meta.markTexel <= 0.2)) err('meta.markTexel', 'metres in [0.005, 0.2]');
  }
  // floors / materials
  const floors = recs('floors', d.floors); if (!floors.length) err('floors', 'at least one floor');
  const floorIds = uniq('floors', floors.map(f => (f as any)?.id));
  floors.forEach((f, i) => { if (!isObj(f)) return; known(`floors[${i}]`, f, KEYS.floor); if (!isNum(f.y)) err(`floors[${i}].y`, 'number'); if (!(isNum(f.ceiling) && f.ceiling > 0)) err(`floors[${i}].ceiling`, '> 0'); if (f.name !== undefined && !isStr(f.name)) err(`floors[${i}].name`, 'string'); });
  const floorOk = (where: string, f: unknown) => { if (f !== undefined && !(isStr(f) && floorIds.has(f))) err(where, `unknown floor '${show(f)}'`); };
  const mats: Record<string, MaterialData> = isObj(d.materials) ? d.materials : (err('materials', 'must be an object (name → { albedo })'), {});
  /** the finish fields, wherever they sit (a material or a box): rough a number in [0, 1], metal a boolean */
  const finishOk = (where: string, o: { rough?: unknown; metal?: unknown }) => { if (o.rough !== undefined && !(isNum(o.rough) && o.rough >= 0 && o.rough <= 1)) err(where, 'rough must be a number in [0, 1]'); if (o.metal !== undefined && typeof o.metal !== 'boolean') err(where, 'metal must be a boolean'); };
  for (const [k, m] of Object.entries(mats)) { if (!isObj(m) || !isVec(m.albedo) || m.albedo.some(x => x < 0)) err(`materials.${k}`, 'albedo must be a Vec3 ≥ 0'); else { known(`materials.${k}`, m, KEYS.material); finishOk(`materials.${k}`, m); if (m.notes !== undefined && typeof m.notes !== 'string') err(`materials.${k}.notes`, 'string'); } }
  const paintOk = (where: string, o: { material?: string; albedo?: Vec3 }) => {
    const hasM = o.material !== undefined, hasA = o.albedo !== undefined;
    if (hasM === hasA) err(where, 'exactly one of material / albedo');
    else if (hasM && !(isStr(o.material) && Object.prototype.hasOwnProperty.call(mats, o.material!) && isObj(mats[o.material!]))) err(where, `unknown material '${show(o.material)}'`);   // (own keys only: 'constructor' / '__proto__' are not materials)
    else if (hasA && !(isVec(o.albedo) && o.albedo!.every(x => x >= 0))) err(where, 'albedo must be a Vec3 ≥ 0');
  };
  /** the markings of a box / part of half extents h: an array of ≤ MAX_MARKS_PER_BOX records, each checked by scene/markings.ts markingErrors (keys, enums, rect inside its face…) */
  const markTexel = isObj(d.meta) && isNum((d.meta as any).markTexel) ? (d.meta as any).markTexel as number : MARKING_TEXEL;   // the base texel the file's bitmaps were generated for
  const marksOk = (where: string, ms: unknown, h: unknown, tilted: boolean) => {
    if (ms === undefined) return;
    if (!Array.isArray(ms)) { err(`${where}.markings`, 'must be an array'); return; }
    if (ms.length > MAX_MARKS_PER_BOX) err(`${where}.markings`, `at most ${MAX_MARKS_PER_BOX} per box (${ms.length})`);
    if (tilted) err(`${where}.markings`, 'a box with rot cannot carry markings (the face frame is yaw-only)');
    const hh: Vec3 = isVec(h) ? (h as Vec3) : [1e9, 1e9, 1e9];
    ms.forEach((m, k) => { for (const e of markingErrors(m, hh, markTexel)) err(`${where}.markings[${k}]`, e); });
  };
  // surfaces
  if (d.surfaces !== undefined && !isObj(d.surfaces)) err('surfaces', 'must be an object');
  else if (d.surfaces !== undefined) {
    const s = d.surfaces; const MATS: SurfaceMat[] = ['carpet', 'lino', 'stone', 'tile', 'asphalt', 'grass'];
    known('surfaces', s, KEYS.surfaces); known('surfaces.building', s.building, KEYS.rect);
    if (!isRect(s.building)) err('surfaces.building', 'rect'); if (!isNum(s.grassEdge)) err('surfaces.grassEdge', 'number');
    for (const k of ['inside', 'outside', 'verge'] as const) if (!MATS.includes(s[k])) err(`surfaces.${k}`, `one of ${MATS.join('/')}`);
    const zones = recs('surfaces.zones', s.zones); uniq('surfaces.zones', zones.map(z => (z as any)?.id));
    zones.forEach((z, i) => { if (!isObj(z)) return; known(`surfaces.zones[${i}]`, z, KEYS.zone); if (!MATS.includes(z.mat)) err(`surfaces.zones[${i}].mat`, `one of ${MATS.join('/')}`); if (!isRect(z)) err(`surfaces.zones[${i}]`, 'x0 ≤ x1, z0 ≤ z1'); });
  }
  // boxes
  const boxes = recs('boxes', d.boxes);
  const boxIds = uniq('boxes', boxes.map(b => (b as any)?.id));
  boxes.forEach((b, i) => {
    if (!isObj(b)) return; const w = `boxes[${i}] '${show(b.id)}'`;
    known(w, b, KEYS.box); floorOk(w, b.floor);
    if (!isVec(b.c)) err(w, 'c must be Vec3'); if (!(isVec(b.h) && b.h.every(x => x >= 0))) err(w, 'h must be Vec3 ≥ 0');
    if (b.yaw !== undefined && !isNum(b.yaw)) err(w, 'yaw must be a number');
    if (b.rot !== undefined && !(isVec(b.rot, 4) && Math.abs(Math.hypot(...b.rot) - 1) < 1e-3)) err(w, 'rot must be a unit quaternion [x y z w]');
    paintOk(w, b); finishOk(w, b);
    if (b.emissive !== undefined && !(isVec(b.emissive) && b.emissive.every(x => x >= 0))) err(w, 'emissive must be Vec3 ≥ 0');
    if (b.flags !== undefined) { if (!Array.isArray(b.flags)) err(w, 'flags must be an array of names'); else for (const f of b.flags) if (!(AUTHORED_FLAGS as readonly string[]).includes(f)) err(w, `unknown / runtime-only flag '${show(f)}' (authored: ${AUTHORED_FLAGS.join(', ')})`); }
    if (b.cutHeight !== undefined && !isNum(b.cutHeight)) err(w, 'cutHeight must be a number');
    if (b.name !== undefined && !isStr(b.name)) err(w, 'name must be a non-empty string'); if (b.group !== undefined && !isStr(b.group)) err(w, 'group must be a non-empty string');
    marksOk(w, b.markings, b.h, b.rot !== undefined);
  });
  const boxOk = (where: string, id: unknown) => { if (!isStr(id) || !boxIds.has(id)) err(where, `unknown box '${show(id)}'`); };
  // props
  const props = recs('props', d.props); uniq('props', props.map(p => (p as any)?.id));
  props.forEach((p, i) => {
    if (!isObj(p)) return; const w = `props[${i}] '${show(p.id)}'`; known(w, p, KEYS.prop);
    if (!['chair', 'cardboard', 'bin', 'plant'].includes(p.kind)) err(w, `kind '${show(p.kind)}'`); floorOk(w, p.floor);
    for (const k of ['x', 'z', 'mass'] as const) if (!isNum(p[k])) err(w, `${k} must be a number`); if (p.yaw !== undefined && !isNum(p.yaw)) err(w, 'yaw must be a number'); if (isNum(p.mass) && p.mass <= 0) err(w, 'mass > 0');
    if (p.half !== undefined && !(isVec(p.half, 2) && p.half[0] > 0 && p.half[1] > 0)) err(w, 'half must be [hx, hz] > 0'); if (p.height !== undefined && !(isNum(p.height) && p.height > 0)) err(w, 'height > 0');
    const parts = recs(`${w}.parts`, p.parts); if (!parts.length) err(w, 'at least one part');
    parts.forEach((q, j) => { if (!isObj(q)) return; const wq = `${w}.parts[${j}]`; known(wq, q, KEYS.part); if (!isVec(q.off)) err(wq, 'off Vec3'); if (!(isVec(q.h) && q.h.every(x => x >= 0))) err(wq, 'h Vec3 ≥ 0'); if (q.yaw !== undefined && !isNum(q.yaw)) err(wq, 'yaw number'); paintOk(wq, q); marksOk(wq, q.markings, q.h, false); });
  });
  // lights
  const lightOk = (w: string, l: LightData) => {
    if (!isObj(l)) { err(w, 'must be an object'); return; }
    known(w, l, KEYS.light);
    if (!['point', 'spot', 'dir'].includes(l.kind)) err(w, `kind '${show(l.kind)}'`);
    if (!isVec(l.pos)) err(w, 'pos Vec3'); if (!(isVec(l.dir) && Math.hypot(...l.dir) > 1e-9)) err(w, 'dir must be a non-zero Vec3'); if (!(isVec(l.color) && l.color.every(x => x >= 0))) err(w, 'color Vec3 ≥ 0');
    for (const k of ['intensity', 'range', 'innerDeg', 'outerDeg', 'volumetric'] as const) if (!(isNum(l[k]) && l[k] >= 0)) err(w, `${k} must be ≥ 0`);
    if (isNum(l.innerDeg) && isNum(l.outerDeg) && l.innerDeg > l.outerDeg) err(w, 'innerDeg ≤ outerDeg');
    if (!isStr(l.group)) err(w, 'group'); if (typeof l.enabled !== 'boolean') err(w, 'enabled boolean');
    if (l.radius !== undefined && !(isNum(l.radius) && l.radius >= 0)) err(w, 'radius ≥ 0');
    for (const k of ['mains', 'broad'] as const) if (l[k] !== undefined && typeof l[k] !== 'boolean') err(w, `${k} boolean`);
    if (l.fixture !== undefined) boxOk(`${w}.fixture`, l.fixture);
  };
  const lights = arr('lights', d.lights); const lightIds = uniq('lights', lights.map(l => (l as any)?.id));
  lights.forEach((l, i) => lightOk(`lights[${i}] '${show((l as any)?.id)}'`, l));
  // switchables
  const sws = recs('switchables', d.switchables); uniq('switchables', sws.map(s => (s as any)?.id));
  const swBox = new Map<string, string>();
  sws.forEach((s, i) => {
    if (!isObj(s)) return; const w = `switchables[${i}] '${show(s.id)}'`; known(w, s, KEYS.switchable);
    const bx = arr(`${w}.boxes`, s.boxes); if (!bx.length) err(w, 'at least one box');
    bx.forEach((b, j) => { boxOk(`${w}.boxes[${j}]`, b); const o = swBox.get(b); if (o !== undefined) err(w, o === s.id ? `box '${show(b)}' listed twice (it would be lit twice over)` : `box '${show(b)}' already belongs to switchable '${o}'`); if (isStr(b)) swBox.set(b, s.id); });
    if (!isStr(s.group)) err(w, 'group'); if (typeof s.on !== 'boolean') err(w, 'on boolean'); if (!(isVec(s.baseEmissive) && s.baseEmissive.every(x => x >= 0))) err(w, 'baseEmissive Vec3 ≥ 0');
    for (const k of ['flicker', 'mains'] as const) if (s[k] !== undefined && typeof s[k] !== 'boolean') err(w, `${k} boolean`);
  });
  // doors
  const doors = recs('doors', d.doors); const doorIds = uniq('doors', doors.map(x => (x as any)?.id));
  doors.forEach((o, i) => {
    if (!isObj(o)) return; const w = `doors[${i}] '${show(o.id)}'`; known(w, o, KEYS.door); floorOk(w, o.floor);
    if (!isVec(o.hinge, 2)) err(w, 'hinge [x, z]'); if (!isNum(o.closedDir)) err(w, 'closedDir'); if (!(isNum(o.width) && o.width > 0)) err(w, 'width > 0');
    for (const k of ['angle', 'minAngle', 'maxAngle'] as const) if (o[k] !== undefined && !isNum(o[k])) err(w, `${k} number`);
    for (const k of ['exterior', 'closer', 'locked'] as const) if (o[k] !== undefined && typeof o[k] !== 'boolean') err(w, `${k} boolean`);
    if (o.lock !== undefined && !isStr(o.lock)) err(w, 'lock string'); if (o.keySide !== undefined && o.keySide !== 1 && o.keySide !== -1) err(w, 'keySide ±1'); if (o.steel !== undefined && typeof o.steel !== 'boolean') err(w, 'steel boolean');
  });
  const doorOk = (where: string, id: unknown) => { if (!isStr(id) || !doorIds.has(id)) err(where, `unknown door '${show(id)}'`); };
  // routes / chokepoints / volumes
  const routes = recs('routes', d.routes); uniq('routes', routes.map(r => (r as any)?.id));
  routes.forEach((r, i) => {
    if (!isObj(r)) return; const w = `routes[${i}] '${show(r.id)}'`; known(w, r, KEYS.route); const pts = arr(`${w}.points`, r.points), wt = arr(`${w}.wait`, r.wait);
    if (!pts.length) err(w, 'at least one point'); if (pts.length !== wt.length) err(w, `wait has ${wt.length} entries for ${pts.length} points`);
    pts.forEach((p, j) => { if (!isVec(p)) err(`${w}.points[${j}]`, 'Vec3'); }); wt.forEach((x, j) => { if (!(isNum(x) && x >= 0)) err(`${w}.wait[${j}]`, '≥ 0'); });
    if (r.keys !== undefined && !(Array.isArray(r.keys) && r.keys.every(isStr))) err(w, 'keys string[]'); if (r.weapon !== undefined && !isStr(r.weapon)) err(w, 'weapon id');
    if (r.name !== undefined && !isStr(r.name)) err(w, 'name string');   // (game.ts looks routes up by name: a number or '' would silently never match)
  });
  const cps = recs('chokepoints', d.chokepoints); uniq('chokepoints', cps.map(c => (c as any)?.id));
  cps.forEach((c, i) => { if (!isObj(c)) return; const w = `chokepoints[${i}]`; known(w, c, KEYS.chokepoint); floorOk(w, c.floor); if (!isVec(c.pos)) err(w, 'pos Vec3'); if (!isNum(c.yaw)) err(w, 'yaw'); if (c.name !== undefined && !isStr(c.name)) err(w, 'name string'); });
  if (d.civilians !== undefined) {   // (optional block: absent = none)
    const cvs = recs('civilians', d.civilians); uniq('civilians', cvs.map(c => (c as any)?.id));
    cvs.forEach((c, i) => {
      if (!isObj(c)) return; const w = `civilians[${i}] '${show(c.id)}'`; known(w, c, KEYS.civilian); floorOk(w, c.floor);
      if (c.kind !== 'cleaner' && c.kind !== 'worker') err(w, `kind '${show(c.kind)}' (cleaner / worker)`);
      if (c.name !== undefined && !isStr(c.name)) err(w, 'name string');
      if (!(isVec(c.tint) && c.tint.every(x => x >= 0))) err(w, 'tint Vec3 ≥ 0'); if (c.tint2 !== undefined && !(isVec(c.tint2) && c.tint2.every(x => x >= 0))) err(w, 'tint2 Vec3 ≥ 0');
      const pts = arr(`${w}.points`, c.points), wt = arr(`${w}.wait`, c.wait);
      if (!pts.length) err(w, 'points must not be empty'); if (!pts.every(p => isVec(p))) err(w, 'points Vec3[]'); if (wt.length !== pts.length || !wt.every(x => isNum(x) && x >= 0)) err(w, 'wait: one number ≥ 0 per point');
      if (c.tasks !== undefined && !(Array.isArray(c.tasks) && c.tasks.length === pts.length && c.tasks.every(t => (CIVILIAN_TASKS as string[]).includes(t)))) err(w, `tasks: one of ${CIVILIAN_TASKS.join('/')} per point`);
      if (c.face !== undefined && !(Array.isArray(c.face) && c.face.length === pts.length && c.face.every(isNum))) err(w, 'face: one yaw per point');
    });
  }
  const vols = recs('volumes', d.volumes); uniq('volumes', vols.map(v => (v as any)?.id));
  vols.forEach((v, i) => { if (!isObj(v)) return; const w = `volumes[${i}]`; known(w, v, KEYS.volume); if (!['hide', 'utility', 'trigger'].includes(v.kind)) err(w, `kind '${show(v.kind)}'`); floorOk(w, v.floor); if (!isVec(v.c) || !isVec(v.h)) err(w, 'c/h Vec3'); if (v.yaw !== undefined && !isNum(v.yaw)) err(w, 'yaw'); });
  // devices (game/devices.ts) / connectors (stub: shapes only)
  const devs = recs('devices', d.devices); uniq('devices', devs.map(v => (v as any)?.id));
  const padDoors = new Map<string, string>();   // door id → the keypad that claims it (one per door)
  devs.forEach((v, i) => {
    if (!isObj(v)) return; const w = `devices[${i}] '${show(v.id)}'`; floorOk(w, v.floor);
    const powerOk = (o: { group?: string; mains?: boolean }) => { if (o.group !== undefined && !isStr(o.group)) err(w, 'group string'); if (o.mains !== undefined && typeof o.mains !== 'boolean') err(w, 'mains boolean'); };
    if ((v as any).notes !== undefined && typeof (v as any).notes !== 'string') err(w, 'notes string');
    if (v.kind === 'camera') {
      known(w, v, KEYS.camera); powerOk(v);
      if (!isVec(v.pos) || !isNum(v.yaw)) err(w, 'pos Vec3 + yaw');
      if (v.pitch !== undefined && !(isNum(v.pitch) && Math.abs(v.pitch) < 1.5)) err(w, 'pitch radians in (−1.5, 1.5)');
      if (v.sweep !== undefined && !isVec(v.sweep, 2)) err(w, 'sweep [yawA, yawB]');
      if (v.sweepPeriod !== undefined && !(isNum(v.sweepPeriod) && v.sweepPeriod > 0)) err(w, 'sweepPeriod > 0');
      if (v.fovDeg !== undefined && !(isNum(v.fovDeg) && v.fovDeg > 0 && v.fovDeg <= 170)) err(w, 'fovDeg in (0, 170]');
      if (v.range !== undefined && !(isNum(v.range) && v.range > 0)) err(w, 'range > 0');
    } else if (v.kind === 'keypad') {
      known(w, v, KEYS.keypad);
      if (!isVec(v.pos) || !isNum(v.yaw)) err(w, 'pos Vec3 + yaw');
      if (!(isStr(v.code) && DEVICE_DEFAULTS.codeRe.test(v.code))) err(w, `code must be four digits (got '${show(v.code)}')`);
      doorOk(`${w}.door`, v.door);
      const dr = isStr(v.door) ? (doors.find(o => isObj(o) && o.id === v.door) as DoorData | undefined) : undefined;
      if (dr) {   // the lock IS the link (doors.ts Door.lockId): the door must be locked, on this keypad's own lock, and nobody else's keypad
        if (!dr.locked) err(w, `door '${v.door}' is not locked — a keypad on an open door does nothing`);
        if (dr.lock !== v.id) err(w, `door '${v.door}' has lock '${show(dr.lock ?? '(the floor key)')}' — a keypad door's lock must be the keypad's id ('${show(v.id)}')`);
        const other = padDoors.get(v.door); if (other !== undefined) err(w, `door '${v.door}' already has keypad '${other}'`); else if (isStr(v.id)) padDoors.set(v.door, v.id);
      }
    } else if (v.kind === 'laser') {
      known(w, v, KEYS.laser); powerOk(v);
      if (!isVec(v.from) || !isVec(v.to)) err(w, 'from/to Vec3');
      else if (Math.hypot(v.to[0] - v.from[0], v.to[1] - v.from[1], v.to[2] - v.from[2]) < 0.05) err(w, 'from and to are the same point — a beam needs length');
      if (v.alarm !== undefined && v.alarm !== 'suspicion' && v.alarm !== 'alarm') err(w, "alarm 'suspicion' | 'alarm'");
    } else err(w, `kind '${show((v as any).kind)}'`);
  });
  // vents (game/wind.ts) — optional block: absent = none
  if (d.vents !== undefined) {
    const vents = recs('vents', d.vents); uniq('vents', vents.map(v => (v as any)?.id));
    vents.forEach((v, i) => {
      if (!isObj(v)) return; const w = `vents[${i}] '${show(v.id)}'`; known(w, v, KEYS.vent); floorOk(w, v.floor);
      if (!isVec(v.pos)) err(w, 'pos Vec3'); if (!(isVec(v.dir) && Math.hypot(...v.dir) > 1e-9)) err(w, 'dir must be a non-zero Vec3');
      if (!(isNum(v.speed) && v.speed >= 0 && v.speed <= 12)) err(w, 'speed m/s in [0, 12]');
      if (!(isNum(v.spread) && v.spread >= 0 && v.spread < 89)) err(w, 'spread (cone half-angle) degrees in [0, 89)');
      if (!(isNum(v.reach) && v.reach > 0 && v.reach <= 30)) err(w, 'reach m in (0, 30]');
      if (v.size !== undefined && !(isNum(v.size) && v.size > 0 && v.size <= 3)) err(w, 'size m in (0, 3]');
      if (v.period !== undefined && !(isNum(v.period) && v.period > 0)) err(w, 'period s > 0');
      if (v.duty !== undefined && !(isNum(v.duty) && v.duty >= 0 && v.duty <= 1)) err(w, 'duty in [0, 1]');
      if (v.phase !== undefined && !isNum(v.phase)) err(w, 'phase s number');
      if (v.mains !== undefined && typeof v.mains !== 'boolean') err(w, 'mains boolean'); if (v.notes !== undefined && typeof v.notes !== 'string') err(w, 'notes string');
    });
  }
  const cons = recs('connectors', d.connectors); uniq('connectors', cons.map(v => (v as any)?.id));
  cons.forEach((c, i) => { if (!isObj(c)) return; const w = `connectors[${i}]`; known(w, c, KEYS.connector); if (!['stair', 'ladder'].includes(c.kind)) err(w, `kind '${show(c.kind)}'`); for (const e of ['from', 'to'] as const) { const s = c[e]; if (!isObj(s) || !floorIds.has(s.floor) || !isVec(s.c) || !isVec(s.h)) err(`${w}.${e}`, 'floor id + c/h Vec3'); else known(`${w}.${e}`, s, KEYS.connEnd); } });
  // mission
  const M = d.mission;
  if (!M || typeof M !== 'object') err('mission', 'missing');
  else {
    known('mission', M, KEYS.mission); if (!isVec(M.playerSpawn)) err('mission.playerSpawn', 'Vec3');
    const obs = recs('mission.objectives', M.objectives); uniq('mission.objectives', obs.map(o => (o as any)?.id));
    const count = { reach: 0, drive: 0, exfil: 0 };
    obs.forEach((o, i) => {
      if (!isObj(o)) return; const w = `mission.objectives[${i}] '${show(o.id)}'`;
      if (o.kind === 'reach') { count.reach++; known(w, o, KEYS.reach); if (!isRect(o.area)) err(w, 'area rect'); else known(`${w}.area`, o.area, KEYS.rect); doorOk(`${w}.door`, o.door); }
      else if (o.kind === 'drive') { count.drive++; known(w, o, KEYS.drive); if (!(Number.isInteger(o.rackIndex) && o.rackIndex >= 0)) err(w, 'rackIndex integer ≥ 0'); if (!isVec(o.front)) err(w, 'front Vec3'); if (!(isNum(o.halfW) && o.halfW >= 0)) err(w, 'halfW ≥ 0'); }
      else if (o.kind === 'exfil') { count.exfil++; known(w, o, KEYS.exfil); doorOk(`${w}.door`, o.door); if (!isNum(o.x) || !isNum(o.z)) err(w, 'x/z numbers'); }
      else err(w, `kind '${show((o as any).kind)}'`);
    });
    for (const k of ['reach', 'drive', 'exfil'] as const) if (count[k] !== 1) err('mission.objectives', `v${LEVEL_DATA_VERSION} wants exactly one '${k}' objective (found ${count[k]})`);
  }
  // breaker / beacons / sky
  if (!isObj(d.breaker) || !isVec(d.breaker.pos)) err('breaker', 'pos Vec3'); else { known('breaker', d.breaker, KEYS.breaker); boxOk('breaker.panel', d.breaker.panel); boxOk('breaker.led', d.breaker.led); }
  const bcs = recs('beacons', d.beacons); uniq('beacons', bcs.map(b => (b as any)?.id));
  bcs.forEach((b, i) => { if (!isObj(b)) return; const w = `beacons[${i}]`; known(w, b, KEYS.beacon); if (!isVec(b.pos)) err(w, 'pos Vec3'); boxOk(`${w}.box`, b.box); if (isStr(b.box) && boxIds.has(b.box) && !swBox.has(b.box)) err(w, `box '${show(b.box)}' is not owned by any switchable (game.ts slaves the beacon's beam to that target)`); });
  const skyOk = (w: string, s: SkyData | undefined) => { if (!isObj(s) || !isVec(s!.zenith) || !isVec(s!.horizon)) err(w, 'zenith / horizon Vec3'); else known(w, s, KEYS.sky); };
  skyOk('sky', d.sky);
  // daylight
  if (d.daylight !== undefined) {
    const D = d.daylight;
    if (!isObj(D)) err('daylight', 'must be an object');
    else {
      known('daylight', D, KEYS.daylight); lightOk('daylight.sun', D.sun); if (isObj(D.sun) && D.sun.kind !== 'dir') err('daylight.sun', "kind must be 'dir'"); if (isObj(D.sun) && !isStr(D.sun.id)) err('daylight.sun', 'id'); skyOk('daylight.sky', D.sky);
      for (const k of ['groupsOn', 'groupsOff', 'lightsOff'] as const) if (!(Array.isArray(D[k]) && D[k].every(isStr))) err(`daylight.${k}`, 'string[]');
      if (Array.isArray(D.lightsOff)) D.lightsOff.forEach((id, i) => { if (!isStr(id) || !lightIds.has(id)) err(`daylight.lightsOff[${i}]`, `unknown light '${show(id)}'`); });
      if (!(isNum(D.haze) && D.haze >= 0)) err('daylight.haze', '≥ 0'); if (!(isNum(D.exposure) && D.exposure > 0)) err('daylight.exposure', '> 0');
    }
  }
  // plans
  /** every leaf under v is a finite number, a string or a boolean (arrays / records recursed) — the generic check for plan fields this file does not name */
  const finiteOk = (w: string, v: unknown, depth = 0): void => {
    if (depth > 12) { err(w, 'nested too deep'); return; }
    if (typeof v === 'number') { if (!Number.isFinite(v)) err(w, `non-finite number ${v}`); return; }
    if (typeof v === 'string' || typeof v === 'boolean') return;
    if (Array.isArray(v)) { v.forEach((x, i) => finiteOk(`${w}[${i}]`, x, depth + 1)); return; }
    if (isObj(v)) { for (const k of Object.keys(v as object)) if ((v as any)[k] !== undefined) finiteOk(`${w}.${k}`, (v as any)[k], depth + 1); return; }
    err(w, `unexpected ${v === null ? 'null' : typeof v}`);
  };
  const planOk = (w: string, p: RoomClearPlanData) => {
    if (!isObj(p)) { err(w, 'must be an object'); return; }
    finiteOk(w, p);
    doorOk(`${w}.door`, p.door); if (p.breach !== undefined && p.breach !== 'kick' && p.breach !== 'open') err(w, "breach 'kick' | 'open'"); if (p.bounds !== undefined && !isRect(p.bounds)) err(w, 'bounds rect');
    const pair = (k: string, v: unknown, each: (x: unknown) => boolean) => { if (!(Array.isArray(v) && v.length === 2 && v.every(each))) err(w, `${k} must be a pair`); };
    const vecs = (x: unknown) => Array.isArray(x) && x.every(e => isVec(e));
    if (p.from !== undefined) pair('from', p.from, x => isVec(x));
    pair('stack', p.stack, x => isVec(x)); pair('stackFace', p.stackFace, isNum); pair('stackAim', p.stackAim, x => isVec(x)); if (p.stackSide !== 1 && p.stackSide !== -1) err(w, 'stackSide ±1');
    if (!isVec(p.kickFrom) || !isNum(p.kickFace) || !isNum(p.fling)) err(w, 'kickFrom Vec3, kickFace / fling numbers');
    pair('entry', p.entry, x => vecs(x) && (x as unknown[]).length > 0); pair('podFace', p.podFace, isNum); pair('entryAim', p.entryAim, vecs);
    if (!vecs(p.searchPath) || !isNum(p.searchFace) || !vecs(p.searchAimWalk) || !vecs(p.searchAimThere)) err(w, 'search fields'); if (!vecs(p.underAim) || !isVec(p.upAim)) err(w, 'underAim Vec3[] / upAim Vec3');
    pair('formUp', p.formUp, vecs); pair('formFace', p.formFace, isNum);
    if (!isObj(p.lines) || ['stack1', 'stack2', 'go2', 'in1', 'side2', 'side1', 'push1', 'under2', 'nothing2', 'corner1', 'empty2', 'radio1'].some(k => typeof (p.lines as any)[k] !== 'string')) err(w, 'lines: all twelve strings');
  };
  if (!isObj(d.plans)) err('plans', 'missing (may be { roomClear: [] })');
  else {
    known('plans', d.plans, KEYS.plans);
    const rc = recs('plans.roomClear', d.plans.roomClear); uniq('plans.roomClear', rc.map(p => (p as any)?.id)); rc.forEach((p, i) => planOk(`plans.roomClear[${i}] '${show((p as any)?.id)}'`, p));
    const B = d.plans.breach;
    if (B !== undefined) {
      if (!isObj(B)) err('plans.breach', 'must be an object');
      else {
        // the RoomClearPlan half is checked field by field (planOk); the breach's own fields belong to game/breach.ts and change with its choreography, so
        // here they only get the generic finite-leaf pass (inside planOk) plus the one shape every version has had: men on marks
        const w = `plans.breach '${show(B.id)}'`; if (!isStr(B.id)) err('plans.breach', 'id'); planOk(w, B);
        const hs = recs(`${w}.hostiles`, B.hostiles); if (!hs.length) err(w, 'hostiles: at least one');
        hs.forEach((h, i) => { if (!isObj(h)) return; if (!isVec(h.pos) || !isNum(h.yaw) || !isVec(h.aimAt)) err(`${w}.hostiles[${i}]`, 'pos / aimAt Vec3, yaw'); });
      }
    }
  }
  return errs;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ floor references
/** EVERY place the format names a floor id (floorOk above + the connector ends): the top-level array and, per record, the floor(s) it names and the record put on
 *  another floor. The editor's delete refusal, its rename rewrite and lint's per-floor tally all walk THIS table, so a collection that gains a `floor` field is
 *  added once, here (review T4.6: delete checked four of the eight, rename six). A record with no floor means floors[0] and is nobody's reference. */
export const FLOOR_USERS: readonly { key: 'boxes' | 'props' | 'doors' | 'volumes' | 'chokepoints' | 'devices' | 'civilians' | 'connectors'; refKind: string; floors: (e: any) => (string | undefined)[]; rewrite: (e: any, from: string, to: string) => any }[] = [
  ...(['boxes', 'props', 'doors', 'volumes', 'chokepoints', 'devices', 'civilians'] as const).map(key => ({ key, refKind: ({ boxes: 'box', props: 'prop', doors: 'door', volumes: 'volume', chokepoints: 'chokepoint', devices: 'device', civilians: 'civilian' } as const)[key], floors: (e: any) => [e?.floor], rewrite: (e: any, _from: string, to: string) => ({ ...e, floor: to }) })),
  { key: 'connectors', refKind: 'connector', floors: (e: any) => [e?.from?.floor, e?.to?.floor], rewrite: (e: any, from: string, to: string) => ({ ...e, from: e.from?.floor === from ? { ...e.from, floor: to } : e.from, to: e.to?.floor === from ? { ...e.to, floor: to } : e.to }) },
];
export interface FloorUser { key: typeof FLOOR_USERS[number]['key']; id: string; index: number; /** the editor's selection ref ('box:<id>', 'civilian:<id>' …) */ ref: string; /** a deep copy of the record moved onto floor `to` */ rewrite: (to: string) => any }
/** every record naming floor `floorId` explicitly */
export function floorUsers(d: LevelData, floorId: string): FloorUser[] {
  const out: FloorUser[] = [];
  for (const U of FLOOR_USERS) { const arr = (d as any)[U.key]; if (!Array.isArray(arr)) continue; arr.forEach((e: any, index: number) => { if (e && typeof e === 'object' && U.floors(e).includes(floorId)) out.push({ key: U.key, id: String(e.id), index, ref: `${U.refKind}:${e.id}`, rewrite: to => U.rewrite(copyPlain(e), floorId, to) }); }); }
  return out;
}

/** JSON.parse + validate; throws with every problem listed. */
export function parseLevelData(text: string): LevelData {
  const d = JSON.parse(text) as LevelData; const errs = validateLevelData(d);
  if (errs.length) throw new Error(`level '${(d as any)?.name ?? '?'}': ${errs.length} error(s)\n  ${errs.slice(0, 20).join('\n  ')}${errs.length > 20 ? `\n  … ${errs.length - 20} more` : ''}`);
  return d;
}
/** JSON.parse + validate WITHOUT refusing a document that has problems — for the editor's RESTORE paths (the autosave slot, a session's own text), where a level
 *  with, say, one marking off its face must still open, its problems listed, rather than be silently replaced by another level and then overwritten (review
 *  T4.1). Throws only when the text is not JSON, not a v1 level object, or so misshapen that its canonical form cannot be built (a collection that is not an
 *  array, a record that is not an object) — those nobody can edit back into shape from inside the editor. `data` is the CANONICAL deep copy. */
export function parseLevelDataLenient(text: string): { data: LevelData; errors: string[] } {
  const d = JSON.parse(text) as LevelData;
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('level: the text is JSON but not a level object');
  if ((d as any).version !== LEVEL_DATA_VERSION) throw new Error(`level: version ${JSON.stringify((d as any).version)} — this build reads v${LEVEL_DATA_VERSION} only`);
  const errors = validateLevelData(d);
  let data: LevelData;
  try { data = canonicalLevelData(d); }
  catch (e) { throw new Error(`level '${(d as any)?.name ?? '?'}': too misshapen to open (${(e as Error)?.message ?? e}) — ${errors.length} validation error(s)\n  ${errors.slice(0, 12).join('\n  ')}`); }
  return { data, errors };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ canonical form
// Every record rebuilt with its keys in schema order (KEYS) and undefined-valued keys dropped: what the serializer prints and the digest hashes, so two
// LevelData values that MEAN the same level serialize to the same bytes whatever order an editor assembled them in. The result is a DEEP COPY (every array
// and record new): safe to use as a working buffer without touching the input (OFFICE_DATA is the bundle's one object).
/** deep copy of plain JSON data (arrays / records / leaves), undefined-valued keys dropped, key order kept */
function copyPlain<T>(v: T): T { if (Array.isArray(v)) return v.map(copyPlain) as unknown as T; if (v && typeof v === 'object') { const o: any = {}; for (const k of Object.keys(v)) { const x = (v as any)[k]; if (x !== undefined) o[k] = copyPlain(x); } return o; } return v; }
/** the record with only `keys`, in that order, values deep-copied */
function pick<T extends object>(o: T, keys: readonly string[]): T { const out: any = {}; for (const k of keys) { const v = (o as any)[k]; if (v !== undefined) out[k] = copyPlain(v); } return out; }
const canonLight = (l: LightData): LightData => pick(l, KEYS.light);
const canonMarking = (m: MarkingDef): MarkingDef => ({ ...pick(m, KEYS.marking), pal: (m.pal ?? []).map(p => pick(p, KEYS.markpal)) });
/** Preferred key order inside the drill plans, at any depth: the fields RoomClearPlan / BreachPlan have had, in reading order. canonBlob puts keys it knows
 *  in this order and anything newer AFTER them alphabetically — so the plans stay readable, serialize identically whatever order they were assembled in, and a
 *  field added to BreachPlan by a later lane is carried, not dropped (this list is a preference, never a filter). */
const PLAN_KEY_ORDER = ['id', 'door', 'room', 'breach', 'bounds', 'x0', 'x1', 'z0', 'z1', 'from', 'stack', 'stackFace', 'stackSide', 'stackAim', 'kickFrom', 'kickFace', 'fling',
  'aside', 'retreat', 'toss', 'mark', 'face', 'land', 'hostiles', 'pos', 'yaw', 'crouch', 'aimAt', 'entry', 'podFace', 'entryAim', 'flow', 'into', 'centre', 'corner', 'cornerAim', 'hold', 'targets', 'next',
  'searchPath', 'searchFace', 'searchAimWalk', 'searchAimThere', 'underAim', 'upAim', 'formUp', 'formFace',
  'lines', 'stack1', 'stack2', 'go2', 'in1', 'side2', 'side1', 'push1', 'under2', 'nothing2', 'corner1', 'empty2', 'breachLines', 'breach1', 'bang2', 'going1', 'clear1', 'clear2', 'roomClear1', 'next1'];   // ('radio1' closes both `lines` and `breachLines`: left unranked it sorts after every ranked key in either record, which is where it reads)
const PLAN_RANK = new Map(PLAN_KEY_ORDER.map((k, i) => [k, i]));
/** generic canonical form for a JSON blob: records re-keyed (known keys in PLAN_KEY_ORDER order, the rest alphabetical), undefined dropped, arrays in order */
function canonBlob<T>(v: T): T {
  if (Array.isArray(v)) return v.map(canonBlob) as unknown as T;
  if (v && typeof v === 'object') {
    const keys = Object.keys(v).filter(k => (v as any)[k] !== undefined).sort((a, b) => { const ra = PLAN_RANK.get(a), rb = PLAN_RANK.get(b); return ra !== undefined && rb !== undefined ? ra - rb : ra !== undefined ? -1 : rb !== undefined ? 1 : a < b ? -1 : a > b ? 1 : 0; });
    const o: any = {}; for (const k of keys) o[k] = canonBlob((v as any)[k]); return o;
  }
  return v;
}
const canonPlan = <T extends RoomClearPlanData>(p: T): T => canonBlob(p);
export function canonicalLevelData(d: LevelData): LevelData {
  const mats: Record<string, MaterialData> = {}; for (const k of Object.keys(d.materials)) mats[k] = pick(d.materials[k], KEYS.material);   // (insertion order of materials is kept: it is the palette's authored order)
  const rect = (r: Rect): Rect => pick(r, KEYS.rect);
  return {
    version: d.version, name: d.name,
    meta: { ...pick(d.meta, KEYS.meta), ...(d.meta.bounds ? { bounds: pick(d.meta.bounds, KEYS.bounds) } : {}) },
    floors: d.floors.map(f => pick(f, KEYS.floor)),
    materials: mats,
    ...(d.surfaces ? { surfaces: { ...pick(d.surfaces, KEYS.surfaces), building: rect(d.surfaces.building), zones: d.surfaces.zones.map(z => pick(z, KEYS.zone)) } as SurfacesData } : {}),
    boxes: d.boxes.map(b => ({ ...pick(b, KEYS.box), ...(b.markings ? { markings: b.markings.map(canonMarking) } : {}) })),
    props: d.props.map(p => ({ ...pick(p, KEYS.prop), parts: p.parts.map(q => ({ ...pick(q, KEYS.part), ...(q.markings ? { markings: q.markings.map(canonMarking) } : {}) })) })),
    lights: d.lights.map(canonLight),
    switchables: d.switchables.map(s => pick(s, KEYS.switchable)),
    doors: d.doors.map(o => pick(o, KEYS.door)),
    routes: d.routes.map(r => pick(r, KEYS.route)),
    chokepoints: d.chokepoints.map(c => pick(c, KEYS.chokepoint)),
    ...(d.civilians ? { civilians: d.civilians.map(c => pick(c, KEYS.civilian)) } : {}),
    volumes: d.volumes.map(v => pick(v, KEYS.volume)),
    devices: d.devices.map(v => v.kind === 'camera' ? pick(v, KEYS.camera) : v.kind === 'keypad' ? pick(v, KEYS.keypad) : pick(v, KEYS.laser)),
    ...(d.vents ? { vents: d.vents.map(v => pick(v, KEYS.vent)) } : {}),
    connectors: d.connectors.map(c => ({ ...pick(c, KEYS.connector), from: pick(c.from, KEYS.connEnd), to: pick(c.to, KEYS.connEnd) })),
    mission: { ...pick(d.mission, KEYS.mission), objectives: d.mission.objectives.map(o => o.kind === 'reach' ? { ...pick(o, KEYS.reach), area: rect(o.area) } : o.kind === 'drive' ? pick(o, KEYS.drive) : pick(o, KEYS.exfil)) },
    breaker: pick(d.breaker, KEYS.breaker),
    beacons: d.beacons.map(b => pick(b, KEYS.beacon)),
    sky: pick(d.sky, KEYS.sky),
    ...(d.daylight ? { daylight: { ...pick(d.daylight, KEYS.daylight), sun: canonLight(d.daylight.sun), sky: pick(d.daylight.sky, KEYS.sky) } } : {}),
    plans: { roomClear: d.plans.roomClear.map(canonPlan), ...(d.plans.breach ? { breach: canonPlan(d.plans.breach) } : {}) },
  };
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ serialize / digest
/** Compact one-line JSON with a space after ':' and ',' (numbers in their shortest round-trip form — what JSON.stringify prints). */
function compact(v: unknown): string {
  if (Array.isArray(v)) { const parts: string[] = []; for (let i = 0; i < v.length; i++) { const x = v[i]; if (x === undefined || typeof x === 'function' || (typeof x === 'number' && !Number.isFinite(x))) throw new Error(`serializeLevelData: unwritable array element [${i}] (${String(x)}) — validate before saving`); parts.push(compact(x)); } return `[${parts.join(', ')}]`; }   // (by index: a hole reads as undefined and is refused too)
  if (v && typeof v === 'object') return `{ ${Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => `${JSON.stringify(k)}: ${compact(x)}`).join(', ')} }`;
  if (typeof v === 'number' && !Number.isFinite(v)) throw new Error(`serializeLevelData: non-finite number ${v} — validate before saving`);
  return JSON.stringify(v);
}
/** The level file's text: canonical key order, top-level keys one per line, every entity (box, prop, light, route, plan…) on ONE line — so `git grep`
 *  finds a box by id or coordinate, a diff is a list of changed entities, and a hand edit touches one line. Parses with plain JSON.parse. */
export function serializeLevelData(data: LevelData): string {
  const d = canonicalLevelData(data) as unknown as Record<string, unknown>;
  const lines: string[] = ['{'];
  const keys = Object.keys(d);
  keys.forEach((k, ki) => {
    const v = d[k]; const last = ki === keys.length - 1 ? '' : ',';
    if (Array.isArray(v)) {
      if (!v.length) { lines.push(`  ${JSON.stringify(k)}: []${last}`); return; }
      lines.push(`  ${JSON.stringify(k)}: [`); v.forEach((e, i) => lines.push(`    ${compact(e)}${i === v.length - 1 ? '' : ','}`)); lines.push(`  ]${last}`);
    } else if (v && typeof v === 'object' && (k === 'materials' || k === 'plans' || k === 'daylight' || k === 'surfaces' || k === 'mission')) {
      // records of records: one member per line (materials by name; plans.roomClear one plan per line; daylight / surfaces / mission field per line)
      const o = v as Record<string, unknown>; const oks = Object.keys(o).filter(x => o[x] !== undefined);
      lines.push(`  ${JSON.stringify(k)}: {`);
      oks.forEach((x, i) => {
        const e = o[x]; const l2 = i === oks.length - 1 ? '' : ',';
        if (Array.isArray(e) && e.length && e.every(y => y && typeof y === 'object' && !Array.isArray(y))) { lines.push(`    ${JSON.stringify(x)}: [`); e.forEach((y, j) => lines.push(`      ${compact(y)}${j === e.length - 1 ? '' : ','}`)); lines.push(`    ]${l2}`); }
        else lines.push(`    ${JSON.stringify(x)}: ${compact(e)}${l2}`);
      });
      lines.push(`  }${last}`);
    } else lines.push(`  ${JSON.stringify(k)}: ${compact(v)}${last}`);
  });
  lines.push('}');
  return lines.join('\n') + '\n';
}

/** A stable 52-bit content hash (hex) of the CANONICAL compact JSON — identity checks between an exported file, a loaded level converted back, an editor's
 *  buffer. Not cryptographic. (−0 prints as 0 and undefined keys vanish, exactly as they do in the file.) */
export function levelDataDigest(d: LevelData): string {
  const s = JSON.stringify(canonicalLevelData(d));
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0) & 0xfffff).toString(16).padStart(5, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

/** Every structural difference between two JSON-ish values (Levels, LevelData, anything): missing / extra keys (an undefined-valued key counts as absent),
 *  array length, type, and leaf inequality by === (so −0 equals 0, as it does once written to a file). Paths like `boxes[412].c[1]`. Stops collecting
 *  after `limit` entries but keeps COUNTING: returns the total. The identity gate between the procedural level and the loaded one is `0`. */
export function structuralDiff(a: unknown, b: unknown, out: string[] = [], limit = 50, path = '$'): number {
  let n = 0;
  const note = (msg: string) => { n++; if (out.length < limit) out.push(`${path}: ${msg}`); };
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) { note(`array vs ${Array.isArray(a) ? typeof b : typeof a}`); return n; }
    if (a.length !== b.length) note(`length ${a.length} vs ${b.length}`);
    for (let i = 0; i < Math.min(a.length, b.length); i++) n += structuralDiff(a[i], b[i], out, limit, `${path}[${i}]`);
    return n;
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a).filter(k => (a as any)[k] !== undefined), kb = new Set(Object.keys(b).filter(k => (b as any)[k] !== undefined));
    for (const k of ka) { if (!kb.has(k)) { note(`key '${k}' only on the left (${JSON.stringify((a as any)[k])?.slice(0, 60)})`); continue; } n += structuralDiff((a as any)[k], (b as any)[k], out, limit, `${path}.${k}`); kb.delete(k); }
    for (const k of kb) note(`key '${k}' only on the right (${JSON.stringify((b as any)[k])?.slice(0, 60)})`);
    return n;
  }
  if (a !== b) note(`${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return n;
}

// ------------------------------------------------------------------------------------------------------------------------------------------------ id helpers (for the editor)
/** id → array index for every id-bearing array, built once per LevelData (the editor's lookups; loadLevel builds its own). */
export function indexLevelData(d: LevelData) {
  const ix = (a: { id: string }[]) => { const m = new Map<string, number>(); a.forEach((e, i) => m.set(e.id, i)); return m; };
  return { boxes: ix(d.boxes), props: ix(d.props), lights: ix(d.lights), switchables: ix(d.switchables), doors: ix(d.doors), routes: ix(d.routes), chokepoints: ix(d.chokepoints), volumes: ix(d.volumes), devices: ix(d.devices), vents: ix(d.vents ?? []), connectors: ix(d.connectors), beacons: ix(d.beacons), roomClear: ix(d.plans.roomClear) };
}
/** A fresh id with the given prefix that no entry of `existing` carries: prefix_0000, prefix_0001, … from max+1 of the ones already numbered that way. */
export function freshId(prefix: string, existing: Iterable<{ id: string }>): string {
  let max = -1; const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(\\d+)$`);
  for (const e of existing) { const m = re.exec(e.id); if (m) max = Math.max(max, Number(m[1])); }
  return `${prefix}_${String(max + 1).padStart(4, '0')}`;
}
