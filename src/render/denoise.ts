// The v3 denoiser (renderer v3 phase 3): ONE core — reprojection with motion vectors + per-tap depth validation, moments → variance, history length,
// neighbourhood clamp, variance-guided edge-stopped à-trous — behind THREE clients (shadow ratio per emitter class at full res; the gather's diffuse
// irradiance and its specular field at gather res). The WGSL is shaders/denoise.wgsl (one module, five entry points); this file owns its pipelines,
// layouts, the small parameter uniform and a bind-group cache, and encodes a client's chain into an open compute pass with the texture views
// render/passes.ts hands it (passes.ts owns every texture: they go through its pool / resample-on-resize machinery like the legacy histories).
// settings.denoiser = 'legacy' never constructs a dispatch from here: passes.ts runs dtemporal / softblur / temporal / giblur exactly as before.
import { makeBuffer, makeShader, computePipelineAsync } from '../gpu/device';
import { scenePrelude } from './frame';
import denoiseSrc from './shaders/denoise.wgsl' with { type: 'text' };

const CS = GPUShaderStage.COMPUTE;
/** à-trous strides by iteration (1-based i → STRIDES[i-1]); the shadow chain's total travel after N iterations = Σ = 2^N − 1 px */
export const DN_STRIDES = [1, 2, 4, 8, 16];
export const dnTravel = (iters: number) => DN_STRIDES.slice(0, Math.max(1, Math.min(5, Math.round(iters)))).reduce((a, b) => a + b, 0);

/** Every knob of the three clients (engine settings dn* mirror into this each frame; ui/quality.ts presets place the per-tier ones). */
export interface DenoiseKnobs {
  /** SHADOW: à-trous iterations (1‥5), history cap in frames (0 = no temporal reuse), clamp box half-width in σ, luminance edge-stop scale, hint prior (softblur's
   *  PCSS reach) on, lit-alike tap weight on */
  shIters: number; shCap: number; shClampK: number; shSigmaL: number; shPrior: boolean; shLitAlike: boolean;
  /** SHADOW light-motion cue: a class whose exact unshadowed luminance at the pixel changed by more than shMoveThresh (relative, per frame) accumulates over at most shMoveCap frames (0 = cue off);
   *  a change past shJump within ONE frame (a switch, a fluorescent's dropout stroke, a lightning stroke: measured against the luminance the pixel believes reaches it — ReSTIR's U.a — else the larger of the two) takes that class's value from the frame alone and carries its
   *  sample variance across the step (denoise.wgsl shTemporal 'jump'; 0 = off) */
  shMoveCap: number; shMoveThresh: number; shJump: number;
  /** DIFFUSE GI: iterations, cap, clamp k, σ_l, fast-history cap (frames; 0 = clamp round the raw neighbourhood mean), firefly bound (incoming ≤ mean + z·σ of its 5×5; 0 = off);
   *  GI in motion (docs/internal/gi-motion.md §D, both 0 = off): giClampCut = history length cut by how far the clamp dragged it, giYoungWiden = à-trous σ allowance on young texels */
  giIters: number; giCap: number; giClampK: number; giSigmaL: number; giFast: number; giFirefly: number; giClampCut: number; giYoungWiden: number;
  /** SPECULAR: iterations, cap, clamp k, σ_l, roughness stand-in for the gather-res chain (0 mirror ‥ 1), virtual-hit share override (< 0 = from roughness), the reflection chain's roughness cutoff
   *  (its per-pixel mode: settings.rtMaxRough) and iterations (the reflection chain may run more than the gather-res one: presets) */
  spIters: number; spCap: number; spClampK: number; spSigmaL: number; spRough: number; spVirtual: number; spMaxRough: number; rfIters: number; rfCap: number;
  /** shared geometry edge-stopping: plane-distance scale (÷ z), normal power; motion vectors on; the ratio clamp's upper bound (1, or 4 with the chroma-exact tail / ReSTIR hues) */
  depthK: number; normalPow: number; motionVectors: boolean; ratioHi: number;
}
export const defaultDenoiseKnobs = (): DenoiseKnobs => ({
  shIters: 3, shCap: 12, shClampK: 1.25, shSigmaL: 4, shPrior: true, shLitAlike: true, shMoveCap: 3, shMoveThresh: 0.04, shJump: 0.5,
  giIters: 4, giCap: 24, giClampK: 1.0, giSigmaL: 4, giFast: 3, giFirefly: 0, giClampCut: 0, giYoungWiden: 0,
  spIters: 1, spCap: 16, spClampK: 1.0, spSigmaL: 2, spRough: 0.08, spVirtual: -1, spMaxRough: 0.45, rfIters: 3, rfCap: 32,
  depthK: 0.004, normalPow: 12, motionVectors: true, ratioHi: 1,
});

/** What one shadow-chain encode needs (views named by role; passes.ts decides which of its textures play them this frame). */
export interface ShadowViews {
  depth: GPUTextureView; normal: GPUTextureView; vel: GPUTextureView;
  S: GPUTextureView[]; U: GPUTextureView[];                 // per class: the direct pass's raw S (+hint) and U — S is also where the FINAL iteration writes
  cur: GPUTextureView[];                                     // per class: pack's (ratio, hint) — and a ping-pong buffer once the temporal pass has read it
  shared: GPUTextureView[];                                  // [0], [1]: (hint0, hint1, lumU0, lumU1) ping-pong
  hvIn: GPUTextureView[]; hvOut: GPUTextureView[];           // per class: last frame's / this frame's accumulated (ratio, var)
  hmIn: GPUTextureView; hmOut: GPUTextureView;               // moments both classes
  hgIn: GPUTextureView; hgOut: GPUTextureView;               // r32uint depth | history length
  tileFlag: GPUTextureView; tileMask: GPUTextureView;        // the softtile pair (pack writes the flags; passes.ts runs tileDistances; the à-trous reads the mask)
}
export interface RadianceViews {
  depth: GPUTextureView; normal: GPUTextureView; vel: GPUTextureView;
  mat: GPUTextureView;                                       // the g-buffer's material target (roughness per pixel — read by the specular client in per-pixel mode; bound regardless)
  cur: GPUTextureView;                                       // the raw estimate (indirect | spec | the reflection pass's radiance + hitT)
  histIn: GPUTextureView; histOut: GPUTextureView; momIn: GPUTextureView; momOut: GPUTextureView;
  fastIn: GPUTextureView; fastOut: GPUTextureView;           // diffuse: its fast history; specular: the smoothed hit distance (per-pixel mode) — a real ping-pong pair either way
  /** à-trous targets: chain[i] for iteration i+1's OUTPUT (the last = where composite reads); the first iteration reads histOut (+ momOut for its variance) */
  chain: GPUTextureView[];
}
/** The diffuse client at the INTERNAL resolution (settings.giFullRes; encodeRadiance's `full`): `curFull` = the guided upsample's output (giUpsample wrote it this frame — the value each pixel
 *  accumulates), while RadianceViews.cur stays the RAW gather (the apron's statistics); `strides` = the à-trous strides at internal res (gdiv × 1, 2, 4, 8: the gather-grid chain's ground reach);
 *  `rawDiv` = the raw gather's divisor (2 | 3) the internal-res kernels map pixels ↔ texels with */
export interface FullResGi { curFull: GPUTextureView; strides: number[]; rawDiv: number }

export class Denoiser {
  knobs: DenoiseKnobs = defaultDenoiseKnobs();
  private params: GPUBuffer; private paramData = new ArrayBuffer(128); private pf = new Float32Array(this.paramData); private pu = new Uint32Array(this.paramData);   // struct DnParams in denoise.wgsl: seven vec4 + gi3 = 128 B
  /** the REFLECTION chain's copy of the parameters: the same block with its own divisor (flags.y = the reflection target's) and the per-pixel roughness mode up (sp2.w = the cutoff) */
  private paramsRefl: GPUBuffer;
  /** the INTERNAL-RES diffuse chain's copy (settings.giFullRes): flags.y = 1 (its grid IS the internal one), gi2.w = the raw gather's divisor its kernels map pixels ↔ texels with (0 in the other two blocks) */
  private paramsFull: GPUBuffer;
  private nearSamp: GPUSampler;
  private lPack: GPUBindGroupLayout; private lShTemp: GPUBindGroupLayout; private lShAtrous: GPUBindGroupLayout; private lGiTemp: GPUBindGroupLayout; private lSpecTemp: GPUBindGroupLayout; private lRadAtrous: GPUBindGroupLayout;
  private lGiUp: GPUBindGroupLayout; private lGiTempF: GPUBindGroupLayout;
  private pPack!: GPUComputePipeline; private pShTemp!: GPUComputePipeline; private pGiTemp!: GPUComputePipeline; private pSpecTemp!: GPUComputePipeline;
  /** the internal-res diffuse client's two pipelines (giUpsample, giTemporalF) + its à-trous stride variants: made on FIRST use, asynchronously (prepareFull) — a tier that never turns it on compiles nothing */
  private pGiUp: GPUComputePipeline | null = null; private pGiTempF: GPUComputePipeline | null = null; private fullPending = false;
  private pShAtrous = new Map<string, GPUComputePipeline>(); private pRadAtrous = new Map<string, GPUComputePipeline>();
  private mod: GPUShaderModule; private layShAtrous: GPUPipelineLayout; private layRadAtrous: GPUPipelineLayout;
  /** bind groups by role key + the identities of the views in them; dropped wholesale when passes.ts re-makes its targets (dropBindGroups) */
  private bgs = new Map<string, GPUBindGroup>();
  /** how many dispatches the last frame's chains encoded (the Tab panel words it) */
  stats = { shadow: 0, gi: 0, spec: 0, refl: 0 };

  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout) {
    const d = device;
    this.params = makeBuffer(d, this.paramData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'dnParams');
    this.paramsRefl = makeBuffer(d, this.paramData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'dnParamsRefl');
    this.paramsFull = makeBuffer(d, this.paramData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'dnParamsFull');
    this.nearSamp = d.createSampler({ label: 'dnNearest', magFilter: 'nearest', minFilter: 'nearest' });
    const tex = (binding: number, sampleType: GPUTextureSampleType = 'unfilterable-float'): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, texture: { sampleType, viewDimension: '2d' } });
    const dep = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, texture: { sampleType: 'depth', viewDimension: '2d' } });
    const st16 = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } });
    const st32u = (binding: number): GPUBindGroupLayoutEntry => ({ binding, visibility: CS, storageTexture: { access: 'write-only', format: 'r32uint', viewDimension: '2d' } });
    const uni: GPUBindGroupLayoutEntry = { binding: 0, visibility: CS, buffer: { type: 'uniform' } };
    this.lPack = d.createBindGroupLayout({ label: 'dnPack', entries: [uni, tex(10), tex(11), tex(12), tex(13), st16(20), st16(21), st16(22), st32u(23)] });
    this.lShTemp = d.createBindGroupLayout({ label: 'dnShTemporal', entries: [uni, dep(1), tex(2, 'float'), tex(3, 'float'), { binding: 4, visibility: CS, sampler: { type: 'non-filtering' } },
      tex(30), tex(31), tex(32), tex(33, 'float'), tex(34, 'float'), tex(35, 'float'), tex(36, 'uint'), st16(40), st16(41), st16(42), st32u(43)] });
    this.lShAtrous = d.createBindGroupLayout({ label: 'dnShAtrous', entries: [uni, dep(1), tex(2, 'float'), tex(50), tex(51), tex(52), tex(53, 'uint'), tex(54), tex(55), tex(56), tex(57, 'uint'), st16(60), st16(61), st16(62)] });
    this.lGiTemp = d.createBindGroupLayout({ label: 'dnGiTemporal', entries: [uni, dep(1), tex(2, 'float'), tex(3, 'float'), tex(5, 'float'), tex(70), tex(71, 'float'), tex(72, 'float'), tex(73, 'float'), st16(80), st16(81), st16(82)] });
    this.lSpecTemp = this.lGiTemp;   // (the specular entry point binds the same set: its fast pair carries the smoothed hit distance)
    // the internal-res diffuse client: the guided upsample (raw gather + full-res guides → upOut) and its temporal step (giTemporal's set + the upsampled current @74)
    this.lGiUp = d.createBindGroupLayout({ label: 'dnGiUpsample', entries: [uni, dep(1), tex(2, 'float'), tex(70), st16(84)] });
    this.lGiTempF = d.createBindGroupLayout({ label: 'dnGiTemporalF', entries: [uni, dep(1), tex(2, 'float'), tex(3, 'float'), tex(5, 'float'), tex(70), tex(71, 'float'), tex(72, 'float'), tex(73, 'float'), tex(74), st16(80), st16(81), st16(82)] });
    this.lRadAtrous = d.createBindGroupLayout({ label: 'dnRadAtrous', entries: [uni, dep(1), tex(2, 'float'), tex(5, 'float'), tex(90), tex(91), tex(92, 'float'), st16(95)] });
    const lay = (l: GPUBindGroupLayout) => d.createPipelineLayout({ bindGroupLayouts: [sceneLayout, l] });
    this.layShAtrous = lay(this.lShAtrous); this.layRadAtrous = lay(this.lRadAtrous);
    this.layPack = lay(this.lPack); this.layShTemp = lay(this.lShTemp); this.layGiTemp = lay(this.lGiTemp); this.laySpecTemp = lay(this.lSpecTemp);
    this.layGiUp = lay(this.lGiUp); this.layGiTempF = lay(this.lGiTempF);
    this.mod = makeShader(d, scenePrelude() + denoiseSrc, 'denoise');
  }
  /** Every pipeline the constructor used to build, compiled off the GPU process's main thread (gpu/device.ts): the four fixed kernels and the à-trous variants most frames use —
   *  shadow strides 1‥16 mid + final, diffuse strides 1‥16 first/mid, the reflection chain's four (every variant a tier can ask for exists before the first frame: no pipeline
   *  creation inside a frame; a variant nobody prebuilt is still made lazily, synchronously, by shAtrous / radAtrous as before). passes.ts init awaits it. */
  async init(): Promise<void> {
    const jobs: Promise<unknown>[] = [this.buildFixed()];
    const sh = (stride: number, final: boolean, first: boolean) => jobs.push(this.shAtrousAsync(stride, final, first));
    const rad = (stride: number, first: boolean, spec: boolean) => jobs.push(this.radAtrousAsync(stride, first, spec));
    sh(1, false, true); sh(1, true, true);
    for (const s of [2, 4, 8, 16]) { sh(s, false, false); sh(s, true, false); }
    for (const s of [1, 2, 4, 8, 16]) rad(s, s === 1, false);
    rad(1, true, true); rad(2, false, true); rad(4, false, true); rad(8, false, true);
    await Promise.all(jobs);
  }
  private layPack: GPUPipelineLayout; private layShTemp: GPUPipelineLayout; private layGiTemp: GPUPipelineLayout; private laySpecTemp: GPUPipelineLayout;
  private layGiUp!: GPUPipelineLayout; private layGiTempF!: GPUPipelineLayout;
  /** The internal-res diffuse client wanted with these à-trous `strides`: true once its two pipelines AND every stride variant of THIS set (first + mid, diffuse) exist — created here on the first
   *  call that misses any, asynchronously (nothing compiles inside a frame's encode: passes.ts keeps the gather-grid chain until this says ready — a frame or two after first use, and again after
   *  a divisor / iteration change asks for strides it has not seen). A compile that FAILED is not retried every frame (fullFailed latches; a hot-swap clears it). */
  prepareFull(strides: number[]): boolean {
    let ready = !!this.pGiUp && !!this.pGiTempF;
    for (let i = 0; ready && i < strides.length; i++) if (!this.pRadAtrous.has(`${strides[i]}/${i === 0 ? 1 : 0}/0`)) ready = false;
    if (ready) return true;
    if (this.fullPending || this.fullFailed) return false;
    this.fullPending = true;
    const d = this.device, mod = this.mod; const jobs: Promise<unknown>[] = [];
    if (!this.pGiUp) jobs.push(d.createComputePipelineAsync({ label: 'dnGiUpsample', layout: this.layGiUp, compute: { module: mod, entryPoint: 'giUpsample' } }).then(p => { if (this.mod === mod) this.pGiUp = p; }));
    if (!this.pGiTempF) jobs.push(d.createComputePipelineAsync({ label: 'dnGiTemporalF', layout: this.layGiTempF, compute: { module: mod, entryPoint: 'giTemporalF', constants: { SPEC: 0 } } }).then(p => { if (this.mod === mod) this.pGiTempF = p; }));
    strides.forEach((s, i) => { const first = i === 0; const key = `${s}/${first ? 1 : 0}/0`; if (!this.pRadAtrous.has(key)) jobs.push(d.createComputePipelineAsync({ label: `dnRadAtrous${key}`, layout: this.layRadAtrous, compute: { module: mod, entryPoint: 'radAtrous', constants: { STRIDE: s, FIRST: first ? 1 : 0, SPEC: 0 } } }).then(p => { if (this.mod === mod) this.pRadAtrous.set(key, p); })); });
    Promise.all(jobs).then(() => { this.fullPending = false; }, (e) => { this.fullPending = false; this.fullFailed = true; console.warn('denoiser: the internal-res GI pipelines failed to compile — the gather-grid chain stays', e); });
    return false;
  }
  private fullFailed = false;
  private async buildFixed(mod: GPUShaderModule = this.mod): Promise<[GPUComputePipeline, GPUComputePipeline, GPUComputePipeline, GPUComputePipeline]> {
    const d = this.device;
    const four = await Promise.all([
      computePipelineAsync(d, { label: 'dnPack', layout: this.layPack, compute: { module: mod, entryPoint: 'shPack' } }),
      computePipelineAsync(d, { label: 'dnShTemporal', layout: this.layShTemp, compute: { module: mod, entryPoint: 'shTemporal' } }),
      computePipelineAsync(d, { label: 'dnGiTemporal', layout: this.layGiTemp, compute: { module: mod, entryPoint: 'giTemporal', constants: { SPEC: 0 } } }),
      computePipelineAsync(d, { label: 'dnSpecTemporal', layout: this.laySpecTemp, compute: { module: mod, entryPoint: 'specTemporal', constants: { SPEC: 1 } } }) ]);
    if (mod === this.mod) [this.pPack, this.pShTemp, this.pGiTemp, this.pSpecTemp] = four;   // (a hot swap builds off its new module first and installs everything in one step itself)
    return four;
  }
  /** the async twins of shAtrous / radAtrous for init(): the same descriptors into the same maps (a key already present, or in flight, is not made twice) */
  private pending = new Map<string, Promise<GPUComputePipeline>>();
  private shAtrousAsync(stride: number, final: boolean, first: boolean): Promise<GPUComputePipeline> {
    const key = `${stride}/${final ? 1 : 0}/${first ? 1 : 0}`; const have = this.pShAtrous.get(key); if (have) return Promise.resolve(have);
    let p = this.pending.get('S' + key);
    if (!p) { p = computePipelineAsync(this.device, { label: `dnShAtrous${key}`, layout: this.layShAtrous, compute: { module: this.mod, entryPoint: 'shAtrous', constants: { STRIDE: stride, FINAL: final ? 1 : 0, FIRST: first ? 1 : 0 } } }).then(pl => { this.pShAtrous.set(key, pl); this.pending.delete('S' + key); return pl; }); this.pending.set('S' + key, p); }
    return p;
  }
  private radAtrousAsync(stride: number, first: boolean, spec: boolean): Promise<GPUComputePipeline> {
    const key = `${stride}/${first ? 1 : 0}/${spec ? 1 : 0}`; const have = this.pRadAtrous.get(key); if (have) return Promise.resolve(have);
    let p = this.pending.get('R' + key);
    if (!p) { p = computePipelineAsync(this.device, { label: `dnRadAtrous${key}`, layout: this.layRadAtrous, compute: { module: this.mod, entryPoint: 'radAtrous', constants: { STRIDE: stride, FIRST: first ? 1 : 0, SPEC: spec ? 1 : 0 } } }).then(pl => { this.pRadAtrous.set(key, pl); this.pending.delete('R' + key); return pl; }); this.pending.set('R' + key, p); }
    return p;
  }
  /** Dev / measurement hook (main.ts __hotDenoise): rebuild every pipeline from `src` (a denoise.wgsl variant; the scene prelude is prepended) so an edited core can be A/B'd against a
   *  staged scene without a reboot. Resolves to the compiler's messages; nothing is swapped if there is an error. */
  async hotSwap(src: string): Promise<{ ok: boolean; messages: string[] }> {
    const mod = this.device.createShaderModule({ code: scenePrelude() + src, label: 'denoise-hot' });
    const info = await mod.getCompilationInfo();
    const off = scenePrelude().split('\n').length - 1;
    const messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    const four = await this.buildFixed(mod);   // built off the NEW module first; then the swap is one synchronous step (no frame sees a mix, overlapping swaps end on the last to install)
    this.mod = mod; this.pShAtrous.clear(); this.pRadAtrous.clear(); this.pending.clear(); this.pGiUp = null; this.pGiTempF = null; this.fullFailed = false; this.fullPending = false; [this.pPack, this.pShTemp, this.pGiTemp, this.pSpecTemp] = four;   // (the à-trous variants re-make themselves lazily off the new module, as before)
    return { ok: true, messages };
  }
  private shAtrous(stride: number, final: boolean, first: boolean): GPUComputePipeline {
    const key = `${stride}/${final ? 1 : 0}/${first ? 1 : 0}`; let p = this.pShAtrous.get(key);
    if (!p) { p = this.device.createComputePipeline({ label: `dnShAtrous${key}`, layout: this.layShAtrous, compute: { module: this.mod, entryPoint: 'shAtrous', constants: { STRIDE: stride, FINAL: final ? 1 : 0, FIRST: first ? 1 : 0 } } }); this.pShAtrous.set(key, p); }
    return p;
  }
  private radAtrous(stride: number, first: boolean, spec: boolean): GPUComputePipeline {
    const key = `${stride}/${first ? 1 : 0}/${spec ? 1 : 0}`; let p = this.pRadAtrous.get(key);
    if (!p) { p = this.device.createComputePipeline({ label: `dnRadAtrous${key}`, layout: this.layRadAtrous, compute: { module: this.mod, entryPoint: 'radAtrous', constants: { STRIDE: stride, FIRST: first ? 1 : 0, SPEC: spec ? 1 : 0 } } }); this.pRadAtrous.set(key, p); }
    return p;
  }

  /** Forget every cached bind group (passes.ts re-made the textures they name). */
  dropBindGroups() { this.bgs.clear(); }

  /** Per frame, before the chains: the parameter uniform. `f`: which switches are up this frame (passes.ts knows the frame flags / settings). */
  writeParams(f: { gatherDiv: number; reflDiv: number; temporalFlag: boolean; shadowTemporal: boolean; historyScale: number; cueUv: boolean; fullRes?: boolean }) {
    const k = this.knobs, p = this.pf, u = this.pu;
    p[0] = k.shClampK; p[1] = Math.max(0, k.shCap); p[2] = k.shSigmaL; p[3] = Math.max(0.005, k.shMoveThresh);
    p[4] = k.depthK; p[5] = k.normalPow; p[6] = f.historyScale; p[7] = k.ratioHi;
    p[8] = k.giClampK; p[9] = Math.max(0, k.giCap); p[10] = k.giSigmaL; p[11] = Math.max(0, k.giFast);
    p[12] = k.depthK * 2.5; p[13] = Math.max(1, k.normalPow * 0.66); p[14] = Math.max(0, k.giFirefly); p[15] = 0;   // (the gather grid's plane test spans gdiv× the ground per tap: looser, as giblur's was; normals a little softer)
    p[16] = k.spClampK; p[17] = Math.max(0, k.spCap); p[18] = k.spSigmaL; p[19] = Math.max(0, Math.min(1, k.spRough));
    p[20] = k.depthK * 2.5; p[21] = Math.max(1, k.normalPow * 0.66); p[22] = k.spVirtual; p[23] = 0;
    u[24] = (k.motionVectors ? 1 : 0) | (f.temporalFlag ? 2 : 0) | (k.shLitAlike ? 4 : 0) | (f.shadowTemporal ? 8 : 0) | (k.shPrior ? 16 : 0) | (f.cueUv ? 32 : 0);   // (32: the U textures' alpha holds ReSTIR's believed-visible luminance — the yardstick the shadow client's light-jump is measured against)
    u[25] = f.gatherDiv; u[26] = Math.max(0, Math.min(31, Math.round(k.shMoveCap))); u[27] = Math.max(0, Math.round(k.shJump * 1000));   // (flags.z = the moving history length; flags.w = the shadow client's light-jump threshold ‰, 0 = off)
    p[28] = Math.max(0, k.giClampCut); p[29] = Math.max(0, k.giYoungWiden); p[30] = 0; p[31] = 0;   // gi3 (GI in motion §D; 0 = off)
    this.device.queue.writeBuffer(this.params, 0, this.paramData);
    // the reflection chain's copy: its own divisor, and the per-pixel roughness mode (sp2.w = the cutoff — texels rougher than it hold no term)
    if (f.reflDiv > 0) { p[23] = Math.max(0.02, Math.min(1, k.spMaxRough)); u[25] = f.reflDiv; p[17] = Math.max(0, k.rfCap); const g3x = p[28], g3y = p[29]; p[28] = 0; p[29] = 0; this.device.queue.writeBuffer(this.paramsRefl, 0, this.paramData); p[23] = 0; u[25] = f.gatherDiv; p[17] = Math.max(0, k.spCap); p[28] = g3x; p[29] = g3y; }   // (+ its own history cap: the roughest finishes keep rfCap frames, a polish ~6 — denoise.wgsl capEff; the diffuse-only gi3 knobs zeroed in this block like gi2.w — every read of them sits behind !SPEC, insurance all the same)
    // the internal-res diffuse chain's copy: its grid IS the internal one (flags.y = 1: fullPx / gatherTexel are the identity there) and gi2.w carries the RAW gather's divisor for the pixel ↔ texel maps
    if (f.fullRes) { u[25] = 1; p[15] = f.gatherDiv; this.device.queue.writeBuffer(this.paramsFull, 0, this.paramData); u[25] = f.gatherDiv; p[15] = 0; }
  }

  private bg(key: string, layout: GPUBindGroupLayout, entries: GPUBindGroupEntry[], refl = false, full = false): GPUBindGroup {
    key = (refl ? 'R' : full ? 'F' : 'G') + key;
    let g = this.bgs.get(key);
    if (!g) { g = this.device.createBindGroup({ label: key, layout, entries: [{ binding: 0, resource: { buffer: refl ? this.paramsRefl : full ? this.paramsFull : this.params } }, ...entries] }); this.bgs.set(key, g); }
    return g;
  }
  private ids = new WeakMap<object, number>(); private nextId = 1;
  private idOf(o: object): number { let v = this.ids.get(o); if (!v) { v = this.nextId++; this.ids.set(o, v); } return v; }

  /** SHADOW chain into the open pass `p`: pack → (the caller's tileDistances between, via `tileDist`) → temporal → N à-trous, the last writing S = U × r̂ into v.S.
   *  `wx, wy` = the full-res 8×8 dispatch grid. Returns the dispatch count. */
  encodeShadow(p: GPUComputePassEncoder, sceneBG: GPUBindGroup, v: ShadowViews, wx: number, wy: number, tileDist: (() => void) | null): number {
    const N = Math.max(1, Math.min(5, Math.round(this.knobs.shIters)));
    let n = 0;
    p.setBindGroup(0, sceneBG);
    // pack: S, U → (ratio, hint) per class into cur[], (hints, lumU) into shared[0], per-tile hint flags
    p.setPipeline(this.pPack);
    p.setBindGroup(1, this.bg(`pack:${this.idOf(v.S[0])}:${this.idOf(v.cur[0])}:${this.idOf(v.shared[0])}`, this.lPack, [
      { binding: 10, resource: v.S[0] }, { binding: 11, resource: v.S[1] }, { binding: 12, resource: v.U[0] }, { binding: 13, resource: v.U[1] },
      { binding: 20, resource: v.cur[0] }, { binding: 21, resource: v.cur[1] }, { binding: 22, resource: v.shared[0] }, { binding: 23, resource: v.tileFlag } ]));
    p.dispatchWorkgroups(wx, wy); n++;
    if (tileDist) { tileDist(); n++; }
    // temporal: cur + last frame's histories → this frame's (hvOut doubles as the chain's first input)
    p.setPipeline(this.pShTemp);
    p.setBindGroup(1, this.bg(`shT:${this.idOf(v.cur[0])}:${this.idOf(v.hvIn[0])}:${this.idOf(v.hvOut[0])}:${this.idOf(v.hgIn)}`, this.lShTemp, [
      { binding: 1, resource: v.depth }, { binding: 2, resource: v.normal }, { binding: 3, resource: v.vel }, { binding: 4, resource: this.nearSamp },
      { binding: 30, resource: v.cur[0] }, { binding: 31, resource: v.cur[1] }, { binding: 32, resource: v.shared[0] },
      { binding: 33, resource: v.hvIn[0] }, { binding: 34, resource: v.hvIn[1] }, { binding: 35, resource: v.hmIn }, { binding: 36, resource: v.hgIn },
      { binding: 40, resource: v.hvOut[0] }, { binding: 41, resource: v.hvOut[1] }, { binding: 42, resource: v.hmOut }, { binding: 43, resource: v.hgOut } ]));
    p.dispatchWorkgroups(wx, wy); n++;
    // à-trous: iteration i reads the previous output (i = 1: hvOut), writes cur (= 'A') or S (= 'B') so that the LAST lands in S: i writes A when (N−1−i) is even, the final writes S
    let src = v.hvOut;
    for (let i = 1; i <= N; i++) {
      const final = i === N;
      const dst = final ? v.S : ((N - 1 - i) % 2 === 0 ? v.cur : v.S);
      const shIn = v.shared[(i - 1) % 2], shOut = v.shared[i % 2];
      p.setPipeline(this.shAtrous(DN_STRIDES[i - 1], final, i === 1));
      p.setBindGroup(1, this.bg(`shA:${final ? 1 : 0}${i === 1 ? 'f' : ''}:${this.idOf(src[0])}:${this.idOf(dst[0])}:${this.idOf(shIn)}:${this.idOf(v.hmOut)}`, this.lShAtrous, [
        { binding: 1, resource: v.depth }, { binding: 2, resource: v.normal },
        { binding: 50, resource: src[0] }, { binding: 51, resource: src[1] }, { binding: 52, resource: shIn }, { binding: 53, resource: v.tileMask }, { binding: 54, resource: v.U[0] }, { binding: 55, resource: v.U[1] }, { binding: 56, resource: v.hmOut }, { binding: 57, resource: v.hgOut },
        { binding: 60, resource: dst[0] }, { binding: 61, resource: dst[1] }, { binding: 62, resource: shOut } ]));
      p.dispatchWorkgroups(wx, wy); n++;
      src = dst;
    }
    this.stats.shadow = n;
    return n;
  }

  /** RADIANCE chain (diffuse: spec = false; specular: true) into the open pass: temporal → N à-trous, the last writing v.chain[N−1]. `hx, hy` = the grid's 8×8 dispatch. `refl` = this is the
   *  REFLECTION pass's chain (its own divisor + the per-pixel roughness mode, rfIters iterations) rather than the gather-res specular field's. `full` = the DIFFUSE client at the internal
   *  resolution (FullResGi): its own parameter block, giTemporalF (v.cur = the raw gather for the statistics, full.curFull = the upsampled value), à-trous strides full.strides — the caller
   *  ran encodeGiUpsample first and prepareFull() said ready. */
  encodeRadiance(p: GPUComputePassEncoder, sceneBG: GPUBindGroup, v: RadianceViews, hx: number, hy: number, spec: boolean, refl = false, full: FullResGi | null = null): number {
    const iters = refl ? this.knobs.rfIters : spec ? this.knobs.spIters : this.knobs.giIters;
    const N = Math.max(1, Math.min(v.chain.length, full ? full.strides.length : 5, Math.round(full ? v.chain.length : iters)));   // (full: the caller sized the chain to its own iteration count)
    let n = 0;
    p.setBindGroup(0, sceneBG);
    const tag = refl ? 'rf' : spec ? 'sp' : full ? 'gf' : 'gi';
    p.setPipeline(spec ? this.pSpecTemp : full ? this.pGiTempF! : this.pGiTemp);
    const tEntries: GPUBindGroupEntry[] = [
      { binding: 1, resource: v.depth }, { binding: 2, resource: v.normal }, { binding: 3, resource: v.vel }, { binding: 5, resource: v.mat },
      { binding: 70, resource: v.cur }, { binding: 71, resource: v.histIn }, { binding: 72, resource: v.momIn }, { binding: 73, resource: v.fastIn },
      { binding: 80, resource: v.histOut }, { binding: 81, resource: v.momOut }, { binding: 82, resource: v.fastOut } ];
    if (full) tEntries.push({ binding: 74, resource: full.curFull });
    p.setBindGroup(1, this.bg(`${tag}T:${this.idOf(v.cur)}:${this.idOf(v.histIn)}:${this.idOf(v.histOut)}:${this.idOf(v.fastIn)}:${this.idOf(v.mat)}${full ? ':' + this.idOf(full.curFull) : ''}`, spec ? this.lSpecTemp : full ? this.lGiTempF : this.lGiTemp, tEntries, refl, !!full));
    p.dispatchWorkgroups(hx, hy); n++;
    let src = v.histOut;
    for (let i = 1; i <= N; i++) {
      const dst = v.chain[i - 1]; const first = i === 1;
      p.setPipeline(this.radAtrous(full ? full.strides[i - 1] : DN_STRIDES[i - 1], first, spec));
      p.setBindGroup(1, this.bg(`${tag}A:${first ? 1 : 0}:${this.idOf(src)}:${this.idOf(dst)}:${this.idOf(v.momOut)}:${this.idOf(v.mat)}`, this.lRadAtrous, [
        { binding: 1, resource: v.depth }, { binding: 2, resource: v.normal }, { binding: 5, resource: v.mat }, { binding: 90, resource: src }, { binding: 91, resource: v.momOut }, { binding: 92, resource: v.fastOut }, { binding: 95, resource: dst } ], refl, !!full));
      p.dispatchWorkgroups(hx, hy); n++;
      src = dst;
    }
    if (refl) this.stats.refl = n; else if (spec) this.stats.spec = n; else this.stats.gi = n + (full ? 1 : 0);   // (+ the upsample dispatch that preceded the internal-res chain)
    return n;
  }
  /** The guided upsample of the raw gather to the internal grid (giUpsample) into the open pass: raw + full-res depth / normal → out. `wx, wy` = the internal 8×8 dispatch. */
  encodeGiUpsample(p: GPUComputePassEncoder, sceneBG: GPUBindGroup, v: { depth: GPUTextureView; normal: GPUTextureView; raw: GPUTextureView; out: GPUTextureView }, wx: number, wy: number): number {
    p.setBindGroup(0, sceneBG);
    p.setPipeline(this.pGiUp!);
    p.setBindGroup(1, this.bg(`gU:${this.idOf(v.raw)}:${this.idOf(v.out)}`, this.lGiUp, [ { binding: 1, resource: v.depth }, { binding: 2, resource: v.normal }, { binding: 70, resource: v.raw }, { binding: 84, resource: v.out } ], false, true));
    p.dispatchWorkgroups(wx, wy);
    return 1;
  }
}
