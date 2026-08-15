// Headless stand-up of the FULL game layer for QA scripts (bun): the real Game — its constructor, update(), doors / props / guards / squad / escalation /
// mission / combat / lighting modules, real Characters + animators + ragdolls off the glTF on disk, real collision / nav / sound propagation — on top of a
// fake WebGPU device. What is faked, and what that means for a script:
//   - the GPU device is a Proxy that accepts any call and returns more of itself: buffers "exist", writeBuffer is a no-op, mapAsync never resolves. So the
//     CPU halves of BoxWorld (packing, grid, CPU raycast for the cursor / lasers) and LightSet (add / flash / update / upload) run for real; nothing renders.
//   - the irradiance probe never answers: player.visibility / irradiance stay whatever the script sets (the light meter is the script's knob, not the
//     renderer's), and every guard's smokeTrans stays 1 (no smoke between anyone).
//   - the smoke solver is a null object (emit / push / clearAll accepted and dropped, inSmokeDomain false); throwables, canisters and stun charges still run
//     their CPU side (fuses, bounces, dazzle, hearing events).
//   - Input is the real class minus its DOM listeners: scripts write keys / pressed / mouse / clicked exactly as main.ts's automation hooks do.
//   - audio is a counting null object (what would have played, by name) — and a recording one on request: set W.audioLog = [] and every call lands in it
//     in order (name, position, gain, opts, game time), for probes about WHEN things sound (audio-probes.ts); null again stops it. Off by default: a soak
//     plays tens of thousands of footsteps.
// Usage:  const W = await standUp();  W.step(1/60);  // = game.update + camera + lights + box upload + input.endFrame, as main.ts's step() does
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dir, '../..');

// ---- WebGPU enum globals the CPU-side modules reference when they build their (fake) resources
const G = globalThis as any;
G.GPUBufferUsage ??= { MAP_READ: 1, MAP_WRITE: 2, COPY_SRC: 4, COPY_DST: 8, INDEX: 16, VERTEX: 32, UNIFORM: 64, STORAGE: 128, INDIRECT: 256, QUERY_RESOLVE: 512 };
G.GPUTextureUsage ??= { COPY_SRC: 1, COPY_DST: 2, TEXTURE_BINDING: 4, STORAGE_BINDING: 8, RENDER_ATTACHMENT: 16 };
G.GPUShaderStage ??= { VERTEX: 1, FRAGMENT: 2, COMPUTE: 4 };
G.GPUMapMode ??= { READ: 1, WRITE: 2 };
G.GPUColorWrite ??= { RED: 1, GREEN: 2, BLUE: 4, ALPHA: 8, ALL: 15 };   // (the TAAU reactive-mask target in render/particles.ts names a write mask)

/** An object that is anything you ask of it: every property is another fake, every call returns one, promises never settle (except shader compile info). */
export function fake(name = 'gpu'): any {
  const fn = function () { /* callable target */ };
  return new Proxy(fn, {
    get(_t, p) {
      if (p === 'then') return undefined;                       // never look like a thenable
      if (p === Symbol.toPrimitive) return () => 0;
      if (p === 'toString' || p === Symbol.toStringTag) return () => `[fake ${name}]`;
      if (p === 'getCompilationInfo') return () => Promise.resolve({ messages: [] });
      if (p === 'mapAsync') return () => new Promise(() => { /* never resolves: no readbacks headless */ });
      if (p === 'label') return name;
      return fake(`${name}.${String(p)}`);
    },
    apply() { return fake(`${name}()`); },
    construct() { return fake(`${name}#new`); },
    set() { return true; },
  });
}

const { buildLevel } = await import(`${ROOT}/src/scene/level.ts`);
const { BoxWorld } = await import(`${ROOT}/src/scene/boxes.ts`);
const { LightSet, lightFromDef } = await import(`${ROOT}/src/render/lights.ts`);
const { loadGltfCharacter } = await import(`${ROOT}/src/anim/gltf.ts`);
const { Game } = await import(`${ROOT}/src/game/game.ts`);
const { saveState, loadState, memoryStore } = await import(`${ROOT}/src/game/savestate.ts`);
const { FollowCamera } = await import(`${ROOT}/src/game/camera.ts`);
const { Input } = await import(`${ROOT}/src/game/input.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
let defaultSettings: () => any;
try { defaultSettings = (await import(`${ROOT}/src/engine.ts`)).defaultSettings; }
catch { defaultSettings = () => ({ flashlightRadius: 0.07, emissiveScale: 1 }); }

let chPromise: Promise<any> | null = null;
/** the glTF mannequin, loaded once per process (file:// fetch of public/assets) */
export function loadCharacter(): Promise<any> { return chPromise ??= loadGltfCharacter(`file://${ROOT}/public/assets/ual/AnimationLibrary_Godot_Standard.gltf`); }

export type Vec3 = [number, number, number];
/** one recorded audio call (W.audioLog): a play() by name, or a footstep() as name 'footstep' with its loudness as the gain and { isPlayer, mat } as the opts */
export interface AudioCall { name: string; pos: Vec3 | null; gain: number; opts?: Record<string, unknown>; t: number; }

export interface Headless {
  game: any; engine: any; level: any; input: any; cam: any; canvas: { clientWidth: number; clientHeight: number; width: number; height: number };
  audioCounts: Map<string, number>;
  /** CHECKPOINTS (src/game/savestate.ts — the game's own saveState / loadState): snapshot() serialises the encounter as it stands (force: Sam's hands and any
   *  script let go of in the file, see canSave; throws with the reason when refused — a show running, a unit on the floor, Sam down), restore(s) puts one back
   *  into THIS game (the running encounter thrown away first, as a restart does; the camera re-targeted). The same JSON the browser keeps in its slots, so a
   *  probe can start from a situation staged once — or from a file a player exported. */
  snapshot(label?: string, force?: boolean): any;
  restore(s: any): void;
  /** null (the default): nothing recorded. Set it to an array and every audio call from then on is appended to THAT array, in order, stamped with game.time. */
  audioLog: AudioCall[] | null;
  /** the null smoke object the Game was given (emit / push / clearAll dropped) — hand the same one to anything else main.ts constructs with `smoke` (the Demo) */
  smoke: any;
  /** one frame exactly as main.ts steps it (minus rendering): game.update → camera → lights → box upload → input.endFrame. `follow` is what main.ts calls
   *  demoPos: the showcase tour's camera look-at for this frame (Demo.update's return, called BEFORE this) — the camera then follows it and drops the aim lead */
  step(dt: number, follow?: Vec3 | null): void;
  /** put the cursor on a world point (what the automation hooks' __mouse does after projecting) */
  cursorAt(p: [number, number, number]): boolean;
}

/** A fresh level + engine stand-in + Game. Math.random should already be seeded by the caller if determinism matters (Guard / Character constructors draw from it).
 *  `env` (a session journal's EnvSnap — tools/qa/replay.ts): stand the engine up as the RECORDING's was where the simulation can tell — its settings (debris cap,
 *  emissive scale, torch radius, marking lights) before the Game is built, a fake GPU particle system attached if it had one (the effect sites then take the branch
 *  they took), the canister row on the null smoke. Absent = the harness exactly as it always stood. */
export async function standUp(opts: { uploadEvery?: number; env?: any } = {}): Promise<Headless> {
  const ch = await loadCharacter();
  const device = fake('device');
  const level = buildLevel();
  const engine: any = { device, sceneLayout: fake('sceneLayout'), skin: null, lights: new LightSet(device), world: new BoxWorld(device), settings: defaultSettings(), effectiveScale: 1 };
  if (opts.env) { const { applyEnvSettings } = await import(`${ROOT}/src/game/journal.ts`); applyEnvSettings(engine.settings, opts.env); if (opts.env.particlesOn) { engine.settings.gpuParticles = true; engine.setParticles = () => { engine.particles = fake('particles'); }; } }
  for (const b of level.boxes) engine.world.addStatic(b);
  for (const ld of level.lights) engine.lights.add(lightFromDef(ld));
  const smoke: any = { emit() { /* dropped */ }, push() { /* dropped */ }, inSmokeDomain() { return false; }, clearAll() { /* nothing */ }, budget() { return 64; } };
  if (opts.env?.canister) smoke.params = { ...opts.env.canister };
  const game = new Game(engine, level, ch, smoke);
  game.tune.chaos = 0;   // DESTRUCTION (src/game/destruction.ts): the harness stands the game up at chaos 0 — the game byte for byte as it was before the lane, which is what every frozen
                         // digest and exact-count probe was written against; the destruction probes and `soak.ts --chaos K` raise it themselves (the shipped default is 0.5)
  game.saves.store = memoryStore();   // (no localStorage in bun: the autosave slots live in a Map the probes can read — game.saves.store.map)
  game.director.strict = true;         // the level script (src/game/director.ts): a beat that throws fails its PROBE here — in the page it fails the beat and the frame goes on
  const audioCounts = new Map<string, number>();
  let audioLog: AudioCall[] | null = null;
  game.audio = {
    play(n: string, pos: Vec3 | null, gain = 1, opts?: Record<string, unknown>) { audioCounts.set(n, (audioCounts.get(n) ?? 0) + 1); audioLog?.push({ name: n, pos: pos ? [pos[0], pos[1], pos[2]] : null, gain, opts, t: game.time }); },
    footstep(pos: Vec3, loudness: number, isPlayer: boolean, mat?: string) { audioCounts.set('footstep', (audioCounts.get('footstep') ?? 0) + 1); audioLog?.push({ name: 'footstep', pos: [pos[0], pos[1], pos[2]], gain: loudness, opts: { isPlayer, mat }, t: game.time }); },   // (mat: the floor material the caller resolved — floor.ts tread)
  };
  const input: any = Object.create(Input.prototype);
  Object.assign(input, { keys: new Set<string>(), pressed: new Set<string>(), mouseX: 800, mouseY: 500, buttons: 0, clicked: 0, wheel: 0, hasFocus: true, lockExcept: null, suppressClick: false, onLockedInput: null });
  const canvas = { clientWidth: 1600, clientHeight: 1000, width: 1600, height: 1000 };
  const cam = new FollowCamera(); cam.target = v3.copy(level.playerSpawn); cam.aspect = canvas.width / canvas.height; cam.rebuild();
  engine.world.upload();
  let frame = 0; const uploadEvery = Math.max(1, opts.uploadEvery ?? 1);
  const W: Headless = {
    game, engine, level, input, cam, canvas, audioCounts, smoke,
    get audioLog() { return audioLog; }, set audioLog(v: AudioCall[] | null) { audioLog = v; },
    step(dt: number, follow: Vec3 | null = null) {
      game.update(dt, input, cam, canvas);
      cam.update(dt, follow ?? game.followPos(), follow || game.spectate >= 0 ? null : game.aimPoint);   // (main.ts: demoPos ?? followPos, and no aim lead while the tour frames the shot)
      engine.lights.update(dt, game.time);
      engine.world.dynamics = game.dynBoxes;
      if (frame++ % uploadEvery === 0) engine.world.upload();   // CPU pack + grid (what the cursor's raycast and the lasers read); the GPU writes go nowhere
      input.endFrame();
    },
    cursorAt(p) { const [sx, sy, front] = cam.project(p, canvas.clientWidth, canvas.clientHeight); if (front) { input.mouseX = sx; input.mouseY = sy; } return front; },
    snapshot(label = 'harness', force = true) { return saveState(game, { label, kind: 'harness', force }); },
    restore(s) { loadState(game, s); cam.target = v3.copy(game.player.char.pos); input.keys.clear(); input.pressed.clear(); input.buttons = 0; input.clicked = 0; },
  };
  return W;
}
