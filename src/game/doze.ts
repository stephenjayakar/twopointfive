// DOZING IN THE DARK — a calm guard in an unlit room has a reason to be there (the maintainer, 2026-10-13: "i wonder if we even just want to have guards
// sleeping in dark rooms or something like that. like snoozing off in a chair. it should make sense why they're hanging out when they can't see.").
//
// BEFORE: a staff man whose route has him WAIT in a place with no light stood there on his feet and stared into the black for the length of the wait.
// NOW (DOZE.on): a calm staff man who comes to a wait of `minWait` to `maxWait` seconds at a waypoint where the place is dark by the calm torch's own reading
// (calmtorch.ts workLit) and the floor he faces is dark too (darkfoe.ts darkFoeBlind: a man in the dark watching a LIT door is a picket, and stays one), with a free chair within `chairM` that is in the dark too, walks to the chair, sits down in it (close.ts closeSeat: the seated man the
// close-in mode already takes 'over a chair') and nods off: head down, torch dark, a 'z' over him that grows with his breath. His wait clock RUNS the whole time,
// so the level's timetable is close to what it was (not equal: he gets up at the chair, not at his stand, and leaves a second or two late): `riseSecs` before the wait is over he stretches, gets up and walks his route on.
//
// ASLEEP his eyes are shut (he sees nobody, no body, no light going out: guards.ts canSeeChar / pointInView / bodySeen ask dozeAsleep, so every reader of a
// man's eyes has it) and his ears are dull: guards.ts hearingCheck runs for him as for anybody, its small noises at `hearK` of a waking man's. WHAT WAKES HIM:
//   noise   anything hearingCheck counts at that bar: gunfire, a charge or a door kicked in (as loud to him as to anybody), a whistle that is his to answer
//           (whistle.ts: the nearest calm man in its reach), a door or furniture noise, glass, an enemy's footfall — a crouched step never does, a walking
//           step does beside his chair, a run does across the room
//   light   `lightAt` on the meter's scale on his face for `lightSecs` from anything but his own side's lamps: a weapon light, the room's lights coming on
//   bump    his chair shoved by anybody
//   the floor going up (an alarm, a body called in over the net, the mains cut: he is up with the rest, by their rules)
// A man woken by noise, light or a bump is SUSPICIOUS from the frame he wakes (`wakeAw`), placed on what woke him, rooted `stirSecs` while he comes round — and he
// does not doze again that run: the room has an awake man in it from then on. Taken from behind in his chair he never wakes at all. Asleep he says nothing and
// calls nobody on the radio (needs.ts partnerReply, guards.ts radioCaller / spokesman); he does count in on the radio check, eyes shut (one log line).
//
// AT A SCREEN (the maintainer's steer, the same day: "working on a computer in a dark room (with their face illuminated by light) could be a reasonable
// setting. it'd also interact with their attention being on the screen (and maybe even headphones on?) so they'd be less perceptive. and some probably some
// opportunities for funny writing too."). Where the chair is at one of the level's screens (a switchable in group 'monitors', the chair on its lit side) the
// same wait can be sat out AT it: he shifts the chair (`pullM` at most, to where a man facing the screen has room for his feet — which may be a hand AWAY from it), sits FACING it, switches it
// on if it was off — its light is on his face and in the room: a light like any other, to the meter and to every eye — and is at work: awake, eyes open and
// on the screen (he sees what is in front of him, which is the screen), headphones on (hearingCheck at `noises` for the small noises, `ears` for a footfall:
// dozeEar), a '♪' over him until something has reached him, and now and then a word for what is on it (SCREEN_LINES: a bubble, no radio, no log row; no line
// twice on the floor until all have been said). A wait under `napWait` prefers the screen, a longer one the sleep — one chair can be both. He is up for what
// gets any seated man up (a noise that does reach him: the net of awareness 0.3; a shove of his chair; the alarm; the mains — the screen dies with them),
// and for the screen going dark under his eyes ('light': up, looking at it). Got up by any of those, hauled out of the chair or put down in it, he leaves the screen ON, and it
// stays on (LEFT) for `idleSecs` with nobody at it, then blanks — or until the next man who sits to it gets up at the end of his wait: he switches it off. At the end of his wait a man
// switches off what he switched on, gets up and walks on, and the chair stays where he pulled it. `DOZE.screen` false = no screens: the men doze or stand,
// as before it (a recording from before the key replays so: journal.ts). THE SEAM with the attention rule (attention.ts, another goal's):
// how held attention narrows a man's EYES is that rule's. This file lends it the screen each frame he is at work (attentionLend, `lend`): with that rule on, a man
// off to the side of the screen is taken in at its `sideK` and the floor shows the thread and the ring. The hold ends by that rule (a man at the edge of his
// eye who has his awareness to its `breakGain`, a step that reaches him) and is lent again `lentBackSecs` on if he is still sat; he stays SAT until this file's
// own 0.3. His EARS stay this file's (`ears` / `noises` through dozeEar; the lend passes 1 and 1), so the headphones count once and work with that rule's
// switch off. With it off, or `lend` off, his eyes are whole. That rule holds nobody on a loud squad floor (its own `able`), and it keeps the lend for a
// quarter second after the last call: a man got up at the end of his wait walks his first steps with the thread still on the dark screen.
//
// The switch: OFF in the module and on the harness's frozen stand (TPS_DOZE=1 raises it there); the page turns it on (host/profile.ts pageSwitches; ?nodoze = every
// man stands his wait, as it was). Off = the build as it was by run digest: every export below returns on its first line. It needs close.ts's seat (CLOSE.on).
// A recording from before the key replays with it off (journal.ts applyKnobs). CHECK: tools/qa/doze-check.ts (`probes.ts doze`; DOZE_BREAK=1 must fail).
// NEVER SEEN ON A GPU: the slump (character.ts `slump`), the chair under him, the 'z' and the '♪', the screen's light on a seated man's face and in the room,
// the chair pulled up are numbers nobody has looked at. He makes NO SOUND yet: a breath or a
// snore is the sound table's to add (dozeBreath below is its phase).
import type { Game, Guard, LightTarget } from './game';
import type { Prop } from './props';
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import { goTo, followPath, escalationOf, lightEstimateAt, notGettingAnywhere, hearingCheck } from './guards';
import { workLit } from './calmtorch';
import { darkFoeBlind } from './darkfoe';
import { CLOSE, closeSeat, closeUnseat, closeSeated, closeHasSeat } from './close';
import { attentionLend } from './attention';
import { PLAYER_ID } from './consts';
import { simRandom } from '../math/dice';
import { mathsEpoch } from '../math/exact';

/** the switch and its numbers. `minWait` s: the shortest wait he sits one out for · `maxWait` s: the longest (a man stood somewhere longer than this is POSTED
 *  there: a picket, not a man pausing on his round) · `chairM`: how far from his waypoint the chair may stand (straight; the walk to
 *  it may be `chairM` × 1.6) · `nodSecs`: seated this long his eyes close · `riseSecs`: he is up this long before the wait ends · `hearK`: his ears asleep, as a
 *  share of a waking man's (the small noises: a step, a door, furniture, glass, a silenced round) · `lightAt` / `lightSecs`: light on his face, on the meter's 0‥1 scale, for this
 *  long · `askSecs`: how often the light is read · `wakeAw`: the awareness he wakes with (0.3 = suspicious, 0.85 = alert) · `bumpAw`: the same for a shoved chair
 *  · `stirSecs`: rooted while he comes round · `breathSecs`: one breath (the 'z' grows over it). UNTUNED by eye and by hand: first numbers. */
export const DOZE = { on: false, minWait: 20, maxWait: 90, chairM: 4.5, nodSecs: 2.5, riseSecs: 2.0, hearK: 0.6, lightAt: 0.3, lightSecs: 0.8, askSecs: 0.25, wakeAw: 0.55, bumpAw: 0.7, stirSecs: 1.3, breathSecs: 3.6,
  /** AT A SCREEN (below): `screen` = the rule's own half-switch (false = every such man dozes or stands, as before it) · `screenM`: the chair is this near the
   *  screen, on its lit side, and `pullM` is how far he will pull a chair up to it · `napWait`: a wait this long sleeps in a chair before it sits to a screen, a shorter one the other way round · `settleSecs`: seated
   *  this long he is at work · `ears` / `noises`: headphones on — a footfall and every other small noise at his
   *  ear, as shares · `sayFirst` / `sayEvery` [from, to] s: his first mutter at the screen, and the gap to each one after · `idleSecs`: a screen a man was got up from, or hauled away from, stays lit this long with nobody at it, then blanks ·
   *  `lend`: at work his attention is lent to the screen (attention.ts: the narrowed eye, the thread, the ring) — off = his eyes whole, as before the wiring */
  screen: true, screenM: 1.5, pullM: 0.5, napWait: 40, settleSecs: 1.2, ears: 0.5, noises: 0.6, sayFirst: [5, 11], sayEvery: [16, 30], idleSecs: 60, lend: true };

export type DozeWhy = 'noise' | 'light' | 'bump' | 'alarm' | 'net' | 'time' | 'taken';
type Phase = 'no' | 'going' | 'down' | 'asleep' | 'work' | 'stir' | 'up' | 'spent';
/** one man's record. `no` = this wait was looked at and has no chair for him (asked once a wait) · `going` = on his way to the chair · `down` = seated, eyes
 *  open · `asleep` · `work` = at his screen, awake · `stir` = woken, coming round · `up` = risen at the end of his wait, a moment clear of the chair · `spent` = woken once: awake for the run */
interface Doze { phase: Phase; wp: number; chair: Prop | null; mon: LightTarget | null; monWas: boolean; say: number; to: Vec3; at: Vec3; face: number; cx: number; cz: number; cyaw: number; t: number; seen: number; until: number; lit: number; ask: number; push: number; why: DozeWhy | null; wokeAt: number; }
const GAMES = new WeakMap<Game, Map<Guard, Doze>>();
const REC = new WeakMap<Guard, Doze>();
const SAID = new WeakMap<Game, number[]>();
const TOUCH = new Int32Array(96);
/** how far, and which way, a man will pull a chair up: every 5 cm offset inside `pullM`, nearest first (built on first use) */
let PULLS: [number, number][] | null = null, PULLS_M = -1, PULLS_E = -1;   // (PULLS_E: sorted by lengths, so by the maths of the day — math/exact.ts)
function pulls(): [number, number][] {
  if (!PULLS || PULLS_M !== DOZE.pullM || PULLS_E !== mathsEpoch) { PULLS = []; PULLS_M = DOZE.pullM; PULLS_E = mathsEpoch; const n = Math.ceil(DOZE.pullM / 0.05);
    for (let ix = -n; ix <= n; ix++) for (let iz = -n; iz <= n; iz++) if (Math.hypot(ix, iz) * 0.05 <= DOZE.pullM + 1e-6) PULLS.push([ix * 0.05, iz * 0.05]);
    PULLS.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]) || a[0] - b[0] || a[1] - b[1]); }
  return PULLS;
}
const mapOf = (g: Game) => { let m = GAMES.get(g); if (!m) { m = new Map(); GAMES.set(g, m); } return m; };
export const DOZE_STATS = { sat: 0, slept: 0, worked: 0, lines: 0, rose: 0, woke: { noise: 0, light: 0, bump: 0, alarm: 0, net: 0, taken: 0 } };
/** QA: every wake, in order */
export const DOZE_LOG: { t: number; who: string; why: DozeWhy; secs: number }[] = [];

const flat = (a: ArrayLike<number>, x: number, z: number) => Math.hypot(a[0] - x, a[2] - z);
/** which way a man in this chair faces (levelKit.ts chair: the back is on local +Z) */
const chairFace = (p: Prop) => Math.atan2(-Math.sin(p.yaw), -Math.cos(p.yaw));
/** the run is one a man may doze in: somebody home in their heads, the close-in seat there to sit him, not a show, not a lesson, the floor calm */
function live(g: Game): boolean {
  return DOZE.on && CLOSE.on && g.aiEnabled && !g.quietUtility && !g.touring && !g.puppet && !g.player.down && !g.level.scenarios?.lesson && escalationOf(g) === 0 && !g.alarm.episode && !g.blackout.active;
}
/** HE is a staff man on a calm patrol with nothing on his mind or in his hands */
function calm(g: Game, gd: Guard): boolean {
  return gd.team === 'guard' && !gd.unit && !gd.civ && gd.state === 'patrol' && gd.awareness < 0.15 && !gd.held && !gd.script && !gd.task && !gd.bodyDuty && !gd.pinned && !gd.leader && !gd.post && !gd.drawn;
}
function put(g: Game, gd: Guard, D: Doze) { mapOf(g).set(gd, D); REC.set(gd, D); }
function drop(g: Game, gd: Guard) { mapOf(g).delete(gd); REC.delete(gd); gd.char.anim.slump = 0; }
/** the man at a screen is taken off the books (the switch off, the roster changed, a reset): what he switched on goes off with him */
function dark(D: Doze) { if (D.phase === 'work' && D.mon && !D.monWas) D.mon.on = false; }
/** the screens a man was got up from, or hauled away from, and LEFT LIT (he switched it on; nobody has switched it off), each with the game time it goes
 *  dark by itself (`idleSecs`: a screen nobody touches blanks) — sooner if the next man who sits to it gets up at the end of his wait: he switches it off
 *  as if it were his own. In the checkpoint. */
const LEFT = new WeakMap<Game, Map<LightTarget, number>>();
function leftLit(g: Game, D: Doze) { if (D.phase !== 'work' || !D.mon || D.monWas || !D.mon.on || D.mon.broken) return; let L = LEFT.get(g); if (!L) LEFT.set(g, L = new Map()); L.set(D.mon, g.time + DOZE.idleSecs); }
function leftOff(g: Game) { const L = LEFT.get(g); if (!L) return; for (const t of L.keys()) t.on = false; LEFT.delete(g); }
function leftTick(g: Game) { const L = LEFT.get(g); if (!L) return; if (!DOZE.on) { leftOff(g); return; }
  for (const [t, at] of L) if (g.time >= at || !t.on || t.broken) { if (t.on && !t.broken) t.on = false; L.delete(t); } if (!L.size) LEFT.delete(g); }
const blank = (phase: Phase, wp: number, t: number): Doze => ({ phase, wp, chair: null, mon: null, monWas: false, say: -1, to: [0, 0, 0], at: [0, 0, 0], face: 0, cx: 0, cz: 0, cyaw: 0, t: 0, seen: t, until: 0, lit: -1, ask: 0, push: 0, why: null, wokeAt: -1 });

interface Seat { chair: Prop; at: Vec3; face: number; mon: LightTarget | null; to: Vec3 }
const walkLen = (g: Game, from: ArrayLike<number>, to: Vec3): number => { const path = g.col.nav.findPath(from as Vec3, to); if (!path) return Infinity; let len = 0, prev: ArrayLike<number> = from; for (const q of path) { len += flat(prev, q[0], q[2]); prev = q; } return len; };
const seated = (D: Doze) => D.phase === 'down' || D.phase === 'asleep' || D.phase === 'work';
const span = (r: number[]) => r[0] + simRandom() * (r[1] - r[0]);
/** WHAT HE SAYS TO HIS SCREEN (a bubble over him, nothing on the net, no log row): the night shift's paperwork. `dozeLines()` hands them to the words lint. */
const SCREEN_LINES = [
  'password expired. of course it has.',
  'reply all. he replied all.',
  '…and it\'s frozen. wonderful.',
  'who formats a duty roster like this.',
  'no. no, I saved that.',
  'page two of two. there is no page two.',
  'the overtime form wants a form.',
  'mandatory fun. who writes these.',
  'loading… still loading.',
  'printer offline. it\'s right there.',
  'one more hand. then the rounds.',
  'unread, unread, unread. all him.',
];
export function dozeLines(): string[] { return [...SCREEN_LINES]; }
/** A CHAIR AT A SCREEN: a monitor of the level's (a switchable in group 'monitors', not shot out, nobody else at it) with this chair near it, on its lit side.
 *  He sits FACING it, `screenM` or nearer — so he pulls the chair up: the seat is the place nearest where the chair stands (that place first, then up to
 *  `pullM` off it) from which a man facing the screen has free floor under him and the screen in his eye. He walks to that floor; the chair comes under him. */
function screenSeat(g: Game, gd: Guard, p: Prop): Seat | null {
  for (const t of g.targets) {
    if (t.group !== 'monitors' || t.kind !== 'emissive' || t.broken) continue;
    if (flat(t.pos, p.x, p.z) > DOZE.screenM + DOZE.pullM) continue;
    let used = false; for (const D of mapOf(g).values()) if (D.mon === t && D.phase !== 'no' && D.phase !== 'spent' && D.phase !== 'stir') used = true; if (used) continue;
    const n = t.areaLights?.[0]?.light.dir, eye = t.areaLights?.[0]?.light.pos ?? t.pos;
    for (const [ox, oz] of pulls()) {   // (nearest first: the first place that will do is the one)
      const ax = p.x + ox, az = p.z + oz, dx = ax - t.pos[0], dz = az - t.pos[2], d = Math.hypot(dx, dz); if (d < 0.5 || d > DOZE.screenM) continue;
      if (n && (n[0] * dx + n[2] * dz) / d < 0.5) continue;
      const rx = ax - dx / d * 0.33, rz = az - dz / d * 0.33;   // where the seat puts his feet (close.ts SIT_ADVANCE on from the chair): room for him to stand there, and the screen in his eye
      if (g.col.circleTouches(rx, rz, 0.27, 0.1, 1.5, TOUCH) !== 0 || g.col.segmentBlocked([rx, 1.05, rz], [eye[0], eye[1], eye[2]])) continue;   // (−1 = more boxes there than the list holds: furniture, not floor)
      // … and floor to walk to: that place itself, or the free floor nearest it with a clear step across (the walking grid is coarser than the gap between a cot and a crate)
      const to: Vec3 | null = g.col.nav.isBlocked(rx, rz) ? g.col.nav.nearestFreePoint(rx, rz) : [rx, 0, rz];
      if (!to || flat(to, rx, rz) > 0.8 || g.col.segmentBlocked([to[0], 0.3, to[2]], [rx, 0.3, rz])) continue;
      if (walkLen(g, gd.char.pos, to) > DOZE.chairM * 1.6) break;
      return { chair: p, at: [ax, 0, az], face: Math.atan2(-dx, -dz), mon: t, to };
    }
  }
  return null;
}
/** the chair for this wait and the way he will sit in it, or null. For a wait under `napWait` a chair at a screen (above) before a chair to sleep in; for a longer one the other way round. The chair: nearest of kind 'chair' inside `chairM`, at rest, in the dark as his waypoint is,
 *  nobody else's (another dozer's, a civilian's desk), a walk of no more than `chairM` × 1.6. The way he faces: as the chair stands if his knees have room that
 *  way, else the first of eight turns that has — he turns the chair to it as he sits. */
function findChair(g: Game, gd: Guard): Seat | null {
  const wp = gd.route.points[gd.wp]; let best: Seat | null = null, bd = DOZE.chairM, scr: Seat | null = null, sd = DOZE.chairM;
  for (const p of g.props.props) {
    if (p.def.kind !== 'chair' || !p.asleep) continue;
    const d = flat(wp, p.x, p.z); if (d >= bd && d >= sd) continue;
    let taken = false; for (const D of mapOf(g).values()) if (D.chair === p && D.phase !== 'no' && D.phase !== 'spent' && D.phase !== 'stir') { taken = true; break; }
    if (!taken) for (const cv of g.civilians) { const pts = cv.route?.points ?? []; for (let i = 0; i < pts.length; i++) if (cv.civ?.def.tasks?.[i] === 'sit' && flat(pts[i], p.x, p.z) < 0.8) taken = true; }
    if (taken) continue;
    if (DOZE.screen && d < sd) { const s = screenSeat(g, gd, p); if (s) { scr = s; sd = d; } }
    if (d >= bd || workLit(g, p.x, p.z)) continue;
    const f0 = chairFace(p); let face = NaN;
    for (let k = 0; k < 8 && isNaN(face); k++) { const f = f0 + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 4, sx = Math.sin(f), sz = Math.cos(f);
      if (g.col.nav.isBlocked(p.x + sx * 0.33, p.z + sz * 0.33) || g.col.segmentBlocked([p.x, 0.45, p.z], [p.x + sx * 0.85, 0.45, p.z + sz * 0.85])) continue;
      face = f; }
    if (isNaN(face)) continue;
    const to: Vec3 = [p.x + Math.sin(face) * 0.33, 0, p.z + Math.cos(face) * 0.33];
    if (walkLen(g, gd.char.pos, to) > DOZE.chairM * 1.6) continue;
    best = { chair: p, at: [p.x, 0, p.z], face, mon: null, to }; bd = d;
  }
  return (gd.route.wait[gd.wp] ?? 0) >= DOZE.napWait ? best ?? scr : scr ?? best;   // (the same chair can be both: a long sit is a sleep, a short one a look at the screen)
}

/** THE PATROL SEAM (guards.ts, the patrol branch's chain, after the needs): true = his feet are this file's this frame (walking to the chair). A man who has
 *  just come to a long wait in a dark place is asked once whether he has a chair; false at once for everybody else, and always with the switch off. */
export function dozePatrol(g: Game, gd: Guard, dt: number, walk: number): boolean {
  if (!DOZE.on) return false;
  let D = REC.get(gd);
  if (!D) {
    if (gd.wait < DOZE.minWait || !live(g) || !calm(g, gd)) return false;
    const wp = gd.route.points[gd.wp];
    // not a post (a wait past `maxWait`), not a lit place — and not a watch: a man in the dark with LIT floor before him can see what he is there to see
    // (darkfoe.ts darkFoeBlind, read as he comes onto the wait facing the way its author walked him onto it); the man who dozes is the one who cannot
    const c = (gd.route.wait[gd.wp] ?? 0) > DOZE.maxWait || workLit(g, wp[0], wp[2]) || !darkFoeBlind(g, gd) ? null : findChair(g, gd);
    if (!c) { put(g, gd, blank('no', gd.wp, g.time)); return false; }
    D = blank('going', gd.wp, g.time); D.chair = c.chair; D.face = c.face; D.at = c.at; D.cx = c.chair.x; D.cz = c.chair.z; D.mon = c.mon; D.to = c.to; put(g, gd, D);
  }
  if (D.phase === 'no') { if (gd.wait <= 0 || gd.wp !== D.wp) drop(g, gd); return false; }
  if (D.phase !== 'going') return false;
  const ch = D.chair!; D.seen = g.time;
  if (!live(g) || !calm(g, gd) || gd.hold || gd.wait < DOZE.riseSecs + DOZE.nodSecs + 4 || !ch.asleep && Math.hypot(ch.x - D.cx, ch.z - D.cz) > 0.15 || notGettingAnywhere(gd, dt, 6)) { const wp = D.wp; drop(g, gd); put(g, gd, blank('no', wp, g.time)); return false; }
  const to = D.to;
  goTo(g, gd, to);
  if (followPath(g, gd, dt, walk) || flat(gd.char.pos, to[0], to[2]) < 0.3) {
    gd.path = []; gd.pathGoal = null;
    if (!closeSeat(g, gd, D.at, D.face)) { const wp = D.wp; drop(g, gd); put(g, gd, blank('no', wp, g.time)); return false; }
    D.phase = 'down'; D.t = 0; D.cx = ch.x; D.cz = ch.z; D.cyaw = Math.atan2(-Math.sin(D.face), -Math.cos(D.face)); D.push = ch.pushT; DOZE_STATS.sat++;
  }
  gd.wait -= dt;   // (his wait runs while he walks to the chair — here, once: a frame this hands back to the patrol branch is counted there)
  return true;
}

/** out of the chair, whatever had him in it */
function up(g: Game, gd: Guard) { closeUnseat(g, gd); gd.char.anim.slump = 0; }   // (nothing without a seat)
/** WOKEN: he is up from this frame. Noise, light and a bump leave him suspicious, placed on what woke him (`at`; a noise is placed by hearingCheck) and rooted
 *  while he comes round; the floor's own business (`alarm`, `net`, `taken`) has him by its own rules. Either way he is awake for the rest of the run, and
 *  the chair is anybody's. */
function wake(g: Game, gd: Guard, D: Doze, why: Exclude<DozeWhy, 'time'>, at: ArrayLike<number> | null) {
  const slept = D.phase === 'asleep' || D.phase === 'work' ? D.t : 0; leftLit(g, D);
  up(g, gd); D.why = why; D.wokeAt = g.time; D.phase = 'spent'; D.chair = null; DOZE_STATS.woke[why]++; DOZE_LOG.push({ t: g.time, who: gd.callsign, why, secs: slept }); if (DOZE_LOG.length > 64) DOZE_LOG.shift();
  if (why === 'noise' || why === 'light' || why === 'bump') {
    gd.awareness = Math.max(gd.awareness, why === 'bump' ? DOZE.bumpAw : DOZE.wakeAw);
    if (at) gd.lastKnown = [at[0], 0, at[2]];
    D.phase = 'stir'; D.until = g.time + DOZE.stirSecs;
  }
}

/** THE SENSES SEAM (guards.ts updateGuard, in front of the perception block): true = he is asleep this frame and his senses were run here — his ears by
 *  hearingCheck itself at `hearK` (one copy of the gates: whose shot, whose grenade, which face of a pane), his eyes not at all. A sound that counted at that
 *  bar (it raised him, or gave him a place to look) wakes him. */
export function dozeDeaf(g: Game, gd: Guard): boolean {
  if (!DOZE.on) return false;
  const D = REC.get(gd); if (!D || D.phase !== 'asleep') return false;
  const aw = gd.awareness, lk = gd.lastKnown, st = gd.state;
  hearingCheck(g, gd, DOZE.hearK, false);
  if (gd.awareness > aw || gd.lastKnown !== lk || gd.state !== st) wake(g, gd, D, 'noise', null);
  gd.sawPlayerThisFrame = false; gd.sawFoeThisFrame = false;
  return true;
}

/** ONCE A FRAME, before close.ts's seats and the guards (game.ts): the seated men's clocks, the chair held under them, what wakes a sleeper that is not a sound,
 *  the rise at the end of the wait. Nothing with nobody on a record. */
export function dozeTick(g: Game, dt: number) {
  leftTick(g);
  const M = GAMES.get(g); if (!M || !M.size) return;
  for (const [gd, D] of M) {   // (a record dropped under the walk is safe: a Map's iterator takes deletes)
    if (D.phase === 'no' || D.phase === 'spent') { if (!DOZE.on) drop(g, gd); continue; }
    const c = gd.char;
    if (!DOZE.on || !g.guards.includes(gd) || gd.state === 'dead') { if (gd.state !== 'dead') dark(D); else leftLit(g, D);   /* (killed or put out at his screen: it is left lit like any other he was got away from) */ if (seated(D)) up(g, gd); drop(g, gd); continue; }
    if (D.phase === 'going') { if (g.time - D.seen > 0.5) drop(g, gd); continue; }   // (something else has his feet: a break, a word with a mate, a noise)
    if (D.phase === 'stir') { if (g.time >= D.until) D.phase = 'spent'; else gd.reactT = Math.max(gd.reactT, D.until - g.time); continue; }
    if (D.phase === 'up') { if (g.time >= D.until && (!D.chair || gd.state !== 'patrol' || flat(c.pos, D.chair.x, D.chair.z) > 0.75 || g.time >= D.until + 30)) drop(g, gd); continue; }   // (… and, calm, until he has stepped clear of the chair — `dozeInChair` keeps him no contact for it: a man getting up does not walk his chair across the room, and a chair one man pulled to the screen is not shoved a hand further by every man who sleeps in it after)
    if (!seated(D)) continue;
    const ch = D.chair!;
    if (gd.held) { leftLit(g, D); D.why = 'taken'; D.wokeAt = g.time; D.phase = 'spent'; D.chair = null; c.anim.slump = 0; DOZE_STATS.woke.taken++; continue; }   // (hauled out of the chair: player.ts has unseated him)
    if (Number.isNaN(D.push)) D.push = ch.pushT;   // (the first frame after a load: the furniture is put back after the men)
    if (ch.pushT > D.push + 1e-6) { const who = ch.lastWho === PLAYER_ID ? g.player.char.pos : g.guards.find(x => x.char.id === ch.lastWho)?.char.pos ?? c.pos; wake(g, gd, D, 'bump', who as Vec3); continue; }
    if (gd.state !== 'patrol' || gd.awareness >= 0.3) { wake(g, gd, D, 'net', null); continue; }
    if (!live(g) || gd.script || gd.task || gd.bodyDuty || !closeHasSeat(g, gd)) { wake(g, gd, D, 'alarm', null); continue; }   // (… or somebody else has had him up out of it: the panel, a reset of the seats)
    if (D.mon) { const k = 1 - Math.exp(-4 * dt); D.cx += (D.at[0] - D.cx) * k; D.cz += (D.at[2] - D.cz) * k; }   // (pulled up to his screen: the chair comes under him as he sits)
    ch.x = D.cx; ch.z = D.cz; ch.vx = ch.vz = ch.w = 0;   // the chair under him stays under him, turned the way he sits
    if (ch.yaw !== D.cyaw) { let dy = D.cyaw - ch.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.yaw = Math.abs(dy) < 0.02 ? D.cyaw : ch.yaw + dy * Math.min(1, 6 * dt); }
    ch.dirty = true; ch.place();
    if (gd.wait - dt <= DOZE.riseSecs) {   // the end of his wait: he stretches, gets up and walks on — and may sit the next one out (this frame of his wait is the patrol branch's to count: he is on his feet for it)
      if (D.phase === 'work' && D.mon && !D.monWas) D.mon.on = false;   // (he switches off what he switched on)
      up(g, gd); c.anim.tell('neck'); D.phase = 'up'; D.until = g.time + 1.2; DOZE_STATS.rose++; DOZE_LOG.push({ t: g.time, who: gd.callsign, why: 'time', secs: D.t }); if (DOZE_LOG.length > 64) DOZE_LOG.shift(); continue;
    }
    gd.wait -= dt; D.t += dt;
    if (D.phase === 'down') { c.anim.slump = D.mon ? 0.15 : 0.35;
      if (!closeSeated(g, gd) || gd.awareness >= 0.15) continue;   // (a man with something half on his mind neither shuts his eyes on it nor puts his headphones on)
      if (D.mon) { if (D.t >= DOZE.settleSecs) { D.phase = 'work'; D.t = 0; D.monWas = D.mon.on && !LEFT.get(g)?.delete(D.mon); D.mon.on = true; D.say = g.time + span(DOZE.sayFirst); DOZE_STATS.worked++; } }
      else if (D.t >= DOZE.nodSecs) { D.phase = 'asleep'; D.t = 0; D.lit = -1; D.ask = (c.id % 4) / 4 * DOZE.askSecs; DOZE_STATS.slept++; }
      continue; }
    if (D.phase === 'work') {   // AT HIS SCREEN: awake, the screen's light on his face, his mind on it — and now and then a word for it
      c.anim.slump = 0.3;
      if (D.mon && (D.mon.broken || !D.mon.on || D.t > 1 && D.mon.factor < 0.5)) { wake(g, gd, D, 'light', D.mon.pos); continue; }   // the screen died under his eyes (shot out, the OCP): THAT he notices
      if (D.mon && DOZE.lend) attentionLend(g, gd, D.mon.pos, { ears: 1, noises: 1 });   // (attention.ts: his attention is the screen's while he sits at it — the narrowed eye, the thread and the ring are that rule's. The HEADPHONES stay here, in dozeEar, so they count once and work with that rule's switch off: 1 and 1, said out loud — left out, `ears` is its own half)
      if (D.say >= 0 && g.time >= D.say && !(gd.bubble && g.time - gd.bubble.t < gd.bubble.dur + 1)) {
        let said = SAID.get(g); if (!said || said.length >= SCREEN_LINES.length) SAID.set(g, said = []);   // (the floor's own bag: no line twice until every line has been said — by anybody)
        const left: number[] = []; for (let i = 0; i < SCREEN_LINES.length; i++) if (!said.includes(i)) left.push(i);
        const k = left[Math.floor(simRandom() * left.length) % left.length]; said.push(k);
        D.say = g.time + span(DOZE.sayEvery); g.say(gd, SCREEN_LINES[k], false, false, false); DOZE_STATS.lines++; }
      continue; }
    c.anim.slump = 1;
    D.ask += dt; if (D.ask >= DOZE.askSecs) {   // light on his face from anything but his own side's lamps
      const head = c.bones.head ?? v3.add(c.pos, [0, 1.15, 0]);
      const L = faceLight(g, gd, head);
      D.lit = L < DOZE.lightAt ? -1 : D.lit < 0 ? 0 : D.lit + D.ask; D.ask = 0;   // (−1 = dark at the last read: the first lit read starts the clock, it is not yet time in the light)
      if (D.lit >= DOZE.lightSecs) { wake(g, gd, D, 'light', lampOn(g, gd, head)); continue; }
    }
  }
}

/** the light on a sleeper's face that is news to him: everything but his own side's lamps — and but the room's screens (a mate sat to one across the room, or
 *  left one on: a glow, not a lamp in his eyes) */
function faceLight(g: Game, gd: Guard, head: Vec3): number {
  const off: { enabled: boolean }[] = [];
  for (const t of g.targets) if (t.group === 'monitors' && t.areaLights) for (const al of t.areaLights) if (al.light.enabled) { al.light.enabled = false; off.push(al.light); }
  try { return g.visibilityOf(lightEstimateAt(g, head, owner => owner === gd.char.id || g.guards.some(x => x.char.id === owner && x.team === gd.team))); }
  finally { for (const l of off) l.enabled = true; }
}
/** where the light on his face comes from: the nearest carried lamp of another side that reaches his head through clear air (whoever carries it), else his own spot */
function lampOn(g: Game, gd: Guard, head: Vec3): Vec3 {
  let best: Vec3 | null = null, bd = 14;
  for (const l of g.engine.lights.lights) {
    if (!l.enabled || l.intensity <= 0 || !l.owner || l.owner === gd.char.id || g.guards.some(x => x.char.id === l.owner && x.team === gd.team)) continue;
    const d = v3.dist(l.pos, head); if (d >= bd || d > l.range || g.col.segmentBlocked(head, l.pos)) continue;
    best = [l.pos[0], 0, l.pos[2]]; bd = d;
  }
  return best ?? gd.char.pos;
}

/** game.ts updateProps: a man on his way down into, in, or just up out of his chair is no contact for the furniture (it must not skate off ahead of him) */
export function dozeInChair(gd: Guard): boolean {
  const D = REC.get(gd); if (!D || !D.chair) return false;
  return seated(D) || D.phase === 'up' || (D.phase === 'going' && flat(gd.char.pos, D.chair.x, D.chair.z) < 1.2);
}
/** is he asleep this frame (eyes shut: guards.ts witnessKill, the torch, the HUD) */
export function dozeAsleep(gd: Guard): boolean { return REC.get(gd)?.phase === 'asleep'; }
/** his torch is dark: sat down to it, or asleep (guards.ts poseFlashlight) */
export function dozeDark(gd: Guard): boolean { const D = REC.get(gd); return !!D && seated(D); }
/** for the neighbours: what he is at in his chair — 'asleep', at his 'screen' (awake, his mind on it), or null */
export function dozeAt(gd: Guard): 'asleep' | 'screen' | null { const p = REC.get(gd)?.phase; return p === 'asleep' ? 'asleep' : p === 'work' ? 'screen' : null; }
/** guards.ts, the perception block: his ears this frame — headphones on at his screen (`noises` for a door, a scrape, glass, a far shot; `ears` for a footfall), 1 for everybody else */
export function dozeEar(gd: Guard): readonly [noises: number, foot: number] { if (DOZE.on && REC.get(gd)?.phase === 'work') { EARS[0] = DOZE.noises; EARS[1] = DOZE.ears; return EARS; } return WHOLE; }
const EARS: [number, number] = [1, 1], WHOLE: readonly [number, number] = [1, 1];
/** for the neighbours: was he woken out of a doze inside the last `secs` seconds, and by what (null = no). A man shaken awake in the dark is the one man a
 *  rule about suspicious lamps may want to treat apart. */
export function dozeWoke(g: Game, gd: Guard, secs = 6): DozeWhy | null { const D = REC.get(gd); return D && D.why && D.why !== 'time' && D.wokeAt >= 0 && g.time - D.wokeAt < secs ? D.why : null; }
/** where he is in his breath, 0‥1 (the 'z'; a sound's clock when he is given one), or −1 awake */
export function dozeBreath(g: Game, gd: Guard): number { const D = REC.get(gd); return D && D.phase === 'asleep' ? (D.t % DOZE.breathSecs) / DOZE.breathSecs : -1; }
/** THE HUD's mark over a sleeping man: a 'z' that grows with each breath ('' = none) */
export function dozeMark(g: Game, gd: Guard): string { if (REC.get(gd)?.phase === 'work') return gd.awareness > 0.05 ? '' : '♪';   // (a man at his screen is awake: once something has reached him the HUD's own dots say how much)
  const b = dozeBreath(g, gd); return b < 0 ? '' : b < 1 / 3 ? 'z' : b < 2 / 3 ? 'zZ' : 'zZz'; }
/** QA / the panel: what the rule has of a man */
export function dozeOf(gd: Guard): Readonly<{ phase: Phase; why: DozeWhy | null; secs: number; wp: number }> | null { const D = REC.get(gd); return D ? { phase: D.phase, why: D.why, secs: D.t, wp: D.wp } : null; }
/** 'dozing ▸ Novak asleep 41 s · Reyes woken (noise)' */
export function dozeSummary(g: Game): string {
  if (!DOZE.on) return 'dozing ▸ off (every man stands his wait)';
  const rows: string[] = []; for (const [gd, D] of mapOf(g)) { if (D.phase === 'no') continue; rows.push(`${gd.callsign} ${D.phase === 'asleep' ? `asleep ${D.t.toFixed(0)} s` : D.phase === 'work' ? `at his screen ${D.t.toFixed(0)} s` : D.phase === 'spent' || D.phase === 'stir' ? `woken (${D.why})` : D.phase === 'going' ? 'to his chair' : D.phase === 'down' ? 'sitting down' : 'getting up'}`); }
  return `dozing ▸ ${rows.length ? rows.join(' · ') : 'nobody'}${CLOSE.on ? '' : ' · needs the close-in seat (CLOSE.on)'}`;
}
/** everybody up, the records gone (resetGuards / restartEncounter: the men are new objects) */
export function dozeReset(g: Game, load = false) { SAID.delete(g); if (load) LEFT.delete(g); else leftOff(g); const M = GAMES.get(g); if (!M) return; for (const [gd, D] of [...M]) { if (!load) dark(D); if (seated(D)) up(g, gd); drop(g, gd); } }   // (`load`: a checkpoint is being put back — the screens are the file's to set)

// ---- a checkpoint carries who sits where, who sleeps, who was woken and whose wait has no chair (no key with the switch off or nobody on a record)
export interface DozeSnap { men: { i: number; phase: Phase; wp: number; chair: number; mon?: number; monWas?: boolean; say?: number; to?: number[]; at: number[]; face: number; cx: number; cz: number; cyaw: number; t: number; until: number; lit: number; ask?: number; why: DozeWhy | null; wokeAt: number }[]; said?: number[]; left?: number[][] }
export function dozeSnapshot(g: Game): DozeSnap | null {
  const M = GAMES.get(g), said = SAID.get(g), left = [...LEFT.get(g) ?? []].map(([t, at]) => [g.targets.indexOf(t), at - g.time]).filter(e => e[0] >= 0); if (!DOZE.on || !M && !left.length || M && !M.size && !said?.length && !left.length) return null;
  const men: DozeSnap['men'] = [];
  for (const [gd, D] of M ?? []) { const i = g.guards.indexOf(gd); if (i < 0) continue;
    men.push({ i, phase: D.phase, wp: D.wp, chair: D.chair ? g.props.props.indexOf(D.chair) : -1, ...(D.mon ? { mon: g.targets.indexOf(D.mon), monWas: D.monWas, ...(D.say >= 0 ? { say: D.say - g.time } : null) } : null), ...(D.phase === 'going' ? { to: [D.to[0], D.to[1], D.to[2]] } : null), at: [D.at[0], D.at[1], D.at[2]], face: D.face, cx: D.cx, cz: D.cz, cyaw: D.cyaw, t: D.t, until: D.until - g.time, lit: D.lit, ask: D.ask, why: D.why, wokeAt: D.wokeAt < 0 ? -1 : g.time - D.wokeAt }); }
  return men.length || said?.length || left.length ? { men, ...(said?.length ? { said: [...said] } : null), ...(left.length ? { left } : null) } : null;
}
export function dozeRestore(g: Game, s: DozeSnap | null | undefined) {
  dozeReset(g, true); if (!s || !DOZE.on) return;
  if (s.said?.length) SAID.set(g, [...s.said]);
  if (s.left?.length) { const L = new Map<LightTarget, number>(); for (const [i, secs] of s.left) { const t = g.targets[i]; if (t) L.set(t, g.time + secs); } if (L.size) LEFT.set(g, L); }
  for (const m of s.men) { const gd = g.guards[m.i]; if (!gd || gd.state === 'dead') continue;
    const D = blank(m.phase, m.wp, g.time); D.chair = g.props.props[m.chair] ?? null; D.mon = m.mon !== undefined ? g.targets[m.mon] ?? null : null; D.monWas = !!m.monWas; D.say = m.say === undefined ? -1 : Math.max(0, g.time + m.say); D.at = [m.at[0], m.at[1], m.at[2]]; D.face = m.face; D.to = m.to ? [m.to[0], m.to[1], m.to[2]] : [D.at[0] + Math.sin(D.face) * 0.33, 0, D.at[2] + Math.cos(D.face) * 0.33];   /* (`say` is seconds from the save, and may be past due: a bubble was in its way. A file from before `to`: the floor in front of the chair, as it was then) */ D.cx = m.cx; D.cz = m.cz; D.cyaw = m.cyaw; D.t = m.t; D.until = g.time + m.until; D.lit = m.lit; D.ask = m.ask ?? 0; D.why = m.why; D.wokeAt = m.wokeAt < 0 ? -1 : g.time - m.wokeAt;
    if ((D.phase === 'going' || seated(D) || D.phase === 'up') && !D.chair) continue;
    if (D.phase === 'work' && !D.mon) continue;
    if (seated(D)) { gd.hold = false; if (!closeSeat(g, gd, D.at, D.face)) continue; D.push = NaN; gd.char.anim.slump = D.phase === 'asleep' ? 1 : D.phase === 'work' ? 0.3 : D.mon ? 0.15 : 0.35; }
    put(g, gd, D); }
}
