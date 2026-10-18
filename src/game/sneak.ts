// THE PARTNER SNEAKS — how a teammate FOLLOWS while the squad is silent and nobody has noticed it.
//
// The play note (10-08): "oh we also haven't tried anything with two person stealth yet, we should try this and polish". Measured on the build before this
// (tools/qa/pairsneak.ts, rebuild/pair-stealth/partner-sneaks.md): a silent teammate told to fall in walks UPRIGHT at the walk's pace whatever Sam does, closes
// up in bursts (his slowest pace is over Sam's crouch-walk), cuts straight to his place in the file — and stands or walks in a lit doorway a defender is looking
// at because Sam, low and quick, went through it a second earlier. The dark keeps him; the lit, watched stretches are where he gives the pair away.
//
// What he does differently with SNEAK.on, while he FOLLOWS (orders.ts 'fall in'), the squad is SILENT (silent.ts), not compromised, and no defender is hunting:
//   LOW WITH SAM   Sam crouched, he is crouched — and at Sam's own pace plus what closes the gap, with no floor under it (`minPace`): he creeps when Sam
//                  creeps instead of walking up and stopping. Low, his legs are asked for no more than `lowPace`. He is low whenever he waits or crosses, too.
//   IN SAM'S STEPS he walks Sam's own trail — every crumb of it, kept `trailM` long, not the last ten metres with a bee-line to his place: the line Sam chose
//                  through the dark is the line he takes, also when he is catching up from a wait. He closes to `back` metres further back than loud.
//   LOOKS BEFORE HE STEPS  the next `aheadM` of the trail is read a few times a second: how LIT each step is (the CPU's estimate of the direct light there, plus
//                  what Sam's own meter read there over that estimate as he walked it) and which defenders have a LINE to a crouched man on it (guards.ts's
//                  own eye: 16 m, head to chest or head) — and of those, who is LOOKING that way now (his cone, `coneDeg` wider: a glance travels). A step is
//                  EXPOSED when it is lit and has a line (or is inside `nearM` of a defender's eye, lit or not: a shape at his elbow is seen in the dark).
//   WAITS          an exposed stretch ahead that somebody is looking at: he stops short of it, low and still, where he is not exposed — and says so, once, over
//                  the net (`cue`: 'holding. it's lit and he's looking.'; after `nagSecs` 'can't cross while it's lit. he's still on it.' — the cue for Sam: put the light out,
//                  or go on without him). A stretch somebody IS looking at he never walks into; one too long to cross in a go (`crossM`) with a line
//                  on it but nobody looking, he gives `patience` seconds and then takes at the next moment nobody looks (0 = never).
//                  A door swinging shut between him and the man who was looking does not un-see it: he takes him to be looking still, for `memory` seconds.
//   CROSSES        the same stretch with every eye that has a line to it turned away: he goes, low, at `crossPace`, to the first step past it that is NOT
//                  exposed (past his place in the file if need be, never inside `standNear` of Sam) and does not stop in it. And LOOKED AT, when it is cheap:
//                  what the crossing would add to each looker's awareness by the eye's own arithmetic (light^1.5 × distance × the crouch), with a margin,
//                  inside `budget` — a step of dim light at range costs a watcher nothing; a man Sam has just stirred has none to spare.
//   STANDS IN THE DARK  Sam stopped: his place is the nearest step along the trail that is NOT exposed (lit with a line, whoever is looking) — on towards Sam
//                  or back the way they came, never the lit doorway behind Sam's shoulder; with no dark step short of Sam he holds in the dark behind and
//                  says so. No such step anywhere on the trail (it runs straight at an open door): he steps ASIDE, off the trail, out of the door's line (`side`). The cover's unasked step to see through a door (cover.ts) is not taken while he sneaks.
//   CLEAR OF A DOOR (`door`) Sam at a SHUT door, about to open it, and a defender beyond it: the lit steps in that man's line through the doorway (the frame read
//                  `doorPad` wider) are exposed as if it stood open — he waits short of them, or steps back / aside out of them, BEFORE the leaf moves, says
//                  so once, and is still when it opens — and until the leaf has been at rest `doorSettle` s (a leaf half way round hides a line for a moment only).
//   CAUGHT IN THE OPEN  seen where he stands (his OWN bones and his OWN meter, whatever the read of the trail said — a light came back on, a door swung open)
//                  and looked at, or stood still in it: to the same nearest dark step, at a creep — once, not hopping about (`hideGap`).
//   SENT TO A MARK (`post`) the rescue flow's cover, a move / cover of Sam's (never a hold): he walks there low while Sam is low, at no more than `lowPace`, and is low on it —
//                  a plain posted walk is upright at the brisk pace with the gun up, across whatever is lit on the way. Posture and pace only: he does not wait.
// What it does NOT do (other parts' seams): nothing once a defender is alert or searching or the squad is compromised (every rule returns null and he is the
// build's own follower — the compromise part's); no new order, no menu row (the orders part's); nothing for a man on a stack or a door tool's marks.
// HONEST LIMITS: the light AHEAD of him is the CPU's direct-light estimate (no bounce, no moon: guards.ts lightEstimateAt) plus what Sam's meter — the
// renderer's, in the page — read over it where Sam walked (`ambient`); his own meter where he STANDS is the renderer's too, and 'caught in the open' reads
// that. Headless both meters ARE the estimate, so the ambient term is untested there. He knows a defender only by the line from
// that man to the step he is about to take (he looks before he steps — he is not told who is behind a wall, and a wall is why he is safe from him);
// a defender who walks INTO view while he is mid-stretch is not predicted.
// A SKILL KNOB is left open (the play note: a partner's sneaking skill "can vary", "only the player is truly amazing at it"): SNEAK.skill scales how far he
// looks ahead and how wide he reads a glance — 1 = this competent partner; the page lists the call.
//
// OFF (the default; `?sneak` / SNEAK=on / the panel's row turn it on): every function below returns on its first line and orders.ts's follower is the build's
// own, frame for frame (the run digests agree). State is per Game in a WeakMap: nothing on the Game, in the digest or in a checkpoint. No dice.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { squadSilent, silentCompromised } from './silent';
import { pairUp, keptOn, PAIRUP, PAIRUP_STATS } from './pairup';
import { SPOTTED, spottedMode } from './spotted';
import { lightEstimateAt, GUARD_EYE, eyeContact, escalationOf, KEEN, type Eye } from './guards';
import { hostileTo } from './teams';
import { dozeAsleep } from './doze';
import { workComing } from './workthings';
import { loadCross } from './kitload';   // (what the sneaking man's card makes of a crossing's price: his shape over his pace)
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const SNEAK = {
  /** THE switch: off = the follower exactly as he was */
  on: false,
  /** low when Sam is low (and whenever he waits or crosses) */
  crouch: true,
  /** his legs: the least he is asked for while following (m/s; the loud file's is the walk, 1.5) · the most while low · across an exposed stretch */
  minPace: 0.5, lowPace: 1.45, crossPace: 1.6,
  /** sent to a MARK while he sneaks (the rescue flow's cover, a move / cover of Sam's): he goes there low while Sam is low, at the low pace */
  post: true,
  /** a crouched footfall's level while he sneaks (silent's walk is 0.2, Sam's crouch 0.125; 0 = silent's own) — "only the player is truly amazing" at it */
  step: 0.14,
  /** he walks Sam's own trail (off: his place is the build's, by its own route) · metres of it kept · metres further back than the loud file he closes to */
  trail: true, trailM: 60, back: 0.3,
  /** he looks before he steps (off: he never waits) · how far up the trail he reads · this lit (0‥1 on the meter's curve) is a lit step */
  look: true, aheadM: 2.4, litAt: 0.1,
  /** a step's light is the CPU's direct-light estimate PLUS what Sam's own meter read there over that estimate when he walked it (the moon, the bounce) */
  ambient: true,
  /** … and a man on a way of his OWN (sneakWalk: the stalk to a man's back — floor nobody has walked) reads every step of it by the estimate PLUS what his own
   *  meter reads over the estimate of where he stands: all of it on open ground when he stands on open ground (the moon the estimate has not got is on the
   *  yard ahead of him as it is on him), as a crumb carries Sam's where he or the step is under a roof. OFF here and on the frozen stand
   *  (`TPS_STALKAMBIENT=1`), ON in the page (`?stalkambient=0`). Off = the estimate alone, as it was. Honest limit: it is the light of where he STANDS — from
   *  under a roof's edge, or in a wall's moon shadow, the moonlit ground ahead still reads dark until he is in it; the stalk is read again every
   *  PAIR.stalkEvery, and he stops on the first read after his meter has risen. */
  stalkAmbient: false,
  /** a defender's cone is read this many degrees wider (a glance travels) · a step whose chest is inside this of an unwary defender's eye, in his near
   *  field, is exposed, lit or not (the eye's own point-blank rule is 1.8 m, eye to chest) */
  coneDeg: 25, nearM: 2.1,
  /** an exposed stretch longer than this is not crossed while anybody has a line to it (he waits for the light, not the glance) */
  crossM: 4.5,
  /** … for this long (s), then he goes at the next moment nobody looks (0 = for as long as it takes). A stretch somebody IS looking at he never walks into. */
  patience: 8,
  /** a crossing that has not made its far side in this long is let go of (s) */
  crossSecs: 8,
  /** a looked-at stretch is crossed all the same when the most stirred looker's awareness after it — his now + `margin` × what the eye's own arithmetic
   *  adds over the crossing — stays within this (suspicion starts at 0.3) */
  budget: 0.12, margin: 1.6,
  /** a man he saw looking at a lit stretch, and can no longer see (a door swung to between them): taken to be looking still for this long (s) */
  memory: 12,
  /** his words over the net when he waits (and after `nagSecs` of waiting, and when he comes on) — at most one every `cueGap` seconds */
  cue: true, nagSecs: 7, cueGap: 12,
  /** Sam stopped: he stands in the nearest unexposed spot along the trail (back within `standM` of his place, or on towards Sam but never inside
   *  `standNear` of him) rather than on a lit, seen one */
  stand: true, standM: 4, standNear: 0.8,
  /** … and with no such step on the trail (a corridor that runs straight at an open door: every step Sam took is in the doorway's line), a spot OFF it,
   *  within `sideM` of where he is, that is not exposed: he steps aside out of the door's line — never into a door frame, never onto Sam or a mate.
   *  A lit spot a defender would have a line to THROUGH AN OPEN DOORWAY but for its leaf is no such spot: a leaf swings (the door's FUNNEL: the lines from
   *  his eye through the frame's whole opening) */
  side: true, sideM: 2.6,
  /** … and where he will STOP on his way to such a spot is out of sight too: he pulls up within a quarter metre of it, on the side he comes from, so a
   *  spot centimetres past the edge of a door's line left him standing in the line (the points `sideStop` and half of it short of the spot, towards
   *  him, are read as well). 0 = only the spot itself is read, as it was. */
  sideStop: 0.25,
  /** … and a SHUT door Sam is at (inside `doorM` of its frame: he is about to pick, ease or push it) is taken as open already: a lit place in the line
   *  of a defender beyond it is no place to be stood when the leaf moves — he finds his dark step, or steps aside, BEFORE it opens and is still when it does */
  door: true, doorM: 1.8, doorPad: 0.4, doorSettle: 1.0,   // (doorPad: for a step of the TRAIL the shut frame's opening is read that much wider at both jambs — the man beyond it may have moved by the time it opens; a spot off the trail has `aside`'s own margin)
  /** caught where he stands (seen by his own bones and meter, and looked at or stood still): to the nearest dark step — not again inside `hideGap` s */
  hideGap: 2.5,
  /** how often his read of the way is redone (game seconds) */
  planSecs: 0.12,
  /** the partner's sneaking skill, 1 = this one. Under 1 he reads less of the way ahead and a narrower glance (0 = he never waits). The page's call. */
  skill: 1,
};
export const SNEAK_DEFAULTS: typeof SNEAK = JSON.parse(JSON.stringify(SNEAK));
const LS = 'twopointsix.sneak';
/** the panel's rows are kept per machine; `?sneak` (`=0` off) sets the switch for the visit; the harness sets it by SNEAK=on */
const KEPT = ['on', 'crouch', 'post', 'trail', 'look', 'stand', 'side', 'door', 'cue', 'patience', 'skill'] as const;
export function saveSneak() { try { const o: Record<string, boolean | number> = {}; for (const k of KEPT) if (SNEAK[k] !== SNEAK_DEFAULTS[k] && !(k === 'on' && PAIRUP.on)) o[k] = SNEAK[k];   /* (on by pairup.ts's switch is that switch's to keep, not this row's: what the store held stands) */ if (PAIRUP.on) { const was = keptOn(LS); if (was !== undefined && was !== SNEAK_DEFAULTS.on) o.on = was; } if (Object.keys(o).length) globalThis.localStorage?.setItem(LS, JSON.stringify(o)); else globalThis.localStorage?.removeItem(LS); } catch { /* no store */ } }
try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === typeof SNEAK[k]) (SNEAK as Record<string, unknown>)[k] = o[k]; } catch { /* no store, or not ours */ }
try { const q = new URLSearchParams(location.search); if (q.has('sneak')) SNEAK.on = q.get('sneak') !== '0'; } catch { /* no page (the harness) */ }
try { const e = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.SNEAK; if (e) SNEAK.on = e !== '0' && e.toLowerCase() !== 'off'; } catch { /* no process (the page) */ }

export const SNEAK_STATS = { waits: 0, waitS: 0, crossings: 0, shade: 0, backOffs: 0, asides: 0, cues: 0 };
/** what he did, newest last (QA; the panel's summary) */
export const SNEAK_LOG: { t: number; who: string; what: string; at: [number, number] }[] = [];

/** his words (over the net while they are silent: silent.ts hush) — the CUE: the first says he has stopped and why, the second what would bring him on */
const LINES = {
  wait: { lit: "holding. it's lit and he's looking.", near: "holding. too close while he's looking.", long: 'holding. too much open light to cross.', open: "holding in the dark. you're stood in the light.", door: "i'm off the door. ready when you are." },
  nag: { lit: "can't cross while it's lit. he's still on it.", near: "he's still facing me. waiting for his back.", long: "it's a long lit stretch. kill the light or go on.", open: "you're stood in the light. i'll hold in the dark.", door: '' },
  go: 'moving.',
};
/** why he waits: a lit stretch somebody is looking at · a dark one at a looking defender's elbow · a lit one too long to cross with a line on it · no dark step short of Sam · the way on is in the line of a shut door Sam is about to open */
type Why = keyof typeof LINES.wait;
type Mode = 'walk' | 'wait' | 'cross' | 'stand' | 'back';
interface Crumb { p: Vec3;
  /** its light as last read (0‥1), when, and for which posture */ lit: number; t: number; low: boolean;
  /** what Sam's OWN meter read over the CPU's direct-light estimate of where he stood as he dropped it (0‥1) — the light the estimate cannot have: the moon
   *  (guards.ts lightEstimateAt skips kind 2), the bounce. Sam's meter is the renderer's on the page: one model for his plan and the eyes on him · and that
   *  estimate then: the extra is scaled down with the direct light there (a lamp put out takes its bounce with it) */
  amb: number; cpu0: number }
interface Man {
  /** the crumb he has reached (an index into State.trail + State.off) · when he last followed · when a look for the trail last found none he can walk to */ i: number; t: number; lostT: number;
  mode: Mode; planT: number;
  /** a wait: when it began, what for, and whether its second line has been said */ waitT: number; why: Why; nagged: boolean; cueT: number; /** when ONE VOICE last kept a line of his back */ voiceT: number;
  /** a back-off: when it began · when the last one ended · the crumb it ended on (he stays low till he has moved on from it; −1: none) */ backT: number; hideT: number; hidI: number;
  /** the lit stretch he last saw somebody looking at: who, which crumbs (absolute), when he last saw it so */ mem: { h: Guard; a: number; b: number; t: number } | null;
  /** a crossing: the crumbs it starts and ends on, when it was decided */ crossFrom: number; crossTo: number; crossT: number;
  /** the dark step he has taken or is backing off to (−1: none) */ stand: number;
  /** … or the spot off the trail he has stepped aside to (null: none) · when a look for one last found none */ side: Vec3 | null; sideT: number;
  /** the crumbs to this frame's goal, for sneakWay (null: none laid) */ way: Vec3[] | null;
}
/** when each door's leaf was last seen to move (read at the plan's rate, for the doors Sam is at) */
const leafT = new SideMap<object, { a: number; t: number }>('sneak.leafT');
const leafMoved = (g: Game, d: { angle: number }): boolean => {
  let r = leafT.get(d); if (!r) leafT.set(d, r = { a: d.angle, t: -1e9 }); else if (Math.abs(r.a - d.angle) > 1e-4) { r.a = d.angle; r.t = g.time; } else if (g.time < r.t) r.t = -1e9;
  return g.time - r.t < SNEAK.doorSettle; };
interface State { trail: Crumb[]; off: number; t: number; men: WeakMap<Guard, Man>; list: Man[]; live: boolean; /** Sam's meter over the estimate, eased up slowly (a flash is not the light of a place) */ amb: number }
const states = new SideMap<Game, State>('sneak.states');
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const DEG = Math.PI / 180;
const note = (g: Game, gd: Guard, what: string) => { SNEAK_LOG.push({ t: g.time, who: gd.callsign, what, at: [gd.char.pos[0], gd.char.pos[2]] }); if (SNEAK_LOG.length > 300) SNEAK_LOG.splice(0, 100); };

/** the sneak is live for the squad this frame: the switch, the silent order standing and unbroken, Sam on his feet, and no defender hunting (one read a frame) */
const liveAt = new SideMap<Game, { t: number; v: boolean }>('sneak.liveAt');
export function sneakLive(g: Game): boolean {
  if (!SNEAK.on) return false;
  let L = liveAt.get(g); if (L && L.t === g.time) return L.v; if (!L) liveAt.set(g, L = { t: 0, v: false });
  // (pairup.ts 'hunted', with spotted.ts on: a defender hunting somewhere is not the end of it — the partner sneaks on until the PAIR is caught, which is
  //  spotted.ts's call: an alert man with his eyes on one of them, or loud in their ears. Its mode is last frame's here — it ticks after the first ask.)
  L.t = g.time; L.v = squadSilent(g) && !silentCompromised(g) && !g.player.down && (pairUp('hunted') && SPOTTED.on
    ? !g.orders.squad().some(gd => gd.state !== 'dead' && spottedMode(g, gd) === 'caught')
    : !g.guards.some(h => (h.state === 'alert' || h.state === 'search') && h.team !== 'operative' && h.team !== 'civilian'));
  return L.v;
}
const mate = (gd: Guard) => gd.team === 'operative' && !!gd.unit;
/** this teammate is under the sneak this frame (orders.ts: no unasked cover step while he is) */
export function sneaking(g: Game, gd: Guard): boolean { return SNEAK.on && mate(gd) && sneakLive(g); }
/** he is low because Sam is (orders.ts: also while he steps out of Sam's way, which is the order's own move) */
export function sneakLow(g: Game, gd: Guard): boolean { return SNEAK.on && SNEAK.crouch && g.player.crouch && sneaking(g, gd); }
/** a walk to a MARK an order or the level's flow gave him (orders.ts, the posted leg): the pace he keeps to, low — null: the order's own carriage */
export function sneakPost(g: Game, gd: Guard, order: string): number | null { return SNEAK.post && sneakLow(g, gd) && POSTED.includes(order) ? SNEAK.lowPace : null; }
const POSTED = ['move', 'cover'];   // (never a stack or a door tool's marks: those carriages are the door's — and never a HOLD: a man told to hold is the orders part's, as he stands)
/** a crouched, sneaking teammate's footfall — null: silent's own (silent.ts silentStep asks first) */
export function sneakStep(g: Game, gd: Guard): number | null { return SNEAK.on && SNEAK.step > 0 && gd.char.anim.crouch > 0.5 && sneaking(g, gd) ? SNEAK.step : null; }
/** what he is doing, for a HUD's line (null: nothing to say — he is walking with Sam) */
export function sneakWord(g: Game, gd: Guard): string | null {
  if (!SNEAK.on) return null; const M = states.get(g)?.men.get(gd); if (!M || !sneaking(g, gd)) return null;
  return M.mode === 'wait' ? (M.why === 'door' ? 'clear of the door' : M.why === 'lit' || M.why === 'near' ? 'waiting on eyes' : 'waiting on the light') : M.mode === 'cross' ? 'crossing' : M.mode === 'back' ? 'backing off' : null;
}

// ------------------------------------------------------------ what a step is exposed to
/** the defenders whose eyes matter to this man: alive, his enemies, inside an eye's reach of him (plus the stretch he reads), not dazzled */
function eyesFor(g: Game, gd: Guard): Guard[] {
  const out: Guard[] = [], p = gd.char.pos, R = GUARD_EYE.range + SNEAK.aheadM + SNEAK.standM;
  for (const h of g.guards) if (h !== gd && h.state !== 'dead' && hostileTo(h, gd) && flat(h.char.pos, p) < R && g.time >= h.dazzledUntil && !dozeAsleep(h)) out.push(h);   // (doze.ts: nor asleep in his chair)
  return out;
}
/** chest and head of a man stood on a spot, low and upright (the operative's bones as the rig poses them: the eye test's two points) */
const LOW_Y = [0.81, 0.98], UP_Y = [1.27, 1.5];
const cpuLit = (g: Game, a: Vec3, b: Vec3, own?: (o: number) => boolean, steady = true) => g.visibilityOf(Math.max(lightEstimateAt(g, a, own, steady), lightEstimateAt(g, b, own, steady)));
/** how lit a spot is to a man low or upright on it (0‥1, the meter's own curve over the CPU's direct-light estimate, plus Sam's meter's extra there; read at
 *  most twice a second per crumb) */
function litAt(g: Game, C: Crumb, low: boolean): number {
  if (C.low === low && g.time - C.t < 0.4 && g.time >= C.t) return C.lit;
  const p = C.p, Y = low ? LOW_Y : UP_Y, cpu = cpuLit(g, [p[0], Y[0], p[2]], [p[0], Y[1], p[2]]);
  C.t = g.time; C.low = low; return C.lit = Math.min(1, cpu + C.amb * (C.cpu0 > 0.03 ? Math.min(1, cpu / C.cpu0) : 1));
}
/** a defender's eye exactly as guards.ts canSeeChar builds it, its cones `wide` degrees wider (a glance travels) */
function eyeFor(h: Guard, wide: number): Eye {
  const c = h.char;
  return { pos: c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]), look: v3.normalize(v3.lerp(c.chestDir, c.headDir(), 0.5)), range: GUARD_EYE.range, halfDeg: Math.min(180, GUARD_EYE.halfDeg + wide), nearM: GUARD_EYE.nearM, nearDeg: Math.min(180, GUARD_EYE.nearDeg + wide) };
}
/** a man stood on a spot, as the eye test takes its target: a chest and a head */
const standIn = (p: Vec3, low: boolean) => { const Y = low ? LOW_Y : UP_Y; return { pos: p, alive: true, bones: { chest: [p[0], Y[0], p[2]], head: [p[0], Y[1], p[2]] } } as unknown as Character; };
interface Exp { /** lit with a line from somebody, or at a defender's elbow with one — no place to STAND */ seen: boolean; /** … and he is looking that way now — no place to STEP */ watched: boolean; /** (it is the elbow, in the dark) */ near: boolean; by: Guard | null }
const NONE: Exp = { seen: false, watched: false, near: false, by: null };
/** A target's exposure by guards.ts's own eye test (eyeContact: reach, cone, statics and leaves to chest or head): a LINE from each defender (the test with the
 *  cone opened right round), how lit the target is (asked once, only if somebody has a line), and whether that defender is LOOKING (the cone, widened) */
function read(g: Game, eyes: Guard[], pc: Character, lit: () => number): Exp {
  let seen = false, watched = false, near = false, by: Guard | null = null, L = -1; const wide = SNEAK.coneDeg * SNEAK.skill;
  for (const h of eyes) {
    const E = eyeFor(h, wide), r = eyeContact(g, { ...E, halfDeg: 180, nearDeg: 180 }, pc, false, false, 1); if (!r.visible) continue;
    if (L < 0) L = lit();
    const elbow = r.dist < SNEAK.nearM; if (L < SNEAK.litAt && !elbow) continue;
    seen = true; if (L < SNEAK.litAt) near = true;
    if (eyeContact(g, E, pc, false, true, 1).inCone) { watched = true; by = h; break; }   // ('blind': the cone alone — the line is known)
  }
  return { seen, watched, near, by };
}
/** … of a step of the trail, for a man low or upright on it · of the man where he stands: his own bones, his own meter (the renderer's, in the page) */
const exposure = (g: Game, eyes: Guard[], C: Crumb, low: boolean) => read(g, eyes, standIn(C.p, low), () => litAt(g, C, low));
const exposureOf = (g: Game, eyes: Guard[], gd: Guard) => read(g, eyes, gd.char, () => gd.visibility);

/** What crossing the seen steps T[first..end) low at the crossing pace would leave on the most stirred looker: his awareness now + margin × Σ rate × time, the
 *  rate guards.ts sightGainOn's (detectRate × light^1.5 × distance × the crouch's 0.75 × the alarmed floor's keenness, 3.5 at point-blank) on this file's read
 *  of each step (his motion term and smoke are not priced: the margin is for them) */
/** the eye's rate on a man LOW on a step: guards.ts sightGainOn's arithmetic (and its ×2.2 for a man already hunting — only ever met under pairup.ts 'hunted':
 *  alone, the sneak is not live while anybody hunts) */
function eyeRate(g: Game, h: Guard, lit: number, dist: number, keen: number, low = true): number {
  let rate = g.tune.detectRate * Math.pow(lit, 1.5) * clamp(1 - (dist - 3) / 13, 0.2, 1) * (low ? 0.75 : 1) * keen; if (dist < 1.8) rate = Math.max(rate, 3.5);
  return h.state === 'alert' || h.state === 'search' ? rate * 2.2 : rate;
}
function crossCost(g: Game, eyes: Guard[], T: Crumb[], first: number, end: number): number {
  let worst = 0; const wide = SNEAK.coneDeg * SNEAK.skill, keen = escalationOf(g) >= 1 ? KEEN : 1;
  for (const h of eyes) {
    let add = 0; const E = eyeFor(h, wide);
    for (let k = first; k < end; k++) {
      const r = eyeContact(g, E, standIn(T[k].p, true), false, false, 1); if (!r.visible) continue;
      add += eyeRate(g, h, litAt(g, T[k], true), r.dist, keen) * Math.max(0.4, flat(T[k].p, T[Math.min(T.length - 1, k + 1)].p)) / SNEAK.crossPace;
    }
    if (add > 0) worst = Math.max(worst, h.awareness + SNEAK.margin * add);
  }
  return worst;
}

// ------------------------------------------------------------ the same eye, for a man who is NOT following (pairup.ts 'oneEye': pairorders.ts's stalk)
const cellLit = new SideMap<Game, Map<number, [number, number]>>('sneak.cellLit');
const keptLines = new SideMap<Guard, { x: number; z: number; t: number; low: boolean; map: Map<number, number> }>('sneak.keptLines');
/** how lit a nav cell is to a man low or upright on it: the same read as a crumb's (the meter's curve over the CPU's steady direct light at his chest and
 *  head, whoever's lamp it is), without the crumb's extra off Sam's own meter — nobody has stood there (sneakWalk adds the walker's own under SNEAK.stalkAmbient). Kept per cell for `age` seconds: two for pricing a route, a crumb's own 0.4 for
 *  the verdict on a walk (a carried torch sweeps onto a cell quicker than two seconds). */
function litCell(g: Game, x: number, z: number, low: boolean, age = 2): number {
  let C = cellLit.get(g); if (!C) cellLit.set(g, C = new Map()); if (C.size > 8000) C.clear();
  const c = g.col.nav.cell, ix = Math.floor(x / c), iz = Math.floor(z / c), key = (ix + 4096 * iz) * 2 + (low ? 1 : 0), was = C.get(key), t = g.time;
  if (was && t >= was[1] && t - was[1] < age) return was[0];
  const px = (ix + 0.5) * c, pz = (iz + 0.5) * c, Y = low ? LOW_Y : UP_Y, v = cpuLit(g, [px, Y[0], pz], [px, Y[1], pz]);
  C.set(key, [v, t]); return v;
}
export interface SneakWalk {
  /** a man on this floor would be LOOKED AT: lit (the sneak's bar) or at an elbow, with a line, inside a defender's cone as the sneak widens it — `wider` more
   *  degrees for a route's pricing (a way is planned round where a head may be in a second, not only where it is) */
  watched(x: number, z: number, wider?: boolean): boolean;
  /** what walking `pts` at `pace` would leave on the most stirred watcher: his awareness now + margin × Σ rate × time, as a crossing is priced (crossCost) —
   *  0: nobody would see a step of it (a step counts as the follower counts one: lit by the sneak's bar, or at an elbow). Steps within `skipM` of `skip` are not asked (the man's own back). Compare with SNEAK.budget. */
  cost(pts: Vec3[], pace: number, skip?: Vec3, skipM?: number): number;
  /** the watcher `cost` found worst (null: none) */
  by: Guard | null;
}
/** The sneak's eye over any walk by `gd`: every living defender hostile to him and not dazzled, each as guards.ts builds his eye (and, where `habit` gives
 *  the way he MOSTLY looks, a second time looking that way — the worse of the two counts, never both). */
export function sneakWalk(g: Game, gd: Guard, low: boolean, habit?: (h: Guard) => [number, number] | null): SneakWalk {
  PAIRUP_STATS.eyeAsks++;
  const wide = SNEAK.coneDeg * SNEAK.skill, WIDER = 15, keen = escalationOf(g) >= 1 ? KEEN : 1;
  /** one defender: his eye as he looks now and (where known) as he mostly looks, each also `WIDER`; the cone opened right round asks the LINE alone */
  interface Man { h: Guard; x: number; z: number; open: Eye; looks: { E: Eye; Ew: Eye; lx: number; lz: number }[]; line: Map<number, number>; kept: Map<number, number> }
  const men: Man[] = [];
  /** the lines a ROUTE IS PRICED by are kept between asks, per defender, while his eye has not moved a hand's breadth — two seconds at most (a leaf swings).
   *  What a walk COSTS (the verdict) always asks afresh. */
  const keptOf = (h: Guard, x: number, z: number): Map<number, number> => { let K = keptLines.get(h);
    if (!K || K.low !== low || g.time - K.t > 2 || g.time < K.t || Math.hypot(K.x - x, K.z - z) > 0.12) keptLines.set(h, K = { x, z, t: g.time, low, map: new Map() });
    return K.map; };
  const look = (E: Eye) => { const L = Math.hypot(E.look[0], E.look[2]) || 1; return { E, Ew: { ...E, halfDeg: Math.min(180, E.halfDeg + WIDER), nearDeg: Math.min(180, E.nearDeg + WIDER) }, lx: E.look[0] / L, lz: E.look[2] / L }; };
  for (const h of g.guards) { if (h === gd || h.state === 'dead' || !hostileTo(h, gd) || g.time < h.dazzledUntil || dozeAsleep(h)) continue;
    const E = eyeFor(h, wide), H = habit?.(h);
    men.push({ h, x: E.pos[0], z: E.pos[2], open: { ...E, halfDeg: 180, nearDeg: 180 }, looks: H ? [look(E), look({ ...E, look: [H[0], 0, H[1]] })] : [look(E)], line: new Map(), kept: keptOf(h, E.pos[0], E.pos[2]) }); }
  const R = GUARD_EYE.range + 0.5, cell = (x: number, z: number) => Math.floor(x / 0.25) + 4096 * Math.floor(z / 0.25);
  // SNEAK.stalkAmbient: what his own meter (Guard.visibility — the renderer's in the page, what a defender's eye reads for him) shows over the estimate of where
  // he stands is on the way ahead too. Stood under the open sky it is the sky's — the moon — and every open step has all of it; under a roof, or for a step
  // under one (weather.ts underRoof: the footprints in force), it is carried as a crumb carries Sam's (litAt: in proportion to the step's own direct light).
  // THE METER'S OWN LAG IS NOT THE LIGHT OF A PLACE (as Sam's crumbs have it — track): Guard.visibility is eased (rate 6), so for a fifth of a second after he
  // steps out of a lamp pool it still reads the lamp over an estimate of dark floor. The excess is taken off the LOWER of the eased meter and what the meter
  // reads this frame (Guard.irradiance through the meter's curve): a meter still falling from a brighter place adds nothing, one still rising adds what it has
  // reached. No state of its own, so a replay or a loaded game reads the same. Meter within 0.05 of the estimate (a lamp with no bounce to speak of; the
  // headless stand-in wherever its own estimate agrees with cpuLit's): nothing changes.
  let amb = 0, cpu0 = 0, open0 = false; const roofs = new Map<number, boolean>();
  if (SNEAK.stalkAmbient) { const c = gd.char, p = c.pos; cpu0 = cpuLit(g, c.bones.chest ?? [p[0], 1.2, p[2]], c.bones.head ?? [p[0], 1.6, p[2]], undefined, false);
    amb = Math.max(0, Math.min(gd.visibility, g.visibilityOf(gd.irradiance)) - cpu0 - 0.05); open0 = amb > 0 && !g.weather.underRoof(p[0], p[2]); }
  const roofed = (x: number, z: number) => { const k = cell(x, z); let r = roofs.get(k); if (r === undefined) roofs.set(k, r = g.weather.underRoof(x, z)); return r; };
  const litOf = (x: number, z: number, age?: number) => { const v = litCell(g, x, z, low, age); return amb > 0 ? Math.min(1, v + amb * ((open0 && !roofed(x, z)) || cpu0 <= 0.03 ? 1 : Math.min(1, v / cpu0))) : v; };
  /** the cheap part first (reach, and the cone in plan with a little slack): most of the floor is behind everybody — then the eye test's own cone */
  const inCone = (m: Man, k: number, wider: boolean, x: number, z: number, pc: Character): boolean => { const L = m.looks[k], E = wider ? L.Ew : L.E, dx = x - m.x, dz = z - m.z, d = Math.hypot(dx, dz);
    if (d > R || (d > 0.3 && (dx * L.lx + dz * L.lz) / d <= Math.cos(Math.min(180, (d < E.nearM + 0.5 ? E.nearDeg : E.halfDeg) + 4) * DEG))) return false;
    return eyeContact(g, E, pc, false, true, 1).inCone; };   // ('blind': the cone alone)
  /** the LINE from a defender to a man on this floor (guards.ts's own: statics and leaves to chest or head), asked once per defender per quarter-metre — its length, or −1 */
  const line = (m: Man, x: number, z: number, pc: Character, fresh: boolean): number => { const key = cell(x, z); let v = m.line.get(key) ?? (fresh ? undefined : m.kept.get(key));
    if (v === undefined) { const r = eyeContact(g, m.open, pc, false, false, 1); v = r.visible ? r.dist : -1; m.line.set(key, v); m.kept.set(key, v); } return v; };
  const memo = new Map<number, boolean>();
  const W: SneakWalk = {
    by: null,
    watched(x, z, wider = false) {
      const key = cell(x, z) * 2 + (wider ? 1 : 0), was = memo.get(key); if (was !== undefined) return was;
      let lit = -1, r = false; const pc = standIn([x, 0, z], low);
      for (const m of men) { if (!m.looks.some((_, k) => inCone(m, k, wider, x, z, pc))) continue;
        const d = line(m, x, z, pc, false); if (d < 0) continue;
        if (d < SNEAK.nearM || (lit < 0 ? lit = litOf(x, z) : lit) >= SNEAK.litAt) { r = true; break; } }
      memo.set(key, r); return r;
    },
    cost(pts, pace, skip, skipM = 0.3) {
      const add = men.map(m => m.looks.map(() => 0)); let a = pts[0];
      for (let j = 1; j < pts.length; j++) { const b = pts[j], n = Math.max(1, Math.ceil(flat(a, b) / 0.25)), dt = flat(a, b) / n / Math.max(0.3, pace);
        for (let i = 1; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, z = a[2] + (b[2] - a[2]) * i / n; if (skip && Math.hypot(x - skip[0], z - skip[2]) <= skipM) continue;
          let lit = -1; const pc = standIn([x, 0, z], low);
          for (let q = 0; q < men.length; q++) { const m = men[q]; let rate = -1;
            for (let k = 0; k < m.looks.length; k++) { if (!inCone(m, k, false, x, z, pc)) continue;
              if (rate < 0) { const d = line(m, x, z, pc, true); if (d < 0) break; if (lit < 0) lit = litOf(x, z, 0.4);
                if (d >= SNEAK.nearM && lit < SNEAK.litAt) break;   // (not SEEN as the sneak reads a step — dim, and not at his elbow: it is not priced, as the follower would not stop for it)
                rate = eyeRate(g, m.h, lit, d, keen, low); }
              add[q][k] += rate * dt; } } }
        a = b; }
      let worst = 0; W.by = null;
      for (let q = 0; q < men.length; q++) { const v = Math.max(...add[q]); if (v <= 0) continue; const c = men[q].h.awareness + SNEAK.margin * v; if (c > worst) { worst = c; W.by = men[q].h; } }
      return worst;
    },
  };
  return W;
}

// ------------------------------------------------------------ the follower's seam (orders.ts tick)
/** Sam's trail, a crumb every 0.4 m (once a frame, whoever asks first) */
function track(g: Game, S: State) {
  if (S.t === g.time) return; const dt = g.time - S.t; S.t = g.time;
  const c = g.player.char, p = c.pos, T = S.trail, last = T[T.length - 1];
  if (dt < 0 || dt > 1 || (last && flat(last.p, p) > 3)) { S.off += T.length; T.length = 0; S.amb = 0; }   // (a load, a gap in the asking — nobody was sneaking —, a teleport: the old trail leads nowhere he walked)
  let cpu = 0;
  if (SNEAK.ambient) { cpu = cpuLit(g, c.bones.chest ?? [p[0], 1.2, p[2]], c.bones.head ?? [p[0], 1.6, p[2]], o => o === c.id, false);
    S.amb = Math.min(Math.max(0, g.player.visibility - cpu - 0.05), S.amb + 0.5 * Math.max(0, Math.min(dt, 0.1))); }   // (down at once, up at half a meter a second: a lightning stroke, a flicker, the meter's own lag are not the light of a place)
  else S.amb = 0;
  if (!T.length || flat(T[T.length - 1].p, p) >= 0.4) T.push({ p: [p[0], 0, p[2]], t: -1e9, lit: 0, low: true, amb: S.amb, cpu0: cpu });
  // kept `trailM` long — but never cut from under a man who is on it (a waiting man's crumb is his place: he waits as long as it takes), short of four times that
  const max = Math.ceil(SNEAK.trailM / 0.4);
  if (T.length > max) { let keep = T.length; S.list = S.list.filter(M => g.time - M.t < 5 && g.time >= M.t); for (const M of S.list) keep = Math.min(keep, M.i - S.off - 2);
    const cut = Math.max(T.length - 4 * max, Math.min(T.length - max, keep)); if (cut > 0) { T.splice(0, cut); S.off += cut; } }
}
/** orders.ts, once a tick with a squad under orders: Sam's trail is kept for as long as the squad sneaks, whoever is following — a man told to hold and then
 *  to fall in comes on by the steps Sam took meanwhile, read the same way. Null: not sneaking (and what was kept is dropped). */
export function sneakTick(g: Game): State | null {
  if (!SNEAK.on) return null;
  let S = states.get(g);
  if (!sneakLive(g)) { if (S && S.live) { S.live = false; S.trail.length = 0; S.men = new SideMap(); S.list = []; S.amb = 0; } return null; }
  if (!S) states.set(g, S = { trail: [], off: 0, t: -1e9, men: new SideMap(), list: [], live: true, amb: 0 });
  S.live = true; track(g, S); return S;
}
type Feet = { goal: Vec3 | null; speed: number; crouch: boolean; /** a move out of somebody's sight: not one the order's own holds may stop */ must?: boolean };
/** The sneaking follower's feet this frame — null: he is the build's own follower (the switch off, the squad loud or found out, a defender hunting).
 *  `goal` null = the order's own place stands. `back`: his place in the file, metres back along the trail · `samV`: Sam's pace as the file reads it. */
export function sneakFollow(g: Game, gd: Guard, back: number, samV: number, stopped: boolean, speed0: number): Feet | null {
  if (!SNEAK.on || !mate(gd)) return null;
  const S = sneakTick(g); if (!S) return null;
  const K = SNEAK, T = S.trail, p = gd.char.pos, pl = g.player;
  const low = K.crouch && !!pl.crouch;
  let M = S.men.get(gd);
  if (!M) { S.men.set(gd, M = { i: -1, t: g.time, lostT: -1e9, mode: 'walk', planT: -1e9, waitT: -1, why: 'lit', nagged: false, cueT: -1e9, voiceT: -1e9, backT: -1, hideT: -1e9, hidI: -1, mem: null, crossFrom: -1, crossTo: -1, crossT: -1, stand: -1, side: null, sideT: -1e9, way: null }); S.list.push(M); }
  else if (!S.list.includes(M)) S.list.push(M);
  M.t = g.time; M.way = null;
  const lowPace = (v: number, isLow: boolean) => isLow ? Math.min(v, K.lowPace) : v;
  const plain = (): Feet => ({ goal: null, speed: lowPace(speed0, low), crouch: low });   // (the order's own place and pace; low with Sam)
  if (!K.trail || T.length < 3) return plain();
  const idx = (k: number) => k - S.off, straight = (q: Vec3) => !g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]]);
  // where he is on the trail. Lost (never on it, shoved off it, cut from under him): the nearest crumb he can walk straight to — looked for twice a second
  let i = idx(M.i);
  if (i < 0 || i >= T.length || flat(p, T[i].p) > 3) {
    if (g.time - M.lostT < 0.5 && g.time >= M.lostT) return plain();
    i = -1; let bd = 1e9; for (let k = T.length - 1; k >= 0; k--) { const d = flat(p, T[k].p); if (d < bd - 0.05 && (d < 0.8 || g.col.nav.walkable(p, T[k].p))) { bd = d; i = k; } }
    if (i < 0) { M.lostT = g.time; return plain(); }
    M.mode = 'walk'; M.crossFrom = M.crossTo = M.stand = M.hidI = -1; M.mem = null; M.side = null;
  }
  // on: the furthest crumb he is standing on — or, where the trail doubles back past him (Sam in through a door and out again), the later pass of it a stride away
  for (let k = T.length - 1; k > i; k--) { const d = flat(p, T[k].p); if (d < 0.5 || (d < 0.9 && k - i > 12 && straight(T[k].p))) { i = k; break; } }
  // back: walking to a step behind him (a dark place to stand, a back-off), his place on the trail goes back with him
  if (M.mode === 'stand' || M.mode === 'back') { const s = idx(M.stand); if (s >= 0 && s < i) for (let k = s; k < i; k++) if (flat(p, T[k].p) < 0.45) { i = k; break; } }
  M.i = i + S.off;
  if (M.hidI >= 0 && Math.abs(M.i - M.hidI) >= 3) M.hidI = -1;
  // the trail from him to Sam, and his place on it
  const gap = back + K.back; let rem = 0; for (let k = i; k < T.length - 1; k++) rem += flat(T[k].p, T[k + 1].p); rem += flat(T[T.length - 1].p, pl.char.pos);
  let place = T.length - 1; { let a = flat(T[T.length - 1].p, pl.char.pos); while (place > 0 && a < gap) { a += flat(T[place].p, T[place - 1].p); place--; } }
  if (place < i) place = i;
  /** his posture in a mode: low with Sam; low whenever he waits, crosses or backs off — and after a back-off, until he has moved on from where it left him */
  const crouchOut = (m: Mode) => K.crouch && (low || m === 'wait' || m === 'cross' || m === 'back' || M!.hidI >= 0);
  // the read of the way, a few times a second (the plan stands in between)
  if (g.time - M.planT >= K.planSecs || g.time < M.planT) {
    M.planT = g.time;
    const eyes = K.look && K.skill > 0 ? eyesFor(g, gd) : [], lowWalk = crouchOut('walk');
    const memo = new Map<number, Exp>(), ex = (k: number, lo: boolean): Exp => { const key = k * 2 + (lo ? 1 : 0); let v = memo.get(key); if (!v) memo.set(key, v = exposure(g, eyes, T[k], lo)); return v; };
    const here = eyes.length ? exposureOf(g, eyes, gd) : NONE;
    // a crossing runs to its far side (or is let go of); a back-off to its step, or four seconds — the way shut, he stays put, low and still, the next best thing
    if (M.mode === 'cross') { const e = idx(M.crossTo); if (e < 0 || e >= T.length || i > e || flat(p, T[e].p) < 0.3 || g.time - M.crossT > K.crossSecs || g.time < M.crossT) { M.mode = 'walk'; M.crossFrom = M.crossTo = -1; } }
    if (M.mode === 'back') { const e = idx(M.stand), there = M.side ? flat(p, M.side) < 0.3 : e < 0 || e >= T.length || flat(p, T[e].p) < 0.3; if (there || g.time - M.backT > 4 || g.time < M.backT) { M.mode = 'walk'; M.hideT = g.time; M.hidI = M.i; } }
    // (a crossing decided but not yet begun — he is still a step short of its first exposed crumb — is read again: eyes that turn onto it stop him in the dark)
    if (M.mode !== 'back' && !(M.mode === 'cross' && i >= idx(M.crossFrom) - 1)) {
      let mode: Mode = 'walk', stand = -1, side: Vec3 | null = null, why: Why = M.why, from = -1, to = -1;
      /** the nearest step from crumb `at` that is not exposed (to a man low on it, or upright): on towards Sam (never inside `standNear` of him) or back the
       *  way they came, within `standM` — and not one a squad mate is stood on */
      const others = g.orders.men().filter(o => o !== gd);
      const dark = (at: number, self: boolean, lo: boolean, strict = false): number => {   // (strict, for a man CAUGHT: nor a step whose last stride — where he would be seen coming, or stop short — is exposed: a step hidden by a jamb's width, or by a leaf alone, is no place to creep to under a man's eyes)
        const shy = (k: number) => { const c = T[k].p, d = flat(p, c); return d > 0.4 && !unseenAt([c[0] + (p[0] - c[0]) * 0.35 / d, 0, c[2] + (p[2] - c[2]) * 0.35 / d], lo); };
        const ok = (k: number) => !(self && flat(p, T[k].p) < 0.3) && !ex(k, lo).seen && !others.some(o => flat(o.char.pos, T[k].p) < 0.7) && !inLine(k, lo) && !(strict && K.side && (!unseenAt(T[k].p, lo) || shy(k)));
        let fwd = -1, fd = 0, bwd = -1, bd = 0;
        for (let k = at + 1; k < T.length && fd < K.standM && (k <= place || flat(T[k].p, pl.char.pos) >= K.standNear); k++) { fd += flat(T[k].p, T[k - 1].p); if (ok(k)) { fwd = k; break; } }
        for (let k = at - 1; k >= 0 && bd < K.standM; k--) { bd += flat(T[k].p, T[k + 1].p); if (ok(k)) { bwd = k; break; } }
        return fwd >= 0 && (bwd < 0 || fd <= bd) ? fwd : bwd; };
      /** … and with none on the trail: a spot OFF it he can step straight to, not exposed to a man low or upright on it (its light the CPU's estimate plus
       *  the extra Sam's meter read on the crumb he is at), out of every door frame, clear of Sam and of his mates. The one he took stands while it holds;
       *  a look that finds none is not made again for a second. */
      const litSpot = (q: Vec3, lo: boolean): number => { const C = T[i], Y = lo ? LOW_Y : UP_Y, cpu = cpuLit(g, [q[0], Y[0], q[2]], [q[0], Y[1], q[2]]); return Math.min(1, cpu + C.amb * (C.cpu0 > 0.03 ? Math.min(1, cpu / C.cpu0) : 1)); };
      /** in an open door's funnel: some defender's eye, inside its reach, with the flat line from it to the spot through the frame's opening of a door that stands open */
      const samDoors = K.door && K.doorM > 0 ? g.doors.list.filter(d => flat(pl.char.pos, d.frameCentre) < K.doorM && (leafMoved(g, d) || Math.abs(d.angle) <= 0.03)) : [];   // (Sam is at it, and it is shut — about to open — or its leaf is still on the move, or came to rest inside `doorSettle`: a leaf half way round hides a line it will not hide in a moment)
      const openDoors = g.doors.list.filter(d => Math.abs(d.angle) > 0.03).concat(samDoors);   // (a leaf on the move counts: it is opening)
      const funnel = (q: Vec3, doors = openDoors, pad = 0): boolean => {
        for (const h of eyes) { const e = h.char.pos; if (flat(e, q) > GUARD_EYE.range) continue;
          for (const d of doors) { const cx = Math.cos(d.def.closedDir), cz = Math.sin(d.def.closedDir);
            const ax = d.def.hinge[0] - cx * pad, az = d.def.hinge[1] - cz * pad, bx = ax + cx * (d.def.width + 2 * pad), bz = az + cz * (d.def.width + 2 * pad);
            const o = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) => (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
            if (o(e[0], e[2], q[0], q[2], ax, az) * o(e[0], e[2], q[0], q[2], bx, bz) <= 0 && o(ax, az, bx, bz, e[0], e[2]) * o(ax, az, bx, bz, q[0], q[2]) <= 0) return true; } }
        return false; };
      /** crumb k is lit and in the line of a shut door Sam is about to open */
      const inLine = (k: number, lo: boolean): boolean => samDoors.length > 0 && funnel(T[k].p, samDoors, K.doorPad) && litAt(g, T[k], lo) >= K.litAt;
      const unseenAt = (q: Vec3, lo: boolean): boolean => { let L = -1; const lit = () => L < 0 ? L = litSpot(q, lo) : L;
        return !read(g, eyes, standIn(q, lo), lit).seen && !(funnel(q) && lit() >= K.litAt); };
      /** (`deep`: a spot to TAKE is unseen with that many metres to spare towards the trail — the edge of a jamb's shadow moves when the man beyond it turns his head; one he HOLDS need only be unseen) */
      const sideOk = (q: Vec3, lo: boolean, deep: number): boolean => {
        if (g.col.nav.isBlocked(q[0], q[2]) || flat(q, pl.char.pos) < K.standNear + 0.3 || others.some(o => flat(o.char.pos, q) < 0.7) || g.doors.list.some(d => flat(q, d.frameCentre) < 1.0)) return false;
        if (flat(p, q) > 0.3 && (!straight(q) || !g.col.nav.walkable(p, q))) return false;
        if (flat(q, T[i].p) > 2.7 || !unseenAt(q, lo)) return false;   // (… and inside the reach he is still ON the trail from: past 3 m of his crumb he is lost)
        if (K.sideStop > 0) { const dp = flat(p, q); if (dp > 0.3) for (const s of [K.sideStop / 2, K.sideStop]) if (!unseenAt([q[0] + (p[0] - q[0]) * s / dp, 0, q[2] + (p[2] - q[2]) * s / dp], lo)) return false; }   // (… and where he pulls up short of it)
        const c = T[i].p, d = flat(q, c); return deep <= 0 || d <= deep || unseenAt([q[0] + (c[0] - q[0]) * deep / d, 0, q[2] + (c[2] - q[2]) * deep / d], lo); };
      const aside = (lo: boolean, caught = false): Vec3 | null => {   // (caught: seen where he stands by his OWN meter — the spot he is on is no answer, whatever the estimate says)
        if (!K.side || K.sideM <= 0) return null;
        if (M!.side && !(caught && flat(p, M!.side) < 0.3) && flat(M!.side, T[i].p) < K.sideM + 1 && sideOk(M!.side, lo, 0)) return M!.side;
        if (g.time - M!.sideT < 1 && g.time >= M!.sideT) return null;   // (a search that found nothing is 144 spots read: not again for a second)
        let best: Vec3 | null = null, bd = 1e9;
        // (at a door Sam is opening the line WIDENS with every step back from the frame: a spot further from the door than he stands is priced up, and a
        // near one with the smaller margin is weighed against a far one with the full margin instead of losing to it unread)
        const dc = samDoors.length ? samDoors[0].frameCentre : null, d0 = dc ? flat(p, dc) : 0;
        for (const deep of [0.55, 0.3]) { if (best && !dc) break;
          for (let r = 0.6; r <= K.sideM + 1e-6; r += 0.4) for (let a = 0; a < 12; a++) { const q: Vec3 = [p[0] + r * Math.sin(a * Math.PI / 6), 0, p[2] + r * Math.cos(a * Math.PI / 6)];
            const d = r + 0.3 * flat(q, T[i].p) + (dc ? (deep < 0.5 ? 0.8 : 0) + 0.6 * Math.max(0, flat(q, dc) - d0) : 0); if (d < bd && sideOk(q, lo, deep)) { bd = d; best = q; } } }
        if (!best) M!.sideT = g.time;
        return best; };
      // (workthings.ts: a man is walking to the breaker over where he stands and Sam is going on — waiting for THAT man's back, or backing off down the
      //  way he is coming, is being walked into: he goes on after Sam across what he would have waited short of. Another man's eyes on the stretch, the
      //  line of a door Sam is at, Sam stood still with him at his place: each holds him as before)
      const coming = eyes.filter(h => workComing(g, gd, h)), onWalk = coming.length > 0 && (rem > gap + 0.5 || !stopped);
      if (eyes.length) {
        if (rem > gap + 0.5 || !stopped) {
          // walking: the next stretch of the trail, read a step at a time for the posture he walks in
          const reach = K.aheadM * Math.max(0.25, K.skill); let a = 0, first = -1;
          const k0 = flat(p, T[i].p) > 0.45 ? i : i + 1;   // (off the trail — told to fall in from where he held: the crumb he is making for is a step he is about to take)
          for (let k = k0; k <= place && a < reach; k++) { a += k === k0 ? flat(p, T[k].p) : flat(T[k - 1].p, T[k].p); if (ex(k, lowWalk).seen || inLine(k, lowWalk)) { first = k; break; } }
          if (first >= 0) {
            // the stretch: on to the first step past it where he can walk as he walks — past his place if need be, up to `standNear` of Sam — and, since he
            // crosses it LOW, whether anybody is looking at a crouched man on any of it. No such step (Sam himself is stood in it): he stays in the dark.
            let end = -1, len = 0, watched = false, lit = false, by: Guard | null = null, last = first;
            for (let k = first; k < T.length && k < first + 60; k++) { if (k > place && flat(T[k].p, pl.char.pos) < K.standNear) break;
              if (!ex(k, lowWalk).seen && !inLine(k, lowWalk)) { end = k; break; }
              const X = ex(k, true); watched = watched || X.watched; by = by ?? X.by; last = k; lit = lit || (X.seen && !X.near); if (k > first) len += flat(T[k - 1].p, T[k].p); }
            const tooLong = len > K.crossM, waited = M.mode === 'wait' && M.waitT >= 0 ? g.time - M.waitT : 0;
            // looked at, but a step or two of dim light at range costs a watcher next to nothing: what the crossing would ADD to each looker's awareness, by
            // the eye's own arithmetic on the read of each step, with a margin — inside `budget` he goes (and a man Sam has just stirred has none to spare)
            const cheap = end >= 0 && watched && !tooLong && crossCost(g, eyes, T, first, end) * loadCross(g, gd) <= K.budget;
            const walked = onWalk && ex(first, lowWalk).seen && (!by || coming.includes(by));
            if (end >= 0 && (walked || cheap || (!watched && (!tooLong || (K.patience > 0 && waited >= K.patience))))) { mode = 'cross'; from = first; to = end; }
            else if (!walked) { mode = 'wait'; why = watched ? (lit ? 'lit' : 'near') : !ex(first, lowWalk).seen ? 'door' : end < 0 ? 'open' : 'long'; }
            // (what he saw, kept: the looker, and the steps it was — a door swinging shut between them does not un-see it)
            M.mem = mode === 'wait' && watched && by && lit ? { h: by, a: first + S.off, b: last + S.off, t: g.time } : null;
          } else if (M.mem && !(onWalk && coming.includes(M.mem.h))) {
            // nothing reads exposed ahead — but a moment ago a man was looking at that lit stretch, and he cannot SEE that man now (the door between them
            // swung to on its closer): he takes him to be looking still, for `memory` seconds — unless the light on it has gone, or he is past it
            const m = M.mem, a = Math.max(0, idx(m.a)), b = Math.min(T.length - 1, idx(m.b)), hc = m.h.char;
            let lit = false; for (let k = a; k <= b && !lit; k++) lit = litAt(g, T[k], true) >= K.litAt;
            const sees = !g.col.segmentBlocked(gd.char.bones.head ?? [p[0], 1.0, p[2]], hc.bones.head ?? [hc.pos[0], 1.65, hc.pos[2]]);
            if (g.time - m.t > K.memory || g.time < m.t || m.h.state === 'dead' || idx(m.b) < 0 || i >= a || sees || !lit) M.mem = null;
            else { mode = 'wait'; why = 'lit'; }
          }
          // (… and stood IN the line of a shut door Sam is at: out of it first — the nearest step of the trail that is not, else a spot off it — and then he waits there)
          if (samDoors.length && mode !== 'cross' && funnel(p, samDoors, K.doorPad) && litAt(g, T[i], lowWalk) >= K.litAt) { /* (by where he STANDS, not the crumb he is nearest: stopped short of the line he is out of it, and stays put) */ const k = dark(i, true, lowWalk); if (k >= 0) { stand = k; mode = 'stand'; } else if ((side = aside(lowWalk))) mode = 'stand'; }
        } else if (K.stand && (ex(Math.min(place, T.length - 1), lowWalk).seen || inLine(Math.min(place, T.length - 1), lowWalk))) {
          // Sam stopped and he is at his place: if that is lit with a line (or at a defender's elbow), the nearest step along the trail that is not
          const k = dark(Math.min(place, T.length - 1), false, lowWalk); if (k >= 0) { stand = k; mode = 'stand'; }
          else if (flat(p, T[Math.min(place, T.length - 1)].p) < K.sideM + 0.5 && (side = aside(lowWalk))) mode = 'stand';
        }
        // CAUGHT: he is seen where he stands (his own bones, his own meter — whatever the read of the crumbs said): looked at, or stood still in it → the same
        // nearest dark step, either way along the trail, low. Not twice inside a few seconds: a man hopping about a doorway is worse than one low and still in it.
        if (mode !== 'stand' && !(onWalk && (!here.by || coming.includes(here.by))) && (here.watched || (here.seen && (mode === 'wait' || stopped))) && (g.time - M.hideT > K.hideGap || g.time < M.hideT)) {
          const k = dark(i, true, true, true); if (k >= 0) { stand = k; mode = 'back'; } else if ((side = aside(true, true))) mode = 'back'; }
        // (stood aside and not seen there: he keeps the spot while he waits, or while Sam stands — the trail's own steps are the seen ones)
        if (!side && M.side && (mode === 'wait' || (mode === 'walk' && stopped && rem <= gap + K.sideM + 0.5)) && K.side && flat(M.side, T[i].p) < K.sideM + 1 && sideOk(M.side, crouchOut(mode), 0)) side = M.side;
      }
      M.stand = stand >= 0 ? stand + S.off : -1; M.side = side;
      if (mode === 'cross') { M.crossFrom = from + S.off; M.crossTo = to + S.off; }
      // the words, and the tallies, on the change
      if (mode !== M.mode) {
        if (M.mode === 'wait') { SNEAK_STATS.waitS += g.time - M.waitT; if (mode === 'cross' && g.time - M.waitT > 1.5) cue(g, gd, M, LINES.go); M.waitT = -1; }
        if (mode === 'wait') { M.why = why; M.waitT = g.time; M.nagged = false; SNEAK_STATS.waits++; note(g, gd, `waits (${why})`); cue(g, gd, M, LINES.wait[why]); }
        if (mode === 'cross') { M.crossT = g.time; SNEAK_STATS.crossings++; note(g, gd, 'crosses'); }
        if (mode === 'stand') { SNEAK_STATS.shade++; if (side) SNEAK_STATS.asides++; note(g, gd, side ? 'steps aside, out of the line' : 'stands back in the dark'); }
        if (mode === 'back') { SNEAK_STATS.backOffs++; if (side) SNEAK_STATS.asides++; M.backT = g.time; note(g, gd, side ? 'backs off, aside' : 'backs off'); }
        M.mode = mode;
      } else if (mode === 'wait') M.why = why;
      if (M.mode === 'wait' && !M.nagged && g.time - M.waitT >= K.nagSecs && !(g.time >= M.voiceT && g.time - M.voiceT < 3)) M.nagged = cue(g, gd, M, LINES.nag[M.why], true);   // (kept owing while spotted.ts has the net — and a breath after its own last word: said once the net is his again)
    }
  }
  // his feet, by the plan — the way laid crumb by crumb (Sam's own steps, not the nav grid's cells: half a metre off his line is half a metre nearer a man)
  const lowNow = crouchOut(M.mode);
  const lay = (to: number): Vec3 => {
    const goal = T[to].p, path: Vec3[] = [];
    if (to >= i) for (let k = flat(p, T[i].p) > 0.45 ? i : i + 1; k <= to; k++) path.push([T[k].p[0], 0, T[k].p[2]]); else for (let k = i - 1; k >= to; k--) path.push([T[k].p[0], 0, T[k].p[2]]);
    M!.way = path.length && straight(path[0]) ? path : null;   // (null: the order's own planner finds the way to it)
    return goal; };
  // stood aside, or on his way there: the spot is his place — while he waits, and while Sam stands — till the way is clear or Sam moves on
  if (M.side && M.mode !== 'cross') return { goal: M.side, speed: flat(p, M.side) < 0.25 ? 0 : M.mode === 'back' ? Math.min(K.lowPace, 1.2) : lowPace(1.0, lowNow), crouch: lowNow, must: true };
  if (M.mode === 'wait') return { goal: null, speed: 0, crouch: lowNow };
  if (M.mode === 'stand' || M.mode === 'back') { const s = idx(M.stand);
    if (s >= 0 && s < T.length) return { goal: flat(p, T[s].p) < 0.3 ? T[s].p : lay(s), speed: M.mode === 'back' ? Math.min(K.lowPace, 1.2) : lowPace(1.0, lowNow), crouch: lowNow, must: true };
    if (M.mode === 'back') return { goal: null, speed: 0, crouch: lowNow }; }
  // walking Sam's steps: a goal a few crumbs up the trail (never past his place), at Sam's pace plus what closes the gap
  const toPlace = Math.max(0, rem - gap);
  if (toPlace < 0.25 && M.mode !== 'cross') return { goal: place > i ? lay(place) : T[place].p, speed: stopped && flat(p, T[place].p) < 0.3 ? 0 : lowPace(Math.max(K.minPace, samV), lowNow), crouch: lowNow };   // (onto the crumb itself: half a metre short of it can be half a metre into a doorway's light)
  let j = i, a = 0; const lim = M.mode === 'cross' ? Math.max(place, Math.min(T.length - 1, idx(M.crossTo))) : place; while (j < lim && a < 2.6) { a += flat(T[j].p, T[j + 1].p); j++; }
  const v = M.mode === 'cross' ? K.crossPace : Math.max(K.minPace, Math.min(2.2, samV + 1.5 * (toPlace - 0.3)));
  return { goal: j > i ? lay(j) : T[j].p, speed: lowPace(v, lowNow && M.mode !== 'cross'), crouch: lowNow };
}
/** orders.ts, right after the order is written (which drops his path when the goal moves): the way to this frame's goal is Sam's own crumbs, not the nav
 *  grid's cells. Laid when the runner would otherwise plan (no path, or one to another goal); a path it is already walking to this goal stands. (The crumbs
 *  are steps Sam's own body took, door frames included, so they go in as they are — not through goTo's door threading.) */
export function sneakWay(g: Game, gd: Guard, goal: Vec3) {
  if (!SNEAK.on) return; const M = states.get(g)?.men.get(gd); if (!M || !M.way) return;
  if (gd.pathGoal && flat(gd.pathGoal, goal) < 0.05 && gd.pathI < gd.path.length) return;
  gd.path = M.way; gd.pathI = 0; gd.pathGoal = [goal[0], 0, goal[2]]; gd.repathT = 0; M.way = null;
}
/** false only when ONE VOICE kept it back (the line is still owed) */
function cue(g: Game, gd: Guard, M: Man, line: string, force = false): boolean {
  if (!line || !SNEAK.cue || (!force && g.time - M.cueT < SNEAK.cueGap && g.time >= M.cueT)) return true;
  if (SPOTTED.on && spottedMode(g, gd) !== 'calm') { M.voiceT = g.time; return false; }   // (ONE VOICE, pairup.ts: while spotted.ts has him — a suspicious man about, or caught — its line is the cue)
  M.cueT = g.time; SNEAK_STATS.cues++; g.say(gd, line); return true;
}

export function sneakSummary(g: Game): string {
  if (!SNEAK.on) return 'off';
  if (!sneakLive(g)) return 'on · not live (the squad is loud, found out, or a defender is hunting)';
  const S = states.get(g), men = g.orders.men().map(gd => `${gd.callsign}: ${S?.men.get(gd)?.mode ?? 'not following'}`);
  return `on · ${men.join(' · ') || 'no squad'} · trail ${(S ? S.trail.length * 0.4 : 0).toFixed(0)} m · waits ${SNEAK_STATS.waits} crossings ${SNEAK_STATS.crossings} shade ${SNEAK_STATS.shade} back-offs ${SNEAK_STATS.backOffs}`;
}
