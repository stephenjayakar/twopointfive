// The aim-settle model (playtest note, 08-08: "guards have really good aim … some time for them to acquire a target, line up a shot, and some penalties when the
// target is moving, even heavier penalties when THEY are moving. same goes for us"). ONE rule for both sides, every number a knob (Tab ▸ Sandbox ▸ aim …,
// remembered per machine), the player's half of it drawn on his own reticle, all of it behind Game.tune.aimModel (off = every round exactly what it was).
//
//   TRACK    each shooter carries a `track` 0‥1 on his target: it climbs at 1/settleSecs (quicker inside rangeRef metres, in proportion — the target fills the
//            sights — floored at × nearK) while he has the target in sight AND his gun on it, drains fast when the gun is off it, HOLDS through a blink
//            (memSecs) and is gone after that or when the target's bearing jumps (a teleport, a man out of a smoke bank somewhere else): he acquires again from
//            nothing. A guard cannot settle past movingTrackCap on the move (stopToShoot), Sam past sprintCap at a sprint / walkCap walking; crouched he settles
//            a little quicker. The cone is × lerp(unsettledK, 1, track).
//   GATE     a guard lets no round go under acquireMin of track (after his reaction beat: reaction first, then acquisition) — a burst is gated at its start,
//            not round by round. Choreographed men (the tour's pinned posts, a script) are put there already on him: track 1. A man who plants first and
//            fires lined up plants on hair-lines a man firing on arrival never stood on: two rounds into the frame a hand off his muzzle (or into anything on
//            his own half of the line) and that spot is no line (noteBore / boreFouled → the alert branch's `blocked`), he steps for a real one.
//   TARGET   the target's ANGULAR speed across the shooter (its own velocity square to the line of sight over the range, rad/s, smoothed — not the sweep a
//            shooter circling a planted man makes for himself): a man crossing at a sprint eight metres off is hard, the same man running straight up the
//            bore is not. This is what the row's linear moveK meant; with the model on it replaces it.
//   SHOOTER  his own feet: rad of cone per m/s. Heavier than the target's — and the reason a closing guard now brakes to a standstill for each shot inside
//            his shoot band and closes again on the beat (guards.ts, aimBrake), and Sam's ring blooms while he moves.
//   Guard round = (row base + range term) × settle + target + shooter + suppression (+ burst growth); Sam's = base(stand / crouch) × settle + target + shooter
//   + his suppression term (player.ts adds the two). The composition lives here (guardRound / playerAim); the fire sites only ask.
import { Vec3, v3, clamp, lerp, wrapAngle, DEG } from '../math/vec';
import { playerGroundVel } from './guards';
import type { Game, Guard } from './game';
import type { FireOpts } from './combat';
import { AIMCOST, feetHold } from './aimcost';   // (a leaf: a lamp needs a real hit, moving feet cost the shot)
import { foeChar, foeDown } from './teams';

/** screen-space reach of the auto-aim onto a MAN's chest, CSS px (player.ts updateAim; a light's is AIM.player.lightSnapPx, never more than this) */
export const SNAP_PX = 60;
/** Every number, both sides (panel-tunable; the QA probes read them rather than copy them). AIM_DEFAULTS keeps the shipped values for the revert dots / 'defaults'. */
export const AIM = {
  guard: {
    /** s from nothing to fully lined up (track 0 → 1), eyes on him and the gun on him throughout — at rangeRef metres and beyond; nearer, the man fills the
     *  sights and it goes quicker in proportion (× dist / rangeRef, no quicker than × nearK: at arm's length there is nothing to line up, he points and fires) */
    settleSecs: 1.3, rangeRef: 8, nearK: 0.25,
    /** the first-shot gate: no round under this much track — 0.55 × 1.3 s ≈ 0.7 s of lining up after the reaction beat before the first one goes */
    acquireMin: 0.55,
    /** × the row's cone at track 0 (→ ×1 at track 1): the rounds of a man who has only just found you go wide, then they settle */
    unsettledK: 3.0,
    /** 'the gun on him': facing error under this many degrees for the track to climb (the fire gate itself has always been 14°) */
    onDeg: 18,
    /** /s the track drains while he has Sam in sight but the gun is off him (turning onto him, legs carrying the aim clamp away) */
    loseRate: 3.0,
    /** eyes off Sam up to this long and the track holds (a mullion, a blink of smoke); longer and it is gone — he acquires again from nothing */
    memSecs: 0.6,
    /** Sam's bearing jumping more than this in one frame (a teleport, the tour's cuts) is a new target: track 0, and the rate below is not fed the jump */
    jumpDeg: 25,
    /** rad of cone per rad/s of Sam's own angular speed across him (his velocity square to the line, over the range), capped: a man crossing at a sprint 7 m off
     *  is ~0.65 rad/s → +0.24, i.e. the gun wanders a sixth of a second either side of him (the cone is ± half: K = twice the lag) — a third of those rounds still
     *  find him, against four in five today; running straight up the bore adds nothing (measured: tools/qa aim-motion) */
    targetMoveK: 0.36, targetMoveCap: 0.26,
    /** s, smoothing of that rate */
    rateTau: 0.15,
    /** rad of cone per m/s of his OWN feet (the chase's 2.7 m/s → +0.27: nothing aimed leaves a running man); what he was doing OVER a walking pace (steadyPace)
     *  is remembered feetTau seconds — a man who has just skidded to a halt out of a run is still off balance for a round or two, one who stops out of a walk (the
     *  standoff's side-step, a patrol) is steady at once (the term reads max(now, remembered − steadyPace)) */
    shooterMoveK: 0.10, feetTau: 0.5, steadyPace: 1.3,
    /** m/s: moving faster than this his track cannot pass movingTrackCap — under acquireMin, so he plants to shoot */
    stopToShoot: 1.2, movingTrackCap: 0.5,
    /** closing on Sam with a line and him inside this many metres, the gun about ready (fireCd under brakeLead s, or a burst begun): brake to a standstill,
     *  let the round go once the track is there, close again on the weapon's beat — the plain fight's hold-and-fire inside 9 m is untouched */
    shootBand: 14, brakeLead: 0.45,
  },
  player: {
    /** s to settle fully (at rangeRef metres off what he is pointing at, quicker nearer by the guards' rule); × the cone unsettled; /s it drains with the gun off the man */
    settleSecs: 0.8, rangeRef: 8, nearK: 0.25, unsettledK: 2.2, loseRate: 3.0,
    /** rad: his own two hands, settled, standing / crouched (± a third of a degree: 8 cm at 12 m — a torso every time, a head shot asks him to hold still) */
    baseStand: 0.012, baseCrouch: 0.008,
    /** the man under his reticle crossing HIS view: rad per rad/s (a guard jogging across 7 m off ≈ 0.4 rad/s → +0.08), capped; smoothing; a jump this big is a new target */
    targetMoveK: 0.20, targetMoveCap: 0.16, rateTau: 0.15, jumpDeg: 25,
    /** rad of cone per m/s of his own feet: the walk's 1.55 m/s → +0.12 (a torso at 8 m half the time), the creep a third of that; what he was doing over a
     *  walking pace (steadyPace) is remembered feetTau seconds — a sprint stop blooms the ring (4.7 m/s → +0.38) and it drains over the better part of a
     *  second: catch your breath, then shoot; stopping out of a walk costs nothing past the stop */
    shooterMoveK: 0.08, feetTau: 0.6, steadyPace: 1.7,
    /** the track cannot pass this at a sprint (the gun is down anyway: it is where he starts from when he stops) / with his feet moving at all; crouched it climbs × crouchK */
    sprintCap: 0.3, walkCap: 0.7, movingAbove: 0.3, crouchK: 1.15,
    /** CSS px: the reticle takes a LIGHT (a fixture, the breaker, a camera) only with the cursor this near its dot — about the light itself — or on the fixture's
     *  own drawn box (player.ts updateAim). SNAP_PX = the reach it had, the same as onto a man's chest (which also caps it); 0 = only a drawn fixture under the cursor */
    lightSnapPx: 14,
    /** 1 = with nothing under the reticle (no man, no fixture) his gun, its light and his rounds are LEVEL along the cursor's heading at the height he carries it
     *  (player.ts levelOn / freeAim); 0 = on the world point under the cursor, floor included, as it was (two metres out: the muzzle and his trunk pitched at the ground) */
    level: 1,
    /** 1 = a man under the reticle who is LOW (head down under fire, on a knee, doubled over a flash on top of either) is aimed at where he is — the round and
     *  the gun's pitch go to his posed chest (player.ts manAim); 0 = at a standing man's chest over his feet whatever his pose, as it was (the gun level on a
     *  crouched man and every round over his head). A man on his feet is aimed at the same either way. Written by the page's boot (host/profile.ts pageSwitches:
     *  ?noaimlow = 0) and by the harness's frozen stand (0); never kept per machine. */
    low: 1,
  },
};
export type AimKnobs = typeof AIM;
export const AIM_DEFAULTS: AimKnobs = JSON.parse(JSON.stringify(AIM));
/** A TRAINED man's edge (Guard.trained — the response team, game/qrf.ts; nobody else carries it, so the staff's numbers are the numbers above to the letter):
 *  he lines up in settleK × the settle time (so his first round comes that much sooner past his reaction beat), his hands are spreadK × his row's cone, and
 *  qrf.ts caps his reaction beats at reactCap seconds (a dazzle or a ring in the body still roots him its full length). */
export const TRAINED = { settleK: 0.6, spreadK: 0.7, reactCap: 0.45 };

/** seconds since the last real sighting under which he 'has him in sight now' (perception stamps lastSeenT the frame it sees him; scripts that fake sight stamp it a frame ahead) */
const LOS_NOW = 0.05;

/** Per shooter (Guard.aim / Player.aim): the track and what it is on, the bearing bookkeeping behind the target-motion term, and the last round's numbers for the
 *  panel / the QA soak. Dies with the Guard / Player (restart, resetGuards). */
export class AimState {
  /** 0‥1: how lined-up he is on the target */
  track = 0;
  /** what the track is on: 'sam' for a guard; `g<id>` (a man under the reticle) or 'free' for the player — a new man is a new track */
  tgtKey = '';
  /** shooter → target bearing last frame (NaN = none yet: the jump test) and the target's angular rate across the shooter — its OWN velocity square to the line
   *  over the range, smoothed (rad/s): what the target term reads */
  lastBearing = NaN; bearingRate = 0;
  /** his own ground speed remembered over feetTau (m/s): the feet term reads max(now, this − steadyPace), so a skid to a halt out of a run still costs the next round or two */
  speedSm = 0;
  /** the fastest his feet have gone, let go over AIMCOST.stopTau (m/s; aimcost.ts — 0 while that rule is off): stopping does not clear the cone on the frame */
  moveSm = 0;
  /** player: the last man the reticle left and when — back onto the SAME man inside a third of a second (the snap letting go for a frame at its edge) keeps the track */
  lastMan = ''; leftT = -100;
  /** the track he had on `lastMan` as he left it (aimcost.ts: given back if he is straight back on it across a lamp) */
  leftTrack = 0;
  /** guard: planted for a shot in the shoot band this frame (aimBrake said so) — the panel / probes read it */
  braking = false;
  /** guard: his last round(s) went into the frame a hand off the muzzle (noteBore) — how many running, and from where; two and that spot is no line (boreFouled) */
  fouled: { n: number; pos: Vec3 } | null = null;
  /** the last round this shooter let go through the model: when, the track and total cone it went with, his own ground speed, whether the first-shot gate
   *  applied to it (a single round / the first of a burst: yes; the rest of a burst: no), and the terms (panel) */
  lastShot: { t: number; track: number; spread: number; speed: number; gated: boolean; hands: number; settle: number; tgt: number; own: number } | null = null;
  clear() { this.track = 0; this.tgtKey = ''; this.lastBearing = NaN; this.bearingRate = 0; this.speedSm = 0; this.moveSm = 0; this.braking = false; this.fouled = null; this.lastMan = ''; this.leftT = -100; this.leftTrack = 0; }
}
/** remember the feet: speedSm eased toward the ground speed over tau */
/** are the two aimcost.ts rules in force for this game? (never under a show: the tour, a showcase and the attract reel were staged without them) */
const moveCost = (g: Game) => AIMCOST.move && !g.touring;
const lampCost = (g: Game) => AIMCOST.lamp && !g.touring;
/** (`hold` = the speed the REMEMBERED feet are fed: the player's is the lesser of the ground he covered and the pace he asked for, so a step the game
 *  takes for him — out round a corner, up to a keypad, a teleport — is not a sprint his hands remember) */
function feedFeet(A: AimState, speed: number, dt: number, tau: number, on: boolean, hold = speed) {
  A.speedSm += (speed - A.speedSm) * (1 - Math.exp(-dt / Math.max(tau, 1e-3)));
  if (!Number.isFinite(A.speedSm) || A.speedSm < 1e-4) A.speedSm = 0;
  A.moveSm = on ? feetHold(A.moveSm, hold, dt) : 0;
}
/** what the feet term reads for this shooter right now (m/s): his ground speed, or what he remembers doing over a walking pace if that is more */
function feetOf(A: AimState, vel: readonly number[], steadyPace: number, on: boolean): number {
  const f = Math.max(Math.hypot(vel[0], vel[2]), A.speedSm - steadyPace);
  return on ? Math.max(f, A.moveSm) * AIMCOST.moveK : f;   // (aimcost.ts: the feet he remembers — while he moves that IS his pace, so the walking-pace allowance above no longer spares a walk — and twice the price)
}

/** Lane hooks: `playerExternalK` multiplies Sam's model cone (the rifle lane's brace wires × its steadiness here; 1 = nothing). */
export const AIM_HOOKS: { playerExternalK: (g: Game) => number } = { playerExternalK: () => 1 };
/** QA hook: set `log` and every reset / gate / brake decision says what it did */
export const AIM_DEBUG: { log: ((s: string) => void) | null } = { log: null };

/** Feed one frame of the target into the shooter's bookkeeping: the bearing (for the jump test — a new target) and the rate the target term reads, which is the
 *  TARGET's own velocity square to the line of sight over the range (rad/s), smoothed over tau — his motion, not the apparent sweep a shooter side-stepping round
 *  a planted man makes for himself (his own feet are the feet term's). Returns true if the bearing jumped (the rate zeroed, not fed the jump). */
function feedTarget(A: AimState, from: Vec3, at: Vec3, vel: readonly number[], dt: number, jumpDeg: number, tau: number): boolean {
  const dx = at[0] - from[0], dz = at[2] - from[2]; const dist = Math.hypot(dx, dz);
  const brg = Math.atan2(dx, dz);
  let jumped = false;
  if (Number.isFinite(A.lastBearing) && Math.abs(wrapAngle(brg - A.lastBearing)) > jumpDeg * DEG) { jumped = true; A.bearingRate = 0; }
  else {
    const omega = dist > 1e-3 ? Math.abs(vel[0] * dz - vel[2] * dx) / dist / Math.max(dist, 0.5) : 0;   // |v ⟂ line| / range
    A.bearingRate += (omega - A.bearingRate) * (1 - Math.exp(-dt / Math.max(tau, 1e-3)));
  }
  A.lastBearing = brg;
  if (!Number.isFinite(A.bearingRate) || A.bearingRate < 0) A.bearingRate = 0;
  return jumped;
}

// ================================================================ guards
/** Once a frame per living, free, unscripted guard (guards.ts updateGuard, after perception and the state transitions, before the behaviour): the bearing to
 *  Sam's trunk and its rate, and the track — 1 outright for a choreographed man (pinned); gone when Sam has been out of his sight past memSecs, is down, or
 *  his bearing jumped; climbing while he is alert, past his reaction beat, not dazzled, has him now and the gun is within onDeg of him (capped on the move);
 *  draining with the gun off him; held through a blink. With the model off it rests at 0 and nothing reads it. SIDES (teams.ts): the target is his FOE — Sam
 *  for the staff, letter for letter what it was; a hostile AI man for a unit, keyed by who that is so a change of man is a track from nothing; no foe, no track. */
export function trackGuard(g: Game, gd: Guard, dt: number) {
  const A = gd.aim, P = AIM.guard, c = gd.char, pc = foeChar(g, gd);
  A.braking = false;
  if (!g.tune.aimModel || gd.state === 'dead') { A.clear(); return; }
  if (!pc) { A.clear(); return; }   // (a unit with nobody yet: nothing to line up)
  const speed = Math.hypot(c.vel[0], c.vel[2]); feedFeet(A, speed, dt, P.feetTau, moveCost(g));
  const key = gd.foe === 'player' ? 'sam' : `u${pc.id}`;
  if (A.tgtKey !== key) { if (A.tgtKey) { A.track = 0; A.lastBearing = NaN; A.bearingRate = 0; } A.tgtKey = key; }   // (a NEW man under the gun: acquire him from nothing — the staff's key is 'sam' from the first frame and never anything else)
  const trunk = pc.bones.spine2 ?? pc.bones.hips ?? pc.pos;
  const brg = Math.atan2(trunk[0] - c.pos[0], trunk[2] - c.pos[2]);
  const tvel = gd.foe === 'player' ? playerGroundVel(g) : pc.vel;   // Sam's motion OVER THE GROUND (guards.ts, sampled once a frame), not the pace his keys command: held against a desk or a shut leaf with W down he is standing still, and reads so (review 08-10 #5: hugging a wall at a 'sprint' made every man miss)
  const jumped = feedTarget(A, c.pos, trunk, tvel, dt, P.jumpDeg, P.rateTau);   // (a man held in his arm walks at the pair's pace, a teleport zeroes it and jumps the bearing)
  if (gd.pinned && !gd.skill) { A.track = 1; return; }   // the beat put him there already on his mark (the tour's posts fire on cue; so does the harness's planted man)
  const sinceSeen = g.time - gd.lastSeenT; const down = foeDown(g, gd);
  if (jumped && A.track > 0) { AIM_DEBUG.log?.(`#${c.id} ${gd.callsign}: bearing jumped — track ${A.track.toFixed(2)} → 0`); A.track = 0; }
  if (sinceSeen > P.memSecs || down) { if (A.track > 0) AIM_DEBUG.log?.(`#${c.id} ${gd.callsign}: ${down ? 'player down' : `out of sight ${sinceSeen.toFixed(2)} s`} — track ${A.track.toFixed(2)} → 0`); A.track = 0; return; }
  if (sinceSeen >= LOS_NOW) return;   // a blink: hold what he has
  const facingErr = Math.abs(wrapAngle(brg - c.gunYaw));   // (gunYaw: aimYaw — or, turning under weight (character.ts TURN), where the gun has got to)
  const dist = v3.distXZ(c.pos, pc.pos);
  const onTol = P.onDeg * DEG + Math.atan2(0.35, Math.max(dist, 0.3));   // 'the gun on him' widens by the angle half a body subtends: at arm's length a crouched man's trunk bone sits a hand off his root and 25° off the
                                                                          // bearing the chest is turned to — measured to the degree, a man 0.7 m off in a doorway was never 'on' and never fired (soak seed 2, the QRF at its own door, 08-12); at 8 m it adds 2.5°
  const on = gd.state === 'alert' && gd.reactT <= 0 && g.time >= gd.dazzledUntil && facingErr < onTol;
  const cap = (moveCost(g) ? Math.max(speed, A.moveSm) > Math.min(P.stopToShoot, AIMCOST.plantAt) : speed > P.stopToShoot) ? P.movingTrackCap : 1;   // (aimcost.ts: his own plant-to-shoot bar, asked of the feet he REMEMBERS — out of a run he waits a third of a second longer; at a walk he shoots as ever, wider)
  if (on) A.track = Math.min(cap, A.track + dt / (settleTime(P, dist) * (gd.skill ? gd.skill.settleK : gd.trained ? TRAINED.settleK : 1)));   // (a trained man lines up quicker: TRAINED)
  else A.track = Math.max(0, Math.min(cap, A.track - P.loseRate * dt));
}
/** seconds to settle fully at this range: settleSecs at rangeRef and beyond, × dist / rangeRef nearer (the target fills the sights), floored at × nearK */
function settleTime(P: { settleSecs: number; rangeRef: number; nearK: number }, dist: number): number {
  return Math.max(P.settleSecs, 1e-3) * clamp(dist / Math.max(P.rangeRef, 0.1), P.nearK, 1);
}

/** The first-shot gate (the alert branch's single round, the START of a burst, the standoff's round): true with the model off. */
export function aimReady(g: Game, gd: Guard): boolean { return !g.tune.aimModel || gd.aim.track >= AIM.guard.acquireMin - 1e-9; }
/** The standoff's flank round only (guards.ts): under AIMCOST.move, are the feet he remembers still enough for a round threaded past his own man?
 *  True with the rule off — the round goes as it always did. */
export function feetSettled(g: Game, gd: Guard): boolean { return !moveCost(g) || gd.aim.moveSm <= AIMCOST.flankAt; }
/** the panel / marker tell: an alert man whose track on Sam has passed the gate */
export function guardAcquired(g: Game, gd: Guard): boolean { return g.tune.aimModel && gd.state === 'alert' && gd.aim.track >= AIM.guard.acquireMin - 1e-9; }

/** the terms of a guard's cone under the model (his row less its linear target-speed term, × settle, + the bearing rate's, + his feet's) — `extra` rides outside the multiplier */
function guardTerms(g: Game, gd: Guard, extra: number) {
  const A = gd.aim, P = AIM.guard, c = gd.char;
  const S = gd.weapon.def.aiSpread; const range = v3.dist(c.pos, (foeChar(g, gd) ?? g.player.char).pos);   // (teams: the range to the man he is firing at — Sam for the staff)
  const hands = (S.base + Math.max(0, range - S.rangeFrom) * S.rangeK) * (gd.skill ? gd.skill.spreadK : gd.trained ? TRAINED.spreadK : 1);   // (steadier hands on a trained man: TRAINED; a man in a room fight carries his side's row — roomfight.ts FIGHT_SKILL)
  const settle = lerp(P.unsettledK, 1, clamp(A.track, 0, 1));
  const tgt = Math.min(P.targetMoveCap, A.bearingRate * P.targetMoveK);
  const speed = Math.hypot(c.vel[0], c.vel[2]); const own = feetOf(A, c.vel, P.steadyPace, moveCost(g)) * P.shooterMoveK;
  return { hands, settle, tgt, own, speed, spread: hands * settle + tgt + own + extra };
}
/** What to hand fireWeapon for this guard's round: with the model off, `{ spread: extra }` — the call as it always was (his row's hands are added inside); on, the
 *  whole cone composed here and `steady` so fireWeapon adds nothing of its own. `extra` = what the site already adds today (suppression's cone, a burst's growth).
 *  `gated`: whether the first-shot gate stood in front of this round (recorded for the soak). Stamps aim.lastShot. */
export function guardRound(g: Game, gd: Guard, extra: number, gated = true): FireOpts {
  if (!g.tune.aimModel) return { spread: extra };
  const T = guardTerms(g, gd, extra);
  gd.aim.lastShot = { t: g.time, track: gd.aim.track, spread: T.spread, speed: T.speed, gated, hands: T.hands, settle: T.settle, tgt: T.tgt, own: T.own };
  return { spread: T.spread, steady: true };
}
/** The whole cone a guard's round is drawn from, for the burst's look down the bore past a colleague (guards.ts burstTrigger): the row's own line with the model
 *  off (the expression it always was), the model's composition on. `extra` = the burst's growth. */
export function handsCone(g: Game, gd: Guard, extra: number): number {
  if (!g.tune.aimModel) { const S = gd.weapon.def.aiSpread, tc = foeChar(g, gd) ?? g.player.char; return S.base + Math.min(S.moveCap, Math.hypot(tc.vel[0], tc.vel[2]) * S.moveK) + Math.max(0, v3.dist(gd.char.pos, tc.pos) - S.rangeFrom) * S.rangeK + extra; }   // (teams: off his foe — Sam's numbers for the staff, as fireWeapon's own line reads them)
  return guardTerms(g, gd, extra).spread;
}
/** Stop to shoot (the alert branch's closing run): model on, a free man with a line (`blocked` false), Sam inside the shoot band and in his sight this moment, not
 *  yet settled, and the gun about ready (or a burst already begun) → the caller brakes him to a standstill instead of running the path; the round goes when the
 *  track gets there and the run picks up again on the weapon's beat. Head-down / the shift to cover never reach the closing run; the standoff has its own feet. */
export function aimBrake(g: Game, gd: Guard, dist: number, blocked: boolean): boolean {
  const P = AIM.guard, A = gd.aim;
  const brake = g.tune.aimModel && !gd.pinned && !blocked && dist <= P.shootBand && g.time - gd.lastSeenT < LOS_NOW && A.track < 1 && gd.reloadT < 0 && (gd.fireCd <= P.brakeLead || !!gd.weapon.burst);
  if (brake && !A.braking) AIM_DEBUG.log?.(`#${gd.char.id} ${gd.callsign}: brakes to shoot at ${dist.toFixed(1)} m (track ${A.track.toFixed(2)}, fireCd ${gd.fireCd.toFixed(2)}, ${Math.hypot(gd.char.vel[0], gd.char.vel[2]).toFixed(2)} m/s)`);
  A.braking = brake;
  return brake;
}

/** metres of flight under which a round that stopped in geometry (well short of what it was sent at) went into the frame beside his own face — the least reach of
 *  the rule; further out it is HIS HALF of the line (below) */
const BORE_FOUL_M = 1.2;
/** Fed the round this guard has just let go (guards.ts, straight after fireWeapon: the guardShot event it pushed carries muzzle → where the round stopped): one
 *  that died well short of `aimAt` in geometry inside BORE_FOUL_M of the muzzle — or anywhere on his own half of the line — went into the jamb / the mullion /
 *  the leaf / the corner he stands at: the line his SHOULDER clears (clearShot) but his muzzle, that hand further out and round, does not. What stops a round on
 *  HIS half is his position's doing and the answer is a step or the doorway (boreFouled → the alert branch's `blocked`); what stops one on the far half is the
 *  man's cover, and the head over it stays the target. Counted per spot; a round that flies true wipes it. Model off: nothing. (Why it is the model's business:
 *  today's man mostly fires while still arriving and gets away with it; one who plants first and fires lined up plants on exactly these hair-lines and, without
 *  this, empties magazines into the frame — tools/qa aim-door-sweep found eleven such doorways at a hand off the muzzle, and one more, the conference door taken
 *  on the slant from four metres up the corridor, whose far jamb ate every round 1.6 m out until the reach was his half of the line rather than a fixed hand.) */
export function noteBore(g: Game, gd: Guard, aimAt: Vec3) {
  if (!g.tune.aimModel) return;
  const e = g.events[g.events.length - 1]; if (!e || e.kind !== 'guardShot' || e.time !== g.time || !e.from || !e.to) return;
  const A = gd.aim; const flew = v3.dist(e.from, e.to), wanted = v3.dist(e.from, aimAt);
  if (flew < Math.min(Math.max(BORE_FOUL_M, 0.5 * wanted), wanted - 0.6)) {
    if (A.fouled && v3.distXZ(A.fouled.pos, gd.char.pos) < 0.5) A.fouled.n++; else A.fouled = { n: 1, pos: v3.copy(gd.char.pos) };
    AIM_DEBUG.log?.(`#${gd.char.id} ${gd.callsign}: round into the frame ${flew.toFixed(2)} m out (${A.fouled.n} from this spot)`);
  } else A.fouled = null;
}
/** Two rounds running into the frame from where he stands: that spot is no line, whatever the shoulder's ray says — the alert branch reads it as `blocked` (he
 *  closes / steps for a real one) until he is half a metre off it. False with the model off. */
export function boreFouled(g: Game, gd: Guard): boolean {
  const F = gd.aim.fouled; if (!g.tune.aimModel || !F) return false;
  if (v3.distXZ(F.pos, gd.char.pos) > 0.5) { gd.aim.fouled = null; return false; }
  return F.n >= 2;
}

// ================================================================ the player
/** Once a frame (game.ts update, right after updateAim has said what the reticle is on): Sam's track on the man under it — or on nothing in particular ('free':
 *  a wall, a fixture) — reset when a NEW man comes under it (free → man, man → another; off a man onto the floor beside him it carries), capped at a sprint / on
 *  the move, quicker crouched; and the bearing rate of that man across his view. Rests at 0 with the model off or Sam down. */
export function trackPlayer(g: Game, dt: number) {
  const pl = g.player, A = pl.aim, P = AIM.player, c = pl.char;
  if (!g.tune.aimModel || pl.down) { A.clear(); return; }
  const gv = playerGroundVel(g); const speed = Math.hypot(gv[0], gv[2]); feedFeet(A, speed, dt, P.feetTau, moveCost(g), Math.min(speed, Math.hypot(c.vel[0], c.vel[2])));   // (his feet by the ground he actually covers — review 08-10 #5)
  const tg = g.aimGuard && g.aimGuard.state !== 'dead' ? g.aimGuard : null;
  const lt = !tg && lampCost(g) ? g.aimTarget : null;   // (aimcost.ts: a lamp under the reticle is a thing to settle on, like a man — `l<name>`; the rule off, a lamp is 'free' floor as it was)
  const key = tg ? `g${tg.char.id}` : lt ? `l${lt.name}` : 'free';
  if (key !== A.tgtKey) {
    const back = key === A.lastMan && g.time - A.leftT < 0.35, was = A.tgtKey, had = A.track;
    if (lt && !back) A.track = 0;   // a NEW lamp under it: settle on it from nothing
    if (tg && !back) { if (A.track > 0) AIM_DEBUG.log?.(`Player: reticle onto #${tg.char.id} (${A.tgtKey || '—'} → ${key}) — track ${A.track.toFixed(2)} → 0`); A.track = 0; }   // a NEW man under it: acquire him from nothing
    if (back && was.startsWith('l') && lampCost(g)) A.track = Math.max(A.track, A.leftTrack);   // straight back onto the one he just left — across a lamp that took the track to nothing on the way — he has what he had
    // off a man onto the floor beside him: the track carries, and coming straight back to him keeps it. (aimcost.ts: off a lamp the same; and off a man
    //  ONTO a lamp the man is remembered too — a reticle that crosses a lamp for a frame on its way back to him has not lost him)
    if (was.startsWith('l') || was.startsWith('g') && (!tg || !!lt)) { A.lastMan = was; A.leftT = g.time; A.leftTrack = had; }
    A.tgtKey = key; A.lastBearing = NaN; A.bearingRate = 0;
  }
  const T: Vec3 = tg ? (tg.char.bones.chest ?? v3.add(tg.char.pos, [0, 1.2, 0])) : lt ? lt.pos : g.aimPoint;   // the man's chest, else the point under the cursor
  if (tg) {
    if (feedTarget(A, c.pos, T, tg.char.vel, dt, P.jumpDeg, P.rateTau) && A.track > 0) { AIM_DEBUG.log?.(`Player: #${tg.char.id}'s bearing jumped — track → 0`); A.track = 0; }   // (the man's own feet across Sam's line: a body on the floor, a man planted, is no crossing target however Sam circles him)
  } else { A.lastBearing = NaN; A.bearingRate = 0; }   // a wall does not run
  const cap = pl.sprinting && speed > P.movingAbove ? P.sprintCap : speed > P.movingAbove ? P.walkCap : 1;   // (a 'sprint' into a wall covers no ground: no sprint cap for standing still)
  const rate = (pl.crouch ? P.crouchK : 1) / settleTime(P, v3.distXZ(c.pos, T));
  A.track = Math.min(cap, A.track + rate * dt);   // (on target whenever there is one: the reticle IS on him, or on the point; the caps do the rest)
}
/** Sam's cone under the model and his track (the overlay sizes and tints the ring off these): 0 / 1 with the model off, and under the tour's puppet (its scripted
 *  double-taps land, as suppression's term already has it). */
export function playerAim(g: Game): { spread: number; track: number; base: number; settle: number; tgt: number; own: number } {
  if (!g.tune.aimModel || g.puppet) return { spread: 0, track: 1, base: 0, settle: 1, tgt: 0, own: 0 };
  const pl = g.player, A = pl.aim, P = AIM.player, c = pl.char;
  const base = pl.crouch ? P.baseCrouch : P.baseStand;
  const settle = lerp(P.unsettledK, 1, clamp(A.track, 0, 1));
  const tgt = Math.min(P.targetMoveCap, A.bearingRate * P.targetMoveK);
  const own = feetOf(A, c.vel, P.steadyPace, moveCost(g)) * P.shooterMoveK;
  const k = AIM_HOOKS.playerExternalK(g); const kk = Number.isFinite(k) ? Math.max(0, k) : 1;
  if (moveCost(g)) return { spread: (base * settle + tgt) * kk + own * lerp(kk, 1, clamp(1 - AIMCOST.braceFeet, 0, 1)), track: A.track, base, settle, tgt, own };   // (aimcost.ts: a braced rifle is steady, the legs under it are not — the brace reaches only part of the feet term)
  return { spread: (base * settle + tgt + own) * kk, track: A.track, base, settle, tgt, own };
}
/** The one term Sam's fire sites add to their spread (player.ts, beside samSpread): 0 with the model off / under the puppet. Stamps aim.lastShot. */
export function samAim(g: Game): number {
  const R = playerAim(g); if (!g.tune.aimModel || g.puppet) return 0;
  const pl = g.player; pl.aim.lastShot = { t: g.time, track: R.track, spread: R.spread, speed: Math.hypot(pl.char.vel[0], pl.char.vel[2]), gated: false, hands: R.base, settle: R.settle, tgt: R.tgt, own: R.own };
  return R.spread;
}

// ================================================================ persistence (the two knob groups, one key, per machine — the way the crouch-speed slider is kept)
const LS_KEY = 'twopointsix.aim';
const KEPT: { guard: (keyof AimKnobs['guard'])[]; player: (keyof AimKnobs['player'])[] } = {
  guard: ['settleSecs', 'acquireMin', 'unsettledK', 'targetMoveK', 'shooterMoveK', 'stopToShoot'],
  player: ['settleSecs', 'unsettledK', 'targetMoveK', 'shooterMoveK', 'lightSnapPx', 'level'],   // (`low` is not kept: the page's boot writes it — host/profile.ts pageSwitches, ?noaimlow)
};
/** write the kept knobs to localStorage (the panel calls it on every change) */
export function saveAim() {
  try {
    const out: Record<string, Record<string, number>> = { guard: {}, player: {} };
    for (const k of KEPT.guard) out.guard[k] = AIM.guard[k]; for (const k of KEPT.player) out.player[k] = AIM.player[k];
    localStorage.setItem(LS_KEY, JSON.stringify(out));
  } catch { /* no storage (the harness, a locked-down page): nothing to keep */ }
}
/** read them back (once, at module load): only finite numbers in a sane range are taken */
export function loadAim() {
  try {
    const j = JSON.parse(localStorage.getItem(LS_KEY) ?? 'null'); if (!j || typeof j !== 'object') return;
    const take = <T extends Record<string, number>>(dst: T, src: unknown, keys: (keyof T)[]) => { if (!src || typeof src !== 'object') return; for (const k of keys) { const v = (src as Record<string, unknown>)[k as string]; if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= (k === 'lightSnapPx' ? SNAP_PX : 20)) (dst as Record<string, number>)[k as string] = v; } };
    take(AIM.guard, j.guard, KEPT.guard); take(AIM.player, j.player, KEPT.player);
  } catch { /* nothing stored, or not readable: the shipped values stand */ }
}
/** everything back to the shipped values, and the stored copy dropped */
export function resetAim() {
  Object.assign(AIM.guard, AIM_DEFAULTS.guard); Object.assign(AIM.player, AIM_DEFAULTS.player);
  try { localStorage.removeItem(LS_KEY); } catch { /* none */ }
}
loadAim();

// ================================================================ panel / QA
/** 'aim ▸ you: track 0.85 · cone 0.021 (hands 0.012 ×1.3 + crossing 0.000 + feet 0.009) · Kowalski ◎ 1.00 cone 0.061 … ' — Sam, then every living alert man (or the nearest, at rest). */
export function aimSummary(g: Game): string {
  const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
  if (!g.tune.aimModel) return 'aim ▸ model OFF (every round as it was: guards\' rows, the player dead-on)';
  const R = playerAim(g); const pa = g.player.aim;
  const parts = [`you: track ${f2(pa.track)}${pa.tgtKey && pa.tgtKey !== 'free' ? pa.tgtKey.startsWith('l') ? ` on lamp ${pa.tgtKey.slice(1)}` : ` on #${pa.tgtKey.slice(1)}` : ''} · cone ${f3(R.spread)} (hands ${f3(R.base)} ×${f2(R.settle)} + crossing ${f3(R.tgt)} + feet ${f3(R.own)})${g.puppet ? ' [puppet: dead-on]' : ''}`];
  let men = g.guards.filter(x => x.state === 'alert');
  if (!men.length) { const n = g.nearestLivingGuard(); if (n) men = [n]; }
  for (const gd of men) {
    const A = gd.aim; const T = guardTerms(g, gd, 0); const ls = A.lastShot;
    parts.push(`${gd.callsign}${guardAcquired(g, gd) ? ' ◎' : ''} ${gd.state} track ${f2(A.track)}${gd.pinned ? ' (pinned)' : ''} · brg ${f2(A.bearingRate)} rad/s · cone ${f3(T.spread)} (hands ${f3(T.hands)} ×${f2(T.settle)} + crossing ${f3(T.tgt)} + feet ${f3(T.own)})${A.braking ? ' · BRAKING' : ''}${ls && g.time - ls.t < 3 ? ` · last round ${f2(g.time - ls.t)} s ago at track ${f2(ls.track)}, ${f3(ls.spread)} rad, ${f2(ls.speed)} m/s` : ''}`);
  }
  return 'aim ▸ ' + parts.join(' · ');
}
