// Radiance cascades (world-space, 2.5D) — GPU resources, per-cascade params and dispatch.
import { cutSwap, ProgramSet } from './cutSwap';
import { makeBuffer, makeShader, computePipelineAsync } from '../gpu/device';
import { GpuTimer } from '../gpu/timer';
import { WORLD } from '../scene/world';
import { scenePrelude } from './frame';
import lightingCommon from './shaders/lighting_common.wgsl' with { type: 'text' };
import rcSrc from './shaders/rc.wgsl' with { type: 'text' };

export interface RcConfig {
  nx: number; ny: number; nz: number;   // cascade-0 probe grid
  d0: number;                           // directions per octahedral side at c0 (4 → 16 dirs)
  cascades: number;                     // number of cascades
  interval0: number;                    // base interval length (m); cascade n covers [L0*(4^n-1)/3, L0*(4^(n+1)-1)/3]
}

export const defaultRcConfig: RcConfig = { nx: 40, ny: 4, nz: 28, d0: 4, cascades: 4, interval0: 0.6 };   // 1 m probes: a radiance cache for the final gather, not something the eye sees directly

/** Upper-cascade refresh periods, indexed by cascade level (entry 0 is c0's and is ignored: c0 and the dice bake always run whole — they are the near field
 *  everything downstream reads this frame, and a tenth of the cost). Level n ≥ 1 re-traces an interleaved 1/period of its probes per frame. [1,1,1,1] =
 *  every level whole every frame = the cache as it always was. A level past the end of the array takes the last entry. */
export type RcPeriods = readonly number[];
export const RC_FULL_RATE: RcPeriods = [1, 1, 1, 1];
/** frames of whole-level bakes a fresh (or re-primed) cache takes before the schedule may skip anything: one frame already leaves every level valid (they are
 *  traced coarse → fine within the frame), the rest is margin for the half-rate option (uppers and c0 on alternate frames) and the stagger toggle */
const PRIME_FRAMES = 4;
/** EXTRA whole bakes run inside the ONE frame after invalidateWorld() (under `amortize`, with the history-free dice): the cascades' hits read last bake's dice for the
 *  bounce (lighting_common hitRadiance), so a cache with no history gains one bounce order per bake — a single history-free bake left the field ~25 % short and the
 *  0.3 EMA then crawled the rest in over ~8 frames (the light METER with it: −10 % at Sam's chest, −18 % at a lobby point on the ladder's first hop onto a prewarmed
 *  grid, measured 08-12, review R10.1). Four more converge the series to under 1 % of the OLD field in that frame (the day → night swap is the hard case: a
 *  residual of the day's bounce reads as a tenth of the night's) for ≈ 4 × the cascades' cost ONCE (≈ +4–7 ms on the hop / rebuild / daylight-swap frame, nothing after). 0 = the single history-free bake as before. */
const BOOST_BAKES = 4;
const PARAM_STRIDE = 256, PARAM_BYTES = 96, SCHED_OFFSET = 80;   // per-cascade uniform slot; RcParams is 96 B, its last 16 (sched) rewritten every frame

/** Solid angle of each texel of a D×D octahedral map (numerical), normalized to sum to 4π. */
export function octSolidAngles(D: number): Float32Array {
  const out = new Float32Array(D * D);
  const K = 24; // sub-samples per texel side
  const dec = (u: number, v: number): [number, number, number] => {
    const fx = u * 2 - 1, fy = v * 2 - 1;
    let nx = fx, nz = fy, ny = 1 - Math.abs(fx) - Math.abs(fy);
    const t = Math.max(-ny, 0); nx += nx >= 0 ? -t : t; nz += nz >= 0 ? -t : t;
    const l = Math.hypot(nx, ny, nz); return [nx / l, ny / l, nz / l];
  };
  let total = 0;
  for (let ty = 0; ty < D; ty++) for (let tx = 0; tx < D; tx++) {
    let om = 0; const du = 1 / (D * K);
    for (let sy = 0; sy < K; sy++) for (let sx = 0; sx < K; sx++) {
      const u = (tx * K + sx) * du, v = (ty * K + sy) * du;
      const a = dec(u, v), b = dec(u + du, v), c = dec(u, v + du);
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
      om += Math.hypot(cx, cy, cz);
    }
    out[ty * D + tx] = om; total += om;
  }
  const s = (4 * Math.PI) / total; for (let i = 0; i < out.length; i++) out[i] *= s;
  return out;
}

export class RadianceCascades {
  cfg: RcConfig;
  bufs: GPUBuffer[] = [];          // [0] = c0 full merged radiance; [n>=1] = pre-averaged merged radiance
  dice: GPUTexture; diceView: GPUTextureView; dicePrev!: GPUTexture; dicePrevView!: GPUTextureView;
  /** blend factor toward this frame's bake (1 = no history) */
  diceBlend = 0.3;
  dirOmegaBuf: GPUBuffer;
  private paramsBuf: GPUBuffer; private dummyParent: GPUBuffer | null = null;
  private pipeUpper!: GPUComputePipeline; private pipeC0!: GPUComputePipeline; private pipeDice!: GPUComputePipeline;
  private bgTrace: GPUBindGroup[] = []; private bgDice: GPUBindGroup;
  dims: [number, number, number][] = [];
  stats = { intervals: 0, bytes: 0 };
  /** update upper cascades every other frame (halves their cost, adds ≤1 frame of latency to far-field light) */
  staggerUpper = false;
  /** LOSSY option (engine.settings.rcHalfRate): the whole cache at half rate — upper cascades on even frames, c0 + the dice bake on odd ones
   *  (the engine gives such a pair one direction jitter, so c0 merges parents traced with its own directions and the bake decodes c0 with
   *  them too). Everything downstream just reads a dice volume that is at most a frame older; bounce / light meter / smoke ambient lag a
   *  moving light by that much. staggerUpper then counts in pairs (c2+ every fourth frame). */
  halfRate = false;
  /** AMORTIZED UPKEEP (engine.settings.rcAmortize, mirrored every frame; docs/internal/p0a-cascades.md): when on, upper level n re-traces an interleaved
   *  1/periods[n] of its probes per frame (rc.wgsl rcUpper's scheduled path) — constant work every frame, every probe refreshed once per period, c0 + the
   *  dice bake whole every frame; a fresh cache first bakes whole levels for PRIME_FRAMES so a never-traced probe is never read, and a re-primed one
   *  (invalidateWorld — engine.rebuildRc calls it) also takes its next dice bake with no history so it does not crawl up from black. Off = every level whole
   *  every frame through the original 3-D dispatch and the configured dice blend from the first bake: the cache exactly as it was — and so is ON while the
   *  periods are all 1 (bit-identical captures, docs/internal/p0a-cascades.md §6). */
  amortize = true;
  periods: RcPeriods = RC_FULL_RATE;
  /** workgroups per upper-cascade probe (occupancy only — the same output bits for any count, verified by capture hash; index = level, entry 0 unused). c3's 80
   *  probes × 64 threads is about one thread per lane of an M4 Max looping 16×, so the pass was latency-bound: c3 0.79 → 0.39 (4 chunks) → 0.26 ms (8; 16 no
   *  better), c2 0.53 → 0.39 (2; 4 no better), c1 already runs one item per thread — Σ 1.77 → 1.05 ms (docs/internal/p0a-cascades.md §6). engine.settings.rcChunks
   *  is the source of truth (default [1,1,2,8]); all 1 = the original one-workgroup-per-probe dispatch. */
  chunks: readonly number[] = [1, 1, 1, 1];
  /** whole-level bakes still owed (counts down once every level has run whole); `historyFree` = the next dice bake blends nothing in (set by invalidateWorld — a
   *  freshly CONSTRUCTED cache keeps the configured blend from its first bake, exactly as before, so a boot renders the same bits with the schedule on or off;
   *  engine.rebuildRc re-primes the cache it builds, since that one replaces a live picture) */
  private prime = PRIME_FRAMES; private historyFree = false; private primeSeen: boolean[] = []; private boost = 0;
  private schedData = new ArrayBuffer(16); private schedU = new Uint32Array(this.schedData); private schedF = new Float32Array(this.schedData);
  /** what ran last frame, for the panel / probes: per level 'whole' | `1/${period}` | 'rest' */
  lastSchedule: string[] = [];

  /** `deferPipelines`: leave the three kernels to init() (the engine's boot instance — compiled off the GPU process's main thread and awaited before the first frame); false = built
   *  here synchronously as ever (engine.rebuildRc / prewarmRc at run time: the module is the boot instance's source, so the implementation's pipeline cache answers those at once) */
  constructor(private device: GPUDevice, sceneLayout: GPUBindGroupLayout, cfg: RcConfig, deferPipelines = false) {
    this.cfg = cfg;
    const mod = this.mod = makeShader(device, scenePrelude() + lightingCommon + rcSrc, 'rc');
    const layoutTrace = device.createBindGroupLayout({ label: 'rcTrace', entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ] });
    const layoutDice = device.createBindGroupLayout({ label: 'rcDice', entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '3d' } },   // last frame's dice (EMA source)
      { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 5, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '3d' } },
      { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
    ] });
    const plTrace = this.plTrace = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, layoutTrace] });
    const plDice = this.plDice = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, layoutDice] });
    cutSwap.add(this);   // (CUT BOXES: a late instance — a rebuilt or prewarmed grid — builds its second set at once and follows the frame's choice)
    if (!deferPipelines) {
      this.pipeUpper = device.createComputePipeline({ label: 'rcUpper', layout: plTrace, compute: { module: mod, entryPoint: 'rcUpper' } });
      this.pipeC0 = device.createComputePipeline({ label: 'rcC0', layout: plTrace, compute: { module: mod, entryPoint: 'rcC0' } });
      this.pipeDice = device.createComputePipeline({ label: 'rcDice', layout: plDice, compute: { module: mod, entryPoint: 'rcDice' } });
    }

    // buffers
    const N = cfg.cascades; let bytes = 0; let intervals = 0;
    for (let n = 0; n < N; n++) {
      const d: [number, number, number] = [Math.ceil(cfg.nx / (1 << n)), cfg.ny, Math.ceil(cfg.nz / (1 << n))];
      this.dims.push(d);
      const probes = d[0] * d[1] * d[2]; const Dn = cfg.d0 << n;
      const texels = n === 0 ? probes * Dn * Dn : probes * (Dn / 2) * (Dn / 2);
      intervals += probes * Dn * Dn;
      const size = texels * 8; bytes += size;
      this.bufs.push(makeBuffer(device, size, GPUBufferUsage.STORAGE, `rcCascade${n}`));
    }
    this.stats = { intervals, bytes };
    this.dice = device.createTexture({ label: 'rcDice', size: [cfg.nx, cfg.ny * 7, cfg.nz], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC });
    this.diceView = this.dice.createView();
    // previous frame's dice: the bake blends toward it (short EMA) so per-frame direction jitter does not shimmer the bounce / light meter / smoke ambient
    this.dicePrev = device.createTexture({ label: 'rcDicePrev', size: [cfg.nx, cfg.ny * 7, cfg.nz], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.dicePrevView = this.dicePrev.createView();
    // solid angles
    const om = octSolidAngles(cfg.d0); const omData = new Float32Array(64); for (let i = 0; i < Math.min(16, om.length); i++) omData[i * 4] = om[i];
    this.dirOmegaBuf = makeBuffer(device, 256, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'dirOmega');
    device.queue.writeBuffer(this.dirOmegaBuf, 0, omData);
    // params (256-B slots)
    this.paramsBuf = makeBuffer(device, PARAM_STRIDE * N, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'rcParams');
    this.writeParams();
    const dummy = this.dummyParent = makeBuffer(device, 16, GPUBufferUsage.STORAGE, 'rcDummyParent');
    for (let n = 0; n < N; n++) {
      this.bgTrace.push(device.createBindGroup({ layout: layoutTrace, entries: [
        { binding: 0, resource: { buffer: this.paramsBuf, offset: PARAM_STRIDE * n, size: PARAM_BYTES } },
        { binding: 1, resource: { buffer: this.bufs[n] } },
        { binding: 2, resource: { buffer: n + 1 < N ? this.bufs[n + 1] : dummy } },
        { binding: 3, resource: this.diceView },
        { binding: 4, resource: { buffer: this.dirOmegaBuf } },
      ] }));
    }
    this.bgDice = device.createBindGroup({ layout: layoutDice, entries: [
      { binding: 0, resource: { buffer: this.paramsBuf, offset: 0, size: PARAM_BYTES } },
      { binding: 3, resource: this.dicePrevView },
      { binding: 4, resource: { buffer: this.dirOmegaBuf } },
      { binding: 5, resource: this.diceView },
      { binding: 6, resource: { buffer: this.bufs[0] } },
    ] });
  }

  private mod: GPUShaderModule; private plTrace: GPUPipelineLayout; private plDice: GPUPipelineLayout;
  /** the three kernels of a `deferPipelines` instance, compiled off the GPU process's main thread (gpu/device.ts computePipelineAsync) — Engine.init awaits it; a no-op once they exist */
  async init(): Promise<void> {
    if (this.pipeUpper && this.pipeC0 && this.pipeDice) return;
    const d = this.device, mod = this.mod;
    [this.pipeUpper, this.pipeC0, this.pipeDice] = await Promise.all([
      computePipelineAsync(d, { label: 'rcUpper', layout: this.plTrace, compute: { module: mod, entryPoint: 'rcUpper' } }),
      computePipelineAsync(d, { label: 'rcC0', layout: this.plTrace, compute: { module: mod, entryPoint: 'rcC0' } }),
      computePipelineAsync(d, { label: 'rcDice', layout: this.plDice, compute: { module: mod, entryPoint: 'rcDice' } }) ]);
  }
  // ---- CUT BOXES — a calm room pays nothing (render/cutSwap.ts): this instance's three kernels a second time, behind the cut prelude
  private cutSet = new ProgramSet();
  async buildCut(): Promise<void> {
    const d = this.device; const mod = makeShader(d, scenePrelude(true) + lightingCommon + rcSrc, 'rcCut');
    const [pipeUpper, pipeC0, pipeDice] = await Promise.all([
      computePipelineAsync(d, { label: 'rcUpperCut', layout: this.plTrace, compute: { module: mod, entryPoint: 'rcUpper' } }),
      computePipelineAsync(d, { label: 'rcC0Cut', layout: this.plTrace, compute: { module: mod, entryPoint: 'rcC0' } }),
      computePipelineAsync(d, { label: 'rcDiceCut', layout: this.plDice, compute: { module: mod, entryPoint: 'rcDice' } }) ]);
    this.cutSet.set(this, { pipeUpper, pipeC0, pipeDice });
  }
  useCut(on: boolean) { this.cutSet.use(this, on); }
  /** Dev / measurement hook (tools/qa/trace-lab.js via main.ts __hotCommon): rebuild the three kernels from the CURRENT scene prelude (an edited common.wgsl / traversal variant under
   *  test) + rc.wgsl as bundled — the trace kernels are common.wgsl's biggest customer after the direct pass. All three or none: the old pipelines stay if the module has an error. */
  async hotSwap(src: string = rcSrc): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const d = this.device; const pre = scenePrelude() + lightingCommon; const off = pre.split('\n').length - 1;
    const mod = d.createShaderModule({ code: pre + src, label: 'rc-hot' });
    const info = await mod.getCompilationInfo();
    const messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    [this.pipeUpper, this.pipeC0, this.pipeDice] = await Promise.all([
      d.createComputePipelineAsync({ label: 'rcUpper-hot', layout: this.plTrace, compute: { module: mod, entryPoint: 'rcUpper' } }),
      d.createComputePipelineAsync({ label: 'rcC0-hot', layout: this.plTrace, compute: { module: mod, entryPoint: 'rcC0' } }),
      d.createComputePipelineAsync({ label: 'rcDice-hot', layout: this.plDice, compute: { module: mod, entryPoint: 'rcDice' } }) ]);
    this.mod = mod;
    return { ok: true, messages };
  }

  intervalStart(n: number) { return this.cfg.interval0 * (Math.pow(4, n) - 1) / 3; }

  writeParams() {
    const { cfg } = this; const N = cfg.cascades;
    const data = new ArrayBuffer(PARAM_STRIDE * N);
    for (let n = 0; n < N; n++) {
      const u = new Uint32Array(data, PARAM_STRIDE * n, 24), f = new Float32Array(data, PARAM_STRIDE * n, 24);
      const d = this.dims[n]; const Dn = cfg.d0 << n;
      const sp = [WORLD.rcSize[0] / d[0], WORLD.rcSize[1] / d[1], WORLD.rcSize[2] / d[2]];
      u[0] = n; u[1] = Dn; u[2] = n === 0 ? Dn : Dn / 2; u[3] = d[0] * d[1] * d[2];
      u[4] = d[0]; u[5] = d[1]; u[6] = d[2]; u[7] = n + 1 < N ? 1 : 0;
      f[8] = sp[0]; f[9] = sp[1]; f[10] = sp[2]; f[11] = this.intervalStart(n);
      const pd = n + 1 < N ? this.dims[n + 1] : d;
      u[12] = pd[0]; u[13] = pd[1]; u[14] = pd[2]; f[15] = this.intervalStart(n + 1) - this.intervalStart(n);
      f[16] = WORLD.rcSize[0] / pd[0]; f[17] = WORLD.rcSize[1] / pd[1]; f[18] = WORLD.rcSize[2] / pd[2]; f[19] = this.diceBlend;
      u[20] = 0; u[21] = 1; f[22] = this.diceBlend; u[23] = 1;   // sched: whole level, configured blend, one chunk — until encode() writes this frame's
    }
    this.device.queue.writeBuffer(this.paramsBuf, 0, data);
  }

  setInterval0(v: number) { if (v !== this.cfg.interval0) { this.cfg.interval0 = v; this.writeParams(); } }
  /** engine.render mirrors settings.rcPeriods through this every frame (a no-op unless the array's contents changed) */
  setPeriods(p: RcPeriods) { if (p.length !== this.periods.length || p.some((v, i) => v !== this.periods[i])) this.periods = p.map(v => Math.max(1, Math.floor(v) || 1)); }
  setChunks(c: readonly number[]) { if (c.length !== this.chunks.length || c.some((v, i) => v !== this.chunks[i])) this.chunks = c.map(v => Math.max(1, Math.min(16, Math.floor(v) || 1))); }
  /** The refresh period level n runs at right now (1 = whole level this frame): the schedule only skips work once the cache is primed and only under `amortize`. */
  periodOf(n: number): number { if (!this.amortize || this.prime > 0 || n < 1) return 1; const p = this.periods; return p.length ? (p[Math.min(n, p.length - 1)] || 1) : 1; }
  private chunksOf(n: number): number { const c = this.chunks; return n >= 1 && c.length ? (c[Math.min(n, c.length - 1)] || 1) : 1; }
  /** WORLD invalidation: something changed the level itself (geometry / the light rig wholesale, a rebuilt probe grid), not the screen. Re-prime: whole-level
   *  bakes for the next PRIME_FRAMES so no stale or never-traced probe is read under the schedule, and — under `amortize` — a history-free next dice bake, so
   *  the bounce snaps to the new world instead of crawling there through the 0.3 EMA (from black, for a rebuilt cache: the dark dip a medium↔low ladder step
   *  used to show). Screen-side events (resize, resolution scale, checkerboard / divisor flips — passes.invalidate / passes.resize) must NOT call this: the
   *  cache is world-space and stays valid through all of them. */
  invalidateWorld() { this.prime = Math.max(PRIME_FRAMES, BOOST_BAKES + 1); this.historyFree = true; this.primeSeen.fill(false); this.boost = BOOST_BAKES; }   // (prime ≥ boost + 1: encode's identical-sched-bytes argument)
  get priming(): boolean { return this.prime > 0; }

  private writeSched(n: number, phase: number, period: number, blend: number, chunks: number) {
    this.schedU[0] = phase; this.schedU[1] = period; this.schedF[2] = blend; this.schedU[3] = chunks;
    this.device.queue.writeBuffer(this.paramsBuf, PARAM_STRIDE * n + SCHED_OFFSET, this.schedData);
  }

  encode(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, timer: GpuTimer, frameIdx: number) {
    // A re-primed cache (invalidateWorld: a rebuilt / prewarmed grid going live, the light rig swapped) under `amortize` first takes BOOST_BAKES extra WHOLE, history-free,
    // untimed bakes in this same command buffer — one bounce order each (see BOOST_BAKES) — then the frame's own, so the field everything downstream reads this frame
    // (gather, light meter, smoke ambient) is the converged one, not a quarter short. The extra bakes ignore half rate / stagger and leave historyFree up for the frame's
    // own bake to consume. Every rc pass of ONE command buffer sees the sched bytes written LAST for its level (queue.writeBuffer lands before the submit): identical here
    // by construction — blend 1.0 for c0 throughout, and prime ≥ BOOST_BAKES + 1 keeps every upper level at period 1 / phase 0 through the frame's own bake.
    if (this.amortize && this.historyFree) for (; this.boost > 0; this.boost--) this.bake(enc, sceneBG, null, frameIdx);
    this.boost = 0;
    this.bake(enc, sceneBG, timer, frameIdx);
  }
  /** One round of the cascades: uppers coarse → fine, c0, the dice bake. `timer` null = a FORCED round (the boost above): every level whole whatever half rate / stagger say,
   *  no timestamps, historyFree left standing, lastSchedule untouched. */
  private bake(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, timer: GpuTimer | null, frameIdx: number) {
    const N = this.cfg.cascades, forced = !timer;
    // half rate: uppers on even frames, c0 + bake on odd; a resting level declares itself idle to the timer (an honest 0 that frame — NOT an empty timed
    // pass: an empty pass never writes its timestamps and the slot's stale ticks read as a phantom cost, docs/internal/p0a-cascades.md §4)
    const doUpper = forced || !this.halfRate || (frameIdx & 1) === 0, doC0 = forced || !this.halfRate || (frameIdx & 1) === 1;
    const staggerClock = this.halfRate ? (frameIdx >> 1) : frameIdx;
    const sched: string[] = new Array(N).fill('rest'); const seen = this.primeSeen; if (seen.length !== N) { seen.length = N; seen.fill(false); }
    for (let n = N - 1; n >= 1; n--) {
      const staggered = !forced && this.staggerUpper && n >= 2;
      if ((staggered && ((staggerClock + n) & 1) === 1) || !doUpper) { timer?.idle(`rc c${n}`); continue; }   // resting this frame (stagger / half rate): an honest zero
      const period = this.periodOf(n), chunks = this.chunksOf(n);
      // the level's own clock: it advances once per frame this level actually runs (every frame; every other under half rate; every fourth for c2+ with the
      // stagger on top), so the round-robin visits every phase whatever else is skipping frames — a pure function of frameIdx, so __resetClock captures repeat
      const clock = staggered ? (staggerClock >> 1) : staggerClock;
      const phase = period > 1 ? clock % period : 0;
      if (period === 1) seen[n] = true;
      this.writeSched(n, phase, period, this.diceBlend, chunks);
      const pass = enc.beginComputePass({ label: `rc c${n}`, timestampWrites: timer?.pass(`rc c${n}`) });
      pass.setPipeline(this.pipeUpper); pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, this.bgTrace[n]);
      const d = this.dims[n];
      if (period === 1 && chunks === 1) pass.dispatchWorkgroups(d[0], d[1], d[2]);                       // the original one-workgroup-per-probe grid
      else pass.dispatchWorkgroups(Math.ceil((d[0] * d[1] * d[2]) / period) * chunks, 1, 1);           // scheduled subset × chunks (rc.wgsl rcUpper)
      pass.end();
      sched[n] = period === 1 ? 'whole' : `1/${period}`;
    }
    if (!doC0) { timer?.idle('rc c0'); timer?.idle('rc dice'); this.lastSchedule = sched; return; }
    // the dice bake's blend this frame: history-free once after invalidateWorld() under `amortize` (nothing true to blend toward); otherwise — and always with the
    // schedule off — the configured blend, from the very first bake, exactly as it always was
    const blend = this.amortize && this.historyFree ? 1.0 : this.diceBlend;
    this.writeSched(0, 0, 1, blend, 1);
    {
      const pass = enc.beginComputePass({ label: 'rc c0', timestampWrites: timer?.pass('rc c0') });
      pass.setPipeline(this.pipeC0); pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, this.bgTrace[0]);
      const d = this.dims[0]; const perWg = Math.floor(64 / (this.cfg.d0 * this.cfg.d0));
      pass.dispatchWorkgroups(Math.ceil(d[0] / perWg), d[1], d[2]);
      pass.end();
    }
    sched[0] = 'whole'; seen[0] = true;
    if (this.diceBlend < 1) enc.copyTextureToTexture({ texture: this.dice }, { texture: this.dicePrev }, [this.cfg.nx, this.cfg.ny * 7, this.cfg.nz]);   // history source for the EMA (skipped when history is off: blend 1 ignores it)
    {
      const pass = enc.beginComputePass({ label: 'rc dice', timestampWrites: timer?.pass('rc dice') });
      pass.setPipeline(this.pipeDice); pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, this.bgDice);
      const d = this.dims[0]; pass.dispatchWorkgroups(Math.ceil((d[0] * d[1] * d[2]) / 64));
      pass.end();
    }
    if (!forced) this.historyFree = false;
    if (this.prime > 0 && seen.every(Boolean)) { this.prime--; seen.fill(false); }   // every level has run whole (in one frame normally; over a pair / a quad under half rate / stagger): the whole cache is valid once more
    if (!forced) this.lastSchedule = sched;
  }

  setDiceBlend(v: number) { if (v !== this.diceBlend) { this.diceBlend = v; this.writeParams(); } }
  destroy() { cutSwap.remove(this); for (const b of this.bufs) b.destroy(); this.dice.destroy(); this.dicePrev.destroy(); this.paramsBuf.destroy(); this.dirOmegaBuf.destroy(); this.dummyParent?.destroy(); }
}
