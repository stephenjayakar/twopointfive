// HostApi — what the GAME needs from "the engine", named once (the member list is what a Proxy logged of the game's calls
// plus what grep finds in src/game). Two implementations: the WebGPU `Engine` (src/engine.ts — conforms structurally, asserted once in src/main.ts), the headless
// stand-in (src/host/stub.ts: fake device, null smoke, a probe that never answers — tools/qa/headless.ts's shape). (A third, a native Metal host, was removed
// 2026-10; it is in git history.)
//
// `Game(engine: HostApi, …)` (game.ts) and guards.ts take this type by `import type`, so the game layer no longer pulls src/engine.ts — and with it every render pass module
// and every WGSL text — into a bundle that only wants the simulation. Nothing here has a value at run time: types only.
//
// REQUIRED members are the ones game code reads unguarded; OPTIONAL ones are what it already reads defensively (`engine.setParticles?.()`, `(engine as { weather? }).weather`,
// `engine.viewFocus ?? …`) — the QA harness's stand-in has only the required set and every frozen digest was recorded against exactly that, so the stub keeps to it.
// A FULL host (the WebGPU Engine, the native host) implements every member.
import type { BoxWorld } from '../scene/boxes';
import type { LightSet } from '../render/lights';
import type { RenderSettings } from '../settings';
import type { WeatherFrame } from '../render/frame';
import type { Particles } from '../render/particles';
import type { SkinnedDrawable } from '../render/gbuffer';
import type { MeshShadows } from '../render/meshShadows';
import type { RigFit } from '../render/sdfrig';
import type { Decals } from '../render/decals';
import type { ProbeLike } from '../game/sensors';
import type { Vec3 } from '../math/vec';
import type { FireRecord } from '../render/passes';
import type { FireShown } from '../game/fire';
import type { SmokeShown } from '../game/smokebreak';

export interface HostApi {
  // ---- per frame
  /** the CPU box world: statics, dynamics, raycasts, upload (scene/boxes.ts) — host-neutral */
  readonly world: BoxWorld;
  /** the light set: add / flash / remove / lights / upload (render/lights.ts) */
  readonly lights: LightSet;
  /** the knob table (src/settings.ts). The game READS emissiveScale, flashlightRadius, particleRain, wetChars, markingTexel, decals, markings, gloss, debrisCap, gpuParticles,
   *  sharpDecouple, and WRITES nothing here (nvAmount / hitFlash are written by the loop — src/host/loop.ts — off Player) */
  readonly settings: RenderSettings;
  /** what the weather wants drawn in the outdoor air (game/weather.ts writes it; game/wet.ts reads .rain). Absent on a stand-in: weather.ts `??=`s one in */
  weather?: WeatherFrame;
  /** the GPU particle system while one is attached (game/particleFx.ts routes to it under settings.gpuParticles); null / absent = the CPU sparks */
  readonly particles?: Particles | null;
  /** the air over the floor as a simulated field (render/airField.ts; game/airSim.ts feeds it its obstacles and this frame's wind) — picture only; null / absent = none (headless, `?air=0`) */
  readonly air?: { setCells(mask: Uint8Array, rect?: readonly [number, number, number, number]): void; setSources?(recs: Float32Array, n: number): void; reset(): void; readonly w: number; readonly h: number } | null;
  airWind?: [number, number]; airOn?: boolean;
  /** SHARP DIRECT live this frame (the WebGPU decoupled-resolution path; false / absent natively and headless) — game.ts mPerPx */
  readonly sharpOn?: boolean;
  /** GLASS FRACTURE (game/glassbreak.ts): true = this renderer draws the model's cracks and holes (the WebGPU engine booted with the GLASS_BREAK const); false = it cannot
   *  — the const was off at boot, or the host has no port of the per-piece rule (native) — and the model stays INERT so the picture and the AI agree; absent (the harness
   *  stub) = nothing is drawn at all and the model runs */
  readonly glassFracture?: boolean;
  /** internal rows ÷ (CSS rows × dpr): the true pixel ratio — game.ts:1107 mPerPx depends on it (1 headless / at output resolution) */
  readonly effectiveScale: number;
  /** the view's look-at point as of the last render (the smoke solver spends its pool by distance from it; wind.ts reads it) */
  viewFocus?: Vec3;
  /** the open fires to draw this frame (game/fire.ts writes the list; the engine hands it to the composite — render/passes.ts setFires). Absent on a stand-in */
  fires?: FireRecord[];
  /** the fires' book of what was filed with the smoke solver and asked of the mixer (game/fire.ts FireShown): the host's, so in no snapshot. Dropped (set
   *  undefined) when a save in memory is put back (host/putback.ts) and by a load's own paint: the smoke and the bed are then asked for afresh */
  fireShown?: FireShown;
  /** a smoke break's book of what was filed with the smoke solver and the particle pool (game/smokebreak.ts SmokeShown): the host's, so in no snapshot.
   *  Dropped when a save in memory is put back (host/putback.ts) and when the switch goes off; a thread the solver let go is filed afresh either way */
  smokeShown?: SmokeShown;
  /** the light rig swapped wholesale (day ↔ night): the radiance cache re-primes (game/lighting.ts calls it `?.()`) */
  invalidateWorldCache?(): void;
  /** the level was put back to its start under the picture (game/cleanrestart.ts): every temporal history and the radiance cache start from nothing, as on a boot's
   *  first frame — nothing of the level as it stood is blended into the fresh one. Picture only; absent on a stand-in */
  restartPicture?(why: string): void;
  // ---- boot-time attach points (game.ts constructor)
  /** the skinned characters' drawable — `engine.skin = this.chars` */
  skin: SkinnedDrawable | null;
  /** the mannequins' shadow trees (ultra's mesh shadows) — native: a no-op (hardware BLAS) */
  setMeshShadows?(m: MeshShadows | null): void;
  /** the SDF character rig's radius fit — native: kept (the capsules table) */
  setRigFit?(fit: RigFit | null): void;
  setParticles?(p: Particles | null): void;
  setDecals?(d: Decals | null): void;
  /** the detail layer's traffic map (render/wear.ts) — absent on a stand-in */
  readonly gbuffer?: { setWearMap(data: Uint8Array, w: number, h: number): void; setSnowField?(f: { data: Uint16Array; w: number; h: number; quads: Uint32Array } | null, cfg: Float32Array): void; setSnowFieldRect?(f: { data: Uint16Array; w: number; h: number }, rect: readonly [number, number, number, number]): void; setSnowCfg?(cfg: Float32Array): void; setSnowTracks?(t: { data: Uint8Array; w: number; h: number } | null, rect?: readonly [number, number, number, number]): void };
  // ---- GPU-facing pieces the CPU render classes need
  /** createBuffer / queue.writeBuffer (+ createShaderModule / createBindGroupLayout / createPipelineLayout / createBindGroup — only the WebGPU probe uses those). A stand-in
   *  (the harness's Proxy, the native TableDevice) is handed over cast to GPUDevice: the render classes take the real type */
  readonly device: GPUDevice;
  /** the scene bind-group layout the WebGPU probe's own pipeline layouts against (a fake on every other host) */
  readonly sceneLayout: GPUBindGroupLayout;
  /** OPTIONAL: the host owns probe construction (the native probe over the shared query / answer tables); absent = the game builds `new IrradianceProbe(device, sceneLayout)` */
  probe?(): ProbeLike;
  /** the adapter's storage-buffer budget has room for the mesh-shadow slot (informational) */
  readonly meshShadowsAvailable?: boolean;
}
