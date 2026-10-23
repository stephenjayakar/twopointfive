// GPU particles (EXPERIMENT E4 — sparks, debris chips, dust puffs, spent casings): the CPU half. Game code queues EMITS (kind, where, which way, how many, a
// few numbers); once a frame the queue is packed into one uniform block with the ring slots each emit was dealt, and two compute kernels (shaders/
// particles.wgsl) give birth to and step every live particle — gravity, drag, collision against the renderer's own trace grid, sleep, and SHADING (sparks
// off their cooling curve, everything else lit by the light buffer + two shadow rays + the radiance cache) — then one draw splats the live windows into the
// HDR target after the composite (shaders/particles_draw.wgsl), where the bloom picks the hot ones up. What lives here: the pool layout, the two rings and
// their live windows (only those are simulated / drawn: nothing alive = no dispatch, no draw), the per-kind numbers the panel edits, the emit API, the
// IMPULSE API (game events — a stun charge, a round beside settled litter, a thump on the floor — kicking and waking live particles: ≤ MAX_IMPULSES records
// a frame in the same block's tail, uploaded only on frames that carry any, applied by the update kernel; game/sheetModel.ts is the reference of what one
// does), the stats read back from the pool header. Deterministic: every random draw on the GPU hashes (emit / impulse serial, particle index) — no Math.random on the path.
//
// Bindings, against this adapter's budget (10 storage buffers a stage on Chrome/Metal; the scene group already holds 8 in compute / fragment):
//   simulation  group 0 = the scene group (trace grid, lights, reach rows, capsules, mesh trees…: 8 storage) + group 1 = { pool (storage rw), the frame's
//               uniform block, the cascade dice (texture) } → 9 storage buffers in the compute stage;
//   splat       group 0 = the scene group (only `frame` is touched) + group 1 = { pool (read-only storage, VERTEX), the same uniform block, g-buffer depth,
//               the volumetric texture } → +1 storage buffer in the vertex stage (3 with the scene's two `all`-visible ones), +0 in the fragment stage.
import { cutSwap, ProgramSet } from './cutSwap';
import { tuned } from './shaderTune';   // the scene tweak panel's constant overrides (empty map = each text itself)
import { makeBuffer, makeShader, computePipelineAsync, renderPipelineAsync } from '../gpu/device';
import { Vec3 } from '../math/vec';
import { scenePrelude, glassBreakConfig } from './frame';
import { SHEET, IMP_RESPONSE, type ImpulseResponse } from '../game/sheetModel';
import { SHARD, SHARD_IMP } from '../game/shardModel';
import type { WindGpuSource } from '../smoke/types';
import { WIND_GPU_MAX } from '../smoke/types';
import lightingCommon from './shaders/lighting_common.wgsl' with { type: 'text' };
import particlesCommon from './shaders/particles_common.wgsl' with { type: 'text' };
import windFieldSrc from './shaders/wind_field.wgsl' with { type: 'text' };   // THE wind field (game/wind.ts): the same text the smoke solver compiles — the update kernel's windAir sums it
import particlesSrc from './shaders/particles.wgsl' with { type: 'text' };
import particlesDrawSrc from './shaders/particles_draw.wgsl' with { type: 'text' };
import refractCommon from './shaders/refract_common.wgsl' with { type: 'text' };   // the SHARED refraction module (feat/solid-glass-refraction's text, verbatim: Snell / Fresnel / Beer–Lambert / the re-projection and its screen guards; the rain streaks refract the composite's copy through it) — binding-free, prepended to the splat

export type PKind = 'spark' | 'debris' | 'dust' | 'casing' | 'sheet' | 'rain' | 'shard';
export const P_KINDS: readonly PKind[] = ['spark', 'debris', 'dust', 'casing', 'sheet', 'rain', 'shard'];
export const KIND_ID: Record<PKind, number> = { spark: 0, debris: 1, dust: 2, casing: 3, sheet: 4, rain: 5, shard: 6 };
/** which ring a kind is dealt from: 0 = SHORT-lived (seconds at most), 1 = LONG (chips, brass and paper that lie there) — a spark storm never evicts resting brass — 2 = RAIN (the particle rain's
 *  own ring past the other two: a downpour's hundred births a frame never lap a dust puff, and rain never waits behind or delays a gameplay record — see prepare()) */
export const KIND_RING: Record<PKind, 0 | 1 | 2> = { spark: 0, dust: 0, debris: 1, casing: 1, sheet: 1, rain: 2, shard: 1 };
export const P_CAP = 16384;
export const RINGS: readonly { start: number; size: number }[] = [{ start: 0, size: 6144 }, { start: 6144, size: 10240 }];
/** the RAIN ring (EXPERIMENT exp/particle-rain, game/rainFx.ts): slots P_CAP ‥ P_CAP + RAIN_CAP past the two gameplay rings — its window rides in the emit block's TAIL (particles_common.wgsl EmitBlock.rainWin) so the
 *  header, the records and both gameplay windows are laid out exactly as they were. A drop's slot is held for its filed life + slack (≈ 1.23 s; a drip off a lamp head ≈ 1.8 s, and the FIFO
 *  retires in order) while it is in the air ~0.73 s, so N alive need 1.7‥2.5 N slots: 16384 hold ~5900 with the drips on, ~8900 without (rainFx.ts clamps its target to the ring); +1.25 MB of pool. */
export const RAIN_CAP = 16384;
export const RAIN_RING = { start: P_CAP, size: RAIN_CAP } as const;
/** rain births a frame (its own budget, apart from settings.particleBirths: a downpour is a steady 100‥250 a frame, dealt AFTER every gameplay record and never queued — what does not fit this frame is simply not born) */
export const RAIN_MAX_BIRTHS = 640;
/** rain emit records waiting for the next prepare() at most (the recycler files 1‥5 a frame; the queue is emptied every frame either way) */
const RAIN_MAX_RECS = 12;
export const MAX_EMITS = 128;          // emit records PACKED a frame (one record = one burst of `count`); the queue may hold more — they wait (MAX_QUEUE)
export const MAX_NEW_PER_FRAME = 6144; // births a frame (a whole SHORT ring) — the hard ceiling over the per-preset cap (Particles.maxBirthsPerFrame)
/** the emit queue's bound: records not yet born wait here across frames when a frame's birth cap / record cap is spent (renderer v3 Phase 0: a firefight's bursts
 *  are spread over a few frames instead of flooding one). Past this many waiting, the OLDEST SPARK records are shed first (a spark burst born a quarter second
 *  late is wrong anyway); chips, dust and brass are never shed — they are few, and a case that lands three frames late is still a case on the floor. */
export const MAX_QUEUE = 512;
/** a spark record that has waited this many frames is shed rather than born stale (≈ 0.1 s at 60) */
export const SPARK_MAX_WAIT = 6;
/** IMPULSE records a frame (particles_common.wgsl MAX_IMPS; the queue never holds more either: past it, one close by is merged into — strengths summed and capped,
 *  the wider radius, both kind sets — else the weakest goes) and how close two must be to merge under that pressure (m) */
export const MAX_IMPULSES = 16, IMPULSE_MERGE_M = 1.0;
/** the merged strength's ceiling, × the stronger of the two: forty charges in one spot push like two, not forty */
const IMPULSE_MERGE_CAP = 2.0;
const P_BYTES = 80, HDR_BYTES = 64;   // (P_BYTES = struct Particle in particles_common.wgsl: 64 + the sheet's orientation / angular velocity / aux row)
/** the uniform block: header (counts + windows + 2 kind rows and 1 impulse-response row per kind — particles_common.wgsl EmitBlock kp / ki) · MAX_EMITS emit records · MAX_IMPULSES impulse
 *  records (uploaded only on frames that carry any) · the TAIL (the rain ring's Window, 4 u32 — EmitBlock.rainWin — + the rain LOOK rows rainCfg‥rainCfgF, 6 × vec4f: EmitBlock's last members,
 *  their own small upload). KP_FLOAT / KI_FLOAT = the kind rows' / the impulse-response rows' first float in the block. */
export const REC_BYTES = 112, BLOCK_HDR_BYTES = 48 + P_KINDS.length * 48, KP_FLOAT = 12, KI_FLOAT = 12 + P_KINDS.length * 8, IMP_BYTES = 64, IMP_OFFSET = BLOCK_HDR_BYTES + MAX_EMITS * REC_BYTES, BLOCK_TAIL_AT = IMP_OFFSET + MAX_IMPULSES * IMP_BYTES, BLOCK_TAIL_BYTES = 16 + 6 * 16, BLOCK_BYTES = BLOCK_TAIL_AT + BLOCK_TAIL_BYTES;
/** PARTICLE RAIN v2 — the LOOK the rain kind's kernels read off the block's tail (game/rainFx.ts PRAIN mirrors into it every frame; particles_common.wgsl rainCfg‥rainCfgF words them).
 *  Shading: iso / fwdK / fwdG (the drop's phase), glintK / glintRough / glintCap (the strand glint and its bound), gain, tailKeep; the splat: refract (0 = off) / refractReachM / refractTaps /
 *  refractClamp / refractDepth / refractPaint (0‥1: how much of the picture a read taken beside the streak keeps; 1 = all of it, as it was; 0 = its light only), lenJit / brightJit / minPx; the wind: windK (× the air on a drop), sheetAmp / sheetLen + the sheets' running offset bandOffX / Z (m, ∫ air dt). */
export interface RainLook { iso: number; fwdK: number; fwdG: number; glintK: number; glintRough: number; glintCap: number; gain: number; tailKeep: number; refract: number; refractReachM: number; refractTaps: number; refractClamp: number; refractDepth: number; refractPaint: number; lenJit: number; brightJit: number; minPx: number; maxPx: number; boostCap: number; nearFadeM: number; beadAmp: number; windK: number; sheetAmp: number; sheetLen: number; bandOffX: number; bandOffZ: number; }
export const RAIN_LOOK_DEFAULTS: Readonly<RainLook> = Object.freeze({ iso: 1, fwdK: 0, fwdG: 0.8, glintK: 0, glintRough: 0.08, glintCap: 12, gain: 1, tailKeep: 0, refract: 0, refractReachM: 6, refractTaps: 3, refractClamp: 6, refractDepth: 0.3, refractPaint: 1, lenJit: 0, brightJit: 0, minPx: 0.75, maxPx: 64, boostCap: 1, nearFadeM: 2, beadAmp: 0, windK: 1, sheetAmp: 0, sheetLen: 7, bandOffX: 0, bandOffZ: 0 });   // (= v1's look until rainFx.ts writes PRAIN over it: iso 1, no lobe, no glint, no refraction, no spread, no width ceiling, the 2 m near fade)

/** Per-kind numbers (shaders/particles_common.wgsl k0 / k1), live from the panel. holdOrFade: SPARK = fraction of life held white-hot before the fall to red;
 *  others = seconds of fade-out at the end of life. shutterOrGrowth: streak kinds = seconds of motion one streak shows; DUST = growth factor of the radius over
 *  its life. brightOrOpacity: SPARK = brightness × (× 25 HDR at white heat, meant to clip); DUST = peak opacity; others unused (1).
 *  DUST reads its physics-free slots as LOOK (game/particleFx.ts DUST_LOOK, Tab ▸ Effects ▸ Dust puffs): restitution = the share of a crossing beam scattered toward the eye (0.5),
 *  keep = × the cache's ambient on it (1), sleepV = fade-in seconds (0.06), holdOrFade = × the edge feather / depth softening (1) — the values the kernels had as literals.
 *  SHEET reads the eight slots as game/sheetModel.ts SHEET: gravity · drag = KT (along-slip) · restitution = KN_LIN · keep = KN_Q (through-slip drag × airspeed) ·
 *  sleepV · holdOrFade = fade s · shutterOrGrowth = FLUT (flutter torque gain) · brightOrOpacity = TRANS (light through the back face).
 *  RAIN reads them as: gravity · drag (toward the AIR's velocity: terminal fall = gravity ÷ drag = 9 m/s, the lattice's RAIN_V) · restitution = TAAU reactivity × (particles_draw.wgsl) ·
 *  keep = splash crown radius m · sleepV = splash seconds · holdOrFade = streak fade-in s (born under the top of the slab, not popped) · shutterOrGrowth = streak shutter s · brightOrOpacity = radiance ×. */
export interface KindParams { gravity: number; drag: number; restitution: number; keep: number; sleepV: number; holdOrFade: number; shutterOrGrowth: number; brightOrOpacity: number; }
export const KIND_DEFAULTS: Record<PKind, KindParams> = {
  spark:  { gravity: 16,  drag: 1.6, restitution: 0.25, keep: 0.7,  sleepV: 0,    holdOrFade: 0.15, shutterOrGrowth: 0.017, brightOrOpacity: 2.6 },   // = effects.ts sparks: gravity 16, drag 1.6, floor bounce −0.25 / ×0.7, hold 0.15, shutter 17 ms, brightness 2.6
  debris: { gravity: 9.8, drag: 0.9, restitution: 0.3,  keep: 0.55, sleepV: 0.35, holdOrFade: 3.0,  shutterOrGrowth: 0.008, brightOrOpacity: 1 },
  dust:   { gravity: 0.35, drag: 6.0, restitution: 0.5, keep: 1.0,  sleepV: 0.05, holdOrFade: 1.3,  shutterOrGrowth: 0.6,   brightOrOpacity: 0.3 },   // (drag 6: a puff of dust decelerates in centimetres, it does not sail; growth / opacity = particleFx.ts DUST_LOOK's 08-12 defaults)   // (restitution / keep / sleepV / holdOrFade = the puff's LOOK: wrap, ambient ×, fade-in s, softness × — particleFx.ts DUST_LOOK)
  casing: { gravity: 9.8, drag: 0.45, restitution: 0.42, keep: 0.72, sleepV: 0.4, holdOrFade: 4.0,  shutterOrGrowth: 0.008, brightOrOpacity: 1 },
  sheet:  { gravity: SHEET.gravity, drag: SHEET.KT, restitution: SHEET.KN_LIN, keep: SHEET.KN_Q, sleepV: SHEET.sleepV, holdOrFade: SHEET.fade, shutterOrGrowth: SHEET.FLUT, brightOrOpacity: SHEET.TRANS },
  rain:   { gravity: 9.8, drag: 9.8 / 9.0, restitution: 6, keep: 0.06, sleepV: 0.2, holdOrFade: 0.09, shutterOrGrowth: 1 / 30, brightOrOpacity: 1 },   // (restitution = the reactivity ×, mirrored from settings.particleRainReact by game/rainFx.ts; brightOrOpacity likewise from particleRainBright)
  shard:  { gravity: SHARD.gravity, drag: SHARD.drag, restitution: SHARD.restitution, keep: SHARD.keep, sleepV: SHARD.sleepV, holdOrFade: SHARD.fade, shutterOrGrowth: SHARD.ROUGH, brightOrOpacity: SHARD.SCATTER },   // a fragment of a broken pane (game/shards.ts; game/shardModel.ts is the reference): drag = 1/s at the reference centimetre, shutterOrGrowth = the glint lobe's roughness, brightOrOpacity = the body's diffuse scatter
};

export type EmitShape = 'cone' | 'burst' | 'ring' | 'puff' | 'rainDisc';
const SHAPE_ID: Record<EmitShape, number> = { cone: 0, burst: 1, ring: 2, puff: 3, rainDisc: 4 };   // rainDisc (particles.wgsl emit): born at pos.y (− up to a metre) uniformly over the OUTDOOR part of the disc of radius `radius` about pos.xz — the GPU rejects the interior / annex footprints itself — moving along dir at speed
/** One emit's numbers (what the record carries; see EmitRec in particles_common.wgsl). speed m/s, spread = cone half-angle (rad) | burst spread, life s, size m
 *  (a spark's streak thickness, a chip's width, a puff's birth radius, a case's diameter), jitters 0‥1, lift = burst / ring vertical share, radius = ring radius,
 *  posJit = birth position scatter (m), vadd = velocity inherited from whatever emitted it, owner = character id its rays ignore, color = linear albedo / tint;
 *  aspect = length ÷ width (a SHEET's shape — 1.41 A4, 1.29 letter, 1 a post-it — or a splinter's elongation; default 1), tumble = SHEET initial angular rate cap
 *  (rad/s), nrmJit = SHEET normal scatter (0 = born lying flat, 1 = any way up; default 0.35); seed = the record's seed by hand (the rain recycler deals its own, so a downpour
 *  never advances the serial the gameplay effects hash — their births stay byte for byte what they were without it). */
export interface EmitOpts { shape?: EmitShape; speed: number; spread?: number; life: number; size: number; speedJit?: number; lifeJit?: number; sizeJit?: number; lift?: number; radius?: number; posJit?: number; vadd?: Vec3; owner?: number; color?: Vec3; /** RAIN-KIND records only: the colour word's top byte, 0‥255 (255 unsaid) — a wisp of snow's look (game/snowFx.ts wispLookByte) */ top?: number; aspect?: number; tumble?: number; nrmJit?: number; seed?: number;
  /** DUST only: STEAM (game/snowBreath.ts) — a puff filed with this (0‥1, under 1) is warm breath: its peak opacity × this, and it rises instead of settling. It rides
   *  the colour word's top byte, 255 on every other record (shaders: `steamOf`); left out = the puff as it always was */
  steam?: number;
  /** SPARK only: an EMBER off an open fire (game/fire.ts) — a spark filed with this (0‥1, under 1: × its light) rides the hot air up and goes with the wind where a
   *  spark flies and falls, and cools slowly through orange to a red that dies. It rides the colour word's top byte like `steam` (shaders: `emberIs`); left out = a spark as it always was */
  ember?: number; }
interface EmitRec { kind: PKind; pos: Vec3; dir: Vec3; count: number; o: EmitOpts; seed: number; /** filed while Particles.ours was up */ ours?: boolean; /** frames this record has waited in the queue past the one it was queued for (the birth cap) */ waited: number; }
/** One impulse's numbers (particles_common.wgsl ImpulseRec; game/sheetModel.ts is the reference of what it does): `up` = upward share added to the radial push (default 0),
 *  `bias` = a direction folded in with its weight as its length (default none), `kinds` = which kinds respond (default every kind but sparks), `occlude` + `eye` = gate
 *  each particle further than half a metre by one any-hit ray from `eye` (default the impulse's position) — a wall between a charge and the litter behind it stops it. */
export interface ImpulseOpts { up?: number; bias?: Vec3; kinds?: readonly PKind[]; occlude?: boolean; eye?: Vec3; /** the caller's own seed: the impulses' serial is then left where it was (as EmitOpts.seed) */ seed?: number; }
/** the queued record (a fixed pool of MAX_IMPULSES of these is reused: queuing allocates nothing) */
interface ImpRec { pos: Vec3; radius: number; strength: number; up: number; bias: Vec3; eye: Vec3; kinds: number; flags: number; seed: number; }
const KINDS_DEFAULT = (1 << KIND_ID.debris) | (1 << KIND_ID.dust) | (1 << KIND_ID.casing) | (1 << KIND_ID.sheet) | (1 << KIND_ID.shard);
/** the kinds a WIND record moves unless it says otherwise: everything but sparks and brass (particles.wgsl windCoupling then weighs each) — and the RAIN (its own step reads windAir: born with the air, dragged toward it) */
export const WIND_KINDS_DEFAULT = (1 << KIND_ID.debris) | (1 << KIND_ID.dust) | (1 << KIND_ID.sheet) | (1 << KIND_ID.rain);
const NO_OPTS: ImpulseOpts = Object.freeze({}); const ZERO3: Vec3 = [0, 0, 0];
export const kindMask = (ks: readonly PKind[]) => ks.reduce((m, k) => m | (1 << KIND_ID[k]), 0);
/** two numbers as one u32 of f16 halves, low half first (WGSL unpack2x16float's order) — the wind knobs riding in a record's spare words */
const f16Scratch = new Float32Array(1); const f16Bits = new Uint32Array(f16Scratch.buffer);
function f16(v: number): number {
  f16Scratch[0] = v; const x = f16Bits[0]; const s = (x >>> 16) & 0x8000; let e = ((x >>> 23) & 0xff) - 112; let m = x & 0x7fffff;
  if (e <= 0) { if (e < -10) return s; m |= 0x800000; const sh = 14 - e; return s | ((m + (1 << (sh - 1))) >> sh); }
  if (e >= 31) return s | 0x7c00 | (((x >>> 23) & 0xff) === 255 && m ? 0x200 : 0);
  const r = s | (e << 10) | (m >> 13); return (m & 0x1000) ? r + 1 : r;   // (round half up on the dropped bits: plenty for a knob)
}
export function f16pair(a: number, b: number): number { return (f16(a) | (f16(b) << 16)) >>> 0; }

export interface ParticleStats {
  /** from the pool header, a few frames stale: particles alive, of which resting (per frame); contacts, born-inside-geometry kills, particles kicked by an impulse and resting leaves the wind picked up (cumulative since the buffer was made) */
  alive: number; asleep: number; bounces: number; killedInside: number; kicked: number; windWoken: number;
  /** the live windows (slots simulated + drawn this frame) per ring, births this frame, records this frame, impulse records this frame, wind records this frame (behind them) */
  live: [number, number]; born: number; records: number; impulses: number; winds: number;
  /** running totals: emitted since boot, emits/s (1 s EMA), records refused (the queue full of records that may not be shed), births lost (stale spark records shed + counts clamped) */
  emitted: number; perSec: number; droppedRecs: number; droppedBirths: number;
  /** impulses: queued since boot, merged into a neighbour / dropped as the weakest under the cap, frames that carried any (the second upload), queued with nothing live to push (skipped), refused (degenerate / non-finite) */
  impQueued: number; impMerged: number; impDropped: number; impFrames: number; impIdle: number; impRefused: number;
}
/** the RAIN ring's numbers (experiment; apart from ParticleStats so every gameplay counter above means what it always meant): its window's live slots, births / records this frame, and what
 *  did not fit — records past the frame's MAX_EMITS after the gameplay records took theirs, births past RAIN_MAX_BIRTHS, records past RAIN_MAX_RECS — all simply not born (rain never waits) */
export interface RainStats { live: number; born: number; records: number; droppedRecs: number; droppedBirths: number; emitted: number; }

const rgba8 = (c: Vec3) => ((Math.round(Math.min(1, Math.max(0, c[0])) * 255)) | (Math.round(Math.min(1, Math.max(0, c[1])) * 255) << 8) | (Math.round(Math.min(1, Math.max(0, c[2])) * 255) << 16) | (255 << 24)) >>> 0;
/** integer hash for the per-emit seed (the GPU hashes it again with the particle index) */
function hashU32(x: number): number { x = (x ^ 61) ^ (x >>> 16); x = (x + (x << 3)) >>> 0; x ^= x >>> 4; x = Math.imul(x, 0x27d4eb2d) >>> 0; x ^= x >>> 15; return x >>> 0; }
/** the three particle texts as bundled (the scene tweak panel lists their constants off them: render/shaderTune.ts shaderConsts). The page's own programs are built from these as they are — the
 *  panel is made after them — and only retune() and a second set built later read them through tuned(). */
export function particleTexts(): { common: string; sim: string; draw: string } { return { common: particlesCommon, sim: particlesSrc, draw: particlesDrawSrc }; }

export class Particles {
  /** live per-kind numbers (the panel edits these; written into the uniform block every frame) */
  params: Record<PKind, KindParams> = { spark: { ...KIND_DEFAULTS.spark }, debris: { ...KIND_DEFAULTS.debris }, dust: { ...KIND_DEFAULTS.dust }, casing: { ...KIND_DEFAULTS.casing }, sheet: { ...KIND_DEFAULTS.sheet }, rain: { ...KIND_DEFAULTS.rain }, shard: { ...KIND_DEFAULTS.shard } };
  /** the three strongest lights at each lit particle get a shadow ray (else every light counts unshadowed — for measuring what the rays cost) */
  shadowRays = true;
  /** glass at rest shows (game/shards.ts SHARDS.restFrost; flags bit 8): a resting shard is drawn as the little drift of grains it stands for — wider, frosted — instead of
   *  one clear face lying flat, which against any floor was nothing. Off = every resting shard as it flies. */
  shardRestFrost = true;
  /** particles collide with the trace grid's boxes at all (off = ballistic through everything, for measuring) */
  collide = true;
  /** SPARKS OFF SURFACES (flags bit 24; shaders/particles.wgsl sparkBounce): a spark that meets a wall, the floor, the ceiling or what stands in the room comes back off it
   *  lively — the spark kind's restitution and keep still set it (× the kernel's SPARK_E_GAIN, keep read as a Coulomb μ), each touch's share and way out hashed — and the
   *  stretch of its birth frame is swept like every later step, so none starts its life behind a partition. Off = a spark's touch and birth as they were. */
  sparkBounce = true;
  /** the splat is dimmed by the volumetric transmittance in front of it (and gets the in-scatter back) */
  fog = true;
  /** the splat runs at all (measurement: off = simulate but draw nothing, to price the draw by frame-time A/B — render-pass timestamps are unreliable on Metal) */
  drawEnabled = true;
  /** live per-kind IMPULSE response (game/sheetModel.ts IMP_RESPONSE; the panel edits these, written into the block's ki rows every frame) */
  impulseResponse: Record<PKind, ImpulseResponse> = { spark: { ...IMP_RESPONSE.spark }, debris: { ...IMP_RESPONSE.debris }, dust: { ...IMP_RESPONSE.dust }, casing: { ...IMP_RESPONSE.casing }, sheet: { ...IMP_RESPONSE.sheet }, rain: { ...IMP_RESPONSE.rain }, shard: { ...SHARD_IMP } };
  /** impulses gate particles further than half a metre by their occlusion ray when the record asks (measurement: off = every record applied unoccluded, to price the rays) */
  impulseOcclusion = true;
  stats: ParticleStats = { alive: 0, asleep: 0, bounces: 0, killedInside: 0, kicked: 0, windWoken: 0, live: [0, 0], born: 0, records: 0, impulses: 0, winds: 0, emitted: 0, perSec: 0, droppedRecs: 0, droppedBirths: 0, impQueued: 0, impMerged: 0, impDropped: 0, impFrames: 0, impIdle: 0, impRefused: 0 };
  /** WIND (game/wind.ts → setWind once a frame): the sources to pack BEHIND this frame's impulses (≤ WIND_GPU_MAX and never more than the impulses leave of MAX_IMPULSES — impulses come
   *  first, a bang is never starved of a slot by a draught), and the three live knobs every wind record carries (particles.wgsl windKnobs) */
  private winds: readonly WindGpuSource[] = []; private windKnobs: [number, number, number] = [0.35, 2.0, 0.15];
  /** births a frame (renderer v3 Phase 0 cap; ui/quality.ts presets 512 / 384 / 256 / 192 / 128 via settings.particleBirths, handed in by prepare()): records that do not fit wait in
   *  the queue for the next frame — chips / dust / brass first, sparks after, oldest first — so six stun charges in one frame become a few frames of births instead of one
   *  6000-thread emit + a flooded window. A single record larger than the cap is still born whole (alone) rather than never. MAX_NEW_PER_FRAME stays the ceiling. */
  maxBirthsPerFrame = MAX_NEW_PER_FRAME;
  /** the most records that have waited at once, and sparks shed stale (stats for the panel / QA) */
  queuePeak = 0; shedSparks = 0;
  /** emits queued since the last prepare() (+ whatever the birth cap carried over) */
  private queue: EmitRec[] = [];
  private serial = 1;
  /** impulses queued since the last prepare(): a fixed pool of MAX_IMPULSES records, `impN` of them live; their own serial (an impulse never shifts an emit's seed) */
  private imps: ImpRec[] = Array.from({ length: MAX_IMPULSES }, () => ({ pos: [0, 0, 0] as Vec3, radius: 0, strength: 0, up: 0, bias: [0, 0, 0] as Vec3, eye: [0, 0, 0] as Vec3, kinds: 0, flags: 0, seed: 0 }));
  private impN = 0; private impSerial = 1;
  /** the rings: monotonic head / tail counters (slot = start + counter % size) and the FIFO of (expiry time, head after the emit) that retires the tail */
  private headMono = [0, 0]; private tailMono = [0, 0]; private fifo: { expire: number; end: number }[][] = [[], []];
  /** the RAIN ring (experiment): its own queue, counters, FIFO and window — nothing of it touches the two above */
  private rainQueue: EmitRec[] = []; private rainHead = 0; private rainTail = 0; private rainFifo: { expire: number; end: number }[] = [];
  private rainWin: [number, number, number, number] = [RAIN_RING.start, RAIN_RING.size, 0, 0]; private rainTailBuf = new ArrayBuffer(BLOCK_TAIL_BYTES); private rainTailU = new Uint32Array(this.rainTailBuf); private rainTailF = new Float32Array(this.rainTailBuf); private rainTailLive = false;
  rainStats: RainStats = { live: 0, born: 0, records: 0, droppedRecs: 0, droppedBirths: 0, emitted: 0 };
  /** the rain kind's LOOK (v2): game/rainFx.ts writes PRAIN into it every frame; packed into the block's tail behind the rain window while the ring holds anything */
  rainLook: RainLook = { ...RAIN_LOOK_DEFAULTS };
  /** what the rain splat refracted through last frame: 'gbaa' = the composite's own copy (GBAA keeps hdrCopy a frame behind: free), 'copy' = an explicit hdr → copy before the splat (GBAA off: ~0.1 ms),
   *  'none' = nothing bound (refraction off, or no copy texture) — the panel's word */
  rainSceneCopy: 'gbaa' | 'copy' | 'none' = 'none';
  private sceneDummy: GPUTexture; private sceneDummyView: GPUTextureView; private sceneSamp: GPUSampler;
  /** SNOW GRAINS (game/snowFx.ts updateGrains; particles.wgsl grainStep): the air they ride — render/airField.ts's field, handed over by whoever built it (null = the
   *  1×1 stand-in: still air) — and their eight numbers, written to the GPU when they change: [0] the wind's speed with no gust on it (m/s: what the pick-up is
   *  measured against), [1] the radius about the view's middle they live in (m), [2] a grain's weight, [3] × the light a flake would show, [4] the small eddies'
   *  share of the air's speed, [5] × the field's lift, [6] × the field's velocity = the blown snow's speed, [7] 1 = there is a field to read. Nothing here is read by shaders built without SNOW_GRAINS. */
  readonly grainCfg = new Float32Array(28); private grainSent = new Float32Array(28).fill(NaN); private grainBuf!: GPUBuffer; private airView: GPUTextureView | null = null;
  setAir(view: GPUTextureView | null) { if (view !== this.airView) { this.airView = view; this.bgSim = null; } }
  private simT = 0; private rateAcc = 0; private rateT = 0;
  /** what prepare() decided for this frame's dispatches / draw */
  private born = 0; private liveTotal = 0; private win: [number, number, number, number][] = [[RINGS[0].start, RINGS[0].size, 0, 0], [RINGS[1].start, RINGS[1].size, 0, 0]];
  // ---- GPU
  readonly pool: GPUBuffer; private emitBuf: GPUBuffer;
  private block = new ArrayBuffer(BLOCK_BYTES); private bf = new Float32Array(this.block); private bu = new Uint32Array(this.block);
  private lSim: GPUBindGroupLayout; private lDraw: GPUBindGroupLayout;
  private pEmit!: GPUComputePipeline; private pUpdate!: GPUComputePipeline; private pDraw!: GPURenderPipeline;
  private simMod: GPUShaderModule; private drawMod: GPUShaderModule; private simLay: GPUPipelineLayout; private drawLay: GPUPipelineLayout;
  private bgSim: GPUBindGroup | null = null; private bgSimDice: GPUTextureView | null = null;
  private bgDraw: GPUBindGroup | null = null; private bgDrawKey: [GPUTextureView | null, GPUTextureView | null, GPUTextureView | null, GPUTextureView | null] = [null, null, null, null];
  private readbacks: GPUBuffer[] = []; private inflight: GPUBuffer[] = []; private frameNo = 0;
  private static readonly ZERO_HDR = new Uint32Array(HDR_BYTES / 4);   // (only its first two words are written per frame)

  constructor(private device: GPUDevice, sceneLayout: GPUBindGroupLayout) {
    const CS = GPUShaderStage.COMPUTE, VS = GPUShaderStage.VERTEX, FS = GPUShaderStage.FRAGMENT;
    this.pool = makeBuffer(device, HDR_BYTES + (P_CAP + RAIN_CAP) * P_BYTES, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 'particles');   // (+ the rain ring's slots past the two gameplay rings)
    this.emitBuf = makeBuffer(device, BLOCK_BYTES, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'particleEmits');
    this.lSim = device.createBindGroupLayout({ label: 'particlesSim', entries: [
      { binding: 0, visibility: CS, buffer: { type: 'storage' } },
      { binding: 1, visibility: CS, buffer: { type: 'uniform' } },
      { binding: 2, visibility: CS, texture: { sampleType: 'float', viewDimension: '3d' } },
      { binding: 3, visibility: CS, texture: { sampleType: 'float', viewDimension: '2d' } },   // SNOW GRAINS: the air field's velocity over the level's floor (render/airField.ts; setAir — the 1×1 stand-in when there is none; read only under the prelude's SNOW_GRAINS)
      { binding: 4, visibility: CS, buffer: { type: 'uniform' } },                             // … and the grains' numbers (grainCfg below)
    ] });
    this.grainBuf = makeBuffer(device, 112, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST, 'particleGrains');
    this.lDraw = device.createBindGroupLayout({ label: 'particlesDraw', entries: [
      { binding: 0, visibility: VS, buffer: { type: 'read-only-storage' } },
      { binding: 1, visibility: VS | FS, buffer: { type: 'uniform' } },
      { binding: 2, visibility: FS, texture: { sampleType: 'depth', viewDimension: '2d' } },
      { binding: 3, visibility: FS, texture: { sampleType: 'unfilterable-float', viewDimension: '2d' } },
      { binding: 4, visibility: FS, texture: { sampleType: 'float', viewDimension: '3d' } },   // the integrated froxel volume (render/froxels.ts; read under FrameFlags.FroxelVol, a dummy otherwise)
      { binding: 5, visibility: FS, texture: { sampleType: 'float', viewDimension: '2d' } },   // PARTICLE RAIN v2: the composite's copy the rain streaks REFRACT (render/passes.ts hdrCopy; a 1×1 black stand-in when there is none — rainCfgC.x is 0 then)
      { binding: 6, visibility: FS, sampler: { type: 'filtering' } },                          // … and its bilinear sampler
    ] });
    this.sceneDummy = device.createTexture({ label: 'particlesSceneDummy', size: [1, 1], format: 'rgba16float', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST });
    this.sceneDummyView = this.sceneDummy.createView();
    this.sceneSamp = device.createSampler({ label: 'particlesSceneSamp', magFilter: 'linear', minFilter: 'linear', addressModeU: 'clamp-to-edge', addressModeV: 'clamp-to-edge' });
    const pre = scenePrelude();
    this.simMod = makeShader(device, pre + lightingCommon + particlesCommon + windFieldSrc + particlesSrc, 'particles');   // (+ the wind field's one text, ahead of the kernels that sum it)
    this.simLay = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lSim] });
    this.drawMod = makeShader(device, pre + particlesCommon + refractCommon + particlesDrawSrc, 'particlesDraw');   // (+ refract_common.wgsl ahead of the splat: the rain streaks' refraction)
    this.drawLay = device.createPipelineLayout({ bindGroupLayouts: [sceneLayout, this.lDraw] });   // (the three pipelines: init(), awaited by main.ts before the first frame)
  }
  /** emit + update + the splat, compiled off the GPU process's main thread (gpu/device.ts) — main.ts awaits it with the rest of the game's GPU init; never called by the headless probes */
  async init(): Promise<void> {
    const device = this.device;
    [this.pEmit, this.pUpdate, this.pDraw] = await Promise.all([
      computePipelineAsync(device, { label: 'particlesEmit', layout: this.simLay, compute: { module: this.simMod, entryPoint: 'emit' } }),
      computePipelineAsync(device, { label: 'particlesUpdate', layout: this.simLay, compute: { module: this.simMod, entryPoint: 'update' } }),
      renderPipelineAsync(device, { label: 'particlesDraw', layout: this.drawLay,
        vertex: { module: this.drawMod, entryPoint: 'vs' },
        fragment: { module: this.drawMod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: {
          color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },   // premultiplied: a spark writes alpha 0 (pure add), a chip its coverage
          alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } } },             // (the HDR target's own alpha stays what the composite wrote)
          { format: 'r8unorm', blend: { color: { srcFactor: 'one', dstFactor: 'one', operation: 'max' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'max' } }, writeMask: GPUColorWrite.RED }] },   // the REACTIVE mask for the TAAU resolve (render/passes.ts react): how much of this pixel is a thing with no history — max over everything splatted here
        primitive: { topology: 'triangle-list' } }) ]);
    cutSwap.add(this);
  }
  // ---- CUT BOXES — a calm room pays nothing (render/cutSwap.ts): the two sim kernels (the ones that trace) a second time, behind the cut prelude
  private cutSet = new ProgramSet();
  private retuning: Promise<unknown> = Promise.resolve();   // (retune(): one at a time, in the order asked)
  private cutBuilding: Promise<void> = Promise.resolve();   // (the second set under way: a retune waits for it, so the twins it leaves are never older than the tweak)
  private tunedAs = particlesCommon + particlesSrc + particlesDrawSrc;   // the texts the installed programs were built from (retune skips a text that already runs)
  buildCut(): Promise<void> { const run = this.buildCutNow(); this.cutBuilding = run.catch(() => { /* its caller has it */ }); return run; }
  private async buildCutNow(): Promise<void> {
    const d = this.device; const mod = makeShader(d, scenePrelude(true) + lightingCommon + tuned(particlesCommon) + windFieldSrc + tuned(particlesSrc), 'particlesCut');
    const [pEmit, pUpdate] = await Promise.all([
      computePipelineAsync(d, { label: 'particlesEmitCut', layout: this.simLay, compute: { module: mod, entryPoint: 'emit' } }),
      computePipelineAsync(d, { label: 'particlesUpdateCut', layout: this.simLay, compute: { module: mod, entryPoint: 'update' } }) ]);
    this.cutSet.set(this, { pEmit, pUpdate });
  }
  useCut(on: boolean) { this.cutSet.use(this, on); }
  /** Dev / measurement hook (tools/qa/trace-lab.js via main.ts __hotCommon): rebuild the two SIM kernels (emit + update — the ones that trace) from the CURRENT scene prelude + the bundled
   *  particle sources exactly as the constructor concatenates them, so a traversal variant under test reaches the particles' collision / lighting rays too. The splat is untouched. Both or
   *  neither: the old pipelines stay on an error. */
  async hotSwapSim(): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const d = this.device; const pre = scenePrelude() + lightingCommon + particlesCommon + windFieldSrc; const off = pre.split('\n').length - 1;
    const mod = d.createShaderModule({ code: pre + particlesSrc, label: 'particles-hot' });
    const info = await mod.getCompilationInfo();
    const messages = info.messages.map(m => `${m.type} ${m.lineNum - off}:${m.linePos} ${m.message}`);
    if (info.messages.some(m => m.type === 'error')) return { ok: false, messages };
    [this.pEmit, this.pUpdate] = await Promise.all([
      d.createComputePipelineAsync({ label: 'particlesEmit-hot', layout: this.simLay, compute: { module: mod, entryPoint: 'emit' } }),
      d.createComputePipelineAsync({ label: 'particlesUpdate-hot', layout: this.simLay, compute: { module: mod, entryPoint: 'update' } }) ]);
    this.simMod = mod;
    return { ok: true, messages };
  }
  /** Dev hook (main.ts __hotRain): rebuild ALL THREE pipelines from particle sources handed in (particles_common / particles / particles_draw as they are on disk) with the live preludes —
   *  the rain look's kernels and splat swapped under a staged storm without a reboot. All or nothing: the old pipelines stay on any error. */
  async hotSwapAll(commonSrc: string, simSrc: string, drawSrc: string, refractSrc: string = refractCommon): Promise<{ ok: boolean; messages: string[] }> {
    cutSwap.hot();   // (CUT BOXES: a hot program has no cut rule — the boot set is pinned from here, render/cutSwap.ts)
    const d = this.device; const preS = scenePrelude() + lightingCommon + commonSrc + windFieldSrc; const preD = scenePrelude() + commonSrc + refractSrc;
    const offS = preS.split('\n').length - 1, offD = preD.split('\n').length - 1;
    const modS = d.createShaderModule({ code: preS + simSrc, label: 'particles-hot' }); const modD = d.createShaderModule({ code: preD + drawSrc, label: 'particlesDraw-hot' });
    const [iS, iD] = await Promise.all([modS.getCompilationInfo(), modD.getCompilationInfo()]);
    const messages = [...iS.messages.map(m => `sim ${m.type} ${m.lineNum - offS}:${m.linePos} ${m.message}`), ...iD.messages.map(m => `draw ${m.type} ${m.lineNum - offD}:${m.linePos} ${m.message}`)];
    if (iS.messages.some(m => m.type === 'error') || iD.messages.some(m => m.type === 'error')) return { ok: false, messages };
    const [pE, pU, pD] = await Promise.all([
      d.createComputePipelineAsync({ label: 'particlesEmit-hot', layout: this.simLay, compute: { module: modS, entryPoint: 'emit' } }),
      d.createComputePipelineAsync({ label: 'particlesUpdate-hot', layout: this.simLay, compute: { module: modS, entryPoint: 'update' } }),
      d.createRenderPipelineAsync(this.drawDesc(modD, 'particlesDraw-hot')) ]);
    this.pEmit = pE; this.pUpdate = pU; this.pDraw = pD; this.simMod = modS; this.drawMod = modD;
    return { ok: true, messages };
  }
  /** the splat's descriptor over a rebuilt module (hotSwapAll, retune): init()'s targets and blends */
  private drawDesc(mod: GPUShaderModule, label: string): GPURenderPipelineDescriptor {
    return { label, layout: this.drawLay, vertex: { module: mod, entryPoint: 'vs' },
      fragment: { module: mod, entryPoint: 'fs', targets: [{ format: 'rgba16float', blend: { color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' }, alpha: { srcFactor: 'zero', dstFactor: 'one', operation: 'add' } } },
        { format: 'r8unorm', blend: { color: { srcFactor: 'one', dstFactor: 'one', operation: 'max' }, alpha: { srcFactor: 'one', dstFactor: 'one', operation: 'max' } }, writeMask: GPUColorWrite.RED }] }, primitive: { topology: 'triangle-list' } };
  }
  /** SCENE TWEAK PANEL (ui/sceneTweak.ts over render/shaderTune.ts): rebuild all three pipelines from the bundled texts as SHADER_TUNE has them now, with the live preludes, and the
   *  cut twins of the two sim kernels where the second set exists — written into BOTH sets (no cutSwap.hot(): cut pieces stay cut). All or nothing: the old pipelines stay on any
   *  error. One at a time, in the order asked, so the newest text is the one left installed. */
  retune(): Promise<{ ok: boolean; messages: string[] }> {
    const run = Promise.all([this.retuning, this.cutBuilding]).then(() => this.retuneNow());
    this.retuning = run.catch(() => { /* its caller has it */ });
    return run;
  }
  private async retuneNow(): Promise<{ ok: boolean; messages: string[] }> {
    const d = this.device, common = tuned(particlesCommon), hasCut = !!this.cutSet.cut;
    const preS = scenePrelude() + lightingCommon + common + windFieldSrc, preC = scenePrelude(true) + lightingCommon + common + windFieldSrc, preD = scenePrelude() + common + refractCommon;
    const sim = tuned(particlesSrc), draw = tuned(particlesDrawSrc), as = common + sim + draw;
    if (as === this.tunedAs) return { ok: true, messages: [] };
    const mods = [{ tag: 'sim', mod: d.createShaderModule({ code: preS + sim, label: 'particles' }), off: preS.split('\n').length - 1 }, { tag: 'draw', mod: d.createShaderModule({ code: preD + draw, label: 'particlesDraw' }), off: preD.split('\n').length - 1 }];
    if (hasCut) mods.push({ tag: 'sim (cut)', mod: d.createShaderModule({ code: preC + sim, label: 'particlesCut' }), off: preC.split('\n').length - 1 });
    const infos = await Promise.all(mods.map(m => m.mod.getCompilationInfo()));
    const messages = infos.flatMap((info, i) => info.messages.map(m => `${mods[i].tag} ${m.type} ${m.lineNum - mods[i].off}:${m.linePos} ${m.message}`));
    if (infos.some(info => info.messages.some(m => m.type === 'error'))) return { ok: false, messages };
    const modS = mods[0].mod, modD = mods[1].mod, modC = hasCut ? mods[2].mod : null;
    const cp = (mod: GPUShaderModule, entryPoint: string, label: string) => d.createComputePipelineAsync({ label, layout: this.simLay, compute: { module: mod, entryPoint } });
    try {
      const [pEmit, pUpdate, pDraw, twins] = await Promise.all([cp(modS, 'emit', 'particlesEmit'), cp(modS, 'update', 'particlesUpdate'), d.createRenderPipelineAsync(this.drawDesc(modD, 'particlesDraw')),
        modC ? Promise.all([cp(modC, 'emit', 'particlesEmitCut'), cp(modC, 'update', 'particlesUpdateCut')]) : null]);
      this.cutSet.patch(this, { pEmit, pUpdate, pDraw }, twins ? { pEmit: twins[0], pUpdate: twins[1] } : null);
    } catch (e) { return { ok: false, messages: [...messages, `pipeline: ${(e as Error)?.message ?? e}`] }; }
    this.simMod = modS; this.drawMod = modD; this.tunedAs = as;
    return { ok: true, messages };
  }

  // ------------------------------------------------------------------ emit API (game code; deterministic — the seed counts off this object's own serial)
  /** WHAT IS FILED NOW IS THE TEAM'S OWN DOING (game/fogofwar.ts FOG.ours, set round an effect by FogOfWar.begin / done): the record's bit 18 → PB_OURS on each
   *  particle born of it, which the draw does not cut over floor the fog of war hides (particles_draw.wgsl). Never read by the simulation */
  ours = false;
  /** Queue `count` particles of `kind` at `pos` about `dir` with the numbers in `o` for the next frame (or a later one, if the frame's birth cap is spent). Returns how many
   *  were accepted: `count` (clamped to MAX_NEW_PER_FRAME, the excess counted in droppedBirths), or 0 when the queue is full of records that may not be shed. */
  emit(kind: PKind, pos: Vec3, dir: Vec3, count: number, o: EmitOpts): number {
    count = Math.max(0, Math.floor(count)); if (count === 0) return 0;
    if (kind === 'rain') {   // the rain ring's own small queue (experiment): never in `queue`, never counted in the gameplay stats, its seed handed in by the recycler (else off the serial like anything)
      if (this.rainQueue.length >= RAIN_MAX_RECS) { this.rainStats.droppedRecs++; this.rainStats.droppedBirths += count; return 0; }
      count = Math.min(count, RAIN_MAX_BIRTHS);
      this.rainQueue.push({ kind, pos: [pos[0], pos[1], pos[2]], dir: [dir[0], dir[1], dir[2]], count, o, seed: (o.seed ?? hashU32(this.serial++ * 2654435761)) >>> 0, waited: 0 });
      return count;
    }
    if (count > MAX_NEW_PER_FRAME) { this.stats.droppedBirths += count - MAX_NEW_PER_FRAME; count = MAX_NEW_PER_FRAME; }   // (nothing emits a fraction of this; a record bigger than a whole frame could never be born)
    if (this.queue.length >= MAX_QUEUE) {   // full: shed the oldest waiting SPARK record to make room; if none is a spark, refuse this one (never evict chips / dust / brass)
      const si = this.queue.findIndex(r => r.kind === 'spark');
      if (si >= 0) { this.stats.droppedBirths += this.queue[si].count; this.shedSparks += this.queue[si].count; this.queue.splice(si, 1); }
      else { this.stats.droppedRecs++; return 0; }
    }
    this.queue.push({ kind, pos: [pos[0], pos[1], pos[2]], dir: [dir[0], dir[1], dir[2]], count, o, seed: (o.seed ?? hashU32(this.serial++ * 2654435761)) >>> 0, waited: 0, ours: this.ours });
    return count;
  }
  /** Queue an IMPULSE for the next frame: every live particle of `o.kinds` (default all but sparks) within `radius` of `pos` gets Δv = strength × its kind's gain ×
   *  (1 − d/radius) along (radial + o.up·ŷ + o.bias), and resting ones kicked hard enough WAKE (game/sheetModel.ts is the reference; particles.wgsl applyImpulses
   *  flies it). Bounded: at most MAX_IMPULSES a frame — past that this one is merged into the nearest queued within IMPULSE_MERGE_M (strengths summed up to
   *  IMPULSE_MERGE_CAP × the stronger, the wider radius, both kind sets, either one's occlusion, the stronger one's centre) or, none being near, the weakest of
   *  the seventeen is dropped. Deterministic (the seed counts off the impulses' own serial); allocates nothing. Returns false only for a degenerate record
   *  (radius / strength ≤ 0, anything non-finite — one NaN record would poison every particle in its reach). */
  impulse(pos: Vec3, radius: number, strength: number, o: ImpulseOpts = NO_OPTS): boolean {
    const b = o.bias ?? ZERO3, e = o.eye ?? pos, up = o.up ?? 0;
    if (!(radius > 0) || !(strength > 0) || !isFinite(radius + strength + pos[0] + pos[1] + pos[2] + b[0] + b[1] + b[2] + e[0] + e[1] + e[2] + up)) { this.stats.impRefused++; return false; }
    this.stats.impQueued++;
    const kinds = o.kinds ? kindMask(o.kinds) : KINDS_DEFAULT; const flags = o.occlude ? 1 : 0; const seed = o.seed !== undefined ? o.seed >>> 0 : hashU32(this.impSerial++ * 2246822519);
    if (this.impN < MAX_IMPULSES) { this.setImp(this.imps[this.impN++], pos, radius, strength, up, b, e, kinds, flags, seed); return true; }
    // full: merge into the nearest close enough, else drop the weakest (this one included) — the array never grows
    let ni = -1, nd = IMPULSE_MERGE_M;
    for (let i = 0; i < this.impN; i++) { const r = this.imps[i]; const d = Math.hypot(r.pos[0] - pos[0], r.pos[1] - pos[1], r.pos[2] - pos[2]); if (d < nd) { nd = d; ni = i; } }
    if (ni >= 0) {
      const r = this.imps[ni]; this.stats.impMerged++;
      const hi = Math.max(r.strength, strength); const sum = Math.min(r.strength + strength, hi * IMPULSE_MERGE_CAP); const rad = Math.max(r.radius, radius); const ks = r.kinds | kinds; const fl = r.flags | flags;
      const gatedEye: Vec3 | null = (flags & 1) && !(r.flags & 1) ? e : (r.flags & 1) && !(flags & 1) ? r.eye : null;   // (one gated, one not: the merged record gates from the GATED one's eye — an ungated record's eye is its own centre, a hand off the floor)
      if (strength > r.strength) this.setImp(r, pos, radius, strength, up, b, e, kinds, flags, seed);   // (the stronger one's centre, seed and shape carry the pair)
      r.strength = sum; r.radius = rad; r.kinds = ks; r.flags = fl; if (gatedEye && gatedEye !== r.eye) { r.eye[0] = gatedEye[0]; r.eye[1] = gatedEye[1]; r.eye[2] = gatedEye[2]; }
      return true;
    }
    let wi = -1, ws = strength * radius;   // (weakest by strength × reach; the newcomer is the one to beat)
    for (let i = 0; i < this.impN; i++) { const r = this.imps[i]; const s = r.strength * r.radius; if (s < ws) { ws = s; wi = i; } }
    this.stats.impDropped++;
    if (wi >= 0) this.setImp(this.imps[wi], pos, radius, strength, up, b, e, kinds, flags, seed);
    return true;
  }
  private setImp(r: ImpRec, pos: Vec3, radius: number, strength: number, up: number, b: Vec3, e: Vec3, kinds: number, flags: number, seed: number) {
    r.pos[0] = pos[0]; r.pos[1] = pos[1]; r.pos[2] = pos[2]; r.radius = radius; r.strength = strength; r.up = up;
    r.bias[0] = b[0]; r.bias[1] = b[1]; r.bias[2] = b[2]; r.eye[0] = e[0]; r.eye[1] = e[1]; r.eye[2] = e[2]; r.kinds = kinds; r.flags = flags; r.seed = seed;
  }
  /** This frame's WIND (game/wind.ts, once a frame at the end of Game.update): the sources whose air the update kernel measures every live particle's drag against — kept by
   *  reference until the next call, packed at prepare() behind the impulses; an empty list = still air (nothing packed, nothing uploaded, the kernel's one branch). `knobs` =
   *  (sheet wake m/s, sheet kick ×, debris coupling), riding on every record. Allocates nothing; never wakes or moves anything by itself. */
  setWind(srcs: readonly WindGpuSource[], knobs: readonly [number, number, number]) { this.winds = srcs; this.windKnobs[0] = knobs[0]; this.windKnobs[1] = knobs[1]; this.windKnobs[2] = knobs[2]; }
  /** everything gone at once (encounter restart): the windows empty — nothing is simulated or drawn until fresh emits refill them (the slots' stale contents are never read: a window only ever grows over slots just written) */
  clear() { this.queue.length = 0; this.impN = 0; for (let r = 0; r < 2; r++) { this.tailMono[r] = this.headMono[r]; this.fifo[r].length = 0; } this.liveTotal = 0; this.born = 0; this.clearRain(); }
  /** the rain ring alone gone (the recycler switching off / the weather stopping): its window empties, its queue drops */
  clearRain() { this.rainQueue.length = 0; this.rainTail = this.rainHead; this.rainFifo.length = 0; this.rainWin[2] = this.rainTail % RAIN_RING.size; this.rainWin[3] = 0; this.rainStats.live = 0; }
  /** emits waiting for the next prepare() (QA reads it) */
  get pending(): readonly { kind: PKind; pos: Vec3; dir: Vec3; count: number; o: EmitOpts; seed: number }[] { return this.queue; }
  /** impulses waiting for the next prepare() (QA / the panel: live records of the fixed pool — read, do not keep) */
  get pendingImpulses(): readonly Readonly<ImpRec>[] { return this.imps.slice(0, this.impN); }
  get pendingImpulseCount(): number { return this.impN; }
  /** slots the next frame will simulate + draw, per ring (QA / the panel) */
  get windows(): readonly [number, number, number, number][] { return this.win; }
  get liveSlots(): number { return this.liveTotal; }
  get bornThisFrame(): number { return this.born; }

  // ------------------------------------------------------------------ per frame
  /** Deal this frame's emits their ring slots, retire expired tails, pack the uniform block and upload it (+ zero the pool's counters). `on` false = the setting is
   *  off: the queue is dropped and nothing is live. Call before encodeUpdate / encodeDraw. */
  prepare(dt: number, on: boolean, birthCap = this.maxBirthsPerFrame) {
    this.simT += dt;
    if (!on) { this.clear(); this.win[0][3] = 0; this.win[1][3] = 0; this.stats.live = [0, 0]; this.stats.born = 0; this.stats.records = 0; this.stats.impulses = 0; this.stats.alive = 0; this.stats.asleep = 0; return; }   // off = today's CPU sparks: nothing of this is live, and nothing stale comes back when it is switched on again
    const f = this.bf, u = this.bu;
    // records: slots dealt in ring order, `first` = running birth index. The frame's births are capped (birthCap, ≤ MAX_NEW_PER_FRAME) and so are its records (MAX_EMITS):
    // what does not fit WAITS for the next frame in queue order — the long-lived kinds (chips, dust, brass) are dealt before sparks so a spark storm never delays a
    // case — and a spark record that has waited SPARK_MAX_WAIT frames is shed. A record bigger than the whole cap is born alone rather than never.
    this.maxBirthsPerFrame = birthCap;
    const cap = Math.max(1, Math.min(MAX_NEW_PER_FRAME, Math.floor(birthCap)));
    let born = 0, n = 0;
    const waiting: EmitRec[] = [];
    this.queuePeak = Math.max(this.queuePeak, this.queue.length);
    let want = 0; for (const e of this.queue) want += e.count;
    const fits = this.queue.length <= MAX_EMITS && want <= cap;   // the common frame: everything goes, in arrival order, exactly as it always did — the priority order only decides who WAITS
    const order = fits || !this.queue.some(r => r.kind === 'spark') || !this.queue.some(r => r.kind !== 'spark') ? this.queue : [...this.queue.filter(r => r.kind !== 'spark'), ...this.queue.filter(r => r.kind === 'spark')];
    let rescue = !fits;   // once a frame, the first spark record met that has already waited 2+ frames goes even past the cap (never past the ceiling): behind steady chip / dust / brass traffic a stun charge's 160 fragments would otherwise never find `born == 0` on the cheap tiers and be shed whole
    for (const e of order) {
      const over = n >= MAX_EMITS || (born + e.count > cap && born > 0) || born + e.count > MAX_NEW_PER_FRAME;
      if (over && rescue && e.kind === 'spark' && e.waited >= 2 && n < MAX_EMITS && born + e.count <= MAX_NEW_PER_FRAME) rescue = false;   // (falls through: dealt now)
      else if (over) {   // does not fit this frame: wait (or, a stale spark, go)
        if (e.kind === 'spark' && ++e.waited > SPARK_MAX_WAIT) { this.stats.droppedBirths += e.count; this.shedSparks += e.count; } else waiting.push(e);
        continue;
      }
      const ring = KIND_RING[e.kind]; const R = RINGS[ring];
      const base = this.headMono[ring] % R.size; this.headMono[ring] += e.count;
      const o = e.o; const lifeMax = o.life * (1 + (o.lifeJit ?? 0.35)) + dt + 0.1;
      this.fifo[ring].push({ expire: this.simT + lifeMax, end: this.headMono[ring] });
      const b = (BLOCK_HDR_BYTES + n * REC_BYTES) / 4;
      f[b] = e.pos[0]; f[b + 1] = e.pos[1]; f[b + 2] = e.pos[2]; u[b + 3] = e.count;
      f[b + 4] = e.dir[0]; f[b + 5] = e.dir[1]; f[b + 6] = e.dir[2]; f[b + 7] = o.speed;
      const shardAsChip = e.kind === 'shard' && !glassBreakConfig.on;   // a build compiled without glass breaking has no shard branches (SHARDS_ON false): its glass flies and draws as a tinted chip (same LONG ring)
      f[b + 8] = e.kind === 'sheet' || (e.kind === 'shard' && !shardAsChip) ? (o.tumble ?? 6) : (o.radius ?? 0); f[b + 9] = o.aspect ?? 1; f[b + 10] = o.nrmJit ?? 0.35; u[b + 11] = born;   // posB: ring radius | the sheet's tumble cap, aspect (1 = every old emit exactly as it was), the sheet's normal scatter
      const va = o.vadd ?? [0, 0, 0]; f[b + 12] = va[0]; f[b + 13] = va[1]; f[b + 14] = va[2]; u[b + 15] = SHAPE_ID[o.shape ?? 'cone'];
      f[b + 16] = o.spread ?? 0.5; f[b + 17] = o.life; f[b + 18] = o.size; f[b + 19] = o.speedJit ?? 0.55;
      f[b + 20] = o.lifeJit ?? 0.35; f[b + 21] = o.lift ?? 0; f[b + 22] = o.sizeJit ?? 0.3; f[b + 23] = o.posJit ?? 0;
      u[b + 24] = ((shardAsChip ? KIND_ID.debris : KIND_ID[e.kind]) | (((o.owner ?? 0) & 255) << 8) | (ring << 16) | (e.ours ? 1 << 18 : 0)) >>> 0; u[b + 25] = e.seed >>> 0; u[b + 26] = base >>> 0; u[b + 27] = rgba8(o.color ?? [0.5, 0.5, 0.5]);
      if (e.kind === 'spark' && o.ember !== undefined) u[b + 27] = ((u[b + 27] & 0xffffff) | (Math.round(Math.min(1, Math.max(0, o.ember)) * 254) << 24)) >>> 0;   // (EMBER: the same byte on a spark — EmitOpts.ember)
      if (e.kind === 'dust' && o.steam !== undefined) u[b + 27] = ((u[b + 27] & 0xffffff) | (Math.round(Math.min(1, Math.max(0, o.steam)) * 254) << 24)) >>> 0;   // (STEAM: the top byte under 255 — EmitOpts.steam)
      born += e.count; n++; this.stats.emitted += e.count; this.rateAcc += e.count;
    }
    this.queue = waiting;   // (non-sparks first, then sparks, each in arrival order — what the next frame deals from)
    // ---- the RAIN ring (experiment, game/rainFx.ts): dealt strictly AFTER the gameplay records above, into whatever record slots the frame has left, from its own birth budget
    // (RAIN_MAX_BIRTHS) and its own ring — so a downpour can neither delay a case / a chip / a stun charge's fragments (they never see it) nor be delayed by them: what
    // does not fit this frame is not born (a drop born a frame late is only a drop fewer). Its `first` indices continue the frame's birth numbering (one emit dispatch).
    let rainBorn = 0, rainRecs = 0;
    for (const e of this.rainQueue) {
      const room = Math.min(RAIN_MAX_BIRTHS - rainBorn, MAX_NEW_PER_FRAME + RAIN_MAX_BIRTHS - born);
      const cnt = Math.min(e.count, room);
      if (n >= MAX_EMITS || cnt <= 0) { this.rainStats.droppedRecs++; this.rainStats.droppedBirths += e.count; continue; }
      if (cnt < e.count) this.rainStats.droppedBirths += e.count - cnt;
      const base = this.rainHead % RAIN_RING.size; this.rainHead += cnt;
      const o = e.o; const lifeMax = o.life * (1 + (o.lifeJit ?? 0.35)) + dt + 0.1;
      this.rainFifo.push({ expire: this.simT + lifeMax, end: this.rainHead });
      // (the record's words = the statements in the loop above, ring 2 — keep the two in step)
      const b = (BLOCK_HDR_BYTES + n * REC_BYTES) / 4;
      f[b] = e.pos[0]; f[b + 1] = e.pos[1]; f[b + 2] = e.pos[2]; u[b + 3] = cnt;
      f[b + 4] = e.dir[0]; f[b + 5] = e.dir[1]; f[b + 6] = e.dir[2]; f[b + 7] = o.speed;
      f[b + 8] = o.radius ?? 0; f[b + 9] = o.aspect ?? 1; f[b + 10] = o.nrmJit ?? 0.35; u[b + 11] = born;
      const va = o.vadd ?? [0, 0, 0]; f[b + 12] = va[0]; f[b + 13] = va[1]; f[b + 14] = va[2]; u[b + 15] = SHAPE_ID[o.shape ?? 'cone'];
      f[b + 16] = o.spread ?? 0.5; f[b + 17] = o.life; f[b + 18] = o.size; f[b + 19] = o.speedJit ?? 0.55;
      f[b + 20] = o.lifeJit ?? 0.35; f[b + 21] = o.lift ?? 0; f[b + 22] = o.sizeJit ?? 0.3; f[b + 23] = o.posJit ?? 0;
      u[b + 24] = (KIND_ID[e.kind] | (((o.owner ?? 0) & 255) << 8) | (2 << 16)) >>> 0; u[b + 25] = e.seed >>> 0; u[b + 26] = base >>> 0; u[b + 27] = rgba8(o.color ?? [0.5, 0.5, 0.5]);
      if (o.top !== undefined) u[b + 27] = ((u[b + 27] & 0xffffff) | ((Math.round(o.top) & 255) << 24)) >>> 0;   // (a rain-kind record's own top byte — EmitOpts.top: how a wisp of snow is drawn)
      born += cnt; rainBorn += cnt; n++; rainRecs++; this.rainStats.emitted += cnt;
    }
    this.rainQueue.length = 0;
    // windows: retire tails whose every particle has outlived its longest possible life; a head that lapped its ring has overwritten the oldest (oldest-die)
    let live = 0;
    for (let r = 0; r < 2; r++) {
      const q = this.fifo[r]; while (q.length && q[0].expire <= this.simT) this.tailMono[r] = Math.max(this.tailMono[r], q.shift()!.end);
      const size = RINGS[r].size;
      if (this.headMono[r] - this.tailMono[r] > size) this.tailMono[r] = this.headMono[r] - size;
      const lv = this.headMono[r] - this.tailMono[r];
      this.win[r][0] = RINGS[r].start; this.win[r][1] = size; this.win[r][2] = this.tailMono[r] % size; this.win[r][3] = lv; live += lv;
    }
    { // … and the rain ring's, the same way, into the block's TAIL window (written below with its own small upload: the header and the records stay where they were)
      const q = this.rainFifo; while (q.length && q[0].expire <= this.simT) this.rainTail = Math.max(this.rainTail, q.shift()!.end);
      if (this.rainHead - this.rainTail > RAIN_RING.size) this.rainTail = this.rainHead - RAIN_RING.size;
      const lv = this.rainHead - this.rainTail;
      this.rainWin[0] = RAIN_RING.start; this.rainWin[1] = RAIN_RING.size; this.rainWin[2] = this.rainTail % RAIN_RING.size; this.rainWin[3] = lv; live += lv;
      this.rainStats.live = lv; this.rainStats.born = rainBorn; this.rainStats.records = rainRecs;
      if (lv > 0 || rainBorn > 0 || this.rainTailLive) {   // (only while the ring holds anything, and once more to say it emptied — an engine that never rains never writes it: the tail reads zero = live 0)
        const tu = this.rainTailU, tf = this.rainTailF, L = this.rainLook;
        tu[0] = this.rainWin[0]; tu[1] = this.rainWin[1]; tu[2] = this.rainWin[2]; tu[3] = lv;
        tf[4] = L.iso; tf[5] = L.fwdK; tf[6] = L.fwdG; tf[7] = L.glintK;                                            // rainCfg  (the phase + the glint's weight)
        tf[8] = L.glintRough; tf[9] = L.glintCap; tf[10] = L.gain; tf[11] = L.tailKeep;                              // rainCfgB (the glint's width / cap, the gain, the tail's share)
        tf[12] = this.rainSceneCopy === 'none' ? 0 : Math.min(1, Math.max(0, L.refract)) + 2 * Math.round(100 * Math.min(1, Math.max(0, L.refractPaint))); tf[13] = L.refractReachM; tf[14] = L.refractClamp; tf[15] = L.refractDepth;   // rainCfgC (refraction: 0 with nothing to sample, + 2 × the paint a displaced read keeps in hundredths; the probe's reach m; the fetch's luminance clamp; the depth guard m)
        tf[16] = L.lenJit; tf[17] = L.brightJit; tf[18] = L.minPx + Math.min(4, Math.max(2, Math.round(L.refractTaps))) * 16; tf[19] = L.windK;      // rainCfgD (spread, the px floor + taps × 16, the wind's ×) …
        tf[20] = L.sheetAmp; tf[21] = Math.max(0.5, L.sheetLen); tf[22] = L.bandOffX; tf[23] = L.bandOffZ;          // rainCfgE (… and the sheets: amplitude, scale, running offset xz)
        tf[24] = Math.max(L.maxPx, L.minPx); tf[25] = Math.max(1, L.boostCap); tf[26] = Math.max(0.2, L.nearFadeM); tf[27] = L.beadAmp;   // rainCfgF (the width ceiling px, its brightness ×-cap, the near fade's reach, the beads' amplitude)
        this.device.queue.writeBuffer(this.emitBuf, BLOCK_TAIL_AT, this.rainTailBuf);
        this.rainTailLive = lv > 0 || rainBorn > 0;
      }
    }
    this.born = born; this.liveTotal = live;
    // impulses: packed into the block's tail and uploaded on their own — only on a frame that carries any AND has something live to push (a charge in an empty room
    // costs the GPU nothing); the count rides in flags bits 8‥12, so a frame without impulses uploads and dispatches exactly what it always did
    let ni = 0, nw = 0;
    if (this.impN > 0) {
      if (live > 0) {
        ni = this.impN; const occ = this.impulseOcclusion ? 1 : 0;
        for (let i = 0; i < ni; i++) {
          const r = this.imps[i]; const b = (IMP_OFFSET + i * IMP_BYTES) / 4;
          f[b] = r.pos[0]; f[b + 1] = r.pos[1]; f[b + 2] = r.pos[2]; f[b + 3] = r.radius;
          f[b + 4] = r.bias[0]; f[b + 5] = r.bias[1]; f[b + 6] = r.bias[2]; f[b + 7] = r.strength;
          f[b + 8] = r.eye[0]; f[b + 9] = r.eye[1]; f[b + 10] = r.eye[2]; f[b + 11] = r.up;
          u[b + 12] = r.kinds >>> 0; u[b + 13] = r.seed >>> 0; u[b + 14] = (r.flags & occ) >>> 0; u[b + 15] = 0;
        }
        this.stats.impFrames++;
      } else this.stats.impIdle += this.impN;
      this.impN = 0;
    }
    // WIND records BEHIND them (game/wind.ts → setWind): as many of this frame's sources as the impulses leave room for, up to WIND_GPU_MAX, only with something live to
    // move; the count in flags bits 16‥20; the three knobs on every record as two f16 pairs (particles_common.wgsl; the fourth half is spare). One tail upload covers impulses + winds.
    if (live > 0 && this.winds.length) {
      const room = Math.min(WIND_GPU_MAX, MAX_IMPULSES - ni); const kn = this.windKnobs;
      const kA = f16pair(kn[0], kn[1]), kB = f16pair(kn[2], 0);
      for (const s of this.winds) {
        if (nw >= room) break;
        if (!(s.speed > 0)) continue;
        const b = (IMP_OFFSET + (ni + nw) * IMP_BYTES) / 4;
        if (s.kind === 'storm') {
          // (ROOF BY ROOF, game/wind.ts WX_OWN.wind: the record's two rectangles are the level's first two roofs and iflags bit 5 sends the kernel to the Frame for the
          // other two — frame.cardCfg.y / .z, where the rain's own test reads them (game/weather.ts writes the wind's roofs and the Frame's from one list); bit 4 = the
          // rule is on at all: the wisps read the field. Neither bit: the record as it always was)
          const R = s.roofs; const I = R ? R[0] : s.interior ?? [0, 0, 0, 0], A = R ? R[1] ?? [0, 0, 0, 0] : s.annex ?? [0, 0, 0, 0];
          f[b] = I[0]; f[b + 1] = I[1]; f[b + 2] = I[2]; f[b + 3] = I[3];
          f[b + 4] = s.dir[0]; f[b + 5] = s.dir[1]; f[b + 6] = s.dir[2]; f[b + 7] = s.speed;
          f[b + 8] = A[0]; f[b + 9] = A[1]; f[b + 10] = A[2]; f[b + 11] = A[3];
          u[b + 14] = 2 | (1 << 2) | (s.field ? 16 : 0) | (R ? 32 : 0);
        } else {
          f[b] = s.pos[0]; f[b + 1] = s.pos[1]; f[b + 2] = s.pos[2]; f[b + 3] = s.reach;
          f[b + 4] = s.dir[0]; f[b + 5] = s.dir[1]; f[b + 6] = s.dir[2]; f[b + 7] = s.speed;
          f[b + 8] = s.tanSpread; f[b + 9] = s.r0; f[b + 10] = s.dMax; f[b + 11] = s.floorY ?? -1e9;
          u[b + 14] = 2;
        }
        u[b + 12] = (s.kinds ?? WIND_KINDS_DEFAULT) >>> 0; u[b + 13] = kA; u[b + 15] = kB;
        nw++;
      }
    }
    if (ni + nw > 0) this.device.queue.writeBuffer(this.emitBuf, IMP_OFFSET, this.block, IMP_OFFSET, (ni + nw) * IMP_BYTES);
    // header: counts, seed, flags (+ the impulse and wind counts), windows, per-kind numbers, per-kind impulse response
    u[0] = n; u[1] = born; u[2] = hashU32(this.frameNo + 7) ; u[3] = (this.shadowRays ? 1 : 0) | (this.collide ? 2 : 0) | (this.fog ? 4 : 0) | (this.shardRestFrost ? 8 : 0) | (ni << 8) | (nw << 16) | (this.sparkBounce ? 0x1000000 : 0);
    for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) u[4 + r * 4 + k] = this.win[r][k] >>> 0;
    P_KINDS.forEach((k, i) => { const p = this.params[k]; const o = KP_FLOAT + i * 8; f[o] = p.gravity; f[o + 1] = p.drag; f[o + 2] = p.restitution; f[o + 3] = p.keep; f[o + 4] = p.sleepV; f[o + 5] = p.holdOrFade; f[o + 6] = p.shutterOrGrowth; f[o + 7] = p.brightOrOpacity;
      const q = this.impulseResponse[k]; const oi = KI_FLOAT + i * 4; f[oi] = q.gain; f[oi + 1] = q.upK; f[oi + 2] = q.vMax; f[oi + 3] = q.wake; });
    this.device.queue.writeBuffer(this.emitBuf, 0, this.block, 0, BLOCK_HDR_BYTES + n * REC_BYTES);
    if (live > 0 || born > 0) this.device.queue.writeBuffer(this.pool, 0, Particles.ZERO_HDR, 0, 2);   // this frame's alive / asleep counts start from zero (bounces / born-inside / kicked stay cumulative)
    // stats
    this.stats.live = [this.win[0][3], this.win[1][3]]; this.stats.born = born - rainBorn; this.stats.records = n - rainRecs; this.stats.impulses = ni; this.stats.winds = nw;   // (the gameplay numbers: the rain ring's are in rainStats)
    this.rateT += dt; if (this.rateT >= 0.5) { this.stats.perSec = this.stats.perSec * 0.5 + (this.rateAcc / this.rateT) * 0.5; this.rateAcc = 0; this.rateT = 0; }
    this.frameNo++;
  }

  /** will encodeUpdate record anything this frame? (the engine asks before requesting a timestamp slot for it) */
  get hasWork(): boolean { return this.born > 0 || this.liveTotal > 0; }
  /** The simulation: births then the step, one compute pass ('particles' in the HUD). A no-op with nothing born and nothing live. */
  encodeUpdate(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, diceView: GPUTextureView, ts?: GPUComputePassTimestampWrites) {
    if (this.born === 0 && this.liveTotal === 0) return;
    if (!this.bgSim || this.bgSimDice !== diceView) {
      this.bgSim = this.device.createBindGroup({ layout: this.lSim, entries: [{ binding: 0, resource: { buffer: this.pool } }, { binding: 1, resource: { buffer: this.emitBuf } }, { binding: 2, resource: diceView },
        { binding: 3, resource: this.airView ?? this.sceneDummyView }, { binding: 4, resource: { buffer: this.grainBuf } }] });
      this.bgSimDice = diceView;
    }
    { const c = this.grainCfg, was = this.grainSent; let same = true; for (let i = 0; i < c.length; i++) if (c[i] !== was[i]) { same = false; break; }
      if (!same) { was.set(c); this.device.queue.writeBuffer(this.grainBuf, 0, c); } }
    const p = enc.beginComputePass({ label: 'particles', timestampWrites: ts });
    p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgSim);
    if (this.born > 0) { p.setPipeline(this.pEmit); p.dispatchWorkgroups(Math.ceil(this.born / 64)); }
    if (this.liveTotal > 0) { p.setPipeline(this.pUpdate); p.dispatchWorkgroups(Math.ceil(this.liveTotal / 64)); }
    p.end();
    // the header's counters back to the CPU a few times a second (the panel's alive / asleep read-out; nothing waits on it)
    if (this.frameNo % 6 === 0 && this.inflight.length < 3) {
      let rb = this.readbacks.pop(); if (!rb) rb = this.device.createBuffer({ size: 32, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ, label: 'particleStats' });
      enc.copyBufferToBuffer(this.pool, 0, rb, 0, 32); this.inflight.push(rb);
    }
  }
  /** The splat into the HDR target (loadOp 'load': straight over what the composite wrote) + its reactive mask into `reactView` (cleared here: this pass is the mask's only writer, and the
   *  resolve reads it only on frames this ran — liveSlots > 0), 6 vertices per live-window slot. A no-op with nothing live. */
  /** `scene` (PARTICLE RAIN v2): the composite-size copy of the HDR target the rain streaks refract — `view` is bound at 5; when `copy` is given (GBAA off: nobody else fills it) and the rain
   *  ring is live, hdr is copied into it first (≈ 0.1 ms at 1777×1000); without `copy` the view is read as it stands (GBAA refreshed it at the end of last frame: a frame old, free).
   *  null / omitted = the 1×1 stand-in and refraction off for the frame. */
  encodeDraw(enc: GPUCommandEncoder, sceneBG: GPUBindGroup, hdrView: GPUTextureView, reactView: GPUTextureView, depthView: GPUTextureView, volView: GPUTextureView, froxelView: GPUTextureView, ts?: GPURenderPassTimestampWrites, scene?: { view: GPUTextureView; copy?: { src: GPUTexture; dst: GPUTexture; w: number; h: number } } | null) {
    if (this.liveTotal === 0) return;
    const rainLive = this.rainWin[3] > 0;
    const wantScene = rainLive && !!scene && this.rainLook.refract > 0;
    const sceneView = wantScene ? scene!.view : this.sceneDummyView;
    const nextCopy: 'gbaa' | 'copy' | 'none' = wantScene ? (scene!.copy ? 'copy' : 'gbaa') : 'none';
    if (nextCopy !== this.rainSceneCopy) { this.rainSceneCopy = nextCopy; }   // (read by prepare() next frame: rainCfgC.x is zeroed while nothing real is bound)
    if (wantScene && scene!.copy) enc.copyTextureToTexture({ texture: scene!.copy.src }, { texture: scene!.copy.dst }, [scene!.copy.w, scene!.copy.h]);
    if (!this.bgDraw || this.bgDrawKey[0] !== depthView || this.bgDrawKey[1] !== volView || this.bgDrawKey[2] !== froxelView || this.bgDrawKey[3] !== sceneView) {
      this.bgDraw = this.device.createBindGroup({ layout: this.lDraw, entries: [{ binding: 0, resource: { buffer: this.pool } }, { binding: 1, resource: { buffer: this.emitBuf } }, { binding: 2, resource: depthView }, { binding: 3, resource: volView }, { binding: 4, resource: froxelView }, { binding: 5, resource: sceneView }, { binding: 6, resource: this.sceneSamp }] });
      this.bgDrawKey = [depthView, volView, froxelView, sceneView];
    }
    const p = enc.beginRenderPass({ label: 'particlesDraw', colorAttachments: [{ view: hdrView, loadOp: 'load', storeOp: 'store' }, { view: reactView, loadOp: 'clear', storeOp: 'store', clearValue: { r: 0, g: 0, b: 0, a: 0 } }], timestampWrites: ts });
    p.setPipeline(this.pDraw); p.setBindGroup(0, sceneBG); p.setBindGroup(1, this.bgDraw);
    p.draw(6 * this.liveTotal); p.end();
  }
  /** after queue.submit: map the oldest counter readback */
  afterSubmit() {
    while (this.inflight.length > 2) { const b = this.inflight.shift()!; this.readbacks.push(b); }
    const rb = this.inflight.shift(); if (!rb) return;
    rb.mapAsync(GPUMapMode.READ).then(() => {
      const u = new Uint32Array(rb.getMappedRange().slice(0)); rb.unmap(); this.readbacks.push(rb);
      this.stats.alive = u[0]; this.stats.asleep = u[1]; this.stats.bounces = u[2]; this.stats.killedInside = u[3]; this.stats.kicked = u[4]; this.stats.windWoken = u[5];
    }).catch(() => { /* lost */ });
  }
}
