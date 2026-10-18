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
// ONE-WAY DOORS (src/game/doors.ts DOORWAY — the shipped default is ON): the harness stands the game up with the leaves double-acting, as every older probe, frozen
// digest, tally and session fixture met them. `probes.ts oneway` turns it on for itself, playthrough.ts plays the shipped doors (--set '{"DOORWAY":{"oneWay":false}}'
// = the old ones), and ONEWAY=1 (env) runs any tool here — the tour, the soak, a probe family — on the shipped doors.
// (OUTSIDE DOORS OPENING OUTWARD — DOORWAY.exitsOut, shipped OFF — is off here too, whatever ONEWAY says; QA_EXITSOUT=1 turns it on for any tool.)
// THE TWO STANDS (src/host/profile.ts): every pin in this file and in standGame's harness block holds on the FROZEN stand — the default — and, under TPS_PROFILE=shipped,
// only where the run's environment names that pin's own word; otherwise the table keeps its module's default, which is what the page plays. shippedBoot() = the few rows
// the page's boot writes over those defaults. First, before any level is built.
const { pinned, harnessProfile, shippedBoot } = await import(`${ROOT}/src/host/profile.ts`);
if (harnessProfile() === 'shipped') shippedBoot();
{ const { EXACT } = await import(`${ROOT}/src/math/exact.ts`); if (pinned('TPS_EXACT')) EXACT.on = process.env.TPS_EXACT === '1'; }   // TPS_EXACT=1 = the game's own maths (src/math/exact.ts): same bits on every engine. Here as well as in standGame, so a level a tool builds before it stands a game is built on the same functions
const { EXACT: EXACT_SWITCH } = await import(`${ROOT}/src/math/exact.ts`);
/** `fn` run as a level's EXPORTER runs (tools/level-export.ts and its kin raise no stand): on the engine's own maths, whatever this run's stand — then the stand's
 *  maths back. For a check that holds a level file against the generator that wrote it: under the game's own maths a generator's sin / cos round a last bit
 *  another way than the file was written with, and that is a fact about the writing tool, not a stale file. Besides exact-check.ts, which tests the switch, the one place a tool flips it under itself. */
export function asExporter<T>(fn: () => T): T { const was = EXACT_SWITCH.on; EXACT_SWITCH.on = false; try { return fn(); } finally { EXACT_SWITCH.on = was; } }
{ const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`); if (pinned('TPS_LIVED')) LIVED.on = process.env.TPS_LIVED === '1'; }   // TPS_LIVED=1 = lived-in rooms (scene/lived.ts): a level's lived things are loaded with it (off = each level as it was before there were any)
{ const { LOOK } = await import(`${ROOT}/src/scene/look.ts`); if (pinned('TPS_LOOK')) LOOK.on = process.env.TPS_LOOK === '1'; }   // TPS_LOOK=1 = the default look (scene/look.ts): a level that has a file in it is loaded from that file (playthrough.ts levelOfFile), the men wear its kit
{ const { MUSIC } = await import(`${ROOT}/src/audio/pieces.ts`); if (pinned('TPS_MUSIC')) MUSIC.pieces = MUSIC.byLevel = MUSIC.theirs = process.env.TPS_MUSIC === '1'; }   // TPS_MUSIC=1 = more music than the one theme (audio/pieces.ts): the score plays its newer pieces, each level its own two of them (MUSIC.byLevel, audio/setlist.ts) and its tension reads the opposition's nerves alone (MUSIC.theirs, game/guards.ts tension): the one word raises all three; off = the theme alone, every man counted. No harness run hears it (audio is a null object here): the row is the stand's, and tools/qa/music-check.ts drives the sequencer itself
{ const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`); if (pinned('ONEWAY')) DOORWAY.oneWay = process.env.ONEWAY === '1'; if (pinned('QA_EXITSOUT')) DOORWAY.exitsOut = process.env.QA_EXITSOUT === '1'; }
// DOORWAY MANNERS (src/game/doorway.ts DOORMANNERS — the shipped default is ON): the same rule as the other door switches. The harness stands the game up with
// nobody waiting or stepping aside at a doorway, as every older probe, bound and digest met it; playthrough.ts plays the shipped manners
// (--set '{"DOORMANNERS":{"on":false}}' = without), and QA_DOORMANNERS=1 (env) runs any tool here on them.
{ const { DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`); if (pinned('QA_DOORMANNERS')) DOORMANNERS.on = process.env.QA_DOORMANNERS === '1'; }
// THE FRAME HOLDS (src/game/doors.ts DOORWAY.frameHolds — the shipped default is ON; it only means anything with the one-way doors): the same rule as the other
// door switches. The harness stands the game up with a boot at the face a door opens toward flinging it round, and a wedge holding any door, as every older
// probe and digest met them; playthrough.ts plays the shipped rule (--set '{"DOORWAY":{"frameHolds":false}}' = without), QA_FRAMEHOLDS=1 (env) runs any tool
// here with it (beside ONEWAY=1).
{ const { DOORWAY } = await import(`${ROOT}/src/game/doors.ts`); if (pinned('QA_FRAMEHOLDS')) DOORWAY.frameHolds = process.env.QA_FRAMEHOLDS === '1'; }
// OFF ITS HINGES (src/game/doorblast.ts DOORBLAST — the shipped default is ON): likewise. Here a blast leaves every leaf on its hinges, as the older probes met a
// door charge; `probes.ts off-hinges` turns it on for itself, playthrough.ts plays it on, QA_DOORBLAST=1 (env) runs any tool here with it.
{ const { DOORBLAST } = await import(`${ROOT}/src/game/doorblast.ts`); if (pinned('QA_DOORBLAST')) DOORBLAST.on = process.env.QA_DOORBLAST === '1'; }

// ---- the WebGPU enum globals, the device fake and the engine stand-in live in src/host/ now (stub.ts: the headless HostApi — the same object this file always built), the stand-up in
// src/host/standup.ts (standGame: the level into the world / light set, the mannequin, `new Game`, the harness's chaos-0 / memory-store / strict-director trio, the camera on the
// spawn) — main.ts and the native entry come through the same function, so the construction order (and its Math.random draws) is one order. This file is the harness's wrapper:
// the audio counter / recorder, the detached Input at (800, 500), the 1600 × 1000 canvas, step(), snapshot / restore, cursorAt.
await import(`${ROOT}/src/host/gpuEnums.ts`);   // (must run before any render module that names GPUShaderStage & co. at load evaluates)
const stubMod = await import(`${ROOT}/src/host/stub.ts`);
const standMod = await import(`${ROOT}/src/host/standup.ts`);
/** An object that is anything you ask of it: every property is another fake, every call returns one, promises never settle (except shader compile info). */
export const fake: (name?: string) => any = stubMod.fake;

const { loadGltfCharacter, loadGltfCast, castFile } = await import(`${ROOT}/src/anim/gltf.ts`);
const { saveState, loadState } = await import(`${ROOT}/src/game/savestate.ts`);
const { Input } = await import(`${ROOT}/src/game/input.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
// the movement pass (character.ts MOVES) is ON in the page and OFF under the harness — pinned here too, so tools that build a bare Character (gait.ts) and never
// stand a game up measure the animator as it was; `TPS_MOVES=1` runs any of them with it on
if (pinned('TPS_MOVES')) { // TPS_MOVES=1 = the pass on; TPS_MOVES=1,flinch=0,gait=0 = on with those parts off (for telling which part moves a tally)
  const M = (await import(`${ROOT}/src/game/character.ts`)).MOVES as Record<string, number>, spec = (process.env.TPS_MOVES ?? '').split(',');
  M.on = spec[0] === '1' ? 1 : 0; for (const kv of spec.slice(1)) { const [k, v] = kv.split('='); if (k in M) M[k] = Number(v); }
}
if (pinned('TPS_DOORPATH')) { // TPS_DOORPATH=1 = a room entry's men on real paths through the door (src/game/doorpath.ts DOORPATH); TPS_DOORPATH=1,gapM=1.2 = on with that number
  const D = (await import(`${ROOT}/src/game/doorpath.ts`)).DOORPATH as Record<string, any>, spec = (process.env.TPS_DOORPATH ?? '').split(',');
  D.on = spec[0] === '1'; for (const kv of spec.slice(1)) { const [k, v] = kv.split('='); if (k in D && k !== 'on') D[k] = Number(v); else throw new Error(`TPS_DOORPATH: no knob '${k}'`); }
}
if (pinned('TPS_TURN')) { // TPS_TURN=1 = the turn weight on (character.ts TURN) as shipped; TPS_TURN=medium | heavy | light = on at that named setting (TURN_FEEL); TPS_TURN=1,aim=7,aimAcc=50 = on with those numbers (for finding a value to defend). Anything else stops the tool: a mistyped arm must not be counted as another one.
  const C = await import(`${ROOT}/src/game/character.ts`), spec = process.env.TPS_TURN ?? '';
  if (!C.setTurn(spec, 0)) throw new Error(`TPS_TURN='${spec}' not understood: 0 | 1 | ${Object.keys(C.TURN_FEEL).join(' | ')}, then ,key=number over character.ts TURN's keys`);
}
// the kit's pouches rule (src/game/kit.ts SLOTS) is ON in the page and OFF under the harness: the free rows, and a wall charge carried by the game's own knob, which is the
// kit every other part's probes, tallies and frozen digests stage. Pinned HERE, once, as this module loads — never at a stand-up — so a probe that means the rule turns it
// on itself (kitLoad(store, '') as the page does at boot, or SLOTS.on = true) and keeps it through every stand-up and play-through it then makes; probes.ts puts it back after
if (pinned('SLOTS')) { // SLOTS=on (or 1) = the rule on from the start, as the page ships it: any harness tool (a tally, a play-through, a family) run under the pouches. SLOTS=off | 0 | unset = off. Anything else stops the tool.
  const K = await import(`${ROOT}/src/game/kit.ts`), spec = process.env.SLOTS ?? '';
  if (!/^(|0|1|on|off)$/i.test(spec)) throw new Error(`SLOTS='${spec}' not understood: on | off (or 1 | 0)`);
  K.SLOTS.on = K.SLOTS.ok && /^(1|on)$/i.test(spec);
}

let chPromise: Promise<any> | null = null;
/** the glTF mannequin, loaded once per process (file:// fetch of public/assets) */
/** is this run's character THE CAST? (the shipped stand: yes, as the page; the frozen one: only under TPS_CAST=<anything>; `TPS_CAST=` — set and empty — is the mannequin on either) */
export const castStood = (): boolean => !!(pinned('TPS_CAST') ? process.env.TPS_CAST : '1');
export function loadCharacter(): Promise<any> { return castStood() ? loadCastCharacter() : loadMannequin(); }   // (the shipped stand is on the cast, as the page; the frozen one on the mannequin unless TPS_CAST says so)
const loadMannequin = (): Promise<any> => chPromise ??= loadGltfCharacter(`file://${ROOT}/public/assets/ual/AnimationLibrary_Godot_Standard.gltf`);
let castPromise: Promise<any> | null = null;
/** THE CAST (public/assets/chars/cast.gltf — the operators' and defenders' meshes on the mannequin's skeleton, what the PAGE boots with): the harness stands on the mannequin as every
 *  frozen number was taken on it (the simulation reads no mesh, so nothing differs but what is drawn); `standUp({ cast: true })`, or TPS_CAST=1 in the environment for a whole tool
 *  (`TPS_CAST=1 bun run tools/qa/tour.ts`), stands on the cast instead. Throws if the file is missing or off contract. */
export function loadCastCharacter(): Promise<any> { return castPromise ??= loadMannequin().then(base => loadGltfCast(`file://${ROOT}/public/assets/chars/${castFile()}`, base)); }
/** the same for one named look, whatever the switch says (cast-probes.ts loads both files side by side): not cached */
export function loadCastOf(look: boolean): Promise<any> { return loadMannequin().then(base => loadGltfCast(`file://${ROOT}/public/assets/chars/${castFile(look)}`, base)); }

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
 *  they took), the canister row on the null smoke. Absent = the harness exactly as it always stood.
 *  `level` (a Level — loadLevel(parseLevelData(text)) of any file under levels/): stand the game up on THAT level instead of the bundled office.
 *  `seed` (or TPS_SEED=n in the environment): the Game owns its die, seeded with it (src/math/dice.ts) — as the page's game does. Absent = the game draws the
 *  tool's Math.random, as it always has (a tool that re-seeds Math.random afterwards gets the game's dice either way: dice.ts's one rule). */
/** TPS_SEED: a whole number names the game's own die; anything else stops the tool (a typo must not quietly become seed 0) */
function envSeed(v: string): number { if (!/^\d+$/.test(v.trim())) throw new Error(`TPS_SEED=${v}: want a whole number`); return Number(v) >>> 0; }
export async function standUp(opts: { uploadEvery?: number; env?: any; level?: any; cast?: boolean; ch?: any; seed?: number | null } = {}): Promise<Headless> {
  const ch = opts.ch ?? await (opts.cast ? loadCastCharacter() : loadCharacter());
  { const force = process.env.CUTBOXES ?? process.env.CUT_BOXES;   // CUTBOXES=1 | 0 in front of any headless tool forces the cut switch (CUT_BOXES is read too); a replay's env wins
    if (opts.env || force !== undefined) { const { cutConfig } = await import(`${ROOT}/src/scene/cut.ts`); cutConfig.on = opts.env ? !!opts.env.cutBoxes : /^(1|on|true)$/i.test(force!); }
    else if (!pinned('CUTBOXES')) (await import(`${ROOT}/src/scene/cut.ts`)).cutConfig.on = true; }   // (the shipped stand, no word given: on, as the page opens — main.ts initCutSwitch)   // (a recording made with cut boxes on replays with them on: rayBox / lineBox answer the cut solids — read before the BoxWorld below latches it)
  if (process.env.TPS_BLASTPACE === 'old') (await import(`${ROOT}/src/game/destructionSwitch.ts`)).BLAST_PACE.on = false;   // TPS_BLASTPACE=old in front of any headless tool = the page's ?blastpace=old: a wall's reach masks, drip lines and furniture index all on the frame it goes, as before
  const engine: any = stubMod.stubHost();   // device fake, sceneLayout fake, skin null, an empty LightSet + BoxWorld on the fake, default settings, effectiveScale 1 — and nothing more (src/host/stub.ts)
  if (opts.env) { const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`); DESTRUCTION.on = !!opts.env.destruction?.on; const { LIVED } = await import(`${ROOT}/src/scene/lived.ts`); LIVED.on = !!opts.env.lived; }   // (a recording made with the destruction switch on replays with it on: the roof rule, the dressing, the loud rules)
  if (opts.env) { const { applyEnvSettings } = await import(`${ROOT}/src/game/journal.ts`); applyEnvSettings(engine.settings, opts.env); if (typeof opts.env.glassFracture === 'boolean') engine.glassFracture = opts.env.glassFracture;   /* (the recording's renderer drew the glass fracture's cracks, or said it could not: glass.ts's star decal and glassBreakLive read it) */ if (opts.env.particlesOn) { engine.settings.gpuParticles = true; engine.setParticles = () => { engine.particles = fake('particles'); }; } }
  const smoke: any = standMod.nullSmoke();
  if (opts.env?.canister) smoke.params = { ...opts.env.canister };
  // the ONE stand-up (src/host/standup.ts): the level's boxes + lights into the stand-in, then `new Game`, then the harness trio — chaos 0 (the game byte for byte as it was before the
  // destruction lane, which is what every frozen digest and exact-count probe was written against), the autosave slots in a Map (no localStorage in bun), the level script strict
  const seed = opts.seed !== undefined ? opts.seed : process.env.TPS_SEED !== undefined && process.env.TPS_SEED !== '' ? envSeed(process.env.TPS_SEED) : null;
  const { game, level, cam } = await standMod.standGame(engine, { ch, smoke, harness: true, seed, ...(opts.level ? { level: opts.level } : {}) });
  if (process.env.QA_DOORSTAY === '1') (await import(`${ROOT}/src/game/doors.ts`)).DOORSTAY.on = true;   // (the harness stands the game up with the door closers of old — standup.ts; this runs any probe, soak or tour with doors staying where they are left, as shipped)
  const audioCounts = new Map<string, number>();
  let audioLog: AudioCall[] | null = null;
  game.audio = {
    play(n: string, pos: Vec3 | null, gain = 1, opts?: Record<string, unknown>) { audioCounts.set(n, (audioCounts.get(n) ?? 0) + 1); audioLog?.push({ name: n, pos: pos ? [pos[0], pos[1], pos[2]] : null, gain, opts, t: game.time }); },
    footstep(pos: Vec3, loudness: number, isPlayer: boolean, mat?: string) { audioCounts.set('footstep', (audioCounts.get('footstep') ?? 0) + 1); audioLog?.push({ name: 'footstep', pos: [pos[0], pos[1], pos[2]], gain: loudness, opts: { isPlayer, mat }, t: game.time }); },
  };
  const input: any = Input.detached(); input.mouseX = 800; input.mouseY = 500;   // (the real class minus its DOM listeners; the cursor where the harness always put it — the aim ray reads it)
  const canvas = { clientWidth: 1600, clientHeight: 1000, width: 1600, height: 1000 };
  cam.aspect = canvas.width / canvas.height; cam.rebuild();
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
