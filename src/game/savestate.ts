// Checkpoints (STATUS G5): the whole encounter serialised to plain JSON — `saveState(g)` → SaveState v1, `loadState(g, s)` puts it back — plus the autosave rules,
// the slots in localStorage, export / import, and the down / pause cards' 'restart from checkpoint'. The QA harness (tools/qa/headless.ts snapshot / restore,
// probes.ts checkpoints, soak --checkpoint-at) runs the same two functions to start a situation mid-level.
//
// WHAT A CHECKPOINT HOLDS (SaveState below is the schema; every subsystem's slice sits next to the code that reads it back):
//   - the clock: Game.time itself (every stamp in the game is against it, so it comes back as it was — a load an hour into a page puts g.time BACK to the save's;
//     nothing outside the Game reads g.time), eventSeq, fxSeed, the OCP cooldown, the last half second of hearing events, the HUD's message lines;
//   - Sam: position / facing / crouch, the kit (slot, canisters, stun cans, the pistol's and the FN2000's chamber / magazine / spares / light / selector / attachment /
//     rings, 40 mm rounds, the OCP's charge), holstered, night vision, pace, keys, door codes, hits left, the whistle's breath; under SAVETIMELINE.holds his wall hold and
//     the close-in mode's held gait (without it NOT the wall hold: a load stands him free of it); NOT a body in tow, a man in his arm,
//     a lock / pad / leaf / drive under his hands, a wind-up, the launcher's button held on its arc, a reload half done — an autosave never happens mid-action, and a forced save drops them (see canSave);
//     a man alone with charges of his own (owncharge.ts): the optional `own` — the door tools' count, the wall charges carried, the door charges that stand set (put back on their
//     doors) and what his hands took from the bag this run; a WALL charge set and not blown is not saved — it is back in the count;
//   - every man of the level's roster (units — the response team, the showcase casts — are never in a checkpoint: a save is refused while any exists): state,
//     position / velocity / facing, awareness, the fix and its clocks, waypoint + wait, path, the errand (breaker / rack / device / check-on), the body script, the
//     lockdown pair / post, drawn, keys, weapon (row by id, chamber, magazine, bursts), the torch's clocks, dazzle / stagger, witness + interrogation records (sets as
//     arrays; the dealt script by id), muzzle / line-of-fire clocks, the search's fix time, his bubble, needs (levels + the trip under way), whistle memory; NOT his
//     search plan / doorway pie / standoff / flanking role (rebuilt within a frame by the code that deals them), nor a script (refused);
//   - BODIES: how / by whom / when he went down, found or not, the aftermath's counters, the ragdoll's sixteen particles and trunk rotation — a body comes back as
//     a SETTLED corpse at exactly those joint positions, asleep (Ragdoll.settleAt), not re-simulated: the frozen local pose under it is a neutral stance's rather
//     than the death frame's, so a sleeve's twist may sit a few degrees off; anything that disturbs it (a leaf, a drag) simulates on from there as ever;
//   - items on the floor (dropped guns / torches / magazines / spent cans / rings: kind, pose, who) with the guards' `dropped` links; an item still in the AIR or
//     on its FUSE is written as lying spent where it was — a checkpoint never re-throws a canister (autosave waits for them to land / go off anyway); a ring or a
//     40 mm round in FLIGHT is not an item and is not written (a plain save waits for it, canSave; a forced one files the count already spent and no round);
//   - doors (angle, velocity, latch, lock / broken keep, pick progress, noticed — and, while doors.ts DOORWAY is on, the pull in hand / press / driven clocks;
//     an angle saved on the side a door does not open into, a file from before it had one, is stood as wide on the side it does), loose furniture (pose + velocity, asleep or not), every light target (on /
//     broken / OCP restrike clock), the blackout record, the beacons follow; the devices (camera pan phase + integrator + report state, tripwire counts / clocks,
//     the log); the mission record whole; the CHRONICLE (timeline, counters, questioned, the path — thinned to ≤ PATH_KEEP points the way the chronicle thins itself
//     — so the debrief survives a load; a 'checkpoint' row is appended on save and on load); escalation level + clock, the alarm episode, rooms cleared, the radio
//     check's state, the tactics' kill-zone doorways, the ambient dialogue's ledger + the handler's radio state, the QRF's gunfire memory, the storm (rate, wind,
//     wetness, the stroke schedule AND its dice; a picked WEATHER KIND and its thunder mask's clock — weather.ts: headless a load puts the file's kind in, in the
//     page a file made in another weather than the URL's is refused), everybody's wet coat, the decal ring (bullet holes, scorch, scuffs, chips, glass stars — the level's memory of the
//     run; wet footprints are let go), the autosave controller's own memory (rooms visited, quiet clock, run id);
//   - what a blast took of the level: the walls' slice (wallbreak.ts) and the furniture's (furnblast.ts `furn`: the statics that broke, the props that came
//     apart) — each absent when nothing broke, each re-applied silently right after the restart; the PIECES on the floor are not written (no debris is);
//   - the CIVILIANS (civilians.ts CivSnap): each one's place and gait, her mark and its wait, the walk under way, her ears' marker, what frightened her (what /
//     where / armed), whom she is running to or has told (men by callsign, phones / doors by name), the corner and the 'stay down' promise, her dice, a downed
//     one's particles laid down asleep like the men's; the floor's queue of words due (a guard's radio call a beat after her report, control's call after she
//     got out) as data; one HELD at a forced save is filed held and comes off the vanished arm on the first frame after the load exactly as off a cancelled hold;
//   - the HOUR the level is being played at and its sun's strength (hours.ts; `hour`, absent for the level's own night): a load lays the file's hour over the
//     game BEFORE the restart — the light list, the sky, the outside lamps and the storm's switch follow the file, whatever hour the page was opened at;
//   - NOT SAVED, on purpose: smoke in the air (the solver's fields are GPU-resident and 100+ MB: a screen you were counting on is gone after a load, its can lies
//     there spent), sparks / tracers / GPU particles / muzzle flashes (transient), the light meter's readings (re-read next frame; visibility restarts at 0),
//     suppression scalars and aim-settle tracks (rest), what each man knew of a man behind breakable cover and the piece he was putting rounds into
//     (coverfire.ts: forgotten with the roster, re-learnt from his next sighting), speech in the air other than the bubbles' text, the audio mixer, the camera (main.ts snaps it to Sam);
//     and of the last half second's hearing events a WHISTLE is let go (whistle.ts resolves each event object once for the whole floor and everybody in earshot
//     heard it the frame it sounded — put back as a fresh object it would be answered a second time).
//     Nor the animator's own momentum: with the movement pass on (character.ts MOVES — the page; off under the harness) the recoil sums, the glide's spring and
//     a reaction under way restart on a load: poses a few centimetres off for a moment, so with it on 'continue ≡ load' is the harness's statement, not the
//     page's. The turn weight (TURN) IS filed, under SAVETIMELINE.turn: a man caught mid-turn carries the turn itself (GuardSnap.turn, character.ts turnSnap /
//     turnPut / bakeLoaded) and goes on coming round after a load; with the switch off, or in a file from before the key, he starts from rest, facing where
//     his weight had let him get to.
//
// DETERMINISM: the game's dice (barks, spread, jitter) come through math/dice.ts simRandom(). A game that OWNS its die (the page: host/standup.ts StandOpts.seed)
// has the stream's position in the file (`dice`), so the frames after a load roll what the frames after the save rolled. A game on Math.random (the QA harness)
// cannot have that stream captured — but everything ELSE
// that decides the next frame is in the file. So: with the QA harness's seeded Math.random re-seeded to the same value right after the save and right after the
// load, the next ten seconds digest identically (probes.ts checkpoints (a): continue-after-save ≡ load-into-the-same-game ≡ load-into-a-fresh-game, over
// guards / Sam / doors / mission / chronicle / lights / devices / items / civilians; tools/qa/dice-check.ts holds the same three ways for a game on its own die,
// with nothing re-seeded). In a browser page opened with ?seed=off the dice differ after a load, so a bark's wording or a round's millimetres may; nothing structural does. Exceptions by construction: a conversation two men were having is cut short (they walk on), a searcher re-deals his
// hiding spots, a flanking pair re-deals its roles, a whistle in the air is not answered again — all inside a second of the load.
//
// AUTOSAVE (Checkpoints.tick, once a frame at the end of Game.update): a REQUEST is raised by (1) the mission stage advancing, (2) Sam's first entry into a room
// region this run (chronicle.ts roomOf), (3) a body let go of ≥ BODY_HIDE_M from where he took hold of it ('hidden'), (4) every QUIET_SECS (90) of undetected
// play; a request is WRITTEN once the gates pass — a live run (missionLive: not the tour / attract / breach, not done or failed), the AI on, no man alert or
// searching or with awareness > AWARE_MAX (0.4), no civilian startled / frightened / running / telling / on the phone, none hiding from HIM untold, no word of
// theirs still on its way (civilians.ts civilianCompromise), Sam not down and not mid-action (pick / code / ease / kick / takedown / hold / drag / drive / a
// wind-up or a canister not yet gone off / a reload), no unit on the floor and the QRF idle, nobody scripted, DEBOUNCE_SECS (2) after the request and never within
// MIN_GAP_SECS (10) of the last save — and DROPPED if the gates have not passed within PENDING_SECS (25). Each autosave: the next of AUTO_SLOTS (3) rotating
// slots in localStorage (`twopointsix.save.auto.N`, index in `twopointsix.save.index`), a 'checkpoint' row in the chronicle, a discreet CHECKPOINT tag on the
// HUD (overlay.ts reads `flash`). One MANUAL slot besides (`twopointsix.save.manual`: Tab ▸ Checkpoints ▸ save now, or an import). Sizes: ~40–90 KB typical, the
// worst case (700 timeline rows, 512 decals, PATH_KEEP path points) under 200 KB — `SaveResult.bytes` says.
//
// REFUSED (canSave → a reason): the tour / attract / breach or any puppet beat, daylight, a unit on the floor or the QRF past idle (the response is a set piece:
// no checkpoint inside it), Sam down, the run OVER (stage failed / done — a civilian killed under tune.civilianKillFails fails it with Sam still standing; canLoad
// refuses such a file too rather than pour it over a living man), a body (a man's or a civilian's) still falling, a man scripted or the lockdown pair clearing
// rooms (unless `force`, which files them as searching men and drops the drill), Sam mid-action (unless `force`, which lets go of everything the way a teleport
// does — in the FILE, never in the running game: saving is read-only).
import { SideMap, rollbackVar, wallClock, HostOwned } from '../math/side';
import { loadSandbox } from './sandbox';
import { hostileTo } from './teams';
import { Vec3, v3, quat, clamp } from '../math/vec';
import { Game, Guard, Player, KIT_ORDER } from './game';
import { WAND } from './wand';
import { quietWand } from './quietfog';   // (called inside saveState / loadState only)
import { STICKY, stickyFlying, stickyLeft, stickySnapshot, stickyRestore, type StickySnap } from './stickycam';
import { OWNCHARGE } from './owncharge';
import { BIGSLOT } from './kit';
import type { BigKit } from './kit';
import { KITLOAD, type KitWorn } from './kitload';
import type { QuietSnap } from './quiet';
import type { FogSnap } from './fogofwar';
import { quietWords } from './quiet';   // (called inside functions only: src/game is one import cycle)
import type { LessonSnap } from './lesson';
import type { ParSnap } from './par';
import type { SnatchSnap } from './snatch';
import type { DefuseSnap } from './defuse';
import { woundRestore, type Wound } from './wounds';
import type { GameEvent, LightTarget, MissionStage, Mission, SlotKind, ThrowKind, Witness, GuardState, DownKind, DownBy, GuardTask } from './game';
import { Firearm, Pistol, Rifle, WEAPONS } from './weapons';
import { aimWeightSnapshot, aimWeightRestore } from './aimweight';
import type { WeaponId, FireMode } from './weapons';
import type { Item, ItemKind } from './throwables';
import { DOORWAY, type DoorDrive } from './doors';
import { slabSnapshot, slabRestore, type SlabSnap } from './doorblast';
import { RAG_COUNT } from './ragdoll';
import { Chronicle, chronCheckpoint, roomOf, MAX_EVENTS } from './chronicle';
import type { ChronEvent, ChronCounts, ChronKind, ChronData } from './chronicle';
import { missionLive } from './mission';
import { attachFlashlight, rollcallState, escalationOf, forgetGuardClocks } from './guards';
import { forgetSuppressionClocks } from './suppression';
import { glassState } from './glass';
import { isDaylight, setDaylight, updateTargets } from './lighting';
import { updateFire } from './fire';
import { lampGlass } from './carlamps';
import { needsSnapshot, needsRestore } from './needs';
import { gunWallSnapshot, gunWallRestore } from './gunwall';
import { wallHoldSnapshot, wallHoldRestore, type WallSnap } from './player';
import { CLOSE, closeModeSnapshot, closeModeRestore } from './close';
import { stalkReset } from './stalk';
import { tapReset } from './tapstep';
import { calmTorchSnapshot, calmTorchRestore, calmTorchPosed, type CalmTorchSnap } from './calmtorch';
import { dozeSnapshot, dozeRestore, type DozeSnap } from './doze';
import { moraleSnapshot, moraleRestore, type MoraleSnap } from './morale';
import { runnerSnapshot, runnerRestore, type RunnerSnap } from './runner';
import { darkDoorSnapshot, darkDoorRestore, type DarkDoorSnap } from './darkdoor';
import { startleSnapshot, startleRestore, type StartleSnap } from './startle';
import { flinchSnapshot, flinchRestore, type FlinchSnap } from './flinch';
import { netQuietSnapshot, netQuietRestore, type NetQuietSnap } from './netquiet';
import { powerOutSnapshot, powerOutRestore, type PowerOutSnap } from './powerout';
import { rescueCheckSnapshot, rescueCheckRestore, type RescueCheckSnap } from './rescuecheck';
import { attentionSnapshot, attentionRestore, type AttentionSnap } from './attention';
import { pictureSnapshot, pictureRestore, type PictureSnap } from './picture';
import { RESPONSE, responseWordSnapshot, responseWordRestore, type ResponseWordSnap } from './qrf';
import { gearText } from './gear';
import type { NeedsSnap } from './needs';
import { whistleSnapshot, whistleRestore } from './whistle';
import { glassPenSnapshot, glassPenRestore, type GlassPenSnap } from './glasspen';
import type { WhistleSnap } from './whistle';
import { tacticsSnapshot, tacticsRestore } from './tactics';
import { lanesSnapshot, lanesRestore, type LanesSave } from './lanes';
import type { TacticsSnap } from './tactics';
import type { WallsSave } from './wallbreak';
import type { FurnSave } from './furnblast';
import { barsSnapshot, barsCheck, barsRestore, type BarsSave } from './winbars';
import type { LaySnap } from './planlay';
import { PLANLAY, laySnapshot, layRestore } from './planlay';
import { CMDRING, ringRestore } from './cmdring';
import type { PlanSnap } from './planmode';
import { planSnapshot, planRestore } from './planmode';
import { dialogueSnapshot, dialogueRestore, peekScript, forceScript, forcedScriptOf, hashStr } from './dialogue';
import type { DialogueSnap } from './dialogue';
import { civiliansSnapshot, civiliansRestore, civilianCompromise } from './civilians';
import type { CivSnap } from './civilians';
import type { WeatherSnap } from './weather';
import type { AirDustSnap } from './airDust';
import { hourOf, hourIdOf, applyHour, setSunStrength, sunStrength, sunGiven, type HourId } from './hours';
import type { DevicesSnap } from './devices';
import type { DecalKind } from '../render/decals';
import type { Box } from '../scene/boxes';
import { authoredC, authoredH } from '../scene/round';   // (leaf helpers: a round thing's boxes as the level file has them)
import { LOOK_DECALS, lookDecal } from './lookDecals';
import { diceInUse } from '../math/dice';
import { sprintDoorTurning } from './sprintdoor';
import { seenReset } from './seenwalk';
import { takeSnapshot, restoreSnapshot, type Snapshot } from './rollback';   // (called inside Checkpoints only)

// ================================================================================================================================ the schema
export const SAVE_VERSION = 1;
type V3 = [number, number, number];
type Q4 = [number, number, number, number];

export interface FirearmSnap { id: WeaponId; chamber: number; mag: number | null; spare: number[]; shotsFired: number; mode: FireMode; bursts: number; lastBurstT: number; }
export interface PlayerSnap {
  pos: V3; bodyYaw: number; aimYaw: number; aimPitch: number; crouch: boolean; holstered: boolean;
  slot: SlotKind; throwKind: ThrowKind; canisters: number; flashbangs: number; /** frag grenades (absent in a file from before them: the issue stands) */ frags?: number;
  /** the optical wand is on him (wand.ts; written only while its switch is on — absent = the file does not say, and a load leaves what the staging put on him) */ wand?: boolean;
  /** the breaching shotgun or the hammer in his big slot (kit.ts BIGSLOT; written only while its switch is on — absent = the file does not say, as the wand's) */ bigKit?: BigKit;
  /** what his card weighs (kitload.ts: its two scores and his reference's — written while its switch is on, null for a man with nothing weighed; absent = the file does not say) */ kitLoad?: KitWorn | null;
  /** HIS OWN CHARGES, a man alone (owncharge.ts; written only while its switch is on and nobody of his is on the floor — a checkpoint is refused with a unit up
   *  anyway): what the door tools' bag and the wall charge still hold for him, `doors` = the door charges that stand set ([door index, face]: put back on their
   *  doors by a load), `spent` = what his hands have taken from the bag this run. A WALL charge set and not blown is not saved, so it is back in the counts.
   *  `walls` null = the run carried no wall charges of its own. Absent = the file does not say: the counts the staging wrote stand */ own?: OwnCharges;
  pistol: FirearmSnap & { lightOn: boolean }; rifle: FirearmSnap & { lightOn: boolean; attIdx: number; rings: number; ringCd: number; /** the long gun, when it is not the FN2000 (kit.ts 'shotgun') */ gun?: WeaponId ; /** 40 mm rounds (absent in a file from before them: the issue stands) */ shells?: number; /** sticky cameras left for the tube (stickycam.ts; written only while its switch is on: −1 = none were issued, absent = the file does not say and what the staging put on him stands) */ cams?: number };
  /** his sticky cameras that are out, stuck (stickycam.ts; absent with none) */ cams?: StickySnap[]; /** the last camera id handed out this run (absent = none sent, or a file from before it: the highest id that is out stands) */ camSeq?: number;
  ocpCharge: number; hasRifle: boolean; rifleGone: boolean; ocpHinted: boolean; equipT: number;
  /** the close-in mode's held gait under his walk (character.ts heldGaitSnap: its clock, weight, pace, and the mode) — written only inside the mode and under SAVETIMELINE.holds; absent = it begins from nothing, as it did */ heldGait?: number[];
  /** …and the man the mode is held on, by character id (close.ts closeModeSnapshot) */ closeOn?: number;
  ripU?: number; bashAt?: number; bashLean?: number; stagU?: number; hurtAt?: number; dazU?: number; dazAt?: number[]; aw?: number[]; keys: string[]; codes: string[]; hitsLeft: number; nv: boolean; pace: number; lastFireT: number; fireCd: number; noise: number; visibility: number; stepPhase: number; stepTravel?: number; animPhase: number;
  wet: V3;   // coat, beads, rain
  bubble: Bubble | null;
}
export type Bubble = { text: string; t: number; dur: number; radio: boolean };
export type TaskSnap = { kind: 'breaker' | 'rack' | 'device'; pos: V3 } | { kind: 'checkOn'; pos: V3; who: number; wp: number; left: number; t0: number };
export interface TalkSnap { stage: number; presses: number; said: string[]; saidN: [string, number][]; given: string[]; lastT: number; heldSince: number; abortT: number; script: string | null | undefined; }
export interface RagSnap { x: number[]; rot: Q4; sleeping: boolean; /** the trunk's rest shape is these particles' own on a load (Ragdoll.settleAt `own`); absent in a file from before it: the trunk is snapped to the fresh figure's stance, as it was */ own?: boolean; }   // (sleeping false = a forced / harness file caught him mid-fall: he is laid at those particles and let go of, to fall from rest)
export interface GuardSnap {
  id: number; routeI: number; callsign: string; state: GuardState;
  pos: V3; vel: V3; bodyYaw: number; aimYaw: number; aimPitch: number; crouch: number; animPhase: number;
  /** the turn he was in the middle of (character.ts turnSnap: nine numbers; TURN — the page; written and read only under SAVETIMELINE.turn): absent with the
   *  turn weight off, on a body, and in a file from before the key, where he starts from rest facing where his weight had let him get to */
  turn?: number[];
  wp: number; wait: number; awareness: number; lastKnown: V3 | null; lastSeenT: number;
  found: boolean; downKind: DownKind | null; downBy: DownBy | null; keys: string[];
  wound?: Wound & { clock?: number };   // (wounds.ts: down wounded — posed, not a ragdoll: `rag` is null for him and the pose is laid again from this; absent on everybody else)
  missedAt: number; missingRaised: boolean;
  muzzleDown: boolean; muzzleClearT: number; muzzleEvalT: number; lineBarkT: number; lineInT: number;
  leaderSeenT: number; leaderSeenPos: V3; leaderStillT: number;
  bodyVisits: number; bodyVisitT: number; bodyRemarked: boolean; bodyClosed: boolean; bodyFan: number;
  bodyDuty: { body: number; role: 'finder' | 'called'; stage: 'to' | 'cover' | 'fan'; t: number; t0: number; spot: V3 | null } | null;
  dropped: number;   // index into SaveState.items, −1 none
  gunLostAt: number; torchLostAt: number; lightLitAtLoss: boolean; lightDeadUntil: number; flashlightOn: boolean; sweep: number; beamDir: V3;
  path: V3[]; pathI: number; repathT: number; pathGoal: V3 | null;
  weapon: FirearmSnap; fireCd: number; reactT: number; searchT: number; lookPhase: number; speed: number; stepPhase: number; heardUpTo: number;
  diedAt: number; dazzledUntil: number; staggerUntil: number; hurtAt?: number; doorDownU?: number; lastPos: V3; stuckT: number; stuckN: number; killerId: number; sawBodyT: number;
  alertBest: number; alertStallT: number; alertRef: V3 | null; chaseT: number; shotBlockedT: number;
  sightPos: V3; sightVel: V3; sightT: number; ledT: number; fixT: number; fixRef: V3 | null;
  pieLast: number; pieLastT: number; piePrev: V3 | null; piePrevT: number;   // pieLast: door index, −1 none
  stallRef: V3 | null; stallT: number;
  task: TaskSnap | null; drawn: boolean; leader: number; followT: number; followGoal: V3; post: string | null;   // leader: guard index (−1); post: chokepoint name
  witness: Witness; talk: TalkSnap; bubble: Bubble | null;
  wet: V3;
  rag: RagSnap | null;   // the body's particles (dead only)
}
export interface ItemSnap { kind: ItemKind; pos: V3; yaw: number; tumble: number; heading: number; fill: number; life: number; age: number; fired: boolean; emitT: number; who: number; on: number; onPose: number; radius: number; restitution: number; friction: number; }
export interface DoorSnap { name: string; angle: number; vel: number; quietT: number; latched: boolean; lastWho: number; sinceBash: number; closing: boolean; locked: boolean; lockBroken: boolean; noticed: boolean; noticedT: number; pick: number; pickIdle: number; pickClock: number; pickN: number; guardT: number; creakArmed: boolean; /** doors.ts DOORWAY, written only while it is on: the pull in hand, the press on its pull face, the seconds since it was driven open */ pullT?: number; pressT?: number; solidT?: number; openT?: number; /** who is stepping through the leaf right now (Door.passers), written only under DOORWAY / DOORSTAY and only when somebody is: a pulled leaf and an open one stepped through by its edge make it common state */ passers?: number; /** Door.swept (DOORSTAY), written only when set: brought toward its frame by a keyed man's body alone — it rests to, unlatched */ swept?: boolean; /** doorblast.ts DOORSHOT: the rounds' work the hung leaf has taken (written only when it has taken some) */ shot?: number; off?: SlabSnap; drive?: DoorDrive | null; }   // off: lying off its hinges (doorblast.ts) — absent for a hung door
export interface PropSnap { x: number; z: number; yaw: number; vx: number; vz: number; w: number; asleep: boolean; idle: number; lastWho: number; noiseT: number; pushT: number; }
export interface TargetSnap { name: string; on: boolean; broken: boolean; disabledUntil: number; /** the game time a hand put it out at its wall switch (lightswitch.ts LightTarget.handOff) — written only when set */ hand?: number; }
// (NOT saved either: wall wear's per-cell lists — wallwear.ts: the marks themselves ride this slice as the kind / radius / param they had; after a load they stop
//  growing with their cell, new rounds are marked at the strength of the count the file carried.)
export interface DecalSnap { kind: DecalKind; pos: V3; n: V3; t: V3; radius: number; param: number; seed: number; pane?: number; door?: number; prop?: number; part?: number; look?: 1; }   // pane: a glass star's static; door / prop+part: what it rides — all absent for a world-fixed mark (the commonest: kept out of the file)
export interface ChronSnap { events: ChronEvent[]; dropped: number; counts: ChronCounts; questioned: string[]; path: number[]; pathN: number; pathEvery: number; pathNext: number; }
export interface RollcallSnap { nextAt: number; stage: 'idle' | 'called' | 'asked'; t0: number; caller: number; missing: number; answered: boolean; checks: number; }
export interface AutosaveSnap { runId: string; visited: string[]; quietT: number; lastSaveT: number; bodyFrom: V3 | null; }
export interface SaveState {
  v: number; savedAt: number; label: string; kind: 'auto' | 'manual' | 'harness';
  level: { fp: string; boxes: number; routes: number; doors: number };
  /** the mission clock at the save and the stage — for the card's '(N s ago)' and the slot list without parsing the rest */
  missionT: number; stage: MissionStage; runId: string;
  time: number; eventSeq: number; fxSeed: number; ocpCooldown: number; calledIn: boolean; stoodDown: boolean; breakerFixT: number; lastStingT: number;
  escalation: 0 | 1 | 2; escalationT: number; alarm: { episode: boolean; pos: V3; placed: boolean; apartT: number; raisedAt: number }; clearedAt: [string, number][]; clearRooms: number;
  blackout: { active: boolean; until: number | null; since: number; permanent: boolean; restoredAt: number };
  flags: { aiEnabled: boolean; godMode: boolean; infiniteAmmo: boolean; playerInvisible: boolean };
  /** what the fog of war holds another way than the world stands: doors, lamps, furniture as the team last saw them, the bodies it has seen (fogofwar.ts
   *  FogSnap; FOG.filed). AN EMPTY SLICE IS NOT NO SLICE: `{}` says the fog was up and held nothing, and its load still makes the furniture's memory, so no
   *  opening half second follows; absent (the row off, the fog off, a file from before the slice) the picture after the load has everything as it stands */
  fog?: FogSnap;
  /** a quiet mission's deal (quiet.ts QuietSnap: which start, spot and patrol set the run was dealt) — absent on the plain night */
  quiet?: QuietSnap;
  /** a training lesson's place among its steps (lesson.ts LessonSnap) — absent off a lesson level or with the lesson switched off */
  lesson?: LessonSnap;
  /** a par's clock (par.ts ParSnap) — absent off a par level or with the par switched off */
  par?: ParSnap;
  /** the plan laid for the word and the one kept for the next try — planlay.ts; absent with its switch off */
  lay?: LaySnap;
  /** plan mode: the men picked and the chains they are on — planmode.ts; absent with its switch off */
  plan?: PlanSnap;
  /** a snatch level's man: hands up / tied / how it ended (snatch.ts SnatchSnap) — absent off a snatch level */
  snatch?: SnatchSnap;
  /** a defuse mission's clock and charges (defuse.ts DefuseSnap) — absent off a level with the block */
  defuse?: DefuseSnap;
  player: PlayerSnap; guards: GuardSnap[]; items: ItemSnap[]; doors: DoorSnap[]; props: PropSnap[]; propsTime: number; targets: TargetSnap[];
  devices: DevicesSnap | null; mission: Mission; chronicle: ChronSnap; events: GameEvent[]; messages: { text: string; t: number }[];
  rollcall: RollcallSnap; needs: NeedsSnap; whistle: WhistleSnap; tactics: TacticsSnap; dialogue: DialogueSnap; weather: WeatherSnap | null; qrf: { loudT: number; word?: ResponseWordSnap[] };
  /** the cleaner / the late worker (civilians.ts CivSnap) — absent in a file from before the slice: the fresh ones stay on their marks, ears set right */
  civilians?: CivSnap | null;
  /** WALL BREAKING (wallbreak.ts WallsSave): which cells of which partitions / cover are gone, the damage the rest carry, the leaves' — absent = the level as
   *  authored (and in every file from before the slice) */
  walls?: WallsSave;
  /** the covered lanes a side has learnt (lanes.ts): only present while one is known */
  lanes?: LanesSave;
  /** FURNITURE A BLAST BROKE (furnblast.ts FurnSave): the statics it took and the props that came apart — absent = none (every file from before the slice) */
  furn?: FurnSave;
  /** WINDOW BARS A ROUND OR A BLAST TOOK (winbars.ts BarsSave): the statics that are gone — absent = none (every file from before the slice) */
  bars?: BarsSave;
  /** the weather's dust in the rooms (airDust.ts): the field where it is off the leak, the openings as last asked — absent: no weather in, the switch off, or a file from before it */
  air?: AirDustSnap;
  decals: DecalSnap[]; autosave: AutosaveSnap;
  /** where rounds have gone THROUGH panes (glasspen.ts: a later round by a hole pays a quarter) — absent when there are none, and in every file from before the slice */
  glassPen?: GlassPenSnap;
  /** whose gun a wall holds down (character ids) — gunwall.ts; absent with its switch off or nobody at a wall */
  gunWall?: number[][];
  /** Sam's wall hold as it stands, and the key-less take's clock (player.ts wallHoldSnapshot) — written only under SAVETIMELINE.holds and with something to say;
   *  absent = a load stands him free of the wall, as every file before it did */
  wallHold?: WallSnap;
  /** each roster man's calm-patrol torch: dark, the last reading of his place, the dwell's two counts — calmtorch.ts; absent with its switch off or nobody met */
  calmTorch?: CalmTorchSnap;
  /** who sits in which chair, who sleeps, who was woken and by what — doze.ts; absent with its switch off or nobody on a record */
  doze?: DozeSnap;
  /** each roster man's dread and the sequence it has him in, and the blasts not yet asked about — morale.ts; absent with its switch off or nobody met */
  morale?: MoraleSnap;
  /** each roster man's run — the shout's beat, the weapon gone, where he is going — runner.ts; absent with its switch off or nobody has run */
  runner?: RunnerSnap;
  /** each roster man's start at a first sight — when he last stood calm, the beat he is in — startle.ts; absent while no man has a record */
  startle?: StartleSnap;
  /** each green roster man's seconds under close fire — flinch.ts; absent while no man has a count */
  flinch?: FlinchSnap;
  /** each roster man's part in a balk at a dark doorway — stopped, called, going in — and the doors that will not stop him again yet — darkdoor.ts; absent with its switch off or nobody met */
  darkdoor?: DarkDoorSnap;
  /** each roster man's count of mates gone quiet, the line he owes, his whip and the last man's act — netquiet.ts; absent with its switch off or nobody met */
  netQuiet?: NetQuietSnap;
  powerOut?: PowerOutSnap;
  /** the rescue's radio check (rescuecheck.ts): absent with its switch off or outside a rescue */
  rescueCheck?: RescueCheckSnap;
  /** each roster man's held attention (where, what, how long is left) and his memory of the takings — attention.ts; absent with its switch off or nobody met */
  attention?: AttentionSnap;
  /** each roster man's ideas of his enemies (where, how old, how he came by each) and what Sam's eyes have put on the squad's net — picture.ts; absent with its switch off or nothing known */
  picture?: PictureSnap;
  /** where the Game's OWN die stands (math/dice.ts) — only in a file written by a game that was rolling one: a load into a game with its own die puts the stream
   *  back, so the frames after a load roll what the frames after the save rolled. Absent (the harness on a seeded Math.random, a recording's frame 0): nothing to restore */
  dice?: { s: number; n: number; seed: number };
  /** the hour the level was being played at and its sun's strength (hours.ts) — ABSENT for the level's own night, so a night's file is the file it always was;
   *  a load puts the game at the file's hour (the session journal's frame 0 is a checkpoint: a recording made by day replays by day) */
  hour?: { id: HourId; sun: number; /** the strength was set by hand (?sun=, the slider) — false: left to the weather's cloud, which may move it again; absent (a file from before weather met the hour): set iff it is not 1 */ given?: boolean };
  /** what a forced save had to let go of (documentation in the file itself: 'holding Novak', 'picking storage', 'clearing drill') */
  forced: string[];
}

// ================================================================================================================================ knobs
export const CKPT = {
  /** the undetected-play autosave: every this many seconds of a quiet live run */
  quietSecs: 90,
  /** the compromise line: no autosave while any living man's awareness is over it (or anybody is alert / searching) */
  awareMax: 0.4,
  /** a request waits this long (more triggers inside it are the same save), never lands within minGap of the last save, and lapses unmet after pendingSecs */
  debounceSecs: 2, minGapSecs: 10, pendingSecs: 25,
  /** a dragged body let go of at least this far from where it was taken hold of counts as hidden */
  bodyHideM: 1.5,
  /** rotating autosave slots; the chronicle path is thinned to at most this many points in the file */
  autoSlots: 3, pathKeep: 1000,
  /** how long the HUD's CHECKPOINT tag shows */
  flashSecs: 2.6,
  /** an autosave followed inside this many seconds by a man going alert / an alarm episode is REGRETTED: kept, but the cards and the Enter path offer the one before it (a checkpoint written a stride before he was seen is a death loop, not a checkpoint) */
  regretSecs: 8,
};
/** THE SAVE TIMELINE (after a play test: one checkpoint to go back to is awkward, most of all in a lesson that has got away from its player). OFF here and on
 *  the frozen stand (`TPS_SAVETIMELINE=1` raises it), ON in the page (`?savetimeline=0` puts it off). Off = three rotating autosaves, one slot by hand, nothing
 *  kept with a team on the floor: the build as it was. On:
 *    - the saves ROLL in two rings, `auto` autosaves and `manual` saves by hand (F5 in play — player.ts asks, the end of that update writes): neither kind pushes
 *      out the other, and the slots an older build wrote are read, listed and loaded as they are (same keys, same index; the one old manual slot is the ring's first);
 *    - every save keeps a small PICTURE of its moment, taken by the host (`Checkpoints.picture`: the simulation never sees a canvas) and stored beside the slot
 *      (`…pic.<slot>`); a picture that does not fit is dropped, and a save that does not fit has every picture thrown out for it before it is given up;
 *    - WITH A TEAM ON THE FLOOR, where no file can be written (a unit has no slice), the save is the whole game kept in memory (rollback.ts takeSnapshot) and
 *      put back in place: this run's only, gone with the page or the run — the cards list both kinds on one strip (`timeline`), in the mission clock's order. */
export const SAVETIMELINE = {
  on: false,
  /** how many saves by hand and how many autosaves are kept — two rings */
  manual: 5, auto: 5,
  /** a save carries what Sam's body is in the middle of holding: his wall hold with the key-less take's clock (player.ts wallHoldSnapshot), and the close-in
   *  mode's held gait with the man it is held on (character.ts heldGaitSnap, close.ts closeModeSnapshot) — so the seconds after a load are the seconds after
   *  the save. false = no file says any of it, and a load stands him free of the wall and begins the gait from nothing, as it was. Its own key, whatever `on` says. */
  holds: false,
  /** a save carries the turn a man is in the middle of (GuardSnap.turn; character.ts turnSnap / turnPut / bakeLoaded — the turn weight, TURN): a man caught
   *  mid-turn goes on round after a load as he did in the run that went on. false = no file says it, and he starts from rest facing where he had got to, as it
   *  was. Its own key, whatever `on` says; with TURN off there is no turn to file and it writes nothing. */
  turn: false,
  /** a save in memory (a team on the floor) is taken SINCE the one before it — or the one last put back: rollback.ts `takeSnapshot(g, since)` goes through what
   *  that snapshot held and copies only what has changed, where a whole take walks the game and copies all of it. Less of a stall (headless: about a third
   *  of a whole take with saves a minute and a half apart, less of a gain after a load; not measured in a browser), and a load puts back the same game — plus
   *  whatever the snapshot it was taken since held that the game has let go of, which nothing in the game reaches. The first save of a run, after a file's load and of a
   *  recording is a whole take either way. false = every save in memory a whole take, as it was. */
  since: false,
  /** the long side of a save's picture in pixels, and its JPEG quality (the host's numbers: main.ts takes the picture) */
  picPx: 256, picQ: 0.6,
};
const KEY_PREFIX = 'twopointsix.save.';
const KEY_INDEX = KEY_PREFIX + 'index', KEY_MANUAL = KEY_PREFIX + 'manual', KEY_AUTO = (i: number) => `${KEY_PREFIX}auto.${i}`, KEY_AUTOSAVE_ON = 'twopointsix.autosave';
/** SAVETIMELINE: the ring of saves by hand (its first is the one slot the build always had), a slot's picture, a save kept in memory */
const KEY_HAND = (i: number) => i === 0 ? KEY_MANUAL : `${KEY_MANUAL}.${i}`, KEY_PIC = (key: string) => `${KEY_PREFIX}pic.${key.slice(KEY_PREFIX.length)}`, KEY_MEM = (slot: 'auto' | 'manual', i: number) => `${KEY_PREFIX}mem.${slot}.${i}`;

// ================================================================================================================================ small helpers
const c3 = (p: ArrayLike<number>): V3 => [p[0], p[1], p[2]];
const c3n = (p: ArrayLike<number> | null | undefined): V3 | null => p ? c3(p) : null;
const r3 = (p: ArrayLike<number>, k = 1000): V3 => [Math.round(p[0] * k) / k, Math.round(p[1] * k) / k, Math.round(p[2] * k) / k];   // presentation-only vectors go to the millimetre; anything the simulation integrates keeps every bit
const fin = (x: number, d = 0) => Number.isFinite(x) ? x : d;
/** JSON has no Infinity: an 'until' of Infinity (a breaker thrown for good) travels as null */
const infOut = (x: number): number | null => Number.isFinite(x) ? x : null;
const infIn = (x: number | null): number => x === null ? Infinity : x;
function deepClone<T>(x: T): T { return x === undefined ? x : JSON.parse(JSON.stringify(x)); }
/** the level a checkpoint belongs to: door names + route names + box count hashed (a checkpoint of another level, or of this one re-exported with a door
 *  renamed, is refused rather than poured over the wrong indices) */
export function levelFingerprint(g: Game): SaveState['level'] {
  const cached = fpCache.get(g.level); if (cached) return cached;
  const L = g.level; const nBox = g.destr?.walls?.authored ?? L.boxes.length;   // (the AUTHORED statics only: wall breaking appends pieces to the list at runtime — the level is still the level)
  let geo = 0x811c9dc5;   // + every static's centre and half-extents to the centimetre: a re-export that MOVES geometry under the same names and counts is another level to a checkpoint
  for (let i = 0; i < nBox; i++) for (const v of [...authoredC(L.boxes[i]), ...authoredH(L.boxes[i])]) { geo ^= Math.round(v * 100) & 0xffffffff; geo = Math.imul(geo, 0x01000193) >>> 0; }
  const s = `${nBox}|${L.doors.map(d => d.name).join(',')}|${L.routes.map(r => `${r.name}:${r.points.length}`).join(',')}|${g.targets.reduce((n, t) => n + (lampGlass(t) ? 0 : 1), 0)}|${L.props.length}|${geo.toString(16)}`;
  // (the count of light targets is the LEVEL's own: a vehicle's lamps — carlamps.ts — are made of the level's boxes by a rule that can be off, and a target is
  //  poured back by name, so a checkpoint or a recording from before that rule, or from a page with it off, is still this level's)
  const fp = { fp: hashStr(s).toString(16), boxes: nBox, routes: L.routes.length, doors: L.doors.length };
  fpCache.set(g.level, fp); return fp;
}
const fpCache = new SideMap<object, SaveState['level']>('savestate.fpCache');
function firearmSnap(w: Firearm): FirearmSnap { return { id: w.def.id, chamber: w.chamber, mag: w.mag, spare: [...w.spare], shotsFired: w.shotsFired, mode: w.mode, bursts: w.bursts, lastBurstT: w.lastBurstT }; }
/** …and back: a reload half done is simply not (see the head: autosave never catches one; a forced save leaves the well as it stood) */
function firearmApply(w: Firearm, s: FirearmSnap) {
  w.cancelReload(); w.burst = null; w.autoIdx = 0;
  w.chamber = s.chamber === 1 ? 1 : 0; w.mag = s.mag === null ? null : Math.max(0, Math.min(w.def.magCapacity, Math.round(s.mag)));
  w.spare = w.bottomless ? [] : s.spare.map(n => Math.max(0, Math.min(w.def.magCapacity, Math.round(n))));
  w.shotsFired = s.shotsFired | 0; if (w.def.modes.includes(s.mode)) w.mode = s.mode; w.bursts = s.bursts | 0; w.lastBurstT = fin(s.lastBurstT, -100);
}

/** how many men the level's own roster is right now: every route's — or, under a quiet mission, the dealt patrol set's (quiet.ts: the others are off the list for the run) */
function rosterWanted(g: Game): number { return g.quiet?.active ? g.quiet.patrol.length : g.level.routes.length; }

// ================================================================================================================================ can we save
/** What no save of either kind can stand for: a show or a level script puppeting the floor, a man already down, a run that is over, the response team's set
 *  piece. `mem` = the save is kept in memory (canSnap): daylight is in it, and a run the verdict has closed with the stage still live is over too. */
function runNo(g: Game, mem: boolean, authored = false): string | null {
  if (g.touring || g.quietUtility || g.puppet) return 'a show is running (tour / attract / breach)';
  if (!authored) { const why = g.director?.blocksSave(); if (why) return why; }   // (an authored checkpoint of a tutorial mission — rails.ts — is taken with its program running: the program is started again when it is put back)   // the level script mid-program (director.ts): its cursor — fired triggers, live beats, units — has no save slice until M3
  if (!mem && isDaylight(g)) return 'daylight is in (the breach variant)';
  if (g.player.down) return 'the player is down';
  if (g.mission.stage === 'failed' || g.mission.stage === 'done') return `the run is over (${g.mission.stage}) — nothing to come back to`;   // (a civilian killed under tune.civilianKillFails fails the run with Sam on his feet: that file would have loaded as a live one — review G3.2)
  if (mem && g.verdict?.result) return 'the run is over — nothing to come back to';
  if (authored) return null;
  if (g.qrf && g.qrf.state !== 'idle') return `the response team is ${g.qrf.state} — no checkpoint inside the response`;
  if (g.qrf && g.qrf.silentAt >= 0 && !g.qrf.silentSpent) return 'control is calling a net gone silent — no checkpoint inside the response';   // (qrf.ts silentNet's fourteen seconds are not in the file: a load would start them, and the radio check, afresh; never true with tune.qrfSilent off)
  return null;
}
/** Why a checkpoint cannot be written right now (null = it can). `force` (the harness / the dev row) accepts what a plain save refuses of Sam's hands and the
 *  guards' scripts — the file then lets go of them (see the head); the shows, daylight, units and a downed Sam are refused regardless. */
export function canSave(g: Game, force = false): string | null {
  { const why = runNo(g, false); if (why) return why; }
  if (g.guards.some(x => x.unit)) return 'a spawned unit is on the floor';
  if (g.guards.length !== rosterWanted(g)) return 'the roster is not the level\'s';
  if (!force) {
    if (g.clearing) return 'the lockdown pair is clearing rooms';
    const sc = g.guards.find(x => x.script && x.state !== 'dead'); if (sc) return `${sc.callsign} is scripted`;
    const busy = playerBusy(g); if (busy) return `the player is ${busy}`;
    if (g.weather?.kind && g.weather.flash) return 'a stroke of lightning is on the floor';   // (under a picked weather the stroke is in the meter's stand-in — weather.ts strokeLight — and a load ends it: the file waits the half second out; with no weather picked, as it was)
    if (g.items.items.some(it => !it.settled || ((it.kind === 'smoke' || it.kind === 'flash' || it.kind === 'frag') && !it.fired))) return 'a thrown thing is still in the air or on its fuse';
    const falling = g.guards.find(x => x.char.ragdoll && !x.char.ragdoll.sleeping) ?? g.civilians.find(x => x.char.ragdoll && !x.char.ragdoll.sleeping); if (falling) return `${falling.callsign}'s body is still falling`;
    const sinking = g.guards.find(x => x.wound && x.char.anim.woundDown < 1); if (sinking) return `${sinking.callsign} is still going down`;   // (a man going down WOUNDED is filed down: wounds.ts)
      // (a body is filed as a SETTLED corpse at its particles: one written mid-fall would hang there — review finding, reproduced)
    if (g.rings.length) return gearText('a ring airfoil is in flight');
    if (g.shells.length) return 'a 40 mm grenade is in flight';
    if (stickyFlying(g)) return 'a sticky camera is in flight';
  }
  return null;
}

/** a unit is on the floor (a teammate, a response team): no FILE can hold him — under SAVETIMELINE the save is kept in memory instead */
export function squadUp(g: Game): boolean { return g.guards.some(x => !!x.unit); }
/** Why the game cannot be kept IN MEMORY right now (null = it can): what a snapshot (rollback.ts) cannot stand for is a show or a level script puppeting the
 *  floor, a man already down, a run that is over, the response team's set piece. Anything else — hands full, a round in the air, a body falling — is in it. */
export function canSnap(g: Game): string | null { return runNo(g, true); }

type OwnCharges = { charges: number; walls: number | null; doors?: [number, 1 | -1][]; spent?: number };
/** his own charges, alone (PlayerSnap.own): the counts as a load must find them, and the door charges that stand set */
function ownCharges(g: Game): { own?: OwnCharges } {
  if (!OWNCHARGE.on || !g.doorTools || !g.wallCharge || g.guards.some(gd => !!gd.unit && gd.team === 'operative')) return {};
  const W = g.wallCharge, D = g.doorTools; let charges = D.charges, walls = W.carried;
  for (const c of W.set) if (c.free) continue; else if (c.paid > 0) charges += c.paid; else if (walls !== null) walls++;   // (a wall charge set and not blown is not saved: back in the count it was paid from)
  const doors = D.set.map(c => [g.doors.list.indexOf(c.door), c.side] as [number, 1 | -1]).filter(r => r[0] >= 0);
  return { own: { charges, walls, ...(doors.length ? { doors } : {}), ...(D.samSpent ? { spent: D.samSpent } : {}) } };
}
function ownChargesBack(g: Game, own: OwnCharges | undefined) {
  if (!own || !OWNCHARGE.on || !g.doorTools || !g.wallCharge || g.guards.some(gd => !!gd.unit && gd.team === 'operative')) return;
  // (the wall charge first: its own look at a fresh Player hands back what he spent alone last run, which must not land over the count written after it)
  if (typeof own.walls === 'number' && g.wallCharge.carried !== null) g.wallCharge.setCarried(Math.max(0, own.walls | 0)); else g.wallCharge.raiseCarried(0);
  g.doorTools.alone(Math.max(0, own.charges | 0));
  if (Array.isArray(own.doors)) for (const r of own.doors) { const d = Array.isArray(r) ? g.doors.list[r[0]] : undefined; if (d) g.doorTools.setBack(d, r[1] === -1 ? -1 : 1); }
  if (typeof own.spent === 'number') g.doorTools.samSpent = Math.max(0, own.spent | 0);
}
/** what Sam's hands / feet are in the middle of, in words (null = free): the autosave's mid-action gate and canSave's */
export function playerBusy(g: Game): string | null {
  const pl = g.player;
  if (pl.holding) return `holding ${pl.holding.g.callsign}`;
  if (pl.takedown) return 'mid-takedown';
  if (pl.dragging) return 'hauling a body';
  if (pl.picking) return 'picking a lock';
  if (pl.wanding) return 'looking under a door';
  if (pl.coding) return 'at a keypad';
  if (pl.breakerMove) return 'at the breaker';
  if (pl.easing) return 'easing a door';
  if (pl.doorMove) return 'working a door';
  if (g.wallCharge?.setting || pl.charging || pl.workStow) return 'setting a charge';   // (workStow — workstow.ts: his gun put away for one and not back in his hand yet)
  if (g.defuse?.working) return 'at a charge';
  if (pl.kick || (pl.doorKickTail && pl.char.anim.kicking)) return 'kicking a door';   // (doorKickTail — sprintdoor.ts: his legs are his own again while the leg of a boot at the run is still coming down, and the animator's kick clock is not in a file)
  if (pl.pendingThrow || pl.throwHeld || pl.char.anim.inThrow) return 'throwing';
  if (pl.launchHeld) return 'lining up the launcher';   // (the launcher's button down: the gesture is not in the file — a load would drop it and the release then send nothing)
  if (pl.pistol.reloading || pl.rifle.reloading) return 'reloading';
  if (pl.char.anim.nvBusy) return 'flipping his goggles';   // (the same: the flip is the animator's — his arm at his brow is in his capsules — and a file made a third of a second later has none)
  if (pl.char.anim.bigTool) return 'putting his tool back';   // (bigkit.ts, BIGSLOT.moves: the hammer or the shotgun on its way back onto him is the animator's too — never set with the switch off)
  if (pl.char.anim.kitBusy) return 'changing what is in his hands';   // (kitanim.ts: a swap is the animator's, not the file's — never true with the switch off)
  if (g.mission.driveT >= 0) return 'pulling the drive';
  if ((pl.sel.open && !pl.sel.ring?.free) || pl.sel.downT >= 0) return 'choosing an action';   // (a ring that merely stands — handring.ts — is nothing in hand: nothing of it is filed, and a load finds no ring)
  return null;
}

// ================================================================================================================================ SAVE
export interface SaveOpts { label?: string; kind?: SaveState['kind']; force?: boolean; runId?: string; }
/** Serialise the encounter (read-only on the game — the one exception is the 'checkpoint saved' row it appends to the chronicle first, so the row is in the file).
 *  Throws with canSave's reason when refused. */
export function saveState(g: Game, opts: SaveOpts = {}): SaveState {
  const why = canSave(g, !!opts.force); if (why) throw new Error(`checkpoint refused: ${why}`);
  const label = opts.label ?? '', kind = opts.kind ?? 'manual';
  if (kind !== 'harness') chronCheckpoint(g, 'save', label);   // (inside the mission's live gate: nothing under the tour — which cannot save anyway; a HARNESS snapshot is nobody's checkpoint: no row, the run it captures untouched)
  const pl = g.player, pc = pl.char;
  const forced: string[] = [];
  { const b = playerBusy(g); if (b) forced.push(b); if (g.clearing) forced.push('clearing drill'); for (const x of g.guards) if (x.script && x.state !== 'dead') forced.push(`${x.callsign} scripted`); }
  // ---- items first (the guards' `dropped` and nothing else point into them)
  const itemList = g.items.items;
  const items: ItemSnap[] = itemList.map(it => {
    const live = (it.kind === 'smoke' || it.kind === 'flash' || it.kind === 'frag') && !it.fired;
    let pos = c3(it.pos);
    if (!it.settled) { const hit = g.col.raycast([it.pos[0], it.pos[1] + 0.05, it.pos[2]], [0, -1, 0], 12); pos = [it.pos[0], hit ? it.pos[1] + 0.05 - hit.t + it.radius : it.radius, it.pos[2]]; }   // in the air: it lies on whatever is under it
    return { kind: it.kind, pos, yaw: it.yaw, tumble: it.settled ? it.tumble : Math.round(it.tumble / Math.PI) * Math.PI, heading: it.heading, fill: it.fill, life: live && it.kind === 'frag' ? 0 : it.life, age: it.age, fired: live ? true : it.fired, emitT: 0, who: it.who, on: it.settled && it.on ? it.on.id : -1, onPose: it.onPose, radius: it.radius, restitution: it.restitution, friction: it.friction };
  });
  // ---- Sam
  const player: PlayerSnap = {
    pos: c3(pc.pos), bodyYaw: pc.bodyYaw, aimYaw: pc.aimYaw, aimPitch: pc.aimPitch, crouch: pl.crouch, holstered: pl.holstered,
    slot: pl.slot, throwKind: pl.throwKind, canisters: pl.canisters + (pl.pendingThrow?.kind === 'smoke' ? 1 : 0), flashbangs: pl.flashbangs + (pl.pendingThrow?.kind === 'flash' ? 1 : 0), frags: pl.frags + (pl.pendingThrow?.kind === 'frag' ? 1 : 0), ...(WAND.on && !quietWand(g) ? { wand: pl.wand } : {}),   /* (quietfog.ts: a wand the MISSION lent is not the file's to say — a load leaves what the staging put on him) */ ...(BIGSLOT.on ? { bigKit: pl.bigKit } : {}), ...(KITLOAD.on ? { kitLoad: pl.kitLoad ? { ...pl.kitLoad } : null } : {}), ...ownCharges(g),   // (a can not yet out of the hand goes back on the belt, as cancelActions has it)
    pistol: { ...firearmSnap(pl.pistol), lightOn: pl.pistol.lightOn }, rifle: { ...firearmSnap(pl.rifle), lightOn: pl.rifle.lightOn, attIdx: pl.rifle.attIdx, rings: pl.rifle.rings, ringCd: pl.rifle.ringCd, shells: pl.rifle.shells, ...(STICKY.on ? { cams: pl.rifle.attachments.includes('cam') ? stickyLeft(pl) : -1 } : {}), ...(pl.rifle.def.id !== 'fn2000' ? { gun: pl.rifle.def.id } : {}) },
    ...(STICKY.on && pl.cams.some(c => !c.vel) ? { cams: stickySnapshot(pl) } : {}), ...(STICKY.on && pl.camSeq > 0 ? { camSeq: pl.camSeq } : {}),
    ocpCharge: pl.ocp.charge, hasRifle: pl.hasRifle, rifleGone: pl.rifleGone, ocpHinted: pl.ocpHinted, equipT: pl.equipT,
    ...(aimWeightSnapshot(pl) ? { aw: aimWeightSnapshot(pl) } : {}),   // (aimweight.ts: only while his gun is mid-swing onto the cursor)
    ...(pl.doorRipUntil > g.time ? { ripU: pl.doorRipUntil } : {}), ...(sprintDoorTurning(g, pl) ? { bashAt: pl.doorBashAt, bashLean: pl.doorBashLean } : {}),   // (sprintdoor.ts: only while one is running)
    ...(pl.staggerUntil > g.time ? { stagU: pl.staggerUntil } : {}), ...(pl.hurtAt >= 0 ? { hurtAt: pl.hurtAt } : {}), ...(pl.dazzledUntil > g.time ? { dazU: pl.dazzledUntil, dazAt: pl.dazzledAt ? [...pl.dazzledAt] : undefined } : {}),   // (samstun.ts: only while one is running)
    keys: [...pl.keys], codes: [...pl.codes], hitsLeft: pl.hitsLeft, nv: pl.nv, pace: pl.pace, lastFireT: pl.lastFireT, fireCd: pl.fireCd, noise: pl.noise, visibility: pl.visibility, stepPhase: pl.stepPhase, ...(pl.stepTravel !== 1 ? { stepTravel: pl.stepTravel } : {}), animPhase: pc.anim.phase, ...(SAVETIMELINE.holds && pc.anim.heldGaitSnap() ? { heldGait: pc.anim.heldGaitSnap(), ...(closeModeSnapshot(g) !== undefined ? { closeOn: closeModeSnapshot(g) } : {}) } : {}),
    wet: [pc.wet, pc.beads, pc.wetRain], bubble: pl.bubble ? { ...pl.bubble } : null,
  };
  // ---- the men
  const gi = (x: Guard | null | undefined) => x ? g.guards.indexOf(x) : -1;
  const guards: GuardSnap[] = g.guards.map(gd => {
    const c = gd.char, dead = gd.state === 'dead';
    const scripted = !!gd.script && !dead;   // (forced: a scripted / drilling man is filed as the searching man the drill's end would leave)
    const state: GuardState = scripted ? (escalationOf(g) >= 1 || gd.awareness > 0.3 ? 'search' : 'patrol') : gd.state;
    const task: TaskSnap | null = !gd.task ? null : gd.task.kind === 'checkOn' ? { kind: 'checkOn', pos: c3(gd.task.pos), who: gi(gd.task.who), wp: gd.task.wp, left: gd.task.left, t0: gd.task.t0 } : { kind: gd.task.kind, pos: c3(gd.task.pos) };
    const rag = c.ragdoll, turn = dead || scripted || !SAVETIMELINE.turn ? null : c.turnSnap();
    return {
      id: c.id, routeI: gd.routeI, callsign: gd.callsign, state,
      pos: c3(c.pos), vel: dead || scripted ? [0, 0, 0] : c3(c.vel), bodyYaw: c.bodyYaw, aimYaw: c.aimYaw, aimPitch: c.aimPitch, crouch: scripted ? 0 : c.anim.crouchTarget, animPhase: c.anim.phase, ...(turn ? { turn } : null),
      wp: gd.wp, wait: gd.wait, awareness: gd.awareness, lastKnown: c3n(gd.lastKnown), lastSeenT: gd.lastSeenT,
      found: gd.found, downKind: gd.downKind, downBy: gd.downBy, keys: [...gd.keys], ...(gd.wound ? { wound: { ...gd.wound, clock: gd.char.anim.woundClock } } : null),
      missedAt: gd.missedAt, missingRaised: gd.missingRaised,
      muzzleDown: false, muzzleClearT: gd.muzzleClearT, muzzleEvalT: gd.muzzleEvalT, lineBarkT: gd.lineBarkT, lineInT: gd.lineInT,
      leaderSeenT: gd.leaderSeenT, leaderSeenPos: c3(gd.leaderSeenPos), leaderStillT: gd.leaderStillT,
      bodyVisits: gd.bodyVisits, bodyVisitT: gd.bodyVisitT, bodyRemarked: gd.bodyRemarked, bodyClosed: gd.bodyClosed, bodyFan: gd.bodyFan,
      bodyDuty: gd.bodyDuty && !scripted ? { body: gi(gd.bodyDuty.body), role: gd.bodyDuty.role, stage: gd.bodyDuty.stage, t: gd.bodyDuty.t, t0: gd.bodyDuty.t0, spot: c3n(gd.bodyDuty.spot) } : null,
      dropped: gd.dropped ? itemList.indexOf(gd.dropped) : -1,
      gunLostAt: gd.gunLostAt, torchLostAt: gd.torchLostAt, lightLitAtLoss: gd.lightLitAtLoss, lightDeadUntil: gd.lightDeadUntil, flashlightOn: gd.flashlight.enabled, sweep: gd.sweep, beamDir: c3(gd.beamDir),
      path: scripted ? [] : gd.path.map(c3), pathI: scripted ? 0 : gd.pathI, repathT: gd.repathT, pathGoal: scripted ? null : c3n(gd.pathGoal),
      weapon: firearmSnap(gd.weapon), fireCd: gd.fireCd, reactT: gd.reactT, searchT: gd.searchT, lookPhase: gd.lookPhase, speed: scripted ? 0 : gd.speed, stepPhase: gd.stepPhase, heardUpTo: gd.heardUpTo,
      diedAt: gd.diedAt, dazzledUntil: gd.dazzledUntil, staggerUntil: gd.staggerUntil, ...(gd.hurtAt >= 0 ? { hurtAt: gd.hurtAt } : {}), ...(gd.doorDownUntil > g.time ? { doorDownU: gd.doorDownUntil } : {}), lastPos: c3(gd.lastPos), stuckT: gd.stuckT, stuckN: gd.stuckN, killerId: gd.killerId, sawBodyT: gd.sawBodyT,
      alertBest: gd.alertBest, alertStallT: gd.alertStallT, alertRef: c3n(gd.alertRef), chaseT: gd.chaseT, shotBlockedT: gd.shotBlockedT,
      sightPos: c3(gd.sightPos), sightVel: c3(gd.sightVel), sightT: gd.sightT, ledT: gd.ledT, fixT: gd.fixT, fixRef: c3n(gd.fixRef),
      pieLast: gd.pieLast ? g.doors.list.indexOf(gd.pieLast) : -1, pieLastT: gd.pieLastT, piePrev: c3n(gd.piePrev), piePrevT: gd.piePrevT,
      stallRef: c3n(gd.stallRef), stallT: gd.stallT,
      task, drawn: gd.drawn, leader: gi(gd.leader), followT: gd.followT, followGoal: c3(gd.followGoal), post: gd.post?.name ?? null,
      witness: deepClone(gd.witness), talk: { stage: gd.talk.stage, presses: gd.talk.presses, said: [...gd.talk.said], saidN: [...gd.talk.saidN], given: [...gd.talk.given], lastT: gd.talk.lastT, heldSince: -1, abortT: gd.talk.abortT, script: gd.talk.stage > 0 ? (peekScript(gd.talk)?.id ?? forcedScriptOf(gd.talk) ?? null) : undefined },
      bubble: gd.bubble && !gd.held ? { ...gd.bubble } : null,
      wet: [c.wet, c.beads, c.wetRain],
      rag: dead && rag ? { x: Array.from(rag.x, x => Math.round(x * 1e4) / 1e4), rot: [rag.rot[0], rag.rot[1], rag.rot[2], rag.rot[3]], sleeping: rag.sleeping, own: true } : null,
    };
  });
  // ---- the level's live state
  const doors: DoorSnap[] = g.doors.list.map(d => ({ ...(d.drive ? { drive: { ...d.drive } } : {}), name: d.def.name, angle: d.angle, vel: d.vel, quietT: d.quietT, latched: d.latched, lastWho: d.lastWho, sinceBash: d.sinceBash, closing: d.closing, locked: d.locked, lockBroken: d.lockBroken, noticed: d.noticed, noticedT: d.noticedT, pick: d.pick, pickIdle: d.pickIdle, pickClock: d.pickClock, pickN: d.pickN, guardT: d.guardT, creakArmed: d.creakArmed, ...(DOORWAY.oneWay ? { pullT: d.pullT, pressT: d.pressT, ...(d.solidT > 0 ? { solidT: d.solidT } : {}), openT: d.openT } : {}), ...((DOORWAY.oneWay || g.doors.stay) && d.passers ? { passers: d.passers } : {}), ...(d.off ? { off: slabSnapshot(g, d) ?? undefined } : {}), ...(d.shot > 0 ? { shot: d.shot } : {}) }));
  const props: PropSnap[] = g.props.all.map(p => ({ x: p.x, z: p.z, yaw: p.yaw, vx: p.vx, vz: p.vz, w: p.w, asleep: p.asleep, idle: p.idle, lastWho: p.lastWho, noiseT: p.noiseT, pushT: p.pushT }));
  const targets: TargetSnap[] = g.targets.map(t => ({ name: t.name, on: t.on, broken: t.broken, disabledUntil: t.disabledUntil, ...(t.handOff !== undefined ? { hand: t.handOff } : null) }));
  g.doors.list.forEach((d, i) => { if (d.swept) doors[i].swept = true; });   // (Door.swept, written only when set: a leaf a keyed man's body brought to its frame, resting to unlatched)
  const C = g.chronicle;
  const chronicle: ChronSnap = (() => {
    // the path: thinned to ≤ pathKeep the way Chronicle.sample thins at its cap (every other point, twice the interval), coordinates to the centimetre, times to the tenth
    let n = C.pathN, every = C.pathEvery, step = 1; while (n / step > CKPT.pathKeep) step *= 2;
    const path: number[] = [];
    for (let i = 0; i < n; i += step) path.push(Math.round(C.path[i * 3] * 100) / 100, Math.round(C.path[i * 3 + 1] * 100) / 100, Math.round(C.path[i * 3 + 2] * 10) / 10);
    if (step > 1) { every *= step; n = path.length / 3; } else n = path.length / 3;
    return { events: C.events.map(e => ({ t: Math.round(e.t * 100) / 100, kind: e.kind, room: e.room, pos: r3(e.pos, 100), data: { ...e.data } })), dropped: C.dropped, counts: { ...C.counts }, questioned: [...C.questioned], path, pathN: n, pathEvery: every, pathNext: C.pathNext };
  })();
  const R = rollcallState(g);
  const A = g.saves;
  const decals: DecalSnap[] = [];
  for (const d of g.decals.list) {
    if (d.kind === 'wetprint') continue;   // (Sam's wet prints fade inside a minute and their ageing records live apart: let go)
    let door = -1, prop = -1, part = -1;
    if (d.box) {
      door = g.doors.list.findIndex(x => x.box === d.box);
      if (door < 0) { const P = g.props.propOf(d.box); if (P) { prop = P.id; part = P.boxes.indexOf(d.box); } }
      if (door < 0 && prop < 0) continue;   // rides something a checkpoint does not keep (a hand prop, an item): the mark goes with it
    }
    const p = d.box && d.local ? d.local.p : d.pos, n = d.box && d.local ? d.local.n : d.n, t = d.box && d.local ? d.local.t : d.t;   // (attached: the LOCAL frame — put back through the same box on load, wherever it then stands)
    const D: DecalSnap = { kind: d.kind, pos: r3(p, 1000), n: r3(n, 1000), t: r3(t, 1000), radius: Math.round(d.radius * 1000) / 1000, param: Math.round(d.param * 1000) / 1000, seed: d.seed };   // (a mark to the millimetre, its frame to the milliradian: what the g-buffer can show of it)
    if (d.pane >= 0) D.pane = d.pane; if (door >= 0) D.door = door; if (prop >= 0) { D.prop = prop; D.part = part; }
    if (LOOK_DECALS.has(d)) D.look = 1;   // (a mark laid only for the picture — lookDecals.ts: it comes back tagged, so the digest's count is the same carrying on and loaded)
    decals.push(D);
  }
  const bo = g.blackout, fg = g.fogOfWar?.snapshot(), gw = gunWallSnapshot(g), wh = SAVETIMELINE.holds ? wallHoldSnapshot(g) : undefined, ct = calmTorchSnapshot(g), dz = dozeSnapshot(g), mo = moraleSnapshot(g), ru = runnerSnapshot(g), sl = startleSnapshot(g), fl = flinchSnapshot(g), dd = darkDoorSnapshot(g), nq = netQuietSnapshot(g), po = powerOutSnapshot(g), rk = rescueCheckSnapshot(g), at = attentionSnapshot(g), pi = pictureSnapshot(g);
  const air = g.airDust?.snapshot();
  const s: SaveState = {
    v: SAVE_VERSION, savedAt: Date.now(), label, kind, level: levelFingerprint(g),
    missionT: g.mission.stats.elapsed, stage: g.mission.stage, runId: opts.runId || A?.runId || 'run',
    time: g.time, eventSeq: g.eventSeq, fxSeed: g.fxSeed, ocpCooldown: g.ocpCooldown, calledIn: g.calledIn, stoodDown: g.stoodDown, breakerFixT: g.breakerFixT, lastStingT: g.lastStingT,
    escalation: g.escalation, escalationT: g.escalationT, alarm: { episode: g.alarm.episode, pos: c3(g.alarm.pos), placed: g.alarm.placed, apartT: g.alarm.apartT, raisedAt: g.alarm.raisedAt }, clearedAt: [...g.clearedAt], clearRooms: g.clearRooms,
    blackout: { active: bo.active, until: infOut(bo.until), since: bo.since, permanent: bo.permanent, restoredAt: bo.restoredAt },
    flags: { aiEnabled: g.aiEnabled, godMode: g.godMode, infiniteAmmo: g.infiniteAmmo, playerInvisible: g.playerInvisible },
    player, guards, items, doors, props, propsTime: g.props.time, targets,
    devices: g.devices?.snapshot() ?? null, mission: deepClone({ ...g.mission, driveT: -1, debrief: false }), chronicle,
    events: g.events.map(e => ({ kind: e.kind, pos: c3(e.pos), time: e.time, loud: e.loud, level: e.level, id: e.id, who: e.who, weapon: e.weapon, from: e.from ? c3(e.from) : undefined, to: e.to ? c3(e.to) : undefined, announced: e.announced, cause: e.cause, ...(e.ears ? { ears: [c3(e.ears[0]), c3(e.ears[1])] as [Vec3, Vec3] } : {}), ...(e.swAt ? { swAt: c3(e.swAt) } : {}) })),
    messages: g.messages.map(m => ({ text: m.text, t: m.t })),
    rollcall: { nextAt: R.nextAt, stage: R.stage, t0: R.t0, caller: gi(R.caller), missing: gi(R.missing), answered: R.answered, checks: R.checks },
    needs: needsSnapshot(g), whistle: whistleSnapshot(g), tactics: tacticsSnapshot(g), lanes: lanesSnapshot(g), walls: g.destr?.walls?.snapshot(), furn: g.destr?.furn?.snapshot(), bars: barsSnapshot(g), dialogue: dialogueSnapshot(g), weather: g.weather?.snapshot() ?? null, ...(air ? { air } : {}), ...(g.quiet?.active ? { quiet: g.quiet.snapshot()! } : {}), ...(g.lesson?.data ? { lesson: g.lesson.snapshot() } : {}), ...(g.defuse?.active ? { defuse: g.defuse.snapshot() } : {}), ...(g.snatch?.active ? { snatch: g.snatch.snapshot() } : {}), ...(g.par?.data ? { par: g.par.snapshot() } : {}), ...(PLANLAY.on ? { lay: laySnapshot(g) } : {}), ...(CMDRING.plan ? { plan: planSnapshot(g.orders) } : {}), qrf: { loudT: g.qrf?.loudT ?? -1e9, ...(RESPONSE.on ? { word: responseWordSnapshot(g) } : {}) },
    civilians: civiliansSnapshot(g),
    decals, ...(glassPenSnapshot(g) ? { glassPen: glassPenSnapshot(g) } : null),
    ...(dz ? { doze: dz } : null),   // (who dozes in which chair and who was woken — doze.ts; no key with its switch off)
    ...(ct ? { calmTorch: ct } : null),   // (which calm patrol torches are dark, and their dwell — calmtorch.ts; no key with its switch off)
    ...(mo ? { morale: mo } : null),   // (each man's dread and where his sequence stands — morale.ts; no key with its switch off)
    ...(ru ? { runner: ru } : null),   // (each man who dropped it and ran, and where his run stands — runner.ts; no key with its switch off)
    ...(sl ? { startle: sl } : null),   // (each man's start at a first sight — startle.ts; no key while no man has a record)
    ...(fl ? { flinch: fl } : null),   // (each green man's seconds under close fire — flinch.ts; no key while no man has a count)
    ...(dd ? { darkdoor: dd } : null),   // (who is stopped at which dark doorway, who is coming — darkdoor.ts; no key with its switch off)
    ...(nq ? { netQuiet: nq } : null),   // (each man's quiet count, owed line, whip and last-man act — netquiet.ts; no key with its switch off)
    ...(po ? { powerOut: po } : null),   // (the men out for the breaker and what their side has said about the dark — powerout.ts; no key with its switch off or before a first blackout)
    ...(rk ? { rescueCheck: rk } : null),   // (the rescue's radio check and the man out for a silent post — rescuecheck.ts)
    ...(at ? { attention: at } : null),   // (each man's held attention and his memory of the takings — attention.ts; no key with its switch off)
    ...(pi ? { picture: pi } : null),   // (each man's ideas of his enemies — picture.ts; no key with its switch off)
    ...(wh ? { wallHold: wh } : null),   // (his back on a wall, and the walk-in take's clock — player.ts; no key with SAVETIMELINE.holds off or nothing to say)
    ...(gw ? { gunWall: gw } : null),   // (whose gun a wall holds down — gunwall.ts; no key with its switch off or nobody at a wall)
    ...(fg ? { fog: fg } : null),   // (what the fog holds another way than the world stands — fogofwar.ts; no key with FOG.filed off or the fog off; an empty slice with nothing held, which is not the same)
    ...(g.dice && diceInUse() === g.dice ? { dice: { s: g.dice.s, n: g.dice.n, seed: g.dice.seed } } : {}),
    ...(hourOf(g) !== 'night' ? { hour: { id: hourOf(g), sun: sunStrength(g), given: sunGiven(g) } } : {}),
    autosave: { runId: A?.runId || opts.runId || 'run', visited: [...(A?.visited ?? [])], quietT: A?.quietT ?? 0, lastSaveT: A?.lastSaveT ?? -1e9, bodyFrom: c3n(A?.bodyFrom ?? null) },
    forced,
  };
  return s;
}

// ================================================================================================================================ LOAD
/** Why this file cannot be loaded into this game (null = it can): version, level. */
export function canLoad(g: Game, s: SaveState | null | undefined): string | null {
  if (!s || typeof s !== 'object') return 'not a checkpoint';
  if (s.v !== SAVE_VERSION) return `checkpoint version ${s.v} (this build reads ${SAVE_VERSION})`;
  const L = levelFingerprint(g);
  if (!s.level || s.level.fp !== L.fp) return `made on another level (${s.level?.boxes ?? '?'} boxes / ${s.level?.doors ?? '?'} doors; this one ${L.boxes} / ${L.doors})`;
  // a QUIET MISSION's file (quiet.ts: its deal rides in it — the start, the spot, the patrol set that was manned) loads into that mission, and only into it
  if (s.quiet && !g.quiet?.active) return 'made in a quiet mission — open that mission, then load it';
  if (!s.quiet && g.quiet?.active) return 'made on the plain night — a quiet mission is up on this page';
  if (s.quiet && (s.quiet.squad ? 1 : 0) !== (g.quiet.squad ? 1 : 0)) return s.quiet.squad ? 'made with a partner — this run is alone' : 'made alone — this run has a partner';
  { const want = s.quiet ? g.quiet.rosterOf(s.quiet.deal) : g.level.routes.length;
    if (want < 0) return 'its quiet mission\'s deal is not one this level deals (the level file has changed since)';
    if (!Array.isArray(s.guards) || s.guards.length !== want) return `roster of ${s.guards?.length} (${s.quiet ? `its patrol set mans ${want}` : `the level has ${g.level.routes.length} routes`})`; }
  if (s.stage === 'failed' || s.stage === 'done' || s.mission?.stage === 'failed' || s.mission?.stage === 'done') return `a finished run (${s.mission?.stage ?? s.stage}) — nothing to come back to`;   // (canSave refuses to write one; a hand-made file is refused too, never poured over a living man as a live run — review G3.2)
  { const wx = g.weather?.refuses(s.weather); if (wx) return wx; }   // (weather.ts: in the page the weather is the URL's — a file made in another is another run's)
  { const w = g.destr?.walls?.check(s.walls) ?? null; if (w) return w; }   // (a file whose holed walls are not this level's partitions: refused, never loaded as an intact lie)
  { const w = g.destr?.furn?.check(s.furn) ?? null; if (w) return w; }   // (…and the furniture a blast took)
  { const w = barsCheck(g, s.bars); if (w) return w; }   // (…and the window bars)
  if (g.touring || g.puppet) return 'a show is running — stop it first';
  if (g.rescue?.active) return 'the hostage rescue is staged (its cast and the benched shift are no roster a checkpoint can be poured over)';
  if (g.nightBreach?.active) return 'the night breach is staged (its cast and the benched shift are no roster a checkpoint can be poured over)';
  return null;
}
/** Put the encounter back exactly as the file has it: the running encounter is thrown away through the game's own restart path (fresh Player / Guards, units
 *  despawned, the level as authored, nothing in the air, no smoke, cameras reset), then every slice of the file is applied on that clean slate and the derived
 *  state (poses, torch lights, leaf boxes) rebuilt; a 'checkpoint loaded' row goes on the chronicle. Throws with canLoad's reason when refused. */
export function loadState(g: Game, s: SaveState, opts: { label?: string } = {}) {
  const why = canLoad(g, s); if (why) throw new Error(`checkpoint refused: ${why}`);
  seenReset(g);   // (seenwalk.ts: what a walk kept of the floor's light and view is the abandoned moment's)
  // what the abandoned future knew that the file cannot: how many times THIS run has already been loaded / saved (a man who dies five times onto one
  // checkpoint has five loads on his card, not the file's nought)
  const sameRun = !!g.saves && g.saves.runId === s.runId; const prevLoads = sameRun ? g.chronicle.counts.loads : 0, prevSaves = sameRun ? g.chronicle.counts.saves : 0;
  if (!s.player || !s.mission || !s.chronicle || !s.doors || !s.props || !s.targets || !s.blackout || !s.alarm || !s.flags || !s.rollcall) throw new Error('checkpoint refused: the file is missing whole slices');
  // ---- the clean slate: night back in if the daytime variant was (a checkpoint is always the night's — daylight is refused at the save), then the encounter that
  //      is running goes the way a restart takes it
  if (isDaylight(g)) setDaylight(g, false);
  if (applyHour(g, hourIdOf(s.hour?.id)) || s.hour) { const k = fin(s.hour?.sun ?? 1, 1); setSunStrength(g, k, typeof s.hour?.given === 'boolean' ? s.hour.given : k !== 1); }   // the file's hour (none = the level's own night) before the slate is wiped: the restart below re-makes that hour's switches
  g.quiet?.restoreDeal(s.quiet);   // (a quiet mission: the restart below deals the FILE's start / spot / patrol set, not a fresh one — quiet.ts)
  g.restartEncounter();
  barsRestore(g, s.bars);             // the window bars a round or a blast took (winbars.ts), gone again before the walls settle round them — the order they went in
  g.destr?.walls?.restore(s.walls);   // the level first (holed walls, chewed cover: the statics re-cut, the nav grid re-baked) — everything below is placed in it
  g.destr?.furn?.restore(s.furn);     // …then the furniture a blast took: gone again, silently (its pieces are not filed — no debris is)
  try { applyState(g, s, prevLoads, prevSaves, opts); g.lesson?.restore(s.lesson); g.defuse?.restore(s.defuse); g.snatch?.restore(s.snatch); g.par?.restore(s.par); if (PLANLAY.on) layRestore(g, s.lay); ringRestore(g); if (CMDRING.plan) planRestore(g.orders, s.plan); g.fogOfWar?.restore(s.fog); }   // (…and a training lesson's place among its steps, lesson.ts: after the mission slice — a file without it, made with the lesson off, leaves the lesson stood down for that run)
  catch (e) { g.restartEncounter(); g.messages.push({ text: `checkpoint failed to load (${(e as Error).message}) — encounter restarted`, t: g.time }); throw e; }   // (a file broken past the checks: never a half-poured encounter — the fresh one, and the reason)
}
function applyState(g: Game, s: SaveState, prevLoads: number, prevSaves: number, opts: { label?: string }) {
  g.time = fin(s.time, g.time); g.eventSeq = s.eventSeq | 0; g.fxSeed = s.fxSeed | 0; g.ocpCooldown = fin(s.ocpCooldown); g.calledIn = !!s.calledIn; g.stoodDown = !!s.stoodDown; g.breakerFixT = fin(s.breakerFixT); g.lastStingT = fin(s.lastStingT, -100);
  g.aiEnabled = s.flags.aiEnabled !== false; g.godMode = !!s.flags.godMode; g.infiniteAmmo = !!s.flags.infiniteAmmo; g.playerInvisible = !!s.flags.playerInvisible;
  loadSandbox(g, false);   // …then THIS MACHINE's start-card preference wins over the file's three sandbox flags (game/sandbox.ts; headless it is a no-op, so save∘load stays the identity on the file — probes checkpoint-identity)
  g.spectate = -1;
  // ---- items (before the men: their dropped torches point in here)
  const propsById = g.props.all;
  const items: Item[] = s.items.map(is => {
    const it = g.items.spawn(is.kind, is.pos, [0, 0, 0], { yaw: is.yaw, tumble: is.tumble, tumbleRate: 0, spin: 0, heading: is.heading, fill: is.fill, life: is.life, age: is.age, fired: !!is.fired, emitT: 0, who: is.who | 0, settled: true, fuse: 0, bounces: 1, radius: is.radius, restitution: is.restitution, friction: is.friction });
    it.vel = [0, 0, 0]; it.on = is.on >= 0 ? propsById[is.on] ?? null : null; it.onPose = is.onPose;
    it.onBounce = (sp, p, g) => { if (sp >= 0.7) g.audio.play(is.kind === 'smoke' || is.kind === 'flash' ? 'canisterBounce' : 'magDrop', p, Math.min(1, sp / 3)); };   // (disturbed later, it clatters as any: nobody hears a checkpoint's items as fresh noise)
    return it;
  });
  // ---- Sam (restartEncounter made a fresh Player at the spawn with the rail light moved over; kit and place him)
  { const P = s.player, pl = g.player, pc = pl.char;
    pl.hasRifle = P.hasRifle !== false;
    pc.pos = c3(P.pos); pl.safe = [P.pos[0], 0, P.pos[2]]; pc.vel = [0, 0, 0]; pc.bodyYaw = fin(P.bodyYaw); pc.aimYaw = fin(P.aimYaw); pc.aimPitch = fin(P.aimPitch);
    pl.crouch = !!P.crouch; pc.anim.crouchTarget = pl.crouch ? 1 : 0; pc.anim.phase = fin(P.animPhase); if (SAVETIMELINE.holds && CLOSE.on) pc.anim.heldGaitBack(P.heldGait);
    pl.holstered = !!P.holstered; pl.slot = (KIT_ORDER as readonly string[]).includes(P.slot) ? P.slot : 'pistol'; if (pl.slot === 'rifle' && !pl.hasRifle) pl.slot = 'pistol';
    pl.throwKind = P.throwKind === 'flash' ? 'flash' : 'smoke'; pl.canisters = Math.max(0, P.canisters | 0); pl.flashbangs = Math.max(0, P.flashbangs | 0); if (typeof P.frags === 'number') pl.frags = Math.max(0, P.frags | 0); if (typeof P.wand === 'boolean') pl.wand = WAND.on && (P.wand || quietWand(g));   /* (…and a file that says none never takes the mission's own off him) */ if (P.bigKit !== undefined) pl.bigKit = BIGSLOT.on && (P.bigKit === 'shotgun' || P.bigKit === 'hammer') ? P.bigKit : 'none'; if (P.kitLoad !== undefined) { const w = P.kitLoad, n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? clamp(x, 0, 1) : null), q = w ? [n(w.mob), n(w.con), n(w.refMob), n(w.refCon)] : []; pl.kitLoad = w && q.every(x => x !== null) ? { mob: q[0]!, con: q[1]!, refMob: q[2]!, refCon: q[3]! } : null; }   /* (kitload.ts: what his card weighed as the file has it, his reference with it — a file that says nothing leaves what the staging put on him) */ ownChargesBack(g, P.own);   // (a file that says: his, while the switch stands; one from before the wand, or made with it off, says nothing and the card just staged stands)
    { const id = P.pistol.id && WEAPONS[P.pistol.id]?.cls === 'pistol' ? P.pistol.id : pl.pistol.def.id; if (pl.pistol.def.id !== id) pl.pistol = new Pistol(WEAPONS[id]); }   // (the sidearm the file was saved with: gunslots.ts — a file from before the slots names the one there was)
    firearmApply(pl.pistol, P.pistol); pl.pistol.lightOn = !!P.pistol.lightOn;
    { const id = P.rifle.gun && WEAPONS[P.rifle.gun] ? P.rifle.gun : 'fn2000'; if (pl.rifle.def.id !== id) pl.rifle = new Rifle(WEAPONS[id]); }   // (the long gun the file was saved with: its tube is not a magazine of thirty)
    if (typeof P.rifle.cams === 'number') stickyRestore(pl, P.cams, P.rifle.cams >= 0 ? P.rifle.cams : undefined, P.camSeq);   // (before the load's index is read: 'cam' is on the rifle's list only once issued)
    firearmApply(pl.rifle, P.rifle); pl.rifle.lightOn = !!P.rifle.lightOn; pl.rifle.attIdx = P.rifle.attIdx >= 0 && P.rifle.attIdx < pl.rifle.attachments.length ? P.rifle.attIdx | 0 : pl.rifle.attachments.length ? 0 : -1;   /* (a file from when 'nothing' could be selected carries −1: the first load is up) */ pl.rifle.rings = Math.max(0, P.rifle.rings | 0); pl.rifle.ringCd = Math.max(0, fin(P.rifle.ringCd)); if (typeof P.rifle.shells === 'number') pl.rifle.shells = Math.max(0, P.rifle.shells | 0);
    pl.ocp.charge = Math.max(0, Math.min(1, fin(P.ocpCharge, 1))); pl.rifleGone = false; pl.ocpHinted = !!P.ocpHinted; pl.equipT = Math.max(0, fin(P.equipT));
    aimWeightRestore(pl, P.aw);
    pl.doorKickTail = false; pl.doorRipUntil = fin(P.ripU ?? -1, -1); pl.doorBashAt = fin(P.bashAt ?? -10, -10); pl.doorBashLean = P.bashLean === 1 || P.bashLean === -1 ? P.bashLean : 0;
    pl.staggerUntil = fin(P.stagU ?? -1, -1); pl.hurtAt = fin(P.hurtAt ?? -1, -1); pl.dazzledUntil = fin(P.dazU ?? -1, -1); pl.dazzledAt = Array.isArray(P.dazAt) && P.dazAt.length === 3 ? [fin(P.dazAt[0], 0), fin(P.dazAt[1], 0), fin(P.dazAt[2], 0)] : null;
    pl.keys = new Set(P.keys ?? []); pl.codes = new Set(P.codes ?? []); pl.hitsLeft = Math.max(1, Math.min(Player.MAX_HITS, P.hitsLeft | 0)); pl.nv = !!P.nv; pl.nvAmount = pl.nv ? 1 : 0; pl.pace = Math.max(0.2, Math.min(1, fin(P.pace, 1)));
    pl.lastFireT = fin(P.lastFireT, -10); pl.fireCd = fin(P.fireCd); pl.noise = fin(P.noise); pl.visibility = fin(P.visibility); pl.irradiance = 0; pl.stepPhase = fin(P.stepPhase); pl.stepTravel = fin(P.stepTravel ?? 1, 1); pl.stepOwed = 0; pl.stepAt = -1;   // (visibility: the meter as it stood — the probe overwrites it on the first frame that answers; headless it is the script's knob and stays)
    pc.wet = fin(P.wet?.[0]); pc.beads = fin(P.wet?.[1]); pc.wetRain = fin(P.wet?.[2]);
    pl.bubble = P.bubble ? { ...P.bubble } : null;
    pc.update(0);
  }
  // ---- the men (restartEncounter → resetGuards left a fresh living roster on the routes' first points, torches theirs)
  const G = g.guards;
  s.guards.forEach((S, i) => {
    const gd = G[i]; if (!gd) return; const c = gd.char;
    const dead = S.state === 'dead';
    // the row he carries: game.ts re-deals it off tune.carbineGuards next frame anyway; seat what the file says it held if it is the same row
    if (S.weapon && S.weapon.id !== gd.weapon.def.id && WEAPONS[S.weapon.id]?.enabled) { gd.weapon = new Firearm(WEAPONS[S.weapon.id]); c.muzzleAhead = gd.weapon.def.muzzleAhead; }
    if (S.weapon && S.weapon.id === gd.weapon.def.id) firearmApply(gd.weapon, S.weapon);
    gd.state = S.state; c.pos = c3(S.pos); c.vel = dead ? [0, 0, 0] : c3(S.vel); c.bodyYaw = fin(S.bodyYaw); c.aimYaw = fin(S.aimYaw); c.aimPitch = fin(S.aimPitch); c.anim.crouchTarget = dead ? 0 : fin(S.crouch); c.anim.phase = fin(S.animPhase); if (!dead && SAVETIMELINE.turn) c.turnPut(S.turn);
    gd.wp = S.wp | 0; if (gd.wp >= gd.route.points.length) gd.wp = 0; gd.wait = fin(S.wait); gd.awareness = Math.max(0, Math.min(1, fin(S.awareness))); gd.lastKnown = c3n(S.lastKnown); gd.lastSeenT = fin(S.lastSeenT, -100);
    gd.found = !!S.found; gd.downKind = S.downKind ?? null; gd.downBy = S.downBy ?? null; gd.keys = new Set(S.keys ?? []);
    gd.missedAt = fin(S.missedAt, -1); gd.missingRaised = !!S.missingRaised;
    gd.muzzleDown = false; gd.muzzleClearT = fin(S.muzzleClearT); gd.muzzleEvalT = fin(S.muzzleEvalT, -1); gd.lineBarkT = fin(S.lineBarkT, -100); gd.lineInT = fin(S.lineInT);
    gd.leaderSeenT = fin(S.leaderSeenT, -1); gd.leaderSeenPos = c3(S.leaderSeenPos ?? [0, 0, 0]); gd.leaderStillT = fin(S.leaderStillT);
    gd.bodyVisits = S.bodyVisits | 0; gd.bodyVisitT = fin(S.bodyVisitT, -1); gd.bodyRemarked = !!S.bodyRemarked; gd.bodyClosed = !!S.bodyClosed; gd.bodyFan = S.bodyFan | 0;
    gd.dropped = S.dropped >= 0 ? items[S.dropped] ?? null : null;
    gd.gunLostAt = fin(S.gunLostAt, -1); gd.torchLostAt = fin(S.torchLostAt, -1); gd.lightLitAtLoss = S.lightLitAtLoss !== false; gd.lightDeadUntil = fin(S.lightDeadUntil, -1); gd.flashlight.enabled = !!S.flashlightOn && !dead; gd.sweep = fin(S.sweep); gd.beamDir = c3(S.beamDir ?? [0, -0.3, 1]);
    gd.path = (S.path ?? []).map(c3); gd.pathI = Math.max(0, S.pathI | 0);   // (as saved, not clamped to the path — see civiliansRestore)
    gd.repathT = fin(S.repathT); gd.pathGoal = c3n(S.pathGoal);
    gd.fireCd = fin(S.fireCd, 1); gd.reloadT = -1; gd.reactT = fin(S.reactT); gd.searchT = fin(S.searchT); gd.lookPhase = fin(S.lookPhase); gd.speed = dead ? 0 : fin(S.speed); gd.stepPhase = fin(S.stepPhase); gd.heardUpTo = fin(S.heardUpTo, -1);
    gd.diedAt = fin(S.diedAt, -1); gd.dazzledUntil = fin(S.dazzledUntil, -1); gd.staggerUntil = fin(S.staggerUntil, -1); gd.doorDownUntil = fin(S.doorDownU ?? -1, -1); gd.hurtAt = fin(S.hurtAt ?? -1, -1); gd.lastPos = c3(S.lastPos ?? S.pos); gd.stuckT = fin(S.stuckT); gd.stuckN = S.stuckN | 0; gd.killerId = S.killerId ?? -1; gd.sawBodyT = fin(S.sawBodyT, -100);
    gd.alertBest = fin(S.alertBest, 1e9); gd.alertStallT = fin(S.alertStallT); gd.alertRef = c3n(S.alertRef); gd.chaseT = fin(S.chaseT); gd.shotBlockedT = fin(S.shotBlockedT);
    gd.sightPos = c3(S.sightPos ?? [0, 0, 0]); gd.sightVel = c3(S.sightVel ?? [0, 0, 0]); gd.sightT = fin(S.sightT, -100); gd.ledT = fin(S.ledT, -100); gd.fixT = fin(S.fixT, -100); gd.fixRef = c3n(S.fixRef);
    gd.searchPlan = null; gd.pieing = null; gd.standoff = null; gd.script = null; gd.hold = false; gd.pinned = false; gd.held = null;
    gd.pieLast = S.pieLast >= 0 ? g.doors.list[S.pieLast] ?? null : null; gd.pieLastT = fin(S.pieLastT, -100); gd.piePrev = c3n(S.piePrev); gd.piePrevT = fin(S.piePrevT, -100);
    gd.stallRef = c3n(S.stallRef); gd.stallT = fin(S.stallT);
    gd.drawn = !!S.drawn; gd.followT = fin(S.followT); gd.followGoal = c3(S.followGoal ?? [0, 0, 0]); gd.post = S.post ? (g.level.chokepoints ?? []).find(cp => cp.name === S.post) ?? null : null;
    if (S.witness) gd.witness = deepClone(S.witness);
    if (S.talk) { const T = S.talk; gd.talk = { stage: T.stage | 0, presses: T.presses | 0, said: new Set(T.said ?? []), saidN: new Map(T.saidN ?? []), given: new Set(T.given ?? []), lastT: fin(T.lastT, -1), heldSince: -1, abortT: fin(T.abortT, -1), last: null }; if (T.script !== undefined) forceScript(gd.talk, T.script); }   // (his dealt interrogation script by id: the next hold plays on from it instead of the pools)
    gd.bubble = S.bubble ? { ...S.bubble } : null;
    c.wet = fin(S.wet?.[0]); c.beads = fin(S.wet?.[1]); c.wetRain = fin(S.wet?.[2]);
    if (dead) {
      // the body: a corpse settled at the file's joint positions (see the head) — hand the fresh figure to a ragdoll where it lies, then lay every particle down
      c.update(0);
      if (S.wound) woundRestore(gd, S.wound);   // (a man down WOUNDED is a posed figure, never a ragdoll: wounds.ts lays him down again, already settled)
      else c.ragdollize(g.col, [Math.sin(c.bodyYaw), 0, Math.cos(c.bodyYaw)], true);
      if (S.rag && S.rag.x?.length === RAG_COUNT * 3 && c.ragdoll) { c.ragdoll.settleAt(S.rag.x, S.rag.rot, S.rag.own === true); if (S.rag.sleeping === false) c.ragdoll.wake(); }   // (a body the file caught still falling — only a forced / harness save can — falls on from rest where it was)
      c.vel = [0, 0, 0]; gd.speed = 0; c.anim.speed = 0;
      c.update(0);
    } else c.bakeLoaded();   // (posed where his turn had got him, his yaws as filed: character.ts)
  });
  // second pass: references between men
  s.guards.forEach((S, i) => {
    const gd = G[i]; if (!gd) return;
    gd.leader = S.leader >= 0 ? G[S.leader] ?? null : null; if (gd.leader === gd) gd.leader = null;   // (a leader down but not yet KNOWN down keeps the role, as guards.ts superviseLockdown has it: the follower closes up on his station and finds him)
    gd.bodyDuty = S.bodyDuty && G[S.bodyDuty.body] ? { body: G[S.bodyDuty.body], role: S.bodyDuty.role, stage: S.bodyDuty.stage, t: fin(S.bodyDuty.t), t0: fin(S.bodyDuty.t0), spot: c3n(S.bodyDuty.spot) } : null;
    const T = S.task; gd.task = !T ? null : T.kind === 'checkOn' ? (G[T.who] ? { kind: 'checkOn', pos: c3(T.pos), who: G[T.who], wp: T.wp | 0, left: T.left | 0, t0: fin(T.t0) } : null) : { kind: T.kind, pos: c3(T.pos) } as GuardTask;
  });
  dozeRestore(g, s.doze);   // (the men back in their chairs, asleep or woken as the file had them — doze.ts; a file without the slice: everybody on his feet)
  calmTorchRestore(g, s.calmTorch);   // (before the lights are posed, and no dwell counted while they are: a calm man's torch is dark or burning as the file had it — calmtorch.ts)
  moraleRestore(g, s.morale);   // (each man's dread, rung and sequence as the file had them — morale.ts; a file without the slice: every man met afresh)
  runnerRestore(g, s.runner);   // (who had dropped it and run, as the file had them — runner.ts; a file without the slice: nobody has)
  startleRestore(g, s.startle);   // (who was in his start, who has had his — startle.ts; a file without the slice: nobody has)
  flinchRestore(g, s.flinch);   // (how long each green man had been under close fire — flinch.ts; a file without the slice: nobody has)
  darkDoorRestore(g, s.darkdoor);   // (each man's balk as the file had it — darkdoor.ts; a file without the slice: nobody stopped, every door open to him)
  netQuietRestore(g, s.netQuiet);   // (…and what the quiet net has done to each of them — netquiet.ts; a file without it: every man met afresh)
  powerOutRestore(g, s.powerOut);   // (…and the walk to the breaker — powerout.ts; a file without it: nobody is out and the next blackout is their first)
  rescueCheckRestore(g, s.rescueCheck);   // (…and the rescue's radio check — rescuecheck.ts; a file without it: the check starts afresh)
  attentionRestore(g, s.attention);   // (…and whose attention was on what, for how much longer — attention.ts; a file without it: every man's attention his own)
  pictureRestore(g, s.picture);   // (…and what each man believed of where his enemies were — picture.ts; a file without it: nobody knows of anybody yet)
  try { G.forEach((gd, i) => { attachFlashlight(g, gd); const bd = s.guards[i]?.beamDir; if (bd) gd.beamDir = c3(bd); }); } finally { calmTorchPosed(); }   // torch lights where the hands (or the floor) now have them — the smoothed carry direction itself stays the file's (attachFlashlight eases it on from there next frame)
  // ---- doors, furniture, fixtures, devices
  for (const D of s.doors) {
    const d = g.doors.byName(D.name); if (!d) continue;
    const a = d.sided(fin(D.angle)), turned = a !== fin(D.angle);   // (doors.ts DOORWAY: a file from before the door had one side — or from a page with ?twoway — stands as wide on the side it opens into)
    d.angle = Math.max(d.minA, Math.min(d.maxA, a)); d.vel = turned ? -fin(D.vel) : fin(D.vel); d.pullT = Math.max(0, fin(D.pullT ?? 0)); d.pressT = Math.max(0, fin(D.pressT ?? 0)); d.solidT = Math.max(0, fin(D.solidT ?? 0)); d.openT = fin(D.openT ?? 10, 10); d.quietT = fin(D.quietT, 10); d.latched = !!D.latched; d.lastWho = D.lastWho ?? -1; d.sinceBash = fin(D.sinceBash, 10); d.closing = !!D.closing; d.swept = !!D.swept;
    d.locked = !!D.locked; d.lockBroken = !!D.lockBroken; d.noticed = !!D.noticed; d.noticedT = fin(D.noticedT, -1000); d.pick = Math.max(0, Math.min(1, fin(D.pick))); d.picking = false; d.pickIdle = fin(D.pickIdle); d.pickClock = fin(D.pickClock); d.pickN = D.pickN | 0; d.rattleT = 0; d.guardT = fin(D.guardT, -100); d.passers = (D.passers ?? 0) | 0; d.creakArmed = D.creakArmed !== false;
    d.shot = Math.max(0, fin(D.shot ?? 0));   // (doorblast.ts DOORSHOT: the rounds a hung leaf has taken)
    { const R = D.drive, k = R?.kind; d.drive = R && (k === 'boot' || k === 'swing' || k === 'body' || k === 'hand') ? { who: fin(R.who, -1), dir: R.dir < 0 ? -1 : 1, kind: k, t: Math.max(0, fin(R.t)), from: fin(R.from), quiet: !!R.quiet, side: fin(R.side) & 3, rate: Math.max(0, fin(R.rate)), px: R.px ?? NaN, pz: R.pz ?? NaN, hit: fin(R.hit ?? -1, -1) } : null; }   // (doors.ts DOORTHROW: who drove a leaf still in flight)
    if (D.off) slabRestore(d, D.off, fin(D.angle));   // off its hinges: the slab where it lay (the reset above hung every leaf)
    d.place();
  }
  g.col.dynamicBoxes = g.doors.leafBoxes();
  s.props.forEach((P, i) => { const p = g.props.all[i]; if (!p) return; p.x = fin(P.x, p.home[0]); p.z = fin(P.z, p.home[1]); p.yaw = fin(P.yaw, p.home[2]); p.vx = fin(P.vx); p.vz = fin(P.vz); p.w = fin(P.w); p.asleep = !!P.asleep; p.idle = fin(P.idle); p.lastWho = P.lastWho | 0; p.noiseT = fin(P.noiseT, -10); p.pushT = fin(P.pushT, -10); p.dirty = true; p.place(); });
  g.props.time = fin(s.propsTime, g.props.time);
  { const byName = new Map(g.targets.map(t => [t.name, t] as [string, LightTarget])); for (const T of s.targets) { const t = byName.get(T.name); if (!t) continue; t.on = !!T.on; t.broken = !!T.broken; t.disabledUntil = fin(T.disabledUntil, -1); t.handOff = typeof T.hand === 'number' ? fin(T.hand) : undefined; } }
  { const B = s.blackout, bo = g.blackout; bo.active = !!B.active; bo.until = infIn(B.until); bo.since = fin(B.since, -1); bo.permanent = !!B.permanent; bo.restoredAt = fin(B.restoredAt, -100); }
  if (s.devices && g.devices) g.devices.restore(g, s.devices);
  // ---- the floor's memory
  g.escalation = s.escalation === 2 ? 2 : s.escalation === 1 ? 1 : 0; g.escalationT = fin(s.escalationT, -1);
  g.alarm.episode = !!s.alarm.episode; g.alarm.pos = c3(s.alarm.pos); g.alarm.placed = !!s.alarm.placed; g.alarm.apartT = fin(s.alarm.apartT); g.alarm.raisedAt = fin(s.alarm.raisedAt, -100);
  g.clearedAt = new Map(s.clearedAt ?? []); g.clearRooms = s.clearRooms | 0; g.clearing = null;
  { const R = rollcallState(g), S = s.rollcall; R.nextAt = fin(S.nextAt, -1); R.stage = S.stage === 'called' || S.stage === 'asked' ? S.stage : 'idle'; R.t0 = fin(S.t0); R.caller = S.caller >= 0 ? G[S.caller] ?? null : null; R.missing = S.missing >= 0 ? G[S.missing] ?? null : null; R.answered = !!S.answered; R.checks = S.checks | 0;
    if (R.stage !== 'idle' && (!R.caller || R.caller.state === 'dead')) { R.stage = 'idle'; R.missing = null; } }
  if (g.qrf) { g.qrf.loudT = fin(s.qrf?.loudT, -1e9); responseWordRestore(g, s.qrf?.word); }   // (…and what was said on the net of where he is — qrf.ts RESPONSE.net; a file without it: nothing said yet)
  // ---- the mission and its chronicle
  { const M = s.mission; const stage: MissionStage = M.stage === 'drive' || M.stage === 'exfil' ? M.stage : 'infiltrate';   // (canLoad has refused 'failed' / 'done'; anything else unknown in a hand-made file is the start, not a guess)
    g.mission = { stage, t0: fin(M.t0), driveT: -1, pulled: !!M.pulled, alarmOn: !!M.alarmOn, sweepAt: fin(M.sweepAt, -1), spottedT: fin(M.spottedT, -100), debrief: false, downCardAt: -1, handsOn: !!M.handsOn, stats: { ...M.stats } }; }
  { const S = s.chronicle, C = new Chronicle();
    for (const e of S.events ?? []) { if (C.events.length >= MAX_EVENTS) break; C.events.push({ t: fin(e.t), kind: e.kind as ChronKind, room: e.room, pos: c3(e.pos), data: { ...(e.data as ChronData) } }); }
    C.dropped = S.dropped | 0; Object.assign(C.counts, S.counts ?? {}); for (const q of S.questioned ?? []) C.questioned.add(q);
    C.counts.loads = Math.max(C.counts.loads | 0, prevLoads); C.counts.saves = Math.max(C.counts.saves | 0, prevSaves);
    const n = Math.min(S.pathN | 0, Math.floor((S.path?.length ?? 0) / 3), C.path.length / 3); for (let i = 0; i < n * 3; i++) C.path[i] = S.path[i]; C.pathN = n; C.pathEvery = fin(S.pathEvery, 0.5) || 0.5; C.pathNext = fin(S.pathNext);
    g.chronicle = C; }
  // ---- what was in the air, on the strip, in the men's heads
  g.events.length = 0; for (const e of s.events ?? []) { if (e.kind === 'whistle') continue; g.events.push({ kind: e.kind, pos: c3(e.pos), time: fin(e.time), loud: !!e.loud, level: e.level, id: e.id, who: e.who, weapon: e.weapon, from: e.from ? c3(e.from) : undefined, to: e.to ? c3(e.to) : undefined, announced: e.announced, cause: e.cause === 'ocp' || e.cause === 'shot' ? e.cause : undefined, ...(Array.isArray(e.ears) && e.ears.length === 2 ? { ears: [c3(e.ears[0]), c3(e.ears[1])] as [Vec3, Vec3] } : {}), ...(Array.isArray(e.swAt) ? { swAt: c3(e.swAt) } : {}) }); }   // (a whistle is resolved ONCE per event object — whistle.ts resolve, a WeakMap — and everybody in earshot heard it the frame it sounded: put back as a fresh object it would be answered a second time; review G3.8)
  { const GS = glassState(g); GS.lastHitT = -100; for (const e of g.events) { GS.seen.add(e); g.qrf?.heardEvents.add(e); } }   // (the last half second's events are back for the men's EARS — heardUpTo says who has heard which; the glass and the QRF's gunfire memory took them when they happened: no second crack star, no re-count)
  forgetGuardClocks(g); forgetSuppressionClocks(g);   // (floor-wide bark / line clocks keyed by the Game would sit in the abandoned future muting everybody: Game.time has gone back)
  g.messages.length = 0; for (const m of (s.messages ?? []).slice(-5)) g.messages.push({ text: String(m.text), t: fin(m.t) }); g.cues.adopt(g.messages);
  gunWallRestore(g, s.gunWall);
  if (SAVETIMELINE.holds) { wallHoldRestore(g, s.wallHold); if (CLOSE.on) closeModeRestore(g, s.player.closeOn); }
  tapReset(g);
  stalkReset(g);   // (stalk.ts: nothing is stalked after a load — the button is pressed afresh)
  needsRestore(g, s.needs); whistleRestore(g, s.whistle); tacticsRestore(g, s.tactics); lanesRestore(g, s.lanes); dialogueRestore(g, s.dialogue);   // (whistle: the blower is keyed by the fresh Player, the men's halves by roster index — both exist by now)
  civiliansRestore(g, s.civilians);   // (after the men — she runs to / tells / was found by one of them by callsign — and after eventSeq: the fresh civilians' ears were stamped off the abandoned future's count; a file without the slice keeps them fresh on their marks, ears set right)
  if (s.weather && g.weather) g.weather.restore(s.weather);
  // ---- the marks
  for (const D of s.decals ?? []) {
    let attach = undefined as undefined | Box;
    if (D.door !== undefined && D.door >= 0) { attach = g.doors.list[D.door]?.box; if (!attach) continue; }
    else if (D.prop !== undefined && D.prop >= 0) { attach = g.props.all[D.prop]?.boxes[D.part ?? 0]; if (!attach) continue; }
    if (attach) {   // the file has the LOCAL frame: through the box as it stands now
      const w = localToWorld(attach, D.pos, true), n = localToWorld(attach, D.n, false), t = localToWorld(attach, D.t, false);
      const m = g.decals.add(D.kind, w, n, D.kind === 'scuff' ? undefined : D.radius, { tangent: t, param: D.param, seed: D.seed, attach, look: !!D.look }); if (D.look) lookDecal(m);
    } else { const m = g.decals.add(D.kind, D.pos, D.n, D.kind === 'scuff' ? undefined : D.radius, { tangent: D.t, param: D.param, seed: D.seed, pane: D.pane !== undefined && D.pane >= 0 ? D.pane : undefined, look: !!D.look }); if (D.look) lookDecal(m); }
  }
  glassPenRestore(g, s.glassPen);   // (the holes behind the stars just restored)
  g.airDust?.restore(s.air);   // (airDust.ts — after the weather, the walls, the doors' angles and the glass are the file's; no slice = the field as freshly seeded)
  // ---- the autosave controller's memory, the cursor's, the fixtures' supply baked for the first frame, the row on the timeline
  const A = g.saves; if (A) A.adopt(s.autosave, g);
  g.hover = null; g.interactables = []; g.nearby = []; g.act = null; g.useDoor = null; g.aimGuard = null; g.aimTarget = null; g.aimSnap = null;
  updateTargets(g, 0);   // (every target's factor / light / emissive off the restored switches and blackout NOW: a checkpoint written in the dark loads dark on its first frame, not its second)
  updateFire(g, 0);      // (… and an open fire's lamp, its place and its coals as this clock has them: fire.ts)
  if (s.dice && g.dice) { g.dice.s = s.dice.s | 0; g.dice.n = fin(s.dice.n); g.dice.seed = fin(s.dice.seed) >>> 0; }   // the game's own die back where the file left it — LAST, after every construction draw the clean slate above made
  if (s.kind !== 'harness') { chronCheckpoint(g, 'load', opts.label ?? s.label); g.messages.push({ text: `checkpoint loaded${s.label ? ` — ${s.label}` : ''}`, t: g.time }); if (g.messages.length > 5) g.messages.shift(); }   // (a harness restore is staging, not a checkpoint the player loaded: no row, no line, no load on the card)
}
/** a dynamic box's local point / direction into the world (the inverse of what decals.ts stores for an attached mark: yaw about +Y, then the centre) */
function localToWorld(b: Box, p: V3, point: boolean): Vec3 {
  let w: Vec3;
  if (b.rot) w = quat.rotate(b.rot, p);
  else { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); w = [p[0] * cs + p[2] * sn, p[1], -p[0] * sn + p[2] * cs]; }   // (boxes.ts: box local +X maps to world (cos yaw, 0, −sin yaw))
  return point ? [w[0] + b.c[0], w[1] + b.c[1], w[2] + b.c[2]] : w;
}

// ================================================================================================================================ the store (slots)
export interface SaveStore { get(key: string): string | null; set(key: string, val: string): boolean; remove(key: string): void; }   // set → false: nothing was stored (a full quota, a private window)
/** localStorage behind try/catch (a private window, a full quota: the save is dropped with a console line, the game goes on) */
export const localStore: SaveStore = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { console.warn(`checkpoint: could not store ${k} (${(v.length / 1024).toFixed(0)} KB) —`, e); return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch { /* */ } },
};
/** the headless harness's store: a Map (nothing on disk) */
export function memoryStore(): SaveStore & { map: Map<string, string> } { const map = new Map<string, string>(); return { map, get: k => map.get(k) ?? null, set: (k, v) => { map.set(k, v); return true; }, remove: k => { map.delete(k); } }; }
export interface SlotInfo { key: string; slot: 'manual' | 'auto'; n: number; label: string; kind: SaveState['kind']; savedAt: number; missionT: number; stage: string; runId: string; bytes: number; /** an autosave the floor came down on inside CKPT.regretSecs (why): offered only when nothing better is stored */ regret?: string; /** kept in memory, not in the store (SAVETIMELINE with a team on the floor): this run's, gone with the page */ mem?: true; }
/** a save kept in memory: the whole game as rollback.ts took it, and its picture */
interface MemSave { info: SlotInfo; snap: Snapshot; pic: string | null; /** the F10 recording it was made under (journal.ts `take`; 0 = none) */ take: number; }
/** what a recording takes of the checkpoint store at its frame 0 and a replay's store is given (Checkpoints.tapeBegin / tapeSeed) */
export interface TapeSlots { index: string | null; lastAuto: { key: string; t: number } | null; }
/** WHERE THE SAVES IN MEMORY STAND: on the host's shelf, in no snapshot. A snapshot walks everything the Game reaches and a restore writes it all back — a table
 *  of snapshots the Game could reach would be copied into the next one and rolled back by the last. So the shelf is a `HostOwned` (math/side.ts): never walked,
 *  never copied, never put back, never compared — not the simulation's state, and no state word reads it. */
class MemShelf extends HostOwned {
  private m = new Map<string, MemSave>();
  /** the snapshot nearest the game as it stands — the last one taken, or the one last put back: what the next is taken since (SAVETIMELINE.since). It may have
   *  left its ring: it is kept here until the next one is taken. null = the next save is a whole take (a new run, a file loaded, a recording begun). */
  last: Snapshot | null = null;
  get(key: string): MemSave | null { return this.m.get(key) ?? null; }
  set(key: string, e: MemSave): void { this.m.set(key, e); }
  remove(key: string): void { this.m.delete(key); }
  all(): MemSave[] { return [...this.m.values()]; }
  clear(): void { this.m.clear(); this.last = null; }
}
interface SlotIndex { v: number; next: number; slots: Record<string, SlotInfo>; }
export interface SaveResult { ok: boolean; why?: string; info?: SlotInfo; bytes?: number; state?: SaveState; }

// ================================================================================================================================ the controller (Game.saves)
let runSerial = 0;
rollbackVar('savestate.runSerial', () => runSerial, v => { runSerial = v; });
/** the room region a floor point is in, for the autosave's 'first time in a room' trigger and its label: on a quiet mission the LEVEL's own places (chronicle.ts
 *  roomOf with the level: a bazaar has no 'lobby'); on the plain night the table it always read; under SAVETIMELINE the level's own on every level */
function roomHere(g: Game, p: Vec3): string { return roomOf(p, g.quiet?.active || SAVETIMELINE.on ? g.level : undefined); }   // (SAVETIMELINE: autosaves now land on every level — a lesson, a squad's mission — and each gets its OWN rooms; roomOf keeps the table for the office)

export class Checkpoints {
  store: SaveStore;
  /** autosave on / off (the pause card / Tab; kept per machine) — manual saves and loads work either way */
  enabled = true;
  /** this run's identity (a fresh one per Mission object; a loaded run keeps the file's) and what the triggers remember: room regions entered, quiet seconds, where a hauled body was taken hold of */
  runId = ''; visited = new Set<string>(); quietT = 0; bodyFrom: Vec3 | null = null;
  /** game time of the last save written (any kind) */
  lastSaveT = -1e9;
  /** the request waiting on the gates: why, since when, the label it will carry */
  pending: { why: string; label: string; at: number } | null = null;
  /** the HUD's tag: text + game time it went up (overlay.ts shows it CKPT.flashSecs) */
  flash: { text: string; t: number } | null = null;
  /** the last few things that happened (panel / probes): saves, refusals, drops, loads */
  log: { t: number; what: string }[] = [];
  stats = { requests: 0, autosaves: 0, manual: 0, harness: 0, loads: 0, dropped: 0, refused: 0, deferredFrames: 0, regretted: 0 };
  /** QA hook: every state written (autosave or not) is also handed here — the soak keeps them to reload from */
  onSaved: ((s: SaveState | null, info: SlotInfo | null) => void) | null = null;   // (s null: a save kept in memory has no file)
  private missionRef: object | null = null; private stageRef: MissionStage = 'infiltrate'; private roomRef = ''; private dragRef: object | null = null;
  /** the last autosave written, while it can still be regretted (key + game time) */
  private lastAuto: { key: string; t: number } | null = null;
  /** SAVETIMELINE — the saves kept in memory (a team on the floor); the HOST's hook for a picture of the save just written (it hands one back through
   *  `setPicture` a frame later, or never) and its hook after a save in memory was put back (what it draws and plays from is the abandoned moment's);
   *  what the player's keys asked for this step (player.ts), done at the end of it: a save by hand, a save in memory to go back to */
  private shelf = new MemShelf();
  picture: ((info: SlotInfo) => void) | null = null;
  onPutBack: ((info: SlotInfo) => void) | null = null;
  private hand = false; private due: string | null = null;
  constructor(store?: SaveStore) { wallClock(this, 'runId');   // (a run's name is made of the clock and a serial: never compared between two plays)
    this.store = store ?? (typeof localStorage !== 'undefined' ? localStore : memoryStore());
    try { if (typeof localStorage !== 'undefined' && localStorage.getItem(KEY_AUTOSAVE_ON) === '0') this.enabled = false; } catch { /* */ }
  }
  setEnabled(on: boolean) { this.enabled = !!on; try { if (typeof localStorage !== 'undefined') localStorage.setItem(KEY_AUTOSAVE_ON, on ? '1' : '0'); } catch { /* */ } }
  /** into the store — false when it would not take it, or threw (a store of the host's own may: the game goes on without the save) */
  private put(key: string, val: string): boolean { try { return this.store.set(key, val); } catch { return false; } }
  private note(g: Game, what: string) { this.log.push({ t: g.time, what }); if (this.log.length > 40) this.log.splice(0, this.log.length - 40); }
  /** a loaded file's controller memory becomes ours (loadState) */
  adopt(a: AutosaveSnap | undefined, g: Game) {
    this.missionRef = g.mission; this.stageRef = g.mission.stage; this.roomRef = roomHere(g, g.player.char.pos); this.dragRef = null; this.pending = null;
    this.runId = a?.runId || this.runId || newRunId(); this.visited = new Set(a?.visited ?? []); this.visited.add(this.roomRef); this.quietT = fin(a?.quietT ?? 0); this.bodyFrom = null;
    this.lastSaveT = g.time;   // (a load counts as a save for the gap: no autosave on the heels of coming back)
    this.shelf.last = null;   // (a file's load deals the floor again: the next save in memory is a whole take, not one since a snapshot of the floor that is gone — and a recording begins, and its replay, on such a load: the first save in memory of both is whole)
  }
  /** raise an autosave request (coalesced: a request already waiting keeps its clock, takes the newer label) */
  request(g: Game, why: string, label: string) {
    if (!this.enabled) return;   // (off: the triggers keep their books — rooms visited, the quiet clock — so switching it on mid-run starts clean, but nothing is asked for)
    this.stats.requests++;
    if (this.pending) { this.pending.label = label; this.pending.why += '+' + why; return; }
    this.pending = { why, label, at: g.time }; this.note(g, `request: ${why} (${label})`);
  }
  /** The autosave gate proper: null = an autosave may be written this frame, else why not (the panel line says). */
  gate(g: Game): string | null {
    if (!missionLive(g)) return 'not a live run';
    if (!g.aiEnabled) return 'AI off';
    const hard = SAVETIMELINE.on && squadUp(g) ? canSnap(g) : canSave(g, false); if (hard) return hard;   // (a team on the floor: the save is kept in memory, and what a file refuses of hands and the air is in it)
    for (const x of g.guards) { if (x.state === 'dead') continue; if (x.state === 'alert' || x.state === 'search') return `${x.callsign} is ${x.state}`; if (x.awareness > CKPT.awareMax) return `${x.callsign} at awareness ${x.awareness.toFixed(2)}`; }
    return civilianCompromise(g);   // (the cleaner running for a guard is the floor going up in ten seconds' time: no checkpoint a stride ahead of it — civilians.ts, review G3.4)
  }
  /** Once a frame at the end of Game.update: the triggers, then the pending request against the gates. */
  tick(g: Game, dt: number) {
    const pl = g.player, m = g.mission;
    // a fresh run (boot, restartEncounter): fresh memory, a fresh id
    if (m !== this.missionRef) { this.missionRef = m; this.stageRef = m.stage; this.runId = newRunId(); this.visited = new Set([roomHere(g, pl.char.pos)]); this.roomRef = roomHere(g, pl.char.pos); this.quietT = 0; this.pending = null; this.bodyFrom = null; this.dragRef = null; this.lastSaveT = -1e9; this.shelf.clear(); this.hand = false; this.due = null; }   // (a save in memory is of ONE run: the objects it would be written back into are gone with it)
    // what the keys asked for inside this step, now that the frame is whole: F5's save, and a bare Enter once down onto a save in memory
    if (this.due) { const key = this.due; this.due = null; this.hand = false; const why = this.loadMem(g, key); if (why) g.msg(`checkpoint: ${why}`); return; }
    if (g.rails?.live) {   // a tutorial mission (rails.ts): its checkpoints are authored — the triggers below, the every-step request and the save by hand all stand down
      this.pending = null; this.hand = false;
      if (this.authored) { const label = this.authored; this.authored = null;
        // (the level's program is stopped for the take and started again by the frame on the next tick, with this step's cue: a beat is a function half run, which
        //  no snapshot holds — so what is kept is the floor with no program, exactly what putting it back starts from)
        const D = g.director; if (D?.run && !D.run.ended) { D.stop(false); g.rails.resume(); }
        this.writeMem(g, 'auto', label, true); }
      return; }
    this.authored = null;
    if (this.hand) { this.hand = false; const r = this.write(g, 'manual', 'by hand'); if (!r.ok) g.msg(`not saved: ${r.why}`); }
    // regret: the floor came down on him within regretSecs of the last autosave — that slot is marked, and the cards offer the one before it (checked ahead of the
    // live gate: the frame he drops is not live, and is exactly when it matters)
    if (this.lastAuto) {
      if (g.time - this.lastAuto.t > CKPT.regretSecs || g.time < this.lastAuto.t) this.lastAuto = null;
      else { const al = g.guards.find(x => x.state === 'alert' && (SAVETIMELINE.on ? hostileTo(x, 'player') : !x.unit)); const why = al ? `${al.callsign} alert ${(g.time - this.lastAuto.t).toFixed(0)} s after` : g.alarm.episode ? 'an alarm straight after' : pl.down ? 'down straight after' : null;   // (a mission's defenders are units too: under SAVETIMELINE the man who counts is one against him, not one who is no unit)
        if (why && (al || g.alarm.episode)) { this.markRegret(g, this.lastAuto.key, why); this.lastAuto = null; } }
    }
    if (!missionLive(g)) { this.pending = null; return; }
    if (!this.enabled) this.pending = null;
    // (1) the mission moved on
    if (m.stage !== this.stageRef) { const was = this.stageRef; this.stageRef = m.stage; if (STAGE_RANK[m.stage] > STAGE_RANK[was] && m.stage !== 'done') { const W = quietWords(g); this.request(g, 'stage', m.stage === 'drive' ? (W ? `${W.place} reached` : 'server room reached') : m.stage === 'exfil' ? (W ? `${W.bare} taken` : 'the drive is out') : m.stage); } }   // (a quiet mission: the level's own words for its room and its thing — quiet.ts)
    // (2) a room region entered for the first time this run
    const room = roomHere(g, pl.char.pos);
    if (room !== this.roomRef) { this.roomRef = room; if (!this.visited.has(room)) { this.visited.add(room); this.request(g, 'room', room); } }
    // (3) a body hidden: hauled ≥ bodyHideM from where he took hold of it and let go of (not dropped by a sprint into a fight: the gates see to that)
    if (pl.dragging && pl.dragging !== this.dragRef) { this.dragRef = pl.dragging; const b = pl.dragging.char.ragdoll; this.bodyFrom = b ? [b.x[0], 0, b.x[2]] : v3.copy(pl.char.pos); }
    if (!pl.dragging && this.dragRef) { const body = this.dragRef as Guard; this.dragRef = null; const b = body.char.ragdoll; const at: Vec3 = b ? [b.x[0], 0, b.x[2]] : pl.char.pos; if (this.bodyFrom && v3.distXZ(at, this.bodyFrom) >= CKPT.bodyHideM) this.request(g, 'body', `${body.callsign}'s body moved`); this.bodyFrom = null; }
    // (4) quiet play: the clock runs while the gates would pass, and asks every quietSecs of it
    const blocked = this.gate(g);
    if (!blocked) { this.quietT += dt; if (this.quietT >= CKPT.quietSecs) { this.quietT = 0; this.request(g, 'quiet', `${CKPT.quietSecs} s undetected`); } }
    // the pending request against the gates
    const P = this.pending; if (!P) return;
    if (g.time - P.at > CKPT.pendingSecs) { this.pending = null; this.stats.dropped++; this.note(g, `dropped: ${P.why} (${blocked ?? 'gap'})`); return; }
    if (g.time - P.at < CKPT.debounceSecs || g.time - this.lastSaveT < CKPT.minGapSecs) return;
    if (blocked) { this.stats.deferredFrames++; return; }
    this.pending = null;
    this.write(g, 'auto', P.label);
  }
  /** Write a checkpoint now into `slot` ('auto' = the next rotating one, 'manual' = the one manual slot, 'harness' = nowhere: returned only). */
  write(g: Game, slot: 'auto' | 'manual' | 'harness', label = '', force = false): SaveResult {
    let s: SaveState;
    this.runId ||= newRunId();   // (a save before the first tick still belongs to a run the cards and the Enter path can match)
    if (slot !== 'harness') g.journal.cut('a checkpoint was saved between frames');   // (off the panel, between two frames: on no tape, and the store is part of what an F10 recording replays on — journal.ts slotRead; inside an update, where every save of play is made, this does nothing)
    if (SAVETIMELINE.on && slot !== 'harness' && squadUp(g)) return this.writeMem(g, slot, label);
    try { s = saveState(g, { label, kind: slot, force, runId: this.runId }); }
    catch (e) { const why = (e as Error).message.replace(/^checkpoint refused: /, ''); this.stats.refused++; this.note(g, `refused ${slot}: ${why}`); return { ok: false, why }; }
    if (slot !== 'harness') { this.lastSaveT = g.time; this.quietT = 0; }   // (a harness snapshot leaves the run's autosave cadence alone)
    const json = JSON.stringify(s); const bytes = json.length;
    let info: SlotInfo | null = null;
    if (slot !== 'harness') {
      const idx = this.index(); const ring = SAVETIMELINE.on ? SAVETIMELINE.auto : CKPT.autoSlots; const n = slot === 'auto' ? idx.next % ring : SAVETIMELINE.on ? this.handSlot(idx) : 0; const key = slot === 'auto' ? KEY_AUTO(n) : KEY_HAND(n);
      info = { key, slot, n, label, kind: s.kind, savedAt: s.savedAt, missionT: s.missionT, stage: s.stage, runId: s.runId, bytes };
      if (SAVETIMELINE.on) this.store.remove(KEY_PIC(key));   // (the picture was the save's that stood here)
      let stored = this.put(key, json);
      if (!stored && SAVETIMELINE.on) { for (const k of Object.keys(idx.slots)) this.store.remove(KEY_PIC(k)); stored = this.put(key, json); }   // (a full store: a picture never costs a save — every one goes, and the save is tried again)
      if (!stored) { this.stats.refused++; this.note(g, `refused ${slot}: the store would not take ${(bytes / 1024).toFixed(0)} KB (${key.replace(KEY_PREFIX, '')})`); return { ok: false, why: 'the browser would not store it (quota / private window)', bytes, state: s }; }   // (nothing stored: no index entry pointing at a stale slot, no CHECKPOINT tag)
      idx.slots[key] = info; if (slot === 'auto') idx.next = (n + 1) % ring; this.put(KEY_INDEX, JSON.stringify(idx)); g.journal.slotWrote(key);
      if (SAVETIMELINE.on) this.picture?.(info);
    }
    if (slot === 'auto') { this.stats.autosaves++; this.flash = { text: 'CHECKPOINT', t: g.time }; this.lastAuto = { key: info!.key, t: g.time }; } else if (slot === 'manual') { this.stats.manual++; this.flash = { text: 'CHECKPOINT SAVED', t: g.time }; } else this.stats.harness++;
    this.note(g, `${slot}${info ? ' → ' + info.key.replace(KEY_PREFIX, '') : ''}: ${label || '—'} (${(bytes / 1024).toFixed(1)} KB${s.forced.length ? '; let go of ' + s.forced.join(', ') : ''})`);
    this.onSaved?.(s, info);
    return { ok: true, info: info ?? undefined, bytes, state: s };
  }
  /** mark a stored autosave regretted (see CKPT.regretSecs): it stays in the store and the list, the cards pass over it while anything else is there */
  markRegret(g: Game, key: string, why: string) {
    { const e = this.shelf.get(key); if (e) { if (!e.info.regret) { e.info.regret = why; this.stats.regretted++; this.note(g, `regretted ${key.replace(KEY_PREFIX, '')} '${e.info.label}': ${why}`); } return; } }
    const idx = this.index(); const info = idx.slots[key]; if (!info || info.regret) return; info.regret = why; this.put(KEY_INDEX, JSON.stringify(idx)); this.stats.regretted++; this.note(g, `regretted ${key.replace(KEY_PREFIX, '')} '${info.label}': ${why}`); }
  /** the slot index (repaired against what the store really holds) */
  index(): SlotIndex {
    let idx: SlotIndex | null = null;
    try { const raw = this.store.get(KEY_INDEX); if (raw) idx = JSON.parse(raw); } catch { idx = null; }
    if (!idx || idx.v !== SAVE_VERSION || typeof idx.slots !== 'object') idx = { v: SAVE_VERSION, next: 0, slots: {} };
    for (const k of Object.keys(idx.slots)) if (this.store.get(k) === null) delete idx.slots[k];
    return idx;
  }
  /** every stored checkpoint, newest first */
  slots(): SlotInfo[] { return Object.values(this.index().slots).concat(this.shelf.all().map(e => e.info)).sort((a, b) => b.savedAt - a.savedAt); }
  /** SAVETIMELINE — THIS RUN's saves in the mission clock's order, oldest first: the strip the pause and down cards lay out (files and saves in memory alike) */
  timeline(): SlotInfo[] { return this.slots().filter(x => x.runId === this.runId).sort((a, b) => a.missionT - b.missionT || a.savedAt - b.savedAt); }
  /** which of the ring by hand the next save takes: the first that stands empty, else the oldest */
  private handSlot(idx: SlotIndex): number { let n = 0, at = Infinity; for (let i = 0; i < SAVETIMELINE.manual; i++) { const x = idx.slots[KEY_HAND(i)]; if (!x) return i; if (x.savedAt < at) { at = x.savedAt; n = i; } } return n; }
  /** the picture kept with a slot (a data URL), or null: none was taken, it did not fit, or it was another save's */
  pictureOf(info: SlotInfo): string | null {
    const e = this.shelf.get(info.key); if (e) return e.pic;
    const raw = this.store.get(KEY_PIC(info.key)); if (!raw) return null; const cut = raw.indexOf('|'); return cut > 0 && raw.slice(0, cut) === String(info.savedAt) ? raw.slice(cut + 1) : null;
  }
  /** the host hands a save's picture in (see `picture`): kept if the slot still holds THAT save and the store will have it — false, and nothing else, otherwise */
  setPicture(info: SlotInfo, url: string): boolean {
    const e = this.shelf.get(info.key); if (e) { if (e.info.savedAt !== info.savedAt) return false; e.pic = url; return true; }
    if (this.index().slots[info.key]?.savedAt !== info.savedAt) return false;
    return this.put(KEY_PIC(info.key), `${info.savedAt}|${url}`);
  }
  /** F5 (player.ts, inside a step): a save by hand at the end of this update — the keys are the recording's, so a run played again saves where this one did */
  /** would a save by hand be refused at this moment — the reason write() would give? Asks only: nothing is written, counted or noted (the pause card, where the world is held and the answer cannot change) */
  handNo(g: Game): string | null { return SAVETIMELINE.on && squadUp(g) ? canSnap(g) : canSave(g); }
  askSave() { if (SAVETIMELINE.on) this.hand = true; }
  /** AN AUTHORED CHECKPOINT (rails.ts: a tutorial mission's step says where its checkpoints are, and they are the only ones there): kept in memory at the
   *  end of this update, whatever is on the floor — a team, the level's own program mid-beat, a round in the air */
  private authored: string | null = null;
  keep(label: string) { this.authored = label; }   // (the switch is read HERE: player.ts imports nothing of this module — an import there loads this file early from that door and the cycle then meets wind.ts before weather.ts)
  /** a load asked for INSIDE a step (player.ts: the bare Enter once down): a file is poured in at once, as ever; a save in memory is put back at the end of
   *  this update, where it was taken — never under the feet of the frame that is running */
  loadInStep(g: Game, key: string): string | null { const e = this.shelf.get(key); if (!e) return this.load(g, key); const why = this.memNo(g, e); if (why) return why; this.due = key; return null; }   // (refused NOW, where the caller can still fall back on a restart)
  private memNo(g: Game, e: MemSave): string | null { return e.snap.game !== g || e.info.runId !== this.runId ? 'made in another run' : g.touring || g.puppet ? 'a show is running — stop it first' : null; }
  /** SAVETIMELINE with a team on the floor: the game as it stands kept in memory, in its own two rings (this run's only) */
  private writeMem(g: Game, slot: 'auto' | 'manual', label: string, authored = false): SaveResult {
    const why = authored ? runNo(g, true, true) : canSnap(g); if (why) { this.stats.refused++; this.note(g, `refused ${slot}: ${why}`); return { ok: false, why }; }
    chronCheckpoint(g, 'save', label);
    this.lastSaveT = g.time; this.quietT = 0;
    const ring = slot === 'auto' ? SAVETIMELINE.auto : SAVETIMELINE.manual; let n = 0, at = Infinity;
    for (let i = 0; i < ring; i++) { const e = this.shelf.get(KEY_MEM(slot, i)); if (!e) { n = i; break; } if (e.info.savedAt < at) { at = e.info.savedAt; n = i; } }
    const key = KEY_MEM(slot, n);
    const info: SlotInfo = { key, slot, n, label, kind: slot, savedAt: Date.now(), missionT: g.mission.stats.elapsed, stage: g.mission.stage, runId: this.runId, bytes: 0, mem: true };
    // (SAVETIMELINE.since: what has not changed since the last save in memory — or the one last put back — is shared with it, not copied again and not walked;
    //  rollback.ts walks the whole game again by itself when that snapshot's chain has grown stale)
    const base = SAVETIMELINE.since ? this.shelf.last : null, snap = takeSnapshot(g, base ?? undefined); this.shelf.last = snap;
    this.shelf.set(key, { info, snap, pic: null, take: g.journal.take });
    if (slot === 'auto') { this.stats.autosaves++; this.flash = { text: 'CHECKPOINT', t: g.time }; this.lastAuto = { key, t: g.time }; } else { this.stats.manual++; this.flash = { text: 'CHECKPOINT SAVED', t: g.time }; }
    this.note(g, `${slot} → ${key.replace(KEY_PREFIX, '')}: ${label || '—'} (in memory)`);
    this.picture?.(info); this.onSaved?.(null, info);
    return { ok: true, info, bytes: 0 };
  }
  /** …and put back: every object of the game written as it stood (identities stand, the host is left as it is NOW — `onPutBack` is its turn). What the
   *  abandoned future knew and the save cannot is carried over as a file's load carries it: this run's counts of saves and loads, the controller's own books. */
  private loadMem(g: Game, key: string): string | null {
    const e = this.shelf.get(key); if (!e) return 'that checkpoint is gone';
    { const why = this.memNo(g, e); if (why) { this.note(g, `load refused: ${why}`); return why; } }
    g.journal.cut('a checkpoint was loaded');   // (as a file's load, below: between frames it is on no tape)
    // (inside an update — Enter once down — the load is that frame's own input and the recording runs on: the sensors' stream is the host's, sensors.ts, and
    //  a replay puts back its own save of the same frame. A save from BEFORE the recording is in no replay's memory: the tape ends with this frame)
    if (g.journal.recording && e.take !== g.journal.take) g.journal.cut('a save in memory from before the recording was loaded', true);
    // what is NOT the saved moment's to take back: the run's counts, the controller's books, and what the host and this machine set on the game since —
    // the autosave switch, the three hooks, the sandbox row, the tune rows (a file's load leaves all of these as they are NOW)
    const C = g.chronicle.counts, loads = C.loads, saves = C.saves, stats = { ...this.stats }, log = this.log.slice();
    const host = { enabled: this.enabled, picture: this.picture, onPutBack: this.onPutBack, onSaved: this.onSaved }, tune = { ...g.tune }, flags = { godMode: g.godMode, aiEnabled: g.aiEnabled, infiniteAmmo: g.infiniteAmmo };
    const st = this.store as { map?: Map<string, string> }, kept = st.map instanceof Map ? [...st.map] : null;   // (the harness's store is a Map the game reaches: the files written since are not the snapshot's to take back)
    restoreSnapshot(e.snap); this.shelf.last = e.snap;
    { const pl = g.player, S = pl.sel; if (S.ring?.free) { S.open = false; S.ring = null; S.downT = -1; S.moved = false; pl.nearSel = 0; } }   // (handring.ts: a ring that merely stood at the save is nothing of the saved moment — a file's load finds none either, and his first click after a load is his trigger, not a wedge)
    g.player.setup = null;   // (slotsetup.ts: a gun's setup that was up at the save is not up after the load — its digits are his slots again)
    g.orders.loaded();   // (a standing squad ring or plan mode in the save is put away: orders.ts)
    if (kept && st.map) { st.map.clear(); for (const [k, v] of kept) st.map.set(k, v); }
    Object.assign(this.stats, stats); this.log.length = 0; this.log.push(...log);
    Object.assign(this, host); Object.assign(g.tune, tune); Object.assign(g, flags); loadSandbox(g, false);
    g.chronicle.counts.loads = loads; g.chronicle.counts.saves = saves;
    this.pending = null; this.lastAuto = null; this.hand = false; this.due = null; this.lastSaveT = g.time;   // (a load counts as a save for the gap, as a file's does)
    chronCheckpoint(g, 'load', e.info.label); g.messages.push({ text: `checkpoint loaded${e.info.label ? ` — ${e.info.label}` : ''}`, t: g.time }); if (g.messages.length > 5) g.messages.shift();
    this.stats.loads++; this.flash = { text: 'CHECKPOINT LOADED', t: g.time }; this.note(g, `loaded ${key.replace(KEY_PREFIX, '')}: ${e.info.label || '—'} (from memory)`);
    g.rails?.putBack();   // (a tutorial mission's program is functions half run, which no snapshot holds: rails.ts starts it again and sends the step's cue again)
    this.onPutBack?.(e.info);
    return null;
  }
  /** The newest stored checkpoint, or null: with `preferRun`, this run's newest written at or before `beforeT` on the mission clock (after an older slot was loaded
   *  by hand, the abandoned future's slots are not 'the last checkpoint'), else this run's newest at all, else any run's newest. */
  newest(preferRun = true, beforeT = Infinity): SlotInfo | null {
    const all = this.slots(); if (!preferRun) return all[0] ?? null;
    const mine = all.filter(x => x.runId === this.runId), sound = mine.filter(x => !x.regret);   // (a regretted autosave — the floor came down on him straight after it — only when nothing else of the run is stored)
    return sound.find(x => x.missionT <= beforeT + 0.5) ?? sound[0] ?? mine.find(x => x.missionT <= beforeT + 0.5) ?? mine[0] ?? all[0] ?? null;
  }
  /** THE SLOT THE CARDS OFFER ('Restart from checkpoint' on the pause and down cards): `newest`, except that an EARLIER run's slot is offered only if this game
   *  would load it (canLoad) — the plain night's autosave is no offer under a quiet mission of the same level, nor a quiet mission's on the plain night, nor one
   *  made alone on a run with a partner: the newest earlier slot that WOULD load, else none (the card then has no such button, instead of one that refuses). */
  offer(g: Game, beforeT = Infinity): SlotInfo | null {
    const n = this.newest(true, beforeT); if (!n || this.isThisRun(n)) return n;
    for (const x of this.slots()) { if (x.runId === this.runId) continue; const s = this.read(x.key); if (s && !canLoad(g, s)) return x; }
    return null;
  }
  /** is this slot one of THIS run's (the cards word an earlier run's differently and never make it the default) */
  isThisRun(info: SlotInfo): boolean { return !!info && info.runId === this.runId; }
  /** WHAT A RECORDING TAKES OF THE STORE at its frame 0 (journal.ts begin): the index as it stands (every row, any run's) and the autosave still inside its
   *  regret window. The Enter once down reads both (`newest`, the regret mark) and the ring's next slot is the index's: a replay that began on an empty
   *  store chose another checkpoint, or restarted, where the recording went back to one made before it. null rows = nothing stored. */
  tapeBegin(): TapeSlots { const idx = this.index(); return { index: Object.keys(idx.slots).length || idx.next ? JSON.stringify(idx) : null, lastAuto: this.lastAuto ? { ...this.lastAuto } : null }; }
  /** …and a replay's game is given, after its checkpoint is loaded (tools/qa/replay.ts): the rows, each over an EMPTY text (a row with nothing behind it is
   *  dropped by `index`; an empty text reads as 'gone', which is what a slot nobody loaded is to the replay). The text of a slot the recording did load
   *  comes with its frame (`tapeText`). */
  tapeSeed(t: TapeSlots): void {
    let idx: SlotIndex | null = null; try { idx = typeof t.index === 'string' ? JSON.parse(t.index) as SlotIndex : null; } catch { idx = null; }
    if (idx && idx.slots && typeof idx.slots === 'object') { for (const k of Object.keys(idx.slots)) { if (!k.startsWith(KEY_PREFIX)) delete idx.slots[k]; else if (this.store.get(k) === null) this.store.set(k, ''); } this.store.set(KEY_INDEX, JSON.stringify(idx)); }
    this.lastAuto = t.lastAuto && typeof t.lastAuto.key === 'string' && typeof t.lastAuto.t === 'number' ? { key: t.lastAuto.key, t: t.lastAuto.t } : null;
  }
  tapeText(key: string, text: string): void { if (key.startsWith(KEY_PREFIX) && key !== KEY_INDEX) this.store.set(key, text); }
  /** parse a stored slot (null: gone / corrupt) */
  read(key: string): SaveState | null { try { const raw = this.store.get(key); return raw ? JSON.parse(raw) as SaveState : null; } catch { return null; } }
  /** Load a stored slot (or a given state) into the game. Returns why not, or null on success. */
  load(g: Game, from: string | SaveState): string | null {
    if (typeof from === 'string' && this.shelf.get(from)) return this.loadMem(g, from);
    const s = typeof from === 'string' ? this.read(from) : from; if (!s) return 'that checkpoint is gone';
    if (typeof from === 'string') g.journal.slotRead(from, () => this.store.get(from));   // (inside an update, a slot the recording did not write itself: its text goes on the tape)
    const why = canLoad(g, s); if (why) { this.note(g, `load refused: ${why}`); return why; }
    g.journal.cut('a checkpoint was loaded');   // (a load off a card or the panel is between frames and on no tape: an F10 recording ends whole before it and a new one is asked for — journal.ts cut; Enter once down is inside an update and on the tape)
    try { loadState(g, s); } catch (e) { const w = (e as Error).message; this.note(g, `load failed: ${w}`); return w; }
    this.stats.loads++; this.flash = { text: 'CHECKPOINT LOADED', t: g.time }; this.note(g, `loaded ${typeof from === 'string' ? from.replace(KEY_PREFIX, '') : 'a state'}: ${s.label || '—'}`);
    return null;
  }
  /** wipe every stored slot */
  clear() { const idx = this.index(); for (const k of Object.keys(idx.slots)) { this.store.remove(k); this.store.remove(KEY_PIC(k)); } for (let i = 0; i < Math.max(CKPT.autoSlots, SAVETIMELINE.auto); i++) { this.store.remove(KEY_AUTO(i)); this.store.remove(KEY_PIC(KEY_AUTO(i))); } for (let i = 0; i < Math.max(1, SAVETIMELINE.manual); i++) { this.store.remove(KEY_HAND(i)); this.store.remove(KEY_PIC(KEY_HAND(i))); } this.store.remove(KEY_INDEX); this.shelf.clear(); }   // (both rings at their full size whatever the switch says now, with or without an index that names them)
  /** the words for the cards: 'N s ago' off the mission clock for a checkpoint of this run, wall-clock age otherwise */
  ageWords(g: Game, info: SlotInfo): string {
    if (info.runId === this.runId && g.mission === this.missionRef) { const d = Math.max(0, Math.round(g.mission.stats.elapsed - info.missionT)); return d < 90 ? `${d} s ago` : `${Math.round(d / 60)} min ago`; }
    const w = Math.max(0, (Date.now() - info.savedAt) / 1000); return `an earlier run, ${w < 90 ? Math.round(w) + ' s' : w < 5400 ? Math.round(w / 60) + ' min' : Math.round(w / 3600) + ' h'} ago`;
  }
  /** import a file's text: validated, stored in the manual slot (not loaded — the caller decides); returns the slot or why not */
  importText(g: Game, text: string): SlotInfo | string {
    let s: SaveState; try { s = JSON.parse(text); } catch { return 'not JSON'; }
    const why = canLoad(g, s); if (why && !/show is running/.test(why)) return why;
    g.journal.cut('a checkpoint was imported');   // (as a save off the panel: write)
    const idx = this.index(); const n = SAVETIMELINE.on ? this.handSlot(idx) : 0, key = KEY_HAND(n); if (SAVETIMELINE.on) this.store.remove(KEY_PIC(key));
    const info: SlotInfo = { key, slot: 'manual', n, label: s.label || 'imported', kind: s.kind, savedAt: Date.now(), missionT: s.missionT, stage: s.stage, runId: s.runId, bytes: text.length };   // (savedAt = the import: 'newest' — the panel's load / export default — is then this file, as its message says)
    if (!this.put(key, text)) return 'the browser would not store it (quota / private window)';
    idx.slots[key] = info; this.put(KEY_INDEX, JSON.stringify(idx)); this.note(g, `imported → manual: ${info.label} (${(text.length / 1024).toFixed(1)} KB)`);
    return info;
  }
  /** one line for the panel */
  summary(g: Game): string {
    const gate = this.gate(g); const P = this.pending; const n = this.slots().length;
    return `checkpoints ▸ autosave ${this.enabled ? 'on' : 'OFF'} · ${gate ? 'gated: ' + gate : `clear, quiet ${this.quietT.toFixed(0)}/${CKPT.quietSecs} s`}${P ? ` · pending ${P.why} ${(g.time - P.at).toFixed(0)} s` : ''} · rooms ${this.visited.size} · ${n} stored · ${this.stats.autosaves} auto / ${this.stats.manual} manual / ${this.stats.loads} loads / ${this.stats.dropped} dropped / ${this.stats.refused} refused${this.stats.regretted ? ` / ${this.stats.regretted} regretted` : ''}`;
  }
}
const STAGE_RANK: Record<MissionStage, number> = { infiltrate: 0, drive: 1, exfil: 2, done: 3, failed: 3 };
function newRunId(): string { return `${Date.now().toString(36)}-${(++runSerial).toString(36)}`; }
