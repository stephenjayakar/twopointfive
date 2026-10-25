// The SESSION JOURNAL (the maintainer, 08-13: "could we make a record mode that journals all of the reads from the GPU for replay later? then we could have those
// scenarios for a strict mode QA of the deterministic stuff"). The simulation is deterministic GIVEN ITS INPUTS; this files the inputs. A recording is:
//
//   frame 0   a CHECKPOINT (savestate.ts saveState, kind 'harness') of the moment F10 went down — and the running game re-entered through loadState on the spot,
//             so the recorded game and any replay start from the same bytes by the same road (the checkpoints' identity claim, probes.ts checkpoint-identity:
//             load-into-the-same-game ≡ load-into-a-fresh-game); smoke in the air is dropped as on any load, a conversation is cut short, a searcher re-deals;
//   seed      Math.random ← mulberry32(seed) from that frame to the stop (the game's dice: barks, spread, reaction jitter — math/dice.ts simDie); the mixer and
//             the smoke solver draw the SYSTEM die (dice.ts sysRandom) so nothing but the simulation takes from the seeded stream — headless there is neither;
//   env       what the simulation reads off the ENGINE rather than the Game (the debris cap of the quality tier, the emissive scale, the torch bezel radius, whether
//             GPU particles are attached, the marking lights, the canister row) and the construction-time dice a checkpoint does not hold (the fixtures' restrike
//             stagger) — a replay stands its engine stand-in up to match;
//   knobs     Game.tune, the sandbox flags and every module knob table (AIM, NEEDS, WHISTLE …: kept per machine, so the maintainer's are not the harness's);
//   per frame dt exactly as Game.update got it · the canvas size · the CAMERA as the update read it (look-at, yaw, pitch, distance, aspect, fov: an input like the
//             mouse — the aim ray, WASD's basis, who is 'on screen' for a bubble all hang on it — so a follow-camera tweak invalidates no recording) · the input
//             (keys held, keys pressed, buttons, clicks, cursor, wheel) · every SENSOR value delivered (sensors.ts: the light meters, the smoke sight lines — the
//             GPU's part, journaled as consumed) — each stream delta-coded, so a still scene costs a dt a frame;
//   digests   digestGame (digest.ts) after every JOURNAL_DIGEST_EVERY-th update and after the last: a replay compares its own and names the field that differs.
//
// tools/qa/replay.ts plays a file back on the headless harness (fresh Game → loadState → seed → the frames fed through the synthetic input path with the sensors in
// replay mode) and exits 0 only if every digest agreed and no sensor read diverged: a REFACTOR must replay every session in tools/qa/sessions/ identically; an
// intended gameplay change is expected to diverge (re-record). This module is UI-free (main.ts owns F10, the HUD tag and the download: ui/sessionrec.ts); the
// recorder runs headless too (tools/qa/journal-probes.ts records its own fixture).
//
// NOT captured, by decision: the Tab panel's live edits mid-recording (hands off it while REC is up), module tables not in KNOB_TABLES, a level other than the
// one the replay builds (the file's fingerprint refuses it), the smoke solver's CPU-side facts (inSmokeDomain / budget — read only to decide whether to emit MORE
// smoke, never by the simulation), a lightning stroke's light alive across frame 0 (a fifth of a second, once a storm-minute).
import type { Game } from './game';
import { DESTRUCTION, FURNBLAST, RUBBLE, EVICT } from './destructionSwitch';
import { CASTOR } from './props';
import { LIVED } from '../scene/lived';
import { UNDERFOOT } from '../scene/collision';
import { ROUND } from '../scene/round';
import { cutConfig } from '../scene/cut';
import type { Input } from './input';
import type { FollowCamera } from './camera';
import { saveState, loadState, canSave, levelFingerprint } from './savestate';
import type { SaveState, TapeSlots } from './savestate';
import type { SensorJournal } from './sensors';
import { digestGame } from './digest';
import { simDie } from '../math/dice';
import type { SimDie } from '../math/dice';
import type { GameDigest } from './digest';
import { knobsNamed, assignDeep, JOURNAL_KNOBS } from './knobs';   // THE list of knob tables (knobs.ts): it imports the tables' modules in the order this file always did
import { WALLS, WALLS_DEFAULTS } from './wallbreak';
import { WALLCHARGE, WALLSHOT, WALLKILL } from './wallcharge';
import { CHAOS } from './destruction';   // (used inside applyKnobs only: src/game is one import cycle)
import { DOORTOOLS } from './doortools';
import { ORDERS } from './orders';
import { ROOMFIGHT } from './roomfight';
import { COVER } from './cover';
import { PAIR } from './pairorders';
import { SNEAK } from './sneak';
import { FURN } from './furnblast';
import { SNOWBOG } from './snowBog';
import { WX_OWN, SNOW, SNOW_LOOK } from './weatherKinds';
import { AIR_SIM } from './airSim';
import { GLASS } from './glass';
import { WALLPEN } from './wallpen';
import { LIGHTWALL } from './lighting';
import { IRLIGHT } from './irlight';
import { IR } from './irlaser';
import { AIRDUST } from './airDust';
import { FOG, FOG_EYES_WAS } from './fogofwar';
import { WALLSNAP } from './wallsnap';
import { UNSEEN } from './unseen';
import { FRAG } from './frag';
import { GUNWALL } from './gunwall';
import { REARWATCH } from './rearwatch';
import { CLOSE } from './close';
import { FOOTFALL, TWOGEARS, CROUCHRUN } from './player';
import { SAMLOOK } from './samlook';
import { STALK, stalkPolish } from './stalk';
import { TAPSTEP } from './tapstep';
import { KITANIM } from './kitanim';
import { WORK } from './workthings';
import { WAND } from './wand';
import { PEEKSIGHT } from './peeksight';
import { TAKEDOWN } from './takedown';
import { STEALTHPOSE } from './stealthpose';
import { STICKY } from './stickycam';
import { CUES } from './cues';
import { OWNCHARGE } from './owncharge';
import { GUNSLOTS } from './gunslots';
import { GUNLOOK } from './gunlook';
import { GUNROLES } from './gunroles';
import { KITTREE } from './kittree';
import { BIGSLOT, KITDEAL, ISSUE } from './kit';
import { SQUADTHROW } from './squadthrow';
import { SQUAD40 } from './squad40';
import { AUTOPILOT } from './autopilot';
import { CONDITION } from './condition';
import { INHAND } from './inhand';
import { GUNHAND } from './gunhand';
import { PACKSIDE } from './packside';
import { PLANLAY } from './planlay';
import { CMDRING } from './cmdring';
import { LANES } from './lanes';
import { HAULHOME } from './digin';
import { GUNHOLD } from './gunhold';
import { HOLD, THROW_BY, HARDBREATH, RUNREADY, holdPolish } from './character';
import { STACKROOM } from './stackroom';
import { START } from './startfile';
import { HOLDFIRE } from './holdfire';
import { SILENT } from './silent';
import { SAMESTART } from './samestart';
import { TAKE } from './takecheck';
import { QUIETFOG } from './quietfog';
import { TOLD } from './told';
import { TORCH } from './calmtorch';
import { BACKKEY } from './backkey';
import { MORALE } from './morale';
import { RUNNER } from './runner';
import { STARTLE } from './startle';
import { ROWSET } from './rowset';
import { SMOKEBREAK } from './smokebreak';
import { SHOWWHY } from './showwhy';
import { FIRE, FIRE_LEAN_WAS, FIRE_STEPS } from './fire';
import { FLINCH } from './flinch';
import { DARKDOOR } from './darkdoor';
import { DARKFOE } from './darkfoe';
import { POWEROUT } from './powerout';
import { SQUADDEAL } from './squaddeal';
import { STAYASK } from './stayask';
import { KITLOAD } from './kitload';
import { RESCUECHECK } from './rescuecheck';
import { RESCUEEND } from './rescueend';
import { SNATCHOUT } from './snatchout';
import { RESCUEFLUSH } from './rescueflush';
import { EXACT } from '../math/exact';
import { SENSE } from './sense';
import { CMDCHECK } from './cmd';
import { DOZE } from './doze';
import { NETQUIET } from './netquiet';
import { ATTENTION } from './attention';
import { PICTURE } from './picture';
import { RESPONSE } from './qrf';
import { RELOAD } from './autoreload';
import { SAMSTUN } from './samstun';
import { SEENWALK } from './seenwalk';
import { TEAMTALLY } from './teamtally';
import { VERDICT } from './verdict';   // (used inside applyKnobs only: src/game is one import cycle)
import { AIMWEIGHT } from './aimweight';
import { AIM } from './aim';   // (used inside applyKnobs only: src/game is one import cycle)
import { SPRINTDOOR } from './sprintdoor';
import { TEAMPACE } from './teampace';
import { NOSHOVE } from './noshove';
import { RAILS } from './rails';
import { DOORFORCE } from './doorforce';
import { SLOTSETUP } from './slotsetup';
import { GLASSREAL } from './glassbreak';
import { AIMCOST } from './aimcost';
import { QUICKTHROW } from './quickthrow';
import { FRIENDS } from './friends';
import { FRIENDLYFIRE } from './friendlyfire';
import { LIGHTSWITCH } from './lightswitch';
import { CARLAMPS } from './carlamps';
import { CLEANRESTART } from './cleanrestart';
import { FIRELINE } from './fireline';
import { SAVETIMELINE } from './savestate';
import { HANDSLOT } from './handslot';
import { HANDRING } from './handring';
import { THROWBACK } from './throwback';
import { AUTOCAM, autoTuneOld } from '../host/autocam';
import { OWNBLOW } from './ownblow';
import { WORKSTOW } from './workstow';
import { SQUADNET } from './squadnet';
import { WALLREACT } from './wallreact';
import { COVERFIRE } from './coverfire';
import { DOORWAY, DOORSTAY, DOORTHROW } from './doors';
import { GUARD_EYE, LIGHTS } from './guards';
import { PRESSURE } from './pressure';
import { HARD } from './difficulty';
import { DOORBLAST, DOORSHOT } from './doorblast';
import { WINBARS } from './winbars';
import { HANDLE } from './handleside';
import { DOORMANNERS } from './doorway';
import { GEAR } from './gear';
import { WORDS } from './words';

export const JOURNAL_VERSION = 1;
/** …and what a file says when a replay cannot do without what came after v1: a slot's text filed at the frame an update read it (`slots.loads`), a last frame
 *  no replay can follow (`meta.lost`). A build from before them refuses such a file by its version instead of replaying it into a break of its own; every other
 *  file still says 1 and is read by any build. */
export const JOURNAL_VERSION_SLOTS = 2;
/** a digest after every this-many-th update (and after the last) */
export const JOURNAL_DIGEST_EVERY = 120;
/** a recording asked for while it cannot start (Sam mid-action, a can in the air, a body falling) waits this many frames for the moment, then gives up with the reason */
export const JOURNAL_PENDING_FRAMES = 60 * 8;
/** the longest recording (frames): twenty minutes at sixty */
export const JOURNAL_MAX_FRAMES = 60 * 60 * 20;

/** the module knob tables a recording carries and a replay applies (kept per machine or flipped on the panel: the maintainer's values are not the harness's) */
/** the knob tables a recording captures — LAZY: journal.ts sits on the game.ts ↔ guards.ts import cycle, and the browser bundle hoists module bindings, so an eager object
 *  literal here captured `undefined` for tables whose module had not initialised yet (the recorder threw on its first page frame; headless import order hid it) */
export function knobTables(): Record<string, object> { return knobsNamed(JOURNAL_KNOBS); }
// (the tables themselves, and why each is in a recording, are knobs.ts's now — GLASSBREAK: rounds, sound and men pass through its holes, gameplay, while the dust table is
//  presentation and stays out; DOORSTAY: whether any leaf has a closer is gameplay for everyone who walks, looks or listens through a doorway; HANDLE: where a man stands to
//  open a door — it only runs with DOORWAY.oneWay on, so a recording from before either replays as it was; DOORMANNERS: who waits for whom at a frame, both sides of a squad map)

// ================================================================================================================================ the file
/** one frame's input as filed: k = the keys held (the whole set, only when it changed), p = keys pressed this frame, c = mouse buttons clicked this frame (bits),
 *  b = buttons held (on change), m = the cursor in CSS px (on change), w = wheel travel (when non-zero) — absent = unchanged (k / b / m) or nothing (p / c / w) */
export interface InputRec { k?: string[]; p?: string[]; c?: number; b?: number; m?: [number, number]; w?: number; }
/** the engine-side facts the simulation reads (see the head) + the fixtures' restrike stagger by target name */
export interface EnvSnap { debrisCap: number; emissiveScale: number; flashlightRadius: number; markings: boolean; particlesOn: boolean;
  /** recorded under the game page's HUD (main.ts): its speech bubbles null an expired `bubble` after each update (hudExpireBubbles) — a replay of such a file does the same; a headless recording has no HUD */
  hud: boolean;
  /** HostApi.glassFracture where the recording's engine said either way (the page: were its shaders compiled with the fracture's cracks; native: false): glass.ts files a pane's star decal — which the digest counts — only where the renderer does NOT draw the fracture's own cracks, so a replay must stand on the same answer. Absent = the engine did not say (the headless stub; every file from before the new glass) */
  glassFracture?: boolean;
  /** scene/cut.ts cutConfig.on as the recording ran (absent = off): rayBox / lineBox answer a box's CUT solid only under it — the harness raises it before its BoxWorld exists */
  cutBoxes?: boolean;
  canister: { canisterDuration: number; canisterDensity: number; canisterRadius: number; canisterTemp: number; canisterSpeed: number } | null; stagger: Record<string, number>;
  /** game/destructionSwitch.ts as the recording ran (absent in files from before it = off): the level's dressing, the roof rule, the loud rules under a scenario */
  destruction?: { on: boolean };
  /** scene/lived.ts as the recording ran (absent = off): the level was loaded with its lived-in rooms' furniture, so a replay loads it the same way */
  lived?: boolean; }
export interface KnobsSnap { tune: Record<string, unknown>; flags: { godMode: boolean; aiEnabled: boolean; infiniteAmmo: boolean; playerInvisible: boolean; fn2000: boolean; autosave: boolean; fog?: boolean; stalkAmbient?: boolean; roundCap?: number; behindSam?: boolean; tossMate?: boolean }; tables: Record<string, unknown>; }
/** the whole session (JSON): see the head for what each block is */
export interface SessionFile {
  v: number; game: 'twopointsix'; recordedAt: string; commit?: string; note?: string;
  seed: number; level: SaveState['level']; save: SaveState; env: EnvSnap; knobs: KnobsSnap;
  frames: number;
  /** dt per frame, run-length coded: [count, dt] pairs */
  dt: [number, number][];
  /** the canvas: [f, clientWidth, clientHeight, width, height] on change */
  view: number[][];
  /** the camera as Game.update read it: [f, mask, values…] on change — mask bits 0‥7 = look-at x / y / z, yaw, pitch, distance, aspect, fov */
  cam: number[][];
  /** [f, InputRec] for every frame on which anything was pressed / clicked / moved / changed */
  input: [number, InputRec][];
  sensors: SensorJournal;
  /** the checkpoint store as the recording found it at its frame 0 (the index rows, the autosave inside its regret window) and, as [f, key, text], each slot
   *  of those that an update read — SessionRecorder.slotRead. Absent: nothing was stored (or a file from before the block) */
  slots?: TapeSlots & { loads: [number, string, string][] };
  /** [f, digest] after the update of frame f */
  digests: [number, GameDigest][];
  meta: { seconds: number; stopped: string; bytesPerFrame?: number; userAgent?: string; /** finished between two frames: the closing digest is of the state after the HUD's write of the last one (a replay of a page recording makes that write before it compares) */ between?: boolean; /** ended by a load no replay can make (SessionRecorder.cut, `lost`): the last frame is that load's, filed whole, and a replay plays to the frame before it */ lost?: boolean };
}
export type JournalState = 'idle' | 'pending' | 'recording';
type View = { clientWidth: number; clientHeight: number; width: number; height: number };

// ================================================================================================================================ env / knobs (both directions)
export function envSnapshot(g: Game): EnvSnap {
  const S = g.engine.settings as unknown as Record<string, unknown>; const num = (k: string, d: number) => typeof S[k] === 'number' && Number.isFinite(S[k] as number) ? S[k] as number : d;
  const E = g.engine as unknown as { particles?: unknown; glassFracture?: unknown; settings: { gpuParticles?: boolean } };
  const P = (g.smoke as { params?: Record<string, number> }).params;
  const stagger: Record<string, number> = {}; for (const t of g.targets) stagger[t.name] = t.stagger;
  return { debrisCap: num('debrisCap', 64), emissiveScale: num('emissiveScale', 1), flashlightRadius: num('flashlightRadius', 0.07), markings: S.markings !== false, particlesOn: !!(E.particles && E.settings.gpuParticles), hud: false, ...(typeof E.glassFracture === 'boolean' ? { glassFracture: E.glassFracture } : {}),
    canister: P ? { canisterDuration: P.canisterDuration, canisterDensity: P.canisterDensity, canisterRadius: P.canisterRadius, canisterTemp: P.canisterTemp, canisterSpeed: P.canisterSpeed } : null, stagger, ...(DESTRUCTION.on ? { destruction: { on: true } } : {}), ...(LIVED.on ? { lived: true } : {}), ...(cutConfig.on ? { cutBoxes: true } : {}) };
}
/** the settings half of an env, onto an engine's settings BEFORE the Game is built on it (the marking lights are registered in the constructor) */
export function applyEnvSettings(settings: Record<string, unknown>, env: EnvSnap): void { settings.debrisCap = env.debrisCap; settings.emissiveScale = env.emissiveScale; settings.flashlightRadius = env.flashlightRadius; settings.markings = env.markings; }
/** the game half of an env, AFTER the checkpoint is loaded: the fixtures' restrike stagger */
export function applyEnvGame(g: Game, env: EnvSnap): void { for (const t of g.targets) { const s = env.stagger[t.name]; if (typeof s === 'number' && Number.isFinite(s)) t.stagger = s; } }
export function knobsSnapshot(g: Game): KnobsSnap {
  const tables: Record<string, unknown> = {}; for (const [k, T] of Object.entries(knobTables())) tables[k] = JSON.parse(JSON.stringify(T));
  return { tune: JSON.parse(JSON.stringify(g.tune)), flags: { godMode: g.godMode, aiEnabled: g.aiEnabled, infiniteAmmo: g.infiniteAmmo, playerInvisible: g.playerInvisible, fn2000: g.fn2000, autosave: !!g.saves?.enabled, fog: !!g.fogOfWar?.on, stalkAmbient: SNEAK.stalkAmbient, roundCap: ORDERS.roundCap, behindSam: DOORTOOLS.behindSam, tossMate: DOORTOOLS.tossMate }, tables };   // (autosave: the controller writes chronicle rows — state, even if the digest leaves them out)
}
export function applyKnobs(g: Game, k: KnobsSnap): void {
  assignDeep(g.tune as unknown as Record<string, unknown>, k.tune);
  if (typeof k.tune.qrfSquad !== 'boolean') g.tune.qrfSquad = false;   // (a recording from before the response team took a room by the squad's own code — no such key in its tune: its element ran its own drill)
  g.godMode = !!k.flags.godMode; g.aiEnabled = k.flags.aiEnabled !== false; g.infiniteAmmo = !!k.flags.infiniteAmmo; g.playerInvisible = !!k.flags.playerInvisible; if (typeof k.flags.fn2000 === 'boolean' && g.fn2000 !== k.flags.fn2000) g.setLoadout(k.flags.fn2000);
  if (g.fogOfWar) g.fogOfWar.on = !!k.flags.fog;   // (the fog of war asks the sensors and bends say() / the reticle: a recording made under it replays under it — a file from before it has no flag = off)
  if (g.saves && typeof k.flags.autosave === 'boolean') g.saves.enabled = k.flags.autosave;   // (the field, not setEnabled: nothing to persist on a replay's machine)
  if (!(k.tables.DOORWAY && typeof (k.tables.DOORWAY as Record<string, unknown>).frameHolds === 'boolean')) DOORWAY.frameHolds = false;   // (a recording from before a frame held a boot — its DOORWAY row has no such key — replays without the rule, whatever this process had on)
  if (typeof (k.tables.CLOSE as { heldClicks?: boolean } | undefined)?.heldClicks !== 'boolean') CLOSE.heldClicks = false;   // (a recording from before a click did anything in the arm hold — its CLOSE row has no such key — replays with both buttons dead there)
  if (typeof (k.tables.CLOSE as { handsLow?: boolean } | undefined)?.handsLow !== 'boolean') CLOSE.handsLow = false;   // (a recording from before his hands stayed low at the crouch: the grab's tell reached from there too)
  if (typeof (k.tables.CLOSE as { noKnife?: boolean } | undefined)?.noKnife !== 'boolean') CLOSE.noKnife = false;   // (a recording from before the knife went: the left click was its blow)
  if (typeof (k.tables.CLOSE as { rmbHold?: boolean } | undefined)?.rmbHold !== 'boolean') CLOSE.rmbHold = false;   // (a recording from before the right button was tapped or held: its press was the knockout)
  if (typeof (k.tables.CLOSE as { reachUp?: boolean } | undefined)?.reachUp !== 'boolean') CLOSE.reachUp = false;   // (a recording from before the grab's reach went up: the tell's pose as it was)
  if (typeof (k.tables.GUARD_EYE as { far?: boolean } | undefined)?.far !== 'boolean') GUARD_EYE.far = false;   // (a recording from before a lit man was seen past the eye's 16 m — its GUARD_EYE row has no such key — replays with every eye stopping there, whatever this process had on)
  if (typeof (k.tables.GUARD_EYE as { farCalm?: boolean } | undefined)?.farCalm !== 'boolean') GUARD_EYE.farCalm = false;   // (…nor has one from before a far glimpse stopped being a place to walk to: it replays with every glimpse writing his fix, as that build did)
  if (!k.tables.TEAMTALLY) TEAMTALLY.on = false;   // (a recording from before a partner's men were on the card replays with them on nobody's)
  if ((k.tables.VERDICT as Partial<typeof VERDICT> | undefined)?.loudCard === undefined) VERDICT.loudCard = false;   // (a recording from before a loud mission stopped being graded as a sneak: its end lines said the rating)
  if (!k.tables.DOORSTAY) DOORSTAY.on = false;   // (a recording from before the switch was made with the closers on every leaf: it replays with them)
  if ((k.tables.DOORWAY as { exitsOut?: boolean } | undefined)?.exitsOut === undefined) DOORWAY.exitsOut = false;   // (…and one from before outside doors opened outward had them dealt by the room rules: Door.swing reads the switch live)
  if (!k.tables.DOORBLAST) DOORBLAST.on = false; if (!k.tables.HANDLE) HANDLE.on = false; if (!k.tables.DOORMANNERS) DOORMANNERS.on = false;   // (likewise the other door switches: a file from before one of them replays without it, whatever the last file in this process left on)
  if ((k.tables.HANDLE as Partial<typeof HANDLE> | undefined)?.toolNear === undefined) HANDLE.toolNear = false;   // (…and one from before a door order's lead worked the handle from past the latch jamb: he walked to the handle's place in front of the opening)
  if (typeof (k.tables.DOORMANNERS as { backOn?: boolean } | undefined)?.backOn !== 'boolean') DOORMANNERS.backOn = false;   // (… nor from before a man pushed off his mark stepped back onto it)
  if (typeof (k.tables.DOORMANNERS as { offFurniture?: boolean } | undefined)?.offFurniture !== 'boolean') DOORMANNERS.offFurniture = false;   // (… nor from before its places kept off the furniture)
  if (typeof (k.tables.DOORMANNERS as { ownLeaf?: boolean } | undefined)?.ownLeaf !== 'boolean') { DOORMANNERS.ownLeaf = false; DOORMANNERS.ownMark = false; }   // (a recording from before a stack was dealt past the door's own open leaf, or a stacked man kept his mark with Sam beside it — no such keys in its row: there both were refused 'no room on that door')
  if (typeof (k.tables.DOORMANNERS as { stackCover?: boolean } | undefined)?.stackCover !== 'boolean') DOORMANNERS.stackCover = false;   // (a recording from before a stack was covered against an open door looking down it — its DOORMANNERS row has no such key — had every man walk straight to his mark)
  { const s = (k.tables.HARD as { sweep?: boolean } | undefined)?.sweep; if (typeof s !== 'boolean') HARD.sweep = false; if (s !== true) PRESSURE.sweep = false; }   // (a recording from before hard's defenders went to look — it carries no HARD row, or one with no such key — replays with every man holding where the noise left him. The switch lives on HARD: PRESSURE is hard's copy of it and no recording carries that table, so the copy is only ever taken DOWN here; a recording that has the row on replays on the difficulty of the page it is played on, as every HARD row does)
  if (typeof (k.tables.DOORMANNERS as { stepCover?: boolean } | undefined)?.stepCover !== 'boolean') DOORMANNERS.stepCover = false;   // (… nor from before a defender stepping off a doorway asked what a rifle at his man reaches: he stepped back on the face away from them whatever was there)
  if (typeof (k.tables.DOORMANNERS as { ownPlace?: boolean } | undefined)?.ownPlace !== 'boolean') DOORMANNERS.ownPlace = false;   // (… nor from before a man on his own mark by a door was walked round: he was walked into)
  if (typeof (k.tables.DOORMANNERS as { leafRound?: boolean } | undefined)?.leafRound !== 'boolean') DOORMANNERS.leafRound = false;   // (… nor from before a teammate went round a leaf standing open across his walk: it turned shut under him)
  for (const [name, T] of Object.entries(knobTables())) { const src = k.tables[name]; if (src && typeof src === 'object') assignDeep(T as Record<string, unknown>, src as Record<string, unknown>); }
  if (typeof (k.tables.MOVES as { snap?: number } | undefined)?.snap !== 'number') { const M = knobTables().MOVES as { snap?: number } | undefined; if (M) M.snap = 0; }   // (a recording from before the pistol's carry and aim traded — its MOVES row has no such key — replays with the two layers on their old clocks)
  if (typeof (k.tables.MOVES as { steady?: number } | undefined)?.steady !== 'number') { const M = knobTables().MOVES as { steady?: number } | undefined; if (M) M.steady = 0; }   // (likewise a recording from before the crouch walk was carried level replays with the cycle as it was: rounds leave the drawn muzzle)
  if (typeof (k.tables.MOVES as { steadyRun?: number } | undefined)?.steadyRun !== 'number') { const M = knobTables().MOVES as { steadyRun?: number } | undefined; if (M) M.steadyRun = 0; }   // (…and from before the rifle sprint's side roll was taken out — no such key in its MOVES row — replays with the trunk rolling as it was recorded: his head and chest bones are what eyes look for)
  if (!k.tables.WALLREACT) WALLREACT.on = false; if (!k.tables.COVERFIRE) COVERFIRE.on = false;   // (…and from before the men reacted to what breaks / aimed fire chewed cover: all three ride the destruction's switch, off in such a file anyway)
  if ((k.tables.WALLREACT as { blastFlood?: boolean } | undefined)?.blastFlood === undefined) WALLREACT.blastFlood = false;   // (…and from before the rows of one blast were flooded as one: wallreact.ts blastFlood)
  if ((k.tables.WALLREACT as { everyGone?: boolean } | undefined)?.everyGone === undefined) WALLREACT.everyGone = false;   // (a file from before a man was asked about every thing that went, not the newest row alone: wallreact.ts everyGone)
  if (!k.tables.CASTOR) CASTOR.on = false;   // (a file from before office chairs rolled on their castors)
  if (!k.tables.FURNBLAST) FURNBLAST.on = false;   // (a file from before a blast reached the furniture)
  if (!k.tables.RUBBLE) RUBBLE.on = false;   // (a file from before boots moved rubble)
  if (!k.tables.EVICT) EVICT.on = false;   // (…and from before an eviction took the smallest piece and left chips by its size: the oldest, as it was recorded)
  { const fr = k.tables.FRAG as Partial<typeof FRAG> | undefined; if (!fr || fr.samStun === undefined) FRAG.samStun = false; }   // (a file from before a burst stunned the player: his trigger was free straight after one)
  { const fr = k.tables.FRAG as Partial<typeof FRAG> | undefined; if (!fr || fr.doorStun === undefined) FRAG.doorStun = false; }   // (a file from before a burst that takes a door off stunned the men behind it, and before a door it would take stopped being cover to a man reckoning his own)
  { const fr = k.tables.FRAG as Partial<typeof FRAG> | undefined; if (!fr || fr.fleeWise === undefined) FRAG.fleeWise = false; }   // (a file from before a man judged a live grenade by where it would rest: his leg was scored by its end alone, from where the grenade was)
  { const fr = k.tables.FRAG as Partial<typeof FRAG> | undefined; if (!fr || fr.wallStun === undefined) FRAG.wallStun = false; }   // (a file from before a burst that holes a wall or breaks cover stunned the men behind it: they were judged through the hole)
  { const fr = k.tables.FRAG as Partial<typeof FRAG> | undefined; if (!fr || fr.restProps === undefined) FRAG.restProps = false; if (!fr || fr.fleeApart === undefined) FRAG.fleeApart = false; if (!fr || fr.fleeOnto === undefined) FRAG.fleeOnto = false; if (!fr || fr.fleeSam === undefined) FRAG.fleeSam = false; if (!fr || fr.fleeLook === undefined) FRAG.fleeLook = false; if (!fr || fr.fleeDoor === undefined) FRAG.fleeDoor = false; if (!fr || fr.wallFlee === undefined) FRAG.wallFlee = false; if (!fr || fr.downKill === undefined) FRAG.downKill = false; }   // (a file from before the rest guess flew off loose furniture, and before a leg kept clear of a mate's corner)
  if (!k.tables.WALLSNAP) WALLSNAP.on = false;   // (a file from before the wall hold's feel pass: its takes ran the old clock and its rifle was slung for the wall)
  else { const ws = k.tables.WALLSNAP as Partial<typeof WALLSNAP>; if (ws.alongDeg === undefined) WALLSNAP.alongDeg = 0; if (ws.stackDraw === undefined) WALLSNAP.stackDraw = false; if (ws.pose === undefined) WALLSNAP.pose = false; if (ws.press === undefined) WALLSNAP.press = false; if (ws.voice === undefined) WALLSNAP.voice = false; if (ws.slow === undefined) WALLSNAP.slow = false; if (ws.leanGun === undefined) WALLSNAP.leanGun = 0; }   // (…and one from before 10-10's two rules: the stick's along / away as it was, the rifle drawn on the wall waiting for the step off)
  { const rw = k.tables.REARWATCH as Partial<typeof REARWATCH> | undefined; if (rw && rw.roomLast === undefined) REARWATCH.roomLast = false; }   // (a file from before a room keeper waited for the men on their way out of the room: freed the moment they had come by him)
  if (!k.tables.GUNWALL) GUNWALL.on = false;   // (a file from before a raised gun came down at a wall: its men kept theirs up, and fired or did not by that)
  if ((k.tables.WORDS as Partial<typeof WORDS> | undefined)?.doors === undefined) WORDS.doors = false;   // (a file from before a level could name its own doors: every door called what it was)
  if ((k.tables.WORDS as Partial<typeof WORDS> | undefined)?.guide === undefined) WORDS.guide = false;   // (a file from before the writing guide read the spoken lines: every bubble as it was said, and as long)
  if ((k.tables.WORDS as Partial<typeof WORDS> | undefined)?.radioHome === undefined) WORDS.radioHome = false;   // (a file from before the handler kept to the office: she speaks wherever she spoke)
  if (!k.tables.CMDRING) CMDRING.on = false;   // (a file from before the orders ring: its key was nobody's)
  if (typeof (k.tables.CMDRING as { hint?: boolean } | undefined)?.hint !== 'boolean') CMDRING.hint = false;   // (… and one from before its hint: nothing drawn at the cursor before the key)
  if (typeof (k.tables.CMDRING as { hands?: boolean } | undefined)?.hands !== 'boolean') CMDRING.hands = false;   // (… and from before Space was a ring too: the list as it was)
  if (typeof (k.tables.CMDRING as { plan?: boolean } | undefined)?.plan !== 'boolean') CMDRING.plan = false;   // (… and from before plan mode: Shift and the key were nobody's)
  if (typeof (k.tables.CMDRING as { holdSecs?: number } | undefined)?.holdSecs !== 'number') CMDRING.holdSecs = 0;   // (… and from before a tap opened no ring: the ring went up as the key went down)
  if (typeof (k.tables.CMDRING as { planRts?: boolean } | undefined)?.planRts !== 'boolean') CMDRING.planRts = false;   // (… and from before that mode parked him: he walked with it up, and a right click ordered as it went down)
  if (typeof (k.tables.CMDRING as { stay?: boolean } | undefined)?.stay !== 'boolean') CMDRING.stay = false;   // (… and from before the ring stayed up without its key: it went with the key, given as the key came up)
  if (typeof (k.tables.CMDRING as { stayDigit?: boolean } | undefined)?.stayDigit !== 'boolean') CMDRING.stayDigit = false;   // (… and from before a digit inside the key's press was the ring's: until the hold was over it was the gun's)
  if (typeof (k.tables.CMDRING as { pin?: boolean } | undefined)?.pin !== 'boolean') CMDRING.pin = false;   // (… and from before the ring stayed on its point: it stood where it was opened on the screen)
  if (typeof (k.tables.CMDRING as { tapNow?: boolean } | undefined)?.tapNow !== 'boolean') CMDRING.tapNow = false;   // (… and from before a press already up in its own tick was given on that tick: it was given on the next)
  if (typeof (k.tables.CMDRING as { planRun?: boolean } | undefined)?.planRun !== 'boolean') CMDRING.planRun = false;   // (… and from before a sprint's Shift was not the mode's: Shift + the key was always the mode's)
  if (typeof (k.tables.CMDRING as { only?: boolean } | undefined)?.only !== 'boolean') CMDRING.only = false;   // (… and from before the ring carried every order: its wedges were the rows on digits, the letters worked beside it)
  for (const key of ['planLook', 'planWaits', 'planKnee', 'planOne', 'planNear', 'planDigits', 'wholeSquad', 'planClear', 'planNearFlat'] as const) if (typeof (k.tables.CMDRING as Record<string, unknown> | undefined)?.[key] !== 'boolean') CMDRING[key] = false;   // (… and from before plan mode's right drag, its own waits and the knee at the radio: a right press was a click or the ring, the pauses were the build's, he stood)
  for (const key of ['flat', 'plainHint', 'bareHint', 'wheelIdle'] as const) if (typeof (k.tables.CMDRING as Record<string, unknown> | undefined)?.[key] !== 'boolean') CMDRING[key] = false;   // (… and from before the flat tree, the outline with no glyph and the squad's corner down to its keys: the menu's pages, the glyph, the block)
  if (!k.tables.WORDS) WORDS.on = false;   // (a file from before the dialogue pass: every line as it was said, and as long)
  if (!k.tables.GEAR) GEAR.on = false;   // (a file from before the 2010s issue kit: the kit it was recorded in — words and picture only, kept with the rest)
  if (!k.tables.KITANIM) KITANIM.on = false;   // (a file from before the kit animations: its draws were instant and its reloads the row's one beat)
  if (!k.tables.THROW_BY) THROW_BY.on = false;   // (a file from before a throw read its distance: every throw in it was the one overhand, and that body is what its guards saw)
  if (typeof (k.tables.FOG as { things?: boolean } | undefined)?.things !== 'boolean') FOG.things = false;   // (a file from before nothing moved in the fog: its cursor's ray met the game's own list of loose things)
  if (typeof (k.tables.FOG as { flat?: number } | undefined)?.flat !== 'number') FOG.flat = 0;   // (a file from before the fog had its own light: its fog was the live frame dimmed)
  if (typeof (k.tables.FOG as { lit?: number } | undefined)?.lit !== 'number') FOG.lit = 0;   // (a file from before the fog was lit as the team last knew it: its fog was the one fixed light, or the live frame dimmed)
  if (typeof (k.tables.FOG as { full?: boolean } | undefined)?.full !== 'boolean') FOG.full = false;   // (a file from before the fog got the full picture: its fog was the lit one, the fixed light, or the live frame dimmed with every light in it)
  if (typeof (k.tables.FOG as { air?: boolean } | undefined)?.air !== 'boolean') FOG.air = false;   // (a file from before smoke was drawn under the fog: its picture took no smoke over floor nobody saw)
  if (typeof (k.tables.FOG as { ours?: boolean } | undefined)?.ours !== 'boolean') FOG.ours = false;   // (a file from before what the team does was always shown: its blasts' flashes lit only what the team saw, its tracers and sparks were cut there)
  if (typeof (k.tables.FOG as { thin?: boolean } | undefined)?.thin !== 'boolean') FOG.thin = false;   // (a file from before thin things that stand free stopped cutting the fog's sight: every static stopped the squad's eye and the picture's)
  if (typeof (k.tables.FOG as { tracks?: boolean } | undefined)?.tracks !== 'boolean') FOG.tracks = false;   // (a file from before a man nobody sees left his tracks in the snow: hidden, he pressed nothing)
  if (typeof (k.tables.FOG as { filed?: boolean } | undefined)?.filed !== 'boolean') FOG.filed = false;   // (a file from before a checkpoint carried what the fog holds: a load's picture had every door, lamp and chair as it stands)
  if (typeof (k.tables.FOG as { kept?: boolean } | undefined)?.kept !== 'boolean') FOG.kept = false;   // (a file from before what others left behind stayed as last seen in the fog's picture: a lamp's face followed the real lamp, litter at rest was cut out of sight)
  if (typeof (k.tables.FOG as { eyes?: number } | undefined)?.eyes !== 'number') FOG.eyes = FOG_EYES_WAS;   // (a file from before more than five eyes lifted the fog: a squad of four left a camera's feed no place)
  if (typeof (k.tables.FOG as { edge?: number } | undefined)?.edge !== 'number') FOG.edge = 0;   // (a file from before the fog's edge was soft: its fog ended on a hard line)
  if (typeof (k.tables.FOG as { squadDoors?: boolean } | undefined)?.squadDoors !== 'boolean') FOG.squadDoors = false;   // (a file from before a door the squad works was seen: its leaves stood as the eyes last had them)
  if (typeof (k.tables.FOG as { squadFire?: boolean } | undefined)?.squadFire !== 'boolean') FOG.squadFire = false;   // (a file from before a man the squad shoots at was in the picture: the reticle took only the men the fog's eyes had)
  if (typeof (k.tables.HOLD as { dropGun?: boolean } | undefined)?.dropGun !== 'boolean') HOLD.dropGun = false;   // (a file from before a held man dropped his gun: its men kept it in the fist through the hold)
  if (typeof (k.tables.HOLD as { strip?: { fall?: number } } | undefined)?.strip?.fall !== 'number') HOLD.strip.fall = 0;   // (a file from before the stripped gun's fall was timed: thrown down at the fixed push, wherever that landed it)
  if (typeof (k.tables.HOLD as { disarm?: boolean } | undefined)?.disarm !== 'boolean') HOLD.disarm = false;   // (a file from before the grab disarmed him: the gun left his hand on the grab's first frame, thrown clear)
  if (typeof (k.tables.HOLD as { stripFirst?: boolean } | undefined)?.stripFirst !== 'boolean') HOLD.stripFirst = false;   // (a file from before the disarm led: the take and the arm at once)
  if (typeof (k.tables.HOLD as { oneFacing?: boolean } | undefined)?.oneFacing !== 'boolean') HOLD.oneFacing = false;   // (a file from before a held man kept the hold's facing: a calm defender in the arm was turned to his mark each frame)
  if (typeof (k.tables.HOLD as { wayShape?: boolean } | undefined)?.wayShape !== 'boolean') holdPolish(false);   // (a file from before the stalk's fourth pass: the way in was the whole reach at a part weight, no spring before the lunge, no sway and no room between the heads in the hold, and he arched further into the haul — the head's bone is what ears and eyes are read at)
  if (!k.tables.GUNHOLD) GUNHOLD.on = false;   // (a file from before the pistol in a hold sent men to cover: its men walked the ring in the open and held every round)
  if (!k.tables.HAULHOME) HAULHOME.on = false;   // (a file from before a hauling man brought his furniture the last hand to the door: its men gave it up the frame they stopped)
  if (!k.tables.LANES) LANES.on = false;   // (a file from before defenders remembered a lane that cost them: its men walked the short way whatever it had cost)
  else if ((k.tables.LANES as Partial<typeof LANES>).pin === undefined) LANES.pin = false;   // (…and one from before a lane was held at two angles with fire: nobody set on its other side, nobody fired from a corner)
  if (k.tables.LANES) { const was = k.tables.LANES as Partial<typeof LANES>;   // (…and from before a lane knew its gun, where its men may stop, and which rounds a man noticed: each key it lacks is off)
    if (was.glass === undefined) LANES.glass = false; if (was.stopClear === undefined) LANES.stopClear = false; if (was.roused === undefined) LANES.roused = false;
    if (was.frag === undefined) LANES.frag = false; if (was.fragOwn === undefined) LANES.fragOwn = false;
    if (was.drill === undefined) LANES.drill = false; }   // (…and from before a man held on a lane threw his grenade down it: he never did — nor was he kept his own through its wind-up, nor was a man the doorway drill had taken asked again)
  if (!k.tables.OWNCHARGE) OWNCHARGE.on = false;   // (a file from before the player's own charges: his card had no charge rows, no door offered 'set a charge')
  if (!k.tables.GUNSLOTS) GUNSLOTS.on = false;   // (a file from before the two gun slots: a card had one gun row and a teammate one gun)
  else if ((k.tables.GUNSLOTS as Partial<typeof GUNSLOTS>).heard === undefined) GUNSLOTS.heard = false;   // (…and from before a teammate's quiet round was heard: it reached nobody)
  if (k.tables.GUNSLOTS && (k.tables.GUNSLOTS as Partial<typeof GUNSLOTS>).bare === undefined) GUNSLOTS.bare = false;   // (…and from before a bare carbine was the same gun: it was the AKS-74U row)
  if (!k.tables.KITTREE) KITTREE.on = false;   // (a file from before the gear screen was a tree: your guns wore their suppressors, your light and goggles were not a card's, and every launcher had its five sponge rounds)
  if (!k.tables.GUNLOOK) GUNLOOK.on = false;   // (a file from before each gun had its own look: every row was its stand-in — its muzzle, its flash and its reload's beats the stand-in's)
  else if ((k.tables.GUNLOOK as Partial<typeof GUNLOOK>).shells === undefined) GUNLOOK.shells = false;   // (…or from before a tube gun was fed by the shell: its reload was the row's one length, the tube booked at its end)
  if (!k.tables.GUNROLES) GUNROLES.on = false;   // (a file from before the defenders drew from the table: every one of them carried the short carbine, and no stack, entry or trigger read a man's gun)
  else if ((k.tables.GUNROLES as Partial<typeof GUNROLES>).captor === undefined) GUNROLES.captor = true;   // (…or from the day the man with a hostage in his hand was dealt a pistol with the rest: the key did not exist and he was)
  if (!k.tables.BIGSLOT) BIGSLOT.on = false;   // (a file from before the big slot: the shotgun was a man's gun, a wall charge was pouches, nobody carried a hammer)
  else { const was = k.tables.BIGSLOT as Partial<typeof BIGSLOT>; if (was.shut === undefined) BIGSLOT.shut = false; if (was.beside === undefined) BIGSLOT.beside = false; if (was.moves === undefined) BIGSLOT.moves = false; if (was.snug === undefined) BIGSLOT.snug = false; if (was.weight === undefined) BIGSLOT.weight = false; }   // (…and one from before its tools opened an unlocked door, from beside the frame: a lock only, from where he stood)
  if (!k.tables.KITDEAL) KITDEAL.on = false;   // (a file from before the squad's kit was dealt over the men who come: the cards of three or four were the pair's, the others' pouches empty)
  else if ((k.tables.KITDEAL as Partial<typeof KITDEAL>).more === undefined) KITDEAL.more = false;   // (…and from before a team of three or four as issued was lent a big tool each pair: every man came with his big slot empty, and the Quiet kit's fourth man with his pistol alone)
  if ((k.tables.KITDEAL as Partial<typeof KITDEAL> | undefined)?.stealth === undefined) KITDEAL.stealth = false;   // (…and from before a stealth mission's kit was your card's own: its sponge rounds, cameras and wand were handed over the card at the staging, and a sponge round cost a pouch)
  if ((k.tables.ISSUE as Partial<typeof ISSUE> | undefined)?.picked === undefined) ISSUE.picked = false;   // (a file from before a lesson could be packed for: the tutorial's squad mission was played with the kit as issued, as every lesson was)
  if ((k.tables.ISSUE as Partial<typeof ISSUE> | undefined)?.whole === undefined) ISSUE.whole = false;   // (a file from before a mission's own card for you was the whole kit: the mission's sponge rounds, cameras and wand were handed over it)
  if (!k.tables.PLANLAY) PLANLAY.on = false;   // (a file from before an order could be laid for the word: 'wait for my word' was the four's door tools' row, and they walked to the door at once)
  if (!k.tables.CONDITION) CONDITION.on = false;   // (a file from before a blast left a man hurt: nobody in it ever was)
  if (!k.tables.GUNHAND) GUNHAND.on = false;   // (a file from before a move kept to the hand that is free: a whistle raised the empty fist, a defender threw with his carbine hand, a long gun reloaded on the pistol's clip)
  if (!k.tables.PACKSIDE) PACKSIDE.on = false;   // (a file from before a long thing stood at the side of a man's pack: it lay across his back. Looks only: the run is the same either way)
  if (!k.tables.INHAND) INHAND.on = false;   // (a file from before a pistol was drawn in the hand: every gun was laid on the aim line from the wrist. Looks only: the run is the same either way)
  if (!k.tables.AUTOPILOT) AUTOPILOT.on = false;   // (a file from before the quick key was the squad's autopilot: B on a door the men were stacked on gave 'stack up' again)
  if (!k.tables.SQUAD40) SQUAD40.on = false;   // (a file from before a teammate fired a 40 mm grenade on order: the throws' page had no such row)
  if (!k.tables.SQUADTHROW) SQUADTHROW.on = false;   // (a file from before teammates threw a frag or a stun canister on order: the floor's menu had no such row)
  else {
    const T = k.tables.SQUADTHROW as Partial<typeof SQUADTHROW>;
    if (T.walk === undefined) SQUADTHROW.walk = false;   // (…and one from before a man walked to a throw: with no arc from where anybody stood the order was refused)
    if (T.lob === undefined) SQUADTHROW.lob = SQUADTHROW.duck = SQUADTHROW.samCall = false;   // (…and one from before a man worked his throw out: the one straight arc or nothing, and a frag refused for anybody of ours it had a line to)
  }
  if (!k.tables.TAKEDOWN) { TAKEDOWN.on = false; TAKEDOWN.haul = false; }   // (a file from before takedowns were moves: a man put down pitched over like a plank and lay where that put him)
  else { const T = k.tables.TAKEDOWN as Partial<typeof TAKEDOWN>;
    if (T.lower === undefined) TAKEDOWN.lower = false;   // (a file from before the choke lowered him: he was choked standing, and both men's bones were where that put them)
    if (T.chokeBeats === undefined) TAKEDOWN.chokeBeats = false;   // (…from before the choke's beats: his hands came onto the arm over most of a second and fell as he was lowered)
    if (T.haul === undefined) TAKEDOWN.haul = false;   // (…from before the choke hauled him up and back: both men stood where the hold had them)
    if (T.kill === undefined) TAKEDOWN.kill = false; }   // (…and from before the kill from the hold was a move: the phase was drawn as the hold, and he fell as the knife from behind dropped him)
  if (!k.tables.TAPSTEP) TAPSTEP.on = false;   // (a file from before the steps: a crouch walked)
  if (!k.tables.STALK) STALK.on = false;   // (a file from before the stalk: a held click on a man walked nobody anywhere)
  else { const T = k.tables.STALK as Partial<typeof STALK>;
    if (T.key === undefined) STALK.key = false;   // (a file from before the row's key finished a stalk: the hold became the grab by itself)
    if (T.low === undefined) STALK.low = false;   // (…and from before he went lower with his hands down: the arm came up and he rose)
    if (T.drag === undefined) STALK.drag = false;   // (…and from before the mouse could steer the creep: the hold walks him in)
    if (T.heft === undefined) STALK.heft = false;   // (…and from before his trunk and arms went with his legs: as they were)
    if (T.orbit === undefined) STALK.orbit = false;   // (…and from before his keys took him round the man: a move key ended the creep)
    if (T.orbitSnap === undefined) STALK.orbitSnap = 0;   // (…and from before a key nearly across him was taken as across him)
    if (T.wide === undefined) STALK.wide = false;   // (…and from before his arms went out wide as he crept: his hands by his knees)
    if (T.wideLead === undefined) STALK.wideLead = 0;   // (…and from before the left hand led the right: both as far ahead)
    if (T.widePole === undefined) STALK.widePole = [0.75, 0.1, -0.65];   // (…and with the elbows out to the side, as the arms first went out)
    if (T.jolt === undefined) STALK.jolt = 0;   // (a file from before he shrank back off the man who turned round on him: the stalk ended and he sank back into the crouch)
    if (T.joltAtOnce === undefined) STALK.joltAtOnce = T.joltFace === undefined;   // (…and one from before the duck waited for him to face Sam — the fifth pass, a jolt and no joltFace: any turn that ended the stalk gave it, on that frame and with no test. A file of the sixth pass has joltFace and not this key: the wait, as it was)
    if (T.joltFace === undefined) STALK.joltFace = 180;
    if (T.yankWith === undefined) { STALK.yankWith = false; HOLD.catchShape = false; }   // (…one from before its eighth pass: the man was yanked back into Sam, who chased him and stepped clear on the hold's first frame; the arm came round past his ear, and the two stood upright in the hold. Before the next line: a file from before the fourth pass has neither key and gets all of the polish down)
    if (T.turnIn === undefined) stalkPolish(false); }   // (…and one from before its fourth pass: he turned to the man's back in the step's first frames, a long step took no longer, and the wait at a corner was the wall stance alone)
  { const T = k.tables.HOLD as { hitShape?: boolean } | undefined; if (!T || T.hitShape === undefined) { HOLD.hitShape = false; HOLD.layAhead = 0; } }   // (a file from before the stalk's ninth pass: the body landed with no beat of its own, and the choked man was laid down where he knelt, his legs under Sam's boots — whatever the file's stalk table says: the lay is of every choke's end)
  if (!k.tables.RUNREADY) RUNREADY.on = false;   // (a file from before the sprint kept both hands on the pistol: the gun in a pumping fist)
  if (!k.tables.CROUCHRUN) CROUCHRUN.on = false;   // (a file from before Shift in a crouch stayed down: it stood him up into the sprint)
  if (!k.tables.SAMLOOK) SAMLOOK.on = SAMLOOK.slip = false;   // (a file from before his head went to a man or he gave one room: neither pose)
  if (!k.tables.TWOGEARS) TWOGEARS.on = false;   // (a file from before two gears: the wheel was his pace and the crouch-walk the tune's)
  if (!k.tables.FOOTFALL) FOOTFALL.once = FOOTFALL.owed = false; else if ((k.tables.FOOTFALL as Partial<typeof FOOTFALL>).owed === undefined) FOOTFALL.owed = false;   // (a file from before one footfall a step: every crossing of the walk cycle's half filed one, a rocking cycle one a frame — and one from before a footfall the legs owe: only an edge filed one)
  if (!k.tables.STEALTHPOSE) STEALTHPOSE.on = false;   // (a file from before the stealth poses: his arms were the crouch clip's and he knelt at a door with the wand as at a lock)
  else if ((k.tables.STEALTHPOSE as Partial<typeof STEALTHPOSE>).nod === undefined) STEALTHPOSE.nod = false;   // (…and one from before a goggle nod showed in the look under a door: the look took the nod back out of his head)
  if (!k.tables.PEEKSIGHT) PEEKSIGHT.on = false;   // (a file from before a peek round the end of a wall lifted the fog: his eye stayed over his feet)
  if (!k.tables.WAND) WAND.on = false;   // (a file from before the optical wand: no door offered the look)
  else {
    if ((k.tables.WAND as Partial<typeof WAND>).nv === undefined) WAND.nv = false;   // (…and one from before N was read while he looked: the key did nothing on his knee at the door)
    if ((k.tables.WAND as Partial<typeof WAND>).mate === undefined) WAND.mate = false;   // (…and one from before a teammate could carry one: no card of theirs had the row, no door's menu the order)
    if ((k.tables.WAND as Partial<typeof WAND>).quick === undefined) WAND.quick = false;   // (…and one from before the quick set-up: the lens came through after the feed's 1.5 s)
  }
  if (!k.tables.STICKY) STICKY.on = false;   // (a file from before the sticky cameras: no such load on his rifle)
  else if ((k.tables.STICKY as Partial<typeof STICKY>).live === undefined) STICKY.live = STICKY.max;   // (…and one from before only the newest camera sent a picture: every camera out was an eye)
  if ((k.tables.STICKY as Partial<typeof STICKY> | undefined)?.take === undefined) STICKY.take = false;   // (…and one from before a stuck camera could be taken back: no such row)
  if ((k.tables.CUES as Partial<typeof CUES> | undefined)?.overheard === undefined) CUES.overheard = false;   // (a file from before a hidden defender's shout was a row on the strip: no such row)
  if ((k.tables.STICKY as Partial<typeof STICKY> | undefined)?.mark === undefined) STICKY.mark = false;   // (…and one from before his own cameras showed in the fog: not in its picture)
  if (!k.tables.WORK) WORK.on = false;   // (a file from before a teammate could be sent to work a thing: its menus had no such row, and its breaker errand went to the nearest man whoever he was)
  else if ((k.tables.WORK as Partial<typeof WORK>).ownFace === undefined) WORK.ownFace = false;   // (…and one from before the errand was walked to the panel's own face: its man went to the fixed spot and re-armed the mains inside the bare radius)
  if ((k.tables.WORK as Partial<typeof WORK> | undefined)?.heldPass === undefined) WORK.heldPass = false;   // (…and one from before a man stood at his thing passed over a man he may not shoot: his muzzle stayed on that man and the thing was not worked while the hold stood)
  if ((k.tables.WORK as Partial<typeof WORK> | undefined)?.offWalk === undefined) WORK.offWalk = false;   // (…and one from before a follower stopped standing still on a man's walk to the breaker)
  if (!k.tables.CLOSE) CLOSE.on = false;   // (a file from before the close-in windows: one way in, from behind — its rows and its takedowns were made by that gate)
  if (!k.tables.STACKROOM) STACKROOM.on = false;   // (a file from before door stacks were held to the room's floor: its men walked to the marks the build then dealt)
  if (typeof (k.tables.STACKROOM as { view?: boolean } | undefined)?.view !== 'boolean') STACKROOM.view = false;   // (…and from before a stack waiting on an OPEN door stood out of the room's view: the jamb marks, as recorded)
  if (!k.tables.SEENWALK) SEENWALK.on = false;   // (a file from before an ordered walk weighed lit floor in view of an uncleared room: the walks as they were)
  if (!k.tables.SAMSTUN) SAMSTUN.on = false; else if ((k.tables.SAMSTUN as Partial<typeof SAMSTUN>).ownSeen === undefined) SAMSTUN.ownSeen = false;   // (a file from before a blast folded or blinded the player: his feet and his picture were his own through every one — and one from before a watched can of his own side counted in full)
  if (!k.tables.SPRINTDOOR) SPRINTDOOR.on = false;
  if (!k.tables.GLASSREAL) { GLASSREAL.drop = false; GLASSREAL.place = false; }   // (a file from before glass was typed by where it sits and toughened glass dropped at once: its panes are the wall's kinds and dice in the wave)
  { const T = k.tables.SLOTSETUP as Partial<typeof SLOTSETUP> | undefined;
    if (!T) SLOTSETUP.on = false;   // (a file from before the slot in hand pressed again opened its setup: its 2 pressed with the rifle up stepped the launcher's load)
    if (typeof T?.pop !== 'boolean') SLOTSETUP.pop = false;   // (…and one from before the setup was a mode with no clock on it: there it shut by itself after its seconds)
    if (typeof T?.mags !== 'boolean') SLOTSETUP.mags = false;   // (…and one from before the box counted the gun's rounds over its magazine's size: its box said the rounds in all the spares)
    if (typeof T?.draw !== 'boolean') SLOTSETUP.draw = false; }   // (…nor has one from before a double tap off another slot opened it: there the second press was the draw and no more)
  if (!k.tables.DOORFORCE) DOORFORCE.on = false;   // (a file from before an alerted man fired through a shut door and booted it in: its defenders waited at the leaf or went to its handle)
  if (!k.tables.RAILS) RAILS.on = false;
  else { const R = k.tables.RAILS as Record<string, unknown>; if (R.snapPx === undefined) RAILS.snapPx = 0; if (R.keep === undefined) RAILS.keep = 0; if (R.keepDeep === undefined) { RAILS.keepDeep = 1; RAILS.keepUp = 0; } if (R.wayM === undefined) RAILS.wayM = 0; if (R.afterSecs === undefined) RAILS.afterSecs = 0; if (R.shiftTap === undefined) RAILS.shiftTap = false; if (R.lineClear === undefined) RAILS.lineClear = false; if (R.eyeFirst === undefined) RAILS.eyeFirst = false; if (R.eyeView === undefined) RAILS.eyeView = false; if (R.wayRun === undefined) RAILS.wayRun = false; if (R.skyPlan === undefined) RAILS.skyPlan = false; if (R.planWalk === undefined) RAILS.planWalk = false; if (R.planDown === undefined) RAILS.planDown = false; if (R.skyUp === undefined) RAILS.skyUp = false; if (R.planDigits === undefined) RAILS.planDigits = false; }   // (a tutorial run recorded before the ring was the place and the mark was kept in the picture)   // (a file from before a tutorial mission had a frame: nothing in its ticks was locked)
  { const R = k.tables.RAILS as Record<string, unknown> | undefined; if (R && R.cardBeat === undefined) RAILS.cardBeat = false; }   // (a tutorial run recorded before the step before a card settled: each of its steps came up the tick the deed before it was done, and its ticks are those)
  { const R = k.tables.RAILS as Record<string, unknown> | undefined; if (R && R.flatRing === undefined) RAILS.flatRing = false; }   // (a tutorial run recorded before a mission could take the flat ring: its digits were pressed on the menu's pages)
  { const R = k.tables.RAILS as Record<string, unknown> | undefined; if (R && R.markClear === undefined) RAILS.markClear = false; }   // (…and before a step's mark gave way to a ring over it: the mark was drawn under the ring)
  { const R = k.tables.RAILS as Record<string, unknown> | undefined; if (R && R.spareDown === undefined) RAILS.spareDown = false; }   // (a tutorial run recorded before a spared teammate was a man down to the enemy: its defenders went on firing at him, and its rounds are those)
  if (!k.tables.NOSHOVE) NOSHOVE.on = false;   // (a file from before a man falling in went round the player: its followers shouldered him aside, and the squad read that as his walking)
  if (!k.tables.TEAMPACE) TEAMPACE.on = false;   // (a file from before teammates walked slower than the player and ran for a reason: its team walked every leg under the old cap)
  if (typeof (k.tables.SPRINTDOOR as { kick?: boolean } | undefined)?.kick !== 'boolean') SPRINTDOOR.kick = false;   // (… and one from the days the face a door opens toward was only ever the handle — its SPRINTDOOR row has no such key — replays with the handle)   // (a file from before a sprint into a door had weight: its runner went through every leaf at full speed, from either face)
  if (typeof (k.tables.AIM as { player?: { low?: number } } | undefined)?.player?.low !== 'number') AIM.player.low = 0;   // (a file from before a low man was aimed at where he is — its AIM row has no such key: its rounds at a man with his head down went to a standing chest, over him)
  if (!k.tables.AIMWEIGHT) AIMWEIGHT.on = false; else if ((k.tables.AIMWEIGHT as Partial<typeof AIMWEIGHT>).launchWait === undefined) AIMWEIGHT.launchWait = 0;   // (a file from before the player's aim had weight: its clicks were aimed with the gun eased straight onto the cursor — and one from before a launcher's load waited on the swing: it left the frame the button came up)
  if (!k.tables.AIMCOST) { AIMCOST.lamp = false; AIMCOST.move = false; }   // (a file from before a lamp needed a real hit and moving feet cost the shot: its rounds broke the lamps they passed, and its cones were the old ones)
  if ((k.tables.AIMCOST as Partial<typeof AIMCOST> | undefined)?.flankAt === undefined) AIMCOST.flankAt = 1e9;   // (…and one from before the standoff's flank round waited for still feet: it went the frame the line was his)
  if ((k.tables.RELOAD as Partial<typeof RELOAD> | undefined)?.lastMag === undefined) RELOAD.lastMag = false;   // (a file from before the last magazine, seated and not racked, could be reloaded: its R was refused there)
  if (!k.tables.RELOAD) RELOAD.auto = false;   // (a file from before a dry gun reloaded itself: its player pressed R, and its frames have no reload he did not ask for)
  if (!k.tables.QUICKTHROW) QUICKTHROW.on = true;   // (a file from before the G quick throw left the page: its G presses threw)
  if (!k.tables.LIGHTSWITCH) LIGHTSWITCH.on = false;   // (a file from before a room's lights had a switch on the wall: no plates, no row, nobody at one)
  if (!k.tables.CARLAMPS) CARLAMPS.on = false;   // (a file from before a vehicle's lamps were light targets: its floor has none)
  if (!k.tables.CLEANRESTART) CLEANRESTART.on = false;   // (a file from before a restart gave a clean level: its restarts mended the mains by the breaker's own road and kept the last try's lines and clocks)
  if (!k.tables.THROWBACK) THROWBACK.on = false;   // (a file from before a can in the wind-up went back on the belt: its cans froze through a kick or a pick and left his hand after)
  if ((k.tables.THROWBACK as Partial<typeof THROWBACK> | undefined)?.reach === undefined) THROWBACK.reach = false;   // (…and a file from before the throw preview showed what the thing would reach: its arcs had the small ring alone)
  if (!k.tables.AUTOCAM) AUTOCAM.on = false;   // (a file from before the camera could run itself: its double tap was the Options row's)
  if ((k.tables.AUTOCAM as Partial<typeof AUTOCAM> | undefined)?.sway === undefined) AUTOCAM.sway = false;   // (…and one from before it could turn in a fight)
  if ((k.tables.AUTOCAM as Partial<typeof AUTOCAM> | undefined)?.lock === undefined) AUTOCAM.lock = false;   // (…and one from before it came in on a man the player sneaks up on)
  if ((k.tables.AUTOCAM as Partial<typeof AUTOCAM> | undefined)?.tune === undefined) autoTuneOld((k.tables.AUTOCAM ?? {}) as Partial<typeof AUTOCAM>);   // (…and one from before its numbers were the player's: the switch off, and the numbers it has no word for the module's own)
  if (!k.tables.WORKSTOW) WORKSTOW.on = false;   // (a file from before the gun was put away for a two-handed job: a charge went on with it in the hand, on the shorter clock)
  if (!k.tables.SQUADNET) SQUADNET.on = SQUADNET.why = SQUADNET.clear = false;   // (a file from before the squad's far lines reached the player and the quick key said why: the answers and the room call as they were)
  if ((k.tables.SQUADNET as Partial<typeof SQUADNET> | undefined)?.endCall === undefined) SQUADNET.endCall = false;   // (…and one from before an entry into a room with no name of the mission's ended with a call: nothing was said there)
  if ((k.tables.SQUADNET as Partial<typeof SQUADNET> | undefined)?.edge === undefined) SQUADNET.edge = false;   // (…and one from before a far line sat at the edge of the view: near you, as it was drawn)
  if (!k.tables.OWNBLOW) OWNBLOW.on = false;   // (a file from before his own charge went off from his own actions: the squad's key blew it)
  if (typeof (k.tables.HANDRING as { early?: boolean } | undefined)?.early !== 'boolean') HANDRING.early = false;   // (…and one from before a digit inside the hold was the ring's: there it drew the slot)
  if (typeof (k.tables.HANDRING as { empty?: boolean } | undefined)?.empty !== 'boolean') HANDRING.empty = false;   // (…nor before an empty tap said so)
  if (typeof (k.tables.HANDRING as { near?: boolean } | undefined)?.near !== 'boolean') HANDRING.near = false;   // (…nor before that word named the thing he stood beside)
  if (typeof (k.tables.HANDRING as { onThing?: boolean } | undefined)?.onThing !== 'boolean') HANDRING.onThing = false;   // (…nor before his ring stood on the thing it is about: at the cursor)
  if (typeof (k.tables.HANDRING as { corner?: boolean } | undefined)?.corner !== 'boolean') HANDRING.corner = false;   // (…nor before the corner panel was the objective and a line a key: the picture only)
  if (typeof (k.tables.HANDRING as { turn?: boolean } | undefined)?.turn !== 'boolean') HANDRING.turn = false;   // (…nor before a row at a wall switch turned him to it)
  if (typeof (k.tables.HANDRING as { bare?: boolean } | undefined)?.bare !== 'boolean') HANDRING.bare = false;   // (…nor before it lost its line of words: the picture only)
  if (typeof (k.tables.HANDRING as { lone?: boolean } | undefined)?.lone !== 'boolean') HANDRING.lone = false;   // (…nor before a ring with one row was a pill: the picture only)
  if (typeof (k.tables.HANDRING as { loneWrap?: boolean } | undefined)?.loneWrap !== 'boolean') HANDRING.loneWrap = false;   // (…nor before a pill's long label took two lines: the picture, and the place the cursor is read on)
  if (!k.tables.HANDRING) HANDRING.on = false;   // (a file from before his own actions were a ring that stays: its held presses opened the list, and its rows had no whistle)
  if (!k.tables.HANDSLOT) HANDSLOT.on = false;   // (a file from before empty hands were a slot: a 0 pressed in it was no key of the game's)
  if (!k.tables.SAVETIMELINE) SAVETIMELINE.on = false;   // (a file from before the saves rolled: three autosaves, and none with a team on the floor — its Enter once down found what that build kept)
  if ((k.tables.SAVETIMELINE as { holds?: boolean } | undefined)?.holds === undefined) SAVETIMELINE.holds = false;   // (a file from before a save carried the wall hold and the close-in gait: its go-backs stood him free of the wall)
  if ((k.tables.SAVETIMELINE as { turn?: boolean } | undefined)?.turn === undefined) SAVETIMELINE.turn = false;   // (… nor before a save carried a man's turn: its go-backs started a man caught mid-turn from rest)
  if (!k.tables.FIRELINE) FIRELINE.on = false;   // (a file from before a teammate waited short of the lane the player was firing down: its men walked their orders through it)
  if (!k.tables.FRIENDLYFIRE) FRIENDLYFIRE.on = false;   // (a file from before a round of his side found the men of his side)
  if (!k.tables.FRIENDS) { FRIENDS.noSnap = false; FRIENDS.lowReady = false; }   // (a file from before the reticle passed over his own side and his gun came down off a teammate)
  if (!k.tables.BACKKEY) BACKKEY.tab = false;   // (a file from before Tab backed out of a list: a Tab in its ticks did nothing)
  if ((k.tables.TORCH as { wallLow?: boolean } | undefined)?.wallLow === undefined) { TORCH.wallLow = false; TORCH.wallDark = false; }   // (a file from before a hand torch hung when the wall was at his hand: its torches were carried level, and its meters read them)
  if (!k.tables.TORCH) TORCH.calmOff = false;   // (a file from before a calm patrol's torch went dark in a lit place: its torches burned everywhere, and its meters read them)
  if (!k.tables.MORALE) MORALE.on = false;   // (a file from before a blast shook the men it did not hurt: every man stood where he stood, and nobody fired into the dust)
  if ((k.tables.MORALE as Partial<typeof MORALE> | undefined)?.training === undefined) { MORALE.training = 'none'; MORALE.nerve = 'normal'; MORALE.fanStep = 0; }   // (…and one from before a man was green or steady: every man the first slice's — broken alone in the dark only, folded when he was, and scrabbling straight back with no fan to find him a way (fanStep 0 shuts it). A recording that carries the keys keeps its own: assignDeep takes a string row as it takes a number)
  if ((k.tables.MORALE as Partial<typeof MORALE> | undefined)?.darkRead === undefined) MORALE.darkRead = 'place';   // (…and one from before the dark had a second reading: where he stands, as it was read)
  if (!k.tables.SMOKEBREAK) SMOKEBREAK.on = false;   // (a file from before a man told to smoke lit anything: he stood there with his hands as they were)
  if (!k.tables.SHOWWHY) SHOWWHY.on = false;   // (a file from before a teammate showed why he was not acting: nobody waved, squeezed, raised a fist or said what held him)
  if (!k.tables.FIRE) FIRE.on = false;   // (a file from before a brazier burned: its lamp was steady, and its meters read a steady light)
  if ((k.tables.FIRE as Partial<typeof FIRE> | undefined)?.fog === undefined) FIRE.fog = false;   // (… one from before a fire was drawn under the fog of war: no flame over ground nobody sees — the picture only)
  { const F0 = k.tables.FIRE as (Partial<typeof FIRE> & { look?: Partial<typeof FIRE.look> }) | undefined;   // (… one from before a fire's lamp was a fire's: the level's strength and colour; and from before the look's newer numbers: the picture's memory unchanged, the flame hardly leaning)
    if (F0?.bright === undefined) { FIRE.bright = 1; FIRE.warm = [1, 1, 1]; }
    if (F0?.reach === undefined) FIRE.reach = 1;
    if (F0?.hardy === undefined) FIRE.hardy = false;   // (… and from before a round or a blast left a fire burning: it went out like a bulb)
    if (F0?.look?.react === undefined) { FIRE.look.react = 0; FIRE.look.lean = FIRE_LEAN_WAS; }
    if (F0?.look?.steps === undefined) FIRE.look.steps = FIRE_STEPS; }   // (… and from before the flame's sample count was a number of the table: the count it was, the picture only)
  if ((k.tables.FIRE as Partial<typeof FIRE> | undefined)?.gas === undefined) FIRE.gas.on = false;   // (… one from before a fire's flame could be the solver's gas: the flame of noise)
  if ((k.tables.FIRE as Partial<typeof FIRE> | undefined)?.look === undefined) { FIRE.look.shimmer = 0; FIRE.look.plume = 0; FIRE.embers = 0; }   // (… one from before the flame's look had numbers: no shimmer over it, no smoke drawn off its tips, no particle embers — the picture only)
  if ((k.tables.FIRE as Partial<typeof FIRE> | undefined)?.size === undefined) FIRE.size = 0;   // (… and one from before its lamp was made as big as the flame: the size the level gave it — a meter's shadow ray stops that much short of the lamp)
  if (!k.tables.ROWSET) ROWSET.on = false;   // (a file from before a row had an hour and weather of its own: it was started at its query's)
  if (!k.tables.STARTLE) STARTLE.on = false;   // (a file from before a calm man started at the first sight of you: its men went for their guns the frame they knew, and none ran from it)
  if (!k.tables.FLINCH) FLINCH.on = false;   // (a file from before a man ducked at every close round: nobody ducked but on the suppression model's edge, and no green man broke under fire)
  if ((k.tables.RUNNER as Partial<typeof RUNNER> | undefined)?.anyway === undefined) RUNNER.anyway = false;   // (…and one from before he ran for it no matter what: one idea of an enemy on the only door out sent him to the corner, and a rifleman kept his sidearm)
  if ((k.tables.RUNNER as Partial<typeof RUNNER> | undefined)?.nobody === undefined) RUNNER.nobody = false;   // (…and one from before a man who had run was nobody's enemy on the books: teammates called contact on him and he was his mates' company)
  if (!k.tables.RUNNER) RUNNER.on = false;   // (a file from before a broken man dropped it and ran: its men changed their magazines where they stood, and every one of them was there to be counted)
  if (!k.tables.DARKDOOR) DARKDOOR.on = false;   // (a file from before a green man stopped at the doorway of a dark room: every man walked in as he came to it)
  if (!k.tables.DOZE) DOZE.on = false;   // (a file from before a man dozed a long dark wait out in a chair: its men stood their waits awake)
  else { const d = k.tables.DOZE as Partial<typeof DOZE>;
    if (d.screen === undefined) DOZE.screen = false;   // (… and one from before a short wait sat to a screen: its men dozed, or stood)
    else if (d.idleSecs === undefined) DOZE.idleSecs = 1e9;   // (… and one from before a screen left lit blanked: it stayed lit)
    if (d.lend === undefined) DOZE.lend = false; }   // (… and one from before the screen held his attention by the attention rule: his eyes were whole)
  if (!k.tables.DARKFOE) DARKFOE.on = false;   // (a file from before an alerted enemy lit his lamp or left his post for the dark: its defenders' lights stayed off and they stood where they were put)
  else if ((k.tables.DARKFOE as Partial<typeof DARKFOE>).suspect === undefined) DARKFOE.suspect = true;   // (…and one from before the lamp waited for the alert: a man who was only suspicious lit his too)
  if (!k.tables.POWEROUT) POWEROUT.on = false;   // (a file from before a mission's defenders answered a blackout: nobody of theirs walked to the breaker, and the dark was no word to anybody)
  if (!k.tables.SQUADDEAL) SQUADDEAL.on = false;   // (a file from before a level with no squads block was handed squads cut from its rooms: its defenders were one pool)
  if (!k.tables.STAYASK) STAYASK.on = false;   // (a file from before squads that stay in their rooms missed a silent room: nobody asked after another squad there, and nobody went)
  if (!k.tables.KITLOAD) KITLOAD.on = false;   // (a file from before a card's weight was a man's pace, notice and footfall: every man moved, was seen and was heard the same whatever he carried)
  if (!k.tables.CMDCHECK) CMDCHECK.on = false;   // (a file from before a tick's record was checked: every record was believed as it came)
  if (!k.tables.SENSE) SENSE.cpu = false;   // (a file from before the senses could run on the CPU: it read the renderer's values, and they are in it)
  if (!k.tables.EXACT) EXACT.on = false;   // (a file from before the game's own maths: it was recorded on the engine's sin and cos, and replays on them)
  if (!k.tables.SNATCHOUT) SNATCHOUT.on = false;   // (a file from before a snatch ended with the man in the van: the house taken with him in hand ended it)
  if (!k.tables.RESCUEEND) RESCUEEND.on = false;   // (a file from before a rescue was won only by the hostages led out or the floor cleared: the room held fifteen seconds ended it)
  if (typeof (k.tables.RESCUEFLUSH as { lanesChoose?: boolean } | undefined)?.lanesChoose !== 'boolean') RESCUEFLUSH.lanesChoose = false;   // (…and one from before the covered lanes only chose a man's door: a man they warned off was kept back)
  if (!k.tables.RESCUEFLUSH) RESCUEFLUSH.on = false;   // (a file from before the men left alive on a rescue came for the hostages: they stayed where the fight left them)
  if (!k.tables.RESCUECHECK) RESCUECHECK.on = false;   // (a file from before a rescue's men checked in by radio: a man of theirs taken without a sound was missed by nobody)
  if (!k.tables.NETQUIET) NETQUIET.on = false;   // (a file from before the net went quiet: a check nobody answered shook nobody, no man whipped to a noise, and the last man held his room standing)
  if (!k.tables.ATTENTION) ATTENTION.on = false;   // (a file from before a guard's attention could be taken: its wary men swept the room with their whole eye, and nothing wore off)
  if (!k.tables.RESPONSE) RESPONSE.on = false;   // (a file from before the response team was the level's own: the office's one stairwell, the sandbox's two numbers, the floor's fix)
  else if (typeof (k.tables.RESPONSE as Partial<typeof RESPONSE>).raid !== 'boolean') RESPONSE.raid = false;   // (…or from before a squad's raid could bring a level's team: its raids brought nobody)
  if (!k.tables.PICTURE) PICTURE.on = false;   // (a file from before each man kept his own picture of the fight: nobody remembered where an enemy had been, and every spot was picked without one)
  else { const p = k.tables.PICTURE as Partial<typeof PICTURE>;
    if (p.wall === undefined) PICTURE.wall = false;   // (…and one from before the wall charge's stand-off asked the pictures: who was known was the fog's record alone)
    if (p.flee === undefined) PICTURE.flee = false;   // (…and one from before a man off a grenade minded who else could see his spot)
    if (p.fallback === undefined) PICTURE.fallback = false;   // (…and one from before a defender giving his room up minded every enemy he knew of: one threat point)
    if (p.stack === undefined) PICTURE.stack = false;   // (…and one from before a stack filed on one hand of a door out of a known enemy's line: the walls' marks)
    if (p.step === undefined) PICTURE.step = false;   // (…and one from before a man stepped off a place of the squad's own choosing that was in a known enemy's line)
    if (p.shot === undefined) PICTURE.shot = false;   // (…and one from before a colleague's shots placed the enemy where the shooter believed him: the true place)
    if (p.run === undefined) PICTURE.run = false;   // (…and one from before a man who dropped his gun and ran went by his own picture: every enemy's true place)
    if (p.coverHard === undefined) PICTURE.coverHard = false; }   // (…and one from before a pinned man with no place hidden from everybody kept the place that stops a round over one a round goes through)
  if (!k.tables.QUIETFOG) QUIETFOG.on = false;   // (a file from before a quiet mission could be played under the fog of war: its query named no rung)
  if ((k.tables.QUIETFOG as Partial<typeof QUIETFOG> | undefined)?.def === undefined) QUIETFOG.def = 'off';   // (…and one from before a quiet mission STARTED under the fog: its bare quiet link was played with every guard shown)
  if ((k.tables.QUIETFOG as Partial<typeof QUIETFOG> | undefined)?.wand === undefined) QUIETFOG.wand = false;   // (…and one from before the mission handed out a wand: only the card's)
  if ((k.tables.QUIETFOG as Partial<typeof QUIETFOG> | undefined)?.solo === undefined) QUIETFOG.solo = false;   // (…and one from before the solo night could open under the fog: its `solo` link raised none)
  if (!k.tables.TOLD) { TOLD.on = false; TOLD.fogOff = false; }   // (a file from before the fourth difficulty lever and the squad fog lever's bottom rung: three levers, no last-seen mark but FOG.lastSeen's)
  if (!k.tables.TAKE) TAKE.wired = false;   // (a file from before only a wired holder sent a man: on its quiet missions a man was sent seven seconds after every take)
  if (!k.tables.HOLDFIRE) HOLDFIRE.on = false;   // (a file from before an unfound squad held its fire for the player's shot or order: its teammates shot on sight)
  if ((k.tables.HOLDFIRE as Partial<typeof HOLDFIRE> | undefined)?.loud === undefined) HOLDFIRE.loud = false;   // (…and one from before 'go loud' told to a silent squad started the fight: its squad, told loud, held until his shot or a door order)
  { const H = k.tables.HOLDFIRE as Partial<typeof HOLDFIRE> | undefined;   // (the stack's two sub-keys came after the behaviour they gate: a held man on his mark counted as set, and the lead kept his hand off the handle, from the build that brought `loud` — so a row with `loud` and no `stackSet` was made with it, one without `loud`, or no row, without; the wait for ANY held man of the stack came with its key)
    if (H?.stackSet === undefined) HOLDFIRE.stackSet = H?.loud !== undefined; if (H?.stackWait === undefined) HOLDFIRE.stackWait = false; }
  if (typeof (k.tables.SILENT as { stackSet?: boolean } | undefined)?.stackSet !== 'boolean') SILENT.stackSet = false;   // (a file from before a silent man held on a man counted as stacked: he was 'stacking' until his gun was the door's. Such a file carries no SILENT row at all — the table joined a recording with this key — so the posture's other rules replay as this process has them, as they always did)
  if (!k.tables.START) START.fallIn = false;   // (a file from before the team started fallen in: its stagings left the men with no order)
  if (!k.tables.SAMESTART) SAMESTART.on = false;   // (a file from before every mission started the same way: its stagings were dealt — a fresh placement a visit, the next on a restart, a quiet deal off the die)
  if (!k.tables.LIGHTWALL) LIGHTWALL.on = false;   // (a file from before weapon lights stopped at walls: its lights stood at their lenses, and the light estimate read them there)
  if (!k.tables.IRLIGHT) IRLIGHT.on = false;   // (a file from before the goggles carried an infrared light: its teammates' tubes saw a man by the light the meter read alone, and a room with none was 'too dark for the tube')
  if ((k.tables.IRLIGHT as Partial<typeof IRLIGHT> | undefined)?.auto === undefined) IRLIGHT.auto = false;   // (…and one from before the light burned only where it was too dark for the tube: its lights burned whenever the goggles were down)
  if ((k.tables.IRLIGHT as Partial<typeof IRLIGHT> | undefined)?.meter === undefined) IRLIGHT.meter = false;   // (…and one from before the light put its dark places to the renderer's meter: it read no such answer, and its lights went by the CPU's estimate alone)
  if ((k.tables.IRLIGHT as Partial<typeof IRLIGHT> | undefined)?.near === undefined) IRLIGHT.near = false;   // (…and one from before the light turned itself down for what stands close in front of it: its lights burned at full strength, and a goggled teammate saw a man in them by that)
  if (!k.tables.AIRDUST) AIRDUST.on = false;   // (a file from before the weather's dust stood in the rooms by their openings: its eyes were cut by the leak under every roof)
  if ((k.tables.WALLCHARGE as { outer?: boolean } | undefined)?.outer === undefined) WALLCHARGE.outer = false;   // (a file from before a charge went on an outer wall: there it was refused in words)
  if ((k.tables.WALLCHARGE as { safe?: boolean } | undefined)?.safe === undefined) WALLCHARGE.safe = false;   // (…and from before its safety radius grew: the stand-off and the backblast reach as they were)
  if ((k.tables.WALLCHARGE as { farFurn?: boolean } | undefined)?.farFurn === undefined) WALLCHARGE.farFurn = false;   // (…and from before furniture against the far face stopped counting as 'no floor behind it': refused there, as it was)
  if ((k.tables.CHAOS as { pall?: { on?: boolean } } | undefined)?.pall?.on === undefined) CHAOS.pall.on = false;   // (…and from before a blast raised its pall: there a charge's dust was the thin puffs alone)
  if ((k.tables.CHAOS as { mess?: { on?: boolean } } | undefined)?.mess?.on === undefined) CHAOS.mess.on = false;   // (…and from before a blast left its mess on the floor)
  if ((k.tables.WALLCHARGE as { hung?: boolean } | undefined)?.hung === undefined) WALLCHARGE.hung = false;   // (…and from before a charge set on what hangs on a wall took it and the wall: there it opened nothing)
  if ((k.tables.WALLCHARGE as { farMouth?: boolean } | undefined)?.farMouth === undefined) WALLCHARGE.farMouth = false;   // (…and from before what a blown hole's own clearing takes stopped counting either: wallcharge.ts farMouth)
  if ((k.tables.WALLCHARGE as { safeBack?: boolean } | undefined)?.safeBack === undefined) WALLCHARGE.safeBack = false;   // (…and from before the safe marks were dealt by the walk back to the hole: by the straight line, up to safeWalkM of walk, and afterBlow stood out on them)
  if ((k.tables.WALLCHARGE as { outOfFire?: boolean } | undefined)?.outOfFire === undefined) WALLCHARGE.outOfFire = false;   // (…and from before the stand-off marks were ranked by the fire of the enemies the team knows of: the nearest safe marks, whatever looks at them)
  if ((k.tables.WALLCHARGE as { menClear?: boolean } | undefined)?.menClear === undefined) WALLCHARGE.menClear = false;   // (…and from before the men with Sam stepped back from a set wall charge: they keep their places in the file)
  if ((k.tables.ORDERS as { fileSpread?: boolean } | undefined)?.fileSpread === undefined) ORDERS.fileSpread = false;   // (a file from before two fall-in places on one spot were dealt apart: the places as they fell. A recording from before its tables carried ORDERS (knobs.ts JOURNAL_KNOBS) lands here too; a run tape writes its own value back right after this — rerun.ts / engineplay.ts tables())
  if ((k.tables.ORDERS as { fileHold?: boolean } | undefined)?.fileHold === undefined) ORDERS.fileHold = false;   // (a recording from before the key — its ORDERS row has no such key — replays with it off: a follower the spread found no floor for is handed his place as it fell, a mate's body's room or no)
  if ((k.tables.ORDERS as { backEnd?: boolean } | undefined)?.backEnd === undefined) ORDERS.backEnd = false;   // (a recording from before the key — its ORDERS row has no such key — replays with it off: the file's further back off a doorway is counted in full where the floor has run out, and the near band is as wide as it was)
  if ((k.tables.ORDERS as { retakeGoal?: boolean } | undefined)?.retakeGoal === undefined) ORDERS.retakeGoal = false;   // (a recording from before the key replays with it off: a man back from the fight keeps the goal the fight found him with)
  if ((k.tables.ORDERS as { inWay?: boolean } | undefined)?.inWay === undefined) ORDERS.inWay = false;   // (a recording from before the key — its ORDERS row has no such key — replays with it off: a stack refused for Sam's own body is refused 'no room on that door.', the words it was made with)
  if ((k.tables.ORDERS as { walkTries?: boolean } | undefined)?.walkTries === undefined) ORDERS.walkTries = false;   // (a recording from before the key — its ORDERS row has no such key — replays with it off: a 'move' whose way runs at a door nobody has tried is refused with the door's name, as it was made)
  if (typeof k.flags.roundCap === 'number' && Number.isFinite(k.flags.roundCap)) ORDERS.roundCap = k.flags.roundCap;   // (a recording's own tables did not carry ORDERS when this key came, so it rides with the flags as well, as the stalk's moon rule does: made with a way round held to its worth, it replays so)
  else if ((k.tables.ORDERS as { roundCap?: number } | undefined)?.roundCap === undefined) ORDERS.roundCap = 0;   // (…and a file from before the key: any way round with less unknown floor on it, however long. As above: a run tape that carries the key writes its own value back right after this)
  if ((k.tables.ORDERS as { roundOwn?: boolean } | undefined)?.roundOwn === undefined) ORDERS.roundOwn = false;   // (a recording from before the key replays with it off: a pair behind the door it is to stack on takes the short way through it where the cap refuses the way round, as it was made)
  if ((k.tables.ORDERS as { sameWay?: boolean } | undefined)?.sameWay === undefined) ORDERS.sameWay = false;   // (a recording from before the key replays with it off: each man of a pair walks his own short way round, as it was made)
  if ((k.tables.ORDERS as { trailDoors?: boolean } | undefined)?.trailDoors === undefined) ORDERS.trailDoors = false;   // (a recording from before the key replays with it off: a follower walks his own short way to his place, as it was made)
  if ((k.tables.COVER as { backKeep?: boolean } | undefined)?.backKeep === undefined) COVER.backKeep = false;   // (a file from before a man walking backwards on his opening kept to it until his body had come round: he turned to walk forwards the moment the twist allowed. Like ORDERS, never in a recording's own tables; a run tape that carries the key writes its own value back right after this)
  { const L = k.tables.LIGHTS as { wallOff?: boolean } | undefined; if (L?.wallOff === undefined) LIGHTS.wallOff = false; }   // (a recording from before a teammate's light went dark into the wall at his muzzle — or from before its tables carried LIGHTS at all: his light as the other rules had it)
  { const I = k.tables.IR as { teamOff?: boolean } | undefined; if (I?.teamOff === undefined) IR.teamOff = false; }   // (a recording from before the team's lasers could be put off: they are drawn)
  // (the partner's quiet orders, 10-13 — a file from before them replays with each off: a sweeping sentry's ring, the kept way, 'he'll look back', the habit read from when a man stopped)
  { const P = k.tables.PAIR as { sweep?: boolean; keepWay?: boolean; lookBack?: boolean; habitStood?: boolean } | undefined;
    if (P?.sweep === undefined) PAIR.sweep = false; if (P?.keepWay === undefined) PAIR.keepWay = false;
    if (P?.lookBack === undefined) PAIR.lookBack = false; if (P?.habitStood === undefined) PAIR.habitStood = false;
    if ((P as { steady?: boolean } | undefined)?.steady === undefined) PAIR.steady = false; }   // (…and one from before the partner stopped turning about on his way: he walked back to a passed corner and squared to his man on every short wait, as it was made)
  if ((k.tables.COVER as { rearRead?: boolean } | undefined)?.rearRead === undefined) COVER.rearRead = false;   // (…and from before a rear man on a door-less mark read the ground for what to watch: his rear is the way he came. A recording that carries the key keeps its own.)
  if ((k.tables.COVER as { backTurn?: boolean } | undefined)?.backTurn === undefined) COVER.backTurn = false;   // (…and from before a back-pedalling man the deal let go of kept his path while his body came round: he walked forward along it, as the file was made)
  if (!k.tables.ROUND) ROUND.on = false;   // (a file from before round things were round: its drums and tyres were the kit's octagons — said again here; the level was stood up by roundTape's word)
  if (k.tables.UNDERFOOT === undefined) UNDERFOOT.on = false;   // (…and from before a walker's feet were asked from where the walk grid's bake begins: a thing 0.2 m high stopped them, as the file was made)
  if ((k.tables.SNEAK as { sideStop?: number } | undefined)?.sideStop === undefined) SNEAK.sideStop = 0;   // (…and from before the partner's step aside was asked along its last quarter metre: the spot alone, as it was)
  if ((k.tables.SNEAK as { noiseWalk?: boolean } | undefined)?.noiseWalk === undefined) SNEAK.noiseWalk = false;   // (…and from before a follower stopped standing still on the walk of a man who comes to a sound: the breaker man alone, as it was)
  if (typeof k.flags.stalkAmbient === 'boolean') SNEAK.stalkAmbient = k.flags.stalkAmbient;   // (a recording's own tables did not carry SNEAK when this key came, so it rides with the flags as well, as the fog does: made with the stalk's light taking the walker's own meter, it replays so)
  else if ((k.tables.SNEAK as { stalkAmbient?: boolean } | undefined)?.stalkAmbient === undefined) SNEAK.stalkAmbient = false;   // (…and a file from before the key: the estimate alone, as it was; a run tape that carries the key writes its own value back right after this)
  { const dt = k.tables.DOORTOOLS as { testDoor?: boolean; outsidePlain?: boolean; haltBack?: boolean; threatFirst?: boolean; openAir?: boolean; flowMax?: number; bangWay?: boolean; threatStuck?: number; openHand?: boolean; behindSam?: boolean } | undefined;   // (…from before an entry halted at a door found shut, before 'clear from outside' was one plain order, before the first man in kept his gun on a known threat, and before yards and very large rooms were left unswept: each as it was)
    if (dt?.testDoor === undefined) DOORTOOLS.testDoor = false; if ((dt as { thrPie?: boolean } | undefined)?.thrPie === undefined) DOORTOOLS.thrPie = false; if ((dt as { thrLean?: boolean } | undefined)?.thrLean === undefined) DOORTOOLS.thrLean = false; if ((dt as { thrPieOne?: boolean } | undefined)?.thrPieOne === undefined) DOORTOOLS.thrPieOne = false; if (dt?.outsidePlain === undefined) DOORTOOLS.outsidePlain = false; if ((dt as { wordNoCan?: boolean } | undefined)?.wordNoCan === undefined) DOORTOOLS.wordNoCan = false; if ((dt as { wordCuts?: boolean } | undefined)?.wordCuts === undefined) DOORTOOLS.wordCuts = false; if ((dt as { bangInto?: boolean } | undefined)?.bangInto === undefined) DOORTOOLS.bangInto = false; if ((dt as { wordSmall?: boolean } | undefined)?.wordSmall === undefined) DOORTOOLS.wordSmall = false;
    if (dt?.haltBack === undefined) DOORTOOLS.haltBack = false;   // (…and from before a pair halted on a door the other pair is charging stepped back off it: it stays stacked where it halted, as it was. A recording that carries the key keeps its own.)
    if (typeof k.flags.behindSam === 'boolean') DOORTOOLS.behindSam = k.flags.behindSam;   // (a recording's own tables did not carry DOORTOOLS then either: this key rides with the flags too, so a recording made with it on replays on)
    else if (dt?.behindSam === undefined) DOORTOOLS.behindSam = false;   // (…and a file from before Sam beyond a door kept the squad's own stun can in the kit: the word at a held door banged its pockets wherever he stood)
    if (typeof k.flags.tossMate === 'boolean') DOORTOOLS.tossMate = k.flags.tossMate;   // (… and the can asked about teammates again as it leaves the hand: with the flags, as behindSam)
    else if ((dt as { tossMate?: boolean } | undefined)?.tossMate === undefined) DOORTOOLS.tossMate = false;   // (…a file from before the key: the row asked when it was given and never again)
    if (dt?.threatFirst === undefined) DOORTOOLS.threatFirst = false; if (dt?.openAir === undefined) DOORTOOLS.openAir = false; if (dt?.flowMax === undefined) DOORTOOLS.flowMax = 0;
    if (dt?.bangWay === undefined) DOORTOOLS.bangWay = false; if (dt?.threatStuck === undefined) DOORTOOLS.threatStuck = 0;   // (…and from before the stun canister's look at the leaf existed; a recording that carries the key replays its own value)
    if (dt?.openHand === undefined) DOORTOOLS.openHand = false; if ((dt as { gateHand?: boolean } | undefined)?.gateHand === undefined) DOORTOOLS.gateHand = false;
    if ((dt as { podFrames?: boolean } | undefined)?.podFrames === undefined) DOORTOOLS.podFrames = false;
    if ((dt as { thrHand?: boolean } | undefined)?.thrHand === undefined) DOORTOOLS.thrHand = false;
    if ((dt as { thrNoCan?: boolean } | undefined)?.thrNoCan === undefined) DOORTOOLS.thrNoCan = false; if ((dt as { thrFragHold?: boolean } | undefined)?.thrFragHold === undefined) DOORTOOLS.thrFragHold = false; if ((dt as { thrDoorsLeaf?: boolean } | undefined)?.thrDoorsLeaf === undefined) DOORTOOLS.thrDoorsLeaf = false;
    if ((dt as { fragHold?: boolean } | undefined)?.fragHold === undefined) DOORTOOLS.fragHold = false; }   // (…and from before a door order waited for its men who ran from a grenade)   // (…and from before a threshold's can waited for a hand at the door)   // (…and from before an entry's points kept out of other doors' frames)   // (…and from before a bang / frag order on an open door kept every man on his own side of it)
  if ((k.tables.DOORWAY as { kickGlass?: boolean } | undefined)?.kickGlass === undefined) DOORWAY.kickGlass = false;   // (…and from before that boot was kept from in front of a pane)
  if ((k.tables.DOORWAY as { sideKick?: boolean } | undefined)?.sideKick === undefined) DOORWAY.sideKick = false;   // (…and from before a boot could be thrown from beside the door)
  if ((k.tables.DOORWAY as { solid?: boolean } | undefined)?.solid === undefined) DOORWAY.solid = false;   // (…and from before a pulled leaf was solid to the player: it passes him, as it was recorded)
  if ((k.tables.FURN as { mouth?: unknown } | undefined)?.mouth === undefined) FURN.mouth.on = false;   // (a file from before a blown hole was cleared of what stood in its mouths: it stood there)
  if ((k.tables.FURN as { mouth?: { snow?: unknown } } | undefined)?.mouth?.snow === undefined) FURN.mouth.snow = false;   // (a file from before lying snow in a blown hole's mouths went with the blast: the bank stood)
  if ((k.tables.FURN as { mouth?: { base?: unknown } } | undefined)?.mouth?.base === undefined) FURN.mouth.base = false;   // (a file from before the bottom layer of a blown pile went with it: the layer lay in the hole)
  if ((k.tables.SNEAK as { byEye?: boolean } | undefined)?.byEye === undefined) SNEAK.byEye = false;   // (…and from before a lit step was read by the eye that has the line)
  if ((k.tables.ROOMFIGHT as { coverKeep?: boolean } | undefined)?.coverKeep === undefined) ROOMFIGHT.coverKeep = false;   // (…and from before a man told to cover kept his angle)
  if ((k.tables.ROOMFIGHT as { doorShots?: boolean } | undefined)?.doorShots === undefined) ROOMFIGHT.doorShots = false;   // (…and from before rounds through a doorway kept his gun on it)
  if ((k.tables.UNSEEN as { wallBeat?: boolean } | undefined)?.wallBeat === undefined) UNSEEN.wallBeat = false;   // (…and from before a wall hold waited a beat to count as sneaking: the table itself is carried from that key on)
  if ((k.tables.ROOMFIGHT as { doorEars?: boolean } | undefined)?.doorEars === undefined) ROOMFIGHT.doorEars = false;   // (…and from before a teammate looked at a door an enemy's hand opens in his sight)
  if (!k.tables.AIR_SIM) AIR_SIM.on = false;   // (a file from before the air was a simulated field: no field is fed — a picture only, the run is the same either way)
  if (!k.tables.WX_OWN) WX_OWN.roofs = false;   // (a file from before a level's own storm rained by its own roofs: the office's two rectangles on every level)
  { const wo = k.tables.WX_OWN as Record<string, unknown> | undefined; if (!wo || !('wind' in wo)) WX_OWN.wind = false; }   // (… or from before its storm blew roof by roof: the roofs' bounding box kept the wind out of a yard — a later key of the same table)
  if (!k.tables.SNOW) SNOW.on = false;   // (a file from before a level built for snow was born in snow: it was played under the weather any level has)
  if (!k.tables.SNOW_LOOK) { SNOW_LOOK.on = false; SNOW_LOOK.wisps = false; }   // (a file from before a snow level's snow lay as one surface and the wind ran wisps over it: it was drawn as its painted boxes — picture only, kept with the recording so a replay shows what was played)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('tracks' in sl)) SNOW_LOOK.tracks = false; if (!sl || !('glow' in sl)) SNOW_LOOK.glow = false; if (!sl || !('sparkle' in sl)) SNOW_LOOK.sparkle = false; }   // (… or from before boots pressed trails into it and lamp light glowed through it, or its grains flashed a lamp back: later keys of the same table)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('breath' in sl)) SNOW_LOOK.breath = false; }   // (… or from before the men's breath steamed in the cold: a later key of the same table)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('steam' in sl)) SNOW_LOOK.steam = false; }   // (… or from before that breath was gas in the smoke solver: the puffs)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('grains' in sl)) SNOW_LOOK.grains = false; }   // (… or from before fine grains rode a simulated wind near the view: picture only, a later key of the same table)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('blast' in sl)) SNOW_LOOK.blast = false; }
  { const sb = k.tables.SNOWBOG as Partial<typeof SNOWBOG> | undefined; if (!sb || sb.on === undefined) SNOWBOG.on = false; }   // (a file from before thrown things bogged down in lying snow: a grenade bounced and slid on the pass as on a floor)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('past' in sl)) SNOW_LOOK.past = false; if (!sl || !('under' in sl)) SNOW_LOOK.under = false; }   // (… or from before the snow went on falling past the level's rim: picture only, a later key of the same table)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('marks' in sl)) SNOW_LOOK.marks = false; }   // (… or from before things marked the snow and a mark formed: picture only, a later key of the same table)
  { const sl = k.tables.SNOW_LOOK as Record<string, unknown> | undefined; if (!sl || !('oneAir' in sl)) SNOW_LOOK.oneAir = false; }   // (… or from before the snow was one snow in one air: picture only, a later key of the same table)   // (… or from before a blast marked the snow: picture only, a later key of the same table)
  if ((k.tables.GLASS as { bothFaces?: boolean } | undefined)?.bothFaces === undefined) GLASS.bothFaces = false;   // (…and from before a pane's crash was heard from both its faces: only from the point the round met it)
  if (!k.tables.DOORTHROW) DOORTHROW.on = false;   // (a file from before a door driven into a man moved him carries no such table: its leaves stop against whoever stands in their swing, as they were recorded)
  if ((k.tables.DOORTHROW as { soft?: boolean } | undefined)?.soft === undefined) DOORTHROW.soft = false;   // (… or from the first cut of it, where any driven leaf short of a boot folded him: a later key of the same table)
  if ((k.tables.DOORTHROW as { jolt?: boolean } | undefined)?.jolt === undefined) DOORTHROW.jolt = false;   // (… or from before the startled man got the shared start: the flinch, a later key of the same table)
  if (!k.tables.DOORSHOT) DOORSHOT.on = false;   // (a file from before gunfire took a door leaf apart carries no such table: its doors hang whatever is fired into them, as they were recorded)
  if ((k.tables.DOORSHOT as { flat?: boolean } | undefined)?.flat === undefined) DOORSHOT.flat = false;   // (… or from before a leaf's count was a cost that no longer rode the destruction scale: as a wall's, a later key again)
  if ((k.tables.DOORSHOT as { toll?: number } | undefined)?.toll === undefined) DOORSHOT.toll = 1;   // (… or from before a leaf stood twice plasterboard's toll: its doors go on drywall's own count, a later key of the same table)
  if (!k.tables.WINBARS) WINBARS.on = false;   // (a file from before a window's bar broke from one round carries no such table: its bars stop every round, as they were recorded)
  if (!k.tables.WALLPEN) WALLPEN.on = false;   // (a file from before rounds went through thin walls and doors — it carries no such table: its rounds stop in the first built thing they meet, as they were recorded)
  if (!k.tables.WALLSHOT) WALLSHOT.on = false;   // (a file from before a wall shot's smoke was thinned and its shock filled the room: its charges' pall and stun were the build's own)
  if (!k.tables.WALLKILL) WALLKILL.on = false;   // (a file from before a wall charge killed the man standing at it: its blasts dazzled him, and spared the player and a big team's men behind the wall)
  if (!k.tables.HARDBREATH) HARDBREATH.on = false;   // (a file from before a blown man breathed harder: his chest heaved by the life layer's own numbers)
  if (!k.tables.WALLCHARGE) WALLCHARGE.on = false;   // (a file from before the wall charge: its menus and Sam's rows were the build's without it)
  if (!k.tables.WALLS) assignDeep(WALLS as unknown as Record<string, unknown>, WALLS_DEFAULTS as unknown as Record<string, unknown>);
  if (typeof (k.tables.HANDS as { carryRide?: number } | undefined)?.carryRide !== 'number') { const Hn = knobTables().HANDS as { carryRide?: number } | undefined; if (Hn) Hn.carryRide = 0; }   // (a recording from before a carried body's limbs rode its carrier: they trail him as they did then)
}

// ================================================================================================================================ RECORD
export interface RecordOpts { seed?: number; note?: string; commit?: string; userAgent?: string; /** the page's HUD runs over this game (see EnvSnap.hud) */ hud?: boolean; }
/** The recorder the Game owns (`g.journal`). request() → 'pending'; the top of the next Game.update that may (canSave, no flash light in the set) takes the
 *  checkpoint, re-enters it, seeds the dice, puts the sensors into record and files frame 0; every update after is a frame until stop() hands back the file. */
export class SessionRecorder {
  state: JournalState = 'idle';
  /** pending: why it has not started yet; idle after a give-up / a stop: why */
  why = '';
  frame = 0;
  private opts: RecordOpts = {}; private pendingLeft = 0;
  private save: SaveState | null = null; private env: EnvSnap | null = null; private knobs: KnobsSnap | null = null; private seed = 0; private t0 = 0; private startedAt = '';
  private die: SimDie | null = null;
  private dts: [number, number][] = []; private views: number[][] = []; private cams: number[][] = []; private inputs: [number, InputRec][] = []; private digests: [number, GameDigest][] = [];
  private lastView = [NaN, NaN, NaN, NaN]; private lastCam = new Array<number>(8).fill(NaN); private lastKeys = '\n'; private lastButtons = NaN; private lastMouse = [NaN, NaN];
  private inUpdate = false;
  private slots: NonNullable<SessionFile['slots']> | null = null; private slotOwn = new Set<string>(); private serial = 0;
  /** which recording is under way (0 = none): a save in memory keeps the number it was made under (savestate.ts writeMem / loadMem) */
  get take(): number { return this.state === 'recording' ? this.serial : 0; }
  /** a running estimate of the streams' JSON size (the HUD's byte count; the sensors keep their own) */
  private bytes = 0;
  /** a stop asked for between frames: taken at the end of the next update, where the closing digest is the state a replay will compare (see stop) */
  private stopAfterNext: string | null = null;
  /** the last file made (stop) — kept for the console / a re-download */
  last: SessionFile | null = null;
  /** called when a recording stops for any reason with the file (main.ts downloads it), or with null and the reason when a pending request gave up */
  onStop: ((f: SessionFile | null, why: string) => void) | null = null;
  constructor(private g: Game) {}

  get recording() { return this.state === 'recording'; }
  get stopping() { return this.stopAfterNext !== null; }
  /** ask for a recording: it starts at the top of the next update that may (see canStart); false if one is already asked for / under way */
  request(opts: RecordOpts = {}): boolean { if (this.state !== 'idle') { return false; } this.opts = opts; this.state = 'pending'; this.pendingLeft = JOURNAL_PENDING_FRAMES; this.why = canStart(this.g) ?? ''; return true; }
  /** Give up a pending request / stop a recording. Between frames (F10 arrives before the frame's update) the stop is DEFERRED to the end of the next update and
   *  the file arrives through onStop then — the closing digest must be the state straight after an update, which is what a replay compares (the HUD nulls an
   *  expired speech bubble after the update, for one); `immediate` finalises now, for a caller that knows nothing has touched the game since the last update
   *  (the headless recorder), or a second F10 that will not wait. Returns the file when it was made here and now. */
  stop(why = 'stopped', immediate = false): SessionFile | null {
    if (this.state === 'pending') { this.state = 'idle'; this.why = why; return null; }
    if (this.state !== 'recording') return null;
    if (!immediate && !this.inUpdate) { this.stopAfterNext ??= why; return null; }
    return this.finish(why, !this.inUpdate);
  }
  /** The game is about to be changed BETWEEN frames by something no recording files — a checkpoint loaded off a card or the panel, a restart off a card, a
   *  show or a mission's quit staging the encounter again (savestate.ts Checkpoints.load / loadMem, Game.restartEncounter): the recording ends HERE, whole to
   *  its last frame, with `why` as how it stopped — a tape that ran on across the change replayed as a break of the game's own at that frame — and a new one
   *  is asked for with the same options, so one F10 still covers the session, as one file per stretch (it begins at the next update that may: canStart).
   *  Inside an update nothing is done: what changes the game there came from that frame's own input, which is on the tape. A request still pending stays.
   *  `lost`: the one change inside an update that no replay can make — a save in memory from before the recording put back (savestate.ts loadMem) — ends it
   *  there too, the frame filed whole and the file marked (`meta.lost`): that last frame is the Enter a replay takes another way, so no closing digest is
   *  taken of it and tools/qa/replay.ts plays to the frame before.
   *  Its checks: tools/qa/journalcut-check.ts, tools/qa/journalload-check.ts. */
  cut(why: string, lost = false): void {
    if (this.state !== 'recording' || (this.inUpdate && !lost)) return;
    const opts = this.opts; this.finish(why, !this.inUpdate, lost && this.inUpdate); this.request(opts);
  }
  /** THE STORE IS PART OF WHAT A RECORDING REPLAYS ON: the bare Enter once down (the frame's own input) goes back to a stored checkpoint. The file carries the
   *  store's rows as they stood at frame 0 (`slots`: savestate.ts tapeBegin; a save or an import made BETWEEN frames ends the recording first — Checkpoints.write
   *  / importText call cut — so the rows of frame 0 and the saves the updates make are all there is). A replay writes the recording's own saves again as it
   *  runs; the TEXT of any other slot an update reads is filed here with its frame, once, and tools/qa/replay.ts puts it in the store before that frame.
   *  slotWrote: an update of this recording wrote `key` (the replay will too). slotRead: an update read it (Checkpoints.load). */
  slotWrote(key: string): void { if (this.state === 'recording' && this.inUpdate) this.slotOwn.add(key); }
  slotRead(key: string, text: () => string | null): void {
    if (this.state !== 'recording' || !this.inUpdate || !this.slots || this.slotOwn.has(key)) return;
    const t = text(); if (t) { this.slots.loads.push([this.frame, key, t]); this.slotOwn.add(key); this.bytes += t.length + 24; }
  }
  /** `between`: finished between two frames (cut(), an immediate stop with no update running). The closing digest taken there is, on a page, the state AFTER
   *  the HUD's one write of the last frame (hudExpireBubbles below), not the one straight after its update: the file says so (`meta.between`) and a replay
   *  makes that write before it compares that digest (tools/qa/replay.ts). */
  private finish(why: string, between = false, lost = false): SessionFile {
    const g = this.g; this.stopAfterNext = null;
    if (this.inUpdate) { g.sensors.endFrame(); this.frame++; this.inUpdate = false; }   // (stopped from inside a frame — a hook, the cap: that frame is in the file whole)
    if (lost) { /* no digest of a frame no replay reaches */ }
    else if (!this.digests.length || this.digests[this.digests.length - 1][0] !== this.frame - 1) this.digests.push([this.frame - 1, digestGame(g, true)]);
    else between = false;   // (the last frame was a beat: its digest is the one straight after the update)
    const sensors = g.sensors.journal(); g.sensors.live();
    if (this.die) { if (Math.random === this.die && this.die.sys) Math.random = this.die.sys; this.die = null; }   // (the die it displaced goes back — unless somebody has since put their own in, which stays)
    const seconds = this.dts.reduce((s, [n, dt]) => s + n * dt, 0);
    const file: SessionFile = { v: lost || this.slots?.loads.length ? JOURNAL_VERSION_SLOTS : JOURNAL_VERSION, game: 'twopointsix', recordedAt: this.startedAt, commit: this.opts.commit, note: this.opts.note, seed: this.seed, level: levelFingerprint(g), save: this.save!, env: this.env!, knobs: this.knobs!,
      frames: this.frame, dt: this.dts, view: this.views, cam: this.cams, input: this.inputs, sensors, ...(this.slots ? { slots: this.slots } : {}), digests: this.digests, meta: { seconds: +seconds.toFixed(2), stopped: why, userAgent: this.opts.userAgent, ...(between ? { between: true } : {}), ...(lost ? { lost: true } : {}) } };
    this.state = 'idle'; this.why = why; this.last = file;
    try { this.onStop?.(file, why); } catch { /* the page's problem */ }
    return file;
  }

  /** Game.update's first statement: start if pending and allowed, then file this frame's dt / view / camera / input and open the sensors' frame */
  frameStart(dt: number, input: Input, cam: FollowCamera, view: View): void {
    if (this.state === 'idle') return;
    const g = this.g;
    if (this.state === 'pending') {
      const why = canStart(g);
      if (why) { this.why = why; if (--this.pendingLeft <= 0) { this.state = 'idle'; this.why = `gave up: ${why}`; try { this.onStop?.(null, this.why); } catch { /* */ } } return; }
      this.begin();
    }
    if (this.frame >= JOURNAL_MAX_FRAMES) { this.finish('cap'); return; }
    const f = this.frame; this.inUpdate = true;
    // dt (run-length)
    const L = this.dts[this.dts.length - 1]; if (L && L[1] === dt) L[0]++; else { this.dts.push([1, dt]); this.bytes += 26; }
    // canvas
    const vw = [view.clientWidth, view.clientHeight, view.width, view.height]; if (vw.some((x, i) => x !== this.lastView[i])) { this.views.push([f, ...vw]); this.lastView = vw; this.bytes += 28; }
    // camera as this update will read it
    const cv = [cam.target[0], cam.target[1], cam.target[2], cam.yaw, cam.pitch, cam.distance, cam.aspect, cam.fov]; let mask = 0; const vals: number[] = [];
    cv.forEach((x, i) => { if (!Object.is(x, this.lastCam[i])) { mask |= 1 << i; vals.push(x); this.lastCam[i] = x; } });
    if (mask) { this.cams.push([f, mask, ...vals]); this.bytes += 10 + vals.length * 19; }
    // input
    const rec: InputRec = {}; let any = false;
    const keys = [...input.keys].sort(); const kj = keys.join('|'); if (kj !== this.lastKeys) { rec.k = keys; this.lastKeys = kj; any = true; }
    if (input.pressed.size) { rec.p = [...input.pressed].sort(); any = true; }
    if (input.clicked) { rec.c = input.clicked; any = true; }
    if (input.buttons !== this.lastButtons) { rec.b = input.buttons; this.lastButtons = input.buttons; any = true; }
    if (input.mouseX !== this.lastMouse[0] || input.mouseY !== this.lastMouse[1]) { rec.m = [input.mouseX, input.mouseY]; this.lastMouse = [input.mouseX, input.mouseY]; any = true; }
    if (input.wheel) { rec.w = input.wheel; any = true; }
    if (any) { this.inputs.push([f, rec]); this.bytes += 12 + (rec.k ? 10 + rec.k.length * 8 : 0) + (rec.p ? 8 + rec.p.length * 8 : 0) + (rec.m ? 40 : 0) + (rec.c !== undefined ? 6 : 0) + (rec.b !== undefined ? 6 : 0) + (rec.w !== undefined ? 10 : 0); }
    g.sensors.beginFrame();
  }
  /** Game.update's last statement: close the sensors' frame, digest on the beat, count the frame */
  frameEnd(): void {
    if (this.state !== 'recording' || !this.inUpdate) return;
    this.inUpdate = false; this.g.sensors.endFrame();
    if ((this.frame + 1) % JOURNAL_DIGEST_EVERY === 0) { this.digests.push([this.frame, digestGame(this.g, true)]); this.bytes += 3000; }
    this.frame++;
    if (this.stopAfterNext !== null) this.finish(this.stopAfterNext);
  }
  private begin(): void {
    const g = this.g;
    this.save = saveState(g, { label: 'session journal', kind: 'harness' });
    loadState(g, JSON.parse(JSON.stringify(this.save)) as SaveState);   // (a copy: loadState keeps nothing of it, but the file must be the bytes as SAVED, untouched by anything a load might normalise in place)
    this.env = envSnapshot(g); this.env.hud = !!this.opts.hud; this.knobs = knobsSnapshot(g);
    this.seed = (this.opts.seed ?? ((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0)) >>> 0;
    this.die = simDie(this.seed, Math.random); Math.random = this.die;   // the simulation's dice from frame 0: seeded, the displaced die on .sys for the mixer / the solver (dice.ts sysRandom) and for the stop
    g.sensors.record();
    { const t = g.saves?.tapeBegin(); this.slots = t && (t.index !== null || t.lastAuto) ? { ...t, loads: [] } : null; this.slotOwn.clear(); this.serial++; }
    this.frame = 0; this.dts = []; this.views = []; this.cams = []; this.inputs = []; this.digests = []; this.bytes = 0;
    this.lastView = [NaN, NaN, NaN, NaN]; this.lastCam.fill(NaN); this.lastKeys = '\n'; this.lastButtons = NaN; this.lastMouse = [NaN, NaN];
    this.startedAt = new Date().toISOString(); this.t0 = g.time; this.state = 'recording'; this.why = '';
  }
  /** the HUD's tag while pending / recording ('' when idle): 'REC f=1234 · 38 KB' */
  hudText(): string {
    if (this.state === 'pending') return `REC waits: ${this.why || '…'}`;
    if (this.state !== 'recording') return '';
    return `REC f=${this.frame} · ${(this.approxBytes() / 1024).toFixed(0)} KB${this.stopAfterNext !== null ? ' · stopping' : ''}`;
  }
  /** the file's size so far, roughly (the sensors' own estimate + the streams here) */
  approxBytes(): number { return 38000 + this.bytes + this.g.sensors.approxBytes(); }   // (the checkpoint + env + knobs ≈ 38 KB, then the streams)
  summary(): string { return this.state === 'idle' ? `journal idle${this.why ? ` (${this.why})` : ''}${this.last ? ` · last: ${this.last.frames} frames / ${this.last.meta.seconds} s` : ''}` : this.state === 'pending' ? `journal pending — ${this.why}` : `journal RECORDING · frame ${this.frame} · ${(this.g.time - this.t0).toFixed(1)} s · seed ${this.seed} · ≈ ${(this.approxBytes() / 1024).toFixed(0)} KB · ${this.g.sensors.summary()}`; }
}
/** why a recording cannot start on this frame (null = it can): the checkpoint's own refusals (a show, daylight, a unit, Sam down / mid-action, a thing in the air, a
 *  body falling — savestate.ts canSave, unforced) plus a flash light alive in the set (a muzzle flash, a stroke: gone in a frame or two, and not in a checkpoint) */
export function canStart(g: Game): string | null {
  const why = canSave(g, false); if (why) return why;
  if (g.engine.lights.lights.some(l => l.ttl >= 0 || l.transient)) return 'a flash is still lit';
  return null;
}

/** The HUD's one write to the game (ui/bubbles.ts, after each frame's update on the game page): a speech bubble past its duration is nulled on its speaker — every
 *  reader in the game guards on the clock anyway, but the field is state (a checkpoint files it, the digest prints it, needs.ts reads its tail). Here so the page's
 *  bubbles and a REPLAY of a page recording (tools/qa/replay.ts, env.hud) make the very same write at the very same point; the headless harness never calls it. */
export function hudExpireBubbles(game: Game): void {
  const speakers = game.civilians.length ? [...game.guards, ...game.civilians] : game.guards;
  for (const s of speakers) { const b = s.bubble; if (!b || (s.state === 'dead' && !s.wound) || (s.civ && s.civ.state === 'gone')) continue; if (game.time - b.t > b.dur) s.bubble = null; }
  const pl = game.player, sb = pl.bubble; if (sb && !pl.down && game.time - sb.t > sb.dur) pl.bubble = null;
}

// ================================================================================================================================ REPLAY (the reading side of the streams)
/** Walks a file's per-frame streams: applyFrame(f, input, cam, view) puts frame f's dt / canvas / camera / input in place and returns dt. Frames in order only. */
export class SessionPlayer {
  private dtI = 0; private dtLeft = 0; private viewI = 0; private camI = 0; private inputI = 0;
  private buttons = 0; private mouse: [number, number] = [0, 0]; private keys: string[] = [];
  constructor(readonly file: SessionFile) { this.dtLeft = file.dt.length ? file.dt[0][0] : 0; }
  get frames() { return this.file.frames; }
  applyFrame(f: number, input: Input, cam: FollowCamera, view: View): number {
    const F = this.file;
    // dt
    while (this.dtLeft <= 0 && this.dtI + 1 < F.dt.length) { this.dtI++; this.dtLeft = F.dt[this.dtI][0]; }
    const dt = F.dt[this.dtI]?.[1] ?? 1 / 60; this.dtLeft--;
    // canvas
    while (this.viewI < F.view.length && F.view[this.viewI][0] <= f) { const r = F.view[this.viewI++]; view.clientWidth = r[1]; view.clientHeight = r[2]; view.width = r[3]; view.height = r[4]; }
    // camera
    let camTouched = false;
    while (this.camI < F.cam.length && F.cam[this.camI][0] <= f) {
      const r = F.cam[this.camI++]; const mask = r[1]; let j = 2; camTouched = true;
      for (let i = 0; i < 8; i++) if (mask & (1 << i)) { const x = r[j++]; if (i < 3) cam.target[i] = x; else if (i === 3) cam.yaw = x; else if (i === 4) cam.pitch = x; else if (i === 5) cam.distance = x; else if (i === 6) cam.aspect = x; else cam.fov = x; }
    }
    if (camTouched) cam.rebuild();
    // input: this frame's record if there is one; the edge sets are this frame's alone either way
    let rec: InputRec | null = null;
    while (this.inputI < F.input.length && F.input[this.inputI][0] <= f) { const [rf, r] = F.input[this.inputI++]; if (rf === f) rec = r; }
    if (rec?.k) this.keys = rec.k; if (rec?.b !== undefined) this.buttons = rec.b; if (rec?.m) this.mouse = [rec.m[0], rec.m[1]];
    input.keys.clear(); for (const k of this.keys) input.keys.add(k);
    input.pressed.clear(); for (const k of rec?.p ?? []) input.pressed.add(k);
    input.clicked = rec?.c ?? 0; input.buttons = this.buttons; input.mouseX = this.mouse[0]; input.mouseY = this.mouse[1]; input.wheel = rec?.w ?? 0;
    return dt;
  }
  /** the digests by frame, for the comparison after each update */
  digestAt(f: number): GameDigest | null { const d = this.digestMap ??= new Map(this.file.digests.map(([k, v]) => [k, v])); return d.get(f) ?? null; }
  private digestMap: Map<number, GameDigest> | null = null;
}

/** a file's sanity, in words ('' = fine): version, the blocks present, the streams' shapes */
export function checkSessionFile(F: Partial<SessionFile> | null | undefined): string {
  if (!F || typeof F !== 'object') return 'not an object';
  if (F.game !== 'twopointsix') return `not a twopointsix session (game ${JSON.stringify(F.game)})`;
  if (F.v !== JOURNAL_VERSION && F.v !== JOURNAL_VERSION_SLOTS) return `version ${F.v} (this build reads ${JOURNAL_VERSION} and ${JOURNAL_VERSION_SLOTS})`;
  if (!F.save || typeof F.save !== 'object') return 'no checkpoint (save)';
  if (typeof F.seed !== 'number' || typeof F.frames !== 'number' || F.frames < 0) return 'seed / frames missing';
  for (const k of ['dt', 'view', 'cam', 'input', 'digests'] as const) if (!Array.isArray(F[k])) return `stream '${k}' missing`;
  if (!F.sensors || !Array.isArray(F.sensors.keys) || !Array.isArray(F.sensors.recs)) return 'sensors block missing';
  if (!F.env || !F.knobs) return 'env / knobs missing';
  if (F.slots !== undefined) { const S = F.slots as Partial<NonNullable<SessionFile['slots']>> | null;
    if (!S || typeof S !== 'object' || (S.index !== null && typeof S.index !== 'string') || !Array.isArray(S.loads) || S.loads.some(l => !Array.isArray(l) || typeof l[0] !== 'number' || typeof l[1] !== 'string' || typeof l[2] !== 'string')) return 'slots block malformed'; }
  const n = (F.dt as [number, number][]).reduce((s, r) => s + (r[0] | 0), 0); if (n !== F.frames) return `dt runs cover ${n} frames, the file says ${F.frames}`;
  return '';
}
