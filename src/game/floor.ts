// The floor you walk on: ONE material map read by everything that listens to a footstep — the mixer (audio.ts footstep: which sample, how loud, how bright),
// the guards' ears (guards.ts hearingCheck scores the 'step' event's level) and the SOUND meter (player.noise takes the same level). Before this the mixer knew
// carpet from lino (its private surfaceHard) and the AI did not: a violation of the one-model rule. The map reproduces the finishes level.ts lays over the
// interior's carpet base ('interior floor finishes': floor(x0, z0, x1, z1, albedo)) and the exterior ground (asphalt slab, grass strips north and west); rugs,
// runners and mats are decals (NoShadow, a few mm proud) and deliberately do NOT count — the finish under them does — so the corridor is lino wall to wall,
// runner or not, and stays the reference every hearing number was tuned on.
import { Vec3 } from '../math/vec';
import type { Game } from './game';
import type { SurfacesData } from '../scene/levelData';

/** what the level actually has underfoot: the carpet base of every office room, sheet lino (corridor, break room), the lobby's stone, the server room's
 *  raised access floor (hollow steel-cored tiles: 'tile'), the lot's asphalt and the lawn strips */
export type FloorMat = 'carpet' | 'lino' | 'stone' | 'tile' | 'asphalt' | 'grass';

/** Per material: `loud` × the per-step hearing LEVEL (the GameEvent the guards score, player.noise, and the mixer's gain alike — lino = 1 is the reference the
 *  corridor probes were tuned on), `hard` = which of the two footstep samples plays (heel click vs soft scuff), `rate` × the sample's playback rate (stone a touch
 *  brighter, carpet duller — subtle), `label` for the HUD / panel.
 *  What the multipliers come to against guards.ts hearingCheck (a step counts when level × (1 − d/9) × carry > 0.12, d the sound path in metres, calm floor):
 *  a walking step (0.26) carries 4.8 m over lino, 5.2 m over stone, 2.0 m over carpet, nowhere over grass; a crouched one (0.125) a hand's width over lino
 *  and nothing at all over carpet; a sprinting one (1.0) 7–8 m whatever is underfoot. And since a calm man sheds 0.1 awareness a second, walking to and fro
 *  three metres behind him is a 'huh?' in about three seconds on lino and never on carpet (tools/qa/floor-probes.ts measures exactly that). */
export const FLOOR: Record<FloorMat, { loud: number; hard: boolean; rate: number; label: string }> = {
  carpet:  { loud: 0.6,  hard: false, rate: 0.94, label: 'carpet' },
  lino:    { loud: 1.0,  hard: true,  rate: 1.0,  label: 'lino' },
  stone:   { loud: 1.1,  hard: true,  rate: 1.08, label: 'stone' },
  tile:    { loud: 1.05, hard: true,  rate: 1.04, label: 'raised floor' },
  asphalt: { loud: 0.9,  hard: true,  rate: 0.97, label: 'asphalt' },
  grass:   { loud: 0.45, hard: false, rate: 0.88, label: 'grass' },
};

/** the building's footprint inside its exterior walls (level.ts: walls on x 4 / 36, z 4 / 24); outside it is ground */
export const BUILDING = { x0: 4, x1: 36, z0: 4, z1: 24 };
/** the lawn: level.ts's two grass strips, z 0‥3.2 the full width (north) and x 0‥3.2 down the west side — everything else outside is asphalt (lot, walkway, east yard) */
export const GRASS_EDGE = 3.2;
/** The finishes laid over the interior carpet base, first match wins — level.ts 'interior floor finishes' rect for rect (the same regions audio.ts's old
 *  surfaceHard tested). Everything inside the walls not listed is carpet: conference room, manager's office, storage, the reception end of the lobby
 *  (z 12.2‥16) and the whole cubicle farm, its rugs included. */
export const FINISHES: { mat: FloorMat; x0: number; z0: number; x1: number; z1: number; room: string }[] = [
  { mat: 'lino',  x0: 4,  z0: 10,   x1: 36, z1: 12.2, room: 'corridor, wall to wall (level.ts floor(4, 10, 36, 12.2, lino); the runner down its middle is a decal)' },
  { mat: 'stone', x0: 4,  z0: 16,   x1: 12, z1: 24,   room: 'lobby south of the reception counter (floor(4, 16, 12, 24, stone))' },
  { mat: 'tile',  x0: 14, z0: 4,    x1: 22, z1: 10,   room: 'server room raised floor (floor(14, 4, 22, 10))' },
  { mat: 'lino',  x0: 28, z0: 12.2, x1: 36, z1: 24,   room: 'break room (floor(28, 12.2, 36, 24, lino))' },
];

/** The material under a point on the floor (y ignored). `S` = the level's own `surfaces` block (Level.surfaces, the level file's): the same rule over its
 *  numbers — outside `building` the ground (`verge` where x or z < grassEdge, else `outside`), inside it the first zone that holds the point, else `inside`.
 *  Without one (every level file that declares none, and callers with no level to hand) it is the office's map below. */
export function floorAt(p: Vec3, S?: SurfacesData): FloorMat {
  const x = p[0], z = p[2];
  if (S) {
    const B = S.building;
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return x < S.grassEdge || z < S.grassEdge ? S.verge : S.outside;
    for (const f of S.zones) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f.mat;
    return S.inside;
  }
  if (x < BUILDING.x0 || x > BUILDING.x1 || z < BUILDING.z0 || z > BUILDING.z1) return x < GRASS_EDGE || z < GRASS_EDGE ? 'grass' : 'asphalt';
  for (const f of FINISHES) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1) return f.mat;
  return 'carpet';
}

/** The material a footfall at `pos` is ON as far as everyone who listens is concerned: the map's — or lino everywhere with `tune.floorMaterials` off (the A/B
 *  seam: every floor then behaves exactly as the corridor always has). */
export function stepMat(g: Game, pos: Vec3): FloorMat { return g.tune.floorMaterials ? floorOf(g, pos) : 'lino'; }
/** the material under a point on THIS game's level: its own `surfaces` block; without one, the office's map — but a level that carries a quiet mission and
 *  declares no surfaces (scene/scenarios.ts QuietData: a floor that is none of the office's, whose patrols and whose player are heard by their footsteps) is
 *  plain lino everywhere rather than the office's carpet and stone laid over another building */
export function floorOf(g: Game, pos: Vec3): FloorMat { const L = g.level; return !L.surfaces && L.scenarios?.quiet ? 'lino' : floorAt(pos, L.surfaces); }

/** One footfall, for the mixer and the model alike: resolves the material, scales the step's base hearing level by its loudness, plays it (audio.footstep gets
 *  the scaled level AND the material: sample choice and brightness follow it) and returns the level — what the caller pushes as the 'step' GameEvent's level
 *  and into player.noise (player.ts), or nothing more for a guard's tread (presentation only: guards.ts / squad.ts). */
export function tread(g: Game, pos: Vec3, base: number, isPlayer: boolean): number {
  // materials ON: one level for the ears, the meter and the mixer. OFF (the A/B): the MODEL hears lino everywhere (base level unscaled), but the mixer keeps
  // what it always had — the real material picks the sample and the old flat ×0.8 on soft floors — so 'off' is exactly the build before floor.ts, by ear too
  if (!g.tune.floorMaterials) { const real = floorOf(g, pos); g.audio.footstep(pos, base * (FLOOR[real].hard ? 1 : 0.8), isPlayer, real); return g.shards ? g.shards.step(pos, base) : base; }
  const mat = floorOf(g, pos); const level = base * FLOOR[mat].loud;
  g.audio.footstep(pos, level, isPlayer, mat);
  return g.shards ? g.shards.step(pos, level) : level;   // broken glass underfoot crunches and carries (shards.ts; the level back untouched off the litter / with the model not live)
}
