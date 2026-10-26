// Screen-space lighting passes: direct (full res), indirect gather (half — a third with the lossy option), volumetrics (half — a quarter likewise), composite, then EITHER the TAAU resolve
// (internal → output resolution, taau.wgsl) + bloom + post + sharpen/grain at output resolution, OR (TAAU off) bloom + post + FXAA/grain at internal resolution as it always was.
import { makeBuffer, makeShader, computePipelineAsync, laterPipelineAsync, laterRenderPipelineAsync, renderPipelineAsync, writeWordsIfChanged, PIPE_QUEUE } from '../gpu/device';
import { shaderText } from '../gpu/wgslTrim';
import { FrameFlags, scenePrelude, MAX_CARDS } from './frame';
import { Mat4 } from '../math/vec';
import taauSrc from './shaders/taau.wgsl' with { type: 'text' };
import sharpSrc from './shaders/sharp_direct.wgsl' with { type: 'text' };   // SHARP DIRECT: the unshadowed direct term re-scored per OUTPUT pixel × the internal visibility ratio (docs/internal/sharp-direct.md)
import sharpEdgeSrc from './shaders/sharp_edge.wgsl' with { type: 'text' };   // its hard-shadow-edge mask (internal size) for the edge rays
import { GBuffer } from './gbuffer';
import { RadianceCascades } from './rc';
import lightingCommon from './shaders/lighting_common.wgsl' with { type: 'text' };
import directSrc from './shaders/direct.wgsl' with { type: 'text' };
import directCommonSrc from './shaders/direct_common.wgsl' with { type: 'text' };
import restirSrc from './shaders/restir.wgsl' with { type: 'text' };
import { LightSet, MAX_LIGHTS } from './lights';
import volSrc from './shaders/volumetrics.wgsl' with { type: 'text' };
import dustLookSrc from './shaders/dust_look.wgsl' with { type: 'text' };
import { dustLookVol } from './dustLookVol';
import { DUST_DRAW } from '../smoke/dustTint';
import volCommon from './shaders/vol_common.wgsl' with { type: 'text' };
import compositeSrc from './shaders/composite.wgsl' with { type: 'text' };
import fireSrc from './shaders/fire.wgsl' with { type: 'text' };   // the open fires' flame, coals and drawn smoke (game/fire.ts): compiled into the composite, ahead of its own text
import fxaaSrc from './shaders/fxaa.wgsl' with { type: 'text' };
import softblurSrc from './shaders/softblur.wgsl' with { type: 'text' };
import temporalSrc from './shaders/temporal.wgsl' with { type: 'text' };
import fgatherSrc from './shaders/fgather.wgsl' with { type: 'text' };
import gatherCommonSrc from './shaders/gather_common.wgsl' with { type: 'text' };   // light / card staging, RNG, directAtPoint — shared by fgather and reflect
import reflectSrc from './shaders/reflect.wgsl' with { type: 'text' };
import markingsSrc from './shaders/markings.wgsl' with { type: 'text' };   // markings (scene/markings.ts): composite adds their emission at the primary hit, the reflection passes evaluate them at their hits
import reflectP5Src from './shaders/reflect_p5.wgsl' with { type: 'text' };   // renderer v3 phase 5's variant of the reflection pass (mesh closest-hit + hit-lighting reuse); reflect.wgsl stays main's text so the pass every tier runs with the bits down is the same PROGRAM, not just the same statements (a kernel carrying the dormant code compiled to last-bit-different light picks on Metal)
import bloomSrc from './shaders/bloom.wgsl' with { type: 'text' };
import diffuseBlurSrc from './shaders/diffuse_blur.wgsl' with { type: 'text' };
import postSrc from './shaders/post.wgsl' with { type: 'text' };
import giblurSrc from './shaders/giblur.wgsl' with { type: 'text' };
import dtemporalSrc from './shaders/dtemporal.wgsl' with { type: 'text' };
import softtileSrc from './shaders/softtile.wgsl' with { type: 'text' };
import cardsSrc from './shaders/cards.wgsl' with { type: 'text' };
import decalsSrc from './shaders/decals.wgsl' with { type: 'text' };
import gbaaSrc from './shaders/gbaa.wgsl' with { type: 'text' };   // GBAA: single-frame geometric edge AA off the g-buffer's edge offsets (image-quality program C3)
import refractCommonSrc from './shaders/refract_common.wgsl' with { type: 'text' };   // the pure refraction helpers composite's glass shares with the particle rain (prepended to composite; no bindings)
import { decalWgslConsts } from './decals';
import { TexturePool, TargetOps, texBytes } from './texpool';
import { Froxels } from './froxels';
import { Denoiser, dnTravel } from './denoise';
import type { Box } from '../scene/boxes';
import { cutSwap, ProgramSet, type CutSwappable } from './cutSwap';   // CUT BOXES: the tracing pipelines exist twice under the switch — the boot's (no cut rule) and a second set behind it, swapped per frame
import { tuned } from './shaderTune';   // the scene tweak panel's constant overrides (empty map = compositeSrc itself)
import { FogPass, type FogFrame } from './fogofwar';   // FOG OF WAR (game/fogofwar.ts): one in-place pass over the composite while its switch is on — nothing while off
import { OutlinePass, type OutlineFrame } from './outline';   // THE OUTLINE IN THE DARK (host/findme.ts): one scissored blend onto the composite while its Options row is on — nothing while off

const CS = GPUShaderStage.COMPUTE, FS = GPUShaderStage.FRAGMENT;

// Direct-light denoise chain per emitter class. Textures: S (raw estimate; also where the RESULT must end up, consumers
// bind it), P (shared scratch), H0/H1 (this class's temporal history, ping-pong). Spatial pass i uses stride
// STRIDES[i]. With history on the chain is  T: S→H[new]  then  H→P, P→S, S→P, …; without it  S→P, P→S, …; if the
// requested pass count would leave the result in P, one extra stride-1 pass brings it home to S (see buildChain). Under
// FrameFlags.SoftTileSkip every step also retires whole 8x8 tiles that are provably out of reach of any penumbra hint (skipThreshold).
const STRIDES = [1, 2, 4, 8, 16, 1, 1];
// Tile-level pass-through (FrameFlags.SoftTileSkip; softtile.wgsl builds the mask, the exactness argument is at the top of softblur.wgsl's
// main). A hint moves at most STRIDE px per pass, so after the chain step whose cumulative stride sum is `travelPx` only pixels within that
// Chebyshev distance of a hint-carrying pixel can differ from their input; pixels of tiles t apart are >= 8(t-1)+1 px apart, hence a whole
// 8x8 tile passes the step through once its tile distance to the nearest hint-holding tile reaches
const skipThreshold = (travelPx: number) => Math.floor((travelPx - 1) / 8) + 2;
// Per step: pipeline (= stride), which way it ping-pongs, and the threshold that step alone would need. The mask applies ONE threshold to
// the whole chain — the last step's, which is the largest (travel only accumulates) and therefore safe for every step — and a skipped tile
// copies its input texel to its output at every step, exactly what the per-pixel path stores there, so both ping-pong textures evolve
// step by step as they always did: nothing leans on texels surviving from an earlier step or frame.
type ChainStep = { pipe: number; bg: 'S2P' | 'P2S' | 'H2P'; skipT: number };
function buildChain(passes: number, history: boolean): ChainStep[] {
  const steps: ChainStep[] = [];
  let at: 'S' | 'P' | 'H' = history ? 'H' : 'S'; let travel = 0;
  const step = (pipe: number, bg: ChainStep['bg']) => { travel += STRIDES[pipe]; steps.push({ pipe, bg, skipT: skipThreshold(travel) }); };
  const n = Math.max(history ? 1 : 0, Math.min(passes, 6));       // with history at least one pass must move H → … → S
  for (let i = 0; i < n; i++) {
    if (at === 'H') { step(i, 'H2P'); at = 'P'; }
    else if (at === 'S') { step(i, 'S2P'); at = 'P'; }
    else { step(i, 'P2S'); at = 'S'; }
  }
  if (at === 'P') step(6, 'P2S');                                   // settle home (stride 1)
  return steps;
}
/** the chain-wide threshold: the last step's (1+2+4+1 = 8 px → 2 for the default 3 passes + history; 1+2+4+8+16+1 = 32 px → 5 at 6 passes) */
const chainSkipT = (chain: ChainStep[]) => chain.length ? chain[chain.length - 1].skipT : 2;
/** every threshold a (passes, history) setting can produce ({2, 3, 5} today) — one tileDistances pipeline each (threshold and scan radius are consts in the module) */
const ALL_SKIP_T = [...new Set([false, true].flatMap(h => [0, 1, 2, 3, 4, 5, 6].map(n => chainSkipT(buildChain(n, h)))))].sort((a, b) => a - b);

/** One re-allocation of a set of targets (a resize, or a divisor flip): what to zero, what to resample from what, what to park afterwards — settled in finishRealloc */
interface Realloc { toClear: GPUTexture[]; toRelease: GPUTexture[]; blits: { src: GPUTexture; dst: GPUTexture }[]; nearest: { src: GPUTexture; dst: GPUTexture }[]; nearestU: { src: GPUTexture; dst: GPUTexture }[]; created: number; reused: number; what: string[] }
const SU = () => GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC;   // (COPY_SRC: scripted measurement reads the linear intermediates back — tools/qa/perf-harness.js readTexture) — a function: the usage enums do not exist at module load under plain Bun (tools/qa)
const RT = () => GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;

/** What the engine hands the TAAU resolve each frame (engine.render → setTaauFrame): last frame's unjittered view-projection, this frame's jitter (internal px), the knobs, and the two facts only
 *  the engine knows — a debug view is up (bypass: plain upscale) and the particles' splat runs this frame (their reactive mask is fresh). */
export interface TaauFrame { prevViewProjU: Mat4; jitter: [number, number]; bypass: boolean; alpha: number; clipGamma: number; reactK: number; kSharp: number; velK: number; sharpen: number; camStill: boolean; particles: boolean; lightJump: number; motionA: number; motionClip: number   /** history de-blur under motion (taau.wgsl histSharp): 0 = off */
  histSharp?: number;
}
const TAAU_PARAM_BYTES = 144;   // struct TaauParams in taau.wgsl: mat4 (64) + 3 vec2 + 11 scalars → 132, rounded to the struct's 16-byte alignment
/** restir.wgsl RestirU ahead of prevLights: cfg (16) + cfg2 (16) + jitter (16) + mot (16) + fwd (64) + inv (64) = 192 B (was 176 before the MOTION vec4 — direct-motion lane) */
/** lasers / tracers handed to the reflection pass (setBeams): segments at most, and the uniform's size — 16 B of count + 48 B a segment (reflect.wgsl `Beams`) */
const BEAM_MAX = 8, BEAM_HEAD = 32, BEAM_SEG_BYTES = BEAM_HEAD + BEAM_MAX * 48, FIRE_MAX = 4, FIRE_REC = 64, FIRE_AT = BEAM_SEG_BYTES, FIRE_LOOK_AT = FIRE_AT + 16 + FIRE_MAX * FIRE_REC, FIRE_LOOK_FLOATS = 16, BEAM_BYTES = FIRE_LOOK_AT + FIRE_LOOK_FLOATS * 4;   // (header: n, flags, 2 spare words, then k: vec4f — reflect.wgsl / composite.wgsl `Beams` … and behind the segments, for the composite alone, THE OPEN FIRES: a count word + FIRE_MAX records of 4 vec4f — fire.wgsl FireRec, setFires — and behind those the look's twelve numbers, fire.wgsl FireLook, setFireLook)
/** one open fire as the composite draws it (game/fire.ts makes them; shaders/fire.wgsl FireRec) */
export interface FireRecord { pos: ArrayLike<number>; r: number; h: number; heat: number; seed: number; time: number; wind: ArrayLike<number>; flick: number; /** the bed of coals' radius, m (0 or absent = none drawn) */ bed?: number; /** under the fog of war (RtLight.fog's numbers): 0 or absent = drawn wherever it stands · 1 = only where the team sees · 2 = only where it does not */ fog?: number; /** how much of its flame is the smoke solver's gas (0‥1; game/fire.ts FIRE.gas) */ gas?: number }
const RESTIR_U_HEAD = 192, RESTIR_U_FWD = 64, RESTIR_U_INV = 128;
const TF = { Reset: 1, Bypass: 2, Particles: 4, Velocity: 8 } as const;   // TaauParams.flags (TF_* in taau.wgsl)
/** composite.wgsl as bundled (the scene tweak panel lists its constants off it: render/shaderTune.ts shaderConsts) */
export function compositeText(): string { return compositeSrc; }

export class LightingPasses implements CutSwappable {
  width = 0; height = 0;
  /** OUTPUT size (the canvas): = width / height with TAAU off; the cap's rows with it on (engine.ts resize). ldr, the bloom pyramid and the resolve's history pair live at this size. */
  ow = 0; oh = 0;
  /** engine.settings.taau, mirrored by the engine every frame BEFORE resize (setTaau): the resolve runs, its history pair exists, bloom / post read the resolved picture, the final blit sharpens
   *  instead of FXAA. Off = the chain exactly as it was. */
  taauOn = false;
  /** SHARP DIRECT (docs/internal/sharp-direct.md; engine mirrors it before resize — setSharp): the g-buffer is rasterised and the composite + TAA run at the OUTPUT size (cw × ch = ow × oh)
   *  — U (unshadowed direct), albedo, emissive, glass, decals native — while every stochastic term keeps its INTERNAL grid and is joint-bilateral upsampled: sharp_direct.wgsl writes the output-size
   *  shadowed direct pair `sharpE` (U(out) × the internal S∕U per class), composite.wgsl's compute twin (SHARP = true) reads it with the output-size g-buffer, taau.wgsl resolves 1 : 1. Off: cw × ch =
   *  the internal size and the fragment composite / the upsampling resolve exactly as they were. Needs TAAU (the output-size history) — the engine only raises it then. */
  sharpOn = false; cw = 0; ch = 0;
  /** FOG OF WAR (render/fogofwar.ts; engine mirrors the game's FogFrame.on before resize — setFog): after GBAA and before the resolve, pixels none of the team's eyes see are dimmed in place
   *  (hdr is a storage texture that can be copied from then, as under GBAA). Off = no texture, no pass, hdr as it was. */
  fogOn = false; fogFrame: FogFrame | null = null; private fogPass: FogPass | null = null;
  setFog(on: boolean) { if (on !== this.fogOn) { const was = this.hdrUsage(); this.fogOn = on; if (this.hdrUsage() !== was) this.compStale = true; if (!on) this.fogPass?.release(); } }   // (the composite's set is re-made only when the fog changes what hdr must be: with GBAA on — every tier's default — hdr is already a storage texture that can be copied from, and re-making the set made a second hdr / hdrCopy / sharpE pair of the same description, 53 MB at high, beside the first one parked for a minute and a half)
  /** the outline in the dark (render/outline.ts; the engine mirrors its frame each render, null under a debug view): its pass is made the first frame the row is on */
  outline: OutlineFrame | null = null; private outlinePass: OutlinePass | null = null;
  /** THE OUTLINE BY THE PICTURE reads a copy of the composite (render/outline.ts; the engine mirrors the frame's `on` + `picture` before resize): where
   *  GBAA runs that is GBAA's own hdrCopy and this changes nothing; where it does not (render resolution at 100 %, TAAU off) the copy is kept for the
   *  outline — hdr may be copied from, hdrCopy exists — and filled just before its pass. Off = no texture and hdr as it was. */
  outlineCopyOn = false;
  setOutlineCopy(on: boolean) { if (on !== this.outlineCopyOn) { const was = this.hdrUsage(), had = this.copyOn; this.outlineCopyOn = on; if (this.hdrUsage() !== was || this.copyOn !== had) this.compStale = true; } }   // (as setFog: the composite's set is re-made only when this changes what it must hold)
  /** is a copy of the composite kept (hdrCopy; hdr can be copied from): GBAA reads one, the particle-rain experiment's refraction reads the same one, the outline by the picture a third */
  private get copyOn(): boolean { return this.gbaaOn || this.sceneCopyOn || this.outlineCopyOn; }
  /** what the composite's hdr target must be able to do, by the switches that read or rewrite it (reallocComp makes it so; a switch that does not change this needs no new target) */
  private hdrUsage(): GPUTextureUsageFlags { const copyOn = this.copyOn; return RT() | (this.sharpOn || this.gbaaOn || this.fogOn ? GPUTextureUsage.STORAGE_BINDING : 0) | (copyOn || this.fogOn ? GPUTextureUsage.COPY_SRC : 0); }
  /** GBAA (gbaa.wgsl; engine mirrors settings.gbaa before resize — setGbaa): after the composite (+ the particles' splat) and before the resolve, every composite pixel an analytic box edge crosses is
   *  blended with its neighbour across that edge by the far side's exact coverage — hdr is copied to hdrCopy and rewritten in place (so hdr is a storage texture then). Off = no copy, no pass. */
  gbaaOn = false; private hdrCopy: GPUTexture | null = null; private hdrCopyView: GPUTextureView | null = null;
  /** PARTICLE RAIN v2 (experiment): the rain streaks refract THIS copy of the composite — with GBAA on it is GBAA's own (a frame behind at splat time, refreshed after it: free); with GBAA off,
   *  `sceneCopyOn` keeps an hdrCopy of the same shape and gives hdr COPY_SRC so the particles can fill it right before their splat (engine.ts overlay). Off = no texture, nothing changes. */
  sceneCopyOn = false;
  /** what the particles' splat is handed for the rain's refraction: the copy's view + (only when nobody else fills it) the copy job; null with no copy texture */
  get sceneCopy(): { view: GPUTextureView; copy?: { src: GPUTexture; dst: GPUTexture; w: number; h: number } } | null { return this.hdrCopy && this.hdrCopyView ? (this.gbaaOn ? { view: this.hdrCopyView } : { view: this.hdrCopyView, copy: { src: this.hdr, dst: this.hdrCopy, w: this.cw, h: this.ch } }) : null; } private lGbaa!: GPUBindGroupLayout; private pGbaa: GPUComputePipeline | null = null; private bgGbaa: GPUBindGroup | null = null; private buildGbaa!: () => void;
  /** the composite- or output-size sets want re-making at an unchanged size (a TAAU / sharp / GBAA switch): the engine's resize test reads it */
  get stale() { return this.outStale || this.compStale; }
  /** settings.sharpEdgeRays (engine mirrors it): the mask kernel runs only while the edge rays are wanted */
  edgeRays = false;
  /** settings.sharpSliver ≥ 1 with a ray cap > 0 (engine mirrors it): the sharp kernel's TRACED variant is the one dispatched (sliver pixels ray their strongest light — sharp_direct.wgsl SLIVERS); with
   *  both this and edgeRays off the tracer-free pipeline runs, as before */
  sliverRays = false;
  private sharpWarned = false;
  sharpE: GPUTexture[] = []; sharpEView: GPUTextureView[] = [];
  /** the hard-shadow-edge mask (internal size, r32uint: bit 0 sharp class, bit 1 broad) sharp_edge.wgsl builds from the denoised direct pair for the edge rays */
  sharpMask: GPUTexture | null = null; sharpMaskView: GPUTextureView | null = null;
  /** the OUTPUT frame block's scene group (engine.ts sceneBGOut: frame.screen = the output size) — group 0 of every pass that runs at the output size under sharp; set by the engine each frame it is on */
  sceneBGOut: GPUBindGroup | null = null;
  private compStale = false;
  /** engine.settings.keepHistories, mirrored by the engine every frame BEFORE setDivisors / resize: a change of internal size resamples the temporal histories into the new
   *  targets and recycles targets through `pool` (render/texpool.ts has the measurements); off = destroy, create, restart — the old path */
  keepHistories = true;
  private ops: TargetOps;
  /** what the last (re)allocation did — the perf recorder / the Tab panel word it: 'resize 1777×1000→1422×800: 40 pooled 0 new, 10 histories resampled, 12 cleared (0.6 ms cpu)' */
  lastRealloc = '';
  /** count of (re)allocations so far (the recorder keys its event on a change) */
  reallocs = 0;
  /** the largest target set allocated so far (bytes): the pool's budget follows it */
  private peakBytes = 0;
  /** frames encoded since the direct-light histories were last resampled across a size change (large = long ago). A resampled history is the right MEAN at the new resolution but
   *  bilinear-soft by up to a texel, which on a hard shadow edge is worth more than the noise it damps: so the direct pass's history weight (frame.directCfg.w) runs at ½ on the
   *  first frame after a carry and ¾ on the second (directHistoryScale — the engine multiplies it in), i.e. lower confidence rather than none. The indirect's carry needs no such
   *  thing (measured: half the error of a restart from frame 0, and none of its 5 % dip in bounce light). */
  private directCarryAge = 99;
  get directHistoryScale(): number { return this.directCarryAge === 0 ? 0.5 : this.directCarryAge === 1 ? 0.75 : 1; }
  /** low-res target sizes: the final gather (indirect, its history and à-trous ping-pong) at 1/gatherDiv, the volumetrics at 1/volDiv */
  gw = 0; gh = 0; vw = 0; vh = 0;
  /** resolution divisors: gather 2, or 3 with the lossy `gatherThird` option; volumetrics 2, or 4 with `volQuarter` (setDivisors; the shaders read them from frame.lossyCfg.xy) */
  gatherDiv = 2; volDiv = 2;
  // direct lighting, two emitter classes (0 sharp, 1 broad): S = shadowed estimate + blur hint (and the final result), U = exact
  // unshadowed; one shared ping-pong scratch P (classes are denoised one after the other); H = per-class temporal history
  // (ping-pong) + one shared view-depth history for validating it
  dS: GPUTexture[] = []; dU: GPUTexture[] = []; dP: GPUTexture[] = []; dSView: GPUTextureView[] = []; dUView: GPUTextureView[] = []; dPView: GPUTextureView[] = [];
  dH: GPUTexture[][] = [[], []]; dHView: GPUTextureView[][] = [[], []]; dDepthHist: GPUTexture[] = []; dDepthHistView: GPUTextureView[] = []; dParity = 0;
  /** live knobs mirrored from engine settings each frame (passes 0-6, history weight) */
  directPasses = 6; directHistory = 0.7;
  /** the composite's debug view this frame (engine mirrors settings.debugView): views 11 / 12 = the ReSTIR diagnostics, which the filter chain must not touch */
  debugView = 0;
  /** ReSTIR DI (renderer v3 Phase 2a, shaders/restir.wgsl) — mirrored from engine settings each frame; `restirOn` false = the direct.wgsl pipeline exactly as it was.
   *  rays = shadow rays per pixel per frame (2‥6), spatial = neighbour taps, history = M cap, radius = spatial radius in px at 1000 rows (scaled to the target),
   *  gradient / gradK = the per-tile temporal-gradient confidence and its threshold, young = M under which spatial reuse runs when the budget has no final ray,
   *  spatialAll = spatial reuse everywhere regardless (A/B), sampleHue = A/B: shade every sample in its own light's hue (the first cut) instead of the belief-weighted class hue,
   *  knownDark = the lights the tile's own rays found dark leave the fresh draw (restir.wgsl BELIEFS; false = the unbiased first-cut draw, A/B), audit = the share of lanes
   *  spending one extra ray a frame re-testing those lights. */
  restirOn = true; restirRays = 4; restirSpatial = 3; restirHistory = 20; restirRadius = 16; restirGradient = true; restirGradK = 3.5; restirYoung = 8; restirSpatialAll = false; restirCoherent = false; restirSampleHue = false; restirRatioRaw = false; restirAudit = 0.25; restirKnownDark = true; restirPermute = false; restirPenCap = 0; restirPenRays = false;
  /** the HYBRID estimator (direct-quality lane, docs/internal/direct-quality.md): K stratified rays for each of the two carried leaders at a pixel, 0 = off (restir.wgsl HELD) — engine mirrors settings.heldRays */
  heldRays = 6; restirHueSplit = true;   // (+ the hue split: ru.cfg.w & 128 — restir.wgsl HUE SPLIT; false = the belief hue as it was)
  /** THE LIGHTING TRADES (restir.wgsl TRADES; engine mirrors settings.heldAdaptive / restirStableRetrace / restirDimClass — all off by default = the estimator's program and uniform
   *  exactly as they were): each gives up a little accuracy for shadow rays. While any is on the encode takes restir.wgsl's RESTIR_TRADE twin, compiled on FIRST USE (every prelude ×
   *  motion variant the page can take, together) — a boot with the rows off compiles nothing new; until the twin exists the frame takes the plain program (which never reads the rows' bits). */
  heldAdaptive = false; restirStableRetrace = false; restirDimClass = 0;
  private restirTrade = new Map<string, GPUComputePipeline | null>();   // 'b' | 'bm' | 'c' | 'cm' (boot / cut prelude, + the motion twin) → the pipeline; null = compiling, or it failed (the plain program stays)
  private restirTradeHot = false;   // a hot-swapped restir (hotSwapDirect: __hotRestir / __hotCommon) has no trade twin — the hot program is what runs, the rows stay without effect until a reload
  private restirTradePipe(motion: boolean): GPUComputePipeline | null {
    if (this.restirTradeHot) return null;
    const cut = this.cutLive;
    for (const c of cutSwap.enabled ? [cut, !cut] : [cut]) for (const m of [motion, !motion]) {   // (both motion twins — and, under the cut switch, both preludes — asked for together: the first camera move, or the first cut piece, after a row goes on does not start a compile of its own)
      const key = (c ? 'c' : 'b') + (m ? 'm' : '');
      if (this.restirTrade.has(key)) continue;
      this.restirTrade.set(key, null);
      const code = (c ? scenePrelude(true) : scenePrelude()) + directCommonSrc + `const RESTIR_MOTION: bool = ${m};\nconst RESTIR_TRADE: bool = true;\n` + restirSrc;
      this.device.createComputePipelineAsync({ label: 'restirT' + (m ? 'M' : ''), layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lDirect, this.lRestir] }), compute: { module: makeShader(this.device, code, 'restirT' + (m ? 'M' : '')), entryPoint: 'main' } })
        .then(p => { if (!this.restirTradeHot) this.restirTrade.set(key, p); }, e => console.error('[restir] the trade twin did not compile — the rows stay without effect', e));
    }
    return this.restirTrade.get((cut ? 'c' : 'b') + (motion ? 'm' : '')) ?? null;
  }
  /** MOTION (lane fix/direct-motion, docs/internal/direct-motion.md; restir.wgsl header MOTION): bitmask 1 = stochastic-bilinear reservoir reprojection, 2 = motion-scaled confidence,
   *  4 = spatial reuse wherever the pixel moves; 0 = the estimator's program exactly as it was (the RESTIR_MOTION = false pipeline). V = the screen motion in px a frame AT 1000 INTERNAL ROWS (scaled to the target like restirRadius)
   *  under which the history keeps full confidence — the cut ramps to Min (fraction of the M cap) by 1.6 × V, Px = the motion (px a frame at 1000 rows, scaled alike) past which (4) opens the spatial pass. Engine mirrors settings.restirMotion*. */
  restirMotionLive = false;   // this frame dispatches the RESTIR_MOTION twin: restirMotion ≠ 0 AND the camera moved (or settings.restirMotionStatic) — engine decides; a still camera runs main's program
  restirMotion = 0; restirMotionV = 1.1; restirMotionMin = 0.1; restirMotionPx = 0.5; restirMotionDither = false; restirMotionTaps = 0;   // (taps: (4)'s spatial tap count at a moving pixel when above the tier's own k; 0 = the tier's k)   // (dither: (1)'s pick is ONE global sub-pixel offset a frame — a bijective shift, ru.mot.w 1 — instead of a per-pixel bilinear draw, 0)
  private pRestirM: GPUComputePipeline | null = null;   // (a LATER twin: null until it is in — traceJobs; the encode takes pRestir meanwhile) restir.wgsl compiled a second time behind `const RESTIR_MOTION: bool = true` (pRestir carries `false` = main's text const-folded back to itself)
  /** this frame's TAAU jitter in internal pixels (engine.jitter; 0,0 without TAAU) */
  restirJitter: [number, number] = [0, 0];
  private restirJitterPrev: [number, number] = [0, 0];   // the previous restir dispatch's jitter (its reservoirs were reprojected / traced in that raster)
  /** reservoir ping-pong (16 B / px, 8×8-tiled, whole tiles, + 16 B of light beliefs per tile) + the pass's uniform (cfg, slot maps, last frame's lights); rebuilt at every internal size (zeroed = no history) */
  private resBuf: GPUBuffer[] = []; private restirU: GPUBuffer; private restirRanLast = false; private restirBeliefsStale = false; private restirUData = new ArrayBuffer(RESTIR_U_HEAD + MAX_LIGHTS * 64); private restirU32 = new Uint32Array(this.restirUData); private restirF32 = new Float32Array(this.restirUData); private restirU8 = new Uint8Array(this.restirUData); private bgRestir: (GPUBindGroup | null)[] = [null, null]; private rParity = 0;
  /** bytes of the two reservoir buffers (the Tab panel words it) */
  get restirBytes(): number { return this.resBuf.reduce((n, b) => n + b.size, 0); }
  /** THE DENOISER SWITCH (engine.settings.denoiser, mirrored each frame): 'v3' = render/denoise.ts's one core for the shadow / diffuse / specular signals; 'legacy' = dtemporal +
   *  softblur, temporal + giblur, the gloss chain — the three paths below exactly as they were (?legacydenoise boots with it) */
  dnMode: 'v3' | 'legacy' = 'v3';
  private dnModeLast: 'v3' | 'legacy' = 'v3';   // (the boot's zeroed histories suit either core; only a live SWITCH needs the direct ones started over — encode)
  readonly den: Denoiser;
  /** the v3 core's own targets (all pooled / carried across a resize like the legacy histories — full res: the shadow client's (hints, lumU) ping-pong, its luminance moments (history,
   *  ping-pong on dParity) and its packed depth | history-length (r32uint, likewise); gather res: the diffuse client's moments + fast history and the specular's moments (ping-pong on parity).
   *  The accumulated VALUES live in the legacy textures' slots: dH[c][p] (shadow ratio + variance), indHist[p] / specHist[p] (rgb + view depth, today's layout). */
  dnShared: GPUTexture[] = []; dnSharedView: GPUTextureView[] = []; dnHm: GPUTexture[] = []; dnHmView: GPUTextureView[] = []; dnHg: GPUTexture[] = []; dnHgView: GPUTextureView[] = [];
  giMom: GPUTexture[] = []; giMomView: GPUTextureView[] = []; giFast: GPUTexture[] = []; giFastView: GPUTextureView[] = []; specMom: GPUTexture[] = []; specMomView: GPUTextureView[] = [];
  /** tile pass-through mask on the chain's 8x8 grid (tw x th): per-tile hint flag, then (tile distance to the nearest flagged tile | skip bit 256) under the chain-wide threshold */
  tileFlag: GPUTexture | null = null; tileDist: GPUTexture | null = null; tileFlagView!: GPUTextureView; tileDistView!: GPUTextureView; tw = 0; th = 0;
  /** threshold the mask was last built with (softTileStats reports against it) */
  private lastSkipT = 0;
  indirect!: GPUTexture; vol!: GPUTexture; ldr!: GPUTexture; indHist: GPUTexture[] = []; indHistView: GPUTextureView[] = []; parity = 0;
  /** TAAU: the resolve's output-resolution history pair (rgba16f linear scene-referred, ping-pong on taaParity: frame reads [1−p], writes [p], and bloom / post read [p]) — allocated only while
   *  taauOn; `react` = the particles' reactive mask (r8unorm, INTERNAL res: the second colour target of their splat, cleared by that pass — read by the resolve only on frames the splat ran);
   *  `volReact` = the rain / sky-flash luminance the volumetric pass added per texel (r32float at the volumetric res, written every frame that pass runs, 0 without weather) */
  taaHist: GPUTexture[] = []; taaHistView: GPUTextureView[] = []; taaParity = 0;
  react!: GPUTexture; reactView!: GPUTextureView; volReact!: GPUTexture; volReactView!: GPUTextureView;
  /** the next resolve takes no history (resetTaa: a cut, TAAU switched on, the pair re-created without a carry); cleared by the frame that honours it */
  private taaReset = true;
  /** the RCAS sharpen strength the final blit applies under TAAU (engine mirrors settings.taauSharpen through setTaauFrame) */
  private taauSharpen = 0.25;
  /** how many resolves have run / been reset (QA + the panel) */
  taaStats = { frames: 0, resets: 0, lastFlags: 0 };
  /** half-res ping-pong for the indirect à-trous (history stays unblurred in indHist) */
  gi: GPUTexture[] = []; giView: GPUTextureView[] = [];
  /** GI IN MOTION — the v3 diffuse client at the INTERNAL resolution (settings.giFullRes → setGiFull; docs/internal/gi-motion.md): giF[2] = the à-trous ping-pong at internal res (giF[1] doubles as the
   *  guided upsample's target — the temporal step has read it before the chain writes there; giF[0] = what composite reads while the path is live), giFHist / giFMom / giFFast = its history,
   *  moments and fast history (ping-pong on `parity`, pooled + carried across a resize like indHist). Made on FIRST use (an off tier pays no memory: 8 × internal rgba16f ≈ 67 MB at high's
   *  1368×770), let go after GIF_IDLE_FRAMES off. While live the gather-grid diffuse chain does not run (its histories go stale: cleared on the way back). */
  giF: GPUTexture[] = []; giFView: GPUTextureView[] = []; giFHist: GPUTexture[] = []; giFHistView: GPUTextureView[] = []; giFMom: GPUTexture[] = []; giFMomView: GPUTextureView[] = []; giFFast: GPUTexture[] = []; giFFastView: GPUTextureView[] = [];
  giFullOn = false; giFullIters = 4; private giFullEverOn = false; private giFullRanLast = false; private giFullIdle = 0;
  /** the young-history gather rays (frame.giCfg): the per-frame first-come counter the gather bumps (u32 count + 3 spare), zeroed by the encode each frame the multiplier is up; `youngOn` mirrored by the engine */
  private youngBuf!: GPUBuffer; youngOn = false;
  /** read the young-texel count of the last frame back (QA / the Tab panel: how much of the grid took the extra rays) */
  async readYoungCount(): Promise<number> { const rb = this.device.createBuffer({ size: 16, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); const enc = this.device.createCommandEncoder(); enc.copyBufferToBuffer(this.youngBuf, 0, rb, 0, 16); this.device.queue.submit([enc.finish()]); await rb.mapAsync(GPUMapMode.READ); const n = new Uint32Array(rb.getMappedRange().slice(0))[0]; rb.unmap(); rb.destroy(); return n; }
  private static readonly GIF_IDLE_FRAMES = 600;
  /** the internal-res diffuse chain runs THIS frame (wanted, the v3 core, allocated, its pipelines ready FOR THE CURRENT STRIDE SET — prepareFull is idempotent: true when they exist, else it starts
   *  the missing compiles and the gather-grid chain carries the frame): composite binds giF[0], the young-history test reads giFMom / giFHist */
  get giFullLive(): boolean { return this.giFullOn && this.dnMode === 'v3' && this.giF.length === 2 && this.den.prepareFull(this.fullStrides()); }
  /** frames the young-history gather rays should stand down because the diffuse histories were just restarted wholesale (restartHistories, a keepHistories-off resize, the denoiser switch): every
   *  texel would read young for giYoungLen frames — the engine folds it into frame.giCfg's cut hold and counts it down */
  youngHold = 0;
  /** bytes the internal-res GI set holds (the Tab panel words it) */
  get giFullBytes(): number { let n = 0; for (const t of [...this.giF, ...this.giFHist, ...this.giFMom, ...this.giFFast]) n += t.width * t.height * 8; return n; }
  /** the à-trous strides at internal res: the raw gather's divisor × 1, 2, 4, 8 (the gather-grid chain's reach on the ground), as many as giFullIters */
  private fullStrides(): number[] { const g = this.gatherDiv; return [1, 2, 4, 8, 16].slice(0, Math.max(1, Math.min(5, Math.round(this.giFullIters)))).map(s => s * g); }
  /** glossy floors (FrameFlags.Gloss, default off): the gather's specular output at gather res + its own history pair. Chain per frame with the flag on:
   *  fgather → spec; temporal (spec, specHist[1-p]) → specHist[p]; ONE à-trous pass (stride 1) specHist[p] → spec; composite reads spec. Flag off: fgather
   *  stores nothing there, neither dispatch runs, composite never reads it — the textures merely exist (3 × gw×gh rgba16f). */
  spec!: GPUTexture; specView!: GPUTextureView; specHist: GPUTexture[] = []; specHistView: GPUTextureView[] = [];
  /** the specular client's fast pair on the gather grid (v3 denoiser: a real ping-pong pair for the glass / legacy-gloss field — its per-pixel mode is off there, the slot rides along) */
  specFast: GPUTexture[] = []; specFastView: GPUTextureView[] = [];
  /** RAY-TRACED REFLECTIONS (renderer v3 phase 4; reflect.wgsl → the shared denoiser's specular client in per-pixel mode → composite): their own target set at 1/rtDiv of the internal size
   *  (rw × rh), pooled and carried across a resize / divisor change like the gather's — refl (the trace's raw radiance + hit distance, then the à-trous chain's home: composite reads it),
   *  reflHist[2] (accumulated rgb + view depth), reflMom[2] (moments / history length / variance), reflFast[2] (the smoothed hit distance), reflScratch (à-trous ping-pong).
   *  Chain per frame while rtOn: reflect → refl ('reflect'); specTemporal (refl, hist[1−p]) → hist[p], mom[p], fast[p]; radAtrous × rfIters ending in refl ('rdenoise'). */
  refl!: GPUTexture; reflView!: GPUTextureView; reflScratch!: GPUTexture; reflScratchView!: GPUTextureView;
  reflHist: GPUTexture[] = []; reflHistView: GPUTextureView[] = []; reflMom: GPUTexture[] = []; reflMomView: GPUTextureView[] = []; reflFast: GPUTexture[] = []; reflFastView: GPUTextureView[] = [];
  rw = 0; rh = 0; rtDiv = 2; rtOn = false; rtParity = 0;
  /** the pass has been on at least once: until then reallocRefl makes a 1×1 `refl` for the composite's binding and no histories */
  private rtEverOn = false;
  /** the pass ran last frame (an off → on edge starts its histories clean: whatever they hold is radiance of some other minute whose depths may still validate) */
  private rtRanLast = false;
  /** PHASE 5 — the reflection pass's HIT RECORDS (settings.rtHitReuse, engine mirrors it into `rtHitReuse`): per reflection texel last frame's {hit point, its normal, the lighting found there, count},
   *  rgba32uint ping-pong on `hitParity` at the reflection grid; a 1×1 stand-in pair until first use (reflect.wgsl reads / writes them only while frame.p5Cfg.z bit 2 is up), re-made with the
   *  reflection set, never carried (a record names a point in the world, not a pixel: cleared instead) */
  reflHit: GPUTexture[] = []; reflHitView: GPUTextureView[] = []; rtHitReuse = false; private hitEverOn = false; private hitParity = 0; private hitRanLast = false;
  /** PHASE 5 — the final gather's RESERVOIRS (settings.giResample, engine → setGi): per gather texel ONE secondary sample {hit point, normal, outgoing radiance, W, M, receiver signature} in two
   *  rgba32uint textures (A, B), ping-pong sets on `giParity` at the gather grid. Made on first use (an off machine — every tier but ultra — pays nothing), re-made with the gather set on a
   *  resize / divisor flip and CLEARED then (a resampled reservoir would name the wrong texel's sample), cleared on every off → on edge. The resampling gather is its own pipeline (fgather.wgsl
   *  entry point mainGi, layout lFGR); `main` and its layout are untouched. */
  giRes: GPUTexture[][] = [[], []]; giResView: GPUTextureView[][] = [[], []]; giOn = false; private giEverOn = false; private giParity = 0; private giRanLast = false;
  /** bytes of the phase-5 sets (the Tab panel words them) */
  get p5Bytes(): number { let n = 0; for (const t of [...this.giRes.flat(), ...this.reflHit]) n += t.width * t.height * 16; return n; }
  /** torch bounce cards (FrameFlags.BounceCards, default off): MAX_CARDS × 4 rgba32f rows written by cards.wgsl (one workgroup per nominated light) inside the 'gather'
   *  pass and read by fgather; `numCards` = how many the engine nominated this frame (0 = the builder is not dispatched and the gather touches nothing) */
  cards: GPUTexture; cardsView: GPUTextureView; numCards = 0;
  /** the decal buffer the composite reads for the glass cracks (Decals.buf, set by the engine each frame; a 32-byte dummy while none is attached — it is only
   *  read under FrameFlags.Decals, which the engine never raises then). A change of buffer rebuilds the composite bind group alone. */
  private decalBuf: GPUBuffer | null = null; private decalDummy: GPUBuffer; private compDecalBuf: GPUBuffer | null = null;
  setDecalBuffer(b: GPUBuffer | null) { if (b !== this.decalBuf) { this.decalBuf = b; if (this.compDecalBuf !== (b ?? this.decalDummy)) { this.bgCompFG = null; this.bgCompS = null; } } }
  /** HDR scene colour (composite output) + bloom pyramid: down[0..4] (W/2 … W/32), up[0..3] */
  hdr!: GPUTexture; hdrView!: GPUTextureView; bloomDown: GPUTexture[] = []; bloomUp: GPUTexture[] = []; bloomDownView: GPUTextureView[] = []; bloomUpView: GPUTextureView[] = [];
  /** the smoke diffusion's source: this frame PLAINLY box-downsampled to W/2, W/4, W/8 (post.wgsl reads the last two) — not the bloom chain, whose Karis-weighted first level
   *  under-weights bright pixels and would put a dark moat round a backlit front seen through smoke; made with the bloom chain, dispatched only while smokeDiffuse > 0 */
  diffDown: GPUTexture[] = []; diffDownView: GPUTextureView[] = [];
  /** … then band-limited: diffTmp[i] = the horizontal Gaussian of level i, diffBlur[i] = + the vertical (i = 1 quarter, 2 eighth; index 0 unused) — post.wgsl reads diffBlur[1] / [2] */
  diffTmp: (GPUTexture | undefined)[] = []; diffBlur: (GPUTexture | undefined)[] = []; diffTmpView: (GPUTextureView | undefined)[] = []; diffBlurView: (GPUTextureView | undefined)[] = [];
  private bgDiffBlur: GPUBindGroup[] = [];
  /** post look: bloom strength (fraction of the blurred frame added back) and AgX look saturation */
  bloom = 0.06; saturation = 1.15; grain = 0.022; nvPhosphor = 0.09;
  /** the goggles' dark eyepiece edge over the picture: 0 = none (the default: it hid too much of the screen), 1 = the oval as it was (`?nvoval=1`, or the Look panel's row) */
  nvOval = 0;
  /** how strongly smoke blurs what stands behind it in the final blit (post.wgsl SMOKE DIFFUSION; set by the Tab row / ?nosmokediffuse; 0 = the blit as it was, the chain not dispatched) */
  smokeDiffuse = 1.0;
  /** how many of the smoke's bounds this frame's shaders walk (frame.numSmoke, mirrored by the engine). 0 = the volumetric pass writes a smoke transmittance of exactly 1 into every
   *  texel of volReact.g (its three smoke marches are all behind `frame.numSmoke > 0u`), post.wgsl's diffusion weight is then 0 at every pixel and it never samples the two blurred
   *  levels — so the chain that makes them is not dispatched */
  smokeSlots = 0;
  /** EXPERIMENT (settings.smokeDiffuseWeight === 'bilinear', mirrored by the engine): the diffusion weight from a plain bilinear of the smoke transmittance instead of the four-texel max */
  smokeDiffuseBilinear = false;
  /** the optical depth under which the diffusion leaves what is behind the smoke alone (post.wgsl diffuseTau0; engine mirrors settings.smokeDiffuseStart) */
  smokeDiffuseTau0 = 0.35;
  indirectView!: GPUTextureView; volView!: GPUTextureView; ldrView!: GPUTextureView;
  /** what consumers bind as 'direct' (sharp class, denoised) and 'soft' (broad class, denoised): the chain always ends in S */
  get directView(): GPUTextureView { return this.dSView[0]; }
  get softView(): GPUTextureView { return this.dSView[1]; }
  /** LASERS / TRACERS IN THE REFLECTIONS: those boxes are NoShadow (no ray meets one), so the reflection pass is handed the nearest BEAM_MAX of them as line segments
   *  (reflect.wgsl / reflect_p5.wgsl `beams`, group 1 binding 11: count, then per segment from + half-width · to · emitted rgb) and adds their mirror image analytically.
   *  Picture only: read off the list the picture is drawn from (what the fog of war hid or an infrared beam nobody's tube shows is not in it). Count 0 = the pass as it was. */
  private beamBuf!: GPUBuffer; private beamData = new Float32Array(BEAM_SEG_BYTES / 4); private beamN = -1;
  /** …and, `opts.air` given (settings.beamAir), THE SQUAD'S WEAPON LASERS AS LIGHT IN THE AIR: a line `opts.air` knows (thinline.ts thinAirOf → its bead or null) is handed over
   *  with the air's share `opts.A` in e.w and whether it ends on a dot in b.w, composite.wgsl `beamAir` adds it to the picture as a thin additive line + dot, and the line and bead
   *  boxes are RETURNED so the raster leaves them out this frame (BoxWorld.hidePrimary). Lasers go first inside the cap; one past it stays a box. Header: n · flags (1 = mirror
   *  images on, 2 = the air look on) · k = (rain rate, the wet film's share for the reflection pass (settings.wetMirror; 0 = off), 0, 0). Nothing here writes a box. */
  private beamHide = new Set<Box>();
  setBeams(list: Box[] | null, is: (b: Box) => boolean, focus: ArrayLike<number>, opts: { reflect: boolean; air: ((b: Box) => Box | null | undefined) | null; A: number; rain: number; wet: number }): Set<Box> | null {
    const F = this.beamData, U = new Uint32Array(F.buffer); let n = 0; const hide = this.beamHide; hide.clear();
    if (list) {
      const found: { b: Box; d: number; bead: Box | null | undefined }[] = [];
      for (const b of list) if (is(b)) { const bead = opts.air ? opts.air(b) : undefined; if (bead === undefined && !opts.reflect) continue;
        const dx = b.c[0] - focus[0], dy = b.c[1] - focus[1], dz = b.c[2] - focus[2]; found.push({ b, d: dx * dx + dy * dy + dz * dz, bead }); }
      if (found.length > BEAM_MAX || opts.air) found.sort((p, q) => (p.bead === undefined ? 1 : 0) - (q.bead === undefined ? 1 : 0) || p.d - q.d);
      for (const { b, bead } of found) { if (n >= BEAM_MAX) break;
        let zx: number, zy: number, zz: number;
        if (b.rot) { const [x, y, z, w] = b.rot; zx = 2 * (x * z + w * y); zy = 2 * (y * z - w * x); zz = 1 - 2 * (x * x + y * y); } else { zx = Math.sin(b.yaw); zy = 0; zz = Math.cos(b.yaw); }
        const L = b.h[2], e = b.emissive ?? [0, 0, 0], o = BEAM_HEAD / 4 + n * 12, air = bead !== undefined;
        F[o] = b.c[0] - zx * L; F[o + 1] = b.c[1] - zy * L; F[o + 2] = b.c[2] - zz * L; F[o + 3] = b.h[0];
        F[o + 4] = b.c[0] + zx * L; F[o + 5] = b.c[1] + zy * L; F[o + 6] = b.c[2] + zz * L; F[o + 7] = air && bead ? 1 : 0;
        // a laser aimed at open ground: the game's reach does not meet the yard's floor, so the line ran on under it with no dot. In the air look it ends AT the ground, with its dot
        if (air && F[o + 5] < 0 && F[o + 1] > 0) { const t = F[o + 1] / (F[o + 1] - F[o + 5]); F[o + 4] = F[o] + (F[o + 4] - F[o]) * t; F[o + 6] = F[o + 2] + (F[o + 6] - F[o + 2]) * t; F[o + 5] = 0; F[o + 7] = 1; }
        F[o + 8] = e[0]; F[o + 9] = e[1]; F[o + 10] = e[2]; F[o + 11] = air ? opts.A : 0; n++;
        if (air) { hide.add(b); if (bead) hide.add(bead); } }
    }
    if (n === 0 && this.beamN === 0 && F[5] === opts.wet) return null;
    U[0] = n; U[1] = (opts.reflect ? 1 : 0) | (opts.air ? 2 : 0); F[4] = opts.rain; F[5] = opts.wet; F[6] = 0; F[7] = 0;
    this.beamN = n; this.device.queue.writeBuffer(this.beamBuf, 0, F.buffer, 0, BEAM_HEAD + n * 48);
    return hide.size ? hide : null;
  }
  /** THE OPEN FIRES (game/fire.ts → engine.fires): the nearest FIRE_MAX as records behind the beam segments, in the same uniform — the composite's fireOver draws
   *  each one's flame, coals and drawn smoke along the pixel's ray (shaders/fire.wgsl). Picture only. None = a zero count, written once: the composite as it was. */
  private fireData = new Float32Array((16 + FIRE_MAX * FIRE_REC) / 4); private fireN = -1;
  setFires(list: readonly FireRecord[] | null | undefined) {
    const n = Math.min(list?.length ?? 0, FIRE_MAX);
    if (n === 0 && this.fireN === 0) return;
    const F = this.fireData; new Uint32Array(F.buffer)[0] = n;
    for (let i = 0; i < n; i++) { const r = list![i], o = 4 + i * (FIRE_REC / 4);
      F[o] = r.pos[0]; F[o + 1] = r.pos[1]; F[o + 2] = r.pos[2]; F[o + 3] = r.r;
      F[o + 4] = r.h; F[o + 5] = r.heat; F[o + 6] = r.seed; F[o + 7] = r.time;
      F[o + 8] = r.wind[0]; F[o + 9] = r.wind[1]; F[o + 10] = r.flick; F[o + 11] = r.gas ?? 0;
      F[o + 12] = r.bed ?? 0; F[o + 13] = r.fog ?? 0; F[o + 14] = 0; F[o + 15] = 0; }
    this.fireN = n; this.device.queue.writeBuffer(this.beamBuf, FIRE_AT, F.buffer, 0, 16 + n * FIRE_REC);
  }
  /** … and THE LOOK'S NUMBERS every fire is drawn with (game/fire.ts FIRE.look → engine.fireLook; fire.wgsl FireLook: sixteen floats in its order), written when they move */
  private fireLook = new Float32Array(FIRE_LOOK_FLOATS); private fireLookSet = false;
  setFireLook(look: ArrayLike<number> | null | undefined) {
    if (!look) return;
    const L = this.fireLook; let same = this.fireLookSet;
    for (let i = 0; i < FIRE_LOOK_FLOATS; i++) { const v = Math.fround(+look[i] || 0); if (L[i] !== v) { L[i] = v; same = false; } }
    if (same) return;
    this.fireLookSet = true; this.device.queue.writeBuffer(this.beamBuf, FIRE_LOOK_AT, L.buffer, 0, FIRE_LOOK_FLOATS * 4);
  }
  private lRefl: GPUBindGroupLayout; private pRefl!: GPUComputePipeline; private bgRefl: GPUBindGroup | null = null;   // main's reflection pass, untouched (every tier with the phase-5 bits down)
  private lReflP5: GPUBindGroupLayout; private pReflP5: GPUComputePipeline | null = null; private bgReflP5: (GPUBindGroup | null)[] = [null, null];   // phase 5's variant (reflect_p5.wgsl): + the hit records, per parity (reads reflHit[1−p], writes reflHit[p]); dispatched instead while frame.p5Cfg.z ≠ 0 (`rtP5`, engine.render mirrors it)
  rtP5 = false;
  /** phase 5: the resampling gather (fgather.wgsl mainGi) — the plain gather's bindings + last frame's reservoir pair (read), this frame's (written), the g-buffer's motion vectors; per reservoir parity */
  private lFGR: GPUBindGroupLayout; private pFGR: GPUComputePipeline | null = null; private bgFGR: (GPUBindGroup | null)[] = [null, null];
  /** STRATIFIED GATHER DIRECTIONS (settings.gatherStrata, ported from exp/trace-perf E8 — docs/internal/trace-perf.md §2.10): the gather module compiled a second time behind
   *  `const GATHER_STRATA: bool = true` (its k-th ray drawn from stratum (k + frame) mod 4 — a whole 8×8 tile shares the stratum, so its rays walk the grid coherently: −13‥16 % of the
   *  gather pass at high, quality neutral or better). engine.render mirrors settings.gatherStrata into `gatherStrata`; the gather encode picks the pipeline pair by it, so it flips live
   *  for A/B. Both pairs are boot pipelines (async); the false pair is the module exactly as it was. */
  gatherStrata = false; private pFGs!: GPUComputePipeline; private pFGRs: GPUComputePipeline | null = null;
  private lDirect: GPUBindGroupLayout; private lRestir: GPUBindGroupLayout; private pRestir!: GPUComputePipeline; private lVol: GPUBindGroupLayout; private lComp: GPUBindGroupLayout; private lFxaa: GPUBindGroupLayout; private lSoft: GPUBindGroupLayout; private lTileFlags: GPUBindGroupLayout; private lTileDist: GPUBindGroupLayout; private lTemp: GPUBindGroupLayout; private lDTemp: GPUBindGroupLayout; private lFG: GPUBindGroupLayout; private lGiBlur: GPUBindGroupLayout; private lBloom: GPUBindGroupLayout; private lPost: GPUBindGroupLayout; private lCards: GPUBindGroupLayout; private lTaau: GPUBindGroupLayout;
  private pDirect: GPUComputePipeline | null = null; private pVol!: GPUComputePipeline; private pComp: GPURenderPipeline | null = null; private pCompR: GPURenderPipeline | null = null; private pFxaa!: GPURenderPipeline; private pDen: GPUComputePipeline[] = []; private pTileFlags!: GPUComputePipeline; private pTileDist = new Map<number, GPUComputePipeline>(); private pTemp!: GPUComputePipeline; private pDTemp: GPUComputePipeline[] = []; private pFG: GPUComputePipeline | null = null; private pGiBlur: GPUComputePipeline[] = []; private pBloomDown0!: GPUComputePipeline; private pDiffBlurH!: GPUComputePipeline; private pDiffBlurV!: GPUComputePipeline; private pBloomDown!: GPUComputePipeline; private pBloomUp!: GPUComputePipeline; private pPost!: GPURenderPipeline; private postParams: GPUBuffer; private pCards!: GPUComputePipeline; private pTaau!: GPUComputePipeline; private taauParams: GPUBuffer; private taauData = new ArrayBuffer(TAAU_PARAM_BYTES); private taauF32 = new Float32Array(this.taauData); private taauU32 = new Uint32Array(this.taauData);
  private bgDirect: GPUBindGroup | null = null; private bgVol: GPUBindGroup | null = null; private bgFxaa: GPUBindGroup | null = null; private bgDen: GPUBindGroup[] = []; private bgDenH: GPUBindGroup[] = []; private bgTileFlags: GPUBindGroup | null = null; private bgTileDist: GPUBindGroup | null = null; private bgDTemp: GPUBindGroup[] = []; private bgTemp: (GPUBindGroup | null)[] = [null, null];
  /** the plain gather's group per history parity p: fgather's nine + last frame's diffuse moments / value history (bindings 14 / 15 — the young-history test reads the length and the depth key at
   *  the reprojected texel; the gather-grid pair, or the internal-res pair while that path is live: `bgFGFull` says which the groups were built with) */
  private bgFG: (GPUBindGroup | null)[] = [null, null]; private bgFGFull = false;
  private bgGiBlur: (GPUBindGroup | null)[][] = [[], []]; private bgCompFG: GPUBindGroup | null = null; private bgCards: GPUBindGroup;
  private bgTempSpec: (GPUBindGroup | null)[] = [null, null]; private bgGiBlurSpec: (GPUBindGroup | null)[] = [null, null];   // the gloss chain's per-parity groups (same layouts / pipelines as the indirect's temporal + giblur)
  /** bloom's first downsample and the post pass read the RESOLVED picture under TAAU — one bind group per history parity — or `hdr` (index 0 only) without it; the resolve's own group per parity */
  private bgBloomDown0: GPUBindGroup[] = []; private bgBloomDown: GPUBindGroup[] = []; private bgBloomUp: GPUBindGroup[] = []; private bgPost: GPUBindGroup[] = []; private bgDiffDown0: GPUBindGroup[] = []; private bgDiffDown: GPUBindGroup[] = []; private bgTaau: (GPUBindGroup | null)[] = [null, null];
  // SHARP DIRECT: the output-size kernels — sharpU (sharp_direct.wgsl), the composite's compute twin (composite.wgsl cs, SHARP = true), the 1 : 1 resolve (taau.wgsl, SHARP = true) — and their groups
  private lSharpU: GPUBindGroupLayout; private pSharpU: GPUComputePipeline | null = null; private pSharpUE: GPUComputePipeline | null = null; private bgSharpU: GPUBindGroup | null = null;
  private lEdge: GPUBindGroupLayout; private pEdge: GPUComputePipeline | null = null; private bgEdge: GPUBindGroup | null = null;
  private lCompS: GPUBindGroupLayout; private pCompS: GPUComputePipeline | null = null; private pCompSR: GPUComputePipeline | null = null; private bgCompS: GPUBindGroup | null = null;
  /** GLASS REFRACTION (settings.glassRefract; engine.render mirrors it here while the pane list is live): composite.wgsl compiled a second time behind `const GLASS_REFRACT: bool = true` —
   *  the view ray bent through every glass box, the surface behind read where it comes out (composite.wgsl glassRefractPath / refractedRead over refract_common.wgsl) — as pCompR and,
   *  for the sharp path, pCompSR; false = the module exactly as it was (hash-identical). The encode picks the pair by this each frame, so it flips live; both pairs are boot pipelines. */
  glassRefract = false;
  private pTaauS: GPUComputePipeline | null = null; private bgTaauS: (GPUBindGroup | null)[] = [null, null];
  /** the sharp-direct pipelines are compiled on FIRST use (a tier that never turns the feature on never pays for the composite's compute twin, sharp_direct ×2 and the 1 : 1 resolve): built by
   *  the constructor's closure, `edge` = the edge-ray variants too */
  private buildSharp!: (edge: boolean, mask: boolean) => void;
  private ensureSharp(edge: boolean, mask = false) { if (!this.pSharpU || (edge && !this.pSharpUE) || (mask && !this.pEdge)) this.buildSharp(edge, mask); }   // (mask: the edge rays' own mask kernel — compiled the first frame THEY are on, not the first frame the slivers' traced kernel is)
  private fxaaParams: GPUBuffer;
  fxaaEnabled = true;
  /** LOOK ONLY: some of the live smoke is destruction dust this frame (the engine mirrors SmokeBinding.dusty) → the volumetric pass runs its dust twin; false = pVol, the pass as ever */
  dustLook = false; private pVolDust: GPUComputePipeline | null = null;
  /** settings.volLightCap is 0 (engine mirrors it): the K = 0 smoke march, which only its own twin carries (volumetrics.wgsl VOL_K0) — built the first frame it is asked for; until it is in, the boot's program runs (no smoke march) */
  volK0 = false; private pVolK0: GPUComputePipeline | null = null; private volK0Asked = false;
  /** the volumetric pass's froxel-tier twin (volumetrics.wgsl VOL_FROXEL_MARCH true; a LATER pipeline — traceJobs) */
  private pVolF: GPUComputePipeline | null = null;
  get volFReady(): boolean { return !!this.pVolF; }
  private volK0Pipe(): GPUComputePipeline | null {
    if (!this.volK0Asked) {
      this.volK0Asked = true;
      const src = volSrc.replace('const VOL_K0: bool = false;', 'const VOL_K0: bool = true;');   // (VOL_FROXEL_MARCH stays true: the twin draws every tier)
      void computePipelineAsync(this.device, { label: 'volK0', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lVol] }), compute: { module: makeShader(this.device, scenePrelude() + lightingCommon + volCommon + src, 'volumetricsK0'), entryPoint: 'main' } }).then(p => { this.pVolK0 = p; });
    }
    return this.pVolK0;
  }
  /** FROXEL VOLUMETRICS (renderer v3 Phase 2b, render/froxels.ts): dispatched inside the 'volumetrics' pass, ahead of the 2D pass, while FrameFlags.FroxelVol is up (the engine configures the
   *  grid and raises the flag; the 2D pass then marches only the smoke — lit from the froxels' J volume — and the rain), timed as 'volFroxel' beside the 2D pass's 'volumetrics';
   *  `froxelSplitTiming` = time cull+inject / temporal / integrate as separate passes ('volInject' 'volTemporal' 'volInteg') for measurement */
  froxels: Froxels; froxelSplitTiming = false;
  private compFroxView: GPUTextureView | null = null; private volFroxView: GPUTextureView | null = null;
  /** the froxel volumes were (re)made or let go: the composite's and the 2D pass's bind groups name their views */
  froxelViewsChanged() { this.bgCompFG = null; this.bgCompS = null; this.bgVol = null; }

  constructor(private device: GPUDevice, private sceneLayout: GPUBindGroupLayout, private canvasFormat: GPUTextureFormat, private linSamp: GPUSampler, readonly pool: TexturePool = new TexturePool(device)) {
    this.ops = new TargetOps(device, linSamp);
    const pre = scenePrelude();
    const tex2d = (sampleType: GPUTextureSampleType = 'float'): GPUBindGroupLayoutEntry['texture'] => ({ sampleType, viewDimension: '2d' });
    this.lDirect = device.createBindGroupLayout({ label: 'direct', entries: [
      { binding: 0, visibility: CS, texture: tex2d('depth') },
      { binding: 1, visibility: CS, texture: tex2d('float') },
      { binding: 2, visibility: CS, texture: tex2d('uint') },
      { binding: 3, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 4, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 5, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 6, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 7, visibility: CS, texture: tex2d('float') },   // gVel (the g-buffer's object motion, TAAU's): restir.wgsl reprojects its reservoirs through it; direct.wgsl does not declare it (an unused layout entry)
    ] });
    const stor16: GPUStorageTextureBindingLayout = { access: 'write-only', format: 'rgba16float', viewDimension: '2d' };
    this.lSoft = device.createBindGroupLayout({ label: 'softblur', entries: [   // both emitter classes in one dispatch
      { binding: 0, visibility: CS, texture: tex2d('depth') }, { binding: 1, visibility: CS, texture: tex2d('float') },
      { binding: 2, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 3, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 4, visibility: CS, storageTexture: stor16 }, { binding: 5, visibility: CS, storageTexture: stor16 },
      { binding: 6, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 7, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 8, visibility: CS, texture: tex2d('uint') },   // tile mask (softtile.wgsl): bit 256 = this tile passes every step of the chain through
    ] });
    const storU32: GPUStorageTextureBindingLayout = { access: 'write-only', format: 'r32uint', viewDimension: '2d' };
    this.lTileFlags = device.createBindGroupLayout({ label: 'softtileFlags', entries: [   // S0, S1 → per-tile hint flag
      { binding: 0, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 1, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 2, visibility: CS, storageTexture: storU32 } ] });
    this.lTileDist = device.createBindGroupLayout({ label: 'softtileDist', entries: [     // flags → per-tile distance (own group: the flag texture is sampled here, written there)
      { binding: 3, visibility: CS, texture: tex2d('uint') }, { binding: 4, visibility: CS, storageTexture: storU32 } ] });
    this.lDTemp = device.createBindGroupLayout({ label: 'dtemporal', entries: [   // both classes + the shared depth history in one dispatch
      { binding: 0, visibility: CS, texture: tex2d('depth') },
      { binding: 1, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 2, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 3, visibility: CS, texture: tex2d('float') }, { binding: 4, visibility: CS, texture: tex2d('float') },
      { binding: 5, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 6, visibility: CS, storageTexture: stor16 }, { binding: 7, visibility: CS, storageTexture: stor16 },
      { binding: 8, visibility: CS, storageTexture: { access: 'write-only', format: 'r32float', viewDimension: '2d' } },
    ] });
    this.lTemp = device.createBindGroupLayout({ label: 'temporal', entries: [
      { binding: 0, visibility: CS, texture: tex2d('depth') },
      { binding: 1, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 2, visibility: CS, texture: tex2d('float') },
      { binding: 3, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
    ] });
    this.lFG = device.createBindGroupLayout({ label: 'fgather', entries: [
      { binding: 0, visibility: CS, texture: tex2d('depth') },
      { binding: 1, visibility: CS, texture: tex2d('float') },
      { binding: 2, visibility: CS, texture: tex2d('uint') },
      { binding: 3, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 4, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 5, visibility: CS, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 6, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 7, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },   // glossy floors' specular (written only under FrameFlags.Gloss)
      { binding: 8, visibility: CS, texture: tex2d('unfilterable-float') },   // torch bounce cards (rgba32f rows from cards.wgsl; read only under FrameFlags.BounceCards)
      { binding: 14, visibility: CS, texture: tex2d('unfilterable-float') },  // GI in motion (the young-history test, frame.giCfg.x > 1): last frame's diffuse MOMENTS (history length in .z) …
      { binding: 15, visibility: CS, texture: tex2d('unfilterable-float') },  // … and value history (view depth in .a — the disocclusion key), gather grid or internal res
      { binding: 16, visibility: CS, buffer: { type: 'storage' } },            // … and the frame's young-texel counter (16 B: the cap's first-come; cleared each frame the path is on) — one storage buffer in the compute stage: scene 8 at ultra + 1 = 9 of 10
    ] });
    this.youngBuf = makeBuffer(device, 16, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 'giYoung');
    this.lCards = device.createBindGroupLayout({ label: 'cards', entries: [ { binding: 0, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba32float', viewDimension: '2d' } } ] });   // (a texture, not an 11th storage buffer: the scene group already sits at the adapter's per-stage budget — frame.ts meshBinding)
    this.cards = device.createTexture({ label: 'bounceCards', size: [MAX_CARDS, 4], format: 'rgba32float', usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC }); this.cardsView = this.cards.createView();
    this.bgCards = device.createBindGroup({ layout: this.lCards, entries: [{ binding: 0, resource: this.cardsView }] });
    this.lGiBlur = device.createBindGroupLayout({ label: 'giblur', entries: [
      { binding: 0, visibility: CS, texture: tex2d('depth') },
      { binding: 1, visibility: CS, texture: tex2d('float') },
      { binding: 2, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 3, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
    ] });
    this.lBloom = device.createBindGroupLayout({ label: 'bloom', entries: [
      { binding: 0, visibility: CS, texture: tex2d('float') },
      { binding: 1, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 2, visibility: CS, texture: tex2d('unfilterable-float') },
    ] });
    this.lPost = device.createBindGroupLayout({ label: 'post', entries: [
      { binding: 0, visibility: FS, texture: tex2d('unfilterable-float') },
      { binding: 1, visibility: FS, texture: tex2d('float') },
      { binding: 2, visibility: FS, buffer: { type: 'uniform' } },
      { binding: 3, visibility: FS, texture: tex2d('float') },   // volReact (.g = the SMOKE-only transmittance) — the smoke diffusion's weight
      { binding: 4, visibility: FS, texture: tex2d('float') },   // diffDown[1]: this frame plainly box-downsampled to a quarter size
      { binding: 5, visibility: FS, texture: tex2d('float') },   // diffDown[2]: an eighth
    ] });
    this.lVol = device.createBindGroupLayout({ label: 'vol', entries: [
      { binding: 0, visibility: CS, texture: tex2d('depth') },
      { binding: 1, visibility: CS, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 2, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 3, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },   // volReact (.r; .g = smoke-only transmittance for post's diffusion): the rain / sky-flash luminance added per texel (the TAAU resolve's reactive input)
      { binding: 4, visibility: CS, texture: { sampleType: 'float', viewDimension: '3d' } },   // the froxels' smoke source-radiance volume J (render/froxels.ts; read by the smoke march under FrameFlags.FroxelVol, a dummy otherwise)
    ] });
    const reflEntries: GPUBindGroupLayoutEntry[] = [   // reflect.wgsl: g-buffer depth / normal / id, the denoised direct pair, the dice, out refl, the g-buffer's albedo + material
      { binding: 0, visibility: CS, texture: tex2d('depth') }, { binding: 1, visibility: CS, texture: tex2d('float') }, { binding: 2, visibility: CS, texture: tex2d('uint') },
      { binding: 3, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 4, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 5, visibility: CS, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 6, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 7, visibility: CS, texture: tex2d('float') }, { binding: 8, visibility: CS, texture: tex2d('float') },
      { binding: 11, visibility: CS, buffer: { type: 'uniform' } },   // the BEAMS (setBeams): lasers / tracers as line segments — a uniform, not a storage buffer (the scene group sits at the adapter's storage limit); 9 / 10 are phase 5's
    ];
    this.beamBuf = device.createBuffer({ label: 'reflBeams', size: BEAM_BYTES, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.lRefl = device.createBindGroupLayout({ label: 'reflect', entries: reflEntries });   // (main's layout, entry for entry)
    this.lReflP5 = device.createBindGroupLayout({ label: 'reflectP5', entries: [ ...reflEntries,   // + phase 5's hit records: last frame's read, this frame's written
      { binding: 9, visibility: CS, texture: tex2d('uint') }, { binding: 10, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba32uint', viewDimension: '2d' } },
    ] });
    this.lFGR = device.createBindGroupLayout({ label: 'fgatherGi', entries: [   // the resampling gather (mainGi): fgather's nine + reservoirs in A/B (uint), out A/B (rgba32uint), gVel
      { binding: 0, visibility: CS, texture: tex2d('depth') }, { binding: 1, visibility: CS, texture: tex2d('float') }, { binding: 2, visibility: CS, texture: tex2d('uint') },
      { binding: 3, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 4, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 5, visibility: CS, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 6, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 7, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 8, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 9, visibility: CS, texture: tex2d('uint') }, { binding: 10, visibility: CS, texture: tex2d('uint') },
      { binding: 11, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba32uint', viewDimension: '2d' } }, { binding: 12, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba32uint', viewDimension: '2d' } },
      { binding: 13, visibility: CS, texture: tex2d('float') },
    ] });
    this.lTaau = device.createBindGroupLayout({ label: 'taau', entries: [
      { binding: 0, visibility: CS, texture: tex2d('float') },                 // hdr (internal)
      { binding: 1, visibility: CS, texture: tex2d('depth') },                 // g-buffer depth (internal)
      { binding: 2, visibility: CS, texture: tex2d('float') },                 // history (output res, filterable: Catmull-Rom through the linear sampler)
      { binding: 3, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },   // out = the other history
      { binding: 4, visibility: CS, texture: tex2d('float') },                 // particles' reactive mask (internal, r8unorm)
      { binding: 5, visibility: CS, texture: tex2d('unfilterable-float') },    // volReact (r32float)
      { binding: 6, visibility: CS, texture: tex2d('float') },                 // g-buffer object motion (rg16float)
      { binding: 7, visibility: CS, buffer: { type: 'uniform' } },
    ] });
    this.lGbaa = device.createBindGroupLayout({ label: 'gbaa', entries: [   // GBAA: the composite's copy, the g-buffer's edge offsets, hdr as the storage target
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'unfilterable-float', viewDimension: '2d' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'float', viewDimension: '2d' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, texture: { sampleType: 'depth', viewDimension: '2d' } } ] });
    const compEntries: GPUBindGroupLayoutEntry[] = [
      { binding: 0, visibility: FS, texture: tex2d('float') },
      { binding: 1, visibility: FS, texture: tex2d('float') },
      { binding: 2, visibility: FS, texture: tex2d('depth') },
      { binding: 3, visibility: FS, texture: tex2d('uint') },
      { binding: 4, visibility: FS, texture: tex2d('unfilterable-float') },
      { binding: 5, visibility: FS, texture: tex2d('unfilterable-float') },
      { binding: 6, visibility: FS, texture: tex2d('unfilterable-float') },
      { binding: 7, visibility: FS, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 8, visibility: FS, texture: tex2d('unfilterable-float') },
      { binding: 9, visibility: FS, texture: tex2d('unfilterable-float') },   // glossy floors' filtered specular (read only for gloss pixels under FrameFlags.Gloss)
      { binding: 10, visibility: FS, buffer: { type: 'read-only-storage' } },   // the decal buffer (render/decals.ts): the crack stars rounds leave ON glass panes, evaluated at the pane crossing (decals.wgsl glassMarks) — the fragment stage's 9th storage buffer, as in the g-buffer's
      { binding: 11, visibility: FS, texture: { sampleType: 'float', viewDimension: '3d' } },   // the integrated froxel volume (render/froxels.ts; read only under FrameFlags.FroxelVol — a 1×1×1 'clear air' dummy while no grid exists)
      { binding: 12, visibility: FS, texture: tex2d('float') },                // the ray-traced reflections (refl, rgba16f — sampled bilinearly; read only while frame.rtCfg.w > 0)
      { binding: 13, visibility: FS, texture: tex2d('float') },                // the g-buffer's material target (roughness, metalness): the reflections' cutoff fade + the metal step-back
      { binding: 15, visibility: FS, buffer: { type: 'uniform' } },             // the squad's weapon lasers as segments (setBeams — the reflection pass's own buffer): drawn as light in the air (composite.wgsl beamAir, settings.beamAir)
    ];   // (14 of the 16 sampled textures a fragment stage may bind by default: 13 here + the smoke atlas in group 0 — the next one wants a merge, not a new binding)
    this.lComp = device.createBindGroupLayout({ label: 'composite', entries: compEntries });
    // SHARP DIRECT: the same bindings in the COMPUTE stage + the output-size HDR target as a storage texture (composite.wgsl cs / hdrOut @14)
    this.lCompS = device.createBindGroupLayout({ label: 'compositeS', entries: [...compEntries.map(e => ({ ...e, visibility: CS })), { binding: 14, visibility: CS, storageTexture: { access: 'write-only', format: 'rgba16float', viewDimension: '2d' } }] });
    this.lSharpU = device.createBindGroupLayout({ label: 'sharpU', entries: [
      { binding: 0, visibility: CS, texture: tex2d('depth') }, { binding: 1, visibility: CS, texture: tex2d('float') },                 // output-size depth, normal
      { binding: 2, visibility: CS, texture: tex2d('depth') }, { binding: 3, visibility: CS, texture: tex2d('float') },                 // their internal view
      { binding: 4, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 5, visibility: CS, texture: tex2d('unfilterable-float') },   // dS[0], dS[1] (denoised S per class, internal)
      { binding: 6, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 7, visibility: CS, texture: tex2d('unfilterable-float') },   // dU[0], dU[1]
      { binding: 8, visibility: CS, storageTexture: stor16 }, { binding: 9, visibility: CS, storageTexture: stor16 },                       // → sharpE[0], sharpE[1] (output size)
      { binding: 10, visibility: CS, texture: tex2d('uint') },                                                                              // output-size id (owner byte for the edge rays)
      { binding: 11, visibility: CS, texture: tex2d('uint') },                                                                              // the hard-edge mask (internal)
    ] });
    this.lEdge = device.createBindGroupLayout({ label: 'sharpEdge', entries: [
      { binding: 0, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 1, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 2, visibility: CS, texture: tex2d('unfilterable-float') }, { binding: 3, visibility: CS, texture: tex2d('unfilterable-float') },
      { binding: 4, visibility: CS, storageTexture: { access: 'write-only', format: 'r32uint', viewDimension: '2d' } } ] });
    this.decalDummy = makeBuffer(device, 32, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST, 'decalDummy');
    this.lFxaa = device.createBindGroupLayout({ label: 'fxaa', entries: [
      { binding: 0, visibility: FS, texture: tex2d('float') },
      { binding: 1, visibility: FS, sampler: { type: 'filtering' } },
      { binding: 2, visibility: FS, buffer: { type: 'uniform' } },
    ] });
    this.froxels = new Froxels(device, sceneLayout, linSamp);
    // ReSTIR DI: the same group 1 + its own group 2 (last frame's reservoirs read-only, this frame's written, the uniform) — two more storage buffers in the compute
    // stage: scene 6 (+ reach + mesh) + 2 = 10 at ultra on Metal, exactly the ceiling; 8 on a default adapter (reach in a uniform, no mesh binding)
    this.lRestir = device.createBindGroupLayout({ label: 'restir', entries: [
      { binding: 0, visibility: CS, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: CS, buffer: { type: 'storage' } },
      { binding: 2, visibility: CS, buffer: { type: 'uniform' } },
    ] });
    this.restirU = makeBuffer(device, this.restirUData.byteLength, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'restirU');
    this.compText = (sharp: boolean, refr = false, p: string = pre) => p + lightingCommon + decalWgslConsts(10) + decalsSrc + markingsSrc + `const SHARP: bool = ${sharp};\nconst GLASS_REFRACT: bool = ${refr};\n` + refractCommonSrc + fireSrc + tuned(compositeSrc);   // + decals.wgsl for the glass cracks (its DK_GLASS path; the g-buffer kinds are dead code here) + markings.wgsl (markEmissiveAt); SHARP = the sharp-direct twin (composite.wgsl header)
    this.buildGbaa = () => { this.pGbaa = device.createComputePipeline(this.gbaaDesc()); };   // (on first use, unless init({ gbaa }) prepared it)
    this.buildSharp = (edge: boolean, mask: boolean) => {   // SHARP DIRECT's pipelines, on first use (ensureSharp) unless init({ sharp }) prepared the first three: the composite's compute twin, sharpU (EDGE_RAYS false — no tracer compiled in — and, only once a ray user asks for it, true; the mask kernel only once the edge rays themselves are on), the 1 : 1 resolve
      const hadS = !!this.pSharpU, hadUE = !!this.pSharpUE;
      if (!this.pSharpU) {
        const D = this.sharpDescs();
        this.pCompS = device.createComputePipeline(D.compS); this.pCompSR = device.createComputePipeline(D.compSR); this.pSharpU = device.createComputePipeline(D.sharpU); this.pTaauS = device.createComputePipeline(D.taauS);
      }
      if (edge && !this.pSharpUE) this.pSharpUE = device.createComputePipeline(this.sharpTracedDesc());
      if (cutSwap.enabled && cutSwap.ready && (hadS !== !!this.pSharpU || hadUE !== !!this.pSharpUE)) void cutSwap.ready.then(ok => ok ? this.buildCut() : undefined).catch(e => console.error('[cut programs] the sharp path\'s cut twins did not compile', e));   // (CUT BOXES: a TRACING kernel just made is the boot's — the second set gets its twin, once the set itself is in: a build still under way may have looked before this one existed)
      if (mask && !this.pEdge) this.pEdge = device.createComputePipeline({ label: 'sharpEdge', layout: device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lEdge] }), compute: { module: makeShader(device, pre + sharpEdgeSrc, 'sharpEdge'), entryPoint: 'main' } });
    };
    this.postParams = makeBuffer(device, 48, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'postParams');   // (+ the OUTPUT size's reciprocal: post runs at the output resolution under TAAU, where frame.invScreen is the internal one)
    this.taauParams = makeBuffer(device, TAAU_PARAM_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'taauParams');
    this.fxaaParams = makeBuffer(device, 32, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'fxaaParams');
    this.den = new Denoiser(device, sceneLayout);
    cutSwap.add(this);
  }
  private compText: (sharp: boolean, refr?: boolean, pre?: string) => string;
  /** the GBAA kernel's descriptor (init({ gbaa }) ahead of time, or buildGbaa on first use — the same object either way) */
  private gbaaDesc(): GPUComputePipelineDescriptor { const d = this.device; return { label: 'gbaa', layout: d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lGbaa] }), compute: { module: makeShader(d, scenePrelude() + gbaaSrc, 'gbaa'), entryPoint: 'main' } }; }
  /** the sharp kernel WITH the tracer compiled in (EDGE_RAYS true: the edge-ray experiment and the sliver rays share it — init({ sharp }) prepares it with the trio since the sliver rule defaults on) */
  private sharpTracedDesc(pre: string = scenePrelude()): GPUComputePipelineDescriptor { const d = this.device; return { label: 'sharpUE', layout: d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lSharpU] }), compute: { module: makeShader(d, pre + directCommonSrc + 'const EDGE_RAYS: bool = true;\n' + sharpSrc, 'sharpUE'), entryPoint: 'main' } }; }
  /** SHARP DIRECT's three first-use descriptors: the composite's compute twin, sharpU without the edge tracer, the 1 : 1 resolve */
  private sharpDescs(pre: string = scenePrelude()): { compS: GPUComputePipelineDescriptor; compSR: GPUComputePipelineDescriptor; sharpU: GPUComputePipelineDescriptor; taauS: GPUComputePipelineDescriptor } {
    const d = this.device, sceneLayout = this.sceneLayout;
    return {
      compS: { label: 'compositeS', layout: d.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lCompS] }), compute: { module: makeShader(d, this.compText(true, false, pre), 'compositeS'), entryPoint: 'cs' } },
      compSR: { label: 'compositeSR', layout: d.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lCompS] }), compute: { module: makeShader(d, this.compText(true, true, pre), 'compositeSR'), entryPoint: 'cs' } },   // (its glass-refraction twin: GLASS_REFRACT true)
      sharpU: { label: 'sharpU', layout: d.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lSharpU] }), compute: { module: makeShader(d, pre + directCommonSrc + 'const EDGE_RAYS: bool = false;\n' + sharpSrc, 'sharpU'), entryPoint: 'main' } },
      taauS: { label: 'taauS', layout: d.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lTaau] }), compute: { module: makeShader(d, pre + 'const SHARP: bool = true;\n' + taauSrc, 'taauS'), entryPoint: 'main' } },
    };
  }

  /** EVERY pipeline the constructor used to create, made through createComputePipelineAsync / createRenderPipelineAsync (gpu/device.ts: compiled on the GPU process's worker
   *  threads, resolved when ready — the synchronous forms compiled ninety kernels on the thread that also composites the browser's UI and froze Chrome for seconds on a cold
   *  shader cache) — the same modules, labels, layouts and constants as before, plus the froxel kernels, the v3 denoiser's and the target-ops kernels of the modules this one
   *  owns. `opts.sharp` / `opts.gbaa`: also prepare the sharp-direct trio / the GBAA kernel now instead of synchronously on the first frame a preset switches them on (main.ts
   *  passes true unless the URL vetoes the feature; the edge-ray experiment's two stay first-use). Engine.init awaits it; nothing may encode before it resolves. */
  async init(opts: { sharp?: boolean; gbaa?: boolean; onGroup?: (name: string) => void } = {}): Promise<void> {
    const device = this.device, sceneLayout = this.sceneLayout, pre = scenePrelude();
    this.sharpAtBoot = !!opts.sharp;
    const cp = (desc: GPUComputePipelineDescriptor) => computePipelineAsync(device, desc);
    const lay = (...ls: GPUBindGroupLayout[]) => device.createPipelineLayout({ bindGroupLayouts: ls });
    const done = (name: string) => () => opts.onGroup?.(name);   // (boot timeline: when each group's last pipeline resolved)
    const subs: Promise<unknown>[] = [this.froxels.init().then(done('froxels')), this.den.init().then(done('denoiser')), this.ops.init().then(done('targetOps'))];
    const jobs: Promise<unknown>[] = [];
    const set = <T,>(p: Promise<T>, f: (v: T) => void) => jobs.push(p.then(f));
    this.traceJobs(pre, this as unknown as Record<string, unknown>, jobs);   // the pipelines that trace boxes: direct, restir ×2, the gathers, the reflections, the cards, the march + its dust twin, the composite pair (CUT BOXES builds the same list a second time: buildCut)
    set(cp({ label: 'temporal', layout: lay(sceneLayout, this.lTemp), compute: { module: makeShader(device, pre + temporalSrc, 'temporal'), entryPoint: 'main' } }), p => { this.pTemp = p; });
    { const mod = makeShader(device, pre + softblurSrc, 'softblur'); const l = lay(sceneLayout, this.lSoft);
      set(Promise.all(STRIDES.map((stride, pass) => cp({ label: `denoise${pass}s${stride}`, layout: l, compute: { module: mod, entryPoint: 'main', constants: { STRIDE: stride } } }))), ps => { this.pDen = ps; }); }   // (only STRIDE is an override in the shader: an unused override constant fails pipeline creation on WebKit)
    { // the chain's tile pass-through mask: one tiny module per threshold the settings can produce (2, 3, 5 today) with SKIP_T and its scan
      // radius baked in as consts — the mask texel itself carries the decision, so softblur needs nothing but that texel and the frame flag.
      // No scene prelude: neither entry point touches group 0 (the layouts still list it so bind group 0 can stay put across the pass).
      const layF = lay(sceneLayout, this.lTileFlags), layD = lay(sceneLayout, this.lTileDist);
      const mods = ALL_SKIP_T.map(T => makeShader(device, `const SKIP_T: i32 = ${T};\nconst SCAN_R: i32 = ${T - 1};\n` + softtileSrc, `softtile${T}`));
      set(cp({ label: 'softtileFlags', layout: layF, compute: { module: mods[0], entryPoint: 'markTiles' } }), p => { this.pTileFlags = p; });   // (markTiles is the same in every module)
      ALL_SKIP_T.forEach((T, i) => set(cp({ label: `softtileDist${T}`, layout: layD, compute: { module: mods[i], entryPoint: 'tileDistances' } }), p => { this.pTileDist.set(T, p); })); }
    set(cp({ label: 'dtemporal', layout: lay(sceneLayout, this.lDTemp), compute: { module: makeShader(device, pre + dtemporalSrc, 'dtemporal'), entryPoint: 'main' } }), p => { this.pDTemp = [p]; });
    { const mod = makeShader(device, pre + giblurSrc, 'giblur'); const l = lay(sceneLayout, this.lGiBlur);
      set(Promise.all([1, 2, 4].map(stride => cp({ label: `giblur${stride}`, layout: l, compute: { module: mod, entryPoint: 'main', constants: { STRIDE: stride } } }))), ps => { this.pGiBlur = ps; }); }
    if (opts.gbaa) set(cp(this.gbaaDesc()), p => { this.pGbaa ??= p; });
    // (the sharp path is BUILT once pSharpU is set — its compute composite without refraction, compS, is a LATER twin under PIPE_QUEUE.later: the frame takes compSR until it is in,
    // which with no pane on the level, or none crossed, computes the same picture — the bend and the pane's terms need a glass hit; `?norefract` on a glass level draws the bend until then)
    if (opts.sharp) { const D = this.sharpDescs(); const laterS = PIPE_QUEUE.later;
      if (laterS) void laterPipelineAsync(device, D.compS).then(c => { if (!this.pCompS) this.cutSet.patch(this, { pCompS: c }, null); });
      set(Promise.all([laterS ? Promise.resolve(null) : cp(D.compS), cp(D.sharpU), cp(D.taauS), cp(this.sharpTracedDesc()), cp(D.compSR)]), ([c, u, t, ue, cr]) => { if (!this.pSharpU) { if (c) this.pCompS = c; this.pSharpU = u; this.pTaauS = t; } this.pSharpUE ??= ue; this.pCompSR ??= cr; }); }   // (+ the traced variant: the sliver rule defaults on, so it is a boot pipeline, not a first-use one)
    { const mod = makeShader(device, pre + bloomSrc, 'bloom'); const l = lay(sceneLayout, this.lBloom);
      set(cp({ label: 'bloomDown0', layout: l, compute: { module: mod, entryPoint: 'down', constants: { FIRST: 1 } } }), p => { this.pBloomDown0 = p; });
      set(cp({ label: 'bloomDown', layout: l, compute: { module: mod, entryPoint: 'down', constants: { FIRST: 0 } } }), p => { this.pBloomDown = p; });
      set(cp({ label: 'bloomUp', layout: l, compute: { module: mod, entryPoint: 'up' } }), p => { this.pBloomUp = p; });
      const bm = makeShader(device, pre + diffuseBlurSrc, 'diffuse_blur');   // the smoke diffusion's separable Gaussian (same layout)
      set(cp({ label: 'diffBlurH', layout: l, compute: { module: bm, entryPoint: 'blurH' } }), p => { this.pDiffBlurH = p; });
      set(cp({ label: 'diffBlurV', layout: l, compute: { module: bm, entryPoint: 'blurV' } }), p => { this.pDiffBlurV = p; }); }
    { const mod = makeShader(device, pre + postSrc, 'post');
      set(renderPipelineAsync(device, { label: 'post', layout: lay(sceneLayout, this.lPost),
        vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] }, primitive: { topology: 'triangle-list' } }), p => { this.pPost = p; }); }
    set(cp({ label: 'taau', layout: lay(sceneLayout, this.lTaau), compute: { module: makeShader(device, pre + 'const SHARP: bool = false;\n' + taauSrc, 'taau'), entryPoint: 'main' } }), p => { this.pTaau = p; });   // the resolve: SHARP = false (the upsampling resolve as it was); its SHARP = true twin (the 1 : 1 resolve under sharp direct) is init({ sharp }) / buildSharp's
    { const fxMod = makeShader(device, fxaaSrc, 'fxaa');
      set(renderPipelineAsync(device, { label: 'fxaa', layout: lay(this.lFxaa),
        vertex: { module: fxMod, entryPoint: 'vs' }, fragment: { module: fxMod, entryPoint: 'fs', targets: [{ format: this.canvasFormat }] }, primitive: { topology: 'triangle-list' } }), p => { this.pFxaa = p; }); }
    await Promise.all([...subs, Promise.all(jobs).then(done('passes'))]);
  }

  /** THE PIPELINES THAT TRACE BOXES, as init() makes them, compiled behind `pre` into `T` (field name → pipeline): init() hands the boot prelude and itself; CUT BOXES
   *  (render/cutSwap.ts) calls it a second time with the cut prelude and a plain object — the set the frame takes while a cut piece is alive. Same modules, labels,
   *  layouts and constants either way. (The sharp-direct trio's traced members are init({ sharp })'s / buildSharp's — buildCut mirrors those it finds built.) */
  private traceJobs(pre: string, T: Record<string, unknown>, jobs: Promise<unknown>[]): void {
    const device = this.device, sceneLayout = this.sceneLayout;
    const mk = (src: string, label: string) => makeShader(device, pre + lightingCommon + src, label);
    const cp = (desc: GPUComputePipelineDescriptor) => computePipelineAsync(device, desc);
    const lay = (...ls: GPUBindGroupLayout[]) => device.createPipelineLayout({ bindGroupLayouts: ls });
    const set = <V,>(p: Promise<V>, f: (v: V) => void) => jobs.push(p.then(f));
    // LATER (gpu/device.ts PIPE_QUEUE.later, 2026-10-26: a cold boot on Windows compiles every one of these through DXC, 5–25 s apiece before this work): in the BOOT's set the
    // twins no first frame draws with the default settings are not waited for — compiled after the boot in the queue's background lane, written in through the cut set's
    // patch (so a live cut set keeps them for when it goes) — and their pass takes the other twin until they are in: the motion twin of restir (restirM: pRestir, the
    // estimator as it was, while the camera moves in the first seconds), the iid gathers (fgather / fgatherGi: every preset runs the strata pair, settings.gatherStrata; a
    // `?nogatherstrata` visit draws stratified ones until they are in), the dust twin (volDust: dust drawn as plain smoke, as when it does not compile), the resampling
    // gathers (fgatherGiS / fgatherGi: ultra's alone — the plain gather until they are in, the reservoirs then starting clean as when the row is switched on), phase 5's
    // reflection twin (reflectP5: ultra's alone — main's reflection pass until it is in) and the old direct estimator (direct: every preset runs restir — a `?norestir`
    // visit takes restir until it is in). The cut set's own build (T is not this) waits for everything as before; `?pipelater=0` = the boot waits for these too.
    const late = T === this && PIPE_QUEUE.later;
    const cpL = (desc: GPUComputePipelineDescriptor) => late ? laterPipelineAsync(device, desc) : cp(desc);
    const setL = <V,>(p: Promise<V>, key: string) => { if (!late) { set(p, v => { T[key] = v; }); return; } void p.then(v => { if (v) this.cutSet.patch(this, { [key]: v }, null); }); };
    setL(cpL({ label: 'direct', layout: lay(sceneLayout, this.lDirect), compute: { module: makeShader(device, pre + directCommonSrc + directSrc, 'direct'), entryPoint: 'main' } }), 'pDirect');
    set(cp({ label: 'restir', layout: lay(sceneLayout, this.lDirect, this.lRestir), compute: { module: makeShader(device, pre + directCommonSrc + 'const RESTIR_MOTION: bool = false;\nconst RESTIR_TRADE: bool = false;\n' + restirSrc, 'restir'), entryPoint: 'main' } }), p => { T.pRestir = p; });   // (RESTIR_MOTION false = the estimator's text const-folded back to itself; the twin below carries the direct-motion lane's three levers — settings.restirMotion picks it)
    setL(cpL({ label: 'restirM', layout: lay(sceneLayout, this.lDirect, this.lRestir), compute: { module: makeShader(device, pre + directCommonSrc + 'const RESTIR_MOTION: bool = true;\nconst RESTIR_TRADE: bool = false;\n' + restirSrc, 'restirM'), entryPoint: 'main' } }), 'pRestirM');
    { const fgMod = mk(gatherCommonSrc + 'const GATHER_STRATA: bool = false;\n' + fgatherSrc, 'fgather');   // one module, two entry points: `main` (the gather as it was, its own layout) and `mainGi` (phase 5's resampling gather: + the reservoir bindings)
      setL(cpL({ label: 'fgather', layout: lay(sceneLayout, this.lFG), compute: { module: fgMod, entryPoint: 'main' } }), 'pFG');
      setL(cpL({ label: 'fgatherGi', layout: lay(sceneLayout, this.lFGR), compute: { module: fgMod, entryPoint: 'mainGi' } }), 'pFGR');
      const fgModS = mk(gatherCommonSrc + 'const GATHER_STRATA: bool = true;\n' + fgatherSrc, 'fgatherS');   // settings.gatherStrata: the same two entry points with tile-coherent STRATIFIED directions (fgather.wgsl cosineDirK) — the pFGs / pFGRs pair the encode takes while gatherStrata
      set(cp({ label: 'fgatherS', layout: lay(sceneLayout, this.lFG), compute: { module: fgModS, entryPoint: 'main' } }), p => { T.pFGs = p; });
      setL(cpL({ label: 'fgatherGiS', layout: lay(sceneLayout, this.lFGR), compute: { module: fgModS, entryPoint: 'mainGi' } }), 'pFGRs'); }
    set(cp({ label: 'reflect', layout: lay(sceneLayout, this.lRefl), compute: { module: mk(gatherCommonSrc + markingsSrc + reflectSrc, 'reflect'), entryPoint: 'main' } }), p => { T.pRefl = p; });   // (lighting_common + gather_common + markings ahead of it, as the gather)
    setL(cpL({ label: 'reflectP5', layout: lay(sceneLayout, this.lReflP5), compute: { module: mk(gatherCommonSrc + markingsSrc + reflectP5Src, 'reflectP5'), entryPoint: 'main' } }), 'pReflP5');   // (phase 5's variant, its own module)
    set(cp({ label: 'cards', layout: lay(sceneLayout, this.lCards), compute: { module: makeShader(device, pre + cardsSrc, 'cards'), entryPoint: 'main' } }), p => { T.pCards = p; });
    set(cp({ label: 'vol', layout: lay(sceneLayout, this.lVol), compute: { module: mk(volCommon + volSrc.replace('const VOL_FROXEL_MARCH: bool = true;', 'const VOL_FROXEL_MARCH: bool = false;'), 'volumetrics'), entryPoint: 'main' } }), p => { T.pVol = p; });   // (the classic tiers' program: the froxel-lit smoke march is its twin's — volumetrics.wgsl VOL_FROXEL_MARCH)
    setL(cpL({ label: 'volFroxel', layout: lay(sceneLayout, this.lVol), compute: { module: mk(volCommon + volSrc, 'volumetricsF'), entryPoint: 'main' } }), 'pVolF');   // (the froxel tiers' twin: LATER — engine.render keeps FrameFlags.FroxelVol down until it is in)   // (+ vol_common: the haze / masked-smoke helpers it shares with the froxel kernels)
    setL(this.dustTwin(volSrc, pre, late), 'pVolDust');   // (look only: the march's twin for frames with destruction dust alive — render/dustLookVol.ts)
    // the fragment composite as it was, and its glass-refraction twin (GLASS_REFRACT — the encode takes pCompR while glassRefract). LATER too when the boot has the sharp path's
    // compute twins (init({ sharp }), the default): the frame composites through those while sharp direct is live, and engine.render keeps it live until one of these is in.
    const lateC = late && this.sharpAtBoot;
    for (const refr of [false, true]) {
      const compMod = makeShader(device, this.compText(false, refr, pre), refr ? 'compositeR' : 'composite');
      const desc: GPURenderPipelineDescriptor = { label: refr ? 'compositeR' : 'composite', layout: lay(sceneLayout, this.lComp),
        vertex: { module: compMod, entryPoint: 'vs' }, fragment: { module: compMod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } };
      if (lateC) setL(laterRenderPipelineAsync(device, desc), refr ? 'pCompR' : 'pComp');
      else set(renderPipelineAsync(device, desc), p => { if (refr) T.pCompR = p; else T.pComp = p; }); }
  }
  // ---- CUT BOXES — a calm room pays nothing (render/cutSwap.ts): the second set of the tracing pipelines, behind the cut prelude
  private cutSet = new ProgramSet();
  /** are the cut programs the ones this object dispatches right now */
  get cutLive(): boolean { return this.cutSet.live; }
  private cutBuilding: Promise<void> = Promise.resolve();
  /** one build at a time: a second call (the sharp path's kernels arriving late) waits for the first, so the newer set is always the one installed */
  buildCut(): Promise<void> { return this.cutBuilding = this.cutBuilding.catch(() => { /* its caller has it */ }).then(() => this.buildCutNow()); }
  private async buildCutNow(): Promise<void> {
    const pre = scenePrelude(true), T: Record<string, unknown> = {}, jobs: Promise<unknown>[] = [];
    this.traceJobs(pre, T, jobs);
    const cp = (desc: GPUComputePipelineDescriptor) => computePipelineAsync(this.device, desc);
    const wantS = !!this.pSharpU || (this.cutSet.live && !!this.cutSet.cut?.pCompS), wantUE = !!this.pSharpUE || (this.cutSet.live && !!this.cutSet.cut?.pSharpUE);   // (the sharp path's tracing members, where this page has built them: the composite's compute twins and the traced sharp kernel)
    if (wantS) { const D = this.sharpDescs(pre); jobs.push(cp(D.compS).then(p => { T.pCompS = p; }), cp(D.compSR).then(p => { T.pCompSR = p; })); }
    if (wantUE) jobs.push(cp(this.sharpTracedDesc(pre)).then(p => { T.pSharpUE = p; }));
    await Promise.all(jobs);
    this.cutSet.set(this, T);
  }
  useCut(on: boolean) { this.cutSet.use(this, on); }
  /** SCENE TWEAK PANEL (ui/sceneTweak.ts over render/shaderTune.ts): rebuild the composite's programs from its text as SHADER_TUNE has it now — the fragment pair, the compute twins
   *  where this page has built them, and their cut twins where the second set exists — and write them into BOTH sets (no cutSwap.hot(): cut pieces stay cut). All or nothing: every
   *  live pipeline stays on an error. Takes its turn behind a cut build under way (and behind an earlier retune), so the newest text is the one left installed. */
  retuneComposite(): Promise<{ ok: boolean; messages: string[] }> {
    const run = this.cutBuilding.catch(() => { /* its caller has it */ }).then(() => this.retuneCompositeNow());
    this.cutBuilding = run.then(() => { /* the queue carries no value */ }, () => { /* its caller has it */ });
    return run;
  }
  private compTunedAs = compositeSrc;   // the composite text the installed programs were built from (a retune skips a text that already runs; a set built later reads the same text)
  private async retuneCompositeNow(): Promise<{ ok: boolean; messages: string[] }> {
    const d = this.device, hasCut = !!this.cutSet.cut, body = tuned(compositeSrc), bodyLines = body.split('\n').length;
    if (body === this.compTunedAs) return { ok: true, messages: [] };
    const wantS = !!this.pSharpU || (this.cutSet.live && !!this.cutSet.cut?.pCompS);   // (as buildCutNow: the compute twins only where this page has them)
    const mods: { key: string; label: string; cut: boolean; sharp: boolean; mod: GPUShaderModule; off: number }[] = [];
    for (const cut of hasCut ? [false, true] : [false]) for (const sharp of wantS ? [false, true] : [false]) for (const refr of [false, true]) {
      const code = this.compText(sharp, refr, cut ? scenePrelude(true) : scenePrelude()), label = `composite${sharp ? 'S' : ''}${refr ? 'R' : ''}`;
      mods.push({ key: `pComp${sharp ? 'S' : ''}${refr ? 'R' : ''}`, label, cut, sharp, mod: d.createShaderModule({ code, label }), off: code.split('\n').length - bodyLines });
    }
    const infos = await Promise.all(mods.map(m => m.mod.getCompilationInfo()));
    const messages = infos.flatMap((info, i) => info.messages.map(m => `${mods[i].label}${mods[i].cut ? ' (cut)' : ''} ${m.type} ${m.lineNum - mods[i].off}:${m.linePos} ${m.message}`));   // (line numbers are composite.wgsl's own)
    if (infos.some(info => info.messages.some(m => m.type === 'error'))) return { ok: false, messages };
    const layF = d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lComp] }), layS = d.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lCompS] });
    let ps: (GPUComputePipeline | GPURenderPipeline)[];
    try {
      ps = await Promise.all(mods.map(({ label, sharp, mod }): Promise<GPUComputePipeline | GPURenderPipeline> => sharp
        ? d.createComputePipelineAsync({ label, layout: layS, compute: { module: mod, entryPoint: 'cs' } })
        : d.createRenderPipelineAsync({ label, layout: layF, vertex: { module: mod, entryPoint: 'vs' }, fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba16float' }] }, primitive: { topology: 'triangle-list' } })));
    } catch (e) { return { ok: false, messages: [...messages, `pipeline: ${(e as Error)?.message ?? e}`] }; }
    const base: Record<string, unknown> = {}, twins: Record<string, unknown> = {};
    mods.forEach((m, i) => { (m.cut ? twins : base)[m.key] = ps[i]; });
    this.cutSet.patch(this, base, hasCut ? twins : null); this.compTunedAs = body;
    return { ok: true, messages };
  }

  /** LOOK ONLY: the volumetric pass's dust twin from a volumetrics.wgsl text (render/dustLookVol.ts + shaders/dust_look.wgsl) — null (dust drawn as plain smoke, one console
   *  error) when the march no longer has the statements the twin swaps or the twin does not compile; never an invalid pipeline */
  private async dustTwin(vol: string, pre: string = scenePrelude(), later = false): Promise<GPUComputePipeline | null> {
    const twin = DUST_DRAW.on ? dustLookVol(vol) : null; if (!twin) return null;
    const mod = this.device.createShaderModule({ code: shaderText(pre + lightingCommon + volCommon + dustLookSrc + twin), label: 'volumetricsDust' });
    const info = await mod.getCompilationInfo();
    if (info.messages.some(m => m.type === 'error')) { console.error('dust look: the volumetric dust twin does not compile — dust is drawn as plain smoke', info.messages.filter(m => m.type === 'error').slice(0, 3).map(m => `${m.lineNum}:${m.linePos} ${m.message}`)); return null; }
    try { const desc: GPUComputePipelineDescriptor = { label: 'volDust', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lVol] }), compute: { module: mod, entryPoint: 'main' } }; return await (later ? laterPipelineAsync(this.device, desc) : this.device.createComputePipelineAsync(desc)); }
    catch (e) { console.error('dust look: the volumetric dust twin pipeline failed — dust is drawn as plain smoke', e); return null; }
  }
  /** Dev / measurement hook (main.ts __hotVol): rebuild the volumetric pipeline from `src` (a volumetrics.wgsl variant; the same prelude is prepended) so an
   *  edited march can be A/B'd against a staged scene without a reboot. Resolves to the compiler's messages; the old pipeline stays if there is an error. */
  async hotSwapVol(src: string): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const mod = this.device.createShaderModule({ code: scenePrelude() + lightingCommon + volCommon + src, label: 'volumetrics-hot' });
    const info = await mod.getCompilationInfo();
    const messages = info.messages.map(m => `${m.type} ${m.lineNum}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    this.pVol = this.pVolF = await this.device.createComputePipelineAsync({ label: 'vol-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lVol] }), compute: { module: mod, entryPoint: 'main' } });
    this.pVolDust = await this.dustTwin(src);   // (the dust twin is built from the same text: an edited march reaches both)
    return { ok: true, messages };
  }

  /** Dev / measurement hook (main.ts __hotReflect): rebuild a reflection pipeline from `src` (prelude + lighting_common + gather_common are prepended) — the phase-5 variant if the source
   *  declares the hit-record bindings (reflect_p5.wgsl), else main's (reflect.wgsl). */
  async hotSwapReflect(src: string): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const p5 = /@binding\(9\)\s*var\s+hitPrev/.test(src);
    const pre = scenePrelude() + lightingCommon + gatherCommonSrc + markingsSrc; const off = pre.split('\n').length - 1;
    const mod = this.device.createShaderModule({ code: pre + src, label: 'reflect-hot' });
    const info = await mod.getCompilationInfo();
    const messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    const pipe = await this.device.createComputePipelineAsync({ label: p5 ? 'reflectP5-hot' : 'reflect-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, p5 ? this.lReflP5 : this.lRefl] }), compute: { module: mod, entryPoint: 'main' } });
    if (p5) this.pReflP5 = pipe; else this.pRefl = pipe;
    return { ok: true, messages };
  }
  /** RT reflections (engine.render mirrors settings.rtReflect / rtReflectDiv every frame): the switch the encode reads, and the reflection targets' divisor — a change re-makes THAT set (pooled,
   *  its histories resampled onto the new grid) and nothing else, exactly as a gather-divisor flip does. The targets exist whether or not the pass is on (like the gather's specular field). */
  setRt(on: boolean, div: number) {
    this.rtOn = on;
    div = div <= 1 ? 1 : div >= 3 ? 3 : 2;
    // Off for RT_IDLE_FRAMES: the real set (refl + scratch + three history pairs, ~15–28 MB at high's grid, + phase 5's hit records) goes back to the pool and the 1×1 stand-ins return —
    // else a machine auto-calibrated through high and settled on low kept them for the session AND resampled their histories on every resize (review R1.1). Re-made zeroed on the
    // next `true`, like the gather's reservoirs (setGi) and the froxel volumes.
    if (!on) { if (this.rtEverOn && ++this.rtIdle > LightingPasses.RT_IDLE_FRAMES) { this.rtEverOn = false; this.hitEverOn = false; this.rtIdle = 0; this.hitIdle = 0; if (this.width) { const t0 = performance.now(); const R = this.beginRealloc(); this.reallocRefl(R, this.rw, this.rh, false); this.finishRealloc(R, 'reflection targets let go', t0); this.dropBindGroups(); } return; } }
    else this.rtIdle = 0;
    const firstOn = on && !this.rtEverOn;   // the first frame the pass is wanted on this machine: the real target set replaces the 1×1 stand-in (an off machine — low / verylow / ?nortreflect — never pays the ~28 MB at high)
    if (firstOn) { this.rtEverOn = true; if (this.rtHitReuse) this.hitEverOn = true; }   // (+ phase 5's hit records, if their reuse was already asked for while the pass was off)
    if (div === this.rtDiv && !firstOn) return;
    this.rtDiv = div;
    if (!this.width) return;
    if (!this.keepHistories) { const w = this.width, h = this.height, ow = this.ow, oh = this.oh; this.width = 0; this.resize(w, h, ow, oh); return; }
    const t0 = performance.now(); const R = this.beginRealloc();
    this.reallocRefl(R, Math.ceil(this.width / div), Math.ceil(this.height / div), true);
    this.finishRealloc(R, `divisor → reflections /${div}`, t0);
    this.dropBindGroups();
  }
  /** Dev / measurement hook (main.ts __hotGather): rebuild BOTH gather pipeline pairs (main + mainGi, × GATHER_STRATA false / true) from an fgather.wgsl variant (prelude + lighting_common +
   *  gather_common prepended, the const line between them as init() builds it). All four or none: a variant that fails to compile, or lacks either entry point, leaves the live pairs as they were. */
  async hotSwapGather(src: string, common: string = gatherCommonSrc): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const pre = scenePrelude() + lightingCommon + common; const off = pre.split('\n').length;   // (+ the one const line below)
    const declares = /^const GATHER_STRATA\b/m.test(src);   // (a variant that declares the const itself compiles once, into both pairs)
    const build = async (strata: boolean): Promise<{ ok: boolean; messages: string[]; pipes?: [GPUComputePipeline, GPUComputePipeline] }> => {
      const mod = this.device.createShaderModule({ code: pre + (declares ? '\n' : `const GATHER_STRATA: bool = ${strata};\n`) + src, label: strata ? 'fgatherS-hot' : 'fgather-hot' });
      const info = await mod.getCompilationInfo();
      const messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
      if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
      const pipes = await Promise.all([
        this.device.createComputePipelineAsync({ label: strata ? 'fgatherS-hot' : 'fgather-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lFG] }), compute: { module: mod, entryPoint: 'main' } }),
        this.device.createComputePipelineAsync({ label: strata ? 'fgatherGiS-hot' : 'fgatherGi-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lFGR] }), compute: { module: mod, entryPoint: 'mainGi' } }) ]);
      return { ok: true, messages, pipes: pipes as [GPUComputePipeline, GPUComputePipeline] };
    };
    const a = await build(false); if (!a.ok) return { ok: false, messages: a.messages };
    const b = declares ? a : await build(true); if (!b.ok) return { ok: false, messages: b.messages };
    this.pFG = a.pipes![0]; this.pFGR = a.pipes![1]; this.pFGs = b.pipes![0]; this.pFGRs = b.pipes![1];
    return { ok: true, messages: a.messages };
  }
  /** frames a phase-5 set may stay allocated unused before it goes back to the pool (an ultra visit followed by a long spell on high: ~37 MB of reservoirs at ultra's grid, ~14 at high's) */
  private static readonly P5_IDLE_FRAMES = 600;
  /** frames the RT-reflection set may stay allocated with the pass off before it goes back to the pool (setRt; review R1.1) */
  private static readonly RT_IDLE_FRAMES = 600;
  private giIdle = 0; private hitIdle = 0; private rtIdle = 0;
  /** PHASE 5 — the gather's reservoir resampling wanted this frame (engine.render mirrors settings.giResample ≠ 'off' before resize): the first `true` makes the reservoir sets at the gather grid
   *  (pooled); afterwards they follow the gather set through resizes / divisor flips (reallocGather); P5_IDLE_FRAMES off lets them go again (re-made, zeroed, on the next `true`). The encode picks
   *  the pipeline by it; the mode itself rides in frame.p5Cfg.x. */
  setGi(on: boolean) {
    this.giOn = on;
    if (!on) {
      if (this.giEverOn && ++this.giIdle > LightingPasses.P5_IDLE_FRAMES) { this.giEverOn = false; this.giIdle = 0; const t0 = performance.now(); const R = this.beginRealloc(); this.reallocGi(R, this.gw, this.gh); this.finishRealloc(R, 'gather reservoirs let go', t0); this.bgFGR = [null, null]; }
      return;
    }
    this.giIdle = 0;
    if (this.giEverOn) return;
    this.giEverOn = true;
    if (!this.gw) return;   // (before the first resize: reallocGather makes them with everything else)
    const t0 = performance.now(); const R = this.beginRealloc();
    this.reallocGi(R, this.gw, this.gh);
    this.finishRealloc(R, `gather reservoirs ${this.gw}×${this.gh}`, t0);
    this.bgFGR = [null, null];
  }
  /** GI IN MOTION — the diffuse client at the internal resolution wanted this frame with `iters` à-trous iterations (engine.render mirrors settings.giFullRes / giFullIters before resize): the first
   *  `true` makes the internal-res set (pooled) and asks the denoiser for its pipelines (async: the gather-grid chain carries on for the frame or two until they exist); afterwards the set follows
   *  the internal size (reallocGiFull); GIF_IDLE_FRAMES off lets it go again. */
  setGiFull(on: boolean, iters: number) {
    this.giFullOn = on; this.giFullIters = Math.max(1, Math.min(5, Math.round(iters) || 4));
    if (!on) {
      if (this.giFullEverOn && ++this.giFullIdle > LightingPasses.GIF_IDLE_FRAMES) { this.giFullEverOn = false; this.giFullIdle = 0; const t0 = performance.now(); const R = this.beginRealloc(); this.reallocGiFull(R, this.width, this.height, false); this.finishRealloc(R, 'internal-res GI set let go', t0); this.dropBindGroups(); }
      return;
    }
    this.giFullIdle = 0;
    this.den.prepareFull(this.fullStrides());   // (idempotent; a divisor / iteration change asks for the new stride variants)
    if (this.giFullEverOn) return;
    this.giFullEverOn = true;
    if (!this.width) return;   // (before the first resize: resize() makes it with everything else)
    const t0 = performance.now(); const R = this.beginRealloc();
    this.reallocGiFull(R, this.width, this.height, false);
    this.finishRealloc(R, `internal-res GI set ${this.width}×${this.height}`, t0);
    this.dropBindGroups();   // (both composites bind giF[0] while live)
  }
  /** the internal-res GI set at (w, h): à-trous ping-pong + history / moments / fast pairs, rgba16f — from the pool; the three history pairs carried across a size change (bilinear, like indHist)
   *  when `carry`, everything else zeroed; nothing at all until first use */
  private reallocGiFull(R: Realloc, w: number, h: number, carry: boolean) {
    const oldHist = this.giFHist, oldMom = this.giFMom, oldFast = this.giFFast;
    for (const t of this.giF) this.drop(R, t);
    this.giF = []; this.giFView = []; this.giFHist = []; this.giFHistView = []; this.giFMom = []; this.giFMomView = []; this.giFFast = []; this.giFFastView = [];
    if (this.giFullEverOn) {
      const su = SU();
      this.giF = [0, 1].map(i => this.take(R, `giF${i}`, w, h, 'rgba16float', su)); this.giFView = this.giF.map(t => t.createView());
      this.giFHist = [0, 1].map(i => this.take(R, `giFHist${i}`, w, h, 'rgba16float', su)); this.giFHistView = this.giFHist.map(t => t.createView());
      this.giFMom = [0, 1].map(i => this.take(R, `giFMom${i}`, w, h, 'rgba16float', su)); this.giFMomView = this.giFMom.map(t => t.createView());
      this.giFFast = [0, 1].map(i => this.take(R, `giFFast${i}`, w, h, 'rgba16float', su)); this.giFFastView = this.giFFast.map(t => t.createView());
      if (carry && oldHist.length === 2 && oldMom.length === 2 && oldFast.length === 2) { for (let i = 0; i < 2; i++) { R.blits.push({ src: oldHist[i], dst: this.giFHist[i] }); R.blits.push({ src: oldMom[i], dst: this.giFMom[i] }); R.blits.push({ src: oldFast[i], dst: this.giFFast[i] }); } R.what.push('indirect (internal res)'); }
    }
    for (const t of [...oldHist, ...oldMom, ...oldFast]) this.drop(R, t);
    this.bgCompFG = null; this.bgCompS = null; this.bgFG = [null, null];
  }
  /** the reservoir sets at (gw, gh): 2 parities × (A, B) rgba32uint — from the pool, zeroed (a zero record is 'no sample': M 0, invalid), never carried */
  private reallocGi(R: Realloc, gw: number, gh: number) {
    for (const t of this.giRes.flat()) this.drop(R, t);
    this.giRes = [[], []]; this.giResView = [[], []];
    if (!this.giEverOn) return;
    const su = SU();
    for (let p = 0; p < 2; p++) { this.giRes[p] = [0, 1].map(k => this.take(R, `giRes${p}${'AB'[k]}`, gw, gh, 'rgba32uint', su)); this.giResView[p] = this.giRes[p].map(t => t.createView()); }   // (a NEW texture is zero already; a pooled one is queued for zeroing by take() — nothing stale survives a size change)
    this.bgFGR = [null, null];
  }
  /** PHASE 5 — the reflection pass's hit-lighting reuse wanted this frame (engine.render mirrors settings.rtHitReuse before resize): the first `true` with the reflections ever on makes the real
   *  hit-record pair at the reflection grid; afterwards it follows the reflection set (reallocRefl). The bit itself rides in frame.p5Cfg.z. */
  setHitReuse(on: boolean) {
    this.rtHitReuse = on;
    if (!on || !this.rtOn) {   // (off, or the reflections themselves off: after a spell the real pair goes back to the pool, the 1×1 stand-ins return)
      if (this.hitEverOn && ++this.hitIdle > LightingPasses.P5_IDLE_FRAMES) { this.hitEverOn = false; this.hitIdle = 0; const t0 = performance.now(); const R = this.beginRealloc(); this.reallocHit(R, this.rw, this.rh); this.finishRealloc(R, 'reflection hit records let go', t0); this.dropBindGroups(); }
      return;
    }
    this.hitIdle = 0;
    if (this.hitEverOn || !this.rtEverOn) return;
    this.hitEverOn = true;
    if (!this.rw) return;
    const t0 = performance.now(); const R = this.beginRealloc();
    this.reallocHit(R, this.rw, this.rh);
    this.finishRealloc(R, `reflection hit records ${this.rw}×${this.rh}`, t0);
    this.dropBindGroups();   // (the reflect groups name the pair)
  }
  /** the reflection pass's hit-record pair at (rw, rh) rgba32uint (a 1×1 stand-in pair until settings.rtHitReuse is first on with the reflections themselves on) — zeroed, never carried */
  private reallocHit(R: Realloc, rw: number, rh: number) {
    for (const t of this.reflHit) this.drop(R, t);
    const real = this.hitEverOn && this.rtEverOn;
    const w = real ? rw : 1, h = real ? rh : 1;
    this.reflHit = [0, 1].map(i => this.take(R, real ? `reflHit${i}` : `reflHitNone${i}`, w, h, 'rgba32uint', SU())); this.reflHitView = this.reflHit.map(t => t.createView());
  }
  /** The same for the direct-light pass (main.ts __hotDirect / __hotRestir): a direct.wgsl or restir.wgsl variant against the staged scene — scene prelude AND
   *  direct_common.wgsl prepended (pass `common` to swap that too), the pipeline of that path replaced. */
  async hotSwapDirect(src: string, which: 'direct' | 'restir' = 'direct', common: string = directCommonSrc): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    if (which === 'restir') { this.restirTradeHot = true; this.restirTrade.clear(); }   // (… nor a lighting-trade twin: built from the bundled text and prelude, it would shadow the hot program)
    // restir.wgsl compiles TWICE (RESTIR_MOTION false / true — the direct-motion lane's twin); a variant that declares the const itself compiles once, into both slots
    const variants: [string, boolean | null][] = which === 'restir' && !/^const RESTIR_MOTION\b/m.test(src) ? [['const RESTIR_MOTION: bool = false;\n', false], ['const RESTIR_MOTION: bool = true;\n', true]] : [['', null]];
    const layouts = which === 'restir' ? [this.sceneLayout, this.lDirect, this.lRestir] : [this.sceneLayout, this.lDirect];
    const trade = which === 'restir' && !/^const RESTIR_TRADE\b/m.test(src) ? 'const RESTIR_TRADE: bool = false;\n' : '';   // (the lighting trades' const: a hot text is the plain program unless it says otherwise)
    let messages: string[] = [];
    for (const [decl0, motion] of variants) {
      const decl = decl0 + trade;
      const mod = this.device.createShaderModule({ code: scenePrelude() + common + decl + src, label: which + (motion ? 'M' : '') + '-hot' });
      const info = await mod.getCompilationInfo();
      const off = (scenePrelude() + common + decl).split('\n').length - 1;
      messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
      if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
      const p = await this.device.createComputePipelineAsync({ label: which + (motion ? 'M' : '') + '-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: layouts }), compute: { module: mod, entryPoint: 'main' } });
      if (which !== 'restir') this.pDirect = p;
      else if (motion === null) { this.pRestir = p; this.pRestirM = p; }
      else if (motion) this.pRestirM = p; else this.pRestir = p;
    }
    return { ok: true, messages };
  }

  /** direct-quality lane (main.ts __hotSharp): a sharp_direct.wgsl variant against the staged scene — BOTH pipelines (tracer-free + traced) rebuilt from it, direct_common.wgsl prepended as passes builds them */
  async hotSwapSharp(src: string, common: string = directCommonSrc): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const out: string[] = []; const ps: GPUComputePipeline[] = [];
    for (const traced of [false, true]) {
      const head = scenePrelude() + common + `const EDGE_RAYS: bool = ${traced};\n`;
      const mod = this.device.createShaderModule({ code: head + src, label: traced ? 'sharpUE-hot' : 'sharpU-hot' });
      const info = await mod.getCompilationInfo(); const off = head.split('\n').length - 1;
      out.push(...info.messages.map(m => `${traced ? 'traced' : 'plain'} ${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`));
      if (info.messages.some(m => m.type === 'error')) return { ok: false, messages: out };
      ps.push(await this.device.createComputePipelineAsync({ label: traced ? 'sharpUE-hot' : 'sharpU-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lSharpU] }), compute: { module: mod, entryPoint: 'main' } }));
    }
    this.pSharpU = ps[0]; this.pSharpUE = ps[1];
    if (!this.pCompS) { const D = this.sharpDescs(); this.pCompS = this.device.createComputePipeline(D.compS); this.pCompSR = this.device.createComputePipeline(D.compSR); this.pTaauS = this.device.createComputePipeline(D.taauS); }
    return { ok: true, messages: out };
  }
  /** … and a gbaa.wgsl variant (main.ts __hotGbaa) */
  async hotSwapGbaa(src: string): Promise<{ ok: boolean; messages: string[] }> {
    const head = scenePrelude(); const mod = this.device.createShaderModule({ code: head + src, label: 'gbaa-hot' });
    const info = await mod.getCompilationInfo(); const off = head.split('\n').length - 1;
    const messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    this.pGbaa = await this.device.createComputePipelineAsync({ label: 'gbaa-hot', layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.sceneLayout, this.lGbaa] }), compute: { module: mod, entryPoint: 'main' } });
    return { ok: true, messages };
  }

  /** (Re)build the ReSTIR reservoir pair for a w×h target: whole 8×8 tiles × 64 texels × 16 B, then one 16-B light-belief record per tile (restir.wgsl tileRecIndex), zero-filled by
   *  the API = no history and no beliefs anywhere (the first frame draws fresh candidates only). A size the pool returns to does not keep reservoirs — they are a frame's worth of
   *  state, cheap to regrow, and a resampled reservoir would name the wrong pixel's sample. */
  private allocRestir(w: number, h: number) {
    for (const b of this.resBuf) b.destroy();
    const tiles = Math.ceil(w / 8) * Math.ceil(h / 8);
    const bytes = tiles * 64 * 16 + tiles * 16;
    this.resBuf = [0, 1].map(i => this.device.createBuffer({ label: `restirRes${i}`, size: bytes, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST }));
    this.bgRestir = [null, null]; this.rParity = 0;
  }
  /** Per frame, after lights.upload(): the pass's uniform — cfg, last frame's slot maps and light records (render/lights.ts keeps them). Cheap (4.2 KB). */
  writeRestir(lights: LightSet) {
    const u = this.restirU32, f = this.restirF32, b8 = this.restirU8;
    const rays = Math.max(2, Math.min(6, Math.round(this.restirRays))), k = Math.max(0, Math.min(8, Math.round(this.restirSpatial))), cap = Math.max(1, Math.min(30, Math.round(this.restirHistory)));
    u[0] = rays | ((Math.max(0, Math.min(8, Math.round(this.heldRays))) & 15) << 8);   // cfg.x: rays | heldRays << 8 (restir.wgsl HELD — the hybrid estimator's K; 0 = off: the transient stratum exactly as it was)
    u[0] |= (this.heldAdaptive ? 1 << 12 : 0) | (this.restirStableRetrace ? 1 << 13 : 0) | ((Math.max(0, Math.min(100, Math.round(this.restirDimClass * 100))) & 255) << 16);   // the lighting TRADES (restir.wgsl; read only by the RESTIR_TRADE twin; all off = 0 = the word as it was)
    const mot = this.restirMotionLive ? Math.max(0, Math.min(7, Math.round(this.restirMotion))) : 0;   // MOTION (restir.wgsl header): its three parts as cfg.w bits 256 / 512 / 1024 — read only by the RESTIR_MOTION pipeline the encode takes while mot ≠ 0
    u[1] = k | (mot ? (Math.max(0, Math.min(8, Math.round(this.restirMotionTaps))) & 15) << 8 : 0); u[2] = cap | ((Math.max(0, Math.min(30, Math.round(this.restirPenCap))) & 255) << 8) | (this.restirPenRays ? 1 << 16 : 0); u[3] = (this.restirGradient ? 1 : 0) | (this.restirSpatialAll ? 2 : 0) | (this.restirCoherent ? 4 : 0) | (this.restirSampleHue ? 8 : 0) | (this.restirKnownDark ? 0 : 16) | (this.restirRatioRaw ? 32 : 0) | (this.restirPermute ? 64 : 0) | (this.restirHueSplit ? 128 : 0) | (mot << 8);
    f[4] = Math.max(0, this.restirRadius) * (this.height / 1000); f[5] = Math.max(0.05, this.restirGradK); f[6] = Math.max(0, this.restirYoung); f[7] = Math.max(0, Math.min(1, this.restirAudit));
    f[8] = this.restirJitter[0]; f[9] = this.restirJitter[1]; f[10] = this.restirJitterPrev[0]; f[11] = this.restirJitterPrev[1];   // TAAU jitter in internal px: this frame's, the previous dispatch's (restir.wgsl RestirU.jitter)
    this.restirJitterPrev[0] = this.restirJitter[0]; this.restirJitterPrev[1] = this.restirJitter[1];
    f[12] = Math.max(0.05, this.restirMotionV) * (this.height / 1000); f[13] = Math.max(0.02, Math.min(1, this.restirMotionMin)); f[14] = Math.max(0, this.restirMotionPx) * (this.height / 1000); f[15] = this.restirMotionDither ? 1 : 0;   // RestirU.mot (MOTION: the full-confidence motion in px at this resolution, the floor, the spatial threshold px, the global-dither switch)
    b8.set(lights.slotFwd.subarray(0, 64), RESTIR_U_FWD); b8.set(lights.slotInv.subarray(0, 64), RESTIR_U_INV);
    b8.set(lights.prevData.subarray(0, MAX_LIGHTS * 64), RESTIR_U_HEAD);
    this.device.queue.writeBuffer(this.restirU, 0, this.restirUData);
  }
  private ensureRestirBG() {
    const p = this.rParity;
    if (!this.bgRestir[p]) this.bgRestir[p] = this.device.createBindGroup({ layout: this.lRestir, entries: [
      { binding: 0, resource: { buffer: this.resBuf[1 - p] } }, { binding: 1, resource: { buffer: this.resBuf[p] } }, { binding: 2, resource: { buffer: this.restirU } } ] });
    return this.bgRestir[p]!;
  }

  /** Lossy-option divisors (engine.render mirrors the settings every frame): a change re-creates the targets on THAT grid — the gather's eight (its history and the specular's
   *  resampled onto the new grid) or the volumetrics' one — and nothing else; with keepHistories off, everything, every history restarted (the old path). */
  setDivisors(gatherDiv: number, volDiv: number) {
    if (gatherDiv === this.gatherDiv && volDiv === this.volDiv) return;
    this.gatherDiv = gatherDiv; this.volDiv = volDiv;
    if (!this.width) return;
    if (!this.keepHistories) { const w = this.width, h = this.height, ow = this.ow, oh = this.oh; this.width = 0; this.resize(w, h, ow, oh); return; }
    const t0 = performance.now(); const R = this.beginRealloc();
    const gw = Math.ceil(this.width / gatherDiv), gh = Math.ceil(this.height / gatherDiv), vw = Math.ceil(this.width / volDiv), vh = Math.ceil(this.height / volDiv);
    if (gw !== this.gw || gh !== this.gh) this.reallocGather(R, gw, gh, true);
    if (vw !== this.vw || vh !== this.vh) this.reallocVol(R, vw, vh);
    this.finishRealloc(R, `divisors → gather /${gatherDiv} vol /${volDiv}`, t0);
    this.dropBindGroups();
  }

  /** engine.settings.taau, mirrored every frame before resize(): switching it (re)makes the OUTPUT-size set — the resolve's history pair exists only while it is on — and a fresh pair starts
   *  without history (taaReset). The internal-size targets are untouched. */
  setTaau(on: boolean) {
    if (on === this.taauOn) return;
    this.taauOn = on; this.taaReset = true; this.outStale = true;   // the output set is rebuilt ONCE, by the resize() the engine calls next (at whatever output size that frame wants — no double allocation when the size changes with the switch)
  }
  /** the output-size set must be rebuilt even if no size changed (TAAU switched: the history pair comes / goes) — engine.resize reads it, resize() clears it */
  outStale = false;
  /** SHARP DIRECT on / off (engine.render mirrors it every frame BEFORE resize, like setTaau): a switch re-makes the composite-size set (hdr, the particles' reactive mask, the output-size direct pair)
   *  at the size the composite now runs at — the resolve's output-size history is the same either way, so an on / off flip carries straight on (no reset: A/B it live) */
  /** the boot built the sharp path's compute twins (init({ sharp })), so the fragment pair may be LATER twins (traceJobs) */
  private sharpAtBoot = false;
  /** a fragment composite is in (one of the LATER pair, or the boot's when sharp direct was not built at boot) */
  get fragCompReady(): boolean { return !!(this.pComp || this.pCompR); }
  setSharp(on: boolean) { if (on !== this.sharpOn) { this.sharpOn = on; this.compStale = true; } }
  setGbaa(on: boolean) { if (on !== this.gbaaOn) { this.gbaaOn = on; this.compStale = true; } }
  /** PARTICLE RAIN v2's scene copy on / off (engine.render mirrors settings.particleRain before resize): a switch re-makes the composite-size set so hdrCopy exists (or goes) and hdr may be copied from */
  setSceneCopy(on: boolean) { if (on !== this.sceneCopyOn) { this.sceneCopyOn = on; this.compStale = true; } }
  /** bytes the sharp path holds in the passes: the output-size direct pair + the edge mask + what hdr / react grew by (the output-size g-buffer set is render/gbuffer.ts sharpBytes) */
  get sharpBytes(): number { if (!this.sharpOn) return 0; let n = 0; for (const t of this.sharpE) n += t.width * t.height * 8; if (this.sharpMask) n += this.sharpMask.width * this.sharpMask.height * 4; n += (this.cw * this.ch - this.width * this.height) * (8 + 1); return n; }
  /** the next resolve takes this frame's picture outright, no history (engine.resetTaa words why) */
  resetTaa() { this.taaReset = true; this.taaStats.resets++; this.restirBeliefsStale = true; }   // (a cut: the ReSTIR tiles' light beliefs describe some other piece of the world — dropped at the next dispatch; the reservoirs validate themselves per pixel)
  /** a camera cut seen without TAAU (engine.render): only the ReSTIR tiles' light beliefs need dropping */
  dropRestirBeliefs() { this.restirBeliefsStale = true; }

  /** A new internal size (w, h) and / or OUTPUT size (ow, oh — the canvas: = internal with TAAU off): every target on the size that changed re-made at it. With keepHistories (default) the
   *  targets come from / go back to the pool and the temporal histories — direct light per class + their view depth, the indirect + its depth, the specular, and the TAAU resolve's output
   *  history — are RESAMPLED into their successors (bilinear radiance, nearest depth) in one small compute pass submitted ahead of the frame, so the temporal passes find a history that
   *  validates wherever the surface is the same and the frame after a scale step looks like any other; parked targets are zeroed before reuse. Off: destroy, create, every history restarts
   *  from nothing (one frame of raw estimates) — byte for byte the old path. Under TAAU a render-scale step changes (w, h) only: the output set, and with it the resolve's history, stays. */
  resize(w: number, h: number, ow = w, oh = h) {
    if (w === this.width && h === this.height && ow === this.ow && oh === this.oh && !this.outStale && !this.compStale) return;
    const t0 = performance.now(); const had = this.width > 0; const from = `${this.width}×${this.height}${this.ow !== this.width || this.oh !== this.height ? `→${this.ow}×${this.oh}` : ''}`;
    const sizeChanged = w !== this.width || h !== this.height || ow !== this.ow || oh !== this.oh;
    const inChanged = w !== this.width || h !== this.height, outChanged = ow !== this.ow || oh !== this.oh || this.outStale;
    const cw = this.sharpOn ? ow : w, ch = this.sharpOn ? oh : h;   // the size the composite runs at (sharp direct: the output; else the internal size, as ever)
    const compChanged = cw !== this.cw || ch !== this.ch || this.compStale;
    this.outStale = false; this.compStale = false;
    this.width = w; this.height = h; this.ow = ow; this.oh = oh; this.cw = cw; this.ch = ch;
    const gw = Math.ceil(w / this.gatherDiv), gh = Math.ceil(h / this.gatherDiv), vw = Math.ceil(w / this.volDiv), vh = Math.ceil(h / this.volDiv);
    const R = this.beginRealloc(); const carry = this.keepHistories && had;
    if (!carry) this.youngHold = 6;   // (histories made fresh — every diffuse texel reads young for a few frames: the young-history rays stand down for them)
    if (inChanged || !this.keepHistories) this.reallocFull(R, w, h, carry);
    if (inChanged || !this.keepHistories || !had) this.reallocGiFull(R, w, h, carry);   // the internal-res GI set follows the internal size (nothing until first use)
    if (!this.keepHistories || !had || gw !== this.gw || gh !== this.gh) this.reallocGather(R, gw, gh, carry);   // (kept as they are, contents and all, in the rare case the gather grid did not move; off = re-created regardless, as before)
    if (!this.keepHistories || !had || vw !== this.vw || vh !== this.vh) this.reallocVol(R, vw, vh);
    { const rw = Math.ceil(w / this.rtDiv), rh = Math.ceil(h / this.rtDiv); if (!this.keepHistories || !had || rw !== this.rw || rh !== this.rh) this.reallocRefl(R, rw, rh, carry); }   // the reflection targets, on their own grid
    if (outChanged || !this.keepHistories || !had) this.reallocOut(R, ow, oh, carry);
    if (compChanged || !this.keepHistories || !had) this.reallocComp(R, cw, ch);   // (with sharp off the composite size IS the internal size, so an internal resize re-makes hdr / react exactly as before; with it on a render-scale step leaves the output-size set alone)
    if (compChanged || inChanged || !this.keepHistories || !had) this.reallocMask(R);   // the edge mask is INTERNAL-size: it follows both
    this.finishRealloc(R, `${sizeChanged ? 'resize' : compChanged && !outChanged ? `comp set (sharp ${this.sharpOn ? 'on' : 'off'}, gbaa ${this.gbaaOn ? 'on' : 'off'})` : 'taau ' + (this.taauOn ? 'on' : 'off')} ${from}→${w}×${h}${ow !== w || oh !== h ? `→${ow}×${oh}` : ''}${this.sharpOn ? ' sharp' : ''}`, t0);
    this.dropBindGroups();
    this.writeFxaaParams();
  }

  // ---- target (re)allocation: full-res set / gather-grid set / volumetric target, through the pool (keepHistories) or create+destroy (off) ----
  private beginRealloc(): Realloc { return { toClear: [], toRelease: [], blits: [], nearest: [], nearestU: [], created: 0, reused: 0, what: [] }; }
  /** a target of this description: from the pool if it has one parked (its stale contents queued for zeroing when a shader could read them — storage targets; render
   *  attachments are cleared by their own passes every frame), else new; off = always new */
  private take(R: Realloc, label: string, w: number, h: number, format: GPUTextureFormat, usage: GPUTextureUsageFlags): GPUTexture {
    if (!this.keepHistories) { R.created++; return this.device.createTexture({ label, size: [w, h], format, usage }); }
    const { tex, reused } = this.pool.acquire({ label, size: [w, h], format, usage });
    if (reused) { R.reused++; if (usage & GPUTextureUsage.STORAGE_BINDING) R.toClear.push(tex); } else R.created++;
    return tex;
  }
  /** let go of a target: parked in the pool AFTER the housekeeping pass (a resample may still read it), or destroyed now (off) */
  private drop(R: Realloc, t: GPUTexture | null | undefined) { if (!t) return; if (this.keepHistories) R.toRelease.push(t); else t.destroy(); }
  private reallocFull(R: Realloc, w: number, h: number, carry: boolean) {
    const oldH = this.dH, oldDepth = this.dDepthHist, oldHm = this.dnHm, oldHg = this.dnHg;
    for (const t of [...this.dS, ...this.dU, ...this.dP, this.tileFlag, this.tileDist, ...this.dnShared]) this.drop(R, t);   // (hdr / react: reallocComp — the composite's size is the internal size only while sharp direct is off)
    const su = SU();
    this.allocRestir(w, h);   // ReSTIR reservoirs: restarted at the new size (a frame of fresh candidates rebuilds them)
    this.dS = []; this.dU = []; this.dP = [];
    for (let c = 0; c < 2; c++) {
      this.dS.push(this.take(R, `directS${c}`, w, h, 'rgba16float', su));
      this.dU.push(this.take(R, `directU${c}`, w, h, 'rgba16float', su));
      this.dP.push(this.take(R, `directP${c}`, w, h, 'rgba16float', su));   // ping-pong partner per class (both classes are filtered in the same dispatch)
    }
    this.dSView = this.dS.map(t => t.createView()); this.dUView = this.dU.map(t => t.createView()); this.dPView = this.dP.map(t => t.createView());
    this.tw = Math.ceil(w / 8); this.th = Math.ceil(h / 8);   // = the softblur dispatch grid: one texel per workgroup
    this.tileFlag = this.take(R, 'softTileFlag', this.tw, this.th, 'r32uint', su);
    this.tileDist = this.take(R, 'softTileDist', this.tw, this.th, 'r32uint', su);   // (softTileStats reads it back)
    this.tileFlagView = this.tileFlag.createView(); this.tileDistView = this.tileDist.createView();
    this.dH = [0, 1].map(c => [0, 1].map(i => this.take(R, `directH${c}${i}`, w, h, 'rgba16float', su)));
    this.dHView = this.dH.map(a => a.map(t => t.createView()));
    this.dDepthHist = [0, 1].map(i => this.take(R, `directDepthHist${i}`, w, h, 'r32float', su));
    this.dDepthHistView = this.dDepthHist.map(t => t.createView());
    // the v3 core's full-res set: (hints, lumU) ping-pong (transient), luminance moments + packed depth | history length (histories on dParity, carried like dH)
    this.dnShared = [0, 1].map(i => this.take(R, `dnShared${i}`, w, h, 'rgba16float', su)); this.dnSharedView = this.dnShared.map(t => t.createView());
    this.dnHm = [0, 1].map(i => this.take(R, `dnHm${i}`, w, h, 'rgba16float', su)); this.dnHmView = this.dnHm.map(t => t.createView());
    this.dnHg = [0, 1].map(i => this.take(R, `dnHg${i}`, w, h, 'r32uint', su)); this.dnHgView = this.dnHg.map(t => t.createView());
    if (carry && oldH.length === 2 && oldH[0].length === 2 && oldDepth.length === 2) {   // both parities of both classes + the depth that validates them: whichever the next frame reads is there
      for (let c = 0; c < 2; c++) for (let i = 0; i < 2; i++) R.blits.push({ src: oldH[c][i], dst: this.dH[c][i] });
      for (let i = 0; i < 2; i++) R.nearest.push({ src: oldDepth[i], dst: this.dDepthHist[i] });
      if (oldHm.length === 2 && oldHg.length === 2) for (let i = 0; i < 2; i++) { R.blits.push({ src: oldHm[i], dst: this.dnHm[i] }); R.nearestU.push({ src: oldHg[i], dst: this.dnHg[i] }); }
      R.what.push('direct');
    }
    for (const t of [...(oldH[0] ?? []), ...(oldH[1] ?? []), ...oldDepth, ...oldHm, ...oldHg]) this.drop(R, t);
  }
  /** the COMPOSITE-size set (cw × ch: the internal size, or the output size under sharp direct): the HDR scene colour the composite writes (a storage texture too under sharp: its compute twin stores it),
   *  the particles' reactive mask (their splat draws into hdr, so it follows), and — sharp only — the output-size shadowed direct pair sharp_direct.wgsl writes and the compute composite reads */
  private reallocComp(R: Realloc, cw: number, ch: number) {
    for (const t of [this.hdr, this.react, ...this.sharpE, this.hdrCopy]) this.drop(R, t);
    const copyOn = this.copyOn;   // (GBAA reads a copy of hdr; the particle-rain experiment's refraction and the outline by the picture read the same copy — any of them keeps it)
    this.hdr = this.take(R, 'hdr', cw, ch, 'rgba16float', this.hdrUsage()); this.hdrView = this.hdr.createView();   // (a storage texture under sharp direct — its compute composite stores it — and under GBAA, which rewrites it in place from a copy)
    this.hdrCopy = copyOn ? this.take(R, 'hdrCopy', cw, ch, 'rgba16float', GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST) : null; this.hdrCopyView = this.hdrCopy ? this.hdrCopy.createView() : null; this.bgGbaa = null;
    this.react = this.take(R, 'react', cw, ch, 'r8unorm', RT()); this.reactView = this.react.createView();   // (a render attachment: cleared + drawn by the particles' splat on the frames it runs, read by the resolve only on those)
    this.sharpE = []; this.sharpEView = [];
    if (this.sharpOn) { this.sharpE = [0, 1].map(c => this.take(R, `sharpE${c}`, cw, ch, 'rgba16float', SU())); this.sharpEView = this.sharpE.map(t => t.createView()); }
    this.bgSharpU = null; this.bgCompS = null; this.bgTaauS = [null, null];
  }
  /** the hard-edge mask at the INTERNAL size (sharp only) */
  private reallocMask(R: Realloc) {
    this.drop(R, this.sharpMask); this.sharpMask = null; this.sharpMaskView = null;
    if (this.sharpOn) { this.sharpMask = this.take(R, 'sharpMask', this.width, this.height, 'r32uint', SU()); this.sharpMaskView = this.sharpMask.createView(); }
    this.bgSharpU = null; this.bgEdge = null;
  }
  /** the OUTPUT-size set: the tonemapped frame (ldr), the bloom pyramid (fractions of the output), and — TAAU on — the resolve's history pair, carried across a change of output size like the
   *  other histories (a preset's cap, the window) so a hop between presets does not flash; a pair made fresh (TAAU just switched on, keepHistories off) starts reset instead */
  private reallocOut(R: Realloc, ow: number, oh: number, carry: boolean) {
    const oldTaa = this.taaHist;
    for (const t of [this.ldr, ...this.bloomDown, ...this.bloomUp, ...this.diffDown, ...this.diffTmp, ...this.diffBlur]) if (t) this.drop(R, t);
    const su = SU();
    this.ldr = this.take(R, 'ldr', ow, oh, 'rgba8unorm', RT()); this.ldrView = this.ldr.createView();
    this.bloomDown = []; this.bloomUp = [];
    for (let i = 0; i < 5; i++) { const bw = Math.max(1, Math.ceil(ow / (2 << i))), bh = Math.max(1, Math.ceil(oh / (2 << i))); this.bloomDown.push(this.take(R, `bloomD${i}`, bw, bh, 'rgba16float', su)); if (i < 4) this.bloomUp.push(this.take(R, `bloomU${i}`, bw, bh, 'rgba16float', su)); }
    this.bloomDownView = this.bloomDown.map(t => t.createView()); this.bloomUpView = this.bloomUp.map(t => t.createView());
    this.diffDown = []; this.diffTmp = []; this.diffBlur = [];
    for (let i = 0; i < 3; i++) { const bw = Math.max(1, Math.ceil(ow / (2 << i))), bh = Math.max(1, Math.ceil(oh / (2 << i))); this.diffDown.push(this.take(R, `diffD${i}`, bw, bh, 'rgba16float', su)); if (i > 0) { this.diffTmp[i] = this.take(R, `diffT${i}`, bw, bh, 'rgba16float', su); this.diffBlur[i] = this.take(R, `diffB${i}`, bw, bh, 'rgba16float', su); } }
    this.diffDownView = this.diffDown.map(t => t.createView()); this.diffTmpView = this.diffTmp.map(t => t?.createView()); this.diffBlurView = this.diffBlur.map(t => t?.createView());
    this.taaHist = []; this.taaHistView = [];
    if (this.taauOn) {
      this.taaHist = [0, 1].map(i => this.take(R, `taaHist${i}`, ow, oh, 'rgba16float', su)); this.taaHistView = this.taaHist.map(t => t.createView());
      if (carry && oldTaa.length === 2) { for (let i = 0; i < 2; i++) R.blits.push({ src: oldTaa[i], dst: this.taaHist[i] }); R.what.push('taau'); }
      else this.taaReset = true;
    }
    for (const t of oldTaa) this.drop(R, t);
  }
  /** the gather-grid set: indirect + its history pair, the à-trous ping-pong, the specular + its history pair (a fresh / cleared texture reads as zeros: the first flag-on frame of the
   *  gloss chain starts from a clean history; a carried one from the resampled old grid) */
  private reallocGather(R: Realloc, gw: number, gh: number, carry: boolean) {
    const oldInd = this.indHist, oldSpec = this.specHist, oldGiMom = this.giMom, oldGiFast = this.giFast, oldSpecMom = this.specMom;
    for (const t of [this.indirect, ...this.gi, this.spec]) this.drop(R, t);
    this.gw = gw; this.gh = gh; const su = SU();
    this.indHist = [0, 1].map(i => this.take(R, `indHist${i}`, gw, gh, 'rgba16float', su)); this.indHistView = this.indHist.map(t => t.createView());
    this.indirect = this.take(R, 'indirect', gw, gh, 'rgba16float', su); this.indirectView = this.indirect.createView();
    this.gi = [0, 1].map(i => this.take(R, `gi${i}`, gw, gh, 'rgba16float', su)); this.giView = this.gi.map(t => t.createView());
    this.spec = this.take(R, 'spec', gw, gh, 'rgba16float', su); this.specView = this.spec.createView();
    this.specHist = [0, 1].map(i => this.take(R, `specHist${i}`, gw, gh, 'rgba16float', su)); this.specHistView = this.specHist.map(t => t.createView());
    // the v3 core's gather-grid histories: the diffuse client's moments + fast history, the specular's moments (ping-pong on `parity`, carried like indHist)
    this.giMom = [0, 1].map(i => this.take(R, `giMom${i}`, gw, gh, 'rgba16float', su)); this.giMomView = this.giMom.map(t => t.createView());
    this.giFast = [0, 1].map(i => this.take(R, `giFast${i}`, gw, gh, 'rgba16float', su)); this.giFastView = this.giFast.map(t => t.createView());
    this.specMom = [0, 1].map(i => this.take(R, `specMom${i}`, gw, gh, 'rgba16float', su)); this.specMomView = this.specMom.map(t => t.createView());
    for (const t of this.specFast) this.drop(R, t);
    this.specFast = [0, 1].map(i => this.take(R, `specFast${i}`, gw, gh, 'rgba16float', su)); this.specFastView = this.specFast.map(t => t.createView());   // (transient enough not to carry: the smoothed hit distance re-settles in four frames)
    if (carry && oldInd.length === 2 && oldSpec.length === 2) {
      for (let i = 0; i < 2; i++) { R.blits.push({ src: oldInd[i], dst: this.indHist[i] }); R.blits.push({ src: oldSpec[i], dst: this.specHist[i] }); }
      if (oldGiMom.length === 2 && oldGiFast.length === 2 && oldSpecMom.length === 2) for (let i = 0; i < 2; i++) { R.blits.push({ src: oldGiMom[i], dst: this.giMom[i] }); R.blits.push({ src: oldGiFast[i], dst: this.giFast[i] }); R.blits.push({ src: oldSpecMom[i], dst: this.specMom[i] }); }
      R.what.push('indirect', 'specular');
    }
    for (const t of [...oldInd, ...oldSpec, ...oldGiMom, ...oldGiFast, ...oldSpecMom]) this.drop(R, t);
    this.reallocGi(R, gw, gh);   // phase 5's reservoir sets ride with the gather grid (nothing until first use; zeroed, never carried)
  }
  private reallocVol(R: Realloc, vw: number, vh: number) {
    this.drop(R, this.vol); this.drop(R, this.volReact); this.vw = vw; this.vh = vh;
    this.vol = this.take(R, 'vol', vw, vh, 'rgba16float', SU()); this.volView = this.vol.createView();
    this.volReact = this.take(R, 'volReact', vw, vh, 'rgba16float', SU()); this.volReactView = this.volReact.createView();   // (rgba16float: filterable for post.wgsl's bilinear read of .g, storage-capable; TAAU still loads .r)
  }
  /** the REFLECTION set at (rw, rh) = internal ÷ rtDiv: refl + scratch (transient), hist / mom / fast pairs (histories on rtParity, carried across a size change like the gather's) */
  private reallocRefl(R: Realloc, rw: number, rh: number, carry: boolean) {
    const oldHist = this.reflHist, oldMom = this.reflMom, oldFast = this.reflFast;
    this.drop(R, this.refl); if (this.reflScratch !== this.refl) this.drop(R, this.reflScratch);   // (the 1×1 stand-in doubles as its own scratch: let go once)
    if (!this.rtEverOn) {   // never switched on here: a 1×1 stand-in for the composite's binding (read only while frame.rtCfg.w > 0, which it is not) and no histories at all
      for (const t of [...oldHist, ...oldMom, ...oldFast]) this.drop(R, t);
      this.reflHist = []; this.reflMom = []; this.reflFast = []; this.reflHistView = []; this.reflMomView = []; this.reflFastView = [];
      this.rw = rw; this.rh = rh;
      this.refl = this.take(R, 'reflNone', 1, 1, 'rgba16float', SU()); this.reflView = this.refl.createView(); this.reflScratch = this.refl; this.reflScratchView = this.reflView;
      this.reallocHit(R, rw, rh);   // (the 1×1 stand-in pair: the reflect layout names them whether or not anything is ever reused)
      this.bgCompFG = null; this.bgCompS = null; return;
    }
    this.rw = rw; this.rh = rh; const su = SU();
    this.refl = this.take(R, 'refl', rw, rh, 'rgba16float', su); this.reflView = this.refl.createView();
    this.reflScratch = this.take(R, 'reflScratch', rw, rh, 'rgba16float', su); this.reflScratchView = this.reflScratch.createView();
    this.reflHist = [0, 1].map(i => this.take(R, `reflHist${i}`, rw, rh, 'rgba16float', su)); this.reflHistView = this.reflHist.map(t => t.createView());
    this.reflMom = [0, 1].map(i => this.take(R, `reflMom${i}`, rw, rh, 'rgba16float', su)); this.reflMomView = this.reflMom.map(t => t.createView());
    this.reflFast = [0, 1].map(i => this.take(R, `reflFast${i}`, rw, rh, 'rgba16float', su)); this.reflFastView = this.reflFast.map(t => t.createView());
    if (carry && oldHist.length === 2 && oldMom.length === 2 && oldFast.length === 2) { for (let i = 0; i < 2; i++) { R.blits.push({ src: oldHist[i], dst: this.reflHist[i] }); R.blits.push({ src: oldMom[i], dst: this.reflMom[i] }); R.blits.push({ src: oldFast[i], dst: this.reflFast[i] }); } R.what.push('reflections'); }
    for (const t of [...oldHist, ...oldMom, ...oldFast]) this.drop(R, t);
    this.reallocHit(R, rw, rh);   // phase 5's hit records ride with the set (real pair or 1×1 stand-ins; zeroed either way, never carried)
    this.bgCompFG = null; this.bgCompS = null;   // (both composites bind refl)
  }
  /** Settle a re-allocation: ONE compute pass — zero the reused storage targets (except the ones a resample overwrites whole), then the history resamples — submitted now, i.e. ahead
   *  of the frame about to be encoded; only then park what was let go (the resamples read it); keep the pool's budget at ~2 target sets of the current size. */
  private finishRealloc(R: Realloc, what: string, t0: number) {
    let cleared = 0;
    if (this.keepHistories && (R.toClear.length || R.blits.length || R.nearest.length || R.nearestU.length)) {
      const overwritten = new Set<GPUTexture>([...R.blits, ...R.nearest, ...R.nearestU].map(b => b.dst));
      const enc = this.device.createCommandEncoder({ label: 'targets' }); const p = enc.beginComputePass({ label: 'targets' });
      for (const t of R.toClear) if (!overwritten.has(t) && this.ops.clear(p, t)) cleared++;
      for (const b of R.blits) this.ops.blit16(p, b.src, b.dst);
      for (const b of R.nearest) this.ops.nearest32f(p, b.src, b.dst);
      for (const b of R.nearestU) this.ops.nearest32u(p, b.src, b.dst);
      p.end(); this.device.queue.submit([enc.finish()]);
    }
    if (this.keepHistories) { this.peakBytes = Math.max(this.peakBytes, this.targetBytes()); this.pool.budget = Math.max(64 << 20, Math.round(2.0 * this.peakBytes)); }   // (before the releases below, which evict against it)
    for (const t of R.toRelease) this.pool.release(t);
    if (R.what.includes('direct')) this.directCarryAge = 0;   // (a carried TAAU pair needs nothing: both parities were resampled, whichever the next frame reads is the old picture at the new size)
    this.reallocs++;
    this.lastRealloc = `${what}: ${this.keepHistories ? `${R.reused} pooled ${R.created} new, ${R.blits.length + R.nearest.length + R.nearestU.length} histories resampled${R.what.length ? ` (${R.what.join(' / ')})` : ''}, ${cleared} cleared` : `${R.created} created, histories restarted (keepHistories off)`} (${(performance.now() - t0).toFixed(1)} ms cpu)`;
  }
  /** bytes of the live target set (the pool's budget follows it) */
  targetBytes(): number {
    let n = 0;
    for (const t of [...this.dS, ...this.dU, ...this.dP, this.tileFlag, this.tileDist, ...this.dH.flat(), ...this.dDepthHist, ...this.dnShared, ...this.dnHm, ...this.dnHg, ...this.indHist, this.indirect, ...this.gi, this.spec, ...this.specHist, ...this.giMom, ...this.giFast, ...this.specMom, ...this.specFast, ...this.giF, ...this.giFHist, ...this.giFMom, ...this.giFFast, this.refl, this.reflScratch, ...this.reflHist, ...this.reflMom, ...this.reflFast, ...this.reflHit, ...this.giRes.flat(), this.vol, this.volReact, this.ldr, this.hdr, this.react, ...this.bloomDown, ...this.bloomUp, ...this.taaHist, ...this.sharpE, this.sharpMask, this.hdrCopy]) if (t) n += texBytes({ label: t.label, size: [t.width, t.height], format: t.format, usage: t.usage });
    return n;
  }
  /** Explicit restart of the screen-space temporal histories (both parities of the direct pair + their depth, the indirect, the specular): the next frame accumulates from its own raw
   *  estimates as after a cold boot. Nothing in the frame needs this today — a camera cut, a light switching, a moved wall are all handled per pixel by reprojection + depth validation +
   *  the variance clip — it is the named seam for 'these histories are wrong wholesale' (and the A/B for what carrying them across a resize buys: Tab ▸ Frame). World-space caches
   *  (the radiance cascades) are render/rc.ts's business, not this. */
  restartHistories(reason = ''): void {
    if (!this.width) return;
    const enc = this.device.createCommandEncoder({ label: 'restartHistories' }); const p = enc.beginComputePass({ label: 'restartHistories' });
    for (const t of [...this.dH.flat(), ...this.dDepthHist, ...this.dnHm, ...this.dnHg, ...this.indHist, ...this.specHist, ...this.giMom, ...this.giFast, ...this.specMom, ...this.specFast, ...this.giFHist, ...this.giFMom, ...this.giFFast, ...this.reflHist, ...this.reflMom, ...this.reflFast, ...this.reflHit, ...this.giRes.flat(), ...this.taaHist]) this.ops.clear(p, t);   // (the v3 core's: a zeroed depth | length texel validates nothing = history length 0 everywhere — the internal-res GI set included; phase 5's reservoirs / hit records: a zero record is 'no sample')
    p.end();
    for (const b of this.resBuf) enc.clearBuffer(b);   // + the ReSTIR reservoirs and their tiles' light beliefs (zero = no sample, no history, nothing believed dark)
    this.device.queue.submit([enc.finish()]);
    this.taaReset = true; this.youngHold = 6;   // (every diffuse history is young now: the young-history rays stand down while that is true of the whole grid)
    this.reallocs++; this.lastRealloc = `histories restarted${reason ? ` (${reason})` : ''}`;
  }

  setFxaa(on: boolean) { this.fxaaEnabled = on; if (this.width) this.writeFxaaParams(); }
  /** Test hook (main.ts __resetClock): zero the per-frame counters that feed the grain seed and the history parities, so a scripted capture renders
   *  the same frames whatever ran during boot. */
  /** __resetClock (automation): put the frame-keyed CLOCKS back — the grain seed here, engine.frameIdx by the caller — so a scripted capture repeats. The ping-pong PARITIES are deliberately left
   *  as they are (review R2.7): every one of them is a symmetric flip-then-index pair (this frame reads [1 − p], writes [p]) whose value never reaches a shader, so zeroing them bought no
   *  determinism — the same call sequence from boot yields the same parities anyway — but DID hand every history client the two-frames-old slot as 'last frame' (and the gather last frame's
   *  moments from the wrong slot) for the frame after a mid-run reset. */
  resetClocks() { this.grainSeed = 0; }
  private grainSeed = 0;
  /** the final blit's numbers: the OUTPUT texel size, its mode (0 plain · 1 FXAA · 2 the RCAS sharpen TAAU ends with — FXAA after a temporal resolve would only blur it), grain, seed, sharpen strength */
  private fxaaData = new Float32Array(8); private postData = new Float32Array(12); private postBits = new Uint32Array(this.postData.buffer); private postSent = new Uint32Array(12);   // (rewritten every frame in place — review R1.4)
  private writeFxaaParams() { const ow = this.ow || this.width, oh = this.oh || this.height; const d = this.fxaaData; d[0] = 1 / ow; d[1] = 1 / oh; d[2] = this.taauOn ? 2 : this.fxaaEnabled ? 1 : 0; d[3] = this.grain; d[4] = this.grainSeed; d[5] = this.taauSharpen; d[6] = 0; d[7] = 0; this.device.queue.writeBuffer(this.fxaaParams, 0, d); }
  /** Per frame from engine.render (TAAU on): pack the resolve's uniform (struct TaauParams in taau.wgsl). The reset flag raised since the last frame is consumed here. */
  setTaauFrame(f: TaauFrame) {
    const d = this.taauData, fl = this.taauF32, u = this.taauU32;
    fl.set(f.prevViewProjU, 0);
    fl[16] = f.jitter[0]; fl[17] = f.jitter[1]; fl[18] = this.cw || this.width; fl[19] = this.ch || this.height; fl[20] = this.ow; fl[21] = this.oh;   // inSize = the size of the picture the resolve reads (= the output under sharp direct: a 1 : 1 resolve; the engine hands the jitter in those pixels)
    fl[22] = f.alpha; fl[23] = f.clipGamma;
    const flags = (this.taaReset ? TF.Reset : 0) | (f.bypass ? TF.Bypass : 0) | (f.particles ? TF.Particles : 0) | TF.Velocity;
    u[24] = flags; fl[25] = f.reactK; fl[26] = f.kSharp; fl[27] = f.velK; fl[28] = f.camStill ? 1 : 0; fl[29] = f.lightJump > 1 ? f.lightJump : 0; fl[30] = Math.max(0, Math.min(1, f.motionA)); fl[31] = Math.max(0, Math.min(0.9, f.motionClip));   // (29 = TaauParams.lightJump, 0 = off; 30 / 31 = motionA / motionClip: the motion-sharpness terms)
    fl[32] = Math.max(0, Math.min(2, f.histSharp ?? 0)); fl[33] = 0; fl[34] = 0; fl[35] = 0;   // 32 = TaauParams.histSharp (the history de-blur under motion; 0 = off)
    this.device.queue.writeBuffer(this.taauParams, 0, d);
    this.taaReset = false; this.taaStats.lastFlags = flags;   // (the reset raised since the last frame is honoured by this one)
    if (f.sharpen !== this.taauSharpen) { this.taauSharpen = f.sharpen; this.writeFxaaParams(); }
  }

  private ensureBindGroups(g: GBuffer, rc: RadianceCascades) {
    if (this.bgVol && this.volFroxView !== this.froxels.smokeJView) this.bgVol = null;   // (the froxel J volume was re-made / let go since this group was built)
    if (this.bgDirect && this.bgVol) return;
    if (this.bgDirect && !this.bgVol) {   // only the 2D volumetric group was dropped (the froxel J view changed): rebuild it alone
      this.bgVol = this.device.createBindGroup({ layout: this.lVol, entries: [ { binding: 0, resource: g.depthView }, { binding: 1, resource: rc.diceView }, { binding: 2, resource: this.volView }, { binding: 3, resource: this.volReactView }, { binding: 4, resource: this.froxels.smokeJView } ] });
      this.volFroxView = this.froxels.smokeJView; return;
    }
    const d = this.device;
    this.bgDirect = d.createBindGroup({ layout: this.lDirect, entries: [
      { binding: 0, resource: g.depthView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: g.idView },
      { binding: 3, resource: this.dSView[0] }, { binding: 4, resource: this.dUView[0] }, { binding: 5, resource: this.dSView[1] }, { binding: 6, resource: this.dUView[1] },
      { binding: 7, resource: g.velView },
    ] });
    // denoise bind groups (both classes per dispatch): bgDen[0] = S→P, bgDen[1] = P→S, bgDenH[hp] = H[hp]→P; every one also carries the
    // tile mask. Mask builders: bgTileFlags (S0, S1 → tileFlag), bgTileDist (tileFlag → tileDist).
    // temporal bgDTemp[hp]: (S0, S1, H0[1-hp], H1[1-hp], depthHist[1-hp]) → (H0[hp], H1[hp], depthHist[hp])
    const den = (s0: GPUTextureView, s1: GPUTextureView, d0: GPUTextureView, d1: GPUTextureView) => d.createBindGroup({ layout: this.lSoft, entries: [
      { binding: 0, resource: g.depthView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: s0 }, { binding: 3, resource: s1 },
      { binding: 4, resource: d0 }, { binding: 5, resource: d1 }, { binding: 6, resource: this.dUView[0] }, { binding: 7, resource: this.dUView[1] },
      { binding: 8, resource: this.tileDistView } ] });
    this.bgDen = [den(this.dSView[0], this.dSView[1], this.dPView[0], this.dPView[1]), den(this.dPView[0], this.dPView[1], this.dSView[0], this.dSView[1])];
    this.bgDenH = [0, 1].map(hp => den(this.dHView[0][hp], this.dHView[1][hp], this.dPView[0], this.dPView[1]));
    this.bgTileFlags = d.createBindGroup({ layout: this.lTileFlags, entries: [ { binding: 0, resource: this.dSView[0] }, { binding: 1, resource: this.dSView[1] }, { binding: 2, resource: this.tileFlagView } ] });
    this.bgTileDist = d.createBindGroup({ layout: this.lTileDist, entries: [ { binding: 3, resource: this.tileFlagView }, { binding: 4, resource: this.tileDistView } ] });
    this.bgDTemp = [0, 1].map(hp => d.createBindGroup({ layout: this.lDTemp, entries: [
      { binding: 0, resource: g.depthView }, { binding: 1, resource: this.dSView[0] }, { binding: 2, resource: this.dSView[1] },
      { binding: 3, resource: this.dHView[0][1 - hp] }, { binding: 4, resource: this.dHView[1][1 - hp] }, { binding: 5, resource: this.dDepthHistView[1 - hp] },
      { binding: 6, resource: this.dHView[0][hp] }, { binding: 7, resource: this.dHView[1][hp] }, { binding: 8, resource: this.dDepthHistView[hp] } ] }));
    this.bgVol = d.createBindGroup({ layout: this.lVol, entries: [
      { binding: 0, resource: g.depthView }, { binding: 1, resource: rc.diceView }, { binding: 2, resource: this.volView }, { binding: 3, resource: this.volReactView }, { binding: 4, resource: this.froxels.smokeJView },
    ] });
    this.volFroxView = this.froxels.smokeJView;
    // RT reflections: the trace reads the g-buffer (+ its albedo / material targets), the denoised direct pair and the dice, writes refl; the phase-5 variant per hit-record parity p also reads reflHit[1−p] and writes reflHit[p]
    { const reflRes: GPUBindGroupEntry[] = [
        { binding: 0, resource: g.depthView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: g.idView }, { binding: 3, resource: this.directView }, { binding: 4, resource: this.softView },
        { binding: 5, resource: rc.diceView }, { binding: 6, resource: this.reflView }, { binding: 7, resource: g.albedoView }, { binding: 8, resource: g.matView }, { binding: 11, resource: { buffer: this.beamBuf } } ];
      this.bgRefl = d.createBindGroup({ layout: this.lRefl, entries: reflRes });
      for (let pz = 0; pz < 2; pz++) this.bgReflP5[pz] = d.createBindGroup({ layout: this.lReflP5, entries: [ ...reflRes, { binding: 9, resource: this.reflHitView[1 - pz] }, { binding: 10, resource: this.reflHitView[pz] } ] }); }
    this.bgFGR = [null, null];   // (the resampling gather's groups are built on demand — ensureGiBG — since its reservoirs exist only once it has been asked for)
    for (let pz = 0; pz < 2; pz++) {
      // parity pz: temporal writes indHist[pz] from (raw indirect, indHist[1-pz]); the à-trous chain then reads indHist[pz]
      this.bgTemp[pz] = d.createBindGroup({ layout: this.lTemp, entries: [
        { binding: 0, resource: g.depthView }, { binding: 1, resource: this.indirectView }, { binding: 2, resource: this.indHistView[1 - pz] }, { binding: 3, resource: this.indHistView[pz] },
      ] });
    }
    // final gather: fgather → indirect (+ spec under FrameFlags.Gloss); temporal → indHist[pz]; à-trous indHist[pz] → gi0 → gi1 → gi0; composite reads gi0. Its groups are per history parity (the
    // young-history test reads LAST frame's diffuse moments / history — index [parity] at gather time, before this frame's flip) and name the internal-res pair while that path is live: ensureFgBG
    this.bgFG = [null, null];
    const gb = (src: GPUTextureView, dst: GPUTextureView) => d.createBindGroup({ layout: this.lGiBlur, entries: [ { binding: 0, resource: g.depthView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: src }, { binding: 3, resource: dst } ] });
    for (let pz = 0; pz < 2; pz++) this.bgGiBlur[pz] = [gb(this.indHistView[pz], this.giView[0]), gb(this.giView[0], this.giView[1]), gb(this.giView[1], this.giView[0])];
    // gloss chain (dispatched only under FrameFlags.Gloss, same parity as the indirect): temporal (spec, specHist[1-pz]) → specHist[pz]; one stride-1 à-trous specHist[pz] → spec; composite reads spec
    for (let pz = 0; pz < 2; pz++) {
      this.bgTempSpec[pz] = d.createBindGroup({ layout: this.lTemp, entries: [
        { binding: 0, resource: g.depthView }, { binding: 1, resource: this.specView }, { binding: 2, resource: this.specHistView[1 - pz] }, { binding: 3, resource: this.specHistView[pz] },
      ] });
      this.bgGiBlurSpec[pz] = gb(this.specHistView[pz], this.specView);
    }
    // bloom: down chain src→D0→D1→D2→D3→D4, up chain U3 = D3+tent(D4), U2 = D2+tent(U3), U1 = D1+tent(U2), U0 = D0+tent(U1) — src = the resolved picture (taaHist[p], per parity) under TAAU, else hdr;
    // the post pass reads the same source. (The `add` slot of a down group is unused by that entry point; hdrView merely fills it.)
    const bl = (src: GPUTextureView, dst: GPUTextureView, add: GPUTextureView) => d.createBindGroup({ layout: this.lBloom, entries: [ { binding: 0, resource: src }, { binding: 1, resource: dst }, { binding: 2, resource: add } ] });
    const sources = this.taauOn ? this.taaHistView : [this.hdrView];
    this.bgBloomDown0 = sources.map(sv => bl(sv, this.bloomDownView[0], this.hdrView));
    this.bgBloomDown = [this.bgBloomDown0[0]];
    for (let i = 1; i < 5; i++) this.bgBloomDown.push(bl(this.bloomDownView[i - 1], this.bloomDownView[i], this.hdrView));
    this.bgBloomUp = [];
    for (let i = 3; i >= 0; i--) this.bgBloomUp.push(bl(i === 3 ? this.bloomDownView[4] : this.bloomUpView[i + 1], this.bloomUpView[i], this.bloomDownView[i]));
    this.bgDiffDown0 = sources.map(sv => bl(sv, this.diffDownView[0], this.hdrView));   // the smoke diffusion's plain down chain (the 4-tap box entry point at every level: no Karis weighting, no clamp)
    this.bgDiffDown = [this.bgDiffDown0[0], bl(this.diffDownView[0], this.diffDownView[1], this.hdrView), bl(this.diffBlurView[1]!, this.diffDownView[2], this.hdrView)];   // (level 2 is boxed from the BLURRED level 1)
    this.bgDiffBlur = [bl(this.diffDownView[1], this.diffTmpView[1]!, this.hdrView), bl(this.diffTmpView[1]!, this.diffBlurView[1]!, this.hdrView), bl(this.diffDownView[2], this.diffTmpView[2]!, this.hdrView), bl(this.diffTmpView[2]!, this.diffBlurView[2]!, this.hdrView)];   // H then V at a quarter, H then V at an eighth
    this.bgPost = sources.map(sv => d.createBindGroup({ layout: this.lPost, entries: [ { binding: 0, resource: sv }, { binding: 1, resource: this.bloomUpView[0] }, { binding: 2, resource: { buffer: this.postParams } },
      { binding: 3, resource: this.volReactView }, { binding: 4, resource: this.diffBlurView[1]! }, { binding: 5, resource: this.diffBlurView[2]! } ] }));   // (+ the smoke diffusion's inputs: rebuilt with everything else here whenever vol, the bloom chain or the diffusion chain is re-made)
    // the TAAU resolve per parity p: reads hdr + depth + taaHist[1−p] (+ the reactive inputs and the g-buffer's motion), writes taaHist[p]
    if (this.taauOn) for (let pz = 0; pz < 2; pz++) this.bgTaau[pz] = d.createBindGroup({ layout: this.lTaau, entries: [
      { binding: 0, resource: this.hdrView }, { binding: 1, resource: g.depthView }, { binding: 2, resource: this.taaHistView[1 - pz] }, { binding: 3, resource: this.taaHistView[pz] },
      { binding: 4, resource: this.reactView }, { binding: 5, resource: this.volReactView }, { binding: 6, resource: g.velView }, { binding: 7, resource: { buffer: this.taauParams } } ] });
    this.ensureSharpBG(g);
    this.bgFxaa = d.createBindGroup({ layout: this.lFxaa, entries: [
      { binding: 0, resource: this.ldrView }, { binding: 1, resource: this.linSamp }, { binding: 2, resource: { buffer: this.fxaaParams } },
    ] });
  }

  /** Measurement aid (console: `await __engine.passes.softTileStats()`): reads back the tile mask of the last frame rendered with
   *  settings.softTileSkip on and reports the threshold it was built with, the fraction of 8x8 tiles the whole chain passes through (≈ the
   *  fraction of the chain's per-pixel work saved; a retired tile costs one broadcast texel load + a 2-texel copy per step) and the tile
   *  count per distance 0 .. skipT (the scan saturates at skipT: "at least that far"). */
  async softTileStats(): Promise<{ tiles: number; skipT: number; skipped: number; byDistance: number[]; steps: { stride: number; dir: string; ownT: number }[] } | null> {
    if (!this.tileDist || !this.lastSkipT) return null;
    const tw = this.tw, th = this.th, bpr = Math.ceil(tw * 4 / 256) * 256, T = this.lastSkipT;
    const buf = this.device.createBuffer({ size: bpr * th, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
    const enc = this.device.createCommandEncoder(); enc.copyTextureToBuffer({ texture: this.tileDist }, { buffer: buf, bytesPerRow: bpr }, [tw, th]); this.device.queue.submit([enc.finish()]);
    await buf.mapAsync(GPUMapMode.READ);
    const u = new Uint32Array(buf.getMappedRange().slice(0)); buf.unmap(); buf.destroy();
    const byDistance = new Array<number>(T + 1).fill(0); let skipped = 0;
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) { const v = u[y * (bpr / 4) + x]; byDistance[Math.min(v & 255, T)]++; if (v & 256) skipped++; }
    const steps = buildChain(this.directPasses, this.directHistory > 0).map(st => ({ stride: STRIDES[st.pipe], dir: st.bg, ownT: st.skipT }));
    return { tiles: tw * th, skipT: T, skipped: skipped / (tw * th), byDistance, steps };
  }

  /** Forget every cached bind group (they name texture views): rebuilt lazily on the next encode. Costs microseconds and touches no texture — NOT a history restart. */
  private dropBindGroups() { this.bgDirect = this.bgVol = this.bgFxaa = null; this.bgRefl = null; this.bgReflP5 = [null, null]; this.bgFGR = [null, null]; this.bgDen = []; this.bgDenH = []; this.bgTileFlags = this.bgTileDist = null; this.bgDTemp = []; this.bgTemp = [null, null]; this.bgFG = [null, null]; this.bgGiBlur = [[], []]; this.bgCompFG = null; this.bgBloomDown0 = []; this.bgBloomDown = []; this.bgBloomUp = []; this.bgPost = []; this.bgTaau = [null, null]; this.bgTempSpec = [null, null]; this.bgGiBlurSpec = [null, null]; this.bgSharpU = null; this.bgCompS = null; this.bgTaauS = [null, null]; this.bgEdge = null; this.bgGbaa = null; this.den.dropBindGroups(); }
  /** The g-buffer's targets or the radiance cache's dice volume were re-created (engine.resize / engine.rebuildRc): the bind groups naming their views must be rebuilt. The screen
   *  histories are untouched — after a cache rebuild the indirect's history simply converges on the refilled cache through its own clip + EMA (render/rc.ts owns what the cache
   *  itself does about a rebuild). This was `invalidate()`, which only ever did this much; the +6 ms 'invalidate' frames were the target re-creation in resize, now pooled. */
  externalViewsChanged() { this.dropBindGroups(); }

  /** the plain gather's group for history parity p (= LAST frame's diffuse temporal outputs: this.parity before this frame's flip): fgather's nine + moments / history at 14 / 15 (the internal-res pair
   *  while giFullLive, else the gather-grid pair — rebuilt when that flips) + the young counter at 16 */
  private ensureFgBG(g: GBuffer, rc: RadianceCascades, p: number): GPUBindGroup {
    const full = this.giFullLive;
    if (full !== this.bgFGFull) { this.bgFG = [null, null]; this.bgFGFull = full; }
    if (!this.bgFG[p]) this.bgFG[p] = this.device.createBindGroup({ layout: this.lFG, entries: [
      { binding: 0, resource: g.depthView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: g.idView }, { binding: 3, resource: this.directView }, { binding: 4, resource: this.softView },
      { binding: 5, resource: rc.diceView }, { binding: 6, resource: this.indirectView }, { binding: 7, resource: this.specView }, { binding: 8, resource: this.cardsView },
      { binding: 14, resource: full ? this.giFMomView[p] : this.giMomView[p] }, { binding: 15, resource: full ? this.giFHistView[p] : this.indHistView[p] }, { binding: 16, resource: { buffer: this.youngBuf } } ] });
    return this.bgFG[p]!;
  }
  /** phase 5: the resampling gather's group for reservoir parity p — fgather's nine bindings + set [1−p] read, set [p] written, the g-buffer's motion vectors */
  private ensureGiBG(g: GBuffer, rc: RadianceCascades, p: number): GPUBindGroup {
    if (!this.bgFGR[p]) this.bgFGR[p] = this.device.createBindGroup({ layout: this.lFGR, entries: [
      { binding: 0, resource: g.depthView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: g.idView }, { binding: 3, resource: this.directView }, { binding: 4, resource: this.softView },
      { binding: 5, resource: rc.diceView }, { binding: 6, resource: this.indirectView }, { binding: 7, resource: this.specView }, { binding: 8, resource: this.cardsView },
      { binding: 9, resource: this.giResView[1 - p][0] }, { binding: 10, resource: this.giResView[1 - p][1] }, { binding: 11, resource: this.giResView[p][0] }, { binding: 12, resource: this.giResView[p][1] },
      { binding: 13, resource: g.velView } ] });
    return this.bgFGR[p]!;
  }
  /** SHARP DIRECT's groups (only while it is on and its textures exist): the U kernel's (output-size depth / normal, their internal view, the internal dS / dU pairs → sharpE) and the 1 : 1 resolve's
   *  per history parity (hdr + the OUTPUT-size depth / motion). The compute composite's is built in ensureCompBG beside the fragment one (both name the decal buffer and the froxel view). */
  private ensureSharpBG(g: GBuffer) {
    if (!this.sharpOn || this.sharpE.length !== 2) return;
    const d = this.device;
    if (!this.bgSharpU) this.bgSharpU = d.createBindGroup({ layout: this.lSharpU, entries: [
      { binding: 0, resource: g.depthOView }, { binding: 1, resource: g.normalOView }, { binding: 2, resource: g.depthView }, { binding: 3, resource: g.normalView },
      { binding: 4, resource: this.dSView[0] }, { binding: 5, resource: this.dSView[1] }, { binding: 6, resource: this.dUView[0] }, { binding: 7, resource: this.dUView[1] },
      { binding: 8, resource: this.sharpEView[0] }, { binding: 9, resource: this.sharpEView[1] }, { binding: 10, resource: g.idOView }, { binding: 11, resource: this.sharpMaskView! } ] });
    if (!this.bgEdge) this.bgEdge = d.createBindGroup({ layout: this.lEdge, entries: [
      { binding: 0, resource: this.dSView[0] }, { binding: 1, resource: this.dSView[1] }, { binding: 2, resource: this.dUView[0] }, { binding: 3, resource: this.dUView[1] }, { binding: 4, resource: this.sharpMaskView! } ] });
    if (this.taauOn) for (let pz = 0; pz < 2; pz++) if (!this.bgTaauS[pz]) this.bgTaauS[pz] = d.createBindGroup({ layout: this.lTaau, entries: [
      { binding: 0, resource: this.hdrView }, { binding: 1, resource: g.depthOView }, { binding: 2, resource: this.taaHistView[1 - pz] }, { binding: 3, resource: this.taaHistView[pz] },
      { binding: 4, resource: this.reactView }, { binding: 5, resource: this.volReactView }, { binding: 6, resource: g.velOView }, { binding: 7, resource: { buffer: this.taauParams } } ] });
  }
  /** the composite's bind group: apart from the rest because ONE of its resources — the decal buffer — can change at runtime (setDecalBuffer) */
  /** the indirect texture the composites bound last (gi[0], or giF[0] while the internal-res chain is live — a flip rebuilds both groups) */
  private compIndView: GPUTextureView | null = null;
  private ensureCompBG(g: GBuffer, rc: RadianceCascades) {
    const ind = this.giFullLive ? this.giFView[0] : this.giView[0];   // GI in motion: composite reads the internal-res chain's output 1 : 1 while it runs (composite.wgsl upsampleIndirect keys on the texture's size)
    if (this.compIndView !== ind) { this.bgCompFG = null; this.bgCompS = null; this.compIndView = ind; }
    if (this.sharpOn && (!this.bgCompS || this.compFroxView !== this.froxels.view || this.compDecalBuf !== (this.decalBuf ?? this.decalDummy)) && this.sharpE.length === 2) {
      this.bgCompS = this.device.createBindGroup({ layout: this.lCompS, entries: [   // the compute twin at the OUTPUT size: the output-size g-buffer, sharpE as directTex / softTex, the internal-grid terms as they are, hdr as the storage target
        { binding: 0, resource: g.albedoOView }, { binding: 1, resource: g.normalOView }, { binding: 2, resource: g.depthOView }, { binding: 3, resource: g.idOView },
        { binding: 4, resource: this.sharpEView[0] }, { binding: 5, resource: ind }, { binding: 6, resource: this.volView }, { binding: 7, resource: rc.diceView }, { binding: 8, resource: this.sharpEView[1] },
        { binding: 9, resource: this.specView }, { binding: 10, resource: { buffer: this.decalBuf ?? this.decalDummy } }, { binding: 11, resource: this.froxels.view },
        { binding: 12, resource: this.reflView }, { binding: 13, resource: g.matOView }, { binding: 14, resource: this.hdrView }, { binding: 15, resource: { buffer: this.beamBuf } } ] });
      this.bgCompFG = null;   // (rebuilt below with the same decal buffer / froxel view, so the two stay in step)
    }
    if (this.bgCompFG && this.compFroxView === this.froxels.view) return;
    const d = this.device;
    this.bgCompFG = d.createBindGroup({ layout: this.lComp, entries: [
      { binding: 0, resource: g.albedoView }, { binding: 1, resource: g.normalView }, { binding: 2, resource: g.depthView }, { binding: 3, resource: g.idView },
      { binding: 4, resource: this.directView }, { binding: 5, resource: ind }, { binding: 6, resource: this.volView }, { binding: 7, resource: rc.diceView }, { binding: 8, resource: this.softView },
      { binding: 9, resource: this.specView }, { binding: 10, resource: { buffer: this.decalBuf ?? this.decalDummy } }, { binding: 11, resource: this.froxels.view },
      { binding: 12, resource: this.reflView }, { binding: 13, resource: g.matView }, { binding: 15, resource: { buffer: this.beamBuf } },
    ] });
    this.compDecalBuf = this.decalBuf ?? this.decalDummy; this.compFroxView = this.froxels.view;
  }
  /** `overlayHdr`: extra work encoded straight after the composite and before the bloom reads the HDR target — the GPU particles' splat (render/particles.ts) draws
   *  into hdrView there, so emissive sparks bloom like everything else hot and nothing drawn has a temporal history behind it. Absent = the pass graph as it was. */
  encode(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, g: GBuffer, rc: RadianceCascades, canvasView: GPUTextureView, ts: (name: string) => GPUComputePassTimestampWrites | undefined, frameFlags = 0xffffffff, overlayHdr?: (enc: GPUCommandEncoder) => void) {
    this.ensureBindGroups(g, rc); this.ensureCompBG(g, rc);
    if (this.directCarryAge < 99) this.directCarryAge++;   // (the frame uniform for THIS frame was written before encode: age 0 = the first frame after a carry has just been priced at ½ history)
    const restirOn = this.restirOn || !this.pDirect;   // (the old estimator is a LATER twin: restir stands in until it is in — traceJobs)
    if (restirOn && !this.restirRanLast) for (const b of this.resBuf) enc.clearBuffer(b);   // switched (back) on: whatever the buffers hold names lights by slots of some other frame — start clean
    else if (restirOn && this.restirBeliefsStale) { const tiles = this.tw * this.th; for (const b of this.resBuf) enc.clearBuffer(b, tiles * 64 * 16, tiles * 16); }   // a camera cut: only the per-tile light beliefs go (restir.wgsl BELIEFS — screen-anchored, unvalidated); the reservoirs validate themselves per pixel by depth
    this.restirRanLast = restirOn; this.restirBeliefsStale = false;
    {
      const p = enc.beginComputePass({ label: 'direct', timestampWrites: ts('direct') });   // (one timing name for either estimator: the HUD / recorder / cost model compare like with like)
      if (restirOn) { this.rParity ^= 1; const pt = this.heldAdaptive || this.restirStableRetrace || this.restirDimClass > 0 ? this.restirTradePipe(this.restirMotionLive) : null;   // (the lighting trades' twin, once it exists)
        p.setPipeline(pt ?? (this.restirMotionLive && this.pRestirM ? this.pRestirM : this.pRestir)); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgDirect!); p.setBindGroup(2, this.ensureRestirBG()); }   // (restirMotionLive: the RESTIR_MOTION twin on frames the camera moved — same layouts, same buffers, the reservoirs are program-agnostic)
      else { p.setPipeline(this.pDirect!); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgDirect!); }
      p.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8)); p.end();
    }
    // per class: optional temporal reuse (S → H) then the spatial chain, always ending in S; skipped entirely when direct light
    // or the denoiser is switched off — the raw S is then exactly what consumers should see (and for the ReSTIR diagnostic views 11 / 12, which S0 carries raw)
    const v3 = this.dnMode === 'v3';
    if (this.dnMode !== this.dnModeLast) {   // the two cores keep DIFFERENT things in the direct histories (legacy: accumulated S + hint; v3: accumulated ratio + lumU): a switch starts those over (both parities + their
      this.dnModeLast = this.dnMode;         // depth / geometry keys) rather than let either read the other's numbers for a frame; the v3 core's gather-grid moments / lengths / fast history likewise (stale from its last
      const p = enc.beginComputePass({ label: 'dnSwitch' });   // run otherwise). The indirect / specular VALUE histories share one layout (rgb + view depth): legacy carries them across; v3 restarts at length 0 and re-converges.
      for (const t of [...this.dH.flat(), ...this.dDepthHist, ...this.dnHg, ...this.dnHm, ...this.giMom, ...this.giFast, ...this.specMom]) this.ops.clear(p, t);
      p.end();   // (the young-history hold for this switch is raised on time by the engine's own denoiser check — engine.ts dnWas — before this frame's giCfg was written)
    }
    if ((frameFlags & (FrameFlags.Direct | FrameFlags.SoftShadow)) === (FrameFlags.Direct | FrameFlags.SoftShadow) && this.debugView !== 11 && this.debugView !== 12) {
      const useHist = this.directHistory > 0;
      const p = enc.beginComputePass({ label: 'softblur', timestampWrites: ts('softblur') });   // (the tile mask below is built inside this pass so its cost shows up in the same timing; ONE timing name for either denoiser: the HUD / recorder / cost model compare like with like)
      const wx = Math.ceil(this.width / 8), wy = Math.ceil(this.height / 8);
      p.setBindGroup(0, sceneBG);
      if (v3) {
        // THE V3 SHADOW CLIENT (render/denoise.ts encodeShadow): pack (ratio + hints + tile flags) → [tile distances] → temporal (ratio space, motion vectors, moments, clamp) → N à-trous, the
        // last writing S = U × r̂ back into dS. Textures by role: cur = dP (pack's output, then a ping-pong buffer), value history = dH[c][parity] (+ dnHm / dnHg), the raw S doubles as the
        // other ping-pong buffer once pack has read it and receives the final result.
        this.dParity ^= 1; const hp = this.dParity;
        const T = skipThreshold(dnTravel(this.den.knobs.shIters)); this.lastSkipT = T;
        const tileDist = ((frameFlags & FrameFlags.SoftTileSkip) && this.den.knobs.shPrior) ? () => { p.setPipeline(this.pTileDist.get(T) ?? this.pTileDist.get(ALL_SKIP_T[ALL_SKIP_T.length - 1])!); p.setBindGroup(1, this.bgTileDist!); p.dispatchWorkgroups(Math.ceil(this.tw / 8), Math.ceil(this.th / 8)); } : null;
        this.den.encodeShadow(p, sceneBG, {
          depth: g.depthView, normal: g.normalView, vel: g.velView, S: this.dSView, U: this.dUView, cur: this.dPView, shared: this.dnSharedView,
          hvIn: [this.dHView[0][1 - hp], this.dHView[1][1 - hp]], hvOut: [this.dHView[0][hp], this.dHView[1][hp]], hmIn: this.dnHmView[1 - hp], hmOut: this.dnHmView[hp], hgIn: this.dnHgView[1 - hp], hgOut: this.dnHgView[hp],
          tileFlag: this.tileFlagView, tileMask: this.tileDistView,
        }, wx, wy, tileDist);
      } else {
        const chain = buildChain(this.directPasses, useHist);
        if ((frameFlags & FrameFlags.SoftTileSkip) && chain.length > 0) {   // the mask, from THIS frame's S (the direct pass above has ended): per-tile hint flags, then distances + skip bit under the chain-wide threshold. Flag off: not built, and softblur never looks at it
          const T = this.pTileDist.has(chainSkipT(chain)) ? chainSkipT(chain) : ALL_SKIP_T[ALL_SKIP_T.length - 1]; this.lastSkipT = T;   // (every reachable chain's threshold has a pipeline; the widest is the safe fallback)
          p.setPipeline(this.pTileFlags); p.setBindGroup(1, this.bgTileFlags!); p.dispatchWorkgroups(wx, wy);
          p.setPipeline(this.pTileDist.get(T)!); p.setBindGroup(1, this.bgTileDist!); p.dispatchWorkgroups(Math.ceil(this.tw / 8), Math.ceil(this.th / 8));
        }
        if (useHist) this.dParity ^= 1;
        const hp = this.dParity;
        if (useHist) { p.setPipeline(this.pDTemp[0]); p.setBindGroup(1, this.bgDTemp[hp]); p.dispatchWorkgroups(wx, wy); }
        for (const st of chain) { p.setPipeline(this.pDen[st.pipe]); p.setBindGroup(1, st.bg === 'S2P' ? this.bgDen[0] : st.bg === 'P2S' ? this.bgDen[1] : this.bgDenH[hp]); p.dispatchWorkgroups(wx, wy); }
      }
      p.end();
    }
    const hx = Math.ceil(this.gw / 8), hy = Math.ceil(this.gh / 8);   // gather-resolution dispatch (1/2, or 1/3 with gatherThird)
    const giNow = this.giOn && this.giRes[0].length === 2 && !!(this.pFGRs ?? this.pFGR);   // (… and a resampling pipeline is in: both are LATER twins — traceJobs)   // phase 5: the resampling gather this frame (its reservoir sets exist from the first frame it is asked for)
    if (giNow && !this.giRanLast) { const p = enc.beginComputePass({ label: 'giRestart' }); for (const t of this.giRes.flat()) this.ops.clear(p, t); p.end(); }   // switched (back) on: whatever the reservoirs hold is radiance of some other minute — start clean
    this.giRanLast = giNow;
    // GI IN MOTION — the internal-res diffuse chain this frame: on its off → on edge its histories start clean (whatever they hold is bounce of some other minute); on the way back the gather-grid
    // diffuse histories do (they went stale while it ran). The young-texel counter is zeroed each frame the multiplier is up (the gather's first-come cap counts from 0).
    const fullNow = this.giFullLive;
    if (fullNow !== this.giFullRanLast) { const p = enc.beginComputePass({ label: 'giFullSwitch' }); for (const t of fullNow ? [...this.giFHist, ...this.giFMom, ...this.giFFast] : [...this.indHist, ...this.giMom, ...this.giFast]) this.ops.clear(p, t); p.end(); this.youngHold = 6; }   // (the composites' groups follow the switch by themselves: ensureCompBG keys on the indirect view it bound; the young-history rays stand down while the cleared side reads young everywhere — from the next frame: this one's giCfg is already written, its burst is cap-bounded)
    this.giFullRanLast = fullNow;
    if (this.youngOn && !giNow) enc.clearBuffer(this.youngBuf);
    {
      const p = enc.beginComputePass({ label: 'gather', timestampWrites: ts('gather') });
      p.setBindGroup(0, sceneBG);
      if ((frameFlags & FrameFlags.BounceCards) && this.numCards > 0) { p.setPipeline(this.pCards); p.setBindGroup(1, this.bgCards); p.dispatchWorkgroups(this.numCards); }   // torch bounce cards: one workgroup per nominated light rebuilds its footprint card (cards.wgsl) — inside this pass, so its cost is timed with the gather it serves
      if (giNow) { this.giParity ^= 1; p.setPipeline((this.gatherStrata || !this.pFGR ? this.pFGRs ?? this.pFGR : this.pFGR)!); p.setBindGroup(1, this.ensureGiBG(g, rc, this.giParity)); }   // reads set [1−p] (last frame's reservoirs), writes set [p]
      else { p.setPipeline(this.gatherStrata || !this.pFG ? this.pFGs : this.pFG); p.setBindGroup(1, this.ensureFgBG(g, rc, this.parity)); }   // (this.parity BEFORE the flip below = the parity last frame's diffuse temporal wrote) · (gatherStrata: the stratified-directions twin of either pipeline — settings.gatherStrata)
      p.dispatchWorkgroups(hx, hy); p.end();
    }
    this.parity ^= 1;
    {
      const p = enc.beginComputePass({ label: 'temporal', timestampWrites: ts('temporal') });
      p.setBindGroup(0, sceneBG);
      if (v3) {
        // THE V3 DIFFUSE + SPECULAR CLIENTS (render/denoise.ts encodeRadiance): temporal (indirect → indHist[p] + giMom / giFast) → N à-trous ending in gi[0] (composite's texture): iteration i
        // writes gi[(N − i) % 2]; the specular field the same way into `spec`, with gi[1] (done with by then) as its scratch
        const pz = this.parity, K = this.den.knobs;
        const Ng = Math.max(1, Math.min(5, Math.round(K.giIters)));
        if (fullNow) {
          // GI IN MOTION: the diffuse client at the INTERNAL resolution instead — the guided upsample of the raw gather (→ giF[1]), then temporal + à-trous at internal res ending in giF[0], which
          // composite reads 1 : 1 (denoise.wgsl giUpsample / giTemporalF; the raw `indirect` stays bound as the statistics' source). The gather-grid diffuse chain does not run.
          const wx = Math.ceil(this.width / 8), wy = Math.ceil(this.height / 8);
          const strides = this.fullStrides(); const Nf = strides.length;
          this.den.encodeGiUpsample(p, sceneBG, { depth: g.depthView, normal: g.normalView, raw: this.indirectView, out: this.giFView[1] }, wx, wy);
          this.den.encodeRadiance(p, sceneBG, {
            depth: g.depthView, normal: g.normalView, vel: g.velView, mat: g.matView, cur: this.indirectView,
            histIn: this.giFHistView[1 - pz], histOut: this.giFHistView[pz], momIn: this.giFMomView[1 - pz], momOut: this.giFMomView[pz], fastIn: this.giFFastView[1 - pz], fastOut: this.giFFastView[pz],
            chain: Array.from({ length: Nf }, (_, k) => this.giFView[(Nf - (k + 1)) % 2]),
          }, wx, wy, false, false, { curFull: this.giFView[1], strides, rawDiv: this.gatherDiv });
        } else
        this.den.encodeRadiance(p, sceneBG, {
          depth: g.depthView, normal: g.normalView, vel: g.velView, mat: g.matView, cur: this.indirectView,
          histIn: this.indHistView[1 - pz], histOut: this.indHistView[pz], momIn: this.giMomView[1 - pz], momOut: this.giMomView[pz], fastIn: this.giFastView[1 - pz], fastOut: this.giFastView[pz],
          chain: Array.from({ length: Ng }, (_, k) => this.giView[(Ng - (k + 1)) % 2]),
        }, hx, hy, false);
        if (frameFlags & (FrameFlags.Gloss | FrameFlags.Glass)) {
          const Ns = Math.max(1, Math.min(3, Math.round(K.spIters)));
          this.den.encodeRadiance(p, sceneBG, {
            depth: g.depthView, normal: g.normalView, vel: g.velView, mat: g.matView, cur: this.specView,
            histIn: this.specHistView[1 - pz], histOut: this.specHistView[pz], momIn: this.specMomView[1 - pz], momOut: this.specMomView[pz], fastIn: this.specFastView[1 - pz], fastOut: this.specFastView[pz],
            chain: Array.from({ length: Ns }, (_, k) => (Ns - (k + 1)) % 2 === 0 ? this.specView : this.giView[1]),
          }, hx, hy, true);
        }
      } else {
        p.setPipeline(this.pTemp); p.setBindGroup(1, this.bgTemp[this.parity]!);
        p.dispatchWorkgroups(hx, hy);
        this.bgGiBlur[this.parity].forEach((bg, i) => { p.setPipeline(this.pGiBlur[i]); p.setBindGroup(1, bg!); p.dispatchWorkgroups(hx, hy); });
        if (frameFlags & (FrameFlags.Gloss | FrameFlags.Glass)) {   // glossy floors / glass panes (either flag: one shared specular field): the specular the gather just wrote gets the indirect's temporal treatment (reprojected on the floor surface, depth-validated, variance-clipped) and one stride-1 à-trous pass; its cost lands in this pass's timing, the extra ray's in 'gather'
          p.setPipeline(this.pTemp); p.setBindGroup(1, this.bgTempSpec[this.parity]!); p.dispatchWorkgroups(hx, hy);
          p.setPipeline(this.pGiBlur[0]); p.setBindGroup(1, this.bgGiBlurSpec[this.parity]!); p.dispatchWorkgroups(hx, hy);
        }
      }
      p.end();
    }
    if (this.rtOn && !this.rtRanLast) { const p = enc.beginComputePass({ label: 'rtRestart' }); for (const t of [...this.reflHist, ...this.reflMom, ...this.reflFast]) this.ops.clear(p, t); p.end(); }   // switched (back) on: start the reflection histories clean
    this.rtRanLast = this.rtOn;
    { const hitNow = this.rtOn && this.rtHitReuse && this.hitEverOn;   // phase 5: hit-lighting reuse switched (back) on — its records name hits of some other minute: start clean
      if (hitNow && !this.hitRanLast) { const p = enc.beginComputePass({ label: 'hitRestart' }); for (const t of this.reflHit) this.ops.clear(p, t); p.end(); }
      this.hitRanLast = hitNow; }
    if (this.rtOn) {
      // RT REFLECTIONS: the trace at the reflection grid ('reflect'), then the shared denoiser's specular client in per-pixel mode on that grid ('rdenoise'): temporal (refl → hist[p], mom[p],
      // fast[p]) → rfIters à-trous laid out so the LAST lands back in refl, which the composite reads (iteration i writes refl when (N−1−i) is even, the scratch otherwise). Runs under either
      // denoiser core (the legacy chains have no client for it; the v3 specular client is self-contained).
      const rx = Math.ceil(this.rw / 8), ry = Math.ceil(this.rh / 8);
      { const p = enc.beginComputePass({ label: 'reflect', timestampWrites: ts('reflect') });
        p.setBindGroup(0, sceneBG);
        if (this.rtP5 && this.pReflP5) { this.hitParity ^= 1; p.setPipeline(this.pReflP5); p.setBindGroup(1, this.bgReflP5[this.hitParity]!); }   // phase 5's variant (mesh hits / hit reuse wanted): its hit records read [1−p], write [p] (1×1 stand-ins while reuse itself is off)
        else { p.setPipeline(this.pRefl); p.setBindGroup(1, this.bgRefl!); }                                                    // main's pass, the same program every tier ran before the phase
        p.dispatchWorkgroups(rx, ry); p.end(); }
      { this.rtParity ^= 1; const pz = this.rtParity;
        const N = Math.max(1, Math.min(4, Math.round(this.den.knobs.rfIters)));
        const p = enc.beginComputePass({ label: 'rdenoise', timestampWrites: ts('rdenoise') });
        this.den.encodeRadiance(p, sceneBG, {
          depth: g.depthView, normal: g.normalView, vel: g.velView, mat: g.matView, cur: this.reflView,
          histIn: this.reflHistView[1 - pz], histOut: this.reflHistView[pz], momIn: this.reflMomView[1 - pz], momOut: this.reflMomView[pz], fastIn: this.reflFastView[1 - pz], fastOut: this.reflFastView[pz],
          chain: Array.from({ length: N }, (_, k) => (N - (k + 1)) % 2 === 0 ? this.reflView : this.reflScratchView),
        }, rx, ry, true, true);
        p.end(); }
    }
    { // volumetrics: under FrameFlags.FroxelVol the froxel kernels (cull → inject → temporal → integrate, render/froxels.ts) and then the 2D pass (the smoke march lit from their J volume +
      // the rain); flag down = the per-pixel march as it always was. One timed pass either way ('volumetrics' = everything volumetric), or split per stage for measurement.
      const froxOn = (frameFlags & FrameFlags.FroxelVol) !== 0 && this.froxels.allocated;
      const vol2D = (p: GPUComputePassEncoder) => { p.setPipeline((this.volK0 ? this.volK0Pipe() : null) ?? (this.dustLook && this.pVolDust ? this.pVolDust : froxOn && this.pVolF ? this.pVolF : this.pVol)); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgVol!); p.dispatchWorkgroups(Math.ceil(this.vw / 8), Math.ceil(this.vh / 8)); };
      if (froxOn && this.froxelSplitTiming) {
        let p = enc.beginComputePass({ label: 'volInject', timestampWrites: ts('volInject') });
        this.froxels.encode(p, sceneBG, rc.diceView, stage => { if (stage === 'inject') return p; p.end(); p = enc.beginComputePass({ label: stage, timestampWrites: ts(stage === 'temporal' ? 'volTemporal' : 'volInteg') }); return p; });
        p.end();
        { const q = enc.beginComputePass({ label: 'volumetrics', timestampWrites: ts('volumetrics') }); vol2D(q); q.end(); }
      } else {
        if (froxOn) { const f = enc.beginComputePass({ label: 'volFroxel', timestampWrites: ts('volFroxel') }); this.froxels.encode(f, sceneBG, rc.diceView); f.end(); }   // (its own timing: a fixed cost per tier — auto quality's calibration counts it as such — where the 2D pass scales with pixels)
        const p = enc.beginComputePass({ label: 'volumetrics', timestampWrites: ts('volumetrics') });
        vol2D(p);
        p.end();
      }
    }
    if (this.sharpOn && !(this.sceneBGOut && this.bgSharpU && this.bgCompS && this.bgEdge) && !this.sharpWarned) { this.sharpWarned = true; console.warn('sharp direct: live but its groups are missing this frame (sceneBGOut / bgSharpU / bgCompS / bgEdge) — the fragment composite runs against an output-size hdr; the engine must set sceneBGOut and resize() must have run'); }
    if (this.sharpOn && this.sceneBGOut && this.bgSharpU && this.bgCompS && this.bgEdge) {
      // SHARP DIRECT: the hard-edge mask over the denoised direct pair (internal size, sharp_edge.wgsl — edge rays only, its own timing), then U re-scored per OUTPUT pixel × the internal visibility ratio →
      // sharpE (sharp_direct.wgsl), then the composite's compute twin per output pixel → hdr. The two output-size kernels bind the OUTPUT frame block.
      const traced = this.edgeRays || this.sliverRays;
      this.ensureSharp(traced, this.edgeRays);   // (the pipelines are compiled the first frame the path is live — the traced kernel the first frame either ray user is on, the mask kernel the first frame the edge rays are, unless init prepared them)
      const wx = Math.ceil(this.cw / 8), wy = Math.ceil(this.ch / 8);
      if (this.edgeRays) { const p = enc.beginComputePass({ label: 'sharpEdge', timestampWrites: ts('sharpEdge') }); p.setPipeline(this.pEdge!); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgEdge); p.dispatchWorkgroups(Math.ceil(this.width / 8), Math.ceil(this.height / 8)); p.end(); }   // (internal size, its own timing; skipped with the edge rays off — the default pipeline never reads the mask)
      { const p = enc.beginComputePass({ label: 'sharpU', timestampWrites: ts('sharpU') }); p.setPipeline(traced ? this.pSharpUE! : this.pSharpU!); p.setBindGroup(0, this.sceneBGOut); p.setBindGroup(1, this.bgSharpU); p.dispatchWorkgroups(wx, wy); p.end(); }
      { const p = enc.beginComputePass({ label: 'compS', timestampWrites: ts('compS') }); p.setPipeline((this.glassRefract && this.pCompSR ? this.pCompSR : this.pCompS ?? this.pCompSR)!); p.setBindGroup(0, this.sceneBGOut); p.setBindGroup(1, this.bgCompS); p.dispatchWorkgroups(wx, wy); p.end(); }   // (glassRefract: the refraction twin of the same kernel — the same layout and groups)
    } else {
      const p = enc.beginRenderPass({ label: 'composite', colorAttachments: [{ view: this.hdrView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }], timestampWrites: ts('composite') as GPURenderPassTimestampWrites | undefined });
      const pc = this.glassRefract && this.pCompR ? this.pCompR : this.pComp ?? this.pCompR;   // (both LATER twins: until one is in, engine.render holds sharp direct live; a frame it cannot — a debug view, TAAU off — clears the target)
      if (pc) { p.setPipeline(pc); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgCompFG!); p.draw(3); }
      p.end();   // (glassRefract: the refraction twin)
    }
    if (overlayHdr) overlayHdr(enc);   // (the particles' splat into hdr: after the composite wrote it, before the resolve / the bloom reads it)
    if (this.gbaaOn && this.hdrCopy) {   // GBAA: hdr → hdrCopy, then every pixel a box edge crosses blended in place with its neighbour across the edge (gbaa.wgsl; the OUTPUT-size raster's edges under sharp direct)
      if (!this.pGbaa) this.buildGbaa();
      if (!this.bgGbaa) this.bgGbaa = this.device.createBindGroup({ layout: this.lGbaa, entries: [{ binding: 0, resource: this.hdrCopyView! }, { binding: 1, resource: g.edgeOView }, { binding: 2, resource: this.hdrView }, { binding: 3, resource: g.depthOView }] });
      enc.copyTextureToTexture({ texture: this.hdr }, { texture: this.hdrCopy }, [this.cw, this.ch]);
      const p = enc.beginComputePass({ label: 'gbaa', timestampWrites: ts('gbaa') }); p.setPipeline(this.pGbaa!); p.setBindGroup(0, this.sharpOn && this.sceneBGOut ? this.sceneBGOut : sceneBG); p.setBindGroup(1, this.bgGbaa); p.dispatchWorkgroups(Math.ceil(this.cw / 8), Math.ceil(this.ch / 8)); p.end();
    }
    if (this.fogOn && this.fogFrame) (this.fogPass ??= new FogPass(this.device, this.sceneLayout)).encode(enc, this.fogFrame, this.sharpOn && this.sceneBGOut ? this.sceneBGOut : sceneBG, this.hdr, this.hdrView, this.cw, this.ch, g.depthOView, g.normalOView, g.albedoOView, () => ts('fogofwar'));   // FOG OF WAR: hdr → its copy, then every pixel no eye of the team sees pushed down in place (fogofwar.wgsl) — only while the game's switch is on
    if (this.outline?.on) {
      const seen = this.outline.picture && this.hdrCopy ? this.hdrCopyView : null;   // (by the picture: this frame's composite as a texture the pass may read)
      if (seen && !this.gbaaOn) enc.copyTextureToTexture({ texture: this.hdr }, { texture: this.hdrCopy! }, [this.cw, this.ch]);   // (GBAA filled it above; without GBAA it is filled here)
      (this.outlinePass ??= new OutlinePass(this.device)).encode(enc, this.outline, this.hdrView, g.idOView, g.depthOView, this.cw, this.ch, seen);
    } else this.outlinePass?.release();   // THE OUTLINE IN THE DARK: the player's own pixels rimmed, over the fog and under the resolve (outline.wgsl) — only while his Options row is on. By the picture it reads the copy of this frame's composite (setOutlineCopy)
    let src = 0;   // which bloom-down0 / post bind group: the history parity under TAAU, the lone hdr group without it
    if (this.taauOn) {   // the TAAU resolve: hdr (internal, jittered) + depth + last output → this frame's output = taaHist[p] at the OUTPUT size; everything below reads that
      this.taaParity ^= 1; src = this.taaParity; this.taaStats.frames++;
      const p = enc.beginComputePass({ label: 'taau', timestampWrites: ts('taau') });
      const sh = this.sharpOn && !!this.sceneBGOut && !!this.bgTaauS[src];   // sharp direct: the 1 : 1 resolve of the output-size composite (the OUTPUT frame block, the output-size depth / motion)
      if (sh) this.ensureSharp(false);
      p.setPipeline(sh ? this.pTaauS! : this.pTaau); p.setBindGroup(0, sh ? this.sceneBGOut! : sceneBG); p.setBindGroup(1, sh ? this.bgTaauS[src]! : this.bgTaau[src]!);
      p.dispatchWorkgroups(Math.ceil(this.ow / 8), Math.ceil(this.oh / 8)); p.end();
    }
    {
      { const d = this.postData; d[0] = this.bloom; d[1] = this.saturation; d[2] = this.smokeDiffuse; d[3] = this.nvPhosphor; d[4] = 1 / (this.ow || this.width); d[5] = 1 / (this.oh || this.height); d[6] = this.smokeDiffuseBilinear ? 1 : 0; d[7] = this.smokeDiffuseTau0; d[8] = this.nvOval; writeWordsIfChanged(this.device, this.postParams, 0, this.postBits, this.postSent); }
      this.grainSeed = (this.grainSeed + 1) % 4096; this.writeFxaaParams();   // grain animates per frame and is applied after FXAA / the sharpen
      const p = enc.beginComputePass({ label: 'bloom', timestampWrites: ts('bloom') });
      p.setBindGroup(0, sceneBG);
      if (this.smokeDiffuse > 0 && (this.smokeSlots > 0 || this.smokeDiffuseTau0 < 0)) {   // the smoke diffusion's own plain chain: src → W/2 → W/4 → W/8, three 4-tap box dispatches (~1/3 Mpx in all at high)
        const wg = (t: GPUTexture) => [Math.ceil(t.width / 8), Math.ceil(t.height / 8)] as const;
        for (let i = 0; i < 3; i++) {
          const t = this.diffDown[i]; p.setPipeline(this.pBloomDown); p.setBindGroup(1, i === 0 ? this.bgDiffDown0[src] : this.bgDiffDown[i]); p.dispatchWorkgroups(...wg(t));
          if (i > 0) {   // band-limit the level before anything reads it (post, or the next box): H then V
            p.setPipeline(this.pDiffBlurH); p.setBindGroup(1, this.bgDiffBlur[(i - 1) * 2]); p.dispatchWorkgroups(...wg(t));
            p.setPipeline(this.pDiffBlurV); p.setBindGroup(1, this.bgDiffBlur[(i - 1) * 2 + 1]); p.dispatchWorkgroups(...wg(t));
          }
        }
      }
      if (this.bloom > 0) {
        for (let i = 0; i < 5; i++) { const t = this.bloomDown[i]; p.setPipeline(i === 0 ? this.pBloomDown0 : this.pBloomDown); p.setBindGroup(1, i === 0 ? this.bgBloomDown0[src] : this.bgBloomDown[i]); p.dispatchWorkgroups(Math.ceil(t.width / 8), Math.ceil(t.height / 8)); }
        for (let k = 0; k < 4; k++) { const t = this.bloomUp[3 - k]; p.setPipeline(this.pBloomUp); p.setBindGroup(1, this.bgBloomUp[k]); p.dispatchWorkgroups(Math.ceil(t.width / 8), Math.ceil(t.height / 8)); }
      }
      p.end();
    }
    {
      const p = enc.beginRenderPass({ label: 'post', colorAttachments: [{ view: this.ldrView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }], timestampWrites: ts('post') as GPURenderPassTimestampWrites | undefined });
      p.setPipeline(this.pPost); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgPost[src]); p.draw(3); p.end();
    }
    {
      const p = enc.beginRenderPass({ label: 'fxaa', colorAttachments: [{ view: canvasView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 1 } }], timestampWrites: ts('fxaa') as GPURenderPassTimestampWrites | undefined });
      p.setPipeline(this.pFxaa); p.setBindGroup(0, this.bgFxaa!); p.draw(3); p.end();
    }
  }
}
