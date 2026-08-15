// G-buffer targets + raster pipelines (boxes, skinned characters).
import { makeShader, makeBuffer, renderPipelineAsync } from '../gpu/device';
import { scenePrelude } from './frame';
import { decalWgslConsts } from './decals';
import { TexturePool } from './texpool';
import { BoxWorld, GEO_STRIDE, MAT_STRIDE } from '../scene/boxes';
import gbufSrc from './shaders/gbuffer.wgsl' with { type: 'text' };
import decalsSrc from './shaders/decals.wgsl' with { type: 'text' };
import detailSrc from './shaders/detail.wgsl' with { type: 'text' };   // the detail layer (renderer v3 phase 4): fsBox's wear / dust / edge terms + the traffic-map binding
import markingsSrc from './shaders/markings.wgsl' with { type: 'text' };   // the markings (scene/markings.ts): fsBox's pixel-art signifiers on box faces
import gdownSrc from './shaders/gdown.wgsl' with { type: 'text' };     // SHARP DIRECT: the internal-size view of an output-size raster (encodeDown)

export interface SkinnedDrawable {
  vertexBuf: GPUBuffer;      // interleaved: pos f32x3, normal f32x3, weights f32x4, matSel f32 (44 B)
  jointBuf: GPUBuffer;       // uint8x4 (4 B) or uint16x4 (8 B), see jointsFormat
  jointsFormat: GPUVertexFormat;
  indexBuf: GPUBuffer; indexCount: number; indexFormat: GPUIndexFormat;
  jointMats: GPUBuffer;      // array<mat4x4f>  (usage must include COPY_SRC: snapshotted into the g-buffer's previous-palette buffer each frame)
  charInsts: GPUBuffer;      // array<CharInst>
  instanceCount: number;
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

  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout, readonly pool: TexturePool = new TexturePool(device), maxBoxes = 4096) {
    this.geoBytes = maxBoxes * GEO_STRIDE * 4;
    const mod = makeShader(device, scenePrelude() + `const PREV_MAT_BASE: u32 = ${maxBoxes * GEO_STRIDE / 4}u;   // prevBoxes: vec4 index where the mat rows start (after maxBoxes geo rows of 2 vec4 each)\n` + decalWgslConsts(3) + decalsSrc + detailSrc + markingsSrc + gbufSrc, 'gbuffer');   // decals.wgsl: the experiment's per-pixel marks (group 1 binding 3), read by fsBox under FrameFlags.Decals
    this.objLayout = device.createBindGroupLayout({ label: 'gbufObj', entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'read-only-storage' } },   // the decal buffer (render/decals.ts): the fragment stage's 9th storage buffer where the scene group carries 8 (reach rows + mesh trees in storage) — inside the 10 Chrome offers on Metal, and 7 or 8 on adapters where frame.ts already fell back
      { binding: 4, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },   // prevBoxes (last frame's geo + mat rows) — the vertex stage's 6th storage buffer with the scene group's two …
      { binding: 5, visibility: GPUShaderStage.VERTEX, buffer: { type: 'read-only-storage' } },   // … and prevJoints its 7th (of the WebGPU default 8)
      { binding: 6, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float', viewDimension: '2d' } },   // the traffic map the detail layer reads (rg8unorm over the world's XZ; a 1×1 zero until a level hands one over — setWearMap)
    ] });
    const layout = this.pipeLayout = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.objLayout] });
    const targets: GPUColorTargetState[] = this.targets = [{ format: 'rgba8unorm' }, { format: 'rgb10a2unorm' }, { format: 'r32uint' }, { format: 'rg16float' }, { format: 'rg8unorm' }, { format: 'rg8unorm' }];   // (+ the material and GBAA edge targets: 8 + 8 + 4 + 4 + 2 + 2 = 28 bytes per sample of the 32 the default limits allow, by WebGPU's attachment accounting — rgba8 / rgb10a2 count 8 each)
    const depthStencil: GPUDepthStencilState = this.depthStencil = { format: 'depth32float', depthWriteEnabled: true, depthCompare: 'less' };
    this.mod = mod;   // (the box pipeline: init(), awaited by the engine before the first frame)
    const S = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
    this.prevBoxes = makeBuffer(device, maxBoxes * (GEO_STRIDE + MAT_STRIDE) * 4, S, 'prevBoxes');
    this.prevJoints = makeBuffer(device, 256, S, 'prevJointsDummy');   // (replaced by one the size of the skin's palette the first time a skin is drawn)
    this.wearTex = device.createTexture({ label: 'wearNone', size: [1, 1], format: 'rg8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    device.queue.writeTexture({ texture: this.wearTex }, new Uint8Array([0, 0]), { bytesPerRow: 2 }, [1, 1]);
    this.wearView = this.wearTex.createView();
  }
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
    const jm = skin?.jointMats ?? dummy, ci = skin?.charInsts ?? dummy;
    const key = `${idOf(visibleBuf)}:${idOf(jm)}:${idOf(ci)}:${idOf(decalBuf)}:${idOf(this.prevJoints)}:${idOf(this.wearTex)}`;
    if (this.objBG && this.objBGKey === key) return this.objBG;
    this.objBG = this.device.createBindGroup({ layout: this.objLayout, entries: [
      { binding: 0, resource: { buffer: visibleBuf } }, { binding: 1, resource: { buffer: jm } }, { binding: 2, resource: { buffer: ci } }, { binding: 3, resource: { buffer: decalBuf } },
      { binding: 4, resource: { buffer: this.prevBoxes } }, { binding: 5, resource: { buffer: this.prevJoints } }, { binding: 6, resource: this.wearView },
    ] });
    this.objBGKey = key; return this.objBG;
  }

  /** decalBuf: the decal buffer (Decals.buf), or any storage buffer while none is attached — it is only read under FrameFlags.Decals, which the engine never raises then */
  encode(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, visibleBuf: GPUBuffer, visibleCount: number, skin: SkinnedDrawable | null, dummy: GPUBuffer, decalBuf: GPUBuffer, ts?: GPURenderPassTimestampWrites) {
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
    pass.setPipeline(this.boxPipe);
    pass.draw(36, visibleCount);
    if (skin && skin.instanceCount > 0) {
      pass.setPipeline(this.skinPipe(skin.jointsFormat));
      pass.setVertexBuffer(0, skin.vertexBuf); pass.setVertexBuffer(1, skin.jointBuf);
      pass.setIndexBuffer(skin.indexBuf, skin.indexFormat);
      pass.drawIndexed(skin.indexCount, skin.instanceCount);
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
