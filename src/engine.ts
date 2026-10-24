// Renderer orchestration: owns GPU resources and encodes the frame.
import { Gpu, makeBuffer } from './gpu/device';
import { GpuTimer } from './gpu/timer';
import { BoxWorld } from './scene/boxes';
import { thinIs, thinAirOf } from './game/thinline';   // (a leaf: types only — which dynamic boxes are a laser's beam / a tracer's streak, for the reflections)
import { FRAME_BYTES, MAX_CARDS, FrameFlags, FrameParams, createSceneBindGroup, createSceneLayout, writeFrame, writeFrameOut, reachBinding, meshBinding, WeatherFrame, noWeather, glassBreakConfig } from './render/frame';
import { GBuffer, SkinnedDrawable } from './render/gbuffer';
import { RadianceCascades, RcConfig, defaultRcConfig } from './render/rc';
import { LightingPasses, type FireRecord } from './render/passes';
import { LightSet, cardSlotsFor } from './render/lights';
import { MeshShadows, MESH_MAX_CHARS } from './render/meshShadows';
import { RigFit, RIG_KPAD } from './render/sdfrig';
import { Decals } from './render/decals';
import { Particles } from './render/particles';
import { cutSwap } from './render/cutSwap';
import { TexturePool } from './render/texpool';
import { reachLevel } from './render/reach';
import { WORLD } from './scene/world';
import { FollowCamera } from './game/camera';
import { Vec3, m4, v3 } from './math/vec';

import { RenderSettings, defaultSettings } from './settings';
import { FogSight, FOG_SIGHT_BYTES, type FogFrame } from './render/fogofwar';
import { outlineBoxes, type OutlineFrame } from './render/outline';
export type { RenderSettings } from './settings';
export { defaultSettings } from './settings';

/** the identity of a cascade GRID (what needs its own buffers / dice volume): probe counts, directions, cascade count — the interval length is a live uniform (RadianceCascades.setInterval0) */
const rcGridKey = (c: RcConfig) => `${c.nx}x${c.ny}x${c.nz}/d${c.d0}/c${c.cascades}`;

/** What the renderer needs from the smoke sim (smoke/smoke.ts; the readers are shaders/smoke_read.wgsl): the table of loose bounds round the smoke (uniform, eight records), the brick atlas,
 *  the page texture that says which brick is where (scene binding 14), how many bound records to walk (0 = no smoke), and the sim's encoder. */
export interface SmokeBinding { uniform: GPUBuffer; atlasView: GPUTextureView; pageView: GPUTextureView; count: number; /** look only (smoke/dustTint.ts): some brick holds destruction dust → the volumetric pass runs its dust twin */ dusty?: boolean; encode?: (enc: GPUCommandEncoder, ts: (n: string) => GPUComputePassTimestampWrites | undefined) => void; }

/** glassLightMasks' sample lattice: three stations along a pane × a cell just off either face (module consts — review R1.4: no per-light-per-pane literals) */
const GLASS_STATIONS: readonly number[] = [-0.7, 0, 0.7], GLASS_SIDES: readonly number[] = [-0.55, 0.55];

export class Engine {
  device: GPUDevice;
  world: BoxWorld;
  lights: LightSet;
  rc: RadianceCascades;
  gbuffer: GBuffer;
  passes: LightingPasses;
  timer: GpuTimer;
  /** the render-target pool the g-buffer and the lighting passes share (render/texpool.ts): a size the adaptive ladder returns to costs no allocation */
  pool: TexturePool;
  sceneLayout: GPUBindGroupLayout;
  sceneBG: GPUBindGroup | null = null;
  frameBuf: GPUBuffer; frameData = new ArrayBuffer(FRAME_BYTES);
  /** HostApi.glassFracture: the shaders this page compiled draw the fracture model (the boot-time prelude const) */ readonly glassFracture: boolean = glassBreakConfig.on;
  /** SHARP DIRECT this frame (settings.sharpDirect ∧ TAAU ∧ no debug view ∧ internal ≠ output — resize decides), the OUTPUT frame block (the same bytes with screen = the output size: frame.ts writeFrameOut)
   *  and its scene group, group 0 of every pass that runs at the output size then */
  sharpOn = false; frameBufOut: GPUBuffer; frameDataOut = new ArrayBuffer(FRAME_BYTES); sceneBGOut: GPUBindGroup | null = null;
  /** FOG OF WAR (game/fogofwar.ts fills it every frame; main.ts hands the game's object over once): null / `on` false = no pass, the frame as it was */
  fogFrame: FogFrame | null = null;
  /** THE OPEN FIRES to draw this frame (game/fire.ts writes the list every update; empty = none): the composite adds each one's flame, coals and the smoke off its tips (passes.setFires; its embers are particles) */
  fires: FireRecord[] = [];
  /** the look's numbers every fire is drawn with (game/fire.ts fireDraws; fire.wgsl FireLook's twelve, in order); null = none said yet */
  fireLook: number[] | null = null;
  /** the outline in the dark (render/outline.ts): the host's frame for it, null = never asked. Written by the host once a frame (ui/findme.ts findMeOutline);
   *  render() adds the box on the picture its own camera gives and the exposure */
  outline: OutlineFrame | null = null;
  /** … its SIGHT TABLE (render/fogofwar.ts FogSight — the scene group's binding 11; dispatched at the head of a frame only while the game asks for the full
   *  picture under the fog), the 1 × 1 stand-in the table's own pass is bound with, and that pass's scene group (every resource sceneBG's but binding 11) */
  fogSight: FogSight; private fogSightStand: GPUBuffer; private sceneBGPlain: GPUBindGroup | null = null;
  dummyStorage: GPUBuffer;
  smoke: SmokeBinding;
  settings: RenderSettings = defaultSettings();
  /** what the weather wants drawn in the outdoor air this frame (game/weather.ts writes it before render; all zero = nothing, the default) */
  weather: WeatherFrame = noWeather();
  /** the view's look-at point as of the last render() (the smoke solver spends its pool by distance from it — smoke.ts sparse.viewBias / farCells) */
  viewFocus: Vec3 = [0, 0, 0];
  frameIdx = 0;
  /** effectiveScale = internal height / (CSS height × dpr), the true pixel ratio (the cost model's unit; = capScale × renderScale); capScale = min(1, maxInternalHeight / (CSS height × dpr)),
   *  what renderScale 1.0 gets on this window */
  effectiveScale = 1; capScale = 1; lastDt = 1 / 60;
  /** internal (render) size — what the g-buffer and every lighting pass run at */
  width = 0; height = 0;
  /** OUTPUT size = the canvas backing store: with TAAU the cap's rows (min(maxInternalHeight, CSS height × dpr)) whatever the render scale — the resolve upsamples internal → this and the
   *  bloom / tonemap / sharpen run here; without it = the internal size, as it always was */
  outWidth = 0; outHeight = 0;
  // ---- TAAU bookkeeping (see RenderSettings.taau): this frame's jitter, the jittered matrices the frame uniform carries, and what the NEXT frame reprojects with
  /** this frame's jitter in internal pixels (0, 0 with TAAU off, under a debug view, or with taauPhases 0) */
  jitter: [number, number] = [0, 0];
  /** the previous render's jitter (frame.jitter.zw: a history keyed on the unjittered pixel — the gather's reservoirs — takes both jitters out of its reprojection) */
  private prevJitter: [number, number] = [0, 0];
  private vpJ = m4.create(); private invVpJ = m4.create();
  /** the previous RENDER's jittered / unjittered view-projection (what its depth and histories were made with) and camera pose (cut detection); valid once havePrev */
  private prevVpJ = m4.create(); private prevVpU = m4.create(); private prevCamPos: Vec3 = [0, 0, 0]; private prevCamFwd: Vec3 = [0, 0, -1]; private havePrev = false;
  /** the unjittered camera moved since the last render (direct-motion lane: passes.restirMotionLive keys on it) */
  camMovedAny = false;
  private taauWas = false; private debugWas = 0;
  /** GI in motion: frames left in which the young-history extra gather rays stand down after a cut / a wholesale history restart, and the denoiser core last frame ran with */
  private giCutHold = 0; private dnWas: 'v3' | 'legacy' = 'v3';
  /** why the TAAU history was last dropped, and how many times (the Tab panel words it; QA counts it) */
  taaResets = 0; lastTaaReset = '';
  /** CUT BOXES: how many traceable cut boxes this frame's g-buffer draws WHOLE (its ray programs have no cut rule yet — render/cutSwap.ts), and how many were on screen last frame */
  cutWhole = 0; private cutSeen = 0;
  /** Drop the TAAU history: the next resolve takes this frame's picture outright (a camera cut nobody could reproject across). The engine calls it itself on a jump of the eye
   *  (> 2.5 m or > 30° between two renders), when TAAU or a debug view switches, and on the first frame; game code may call it for cuts it knows about (harmless twice). */
  resetTaa(reason = 'by hand') { this.passes.resetTaa(); this.taaResets++; this.lastTaaReset = reason; }
  /** radical-inverse (Halton) of i in base b */
  private static halton(i: number, b: number) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
  skin: SkinnedDrawable | null = null;
  /** mesh-shadow trees for the skinned characters (attached by whoever owns the CharacterRenderer: game.ts / the viewer); bound at scene binding 13 */
  meshShadows: MeshShadows | null = null;
  /** the decal list (experiment E1, render/decals.ts — owned by the Game, which feeds it; null in the viewer): synced + uploaded each frame before the g-buffer, which
   *  reads it at its group 1 binding 3 under FrameFlags.Decals */
  decals: Decals | null = null;
  /** the GPU particle system (render/particles.ts; attached by game.ts — the viewer has none): stepped after the cascades, drawn into the HDR target after the composite while settings.gpuParticles is on */
  particles: Particles | null = null;
  /** measurement only: timestamp the particles' render pass as 'pdraw' (render-pass timings are unreliable on Metal and feed every GPU total — leave off) */
  particlesTimeDraw = false;
  /** false when this adapter's storage-buffer budget left no slot for the mesh binding (frame.ts meshBinding): settings.meshShadows is then inert */
  readonly meshShadowsAvailable: boolean;
  cpuMs = { boxes: 0, encode: 0 };
  /** extra GPU work encoded after lighting (irradiance probes etc.): (enc, sceneBG, diceView, ts) */
  extraPasses: ((enc: GPUCommandEncoder, sceneBG: GPUBindGroup, diceView: GPUTextureView, ts: (n: string) => GPUComputePassTimestampWrites | undefined) => void)[] = [];
  afterSubmit: (() => void)[] = [];

  constructor(public gpu: Gpu, rcCfg: RcConfig = defaultRcConfig) {
    const device = this.device = gpu.device;
    const maxStorage = device.limits.maxStorageBuffersPerShaderStage;
    if (maxStorage < 9) reachBinding.storage = false;   // the per-light reach rows: storage by default (measured cheaper), the uniform binding when this adapter cannot afford a 9th storage buffer in the compute stage — decided HERE so the viewer and every other Engine user get the same fallback (main.ts only adds ?reachUniform for A/B)
    if (maxStorage < 8) throw new Error(`This GPU / browser exposes ${maxStorage} storage buffers per shader stage; the renderer needs 8 (scene group 6 + the cascade trace's / light probe's 2) — the WebGPU default, which every core (non-compatibility-mode) adapter provides.`);   // (readable on the #fatal card instead of a pipeline-creation failure deep in the pass graph; the per-light reach masks ride in a uniform to keep this at 8 — frame.ts binding 12)
    // the mesh-shadow trees want one more read-only storage slot in the scene group: 6 + reach (1 if storage) + mesh 1, plus the cascade trace's / probe's 2 in
    // their own group, must fit the per-stage limit — 10 with the reach rows in storage, which is exactly what Chrome offers on Metal. Where it does not fit the
    // binding is left out of the layout altogether (a stub meshLoad() in the prelude) and the experiment is unavailable rather than costing the reach rows their
    // measured storage path. Decided once, here, before any scene pipeline is compiled.
    meshBinding.enabled = 6 + (reachBinding.storage ? 1 : 0) + 1 + 2 <= maxStorage;
    this.meshShadowsAvailable = meshBinding.enabled;
    this.timer = new GpuTimer(device, gpu.hasTimestamps);
    this.sceneLayout = createSceneLayout(device);
    this.fogSight = new FogSight(device, this.sceneLayout);
    this.fogSightStand = device.createBuffer({ label: 'fogSightStand', size: FOG_SIGHT_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });   // (zeros: 'no table written' — but for the list of thin statics, which the sight table's own pass reads here: render/fogofwar.ts FogSight.stand)
    this.fogSight.stand = this.fogSightStand;
    this.world = new BoxWorld(device); this.fogSight.world = this.world;
    this.lights = new LightSet(device);
    this.frameBuf = makeBuffer(device, FRAME_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'frame');
    this.frameBufOut = makeBuffer(device, FRAME_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'frameOut');
    this.dummyStorage = makeBuffer(device, 256, GPUBufferUsage.STORAGE, 'dummy');
    // smoke placeholder until the sim is attached
    const dummyTex = device.createTexture({ size: [1, 1, 1], dimension: '3d', format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING });
    const smokeUbo = makeBuffer(device, 64 * 8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'smokeBoundsDummy');
    const dummyPage = device.createTexture({ size: [1, 1, 1], dimension: '3d', format: 'r32uint', usage: GPUTextureUsage.TEXTURE_BINDING });
    this.smoke = { uniform: smokeUbo, atlasView: dummyTex.createView(), pageView: dummyPage.createView(), count: 0 };
    this.rc = new RadianceCascades(device, this.sceneLayout, { ...rcCfg }, true);   // (deferred: its kernels are init()'s, like every other boot pipeline)
    this.pool = new TexturePool(device);
    this.gbuffer = new GBuffer(device, this.sceneLayout, this.pool, this.world.maxBoxes);   // (its previous-transform buffer is sized to the world's box capacity)
    this.passes = new LightingPasses(device, this.sceneLayout, gpu.format, gpu.linearSampler, this.pool);
  }

  /** true once init() has resolved: every boot pipeline exists and render() may run */
  ready = false;
  /** THE BOOT'S SECOND HALF. The constructor is synchronous and cheap (layouts, buffers, shader-module handles); this creates every pipeline the renderer boots with — the cascades',
   *  the g-buffer's, the lighting passes' (+ froxels, the v3 denoiser, the target-ops kernels) — through createComputePipelineAsync / createRenderPipelineAsync (gpu/device.ts has
   *  the why: the synchronous forms froze the whole browser on a cold shader cache), all in flight at once, and resolves when the last is ready. `opts.sharp` / `opts.gbaa`: also
   *  prepare the sharp-direct trio + its g-buffer down pass / the GBAA kernel, which are otherwise compiled synchronously on the first frame a preset switches them on. Await it
   *  (or use Engine.create) before the first render(); gpu/device.ts pipelineProgress counts the pipelines in for a progress line. */
  init(opts: { sharp?: boolean; gbaa?: boolean; onGroup?: (name: string) => void } = {}): Promise<void> {
    return this.initP ??= Promise.all([this.rc.init().then(() => opts.onGroup?.('cascades')), this.gbuffer.init({ sharp: opts.sharp }).then(() => opts.onGroup?.('gbuffer')), this.passes.init(opts)])   // (onGroup: the boot timeline's per-group marks — passes reports froxels / denoiser / targetOps / passes itself)
      .then(() => { this.ready = true; });   // (memoised: a second caller awaits the same build)
  }
  private initP: Promise<void> | null = null;
  /** construct + init in one await (the viewer, the editor, tools) */
  static async create(gpu: Gpu, opts: { sharp?: boolean; gbaa?: boolean; rcCfg?: RcConfig; onGroup?: (name: string) => void } = {}): Promise<Engine> {
    const e = new Engine(gpu, opts.rcCfg ?? defaultRcConfig);
    await e.init(opts);
    return e;
  }

  setSmoke(s: SmokeBinding) { this.smoke = s; this.sceneBG = null; this.sceneBGOut = null; }
  /** Attach the mesh-shadow trees for the characters `skin` draws (or null to detach); the scene group rebinds on the next frame. */
  setMeshShadows(m: MeshShadows | null) { this.meshShadows = m; this.sceneBG = null; this.sceneBGOut = null; }
  /** the SDF character rig's radius fit for the mannequin `skin` draws (render/sdfrig.ts fitRig — game.ts / the viewer attach it beside the mesh shadows). BoxWorld.upload packs it into every frame's proxy
   *  list (fitted r0 / r1 per slot, the cull sphere fitted); null = the list as the game wrote it: hand radii, no taper byte (each record traced as an untapered cone), 1.5 m spheres */
  rigFit: RigFit | null = null;
  setRigFit(f: RigFit | null) { this.rigFit = f; }
  /** Are the proxies the FITTED cones this frame? (a fit attached — the game and the viewer always attach one; without it they are the game's hand capsules traced as untapered cones) */
  get sdfRigOn(): boolean { return !!this.rigFit; }
  /** Attach the decal list the g-buffer reads (or null); the g-buffer's object group rebinds by itself (keyed on the buffer). */
  setDecals(d: Decals | null) { this.decals = d; }
  /** Is FrameFlags.Decals up this frame? (the setting, a list attached, and at least one mark in it — an empty list costs the fragment stage nothing) */
  get decalsOn(): boolean { return this.settings.decals && !!this.decals && this.decals.count > 0; }
  /** Attach the GPU particle system (or null): its passes join the frame from the next render() while settings.gpuParticles is on. */
  setParticles(p: Particles | null) { this.particles = p; }
  /** THE AIR OVER THE FLOOR (render/airField.ts; game/airSim.ts feeds it): the wind as a small fluid simulation over the level's floor plan — walls, furniture
   *  and door leaves stand in it, the storm and the vents drive it. Read by the particle step (the blown snow's grains and wisps) and by nothing else: a picture
   *  only. main.ts attaches one on every level (`?air=0`: none — null = the engine as it was); the game hands over, once a frame, the ambient wind (`airWind`,
   *  m/s along x and z, the gust on it) and whether to run at all (`airOn`: game/airSim.ts AIR_SIM.on, live — a perf sweep can flip it mid-take). STEPPED ON
   *  ITS OWN CLOCK, not once a drawn frame (settings.airSim, live; settings.airEvery): when at least 0.8 of `airEvery` sixtieths of a second have gone by since the last step (a 120 Hz page steps every
   *  other frame, a 30 Hz one once a frame by the solver's own 1/30 s bound), in ONE compute pass timed as 'air' (per-cell work: it does not shrink with the
   *  render scale). */
  air: { step(enc: GPUCommandEncoder, dt: number, time: number, wind: readonly [number, number], ts?: GPUComputePassTimestampWrites): void; readonly view: GPUTextureView; readonly ready?: boolean; setCells(mask: Uint8Array, rect?: readonly [number, number, number, number]): void; setSources?(recs: Float32Array, n: number): void; reset(): void; readonly w: number; readonly h: number } | null = null;
  airWind: [number, number] = [0, 0];
  airOn = false;
  private airAcc = 0;
  /** Is the GPU particle path live this frame? (the setting ∧ a Particles attached) — what game/particleFx.ts routes the effect sites by */
  get particlesOn(): boolean { return this.settings.gpuParticles && !!this.particles; }

  /** A new cascade grid (a preset with another probe density, the Tab panel's 'rebuild cache'). WORLD-SPACE cache: what a (re)started instance does about its empty / stale contents
   *  (amortized upkeep, holding the old dice while the new one fills…) is render/rc.ts's business (renderer v3 lane P0-A); this side only decides WHICH instance is live and rebuilds
   *  the bind groups that name its dice view. The SCREEN histories are deliberately left alone: the indirect's history converges on the refilled cache through its own clip + EMA.
   *  Instances are PARKED by grid, not destroyed (rcPark): the auto ladder's medium ↔ low step crosses probe grids, and building an instance costs 10–40 ms of pipeline / buffer
   *  creation on the reference machine (measured 08-11) — a parked one is swapped back in for nothing, still holding the light field it had (minutes stale at worst: closer to right
   *  than the black a fresh one starts from; the dice EMA refreshes 90 % of it in seven frames). ~1.5 MB per parked grid. A rebuild request for the grid already live (the Tab
   *  button) still starts that grid over from nothing, as it says. */
  rebuildRc(cfg: RcConfig) {
    const key = rcGridKey(cfg), cur = rcGridKey(this.rc.cfg);
    if (key === cur) { this.rc.destroy(); this.rc = new RadianceCascades(this.device, this.sceneLayout, { ...cfg }); this.rc.invalidateWorld(); }   // (re-primed: whole-level bakes first + a history-free first dice bake — P0-A)
    else {
      const old = this.rc; this.rcPark.set(cur, old);
      const parked = this.rcPark.get(key);
      if (parked) { this.rcPark.delete(key); parked.setInterval0(cfg.interval0); this.rc = parked; }
      else { this.rc = new RadianceCascades(this.device, this.sceneLayout, { ...cfg }); this.rc.invalidateWorld(); }
      this.rc.staggerUpper = old.staggerUpper;   // (halfRate / diceBlend are written every frame; the stagger switch is a by-hand Tab row — it follows the renderer, not the instance)
      while (this.rcPark.size > 2) { const [k, v] = this.rcPark.entries().next().value as [string, RadianceCascades]; v.destroy(); this.rcPark.delete(k); }
    }
    this.passes.externalViewsChanged(); this.sceneBG = null;
  }
  /** parked cascade instances by grid (rebuildRc) */
  private rcPark = new Map<string, RadianceCascades>();
  /** Build (and park) the instances for these grids now — at boot, behind the start card, where pipeline creation is free — so the ladder's first step onto any of them later
   *  swaps instead of builds (ui/quality.ts hands over the ladder's grids). No-op for the live grid or one already parked. */
  prewarmRc(cfgs: RcConfig[]) {
    // A prewarmed instance has never baked: its dice is zeros, which is no history — re-primed like rebuildRc's fresh build (whole-level bakes + a history-free first
    // dice bake once it goes live), else its first ~10 live frames blend the real field in at 0.3 a frame from black and the bounce, the smoke's ambient AND the light
    // meter dip on the ladder's first hop onto it (review R10.1). The flags just sit on the parked instance until it is swapped in.
    for (const cfg of cfgs) {
      const key = rcGridKey(cfg); if (key === rcGridKey(this.rc.cfg) || this.rcPark.has(key)) continue;
      const inst = new RadianceCascades(this.device, this.sceneLayout, { ...cfg }); inst.invalidateWorld(); this.rcPark.set(key, inst);
    }
  }
  get rcParked(): string[] { return [...this.rcPark.keys()]; }
  /** Something changed the WORLD wholesale (level geometry reloaded, the light rig swapped — lighting.ts setDaylight): re-prime the radiance cache in place (rc.invalidateWorld —
   *  P0-A) AND every parked grid, which would otherwise come back on a later hop holding the field from before the change (a night grid parked through the daytime show, a
   *  day grid swapped in at night: seven frames of the wrong bounce and the wrong light-meter reading — review R10.1). Not for screen events — resize / scale / checkerboard /
   *  divisor flips leave the world cache valid and must not call this. */
  invalidateWorldCache() { this.rc.invalidateWorld(); for (const parked of this.rcPark.values()) parked.invalidateWorld(); }
  /** The LEVEL was put back to its start under the picture (game/cleanrestart.ts: a restart — lamps that were out burn, holed walls stand, the eye is somewhere else): the
   *  screen histories, the reservoirs, the haze volume's history and the radiance cache all still hold the level as it stood, 'wrong wholesale'. Each starts from
   *  nothing, as on a boot's first frame, so the fresh level is not blended in over the frames after. */
  restartPicture(why = 'level restarted') { this.passes.restartHistories(why); this.passes.froxels.restartHistory(); this.invalidateWorldCache(); }   // (restartHistories clears the resolve's history and the reservoirs with the rest)

  /** the scene group's resources over one frame block (binding 0): the one list ensureSceneBG and its output-size twin both build from */
  private sceneGroup(frame: GPUBuffer, fogSight: GPUBuffer = this.fogSight.buf): GPUBindGroup {
    return createSceneBindGroup(this.device, this.sceneLayout, {
      frame, boxGeo: this.world.geoBuf, boxMat: this.world.matBuf, gridCells: this.world.cellBuf, gridItems: this.world.itemBuf,
      sceneInfo: this.world.infoBuf, lights: this.lights.buf, smoke: this.smoke.uniform, smokeAtlasView: this.smoke.atlasView, smokePage: this.smoke.pageView, lightReach: this.lights.reachBuf, linSamp: this.gpu.linearSampler, capsules: this.world.capsuleBuf,
      mesh: this.meshShadows?.buf ?? this.dummyStorage, fogSight,
    });
  }
  private ensureSceneBG() {
    const meshBuf = this.meshShadows?.buf ?? this.dummyStorage;   // (256 zero bytes = a zero header = an empty tree, and the flag is never raised without a MeshShadows anyway)
    if (this.sceneBG && this.sceneBGItems === this.world.itemBuf && this.sceneBGMesh === meshBuf) return;
    this.sceneBG = this.sceneGroup(this.frameBuf);
    this.sceneBGPlain = this.sceneGroup(this.frameBuf, this.fogSightStand);
    this.sceneBGItems = this.world.itemBuf; this.sceneBGMesh = meshBuf;
  }
  private sceneBGItems: GPUBuffer | null = null; private sceneBGMesh: GPUBuffer | null = null;
  /** the OUTPUT frame block's twin of the scene group (sharp direct): every resource the same but binding 0 = frameBufOut; rebuilt with the same keys */
  private ensureSceneBGOut() {
    const meshBuf = this.meshShadows?.buf ?? this.dummyStorage;
    if (this.sceneBGOut && this.sceneBGOutItems === this.world.itemBuf && this.sceneBGOutMesh === meshBuf && this.sceneBGOutSmoke === this.smoke.uniform) return;
    this.sceneBGOut = this.sceneGroup(this.frameBufOut);
    this.sceneBGOutItems = this.world.itemBuf; this.sceneBGOutMesh = meshBuf; this.sceneBGOutSmoke = this.smoke.uniform;
  }
  private sceneBGOutItems: GPUBuffer | null = null; private sceneBGOutMesh: GPUBuffer | null = null; private sceneBGOutSmoke: GPUBuffer | null = null;
  /** The scene bind group (group 0 of every scene pipeline), built if need be — for tools that run their own kernel against the live scene (MeshShadows.debugTrace). */
  sceneBindGroup(): GPUBindGroup { this.ensureSceneBG(); return this.sceneBG!; }
  /** Is the mesh-shadow path live this frame? (the setting, the adapter budget and an attached MeshShadows all three) */
  get meshShadowsOn(): boolean { return this.settings.meshShadows && this.meshShadowsAvailable && !!this.meshShadows; }

  resize() {
    const canvas = this.gpu.canvas;
    const dpr = window.devicePixelRatio || 1;
    const cw = Math.max(1, Math.floor(canvas.clientWidth * dpr)), ch = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    // canvas backing store at internal res; browser upscales. Internal height = min(maxInternalHeight, CSS height × dpr) × renderScale: the cap is what ×1.0 means on
    // this window and every step of the scale below it renders fewer pixels (until 08-11 the scale multiplied the window and was THEN capped, so on a HiDPI window —
    // 1440 device px against a 1000-px cap — everything from ×0.70 to ×1.00 rendered the same 1000 rows: a dead zone on the slider and rungs the adaptive ladder
    // announced but never took)
    const capH = Math.min(this.settings.maxInternalHeight, ch);                            // the rows this window gets at the current cap (render scale 1.0)
    const h = Math.max(16, Math.floor(capH * Math.max(0.05, Math.min(1, this.settings.renderScale || 1)) + 1e-6));
    const scale = h / ch, w = Math.max(16, Math.floor(cw * scale + 1e-6));
    this.capScale = capH / ch; this.effectiveScale = scale;   // effectiveScale keeps its meaning — internal / (CSS × dpr), what was actually rendered — the cost model's pixel term and game.ts's metres-per-pixel are in those units
    // OUTPUT size: with TAAU the cap's rows whatever the scale (exactly what scale 1.0 renders — so the resolve's cost is bounded by the preset, and 'TAAU at 0.77' presents the same canvas as 'no TAAU at
    // 1.0'); without it the internal size (the canvas the browser upscales, as before)
    const oh = this.settings.taau ? Math.max(16, Math.floor(capH + 1e-6)) : h, ow = this.settings.taau ? Math.max(16, Math.floor(cw * (oh / ch) + 1e-6)) : w;
    if (canvas.width !== ow || canvas.height !== oh) { canvas.width = ow; canvas.height = oh; }
    // SHARP DIRECT: live only where there is something to decouple — TAAU on (the output-size history), the internal size below the output, and no debug view (those bypass the resolve and read
    // internal-size diagnostics); mirrored into the passes BEFORE their resize, like the TAAU switch (the composite-size set follows it)
    const sharp = !!this.settings.sharpDirect && this.settings.taau && this.settings.debugView === 0 && (ow !== w || oh !== h);
    this.passes.setSharp(sharp);
    this.passes.setGbaa(!!this.settings.gbaa && this.settings.taau && this.settings.debugView === 0 && (sharp || this.settings.taauPhases <= 0));   // GBAA: on the TAAU path only (its blend sits between the composite and the resolve; the debug views and the FXAA chain bypass it), and only on a 1 : 1 raster it can own — sharp direct live, or the jitter off — never under the jittered upscale (that is C4: measured softer than main)
    this.passes.setOutlineCopy(!!this.outline?.on && this.outline.picture && this.settings.debugView === 0);   // THE OUTLINE BY THE PICTURE (render/outline.ts): a copy of the composite for it to read, kept only while its rows ask
    this.passes.fogFrame = this.fogFrame; this.passes.setFog(!!this.fogFrame?.on && this.settings.debugView === 0);   // FOG OF WAR (game/fogofwar.ts): its pass exists only while the game's switch is on (hdr takes the storage + copy usages then), and never under a debug view
    this.passes.setSceneCopy(!!this.settings.particleRain && !!this.particles);   // PARTICLE RAIN v2: keep a copy of the composite for the rain streaks to refract (GBAA's own when GBAA is on; else one the particles fill before their splat) — off = nothing kept
    if (w !== this.width || h !== this.height || ow !== this.outWidth || oh !== this.outHeight || this.passes.stale || sharp !== this.sharpOn) {   // (stale: TAAU / GBAA switched — the output- or composite-size set is rebuilt even at an unchanged size)
      this.width = w; this.height = h; this.outWidth = ow; this.outHeight = oh; this.sharpOn = sharp;
      this.gbuffer.keepTargets = this.passes.keepHistories = this.settings.keepHistories;
      this.gbuffer.resize(w, h, ow, oh, sharp); this.passes.resize(w, h, ow, oh); this.passes.externalViewsChanged();   // (the passes' bind groups name the g-buffer's views: rebuilt against the new ones)
    }
  }

  /** irradiance (W/m², unshadowed, on-axis) under which a light's tint through a pane is invisible: a 20 % tint of it is under half a per cent of display white */
  static readonly GLASS_MIN_E = 0.02;
  /** froxel volumetrics: the height (m) above which nothing scatters light anyone can see (street-lamp heads at 5 m, plumes and beams under them) — the grid's near boundary is at least the camera's
   *  height over it, so the follow camera's first slices are not spent on open air; the near boundary of the frame before, for the history's reprojection */
  static readonly FROXEL_CONTENT_TOP = 8; private froxelPrevNear = 0; private froxelMapKey = 0;
  /** the froxels have rendered a frame since boot (the boot's own 'first frame' cut restarts nothing — there is no history yet — so a boot renders the bits it always did) */
  private havePrevFrox = false;
  private glassEx = new Float64Array(24); private glassEz = new Float64Array(24); private glassCells = new Int32Array(24 * GLASS_STATIONS.length * GLASS_SIDES.length);
  /** GLASS: per light, the bits of the listed panes (world.glassList order = SceneInfo.glass order; the first 24) that light can possibly shine THROUGH onto
   *  anything: the pane's bounds inside the light's range box (a directional light: every pane), and — for a light with a reach mask (reach.ts: the level's
   *  static fixtures) — some 1 m cell just off either face of the pane inside that mask (a light that reaches neither side of a pane lights nothing through
   *  it). Errs toward 'set' like the reach masks themselves. → RtLight.glassMask, which upload() packs above the owner byte; direct.wgsl glassPairMask narrows
   *  it per 8×8 tile. lights × panes cheap tests a frame; nothing with the experiment off or no pane listed. */
  private glassLightMasks() {   // (GLASS_STATIONS / GLASS_SIDES below the class: the sample lattice as module consts, not two array literals per light per pane per frame — review R1.4)
    const w = this.world, list = this.settings.glass ? w.glassList : [];
    const LL = this.lights.lights;
    if (!list.length) { for (let i = 0; i < LL.length; i++) LL[i].glassMask = 0; return; }
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell;
    const cellOf = (x: number, z: number) => { const cx = Math.floor((x - WORLD.min[0]) / cs), cz = Math.floor((z - WORLD.min[2]) / cs); return cx < 0 || cz < 0 || cx >= W || cz >= H ? -1 : cz * W + cx; };
    // per listed pane, once a frame (all of it was worked out again for every light): its world half extents in x / z, and the grid cells just off either face at the three
    // stations along it (−1 = off the grid) — the cells a light's reach mask is asked about
    const EX = this.glassEx, EZ = this.glassEz, CELLS = this.glassCells, NC = GLASS_STATIONS.length * GLASS_SIDES.length;
    for (let k = 0; k < list.length && k < 24; k++) {
      const b = w.statics[list[k]]; if (!b) continue;
      { const c = Math.abs(Math.cos(b.yaw)), sn = Math.abs(Math.sin(b.yaw)); EX[k] = c * b.h[0] + sn * b.h[2]; EZ[k] = sn * b.h[0] + c * b.h[2]; }
      const thinX = b.h[0] < b.h[2];   // thin along local x (a pane in a wall along Z) or along local z
      const c = Math.cos(b.yaw), sn = Math.sin(b.yaw);
      const nx = thinX ? c : sn, nz = thinX ? -sn : c;                 // world direction of the thin axis (local +x → (cos, 0, −sin), +z → (sin, 0, cos))
      const tx = thinX ? sn : c, tz = thinX ? c : -sn;                 // …and of the long one
      const half = thinX ? b.h[2] : b.h[0];
      let j = k * NC;
      for (let ui = 0; ui < GLASS_STATIONS.length; ui++) for (let si = 0; si < GLASS_SIDES.length; si++) { const u = GLASS_STATIONS[ui], side = GLASS_SIDES[si], ci = cellOf(b.c[0] + tx * u * half + nx * side, b.c[2] + tz * u * half + nz * side); CELLS[j++] = ci >= 0 ? ci : -1; }   // (a NaN cell — a corrupt pane — must stay 'off the grid', not become cell 0 in the Int32Array)
    }
    for (let n = 0; n < LL.length; n++) {
      const l = LL[n]; const ghost = (l.fogGhost ?? 0) > 0 && !(l.enabled && l.intensity > 0);   // (a lamp out but lit in the fog's picture — lights.ts RtLight.fogGhost — shines through the panes it did)
      if (!l.enabled && !ghost) { l.glassMask = 0; continue; }
      let m = 0;
      const peak = Math.max(l.color[0], l.color[1], l.color[2]) * (ghost ? l.fogGhost! : l.intensity);   // on-axis intensity (W/sr-ish): what evalLight divides by d²
      const cosO = Math.cos(Math.min(89, l.outerDeg + 8) * Math.PI / 180);      // a spot's cone, opened 8° (the pane is judged by a handful of points, not its whole face)
      for (let k = 0; k < list.length && k < 24; k++) {
        const b = w.statics[list[k]]; if (!b) continue;
        if (l.kind !== 2) {   // range box vs the pane's world bounds; then: could this light put GLASS_MIN_E on any of the pane at all (distance to its nearest point, the spot's cone / the panel's facing over its corners and centre)? A light too dim or pointed away tints nothing anybody can see
          const ex = EX[k], ez = EZ[k];
          const r = l.range + 0.05;
          if (Math.abs(l.pos[0] - b.c[0]) > r + ex || Math.abs(l.pos[1] - b.c[1]) > r + b.h[1] || Math.abs(l.pos[2] - b.c[2]) > r + ez) continue;
          const qx = Math.max(Math.abs(l.pos[0] - b.c[0]) - ex, 0), qy = Math.max(Math.abs(l.pos[1] - b.c[1]) - b.h[1], 0), qz = Math.max(Math.abs(l.pos[2] - b.c[2]) - ez, 0);
          const d2 = Math.max(qx * qx + qy * qy + qz * qz, l.radius * l.radius, 0.01);
          if (peak / d2 < Engine.GLASS_MIN_E) continue;
          if ((l.kind === 1 || l.kind === 3) && qx * qx + qy * qy + qz * qz > (ex + b.h[1] + ez) ** 2 * 0.5) {   // facing (only judged from further off than ~the pane's own size: a torch a metre from a bay aimed between the sample points must not drop the bit and pop the tint): some corner / the centre of the pane inside the (opened) cone, or in front of the one-sided panel
            let facing = false;
            for (let ci = 0; ci < 9 && !facing; ci++) {
              const px = ci === 8 ? b.c[0] : b.c[0] + (ci & 1 ? ex : -ex), py = ci === 8 ? b.c[1] : b.c[1] + (ci & 2 ? b.h[1] : -b.h[1]), pz = ci === 8 ? b.c[2] : b.c[2] + (ci & 4 ? ez : -ez);
              const dx = px - l.pos[0], dy = py - l.pos[1], dz = pz - l.pos[2]; const dl = Math.hypot(dx, dy, dz) || 1;
              const cd = (dx * l.dir[0] + dy * l.dir[1] + dz * l.dir[2]) / dl;
              facing = l.kind === 3 ? cd > 0.02 : cd > cosO;
            }
            if (!facing) continue;
          }
        }
        if (l.reach) {   // some cell just off either face, at three stations along the pane, inside the light's reach
          let any = false;
          for (let j = k * NC, e = j + NC; j < e; j++) { const ci = CELLS[j]; if (ci >= 0 && reachLevel(l.reach, ci) > 0) { any = true; break; } }
          if (!any) continue;
        }
        m |= 1 << k;
      }
      l.glassMask = m >>> 0;
    }
  }
  private offscreenTarget: GPUTexture | null = null;
  /** Read back the last offscreen frame (render with present=false first) as RGBA8 pixels — for automated captures. */
  async readbackFrame(): Promise<{ w: number; h: number; data: Uint8Array; bgra: boolean } | null> {
    const tex = this.offscreenTarget; if (!tex) return null;
    const w = tex.width, h = tex.height; const bpr = Math.ceil(w * 4 / 256) * 256;
    const buf = this.device.createBuffer({ size: bpr * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = this.device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: tex }, { buffer: buf, bytesPerRow: bpr }, [w, h]); this.device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const src = new Uint8Array(buf.getMappedRange()); const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) data.set(src.subarray(y * bpr, y * bpr + w * 4), y * w * 4);
    buf.unmap(); buf.destroy();
    return { w, h, data, bgra: this.gpu.format.startsWith('bgra') };
  }
  /** present=false renders into an internal target instead of the swap chain (scripted runs while the tab is hidden, where getCurrentTexture() stalls). */
  render(cam: FollowCamera, time: number, dt: number, present = true) {
    if (!this.ready) throw new Error('Engine.render() before init() resolved — await engine.init() / Engine.create() first');   // (a readable line instead of setPipeline(undefined) deep in a pass)
    this.lastDt = dt; this.viewFocus = cam.focus;
    if (this.outline) { this.outline.exposure = this.settings.exposure; outlineBoxes(this.outline, p => cam.project(p, 1, 1)); }   // THE OUTLINE IN THE DARK (host/findme.ts → render/outline.ts): the box round each man on THIS camera's picture
    this.passes.outline = this.settings.debugView === 0 ? this.outline : null;   // (never under a debug view, as the fog)
    this.passes.dustLook = !!this.smoke.dusty;   // (look only: destruction dust alive in the bound smoke system → render/dustLookVol.ts)
    this.passes.smokeDiffuseBilinear = this.settings.smokeDiffuseWeight === 'bilinear'; this.passes.smokeDiffuseTau0 = this.settings.smokeDiffuseStart ?? 0.35;   // (smoke battery experiment, post.wgsl diffuseMode)
    this.gbuffer.keepTargets = this.passes.keepHistories = this.settings.keepHistories;   // (the switch for everything a change of size does — texpool.ts; mirrored before either can happen below)
    if (!this.settings.keepHistories && this.pool.parkedBytes) this.pool.evict(true);    // switched off: nothing stays parked
    else this.pool.tick();                                                                 // parked targets not wanted back within a couple of minutes are let go
    this.passes.setDivisors(this.settings.gatherThird ? 3 : 2, this.settings.volQuarter ? 4 : 2);   // (lossy options; re-creates the targets on the grid that changed)
    this.passes.setTaau(this.settings.taau);   // (mirrored before resize: the output-size target set — the resolve's history pair — exists only while it is on)
    { const S = this.settings, refl = S.beamReflect && S.rtReflect, air = S.beamAir && S.debugView === 0;   // (a debug view shows the boxes: the air look is added in the composite only)
      // how much of a beam the AIR shows (0.4 ≈ the old box's brightness under the tube): a little in clear indoor air, more by the haze, most in rain — smoke is read per pixel in the shader
      const A = air ? S.beamAirK * (0.03 + 0.09 * Math.min(2, S.hazeDensity / 0.035)) : 0;   // (0.12 at the default haze: the software adapter's stills put the line at the old box's level, clipped, at 0.4)
      this.world.hidePrimary = this.passes.setBeams(refl || air ? this.world.dynamics : null, thinIs, this.viewFocus, { reflect: refl, air: air ? thinAirOf : null, A, rain: this.weather.rain, wet: S.wetMirror && S.rtReflect ? 2 : 0 });
    }   // (lasers / tracers in the reflections: ≤ 8 segments in a small uniform; none = a zero count, the pass as it was)
    this.passes.setFireLook(this.fireLook);
    this.passes.setFires(this.settings.debugView === 0 ? this.fires : null);   // the open fires' flames (game/fire.ts), behind the beams in the same uniform
    this.passes.setRt(this.settings.rtReflect, this.settings.rtReflectDiv);   // (likewise before resize: the reflection targets' divisor — pooled + re-made on change like the gather's — and the switch that first allocates them at all)
    this.passes.setGi(this.settings.giResample !== 'off');   // (phase 5, likewise: the gather's reservoir pair exists from the first frame resampling is asked for — an off machine pays no memory)
    this.passes.setGiFull(!!this.settings.giFullRes && this.settings.denoiser !== 'legacy', this.settings.giFullIters);   // (GI in motion, likewise before resize: the diffuse client's INTERNAL-res set exists from the first frame it is asked for; the v3 core only)
    this.passes.setHitReuse(this.settings.rtHitReuse);      // (phase 5: the reflection pass's hit-record pair, made on first use the same way)
    this.resize();
    cam.aspect = this.width / this.height;
    cam.rebuild();
    // ---- TAAU: this frame's jitter and the matrices everything downstream sees. The jitter is a translation of the projection in NDC (content at unjittered pixel s lands at s + jitter); the
    // frame uniform carries the JITTERED view-projection, its inverse and the previous render's jittered one, so the g-buffer, every pass that rebuilds a ray from a pixel (worldFromDepth) and
    // every reprojection into an internal-resolution history agree to the bit; only the resolve (and the HUD, which projects on the CPU with the camera's own matrices) ever sees unjittered ones.
    const taauOn = this.settings.taau, s0 = this.settings;
    if (taauOn !== this.taauWas) { this.taauWas = taauOn; if (taauOn) this.resetTaa('taau on'); }
    if (taauOn && (s0.debugView !== 0) !== (this.debugWas !== 0)) this.resetTaa('debug view');
    this.debugWas = s0.debugView;
    let jx = 0, jy = 0;
    if (taauOn && s0.debugView === 0 && s0.taauPhases > 0) { const n = Math.max(1, Math.floor(s0.taauPhases)); const i = (this.frameIdx % n) + 1; jx = Engine.halton(i, 2) - 0.5; jy = Engine.halton(i, 3) - 0.5; }
    const decouple = this.sharpOn && !!s0.sharpDecouple && (jx !== 0 || jy !== 0);   // DECOUPLED JITTER: the internal raster keeps the full ±½ INTERNAL-px jitter, the output raster none (writeFrameOut / jitterRes below)
    if (this.sharpOn && !decouple) { jx *= this.width / this.outWidth; jy *= this.height / this.outHeight; }   // sharp direct: the raster to antialias is the OUTPUT one — ± ½ output px, expressed in internal px as everything downstream expects (the same NDC translation either way)
    this.jitter[0] = jx; this.jitter[1] = jy;
    m4.copy(this.vpJ, cam.viewProj);
    if (jx !== 0 || jy !== 0) { const ax = 2 * jx / this.width, ay = -2 * jy / this.height; for (let c = 0; c < 4; c++) { const w = this.vpJ[c * 4 + 3]; this.vpJ[c * 4] += ax * w; this.vpJ[c * 4 + 1] += ay * w; } m4.invert(this.invVpJ, this.vpJ); }
    else m4.copy(this.invVpJ, cam.invViewProj);
    let cutNow = false;   // (a cut this frame: the young-history extra gather rays stand down for it — every texel is young on a cut and the picture is being cut anyway; giCfg below)
    if (!this.havePrev) { m4.copy(this.prevVpJ, this.vpJ); m4.copy(this.prevVpU, cam.viewProj); this.prevCamPos = v3.copy(cam.pos); this.prevCamFwd = v3.copy(cam.forward); this.havePrev = true; cutNow = true; if (taauOn) this.resetTaa('first frame'); }
    else {   // a cut nobody can reproject across: the eye jumped rooms (> 2.5 m between two renders — 150 m/s; the follow camera is damped, the tour / breach / attract cut) or swung > 30° at once
      const jump = v3.dist(cam.pos, this.prevCamPos), turn = v3.dot(cam.forward, this.prevCamFwd);
      if (jump > 2.5 || turn < 0.866) { cutNow = true; if (taauOn) this.resetTaa(jump > 2.5 ? `cut (${jump.toFixed(1)} m)` : 'cut (turn)'); else this.passes.dropRestirBeliefs(); }   // (resetTaa drops the ReSTIR tiles' light beliefs too; without TAAU that is all a cut needs from here)
    }
    if (cutNow) this.giCutHold = Math.max(1, Math.round(this.settings.giYoungLen)) + 1; else if (this.giCutHold > 0) this.giCutHold--;   // (held until the histories a cut restarted are no longer 'young' by the gather's own test — else the whole grid asks on the frame the hold ends)
    { // INFRARED LIGHTS (lights.ts LightSet.ir, game/irlight.ts): in the list only while this frame's picture is the tube's — post.wgsl's own swap. The frame the
      // tube comes off, every screen history still holds rooms lit by them (the resolve's, the direct light's, the bounce's, the reflections', the reservoirs' —
      // in a tube frame they are steady lights like any torch): 'wrong wholesale', the case passes.restartHistories names — so no bare-eyed frame shows what only a tube saw.
      // (Here, ahead of the young-history fold just below, so the hold that restart asks for is in THIS frame's giCfg.)
      const tube = this.settings.nvAmount > 0.5;
      if (!tube && this.lights.tube && this.lights.irSpell) this.passes.restartHistories('the goggles came off infrared light');
      if (!tube) this.lights.irSpell = false;
      this.lights.tube = tube;
    }
    { const dn = this.settings.denoiser === 'legacy' ? 'legacy' : 'v3'; if (dn !== this.dnWas) { this.dnWas = dn; this.passes.youngHold = 6; } }   // (the denoiser switch this frame zeroes the diffuse moments in the encode below: fold it in now, not a frame late)
    if (this.passes.youngHold > 0) { this.giCutHold = Math.max(this.giCutHold, Math.max(this.passes.youngHold, Math.round(this.settings.giYoungLen) + 1)); this.passes.youngHold = 0; }   // the same for a wholesale history restart the passes did (restartHistories, the denoiser switch, a keepHistories-off resize)
    const matSame = this.prevVpU.every((v, i) => v === cam.viewProj[i]);
    const camStill = taauOn && matSame;
    // the CAMERA's own motion this frame in output px (the look-at point and four points 3 m round it through the previous / current unjittered view-projection — an orbit leaves the
    // look-at itself still): the motion-sharpen term of the final blit (taauSharpenMotion) and the direct-motion twin's switch below
    let px = 0;
    if (this.havePrev && !matSame) {
      const prj = (m: ArrayLike<number>, q: Vec3): [number, number] | null => { const x = m[0] * q[0] + m[4] * q[1] + m[8] * q[2] + m[12], y = m[1] * q[0] + m[5] * q[1] + m[9] * q[2] + m[13], w = m[3] * q[0] + m[7] * q[1] + m[11] * q[2] + m[15]; return w > 1e-4 ? [x / w, y / w] : null; };
      for (const off of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) { const q: Vec3 = [cam.target[0] + off[0], cam.target[1], cam.target[2] + off[1]]; const a = prj(this.prevVpU, q), b = prj(cam.viewProj, q); if (a && b) px = Math.max(px, Math.hypot((b[0] - a[0]) * 0.5 * (this.outWidth || this.width), (b[1] - a[1]) * 0.5 * (this.outHeight || this.height))); }
    }
    // the unjittered camera MOVED since the last render (TAAU or not; a cut is not motion): the direct-motion lane's twin ReSTIR program dispatches on these frames only. By displacement,
    // not matrix equality — the follow camera's damping keeps nudging the f32 matrices for seconds after the picture has visibly settled, and the twin (+0.2 ms at high, its levers inert
    // under a pixel's own 1 px/frame) would run all that while (review of 5a08434); 0.02 px a frame is far under anything either program does differently
    this.camMovedAny = this.havePrev && !cutNow && px > 0.02;
    let camMot = 0;
    if (taauOn && !camStill) camMot = Math.max(0, Math.min(1, (px - 0.125) / 0.375));   // 0 at ≤ ⅛ px / frame … 1 at ≥ ½ (taau.wgsl MOTION_PX's ramp)
    const t0 = performance.now();
    this.world.glassEnabled = this.settings.glass; this.world.glassFocus = cam.focus;   // (the pane list is nearest-to-the-look-at first, and empty with the experiment off)
    this.world.markingsEnabled = this.settings.markings;   // markings: off = every box uploads slot 0 and its plain albedo in the secondary row (the frame as it was)
    this.world.rig = this.rigFit ? { r0: this.rigFit.r0, r1: this.rigFit.r1, kPad: RIG_KPAD * Math.max(1, this.settings.sdfRigK ?? 1), byOwner: this.rigFit.byOwner } : null;   // the SDF rig: the fit packed into this frame's proxy list at upload (r0 over the hand radius, r1 in misc's top byte, the cull sphere fitted + the smooth union's bulge at k ≥ 1 — never tighter than the k = 1 sphere: it is also the mesh shadows' broad phase at ultra, and a finger can reach a few cm past the forearm cone) — null = no fit attached: the list as the game wrote it
    this.world.motionIds = this.settings.motionIds !== false;   // motion identity: keyed dynamic boxes hand the g-buffer last frame's index of their key (off = the bare index, the old rule)
    { const mt = Math.max(0.005, Math.min(0.2, this.settings.markingTexel)); if (this.settings.markings && mt !== this.world.markingTexel) this.world.repackMarkings(mt); }   // the base texel moved (the review page's A/B): every list repacked at the new lattice
    this.world.upload();
    cutSwap.frame(this.world.cutTraced);   // CUT BOXES (render/cutSwap.ts): the tracing programs with the cut rule only while a cut box a ray can meet is alive — a calm frame dispatches the boot's
    { // …and the raster follows the rays: a traceable cut box is drawn cut only on a frame whose ray programs carry the rule (the second set still compiling / failed / pinned off by a dev hook = whole
      // for both). The frame standing pieces change shape on — the set arriving under pieces born before it — is a cut for the resolve: its history shows the whole boxes
      const n = this.world.visibleCutTraced, whole = cutSwap.drawsCut ? 0 : n;
      if (n > 0 && this.cutSeen > 0 && (whole > 0) !== (this.cutWhole > 0)) { if (taauOn) this.resetTaa('cut pieces change shape'); else this.passes.dropRestirBeliefs(); }
      this.cutWhole = whole; this.cutSeen = n;
    }
    this.glassLightMasks();   // (glass: which listed panes each light can reach at all → RtLight.glassMask, packed by the upload below; all 0 with the experiment off)
    this.lights.dirMasks = this.settings.restir;   // the moon's / sun's directional reach masks ride only with the ReSTIR estimator (render/reach.ts reachMaskForDirectional; the OFF path's rows stay as they were)
    const numLights = this.lights.upload(time);
    if (this.decals) { this.decals.enabled = this.settings.decals; this.decals.frame(this.world); }   // decals (E1): the setting is the switch (off = nothing recorded or written); attached marks follow their boxes as of THIS upload, the buffer is rewritten only when the list changed
    this.passes.setDecalBuffer(this.decals?.buf ?? null);   // (the composite reads it too: the crack stars rounds leave on glass panes — a no-op unless the buffer changed)
    this.cpuMs.boxes = performance.now() - t0;
    this.ensureSceneBG();

    const s = this.settings;
    // torch bounce cards: nominate the carried spots (RtLight.card) uploaded this frame — the MAX_CARDS nearest the view's look-at point if there are more —
    // by light slot; cards.wgsl rebuilds each one's footprint card ahead of the gather. None with the setting off (no dispatch, flag down).
    const cardSlots = s.torchBounceCards ? cardSlotsFor(this.lights.lights, cam.focus, MAX_CARDS) : [];
    this.passes.numCards = cardSlots.length;
    const meshOn = this.meshShadowsOn;   // FrameFlags.MeshShadows this frame (setting ∧ adapter budget ∧ trees attached); the trees are re-skinned + refit below before anything traces
    const decalsOn = this.decalsOn;      // FrameFlags.Decals this frame (setting ∧ a list attached ∧ something in it)
    const partOn = this.particlesOn;     // FrameFlags.Particles this frame (setting ∧ a Particles attached): its emits are dealt slots and uploaded now, stepped after the cascades, drawn after the composite
    const rtOn = s.rtReflect;            // RT reflections this frame (frame.rtCfg.w = the divisor, 0 while off) — and Gloss is then held DOWN whatever settings.gloss says (the reflection pass covers the polished floors: rtReflect ⊃ gloss)
    const giMode = s.giResample === 'full' ? 2 : s.giResample === 'temporal' ? 1 : 0;   // phase 5: the gather's reservoir resampling this frame (frame.p5Cfg.x; passes.setGi — mirrored above, before resize — makes / keeps its reservoir pair)
    const rtP5Bits = (s.rtMeshHits && meshOn ? 1 : 0) | (s.rtHitReuse ? 2 : 0);   // phase 5: the reflection pass's bits (frame.p5Cfg.z) — any of them up dispatches the reflect_p5.wgsl variant, none = main's reflect.wgsl, the same program as before the phase
    const rigBits = (s.sdfRigSmooth ? 2 : 0) | (s.charSoftShadow ? 4 : 0) | (s.charSoftShadow && s.charSoftAnalytic ? 8 : 0) | (s.charSoftSmooth ? 16 : 0) | (s.charSoftBroad ? 32 : 0) | (s.charSelfShadow ? 64 : 0) | (s.meshShadowsNear ? 128 : 0);   // the SDF character rig's EXTRAS this frame (frame.rigCfg.x: 2 smooth-union closest hit · 4/8/16/32 the soft character query · 64 character self-shadow · 128 mesh shadows near-only; bit 1 retired — the round cones themselves are unconditional)
    this.passes.rtP5 = rtP5Bits !== 0 || (rigBits & 2) !== 0;   // (the rig's smooth closest hit rides in the same variant's tracer tail — reflect.wgsl stays main's program)
    this.particles?.prepare(dt, partOn, s.particleBirths);
    // froxel volumetrics (Phase 2b): the grid follows the preset's rows / slices and the window's aspect (a preset hop or a reshape re-makes it and restarts its history; the render scale never
    // touches it); a spell off lets the volumes go after ten seconds. FrameFlags.FroxelVol is up exactly while a grid is dispatched.
    const numTransientNow = this.lights.lights.reduce((n, l) => n + ((l.ttl >= 0 || l.transient) && l.enabled ? 1 : 0), 0);   const firstTransientNow = numTransientNow ? this.lights.firstTransientSlot : 0;   // (+ the lowest SLOT holding one, from the upload above — the gather's subtraction loop starts there instead of at slot 0 (frame.p5Cfg.w; 0 when none is alive, so a still's frame block is byte for byte what it was — review R2.2))   // transient (ttl / flagged) lights alive this frame — the gather skips its subtraction loop at 0, the froxels draw them outside their history (the goggles' infrared lights are NOT among them: steady lights in the tube's picture — lights.ts LightSet.ir)
    const fx = this.passes.froxels;
    const froxOn = s.froxelVol && s.froxelH >= 8 && s.froxelD >= 4 && (s.flags & (FrameFlags.Volumetrics | FrameFlags.Smoke)) !== 0;   // (beams AND smoke both off: nothing for the grid to hold — the old path draws the same nothing)
    const froxNear = Math.max(0.05, s.froxelNear, cam.pos[1] - Engine.FROXEL_CONTENT_TOP);   // (nothing to light hangs above FROXEL_CONTENT_TOP: the first slice starts where a ray from this height could first meet anything)
    const froxFar = Math.max(froxNear + 1, s.froxelFar);
    if (froxOn) {
      // W follows the WINDOW's aspect (canvas CSS box), not the internal size's: resize() floors width and height separately, so the internal aspect wobbles by a fraction of a froxel across
      // render-scale steps and would re-make the volumes on the ladder's every move; capped for ultrawide windows (32:9 at ultra would be 180 MB)
      const cv = this.gpu.canvas as HTMLCanvasElement; const aspect = (cv.clientWidth > 0 && cv.clientHeight > 0) ? cv.clientWidth / cv.clientHeight : this.width / Math.max(1, this.height);
      const H = Math.round(s.froxelH), W = Math.max(8, Math.min(Math.round(H * 2.4), Math.round(H * aspect)));
      if (fx.configure(W, H, Math.round(s.froxelD), fx.allocated ? 'grid change' : 'first use')) this.passes.froxelViewsChanged();
      if (fx.idle > 0) fx.restartHistory();   // back after a spell off: whatever the history holds is stale
      if (cutNow && this.havePrevFrox) fx.restartHistory();   // a camera CUT (the same > 2.5 m / > 30° rule that drops the TAA history above): the haze volumes' temporal reprojection cannot follow it either — without this the beams of the room cut FROM ghosted over the room cut TO for the ~14 frames the 0.93 history takes to forget (review R2.8)
      this.havePrevFrox = true;
      const mapKey = s.froxelFar * 1000 + s.froxelCurve; if (mapKey !== this.froxelMapKey) { if (this.froxelMapKey) fx.restartHistory(); this.froxelMapKey = mapKey; }   // far / curve moved (a Tab slider): the history is laid out on the old mapping — restart it (near rides the camera every frame and reprojects through prevCam.w)
    } else if (fx.allocated) { fx.idle++; if (fx.idle > 600) { fx.release(); this.passes.froxelViewsChanged(); } }
    this.rc.halfRate = s.rcHalfRate;
    this.rc.amortize = s.rcAmortize; this.rc.setPeriods(s.rcPeriods); this.rc.setChunks(s.rcChunks);   // amortized cascade upkeep (rc.ts): the settings are the source of truth, mirrored like the other cache options
    const jf = (this.rc.staggerUpper || this.rc.halfRate) ? (this.frameIdx >> 1) : this.frameIdx;   // same direction jitter for the pair of frames that share cascade work (stagger: c2+ every other frame; half rate: uppers even / c0 + bake odd)
    this.rc.setDiceBlend((s.flags & FrameFlags.Temporal) ? 0.3 : 1.0);
    const fp: FrameParams = {
      viewProj: taauOn ? this.vpJ : cam.viewProj, invViewProj: taauOn ? this.invVpJ : cam.invViewProj, prevViewProj: taauOn ? this.prevVpJ : cam.prevViewProj,   // (TAAU off: the camera's own three, untouched — the old path bit for bit)
      camPos: cam.pos, camDir: cam.forward, time, dt, width: this.width, height: this.height,
      frameIdx: this.frameIdx, numLights, flags: (s.flags & ~(FrameFlags.ReachMask | FrameFlags.TileCull | FrameFlags.SoftTileSkip | FrameFlags.CheckerDirect | FrameFlags.GridSkip | FrameFlags.GridYCull | FrameFlags.AxisBox | FrameFlags.GridSlabs | FrameFlags.Gloss | FrameFlags.MeshShadows | FrameFlags.Decals | FrameFlags.Particles | FrameFlags.Glass | FrameFlags.BounceCards | FrameFlags.DirectSeedHold | FrameFlags.GiAdaptiveHist | FrameFlags.FroxelVol | FrameFlags.Restir))
        | (s.nvAmount > 0.001 ? FrameFlags.NightVision : 0) | (s.lightReach ? FrameFlags.ReachMask : 0) | (s.tileCull ? FrameFlags.TileCull : 0) | (s.softTileSkip ? FrameFlags.SoftTileSkip : 0) | (s.checkerDirect ? FrameFlags.CheckerDirect : 0)
        | (s.gridSkip ? FrameFlags.GridSkip : 0) | (s.gridYCull ? FrameFlags.GridYCull : 0) | (s.axisBoxFast ? FrameFlags.AxisBox : 0) | (s.gridSlabs ? FrameFlags.GridSlabs : 0) | (s.gloss && !rtOn ? FrameFlags.Gloss : 0) | (meshOn ? FrameFlags.MeshShadows : 0)
        | (decalsOn ? FrameFlags.Decals : 0) | (partOn ? FrameFlags.Particles : 0) | (s.glass ? FrameFlags.Glass : 0) | (cardSlots.length > 0 ? FrameFlags.BounceCards : 0) | (s.directSeedHold ? FrameFlags.DirectSeedHold : 0) | (s.giAdaptiveHistory ? FrameFlags.GiAdaptiveHist : 0)
        | (froxOn ? FrameFlags.FroxelVol : 0) | (s.restir ? FrameFlags.Restir : 0),
      exposure: s.exposure,   // tileCull / softTileSkip / gridSkip / gridYCull / axisBoxFast / gridSlabs / gloss / meshShadows / decals / gpuParticles / glass / torchBounceCards / directSeedHold / giAdaptiveHistory: the boolean settings are the single source of truth for their bits (frame.ts FrameFlags is the one table; the cards bit only while a card light is actually up, the decals bit only while a mark exists)
      skyZenith: s.skyZenith, skyHorizon: s.skyHorizon, hazeDensity: s.hazeDensity,
      rcInterval0: this.rc.cfg.interval0, rcC0Dims: [this.rc.cfg.nx, this.rc.cfg.ny, this.rc.cfg.nz], rcNumCascades: this.rc.cfg.cascades, rcD0: this.rc.cfg.d0, rcFrameParity: this.frameIdx & 1,
      numSmoke: this.smoke.count, debugView: s.debugView, indirectScale: s.indirectScale, emissiveScale: s.emissiveScale, volSteps: s.volSteps,
      capColor: s.capColor, post: [s.nvAmount, s.nvGain, s.hitFlash, Math.tan(cam.fov / 2)],
      directCfg: [s.directSamplesTop, s.directSamplesOther, s.directBlurCap, s.directHistory * this.passes.directHistoryScale],   // (× ½ / ¾ on the two frames after the direct histories were resampled across a size change — passes.ts directCarryAge; 1 otherwise)
      rcJitter: (s.flags & FrameFlags.Temporal) ? [0.1 + 0.8 * ((jf * 0.7548776662466927) % 1), 0.1 + 0.8 * ((jf * 0.5698402909980532) % 1)] : [0.5, 0.5],
      directAdaptiveMin: s.directAdaptiveMin,
      numTransient: numTransientNow,
      secMinE: s.secMinE,   // R2 sequence over the octahedral texel: cascade direction aliasing becomes noise for the indirect temporal filter
      lossyCfg: [this.passes.gatherDiv, this.passes.volDiv, s.dimRays ? Math.max(0, s.dimRaysBelow) : 0, Math.max(0, s.giFireflyK)],   // .w: the gather's relative firefly bound (0 = off)
      cardSlots,
      weather: this.weather,   // rain / splashes / sky flash: drawn by the volumetric pass under FLAG_VOLUMETRICS (beams off = no weather on screen; the game side carries on)
      glassCfg: [Math.max(0, s.glassReflect), Math.max(0, s.glassTintDepth), Math.max(0, s.glassDust), s.glassRefract && s.glass ? Math.max(1, Math.min(3, s.glassIor || 1.5)) : 0],   // .w: refraction — the index of refraction while on (≥ 1), 0 = off (composite.wgsl glassRefractPath)
      wxAirSteps: Math.max(0, Math.min(24, Math.round(s.wxAirSteps || 0))),   // the weather air march's step cap (volCfg.w bits 24‥28; 0 = half the tier's beam steps)
      volCfg: [Math.max(0, Math.min(6, Math.round(s.volLightCap || 0))), Math.max(1, Math.min(3, Math.round(s.volShadowEvery || 1))), Math.max(10, Math.min(30, Math.round((s.volStepVoxels || 1.5) * 10))),
        Math.max(3, Math.min(15, Math.round(s.smokeShadowSteps || 8))) | (Math.max(0, Math.min(6, Math.round(s.smokeMarchLights || 0))) << 8) | (Math.max(0, Math.min(15, Math.round((s.smokeMultiScatter ?? 1.0) * 10))) << 12) | (Math.max(0, Math.min(15, Math.round((s.smokeTaaReact ?? 0) * 10))) << 16) | ((s.smokeUpsampleRelax ? 1 : 0) << 20)],   // (+ bits 16‥19 the TAAU smoke reactivity × 10, bit 20 the upsample's depth relax — smoke battery experiments)   // (.w bits 12‥15: the multiple-scattering octave's gain × 10, vol_common.wgsl smokeMsGain)   // (.w bits 8‥11: the march's own lights per step, vol_common.wgsl smokeMarchLights — 0 = the J-lit march as it was)   // volumetric caps: K lights per march step / haze ray (0 = the pass as it was), shadow-ray reuse period, march step in tenths of a voxel; .w = the SHADOW rays' smoke sample count (common.wgsl smokeShadowSteps: 8 = as ever)
      froxelA: [froxNear, froxFar, Math.max(0, s.froxelCurve), froxOn ? fx.historyWeight(s.froxelHistory) : 0],   // froxel volumetrics: the mapping every kernel / consumer shares (common.wgsl froxelDist / froxelSlice) + this frame's history weight (0 on a fresh grid)
      froxelB: fx.allocated ? [fx.grid.w, fx.grid.h, fx.grid.d, Math.max(0, Math.min(6, Math.round(s.froxelK))) | (s.froxelSharp ? 256 : 0) | ((Math.max(1, Math.min(3, Math.round(s.froxelTopRays))) - 1) << 9)] : [0, 0, 0, 0],   // k | sharp << 8 | (strata − 1) << 9
      froxelC: [...fx.jitter(this.frameIdx), Math.max(0, s.froxelBias)] as [number, number, number, number],
      prevCamPos: this.prevCamPos, froxelPrevNear: this.froxelPrevNear || froxNear,   // the eye (TAAU's per-render snapshot, seeded with this frame's on the first) and the near boundary of the previous RENDER — read by the froxel history's reprojection and the specular denoiser's mirror-image validation
      rtCfg: [Math.max(0, Math.min(1, s.rtMaxRough)), Math.max(0, Math.min(4, Math.round(s.rtRays))), Math.max(0, Math.min(1, s.rtAniso)) + 2 * Math.round(10 * Math.max(0, Math.min(1, s.wetBreakup ?? 0))), rtOn ? this.passes.rtDiv : 0],   // .z = the anisotropy 0‥1 + 2 × the wet ground's break-up in tenths (0 = .z is the anisotropy alone, as it always was)
        // .w = 0: the reflection pass is off this frame (nothing reads the rest then)
      matCfg: [Math.max(0, s.rtGlints), Math.max(0, s.rtStrength), 60, Math.max(0, Math.min(1, s.detail))],   // .w = the g-buffer's detail-layer amount (0 = fsBox as it was)
      // phase 5 (ultra extras): the gather's resampling mode + its packed numbers, the reflection pass's mesh / hit-reuse bits — every field 0 = the passes as they were. The mesh bit rides only while
      // the mesh-shadow trees are actually skinned this frame (meshOn): with meshShadows off / unavailable the reflections keep the capsules, as asked
      p5Cfg: [giMode | (giMode && s.giResampleRevalidate ? 16 : 0), (Math.max(1, Math.min(4, Math.round(s.giResampleRays))) & 15) | ((Math.max(2, Math.min(64, Math.round(s.giResampleCap))) & 255) << 8) | ((Math.max(1, Math.min(8, Math.round(s.giResampleTaps))) & 15) << 16) | ((Math.max(2, Math.min(32, Math.round(s.giResampleRadius))) & 255) << 24),
        rtP5Bits, firstTransientNow],
      jitter: [this.jitter[0], this.jitter[1], this.prevJitter[0], this.prevJitter[1]],
      markCfg: [s.markings ? this.world.markingTexel : 0, Math.max(0, Math.min(1, s.markingContrast)), Math.max(0, s.markingEmissive), s.markingReflect ? (s.markingReflPattern === false ? -1 : 1) * (1 + Math.max(0, Math.min(4, s.markingReflCone))) : 0],   // markings: .x 0 = off everywhere; .w 0 = not at reflection hits, else ±(1 + the traced-hit cone's lobe share) — negative = the analytic highlight left uniform (markings.wgsl markConeK / reflect.wgsl)
      sharpCfg: this.sharpOn ? [this.width, this.height, this.outWidth, this.outHeight] : [0, 0, 0, 0],   // sharp direct: the two sizes every twin kernel maps between (z 0 = off: every pass as it was)
      sharpCfgB: [s.sharpEdgeRays ? 1 : 0, Math.max(0.05, s.sharpEdgeSpread), Math.max(0, s.sharpEdgeHintPx), Math.max(1e-4, s.sharpPlaneK)],   // its knobs (edge rays, edge spread, hard-hint width, plane k)
      sharpCfgC: [decouple ? this.jitter[0] : 0, decouple ? this.jitter[1] : 0,   // DECOUPLED JITTER: what every internal ↔ output texel map adds under it (0 = one raster jitter, the sharp path as it was)
        (Math.max(0, Math.min(3, Math.round(s.sharpSliver))) & 3) | ((Math.max(0, Math.min(3, Math.round(s.sharpDiag))) & 3) << 4) | ((Math.max(0, Math.min(64, Math.round(s.sharpSliverCap))) & 127) << 8) | (s.dnShadowOccl ? 1 << 15 : 0),   // .z = the SLIVER rule | diag paint << 4 | per-tile ray cap << 8 (sharp_direct.wgsl; 0 = the fallback as it was) — an exact small integer
        s.gbaaClamp ? 1 : 0],   // .w = GBAA's same-surface clamp (gbaa.wgsl; 0 = the blend as it was)
      rigCfg: [rigBits, Math.max(4, Math.min(64, Math.round(s.charSoftSteps ?? 20))), Math.max(0.05, s.charSoftK ?? 1), Math.tan(Math.max(0.02, Math.min(5, s.charSoftMinDeg ?? 0.35)) * Math.PI / 180)],   // the SDF character rig: the extras' bits (0 = the plain round-cone loops) + the soft query's numbers
      rigCfgB: [Math.max(0, Math.min(3, s.sdfRigK ?? 1)), Math.max(4, Math.min(64, Math.round(s.sdfRigSteps ?? 24))), 0.0015, 0.012],   // × the joint blend radii, closest-hit steps, its epsilon, the soft march's smallest step,
      // GI in motion: the young-history ray multiplier (0 = off — the gather as it was: giYoungRays ≤ 1, the legacy denoiser (no history length to read), phase 5's resampling gather (its reservoirs
      // carry their own confidence), or a cut this frame / the two after), the texel cap (fraction × the gather grid), the 'young' length
      giCfg: (() => { const k = Math.max(1, Math.min(4, Math.round(s.giYoungRays))); const on = k > 1 && s.denoiser !== 'legacy' && giMode === 0 && this.giCutHold === 0 && (s.flags & FrameFlags.Temporal) !== 0 && s.dnGiCap >= 1; return on ? [k, Math.ceil(Math.max(0, Math.min(1, s.giYoungCap)) * this.passes.gw * this.passes.gh), Math.max(1, Math.min(s.giYoungLen, s.dnGiCap)), 0] : [0, 0, 0, 0]; })() as [number, number, number, number],   // (dnGiCap < 1 = the diffuse client keeps no history: every texel would read young every frame; and 'young' can never be more than the cap the stored length saturates at)
    };
    this.froxelPrevNear = froxNear;
    this.passes.smokeSlots = fp.numSmoke;   // (what the shaders are told: 0 = no smoke march anywhere this frame, so the smoke diffusion's blur chain has no reader — passes.ts)
    writeFrame(this.frameData, fp);
    this.device.queue.writeBuffer(this.frameBuf, 0, this.frameData);
    this.passes.edgeRays = !!s.sharpEdgeRays; this.passes.sliverRays = Math.round(s.sharpSliver) >= 1 && Math.round(s.sharpSliverCap) > 0;   // (either ray user picks the sharp kernel's traced variant)
    if (this.sharpOn) { writeFrameOut(this.frameDataOut, this.frameData, this.outWidth, this.outHeight, decouple ? { viewProj: cam.viewProj, invViewProj: cam.invViewProj, prevViewProj: this.prevVpU } : undefined); this.device.queue.writeBuffer(this.frameBufOut, 0, this.frameDataOut); this.ensureSceneBGOut(); this.passes.sceneBGOut = this.sceneBGOut; }   // the OUTPUT frame block + its scene group for the output-size passes (decoupled: with the camera's own unjittered matrices — its raster stands still)
    else this.passes.sceneBGOut = null;
    const jitterRes: [number, number] = decouple ? [0, 0] : this.sharpOn ? [this.jitter[0] * this.outWidth / this.width, this.jitter[1] * this.outHeight / this.height] : this.jitter;   // the resolve reads the jitter in the pixels of the picture it resolves (the output's under sharp direct; none when the output raster is decoupled from the internal jitter)
    if (taauOn) this.passes.setTaauFrame({ prevViewProjU: this.prevVpU, jitter: jitterRes, bypass: s.debugView !== 0, alpha: s.taauAlpha, clipGamma: s.taauClipGamma, reactK: s.taauReactive, kSharp: s.taauKernel, velK: s.taauVelK, sharpen: s.taauSharpen + s.taauSharpenMotion * camMot, camStill, lightJump: s.taauLightJump, motionA: s.taauMotionAlpha, motionClip: s.taauMotionClip, histSharp: s.taauHistSharp,
      particles: partOn && s.debugView === 0 && !!this.particles && this.particles.drawEnabled && this.particles.liveSlots > 0 });   // (the resolve's own uniform: last frame's UNJITTERED view-projection for the output history, this frame's jitter, the knobs; 'particles' = their splat runs this frame, so its reactive mask is fresh)
    // what the NEXT render reprojects with / detects a cut against (snapshotted now: everything above has read the previous values)
    m4.copy(this.prevVpJ, this.vpJ); m4.copy(this.prevVpU, cam.viewProj); this.prevCamPos = v3.copy(cam.pos); this.prevCamFwd = v3.copy(cam.forward);
    this.prevJitter[0] = this.jitter[0]; this.prevJitter[1] = this.jitter[1];

    const t1 = performance.now();
    const timer = this.timer; timer.beginFrame();
    const enc = this.device.createCommandEncoder({ label: 'frame' });
    const ts = (n: string) => timer.pass(n);
    this.fogSight.encode(enc, this.passes.fogOn ? this.fogFrame : null, this.sceneBGPlain!); if (this.fogFrame) this.fogFrame.sight = this.fogSight.live;   // the fog of war's sight table, before anything lights a pixel (a no-op unless the full-picture fog is on)
    if (this.smoke.encode) this.smoke.encode(enc, ts);
    if (meshOn && this.world.charCount > 0) this.meshShadows!.encode(enc, Math.min(this.world.charCount, MESH_MAX_CHARS), ts('mesh'));   // skin + refit every listed character's tree from this frame's joint matrices — before the cascades, the first pass that traces
    this.gbuffer.encode(enc, this.sharpOn ? this.sceneBGOut! : this.sceneBG!, this.world.visibleBuf, this.world.visibleCount, this.skin, this.dummyStorage, this.decals?.buf ?? this.dummyStorage, ts('gbuffer') as GPURenderPassTimestampWrites | undefined, this.world.visibleCutCount, this.cutWhole);   // (the decal buffer is only read under FrameFlags.Decals: without a list the dummy is bound and the flag stays down) — under sharp direct at the OUTPUT size (the output frame block: its pixel-footprint terms mean an output pixel)
    this.gbuffer.encodeDown(enc, this.sceneBG!);   // sharp direct: the internal-size view every internal pass binds, derived from that raster (a no-op with it off)
    this.rc.encode(enc, this.sceneBG!, timer, this.frameIdx);
    const airRuns = !!this.air && this.airOn && s.airSim && this.air.ready !== false;   // THE AIR (above): at most one step a drawn frame, on its own clock; a paused frame (dt 0) steps nothing
    if (airRuns) {
      this.airAcc += dt;
      if (dt > 0 && this.airAcc >= 0.8 / 60 * Math.max(1, s.airEvery || 1)) { this.air!.step(enc, Math.min(this.airAcc, 1 / 30), time, this.airWind, ts('air')); this.airAcc = 0; }
      else timer.idle('air');   // (a frame between two steps — a fast display, airEvery — costs nothing: said, or the pass would go on showing its last step's time)
    }
    if (partOn) this.particles!.setAir(airRuns ? this.air!.view : null);   // (what the particle step reads: the field while it is stepped — its stand-in, still air, otherwise)
    if (partOn && this.particles!.hasWork) this.particles!.encodeUpdate(enc, this.sceneBG!, this.rc.diceView, ts('particles'));   // (only ask the timer for a slot when the pass WILL encode: an allocated-but-unwritten timestamp pair resolves to stale garbage — ultra summed a fictional 7–12 ms 'particles' with nothing alive, 08-10 measurements)   // births + the step (collide against this frame's boxes, shade off this frame's lights and dice) — a return with nothing live
    let canvasView: GPUTextureView;
    if (present) canvasView = this.gpu.ctx.getCurrentTexture().createView();
    else {
      if (!this.offscreenTarget || this.offscreenTarget.width !== this.outWidth || this.offscreenTarget.height !== this.outHeight) {   // (pooled like the real targets under keepHistories, so a scripted resize measures what a presented one costs — the canvas's own backing store aside)
        const desc = { label: 'offscreen', size: [this.outWidth, this.outHeight] as [number, number], format: this.gpu.format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC };
        if (this.settings.keepHistories) { this.pool.release(this.offscreenTarget); this.offscreenTarget = this.pool.acquire(desc).tex; }
        else { this.offscreenTarget?.destroy(); this.offscreenTarget = this.device.createTexture(desc); }
      }
      canvasView = this.offscreenTarget.createView();
    }
    this.passes.directPasses = s.directPasses; this.passes.directHistory = s.directHistory; this.passes.debugView = s.debugView;
    this.passes.gatherStrata = !!s.gatherStrata;   // (stratified gather directions: which gather pipeline pair the encode takes this frame)
    this.passes.glassRefract = !!(s.glassRefract && s.glass && this.world.glassList.length > 0);   // (glass refraction: composite's GLASS_REFRACT twin — only while there is a pane list to bend through; glass off / no panes = the module as it was)
    { const P = this.passes; P.restirOn = s.restir; P.restirRays = s.restirRays; P.restirSpatial = s.restirSpatial; P.restirHistory = s.restirHistory; P.restirRadius = s.restirRadius; P.restirGradient = s.restirGradient; P.restirGradK = s.restirGradK; P.restirYoung = s.restirYoung; P.restirSpatialAll = s.restirSpatialAll; P.restirCoherent = s.restirCoherent; P.restirSampleHue = s.restirSampleHue; P.restirRatioRaw = s.restirRatioRaw; P.restirPermute = s.restirPermute; P.restirPenCap = s.restirPenCap; P.restirPenRays = s.restirPenRays; P.restirAudit = s.restirAudit; P.heldRays = s.heldRays; P.heldAdaptive = !!s.heldAdaptive; P.restirStableRetrace = !!s.restirStableRetrace; P.restirDimClass = s.restirDimClass || 0; P.restirHueSplit = s.restirHueSplit; P.restirKnownDark = s.restirKnownDark; P.restirJitter = this.jitter;
      P.restirMotion = s.restirMotion; P.restirMotionLive = s.restirMotion > 0 && (this.camMovedAny || s.restirMotionStatic); P.restirMotionV = s.restirMotionV; P.restirMotionMin = s.restirMotionMin; P.restirMotionPx = s.restirMotionPx; P.restirMotionDither = s.restirMotionDither; P.restirMotionTaps = s.restirMotionTaps;   // (MOTION: 0 = main's pipeline; passes.encode picks the RESTIR_MOTION twin otherwise)
      if (s.restir) P.writeRestir(this.lights); }   // ReSTIR DI: the settings are the source of truth; the uniform (cfg + last frame's slot maps and light records, kept by lights.upload above) goes up every frame the pass runs
    { // the denoiser: which core, and the v3 clients' knobs (the settings are the source of truth, mirrored like every other pass option)
      this.passes.dnMode = s.denoiser === 'legacy' ? 'legacy' : 'v3';
      const K = this.passes.den.knobs;
      K.shIters = s.dnShadowIters; K.shCap = s.directHistory > 0 ? s.dnShadowCap : 0; K.shClampK = s.dnShadowClampK; K.shSigmaL = s.dnShadowSigmaL; K.shPrior = s.dnShadowPrior; K.shLitAlike = s.dnShadowLitAlike; K.shOccl = s.dnShadowOccl; K.shMoveCap = s.dnShadowMoveCap; K.shMoveThresh = s.dnShadowMoveThresh; K.shJump = s.dnShadowJump;
      K.giIters = s.dnGiIters; K.giCap = s.dnGiCap; K.giClampK = s.dnGiClampK; K.giSigmaL = s.dnGiSigmaL; K.giFast = s.dnGiFast; K.giFirefly = s.dnGiFirefly; K.giClampCut = s.dnGiClampCut; K.giYoungWiden = s.dnGiYoungWiden;
      K.spIters = s.dnSpecIters; K.spCap = s.dnSpecCap; K.spClampK = s.dnSpecClampK; K.spSigmaL = s.dnSpecSigmaL; K.spRough = s.dnSpecRough; K.spMaxRough = s.rtMaxRough; K.rfIters = s.rtAtrous; K.rfCap = s.rtHistory;   // (+ the reflection chain's per-pixel cutoff, its own iteration count and history cap)
      K.depthK = s.dnDepthK; K.normalPow = s.dnNormalPow; K.motionVectors = s.dnMotionVectors;   // (the g-buffer writes gVel on both the TAAU and the FXAA path: prev − now through frame.prevViewProj, jittered or not — consistent with the reprojection either way)
      K.ratioHi = (fp.flags & (FrameFlags.TailChroma | FrameFlags.Restir)) ? 4 : 1;   // the ratio clamp's upper bound: shadowed ≤ unshadowed per channel, except the chroma-exact tail's single samples and the ReSTIR estimator's per-light hues (one warm light under a mixed U tops U's red channel legitimately)
      if (this.passes.dnMode === 'v3' || rtOn) this.passes.den.writeParams({ gatherDiv: this.passes.gatherDiv, reflDiv: rtOn ? this.passes.rtDiv : 0, temporalFlag: (fp.flags & FrameFlags.Temporal) !== 0, shadowTemporal: s.directHistory > 0, historyScale: this.passes.directHistoryScale < 1 ? 0.5 : 1, cueUv: s.restir && (fp.flags & FrameFlags.Restir) !== 0, fullRes: this.passes.giFullOn });   // (the reflection chain is the v3 specular client under either core; + the internal-res diffuse chain's block while that path is wanted)
      this.passes.youngOn = (fp.giCfg?.[0] ?? 0) > 1;   // (GI in motion: the gather's young-texel counter is zeroed each frame the multiplier is up)
    }
    // the particles' splat goes INTO the HDR target between the composite and the bloom (so hot sparks bloom and nothing has a history to smear); debug views keep the screen theirs.
    // Not timestamped: render-pass timings on Metal read as a frame (see CLAUDE.md) and would poison the HUD total and auto quality's calibration — particles.timeDraw opts in for a look
    const overlay = partOn && s.debugView === 0 && this.particles!.drawEnabled ? (e: GPUCommandEncoder) => this.particles!.encodeDraw(e, this.sharpOn ? this.sceneBGOut! : this.sceneBG!, this.passes.hdrView, this.passes.reactView, this.sharpOn ? this.gbuffer.depthOView : this.gbuffer.depthView, this.passes.volView, this.passes.froxels.view, this.particlesTimeDraw ? ts('pdraw') as GPURenderPassTimestampWrites | undefined : undefined, s.particleRain ? this.passes.sceneCopy : null) : undefined;   // (+ the composite's copy for the particle rain's refraction while it rains particles)   // (sharp direct: the splat lands in the OUTPUT-size hdr against the output-size depth)
    this.passes.encode(enc, this.sceneBG!, this.gbuffer, this.rc, canvasView, ts, fp.flags, overlay);
    for (const f of this.extraPasses) f(enc, this.sceneBG!, this.rc.diceView, ts);
    this.gbuffer.snapshotPrev(enc, this.world, this.skin);   // this frame's box transforms + joint palette → the 'previous' buffers the NEXT g-buffer pass reads for its motion vectors (copies at the tail of the command buffer; next frame's uploads are ordered after them)
    timer.resolve(enc);
    this.device.queue.submit([enc.finish()]);
    timer.afterSubmit();
    this.particles?.afterSubmit();
    for (const f of this.afterSubmit) f();
    this.cpuMs.encode = performance.now() - t1;
    this.frameIdx++;
  }
}

export { FrameFlags };
