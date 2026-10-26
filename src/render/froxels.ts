// FROXEL VOLUMETRICS — host side (renderer v3 Phase 2b; the kernels and the design note are shaders/froxel.wgsl, the grid ↔ world mapping is in common.wgsl).
// Owns the three W × H × D rgba16f haze volumes (raw / integrated — one texture, the raw estimate is dead once the temporal kernel has read it — and the accumulated
// history ping-pong), the two half-res ⌈W/2⌉ × ⌈H/2⌉ × D ones (the smoke's source radiance J, the transient lights' haze), the cluster texture (W/8 × H/8 × D/4
// rgba32uint light + smoke masks), the five pipelines and their bind groups; encodes cull → inject → injectJ → temporal → integrate into an open compute pass; hands the engine the numbers frame.froxelA/B/C carry (jitter,
// history weight), consumers the integrated volume's view, and the per-pixel smoke march (volumetrics.wgsl) the J view. The grid follows the preset (H, D, k — ui/quality.ts) and the WINDOW aspect (W = H × aspect, engine.ts): a change re-creates the volumes and restarts
// the history (a preset hop or a window reshape; the render scale never touches it — the grid is not per pixel). settings.froxelVol off = nothing here is
// dispatched or read (composite / particles / volumetrics.wgsl take their old paths under the frame flag) and, after a while off, the volumes are let go.
import { cutSwap, ProgramSet } from './cutSwap';
import { makeShader, computePipelineAsync, laterPipelineAsync, PIPE_QUEUE } from '../gpu/device';
const computePipelineAsyncNow = computePipelineAsync;
import { scenePrelude } from './frame';
import lightingCommon from './shaders/lighting_common.wgsl' with { type: 'text' };
import volCommon from './shaders/vol_common.wgsl' with { type: 'text' };
import froxelSrc from './shaders/froxel.wgsl' with { type: 'text' };

/** froxels per cluster edge in x / y, slices per cluster — froxel.wgsl FTILE / FCHUNK */
export const FROXEL_TILE = 8, FROXEL_CHUNK = 4;
export interface FroxelGrid { w: number; h: number; d: number }

const CS = () => GPUShaderStage.COMPUTE;
const halton = (i: number, b: number) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

export class Froxels {
  grid: FroxelGrid = { w: 0, h: 0, d: 0 };
  /** the raw estimate, then (same texture) the integrated volume consumers read; the accumulated history pair; the cluster masks */
  private vol: GPUTexture | null = null; private hist: GPUTexture[] = []; private clusters: GPUTexture | null = null; private smokeJ: GPUTexture | null = null; private trans: GPUTexture | null = null;
  private volV: GPUTextureView | null = null; private histV: GPUTextureView[] = []; private clustersV: GPUTextureView | null = null; private smokeJV: GPUTextureView | null = null; private transV: GPUTextureView | null = null;
  /** a 1×1×1 volume of (0, 0, 0, 1) — 'clear air' — consumers bind while no grid exists (their layouts always carry the binding) */
  readonly dummyView: GPUTextureView;
  /** parity p: temporal reads hist[1−p], writes hist[p]; integrate reads hist[p] */
  private parity = 0;
  /** does hist[1 − parity] hold last frame's accumulation on THIS grid? (false on the first frame of a grid / after a spell off: the engine sends history weight 0) */
  histValid = false;
  /** frames encoded on the current grid; frames since anything was encoded (the engine lets the volumes go after a long spell off) */
  age = 0; idle = 0;
  /** how many times the grid was (re)made, and what the last one was (the Tab panel words it) */
  remakes = 0; lastRemake = '';
  private lCull: GPUBindGroupLayout; private lInject: GPUBindGroupLayout; private lInjectJ: GPUBindGroupLayout; private lTemp: GPUBindGroupLayout; private lInteg: GPUBindGroupLayout;
  private pCull!: GPUComputePipeline; private pInject!: GPUComputePipeline; private pInjectJ!: GPUComputePipeline; private pTemp!: GPUComputePipeline; private pInteg!: GPUComputePipeline;
  private bgCull: GPUBindGroup | null = null; private bgInject: GPUBindGroup | null = null; private bgInjectJ: GPUBindGroup | null = null; private bgTemp: (GPUBindGroup | null)[] = [null, null]; private bgInteg: (GPUBindGroup | null)[] = [null, null];
  private bgDice: GPUTextureView | null = null;

  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout, private linSamp: GPUSampler) {
    const t3f: GPUTextureBindingLayout = { sampleType: 'float', viewDimension: '3d' };
    const t3u: GPUTextureBindingLayout = { sampleType: 'uint', viewDimension: '3d' };
    const s16: GPUStorageTextureBindingLayout = { access: 'write-only', format: 'rgba16float', viewDimension: '3d' };
    this.lCull = device.createBindGroupLayout({ label: 'froxelCull', entries: [{ binding: 0, visibility: CS(), storageTexture: { access: 'write-only', format: 'rgba32uint', viewDimension: '3d' } }] });
    this.lInject = device.createBindGroupLayout({ label: 'froxelInject', entries: [{ binding: 1, visibility: CS(), texture: t3u }, { binding: 2, visibility: CS(), storageTexture: s16 }] });
    this.lInjectJ = device.createBindGroupLayout({ label: 'froxelInjectJ', entries: [{ binding: 1, visibility: CS(), texture: t3u }, { binding: 6, visibility: CS(), texture: t3f }, { binding: 7, visibility: CS(), storageTexture: s16 }, { binding: 8, visibility: CS(), storageTexture: s16 }] });
    this.lTemp = device.createBindGroupLayout({ label: 'froxelTemporal', entries: [{ binding: 3, visibility: CS(), texture: t3f }, { binding: 4, visibility: CS(), texture: t3f }, { binding: 5, visibility: CS(), storageTexture: s16 }] });
    this.lInteg = device.createBindGroupLayout({ label: 'froxelIntegrate', entries: [{ binding: 2, visibility: CS(), storageTexture: s16 }, { binding: 4, visibility: CS(), texture: t3f }, { binding: 9, visibility: CS(), texture: t3f }] });
    this.mod = makeShader(device, Froxels.source(), 'froxel');   // (the five pipelines: init(), awaited by passes.ts before the first frame)
    const dummy = device.createTexture({ label: 'froxelDummy', size: [1, 1, 1], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: dummy }, new Uint16Array([0, 0, 0, 0x3c00]), { bytesPerRow: 8 }, [1, 1, 1]);   // (0, 0, 0, 1.0h)
    this.dummyView = dummy.createView();
  }
  /** the module source as compiled (prelude + lighting_common + vol_common + froxel.wgsl) — main.ts __hotFroxel recompiles a variant through hotSwap */
  static source(body: string = froxelSrc): string { return scenePrelude() + lightingCommon + volCommon + body; }
  private mod: GPUShaderModule;
  /** the five kernels off the boot module, compiled off the GPU process's main thread (gpu/device.ts computePipelineAsync) — passes.ts init awaits it. LATER (gpu/device.ts
   *  PIPE_QUEUE.later, 2026-10-26): the boot does not wait for them — only the medium, low and very low presets march the froxels, so the boot's set leaves them to the
   *  background lane and the engine keeps FrameFlags.FroxelVol down (the per-pixel march draws the haze and the smoke, as with the row off) until `ready`. `?pipelater=0` =
   *  the boot waits for them as it did. */
  async init(): Promise<void> {
    cutSwap.add(this);
    if (PIPE_QUEUE.later) { void this.buildPipelines(this.mod, true).then(() => { this.ready = true; }); return; }
    await this.buildPipelines(this.mod); this.ready = true;
  }
  /** the five kernels are in (the engine raises FrameFlags.FroxelVol only then) */
  ready = false;
  // ---- CUT BOXES — a calm room pays nothing (render/cutSwap.ts): the two kernels that trace (inject, injectJ) a second time, behind the cut prelude
  private cutSet = new ProgramSet();
  async buildCut(): Promise<void> {
    const d = this.device; const lay = (l: GPUBindGroupLayout) => d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, l] });
    const mod = makeShader(d, scenePrelude(true) + lightingCommon + volCommon + froxelSrc, 'froxelCut');
    const [pInject, pInjectJ] = await Promise.all([
      computePipelineAsync(d, { label: 'froxelInjectCut', layout: lay(this.lInject), compute: { module: mod, entryPoint: 'inject' } }),
      computePipelineAsync(d, { label: 'froxelInjectJCut', layout: lay(this.lInjectJ), compute: { module: mod, entryPoint: 'injectJ' } }) ]);
    this.cutSet.set(this, { pInject, pInjectJ });
  }
  useCut(on: boolean) { this.cutSet.use(this, on); }
  private async buildPipelines(mod: GPUShaderModule, later = false): Promise<void> {
    const d = this.device; const lay = (l: GPUBindGroupLayout) => d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, l] });
    const computePipelineAsync = later ? laterPipelineAsync : computePipelineAsyncNow;
    const ps = await Promise.all([
      computePipelineAsync(d, { label: 'froxelCull', layout: lay(this.lCull), compute: { module: mod, entryPoint: 'cull' } }),
      computePipelineAsync(d, { label: 'froxelInject', layout: lay(this.lInject), compute: { module: mod, entryPoint: 'inject' } }),
      computePipelineAsync(d, { label: 'froxelInjectJ', layout: lay(this.lInjectJ), compute: { module: mod, entryPoint: 'injectJ' } }),
      computePipelineAsync(d, { label: 'froxelTemporal', layout: lay(this.lTemp), compute: { module: mod, entryPoint: 'temporal' } }),
      computePipelineAsync(d, { label: 'froxelIntegrate', layout: lay(this.lInteg), compute: { module: mod, entryPoint: 'integrate' } }) ]);
    const [pCull, pInject, pInjectJ, pTemp, pInteg] = ps;
    if (later) this.cutSet.patch(this, { pCull, pInject, pInjectJ, pTemp, pInteg }, null);   // (a LATER set lands through the cut set's patch: a live cut set keeps its two twins and gets these back when it goes)
    else { this.pCull = pCull; this.pInject = pInject; this.pInjectJ = pInjectJ; this.pTemp = pTemp; this.pInteg = pInteg; }
  }
  /** Dev / measurement hook (main.ts __hotFroxel): rebuild the five pipelines from a froxel.wgsl variant; the old ones stay on a compile error. */
  async hotSwap(body: string): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const mod = this.device.createShaderModule({ code: Froxels.source(body), label: 'froxel-hot' });
    const info = await mod.getCompilationInfo();
    const messages = info.messages.map(m => `${m.type} ${m.lineNum}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    await this.buildPipelines(mod); this.bgCull = this.bgInject = this.bgInjectJ = null; this.bgTemp = [null, null]; this.bgInteg = [null, null];
    return { ok: true, messages };
  }

  /** the integrated volume consumers sample (composite binding 11, the particles' splat) — the dummy while no grid exists */
  get view(): GPUTextureView { return this.volV ?? this.dummyView; }
  /** the smoke's source-radiance volume J the per-pixel smoke march samples (volumetrics.wgsl binding 4) — the dummy while no grid exists */
  get smokeJView(): GPUTextureView { return this.smokeJV ?? this.dummyView; }
  get allocated(): boolean { return !!this.vol; }
  /** bytes held by the volumes + clusters (0 while none exist) */
  get bytes(): number { const g = this.grid; if (!this.vol) return 0; const cl = this.clusterDims(), jd = this.jDims(); return g.w * g.h * g.d * 8 * 3 + jd[0] * jd[1] * jd[2] * 8 * 2 + cl[0] * cl[1] * cl[2] * 16; }
  clusterDims(): [number, number, number] { const g = this.grid; return [Math.ceil(g.w / FROXEL_TILE), Math.ceil(g.h / FROXEL_TILE), Math.ceil(g.d / FROXEL_CHUNK)]; }
  /** the smoke source-radiance volume J: half the froxel grid across (the smoke's light field is smooth), the same slices */
  jDims(): [number, number, number] { const g = this.grid; return [Math.ceil(g.w / 2), Math.ceil(g.h / 2), g.d]; }

  /** Make the grid W × H × D (no-op if it already is). Returns true when the volumes were (re)made — consumers' bind groups naming `view` must then be rebuilt. */
  configure(w: number, h: number, d: number, why = ''): boolean {
    w = Math.max(FROXEL_TILE, Math.round(w)); h = Math.max(FROXEL_TILE, Math.round(h)); d = Math.max(FROXEL_CHUNK, Math.round(d));
    if (this.vol && Math.abs(w - this.grid.w) <= 1 && h === this.grid.h && d === this.grid.d) return false;   // (a column more or less across is the aspect rounding, not a new grid: keep the volumes and their history)
    this.release();
    this.grid = { w, h, d };
    const dev = this.device; const usage = GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC;
    const mk = (label: string, size: [number, number, number], format: GPUTextureFormat) => dev.createTexture({ label, size, dimension: '3d', format, usage });
    this.vol = mk('froxelVol', [w, h, d], 'rgba16float'); this.volV = this.vol.createView();
    this.hist = [0, 1].map(i => mk(`froxelHist${i}`, [w, h, d], 'rgba16float')); this.histV = this.hist.map(t => t.createView());
    this.smokeJ = mk('froxelSmokeJ', this.jDims(), 'rgba16float'); this.smokeJV = this.smokeJ.createView();
    this.trans = mk('froxelTransient', this.jDims(), 'rgba16float'); this.transV = this.trans.createView();   // the transient lights' haze, same half-res grid (froxel.wgsl injectJ / integrate)
    this.clusters = mk('froxelClusters', this.clusterDims(), 'rgba32uint'); this.clustersV = this.clusters.createView();
    this.bgCull = this.bgInject = this.bgInjectJ = null; this.bgTemp = [null, null]; this.bgInteg = [null, null];
    this.histValid = false; this.age = 0; this.parity = 0;
    this.remakes++; this.lastRemake = `${w}×${h}×${d}${why ? ` (${why})` : ''}: ${(this.bytes / 1048576).toFixed(1)} MB`;
    return true;
  }
  /** Let the volumes go (the setting has been off a while, or a new grid replaces them). `view` falls back to the dummy — rebuild consumers' bind groups. */
  release(): void {
    for (const t of [this.vol, ...this.hist, this.clusters, this.smokeJ, this.trans]) t?.destroy();
    this.vol = null; this.volV = null; this.hist = []; this.histV = []; this.clusters = null; this.clustersV = null; this.smokeJ = null; this.smokeJV = null; this.trans = null; this.transV = null;
    this.bgCull = this.bgInject = this.bgInjectJ = null; this.bgTemp = [null, null]; this.bgInteg = [null, null];
    this.histValid = false; this.age = 0; this.grid = { w: 0, h: 0, d: 0 };
  }

  /** this frame's sample jitter inside every froxel (Halton 2, 3, 5 — the kernels scramble it per froxel) */
  jitter(frameIdx: number): [number, number, number] { const i = (frameIdx % 1021) + 1; return [halton(i, 2), halton(i, 3), halton(i, 5)]; }
  /** the history weight to send this frame: the setting while last frame's accumulation exists on this grid, else 0 */
  historyWeight(setting: number): number { return this.histValid && setting > 0 ? Math.min(0.98, setting) : 0; }

  private ensureBindGroups(diceView: GPUTextureView) {
    if (this.bgCull && this.bgDice === diceView) return;
    const d = this.device; this.bgDice = diceView;
    this.bgCull = d.createBindGroup({ layout: this.lCull, entries: [{ binding: 0, resource: this.clustersV! }] });
    this.bgInject = d.createBindGroup({ layout: this.lInject, entries: [{ binding: 1, resource: this.clustersV! }, { binding: 2, resource: this.volV! }] });
    this.bgInjectJ = d.createBindGroup({ layout: this.lInjectJ, entries: [{ binding: 1, resource: this.clustersV! }, { binding: 6, resource: diceView }, { binding: 7, resource: this.smokeJV! }, { binding: 8, resource: this.transV! }] });
    for (let p = 0; p < 2; p++) {
      this.bgTemp[p] = d.createBindGroup({ layout: this.lTemp, entries: [{ binding: 3, resource: this.volV! }, { binding: 4, resource: this.histV[1 - p] }, { binding: 5, resource: this.histV[p] }] });
      this.bgInteg[p] = d.createBindGroup({ layout: this.lInteg, entries: [{ binding: 2, resource: this.volV! }, { binding: 4, resource: this.histV[p] }, { binding: 9, resource: this.transV! }] });
    }
  }
  /** The five kernels into an open compute pass (the caller times it). `between` is called before each stage with its name — a caller that wants per-stage timings ends the pass
   *  and opens another there (passes.ts froxelSplitTiming); the default caller ignores it. No-op without a grid. */
  encode(p: GPUComputePassEncoder, sceneBG: GPUBindGroup, diceView: GPUTextureView, between?: (stage: 'inject' | 'temporal' | 'integrate') => GPUComputePassEncoder): void {
    if (!this.vol) return;
    this.ensureBindGroups(diceView);
    const g = this.grid; const cl = this.clusterDims();
    let pass = p;
    pass.setBindGroup(0, sceneBG);
    pass.setPipeline(this.pCull); pass.setBindGroup(1, this.bgCull!); pass.dispatchWorkgroups(Math.ceil(cl[0] / 4), Math.ceil(cl[1] / 4), Math.ceil(cl[2] / 4));
    if (between) { pass = between('inject'); pass.setBindGroup(0, sceneBG); }
    pass.setPipeline(this.pInject); pass.setBindGroup(1, this.bgInject!); pass.dispatchWorkgroups(Math.ceil(g.w / 8), Math.ceil(g.h / 8), g.d);
    { const jd = this.jDims(); pass.setPipeline(this.pInjectJ); pass.setBindGroup(1, this.bgInjectJ!); pass.dispatchWorkgroups(Math.ceil(jd[0] / 8), Math.ceil(jd[1] / 8), jd[2]); }   // the smoke's light field (independent of the haze inject: the GPU may overlap them)
    if (between) { pass = between('temporal'); pass.setBindGroup(0, sceneBG); }
    this.parity ^= 1; const par = this.parity;
    pass.setPipeline(this.pTemp); pass.setBindGroup(1, this.bgTemp[par]!); pass.dispatchWorkgroups(Math.ceil(g.w / 8), Math.ceil(g.h / 8), g.d);
    if (between) { pass = between('integrate'); pass.setBindGroup(0, sceneBG); }
    pass.setPipeline(this.pInteg); pass.setBindGroup(1, this.bgInteg[par]!); pass.dispatchWorkgroups(Math.ceil(g.w / 8), Math.ceil(g.h / 8));
    this.histValid = true; this.age++; this.idle = 0;
  }
  /** Explicit history restart (a camera cut, the panel's button): the next frame accumulates from its own estimate. */
  restartHistory(): void { this.histValid = false; }
}
