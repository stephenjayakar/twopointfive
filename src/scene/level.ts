// The level the game RUNS: the runtime types (Level — Box[] with bit flags and array indices, LightDef[], PropDef[], doors, routes, plans…) every game
// module imports from here, and buildLevel(), which is now a LOADER: the office is data (levels/office.json, schema in scene/levelData.ts) bundled into
// the build by this import and turned into a Level by scene/levelLoad.ts loadLevel(). The procedural code that used to BE this file lives on as the legacy
// generator (scene/officeGen.ts) that tools/level-export.ts regenerates the JSON from. Units: meters. +X east, +Z south, +Y up. Floor top at y=0.
import { Vec3, DEG } from '../math/vec';
import type { Box } from './boxes';
import type { MarkingDef } from './markings';
import type { LevelData, SurfacesData } from './levelData';
import { loadLevel } from './levelLoad';
import { parseLevelData } from './levelData';
import officeData from '../../levels/office.json' with { type: 'json' };
import officeReliefData from '../../levels/office-relief.json' with { type: 'json' };   // the office BEFORE the markings lane's demotion pass: main's boxes exactly (tools/level-export.ts --relief) — ?level=relief boots on it for the ray-cost A/B and the identity hashes
import type { WeaponId } from '../game/weapons';   // (type only: what a route may hand its man — erased at runtime, so the scene layer still loads below the game's)
import type { LevelScriptFn } from '../game/director';   // (type only, likewise: the level's script is a plain function handed to game/director.ts)
import type { LevelScenarios } from './scenarios';
import { OFFICE_SCENARIOS } from '../../levels/office.scenarios';   // the office's scenario data (plain literals, type-only imports): what the night breach / room clear / rescue take from this level

export interface LightDef {
  kind: 'point' | 'spot' | 'dir';
  pos: Vec3; dir: Vec3;
  color: Vec3;         // linear rgb, multiplied by intensity
  intensity: number;   // point/spot: candela-ish; dir: irradiance (lux-ish)
  range: number;
  innerDeg: number; outerDeg: number;
  name: string;
  group: string;       // for UI toggles / OCP ("ceiling", "exterior", "desk", ...)
  mains?: boolean;     // fed from the building breaker (default true) — false for street lighting etc.
  broad?: boolean;     // wide soft emitter → the direct pass's 'broad' denoise class (street lamps; area lights derived from fixtures set it themselves)
  fixtureBox?: number; // index of the emissive box representing the fixture (glow card)
  enabled: boolean;
  volumetric: number;  // 0..1 haze scattering multiplier for beams
  radius?: number;     // physical emitter size (m) → penumbra width; for 'dir' lights the angular radius in radians
}

/** One man's beat. `weapon`: the weapons.ts row he carries (absent = the 9 mm service pistol) — dealt at spawn (game.ts Guard); nobody on this level is authored one
 *  yet (the carbine lanes decide who: docs/internal/sc20k-design.md §3.5). `keys`: the keys on his belt, by lock name (doors.ts DoorDef.lock) — what Sam takes off
 *  him when he gives the keyed door up under questioning (player.ts takeKey); absent = the floor key every man on nights carries (doors.ts FLOOR_KEY). The leaves
 *  themselves treat every man on the staff as keyed (game.ts updateDoors, `key: true`): a route authored keyless would want that contact narrowed too. */
export interface PatrolRoute { name: string; points: Vec3[]; wait: number[]; weapon?: WeaponId; keys?: string[]; }
/** A corridor junction one man can hold in a lockdown (game/guards.ts): planted at `pos` facing `yaw` (Character convention: forward = [sin yaw, 0, cos yaw]), sweeping. */
export interface Chokepoint { name: string; pos: Vec3; yaw: number; }
/** What a civilian does at a waypoint of her loop while its wait runs (game/civilians.ts words and poses each): stand (nothing), wipe (a desk / a counter, hands
 *  working at it), bin (kneel and empty it), sit (at the desk there, typing — the late worker's), cooler / printer / shelf (stand at the thing and use it). */
export type CivilianTask = 'stand' | 'wipe' | 'bin' | 'sit' | 'cooler' | 'printer' | 'shelf';
export const CIVILIAN_TASKS: CivilianTask[] = ['stand', 'wipe', 'bin', 'sit', 'cooler', 'printer', 'shelf'];
/** One of the building's own night people (game/civilians.ts): a cleaner, a late worker. `name` is what the men call her; `kind` picks her rules of the two;
 *  `tint` / `tint2` the tabard-or-shirt and the trousers; the loop is a patrol route's shape — `points` walked in order at a walk, `wait` seconds stood at each —
 *  plus, per waypoint, the `tasks` done there while the wait runs and the yaw she does it `face`-ing (Character convention; absent = as she arrived). She starts
 *  on points[0]. Nothing else about her is authored: no weapon, no keys, no torch, no radio. */
export interface CivilianDef { name: string; kind: 'cleaner' | 'worker'; tint: Vec3; tint2?: Vec3; points: Vec3[]; wait: number[]; tasks?: CivilianTask[]; face?: number[]; }
/** The geometry and the talk for two men clearing one room (game/squad.ts RoomClear runs it: the tour stages the conference room with its own plan in demo.ts,
 *  the live AI takes `Level.clearPlans` in a lockdown). #1 is the point man: he stacks on the jamb, breaches and takes the open side of the room deep; #2 covers
 *  high behind him, follows him in a beat later onto the door side (the dead space behind an inward-opening leaf is his), then drops to a knee and puts his
 *  light under the furniture while #1 pushes up his wall. Every position must be reachable in a straight, clear leg from the one before it (the nav grid knows
 *  nothing of chairs); faces are body yaws (Character.forward = [sin, 0, cos]); aim lists are corners the muzzle visits in order. */
export interface RoomClearPlan {
  door: string;                                                        // Doors.byName — staged: the caller shuts and latches it before start(); live: taken as found (open = no breach, just the shove and in)
  room?: string;                                                       // what they call it on the net ('server room'): the live dispatcher's own lines
  breach?: 'kick' | 'open';                                            // a shut leaf: the boot (staged, or a door nobody has a key to) or — the default is 'kick' only because the tour's plan predates the field — unlatch it keyed and shove it hard into the room ('open': what staff do to their own doors)
  bounds?: { x0: number; x1: number; z0: number; z1: number };         // the room's floor inside its walls (plan validation)
  from?: [Vec3, Vec3];                                                 // staged only: where start() stands the pair before they walk into the stack (live, they come as they are)
  stack: [Vec3, Vec3]; stackFace: [number, number]; stackSide: -1 | 1; stackAim: [Vec3, Vec3];
  kickFrom: Vec3; kickFace: number; fling: number;                    // #1's breaching mark (Doors.kickSpot: square to the leaf, 0.76 m off it, by the lock), and the signed leaf velocity that throws it INTO the room (kick or shove)
  entry: [Vec3[], Vec3[]]; podFace: [number, number]; entryAim: [Vec3[], Vec3[]];   // waypoints through the doorway to each point of domination (the last one), the facing held there, the sector swept getting there
  searchPath: Vec3[]; searchFace: number; searchAimWalk: Vec3[]; searchAimThere: Vec3[];   // #1: up his wall to the far corner, checking ahead as he goes, then across the room from there
  underAim: Vec3[]; upAim: Vec3;                                       // #2: on a knee at his point, light under the table end to end, then back up onto his wall
  formUp: [Vec3[], Vec3[]]; formFace: [number, number];               // waypoints back to the door (last = where each waits), facing there
  lines: { stack1: string; stack2: string; go2: string; in1: string; side2: string; side1: string; push1: string; under2: string; nothing2: string; corner1: string; empty2: string; radio1: string };
}

/** The breach drill's plan (game/breach.ts BreachDrill — written for the removed daytime showcase, run live by the night breach): a RoomClearPlan for the door the pair takes (stack marks and the
 *  kick are the drill's own fields and mean what they mean there) plus what only a hot breach has — the men waiting inside on their marks, #1's step BACK off
 *  the doorway after his boot (his own side of the frame: he never crosses the open threshold), #2's mark tight on the jamb with the stun charge in his support
 *  hand and where it lands, each man's flow through the room (battle drill six: through the fatal funnel a stride and a half, check the centre, engage what
 *  stands in it, turn to HIS corner and clear it, hold his sector from his point of domination — the two ending in an L, #2's point covering the room's next
 *  door), whom each engages on the way, and the next threshold both then stack on. entry / entryAim / searchPath etc. stay authored (entry = the flows' own
 *  legs) so RoomClear can dry-run the same door. */
export interface BreachPlan extends RoomClearPlan {
  /** unit XZ pointing through the doorway INTO the room (where the muzzles go once the leaf is off: breach.ts) — absent = +x, the break room's west door, the
   *  only door the level's own plan takes; a plan built in code for another door (game/rescue.ts: the manager's office, north of the corridor) says its own */
  inward?: [number, number];
  /** the opposition: pinned on these marks facing `yaw`, muzzle on `aimAt` (the doorway, mostly) — one standing in the room's middle for #1's centre check */
  hostiles: { pos: Vec3; yaw: number; crouch?: boolean; aimAt: Vec3 }[];
  /** #1 the frame his sole meets the leaf: the step back to this mark on his own side of the frame (strafing, chest kept on `face` = the doorway) */
  retreat: { mark: Vec3; face: number };
  /** #2 while #1 steps out to kick: up the wall to this mark tight on the latch jamb facing `face`, the charge in his support hand; it leaves the hand the moment
   *  the leaf clears and comes down at `land` inside */
  toss: { mark: Vec3; face: number; land: Vec3 };
  /** each man's flow once the charge has gone off (#1 first, #2 on his heels) — see BreachFlow */
  flow: [BreachFlow, BreachFlow];
  /** hostile indices each man engages, in order: on his centre check, then in his sector as he turns to his corner (every line checked clear of the other man's leg) */
  targets: [{ centre: number[]; corner: number[] }, { centre: number[]; corner: number[] }];
  /** the room's NEXT threshold — the door #2 ends up holding from his point, and the stack both then take on it: #2 nearest the leaf (he becomes the point),
   *  #1 tucked in behind, bladed with the wall on `stackSide`, muzzles on `stackAim`; `via` = a lane through the room clear of its furniture, in order from the
   *  entry side, for a man whose straight walk to his mark is blocked (breach.ts legTo takes as much of it as it needs) */
  next: { door: string; stack: [Vec3, Vec3]; stackFace: [number, number]; stackSide: -1 | 1; stackAim: [Vec3, Vec3]; via?: Vec3[] };
  /** what they say that the drill does not: #1 stepping out to breach, the charge going in, the entry, each man's corner as he clears it, the room called, the
   *  word for the next door, the radio line */
  breachLines: { breach1: string; bang2: string; going1: string; clear1: string; clear2: string; roomClear1: string; next1: string; radio1: string };
}
/** One man's way through the room (game/breach.ts OpFlow runs it): `into` = waypoints through the doorway to the spot a stride and a half inside where he checks
 *  the centre (last point; the first should be the doorway's mouth on his side so he takes the frame square), `centre` = the muzzle's check across the room's
 *  middle (from → to, ~0.3 s), `corner` = waypoints on to his point of domination (last), `podFace` = the body yaw held there, `cornerAim` = the sweep that
 *  clears HIS corner on the way (sector edge → … → into the corner itself), `hold` = where the muzzle rests once he owns his sector (for #2: the next door). */
export interface BreachFlow { into: Vec3[]; centre: [Vec3, Vec3]; corner: Vec3[]; podFace: number; cornerAim: Vec3[]; hold: Vec3 }
/** The daytime lighting variant the breach showcase swaps in (game/lighting.ts setDaylight): one directional SUN raking in through the south and lobby glazing, a
 *  lifted blue-white sky, every interior fixture group lit (it is ten in the morning: the fluorescents are all on), the street lighting and the moon out, a touch
 *  more haze so the window shafts read. Reversible by construction: setDaylight(false) puts every switch, light and sky value back as it found them. */
export interface DaylightDef {
  sun: LightDef;
  sky: { zenith: Vec3; horizon: Vec3 };
  /** light-target groups switched fully on / fully off for the day (game.ts LightTarget.group) */
  groupsOn: string[]; groupsOff: string[];
  /** individual analytic lights disabled outright (the moon: it is a level light with no target of its own) */
  lightsOff: string[];
  /** engine.settings.hazeDensity while it is day (the night's is 0.035) */
  haze: number;
  /** engine.settings.exposure while it is day — the operator opens up for an interior lit to office levels and lets the sun patches run hot, as a camera indoors
   *  by day does (the night's 2.0 comes back with the rest) */
  exposure: number;
}

/** locked: a keyed lever set, cylinder on the corridor face (doors.ts DoorDef.locked — guards carry keys; the player picks it or kicks it in, or takes a key off a man he
 *  questions; the room side always opens). lock: which key turns it (doors.ts DoorDef.lock) — absent = the floor key; every keyed door here takes that one. */
export interface LevelDoorDef { name: string; hinge: [number, number]; closedDir: number; width: number; angle?: number; exterior?: boolean; closer?: boolean; minAngle?: number; maxAngle?: number; locked?: boolean; lock?: string; keySide?: 1 | -1; steel?: boolean; /** the side it opens into (doors.ts DoorDef.swing); absent = dealt from the level (game/doorswing.ts) */ swing?: 1 | -1; }   // steel: a fire door a boot only rings off and no pick opens (doors.ts DoorDef.steel — the QRF's west stair door, game/qrf.ts)
/** The level-design devices as the game runs them (game/devices.ts) — the file's records (levelData.ts DeviceData, every field documented there) with the id as
 *  `name`, the way lights and doors carry theirs. Optional fields keep the file's meaning: absent = the default in levelData.ts DEVICE_DEFAULTS. */
export type DeviceDef =
  | { kind: 'camera'; name: string; pos: Vec3; yaw: number; pitch?: number; sweep?: [number, number]; sweepPeriod?: number; fovDeg?: number; range?: number; group?: string; mains?: boolean }
  | { kind: 'keypad'; name: string; pos: Vec3; yaw: number; /** LevelDoorDef.name — that door's `lock` is this keypad's name */ door: string; code: string }
  | { kind: 'laser'; name: string; from: Vec3; to: Vec3; group?: string; mains?: boolean; alarm?: 'suspicion' | 'alarm' };
/** An HVAC supply VENT (game/wind.ts — the file's VentData with the id as `name`): a ceiling / wall diffuser at `pos` (its face centre) blowing along `dir` at
 *  `speed` m/s at the face, a cone of half-angle `spread` degrees whose air slows to half by `reach` m (∝ 1/(1 + (d/reach)²)) and is gone by 2.5 × reach; a jet
 *  aimed at the floor turns along it in its last half metre. `size` = the face's width (m, absent 0.6: the grille and the jet's core); `period` / `duty` / `phase`
 *  = slow cycling (s, on-fraction, offset; absent = steady); `mains` (absent = true): the air handler is on the breaker — the vents spin down in a blackout.
 *  ONE field: it moves the GPU particles (paper trembles and slides under a diffuser, dust drifts) and forces the smoke solver's air (a plume under a vent bends),
 *  so the guards' smoke sight lines follow it for free. */
/** an authored volume at run time (scene/levelData.ts VolumeData: id → name; an oriented box — centre, half-extents, yaw — of a kind) */
export interface VolumeDef { name: string; kind: 'hide' | 'utility' | 'trigger'; c: Vec3; h: Vec3; yaw?: number; }
/** a named mark at run time (a place + a facing) */
export interface MarkDef { name: string; pos: Vec3; yaw?: number; }
export interface VentDef { name: string; pos: Vec3; dir: Vec3; speed: number; spread: number; reach: number; size?: number; period?: number; duty?: number; phase?: number; mains?: boolean; }
export type PropKind = 'chair' | 'cardboard' | 'bin' | 'plant';
/** One box of a loose prop, in the prop's local frame: `off` from the prop origin (on the floor, y up), `yaw` relative to the prop's heading (frameAt / Box.yaw convention);
 *  `marks` = the markings on the part's faces (scene/markings.ts — the tape and glyphs on a carton), carried onto the box props.ts makes of it. */
export interface PropPart { off: Vec3; h: Vec3; yaw: number; albedo: Vec3; marks?: MarkingDef[]; }
/** Loose furniture handed to the physics layer (src/game/props.ts) instead of `boxes`: a rigid group of parts standing on the floor at (x, z) with
 *  heading `yaw`, its collision footprint (half extents of the local XZ rectangle about the origin), overall height and mass (kg). */
export interface PropDef { kind: PropKind; name: string; x: number; z: number; yaw: number; parts: PropPart[]; half: [number, number]; height: number; mass: number; }
export interface Level {
  boxes: Box[];
  /** Chairs, floor-standing cardboard boxes, bins, potted plants. Deliberately NOT in `boxes` (so the static GPU list, StaticCollision and the nav bake
   *  never see them and nothing is baked twice); the game's PropSystem simulates them and emits their boxes as dynamics every frame. */
  props: PropDef[];
  lights: LightDef[];
  /** Emissive ceiling panels etc. that the OCP / UI can switch: name -> box indices */
  switchables: { name: string; boxes: number[]; group: string; on: boolean; baseEmissive: Vec3; flicker?: boolean; mains?: boolean }[];
  playerSpawn: Vec3;
  routes: PatrolRoute[];
  /** lockdown posts (optional: the viewer's stage has none) */
  chokepoints?: Chokepoint[];
  /** rooms the lockdown pair knows how to clear (game/guards.ts planClears picks the nearest to the last fix; optional like the posts) */
  clearPlans?: RoomClearPlan[];
  doors: LevelDoorDef[];
  /** cameras / keypads / laser tripwires (game/devices.ts); optional like the posts — the viewer's stage and older levels have none */
  devices?: DeviceDef[];
  /** HVAC supply vents (game/wind.ts): the ceiling diffusers whose jets move the particles and the smoke; optional — a level with none has still air indoors */
  vents?: VentDef[];
  /** the cleaner, the late worker (game/civilians.ts); optional — a level with none has nobody but the shift on it */
  civilians?: CivilianDef[];
  /** authored volumes (LevelData volumes[] — the editor's V tool): the level script's onEnter triggers test them (game/director.ts); absent = the level authors none */
  volumes?: VolumeDef[];
  /** named marks (LevelData v2 marks[], M3 of docs/design/level-scripting.md — nothing authors them yet: a script declares its own with literals until then) */
  marks?: MarkDef[];
  /** this level's SCRIPT (game/director.ts runs it: bespoke set pieces as named programs); absent = no Director programs, the game exactly as it is — no shipped level has one today */
  script?: LevelScriptFn;
  /** what the playtest SCENARIOS take from this level (scene/scenarios.ts: the room clear's rooms, the rescue's hostage room and marks, where the team starts) —
   *  the level file's own `scenarios` block; for the office, levels/office.scenarios.ts attached at load. Absent = no scenario can be staged on this level */
  scenarios?: LevelScenarios;
  /** what is underfoot (game/floor.ts: which footstep, how far it carries) — the level file's own `surfaces` block, attached by loadLevel NON-ENUMERABLY (it is
   *  an annotation of the file, like its ids: nothing that walks a Level as data sees it). Absent = the office's map, as on every level before this field */
  surfaces?: SurfacesData;
  /** `fumble` (s, absent = 2.2): how long a man sent to the tripped panel works at it before the mains come back */
  breaker: { pos: Vec3; boxes: number[]; fumble?: number };
  beacons: { pos: Vec3; box: number }[];
  sky: { zenith: Vec3; horizon: Vec3 };
  /** the daytime variant (optional: the viewer's stage has none) and the breach drill's plan (game/breach.ts BreachDrill) */
  daylight?: DaylightDef;
  breach?: BreachPlan;
  /** the base texel (m) the level's marking bitmaps were generated for (scene/markings.ts; absent = MARKING_TEXEL 0.025) — main.ts hands it to the engine */
  markTexel?: number;
  /** The one mission thread's geometry (game.ts Mission): the room to reach (floor rectangle) and the door the HUD points at for it, the rack whose drive
   *  gets pulled (its index n names the switchables `rack${n}_leds` / `rack${n}_glow` that go dark; `front` is the marker point on its LED face), the door
   *  to leave by and the x past which you are outside it. */
  mission: { serverRoom: { x0: number; x1: number; z0: number; z1: number }; entryDoor: string; rack: { index: number; front: Vec3; halfW: number }; exfilDoor: string; exfilX: number; exfilZ: number;
    /** the way OUT through the exit, a unit vector on the floor (dx, dz): past (exfilX, exfilZ) going this way is out. Absent = east, [1, 0] — the office's */
    exfilOut?: [number, number] };
}

/** True when THIS boot's level came off the editor's stash (?level=local found one that parsed and validated). The file's validator cannot promise the GAME builds on a
 *  document mid-edit — the drill plans ride through it untyped, a route may name a weapon that is not in the table, a mission block lose its rack — and a stash that
 *  kills the Game constructor killed every boot until somebody cleared localStorage by hand (W8.11); so main.ts, when the constructor throws with this set, logs it and
 *  builds again on buildBundledLevel(). Never set headless or in the bundle's ordinary boot. */
export let bootedLocalLevel = false;
/** The office level, loaded from its data (levels/office.json → loadLevel). A fresh Level every call: the game mutates the one it is given (box flags,
 *  the breach's scratch routes), so nothing may be shared between two boots. The JSON is imported, not fetched — Bun inlines it into the bundle, so the
 *  playable Artifact and the headless harness both get it with no extra asset. */
export function buildLevel(): Level {
  // ?level=local: boot on the level EDITOR's current document (editor ▶ writes it to localStorage 'twopointsix.editorLevel' and opens /?level=local — src/editor)
  bootedLocalLevel = false;
  if (typeof location !== 'undefined' && typeof localStorage !== 'undefined' && new URLSearchParams(location.search).get('level') === 'local') {
    try { const t = localStorage.getItem('twopointsix.editorLevel'); if (t) { const data = parseLevelData(t), lvl = isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); bootedLocalLevel = true; return lvl; } }   // (the editor's document is the office being edited: its scenario data comes with it)
    catch (e) { console.error('?level=local: falling back to the bundled office —', e); }
  }
  return buildBundledLevel();
}
/** The bundled office whatever the stash holds (?level=relief still honoured): the ordinary boot, and the fallback above. */
export function buildBundledLevel(): Level {
  bootedLocalLevel = false;
  if (typeof location !== 'undefined' && new URLSearchParams(location.search).get('level') === 'relief') return withOfficeScript(loadLevel(OFFICE_RELIEF_DATA));   // ?level=relief: the pre-demotion office (main's geometry, no markings)
  return withOfficeScript(loadLevel(OFFICE_DATA));
}
/** attach what the office keeps OUTSIDE its level file to a Level of the office family (the bundled file, relief, a texel variant off the dev server, the editor's document) —
 *  loadLevel itself stays pure data → Level. Today that is its scenario data alone: the office's level script (the night and day showcases) was removed, so the office has no
 *  script and the Director no program (the name stays: every tool that loads a level file calls this). */
export function withOfficeScript(level: Level): Level { return withScenarios(level, OFFICE_SCENARIOS); }
/** attach a level SCRIPT to a Level. The script is CODE, not level data: it rides on the Level as a non-enumerable property, so everything that walks the Level's keys as data
 *  (tools/qa level-identity's generator ≡ JSON diff and key order, levelToData, structuralDiff) sees the level exactly as before, while game/director.ts reads level.script like any field. */
export function withScript(level: Level, script: LevelScriptFn): Level { Object.defineProperty(level, 'script', { value: script, enumerable: false, writable: true, configurable: true }); return level; }
/** the office's scenario data (levels/office.scenarios.ts), unless the file carried a `scenarios` block of its own (loadLevel has put that on the Level as
 *  ordinary data): non-enumerable for the same reason — levels/office.json and everything that walks the office as data stay exactly as they were. */
export function withScenarios(level: Level, scenarios: LevelScenarios): Level { if (!level.scenarios) Object.defineProperty(level, 'scenarios', { value: scenarios, enumerable: false, writable: true, configurable: true }); return level; }
/** is this level file one of the OFFICE family (the bundled file, relief, the texel variants, the editor's document of it) — the levels the office's
 *  scenario data belongs to? Anything else off the dev server (?levelFile=) is its own level: its scenarios are its file's. */
export function isOfficeFamily(data: { name?: string }): boolean { return typeof data.name !== 'string' || data.name === 'office' || data.name.startsWith('office-'); }
/** the office's scenario data (levels/office.scenarios.ts), for whoever must read the office's blocks before a Level is built (main.ts: ?kitview's set loader) */
export { OFFICE_SCENARIOS };
/** the office's level data as bundled (read-only: loadLevel copies everything it hands out) */
export const OFFICE_DATA: LevelData = officeData as unknown as LevelData;
/** the office as it was before the markings lane demoted face relief to markings (levels/office-relief.json — regenerated beside office.json; main's boxes exactly, digest-identical to main's file) */
export const OFFICE_RELIEF_DATA: LevelData = officeReliefData as unknown as LevelData;

export { DEG };
