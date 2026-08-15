// Multi-domain GPU smoke simulation (see smoke.wgsl). Exposes a SmokeBinding for the renderer.
import { makeBuffer, makeShader, computePipelineAsync } from '../gpu/device';
import { Vec3, v3 } from '../math/vec';
import { Engine, SmokeBinding } from '../engine';
import { wgslWorldConsts, WORLD } from '../scene/world';
import { Box, BoxFlag, BoxWorld } from '../scene/boxes';
import { SmokeEmitter, SmokePush, SmokeSystemLike } from './types';
import smokeSrc from './smoke.wgsl' with { type: 'text' };
import halfSrc from './pressure_half.wgsl' with { type: 'text' };
// WIND (game/wind.ts): the field's one WGSL text + the solver's block / forcing term, prepended to the module; the records come in through setWind() once a frame
import windFieldSrc from '../render/shaders/wind_field.wgsl' with { type: 'text' };
import windForceSrc from './wind_force.wgsl' with { type: 'text' };

import { sysRandom } from '../math/dice';   // the mixer / the solver draw the SYSTEM die, never the simulation's seeded one under a session recording (math/dice.ts)
import type { WindGpuSource } from './types';
import { WIND_GPU_MAX } from './types';
const WIND_SRC_BYTES = 64, WIND_HDR_BYTES = 48, WIND_BLOCK_BYTES = WIND_HDR_BYTES + WIND_GPU_MAX * WIND_SRC_BYTES;   // struct WindBlock in wind_force.wgsl: count / relax / minW / pad, 8 mask words, 8 × WindSrc

export interface SmokeParams {
  buoyancy: number; weight: number; vortConf: number; velDamp: number; densDecay: number; tempDecay: number; turbulence: number;
  windX: number; windZ: number; densityScale: number; enabled: boolean; voxelFine: number; voxelCoarse: number;
  /** render density × for domains that never held a CANISTER plume — muzzle gas, impact / destruction dust puffs (08-13, the designer: at the plumes' 1.6× 'there's way too much that shows up on
   *  bullet impact'); a domain that has hosted a canister keeps densityScale for its life so a lingering plume never pops when its emitter runs out */
  fxDensityScale: number;
  /** pressure solve: red-black Gauss-Seidel + SOR — rbIters red/black sweep pairs per step, relaxed by omega */
  rbIters: number; omega: number;
  /** LOSSY, default off: solve the pressure on a 32³ grid per domain instead of 64³ (see pressure_half.wgsl) — the fine flux balances are summed
   *  over 2×2×2 blocks (face by face, so the coarse system is sealed exactly where the fine grid is and thin fluid layers keep their equations),
   *  the same rbIters red/black SOR pairs run on the blocks (warm-started, their own textures), the result is prolongated trilinearly along open
   *  connections only into pA, and the unchanged `project` subtracts its gradient. Divergence under two cells wide is only partly removed: the
   *  plume keeps its large-scale motion and loses some fine curl. Off = the untouched full-resolution path (no extra dispatch, texture or module). */
  pressureHalf: boolean;
  /** with pressureHalf: ordinary fine red/black pairs (the default module's rbgs, the panel's omega) run between the prolongation and project.
   *  Default 1, and it matters: in a CPU soak of the whole step (canister preset, 90 s) the bare coarse solve (0) let the grid-scale divergence
   *  the plume skin makes every step pile up — rms divergence ≈ 5× the fine path's, +40 % smoke mass — because a 2×2×2 block cannot even see
   *  it, while ONE fine pair after the coarse solve removes it (rms divergence at or under the fine path's own, mass within a few %, calmer
   *  after the emitter dies). 2–3 measured slightly WORSE than 1 (a second over-relaxed pair overshoots back), so they are only there to try. 0…3. */
  pressureHalfSmooth: number;
  canisterDensity: number; canisterDuration: number; canisterRadius: number; canisterTemp: number; canisterSpeed: number;
  expansion: boolean;   // honour emitters' `expand` (divergence source + volume correction); off = they inject like plain jets
  /** empty-region skipping: the scalar passes (advectScalars, injectDecay) return at once in 8³-cell bricks that provably come out zero this step
   *  (see `occupancy` in smoke.wgsl). Lossless — on/off give bit-identical fields — so this is an A/B switch, not a quality knob. */
  brickSkip: boolean;
  /** density / temperature at or below this are stored as exactly 0 by injectDecay. Default 2^-14 ≈ 6.1e-5 = the smallest normal half float
   *  (below it f16 rounding stalls the decay, see injectDecay) ≈ an extinction of 3.7e-4 per metre: invisible. The one deliberate epsilon of the
   *  brick scheme — lets cells the plume left drop out of the occupancy; 0 = never flush. Applies identically with brickSkip on or off. */
  flushEps: number;
  /** debug / A-B: hold the field exactly as it is while it stays visible — no step, no emitter ageing, no domain retirement, new emits dropped.
   *  (`enabled = false` is not that: it also hides every domain from the renderer.) For pixel-exact captures of smoke shading changes. */
  frozen: boolean;
  /** renderer v3 Phase 0 cap: this many live domains — the nearest to the view's look-at point — step every frame; the rest step on ALTERNATE frames with the dt
   *  they missed added on (so a far plume still rises at the right speed, in coarser time), and their density renders every frame from the last step as ever.
   *  8 (= MAX_DOMAINS) = every domain every frame, the solver as it was. Presets: ultra 8 · high 6 · medium 4 · low 3 · verylow 2 (ui/quality.ts caps). Guards'
   *  sight lines read the density field, never the step, so nothing on the AI side changes. */
  fullRateDomains: number;
  /** perf/smoke-scale (docs/internal/smoke-perf.md §3.1): CALM domains step less often. A live domain with no emitter depositing or pushing into it (a plume whose canister has
   *  run out, hanging dust) steps every p-th frame, p = clamp(⌊calmCells ÷ (cells its fastest VISIBLE parcel crosses per frame)⌋, 1, 4) off the vmax over the bricks that hold
   *  density, which the brick occupancy already reads back — so between two steps you SEE, nothing in it has moved more than `calmCells` voxels (½: 2.7 cm on the coarse lattice),
   *  whatever p comes out; the dt it sat out is integrated on its next step exactly as the half-rate domains' is. A domain something is emitting into keeps the view-rank rule
   *  above untouched. Three hanging plumes: the sim pass 1.25 → 0.79 ms at ½. 0 = off: every domain scheduled exactly as before. */
  calmCells: number;
}
export const defaultSmokeParams = (): SmokeParams => ({ buoyancy: 1.6, weight: 0.03, vortConf: 4.0, velDamp: 0.3, densDecay: 0.14, tempDecay: 1.2, turbulence: 2.5, windX: 0, windZ: 0, densityScale: 1.3, fxDensityScale: 1.0, enabled: true, voxelFine: 0.022, voxelCoarse: 0.055, canisterDensity: 95, canisterDuration: 32, canisterRadius: 0.2, canisterTemp: 1.6, canisterSpeed: 1.9, expansion: true, rbIters: 4, omega: 1.7, pressureHalf: false, pressureHalfSmooth: 1, brickSkip: true, flushEps: 2 ** -14, frozen: false, fullRateDomains: 8, calmCells: 0.5 });   // canister: about three of the old ones' worth of smoke (wider mouth, longer, denser) now that a coarse domain is a 3.5 m cube
/** the largest dt one solver step integrates: 1/30 s for a full-rate domain as ever; a half-rate domain sums two frames' dt, so up to 1/20 (past that — under 40 fps —
 *  a far plume evolves a little slow rather than take a step the advection was never run at); a calm domain sitting out two / three frames (calmCells) up to 1/15 / 1/12 */
const DT_MAX = 1 / 30, DT_MAX_HALF = 1 / 20;
const DT_CAP = [DT_MAX, DT_MAX_HALF, 1 / 15, 1 / 12];   // by frames integrated in one step (1‥4)
const MAX_PERIOD = 4;

const DIMS: [number, number, number] = [64, 64, 64];
/** the share of a domain's extent every density reader eases to nothing toward its open faces — common.wgsl SMOKE_EDGE, keep the two equal (acceptOf holds sources out of that band) */
export const SMOKE_EDGE_FRAC = 0.11;
/** the shipped coarse voxel (defaultSmokeParams.voxelCoarse) — acceptOf's fade-band margin is keyed to it; a hand-tuned smaller voxel only makes the margin generous */
const COARSE_VOXEL_SHIPPED = 0.055;   // 262 k cells per domain: fine (2.2 cm) = a 1.4 m cube for gun smoke, coarse (5.5 cm) = a 3.5 m, ceiling-high cube for canisters — 1.6× the old 48×72×48 cells, paid for by the cheaper pressure solve
const HALF_DIMS: [number, number, number] = [DIMS[0] / 2, DIMS[1] / 2, DIMS[2] / 2];   // the pressureHalf option's coarse grid: 2×2×2 blocks (pressure_half.wgsl derives it as sim.dims / 2, slabs at zOff / 2)
const BRICK = 8;                                       // occupancy brick edge in cells: 2×2×2 workgroups of the 4³ kernels (handed to smoke.wgsl as consts, see the constructor)
const BRICK_GRID: [number, number, number] = [DIMS[0] / BRICK, DIMS[1] / BRICK, DIMS[2] / BRICK];
const BRICKS_PER_DOMAIN = BRICK_GRID[0] * BRICK_GRID[1] * BRICK_GRID[2];   // 512; also sizes the dilate kernel's workgroup arrays
const OCC_WORDS = BRICKS_PER_DOMAIN / 32;              // render occupancy: one bit per brick → 16 u32 per domain (renderOccPack in smoke.wgsl → `smokeOcc` in common.wgsl)
const BRICK_STAT_WORDS = 8;                            // per-domain counters read back for the HUD / the scheduler: active, scalar, vel, vmax bits, render-live, vmax bits over the scalar bricks (calmCells), 2 spare
if (DIMS.some(n => n % BRICK)) throw new Error('smoke: DIMS must be multiples of the occupancy brick');
if (BRICK !== 8 || OCC_WORDS !== 16) throw new Error('smoke: common.wgsl (SMOKE_BRICK, smokeOcc: 16 words per domain) assumes 64³ domains cut into 8³ bricks');
export const MAX_DOMAINS = 8;
/** the render-occupancy buffer: 16 words × 8 domains of brick bits, then one word per domain = the box of its set bricks (renderOccPack → common.wgsl smokeSubWord: the shadow-ray
 *  transmittance's per-domain segment reject) — 544 B, bound by the scene shaders as array<vec4u, 34> (engine.ts sizes its no-smoke stand-in the same) */
export const OCC_BUFFER_BYTES = 4 * (OCC_WORDS * MAX_DOMAINS + MAX_DOMAINS);
// 32, not 16: a flashbang alone is 2 end jets + 5 body vents + a wisp + a dozen spark trails for its first second. Nearly free — the
// per-cell loops early-out on the domain index and the uniform is 2 KB; what it bounds is how many sources one event may own at once.
const MAX_EMITTERS = 32;
const EMITTER_WORDS = 16;                      // struct Emitter in smoke.wgsl: 4 × vec4
const SIM_HEADER_WORDS = 20;                   // SimParams fields before the array (80 B, keeps the array 16-aligned)
const SIM_PARAMS_BYTES = SIM_HEADER_WORDS * 4 + MAX_EMITTERS * EMITTER_WORDS * 4;
const SIM_PARAMS_STRIDE = Math.ceil(SIM_PARAMS_BYTES / 256) * 256;   // one copy of the block per distinct step dt a frame (binding 0 has a dynamic offset): [0] the frame's dt for full-rate domains, then the summed dts of domains catching up frames they sat out (writeSimParams)
const LEGACY_PUSH = 25;                        // the blend rate every emitter had before `push` was per-emitter
/** The obstacle bake's DOOR LEAVES (W8.2): the leaves that seal a doorway acoustically (BoxFlag.SoundSeal — a leaf within 0.3 rad of shut, doors.ts) are baked solid into a
 *  domain's obstacle field like the walls, at most this many per bake (an office floor has nine doors; a domain overlaps two or three). ONE MODEL: the threshold that decides
 *  whether the guards HEAR through a doorway decides whether smoke passes it. Uniform layout = struct SealS in smoke.wgsl: a vec4u header (x = count) + 2 vec4f per leaf. */
const MAX_SEALERS = 16;
const SEAL_BYTES = 16 + MAX_SEALERS * 32;
/** a baked leaf is re-baked once it has moved this far from the pose it was baked at (its centre, m / its yaw, rad — 5 cm at the tip of a 0.9 m leaf ≈ one coarse voxel) */
const SEAL_MOVE = 0.03, SEAL_TURN = 0.05;
/** a domain younger than this is never recycled for a newcomer of the same or lower priority (W8.7: a fresh plume evicted at once, its emitters re-placed, evicting the next … was the ping-pong) */
const MIN_RECYCLE_AGE = 1.0;
/** what the panel may ask of the pressure solve (W8.9): SOR diverges at ω ≥ 2 (a NaN slab within a second at 2.5), and one red/black pair is the least that projects anything */
const OMEGA_MIN = 1.0, OMEGA_MAX = 1.95, PAIRS_MAX = 16;

type DomainClass = 'fine' | 'coarse';
/** a sealing leaf's pose as it went into a domain's obstacle field */
interface SealPose { cx: number; cz: number; yaw: number }
interface Domain {
  index: number; live: boolean; origin: Vec3; floorClosed: boolean; voxel: number; cls: DomainClass;
  lastEmit: number; born: number; parity: number; mass: number; needsBake: boolean; needsClear: boolean;
  /** has hosted a canister plume since it went live (→ rendered at params.densityScale; else params.fxDensityScale) */
  plume?: boolean;
  /** pressureHalf: this domain's coarse pressure slabs must be zeroed before their next use (set on placement and, for every domain, when the option goes on) */
  needsClearCoarse: boolean;
  /** last brick occupancy read back: bricks the scalar passes ran in, bricks holding density/temperature, bricks holding velocity, max |v component|,
   *  bricks the renderer must still fetch in (density in the brick or its one-cell shell) */
  bricks: { active: number; scalar: number; vel: number; vmax: number; render: number; /** max |velocity component| over the bricks holding scalar: how fast the VISIBLE smoke moves (calmCells reads it) */ vmaxS: number };
  /** did this domain sit its step out last frame (stats / HUD; the scheduler itself keeps `since` / `owed`) */
  skipped: boolean;
  /** frames since its last step counting this one (1 = it stepped last frame) and the dt it is owed over them; the period it was last scheduled at (stats / HUD) */
  since: number; owed: number; period: number;
  /** the sealing door leaves standing in this domain: as baked into its obstacle field (`sealed`), and as of this frame's update() (`sealNow`) — a difference re-bakes */
  sealed: Map<Box, SealPose>; sealNow: Map<Box, SealPose>;
}

const CS = GPUShaderStage.COMPUTE;

/** The pressureHalf option's GPU side, built the first time the option is switched on: a second shader module (smoke.wgsl + pressure_half.wgsl),
 *  its pipelines (compiled async — the fine path keeps running until they resolve), and the coarse textures: pressure ping / pong (warm start,
 *  persistent per domain slab) and, rewritten every step by restrictDiv, the block divergence and the packed per-block face-count word. */
interface HalfRes {
  ready: boolean; failed: string | null;
  pipes: Record<string, GPUComputePipeline>;
  pA: GPUTexture; pB: GPUTexture; div: GPUTexture; blocks: GPUTexture;
}

export class SmokeSystem implements SmokeSystemLike {
  params: SmokeParams = defaultSmokeParams();
  domains: Domain[] = [];
  emitters: (SmokeEmitter & { domain: number })[] = [];
  pushes: (SmokePush & { domain: number })[] = [];
  time = 0;
  binding: SmokeBinding;
  // textures
  private velA: GPUTexture; private velB: GPUTexture; private densA: GPUTexture; private densB: GPUTexture; private curlT: GPUTexture;
  private pA: GPUTexture; private pB: GPUTexture; private divT: GPUTexture; private obst: GPUTexture;
  private dummyF16: GPUTexture; private dummyR32: GPUTexture; private dummyW: GPUTexture[];
  private simParamBuf: GPUBuffer; private domParamBuf: GPUBuffer; private massBuf: GPUBuffer; private massRead: GPUBuffer; private massPending = false; private massFrame = 0;
  // brick occupancy: raw per-brick words, the dilated active set the scalar kernels test, and per-domain counters read back for stats
  private brickRaw: GPUBuffer; private brickAct: GPUBuffer; private brickStatBuf: GPUBuffer; private brickStatRead: GPUBuffer; private brickPending = false; private brickFrame = 0;
  // render occupancy: per-brick region masks (scratch) and the packed bit per brick the scene shaders test before fetching (renderer-facing, see renderOccPack)
  private brickRgn: GPUBuffer; private occBuf: GPUBuffer;
  private sealBuf: GPUBuffer; private sealData = new ArrayBuffer(SEAL_BYTES); private sealF = new Float32Array(this.sealData); private sealU = new Uint32Array(this.sealData);
  private domainUbo: GPUBuffer;   // renderer-facing SmokeDomain[8]
  private g0Layout: GPUBindGroupLayout; private g1Layout: GPUBindGroupLayout; private bakeLayout: GPUBindGroupLayout;
  private g0: GPUBindGroup;
  private pipes: Record<string, GPUComputePipeline> = {};
  private bakePipe!: GPUComputePipeline;
  private bgs = new Map<string, GPUBindGroup>();
  private bakeBG: GPUBindGroup | null = null; private bakeBGItems: GPUBuffer | null = null;
  private sampler: GPUSampler;
  private prelude: string;                        // consts prepended to smoke.wgsl (and to smoke.wgsl + pressure_half.wgsl for the option's module)
  private half: HalfRes | null = null;            // pressureHalf GPU objects, built on first use
  private halfArmed = false;                      // pressureHalf as encode() last saw it: an off→on edge zeroes every domain's coarse pressure
  private simData = new ArrayBuffer(SIM_PARAMS_BYTES); private simF = new Float32Array(this.simData); private simU = new Uint32Array(this.simData);
  /** bricks*: occupancy summed over live domains as last read back (a frame or two behind) — bricksActive / bricksTotal is the fraction of the
   *  scalar passes that actually ran; bricksScalar = bricks holding density or temperature, bricksVel = bricks holding any velocity;
   *  bricksRender = bricks the renderer still fetches in (density in the brick or its one-cell shell): the rest of every live domain costs it no fetch.
   *  steps = dispatches encoded this frame (all live domains); perStep = dispatches of one domain step (the last one encoded); pressure = which
   *  pressure solve that step ran ('fine' = the 64³ red/black SOR, 'half' = the pressureHalf option's 32³ solve); halfStatus = the option's GPU
   *  side: 'off' (never requested), 'compiling', 'ready', or 'failed: …' (the fine path keeps running). */
  stats = { live: 0, emitters: 0, steps: 0, perStep: 0, pressure: 'fine' as 'fine' | 'half', halfStatus: 'off', bricksActive: 0, bricksScalar: 0, bricksVel: 0, bricksRender: 0, bricksTotal: 0, vmax: 0, /** live domains that sat this frame out (params.fullRateDomains) */ skipped: 0,
    /** domains placed (fresh or recycled) · placements refused (no slot may be taken, or no domain could hold the emitter) · lower-priority plumes evicted for a newcomer · obstacle bakes run
     *  (placement + re-bakes for a leaf that shut / opened / a static hidden) · sealing leaves in the last bake · the ω and red/black pairs the solve actually ran (the panel's, clamped) */
    placed: 0, refused: 0, evicted: 0, bakes: 0, sealers: 0, omega: 0, rbPairs: 0,
    /** WIND: sources packed for the forces step this frame / live domains any of them overlaps (game/wind.ts → setWind) */ windSrcs: 0, windDomains: 0 };
  // WIND (game/wind.ts → setWind, once a frame): the sources handed in, the block they are packed into for the forces step (wind_force.wgsl, group 0 binding 2), whether last frame carried any
  private windSrcs: readonly WindGpuSource[] = []; private windRelax = 3;
  private windBuf!: GPUBuffer; private windData = new ArrayBuffer(WIND_BLOCK_BYTES); private windF = new Float32Array(this.windData); private windU = new Uint32Array(this.windData); private windArmed = false;

  constructor(private engine: Engine) {
    const device = engine.device;
    const [W, H, D] = DIMS; const AD = D * MAX_DOMAINS;
    const mk3d = (format: GPUTextureFormat, label: string, extra: GPUTextureUsageFlags = 0, w = W, h = H, d = AD) => device.createTexture({ label, size: [w, h, d], dimension: '3d', format, usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | extra });
    this.velA = mk3d('rgba16float', 'smokeVelA'); this.velB = mk3d('rgba16float', 'smokeVelB');
    this.densA = mk3d('rgba16float', 'smokeDensA'); this.densB = mk3d('rgba16float', 'smokeDensB');
    this.curlT = mk3d('rgba16float', 'smokeCurl');
    this.pA = mk3d('r32float', 'smokePA'); this.pB = mk3d('r32float', 'smokePB'); this.divT = mk3d('r32float', 'smokeDiv'); this.obst = mk3d('r32float', 'smokeObst');
    this.dummyF16 = mk3d('rgba16float', 'dummyF16', 0, 4, 4, 4); this.dummyR32 = mk3d('r32float', 'dummyR32', 0, 4, 4, 4);
    // one distinct dummy per writable slot (writable storage bindings may not alias within a dispatch)
    this.dummyW = [mk3d('rgba16float', 'dummyW20', 0, 4, 4, 4), mk3d('rgba16float', 'dummyW21', 0, 4, 4, 4), mk3d('rgba16float', 'dummyW22', 0, 4, 4, 4), mk3d('r32float', 'dummyW23', 0, 4, 4, 4), mk3d('r32float', 'dummyW24', 0, 4, 4, 4)];
    this.sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge', addressModeW: 'clamp-to-edge' });
    this.simParamBuf = makeBuffer(device, SIM_PARAMS_STRIDE * (MAX_DOMAINS + 1), GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeSimParams');   // ≤ one copy per distinct step dt a frame (writeSimParams) + copy 0
    this.domParamBuf = makeBuffer(device, 256 * MAX_DOMAINS, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeDomParams');
    this.massBuf = makeBuffer(device, 4 * 8, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST, 'smokeMass');
    this.massRead = device.createBuffer({ size: 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    this.domainUbo = makeBuffer(device, 64 * 8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeDomainsUbo');
    this.windBuf = makeBuffer(device, WIND_BLOCK_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeWind');   // WIND: zero-initialised = count 0 = still air until setWind() says otherwise
    this.brickRaw = makeBuffer(device, 8 * BRICKS_PER_DOMAIN * MAX_DOMAINS, GPUBufferUsage.STORAGE, 'smokeBrickRaw');           // vec2u per brick
    this.brickAct = makeBuffer(device, 4 * BRICKS_PER_DOMAIN * MAX_DOMAINS, GPUBufferUsage.STORAGE, 'smokeBrickAct');           // u32 per brick
    this.brickStatBuf = makeBuffer(device, 4 * BRICK_STAT_WORDS * MAX_DOMAINS, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC, 'smokeBrickStats');   // BRICK_STAT_WORDS u32 per domain
    this.brickStatRead = device.createBuffer({ size: 4 * BRICK_STAT_WORDS * MAX_DOMAINS, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    this.brickRgn = makeBuffer(device, 4 * BRICKS_PER_DOMAIN * MAX_DOMAINS, GPUBufferUsage.STORAGE, 'smokeBrickRgn');           // u32 region mask per brick (scratch between the two render-occupancy kernels)
    // one bit per brick, 16 words per domain, then the per-domain set-brick boxes behind the bits (OCC_BUFFER_BYTES): written (storage) by renderOccPack at the end of every domain
    // step, read as a 544-B uniform block by the scene shaders (binding 11) — a uniform rather than a seventh scene storage buffer keeps every pipeline inside the base
    // storage-buffers-per-stage limit. Zero-initialised = "nothing to fetch anywhere" + "box unknown: the whole domain", which is right for slots that never stepped (they are never live either).
    this.occBuf = makeBuffer(device, OCC_BUFFER_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_SRC, 'smokeRenderOcc');   // (COPY_SRC: tools/qa/smoke-lab.js reads the box words back to check them against the atlas)
    this.sealBuf = makeBuffer(device, SEAL_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeSealers');   // the sealing door leaves the obstacle bake reads (binding 5; zero-initialised = none)
    for (let i = 0; i < MAX_DOMAINS; i++) this.domains.push({ index: i, live: false, origin: [0, -100, 0], floorClosed: false, voxel: 0.03, cls: 'fine', lastEmit: -1e9, born: 0, parity: 0, mass: 0, needsBake: false, needsClear: false, needsClearCoarse: true, bricks: { active: 0, scalar: 0, vel: 0, vmax: 0, render: 0, vmaxS: 0 }, skipped: false, since: 1, owed: 0, period: 1, sealed: new Map(), sealNow: new Map() });

    // layouts
    this.g0Layout = device.createBindGroupLayout({ label: 'smokeG0', entries: [
      { binding: 0, visibility: CS, buffer: { type: 'uniform', hasDynamicOffset: true } },   // (dynamic: which of the two SimParams copies — full-rate dt or the catch-up dt — this domain's step reads)
      { binding: 1, visibility: CS, buffer: { type: 'uniform', hasDynamicOffset: true } },
      { binding: 2, visibility: CS, buffer: { type: 'uniform' } },                           // WIND: the sources + per-domain overlap mask (wind_force.wgsl WindBlock) — one block for every domain's step
    ] });
    const t3 = (sampleType: GPUTextureSampleType): GPUBindGroupLayoutEntry['texture'] => ({ sampleType, viewDimension: '3d' });
    const st = (format: GPUTextureFormat): GPUBindGroupLayoutEntry['storageTexture'] => ({ access: 'write-only', format, viewDimension: '3d' });
    this.g1Layout = device.createBindGroupLayout({ label: 'smokeG1', entries: [
      { binding: 10, visibility: CS, sampler: { type: 'filtering' } },
      { binding: 11, visibility: CS, texture: t3('float') }, { binding: 12, visibility: CS, texture: t3('float') }, { binding: 13, visibility: CS, texture: t3('float') },
      { binding: 14, visibility: CS, texture: t3('unfilterable-float') }, { binding: 15, visibility: CS, texture: t3('unfilterable-float') }, { binding: 16, visibility: CS, texture: t3('unfilterable-float') },
      { binding: 20, visibility: CS, storageTexture: st('rgba16float') }, { binding: 21, visibility: CS, storageTexture: st('rgba16float') }, { binding: 22, visibility: CS, storageTexture: st('rgba16float') },
      { binding: 23, visibility: CS, storageTexture: st('r32float') }, { binding: 24, visibility: CS, storageTexture: st('r32float') },
      { binding: 25, visibility: CS, buffer: { type: 'storage' } },
      { binding: 26, visibility: CS, buffer: { type: 'storage' } }, { binding: 27, visibility: CS, buffer: { type: 'storage' } }, { binding: 28, visibility: CS, buffer: { type: 'storage' } },
      { binding: 29, visibility: CS, buffer: { type: 'storage' } }, { binding: 30, visibility: CS, buffer: { type: 'storage' } },
    ] });
    this.bakeLayout = device.createBindGroupLayout({ label: 'smokeBake', entries: [
      { binding: 0, visibility: CS, storageTexture: st('r32float') },
      { binding: 1, visibility: CS, buffer: { type: 'read-only-storage' } }, { binding: 2, visibility: CS, buffer: { type: 'read-only-storage' } }, { binding: 3, visibility: CS, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: CS, buffer: { type: 'uniform' } },
      { binding: 5, visibility: CS, buffer: { type: 'uniform' } },   // the sealing door leaves (SealS)
    ] });
    this.g0 = device.createBindGroup({ layout: this.g0Layout, entries: [{ binding: 0, resource: { buffer: this.simParamBuf, offset: 0, size: SIM_PARAMS_BYTES } }, { binding: 1, resource: { buffer: this.domParamBuf, offset: 0, size: 32 } }, { binding: 2, resource: { buffer: this.windBuf } }] });   // (binding 2: WIND)
    this.prelude = wgslWorldConsts() + `const BRICK: u32 = ${BRICK}u;\nconst BRICKS_PER_DOMAIN: u32 = ${BRICKS_PER_DOMAIN}u;\nconst OCC_WORDS: u32 = ${OCC_WORDS}u;\nconst BRICK_STAT_WORDS: u32 = ${BRICK_STAT_WORDS}u;\n`;
    this.prelude += windFieldSrc + windForceSrc;   // WIND: the field (render/shaders/wind_field.wgsl — the particles compile the same text) + the block and windForce() the forces kernel calls; in the prelude, so the pressureHalf module carries them too
    this.mod = makeShader(device, this.prelude + smokeSrc, 'smoke');   // (the sixteen kernels: init(), awaited by main.ts / the viewer before the first frame)

    this.binding = { uniform: this.domainUbo, atlasView: this.densA.createView(), occ: this.occBuf, count: 0, encode: (enc, ts) => this.encode(enc, ts) };
    this.writeDomainUbo();
  }

  private mod: GPUShaderModule;
  /** Every solver kernel + the obstacle bake, compiled off the GPU process's main thread (gpu/device.ts computePipelineAsync): the constructor keeps the textures / buffers / layouts,
   *  this makes the pipelines — main.ts and the viewer await it before the first frame (the engine's smoke binding is attached either side of it; nothing encodes until then). */
  async init(): Promise<void> {
    const device = this.engine.device, mod = this.mod;
    const plSim = device.createPipelineLayout({ bindGroupLayouts: [this.g0Layout, this.g1Layout] });
    const jobs: Promise<unknown>[] = [];
    for (const ep of ['advectVel', 'curl', 'forces', 'divergence', 'project', 'occupancy', 'dilate', 'advectScalars', 'injectDecay', 'renderOccRegions', 'renderOccPack', 'clearAll', 'reduceMass'])
      jobs.push(computePipelineAsync(device, { label: 'smoke_' + ep, layout: plSim, compute: { module: mod, entryPoint: ep } }).then(p => { this.pipes[ep] = p; }));
    for (const [name, col] of [['rbgsR', 0], ['rbgsB', 1]] as const) jobs.push(computePipelineAsync(device, { label: 'smoke_' + name, layout: plSim, compute: { module: mod, entryPoint: 'rbgs', constants: { RB_COLOR: col } } }).then(p => { this.pipes[name] = p; }));   // red / black half sweeps of the SOR pressure solve
    jobs.push(computePipelineAsync(device, { label: 'smoke_bake', layout: device.createPipelineLayout({ bindGroupLayouts: [this.g0Layout, this.bakeLayout] }), compute: { module: mod, entryPoint: 'bakeObstacles' } }).then(p => { this.bakePipe = p; }));
    await Promise.all(jobs);
  }

  // ---------------------------------------------------------------- bind groups
  private bg(name: string, spec: Partial<Record<'srcVel' | 'srcDens' | 'srcCurl' | 'srcP' | 'srcDiv' | 'srcObst' | 'dstVel' | 'dstDens' | 'dstCurl' | 'dstP' | 'dstDiv', GPUTexture>>): GPUBindGroup {
    let g = this.bgs.get(name); if (g) return g;
    const v = (t: GPUTexture | undefined, d: GPUTexture) => (t ?? d).createView();
    g = this.engine.device.createBindGroup({ label: name, layout: this.g1Layout, entries: [
      { binding: 10, resource: this.sampler },
      { binding: 11, resource: v(spec.srcVel, this.dummyF16) }, { binding: 12, resource: v(spec.srcDens, this.dummyF16) }, { binding: 13, resource: v(spec.srcCurl, this.dummyF16) },
      { binding: 14, resource: v(spec.srcP, this.dummyR32) }, { binding: 15, resource: v(spec.srcDiv, this.dummyR32) }, { binding: 16, resource: v(spec.srcObst, this.dummyR32) },
      { binding: 20, resource: v(spec.dstVel, this.dummyW[0]) }, { binding: 21, resource: v(spec.dstDens, this.dummyW[1]) }, { binding: 22, resource: v(spec.dstCurl, this.dummyW[2]) },
      { binding: 23, resource: v(spec.dstP, this.dummyW[3]) }, { binding: 24, resource: v(spec.dstDiv, this.dummyW[4]) },
      { binding: 25, resource: { buffer: this.massBuf } },
      { binding: 26, resource: { buffer: this.brickRaw } }, { binding: 27, resource: { buffer: this.brickAct } }, { binding: 28, resource: { buffer: this.brickStatBuf } },
      { binding: 29, resource: { buffer: this.brickRgn } }, { binding: 30, resource: { buffer: this.occBuf } },
    ] });
    this.bgs.set(name, g); return g;
  }

  // ---------------------------------------------------------------- domains
  private size(d: { voxel: number }): Vec3 { return [DIMS[0] * d.voxel, DIMS[1] * d.voxel, DIMS[2] * d.voxel]; }
  /** Is p inside the box a domain of `voxel` at `origin` covers, `margin` in from its four open side faces (a negative margin = that far OUT still counts), above the
   *  bottom row and at least `top` under its open top face (default: clear of the top quarter / 45 cm, room for a plume to rise before the dissipation band eats it)?
   *  THE containment test — of a live domain (domainContains) and of a placement not yet made (planOrigin). */
  private static contains(origin: Vec3, voxel: number, p: Vec3, margin: number, top = Math.min(0.45, DIMS[1] * voxel * 0.25)): boolean {
    const sx = DIMS[0] * voxel, sy = DIMS[1] * voxel, sz = DIMS[2] * voxel;
    const bottom = origin[1] <= 0.001 ? -0.02 : 0.05;   // a domain standing on the ground has a solid floor under its bottom row, not an open face: a source lying on the floor (a venting can, a landed spark's trail) is inside it
    return p[0] > origin[0] + margin && p[0] < origin[0] + sx - margin && p[2] > origin[2] + margin && p[2] < origin[2] + sz - margin && p[1] > origin[1] + bottom && p[1] < origin[1] + sy - top;
  }
  private domainContains(d: Domain, p: Vec3, margin: number, top?: number): boolean { return SmokeSystem.contains(d.origin, d.voxel, p, margin, top); }
  /** How near the open faces an EMITTER may sit and still count as inside a domain (sides, top; metres): a `confined` source — muzzle gas, the ejection-port curl, a spark's
   *  trail: small, brief, never given another box — anywhere inside at all (a curl that ends up in the dissipation band is eaten a little sooner; a fresh 64³ domain for
   *  it costs every shadow and gather ray in the building a second box to march); anything else keeps the 10–12 cm the migration rule holds it to and the head-room a
   *  plume wants. (W8.7: the port curl 0.58 m behind a shot's anchor, and a hand's breadth above a floor domain's 35 cm top band whenever Sam aimed low, claimed a fresh
   *  domain on every follow-up round — three shots standing still, three live domains.) */
  private static acceptOf(e: { confined?: boolean }, migrating = false, cls: DomainClass = 'fine'): { side: number; top?: number } {
    if (e.confined) return { side: migrating ? 0 : 0.02, top: migrating ? 0 : 0.02 };
    if (cls === 'coarse') { const band = SMOKE_EDGE_FRAC * DIMS[0] * COARSE_VOXEL_SHIPPED; return { side: migrating ? band : band + 0.06 }; }   // a canister's box: every reader eases its density to nothing over the outer SMOKE_EDGE_FRAC toward the open faces (common.wgsl smokeEdgeFade), so a source may not sit — or a second can reuse the box — inside that band: it would vent at a fraction of itself and half its skirt would fade (wave-4 review). Keyed to the SHIPPED coarse voxel; a hand-tuned smaller one only makes the margin generous
    return { side: migrating ? 0.1 : 0.12 };
  }
  /** Where a fresh domain of the class asked for at p would sit (pure — nothing is taken): centred on p in plan, its floor a little under p (on the ground when that is
   *  near), never poking more than 15 cm through the ceiling, snapped to its own lattice. */
  private planOrigin(p: Vec3, cls: DomainClass): { origin: Vec3; floorClosed: boolean; voxel: number } {
    const voxel = cls === 'fine' ? this.params.voxelFine : this.params.voxelCoarse;
    const sx = DIMS[0] * voxel, sy = DIMS[1] * voxel, sz = DIMS[2] * voxel;
    let oy = p[1] - (cls === 'fine' ? 0.55 : 0.75); let floorClosed = false;
    if (oy < 0.3) { oy = 0; floorClosed = true; }
    oy = Math.min(oy, Math.max(0, WORLD.ceilingY + 0.15 - sy));
    if (oy <= 0.001) floorClosed = true;
    const snap = (x: number) => Math.round(x / voxel) * voxel;
    return { origin: [snap(p[0] - sx / 2), snap(Math.max(0, oy)), snap(p[2] - sz / 2)], floorClosed, voxel };
  }
  /** the highest priority among the emitters a domain is carrying (−1 = none: idle) — writeSimParams' own ranking: screens 2, jets / wisps 1, spark trails 0 */
  private domainPrio(x: Domain): number { let m = -1; for (const e of this.emitters) if (e.domain === x.index) m = Math.max(m, SmokeSystem.prioOf(e)); return m; }
  private static prioOf(e: { prio?: number; kind?: string }): number { return e.prio ?? (e.kind === 'canister' ? 2 : 1); }
  /** Take a slot and make it a fresh domain at p — or null when none may be taken (W8.7). A free slot first; else RECYCLE the live domain that matters least among those
   *  that may go: never one carrying an emitter of this priority or higher (its plume is somebody's smoke screen or muzzle gas — and evicting it only made its emitters
   *  claim the next slot and evict another: the ping-pong of eight busy slots), never one under a second old unless the newcomer outranks everything in it. What a
   *  recycled domain was carrying is DROPPED with it (lower priority by construction), so nothing comes back for the slot. `ep` = where the emitter itself sits (p is
   *  where the domain should be centred: a shot's anchor ahead of the muzzle): a placement that could never contain it — over the ceiling clamp outdoors, under the
   *  bottom row — is refused too, since update() would only ask for another next frame, and the next (a 64³ clear + bake a frame, for a puff four metres up a lamp post). */
  private placeDomain(p: Vec3, cls: DomainClass, ep?: Vec3, prio = 1, acc: { side: number; top?: number } = { side: 0.1 }): Domain | null {
    let plan = this.planOrigin(p, cls);
    if (ep && !SmokeSystem.contains(plan.origin, plan.voxel, ep, acc.side, acc.top)) plan = this.planOrigin(ep, cls);   // the box round the anchor would not hold the emitter itself: centre it on the emitter instead (one domain, not one now and another when update() migrates it)
    if (!SmokeSystem.contains(plan.origin, plan.voxel, ep ?? p, acc.side, acc.top)) { this.stats.refused++; return null; }   // only the height band can fail now: too near the ceiling for a fine box, or above its clamp altogether (outdoors)
    let d = this.domains.find(x => !x.live);
    if (!d) {
      let best: Domain | null = null, bestScore = Infinity;
      for (const x of this.domains) {
        const carried = this.domainPrio(x);
        if (carried >= prio) continue;                                              // somebody's screen / gas of this rank or above: not ours to take
        if (this.time - x.born < MIN_RECYCLE_AGE && !(carried >= 0 || prio >= 2)) continue;   // an idle plume under a second old stays (a screen may still take it)
        const score = (carried >= 0 ? 1e6 : 0) + x.mass * 10 + Math.max(0, 30 - (this.time - x.lastEmit));   // idle first, then least mass, then longest quiet
        if (score < bestScore) { bestScore = score; best = x; }
      }
      if (!best) { this.stats.refused++; return null; }
      d = best;
      const n0 = this.emitters.length; this.emitters = this.emitters.filter(e => e.domain !== d!.index); this.pushes = this.pushes.filter(q => q.domain !== d!.index);
      if (this.emitters.length < n0) this.stats.evicted++;
    }
    d.voxel = plan.voxel; d.cls = cls; d.origin = plan.origin; d.floorClosed = plan.floorClosed;
    d.live = true; d.plume = false; d.born = this.time; d.lastEmit = this.time; d.mass = 0; d.needsBake = true; d.needsClear = true; d.needsClearCoarse = true; d.parity = 0; d.bricks = { active: 0, scalar: 0, vel: 0, vmax: 0, render: 0, vmaxS: 0 }; d.skipped = false; d.since = 1; d.owed = 0; d.period = 1;
    d.sealed = new Map(); d.sealNow = this.sealersIn(d);
    this.stats.placed++;
    this.writeDomainUbo();
    return d;
  }
  /** A live domain of the class to take an emitter at `ep` whose plume wants centring on `p` (a shot's anchor ahead of the muzzle; = ep for most): one that holds ep inside
   *  the acceptance `acc` update() will then hold it to (acceptOf) and — when the source's gas TRAVELS toward p (`roomAhead`: a bore jet, and anything free to migrate) —
   *  holds p with slack too, so a reused box does not put its open face a hand ahead of the jet; else a fresh one (or null: see placeDomain). A slow confined curl asks
   *  only to be inside: it is not going anywhere the anchor points. */
  private domainFor(p: Vec3, cls: DomainClass, ep: Vec3, acc: { side: number; top?: number }, roomAhead: boolean, prio = 1): Domain | null {
    for (const d of this.domains) if (d.live && d.cls === cls && this.domainContains(d, ep, acc.side, acc.top) && (!roomAhead || this.domainContains(d, p, cls === 'fine' ? 0.2 : 0.35))) return d;
    return this.placeDomain(p, cls, ep, prio, acc);
  }
  /** The sealing door leaves (BoxFlag.SoundSeal) whose footprint overlaps live-or-planned domain d, with the pose each stands at now — read off the world's dynamic list,
   *  which is this frame's (game.update fills it before smoke.update / the render). What the obstacle bake makes solid, and what update() compares against `sealed`. */
  private sealersIn(d: { origin: Vec3; voxel: number }): Map<Box, SealPose> {
    const out = new Map<Box, SealPose>(); const dyn = this.engine.world?.dynamics; if (!dyn) return out;
    const [sx, , sz] = this.size(d); const pad = 0.1;
    const x0 = d.origin[0] - pad, x1 = d.origin[0] + sx + pad, z0 = d.origin[2] - pad, z1 = d.origin[2] + sz + pad;
    for (let i = 0; i < dyn.length; i++) {
      const b = dyn[i]; if (!(b.flags & BoxFlag.SoundSeal)) continue;
      const [ex, ez] = BoxWorld.footprint(b);
      if (b.c[0] + ex < x0 || b.c[0] - ex > x1 || b.c[2] + ez < z0 || b.c[2] - ez > z1) continue;
      out.set(b, { cx: b.c[0], cz: b.c[2], yaw: b.yaw });
    }
    return out;
  }
  /** has the set of sealing leaves in a domain, or the pose of one, moved on from what its obstacle field was baked with? */
  private static sealChanged(baked: Map<Box, SealPose>, now: Map<Box, SealPose>): boolean {
    if (baked.size !== now.size) return true;
    for (const [b, q] of now) { const s = baked.get(b); if (!s || Math.abs(s.cx - q.cx) > SEAL_MOVE || Math.abs(s.cz - q.cz) > SEAL_MOVE || Math.abs(s.yaw - q.yaw) > SEAL_TURN) return true; }
    return false;
  }
  private writeDomainUbo() {
    // renderer-facing: struct SmokeDomain { origin: vec3f, voxel: f32, atlasOffset: vec3u, live: u32, dims: vec3u, floorClosed: u32, densityScale, pad×3 }
    const data = new ArrayBuffer(64 * 8); const f = new Float32Array(data), u = new Uint32Array(data);
    let n = 0;
    this.domains.forEach((d, i) => {
      const o = i * 16;
      f[o] = d.origin[0]; f[o + 1] = d.origin[1]; f[o + 2] = d.origin[2]; f[o + 3] = d.voxel;
      u[o + 4] = 0; u[o + 5] = 0; u[o + 6] = DIMS[2] * i; u[o + 7] = d.live ? 1 : 0;
      u[o + 8] = DIMS[0]; u[o + 9] = DIMS[1]; u[o + 10] = DIMS[2]; u[o + 11] = d.floorClosed ? 1 : 0;   // (the renderer's edge fade keeps a closed floor's smoke and eases an open bottom like the sides: common.wgsl smokeEdgeFade)
      f[o + 12] = d.plume ? this.params.densityScale : (this.params.fxDensityScale ?? 1.0); f[o + 13] = 0; f[o + 14] = 0; f[o + 15] = 0;   // (per domain: a canister's plume at the designer's 1.6, gun gas / dust at their own tuning)
      if (d.live) n = i + 1;
    });
    this.engine.device.queue.writeBuffer(this.domainUbo, 0, data);
    this.binding.count = this.params.enabled ? n : 0;
    // sim-facing per-domain params (256-B stride): zOff, index, floorClosed, pad, origin
    const dp = new ArrayBuffer(256 * MAX_DOMAINS);
    this.domains.forEach((d, i) => { const uu = new Uint32Array(dp, 256 * i, 8), ff = new Float32Array(dp, 256 * i, 8); uu[0] = DIMS[2] * i; uu[1] = i; uu[2] = d.floorClosed ? 1 : 0; uu[3] = 0; ff[4] = d.origin[0]; ff[5] = d.origin[1]; ff[6] = d.origin[2]; ff[7] = d.voxel; });
    this.engine.device.queue.writeBuffer(this.domParamBuf, 0, dp);
  }

  // ---------------------------------------------------------------- API
  emit(e: SmokeEmitter) {
    if (!this.params.enabled || this.params.frozen) return;   // frozen: a fresh domain would go live over a slab (and occupancy words) nothing clears until the next step
    const cls = e.lattice ?? (e.kind === 'canister' ? 'coarse' : 'fine');
    const d = this.domainFor(e.anchor ?? e.pos, cls, e.pos, SmokeSystem.acceptOf(e, false, cls), !e.confined || e.kind === 'jet', SmokeSystem.prioOf(e));
    if (!d) return;   // no domain may hold it (see placeDomain): the request is dropped, counted in stats.refused
    d.lastEmit = this.time;
    if (e.kind === 'canister' && !d.plume) { d.plume = true; this.writeDomainUbo(); }   // (its render density steps up to the plumes' scale the moment a can starts in it)
    // a splat narrower than a cell falls between samples: deposits next to nothing and flickers as it moves (spark trails on the 5.5 cm lattice)
    const radius = e.minVoxels ? Math.max(e.radius, e.minVoxels * d.voxel) : e.radius;
    this.emitters.push({ ...e, radius, pos: v3.copy(e.pos), dir: v3.normalize(e.dir), domain: d.index });
    if (this.emitters.length > 64) { const drop = this.emitters.findIndex(x => (x.prio ?? 1) === 0); this.emitters.splice(drop >= 0 ? drop : 0, 1); }   // shed a spark trail before a screen
  }
  push(p: SmokePush) {
    if (!this.params.enabled || this.params.frozen || this.pushes.length >= 10) return;
    for (const d of this.domains) if (d.live && this.domainContains(d, p.pos, 0.02)) { this.pushes.push({ ...p, pos: v3.copy(p.pos), domain: d.index }); return; }
  }
  inSmokeDomain(p: Vec3): boolean { for (const d of this.domains) if (d.live && d.mass > 2 && this.domainContains(d, p, 0)) return true; return false; }
  /** emitters an effect may still add and have packed this step (pushes take up to 6 of the MAX_EMITTERS slots) */
  budget(): number { return Math.max(0, MAX_EMITTERS - 6 - this.emitters.length); }
  spawnCanister(pos: Vec3, duration?: number) {
    const P = this.params;
    this.emit({ pos: v3.add(pos, [0, 0.12, 0]), dir: [0, 1, 0], speed: P.canisterSpeed, radius: P.canisterRadius, density: P.canisterDensity, temperature: P.canisterTemp, ttl: duration ?? P.canisterDuration, age: 0, kind: 'canister' });
  }
  clearAll() { for (const d of this.domains) { d.live = false; d.lastEmit = -1e9; } this.emitters.length = 0; this.writeDomainUbo(); }
  /** re-write the per-domain uniforms (a render-density knob changed on the panel) */
  refreshDomains() { this.writeDomainUbo(); }
  /** OBSTACLES CHANGED (the game's one call, destruction.ts hide(): a static knocked off its desk / a stack scattered is flagged NoPrimary | NoShadow, which the bake skips):
   *  every live domain within r of c re-bakes its obstacle field at its next step, so the plume stops flowing round a thing that is no longer there. A level reset
   *  restores the statics AND retires every domain (Game.restartEncounter → clearAll), so the way back needs no call. Door leaves need none either: update() watches them. */
  obstaclesChanged(c: Vec3, r: number) {
    for (const d of this.domains) {
      if (!d.live) continue; const [sx, sy, sz] = this.size(d);
      if (c[0] + r < d.origin[0] || c[0] - r > d.origin[0] + sx || c[1] + r < d.origin[1] || c[1] - r > d.origin[1] + sy || c[2] + r < d.origin[2] || c[2] - r > d.origin[2] + sz) continue;
      d.needsBake = true;
    }
  }

  // ---------------------------------------------------------------- WIND (game/wind.ts): the air the forces step relaxes toward inside each source's support
  /** This frame's sources (kept by reference until the next call; ≤ WIND_GPU_MAX are packed) and the relaxation rate at a jet's core. Once a frame from Game.update; an
   *  empty list = still air. Never touches a domain's life: placeDomain / lastEmit / retirement know nothing of wind — a vent over an empty room simulates nothing. */
  setWind(srcs: readonly WindGpuSource[], relax: number) { this.windSrcs = srcs; this.windRelax = relax; }
  /** Pack the wind block for this frame's step: the first WIND_GPU_MAX sources whose bound overlaps ANY live domain, and per domain the mask of which of them do (a
   *  sphere against the domain's box). Uploaded only on a frame that carries a source over a live domain, plus once (count 0) on the frame after the last such —
   *  so still air costs no upload and the kernel one branch per cell. */
  private writeWind(live: Domain[]) {
    const u = this.windU, f = this.windF;
    let n = 0; const masks = [0, 0, 0, 0, 0, 0, 0, 0]; let doms = 0;
    for (const s of this.windSrcs) {
      if (n >= WIND_GPU_MAX) break;
      if (!(s.speed > 0)) continue;
      let bits = 0;
      for (const d of live) {   // sphere vs the domain's axis-aligned box; the storm instead: any domain not wholly inside the interior footprint (it blows nowhere in there)
        const [sx, sy, sz] = this.size(d); const c = s.bound.c;
        if (s.kind === 'storm') { const I = s.interior; if (!I || !(d.origin[0] >= I[0] && d.origin[2] >= I[1] && d.origin[0] + sx <= I[2] && d.origin[2] + sz <= I[3])) bits |= 1 << d.index; continue; }
        const dx = Math.max(d.origin[0] - c[0], 0, c[0] - (d.origin[0] + sx)), dy = Math.max(d.origin[1] - c[1], 0, c[1] - (d.origin[1] + sy)), dz = Math.max(d.origin[2] - c[2], 0, c[2] - (d.origin[2] + sz));
        if (dx * dx + dy * dy + dz * dz <= s.bound.r * s.bound.r) bits |= 1 << d.index;
      }
      if (!bits) continue;   // (over no live smoke: nothing to bend)
      for (let di = 0; di < MAX_DOMAINS; di++) if (bits & (1 << di)) masks[di] |= 1 << n;
      const o = (WIND_HDR_BYTES + n * WIND_SRC_BYTES) / 4;
      if (s.kind === 'storm') {
        const I = s.interior ?? [0, 0, 0, 0], A = s.annex ?? [0, 0, 0, 0];
        f[o] = I[0]; f[o + 1] = I[1]; f[o + 2] = I[2]; f[o + 3] = I[3];
        f[o + 4] = s.dir[0]; f[o + 5] = s.dir[1]; f[o + 6] = s.dir[2]; f[o + 7] = s.speed;
        f[o + 8] = A[0]; f[o + 9] = A[1]; f[o + 10] = A[2]; f[o + 11] = A[3];
        u[o + 12] = 1;
      } else {
        f[o] = s.pos[0]; f[o + 1] = s.pos[1]; f[o + 2] = s.pos[2]; f[o + 3] = s.reach;
        f[o + 4] = s.dir[0]; f[o + 5] = s.dir[1]; f[o + 6] = s.dir[2]; f[o + 7] = s.speed;
        f[o + 8] = s.tanSpread; f[o + 9] = s.r0; f[o + 10] = s.dMax; f[o + 11] = s.floorY ?? -1e9;
        u[o + 12] = 0;
      }
      u[o + 13] = 0; u[o + 14] = 0; u[o + 15] = 0;
      n++;
    }
    for (let di = 0; di < MAX_DOMAINS; di++) { u[4 + di] = masks[di] >>> 0; if (masks[di]) doms++; }
    u[0] = n; f[1] = Math.max(0, this.windRelax); f[2] = 0.02; f[3] = 0;
    this.stats.windSrcs = n; this.stats.windDomains = doms;
    if (n === 0 && !this.windArmed) return;   // still air, and the block already says so
    this.windArmed = n > 0;
    this.engine.device.queue.writeBuffer(this.windBuf, 0, this.windData, 0, n > 0 ? WIND_HDR_BYTES + n * WIND_SRC_BYTES : WIND_HDR_BYTES);
  }

  update(dt: number) {
    if (this.params.frozen) return;   // debug freeze: no ageing, tracking or retirement either — the field, its domains and its occupancy stay exactly put
    this.time += dt;
    // Follow tracked sources, migrate to a containing domain if the source moved out, drop the expired. AGEING is not done here but in encode(), by the dt the emitter's own
    // domain integrates that frame (W8.10): a domain sitting a frame out (params.fullRateDomains) deposits nothing that frame and both frames' worth the next, so its
    // emitters' clocks must stand still with it — aged by the wall clock, a 0.08 s muzzle jet in a half-rate domain at 30 fps died with a quarter of its gas never deposited
    // (15 % at full rate: the last update dropped it before the step that would have laid its tail). (The solver off: nothing steps, so age them here as before rather
    // than let them wait for ever.)
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i]; if (!this.params.enabled) e.age += dt;
      if (e.age >= e.ttl) { this.emitters.splice(i, 1); continue; }
      if (e.track) {
        const t = e.track();
        if (t) { e.pos = v3.copy(t.pos); if (e.kind === 'wisp') e.dir = v3.normalize(v3.add([0, 1, 0], v3.scale(t.dir, 0.3))); }
        else if (e.confined) { this.emitters.splice(i, 1); continue; }   // the spark it was riding went out
      }
      const d = this.domains[e.domain]; const acc = SmokeSystem.acceptOf(e, true, d.cls);
      if (!d.live || !this.domainContains(d, e.pos, acc.side, acc.top)) {   // (a confined source is let sit right up to the open faces and the top band — it will never be given another box, and its splat mostly lands inward)
        // a barrel wisp that wanders out of its domain (shooter running) or a spark trail arcing out of the box is not worth a fresh 64³ domain — let it go
        if (e.kind === 'wisp' || e.confined) { this.emitters.splice(i, 1); continue; }
        const nd = this.domainFor(e.pos, d.cls, e.pos, SmokeSystem.acceptOf(e, false, d.cls), true, SmokeSystem.prioOf(e));
        if (nd) { e.domain = nd.index; if (e.kind === 'canister' && !nd.plume) { nd.plume = true; this.writeDomainUbo(); } }
        else if (!d.live) { this.emitters.splice(i, 1); continue; }   // its domain is gone and none may replace it
        // else: nothing better to be had this frame (every slot spoken for, or no box could hold it where it is) — it stays with the live domain it has and asks again next frame
      }
      this.domains[e.domain].lastEmit = this.time;
    }
    // retire idle domains
    for (const d of this.domains) {
      if (!d.live) continue;
      const idle = this.time - d.lastEmit;
      if ((idle > 4 && d.mass < 0.5 && this.time - d.born > 2) || idle > 40) { d.live = false; this.writeDomainUbo(); }
    }
    // door leaves (W8.2): the sealing leaves standing in each live domain as of this frame; a leaf that shut, opened past the seal, or moved a voxel since the bake → re-bake
    for (const d of this.domains) { if (!d.live) continue; d.sealNow = this.sealersIn(d); if (!d.needsBake && SmokeSystem.sealChanged(d.sealed, d.sealNow)) d.needsBake = true; }
    this.stats.live = this.domains.filter(d => d.live).length; this.stats.emitters = this.emitters.length;
    if (this.stats.live === 0) {
      this.pushes.length = 0;   // nothing will consume them; don't let them leak into a recycled domain index later
      this.stats.bricksActive = this.stats.bricksScalar = this.stats.bricksVel = this.stats.bricksRender = this.stats.bricksTotal = this.stats.vmax = 0;   // no step runs, so no readback refreshes these
    }
    if (this.binding.count !== (this.params.enabled ? this.liveCount() : 0)) this.writeDomainUbo();
  }
  private liveCount() { let n = 0; this.domains.forEach((d, i) => { if (d.live) n = i + 1; }); return n; }

  // ---------------------------------------------------------------- GPU
  /** Pack the step's parameters + emitters and upload one copy of the block per DISTINCT dt among the domains stepping this frame (`stepDt`: domain index → the dt its step
   *  integrates — the frame's for a full-rate domain, the frames it sat out added on for the others; a live domain absent from it sits this frame out) — the same emitters,
   *  jitter and everything else in every copy, so a domain reads its own dt purely by the dynamic offset returned for it (copy 0 = the frame's dt). */
  private writeSimParams(dt: number, stepDt: ReadonlyMap<number, number>): Map<number, number> {
    const f = this.simF, u = this.simU; const P = this.params;
    const sitting = (di: number) => this.domains[di].live && !stepDt.has(di);
    const heldPushes = this.pushes.filter(p => sitting(p.domain));   // one-frame pushes into a domain sitting this frame out: kept for its step next frame
    if (heldPushes.length) this.pushes = this.pushes.filter(p => !sitting(p.domain));
    u[0] = DIMS[0]; u[1] = DIMS[1]; u[2] = DIMS[2];
    type Packed = (SmokeEmitter | (SmokePush & { density?: number; temperature?: number; kind?: undefined; age?: number; ttl?: number; mode?: undefined; push?: number; expand?: number; attack?: number; jitter?: number; prio?: number })) & { domain: number };
    const room = MAX_EMITTERS - Math.min(this.pushes.length, 6);
    let ems: Packed[] = this.emitters;
    // more live emitters than slots: keep by priority (screens > jets / wisps > spark trails), newest first within a priority — never starve a
    // 20 s canister for the second half of a flashbang's trails
    const prioOf = (e: Packed) => e.prio ?? (e.kind === 'canister' ? 2 : 1);
    if (ems.length > room) ems = ems.map((e, i) => ({ e, i })).sort((a, b) => (prioOf(b.e) - prioOf(a.e)) || (b.i - a.i)).slice(0, room).map(x => x.e);
    const all: Packed[] = [...ems, ...this.pushes.slice(0, MAX_EMITTERS - ems.length)];
    // expanding sources first: the solver's two per-cell expansion loops only run over [0, numExpand)
    const expands = (e: Packed) => P.expansion && (e.expand ?? 0) > 0;
    const em = [...all.filter(expands), ...all.filter(e => !expands(e))];
    u[3] = em.length;
    f[4] = P.turbulence; f[5] = dt; f[6] = this.time; f[7] = P.buoyancy;
    f[8] = P.weight; f[9] = P.vortConf; f[10] = P.velDamp; f[11] = P.densDecay;
    f[12] = P.tempDecay; f[13] = DIMS[2] * MAX_DOMAINS; f[14] = P.windX; f[15] = P.windZ;
    const omega = Math.min(OMEGA_MAX, Math.max(OMEGA_MIN, +P.omega || 0)); this.stats.omega = omega;   // (W8.9: whatever the panel says, the sweeps run inside SOR's convergent range)
    u[16] = em.filter(expands).length; f[17] = omega; u[18] = P.brickSkip ? 1 : 0; f[19] = Math.max(0, P.flushEps);
    em.forEach((e, i) => {
      const o = SIM_HEADER_WORDS + i * EMITTER_WORDS; const d = this.domains[e.domain];
      const kind: string = e.kind ?? 'push';
      let dens = e.density ?? 0, temp = e.temperature ?? 0, expand = P.expansion ? (e.expand ?? 0) : 0;
      const age = e.age ?? 0, ttl = e.ttl ?? 1;
      // emission envelope: the ported effects ramp in over `attack` and out over the last quarter (density, heat AND expansion, so a burst does not
      // shove the air before it has any smoke to shove); legacy kinds keep their hand-made fades
      const envAt = (a: number): number => {
        const x = Math.min(1, a / ttl);
        if (e.attack !== undefined) return Math.min(1, a / Math.max(e.attack, 1e-3)) * (x > 0.75 ? Math.max(0, (1 - x) / 0.25) : 1);
        if (kind === 'wisp') return Math.pow(1 - x, 1.5);
        if (kind === 'canister') return Math.min(1, a / 0.6) * (x > 0.85 ? (1 - x) / 0.15 : 1);
        return 1;
      };
      // What this STEP deposits (W8.10): the envelope's mean over the stretch of the step's interval (age − dt‥age] the emitter was alive for, times that fraction of the
      // step — its own domain's dt (a domain catching up a skipped frame integrates both frames' worth), and its last step counted up to ttl exactly instead of dropped
      // whole the update before. Read at the interval's end as it used to be, a 0.08 s muzzle jet laid 94 % of its gas at 60 fps, 85 % at 30 and 77 % in a half-rate
      // domain at 30; this lays 100 ± 1 % at all three. (Pushes have no clock: full strength for the one step they exist.)
      let env = 1;
      if (e.ttl !== undefined) {
        const sd = stepDt.get(d.index) ?? dt; const a1 = Math.min(age, ttl), a0 = Math.max(0, age - sd);
        if (a1 <= a0) env = 0; else { let s = 0; for (let k = 0; k < 4; k++) s += envAt(a0 + (a1 - a0) * (k + 0.5) / 4); env = (s / 4) * ((a1 - a0) / sd); }
      }
      dens *= env; temp *= env; expand *= env;
      // per-frame jitter of the jet direction/speed seeds asymmetry that confinement/turbulence then amplify (seeded effects bring their own, smaller)
      const j = e.jitter ?? (kind === 'flash' || kind === 'push' || kind === 'burst' ? 0.08 : 0.35); const jd = v3.normalize([e.dir[0] + (sysRandom() - 0.5) * j, e.dir[1] + (sysRandom() - 0.5) * j, e.dir[2] + (sysRandom() - 0.5) * j]);
      const sp = e.speed * (kind === 'push' ? 1 : e.jitter !== undefined ? 1 + (sysRandom() - 0.5) * e.jitter : 0.75 + sysRandom() * 0.5);
      f[o] = e.pos[0] - d.origin[0]; f[o + 1] = e.pos[1] - d.origin[1]; f[o + 2] = e.pos[2] - d.origin[2]; f[o + 3] = e.radius;
      f[o + 4] = jd[0]; f[o + 5] = jd[1]; f[o + 6] = jd[2]; f[o + 7] = sp;
      f[o + 8] = dens; f[o + 9] = temp; u[o + 10] = e.domain; f[o + 11] = e.mode === 'burst' ? 1 : 0;
      f[o + 12] = e.push ?? LEGACY_PUSH; f[o + 13] = expand; f[o + 14] = 0; f[o + 15] = 0;
    });
    this.pushes.length = 0; if (heldPushes.length) this.pushes.push(...heldPushes);
    // one copy per distinct step dt (copy 0 = the frame's own): identical but for f[5]
    const dts = [dt]; const offsets = new Map<number, number>();
    for (const [di, sdt] of stepDt) { let k = dts.indexOf(sdt); if (k < 0) { k = dts.length; dts.push(sdt); } offsets.set(di, k * SIM_PARAMS_STRIDE); }
    dts.forEach((v, k) => { f[5] = v; this.engine.device.queue.writeBuffer(this.simParamBuf, k * SIM_PARAMS_STRIDE, this.simData); });
    f[5] = dt;
    return offsets;
  }
  /** the count of frames that stepped anything (the phase the far / calm domains' periods are staggered on; what a domain is owed lives on the domain: `owed` / `since`) */
  private stepNo = 0;
  /** rank of each live domain by distance from the view's look-at point (0 = nearest), for params.fullRateDomains */
  private rankByView(live: Domain[]): Map<Domain, number> {
    const focus = this.engine.viewFocus;
    const d2 = (d: Domain) => { const [sx, , sz] = this.size(d); const cx = d.origin[0] + sx / 2, cz = d.origin[2] + sz / 2; return (cx - focus[0]) ** 2 + (cz - focus[2]) ** 2; };
    const sorted = [...live].sort((a, b) => d2(a) - d2(b) || a.index - b.index);
    return new Map(sorted.map((d, i) => [d, i]));
  }

  /** First use of params.pressureHalf: build the option's module, pipelines and coarse textures. The pipelines compile asynchronously — encode()
   *  stays on the full-resolution solve until `ready`, and for good if any of them fails (logged; stats.halfStatus says which). Nothing here exists,
   *  or is compiled, on a run that never switches the option on. */
  private ensureHalf() {
    if (this.half) return;
    const device = this.engine.device;
    const [w, h, d] = HALF_DIMS;
    const tex = (label: string) => device.createTexture({ label, size: [w, h, d * MAX_DOMAINS], dimension: '3d', format: 'r32float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
    const H: HalfRes = { ready: false, failed: null, pipes: {}, pA: tex('smokeHalfPA'), pB: tex('smokeHalfPB'), div: tex('smokeHalfDiv'), blocks: tex('smokeHalfBlocks') };   // 4 × 1 MB
    this.half = H; this.stats.halfStatus = 'compiling';
    const mod = makeShader(device, this.prelude + smokeSrc + halfSrc, 'smokeHalf');   // (a compile message's line number counts the prelude and all of smoke.wgsl first)
    const layout = device.createPipelineLayout({ bindGroupLayouts: [this.g0Layout, this.g1Layout] });
    const specs: [string, string, Record<string, number>?][] = [
      ['restrictDiv', 'restrictDiv'], ['prolongate', 'prolongate'], ['clearCoarse', 'clearCoarse'],
      ['sorCR', 'rbgsC', { RB_COLOR: 0 }], ['sorCB', 'rbgsC', { RB_COLOR: 1 }],   // coarse red / black half sweeps (the fine smoothing pairs reuse the default module's rbgsR / rbgsB)
    ];
    Promise.all(specs.map(([name, entryPoint, constants]) => device.createComputePipelineAsync({ label: 'smoke_' + name, layout, compute: { module: mod, entryPoint, ...(constants ? { constants } : {}) } }).then(p => { H.pipes[name] = p; })))
      .then(() => { H.ready = true; this.stats.halfStatus = 'ready'; })
      .catch(e => { H.failed = String(e?.message ?? e); this.stats.halfStatus = 'failed: ' + H.failed; console.error('smoke: pressureHalf pipelines failed to build — staying on the full-resolution pressure solve', e); });
  }

  private ensureBakeBG() {
    const w = this.engine.world;
    if (this.bakeBG && this.bakeBGItems === w.itemBuf) return;
    this.bakeBG = this.engine.device.createBindGroup({ layout: this.bakeLayout, entries: [
      { binding: 0, resource: this.obst.createView() },
      { binding: 1, resource: { buffer: w.geoBuf } }, { binding: 2, resource: { buffer: w.cellBuf } }, { binding: 3, resource: { buffer: w.itemBuf } }, { binding: 4, resource: { buffer: w.infoBuf } },
      { binding: 5, resource: { buffer: this.sealBuf } },
    ] });
    this.bakeBGItems = w.itemBuf;
  }
  /** Fill the bake's SealS uniform with the sealing leaves standing in the domains about to be baked (their `sealNow`, one entry per leaf, MAX_SEALERS at most): centre +
   *  cos yaw, half extents + sin yaw — the pane table's convention, unpacked by bakeObstacles exactly as insideBox unpacks a box's packed yaw. */
  private writeSealers(live: Domain[]) {
    const f = this.sealF, u = this.sealU; const seen = new Set<Box>(); let n = 0;
    for (const d of live) {
      if (!d.needsBake) continue;
      for (const b of d.sealNow.keys()) {
        if (seen.has(b) || n >= MAX_SEALERS) continue; seen.add(b);
        const o = 4 + n * 8;
        f[o] = b.c[0]; f[o + 1] = b.c[1]; f[o + 2] = b.c[2]; f[o + 3] = Math.cos(b.yaw);
        f[o + 4] = b.h[0]; f[o + 5] = b.h[1]; f[o + 6] = b.h[2]; f[o + 7] = Math.sin(b.yaw);
        n++;
      }
    }
    u[0] = n; u[1] = 0; u[2] = 0; u[3] = 0; this.stats.sealers = n;
    this.engine.device.queue.writeBuffer(this.sealBuf, 0, this.sealData);
  }

  encode(enc: GPUCommandEncoder, ts: (n: string) => GPUComputePassTimestampWrites | undefined) {
    // pressureHalf edge: the first frame it is seen on builds the option's GPU side (once) and marks every domain's coarse pressure for zeroing, so a
    // runtime toggle never warm-starts from a slab left over from the last time it was on. Checked before the early-outs so an edge while nothing
    // is live still counts. (An on→off→on between two frames is not an edge: the coarse field is then simply still current.)
    const wantHalf = !!this.params.pressureHalf;
    if (wantHalf && !this.halfArmed) { this.ensureHalf(); for (const d of this.domains) d.needsClearCoarse = true; }
    this.halfArmed = wantHalf;
    const live = this.domains.filter(d => d.live);
    this.stats.steps = 0;
    if (live.length === 0) { this.stats.windSrcs = 0; this.stats.windDomains = 0; }   // (WIND: nothing live = nothing to bend; the block keeps whatever it held — no kernel reads it)
    if (!this.params.enabled || this.params.frozen || live.length === 0) return;   // (frozen: densA and the render occupancy both keep their last step — still a matched pair)
    if (this.engine.lastDt <= 0) return;                        // paused (menu open): the field holds still — stepping with a fallback dt kept injecting behind the pause card
    const dt = Math.min(DT_MAX, Math.max(1 / 2000, this.engine.lastDt));
    // WHO STEPS THIS FRAME. Every live domain has a PERIOD p (frames per step): the N nearest the view's look-at (params.fullRateDomains, the Phase 0 cap) get 1, the farther
    // ones 2 — and (params.calmCells, perf/smoke-scale) a domain nothing is emitting or pushing into gets clamp(⌊calmCells ÷ cells-its-fastest-VISIBLE-parcel-crosses-a-frame⌋, 1, 4)
    // if that is longer: a hanging plume moving a tenth of a voxel a frame is stepped every fourth frame with four frames' dt, and still moves a tenth of a voxel a frame.
    // A domain steps when it has waited p frames, or on its own phase of p (staggered by rank, so the far / calm domains spread over the frames instead of piling onto one),
    // and always when a clear or an obstacle bake is pending (those must run before anything renders it). With calmCells 0 and p ∈ {1, 2} this is the schedule as it was,
    // statement for statement: step unless (far, stepped last frame, odd phase). Decided before the emitters are packed, so a one-frame push into a domain sitting out waits for its step.
    const fullN = Math.max(0, Math.min(MAX_DOMAINS, Math.round(this.params.fullRateDomains ?? MAX_DOMAINS)));
    const rank = fullN < live.length ? this.rankByView(live) : null;
    const calmK = Math.max(0, +this.params.calmCells || 0);
    const busy = new Set<number>(); if (calmK > 0) { for (const e of this.emitters) busy.add(e.domain); for (const p of this.pushes) busy.add(p.domain); }
    this.stats.skipped = 0; this.stepNo++;
    const stepDt = new Map<number, number>();
    for (const d of live) {
      const rk = rank ? (rank.get(d) ?? 0) : 0;
      let p = rank && rk >= fullN ? 2 : 1;
      if (calmK > 0 && !busy.has(d.index) && this.time - d.born > 1) {   // calm: no source in it (and past its first second, whose brick speeds have not been read back yet)
        const cellsPerFrame = Math.max(d.bricks.vmaxS, 0.02) * dt / d.voxel;   // (the SMOKE's speed: air stirred by confinement or a vent where nothing is left to see does not keep a domain dear)
        p = Math.max(p, Math.min(MAX_PERIOD, Math.max(1, Math.floor(calmK / cellsPerFrame))));
      }
      d.owed = Math.min(d.owed + dt, DT_CAP[MAX_PERIOD - 1]); d.period = p;
      const phase = (this.stepNo + (rank ? rk - fullN : d.index)) % p === 0;
      const step = d.needsClear || d.needsBake || p === 1 || d.since >= p || phase;
      if (step) stepDt.set(d.index, Math.min(d.owed, DT_CAP[Math.min(d.since, MAX_PERIOD) - 1]));   // the dt it sat out added on, capped by how many frames that was (1/30, 1/20, 1/15, 1/12)
      else d.since++;
    }
    // AGE the emitters by exactly what their domain integrates this frame (W8.10, see update()): nothing in a domain sitting out, the frames it sat out added on in one catching up
    for (const e of this.emitters) { const d = this.domains[e.domain]; const sd = d.live ? stepDt.get(d.index) : undefined; if (sd !== undefined) e.age += sd; }
    const dyn0 = this.writeSimParams(dt, stepDt);
    this.writeWind(live);   // WIND: this frame's sources over these domains → the forces kernel's block (nothing uploaded in still air)
    this.ensureBakeBG();
    if (live.some(d => d.needsBake)) this.writeSealers(live);   // the sealing door leaves the bakes below make solid (one uniform for the frame's bakes)
    const [W, H, D] = DIMS; const wg: [number, number, number] = [Math.ceil(W / 4), Math.ceil(H / 4), Math.ceil(D / 4)];
    const cwg: [number, number, number] = [Math.ceil(HALF_DIMS[0] / 4), Math.ceil(HALF_DIMS[1] / 4), Math.ceil(HALF_DIMS[2] / 4)];   // one invocation per 2×2×2 block
    const HR = wantHalf && this.half?.ready ? this.half : null;   // the option runs this frame (else: off, still compiling, or failed → the fine solve, untouched)
    this.stats.pressure = HR ? 'half' : 'fine';
    const pass = enc.beginComputePass({ label: 'smoke', timestampWrites: ts('smoke') });
    const A = { velA: this.velA, velB: this.velB };
    const doMass = (++this.massFrame % 15) === 0 && !this.massPending;   // every 15th step: reduceMass per domain, then (after the pass) copy out + clear the accumulators
    // A domain sitting out keeps its density slab, its render occupancy and its brick stats exactly as its last step left them (a matched set), and still has its
    // mass reduced on a mass frame so the retirement rule reads a current figure; one that sat out steps with the dt it is owed (its own SimParams copy, writeSimParams).
    for (const d of live) {
      if (!stepDt.has(d.index)) {                                   // sit this frame out
        d.skipped = true; this.stats.skipped++;
        if (doMass) { pass.setBindGroup(0, this.g0, [0, 256 * d.index]); pass.setPipeline(this.pipes.reduceMass); pass.setBindGroup(1, this.bg('mass', { srcDens: this.densA })); pass.dispatchWorkgroups(...wg); this.stats.steps++; }
        continue;
      }
      const dyn = [dyn0.get(d.index) ?? 0, 256 * d.index]; const steps0 = this.stats.steps;
      d.skipped = false; d.since = 1; d.owed = 0;
      pass.setBindGroup(0, this.g0, dyn);
      const run = (pipe: string, bg: GPUBindGroup, groups: readonly [number, number, number] = wg, pipes = this.pipes) => { pass.setPipeline(pipes[pipe]); pass.setBindGroup(1, bg); pass.dispatchWorkgroups(...groups); this.stats.steps++; };
      if (d.needsClear) {
        run('clearAll', this.bg('clear0', { dstVel: this.velA, dstDens: this.densA, dstP: this.pA, dstCurl: this.curlT }));
        run('clearAll', this.bg('clear1', { dstVel: this.velB, dstDens: this.densB, dstP: this.pB, dstCurl: this.curlT }));
        d.needsClear = false; d.needsClearCoarse = true; d.parity = 0;
      }
      if (d.needsBake) { pass.setPipeline(this.bakePipe); pass.setBindGroup(1, this.bakeBG!); pass.dispatchWorkgroups(...wg); d.needsBake = false; d.sealed = d.sealNow; this.stats.bakes++; this.stats.steps++; }   // (sealed: the leaves this field now holds, at these poses — update() compares against them)
      // velocity roles alternate each step: "cur" holds the latest projected field
      const cur = d.parity === 0 ? A.velA : A.velB, oth = d.parity === 0 ? A.velB : A.velA; const pn = d.parity;
      run('advectVel', this.bg(`advV${pn}`, { srcVel: cur, srcObst: this.obst, dstVel: oth }));
      run('curl', this.bg(`curl${pn}`, { srcVel: oth, dstCurl: this.curlT }));
      run('forces', this.bg(`forces${pn}`, { srcVel: oth, srcDens: this.densA, srcCurl: this.curlT, srcObst: this.obst, dstVel: cur }));
      run('divergence', this.bg(`div${pn}`, { srcVel: cur, srcObst: this.obst, dstDiv: this.divT }));
      // pressure: red-black SOR — red half sweep pA→pB, black half sweep pB→pA, so every pair leaves the result in pA where project reads it
      const red = this.bg('sorR', { srcP: this.pA, srcDiv: this.divT, srcObst: this.obst, dstP: this.pB });
      const black = this.bg('sorB', { srcP: this.pB, srcDiv: this.divT, srcObst: this.obst, dstP: this.pA });
      const pairs = Math.min(PAIRS_MAX, Math.max(1, Math.round(+this.params.rbIters) || 1)); this.stats.rbPairs = pairs;   // (W8.9: 1‥16 pairs whatever the panel holds — NaN or 0 = 1)
      if (HR) {
        // LOSSY pressureHalf (pressure_half.wgsl): restrict divT + the obstacle bake to 32³ blocks (block divergence + packed face counts), run the same
        // pairs there (HR.pA → HR.pB → HR.pA, warm-started), prolongate along open connections into pA, optionally smooth with ordinary fine pairs,
        // then the unchanged project below reads pA as always
        if (d.needsClearCoarse) { run('clearCoarse', this.bg('halfClear', { dstP: HR.pA, dstDiv: HR.pB }), cwg, HR.pipes); d.needsClearCoarse = false; }
        run('restrictDiv', this.bg('halfRestrict', { srcDiv: this.divT, srcObst: this.obst, dstDiv: HR.div, dstP: HR.blocks }), cwg, HR.pipes);   // (dstP carries the block words)
        const redC = this.bg('halfSorR', { srcP: HR.pA, srcDiv: HR.div, srcObst: HR.blocks, dstP: HR.pB });
        const blackC = this.bg('halfSorB', { srcP: HR.pB, srcDiv: HR.div, srcObst: HR.blocks, dstP: HR.pA });
        for (let i = 0; i < pairs; i++) { run('sorCR', redC, cwg, HR.pipes); run('sorCB', blackC, cwg, HR.pipes); }
        run('prolongate', this.bg('halfProlong', { srcP: HR.pA, srcObst: HR.blocks, dstP: this.pA }), cwg, HR.pipes);
        const smooth = Math.max(0, Math.min(3, Math.round(this.params.pressureHalfSmooth) || 0));
        for (let i = 0; i < smooth; i++) { run('rbgsR', red); run('rbgsB', black); }   // the fine sweeps and their sorR / sorB bind groups as they are: pA → pB → pA
      } else {
        for (let i = 0; i < pairs; i++) { pass.setPipeline(this.pipes.rbgsR); pass.setBindGroup(1, red); pass.dispatchWorkgroups(...wg); pass.setPipeline(this.pipes.rbgsB); pass.setBindGroup(1, black); pass.dispatchWorkgroups(...wg); this.stats.steps += 2; }
      }
      run('project', this.bg(`proj${pn}`, { srcVel: cur, srcP: this.pA, srcObst: this.obst, dstVel: oth }));   // projected field now in `oth`
      // brick occupancy of exactly what advectScalars will read (densA + the projected field), then the dilated active set both scalar
      // kernels test; always run (two small dispatches) so the stats show the occupancy even while params.brickSkip is off
      const occ = this.bg(`occ${pn}`, { srcVel: oth, srcDens: this.densA });
      run('occupancy', occ, BRICK_GRID);   // one 8×8 workgroup per brick
      run('dilate', occ, [1, 1, 1]);       // one workgroup per domain (textures unused)
      run('advectScalars', this.bg(`advS${pn}`, { srcVel: oth, srcDens: this.densA, srcObst: this.obst, dstDens: this.densB }));
      run('injectDecay', this.bg('inj', { srcDens: this.densB, srcObst: this.obst, dstDens: this.densA }));
      // render occupancy LAST, on densA exactly as every render pass later in this command buffer will sample it (see renderOccRegions in smoke.wgsl):
      // per-brick region masks, then the packed "brick or its one-cell shell holds density" bits the scene shaders test before each atlas fetch.
      // Always run (~one extra read of densA + a 64-thread pack) so the words never go stale, whether or not the renderer's skip flag is on.
      const rocc = this.bg('rocc', { srcDens: this.densA });
      run('renderOccRegions', rocc, BRICK_GRID);   // one 8×8 workgroup per brick
      run('renderOccPack', rocc, [1, 1, 1]);       // one workgroup per domain
      if (doMass) run('reduceMass', this.bg('mass', { srcDens: this.densA }));
      d.parity ^= 1;
      this.stats.perStep = this.stats.steps - steps0;
    }
    pass.end();
    if (doMass) {
      enc.copyBufferToBuffer(this.massBuf, 0, this.massRead, 0, 32);
      enc.clearBuffer(this.massBuf, 0, 32);
      this.massPending = true;
    }
    if (!this.brickPending && (++this.brickFrame & 3) === 0) { enc.copyBufferToBuffer(this.brickStatBuf, 0, this.brickStatRead, 0, 4 * BRICK_STAT_WORDS * MAX_DOMAINS); this.brickPending = true; }   // stats for the HUD / console: every 4th frame is plenty
  }

  /** Call after queue.submit. */
  afterSubmit() {
    if (this.massPending && this.massRead.mapState === 'unmapped') {
      this.massRead.mapAsync(GPUMapMode.READ).then(() => {
        const u = new Uint32Array(this.massRead.getMappedRange().slice(0)); this.massRead.unmap();
        this.domains.forEach((d, i) => { d.mass = u[i] / 100; });
        this.massPending = false;
      }).catch(() => { this.massPending = false; });
    }
    if (this.brickPending && this.brickStatRead.mapState === 'unmapped') {
      this.brickStatRead.mapAsync(GPUMapMode.READ).then(() => {
        const m = this.brickStatRead.getMappedRange(); const u = new Uint32Array(m), f = new Float32Array(m);
        const s = this.stats; s.bricksActive = 0; s.bricksScalar = 0; s.bricksVel = 0; s.bricksRender = 0; s.bricksTotal = 0; s.vmax = 0;
        this.domains.forEach((d, i) => {
          const b = d.bricks; const o = i * BRICK_STAT_WORDS; b.active = u[o]; b.scalar = u[o + 1]; b.vel = u[o + 2]; b.vmax = f[o + 3]; b.render = u[o + 4]; b.vmaxS = f[o + 5];
          if (!d.live) return;   // a retired domain's slot just holds its last step
          s.bricksActive += b.active; s.bricksScalar += b.scalar; s.bricksVel += b.vel; s.bricksRender += b.render; s.bricksTotal += BRICKS_PER_DOMAIN; s.vmax = Math.max(s.vmax, b.vmax);
        });
        this.brickStatRead.unmap();
        this.brickPending = false;
      }).catch(() => { this.brickPending = false; });
    }
  }

  /** Debug / A-B: hash the textures that define the simulation state (densA = what the renderer samples, plus both velocity textures) over the
   *  live domains. Equal strings ⇒ bit-identical fields, e.g. the same seeded, fixed-step run replayed with params.brickSkip on and off. densB is
   *  deliberately left out: with skipping on it is scratch that is only defined inside the step's active bricks. ~6 MB of readback per live
   *  domain — a console tool, not for the frame loop. */
  async checksum(): Promise<string> {
    const device = this.engine.device; const [W, H, D] = DIMS;
    const live = this.domains.filter(d => d.live);
    if (live.length === 0) return 'no live domains';
    const texs: [string, GPUTexture][] = [['densA', this.densA], ['velA', this.velA], ['velB', this.velB]];
    const bpr = W * 8, slab = bpr * H * D;   // rgba16float: 8 B per texel, 512-B rows (256-aligned as copies require)
    const buf = device.createBuffer({ size: slab * live.length * texs.length, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = device.createCommandEncoder();
    texs.forEach(([, t], ti) => live.forEach((d, di) => enc.copyTextureToBuffer({ texture: t, origin: [0, 0, D * d.index] }, { buffer: buf, offset: (ti * live.length + di) * slab, bytesPerRow: bpr, rowsPerImage: H }, [W, H, D])));
    device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const u = new Uint32Array(buf.getMappedRange());
    const words = slab / 4 * live.length;
    const parts = texs.map(([name], ti) => { let h = 0x811c9dc5; for (let i = ti * words, e = i + words; i < e; i++) { h = Math.imul(h ^ u[i], 0x01000193) >>> 0; } return `${name}:${h.toString(16).padStart(8, '0')}`; });   // FNV-1a over 32-bit words
    buf.unmap(); buf.destroy();
    return `${parts.join(' ')} · domains ${live.map(d => d.index).join(',')} · t=${this.time.toFixed(3)}`;
  }
}
