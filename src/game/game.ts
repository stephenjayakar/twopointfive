// Game layer core: the Game state holder and its per-frame orchestration, the Player / Guard / LightTarget types, door + prop contact plumbing.
// The systems live beside it as plain-function modules taking the Game first: player.ts (controller, takedown / drag, throws, the cursor's
// interactables), guards.ts (perception, state machine, barks, escalation), combat.ts (shots, kills, hand props, live throwables), lighting.ts
// (fixtures, OCP, blackout), mission.ts (the mission thread), squad.ts (scripted guards).
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp, lerp, DEG, quat, smoothstep } from '../math/vec';
import { Engine } from '../engine';
import { Level, PatrolRoute, Chokepoint } from '../scene/level';
import { StaticCollision } from '../scene/collision';
import { GltfCharacter } from '../anim/gltf';
import { CharacterRenderer } from '../anim/characters';
import { Character } from './character';
import type { Stance, HoldPhase, HoldVariant } from './character';
import { Input } from './input';
import { FollowCamera } from './camera';
import { RtLight } from '../render/lights';
import { IrradianceProbe } from '../render/probe';
import { MeshShadows } from '../render/meshShadows';
import { fitRig } from '../render/sdfrig';
import { Decals } from '../render/decals';
import { buildWearMap } from '../render/wear';
import { SmokeEmitter, SmokeSystemLike } from '../smoke/types';
import { Box, BoxFlag, makeBox, rayBox } from '../scene/boxes';
import { markStats, markWorldRect, AREA_LIT_MARKS, MARKING_TEXEL } from '../scene/markings';
/** an emissive marking registers a light only from this on-axis intensity up (W/sr): the vending fronts are ≈ 2.2–2.8, a monitor's UI bars 0.02, an LED row 0.01 */
export const MARK_LIGHT_MIN_I0 = 0.05;
import { Pistol, Rifle, Ocp, Firearm, WEAPONS } from './weapons';
import type { Ring } from './launcher';
import { updateRings, ringBoxes } from './launcher';
import { updateGlass, glassSummary, crackTest, resetGlass } from './glass';
import type { WeaponId } from './weapons';
import { Doors, Door, DoorEvent, DoorContact, FLOOR_KEY } from './doors';
import { RAG } from './ragdoll';
import { Throwables, ThrowSolution, Item } from './throwables';
import { PropSystem, PropEvent, PropContact } from './props';
import { GameAudioLike, nullAudio } from './audio_iface';
import * as fx from './effects';
import { Sparks } from './sparks';
import { Tracers } from './tracers';
import { Particles } from '../render/particles';
import { sparkSink, kickDustFx, lockSplinterFx, updateParticleFx, clearParticleFx, loadDust, applyDustLook } from './particleFx';
import { Weather } from './weather';
import { updateWetness, wetInstance, wetKnobs, wetLineRow, wetSummary, clearWetPrints } from './wet';
import { updateRainFx, rainSummary } from './rainFx';
import { rigBoxes, rigLightPose, rigTorchPos, torchCarryDir, railLightDef, torchLightDef, holsterBoxes, RIG, carbineGrip, carbineMuzzleAhead, sc20kGrip, sc20kMuzzleAhead } from './rigProps';
import type { Team } from './teams';
import { PLAYER_ID, DRIVE_REACH, DRIVE_SECS } from './consts';
import { missionLive, tally, rackDist, updateMission, drivePulled, sendRackCheck } from './mission';
import { objectivePos, objectiveText } from './mission';
import { Chronicle, chronInterrogated } from './chronicle';
import { fireWeapon, killGuard, dropFromHand, hitPlayer, handProps, laserBoxes, updateItems, smokeParams, startCanister, detonateStun } from './combat';
import { dropThrowable } from './combat';
import { hearingCheck, canSee, goTo, followPath, updateGuard, attachFlashlight, onScreen, rigOf, longRigOf, loadBodyLight, bodyLightSummary } from './guards';
import { say, resetGuards, tension, updateEscalation, escalationSummary, raiseEscalation, standDownEscalation, clearingSummary, clearQueueSummary, forceClear, searchSummary, witnessSummary, standoffSummary } from './guards';
import type { SearchPlan, Pieing, Standoff } from './guards';
import type { Clearing } from './squad';
import { updatePlayer, startTakedown, updateTakedown, bodyDist, throwOrigin, doThrow, updateAim, buildInteractables } from './player';
import { throwCount, toggleDrag, teleportPlayer, startPicking, startKick, settlePlayer, startGrab, freeHeld, settleHeld, takeKey, pickHover, EASE_RATE, EASE_MAX } from './player';
import type { WallHold, Hold } from './player';
import { updateInteract, escapeInteract } from './interact';
import { tacticsTick, loadTactics, tacticsSummary, tacticsReset } from './tactics';
import { needsTick, loadNeeds, needsSummary } from './needs';
import { Director } from './director';
import { spawnCivilians, resetCivilians, updateCivilians, civiliansShown, civilianDoorContacts, civilianAnswer, civiliansSummary, loadCivTune, civilianSeated, civilianPushesProps } from './civilians';
import type { Civ } from './civilians';
import { updateTargets } from './lighting';
import { setBlackout, endBlackout, lightEvent, ocp, setGroup, toggleTarget, repairLights } from './lighting';
import { stepMat } from './floor';
import type { FloorMat } from './floor';
import * as dialogue from './dialogue';
import type { DialoguePick } from './dialogue';
import { Sup, updateSuppression, suppressionSummary } from './suppression';
import { AimState, trackPlayer, aimSummary } from './aim';
import { Qrf, updateQrf, resetQrf, loadQrfTune } from './qrf';
import { Checkpoints } from './savestate';
import { Sensors } from './sensors';
import { SessionRecorder } from './journal';
import { Devices, updateDevices, deviceBoxes, loadDeviceTune, startCoding, denyPad, learnCode, DEVICE_TUNE_DEFAULTS } from './devices';
import { Destruction, loadChaos } from './destruction';
import { Wind, loadWind } from './wind';
import { Moths } from './moths';
import { GlassBreak, loadGlassBreak } from './glassbreak';
import { buildWallRaster, buildInteriorCells, reachMaskFor, reachFraction, reachMaskForDirectional } from '../render/reach';
import { WORLD } from '../scene/world';

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
  areaLights?: { light: RtLight; base: number }[];   // analytic area lights standing in for a flat emissive fixture's emission (smooth direct light + soft shadows instead of cascade rays finding a small bright box)
}

/** kick: a door kicked in — carries through the floor and is answered like a shot (guards.ts hearingCheck); every other door noise is 'door' with a level. A round
 *  ('shot' / 'guardShot' out of combat.ts fireWeapon) also says which weapons.ts row fired it and the segment it actually flew, muzzle → where it stopped (from / to):
 *  nothing in the hearing model reads those — a report is a report — they are for whoever reasons about ROUNDS (the QA soak; suppression). whistle: Sam's low whistle
 *  (V, whistle.ts) — the nearest calm man who hears it comes for a look, twice and he searches; level WHISTLE.level, at his feet, who = the player. */
export interface GameEvent { announced?: boolean; kind: 'shot' | 'lightOut' | 'guardShot' | 'step' | 'door' | 'kick' | 'bang' | 'prop' | 'whistle' | 'glass'; pos: Vec3; time: number; loud: boolean; level?: number; id?: number; who?: number; weapon?: WeaponId; from?: Vec3; to?: Vec3; cause?: 'ocp' | 'shot'; }   // (cause, lightOut only: the OCP's spell — the light dims out and comes back — or a fixture SHOT dark; guards.ts hearingCheck weighs them differently)
export type ThrowKind = 'smoke' | 'flash';
/** What a slot of the kit holds — the item Player.slot has SELECTED (in the hand, or holstered / slung with E): the Five-seveN, the FN2000, a smoke canister, a stun
 *  canister. Every rule about "what is in his hand" reads the kind, never a digit; the digit keys and the kit column's order and numbering are KIT_ORDER's alone
 *  (1 pistol · 2 rifle · 3 smoke · 4 stun — the numbering is stable per item: a kit without the rifle still throws smoke on 3). */
export type SlotKind = 'pistol' | 'rifle' | ThrowKind;
/** the kit top to bottom = the digit that selects each item (index + 1) */
export const KIT_ORDER: readonly SlotKind[] = ['pistol', 'rifle', 'smoke', 'flash'];
/** Anything Space acts on. Two shapes share the type: the MARKER of a thing (Game.interactables — one per door / body / guard / rack / breaker / light: its dot in the
 *  world, the auto-aim's lights; `verb` absent) and the ROW of one thing Space can do to it right now (Game.nearby — player.ts buildInteractables: 'push it open'
 *  and 'ease it open' are two rows of one shut door; `verb` set, `line2` = 'Space␠␠<the verb>' plus hint lines for the thing's other inputs). progress (0‥1): the
 *  bar in the row / the ring round the reticle while a sustained verb runs (`running`: that row IS the running verb — a lock being picked, a leaf being eased,
 *  the choke, the drive coming out). 'held' = the man in Sam's arm (player.ts Hold): his rows are the only rows while he is held. 'cancel' = the selector's
 *  bottom row while it is open (interact.ts): letting go of Space on it does nothing. */
export interface Interactable { kind: 'light' | 'door' | 'body' | 'guard' | 'objective' | 'held' | 'breaker' | 'cancel'; pos: Vec3; line1: string; line2: string; inReach: boolean; off: boolean; progress?: number; target?: LightTarget; door?: Door; guard?: Guard; verb?: Verb; running?: boolean; }
/** Every verb a row can be (player.ts buildInteractables words them; game.ts updateDoors / player.ts updateHold / mission.ts act on Game.act): a shut door's
 *  push / ease (silent, sustained), an open one's pull, a lock's pick (sustained) / kick / rattle (the handle tried, crouched), a keyed lock's unlock; the grab
 *  of a man from behind; the held man's question / choke (sustained) / pistol-whip (sustained); a body's drag / drop; the rack's drive (sustained); the mains
 *  thrown / re-armed by hand; and the selector's own cancel. */
export type Verb = 'push' | 'pull' | 'ease' | 'unlock' | 'pick' | 'kick' | 'rattle' | 'code' | 'nocode' | 'grab' | 'question' | 'choke' | 'whip' | 'comply' | 'drag' | 'drop' | 'drive' | 'breakerOff' | 'breakerOn' | 'cancel';   // comply: a held CIVILIAN told to get down and stay quiet — lets her go, cowering (civilians.ts);   // code / nocode: a keypad door's pad — the code entered (sustained, devices.ts) / the pad tried without one (a deny beep)

// ---------------------------------------------------------------- mission
/** The one mission thread: insert (the spawn) → reach the server room → pull the drive from one rack (F, a few seconds within reach) → out through the
 *  fire exit. Everything it touches already exists (the rooms, that rack's LED switchables, the hearing model, the down / restart flow): it only watches,
 *  counts and says what is next. Geometry lives in level.mission. */
export type MissionStage = 'infiltrate' | 'drive' | 'exfil' | 'done' | 'failed';
export interface MissionStats { elapsed: number; alerts: number; spotted: number; bodies: number; shots: number; kills: number; knockouts: number; keys: number; blackout: boolean; sandbox: boolean; qrf: 0 | 1 | 2; qrfAt: number; }   // qrf = how far the response went this run (game/qrf.ts: 0 nobody called it, 1 the response team came onto the floor, 2 the compound was locked down round him — the debrief's 'exfil under perimeter lockdown'), qrfAt = mission seconds when the team deployed (−1); alerts = alarm EPISODES (someone went to alert while nobody was), bodies = distinct bodies discovered (dead or out cold); kills = men the PLAYER shot dead, knockouts = men he put down breathing (the takedown; a choke-out later) — combat.ts killGuard's how / by; keys = keys taken off questioned men (player.ts takeKey); sandbox = a cheat flag was on at some point
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
  crouch = false; aimHeld = false; lastFireT = -10; fireCd = 0; backpedal = false; sprinting = false;
  dragging: Guard | null = null; dragYaw = 0; dragNoiseT = 0; dragStuckT = 0;   // the body being dragged (F): crouched, facing it, its ankles in your hands (ragdoll pins), the rest trailing along the floor
  noise = 0;                                                    // HUD sound meter: the loudest thing you did lately (hearing-model level, decays)
  takedown: { g: Guard; t: number } | null = null;             // silent takedown in progress (a LEFT CLICK with the hands empty on the man in reach behind): locked behind the guard until the strike lands
  /** the man in his arm (player.ts startGrab / updateHold — the 'grab him' row on a living guard from behind): the pair moves as one at a slow walk, his rows put
   *  questions to him (Game.interrogate) and choke him out quiet (holstered: the arm variant) or pistol-whip him (pistol drawn: the gun variant, which also
   *  fires past him on a click) — there is no letting him go; null when his hands are his own. */
  holding: Hold | null = null;
  /** what Sam is saying right now — his side of an exchange with the man in his arm (player.ts askHeld: his line first, the man's answer when it ends) — drawn
   *  over HIS head like a guard's line, in his own tint (ui/bubbles.ts); the same shape as Guard.bubble */
  bubble: { text: string; t: number; dur: number; radio: boolean } | null = null;
  speedSm = 0;
  visibility = 0;          // 0..1 from light meter
  irradiance = 0;
  hitFlash = 0;
  /** suppression (suppression.ts, docs/internal/sc20k-design.md §4): the rounds passing / striking close to him — the same scalar and rule the guards duck under.
   *  This lane reads it for one thing only, the cone his own rounds open up by (player.ts fire sites, samSpread); the picture, the mix and the reticle are R4's. */
  sup = new Sup();
  /** the scalar itself, 0‥1 (what R4's presentation reads) */
  get suppression() { return this.sup.v; }
  /** the aim-settle model (aim.ts): his track on the man under the reticle (or on nothing in particular), that man's bearing rate across his view, the last round's
   *  numbers — fed once a frame by game.ts (trackPlayer), read by his fire sites (samAim) and the overlay's ring. Rests at 0 with tune.aimModel off. */
  aim = new AimState();
  static readonly MAX_HITS = 1; hitsLeft = Player.MAX_HITS; down = false;   // one 9 mm hit and you are down, same as the guards; Enter restarts the encounter
  // equipment, by KIND (SlotKind — the digits and the kit column's numbering are KIT_ORDER's: 1 the pistol, 2 the FN2000 when the kit has it — hasRifle, the start
  // card's loadout toggle, remembered per machine — 3 smoke canisters, 4 stun canisters); G quick-throws whichever throwable was selected last (`throwKind`). "The
  // weapon in his hand" is gunInHand(): the pistol with 'pistol' selected and drawn, the rifle with 'rifle' selected and off the sling, nothing holstered / slung or
  // with a canister up — every site that used to spell out `slot === 1 && !holstered` for the pistol reads pistolUp, which means exactly that.
  pistol = new Pistol(); ocp = new Ocp(); canisters = 4; flashbangs = 2; slot: SlotKind = 'pistol'; throwKind: ThrowKind = 'smoke';
  /** Sam's FN2000 (docs/internal/sc20k-design.md §5, weapons.ts Rifle: the fn2000 row + its light switch, its selector, its attachments and the rings left) and
   *  whether this kit has it at all. Selected with 2 (2 again with it in the hands cycles the attachment the right button works); `holstered` with it selected means
   *  SLUNG across his back (rigProps RIG.sc20k.slung) — the same one flag E, the wall hold, the grab and every hands-free rule already read; in the hands it is
   *  the animator's long gun (player.ts arms it: LONG carriages by state). */
  rifle = new Rifle(); hasRifle: boolean;
  /** seconds left of the rifle coming off the sling into the hands (or of any change of what is in them that involves it): no round or ring meanwhile */
  equipT = 0;
  /** the rifle left his hands when he went down (combat.ts hitPlayer dropped it as an item): nothing to draw slung on the body */
  rifleGone = false;
  /** the one-time word that the OCP lives on the pistol: said the first time the right button is pressed over a light with the rifle in the hands and no attachment
   *  selected (player.ts) — after that the button is simply dead there */
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
  nearSel = 0; nearKey = '';    // index of the highlighted row of the interaction list (↑ / ↓, the wheel while Space is down) and the identity of the current list
  /** The Space selector (interact.ts): downT = seconds Space has been down this press (−1 = up, or a press not armed); open = held past TAP_SECS (or scrolled while
   *  down) with rows on offer — the list shows its open state, a cancel row sits at its foot, his feet are frozen, and letting go performs the highlighted row;
   *  moved = the highlight was scrolled during this press (a press that scrolls is a choice, never a tap); wheelAcc = wheel travel toward the next row; runKey / moveLatch: which sustained verb was running
   *  last frame and the movement keys already down when it began (a step cancels a running verb — a key held into it does not until it has come up once). */
  sel = { downT: -1, open: false, moved: false, wheelAcc: 0, runKey: '', moveLatch: 0 };
  pace = 1; paceShownT = -10;   // walking-pace multiplier set with the mouse wheel, PACE_MIN‥1 of the walk / crouch-walk speed (sprint is its own held modifier); shown as ticks in the kit column
  nv = false; nvAmount = 0;
  light!: RtLight;   // the rail light: posed from the gun every frame (rigProps.rigLightPose)
  throwHeld = false; heldKind: ThrowKind = 'smoke'; throwPreview: ThrowSolution | null = null; pendingThrow: { t: number; sol: ThrowSolution; kind: ThrowKind } | null = null;
  /** the leaf he is easing open by hand (the 'ease' row: started by a tap, it goes on round at the crack rate on its own until it stands open, or a step / Space /
   *  Esc stops it where it is — game.ts updateDoors runs it; stallT = seconds it has not moved, a body or a chair against it); null when none */
  easing: Door | null = null; easeStallT = 0; easeBest = 0;
  /** locked doors (player.ts updatePicking / updateKick): the lock being worked — planted in a crouch at it, hands on the tools, on its own clock once begun (a step,
   *  Space or Esc breaks off, the progress kept on the door a moment); the kick in progress — rooted square to the leaf until the foot is back down (spot / yaw:
   *  where, fixed when the kick began); fHeld: the Space press now down has been SPENT (it stopped a running verb, a teleport / a kick / a finished pick swallowed
   *  it) and must come up before Space arms again */
  picking: Door | null = null; kick: { door: Door; spot: Vec3; yaw: number } | null = null; fHeld = false;
  /** back to the wall (player.ts, Q): the static face he is pressed against and slides along — null when free. For the HUD / camera: n (unit normal out of the
   *  wall into the room), along (unit tangent: his right when his back is flat to it), atEdge (parked at an OPEN end of the face — an outside corner, a door jamb —
   *  −1 / +1 = which end along `along`, 0 = not at one or the way on is walled), peek (0‥1, eased in while he keeps pushing into that open end), crouched. The
   *  rest is the controller's bookkeeping (see WallHold). Anything that plants him elsewhere (takedown, kick, pick, drag, teleport, going down) lets go first. */
  wall: WallHold | null = null;
  /** the last spot the collision sweep settled him at (player.ts collidePlayer walks him from here to wherever he has been put since, in short strides; null until the first settle, reset by a teleport) */
  safe: Vec3 | null = null;
  stepPhase = 0;
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
  get canisterSel(): ThrowKind | null { return this.slot === 'smoke' || this.slot === 'flash' ? this.slot : null; }
}

// ---------------------------------------------------------------- guard
export type GuardState = 'patrol' | 'suspicious' | 'alert' | 'search' | 'dead';
/** One frame's worth of orders for a scripted guard (see squad.ts). goal: walk there (nav path) at `speed` (m/s, default guard walk); face: body
 *  yaw to hold once planted (or while `strafe`); aimAt: where the gun / torch / eyes point; stance + stackSide + crouch feed the animator's tactical
 *  layers; upper: 'aim' draws the pistol, 'torch' carries the torch; arrived is written back by the runner each frame. */
export interface GuardScript { goal: Vec3 | null; speed?: number; face?: number | null; strafe?: boolean; aimAt?: Vec3 | null; stance?: Stance; stackSide?: -1 | 1; crouch?: boolean; upper?: 'aim' | 'torch' | 'relaxed' | 'none'; light?: boolean; arrived?: boolean;
  /** weapons free on the men in front of him: the runner's muzzle discipline (squad.ts — a colleague in the line puts the gun down) is off for this man. The breach
   *  showcase's operatives carry it while they engage the room (breach.ts): until the guards have SIDES every man in Game.guards is a 'colleague', the opposition
   *  included, and an operative could not so much as cover the man he is about to shoot. The teams lane replaces this with sides in colleagueInLine. */
  hot?: boolean;
  /** rounds past this scripted man make him START (suppression.ts: the anim flinch on the rising edge over the flinch line — never the bark, the late round, the head going down or the
   *  shift to cover, which are the AI's; his feet stay the choreographer's). Off by default: the runner's men are otherwise deaf to fire, as they always were. The day showcase's
   *  firefight orders it on both sides (levels/office.script.ts, director.ts OrderPatch). */
  flinch?: boolean; }
/** What the men call each other on the net (by roster order; the radio check asks for a silent man by it — guards.ts updateRollcall). */
export const CALLSIGNS = ['Kowalski', 'Novak', 'Reyes', 'Okafor', 'Lindqvist', 'Brandt'];
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
};
/** How a downed man went down and by whose hand (combat.ts killGuard): shot = dead; struck (the takedown's cross, a pistol-whip later) / choked (the choke-out
 *  from a hold, later) = out cold and breathing. His state is 'dead' either way — every one of the floor's 'is this man out of the picture' tests keeps working —
 *  this is the side record the found-body lines, the room clear's grim lines, the debrief and (one day) a wake-up read. by: only the player's own count on the card. */
export type DownKind = 'shot' | 'struck' | 'choked';
export type DownBy = 'player' | 'guard' | 'world';
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
export interface UnitInfo { name: string; spawnedAt: number; light: boolean; }
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
  reactT = 0; searchT = 0; lookPhase = Math.random() * 10;
  speed = 0; flashlight: RtLight; sweep = 0; beamDir: Vec3 = [0, -0.3, 1];
  stepPhase = 0; heardUpTo = -1; smokeTrans = 1; lightDeadUntil = -1; diedAt = -1;
  /** was his light burning the moment it left his hand (killed / grabbed)? a dark weapon light must not sputter ON as it tumbles (review 08-10 #7: the breach hostiles' unlit lights swept the sunlit room the frame each died) */
  lightLitAtLoss = true;
  dazzledUntil = -1;   // stun canister with line of sight: no vision, no shooting, rooted to the spot until this time (see Game.detonateStun)
  /** a ring airfoil took him in the body (launcher.ts staggerGuard): doubled over till this time — rooted like the dazzle (reactT), no round from him, but he can SEE,
   *  and he comes out of it alert toward the side it came from */
  staggerUntil = -1;
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
export class Game {
  col: StaticCollision;
  chars: CharacterRenderer;
  /** the mannequins' shadow trees (render/meshShadows.ts — the ultra experiment behind settings.meshShadows): built here next to the skin instances they follow */
  meshShadows: MeshShadows;
  player: Player; guards: Guard[] = [];
  /** the building's own night people — the cleaner, the late worker (civilians.ts): Guard records with `civ` set, NOT in `guards` (no AI side perceives, targets or
   *  answers for them; the module runs them after the guards each frame). Empty with tune.civilians off or on a level that authors none. */
  civilians: Guard[] = [];
  targets: LightTarget[] = [];
  events: GameEvent[] = [];
  probe: IrradianceProbe;
  /** THE seam between the GPU and the simulation (sensors.ts): every value the game takes off the renderer — the light meters, the smoke sight lines — is asked
   *  and read through this, by key; live it is the probe verbatim, a recording journals what it delivered, a replay serves that back without a GPU (journal.ts) */
  sensors: Sensors = new Sensors(() => this.probe);
  /** the session journal's recorder (journal.ts): F10 / __journal on the game page, tools/qa/journal-probes.ts headless — idle unless somebody asked */
  journal: SessionRecorder = new SessionRecorder(this);
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
  aiEnabled = true; godMode = false; infiniteAmmo = false; showDebug = false; spectate = -1;   // (aiEnabled / godMode / infiniteAmmo are also the START CARD's sandbox row — ui/menu.ts `SANDBOX_LS`, kept per machine and applied by main.ts at boot) // guard index the camera follows (-1 = player); infiniteAmmo: sandbox bottomless magazine, applied to whichever pistol the current Player carries (survives restarts)
  playerInvisible = false;   // showcase tour: guards neither see nor hear the idle player
  /** 0‥1, how close Sam is to being walked in on — for the LOOK of his movement only (fed to player.char.anim.deliberate each frame, see update(); the HUD may
   *  read it too): 1 with a living guard who has not clocked him inside ~3 m, gone by ~7 m; nothing once that man is alert; ≥ 0.6 while he is suspicious or
   *  searching; ≥ 0.5 while a lit torch beam lies across Sam. Nothing the AI, the speeds or the meters read. */
  threatProximity = 0; private torchOnT = -100;   // (game time a beam last lay on him: the torch's share is held 1.5 s past it, so a sweeping beam does not pump the gait)
  aimPoint: Vec3 = [0, 0, 0]; aimTarget: LightTarget | null = null; aimGuard: Guard | null = null;
  dynBoxes: Box[] = [];
  /** ring airfoils in flight (launcher.ts: fired off the FN2000's launcher, stepped after the player, drawn with the items; a spent one becomes a 'ring' item) */
  rings: Ring[] = [];
  /** the loadout: does Sam's kit have the FN2000 (docs/internal/sc20k-design.md §11.2 — default in the kit; the start card / pause menu toggle writes it and it is
   *  remembered per machine, localStorage twopointsix.fn2000 — an older machine's twopointsix.sc20k is still honoured). Read whenever a fresh Player is made (boot, restartEncounter); flipping it   (08-12: no longer written or read — the FN2000 is always in the kit; the key survives only in older profiles)
   *  live re-kits the current one. */
  fn2000 = true;
  doors!: Doors;
  /** loose furniture (chairs, cartons, bins, plants) shoved around by characters, bullets, canisters and door leaves */
  props: PropSystem;
  /** door the player would operate with F right now (also drives the HUD prompt) */
  useDoor: Door | null = null;   // the hovered door when it is within reach (F acts on it)
  reachStats = { lights: 0, meanFraction: 1, ms: 0 };   // reach masks built at construction (render/reach.ts): how many lights got one, the mean fraction of the level they reach, build time
  /** the cells under the ceiling slab (reach.ts buildInteriorCells), kept for directional lights added later (the breach's sun: lighting.ts setDaylight → buildDirReach) */
  reachInterior: Uint8Array | null = null;
  /** Give a DIRECTIONAL light (kind 2) its reach mask: the outdoor cells, plus every indoor cell with an unblocked static path toward it (render/reach.ts
   *  reachMaskForDirectional over this level's collision raycast, glass passing). The ReSTIR estimator reads it (lights.ts dirMasks); a few ms, once per light. */
  buildDirReach(l: RtLight) {
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
    l.reachDir = reachMaskForDirectional(toLight, this.reachInterior, blocked);
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
  /** MOTHS (game/moths.ts): a dozen fluttering specks round the lit sodium lamps at night; ticked after the wind, their boxes into the frame's dynamics */
  moths!: Moths;
  /** GLASS BREAKING (game/glassbreak.ts): the panes' impact lists / Voronoi cells / dropped masks and the shards they become — always constructed (its hooks answer 'whole' for
   *  a pane never hit), inert unless tune.glassBreak (default off) AND chaos > 0 outside the tour; the renderer's half is the boot-time prelude const GLASS_BREAK */
  glassBreak!: GlassBreak;
  /** THE DIRECTOR (game/director.ts, docs/design/level-scripting.md M1): the level's script — its programs, triggers and generator beats on the game clock, the showcase
   *  plumbing (the breach is its program 'breach') — built last in the constructor from level.script (none = no programs: today's game exactly), ticked in update() right
   *  before tacticsTick, read by main.ts through `frame` (the pinned look-at, caption, veil) while a showcase program has the frame */
  director!: Director;
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
    glassBreak: false,          // GLASS BREAKING (glassbreak.ts): panes come apart into rigid shards where the rounds went — OFF by default (a pane is what glass.ts says: starred, never open); kept per machine with its knobs (loadGlassBreak); the GPU side follows at boot (main.ts → the prelude const), so a change wants a page reload to show
    debrisImpulses: true,       // DESTRUCTION: what already lies about is kicked again by what happens next — a stun charge throws the settled leaves back up, a round beside them scoots them, a body / boot / shoved desk twitches them (destruction.ts impulses → the GPU particles + the debris pool); off = the lane before it, byte for byte (kept with chaos)   // pursuit tactics (tactics.ts, STATUS E12 a+b): two men on one fix flank it — a presser stops short at his last corner, a flanker comes round from ≥ 90° the other way, 'set' / 'go' on the net — a lone man on an armed intruder holds an angle and calls it in instead of charging, and a doorway a colleague went down in (or rounds came through) is a kill zone nobody walks into: paths go round it, else stack, call, wait for a second man, bang or slice the pie, cross fast. flankWait: the presser's patience at his corner; loneWait: the lone man's; doorDanger: how long a doorway stays a kill zone; doorWait: how long the man on the jamb waits for his second. The four are kept per machine (loadTactics); off = the chase exactly as it was (tools/qa tactics-identity)
    // the response to going loud (game/qrf.ts, Tab ▸ Sandbox ▸ QRF rows — remembered per machine): qrf = the response team comes at all; qrfEta = seconds from the request to
    // the stair door going (called on the radio at the request, at thirty and at ten); qrfSize = men in the element (2‥4, capped by the renderer's character budget);
    // perimeter = the second tier — the compound locked down round him — at all; perimeterEta = its telegraph; perimeterSize = men on the outside posts (2‥4, spawned
    // if the budget has room, else peeled off the element leaving two inside)
    qrf: true, qrfEta: 75, qrfSize: 4, perimeter: true, perimeterEta: 45, perimeterSize: 2,
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

  constructor(public engine: Engine, public level: Level, public ch: GltfCharacter, public smoke: SmokeSystemLike) {
    try { const v = parseFloat(localStorage.getItem('twopointsix.playerCrouch') ?? ''); if (isFinite(v) && v >= 0.3 && v <= 3) this.tune.playerCrouch = v; } catch {}   // the panel's crouch-speed slider is remembered per machine
    loadQrfTune(this);   // …and so are the response team's knobs (qrf.ts: on/off, ETA, size, the perimeter tier's)
    loadTactics(this.tune);   // the pursuit tactics' four knobs, kept per machine like the aim rows (tactics.ts)
    loadNeeds(this.tune);     // …and the needs' switch + fairness knobs (needs.ts)
    loadChaos(this.tune);     // …and the destruction lane's chaos knob (destruction.ts)
    loadWind(this.tune);      // …and the wind's master + rows (wind.ts; the moths' switch rides with it)
    loadGlassBreak(this.tune);   // …and the glass-breaking switch + knobs (glassbreak.ts)
    loadDust();               // …and the dust puffs' emit / look table (particleFx.ts DUST / DUST_LOOK; the look goes onto the particle kind once the system exists, below)
    loadDeviceTune(this);   // …and the devices' (devices.ts: on/off, the beams', the cameras' two thresholds, the cones)
    loadCivTune(this);      // …and the civilians' (civilians.ts: on/off, whether a dead civilian fails the mission)
    loadBodyLight(this.tune);   // …and the bodies-by-light switch with its bar (guards.ts)
    // (the FN2000 is always in the kit now — no per-machine loadout memory; Game.fn2000 / setLoadout stay for the harness)
    this.col = new StaticCollision(level.boxes);
    if (engine.gbuffer?.setWearMap) { const wm = buildWearMap(level, this.col.nav); engine.gbuffer.setWearMap(wm.data, wm.w, wm.h); }   // the detail layer's traffic map (render/wear.ts: the routes over the nav grid + the thresholds, the walls' feet) — the harness's engine stand-in has no g-buffer to hand it to
    this.chars = new CharacterRenderer(engine.device, ch);
    engine.skin = this.chars;
    this.meshShadows = new MeshShadows(engine.device, ch, this.chars.jointMats);   // (the QA harness's fake device takes this too: the tree build is the real code, the buffers go nowhere)
    engine.setMeshShadows?.(this.meshShadows);                                     // (?.: the harness's engine stand-in has no renderer to attach to)
    try { engine.setRigFit?.(fitRig(ch)); } catch (e) { console.warn('SDF rig: the round-cone fit failed, characters trace as untapered cones with hand radii', e); engine.setRigFit?.(null); }                                                 // the SDF character rig's radius fit (render/sdfrig.ts; the round cones are the proxy at every tier; a failed fit only loses the taper)
    if (engine.setParticles) { engine.setParticles(new Particles(engine.device, engine.sceneLayout)); applyDustLook((engine as { particles?: Particles | null }).particles ?? null); }   // GPU particles (experiment E4): only on a real Engine — the harness's stand-in has no setParticles, so every effect site there keeps to the CPU sparks (particleFx.ts gpuFx); the dust LOOK table onto the kind whether or not the switch is on yet
    this.probe = new IrradianceProbe(engine.device, engine.sceneLayout);
    this.player = new Player(ch, level.playerSpawn, this.fn2000);
    // loose furniture: simulated on the CPU, emitted as dynamic boxes every frame (rendered + traced like everything else), deliberately never registered as
    // collision occluders — a chair must not hide the player, muffle a shot or dent the nav grid; guards path through props and shove them aside
    this.props = new PropSystem(level.props, this.col, (e) => this.onPropEvent(e));
    this.items = new Throwables(this.col, this.props);   // canisters and dropped magazines bounce off (and nudge) the furniture
    this.tracers = new Tracers(engine.lights, sparkSink(this));   // tracer streaks: their head lights live in the engine's LightSet (transient), their embers are sparks — GPU sparks while that path is on, the CPU pool's otherwise (particleFx.ts sparkSink)
    this.decals = new Decals(engine.device); engine.setDecals?.(this.decals);   // (the QA harness's engine stand-in has no renderer to hand it to: the list still fills, nothing draws)
    if (engine.settings && engine.settings.decals === false) this.decals.enabled = false;
    this.weather = new Weather(this);
    this.player.light = engine.lights.add(railLightDef(PLAYER_ID, this.tune.playerLight));
    // light targets from analytic lights + switchables
    // contactor groups restrike one after another when the mains return: stagger by order of first appearance
    const groupStagger = new Map<string, number>(); const staggerOf = (grp: string) => { if (!groupStagger.has(grp)) groupStagger.set(grp, groupStagger.size * 0.45 + Math.random() * 0.5); return groupStagger.get(grp)!; };
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
    // flat emissive fixtures (ceiling panels, monitors, logo, TV, vending fronts, exit signs) light the scene through analytic one-sided area
    // lights; their boxes keep glowing on screen but rays ignore the emissive term (BoxFlag.AreaLit) — kills small-emitter aliasing in the cascades
    for (const t of this.targets) {
      if (t.kind !== 'emissive' || t.group === 'server_leds' || t.group === 'emergency') continue;
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
      for (const l of engine.lights.lights) {
        if (l.ttl >= 0 || l.kind === 2 || l.group === 'player' || l.group === 'flashlights') continue;   // transient / the moon / lights that MOVE (Sam's rail light — parked at y −10 until drawn — and the guards' torches, were they added yet): anywhere. Exterior lamp heads above the roof DO get a mask (they enter the building only through its openings, and indoors they were the worst leader-slot thieves of all) — but only its interior cells (reach.ts)
        l.reach = reachMaskFor(solid, l.pos, l.kind === 3 || l.kind === 1 ? l.dir : [0, 0, 0], l.radius, interior); n++; cells += reachFraction(l.reach);
      }
      this.reachInterior = interior;
      for (const l of engine.lights.lights) if (l.kind === 2) this.buildDirReach(l);   // the moon: which indoor cells see the sky its way at all (used by the ReSTIR estimator only — lights.ts dirMasks)
      this.reachStats = { lights: n, meanFraction: n ? cells / n : 1, ms: performance.now() - t0 }; }
    // doors: leaves are dynamic occluders for sight / sound / projectiles (collision layer)
    this.doors = new Doors(level.doors.map(d => ({ ...d, albedo: d.exterior ? [0.2, 0.22, 0.25] as Vec3 : undefined })), (e) => this.onDoorEvent(e));
    this.col.dynamicBoxes = this.doors.leafBoxes();
    this.devices = new Devices(this);   // cameras + emitters join `targets` (before initialOn below captures the authored switch states); a keypad finds its door
    // guards
    const tints: Vec3[] = [[0.42, 0.36, 0.25], [0.3, 0.34, 0.4], [0.38, 0.28, 0.28]];
    level.routes.forEach((r, i) => {
      const fl = engine.lights.add(torchLightDef(`flashlight${i}`, 10 + i, this.tune.flashIntensity, this.tune.flashInner, this.tune.flashOuter));
      this.guards.push(new Guard(ch, 10 + i, r, i, fl, tints[i % tints.length]));
    });
    { const n = level.mission.rack.index; this.rackTargets = this.targets.filter(t => t.name === `rack${n}_leds` || t.name === `rack${n}_glow`); }   // what goes dark when the drive comes out (level.ts "server room")
    this.destr = new Destruction(this);   // the destructible statics indexed by shape (paper stacks, screens + housings, desk clutter) — after the targets and devices exist: a lit screen dies through its target
    this.glassBreak = new GlassBreak(this);   // glass breaking (glassbreak.ts): attaches its cell-table / open-cell / walkable hooks to the world and the collision; its shards go into destr's debris pool — inert until tune.glassBreak
    this.wind = new Wind(this);          // the air (wind.ts): the level's vents + the storm + a source per exterior door — after the doors exist
    this.moths = new Moths(this);        // moths at the lamps (moths.ts) — after the targets (the lamps are light targets)
    this.initialOn = new Map(); for (const t of this.targets) this.initialOn.set(t, t.on);   // the level as authored, for resetLevelState() (captured here, before a tour or the panel touches a switch)
    spawnCivilians(this);   // the cleaner and the late worker on their marks (civilians.ts — after the shift, whose construction and dice they must not disturb; nothing with tune.civilians off or none authored)
    this.director = new Director(this, level.script ?? null);   // the level's script: its define pass run and linted against this level here (nothing of the world touched); programs start on demand
  }

  /** the showcase tour flips this so its own plumbing (teleports, resets) stays out of the log while guard barks still show */
  quietUtility = false;
  /** tour seam: a beat that stages the mission itself (the drive pull) sets this so the stage machine, the rack marker and the objective line run under
   *  the puppet — the debrief tallies still stay off (missionLive), so nothing the tour does counts as the player's run */
  missionInTour = false;
  msg(text: string) { this.messages.push({ text, t: this.time }); if (this.messages.length > 5) this.messages.shift(); }
  say(g: Guard, text: string, radio = false) { return say(this, g, text, radio); }
  viewProj: Float32Array | number[] | null = null;
  note(text: string) { if (!this.quietUtility) this.msg(text); }   // utility / sandbox confirmations

  private onDoorEvent(e: DoorEvent) {
    if (e.who === PLAYER_ID) this.player.noise = Math.max(this.player.noise, e.level);
    switch (e.sound) {
      case 'creak': this.audio.play('doorCreak', e.pos, 0.5 + 0.5 * e.level / 0.3); break;
      case 'bang': this.audio.play('doorBang', e.pos, 0.9); break;
      case 'latch': this.audio.play('doorLatch', e.pos, 0.6); break;
      case 'bash': this.audio.play('doorBash', e.pos, 0.9); break;
      case 'rattle': this.audio.play('doorRattle', e.pos, 0.35 + 2 * e.level); break;
      case 'pick': this.audio.play('lockPick', e.pos, 0.5, { rate: 0.9 + Math.random() * 0.25 }); break;
      case 'unlock': this.audio.play('lockOpen', e.pos, 0.4 + 1.3 * e.level); break;   // the picked cylinder snapping over (0.3 → 0.8), or a key turning it (0.12 → 0.56: the same bolt, drawn gently)
      case 'kick': { this.audio.play('doorBash', e.pos, 1.0, { rate: 0.9 }); this.audio.play('lockBreak', e.pos, 0.95);   // the slam of the leaf, lower and harder than a shoulder, under the keep splintering out of the jamb
        const kicker = e.who === PLAYER_ID ? this.player.char : this.guards.find(x => x.char.id === e.who)?.char; kickDustFx(this, e.door, kicker?.pos ?? e.pos); if (e.door.lockBroken) lockSplinterFx(this, e.door, kicker?.pos ?? e.pos); this.destr?.thud(e.pos, 1.2, e.who); break; }   // …and the plaster and splinters that come out with it (GPU particles; nothing with them off), and the litter at the threshold jumping with the slam (destruction.ts impulses, behind chaos)
      case 'clang': this.audio.play('doorBash', e.pos, 1.0, { rate: 0.7 }); this.audio.play('stairDoor', e.pos, 0.55, { rate: 1.3 }); if (e.who === PLAYER_ID) this.msg("steel fire door — it doesn't give. that was loud"); break;   // a boot on the steel stair door (doors.ts DoorDef.steel): the ring of it, no keep to splinter
    }
    // heard (guards.ts hearingCheck): a kick is its own kind — floor-wide, answered like a shot; everything else is a 'door' noise with a level, placed at the leaf (the
    // clang of a boot on steel that held is a slam's worth of door noise: the men within earshot come and look, the floor is not told 'someone's inside')
    this.events.push({ kind: e.sound === 'kick' ? 'kick' : 'door', pos: [e.pos[0], 0, e.pos[2]], time: this.time, loud: e.sound === 'bash' || e.sound === 'kick' || e.sound === 'clang' || (e.sound === 'bang' && e.level > 0.6), level: e.level, who: e.who });
  }
  /** Furniture noise: a scrape / caster rattle when something is set going, a hollow knock when it hits a wall, another prop or takes a round.
   *  Heard like door sounds (level 0..1, blamed on whoever moved it — guards ignore each other's clumsiness). */
  private onPropEvent(e: PropEvent) {
    if (e.who === PLAYER_ID) this.player.noise = Math.max(this.player.noise, e.level);
    const t = e.prop.tune; const jitter = 0.95 + Math.random() * 0.1;
    if (e.sound === 'thud') { this.audio.play('propThud', e.pos, clamp(0.35 + 0.15 * e.speed, 0.3, 1), { rate: t.thudRate * jitter }); this.destr?.thud(e.pos, 0.4 + 0.3 * e.speed, e.who); }   // (…and the litter round its feet twitching with the knock: destruction.ts impulses, behind chaos)
    else this.audio.play('propScrape', e.pos, clamp(0.25 + 0.18 * e.speed, 0.25, 1), { rate: t.scrapeRate * jitter });
    this.events.push({ kind: 'prop', pos: v3.copy(e.pos), time: this.time, loud: e.level > 0.7, level: e.level, who: e.who });
  }


  resetGuards() { resetQrf(this); resetGuards(this); resetCivilians(this); tacticsReset(this); }   // (…and the civilians: fresh ones on their marks with the fresh shift — a held / dragged one let go of first; and the tactics' memory: plans, gates and kill-zone doorways were the OLD shift's — tactics.ts, review G3.3)   // (the response team first: its men are units resetGuards despawns anyway, its radio clocks and marks are its own to drop)
  tension() : number { return tension(this); }
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
    return this.guards.map(gd => `${gd.callsign} (${TEMPERAMENT[gd.callsign] ?? '?'}${gd.state === 'dead' ? (isBreathing(gd) ? ', out cold' : ', dead') : ''}): ${witnessSummary(this, gd) || '—'}`).join(' | ');
  }
  /** One exchange of the interrogation with `gd` (dialogue.ts — docs/internal/grab-interrogate-design.md §4, slice 5: the engine without the grab). The man answers
   *  from his own state: what he personally saw and heard (Witness), how rattled he is, his temperament, and how far Sam has already leaned on him (Talk) — the line
   *  goes up as his bubble (or the log) with the interrogation's longer hold, and the pick comes back (text, stage, cell, and the useful thing's kind if he gave one)
   *  for whoever asked: the held man's row (player.ts askHeld — THE ANSWER half of an exchange there: Sam's own line goes up over Sam first, this runs when it
   *  ends), the sandbox button (the bare answer, at once), a mission hook later. The gate: the man in Sam's arm (player.holding) always; anybody else only for
   *  the sandbox — 'a living man within reach of a living Sam', INTERROGATE_REACH, 2 m, nothing solid between — and null otherwise. `rnd` picks within the
   *  pool (seeded by the QA harness for replayable runs; the game's own dice by default). The one thing an answer DOES, beyond being said: the man who gives
   *  the keyed door up gives his key up with it (player.ts takeKey — 'mine's on my belt', and Sam takes it). */
  interrogate(gd: Guard, rnd: () => number = Math.random): DialoguePick | null {
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
  nearestLivingGuard(reach = Infinity): Guard | null {
    let best: Guard | null = null, bd = reach;
    for (const gd of this.guards) { if (gd.state === 'dead') continue; const d = v3.distXZ(gd.char.pos, this.player.char.pos); if (d <= bd) { bd = d; best = gd; } }
    return best;
  }
  /** sandbox: lean on whoever is within reach (a note if nobody is) */
  interrogateNearest(rnd: () => number = Math.random): DialoguePick | null {
    if (this.player.down) { this.note("you're down — nobody answers to a man on the floor"); return null; }
    const gd = this.nearestLivingGuard(dialogue.INTERROGATE_REACH);
    if (!gd) { this.note(`nobody within ${dialogue.INTERROGATE_REACH} m to lean on — walk up to a living guard`); return null; }
    const pick = this.interrogate(gd, rnd);
    if (!pick) this.note(`${gd.callsign} is in reach but there is something solid between you`);
    return pick;
  }
  /** panel / console: the interrogation engine's read of the man nearest Sam (any distance) — his knowledge / agitation / temperament cell with the agitation terms,
   *  the stage the next press would be, what he has said and given, the useful thing he would give next (dialogue.ts dialogueSummary) */
  dialogueSummary(): string {
    const gd = this.nearestLivingGuard(); if (!gd) return 'dialogue: nobody left standing';
    const d = v3.distXZ(gd.char.pos, this.player.char.pos);
    return `dialogue ▸ ${dialogue.dialogueSummary(this, gd)} · ${d <= dialogue.INTERROGATE_REACH ? 'in reach' : `${d.toFixed(1)} m off`}`;
  }
  /** panel: the rooms still queued for the pair and the ones called clear in this lockdown lately (with how long ago) */
  clearQueueSummary(): string { return clearQueueSummary(this); }
  clearNearestRoom() { forceClear(this); }
  /** Camera follow position (player or spectated guard). */
  followPos(): Vec3 { const g = this.spectate >= 0 ? this.guards[this.spectate] : null; return g ? g.char.pos : this.player.char.pos; }
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
  clearAftermath() { this.items.items.length = 0; this.rings.length = 0; this.sparks.clear(); this.tracers.clear(); clearParticleFx(this); this.moths?.clear(); this.destr?.clearMoving(); this.events.length = 0; if (this.player) { this.player.pendingThrow = null; this.player.throwHeld = false; this.player.throwPreview = null; } }   // (clearParticleFx: the GPU particles' windows and the cases waiting to be heard — brass from the last take does not lie in the next)
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
  resetLevelState() {
    if (this.initialOn) for (const [t, on] of this.initialOn) t.on = on;
    for (const d of this.doors.list) d.reset();
    this.decals.clear(); resetGlass(this);   // the marks go with the encounter that made them (a restart, the tour's hand-over) — and the glass's count / log of the crack stars among them (glass.ts, review U9.10)
    this.destr.reset();    // …and so does the destruction: scattered paper stacks / knocked-off clutter / dead screens back as authored, debris and heat gone (destruction.ts)
    this.glassBreak.reset();   // …and every pane is whole again (glassbreak.ts: impact lists, dropped cells, gust sources — the shards went with the debris pool above)
    clearWetPrints(this);  // …and the wet-print records that pointed at some of them (wet.ts)
  }
  /** glass experiment: the panel's / console's handles */
  /** glass: star the pane under / nearest the cursor as a round would (the panel's 'crack test'; returns the pane's index or −1), and the panel's line */
  crackTest(): number { return crackTest(this); }
  glassSummary(): string { return glassSummary(this); }
  /** wet characters (wet.ts): everybody's coat / beads and whether it is raining on him, the prints and drips so far — the panel's line and __wet.summary() */
  wetSummary(): string { return wetSummary(this); }
  /** the particle-rain experiment's one line (rainFx.ts; Tab ▸ Weather) */
  rainSummary(): string { return rainSummary(this); }

  /** Restart the encounter: a fresh Player at the insertion point with full kit, fresh Guards on their routes, lights repaired, the level as authored. */
  restartEncounter() {
    const light = this.player.light;
    this.player = new Player(this.ch, v3.copy(this.level.playerSpawn), this.fn2000); this.player.light = light; this.player.char.update(0);   // pose + bones exist before this frame's capsule upload
    this.resetGuards(); this.repairLights(); this.resetLevelState(); this.props.reset(); this.events.length = 0; this.useDoor = null; this.calledIn = false; this.stoodDown = false;   // (resetGuards also stands the floor down: escalation 0, no episode, no lockdown duties)
    // anything still in the air or still venting belongs to the encounter that just ended: an armed stun canister landing into the new one would
    // dazzle the fresh guards and alert the floor from a throw the restarted player never made, and a deployed can's 30 s screen would go on
    // degrading their line of sight (its emitter tracks the item and is priority-pinned, so dropping the item alone does not stop it)
    this.clearAftermath(); this.smoke.clearAll?.();
    this.hover = null; this.interactables = []; this.nearby = []; this.act = null;   // (like useDoor above) this frame's cursor state still names the guards / bodies of the encounter that just ended: when the restart
                                                  // came from updatePlayer (Shift+Enter), the Space handlers later in the same update() must not grab, take down or drag any of them
    this.devices.reset();                   // cameras forget what they saw, beams their trips (repairLights above has already mended any shot dead)
    this.mission = newMission(this.time);   // a fresh run: stage, clock and stats from zero (resetLevelState above has already relit the rack)
    this.chronicle = new Chronicle();       // …and an empty chronicle to go with it (the debrief's timeline, path and counters)
    this.director?.onEncounterRestart();    // a PLAY program of the level script ends with the encounter it was scripting (a showcase's own restore restarts the encounter itself and is left alone)
    this.note('encounter restarted');
  }

  setGroup(group: string, on: boolean) { return setGroup(this, group, on); }
  toggleTarget(t: LightTarget) { return toggleTarget(this, t); }
  setBlackout(seconds: number, cause: 'ocp' | 'shot' | 'debug' | 'hand') { return setBlackout(this, seconds, cause); }
  endBlackout() { return endBlackout(this); }
  lightEvent(t: LightTarget, cause: 'ocp' | 'shot' = 'shot') { return lightEvent(this, t, cause); }
  ocp(t: LightTarget | null) { return ocp(this, t); }
  toggleDrag(which?: Guard) { return toggleDrag(this, which); }

  // ------------------------------------------------------------ update
  update(dt: number, input: Input, cam: FollowCamera, canvas: HTMLCanvasElement) {
    this.journal.frameStart(dt, input, cam, canvas);   // the session journal (journal.ts): idle, a return; asked for, it takes its checkpoint and re-enters it HERE, before anything of the frame has run; recording, it files this frame's dt / camera / input and opens the sensors' frame
    this.director?.injectInput(input);   // a showcase beat's synthetic key / click from LAST frame's tick (director.ts c.press / c.click) becomes this frame's input, ahead of everybody who reads it — a return on its first line otherwise
    this.viewProj = cam.viewProj;
    this.time += dt; this.ocpCooldown = Math.max(0, this.ocpCooldown - dt); this.col.sound.tick(this.time);
    updateAim(this, input, cam, canvas);   // (builds the interaction rows too: player.ts buildInteractables)
    updateInteract(this, dt, input);       // the Space selector over those rows (interact.ts): tap / hold-open-release / cancel → Game.act for this frame, read below where the key used to be
    trackPlayer(this, dt);   // the aim-settle model, Sam's half (aim.ts): what the reticle is on is known now; his feet are last frame's, a frame is nothing to a 0.8 s settle — the fire sites in updatePlayer / updateHold read it below
    { // threat proximity → how deliberately Sam moves (character.ts `deliberate`, eased there; presentation only — computed under the tour too, it only changes the look)
      const pl = this.player, pc = pl.char; let near: Guard | null = null, nd = Infinity, t = 0;
      for (const gd of this.guards) { if (gd.state === 'dead' || gd.held) continue; const d = v3.distXZ(gd.char.pos, pc.pos); if (d < nd) { nd = d; near = gd; } }   // (the man in his arm is not one to creep about)
      if (near && !pl.down && near.state !== 'alert') {   // the nearest living man: nothing to creep about once he is alert (he has him)
        t = 1 - smoothstep(3, 7, nd);
        if (near.state === 'suspicious' || near.state === 'search') t = Math.max(t, 0.6 * (1 - smoothstep(7, 10, nd)));   // extra care while he is looking into something
        const spots: Vec3[] = [[pc.pos[0], 0.15, pc.pos[2]], pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0])];   // the floor where he is (a patrol torch hangs pitched down: its pool is on the floor) and his chest (a raised one)
        if (this.torchOnT > this.time) this.torchOnT = -100;   // (a checkpoint loaded put the clock back: a stamp from the abandoned future is no beam on him)
        torch: for (const gd of this.guards) {   // a lit torch / weapon-light cone on him (inside its cone and 10 m, nothing solid between): half or more, held a beat past the beam moving on
          if (this.time - this.torchOnT < 1.5) break; const fl = gd.flashlight; if (gd.state === 'dead' || !fl.enabled) continue; const cosO = Math.cos(fl.outerDeg * DEG);
          for (const s of spots) { const to = v3.sub(s, fl.pos); const d = v3.len(to); if (d < 10 && d > 1e-3 && v3.dot(to, fl.dir) / d > cosO && !this.col.segmentBlocked(fl.pos, s)) { this.torchOnT = this.time; break torch; } }
        }
        if (this.time - this.torchOnT < 1.5) t = Math.max(t, 0.5);
      }
      this.threatProximity = t; pc.anim.deliberate = t;
    }
    updateSuppression(this, dt);   // everybody's suppression decays, and the guards' flinch / pinned edges fire, ahead of the player and the guards who read it (the rounds they fire below add to it for next frame)
    updatePlayer(this, dt, input, cam);
    if (this.rings.length) updateRings(this, dt);   // the ring airfoils in flight (launcher.ts): flown after the man who fired one this frame, so a ring meets the guards where they stood when it left — a head, a hip, a wall — before they move on below
    this.searchProbeN = 0;   // (this frame's budget of searchers' light queries starts again: guards.ts searchProbes)
    { // rifles: deal the carbine by the sandbox knob — Guard.carbine, and with it the WEAPON: a dealt man carries the AKS-74U row (weapons.ts: bursts, thirty to a
      // box, the report, the rifle that drops), a man dealt out of it his route's row again (a fresh gun either way; a corpse keeps what he died with) — and arm each
      // man's animator with what is then in his hands (guards.ts rigOf: that, or a row that is itself a long gun) — the long-gun solve, the support hand's grip point
      // off RIG.carbine, the muzzle where the prop's is (or the long-gun row's own) — before anybody is posed this frame (a held man is posed in the guards' loop
      // too); flipping the knob re-deals live. Under 'none' nothing here touches anybody: the floor is exactly what it was. A spawned unit (teams: the showcase's
      // operatives and hostiles) is dealt nothing — he carries what he was spawned with, off his own one-point route's row — and a row that is itself Sam's
      // FN2000 arms the animator's long gun the same way with the bullpup's own grip point (guards.ts rigOf 'sc20k').
      const deal = this.tune.carbineGuards; let grip: ReturnType<typeof carbineGrip> | null = null, grip20k: ReturnType<typeof sc20kGrip> | null = null;
      for (const gd of this.guards) {
        if (!gd.unit) gd.carbine = deal === 'all' || (deal === 'reyes' && gd.callsign === 'Reyes');
        const want: WeaponId = gd.carbine ? 'aks74u' : (gd.route.weapon ?? 'guard9mm');
        if (gd.state !== 'dead' && gd.weapon.def.id !== want) { gd.weapon = new Firearm(WEAPONS[want]); gd.reloadT = -1; }
        const long = longRigOf(gd), cb = long !== null; const an = gd.char.anim; const def = gd.weapon.def;   // (long: WHICH long gun — the FN2000 in an operative's hands has its own grip point and muzzle, guards.ts longRigOf)
        if (an.longGun !== cb) { an.longGun = cb; an.longSteady = long === 'sc20k' ? 1 : 0; gd.char.muzzleAhead = long === 'sc20k' ? sc20kMuzzleAhead() : cb && def.rig !== 'carbine' ? carbineMuzzleAhead() : def.muzzleAhead; }   // (longSteady: a man handed Sam's bullpup — the breach's operatives — carries it as player.ts armRifle has Sam carry it, the gun riding his shoulders' mean line at a run instead of pumping with the run clip's arms (character.ts LONG_STEADY); the carbine men keep theirs as the poses pass left them, 0 — carbine-probes (4) places the trigger hand by the unsteadied carriage)
        if (long === 'sc20k') an.longGrip = grip20k ??= sc20kGrip(); else if (cb) an.longGrip = grip ??= carbineGrip();
      }
    }
    this.director.tick(dt, input, cam);   // the level script (director.ts): its drills sequenced, triggers read off last frame's settled world + this frame's events, beats resumed, a showcase's camera pinned — before anybody moves on an order; a return on its first line when no program runs
    tacticsTick(this, dt);   // pursuit tactics (tactics.ts): lapse the kill-zone doorways, read this frame's rounds for them, keep the flanking plans honest and deal new ones — before anybody moves on a role; nothing with tune.tactics off
    needsTick(this, dt);     // needs-driven patrol variation (needs.ts): the men's slow needs fill, a trip under way is broken off by anything that has reached its man, a full one is dealt its trip at his waypoint — before the patrol branch runs his feet on it; nothing with tune.needs off
    for (const g of this.guards) updateGuard(this, g, dt);
    updateCivilians(this, dt);    // the cleaner / the late worker (civilians.ts): their eyes and ears (the guards' own tests), the loop, the fright, the run to a guard or a phone, what that guard then knows — after the shift has moved and heard, before the escalation reads anybody
    updateEscalation(this, dt);   // after the guards: this frame's alert states settle the episode, the level and the lockdown duties they read next frame
    updateQrf(this, dt);          // the response to going loud (qrf.ts): the trigger off this frame's alarm level / gunfire heard / bodies found, the radio telegraph, the element's script and senses — a return while idle
    this.updateDoors(dt, input);
    updateMission(this, dt, input);   // after the guards (this frame's sightings) and the other F handlers; before updateTargets bakes the rack's switch state
    this.updateProps(dt);
    this.destr.update(dt);   // destruction (destruction.ts): the beaten-zone heat decays, the caps refill, the rigid debris tumbles / lands / sleeps (its landings are heard through 'prop' events pushed here)
    this.events = this.events.filter(e => this.time - e.time < 0.5);
    updateTargets(this, dt);
    updateDevices(this, dt);   // the level's cameras / tripwires / the code being keyed (devices.ts): after the targets (this frame's power / OCP / broken state) and everybody's movement
    this.weather.update(dt, cam.yaw);   // the storm (weather.ts): strokes into / out of the light set, thunder due, the wet lot, the frame's rain numbers — after the fixtures, before the meter's queries below
    updateWetness(this, dt);            // wet characters (wet.ts): whoever stands under the open sky in the rain this frame soaks, everyone else dries; Sam's drips and print budget — after the weather has written this frame's rain
    this.wind.update(dt);               // WIND (wind.ts): every source's speed this frame (cycling, the mains, the gusting; the storm off the weather just written, the door gusts off the leaves just swung) → the particles' wind records + the smoke solver's block — a return at tune.wind 0
    this.moths.update(dt);              // the moths' orbits (moths.ts) — after the wind that scatters them
    updateRainFx(this, dt, cam);        // PARTICLE RAIN (rainFx.ts): the near-field drop recycler + drips + the lattice's stand-back disc (frame.weatherE) — after the wind (its drops ride the same field) — a return that zeroes the disc unless settings.particleRain is on and rain is drawn
    updateItems(this, dt);
    updateGlass(this);   // glass: a stun charge beside the glazing stars the panes near it (this frame's 'bang' events, each looked at once) — and, with glass breaking on, takes cells out of them
    this.glassBreak.update(dt);   // glass breaking (glassbreak.ts): queued cells fall as shards within the frame's budget, the support pass drops the tongues left hanging, the gusts through shot-out exterior panes — nothing to do unless a pane has been hit with the switch on
    // characters → GPU skin instances + RT proxies
    const all: Character[] = [this.player.char, ...this.guards.map(g => g.char), ...civiliansShown(this).map(c => c.char)];   // (civilians last: past the renderer's eight-figure shadow-capsule budget it is they who go without, never the shift — civilians.ts)
    this.dynBoxes.length = 0;
    this.doors.boxes(this.dynBoxes);
    this.props.boxes(this.dynBoxes);
    this.items.boxes(this.dynBoxes);
    this.destr.boxes(this.dynBoxes);    // the destruction lane's rigid debris (tiles, housings, clutter): shadow-casting boxes inside the tier's cap
    deviceBoxes(this, this.dynBoxes);   // camera bodies / LEDs, keypad plates, emitters and their beams (devices.ts — dynamic, like the leaves: nothing of them is baked)
    this.moths.boxes(this.dynBoxes);    // the moths (moths.ts): a dozen fluttering NoShadow specks under the lit sodium lamps at night, none by day / lamp out / in a gale
    if (this.rings.length) ringBoxes(this, this.dynBoxes);
    // world size of one internal pixel at the look-at depth (thin props — the lasers, the tracer streaks — widen to stay ≥ ~1 px and dim by the same factor). Under sharp direct's DECOUPLED
    // jitter the raster that draws them is the un-jittered OUTPUT one, where a line thinner than a pixel is not integrated into a faint continuous one by the jitter but drawn dashed:
    // there the size is an OUTPUT pixel taken at 1.6× the look-at depth (the far third of a typical frame), so a beam still covers a pixel centre on every row it crosses
    const sharpStill = this.engine.sharpOn && this.engine.settings.sharpDecouple;
    this.mPerPx = 2 * cam.distance * (sharpStill ? 1.6 : 1) * Math.tan(cam.fov / 2) / Math.max(200, canvas.height * (sharpStill ? 1 : (this.engine.effectiveScale || 1)));
    handProps(this, this.dynBoxes);
    for (let i = this.fx.length - 1; i >= 0; i--) { const f = this.fx[i]; this.dynBoxes.push(f.box); f.ttl -= dt; if (f.ttl <= 0) this.fx.splice(i, 1); }
    if (!this.tune.tracers && this.tracers.live) this.tracers.clear();   // the flag off (panel, console, the soak) = nothing in flight from this frame, not just nothing new
    this.tracers.update(dt, this.dynBoxes, this.mPerPx);   // tracer streaks fired this frame or still in flight: heads advance, boxes out, head lights moved, embers into the sparks (before sparks.update so an ember shows the frame it lands) — a return when none is alive
    this.sparks.update(dt, this.col); this.sparks.boxes(this.dynBoxes);   // before smoke.update() this frame reads the trail emitters' tracked positions
    updateParticleFx(this);   // the GPU particles' one CPU-side duty: spent cases heard landing when they are due (particleFx.ts) — a return with none pending
    // characters wading through smoke push it around
    for (const c of all) {
      const sp = Math.hypot(c.vel[0], c.vel[2]); if (sp < 0.25 || !c.bones.hips) continue;
      const dirv: Vec3 = [c.vel[0] / sp, 0.05, c.vel[2] / sp];
      this.smoke.push({ pos: c.bones.hips, dir: dirv, speed: sp * 1.15, radius: 0.3 });
      if (c.bones.chest) this.smoke.push({ pos: c.bones.chest, dir: dirv, speed: sp * 1.1, radius: 0.26 });
    }
    const world = this.engine.world; world.resetCapsules();
    const wetOn = (this.engine.settings as { wetChars?: boolean }).wetChars !== false;   // wet characters (wet.ts): the renderer's switch — off (or a dry man) hands the g-buffer zeros, and it shades him exactly as before
    all.forEach((c, i) => {
      this.chars.setInstance(i, c.skel.jointData, c.tint, c.tint2, c.id, wetOn && (c.wet > 0 || c.beads > 0) ? (f, o) => { wetInstance(this, c, true, f, o); wetKnobs(f, o + 4); wetLineRow(c, f, o + 12); } : undefined);
      let capAlb = v3.lerp(c.tint, [0.5, 0.5, 0.5], 0.3);
      if (wetOn && c.wet > 0) { const k = 1 - 0.35 * c.wet; capAlb = [capAlb[0] * k, capAlb[1] * k, capAlb[2] * k]; }   // his shadow proxies (what bounce rays and reflections see of him) darken with the coat like the fabric on screen
      const { caps, bound } = c.capsules(); world.addCharacterCapsules(c.id, capAlb, caps, bound);
    });
    this.chars.finish(all.length);
    world.dynamics = this.dynBoxes;
    // light meter queries — the SENSORS (sensors.ts): Sam's own meter asked at chest and head (his proxies skipped), the guards' smoke sight lines to him, then his read
    const pc = this.player.char; const S = this.sensors;
    S.ask('playerChest', pc.bones.chest ?? v3.add(pc.pos, [0, 1.2, 0]), PLAYER_ID);
    S.ask('playerHead', pc.bones.head ?? v3.add(pc.pos, [0, 1.6, 0]), PLAYER_ID);
    const chest = pc.bones.chest ?? v3.add(pc.pos, [0, 1.1, 0]);
    this.guards.forEach((g, i) => {
      if (g.state === 'dead') return;
      const eye = g.char.bones.head ?? v3.add(g.char.pos, [0, 1.65, 0]);
      g.smokeTrans = S.segment(`smoke${i}`, eye, chest) ?? 1;   // (clear air until the probe has answered — headless, always)
    });
    const r1 = S.read('playerChest'), r2 = S.read('playerHead');
    if (r1 !== undefined && r2 !== undefined && Number.isFinite(r1) && Number.isFinite(r2)) {   // (a NaN / ∞ off a readback — a lost device, a resize race — is no reading: one frame of it damped in and the meter, and every eye that reads it, was NaN for good; review A6.4)
      const E = Math.max(r1, r2); this.player.irradiance = E;
      this.player.visibility = damp(this.player.visibility, this.visibilityOf(E), 6, dt);
    }
    if (!Number.isFinite(this.player.visibility)) this.player.visibility = Number.isFinite(this.player.irradiance) ? this.visibilityOf(this.player.irradiance) : 0;   // …and a meter poisoned by any other road heals to what the last good irradiance says (dark, failing that) instead of staying NaN
    if (!Number.isFinite(this.player.irradiance)) this.player.irradiance = 0;
    this.player.hitFlash = Math.max(0, this.player.hitFlash - dt * 3);
    this.act = null;   // (this frame's Space verb has been read by everyone who reads it)
    this.saves.tick(this, dt);   // checkpoints (savestate.ts): the autosave triggers off the frame as it now stands, and a waiting request written once the gates pass — the last thing, so a save is the whole settled frame
    this.journal.frameEnd();     // …and the session journal closes the frame (the sensors' reads folded in, a digest on the beat) — after everything, so a digest is the whole settled frame too
  }
  /** Scripts / probes / the tour: put the highlight on the row of `kind` (the one whose verb is `verb`, if given) in this frame's list, so the next Space tap does
   *  THAT — the by-hand equivalent of holding Space and scrolling to it. False if no such row is on offer right now. */
  selectVerb(kind: Interactable['kind'], verb?: Verb): boolean {
    const i = this.nearby.findIndex(r => r.kind === kind && (!verb || r.verb === verb));
    if (i < 0) return false;
    this.player.nearSel = i; pickHover(this); return true;
  }
  /** Esc, before the pause menu gets it (main.ts): the open selector backs out / a running sustained verb stops. True = used here, no menu this press. */
  escape(): boolean { return escapeInteract(this); }
  /** The light meter's mapping, irradiance (W/m², max over the axes as the probe reports it) → 0‥1 visibility: 0 at or below visFloor, 1 by visFloor·e^(1/visSlope).
   *  One mapping for the meter on Sam and for a searcher judging how dark a hiding place is (guards.ts): dark for the one is dark for the other. */
  visibilityOf(E: number): number { return clamp(this.tune.visSlope * Math.log(Math.max(E, 1e-5) / this.tune.visFloor), 0, 1); }


  private updateDoors(dt: number, input: Input) {
    const pl = this.player; const pc = pl.char;
    const own: DoorContact | null = pl.down ? null : { pos: pc.pos, radius: 0.34, bash: pl.sprinting, who: PLAYER_ID, quiet: pl.crouch, keys: pl.keys };   // his pocket's keys (Player.keys — none until a questioned man hands his over): a locked leaf whose lock none fits is a wall to you (Doors.update reports it in blockedBy); one that fits, and it pushes open as it does for the staff
    const contacts: DoorContact[] = own ? [own] : [];
    for (const g of this.guards) if (g.state !== 'dead') contacts.push({ pos: g.char.pos, radius: 0.34, bash: g.state === 'alert' && g.speed > 2.2, who: g.char.id, quiet: false, key: true });   // staff carry keys: locked doors open to them and lock again behind them (closer + latch) — every man, whatever Sam has had off his belt (Guard.keys is what he can hand over, not what the leaves ask)
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
    if (act?.kind === 'body' && act.guard) { if (verb === 'drop') { if (pl.dragging) this.toggleDrag(); } else if (verb === 'drag') this.toggleDrag(act.guard); }
    // the mains breaker by hand: throw it (a long trip — the nearest calm guard is sent to reset it exactly as after an OCP burst, and gets there in his own
    // time) or, thrown already and not destroyed, re-arm it. A shot breaker is scrap: no row.
    if (act?.kind === 'breaker') {
      if (verb === 'breakerOn' && this.blackout.active && !this.blackout.permanent) this.endBlackout(); else if (verb === 'breakerOff' && !this.blackout.active) this.setBlackout(86400, 'hand');   // (thrown by hand it stays thrown: a guard sent to it, or Sam, puts it back — not a timer)
    }
    // A living guard from behind: his one row GRABS him — an arm round his throat with the hands empty, the pistol to his head with it drawn (player.ts startGrab /
    // updateHold — questions, the choke / the whip are HIS rows from then on). The silent takedown is the other hand's business (Chaos Theory's melee): a LEFT
    // CLICK with the hands empty — holstered, E — on the man in reach behind, whatever the panel highlights; with the pistol drawn a click is a round (updatePlayer
    // fired it), so you holster first. One gate for both (buildInteractables' inReach).
    { const free = !pl.takedown && !pl.down && !pl.holding;
      const viaClick = pl.holstered && input.lmbHit() ? (this.nearby.find(it => it.kind === 'guard' && it.inReach)?.guard ?? null) : null;   // click, hands empty: the man in reach
      if (viaClick && free) startTakedown(this, viaClick);
      else if (act?.kind === 'guard' && verb === 'grab' && act.guard && free) startGrab(this, act.guard);
    }
    // A door in reach, one row per thing it can be made to do: shut → 'push it open' (Doors.use: away from you, its creak) / 'ease it open — silent' (started
    // here, run below: Doors.crack a few degrees a second until it stands open at EASE_MAX, or a step / Space / Esc stops it where it is — interact.ts); open →
    // 'pull it shut'; locked against you (Doors.lockedOut) → 'pick the lock' (player.ts startPicking, on its own clock from there), 'kick it in' (loud, the keep
    // torn out), crouched also 'try the handle' (a clack and 'won't budge'); locked but its key in his pocket (Player.keys, off a man he questioned) → 'unlock it'
    // (the key's clack, then the creak: Doors.use) / 'ease it open' (key and leaf round together in silence) — a door like any other, that locks again behind
    // him. With a man in his arm no door row exists: the pair pushes leaves open by walking into them, and HIS key turns the locked ones (the contacts below).
    if (act?.kind === 'door' && act.door) {
      const d = act.door;
      if (verb === 'push' || verb === 'pull' || verb === 'unlock') this.doors.use(d, pc.pos, PLAYER_ID, pl.keys);
      else if (verb === 'ease') { if (!this.doors.lockedOut(d, pc.pos, pl.keys)) { pl.easing = d; pl.easeStallT = 0; pl.easeBest = Math.abs(d.angle); } }
      else if (verb === 'pick') { if (this.doors.lockedOut(d, pc.pos, pl.keys)) startPicking(this, d); }
      else if (verb === 'kick') startKick(this, d);
      else if (verb === 'rattle') { this.doors.rattle(d, PLAYER_ID); this.msg(d.def.steel ? 'the stair door: bolted from the landing side, no keyway on this face — not the way out tonight' : 'locked — pick it (quiet, slow) or kick it in (loud)'); }
      else if (verb === 'code') startCoding(this, d);   // a keypad door whose code he knows: key it in (devices.ts — sustained, four beeps, then it swings like a keyed door)
      else if (verb === 'nocode') denyPad(this, d);     // …and one whose code he does not: the pad refuses (a deny tone, a word)
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
    const bx = pc.pos[0], bz = pc.pos[2];
    this.doors.update(dt, contacts);
    this.handsOnDoors(angles);   // who is walking which leaf open (or easing it): his free hand goes on it (character.ts doorLayer, posed next frame)
    if (own) { settlePlayer(this); settleHeld(this); if (Math.abs(pc.pos[0] - bx) + Math.abs(pc.pos[2] - bz) > 0.005) pc.update(0); }   // a leaf shoved him (or the man in his arm: the pair gives as one, settleHeld): settle that against the statics now (never drawn inside the wall a held leaf pressed him onto), and re-bake the pose where he ended up
    // ran full tilt into a leaf that is locked against you: that is a kick (square on — brushing past the latch edge at a run is not)
    if (own?.blockedBy && pl.sprinting && !pl.kick && !pl.picking && !pl.coding && !pl.takedown && !pl.holding && !this.puppet) {
      const d = own.blockedBy; const u = d.dir(); const into = -(-u[1] * pc.vel[0] + u[0] * pc.vel[2]) * this.doors.side(d, pc.pos);   // speed INTO the leaf from your side (its normal on your side is (−u.z, u.x)·side)
      if (into > 1.5) startKick(this, d);
    }
    for (const { c, ch, i } of bodyContacts) { const p = ch.ragdoll!.x; ch.ragdoll!.nudge(i, c.pos[0] - p[i * 3], c.pos[2] - p[i * 3 + 2]); }   // whatever a leaf pushed
    // a leaf that moved wakes the bodies asleep within its reach: one slumped against it must slide down when it swings away (a sleeping ragdoll never looks)
    if (bodies.length) this.doors.list.forEach((d, k) => {
      if (Math.abs(d.angle - angles[k]) < 1e-3) return;
      for (const ch of bodies) { const h = ch.bones.hips ?? ch.pos; if (ch.ragdoll!.sleeping && Math.hypot(h[0] - d.def.hinge[0], h[2] - d.def.hinge[1]) < d.def.width + 1.2) ch.ragdoll!.wake(); }
    });
  }

  /** per living character: the leaf his hand is on (or was, a moment ago), when he last actually pushed it, whether that was the player easing it by hand, and
   *  which hand this push settled on (−1: not yet; t0 = when the record began) */
  private doorHandRecs = new Map<Character, { door: Door; t: number; t0: number; crack: boolean; hand: 0 | 1 | -1; holdOnly?: boolean }>();
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
    const who: { c: Character; can: boolean; player: boolean; rightFree: boolean }[] = [{ c: pl.char, player: true, can: !pl.down && !pl.dragging && !pl.holding && !pl.kick && !pl.picking && !pl.takedown, rightFree: pl.holstered }];
    for (const gd of this.guards) who.push({ c: gd.char, player: false, can: gd.state !== 'dead' && !gd.held, rightFree: gd.state === 'patrol' && !gd.drawn && !!gd.dropped });   // (a calm man's right has the torch unless the grab knocked it out of it; any other state's, the pistol)
    for (const cv of civiliansShown(this)) who.push({ c: cv.char, player: false, can: cv.state !== 'dead' && !cv.held && !cv.char.anim.act, rightFree: true });   // (a civilian's hands are both free — unless a task's clip has them: civilians.ts)
    for (const c of recs.keys()) if (!who.some(w => w.c === c)) recs.delete(c);   // characters a restart / reset replaced
    for (const { c, can, player, rightFree } of who) {
      let rec = recs.get(c);
      if (can) {
        let hit: Door | null = null, crack = false, holdOnly = false; const speed = Math.hypot(c.vel[0], c.vel[2]);
        for (let k = 0; k < list.length && !hit; k++) {
          const d = list[k]; const [hx, hz] = d.def.hinge, W = d.def.width;
          const vx = c.pos[0] - hx, vz = c.pos[2] - hz; if (vx * vx + vz * vz > (W + 1.2) ** 2) continue;
          if (player && pl.easing === d) { hit = d; crack = true; break; }
          const u = d.dir(); const along = vx * u[0] + vz * u[1], perp = u[0] * vz - u[1] * vx;
          const t = clamp(along, 0, W); const dist = Math.hypot(vx - u[0] * t, vz - u[1] * t);
          const touching = along > 0.14 && along < W + 0.3 && dist < 0.34 + d.thick / 2 + 0.05;   // (0.34: the living contacts' radius, updateDoors)
          const sgn = perp >= 0 ? -1 : 1, da = d.angle - before[k];                                // the way a push from his face turns it (Doors.update), and the way it went
          // pushing it: it turned his way this frame — or holding it off: standing in the swing of a leaf open his way whose closer would bring it back onto him
          // (it does, every couple of seconds, and his contact shoves it back: without this the hand came up for each shove and dropped between them)
          const holding = touching && d.def.closer !== false && Math.abs(d.angle) > 0.1 && Math.sign(d.angle) === sgn && speed < 0.4;
          const pushing = touching && da * sgn > 1e-4;
          if (pushing || holding) { hit = d; holdOnly = !pushing; break; }
          // …or about to: walking at a leaf that will yield to him, his stride crossing it inside 0.4 s — the hand comes up on the way in and is on the wood as he
          // meets it (and the controller has that long to square him to it: player.ts). Not one locked against him, nor one already hard on its stop his way.
          if (!touching && speed > 0.3) {
            const wx = c.vel[0] / speed, wz = c.vel[2] / speed; const closing = -(wx * -u[1] + wz * u[0]) * Math.sign(perp);   // his speed's share straight into the leaf plane, from his side
            if (closing > 0.4) {
              const tHit = (Math.abs(perp) - 0.34 - d.thick / 2) / (closing * speed);                                            // seconds to contact at this rate
              const ah = along + (wx * u[0] + wz * u[1]) * speed * Math.max(0, tHit);                                            // where along the leaf he meets it
              const atStop = sgn < 0 ? d.angle <= d.minA + 0.02 : d.angle >= d.maxA - 0.02;
              if (tHit >= 0 && tHit < 0.4 && ah > 0.2 && ah < W + 0.1 && !atStop && !(player && this.doors.lockedOut(d, c.pos, pl.keys))) hit = d;
            }
          }
        }
        if (hit) { if (rec) { if (rec.door !== hit) { rec.hand = -1; rec.t0 = now; } rec.door = hit; rec.t = now; rec.crack = crack; rec.holdOnly = holdOnly; } else recs.set(c, rec = { door: hit, t: now, t0: now, crack, hand: -1, holdOnly }); }
      } else if (rec) { recs.delete(c); rec = undefined; }
      if (rec && Math.hypot(c.pos[0] - rec.door.def.hinge[0], c.pos[2] - rec.door.def.hinge[1]) > rec.door.def.width + 1.2) { recs.delete(c); rec = undefined; }   // carried off (a teleport, a tour cut, a restart): no easing an arm out toward a door rooms away
      if (!rec || now - rec.t > FOLLOW + FADE) { if (rec) recs.delete(c); c.anim.doorPush = null; continue; }
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
        if (-nx * Math.sin(c.bodyYaw) - nz * Math.cos(c.bodyYaw) > 0.5 && now - rec.t0 > 0.25) rec.hand = hand;   // settled only once he faces it (within 60°) and his shoulders have had their quarter second to square to it (character.ts dp.tw): met with his back, his flank or his chest twisted off to the aim he is still coming round, and left and right trade places as he does
      } else { hand = rec.hand; sp = spot(hand); }
      c.anim.doorPush = { p: sp.p, n: [nx, 0, nz], w: now - rec.t <= FOLLOW ? 1 : 0, hand: rec.hand === -1 ? -1 : hand, holdOnly: rec.holdOnly };   // (unsettled: the layer squares him up to it and raises nothing — no false start with the hand he will not use)
    }
  }

  /** Loose furniture: same contact pattern as the doors (after everyone has moved and been collided with the statics this frame): characters are
   *  circles that shove props and are held back in place by whatever a prop cannot yield; door leaves sweep props aside. */
  private updateProps(dt: number) {
    const pl = this.player;
    const chars: Character[] = pl.down ? [] : [pl.char];   // a body on the floor neither pushes furniture nor gets pushed
    for (const g of this.guards) if (g.state !== 'dead') chars.push(g.char);
    for (const cv of civiliansShown(this)) if (cv.state !== 'dead' && !civilianSeated(cv) && civilianPushesProps(cv)) chars.push(cv.char);   // (a FRIGHTENED civilian shoves a chair aside like anybody; a calm one at work is no contact for the furniture — civilians.ts civilianPushesProps: her loop is authored clear of it and a brushed chair corner must not scrape, roll the dice or move — nor is the man in, or heading for, his own chair)
    const contacts: PropContact[] = chars.map(c => ({ pos: c.pos, vel: c.vel, radius: 0.3, who: c.id, mass: 75, quiet: c.id === PLAYER_ID && pl.crouch }));
    const before = chars.map(c => [c.pos[0], c.pos[2]]);
    this.props.update(dt, contacts, this.col.dynamicBoxes);
    if (!pl.down) { settlePlayer(this); settleHeld(this); }   // a chair driven into him by a man or a leaf held him back INTO the wall behind him: the statics win, this frame — and one that would not yield to the man in his arm holds the pair back as one (settleHeld), not him off his station
    // someone held back by a pinned prop was posed (bones, skin, capsules) at the uncorrected spot inside it earlier this frame: re-bake in place (dt 0)
    chars.forEach((c, i) => { if (Math.abs(c.pos[0] - before[i][0]) + Math.abs(c.pos[2] - before[i][1]) > 0.005) c.update(0); });
  }

  dropThrowable(kind: ThrowKind, p: Vec3) { return dropThrowable(this, kind, p); }
  throwCount(kind: ThrowKind) { return throwCount(this, kind); }











  objectivePos() : Vec3 | null { return objectivePos(this); }
  objectiveText() : string { return objectiveText(this); }

}

