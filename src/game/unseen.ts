// UNSEEN — a squad nobody has found yet sneaks when Sam sneaks.
//
// The play note (10-10, the records clear on hard with the squad LOUD, him on a wall beside a window and two teammates stood tall in the open behind him): "if
// we're not compromised and i'm sneaking around to get into a better position, my teammates should do the same". Until this file a teammate only crept with Sam
// under the SILENT order with the pair's switch on (sneak.ts); a squad left loud — every squad mission's start — walked upright at the walk's pace behind a
// crouched Sam, torch on, boots at the walk's level, and shot the first man it saw through a window.
//
// No order and no menu row: they READ HIM. While the squad is under his orders, NOT COMPROMISED, and Sam is SNEAKING, every teammate is 'unseen':
//   SNEAKING       Sam crouched, on a wall (Q — back to it or stacked along it), or with the wheel's pace at or under `paceAt` of his walk — and not sprinting. It
//                  lasts `linger` seconds after he stops (he stood up to look, he came off the wall to step round a pot).
//   COMPROMISED    a shot, a charge or a boot in any teammate's ears inside the room fight's own hot clock (roomfight.ts hotFor: ROOMFIGHT.teamHot, 45 s), or any
//                  defender alert or searching. From that frame every rule here returns on its first line and they are the team as it fights today; with the
//                  floor calm again and Sam sneaking again, they sneak again.
//   A SILENT SQUAD (silent.ts's order) nobody has found follows his sneak in its CARRIAGE too — the orders.ts seams below ask unseenMan whatever the posture —
//   while every rule function stays the order's own for it (silent.ts: `silentMan ? the order's rule : this file's`), but for a crouched step, which is the
//   quieter of the two.
// What an unseen teammate does differently — each line has its knob, off = as it was:
//   crouch   LOW WITH SAM: he is crouched while Sam is — following, stepping out of Sam's way, and on a walk to a mark Sam sent him to (`post`: a move / cover,
//            never a hold, a stack or a door tool's marks: those carriages are the door's).
//   pace     following, his legs are asked for Sam's own pace plus what closes the gap, from `minPace` up — no floor at the walk (ORDERS.walk), so he creeps when
//            Sam creeps instead of walking up and stopping — and for no more than `lowPace` while low; nobody's legs for more than `cap` on any walk.
//   wall     ON SAM'S WALL: Sam with his back to a wall (or stacked on it), a follower's place is along that same face behind him, a body's width off it, in
//            file order — not back down the trail that brought Sam to the wall, which is the open ground in front of the window. Which side of Sam is where
//            the followers were when he took it (away from the end of the face when Sam has taken its corner), and stands while the hold does. A place off
//            the face's end, on blocked floor, round a corner of it, or one he would have to brush past Sam to reach: he keeps his place in the file and
//            takes a KNEE in it (nobody stands tall beside a man hugging a wall, and nobody crosses in front of him).
//   step     a footfall is filed at `lowStep` crouched and `walkStep` upright in place of the walk's 0.33 (silent.ts silentStep's seam: guards.ts's tread, and
//            pressure.ts's ears for the team's boots on Hard). His own skill, not Sam's 0.125.
//   lights   OFF BY DEFAULT (`lights`): with it on, weapon light and torch are off while Sam's own light is off (guards.ts attachFlashlight through silent.ts
//            silentDark). Left off because nobody asked for it: a teammate's light already burns only where it helps him (guards.ts LIGHTS) and his goggles
//            take it off in the dark (nvg.ts) — taking it off him where neither rule does is a man who cannot see, without an order having said so.
//   hush     what he would call out goes over the net (silent.ts silentHush) · doors are eased, not shouldered (silentEase).
//   hold     FIRE HELD on a defender who has not noticed anybody (awareness under SILENT.noticed, the silent order's own bar): the gun goes onto him and stays
//            there ('eyes on. holding.'), and the round goes the frame he notices — or the frame anything loud happens, since then nobody is unseen. Through
//            standing glass (`glass`) it is held until he is alert, as the silent order holds it. A quiet gun is not held; a hostage's last warning holds nothing.
//            `?sneakfire` = this one rule off: they shoot on sight while sneaking, as a loud squad always did.
//   cue      said once as it starts ('low and quiet.' — 'slow and quiet.' when Sam is only slow —, not again inside `cueGap`), and the squad line's word reads 'loud · sneaking' while it lasts.
// NOT here: nothing for a door tool's men (`entering`: an entry Sam ordered is the door's own carriage, pace, lights and rounds on sight), nothing under the
// silent ORDER (silent.ts asks its own rules for a silent man and these only for a loud one; the crouch, the pace and the wall are his either way), nothing once
// compromised, no waiting short of a lit stretch and no reading of who is looking (sneak.ts's follower, the silent pair's: where it answers, it has his feet
// and his place), no new order.
// NEVER a buff: no defender, meter or weapon is touched. It is only how a teammate carries himself, where he stands, and when he lets a round go.
//
// OFF (`?nosneakwith` for the visit; the harness's frozen stand holds it off, TPS_UNSEEN=1 raises it, TPS_PROFILE=shipped TPS_UNSEEN=0 is the page without it): every function returns on its first line and the game is the build before it,
// frame for frame. ON and Sam never sneaking (every scripted commander today): the same, by digest.
// Habits (coop-door-open-habits): no dice · reads the player's STATE (crouch, wall, pace, sprint, light), never the camera or the screen · `lead` is the one
// place that says which player · state is per Game in a WeakMap with a snapshot / restore pair below (no checkpoint is taken with a unit on the floor today).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Player } from './game';
import { hostileTo } from './teams';
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));

export const UNSEEN = {
  /** THE switch: off = the team exactly as it was */
  on: true,
  /** the wheel's pace at or under this share of his walk is sneaking (the notches: 1 · 0.87 · 0.74 · 0.61 · 0.48 · 0.35) · sneaking lasts this long after he stops (s) */
  paceAt: 0.5, linger: 1.5,
  /** low while Sam is low */
  crouch: true,
  /** following at Sam's pace plus what closes the gap (off: the file's own pace, capped) · the least his legs are asked for · the most while low · the gap's gain (1/s) */
  pace: true, minPace: 0.5, lowPace: 1.45, gain: 1.5,
  /** nobody's legs for more than this on any walk while unseen (m/s; 0 = no cap — the silent order's own is 1.6) */
  cap: 1.6,
  /** sent to a mark (a move, a cover) while Sam is low: he goes there low, at no more than `lowPace` */
  post: true,
  /** a follower's place is along the wall Sam is on · how far off the face a body stands (m) · and how much further he may be stood where that floor is shut ·
   *  how far past Sam along the face a man may be and still be dealt a place on Sam's other side (further: he would walk across Sam's front) · Sam nearer than this
   *  to one end of the face: the file stacks away from that end */
  wall: true, wallOff: 0.42, wallOut: 0.4, wallCross: 0.5, wallEnd: 1.6,
  /** quiet footfalls · a crouched one's level · an upright walking one's (the walk's is 0.33; the silent order's 0.2; Sam's crouch 0.125) */
  step: true, lowStep: 0.14, walkStep: 0.2,
  /** weapon lights and torches off while Sam's own is off · lines over the net · doors eased */
  lights: false, hush: true, doors: true,
  /** fire held on a defender who has not noticed anybody · and through standing glass until he is alert */
  hold: true, glass: true,
  /** said once as it starts · not again inside this many seconds */
  cue: true, cueGap: 30,
  /** A WALL HOLD COUNTS ONCE HIS BACK HAS BEEN ON IT A BEAT. Since a move key held into a wall takes the hold with no key of its own (wallsnap.ts `press`), a man
   *  walking upright who brushes a wall is on one for a moment, and the squad dropped into a sneak for that moment and `linger` after it. On: the hold counts
   *  from `wallSecs` after his back lands (the hold's own clock, `hitT`); a hold with no such clock (the wall feel pass off) counts at once, as before. Low, or
   *  with the wheel down, he is sneaking whatever the wall says. Off = any wall hold counts from its first step. */
  wallBeat: false, wallSecs: 0.8,
};
export const UNSEEN_DEFAULTS: typeof UNSEEN = JSON.parse(JSON.stringify(UNSEEN));
/** `?nosneakwith` (or `?sneakwith=0`) turns it off for the visit, `?sneakfire` the fire hold alone; the harness's frozen stand holds it off (src/host/standup.ts; TPS_UNSEEN=1 raises it, TPS_PROFILE=shipped plays it as the page) */
try { const q = new URLSearchParams(location.search); if (q.has('nosneakwith')) UNSEEN.on = false; else if (q.has('sneakwith')) UNSEEN.on = q.get('sneakwith') !== '0'; if (q.has('sneakfire')) UNSEEN.hold = q.get('sneakfire') === '0'; } catch { /* no page (the harness) */ }

export const UNSEEN_STATS = { spells: 0, seconds: 0, held: 0, heldGlass: 0, wallPlaces: 0, wallLost: 0, wallPast: 0, cues: 0 };
/** when it began and ended, newest last (QA) */
export const UNSEEN_LOG: { t: number; what: 'on' | 'off'; why: string }[] = [];

interface State {
  /** the frame this was last read on, and what it read */ t: number; live: boolean;
  /** when Sam was last sneaking · when the last spell's line was said */ sneakT: number; cueT: number;
  /** the wall hold the followers' side was chosen for, and the side (along the hold's own tangent) */ hold: object | null; sgn: 1 | -1;
  /** why it is not live (QA, the summary) */ why: string;
}
const states = new SideMap<Game, State>('unseen.states');
const stateOf = (g: Game): State => { let S = states.get(g); if (!S) states.set(g, S = { t: -1e9, live: false, sneakT: -1e9, cueT: -1e9, hold: null, sgn: 1, why: 'never asked' }); return S; };
/** which player the squad reads (one place: with a second player this asks whose squad it is) */
const lead = (g: Game): Player => g.player;
const mate = (gd: Guard) => gd.team === 'operative' && !!gd.unit;

const WALLBEAT_BREAK = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.WALLBEAT_BREAK === '1';
/** on a wall, as the sneak counts it (UNSEEN.wallBeat: his back on it `wallSecs`, where the hold keeps that clock) */
const onWall = (pl: Player): boolean => { const w = pl.wall; return !!w && (!UNSEEN.wallBeat || WALLBEAT_BREAK || w.hitT === undefined || w.hitT >= UNSEEN.wallSecs); };
/** Sam is sneaking: low, on a wall, or with the wheel right down — and not sprinting */
export function samSneaks(pl: Player): boolean { return !pl.down && !pl.sprinting && !pl.dash && (pl.crouch || onWall(pl) || pl.pace <= UNSEEN.paceAt + 1e-6); }
/** what has given the squad away (null: nothing): loud in a teammate's ears inside the room fight's hot clock, or a defender roused */
export function squadFound(g: Game, men: Guard[]): string | null {
  for (const gd of men) if (g.fight.hotFor(gd)) return 'loud';
  const m = men[0];
  for (const h of g.guards) if ((h.state === 'alert' || h.state === 'search') && hostileTo(h, m)) return h.state === 'alert' ? 'a defender alert' : 'a defender searching';
  return null;
}
/** The squad is unseen this frame (one read a frame, whoever asks first): the switch, a squad under Sam's orders, Sam sneaking (or inside `linger` of it), and
 *  nothing has given them away. */
export function unseenLive(g: Game): boolean {
  if (!UNSEEN.on) return false;
  const S = stateOf(g); if (S.t === g.time) return S.live;
  const was = S.live, dt = g.time - S.t; S.t = g.time;
  const pl = lead(g), O = g.orders;
  if (g.time < S.sneakT) S.sneakT = -1e9; if (g.time < S.cueT) S.cueT = -1e9;   // (a load: the clock has gone back)
  let why = '';
  if (!O.active) why = 'no squad under orders';
  else { const men = O.squad().filter(gd => gd.state !== 'dead');
    if (!men.length) why = 'no squad under orders';
    else { if (pl.sprinting || pl.down) S.sneakT = -1e9; else if (samSneaks(pl)) S.sneakT = g.time;
      if (g.time - S.sneakT > UNSEEN.linger) why = 'not sneaking'; else why = squadFound(g, men) ?? ''; } }
  S.live = !why; S.why = why;
  if (S.live && was && dt > 0 && dt < 1) UNSEEN_STATS.seconds += dt;
  if (S.live !== was) { UNSEEN_LOG.push({ t: g.time, what: S.live ? 'on' : 'off', why }); if (UNSEEN_LOG.length > 200) UNSEEN_LOG.splice(0, 100);
    if (S.live) { UNSEEN_STATS.spells++; cue(g, S); } else S.hold = null; }
  return S.live;
}
/** said once as a spell starts, by the first man following (over the net: he is hushed by then) */
function cue(g: Game, S: State) {
  if (!UNSEEN.cue || g.time - S.cueT < UNSEEN.cueGap) return;
  const gd = g.orders.squad().find(m => m.state !== 'dead' && m.state !== 'alert' && !m.held); if (!gd) return;
  S.cueT = g.time; UNSEEN_STATS.cues++; g.say(gd, lead(g).crouch || onWall(lead(g)) ? 'low and quiet.' : 'slow and quiet.');
}
/** this teammate is unseen this frame */
export function unseenMan(g: Game, gd: Guard): boolean { return UNSEEN.on && mate(gd) && unseenLive(g) && !entering(g, gd); }
/** he is one of a door tool's men right now (an entry Sam ordered, a threshold held): that work is the door's own — its pace, its lights, its rounds on sight.
 *  Sam crouched at the stack saying 'open and clear' has asked for the room, not for a creep into it. */
const entering = (g: Game, gd: Guard) => !!g.doorTools?.ops.some(op => op.men.includes(gd));
/** he is low because Sam is */
/** no place on Sam's wall for this man right now (the face ends, the floor along it is shut): he goes down on a knee where the file has him rather than stand tall beside a man hugging a wall */
const onWallAt = new SideMap<Guard, number>('unseen.onWallAt');
const kneelAt = new SideMap<Guard, number>('unseen.kneelAt');
const offWall = (g: Game, gd: Guard) => onWall(lead(g)) && (onWallAt.get(gd) !== g.time || kneelAt.get(gd) === g.time);
const lowNow = (g: Game, gd: Guard) => UNSEEN.crouch && (!!lead(g).crouch || (UNSEEN.wall && offWall(g, gd)));
export function unseenLow(g: Game, gd: Guard): boolean { return unseenMan(g, gd) && lowNow(g, gd); }

// ------------------------------------------------------------ the follower's seams (orders.ts tick)
/** A follower's legs and knee this frame — null: the file's own. `samV`: Sam's pace as the file reads it · `d`: how far he is off his place · `walk`: the
 *  file's walking pace (its floor, as it was) · `speed0`: what the file would have asked for. */
export function unseenFollow(g: Game, gd: Guard, samV: number, d: number, walk: number, speed0: number): { speed: number; crouch: boolean } | null {
  if (!unseenMan(g, gd)) return null;
  const K = UNSEEN, low = lowNow(g, gd), top = low ? Math.min(K.lowPace, walk) : walk;
  return { speed: K.pace ? clamp(samV + K.gain * (d - 0.3), Math.min(K.minPace, top), top) : Math.min(speed0, top), crouch: low };
}
/** a walk to a MARK an order gave him (the posted leg): the pace he keeps to, low — null: the order's own carriage */
export function unseenPost(g: Game, gd: Guard, order: string): number | null { return UNSEEN.post && POSTED.includes(order) && unseenLow(g, gd) ? UNSEEN.lowPace : null; }
const POSTED = ['move', 'cover'];
/** A follower's place while Sam is on a wall: along the same face, `back` metres from Sam on the side the file was on when he took it, a body's width off it
 *  — null: his place in the file as ever (no hold, the face ends short of it, the floor there is shut, or a wall stands between it and Sam). */
export function unseenWallSlot(g: Game, gd: Guard, back: number, file: Guard[]): Vec3 | null {
  const q = wallSlot(g, gd, back, file);
  if (q) { UNSEEN_STATS.wallPlaces++; onWallAt.set(gd, g.time); placed.set(gd, lead(g).wall!); } else placed.delete(gd);
  return q;
}
const placed = new SideMap<Guard, object>('unseen.placed');
/** the place just dealt was not taken after all (orders.ts: a doorway rule moved him off it) — he is in the open, so on a knee */
export function unseenWallLost(gd: Guard) { onWallAt.delete(gd); placed.delete(gd); UNSEEN_STATS.wallLost++; }
function wallSlot(g: Game, gd: Guard, back: number, file: Guard[]): Vec3 | null {
  if (!UNSEEN.wall || !unseenMan(g, gd)) return null;
  const pl = lead(g), w = pl.wall; if (!w || !onWall(pl)) return null;   // (wallBeat: a wall he has only brushed deals nobody a place along it)
  const S = stateOf(g), t = w.along, n = w.n, sam = pl.char.pos, su = sam[0] * t[0] + sam[2] * t[2];
  if (S.hold !== w) {   // the side, once a hold: away from the end of the face he has taken (the corner he is looking round is not where a file stacks) — else where the file is now — else behind the shoulder he leads with
    let m = 0; for (const o of file) m += o.char.pos[0] * t[0] + o.char.pos[2] * t[2] - su;
    const lo = su - w.lo, hi = w.hi - su;
    S.hold = w; S.sgn = Math.min(lo, hi) < UNSEEN.wallEnd && Math.abs(lo - hi) > 0.5 ? (lo > hi ? -1 : 1) : Math.abs(m) > 0.3 * Math.max(1, file.length) ? (m > 0 ? 1 : -1) : (w.side > 0 ? -1 : 1);
  }
  // one side of Sam only, and never a place he would have to walk past Sam along the face to reach (a man brushing by shoves Sam off his wall): the face
  // ending short of his place, the floor along it shut, or Sam between him and it — he keeps his place in the file, on a knee (lowNow)
  // (places are counted from Sam's STATION on the face, not from where a step-out round its end has him this frame — player.ts leanOff: the file holds still
  //  while he leans out and back instead of inching up behind him and being in his way as he returns; the 'past Sam' test below stays on where he really is)
  const c = gd.char.pos, sgn = S.sgn, u = su - (w.leanOff ?? 0) + sgn * back, R = 0.34;
  if (u < w.lo + R || u > w.hi - R) return null;
  if (placed.get(gd) !== w && (c[0] * t[0] + c[2] * t[2] - su) * sgn < -UNSEEN.wallCross) { UNSEEN_STATS.wallPast++; return null; }   // (a place he already has stands)
  for (const out of [0, UNSEEN.wallOut * 0.5, UNSEEN.wallOut]) {
    const off = w.d + UNSEEN.wallOff + out, q: Vec3 = [t[0] * u + n[0] * off, 0, t[2] * u + n[2] * off];
    if (g.col.nav.isBlocked(q[0], q[2])) continue;
    if (g.col.solidBlocked([sam[0], 0.45, sam[2]], [q[0], 0.45, q[2]])) break;   // (a partition end, a shut leaf, a cabinet against the face between him and Sam: not his place)
    if (!g.col.segmentBlocked([q[0], 1.35, q[2]], [q[0] - n[0] * (off - w.d + 0.5), 1.35, q[2] - n[2] * (off - w.d + 0.5)])) kneelAt.set(gd, g.time);   // (the face behind his chest is a window or a low wall: his place, on a knee under it)
    return q;
  }
  return null;
}

// ------------------------------------------------------------ the posture's seams (silent.ts asks each beside its own rule)
/** the most his legs may be asked for — null: no cap of this file's */
export function unseenPace(g: Game, gd: Guard): number | null { return UNSEEN.cap > 0 && unseenMan(g, gd) ? UNSEEN.cap : null; }
/** a footfall's level — null: his usual */
export function unseenStep(g: Game, gd: Guard): number | null { return UNSEEN.step && unseenMan(g, gd) ? (gd.char.anim.crouch > 0.5 ? UNSEEN.lowStep : UNSEEN.walkStep) : null; }
/** his weapon light / torch is held off: Sam's own is */
export function unseenDark(g: Game, gd: Guard): boolean {
  if (!UNSEEN.lights || !unseenMan(g, gd)) return false;
  const pl = lead(g); return !((pl.pistolUp && pl.pistol.lightOn) || (pl.rifleUp && pl.rifle.lightOn));
}
export function unseenHush(g: Game, gd: Guard): boolean { return UNSEEN.hush && unseenMan(g, gd); }
export function unseenEase(g: Game, gd: Guard): boolean { return UNSEEN.doors && unseenMan(g, gd); }
/** his round at `h` is held: nobody has found the squad, and this man has not noticed anybody (`noticed`: the silent order's own bar; `quiet`: his gun is a
 *  quiet one — never held; `urgent`: a hostage's life is on it) */
export function unseenHolds(g: Game, gd: Guard, h: Guard, noticed: number, quiet: boolean, urgent: () => boolean): boolean {
  if (!UNSEEN.hold || quiet || !unseenMan(g, gd) || g.fight.hotFor(gd)) return false;   // (hotFor asked again here: unseenLive is read once a frame, and a shot later in that frame must not hold this round)
  if (h.state === 'alert' || h.state === 'search' || h.awareness >= noticed || urgent()) return false;
  UNSEEN_STATS.held++; return true;
}
/** … and through standing glass the hold is the silent order's own (until the man is alert or searching): is that rule his this frame */
export function unseenGlass(g: Game, gd: Guard): boolean { return UNSEEN.hold && UNSEEN.glass && unseenMan(g, gd) && !g.fight.hotFor(gd); }   // (hotFor again, as in unseenHolds: a shot later in this frame ends the hold on this frame)
/** silent.ts's glass hold held a round under this rule (the count: QA and the summary) */
export function unseenGlassHeld() { UNSEEN_STATS.heldGlass++; }

// ------------------------------------------------------------ the HUD's word, QA, the save's pair
/** the squad line's word beside the posture (null: nothing to say) */
export function unseenWord(g: Game): string | null { return UNSEEN.on && unseenLive(g) ? 'sneaking' : null; }
export function unseenSummary(g: Game): string {
  if (!UNSEEN.on) return 'off';
  const S = stateOf(g); return `${unseenLive(g) ? 'sneaking with the player' : `not sneaking (${S.why})`} · spells ${UNSEEN_STATS.spells} · held ${UNSEEN_STATS.held} · held for glass ${UNSEEN_STATS.heldGlass} · wall places ${UNSEEN_STATS.wallPlaces} (${UNSEEN_STATS.wallLost} handed back to a door's lane)`;
}
/** what a save would carry (the clocks against Game.time; the wall side is re-chosen on the next hold) — and its way back */
export function unseenSnapshot(g: Game): { sneakT: number; cueT: number } { const S = stateOf(g); return { sneakT: S.sneakT, cueT: S.cueT }; }
export function unseenRestore(g: Game, s: { sneakT: number; cueT: number } | null | undefined) { const S = stateOf(g); S.t = -1e9; S.live = false; S.hold = null; S.sneakT = s?.sneakT ?? -1e9; S.cueT = s?.cueT ?? -1e9; }
