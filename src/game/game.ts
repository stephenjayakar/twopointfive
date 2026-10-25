// Game layer core: the Game state holder and its per-frame orchestration, the Player / Guard / LightTarget types, door + prop contact plumbing.
// The systems live beside it as plain-function modules taking the Game first: player.ts (controller, takedown / drag, throws, the cursor's
// interactables), guards.ts (perception, state machine, barks, escalation), combat.ts (shots, kills, hand props, live throwables), lighting.ts
// (fixtures, OCP, blackout), mission.ts (the mission thread), squad.ts (scripted guards).
import { wallClock } from '../math/side';
import { Vec3, v3, clamp, damp, lerp, DEG, smoothstep } from '../math/vec';
import type { HostApi } from '../host/api';
import type { View } from '../host/hud';   // the view as the game reads it: clientWidth / clientHeight / width / height — the page's canvas, a plain object headless and natively   // the engine as the game sees it: a type, so this layer no longer imports src/engine.ts
import type { RingState } from './cmdring';
import { planLate, planLook, planHome } from './planmode';
import { Level, PatrolRoute, Chokepoint } from '../scene/level';
import { StaticCollision } from '../scene/collision';
import { GltfCharacter } from '../anim/gltf';
import { CharacterRenderer } from '../anim/characters';
import { Character, MOVES, inDipLane } from './character';
import type { Stance, HoldPhase, HoldVariant, KitItem } from './character';
import { Input } from './input';
import { FollowCamera } from './camera';
import { Seat, sampleCmd, checkCmd, CMDCHECK } from './cmd';   // the player's input as one plain record a tick (cmd.ts)
import type { PlayerCmd } from './cmd';
import { RtLight } from '../render/lights';
import { IrradianceProbe } from '../render/probe';
import { MeshShadows } from '../render/meshShadows';
import { fitRig, fitRigCast } from '../render/sdfrig';
import { castParts } from './cast';
import { statureTick, statureOf, drawnJoints, drawnCapsules, drawnFit, drawnBoxes } from './stature';
import { Decals } from '../render/decals';
import { buildWearMap } from '../render/wear';
import { buildSnowField, snowCfgRows, type SnowField } from '../render/snowField';
import { makeSnowTracks, updateSnowTracks, clearSnowTracks, formSnowTracks, TRACK_RES, type SnowTracks } from './snowTracks';
import { updateSnowMarks, clearSnowMarks } from './snowMarks';
import { snowBogAt } from './snowBog';
import { attachSnowBlast, clearSnowBlast, stepSnowDigs } from './snowBlast';
import { SNOW_LOOK, snowLevel, WEATHER_PRESETS } from './weatherKinds';
import { levelNameOf } from '../scene/levelLoad';
import { SmokeSystemLike } from '../smoke/types';
import { Box, BoxFlag, rayBox } from '../scene/boxes';
import { markStats, markWorldRect, AREA_LIT_MARKS, MARKING_TEXEL } from '../scene/markings';
/** an emissive marking registers a light only from this on-axis intensity up (W/sr): the vending fronts are ≈ 2.2–2.8, a monitor's UI bars 0.02, an LED row 0.01 */
export const MARK_LIGHT_MIN_I0 = 0.05;
import { Pistol, Rifle, Ocp, Firearm, WEAPONS, handlingOf } from './weapons';
import { AimWeight } from './aimweight';
import { GEAR } from './gear';   // (a leaf: which rifle is drawn decides whose reload marks the support hand works)
import type { Ring } from './launcher';
import { updateRings, ringBoxes } from './launcher';
import type { Shell } from './he40';
import { updateShells, shellBoxes } from './he40';
import { updateGlass, glassSummary, crackTest, resetGlass, loadGlassFx } from './glass';
import { glassPenLive, shotPasses, resetGlassPen, loadGlassPen, GLASSPEN_HOOKS } from './glasspen';
import { bootBars, resetBars } from './winbars';
import type { WeaponId, RifleAttachment } from './weapons';
import { Doors, Door, DoorEvent, DoorContact, FLOOR_KEY, DOORWAY } from './doors';
import { dealSwings, swingsNow, type SwingDeal } from './doorswing';
import { nameDoors } from './doornames';
import { doorBlast, doorSlabs } from './doorblast';
import { RAG } from './ragdoll';
import { Throwables, ThrowSolution, Item } from './throwables';
import { PropSystem, PropEvent, PropContact, Prop } from './props';
import { GameAudioLike, nullAudio } from './audio_iface';
import * as fx from './effects';
import { Sparks } from './sparks';
import { Tracers } from './tracers';
import { blastLookTick } from './blastLook';
import { blastFeelTick } from './blastFeel';
import { Particles } from '../render/particles';
import { sparkSink, kickDustFx, lockSplinterFx, updateParticleFx, clearParticleFx, loadDust, applyDustLook } from './particleFx';
import { Weather, airTrans } from './weather';
import { updateWetness, wetInstance, wetKnobs, wetLineRow, wetSummary, clearWetPrints } from './wet';
import { disarmTick } from './disarm';   // the grab disarms him (disarm.ts): once a frame
import { takedownTick } from './takedown';   // takedowns as moves (takedown.ts): who breathes, once a frame
import { hourAfterReset } from './hours';
import { charLookFrame, charSides } from './charLook';
import { placeholderTints, TINTS_AS_IS } from '../render/charMaterials';
import { updateRainFx, rainSummary } from './rainFx';
import { updateSnowBreath } from './snowBreath';
import { updateSmokeBreak } from './smokebreak';
import { showWhyTick, resetShowWhy } from './showwhy';
import { updateFire, fireDraws } from './fire';
import { railLightDef, torchLightDef, carbineGrip, carbineMuzzleAhead, sc20kGrip, sc20kMuzzleAhead, modelGrip, modelMuzzleAhead } from './rigProps';
import { hostileTo, type Team } from './teams';
import { PLAYER_ID } from './consts';
import { doorMan, doorThrowAfter } from './doorthrow';
import { updateMission } from './mission';
import { objectivePos, objectiveText } from './mission';
import { Chronicle, chronInterrogated } from './chronicle';
import { handProps, hiddenProps, irBeams, updateItems } from './combat';
import { irViewer, irMade } from './irlaser';
import { thinFit } from './thinline';
import { dropThrowable } from './combat';
import { FRAG, fragTick, fragThrowTick, fragReset } from './frag';
import { moraleTick, moraleReset } from './morale';
import { runnerTick } from './runner';
import { flinchTick } from './flinch';
import { darkDoorTick } from './darkdoor';
import { netQuietTick } from './netquiet';
import { samStaggered } from './samstun';
import { sprintDoorRun, sprintDoorAfter, sprintDoorKick } from './sprintdoor';
import { recapTick } from './deathrecap';
import { teamTallyTick } from './teamtally';
import { updateGuard, lightEstimateAt, longRigOf, inHand, loadBodyLight, bodyLightSummary, groundFresh } from './guards';
import { SENSE, CpuSmoke, ownSmoke } from './sense';
import { say, resetGuards, tension, updateEscalation, escalationSummary, raiseEscalation, standDownEscalation, clearingSummary, clearQueueSummary, forceClear, searchSummary, witnessSummary, standoffSummary } from './guards';
import type { SearchPlan, Pieing, Standoff } from './guards';
import type { Clearing } from './squad';
import { updatePlayer, startTakedown, updateAim, launchCancel } from './player';
import { CLOSE, closeAt, closeRmb, closeSeatTick, closeReset, closeLethal, closeBare } from './close';
import { STALK, stalkHas, stalkGrab, stalkKeyCan, stalkKeyTook, stalkReset } from './stalk';
import { tapReset } from './tapstep';
import { samLookStep } from './samlook';
import type { CloseKind } from './close';
import { doorMoveBegin, doorMoveTick, haulSetDown, teamDoorHand } from './hands';
import type { Haul, DoorMove } from './hands';
import type { Wanding } from './wand';
import { samBigStart } from './bigkit';
import { sideTick } from './gunslots';   // (called inside the update only)
import { mateStowTick } from './workstow';   // (the same)
import { gunLookOf, gunLookOn } from './gunlook';   // (called inside the update only)
import { feedDeal } from './gunreload';   // (the same)
import type { StickyCam } from './stickycam';
import { updateStickies, stickyBoxes, takeCam } from './stickycam';
import { lightSwitchTick, lightSwitchReset, switchAct, switchBoxes } from './lightswitch';
import { breakerStart, breakerTick, swapFeed, teamWorkHand } from './handwork';
import { throwCount, toggleDrag, teleportPlayer, startPicking, startWand, startKick, settlePlayer, settleSpot, startGrab, freeHeld, settleHeld, takeKey, pickHover, EASE_RATE, EASE_MAX } from './player';
import type { WallHold, Hold } from './player';
import { updateInteract, escapeInteract, backableInteract } from './interact';
import { ownBlowAct } from './ownblow';
import { slotSetupOpen, slotSetupShut } from './slotsetup';
import { tacticsTick, loadTactics, tacticsSummary, tacticsReset } from './tactics';
import { lanesTick, lanesReset } from './lanes';
import { pictureTick, pictureReset } from './picture';
import { darkFoeTick } from './darkfoe';
import { powerOutTick, powerOutReset } from './powerout';
import { rescueCheckTick, rescueCheckReset } from './rescuecheck';
import { dozeTick, dozeInChair, dozeReset } from './doze';
import { wallReactTick, wallReactReset } from './wallreact';
import { BLAST_PACE } from './destructionSwitch';
import { loadTeamFeel } from './teamfeel';
import { nvgTick } from './nvg';
import { irLightTick, irFlags } from './irlight';
import { silentTick, silentEase } from './silent';
import { holdFireReset } from './holdfire';
import { spottedTick } from './spotted';
import { handPress } from './handleside';
import { roundsLeaves, ROUND_PACE } from './doorway';
import { needsTick, loadNeeds, needsSummary } from './needs';
import { Director } from './director';
import { NightBreach } from './nightbreach';
import { QuietMission } from './quiet';
import { Lesson } from './lesson';
import { Rails } from './rails';
import { Par } from './par';
import { Verdict } from './verdict';
import { Snatch } from './snatch';
import { Defuse } from './defuse';
import { RoomClearScenario } from './roomclear';
import { SquadOrders } from './orders';
import { leversFog } from './difficulty';   // (called in the constructor only: the fog lever's rung over the kept feel rows)
import { FogOfWar, fogFlags } from './fogofwar';
import { RoomFight } from './roomfight';
import { Cues } from './cues';
import { SquadNet } from './squadnet';
import { Cover } from './cover';
import { rearWatchTick } from './rearwatch';
import { EntryPoints } from './entrypoints';
import { ClearedRooms } from './cleared';
import { Rescue } from './rescue';
import { DoorTools } from './doortools';
import { squadSmokeKey } from './squadsmoke';
import { wandOrderKey } from './wandorder';
import { squadThrowKey } from './squadthrow';
import { squad40Tick } from './squad40';
import { PairOrders } from './pairorders';
import { pairUpApply } from './pairup';
import { WallCharge } from './wallcharge';
import { WorkThings, workHand, workJob } from './workthings';
import { DoorPath } from './doorpath';
import { registerShutDoor } from './shutdoor';
import { spawnCivilians, resetCivilians, updateCivilians, civiliansShown, civilianDoorContacts, civilianAnswer, civiliansSummary, loadCivTune, civilianSeated, civilianPushesProps } from './civilians';
import type { Civ } from './civilians';
import { updateTargets } from './lighting';
import { carLampTargets, VEHICLE_GROUP } from './carlamps';   // a parked vehicle's lamps are light targets a round breaks (nothing with CARLAMPS down)
import { setBlackout, endBlackout, lightEvent, ocp, setGroup, toggleTarget, repairLights, freshLights, lensRecheck } from './lighting';
import { gunWallFresh } from './gunwall';   // (called inside cleanSlate only)
import { CLEANRESTART, CLEANRESTART_STATS } from './cleanrestart';   // a restart gives a clean level (a leaf: the switch and its tally)
import { stepMat } from './floor';
import type { FloorMat } from './floor';
import * as dialogue from './dialogue';
import type { DialoguePick } from './dialogue';
import { Sup, updateSuppression, suppressionSummary } from './suppression';
import { conditionSummary, conditionPose } from './condition';
import { AimState, trackPlayer, aimSummary } from './aim';
import { Qrf, updateQrf, resetQrf, loadQrfTune } from './qrf';
import { openingStart } from './opening';
import { Checkpoints } from './savestate';
import { Sensors } from './sensors';
import type { ProbeLike } from './sensors';
import { SessionRecorder } from './journal';
import { Devices, updateDevices, deviceBoxes, loadDeviceTune, startCoding, denyPad, learnCode, DEVICE_TUNE_DEFAULTS } from './devices';
import { Destruction, loadChaos } from './destruction';
import { fixtureBreakBoxes } from './fixtureBreak';   // the look of a fixture breaking and hanging broken (picture only)
import { coverfireTick, coverfireReset } from './coverfire';
import { doorForceTick, doorForceReset } from './doorforce';
import { Wind, loadWind } from './wind';
import { updateAirSim, attachAir, airResend } from './airSim';
import { AirDust } from './airDust';
import { Moths } from './moths';
import { GlassBreak, loadGlassBreak } from './glassbreak';
import { GlassShards, loadShards } from './shards';
import { kitFresh } from './kit';
import type { BigKit } from './kit';
import type { KitWorn } from './kitload';
import { loadGait } from './kitload';   // (asked inside the frame only)
import type { Wound } from './wounds';
import { buildWallRaster, buildInteriorCells, reachMaskFor, reachMaskSome, reachFraction, reachMaskForDirectional, wallRasterDiff, REACH_WORK, REACH_PACE, type ReachOnly, type ReachJob } from '../render/reach';
import { WORLD } from '../scene/world';
import { simRandom, useDice } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import type { SimDice } from '../math/dice';

// ---------------------------------------------------------------- light targets
export interface LightTarget {
  name: string; group: string; kind: 'analytic' | 'emissive' | 'breaker' | 'device';   // device: a camera or a tripwire's emitter (devices.ts) — no boxes or light of its own here, it draws itself off `factor`; the OCP, a round and the mains treat it as any fixture
  pos: Vec3;                       // fixture position (for targeting / AI)
  light?: RtLight; boxes: number[]; baseEmissive: Vec3; baseIntensity: number;
  on: boolean; broken: boolean; disabledUntil: number; fluorescentFlicker: boolean;
  factor: number;
  mains: boolean;                  // fed from the breaker (drops in a blackout); false for street lighting, exit signs, UPS-fed LEDs, beacons
  interactive: boolean;            // can be aimed at / OCP'd / shot as a fixture (server LEDs are scenery: too many, too small, pure UI noise)
  stagger: number;                 // restrike delay for this fixture's contactor group when the mains come back
  /** the game time a hand put it out at its wall switch (lightswitch.ts; meaningful only while `on` is false): 'lights on' puts these back, and a defender at the switch does */
  handOff?: number;
  areaLights?: { light: RtLight; base: number }[];   // analytic area lights standing in for a flat emissive fixture's emission (smooth direct light + soft shadows instead of cascade rays finding a small bright box)
  /** a vehicle lamp's own paint as the level has it (carlamps.ts: a broken one is painted dark, a mended one painted this again) */
  lens?: Vec3;
}

/** kick: a door kicked in — carries through the floor and is answered like a shot (guards.ts hearingCheck); every other door noise is 'door' with a level. A round
 *  ('shot' / 'guardShot' out of combat.ts fireWeapon) also says which weapons.ts row fired it and the segment it actually flew, muzzle → where it stopped (from / to):
 *  nothing in the hearing model reads those — a report is a report — they are for whoever reasons about ROUNDS (the QA soak; suppression). whistle: Sam's low whistle
 *  (V, whistle.ts) — the nearest calm man who hears it comes for a look, twice and he searches; level WHISTLE.level, at his feet, who = the player. */
export interface GameEvent { announced?: boolean; kind: 'shot' | 'lightOut' | 'guardShot' | 'step' | 'door' | 'kick' | 'bang' | 'prop' | 'whistle' | 'glass'; pos: Vec3; time: number; loud: boolean; level?: number; id?: number; who?: number; weapon?: WeaponId; from?: Vec3; to?: Vec3; cause?: 'ocp' | 'shot'; /** a 'lightOut' a hand made at a wall switch: the floor before the plate — where a man who saw it comes to (lightswitch.ts) */ swAt?: Vec3; blind?: boolean; /** a 'prop' knock made to be looked at (a ring's clack): attention.ts — it reaches a calm man and he goes to look at IT */ lure?: boolean; /** a 'bang' that was a fragmentation grenade (frag.ts blast), not a stun charge */ frag?: boolean; /** a 'bang' that was a door or wall CHARGE borrowing the canister's report (combat.ts detonateStun `borrowed`): read only for what a man who hears it SAYS */ charge?: boolean; /** a 'glass' event under GLASS.bothFaces (glass.ts glassEvent): a point just off each face of the pane, which the crash is heard from as well as from `pos` */ ears?: [Vec3, Vec3]; }   // (cause, lightOut only: the OCP's spell — the light dims out and comes back — or a fixture SHOT dark; guards.ts hearingCheck weighs them differently)
export type ThrowKind = 'smoke' | 'flash' | 'frag';
/** What a slot of the kit holds — the item Player.slot has SELECTED (in the hand, or holstered / slung with E): the Five-seveN, the FN2000, a smoke canister, a stun
 *  canister. Every rule about "what is in his hand" reads the kind, never a digit; the digit keys and the kit column's order and numbering are KIT_ORDER's alone
 *  (1 pistol · 2 rifle · 3 smoke · 4 stun — the numbering is stable per item: a kit without the rifle still throws smoke on 3). */
export type SlotKind = 'pistol' | 'rifle' | ThrowKind;
/** the kit top to bottom = the digit that selects each item (index + 1) */
export const KIT_ORDER: readonly SlotKind[] = ['pistol', 'rifle', 'smoke', 'flash', 'frag'];   // (5: the fragmentation grenade — frag.ts; the last digit there is: nothing in the game is on a digit above 5)
/** Anything Space acts on. Two shapes share the type: the MARKER of a thing (Game.interactables — one per door / body / guard / rack / breaker / light: its dot in the
 *  world, the auto-aim's lights; `verb` absent) and the ROW of one thing Space can do to it right now (Game.nearby — player.ts buildInteractables: 'push it open'
 *  and 'ease it open' are two rows of one shut door; `verb` set, `line2` = 'Space␠␠<the verb>' plus hint lines for the thing's other inputs). progress (0‥1): the
 *  bar in the row / the ring round the reticle while a sustained verb runs (`running`: that row IS the running verb — a lock being picked, a leaf being eased,
 *  the choke, the drive coming out). 'held' = the man in Sam's arm (player.ts Hold): his rows are the only rows while he is held. 'cancel' = the selector's
 *  bottom row while it is open (interact.ts): letting go of Space on it does nothing. */
export interface Interactable { kind: 'light' | 'door' | 'body' | 'guard' | 'objective' | 'held' | 'breaker' | 'wall' | 'cam' | 'switch' | 'charge' | 'cancel'; pos: Vec3; line1: string; line2: string; inReach: boolean; off: boolean; progress?: number; target?: LightTarget; door?: Door; guard?: Guard; verb?: Verb; running?: boolean;
  /** a man's row with the close-in windows on (close.ts): the way in Sam's spot gives — the click and the grab that follow make that move */
  close?: CloseKind;
  /** a door's row that is listed PAST the list's cap, under the rows Space had before it (the big slot's tool on an unlocked door — bigkit.ts; a charge by hand
   *  is the other such row, known by its verb) */
  past?: boolean;
  /** a MARKER whose every row the mission's frame kept back this frame (rails.ts `rows`; player.ts buildInteractables): the key does nothing on the
   *  thing though it has rows — an empty tap in reach of it says so (interact.ts emptyWord) */
  framed?: boolean; }
/** Every verb a row can be (player.ts buildInteractables words them; game.ts updateDoors / player.ts updateHold / mission.ts act on Game.act): a shut door's
 *  push / ease (silent, sustained), an open one's pull, a lock's pick (sustained) / kick / rattle (the handle tried, crouched), a keyed lock's unlock; the grab
 *  of a man from behind; the held man's question / choke (sustained) / pistol-whip (sustained); a body's drag / drop; the rack's drive (sustained); the mains
 *  thrown / re-armed by hand; and the selector's own cancel. */
export type Verb = 'push' | 'pull' | 'ease' | 'unlock' | 'pick' | 'kick' | 'rattle' | 'code' | 'nocode' | 'wand' | 'breach' | 'hammer' | 'grab' | 'question' | 'choke' | 'whip' | 'comply' | 'drag' | 'drop' | 'drive' | 'breakerOff' | 'breakerOn' | 'charge' | 'blow' | 'defuse' | 'takeCam' | 'lightsOff' | 'lightsOn' | 'lead' | 'stay' | 'cancel';   // lightsOff / lightsOn: a room's wall switch (lightswitch.ts);   // lead / stay: a rescue's hostage told to get up and follow, or to stay where she stands (rescueend.ts);   // takeCam: a stuck sticky camera of his own taken back onto the launcher (stickycam.ts);   // comply: a held CIVILIAN told to get down and stay quiet — lets her go, cowering (civilians.ts);   // code / nocode: a keypad door's pad — the code entered (sustained, devices.ts) / the pad tried without one (a deny beep)

// ---------------------------------------------------------------- mission
/** The one mission thread: insert (the spawn) → reach the server room → pull the drive from one rack (F, a few seconds within reach) → out through the
 *  fire exit. Everything it touches already exists (the rooms, that rack's LED switchables, the hearing model, the down / restart flow): it only watches,
 *  counts and says what is next. Geometry lives in level.mission. */
export type MissionStage = 'infiltrate' | 'drive' | 'exfil' | 'done' | 'failed';
export interface MissionStats { /** RESPONSE: the level's name for the team that came (qrf.ts deploy; absent: the office's) */ qrfWho?: string; elapsed: number; alerts: number; spotted: number; bodies: number; shots: number; kills: number; knockouts: number; keys: number; blackout: boolean; sandbox: boolean; qrf: 0 | 1 | 2; qrfAt: number; }   // qrf = how far the response went this run (game/qrf.ts: 0 nobody called it, 1 the response team came onto the floor, 2 the compound was locked down round him — the debrief's 'exfil under perimeter lockdown'), qrfAt = mission seconds when the team deployed (−1); alerts = alarm EPISODES (someone went to alert while nobody was), bodies = distinct bodies discovered (dead or out cold); kills = men the PLAYER shot dead, knockouts = men he put down breathing (the takedown; a choke-out later) — combat.ts killGuard's how / by; keys = keys taken off questioned men (player.ts takeKey); sandbox = a cheat flag was on at some point
export interface Mission {
  stage: MissionStage; t0: number;   // t0: game time the run started (elapsed is accumulated separately: pauses and the tour do not count)
  driveT: number;                    // seconds into pulling the drive, -1 = not pulling
  pulled: boolean;                   // the drive is out: its rack stays dark until the encounter restarts
  alarmOn: boolean;                  // somebody is at 'alert' right now (edge → an alarm episode)
  sweepAt: number;                   // game time at which somebody gets sent to look at the dead rack (-1 = nobody pending)
  spottedT: number;                  // last time an alert guard had eyes on you (episode debounce for stats.spotted)
  debrief: boolean;                  // one-shot for the page: open the end card (mission complete) — or, once `stage` is 'failed', the down card
  downCardAt: number;                // game time the down card comes up (mission.ts DOWN_CARD_SECS after he dropped; -1 = not pending)
  handsOn: boolean;                  // the drive has been touched at least once (the chronicle notes the first time only)
  stats: MissionStats;
}
export type MissionRating = 'ghost' | 'panther' | 'assault';
/** Chaos Theory's own words: ghost = never spotted, no kills, no alarms; panther = lethal or loud but never actually seen; assault = they had eyes on you. */
export function missionRating(s: MissionStats): MissionRating { return s.spotted > 0 ? 'assault' : s.kills === 0 && s.alerts === 0 && s.bodies === 0 ? 'ghost' : 'panther'; }   // ghost: never seen, no alarm, nobody shot, nothing found (a silent takedown nobody finds keeps it — a man out cold is not a kill); panther: they know someone was there but never saw who
export function fmtClock(sec: number): string { const s = Math.max(0, Math.floor(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
const newMission = (t0: number): Mission => ({ stage: 'infiltrate', t0, driveT: -1, pulled: false, alarmOn: false, sweepAt: -1, spottedT: -100, debrief: false, downCardAt: -1, handsOn: false, stats: { elapsed: 0, alerts: 0, spotted: 0, bodies: 0, shots: 0, kills: 0, knockouts: 0, keys: 0, blackout: false, sandbox: false, qrf: 0, qrfAt: -1 } });

/** the ragdoll particles a door leaf feels (Game.updateDoors): enough of the body that a leaf cannot close through it */
const BODY_DOOR_PARTICLES = [RAG.pelvis, RAG.spine, RAG.head, RAG.kneeL, RAG.kneeR, RAG.ankL, RAG.ankR];

// ---------------------------------------------------------------- player
export class Player {
  char: Character;
  crouch = false; aimHeld = false; lastFireT = -10; fireCd = 0; backpedal = false; sprinting = false; /** Shift held in a crouch this frame (player.ts CROUCHRUN): the fast crouch walk — set where `sprinting` is, false wherever that is not reached */ dash = false;
  friendLow = false; friendT = -10;   // friends.ts: his raised gun is down for a teammate in its line (FRIENDS.lowReady), and how long that line has been clear
  shoved: [number, number] = [0, 0]; shovedT = -1; shovedFrom: [number, number] = [0, 0];   // noshove.ts: what the men he met moved him by in this update (x, z), the clock of that update, and where the update found him — written and read inside one frame
  haul: Haul | null = null; doorMove: DoorMove | null = null;   // hands.ts: the pick-up of the body in `dragging` (which end, which beat) · the door he is working by hand (HANDS, its switch; both null with it off)
  dragging: Guard | null = null; dragYaw = 0; dragNoiseT = 0; dragStuckT = 0;   // the body being dragged (F): crouched, facing it, its ankles in your hands (ragdoll pins), the rest trailing along the floor
  noise = 0;                                                    // HUD sound meter: the loudest thing you did lately (hearing-model level, decays)
  takedown: { g: Guard; t: number; kind?: CloseKind; from?: number; alert?: boolean; yaw?: number; at?: Vec3; lethal?: boolean; /** CLOSE.rmbHold: the quick knockout — heard further */ loud?: boolean } | null = null;             // silent takedown in progress (a LEFT CLICK with the hands empty on the man in reach behind): locked behind the guard until the strike lands
  /** the man in his arm (player.ts startGrab / updateHold — the 'grab him' row on a living guard from behind): the pair moves as one at a slow walk, his rows put
   *  questions to him (Game.interrogate) and choke him out quiet (holstered: the arm variant) or pistol-whip him (pistol drawn: the gun variant, which also
   *  fires past him on a click) — there is no letting him go; null when his hands are his own. */
  holding: Hold | null = null;
  /** disarm.ts HOLD.stripFirst: the game time the grab's catch voice is due (the arm landing, behind the strip's) — undefined = none owed */
  catchDue: number | undefined = undefined;
  /** what Sam is saying right now — his side of an exchange with the man in his arm (player.ts askHeld: his line first, the man's answer when it ends) — drawn
   *  over HIS head like a guard's line, in his own tint (ui/bubbles.ts); the same shape as Guard.bubble */
  bubble: { text: string; t: number; dur: number; radio: boolean } | null = null;
  speedSm = 0;
  visibility = 0;          // 0..1 from light meter
  irradiance = 0;
  hitFlash = 0;
  /** a blast that left him up (samstun.ts): folded until / blind until, on the game clock, and where the flash was — the same two stamps a Guard carries */
  staggerUntil = -1; dazzledUntil = -1; dazzledAt: Vec3 | null = null; stunPosed = false;
  /** game time a blast left him hurt (condition.ts: -1 = never; read through isHurt) */
  hurtAt = -1;
  /** a sprint into a door (sprintdoor.ts): when he last put his shoulder through one and which way it turned him, and until when his hand is ripping one round (the run held to a walk) — on the game clock */
  doorBashAt = -10; doorBashLean = 0; doorRipUntil = -1; doorKickTail = false;
  /** the look his head was last given against that turn, and the game time it was given on (player.ts's sprint facing; game.ts takes it back off the frame nobody renews it) */
  doorHead = 0; doorHeadT = -1;
  /** suppression (suppression.ts, docs/internal/sc20k-design.md §4): the rounds passing / striking close to him — the same scalar and rule the guards duck under.
   *  This lane reads it for one thing only, the cone his own rounds open up by (player.ts fire sites, samSpread); the picture, the mix and the reticle are R4's. */
  sup = new Sup();
  /** the scalar itself, 0‥1 (what R4's presentation reads) */
  get suppression() { return this.sup.v; }
  /** the aim-settle model (aim.ts): his track on the man under the reticle (or on nothing in particular), that man's bearing rate across his view, the last round's
   *  numbers — fed once a frame by game.ts (trackPlayer), read by his fire sites (samAim) and the overlay's ring. Rests at 0 with tune.aimModel off. */
  aim = new AimState();
  /** aimweight.ts: his gun's heading trails the cursor — the swing's rate and the circle's range, live only on frames the weighted turn drove his aim */
  aimw = new AimWeight();
  static readonly MAX_HITS = 1; hitsLeft = Player.MAX_HITS; down = false;   // one 9 mm hit and you are down, same as the guards; Enter restarts the encounter
  // equipment, by KIND (SlotKind — the digits and the kit column's numbering are KIT_ORDER's: 1 the pistol, 2 the FN2000 when the kit has it — hasRifle, the start
  // card's loadout toggle, remembered per machine — 3 smoke canisters, 4 stun canisters); G quick-throws whichever throwable was selected last (`throwKind`) where the quick throw is on (quickthrow.ts: not in the page). "The
  // weapon in his hand" is gunInHand(): the pistol with 'pistol' selected and drawn, the rifle with 'rifle' selected and off the sling, nothing holstered / slung or
  // with a canister up — every site that used to spell out `slot === 1 && !holstered` for the pistol reads pistolUp, which means exactly that.
  pistol = new Pistol(); ocp = new Ocp(); canisters = 4; flashbangs = 2; /** fragmentation grenades (frag.ts FRAG.issue; digit 5 then a click — G never throws one) */ frags = FRAG.issue; slot: SlotKind = 'pistol'; throwKind: ThrowKind = 'smoke';
  /** Sam's FN2000 (docs/internal/sc20k-design.md §5, weapons.ts Rifle: the fn2000 row + its light switch, its selector, its attachments and the rings left) and
   *  whether this kit has it at all. Selected with 2 (2 again with it in the hands flips the load its launcher has on the right button: ring ⇄ 40 mm); `holstered` with it selected means
   *  SLUNG across his back (rigProps RIG.sc20k.slung) — the same one flag E, the wall hold, the grab and every hands-free rule already read; in the hands it is
   *  the animator's long gun (player.ts arms it: LONG carriages by state). */
  rifle = new Rifle(); hasRifle: boolean;
  /** seconds left of the rifle coming off the sling into the hands (or of any change of what is in them that involves it): no round or ring meanwhile */
  equipT = 0;
  /** slotsetup.ts: the setup of the gun in his hands is up (its digit pressed again) — which gun, the game time it opened or was last used, and the last
   *  update that saw it; null = not up. Never saved: a load is a fresh Player with nothing up */
  setup: { gun: 'pistol' | 'rifle'; t: number; seen: number } | null = null;
  /** slotsetup.ts: the gun its hook last found in his hands (null: none) and the game time it first did — a gun just drawn does not open its setup,
   *  unless his own press of its digit is what drew it (`own`: the game time that draw is over; SLOTSETUP.draw) */
  setupHand: { gun: 'pistol' | 'rifle' | null; t: number; own?: number } | null = null;
  /** slotsetup.ts: the last press of a gun's digit that the setup did not take (the press that draws that gun), and when */
  setupKey: { gun: 'pistol' | 'rifle'; t: number } | null = null;
  /** the rifle left his hands when he went down (combat.ts hitPlayer dropped it as an item): nothing to draw slung on the body */
  rifleGone = false;
  /** KIT ANIMATIONS (kitanim.ts): what was in his right hand last frame by the game's rules (undefined = not watched yet: a fresh Player — a restart, a loaded
   *  checkpoint — starts with no errand pending) and the kind of can it last was (the one a put-away shows after the slot has moved on) */
  kitWas: KitItem | null | undefined = undefined; kitCan: ThrowKind | null = null;
  /** the launcher's button (the right one) is DOWN with the rifle in the hands (player.ts), and the load it will send: its arc is on screen and letting go sends
   *  the round; null = not down. Lasts only from frame to frame of the rifle up and free — not saved (a load is a fresh Player: nothing held). */
  launchHeld: RifleAttachment | null = null;
  /** kitanim.ts kitClick: a left click made while a gun was still coming up, owed to the frame it is up: the game time it came, -1 = none (never saved: no checkpoint inside a kit change) */
  kitOwed = -1; kitOwedFor: KitItem | ThrowKind | null = null;   // (…and the thing he was fetching when it came — a can by its kind: it is that thing's click only)
  /** kitanim.ts kitSlingRest: how far the rifle hanging in front is swung onto his thighs (rad) and the game time it was last eased at; picture only, not saved */
  slingRest: { a: number; t: number } | null = null;
  /** the one-time word that the OCP lives on the pistol: said the first time the right button is pressed over a light with a long gun in the hands that has
   *  nothing under its barrel (the shotgun in the rifle's slot — player.ts) — after that the button is simply dead there */
  ocpHinted = false;
  holstered = true;    // he starts with the pistol on the thigh (playtest call: hands free by default — Space grabs, a click behind a man is the takedown); E puts the selected item away / draws it again (Chaos Theory: equip / unequip); holstered + LMB behind a guard in reach = the silent takedown (its one and only input), the pistol's paths all check it
  /** the keys in his pocket, by lock name (doors.ts Door.lockId / FLOOR_KEY): taken off a man he questions the moment the man gives the keyed door up (player.ts
   *  takeKey — Guard.keys empties into this). His door contact carries them (updateDoors) and every 'is this lock against you' test reads them (Doors.lockedOut),
   *  so a keyed door on its corridor face opens to him as it does to the staff — no pick, no kick — and springs locked again behind him. The kit column shows a
   *  KEY tag while it holds anything. Empty on a fresh Player: a restart takes them with everything else. */
  keys = new Set<string>();
  /** the door codes he KNOWS, by lock name (a keypad door's Door.lockId is its pad's name — devices.ts): learned off a man he questions (dialogue intel 'code') or
   *  overheard from two of them talking within earshot (devices.ts overhear). A keypad door whose code is in here offers 'enter the code'; his door contact never
   *  carries them (he types it in — the leaf stays a wall till the pad takes it). Empty on a fresh Player. */
  codes = new Set<string>();
  /** the keypad door he is entering the code at (the 'code' row — a sustained verb like the pick: devices.ts updateCoding beeps four keys over CODE_SECS and the pad
   *  takes it; a step, Space or Esc breaks off) and how far in he is; null when none */
  coding: Door | null = null; codeT = 0;
  /** handwork.ts: the mains breaker's lever under his hand (the 'breaker' rows with HANDWORK on — `on`: re-arming it; t: s since his hand got there; thrown: the
   *  mains have gone over), null when none · s the verb in hand has waited for his hand to reach the thing (a code, the lever) */
  breakerMove: { on: boolean; t: number; thrown: boolean } | null = null; handWait = 0;
  nearSel = 0; nearKey = '';    // index of the highlighted row of the interaction list (↑ / ↓, the wheel while Space is down) and the identity of the current list
  /** The Space selector (interact.ts): downT = seconds Space has been down this press (−1 = up, or a press not armed); open = held past TAP_SECS (or scrolled while
   *  down) with rows on offer — the list shows its open state, a cancel row sits at its foot, his feet are frozen, and letting go performs the highlighted row;
   *  moved = the highlight was scrolled during this press (a press that scrolls is a choice, never a tap); wheelAcc = wheel travel toward the next row; runKey / moveLatch: which sustained verb was running
   *  last frame and the movement keys already down when it began (a step cancels a running verb — a key held into it does not until it has come up once). */
  sel = { downT: -1, open: false, moved: false, wheelAcc: 0, runKey: '', moveLatch: 0,
    /** handring.ts `empty`: what the last tap that found no row said and when (the corner shows it for a moment), and when a line of it last went to the log */
    word: '', wordT: -1e9, fileT: -1e9,
    /** the list up as a ring at the cursor (cmdring.ts CMDRING.hands — null: the list as it was): where, and whether the cursor may light a wedge yet; `key`: the rows it was last read over (Player.nearKey) */
    ring: null as (RingState & { key: string; /** handring.ts: the press that opened it has come up and it stands by itself */ free?: boolean; /** …the lit wedge is the whistle's, which is no row (interact.ts) */ whistle?: boolean }) | null };
  /** the selector open AS A LIST (feet still, a cancel row at its foot, the panel in its open look) — not up as a ring */
  get listOpen(): boolean { return this.sel.open && !this.sel.ring; }
  /** the selector open with his hand on it — a list, or a ring whose key is still down; not a ring that merely stands (handring.ts) */
  get choosing(): boolean { return this.sel.open && !this.sel.ring?.free; }
  pace = 1; paceShownT = -10;   // walking-pace multiplier set with the mouse wheel, PACE_MIN‥1 of the walk / crouch-walk speed (sprint is its own held modifier); shown as ticks in the kit column
  nv = false; nvAmount = 0;
  light!: RtLight;   // the rail light: posed from the gun every frame (rigProps.rigLightPose)
  throwEaten = false;   // (the quick-throw key's press went to the order menu's frag row: the rest of that press — the key still down, on the page — is not a throw; cleared when the key is up. player.ts)
  throwHeld = false; heldKind: ThrowKind = 'smoke'; throwPreview: ThrowSolution | null = null; pendingThrow: { t: number; sol: ThrowSolution; kind: ThrowKind } | null = null;
  /** the leaf he is easing open by hand (the 'ease' row: started by a tap, it goes on round at the crack rate on its own until it stands open, or a step / Space /
   *  Esc stops it where it is — game.ts updateDoors runs it; stallT = seconds it has not moved, a body or a chair against it); null when none */
  easing: Door | null = null; easeStallT = 0; easeBest = 0;
  /** locked doors (player.ts updatePicking / updateKick): the lock being worked — planted in a crouch at it, hands on the tools, on its own clock once begun (a step,
   *  Space or Esc breaks off, the progress kept on the door a moment); the kick in progress — rooted square to the leaf until the foot is back down (spot / yaw:
   *  where, fixed when the kick began); fHeld: the Space press now down has been SPENT (it stopped a running verb, a teleport / a kick / a finished pick swallowed
   *  it) and must come up before Space arms again */
  picking: Door | null = null; kick: { door: Door; spot: Vec3; yaw: number; run?: boolean; /** the beat is the big slot's tool on the lock, not the boot (bigkit.ts samBigTick): which, its clock, the blows or shells so far, the next one's time */ tool?: { kind: 'shotgun' | 'hammer'; side: 1 | -1; /** the beat's clock: 0 = his hands leave for the tool; it starts `lead` below that while his own gun is carried away by hand (bigkit.ts BIGSLOT.weight) */ t: number; lead?: number; n: number; /** blows the hammer needs here (one where a boot would do, BIGSLOT.swings where the frame holds one) */ need: number; next: number; done: number; /** the door gave to it: a leaf left standing home (broken from the face it opens toward) is pulled open as the beat ends — BIGSLOT.shut */ gave?: boolean;
    /** BIGSLOT.moves (bigkit.ts): he WALKS onto his place with the tool coming into his hands — `arrived` once he stands on it; the point struck or shot; when each blow or shell lands, on `t` (the last one may still be to come); when his hands began putting it back (−1: not yet) */ moves?: { arrived: boolean; at: Vec3; blows: number[]; end: number; /** the corner of his walk, round a man of the file (gone once he has turned it) */ via?: Vec3 } } } | null = null; fHeld = false;
  /** the optical wand (wand.ts): `wand` = it is in his kit (his card's row — kit.ts kitPlayer); `wanding` = he is on his knee at a shut door with it under the
   *  leaf (player.ts startWand / updateWanding; a step, Space or Esc pulls it out) */
  wand = false; wanding: Wanding | null = null;
  /** the breaching shotgun or the hammer in his big slot (kit.ts BIGSLOT, his card's; bigkit.ts: a row of a door locked against him). 'none' as built. */
  bigKit: BigKit = 'none';
  /** what his card weighs (kitload.ts: its mobility and concealment beside his reference's, written where his card goes on him — kit.ts kitPlayer; null: nothing weighed on him, nothing of his is touched) */
  kitLoad: KitWorn | null = null;
  /** the sticky cameras he has sent, in flight and stuck (stickycam.ts; how many are left to send rides his rifle: Rifle.cams) */
  cams: StickyCam[] = [];
  /** the last id a camera of his was given (stickycam.ts fireCam: one up each, never reused in a run) */
  camSeq = 0;
  /** a door charge going on by his own hands (doortools.ts samTick; owncharge.ts): the door, the face he is on, when it began, where he stood. Not saved:
   *  savestate.ts playerBusy refuses a plain save while it runs */
  charging: { door: Door; side: 1 | -1; t0: number; at: Vec3 } | null = null;
  /** what was in his hand is put away for a charge going on by his own hands (workstow.ts samStowTick): `drew` = something was, and comes back when the job is
   *  over; `t` when the job began; `down` = his hands are free of it (the job's clock runs). null = no such job. Not saved: no save is written inside one. */
  workStow: { drew: boolean; t: number; down: boolean } | null = null;
  /** back to the wall (player.ts, Q): the static face he is pressed against and slides along — null when free. For the HUD / camera: n (unit normal out of the
   *  wall into the room), along (unit tangent: his right when his back is flat to it), atEdge (parked at an OPEN end of the face — an outside corner, a door jamb —
   *  −1 / +1 = which end along `along`, 0 = not at one or the way on is walled), peek (0‥1, eased in while he keeps pushing into that open end), crouched. The
   *  rest is the controller's bookkeeping (see WallHold). Anything that plants him elsewhere (takedown, kick, pick, drag, teleport, going down) lets go first. */
  wall: WallHold | null = null;
  /** the last spot the collision sweep settled him at (player.ts collidePlayer walks him from here to wherever he has been put since, in short strides; null until the first settle, reset by a teleport) */
  safe: Vec3 | null = null;
  stepPhase = 0;
  /** how far the walk cycle has come since the last footfall filed, in turns, either way added up, 1 at the most (player.ts FOOTFALL.once; 1 = far enough,
   *  which is where it starts, and where it stays while the key has never been on) */
  stepTravel = 1;
  /** how far the walk cycle has come at a footfall's speed since the last edge of it passed or footfall filed, in turns, either way added up (player.ts
   *  FOOTFALL.owed: at half a turn a footfall is owed; 0 where it starts, when he slows, after frames the footfall test was not asked, and while the key
   *  is down), and the game clock the test was last asked at with the key up (-1: never) */
  stepOwed = 0; stepAt = -1;
  constructor(ch: GltfCharacter, pos: Vec3, hasRifle = true) {
    this.char = new Character(ch, { id: PLAYER_ID, tint: [0.05, 0.06, 0.07], tint2: [0.1, 0.32, 0.18], pos, yaw: Math.PI });
    this.char.muzzleAhead = this.pistol.def.muzzleAhead;   // (the row's: where the round, the flash and the rail light's beam start along the gun)
    this.hasRifle = hasRifle;
  }
  /** the firearm the kit has SELECTED (the rifle with 'rifle' selected and in the kit, else the pistol — a canister up leaves the pistol as the gun 1 comes back to) */
  get firearm(): Firearm { return this.rifleSel ? this.rifle : this.pistol; }
  /** what is physically in the gun hand right now: the Five-seveN drawn, the FN2000 off the sling (not while he hauls a body by the ankles: it goes to the sling for
   *  that), or nothing (holstered / slung / a canister up / no rifle in the kit) */
  gunInHand(): Firearm | null { return this.holstered ? null : this.slot === 'pistol' ? this.pistol : this.rifleSel && !this.dragging ? this.rifle : null; }
  /** the Five-seveN is the selected item and drawn — what `slot === 1 && !holstered` always meant */
  get pistolUp(): boolean { return this.slot === 'pistol' && !this.holstered; }
  /** the FN2000 is the selected item (in the hands or slung) and the kit has it: L / Z / R / the kit column's lit row are about the rifle */
  get rifleSel(): boolean { return this.slot === 'rifle' && this.hasRifle; }
  /** the FN2000 is in both hands (selected, drawn, and not hauling a body by the ankles — that slings it) */
  get rifleUp(): boolean { return this.rifleSel && !this.holstered && !this.dragging && !this.down; }
  /** Braced on the foregrip, the stock in the shoulder: ALWAYS, whenever the rifle is in the hands and he is neither sprinting (gun down at the run) nor kicking a
   *  door (across the chest for that) — there is no brace input any more (playtest 08-08: right + left button together is misery on a trackpad, and a rifle in the
   *  hands that is not being aimed had no reason to be in them). What reads it: player.ts rifleSpread (RIFLE_SPREAD.braceK is simply the rifle's in-hand steadiness),
   *  the aim model's cone (aim.ts AIM_HOOKS.playerExternalK), and `aiming` — the rifle is shouldered for as long as it is up. */
  get braced(): boolean { return this.rifleUp && !this.sprinting && !this.kick; }
  /** the canister the selected slot puts in the fist ('smoke' / 'flash'), null with a gun selected — drawn or not is the caller's `holstered` test. The ONE rule for
   *  "is a can in his hand": player.ts (what a click throws) and combat.ts handProps (what is drawn in the fist) both read it, so the rifle in the hands can never
   *  again come with a smoke can in the other (the old test was 'any slot but the pistol's'). */
  get canisterSel(): ThrowKind | null { return this.slot === 'smoke' || this.slot === 'flash' || this.slot === 'frag' ? this.slot : null; }
}

// ---------------------------------------------------------------- guard
export type GuardState = 'patrol' | 'suspicious' | 'alert' | 'search' | 'dead';
/** One frame's worth of orders for a scripted guard (see squad.ts). goal: walk there (nav path) at `speed` (m/s, default guard walk); face: body
 *  yaw to hold once planted (or while `strafe`); aimAt: where the gun / torch / eyes point; stance + stackSide + crouch feed the animator's tactical
 *  layers; upper: 'aim' draws the pistol, 'torch' carries the torch; arrived is written back by the runner each frame. */
export interface GuardScript { goal: Vec3 | null; speed?: number; face?: number | null; strafe?: boolean; aimAt?: Vec3 | null; stance?: Stance; stackSide?: -1 | 1; crouch?: boolean; lean?: number; upper?: 'aim' | 'torch' | 'relaxed' | 'none'; light?: boolean; arrived?: boolean;
  /** weapons free on the men in front of him: the runner's muzzle discipline (squad.ts — a colleague in the line puts the gun down) is off for this man. The breach
   *  showcase's operatives carry it while they engage the room (breach.ts): until the guards have SIDES every man in Game.guards is a 'colleague', the opposition
   *  included, and an operative could not so much as cover the man he is about to shoot. The teams lane replaces this with sides in colleagueInLine. */
  hot?: boolean;
  /** rounds past this scripted man make him START (suppression.ts: the anim flinch on the rising edge over the flinch line — never the bark, the late round, the head going down or the
   *  shift to cover, which are the AI's; his feet stay the choreographer's). Off by default: the runner's men are otherwise deaf to fire, as they always were. The day showcase's
   *  firefight orders it on both sides (director.ts OrderPatch; the removed day showcase ordered it). */
  flinch?: boolean;
  /** his walk to `goal` is the script's own way: the short one, not priced by the lanes his side knows are covered (lanes.ts lanePenalty). A staged advance
   *  down a road the other side has guns on: without it he goes round, as a man left to himself would (director.ts OrderPatch). */
  direct?: boolean;
  /** he is having a smoke where he stands (smokebreak.ts: the left hand to his mouth and back, the lit end, real smoke — a level script's order, director.ts
   *  OrderPatch.smoke; nothing with that file's switch off) */
  smoke?: boolean;
  /** his muzzle taken off the order by his own read of the fight (roomfight.ts): while set the runner aims at `aimAt` with the gun up — whatever aimAt / upper /
   *  stance the order holds, which are left exactly as ordered and take over again the frame this is cleared — and, `face` given, squares him up to it where he stands */
  over?: { aimAt: Vec3; face: number | null; walk?: boolean } | null; }
/** What the men call each other on the net (by roster order; the radio check asks for a silent man by it — guards.ts updateRollcall). */
export const CALLSIGNS = ['Kowalski', 'Novak', 'Reyes', 'Okafor', 'Lindqvist', 'Brandt', 'Marsh'];   // (seven: a level with a seventh route — the bazaar — must not deal one name twice)
/** who is dealt the carbine over his sidearm row (Game.tune.carbineGuards → Guard.carbine each frame; guards.ts rigOf) */
export type CarbineDeal = 'none' | 'reyes' | 'all';
export const CARBINE_DEALS: CarbineDeal[] = ['none', 'reyes', 'all'];
/** How each man takes pressure (docs/internal/grab-interrogate-design.md §4.3): steady = professional, settles, bargains, gives a fact plainly; nervy = over-talks,
 *  gives it early, unreliable extras; hard = defiant, gives nothing until properly rattled. NOTHING reads it yet — the interrogation picker, the standoff barks
 *  and the found-body lines will (one voice per man across the whole floor's speech). Keyed by callsign so a level's roster order can change under it. */
export type Temperament = 'steady' | 'nervy' | 'hard';
export const TEMPERAMENT: Record<string, Temperament> = {
  Kowalski: 'steady',    // the corridor man: runs the radio checks and walks the long loop past every door — the floor's NCO, nothing hurries him
  Novak: 'nervy',        // the cubicle farm: boxed in among the partitions with the vending machine for company, first with a 'huh?' at every creak
  Reyes: 'hard',         // lobby and break room: the front-of-house man who deals with whoever walks in — used to saying no
  Okafor: 'steady',      // (fourth route when a level has one) pairs with anyone, says little
  Lindqvist: 'nervy',    // (fifth) the new man on nights
  Brandt: 'hard',        // (sixth) ex-forces, the one the others defer to in a lockdown
  Marsh: 'steady',       // (seventh) the night watchman: walks his own round, keeps his own counsel
};
/** How a downed man went down and by whose hand (combat.ts killGuard): shot = dead; struck (the takedown's cross, a pistol-whip later) / choked (the choke-out
 *  from a hold, later) = out cold and breathing. His state is 'dead' either way — every one of the floor's 'is this man out of the picture' tests keeps working —
 *  this is the side record the found-body lines, the room clear's grim lines, the debrief and (one day) a wake-up read. by: only the player's own count on the card. */
export type DownKind = 'shot' | 'struck' | 'choked' | 'wounded';   // (wounded: a round that did not land where it kills — wounds.ts, behind WOUND.on: down, breathing, out of the fight, and POSED rather than a ragdoll — Guard.wound)
export type DownBy = 'player' | 'guard' | 'world';
/** MOVES.entry (off unless that switch is on): a living friend — a man of his own team, or Sam for a man on Sam's side — stands inside arm's length-and-a-half of
 *  this man's muzzle and in the lane his gun points down (gunYaw: the gun's own heading). The stack going through a door, the file behind the lead: the muzzle
 *  goes down past him (character.ts `dip`) and comes back up as they part. Geometry only; no state of the fight is written. */
function friendBeforeMuzzle(g: Game, gd: Guard): boolean {
  const c = gd.char, y = c.gunYaw, lane = (p: Vec3) => inDipLane(p[0] - c.pos[0], p[2] - c.pos[2], y);
  for (const o of g.guards) if (o !== gd && o.state !== 'dead' && o.team === gd.team && lane(o.char.pos)) return true;
  return !g.player.down && !hostileTo(gd, 'player') && lane(g.player.char.pos);
}
/** Down but breathing: put out cold (struck / choked), not shot. False for a living man and for a corpse. */
export function isBreathing(gd: Guard): boolean { return gd.state === 'dead' && gd.downKind !== null && gd.downKind !== 'shot'; }
/** What this man has PERSONALLY perceived this encounter (docs/internal/grab-interrogate-design.md §4.2) — written where the event already happens (guards.ts
 *  hearingCheck / the alert transition / body discovery and its radio call, combat.ts killGuard / detonateStun), through the same gates as the AI itself (his
 *  hearing model for sounds; line of sight + cone for what he saw; nothing global, nothing with the AI off), read by nobody yet but the panel line and the QA
 *  probes: the interrogation dialogue and the debrief will. Dies with the Guard (resetGuards). Victims are named by callsign. */
export interface Witness {
  /** sounds that actually reached him and raised him (hearingCheck): gunfire (anyone's), doors kicked in, stun charges, and the small stuff — a creak, a scrape, a
   *  footfall, a canister's pop, a light dying near him — with where the last small one seemed to come from (the doorway it spilled through if not direct) */
  heard: { shots: number; lastShotT: number; kick: number; bang: number; small: number; smallWhere: Vec3 | null; lastT: number };
  /** the highest his awareness has ever been */
  peakAwareness: number;
  /** what took him to 'alert' the last time he went (the guards.ts transition): eyes on Sam, a sound, word over the net (a colleague's contact, an order), a body —
   *  'held' is reserved for the human-shield standoff; null = never been alert. alertT: when (-1 never). */
  alertedBy: 'sight' | 'sound' | 'radio' | 'body' | 'held' | null; alertT: number;
  /** he SAW Sam put a man down (killGuard: the victim in his view as he dropped, or his eyes on Sam as the shot went) — kind as DownKind, 'grab' reserved */
  sawAct: { kind: DownKind | 'grab'; victim: string; t: number } | null;
  /** he found (walked onto and called in) this body / was told of it over the net and called over to it; breathing = out cold rather than dead, as found */
  sawBody: { victim: string; t: number; breathing: boolean } | null;
  calledToBody: { victim: string; t: number; breathing: boolean } | null;
  /** sawHeld: a colleague he saw held in Sam's arm — who, and when he first saw it (guards.ts standoffPerceive: the human shield's standoff, through his own eyes,
   *  cone and line of sight, no light asked); wasHeld: how many times Sam has had HIM in an arm lock (player.ts startGrab counts the grab itself: 1 while he is held
   *  the first time, 2 = grabbed again after being let go) */
  sawHeld: { who: string; t: number } | null; wasHeld: number;
  /** stun charges that went off in his open view (combat.ts detonateStun) */
  dazzled: number;
}
export const newWitness = (): Witness => ({ heard: { shots: 0, lastShotT: -1, kick: 0, bang: 0, small: 0, smallWhere: null, lastT: -1 }, peakAwareness: 0, alertedBy: null, alertT: -1, sawAct: null, sawBody: null, calledToBody: null, sawHeld: null, wasHeld: 0, dazzled: 0 });
/** Interrogation progress for this man (dialogue.ts, docs/internal/grab-interrogate-design.md §4): how many exchanges Sam has had out of him (stage: 0 = none yet,
 *  1 the reaction, 2 the pressure, 3 the useful thing or the refusal, 4+ nothing left — it never goes backwards this encounter), the line ids he has said (no
 *  repeats until his pool is dry; saidN counts the repeats after that), the useful things he has given (by kind), when he last spoke, and since when he has been
 *  held (heldSince: stamped by the grab and cleared when he is let go — player.ts startGrab / handBack; the sandbox button's bare exchange still stamps it itself for
 *  a man nobody holds; -1 = not held), and when Sam last started to put him out and eased off instead (abortT: a choke or a pistol-whip let go of — player.ts
 *  updateHold; -1 never: he is that much more rattled for it, dialogue.ts agitationOf). last: the panel's peek at the previous pick. Dies with the Guard
 *  (resetGuards), like the witness record it reads. */
export interface Talk { stage: number; presses: number; said: Set<string>; saidN: Map<string, number>; given: Set<string>; lastT: number; heldSince: number; abortT: number; last: { id: string; cell: string; stage: string; kind: string | null } | null; }
export const newTalk = (): Talk => ({ stage: 0, presses: 0, said: new Set(), saidN: new Map(), given: new Set(), lastT: -1, heldSince: -1, abortT: -1, last: null });
/** An errand that survives the ordinary suspicion decay (guards.ts, the 'suspicious' branch): reset the breaker; look at the rack that dropped off the network; walk a
 *  silent colleague's route looking for him ('checkOn': `who` he is, `wp` the waypoint of his being walked to now, `left` how many remain, `t0` when it began). */
export type GuardTask = { kind: 'breaker' | 'rack' | 'device'; pos: Vec3 } | { kind: 'checkOn'; pos: Vec3; who: Guard; wp: number; left: number; t0: number };   // device: sent by control to where a camera had movement / a beam broke / a camera went dead (devices.ts) — walked and looked round exactly like the rack
/** A spawned unit's papers (guards.ts spawnUnit — the showcase's operatives and hostiles): not a man of the level's routes, so resetGuards drops him instead of
 *  standing him up again, and despawnUnit knows what to take back out of the world (his weapon light). */
export interface UnitInfo { name: string; spawnedAt: number; light: boolean;
  /** the pair he was dealt into, for a teammate of a squad ordered in pairs (nightbreach.ts — 'red' / 'blue'; orders.ts men() is the one place that reads it) */
  pair?: PairId; }
/** The two pairs of a four-man squad (Ready or Not's red and blue teams). */
export type PairId = 'red' | 'blue';
/** Who a man's senses, fix and gun are ON (guards.ts, teams): Sam — every staff guard's for life, and today's whole game — or a hostile AI man, or nobody yet. */
export type Foe = 'player' | Guard | null;
export class Guard {
  char: Character; state: GuardState = 'patrol';
  /** his name on the net (CALLSIGNS by roster index; a spawned unit's given name) */
  callsign: string;
  /** SIDES (teams.ts): which side he is on — 'guard' for every man the level's routes stand up (hostile to Sam and nobody else: the game as it was); the
   *  showcase spawns 'operative' / 'hostile' units (guards.ts spawnUnit). Read wherever "the player" used to be the only possible enemy and "every other guard"
   *  the only possible colleague. */
  team: Team = 'guard';
  /** his foe right now (see Foe): 'player' from birth for the guard side (never anything else — no unit is hostile to staff), chosen each frame by salience among
   *  the hostile characters in his sight for the other sides (guards.ts acquireFoe), null = nobody acquired yet / his man is dead and no other shows */
  foe: Foe = 'player';
  /** the route he walks: the level's (level.routes[routeI]) for staff, a one-point synthetic one for a spawned unit (routeI −1) — read as gd.route everywhere the
   *  index used to be looked up, so a man with no level route still has points to stand on and a weapon row to carry */
  route: PatrolRoute;
  /** set on a spawned unit (see UnitInfo), null for the level's own men */
  unit: UnitInfo | null = null;
  /** set on a CIVILIAN (civilians.ts — the cleaner, the late worker: a Guard record for the plumbing that takes one — the hold, the ragdoll, the bubble, the path
   *  follower — kept in Game.civilians, never in Game.guards); null for every man of every AI side */
  civ: Civ | null = null;
  /** a trained man (the response team, game/qrf.ts): the aim-settle model lines him up quicker and his hands are steadier (aim.ts TRAINED — × the settle time,
   *  × his row's cone), and qrf.ts keeps his reaction beats short. False for the night staff and the showcase's men: their numbers are untouched. */
  trained = false;
  /** in a room fight (roomfight.ts sets it every frame he is in one): his side's multipliers on the aim model's settle time and cone — takes TRAINED's place, and a
   *  pinned man with it earns his track like anybody instead of standing on 1 */
  skill: { settleK: number; spreadK: number } | null = null;
  /** an AI target's light meter (guards.ts unitLightMeter — only ever fed for a man some other AI side can be hostile to, i.e. never for staff): the renderer's
   *  irradiance at his chest / head when the probe answers (the browser), the CPU estimate of the same direct light otherwise (headless, or the first frames),
   *  mapped and eased exactly as Sam's meter is (Game.visibilityOf, damp 6). What a hostile AI eye reads where it reads player.visibility for Sam. */
  visibility = 0; irradiance = 0;
  routeI: number; wp = 0; wait = 0; awareness = 0; lastKnown: Vec3 | null = null; lastSeenT = -100;
  hold = false;                  // scripted (showcase tour): stand your ground while on patrol / merely suspicious (look, don't walk over)
  pinned = false;                // scripted: in a fight, keep the position you were given (shoot from it, cover the last fix from it) instead of closing in
  /** scripted, SHOWCASE CAST ONLY (director.ts LoadoutSpec.god — the day showcase's two operatives): a round that would have found him passes through him as it passes a colleague (combat.ts
   *  fireWeapon). The show's doctrine keeps the opposition's rounds off them by construction (laid on their cover, traced: tools/qa/day-probes.ts); this is the net under a stray, never
   *  the mechanism, and nothing the player or the level's men can ever carry. */
  god = false;
  /** Sam has him from behind (player.ts Hold — docs/internal/grab-interrogate-design.md §2.1): NOT a state — his `state` stays what it was so what he knew survives
   *  it — but a side record updateGuard branches on before anything else, the way it does for a scripted man: no senses, no feet of his own (updateHold places and
   *  turns him), no voice but his answers to Sam (guards.ts say drops the rest), off the net (guards.ts offNet: the radio check asks after him and sends somebody
   *  round his route). since = game time of the grab; variant = an arm round the throat / the pistol at his head (character.ts HoldVariant, fixed at the grab);
   *  phase mirrors the hold's beat; reverse = Sam is backing the pair up (his legs play the cycle backwards too). */
  held: { by: 'player'; since: number; variant: HoldVariant; phase: HoldPhase; reverse: boolean } | null = null;
  bubble: { text: string; t: number; dur: number; radio: boolean } | null = null;   // what he is saying right now (drawn over his head when on screen; off-screen lines go to the log)
  found = false;                 // (dead) somebody has discovered this body — counted once for the debrief
  /** (dead) how he went down and by whose hand — set once by combat.ts killGuard; null while he lives. isBreathing() reads it: struck / choked = out cold. */
  downKind: DownKind | null = null; downBy: DownBy | null = null;
  /** WOUNDS (wounds.ts): down wounded — out of the fight, breathing, posed where he went down (state 'dead', downKind 'wounded'). null on everybody else, always with the switch off. */
  wound: Wound | null = null;
  /** what he has personally seen and heard this encounter (see Witness) — event memory for the dialogue to come; the AI itself never reads it */
  witness: Witness = newWitness();
  /** what Sam has got out of him so far (see Talk) — read and advanced only by the interrogation (dialogue.ts via Game.interrogate) */
  talk: Talk = newTalk();
  /** the keys on his belt, by lock name (level.ts PatrolRoute.keys; the floor key unless the route says otherwise): what Sam takes off him when he gives the
   *  keyed door up (player.ts takeKey empties it into Player.keys — the same man has nothing more to hand over, held again or not), and what makes that
   *  admission true of him at all (dialogue.ts gather: no key on him, no 'mine's on my belt'). NOT what the leaves ask of him: to a door every man on the
   *  staff is keyed (updateDoors `key: true`) — the man in Sam's arm still walks the pair through one whatever is left on his belt. Dies with the Guard. */
  keys: Set<string>;
  /** (dead, not found) the net has called this man and got nothing back — when (guards.ts updateRollcall; -1 = never): from then on the others count him as
   *  missing (superviseLockdown stops dealing his corpse a role) — and whether the floor has already been raised once on his account (it is, once, when the man
   *  sent round his route comes back with nothing) */
  missedAt = -1; missingRaised = false;
  /** muzzle discipline (guards.ts muzzleCheck): a living colleague stands in his line this frame, so the pistol is at the low ready and no round leaves it;
   *  clearT = seconds the line has been clear again (it comes back up after a beat, not on the frame); evalT = the game time it was last worked out (the alert
   *  branch does it early, before the shot); lineBarkT = when he (or the man in his line) last said so */
  muzzleDown = false; muzzleClearT = 0; muzzleEvalT = -1; lineBarkT = -100;
  /** alert, licensed to shoot: seconds a colleague has stood in the line of the shot itself (a man crossing is waited out for a beat; one standing there is stepped round) */
  lineInT = 0;
  /** the side-step round a colleague (guards.ts lineStep): lineSide = which way the step under way goes (−1 / +1 along the square-off-the-line basis, 0 = none);
   *  lineGain / lineStepM = how far last frame's step should have left him from its goal, and how long that step was (a step handed straight back by a chair
   *  wedged against the table, a leaf, a man standing on the spot reads as no gain: lineStuckT counts those seconds); lineFail = the sides that went nowhere from
   *  about `pos` lately (bit 0 = −, bit 1 = +, stamped `t`) — not offered again from there until he has moved off or it has lapsed, so a blocked side and a
   *  colleague-fouled other side make 'none' (push past / wait) instead of the same quarter-metre into the same chair every second for as long as the scrum holds */
  lineSide = 0; lineGain = -1; lineStepM = 0; lineStuckT = 0; lineFail: { pos: Vec3; sides: number; t: number } | null = null;
  /** lockdown follower: when he last had his leader in plain sight (no wall between, inside 16 m) and where the man was then — twenty seconds without, and the
   *  man nowhere near that spot, and he reports him missing (guards.ts partnerWatch) */
  leaderSeenT = -1; leaderSeenPos: Vec3 = [0, 0, 0];
  /** (dead, found) the aftermath script's bookkeeping ON the body (guards.ts bodyAftermath): how many living men have reached it (1 = the finder covering it, 2 = the
   *  one who says '…christ') and when the last did, whether that second-man line and the one closing line have been said, and a counter dealing the directions they widen out along */
  bodyVisits = 0; bodyVisitT = -1; bodyRemarked = false; bodyClosed = false; bodyFan = 0;
  /** (living) the found body this man's current suspicion is about, and where he is in its short script: walking up ('to' his own spot short of it), covering it,
   *  widening out to a search point away from it ('fan'); null = ordinary suspicion. Cleared whenever he leaves 'suspicious'. */
  bodyDuty: { body: Guard; role: 'finder' | 'called'; stage: 'to' | 'cover' | 'fan'; t: number; t0: number; spot: Vec3 | null } | null = null;
  dropped: Item | null = null;   // the torch / pistol that left his hand when he died (the sputtering light rides it)
  gunLostAt = -1;   // a LIVING man whose gun was knocked from his hand at the grab (HOLD.dropGun): dropped = that gun, this = when — his hands are empty (guards.ts inHand) and its light dies on the floor; −1 again once he has it back (player.ts handBack)
  torchLostAt = -1;   // a LIVING man whose torch was knocked from his hand (the grab): dropped = that torch, this = when — the beam follows it down and sputters out (guards.ts updateFlashlight); on patrol afterwards his hand is empty
  path: Vec3[] = []; pathI = 0; repathT = 0; pathGoal: Vec3 | null = null;
  /** What he carries and its state (weapons.ts: the row from his route — the 9 mm service pistol unless the level says otherwise — with its chamber and magazine;
   *  guards.ts fires it and reads its cadence, fireWeapon its report / flash / spread, killGuard what falls out of the hand). fireCd: seconds until the trigger
   *  will go again (the AI's beat: cadence, the reaction on going alert, the shield's floor). reloadT: his reload BEAT — seconds left standing there changing
   *  magazines (the row's reload.dur), −1 = not; when it runs out the weapon is simply full again (weapon.rearm: a guard's spares are bottomless). */
  weapon: Firearm; fireCd = 1; reloadT = -1;
  /** rifles (docs/internal/sc20k-design.md §3): dealt the carbine by the sandbox knob (tune.carbineGuards, written by Game.update each frame) — and the deal IS the
   *  weapon: while it stands, `weapon` is the AKS-74U row (bursts, the 30-round box, the harder report, the rifle that drops — guards.ts burstTrigger, combat.ts),
   *  the RIG in his hands the carbine and his poses the long gun's; dealt away again, his route's row comes back. guards.ts rigOf reads it. */
  carbine = false;
  /** suppression (suppression.ts): rounds passing / striking close to him — the scalar every reaction branches on (guards.ts: flinch, worse and later rounds, head
   *  down, the shift to cover) and its clocks. Nothing else writes it; the panel line and the QA probes read it. */
  sup = new Sup();
  /** the aim-settle model (aim.ts): his track on Sam (0‥1 — no round under AIM.guard.acquireMin of it, his cone × up to unsettledK short of 1), Sam's bearing
   *  rate across him, whether he is braking for a shot, the last round's numbers. guards.ts trackGuard feeds it once a frame; the three fire sites read it. */
  aim = new AimState();
  reactT = 0; searchT = 0; lookPhase = simRandom() * 10;
  speed = 0; flashlight: RtLight; sweep = 0; beamDir: Vec3 = [0, -0.3, 1];
  stepPhase = 0; heardUpTo = -1; smokeTrans = 1; lightDeadUntil = -1; diedAt = -1;
  /** a teammate's breaching shotgun out of his big slot and in his hands for a lock (bigkit.ts gunUp / gunDown): the gun he put down for it, to take up again */
  slung: { own: Firearm; ownId: WeaponId | undefined; ahead: number; gun: Firearm; out: boolean; t: number } | null = null;
  /** a teammate's second gun (gunslots.ts GUNSLOTS: his card's other slot) — `gun` / `id` / `ahead` are the one that is NOT in his hands; `out`: that is his
   *  primary, let go onto its sling for the sidearm; `t` the game time a man was last in front of him with it out (in his eyes, or a round from it); `lock`: no round before this (his hands are between guns) */
  second: { gun: Firearm; id: WeaponId; ahead: number; out: boolean; t: number; lock: number; /** the sidearm's round count when he was last seen firing it */ shots: number } | null = null;
  /** BIGSLOT.moves (bigkit.ts hammerOut): the hammer off a teammate's back and in his hands for a door — the game time his hands left his gun for it, when each
   *  blow lands and when he began putting it back, both on that clock (end −1: not yet), and the point struck. null = on his back. Not saved: a load finds it there. */
  bigOut: { t0: number; blows: number[]; end: number; at: Vec3 } | null = null;
  /** a teammate's gun let go of for a two-handed job (workstow.ts mateStow / mateStowTick): the game time his hands left it, the time it is back up (−1: the job
   *  still runs) and whether the job fed it this frame. null = it is in his hands. Not saved: a load finds it there. */
  workStow: { upT: number; fed: boolean } | null = null;
  /** was his light burning the moment it left his hand (killed / grabbed)? a dark weapon light must not sputter ON as it tumbles (review 08-10 #7: the breach hostiles' unlit lights swept the sunlit room the frame each died) */
  lightLitAtLoss = true;
  dazzledAt: Vec3 | null = null;   // where the charge that blinded him went off (the motion pass turns him away from it — character.ts MOVES; not saved)
  dazzledUntil = -1;   // stun canister with line of sight: no vision, no shooting, rooted to the spot until this time (see Game.detonateStun)
  /** a ring airfoil took him in the body (launcher.ts staggerGuard): doubled over till this time — rooted like the dazzle (reactT), no round from him, but he can SEE,
   *  and he comes out of it alert toward the side it came from */
  staggerUntil = -1;
  /** a booted door met him where he stood right at it (doorthrow.ts): on a knee till this time, inside the fold the same blow gave him */
  doorDownUntil = -1;
  /** game time a blast left him hurt (condition.ts: -1 = never; read through isHurt) */
  hurtAt = -1;
  sawPlayerThisFrame = false; lastPos: Vec3; stuckT = 0; stuckN = 0;
  /** a real sighting of his FOE this frame, whoever that is (teams) — sawPlayerThisFrame stays what its name says: eyes on Sam (what the mission's 'spotted' count
   *  and the witnesses read), which for the staff is the same thing */
  sawFoeThisFrame = false;
  /** (dead) the id of the character whose round put him down, −1 = not by a round / unknown (combat.ts fireWeapon stamps it; the engagement record names him) */
  killerId = -1;
  sawBodyT = -100;                     // game time he last discovered a body: a short refractory before he can call in another (two lying together are one 'man down', not two in two frames)
  leaderStillT = 0;                    // lockdown follower: seconds the man he trails has not moved (planted beside a leader who never moves again, he turns to look at him — guards.ts followLeader)
  alertBest = 1e9; alertStallT = 0; alertRef: Vec3 | null = null; chaseT = 0;   // alert with a fix: nearest he has got to it, how long without getting nearer, the fix that was measured against (a no-progress exit into 'search', guards.ts — re-based when the fix moves), and the seconds this chase has run without eyes on Sam (its hard backstop)
  shotBlockedT = 0;                    // alert with eyes on the player: seconds his line of FIRE (not sight) has been stopped short by something solid — a jamb on his gun-hand side, a leaf, the desk Sam is behind (guards.ts: he closes along the path instead of emptying magazines into the frame)
  sightPos: Vec3 = [0, 0, 0]; sightVel: Vec3 = [0, 0, 0]; sightT = -100; ledT = -100;   // where and how fast Sam was going the last frame this man had him in view (even faintly), when that was, and the sighting whose loss has already been led (guards.ts leadFix: the fix he is left with runs on the way Sam was going, once, the frame he loses him)
  /** when the fix he is working from was PLACED (guards.ts updateGuard stamps it whenever lastKnown jumps): the search reasons about how far Sam can have got since then */
  fixT = -100; fixRef: Vec3 | null = null;
  /** stamp fixT if the fix has moved since last looked at (called once a frame by updateGuard; a fix that creeps with a man in view moves it along too) */
  trackFix(now: number) { const lk = this.lastKnown; if (!lk) { this.fixRef = null; return; } if (!this.fixRef || Math.hypot(lk[0] - this.fixRef[0], lk[2] - this.fixRef[2]) > 0.5) { this.fixRef = v3.copy(lk); this.fixT = now; } }
  /** the search that reasons about darkness (guards.ts searchPlanFor): the hide spots dealt round the fix, scored dark × cover × plausible off the renderer's own
   *  irradiance readings, visited best-first — null outside 'search' (built on its first frame, dropped on leaving it). The panel / HUD / QA read it. */
  searchPlan: SearchPlan | null = null;
  /** threshold discipline (guards.ts pieDoorway): the doorway his alert / search path is taking him through right now and where he is in slicing it — null when
   *  none; pieLast / pieLastT: the door he last went through that way (or any way, while hunting) and when, so the one he has just come through is not pied again;
   *  piePrev / piePrevT: where he stood the last frame that was looked at (the crossing itself is his stride cutting the frame line) */
  pieing: Pieing | null = null; pieLast: Door | null = null; pieLastT = -100; piePrev: Vec3 | null = null; piePrevT = -100;
  /** the human shield's standoff (guards.ts standoffPerceive / standoffAlert, docs/internal/grab-interrogate-design.md §2.2): a colleague held in Sam's arm in his
   *  view — he is 'alert' throughout, but instead of the chase and the shot he keeps his distance, works round toward Sam's back for a clean line, and talks; null
   *  when nobody he can see is being held (dropped the moment the hold ends, or four seconds after he last had the pair in view) */
  standoff: Standoff | null = null;
  stallRef: Vec3 | null = null; stallT = 0;   // walking watchdog (guards.ts notGettingAnywhere): where he last made half a metre of ground from, and the seconds since — a suspicious / searching / body-script leg that goes nowhere is dropped where he stands
  script: GuardScript | null = null;   // scripted choreography (tour beats / squad drills): while set, squad.ts drives him and the AI state machine is bypassed (the live clearing dispatcher runs a light perception pass for him; tour scripts run blind)
  task: GuardTask | null = null;   // errands that should survive the normal suspicion decay (reset the breaker; look at the rack that dropped off the network; walk a silent colleague's route)
  /** alarm escalation (guards.ts updateEscalation): drawn = the sidearm is out on patrol (level ≥ 1) — handProps / attachFlashlight / killGuard read it where they
   *  used to read 'patrol ⇒ torch'; leader = lockdown pairing: trail this man while calm (followT: re-plan clock, ≤ 2 path plans a second; followGoal: his
   *  station behind him); post = lockdown: hold this corridor junction instead of walking the route */
  drawn = false; leader: Guard | null = null; followT = 0; followGoal: Vec3 = [0, 0, 0]; post: Chokepoint | null = null;
  /** `look` (a spawned unit's, guards.ts spawnUnit — absent for the level's men, whose call is unchanged): the trouser tint, the facing (a one-point route has no
   *  first leg to face down), the name he answers to, his side. */
  constructor(ch: GltfCharacter, id: number, route: PatrolRoute, routeI: number, flashlight: RtLight, tint: Vec3, look?: { tint2?: Vec3; yaw?: number; name?: string; team?: Team }) {
    const pos = v3.copy(route.points[0]); const p1 = route.points[1 % route.points.length];
    this.char = new Character(ch, { id, tint, tint2: look?.tint2 ?? [0.02, 0.02, 0.025], pos, yaw: look?.yaw ?? v3.yawTo(pos, p1) });   // facing down the first leg
    this.lastPos = v3.copy(pos); this.routeI = routeI; this.route = route; this.flashlight = flashlight; this.callsign = look?.name ?? CALLSIGNS[Math.max(0, id - 10) % CALLSIGNS.length];
    if (look?.team) this.team = look.team;
    if (this.team !== 'guard' && this.team !== 'hostile') this.foe = null;   // a side not hostile to Sam has nobody until a hostile man shows himself (a hostile unit starts on Sam like the staff, and re-targets by salience)
    this.keys = new Set(route.keys ?? [FLOOR_KEY]);                    // every man on nights carries the floor key unless his route says otherwise
    this.weapon = new Firearm(WEAPONS[route.weapon ?? 'guard9mm']);   // (a row still switched off throws here, naming itself: nobody carries a long gun before its lane lands)
    this.char.muzzleAhead = this.weapon.def.muzzleAhead;
  }
}

// ---------------------------------------------------------------- game
/** the rolling chair's voice (audio.ts `follow`, rollTick below): its level at full speed, the speed (m/s) that counts as full — slower, it is quieter and lower —,
 *  the speed under which a chair is not rolling for anybody's ears, and the seconds without movement after which its voice is let go */
const ROLL_VOICE = { gain: 0.5, fullV: 2.5, minV: 0.12, grace: 0.5 };
/** A castor chair that has started to roll (rollTick): where it was last step, how hard it goes (0‥1), when it last really moved, and its voice's serial (0 = none). */
interface Roll { p: Prop; x: number; z: number; k: number; moveT: number; voice: number }
export class Game {
  col: StaticCollision;
  /** a snow level's lying snow as one surface (render/snowField.ts; SNOW_LOOK.on) — PICTURE ONLY: the g-buffer's, and a check's. null on every other level and with the switch off */
  snowField: SnowField | null = null;
  /** … and the prints boots have pressed into it (snowTracks.ts; SNOW_LOOK.tracks) — picture only too; null without the field or with its switch off */
  snowTracks: SnowTracks | null = null;
  private snowLookWas = -1;
  /** what the simulation hands the GPU only when it changed is handed over whole again (host/putback.ts: the GPU's copy is another moment's): the snow's field
   *  and tracks on the next frame, the wind's map of what stands, the dust under the roofs. Here and not in the host file: a host module that imported a game
   *  module by VALUE would be one more way into the game's import cycle, and that cycle does not load from every door. */
  rehand() { this.snowLookWas = -1; airResend(this); this.airDust.resend(); }
  /** the field and the prints follow their switches (at the level's start, and again on any frame a switch has moved: a recording's knobs are applied to a game
   *  already built): baked / made the first time they are wanted, handed to the g-buffer, taken back when the switch goes off */
  private syncSnowLook() {
    const on = SNOW_LOOK.on && snowLevel(levelNameOf(this.level)), tracks = on && SNOW_LOOK.tracks;
    if (on) attachSnowBlast(this);   // (a blast over lying snow marks it: snowBlast.ts hears the destruction engine's feed — once an engine, asked each frame)
    const key = (on ? 1 : 0) | (tracks ? 2 : 0); if (key === this.snowLookWas) return;
    this.snowLookWas = key;
    this.snowField = on ? (this.snowField ?? buildSnowField(this.level, { wind: WEATHER_PRESETS.snow.wind })) : null;
    this.snowTracks = tracks && this.snowField ? (this.snowTracks ?? makeSnowTracks()) : null;
    this.engine.gbuffer?.setSnowField?.(this.snowField, snowCfgRows(this.snowField, this.snowTracks ? TRACK_RES : 0));
    this.engine.gbuffer?.setSnowTracks?.(this.snowTracks);
  }
  /** once a frame, after everybody is posed: this frame's footfalls pressed into the snow, and what changed handed to the g-buffer */
  private stepSnowTracks(dt: number) {
    const dug = this.snowField ? stepSnowDigs(this, dt) : null; if (dug) this.engine.gbuffer?.setSnowFieldRect?.(this.snowField!, dug);   // (a blast dug a hill out: snowBlast.ts)
    const T = this.snowTracks; if (!T || !this.snowField) return;
    updateSnowTracks(this, T, this.snowField, dt);
    if (SNOW_LOOK.marks) updateSnowMarks(this, T, this.snowField, dt);   // … and every thing that moved over the snow marks it (snowMarks.ts)
    formSnowTracks(T, dt);   // the marks still forming come on, this frame's among them (SNOW_LOOK.marks; nothing forms with it off)
    if (T.dirty) {   // (handed over piece by piece: marks forming a street apart are not one rect round them all)
      const set = this.engine.gbuffer?.setSnowTracks; if (set) { if (T.rects.length > 0 && T.rects.length <= 24) for (const r of T.rects) set.call(this.engine.gbuffer, T, r); else set.call(this.engine.gbuffer, T, T.dirty); }
      T.dirty = null; T.rects.length = 0;
    }
  }
  chars: CharacterRenderer;
  /** THE CAST: each drawn man's own round-cone fit by character id (render/sdfrig.ts RigFit.byOwner — the engine's proxy pack reads it); null with the mannequin loaded */
  rigFits: Map<number, { r0: Float32Array; r1: Float32Array }> | null = null;
  private rigFitOf = new Map<number, { r0: Float32Array; r1: Float32Array } | null>();   // (by part mask)
  /** the mannequins' shadow trees (render/meshShadows.ts — the ultra experiment behind settings.meshShadows): built here next to the skin instances they follow */
  meshShadows: MeshShadows;
  player: Player; guards: Guard[] = [];
  /** the building's own night people — the cleaner, the late worker (civilians.ts): Guard records with `civ` set, NOT in `guards` (no AI side perceives, targets or
   *  answers for them; the module runs them after the guards each frame). Empty with tune.civilians off or on a level that authors none. */
  civilians: Guard[] = [];
  targets: LightTarget[] = [];
  events: GameEvent[] = [];
  probe: ProbeLike;
  /** THE seam between the GPU and the simulation (sensors.ts): every value the game takes off the renderer — the light meters, the smoke sight lines — is asked
   *  and read through this, by key; live it is the probe verbatim, a recording journals what it delivered, a replay serves that back without a GPU (journal.ts) */
  sensors: Sensors = new Sensors(() => this.probe);
  /** THE SENSES ON THE CPU (sense.ts SENSE.cpu; off = nothing below runs): the game's own smoke, fed by every emitter handed to the solver while the switch is on,
   *  and the solver as it was before the game's tee was put in front of it (null = no tee) */
  cpuSmoke = new CpuSmoke(); private smokeOwned: { solver: SmokeSystemLike; undo: () => void } | null = null;
  /** the session journal's recorder (journal.ts): F10 / __journal on the game page, tools/qa/journal-probes.ts headless — idle unless somebody asked */
  journal: SessionRecorder = new SessionRecorder(this);
  /** THE REPLAY BUFFER's tap (replaybuf.ts): called as a step's first statement with the record it is about to run on, and as its last with none — it only reads. null (a game nobody gave a buffer) = nothing */
  replayTap: ((dt: number, cmd?: PlayerCmd) => void) | null = null;
  /** The AI's window on the renderer's light, by key — the same GPU irradiance queries the light meter is made of (1–2 frames' latency, read back by key):
   *  lightQuery asks for the irradiance at a world point under `key`, lightAt returns the latest answer for it (max-axis irradiance, W/m² — what the meter maps
   *  to visibility) or undefined while there is none. Through the sensors by default; the QA harness (whose fake GPU never answers) swaps in a table to test the logic. */
  lightQuery: (key: string, pos: Vec3, skipOwner?: number) => void = (key, pos, skipOwner = 0) => this.sensors.ask(key, pos, skipOwner);   // (skipOwner: a reading INSIDE a man's chest must not be shadowed by his own capsules — the AI targets' meter, guards.ts unitLightMeter, as Sam's passes his id)
  lightAt: (key: string) => number | undefined = key => this.sensors.read(key);
  /** drop a stale answer for `key` (a search plan re-using its keys for new spots): the probe keeps the last value per key for ever otherwise */
  lightForget: (key: string) => void = key => this.sensors.forget(key);
  /** irradiance queries the searching guards queued THIS frame (guards.ts searchProbes keeps them inside a budget well under the probe's 32; the QA soak asserts it) */
  searchProbeN = 0;
  time = 0;
  /** THE GAME'S OWN DIE (math/dice.ts): set by the stand-up when the game was given a seed (the page always is) — every simRandom() draw then comes off it, a checkpoint
   *  carries where it stands, and nothing outside the game can take a number from it. null = the game draws Math.random, as the QA harness's tools expect */
  dice: SimDice | null = null;
  aiEnabled = true; godMode = false; infiniteAmmo = false; showDebug = false; spectate = -1;   // (aiEnabled / godMode / infiniteAmmo are also the START CARD's sandbox row — ui/menu.ts `SANDBOX_LS`, kept per machine and applied by main.ts at boot) // guard index the camera follows (-1 = player); infiniteAmmo: sandbox bottomless magazine, applied to whichever pistol the current Player carries (survives restarts)
  playerInvisible = false;   // showcase tour: guards neither see nor hear the idle player
  /** 0‥1, how close Sam is to being walked in on — for the LOOK of his movement only (fed to player.char.anim.deliberate each frame, see update(); the HUD may
   *  read it too): 1 with a living guard who has not clocked him inside ~3 m, gone by ~7 m; nothing once that man is alert; ≥ 0.6 while he is suspicious or
   *  searching; ≥ 0.5 while a lit torch beam lies across Sam. Nothing the AI, the speeds or the meters read. */
  threatProximity = 0; private torchOnT = -100;   // (game time a beam last lay on him: the torch's share is held 1.5 s past it, so a sweeping beam does not pump the gait)
  aimPoint: Vec3 = [0, 0, 0]; aimTarget: LightTarget | null = null; aimGuard: Guard | null = null; aimFriend: Guard | null = null;   /* (friends.ts: the man of his own side the cursor's ray lands on — never the reticle's with FRIENDS.noSnap; his gun comes off him by FRIENDS.lowReady) */
  dynBoxes: Box[] = [];
  /** How many boxes the game itself made this frame, before the fog of war's rule for loose things rewrote the list (edgeLook.ts budgets by it). */
  dynRaw = 0;
  /** ring airfoils in flight (launcher.ts: fired off the FN2000's launcher, stepped after the player, drawn with the items; a spent one becomes a 'ring' item) */
  rings: Ring[] = [];
  /** 40 mm rounds in flight (he40.ts: the FN2000 launcher's other attachment — stepped and drawn beside the rings; a burst is frag.ts's blast, a dud a 'shell' item) */
  shells: Shell[] = [];
  /** the loadout: does Sam's kit have the FN2000 (docs/internal/sc20k-design.md §11.2 — default in the kit; the start card / pause menu toggle writes it and it is
   *  remembered per machine, localStorage twopointsix.fn2000 — an older machine's twopointsix.sc20k is still honoured). Read whenever a fresh Player is made (boot, restartEncounter); flipping it   (08-12: no longer written or read — the FN2000 is always in the kit; the key survives only in older profiles)
   *  live re-kits the current one. */
  fn2000 = true;
  doors!: Doors;
  /** which side each door opens into and why it was dealt that side (doorswing.ts dealSwings; doors.ts DOORWAY) */
  get doorSwings(): SwingDeal[] { return swingsNow(this.doorDeals); }
  /** …as dealt: each door's row by the room rules, an outside door's open-air deal on its `out` (DOORWAY.exitsOut picks, live) */
  doorDeals: SwingDeal[] = [];
  /** loose furniture (chairs, cartons, bins, plants) shoved around by characters, bullets, canisters and door leaves */
  props: PropSystem;
  /** door the player would operate with F right now (also drives the HUD prompt) */
  useDoor: Door | null = null;   // the hovered door when it is within reach (F acts on it)
  reachStats = wallClock({ lights: 0, meanFraction: 1, ms: 0 }, 'ms');   // reach masks built at construction (render/reach.ts): how many lights got one, the mean fraction of the level they reach, build time
  /** the cells under the ceiling slab (reach.ts buildInteriorCells), kept for directional lights added later (the breach's sun: lighting.ts setDaylight → buildDirReach) */
  reachInterior: Uint8Array | null = null;
  /** WALL BREAKING (game/wallbreak.ts): the full-height walls the reach masks were derived from, the lights that carry a mask, and the ones waiting to have theirs
   *  re-derived because a wall near them opened (or came back) */
  private reachSolid: Uint8Array | null = null; private reachLights: RtLight[] = []; private reachQueue: { l: RtLight; rects: [number, number, number, number][] | null; boxes: [number, number, number, number][]; job?: ReachJob; restarts: number }[] = []; private reachSolidBoot: Uint8Array | null = null; private reachBoot = new Map<RtLight, Uint32Array>();
  /** BLAST_PACE: the rects walls changed in, noted on the frame they went and not yet read into the wall raster (reachChanged), and the frames that still waits */
  private reachHeld: [number, number, number, number][] = []; private reachHold = 0;
  /** A wall changed inside `rect` [x0, z0, x1, z1] (null = anywhere: a reset): if the wall raster really differs, every masked light whose range reaches the rect is
   *  queued WITH the rect and `reachTick` re-decides, a few lights a frame, only the cells whose line to the light passes it (render/reach.ts ReachOnly: a whole
   *  mask is ~13 ms of sight lines on a slow CPU, the wedge behind one hole a fraction of a millisecond; a stale mask in between only keeps a light out of cells
   *  it could now reach). A RESET puts the masks the level booted with straight back. The simulation never reads a reach mask — the picture's alone. Returns how
   *  many lights were queued. */
  reachChanged(rect: [number, number, number, number] | null): number {
    if (!this.reachSolid) return 0;
    // BLAST_PACE: a wall's change is only NOTED on the frame it went (that frame is the long one) — reachTick reads the raster `reachHold` frames on, every rect noted
    // since in one go, and derives from the frame after that. A reset drops the notes with the queue. (Not under the old pace: ?reachpace=old keeps its own frames.)
    if (rect && BLAST_PACE.on && !REACH_PACE.whole) { if (!this.reachHeld.length) this.reachHold = BLAST_PACE.reachHold; this.reachHeld.push(rect); return 0; }
    return this.reachRead(rect ? [rect] : null);
  }
  /** reachChanged's work: the wall raster built again and set against the last, the lights in reach of `rects` queued (null = a reset) */
  private reachRead(rects: [number, number, number, number][] | null): number {
    if (!this.reachSolid) return 0;
    if (!rects) this.reachHeld.length = 0;
    const solid = buildWallRaster(this.engine.world.statics, this.level.doors.map(d => ({ hinge: d.hinge, closedDir: d.closedDir, width: d.width })));
    const box = wallRasterDiff(this.reachSolid, solid);   // the sub-cells that changed: a point light's cells are decided again only where their own sight lines touch them
    if (!box) return 0;
    this.reachSolid = solid; let n = 0;
    const queue = (l: RtLight, r: [number, number, number, number] | null) => {
      const q = this.reachQueue.find(x => x.l === l);
      if (!q) { this.reachQueue.push({ l, rects: r ? [r] : null, boxes: [box], restarts: 0 }); n++; return; }
      if (q.job?.st) { q.job = undefined; q.restarts++; }   // part-decided, and now there is more to decide: it starts over (a light this change does not reach carries on — it would not have been queued for it)
      if (!r) q.rects = null; else if (q.rects) { q.rects.push(r); if (!q.boxes.includes(box)) q.boxes.push(box); }
    };
    if (!rects) {
      const boot = this.reachSolidBoot; let same = !!boot && boot.length === solid.length; for (let i = 0; same && i < solid.length; i++) if (boot![i] !== solid[i]) same = false;
      if (same) this.reachSolid = boot;   // the authored walls again: the raster object the level booted with, and with it the sight lines' jump field (reach.ts jumpsOf) — not worked out afresh inside the next break's first tick
      this.reachQueue.length = 0;
      for (const [l, m] of this.reachBoot) { if (l.kind === 2) l.reachDir = m; else l.reach = m; }   // a light with no entry was never re-derived: its mask IS the authored level's
      this.reachBoot.clear();
      return this.reachLights.length;
    }
    for (const r of rects) {   // (the notes of several changes read at once: each light is queued with each rect in its reach, the raster's changed box theirs together, once a light)
      for (const l of this.reachLights) {
        const dx = Math.max(r[0] - l.pos[0], 0, l.pos[0] - r[2]), dz = Math.max(r[1] - l.pos[2], 0, l.pos[2] - r[3]); if (Math.hypot(dx, dz) > l.range + 1) continue;
        queue(l, r);
      }
      for (const l of this.engine.lights.lights) if (l.kind === 2 && l.reachDir) queue(l, r);
    }
    return n;
  }
  /** re-derive queued reach masks, in the queue's order: `steps` sight-line steps a frame (~2 ms on a slow CPU — a mask too big for one frame's share carries on
   *  where it stopped the next, render/reach.ts ReachJob, and is swapped in whole when its last cell is decided; the moon's rays are a frame's share by themselves),
   *  at most `n` lights finished (update() calls it once a frame; nothing queued = nothing done). Returns the lights finished. `REACH_PACE.whole` (reach.ts; the
   *  page's ?reachpace=old) = the pace this replaced: each mask whole, one light at least and more until 60 cells are decided. */
  reachTick(n = 8, steps = REACH_PACE.steps): number {
    if (this.reachHeld.length && this.reachHold-- <= 0) { this.reachRead(this.reachHeld.splice(0)); return 0; }   // (BLAST_PACE: the noted changes read into the raster — this frame's share; the masks from the next. While a note waits, masks queued before it carry on below)
    let done = 0; const c0 = REACH_WORK.steps, k0 = REACH_WORK.cells, whole = REACH_PACE.whole;
    while (done < n && this.reachQueue.length && this.reachSolid) {
      const left = whole ? Infinity : steps - (REACH_WORK.steps - c0); if (left <= 0 || (whole && done > 0 && REACH_WORK.cells - k0 >= REACH_PACE.wholeCells)) break;
      const q = this.reachQueue[0], l = q.l;
      const boot = () => { if (!this.reachBoot.has(l)) { const m = l.kind === 2 ? l.reachDir : l.reach; if (m) this.reachBoot.set(l, m); } };   // what the level as authored gave it (masks are replaced, never written in place)
      if (l.kind === 2) {
        if (!whole && REACH_WORK.steps !== c0) break;
        boot(); this.buildDirReach(l, q.rects && l.reachDir ? { prev: l.reachDir, rects: q.rects } : undefined);
        this.reachQueue.shift(); done++; if (whole) continue; break;
      }
      const job = q.job ??= { budget: left }; job.budget = q.restarts >= 2 ? Infinity : left;   // (walls changing faster than a big mask can be decided in shares: the third go takes it in one, as every mask once was)
      const m = reachMaskSome(this.reachSolid, l.pos, l.kind === 3 || l.kind === 1 ? l.dir : [0, 0, 0], l.radius, this.reachInterior, q.rects && l.reach ? { prev: l.reach, rects: q.rects, boxes: q.boxes, maxDist: l.range + 1.5 } : undefined, job);
      if (!m) break;
      boot(); l.reach = m; this.reachQueue.shift(); done++;
    }
    return done;
  }
  get reachPending(): number { return this.reachQueue.length + this.reachHeld.length; }
  /** Give a DIRECTIONAL light (kind 2) its reach mask: the outdoor cells, plus every indoor cell with an unblocked static path toward it (render/reach.ts
   *  reachMaskForDirectional over this level's collision raycast, glass passing). The ReSTIR estimator reads it (lights.ts dirMasks); a few ms, once per light. */
  buildDirReach(l: RtLight, only?: ReachOnly) {
    if (l.kind !== 2 || !this.reachInterior) return;
    const d = l.dir; const len = Math.hypot(d[0], d[1], d[2]) || 1; const toLight: Vec3 = [-d[0] / len, -d[1] / len, -d[2] / len];
    // ~10 k short rays: the level's raycast is brute force over every static (0.4 s of that), so bucket the shadow-casting statics on the 1 m grid once and give
    // each ray only the boxes whose cells its XZ span crosses (a couple of dozen) — the same answer in ~20 ms
    // ~10 k short rays: bucket every SHADOW-CASTING static (NoPrimary ones too — the ceiling slab is exactly what stops the moon; glass passes light) on the 1 m grid once,
    // then march each ray cell by cell testing the 3×3 buckets round it and stop at the first hit (indoors that is the ceiling within a metre or two): ~30 ms, not
    // the 0.4 s of the level's brute-force raycast
    const W = WORLD.gridW, H = WORLD.gridH, cs = WORLD.gridCell, statics = this.engine.world.statics;
    const buckets: number[][] = Array.from({ length: W * H }, () => []);
    statics.forEach((b, i) => {
      if (b.flags & (BoxFlag.NoShadow | BoxFlag.Glass | BoxFlag.Dynamic)) return;
      const r = Math.hypot(b.h[0], b.h[2]);   // yawed footprint bound
      const x0 = Math.max(0, Math.floor((b.c[0] - r - WORLD.min[0]) / cs)), x1 = Math.min(W - 1, Math.floor((b.c[0] + r - WORLD.min[0]) / cs));
      const z0 = Math.max(0, Math.floor((b.c[2] - r - WORLD.min[2]) / cs)), z1 = Math.min(H - 1, Math.floor((b.c[2] + r - WORLD.min[2]) / cs));
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) buckets[z * W + x].push(i);
    });
    const seen = new Uint32Array(statics.length); let stamp = 0;
    const blocked = (from: Vec3, dir: Vec3, dist: number): boolean => {
      stamp++;
      const steps = Math.ceil(dist / 0.5);
      let lastCell = -1;
      for (let s = 0; s <= steps; s++) {
        const t = Math.min(dist, s * 0.5);
        const cx = Math.floor((from[0] + dir[0] * t - WORLD.min[0]) / cs), cz = Math.floor((from[2] + dir[2] * t - WORLD.min[2]) / cs);
        const cell = cz * W + cx; if (cell === lastCell) continue; lastCell = cell;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
          const x = cx + dx, z = cz + dz; if (x < 0 || z < 0 || x >= W || z >= H) continue;
          for (const i of buckets[z * W + x]) { if (seen[i] === stamp) continue; seen[i] = stamp; if (rayBox(from, dir, statics[i], dist)) return true; }
        }
      }
      return false;
    };
    l.reachDir = reachMaskForDirectional(toLight, this.reachInterior, blocked, only);
  }
  touring = false;   // the showcase tour is running (demo.ts start/stop) — a plain signal for the HUD / mission getters; quietUtility is NOT it (a stop can run 'live' with the flag down)
  hover: Interactable | null = null; interactables: Interactable[] = []; nearby: Interactable[] = []; aimSnap: Vec3 | null = null;   // aimSnap: where the auto-aim put the reticle this frame (a light or a man's chest), null = raw cursor aim   // hover = the highlighted ROW (what a Space tap / release performs), nearby = the panel's rows (player.ts buildInteractables), interactables = the per-thing markers
  /** The row Space performed THIS frame (interact.ts updateInteract sets it right after the rows are built — a tap released, or Space let go with the selector open —
   *  and update() clears it at the end): each system reads it where it used to read the key itself, so the frame's order of business is what it always was
   *  (updateHold the held man's verbs, updateDoors the doors' / the grab / the body / the breaker, updateMission the drive). null the rest of the time. */
  act: Interactable | null = null;
  /** Scripted control (showcase tour): head for `goal` instead of WASD, aim at `aim` (world point — the cursor is moved onto its projection so hover /
   *  markers / reticle all behave as if a hand were on the mouse), optional crouch. One-shot actions go in as synthetic key hits / clicks on Input.
   *  target: the man a scripted shot is FOR (cursor picking from a top-down camera is unreliable against someone hugging a partition); throwAt: world
   *  point a scripted throw is solved to (the cursor cannot name a floor point the camera sees a wall in front of). */
  puppet: { goal: Vec3 | null; aim: Vec3 | null; crouch?: boolean; walk?: number; fixtures?: boolean; target?: Guard | null; throwAt?: Vec3 | null } | null = null;
  mPerPx = 0.01;   // world size of one internal pixel at the look-at depth (update(): thin props such as the lasers widen to stay >= ~1 px)
  private tmpV: Vec3 = [0, 0, 0];
  calledIn = false; stoodDown = false;   // 'target down' radioed / 'back to your posts' said this encounter
  /** Alarm escalation (guards.ts updateEscalation): 0 calm · 1 heightened · 2 lockdown — the floor's memory of having been alarmed. Raised when an alarm episode
   *  ends with nobody found, and one step by a body being found; steps down one level at a time once escalationT has passed AND nobody is alert or
   *  searching. alarm: the running episode (somebody went to 'alert' and not everybody has given up the search yet), the latest fix it produced (picks the
   *  chokepoint and who radios), the lockdown pair's time apart. Live play only — the tour never moves it (quietUtility) — and resetGuards() zeroes it. */
  escalation: 0 | 1 | 2 = 0; escalationT = -1;
  alarm = { episode: false, pos: [0, 0, 0] as Vec3, placed: false, apartT: 0, raisedAt: -100 };   // raisedAt: game time of the last raiseEscalation (two raises in a beat say one thing, guards.ts)
  /** Room clearing in a lockdown (guards.ts planClears deals it, squad.ts Clearing runs it): the pair working through the `clearRooms` rooms nearest the last fix —
   *  approach, the RoomClear drill live, the next — with their own senses run for them so anything real breaks it off; null when nobody is clearing. Dies with
   *  the guards (resetGuards) and with the lockdown (stand-down). */
  clearing: Clearing | null = null;
  /** rooms per sweep: 0 = by what raised the lockdown (a body found → the 3 nearest, an alarm that came to nothing → 2; guards.ts planClears), 1‥5 = that many (panel) */
  clearRooms = 0;
  /** room name → game time the pair last called it clear in THIS lockdown (planClears will not send them round the same room again within a minute unless the new
   *  fix is inside it); emptied whenever the lockdown ends (step-down, stand-down, reset) */
  clearedAt = new Map<string, number>();
  blackout = { active: false, until: -1, since: -1, permanent: false, restoredAt: -100 }; breakerFixT = 0;
  beacons: { light: RtLight; phase: number; target: LightTarget }[] = [];
  items!: Throwables;
  fx: { box: Box; ttl: number }[] = [];
  sparks = new Sparks(fx.sparks);   // powder streaks + stun-canister fragments (CPU particles → emissive dynamic boxes)
  /** tracer rounds in flight (tracers.ts, lane R6): the carbine's every-third round and its last three drawn as a travelling streak with a small light on the head —
   *  fed by combat.ts fireWeapon (behind tune.tracers), advanced and drawn with the sparks in update(), emptied with them in clearAftermath */
  tracers: Tracers;
  /** decals (experiment E1, render/decals.ts): the marks the encounter leaves — bullet holes, the stun charge's scorch, boot scuffs on kicked leaves, the ring's chips —
   *  fed by marks.ts from the four places things hit things, handed to the engine (whose g-buffer draws them), emptied with the level's own state (resetLevelState) */
  decals: Decals;
  /** the night storm (weather.ts, E10): rain outdoors, lightning through the windows, thunder, the wet lot — on by default (?noweather boots it off; Tab ▸ Weather;
   *  window.__weather) */
  weather: Weather;
  fxSeed = 1;               // counting seed for the seeded effects: every shot / can differs, a replayed session repeats
  audio: GameAudioLike = nullAudio;
  ocpCooldown = 0; lastStingT = -100; eventSeq = 0;
  messages: { text: string; t: number }[] = [];
  /** the mission thread (see Mission): reset by restartEncounter(); frozen — neither progressing nor counting — while the showcase tour runs */
  mission: Mission = newMission(0);
  /** the run's chronicle (chronicle.ts): the debrief's timeline, Sam's path, the score's counters — written through the mission's own live gate, replaced with the
   *  mission by restartEncounter(), read by the debrief card (ui/debrief.ts) as the run stood when it ended */
  chronicle: Chronicle = new Chronicle();
  /** the response to going loud (game/qrf.ts): idle until a locked-down floor has confirmed gunfire (or found two men down), then the response team is requested,
   *  called on the radio all the way in, comes through the west stair door as one four-man element and clears toward the last fix — and past that, the compound's
   *  perimeter is locked down round him. One wave a night; reset with the guards (resetGuards / restartEncounter). */
  qrf = new Qrf();
  /** the level-design devices (game/devices.ts): the level's cameras, keypads and tripwires — built after the doors (a keypad hangs on one) and before the
   *  authored switch states are captured (a camera / an emitter is a light target like any fixture: OCP, a round, the mains) */
  devices!: Devices;
  /** DESTRUCTION (game/destruction.ts, STATUS stage 3b): what sustained fire does to the office behind `tune.chaos` — paper stacks turned to fluttering sheets, dust puffs into the
   *  smoke solver, damage decals, dying screens, desk clutter and ceiling tiles as capped rigid debris (game/debris.ts); built after the targets and devices (its index reads them),
   *  ticked after the props, its chunks in the frame's dynamic boxes, reset with the level */
  destr!: Destruction;
  /** WIND (game/wind.ts): the building's air as one analytic field — the level's HVAC vents, the storm outdoors, the gust through an open exterior door — handed each frame
   *  to the GPU particles (paper trembles and slides under a diffuser, dust rides it) AND the smoke solver (a plume under a vent bends; the guards' sight lines march that
   *  same density); built after the doors, ticked after the weather; `tune.wind` 0 = still air, the game as it was */
  wind!: Wind;
  /** THE WEATHER'S DUST IN THE ROOMS (game/airDust.ts): a picked weather's dust / fog carried in under the roofs at open doors and blown walls — one field over the plan
   *  for the picture (the volumetric pass) and the men's eyes (weather.ts airTrans); built after the doors, ticked after whatever breaks; no weather picked = inert */
  airDust!: AirDust;
  /** MOTHS (game/moths.ts): a dozen fluttering specks round the lit sodium lamps at night; ticked after the wind, their boxes into the frame's dynamics */
  moths!: Moths;
  /** GLASS BREAKING (game/glassbreak.ts): the panes' impact lists / Voronoi cells / dropped masks and the shards they become — always constructed (its hooks answer 'whole' for
   *  a pane never hit), inert unless tune.glassBreak (default off) AND chaos > 0 outside the tour; the renderer's half is the boot-time prelude const GLASS_BREAK */
  glassBreak!: GlassBreak;
  /** BROKEN GLASS AFTER IT LETS GO (game/shards.ts): each released fragment as rigid plates that break again on landing + 'shard' GPU particles (mids, fines, back spray,
   *  tempered dice), its landings heard, its litter crunching underfoot — inert unless tune.glassShards (default on) AND glass breaking is live */
  shards!: GlassShards;
  /** THE DIRECTOR (game/director.ts, docs/design/level-scripting.md M1): the level's script — its programs, triggers and generator beats on the game clock, the showcase
   *  plumbing — built last in the constructor from level.script (none = no programs, as on every shipped level: the game exactly), ticked in update() right
   *  before tacticsTick, read by main.ts through `frame` (the pinned look-at, caption, veil) while a showcase program has the frame */
  director!: Director;
  /** the night breach playtest (nightbreach.ts; ?nightbreach / native --nightbreach / __nightbreach): Sam leading two AI operatives against three men barricaded in the
   *  break room. Off — the game exactly — until its start(); ticked right after the Director */
  nightBreach!: NightBreach;
  /** the quiet mission (quiet.ts): the level's own night with a thing to take and ways out, off the level's data — inert until started */
  quiet!: QuietMission;
  /** a training lesson's steps (lesson.ts): reads the game, writes nothing of it; inert on a level without the block */
  lesson!: Lesson;
  /** a tutorial mission's frame over the lesson (rails.ts): locked actions, cues to the level's script, authored checkpoints, the sky seat; inert on a level without a lesson.rails record */
  rails!: Rails;
  /** a room clear against a clock (par.ts): reads the game, writes nothing of it; inert on a level without a scenarios.par block */
  par!: Par;
  /** how the run went, said once it is over (verdict.ts): reads only — the end card's record */
  verdict!: Verdict;
  /** the man a snatch level's team must take alive (snatch.ts): inert without the level's scenarios.snatch block */
  snatch!: Snatch;
  /** a defuse mission's charges and their one clock (defuse.ts): an overlay on a room clear; inert on a level without a scenarios.defuse block */
  defuse!: Defuse;
  /** the room clear (roomclear.ts; ?roomclear / native --roomclear / __roomclear): the night breach on a structure of four held rooms, with per-room cleared state
   *  and two ends. Off until its start(); ticked right after the night breach */
  roomClear!: RoomClearScenario;
  /** Sam's live orders to the operatives on his side (orders.ts; __orders): the command menu (X / the middle button: up until a row is picked), B the quick order, T who takes them — inert with no operative on the floor */
  orders!: SquadOrders;
  /** FOG OF WAR (fogofwar.ts): what nobody on Sam's team sees is left out of the picture — inert until its switch is on */
  fogOfWar!: FogOfWar;
  /** the room fight (roomfight.ts): hostile and operative units perceiving and fighting on their own read — inert while none stands */
  fight!: RoomFight;
  /** what the defenders decide, told to the player: the radio strip's rows and the cue lines (cues.ts — it only reads the game) */
  cues!: Cues;
  /** the squad's own lines where the player cannot see the man who says them, and a teammate down (squadnet.ts — it only reads the game) */
  squadNet!: SquadNet;
  /** unasked cover (cover.ts): the openings round the squad, dealt to the men who follow or hold with nothing ordered to watch */
  cover!: Cover;
  /** entry points off uncleared openings (entrypoints.ts): which side of which opening the squad has been on, and the door tools' points moved off the rest */
  entry!: EntryPoints;
  /** which rooms the team has been in (cleared.ts): the way an ordered walk takes */
  cleared!: ClearedRooms;
  /** the hostage rescue playtest (rescue.ts; ?rescue / native --rescue / __rescue): two hostages in the manager's office, a captor on a clock, Sam and the pair
   *  flowing down the corridor past rooms they have not cleared — inert (tick returns on its first line) until started */
  rescue!: Rescue;
  /** the squad's door tools (doortools.ts; __doortools): open / bang / charge / clear-from-outside rows on the command menu, the per-run counts — inert with no operative on the floor */
  doorTools!: DoorTools;
  /** quiet orders for one partner (pairorders.ts): a person as a target, 'take him on your mark', 'hold in the dark' — inert with its switch off */
  pair!: PairOrders;
  work!: WorkThings;   // things a teammate can be sent to work (workthings.ts)
  wallCharge!: WallCharge;   // the door charge's twin on a partition wall (wallcharge.ts)
  /** each man of a room entry on a real path through the door (doorpath.ts; DOORPATH.on — off: nothing of it runs) */
  doorPath = new DoorPath(this);
  /** checkpoints (game/savestate.ts, STATUS G5): the autosave triggers + gates ticked at the end of update(), the slots in localStorage (the harness hands it a
   *  Map), the cards' 'restart from checkpoint', export / import — saveState / loadState themselves are plain functions over the Game */
  saves = new Checkpoints();
  rackTargets: LightTarget[] = [];   // the mission rack's LED / glow switchables: forced dark once the drive is out
  /** the analytic lights registered for emissive MARKINGS at construction (the vending windows): for the panel / __mark.lights / the probes */
  markLights: { target: string; box: number; face: string; pos: Vec3; I0: number; area: number; meanL: Vec3 }[] = [];
  tune = { guardWalk: 1.15, guardInvestigate: 1.75, guardChase: 2.7, playerWalk: 1.55, playerSprint: 4.7, playerCrouch: 1.3, playerLight: 60, flashIntensity: 70, flashInner: 7, flashOuter: 19, detectRate: 1.6, ocpDuration: 9, ocpNotice: 'glance' as 'glance' | 'investigate', visSlope: 0.2, visFloor: 0.03,
    floorMaterials: true,       // floorMaterials: footsteps take the floor they land on into account (floor.ts: carpet quieter, stone louder — for the mixer, the guards' ears and the meter alike); off = every floor is lino, the A/B seam
    muzzleDiscipline: true,     // muzzleDiscipline: while Sam holds a living man nobody who can see it fires — weapons up, talking, circling, never a round until the shield is gone (guards.ts standoffAlert); off = the flank rule fires as before, the A/B seam
    suppression: true,          // suppression (suppression.ts, docs/internal/sc20k-design.md §4): rounds close to a man put his head down — the guards flinch, shoot worse and later, crouch behind what they stand at and shift to cover under sustained fire; Sam's own rounds open up under theirs. Off = the scalar is still integrated and printed, nobody reacts to it and Sam's rounds go where they are sent (the A/B seam; with no rounds in the air nothing differs either way)
    carbineGuards: 'none' as CarbineDeal,   // rifles (docs/internal/sc20k-design.md §3): who carries the AKS-74U-style carbine instead of torch + sidearm — 'none' = today's floor exactly, 'reyes' = the lobby / break-room man, 'all'. The deal is the weapon (update(): Guard.carbine + Guard.weapon swapped to the aks74u row and back): short bursts, thirty to a box, the fireball, the rifle tumbling out of a dying hand; read through guards.ts rigOf / burstTrigger
    suppressFirst: true,        // rifles: a rifleman's OPENING burst at a Sam ten metres or more off is laid the better part of a metre beside him — into the partition, the jamb, the wall — not on him: the fairness valve of a one-shot game meeting automatic fire, and what trained men do (fix, then work); every burst after it is aimed. Off = aimed from the first (guards.ts burstTrigger)
    tracers: true,              // rifles (lane R6, tracers.ts): the carbine's every-third round and the last three of its box are tracers — a streak travelling muzzle → impact over a few frames with a small warm light on its head (the wall it passes, the haze it crosses), an ember where it stops in geometry. Off = combat.ts fireWeapon never calls the tracer code: the round is exactly what it was (the A/B seam; pistols have none either way)
    aimModel: true,             // the aim-settle model (aim.ts, playtest 08-08 'guards have really good aim'): both sides take time to line up a shot (a guard's first round waits ~0.7 s of track after his reaction beat and his early rounds go wide), pay for a target crossing their view and pay more for their own feet moving — a closing guard brakes to a standstill for each shot, Sam's ring blooms while he moves and tightens as he holds still. Its numbers: AIM in aim.ts / Tab ▸ Sandbox ▸ aim rows (kept per machine). Off = every round exactly what it was: the guards' rows in fireWeapon, Sam dead-on (the A/B seam; tools/qa weapons-identity is frozen on it)
    teams: true,                // sides for the AI (teams.ts / guards.ts spawnUnit · engage — the 'Breach' showcase's operatives clearing a room of hostiles): on by default because with no unit spawned nothing of it runs — the staff's foe is Sam by construction and every seeded QA run is byte for byte the game it was (tools/qa teams-identity); off = spawnUnit refuses, so no unit can ever exist: the kill switch, not an A/B
    needs: true,                // needs-driven patrol variation (needs.ts, STATUS E12 c): each man on nights carries two or three slow needs — coffee, a smoke, water, a stretch — that take him off his route for a fixed, telegraphed spell (watch check + glance 20 s out, said to his partner or the net at 12, neck rub + turn at 5, then the walk, the dwell, the walk back, 'right, where was I'); one man away at a time, calm floor only, broken off by anything that reaches him. Its numbers: NEEDS in needs.ts / Tab ▸ Sandbox ▸ needs rows (kept per machine with this switch). Off = the patrol exactly as it was (tools/qa needs-identity)
    tactics: true, flankWait: 6, loneWait: 8, doorDanger: 25, doorWait: 6,
    chaos: 0.5,                 // DESTRUCTION (destruction.ts): 0 = the game byte for byte as it was; up to 1 = how readily sustained fire scatters paper, raises dust, knocks things off desks and drops ceiling tiles — every path capped whatever it says (kept per machine: loadChaos)
    wind: 1,                    // WIND (wind.ts): the master 0‥1 on every source of moving air — the vents, the storm outdoors, the gust through an open exterior door — that the particles and the smoke solver both take; 0 = still air, the game byte for byte as it was (kept per machine with the wind rows: loadWind; tools/qa wind-identity)
    moths: true,                // MOTHS (moths.ts): moths round the lit sodium lamps at night (kept with the wind rows)
    glassBreak: true,           // GLASS BREAKING (glassbreak.ts): panes crack and come apart where the rounds went — on (under glass.ts GLASSFX, the one switch over all of it; the QA harness stands it off: src/host/standup.ts); kept per machine with its knobs (loadGlassBreak); the GPU side follows at boot (main.ts → the prelude const), so a change wants a page reload to show
    glassShards: true,          // BROKEN GLASS AS SHARDS (shards.ts): what a released fragment becomes — plates + shard particles + landing sounds + litter underfoot; only ever acts while glass breaking is live, so with glassBreak off it changes nothing; off = the base's rigid shard boxes; kept per machine (loadShards)
    wallBreak: true,            // WALL BREAKING (wallbreak.ts): partitions holed / ported and cover chewed away under rounds and blasts — live only with THE ONE SWITCH on (destructionSwitch.ts) and chaos > 0
    debrisImpulses: true,       // DESTRUCTION: what already lies about is kicked again by what happens next — a stun charge throws the settled leaves back up, a round beside them scoots them, a body / boot / shoved desk twitches them (destruction.ts impulses → the GPU particles + the debris pool); off = the lane before it, byte for byte (kept with chaos)   // pursuit tactics (tactics.ts, STATUS E12 a+b): two men on one fix flank it — a presser stops short at his last corner, a flanker comes round from ≥ 90° the other way, 'set' / 'go' on the net — a lone man on an armed intruder holds an angle and calls it in instead of charging, and a doorway a colleague went down in (or rounds came through) is a kill zone nobody walks into: paths go round it, else stack, call, wait for a second man, bang or slice the pie, cross fast. flankWait: the presser's patience at his corner; loneWait: the lone man's; doorDanger: how long a doorway stays a kill zone; doorWait: how long the man on the jamb waits for his second. The four are kept per machine (loadTactics); off = the chase exactly as it was (tools/qa tactics-identity)
    // the response to going loud (game/qrf.ts, Tab ▸ Sandbox ▸ QRF rows — remembered per machine): qrf = the response team comes at all; qrfEta = seconds from the request to
    // the stair door going (called on the radio at the request, at thirty and at ten); qrfSize = men in the element (2‥4, capped by the renderer's character budget);
    // perimeter = the second tier — the compound locked down round him — at all; perimeterEta = its telegraph; perimeterSize = men on the outside posts (2‥4, spawned
    // if the budget has room, else peeled off the element leaving two inside)
    qrf: true, qrfEta: 75, qrfSize: 4, perimeter: true, perimeterEta: 45, perimeterSize: 2,
    // qrfSilent = the silent net (qrf.ts silentNet): the whole shift off the net after your gunfire was heard on it also brings the team — control's radio check first
    qrfSilent: true,
    // qrfSquad = the response team takes a room by the squad's own door and room code (qrf.ts startDrill, squadcast.ts): off = its own drill on the level's marks, as it was
    qrfSquad: true,
    // civilians (civilians.ts, Tab ▸ Sandbox ▸ civilians rows — remembered per machine): civilians = the level's cleaner / late worker are on the floor at all (off = nobody but
    // the shift: today's game byte for byte); civilianKillFails = a civilian killed by Sam's hand fails the mission there and then (off: it costs him forty points, a
    // 'civilian casualty' on the card and control's fury on the net — Chaos Theory fails some missions for it, this one prices it)
    civilians: true, civilianKillFails: false,
    // bodies found by the LIGHT on them (guards.ts bodyInView / bodyLit — review A6.2, Chaos Theory's rule; Tab ▸ Sandbox row, remembered per machine with its numbers: loadBodyLight): a body in view
    // is found only when the light where it lies reads high enough on the meter's own scale (or he is inside two metres of it), and not through a plume; off = range, cone and line alone, as before
    bodyLight: true,
    // the level-design devices (game/devices.ts, Tab ▸ Sandbox ▸ devices rows — remembered per machine): devices = cameras and tripwires sense at all (off = they are
    // drawn, pan and glow but report nothing; keypads stay keypads); lasers = the tripwires alone; cameraSuspicionSecs = lit-seconds in a camera's picture before
    // control radios it and a man is sent (a fully lit man close to fills a second a second; half-lit at range, a fifth of that); cameraAlarmSecs = lit-seconds held
    // in view before the floor goes up a step; deviceCones = each live camera throws a faint red cone into the haze (a light slot apiece)
    ...DEVICE_TUNE_DEFAULTS };

  constructor(public engine: HostApi, public level: Level, public ch: GltfCharacter, public smoke: SmokeSystemLike) {
    try { const v = parseFloat(localStorage.getItem('twopointsix.playerCrouch') ?? ''); if (isFinite(v) && v >= 0.3 && v <= 3) this.tune.playerCrouch = v; } catch {}   // the panel's crouch-speed slider is remembered per machine
    loadQrfTune(this);   // …and so are the response team's knobs (qrf.ts: on/off, ETA, size, the perimeter tier's)
    loadTactics(this.tune);   // the pursuit tactics' four knobs, kept per machine like the aim rows (tactics.ts)
    leversFog(loadTeamFeel); fogFlags(); irFlags();           // …and the room fight's feel rules a player has changed in the panel (teamfeel.ts: before the squad's systems read them)
    loadNeeds(this.tune);     // …and the needs' switch + fairness knobs (needs.ts)
    loadChaos(this.tune);     // …and the destruction lane's chaos knob (destruction.ts)
    loadWind(this.tune);      // …and the wind's master + rows (wind.ts; the moths' switch rides with it)
    loadGlassFx(); loadGlassBreak(this.tune);   // …and the glass-breaking switch + knobs (glassbreak.ts)
    loadShards(this.tune);       // …and the shards' (shards.ts)
    loadDust();               // …and the dust puffs' emit / look table (particleFx.ts DUST / DUST_LOOK; the look goes onto the particle kind once the system exists, below)
    loadDeviceTune(this);   // …and the devices' (devices.ts: on/off, the beams', the cameras' two thresholds, the cones)
    loadCivTune(this);      // …and the civilians' (civilians.ts: on/off, whether a dead civilian fails the mission)
    loadBodyLight(this.tune);   // …and the bodies-by-light switch with its bar (guards.ts)
    // (the FN2000 is always in the kit now — no per-machine loadout memory; Game.fn2000 / setLoadout stay for the harness)
    this.col = new StaticCollision(level.boxes);
    if (engine.gbuffer?.setWearMap) { const wm = buildWearMap(level, this.col.nav); engine.gbuffer.setWearMap(wm.data, wm.w, wm.h); }   // the detail layer's traffic map (render/wear.ts: the routes over the nav grid + the thresholds, the walls' feet) — the harness's engine stand-in has no g-buffer to hand it to
    this.syncSnowLook();   // a snow level's lying snow as one surface (render/snowField.ts; picture only — nothing below reads it)
    this.chars = new CharacterRenderer(engine.device, ch);
    engine.skin = this.chars;
    this.meshShadows = new MeshShadows(engine.device, ch, this.chars.jointMats, this.chars.charInsts);   // (the QA harness's fake device takes this too: the tree build is the real code, the buffers go nowhere)
    engine.setMeshShadows?.(this.meshShadows);                                     // (?.: the harness's engine stand-in has no renderer to attach to)
    try { const fit = fitRig(ch); if (ch.cast) { this.rigFits = new Map(); engine.setRigFit?.({ ...fit, byOwner: this.rigFits }); fitRigCast(ch); } else engine.setRigFit?.(fit); } catch (e) { console.warn('SDF rig: the round-cone fit failed, characters trace as untapered cones with hand radii', e); engine.setRigFit?.(null); }                                                 // the SDF character rig's radius fit (render/sdfrig.ts; the round cones are the proxy at every tier; a failed fit only loses the taper)
    if (engine.setParticles) { engine.setParticles(new Particles(engine.device, engine.sceneLayout)); applyDustLook((engine as { particles?: Particles | null }).particles ?? null); }   // GPU particles (experiment E4): only on a real Engine — the harness's stand-in has no setParticles, so every effect site there keeps to the CPU sparks (particleFx.ts gpuFx); the dust LOOK table onto the kind whether or not the switch is on yet
    attachAir(this);   // THE AIR AS A SIMULATED FIELD (airSim.ts, render/airField.ts): the page's engine gets its field once (a real device with the switch up; the harness none)
    this.probe = engine.probe?.() ?? new IrradianceProbe(engine.device, engine.sceneLayout);   // (a host that owns its probe — the native one over the shared query / answer tables — hands it here; else the WebGPU kernel)
    this.player = new Player(ch, level.playerSpawn, this.fn2000);
    // loose furniture: simulated on the CPU, emitted as dynamic boxes every frame (rendered + traced like everything else), deliberately never registered as
    // collision occluders — a chair must not hide the player, muffle a shot or dent the nav grid; guards path through props and shove them aside
    this.props = new PropSystem(level.props, this.col, (e) => this.onPropEvent(e));
    this.items = new Throwables(this.col, this.props); this.items.bog = (x, y, z) => snowBogAt(this, x, y, z);   // (… and bog down where they land in lying snow: snowBog.ts, 0 everywhere with its switch off)
      // canisters and dropped magazines bounce off (and nudge) the furniture
    this.tracers = new Tracers(engine.lights, sparkSink(this)); this.tracers.fog = { begin: who => this.fogOfWar.begin(who), done: was => this.fogOfWar.done(was), lightBy: (l, who) => this.fogOfWar.lightBy(l, who) };   // tracer streaks: their head lights live in the engine's LightSet (transient), their embers are sparks — GPU sparks while that path is on, the CPU pool's otherwise (particleFx.ts sparkSink)
    this.decals = new Decals(engine.device); engine.setDecals?.(this.decals);   // (the QA harness's engine stand-in has no renderer to hand it to: the list still fills, nothing draws)
    if (engine.settings && engine.settings.decals === false) this.decals.enabled = false;
    this.weather = new Weather(this);
    this.player.light = engine.lights.add(railLightDef(PLAYER_ID, this.tune.playerLight));
    // light targets from analytic lights + switchables
    // contactor groups restrike one after another when the mains return: stagger by order of first appearance
    const groupStagger = new Map<string, number>(); const staggerOf = (grp: string) => { if (!groupStagger.has(grp)) groupStagger.set(grp, groupStagger.size * 0.45 + simRandom() * 0.5); return groupStagger.get(grp)!; };
    const lightDefs = new Map(level.lights.map(d => [d.name, d]));
    for (const l of engine.lights.lights) {
      if (l.ttl >= 0 || l.kind === 2 || l.group === 'player' || l.group === 'flashlights') continue;
      const mains = lightDefs.get(l.name)?.mains !== false;
      this.targets.push({ name: l.name, group: l.group, kind: 'analytic', pos: v3.copy(l.pos), light: l, boxes: l.fixtureBox >= 0 ? [l.fixtureBox] : [], baseEmissive: l.fixtureBox >= 0 ? v3.copy(level.boxes[l.fixtureBox].emissive) : [0, 0, 0], baseIntensity: l.intensity, on: l.enabled, broken: false, disabledUntil: -1, fluorescentFlicker: false, factor: 1, mains, stagger: staggerOf(l.group), interactive: true });
    }
    for (const sw of level.switchables) {
      const b = level.boxes[sw.boxes[0]];
      this.targets.push({ name: sw.name, group: sw.group, kind: 'emissive', pos: v3.copy(b.c), boxes: sw.boxes, baseEmissive: v3.copy(sw.baseEmissive), baseIntensity: 0, on: sw.on, broken: false, disabledUntil: -1, fluorescentFlicker: !!sw.flicker, factor: sw.on ? 1 : 0, mains: sw.mains !== false, stagger: staggerOf(sw.group), interactive: sw.group !== 'server_leds' && sw.group !== 'server_glow' });
    }
    for (const t of carLampTargets(level.boxes)) this.targets.push(t);   // (carlamps.ts: the lamps of the level's cars and pickups, one target each — no die drawn, none on the mains)
    // flat emissive fixtures (ceiling panels, monitors, logo, TV, vending fronts, exit signs) light the scene through analytic one-sided area
    // lights; their boxes keep glowing on screen but rays ignore the emissive term (BoxFlag.AreaLit) — kills small-emitter aliasing in the cascades
    for (const t of this.targets) {
      if (t.kind !== 'emissive' || t.group === 'server_leds' || t.group === 'emergency' || t.group === VEHICLE_GROUP) continue;   // (a vehicle's lamp keeps the picture it had: no area light is stood in for it)
      for (const bi of t.boxes) {
        const b = level.boxes[bi]; const h = b.h;
        const thin = h[0] <= h[1] && h[0] <= h[2] ? 0 : h[1] <= h[2] ? 1 : 2; if (h[thin] > 0.06) continue;
        const a0 = (thin + 1) % 3, a1 = (thin + 2) % 3; const area = 4 * h[a0] * h[a1]; if (area < 0.01) continue;
        // emitting side: ceiling fixtures face down; wall/desk fixtures face whichever side is open (props are authored with the glowing face on
        // local +X/+Z of their backing, which is also the fallback when both sides look open)
        let n: Vec3 = [0, 0, 0];
        if (thin === 1) n = [0, b.c[1] > 1.5 ? -1 : 1, 0];
        else { const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw); const ax: Vec3 = thin === 0 ? [cs, 0, -sn] : [sn, 0, cs];   // box local X / Z in world
          const front = !this.col.segmentBlocked(b.c, v3.mad(b.c, ax, h[thin] + 0.35)), back = !this.col.segmentBlocked(b.c, v3.mad(b.c, ax, -(h[thin] + 0.35)));
          n = front && !back ? ax : !front && back ? v3.scale(ax, -1) : ax; }
        const e = t.baseEmissive; const maxc = Math.max(e[0], e[1], e[2], 1e-3); const I0 = maxc * area;   // radiance × area = on-axis intensity
        const light = engine.lights.add({ name: `${t.name}_area${bi}`, group: t.group, kind: 3, pos: v3.mad(b.c, n, h[thin] + 0.07), dir: n,   /* 7 cm proud of the glowing face: shadow rays stop 3 cm short of their sample (direct.wgsl shadowSample tmax), and at the old 3 cm the ray's end sat exactly ON the fixture's own box — a floating-point coin-flip that occluded whole regions of samples and drew hard arcs across a dark floor (the break-room vending fronts, 08-08) */ color: [e[0] / maxc, e[1] / maxc, e[2] / maxc], intensity: I0,
          range: clamp(Math.sqrt(I0 / 0.0015), 3, 26), innerDeg: 0, outerDeg: 90,   /* range = where the panel has fallen to ~nothing (0.0015 W/m²): the old 8 m cap cut a visible circle into dark neighbouring rooms; the scoring loop is analytic so the extra reach costs no rays */ radius: Math.max(0.1, Math.min(Math.sqrt(area / Math.PI), Math.min(h[a0], h[a1]) + 0.02))   /* the emitter disc never wider than the fixture's own short side: an equal-AREA disc overhangs a rectangle's short edges, and an overhang that pokes into the wall / cabinet beside the fixture is a slice of permanently 'occluded' samples (dimming + grain everywhere the light reaches) */, volumetric: 0.0, /* diffuse panels: no haze beams (cost) */ owner: 0, enabled: t.on, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: I0, broad: true });
        (t.areaLights ??= []).push({ light, base: I0 });
        b.flags |= BoxFlag.AreaLit;
      }
    }
    // EMISSIVE MARKINGS ARE LIGHTS (scene/markings.ts; the one-model rule): a switchable box's marking with `emit` — the vending machines' product windows — registers a one-sided
    // rectangular emitter over its rect exactly as an emissive fixture box does above (radiance × area = on-axis intensity, the disc never wider than the rect's short side, 7 cm proud
    // of the face), rides the same target's supply (t.areaLights → lighting.ts; the drawn emission follows Box.markGain), and is marked area-lit so a reflection ray takes only
    // emitTraceK of its traced radiance (the analytic image carries the rest — one window either way). LED rows and UI bars are too small / dim to light anything (< 0.01 m² or an
    // intensity under MARK_LIGHT_MIN_I0): they glow on screen and in mirrors only, as the raster-only LED nubs they replace did. Skipped with markings off at boot (?nomarkings).
    if (engine.settings?.markings !== false) for (const t of this.targets) {
      if (t.kind !== 'emissive' || t.group === 'emergency') continue;
      for (const bi of t.boxes) {
        const b = level.boxes[bi]; if (!b.marks?.length || b.rot) continue;
        const mkTexel = engine.settings?.markingTexel ?? MARKING_TEXEL;   // (the level's base texel: main.ts hands Level.markTexel to the settings before the Game is built)
        b.marks.forEach((m, k) => {
          const st = markStats(m, b.albedo, mkTexel);
          if (!st.emask) return;
          const maxc = Math.max(st.meanL[0], st.meanL[1], st.meanL[2]);
          const I0 = maxc * st.area;                                        // radiance × area = on-axis intensity, as for the fixture boxes above
          if (st.area < 0.01 || I0 < MARK_LIGHT_MIN_I0) return;             // LED rows, UI bars, buttons: they glow, they light nothing (the dimmest fixture light on the floor is an exit sign at ≈ 0.46)
          const R = markWorldRect(m, b.c, b.h, b.yaw, mkTexel); const n = R.n;
          const light = engine.lights.add({ name: `${t.name}_mark${bi}_${k}`, group: t.group, kind: 3, pos: v3.mad(R.centre, n, 0.07), dir: n, color: [st.meanL[0] / maxc, st.meanL[1] / maxc, st.meanL[2] / maxc], intensity: I0,
            range: clamp(Math.sqrt(I0 / 0.0015), 3, 26), innerDeg: 0, outerDeg: 90, radius: Math.max(0.1, Math.min(Math.sqrt(st.area / Math.PI), Math.min(R.hu, R.hv) + 0.02)), volumetric: 0.0, owner: 0, enabled: t.on, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: I0, broad: true, markRef: bi < 4096 && k < 4 ? (bi << 2) | k : undefined });   // (markRef: the reflection pass textures this light's analytic highlight with the window's own pattern)
          (t.areaLights ??= []).push({ light, base: I0 });
          AREA_LIT_MARKS.add(m); this.markLights.push({ target: t.name, box: bi, face: m.face, pos: v3.mad(R.centre, n, 0.07), I0, area: st.area, meanL: st.meanL });
        });
      }
    }
    if (this.markLights.length) engine.world.repackMarkings?.();   // (the area-lit bit reaches records packed before the lights existed — the harness's stand-in world has no table)
    for (const b of level.beacons) level.boxes[b.box].flags |= BoxFlag.AreaLit;   // dome glow is screen-only; the beam is the spot light
    // mains breaker (OCP → temporary blackout, bullet → permanent) and the emergency beacons it brings up (each beacon light is slaved to its dome fixture)
    this.targets.push({ name: 'breaker', group: 'mains', kind: 'breaker', pos: v3.copy(level.breaker.pos), boxes: [level.breaker.boxes[1]], baseEmissive: [0.3, 4, 0.6], baseIntensity: 0, on: true, broken: false, disabledUntil: -1, fluorescentFlicker: false, factor: 1, mains: false, stagger: 0, interactive: true });
    level.beacons.forEach((b, i) => {
      const target = this.targets.find(t => t.kind === 'emissive' && t.boxes.includes(b.box));
      if (!target) throw new Error(`beacon ${i}: no switchable owns box ${b.box}`);
      const light = engine.lights.add({ name: target.name, group: target.group, kind: 1, pos: v3.copy(b.pos), dir: [1, 0, 0], color: [1.0, 0.22, 0.06], intensity: 55, range: 14, innerDeg: 9, outerDeg: 24, radius: 0.06, volumetric: 1.0, owner: 0, enabled: false, fixtureBox: -1, flicker: 0, ttl: -1, age: 0, peakIntensity: 55 });
      this.beacons.push({ light, phase: i * 1.7, target });
    });
    // reach masks (render/reach.ts): every static interior light the level built — fixture area lights, analytic lamps, the beacon spots — gets the set of
    // 1 m cells it can possibly light past the full-height walls (street lamps included); torches, flashes, the rail light and the moon keep the all-ones
    // mask. Built once here (a few tens of ms), consulted per pixel by the direct pass and per secondary vertex by directIrradiance.
    { const t0 = performance.now(); const solid = buildWallRaster(engine.world.statics, level.doors.map(d => ({ hinge: d.hinge, closedDir: d.closedDir, width: d.width }))); const interior = buildInteriorCells(engine.world.statics); let n = 0, cells = 0;
      this.reachSolid = this.reachSolidBoot = solid;
      for (const l of engine.lights.lights) {
        if (l.ttl >= 0 || l.kind === 2 || l.group === 'player' || l.group === 'flashlights') continue;
        this.reachLights.push(l);   // transient / the moon / lights that MOVE (Sam's rail light — parked at y −10 until drawn — and the guards' torches, were they added yet): anywhere. Exterior lamp heads above the roof DO get a mask (they enter the building only through its openings, and indoors they were the worst leader-slot thieves of all) — but only its interior cells (reach.ts)
        l.reach = reachMaskFor(solid, l.pos, l.kind === 3 || l.kind === 1 ? l.dir : [0, 0, 0], l.radius, interior); n++; cells += reachFraction(l.reach);
      }
      this.reachInterior = interior;
      for (const l of engine.lights.lights) if (l.kind === 2) this.buildDirReach(l);   // the moon: which indoor cells see the sky its way at all (used by the ReSTIR estimator only — lights.ts dirMasks)
      this.reachStats = wallClock({ lights: n, meanFraction: n ? cells / n : 1, ms: performance.now() - t0 }, 'ms'); }
    // doors: leaves are dynamic occluders for sight / sound / projectiles (collision layer)
    this.doors = new Doors(level.doors.map(d => ({ ...d, albedo: d.exterior ? [0.2, 0.22, 0.25] as Vec3 : undefined })), (e) => this.onDoorEvent(e));
    this.props.doorways = this.doors.list.map(d => ({ cx: d.frameCentre[0], cz: d.frameCentre[2], ux: Math.cos(d.def.closedDir), uz: Math.sin(d.def.closedDir), half: d.def.width / 2 - 0.02 }));   // (a door frame guides shoved furniture through: props.ts doorways — half the air between the frame's stops)
    nameDoors(level, dialogue.isOffice(level), this.doors.list);   // what a door with a shorthand id is CALLED, by the rooms it joins (doornames.ts; read only while the dialogue pass is on)
    this.doorDeals = dealSwings(level, this.doors, this.col.nav);   // the side each leaf opens into (doors.ts DOORWAY; doorswing.ts: into the room it serves) — geometry only, no dice
    this.doors.staged = () => this.touring;   // (DOORSTAY: a showcase's choreography keeps the closers it was written against)
    this.col.dynamicBoxes = this.doors.leafBoxes();
    this.doors.man = who => doorMan(this, who);   // (doorthrow.ts: whose man, folded, braced, calm)
    this.doors.standable = (x, z, r) => { const q: Vec3 = [x, 0, z]; this.col.collideCircle(q, Math.min(r, 0.3), 0.2, 1.5, 1); return Math.hypot(q[0] - x, q[2] - z) < 0.02 && !this.col.clampToWorld(q, 0.3); };   // (doors.ts DOORTHROW: floor for a body a leaf would carry there — the walkers' own radius against the statics)
    this.doors.settle = p => settleSpot(this, p);   // (doors.ts DOORWAY.solid: where the statics let a man a pulled leaf moved stand)
    this.doors.blaster = (at, tearM, who) => doorBlast(this, at, tearM, who);   // the doors' side of a blast (doorblast.ts): a leaf inside its reach comes off its hinges
    // …and where the build carries the destruction goal's change feed, a torn leaf is a row in it (kind 'door': ONE feed of what the level no longer is)
    this.doors.onTorn((d, who, cause) => {
      const c = d.frameCentre, r = d.def.width / 2 + 0.1;
      (this.destr as unknown as { walls?: { note?: (row: object) => unknown } }).walls?.note?.({ kind: 'door', cause, id: this.doors.list.indexOf(d), name: d.def.name,
        pos: [c[0], c[1], c[2]], rect: [c[0] - r, c[2] - r, c[0] + r, c[2] + r], opened: [], walkable: true, sight: true, dead: true, who });
    });
    this.devices = new Devices(this);   // cameras + emitters join `targets` (before initialOn below captures the authored switch states); a keypad finds its door
    // guards
    const tints: Vec3[] = [[0.42, 0.36, 0.25], [0.3, 0.34, 0.4], [0.38, 0.28, 0.28]];
    level.routes.forEach((r, i) => {
      const fl = engine.lights.add(torchLightDef(`flashlight${i}`, 10 + i, this.tune.flashIntensity, this.tune.flashInner, this.tune.flashOuter));
      this.guards.push(new Guard(ch, 10 + i, r, i, fl, tints[i % tints.length]));
    });
    openingStart(this);   // the night's opening (opening.ts): a man whose route starts on top of the way in is found down his beat instead — nothing with OPENING.on off
    { const n = level.mission.rack.index; this.rackTargets = this.targets.filter(t => t.name === `rack${n}_leds` || t.name === `rack${n}_glow`); }   // what goes dark when the drive comes out (level.ts "server room")
    this.destr = new Destruction(this);   // the destructible statics indexed by shape (paper stacks, screens + housings, desk clutter) — after the targets and devices exist: a lit screen dies through its target
    this.glassBreak = new GlassBreak(this);   // glass breaking (glassbreak.ts): attaches its cell-table / open-cell / walkable hooks to the world and the collision; its shards go into destr's debris pool — inert until tune.glassBreak
    loadGlassPen(); this.col.glassPen = { live: () => glassPenLive(this), passes: (a, rd, panes, energy) => shotPasses(this, a, rd, panes, energy) };   // rounds through glass (glasspen.ts): the line of FIRE asks the round's own toll at each pane — behind GLASSPEN.on (off: shotBlocked is the solid walk it was)
    bootBars(this);   // a window's bar breaks from one round (winbars.ts): the line of fire's own question and the blasts' call list — nothing while WINBARS.on is off
    this.shards = new GlassShards(this);      // broken glass after it lets go (shards.ts): takes the debris pool's glass door (and the fracture model's release hook where there is one) — inert until glass breaking is live
    GLASSPEN_HOOKS.crossed = (g, x, who) => { g.shards.crossed(x, who); };   // a round THROUGH a sheet: the exit jet off its far face (shards.ts crossed; nothing unless the falling-glass model is live)
    this.wind = new Wind(this);          // the air (wind.ts): the level's vents + the storm + a source per exterior door — after the doors exist
    this.airDust = new AirDust(this);    // the weather's dust in the rooms (airDust.ts): seeded with the doors as they stand — after the weather, the doors and the collision exist
    this.moths = new Moths(this);        // moths at the lamps (moths.ts) — after the targets (the lamps are light targets)
    this.initialOn = new Map(); for (const t of this.targets) this.initialOn.set(t, t.on);   // the level as authored, for resetLevelState() (captured here, before a tour or the panel touches a switch)
    spawnCivilians(this);   // the cleaner and the late worker on their marks (civilians.ts — after the shift, whose construction and dice they must not disturb; nothing with tune.civilians off or none authored)
    this.fogOfWar = new FogOfWar(this);         // fog of war (fogofwar.ts): inert until switched on
    this.quiet = new QuietMission(this);        // the quiet mission (quiet.ts): inert until started
    this.par = new Par(this);                   // a par clock over a room clear (par.ts): inert on a level without a scenarios.par block
    this.verdict = new Verdict(this);           // the run's verdict (verdict.ts): reads only, said once at the run's end
    this.rails = new Rails(this);               // a tutorial mission's frame (rails.ts): inert unless the level's lesson carries a rails record
    this.lesson = new Lesson(this);             // a training lesson's steps (lesson.ts): inert on a level without a scenarios.lesson block
    this.snatch = new Snatch(this);             // the man to take alive (snatch.ts): inert on a level without a scenarios.snatch block
    this.defuse = new Defuse(this);             // a defuse mission's charges (defuse.ts): inert on a level without a scenarios.defuse block
    this.nightBreach = new NightBreach(this);   // the night breach playtest (nightbreach.ts): inert until started
    this.roomClear = new RoomClearScenario(this);   // the room clear (roomclear.ts): the same playtest on a four-room structure — inert until started
    this.orders = new SquadOrders(this);        // squad orders (orders.ts): inert with no operative on the floor
    this.fight = new RoomFight(this);
    this.cues = new Cues(this); this.squadNet = new SquadNet(this);
    this.cover = new Cover(this);               // unasked cover (cover.ts): what the squad's free men watch — inert with nobody following or holding
    this.entry = new EntryPoints(this);         // entry points off uncleared openings (entrypoints.ts): inert with no squad on the floor
    this.cleared = new ClearedRooms(this);      // cleared rooms (cleared.ts): where the team has stood — the way an order walks a man keeps to it; inert with no squad on the floor
    this.rescue = new Rescue(this);             // the hostage rescue playtest (rescue.ts): inert until started
    this.doorTools = new DoorTools(this);       // (after the orders: its rows are registered on their menu)
    pairUpApply();                              // the pair's ONE switch (pairup.ts): on, its three parts are on — nothing touched with it off
    this.pair = new PairOrders(this);           // quiet orders for one partner (pairorders.ts): inert with its switch off
    this.work = new WorkThings(this);   // a teammate's hand on the breaker / the mission's thing (workthings.ts: its row on the orders' menu)
    this.wallCharge = new WallCharge(this);     // (after the door tools: it spends their charges)
    registerShutDoor(this);                     // (after the door tools: 'shut that door' stands in for their charge row on a door that stands open)
    this.director = new Director(this, level.script ?? null);   // the level's script: its define pass run and linted against this level here (nothing of the world touched); programs start on demand
  }

  /** the showcase tour flips this so its own plumbing (teleports, resets) stays out of the log while guard barks still show */
  quietUtility = false;
  /** tour seam: a beat that stages the mission itself (the drive pull) sets this so the stage machine, the rack marker and the objective line run under
   *  the puppet — the debrief tallies still stay off (missionLive), so nothing the tour does counts as the player's run */
  missionInTour = false;
  msg(text: string) { this.messages.push({ text, t: this.time }); if (this.messages.length > 5) this.messages.shift(); this.cues?.raw(text); }
  say(g: Guard, text: string, radio = false, force = false, row = true) { return say(this, g, text, radio, force, row); }
  viewProj: Float32Array | number[] | null = null;
  note(text: string) { if (!this.quietUtility) this.msg(text); }   // utility / sandbox confirmations

  private onDoorEvent(e: DoorEvent) {
    if (e.who === PLAYER_ID) this.player.noise = Math.max(this.player.noise, e.level);
    switch (e.sound) {
      case 'creak': this.audio.play('doorCreak', e.pos, 0.5 + 0.5 * e.level / 0.3); break;
      case 'bang': this.audio.play('doorBang', e.pos, 0.9); break;
      case 'latch': this.audio.play('doorLatch', e.pos, 0.6); break;
      case 'bash': if (e.level < 1) this.audio.play('doorBash', e.pos, 0.6, { rate: 1.15 }); else this.audio.play('doorBash', e.pos, 0.9); break;   // (under 1: a leaf ripped round by its handle at a run — sprintdoor.ts — the same slam, lighter and shorter; nothing else emits a bash under 1)
      case 'rattle': this.audio.play('doorRattle', e.pos, 0.35 + 2 * e.level); break;
      case 'pick': this.audio.play('lockPick', e.pos, 0.5, { rate: 0.9 + simRandom() * 0.25 }); break;
      case 'unlock': this.audio.play('lockOpen', e.pos, 0.4 + 1.3 * e.level); break;   // the picked cylinder snapping over (0.3 → 0.8), or a key turning it (0.12 → 0.56: the same bolt, drawn gently)
      case 'kick': { this.audio.play('doorBash', e.pos, 1.0, { rate: 0.9 }); this.audio.play('lockBreak', e.pos, 0.95);   // the slam of the leaf, lower and harder than a shoulder, under the keep splintering out of the jamb
        const kicker = e.who === PLAYER_ID ? this.player.char : this.guards.find(x => x.char.id === e.who)?.char; kickDustFx(this, e.door, kicker?.pos ?? e.pos); if (e.door.lockBroken) lockSplinterFx(this, e.door, kicker?.pos ?? e.pos); this.destr?.thud(e.pos, 1.2, e.who); break; }   // …and the plaster and splinters that come out with it (GPU particles; nothing with them off), and the litter at the threshold jumping with the slam (destruction.ts impulses, behind chaos)
      case 'thud': this.audio.play('doorBash', e.pos, 1.0, { rate: 0.8 }); if (e.who === PLAYER_ID && !this.player.kick?.tool) this.msg('it opens toward you, so the frame took the kick. that was loud'); break;   // a boot at the face a shut door opens toward (doors.ts DOORWAY.frameHolds): the slam of it, nothing splintered
      case 'clang': this.audio.play('doorBash', e.pos, 1.0, { rate: 0.7 }); this.audio.play('stairDoor', e.pos, 0.55, { rate: 1.3 }); if (e.who === PLAYER_ID) this.msg("it's a steel fire door, so it won't give. that was loud"); break;   // a boot on the steel stair door (doors.ts DoorDef.steel): the ring of it, no keep to splinter
    }
    // heard (guards.ts hearingCheck): a kick is its own kind — floor-wide, answered like a shot; everything else is a 'door' noise with a level, placed at the leaf (the
    // clang of a boot on steel that held is a slam's worth of door noise: the men within earshot come and look, the floor is not told 'someone's inside')
    this.events.push({ kind: e.sound === 'kick' ? 'kick' : 'door', pos: [e.pos[0], 0, e.pos[2]], time: this.time, loud: (e.sound === 'bash' && e.level >= 1) || e.sound === 'kick' || e.sound === 'clang' || e.sound === 'thud' || (e.sound === 'bang' && e.level > 0.6), level: e.level, who: e.who });   // (a bash under 1 is a leaf ripped round by its handle at a run — sprintdoor.ts — a door noise at its level, not the slam; every other bash is emitted at 1)
  }
  private rolls: Roll[] = [];
  private rollSeq = 0;
  /** The rolling chairs' voices, once a step right after the props have moved. A chair the props call rolling gets ONE voice (audio.ts `follow`) from the step it is
   *  seen to MOVE — its real displacement over the step, not its velocity: a chair pinned against a desk keeps its velocity and its `rolling` word and goes nowhere —
   *  until it has not moved for `grace` seconds (so a stop and a start a few frames apart are one roll), is gone, or the clock has gone back under it (a load). The ask
   *  hangs on the game's state alone, so a muted page and a replay make the same asks; nothing here is read by the simulation and no die is drawn. */
  private rollTick(dt: number) {
    const R = this.rolls; if (!R.length) return;
    for (let i = R.length - 1; i >= 0; i--) {
      const r = R[i], p = r.p, here = this.props.props.includes(p);
      let v = here && dt > 0 ? Math.hypot(p.x - r.x, p.z - r.z) / dt : 0; if (!Number.isFinite(v)) v = 0;
      r.x = p.x; r.z = p.z; r.k = Math.min(1, v / ROLL_VOICE.fullV);
      if (here && p.rolling && v > ROLL_VOICE.minV) {
        r.moveT = this.time;
        if (!r.voice) { const tok = r.voice = ++this.rollSeq, at: Vec3 = [p.x, 0.05, p.z];
          this.audio.play('chairRoll', at, ROLL_VOICE.gain, { follow: () => { if (r.voice !== tok) return null; at[0] = p.x; at[2] = p.z; return { pos: at, k: r.k, t: this.time }; } }); }
      } else if (r.voice && (!here || this.time - r.moveT > ROLL_VOICE.grace || this.time < r.moveT)) r.voice = 0;
      if (!r.voice && !(here && p.rolling)) R.splice(i, 1);
    }
  }
  /** Furniture noise: a scrape / caster rattle when something is set going, a hollow knock when it hits a wall, another prop or takes a round.
   *  Heard like door sounds (level 0..1, blamed on whoever moved it — guards ignore each other's clumsiness). */
  private onPropEvent(e: PropEvent) {
    // a castor chair coasting (props.ts CASTOR) is voiced by rollTick, not from here: nobody hears it and no die is drawn — the game is the same game with or without
    if (e.sound === 'roll') {
      if (e.roll === 'start' && !this.rolls.some(r => r.p === e.prop)) this.rolls.push({ p: e.prop, x: e.prop.x, z: e.prop.z, k: 0, moveT: -1e9, voice: 0 });
      return;
    }
    if (e.who === PLAYER_ID) this.player.noise = Math.max(this.player.noise, e.level);
    const t = e.prop.tune; const jitter = 0.95 + simRandom() * 0.1;
    if (e.sound === 'thud') { this.audio.play('propThud', e.pos, clamp(0.35 + 0.15 * e.speed, 0.3, 1), { rate: t.thudRate * jitter }); this.destr?.thud(e.pos, 0.4 + 0.3 * e.speed, e.who); }   // (…and the litter round its feet twitching with the knock: destruction.ts impulses, behind chaos)
    else if (!e.prop.rolling) this.audio.play('propScrape', e.pos, clamp(0.25 + 0.18 * e.speed, 0.25, 1), { rate: t.scrapeRate * jitter });   // (a chair already rolling on its castors is heard rolling: no scrape voiced over it — its event, below, is filed all the same)
    this.events.push({ kind: 'prop', pos: v3.copy(e.pos), time: this.time, loud: e.level > 0.7, level: e.level, who: e.who });
  }


  resetGuards() { powerOutReset(this); rescueCheckReset(this); dozeReset(this); closeReset(this); stalkReset(this); tapReset(this); this.fight?.reset(); this.cover?.reset(); this.entry?.reset(); this.cleared?.reset(); this.doorPath?.reset(); wallReactReset(this); coverfireReset(this); doorForceReset(this); resetQrf(this); resetGuards(this); resetCivilians(this); tacticsReset(this); lanesReset(this); pictureReset(this); }   // (…and the civilians: fresh ones on their marks with the fresh shift — a held / dragged one let go of first; and the tactics' memory: plans, gates and kill-zone doorways were the OLD shift's — tactics.ts, review G3.3)   // (the response team first: its men are units resetGuards despawns anyway, its radio clocks and marks are its own to drop)
  tension(theirs = false) : number { return tension(this, theirs); }
  /** one line on the alarm escalation for the panel / debugging (level, clock, episode, lockdown pair + post) */
  escalationSummary(): string { return escalationSummary(this); }
  /** panel / debug: one level up by hand (as if an alarm had just found nobody), or straight back to calm */
  escalate() { raiseEscalation(this, this.escalation >= 1 ? 2 : 1); }
  standDown() { standDownEscalation(this); }
  /** panel: 'clearing: <room> · <phase> …' while the lockdown pair clears, else '' ; and the test button — lock down and clear the room nearest the player now */
  clearingSummary(): string { return clearingSummary(this); }
  /** panel / console: one line per searching man — his plan's phase, the spot he is on, how many looked into, the best few left with their light readings
   *  (guards.ts searchSummary); and who is pieing which doorway. '' when nobody is. */
  searchSummary(): string {
    const parts: string[] = [];
    for (const gd of this.guards) { if (gd.state === 'dead') continue; const n = this.level.routes[gd.routeI]?.name ?? gd.callsign; const s = searchSummary(this, gd); if (s) parts.push(`${n}: ${s}`); if (gd.pieing) parts.push(`${n} pies the ${gd.pieing.door.def.name} door (${gd.pieing.phase})`); }
    return parts.join(' | ');
  }
  /** panel / console: one line per man in the human shield's standoff round the man Sam holds — distance, degrees off the pair's rear, the held man's clearance off
   *  his line, which way round he works, what his feet are doing, rounds fired (guards.ts standoffSummary); '' when nobody is */
  standoffSummary(): string { return standoffSummary(this); }
  /** panel / QA: what each unfound body reads on the light meter right now (guards.ts bodyLightSummary) */
  bodyLightSummary(): string { return bodyLightSummary(this); }
  /** panel / console: everybody's suppression — Sam's scalar, then every living man with anything on him: his scalar and what it has him doing (flinching, head
   *  down and for how long, shifting to cover, holding it) — or the nearest man at rest (suppression.ts suppressionSummary) */
  suppressionSummary(): string { return suppressionSummary(this); }
  conditionSummary(): string { return conditionSummary(this); }
  /** panel / console: the aim-settle model — Sam's track and cone with its terms, then every alert man's (or the nearest at rest): track, Sam's bearing rate
   *  across him, his cone and its terms, whether he is braking for a shot, his last round (aim.ts aimSummary) */
  aimSummary(): string { return aimSummary(this); }
  /** panel / console: the pursuit tactics — flanking plans (who presses, who flanks, phase), lone men holding an angle, kill-zone doorways with their seconds
   *  left, men on a doorway drill (tactics.ts tacticsSummary); '' when nothing is up */
  tacticsSummary(): string { return tacticsSummary(this); }
  /** panel / console: the needs — per man his needs and their levels or the trip he is on (about to go / walking / there / coming back), the floor's slot (needs.ts needsSummary) */
  needsSummary(): string { return needsSummary(this); }
  /** panel / console: the civilians — each one's state, what frightened her, whom she is running to / has told (civilians.ts civiliansSummary) */
  civiliansSummary(): string { return civiliansSummary(this); }
  /** is this Guard record somebody standing (or lying) on the floor right now — a man of the shift / a unit, or a civilian? (the hold and the takedown ask it of the one under the arm) */
  onFloor(gd: Guard): boolean { return this.guards.includes(gd) || this.civilians.includes(gd); }
  /** panel / console: one line per man — callsign, temperament, dead / out cold if he is, and his witness record (guards.ts witnessSummary: what he has personally
   *  heard and seen this encounter). Nothing in the game reads any of it yet; it is there to be looked at while the dialogue that will is written. */
  witnessSummary(): string {
    return this.guards.map(gd => `${gd.callsign} (${TEMPERAMENT[gd.callsign] ?? '?'}${gd.state === 'dead' ? (gd.wound ? ', wounded' : isBreathing(gd) ? ', out cold' : ', dead') : ''}): ${witnessSummary(this, gd) || '—'}`).join(' | ');
  }
  /** One exchange of the interrogation with `gd` (dialogue.ts — docs/internal/grab-interrogate-design.md §4, slice 5: the engine without the grab). The man answers
   *  from his own state: what he personally saw and heard (Witness), how rattled he is, his temperament, and how far Sam has already leaned on him (Talk) — the line
   *  goes up as his bubble (or the log) with the interrogation's longer hold, and the pick comes back (text, stage, cell, and the useful thing's kind if he gave one)
   *  for whoever asked: the held man's row (player.ts askHeld — THE ANSWER half of an exchange there: Sam's own line goes up over Sam first, this runs when it
   *  ends), the sandbox button (the bare answer, at once), a mission hook later. The gate: the man in Sam's arm (player.holding) always; anybody else only for
   *  the sandbox — 'a living man within reach of a living Sam', INTERROGATE_REACH, 2 m, nothing solid between — and null otherwise. `rnd` picks within the
   *  pool (seeded by the QA harness for replayable runs; the game's own dice by default). The one thing an answer DOES, beyond being said: the man who gives
   *  the keyed door up gives his key up with it (player.ts takeKey — 'mine's on my belt', and Sam takes it). */
  interrogate(gd: Guard, rnd: () => number = simRandom): DialoguePick | null {
    if (this.player.down || gd.state === 'dead' || !(this.guards.includes(gd) || this.civilians.includes(gd))) return null;
    if (this.player.holding?.g !== gd) {   // not the man in his arm: the sandbox's reach gate
      const a = this.player.char.pos, b = gd.char.pos;
      if (v3.distXZ(a, b) > dialogue.INTERROGATE_REACH || this.col.solidBlocked([a[0], 1.0, a[2]], [b[0], 1.0, b[2]])) return null;   // in reach and nothing solid between, statics or a leaf (the takedown gate's own test): no leaning on a man through a partition
    }
    const pick = gd.civ ? civilianAnswer(this, gd, rnd) : dialogue.interrogate(this, gd, rnd); if (!pick) return null;   // (a civilian answers from her own small pool — fear, the thing or two she knows, then nothing: civilians.ts)
    say(this, gd, pick.text, false, true);   // (forced: a held man's only voice is his answers — guards.ts say drops everything else while he is held)
    if (gd.bubble) gd.bubble.dur = clamp(1.2 + 0.07 * pick.text.length, 2.5, 6.5);   // held speech runs longer than a bark's 4 s cap
    chronInterrogated(this, gd, pick.kind ?? null, pick.stageN);   // one for the debrief's timeline (who, and what he gave if anything) — ahead of the key coming off his belt, which is its own row
    if (pick.kind === 'door') takeKey(this, gd, rnd);   // the keyed door given up: the key on his belt comes off it (Player.keys), and Sam says so once the man has finished
    else if (pick.kind === 'code') { const K = this.devices.padNear(gd.char.pos); if (K) learnCode(this, K.def.name, 'told', gd); }   // the pad's digits given up: said is learned (Player.codes — devices.ts; the pad's door then offers 'enter the code')
    return pick;
  }
  /** Let go of the man in Sam's arm at once, no shove (player.ts freeHeld): Sam going down with him, a teleport, the tour taking over. He comes off it knowing everything. */
  freeHeld(why: 'shot' | 'cancel') { return freeHeld(this, why); }
  /** the living man nearest Sam, within `reach` metres (Infinity = anywhere) — the sandbox button's target, and the panel line's */
  nearestLivingGuard(reach = Infinity, foe = false): Guard | null {   // (foe: only men hostile to the player — a teammate walking behind him is nobody to lean on)
    let best: Guard | null = null, bd = reach;
    for (const gd of this.guards) { if (gd.state === 'dead' || (foe && !hostileTo(gd, 'player'))) continue; const d = v3.distXZ(gd.char.pos, this.player.char.pos); if (d <= bd) { bd = d; best = gd; } }
    return best;
  }
  /** sandbox: lean on whoever is within reach (a note if nobody is) */
  interrogateNearest(rnd: () => number = simRandom): DialoguePick | null {
    if (this.player.down) { this.note("you're down — nobody answers to a man on the floor"); return null; }
    const gd = this.nearestLivingGuard(dialogue.INTERROGATE_REACH, true);
    if (!gd) { this.note(`nobody hostile within ${dialogue.INTERROGATE_REACH} m to lean on — walk up to a living guard`); return null; }
    const pick = this.interrogate(gd, rnd);
    if (!pick) this.note(`${gd.callsign} is in reach but there is something solid between you`);
    return pick;
  }
  /** panel / console: the interrogation engine's read of the man nearest Sam (any distance) — his knowledge / agitation / temperament cell with the agitation terms,
   *  the stage the next press would be, what he has said and given, the useful thing he would give next (dialogue.ts dialogueSummary) */
  dialogueSummary(): string {
    const gd = this.nearestLivingGuard(Infinity, true); if (!gd) return 'dialogue: nobody left standing';
    const d = v3.distXZ(gd.char.pos, this.player.char.pos);
    return `dialogue ▸ ${dialogue.dialogueSummary(this, gd)} · ${d <= dialogue.INTERROGATE_REACH ? 'in reach' : `${d.toFixed(1)} m off`}`;
  }
  /** panel: the rooms still queued for the pair and the ones called clear in this lockdown lately (with how long ago) */
  clearQueueSummary(): string { return clearQueueSummary(this); }
  clearNearestRoom() { forceClear(this); }
  /** Camera follow position (player or spectated guard). */
  followPos(): Vec3 { const g = this.spectate >= 0 ? this.guards[this.spectate] : null; return g ? g.char.pos : this.rails?.look() ?? (this.orders && planLook(this.orders)) ?? this.player.char.pos; }   // (planmode.ts: with plan mode up the view follows its own point, not Sam)
  teleportPlayer(p: Vec3) { return teleportPlayer(this, p); }
  /** HUD / panel: what the player's feet are on as the hearing model has it (floor.ts — lino everywhere with tune.floorMaterials off) */
  get floorUnderPlayer(): FloorMat { return stepMat(this, this.player.char.pos); }

  /** The thud of a ragdoll's trunk / head meeting the floor (or a wall, a desk): polled after the body's update, rate-limited inside takeImpact. */
  bodyThud(c: Character) {
    const hit = c.ragdoll ? c.ragdoll.takeImpact() : 0;
    if (hit > 1.4) { const at = c.bones.spine2 ?? c.pos; this.audio.play('bodyFall', at, clamp(0.35 + hit * 0.13, 0.4, 1)); this.destr?.thud(at, 0.5 + hit * 0.15); }   // (…and the leaves he lands among jumping: destruction.ts impulses, behind chaos)
  }
  repairLights() { return repairLights(this); }
  /** Everything still in the air / in the sound queue from what just happened: fused canisters, sparks, the last half second of noises, a wind-up.
   *  Fresh guards must not inherit it (they would hear shots nobody alive fired). */
  clearAftermath() { fragReset(this); moraleReset(this); this.items.items.length = 0; this.rings.length = 0; this.shells.length = 0; this.sparks.clear(); this.tracers.clear(); clearParticleFx(this); this.moths?.clear(); this.destr?.clearMoving(); this.shards?.clear(); this.events.length = 0; if (this.player) { this.player.pendingThrow = null; this.player.throwHeld = false; this.player.throwPreview = null; } }   // (clearParticleFx: the GPU particles' windows and the cases waiting to be heard — brass from the last take does not lie in the next)
  /** The loadout toggle (start card / pause menu): the FN2000 in or out of the kit — remembered per machine and applied to the man standing there now (taken out with
   *  it in his hands or slung, he is left with the pistol selected, hands as they were). */
  setLoadout(withRifle: boolean) {
    this.fn2000 = withRifle;   // (nothing persisted: the FN2000 is always in the kit at boot — twopointsix.fn2000 was written here and read nowhere; the harness flips it live)
    const pl = this.player; if (!pl) return;
    if (!withRifle && pl.slot === 'rifle') { pl.slot = 'pistol'; if (pl.rifle.reloading) pl.char.anim.cancelReload(); pl.rifle.cancelReload(); }
    pl.hasRifle = withRifle;
  }

  /** Level as authored: every switch / group back to its initial on-off, every door back to its authored angle and lock (picked / kicked locks re-lock). */
  private initialOn: Map<LightTarget, boolean> | null = null;
  /** was this fixture's switch on in the level as authored (lightswitch.ts: what 'lights on' puts a room back to) */
  authoredOn(t: LightTarget): boolean { return this.initialOn?.get(t) ?? t.on; }
  resetLevelState() {
    if (this.initialOn) for (const [t, on] of this.initialOn) t.on = on;
    for (const d of this.doors.list) d.reset();
    this.decals.clear(); resetGlass(this); resetGlassPen(this);   // the marks go with the encounter that made them (a restart, the tour's hand-over) — and the glass's count / log of the crack stars among them (glass.ts, review U9.10)
    resetBars(this);       // …and every window's bar a round or a blast took stands again (winbars.ts) — before the destruction's own reset, like the panes
    this.glassBreak.reset();   // …and every pane is whole again (glassbreak.ts: impact lists, dropped cells, gust sources — the shards went with the debris pool above)   // (BEFORE the destruction's: the walls' nav re-bake in there must see whole panes)
    this.destr.reset();    // …and so does the destruction: scattered paper stacks / knocked-off clutter / dead screens back as authored, debris and heat gone (destruction.ts)
    this.shards.reset();       // …and no glass is pending, lying about or underfoot (shards.ts; its plates went with the debris pool, its particles with the particle system's clear)
    clearWetPrints(this);  // …and the wet-print records that pointed at some of them (wet.ts)
    clearSnowBlast(this);
    clearSnowMarks(); if (this.snowTracks) clearSnowTracks(this.snowTracks);   // …and the snow is unmarked (snowTracks.ts; the next frame hands the cleared bytes over)
    hourAfterReset(this);  // …and, the level started at another hour (hours.ts), that hour's switches over the authored ones: the outside lamps out by day
    this.airDust?.reset(); // …and the weather's dust in the rooms stands as on a fresh start: the doors and the walls are back (airDust.ts)
  }
  /** glass experiment: the panel's / console's handles */
  /** glass: star the pane under / nearest the cursor as a round would (the panel's 'crack test'; returns the pane's index or −1), and the panel's line */
  crackTest(): number { return crackTest(this); }
  glassSummary(): string { return glassSummary(this); }
  /** wet characters (wet.ts): everybody's coat / beads and whether it is raining on him, the prints and drips so far — the panel's line and __wet.summary() */
  wetSummary(): string { return wetSummary(this); }
  /** the particle-rain experiment's one line (rainFx.ts; Tab ▸ Weather) */
  rainSummary(): string { return rainSummary(this); }

  /** CLEANRESTART (cleanrestart.ts), restartEncounter's part: the clocks the last try left running, as a new Game has them, and the vents as the hour has them. */
  private cleanSlate() {
    this.alarm.raisedAt = -100; this.alarm.pos = [0, 0, 0]; this.torchOnT = -100; this.lastStingT = -100;
    gunWallFresh(this); groundFresh(this); this.wind?.fresh();
  }
  /** set by restart(), taken by the next update(): the camera's cut is put on the host's camera BEFORE that tick's record reads the view */
  private restartCut = false;
  /** THE PLAYER'S RESTART — the pause card's and the down card's buttons, the panel's, Shift+Enter, Enter when down. (Not a checkpoint's load, a recording's
   *  first frame, a show's own restore or a mission's staging: those call restartEncounter and keep their own camera and picture.) With CLEANRESTART up it is
   *  restartEncounter and, for whoever watches: the camera cut to the fresh man (the seat's cut, cmd.ts takeCut; a show's or
   *  a spectator's camera is its own) and the host told to start the picture's histories from nothing. `said`: a line about this restart itself (why a
   *  checkpoint would not load), which outlives it. Off: restartEncounter, the line said first, as it was. */
  restart(said?: string) {
    if (!CLEANRESTART.on) { if (said) this.msg(said); this.restartEncounter(); return; }
    this.restartEncounter();
    if (said) this.msg(said);   // (after it: restartEncounter takes the old encounter's lines off the HUD)
    planHome(this.orders);   // (planmode.ts: plan mode's own view starts on him again)
    if (!this.touring && !this.director?.showing && this.spectate < 0) { const lens = this.seat.cam, p = this.followPos(); lens.target = v3.copy(p); lens.desired = v3.copy(p); this.restartCut = true; CLEANRESTART_STATS.cuts++; }
    if (CLEANRESTART.picture && this.engine.restartPicture) { this.engine.restartPicture('level restarted'); CLEANRESTART_STATS.pictures++; }
  }
  /** Restart the encounter: a fresh Player at the insertion point with full kit, fresh Guards on their routes, lights repaired, the level as authored. */
  restartEncounter() { this.journal.cut('the encounter was staged again');   // (between frames — a card's restart, a show, a mission's quit — this is on no tape: an F10 recording ends whole before it and a new one is asked for; inside an update, or under a request still pending, it does nothing: journal.ts cut)
    useDice(this.dice); this.sensors.ownReset(); this.quiet?.current();
    const clean = CLEANRESTART.on;   // (cleanrestart.ts: nothing of the try that ended stands, sounds or plays on in this one — off, every line below as it was)
    if (clean) { CLEANRESTART_STATS.restarts++; CLEANRESTART_STATS.lines += this.messages.length; this.messages.length = 0; }   // (the lines of the encounter that ended go before anything below speaks: a staging's own line is this one's)
    this.quiet?.beforeRestart();   // the quiet mission, while it is up, deals this encounter's start / spot / patrol and writes them into the level BEFORE the fresh Player and Guards read it (quiet.ts) — a return on its first line otherwise
    const light = this.player.light;
    this.player = new Player(this.ch, v3.copy(this.level.playerSpawn), this.fn2000); this.player.light = light; kitFresh(this); this.player.char.update(0);   // pose + bones exist before this frame's capsule upload
    this.cues?.reset(); this.squadNet?.reset(); holdFireReset(this); resetShowWhy(this);   // (holdfire.ts: a fresh encounter — nothing has started the fight)
    dialogue.ambientRestart(this);   // (the staff's ambient chat: its first-chat clock runs from this restart, not from the page's first frame)
    this.fogOfWar?.reset();   // (fog of war: its memory of who was seen and its turn at the probe belong to the encounter that just ended)
    this.resetGuards(); if (clean) { if (this.messages[this.messages.length - 1]?.text === 'guards reset') this.messages.pop(); if (freshLights(this)) CLEANRESTART_STATS.relit++; } else this.repairLights(); this.resetLevelState(); lightSwitchReset(this); this.props.reset(); for (const r of this.rolls) r.voice = 0; this.rolls.length = 0; this.events.length = 0; this.useDoor = null; this.calledIn = false; this.stoodDown = false;   // (resetGuards also stands the floor down: escalation 0, no episode, no lockdown duties)
    // anything still in the air or still venting belongs to the encounter that just ended: an armed stun canister landing into the new one would
    // dazzle the fresh guards and alert the floor from a throw the restarted player never made, and a deployed can's 30 s screen would go on
    // degrading their line of sight (its emitter tracks the item and is priority-pinned, so dropping the item alone does not stop it)
    this.clearAftermath(); this.smoke.clearAll?.(); this.engine.hostBooks = undefined;   // (… and with that solver's smoke, every host book of what was filed with it and asked of the mixer, host/api.ts HostBooks: the open fires', fire.ts FireShown, and a smoke break's, whose rows are by a man's id and would be the fresh man's — asked for afresh on the next frame)
    this.hover = null; this.interactables = []; this.nearby = []; this.act = null;   // (like useDoor above) this frame's cursor state still names the guards / bodies of the encounter that just ended: when the restart
                                                  // came from updatePlayer (Shift+Enter), the Space handlers later in the same update() must not grab, take down or drag any of them
    if (clean) this.cleanSlate();
    this.devices.reset();                   // cameras forget what they saw, beams their trips (repairLights above has already mended any shot dead)
    this.mission = newMission(this.time);   // a fresh run: stage, clock and stats from zero (resetLevelState above has already relit the rack)
    this.chronicle = new Chronicle();       // …and an empty chronicle to go with it (the debrief's timeline, path and counters)
    this.director?.onEncounterRestart();    // a PLAY program of the level script ends with the encounter it was scripting (a showcase's own restore restarts the encounter itself and is left alone)
    this.nightBreach?.onEncounterRestart(); // the night breach playtest, while it is up, stages itself again on the fresh encounter (nightbreach.ts)
    this.rescue?.onEncounterRestart();      // …and so does the hostage rescue (rescue.ts)
    this.quiet?.onEncounterRestart();       // …and the quiet mission faces Sam as its start has him and stages the partner (quiet.ts)
    if (clean) { updateTargets(this, 0); updateFire(this, 0); }   // the lights painted as they now stand: what the next tick reads before its own paint — the reticle's rows, the men's eyes — is the fresh level, not the last try's last frame
    if (!clean) this.note('encounter restarted');   // (clean: a level just opened says nothing of how it came to be — nor of its guards, above)
  }

  setGroup(group: string, on: boolean) { return setGroup(this, group, on); }
  toggleTarget(t: LightTarget) { return toggleTarget(this, t); }
  setBlackout(seconds: number, cause: 'ocp' | 'shot' | 'debug' | 'hand') { return setBlackout(this, seconds, cause); }
  endBlackout() { return endBlackout(this); }
  lightEvent(t: LightTarget, cause: 'ocp' | 'shot' = 'shot', swAt?: Vec3) { return lightEvent(this, t, cause, swAt); }
  ocp(t: LightTarget | null) { return ocp(this, t); }
  toggleDrag(which?: Guard) { return toggleDrag(this, which); }

  // ------------------------------------------------------------ update
  /** ONE TICK, as the page, the harness and a replay call it: the host's live input, camera and view are SAMPLED into the tick's plain record (cmd.ts sampleCmd) and the
   *  simulation runs off that record alone (step). What the tick hands back for the seat's camera — the wall peek's nudge, a blast's kick, a scenario's opening cut — is
   *  copied to the host's. (The record is ONE object refilled each tick: a caller that keeps records keeps a copy or its text, cmd.ts cmdText.) */
  update(dt: number, input: Input, cam: FollowCamera, canvas: View) {
    useDice(this.dice);   // this Game's die is the one simRandom() draws for the length of its frame (null: Math.random) — with two Games in one process each rolls its own
    this.quiet.current();   // … and the module switches a quiet mission's partner run holds are THIS Game's for the frame (quiet.ts: a compare with one Game, as on the page)
    if (this.restartCut) { this.restartCut = false; const cut = this.seat.takeCut();   // a restart from outside a tick (a card's button) cut the seat's camera: taken HERE, before this tick's record reads the view, so the fresh man's first tick is aimed through the camera that is on him
      if (cut && !cam.pin) { cam.target = v3.copy(cut); cam.desired = v3.copy(cam.target); cam.rebuild(); } }
    this.journal.frameStart(dt, input, cam, canvas);   // the session journal (journal.ts): idle, a return; asked for, it takes its checkpoint and re-enters it HERE, before anything of the frame has run; recording, it files this frame's dt / camera / input and opens the sensors' frame
    this.director?.injectInput(input);   // a showcase beat's synthetic key / click from LAST frame's tick (director.ts c.press / c.click) becomes this frame's input, ahead of everybody who reads it — a return on its first line otherwise
    input.dragOff = STALK.on && STALK.drag;   // (the HOST's input, input.ts: a held press's cursor is followed off the view only while the creep reads the mouse as a stick — stalk.ts STALK.drag)
    this.director?.attach({ cam, input });   // (a showcase locks the HOST's keys and pins the HOST's camera: the director keeps those two, the step hands it neither)
    this.step(dt, this.cmdBuf = sampleCmd(this, input, cam, canvas, this.cmdBuf));
    cam.peekOffset = this.seat.cam.peekOffset; cam.kick = this.seat.cam.kick;
    { const cut = this.seat.takeCut(); if (cut) { cam.target = v3.copy(cut); cam.desired = v3.copy(cam.target); } }   // (a scenario's opening cut: the look-at snapped to its man, not flown)
    this.viewProj = cam.viewProj;   // (between ticks `viewProj` is the host's live matrix again, as it always was for whoever asks on-screen-or-not from outside a tick)
    this.rails.hostView(cam);   // (a tutorial mission staged again opens on its first view: a return on its first line off a rails level)
    this.orders.hostView(input, cam, canvas);   // (between ticks the HUD and the tools ask the menu what the LIVE cursor is on, as they always did)
  }
  /** every seat's record for one tick, in seat order — one seat today, so this is `step(dt, cmds[0])`; a list of another length is refused before anything runs */
  stepSeats(dt: number, cmds: readonly PlayerCmd[]) { if (cmds.length !== this.seats.length) throw new Error(`stepSeats: ${cmds.length} record(s) for ${this.seats.length} seat(s)`); this.step(dt, cmds[0]); }
  /** the player's seat (cmd.ts): the tick's record loaded into an Input and a camera of the game's own — what everything below reads as `input` / `cam` / `canvas` */
  readonly seat = new Seat();
  /** every seat, in order (cmd.ts): one today — `seat` */
  readonly seats: readonly Seat[] = [this.seat];
  private cmdBuf: PlayerCmd | null = null;
  /** the tick itself, off the player's plain record: no Input, no camera, no canvas of the host's. What it leaves for the seat's camera is on the seat (cmd.ts Seat: `cam.peekOffset`,
   *  `cam.kick`, `takeCut()`) for whoever hosts the picture. Reads of the seat's view inside the tick go to the record: the reticle's snaps and the order menu's cursor,
   *  the walk keys' basis, on-screen-or-not for a line (viewProj), the thunder's pan, the rain's near field, metres per pixel, a blast's kick. */
  step(dt: number, cmd: PlayerCmd) {
    if (CMDCHECK.on) { const r = checkCmd(cmd, this.seat.remote ? this.player.char.pos : null); cmd = r.cmd; if (r.fixed) { this.seat.fixed += r.fixed; this.seat.fixedCmds++; } }   // a record from anyone (cmd.ts): made one an honest seat could have sent before anything reads it — the tape below keeps what was PLAYED
    this.replayTap?.(dt, cmd);   // the replay buffer's run tape (runtape.ts): this step's dt and record, before anything of it has run — reads only
    useDice(this.dice); this.quiet.current();
    this.senseStep(dt);
    this.seat.load(cmd);
    const input = this.seat.input, cam = this.seat.cam, canvas = this.seat.canvas;
    this.rails.gate(input, cam, dt);   // a tutorial mission's locked actions (rails.ts): what the step that is up has not unlocked is out of the tick before anything reads it — a return on its first line off a rails level
    openingStart(this);   // (opening.ts: a fresh encounter made under a show's flag and handed over live gets its opening here — each man looked at once, a return otherwise)
    this.viewProj = cam.viewProj;
    this.time += dt; this.ocpCooldown = Math.max(0, this.ocpCooldown - dt); this.col.sound.tick(this.time);
    updateAim(this, input, cam, canvas);   // (builds the interaction rows too: player.ts buildInteractables)
    this.orders.input(dt, input, cam, canvas);   // the squad's command menu (orders.ts): X / B / T / the middle button, and the open menu's wheel / arrows / digits / clicks / Space / Esc taken out of the frame's input before the selector and the player read them — with no squad, one pass over the guard list and a return
    this.rails.afterOrders(input);   // (rails.ts RAILS.planDown: a plan mode that came down inside that read takes back what the gate let through for it)
    if (this.doorTools.menuKey(input)) this.player.throwEaten = true;   // (the door tools' 'frag and clear' row is on G with its page up — doortools.ts: taken here, before the player's quick-throw reads the key)
    squadSmokeKey(this, input);
    wandOrderKey(this, input);   // (a teammate's look under a door, on order: its row's key, and its lens put away when the fight or another order has him — wandorder.ts; nothing unless one is carried)
    this.doorTools.bigKey(input);   // (the big slot's 'hammer and clear' / 'shotgun and clear' row is on H with a door's menu up — doortools.ts; a flag read and a return unless a man of the squad carries one)
    if (squadThrowKey(this, input)) this.player.throwEaten = true;   // (the squad's 'throw' page is on G with a floor menu up — squadthrow.ts: frag there / bang there; a map read and a return with the switch never on)   // (the squad's 'smoke there' row is on H with a floor menu up — squadsmoke.ts: a map read and a return unless this staging's cards brought smoke)
    squad40Tick(this);   // (a teammate's 40 mm on order — squad40.ts: its row on the throws' page kept in step, a man turning to his shot; a map read and a return unless a teammate's card brought a round)
    updateInteract(this, dt, input, canvas, cam);       // the Space selector over those rows (interact.ts): tap / hold-open-release / cancel → Game.act for this frame, read below where the key used to be
    trackPlayer(this, dt);   // the aim-settle model, Sam's half (aim.ts): what the reticle is on is known now; his feet are last frame's, a frame is nothing to a 0.8 s settle — the fire sites in updatePlayer / updateHold read it below
    this.threatTick();
    updateSuppression(this, dt);   // everybody's suppression decays, and the guards' flinch / pinned edges fire, ahead of the player and the guards who read it (the rounds they fire below add to it for next frame)
    updatePlayer(this, dt, input, cam);
    samLookStep(this);   // his head on the man who matters, room for a man he passes (samlook.ts: two flag reads and a return with both off)
    if (this.rings.length) updateRings(this, dt);   // the ring airfoils in flight (launcher.ts): flown after the man who fired one this frame, so a ring meets the guards where they stood when it left — a head, a hip, a wall — before they move on below
    if (this.player.cams.length) updateStickies(this, dt);   // … and his sticky cameras (stickycam.ts)
    if (this.shells.length) updateShells(this, dt);   // … and the 40 mm rounds (he40.ts), likewise
    this.searchProbeN = 0;   // (this frame's budget of searchers' light queries starts again: guards.ts searchProbes)
    this.dealWeapons(dt);
    this.director.tick(dt, null, null);   // the level script (director.ts): its drills sequenced, triggers read off last frame's settled world + this frame's events, beats resumed, a showcase's camera pinned — before anybody moves on an order; a return on its first line when no program runs
    this.pair.input(input);        // (pairorders.ts: F is the MARK while the partner waits on it — before anybody else reads it; a return on its first line otherwise)
    this.wallCharge.input(input);   // (a set wall charge nearer Sam than any door's has his F first — wallcharge.ts)
    this.doorTools.input(input); this.wallCharge.inputAfter(input); planLate(this.orders, input);   // (planmode.ts: the word's key nobody took is kept for a chain's next pause)   // (a set door charge has Sam's F before the night breach's drill reads it — doortools.ts)
    this.nightBreach.tick(dt, input, cam);   // the night breach playtest (nightbreach.ts): Sam's F orders read, its drill sequenced, a restart under it answered by staging again — a return on its first line while it is off
    this.quiet.tick(cam);   // the quiet mission (quiet.ts): the camera put on a dealt start, its partner told to follow on the first tick the orders have him — a return on its first line while it is off
    this.roomClear.tick(dt);                 // the room clear (roomclear.ts): its rooms' cleared state and its two ends — a return on its first line while it is off
    this.rescue.tick(dt, input, cam);        // the hostage rescue playtest (rescue.ts): Sam's F, the captor's clock, the defenders getting set — before the order menu and the room fight, which move and shoot for the pair — a return on its first line while it is off
    wallReactTick(this);     // both sides react when the level breaks (wallreact.ts): the destruction feed read into the rooms, the openings and the marks men stand on — before every book below is asked; a return on its first line with nothing broken
    this.entry.tick();       // entry points (entrypoints.ts): where the squad stands is known ground — before the door tools deal an entry its points
    this.cleared.tick();     // cleared rooms (cleared.ts): the rooms the team stands in are known — before an order prices a walk
    this.doorTools.tick(); this.wallCharge.tick();   // the door tools (doortools.ts): each door order's next stage handed to its men, before the orders pose them
    rearWatchTick(this);     // the rear man covers the door behind (rearwatch.ts): a stack's spare man pinned to the open way at its back — after the door tools say whose eyes are spare, before the cover deals
    this.cover.tick();       // unasked cover (cover.ts): the openings round the squad dealt to the men following / holding — before the orders pose them; a return on its first line with no squad
    silentTick(this);        // silent or loud (silent.ts): its rows kept on the menu, a new cast stood up in its starting posture — a find and a return otherwise
    this.pair.tick(dt);      // quiet orders for one partner (pairorders.ts): its rows kept on the menu, the mark off Sam's hands — a find and a return with its switch off
    spottedTick(this);       // a silent teammate with a suspicious man about, or caught (spotted.ts; a return with its switch off)
    this.orders.tick();      // squad orders (orders.ts): each man under one of Sam's orders walked to it and posed on it, after the drills that may own him — with nobody under one, a pass over the guard list and a return
    this.doorPath.tick(dt);  // a room entry's men on their own lines through the door (doorpath.ts): after the orders have posed them, before anybody walks — a return on its first line with the switch off
    powerOutTick(this, dt);  // the lights go out and somebody goes to put them back on (powerout.ts): the defenders' word when it is due, each man out for the breaker a step on — before the room fight, which would plant a man whose leg has ended; a return on its first line with the switch off
    rescueCheckTick(this, dt);  // the rescue's men check in (rescuecheck.ts): their radio check when it is due, the man out for a silent post a step on — a return on its first line with its switch off or no rescue on the floor
    this.fight.tick(dt);   // the room fight (roomfight.ts): what every hostile / operative unit watches, fears and shoots at this frame — a return on its first lines while none stands or a show has the floor
    showWhyTick(this);   // a teammate shows why he is not acting (showwhy.ts): read off what the orders, the door tools and the room fight have just decided — his free hand and a short line, nobody's feet, gun or eyes; a return on its first line with the switch off
    moraleTick(this, dt);   // shaken (morale.ts): the blasts since last frame read for who they shook, each man's dread and rung, a broken man's sequence a step on — before anybody moves; a return on its first line with the switch off
    flinchTick(this, dt);   // flinch at close fire (flinch.ts): a green man alone kept under close fire long enough is handed to the runner below
    runnerTick(this, dt);   // drops it and runs (runner.ts): a broken man alone, dry, with an enemy in his eyes at arm's length shouts it, lets the weapon go and runs; every man in a run a step on — a return on its first line with the switch off
    darkDoorTick(this, dt);   // not in there alone (darkdoor.ts): the man called to a mate stopped at a dark doorway kept on him, a stopped man whose walk has ended let go — a return on its first line with either switch off
    netQuietTick(this, dt);   // the net goes quiet (netquiet.ts): the lines owed for a check nobody answered, a jumpy man's whip to the noise his ears counted last frame, the last man a step through his act — after the rungs are read, before anybody moves; a return on its first line with either switch off
    lanesTick(this, dt);   // a lane that cost them (lanes.ts): this frame's rounds read for what the defenders suffered and where, what one of them has had time to say, who is held at a mouth — a return on its first line with the switch off or no room fight live
    darkFoeTick(this, dt);   // an enemy on alert does not sit blind in the dark (darkfoe.ts): who knows, whose view is dark, whose lamp comes on, who walks to where he can see — after the room fight has posed its men; a return on its first line with the switch off
    nvgTick(this);         // the team's night vision (nvg.ts): who is dark, whose goggles are down — after the fight has heard this frame, before any light is posed; a return on its first line with no team or NVG.on off
    tacticsTick(this, dt);   // pursuit tactics (tactics.ts): lapse the kill-zone doorways, read this frame's rounds for them, keep the flanking plans honest and deal new ones — before anybody moves on a role; nothing with tune.tactics off
    dozeTick(this, dt);   // dozing in the dark (doze.ts): the seated men's wait clocks, the chair under them, what wakes a sleeper that is not a sound — nothing with nobody on a record
    closeSeatTick(this, dt);   // a staff man sat down on a mark (close.ts closeSeat: staged — the panel, the clip) is kept on it while calm, up when not; nothing with nobody seated
    needsTick(this, dt);     // needs-driven patrol variation (needs.ts): the men's slow needs fill, a trip under way is broken off by anything that has reached its man, a full one is dealt its trip at his waypoint — before the patrol branch runs his feet on it; nothing with tune.needs off
    fragThrowTick(this, dt); // defenders' own frags (FRAG.defenders, a room fight only): the shout, the second it takes, the throw
    fragTick(this, dt);      // a live fragmentation grenade (frag.ts): who has noticed it, the shout, and where each man in its line is going — before anybody moves
    for (const g of this.guards) updateGuard(this, g, dt);
    pictureTick(this, dt);   // each man's own picture of the fight (picture.ts): who he sees from where he now stands, whose fire he places by ear, what his net tells him — after everybody has moved; a return on its first line with its switch off
    this.doorPath.after();   // (doorpath.ts: what its gun rule lent a script for this frame's pose is taken back)
    doorForceTick(this, dt);   // an alerted man at a shut door (doorforce.ts): what each has seen and heard of an enemy at its far face fades, a sighting just lost is put behind the leaf it went behind — a return on its first line with its switch off
    coverfireTick(this, dt);   // aimed fire at breakable cover (coverfire.ts): this frame's sightings kept as what each man knows, the wall engine's change feed read, the rounds counted — a return on its first line unless its own switch is on and either the destruction switch or rounds through thin things (wallpen.ts)
    updateCivilians(this, dt);    // the cleaner / the late worker (civilians.ts): their eyes and ears (the guards' own tests), the loop, the fright, the run to a guard or a phone, what that guard then knows — after the shift has moved and heard, before the escalation reads anybody
    updateEscalation(this, dt);   // after the guards: this frame's alert states settle the episode, the level and the lockdown duties they read next frame
    updateQrf(this, dt);          // the response to going loud (qrf.ts): the trigger off this frame's alarm level / gunfire heard / bodies found, the radio telegraph, the element's script and senses — a return while idle
    this.updateDoors(dt, input);
    lensRecheck(this);   // (lighting.ts LIGHTWALL: a leaf that swung onto a man's light this frame stops it this frame; nothing with the rule off)
    irLightTick(this);   // the infrared lights on the goggles (irlight.ts): the list made again from whose are down, each posed at his brow — after everybody has moved and the leaves have swung; a return on its first line with the switch off
    updateMission(this, dt, input);   // after the guards (this frame's sightings) and the other F handlers; before updateTargets bakes the rack's switch state
    this.par.tick();        // a par (par.ts): the run's clock against this frame's orders and the room clear's end — read-only
    this.lesson.tick(dt);   // a training lesson (lesson.ts): this frame's verb, events, chronicle rows and orders against the step that is up — read-only
    this.rails.tick(dt);    // …and its frame (rails.ts): the run's start, the step that came up answered (its cue, its checkpoint, its fog) — a return on its first line off a rails level
    this.snatch.tick(dt);   // a snatch level's one man (snatch.ts): gives up, is tied, gets away — and the end that hangs on him
    this.defuse.tick(dt);   // a defuse mission (defuse.ts): the charges' one clock, Sam's own row at one, the blast at zero — a return on its first line on a level without the block
    this.verdict.tick();    // the run's verdict (verdict.ts): after every end this frame could write — read-only
    this.updateProps(dt);
    this.destr.update(dt); if (this.reachPending) this.reachTick();   // destruction (destruction.ts): the beaten-zone heat decays, the caps refill, the rigid debris tumbles / lands / sleeps (its landings are heard through 'prop' events pushed here)
    this.airDust.update(dt);   // the weather's dust in the rooms (airDust.ts): through the openings as the doors and the walls stand this frame — before the guards' eyes ask the air
    this.events = this.events.filter(e => this.time - e.time < 0.5);
    lightSwitchTick(this);   // a room's wall switch (lightswitch.ts — a return on its first line with its switch off): a defender at one puts a room back, before the fixtures are written
    updateTargets(this, dt);
    updateFire(this, dt);               // AN OPEN FIRE (fire.ts): a brazier's lamp flickered about its authored strength — here, straight behind the lamps' own paint, so every reader of this frame's lights has the same one — and its flame, embers, smoke and sound; nothing on a floor with none, or with its switch off
    updateDevices(this, dt);   // the level's cameras / tripwires / the code being keyed (devices.ts): after the targets (this frame's power / OCP / broken state) and everybody's movement
    this.weather.update(dt, cam.yaw);   // the storm (weather.ts): strokes into / out of the light set, thunder due, the wet lot, the frame's rain numbers — after the fixtures, before the meter's queries below
    takedownTick(this);                 // takedowns (takedown.ts): who is out cold and breathes — the picture's joints only
    disarmTick(this, dt);               // the grab disarms him (disarm.ts): the gun out of his hand, in Sam's, let down — nothing without a hold that began with one, or a gun still in a hand
    updateWetness(this, dt);            // wet characters (wet.ts): whoever stands under the open sky in the rain this frame soaks, everyone else dries; Sam's drips and print budget — after the weather has written this frame's rain
    this.wind.update(dt);               // WIND (wind.ts): every source's speed this frame (cycling, the mains, the gusting; the storm off the weather just written, the door gusts off the leaves just swung) → the particles' wind records + the smoke solver's block — a return at tune.wind 0
    updateAirSim(this, dt);             // THE AIR AS A SIMULATED FIELD (airSim.ts): the obstacle map when a box, a pane or a leaf has changed, and the wind's sources just written, to the engine's field — a picture only (nothing here reads it back)
    this.moths.update(dt);              // the moths' orbits (moths.ts) — after the wind that scatters them
    this.syncSnowLook();
    updateRainFx(this, dt, cam);        // PARTICLE RAIN (rainFx.ts): the near-field drop recycler + drips + the lattice's stand-back disc (frame.weatherE) — after the wind (its drops ride the same field) — a return that zeroes the disc unless settings.particleRain is on and rain is drawn
    updateItems(this, dt);
    updateGlass(this);   // glass: a stun charge beside the glazing stars the panes near it (this frame's 'bang' events, each looked at once) — and, with glass breaking on, takes cells out of them
    this.glassBreak.update(dt);   // glass breaking (glassbreak.ts): queued cells fall as shards within the frame's budget, the support pass drops the tongues left hanging, the gusts through shot-out exterior panes — nothing to do unless a pane has been hit with the switch on
    this.shards.update(dt);       // … and what let go this frame: plates that landed hard come apart, due landings tinkle / leave litter / are heard (shards.ts — nothing to do while no glass is in play)
    // characters → GPU skin instances + RT proxies
    this.fogOfWar.update(dt);   // FOG OF WAR (fogofwar.ts): who of the others the team sees this frame, now that everybody has moved — before the lists below leave the unseen out; a return on its first line while it is off
    fireDraws(this);            // … and the open fires as the picture draws them under it (fire.ts): this frame's word on each fire's lamp, not last frame's
    const all: Character[] = [this.player.char, ...this.guards.map(g => g.char), ...civiliansShown(this).map(c => c.char)];   // (civilians last: past the renderer's eight-figure shadow-capsule budget it is they who go without, never the shift — civilians.ts)
    const statured = this.stepFxAndDynBoxes(all, dt, cam, canvas);
    this.smokeWake(all);
    this.drawCharacters(all, statured);
    updateSnowBreath(this, dt);         // BREATH (snowBreath.ts): on a snow level the men's breath steams — picture only (here, after the fog of war has said who is hidden this frame), a return with SNOW_LOOK.breath off or on any other level
    updateSmokeBreak(this, dt);         // A SMOKE (smokebreak.ts): a man a level's script told to have one — his hand, the lit end, the smoke; nothing where nobody was told, or with its switch off
    this.stepSnowTracks(dt);   // boots press the snow (snowTracks.ts): everybody is posed — picture only
    this.lightMeter(dt);
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt * 3);
    this.act = null;   // (this frame's Space verb has been read by everyone who reads it)
    this.squadNet.tick();   // the squad's net (squadnet.ts): a teammate down this frame, and the click a line from off the screen arrives with
    this.cues.tick();   // the defenders' cues (cues.ts): read off the frame as everybody now stands — it writes nothing the simulation reads
    teamTallyTick(this);   // a partner's men are on the card (teamtally.ts): the defenders he put down this step, tallied as the player's are — a return on its first line while off
    this.saves.tick(this, dt);   // checkpoints (savestate.ts): the autosave triggers off the frame as it now stands, and a waiting request written once the gates pass — the last thing, so a save is the whole settled frame
    this.journal.frameEnd();     // …and the session journal closes the frame (the sensors' reads folded in, a digest on the beat) — after everything, so a digest is the whole settled frame too
    recapTick(this);             // every death explains itself (deathrecap.ts): who went down this frame and to whom, the floor's last seconds — reads only
    this.replayTap?.(dt);        // the replay buffer (replaybuf.ts): the settled frame read into its ring — reads only, after the journal has closed the frame
  }
  // ---- update()'s parts (step()'s, since update() samples the record and step() is the body): each is a run of step()'s own lines moved out whole and called where it stood, in the same order; nothing inside one was rewritten.
  /** threat proximity → how deliberately Sam moves */
  private threatTick() {
    { // threat proximity → how deliberately Sam moves (character.ts `deliberate`, eased there; presentation only — computed under the tour too, it only changes the look)
      const pl = this.player, pc = pl.char; let near: Guard | null = null, nd = Infinity, t = 0;
      for (const gd of this.guards) { if (gd.state === 'dead' || gd.held || gd.team === 'operative' || this.fogOfWar.hidden(gd)) continue; const d = v3.distXZ(gd.char.pos, pc.pos); if (d < nd) { nd = d; near = gd; } }   // (the man in his arm is not one to creep about)
      if (near && !pl.down && near.state !== 'alert') {   // the nearest living man: nothing to creep about once he is alert (he has him)
        t = 1 - smoothstep(3, 7, nd);
        if (near.state === 'suspicious' || near.state === 'search') t = Math.max(t, 0.6 * (1 - smoothstep(7, 10, nd)));   // extra care while he is looking into something
        const spots: Vec3[] = [[pc.pos[0], 0.15, pc.pos[2]], pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0])];   // the floor where he is (a patrol torch hangs pitched down: its pool is on the floor) and his chest (a raised one)
        if (this.torchOnT > this.time) this.torchOnT = -100;   // (a checkpoint loaded put the clock back: a stamp from the abandoned future is no beam on him)
        torch: for (const gd of this.guards) {   // a lit torch / weapon-light cone on him (inside its cone and 10 m, nothing solid between): half or more, held a beat past the beam moving on
          if (this.time - this.torchOnT < 1.5) break; const fl = gd.flashlight; if (gd.state === 'dead' || !fl.enabled || gd.team === 'operative') continue; const cosO = Math.cos(fl.outerDeg * DEG);
          for (const s of spots) { const to = v3.sub(s, fl.pos); const d = v3.len(to); if (d < 10 && d > 1e-3 && v3.dot(to, fl.dir) / d > cosO && !this.col.segmentBlocked(fl.pos, s)) { this.torchOnT = this.time; break torch; } }
        }
        if (this.time - this.torchOnT < 1.5) t = Math.max(t, 0.5);
      }
      this.threatProximity = t; pc.anim.deliberate = t;
    }
  }
  /** the carbine dealt by the sandbox knob, and every man's animator armed with what is then in his hands */
  private dealWeapons(dt = 0) {
    { // rifles: deal the carbine by the sandbox knob — Guard.carbine, and with it the WEAPON: a dealt man carries the AKS-74U row (weapons.ts: bursts, thirty to a
      // box, the report, the rifle that drops), a man dealt out of it his route's row again (a fresh gun either way; a corpse keeps what he died with) — and arm each
      // man's animator with what is then in his hands (guards.ts rigOf: that, or a row that is itself a long gun) — the long-gun solve, the support hand's grip point
      // off RIG.carbine, the muzzle where the prop's is (or the long-gun row's own) — before anybody is posed this frame (a held man is posed in the guards' loop
      // too); flipping the knob re-deals live. Under 'none' nothing here touches anybody: the floor is exactly what it was. A spawned unit (teams: the showcase's
      // operatives and hostiles) is dealt nothing — he carries what he was spawned with, off his own one-point route's row — and a row that is itself Sam's
      // FN2000 arms the animator's long gun the same way with the bullpup's own grip point (guards.ts rigOf 'sc20k').
      const deal = this.tune.carbineGuards; let grip: ReturnType<typeof carbineGrip> | null = null, grip20k: ReturnType<typeof sc20kGrip> | null = null, gripOwn: Record<string, { G: ReturnType<typeof modelGrip>; a: number | null }> | null = null;
      const show = this.touring || this.director.showing;
      for (const gd of this.guards) {
        if (!gd.unit) gd.carbine = deal === 'all' || (deal === 'reyes' && gd.callsign === 'Reyes');
        const want: WeaponId = gd.carbine ? 'aks74u' : (gd.route.weapon ?? 'guard9mm');
        if (gd.state !== 'dead' && gd.weapon.def.id !== want) { gd.weapon = new Firearm(WEAPONS[want]); gd.reloadT = -1; }
        if (gd.workStow) mateStowTick(this, gd);   // (workstow.ts: a gun let go of for a two-handed job comes back up once the job stops)
        if (gd.second) sideTick(this, gd, dt);   // (gunslots.ts: a teammate's sidearm goes back once nobody is in front of him)
        const long = longRigOf(gd), cb = long !== null; const an = gd.char.anim; const def = gd.weapon.def;   // (long: WHICH long gun — the FN2000 in an operative's hands has its own grip point and muzzle, guards.ts longRigOf)
        if (an.longGun !== cb) { an.longGun = cb; an.longSteady = long === 'sc20k' ? 1 : 0; gd.char.muzzleAhead = long === 'sc20k' ? sc20kMuzzleAhead() : cb && def.rig !== 'carbine' ? carbineMuzzleAhead() : def.muzzleAhead; }   // (longSteady: a man handed Sam's bullpup — the breach's operatives — carries it as player.ts armRifle has Sam carry it, the gun riding his shoulders' mean line at a run instead of pumping with the run clip's arms (character.ts LONG_STEADY); the carbine men keep theirs as the poses pass left them, 0 — carbine-probes (4) places the trigger hand by the unsteadied carriage)
        if (long === 'sc20k') an.longGrip = grip20k ??= sc20kGrip(); else if (cb) an.longGrip = grip ??= carbineGrip();
        if (gunLookOn() || gd.char.gunLook) {   // (gunlook.ts: which of his guns are drawn as models of their own — and one in his hands has its own support-hand point and its own muzzle. Nothing with the switch off)
          const had = gd.char.gunLook?.hand ?? null, look = gd.char.gunLook = gunLookOf(gd.char.gunLook, def, gd.second?.gun.def ?? null, gd.slung?.out ? gd.slung.own.def : null), m = cb ? look?.hand ?? null : null;
          if (m) { const M = (gripOwn ??= {})[m] ??= { G: modelGrip(m), a: modelMuzzleAhead(m) }; if (M.G) an.longGrip = M.G; if (M.a !== null) gd.char.muzzleAhead = M.a; }
          else if (had && cb) gd.char.muzzleAhead = long === 'sc20k' ? sc20kMuzzleAhead() : def.rig !== 'carbine' ? carbineMuzzleAhead() : def.muzzleAhead;   // (the switch put down under a man with a model in his hands: his muzzle is the stand-in's again, as the line above deals it)
          feedDeal(an, cb ? gd.weapon : null, true);   // (gunreload.ts: … and how its support hand feeds it, dealt every frame as `reloadMag` below is — a man's reload is a beat, so always as a gun run dry)
        }
        // the motion pass (character.ts MOVES — nothing reads these with it off): how drilled each side moves, and a blinded man held bent away from the charge
        an.trained = gd.team === 'operative' ? 1 : gd.trained ? 0.75 : gd.team === 'civilian' ? 0.5 : 0.12;
        swapFeed(gd, inHand(gd), !cb);   // (handwork.ts: a change between the torch and the sidearm is a move of the hand — nothing with it off)
        an.grip[1] = inHand(gd) !== null;   // (the hand pass, character.ts HAND: a patrolling man's torch hangs in a fist no layer poses — the locomotion clip's own — and that fist must stay one; fingers only, read by nothing)
        // the second pass (MOVES.reload / clutch / entry): where his magazine is, a man folded by a blast or a ring and not blind with it, a friend's back before his muzzle
        an.reloadBack = long === 'sc20k' && !GEAR.on; an.reloadMag = !(def as { pellets?: unknown }).pellets; an.clutch = gd.state !== 'dead' && this.time < gd.staggerUntil && !(this.time < gd.dazzledUntil) ? 1 : 0;
        if (MOVES.on > 0.5) {   // …and the reload HE is in, by the clock that owns it: his own beat (guards.ts — it stands still while he is off his man) or the room fight's for a teammate (roomfight.ts reloadUntil, which plays no clip: the gun stays up and the hand does the change)
          const R = gd.weapon.reloadRow, fo = gd.reloadT < 0 && gd.state !== 'dead' ? this.fight.opOf(gd) : null;   // (the row his beat is on: the gun's own, or a tube gun's by the shell — gunreload.ts feedBegin)
          an.reloadRow = R; an.reloadAt = gd.state === 'dead' ? -1 : gd.reloadT >= 0 ? R.dur - gd.reloadT : fo && fo.reloadUntil > this.time ? Math.max(0, R.dur - (fo.reloadUntil - this.time)) : -1;
        }
        an.dip = MOVES.on > 0.5 && MOVES.entry > 0.5 && cb && !show && !gd.held && gd.state !== 'dead' && gd.team === 'operative' && !this.fight.busy(gd, 1.5) && !this.fight.contact(gd) && friendBeforeMuzzle(this, gd) ? 1 : 0;   // (not the showcases' casts: their muzzles are choreographed; and never a man with somebody to shoot, or eyes on one — the gun is where the fight wants it)
        if (gd.state !== 'dead' && this.time < gd.dazzledUntil) {   // (a checkpoint keeps dazzledUntil but not where it went off: his fix — the door, for a blind man — stands in)
          const dz = an.dazzle ?? (an.dazzle = { from: gd.char.pos, k: 0 }); dz.from = gd.dazzledAt ?? gd.lastKnown ?? gd.char.pos; dz.k = Math.min(1, (gd.dazzledUntil - this.time) / 0.5);
        } else an.dazzle = null;
        // turn weight (character.ts TURN — nothing reads it with that off): his yaws are weighed by what he carries, bar a man in Sam's arm and a showcase's cast (their timings are the choreography's)
        { const tw = gd.char.turn; tw.on = !show && !gd.held; tw.h = handlingOf(def); tw.k = an.trained; }
      }
      this.player.char.anim.trained = 1;
    }
    conditionPose(this);   // (condition.ts: each man's condition to his figure — nothing dealt with its switch off)
  }
  /** this frame's dynamic boxes, and what STEPS while they are gathered: stature, the fx's time to live, tracers, sparks, the spent cases' landings, the wall charge's look and camera kick, a broken fixture's pieces. Skip it and those stop. Returns whether stature scaled anybody (drawCharacters takes it) */
  private stepFxAndDynBoxes(all: Character[], dt: number, cam: FollowCamera, canvas: View) {
    this.dynBoxes.length = 0;
    this.fogOfWar.doorBoxes(this.doors, this.dynBoxes);   // (the leaves — Doors.boxes itself unless the fog of war holds a leaf that moved unseen where the team last saw it)
    this.props.boxes(this.dynBoxes);
    this.items.boxes(this.dynBoxes);
    this.destr.boxes(this.dynBoxes);    // the destruction lane's rigid debris (tiles, housings, clutter): shadow-casting boxes inside the tier's cap
    deviceBoxes(this, this.dynBoxes);   // camera bodies / LEDs, keypad plates, emitters and their beams (devices.ts — dynamic, like the leaves: nothing of them is baked)
    this.moths.boxes(this.dynBoxes);    // the moths (moths.ts): a dozen fluttering NoShadow specks under the lit sodium lamps at night, none by day / lamp out / in a gale
    if (this.rings.length) ringBoxes(this, this.dynBoxes);
    if (this.player.cams.length) stickyBoxes(this, this.dynBoxes);
    switchBoxes(this, this.dynBoxes);   // the rooms' wall switches (lightswitch.ts — none with its switch off)
    if (this.shells.length) shellBoxes(this, this.dynBoxes);
    // world size of one internal pixel at the look-at depth (thin props — the lasers, the tracer streaks — widen to stay ≥ ~1 px and dim by the same factor). Under sharp direct's DECOUPLED
    // jitter the raster that draws them is the un-jittered OUTPUT one, where a line thinner than a pixel is not integrated into a faint continuous one by the jitter but drawn dashed:
    // there the size is an OUTPUT pixel taken at 1.6× the look-at depth (the far third of a typical frame), so a beam still covers a pixel centre on every row it crosses
    this.mPerPx = this.viewPx(cam, canvas);
    const statured = statureTick(this, all, dt), rig0 = this.dynBoxes.length;   // STATURE (stature.ts): each man's drawn scale about his feet this frame — false with the mannequin loaded, and nothing below is asked
    handProps(this, this.dynBoxes); this.fogOfWar.rigFrom = rig0; this.fogOfWar.rigTo = this.dynBoxes.length;   // (what the men carry: the fog of war leaves that stretch of the list to the rule for men)
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; this.dynBoxes.push(f.box); f.ttl -= dt; if (f.ttl <= 0) this.fx.splice(i, 1); }
    if (statured) drawnBoxes(this, all, this.dynBoxes, rig0);   // (his rig and a can in his fist are drawn where his drawn hands are: Box.dc / dh — the boxes themselves stay the simulation's)
    if (!this.tune.tracers && this.tracers.live) this.tracers.clear();   // the flag off (panel, console, the soak) = nothing in flight from this frame, not just nothing new
    this.tracers.update(dt, this.dynBoxes, this.mPerPx);   // tracer streaks fired this frame or still in flight: heads advance, boxes out, head lights moved, embers into the sparks (before sparks.update so an ember shows the frame it lands) — a return when none is alive
    this.sparks.update(dt, this.col); this.sparks.boxes(this.dynBoxes);   // before smoke.update() this frame reads the trail emitters' tracked positions
    updateParticleFx(this);   // the GPU particles' one CPU-side duty: spent cases heard landing when they are due (particleFx.ts) — a return with none pending
    blastLookTick(this, this.dynBoxes);   // the look of a set wall charge and of its blast (blastLook.ts): the charge's frame, lamp and firing line drawn, a blown one's flash warmed, a blast's later fragments let go — picture only; a return on its first line with the destruction switch off
    blastFeelTick(this, cam);   // the feel of a wall charge going off (blastFeel.ts): its dust ring, soot and ceiling dust let go stage by stage, the camera's kick written for the render — picture only (no box, no light); a return on its first line with the destruction switch off
    fixtureBreakBoxes(this, this.dynBoxes, dt);   // a fixture that broke: its tray swinging down, its diffuser and glass on the floor, the lead arcing (fixtureBreak.ts — picture only: Dynamic | NoShadow boxes and particles, nothing play asks about; LAST in the list, so no unkeyed box behind it changes its index when a piece appears)
    return statured;
  }
  /** men moving through smoke push it */
  private smokeWake(all: Character[]) {
    // characters wading through smoke push it around
    for (const c of all) {
      const sp = Math.hypot(c.vel[0], c.vel[2]); if (sp < 0.25 || !c.bones.hips) continue;
      const dirv: Vec3 = [c.vel[0] / sp, 0.05, c.vel[2] / sp];
      this.smoke.push({ pos: c.bones.hips, dir: dirv, speed: sp * 1.15, radius: 0.3 });
      if (c.bones.chest) this.smoke.push({ pos: c.bones.chest, dir: dirv, speed: sp * 1.1, radius: 0.26 });
    }
  }
  /** characters → GPU skin instances + RT proxies, and the frame's dynamic boxes handed to the world */
  private drawCharacters(all: Character[], statured: boolean) {
    this.menAll = all; this.menStatured = statured; this.menBare = false;
    this.drawMen(all, statured, false);
    this.dynRaw = this.dynBoxes.length; this.engine.world.dynamics = this.fogOfWar.things(this.dynBoxes);   // (fog of war: a loose thing that moves where nobody on the team sees it is handed over where it was last seen — the list itself while it is off)
  }
  /** the world size of one drawn pixel at a camera's look-at depth, for a view of `canvas`'s height (what `mPerPx` is of the tick's own view; the engine replay asks it of the
   *  picture's camera and window) */
  viewPx(cam: { distance: number; fov: number }, canvas: { height: number }): number {
    const sharpStill = this.engine.sharpOn && this.engine.settings.sharpDecouple;
    return 2 * cam.distance * (sharpStill ? 1.6 : 1) * Math.tan(cam.fov / 2) / Math.max(200, canvas.height * (sharpStill ? 1 : (this.engine.effectiveScale || 1)));
  }
  private menAll: Character[] = []; private menStatured = false; private menBare = false; private fogHeld: { dyn: Box[]; on: boolean } | null = null;
  /** A VIEWER'S PICTURE WITHOUT THE FOG OF WAR (replay/engineplay.ts's 'Fog' switch; only where `fogOfWar.viewer` was raised, so never in play): call right before
   *  a draw, BETWEEN two steps, and `fogBack()` right after it. With `want` the renderer is handed everybody — the men the fog leaves out after the men it draws —,
   *  the frame's boxes as they stood before the fog cut them, what the left-out men carry, and no fog pass; the HUD's `hidden()` / `lastSeen()` answer for an open
   *  floor meanwhile. Nothing a step reads is written: `fogBack()` hands the CPU's rays the step's own list again (the cursor's ray walks the packed list); the
   *  skin instances and shadow proxies stay the lifted draw's until the next step or draw deals them again (the GPU's alone: no step reads them).
   *  `tube` (the replay's 'NV' switch; null = the run's own): the picture's night vision is the viewer's for this draw, so the INFRARED laser lines — boxes a step
   *  makes only for a picture through the tube (irlaser.ts irViewer) — are added (combat.ts irBeams) or left out (irMade) to match; the run's goggles, and
   *  everything that reads them, stay the tape's.
   *  `px` (over 0: the picture's own pixel in metres, `viewPx` of the camera and window it is drawn with): the thin lines a step sized for ITS view's pixel — laser beams,
   *  tracer streaks (thinline.ts) — are handed over re-sized for the picture's. A tape recorded at another zoom or window size drew a beam as a fat pale bar. */
  fogLift(want: boolean, tube: boolean | null = null, px = 0) {
    if (this.fogHeld) return;   // (already lifted for this draw)
    const fog = this.fogOfWar, bare = want && fog.viewer && fog.active;
    const ir = fog.viewer && tube !== null && !(this.engine.settings.debugView > 0) && tube !== irViewer(this);   // (the viewer's tube is not the run's: the infrared lines follow the picture — a debug view shows no tube, so none are added to one)
    if (bare !== this.menBare && this.menAll.length) { this.drawMen(this.menAll, this.menStatured, bare); this.menBare = bare; }
    const world = this.engine.world, thin = fog.viewer && px > 0;
    if (!bare && !ir) {
      const T = thin ? thinFit(world.dynamics, px) : null; if (!T) return;   // (every line already fits this picture: nothing lifted)
      this.fogHeld = { dyn: world.dynamics, on: fog.frame.on }; world.dynamics = T; return;
    }
    let B = (bare ? fog.raw() : null) ?? world.dynamics.slice(); const n0 = B.length;
    this.fogHeld = { dyn: world.dynamics, on: fog.frame.on };
    if (bare) { hiddenProps(this, B);
      if (this.menStatured) drawnBoxes(this, this.menAll, B, n0);   // (their kit where their drawn hands are, as the step's own rigs were placed)
      fog.frame.on = false; fog.bared = true; fog.facesLift(); }   // (and no lamp's face as the team last saw it: the picture without the fog is the lamps as they are)
    if (ir) { if (tube) irBeams(this, B); else B = B.filter(b => !irMade(b)); }   // (tube on: the lines the run's men have on and its picture did not show; tube off: the lines the step drew for its own tube left out)
    if (thin) B = thinFit(B, px) ?? B;
    world.dynamics = B;
  }
  fogBack() {
    const H = this.fogHeld; if (!H) return; this.fogHeld = null;
    const fog = this.fogOfWar, world = this.engine.world;
    if (fog.bared) fog.facesBack();
    fog.bared = false; fog.frame.on = H.on; world.dynamics = H.dyn;
    world.upload(true);   // (packed again as the step left it — `true`: the motion identities stay the drawn frame's, as between two ticks of one frame)
  }
  private drawMen(all: Character[], statured: boolean, bare: boolean) {
    const world = this.engine.world; world.resetCapsules();
    const wetOn = (this.engine.settings as { wetChars?: boolean }).wetChars !== false;   // wet characters (wet.ts): the renderer's switch — off (or a dry man) hands the g-buffer zeros, and it shades him exactly as before
    let drawn = bare ? this.fogOfWar.everybody(all) : this.fogOfWar.filter(all);
    if (this.rails.skyOn) { const me = this.player.char; drawn = drawn.filter(c => c !== me); }   // (rails.ts, the sky seat: nobody on the floor is the player — he is parked, and not in the picture)   // (fog of war: the men nobody on the team sees are not drawn and cast nothing — the list itself while it is off)
    if (drawn.length > 8 && (this.nightBreach.active || this.rescue.active)) {   // more men on screen than cast shadows (the four-man squad, nightbreach.ts: Sam + four + up to five defenders — BoxWorld.addCharacterCapsules stops at eight): the men down give up their proxy places first, so it is a body that goes without a shadow before any man standing does. Eight or fewer = the list as it was
      const down = new Set<Character>(); for (const gd of this.guards) if (gd.state === 'dead') down.add(gd.char);
      if (down.size) drawn = [...drawn.filter(c => !down.has(c)), ...drawn.filter(c => down.has(c))];
    }
    const looks = charLookFrame(this);
    const sideOf = this.ch.cast ? charSides(this) : null;   // (the cast's placeholder colours go over by side — below; nothing with the mannequin loaded)
    const oneColourHits = (this.engine.settings.rtMeshHits && this.engine.settings.meshShadows) || this.engine.settings.sdfRigSmooth;   // mesh hits / the smooth union read ONE colour a man (proxy record 0): it then carries all of him, not his lower trunk   // CHARACTER MATERIALS (charLook.ts): null unless settings.charMats — then every man is his two tints, as ever
    drawn.forEach((c, i) => {
      if (this.ch.cast) {   // THE CAST (game/cast.ts): the parts this man wears + his own proxy fit (render/sdfrig.ts, cached per mask) — nothing here with the mannequin loaded
        c.parts = castParts(this, c);
        if (this.rigFits) {
          let f = this.rigFitOf.get(c.parts);
          if (f === undefined) { try { f = fitRig(this.ch, c.parts); } catch { f = null; } this.rigFitOf.set(c.parts, f); }   // (solved once per mask — ahead of play for every mask castParts can hand out: sdfrig.ts fitRigCast, in the constructor —; a failed fit keeps the shared one)
          if (f) this.rigFits.set(c.id & 0xff, drawnFit(c, f, statureOf(c))); else this.rigFits.delete(c.id & 0xff);
        }
      }
      const po = sideOf && c.parts ? placeholderTints(sideOf(c)) : TINTS_AS_IS;   // the instance's two colours: his tint then his tint2 on the mannequin and on an operator; for a cast civilian / irregular the tint his side's TABLE reads for trousers, then for the top (charMaterials.ts placeholderTints)
      const tall = statured ? statureOf(c) : 1;   // (1 = the skeleton's own palette and proxies handed over, as ever)
      this.chars.setInstance(i, drawnJoints(c, tall), po & 1 ? c.tint2 : c.tint, po & 2 ? c.tint2 : c.tint, c.id, wetOn && (c.wet > 0 || c.beads > 0) ? (f, o) => { wetInstance(this, c, true, f, o); wetKnobs(f, o + 4); wetLineRow(c, f, o + 12); } : undefined, c.parts);
      this.chars.setMaterials(i, looks ? (f, o) => f.set(looks.palette(c), o) : undefined);
      let capAlb = v3.lerp(c.tint, [0.5, 0.5, 0.5], 0.3);
      if (wetOn && c.wet > 0) { const k = 1 - 0.35 * c.wet; capAlb = [capAlb[0] * k, capAlb[1] * k, capAlb[2] * k]; }   // his shadow proxies (what bounce rays and reflections see of him) darken with the coat like the fabric on screen
      const { caps, bound } = drawnCapsules(c, c.capsules(), tall); world.addCharacterCapsules(c.id, looks ? looks.proxies(c, wetOn && c.wet > 0 ? 1 - 0.35 * c.wet : 1, oneColourHits) : capAlb, caps, bound);   // (per slot: one colour per proxy — his head bounces as helmet and skin, his legs as trousers)
    });
    this.chars.finish(drawn.length);
  }
  /** the top of a step under SENSE.cpu (sense.ts): the game's own smoke is put in front of the solver (and taken away again when the switch goes off, or when the
   *  game is handed another solver), aged by this step, and the sensors answer a sight line from it in the step that asks. Off: two compares and a return. */
  private senseStep(dt: number) {
    const on = SENSE.cpu, O = this.smokeOwned;
    if (on !== !!O || (O && O.solver !== this.smoke)) {
      O?.undo(); this.smokeOwned = on ? { solver: this.smoke, undo: ownSmoke(this.smoke, this.cpuSmoke) } : null;
      if (on !== !!O) { this.cpuSmoke.clear(); this.sensors.setOwn(on ? (a, b) => this.cpuSmoke.trans(a, b, (p, q) => this.col.segmentBlocked(p, q)) : null); }
    }
    if (on) this.cpuSmoke.step(dt);
  }
  /** the sensors' asks (Sam's meter, the guards' smoke sight lines) and Sam's visibility off the last answer */
  private lightMeter(dt: number) {
    // light meter queries — the SENSORS (sensors.ts): Sam's own meter asked at chest and head (his proxies skipped), the guards' smoke sight lines to him, then his read
    const pc = this.player.char; const S = this.sensors;
    S.ask('playerChest', pc.bones.chest ?? v3.add(pc.pos, [0, 1.2, 0]), PLAYER_ID);
    S.ask('playerHead', pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0]), PLAYER_ID);
    const chest = pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0]);
    const tight = this.guards.length > 8;   // (only ever the four-man squad's floor — spawnUnit holds every other to Sam + seven: nine units' meters and lines are more than the probe's 32 slots a frame, so the lines nobody reads — a teammate's to Sam — are not asked there)
    this.guards.forEach((g, i) => {
      if (g.state === 'dead') return;
      const eye = g.char.bones.head ?? v3.add(g.char.pos, [0, 1.65, 0]);
      g.smokeTrans = (S.segment(`smoke${i}`, eye, chest, !tight || hostileTo(g, 'player')) ?? 1) * airTrans(this, eye, chest);   // (× a picked weather's fog along the same line — weather.ts airTrans, exactly 1 with no kind picked)   // (clear air until the probe has answered — headless, always)
    });
    this.fogOfWar.flushAsks();   // (fog of war: its smoke segments go to the probe after Sam's meter and the guards' lines — the table drops what does not fit)
    let r1 = S.read('playerChest'), r2 = S.read('playerHead');
    if (S.own) { r1 = lightEstimateAt(this, pc.bones.chest ?? v3.add(pc.pos, [0, 1.2, 0])); r2 = lightEstimateAt(this, pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0])); }   // (the senses on the CPU — sense.ts: the estimate every other meter falls to, at the two points the probe is asked)
    if (r1 !== undefined && r2 !== undefined && Number.isFinite(r1) && Number.isFinite(r2)) {   // (a NaN / ∞ off a readback — a lost device, a resize race — is no reading: one frame of it damped in and the meter, and every eye that reads it, was NaN for good; review A6.4)
      const E = Math.max(r1, r2); this.player.irradiance = E;
      this.player.visibility = damp(this.player.visibility, this.visibilityOf(E), 6, dt);
    }
    if (!Number.isFinite(this.player.visibility)) this.player.visibility = Number.isFinite(this.player.irradiance) ? this.visibilityOf(this.player.irradiance) : 0;   // …and a meter poisoned by any other road heals to what the last good irradiance says (dark, failing that) instead of staying NaN
    if (!Number.isFinite(this.player.irradiance)) this.player.irradiance = 0;
  }
  /** Scripts / probes / the tour: put the highlight on the row of `kind` (the one whose verb is `verb`, if given) in this frame's list, so the next Space tap does
   *  THAT — the by-hand equivalent of holding Space and scrolling to it. False if no such row is on offer right now. */
  selectVerb(kind: Interactable['kind'], verb?: Verb): boolean {
    const i = this.nearby.findIndex(r => r.kind === kind && (!verb || r.verb === verb));
    if (i < 0) return false;
    this.player.nearSel = i; pickHover(this); return true;
  }
  /** Esc, before the pause menu gets it (main.ts): the open selector backs out / a running sustained verb stops. True = used here, no menu this press. */
  escape(): boolean { return this.orders.escape() || launchCancel(this) || escapeInteract(this) || slotSetupShut(this) || this.orders.planEscape(); }   // (the squad's command menu backs out first: orders.ts)
  /** is there anything the back key would back out of right now (backkey.ts; asked by the page before Tab's trial choice gets the key) */
  backable(): boolean { return !!this.orders.menu || this.orders.planBack() || !!this.player.launchHeld || backableInteract(this) || slotSetupOpen(this); }   // (…and the open setup of the gun in his hands: slotsetup.ts)
  /** The light meter's mapping, irradiance (W/m², max over the axes as the probe reports it) → 0‥1 visibility: 0 at or below visFloor, 1 by visFloor·e^(1/visSlope).
   *  One mapping for the meter on Sam and for a searcher judging how dark a hiding place is (guards.ts): dark for the one is dark for the other. */
  visibilityOf(E: number): number { return clamp(this.tune.visSlope * Math.log(Math.max(E, 1e-5) / this.tune.visFloor), 0, 1); }


  private updateDoors(dt: number, input: Input) {
    const pl = this.player; const pc = pl.char;
    const own: DoorContact | null = pl.down ? null : { pos: pc.pos, radius: 0.34, bash: pl.sprinting, who: PLAYER_ID, quiet: pl.crouch && !pl.dash, keys: pl.keys, run: sprintDoorRun(this, pl), solid: DOORWAY.solid && DOORWAY.oneWay && !this.puppet && !this.touring, vel: pc.vel };   // his pocket's keys (Player.keys — none until a questioned man hands his over): a locked leaf whose lock none fits is a wall to you (Doors.update reports it in blockedBy); one that fits, and it pushes open as it does for the staff
    const contacts: DoorContact[] = own ? [own] : [];
    for (const g of this.guards) if (g.state !== 'dead') contacts.push({ pos: g.char.pos, radius: 0.34, bash: g.state === 'alert' && loadGait(this, g, g.speed) > 2.2, who: g.char.id, quiet: silentEase(this, g), key: true, hand: handPress(this, g), round: g.speed > ROUND_PACE && roundsLeaves(g) });   // staff carry keys: locked doors open to them and lock again behind them (closer + latch) — every man, whatever Sam has had off his belt (Guard.keys is what he can hand over, not what the leaves ask)
    const woundedAt: { g: Guard; at: Vec3; x: number; z: number }[] = [];   // (a copy of where his BODY is — the hips of a man on his back lie a stride behind his feet — so what a leaf does to it can be put through the walls before it is his: below, after doors.update)
    for (const g of this.guards) if (g.wound) { const h = g.wound.pose === 'back' ? g.char.bones.hips : null, at: Vec3 = h ? [h[0], g.char.pos[1], h[2]] : v3.copy(g.char.pos); woundedAt.push({ g, at, x: at[0], z: at[2] }); contacts.push({ pos: at, radius: 0.3, bash: false, who: g.char.id, quiet: true, weak: true }); }   // a man down WOUNDED (wounds.ts — posed, no ragdoll) is in a doorway what a body is: the closer does not latch through him, a leaf somebody pushes moves him aside
    civilianDoorContacts(this, contacts);   // the cleaner / the late worker push leaves like anybody standing (no key: a locked one is a wall to them) — civilians.ts
    // bodies: a few of each ragdoll's particles as 'weak' contacts — a corpse in the doorway keeps the closer from latching the leaf, a leaf somebody pushes (or
    // a latched / kicked one) shoves the corpse instead (written back into the particles below, which wakes it)
    const bodyContacts: { c: DoorContact; ch: Character; i: number }[] = []; const bodies: Character[] = [];
    const shownCivs = civiliansShown(this);   // (a civilian's body in a doorway holds the leaf like anybody's — civilians.ts)
    for (let gi = -1; gi < this.guards.length + shownCivs.length; gi++) {
      const ch = gi < 0 ? pc : gi < this.guards.length ? this.guards[gi].char : shownCivs[gi - this.guards.length].char; const rag = ch.ragdoll; if (!rag) continue;
      const hp = rag.point(RAG.pelvis, this.tmpV); if (!this.doors.list.some(d => Math.abs(d.pos[0] - hp[0]) < 2.2 && Math.abs(d.pos[2] - hp[2]) < 2.2)) continue;   // only a body actually near a doorway takes part (no per-frame contact churn for the rest)
      bodies.push(ch);
      for (const i of BODY_DOOR_PARTICLES) { const p = rag.point(i); const c: DoorContact = { pos: p, radius: rag.radius(i), bash: false, who: ch.id, quiet: true, weak: true }; contacts.push(c); bodyContacts.push({ c, ch, i }); }
    }
    const angles = this.doors.list.map(d => d.angle);   // every leaf before this frame's contacts: what moved wakes the bodies near it (below), what turned away from a man is a leaf he is pushing (handsOnDoors)
    // ---- this frame's Space verb (interact.ts → Game.act: the highlighted row tapped, or let go of with the list open) — everything but the held man's rows
    //      (player.ts updateHold) and the drive (mission.ts). Each does exactly what its key path did. Nothing for a Sam who is DOWN: the row was chosen at the
    //      top of the frame, and a round from the guards' update since may have dropped him — a dead man pushes no door, kicks no lock, hauls no body (review A6.9).
    const act = pl.down ? null : this.act, verb = act?.verb;
    // a body: take hold of it by the ankles / let go (the row of the body you are hauling is always on offer, see buildInteractables)
    if (act?.kind === 'body' && act.guard) { if (verb === 'drop') { if (pl.dragging && !haulSetDown(this)) this.toggleDrag(); } else if (verb === 'drag') this.toggleDrag(act.guard); }
    // the mains breaker by hand: throw it (a long trip — the nearest calm guard is sent to reset it exactly as after an OCP burst, and gets there in his own
    // time) or, thrown already and not destroyed, re-arm it. A shot breaker is scrap: no row.
    if (act?.kind === 'breaker' && !breakerStart(this, verb === 'breakerOn')) {   // (handwork.ts: with hands at work on, his hand goes to the lever and the mains go over under it — breakerTick)
      if (verb === 'breakerOn' && this.blackout.active && !this.blackout.permanent) this.endBlackout(); else if (verb === 'breakerOff' && !this.blackout.active) this.setBlackout(86400, 'hand');   // (thrown by hand it stays thrown: a guard sent to it, or Sam, puts it back — not a timer)
    }
    breakerTick(this, dt);
    if (act?.kind === 'cam' && verb === 'takeCam') takeCam(this, pl);   // a stuck sticky camera taken back (stickycam.ts — a row only with STICKY.take up)
    if (act?.kind === 'charge') ownBlowAct(this);   // a charge his own hands set, set off from his own list (ownblow.ts — a row only with its switch up)
    if (act?.kind === 'switch' && verb) switchAct(this, pl, verb);   // a room's wall switch (lightswitch.ts — a row only with its switch up)
    // A living guard from behind: his one row GRABS him — an arm round his throat with the hands empty, the pistol to his head with it drawn (player.ts startGrab /
    // updateHold — questions, the choke / the whip are HIS rows from then on). The silent takedown is the other hand's business (Chaos Theory's melee): a LEFT
    // CLICK with the hands empty — holstered, E — on the man in reach behind, whatever the panel highlights; with the pistol drawn a click is a round (updatePlayer
    // fired it), so you holster first. One gate for both (buildInteractables' inReach).
    { const free = !pl.takedown && !pl.down && !pl.holding && !samStaggered(this) && !pl.breakerMove;   // (samstun.ts: folded by a blast, no takedown and no grab; handwork.ts: his hand is on the breaker's lever for its half second — committed, like a kick; never set with that switch off)
      const bare = closeBare(this), two = closeLethal(this) && !bare, knife = !bare && input.lmbHit() && !stalkHas(this);
      // the man a click with empty hands is on (the one in reach), and whether the choke is his to be given (close.ts CLOSE.rmbHold: the right button let
      // go inside a tap is the knockout, kept down it is the choke — off, or beside a man who can only be struck, the press itself is the knockout)
      const inReach = pl.holstered ? (this.nearby.find(it => it.kind === 'guard' && it.inReach && !(it.guard && (this.rescue?.isHostage(it.guard) || this.snatch?.out.owns(it.guard)))) ?? null) : null;
      const chokeOn = CLOSE.rmbHold && !!inReach?.guard && !inReach.guard.civ && this.rails.offers('grab') && closeAt(this, inReach.guard, pl.char.pos).grab;
      const rb = closeRmb(this, CLOSE.on && CLOSE.rmbHold && (two || bare) && pl.holstered && free, input.rmb(), input.rmbHit(), dt, !!inReach, chokeOn, input.hit('Blur') || input.hit('Paused')), blow = knife || ((two || bare) && rb !== null);   // (close.ts CLOSE.noKnife: no knife — the left click is no blow, the right click the knockout; with the two-button blow live the left click is the knife and the right click the knockout)
      const clicked = blow ? inReach : null, viaClick = clicked?.guard ?? null;   // click, hands empty: the man in reach
      const stalked = stalkGrab(this);   // (stalk.ts: the held click has walked him in to the man's back — the grab it ends in is the row's own)
      if (stalked && free) { startGrab(this, stalked); if (pl.holding?.g === stalked) pl.holding.from = [pl.char.pos[0], pl.char.pos[1], pl.char.pos[2]]; }   // (the way in is read where he stands: behind him, or behind his chair)
      else if (viaClick && free && rb === 'hold') {   // (the choke: into the arm — the stalk's own grab where the key's would be — which closes as soon as it has him: player.ts updateHold, `rmbChoke`)
        const keyed = stalkKeyCan(this, viaClick); startGrab(this, viaClick, clicked!.close);
        if (pl.holding?.g === viaClick) { if (keyed) { stalkKeyTook(this); pl.holding.from = [pl.char.pos[0], pl.char.pos[1], pl.char.pos[2]]; } pl.holding.rmbChoke = 1; pl.holding.rmbT = CLOSE.rmbTapSecs; } }   // (a hold already: letting go eases it off)
      else if (viaClick && free) startTakedown(this, viaClick, clicked!.close, two && knife && !viaClick.civ, !knife && rb === 'tap' && chokeOn);   // (close: the way in his row offered — close.ts, undefined with its switch off; the quick knockout is the loud one where the quiet choke was his to choose)
      else if (act?.kind === 'guard' && verb === 'grab' && act.guard && free) { const keyed = stalkKeyCan(this, act.guard); startGrab(this, act.guard, act.close); if (keyed && pl.holding?.g === act.guard) { stalkKeyTook(this); pl.holding.from = [pl.char.pos[0], pl.char.pos[1], pl.char.pos[2]]; } }   // (stalk.ts STALK.key: the row's key finishes a stalk — the grab is the stalk's own, the step in and all)
    }
    // A door in reach, one row per thing it can be made to do: shut → 'push it open' (Doors.use: away from you, its creak) / 'ease it open — silent' (started
    // here, run below: Doors.crack a few degrees a second until it stands open at EASE_MAX, or a step / Space / Esc stops it where it is — interact.ts); open →
    // 'pull it shut'; locked against you (Doors.lockedOut) → 'pick the lock' (player.ts startPicking, on its own clock from there), 'kick it in' (loud, the keep
    // torn out), crouched also 'try the handle' (a clack and 'won't budge'); locked but its key in his pocket (Player.keys, off a man he questioned) → 'unlock it'
    // (the key's clack, then the creak: Doors.use) / 'ease it open' (key and leaf round together in silence) — a door like any other, that locks again behind
    // him. With a man in his arm no door row exists: the pair pushes leaves open by walking into them, and HIS key turns the locked ones (the contacts below).
    if (act?.kind === 'door' && act.door) {
      const d = act.door;
      if (verb === 'push' || verb === 'pull' || verb === 'unlock') { if (!doorMoveBegin(this, d)) { pl.doorMove = null; this.doors.use(d, pc.pos, PLAYER_ID, pl.keys); } }   // (hands.ts, its switch on: the leaf comes round under his hand, him stepped clear of it — else flung / pulled to as ever)
      else if (verb === 'ease') { if (!this.doors.lockedOut(d, pc.pos, pl.keys)) { pl.doorMove = null; pl.easing = d; pl.easeStallT = 0; pl.easeBest = Math.abs(d.angle); } }
      else if (verb === 'pick') { if (this.doors.lockedOut(d, pc.pos, pl.keys)) startPicking(this, d); }
      else if (verb === 'kick') { if (this.doors.bootHolds(d, pc.pos)) this.msg("it opens toward you, so a kick won't move it"); else startKick(this, d); }   // (doors.ts DOORWAY.frameHolds: the row is greyed there — player.ts)
      else if (verb === 'rattle') { this.doors.rattle(d, PLAYER_ID); this.msg(d.def.steel ? "the stair door is bolted from the landing side with no keyhole on this side, so it's not your way out tonight" : "it's locked. pick it (quiet, slow) or kick it in (loud)"); }
      else if (verb === 'code') startCoding(this, d);   // a keypad door whose code he knows: key it in (devices.ts — sustained, four beeps, then it swings like a keyed door)
      else if (verb === 'nocode') denyPad(this, d);     // …and one whose code he does not: the pad refuses (a deny tone, a word)
      else if (verb === 'breach' || verb === 'hammer') samBigStart(this, d);   // the big slot's tool on a lock (bigkit.ts — committed like a kick: the shotgun's shell, the hammer's two blows)
      else if (verb === 'wand') startWand(this, d);     // the optical wand under a shut door (wand.ts — sustained: he kneels, the lens is his eye until he lets go)
    }
    // the leaf he is easing: on round at the crack rate while he stays within reach of it (his hand on it: handsOnDoors) — done when it stands open, dropped if it
    // is walled against him after all (a colleague's key from the far side would have unlatched it: then it simply goes on) or has not moved for half a second
    // (a body, a chair against it)
    if (pl.easing) {
      const d = pl.easing;
      const inReach = Math.min(v3.distXZ(d.pos, pc.pos), v3.distXZ(d.frameCentre, pc.pos)) < Doors.USE_REACH + 0.25 && !pl.down && !pl.holding && !pl.takedown && !pl.kick;
      if (!inReach || this.doors.lockedOut(d, pc.pos, pl.keys)) pl.easing = null;
      else {
        this.doors.crack(d, pc.pos, PLAYER_ID, Math.min(dt, 0.05), pl.keys, EASE_RATE, EASE_MAX);
        const a1 = Math.abs(d.angle), stop = d.angle < 0 ? -d.minA : d.maxA;
        if (a1 >= Math.min(EASE_MAX, stop) - 1e-3) pl.easing = null;                                       // open (or as far as this leaf goes)
        else if (a1 <= pl.easeBest + 1e-5) { pl.easeStallT += dt; if (pl.easeStallT > 0.5) { pl.easing = null; this.msg("it won't go any further"); } } else { pl.easeStallT = 0; pl.easeBest = a1; }   // (measured against the widest it has stood: whatever pushes it back after this — a body, a chair, doors.update's contacts — shows as no progress)
      }
    }
    if (pl.doorMove) doorMoveTick(this, dt);   // the leaf he is working by hand, on round under it (hands.ts)
    const bx = pc.pos[0], bz = pc.pos[2];
    this.doors.update(dt, contacts);
    doorThrowAfter(this, contacts);      // …and what a driven leaf did to whoever stood in its swing
    for (const w of woundedAt) { if (w.at[0] === w.x && w.at[2] === w.z) continue; this.col.collideCircle(w.at, 0.3, 0.2, 1.5); this.col.clampToWorld(w.at, 0.3); let dx = w.at[0] - w.x, dz = w.at[2] - w.z; const d = Math.hypot(dx, dz), k = d > 0.25 ? 0.25 / d : 1; dx *= k; dz *= k; const p = w.g.char.pos; p[0] += dx; p[2] += dz; this.col.collideCircle(p, 0.3, 0.2, 1.5); this.col.clampToWorld(p, 0.3); if (d > 0.005) w.g.char.update(0); }   // (a leaf moved a wounded man aside: he has no ragdoll and no walk to keep him out of the wall behind him, so the statics are asked here — at the body the leaf shoved first (on his back that is his hips, a stride from his feet), then at his feet; no more than 0.25 m a frame, so one flung leaf cannot put his centre past a thin pane; his bones re-baked where he now is, as the player's and the props' paths do)
    doorSlabs(this, dt);   // the leaves a blast took off their hinges: each loose slab flown, landed, laid flat (doorblast.ts)
    this.handsOnDoors(angles);   // who is walking which leaf open (or easing it): his free hand goes on it (character.ts doorLayer, posed next frame)
    if (own) { settlePlayer(this); settleHeld(this); if (Math.abs(pc.pos[0] - bx) + Math.abs(pc.pos[2] - bz) > 0.005) pc.update(0); }   // a leaf shoved him (or the man in his arm: the pair gives as one, settleHeld): settle that against the statics now (never drawn inside the wall a held leaf pressed him onto), and re-bake the pose where he ended up
    if (pl.doorHead !== 0 && pl.doorHeadT !== this.time) { if (pc.anim.lookYawExtra === pl.doorHead) pc.anim.lookYawExtra = 0; pl.doorHead = 0; }   // (sprintdoor.ts: he stopped running mid-turn — his head is given back, unless something else has taken it since)
    if (own?.run) sprintDoorAfter(this, pl, own);   // a run at a door has weight (sprintdoor.ts): the shoulder through it costs some of the run, the handle ripped toward him most of it
    { const kd = own ? sprintDoorKick(this, pl) : null; if (kd) startKick(this, kd, true); }   // …and the leaf his run is about to meet from the face it opens toward gets his boot (off its hinges: sprintdoor.ts)
    // ran full tilt into a leaf that is locked against you: that is a kick (square on — brushing past the latch edge at a run is not)
    if (own?.blockedBy && pl.sprinting && !pl.kick && !pl.picking && !pl.coding && !pl.takedown && !pl.holding && !this.puppet) {
      const d = own.blockedBy; const u = d.dir(); const into = -(-u[1] * pc.vel[0] + u[0] * pc.vel[2]) * this.doors.side(d, pc.pos);   // speed INTO the leaf from your side (its normal on your side is (−u.z, u.x)·side)
      if (into > 1.5 && !this.doors.bootHolds(d, pc.pos)) startKick(this, d);   // (…and never at the face it opens toward: he stops on it as on any locked door — doors.ts DOORWAY.frameHolds)
    }
    for (const { c, ch, i } of bodyContacts) { const p = ch.ragdoll!.x; ch.ragdoll!.nudge(i, c.pos[0] - p[i * 3], c.pos[2] - p[i * 3 + 2]); }   // whatever a leaf pushed
    // a leaf that moved wakes the bodies asleep within its reach: one slumped against it must slide down when it swings away (a sleeping ragdoll never looks)
    if (bodies.length) this.doors.list.forEach((d, k) => {
      const S = d.slab && !d.slab.rest ? d.slab : null;   // (a leaf torn out of its frame — doorblast.ts — left it as surely as one that swung, and wakes what it flies over)
      if (!S && Math.abs(d.angle - angles[k]) < 1e-3) return;
      for (const ch of bodies) { const h = ch.bones.hips ?? ch.pos; if (ch.ragdoll!.sleeping && (Math.hypot(h[0] - d.def.hinge[0], h[2] - d.def.hinge[1]) < d.def.width + 1.2 || (S && Math.hypot(h[0] - S.p[0], h[2] - S.p[2]) < d.height / 2 + 0.8))) ch.ragdoll!.wake(); }
    });
  }

  /** per living character: the leaf his hand is on (or was, a moment ago), when he last actually pushed it, whether that was the player easing it by hand, and
   *  which hand this push settled on (−1: not yet; t0 = when the record began) */
  private doorHandRecs = new Map<Character, { door: Door; t: number; t0: number; crack: boolean; hand: 0 | 1 | -1; holdOnly?: boolean; move?: boolean }>();
  /** Hands on doors (character.ts doorLayer reads Character.anim.doorPush): who is pushing which leaf open right now, and where on it his free hand goes. A man is
   *  pushing a leaf when his contact circle is on it (Doors.update's own segment test, a few centimetres generous) and the leaf turned AWAY from his face this frame
   *  — walked open, by him or with him — or when he is the player easing it (Player.easing), or standing in the swing of a self-closing one, or about
   *  to: his stride meets a leaf that will yield inside 0.4 s (the hand comes up on the way in; player.ts squares him to it in that time). It stays his for a
   *  short FOLLOW after the last such frame (a leaf coasting a frame ahead of his stride does not take the hand off) and is then fed on with intent 0 while the
   *  layer eases out, tracking the leaf all the while, before it goes null. Which hand and where on the face: see `spot` and the choice below — in short the free-edge side's hand if it is empty
   *  (holstered player; a guard whose torch is on the floor) else the left, in front of its shoulder at chest height, kept off the hinge and the edge and
   *  inside the arm's reach. The leaf is taken where it will be NEXT frame (this frame's turn again): the pose that reads this is struck a frame later, and
   *  un-predicted the palm trails a walked leaf by a couple of centimetres. Geometry as doors.ts has it: the leaf runs `width` from the hinge along u = (cos,
   *  sin)(closedDir + angle); +1 = the CCW face (perp = u.x·pz − u.z·px > 0), whose push turns the angle NEGATIVE; the normal out of face s is s·(−u.z, u.x).
   *  Not for a man down, held, holding, hauling a body, kicking, picking or mid-takedown — those hands are spoken for (the layer gates the animator's own
   *  one-shots, the aim and the wall hold itself). */
  private handsOnDoors(before: number[]) {
    const pl = this.player, now = this.time, list = this.doors.list, recs = this.doorHandRecs; const FOLLOW = 0.12, FADE = 0.4;
    const who: { c: Character; can: boolean; player: boolean; rightFree: boolean; gd?: Guard }[] = [{ c: pl.char, player: true, can: !pl.down && !pl.dragging && !pl.holding && !pl.kick && !pl.picking && !pl.wanding && !pl.takedown, rightFree: pl.holstered }];
    for (const gd of this.guards) who.push({ c: gd.char, gd, player: false, can: gd.state !== 'dead' && !gd.held, rightFree: gd.state === 'patrol' && !gd.drawn && !!gd.dropped });   // (a calm man's right has the torch unless the grab knocked it out of it; any other state's, the pistol)
    for (const cv of civiliansShown(this)) who.push({ c: cv.char, player: false, can: cv.state !== 'dead' && !cv.held && !cv.char.anim.act, rightFree: true });   // (a civilian's hands are both free — unless a task's clip has them: civilians.ts)
    for (const c of recs.keys()) if (!who.some(w => w.c === c)) recs.delete(c);   // characters a restart / reset replaced
    for (const { c, can, player, rightFree, gd } of who) {
      let rec = recs.get(c);
      if (can) {
        let hit: Door | null = null, crack = false, holdOnly = false, move = false; const speed = Math.hypot(c.vel[0], c.vel[2]);
        if (player && pl.doorMove && !pl.doorMove.d.off) { hit = pl.doorMove.d; crack = true; move = true; }   // the leaf he is working by hand (hands.ts) has his hand, whichever other leaf he brushes
        for (let k = 0; k < list.length && !hit; k++) {
          const d = list[k]; const hx = d.def.hinge[0], hz = d.def.hinge[1], W = d.def.width; if (d.off) continue;   // (off its hinges: no leaf there for a hand; read by index: this line runs for every man × every leaf, every frame)
          const vx = c.pos[0] - hx, vz = c.pos[2] - hz; if (vx * vx + vz * vz > (W + 1.2) ** 2) continue;
          if (player && pl.easing === d) { hit = d; crack = true; break; }
          const u = d.dir(); const along = vx * u[0] + vz * u[1], perp = u[0] * vz - u[1] * vx;
          const t = clamp(along, 0, W); const dist = Math.hypot(vx - u[0] * t, vz - u[1] * t);
          const touching = along > 0.14 && along < W + 0.3 && dist < 0.34 + d.thick / 2 + 0.05;   // (0.34: the living contacts' radius, updateDoors)
          const sgn = perp >= 0 ? -1 : 1, da = d.angle - before[k];                                // the way a push from his face turns it (Doors.update), and the way it went
          // pushing it: it turned his way this frame — or holding it off: standing in the swing of a leaf open his way whose closer would bring it back onto him
          // (it does, every couple of seconds, and his contact shoves it back: without this the hand came up for each shove and dropped between them)
          const holding = touching && this.doors.hasCloser(d) && Math.abs(d.angle) > 0.1 && Math.sign(d.angle) === sgn && speed < 0.4;
          const pushing = touching && da * sgn > 1e-4;
          if (pushing || holding) { hit = d; holdOnly = !pushing; break; }
          const mine = DOORWAY.oneWay && sgn * d.swing < 0 && d.angle * d.swing < 1.35;   // (one-way) on the side it opens into, it across his way: his to PULL —
          if (mine && d.pullT > 0 && d.lastWho === c.id && dist < 0.9) { hit = d; break; }   // …the hand stays on a leaf he is bringing round past himself
          // …or about to: walking at a leaf that will yield to him, his stride crossing it inside 0.4 s — the hand comes up on the way in and is on the wood as he
          // meets it (and the controller has that long to square him to it: player.ts). Not one locked against him, nor one already hard on its stop his way.
          if (!touching && speed > 0.3) {
            const wx = c.vel[0] / speed, wz = c.vel[2] / speed; const closing = -(wx * -u[1] + wz * u[0]) * Math.sign(perp);   // his speed's share straight into the leaf plane, from his side
            if (closing > 0.4) {
              const tHit = (Math.abs(perp) - 0.34 - d.thick / 2) / (closing * speed);                                            // seconds to contact at this rate
              const ah = along + (wx * u[0] + wz * u[1]) * speed * Math.max(0, tHit);                                            // where along the leaf he meets it
              const atStop = sgn < 0 ? d.angle <= d.minA + 0.02 : d.angle >= d.maxA - 0.02;
              if (tHit >= 0 && tHit < 0.4 && ah > 0.2 && ah < W + 0.1 && (!atStop || mine) && !(player && this.doors.lockedOut(d, c.pos, pl.keys))) hit = d;
            }
          }
        }
        if (!hit && gd) { const th = teamDoorHand(this, gd); if (th) { hit = th; crack = true; move = true; } }   // (hands.ts: a leaf he works from where he stands — the door tools' shove, a leaf he pulls to; the handle end, the long reach)
        if (hit) { if (rec) { if (rec.door !== hit) { rec.hand = -1; rec.t0 = now; } rec.door = hit; rec.t = now; rec.crack = crack; rec.holdOnly = holdOnly; rec.move = move; } else recs.set(c, rec = { door: hit, t: now, t0: now, crack, hand: -1, holdOnly, move }); }
      } else if (rec) { recs.delete(c); rec = undefined; }
      if (rec && Math.hypot(c.pos[0] - rec.door.def.hinge[0], c.pos[2] - rec.door.def.hinge[1]) > rec.door.def.width + 1.2) { recs.delete(c); rec = undefined; }   // carried off (a teleport, a tour cut, a restart): no easing an arm out toward a door rooms away
      if (!rec || now - rec.t > FOLLOW + FADE) {
        if (rec) recs.delete(c);
        const wh = can ? workHand(this, c) : null, wj = wh ? workJob(this, c) : null;   // (a thing a teammate has been sent to work, workthings.ts: the working hand pose has it while hands at work is on — handwork.ts — else the door hand as before)
        c.anim.doorPush = wh && teamWorkHand(c, wh, wj?.verb === 'drive' || wj?.verb === 'defuse' ? 'take' : 'lever', wj?.secs ?? 0, wj?.need ?? 1, wj?.verb === 'breakerOn' ? -1 : 1) ? null : wh;
        continue;
      }   // (no leaf under his hand: null — or the thing a teammate has been sent to work, workthings.ts)
      const d = rec.door; const [hx, hz] = d.def.hinge, W = d.def.width; const k = list.indexOf(d);
      const da = clamp(d.angle - before[k], -0.3, 0.3); const a = d.def.closedDir + clamp(d.angle + da, d.minA, d.maxA); const u: [number, number] = [Math.cos(a), Math.sin(a)];   // the leaf a frame on
      const px = c.pos[0] - hx, pz = c.pos[2] - hz; const face = u[0] * pz - u[1] * px >= 0 ? 1 : -1; const nx = -u[1] * face, nz = u[0] * face;     // his face of it, and its normal out toward him
      const rgt: [number, number] = [-Math.cos(c.bodyYaw), Math.sin(c.bodyYaw)];   // his right, on the floor (model −X in the world)
      const chest = c.bones.chest ?? [c.pos[0], c.pos[1] + 1.25, c.pos[2]];
      const off = d.thick / 2; const fx = hx + nx * off, fz = hz + nz * off;        // the face line on his side, from the hinge corner along u
      const lo = 0.3, hi = W - (rec.crack ? 0.1 : 0.2);
      // The spot for one hand, off that shoulder joint (this frame's pose): chest height under it — the crack a hand lower when he is close, coming up level as
      // he stands off (an arm at full stretch pushes at shoulder height); crouched, level with it — and along the leaf in front of the shoulder a few centimetres
      // inboard (the crack: a hand on toward the edge), never in the hinge's 30 cm or the edge's last 20 (crack: 10); then slid along the face to stay inside
      // the arm's easy reach as the leaf swings away (a hand trails along a door it has pushed past; easing one, it walks in toward the hinge as the gap
      // opens) — or, nothing of the stretch within it, put square in front of the shoulder, the nearest the leaf comes (`reach` false: the layer's own, more
      // generous test — it leans him into a long one — has the last word). dist: shoulder → spot.
      const spot = (hand: 0 | 1): { p: Vec3; reach: boolean; dist: number } => {
        const sh = (hand ? c.bones.upperArmR : c.bones.upperArmL) ?? [chest[0] + rgt[0] * (hand ? 0.2 : -0.2), chest[1] + 0.15, chest[2] + rgt[1] * (hand ? 0.2 : -0.2)];
        const ex = fx - sh[0], ez = fz - sh[2]; const b = u[0] * ex + u[1] * ez;   // (−b: the foot of the shoulder's perpendicular, along the face line)
        const dh = Math.hypot(ex - u[0] * b, ez - u[1] * b);                       // how far off the shoulder the face line runs, on the floor
        const y = clamp(sh[1] - (rec.crack ? lerp(0.22, 0.1, smoothstep(0.32, 0.5, dh)) : 0.1), 0.85, 1.36);   // (a hand under the shoulder: the wrist then sits ~0.17 below it and the elbow hangs below the wrist)
        const inb = hand ? -0.05 : 0.05;
        let s = clamp((sh[0] + rgt[0] * inb - fx) * u[0] + (sh[2] + rgt[1] * inb - fz) * u[1] + (rec.crack ? 0.08 : 0), lo, hi), reach = false;
        const Rp = 0.5, dy = y - sh[1], r2 = Rp * Rp - dy * dy - dh * dh;      // what is left of the easy reach for running along the line
        if (r2 > 0) { const half = Math.sqrt(r2) - 0.03, s0 = -b - half, s1 = -b + half; if (half > 0 && s1 >= lo && s0 <= hi) { s = clamp(s, Math.max(s0, lo), Math.min(s1, hi)); reach = true; } }
        if (!reach) s = clamp(-b, lo, hi);
        // …and never nearer the shoulder than a folded arm can push from (0.33): a crouch-walk leans the shoulders onto the leaf itself, so the hand goes out along
        // it — toward the free edge if the stretch allows, else the hinge
        const m2 = 0.33 * 0.33 - dy * dy - dh * dh;
        if (m2 > 0) { const q = Math.sqrt(m2); if (Math.abs(s + b) < q) s = -b + q <= hi ? -b + q : -b - q >= lo ? -b - q : s; }
        const p: Vec3 = [fx + u[0] * s, y, fz + u[1] * s];
        return { p, reach, dist: Math.hypot(p[0] - sh[0], p[1] - sh[1], p[2] - sh[2]) };
      };
      // which hand, settled once per leaf (a hand does not change over mid-push; the layer takes it off and puts it back as reach comes and goes): the one on the
      // free-edge side (+u from wherever he stands) if it is empty, else the left — unless that shoulder has none of the leaf in easy reach just now (he is turned
      // away from it toward his aim; the idle stands right shoulder back) and the other, allowed, one has, or is plainly nearer: then the other. A right that
      // gets filled mid-push (he draws) goes left.
      let hand: 0 | 1, sp: { p: Vec3; reach: boolean; dist: number };
      if (rec.hand === -1 || (rec.hand === 1 && !rightFree)) {
        hand = rightFree && u[0] * rgt[0] + u[1] * rgt[1] > 0 ? 1 : 0; sp = spot(hand);
        if (!sp.reach && (hand === 1 || rightFree)) { const other = (hand ? 0 : 1) as 0 | 1; const so = spot(other); if (so.reach || so.dist < sp.dist - 0.12) { hand = other; sp = so; } }   // (a hand's breadth nearer, not the walk's shoulder swing)
        const sx = sp.p[0] - c.pos[0], sz = sp.p[2] - c.pos[2], sl = Math.hypot(sx, sz) || 1;
        if (rec.move ? (sx * Math.sin(c.bodyYaw) + sz * Math.cos(c.bodyYaw)) / sl > 0.5 : -nx * Math.sin(c.bodyYaw) - nz * Math.cos(c.bodyYaw) > 0.5 && now - rec.t0 > 0.25) rec.hand = hand;   // (hands.ts, a leaf worked by hand: settled the moment he faces the SPOT — he was turned to it for this, and may stand off its end where the face is side-on)   // settled only once he faces it (within 60°) and his shoulders have had their quarter second to square to it (character.ts dp.tw): met with his back, his flank or his chest twisted off to the aim he is still coming round, and left and right trade places as he does
      } else { hand = rec.hand; sp = spot(hand); }
      c.anim.doorPush = { p: sp.p, n: [nx, 0, nz], w: now - rec.t <= FOLLOW ? 1 : 0, hand: rec.hand === -1 ? -1 : hand, holdOnly: rec.holdOnly, reach: rec.move };   // (unsettled: the layer squares him up to it and raises nothing — no false start with the hand he will not use)
    }
  }

  /** Loose furniture: same contact pattern as the doors (after everyone has moved and been collided with the statics this frame): characters are
   *  circles that shove props and are held back in place by whatever a prop cannot yield; door leaves sweep props aside. */
  private updateProps(dt: number) {
    const pl = this.player;
    const chars: Character[] = pl.down ? [] : [pl.char];   // a body on the floor neither pushes furniture nor gets pushed
    for (const g of this.guards) if (g.state !== 'dead' && !dozeInChair(g)) chars.push(g.char);   // (doze.ts: a man in, or on his way down into, his chair is no contact for it — false for everybody with its switch off)
    for (const cv of civiliansShown(this)) if (cv.state !== 'dead' && !civilianSeated(cv) && civilianPushesProps(cv)) chars.push(cv.char);   // (a FRIGHTENED civilian shoves a chair aside like anybody; a calm one at work is no contact for the furniture — civilians.ts civilianPushesProps: her loop is authored clear of it and a brushed chair corner must not scrape, roll the dice or move — nor is the man in, or heading for, his own chair)
    const contacts: PropContact[] = chars.map(c => ({ pos: c.pos, vel: c.vel, radius: 0.3, who: c.id, mass: 75, quiet: c.id === PLAYER_ID && pl.crouch && !pl.dash }));
    const before = chars.map(c => [c.pos[0], c.pos[2]]);
    this.props.update(dt, contacts, this.doors.list.some(d => d.off) ? this.doors.list.filter(d => !d.off).map(d => d.box) : this.col.dynamicBoxes);   // (a slab off its hinges is no leaf to furniture: nothing is swept by it, a chair rolls over it)
    this.rollTick(dt);
    if (!pl.down) { settlePlayer(this); settleHeld(this); }   // a chair driven into him by a man or a leaf held him back INTO the wall behind him: the statics win, this frame — and one that would not yield to the man in his arm holds the pair back as one (settleHeld), not him off his station
    // someone held back by a pinned prop was posed (bones, skin, capsules) at the uncorrected spot inside it earlier this frame: re-bake in place (dt 0)
    chars.forEach((c, i) => { if (Math.abs(c.pos[0] - before[i][0]) + Math.abs(c.pos[2] - before[i][1]) > 0.005) c.update(0); });
  }

  dropThrowable(kind: ThrowKind, p: Vec3) { return dropThrowable(this, kind, p); }
  throwCount(kind: ThrowKind) { return throwCount(this, kind); }











  objectivePos() : Vec3 | null { return objectivePos(this); }
  objectiveText() : string { return objectiveText(this); }

}

