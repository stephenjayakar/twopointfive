// CLOSER THAN EVER — Sam near a man: his own body says what he can do, and the sneak holds its pose when he stops.
//
// The ask, 10-09: "we want the behavior where the animation changes when you enter the mode, the character changes when you're close enough to do a melee
// attack (sam reached for his knife), which makes it very legible when you're close enough to do something, melee attacks work from all angles, grabbing only
// works from behind, and then the sneaking animation is designed so it can be paused frame by frame in this mode (pausing movement sticks in the current
// position, not reverting back to an idle state). then, the exhibit of this is slipping past guards in close proximity in a dark room, "slithering" between
// them". With CLOSE.on (off = every hook below returns on its first line and the game is the game):
//
//   THE MODE  within `modeM` of a living man with nothing solid between, Sam is IN THE MODE (`closeMode`): character.ts `creep` — his carriage changes, and his
//             gait HOLDS: stopping leaves him in the stride he was in, a tap of movement advances it, nothing eases back to the idle. Out again past `modeOutM`.
//   THE TELL  inside melee reach of a man, from any side, his hand goes to the knife on his chest and rests on it (character.ts `ready` + `reachShown`; the
//             knife stays in its sheath — rigProps draws it there — "sam doesn't pull out his knife when he's within melee radius, just reaches for it to
//             telegraph the state change"). Behind him the free arm also reaches for his neck: the grab is on.
//   THE BLOW  is the player's choice (`lethal`): the left click is the knife, drawn in the blow — he is dead; the right click the knockout — out cold.
//   MELEE     the left click with the hands empty, from EVERY angle (`closeWindows` is the one table: behind = the build's own takedown and gate; the sides and
//             the front = a strike from where he stands, the front one heard a room away). A man who is alert can still be struck (`alertStrike`).
//   GRAB      Space, ONLY from behind (the build's own gate, to the float) — standing or seated (a seated man's rear reach is a little longer: the chair back).
//   THE DARK  `dark`: the one rule of the men's eyes this touches. The build's sight has a floor inside 1.8 m — a shape at his elbow is seen whatever the light.
//             With the switch on that floor is scaled by the light ON Sam (his meter: none of it under `darkAt`, all of it from `litAt`), kept whole for a man
//             who is hunting (alert / searching) and inside `touchM` (he walks into you). Everything else — the cone, the light term, motion, his ears, a torch
//             on Sam — is the build's. So in a dark room he can be passed at arm's length by a man who keeps out of the torches and off the hard floor.
//   MARKS     the windows drawn on the floor (ui/overlay.ts) ship OFF (`marks`): the character is the tell. A play-test switch.
//   NOT HERE  teammates never use any of it (spotted.ts has their one takedown); civilians keep their own rule; nothing under a show (`touring`).
//
// `closeSeat` sits a calm staff man down on a mark (the hold flag + the library's sitting clip, off again the moment he is anything but calm): the build has no
// level that seats a guard by itself yet — the late worker at his desk is the one seated body it ships — so the panel and `__close.seat()` stage one.
//
// DETERMINISM: no dice, no wall clock. Everything here runs off Sam's own position and the men's, inside the frame's usual order (rows → act → update).
// (src/game is one import cycle: nothing below uses another game module's export at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3, wrapAngle, approachAngle, clamp, smoothstep } from '../math/vec';
import type { Game, Guard, Interactable, Verb } from './game';
import { canStand, grabVariant } from './player';
import { civilianSeated, civiliansShown, SIT_ADVANCE } from './civilians';
import type { ReadyKind } from './character';
import { handworkOn, samWork } from './handwork';
import { STALK, stalkBeginM, stalkClickOnly, stalkCould, stalkTell, stalkWait } from './stalk';
import { TAPSTEP, tapHeld } from './tapstep';

const DEGR = Math.PI / 180;
export const CLOSE = {
  /** THE switch (off = the build as it was: one way in, from behind, in words). ON in the page unless ?noclose (src/host/profile.ts pageSwitches); the
   *  harness's frozen stand holds it off (src/host/standup.ts; TPS_CLOSE=1 turns it on there) */
  on: false,
  /** the mode near a man: the changed carriage and the gait that holds its pose (character.ts `creep`) · the hand on the knife and the reaching arm in melee reach
   *  (`ready`) · the men's near-sight floor scaled by the light on Sam (`dark`) */
  mode: true, ready: true, dark: true,
  /** the windows drawn on the floor (ui/overlay.ts): OFF as shipped — the character is the tell */
  marks: false,
  /** the strikes besides the one from behind, each its own switch · a seated man's longer rear reach */
  side: true, front: true, seat: true,
  /** a strike (never a grab) still lands on a man who is ALERT */
  alertStrike: true,
  /** THE BLOW IS THE PLAYER'S CHOICE (Chaos Theory's two buttons): hands empty in reach, the LEFT click is the knife — he is dead — and the RIGHT click the
   *  knockout — he is out cold, breathing. Off = the left click is the knockout, as the build had it, and the right click nothing. Never under a show (the
   *  tour's clicks are knockouts) and never on a civilian (either button puts her out). */
  lethal: true,
  /** WITH A MAN IN HIS ARM THE SAME TWO BUTTONS (player.ts updateHold) — its own switch: it does not wait on `on`. The knife is at his throat: the LEFT click
   *  uses it — he is dead, and once begun it is not eased off (no tap, step or Esc stops a blade) — and the RIGHT click is the choke, begun exactly as his Space
   *  row begins it (he is out cold, breathing; a tap or a step still eases it off). The arm hold only: the pistol's hold keeps its own clicks (a round past
   *  him, the OCP), and never on a civilian or under a show. ON in the page unless ?noheldclicks (src/host/profile.ts pageSwitches); off here and on the
   *  harness's frozen stand (src/host/standup.ts; TPS_HELDCLICKS=1 turns it on there). Off = neither click does anything in the arm hold, as it was. */
  heldClicks: false,
  /** THE GRAB'S REACH GOES UP FOR A MAN WHO STANDS OVER HIM (character.ts READY_UP, anim.readyUp): crouched behind a standing man the open hand went to the
   *  small of his back and Sam's face to his seat, the reach being measured off Sam's own shoulder. Up: the trunk comes up out of the crouch's bow and the hand
   *  goes up for his neck (the grab's tell only; not with the pistol up). The crouch the game reads does not change; his head bone, which sight lines and the
   *  light meter read, is about 0.19 m higher while the tell is up. ON in the page unless ?noreachup (src/host/profile.ts pageSwitches); off
   *  here and on the harness's frozen stand (src/host/standup.ts; TPS_REACHUP=1 turns it on there). Off = the tell as it was. */
  reachUp: false,
  /** CROUCHED, HIS HANDS STAY LOW UNTIL THE MOVE (closeReady): crouched in reach behind a standing man the grab's tell held the open hand out for his neck, and
   *  from the game's camera — above and behind — a hand held up over a kneeling man's own head, half a metre short of anybody, reads as a hand put up, not as a
   *  reach (the maintainer, of a still from the pair's mission: 'the weirdness in this case was his hand'). Up: crouched, the tell is the hand on the knife
   *  alone, as it is from a side; the grab's own rise carries the arm when he takes him. The rows, the reach and the grab itself are what they were; on his
   *  feet the tell is the grab's, and a seated man's and the pistol's are untouched. With this up `reachUp` has nothing to raise. ON in the page unless
   *  ?handslow=0 (src/host/profile.ts pageSwitches); off here and on the harness's frozen stand (src/host/standup.ts; TPS_HANDSLOW=1 turns it on there). */
  handsLow: false,
  /** NO KNIFE (the maintainer: "remove the knife, only rmb for non lethal CQC when nothing equipped … then we also remove the knife from interrogation. you can
   *  still select nothing equipped or the pistol, but there's only rmb to choke out"): with empty hands the LEFT click is no blow at all (it is the stalk's hold,
   *  stalk.ts) and the RIGHT click is the knockout, from any side; with a man in the arm the left click does nothing and the right click chokes him out. Nothing
   *  draws, names or reaches for a blade: no sheath on his chest, no hand to a hilt in the tell, no knife at the held man's throat, no line of Sam's about an
   *  edge. ON in the page unless ?noknife=0 (src/host/profile.ts pageSwitches); off here and on the harness's frozen stand (src/host/standup.ts; TPS_NOKNIFE=1
   *  turns it on there). Off = the two buttons as they were. */
  noKnife: false,
  /** THE RIGHT BUTTON, TAPPED OR HELD (the maintainer: "make it possible to just right click to knock him out quickly but it's a bit louder, or holding right
   *  click does a choke. we already have this when you can pistol whip him if the gun is out"): with empty hands in reach of a man, a press of the right
   *  button let go inside `rmbTapSecs` is the knockout — the blow as it was, heard `rmbLoud` further up the hearing scale (the price of quick) — and a press
   *  kept down past it takes him into the arm and closes it at once: the choke, quiet and slow, for as long as the button stays down (let go, he breathes
   *  and is held; pressed in the arm, the same — and a TAP in the arm is the whole choke, as the click there always was). That is behind a man the grab is offered on. Where it is not (his side, his front, a civilian) there
   *  is nothing to choose between and the press is the knockout on its own frame, as loud as it was. A press made just out of reach waits `rmbWaitSecs`.
   *  ON in the page unless ?rmbhold=0 (src/host/profile.ts pageSwitches); off here and on the harness's frozen stand (TPS_RMBHOLD=1 turns it on there).
   *  Off = the press itself is the knockout, as it was. */
  rmbHold: false, rmbTapSecs: 0.2, rmbLoud: 0.15, rmbWaitSecs: 1.2,
  /** m: …and only under a neck this high off his own floor (a man on his feet: 1.44; one cowering or sat on the floor is under it and keeps the level reach) */
  handsLowNeckM: 1.15,
  /** m: Sam is in the mode this near a man (centre to centre, nothing solid between) · and out of it again past this */
  modeM: 3.0, modeOutM: 3.6,
  /** the light on Sam (his meter, 0‥1) under which the near-sight floor is nothing · from which it is the build's whole · m: inside this of a man who has
   *  him in his cone the floor is whole whatever the light (he walks into you) */
  darkAt: 0.1, litAt: 0.3, touchM: 0.55,
  /** m: the drawn windows fade in over the last `fadeM` of `modeM` */
  fadeM: 0.9,
  /** m: reach of each window, centre to centre (behind = the build's own 1.05) */
  reach: { behind: 1.05, side: 0.95, front: 0.85, seat: 1.2, seatFront: 0.95 },
  /** degrees off his facing where his FRONT ends and a side begins (the side runs from there to the rear arc, which is the build's own: cos < −0.25 = past
   *  104.5°) */
  sideFromDeg: 50,
  /** m: the drawn windows' inner edge (his own footprint is nobody's place to stand) · the picture's arc step in degrees */
  inner: 0.34, stepDeg: 7.5,
  /** m: where Sam stands for a strike from a side / the front, off the man's centre (the takedown from behind keeps its own 0.55) · over a chair: he closes to this
   *  on his own bearing, as near as the chair lets him (his collision), so the blow has an arm's length to land over */
  strikeDist: 0.6, seatDist: 0.72,
  /** hearing level of the fall, by the way in ('prop' events at the pair: the takedown from behind is the build's 0.3) · added when he was alert (he shouts) */
  noise: { behind: 0.3, side: 0.38, front: 0.5, seat: 0.3 }, alertNoise: 0.15,
};
export const CLOSE_DEFAULTS = JSON.parse(JSON.stringify(CLOSE)) as typeof CLOSE;
/** the build's own rear arc: Sam is 'behind' a man when the cosine of his bearing off the man's facing is under this (player.ts, since the first takedown) */
export const BEHIND_COS = -0.25;

/** which way in a move was made by — what the strike, the station and the noise are chosen on */
export type CloseKind = 'behind' | 'side' | 'front' | 'seat';
export type CloseId = 'behind' | 'left' | 'right' | 'front';
/** One window round a man, in HIS frame: bearings are radians off his facing (0 = dead ahead of him, ±π = dead astern, + = toward his left). */
export interface CloseWindow {
  id: CloseId; kind: CloseKind;
  /** the arc: every bearing b with cos(b − mid) > cosHalf (`half` = its half-width, for the picture) */
  mid: number; half: number; cosHalf: number;
  reach: number;
  /** what it gives at all: the grab (Space) · the strike (left click, hands empty) */
  grab: boolean; strike: boolean;
}
/** What Sam could do to one man from one spot. `win` = the window his bearing is in (whatever the range); `can` = something is on offer right here. */
export interface CloseOffer {
  guard: Guard; win: CloseWindow | null; dist: number; bearing: number;
  inReach: boolean; clear: boolean;
  grab: boolean; strike: boolean; can: boolean;
  /** why nothing is on offer, in the row's words ('' when something is) */
  why: string;
}
export const CLOSE_STATS = { takes: { behind: 0, side: 0, front: 0, seat: 0 }, grabs: { behind: 0, side: 0, front: 0, seat: 0 }, blows: { knife: 0, knockout: 0 }, readyFrames: 0, modeFrames: 0, darkPasses: 0, seats: 0, unseats: 0 };
export const CLOSE_LOG: { t: number; who: string; what: 'take' | 'grab' | 'seat' | 'unseat'; kind: CloseKind | null; bearing: number; dist: number }[] = [];
function note(g: Game, gd: Guard, what: 'take' | 'grab' | 'seat' | 'unseat', kind: CloseKind | null, bearing = 0, dist = 0) { CLOSE_LOG.push({ t: g.time, who: gd.callsign, what, kind, bearing, dist }); if (CLOSE_LOG.length > 200) CLOSE_LOG.shift(); }

// ------------------------------------------------------------ per-game state: this frame's best offer (the ready pose reads it), the men sat down
interface Seat { at: Vec3; face: number; hold: boolean; down: boolean }
interface State { t: number; best: CloseOffer | null; seats: Map<Guard, Seat>; mode: Guard | null; modeD: number; /** CLOSE.rmbHold: seconds the right button has been down since its press (−1 = no press waits) */ rmbT: number }
const STATE = new SideMap<Game, State>('close.STATE');
function stateOf(g: Game): State { let s = STATE.get(g); if (!s) { s = { t: -1, best: null, seats: new Map(), mode: null, modeD: Infinity, rmbT: -1 }; STATE.set(g, s); } return s; }

// ------------------------------------------------------------ the windows
const arc = (id: CloseId, kind: CloseKind, mid: number, half: number, reach: number, grab: boolean, strike: boolean): CloseWindow => ({ id, kind, mid, half, cosHalf: Math.cos(half), reach, grab, strike });
/** has he a seat at all — down in it or on his way down (doze.ts: a seat somebody else took away is a man awake) */
export function closeHasSeat(g: Game, gd: Guard): boolean { return !!STATE.get(g)?.seats.has(gd); }
/** Is this man sitting (the late worker at his desk — civilians.ts — or a staff man sat down by closeSeat)? */
export function closeSeated(g: Game, gd: Guard): boolean { return gd.civ ? civilianSeated(gd) : !!stateOf(g).seats.get(gd)?.down; }
/** THE TABLE: the windows round one man as he is now (standing / seated, staff / civilian). The rear arc of a standing man is the build's own gate. */
export function closeWindows(g: Game, gd: Guard): CloseWindow[] {
  const K = CLOSE, R = K.reach, out: CloseWindow[] = [];
  const rearHalf = Math.acos(-BEHIND_COS);   // 75.5°: |bearing| past 104.5°
  if (gd.civ) {   // a civilian keeps her own rule (player.ts): the arm from behind — from any side once she cowers — and, seated, the longer reach over the chair back
    if (gd.civ.state === 'cower') { out.push(arc('behind', 'behind', Math.PI, Math.PI, R.behind, true, true)); return out; }
    if (K.seat && civilianSeated(gd)) { out.push(arc('behind', 'seat', Math.PI, rearHalf, R.seat, true, true)); return out; }
    out.push(arc('behind', 'behind', Math.PI, rearHalf, R.behind, true, true)); return out;
  }
  const rear = Math.PI - rearHalf;   // 104.5°: where the rear arc begins
  if (K.seat && closeSeated(g, gd)) {   // seated: the same rear arc with the longer reach, and everything forward of it one strike window
    out.push(arc('behind', 'seat', Math.PI, rearHalf, R.seat, true, true));
    if (K.front) out.push(arc('front', 'front', 0, rear, R.seatFront, false, true));
    return out;
  }
  out.push(arc('behind', 'behind', Math.PI, rearHalf, R.behind, true, true));
  const front = clamp(K.sideFromDeg, 10, 100) * DEGR;   // the side arc runs front → rear on each hand: a STRIKE only (grabbing only works from behind)
  if (K.side && rear > front + 1e-3) { const mid = (front + rear) / 2, half = (rear - front) / 2; out.push(arc('left', 'side', mid, half, R.side, false, true)); out.push(arc('right', 'side', -mid, half, R.side, false, true)); }
  if (K.front) out.push(arc('front', 'front', 0, K.side ? front : rear, R.front, false, true));
  return out;
}
/** the window a bearing falls in (the rear arc first: it is tested with the build's own cosine, the rest fill what it leaves) */
function windowAt(wins: CloseWindow[], b: number): CloseWindow | null {
  const cb = Math.cos(b);
  for (const w of wins) { if (w.id === 'behind' && w.half < Math.PI - 1e-6) { if (cb < BEHIND_COS) return w; continue; } if (Math.cos(b - w.mid) > w.cosHalf - 1e-9) return w; }
  return null;
}
/** nothing solid and no door leaf between two bodies at chest height — the takedown's own test since the first one (no lunge through a partition or a shut leaf) */
function clearBetween(g: Game, p: ArrayLike<number>, q: ArrayLike<number>): boolean {
  const a: Vec3 = [p[0], 1.0, p[2]], b: Vec3 = [q[0], 1.0, q[2]];
  return !g.col.solidBlocked(a, b) && !g.col.segmentBlockedDynamic(a, b);
}
/** …the same test for the stalk (stalk.ts): a wall or a leaf between them ends it */
export const closeClear = clearBetween;
/** may anything be done to him at all by Sam's hands (dead, a teammate, out of the picture, already in an arm: no) */
export function closeSubject(g: Game, gd: Guard): boolean {
  if (gd.state === 'dead' || gd.held) return false;
  if (gd.team === 'operative' || g.fogOfWar.hidden(gd)) return false;
  if (gd.civ && g.rescue?.isHostage(gd)) return false;
  return true;
}
/** WHAT SAM COULD DO TO THIS MAN FROM `p` — the one test the rows, the click, the picture and the ready pose share. */
export function closeAt(g: Game, gd: Guard, p: ArrayLike<number>): CloseOffer {
  const pl = g.player, gp = gd.char.pos; const dx = p[0] - gp[0], dz = p[2] - gp[2]; const dist = Math.hypot(dx, dz);
  const bearing = wrapAngle(Math.atan2(dx, dz) - gd.char.bodyYaw);
  const win = windowAt(closeWindows(g, gd), bearing);
  const o: CloseOffer = { guard: gd, win, dist, bearing, inReach: false, clear: false, grab: false, strike: false, can: false, why: '' };
  const cv = gd.civ, him = cv ? cv.her : 'him';
  if (!win) { o.why = cv ? `get behind ${him}` : 'get behind him'; return o; }
  const alert = gd.state === 'alert';
  const catchable = !cv || (cv.state !== 'flee' && cv.state !== 'evacuate' && cv.state !== 'report');
  const grab = win.grab && !alert && catchable, strike = win.strike && catchable && (!alert || CLOSE.alertStrike);
  if (!grab && !strike) { o.why = cv ? `not while ${cv.she}'s ${cv.state === 'report' ? 'with a guard' : 'running'}` : "not while he's onto you"; return o; }
  if (pl.sprinting) { o.why = 'stop sprinting'; return o; }
  o.inReach = dist < win.reach;
  if (!o.inReach) { o.why = 'get closer'; return o; }
  o.clear = clearBetween(g, gp, p);
  if (!o.clear) { o.why = 'get closer'; return o; }
  if (pl.crouch && !canStand(g)) { o.why = `no room to stand up ${win.kind === 'front' ? 'in front of' : win.kind === 'side' ? 'beside' : 'behind'} ${him} here`; return o; }
  o.grab = grab; o.strike = strike; o.can = true;
  return o;
}
/** the move a window makes of a click / a grab: its kind */
/** the two-button blow is live (CLOSE.lethal, the switch on, no show running): left = the knife, right = the knockout */
export function closeLethal(g: Game): boolean { return CLOSE.on && CLOSE.lethal && !g.touring; }
/** THE RIGHT BUTTON, TAPPED OR HELD (CLOSE.rmbHold; game.ts, once a frame). `on` = the rule is up and his hands are empty and free; `near` = a man is in
 *  reach; `choke` = …and the choke is his to be given (the grab is offered on him); `dropped` = the page took the button away (a blur, the pause card).
 *  'press' = the knockout as it was, on the press's own frame (the rule off, or a man in reach who can only be struck: his side, his front, a civilian —
 *  nothing to choose between, so nothing to wait for); 'tap' = a press let go inside `rmbTapSecs` (the knockout, the quick one); 'hold' = a press that
 *  has stayed down that long with the choke on offer. A press made out of reach waits `rmbWaitSecs` more for him to walk into it. */
export function closeRmb(g: Game, on: boolean, down: boolean, hit: boolean, dt: number, near: boolean, choke: boolean, dropped: boolean): 'press' | 'tap' | 'hold' | null {
  const S = stateOf(g);
  if (!on) { S.rmbT = -1; return hit ? 'press' : null; }
  if (hit) { if (near && !choke) { S.rmbT = -1; return 'press'; } S.rmbT = 0; }
  if (S.rmbT < 0) return null;
  if (dropped) { S.rmbT = -1; return null; }
  if (!down) { const tap = S.rmbT < CLOSE.rmbTapSecs; S.rmbT = -1; return tap ? 'tap' : null; }
  S.rmbT += dt; if (S.rmbT < CLOSE.rmbTapSecs) return null;
  if (choke) { S.rmbT = -1; return 'hold'; }
  if (near || S.rmbT > CLOSE.rmbTapSecs + CLOSE.rmbWaitSecs) { S.rmbT = -1; return near ? 'press' : null; }
  return null;
}
/** …and there is no knife (CLOSE.noKnife, the switch on, no show running): the right click is the knockout, the left click no blow */
export function closeBare(g: Game): boolean { return CLOSE.on && CLOSE.noKnife && !g.touring; }
/** the windows are live: the switch on and no show running (under a show Sam's hands are the build's: one way in, from behind) */
export function closeLive(g: Game): boolean { return CLOSE.on && !g.touring; }
/** a blow landed (player.ts updateTakedown): the tally */
export function closeBlow(lethal: boolean) { if (lethal) CLOSE_STATS.blows.knife++; else CLOSE_STATS.blows.knockout++; }
export function closeKindOf(o: CloseOffer | null): CloseKind { return o?.win?.kind ?? 'behind'; }

// ------------------------------------------------------------ the rows (player.ts buildInteractables calls this for every living man in place of its own block)
type RowFn = (base: Interactable, verb: Verb, text: string, hints?: string, over?: Partial<Interactable>) => Interactable;
type OfferFn = (it: Interactable, verbs: Interactable[]) => void;
/** One staff man's marker and rows with the switch on. Behind him the wording is the build's own (Space grabs, the click takes him down); from a side or the
 *  front there is no Space row — one line says what the click does. The marker carries the way in (`close`) so the click that follows makes the move the row offered. */
export function closeRows(g: Game, gd: Guard, p: ArrayLike<number>, busy: boolean, row: RowFn, offer: OfferFn) {
  const pl = g.player; const gp = gd.char.pos;
  const far = Math.hypot(p[0] - gp[0], p[2] - gp[2]);
  if (far >= 2.4) {   // (STALK.low: a press begins the creep from further off than any row reaches — the one line that says so is shown out to there, and nothing else is)
    if (STALK.on && STALK.low && !busy && far < stalkBeginM() && stalkCould(g, gd)) offer({ kind: 'guard', pos: v3.add(gp, [0, 1.35, 0]), line1: 'guard', line2: sneakHint(), inReach: false, off: false, guard: gd }, []);
    return;
  }
  const o = closeAt(g, gd, p); const kind = closeKindOf(o); const seated = closeSeated(g, gd);
  const alert = gd.state === 'alert';
  const where = !o.win ? '' : o.win.kind === 'front' ? ' · facing you' : o.win.kind === 'side' ? ' · side on' : '';
  const it: Interactable = { kind: 'guard', pos: v3.add(gp, [0, seated ? 1.05 : 1.35, 0]), line1: `guard${alert ? ' · alert' : seated ? ' · seated' : ''}${alert ? '' : where}`, line2: o.why, inReach: o.can, off: false, guard: gd, close: kind };
  const sneak = STALK.on && !busy && stalkCould(g, gd);   // (stalk.ts: the left button held on him walks Sam in to the grab)
  if (sneak && !o.can) it.line2 = sneakHint();   // (STALK.key: the hold walks him in, the row's key grabs)
  const verbs: Interactable[] = [];
  if (o.can && !busy) {
    const empty = pl.holstered, gun = grabVariant(g) === 'gun';
    // what the left click does from here, as the hint beside the Space row (or as the one line where there is no Space row)
    const bare = closeBare(g), two = closeLethal(g) || bare;   // (no knife: the right click is the knockout whatever `lethal` says, and no line names a blade)
    // (a tutorial mission's step holds the right button, or the hands' key, shut: no line names one that would do nothing. The right button is the gate's
    //  own sum — rails.ts ACTS: `alt` and `menu` are the two actions that own it — and both questions are `hushes`, so a broken frame names them all)
    const rmb = !(g.rails.hushes('alt') && g.rails.hushes('menu')), away = !g.rails.hushes('hands');
    const choke = CLOSE.rmbHold && rmb && o.grab && !gd.civ && (bare || closeLethal(g)) && g.rails.offers('grab') ? '  ·  RMB  hold to choke him' : '';   // (CLOSE.rmbHold: the same button kept down is the choke)
    const click = !o.strike ? '' : !empty ? (away && (rmb || !bare) ? `E  ${pl.rifleUp ? 'sling it' : 'holster'} for the ${bare ? 'knockout' : two ? 'knife / the knockout' : `LMB ${kind === 'behind' || kind === 'seat' ? 'takedown' : 'strike'}`}` : '')
      : (two && sneak) || bare ? (rmb ? `RMB  knock him out${choke}` : '')   // (behind him the left button is the stalk's: it grabs him)
      : two ? `LMB  knife — lethal${rmb ? `  ·  RMB  knock him out${choke}` : ''}`
      : kind === 'behind' ? 'LMB  takedown — silent' : kind === 'seat' ? 'LMB  put him out where he sits — silent' : kind === 'side' ? 'LMB  strike — quiet' : `LMB  strike — he gets a sound out`;
    const only = stalkClickOnly(g) && !gd.civ;   // (stalk.ts: the held click is the one way to him — no row grabs a staff man)
    if (o.grab && only) verbs.push({ ...it, verb: undefined, running: false, progress: undefined, inReach: true,
      line2: empty ? `LMB  hold to grab him${two && o.strike && rmb ? `  ·  RMB  knock him out${choke}` : ''}` : `E  ${pl.rifleUp ? 'sling it' : 'holster'}, then hold LMB to grab him` });
    else if (o.grab) {
      const text = kind === 'seat' ? (gun ? 'haul him out of the chair — pistol to his head' : 'haul him out of the chair')
        : gun ? 'grab him — pistol to his head' : pl.rifleUp ? 'grab him — the rifle goes on your back' : 'grab him';
      verbs.push(row(it, 'grab', text, click));
    } else if (o.strike) verbs.push({ ...it, verb: undefined, running: false, progress: undefined, line2: `${click ? click + '  ·  ' : ''}${o.win?.grab ? "you can't grab him while he's onto you" : 'the grab is from behind'}`, inReach: true });
    noteBest(g, o);
  }
  offer(it, verbs);
}
/** the line that says what the held click does (STALK.key: the hold walks him in, the row's key grabs) */
const sneakHint = (): string => STALK.drag ? 'LMB  press and drag to sneak up on him' : STALK.key ? 'LMB  hold to sneak up on him' : 'LMB  hold to sneak up and grab him';   // (STALK.drag: the mouse is the stick)
/** this frame's best offer: the nearest man Sam could do something to (what the ready pose is taken from) */
function noteBest(g: Game, o: CloseOffer) { const S = stateOf(g); if (S.t !== g.time) { S.t = g.time; S.best = null; } if (!S.best || o.dist < S.best.dist) S.best = o; }
/** A civilian's gate with the windows on (player.ts keeps her rows and their wording): is Sam in her window, and near enough */
export function closeCivGate(g: Game, gd: Guard, p: ArrayLike<number>): { behind: boolean; near: boolean; kind: CloseKind } {
  const gp = gd.char.pos; const b = wrapAngle(Math.atan2(p[0] - gp[0], p[2] - gp[2]) - gd.char.bodyYaw); const w = windowAt(closeWindows(g, gd), b);
  return { behind: !!w, near: !!w && Math.hypot(p[0] - gp[0], p[2] - gp[2]) < w.reach, kind: w?.kind ?? 'behind' };
}
/** a civilian Sam could take right now, for the ready pose (player.ts's civilian block reports the row it made) */
export function closeCivOffer(g: Game, gd: Guard, p: ArrayLike<number>) { const o = closeAt(g, gd, p); if (o.can) noteBest(g, o); }

// ------------------------------------------------------------ the ready pose (once a frame, after the rows: player.ts buildInteractables' tail)
/** Sam's body says he is in reach: which pose, and what the hand is going for. null = none (nobody in reach, the hands are busy, the rifle is up).
 *  'strike' = the hand on the knife (any side) · 'grab' = behind him: the hand on the knife, and the free arm reaching for his neck · 'seat' = behind a chair · 'grabGun' = behind
 *  him with the pistol up (the free hand only; from any other side a pistol says nothing: the click there is a round). */
export function closeReady(g: Game): { kind: ReadyKind; at: Vec3 } | null {
  const pl = g.player; if (!CLOSE.on || !CLOSE.ready || g.touring) return null;
  const S = stateOf(g); const o = S.t === g.time ? S.best : null; if (!o || !o.can) return null;
  if (pl.down || pl.holding || pl.takedown || pl.dragging || pl.kick || pl.picking || pl.wanding || pl.rifleUp || pl.canisterSel && !pl.holstered) return null;
  if (samWork(g) || pl.coding && handworkOn('work')) return null;   // hands at work on a thing (handwork.ts: a charge, the drive, the lever, a keypad): they stay on it — a click there lets go of the work or does nothing, it throws no blow, so the pose promises none
  if (pl.wall) return null;   // back to the wall: his arms are the wall hold's — the row still offers the move, the pose says nothing (neither close layer runs on the wall)
  const gd = o.guard; const neck = gd.char.bones.neck ?? gd.char.bones.head; const at: Vec3 = neck ? [neck[0], neck[1], neck[2]] : [gd.char.pos[0], gd.char.pos[1] + (o.win?.kind === 'seat' ? 1.1 : 1.45), gd.char.pos[2]];
  const kind = closeKindOf(o);
  if (pl.pistolUp) return o.grab ? { kind: 'grabGun', at } : null;   // the pistol stays on him; only the free hand says anything
  if (!o.grab) return { kind: 'strike', at };
  if (CLOSE.handsLow && pl.crouch && kind !== 'seat' && at[1] - gd.char.pos[1] > CLOSE.handsLowNeckM) return { kind: 'strike', at };   // (crouched under a man on his feet: the hand on the knife says it — no open hand held up over his own head; a man low himself keeps the level reach)
  return { kind: kind === 'seat' ? 'seat' : 'grab', at };
}
/** THE MODE: the man Sam is close to (the nearest living one inside `modeM` with nothing solid between; once in, kept out to `modeOutM`), or null. Not with the
 *  rifle up, sprinting, down, with a man in his arm or a body in tow, at a lock or with his hands at work on a thing (handwork.ts), under a show. Read after `closeTick` has run this frame. */
export function closeMode(g: Game): Guard | null { return STATE.get(g)?.mode ?? null; }
function modeNow(g: Game, S: State): Guard | null {
  const pl = g.player; S.modeD = Infinity;
  if (!CLOSE.on || !CLOSE.mode || g.touring || pl.down || pl.holding || pl.dragging || pl.kick || pl.picking || pl.wanding || pl.rifleUp || pl.sprinting || pl.wall) return null;
  if (samWork(g) || pl.coding && handworkOn('work')) return null;   // hands at work on a thing, as at a lock: the carriage would take them off it
  const p = pl.char.pos; let best: Guard | null = null, bd = Infinity;
  for (const gd of [...g.guards, ...civiliansShown(g)]) {
    if (!closeSubject(g, gd)) continue;
    const gp = gd.char.pos; const d = Math.hypot(p[0] - gp[0], p[2] - gp[2]);
    if (d >= (gd === S.mode ? CLOSE.modeOutM : CLOSE.modeM) || d >= bd) continue;
    if (!clearBetween(g, gp, p)) continue;
    best = gd; bd = d;
  }
  S.modeD = bd; return best;
}
/** once a frame after the rows are built (and once more after the switch goes off, to let go of the poses) */
export function closeTick(g: Game) {
  const pl = g.player, an = pl.char.anim; const S = stateOf(g);
  const r = closeReady(g);
  // (stalk.ts STALK.tell: behind a man he could stalk the pose is the distance's — the arm coming up and the body coming out of the crouch as he closes, the
  // grab's own reach at a part weight; a chair's haul keeps its own pose, and whatever stands the tell down in reach — hands at work, the switch — stands this down)
  const T = STALK.on && CLOSE.ready && r?.kind !== 'seat' && !samWork(g) && !(pl.coding && handworkOn('work')) ? stalkTell(g) : null, best = S.t === g.time ? S.best : null;
  // (in reach of ANOTHER man the tell is that man's, as it was)
  if (T && (!r || !best || best.guard === T.gd)) { an.ready = 'grab'; an.readyAt = T.at; an.readyUp = CLOSE.reachUp ? 1 : 0; an.readyAmt = T.reach; an.rise = T.rise; an.low = T.low; if (T.low > 0) { const L = an.lowShape; L[0] = STALK.lowDrop; L[1] = STALK.lowBack; L[2] = STALK.lowLean; } }
  else { an.ready = r ? r.kind : null; an.readyAt = r ? r.at : null; an.readyUp = r && CLOSE.reachUp ? 1 : 0; an.readyAmt = 1; an.rise = 0; an.low = 0; }
  // (stalk.ts STALK.corner: lying in wait on a wall he is coiled — sunk a little, both hands up, more as the man comes)
  const CW = STALK.on && CLOSE.ready && !r && closeBare(g) ? stalkWait(g) : null;   // (bare hands only: with a knife the pose's right hand is on the hilt, and the wait can only grab)
  if (CW) { an.ready = 'grab'; an.readyAt = CW.at; an.readyUp = 0; an.readyAmt = CW.reach; an.coil = CW.coil; }
  else { const H = pl.holding;   // (…and he comes up out of it THROUGH the step in, not in its first frame)
    if (H && H.from && H.phase === 'grab' && an.coil > 0) { H.coil0 ??= an.coil; an.coil = STALK.cornerRise > 0 ? H.coil0 * (1 - smoothstep(0, STALK.cornerRise, H.t)) : 0; } else an.coil = 0; }
  // (stalk.ts STALK.low: his hands are down wherever the carriage would raise them, and a stalk's grab is the spring up out of the low creep)
  { const H = pl.holding, low = STALK.on && STALK.low; an.handsDown = low && closeBare(g) ? STALK.lowHands : 0;
    an.wide = low && STALK.wide && closeBare(g) && !H ? (TAPSTEP.on && pl.crouch ? 1 : Math.min(1, an.low / Math.max(0.05, STALK.wideBy))) : 0; if (an.wide) { const Ws = an.wideShape; Ws[0] = STALK.wideOut; Ws[1] = STALK.wideDown; Ws[2] = STALK.wideFwd; Ws[3] = STALK.wideLead; an.widePole = STALK.widePole; if (STALK.heft) { Ws[0] = STALK.heftOut; Ws[1] = STALK.heftDown; Ws[2] = STALK.heftFwd; Ws[3] = STALK.heftLead; an.widePole = STALK.heftPole; const Hs = an.heftShape; Hs[0] = STALK.heftTwist; Hs[1] = STALK.heftSwing; Hs[2] = STALK.heftSide; Hs[3] = STALK.heftLean; Hs[4] = STALK.heftDip; Hs[5] = STALK.heftSurge; } } an.heft = STALK.heft ? 1 : 0;   // (STALK.wide: closing on a man, his arms come out wide and low with the sink — `an.low` is 0 where the tell was stood down for another man)
      // (bare hands: with a knife the right hand's hover by the hilt is the carriage's own)
    an.spring = low && H && H.from && H.phase === 'grab' && H.coil0 === undefined ? Math.max(1, STALK.lowSpring * (STALK.lowWind > 0 ? smoothstep(0, STALK.lowWind, H.t) : 1)) : 0; }   // (…a rate that winds up over `lowWind` s: he leaves the floor slowly and arrives fast, where a plain ease would jump in its first frame)
  if (r) CLOSE_STATS.readyFrames++;
  const m = pl.takedown ? S.mode : modeNow(g, S); S.mode = m;   // (a blow under way keeps the mode it was thrown in: the stance does not let go mid-swing)
  an.creep = !!m || tapHeld(g); if (!tapHeld(g)) an.tapU = -1;   // (tapstep.ts: the steps stand in the held stride, a man near or not)
  if (m) { const ch = m.char.bones.chest; an.creepAt = ch ? [ch[0], ch[1], ch[2]] : [m.char.pos[0], m.char.pos[1] + 1.2, m.char.pos[2]]; CLOSE_STATS.modeFrames++; } else an.creepAt = null;
}
/** THE DARK (guards.ts sightGain, Sam only): how much of the build's near-sight floor — a shape inside 1.8 m of him is seen whatever the light — this man has
 *  for Sam right now. 1 = all of it = the build (always with the switch off). With the switch on it goes by the light on Sam: nothing under `darkAt` of his
 *  meter, all of it from `litAt`; a man who is hunting keeps all of it, and inside `touchM` it is whole (he walks into you). */
export function closeNearK(g: Game, gd: Guard, dist: number): number {
  if (!CLOSE.on || !CLOSE.dark || g.touring) return 1;
  if (gd.state === 'alert' || gd.state === 'search' || dist < CLOSE.touchM) return 1;
  const k = smoothstep(CLOSE.darkAt, CLOSE.litAt, g.player.visibility);
  if (k < 1) CLOSE_STATS.darkPasses++;
  return k;
}

// ------------------------------------------------------------ lining up: where Sam stands for a strike
/** Where Sam stands to strike from a side / the front / over a chair — on his own bearing off the man, `strikeDist` (`seatDist`) out — and the way he faces (at him). */
export function closeStation(gd: Guard, kind: CloseKind, bearing: number): { pos: Vec3; yaw: number } {
  const gp = gd.char.pos; const a = gd.char.bodyYaw + bearing; const r = kind === 'seat' ? CLOSE.seatDist : CLOSE.strikeDist;
  const pos: Vec3 = [gp[0] + Math.sin(a) * r, 0, gp[2] + Math.cos(a) * r];
  return { pos, yaw: Math.atan2(gp[0] - pos[0], gp[2] - pos[2]) };
}
/** the fall's hearing level for a way in (+ his shout if he was onto Sam) */
export function closeNoise(kind: CloseKind, wasAlert: boolean): number { return CLOSE.noise[kind] + (wasAlert ? CLOSE.alertNoise : 0); }
/** the tallies (player.ts startTakedown / startGrab report what they made) */
export function closeTook(g: Game, gd: Guard, what: 'take' | 'grab', kind: CloseKind, bearing: number, dist: number) { (what === 'take' ? CLOSE_STATS.takes : CLOSE_STATS.grabs)[kind]++; note(g, gd, what, kind, bearing, dist); }

// ------------------------------------------------------------ the picture: each window as a floor polygon, cut by the walls the offer is cut by
export interface CloseMark {
  guard: Guard; id: CloseId; kind: CloseKind;
  /** the window's outline on the floor (world), outer arc then inner arc back — empty when a wall leaves nothing of it */
  pts: Vec3[];
  /** where its words go (just outside the outer arc at its middle) and what they say */
  labelAt: Vec3; label: string;
  /** in = Sam stands in it and the move is on · open = it would be, from inside it · shut = nothing from there now (`label` says why) */
  state: 'in' | 'open' | 'shut';
  /** 0‥1 by Sam's distance (drawn only near a man) */
  alpha: number;
}
/** how far out along a bearing the window runs before a wall or a leaf ends it: the offer's own test, bisected to a few centimetres */
function clipReach(g: Game, gd: Guard, a: number, r0: number, r1: number): number {
  const gp = gd.char.pos, s = Math.sin(a), c = Math.cos(a); const at = (r: number): Vec3 => [gp[0] + s * r, 0, gp[2] + c * r];
  // (asked FROM THE MAN outward: a segment that starts inside a wall does not see that wall — collision.ts — and the window would be drawn through its thickness)
  if (clearBetween(g, gp, at(r1))) return r1;
  if (!clearBetween(g, gp, at(r0))) return r0;
  let lo = r0, hi = r1; for (let i = 0; i < 5; i++) { const m = (lo + hi) / 2; if (clearBetween(g, gp, at(m))) lo = m; else hi = m; }
  return lo;
}
/** what a window says on the floor, by what Sam's hands hold */
function labelOf(g: Game, w: CloseWindow): string {
  const pl = g.player, empty = pl.holstered;
  if (w.kind === 'front') return empty ? 'STRIKE' : 'STRIKE · HOLSTER FIRST';
  if (w.kind === 'seat') return empty ? 'HAUL OUT · TAKEDOWN' : 'HAUL OUT';
  if (w.kind === 'side') return empty ? 'STRIKE' : 'STRIKE · HOLSTER FIRST';
  return empty ? 'GRAB · TAKEDOWN' : 'GRAB';
}
/** THE WINDOWS TO DRAW this frame (ui/overlay.ts; the probes): every window of every man within `modeM` of Sam, cut by walls, with its words and its state.
 *  Nothing while Sam's hands are on somebody, he is down, or the switch / the marks are off. Reads only — safe to call from the HUD. */
export function closeMarks(g: Game): CloseMark[] {
  const out: CloseMark[] = []; const pl = g.player;
  if (!CLOSE.on || !CLOSE.marks || pl.down || pl.holding || pl.takedown || pl.dragging) return out;
  const p = pl.char.pos, K = CLOSE;
  for (const gd of [...g.guards, ...civiliansShown(g)]) {
    if (!closeSubject(g, gd)) continue;
    const gp = gd.char.pos; const d = Math.hypot(p[0] - gp[0], p[2] - gp[2]); if (d >= K.modeM) continue;
    const alpha = smoothstep(K.modeM, K.modeM - K.fadeM, d);
    const o = closeAt(g, gd, p); const y = gp[1] + 0.03;
    const alert = gd.state === 'alert'; const catchable = !gd.civ || (gd.civ.state !== 'flee' && gd.civ.state !== 'evacuate' && gd.civ.state !== 'report');
    for (const w of closeWindows(g, gd)) {
      const opens = catchable && ((w.grab && !alert) || (w.strike && (!alert || K.alertStrike)));
      const n = Math.max(2, Math.ceil((2 * w.half) / (K.stepDeg * DEGR))); const outer: Vec3[] = [], inner: Vec3[] = [];
      let any = false;
      for (let i = 0; i <= n; i++) {
        const b = w.mid - w.half + (2 * w.half) * (i / n), a = gd.char.bodyYaw + b; const r = clipReach(g, gd, a, K.inner, w.reach);
        if (r > K.inner + 0.04) any = true;
        outer.push([gp[0] + Math.sin(a) * r, y, gp[2] + Math.cos(a) * r]); inner.push([gp[0] + Math.sin(a) * K.inner, y, gp[2] + Math.cos(a) * K.inner]);
      }
      const am = gd.char.bodyYaw + w.mid, rl = w.reach + 0.2;
      const here = o.win?.id === w.id;
      const state: CloseMark['state'] = here && o.can ? 'in' : opens && !pl.sprinting ? 'open' : 'shut';
      const label = state === 'shut' ? (alert && !opens ? 'HE IS ONTO YOU' : pl.sprinting ? 'STOP SPRINTING' : !catchable ? 'NOT NOW' : labelOf(g, w)) : here && !o.can && o.inReach && o.why ? o.why.toUpperCase() : labelOf(g, w);
      out.push({ guard: gd, id: w.id, kind: w.kind, pts: any ? [...outer, ...inner.reverse()] : [], labelAt: [gp[0] + Math.sin(am) * rl, y, gp[2] + Math.cos(am) * rl], label, state, alpha });
    }
  }
  return out;
}

// ------------------------------------------------------------ a seated staff man (staged: the panel, __close.seat, the clip)
const SIT_CLIP = { clip: 'Sitting_Idle_Loop', loop: true, rate: 1, in: 0.7, out: 0.8 };
const calm = (gd: Guard) => gd.state === 'patrol' && gd.awareness < 0.3 && !gd.held && !gd.script;
/** Sit a calm staff man down on a mark (default: where he stands, facing as he faces). He keeps his eyes and ears (the seat's own rule; doze.ts shuts or dulls them for the man it sat there); the moment he is anything but calm he is
 *  up and the AI has him as it would have. False if he cannot be sat (not calm, dead, a civilian, a unit of the response). */
export function closeSeat(g: Game, gd: Guard, at?: ArrayLike<number>, face?: number): boolean {
  if (gd.civ || gd.unit || gd.state === 'dead' || !calm(gd)) return false;
  const S = stateOf(g); const prev = S.seats.get(gd); if (prev && !at) return true;   // (already in a chair, or on his way down into it: he stays in that one)
  S.seats.set(gd, { at: at ? [at[0], 0, at[2]] : [gd.char.pos[0], 0, gd.char.pos[2]], face: face ?? gd.char.bodyYaw, hold: prev ? prev.hold : gd.hold, down: false });
  gd.hold = true; CLOSE_STATS.seats++; note(g, gd, 'seat', null);
  return true;
}
/** up out of the chair (the clip fades on its own `out`; his hold flag as it was) */
export function closeUnseat(g: Game, gd: Guard, back = false) {
  const S = stateOf(g), st = S.seats.get(gd); if (!st) return;
  S.seats.delete(gd); gd.hold = st.hold; if (gd.char.anim.act?.clip === SIT_CLIP.clip) gd.char.anim.act = null;
  if (back && st.down && gd.state !== 'dead') { gd.char.pos[0] = st.at[0]; gd.char.pos[2] = st.at[2]; }   // (stood up by hand — the panel: up where he sat down from. The seat walked his root SIT_ADVANCE on, and sitting him again must not walk him on again)
  CLOSE_STATS.unseats++; note(g, gd, 'unseat', null);
}
/** once a frame BEFORE the guards (game.ts): the seated men kept on their marks while calm, stood up when not. Nothing with nobody seated. */
export function closeSeatTick(g: Game, dt: number) {
  const S = STATE.get(g); if (!S || !S.seats.size) return;
  for (const [gd, st] of S.seats) {
    if (!g.guards.includes(gd) || !calm(gd) || !CLOSE.on) { closeUnseat(g, gd); continue; }
    const c = gd.char; c.bodyYaw = approachAngle(c.bodyYaw, st.face, 3 * dt);
    const settled = Math.abs(wrapAngle(c.bodyYaw - st.face)) < 0.35;
    const tx = st.at[0] + Math.sin(st.face) * SIT_ADVANCE, tz = st.at[2] + Math.cos(st.face) * SIT_ADVANCE; const k = 1 - Math.exp(-5 * dt);
    if (settled) { c.pos[0] += (tx - c.pos[0]) * k; c.pos[2] += (tz - c.pos[2]) * k; c.anim.act = { ...SIT_CLIP }; }
    gd.speed = 0; c.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null;
    st.down = settled && c.anim.actShown > 0.5;
  }
}
/** everybody up, the frame's memory gone (resetGuards / restartEncounter: the men are new objects) */
/** the man the mode is held on, for a checkpoint (savestate.ts PlayerSnap.heldGait rides with it, SAVETIMELINE.holds): the mode lets go further out than it takes
 *  hold (modeOutM over modeM), so between the two a load that forgot him stood Sam out of the mode he was saved in */
export function closeModeSnapshot(g: Game): number | undefined { return STATE.get(g)?.mode?.char.id; }
export function closeModeRestore(g: Game, id: unknown): void { if (typeof id !== 'number') return; const gd = g.guards.find(x => x.char.id === id && x.state !== 'dead'); if (gd) stateOf(g).mode = gd; }
export function closeReset(g: Game) { const S = STATE.get(g); if (!S) return; for (const gd of [...S.seats.keys()]) closeUnseat(g, gd); S.best = null; S.t = -1; S.mode = null; S.modeD = Infinity; S.rmbT = -1; }
export function closeSummary(g: Game): string {
  const S = stateOf(g), T = CLOSE_STATS.takes, G = CLOSE_STATS.grabs; const o = S.t === g.time ? S.best : null;
  return `${CLOSE.on ? 'on' : 'off'} · ${S.mode ? `in the mode on ${S.mode.callsign} ${S.modeD.toFixed(2)} m` : 'not in the mode'} · now ${o ? `${o.guard.callsign} ${closeKindOf(o)} ${o.dist.toFixed(2)} m` : '—'} · takes b${T.behind} s${T.side} f${T.front} c${T.seat} · grabs b${G.behind} c${G.seat} · seated ${S.seats.size}`;
}
