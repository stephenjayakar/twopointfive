// G-buffer targets + raster pipelines (boxes, skinned characters).
import { makeShader, makeBuffer, renderPipelineAsync, renderPipelineOrNull } from '../gpu/device';
import { cutSwap } from './cutSwap';
import { scenePrelude, snowLookConfig, lookConfig } from './frame';
import { decalWgslConsts } from './decals';
import { TexturePool } from './texpool';
import { BoxWorld, GEO_STRIDE, MAT_STRIDE } from '../scene/boxes';
import gbufSrc from './shaders/gbuffer.wgsl' with { type: 'text' };
import decalsSrc from './shaders/decals.wgsl' with { type: 'text' };
import detailSrc from './shaders/detail.wgsl' with { type: 'text' };   // the detail layer (renderer v3 phase 4): fsBox's wear / dust / edge terms + the traffic-map binding
import markingsSrc from './shaders/markings.wgsl' with { type: 'text' };   // the markings (scene/markings.ts): fsBox's pixel-art signifiers on box faces
import gbufCutSrc from './shaders/gbuffer_cut.wgsl' with { type: 'text' };   // CUT BOXES (scene/cut.ts): the cut pass's two entry points, appended in a second module only under the switch
import { cutConfig, CUT_ROWS } from '../scene/cut';
import snowSrc from './shaders/snow.wgsl' with { type: 'text' };   // THE SNOW'S SURFACE (render/snowField.ts): fsBox's snow + the hills' two entry points — dead code unless the prelude's SNOW_SURF is up
import { SNOW_CFG_FLOATS } from './snowField';
import gdownSrc from './shaders/gdown.wgsl' with { type: 'text' };     // SHARP DIRECT: the internal-size view of an output-size raster (encodeDown)
import surfaceSrc from './shaders/surface.wgsl' with { type: 'text' };   // SURFACES, A TRY (render/frame.ts surfTryConfig): fsBox's materials — dead code unless the prelude's SURF_TRY is up
import lookSrc from './shaders/look.wgsl' with { type: 'text' };         // THE LOOK PROTOTYPE (render/frame.ts lookConfig): fsBox's materials off real maps — in the module only on that page
import { LOOK_N, LOOK_LAYERS, LOOK_ROUGH, lookLayer, lookMip } from './lookTex';
import { GWOT_PALETTE, type GwotMat } from '../scene/gwotPalette';

/** which stuff each paint of the 2010s palette is drawn as under the try (shaders/surface.wgsl's classes, by number); a paint with no row draws plain */
const SURF_OF: Readonly<Partial<Record<GwotMat, number>>> = {
  mud: 1, mudDark: 1, mudLight: 1, render: 2, whitewash: 2, paintCream: 2, block: 3, tWall: 3,
  dust: 4, dirt: 4, mudFloor: 4, damp: 4, gravel: 5, slab: 6, poplar: 7, woodGrey: 7, ply: 7, galv: 8, tin: 8,
};
/** surface.wgsl behind its `surfClass`: the palette's colours written out as the shader's tests. A paint as the palette has it first (a stand-in, scene/gwotPalette.ts
 *  gwotAs, is at most 0.0024 off a channel), every paint of the palette, so that one with no row is plain whatever it is near; then a classed paint DARKENED in one
 *  piece, which is how a level writes wear and shade (a worn patch is its ground × 0.7) */
function classWgsl(name: string, of: Readonly<Partial<Record<GwotMat, number>>>): string {
  const v = (m: GwotMat) => `vec3f(${GWOT_PALETTE[m].join(', ')})`;
  const exact = (Object.keys(GWOT_PALETTE) as GwotMat[]).map(m => `  if (all(abs(a - ${v(m)}) < vec3f(0.006))) { return ${of[m] ?? 0}u; }   // ${m}`);
  const dark = (Object.keys(of) as GwotMat[]).map(m => `  { let p = ${v(m)}; let k = dot(a, p) / dot(p, p); if (k > 0.55 && k < 0.99 && all(abs(a - k * p) < vec3f(0.006))) { return ${of[m]}u; } }   // ${m}, darkened`);
  return `fn ${name}(a: vec3f) -> u32 {\n${exact.join('\n')}\n${dark.join('\n')}\n  return 0u;\n}\n`;
}
function surfaceWgsl(): string { return classWgsl('surfClass', SURF_OF) + surfaceSrc; }
/** THE LOOK PROTOTYPE's classes: surface.wgsl's eight and three of its own (look.wgsl LOOK_CLOTH 9, LOOK_METAL 10, LOOK_PAINT 11) */
const LOOK_OF: Readonly<Partial<Record<GwotMat, number>>> = { ...SURF_OF,
  sack: 9, sandbag: 9, hesco: 9, canvas: 9, tarpBlue: 9, blanketGrey: 9, blanketBrown: 9, rugRed: 9, rugNavy: 9, rugCream: 9, rugOchre: 9, rugGreen: 9, rugMadder: 9, coyote: 9,
  rust: 10, iron: 10,
  paintBlue: 11, paintGreen: 11, paintRust: 11, drumBlue: 11, drumRed: 11, genYellow: 11, truckWhite: 11, truckTan: 11, truckRed: 11, olive: 11,
};

/** look.wgsl on the look page; on every other, the few names fsBox's dead calls need and nothing else (no binding: the bind group is the page's as it was) */
function lookWgsl(): string {
  return lookConfig.on ? classWgsl('lookClass', LOOK_OF) + lookSrc : `struct LookOut { albedo: vec3f, n: vec3f, rough: f32, tilted: bool };
fn lookSurface(cls: u32, wp: vec3f, n: vec3f, bi: u32, lc: vec3f, hf: vec4f, albedoIn: vec3f, roughIn: f32, dwx: vec3f, dwy: vec3f, fp: f32) -> LookOut { return LookOut(albedoIn, n, roughIn, false); }
fn lookClass(a: vec3f) -> u32 { return 0u; }
struct LookSnow { albedo: vec3f, n: vec3f, rough: f32, amt: f32, bank: bool };
fn lookSnow(cls: u32, wp: vec3f, gn: vec3f, bi: u32, lc: vec3f, hf: vec4f, paint: vec3f, albedoIn: vec3f, roughIn: f32, fp: f32) -> LookSnow { return LookSnow(albedoIn, gn, roughIn, 0.0, false); }
`;
}
/** the look page's panel numbers, as look.wgsl's LookCfg takes them (a, b: the eight amounts; the layers' base roughness follows, and `snow` after it) */
export const LOOK_DEFAULTS = { paint: 1, relief: 1, shine: 1, weather: 1, untile: 1, edges: 1, cavity: 1, size: 1, snow: 1, air: 1 };   // (`air` is not the shader's: × settings.hazeDensity, ui/lookpanel.ts)
export const lookAmounts = { ...LOOK_DEFAULTS };

export interface SkinnedDrawable {
  vertexBuf: GPUBuffer;      // interleaved: pos f32x3, normal f32x3, weights f32x4, matSel f32 (44 B)
  jointBuf: GPUBuffer;       // uint8x4 (4 B) or uint16x4 (8 B), see jointsFormat
  jointsFormat: GPUVertexFormat;
  indexBuf: GPUBuffer; indexCount: number; indexFormat: GPUIndexFormat;
  jointMats: GPUBuffer;      // array<mat4x4f>  (usage must include COPY_SRC: snapshotted into the g-buffer's previous-palette buffer each frame)
  charInsts: GPUBuffer;      // array<CharInst>
  slotBuf: GPUBuffer;        // CHARACTER MATERIALS (render/charMaterials.ts): f32x2 per vertex = (material slot, cavity) (8 B)
  charMats: GPUBuffer;       // array<vec4f>: CHAR_MAT_ROWS rows per instance — the per-slot materials; zeros = shade from CharInst's two tints, as ever
  instanceCount: number;
  /** instance i's index runs as (first index, index count) pairs in index order when only part of the mesh is his (THE CAST: the parts he wears — anim/characters.ts); null or absent =
   *  the whole mesh */
  drawRuns?(i: number): Uint32Array | null;
}

export class GBuffer {
  width = 0; height = 0;
  albedo!: GPUTexture; normal!: GPUTexture; id!: GPUTexture; depth!: GPUTexture;
  /** GBAA's per-pixel edge offset (rg8unorm, gbuffer.wgsl boxEdgeOffset; (1, 1) = none — the clear): read by gbaa.wgsl when settings.gbaa is on, written regardless (2 B a pixel) */
  edge!: GPUTexture; edgeView!: GPUTextureView; edgeO!: GPUTexture; edgeOView!: GPUTextureView;
  /** per-pixel OBJECT motion for the TAAU resolve (rg16float): ndc(prevViewProj · P_prev) − ndc(prevViewProj · P_now) — where this surface point WAS a frame ago minus where it is, both through
   *  the same (previous) view-projection so the camera's share (which the resolve reconstructs exactly from depth) and any jitter cancel; 0 for everything rigid and still, cleared to 0 (sky).
   *  Boxes take their previous transform from prevBoxes when the box at the same index a frame ago had the same size and owner (statics always; a leaf, a ragdoll limb, a gun in a hand nearly
   *  always — the dynamic list only shifts when something spawns or goes), skinned men from the previous joint palette. */
  vel!: GPUTexture;
  /** per-pixel MATERIAL (renderer v3 phase 4, rg8unorm): r = GGX roughness, g = metalness — the finish of the box under the pixel (common.wgsl boxFinish) after the detail layer's wear / dust /
   *  edge terms; characters and section caps write (1, 0) = matte, and the clear is (1, 0) so the sky reads matte too. Read by reflect.wgsl, the specular denoiser and composite. */
  mat!: GPUTexture;
  albedoView!: GPUTextureView; normalView!: GPUTextureView; idView!: GPUTextureView; depthView!: GPUTextureView; velView!: GPUTextureView; matView!: GPUTextureView;
  /** engine.settings.keepHistories, mirrored by the engine: the targets go back to / come from the shared pool on a resize instead of destroy + create (they are cleared by
   *  their own render pass every frame, so a parked one needs nothing doing) — off = the old path */
  keepTargets = true;
  /** last frame's box transforms — [geo rows | mat rows] of BoxWorld's two buffers, copied at the tail of every frame (snapshotPrev) — and last frame's joint palette (sized to the skin's when one
   *  is attached); read by the vertex stages for the motion vectors */
  readonly prevBoxes: GPUBuffer; private prevJoints: GPUBuffer; private prevJointsFor: GPUBuffer | null = null;
  private readonly geoBytes: number;
  private boxPipe!: GPURenderPipeline; private skinPipes = new Map<GPUVertexFormat, GPURenderPipeline>();
  private objLayout: GPUBindGroupLayout; private mod: GPUShaderModule; private pipeLayout: GPUPipelineLayout;
  private targets: GPUColorTargetState[]; private depthStencil: GPUDepthStencilState;
  private objBG: GPUBindGroup | null = null; private objBGKey = '';
  private cutMod: GPUShaderModule | null = null; private cutPipe: GPURenderPipeline | null = null;

  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout, readonly pool: TexturePool = new TexturePool(device), maxBoxes = 4096) {
    this.geoBytes = maxBoxes * GEO_STRIDE * 4;
    const mod = makeShader(device, scenePrelude() + `const PREV_MAT_BASE: u32 = ${maxBoxes * GEO_STRIDE / 4}u;   // prevBoxes: vec4 index where the mat rows start (after maxBoxes geo rows of 2 vec4 each)\n` + decalWgslConsts(3) + decalsSrc + detailSrc + surfaceWgsl() + lookWgsl() + snowSrc + markingsSrc + gbufSrc, 'gbuffer');   // decals.wgsl: the experiment's per-pixel marks (group 1 binding 3), read by fsBox under FrameFlags.Decals
    this.objLayout = device.createBindGroupLayout({ label: 'gbufObj', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },   // the decal buffer (render/decals.ts): the fragment stage's 9th storage buffer where the scene group carries 8 (reach rows + mesh trees in storage) — inside the 10 Chrome offers on Metal, and 7 or 8 on adapters where frame.ts already fell back
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },   // prevBoxes (last frame's geo + mat rows) — the vertex stage's 6th storage buffer with the scene group's two …
      { binding: 5, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },   // … and prevJoints its 7th (of the WebGPU default 8)
      { binding: 7, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },   // charMats (character materials: the per-instance slot rows vsSkin reads) — the vertex stage's 8th storage buffer, the WebGPU default's last
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },   // the traffic map the detail layer reads (rg8unorm over the world's XZ; a 1×1 zero until a level hands one over — setWearMap)
      { binding: 8, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },   // the snow field (render/snowField.ts; rgba16float over the world's XZ — a 1×1 zero on every page but a snow level's) …
      { binding: 9, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },   // … and its place + the look's numbers (snow.wgsl SnowCfg; all zero = not live)
      { binding: 10, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },   // the prints pressed into the snow (game/snowTracks.ts; r8unorm over the world's XZ — a 1×1 zero until a snow level hands one over)
      ...(lookConfig.on ? [   // THE LOOK PROTOTYPE (look.wgsl; on its page only): the two map arrays, their sampler and the panel's numbers
        { binding: 11, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' as const, viewDimension: '2d-array' as const } },
        { binding: 12, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' as const, viewDimension: '2d-array' as const } },
        { binding: 13, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' as const } },
        { binding: 14, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' as const } },
      ] : []),
    ] });
    this.pipeLayout = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.objLayout] });
    this.targets = [{ format: 'rgba8unorm' }, { format: 'rgb10a2unorm' }, { format: 'r32uint' }, { format: 'rg16float' }, { format: 'rg8unorm' }, { format: 'rg8unorm' }];   // (+ the material and GBAA edge targets: 8 + 8 + 4 + 4 + 2 + 2 = 28 bytes per sample of the 32 the default limits allow, by WebGPU's attachment accounting — rgba8 / rgb10a2 count 8 each)
    this.depthStencil = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' };
    this.mod = mod;   // (the box pipeline: init(), awaited by the engine before the first frame)
    // CUT BOXES: the same text + gbuffer_cut.wgsl as a second module, made only in a build with the switch — the module above and its pipelines are the build's without it
    if (cutConfig.on) this.cutMod = makeShader(device, scenePrelude(true) + `const PREV_MAT_BASE: u32 = ${maxBoxes * GEO_STRIDE / 4}u;\n` + decalWgslConsts(3) + decalsSrc + detailSrc + surfaceWgsl() + lookWgsl() + snowSrc + markingsSrc + gbufSrc + gbufCutSrc, 'gbufferCut');
    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    this.prevBoxes = makeBuffer(device, maxBoxes * (GEO_STRIDE + MAT_STRIDE) * 4, S, 'prevBoxes');
    this.prevJoints = makeBuffer(device, 256, S, 'prevJointsDummy');   // (replaced by one the size of the skin's palette the first time a skin is drawn)
    this.wearTex = device.createTexture({ label: 'wearNone', size: [1, 1], format: 'rg8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: this.wearTex }, new Uint8Array([0, 0]), { bytesPerRow: 2 }, [1, 1]);
    this.wearView = this.wearTex.createView();
    this.snowTex = device.createTexture({ label: 'snowNone', size: [1, 1], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: this.snowTex }, new Uint16Array(4), { bytesPerRow: 8 }, [1, 1]);
    this.snowView = this.snowTex.createView();
    this.trackTex = device.createTexture({ label: 'snowTracksNone', size: [1, 1], format: 'r8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: this.trackTex }, new Uint8Array(4), { bytesPerRow: 4 }, [1, 1]);
    this.trackView = this.trackTex.createView();
    this.snowCfg = makeBuffer(device, SNOW_CFG_FLOATS * 4, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'snowCfg');
    device.queue.writeBuffer(this.snowCfg, 0, new Float32Array(SNOW_CFG_FLOATS));
    if (lookConfig.on) this.makeLook();
  }
  // ---- THE LOOK PROTOTYPE (render/lookTex.ts, shaders/look.wgsl): the materials as two mipped texture arrays, made here at boot; the panel's numbers
  private lookView: [GPUTextureView, GPUTextureView] | null = null; private lookSamp: GPUSampler | null = null; private lookCfg: GPUBuffer | null = null;
  private makeLook() {
    const d = this.device; let mips = 1; for (let n = LOOK_N; n > 1; n >>= 1) mips++;
    const tex = [0, 1].map(i => d.createTexture({ label: i ? 'lookB' : 'lookA', size: [LOOK_N, LOOK_N, LOOK_LAYERS], mipLevelCount: mips, format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST }));
    for (let l = 0; l < LOOK_LAYERS; l++) {
      const m = lookLayer(l); let lv = [m.a, m.b];
      for (let mip = 0, n = LOOK_N; mip < mips; mip++, n >>= 1) {
        for (let i = 0; i < 2; i++) d.queue.writeTexture({ texture: tex[i], mipLevel: mip, origin: [0, 0, l] }, lv[i], { bytesPerRow: n * 4 }, [n, n, 1]);
        if (n > 1) lv = [lookMip(lv[0], n, false), lookMip(lv[1], n, true)];
      }
    }
    this.lookView = [tex[0].createView({ dimension: '2d-array' }), tex[1].createView({ dimension: '2d-array' })];
    this.lookSamp = d.createSampler({ label: 'look', addressModeU: 'repeat', addressModeV: 'repeat', magFilter: 'linear', minFilter: 'linear', mipmapFilter: 'linear', maxAnisotropy: 8 });
    this.lookCfg = makeBuffer(d, 80, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'lookCfg');
    this.setLook();
  }
  /** the panel moved a number (lookAmounts): the uniform block again. Nothing on a page without the look. */
  setLook() {
    if (!this.lookCfg) return;
    const k = lookAmounts;
    this.device.queue.writeBuffer(this.lookCfg, 0, new Float32Array([k.paint, k.relief, k.shine, k.weather, k.untile, k.edges, k.cavity, k.size, ...LOOK_ROUGH, k.snow]));
  }
  // ---- THE SNOW'S SURFACE (render/snowField.ts, shaders/snow.wgsl): the field's texture, its uniform block, and the hills' mesh — one (tx, tz) per lattice quad, six corners each
  private snowTex: GPUTexture; private snowView: GPUTextureView; private readonly snowCfg: GPUBuffer;
  private snowQuads: GPUBuffer | null = null; private snowQuadCount = 0; private snowPipe: GPURenderPipeline | null = null;
  /** hand over a level's snow field (null = none: a 1×1 zero and no mesh) with its uniform block (snowField.ts snowCfgRows) */
  setSnowField(f: { data: Uint16Array; w: number; h: number; quads: Uint32Array } | null, cfg: Float32Array) {
    this.snowTex.destroy(); this.snowQuads?.destroy(); this.snowQuads = null; this.snowQuadCount = 0;
    const w = f?.w ?? 1, h = f?.h ?? 1;
    this.snowTex = this.device.createTexture({ label: f ? 'snowField' : 'snowNone', size: [w, h], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.device.queue.writeTexture({ texture: this.snowTex }, f?.data ?? new Uint16Array(4), { bytesPerRow: w * 8 }, [w, h]);
    this.snowView = this.snowTex.createView(); this.objBG = null;
    if (f && f.quads.length > 0) {
      this.snowQuads = makeBuffer(this.device, f.quads.byteLength, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST, 'snowQuads');
      this.device.queue.writeBuffer(this.snowQuads, 0, f.quads); this.snowQuadCount = f.quads.length / 2;
    }
    this.setSnowCfg(cfg);
  }
  /** … and the texels of it that changed since ([x0, z0, x1, z1], inclusive): a blast dug a hill out (snowField.ts digSnowField). The mesh stays as it was. */
  setSnowFieldRect(f: { data: Uint16Array; w: number; h: number }, rect: readonly [number, number, number, number]) {
    if (this.snowTex.width !== f.w || this.snowTex.height !== f.h) return;
    const x0 = rect[0], z0 = rect[1], rw = rect[2] - rect[0] + 1, rh = rect[3] - rect[1] + 1;
    this.device.queue.writeTexture({ texture: this.snowTex, origin: [x0, z0] }, f.data, { offset: (z0 * f.w + x0) * 8, bytesPerRow: f.w * 8 }, [rw, rh]);
  }
  private trackTex: GPUTexture; private trackView: GPUTextureView; private trackW = 1; private trackH = 1;
  /** the prints pressed into the snow (game/snowTracks.ts): `rect` = the texels changed since the last call ([x0, z0, x1, z1], inclusive; none = all of it); null = none
   *  (a 1×1 zero). The texture is made the first time a size is seen. */
  setSnowTracks(t: { data: Uint8Array; w: number; h: number } | null, rect?: readonly [number, number, number, number]) {
    const w = t?.w ?? 1, h = t?.h ?? 1;
    if (w !== this.trackW || h !== this.trackH) {
      this.trackTex.destroy(); this.trackW = w; this.trackH = h; rect = undefined;
      this.trackTex = this.device.createTexture({ label: t ? 'snowTracks' : 'snowTracksNone', size: [w, h], format: 'r8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
      this.trackView = this.trackTex.createView(); this.objBG = null;
    }
    if (!t) { this.device.queue.writeTexture({ texture: this.trackTex }, new Uint8Array(4), { bytesPerRow: 4 }, [1, 1]); return; }
    const x0 = rect ? rect[0] : 0, z0 = rect ? rect[1] : 0, rw = rect ? rect[2] - rect[0] + 1 : w, rh = rect ? rect[3] - rect[1] + 1 : h;
    this.device.queue.writeTexture({ texture: this.trackTex, origin: [x0, z0] }, t.data, { offset: z0 * w + x0, bytesPerRow: w }, [rw, rh]);
  }
  /** the look's numbers alone (the console's `__snow.relook()`) */
  setSnowCfg(cfg: Float32Array) { this.device.queue.writeBuffer(this.snowCfg, 0, cfg.subarray(0, SNOW_CFG_FLOATS)); }
  /** the traffic map the detail layer reads (render/wear.ts builds it from the level; the viewer never does): r = traffic 0‥255, g = wall proximity 0‥255, one texel per 1/8 m over the world's grid footprint */
  private wearTex: GPUTexture; private wearView: GPUTextureView;
  setWearMap(data: Uint8Array, w: number, h: number) {
    this.wearTex.destroy();
    this.wearTex = this.device.createTexture({ label: 'wearMap', size: [w, h], format: 'rg8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.device.queue.writeTexture({ texture: this.wearTex }, data, { bytesPerRow: w * 2 }, [w, h]);
    this.wearView = this.wearTex.createView(); this.objBG = null;
  }

  /** The box pipeline (every frame's raster), compiled off the GPU process's main thread (gpu/device.ts renderPipelineAsync). `opts.sharp`: also the sharp-direct down pass
   *  (gdown), which is otherwise made synchronously on the first sharp frame — main.ts asks for it whenever a preset may switch sharp direct on. Engine.init awaits it. */
  async init(opts: { sharp?: boolean } = {}): Promise<void> {
    const jobs: Promise<unknown>[] = [renderPipelineAsync(this.device, {
      label: 'gbufBoxes', layout: this.pipeLayout,
      vertex: { module: this.mod, entryPoint: 'vsBox' },
      fragment: { module: this.mod, entryPoint: 'fsBox', targets: this.targets },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: this.depthStencil,
    }).then(p => { this.boxPipe = p; })];
    if (opts.sharp) jobs.push(this.prepareDown());
    if (snowLookConfig.surface) jobs.push(renderPipelineOrNull(this.device, {   // THE SNOW'S HILLS (snow.wgsl vsSnow / fsSnow): same targets, same depth rule; drawn before the boxes. One that fails to compile is left null: the level's own snow boxes show, as they are drawn under it anyway
      label: 'gbufSnow', layout: this.pipeLayout,
      vertex: { module: this.mod, entryPoint: 'vsSnow', buffers: [{ arrayStride: 8, stepMode: 'instance', attributes: [{ shaderLocation: 0, offset: 0, format: 'uint32x2' }] }] },
      fragment: { module: this.mod, entryPoint: 'fsSnow', targets: this.targets },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
      depthStencil: this.depthStencil,
    }, 'the snow\'s drifts are drawn as the level\'s boxes').then(p => { this.snowPipe = p; }));
    if (this.cutMod) jobs.push(renderPipelineOrNull(this.device, {   // CUT BOXES: the cut solids' pipeline (same targets, same depth rule; its fragment stage discards). One that fails to compile is left null: encode() then draws cut boxes whole, and the rays are held to whole boxes too (cutSwap.rasterFailed)
      label: 'gbufBoxesCut', layout: this.pipeLayout,
      vertex: { module: this.cutMod, entryPoint: 'vsBoxCut' },
      fragment: { module: this.cutMod, entryPoint: 'fsBoxCut', targets: this.targets },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: this.depthStencil,
    }, 'cut pieces are drawn and traced as whole boxes').then(p => { this.cutPipe = p; if (!p) cutSwap.rasterFailed(); }));
    await Promise.all(jobs);
  }
  /** Compile the skinned-mesh pipeline for this joint-index format ahead of the first frame that draws a skin (main.ts / the viewer, once the glTF says which format) — the same
   *  object skinPipe() would otherwise make synchronously inside that frame. */
  async prepareSkin(fmt: GPUVertexFormat): Promise<void> {
    if (this.skinPipes.has(fmt)) return;
    const p = await renderPipelineAsync(this.device, this.skinDesc(fmt));
    if (!this.skinPipes.has(fmt)) this.skinPipes.set(fmt, p);
  }
  private skinDesc(fmt: GPUVertexFormat): GPURenderPipelineDescriptor {
    return {
      label: 'gbufSkin', layout: this.pipeLayout,
      vertex: { module: this.mod, entryPoint: 'vsSkin', buffers: [
        { arrayStride: 44, attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' },
          { shaderLocation: 1, offset: 12, format: 'float32x3' },
          { shaderLocation: 3, offset: 24, format: 'float32x4' },
          { shaderLocation: 4, offset: 40, format: 'float32' },
        ] },
        { arrayStride: fmt === 'uint8x4' ? 4 : 8, attributes: [{ shaderLocation: 2, offset: 0, format: fmt }] },
        { arrayStride: 8, attributes: [{ shaderLocation: 5, offset: 0, format: 'float32x2' }] },   // (material slot, cavity) — render/charMaterials.ts
      ] },
      fragment: { module: this.mod, entryPoint: 'fsSkin', targets: this.targets },
      primitive: { topology: 'triangle-list', cullMode: 'back' },
      depthStencil: this.depthStencil,
    };
  }
  /** the skinned pipeline for a joint format — prepared before the first frame (prepareSkin); the synchronous creation stays as the fallback for a format nobody prepared */
  private skinPipe(fmt: GPUVertexFormat): GPURenderPipeline {
    let p = this.skinPipes.get(fmt);
    if (p) return p;
    p = this.device.createRenderPipeline(this.skinDesc(fmt));
    this.skinPipes.set(fmt, p);
    return p;
  }

  /** A new INTERNAL size (w, h) — and, under SHARP DIRECT (docs/internal/sharp-direct.md), the OUTPUT size (ow, oh) the boxes and men are actually rasterised at: then the six targets everyone binds
   *  (albedo … mat, at w × h) are the internal VIEW of an output-size raster set (albedoO … matO), filled by encodeDown; sharp off = one set at w × h exactly as before (the O views alias it). */
  resize(w: number, h: number, ow = w, oh = h, sharp = false) {
    if (!sharp) { ow = w; oh = h; }
    if (w === this.width && h === this.height && ow === this.outW && oh === this.outH && sharp === this.sharp) return;
    const usage = GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    const mk = (format: GPUTextureFormat, label: string, tw: number, th: number) => this.keepTargets ? this.pool.acquire({ label, size: [tw, th], format, usage }).tex : this.device.createTexture({ size: [tw, th], format, usage, label });
    if (w !== this.width || h !== this.height) {
      this.width = w; this.height = h;
      const old = [this.albedo, this.normal, this.id, this.depth, this.vel, this.mat, this.edge];
      if (!this.keepTargets) for (const t of old) t?.destroy();
      this.albedo = mk('rgba8unorm', 'gAlbedo', w, h); this.normal = mk('rgb10a2unorm', 'gNormal', w, h); this.id = mk('r32uint', 'gId', w, h); this.depth = mk('depth32float', 'gDepth', w, h); this.vel = mk('rg16float', 'gVel', w, h); this.mat = mk('rg8unorm', 'gMat', w, h); this.edge = mk('rg8unorm', 'gEdge', w, h);
      if (this.keepTargets) for (const t of old) this.pool.release(t);   // (after the acquires: a parked target of the old size is never what a new size gets anyway, but the order reads right)
      this.albedoView = this.albedo.createView(); this.normalView = this.normal.createView(); this.idView = this.id.createView(); this.depthView = this.depth.createView(); this.velView = this.vel.createView(); this.matView = this.mat.createView(); this.edgeView = this.edge.createView();
    }
    if (sharp !== this.sharp || (sharp && (ow !== this.outW || oh !== this.outH))) {   // the output-size raster set: made / re-made under sharp, let go when it goes off
      const oldO = this.sharp ? [this.albedoO, this.normalO, this.idO, this.depthO, this.velO, this.matO, this.edgeO] : [];
      if (!this.keepTargets) for (const t of oldO) t?.destroy();
      if (sharp) {
        this.albedoO = mk('rgba8unorm', 'gAlbedoO', ow, oh); this.normalO = mk('rgb10a2unorm', 'gNormalO', ow, oh); this.idO = mk('r32uint', 'gIdO', ow, oh); this.depthO = mk('depth32float', 'gDepthO', ow, oh); this.velO = mk('rg16float', 'gVelO', ow, oh); this.matO = mk('rg8unorm', 'gMatO', ow, oh); this.edgeO = mk('rg8unorm', 'gEdgeO', ow, oh);
        this.albedoOView = this.albedoO.createView(); this.normalOView = this.normalO.createView(); this.idOView = this.idO.createView(); this.depthOView = this.depthO.createView(); this.velOView = this.velO.createView(); this.matOView = this.matO.createView(); this.edgeOView = this.edgeO.createView();
      }
      if (this.keepTargets) for (const t of oldO) this.pool.release(t);
      this.downBG = null;
    }
    this.sharp = sharp; this.outW = ow; this.outH = oh;
    if (!sharp) {   // off: the O names alias the internal set (textures and views), so nothing points at a target that went back to the pool
      this.albedoO = this.albedo; this.normalO = this.normal; this.idO = this.id; this.depthO = this.depth; this.velO = this.vel; this.matO = this.mat; this.edgeO = this.edge;
      this.albedoOView = this.albedoView; this.normalOView = this.normalView; this.idOView = this.idView; this.depthOView = this.depthView; this.velOView = this.velView; this.matOView = this.matView; this.edgeOView = this.edgeView;
    }
  }
  /** bytes of the output-size raster set while sharp direct is on (0 off): albedo 4 + normal 4 + id 4 + depth 4 + motion 4 + material 2 per output pixel */
  get sharpBytes(): number { return this.sharp ? this.outW * this.outH * 24 : 0; }
  // ---- SHARP DIRECT: the output-size raster set + the pass that derives the internal view from it (shaders/gdown.wgsl) ----
  /** the OUTPUT size the raster runs at under sharp direct (= width / height with it off) and whether it is on */
  outW = 0; outH = 0; sharp = false;
  albedoO!: GPUTexture; normalO!: GPUTexture; idO!: GPUTexture; depthO!: GPUTexture; velO!: GPUTexture; matO!: GPUTexture;
  /** the output-size targets' views (the internal ones while sharp is off, so a caller may name them either way) */
  albedoOView!: GPUTextureView; normalOView!: GPUTextureView; idOView!: GPUTextureView; depthOView!: GPUTextureView; velOView!: GPUTextureView; matOView!: GPUTextureView;
  private downPipe: GPURenderPipeline | null = null; private downLayout: GPUBindGroupLayout | null = null; private downBG: GPUBindGroup | null = null;
  /** After the raster under sharp direct: fill the INTERNAL-size targets from the output-size ones (one texel each, the one holding the internal pixel's centre — gdown.wgsl says why nothing is
   *  averaged). `sceneBG` = the INTERNAL frame block's group. A no-op with sharp off. */
  /** the down pass's layout + descriptor (made once: encodeDown builds the pipeline synchronously on first use, prepareDown ahead of time — the same objects either way) */
  private downDesc(): GPURenderPipelineDescriptor {
    if (!this.downLayout) {
      const F = GPUShaderStage.FRAGMENT;
      this.downLayout = this.device.createBindGroupLayout({ label: 'gdown', entries: [
        { binding: 0, visibility: F, texture: { sampleType: 'float', viewDimension: '2d' } }, { binding: 1, visibility: F, texture: { sampleType: 'float', viewDimension: '2d' } },
        { binding: 2, visibility: F, texture: { sampleType: 'uint', viewDimension: '2d' } }, { binding: 3, visibility: F, texture: { sampleType: 'depth', viewDimension: '2d' } },
        { binding: 4, visibility: F, texture: { sampleType: 'float', viewDimension: '2d' } }, { binding: 5, visibility: F, texture: { sampleType: 'float', viewDimension: '2d' } } ] });
    }
    const mod = makeShader(this.device, scenePrelude() + gdownSrc, 'gdown');
    return { label: 'gdown', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.downLayout] }),
      vertex: { module: mod, entryPoint: 'vsDown' }, fragment: { module: mod, entryPoint: 'fsDown', targets: this.targets }, primitive: { topology: 'triangle-list' },
      depthStencil: { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'always' } };
  }
  /** compile the down pass before any sharp frame needs it (init({ sharp })) */
  private async prepareDown(): Promise<void> { if (this.downPipe) return; const p = await renderPipelineAsync(this.device, this.downDesc()); this.downPipe ??= p; }
  encodeDown(enc: GPUCommandEncoder, sceneBG: GPUBindGroup) {
    if (!this.sharp) return;
    if (!this.downPipe) this.downPipe = this.device.createRenderPipeline(this.downDesc());   // (nobody prepared it: the old synchronous first-use build)
    if (!this.downBG) this.downBG = this.device.createBindGroup({ layout: this.downLayout!, entries: [
      { binding: 0, resource: this.albedoOView }, { binding: 1, resource: this.normalOView }, { binding: 2, resource: this.idOView }, { binding: 3, resource: this.depthOView }, { binding: 4, resource: this.velOView }, { binding: 5, resource: this.matOView } ] });
    const pass = enc.beginRenderPass({ label: 'gdown',
      colorAttachments: [
        { view: this.albedoView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }, { view: this.normalView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.5, g: 1, b: 0.5, a: 0 } },
        { view: this.idView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0xFFFFFFFF, g: 0, b: 0, a: 0 } }, { view: this.velView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } },
        { view: this.matView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 0, b: 0, a: 0 } },
        { view: this.edgeView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 1, b: 0, a: 0 } } ],
      depthStencilAttachment: { view: this.depthView, depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 } });   // (not timestamped: a render pass's stamps span the drawable wait on Metal and would poison every GPU total — its cost is inside the union-vs-wall check of the doc)
    pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, this.downBG); pass.setPipeline(this.downPipe); pass.draw(3); pass.end();
  }

  private objectBindGroup(visibleBuf: GPUBuffer, skin: SkinnedDrawable | null, dummy: GPUBuffer, decalBuf: GPUBuffer): GPUBindGroup {
    const jm = skin?.jointMats ?? dummy, ci = skin?.charInsts ?? dummy, cm = skin?.charMats ?? dummy;
    const key = `${idOf(visibleBuf)}:${idOf(jm)}:${idOf(ci)}:${idOf(decalBuf)}:${idOf(this.prevJoints)}:${idOf(this.wearTex)}:${idOf(cm)}:${idOf(this.snowTex)}:${idOf(this.trackTex)}`;
    if (this.objBG && this.objBGKey === key) return this.objBG;
    this.objBG = this.device.createBindGroup({ layout: this.objLayout, entries: [
      { binding: 0, resource: { buffer: visibleBuf } }, { binding: 1, resource: { buffer: jm } }, { binding: 2, resource: { buffer: ci } }, { binding: 3, resource: { buffer: decalBuf } },
      { binding: 4, resource: { buffer: this.prevBoxes } }, { binding: 5, resource: { buffer: this.prevJoints } }, { binding: 6, resource: this.wearView },
      { binding: 7, resource: { buffer: cm } },
      { binding: 8, resource: this.snowView }, { binding: 9, resource: { buffer: this.snowCfg } }, { binding: 10, resource: this.trackView },
      ...(this.lookView ? [{ binding: 11, resource: this.lookView[0] }, { binding: 12, resource: this.lookView[1] }, { binding: 13, resource: this.lookSamp! }, { binding: 14, resource: { buffer: this.lookCfg! } }] : []),
    ] });
    this.objBGKey = key; return this.objBG;
  }

  /** decalBuf: the decal buffer (Decals.buf), or any storage buffer while none is attached — it is only read under FrameFlags.Decals, which the engine never raises then */
  encode(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, visibleBuf: GPUBuffer, visibleCount: number, skin: SkinnedDrawable | null, dummy: GPUBuffer, decalBuf: GPUBuffer, ts?: GPURenderPassTimestampWrites, cutCount = 0, cutWhole = 0) {
    if (skin && this.prevJointsFor !== skin.jointMats) { this.prevJoints.destroy(); this.prevJoints = makeBuffer(this.device, skin.jointMats.size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'prevJoints'); this.prevJointsFor = skin.jointMats; }   // (a palette-sized 'previous' the first frame a skin shows up; zeros until the first snapshot — that frame's skinned motion is garbage, and the resolve is reset on a first frame anyway)
    const S = this.sharp;   // SHARP DIRECT: rasterise at the OUTPUT size into the O set (encodeDown then derives the internal view); off = the internal targets, exactly as before
    const pass = enc.beginRenderPass({
      label: 'gbuffer',
      colorAttachments: [
        { view: S ? this.albedoOView : this.albedoView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } },
        { view: S ? this.normalOView : this.normalView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0.5, g: 1, b: 0.5, a: 0 } },
        { view: S ? this.idOView : this.idView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0xFFFFFFFF, g: 0, b: 0, a: 0 } },
        { view: S ? this.velOView : this.velView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } },
        { view: S ? this.matOView : this.matView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 0, b: 0, a: 0 } },   // (matte where nothing is drawn)
        { view: S ? this.edgeOView : this.edgeView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 1, g: 1, b: 0, a: 0 } },   // (GBAA: no edge where nothing is drawn)
      ],
      depthStencilAttachment: { view: S ? this.depthOView : this.depthView, depthLoadOp: 'clear', depthStoreOp: 'store', depthClearValue: 1 },
      timestampWrites: ts,
    });
    const obg = this.objectBindGroup(visibleBuf, skin, dummy, decalBuf);
    pass.setBindGroup(0, sceneBG); pass.setBindGroup(1, obg);
    if (this.snowPipe && this.snowQuads && this.snowQuadCount > 0) { pass.setPipeline(this.snowPipe); pass.setVertexBuffer(0, this.snowQuads); pass.draw(6, this.snowQuadCount); }   // THE SNOW'S HILLS, first: the ground and the boxes under them then fail the depth test instead of being shaded twice
    pass.setPipeline(this.boxPipe);
    if (!this.cutPipe) cutWhole = cutCount;   // (a build whose cut pipeline failed to compile draws the cut boxes WHOLE with this one — wrong at the cut, never missing)
    pass.draw(36, visibleCount + cutWhole);   // `cutWhole` = the first so-many of the cut list drawn as their whole boxes: the traceable ones, on a frame whose ray programs have no cut rule (render/cutSwap.ts — picture and rays agree)
    if (cutCount > cutWhole) { pass.setPipeline(this.cutPipe!); pass.draw(36 + 6 * CUT_ROWS, cutCount - cutWhole, 0, visibleCount + cutWhole); }   // CUT BOXES: listed after the plain ones in `visible` (BoxWorld.visibleCutCount); six faces + a quad per plane
    if (skin && skin.instanceCount > 0) {
      pass.setPipeline(this.skinPipe(skin.jointsFormat));
      pass.setVertexBuffer(0, skin.vertexBuf); pass.setVertexBuffer(1, skin.jointBuf); pass.setVertexBuffer(2, skin.slotBuf);
      pass.setIndexBuffer(skin.indexBuf, skin.indexFormat);
      // THE CAST: a man is drawn as the index runs of the parts he wears (instance_index = his slot through firstInstance, so vsSkin reads the same CharInst). The triangles left out are
      // exactly the ones vsSkin would have collapsed outside the clip volume, and what is left goes down in the same order — instance by instance, ascending index — so the raster sees
      // the same triangles in the same sequence. Nobody with runs (the mannequin, mask 0) = the one instanced draw, as it always was.
      let whole = 0;   // (instances [i − whole, i) still owed as whole-mesh draws)
      for (let i = 0; i <= skin.instanceCount; i++) {
        const runs = i < skin.instanceCount ? skin.drawRuns?.(i) ?? null : null;
        if (i < skin.instanceCount && !runs) { whole++; continue; }
        if (whole > 0) { pass.drawIndexed(skin.indexCount, whole, 0, 0, i - whole); whole = 0; }
        if (runs) for (let k = 0; k < runs.length; k += 2) pass.drawIndexed(runs[k + 1], 1, runs[k], 0, i);
      }
    }
    pass.end();
  }

  /** At the tail of the frame's command buffer: copy this frame's box transforms (BoxWorld's geo + mat rows, as uploaded for THIS frame) and joint palette into the 'previous' buffers the next
   *  frame's vertex stages read. Queue writes for the next frame are ordered after this command buffer, so the copies see exactly what this frame drew. */
  snapshotPrev(enc: GPUCommandEncoder, world: BoxWorld, skin: SkinnedDrawable | null) {
    const n = world.all.length; if (n > 0) { enc.copyBufferToBuffer(world.geoBuf, 0, this.prevBoxes, 0, n * GEO_STRIDE * 4); enc.copyBufferToBuffer(world.matBuf, 0, this.prevBoxes, this.geoBytes, n * MAT_STRIDE * 4); }
    if (skin && this.prevJointsFor === skin.jointMats) enc.copyBufferToBuffer(skin.jointMats, 0, this.prevJoints, 0, skin.jointMats.size);
  }
}

const ids = new WeakMap<object, number>(); let nextId = 1;
function idOf(o: object): number { let v = ids.get(o); if (!v) { v = nextId++; ids.set(o, v); } return v; }
