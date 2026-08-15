import { Vec3 } from '../math/vec';

/** A request to inject smoke. Emitters live for `ttl` seconds; `track` lets them follow a moving source (gun barrel, a flying spark).
 *  Everything after `mode` is optional and absent = the original behaviour, so the hand-tuned legacy emitters are bit-identical;
 *  the graded effects in src/game/effects.ts are the ones that set them (semantics ported from twopointfive's fluid.wgsl Source). */
export interface SmokeEmitter {
  pos: Vec3; dir: Vec3;
  speed: number;        // gas velocity along dir (m/s) the medium is dragged toward inside the splat
  radius: number;       // gaussian splat radius (m): weight exp(-r²/radius²), cut at 3·radius
  density: number;      // density injected per second at the core (renderer: σt = 6/m per unit)
  temperature: number;  // buoyancy source per second at the core (solver: +1.6 m/s² per unit, decays 1.2/s)
  ttl: number; age: number;
  /** moving source; returning null parks it (or kills it when `confined`) */
  track?: () => { pos: Vec3; dir: Vec3 } | null;
  kind: 'flash' | 'wisp' | 'canister' | 'burst' | 'cloud' | 'jet' | 'trail' | 'vent' | 'puff';   // puff: the destruction lane's impact DUST — a short cold cloud knocked out of plaster / a dropped ceiling tile (game/destruction.ts dustPuff): density the guards' sight lines and the froxels light like any smoke
  mode?: 'jet' | 'burst';   // burst = velocity points radially away from pos
  push?: number;        // drag RATE (1/s) toward dir·speed at the core; blend per step = clamp(push·g·dt). Default 25 = the old hard-coded constant
  expand?: number;      // divergence source (1/s) at the core: the pressure solve is asked to LEAVE div v = expand·g in the field, so the puff genuinely
                        // pushes its neighbours apart (a radial velocity splat would be projected away in the same step); density pays exp(-expand·dt)
  attack?: number;      // seconds: emission envelope min(1, age/attack), fading over the last quarter of ttl — replaces the per-kind envelopes when set
  jitter?: number;      // per-frame direction (± jitter/2 per axis) and speed (± jitter/2 relative) wobble; default by kind (0.08 jets / 0.35 plumes)
  lattice?: 'fine' | 'coarse';   // which domain class to land on (default: canister → coarse 5.5 cm, everything else → fine 2.2 cm)
  confined?: boolean;   // never worth a fresh domain: dropped when it drifts out of its box or its track() dies (spark trails, barrel wisps)
  prio?: number;        // when more emitters are live than the solver packs per step: 2 = keep (screens), 1 = default, 0 = first to go (spark trails)
  anchor?: Vec3;        // where a freshly placed domain should be centred (default pos) — a shot wants its box ahead of the muzzle, not around it
  minVoxels?: number;   // floor the radius at this many voxels of whatever lattice it lands on (a splat under one cell deposits ~nothing, and flickers)
}

/** One-frame velocity impulse (no density): characters wading through smoke, bullets. */
export interface SmokePush { pos: Vec3; dir: Vec3; speed: number; radius: number; }

/** One live WIND source this frame, in the shape both GPU consumers take it (game/wind.ts builds ≤ WIND_GPU_MAX of them; render/particles.ts packs them behind the
 *  impulses as ImpulseRec records in 'wind' mode, smoke.ts into its own small uniform for the forces step; render/shaders/wind_field.wgsl is the field both then
 *  evaluate — game/wind.ts jetVel / stormVel the CPU copy). kind 'jet' (a supply vent, the gust through an open exterior door): pos = the face centre, dir = unit
 *  axis, speed = m/s at the face THIS frame (cycling, the mains, the gusting already folded in), reach = where it has halved, tanSpread, r0 = the core's radius at
 *  the face, dMax = where it is cut off, floorY = the floor a down-jet turns along (absent = none). kind 'storm': dir × speed = the wind; interior / annex = the two
 *  roofed footprints it does not blow inside (x0 z0 x1 z1). bound = a sphere round the whole support (what the consumers cull by); kinds = the particle kinds that
 *  answer to it (bit per kind; absent = every kind that answers to wind at all). Never allocates anything in either consumer: wind only forces air already simulated. */
export interface WindGpuSource { kind: 'jet' | 'storm'; name: string; pos: Vec3; dir: Vec3; speed: number; reach: number; tanSpread: number; r0: number; dMax: number; floorY?: number; interior?: [number, number, number, number]; annex?: [number, number, number, number]; bound: { c: Vec3; r: number }; kinds?: number; }
/** how many wind sources either GPU consumer takes a frame (the particles share the impulses' sixteen slots — impulses first; the solver's block holds eight) */
export const WIND_GPU_MAX = 8;

/** The slot-2 canister's plume numbers (a slice of SmokeSystem's SmokeParams — the Smoke panel's canister block). */
export interface CanisterParams { canisterDuration: number; canisterDensity: number; canisterRadius: number; canisterTemp: number; canisterSpeed: number; }
/** Solver switches a settings surface may flip without knowing the concrete SmokeSystem (the pause menu's trade-offs group). */
export interface SolverOptions { /** LOSSY: pressure solve at half resolution (SmokeParams.pressureHalf) */ pressureHalf?: boolean; }

export interface SmokeSystemLike {
  /** live tuning of the concrete solver when one is attached (SmokeSystem.params); the game reads the canister block from it */
  readonly params?: CanisterParams & SolverOptions;
  emit(e: SmokeEmitter): void;
  push(p: SmokePush): void;
  /** true if p lies inside a live domain */
  inSmokeDomain(p: Vec3): boolean;
  /** how many more emitters would still be packed for the solver this step (an effect sizing its spark-trail count charges against this) */
  budget?(): number;
  /** drop every emitter and retire every domain (encounter restart: a 30 s canister must not keep venting into the next one) */
  clearAll?(): void;
  /** something solid within r of c stopped being solid (or came back): live domains there re-bake their obstacle field — the destruction lane hiding a static it knocked off */
  obstaclesChanged?(c: Vec3, r: number): void;
  /** this frame's WIND (game/wind.ts, called once a frame at the end of Game.update; an empty list = still air): the solver's forces step relaxes the air of every
   *  live domain a source's bound overlaps toward the source's analytic field inside its support (smoke/wind_force.wgsl) with the per-particle-kind knobs the list
   *  carries ignored. It never places, keeps alive or retires a domain — wind only bends smoke that is already there. `relax` = the rate (1/s) at the jet's core. */
  setWind?(srcs: readonly WindGpuSource[], relax: number): void;
}
