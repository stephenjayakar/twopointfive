// The GPU smoke simulation (smoke.wgsl has the design; docs/internal/sparse-smoke.md the record): one world-wide lattice per voxel size, cut into 8³-cell bricks that exist only where
// smoke is, out of one pool. Nothing is placed, refused, recycled, migrated or retired on the CPU — an emitter is handed to the GPU in world coordinates and the GPU makes the bricks it
// needs. Exposes a SmokeBinding for the renderer. (Until 2026-10 this file was eight 64³ boxes placed by the CPU: git history has them.)
import { makeBuffer, makeShader, computePipelineAsync } from '../gpu/device';
import { Vec3, v3 } from '../math/vec';
import { Engine, SmokeBinding, FrameFlags } from '../engine';
import { wgslWorldConsts } from '../scene/world';
import { Box, BoxFlag, BoxWorld } from '../scene/boxes';
import { SmokeEmitter, SmokePush, SmokeSystemLike, WIND_GPU_MAX } from './types';
import type { WindGpuSource } from './types';
import { smokeGrid, smokeSolverConsts, SmokeGrid } from './smokeGrid';
import { sysRandom } from '../math/dice';   // the mixer / the solver draw the SYSTEM die, never the simulation's seeded one under a session recording (math/dice.ts)
import { DUST_DRAW } from './dustTint';
import smokeSrc from './smoke.wgsl' with { type: 'text' };
// WIND (game/wind.ts): the field's one WGSL text + the solver's block / forcing term, prepended to the module; the records come in through setWind() once a frame
import windFieldSrc from '../render/shaders/wind_field.wgsl' with { type: 'text' };
import windForceSrc from './wind_force.wgsl' with { type: 'text' };

export interface SmokeParams {
  buoyancy: number; weight: number; vortConf: number; velDamp: number; densDecay: number; tempDecay: number; turbulence: number;
  windX: number; windZ: number; enabled: boolean;
  /** render density × of CANISTER smoke, and of everything else — muzzle gas, impact / destruction dust puffs (08-13, the maintainer: at the plumes' 1.6× 'there's way too much that shows up
   *  on bullet impact'). What is in a cell is carried per cell (smoke.wgsl WHAT IS IN A CELL) and the two are laid in at publish, so every reader, the guards' probe included, takes one number */
  densityScale: number; fxDensityScale: number;
  /** pressure solve: red-black Gauss-Seidel + SOR — rbIters red/black sweep pairs per step, relaxed by omega */
  rbIters: number; omega: number;
  canisterDensity: number; canisterDuration: number; canisterRadius: number; canisterTemp: number; canisterSpeed: number;
  expansion: boolean;   // honour emitters' `expand` (divergence source + volume correction); off = they inject like plain jets
  /** debug / A-B: hold the field exactly as it is while it stays visible — no step, no emitter ageing, new emits dropped.
   *  (`enabled = false` is not that: it also hides the smoke from the renderer.) For pixel-exact captures of smoke shading changes. */
  frozen: boolean;
  /** CALM bricks step less often: a brick whose fastest air crosses at most this many cells in the wait sits 1 / 2 / 4 frames out (`sparse.calmMax`) and then integrates what it missed, so
   *  between two steps you SEE nothing in it has moved more than this (½: 2.7 cm on the coarse lattice). 0 = never waits in sight. Out of sight the allowance is `sparse.farCells`. */
  calmCells: number;
}
export const defaultSmokeParams = (): SmokeParams => ({ buoyancy: 1.6, weight: 0.03, vortConf: 4.0, velDamp: 0.3, densDecay: 0.14, tempDecay: 1.2, turbulence: 2.5, windX: 0, windZ: 0, densityScale: 1.3, fxDensityScale: 1.0, enabled: true, canisterDensity: 95, canisterDuration: 32, canisterRadius: 0.2, canisterTemp: 1.6, canisterSpeed: 1.9, expansion: true, rbIters: 4, omega: 1.7, frozen: false, calmCells: 0.5 });

const MAX_EMITTERS = 64, EMITTER_WORDS = 16;
const SP_HEADER_WORDS = 44, SP_LEVEL_WORDS = 16, SP_DIRTY_WORDS = 64, SP_WINDB_WORDS = 32;
const SP_EMIT_AT = SP_HEADER_WORDS + SP_LEVEL_WORDS + SP_DIRTY_WORDS + SP_WINDB_WORDS;
const SP_BYTES = (SP_EMIT_AT + MAX_EMITTERS * EMITTER_WORDS) * 4;
const WIND_SRC_BYTES = 64, WIND_HDR_BYTES = 48, WIND_BLOCK_BYTES = WIND_HDR_BYTES + WIND_GPU_MAX * WIND_SRC_BYTES;
const MAX_SEALERS = 32, SEAL_BYTES = 16 + MAX_SEALERS * 32, SEAL_MOVE = 0.03, SEAL_TURN = 0.05;
const MAX_DIRTY = 8;
const META_STRIDE = 40, A_HEADER = 32, M_HEADER = 16, STAT_WORDS = 64;
const LEGACY_PUSH = 25, DT_MAX = 1 / 30, DT_CAP_WAIT = 1 / 12 /* the most one step of a brick that waited integrates */, OMEGA_MIN = 1.0, OMEGA_MAX = 1.95, PAIRS_MAX = 16;
const CS = GPUShaderStage.COMPUTE;

interface SealPose { cx: number; cz: number; yaw: number; ex: number; ez: number; y0: number; y1: number }
type Packed = { pos: Vec3; dir: Vec3; speed: number; radius: number; level: number; density?: number; temperature?: number; kind?: string; age?: number; ttl?: number; mode?: string; push?: number; expand?: number; attack?: number; jitter?: number; prio?: number; tint?: Vec3; look?: boolean };

export class SmokeSystem implements SmokeSystemLike {
  params: SmokeParams = defaultSmokeParams();
  emitters: (SmokeEmitter & { level: number })[] = [];
  pushes: (SmokePush & { level: number })[] = [];
  time = 0;
  binding: SmokeBinding;
  readonly grid: SmokeGrid = smokeGrid();
  /** the pool's own knobs: keep = steps an unneeded brick is held; ring = CELLS of air kept round the smoke (8 = all 26 neighbour bricks); flushEps = density stored as 0 at or under it (a brick is given back
   *  once it is all zero; 0.002 is where the view march stops counting a sample — at half-float's 6e-5 a plume's invisible skirt would hold bricks for another 25 s); thinDecay / thinBelow =
   *  density under thinBelow goes up to thinDecay/s faster, always (a look knob: how far the faint skirt spreads); soft* = the pool's soft ceiling (smoke.wgsl SP); viewBias / viewR = that ceiling by where the
   *  camera looks: past viewR metres from engine.viewFocus (full at twice that) it starts sooner, bites harder, and the last quarter of the pool is refused (0 = one ceiling everywhere); indirect = dispatch exactly the live
   *  bricks off a GPU-written count (false: dispatch the whole pool, idle workgroups return at once — for A/B of the indirect calls' validation cost); directAt = with `indirect` on, the share of the pool stepping
   *  (as last read back) from which the whole pool is dispatched anyway: each indirect call costs a validation dispatch, −0.14 ms a step on the maintainer's Mac at ¾ full (> 1 = never); split = time the step's five
   *  parts apart. WHO STEPS (smoke.wgsl buildList): calmMax = the longest a brick may wait between steps, in frames (1 = every brick every frame, the solver as first benched; 2; 4); how calm it must be is
   *  params.calmCells (cells its fastest air may cross in the wait, 0 = never waits in sight); farCells = the same allowance out of sight (needs viewBias; 0 = no laxer than in sight; 1 keeps a far plume within a fifth of its stepped-every-frame mass at 7 s for two thirds fewer steps, 2 leaves nearly twice the smoke hanging: notebook §9.1).
   *  readSkip = the readers hop over air the page says is empty (smoke_read.wgsl spgSkip; false = they ask the page brick by brick and step by step, as first benched; same samples either way). SHIPS OFF: on the
   *  maintainer's Mac it saved no time (eight pairs, −0.25 to +0.17 ms of frame, mean −0.04; the view march alone 0.08 dearer: notebook §9.7); fewer page loads is not less time where the page sits in cache.
   *  fresh = the share of the pool thin smoke may never take: as the last 2 × fresh fills, what counts as thin rises, haze is refused new bricks, keeps less air round it and gives idle bricks back sooner, so a
   *  can just thrown stands up in a pool full of old smoke (smoke.wgsl WHO GIVES WAY; 0 = first come, as first benched).
   *  fine* = gun gas gives its bricks back (smoke.wgsl THE FINE LATTICE LETS GO): thin smoke on the fine lattice, and the heat in it, fades fineDecay/s faster, always; density / heat at or under fineEps / fineHeat is
   *  stored as 0 there and fineRing cells of air are kept round it (these three only while fineDecay > 0); that lattice may hold fineShare of the pool, or what the coarse one leaves under softLo if that is more (haze is
   *  refused bricks from 0.7 of it, all but sources at all of it). fineDecay 0 and fineShare 1 = none of it, as first benched: notebook §9.8.
   *  fineKeep = gas hotter than this on the fine lattice is not let go (0 = no such rule, as it was): what lets a fire's flame be heat on that lattice (game/fire.ts FIRE.gas
   *  raises it through keepHot while such a fire burns near the view and puts it back to 0; while it is up, gun gas and breath that hot linger as long too) */
  sparse = { keep: 20, ring: 4, flushEps: 2e-3, thinDecay: 0, thinBelow: 0.25, softLo: 0.6, softHi: 0.95, softEps: 0.03, softDecay: 1.5, viewBias: 1, viewR: 10, indirect: true, directAt: 0.5, split: false, calmMax: 4, farCells: 1, readSkip: false, fresh: 0.15, fineDecay: 3, fineShare: 0.25, fineEps: 0.01, fineHeat: 0.1, fineRing: 2, fineKeep: 0 };
  stats = {
    /** the pool in use in units of 512 bricks, at least 1 while anything is alive, 0 with no smoke: what the F9 recorder's smoke column and the tools' 'is there smoke yet' read (512 bricks = one of
     *  the 64³ boxes recordings from before 2026-10 counted, so the column still compares). No rule reads it. */
    live: 0,
    emitters: 0, steps: 0, perStep: 0, bricksScalar: 0, bricksRender: 0, vmax: 0, skipped: 0, bakes: 0, sealers: 0, omega: 0, rbPairs: 0, windSrcs: 0,
    /** as last read back: bricks in the pool's live list / free slots / allocations refused that step / made / given back / fine-lattice bricks drawn / bounding boxes / the flush threshold in force; peak = most ever live */
    pool: 0, act: 0, free: 0, failed: 0, made: 0, freed: 0, fine: 0, boxes: 0, eps: 0, peak: 0, failedTotal: 0, stepNo: 0,
    /** bricks that stepped that frame (the rest waited: `skipped`) / brick-steps since the pool was last reset / the density that counts as thin just now (thinBelow until the pool runs short) */
    stepped: 0, work: 0, thin: 0,
    /** bricks of the fine lattice (gun gas), air round it included / brick requests its share of the pool refused, that step and in all (never in `failed`: the pool was not short) */
    fineAll: 0, fineHeld: 0, fineHeldTotal: 0,
    /** bricks with tinted smoke (destruction dust) in them */
    tinted: 0 };
  /** the readers' bounds as last read back (world metres) */
  boxes: { lo: Vec3; hi: Vec3; level: number }[] = [];

  private A: GPUBuffer; private M: GPUBuffer; private V: GPUBuffer; private S: GPUBuffer; private P: GPUBuffer;
  private argsBuf: GPUBuffer; private domBuf: GPUBuffer; private statBuf: GPUBuffer; private statRead: GPUBuffer[] = []; private statBusy: boolean[] = []; private statQueued = -1;
  private spBuf: GPUBuffer; private windBuf: GPUBuffer; private sealBuf: GPUBuffer;
  private atlas: GPUTexture; private page: GPUTexture;
  private spData = new ArrayBuffer(SP_BYTES); private spF = new Float32Array(this.spData); private spU = new Uint32Array(this.spData);
  private windData = new ArrayBuffer(WIND_BLOCK_BYTES); private windF = new Float32Array(this.windData); private windU = new Uint32Array(this.windData);
  private sealData = new ArrayBuffer(SEAL_BYTES); private sealF = new Float32Array(this.sealData); private sealU = new Uint32Array(this.sealData);
  private windSrcs: readonly WindGpuSource[] = []; private windRelax = 3;
  private g0L: GPUBindGroupLayout; private g1L: GPUBindGroupLayout; private gLinkL: GPUBindGroupLayout; private gArgsL: GPUBindGroupLayout; private gPubL: GPUBindGroupLayout; private gBoxL: GPUBindGroupLayout;
  private g0: GPUBindGroup; private g1: GPUBindGroup; private gArgs: GPUBindGroup; private gPub: GPUBindGroup; private gBox: GPUBindGroup;
  private gLink: GPUBindGroup | null = null; private gLinkItems: GPUBuffer | null = null;
  private pipes: Record<string, GPUComputePipeline> = {};
  private mod: GPUShaderModule;
  private stepNo = 0;
  private quiet = 1e9;         // read-backs in a row that found the pool empty, counted only from steps after the last emit (never per step: a script stepping without yielding sees no read-back land)
  private emitStep = 0;        // the step count when something was last emitted
  private epoch = 0;           // bumped by clearAll: a read-back in flight across one is dropped
  private needsReset = true; private needsWipe = true;
  private dirty: { lo: Vec3; hi: Vec3 }[] = []; private bakeAll = false;
  private sealed = new Map<Box, SealPose>();

  constructor(private engine: Engine) {
    const device = engine.device, g = this.grid, cap = g.cap;
    const ST = GPUBufferUsage.STORAGE, CD = GPUBufferUsage.COPY_DST, CSRC = GPUBufferUsage.COPY_SRC;
    this.A = makeBuffer(device, (A_HEADER + 3 * cap + g.n0 + g.nPage) * 4, ST | CD | CSRC, 'smokeA');
    this.M = makeBuffer(device, (M_HEADER + 2 * cap + cap * META_STRIDE) * 4, ST | CD | CSRC, 'smokeM');
    this.V = makeBuffer(device, cap * 1536 * 8, ST | CSRC, 'smokeV');
    this.S = makeBuffer(device, cap * (1024 + 128 + 512) * 4, ST | CSRC, 'smokeS');
    this.P = makeBuffer(device, cap * 1024 * 4, ST | CSRC, 'smokeP');
    this.argsBuf = makeBuffer(device, 32, ST | GPUBufferUsage.INDIRECT | CD, 'smokeArgs');
    this.domBuf = makeBuffer(device, 64 * 8, ST | GPUBufferUsage.UNIFORM | CD, 'smokeBounds');
    this.statBuf = makeBuffer(device, STAT_WORDS * 4, ST | CSRC, 'smokeStats');
    for (let i = 0; i < 3; i++) { this.statRead.push(makeBuffer(device, STAT_WORDS * 4, GPUBufferUsage.MAP_READ | CD, 'smokeStatsRead' + i)); this.statBusy.push(false); }
    this.spBuf = makeBuffer(device, SP_BYTES, GPUBufferUsage.UNIFORM | CD, 'smokeParams');
    this.windBuf = makeBuffer(device, WIND_BLOCK_BYTES, GPUBufferUsage.UNIFORM | CD, 'smokeWind');
    this.sealBuf = makeBuffer(device, SEAL_BYTES, GPUBufferUsage.UNIFORM | CD, 'smokeSeal');
    this.atlas = device.createTexture({ label: 'smokeAtlas', size: g.atlasTex, dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });
    this.page = device.createTexture({ label: 'smokePage', size: g.pageTex, dimension: '3d', format: 'r32uint', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING });

    const sto = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, buffer: { type: 'storage' } });
    const ro = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, buffer: { type: 'read-only-storage' } });
    const uni = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, buffer: { type: 'uniform' } });
    this.g0L = device.createBindGroupLayout({ label: 'smokeG0', entries: [uni(0), uni(2)] });
    this.g1L = device.createBindGroupLayout({ label: 'smokeG1', entries: [sto(0), sto(1), sto(2), sto(3), sto(4)] });
    this.gLinkL = device.createBindGroupLayout({ label: 'smokeLink', entries: [ro(1), ro(2), ro(3), uni(4), uni(5)] });
    this.gArgsL = device.createBindGroupLayout({ label: 'smokeArgsL', entries: [sto(6)] });
    this.gPubL = device.createBindGroupLayout({ label: 'smokePub', entries: [
      { binding: 7, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      { binding: 8, visibility: CS, storageTexture: { access: 'write-only', format: 'r32uint', viewDimension: '3d' } } ] });
    this.gBoxL = device.createBindGroupLayout({ label: 'smokeBox', entries: [sto(9), sto(10)] });
    const buf = (binding: number, buffer: GPUBuffer): GPUBindGroupEntry => ({ binding, resource: { buffer } });
    this.g0 = device.createBindGroup({ layout: this.g0L, entries: [buf(0, this.spBuf), buf(2, this.windBuf)] });
    this.g1 = device.createBindGroup({ layout: this.g1L, entries: [buf(0, this.A), buf(1, this.M), buf(2, this.V), buf(3, this.S), buf(4, this.P)] });
    this.gArgs = device.createBindGroup({ layout: this.gArgsL, entries: [buf(6, this.argsBuf)] });
    this.gPub = device.createBindGroup({ layout: this.gPubL, entries: [{ binding: 7, resource: this.atlas.createView() }, { binding: 8, resource: this.page.createView() }] });
    this.gBox = device.createBindGroup({ layout: this.gBoxL, entries: [buf(9, this.domBuf), buf(10, this.statBuf)] });
    this.mod = makeShader(device, wgslWorldConsts() + smokeSolverConsts(g) + windFieldSrc + '\n' + windForceSrc + '\n' + smokeSrc, 'smoke');
    this.binding = { uniform: this.domBuf, atlasView: this.atlas.createView(), count: 0, pageView: this.page.createView(), encode: (enc, ts) => this.encode(enc, ts) };
  }

  /** bytes of GPU memory the pool holds, by part (what the page quotes) */
  memory() {
    const g = this.grid, cap = g.cap;
    const fields = cap * (1536 * 8 + (1024 + 128 + 512) * 4 + 1024 * 4), tables = (A_HEADER + 3 * cap + g.n0 + g.nPage) * 4 + (M_HEADER + 2 * cap + cap * META_STRIDE) * 4;
    const atlas = g.atlasTex[0] * g.atlasTex[1] * g.atlasTex[2] * 8, page = g.pageTex[0] * g.pageTex[1] * g.pageTex[2] * 4;
    return { fields, tables, atlas, page, total: fields + tables + atlas + page, perBrick: fields / cap + 8000 };
  }

  /** Tools: recompile the solver from an edited smoke.wgsl text and swap every kernel in (the pool keeps its contents) */
  async hotSwap(src: string): Promise<void> {
    this.mod = makeShader(this.engine.device, wgslWorldConsts() + smokeSolverConsts(this.grid) + windFieldSrc + '\n' + windForceSrc + '\n' + src, 'smokeHot');
    await this.init();
  }
  async init(): Promise<void> {
    const device = this.engine.device, mod = this.mod;
    const pl = (extra?: GPUBindGroupLayout) => device.createPipelineLayout({ bindGroupLayouts: extra ? [this.g0L, this.g1L, extra] : [this.g0L, this.g1L] });
    const plain = pl(), jobs: Promise<unknown>[] = [];
    const add = (name: string, layout: GPUPipelineLayout, entryPoint = name, constants?: Record<string, number>) =>
      jobs.push(computePipelineAsync(device, { label: 'smoke_' + name, layout, compute: { module: mod, entryPoint, constants } }).then(p => { this.pipes[name] = p; }));
    for (const ep of ['stepBegin', 'markEmit', 'markNbr', 'freeIdle', 'buildList', 'advectVel', 'curl', 'forces', 'divergence', 'project', 'advectScalars', 'injectDecay']) add(ep, plain);
    add('rbgsR', plain, 'rbgs', { RB_COLOR: 0 }); add('rbgsB', plain, 'rbgs', { RB_COLOR: 1 });
    add('writeArgs', pl(this.gArgsL)); add('link', pl(this.gLinkL));
    const pub = pl(this.gPubL); add('publish', pub); add('publishAll', pub, 'publish', { PUB_ALL: 1 }); add('compose', pub); add('wipePage', pub);
    add('boxes', pl(this.gBoxL));
    await Promise.all(jobs);
  }

  // ---------------------------------------------------------------- the game's calls
  private levelOf(e: { lattice?: 'fine' | 'coarse'; kind?: string }): number { return (e.lattice ?? (e.kind === 'canister' ? 'coarse' : 'fine')) === 'coarse' ? 0 : 1; }
  emit(e: SmokeEmitter) {
    if (!this.params.enabled || this.params.frozen) return;
    const level = this.levelOf(e), voxel = this.grid.levels[level].voxel;
    const radius = e.minVoxels ? Math.max(e.radius, e.minVoxels * voxel) : e.radius;
    this.emitters.push({ ...e, radius, pos: v3.copy(e.pos), dir: v3.normalize(e.dir), level });
    if (this.emitters.length > 2 * MAX_EMITTERS) { let drop = this.emitters.findIndex(x => x.look); if (drop < 0) drop = this.emitters.findIndex(x => (x.prio ?? 1) === 0); this.emitters.splice(drop >= 0 ? drop : 0, 1); }
    this.quiet = 0; this.emitStep = this.stepNo;
  }
  push(p: SmokePush) {
    if (!this.params.enabled || this.params.frozen || this.pushes.length >= 20) return;
    let seen = 0;   // (a shove stirs whichever lattices have smoke there, once each: a level's bounds may overlap)
    const only = p.lattice ? this.levelOf(p) : -1;
    for (const b of this.boxes) if ((only < 0 || b.level === only) && !(seen >> b.level & 1) && this.inBox(b, p.pos)) { seen |= 1 << b.level; this.pushes.push({ ...p, pos: v3.copy(p.pos), level: b.level }); }
  }
  private inBox(b: { lo: Vec3; hi: Vec3 }, p: Vec3) { return p[0] >= b.lo[0] && p[0] <= b.hi[0] && p[1] >= b.lo[1] && p[1] <= b.hi[1] && p[2] >= b.lo[2] && p[2] <= b.hi[2]; }
  /** gas hotter than `heat` on the fine lattice is kept (sparse.fineKeep; 0 = no such rule): game/fire.ts raises it while a fire's flame is the solver's gas */
  keepHot(heat: number) { this.sparse.fineKeep = Math.max(0, +heat || 0); }
  /** is p somewhere smoke is being simulated? (the bounds as last read back: a frame or two old, and loose — what its two callers ask is 'is it worth stirring / thickening here') */
  inSmokeDomain(p: Vec3): boolean { for (const b of this.boxes) if (this.inBox(b, p)) return true; return false; }
  budget(): number { let n = 0; for (const e of this.emitters) if (!e.look) n++; return Math.max(0, MAX_EMITTERS - 12 - n); }   // (a `look` source is never counted: types.ts)
  drawing(): boolean { return this.params.enabled && !this.params.frozen && (this.engine.settings.flags & FrameFlags.Smoke) !== 0; }
  spawnCanister(pos: Vec3, duration?: number) {
    const P = this.params;
    this.emit({ pos: v3.add(pos, [0, 0.12, 0]), dir: [0, 1, 0], speed: P.canisterSpeed, radius: P.canisterRadius, density: P.canisterDensity, temperature: P.canisterTemp, ttl: duration ?? P.canisterDuration, age: 0, kind: 'canister' });
  }
  clearAll() { this.emitters.length = 0; this.pushes.length = 0; this.needsReset = true; this.needsWipe = true; this.boxes = []; this.binding.count = 0; this.quiet = 1e9; this.epoch++; this.zeroStats(); }
  /** a render-density row moved: every live brick's atlas block is written again on the next frame, the waiting ones' too, and with the field frozen as well (the scale is applied at publish, smoke.wgsl) */
  refreshDomains() { this.again = true; }
  private again = false; private skipWas = false;
  obstaclesChanged(c: Vec3, r: number) { this.noteDirty([c[0] - r, c[1] - r, c[2] - r], [c[0] + r, c[1] + r, c[2] + r]); }
  setWind(srcs: readonly WindGpuSource[], relax: number) { this.windSrcs = srcs; this.windRelax = relax; }
  /** the sources worth sending: blowing, and (a jet) with its bound within a metre of smoke as last read back or of a live source; past the block's eight, the nearest the view */
  private windNear(): readonly WindGpuSource[] {
    const near = (s: WindGpuSource) => {
      if (s.kind === 'storm') return true;
      const c = s.bound.c, r = s.bound.r + 1;
      for (const b of this.boxes) { let d2 = 0; for (let k = 0; k < 3; k++) { const d = Math.max(b.lo[k] - c[k], 0, c[k] - b.hi[k]); d2 += d * d; } if (d2 <= r * r) return true; }
      for (const e of this.emitters) if (v3.dist(e.pos, c) <= r + e.radius) return true;
      return false;
    };
    const out = this.windSrcs.filter(s => s.speed > 0 && near(s));
    if (out.length <= WIND_GPU_MAX) return out;
    const f = this.engine.viewFocus, key = (s: WindGpuSource) => s.kind === 'storm' ? -1 : v3.dist(s.bound.c, f);
    return out.sort((a, b) => key(a) - key(b)).slice(0, WIND_GPU_MAX);
  }
  private noteDirty(lo: Vec3, hi: Vec3) { if (!this.live()) return; if (this.dirty.length >= MAX_DIRTY) { this.bakeAll = true; return; } this.dirty.push({ lo, hi }); }
  /** anything to step: a source, bricks the pool last reported, or too soon after either to know */
  private live(): boolean { return this.emitters.length > 0 || this.quiet < 2; }
  private zeroStats() { const s = this.stats; s.live = 0; s.bricksScalar = s.bricksRender = s.vmax = 0; s.pool = 0; s.act = 0; s.free = this.grid.cap; s.failed = s.made = s.freed = s.fine = s.boxes = 0; s.stepNo = 0; s.stepped = s.skipped = 0; s.tinted = 0; s.fineAll = s.fineHeld = 0; }

  update(dt: number) {
    if (this.params.frozen) return;
    this.time += dt;
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i]; if (!this.params.enabled) e.age += dt;
      if (e.age >= e.ttl) { this.emitters.splice(i, 1); continue; }
      if (e.track) {
        const t = e.track();
        if (t) { e.pos = v3.copy(t.pos); if (e.kind === 'wisp') e.dir = v3.normalize(v3.add([0, 1, 0], v3.scale(t.dir, 0.3))); else if (e.trackVel) { e.speed = v3.len(t.dir); e.dir = v3.normalize(t.dir); } }
        else if (e.confined) { this.emitters.splice(i, 1); continue; }
      }
    }
    if (this.live()) this.watchSealers();
    this.stats.emitters = this.emitters.length;
    const on = this.params.enabled && this.live() && !this.needsReset;
    this.stats.live = on ? Math.max(1, Math.round(this.stats.pool / 512)) : 0;
    this.binding.count = on ? 8 : 0;
    this.binding.dusty = on && (this.stats.tinted > 0 || this.emitters.some(e => !!e.tint));   // (look only: the volumetric pass takes its dust twin on such frames — render/dustLookVol.ts)
    if (!on) { this.pushes.length = 0; if (this.stats.pool && this.params.enabled) this.zeroStats(); }   // (switched off the pool still holds what it held, and nothing would read the counts back while the world stands still: they stand, so `dusty` is right the frame it is switched on again)
  }

  /** door leaves that seal a doorway (BoxFlag.SoundSeal), world-wide: one that shut, opened or moved dirties the bricks round where it stood and where it stands */
  private watchSealers(force = false) {
    const dyn = this.engine.world?.dynamics; if (!dyn) return;
    const now = new Map<Box, SealPose>();
    for (let i = 0; i < dyn.length && now.size < MAX_SEALERS; i++) {
      const b = dyn[i]; if (!(b.flags & BoxFlag.SoundSeal)) continue;
      const [ex, ez] = BoxWorld.footprint(b);
      now.set(b, { cx: b.c[0], cz: b.c[2], yaw: b.yaw, ex, ez, y0: b.c[1] - b.h[1], y1: b.c[1] + b.h[1] });
    }
    const box = (q: SealPose) => this.noteDirty([q.cx - q.ex - 0.1, q.y0, q.cz - q.ez - 0.1], [q.cx + q.ex + 0.1, q.y1, q.cz + q.ez + 0.1]);
    let changed = force || now.size !== this.sealed.size;
    for (const [b, q] of now) { const s = this.sealed.get(b); if (!s) { box(q); changed = true; } else if (Math.abs(s.cx - q.cx) > SEAL_MOVE || Math.abs(s.cz - q.cz) > SEAL_MOVE || Math.abs(s.yaw - q.yaw) > SEAL_TURN) { box(s); box(q); changed = true; } else now.set(b, s); }
    for (const [b, s] of this.sealed) if (!now.has(b)) { box(s); changed = true; }
    if (!changed) return;
    this.sealed = now;
    const f = this.sealF, u = this.sealU; let n = 0;
    for (const b of now.keys()) {
      const o = 4 + n * 8;
      f[o] = b.c[0]; f[o + 1] = b.c[1]; f[o + 2] = b.c[2]; f[o + 3] = Math.cos(b.yaw);
      f[o + 4] = b.h[0]; f[o + 5] = b.h[1]; f[o + 6] = b.h[2]; f[o + 7] = Math.sin(b.yaw);
      n++;
    }
    u[0] = n; this.stats.sealers = n;
    this.engine.device.queue.writeBuffer(this.sealBuf, 0, this.sealData);
  }

  // ---------------------------------------------------------------- GPU
  private writeParams(dt: number) {
    const f = this.spF, u = this.spU, P = this.params, X = this.sparse, g = this.grid;
    const room = MAX_EMITTERS - Math.min(this.pushes.length, 12);
    let ems: Packed[] = this.emitters;
    const prioOf = (e: Packed) => e.look ? -1 : e.prio ?? (e.kind === 'canister' ? 2 : 1);
    if (ems.length > room) ems = ems.map((e, i) => ({ e, i })).sort((a, b) => (prioOf(b.e) - prioOf(a.e)) || (b.i - a.i)).slice(0, room).map(x => x.e);
    const all: Packed[] = [...ems, ...this.pushes.slice(0, MAX_EMITTERS - ems.length)];
    const expands = (e: Packed) => P.expansion && (e.expand ?? 0) > 0;
    const em = [...all.filter(expands), ...all.filter(e => !expands(e))];
    const omega = Math.min(OMEGA_MAX, Math.max(OMEGA_MIN, +P.omega || 0)); this.stats.omega = omega;
    const calmMax = X.calmMax >= 4 ? 4 : X.calmMax >= 2 ? 2 : 1;
    u[0] = em.length; u[1] = em.filter(expands).length; u[2] = this.stepNo; u[3] = Math.max(calmMax > 1 ? 8 : 1, X.keep | 0);   // (a brick that waits must step once more, to tell the readers it is empty, before its slot goes)
    f[4] = dt; f[5] = this.time; f[6] = P.buoyancy; f[7] = P.weight;
    f[8] = P.vortConf; f[9] = P.velDamp; f[10] = P.densDecay; f[11] = P.tempDecay;
    f[12] = P.turbulence; f[13] = omega; f[14] = Math.max(0, X.flushEps); u[15] = X.ring | 0;
    f[16] = P.windX; f[17] = P.windZ; u[18] = this.bakeAll ? 0 : this.dirty.length; u[19] = this.bakeAll ? 1 : 0;
    f[20] = X.softLo; f[21] = Math.max(X.softHi, X.softLo + 0.01); f[22] = X.softEps; f[23] = X.softDecay;
    f[24] = Math.max(0, X.thinDecay); f[25] = Math.max(1e-4, X.thinBelow); f[26] = X.readSkip ? 1 : 0; f[27] = Math.min(0.4, Math.max(0, +X.fresh || 0));
    const vf = this.engine.viewFocus; f[28] = vf[0]; f[29] = vf[2]; f[30] = Math.max(1, X.viewR); f[31] = Math.min(1, Math.max(0, X.viewBias));
    f[32] = Math.max(0, +P.calmCells || 0); f[33] = Math.max(0, +X.farCells || 0); u[34] = calmMax; f[35] = calmMax > 1 ? DT_CAP_WAIT : DT_MAX;
    f[36] = P.densityScale; f[37] = P.fxDensityScale ?? 1; f[38] = Math.max(0, +X.fineDecay || 0); f[39] = Math.min(1, Math.max(0.02, Number.isFinite(+X.fineShare) ? +X.fineShare : 1));
    const lets = f[38] > 0; f[40] = lets ? Math.max(0, +X.fineEps || 0) : 0; f[41] = lets ? Math.max(0, +X.fineHeat || 0) : 0; u[42] = lets ? Math.max(1, X.fineRing | 0) : 8; f[43] = lets ? Math.max(0, +X.fineKeep || 0) : 0;   // (its floors and its air go with the fade: one row off = all three)
    g.levels.forEach((L, l) => { const o = SP_HEADER_WORDS + l * 8; u[o] = L.dims[0]; u[o + 1] = L.dims[1]; u[o + 2] = L.dims[2]; u[o + 3] = L.pageBase; f[o + 4] = L.voxel; u[o + 5] = L.texY; u[o + 6] = L.tile; u[o + 7] = L.tileBase; });
    const dAt = SP_HEADER_WORDS + SP_LEVEL_WORDS;
    this.dirty.forEach((d, i) => { const o = dAt + i * 8; f[o] = d.lo[0]; f[o + 1] = d.lo[1]; f[o + 2] = d.lo[2]; f[o + 3] = 0; f[o + 4] = d.hi[0]; f[o + 5] = d.hi[1]; f[o + 6] = d.hi[2]; f[o + 7] = 0; });
    this.dirty.length = 0; this.bakeAll = false;
    // wind: struct WindBlock's records (wind_force.wgsl) + a bound each; which bricks a source reaches is the GPU's to find (link)
    const wf = this.windF, wu = this.windU, wAt = dAt + SP_DIRTY_WORDS; let n = 0;
    for (const s of this.windNear()) {
      const o = (WIND_HDR_BYTES + n * WIND_SRC_BYTES) / 4;
      if (s.kind === 'storm') {
        const R = s.roofs, Z = [0, 0, 0, 0]; const I = R ? R[0] : s.interior ?? Z, A = R ? R[1] ?? Z : s.annex ?? Z;   // (ROOF BY ROOF, game/wind.ts WX_OWN.wind: the level's first two roofs here, its third / fourth in the block's eight spare words, spare0 = 1 says so — wind_force.wgsl windSrcVel)
        for (let k = 0; k < 8; k++) wf[4 + k] = R?.[2 + (k >> 2)]?.[k & 3] ?? 0;
        wf[o] = I[0]; wf[o + 1] = I[1]; wf[o + 2] = I[2]; wf[o + 3] = I[3]; wf[o + 4] = s.dir[0]; wf[o + 5] = s.dir[1]; wf[o + 6] = s.dir[2]; wf[o + 7] = s.speed;
        wf[o + 8] = A[0]; wf[o + 9] = A[1]; wf[o + 10] = A[2]; wf[o + 11] = A[3]; wu[o + 12] = 1;
        f[wAt + n * 4 + 3] = -1;
      } else {
        wf[o] = s.pos[0]; wf[o + 1] = s.pos[1]; wf[o + 2] = s.pos[2]; wf[o + 3] = s.reach; wf[o + 4] = s.dir[0]; wf[o + 5] = s.dir[1]; wf[o + 6] = s.dir[2]; wf[o + 7] = s.speed;
        wf[o + 8] = s.tanSpread; wf[o + 9] = s.r0; wf[o + 10] = s.dMax; wf[o + 11] = s.floorY ?? -1e9; wu[o + 12] = 0;
        f[wAt + n * 4] = s.bound.c[0]; f[wAt + n * 4 + 1] = s.bound.c[1]; f[wAt + n * 4 + 2] = s.bound.c[2]; f[wAt + n * 4 + 3] = s.bound.r;
      }
      wu[o + 13] = s.kind === 'storm' && s.roofs ? 1 : 0; wu[o + 14] = 0; wu[o + 15] = 0; n++;
    }
    wu[0] = n; wf[1] = Math.max(0, this.windRelax); wf[2] = 0.02; wf[3] = 0; this.stats.windSrcs = n;
    this.engine.device.queue.writeBuffer(this.windBuf, 0, this.windData, 0, WIND_HDR_BYTES + n * WIND_SRC_BYTES);
    em.forEach((e, i) => {
      const o = SP_EMIT_AT + i * EMITTER_WORDS; const kind: string = e.kind ?? 'push';
      let dens = e.density ?? 0, temp = e.temperature ?? 0, expand = P.expansion ? (e.expand ?? 0) : 0;
      const age = e.age ?? 0, ttl = e.ttl ?? 1;
      const envAt = (a: number): number => {
        const x = Math.min(1, a / ttl);
        if (e.attack !== undefined) return Math.min(1, a / Math.max(e.attack, 1e-3)) * (x > 0.75 ? Math.max(0, (1 - x) / 0.25) : 1);
        if (kind === 'wisp') return Math.pow(1 - x, 1.5);
        if (kind === 'canister') return Math.min(1, a / 0.6) * (x > 0.85 ? (1 - x) / 0.15 : 1);
        return 1;
      };
      let env = 1;
      if (e.ttl !== undefined) {
        const a1 = Math.min(age, ttl), a0 = Math.max(0, age - dt);
        if (a1 <= a0) env = 0; else { let s = 0; for (let k = 0; k < 4; k++) s += envAt(a0 + (a1 - a0) * (k + 0.5) / 4); env = (s / 4) * ((a1 - a0) / dt); }
      }
      dens *= env; temp *= env; expand *= env;
      const j = e.jitter ?? (kind === 'flash' || kind === 'push' || kind === 'burst' ? 0.08 : 0.35); const jd = v3.normalize([e.dir[0] + (sysRandom() - 0.5) * j, e.dir[1] + (sysRandom() - 0.5) * j, e.dir[2] + (sysRandom() - 0.5) * j]);
      const sp = e.speed * (kind === 'push' ? 1 : e.jitter !== undefined ? 1 + (sysRandom() - 0.5) * e.jitter : 0.75 + sysRandom() * 0.5);
      f[o] = e.pos[0]; f[o + 1] = e.pos[1]; f[o + 2] = e.pos[2]; f[o + 3] = e.radius;
      f[o + 4] = jd[0]; f[o + 5] = jd[1]; f[o + 6] = jd[2]; f[o + 7] = sp;
      f[o + 8] = dens; f[o + 9] = temp; u[o + 10] = e.level; f[o + 11] = e.mode === 'burst' ? 1 : 0;
      f[o + 12] = e.push ?? LEGACY_PUSH; f[o + 13] = expand; f[o + 15] = 0;
      // what it raises (smoke.wgsl WHAT IS IN A CELL): not canister smoke = the first byte full; 1 − tint in the other three (look only: smoke/dustTint.ts's switch)
      const q = (x: number) => Math.max(0, Math.min(255, Math.round((1 - x) * 255))), t = DUST_DRAW.on ? e.tint : undefined;
      u[o + 14] = kind === 'canister' ? 0 : (255 | (t ? q(t[0]) << 8 | q(t[1]) << 16 | q(t[2]) << 24 : 0)) >>> 0;
    });
    this.pushes.length = 0;
    this.engine.device.queue.writeBuffer(this.spBuf, 0, this.spData, 0, (SP_EMIT_AT + Math.max(1, em.length) * EMITTER_WORDS) * 4);
    return em.length;
  }
  private ensureLinkBG() {
    const w = this.engine.world;
    if (this.gLink && this.gLinkItems === w.itemBuf) return;
    this.gLink = this.engine.device.createBindGroup({ layout: this.gLinkL, entries: [
      { binding: 1, resource: { buffer: w.geoBuf } }, { binding: 2, resource: { buffer: w.cellBuf } }, { binding: 3, resource: { buffer: w.itemBuf } }, { binding: 4, resource: { buffer: w.infoBuf } }, { binding: 5, resource: { buffer: this.sealBuf } } ] });
    this.gLinkItems = w.itemBuf;
  }
  encode(enc: GPUCommandEncoder, ts: (n: string) => GPUComputePassTimestampWrites | undefined) {
    this.stats.steps = 0;
    if (!this.params.enabled || !this.live()) return;
    if (this.sparse.readSkip !== this.skipWas) { this.skipWas = this.sparse.readSkip; this.again = true; }
    if (this.params.frozen || this.engine.lastDt <= 0) {   // nothing steps; what the readers are handed still follows its rows
      if (!this.again || this.needsReset || !this.pipes.publishAll) return;
      this.again = false;
      const q = this.engine.device.queue; q.writeBuffer(this.spBuf, 26 * 4, new Float32Array([this.sparse.readSkip ? 1 : 0])); q.writeBuffer(this.spBuf, 36 * 4, new Float32Array([this.params.densityScale, this.params.fxDensityScale ?? 1]));
      const pass = enc.beginComputePass({ label: 'smoke', timestampWrites: ts('smoke') }); pass.setBindGroup(0, this.g0); pass.setBindGroup(1, this.g1);
      pass.setPipeline(this.pipes.publishAll); pass.setBindGroup(2, this.gPub); pass.dispatchWorkgroups(this.grid.cap);
      pass.setPipeline(this.pipes.boxes); pass.setBindGroup(2, this.gBox); pass.dispatchWorkgroups(1); pass.end(); this.stats.steps = 2;
      return;
    }
    const dt = Math.min(DT_MAX, Math.max(1 / 2000, this.engine.lastDt));
    const g = this.grid, cap = g.cap;
    if (this.needsReset) {   // an empty pool: every slot on the free list, no page entry, no record
      // (queue writes land before this command buffer runs, so the clears cannot be in it: the header + free list are written whole instead, and the rest cleared in a buffer of its own now)
      const device = this.engine.device, e0 = device.createCommandEncoder({ label: 'smokeReset' });
      e0.clearBuffer(this.A); e0.clearBuffer(this.M); e0.clearBuffer(this.argsBuf); e0.clearBuffer(this.domBuf);
      device.queue.submit([e0.finish()]);
      const head = new Uint32Array(A_HEADER + cap); head[0] = cap; for (let i = 0; i < cap; i++) head[A_HEADER + i] = cap - 1 - i;
      device.queue.writeBuffer(this.A, 0, head);
      device.queue.writeBuffer(this.argsBuf, 0, new Uint32Array([0, 1, 1, 0, 0, 1, 1, 0]));
      this.needsReset = false; this.stepNo = 64; this.emitStep = 64;   // (past `keep`, so stamp + keep never wraps under 0; a cleared fine stamp of 0 never equals a step)
      this.sealed.clear(); this.watchSealers(true); this.dirty.length = 0; this.bakeAll = false;
    }
    this.stepNo++;
    for (const e of this.emitters) e.age += dt;
    const nEm = this.writeParams(dt);
    this.ensureLinkBG();
    type Op = { name: string; part: string; g2?: GPUBindGroup; n?: [number, number, number]; all?: boolean };   // (n absent = one workgroup per brick that steps this frame; all = per live brick)
    const ops: Op[] = []; let part = 'Alloc';
    const direct = (name: string, x: number, y = 1, z = 1, g2?: GPUBindGroup) => ops.push({ name, part, g2, n: [x, y, z] });
    const bricks = (name: string, g2?: GPUBindGroup, all = false) => ops.push({ name, part, g2, all });
    if (this.needsWipe) { direct('wipePage', Math.ceil(g.pageTex[0] / 4), Math.ceil(g.pageTex[1] / 4), Math.ceil(g.pageTex[2] / 4), this.gPub); this.needsWipe = false; }
    direct('stepBegin', 1);
    if (nEm > 0) direct('markEmit', nEm);
    bricks('markNbr', undefined, true);
    direct('freeIdle', Math.ceil(cap / 64));
    direct('buildList', Math.ceil(cap / 64));
    direct('writeArgs', 1, 1, 1, this.gArgs);
    bricks('link', this.gLink!);
    part = 'Vel'; bricks('advectVel'); bricks('curl'); bricks('forces'); bricks('divergence');
    const pairs = Math.min(PAIRS_MAX, Math.max(1, Math.round(+this.params.rbIters) || 1)); this.stats.rbPairs = pairs;
    part = 'Pressure'; for (let i = 0; i < pairs; i++) { bricks('rbgsR'); bricks('rbgsB'); }
    bricks('project');
    part = 'Scalars'; bricks('advectScalars'); bricks('injectDecay');
    part = 'Publish'; bricks(this.again ? 'publishAll' : 'publish', this.gPub, this.again); this.again = false;
    direct('compose', g.macroDims[0], g.macroDims[1], g.macroDims[2], this.gPub);
    direct('boxes', 1, 1, 1, this.gBox);
    // one compute pass ('smoke'); sparse.split = one per part, each with its own timestamps ('smokeAlloc' …) for the HUD and the F9 recorder
    const indirect = this.sparse.indirect && this.stats.stepped < this.sparse.directAt * cap;
    let pass: GPUComputePassEncoder | null = null, open = '';
    for (const op of ops) {
      const want = this.sparse.split ? op.part : '';
      if (!pass || want !== open) { pass?.end(); pass = enc.beginComputePass({ label: 'smoke' + want, timestampWrites: ts('smoke' + want) }); pass.setBindGroup(0, this.g0); pass.setBindGroup(1, this.g1); open = want; }
      pass.setPipeline(this.pipes[op.name]); if (op.g2) pass.setBindGroup(2, op.g2);
      if (op.n) pass.dispatchWorkgroups(op.n[0], op.n[1], op.n[2]); else if (indirect) pass.dispatchWorkgroupsIndirect(this.argsBuf, op.all ? 0 : 16); else pass.dispatchWorkgroups(cap);
      this.stats.steps++;
      if (this.perOp) { pass.end(); pass = null; this.perOp(op.name); }
    }
    pass?.end();
    this.stats.perStep = this.stats.steps;
    const r = this.statBusy.indexOf(false);
    if (r >= 0 && this.statQueued < 0) { enc.copyBufferToBuffer(this.statBuf, 0, this.statRead[r], 0, STAT_WORDS * 4); this.statQueued = r; }
  }

  private perOp: ((name: string) => void) | null = null;
  /** Tools: one step with every kernel in a submit of its own, waited for — wall ms per kernel (a software renderer's numbers mean something this way; a real GPU's are mostly submit latency) */
  async profileStep(dt: number): Promise<Record<string, number>> {
    const e = this.engine, device = e.device, out: Record<string, number> = {}; e.lastDt = dt;
    const cuts: { name: string; cb: GPUCommandBuffer }[] = []; let enc = device.createCommandEncoder();
    this.perOp = name => { cuts.push({ name, cb: enc.finish() }); enc = device.createCommandEncoder(); };
    const proxy = { beginComputePass: (d: GPUComputePassDescriptor) => enc.beginComputePass(d), copyBufferToBuffer: (...a: [GPUBuffer, number, GPUBuffer, number, number]) => enc.copyBufferToBuffer(...a) } as unknown as GPUCommandEncoder;
    try { this.encode(proxy, () => undefined); } finally { this.perOp = null; }
    await device.queue.onSubmittedWorkDone();
    for (const c of cuts) { const t = performance.now(); device.queue.submit([c.cb]); await device.queue.onSubmittedWorkDone(); out[c.name] = (out[c.name] ?? 0) + performance.now() - t; }
    device.queue.submit([enc.finish()]); this.afterSubmit();
    return out;
  }

  stepAlone(dt: number, focus?: Vec3) {
    if (!(dt > 0) || !this.live()) return;
    const e = this.engine; e.lastDt = dt; if (focus) e.viewFocus = focus;
    const enc = e.device.createCommandEncoder({ label: 'smokeAlone' });
    this.encode(enc, () => undefined);
    e.device.queue.submit([enc.finish()]);
    this.afterSubmit();
  }

  afterSubmit() {
    const r = this.statQueued; if (r < 0) return;
    this.statQueued = -1; this.statBusy[r] = true;
    const b = this.statRead[r], epoch = this.epoch;
    b.mapAsync(GPUMapMode.READ).then(() => {
      const m = b.getMappedRange(); const u = new Uint32Array(m.slice(0)); const f = new Float32Array(u.buffer); b.unmap(); this.statBusy[r] = false;
      if (epoch !== this.epoch || u[8] < this.stats.stepNo) return;   // (a step from before a clearAll, or an older one landing late)
      const s = this.stats;
      s.stepNo = u[8]; s.pool = u[0]; s.bricksScalar = u[1]; s.bricksRender = u[2]; s.failed = u[3]; s.failedTotal += u[3]; s.free = u[4]; s.vmax = f[5]; s.made = u[6]; s.freed = u[7];
      s.boxes = u[9]; s.bakes += u[10]; s.fine = u[11]; s.eps = f[12]; s.act = u[13]; s.stepped = u[14]; s.skipped = u[0] - u[14]; s.work = u[15]; s.thin = f[32]; s.tinted = u[33]; s.fineAll = u[34]; s.fineHeld = u[35]; s.fineHeldTotal += u[35]; s.peak = Math.max(s.peak, u[0]);
      if (u[0] > 0) this.quiet = 0; else if (u[8] > this.emitStep) this.quiet++;
      const out: { lo: Vec3; hi: Vec3; level: number }[] = [];
      for (let q = 0; q < 8; q++) {
        const a = u[16 + q * 2], z = u[17 + q * 2]; if (!(a >>> 31)) continue;
        const level = q >> 2, bs = 8 * this.grid.levels[level].voxel;
        out.push({ level, lo: [(a & 1023) * bs, ((a >> 10) & 1023) * bs, ((a >> 20) & 1023) * bs], hi: [((z & 1023) + 1) * bs, (((z >> 10) & 1023) + 1) * bs, (((z >> 20) & 1023) + 1) * bs] });
      }
      this.boxes = out;
    }).catch(() => { this.statBusy[r] = false; });
  }

  /** Tools: total density × cell volume per level (litres of 'density 1' smoke), its centroid and the box of cells over `thr` — read straight off the pool; `near` = only the bricks within r of a spot in plan. Slow (reads the whole pool back). */
  async measure(thr = 0.02, near?: { at: Vec3; r: number }): Promise<{ level: number; bricks: number; smoky: number; mass: number; centroid: Vec3; lo: Vec3; hi: Vec3; max: number }[]> {
    const device = this.engine.device, cap = this.grid.cap;
    const mB = (M_HEADER + 2 * cap + cap * META_STRIDE) * 4, sB = cap * 512 * 4;
    const rb = device.createBuffer({ size: mB + sB, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = device.createCommandEncoder(); enc.copyBufferToBuffer(this.M, 0, rb, 0, mB); enc.copyBufferToBuffer(this.S, 0, rb, mB, sB); device.queue.submit([enc.finish()]);
    await rb.mapAsync(GPUMapMode.READ);
    const M = new Uint32Array(rb.getMappedRange(0, mB)), S = new Uint16Array(rb.getMappedRange(mB, sB));
    const h2f = (h: number) => { const e = (h >> 10) & 31, m = h & 1023; return (h >> 15 ? -1 : 1) * (e === 0 ? m * 2 ** -24 : e === 31 ? Infinity : (1 + m / 1024) * 2 ** (e - 15)); };
    const out = [0, 1].map(level => ({ level, bricks: 0, smoky: 0, mass: 0, centroid: [0, 0, 0] as Vec3, lo: [1e9, 1e9, 1e9] as Vec3, hi: [-1e9, -1e9, -1e9] as Vec3, max: 0 }));
    for (let i = 0, n = this.needsReset ? 0 : M[0]; i < n; i++) {   // (a cleared pool is emptied on the GPU by its next step: until then the list is the old one)
      const slot = M[M_HEADER + i], cw = M[M_HEADER + 2 * cap + slot * META_STRIDE]; const l = (cw >>> 27) & 1, o = out[l], h = this.grid.levels[l].voxel;
      const bx = cw & 1023, by = (cw >>> 10) & 127, bz = (cw >>> 17) & 1023;
      if (near && Math.hypot((bx + 0.5) * 8 * h - near.at[0], (bz + 0.5) * 8 * h - near.at[2]) > near.r) continue;
      o.bricks++; const m0 = o.mass;
      for (let c = 0; c < 512; c++) {
        const d = h2f(S[(slot * 512 + c) * 2]); if (d <= 0) continue;
        const p: Vec3 = [(bx * 8 + (c & 7) + 0.5) * h, (by * 8 + ((c >> 3) & 7) + 0.5) * h, (bz * 8 + (c >> 6) + 0.5) * h];
        const w = d * h * h * h * 1000; o.mass += w; o.max = Math.max(o.max, d);
        for (let a = 0; a < 3; a++) { o.centroid[a] += p[a] * w; if (d > thr) { o.lo[a] = Math.min(o.lo[a], p[a]); o.hi[a] = Math.max(o.hi[a], p[a]); } }
      }
      if (o.mass > m0) o.smoky++;
    }
    for (const o of out) if (o.mass > 0) for (let a = 0; a < 3; a++) o.centroid[a] /= o.mass;
    rb.unmap(); rb.destroy();
    return out;
  }
}
