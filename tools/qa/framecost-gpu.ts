// framecost-gpu — THE GPU HALF OF A FRAME, COUNTED (not timed): the real Engine (src/engine.ts), the real smoke solver and the page's quality preset stood on a RECORDING WebGPU
// device, wired as src/main.ts wires them, and driven by the same scripted play the CPU table is taken on. There is no graphics card behind it — nothing is compiled, nothing is
// shaded, no number here is a millisecond of GPU time. What it gives is the work a frame ASKS of a GPU, as the engine itself encodes it:
//   · every compute / render pass that ran, how often, its dispatched threads (workgroups × the kernel's @workgroup_size, read from the WGSL handed to createShaderModule) or its
//     target's texels, draws and triangles;
//   · every buffer the CPU rewrote (queue.writeBuffer / writeTexture) by label, bytes and calls a frame;
//   · the textures and buffers alive (bytes by format × size) and how many GPU objects a frame creates (bind groups, buffers, textures — the churn);
//   · the scene the frame was asked to draw: boxes, lights, characters and their triangles / joints, particles, decals, smoke domains, glass cells;
// and, because the engine's CPU half really runs (packing, uniforms, light / character / decal / particle uploads, pass encoding), the CPU cost of Engine.render and of the smoke
// solver's update — the part of a page frame the stub harness never executes.
//
// HOW (no file under src/ is edited): tools/qa/framecost-hooks.ts, with FC_GPU=1, rewrites tools/qa/headless.ts as it loads so standUp() takes its engine and smoke from here
// instead of the stub, and steps a frame in the page's order (game.update → smoke.update → camera → lights.update → Engine.render); it rewrites `window.devicePixelRatio` in
// src/engine.ts to a global this file sets. The readbacks never answer (mapAsync stays pending, as with the stub), so the light meter and smoke sight lines read as in every other
// headless run. Known consequences, said on the page: a smoke domain's mass never comes back, so it retires 4 s after its last emit instead of when it has thinned (≤ 40 s) — the
// live-domain count here is a LOWER bound; the auto quality ladder never moves (the preset is pinned, as under ?quality=).
//
// View: FC_VIEW=<cssW>x<cssH>@<dpr> (default 1728x1000@2 — a 16-inch MacBook Pro's browser window, an ASSUMPTION), FC_QUALITY=high (the preset pinned), FC_GPU_OUT=<file>.
import '../../src/host/gpuEnums';

type AnyObj = Record<string, any>;
const G = globalThis as AnyObj;

const BPP: Record<string, number> = { r8unorm: 1, r8uint: 1, r8snorm: 1, rg8unorm: 2, rg8uint: 2, r16float: 2, r16uint: 2, rgba8unorm: 4, 'rgba8unorm-srgb': 4, bgra8unorm: 4, rgba8uint: 4, rgba8snorm: 4, rg16float: 4, rg16uint: 4, r32float: 4, r32uint: 4,
  rg11b10ufloat: 4, rgb10a2unorm: 4, rgb9e5ufloat: 4, depth32float: 4, depth24plus: 4, 'depth24plus-stencil8': 4, depth16unorm: 2, rgba16float: 8, rgba16uint: 8, rg32float: 8, rg32uint: 8, rgba32float: 16, rgba32uint: 16 };

interface PassRec { kind: 'compute' | 'render'; n: number; frames: number; lastFrame: number; groups: number; threads: number; texels: number; draws: number; tris: number; maxThreads: number; cur: number }
interface WriteRec { n: number; bytes: number; frames: number; lastFrame: number; cur: number; max: number }
export const REC = {
  on: false, frame: 0, frames: 0,
  passes: new Map<string, PassRec>(), kernels: new Map<string, { n: number; threads: number }>(), writes: new Map<string, WriteRec>(),
  // per-frame scalars, summed (÷ frames) and their maxima
  sum: {} as Record<string, number>, max: {} as Record<string, number>, cur: {} as Record<string, number>,
  texBytes: 0, texPeak: 0, bufBytes: 0, bufPeak: 0, tex: new Map<number, { label: string; bytes: number; desc: string }>(), unknownFormats: new Set<string>(), noWg: new Set<string>(),
  /** pipelines asked for DURING the play: a play-through never yields, so their promises never land and the pass that waits on one never runs here (on the page it arrives a frame or two later) */
  latePipes: new Set<string>(),
  bump(k: string, v = 1) { if (this.on) this.cur[k] = (this.cur[k] ?? 0) + v; },
  endFrame() {
    if (!this.on) return;
    for (const k in this.cur) { const v = this.cur[k]; this.sum[k] = (this.sum[k] ?? 0) + v; if (v > (this.max[k] ?? 0)) this.max[k] = v; this.cur[k] = 0; }
    for (const p of this.passes.values()) { if (p.cur > p.maxThreads) p.maxThreads = p.cur; p.cur = 0; }
    for (const w of this.writes.values()) { if (w.cur > w.max) w.max = w.cur; w.cur = 0; }
    this.frames++; this.frame++;
  },
};
let serial = 1;
const sizeOf = (s: any): [number, number, number] => Array.isArray(s) ? [s[0] ?? 1, s[1] ?? 1, s[2] ?? 1] : [s.width ?? 1, s.height ?? 1, s.depthOrArrayLayers ?? 1];

class MTexture {
  id = serial++; label: string; width: number; height: number; depthOrArrayLayers: number; format: string; dimension: string; usage: number; mipLevelCount: number; sampleCount = 1; bytes: number; dead = false;
  constructor(d: AnyObj, track = true) {
    const [w, h, z] = sizeOf(d.size); this.label = d.label ?? ''; this.width = w; this.height = h; this.depthOrArrayLayers = z; this.format = d.format; this.dimension = d.dimension ?? '2d'; this.usage = d.usage ?? 0; this.mipLevelCount = d.mipLevelCount ?? 1;
    const bpp = BPP[d.format]; if (bpp === undefined) REC.unknownFormats.add(String(d.format));
    this.bytes = w * h * z * (bpp ?? 4) * (this.mipLevelCount > 1 ? 4 / 3 : 1);
    if (track) { REC.texBytes += this.bytes; if (REC.texBytes > REC.texPeak) REC.texPeak = REC.texBytes; REC.tex.set(this.id, { label: this.label, bytes: this.bytes, desc: `${w}×${h}${z > 1 ? '×' + z : ''} ${d.format}` }); REC.bump('texturesCreated'); }
  }
  createView(d?: AnyObj) { return { texture: this, label: d?.label ?? this.label, desc: d }; }
  destroy() { if (this.dead) return; this.dead = true; if (REC.tex.delete(this.id)) REC.texBytes -= this.bytes; }
}
class MBuffer {
  id = serial++; label: string; size: number; usage: number; mapState = 'unmapped'; dead = false; private mapped: ArrayBuffer | null = null;
  constructor(d: AnyObj) { this.label = d.label ?? ''; this.size = d.size; this.usage = d.usage ?? 0; if (d.mappedAtCreation) { this.mapped = new ArrayBuffer(d.size); this.mapState = 'mapped'; } if (this.usage & 1) { REC.bump('readbackBuffersCreated'); return; }   // (MAP_READ: the readback pools refill only when a map resolves, and none does here — on the page these are reused, so they are counted apart and kept out of the totals)
    REC.bufBytes += this.size; if (REC.bufBytes > REC.bufPeak) REC.bufPeak = REC.bufBytes; REC.bump('buffersCreated'); }
  getMappedRange(off = 0, size?: number) { this.mapped ??= new ArrayBuffer(this.size); return off === 0 && size === undefined ? this.mapped : this.mapped.slice(off, size === undefined ? undefined : off + size); }
  unmap() { this.mapped = null; if (this.mapState === 'mapped') this.mapState = 'unmapped'; }
  mapAsync() { this.mapState = 'pending'; return new Promise<void>(() => { /* never: no readback answers here, as with the stub */ }); }
  destroy() { if (this.dead) return; this.dead = true; if (!(this.usage & 1)) REC.bufBytes -= this.size; }
}
/** @workgroup_size of `entry` in a WGSL source: literals, or module consts that are literals; null when it cannot be read */
function workgroup(code: string, entry: string): number | null {
  const m = new RegExp('@workgroup_size\\s*\\(([^)]*)\\)\\s*(?:@compute\\s*)?fn\\s+' + entry + '\\b').exec(code); if (!m) return null;
  let n = 1;
  for (const a of m[1].split(',')) {
    const t = a.trim(); if (!t) continue;
    let v = /^\d+u?$/.test(t) ? parseInt(t) : NaN;
    if (isNaN(v)) { const c = new RegExp('(?:const|override)\\s+' + t + '\\s*(?::\\s*\\w+)?\\s*=\\s*(\\d+)').exec(code); v = c ? parseInt(c[1]) : NaN; }
    if (isNaN(v)) return null; n *= v;
  }
  return n;
}
const passRec = (label: string, kind: 'compute' | 'render'): PassRec => {
  let p = REC.passes.get(label); if (!p) REC.passes.set(label, p = { kind, n: 0, frames: 0, lastFrame: -1, groups: 0, threads: 0, texels: 0, draws: 0, tris: 0, maxThreads: 0, cur: 0 });
  p.n++; if (p.lastFrame !== REC.frame) { p.frames++; p.lastFrame = REC.frame; }
  return p;
};
const NOREC: PassRec = { kind: 'compute', n: 0, frames: 0, lastFrame: -1, groups: 0, threads: 0, texels: 0, draws: 0, tris: 0, maxThreads: 0, cur: 0 };
class MComputePass {
  private pipe: AnyObj | null = null;
  constructor(private rec: PassRec, private label: string) { }
  setPipeline(p: AnyObj) { this.pipe = p; }
  setBindGroup() { }
  dispatchWorkgroups(x: number, y = 1, z = 1) {
    const g = x * y * z; const wg = this.pipe?.wg ?? null; const t = g * (wg ?? 1);
    const r = this.rec; r.groups += g; r.threads += t; r.cur += t;
    if (REC.on) { REC.bump('dispatches'); REC.bump('threads', t); const key = this.pipe?.label && this.pipe.label !== this.label ? `${this.label} · ${this.pipe.label}` : this.label; const k = REC.kernels.get(key); if (k) { k.n++; k.threads += t; } else REC.kernels.set(key, { n: 1, threads: t }); if (wg === null) REC.noWg.add(key); }
  }
  dispatchWorkgroupsIndirect() { if (REC.on) REC.bump('dispatchesIndirect'); }
  end() { } pushDebugGroup() { } popDebugGroup() { } insertDebugMarker() { }
}
class MRenderPass {
  constructor(private rec: PassRec) { }
  setPipeline() { } setBindGroup() { } setVertexBuffer() { } setIndexBuffer() { } setViewport() { } setScissorRect() { } setBlendConstant() { } setStencilReference() { }
  draw(vc: number, ic = 1) { const r = this.rec; r.draws++; r.tris += vc / 3 * ic; if (REC.on) { REC.bump('draws'); REC.bump('tris', vc / 3 * ic); } }
  drawIndexed(n: number, ic = 1) { const r = this.rec; r.draws++; r.tris += n / 3 * ic; if (REC.on) { REC.bump('draws'); REC.bump('tris', n / 3 * ic); } }
  drawIndirect() { this.rec.draws++; } drawIndexedIndirect() { this.rec.draws++; }
  end() { } pushDebugGroup() { } popDebugGroup() { } insertDebugMarker() { }
}
class MEncoder {
  constructor(public label: string) { }
  beginComputePass(d?: AnyObj) { const label = d?.label || '(unlabelled compute)'; const r = REC.on ? passRec(label, 'compute') : NOREC; if (REC.on) REC.bump('computePasses'); return new MComputePass(r, label); }
  beginRenderPass(d: AnyObj) {
    const label = d?.label || '(unlabelled render)'; const r = REC.on ? passRec(label, 'render') : NOREC;
    const v = d.colorAttachments?.find((a: any) => a)?.view ?? d.depthStencilAttachment?.view; const t = v?.texture as MTexture | undefined;
    if (REC.on) { REC.bump('renderPasses'); if (t) { const px = t.width * t.height; r.texels += px; REC.bump('rasterTexels', px); } }
    return new MRenderPass(r);
  }
  copyBufferToBuffer(_s: any, _so: number, _d: any, _do: number, n: number) { REC.bump('copyBufBytes', n); }
  copyTextureToTexture(_s: any, _d: any, size: any) { const [w, h, z] = sizeOf(size); REC.bump('copyTexTexels', w * h * z); }
  copyTextureToBuffer() { } copyBufferToTexture() { }
  resolveQuerySet() { } clearBuffer() { } pushDebugGroup() { } popDebugGroup() { } insertDebugMarker() { }
  finish() { return { label: this.label }; }
}
function noteWrite(label: string, bytes: number) {
  if (!REC.on) return;
  let w = REC.writes.get(label); if (!w) REC.writes.set(label, w = { n: 0, bytes: 0, frames: 0, lastFrame: -1, cur: 0, max: 0 });
  w.n++; w.bytes += bytes; w.cur += bytes; if (w.lastFrame !== REC.frame) { w.frames++; w.lastFrame = REC.frame; }
  REC.bump('writeBytes', bytes); REC.bump('writeCalls');
}
const BYTES_PER = (d: any) => (d && d.BYTES_PER_ELEMENT) || 1;
function mockDevice() {
  const layout = (label?: string) => ({ label: label ?? '' });
  const pipeline = (d: AnyObj, compute: boolean) => {
    let wg: number | null = null;
    if (compute) { const code = d.compute?.module?.code ?? ''; wg = workgroup(code, d.compute?.entryPoint ?? 'main'); }
    return { label: d.label ?? '', wg, getBindGroupLayout: (i: number) => layout(`${d.label ?? ''}#bgl${i}`) };
  };
  const queue = {
    writeBuffer(buf: MBuffer, _off: number, data: any, dataOff?: number, size?: number) {
      // size / dataOff are in ELEMENTS for a typed array, bytes for an ArrayBuffer (the WebGPU rule)
      const per = ArrayBuffer.isView(data) ? BYTES_PER(data) : 1; const total = data.byteLength;
      const n = size !== undefined ? size * per : total - (dataOff ?? 0) * per;
      noteWrite(buf.label || `(buffer ${buf.size} B)`, n);
    },
    writeTexture(dst: AnyObj, data: any) { noteWrite('texture: ' + (dst.texture?.label || '(unlabelled)'), data.byteLength ?? 0); },
    copyExternalImageToTexture() { },
    submit() { REC.bump('submits'); },
    onSubmittedWorkDone() { return Promise.resolve(); },
  };
  return {
    label: 'recording device', queue,
    features: new Set(['timestamp-query', 'float32-filterable']),
    limits: { maxStorageBuffersPerShaderStage: 10, maxStorageTexturesPerShaderStage: 8, maxSampledTexturesPerShaderStage: 16, maxStorageBufferBindingSize: 1 << 30, maxBufferSize: 1 << 30, maxComputeInvocationsPerWorkgroup: 1024, maxComputeWorkgroupSizeX: 1024,
      maxComputeWorkgroupSizeY: 1024, maxComputeWorkgroupSizeZ: 64, maxColorAttachmentBytesPerSample: 64, maxTextureDimension2D: 16384, maxTextureDimension3D: 2048, maxBindGroups: 4, maxColorAttachments: 8, maxUniformBufferBindingSize: 65536,
      maxComputeWorkgroupsPerDimension: 65535, maxBindingsPerBindGroup: 1000, maxSamplersPerShaderStage: 16, maxUniformBuffersPerShaderStage: 12, maxVertexBuffers: 8, maxVertexAttributes: 30 },
    lost: new Promise(() => { }),
    addEventListener() { }, removeEventListener() { }, pushErrorScope() { }, popErrorScope: () => Promise.resolve(null), destroy() { },
    createBuffer: (d: AnyObj) => new MBuffer(d),
    createTexture: (d: AnyObj) => new MTexture(d),
    createSampler: (d?: AnyObj) => ({ label: d?.label ?? '' }),
    createShaderModule: (d: AnyObj) => ({ label: d.label ?? '', code: d.code as string, getCompilationInfo: () => Promise.resolve({ messages: [] }) }),
    createBindGroupLayout: (d: AnyObj) => layout(d.label),
    createPipelineLayout: (d: AnyObj) => layout(d.label),
    createBindGroup: (d: AnyObj) => { REC.bump('bindGroupsCreated'); return { label: d.label ?? '' }; },
    createComputePipeline: (d: AnyObj) => pipeline(d, true),
    createComputePipelineAsync: (d: AnyObj) => { if (REC.on) REC.latePipes.add(d.label ?? '(unlabelled)'); return Promise.resolve(pipeline(d, true)); },
    createRenderPipeline: (d: AnyObj) => pipeline(d, false),
    createRenderPipelineAsync: (d: AnyObj) => { if (REC.on) REC.latePipes.add(d.label ?? '(unlabelled)'); return Promise.resolve(pipeline(d, false)); },
    createQuerySet: (d: AnyObj) => ({ label: d.label ?? '', count: d.count, destroy() { } }),
    createCommandEncoder: (d?: AnyObj) => { REC.bump('encoders'); return new MEncoder(d?.label ?? ''); },
  };
}

// ---- the stand-up, as src/main.ts does it ----
const VIEW = /^(\d+)x(\d+)@([\d.]+)$/.exec(process.env.FC_VIEW ?? '') ?? ['', '1728', '1000', '2'];
const CSSW = +VIEW[1], CSSH = +VIEW[2], DPR = +VIEW[3];
const QUALITY = process.env.FC_QUALITY || 'high';
G.__FC_DPR = DPR;
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
let quality: AnyObj | null = null;
const scene = { sum: {} as Record<string, number>, max: {} as Record<string, number>, n: 0, last: {} as Record<string, number>, chars: null as AnyObj | null };
const noteScene = (o: Record<string, number>) => { for (const k in o) { const v = o[k]; if (!isFinite(v)) continue; scene.sum[k] = (scene.sum[k] ?? 0) + v; if (v > (scene.max[k] ?? -1)) scene.max[k] = v; } scene.last = o; scene.n++; };
let tRender = 0, tSmoke = 0, nFrame = 0; const WARM_FRAMES = 60;

export const FCG = {
  REC, view: { cssW: CSSW, cssH: CSSH, dpr: DPR, quality: QUALITY },
  /** the engine standUp() takes instead of stubHost(): a real Engine on the recording device */
  async engine(): Promise<any> {
    // the scene prelude's compile-time switches, raised before the Engine exists as src/main.ts does: glass that breaks (engine.glassFracture, which game/glassbreak.ts asks for) and the weather kinds
    const frameMod = await import(`${ROOT}/src/render/frame.ts`);
    if (process.env.GLASSFX === 'on' && process.env.GLASSBREAK !== 'off') frameMod.glassBreakConfig.on = true;
    if (process.env.FC_WEATHER === '1') frameMod.weatherKindConfig.on = true;
    const { Engine } = await import(`${ROOT}/src/engine.ts`);
    const device = mockDevice() as any;
    const canvas = { clientWidth: CSSW, clientHeight: CSSH, width: CSSW * DPR, height: CSSH * DPR, style: {} };
    const backbuffer = { tex: null as MTexture | null };
    const ctx = { configure() { }, getCurrentTexture() { const b = backbuffer.tex; if (b && b.width === canvas.width && b.height === canvas.height) return b; return backbuffer.tex = new MTexture({ label: 'canvas', size: [canvas.width, canvas.height], format: 'bgra8unorm' }, false); } };
    const gpu = { device, canvas, ctx, format: 'bgra8unorm', adapterInfo: 'recording device (no GPU)', hasTimestamps: true, linearSampler: device.createSampler({}) };
    const engine = new Engine(gpu);
    (engine as any).__init = engine.init({ sharp: true, gbaa: true });
    return engine;
  },
  /** the smoke solver standUp() takes instead of nullSmoke() */
  async smoke(engine: any): Promise<any> {
    const { SmokeSystem } = await import(`${ROOT}/src/smoke/smoke.ts`);
    const smoke = new SmokeSystem(engine); engine.setSmoke(smoke.binding);
    (smoke as any).__init = smoke.init();
    return smoke;
  },
  /** after standGame: the probe's pass and the readbacks' hooks, every pipeline awaited, the preset pinned */
  async ready(W: any): Promise<void> {
    const { engine, game, smoke, level } = W;
    if (!process.env.PT_HOUR || process.env.PT_HOUR === 'night') { engine.settings.skyZenith = level.sky.zenith; engine.settings.skyHorizon = level.sky.horizon; }   // (another hour: standGame's applyHour has already written that hour's sky — left alone)
    engine.fogFrame = game.fogOfWar?.frame;   // the fog of war's pass reads the game's FogFrame (main.ts)
    const probe = game.probe;
    engine.extraPasses.push((enc: any, sceneBG: any, diceView: any, ts: any) => { if (probe.hasPending) probe.encode(enc, sceneBG, diceView, ts('probe')); });
    engine.afterSubmit.push(() => probe.afterSubmit());
    engine.afterSubmit.push(() => smoke.afterSubmit());
    await Promise.all([engine.__init, smoke.__init, game.meshShadows?.init?.(), engine.particles?.init?.(), probe.init?.(), engine.gbuffer.prepareSkin(game.chars.jointsFormat)]);
    const Q = await import(`${ROOT}/src/ui/quality.ts`);
    quality = new Q.Quality(engine, smoke); quality!.auto = false; quality!.climbAllowed = false; quality!.apply(QUALITY); quality!.applyMotionCalm(true);
    const m = game.chars?.ch?.mesh; const sk = game.chars?.ch?.skin;
    // PIPELINES THE ENGINE COMPILES ON FIRST USE (the fog of war's pass, the denoiser's internal-res clients): on the page each lands a
    // frame or two after it is first wanted; a play-through's loop never yields to let a promise land, so they are asked for HERE and a few frames rendered with a yield after each
    try { const { FogPass } = await import(`${ROOT}/src/render/fogofwar.ts`); const P = engine.passes as any; P.fogPass ??= new FogPass(P.device, P.sceneLayout); P.fogPass.build?.(); } catch (e) { console.error('framecost-gpu: fog pass not pre-built', e); }
    for (let i = 0; i < 4; i++) { try { engine.world.dynamics = game.dynBoxes ?? []; engine.render(W.cam, game.time, 1 / 60, true); } catch (e) { console.error('framecost-gpu: warm render threw', e); break; } await new Promise(r => setTimeout(r, 0)); }
    scene.chars = { model: game.chars?.ch?.cast ? 'cast' : 'mannequin' /* (read off the mesh that was loaded: on the shipped stand the cast comes with no TPS_CAST word) */, vertices: m?.vertexCount ?? null, triangles: m ? m.indices.length / 3 : null, joints: sk?.joints?.length ?? sk?.jointCount ?? null, parts: game.chars?.ch?.cast?.parts?.length ?? null };
  },
  /** one frame's engine half, in the page's order after game.update: smoke.update → camera → lights.update → Engine.render (which packs the box list itself) */
  frame(W: any, dt: number, follow: any): void {
    const { engine, game, smoke, cam } = W;
    if (nFrame++ === WARM_FRAMES) REC.on = true;   // (the first frames make every target and bind group and write the one-off tables: left out, as the timings' warm frames are)
    const FC = G.__FC;
    FC?.m?.(FC.B_SMOKE); const t0 = performance.now();
    smoke.update(dt); const t1 = performance.now(); tSmoke += t1 - t0;
    FC?.m?.(FC.B_CAM);
    cam.update(dt, follow ?? game.followPos(), follow || game.spectate >= 0 ? null : game.aimPoint);
    FC?.m?.(FC.B_LIGHTS);
    engine.lights.update(dt, game.time);
    engine.world.dynamics = game.dynBoxes;
    FC?.m?.(FC.B_RENDER); const t2 = performance.now();
    engine.render(cam, game.time, dt, true); tRender += performance.now() - t2;
    const S = engine.settings;
    if (REC.on) noteScene({
      boxesStatic: engine.world.statics?.length ?? NaN, boxesDynamic: game.dynBoxes?.length ?? NaN, lights: engine.lights.activeCount, lightsAll: engine.lights.lights.length,
      characters: game.chars?.instanceCount ?? NaN, particlesLive: engine.particles?.liveSlots ?? NaN, decals: engine.decals?.stats?.count ?? NaN,
      smokeBricks: smoke.stats?.pool ?? NaN, smokeEmitters: smoke.emitters?.length ?? NaN,
      glassPanes: engine.world.glassList?.length ?? NaN, glassPanesBroken: game.glassBreak?.panes?.size ?? NaN, debris: game.destr?.debris?.list?.length ?? NaN,
      internalW: engine.width, internalH: engine.height, outW: engine.outWidth, outH: engine.outHeight, renderScale: S.renderScale,
    });
    REC.endFrame();
  },
  report(): AnyObj {
    const f = Math.max(1, REC.frames);
    const passes = [...REC.passes.entries()].map(([label, p]) => ({ label, kind: p.kind, perFrame: p.n / f, onFrames: p.frames / f, threads: p.threads / f, threadsMax: p.maxThreads, groups: p.groups / f, texels: p.texels / f, draws: p.draws / f, tris: p.tris / f }));
    const kernels = [...REC.kernels.entries()].map(([label, k]) => ({ label, perFrame: k.n / f, threads: k.threads / f }));
    const writes = [...REC.writes.entries()].map(([label, w]) => ({ label, bytes: w.bytes / f, calls: w.n / f, onFrames: w.frames / f, max: w.max }));
    const mean: Record<string, number> = {}; for (const k in REC.sum) mean[k] = REC.sum[k] / f;
    const sc: Record<string, number> = {}; for (const k in scene.sum) sc[k] = scene.sum[k] / Math.max(1, scene.n);
    const tex = [...REC.tex.values()].sort((a, b) => b.bytes - a.bytes);
    const S = G.__FCG_W?.engine?.settings;
    return { v: 1, view: FCG.view, frames: REC.frames, passes, kernels, writes, perFrame: mean, perFrameMax: REC.max, scene: sc, sceneMax: scene.max, sceneLast: scene.last, chars: scene.chars,
      textures: { liveBytes: REC.texBytes, peakBytes: REC.texPeak, count: REC.tex.size, top: tex.slice(0, 40) }, buffers: { liveBytes: REC.bufBytes, peakBytes: REC.bufPeak },
      cpu: { renderMs: tRender / f, smokeMs: tSmoke / f }, unknownFormats: [...REC.unknownFormats], noWorkgroupSize: [...REC.noWg], latePipes: [...REC.latePipes],
      settings: S ? JSON.parse(JSON.stringify(S, (_k, v) => (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string' || (v && typeof v === 'object' && !ArrayBuffer.isView(v))) ? v : undefined)) : null };
  },
};
G.__FCG = FCG;
