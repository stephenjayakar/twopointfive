// A TEAMMATE SHOWS WHY HE IS NOT ACTING (SHOWWHY.on — ON in the page, `?showwhy=0` puts it off; OFF here and on the frozen stand, TPS_SHOWWHY=1 raises it
// there; FROZEN_HOLDS has the row). tools/qa/showwhy-check.ts (probes.ts showwhy; SHOWWHY_BREAK=1 fails it), run on both stands.
//
// What it answers: a teammate who was not doing the plain thing looked exactly like one who was idle. His gun went down because the player stood in his
// line and nothing said so (the lines for it are clearline.ts's, whose switch is off); a stack that was made and waiting on the word stood like one still
// walking up; a man a blast had hurt fell behind with nothing but a hunch; a man kept on a taken room's far door after 'fall in' (rearwatch.ts) read as a
// man who had not heard the order. The only standing read of any of it was a row of words in the corner panel.
//
// On, the man himself shows it: his body or his hand first, a short line second, and NOTHING when he is doing what he was asked.
//   LINE    his round at a man he has is held because the PLAYER is in its line (the fire gate's own test, asked again here: roomfight.ts friendInLine) for
//           `lineAfter` s, and no mate of his stands in that line nearer than the player does (a man in file behind another waits on HIM: one man waves,
//           not four in step): his free hand comes off the gun and waves the player off the line (the animator's 'aside'), to the side of it the player
//           is on; once more `waveEvery` s later, then only every `waveLater` s. "you're in my line." stands over him for as long as it is true — one
//           voice at a time, and `lineSayGap` s before another man takes it up. His eyes stay on his man: a head is what a man sees with (guards.ts,
//           fogofwar.ts), so nothing here turns it. Not while a fire hold has the round anyway (a silent squad, a squad nobody has found, the sneak): no
//           round is wanted, so none is masked. With clearline.ts on, its own lines say what he does about it and this one is not said (the wave still is).
//   STACK   a door order that is MADE AND WAITING (doortools.ts: 'ready' on the word, stacked behind a gate, a charge armed, the jambs or the outside held):
//           the squeeze goes up the file from the last man (each man who faces a mate in reach ahead of him, `squeezeGap` apart; a man with his back to
//           the file on rear security keeps his hands; none with the animator's squeeze off — it would play as a fist), then the lead's fist goes up — and again after `holdEvery` s, twice that the next time, `holdMax`
//           times in all (a fist every few seconds for minutes is a metronome). Hands only: the lead's own words ('set.') are the door tools'.
//   DOOR    his walk is held short of the PLAYER standing in a doorway (doorway.ts's own hold and its own answer to 'for whom', `doorAfter` s; not in a
//           fight): the knife hand that
//           points the way ('go'), and "after you." — once in `afterYouGap` s for the whole squad. A mate in the doorway is not said: that wait is a
//           second long and the men sort it out.
//   HURT    a blast left him standing and hurt (condition.ts; the hunch and the short step are that file's): "I'm hit.", once, when he is back on his
//           feet. Under 'fall in' with the player at a run and him `lagM` behind: "I can't keep up.", `lagEvery` s apart and `lagMax` times a man — a
//           hurt man is capped at a walk.
//   KEEP    he keeps a taken room's far door while the squad leaves it (rearwatch.ts roomKept; his feet and his gun are that file's): "I've got this
//           door.", `keepGap` s after a mate's when two doors are kept, and not again from him inside `keepEvery` s.
// showWhyOf() is the standing read for anybody who wants to say it another way (a menu row, a voice): what holds this man right now, or null.
//
// Nothing here moves a man's feet, his gun, his eyes or a round, draws a die or reads the camera: it reads what the other files decided this frame and
// writes his left hand (a signal: picture only) and his line. The line is guards.ts say, as every squad line is: a bubble, which the run digest carries
// and the bark clocks read like any other line of his (so a run with the switch on is not digest-equal to one with it off once a line is said; with the
// bubbles left out it is — the check's 'same' line). A line waits until his own words are spent and is never laid over another line of his.
// Asked once a frame after the orders, the door tools and the room fight (game.ts). Off = every export returns on its first line: the build as it was, by
// run digest. State is side tables here (a snapshot holds them), each stamped with the clock so a restart or a load voids it.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, wrapAngle } from '../math/vec';
import type { Game, Guard } from './game';
import type { DoorOp } from './doortools';
import type { SignalKind } from './character';
import { MOVES } from './character';
import { isHurt } from './condition';
import { roomKept } from './rearwatch';
import { doorwayHeldBy } from './doorway';
import { CLEARLINE } from './clearline';
import { silentOnMan } from './silent';
import { holdFireOnMan } from './holdfire';
import { unseenMan } from './unseen';

export const SHOWWHY = {
  /** the switch (false = the build as it was, run for run) */
  on: false,
  /** each case by itself, for an A/B (all true as shipped) */
  line: true, stack: true, door: true, hurt: true, keep: true,
  /** the lines (false = the hands alone) */
  say: true,
  /** LINE. s the player has masked his round without a break before he shows it · a break shorter than this is no break · s from his first wave to his
   *  second · s between waves after that · the line stands at least this long once said · s after one man's line before another man says it · m either
   *  side of his line a mate counts as standing in it */
  lineAfter: 0.6, lineGap: 0.3, waveEvery: 2.6, waveLater: 6, lineMin: 1.2, lineSayGap: 4, mateHalf: 0.45,
  /** STACK. s between two squeezes up the file · m a hand reaches the man ahead · s after the last squeeze (or, with none, after the stack is made) before
   *  the lead's fist · s to the second fist (doubled each time after) · fists in all for one wait */
  squeezeGap: 0.35, squeezeReach: 1.15, fistAfter: 0.45, holdEvery: 8, holdMax: 3,
  /** DOOR. s held at a doorway the player stands in before the hand · s before the same man shows it again · s between two "after you." from the squad */
  doorAfter: 0.5, doorEvery: 4, afterYouGap: 10,
  /** HURT. "I'm hit." is not said later than this many s after the blast (a load, a man folded for a long time) · m behind a running player before
   *  "I can't keep up." · s between two of those from one man · how many he says in all */
  hurtLate: 6, lagM: 6, lagEvery: 20, lagMax: 2,
  /** KEEP. s he has kept the door before he says so · s after a mate's keep line before his · s before the same man says it again */
  keepAfter: 0.4, keepGap: 1.5, keepEvery: 30,
  /** a line owed is dropped when it has waited this long for his own words to be spent */
  owedFor: 5,
};

/** what holds a man from the plain thing */
export type Why = 'line' | 'stack' | 'door' | 'hurt' | 'keep';
/** the lines, one place (written as the squad's other lines over a head are: no capital to open on) */
export const SHOWWHY_LINES = {
  line: "you're in my line.",
  door: 'after you.',
  hurt: "I'm hit.",
  lag: "I can't keep up.",
  keep: "I've got this door.",
};
export interface WhyNote { t: number; who: string; why: Why; signal: SignalKind | null; line: string | null }
export interface ShowWhyStats { waves: number; squeezes: number; fists: number; ways: number; lines: number; holds: number }

interface Owed { text: string; why: Why; by: number }
interface Mem {
  /** the clock as last seen (a restart or a load takes it back: everything below is void) */
  t: number;
  /** LINE: masked since · last masked · it is showing · when it last stopped showing · when the next wave may go · waves so far (a showing that
   *  follows the last by a few seconds goes on counting: a man let go of and taken again does not start over) · the stamp of the bubble that is this rule's
   *  (NaN: none) */
  lineT0: number; lineSeenT: number; lineOn: boolean; lineEndT: number; waveT: number; waves: number; lineB: number;
  /** DOOR: held since · last held · shown this hold · when he may show it again */
  doorT0: number; doorSeenT: number; doorShown: boolean; doorT: number;
  /** HURT: the blast (`hurtAt`) his line has been said for · when he may next say he cannot keep up · how often he has */
  hurtSaid: number; lagT: number; lagN: number;
  /** KEEP: kept since (NaN: not kept) · queued this keep · when he last said it */
  keepT0: number; keepSaid: boolean; keepSaidT: number;
  /** lines owed (his own words were still over him), the oldest first: each said once they are spent and its cause still stands, dropped at `by` */
  owed: Owed[];
}
/** a door order that is made and waiting: the clock as last seen · the squeezes still to go up its file · when the lead's fist next goes up · fists so far */
interface OpMem { t: number; turns: { gd: Guard; at: number }[]; fistT: number; fists: number }
interface State { stats: ShowWhyStats; log: WhyNote[]; afterYouT: number; keepSayT: number; lineSayT: number; t: number }

const mem = new SideMap<Guard, Mem>('showwhy.mem');
const opMem = new SideMap<DoorOp, OpMem>('showwhy.opMem');
const states = new SideMap<Game, State>('showwhy.states');
const blank = (t: number): Mem => ({ t, lineT0: -100, lineSeenT: -100, lineOn: false, lineEndT: -100, waveT: -100, waves: 0, lineB: NaN, doorT0: -100, doorSeenT: -100, doorShown: false, doorT: -100, hurtSaid: -1, lagT: -100, lagN: 0, keepT0: NaN, keepSaid: false, keepSaidT: -100, owed: [] });
const fresh = (): ShowWhyStats => ({ waves: 0, squeezes: 0, fists: 0, ways: 0, lines: 0, holds: 0 });
const stateOf = (g: Game): State => { let s = states.get(g); if (!s) { s = { stats: fresh(), log: [], afterYouT: -100, keepSayT: -100, lineSayT: -100, t: g.time }; states.set(g, s); } return s; };
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** what the rule has shown this game (the check's, the debugger's) */
export function showWhyStats(g: Game): ShowWhyStats { return states.get(g)?.stats ?? fresh(); }   // (a read makes no state: a panel asking with the switch off leaves the snapshot as it was)
export function showWhyLog(g: Game): WhyNote[] { return states.get(g)?.log ?? []; }
/** a fresh encounter: nothing shown, nothing owed */
export function resetShowWhy(g: Game): void { states.delete(g); }

function note(g: Game, st: State, gd: Guard, why: Why, signal: SignalKind | null, line: string | null): void {
  st.log.push({ t: g.time, who: gd.callsign, why, signal, line }); if (st.log.length > 200) st.log.splice(0, 80);
}
/** his words are over him this frame (the harness has no HUD to take a spent bubble off him: asked of its clock) */
function speaking(g: Game, gd: Guard): boolean { const b = gd.bubble; return !!b && g.time >= b.t && g.time - b.t <= b.dur; }
function say(g: Game, st: State, gd: Guard, why: Why, text: string): boolean {
  g.say(gd, text); if (gd.bubble?.text !== text) return false;   // (a man with no voice of his own: nothing said)
  st.stats.lines++; note(g, st, gd, why, null, text); return true;
}
function sign(g: Game, st: State, gd: Guard, why: Why, kind: SignalKind, side: 1 | -1 = 1): void { gd.char.anim.signal(kind, side); note(g, st, gd, why, kind, null); }

/** THE PLAYER IS IN THIS MAN'S LINE: the room fight has him on a living man with his beat run and held the round THIS frame for the player — the fire
 *  gate's own answer (roomfight.ts `lineBy`: the lane, or anywhere the round could go) — and no mate stands in that line nearer than the player. Not while
 *  a fire hold has the round whatever the player does: the man has noticed nobody, the floor is cold, and the silent order, the squad's own hold or the
 *  sneak holds it (each asked by the question of its own that counts nothing; the holds' own finer points — a man half-noticed, the pair's watch — are
 *  not re-asked: there he shows nothing, as before this file). */
function masked(g: Game, gd: Guard): boolean {
  if (g.player.down) return false;
  const O = g.fight.opOf(gd), h = O?.tgt; if (!O || !h || h.state === 'dead' || !(O.lineT > 0) || O.lineBy !== 'player' || g.time - O.lineAt > 0.1) return false;
  if (mateNearer(g, gd, h.char.pos)) return false;
  if (h.state === 'alert' || h.state === 'search' || g.fight.hotFor(gd)) return true;
  return !(silentOnMan(g, gd) || holdFireOnMan(g, gd) || unseenMan(g, gd));
}
/** a mate stands in this man's line to `to` nearer to him than the player does: it is the mate he waits on, and the mate who waits on the player */
function mateNearer(g: Game, gd: Guard, to: Vec3): boolean {
  const c = gd.char.pos, pl = g.player.char.pos, dx = to[0] - c[0], dz = to[2] - c[2], L = Math.hypot(dx, dz); if (L < 1e-3) return false;
  const ux = dx / L, uz = dz / L, ap = (pl[0] - c[0]) * ux + (pl[2] - c[2]) * uz;
  for (const o of g.guards) {
    if (o === gd || o.state === 'dead' || o.team !== gd.team) continue;
    const x = o.char.pos[0] - c[0], z = o.char.pos[2] - c[2], a = x * ux + z * uz; if (a > 0.2 && a < ap && Math.abs(x * uz - z * ux) < SHOWWHY.mateHalf) return true;
  }
  return false;
}
/** the side of his line to his man the player stands on: 1 his left, -1 his right (the way the wave sends him: the short way out) */
function lineSide(g: Game, gd: Guard): 1 | -1 {
  const h = g.fight.opOf(gd)?.tgt, c = gd.char.pos, pl = g.player.char.pos; if (!h) return 1;
  const dx = h.char.pos[0] - c[0], dz = h.char.pos[2] - c[2];   // (his left of that line is (dz, -dx): the model's +x under a yaw of atan2(dx, dz))
  return ((pl[0] - c[0]) * dz - (pl[2] - c[2]) * dx) / Math.max(1e-3, Math.hypot(dx, dz)) >= -0.15 ? 1 : -1;   // (on the line itself, or a hand off it: the wide push out to his left, the one that reads from overhead)
}
/** a mate has "you're in my line." up as this rule's right now (one man says it; three at once is a chorus) */
function lineSaidBy(g: Game, but: Guard): boolean {
  for (const o of g.guards) { if (o === but || o.state === 'dead') continue; const M = mem.get(o), b = o.bubble; if (M?.lineOn && b && b.t === M.lineB && b.text === SHOWWHY_LINES.line && speaking(g, o)) return true; }
  return false;
}
/** A DOOR ORDER THAT IS MADE AND WAITING on something that is not its own next step: the word (ready), the other doors of its gate (stacked, `readyT`
 *  set — a stack with no gate opens the frame it is made and is never seen here), the player's trigger (a charge armed), or what to do next (the jambs or
 *  the outside held). Not once the word is given. */
function waits(op: DoorOp): boolean {
  if (op.word || op.hold === 2) return false;   // (the word is given: what is left is the word's own short clock, and a boot's 'ready' is a step from crossing)
  switch (op.phase) {
    case 'ready': case 'armed': case 'held': return true;
    case 'stack': return !isNaN(op.readyT);
    case 'thr': return !!op.thr?.told;
    default: return false;
  }
}
/** this man of the order is on his mark with his hands his own: still on the order's own assignment, arrived, nobody in his sights, not blind */
function standsFree(g: Game, op: DoorOp, gd: Guard): boolean {
  if (gd.state === 'dead' || !gd.script || g.time < gd.dazzledUntil) return false;
  const A = g.orders.of(gd); if (!A || op.mine.get(gd) !== A || !A.arrived) return false;
  return !g.fight.opOf(gd)?.tgt && gd.char.anim.signalFree;
}
/** a mate of the order in reach of his hand ahead of him: nearer the door than he is, within `squeezeReach`, and in front of his chest */
function manAhead(op: DoorOp, gd: Guard): boolean {
  const K = SHOWWHY, c = gd.char, door = op.door.frameCentre, d0 = flat(c.pos, door);
  for (const o of op.men) {
    if (o === gd || o.state === 'dead') continue;
    const d = flat(c.pos, o.char.pos); if (d < 0.3 || d > K.squeezeReach || flat(o.char.pos, door) > d0 - 0.1) continue;
    if (Math.abs(wrapAngle(Math.atan2(o.char.pos[0] - c.pos[0], o.char.pos[2] - c.pos[2]) - c.bodyYaw)) < 1.0) return true;
  }
  return false;
}
function stacks(g: Game, st: State): void {
  const K = SHOWWHY, S = g.orders, t = g.time;
  for (const op of g.doorTools.ops) {
    if (!op.men.length || !op.men.every(m => S.mine(m))) continue;
    let R = opMem.get(op);
    if (!waits(op)) { if (R) opMem.delete(op); continue; }
    if (!R || t < R.t) {   // it waits from now (… or the clock went back under it)
      R = { t, turns: [], fistT: 0, fists: 0 }; opMem.set(op, R); st.stats.holds++;
      const door = op.door.frameCentre; let at = t + 0.15;
      const file = op.men.filter(m => m !== op.lead && m.state !== 'dead').sort((a, b) => flat(b.char.pos, door) - flat(a.char.pos, door));   // the last man first
      if (MOVES.on && MOVES.squeeze) for (const m of file) if (manAhead(op, m)) { R.turns.push({ gd: m, at }); at += K.squeezeGap; }   // (with that move off the animator plays a squeeze as a fist: one fist, the lead's, is the sign then)
      R.fistT = at + K.fistAfter;
    }
    R.t = t;
    while (R.turns.length && t >= R.turns[0].at) {
      const T = R.turns.shift()!; if (standsFree(g, op, T.gd) && manAhead(op, T.gd)) { sign(g, st, T.gd, 'stack', 'squeeze'); st.stats.squeezes++; }
    }
    if (!R.turns.length && R.fists < K.holdMax && t >= R.fistT) {
      if (standsFree(g, op, op.lead)) { sign(g, st, op.lead, 'stack', 'hold'); st.stats.fists++; R.fists++; R.fistT = t + K.holdEvery * 2 ** (R.fists - 1); }
      else R.fistT = t + 0.5;   // (his hands are busy, or the fight has him: looked at again shortly)
    }
  }
}

/** Once a frame, after the orders, the door tools and the room fight have had theirs (game.ts). */
export function showWhyTick(g: Game): void {
  const K = SHOWWHY; if (!K.on) return;
  const S = g.orders; if (!S || !S.sams || g.touring || g.puppet || g.director?.showing) return;
  const st = stateOf(g), t = g.time, pl = g.player;
  if (t < st.t) { st.afterYouT = st.keepSayT = st.lineSayT = -100; } st.t = t;   // (the clock went back: a restart, a load)
  if (K.stack) stacks(g, st);
  for (const gd of g.guards) {
    if (!S.mine(gd) || gd.state === 'dead' || !gd.script || gd.held) continue;
    const A = S.of(gd); if (!A) continue;   // (a man no order of the player's poses is his drill's)
    let M = mem.get(gd); if (!M || t < M.t) { M = blank(t); mem.set(gd, M); } M.t = t;
    const c = gd.char, quiet = !speaking(g, gd);

    // ---- LINE
    const lineNow = K.line && masked(g, gd);
    if (lineNow) { if (t - M.lineSeenT > K.lineGap) M.lineT0 = t; M.lineSeenT = t; }
    if (!M.lineOn && lineNow && t - M.lineT0 >= K.lineAfter) { M.lineOn = true; if (t - M.lineEndT > K.waveLater + 2) M.waves = 0; M.waveT = Math.max(t, M.waveT); M.lineB = NaN; }
    if (M.lineOn) {
      const b = gd.bubble, mine = !!b && b.t === M.lineB && b.text === SHOWWHY_LINES.line;
      if (t - M.lineSeenT > K.lineGap) {   // the line is his again: the words go with it (having stood long enough to be read)
        M.lineOn = false; M.lineEndT = t; if (mine) b!.dur = Math.max(K.lineMin, t - b!.t + 0.35); M.lineB = NaN;
      } else {
        if (t >= M.waveT && c.anim.signalFree) { sign(g, st, gd, 'line', 'aside', lineSide(g, gd)); st.stats.waves++; M.waves++; M.waveT = t + (M.waves < 2 ? K.waveEvery : K.waveLater); }
        if (K.say && !(CLEARLINE.on && CLEARLINE.cue)) {
          if (mine) b!.dur = Math.max(b!.dur, t - b!.t + 0.6);   // it stands while it is true
          else if (quiet && t >= st.lineSayT && !lineSaidBy(g, gd) && say(g, st, gd, 'line', SHOWWHY_LINES.line)) { M.lineB = gd.bubble!.t; st.lineSayT = t + K.lineSayGap; }   // (one voice: a mate who has it up says it for all of them)
        }
      }
    }

    // ---- DOOR (never in a fight: a man with somebody in his sights, or on a hot floor, has other things to say)
    const heldNow = K.door && !A.arrived && !pl.down && doorwayHeldBy(g, gd) === 'Player' && Math.hypot(pl.char.vel[0], pl.char.vel[2]) < 0.6 && !g.fight.opOf(gd)?.tgt && !g.fight.hotFor(gd);   // (doorway.ts's own answer: the frame is the player's, and he stands in it)
    if (heldNow) { if (t - M.doorSeenT > 0.3) { M.doorT0 = t; M.doorShown = false; } M.doorSeenT = t; }
    if (heldNow && !M.doorShown && t - M.doorT0 >= K.doorAfter && t >= M.doorT && c.anim.signalFree) {
      M.doorShown = true; M.doorT = t + K.doorEvery; sign(g, st, gd, 'door', 'go'); st.stats.ways++;
      if (K.say && t >= st.afterYouT) owe(M, SHOWWHY_LINES.door, 'door', t + 1.5);
    }

    // ---- HURT (a line is spent when it is SAID, never when it is queued: one that found no quiet moment is asked for again)
    if (K.hurt && K.say && isHurt(g, gd)) {
      if (M.hurtSaid !== gd.hurtAt) {
        if (t - gd.hurtAt > K.hurtLate) { M.hurtSaid = gd.hurtAt; M.lagT = t; M.lagN = 0; }   // (too long ago to say now)
        else if (t >= gd.staggerUntil) owe(M, SHOWWHY_LINES.hurt, 'hurt', t + K.owedFor);
      } else if (A.order === 'fallIn' && M.lagN < K.lagMax && t >= M.lagT && pl.sprinting && !pl.down && flat(c.pos, pl.char.pos) > K.lagM) owe(M, SHOWWHY_LINES.lag, 'hurt', t + 3);
    }

    // ---- KEEP
    if (K.keep && roomKept(g, gd)) {
      if (isNaN(M.keepT0)) { M.keepT0 = t; M.keepSaid = false; }
      if (K.say && !M.keepSaid && t - M.keepT0 >= K.keepAfter && t - M.keepSaidT >= K.keepEvery) owe(M, SHOWWHY_LINES.keep, 'keep', t + K.owedFor);
    } else M.keepT0 = NaN;

    // ---- the lines owed, the oldest first: said once his own words are spent (never laid over a line of his, this rule's included), each only while its
    //      cause still stands — a keeper who has been let go, a doorway the player has left, say nothing
    while (M.owed.length) {
      const o = M.owed[0], late = o.text === SHOWWHY_LINES.hurt && t - gd.hurtAt > K.hurtLate;
      if (M.lineOn && !late) { o.by = Math.max(o.by, t + 1); break; }
      const stands = o.why === 'keep' ? roomKept(g, gd) && !M.keepSaid : o.why === 'door' ? t - M.doorSeenT <= 0.5 && t >= st.afterYouT : isHurt(g, gd) && !late;
      if (t > o.by || !stands) { M.owed.shift(); continue; }
      if (!quiet || (o.why === 'keep' && t < st.keepSayT)) break;
      M.owed.shift();
      if (say(g, st, gd, o.why, o.text)) {
        if (o.why === 'door') st.afterYouT = t + K.afterYouGap;
        else if (o.why === 'keep') { st.keepSayT = t + K.keepGap; M.keepSaidT = t; M.keepSaid = true; }
        else if (o.text === SHOWWHY_LINES.hurt) { M.hurtSaid = gd.hurtAt; M.lagT = t + 3; M.lagN = 0; }
        else { M.lagT = t + K.lagEvery; M.lagN++; }
      }
      break;
    }
  }
}
/** a line for this man to say when he can (two at the most wait: a third is one too many to be worth saying late) */
function owe(M: Mem, text: string, why: Why, by: number): void { if (M.owed.length < 2 && !M.owed.some(o => o.text === text)) M.owed.push({ text, why, by }); }

/** What holds this man from the plain thing right now, or null — the standing read (a menu row, a voice pass, a check). Null with the switch off. */
export function showWhyOf(g: Game, gd: Guard): Why | null {
  const K = SHOWWHY; if (!K.on || gd.state === 'dead' || !g.orders?.mine(gd)) return null;   // (the player's own men: a defender a blast left hurt is not this rule's)
  const M = mem.get(gd), t = g.time, live = !!M && t >= M.t && t - M.t <= 0.25;   // (a memory the tick has not touched lately — a showcase began, he has no order — says nothing)
  if (live && M!.lineOn) return 'line';
  if (live && M!.doorShown && t - M!.doorSeenT <= 0.3 && t >= M!.doorSeenT) return 'door';
  if (K.keep && roomKept(g, gd)) return 'keep';
  if (K.stack) for (const op of g.doorTools.ops) { const R = op.men.includes(gd) ? opMem.get(op) : undefined; if (R && t >= R.t && t - R.t <= 0.25) return 'stack'; }
  if (K.hurt && isHurt(g, gd)) return 'hurt';
  return null;
}
/** one line for a tool or the debugger */
export function showWhySummary(g: Game): string {
  if (!SHOWWHY.on) return 'show why: the switch is off';
  const T = showWhyStats(g), now = g.guards.map(gd => { const w = showWhyOf(g, gd); return w ? `${gd.callsign} ${w}` : ''; }).filter(Boolean);
  return `show why ▸ ${now.length ? now.join(', ') : 'nobody held'} · ${T.waves} waves, ${T.squeezes} squeezes, ${T.fists} fists, ${T.ways} ways shown, ${T.lines} lines · ${T.holds} door orders seen waiting`;
}
