// Player controller: movement / crouch / sprint under real or puppet input, back-to-the-wall (Q), the pistol and rail light + its OCP, the FN2000 (kit slot 2: SEMI / AUTO on the left button, its attachment — the ring launcher — on the right, its light), throws, silent takedown and body drag, plus the cursor: what is under it and what Space would do (interactables).
// (Split out of game.ts mechanically: plain functions taking the Game as their first argument; Game keeps one-line delegators for
//  anything other files call.)
import { SideMap } from '../math/side';
import type { View } from '../host/hud';
import { backHit } from './backkey';
import { Vec3, v3, clamp, wrapAngle, approachAngle, damp, DEG, smoothstep } from '../math/vec';
import { Input } from './input';
import { FollowCamera } from './camera';
import { Doors, Door, DOORWAY } from './doors';
import { RAG } from './ragdoll';
import { ThrowSolution } from './throwables';
import { rigLightPose, sc20kGrip, sc20kMuzzleAhead, sc20kLightPose, sc20kLauncherMuzzle, modelGrip, modelMuzzleAhead } from './rigProps';
import { gunLookOf } from './gunlook';   // (called inside armRifle only)
import { PLAYER_ID, DRIVE_REACH, DRIVE_SECS } from './consts';
import { handworkOn, samWork, samWorkHand, samWorkLetGo, workStand, WORK_TURN } from './handwork';
import { WORKSTOW, samStowTick, samStowing } from './workstow';
import { disarmBegin, disarmCatch, disarmPose, type Strip } from './disarm';
import type { SamWork } from './handwork';
import { tread } from './floor';
import { samLoadPace, loadGait, loadHeard } from './kitload';   // what his card weighs: his legs' pace and his footfall (as asked with its switch off)
import { rackDist, tally } from './mission';
import { quietWords } from './quiet';   // (called inside buildInteractables only)
import { chronicle, chronKey, chronDoor, chronThrown, chronGrab } from './chronicle';
import { fireWeapon, killGuard, dropFromHand, flashFuse } from './combat';
import { FRAG, FRAG_STATS, restOfThrow } from './frag';
import { kickScuff } from './marks';
import { hammerBlows } from './bigkit';
import { BIGSLOT, kitYouLight, kitYouNvg } from './kit';   // (the two asked at the two keys and each frame beside them: a card that left your light or your goggles at home — kittree.ts)
import { lockPoint } from './shotgun';
import { samBig, samBigTick, bigSide, samBigSpot, samBigFar, samBigWalk, samBigPose, samBigTailTick, samBigEnded, samBigDrop, samBigLeadOf } from './bigkit';
import { samSpread } from './suppression';
import { isHurt } from './condition';   // (a hurt man does not sprint: Shift is not a run for him, so it lets go of nothing either)
import { fireRing, ringSolve, ringAimPoint } from './launcher';
import { fireShell, shellSolve, shellAimPoint, shellBodies, arcArmed, HE40 } from './he40';
import { LAUNCHER, LAUNCHER40 } from './weapons';
import { STICKY, camAimPoint, camSolve, fireCam, stickyRows } from './stickycam';
import { switchRows } from './lightswitch';
import type { Rifle, RifleAttachment } from './weapons';
import { GEAR, gearText, ringTag } from './gear';   // (a leaf: the kit's names as issued, applied to the lines that name it)
import { samAim, AIM, AIM_HOOKS, SNAP_PX } from './aim';
import { AIMCOST } from './aimcost';
import { ocpable, lensClear } from './lighting';
import { deadLamp } from './carlamps';
import { GUNWALL, breachAim, gunWalled, gunWallIs, gunClearFrom, woodBetween, gunWallPose, gunWallStance } from './gunwall';
import { friendNoSnap, friendOnRay, samOffFriend } from './friends';
import { noShoveBegin, noShoveMan, noShoveBack, noShoveNote } from './noshove';
import { samStaggered, samRooted, samBlind, samStunPose } from './samstun';
import { SPRINTDOOR, SPRINTDOOR_STATS, sprintDoorPace, sprintDoorLean, sprintDoorHead } from './sprintdoor';
import { tearOff } from './doorblast';
import { aimWeighBegin, aimWeighTurn, aimWeighShot, aimWeighLaunch, aimWeighLaunchKeep } from './aimweight';
import { THROW_RELEASE, HOLD, RUNREADY } from './character';
import { WALLSNAP, wsTakeSecs, wsEase, wsHit, wsCornerAngle, wsSeenDeg } from './wallsnap';
import { HANDSLOT, HANDSLOT_KEY } from './handslot';
import { THROWBACK } from './throwback';
import type { HoldPhase, HoldVariant, LongStance } from './character';
import type { StaticCollision } from '../scene/collision';
import type { Game, Guard, Player, ThrowKind, Interactable, Verb } from './game';
import { isBreathing } from './game';
import { endGuardScript } from './squad';
import { resetChase, handCarry, inHand, gunBack } from './guards';
import { whistleKey } from './whistle';
import { WAND, WAND_STATS, wandOffered, wandFits, wandTurn, wandDrop, wandThrough } from './wand';
import { ownBlowRow } from './ownblow';
import { wallChargeRows } from './wallcharge';
import { defuseRows } from './defuse';
import { rescueEndRows } from './rescueend';
import { snatchOutRows } from './snatchout';
import { STALK, stalkStep, stepEase } from './stalk';
import { TAPSTEP, tapTick, tapOff, tapHeld } from './tapstep';
import { closeLive, CLOSE, closeRows, closeCivGate, closeCivOffer, closeTick, closeBlow, closeAt, closeKindOf, closeStation, closeNoise, closeTook, closeSeated, closeUnseat, closeBare } from './close';
import { feedDeal, feedPlan, feedPlay, shellPlan } from './gunreload';
import { KITANIM, kitTick, kitClick, kitReload, kitReloadNote, kitGunUp, kitNv, kitNvEye } from './kitanim';
import type { CloseKind } from './close';
import { wetFootfall } from './wet';
import { HANDS, bodyGripDist, haulBegin, haulPins, haulSlack, haulSetDone, haulSpeed, haulUpright, haulCrouch, haulYaw, handsStep, handsCancel, doorMoveLowers } from './hands';
import { padState, stopCoding, spell, CODE_SECS, padDoorName } from './devices';
import { civilianGrabbed, civilianComply, civilianSamLine, civilianBodies, civiliansShown } from './civilians';
import { promptFor, agitationOf, samLineFor, samRemarkFor, samKeyLineFor, CIV_LINES } from './dialogue';
import { autoReloadDue, autoReloads } from './autoreload';   // a dry gun starts its own reload (autoreload.ts): the R line below asks it
import { slotSetupKeys, loadKeys } from './slotsetup';
import { QUICKTHROW } from './quickthrow';   // the G quick throw's switch (quickthrow.ts): off in the page, G is then a dead key here
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { STEALTHPOSE } from './stealthpose';
import { stealthFeed } from './stealthfeed';   // Sam's hands-empty crouch poses (stealthpose.ts): what the animator is told each frame
import { planKnee } from './planmode';   // (called inside the update only)
import { takeBegin, takeFall, takeLower, takeKill, takeBeats, takeHaul, TAKEDOWN } from './takedown';   // a takedown's own move and the fall it leaves (takedown.ts): poses only

/** the player's movement circle: wider than the body so arms / gun don't clip into walls */
const BODY_R = 0.42;
/** living guards are solid to you out to this (centre to centre) */
export const KEEP_OFF = 0.55;

// ------------------------------------------------------------ the grab / hold (docs/internal/grab-interrogate-design.md §1: slice 1 the arm variant, slice 4 the gun variant)
//                                                              the 'grab him' row on a living guard from behind (game.ts updateDoors acts on it) — the silent takedown
//                                                              is a left click with the hands empty, never Space
/** with a man in your arm: m/s forward and sideways, m/s backing the pair up (hauling him), and the rad/s the pair comes round at toward the cursor — slow enough
 *  that a man who commits to your flank gets his half second before the pair faces him */
const HOLD_PACE = 0.85, HOLD_PACE_BACK = 0.65, HOLD_TURN = 2.6;
/** An exchange is Sam's line, then the man's answer when Sam's bubble ends (askHeld / answerHeld). INTERROGATE_GAP: seconds of his answer he always gets out
 *  before the next tap can cut in on it with the next question (a tap sooner only cuts the line short — and once that cut line is gone the next tap asks: there
 *  is nothing of it left to keep); ANSWER_TAIL: the last stretch of an answer that counts as over (the row stops offering to cut in; the tour's beat waits for it).
 *  Sam's own line is never cut: a tap while he speaks does nothing — the answer is coming. */
const INTERROGATE_GAP = 1.2, ANSWER_TAIL = 0.5;
/** how long Sam's line hangs over him before the man answers (s): a beat, stretched a little for a longer line — SAM_MAX_CHARS keeps them to a clause or two */
export function samBeat(chars: number): number { return clamp(0.7 + 0.018 * chars, 0.9, 1.4); }
/** hearing levels ('prop' events at the pair, the room's business not the floor's — the takedown's thud is 0.3): the scuffle of the grab, the choke going on, him
 *  hitting the floor at the end of it, the crack of the pistol on his skull and him going down under it (the loudest of them: a whip is quick, not quiet) */
const GRAB_NOISE = 0.12, CHOKE_NOISE = 0.15, FOLD_NOISE = 0.3, WHIP_NOISE = 0.35;
/** audio only (nothing the AI hears): seconds between grains of the choke's strain — 'chokeStrain' is one 0.6 s grain, retriggered off the beat's own clock while
 *  the arm is closed, so a choke eased off needs nothing stopped (the last grain just dies) */
const CHOKE_GRAIN = 0.4;
/** firing past the man in the arm (the gun variant, LMB): one-handed from beside his jaw — seconds between rounds (single, deliberate shots) and the spread they go
 *  with (combat.ts fireWeapon: ± half of it per axis on the unit direction ≈ ±2.6° — a torso at 6 m mostly, not always) */
export const HOLD_FIRE_CD = 0.7, HOLD_SPREAD = 0.09;
/** Player.holding while Sam has a man from behind. phase / t: the beat (HOLD.secs) — 'grab' easing in behind him and the arm coming round (he is frozen, not yet
 *  turned), 'held' the pair locked HOLD.dist apart on Sam's facing, 'choke' the same with the arm closing (chosen off its row, it runs to HOLD.secs.choke on its
 *  own; a Space tap, a step or Esc sooner = he breathes), 'whip' the pistol coming off his head and down behind his ear (likewise: stopped before HOLD.secs.whip
 *  it never lands). since: game time the hold proper began. windT: the commit beat — seconds since the choke / the whip was chosen (−1 = not chosen): at
 *  HOLD.secs.chokeHold the arm closes / the pistol cocks back (the timing the held key used to have; it does not run while the hand is between tools). variant:
 *  set at the grab by what was in the hand — 'arm' (holstered, or a canister up: both hands on him, the knife at his throat; his rows are the question and the
 *  choke) or 'gun' (the Five-seveN drawn: it goes to his head; a click fires past him, his one row is the whip, and no question is put over a gun) — and
 *  SWAPPED by E once he is held (swapHold: he draws / holsters with the man in the arm). swapT: seconds since that last happened (Infinity = never this hold):
 *  inside HOLD.secs.swap the hand is still changing tools and the row starts nothing. remarked: Sam has already said his piece on drawing this hold (one remark
 *  per hold). gunOut: 0‥1, the pistol presented off his head to fire (eased here, posed by the layer); fireQueued: a click waiting the few frames that takes;
 *  shotT: game time of the last round past him (−1 none: his flinch, and how long the gun stays presented). ask: the exchange in flight — Sam's line went up
 *  at `t` for `dur` (his bubble); the man's answer follows when it ends (updateHold → answerHeld); null between. after: a remark of Sam's waiting for the
 *  man to finish — his word on the key he has just pocketed (takeKey) — put up the first frame the answer is down and no question is going up, dropped by
 *  whatever kills a pending question (cancelAsk) or by the next question beating it to the air (askHeld); null when none waits. */
export interface Hold { g: Guard; variant: HoldVariant; phase: HoldPhase; t: number; since: number; windT: number; swapT: number; remarked: boolean; gunOut: number; fireQueued: boolean; shotT: number; ask: { t: number; dur: number } | null; after: { text: string; id: string } | null;
  /** the grab's disarm while it runs (disarm.ts: begun by startGrab, moved on once a frame by disarmTick, gone when the hand is back on him) */
  strip?: Strip;
  /** the stalk's grab (stalk.ts, game.ts): where Sam stood as it fired. The way in is then ONE step from there over STALK.catchSecs, where the grab's own
   *  is a snap (a fifth of the gap in its first frame). Unset = the grab as it was. `hitAt` = the game's time as that step landed (the yank's clock, for
   *  both poses); `yankM` / `yanked` = how far the man is hauled back after it (STALK.yank, less where there is no room) and how much of that is done */
  from?: Vec3; hitAt?: number; yankM?: number; yanked?: number; stepE?: number; stepM?: number; yaw0?: number; coil0?: number;
  /** close.ts CLOSE.rmbHold: the right button is on him (he was taken by it held down, or it was pressed in the arm) — 1 = the arm closes as soon as it has
   *  him, 2 = it is closed and stays so while the button is down (let go, or the choke stopped by anything else: unset, and the hold is a hold) */
  rmbChoke?: number; /** …and for how long the button has been down on him, s (a press made in the arm starts at 0: let go inside a tap, the choke is the whole one) */ rmbT?: number;
}

/** IN A DOOR FRAME HE IS AS WIDE AS HIS SHOULDERS. BODY_R is a margin for his arms and his gun, 0.84 m across; a real door (scene/doorSize.ts) leaves 0.83 m
 *  between its stops. So the circle the statics push on narrows to a man's own (DOOR_R — the men's, guards.ts) as his centre comes onto a doorway's middle line,
 *  and widens again as he leaves it: whole within `DOOR_FIT.lat[0]` of the middle line and `DOOR_FIT.out[0]` of the frame line, gone by `lat[1]` / `out[1]`,
 *  eased between (no step in it: nothing shoves him as it changes). Beside the frame, flat on the wall, he is as wide as ever. Every door of the level, standing
 *  or off its hinges: it is the hole in the wall that is narrow. */
const DOOR_R = 0.3, DOOR_FIT = { lat: [0.12, 0.5] as const, out: [0.55, 1.0] as const };
/** his collision circle's radius against the statics with his centre at `p` (the checks' own: tools/qa — a watcher that holds him to BODY_R reads the air a
 *  door frame gives him as a wall he is inside) */
export const playerBodyR = (g: Game, p: Vec3): number => bodyR(g, p);
/** the player's own push-out of the statics for a spot he is not standing on yet (doors.ts DOORWAY.solid: where a leaf may put him — Doors.settle) */
export function settleSpot(g: Game, p: Vec3) { const y1 = g.player.crouch ? 1.0 : 1.7; for (let k = 0; k < 4; k++) { g.col.collideCircle(p, bodyR(g, p), 0.2, y1, 6); if (!g.col.clampToWorld(p, BODY_R)) break; } }
function bodyR(g: Game, p: Vec3): number {
  let k = 0;
  for (const d of g.doors.list) {
    const dx = p[0] - d.frameCentre[0], dz = p[2] - d.frameCentre[2]; if (dx * dx + dz * dz > 1.3) continue;
    const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), lat = Math.abs(dx * ux + dz * uz), out = Math.abs(dz * ux - dx * uz);
    const kl = 1 - clamp((lat - DOOR_FIT.lat[0]) / (DOOR_FIT.lat[1] - DOOR_FIT.lat[0]), 0, 1), ko = 1 - clamp((out - DOOR_FIT.out[0]) / (DOOR_FIT.out[1] - DOOR_FIT.out[0]), 0, 1);
    k = Math.max(k, kl * kl * (3 - 2 * kl) * ko * ko * (3 - 2 * ko));
  }
  return BODY_R - (BODY_R - DOOR_R) * k;
}
/** Longest stride the collision sweep takes in one go: from a settled spot (the circle clear of every face) a stride this short cannot carry the centre past the
 *  middle of the thinnest thing in the level (8 cm cubicle panels: 0.42 + 0.04), so every push-out sends him back the way he came — never out of the far side. */
const SWEEP_STEP = 0.2;
/** The player's own collision: the BODY_R circle pushed out of the statics between shin height and `y1` (standing 1.7 / crouched 1.0 — under a desk top only on
 *  your knees), then held on the world's floor rectangle (the lot has no kerb: guards are kept in by the nav grid, you by this).
 *  It is a SWEEP, not a point test: wherever he has been put since the last time this ran (his own stride at 20 fps, a sprint plus a guard's shoulder, a door leaf
 *  swung into him, a chair driven into him, the takedown / kick / pick easing him onto a spot) he is walked there from the last settled spot (`Player.safe`) in
 *  strides of ≤ SWEEP_STEP, settled against the statics after each — so a displacement of any size slides along the wall it meets instead of resolving to
 *  whichever side of a 12 cm partition the raw position happened to land nearer (which is how he used to come out in the next room). */
function collidePlayer(g: Game, y1: number) {
  const pl = g.player, p = pl.char.pos, col = g.col, s = pl.safe;
  if (s) {
    const dx = p[0] - s[0], dz = p[2] - s[2]; const n = Math.min(32, Math.ceil(Math.hypot(dx, dz) / SWEEP_STEP));
    if (n > 1) { p[0] = s[0]; p[2] = s[2]; for (let i = 1; i < n; i++) { p[0] += dx / n; p[2] += dz / n; col.collideCircle(p, bodyR(g, p), 0.2, y1, 4); col.clampToWorld(p, BODY_R); } p[0] += dx / n; p[2] += dz / n; }
  }
  for (let k = 0; k < 4; k++) { col.collideCircle(p, bodyR(g, p), 0.2, y1, 6); if (!col.clampToWorld(p, BODY_R)) break; }   // (6 passes: three walls and a shelf end meeting in a pocket left him centimetres inside one of them at 3; and where the world edge and a static leave less than his width — the van's corner on the lot's rim — the two are alternated until they agree on the mouth of the wedge instead of each undoing the other)
  if (s) { s[0] = p[0]; s[1] = 0; s[2] = p[2]; } else pl.safe = [p[0], 0, p[2]];
}
/** May he stand up here? Anything static in the column between crouched head height and standing head height (a counter top's overhang, a shelf, a desk he
 *  crept under) says no — otherwise standing switches the collision headroom 1.0 → 1.7 and the sweep would shove him a foot out through the slab in one frame
 *  (the QA soak's 'popped 0.30 m' under the reception counter's north overhang). Non-destructive: settles a COPY of his spot against that band only. */
export function canStand(g: Game): boolean {
  const p = g.player.char.pos; const q: Vec3 = [p[0], p[1], p[2]];
  g.col.collideCircle(q, bodyR(g, p), 1.0, 1.7, 2);   // (as wide as he is HERE: in a door frame his shoulders are turned — bodyR)
  return Math.hypot(q[0] - p[0], q[2] - p[2]) < 0.01;
}
/** Settle the player against the statics NOW (game.ts, after the door leaves and the furniture have had their say this frame): whatever a leaf or a pinned chair
 *  shoved him into is resolved before anything draws or reads him — swept from where he last stood clear, like every move of his own. */
export function settlePlayer(g: Game) { const pl = g.player, p = pl.char.pos, s = pl.safe; if (pl.down || (s && s[0] === p[0] && s[2] === p[2])) return; collidePlayer(g, pl.crouch ? 1.0 : 1.7); }   // (nothing moved him since the last settle: nothing to do — the statics have not moved either)

/** TWO GEARS, NOT A DIAL (`on`; off = the wheel sets his pace and the crouch-walk is tune.playerCrouch, as it always was). The wheel's notches bought nothing a
 *  man sneaking could use: a footfall's level is the stance's × the floor's whatever the notch, a crouched step is under a man's ear at any pace, and one notch
 *  down a crouched man no longer gains on a patrol (1.13 against tune.guardWalk 1.15). On: the wheel is nobody's pace (his pace is whole, a saved notch
 *  included), the walk and the sprint are as they were, and the crouch-walk IS the sneak, at `crouch` m/s — under the walk, so the walk keeps its job, and
 *  0.3 m/s over a patrol's (the two metres from the close-in mode's edge to reach in about six seconds; it was thirteen). The sidle along a wall and a
 *  hauled body keep tune.playerCrouch. ON in the page unless ?twogears=0 (src/host/profile.ts pageSwitches); off here and on the harness's frozen stand
 *  (src/host/standup.ts; TPS_TWOGEARS=1 turns it on there). */
export const TWOGEARS = { on: false, crouch: 1.45 };
/** SHIFT IN A CROUCH IS A FAST CROUCH WALK (the maintainer, 10-23: "we can make sprint when crouching a really fast crouch walk, but you have to stand up to sprint
 *  properly"). With `on`, Shift held while he is crouched no longer stands him up into the sprint: he stays down and covers ground at `pace` (m/s; between
 *  the walk's 1.55 and the run), each footfall at `loud` (the crouch walk's is 0.125, the walk's 0.26, a run's 0.6: quicker than walking and heard further
 *  than walking, a good deal less than running), and it is no sneak (unseen.ts samSneaks). The sprint is the standing man's: [C] first. He is not
 *  `sprinting` — his hands are still his own (a door, a switch, a grab) — and a hold on left click (stalk.ts) is the creep whatever Shift says, as before.
 *  A body in tow is let go of, as a sprint's is. Not under a puppet or a tour (their Shift is the old one). Off = Shift stands him up, as it did.
 *  The page turns it on (?crouchrun=0 puts it back); off here and on the frozen stand (TPS_CROUCHRUN=1). Its look: character.ts DASH. */
export const CROUCHRUN = { on: false, pace: 2.5, loud: 0.34 };
/** the crouch-walk's top speed: the sneak's own under TWOGEARS, else the tune's */
export const crouchPace = (g: Game): number => TWOGEARS.on ? TWOGEARS.crouch : g.tune.playerCrouch;
/** Walking pace on the wheel: PACE_MIN of the walk / crouch-walk speed at the slowest notch, 1 at the fastest, PACE_STEP a notch. */
export const PACE_MIN = 0.35, PACE_STEP = 0.13;
/** One notch of the wheel on his pace (interact.ts routes the wheel here whenever Space is not down — a hold included: the pair walks at HOLD_PACE × pace): scroll
 *  toward you = slower, like easing off a stick; the kit column shows the ticks for a moment. */
export function wheelPace(g: Game, wheel: number) { const pl = g.player; if (pl.down || !wheel || TWOGEARS.on) return; pl.pace = clamp(pl.pace - Math.sign(wheel) * PACE_STEP, PACE_MIN, 1); pl.paceShownT = g.time; }
/** Sam's hands on the FN2000 (docs/internal/sc20k-design.md §5; combat.ts fireWeapon's `spread`: ± half of it per axis on the unit direction): a shouldered long gun
 *  standing still, on the move (any ground speed over `moveAt`), × crouched, × braced on the foregrip — which he now ALWAYS is with it in the hands (Player.braced:
 *  no brace input any more, so braceK is simply the rifle's in-hand steadiness and `still` × braceK the cone a standing round is drawn with) — then + the AUTO string's
 *  own growth off the row (weapons.ts AutoSpec) and + his suppression's (suppression.ts samSpread), as the pistol's rounds get. The pistol stays dead-on. */
export const RIFLE_SPREAD = { still: 0.010, moving: 0.028, moveAt: 0.3, crouchK: 0.7, braceK: 0.45 };
/** ONE FOOTFALL A STEP (`once`; off = every crossing of the cycle's half or its turn files one, as it always did). A footfall is filed when the walk cycle
 *  crosses its half or turns over. The cycle runs BACKWARDS while he backpedals, and backpedalling is decided from where he aims against where he goes: when
 *  that flips frame by frame the cycle rocks over the one edge, and every frame of it filed a footfall — seven running in a scripted creep up to a man's back,
 *  which is seven crouched steps in a tenth of a second to the man's ears. On: a crossing files a footfall only when the cycle has TRAVELLED `travel` of a turn
 *  (either way, added up) since the last footfall filed. A plain walk travels half a turn between its edges and files what it always did; a cycle rocking on
 *  an edge files at twice a walk's rate at the most, not sixty a second; a turn about within an eighth of a cycle of an edge loses that one footfall. (A FIRST
 *  CUT asked only 'is this the edge last crossed?': a man pacing, or waving the cursor across himself twice a second, then walked the whole floor in silence.)
 *  A FOOTFALL THE LEGS OWE (`owed`, a key of its own UNDER `once`: with the first key down it does nothing). A cycle that is turned about again and again
 *  (the cursor shaken across him three times a second: forwards, backwards, forwards) either rocks between the two edges and reaches neither, or crosses one
 *  with too little travel behind it to count: with the first key alone that walk files a third to two thirds of a plain walk's footfalls over the same
 *  floor. On: the cycle's travel is also added up since the last EDGE PASSED (filed or not) or footfall filed, on the frames he moves at a footfall's speed,
 *  and when it comes to `owe` of a turn (a half: one step's worth of leg) that step is filed where the legs are. A steady walk comes to its edge first,
 *  every step, and files what it always did; after a footfall owed mid-stride the next edge passed puts the count back on the feet. The count starts over
 *  when he slows under a footfall's speed (the cycle easing to a stop is not a step, and a debt is not kept while he stands) and on the first frame the
 *  test is asked again after frames it was not (a takedown, a keypad, a kick: those beats walk or root him without it). */
export const FOOTFALL = { once: false, travel: 0.25, owed: false, owe: 0.5 };
/** Both places a footfall is filed ask this once a frame, with the walk cycle as it now stands and his ground speed: 0 = no footfall, 1 = one at an edge of
 *  the cycle (a foot has come down), 2 = one the legs owe (FOOTFALL.owed: no foot is down under it). It keeps `stepPhase`, and with FOOTFALL.once the travel
 *  since the last footfall filed (`stepTravel`, the short way round, so a turn-over is a small move; 1 at the most) and with `owed` as well the travel since
 *  the last edge passed (`stepOwed`) and the clock it was last asked at (`stepAt`). With the first key down nothing is kept. */
function footfallDue(g: Game, dt: number, phase: number, speed: number): 0 | 1 | 2 {
  const F = FOOTFALL, pl = g.player, prev = pl.stepPhase, edge = (prev < 0.5) !== (phase < 0.5), owes = F.once && F.owed; pl.stepPhase = phase;   // either crossing of the half-cycle is an edge: the cycle runs backwards while backpedalling
  if (F.once || pl.stepOwed) {
    const d = Math.abs(phase - prev), turn = d > 0.5 ? 1 - d : d;
    if (F.once) pl.stepTravel = Math.min(1, pl.stepTravel + turn);
    if (!owes || edge || speed <= 0.4 || g.time - pl.stepAt > dt * 1.5) pl.stepOwed = 0; else pl.stepOwed += turn;
  }
  if (owes) pl.stepAt = g.time;
  if (speed <= 0.4 || (edge ? F.once && pl.stepTravel < F.travel : !(owes && pl.stepOwed >= F.owe))) return 0;   // (once: an edge files only when the cycle has come a quarter turn since the last footfall filed)
  if (F.once) pl.stepTravel = 0; pl.stepOwed = 0; return edge ? 1 : 2;
}
AIM_HOOKS.playerExternalK = (g: Game) => (g.player.braced ? RIFLE_SPREAD.braceK : 1);   // the foregrip brace steadies the aim model's cone too (aim.ts hook), not only the rifle's own hands term
/** seconds the rifle takes coming off the sling into the hands (or going back, or the pistol coming out in its place): no round and no ring inside it */
export const RIFLE_EQUIP_SECS = 0.45;
/** what the selected slot puts in his hand, for the HUD line */
const itemName = (pl: Player) => pl.slot === 'pistol' ? pl.pistol.def.short : pl.slot === 'smoke' ? 'smoke canister' : pl.slot === 'flash' ? 'stun canister' : pl.slot === 'frag' ? 'frag grenade' : rifleName(pl);
/** 'FN2000 · SEMI' / '· AUTO' (+ ' · RING ×4' / ' · 40 MM ×3' while that attachment is selected) — the rifle as the HUD line names it */
/** what 2 pressed again puts on the right button after the load that is up (the launcher's loads in their order: ring, 40 mm and, once issued, the cameras) */
const nextLoad = (rf: Rifle): string => { const a = rf.attachments[(rf.attIdx + 1) % Math.max(1, rf.attachments.length)]; return a === 'cam' ? 'the sticky cameras' : a === 'he40' ? 'the 40 mm' : 'the ring airfoil'; };
const rifleName = (pl: Player) => `${pl.rifle.def.short} · ${pl.rifle.mode.toUpperCase()}${pl.rifle.attachment === 'ring' ? ` · ${ringTag()} ×${pl.rifle.rings}` : pl.rifle.attachment === 'he40' ? ` · 40 MM ×${pl.rifle.shells}` : pl.rifle.attachment === 'cam' ? ` · CAM ×${pl.rifle.cams}` : ''}`;
/** Put the selected item away (E; taking hold of a wall) or draw it again (E; stepping off one): a reload in hand is abandoned on holstering, and unless `quiet`
 *  the HUD line says which and the holster sounds. The rig, the rail light, the takedown click and every path of the pistol read Player.holstered itself; with the
 *  rifle selected 'holstered' is SLUNG — across his back — and drawing it is RIFLE_EQUIP_SECS of no fire (equipT). */
function setHolstered(g: Game, on: boolean, quiet = false) {
  const pl = g.player; if (pl.holstered === on) return;
  pl.holstered = on;
  if (on && pl.pistol.reloading) { pl.pistol.cancelReload(); pl.char.anim.cancelReload(); }
  if (on && pl.rifle.reloading) { pl.rifle.cancelReload(); pl.char.anim.cancelReload(); }
  if (pl.slot === 'rifle') pl.equipT = RIFLE_EQUIP_SECS;
  if (!quiet) { g.msg(on ? (pl.rifleSel ? 'slung' : 'holstered') : itemName(pl)); g.audio.play('equip', null, 0.45); }
}
/** workstow.ts samStowTick's way to his holster: quiet (no line, no click of its own) */
const stowHolster = (g: Game, on: boolean) => setHolstered(g, on, true);
/** every gun's reload in hand abandoned (the takedown, the grab, the lock, the kick: the hands are wanted) */
function cancelReloads(pl: Player) { pl.pistol.cancelReload(); pl.rifle.cancelReload(); pl.char.anim.cancelReload(); }
/** A MAN WHO IS LOW (AIM.player.low, on in the page; 0 = as it was). The reticle takes a man by his POSED chest, but the round and the gun's pitch went to
 *  where a standing man's chest is — `h` over his feet — whatever he was doing. A man with his head down (under fire, on a drill's knee, ducked from a blast,
 *  doubled over a flash on top of any of them) has his crown under that line: the gun sat level on him and every round went over ("if an enemy is bent over from
 *  a flash, I can't shoot them even if i'm directly clicking on them -- gun is forced to be level"). With the knob on, a man whose crown does not clear a
 *  standing chest (LOW_AT over his feet) by LOW_UNDER is LOW, and the point is brought down to LOW_TOP under his crown — as high on him as a round still finds
 *  him, so what a higher line cleared (a counter he is behind) it still clears — over the chest the ring is drawn on; or, where a ray from Sam's gun to that
 *  point would miss the body rounds are tested against (character.ts rayHit: columns about the hips and the trunk), over the hips column's own axis. A man on
 *  his feet — upright, hunched by a flash, folded — is aimed at exactly as before. */
const LOW_AT = 1.25, LOW_UNDER = 0.25, LOW_TOP = 0.15;
function manAim(g: Game, gd: Guard, h: number): Vec3 {
  const m = gd.char, p: Vec3 = [m.pos[0], m.pos[1] + h, m.pos[2]]; if (!(AIM.player.low > 0)) return p;
  const top = m.bones.headTop?.[1], chest = m.bones.chest; if (top === undefined || !chest || m.pos[1] + LOW_AT <= top - LOW_UNDER) return p;
  const y = Math.max(m.pos[1] + 0.15, Math.min(p[1], top - LOW_TOP)), at: Vec3 = [chest[0], y, chest[2]];
  const from = g.player.char.muzzle, d = v3.sub(at, from), L = v3.len(d);
  if (L > 1e-3 && m.rayHit(from, v3.scale(d, 1 / L), L + 1) >= 0) return at;
  const hips = m.bones.hips; return [hips?.[0] ?? m.pos[0], y, hips?.[2] ?? m.pos[2]];
}
/** LEVEL AIM (AIM.player.level, the shipped default; 0 = the gun on the world point under the cursor, floor included, as it was): with NOTHING under the reticle —
 *  no fixture, no man — Sam's gun is not on the patch of floor the cursor's ray happens to end on (two metres out that was the muzzle, the rail light and his whole
 *  trunk pitched 35° at the ground, and the round into the lino at his feet): it is LEVEL along the cursor's heading, at the height he carries it — a standing man's
 *  chest, lower on a knee — so the round, the light and the picture all go where a man would be. levelOn = that rule holds this frame: the knob is on and no script
 *  holds his aim (Game.puppet.aim is an authored POINT — the tour's, a showcase's — and stays one). */
function levelOn(g: Game): boolean { return AIM.player.level > 0 && !g.puppet?.aim; }
const LEVEL_REACH = 20;
/** The point Sam's fire sites send a round at with nothing under the reticle: under levelOn out along the cursor's heading from his own axis (never nearer than
 *  LEVEL_REACH — a point at the cursor itself, inside the muzzle's reach, would turn the bore sideways) at the muzzle's own height, so the round leaves flat; else
 *  the world point under the cursor. `keep` = the cursor nearer his feet than this names no bearing and the gun keeps the one it has (0.25 m: the aim easing's own
 *  rule in updatePlayer; the hold turns the pair only past 0.6 m). */
function freeAim(g: Game, keep = 0.25): Vec3 {
  const c = g.player.char, ap = g.aimPoint; if (!levelOn(g)) return [ap[0], ap[1] + 0.03, ap[2]];
  const dx = ap[0] - c.pos[0], dz = ap[2] - c.pos[2], d = Math.hypot(dx, dz);
  const yaw = d > keep ? Math.atan2(dx, dz) : c.aimYaw, R = Math.max(d, LEVEL_REACH);
  return [c.pos[0] + Math.sin(yaw) * R, c.pos[1] + clamp(c.muzzle[1] - c.pos[1], 0.6, 1.6), c.pos[2] + Math.cos(yaw) * R];
}
/** The one weapon light Sam owns as a light (Player.light), posed off whichever gun is in the hand and lit by THAT gun's switch: the Five-seveN's rail light, or the
 *  FN2000's fore-end light. Dark while sprinting (gun down), while the hands are on the lock tools or both round a man (hideHeldItem: the gun is on the thigh / the
 *  back), and on a man who is down. Every path that bakes his pose calls this after it (updatePlayer, the hold's tail, the pick, the kick). */
function poseGunLight(g: Game) {
  const pl = g.player, c = pl.char, L = pl.light;
  const pistolUp = pl.pistolUp, rifleUp = pl.rifleUp;
  L.enabled = ((pistolUp && pl.pistol.lightOn) || (rifleUp && pl.rifle.lightOn)) && !pl.sprinting && !c.anim.hideHeldItem && !pl.down && kitGunUp(g);   // (kitanim.ts: not from a fist still on its way to the gun)
  if (L.enabled) { const lp = rifleUp ? sc20kLightPose(c) : rigLightPose(c), sh = c.bones.upperArmR; L.pos = sh ? lensClear(g, sh, lp.pos, L.radius, L) : lp.pos; L.dir = lp.dir; }   // (…from this side of a wall he is pressed to: lighting.ts LIGHTWALL)
}
/** Arm (or disarm) the animator's long gun for the FN2000 each frame: in the hands = the R1 solve with the rifle's own grip point and muzzle, steadied against his gait
 *  (longSteady: the gun rides the shoulders, not the hips), the carriage FORCED to what Sam is doing — in his hands at all (standing, walking, crouched) → SHOULDERED,
 *  aiming it wherever the cursor is like the pistol's two-hand aim; sprinting → the long-gun low ready (both hands on, muzzle down); a kick / a leaf under his hand →
 *  the high port; never the guards' calm carry — off = the pistol's numbers back. */
function armRifle(g: Game, inHands: boolean, carriage: LongStance | null) {
  const pl = g.player, an = pl.char.anim;
  an.longGun = inHands; an.longStance = inHands ? carriage : null; an.longSteady = 1; an.reloadBack = !GEAR.on;   /* (the 2010s carbine's magazine is ahead of the grip: the carbine's marks) */ an.reloadMag = !(pl.rifle.def as { pellets?: unknown }).pellets;   // (a pump shotgun in the rifle's slot has no magazine to change)
  feedDeal(an, inHands ? pl.rifle : null);   // (gunreload.ts: a gun with a model of its own is fed its own way — a belt box, shells one at a time, a magazine up the grip. Nothing with gunlook.ts off)
  pl.char.gunLook = gunLookOf(pl.char.gunLook, inHands ? pl.rifle.def : pl.pistol.def, inHands ? pl.pistol.def : pl.rifle.def);   // (gunlook.ts: which of his two guns are drawn as models of their own — null with the switch off)
  const own = inHands ? pl.char.gunLook?.hand ?? null : null, fit = KITANIM.on && KITANIM.grips && !g.touring;   // (… and a model in his hands has its own support-hand point and its own muzzle)
  if (inHands) { an.longGrip = (own ? modelGrip(own, fit) : null) ?? sc20kGrip(undefined, fit); pl.char.muzzleAhead = (own ? modelMuzzleAhead(own) : null) ?? sc20kMuzzleAhead(); }   // (kitanim.ts grips: the support hand follows the gun as it is drawn in his hands — rigProps GRIPFIT)
  else pl.char.muzzleAhead = pl.pistol.def.muzzleAhead;
}
/** THE TRIGGER PRESSED OVER A TUBE GUN BEING FED BY THE SHELL (gunlook.ts GUNLOOK.shells; null without the key, or nothing to break off): what was fed is in
 *  the gun, so the feeding stops there. 'fire': a round is chambered — the reload is let go and this press fires. 'bolt': rounds in the tube and none chambered
 *  (a pump gun broken off, or a reload a sprint cut short) — the bolt or the pump is run on them, its own short beat, and the NEXT press fires. */
function shellBreak(g: Game): 'fire' | 'bolt' | null {
  const pl = g.player, rifle = pl.rifle, c = pl.char, feeding = rifle.reloading && rifle.shellFed;
  if (rifle.reloading ? !feeding : !shellPlan(rifle)) return null;
  if (rifle.chamber === 1 || (rifle.infinite && rifle.mag !== null)) { if (!feeding) return null; rifle.cancelReload(); c.anim.cancelReload(); return 'fire'; }   // (Firearm.canFire's own question, less the reload)
  if (!rifle.mag) return null;   // nothing in it yet: the dry click, and the feeding goes on
  if (feeding && rifle.feedN === 0) return 'bolt';   // (the bolt run itself: a second press does not start it over)
  if (c.anim.kitBusy || !pl.rifleUp || (pl.wall && pl.wall.kind !== 'stack')) return null;   // (reloadInHand's own gates: where no reload may begin the feeding is not thrown away for one)
  if (feeding) { rifle.cancelReload(); c.anim.cancelReload(); }
  return reloadInHand(g, false, true) ? 'bolt' : null;
}
/** RELOAD THE GUN IN HIS HANDS — the one way a reload starts for the player (the R key calls it; anything else that wants him reloading — a rule that reloads an
 *  empty gun by itself — calls it too, so there is one beat, one set of sounds and one animation). Which reload it is comes off the gun's own state (a round
 *  still chambered or not, the magazine dry or not). Returns true when a reload BEGAN; false = nothing happened (no gun up, sprinting, on the wall with the
 *  pistol, already reloading, magazine full, or no spare — the last one says so on the HUD). `sprinting` = the sprint is held with a direction this frame. */
export function reloadInHand(g: Game, sprinting = false, boltOnly = false): boolean {
  const pl = g.player, c = pl.char, gun = pl.pistol, rifle = pl.rifle;
  if (c.anim.kitBusy || (KITANIM.on && pl.equipT > 0)) return false;   // (kitanim.ts: the gun is not in his hands yet — or is on its way out of them, or still on his thigh through the swing of the throw that handed the slot to it)
  if (pl.pistolUp && !sprinting && !pl.wall) {   // (on the wall or holstered the pistol is on his thigh: nothing to reload in the hand)
    const plan = kitReload(g, gun, false);   // (kitanim.ts: the change this gun's state calls for — empty / dry / tactical — on its own beat; null = the row's, as ever)
    const fill = feedPlan(gun, plan?.row ?? gun.def.reload)?.drop ?? 0;   // (gunreload.ts: a pistol with a model of its own drops ITS magazine — the Glock 18's long one. 0, the box as ever, with that switch off)
    if (gun.startReload({
      magOut: (rounds, dropped) => { g.audio.play('magOut', c.pos, 0.7); if (dropped) { const h = c.bones.handL ?? c.pos; const it = g.items.spawn('mag', [h[0], Math.max(0.3, h[1]), h[2]], [(simRandom() - 0.5) * 0.6, -0.2, (simRandom() - 0.5) * 0.6], { fill, who: PLAYER_ID }); it.onBounce = (sp, p, g) => g.audio.play('magDrop', p, Math.min(1, sp / 3)); } },
      magIn: () => g.audio.play('magIn', c.pos, 0.8),
      rack: () => g.audio.play('rack', c.pos, 0.8),
    }, plan?.row)) { if (plan) { c.anim.reload(plan.beat.dur, plan.beat); kitReloadNote(g, plan.kind, plan.beat.dur); } else c.anim.reload(); g.msg('reloading'); return true; }
    if (gun.spare.length === 0) g.msg('no spare magazines');
    return false;
  }
  if (pl.rifleUp && !sprinting && (!pl.wall || pl.wall.kind === 'stack')) {   // the rifle in the hands: the same staged beat off its row (2.4 s: the empty out of the well behind the grip at 0.5 — its black thirty, 'mag' fill 3 — the fullest spare in at 1.5, the charging handle at 2.0)
    const rackIt = rifle.chamber === 0;   // (the moves' support hand: a round still up the pipe and the handle is left alone — weapons.ts racks only an empty chamber)
    // A TUBE GUN BY THE SHELL (gunreload.ts shellPlan, the GUNLOOK.shells key; null without it, and then every line below is the line it was): the beat is made
    // for the shells that go in, and each is booked as it is heard. `boltOnly` (shellBreak below): none goes in — the round in the tube is chambered.
    const sp = shellPlan(rifle, false, boltOnly ? 0 : Infinity);
    if (sp?.idle) { if (rifle.spare.length === 0 && !boltOnly) g.msg(`no more shells for the ${rifle.def.short}`); return false; }
    const plan = sp ? null : kitReload(g, rifle, true);
    // EACH GUN FED ITS OWN WAY (gunreload.ts; null with gunlook.ts off or a row with no model, and then every line below is the line it was): `own` = a belt gun's or
    // a tube gun's own sounds on this beat, played as the weapon's clock passes each (Firearm's cues) IN PLACE of the three a magazine change makes; `drop` = what an
    // empty one leaving the gun is drawn as (null: nothing falls). The beat, the books and the dice are the weapon's, untouched.
    const fp = feedPlan(rifle, sp?.row ?? plan?.row ?? rifle.def.reload, sp ? { n: sp.n, pull: sp.pull } : undefined), own = fp?.cues ?? null, belt = fp?.drop === 5;
    if (rifle.startReload({
      magOut: (rounds, dropped) => { if (!own) g.audio.play('magOut', c.pos, 0.75, { rate: 0.85 }); if (dropped && !rifle.def.pellets && fp?.drop !== null) { const h = c.bones.handR ?? c.pos; const it = g.items.spawn('mag', [h[0] - c.gunDir[0] * 0.1, Math.max(0.3, h[1] - 0.05), h[2] - c.gunDir[2] * 0.1], [(simRandom() - 0.5) * 0.6, -0.3, (simRandom() - 0.5) * 0.6], { fill: fp?.drop ?? 3, who: PLAYER_ID }); it.onBounce = (sp, p, g) => g.audio.play('magDrop', p, Math.min(1, sp / 3), { rate: belt ? 0.6 : 0.8 }); } },
      magIn: () => { if (!own) g.audio.play('magIn', c.pos, 0.85, { rate: 0.85 }); },
      rack: () => { if (!own) g.audio.play('rack', c.pos, 0.85, { rate: 0.8 }); },
      cue: i => { if (own) feedPlay(g, c.pos, own[i]); },
    }, sp?.row ?? plan?.row, fp?.times, sp ? { times: sp.times, port: sp.port } : undefined)) {
      if (sp) { c.anim.reload(sp.row.dur, sp.row); if (sp.n) g.msg(`reloading the ${rifle.def.short}`); return true; }
      if (plan) { c.anim.reload(plan.beat.dur, plan.beat); kitReloadNote(g, plan.kind, plan.beat.dur); } else c.anim.reload(rifle.def.reload.dur, rackIt ? rifle.def.reload : { ...rifle.def.reload, rack: null }); g.msg(`reloading the ${rifle.def.short}`); return true; }
    if (rifle.spare.length === 0) g.msg(rifle.def.pellets ? `no more shells for the ${rifle.def.short}` : `no spare magazines for the ${rifle.def.short}`);
    return false;
  }
  return false;
}

export function updatePlayer(g: Game, dt: number, input: Input, cam: FollowCamera) {
  const pl = g.player; const c = pl.char; const T = g.tune; const gun = pl.pistol;
  if (TWOGEARS.on) pl.pace = 1;   // (two gears: a notch a checkpoint or an older visit left on him is nobody's)
  pl.dash = false; c.anim.dash = 0; c.anim.runReady = false;   // (CROUCHRUN, RUNREADY: this frame's own, set below where his legs are his)
  cam.peekOffset = null;   // (set again below for the one case that wants it: peeking round the end of a wall)
  aimWeighBegin(pl);   // (aimweight.ts: nothing has weighed his aim this frame yet — only the plain aim branch below does)
  noShoveBegin(g);   // (noshove.ts: nobody has moved him yet this frame, and his own legs start from here — nothing with its switch off)
  const launchWas = pl.launchHeld; pl.launchHeld = null;   // the launcher's button was down last frame (below, with the rifle's fire): handed on only by the frame that still has the rifle up and free — any other state (down, a grab, a kick, the sling, a sprint) lets go of it unsent
  if (input.hit('Enter') && (pl.down || g.mission.stage === 'failed' || input.down('ShiftLeft') || input.down('ShiftRight'))) {   // (failed on his feet — a civilian dead by his hand with tune.civilianKillFails — restarts too)   // Shift+Enter restarts the encounter any time; a bare Enter once down goes back to this run's newest CHECKPOINT if one is stored (game/savestate.ts — the down card's default too), else restarts
    const shift = input.down('ShiftLeft') || input.down('ShiftRight'); const ck = !shift && pl.down ? g.saves.newest(true, g.mission.stats.elapsed) : null;
    let said: string | undefined;
    if (ck && g.saves.isThisRun(ck)) { const why = g.saves.loadInStep(g, ck.key); if (!why) return; said = `checkpoint: ${why}`; }
    g.restart(said); return;
  }
  if (input.hit('F5')) g.saves.askSave();   // a save by hand (savestate.ts): asked for by the key — the recording's own input — and written at the end of this update, or refused there with its reason on the message line
  if (STEALTHPOSE.on || c.anim.stealth) stealthFeed(g);
  samBigTailTick(g, dt);   // (bigkit.ts, BIGSLOT.moves: the tool going back onto him after its beat, his legs his own — or dropped at once when anything else has his hands)
  if (WORKSTOW.on || pl.workStow) samStowTick(g, stowHolster);   // (workstow.ts: a charge going on by his own hands — what he holds is put away first and brought back after; asked ahead of every state below, so a job that ended under one of them is settled too)
  if (pl.down) { if (pl.wanding) wandDrop(pl); if (pl.kitWas !== undefined || c.anim.kitBusy) kitTick(g); releaseWall(g); if (pl.holding) freeHeld(g, 'shot'); c.vel = [0, 0, 0]; pl.light.enabled = false; pl.throwPreview = null; c.anim.lockpick = false; c.anim.longGun = false; c.update(dt); g.bodyThud(c); return; }   // (down with a man in his arm — god mode off, hitPlayer has normally let go already: he goes free; the rifle, in the hands or not, is no longer held: it left them or lies under him on its sling)
  const rifle = pl.rifle;
  gun.update(dt); rifle.update(dt); pl.ocp.update(dt); rifle.ringCd = Math.max(0, rifle.ringCd - dt); pl.equipT = Math.max(0, pl.equipT - dt);
  pl.noise *= Math.exp(-2.2 * dt);   // sound meter decay
  samStunPose(g);                    // a blast's stagger / dazzle on him (samstun.ts): shown and kept true in every state below, cleared when it ends
  if (pl.holding && samStaggered(g)) freeHeld(g, 'shot');   // folded with a man in his arm: the arm goes slack and the man is loose
  whistleKey(g, input);              // V: a low whistle (whistle.ts) — from the arm lock, the lock, the wall, mid-kick alike: anywhere but down (returned above)
  gunWallStance(c, false); gunWallPose(g, c);   // (gunwall.ts, for the states below that pose him themselves: the rule's low ready let go of, the low carriage pulled in by the room it has; the gun's own states ask again further down)
  if (pl.wanding && WAND.on && WAND.nv) nvKey(g, input, dt);   // (the wand: N is his while he looks — a dark room behind the door is what the goggles are for; kitanim.ts makes it a nod, his hands are on the cable)
  else if ((pl.takedown || pl.kick || pl.picking || pl.wanding || pl.coding) && KITANIM.on && KITANIM.nv) nvKey(g, null, dt);   // (a flip begun a moment before one of these beats took him: the picture still follows the goggles through it — it used to stand where the beat found it)
  if (pl.takedown || pl.kick || pl.picking || pl.wanding || pl.coding || pl.holding || samWork(g) || samStaggered(g)) pl.kitOwed = -1;   // (kitanim.ts kitClick: a click kept for a draw does not outlive a beat that took his hands)
  if ((pl.takedown || pl.kick || pl.picking || pl.wanding || pl.coding) && (KITANIM.on || pl.kitWas !== undefined)) kitTick(g);   // (kitanim.ts: something else has his hands — no errand, and nothing left over in the fist)
  if (pl.takedown) { updateTakedown(g, dt); c.anim.speed = 0; c.anim.upper = 'none'; armRifle(g, false, null); c.update(dt); pl.light.enabled = false; return; }   // locked into the takedown beat: no movement / aim / fire until it resolves (the takedown is a hands-empty click: the rifle, if he has one, is on his back)
  if (pl.holding) { if (KITANIM.on || pl.kitWas !== undefined) kitTick(g); updateHold(g, dt, input, cam); return; }   // a man in his arm: the pair moves, turns and is posed as one; Space / E on his row are read there
  if (THROWBACK.on && pl.pendingThrow && (pl.kick || pl.picking || pl.wanding || pl.coding || samWork(g))) throwOff(pl);   // (throwback.ts: EVERY return below stops the wind-up's clock, so a beat added to them is added here — the can would leave his hand when the beat ends, from where he then stands; it goes back on the belt, as a grab's does)
  if (pl.kick) { updateKick(g, dt); return; }              // rooted square to the leaf until the foot is back down (the door goes at KICK_IMPACT)
  if (pl.picking) { updatePicking(g, dt, input); return; }  // planted at the lock, on its own clock (a step / Space / Esc breaks off: interact.ts)
  if (pl.wanding) { updateWanding(g, dt); return; }         // on his knee at a shut door with the optical wand under it (wand.ts; a step / Space / Esc pulls it out: interact.ts)
  { const W = samWork(g), on = !!W && !(input.lmbHit() && samWorkLetGo(g, W));
    if (W && !on && pl.workStow) samStowTick(g, stowHolster);   // (workstow.ts: the trigger let go of his charge on this frame — the gun starts back up on it)
    if (on) { if (samStowing(g) && (KITANIM.on || pl.kitWas !== undefined)) kitTick(g);   // (…and the hand that carries it there is kit handling's: its errand starts here, the work waiting on it)
      updateWorkPlant(g, dt, W!); return; } }   // hands at work on a thing (handwork.ts: the breaker's lever, the drive, a wall charge): stood at it and squared to it while the verb runs; the trigger lets go of the drive / the charge and is his to shoot with (the lever's half second is committed)
  if (pl.coding) { updateCodingPlant(g, dt); return; }     // at the keypad, feet still, squared to the plate while the code goes in (devices.ts updateCoding times it; a fresh key / Space / Esc breaks off — interact.ts)
  c.anim.lockpick = false;                                   // (whatever ended a pick, the hands come off the tools)
  // equipment selection / toggles — the digits are KIT_ORDER's (1 pistol · 2 rifle · 3 smoke · 4 stun; there is no other way to change items). Pressed to a wall his
  // hands stay empty (wallSnap holstered whatever was up, releaseWall hands it back): there, E and the digits only choose what he steps off it with (WallHold.drawn)
  // and say so — nothing comes into the hand on the wall
  // — except the rifle where it stacks (wallStacks): 2, or E with it selected, brings it into his hands and the back hold becomes the stack; any other item
  // chosen on the stack slings it and he is back on the plaster with that item waiting for the step off
  const draw = (name: string) => {
    const w = pl.wall;
    if (w && !(pl.slot === 'rifle' && wallStacks(w))) { w.drawn = true; g.msg(`${name} comes out when you leave the wall`); }   // (on the stack the rifle is still in his hands this frame: moveOnWall sees another item selected, slings it and makes the hold the back hold)
    else { pl.holstered = false; g.msg(name); }
    g.audio.play('equip', null, 0.5);
  };
  const wasIn = pl.gunInHand();
  slotSetupKeys(g, input);   // (slotsetup.ts: the digit of the gun in his hands opens its setup, and with it up a row's digit steps the row — taken out of the frame, so the lines below never see it; nothing with its switch off)
  if (input.hit('Digit1')) { pl.slot = 'pistol'; draw(gun.def.short); }
  if (input.hit('Digit2')) {   // 2: the rifle — off the sling into the hands (selected but slung, or anything else selected); pressed again with it IN the hands: the launcher's NEXT load goes on the right button (RING ⇄ 40 MM, and CAM third once sticky cameras are issued — there is no 'nothing' to step through; remembered while it is away)
    if (!pl.hasRifle) g.msg(gearText('no FN2000 in this loadout — the start card / pause menu puts it in the kit'));
    else if (pl.rifleUp) {   // (on the wall this is the stack: the back hold has nothing in the hands)
      if (pl.equipT <= 0) {   // not while it is still coming round off the sling: a double-tapped 2 draws it, it does not also flip the launcher
        const a = rifle.cycleAttachment(); g.audio.play('click', c.muzzle, 0.7);
        g.msg(a === 'ring' ? gearText(rifle.rings > 0 ? `ring airfoil ×${rifle.rings} on the right button — head = out cold, body = staggered, a wall = a noise they go and look at; 2 again for the 40 mm` : 'the ring launcher — but no ring airfoils left (2 again for the 40 mm)')
          : a === 'he40' ? gearText(rifle.shells > 0 ? `40 mm grenade ×${rifle.shells} on the right button — goes off on what it hits, like a frag; arms ${HE40.armM} m out (nearer: a dud); ${loadKeys()} for ${nextLoad(rifle)}` : `the 40 mm — but no grenades left for it (2 again for ${nextLoad(rifle)})`)
          : a === 'cam' ? (rifle.cams > 0 ? `sticky camera ×${rifle.cams} on the right button` : 'no sticky cameras left')
          : `${rifle.def.short} — nothing goes on its right button`);
      }
    } else { pl.slot = 'rifle'; draw(rifleName(pl)); }
  }
  { const eKey = input.hit('KeyE'), away = !eKey && HANDSLOT.on && !pl.choosing && input.hit(HANDSLOT_KEY);   // E: put it away / draw it (whatever the slot is; the rifle 'away' is on his back) · the empty hands' own slot (handslot.ts): away only, never the way back, and not a key of his kit while a list of rows is up
    if ((eKey || away) && !pl.dragging && !pl.takedown) {
      if (pl.wall && pl.wall.kind !== 'stack' && !(pl.rifleSel && wallStacks(pl.wall))) { const to = eKey ? !pl.wall.drawn : false; if (to !== pl.wall.drawn) { pl.wall.drawn = to; g.msg(to ? `${itemName(pl)} comes out when you leave the wall` : `${pl.rifleSel ? 'slung' : 'holstered'}, and it'll stay that way when you leave the wall`); } }
      else setHolstered(g, eKey ? !pl.holstered : true);
    } }
  // (the wheel — walking pace down / up — is read in interact.ts wheelPace: while Space is down it scrolls the selector instead)
  if (input.hit('Digit3')) { if (pl.canisters > 0) { pl.slot = 'smoke'; pl.throwKind = 'smoke'; draw(`smoke canister ×${pl.canisters}`); } else g.msg('no smoke canisters left'); }
  if (input.hit('Digit5')) { if (!FRAG.on) g.msg('no fragmentation grenades in this kit'); else if (pl.frags > 0) { pl.slot = 'frag'; draw(`frag grenade ×${pl.frags} — click throws it; it goes off ${FRAG.fuse}s after it leaves your hand`); } else g.msg('no frag grenades left'); }   // 5: the fragmentation grenade (frag.ts) — in the fist like a can; G's quick-throw (where it is on) stays smoke / stun
  if (input.hit('Digit4')) { if (pl.flashbangs > 0) { pl.slot = 'flash'; pl.throwKind = 'flash'; draw(`stun canister ×${pl.flashbangs} — goes off ${flashFuse(g)}s after it lands`); } else g.msg('no flashbangs left'); }
  { const nowIn = pl.gunInHand(); if (nowIn !== wasIn && (nowIn === rifle || wasIn === rifle)) { pl.equipT = RIFLE_EQUIP_SECS; if (wasIn === rifle && rifle.reloading) { rifle.cancelReload(); c.anim.cancelReload(); } if (wasIn === gun && gun.reloading) { gun.cancelReload(); c.anim.cancelReload(); } } }   // the rifle came off the sling or went back on it (a digit / E): the beat with nothing to fire, and a reload in the hand that changed is abandoned
  if (KITANIM.on || pl.kitWas !== undefined || c.anim.closeK >= 0) kitTick(g);   // (kitanim.ts: the hands' errands when what he carries changed — on the key's own frame — and the close-in mode's distance; let go of once the switch is off)
  if (KITANIM.on || pl.kitOwed >= 0) kitClick(g, input);   // (kitanim.ts: a click made in the last moments of a draw is kept for the frame the gun is up)
  if (input.hit('KeyL') && kitYouLight(pl)) { const lit = pl.rifleSel ? rifle : gun; lit.lightOn = !lit.lightOn; g.audio.play('click', c.muzzle, 0.6); }   // the light of the gun the kit has selected (its switch is under the thumb of the hand it is in)
  if (input.hit('KeyZ') && (pl.rifleSel || (pl.slot === 'pistol' && gun.def.modes.length > 1))) {   // the selector (a property of the rifle: in the hands or slung) — what the LEFT button fires; the attachment on the right is its own thing. (A sidearm with two sears — gunslots.ts — has one too, with it selected.)
    const sel = pl.rifleSel ? rifle : gun;
    if (sel.def.modes.length > 1) { const m = sel.cycleMode(); g.msg(`${sel.def.short}: ${m.toUpperCase()}${m === 'auto' ? ' — hold the trigger' : ' — one round a click'}`); g.audio.play('click', c.muzzle, 0.7); }
    else g.msg(`${sel.def.short} is ${sel.mode.toUpperCase()} only`);
  }
  nvKey(g, input, dt);
  const sprintKey = !isHurt(g, pl) && (input.down('ShiftLeft') || input.down('ShiftRight')) && (input.down('KeyW') || input.down('KeyA') || input.down('KeyS') || input.down('KeyD'));
  // R, or the gun in his hands run dry with a magazine left (autoreload.ts: asked every frame, so a reload a sprint took out of his hands starts again) — one way in either way
  if (input.hit('KeyR') || (pl.pistolUp && autoReloadDue(g, pl, gun)) || (pl.rifleUp && autoReloadDue(g, pl, pl.rifle))) reloadInHand(g, sprintKey && !(CROUCHRUN.on && pl.crouch && !g.puppet && !g.touring));   // (CROUCHRUN: Shift in a crouch is no sprint — his hands are his own, the gun's change with them)
  // movement input — none while the selector is open (Space held past a tap: he is choosing what to do, feet still; interact.ts)
  const { fwd, right } = cam.planarBasis();
  let mx = 0, mz = 0;
  if (!pl.listOpen) {   // (… up as a ring, cmdring.ts CMDRING.hands, his feet are his own)
    if (input.down('KeyW')) { mx += fwd[0]; mz += fwd[2]; }
    if (input.down('KeyS')) { mx -= fwd[0]; mz -= fwd[2]; }
    if (input.down('KeyD')) { mx += right[0]; mz += right[2]; }
    if (input.down('KeyA')) { mx -= right[0]; mz -= right[2]; }
  }
  // the stalk (stalk.ts): the left button held on a man he is close behind walks him in to the grab — the direction, the pace and the facing are the game's; a
  // move key of his own ends it (STALK.orbit: takes him round the man instead)
  const stalk = STALK.on ? stalkStep(g, input.lmb(), input.lmbHit(), mx !== 0 || mz !== 0, STALK.drag ? { x: input.mouseX, y: input.mouseY, fwd, right } : undefined, STALK.orbit ? { mx, mz, dt } : undefined) : null;   // (STALK.drag: the mouse is a stick from where the press was made; STALK.orbit: his keys take him round the man)
  if (stalk) { mx = stalk.mx; mz = stalk.mz; pl.crouch = true; }
  if (g.puppet) {   // scripted movement: straight at the goal (the tour picks goals with a clear line), stop within 10 cm
    mx = 0; mz = 0; const gl = g.puppet.goal;
    if (gl) { const dx = gl[0] - c.pos[0], dz = gl[2] - c.pos[2]; const dl = Math.hypot(dx, dz); if (dl > 0.1) { mx = dx / dl; mz = dz / dl; } }
    if (g.puppet.crouch !== undefined && !pl.dragging && (g.puppet.crouch || canStand(g))) pl.crouch = g.puppet.crouch;
  }
  if (!pl.dragging && (pl.haul || c.anim.haul)) { pl.haul = null; c.anim.haul = null; }   // (a body taken out of his hands by a reset: guards.ts)
  const stunned = samStaggered(g), rooted = samRooted(g);   // folded by a blast (samstun.ts): rooted, the gun at the low ready, no round — as a man is; blind = the picture's, his feet his own
  const ownMove = !rooted && (mx !== 0 || mz !== 0);   // (rooted, his keys are no step of his own: a held Shift and a direction is then no sprint that lets go of a body or a door, and the hands' moves are fed no step from him)
  let handsWalk = false;
  if (HANDS.on) { const hs = handsStep(g, ownMove && !g.puppet, dt); if (hs) { mx = hs[0]; mz = hs[1]; handsWalk = true; } }   // a body being taken up / laid down plants his feet (or walks him the step in to it); a door worked by hand steps him clear of its sweep (hands.ts)
  if (rooted) { mx = 0; mz = 0; }
  const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
  if (input.hit('KeyC') && !pl.dragging) { if (!pl.crouch) pl.crouch = true; else if (canStand(g)) pl.crouch = false; else g.msg('no room to stand'); }   // crouch is C, only (Ctrl is the camera-orbit modifier now); standing needs the headroom
  const wantSprint = !isHurt(g, pl) && (input.down('ShiftLeft') || input.down('ShiftRight')) && (HANDS.on && (pl.haul || pl.doorMove) ? ownMove : ml > 0 && !stalk);   // (a step the hands' moves take for him is never a sprint; his own keys with Shift are one in any beat of a pick-up, planted or not: it lets go — hands.ts)
  // back to the wall (Q): press against the face behind / beside you and sidle along it; Q again, breaking into a run or walking off it steps away (moveOnWall)
  if (rooted) { /* folded: no reaching for a wall, no pushing off one */ }
  else if (input.hit('KeyQ')) { if (pl.wall) wallStepOff(g, mx, mz, ml, 'q'); else if (!wantSprint) { const why = { blocked: false }; if (!wallSnap(g, cam, why) && !wallSnapLater(g, ml, why)) g.msg(pl.dragging ? 'hands full' : why.blocked ? "can't get to the wall here" : 'nothing to put your back to here'); } }   // (at a run there is no taking hold: Shift is one of the ways off it; blocked: a face in reach but furniture standing against it where he would go)
  else if (WALLSNAP.on) wallSnapPending(g, dt, cam, wantSprint);   // (Q a moment before the face came into reach: taken as it does)
  if (WALLSNAP.on && WALLSNAP.press && !rooted && !stalk && !g.rails?.locksWall()) wallPress(g, dt, input, cam, mx, mz, ml, wantSprint);   // (…and with no Q at all: a move key held into the wall he is up against)
  if (pl.wall && wantSprint) wallStepOff(g, mx, mz, ml, 'run');
  const onWall = !!pl.wall && moveOnWall(g, dt, cam, mx, mz, ml);   // false: free (or let go this very frame — then he walks on from where he stands, below)
  if (!onWall) {
    if (wantSprint && pl.dragging) g.toggleDrag();          // breaking into a sprint lets go of the body
    const dashes = CROUCHRUN.on && !g.puppet && !g.touring;
    if (wantSprint && pl.crouch && canStand(g) && !dashes) pl.crouch = false;   // (under a counter top Shift just crouch-walks on: no standing into the slab)
    if (pl.dragging) pl.crouch = haulCrouch(g);   // (hauled along the floor: on his heels; carried on his shoulder: upright once it is half way up — hands.ts)
    pl.sprinting = wantSprint && !pl.crouch;
    const tap = !TAPSTEP.on ? null : pl.crouch && !wantSprint && !stalk && !pl.dragging && !handsWalk && !rooted && !g.puppet && !g.touring ? tapTick(g, mx, mz, ml, dt) : tapOff(g, ml);   // (tapstep.ts: crouched, the keys are steps)
    if (tap) { mx = tap.mx; mz = tap.mz; }
    pl.dash = dashes && wantSprint && pl.crouch && !pl.dragging && !stalk;   // (CROUCHRUN: Shift in a crouch stays down and goes quickly)
    if (pl.sprinting && gun.reloading) { gun.cancelReload(); c.anim.cancelReload(); }
    if (pl.sprinting && rifle.reloading) { rifle.cancelReload(); c.anim.cancelReload(); }
    let maxSpeed = ml === 0 ? 0 : pl.sprinting ? T.playerSprint : pl.dragging ? (pl.haul ? haulSpeed(g) : T.playerCrouch * 0.6) : pl.dash ? CROUCHRUN.pace : (pl.crouch ? crouchPace(g) : T.playerWalk) * pl.pace;   // hauling 80 kg along the floor is slow; the wheel-set pace scales the walk and the crouch-walk alike (the rifle in the shoulder costs no pace: the aim model's moving / settle terms are what the move costs him)
    if (g.puppet?.walk !== undefined && ml > 0) maxSpeed *= g.puppet.walk;
    maxSpeed = samLoadPace(g, maxSpeed, pl.sprinting);   // (kitload.ts: what his card weighs — a light one's legs are quicker, a heavy one's slower, a sprint by part of it; as asked with its switch off or no card on him)
    if (tap) maxSpeed = tap.speed;
    if (stalk) maxSpeed = ml === 0 ? 0 : stalk.pace;   // (stalk.ts: the man's own speed and a closing speed that eases off as he nears — the game's, whatever his card weighs)
    if (pl.sprinting) maxSpeed *= sprintDoorPace(g, pl);   // (sprintdoor.ts: his hand is ripping a door round toward him — the run waits for it; 1 otherwise)
    pl.speedSm = damp(pl.speedSm, maxSpeed, stalk ? (stalk.keep ? 12 : maxSpeed > pl.speedSm ? STALK.easeUp : STALK.easeDown) : maxSpeed > pl.speedSm ? 6 : 12, dt);   // (stalk.ts: the creep takes up its speed more gently than a walk)
    if (tap) pl.speedSm = tap.speed;
    if (tap ? tap.speed > 0 : ml > 0) { c.vel = [mx * pl.speedSm, 0, mz * pl.speedSm]; } else { c.vel = v3.scale(c.vel, Math.exp(-14 * dt)); }
    c.pos = v3.mad(c.pos, c.vel, dt);
    const headroom = pl.crouch ? 1.0 : 1.7;
    collidePlayer(g, headroom);
    keepOffGuards(g, dt, headroom);
  }
  const speed = Math.hypot(c.vel[0], c.vel[2]);
  // aim
  const ap = stalk ? stalk.at : g.aimPoint; const toAim: Vec3 = [ap[0] - c.pos[0], 0, ap[2] - c.pos[2]];   // (stalking, he faces the man: the cursor is free once the button is down)
  const aimDist = Math.hypot(toAim[0], toAim[2]);
  pl.aimHeld = false;   // (RMB is the OCP now; the gun comes up on firing, with the rail light, or from the ready carry — see `aiming`)
  const recentlyFired = g.time - pl.lastFireT < 1.6;
  const gunUp = pl.pistolUp;      // the pistol actually in the hand
  const rifleUp = pl.rifleUp;     // the FN2000 in both hands (selected, off the sling, in the kit, not hauling a body)
  const aiming = ((gunUp && (recentlyFired || gun.lightOn || pl.aimHeld)) || (rifleUp && pl.braced)) && !pl.sprinting && !pl.dragging && !doorMoveLowers(g) && !(pl.wall?.kind === 'stack' && !stackUp(g, dt, input));   // light on = weapon up: the rail light is bolted to the gun, so pointing the light at the cursor means pointing the gun there; the rifle is braced in the shoulder whenever it is in the hands (Player.braced) — up, aimed, its arc laid if the ring launcher is selected
  const cursorPitch = () => {   // gun pitch onto what the reticle has — a fixture, a man — else LEVEL along the cursor's heading (levelOn; with the knob off / a scripted aim: AT the world point under the cursor, floor included)
    let targetY = ap[1] + 0.03;
    if (g.aimTarget) targetY = clamp(g.aimTarget.pos[1], 0.3, 2.95);
    else if (g.aimGuard) targetY = g.aimGuard.wound && g.aimSnap ? g.aimSnap[1] : manAim(g, g.aimGuard, 1.2)[1];   // (manAim: a man who is low is aimed at where he is)
    else if (levelOn(g)) return 0;
    const gunY = c.pos[1] + (pl.crouch ? 0.95 : 1.4);
    return clamp(Math.atan2(targetY - gunY, Math.max(aimDist, 0.5)), -60 * DEG, 70 * DEG);
  };
  if (pl.dragging) {
    // dragging: you have it by the ankles — the ragdoll's two ankle particles are pinned to a point at your hands (DRAG_HANDS ahead, shin height) and the rest
    // of it trails through its own constraints, sliding on the floor with friction, bumping round door jambs and desk legs on its own collision. You face
    // its hips, so moving away from it IS a backward crouch-walk. Torn out of your hands if it wedges (the legs cannot follow the hands any more:
    // Ragdoll.strain) or if it somehow got away from you.
    const body = pl.dragging.char; const rag = body.ragdoll;
    const hips = body.bones.hips ?? body.pos; const dx = hips[0] - c.pos[0], dz = hips[2] - c.pos[2]; const d = Math.hypot(dx, dz);
    if (d > 1e-4) pl.dragYaw = Math.atan2(dx, dz);
    pl.dragStuckT = rag && (rag.strain > 0.2 || haulSlack(g)) ? pl.dragStuckT + dt : 0;
    if (!rag || d > 2.2 || pl.dragStuckT > 0.25) { const wedged = rag && pl.dragStuckT > 0.25; g.toggleDrag(); if (wedged) g.msg('body dropped — it was wedged'); }
    else if (haulSetDone(g)) { releaseBody(g, true); g.msg('body set down'); }   // (hands.ts: the 'let go of him' row laid it down first)
    else {
      const DRAG_HANDS = 0.35, f = c.forward(); const hx = c.pos[0] + f[0] * DRAG_HANDS, hz = c.pos[2] + f[2] * DRAG_HANDS;
      if (!haulPins(g, dt)) { rag.setPin(RAG.ankL, [hx + f[2] * 0.1, 0.42, hz - f[0] * 0.1]); rag.setPin(RAG.ankR, [hx - f[2] * 0.1, 0.42, hz + f[0] * 0.1]); }   // an ankle in each hand, 20 cm apart across your facing (hands.ts, its switch on: taken up from whichever end he is at, by its own beats — the pins are its then)
      if (haulUpright(g)) {   // carried on his shoulder (hands.ts): he walks with it, facing the way he goes, head up; nothing slides
        if (speed > 0.2) c.bodyYaw = approachAngle(c.bodyYaw, v3.yawOf(c.vel), HANDS.carryTurn * dt);
        c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0, 6, dt); pl.backpedal = false; c.anim.reverse = false;
      } else {
      const faceYaw = haulYaw(g) ?? pl.dragYaw;   // (lifting it onto his shoulder / laying it down: the facing he began the beat with)
      c.aimPitch = damp(c.aimPitch, pl.haul ? -0.45 : -0.9, 6, dt);   // (with his hands on it — hands.ts — the bow is the layer's own: the old stoop on top of it hung his head at his chest)
      if (pl.haul) { const rel = approachAngle(wrapAngle(c.aimYaw - c.bodyYaw), 0, 8 * dt); c.bodyYaw = approachAngle(c.bodyYaw, faceYaw, 10 * dt); c.aimYaw = c.bodyYaw + rel; }   // (his head comes round WITH him: the aim snapped to the new facing whipped it there in one frame, from wherever the cursor had it)
      else { c.aimYaw = faceYaw; c.bodyYaw = approachAngle(c.bodyYaw, faceYaw, 10 * dt); }
      pl.backpedal = speed > 0.2 && Math.cos(wrapAngle(faceYaw - v3.yawOf(c.vel))) < 0; c.anim.reverse = pl.backpedal;
      }
      // it is not silent: a soft periodic scrape while the body is actually sliding (guards close by will come and look)
      if (speed > 0.3 && !rag.sleeping && !pl.haul?.carry) { pl.dragNoiseT -= dt; if (pl.dragNoiseT <= 0) { pl.dragNoiseT = 0.55; g.audio.play('propScrape', hips, 0.25, { rate: 0.7 }); g.events.push({ kind: 'prop', pos: [hips[0], 0, hips[2]], time: g.time, loud: false, level: 0.22, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, 0.22); } }
    }
  } else if (pl.sprinting) {
    // CoD-style sprint: gun down, body follows the run direction, no aiming
    const moveYaw = v3.yawOf(c.vel); const lean = sprintDoorLean(g, pl);   // (sprintdoor.ts: a shoulder turned into the door he has just run open — null when no such turn is running: the lines as they were)
    c.bodyYaw = approachAngle(c.bodyYaw, moveYaw + (lean ?? 0), 14 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, -0.3, 6, dt);
    if (lean !== null) { pl.doorHead = c.anim.lookYawExtra = sprintDoorHead(c.bodyYaw - moveYaw); pl.doorHeadT = g.time; }   // (his head stays on the run while the shoulder goes in, so the fog's cone does not flick sideways; back to 0 with the turn)
    pl.backpedal = false; c.anim.reverse = false;
  } else if (pl.wall && pl.wall.kind === 'stack') {
    // WALLSNAP — stacked on the wall with the rifle: he faces ALONG it the way he last went (the wall at his shoulder), turning up to 45° off that line to bring
    // the rifle onto the cursor while it is up (a click, or stepped out round the end); behind him past 110° for a fifth of a second, he turns about
    const w = pl.wall; const along = Math.atan2(w.n[0], w.n[2]) - w.side * Math.PI / 2; const moving = Math.abs(w.v) > 0.3;
    let bodyT = along;
    if (aiming && aimDist > 0.25) {
      c.aimYaw += wrapAngle(v3.yawOf(toAim) - c.aimYaw) * (1 - Math.exp(-16 * dt)); c.aimPitch = damp(c.aimPitch, cursorPitch(), 12, dt);
      const off = wrapAngle(v3.yawOf(toAim) - along);
      w.flipT = Math.abs(off) > 110 * DEG && !moving && !(w.lean! > 0) ? (w.flipT ?? 0) + dt : 0; if (w.flipT > 0.2) { w.side = -w.side as -1 | 1; w.flipT = 0; }
      bodyT = along + clamp(wrapAngle(c.aimYaw - along), -0.9, 0.9) * 0.85;
    } else { c.aimYaw += wrapAngle(along - c.aimYaw) * (1 - Math.exp(-10 * dt)); c.aimPitch = damp(c.aimPitch, 0.05, 6, dt); w.flipT = 0; }
    if (!wallTakeYaw(pl)) c.bodyYaw = approachAngle(c.bodyYaw, bodyT, 10 * dt);
    pl.backpedal = false; c.anim.reverse = moving && w.v * w.side < 0;
  } else if (pl.wall) {
    // back to the wall: flat against it when parked — turned toward the way he is going while he sidles (the walk cycle has no sidestep) with the chest twisted
    // back square to the room — eyes coming round toward the open end he is parked at. The pistol is on his thigh for as long as he is on it (wallSnap), so
    // there is no aim here: `aiming` wants the gun in the hand
    const w = pl.wall; const awayYaw = Math.atan2(w.n[0], w.n[2]); const moving = Math.abs(w.v) > 0.3;
    const turnK = smoothstep(0.1, 0.9, Math.abs(w.v) / Math.max(0.3, pl.crouch ? g.tune.playerCrouch : WALL_PACE));   // the legs come round WITH the sidle: nothing at a creep, the full 55° at his sidle pace — no snap from flat to turned the moment he sets off
    if (!wallTakeYaw(pl)) c.bodyYaw = approachAngle(c.bodyYaw, awayYaw - w.side * WALL_TURN * turnK, 10 * dt);   // (the rate stays brisk — squaring up to the wall on taking it is quick; it is the AMOUNT of leg turn that now follows the sidle speed)
    const look = awayYaw - w.side * (w.atEdge === w.side ? WALL_LOOK : moving ? 15 * DEG : 8 * DEG);   // (yaw − = to his right; side + = his right)
    c.aimYaw += wrapAngle(look - c.aimYaw) * (1 - Math.exp(-8 * dt)); c.aimPitch = damp(c.aimPitch, 0.05, 6, dt);
    pl.backpedal = false; c.anim.reverse = moving && w.v * w.side < 0;   // (the beat after a change of direction: still coasting the old way with the legs already turned the new one)
  } else {
    if (!(stalk && STALK.orbit) && aimWeighTurn(g, dt)) { /* aimweight.ts: the gun's heading swings to the cursor's bearing at a limited rate, the circle trailing the cursor (STALK.orbit: not in a creep, where he faces the man — the cursor was left where the press was) */ }
    else if (aimDist > 0.25) c.aimYaw += wrapAngle(v3.yawOf(toAim) - c.aimYaw) * (1 - Math.exp(-16 * dt));   // eased, not snapped: the arms swing through to a new bearing instead of teleporting
    c.aimPitch = damp(c.aimPitch, cursorPitch(), 12, dt);
    // a leaf he is walking open (or about to, or easing by hand: game.ts handsOnDoors feeds anim.doorPush) is taken square on unless the gun is actually up:
    // nobody backs through a door he is pushing, and the free hand only reaches wood in front of him (character.ts doorLayer) — the hips turn INTO the face he
    // pushes (up to 20° off the line of travel), the chest comes round with them (the animator lets the aim twist go while the hand is on), the eyes stay on the aim
    const dp = c.anim.doorPush; const byHand = !!pl.doorMove && !!dp && dp.w >= 1 && !aiming;   // (hands.ts: a leaf he is working by hand — he faces the spot his hand goes to, wherever his feet are taking him)
    const intoDoor = byHand ? Math.atan2(dp!.p[0] - c.pos[0], dp!.p[2] - c.pos[2]) : dp && dp.w >= 1 && !aiming && !dp.holdOnly ? Math.atan2(-dp.n[0], -dp.n[2]) : null;   // (a leaf its closer merely rests on him while he stands scanning the room does not turn him round to it)
    if (speed > 0.2) {
      const moveYaw = v3.yawOf(c.vel);
      const d = Math.cos(wrapAngle(c.aimYaw - moveYaw));
      if (byHand) pl.backpedal = Math.cos(wrapAngle(intoDoor! - moveYaw)) < 0;
      else if (intoDoor !== null) pl.backpedal = false;
      else if (pl.backpedal ? d > -0.05 : d < -0.35) pl.backpedal = !pl.backpedal;
      // hips follow the legs' travel direction (or its reverse) but yield up to ~45° toward the aim so the spine twist stays natural
      const base = pl.backpedal ? wrapAngle(moveYaw + Math.PI) : moveYaw;
      const bodyTarget = byHand ? intoDoor! : intoDoor !== null ? base + clamp(wrapAngle(intoDoor - base), -0.35, 0.35) : base + clamp(wrapAngle(c.aimYaw - base), -0.8, 0.8) * (aiming || (stalk && STALK.orbit) ? 1 : 0.6);   // (square to the leaf, within 20° of his line: it swings as it opens and he is walking through, not round it)
      c.bodyYaw = approachAngle(c.bodyYaw, bodyTarget, (intoDoor !== null ? 12 : 9) * dt);
      c.anim.reverse = pl.backpedal;
    } else {
      pl.backpedal = false; c.anim.reverse = false;
      const off = wrapAngle((intoDoor ?? c.aimYaw) - c.bodyYaw);
      const limit = byHand ? 0.1 : intoDoor !== null ? 0.25 : aiming ? 0.6 : 1.2;
      if (Math.abs(off) > limit) c.bodyYaw = approachAngle(c.bodyYaw, (intoDoor ?? c.aimYaw) - Math.sign(off) * limit * 0.7, (byHand ? 12 : 7) * dt);
    }
  }
  c.anim.speed = speed; c.anim.crouchTarget = pl.crouch ? 1 : 0; c.anim.dash = pl.dash ? 1 : 0;
  if (pl.wall) { c.anim.stance = 'wall'; c.anim.stackSide = pl.wall.side; c.anim.wallPeek = pl.wall.peek; c.anim.wallYaw = wrapAngle(Math.atan2(pl.wall.n[0], pl.wall.n[2]) - c.bodyYaw); }   // back flat to the face whatever the legs do (the animator is told which way the wall faces off his front: square behind when parked, 55° round while the legs are turned to sidle), head / hands / lead foot toward the way he last went, leaning out with the peek (character.ts 'wall'; releaseWall takes it off — the tour's beats own the stance the rest of the time)
  c.anim.upper = pl.sprinting || pl.dragging ? 'none' : aiming ? 'aim' : gunUp ? 'relaxed' : 'none';
  c.anim.runReady = RUNREADY.on && pl.sprinting && gunUp && !c.anim.hideHeldItem;   // (character.ts RUNREADY: the sprint with the pistol in his hand is the low ready in both hands, as the rifle's is the long gun's — false with its switch off, and the sprint's fist as it was)
  { const dp = c.anim.doorPush; const inHands = rifleUp && !c.anim.hideHeldItem; armRifle(g, inHands, !inHands ? null : pl.sprinting ? 'lowLong' : dp && dp.w >= 1 && !aiming ? 'portLong' : 'shoulder'); }   // the FN2000 in both hands = the R1 long-gun solve, its carriage forced by what he is doing (armRifle: shouldered whenever it is in the hands, the low ready for the sprint, the port for a leaf under the hand); slung / no rifle = the pistol's numbers back. hideHeldItem: the lock tools' / a hold's layer still easing out for a few frames after it ended keeps the hands 'busy' — combat.ts handProps draws the rifle on his back by the same flag, so the arms let go of it for exactly those frames too
  // a wall, a jamb or a leaf inside the raised gun's reach on the line he aims along (gunwall.ts; nothing with its switch off): the gun comes to the low ready —
  // the rifle's low carriage, the pistol's stance — and no round leaves it until there is room to bring it up
  const rifleAim = rifleUp && c.anim.longStance === 'shoulder';
  const lockAt = rifleAim && pl.rifle.def.pellets?.breach ? breachAim(g, c, pl.rifle.def.pellets.breach) : null;   // the breaching shotgun laid on a lock: that muzzle is there on purpose, and a breach shot at a lock always fires
  const offFriend = samOffFriend(g, c, (rifleAim || gunUp) && !pl.sprinting && !lockAt, dt);   // (friends.ts FRIENDS.lowReady: a teammate in the line of a raised gun with nobody in a fight; false with the switch off)
  const walled = (stunned && (rifleAim || gunUp)) || (!pl.wall && gunWalled(g, c, rifleAim || gunUp ? 'aim' : null, lockAt, dt, false, !!lockAt)) || offFriend !== false;   // (stunned with a gun up: it comes down as at a wall)   // (the pistol in the hand, aimed or carried: a click is about to bring it up)
  if (walled) { c.anim.upper = 'none'; if (rifleAim) armRifle(g, true, 'lowLong'); if (input.lmbHit()) g.msg(stunned ? "you're stunned, so you can't raise the gun yet" : offFriend !== false ? `gun down — ${offFriend ? offFriend.callsign : 'a friend'} is in your line` : 'no room to bring the gun up'); }
  gunWallStance(c, walled && !rifleAim);
  if (g.orders && planKnee(g.orders)) { c.anim.upper = 'none'; if (rifleAim) armRifle(g, true, 'lowLong'); c.anim.radio(0.9); }   // (planmode.ts planKnee: plan mode up, he is on a knee at the radio — the gun low, his left hand at the handset, asked again each tick so it stays; nothing with its switch off)
  // --- slot actions
  if (pl.wall && WALLSNAP.on) wallSnapPose(g, dt, aiming);   // (the take's feet, the landing, the stack's stance and carriage: wallsnap.ts)
  else if (pl.wall && pl.wall.takeT !== undefined) { c.anim.wallTake = -1; c.anim.wallHit = 0; c.anim.stackPress = 0; c.anim.stanceIn = 0; }   // (the switch thrown off under a hold it took: its channels to rest, the hold goes on as the old one)
  pl.fireCd -= dt;
  if (gun.def.auto) gun.autoIdle(dt, gunUp && input.lmb());   // (a sidearm with an automatic sear — gunslots.ts, the Glock 18: its held string lapses as the rifle's does; nothing to count on a row without one)
  if (gunUp && !pl.sprinting && !pl.dragging) {
    if ((gun.automatic ? input.lmb() || input.lmbHit() : input.lmbHit()) && !walled && pl.fireCd <= (gun.automatic ? 1e-4 : 0) && pl.equipT <= 0) {   // (equipT: the pistol only just came out in the rifle's place — X off the FN2000 — and is not up yet; never non-zero in a kit without the rifle)
      const grow = gun.autoSpread;   // (0 on a row with no automatic sear: every pistol there was)
      if (gun.fire()) {
        pl.fireCd = gun.automatic ? gun.def.auto!.interval : gun.def.cd; pl.lastFireT = g.time; if (gun.def.auto) gun.autoFired();   // the row's cadence (the Five-seveN's 0.22 s; no jitter in Sam's hands)
        const pt = g.puppet?.target && g.puppet.target.state !== 'dead' ? g.puppet.target : null;
        const tgt: Vec3 = pt ? v3.add(pt.char.pos, [0, 1.25, 0]) : g.aimTarget ? v3.copy(g.aimTarget.pos) : g.aimGuard ? (g.aimGuard.wound && g.aimSnap ? v3.copy(g.aimSnap) : manAim(g, g.aimGuard, 1.25)) : freeAim(g);   // a fixture under the reticle IS the target (that is what 'click: shoot' promises); else a guard under the cursor; else level along the cursor's heading (freeAim — the same line the gun / rail light are held on)
        fireWeapon(g, c, aimWeighShot(g, tgt), true, { spread: grow + samSpread(g) + samAim(g) });   // dead-on — unless rounds are going past his own head: then it opens up with his suppression (suppression.ts samSpread: 0 at rest, 0 with the flag off, 0 for the tour's scripted double-taps) — and by the aim model's cone (aim.ts samAim: unsettled, a man crossing, his own feet; 0 with tune.aimModel off / under the puppet)
        if (gun.roundsReady === 0 && !autoReloads(g, gun)) g.msg("you're empty. press R to reload");   // (autoreload.ts: with a magazine left the reload starts itself a beat on and says 'reloading')
      } else if (input.lmbHit()) { pl.fireCd = 0.25; g.audio.play('dryFire', c.muzzle, 0.7); if (!gun.reloading) g.msg(gun.roundsReady === 0 ? autoReloads(g, gun) ? 'click — empty' : 'click — empty (R to reload)' : 'reloading…'); }   // (the PRESS clicks dry: a trigger held on an empty automatic is silence, as the rifle's)
    }
    // right click with the pistol out: the OCP zaps the LIGHT the reticle has snapped to (aimTarget: the auto-aimed fixture or the breaker; or the lit torch / weapon
    // light of the man the ring sits on — his light is electronics too, g.ocp handles both). On a man with no light burning there is nothing for it to do, and it does
    // nothing: no charge spent, no click, no line (the ring shows no right-button affordance there either — overlay.ts / ocpable)
    if (input.rmbHit() && !(KITANIM.on && pl.equipT > 0) && !c.anim.bigTool && (ocpable(g) || (!g.aimTarget && !g.aimGuard))) g.ocp(g.aimTarget);   // (nothing snapped at all: the OCP's own dry click, as it always gave; kitanim.ts: not from a pistol still on its way to his hand)
  }
  // the FN2000 in the hands (docs/internal/sc20k-design.md §5): the LEFT button = a round, always — SEMI one a click, AUTO one every auto.interval while it is held, each
  // of a held string wider than the last (weapons.ts Firearm.autoSpread); the RIGHT button = the launcher, whichever load is UP on it (Rifle.attachment — always
  // one of the two: 2 again flips RING ⇄ 40 MM, above): a ring airfoil (launcher.ts) or a 40 mm grenade (he40.ts) — see the gesture below; the brace is not a
  // button any more (Player.braced: always, in the hands); nothing at all inside the equip beat (equipT: it is still coming off the sling)
  let ringPreview: ThrowSolution | null = null;
  rifle.autoIdle(dt, rifleUp && input.lmb());   // (the AUTO string lapses a quarter second after the trigger comes up — or the moment the rifle is not being fired as a rifle)
  if (rifleUp && !pl.sprinting) {
    const pull = rifle.automatic ? input.lmb() || input.lmbHit() : input.lmbHit();
    if (pull && !walled && pl.fireCd <= 1e-4 && pl.equipT <= 0) {   // (1e-4: 0.1 s is six sixtieths exactly — the float dust of six subtractions must not cost the string a seventh frame; the guards' burst clock does the same)
      const grow = rifle.autoSpread;   // (this round's share of the string's growth, read before it is booked)
      const broke = input.lmbHit() ? shellBreak(g) : null;   // (the shells key: the press breaks off a tube gun's feeding and fires what is chambered — or runs the bolt on what is in the tube)
      if (broke === 'bolt') pl.fireCd = 0.1;
      else if (rifle.fire()) {
        pl.fireCd = rifle.automatic ? rifle.def.auto!.interval : rifle.def.cd; pl.lastFireT = g.time; rifle.autoFired();
        const pt = g.puppet?.target && g.puppet.target.state !== 'dead' ? g.puppet.target : null;
        const tgt: Vec3 = pt ? v3.add(pt.char.pos, [0, 1.25, 0]) : g.aimTarget ? v3.copy(g.aimTarget.pos) : g.aimGuard ? (g.aimGuard.wound && g.aimSnap ? v3.copy(g.aimSnap) : manAim(g, g.aimGuard, 1.25)) : freeAim(g);   // as the pistol's: the fixture, the man, or level along the cursor's heading
        fireWeapon(g, c, aimWeighShot(g, tgt), true, { weapon: rifle.def, spread: rifleSpread(g, speed) + grow + samSpread(g) + samAim(g) });   // his hands on it (still / moving / crouched, braced), the string's growth, and rounds past his own head — and every one of them feeds everybody else's suppression inside fireWeapon like a pistol round
        if (rifle.roundsReady === 0 && !autoReloads(g, rifle)) g.msg(`${rifle.def.short} is empty. press R to reload`);
      } else if (input.lmbHit()) { pl.fireCd = 0.25; g.audio.play('dryFire', c.muzzle, 0.7); if (!rifle.reloading) g.msg(rifle.roundsReady === 0 ? autoReloads(g, rifle) ? `click — the ${rifle.def.short} is empty` : `click — the ${rifle.def.short} is empty (R)` : 'reloading…'); }   // (the PRESS clicks dry once; a trigger HELD on auto over an empty or reloading gun is silence, not a metronome — review 08-10 #17)
    }
    // The launcher: the press BEGINS the gesture, the arc is drawn for as long as the button stays down (the overlay's polyline, as a canister's), and LETTING GO
    // sends the round along it — a tap is a round at once, a hold is a look at the arc first and is never needed. (The arc used to be on screen for as long as
    // an attachment was selected; with one always up it would never leave the picture.) Esc lets go of it unsent (Game.escape → launchCancel), and so does
    // anything that takes the rifle out of the picture: Player.launchHeld is handed on by this block alone, every frame, or it is gone. What goes is the load
    // that is up on the frame the button comes up: 2 pressed under a held button flips the arc with it. One tube: the two loads share its clock (Rifle.ringCd).
    const beat = pl.equipT > 0 && !!pl.wall;   // (stacked on a wall the rifle's rise is the stack's own: stackUp holds the click and hands it back — below; off the wall the equip beat only DELAYS the round)
    const load = rifle.attachment;
    const owed = walled && !stunned && !!launchWas && aimWeighLaunchKeep(pl, dt);   // (aimweight.ts: a load let go of mid-swing and waiting on the circle is kept through a wall the gun swings past — nothing is sent or drawn while it is down)
    let held: RifleAttachment | null = launchWas && load && !beat && (!walled || owed) && !stunned && !g.orders.menu && rifle.left(load) > 0 && !backHit(input) && !input.hit('Blur') && !input.hit('Paused') ? load : null;   // (…and still a round of it to send)
    const down = input.rmb() || input.rmbHit();   // (rmbHit(): a click that began and ended inside one frame is still a frame of 'down' — its release, next frame, sends the round)
    if (!held && input.rmbHit() && !beat && !walled && !stunned) {   // (down for a wall — gunwall.ts: a press is nothing. Still coming off the sling: the press BEGINS it — '2, right button' in one breath — and the round waits for the rifle, below. An order menu up has eaten the button already: orders.ts)
      if (!load) { if (g.aimTarget && !pl.ocpHinted) { pl.ocpHinted = true; g.msg(`the OCP is on the pistol, so press 1 to draw it`); } }   // nothing under this barrel (the shotgun in the rifle's slot): the right button is dead with it up — said once, over a light, then never again
      else if (rifle.left(load) > 0 && rifle.ringCd <= 0) held = load;
      else {   // the dry click, and why: nothing left of this load (and where the other is), or the tube still closing
        g.audio.play('dryFire', c.muzzle, 0.4);
        g.msg(load === 'cam' ? (rifle.cams > 0 ? 'loading the launcher…' : 'no sticky cameras left')
          : load === 'ring' ? (rifle.rings > 0 ? 'cycling the launcher…' : gearText(rifle.shells > 0 ? 'no ring airfoils left — they are not coming back (2 again for the 40 mm)' : 'no ring airfoils left — they are not coming back').replace('2 again', loadKeys()))
          : rifle.shells > 0 ? 'loading the launcher…' : gearText(rifle.rings > 0 || rifle.cams > 0 ? `no 40 mm grenades left (${loadKeys()} for ${nextLoad(rifle)})` : 'no 40 mm grenades left'));
      }
    }
    if (held && !owed) {
      const from = sc20kLauncherMuzzle(c); const at = aimWeighShot(g, held === 'ring' ? ringAimPoint(g, from) : held === 'cam' ? camAimPoint(g, from) : shellAimPoint(g, from));   /* (aimweight.ts: the tube points where the gun does) */
      ringPreview = held === 'ring' ? ringSolve(g, from, at) : held === 'cam' ? camSolve(g, from, at) : shellSolve(g, from, at, shellBodies(g));   // the arc, live, from the tube to the first thing it would meet (handed to the overlay below as throwPreview: the canisters' polyline)
      if (aimWeighLaunch(g, dt, !down && pl.equipT <= 0)) {   // the button came up (and the rifle is in the hands — a click inside the equip beat goes as the beat ends): the round goes, along the arc as it stands this frame (aimweight.ts: let go of mid-swing it waits, arc drawn, for the circle to reach the cursor — half a second at most)
        if (held === 'ring') {
          fireRing(g, c, from, at); if (!g.infiniteAmmo) rifle.rings--; rifle.ringCd = LAUNCHER.cd; pl.fireCd = Math.max(pl.fireCd, 0.3);   // (the trigger hand worked the tube: a beat before the next round too)
          if (rifle.rings <= 0) g.msg(gearText('that was the last ring airfoil'));
        } else if (held === 'cam') {   // a sticky camera (stickycam.ts): flat over the spot, onto the first wall behind it — one more eye for the fog of war
          fireCam(g, pl, from, at); chronicle(g, 'thrown', { kind: 'cam' });   /* (a row for the debrief, not a thing thrown: the par's clock and the 'thrown' count are for cans and grenades) */ if (!g.infiniteAmmo) rifle.cams--; rifle.ringCd = STICKY.cd; pl.fireCd = Math.max(pl.fireCd, 0.3);
        } else {
          const armed = ringPreview ? arcArmed(ringPreview) : true;
          fireShell(g, c, from, at); chronThrown(g, 'he40'); if (!g.infiniteAmmo) rifle.shells--; rifle.ringCd = LAUNCHER40.cd; pl.fireCd = Math.max(pl.fireCd, 0.4);
          if (rifle.shells <= 0) g.msg(armed ? 'that was the last 40 mm' : 'that was the last 40 mm — and too close to arm'); else if (!armed) g.msg(`you're too close. the 40 mm arms ${HE40.armM} m out`);
        }
        pl.lastFireT = g.time; c.anim.fire(); held = null; ringPreview = null;   // (gone: its arc with it)
      }
    }
    pl.launchHeld = held;
  }
  // throwables: preview while a canister slot (3 / 4 / 5) is up; throw on LMB. With the quick throw on (quickthrow.ts: the frozen harness stand, ?quickthrow — the page
  // plays without it) also previewed while G is held and thrown on G release: the throwable selected last (smoke until 4 is pressed), falling back to the other kind
  // when that one has run out
  if (pl.throwEaten && !input.down('KeyG') && !input.hit('KeyG')) pl.throwEaten = false;
  const gHeld = QUICKTHROW.on && !pl.wall && !pl.throwEaten && (input.down('KeyG') || input.hit('KeyG'));   // hit(): a tap that began and ended inside this frame still counts as held for one frame (so its release next frame throws). Not on the wall: the hands are flat on the plaster there (review finding: G still arced and spent a canister)
  if (gHeld && rifleUp && g.throwCount(pl.throwKind === 'flash' && pl.flashbangs > 0 ? 'flash' : pl.canisters > 0 ? 'smoke' : 'flash') > 0) setHolstered(g, true, true);   // a quick-throw with the rifle in the hands slings it first (the throwing arm is the trigger arm): it stays on his back after — E or 2 brings it round again
  const prevPreview = pl.throwPreview;              // on the release frame G is up, so the arc from the last held frame is the one to throw
  pl.throwPreview = null;
  if (g.throwCount(pl.throwKind) <= 0 && g.throwCount(pl.throwKind === 'flash' ? 'smoke' : 'flash') > 0) pl.throwKind = pl.throwKind === 'flash' ? 'smoke' : 'flash';
  const slotKind: ThrowKind | null = pl.holstered ? null : pl.canisterSel;   // the can in the fist: a canister slot selected AND drawn — the same rule combat.ts handProps draws the fist by (Player.canisterSel), so what is thrown and what is shown cannot disagree
  // a wind-up remembers what it was aimed with: spending the last smoke can on LMB mid-hold flips `throwKind` (and clears the slot) a
  // frame later, and the G release must not then cost a stun charge nobody selected. An explicit 2 / 3 press during the hold still switches it.
  // (a frag in the fist is the CLICK's alone: G with it up quick-throws the can selected last, as with a gun up — a grenade is never thrown by reflex)
  const kind: ThrowKind = slotKind === 'frag' && (gHeld || pl.throwHeld) ? (pl.throwHeld && pl.heldKind !== 'frag' ? pl.heldKind : pl.throwKind === 'frag' ? 'smoke' : pl.throwKind) : slotKind ?? (pl.throwHeld ? pl.heldKind : pl.throwKind);
  pl.heldKind = kind;
  if (!pl.sprinting && g.throwCount(kind) > 0 && (slotKind || gHeld)) {
    const tp = g.puppet?.throwAt ?? ap;
    pl.throwPreview = g.items.solve(throwOrigin(g), [tp[0], Math.max(0.05, Math.min(tp[1], 2.6)), tp[2]]);
    if (slotKind && input.lmbHit() && pl.fireCd <= 0 && (c.anim.kitHold === undefined || (c.anim.kitHold === 'can' && pl.kitCan === slotKind))) { doThrow(g, pl.throwPreview, kind); pl.fireCd = 0.6; }   // (kitanim.ts: not a can the hand has not fetched yet — nor the one picked while another kind is still in the fist)
  }
  if (pl.throwHeld && !gHeld && !pl.sprinting && !stunned) { const sol = pl.throwPreview ?? prevPreview; if (sol) doThrow(g, sol, kind); }   // quick-throw on G release
  pl.throwHeld = gHeld && (pl.throwHeld || g.throwCount(kind) > 0);   // a gesture that ran its kind dry stays this kind until G comes up (it just throws nothing)
  if (!pl.throwPreview && ringPreview && !pl.throwHeld) pl.throwPreview = ringPreview;   // the launcher's arc rides the canisters' polyline (overlay.ts) — a canister being aimed has it instead
  if (pl.pendingThrow) { pl.pendingThrow.t -= dt; if (pl.pendingThrow.t <= 0) {
    const { sol, kind: k2 } = pl.pendingThrow;
    const it = g.items.spawn(k2, throwOrigin(g), sol.v0, k2 === 'flash' ? { fuse: flashFuse(g), who: PLAYER_ID } : k2 === 'frag' ? { fuse: FRAG.fuse, who: PLAYER_ID } : { who: PLAYER_ID });
    if (k2 === 'frag') { FRAG_STATS.thrown++; g.msg('frag out!'); }
    it.onBounce = (sp, p, g) => { g.audio.play('canisterBounce', p, Math.min(1, sp / 4)); g.events.push({ kind: 'shot', pos: v3.copy(p), time: g.time, loud: false }); };
    chronThrown(g, k2); pl.pendingThrow = null; if (g.infiniteAmmo) canBack(pl, k2);   // unlimited ammo (the start card's sandbox row): the belt refills as the can leaves the hand
    if ((pl.slot === 'smoke' && pl.canisters === 0) || (pl.slot === 'flash' && pl.flashbangs === 0) || (pl.slot === 'frag' && pl.frags === 0)) pl.slot = 'pistol';   // the last can of the selected kind is away: back onto the pistol (drawn — the hand that threw it is free)
  } }
  if (KITANIM.on || pl.kitWas !== undefined) kitTick(g, true);   // (kitanim.ts: what this frame did to his hands AFTER the keys — off a wall, a sling for a throw, the last can away — starts its errand now, not a frame late with the new thing already shown)
  gunWallPose(g, c);
  c.update(dt);
  // the weapon light: physically mounted under the barrel / on the fore-end — its position and direction ARE the gun's, aiming or not (rigProps.RIG.pistol.light*, RIG.sc20k light / lens)
  gun.infinite = g.infiniteAmmo; rifle.infinite = g.infiniteAmmo;
  const L = pl.light; L.peakIntensity = L.intensity = T.playerLight; L.radius = g.engine.settings.flashlightRadius * 0.7;   // weapon light bezel is a bit smaller than the guards' hand torches
  poseGunLight(g);   // sprinting: gun down, light dark; hands still coming off the lock tools: the gun (and its light) is on the thigh
  // footsteps (for audio + AI hearing): step events from the locomotion phase — walking, crouch-walking, sprinting, the sidle along a wall and the crouched haul of
  // a body all tread here; the level is the gait's × the floor's (floor.ts tread: carpet 0.6, stone 1.1 … — one number for the mixer, the guards and the meter)
  const fall = footfallDue(g, dt, c.anim.phase, tapHeld(g) ? 0 : speed);   // (tapstep.ts: a step's footfall is its plant)
  if (fall) {   // (FOOTFALL: an edge of the cycle crossed at a footfall's speed, or a step's worth of leg with none)
    const base = pl.sprinting ? 1 : pl.dash ? CROUCHRUN.loud : pl.crouch ? 0.125 : loadGait(g, 'player', speed) > 2 ? 0.6 : 0.26;   // (crouch / walk per-step levels carry the clips' retiming — 0.72 / 1.06 m/s natural, so ~1.4x the steps per metre — at the old per-SECOND loudness: 0.18 x 0.69, 0.35 x 0.73; what a guard accumulates over a stretch of floor is unchanged)
    const loud = tread(g, c.pos, pl.sprinting ? base : base * loadHeard(g, 'player'), true);   // (kitload.ts: × what his card rattles and weighs; 1 with its switch off — and a flat-out sprint is boots on a floor whatever he carries)
    g.events.push({ kind: 'step', pos: v3.copy(c.pos), time: g.time, loud: false, level: loud }); pl.noise = Math.max(pl.noise, loud);
    if (fall === 1) wetFootfall(g, pl.stepPhase < 0.5);   // in from the rain: a wet print under the foot that landed, for his next few steps (wet.ts — a decal, seen by the player only; nothing without decals or a dry man)
  }
}

/** The cone Sam's next rifle round is drawn with for how he stands (RIFLE_SPREAD): still or on the move at `speed`, × crouched, × braced. The AUTO string's growth
 *  and his suppression's share are added at the fire site (they are the row's and suppression.ts's, not his stance's). */
export function rifleSpread(g: Game, speed: number): number {
  const pl = g.player, S = RIFLE_SPREAD, H = pl.rifle.def.hands;   // (weapons.ts `hands`: the reach this long gun has in his hands — absent on the FN2000 and the shotgun: 1 each)
  const feet = AIMCOST.move && !g.touring ? Math.max(speed, pl.aim.moveSm) : speed;   // (aimcost.ts: the feet his hands still remember — a stop on the trigger's own step is not 'still')
  return (feet > S.moveAt ? S.moving * (H?.moving ?? 1) : S.still * (H?.still ?? 1)) * (pl.crouch ? S.crouchK * (H?.crouch ?? 1) : 1) * (pl.braced ? S.braceK : 1);
}

/** Living guards are solid to you and never step aside (updateGuard / runGuardScript separate guards from each other only — a man must not be blocked or steered by a
 *  player he may not even know is there), so you are the one who yields, and every shove is collided with the statics and the world edge AGAIN, so none ever
 *  leaves you standing in a wall for the frame (or, pinned to a 12 cm partition, popped out of its far side):
 *  - a man who STANDS (or whom you run into): pushed straight back out to KEEP_OFF — capped above sprint speed, so solid to anything you do, while a man a script
 *    drops on top of you eases you off over a few frames instead of popping you half a metre; squeezing between him and a wall you slide along the wall past him;
 *  - a man WALKING into you (you within ~50° of dead ahead of the leg he is on): shouldered SIDEWAYS off his line of travel — to the side of it you are on if the
 *    statics leave your body the room to clear him there, else across it if the other side does, else to whichever side has the more room (he brushes through
 *    what is left of the overlap), and only where neither has any to speak of (a narrow doorway) does he simply walk through you — never straight ahead of him,
 *    which would carry you the length of the corridor; less squarely in front, straight away from him minus the share that is only his stride closing; and
 *    wherever the statics eat the shove (pinned to the wall beside his track) you stay where you stand rather than the leftover feeding you along the wall ahead
 *    of him frame after frame. In live play a man coming on has seen you long before he touches you; this is what the tour's unseen Sam and the sandbox get.
 *  `y1` = the headroom updatePlayer collided you with this frame. */
function keepOffGuards(g: Game, dt: number, y1: number) {
  const p = g.player.char.pos;
  const room = (sx: number, sz: number) => { const hit = g.col.raycast([p[0], 0.45, p[2]], [sx, 0, sz], 1.5); return (hit ? hit.t : 1.5) - BODY_R; };   // how far your centre can travel that way before your circle meets a static (or a leaf) at shin height
  for (const gd of g.guards) {
    if (gd.state === 'dead' || gd.held) continue;   // (the man in his arm is placed off him, not kept off him: updateHold)
    const dx = p[0] - gd.char.pos[0], dz = p[2] - gd.char.pos[2]; const l = Math.hypot(dx, dz);
    if (l >= KEEP_OFF) continue;
    if (noShoveMan(g, gd)) {   // (noshove.ts: a man of his own falling in is the one who yields — only what his own legs closed on the man is taken back)
      const back = l > 1e-4 ? noShoveBack(g, gd.char.pos[0], gd.char.pos[2], l) : 0;
      if (back > 0) { const bx = p[0], bz = p[2]; p[0] += dx / l * back; p[2] += dz / l * back; collidePlayer(g, y1); noShoveNote(g, p[0] - bx, p[2] - bz); }
      continue;
    }
    const gv = gd.char.vel; const gs = Math.hypot(gv[0], gv[2]); const walking = gs > 0.2;
    let nx: number, nz: number;   // straight away from him (dead on his centre: to the right of wherever he is heading)
    if (l > 1e-4) { nx = dx / l; nz = dz / l; } else if (gs > 1e-3) { nx = gv[2] / gs; nz = -gv[0] / gs; } else { nx = 1; nz = 0; }
    let cap = 6, fx = 0, fz = 0, ahead = 0;   // his line of travel — the leg to his next waypoint (steady while he pivots onto it through you), else his velocity — and how squarely you are in front on it (cos)
    if (walking) {
      const wp = gd.pathI < gd.path.length ? gd.path[gd.pathI] : null; const wx = wp ? wp[0] - gd.char.pos[0] : 0, wz = wp ? wp[2] - gd.char.pos[2] : 0, wl = Math.hypot(wx, wz);
      if (wl > 0.3) { fx = wx / wl; fz = wz / wl; } else { fx = gv[0] / gs; fz = gv[2] / gs; }
      ahead = nx * fx + nz * fz;
      if (ahead > 0.64) {
        let sx = nx - ahead * fx, sz = nz - ahead * fz; const sl = Math.hypot(sx, sz); let b = l * sl;   // your side of his line, and how far off it you already are
        if (b >= 0.04) { sx /= sl; sz /= sl; } else { sx = fz; sz = -fx; b = 0; }                      // (square in his way: his right)
        const near = b + room(sx, sz), far = room(-sx, -sz) - b;                                        // how far off his line you can get on your side / by crossing to the other
        if (near < KEEP_OFF && (far >= KEEP_OFF || far > near + 0.25)) { if (far < 0.25) continue; sx = -sx; sz = -sz; } else if (near < 0.25) continue;   // (crossing his line only for clearly more room; none worth having either way — a narrow doorway — he walks through you)
        nx = sx; nz = sz; cap = 4; ahead = 0;
      }
    }
    const push = Math.min(KEEP_OFF - l, cap * dt); const bx = p[0], bz = p[2];
    p[0] += nx * push; p[2] += nz * push;
    if (ahead > 0) { const his = ahead * Math.min(push, gs * dt * ahead); p[0] -= fx * his; p[2] -= fz * his; }   // (the forward share of a straight shove that is only his stride closing on you this frame is not yours to travel: half beside him you would still ride along)
    collidePlayer(g, y1);
    if (walking && (p[0] - bx) * nx + (p[2] - bz) * nz < 0.5 * push) { p[0] = bx; p[2] = bz; const s = g.player.safe; if (s) { s[0] = bx; s[2] = bz; } }   // the statics ate it: pinned — stay put (bx, bz is already a settled spot) and let him brush through
    noShoveNote(g, p[0] - bx, p[2] - bz);   // (noshove.ts: what a man moved him by is not his walking — nothing with its switch off)
  }
}

// ------------------------------------------------------------ back to the wall (Q) — Chaos Theory's wall hug: your back to a wall face, sidling along it, peeking round its end
/** how far beyond the body circle a face may stand for Q to reach it (m) */
const WALL_REACH = 0.7;
/** the sliver of air left between the body circle and the face once he is on it (centre BODY_R + this off the plane) */
const WALL_GAP = 0.03;
/** probe heights: a face must show at the KNEE and at the CHEST (a wall, a 1.4 m cubicle partition, a server rack, a vending machine…) or at the knee and ABOVE DOOR
 *  HEIGHT (glazing: a sill with a header over it) — never a desk edge, a counter, a filing cabinet, the back of the couch */
const KNEE_Y = 0.45, CHEST_Y = 1.35, HIGH_Y = 2.7;
/** two knee-height faces are one wall to slide along if their planes agree to this (a door jamb stands 1.2 cm proud: it ends the face — the doorway is not wall) */
const COPLANAR = 0.01;
/** …while whatever stands over the knee-height face may be set back or proud by this much and still count as wall up there (a notice board, glass in its frame) */
const UPPER_TOL = 0.08;
/** a break between coplanar faces narrower than this is bridged (the 9 cm between two server racks); a doorway or the mouth of an aisle is not */
const WALL_BRIDGE = 0.15;
/** the shortest run of face worth putting your back to: both shoulders on it */
const WALL_MIN_FACE = 2 * BODY_R + 0.06;
/** pace along the wall standing (crouched: tune.playerCrouch) — a sidle, never a run */
const WALL_PACE = 1.4;
/** while sliding, the legs turn this far toward the direction of travel (the walk cycle has no sidestep) and the chest twists back square to the room; parked, he is flat to the wall */
const WALL_TURN = 55 * DEG;
/** parked at an open end (or headed for it), eyes and chest come round toward it this much; at full peek the neck cranes WALL_PEEK_LOOK further */
const WALL_LOOK = 25 * DEG, WALL_PEEK_LOOK = 30 * DEG;
/** let go when something holds him this far off the plane (a guard shouldering through, a leaf swung into him), or when the stick is held AWAY from the wall (more
 *  than half of it square off the face) for this long */
const WALL_SHOVE_OFF = 0.25, WALL_AWAY_SECS = 0.25;
/** seconds over which taking hold eases him onto the face, and over which the peek comes in / goes */
const WALL_SETTLE = 0.22, WALL_PEEK_SECS = 0.3;

/** Player.wall while his back is to a wall. The face is the plane {q · n = d}, n out of the wall into the room, along = [−n.z, 0, n.x] (his right when flat to it);
 *  [lo, hi] is the run of coplanar, tall-enough STATIC face along `along`, traced once when he took hold (statics never move; leaves and furniture are not wall),
 *  openLo / openHi whether the way on past each end is open (an outside corner, a jamb: somewhere to peek round) or walled (an inside corner: he simply stops).
 *  u = his station along it (clamped so the whole body stays on the face), v = signed sidle speed, side = the way he last went (which shoulder leads, which way
 *  the head turns), off = how far something is holding him off the plane right now (eases back to 0 as it lets him), awayT = stick-held-away clock, settle = 0→1
 *  ease onto the face from `from` (where Q found him), peekDir = the end the current (or fading) peek is round. atEdge / peek / crouched are the read-outs game.ts documents. */
export interface WallHold {
  n: Vec3; along: Vec3; d: number; lo: number; hi: number; openLo: boolean; openHi: boolean;
  u: number; v: number; side: -1 | 1; off: number; awayT: number; settle: number; from: Vec3;
  /** the way (±1) something the trace could not see stopped him, and for how long it has: no re-trying it every frame (cleared when the stick lets off that way, or after half a second for another look) */
  blockDir: -1 | 0 | 1; blockT: number;
  /** has his back actually reached the face yet (a read-back found him within the shove allowance of the plane)? Only for the words when he comes off: shoved
   *  off a wall he was on, or never got to it — a carton stack, a chair, a man between him and it that the face trace could not see */
  seated: boolean;
  /** was the selected item in his hand when he took the wall? On the BACK hold the hands are always empty (wallSnap holsters it: Chaos Theory's wall hug is a hands-on-
   *  the-plaster pose, and nothing is fired from it); the frame he steps off, releaseWall puts it back in his hand if this says so. E on the wall flips it,
   *  1 / 2 / 3 set it (updatePlayer) — choosing what he comes off with. (The rifle is the exception under WALLSNAP.stackDraw: it comes into his hands on the wall and the hold becomes the stack.) */
  drawn: boolean;
  atEdge: -1 | 0 | 1; peek: number; peekDir: -1 | 1; crouched: boolean;
  /** WALLSNAP (wallsnap.ts) — absent, all of them, on a hold taken with the switch off. takeT = the seconds this take runs (the glide and the turn share it: `settle`
   *  counts through it), yaw0 / yawD = the body's yaw when Q found him and the turn he makes over the take, hitT = seconds since his back landed (the settle). */
  takeT?: number; yaw0?: number; yawD?: number; hitT?: number;
  /** …and the STACK: the hold taken with the rifle in his hands keeps it there — shoulder to the wall, facing along it toward `side`, low ready. up = seconds the
   *  rifle stays in the shoulder (a click, or stepped out), lean = 0‥1 stepped out past the open end `leanDir` (leanWant = where it is going, leanDwell / leanOutT
   *  its clocks, leanOff = the metres along the wall he actually stands past his station for it this frame — the read-back takes them off), flipT = the
   *  cursor-behind-him clock, sayT = when the 'wall in the way' line was last said. */
  kind?: 'stack'; up?: number; lean?: number; leanWant?: boolean; leanDir?: -1 | 1; leanDwell?: number; leanOutT?: number; leanOff?: number; leanMore?: number; flipT?: number; sayT?: number; rise?: number; owed?: number; camAlong?: number; cam?: FollowCamera;
}

/** The static face lying in the plane (n, d) at station u along t — if there is one there fit to lean on: from a point 0.3 m out in the room, a knee-height ray
 *  straight into the plane must meet a static (never a leaf) within COPLANAR of it, facing back out along n; and so must a chest-height ray or, failing that, one
 *  above door height (those two within UPPER_TOL: what is up there may be a board hung on the wall or glass set back in its frame). Returns that knee-height box's
 *  extent along t. (An origin inside a piece of furniture standing against the wall sees through it to the wall: the body's own collision then stops him at it.) */
function faceAt(col: StaticCollision, n: Vec3, d: number, t: Vec3, u: number): [number, number] | null {
  const OFF = 0.3; const ox = t[0] * u + n[0] * (d + OFF), oz = t[2] * u + n[2] * (d + OFF); const dir: Vec3 = [-n[0], 0, -n[2]];
  const cast = (y: number, tol: number) => { const h = col.raycast([ox, y, oz], dir, OFF + tol + 0.02); return h && h.index < 1e6 && Math.abs(h.t - OFF) <= tol && h.n[0] * n[0] + h.n[2] * n[2] > 0.98 ? h : null; };
  const knee = cast(KNEE_Y, COPLANAR); if (!knee) return null;
  if (!cast(CHEST_Y, UPPER_TOL) && !cast(HIGH_Y, UPPER_TOL)) return null;
  const b = col.boxes[knee.index]; const cs = Math.cos(b.yaw), sn = Math.sin(b.yaw);
  const hw = Math.abs(t[0] * cs - t[2] * sn) * b.h[0] + Math.abs(t[0] * sn + t[2] * cs) * b.h[2];   // the box's half-width along t (box local X = (cos, 0, −sin), local Z = (sin, 0, cos) in world XZ)
  const uc = b.c[0] * t[0] + b.c[2] * t[2];
  return [uc - hw, uc + hw];
}

/** The whole run of wall through station u0: the face there (or within a body radius either side — he may be level with a jamb or the crack between two racks),
 *  widened both ways across coplanar neighbours and across breaks narrower than WALL_BRIDGE — as far as it goes (taking hold: the run is kept), or only `look`
 *  either side of u0 (asking whether there is one: enough to know the body fits within a sidestep). */
function traceFace(col: StaticCollision, n: Vec3, d: number, t: Vec3, u0: number, look = Infinity): [number, number] | null {
  let seg: [number, number] | null = null;
  for (const du of [0, -0.21, 0.21, -BODY_R, BODY_R]) if ((seg = faceAt(col, n, d, t, u0 + du))) break;
  if (!seg) return null;
  let [lo, hi] = seg;
  for (let i = 0; i < 32 && hi < u0 + look; i++) { const nx = faceAt(col, n, d, t, hi + 0.01) ?? faceAt(col, n, d, t, hi + WALL_BRIDGE); if (!nx || nx[1] <= hi + 1e-4) break; hi = nx[1]; }
  for (let i = 0; i < 32 && lo > u0 - look; i++) { const nx = faceAt(col, n, d, t, lo - 0.01) ?? faceAt(col, n, d, t, lo - WALL_BRIDGE); if (!nx || nx[0] >= lo - 1e-4) break; lo = nx[0]; }
  return [lo, hi];
}

/** Is the way on past an end of the face open (an outside corner, a doorway: something to peek round) or shut off (the other wall of an inside corner, a leaf
 *  standing across it)? Knee- and hip-height rays from the parked station `uEnd` on along ±t, a body radius and a hand. */
function endOpen(col: StaticCollision, n: Vec3, d: number, t: Vec3, uEnd: number, s: -1 | 1): boolean {
  const px = t[0] * uEnd + n[0] * (d + BODY_R + WALL_GAP), pz = t[2] * uEnd + n[2] * (d + BODY_R + WALL_GAP); const dir: Vec3 = [t[0] * s, 0, t[2] * s];
  for (const y of [KNEE_Y, 1.0]) if (col.raycast([px, y, pz], dir, BODY_R + 0.2)) return false;
  return true;
}

/** The radius the prop solver gives a character's circle (game.ts updateProps): loose furniture nearer his centre than this is holding him off. */
const PROP_BODY_R = 0.3;
/** Push the circle (q, r) out of the loose furniture as it stands this frame, as if it were nailed down (props.ts circleContact's measure, prop by prop, a
 *  few passes) — findWall's guess at where the prop solver will hold him: a carton stack or a chair standing against the wall does not yield to a man leaning
 *  back on it (whatever it cannot pass on to the wall it hands straight back to him), so a station inside one is a station he never reaches. Mutates q;
 *  true if anything moved it. */
function clearOfProps(g: Game, q: Vec3, r: number): boolean {
  let moved = false;
  for (let it = 0; it < 3; it++) {
    let any = false;
    for (const pr of g.props.props) {
      const dx = q[0] - pr.x, dz = q[2] - pr.z; if (dx * dx + dz * dz > (pr.radius + r) * (pr.radius + r)) continue;
      const cs = pr.cs, sn = pr.sn; const lx = cs * dx - sn * dz, lz = sn * dx + cs * dz;                     // the centre in the prop's frame
      const qx = clamp(lx, -pr.hx, pr.hx), qz = clamp(lz, -pr.hz, pr.hz); const ex = lx - qx, ez = lz - qz; const d2 = ex * ex + ez * ez;
      if (d2 >= r * r) continue;
      let nx: number, nz: number, pen: number;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); nx = ex / d; nz = ez / d; pen = r - d; }
      else { const px = pr.hx - Math.abs(lx), pz = pr.hz - Math.abs(lz); if (px < pz) { nx = lx < 0 ? -1 : 1; nz = 0; pen = px + r; } else { nx = 0; nz = lz < 0 ? -1 : 1; pen = pz + r; } }
      q[0] += (cs * nx + sn * nz) * pen; q[2] += (-sn * nx + cs * nz) * pen; any = moved = true;
    }
    if (!any) break;
  }
  return moved;
}

/** What Q would take hold of from here: the nearest static face within WALL_REACH of the body (16 knee-height rays round him; box sides are upright by
 *  construction), tall enough and long enough by traceFace, with room on it for the body within a short sidestep of where he stands — clear of the statics
 *  AND of the furniture standing there — and nothing between him and that spot. u = the station he would take; [lo, hi] the whole run (`quick`: only traced
 *  a metre either side — the answer, not the run, is wanted). null = nothing to press against; `why.blocked` then says a face WAS in reach but furniture
 *  keeps him off it (the words differ). */
function findWall(g: Game, quick = false, why?: { blocked: boolean }, only?: Vec3): { n: Vec3; t: Vec3; d: number; lo: number; hi: number; u: number } | null {
  const pl = g.player, p = pl.char.pos, col = g.col; const f = pl.char.forward();
  const sp = Math.hypot(pl.char.vel[0], pl.char.vel[2]), far = WALLSNAP.on && sp > 0.5;   // WALLSNAP: a face he is walking AT is in reach from further off, and outranks a nearer one he is merely passing
  const reach = far ? Math.max(WALL_REACH, WALLSNAP.reachMoving) : WALL_REACH;
  const cands: { n: Vec3; d: number; score: number }[] = [];
  for (let k = 0; k < 16; k++) {
    const a = k * Math.PI / 8; const dir: Vec3 = [Math.sin(a), 0, Math.cos(a)];
    const hit = col.raycast([p[0], KNEE_Y, p[2]], dir, BODY_R + reach);
    if (!hit || hit.index >= 1e6 || Math.abs(hit.n[1]) > 0.2) continue;                       // nothing there, or a door leaf
    const n = v3.normalize([hit.n[0], 0, hit.n[2]]);
    if (only && n[0] * only[0] + n[2] * only[2] < 0.99) continue;                              // (wallPress: the face he is pushing into, no other)
    if (n[0] * dir[0] + n[2] * dir[2] > -0.35) continue;                                       // a face only glanced side-on: the ray square to it finds it if it faces him at all
    const d = (p[0] + dir[0] * hit.t) * n[0] + (p[2] + dir[2] * hit.t) * n[2];
    const dist = p[0] * n[0] + p[2] * n[2] - d;                                                 // how far his centre stands off that plane
    const heading = far ? -(pl.char.vel[0] * n[0] + pl.char.vel[2] * n[2]) / sp : 0, at = heading > WALLSNAP.headingMin;
    if (dist < BODY_R - 0.06 || dist > BODY_R + (at ? reach : WALL_REACH)) continue;
    const dup = cands.find(c => c.n[0] * n[0] + c.n[2] * n[2] > 0.99 && Math.abs(c.d - d) < 0.02);
    if (dup) { if (d < dup.d) dup.d = d; continue; }                                            // one plane per face — and of two a centimetre apart (a jamb standing proud of its wall, met first by one ray) the deeper is the wall: traced along the jamb's, the wall a centimetre behind fell outside COPLANAR here and there and Q found 'nothing' a hand from where it held
    cands.push({ n, d, score: dist - 0.12 * Math.max(0, -(f[0] * n[0] + f[2] * n[2])) - (at ? WALLSNAP.headingBonus * heading : 0) });     // nearest first; of two much alike (an inside corner), the one he is facing — walking into
  }
  cands.sort((a, b) => a.score - b.score);
  const y1 = pl.crouch ? 1.0 : 1.7;
  for (const c of cands) {
    const n = c.n, t: Vec3 = [-n[2], 0, n[0]]; const u0 = p[0] * t[0] + p[2] * t[2];
    const run = traceFace(col, n, c.d, t, u0, quick ? 1.0 : Infinity); if (!run) continue;
    const [lo, hi] = run; if (hi - lo < WALL_MIN_FACE) continue;
    const u = clamp(u0, lo + BODY_R, hi - BODY_R); if (Math.abs(u - u0) > 0.35) continue;   // a short sidestep onto the end of a wall he is just past, no more
    // room for the body at that station: settle a copy against the statics, and against the furniture as it stands (nailed down, for the guess: clearOfProps),
    // and see that it is still on the plane and on the face — a pot, a bench, the other wall of an inside corner, a carton stack against the wall say no (or
    // 'a step further along, beside it'); a board proud of the wall at chest height merely holds him a few centimetres off it
    const q: Vec3 = [t[0] * u + n[0] * (c.d + BODY_R + WALL_GAP), 0, t[2] * u + n[2] * (c.d + BODY_R + WALL_GAP)];
    col.collideCircle(q, BODY_R, 0.2, y1, 4); col.clampToWorld(q, BODY_R);
    const byProps = clearOfProps(g, q, PROP_BODY_R + 0.02);
    const off = q[0] * n[0] + q[2] * n[2] - (c.d + BODY_R + WALL_GAP), uq = q[0] * t[0] + q[2] * t[2];
    if (Math.abs(off) > 0.1 || uq < lo + BODY_R - 0.02 || uq > hi - BODY_R + 0.02 || Math.abs(uq - u0) > 0.4) { if (byProps && why) why.blocked = true; continue; }
    if (v3.distXZ(p, q) > 0.05 && col.solidBlocked([p[0], KNEE_Y, p[2]], [q[0], KNEE_Y, q[2]])) continue;   // and a clear step there (not round the end of a partition he is level with, not through a shut leaf)
    return { n, t, d: c.d, lo, hi, u: clamp(uq, lo + BODY_R, hi - BODY_R) };
  }
  return null;
}

/** For the HUD / the input pass: is he free to put his back to a wall, and would Q find one from where he stands? (Cheap enough to ask every frame: a ring of
 *  short rays and a metre of face traced either side of him.) */
export function canWallSnap(g: Game): boolean {
  const pl = g.player;
  return !pl.wall && !pl.down && !pl.dragging && !pl.takedown && !pl.holding && !pl.kick && !pl.picking && !pl.wanding && !pl.sprinting && !!findWall(g, true);
}

/** Q: take hold of the wall findWall offers. The hold is set up here; moveOnWall eases him onto it over the next few frames (through his own collision sweep,
 *  like any move of his) and turns his back to it. Which shoulder leads (WallHold.side) comes from the way he was moving, else the way he was facing, else the
 *  camera's right. Crouched or standing as he was. Whatever was in his hand goes away (the pistol drawn on the thigh like any holstered state, remembered in
 *  WallHold.drawn for releaseWall to hand back): on the wall his palms are on the plaster. false = nothing in reach (or his hands / feet are busy).
 *  `only`: the one face to take, by its normal (wallPress: the wall he is pushing into, not a nearer one beside him). */
export function wallSnap(g: Game, cam: FollowCamera, why?: { blocked: boolean }, only?: Vec3): boolean {
  const pl = g.player, c = pl.char;
  if (pl.wall || pl.down || pl.dragging || pl.takedown || pl.holding || pl.kick || pl.picking || pl.wanding) return false;
  const f = findWall(g, false, why, only); if (!f) return false;
  const { n, t } = f;
  const vt = c.vel[0] * t[0] + c.vel[2] * t[2], ft = Math.sin(c.bodyYaw) * t[0] + Math.cos(c.bodyYaw) * t[2], rt = cam.planarBasis().right;
  const side: -1 | 1 = Math.abs(vt) > 0.3 ? (vt > 0 ? 1 : -1) : Math.abs(ft) > 0.4 ? (ft > 0 ? 1 : -1) : rt[0] * t[0] + rt[2] * t[2] >= 0 ? 1 : -1;
  const uLo = f.lo + BODY_R, uHi = f.hi - BODY_R;
  pl.wall = { n, along: t, d: f.d, lo: f.lo, hi: f.hi, openLo: endOpen(g.col, n, f.d, t, uLo, -1), openHi: endOpen(g.col, n, f.d, t, uHi, 1),
    u: f.u, v: 0, side, off: 0, awayT: 0, settle: 0, from: v3.copy(c.pos), blockDir: 0, blockT: 0, seated: false, drawn: !pl.holstered, atEdge: 0, peek: 0, peekDir: side, crouched: pl.crouch };
  const stack = WALLSNAP.on && WALLSNAP.stack && pl.rifleUp;   // the rifle in his hands stays there: he stacks on the wall instead of putting his back to it
  if (WALLSNAP.on) {
    const w = pl.wall, awayYaw = Math.atan2(n[0], n[2]), base = f.d + BODY_R + WALL_GAP;
    let yd = wrapAngle((stack ? awayYaw - side * Math.PI / 2 : awayYaw) - c.bodyYaw);
    if (!stack && Math.abs(yd) > Math.PI - 0.3) yd = side * Math.abs(yd);   // nose to the plaster: he comes round through the side he will look
    w.yaw0 = c.bodyYaw; w.yawD = yd; w.hitT = 0;
    w.takeT = wsTakeSecs(Math.hypot(t[0] * f.u + n[0] * base - c.pos[0], t[2] * f.u + n[2] * base - c.pos[2]), yd);
    { const b = c.bones, ft = (a?: Vec3, toe?: Vec3) => a && toe ? { p: v3.copy(a), yaw: Math.atan2(toe[0] - a[0], toe[2] - a[2]) } : null, L = ft(b.footL, b.toeL), R = ft(b.footR, b.toeR); c.anim.wallTakeFeet = L && R ? { L, R } : null; }   // (where his soles are drawn this moment: they stay there until each steps)
    if (stack) { w.kind = 'stack'; w.up = 0; w.lean = 0; w.leanWant = false; w.leanDir = side; w.leanDwell = 0; w.leanOutT = 0; w.leanOff = 0; }
    wsPend.delete(pl);
  }
  pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false; pl.speedSm = 0; c.vel = [0, 0, 0];
  if (!stack) setHolstered(g, true);
  return true;
}

/** Step off the wall — Q again, a sprint, walking away from it, being shoved off it, or anything that plants him elsewhere (takedown, kick, pick, drag, teleport,
 *  going down): the ready stance and the craned neck come off, nothing carries him on along or into it, and what he had in his hand when he took it is back in
 *  it (WallHold.drawn — not for a man going down: hitPlayer has already settled what leaves a falling hand). */
export function releaseWall(g: Game) {
  const pl = g.player, w = pl.wall; if (!w) return;
  pl.wall = null; pl.char.anim.stance = 'none'; pl.char.anim.lookYawExtra = 0; pl.char.vel = [0, 0, 0];
  pl.char.anim.wallTake = -1; pl.char.anim.wallHit = 0; pl.char.anim.stackPress = 0; pl.char.anim.stanceIn = 0;   // (WALLSNAP's channels at rest: where they stand anyway with the switch off)
  if (w.cam) w.cam.peekOffset = null;   // (…and the look-at it eased into the room: a takedown, a kick, a teleport lets go after this frame's camera line has run)
  if (w.drawn && !pl.down) setHolstered(g, false);
}

// ---- WALLSNAP (wallsnap.ts): the hold's feel pass. Everything below is reached only with WALLSNAP.on — except wallStepOff, which with it off IS releaseWall.

/** The player's own ways off the wall (Q, breaking into a run, the stick held away): releaseWall — and, with the switch on, his momentum kept. A direction held
 *  (unless it is INTO the wall) walks on at the walk's pace from this frame, or the sidle's if that was quicker; Q with nothing held peels him a hand off the
 *  plaster and leaves him standing in the shadow he chose; the pose lets go quicker than it took hold. */
function wallStepOff(g: Game, mx: number, mz: number, ml: number, how: 'q' | 'run' | 'away') {
  const pl = g.player, w = pl.wall; releaseWall(g);
  if (!w || !WALLSNAP.on || pl.down) return;
  const c = pl.char, T = g.tune; c.anim.stanceOut = WALLSNAP.slow ? WALLSNAP.slowOut : WALLSNAP.outRate;
  wallVoice(g, w, false);
  if (ml > 0) { if (-(mx * w.n[0] + mz * w.n[2]) < 0.5) pl.speedSm = Math.max(Math.abs(w.v), 0.8 * (pl.crouch ? crouchPace(g) : T.playerWalk) * pl.pace * (g.puppet?.walk ?? 1)); }
  else if (how === 'q') c.vel = [w.n[0] * WALLSNAP.offPush, 0, w.n[2] * WALLSNAP.offPush];
}

/** WALLSNAP.voice: the hold's own two sounds, the player's ears only (no event is filed: nobody hears his jacket on the plaster). `on` = his back has just
 *  landed; else he has stepped off by his own choice (Q, a run, the stick held away) or been pushed off. A hold taken with the feel pass off has neither. */
function wallVoice(g: Game, w: WallHold, on: boolean) {
  const W = WALLSNAP; if (!W.on || !W.voice || w.takeT === undefined) return;
  if (!on && !((w.hitT ?? 0) > 0)) return;   // (a take let go of before his back landed: there was no plaster to peel off)
  const gain = on ? W.voiceOn : W.voiceOff; if (gain > 0) g.audio.play(on ? 'wallOn' : 'wallOff', g.player.char.pos, gain, { rate: w.kind === 'stack' ? 0.92 : 1 });
}

/** Q pressed with no face in reach while he is on the move: remembered for WALLSNAP.buffer seconds (the words wait with it). `at` = the game clock the last
 *  time it was looked at: a frame that went to something else (a takedown, a man in his arm, a kick, a lock, a keypad return before the Q lines) drops it. */
const wsPend = new SideMap<Player, { t: number; at: number; blocked: boolean }>('player.wsPend');
function wallSnapLater(g: Game, ml: number, why: { blocked: boolean }): boolean {
  if (!WALLSNAP.on || ml <= 0 || WALLSNAP.buffer <= 0 || g.player.dragging) return false;
  wsPend.set(g.player, { t: WALLSNAP.buffer, at: g.time, blocked: why.blocked }); return true;
}
function wallSnapPending(g: Game, dt: number, cam: FollowCamera, wantSprint: boolean) {
  const pl = g.player, P = wsPend.get(pl); if (!P) return;
  if (pl.wall || wantSprint || g.time - P.at > dt * 1.5) { wsPend.delete(pl); return; }   // (a frame was missed: the key was for the moment before whatever took it, so no late hold and no late words)
  P.at = g.time; const why = { blocked: false };
  if (wallSnap(g, cam, why)) return;
  if ((P.t -= dt) <= 0) { wsPend.delete(pl); g.msg(P.blocked || why.blocked ? "can't get to the wall here" : 'nothing to put your back to here'); }
}

/** WALLSNAP.press: the wall taken WITHOUT the key. A move key held INTO a face (pressFace: the stick within pressDeg of square to it, the face within pressNear
 *  of his body) for pressSecs takes it exactly as Q would — wallSnap, kept to that face: the same faces, the same refusals, and nothing said where there is
 *  none. The clock runs on the walk up, so a man who walks squarely at a wall has it from pressFlow short of touching and his back comes round as he arrives;
 *  one who turns into a wall he stands against waits the whole of it there. NEVER at a run, with his hands on anything, a list or an order menu up, a mouse
 *  button held (he is shooting, or about to), the gun in his hand reloading or still coming out, or inside pressAfterShot of a round of his own. With a
 *  sidearm or a can in the hand, which the hold puts away, only while no enemy is alert (pressCalm: in a fight the pistol stays up; the rifle stacks in his
 *  hands either way). Where the face he walks into has a thing to use on it or beside it (pressThingAt: a door, a switch, the breaker, the mission's thing,
 *  a body) the wait is pressThing and all of it against the face: he walked up to use it.
 *  THE LATCH (`n`, `dx dz`, `until`): when a hold ends, or the wall refuses a take, the stick as it then stands is remembered with that wall. Until the stick
 *  rests or turns (pressTurn), a wall facing as that one does is not taken at all — Q, Shift or a step away is not undone by the key still held, and a
 *  refusal is not asked again every frame — and any other wall not for pressAgain: stepping off does not throw him onto the far side of a narrow passage,
 *  while a walk straight across a corridor has the far wall as he arrives. */
const wsPress = new SideMap<Player, { t: number; at: number; n: Vec3 | null; dx: number; dz: number; held: boolean; until: number }>('player.wsPress');
/** the face a ray from his knee along the stick meets: its level normal, where the ray meets it, and what is left between his body and it (the measure
 *  findWall takes of a face: BODY_R off the plane is touching) — null on open floor, a door's leaf, or a face the stick is more along than at */
function pressFace(g: Game, mx: number, mz: number): { n: Vec3; at: Vec3; off: number } | null {
  const W = WALLSNAP, p = g.player.char.pos, cosMin = Math.cos(W.pressDeg * DEG);
  const hit = g.col.raycast([p[0], KNEE_Y, p[2]], [mx, 0, mz], (BODY_R + W.pressNear) / cosMin);
  if (!hit || hit.index >= 1e6 || Math.abs(hit.n[1]) > 0.2) return null;
  const n = v3.normalize([hit.n[0], 0, hit.n[2]]), into = -(mx * n[0] + mz * n[2]);
  if (into <= cosMin) return null;
  const off = hit.t * into - BODY_R;
  return off > W.pressNear ? null : { n, at: [p[0] + mx * hit.t, KNEE_Y, p[2] + mz * hit.t], off };
}
function wallPress(g: Game, dt: number, input: Input, cam: FollowCamera, mx: number, mz: number, ml: number, wantSprint: boolean) {
  const pl = g.player, W = WALLSNAP; let P = wsPress.get(pl);
  if (!P) wsPress.set(pl, P = { t: 0, at: g.time, n: null, dx: 0, dz: 0, held: false, until: 0 });
  if (g.time - P.at > dt * 1.5) P.t = 0;                                    // frames his feet were not his own (a blast, a beat): the wait starts again
  P.at = g.time;
  if (pl.wall) { P.t = 0; P.n = [pl.wall.n[0], 0, pl.wall.n[2]]; P.held = false; return; }
  if (P.n && !P.held) { P.held = true; P.dx = mx; P.dz = mz; P.until = g.time + W.pressAgain; }   // the hold has just ended: the stick as it stands
  if (P.n && (ml <= 0 || mx * P.dx + mz * P.dz < Math.cos(W.pressTurn * DEG))) P.n = null;         // the stick has rested or turned: the latch is gone
  const face = ml > 0 && !wantSprint && !g.puppet && !g.touring ? pressFace(g, mx, mz) : null;
  if (!face || (P.n && (face.n[0] * P.n[0] + face.n[2] * P.n[2] > 0.9 || g.time < P.until))) { P.t = 0; return; }
  const inHand = pl.holstered ? null : pl.rifleUp ? pl.rifle : pl.pistol, gunAway = !pl.holstered && !(W.stack && pl.rifleUp);   // (gunAway: what the back hold takes out of his hand)
  const busy = pl.dragging || !!pl.haul || !!pl.doorMove || !!pl.easing || !!pl.charging || pl.choosing || pl.sel.downT >= 0 || pl.throwHeld || !!g.orders.menu
    || input.lmb() || input.rmb() || !!inHand?.reloading || pl.equipT > 0 || g.time - pl.lastFireT < W.pressAfterShot;
  if (busy || (W.pressCalm && gunAway && g.guards.some(h => h.state === 'alert' && h.team !== 'operative' && h.team !== 'civilian'))) { P.t = 0; return; }
  const thing = g.nearby.some(it => it.inReach && PRESS_THINGS.has(it.kind) && thingDist(it, face.at) < W.pressThingAt);
  if (thing && face.off > W.pressTouch) { P.t = 0; return; }
  P.t += dt;
  if (P.t < (thing ? W.pressThing : W.pressSecs) - 1e-6 || face.off > (thing ? W.pressTouch : Math.max(W.pressTouch, W.pressFlow))) return;
  P.t = 0;
  if (!wallSnap(g, cam, undefined, face.n)) { P.n = face.n; P.held = true; P.dx = mx; P.dz = mz; P.until = g.time + W.pressAgain; }
}
/** the things that stand where they are and are worked by hand (the wall press's touch; interact.ts emptyThing: what an empty tap can be beside) */
export const PRESS_THINGS: ReadonlySet<string> = new Set(['door', 'switch', 'breaker', 'objective', 'cam', 'body']);

// ---- the hold in a checkpoint (savestate.ts SaveState.wallHold, under SAVETIMELINE.holds). No file held a hold before the wall could be taken by walking: a
// load stood him free of it, the pistol the hold had put away still away. Now a save finds him on a wall as often as not, and the seconds after a load must be
// the seconds after the save: the hold as it stands (all but the camera it eases, which the next frame hands it again) and the key-less take's clock and latch.
// WH names every field of WallHold and how a load reads it: a field added to the hold and not named here does not compile.
type WhKind = 'vec' | 'num' | 'unit' | 'opt' | 'bool' | 'optbool' | 'sign' | 'sign0' | 'optsign' | 'stack' | 'derived';
const WH = {
  n: 'vec', along: 'derived', from: 'vec', d: 'num', lo: 'num', hi: 'num', u: 'num', v: 'num', off: 'num', awayT: 'num', blockT: 'num', settle: 'unit', peek: 'unit',
  openLo: 'bool', openHi: 'bool', seated: 'bool', drawn: 'bool', crouched: 'bool', side: 'sign', peekDir: 'sign', blockDir: 'sign0', atEdge: 'sign0',
  takeT: 'opt', yaw0: 'opt', yawD: 'opt', hitT: 'opt', up: 'opt', lean: 'opt', leanDwell: 'opt', leanOutT: 'opt', leanOff: 'opt', leanMore: 'opt', flipT: 'opt', sayT: 'opt', rise: 'opt', owed: 'opt', camAlong: 'opt',
  leanWant: 'optbool', leanDir: 'optsign', kind: 'stack',
} as const satisfies Record<keyof Omit<WallHold, 'cam'>, WhKind>;
export type WallSnap = { hold?: Record<string, unknown>; press?: { t: number; at: number; n: number[] | null; dx: number; dz: number; held: boolean; until: number } };
export function wallHoldSnapshot(g: Game): WallSnap | undefined {
  const pl = g.player, w = pl.wall, P = wsPress.get(pl), out: WallSnap = {};
  if (w) { const { cam: _cam, ...rest } = w; out.hold = { ...rest, n: [...w.n], along: [...w.along], from: [...w.from] }; }
  if (P) out.press = { t: P.t, at: P.at, n: P.n ? [...P.n] : null, dx: P.dx, dz: P.dz, held: P.held, until: P.until };
  return out.hold || out.press ? out : undefined;
}
/** …and back, onto the fresh Player a load has placed. A file that does not say, or a slice that is not a hold he could be in where he stands (a face that is
 *  not level, a run with no length, a station off it, his body not at that plane): free of the wall, as a load always left him. */
export function wallHoldRestore(g: Game, raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const pl = g.player, p = pl.char.pos, S = raw as WallSnap, num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x), vec = (x: unknown): x is number[] => Array.isArray(x) && x.length === 3 && x.every(num);
  const H = S.hold;
  hold: if (H && typeof H === 'object') {
    const w: Record<string, unknown> = {};
    for (const k of Object.keys(WH) as (keyof typeof WH)[]) {
      const kind: WhKind = WH[k], v = H[k];
      if (kind === 'vec') { if (!vec(v)) break hold; w[k] = [...v]; }
      else if (kind === 'num') { if (!num(v)) break hold; w[k] = v; }
      else if (kind === 'unit') { if (!num(v)) break hold; w[k] = clamp(v, 0, 1); }
      else if (kind === 'bool') w[k] = !!v;
      else if (kind === 'sign') { if (v !== 1 && v !== -1) break hold; w[k] = v; }
      else if (kind === 'sign0') { if (v !== 1 && v !== -1 && v !== 0) break hold; w[k] = v; }
      else if (kind === 'opt') { if (num(v)) w[k] = v; }
      else if (kind === 'optbool') { if (typeof v === 'boolean') w[k] = v; }
      else if (kind === 'optsign') { if (v === 1 || v === -1) w[k] = v; }
      else if (kind === 'stack') { if (v === 'stack') w[k] = v; }
    }
    const n = w.n as Vec3, len = Math.hypot(n[0], n[2]); if (Math.abs(n[1]) > 1e-6 || Math.abs(len - 1) > 1e-3) break hold;
    w.n = [n[0] / len, 0, n[2] / len]; const N = w.n as Vec3; w.along = [-N[2], 0, N[0]];
    const d = w.d as number, lo = w.lo as number, hi = w.hi as number, u = w.u as number, off = p[0] * N[0] + p[2] * N[2] - d;
    if (hi - lo < WALL_MIN_FACE || u < lo - 1e-6 || u > hi + 1e-6 || off < BODY_R - 0.2 || off > BODY_R + WALL_REACH + 0.5) break hold;
    if (w.takeT !== undefined && !((w.takeT as number) > 0)) break hold;
    pl.wall = w as unknown as WallHold;
  }
  const P = S.press;
  if (P && typeof P === 'object' && num(P.t) && num(P.at) && num(P.dx) && num(P.dz) && num(P.until) && (P.n === null || vec(P.n)))
    wsPress.set(pl, { t: Math.max(0, P.t), at: P.at, n: P.n ? [...P.n] as Vec3 : null, dx: P.dx, dz: P.dz, held: !!P.held, until: P.until });
}

/** Does the rifle, drawn on this hold, stack on it (WALLSNAP.stackDraw; a hold taken under the feel pass: the stack's clocks hang off its take)? */
function wallStacks(w: WallHold): boolean { return WALLSNAP.on && WALLSNAP.stack && WALLSNAP.stackDraw && w.takeT !== undefined; }

/** The take's turn: while he is being eased onto the wall his body comes round on the take's own clock, a little ahead of the glide (the shoulders turn, then
 *  the back lands). false = not taking (or the switch was off when he took hold): the caller's own easing turns him. */
function wallTakeYaw(pl: Player): boolean {
  const w = pl.wall!; if (w.takeT === undefined || w.settle >= 1) return false;
  pl.char.bodyYaw = wrapAngle(w.yaw0! + w.yawD! * wsEase(w.settle, WALLSNAP.yawPow)); return true;
}

/** Esc with the launcher's button down: the gesture is let go of, nothing sent (Game.escape; the button still down afterwards begins nothing — only a fresh press does) */
/** WHERE THE CAN HE IS AIMING WILL COME TO REST (THROWBACK.restMark; overlay.ts draws the preview's ring there): the arc's own first touch is not where a can
 *  stays — it bounces and rolls on a metre or two — and the maintainer could not put a smoke on a gap by it. frag.ts restOfThrow on the arc being shown.
 *  `path`: the floor it crosses from that touch to there. Null with the mark off, with no arc up, and for the launcher's arc (its round bursts or sticks
 *  where it lands). Read only. */
export function throwRest(g: Game): { at: Vec3; path: Vec3[] } | null {
  const pl = g.player, sol = pl.throwPreview; if (!THROWBACK.restMark || !sol || !sol.points.length || !(pl.throwHeld || (!pl.holstered && pl.canisterSel))) return null;
  return restOfThrow(g, pl.heldKind, sol.points[0], sol.v0);
}
export function launchCancel(g: Game): boolean { const pl = g.player; if (!pl.launchHeld) return false; pl.launchHeld = null; pl.throwPreview = null; return true; }
/** Stacked on the wall: is the rifle UP this frame? A click (or the trigger held; the right button too with an attachment on it) brings it into the shoulder and
 *  keeps it there WALLSNAP.upSecs; stepped out round the end it is up for as long as he is out. Never while the first WALLSNAP.bore of its line is in a wall
 *  (pointing through the wall he is stacked on): then it stays low and no round leaves — held off through equipT, the 'still coming into the hands' beat every
 *  fire site already honours. Nothing leaves the low ready either: for WALLSNAP.upRise after it starts up the click is held (equipT again) and given to the
 *  fire sites on the frame the rise is over — the first round leaves with the rifle most of the way to the shoulder, a sixth of a second after the click, not level from the thigh. */
function stackInWay(g: Game): boolean {
  const pl = g.player, c = pl.char, ap = g.aimPoint, dx = ap[0] - c.pos[0], dz = ap[2] - c.pos[2], d = Math.hypot(dx, dz);
  const hit = d > 0.25 ? g.col.raycast([c.pos[0], pl.crouch ? 0.85 : 1.3, c.pos[2]], [dx / d, 0, dz / d], WALLSNAP.bore) : null;
  return !!hit && hit.index < 1e6;
}
/** HIS GUN CANNOT GET A ROUND OUT THIS FRAME (GUNWALL.mark; overlay.ts bars the aim ring with it — the words a dead click files are in no list the page
 *  draws): held down by a wall (gunwall.ts), kept low on the stack with the wall he is on in its line (stackUp), or up with its muzzle the far side of a
 *  jamb from its shoulder (combat.ts armThrough: that round stops in the wood). Read only: nothing of the game's is written, nothing counted. */
export function gunShut(g: Game): boolean {
  const pl = g.player, c = pl.char; if (!GUNWALL.mark || pl.holstered) return false;
  if (gunWallIs(g, c)) return true;
  const w = pl.wall;   // (not through a step-out: from his station the point he steps out FOR is behind his wall, and the ring would flash barred each time)
  if (w?.kind === 'stack') { if (w.leanWant || w.lean! > 0 || w.leanDwell! > 0) { if (w.lean! < 1) return false; } else if (w.settle >= 1 && stackInWay(g)) return true; }
  return (c.anim.upper === 'aim' || (pl.rifleUp && c.anim.longStance === 'shoulder')) && woodBetween(g, c.bones.upperArmR ?? v3.add(c.pos, [0, 1.4, 0]), c.muzzle);   // (combat.ts armThrough's own two points; a sheet his rounds go through is no wood: gunwall.ts)
}
function stackUp(g: Game, dt: number, input: Input): boolean {
  const pl = g.player, c = pl.char, w = pl.wall!, W = WALLSNAP;
  const hold = () => { pl.equipT = Math.max(pl.equipT, 1e-3); };
  if (w.settle < 1) { w.up = 0; if (W.slow) w.owed = (w.owed ?? 0) | (input.clicked & 5); hold(); return false; }   // still coming onto the wall (WALLSNAP.slow: the take is long enough for a click to fall inside it — kept, and it brings the rifle up as he lands)
  if (samStaggered(g)) { w.up = 0; w.rise = 0; w.owed = 0; hold(); return false; }   // folded by a blast (samstun.ts): the rifle stays at the low ready, and a click made meanwhile is not owed a round
  const pull = input.lmb() || input.lmbHit() || (pl.rifle.attachment !== null && (input.rmb() || input.rmbHit())) || (W.slow && !!w.owed && !(w.up! > 0));   // (…or a click kept from the take)
  if (stackInWay(g)) {
    w.up = 0; w.rise = 0; w.owed = 0; hold();
    if (input.lmbHit() && g.time - (w.sayT ?? -10) > 1.5) { w.sayT = g.time; g.msg('the wall is in the way, so step out past its end or come off it'); }
    return false;
  }
  const was = w.up! > 0;
  w.up = pull || (w.leanWant && w.lean! > 0.3) ? W.upSecs : Math.max(0, w.up! - dt);
  if (w.up <= 0) { w.rise = 0; w.owed = 0; return false; }
  w.rise = was ? (w.rise ?? 0) + dt : 0;
  if (w.rise < W.upRise) { w.owed = (w.owed ?? 0) | (input.clicked & 5); hold(); }   // still coming up: the click waits for the shoulder
  else if (w.owed) { if (!g.orders.menu) input.clicked |= w.owed; w.owed = 0; }   // (an order menu opened meanwhile: the click is the menu's frame, not a round)
  return true;
}

/** Stacked at an open end: does he step out round it? When the cursor's point is somewhere the corner hides from where he is parked (further round it than his
 *  line of sight past the corner reaches, by leanOnDeg to go and leanOffDeg to come back; not nearer the corner than leanMinDist; not so far round — leanMaxDeg —
 *  that it is behind his own wall), he steps out along the wall past its end, leanAlong, and back when the cursor comes back; dwell clocks both ways, a least
 *  time out, and no stepping back in the beat after a round. A reload brings him in. Returns the signed metres along the wall to stand past his station. */
function stackLean(g: Game, dt: number, cam: FollowCamera, w: WallHold, dir: -1 | 0 | 1): number {
  if (w.lean === undefined) return 0;
  const W = WALLSNAP, pl = g.player, t = w.along, n = w.n;
  if (samRooted(g)) return w.leanDir! * (W.leanAlong + (w.leanMore ?? 0)) * w.lean * w.lean * (3 - 2 * w.lean);   // rooted by a blast (samstun.ts): he neither steps out nor back in — he stands where it caught him
  let want = false; const edge = w.atEdge;
  if (w.kind === 'stack' && w.settle >= 1 && edge !== 0 && dir !== -edge && !pl.rifle.reloading && (w.leanWant || Math.abs(w.v) < 0.05)) {
    // What he is pointing AT. The cursor's ray lands on whatever the camera sees first, and seen from his side of a wall that is often the wall's own top or
    // a doorway's lintel, not the floor behind it: a point that high (and not a man the reticle took) is read where the same ray comes down to chest height —
    // the cursor over the doorway's head means INTO the doorway.
    let ap = g.aimPoint; const uEnd = edge > 0 ? w.hi : w.lo;
    if (W.leanOver && ap[1] > W.leanOverY && !g.aimGuard) { const dy = ap[1] - cam.pos[1]; if (dy < -0.5) { const k = (LEAN_CHEST - ap[1]) / dy; ap = [ap[0] + (ap[0] - cam.pos[0]) * k, LEAN_CHEST, ap[2] + (ap[2] - cam.pos[2]) * k]; } }
    const A = wsCornerAngle((ap[0] * t[0] + ap[2] * t[2] - uEnd) * edge, ap[0] * n[0] + ap[2] * n[2] - w.d);
    want = A.dist >= W.leanMinDist - (w.leanWant ? W.leanKeepDist : 0) && A.deg < W.leanMaxDeg + (w.leanWant ? W.leanKeepDeg : 0) && A.deg > wsSeenDeg(BODY_R, BODY_R + WALL_GAP) + (w.leanWant ? W.leanOffDeg : W.leanOnDeg);
    // …and only where stepping out buys a line: from where he would stand, the first stretch toward the point is open (a shut door at the end is a wall carried on)
    if (want && !w.leanWant && W.leanClearM > 0) {
      const c = pl.char, h = pl.crouch ? 0.85 : 1.3, k = edge * W.leanAlong - (w.leanOff ?? 0);   // (from his STATION: he may still be on his way back in — by what he really stands past it, which a body in the way can cut short)
      const a: Vec3 = [c.pos[0] + t[0] * k, h, c.pos[2] + t[2] * k], d = Math.hypot(ap[0] - a[0], ap[2] - a[2]), r = Math.min(1, W.leanClearM / Math.max(d, 1e-3));
      if (d < 0.2 || g.col.shotBlocked(a, [a[0] + (ap[0] - a[0]) * r, h + (ap[1] - h) * r, a[2] + (ap[2] - a[2]) * r])) want = false;
    }
    // THE GUN'S SHARE (WALLSNAP.leanGun): the least further step from which the rifle and the start of its round's way are clear; it grows at the
    // step-out's own speed and is kept until he is back in (a cursor that wanders does not walk him to and fro)
    if (want && W.leanGun > 0) {
      const c = pl.char, k0 = edge * W.leanAlong - (w.leanOff ?? 0); let need = 0;
      if ((w.leanMore ?? 0) < W.leanGun) for (let m = 0; m <= W.leanGun + 1e-6; m += Math.max(0.02, W.leanGunStep)) if (gunClearFrom(g, c, c.pos[0] + t[0] * (k0 + edge * m), c.pos[2] + t[2] * (k0 + edge * m), ap, W.leanClearM)) { need = m; break; }
      if (need > (w.leanMore ?? 0)) w.leanMore = Math.min(need, (w.leanMore ?? 0) + dt * W.leanAlong / W.leanOut);
    }
  }
  if (want !== w.leanWant) {
    w.leanDwell! += dt;
    const kept = !want && (w.leanOutT! < W.minOut || g.time - pl.lastFireT < W.afterShot) && w.kind === 'stack' && !pl.rifle.reloading && dir !== -edge;
    if (w.leanDwell! >= (want ? W.dwellOut : W.dwellBack) && !kept) { w.leanWant = want; w.leanDwell = 0; if (want) { w.leanDir = edge as -1 | 1; w.side = edge as -1 | 1; } }
  } else w.leanDwell = 0;
  w.leanOutT = w.leanWant ? w.leanOutT! + dt : 0;
  w.lean = clamp(w.lean + (w.leanWant ? dt / W.leanOut : -dt / W.leanBack), 0, 1);
  if (w.leanMore !== undefined && w.lean <= 0 && !w.leanWant) delete w.leanMore;
  return w.leanDir! * (W.leanAlong + (w.leanMore ?? 0)) * w.lean * w.lean * (3 - 2 * w.lean);
}

/** One frame of the feel pass's pose, after the hold's own lines have run (updatePlayer): the take's progress and the landing's settle to the animator (and the
 *  scuff, once, as his back lands — the player's ears only: no event is filed), and on the stack the stance, the shoulder's press toward the wall and the rifle's
 *  carriage — low ready, in the shoulder while it is up. */
function wallSnapPose(g: Game, dt: number, aiming: boolean) {
  const pl = g.player, c = pl.char, w = pl.wall!, an = c.anim, W = WALLSNAP;
  if (w.takeT === undefined) return;   // (taken with the switch off: the hold as it was)
  an.wallTake = w.settle < 1 ? w.settle : -1;
  an.stanceIn = W.slow ? (w.kind === 'stack' ? W.slowIn * 13 / 22 : W.slowIn) : 0;   // (the stack's pose comes on at the stance's own 13, the back hold's at 22: each at its share)
  if (w.settle >= 1 && w.seated) { if (w.hitT === 0) { if (W.voice) wallVoice(g, w, true); else if (W.scuff > 0) g.audio.play('footSoft', c.pos, W.scuff, { rate: 0.7 }); } w.hitT! += dt; }
  an.wallHit = w.settle >= 1 && w.seated ? wsHit(w.hitT!) : 0;
  if (w.kind === 'stack') {
    an.stance = 'stack'; an.stackSide = w.side;
    an.stackPress = w.side * STACK_PRESS * (1 - (w.lean ?? 0));   // (signed: the animator eases it, so a change of side walks the hips across instead of jumping them)
    armRifle(g, true, aiming ? 'shoulder' : 'lowLong');
  } else an.stackPress = 0;
}
/** the height a cursor's point over a wall's top is read at (m) */
const LEAN_CHEST = 1.2;
/** how far toward the wall the stacked figure stands off his collision circle's centre (m): the circle keeps the centre 0.45 off the plane, a shoulder is 0.2 wide */
const STACK_PRESS = 0.12;

/** The camera on the wall: the look-at eased a little into the room and toward the side he looks (the hallway he is watching, not the plaster behind him).
 *  Added to whatever the peek set; the camera's own smoothing eases it. Not during the take. THROUGH A STACK'S STEP-OUT THE CAMERA HOLDS STILL: the look-at
 *  gives back the share of the step HE REALLY TOOK (leanOff: a man standing past the corner can cut it short) that it would have followed (1 − aimLead of it) and keeps the side term it had, so the world point under a cursor that is not
 *  moving does not move either — what he is aiming at stays under the reticle as he steps out, and the step-out's own test (stackLean reads that point) is not
 *  fed by the step-out. */
function wallSnapCam(cam: FollowCamera, w: WallHold) {
  if (w.takeT === undefined || w.settle < 1) return;
  const W = WALLSNAP, n = w.n, t = w.along, p = cam.peekOffset ?? [0, 0, 0];
  const out = !!w.lean || !!w.leanWant || !!w.leanOff;
  if (!out || w.camAlong === undefined) w.camAlong = w.side * W.camSide * (1 - w.peek);
  const along = w.camAlong - (out ? (w.leanOff ?? 0) * (1 - cam.aimLead) : 0), room = W.camRoom * (w.kind === 'stack' ? 0.5 : 1);
  cam.peekOffset = [p[0] + n[0] * room + t[0] * along, 0, p[2] + n[2] * room + t[2] * along]; w.cam = cam;
}

/** One frame on the wall (updatePlayer runs this in place of free movement); false = he has just come off it (walked away, shoved off) and the caller moves him as
 *  a free man this same frame. The tangential share of the (camera-relative, unit) stick slides him if it is at least as large as the share square to the face —
 *  INTO the wall does nothing, AWAY from it for WALL_AWAY_SECS lets go. His station u advances at WALL_PACE (crouch pace on his knees) and is clamped so the body
 *  stays wholly on the traced face — he stops at its end, he does not go round the corner; he is put on the plane at that station (eased in and out from where Q
 *  found him over WALL_SETTLE), then collided with the statics and kept off the guards like any move. What the face trace could not see is met here: the step is first tried on
 *  a copy of the body, and one that the statics would take straight back (a bench, a plant pot, the post of an inside corner) or that would prise him more than a
 *  hand off the plane is not taken — he stops short, dead, and that way stays shut for a beat (blockDir) instead of being ground at every frame; something merely
 *  proud of the wall (a notice board, an extinguisher) he rides out and round, `off` easing him back after where nothing turns that into a slide. Whatever else
 *  moves him is read back into u / off the same way (`take`): the guards this frame, and — first thing next frame — the leaves and the furniture, which have their
 *  say after the player has moved (game.ts updateDoors / updateProps): a man shouldering past holds him off the plane and he settles back once he is by, a chair he
 *  sidles into holds him where he met it; more than WALL_SHOVE_OFF off the plane (a leaf swung into him) or carried past the face's end, he lets go. Parked at an
 *  OPEN end and still pushed toward it, the peek eases in: the camera's follow point moves out past the corner (FollowCamera.peekOffset) and his neck cranes round
 *  it; it eases out again when he stops pushing or moves off. */
function moveOnWall(g: Game, dt: number, cam: FollowCamera, mx: number, mz: number, ml: number): boolean {
  const pl = g.player, c = pl.char, w = pl.wall!; const n = w.n, t = w.along; const y1 = pl.crouch ? 1.0 : 1.7;
  const uLo = w.lo + BODY_R, uHi = w.hi - BODY_R; const base = w.d + BODY_R + WALL_GAP;
  if (w.kind === 'stack' && (!pl.rifleUp || !WALLSNAP.on)) { w.kind = undefined; w.up = 0; w.drawn = !pl.holstered && !pl.dragging; }   // (WALLSNAP: the rifle left his hands on the stack — E, a digit: it is the back-to-the-wall hold from here, and what is in his hand goes away like on any)
  if (w.kind !== 'stack' && wallStacks(w) && pl.rifleUp) { w.kind = 'stack'; w.up = 0; w.rise = 0; w.owed = 0; w.drawn = true; if (w.lean === undefined) { w.lean = 0; w.leanWant = false; w.leanDir = w.side; w.leanDwell = 0; w.leanOutT = 0; w.leanOff = 0; } }   // (WALLSNAP: the rifle came into his hands on the back hold — 2, E: he turns his shoulder to the wall and stacks on it, as if he had taken it so. A hold that WAS the stack a moment ago keeps its step-out as it stands — stepped out past a corner, 1 then 2 must not put him 'past the end of the wall': stackLean eases it from where it is)
  if (!pl.holstered && w.kind !== 'stack') { w.drawn = true; setHolstered(g, true, true); }   // (whatever else drew it — a tour beat, the panel — on the wall it goes back on the thigh, and into his hand when he steps off)
  // the stick: along the face (± his right) or square to it (+ away)
  let dir: -1 | 0 | 1 = 0, away = 0;
  if (ml > 0) {
    const a = mx * t[0] + mz * t[2]; away = mx * n[0] + mz * n[2]; const wide = WALLSNAP.on && WALLSNAP.alongDeg > 0;
    if (wide ? Math.abs(a) >= Math.cos(WALLSNAP.alongDeg * DEG) : Math.abs(a) > 0.2 && Math.abs(a) >= Math.abs(away) - 0.05) dir = a > 0 ? 1 : -1;
    if (wide && dir && dir !== w.blockDir && (dir > 0 ? w.u < uHi - 0.02 : w.u > uLo + 0.02)) away = 0;   // (WALLSNAP.alongDeg: the stick is the camera's, the wall is wherever it is — a key that sidles him is not a key held away, however the camera is turned. Only while it CAN sidle him: at the end of the run, or against a man, an outward diagonal is the way off round the corner, as it always was)
  }
  w.awayT = away > 0.5 ? w.awayT + dt : 0;
  if (w.awayT > (WALLSNAP.on ? (away > 0.82 ? WALLSNAP.awaySecs : WALLSNAP.awayDiag) : WALL_AWAY_SECS)) { wallStepOff(g, mx, mz, ml, 'away'); return false; }
  if (dir) w.side = dir;
  /** read where he actually is back into the hold: shoved off it or past its end → let go (false). `firm`: held back against the stick by a man → that way shuts
   *  for a beat (else he would tread on the spot pressing into the man's back); not firm (furniture): just take the station — a bin he keeps pushing along, as a walk does */
  const take = (firm: boolean): boolean => {
    const uReal = c.pos[0] * t[0] + c.pos[2] * t[2] - (w.leanOff ?? 0), offReal = c.pos[0] * n[0] + c.pos[2] * n[2] - base;
    if (uReal < uLo - 0.25 || uReal > uHi + 0.25 || offReal > WALL_SHOVE_OFF) { g.msg(w.seated ? 'pushed off the wall' : "can't get to the wall here"); if (w.seated) wallVoice(g, w, false); releaseWall(g); return false; }
    w.seated = true;
    if (Math.abs(uReal - w.u) > 0.003) {
      if (firm) { if (dir && (uReal - w.u) * dir < 0) { w.v = 0; w.blockDir = dir; w.blockT = 0; } else if ((uReal - w.u) * w.v < 0) w.v = 0; }
      w.u = clamp(uReal, uLo, uHi);
    }
    w.off = Math.max(0, offReal);
    return true;
  };
  if (w.settle >= 1 && !take(false)) return false;   // whatever a leaf or the furniture made of where we left him last frame
  if (w.blockDir && (dir !== w.blockDir || (w.blockT += dt) > 0.5)) { w.blockDir = 0; w.blockT = 0; }   // the stick let off that way, or time for another look (a man may have walked on; a bench says no again at once, unseen)
  pl.sprinting = false; w.crouched = pl.crouch;
  const want = dir === w.blockDir ? 0 : dir * (pl.crouch ? g.tune.playerCrouch : WALL_PACE) * (g.puppet?.walk ?? 1);
  w.v = damp(w.v, want, Math.abs(want) > Math.abs(w.v) && want * w.v >= 0 ? 6 : 12, dt);
  if (!want && Math.abs(w.v) < 0.02) w.v = 0;
  // his station along the face, the whole body kept on it
  let u = w.u + w.v * dt;
  if (u >= uHi) { u = uHi; if (w.v > 0) w.v = 0; } else if (u <= uLo) { u = uLo; if (w.v < 0) w.v = 0; }
  const ease = (s: number) => s < 1 ? (w.takeT !== undefined ? wsEase(s, WALLSNAP.easePow) : s * s * (3 - 2 * s)) : 1;   // (WALLSNAP: the take eases OUT, on its own clock)
  const ePrev = ease(w.settle);   // the take-hold ease as it stood (smoothstep of settle): this frame's share of the way in is reckoned from it below
  w.settle = Math.min(1, w.settle + dt / (w.takeT ?? WALL_SETTLE));
  if (w.off > 0 && w.settle >= 1) {   // whatever held him off the plane is let ease him back — unless settling back would push him along it (squeezed off the corner of the thing) or is simply refused
    const offWant = Math.max(0, w.off - 0.8 * dt); const q: Vec3 = [t[0] * w.u + n[0] * (base + offWant), 0, t[2] * w.u + n[2] * (base + offWant)]; g.col.collideCircle(q, BODY_R, 0.2, y1, 4);
    if (Math.abs(q[0] * t[0] + q[2] * t[2] - w.u) < 1e-3 && q[0] * n[0] + q[2] * n[2] - (base + offWant) < 0.5 * (w.off - offWant)) w.off = offWant;
  }
  let stand = base + w.off;
  if (w.settle >= 1 && Math.abs(u - w.u) > 1e-6) {   // the step tried on a copy: taken straight back, or prising him off the wall — stop short of whatever it is; merely deflected — ride it out and round
    const q: Vec3 = [t[0] * u + n[0] * stand, 0, t[2] * u + n[2] * stand]; g.col.collideCircle(q, BODY_R, 0.2, y1, 4);
    const adv = u - w.u, kept = q[0] * t[0] + q[2] * t[2] - w.u, out = q[0] * n[0] + q[2] * n[2] - stand;
    if (kept / adv < 0.3 || w.off + out > 0.12) { u = w.u; w.v = 0; if (dir) { w.blockDir = dir; w.blockT = 0; } }
    else { u = clamp(w.u + kept, uLo, uHi); if (out > 0) { w.off += out; stand = base + w.off; } }
  }
  const uWas = w.u; w.u = u;
  // onto the plane at that station, then his own collision and the guards have their say. Taking hold, he is eased in over WALL_SETTLE (smoothstep, ease in
  // and out) — from where he actually IS each frame, by the share of the remaining way the curve covers this frame, and never by more than the curve's own
  // stride from where Q found him: over open floor that is the same glide to the millimetre, but a carton stack, a chair, a leaf or a man standing between him
  // and the face (none of which the face trace can see; the props and the leaves have their say on him after this, game.ts updateProps / updateDoors) now
  // holds him where they meet, pressed on gently, instead of the ease writing him a stride deeper into the thing every frame regardless — which fired a carton
  // along the wall at metres a second and, the frame it was out of the way, spent the whole saved-up difference at once: 0.4 m in a frame (the soak's
  // 'popped', seed 3 @ 362 s). Still held off the plane when the ease is done, `take` reads it like any shove: let go past WALL_SHOVE_OFF, else `off` eases him in.
  const lo = WALLSNAP.on ? stackLean(g, dt, cam, w, dir) : 0;   // (stepped out round the end on the stack: metres past his station)
  const tx = t[0] * (u + lo) + n[0] * stand, tz = t[2] * (u + lo) + n[2] * stand;
  if (ePrev < 1) {
    // (WALLSNAP.slow: a key held along the wall moves the station under the take. The body rides it — the glide then closes on a place that holds still
    //  for it, instead of trailing a hand behind one that runs on and landing short of it, which the read-back below took for a man in his way)
    if (WALLSNAP.on && WALLSNAP.slow && u !== uWas) c.pos = [c.pos[0] + t[0] * (u - uWas), c.pos[1], c.pos[2] + t[2] * (u - uWas)];
    const e0 = ease(w.settle);
    const k = e0 < 1 ? (e0 - ePrev) / (1 - ePrev) : 1;                             // the curve's share of what is LEFT this frame (all of it on the last)
    let sx = (tx - c.pos[0]) * k, sz = (tz - c.pos[2]) * k; const sl = Math.hypot(sx, sz);
    const cap = Math.hypot(tx - w.from[0], tz - w.from[2]) * (e0 - ePrev) + 0.02;   // the unobstructed stride this frame, and a hair
    if (sl > cap) { sx *= cap / sl; sz *= cap / sl; }
    c.pos = [c.pos[0] + sx, c.pos[1], c.pos[2] + sz];
  } else c.pos = [tx, c.pos[1], tz];
  collidePlayer(g, y1); keepOffGuards(g, dt, y1);
  if (lo !== 0 || w.leanOff) { const got = c.pos[0] * t[0] + c.pos[2] * t[2] - w.u; w.leanOff = lo > 0 ? clamp(got, 0, lo) : lo < 0 ? clamp(got, lo, 0) : 0; }   // (what of the step-out he actually got: the read-back below is of his station, not of where he leans)
  if (w.settle >= 1 && !take(true)) return false;
  c.vel = [t[0] * w.v, 0, t[2] * w.v]; pl.speedSm = Math.abs(w.v);
  // the ends, and peeking round an open one
  w.atEdge = w.u >= uHi - 0.005 && w.openHi ? 1 : w.u <= uLo + 0.005 && w.openLo ? -1 : 0;
  const pushingOn = w.atEdge !== 0 && dir === w.atEdge;
  if (pushingOn) w.peekDir = w.atEdge as -1 | 1;
  w.peek = clamp(w.peek + (pushingOn ? 1 : -1) * dt / WALL_PEEK_SECS, 0, 1);
  const e = w.peek * w.peek * (3 - 2 * w.peek);
  cam.peekOffset = e > 0 ? [(t[0] * w.peekDir * (BODY_R + 0.6) + n[0] * 0.3) * e, 0, (t[2] * w.peekDir * (BODY_R + 0.6) + n[2] * 0.3) * e] : null;   // look-at out past the corner and a little off the wall
  c.anim.lookYawExtra = -w.peekDir * WALL_PEEK_LOOK * e;   // (+ = to his left; peekDir + = the end on his right)
  if (WALLSNAP.on) wallSnapCam(cam, w);
  return true;
}

/** Silent takedown (a left click with the hands empty on the man in reach behind — game.ts updateDoors; the tour and the harness call it too): lock in behind the
 *  guard, throw the cross, he drops with a soft thud only the room hears. */
export function startTakedown(g: Game, gd: Guard, way?: CloseKind, lethal = false, loud = false) {
  const pl = g.player; if (gd.state === 'dead' || pl.down) return;   // (F + fire in the same frame: the round got there first)
  // closer than ever (close.ts): the way in the row offered — from a side or the front he strikes from where he stands, a seated man is put out in his chair
  const kind: CloseKind | undefined = closeLive(g) ? way ?? closeKindOf(closeAt(g, gd, pl.char.pos)) : undefined;
  const from = kind && kind !== 'behind' ? wrapAngle(Math.atan2(pl.char.pos[0] - gd.char.pos[0], pl.char.pos[2] - gd.char.pos[2]) - gd.char.bodyYaw) : 0;
  if (pl.wall) pl.wall.drawn = false;   // offered from the wall: he steps off it into the lunge with the empty hands he had on it — and keeps them empty after, as every takedown leaves him
  releaseWall(g);
  if (pl.dragging) g.toggleDrag();
  pl.takedown = kind && kind !== 'behind' ? { g: gd, t: 0, kind, from, alert: gd.state === 'alert', at: closeStation(gd, kind, from).pos } : { g: gd, t: 0 }; pl.sprinting = false;
  if (loud) pl.takedown.loud = true;   // (close.ts CLOSE.rmbHold: the quick knockout is heard further)
  if (lethal) { pl.takedown.lethal = true; pl.char.anim.strike(kind === 'front' ? 'jab' : 'cross', true); } else pl.char.anim.strike(kind === 'front' ? 'jab' : 'cross'); takeBegin(g, pl.char, gd, kind, lethal); cancelReloads(pl);   // (lethal: the knife comes out of its sheath in the blow — close.ts CLOSE.lethal, the left click)
  if (kind) closeTook(g, gd, 'take', kind, from, Math.hypot(pl.char.pos[0] - gd.char.pos[0], pl.char.pos[2] - gd.char.pos[2]));
  if (THROWBACK.on) throwOff(pl);   // (throwback.ts: the can it counted off the belt at the click is not lost with the wind-up)
  pl.throwHeld = false; pl.throwPreview = null; pl.pendingThrow = null;   // a wind-up does not survive the lunge
  gd.speed = 0; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.reactT = Math.max(gd.reactT, 1.0);   // he freezes for the beat it takes
  g.audio.play('bodyHit', v3.add(gd.char.pos, [0, 1.3, 0]), loud ? 0.8 : 0.55, { rate: 0.8 });
}

export function updateTakedown(g: Game, dt: number) {
  const pl = g.player; const td = pl.takedown; if (!td) return;
  const gd = td.g; const c = pl.char;
  if (!g.onFloor(gd)) { pl.takedown = null; return; }   // the shift was reset under the lunge (P for the tour, the panel): nobody there to finish on — and never a corpse, a thud and a dropped torch out of a man who no longer exists
  // hold station 0.55 m behind him, facing his back (until he drops: his pos then rides the falling pelvis, and you stand where you struck) — the statics still apply: squeezed behind a man near a wall you strike from as close as the wall allows
  let yaw = gd.char.bodyYaw; c.vel = [0, 0, 0];
  if (td.kind) {   // (close.ts) from a side, the front, or over a chair: his station is on his own bearing off the man, facing him — and the man goes down away from the blow
    // (the spot is fixed in the WORLD at the click: a man who turns toward the blow does not drag Sam round him)
    const at = td.at ?? closeStation(gd, td.kind, td.from ?? 0).pos;
    if (gd.state !== 'dead') { c.pos = v3.lerp(c.pos, at, 1 - Math.exp(-14 * dt)); collidePlayer(g, pl.crouch ? 1.0 : 1.7); td.yaw = Math.atan2(gd.char.pos[0] - c.pos[0], gd.char.pos[2] - c.pos[2]); }
    yaw = td.yaw ?? c.bodyYaw;
  } else if (gd.state !== 'dead') { const want: Vec3 = [gd.char.pos[0] - Math.sin(yaw) * 0.55, 0, gd.char.pos[2] - Math.cos(yaw) * 0.55]; c.pos = v3.lerp(c.pos, want, 1 - Math.exp(-14 * dt)); collidePlayer(g, pl.crouch ? 1.0 : 1.7); }
  c.bodyYaw = approachAngle(c.bodyYaw, yaw, 14 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0.1, 8, dt);
  td.t += dt;
  if (td.t >= 0.28 && gd.state !== 'dead') {                    // the cross lands
    const level = (td.kind ? closeNoise(td.kind, !!td.alert) : closeLive(g) ? closeNoise('behind', gd.state === 'alert') : 0.3) + (td.loud ? CLOSE.rmbLoud : 0);   // (from behind with the windows on: the table's own number, and his shout if he was onto Sam)
    if (td.kind && closeSeated(g, gd)) closeUnseat(g, gd);
    takeFall(g, gd, td.kind, !!td.lethal);   // (takedown.ts: how he goes down, by the blow)
    if (td.lethal) {
      killGuard(g, gd, [Math.sin(yaw), 0, Math.cos(yaw)], true, 'shot', 'player', 'knife — dead');
      for (const o of g.guards) { const W = o.witness.sawAct; if (W && W.kind === 'shot' && W.t === g.time && W.victim === gd.callsign) W.kind = 'struck'; }   // (a man who watched it saw him DROPPED, not shot: 'shot' is the model's word for dead, and the questions asked of a witness to a shooting — the noise, the gun — are not this one's)
    } else killGuard(g, gd, [Math.sin(yaw), 0, Math.cos(yaw)], true);   // (the knife kills: a kill on the card; the other hand leaves him out cold, as the takedown always did)
    if (CLOSE.on) closeBlow(!!td.lethal);
    g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level, who: PLAYER_ID });   // the fall: a thud the room hears, not the floor (from the front he gets a sound out with it: close.ts noise)
    pl.noise = Math.max(pl.noise, level);
  }
  if (td.t > 0.62) pl.takedown = null;                        // control back as the cross recovers
}

// ------------------------------------------------------------ grab → hold → interrogate → choke out / pistol-whip
/** Which hold a grab made now would be to begin with: the Five-seveN drawn in the hand → it goes to his head ('gun'); holstered, or a canister up → both hands on
 *  him ('arm'). The guard's row says which before you commit (buildInteractables); E changes it once he is held (swapHold) — and keeps this true of the hands
 *  throughout, so it also names the hold Sam is in. */
export function grabVariant(g: Game): HoldVariant { return g.player.pistolUp ? 'gun' : 'arm'; }
/** The 'grab him' row on a living guard from behind (game.ts updateDoors — the takedown's own gate: in reach, in his rear half-space, not alert, nothing solid
 *  between): drop whatever the hands had, and he is frozen where he stands for the beat it takes to get the arm round him (updateHold's 'grab' phase does the
 *  closing in). From here he is `held`: off the AI, off any choreography or body script (a pair clearing rooms loses him — his partner comes off it toward
 *  the spot), off the net, silent but for his answers; a patrolling man's torch is knocked out of his hand and dies on the floor. Which hold it is to begin with
 *  (grabVariant) is decided here; E swaps it later (swapHold). Refused for a man onto you, with your hands already full, or crouched where he cannot stand up
 *  into it (a counter top over his head: the hold stands the pair up and collides them at full height). */
export function startGrab(g: Game, gd: Guard, way?: CloseKind) {
  const pl = g.player, c = pl.char;
  // closer than ever (close.ts): the way in the row offered (behind him, or behind his chair), for the tallies
  const kind: CloseKind | undefined = closeLive(g) ? way ?? closeKindOf(closeAt(g, gd, c.pos)) : undefined;
  const b0 = kind ? wrapAngle(Math.atan2(c.pos[0] - gd.char.pos[0], c.pos[2] - gd.char.pos[2]) - gd.char.bodyYaw) : 0, r0 = Math.hypot(c.pos[0] - gd.char.pos[0], c.pos[2] - gd.char.pos[2]);
  if (gd.state === 'dead' || gd.state === 'alert' || gd.held || pl.down || pl.holding || pl.takedown || pl.kick || pl.picking || pl.wanding) return;
  if (pl.crouch && !canStand(g)) { g.msg('no room to stand up behind him here'); return; }
  if (pl.rifleUp) setHolstered(g, true, true);   // the rifle in his hands goes to the sling as the arm goes round the man (Chaos Theory slings it: both hands are for him — the arm variant, the knife in the fist); it stays there when the hold is over
  const variant = grabVariant(g);
  if (pl.wall) pl.wall.drawn = false;   // (grabbed from the wall: with the empty hands he had on it — the arm variant, above — and they stay empty when it is over)
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  pl.sprinting = false; pl.crouch = false; pl.speedSm = 0; c.vel = [0, 0, 0]; pl.backpedal = false; c.anim.reverse = false;   // you rise into it
  cancelReloads(pl);
  throwOff(pl);   // a wind-up does not survive it (the can goes back on the belt)
  pl.throwHeld = false; pl.throwPreview = null; pl.easing = null;
  // him
  if (gd.bubble && g.time - gd.bubble.t < gd.bubble.dur) { if (g.time - gd.bubble.t < 0.8) g.msg((WORDS.on && gd.unit ? `${gd.callsign}: ` : 'guard: ') + gd.bubble.text); gd.bubble = null; }   // whatever he was saying is cut off (logged if he had barely begun it, as killGuard does)
  const C = g.clearing;
  if (C && C.stage !== 'done' && (C.a === gd || C.b === gd)) {   // one of the pair clearing rooms: the clear is over — his partner comes off the drill toward where he was, on edge (what he then sees is his own senses' business)
    const other = C.a === gd ? C.b : C.a;
    C.cancel(); g.clearing = null;
    if (other && other.state !== 'dead' && !other.held) { other.state = 'suspicious'; other.awareness = Math.max(other.awareness, 0.6); other.lastKnown = v3.copy(gd.char.pos); other.reactT = 0.7; other.searchT = 0; other.path = []; other.pathGoal = null; other.searchPlan = null; other.pieing = null; }   // (a search plan and a half-pied doorway live inside search / alert — guards.ts drops them itself next frame, but he is 'suspicious' from THIS one: the grab lands after the guards' update)
  }
  if (gd.script) endGuardScript(gd, gd.state === 'patrol' ? 'patrol' : gd.state === 'search' ? 'search' : 'suspicious');   // (any other choreography: unhooked where he stands, keeping the state he had)
  gd.speed = 0; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.bodyDuty = null; gd.pieing = null; gd.searchPlan = null; gd.muzzleDown = false; gd.stallRef = null;
  gd.char.anim.lookYawExtra = 0; gd.sweep = 0;
  gd.lightLitAtLoss = gd.flashlight.enabled;   // (the grab: was the torch burning as it left his hand — attachFlashlight's floor sputter shows only what was lit)
  if (inHand(gd) === 'torch') { gd.dropped = dropFromHand(g, gd.char, 'torch', gd.beamDir, [0, 0, 0], false, true); gd.torchLostAt = g.time; }   // the torch is knocked out of his hand as the arm goes round: it clatters down quietly and dies on the floor like a dropped torch does (guards.ts) — his hands come up empty
  else if (HOLD.dropGun && !HOLD.disarm && inHand(gd) === 'weapon') { gd.dropped = dropFromHand(g, gd.char, gd.weapon.def.drop, gd.char.gunDir, [0, 0, 0], gd.weapon.def.suppressed, true); gd.gunLostAt = g.time; }   // (HOLD.dropGun) …and so is the gun, if that is what the hand had: it lies where it fell like any dropped gun, and he is held with empty hands
  if (kind && !gd.civ && closeSeated(g, gd)) closeUnseat(g, gd);   // (hauled out of the chair: the sitting clip comes off as the arm goes round)
  gd.held = { by: 'player', since: g.time, variant, phase: 'grab', reverse: false };
  if (gd.civ) civilianGrabbed(g, gd);   // (a civilian: whatever she was doing stops, and she cannot scream with a forearm across her throat — civilians.ts)
  if (g.aiEnabled) gd.witness.wasHeld++; gd.talk.heldSince = g.time;   // his own record of it (the dialogue reads both: how long he has been held, whether this is the second time) — nothing is remembered with the AI off, like every other witness write
  pl.holding = { g: gd, variant, phase: 'grab', t: 0, since: g.time, windT: -1, swapT: Infinity, remarked: false, gunOut: 0, fireQueued: false, shotT: -1, ask: null, after: null };
  disarmBegin(g);   // (disarm.ts, HOLD.disarm: the gun he still has in his hand is Sam's right hand's to take, a beat from now — nothing with the switch off)
  if (kind) closeTook(g, gd, 'grab', kind, b0, r0);
  pl.fireCd = Math.max(pl.fireCd, HOLD.secs.grab);   // (no round leaves the gun on its way round him)
  disarmCatch(g, v3.add(gd.char.pos, [0, 1.4, 0]));   // the arm going round him: sleeve over his shoulder, chest into his back, the breath he snatches choked off
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: GRAB_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, GRAB_NOISE); chronGrab(g, gd);   // a scuffle the room hears inside a few metres, not the floor
}

/** N: the goggles' switch, and the tube's picture easing after them. kitanim.ts: with its part on they go down / up by hand, or by a nod with the hands busy,
 *  and the picture follows them to his eyes; off, the picture follows the switch as ever. `input` null = no key is read this frame, the ease alone. */
function nvKey(g: Game, input: Input | null, dt: number) {
  const pl = g.player;
  if (pl.nv && !kitYouNvg(pl)) pl.nv = false;   // (kittree.ts: no goggles on your card — whatever switched them on, a save read back included, there is nothing to look through)
  if (!kitYouLight(pl) && (pl.rifle.lightOn || pl.pistol.lightOn)) { pl.rifle.lightOn = false; pl.pistol.lightOn = false; }   // (… and no light fitted)
  if (input?.hit('KeyN') && kitYouNvg(pl)) { pl.nv = !pl.nv; g.audio.play(pl.nv ? 'nvOn' : 'nvOff', null, 0.7); g.msg(pl.nv ? 'night vision on' : 'night vision off'); kitNv(g); }
  const eye = kitNvEye(g); pl.nvAmount = damp(pl.nvAmount, eye ? 1 : 0, eye ? 5 : 9, dt);
}

/** One frame with a man in his arm (updatePlayer runs this in place of everything else while Player.holding is set): the beat's clock and its inputs — E (held,
 *  and not inside the last one's HOLD.secs.swap: swapHold — he draws the pistol to the man's head / holsters it for the knife, the other variant from here);
 *  his ROWS, performed through Game.act (interact.ts: a Space tap does the highlighted one, Space held opens the list to choose) — ARM: 'question him' = an
 *  exchange: Sam's line over Sam, then the man's answer through Game.interrogate when it ends — askHeld / answerHeld; while Sam speaks it does nothing, inside
 *  the first INTERROGATE_GAP of the answer it only cuts the line short, after that it cuts in with the next; and 'choke him out' = chosen, the arm closes
 *  HOLD.secs.chokeHold later (windT, the commit beat) and he is out at HOLD.secs.choke unless a tap / a step / Esc stops it first (interact.ts cancelSustained
 *  → easeOffHold: he breathes again); GUN: the one row is the pistol-whip, the same shape (cocked at chokeHold, lands at HOLD.secs.whip, checked sooner) — no
 *  questions over a gun; in the gun variant a click fires one round past him at what the reticle has (HOLD_FIRE_CD apart, HOLD_SPREAD wide, never into
 *  him), right click the OCP, and L works the rail light; and for HOLD.secs.swap after an E none of the rows start (the hand is between tools: a choke chosen
 *  under it waits for the hand) — then the pair's movement (camera-relative WASD at HOLD_PACE × the wheel's pace, slower backing up, no sprint / crouch / wall
 *  / kit, feet still while the selector is open; the pair turns toward the cursor at HOLD_TURN; with CLOSE.heldClicks the ARM hold has the two buttons too —
 *  the left click the knife: phase 'kill', a commit nothing eases off, he is dead at its clock (killOut) — the right click the choke, begun as its row begins it), Sam's own collision and the other guards' solidity, the man
 *  placed rigidly HOLD.dist ahead on Sam's facing with the walls winning (placeHeld), and both animators told the phase. Anything that takes the man away from
 *  under the arm (a reset, a round in him from somebody, the tour) just ends it. */
export function updateHold(g: Game, dt: number, input: Input, cam: FollowCamera) {
  const pl = g.player, c = pl.char, H = pl.holding!, gd = H.g, hc = gd.char; let gun = H.variant === 'gun';
  if (gun && input.hit('KeyL') && kitYouLight(pl)) { pl.pistol.lightOn = !pl.pistol.lightOn; g.audio.play('click', c.muzzle, 0.6); }                                       // (the light's switch is under the thumb of the hand the gun is in)
  nvKey(g, input, dt);   // (with a man in his arm the goggles are a flick of the head — kitanim.ts plays the nod)
  if (!g.onFloor(gd) || gd.state === 'dead' || gd.held?.by !== 'player') { dropHold(g); c.update(dt); return; }   // reset from under the arm (P, the panel), or put down in it by somebody's round: nothing left to hold
  H.t += dt; H.swapT += dt; pl.fireCd -= dt;
  const K = HOLD.secs;
  let speed = 0, own = -1, stepU = -1;   // (own: Sam's legs alone, where they differ from the pair's — the stalk's step in; stepU: how far through it)
  if (H.phase === 'grab') {
    // easing in to HOLD.dist behind him on HIS facing (he has not been turned yet), squaring up to his back — through Sam's own collision: squeezed behind a man by a
    // wall, the arm goes round him from as close as the wall allows and the hold proper settles the rest
    const yaw = hc.bodyYaw; const want: Vec3 = [hc.pos[0] - Math.sin(yaw) * HOLD.dist, 0, hc.pos[2] - Math.cos(yaw) * HOLD.dist];
    if (H.from && STALK.catchSecs > 0) {   // (stalk.ts: the step in — his legs take it, at no more than a walk's stride — and then the yank)
      // (a longer way in — off a wall, the wait at a corner — takes a little longer, never so long that the haul back has no time left)
      if (H.stepM === undefined) { H.stepM = Math.hypot(want[0] - H.from[0], want[2] - H.from[2]); H.yaw0 = c.bodyYaw; }
      const T = Math.min(STALK.catchSecs * clamp(H.stepM / Math.max(0.1, STALK.catchM), 1, STALK.catchLong), K.grab - 0.08), u = clamp(H.t / T, 0, 1), was = c.pos; let to = want; stepU = u;
      if (u >= 1 && STALK.yank > 0 && !gd.civ) {   // landed: the man comes back with him, as far as there is room behind the pair
        if (H.hitAt === undefined) { H.hitAt = g.time; const hit = g.col.raycast([want[0], 1.0, want[2]], [-Math.sin(yaw), 0, -Math.cos(yaw)], STALK.yank + STALK.yankRoom); H.yankM = hit ? Math.max(0, hit.t - STALK.yankRoom) : STALK.yank; H.yanked = 0; }
        const v = clamp((H.t - T) / Math.max(0.05, K.grab - T), 0, 1), y = H.yankM! * (1 - (1 - v) * (1 - v)), d = y - H.yanked!;
        if (d > 0) { hc.pos = [hc.pos[0] - Math.sin(yaw) * d, hc.pos[1], hc.pos[2] - Math.cos(yaw) * d]; H.yanked = y; to = [want[0] - Math.sin(yaw) * d, 0, want[2] - Math.cos(yaw) * d];
          if (STALK.yankWith) c.pos = [c.pos[0] - Math.sin(yaw) * d, c.pos[1], c.pos[2] - Math.cos(yaw) * d]; }   // (he goes back WITH the man, by the man's own step: chasing him at 14 /s the man came 11 cm into Sam's chest and Sam jumped 7 cm clear of him on the hold's first frame)
      } else if (u >= 1 && H.hitAt === undefined) H.hitAt = g.time;
      // (by the step's own delta from where the collision last left him, never the straight line's point: behind a man with his back near a wall that
      //  point is in the wall, and a push-out from past its middle comes out the far side)
      const e = stepEase(u), e0 = H.stepE ?? 0, d0 = v3.sub(v3.lerp(H.from, to, e), v3.lerp(H.from, to, e0)); H.stepE = e;
      c.pos = u >= 1 ? v3.lerp(c.pos, to, 1 - Math.exp(-14 * dt)) : [c.pos[0] + d0[0], c.pos[1], c.pos[2] + d0[2]];
      own = STALK.yankWith && u >= 1 ? 0 : Math.min(STALK.catchStride, Math.hypot(c.pos[0] - was[0], c.pos[2] - was[2]) / Math.max(dt, 1e-4)); c.vel = [0, 0, 0]; collidePlayer(g, 1.7); }   // (landed, his feet are planted: fed the yank's speed the legs snapped from the stance into a walk's mid stride on its first frame — a foot 19 cm up in one tick — and back on the hold's)
    else { c.vel = [0, 0, 0]; c.pos = v3.lerp(c.pos, want, 1 - Math.exp(-14 * dt)); collidePlayer(g, 1.7); }
    // (the stalk's step in: he comes round to the man's back THROUGH the step, not in its first four frames — off a wall that was a quarter turn on the spot)
    if (STALK.turnIn && stepU >= 0 && stepU < 1 && H.yaw0 !== undefined) { const e = clamp(stepU / 0.85, 0, 1); c.bodyYaw = H.yaw0 + wrapAngle(yaw - H.yaw0) * e * e * (3 - 2 * e); } else c.bodyYaw = approachAngle(c.bodyYaw, yaw, 14 * dt);
    c.aimYaw = approachAngle(c.aimYaw, c.bodyYaw, 12 * dt); c.aimPitch = damp(c.aimPitch, 0, 8, dt);   // (the chest untwists over the reach, not in a frame)
    gd.speed = 0; hc.vel = [0, 0, 0];
    if (H.rmbChoke && !input.rmb()) H.rmbChoke = undefined;   // (CLOSE.rmbHold: the button let go while the grab was still landing — a plain hold, with its words; the arm never closes)
    if (H.t >= K.grab) {
      setPhase(g, 'held'); H.since = g.time; if (gd.held) gd.held.since = g.time; gd.talk.heldSince = g.time; c.bodyYaw = c.aimYaw = hc.bodyYaw;   // (the dialogue's held clock and the hold's are one)
      g.audio.play('heldProtest', v3.add(hc.pos, [0, 1.5, 0]), 0.18);   // his first sound in the arm, muffled under it (the buffer carries its own 0.3 s: it lands as the hold settles)
      if (gd.civ) g.msg(gun ? `got ${gd.callsign}, the ${gd.civ.label}. press Space to tell ${gd.civ.her} to stay down and quiet (lets ${gd.civ.her} go) · hold Space for the pistol-whip · press E to holster and question ${gd.civ.her}` : `got ${gd.callsign}, the ${gd.civ.label}. press Space to ask what ${gd.civ.she} knows · hold Space for 'stay down, stay quiet' or the choke · knocking out a civilian will cost you`);
      else if (!H.rmbChoke) g.msg(gun ? `got ${gd.callsign} with the pistol at his head. click to fire past him, press Space to pistol-whip him, or E to holster it and question him` : `got ${gd.callsign}. press Space to make him talk, hold Space for the choke, or press ${HANDSLOT.on ? '1' : 'E'} to put the gun to his head`);
    }
  } else {
    // ---- E: the other hold — draw the pistol to his head / holster it and the knife is back (held only, and not while the hand is still between tools from the last)
    if (H.phase === 'held' && H.swapT >= K.swap && (input.hit('KeyE') || (HANDSLOT.on && input.hit(gun ? HANDSLOT_KEY : 'Digit1'))) && !pl.choosing && pl.sel.downT < 0) { swapHold(g); gun = H.variant === 'gun'; }   // (not while the Space list is open or a press is down: the swap re-opened the list on the gun's rows and the SAME release then chose the pistol-whip — review 08-10 #16)
    const swapping = H.swapT < K.swap;   // the draw / the holstering under way: none of the rows may start (no round, no question; a choke / whip chosen now waits for the hand)
    // ---- his rows, performed this frame (interact.ts → Game.act): the question (arm), the choke (arm) / the whip (gun) — chosen, then run on their own clock.
    //      (No letting him go: once the arm is on, it ends with him on the floor. The tour taps these rows like a player.)
    const act = g.act?.kind === 'held' ? g.act.verb : null;
    // ---- the two buttons with him in the arm (close.ts CLOSE.heldClicks; the knife's hold only, never a civilian, never under a show, not while the hand is between
    //      tools or a choke is already chosen): the LEFT click is the knife — committed from this frame — the RIGHT click the choke, chosen as its row chooses it
    //      (a click an order menu was up for is gone from the frame before this: Game.step runs orders.input first, and it takes the right click's bit out always and the left click's with a man in the arm — the click that shuts the menu is never the knife)
    const clk = CLOSE.heldClicks && H.phase === 'held' && !gun && !swapping && H.windT < 0 && !gd.civ && !g.touring ? (input.lmbHit() && !closeBare(g) ? (input.rmbHit() ? null : 'kill') : input.rmbHit() ? 'choke' : null) : null;   // (both buttons in one frame choose nothing: the knife cannot be taken back)
    if (clk === 'kill') startKill(g);
    if (H.phase === 'held') {
      if (act === 'comply' && gd.civ && !swapping) { if (civilianComply(g)) { holdTail(g, dt, 0); return; } }   // 'stay down, stay quiet': a civilian let go into a crouch where she stands, told (civilians.ts) — the one way out of the arm on your feet by his choice, and hers alone
      if (act === 'question' && !swapping) { if (gun) g.msg(`press E to holster the gun first, then Space to question ${gd.callsign}`); else askHeld(g); }
      if (clk === 'choke' && CLOSE.rmbHold) { H.rmbChoke = 1; H.rmbT = 0; }   // (close.ts CLOSE.rmbHold: in the arm too the right button kept down is the choke for as long as it is down, and a tap of it the whole choke — below)
      if (!swapping && ((act === 'choke' && !gun) || (act === 'whip' && gun) || (clk === 'choke' && !CLOSE.rmbHold))) H.windT = 0;   // chosen: the arm closes / the pistol comes off his head HOLD.secs.chokeHold from now — the commit beat the held key used to be (the rows are a status line under a swap: nothing is chosen while the hand is between tools)
      if (H.windT >= 0 && !swapping) { H.windT += Math.min(dt, 0.05); if (H.windT >= K.chokeHold) { H.windT = -1; if (gun) startWhip(g); else startChoke(g); } }   // (a frame hitch must not swallow the beat)
    }
    if (H.rmbChoke) {   // (close.ts CLOSE.rmbHold: the right button on a man in the arm — taken by it held down, or pressed here. The arm closes the frame it can, with no commit beat: the button is the commitment)
      H.rmbT = (H.rmbT ?? 0) + dt;
      if (H.rmbChoke === 1) {
        if (H.phase === 'held' && !gun && !swapping && !gd.civ && !g.touring) { H.windT = -1; startChoke(g); H.rmbChoke = (H.phase as HoldPhase) === 'choke' ? 2 : undefined; }
        else if (!input.rmb()) H.rmbChoke = undefined;   // (let go before the hold had him: he is held, and that is all)
      } else if (H.phase !== 'choke') H.rmbChoke = undefined;   // (stopped by a step, a tap or Esc: it is a hold now, and the button still down does not start it again)
      if (H.rmbChoke === 2 && !input.rmb()) { if (H.rmbT > CLOSE.rmbTapSecs + 1e-6) easeOffHold(g); H.rmbChoke = undefined; }   // (let go: he breathes — unless it was a tap in the arm, which is the whole choke as the click always was)
    }
    if (H.ask && H.phase === 'held' && g.time + 1e-6 >= H.ask.t + H.ask.dur) { H.ask = null; answerHeld(g); }   // Sam's line has hung its beat: the man answers it (after the row's inputs, so a tap this frame saw Sam still speaking and did nothing)
    if (H.after && H.phase === 'held' && !H.ask && !heldTalk(g, H).speaking) sayAfter(g);                        // a remark that waited for the man to finish (his key pocketed, takeKey): the answer is down and no question is going up — now
    if (H.phase === 'choke' && H.t < K.choke - 0.3 && Math.floor(H.t / CHOKE_GRAIN) > Math.floor((H.t - dt) / CHOKE_GRAIN)) g.audio.play('chokeStrain', v3.add(hc.pos, [0, 1.5, 0]), 0.25);   // the strain of it while the arm is closed: a grain as it goes on (H.t 0) and every CHOKE_GRAIN after, the last one dying as he goes limp; eased off = no more of them, nothing to stop
    if (H.phase === 'choke' && H.t >= K.choke) { chokeOut(g); holdTail(g, dt, 0); return; }
    if (H.phase === 'whip' && H.t >= K.whip) { whipOut(g); holdTail(g, dt, 0); return; }
    if (holdKilling(H) && H.t >= killSecs()) { holdTail(g, dt, 0); killOut(g); c.anim.holdPose = null; return; }   // (the other way round from the choke's end: the clock's LAST frame of the knife is drawn on Sam — holdTail with the man still in his arm — and the hold lets go after it, so his slow way up off the man starts from the finished move on the next frame)
    // ---- the gun: a click queues one round, the pistol comes off his head (gunOut, a few frames) and it goes — at the fixture / man / point the reticle has, never
    //      the man in the arm; it stays presented while rounds keep coming and settles back on him a moment after the last
    if (gun && H.phase === 'held') {
      if (!swapping && input.lmbHit() && !H.fireQueued && pl.fireCd <= 0) {
        if (pl.pistol.canFire()) H.fireQueued = true;
        else { pl.fireCd = 0.25; g.audio.play('dryFire', c.muzzle, 0.7); g.msg('click — empty, and no hand free to reload'); }
      }
      if (!swapping && input.rmbHit() && (ocpable(g) || (!g.aimTarget && !g.aimGuard))) g.ocp(g.aimTarget);   // (the OCP is on the pistol too: right click zaps the light the reticle has, as it does with the gun out anywhere — and does nothing on a man with no light burning)
      const present = H.fireQueued || (H.shotT >= 0 && g.time - H.shotT < 0.9);
      H.gunOut = damp(H.gunOut, present ? 1 : 0, present ? 30 : 6, dt);
      if (H.fireQueued && H.gunOut > 0.8) {
        H.fireQueued = false;
        if (pl.pistol.fire()) {
          pl.fireCd = HOLD_FIRE_CD; pl.lastFireT = g.time; H.shotT = g.time;
          const ag = g.aimGuard && g.aimGuard !== gd && g.aimGuard.state !== 'dead' ? g.aimGuard : null;
          const tgt: Vec3 = g.aimTarget ? v3.copy(g.aimTarget.pos) : ag ? manAim(g, ag, 1.25) : freeAim(g, 0.6);   // (0.6: the pair only comes round to a cursor farther off than that — below)
          fireWeapon(g, c, tgt, true, { spread: HOLD_SPREAD + samSpread(g) + samAim(g) });   // (one-handed past the man's jaw — and wider again under fire, suppression.ts, and by the aim model's cone, aim.ts samAim: 0 with it off)
          if (pl.pistol.roundsReady === 0) g.msg('empty — and no hand free to reload');
        }
      }
    } else { H.fireQueued = false; H.gunOut = damp(H.gunOut, 0, 6, dt); }
    // ---- turning: the pair comes round toward the cursor, rate-limited; no chest twist of Sam's own (his arms are where the man is). The gun, when it comes off his
    //      head, is presented at the pitch of what the reticle has (the layer reads aimPitch as HoldPose.gunPitch); otherwise level.
    const ap = g.aimPoint; const tx = ap[0] - c.pos[0], tz = ap[2] - c.pos[2]; const ad = Math.hypot(tx, tz);
    const settle = STALK.yankWith && H.hitAt !== undefined ? smoothstep(0.3, 0.75, g.time - H.hitAt) : 1;   // (the stalk's catch settles before the pair comes round: the button was held ON the man, so the cursor is at Sam's own feet when the hold lands, and a hand's width of it either side swung the pair a quarter turn on the hold's first frames)
    if (ad > 0.6) c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(tx, tz), HOLD_TURN * settle * dt);
    c.aimYaw = c.bodyYaw;
    if (gun) { const ty = g.aimTarget ? clamp(g.aimTarget.pos[1], 0.3, 2.95) : g.aimGuard && g.aimGuard !== gd ? (g.aimGuard.wound && g.aimSnap ? g.aimSnap[1] : manAim(g, g.aimGuard, 1.2)[1]) : levelOn(g) ? c.pos[1] + 1.5 : ap[1] + 0.03; c.aimPitch = damp(c.aimPitch, clamp(Math.atan2(ty - (c.pos[1] + 1.5), Math.max(ad, 0.5)), -45 * DEG, 45 * DEG) * H.gunOut, 12, dt); }   // (nothing under the reticle: presented level — levelOn)
    else c.aimPitch = damp(c.aimPitch, -0.05, 8, dt);
    // ---- the pair's movement (rooted while the choke / the whip is on: you plant to finish it — a step then is what stops it, interact.ts; feet still while the selector is open)
    let mx = 0, mz = 0;
    if (H.phase === 'held') {
      const { fwd, right } = cam.planarBasis();
      if (!pl.listOpen) {
        if (input.down('KeyW')) { mx += fwd[0]; mz += fwd[2]; } if (input.down('KeyS')) { mx -= fwd[0]; mz -= fwd[2]; }
        if (input.down('KeyD')) { mx += right[0]; mz += right[2]; } if (input.down('KeyA')) { mx -= right[0]; mz -= right[2]; }
      }
      if (g.puppet) { mx = 0; mz = 0; const gl = g.puppet.goal; if (gl) { const dx = gl[0] - c.pos[0], dz = gl[2] - c.pos[2]; const dl = Math.hypot(dx, dz); if (dl > 0.1) { mx = dx / dl; mz = dz / dl; } } }
    }
    const ml = Math.hypot(mx, mz); if (ml > 0) { mx /= ml; mz /= ml; }
    const f = c.forward(); const back = ml > 0 && mx * f[0] + mz * f[2] < -0.3;   // into the rear half: hauling him backwards
    const maxSpeed = samLoadPace(g, ml === 0 ? 0 : (back ? HOLD_PACE_BACK : HOLD_PACE) * pl.pace * (g.puppet?.walk ?? 1));   // (kitload.ts: what his card weighs, as his walk)
    pl.speedSm = damp(pl.speedSm, maxSpeed, maxSpeed > pl.speedSm ? 6 : 12, dt);
    if (ml > 0) c.vel = [mx * pl.speedSm, 0, mz * pl.speedSm]; else c.vel = v3.scale(c.vel, Math.exp(-14 * dt));
    const bx = c.pos[0], bz = c.pos[2];
    c.pos = v3.mad(c.pos, c.vel, dt);
    collidePlayer(g, 1.7); keepOffGuards(g, dt, 1.7); keepHeldOffGuards(g, dt);
    placeHeld(g);
    speed = Math.min(Math.hypot(c.pos[0] - bx, c.pos[2] - bz) / Math.max(dt, 1e-4), Math.hypot(c.vel[0], c.vel[2]));   // the ground the pair actually covered (pressed to a wall ahead of the man, the legs stand rather than tread on the spot)
    pl.backpedal = speed > 0.2 && (c.vel[0] * f[0] + c.vel[2] * f[2]) / Math.max(1e-4, Math.hypot(c.vel[0], c.vel[2])) < -0.3; c.anim.reverse = pl.backpedal;
    hc.vel = v3.copy(c.vel); gd.speed = speed; hc.bodyYaw = c.bodyYaw;
    if (gd.held) gd.held.reverse = pl.backpedal;
  }
  pl.sprinting = false; pl.crouch = false;
  holdTail(g, dt, speed, own);
}
/** the end of a hold frame, Sam's side, shared with the frames that end the hold: both animators told the beat (the man's is baked later, in updateGuard's held
 *  branch; Sam's here), the rail light (arm variant: off — the pistol rides the thigh while both hands are on him, hideHeldItem; gun variant: lit if L has it on,
 *  posed off the gun hand up beside his head like any carry), Sam's step events at the pair's pace (his tread is what the room hears of the pair) */
function holdTail(g: Game, dt: number, speed: number, own = -1) {
  const pl = g.player, c = pl.char, H = pl.holding;
  c.anim.speed = own >= 0 ? own : speed; c.anim.crouchTarget = 0; c.anim.upper = 'none'; c.anim.stance = 'none'; c.anim.lookYawExtra = 0;
  const low = H ? takeLower(g) : 0;   // (the choke's lowering: both poses or neither)
  const kill = H ? takeKill(g) : false, beats = H ? takeBeats(g) : false, haul = H ? takeHaul(g) : false;   // (takedown.ts TAKEDOWN.kill / chokeBeats, fed with the pose as `low` is: the animator reads this frame's, not its module's one-frame-late fallback)
  const strip = H?.strip ? disarmPose(H.strip) : undefined;   // (disarm.ts: both poses or neither)
  const yank = H && H.hitAt !== undefined && g.time - H.hitAt < 1 ? g.time - H.hitAt : undefined;   // (character.ts HOLD.yank: both poses or neither)
  c.anim.holdPose = H ? { yank, step: H.from && H.phase === 'grab' ? H.t : undefined, phase: H.phase, t: H.t, variant: H.variant, gunOut: H.gunOut, gunPitch: c.aimPitch, low, kill, beats, haul, strip } : null;
  if (H && HOLD.catchShape && H.phase === 'grab' && c.anim.holdPose) c.anim.holdPose.man = [H.g.char.pos[0], H.g.char.pos[1], H.g.char.pos[2]];   // (HOLD.catch: the arm's keys ride the man — fed only with it up, so the pose is what it was with it down)
  if (H && STALK.yankWith && H.yanked !== undefined && c.anim.holdPose) c.anim.holdPose.pull = H.yanked;   // (HOLD.catch.samFeet: his feet step the haul he goes back with)
  if (H) {
    const gd = H.g, hc = gd.char, an = hc.anim;
    an.speed = speed; an.reverse = pl.backpedal; an.crouchTarget = 0; an.upper = 'none'; an.stance = 'none'; an.lookYawExtra = 0; an.deliberate = 0;
    an.heldPose = { yank, phase: H.phase, t: H.t, agitation: agitationOf(g, gd), variant: H.variant, bare: closeBare(g) || undefined, shot: H.shotT >= 0 ? g.time - H.shotT : -1, armed: inHand(gd) === 'weapon', low, kill, beats, haul, strip: strip ? { t: strip.t } : undefined };   // (armed: the pistol is in his hand — combat.ts handProps draws it for anyone not carrying the torch on a calm patrol — so the raised hand stays a fist round it)
    if (HOLD.catchShape && H.yanked !== undefined) an.heldPose.pull = H.yanked;   // (HOLD.catch.feet: fed only with it up)
    if (gd.held) gd.held.phase = H.phase;
    // where his torch points: nowhere useful — up over Sam's arm at the ceiling, wandering with the struggle (torchCarryDir reads his aim yaw / pitch; the pistol, if
    // that is what he has out, just rides the raised hand). The yaw share stays small and eased — it is also his chest's twist, and his neck must stay on the arm.
    const torch = handCarry(gd) === 'torch'; const tt = g.time - H.since;
    hc.aimYaw = approachAngle(hc.aimYaw, hc.bodyYaw + (torch ? 0.07 * Math.sin(tt * 0.9) + 0.04 * Math.sin(tt * 2.3 + 1) : 0), 4 * dt);
    hc.aimPitch = damp(hc.aimPitch, torch ? 0.55 + 0.25 * Math.sin(tt * 1.3 + 2) + 0.1 * Math.sin(tt * 3.1) : 0, 6, dt);
  }
  armRifle(g, false, null);   // (a hold is hands-on: the rifle went to the sling at the grab and E draws the PISTOL to his head, never the rifle)
  c.update(dt);
  poseGunLight(g);
  if (footfallDue(g, dt, c.anim.phase, speed)) {
    const loud = tread(g, c.pos, 0.26 * loadHeard(g, 'player'), true);   // (the dragging shuffle: retimed like the walk, and on the floor it is on like every step)
    g.events.push({ kind: 'step', pos: v3.copy(c.pos), time: g.time, loud: false, level: loud }); pl.noise = Math.max(pl.noise, loud);
  }
}
function setPhase(g: Game, phase: HoldPhase) {
  const pl = g.player, H = pl.holding; if (!H) return;
  H.phase = phase; H.t = 0; H.windT = -1; H.fireQueued = false; if (H.g.held) H.g.held.phase = phase;
  cancelAsk(g);   // the choke / the whip going in over Sam's own question
}
/** Stop the choke / the whip that is under way (interact.ts cancelSustained: a Space tap, a step or Esc while it runs — what letting go of the held key used to
 *  be): mid-choke he drags a breath and the hold goes on; mid-whip the pistol goes back to his head — either way he felt what nearly happened (talk.abortT:
 *  rattled for it, dialogue.ts agitationOf). A choke merely CHOSEN and not yet on (windT inside its commit beat) is simply un-chosen, nothing felt. */
export function easeOffHold(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  if (H.phase !== 'choke' && H.phase !== 'whip') { H.windT = -1; return; }
  const was = H.phase; setPhase(g, 'held'); gd.talk.abortT = g.time;
  g.msg(was === 'whip' ? `checked it — the pistol goes back to ${gd.callsign}'s head` : `eased off — ${gd.callsign} is still with you`); g.audio.play('propScrape', v3.add(gd.char.pos, [0, 1.4, 0]), 0.1, { rate: 2.2 });
}
/** Sam's unfinished question dies in his mouth: no answer is coming (nothing was asked of the engine — the man's stage stands, and the next tap puts it afresh)
 *  and the line is cut to a breath. The choke or the whip going in over it (setPhase), or the gun coming out over it (swapHold) — one rule. An answer the man has
 *  already begun is his: it runs on. A remark still waiting its turn (H.after) goes the same way: the moment for it has passed. */
function cancelAsk(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return;
  H.after = null;
  if (!H.ask) return;
  H.ask = null; if (pl.bubble) pl.bubble.dur = Math.min(pl.bubble.dur, g.time - pl.bubble.t + 0.2);
}
/** The waiting remark goes up over Sam (updateHold: the man's line is down, nothing of Sam's is going up): his beat of a bubble, the murmur of it by the man's ear,
 *  the log's 'you ▸' like his questions. Nobody answers it. */
function sayAfter(g: Game) {
  const pl = g.player, H = pl.holding; if (!H?.after) return;
  const a = H.after; H.after = null;
  pl.bubble = { text: a.text, t: g.time, dur: samBeat(a.text.length), radio: false };
  g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2); g.note(`you ▸ ${a.text}`);
}
/** E with the man already in the arm (updateHold: phase 'held', and not inside the last swap's HOLD.secs.swap): the OTHER hold from here — both records renamed
 *  (Hold / Guard.held: the dialogue's gun-to-his-head term reads his), the hands made to say so exactly as E does anywhere (Player.holstered / slot through
 *  setHolstered — kit line, rig, rail light and grabVariant all follow that), and HOLD.secs.swap of lockout begun (swapT) in which the row starts nothing while
 *  the animator hands the fist over behind the man's shoulder (character.ts holdLayer): the old tool leaves it on the key's frame, the other comes into it half way through, back there (holdGunSide).
 *  arm → gun: a question Sam had not finished dies unanswered (cancelAsk — the rule the choke uses), a click queued for nothing is dropped, and once a hold, if
 *  the man is not mid-answer, Sam marks it with one of his pistol lines (dialogue.ts samRemarkFor — a remark: nobody answers, no stage moves; the log gets it
 *  like his questions). gun → arm: holstered, the knife back at his throat, and his row takes questions again — the man's stage exactly where it was. */
function swapHold(g: Game) {
  const pl = g.player, H = pl.holding; if (!H || H.phase !== 'held') return; const gd = H.g;
  const to: HoldVariant = H.variant === 'gun' ? 'arm' : 'gun';
  H.variant = to; if (gd.held) gd.held.variant = to;
  H.swapT = 0; H.windT = -1; H.fireQueued = false; H.gunOut = 0;   // (a choke / whip chosen and not yet on is un-chosen: the other tool is coming into the hand)
  pl.fireCd = Math.max(pl.fireCd, HOLD.secs.swap);   // (belt and braces with the lockout: no round while the gun is still coming up)
  cancelAsk(g);
  if (to === 'gun') {
    pl.slot = 'pistol'; setHolstered(g, false, true);   // (a canister he grabbed with goes back on the belt, the rifle stays on his back: it is the pistol that comes out)
    if (!H.remarked && !heldTalk(g, H).speaking && !gd.civ) {   // (no pistol line for a terrified cleaner: the men's remarks are about the men)
      const line = samRemarkFor(g, gd);
      if (line) { H.remarked = true; pl.bubble = { text: line.text, t: g.time, dur: samBeat(line.text.length), radio: false }; g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2); g.note(`you ▸ ${line.text}`); }
    }
    g.msg(`the pistol is at ${gd.callsign}'s head. click to fire past him, press Space to pistol-whip him, or E to holster it and question him`);
  } else {
    setHolstered(g, true, true);
    g.msg(closeBare(g) ? `holstered, with both hands on ${gd.callsign} again. press Space to question him, or hold Space for the choke` : `holstered, with the knife back at ${gd.callsign}'s throat. press Space to question him, or hold Space for the choke`);
  }
  g.audio.play('equip', null, 0.45);
}
/** HOLD.secs.chokeHold after the choke was chosen in the arm variant: the elbow starts to close (updateHold finishes it at HOLD.secs.choke, or easeOffHold comes first) */
function startChoke(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const hc = H.g.char;
  setPhase(g, 'choke');
  g.audio.play('bodyHit', v3.add(hc.pos, [0, 1.4, 0]), 0.3, { rate: 0.55 });
  g.events.push({ kind: 'prop', pos: v3.copy(hc.pos), time: g.time, loud: false, level: CHOKE_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, CHOKE_NOISE);
}
/** HOLD.secs.chokeHold after the whip was chosen in the gun variant: the pistol comes off his head and cocks back (character.ts holdLayer 'whip'); nothing to hear
 *  yet — the crack is whipOut's, at HOLD.secs.whip, unless easeOffHold comes first */
function startWhip(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return;
  setPhase(g, 'whip'); H.gunOut = 0;
  g.audio.play('propScrape', v3.add(pl.char.pos, [0, 1.5, 0]), 0.12, { rate: 2.6 });   // the sleeve going back
}
/** the knife's clock in the hold (character.ts HOLD.secs.kill: the move is the takedowns' — holdLayer / heldLayer pose phase 'kill' off it) */
const killSecs = (): number => HOLD.secs.kill;
/** s into the knife's clock at which the blade is in: the hold broken from there on (Sam shot down, folded) leaves the man dead all the same — freeHeld */
const killCut = (): number => HOLD.kill.hit * killSecs();
/** the knife is going in on the man in his arm (interact.ts: a commit — it is the running verb and nothing in cancelSustained stops it) */
export function holdKilling(H: Hold): boolean { return H.phase === 'kill'; }
/** The left click with a man in the arm hold (updateHold, CLOSE.heldClicks): the knife at his throat is used. Committed from this frame — rooted, no row, no E,
 *  nothing eases it off — and he is dead when its clock runs out (killOut). What the room hears of it begins as the standing knife's does (startTakedown). */
function startKill(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const hc = H.g.char;
  setPhase(g, 'kill');
  g.audio.play('bodyHit', v3.add(hc.pos, [0, 1.3, 0]), 0.55, { rate: 0.8 });
}
/** The man rigid in front: HOLD.dist dead ahead of Sam on his facing — then pushed out of the statics and kept on the slab like anybody, and whatever the walls took
 *  off HIS station Sam gives up too (re-settled himself), a couple of rounds of it; so the pair stops at a wall ahead of the man, slides along one beside him, and
 *  in a squeeze he ends up where the walls let him, a hand off his station, never inside one. Other guards are kept off both circles before this (keepOffGuards /
 *  keepHeldOffGuards); door leaves push the pair through their own contacts (game.ts updateDoors — his carries a key). */
function placeHeld(g: Game) {
  const pl = g.player, c = pl.char, H = pl.holding; if (!H) return;
  const hc = H.g.char, hp = hc.pos, col = g.col, r = hc.radius;
  for (let k = 0; k < 3; k++) {
    const f = c.forward(); const wx = c.pos[0] + f[0] * HOLD.dist, wz = c.pos[2] + f[2] * HOLD.dist;
    hp[0] = wx; hp[1] = 0; hp[2] = wz;
    col.collideCircle(hp, r, 0.2, 1.5, 4); col.clampToWorld(hp, r);
    const dx = hp[0] - wx, dz = hp[2] - wz;
    if (dx * dx + dz * dz < 1e-8) break;
    c.pos[0] += dx; c.pos[2] += dz; collidePlayer(g, 1.7);
  }
}
/** living guards are as solid to the man in his arm as to Sam himself: one closer than KEEP_OFF to the held man's centre pushes the PAIR back (Sam moved, re-settled; placeHeld re-places the man) */
function keepHeldOffGuards(g: Game, dt: number) {
  const pl = g.player, c = pl.char, H = pl.holding; if (!H) return;
  const f = c.forward(); const hx = c.pos[0] + f[0] * HOLD.dist, hz = c.pos[2] + f[2] * HOLD.dist;
  for (const o of g.guards) {
    if (o === H.g || o.state === 'dead' || o.held) continue;
    const dx = hx - o.char.pos[0], dz = hz - o.char.pos[2]; const l = Math.hypot(dx, dz);
    if (l >= KEEP_OFF || l < 1e-4) continue;
    if (noShoveMan(g, o)) continue;   // (noshove.ts: a man of his own falling in does not move the pair either)
    const bx = c.pos[0], bz = c.pos[2];
    const push = Math.min(KEEP_OFF - l, 6 * dt); c.pos[0] += dx / l * push; c.pos[2] += dz / l * push;
    collidePlayer(g, 1.7); noShoveNote(g, c.pos[0] - bx, c.pos[2] - bz);
  }
}
/** Where the exchange with the man in his arm stands: `asking` — Sam's own line is up and the answer is on its way (H.ask: a tap does nothing); `samUp` — a line
 *  of Sam's is in the air, question or remark (his word on the key he pocketed, sayAfter; the one as he draws): he is never cut, so a tap does nothing either;
 *  `speaking` — the man's current bubble is his answer this hold (else null); `ready` — a tap now opens the NEXT exchange: not while asking or while Sam speaks,
 *  and only once INTERROGATE_GAP of that answer is out (a tap sooner just cuts the line short) or the answer is gone (cut short already: nothing of it left to
 *  keep — the row must not offer to cut a line nobody can see) — at once if he has said nothing this hold; `settled` — ready AND the answer down to its last
 *  ANSWER_TAIL or gone: nothing would be cut (the row's wording; the tour's beat waits for it). askHeld acts on it, the panel row words itself by it. */
export function heldTalk(g: Game, H: Hold): { asking: boolean; samUp: boolean; ready: boolean; settled: boolean; speaking: Guard['bubble'] } {
  const gd = H.g, T = gd.talk, b = gd.bubble, sb = g.player.bubble;
  const speaking = b && T.lastT >= 0 && Math.abs(b.t - T.lastT) < 1e-6 && g.time - b.t < b.dur ? b : null;
  const fresh = T.lastT < 0 || T.lastT < H.since - 1e-6;   // no answer yet THIS hold (a man grabbed again keeps his stage, not his pacing)
  const asking = !!H.ask; const samUp = asking || (!!sb && sb.t >= H.since - 1e-6 && g.time - sb.t < sb.dur - 1e-9);   // (a line of his from before this hold is not this hold's)
  const ready = !samUp && (fresh || !speaking || g.time + 1e-6 >= T.lastT + INTERROGATE_GAP);
  const settled = ready && (!speaking || g.time + 1e-6 >= speaking.t + speaking.dur - ANSWER_TAIL);
  return { asking, samUp, ready, settled, speaking };
}
/** A tap on his row — one EXCHANGE: Sam's line first (dialogue.ts samLineFor: worded for the exchange that is coming, the hold's variant, the floor and the man),
 *  up over Sam for its beat (samBeat) with the question murmured by the man's ear; the answer follows when it ends (updateHold → answerHeld). While Sam speaks a
 *  tap does nothing; inside the first INTERROGATE_GAP of an answer it only cuts the line short; after that it cuts in — what was left of the answer goes and the
 *  next question is put. Sam's words reach the log too ('you ▸ …', a note: quiet under the tour flag). Nothing on the man's side moves until he answers. */
function askHeld(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const { samUp, ready, speaking } = heldTalk(g, H);
  if (samUp) return;
  if (!ready) { if (speaking) speaking.dur = Math.min(speaking.dur, g.time - speaking.t + 0.3); return; }
  if (speaking) speaking.dur = Math.min(speaking.dur, g.time - speaking.t);   // cutting in: the rest of that answer goes as Sam's next line comes up (it ends this frame — the two are never up together)
  const line = gd.civ ? civilianSamLine(g, gd) : samLineFor(g, gd, H.variant);   // (a civilian gets his quiet, plain questions — civilians.ts)
  const dur = samBeat(line.text.length);
  pl.bubble = { text: line.text, t: g.time, dur, radio: false };
  H.ask = { t: g.time, dur }; H.after = null;   // (a remark that was still waiting for that answer to end has been beaten to the air by the next question: dropped)
  g.audio.play('murmur', v3.add(pl.char.pos, [0, 1.6, 0]), 0.2);   // the question under his breath by the man's ear (the answer's muffle comes with the answer: answerHeld)
  g.note(`you ▸ ${line.text}`);
}
/** Sam's line has hung its beat (updateHold): the man answers it — Game.interrogate exactly as it always ran (his stage, what he gives, his bubble with the
 *  interrogation's longer hold, or the log), and the muffled sound of it under the arm. */
function answerHeld(g: Game) {
  const H = g.player.holding; if (!H) return; const gd = H.g;
  const pick = g.interrogate(gd);
  if (pick) g.audio.play('heldProtest', v3.add(gd.char.pos, [0, 1.5, 0]), 0.16);   // (that buffer carries its own 0.3 s of lead: it lands under the bubble, not on its edge)
}
/** The man has just given the keyed door up — dialogue kind 'door', '…we all carry one, mine's on my belt' (game.ts interrogate calls this on that answer, held
 *  or the sandbox's bare exchange alike): Sam takes what is on his belt. Player.keys gains every key the man carried that Sam lacked and Guard.keys empties
 *  (the same man has nothing more to hand over; a second holder of a key already pocketed changes nothing — no sound, no word); for anything new: the small
 *  bright clack of the clip coming off his belt, one for the debrief (mission.ts tally, live runs only), a line in the log, the kit column's KEY tag from this
 *  frame (overlay.ts reads Player.keys) — and, with the man in his arm, Sam's word on it (dialogue.ts samKeyLineFor) queued to follow the man's line down
 *  (Hold.after → sayAfter: the two are never up together). From here his door contact and every lock test carry the key (game.ts updateDoors, Doors.lockedOut). */
export function takeKey(g: Game, gd: Guard, rnd: () => number = simRandom) {
  const pl = g.player, H = pl.holding;
  const fresh = [...gd.keys].filter(k => !pl.keys.has(k)); gd.keys.clear();
  if (!fresh.length) return;
  for (const k of fresh) pl.keys.add(k);
  g.audio.play('lockPick', v3.add(gd.char.pos, [0, 1.0, 0]), 0.45, { rate: 1.6 });   // the key ring unclipped at his hip: the pick's tick, pitched up — small, bright, close
  tally(g, 'keys'); chronKey(g, gd);   // one for the card's count, one for the timeline
  g.msg(`you took ${gd.callsign}'s key. keyed doors will open for you now`);
  if (H && H.g === gd) { const line = samKeyLineFor(g, gd, H.variant, rnd); if (line) H.after = line; }
}

/** After the door leaves have had their say (game.ts updateDoors, behind settlePlayer): whatever a leaf shoved the held man off his station by, the PAIR gives — Sam
 *  takes the same shove (settled against the statics) and the man goes back on station from there, both re-baked where they ended up. So a leaf at its stop, or a
 *  hinge post, is as solid to the two of them as a wall is (placeHeld), instead of prising him off the arm for a frame. Not during the reach. */
export function settleHeld(g: Game) {
  const pl = g.player, H = pl.holding; if (!H || H.phase === 'grab') return;
  const c = pl.char, hc = H.g.char, hp = hc.pos, f = c.forward();
  const dx = hp[0] - (c.pos[0] + f[0] * HOLD.dist), dz = hp[2] - (c.pos[2] + f[2] * HOLD.dist);
  if (dx * dx + dz * dz < 1e-6) return;
  c.pos[0] += dx; c.pos[2] += dz; collidePlayer(g, 1.7); placeHeld(g);
  hc.update(0); c.update(0);
}
/** The choke run through HOLD.secs.choke: he goes limp in the arm and folds forward at Sam's feet — killGuard's quiet path ('choked': out cold, breathing, a knockout on
 *  the card; the torch leaves his hand and dies), the ragdoll seeded from the slumped pose. The room hears him meet the floor. */
function chokeOut(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const f = pl.char.forward();
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  g.audio.play('chokeLimp', v3.add(gd.char.pos, [0, 1.4, 0]), 0.35);   // the last of his air and his jacket folding over the arm — the floor's thud is the ragdoll's own (Game.bodyThud)
  takeFall(g, gd, undefined, false, 'choke');
  killGuard(g, gd, f, true, 'choked', 'player');
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: FOLD_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, FOLD_NOISE);
  pl.holding = null;
}
/** The knife run through its clock (killSecs): he is dead in the arm and let fall at Sam's feet — killGuard as the standing knife calls it ('shot' is the model's
 *  word for dead: a kill on the card, 'knife — dead'; a man who watched saw him DROPPED, not shot), then the hold's end as the choke's is: the last of him over
 *  the arm, the fold the room hears. */
function killOut(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const f = pl.char.forward();
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  g.audio.play('chokeLimp', v3.add(gd.char.pos, [0, 1.4, 0]), 0.35);
  takeFall(g, gd, undefined, true, 'kill');   // (takedown.ts: the kill's own fall, or the old quiet one with TAKEDOWN.kill off)
  killGuard(g, gd, f, true, 'shot', 'player', 'knife — dead');
  for (const o of g.guards) { const W = o.witness.sawAct; if (W && W.kind === 'shot' && W.t === g.time && W.victim === gd.callsign) W.kind = 'struck'; }   // (startTakedown's own rewrite for the knife)
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: FOLD_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, FOLD_NOISE);
  pl.holding = null;
}
/** The whip run through HOLD.secs.whip in the gun variant: the pistol lands behind his right ear and he drops out of the arm — killGuard's quiet path like the cross
 *  ('struck': out cold, breathing, a knockout on the card; what he held is laid down), the ragdoll folding forward and to his left, the way the blow sent his head
 *  (character.ts heldLayer has already started it that way, so the body carries it). Quick, but the crack of it and the fall are the loudest thing a hold does. */
function whipOut(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return; const gd = H.g;
  const f = pl.char.forward(); const dir = v3.normalize([f[0] + f[2] * 0.45, 0, f[2] - f[0] * 0.45]);   // forward and to his left (left of forward = (f.z, 0, −f.x))
  const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]);
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  takeFall(g, gd, undefined, false, 'whip');
  killGuard(g, gd, dir, true, 'struck', 'player', 'pistol-whipped — out cold, and that was not quiet');
  g.audio.play('whipThud', head, 0.7);   // steel on bone: the thump of it going through his skull, the frame's click, his collar as the head goes over
  g.events.push({ kind: 'prop', pos: v3.copy(gd.char.pos), time: g.time, loud: false, level: WHIP_NOISE, who: PLAYER_ID }); pl.noise = Math.max(pl.noise, WHIP_NOISE);
  pl.holding = null; pl.fireCd = Math.max(pl.fireCd, 0.5);   // (the gun hand is busy following through)
}
/** He comes out of the arm his own man — and an instant witness: he knows exactly who had him and where. Off the hold (held, the animator's pose, the dialogue's
 *  clock), everything the AI reads for 'eyes on Sam right now' seeded (awareness full, the fix on Sam, a fresh real sighting), a stagger of `stagger` seconds
 *  (reactT) before he can act — updateGuard's own transition takes him to alert next frame with its bark and books what did it — and the jolt of it through his
 *  trunk. Back on the net too: nothing about him is missing any more. A man already down is only unhooked. */
function handBack(g: Game, gd: Guard, stagger: number) {
  gd.held = null; gd.char.anim.heldPose = null; gd.talk.heldSince = -1;
  gd.speed = 0; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.bodyDuty = null; gd.stallRef = null; gd.char.aimPitch = 0;
  if (gd.state === 'dead') return;
  if (gd.gunLostAt >= 0) {   // (HOLD.dropGun) loose and on his feet: the gun that was knocked out of his hand at the grab is the first thing he goes for — it is off the floor and in his fist again, at the price of a longer stagger
    gunBack(g, gd); stagger += HOLD.regrab;
  }
  const pp = g.player.char.pos;
  gd.awareness = 1; gd.lastKnown = v3.copy(pp); gd.lastSeenT = g.time; gd.sightPos = v3.copy(pp); gd.sightVel = [0, 0, 0]; gd.sightT = g.time; gd.ledT = g.time;   // (ledT: nothing to lead — he was not watching Sam walk out of sight, Sam had him by the throat)
  gd.reactT = Math.max(gd.reactT, stagger); gd.heardUpTo = g.eventSeq;   // (nothing stale in the queue is news to him)
  gd.missedAt = -1; gd.missingRaised = false;
  resetChase(gd); gd.searchT = 0;
  gd.char.anim.hit();
}
/** Let go at once — Sam shot down with him in the arm, a teleport / the tour taking the hands (cancelActions): the man is handed straight back (handBack), Sam's side
 *  cleared. The one way a held man comes free on his feet: there is no letting him go. (Shot down with the knife already in him — phase 'kill' past killCut — he
 *  does not come free: killOut.) */
export function freeHeld(g: Game, why: 'shot' | 'cancel') {
  const pl = g.player, H = pl.holding; if (!H) return;
  if (why === 'shot' && holdKilling(H) && H.t >= killCut()) { killOut(g); pl.char.anim.holdPose = null; return; }   // (CLOSE.heldClicks: Sam put down or folded with the knife already in — past killCut the man dies by it all the same, the kill's own end; before it he is loose as ever. A cancel — the tour, a teleport, a unit taken off the floor — hands him back whenever it comes)
  handBack(g, H.g, why === 'shot' ? 0.6 : 0.3);
  pl.holding = null; pl.char.anim.holdPose = null;
  if (why === 'shot') { g.audio.play('shove', v3.add(H.g.char.pos, [0, 1.3, 0]), 0.3); g.msg(`${H.g.callsign} is loose`); }   // he wrenches free of the slackening arm (quieter than a shove: nobody pushed); a cancel — the tour, a teleport — makes no sound
}
/** the hold simply ceases (the man is gone from under it: reset, or dead in the arm): Sam's side cleared, and his if he is still about */
function dropHold(g: Game) {
  const pl = g.player, H = pl.holding; if (!H) return;
  const gd = H.g; if (gd.held?.by === 'player') gd.held = null; gd.char.anim.heldPose = null; if (gd.state !== 'dead') gd.talk.heldSince = -1;
  pl.holding = null; pl.char.anim.holdPose = null;
}

// ------------------------------------------------------------ locked doors: pick it (quiet, slow) or kick it in (instant, floor-wide loud)
/** The 'pick the lock' row on a door locked against you (Game.updateDoors): drop whatever the hands were doing and start working the lock — updatePicking runs
 *  the beat on its own from here; a step, a Space tap or Esc breaks off (interact.ts cancelSustained → stopPicking). */
export function startPicking(g: Game, d: Door) {
  const pl = g.player, c = pl.char; if (pl.down || pl.takedown || pl.kick) return;
  if (d.def.steel) { g.msg("the stair door has no keyhole on this side, so you can't pick it"); return; }   // (the row is never offered for it; a script asking anyway gets the reason)
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  cancelReloads(pl); pl.throwHeld = false; pl.throwPreview = null; pl.sprinting = false; pl.easing = null; wandDrop(pl);
  pl.picking = d; pl.crouch = true;   // you work a lock on your knee — and stay down there afterwards
  if (d.pick <= 0) g.msg('picking the lock. take a step or press Space to stop');
}
/** Hands off the tools (the pick broken off — a step, Space, Esc, the tour, a man coming through with his key — or done): the progress stays on the door a couple
 *  of seconds (doors.ts), he stays on his knee. */
export function stopPicking(g: Game, text?: string) {
  const pl = g.player; if (!pl.picking) return;
  pl.picking = null; pl.char.anim.lockpick = false; pl.speedSm = 0; if (text) g.msg(text);
}

/** Working the lock, on its own clock once begun: eased onto the spot square in front of the keyway (Doors.workSpot), crouched and still, body and eyes on
 *  the lock, hands on the tools (anim.lockpick — once they are there hideHeldItem sends the pistol to the thigh and the rail light with it), and only then does
 *  the cylinder advance (Doors.pick: soft clicks the room hears, a louder snap as it goes). A step, a Space tap or Esc break off with the progress kept on the
 *  door for a couple of seconds (interact.ts); the tour taking over, or the leaf unlatching under your hands (a guard and his key coming through) end it here. */
export function updatePicking(g: Game, dt: number, input: Input) {
  const pl = g.player, c = pl.char, d = pl.picking!;
  const stop = (text?: string) => stopPicking(g, text);
  if (g.puppet) stop();
  else if (!g.doors.lockedOut(d, c.pos)) stop(d.locked ? 'someone is coming through' : undefined);   // unlatched from the far side while still locked: a key, not you
  else {
    const spot = g.doors.workSpot(d, c.pos);
    c.vel = [0, 0, 0]; c.pos = v3.lerp(c.pos, spot.pos, 1 - Math.exp(-10 * dt)); collidePlayer(g, 1.0); keepOffGuards(g, dt, 1.0);   // (a guard walking into you shoves you off the spot: the work pauses until you settle back)
    c.bodyYaw = approachAngle(c.bodyYaw, spot.yaw, 12 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0, 8, dt);   // square on, no chest twist: the hands are solved in front of the body
    pl.crouch = true; pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false;
    c.anim.lockpick = true; c.anim.speed = 0; c.anim.crouchTarget = 1; c.anim.upper = 'none';
    const planted = v3.distXZ(c.pos, spot.pos) < 0.12 && c.anim.hideHeldItem;   // there, and the tools are in the keyway
    if (planted && g.doors.pick(d, PLAYER_ID, dt)) { chronDoor(g, 'lockPicked', d); stop('the lock gives — it opens like any other door now'); }
  }
  armRifle(g, pl.rifleUp && !c.anim.hideHeldItem, 'lowLong');   // the rifle stays in the hands, low, until they are on the tools (hideHeldItem — combat.ts handProps swings it onto his back on the same flag), and comes back into them as they come off
  c.update(dt);
  poseGunLight(g);   // the light rides the gun: lit only while the gun is still (or again) in the hand — and in the hand at all (he starts holstered now)
}

// ------------------------------------------------------------ the optical wand: a look under a shut door (wand.ts)
/** The 'look under it' row of a shut door (Game.updateDoors): whatever the hands were doing is dropped and he goes onto his knee at the middle of the leaf —
 *  updateWanding runs it from here; a step, Space or Esc pulls it out (interact.ts cancelSustained → stopWand). */
export function startWand(g: Game, d: Door) {
  const pl = g.player, c = pl.char; if (pl.down || pl.takedown || pl.kick || pl.holding || pl.wanding) return;
  if (pl.coding || pl.doorMove || pl.breakerMove || g.mission.driveT >= 0 || samWork(g)) return;   // (hands on another thing: the row is not offered then — buildInteractables' `busy` — and a script asking anyway starts nothing)
  if (!wandOffered(g, pl, d)) { if (WAND.on && pl.wand) g.msg(wandFits(d) ? 'nothing here the wand would show you' : d.def.steel ? 'no gap under a steel fire door' : 'the wand goes under a shut door'); return; }   // (the row is never offered then; a script asking anyway gets the reason)
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  cancelReloads(pl); pl.throwHeld = false; pl.throwPreview = null; pl.sprinting = false; pl.easing = null; pl.picking = null;
  pl.wanding = { door: d, side: g.doors.side(d, c.pos), t: 0, pan: 0, live: false, off: 0, age: 0 }; pl.crouch = true;   // (on his knee — and he stays down there afterwards, as at a lock)
  WAND_STATS.looks++; if (!WAND.quick) g.msg('feeding the wand under the door. take a step or press Space to pull it out');   // (WAND.quick: 'the wand is through' follows inside half a second — one line, and the row says how it stops)
}
/** The wand pulled out (a step, Space, Esc; the door moving; a show): no round for WAND.stowSecs, he stays on his knee. */
export function stopWand(g: Game, text?: string) {
  const pl = g.player; if (!pl.wanding) return;
  wandDrop(pl); pl.speedSm = 0; if (text) g.msg(text);
}
/** One frame of the look (Player.wanding): planted on his knee square to the middle of the leaf, both hands at it (the lock work's pose), nothing in the sights;
 *  once he has been there WAND.feedSecs (WAND.quick: as soon as he is — the animation is the wait) the lens is live — fogofwar.ts takes wandEye in place of his own — and turns after the frame's aim point. */
function updateWanding(g: Game, dt: number) {
  const pl = g.player, c = pl.char, W = pl.wanding!, d = W.door;
  if (g.puppet || !WAND.on || !g.fogOfWar.active) stopWand(g);
  else if (!wandFits(d) || g.doors.side(d, c.pos) !== W.side) stopWand(g, 'the door moved — the wand is out');
  else if (samStaggered(g) || g.time < pl.dazzledUntil) stopWand(g);
  else {
    const spot = g.doors.workSpot(d, c.pos, 0.5, d.def.width * 0.5);
    c.vel = [0, 0, 0]; c.pos = v3.lerp(c.pos, spot.pos, 1 - Math.exp(-10 * dt)); collidePlayer(g, 1.0); keepOffGuards(g, dt, 1.0);   // (shoved off the spot by a man walking into him: the look waits until he settles back)
    c.bodyYaw = approachAngle(c.bodyYaw, spot.yaw, 12 * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0, 8, dt);
    pl.crouch = true; pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false;
    c.anim.lockpick = true; c.anim.speed = 0; c.anim.crouchTarget = 1; c.anim.upper = 'none';
    const planted = v3.distXZ(c.pos, spot.pos) < 0.12 && c.anim.hideHeldItem;   // there, and both hands on it
    W.age += dt;
    if (planted) { W.off = 0; W.t += dt; if (!W.live && wandThrough(W.t, W.age, c.anim.crouch, true)) { W.live = true; WAND_STATS.live++; g.msg('the wand is through'); } }
    else if (W.live) { stopWand(g, 'shoved off it — the wand is out'); }   // (a man walked into him: the cable came out with him — one line, and the look is his to start again)
    else if (v3.distXZ(c.pos, spot.pos) >= 0.12 && (W.off += dt) >= WAND.giveUpSecs) stopWand(g, 'no room to kneel at that door');   // (somebody, or something, stands where he must kneel)
    if (pl.wanding && W.live) wandTurn(W, g.aimPoint, dt);
  }
  armRifle(g, pl.rifleUp && !c.anim.hideHeldItem, 'lowLong');
  c.update(dt);
  poseGunLight(g);
}

/** Keying a code in (Player.coding — devices.ts): stood at the pad with the feet still (a guard walking into him shoves him, as at the lock), turned to face
 *  the plate, nothing in the sights, the rifle low; nothing here reads the movement keys or the buttons (interact.ts stops the verb on a fresh key). */
function updateCodingPlant(g: Game, dt: number) {
  const pl = g.player, c = pl.char; const K = g.devices.padOf(pl.coding!);
  c.vel = [0, 0, 0]; const x0 = c.pos[0], z0 = c.pos[2]; if (K && handworkOn('work')) { if (pl.wall) releaseWall(g); workStand(c, K.def.pos, K.n, dt, samWorkHand(g)); }   // (handwork.ts: the step in to arm's length of the plate)
  collidePlayer(g, 1.0); keepOffGuards(g, dt, 1.0);
  const stepV = K && handworkOn('work') && dt > 0 ? Math.hypot(c.pos[0] - x0, c.pos[2] - z0) / dt : 0;   // (his legs take the step he is walked: 0 with the switch off)
  if (K) { c.bodyYaw = approachAngle(c.bodyYaw, Math.atan2(-K.n[0], -K.n[2]), 10 * dt); c.aimYaw = c.bodyYaw; }
  c.aimPitch = damp(c.aimPitch, 0, 8, dt); pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false; c.anim.speed = stepV > 0.2 ? Math.min(stepV, 1.7) : 0; c.anim.upper = 'none';
  armRifle(g, pl.rifleUp, 'lowLong'); c.update(dt); poseGunLight(g);
}

/** Hands at work on a thing that is not a lock or a pad (handwork.ts samWork: the mains lever, the drive in its rack, a charge on a wall): the keypad's plant —
 *  walked the step in to arm's length, feet still, squared to it, nothing in the sights, the rifle low. The verb's own clock and its ways out are its owner's. */
function updateWorkPlant(g: Game, dt: number, W: SamWork) {
  const pl = g.player, c = pl.char;
  if (pl.wall) releaseWall(g);   // (pressed to the wall beside the thing: he comes off it to work — as for a pick or a kick)
  c.vel = [0, 0, 0]; const x0 = c.pos[0], z0 = c.pos[2]; const yaw = workStand(c, W.p, W.n, dt, samWorkHand(g)); collidePlayer(g, 1.0); keepOffGuards(g, dt, 1.0);
  if (W.at) { W.at[0] += c.pos[0] - x0; W.at[2] += c.pos[2] - z0; }   // (the spot he must not shift from goes with the step HE IS WALKED here, and only that: anything else that moves him — a shove, a blast — still breaks the work off)
  const stepV = dt > 0 ? Math.hypot(c.pos[0] - x0, c.pos[2] - z0) / dt : 0;   // (his legs take the step he is walked)
  c.bodyYaw = approachAngle(c.bodyYaw, yaw, WORK_TURN * dt); c.aimYaw = c.bodyYaw;
  c.aimPitch = damp(c.aimPitch, 0, 8, dt); pl.sprinting = false; pl.backpedal = false; c.anim.reverse = false; c.anim.speed = stepV > 0.2 ? Math.min(stepV, 1.7) : 0; c.anim.upper = 'none'; c.anim.lockpick = false;
  armRifle(g, pl.rifleUp, 'lowLong'); c.update(dt); poseGunLight(g);
}

/** Kick a door in: the 'kick it in' row on a door locked against you, or a sprint straight into one (Game.updateDoors). One committed second: updateKick.
 *  Offered crouched too — it stands him up into it — so not where he cannot stand (canStand: the row is withheld there, and this refuses). */
export function startKick(g: Game, d: Door, run = false, tool?: 'shotgun' | 'hammer') {
  const pl = g.player, c = pl.char; if (pl.kick || pl.down || pl.takedown || c.anim.kicking) return;   // (anim.kicking without pl.kick: the leg is still coming down from a kick a teleport broke off — its clock would time this one's impact wrong)
  if (pl.crouch && !canStand(g)) { g.msg('no room to stand for a kick here'); return; }
  if (tool && BIGSLOT.moves && Math.min(v3.distXZ(d.pos, c.pos), v3.distXZ(d.frameCentre, c.pos)) >= Doors.USE_REACH && !samBigSpot(g, d, c.pos, tool)) return;   // (the row taken from a stack's distance and the place beside the frame gone under it this frame: nothing begins — the opening is not walked into from there)
  releaseWall(g); if (pl.dragging) g.toggleDrag();
  pl.picking = null; wandDrop(pl); c.anim.lockpick = false; pl.easing = null; pl.sprinting = false; pl.crouch = false; pl.throwHeld = false; pl.throwPreview = null; pl.fHeld = true; pl.speedSm = 0;
  cancelReloads(pl);
  pl.doorKickTail = false;
  const beside = tool ? samBigSpot(g, d, c.pos, tool) : null;
  const spot = beside ?? (run ? null : sideKickSpot(g, d, c.pos)) ?? g.doors.kickSpot(d, c.pos);   // taken ONCE, off the leaf as it stands now: a man coming through with his key mid-kick swings the leaf, and a spot re-read off the swinging leaf orbited the hinge with it — reeling the planted kicker through the doorway (or at 20 fps through the wall beside it)
  if (tool) { const lead = BIGSLOT.moves ? samBigLeadOf(g) : 0;
    pl.kick = { door: d, spot: spot.pos, yaw: spot.yaw, tool: { kind: tool, side: bigSide(d, c.pos), t: -lead, ...(lead > 0 ? { lead } : {}), n: 0, need: hammerBlows(g, d, c.pos), next: BIGSLOT.moves ? Infinity : tool === 'hammer' ? BIGSLOT.windup : BIGSLOT.draw, done: -1,
    ...(BIGSLOT.moves ? { moves: { arrived: false, at: beside?.at ?? lockPoint(d, bigSide(d, c.pos)), blows: [], end: -1, ...(beside?.via ? { via: beside.via } : {}) } } : {}) } }; return; }   // (bigkit.ts: the big slot's tool on the lock in the boot's place — the same planted beat, no leg thrown)
  pl.kick = run ? { door: d, spot: spot.pos, yaw: spot.yaw, run: true } : { door: d, spot: spot.pos, yaw: spot.yaw }; c.anim.kickDoor();   // (run — sprintdoor.ts: the boot at a sprint, at the face the leaf opens toward)
}

/** DOORWAY.sideKick: the spot a kick is thrown from BESIDE the door, for a kicker who already stands beside its latch jamb on that face with floor to stand on
 *  there and nothing solid between him and it; null = the square kick (in front of the leaf, on the hinge side, no floor, the switch off). */
export function sideKickSpot(g: Game, d: Door, from: Vec3): { pos: Vec3; yaw: number } | null {
  if (!DOORWAY.sideKick || d.off) return null;
  const f = g.doors.frameCoords(d, from); if (f.along < d.def.width - 0.05 || f.along > d.def.width + 1.2 || f.off > 1.3) return null;
  const s = g.doors.kickSpotSide(d, from);
  if (g.col.nav.isBlocked(s.pos[0], s.pos[2]) || g.col.solidBlocked([from[0], 0.5, from[2]], [s.pos[0], 0.5, s.pos[2]])) return null;
  return s;
}

/** The kick beat (CharacterAnimator.kickDoor, 1.0 s): eased back / up to the kicking distance square to the leaf by the lock (Doors.kickSpot, fixed when the
 *  kick began) over the wind-up, rooted there; on the impact frame the lock goes (Doors.kickIn: keep torn out, leaf flung to its stop, the crack of it through
 *  the whole floor); control returns when the animator has the foot planted again. The rail light stays on the gun throughout (pulled into the high carry, it sweeps the door). */
export function updateKick(g: Game, dt: number) {
  const pl = g.player, c = pl.char, d = pl.kick!.door;
  const spot = pl.kick!;
  c.vel = [0, 0, 0];
  const walked = !!spot.tool?.moves, x0 = c.pos[0], z0 = c.pos[2]; let yaw = spot.yaw;
  if (walked) { yaw = samBigWalk(g, dt); collidePlayer(g, 1.7); }   // (bigkit.ts, BIGSLOT.moves: he walks onto his place beside the frame, the tool coming into his hands on the way)
  else if (c.anim.kickTime < 0.45) { c.pos = v3.lerp(c.pos, spot.spot, 1 - Math.exp(-12 * dt)); collidePlayer(g, 1.7); }   // set the distance during the chamber; from the strike on, the planted foot stays where it is
  keepOffGuards(g, dt, 1.7);
  const stepV = walked && dt > 0 ? Math.hypot(c.pos[0] - x0, c.pos[2] - z0) / dt : 0;   // (his legs take the steps he is walked)
  c.bodyYaw = approachAngle(c.bodyYaw, yaw, (walked ? 9 : 16) * dt); c.aimYaw = c.bodyYaw; c.aimPitch = damp(c.aimPitch, 0, 8, dt);
  pl.sprinting = false; pl.crouch = false; pl.backpedal = false; c.anim.reverse = false; c.anim.lockpick = false;
  c.anim.speed = stepV > 0.2 ? Math.min(stepV, 1.7) : 0; c.anim.crouchTarget = 0; c.anim.upper = pl.pistolUp ? 'relaxed' : 'none';   // (the carry arms only with the gun actually out: holstered — the default now — the kick keeps the hands free instead of pulling an empty high-ready)
  c.anim.bigTool = samBigPose(g);   // (bigkit.ts, BIGSLOT.moves: where the tool's beat stands — the animator's pose is a function of it; null for a boot, and with the moves off)
  armRifle(g, pl.rifleUp, 'portLong');   // the rifle across the chest at the high port for the kick, as the rifleman's is
  c.update(dt);
  if (spot.tool) { if (samBigTick(g, dt)) { pl.kick = null; samBigEnded(g); } poseGunLight(g); return; }   // (bigkit.ts: the breaching shotgun's shell or the hammer's blows, on their own clock)
  const home = !spot.run || g.doors.bootHolds(d, c.pos);   // (the boot at a run was thrown at a leaf shut in its frame: one somebody has opened under the wind-up is not there to be kicked — the sole meets nothing)
  if (c.anim.kickImpact && !d.off && spot.run && home && tearOff(g, d, c.pos, PLAYER_ID, SPRINTDOOR.kickK)) { SPRINTDOOR_STATS.kicks++; chronDoor(g, 'doorKicked', d); }   // the boot at a run (sprintdoor.ts): the leaf goes through its frame and off its hinges — where it cannot come off, the ordinary boot below
  else if (c.anim.kickImpact && !d.off && home) { const gave = g.doors.kickIn(d, c.pos, PLAYER_ID); kickScuff(g, d, c.pos); if (gave) { g.msg('you kicked it in, and the whole floor heard that'); chronDoor(g, 'doorKicked', d); } }   // the boot's scuff by the lock on his face of the leaf, riding it as it flies (marks.ts) — a steel door takes the scuff too, says its own word (game.ts onDoorEvent 'clang') and stays shut: nothing kicked in to chronicle
  if (!c.anim.kicking) pl.kick = null;
  else if (spot.run && c.anim.kickTime >= Math.max(SPRINTDOOR.kickFree, 0.5)) { pl.kick = null; pl.doorKickTail = true; }   // (…and the boot at a run gives him his legs back as the foot comes down, not a fifth of a second after)
  poseGunLight(g);
}

/** Planar distance from the player to a corpse, wherever the ragdoll left it: the nearer of its ankles (what you take hold of) and its hips.
 *  `within`: the caller only asks 'nearer than this?' (both in-file callers compare against 1.3) — a point already that far off is answered by its plain distance,
 *  its reach line never walked: blocked it would count 99, clear its distance, and either way not under the bar, so every such comparison comes out as it did. */
export function bodyDist(g: Game, gd: Guard, within = Infinity): number {
  const p = g.player.char.pos, b = gd.char.bones;
  const a: Vec3 = [p[0], 0.5, p[2]];
  const reach = (q: Vec3 | undefined, add: number) => { if (!q) return 99; const d = v3.distXZ(q, p); if (d + add >= within) return d; const t: Vec3 = [q[0], 0.5, q[2]]; return g.col.solidBlocked(a, t) ? 99 : d; };   // not through a partition or a shut door (solidBlocked asks the leaves itself, first: the segmentBlockedDynamic that used to follow it here could only ever repeat its 'clear')
  return Math.min(reach(b.footL, 0), reach(b.footR, 0), reach(b.hips, 0.3) + 0.3, bodyGripDist(g, gd, within));   // (hands.ts: the head end too — he takes a body by the end he is at)   // by the hips still means gathering the legs in first: count it a little further
}

/** Throw origin (right hand-ish) */
export function throwOrigin(g: Game): Vec3 { const c = g.player.char; const f = c.forward(); return [c.pos[0] + f[0] * 0.32, c.pos[1] + (g.player.crouch ? 1.05 : 1.5), c.pos[2] + f[2] * 0.32]; }

export function doThrow(g: Game, sol: ThrowSolution, kind: ThrowKind) {
  const pl = g.player; if (g.throwCount(kind) <= 0) { g.msg(kind === 'frag' ? 'no frag grenades left' : kind === 'flash' ? 'no flashbangs left' : 'no smoke canisters left'); return; }
  if (pl.pendingThrow) return;                                   // one in the air per wind-up (double-tap G would otherwise eat a canister)
  if (kind === 'frag') pl.frags--; else if (kind === 'flash') pl.flashbangs--; else pl.canisters--;   // (always counted at the wind-up so a cancel's refund stays exact; under unlimited ammo the can comes BACK at release — the pendingThrow branch in update)
  pl.char.anim.throwItem(v3.distXZ(pl.char.pos, sol.land), Math.hypot(sol.v0[0], sol.v0[2])); pl.pendingThrow = { t: THROW_RELEASE, sol, kind };   // it leaves the hand as the arm comes over the top (character.ts throwLayer), along the arc previewed at the click
  g.audio.play('throw', throwOrigin(g), 0.7);
}

/** px — the cursor this close to a wounded man's chest puts the reticle on him (a living man snaps from SNAP_PX) */
const WOUNDED_SNAP_PX = 26;
export function updateAim(g: Game, input: Input, cam: FollowCamera, canvas: View) {
  if (g.puppet?.aim) {   // scripted aim: put the cursor where the point projects (anywhere in front of the eye, on the view or off it)
    const [sx, sy, front] = cam.project(g.puppet.aim, canvas.clientWidth, canvas.clientHeight, Infinity, 1e-3);
    if (front) { input.mouseX = sx; input.mouseY = sy; }
  }
  const u = input.mouseX / Math.max(1, canvas.clientWidth), v = input.mouseY / Math.max(1, canvas.clientHeight);
  const ray = cam.ray(u, v);
  const hit = g.engine.world.raycast(ray.ro, ray.rd, 200, undefined, PLAYER_ID);
  let p: Vec3 | null = hit ? v3.mad(ray.ro, ray.rd, hit.t) : cam.groundPoint(u, v, 0);
  if (!p) p = v3.add(v3.add(g.player.char.pos, g.player.char.forward()), [0, 1.15, 0]);   // cursor ray missed everything: aim level, straight ahead
  if (g.puppet?.aim) p = v3.copy(g.puppet.aim);   // a scripted aim IS the point: the cursor above only places the ring / the snap / the hover — the eye's ray to it can meet a leaf or a man standing between a showcase's lens and Sam, and the arm would follow THAT (a set-up behind him had him aim back over his shoulder at the door he came through)
  g.aimPoint = p;
  buildInteractables(g, cam, input.mouseX, input.mouseY, canvas.clientWidth, canvas.clientHeight);
  // Generous auto-aim (Chaos Theory): the reticle SNAPS to a living guard's centre of mass within SNAP_PX of the cursor, and to a light only with the cursor
  // ON the light — within AIM.player.lightSnapPx of its dot, or on the fixture's own drawn box (the ceiling panels are never drawn: at the men's 60 px each
  // of them was an unseen 1.2 m disc that swung his gun up at the ceiling on the way past and took the shot off a man standing under its picture) — guards
  // win over lights on a near tie, a light behind the man the tour is shooting at never steals the shot (puppet without .fixtures), and the ring on the HUD
  // is drawn at the snapped thing so you can see what a click / right click will do; raw aim when nothing is near.
  const W = canvas.clientWidth, H = canvas.clientHeight, mx = input.mouseX, my = input.mouseY;
  // A light TAKEN is KEPT while the cursor stays where it took it: the gun going up to the fixture moves the aim point, the camera's lead pans the picture after
  // it and the dot slides tens of px from under a cursor nobody moved — out to the men's reach, as it always held.
  const reach = Math.min(SNAP_PX, AIM.player.lightSnapPx), at = lightAt.get(g);
  const kept = g.aimTarget && at && Math.hypot(mx - at[0], my - at[1]) <= reach ? g.aimTarget : null; let onIt = false;
  let bestPx = SNAP_PX; g.aimTarget = null; g.aimGuard = null; g.aimSnap = null; g.aimFriend = null;
  if (!(g.puppet && !g.puppet.fixtures)) for (const it of g.interactables) {   // lights (still enumerated by buildInteractables for exactly this)
    if (it.kind !== 'light' || !it.target) continue;
    const [sx, sy, front] = cam.project(it.pos, W, H); if (!front) continue;
    const d = Math.hypot(sx - mx, sy - my); if (d >= bestPx) continue;
    const on = d < reach || (!!hit && it.target.boxes.includes(hit.index));   // on its dot, or the cursor's ray lands on the drawn fixture itself (a screen, a vending front)
    if (!on && it.target !== kept) continue;
    bestPx = d; g.aimTarget = it.target; g.aimSnap = v3.copy(it.pos); onIt = on;
  }
  const held = g.player.holding?.g ?? null;   // the man in Sam's arm is nobody to draw a line on (a round past him goes to whatever else the reticle has)
  for (const gd of g.guards) {
    if (gd.state === 'dead' || gd === held || g.fogOfWar.hidden(gd) || friendNoSnap(gd)) continue;   // (fog of war: no ring on a man who is not in the picture; friends.ts: none on a man of his own side)
    const com: Vec3 = gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.2, 0]);
    const [sx, sy, front] = cam.project(com, W, H); if (!front) continue;
    const d = Math.hypot(sx - mx, sy - my) - 6;   // (a hair of preference for men over fixtures)
    if (d < bestPx && !g.col.segmentBlocked(v3.add(g.player.char.pos, [0, 1.3, 0]), com)) { bestPx = d; g.aimGuard = gd; g.aimTarget = null; g.aimSnap = com; }   // only a man Sam could actually draw a line on
  }
  // a man down WOUNDED (wounds.ts) is no threat and never takes the snap from a living man (nor from a light the cursor is nearer to) — but with the cursor ON him (WOUNDED_SNAP_PX of his chest, where it is now) the reticle has him: that click is the player's to make
  if (!g.aimGuard) for (const gd of g.guards) {
    if (!gd.wound || gd === held || g.fogOfWar.hidden(gd) || friendNoSnap(gd)) continue;
    const com: Vec3 = gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 0.6, 0]);
    const [sx, sy, front] = cam.project(com, W, H); if (!front) continue;
    const d = Math.hypot(sx - mx, sy - my);
    if (d < Math.min(bestPx, WOUNDED_SNAP_PX) && !g.col.segmentBlocked(v3.add(g.player.char.pos, [0, 1.3, 0]), com)) { bestPx = d; g.aimGuard = gd; g.aimTarget = null; g.aimSnap = com; }
  }
  // the exact ray still counts when it lands ON a man the loose test missed (a sliver of him showing round cover)
  // (friends.ts, either of its rules on: the NEAREST body on the ray decides. A man of his own side under the cursor is known — `g.aimFriend` — and, under
  // noSnap, is no snap: the aim stays the cursor's; a hostile BEHIND him on the ray is not ringed through his body, and a friend behind a hostile is nobody's.
  // A hostile so refused hands back the LIGHT the reticle had before the ray found him: the fixture's dot under the cursor is still the right button's)
  if (!g.aimGuard) { let bestT = hit ? hit.t : 1e9, friendT = Infinity; const lit = g.aimTarget, litAt = g.aimSnap;
    for (const gd of g.guards) { if (gd === held || g.fogOfWar.hidden(gd)) continue; const t = gd.char.rayHit(ray.ro, ray.rd, bestT + 0.5); if (!(t >= 0 && t < bestT + 0.5)) continue;
      if (friendOnRay(gd)) { if (t < friendT) { friendT = t; g.aimFriend = gd; } if (friendNoSnap(gd)) continue; }
      g.aimGuard = gd; g.aimTarget = null; g.aimSnap = gd.char.bones.chest ?? v3.add(gd.char.pos, [0, 1.2, 0]); bestT = t; }
    if (g.aimFriend && g.aimGuard && g.aimGuard !== g.aimFriend) { if (friendT >= bestT) g.aimFriend = null; else if (friendNoSnap(g.aimFriend)) { g.aimGuard = null; g.aimTarget = lit; g.aimSnap = litAt; } } }
  if (samBlind(g) > 0.5) { g.aimGuard = null; g.aimTarget = null; g.aimSnap = null; }   // blind (samstun.ts): the reticle takes nobody
  if (g.aimSnap && !g.puppet?.aim) g.aimPoint = v3.copy(g.aimSnap);   // the gun follows the snap (rounds already went to aimTarget / aimGuard; this makes the arm and the laser agree with the ring)
  if (!g.aimTarget) lightAt.delete(g); else if (onIt || !at) lightAt.set(g, [mx, my]);
}
/** where the cursor last was ON the light the reticle has (CSS px) — updateAim keeps that light while the cursor stays there */
const lightAt = new SideMap<Game, [number, number]>('player.lightAt');

/** Every marker Space concerns itself with this frame (Game.interactables: one per thing — the dots in the world, the auto-aim's lights) and the ROWS: what Space
 *  can do right now, one verb per row (Game.nearby — the top MAX_NEAR by what matters, the cancel row at the foot while the selector is open), and the highlighted
 *  one (Game.hover: a Space tap does it, Space held opens the list to choose another — interact.ts). Every verb is its own row: a shut door is 'push it open' AND
 *  'ease it open — silent'; a lock is 'pick' and 'kick'; the man in the arm is 'question him' and 'choke him out'. While a sustained verb runs (a leaf easing, a
 *  lock being picked, the choke, the drive) its row is the ONLY row — worded as running, with its progress — and nothing else is on offer until it ends or is stopped. */
export function buildInteractables(g: Game, cam: FollowCamera, mx: number, my: number, w: number, h: number) {
  const pl = g.player; const list: Interactable[] = []; const p = pl.char.pos;
  /** in-reach things with their verb rows, ordered below by interactOrder on the marker; each thing's verbs in the order authored here (the everyday verb first, its deliberate alternative under it — for a lock the quiet pick above the loud kick) */
  const things: { it: Interactable; verbs: Interactable[] }[] = [];
  let rows: Interactable[] = [];
  /** a verb row: the marker's identity, 'Space␠␠<verb>' and any hint lines for the thing's OTHER inputs (overlay.ts parseOpts splits on '  ·  ') */
  const NO_BOOT = "kick it — it opens toward you, so that won't work";   // (the kick row greyed: doors.ts DOORWAY.frameHolds)
  const row = (base: Interactable, verb: Verb, text: string, hints = '', over: Partial<Interactable> = {}): Interactable => ({ ...base, verb, running: false, progress: undefined, line2: `Space  ${text}${hints ? '  ·  ' + hints : ''}`, ...over });
  /** the one row of a running sustained verb: worded as running, its bar, and how it stops */
  const running = (base: Interactable, verb: Verb, text: string, progress?: number): Interactable => ({ ...base, verb, running: true, line2: text, progress: progress === undefined ? undefined : Math.max(0, Math.min(1, progress)), inReach: true });   // (no `progress`: a verb with nothing to count — no ring, no bar)
  /** a row Space does nothing with (getting hold of him…, kicking it in…): no verb */
  const status = (base: Interactable, text: string): Interactable => ({ ...base, verb: undefined, running: false, line2: text, progress: undefined, inReach: true });
  /** the marker of a thing that has verb rows: its line2 lists them the way the rows word them (probes and the dots read the marker; the panel reads the rows) */
  const offer = (it: Interactable, verbs: Interactable[]) => { if (verbs.length) { it.line2 = verbs.map(v => v.line2).join('  ·  '); things.push({ it, verbs }); } list.push(it); };
  for (const t of g.targets) {
    if (t.broken || !t.interactive) continue;
    if (deadLamp(t)) { list.push({ kind: 'light', pos: t.pos, line1: t.name, line2: 'click  shoot', inReach: true, off: true, target: t }); continue; }   // (carlamps.ts: a vehicle's lens that burns nothing — not 'off', and nothing for the OCP)
    list.push({ kind: 'light', pos: t.pos, line1: `${t.name}${t.factor > 0 ? '' : ' (off)'}`, line2: 'right-click  OCP (the pistol\'s)  ·  click  shoot', inReach: true, off: t.factor <= 0, target: t });
  }
  if (!pl.down && pl.holding) {
    // a man in his arm: HIS rows are the only rows. The ARM hold: 'question him' — what the next exchange puts to him (dialogue.ts promptFor: the verb changes as
    // he is leaned on, names the useful thing when he is about to give it, and says so once he is dry; Sam's actual words go up over Sam when it is done) with
    // where the exchange stands (Sam asking · his answer just begun: it cuts it short · far enough in: it cuts in with the next) — and 'choke him out', E to draw
    // as its hint; the GUN hold: the one row is the pistol-whip, with the click past him and E to holster (the way back to questions) as hints. The grab settling,
    // and a choke / whip chosen or under way, are the running row. The doors about the pair are markers only (they are walked into: a shut leaf pushes open ahead
    // of him, a lock turns for HIS key). Nothing else is on offer with both hands on him.
    const H = pl.holding, gd = H.g, gun = H.variant === 'gun', K = HOLD.secs;
    const head = gd.char.bones.head ?? v3.add(gd.char.pos, [0, 1.6, 0]);
    const cv = gd.civ;   // a CIVILIAN in the arm (civilians.ts): her rows — what she knows / 'stay down, stay quiet' (lets her go) / the choke; the whip with the pistol out; every civilian on the floor by his hand costs him
    const base: Interactable = { kind: 'held', pos: [head[0], head[1] + 0.3, head[2]], line1: cv ? `${gd.callsign} · the ${cv.label} · ${gun ? `your pistol at ${WORDS.on && cv.she === 'he' ? 'his' : cv.her} head` : 'in your arm'}` : `${gd.callsign} · ${gun ? 'your pistol at his head' : 'in your arm'}`, line2: '', inReach: true, off: false, guard: gd };
    if (H.phase === 'grab') rows.push(status(base, cv ? `getting hold of ${cv.her}…` : 'getting hold of him…'));
    else if (H.phase === 'held' && H.swapT < K.swap) rows.push(status(base, gun ? 'the pistol coming up to his head…' : CLOSE.noKnife ? 'holstering it to get both hands on him again…' : 'holstering it — the knife back at his throat…'));   // E's hand-over: nothing starts while the hand is between tools
    else if (H.phase === 'choke' || (H.windT >= 0 && !gun)) rows.push(running(base, 'choke', 'choking him out… — Space or a step and he breathes again', H.phase === 'choke' ? H.t / K.choke : 0));
    else if (holdKilling(H)) rows.push(status(base, 'the knife…'));   // (close.ts CLOSE.heldClicks, the left click: committed — a status line, nothing stops it)
    else if (H.phase === 'whip' || (H.windT >= 0 && gun)) rows.push(running(base, 'whip', 'pistol-whip… — Space or a step checks it', H.phase === 'whip' ? H.t / K.whip : 0));
    else if (cv && gun) { rows.push(row(base, 'comply', `“stay down, stay quiet” — lets ${cv.her} go, cowering`)); rows.push(row(base, 'whip', `pistol-whip ${cv.her} — knocks ${cv.her} out, but a CIVILIAN costs −10 on the card`, `E  holster — to question ${cv.her}`)); }
    else if (cv) {
      const tk = heldTalk(g, H); const dry = gd.talk.stage >= 1 && cv.intelN >= (CIV_LINES.intel[cv.def.kind]?.length ?? 0);   // (fear first, then the two or three things she knows, then nothing)
      const ask = tk.asking ? `you're asking — ${cv.she} answers in a beat` : tk.samUp ? "once you're done talking" : !tk.ready ? `${cv.she}'s answering — tap to cut it short` : dry ? `${cv.she}'s told you everything — ask anyway` : gd.talk.stage === 0 ? `ask what ${cv.she} knows — quietly` : `press ${cv.her} — what else`;
      rows.push(row(base, 'question', ask));
      rows.push(row(base, 'comply', `“stay down, stay quiet” — lets ${cv.her} go, cowering; ${cv.she} tells nobody`));
      rows.push(row(base, 'choke', `choke ${cv.her} out — quiet, but a CIVILIAN costs −10 on the card`, `${HANDSLOT.on ? '1' : 'E'}  draw — gun to ${WORDS.on && cv.she === 'he' ? 'his' : 'her'} head`));   // (Civ.her is the object's 'him': whose head wants 'his')
    }
    else if (gun) rows.push(row(base, 'whip', 'pistol-whip him — quick, a thud', `LMB  ${pl.pistol.roundsReady > 0 ? 'fire past him' : 'fire past him (empty)'}  ·  E  holster — to question him`));
    else {
      const q = promptFor(g, gd), tk = heldTalk(g, H); const verb = q.spent ? "he's said his piece — ask anyway" : `“${q.text}”`;
      const ask = tk.asking ? "you're asking — he answers in a beat" : tk.samUp ? `${verb} — once you're done talking` : !tk.ready ? "he's answering — tap to cut it short" : `${verb}${tk.settled ? '' : ' — cuts in'}`;   // (samUp without asking: a remark of Sam's is in the air — his word on the key he has just pocketed — and he is never cut)
      rows.push(row(base, 'question', ask));
      rows.push(row(base, 'choke', 'choke him out — quiet', `${CLOSE.heldClicks && !g.touring ? `${CLOSE.noKnife ? '' : 'LMB  knife — lethal  ·  '}RMB  choke him out  ·  ` : ''}${HANDSLOT.on ? '1' : 'E'}  draw — gun to his head`));   // (the two buttons in the arm, close.ts CLOSE.heldClicks: the marks worded as the standing blow's are)
    }
    list.push({ ...base, line2: rows.map(r => r.line2).join('  ·  '), progress: rows[0]?.progress });   // the marker (the ring sits on it; its text = the rows')
    for (const d of g.doors.list) {
      if (d.off || Math.min(v3.distXZ(d.pos, p), v3.distXZ(d.frameCentre, p)) > NEARBY_M) continue;
      const lockedOut = g.doors.lockedOut(d, p);   // (his own pocket aside: it is the man ahead who meets the leaf, and every man on the staff is keyed)
      list.push({ kind: 'door', pos: d.pos, line1: `door · ${lockedOut ? 'locked' : d.isClosed() ? 'shut' : 'open'}`, line2: lockedOut ? 'walk him into it — his key turns the lock' : d.isClosed() ? 'walk him into it — it pushes open' : 'open', inReach: false, off: false, door: d });
    }
  } else if (!pl.down) {
    const busy = !!(pl.takedown || pl.kick || pl.picking || pl.wanding || pl.easing || pl.coding || pl.breakerMove || pl.doorMove || pl.charging || g.mission.driveT >= 0);   // hands or feet spoken for: no fresh verbs this frame (the running verb's row, or a status, stands alone below)
    for (const d of g.doors.list) {
      if (d.off) continue;   // off its hinges (doorblast.ts): a doorway, with no row to its name
      const dp = d.pos; const near = Math.min(v3.distXZ(dp, p), v3.distXZ(d.frameCentre, p)) < Doors.USE_REACH; const reach = near && !pl.sprinting;
      const shut = d.isClosed(); const pct = `${Math.min(99, Math.round(d.pick * 100))}%`;
      const it: Interactable = { kind: 'door', pos: dp, line1: '', line2: reach ? '' : 'step closer', inReach: reach, off: false, door: d };
      const verbs: Interactable[] = [];
      const pad = padState(g, d, p);   // a KEYPAD door against you (devices.ts): no cylinder to pick, no handle to try — the code if you know it (four keys and it swings like a keyed door), the pad refusing you if you do not, or the boot as ever
      if (pad) {
        it.line1 = pl.coding === d ? 'door · keypad · keying it in' : pad.known ? `door · keypad — you know the code (${spell(pad.pad.def.code)})` : 'door · keypad · locked';
        const held = g.doors.bootHolds(d, p);   // (doors.ts DOORWAY.frameHolds: it opens toward him — the frame is behind the leaf, and a boot will not shift it)
        if (!reach) it.line2 = pl.sprinting && near && !held ? 'run into it  kick it in (LOUD)' : 'step closer';
        else if (!busy) {
          if (pad.known) verbs.push(row(it, 'code', `enter the code — ${spell(pad.pad.def.code)}`)); else verbs.push(row(it, 'nocode', 'keypad — no code', '', { off: true }));
          if (!pl.dragging && (!pl.crouch || canStand(g))) verbs.push(held ? row(it, 'kick', NO_BOOT, '', { off: true }) : row(it, 'kick', 'kick it in — LOUD', pl.crouch ? '' : 'or sprint into it'));
        }
      } else if (g.doors.lockedOut(d, p, pl.keys)) {   // the lock is against you: pick it (quiet, slow) or kick it in (instant, and the whole floor hears) — crouched you can also just try the handle; hauling a body, no kick
        const steel = !!d.def.steel;   // the stair door (game/qrf.ts): bolted from the far side, a blank plate this side — no keyway to work, and a boot only rings off it
        it.line1 = d.rattleT > 0 ? "door · locked — won't budge" : steel ? 'steel fire door · bolted from the stairs' : pl.picking === d ? 'door · locked · picking it' : d.pick > 0 ? `door · locked · ${pct} picked` : 'door · locked';
        it.progress = d.pick > 0 ? d.pick : undefined;
        const held = !steel && g.doors.bootHolds(d, p);   // (doors.ts DOORWAY.frameHolds: locked on the face it opens toward — the pick still works, the boot does not)
        if (!reach) it.line2 = pl.sprinting && near && !held ? (steel ? "run into it  (it won't give)" : 'run into it  kick it in (LOUD)') : 'step closer';
        else if (!busy) {
          if (!steel) verbs.push(row(it, 'pick', d.pick > 0 ? `pick the lock — quiet, ${pct} done` : 'pick the lock — quiet, 4 s'));
          if (pl.crouch || pl.dragging || steel) verbs.push(row(it, 'rattle', steel ? 'try the bar — no keyhole this side' : 'try the handle'));
          if (!pl.dragging && (!pl.crouch || canStand(g))) verbs.push(held ? row(it, 'kick', NO_BOOT, '', { off: true }) : row(it, 'kick', steel ? "kick it — LOUD, and steel won't give" : 'kick it in — LOUD', pl.crouch ? '' : 'or sprint into it'));
        }
      } else if (g.doors.keyOpens(d, p, pl.keys)) {   // against you but for the key in your pocket (takeKey): it turns like a guard's — a small clack and it swings, or eased round in silence
        it.line1 = 'door · locked — you have the key';
        if (reach && !busy) { verbs.push(row(it, 'unlock', 'unlock — his key')); verbs.push(row(it, 'ease', 'ease it open — silent')); }
      } else {
        it.line1 = `door · ${shut ? 'shut' : 'open'}${d.lockBroken ? ' · lock kicked in' : d.def.locked && !d.locked ? ' · picked' : ''}`;
        if (reach && !busy) {
          const toward = DOORWAY.oneWay && g.doors.pullFace(d, p);   // (one-way: on the face it opens into the same two rows are worded for the hand — it comes toward him, and goes away to shut)
          if (shut) verbs.push(row(it, 'push', toward ? 'pull it open' : 'push it open')); else verbs.push(row(it, 'pull', toward ? 'push it shut' : 'pull it shut'));   // (Doors.use: shut → it swings away from you with its creak — one-way, the way it opens; anything wider → pulled to)
          if (Math.abs(d.angle) < EASE_OFFER) verbs.push(row(it, 'ease', 'ease it open — silent'));                  // shut or a hand ajar: inch it round without a sound (game.ts updateDoors runs it on to EASE_MAX)
        }
      }
      // the big slot's tool (bigkit.ts — nothing with its switch off): the breaching shotgun or the hammer on a lock against him, in the boot's own row
      { const can = !busy && !pl.dragging && !pl.sprinting && (!pl.crouch || canStand(g)), far = can && !reach && !pl.holding ? samBigFar(g, d, p) : null;   // (BIGSLOT.moves: the row is his from where a stack stands — he walks to a place beside the frame)
        const tool = far ?? (reach && can ? samBig(g, d, p) : null);
        if (far) it.inReach = true;
        if (tool) { const lock = g.doors.lockedOut(d, p, pl.keys);   // (not locked against him — BIGSLOT.shut: its own row under the hand's, listed past the cap like a charge's)
          const r = tool === 'shotgun' ? row(it, 'breach', lock ? 'shoot the lock off — LOUD' : 'shoot it open — LOUD', '', { past: !lock }) : row(it, 'hammer', 'hammer it open — LOUD', '', { past: !lock }), k = verbs.findIndex(v => v.verb === 'kick'); if (k >= 0) verbs[k] = r; else verbs.push(r); } }
      // the optical wand (wand.ts): a look under a shut door, where the fog of war hides what is behind it — the last row of whatever the door offers; where the
      // rows are already MAX_NEAR it takes the place of 'try the handle'
      if (reach && !busy && wandOffered(g, pl, d)) { if (verbs.length >= MAX_NEAR) { const k = verbs.findIndex(v => v.verb === 'rattle'); if (k >= 0) verbs.splice(k, 1); } verbs.push(row(it, 'wand', 'look under it — the wand, quiet')); }
      g.doorTools?.samRows(it, d, verbs, reach && !busy && !g.wallCharge?.setting, row);   // a breaching charge on it by his own hands, and a set one said on the door's line (owncharge.ts — nothing with its switch off)
      offer(it, verbs);
    }
    for (const gd of g.guards) {
      if (gd.state === 'dead' || pl.takedown) continue;
      if (gd.team === 'operative' || g.fogOfWar.hidden(gd)) continue;   // his own side (teams.ts): no grab row, no takedown click on a teammate — and no row on a man the fog of war keeps out of the picture
      if (closeLive(g)) { closeRows(g, gd, p, busy, row, offer); continue; }   // closer than ever (close.ts): his windows — behind as below, his sides, his front, seated — each with its own rows; off = the one gate below
      // from close behind a guard who has not clocked you (not alert, you in his rear half-space, nothing solid between): the row GRABS him, a LEFT CLICK with the
      // hands empty = the silent takedown (game.ts updateDoors reads both; startGrab / startTakedown) — one gate for the two, so wherever the cross could land the
      // arm can go round him. The row spells out what the hand holds: empty, the click is the takedown; the pistol drawn, the grab puts it to his head and a click
      // would be a round (holster first, E); a canister up, the grab is the arm and the click a throw (holster first too). Crouched under something he cannot
      // stand up out of, no grab (the pair stands): the row says so.
      const gp = gd.char.pos; const dx = p[0] - gp[0], dz = p[2] - gp[2]; const dd = Math.hypot(dx, dz);
      if (dd < 2.4) {
        const behind = Math.cos(wrapAngle(Math.atan2(dx, dz) - gd.char.bodyYaw)) < -0.25;   // you are in his rear half-space
        const could = dd < 1.05 && behind && gd.state !== 'alert' && !pl.sprinting && !g.col.solidBlocked([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]) && !g.col.segmentBlockedDynamic([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]);   // and nothing between you: no takedown through a partition or a shut leaf (the lunge would carry you through it)
        const headroom = !could || !pl.crouch || canStand(g);
        const can = could && headroom;
        const it: Interactable = { kind: 'guard', pos: v3.add(gp, [0, 1.35, 0]), line1: gd.state === 'alert' ? 'guard · alert' : behind ? 'guard' : 'guard · facing you', line2: gd.state === 'alert' ? "not while he's onto you" : !behind ? 'get behind him' : pl.sprinting ? 'stop sprinting' : !could ? 'get closer' : 'no room to stand up behind him here', inReach: can, off: false, guard: gd };
        const verbs: Interactable[] = [];
        if (can && !busy) verbs.push(pl.holstered ? row(it, 'grab', 'grab him', 'LMB  takedown — silent') : grabVariant(g) === 'gun' ? row(it, 'grab', 'grab him — pistol to his head', 'E  holster for the LMB takedown') : pl.rifleUp ? row(it, 'grab', 'grab him — the rifle goes on your back', 'E  sling it for the LMB takedown') : row(it, 'grab', 'grab him', 'E  holster for the LMB takedown'));
        offer(it, verbs);
      }
    }
    for (const gd of civilianBodies(g)) {   // the CIVILIANS (civilians.ts): the same arm from close behind her — from any side once she is crouched in a corner — and the same click with the hands empty puts her down quiet (a civilian: it costs). Never one running (you would have to catch her first) or already talking to a guard two metres off.
      if (pl.takedown || g.fogOfWar.hidden(gd)) continue; const cv = gd.civ!;
      if (g.rescue?.isHostage(gd)) continue;   // a hostage of the rescue playtest (rescue.ts): nobody to grab — she stays down where she is
      if (g.snatch?.out.owns(gd)) continue;   // a snatch's man, tied and to be led out (snatchout.ts): his row is the word, not the arm
      const gp = gd.char.pos; const dx = p[0] - gp[0], dz = p[2] - gp[2]; const dd = Math.hypot(dx, dz);
      if (dd >= 2.4) continue;
      const cg = closeLive(g) ? closeCivGate(g, gd, p) : null;   // (close.ts: her own rule, but for the wider rear of one sat at a desk)
      const behind = cg ? cg.behind : cv.state === 'cower' || Math.cos(wrapAngle(Math.atan2(dx, dz) - gd.char.bodyYaw)) < -0.25;
      const catchable = cv.state !== 'flee' && cv.state !== 'evacuate' && cv.state !== 'report';
      const could = (cg ? cg.near : dd < 1.05) && behind && catchable && !pl.sprinting && !g.col.solidBlocked([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]) && !g.col.segmentBlockedDynamic([p[0], 1.0, p[2]], [gp[0], 1.0, gp[2]]);
      const can = could && (!pl.crouch || canStand(g));
      const it: Interactable = { kind: 'guard', pos: v3.add(gp, [0, 1.35, 0]), line1: `${cv.name} · the ${cv.label}${cv.state === 'cower' ? ' · cowering' : cv.state === 'work' ? '' : ` · ${cv.state}`}`, line2: !catchable ? `not while ${cv.she}'s ${cv.state === 'report' ? 'with a guard' : 'running'}` : !behind ? `get behind ${cv.her}` : pl.sprinting ? 'stop sprinting' : !could ? 'get closer' : `no room to stand up behind ${cv.her} here`, inReach: can, off: false, guard: gd };
      const verbs: Interactable[] = [];
      if (cg) { it.close = cg.kind; if (can && !busy) closeCivOffer(g, gd, p); }
      if (can && !busy) verbs.push(pl.holstered ? row(it, 'grab', `grab ${cv.her} — a hand over the mouth`, `LMB  takedown — quiet, and −10`) : grabVariant(g) === 'gun' ? row(it, 'grab', `grab ${cv.her} — pistol to ${cv.her} head`, 'E  holster for the LMB takedown') : row(it, 'grab', `grab ${cv.her}`, 'E  holster for the LMB takedown'));
      offer(it, verbs);
    }
    // (a dead man's sidearm / torch lies where it fell — items, combat.ts dropFromHand — and is nobody's to pick up: his 9 mm magazines do not fit the Five-seveN, so
    // there is no row for it and Space beside it does nothing)
    for (const gd of [...g.guards, ...civiliansShown(g)]) {   // (a civilian on the floor is a body like any: hauled by the ankles, found by the men)
      if (gd.state !== 'dead' || g.fogOfWar.hidden(gd)) continue;
      const hips = gd.char.bones.hips ?? gd.char.pos; const mid: Vec3 = [hips[0], hips[1] + 0.12, hips[2]];   // on the pelvis, wherever the ragdoll left it (over a desk, half through a doorway)
      const dragging = pl.dragging === gd; const reach = dragging || bodyDist(g, gd, 1.3) < 1.3;
      const nm = gd.civ ? `${gd.callsign} (the ${gd.civ.label})` : gd.callsign;
      const it: Interactable = { kind: 'body', pos: mid, line1: gd.wound ? `${nm}, wounded — out of the fight` : isBreathing(gd) ? `body · ${nm}, out cold — breathing` : `body · ${nm}, dead`, line2: reach ? '' : 'step closer', inReach: reach, off: false, guard: gd };   // what the panel says over him: a man you struck / choked / ringed is asleep, a man you shot is dead (the floor treats both as a body)
      const verbs: Interactable[] = [];
      if (reach && !busy) { const lift = HANDS.on && HANDS.body && HANDS.carry && !g.puppet; if (dragging) verbs.push(row(it, 'drop', pl.haul?.carry ? 'put him down' : 'let go of him', 'sprinting drops him')); else if (!pl.dragging && !gd.wound) verbs.push(row(it, 'drag', lift ? 'pick him up' : 'drag him off')); }
      offer(it, verbs);
    }
    // the mission's rack while the drive is still in it: reach = close enough to lay hands on its face, hands free (updateMission runs the pull off Game.act)
    const m = g.mission, M = g.level.mission;
    if (m.stage === 'drive' && (!g.quietUtility || g.missionInTour)) {
      const reach = rackDist(g, p) < DRIVE_REACH && !pl.dragging && !pl.sprinting && !pl.takedown;
      const QW = quietWords(g);   // (a quiet mission's own words for its holder and its thing — quiet.ts; null on the plain night)
      const it: Interactable = { kind: 'objective', pos: M.rack.front, line1: QW ? `${QW.holder} · ${QW.thing}` : `rack ${M.rack.index + 1} · the drive`, line2: reach ? '' : pl.dragging ? 'hands full' : 'step closer', inReach: reach, off: false, progress: m.driveT >= 0 ? Math.min(1, m.driveT / DRIVE_SECS) : undefined };
      const verbs: Interactable[] = [];
      if (m.driveT >= 0) it.line2 = `${QW ? 'taking' : 'pulling'}… ${Math.min(99, Math.round(m.driveT / DRIVE_SECS * 100))}%  ·  stay on it`;
      else if (reach && !busy) verbs.push(row(it, 'drive', QW ? `take ${QW.thing} — stay on it` : 'pull the drive — stay on it'));
      offer(it, verbs);
    }
    { // the mains breaker panel, by hand (the pistol's OCP trips it from range; this is standing at it): reach = within arm's length of its face, hands free
      const bp = g.level.breaker.pos, bo = g.blackout;
      // in SIGHT of its face (the OCP's own test, lighting.ts ocp): the panel hangs on the storage room's wall and the corridor runs along the other side of it —
      // planar distance alone had the mains thrown through 12 cm of wall from a corridor hug, the locked room never entered (review finding); and nothing while down
      const face: Vec3 = [bp[0], bp[1], bp[2] - 0.18];
      if (!(bo.active && bo.permanent) && v3.distXZ(bp, p) < NEARBY_M && !g.col.solidBlocked([p[0], pl.crouch ? 0.9 : 1.3, p[2]], face)) {
        const reach = v3.distXZ(bp, p) < 1.15 && !pl.dragging && !pl.sprinting && !pl.takedown && !pl.holding;
        const it: Interactable = { kind: 'breaker', pos: [bp[0], bp[1] + 0.35, bp[2]], line1: bo.active ? 'breaker · thrown' : 'breaker · power on', line2: reach ? '' : 'step closer', inReach: reach, off: bo.active };
        const verbs: Interactable[] = [];
        if (reach && !busy) verbs.push(bo.active ? row(it, 'breakerOn', 'turn the power back on') : row(it, 'breakerOff', 'throw it — kill the lights'));
        offer(it, verbs);
      }
    }
    wallChargeRows(g, p, busy, row, offer);   // a breaching charge on a partition, by hand (wallcharge.ts — nothing unless its switch and the destruction's are up)
    snatchOutRows(g, p, busy, row, offer);   // a snatch's man once tied: on your feet — with me / stay here (snatchout.ts — nothing unless its switch is up and the level has a van)
    rescueEndRows(g, p, busy, row, offer);   // a rescue's hostages: on your feet — with me / stay here (rescueend.ts — nothing unless a rescue is up with its switch on)
    defuseRows(g, p, busy || !!g.wallCharge?.setting, row, offer);   // a defuse mission's live charges (defuse.ts — nothing on a level without the block)
    stickyRows(g, pl, busy || !!g.wallCharge?.setting || !!g.defuse?.working, row, offer);   // a stuck sticky camera of his own, taken back (stickycam.ts — nothing unless STICKY.take is up)
    switchRows(g, pl, busy || !!g.wallCharge?.setting || !!g.defuse?.working, row, offer);   // a room's wall switch (lightswitch.ts — nothing unless LIGHTSWITCH is up): under a door's rows, over a wall's
    // ---- the rows: the running verb alone (or a status while the feet are committed), else the top MAX_NEAR verbs of the things in reach by what matters
    const marker = (d: Door) => list.find(x => x.door === d) ?? { kind: 'door' as const, pos: d.pos, line1: 'door', line2: '', inReach: true, off: false, door: d };
    if (pl.picking) { const d = pl.picking; rows = [running(marker(d), 'pick', `picking… ${Math.min(99, Math.round(d.pick * 100))}%  ·  Space or a step breaks off (the lock keeps it a moment)`, d.pick)]; }
    else if (pl.wanding) { const W = pl.wanding; rows = [running(marker(W.door), 'wand', W.live ? 'looking under it — the cursor turns the lens  ·  Space or a step pulls it out' : 'feeding the wand under…  ·  Space or a step pulls it out', WAND.quick ? undefined : W.live ? 1 : W.t / Math.max(0.01, WAND.feedSecs))]; }   // (WAND.quick: nothing left to count — no ring, no bar)
    else if (pl.coding) { const d = pl.coding; rows = [running(marker(d), 'code', `keying the ${g.devices.padOf(d) ? padDoorName(g.devices.padOf(d)!) : 'door'} code… — Space or a step breaks off`, pl.codeT / CODE_SECS)]; }
    else if (pl.kick) rows = [status(marker(pl.kick.door), pl.kick.tool ? (pl.kick.tool.kind === 'hammer' ? 'hammering it…' : 'on the lock…') : 'kicking it in…')];
    else if (pl.easing) { const d = pl.easing; rows = [running(marker(d), 'ease', 'easing it open… — Space or a step stops it where it is', Math.abs(d.angle) / EASE_MAX)]; }
    else if (m.driveT >= 0) { const it = list.find(x => x.kind === 'objective'); if (it) rows = [running(it, 'drive', `pulling… ${Math.min(99, Math.round(m.driveT / DRIVE_SECS * 100))}% — stay on it (Space or a step lets go)`, m.driveT / DRIVE_SECS)]; }
    else if (pl.charging) rows = [running(marker(pl.charging.door), 'charge', 'setting the charge… — Space or a step breaks it off', g.doorTools.samProgress)];
    else if (g.wallCharge?.setting) rows = [g.wallCharge.runningRow(running)];
    else if (g.defuse?.working) rows = [g.defuse.runningRow(running)];
    else if (!pl.takedown) {
      things.sort((a, b) => interactOrder(p)(a.it, b.it)); const flat0 = things.flatMap(t => { const v = t.verbs.filter(r => !r.verb || g.rails.offers(r.verb)); if (!v.length) t.it.framed = true; return v; });   // (rails.ts: a tutorial mission offers only the rows its steps teach — and a thing left with none is marked: interact.ts emptyWord)
      // (wand.ts: the look under a door is the one row that GIVES WAY — it is listed after every other thing's rows, so it never takes one of the MAX_NEAR from a
      // body, a wall charge or a second door that had it before the wand existed; alone at a door it is that door's third row)
      const flat = flat0.some(r => r.verb === 'wand') ? [...flat0.filter(r => r.verb !== 'wand'), ...flat0.filter(r => r.verb === 'wand')] : flat0;
      // (close.ts: a man's strike-only line has no verb — Space does nothing on it — so it sits UNDER the rows Space can do and never takes the default highlight from a door)
      const hint = closeLive(g) ? flat.filter(r => !r.verb).slice(0, 1) : [];
      // (owncharge.ts: a door charge by hand is ONE row past the MAX_NEAR — the nearest door's, under the rows Space had before it: it takes no row from
      // anything that had one and is never the row a bare tap gives unless it is the only one. The close-in hint, which no key gives, stays at the foot)
      // (bigkit.ts: the big slot's tool on a door that is NOT locked is one more such row — the nearest door's, last)
      // (stickycam.ts: a stuck camera's 'take it back' is one more such row, last of all)
      const isOwn = (r: Interactable) => r.kind === 'cam' || (r.kind === 'door' && (r.verb === 'charge' || !!r.past));
      const own = [...flat.filter(r => r.kind === 'door' && r.verb === 'charge').slice(0, 1), ...flat.filter(r => r.kind === 'door' && r.past).slice(0, 1), ...flat.filter(r => r.kind === 'cam').slice(0, 1)], rest = own.length ? flat.filter(r => !isOwn(r)) : flat;
      // (ownblow.ts: a charge his own hands set, wherever he stands — under the rows the things in reach had, so a tap gives it only when it is the only
      // thing to do, and ahead of the rows past the cap, so its wedge is never past the fourth)
      const blow = busy || pl.sprinting || pl.dragging ? null : ownBlowRow(g), mine = blow ? [blow] : [];   // (not while his hands or his feet are spoken for: a row that stood alone under a door being pushed would be what the next tap gave)
      const top = hint.length ? rest.filter(r => r.verb).slice(0, MAX_NEAR - 1) : rest.slice(0, MAX_NEAR), under = top.some(r => r.verb);   // (with no capped row to sit under, it goes under the rows past the cap instead: never the top row while another thing has one)
      rows = [...top, ...(under ? mine : []), ...own, ...(under ? [] : mine), ...hint];
    }
  }
  if (pl.listOpen && rows.some(r => r.verb && !r.running)) rows.push(cancelRow(g));   // the selector is open (Space held past a tap) over something to choose: its way out sits at the foot (interact.ts shuts it if nothing is left to choose)
  g.interactables = list;
  // The highlight (Player.nearSel) rides the list by identity: when the rows change (a man walks into reach, a verb ran and the thing now offers others) it stays
  // on the same row if that row is still there, else goes back to the top; ↑ / ↓ and the wheel-while-Space move it (interact.ts), the order never changes under it.
  // A running verb's row is NOT carried over into the list that comes back when it ends (done or stopped): the highlight returns to the top — the everyday verb —
  // rather than sitting on the choke / the ease that was just deliberately chosen and is over (a plain tap after easing off a choke asks him; it does not choke again).
  const key = rows.map(rowKey).join('|');
  if (key !== pl.nearKey) { pl.nearKey = key; const hv = g.hover; const keep = hv && !hv.running ? rows.findIndex(r => rowKey(r) === rowKey(hv)) : -1; pl.nearSel = keep >= 0 && !(rows[keep].kind === 'charge' && keep > 0 && !pl.sel.open) ? keep : 0; }   // (ownblow.ts: his own charge's row is everywhere he goes — the highlight never rides on it into a list where another thing has a row: the top row is the tap's there)
  g.nearby = rows; pickHover(g);
  if (CLOSE.on || pl.char.anim.ready || pl.char.anim.creep) closeTick(g);   // (close.ts: the mode and the knife — and let go of once the switch is off)
}
/** identity of a row: the thing and the verb (its wording may change under the highlight — the question row does with the talk — without being another row) */
export function rowKey(r: Interactable): string { return `${r.kind}:${r.door?.def.name ?? r.guard?.callsign ?? ''}:${r.verb ?? '~' + r.line2}`; }
/** Game.hover ← the highlighted row (nearSel wrapped onto the list), Game.useDoor ← its door if it is a door row in reach. interact.ts calls it again after moving the highlight. */
export function pickHover(g: Game) {
  const pl = g.player, rows = g.nearby;
  pl.nearSel = rows.length ? ((pl.nearSel % rows.length) + rows.length) % rows.length : 0;
  const best = rows[pl.nearSel] ?? null;
  g.hover = best; g.useDoor = best?.kind === 'door' && best.inReach && best.door ? best.door : null;
}
/** the selector's bottom row while it is open: letting go of Space on it does nothing (interact.ts) */
export function cancelRow(g: Game): Interactable { const p = g.player.char.pos; return { kind: 'cancel', pos: [p[0], 1.3, p[2]], line1: 'cancel', line2: 'let go here — nothing happens', inReach: true, off: false, verb: 'cancel', running: false }; }
/** The one ordering for 'what is offered near Sam' — the top-left panel (overlay.ts) and the default Space target read the same list in the same order:
 *  in reach before out of reach, then by what MATTERS (a man you could grab is perishable and decisive; a door will still be there), then nearest.
 *  Lower = higher up the list. Within one thing its verbs keep the order buildInteractables gave them; MAX_NEAR rows in all, so a man to grab beside a shut
 *  door reads [grab · push · ease] and the door's third verb (if it had one) would be the row that falls off. */
export const INTERACT_PRIORITY: Record<Interactable['kind'], number> = { guard: 0, held: 0, body: 1, objective: 2, door: 3, light: 9, breaker: 2.5, switch: 3.2, charge: 9.4, wall: 9.5, cam: 9.6, cancel: 10 };   // (wall: a partition's 'breach with a charge' row ranks last — it never takes one of the MAX_NEAR rows from a door, a body or a switch · charge: ownblow.ts's row is put after the capped rows by hand and is never ordered by this — its rank is only the table's)
/** how far a thing is from him, as its reach is measured: a door by its leaf or its doorway's centre, whichever is nearer */
export function thingDist(it: Interactable, p: Vec3): number { const d = v3.distXZ(it.pos, p); return it.door ? Math.min(d, v3.distXZ(it.door.frameCentre, p)) : d; }
export function interactOrder(p: Vec3): (a: Interactable, b: Interactable) => number {
  const dd = (it: Interactable) => thingDist(it, p);
  return (a, b) => (a.inReach !== b.inReach ? (a.inReach ? -1 : 1) : (INTERACT_PRIORITY[a.kind] - INTERACT_PRIORITY[b.kind]) || dd(a) - dd(b));
}
/** how far off an interaction's marker is still built (its dot, the held pair's door hints) before it is in reach */
export const NEARBY_M = 3.0;
/** the most verb rows the interaction list ever holds (the highest-priority available ones; the cancel row while the selector is open is extra) */
export const MAX_NEAR = 3;
/** Easing a leaf by hand (the 'ease' row — game.ts updateDoors runs it through Doors.crack): the rate it comes round at (rad/s — the crack rate it always had),
 *  how far it goes on its own before it counts as open (where a push would have left it: 3.2 rad/s coasting against the hinge friction ≈ 1.45), and how wide a
 *  leaf may already stand and still offer the row (shut, or a hand ajar). */
export const EASE_RATE = 0.55, EASE_MAX = 1.45, EASE_OFFER = 0.62;

export function throwCount(g: Game, kind: ThrowKind) { return kind === 'frag' ? g.player.frags : kind === 'flash' ? g.player.flashbangs : g.player.canisters; }
/** a thrown thing not yet out of the hand (or, under unlimited ammo, just out of it) goes back on the belt */
function canBack(pl: Player, kind: ThrowKind) { if (kind === 'frag') pl.frags++; else if (kind === 'flash') pl.flashbangs++; else pl.canisters++; }
/** a wind-up called off with the can still in his fist: the can is back on the belt and nothing leaves his hand (a grab, cancelActions; under throwback.ts
 *  every beat that stops the wind-up's clock, and a takedown). The swing already begun on the animator is left to play out or be overridden */
function throwOff(pl: Player) { if (pl.pendingThrow) { canBack(pl, pl.pendingThrow.kind); pl.pendingThrow = null; } }

/** F: let go of the body you are dragging (its ankles fall where they are), or take hold of the nearest one within reach. */
export function toggleDrag(g: Game, which?: Guard) {
  const pl = g.player;
  if (pl.dragging) { releaseBody(g); g.msg('body dropped'); return; }
  if (pl.down || pl.sprinting) return;
  let best: Guard | null = which && which.state === 'dead' ? which : null;
  if (!best) { let bd = 1.3; for (const gd of [...g.guards, ...civiliansShown(g)]) { if (gd.state !== 'dead' || gd.wound) continue; const d = bodyDist(g, gd, 1.3); if (d < bd) { bd = d; best = gd; } } }   // (a civilian on the floor is a body to haul like any)
  if (!best || !best.char.ragdoll) { g.msg('no body within reach'); return; }
  releaseWall(g);   // (you take hold of a body off the wall, crouched to it)
  pl.dragging = best; pl.crouch = true; pl.dragNoiseT = 0.3; pl.dragStuckT = 0; best.char.ragdoll.wake(); haulBegin(g, best); g.msg(pl.haul?.carry ? 'picking him up — Space puts him down, sprint drops him' : pl.haul?.end === 'head' ? 'got him under the arms — Space lets go, sprint drops him' : 'dragging the body — Space lets go, sprint drops it');
}

/** Let go of the body in tow: the ankle pins come off and its feet fall where they are (the soft thud of that; the HUD line is the caller's). */
function releaseBody(g: Game, laid = false) {
  const pl = g.player; if (!pl.dragging) return;
  const b = pl.dragging.char; b.ragdoll?.clearPins(); pl.dragging = null; pl.haul = null; pl.char.anim.haul = null;
  g.audio.play('bodyFall', b.bones.footL ?? b.pos, laid ? 0.12 : 0.3);   // (laid: hands.ts lowered it to the floor first — only the last inch is a fall)
}

/** Break off whatever the hands and feet are in the middle of that belongs to the SPOT, and stand ready: the kick (its door stays as it is), the pick (its progress
 *  stays on the door), a takedown that has not landed (he was only frozen for the beat: he carries on), a body in tow (dropped where it lies), a wind-up (the
 *  canister goes back on the belt), a door held. What a teleport needs — updateKick / updatePicking would otherwise reel you back to their door at 12 m a frame
 *  through every wall between, the cross would land on a man now rooms away, the body's ankles would come with you. A reload travels with you. The animator's
 *  one-shots (the kicking leg, the cross) play out their last fraction of a second where you arrive; nothing reads them any more (startKick waits for the leg). */
export function cancelActions(g: Game) {
  const pl = g.player, c = pl.char;
  releaseWall(g);                                             // the wall he had his back to is not where he is going
  if (pl.dragging) releaseBody(g);
  if (pl.holding) freeHeld(g, 'cancel');                      // the man in his arm stays where he is — free, and knowing everything
  pl.takedown = null;                                         // (a takedown that has not landed: he was only frozen for the beat — he carries on)
  if (pl.kick || pl.picking || pl.wanding || pl.easing || pl.coding || pl.sel.downT >= 0) pl.fHeld = true;   // a Space still down from what he was doing (or a press half made) is spent: it must come up before it arms again where he arrives (interact.ts clears this the first frame it is up)
  pl.kick = null; pl.picking = null; wandDrop(pl); c.anim.lockpick = false; if (pl.coding) stopCoding(g); samBigDrop(g);   // (bigkit.ts: the big slot's tool, in its beat or on its way back, is on him again)
  pl.easing = null; handsCancel(g); pl.sel.downT = -1; pl.sel.open = false; pl.sel.moved = false; pl.sel.ring = null; c.anim.doorPush = null;   // (the door hand: game.ts drops the record itself once he is carried out of the leaf's reach)
  throwOff(pl);   // not yet out of the hand: keep it
  pl.throwHeld = false; pl.throwPreview = null;
  pl.sprinting = false; pl.speedSm = 0; c.vel = [0, 0, 0];
}

/** Sandbox / tour / harness: stand the player at p (pushed out of whatever is there, snapped to the nearest walkable cell if that is inside something big or off the
 *  map, always inside the world), free of anything he was in the middle of (cancelActions). A body on the floor stays where it fell. */
export function teleportPlayer(g: Game, p: Vec3) {
  const pl = g.player; if (pl.down) return;
  if (!Number.isFinite(p[0]) || !Number.isFinite(p[2])) return;   // a bad target from a debug hook must not poison the position (NaN reaches the audio listener and throws)
  cancelActions(g);
  let q: Vec3 = [p[0], 0, p[2]];
  const settle = () => { g.col.clampToWorld(q, BODY_R); g.col.collideCircle(q, bodyR(g, q), 0.05, 2.2, 6); const t = v3.copy(q); return !g.col.collideCircle(t, bodyR(g, t), 0.05, 2.2, 1) || v3.distXZ(t, q) < 0.005; };   // pushed out of whatever is there — and did that converge (false: a gap the body cannot fit, the pushes just trade him back and forth)
  if (!settle() || g.col.nav.isBlocked(q[0], q[2])) {   // inside something big, in a gap too narrow for him, off the walkable floor: stand him on the nearest walkable cell instead
    const c = g.col.nav.nearestFreePoint(q[0], q[2]); if (c) { q = c; settle(); }
  }
  g.col.clampToWorld(q, BODY_R);
  pl.char.pos = q; pl.safe = [q[0], 0, q[2]];      // (a teleport is the one move the collision sweep must not walk him through: it starts afresh from here)
  pl.char.update(0);                               // bones at the new spot now: the capsules, the light meter query and the cursor's markers this frame must not read the old room
  g.note('teleported');
}
