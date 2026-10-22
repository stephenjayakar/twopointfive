// AN ALERTED MAN DOES NOT WAIT AT A SHUT DOOR (DOORFORCE.on: on in the page, ?doorforce=0; off here and on the frozen stand, TPS_DOORFORCE=1).
//
// The maintainer, after "opening a door into the enemy should majorly confuse them": "and if they're alerted they should behave realistically, like
// shooting through the door or eventually kicking through it". Until this a defender who was up and knew a man stood at the other side of a shut door did one of
// two things: holding a post he rested his gun on the door and waited for it to open; free to move he walked to its handle and opened it by hand, into whoever
// was there. (coverfire.ts already has a man who SAW somebody go behind a wooden leaf put one short burst through it — wallpen.ts `men` — and then look.)
//
//   WHO       a man of the defending sides (never a teammate: the squad's orders decide what its men do) whose state is 'alert', on his own feet and senses —
//             not scripted, not taken, not dazzled or doubled over — and with nobody in his eyes (the fight AI's own branch: a man he SEES is fought as ever).
//   KNOWS     his own senses and nobody's truth. Per shut door he keeps how SURE he is that an enemy is at its other side, and where:
//               · his EARS, through the hearing model's own answer for that sound and that listener (guards.ts hearingCheck hands it over): a footfall or
//                 a report made by an enemy within `behindM` of the leaf on its far face, that came to him ACROSS a shut leaf (routed, carrying no more
//                 than `shutCarry` — a sound through open air or round an open way is the fight AI's as ever, whatever door its maker stands near). Each
//                 adds `gain` × how loud it reached him (a shot at the gunshot line or over: `shot`) — so a handful of walked footfalls close behind the
//                 leaf, or two at a run. A crouched tread through a shut door is under `hearMin`: it adds nothing. The place is where the sound was, a
//                 hashed `heardErrM` off (no die drawn). A door's own noise (a tried handle, a pick, a boot its frame held) is word of THAT door, at
//                 least `handle`, placed at its far face — and only while the man whose hand was on it still stands there.
//               · his EYES: the man he is fighting, in his sight a moment ago (`seenSecs`), with a shut leaf now the first thing in his eyes' line to
//                 where he last saw him: `seen`. A man gone round a corner or out by an open doorway beside a shut door is not behind it.
//             What he is sure of fades to a third in `fadeSecs`. He starts on a door at `sure` and stays on it down to `keep`, while his newest word of it is
//             no older than `staleSecs`. A door of his room that he is SET on behind a wedge (digin.ts) is his barricade: he does not start on it. A stand
//             or a boot the fight AI stops asking about (a man in his eyes, a flash, a blast, cover) is over; taken up again it starts again.
//   ROUNDS    a WOODEN leaf this gun's round crosses (wallpen.ts thinLine: the answer is the round's own flight), the place within the leaf's line from his
//             gun — the place itself, or, for a man right AT the door (`nearLeafM`) with the wall and not the leaf in the straight line, the stretch of leaf
//             he is nearest: he stands, lays on it by the aim law every round of his obeys, and puts `rounds` through; then he listens — the next rounds
//             want a newer word than the last ones were fired on, and `gapSecs`. Nobody of his side, no hostage and no civilian in the lane or past it as
//             far as the round would fly (coverfire.ts coverLane). A burst coverfire.ts has just put through the leaf on a sighting is the first. Steel, a leaf his
//             round is spent in, rounds that stop in doors (wallpen.ts off): no round. The leaf takes what a leaf takes: with doorblast.ts DOORSHOT it goes
//             in pieces on its own count, and then there is no door to wait at.
//   THE BOOT  a FREE man (no post, no hold) who has been on the door `kickSecs` — `kickSecsNoShot` when he has no round for it — and is still sure walks to
//             the boot's own spot (doors.ts kickSpot) and kicks it in (kickIn: the keep torn out, the leaf flung, the floor's loudest noise short of a
//             shot), one man a door; then he is the fight AI's again, with the place he believed in as his fix. Where the frame would hold a boot (the
//             face the leaf opens toward — DOORWAY.frameHolds) or the leaf is steel he does not throw one: after the same wait he goes through it by the
//             handle, as he always did. A man holding a post never leaves it for this: his answer is the rounds.
//             The boot is his side's own noise: no man of it (he least of all) takes it for an intruder at a door (guards.ts hearingCheck asks
//             doorForceOwnBoot), and the torn keep is no puzzle to a colleague on a calm pass later.
//             What the flung leaf does to a man behind it is not here (the sibling rule; until it lands the kick is the kick as it was).
//
// Off = every hook answers on its first line: no state, no die, no round (the build as it was, run digest for run digest). No dice at all with it on: the
// rounds' own cadence and cone draw as any round of his does. State per Game in a named side table (math/side.ts: a rollback snapshot holds it); a restart or
// a checkpoint load forgets it with the roster (game.ts resetGuards), as coverfire.ts's is: a belief is a few seconds old at most.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3, clamp, lerp, damp, wrapAngle, approachAngle } from '../math/vec';
import type { Game, Guard, GameEvent } from './game';
import type { Door } from './doors';
import { PLAYER_ID } from './consts';
import { isHostile, teamOfId, foeChar, foeDown } from './teams';
import { goTo, followPath, shotOrigin, burstTrigger, roundPastColleague, tickReloadBeat, startReloadBeat } from './guards';
import { fireWeapon } from './combat';
import { guardFireMods } from './suppression';
import { AIM } from './aim';
import { KICK_IMPACT } from './character';
import { kickScuff } from './marks';
import { thinLine, wallMenLive } from './wallpen';
import { roundEnergy, shotEnergy } from './glasspen';
import { coverLane, coverfireOn } from './coverfire';
import { digInSetOn } from './digin';
import { hash01 } from './debris';
import { simRandom } from '../math/dice';

export const DOORFORCE = {
  on: false,
  /** the two halves, each off = that half as it was: rounds through the leaf · the boot */
  shoot: true, kick: true,
  /** how sure he must be to start on a door · down to what he stays on it · s his sureness takes to fade to a third · s his newest word of it may be old */
  sure: 1, keep: 0.3, fadeSecs: 5, staleSecs: 6,
  /** what a sound adds: `gain` × (its level × what the path carries × its falloff — guards.ts's own sum), nothing under `hearMin` of that sum · a report
   *  at the gunshot line or over · at least this for a hand on THIS door · the sighting of a man who is now behind it */
  gain: 4, hearMin: 0.03, shot: 1, handle: 0.6, seen: 1.5,
  /** a sound whose way to him carries more than this did not come through a shut leaf (collision.ts propagate: about 0.3 across one, 0.7 round an open way) */
  shutCarry: 0.5,
  /** m from the leaf's middle to where the enemy stood, on its far face · m from the leaf to the listener, on his · s a sighting stays worth a door */
  behindM: 2.5, reachM: 9, seenSecs: 3,
  /** m a heard place is put off the sound (hashed off the event and the man) · the height above the floor his rounds are laid at */
  heardErrM: 0.4, chestY: 1.15,
  /** m from the leaf inside which a man is AT the door: with the wall in the straight line, the rounds go through the stretch of leaf nearest him, to a
   *  point this far behind it */
  nearLeafM: 1.2, pastLeafM: 0.6,
  /** rounds on one word · s before the next ones (which want a newer word) */
  rounds: 4, gapSecs: 1.5,
  /** s on the door before a free man goes to boot it: with rounds for it · with none (steel, a leaf his round does not cross, no line) */
  kickSecs: 4, kickSecsNoShot: 2,
  /** his walk to the boot's spot is given up after this many seconds · s a door he has dealt with (or given up) is left alone */
  walkSecs: 6, restSecs: 8,
};
/** sounds that counted for a door · sightings that did · stands begun (a man starts on a door) · rounds fired on one · rounds held for a friend in or past
 *  the lane · boots thrown · of them the door gave · boots not thrown (the frame would hold it, steel, no floor at the spot, the walk given up) */
export const DOORFORCE_STATS = { heard: 0, seen: 0, stands: 0, shots: 0, heldFriend: 0, kicks: 0, gave: 0, noKick: 0 };
export const DOORFORCE_LOG: string[] = [];

const BREAK = (() => { try { return String((globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.DOORFORCE_BREAK ?? '') === '1'; } catch { return false; } })();

/** what one man believes of one door: how sure, where the man is (the floor), when he last had word, and that word's kind */
interface Belief { door: Door; sure: number; at: Vec3; t: number; seen: boolean }
/** the door he is on: since when, the rounds of this word, the word they were fired on, when the next may go, his lay on the spot */
interface Stand { door: Door; t0: number; n: number; firedT: number; next: number; lay: number; fired: number; noShotT: number; to: Vec3 | null; toKey: [number, number, number] }
interface Kick { door: Door; spot: Vec3; yaw: number; phase: 'walk' | 'set' | 'kick'; t0: number; setT: number }
/** `served`: the last time the alert branch asked for him (a stand or a boot nobody asks about is over) · `cfT`: when coverfire.ts last had a round of his through a thin thing */
interface Man { beliefs: Map<Door, Belief>; saw: { at: Vec3; t: number; used: boolean } | null; on: Stand | null; kick: Kick | null; rest: Map<Door, number>; served: number; cfT: number }
/** `boots`: who threw one of this rule's boots, and when (his own side does not take it for an intruder's) */
interface State { lastT: number; men: Map<Guard, Man>; kickers: Map<Door, Guard>; boots: Map<number, number> }
const states = new SideMap<Game, State>('doorforce.states');

function live(g: Game): boolean { return DOORFORCE.on && !BREAK && g.aiEnabled && !g.touring; }
function stateOf(g: Game): State {
  let S = states.get(g);
  if (S && g.time < S.lastT - 1e-6) { S.men.clear(); S.kickers.clear(); S.boots.clear(); S.lastT = g.time; }   // (a clock gone back — a load: every belief is forgotten, as coverfire.ts's are)
  if (!S) { S = { lastT: g.time, men: new Map(), kickers: new Map(), boots: new Map() }; states.set(g, S); }
  return S;
}
function manOf(S: State, gd: Guard): Man { let M = S.men.get(gd); if (!M) { M = { beliefs: new Map(), saw: null, on: null, kick: null, rest: new Map(), served: -1e9, cfT: -1e9 }; S.men.set(gd, M); } return M; }
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function log(g: Game, s: string) { DOORFORCE_LOG.push(`${g.time.toFixed(2)} ${s}`); if (DOORFORCE_LOG.length > 400) DOORFORCE_LOG.splice(0, 200); }
/** a man this rule may have: a defender, up, on his own senses */
const defender = (gd: Guard) => gd.team !== 'operative' && gd.state !== 'dead' && gd.char.alive;
/** a leaf that is a shut door to a man: hung, home in its frame */
const shut = (d: Door) => !d.off && d.isClosed();
/** `at` is close behind the shut leaf d for a man at `from`: opposite faces, `at` within `behindM` of the frame and `from` in reach of it — and the leaf is
 *  not one his room wedged and he is set on (digin.ts: that leaf is his barricade) */
function behind(g: Game, gd: Guard, d: Door, from: Vec3, at: Vec3): boolean {
  const K = DOORFORCE; if (!shut(d) || flat(d.frameCentre, at) > K.behindM || flat(d.frameCentre, from) > K.reachM) return false;
  if (g.doors.side(d, from) === g.doors.side(d, at)) return false;
  const L = g.doors.frameCoords(d, at); if (L.along < -K.behindM || L.along > d.def.width + K.behindM) return false;
  return !digInSetOn(g, gd, d);
}
/** HEARD: the shut door `at` is close behind, for a man at `from` — the nearest such to `at`, or null. (That the sound came to him ACROSS a shut leaf is the
 *  hearing model's word, asked by the caller: this is only which leaf.) */
function doorBetween(g: Game, gd: Guard, from: Vec3, at: Vec3): Door | null {
  let best: Door | null = null, bd = Infinity;
  for (const d of g.doors.list) { if (!behind(g, gd, d, from, at)) continue; const da = flat(d.frameCentre, at); if (da < bd) { bd = da; best = d; } }
  return best;
}
/** SEEN: the shut door that now stands in his eyes' line to the place he last saw the man — the leaf itself the first thing in that line, so a man who
 *  stepped round a corner or out through an open doorway beside a shut door is not "behind" it */
function doorHiding(g: Game, gd: Guard, at: Vec3): Door | null {
  const c = gd.char, from: Vec3 = [c.pos[0], c.pos[1] + 1.5, c.pos[2]], dd = v3.sub([at[0], c.pos[1] + DOORFORCE.chestY, at[2]], from), L = v3.len(dd); if (L < 0.3) return null;
  const h = g.col.raycast(from, v3.scale(dd, 1 / L), L); if (!h || h.index < 1e6) return null;
  const box = g.col.dynamicBoxes[h.index - 1e6], d = g.doors.list.find(x => x.box === box);
  return d && behind(g, gd, d, c.pos, at) ? d : null;
}
function learn(g: Game, S: State, gd: Guard, d: Door, at: Vec3, add: number, seen: boolean) {
  const M = manOf(S, gd); const rest = M.rest.get(d); if (rest !== undefined && rest > g.time) return;
  let B = M.beliefs.get(d);
  if (!B) { B = { door: d, sure: 0, at: [at[0], 0, at[2]], t: g.time, seen }; M.beliefs.set(d, B); }
  B.sure = Math.min(3, seen ? Math.max(B.sure, add) : B.sure + add); B.at = [at[0], 0, at[2]]; B.t = g.time; B.seen = seen;
}

// ---------------------------------------------------------------- his ears (guards.ts hearingCheck, once for every sound that reaches as far as him)
/** `prop` is the hearing model's own answer for this sound and this man (weather.ts hearPath): the way it took to him, its length and what it carries. A
 *  return on its first line with the switch off. */
export function doorForceHear(g: Game, gd: Guard, e: GameEvent, prop: { direct: boolean; routed: boolean; pathLen: number; carry: number }): void {
  if (!live(g) || gd.state !== 'alert' || !defender(gd) || gd.script) return;
  const K = DOORFORCE; let who: number, horizon: number, loud = false;
  if (e.kind === 'step') { who = e.who ?? PLAYER_ID; horizon = 9; }
  else if (e.kind === 'door') { if (e.who === undefined || e.who < 0) return; who = e.who; horizon = 12; }
  else if (e.kind === 'shot') { who = PLAYER_ID; horizon = 22; loud = (e.level ?? 0) >= 1; }
  else if (e.kind === 'guardShot') { if (e.who === undefined) return; who = e.who; horizon = 22; loud = (e.level ?? 0) >= 1; }
  else return;
  if (who === gd.char.id || !isHostile(gd.team, teamOfId(g, who)) || (g.playerInvisible && who === g.player.char.id)) return;
  const a = (e.level ?? 0.3) * clamp(1 - prop.pathLen / horizon, 0, 1) * prop.carry;   // (guards.ts's own sum for a small sound: its level, its falloff along the way it takes, what that way carries)
  if (a < K.hearMin && !loud) return;   // it did not reach him as anything: a crouched tread through a shut leaf
  let d: Door | null, src: Vec3, add = loud ? K.shot : a * K.gain;
  if (e.kind === 'door') {
    // a door's own noise is filed at its leaf (a tried handle, a pick, a boot the frame held): it is word of THAT door, and only while the man whose hand
    // was on it still stands at its far face — a leaf banging off its stop or latching behind a man who has gone says nothing of where he is now. The
    // place is the leaf's far face, never his feet.
    const maker = who === g.player.char.id ? g.player.char : g.guards.find(x => x.char.id === who)?.char; if (!maker) return;
    d = g.doors.list.find(x => shut(x) && flat(x.frameCentre, e.pos) < x.def.width + 0.3 && behind(g, gd, x, gd.char.pos, maker.pos)) ?? null; if (!d) return;
    const u = d.dir(), s = g.doors.side(d, maker.pos), mx = d.def.hinge[0] + u[0] * d.def.width * 0.5, mz = d.def.hinge[1] + u[1] * d.def.width * 0.5;
    src = [mx - u[1] * s * K.pastLeafM, 0, mz + u[0] * s * K.pastLeafM]; if (g.doors.side(d, src) !== s) src = [mx + u[1] * s * K.pastLeafM, 0, mz - u[0] * s * K.pastLeafM];
    add = Math.max(add, K.handle);
  } else {
    // anything else must have come to him ACROSS a shut leaf (the hearing model's word: routed, and what a shut leaf lets through) — a sound that reached
    // him through open air or round an open way is the fight AI's as ever, whatever shut door its maker stands near
    if (prop.direct || !prop.routed || prop.carry > K.shutCarry) return;
    src = e.pos; d = doorBetween(g, gd, gd.char.pos, src); if (!d) return;
  }
  const S = stateOf(g); const h = (e.id ?? 0) * 31 + gd.char.id; const ang = hash01(h) * Math.PI * 2, r = K.heardErrM * hash01(h + 7919);
  let at: Vec3 = [src[0] + Math.cos(ang) * r, 0, src[2] + Math.sin(ang) * r];
  if (g.doors.side(d, at) !== g.doors.side(d, src)) at = [src[0], 0, src[2]];   // (never put through the leaf onto his own face of it)
  learn(g, S, gd, d, at, add, false); DOORFORCE_STATS.heard++;
}
/** guards.ts hearingCheck: this 'kick' is a boot this rule had a man of the listener's own side (or the listener) throw — it is not an intruder at a door.
 *  False on its first line with the switch off. */
export function doorForceOwnBoot(g: Game, gd: Guard, e: GameEvent): boolean {
  if (e.kind !== 'kick' || e.who === undefined || !live(g)) return false;
  const t = states.get(g)?.boots.get(e.who); if (t === undefined || g.time - t > 1) return false;
  return e.who === gd.char.id || !isHostile(gd.team, teamOfId(g, e.who));
}

// ---------------------------------------------------------------- once a frame (game.ts, after the guards)
export function doorForceTick(g: Game, dt: number): void {
  if (!live(g)) return;
  const S = stateOf(g), K = DOORFORCE; S.lastT = g.time;
  const k = Math.exp(-dt / K.fadeSecs * Math.log(3));
  for (const gd of g.guards) {
    if (!defender(gd)) { if (S.men.has(gd)) drop(S, gd); continue; }
    const now = g.time - gd.lastSeenT < dt * 0.5 + 1e-6, pc = foeChar(g, gd);
    if (gd.state === 'alert' && pc && now && !foeDown(g, gd)) manOf(S, gd).saw = { at: [pc.pos[0], 0, pc.pos[2]], t: g.time, used: false };
    const M = S.men.get(gd); if (!M) continue;
    if (gd.state !== 'alert') { drop(S, gd); continue; }
    // his eyes: the man he had in sight a moment ago is now at the far face of a shut leaf
    if (M.saw && !now && !M.saw.used && g.time - M.saw.t <= K.seenSecs) {
      const d = doorHiding(g, gd, M.saw.at);
      if (d) { M.saw.used = true; learn(g, S, gd, d, M.saw.at, K.seen, true); DOORFORCE_STATS.seen++; }
    }
    const cf = coverfireOn(g, gd), theirs = !!cf && cf.kind === 'thru'; if (theirs && cf!.fired > 0) M.cfT = g.time;
    // a stand or a boot the alert branch has stopped asking about (the man in his eyes, a flash, a blast, cover) is over: taken up again it starts again
    if (M.kick && g.time - M.served > 0.2) { if (S.kickers.get(M.kick.door) === gd) S.kickers.delete(M.kick.door); M.kick = null; M.on = null; }
    if (M.on && g.time - M.served > 0.5) M.on = null;
    for (const [d, B] of M.beliefs) { if (!(theirs && B.seen)) B.sure *= k;   // (what he saw does not fade while coverfire.ts's burst on that sighting is going through the leaf)
      if (!shut(d) || B.sure < 0.02 || g.time - B.t > K.staleSecs + K.fadeSecs) { M.beliefs.delete(d); if (M.on?.door === d && !M.kick) M.on = null; } }
    for (const [d, until] of M.rest) if (until <= g.time) M.rest.delete(d);
    if (M.kick && S.kickers.get(M.kick.door) !== gd) M.kick = null;
  }
  for (const [d, gd] of S.kickers) if (!defender(gd) || S.men.get(gd)?.kick?.door !== d) S.kickers.delete(d);
  for (const gd of S.men.keys()) if (!g.guards.includes(gd)) drop(S, gd);
  for (const [id, t] of S.boots) if (g.time - t > 2) S.boots.delete(id);
}
function drop(S: State, gd: Guard) { const M = S.men.get(gd); if (M?.kick && S.kickers.get(M.kick.door) === gd) S.kickers.delete(M.kick.door); S.men.delete(gd); }

// ---------------------------------------------------------------- what his round would do
/** where his rounds go for this belief, or null = he has no round for it: the place itself when the leaf is the first thing in the line from his gun and the
 *  round crosses it; else, for a man right at the door, a point just behind the stretch of leaf nearest him */
function roundFor(g: Game, gd: Guard, B: Belief): Vec3 | null {
  const K = DOORFORCE, d = B.door; if (!K.shoot || d.def.steel || !wallMenLive(g)) return null;
  const from = shotOrigin(gd.char), e = roundEnergy(gd.weapon.def), index = 1e6 + g.col.dynamicBoxes.indexOf(d.box);
  const through = (to: Vec3): boolean => {
    const T = thinLine(g, from, to, e, 0.3); if (!T || T === 'clear') return false;
    if (T.walls[0].index !== index || T.walls[0].t < 0.5) return false;   // (the leaf first, and not with his muzzle against it)
    return !(T.panes && shotEnergy(g, gd.char, gd.weapon.def) === 0);   // (glasspen.ts: his side's rounds are not laid through standing glass)
  };
  const y = gd.char.pos[1] + K.chestY; const at: Vec3 = [B.at[0], y, B.at[2]];
  if (through(at)) return at;
  const L = g.doors.frameCoords(d, B.at); if (L.off > K.nearLeafM || L.along < -K.nearLeafM || L.along > d.def.width + K.nearLeafM) return null;
  const c = d.def.closedDir, ux = Math.cos(c), uz = Math.sin(c), al = clamp(L.along, 0.15, d.def.width - 0.15), s = g.doors.side(d, B.at);
  const px = d.def.hinge[0] + ux * al, pz = d.def.hinge[1] + uz * al;   // on the leaf's line, the stretch nearest the man
  const to: Vec3 = [px - uz * s * K.pastLeafM, y, pz + ux * s * K.pastLeafM];
  if (g.doors.side(d, to) !== s) { to[0] = px + uz * s * K.pastLeafM; to[2] = pz - ux * s * K.pastLeafM; }
  return through(to) ? to : null;
}

// ---------------------------------------------------------------- the alert branch's hook (guards.ts: nobody in his eyes, after coverfire.ts's own)
/** The door this man is on: where his gun points and how fast his legs are going — null = nothing of the kind, the branch goes on as it always did. */
export function doorForce(g: Game, gd: Guard, dt: number): { aim: Vec3; move: number } | null {
  if (!live(g) || !defender(gd) || gd.script || gd.held || g.time < gd.dazzledUntil || g.time < gd.staggerUntil) return null;
  const S = states.get(g), M = S?.men.get(gd); if (!S || !M) return null;
  const K = DOORFORCE, c = gd.char; M.served = g.time;
  if (M.kick) { const r = kickStep(g, S, gd, M, dt); if (r) return r; }
  // the door he is on, or the one he is surest of
  let B: Belief | null = M.on ? M.beliefs.get(M.on.door) ?? null : null;
  if (B && (B.sure < K.keep || g.time - B.t > K.staleSecs || !shut(B.door))) B = null;
  if (!B) { M.on = null; for (const X of M.beliefs.values()) if (X.sure >= K.sure && g.time - X.t <= K.staleSecs && shut(X.door) && (!B || X.sure > B.sure)) B = X; }
  if (!B) return null;
  const d = B.door;
  if (!M.on) {
    // (a burst coverfire.ts has just put through a thin thing on this sighting is the first: this one's rounds then want a newer word)
    const theirs = B.seen && g.time - M.cfT < 2;
    M.on = { door: d, t0: g.time, n: 0, firedT: theirs ? g.time : -1e9, next: 0, lay: 0, fired: 0, noShotT: 0, to: null, toKey: [NaN, NaN, NaN] };
    DOORFORCE_STATS.stands++; log(g, `${gd.callsign} on ${d.def.name}: ${B.seen ? 'saw him go behind it' : 'hears them behind it'} (sure ${B.sure.toFixed(2)})`);
  }
  const St = M.on, free = !gd.pinned && !gd.hold;
  // (what his round would do changes only with a new word, or when he moves: asked again then, not every frame)
  if (St.toKey[0] !== B.t || St.toKey[1] !== c.pos[0] || St.toKey[2] !== c.pos[2]) { St.to = roundFor(g, gd, B); St.toKey = [B.t, c.pos[0], c.pos[2]]; }
  const to = St.to; St.noShotT = to ? 0 : St.noShotT + dt;
  // THE BOOT: a free man who has been on it long enough and is still sure
  if (free && K.kick && !S.kickers.has(d) && (g.time - St.t0 >= K.kickSecs || St.noShotT >= K.kickSecsNoShot) && gd.reloadT < 0) {
    const spot = g.doors.kickSpot(d, c.pos);
    if (d.def.steel || g.doors.bootHolds(d, c.pos) || g.col.nav.isBlocked(spot.pos[0], spot.pos[2])) {
      // no boot opens it from here: through it by the handle, as he always went — the place he believes in is his fix
      DOORFORCE_STATS.noKick++; log(g, `${gd.callsign} leaves ${d.def.name} to his hand (${d.def.steel ? 'steel' : g.doors.bootHolds(d, c.pos) ? 'the frame would hold a boot' : 'no floor to kick from'})`);
      gd.lastKnown = [B.at[0], 0, B.at[2]]; M.rest.set(d, g.time + K.restSecs); M.beliefs.delete(d); M.on = null; return null;
    }
    M.kick = { door: d, spot: spot.pos, yaw: spot.yaw, phase: 'walk', t0: g.time, setT: 0 }; S.kickers.set(d, gd); gd.path = []; gd.pathGoal = null; gd.stallRef = null;
    log(g, `${gd.callsign} goes to boot ${d.def.name}`);
    const r = kickStep(g, S, gd, M, dt); if (r) return r;
    return null;
  }
  // THE ROUNDS: stood still, laid on the spot, by the aim law and the cadence every round of his obeys (coverfire.ts coverBlind's own trigger)
  const aim: Vec3 = to ?? [B.at[0], c.pos[1] + K.chestY, B.at[2]];
  gd.speed = damp(gd.speed, 0, 6, dt); c.vel = [0, 0, 0];
  gd.fireCd -= dt;
  if (gd.reloadT >= 0) { tickReloadBeat(g, gd, dt); return { aim, move: 0 }; }
  if (!to) return { aim, move: 0 };
  if (St.n >= K.rounds) { St.n = 0; St.firedT = g.time; St.next = g.time + K.gapSecs; }   // these rounds are through: he listens
  const P = AIM.guard, dist = flat(c.pos, aim);
  const on = Math.abs(wrapAngle(Math.atan2(aim[0] - c.pos[0], aim[2] - c.pos[2]) - c.aimYaw)) < 0.25 && !gd.muzzleDown;
  const settle = Math.max(P.settleSecs, 1e-3) * clamp(dist / Math.max(P.rangeRef, 0.1), P.nearK, 1) * (gd.skill ? gd.skill.settleK : 1);
  St.lay = !g.tune.aimModel ? (on ? 1 : 0) : on ? Math.min(1, St.lay + dt / settle) : Math.max(0, St.lay - P.loseRate * dt);   // (his lay on the spot, kept while he listens too)
  const armed = B.t > St.firedT && g.time >= St.next;
  if (!armed && !gd.weapon.burst) return { aim, move: 0 };
  if (!coverLane(g, gd, c.muzzle, aim)) { DOORFORCE_STATS.heldFriend++; return { aim, move: 0 }; }
  const ok = on && St.lay >= P.acquireMin - 1e-9, had = gd.weapon.roundsReady;
  if (gd.weapon.def.burst) {
    const tr = gd.aim.track; gd.aim.track = St.lay;   // (his lay on the SPOT for the burst's own cone, and for nothing else: his track on the man is put back)
    burstTrigger(g, gd, dt, aim, ok && armed, ok); gd.aim.track = tr;
  } else if (ok && armed && gd.fireCd <= 0 && !roundPastColleague(g, gd, aim) && gd.weapon.fire()) {
    const W = gd.weapon.def, Mo = guardFireMods(g, gd), R = W.aiSpread; gd.fireCd = (W.cd + simRandom() * W.cdJitter) * Mo.gap;
    const hands = (R.base + Math.max(0, dist - R.rangeFrom) * R.rangeK) * (gd.skill ? gd.skill.spreadK : 1);
    fireWeapon(g, c, aim, false, g.tune.aimModel ? { steady: true, spread: hands * lerp(P.unsettledK, 1, clamp(St.lay, 0, 1)) + Mo.spread } : { spread: Mo.spread });
    if (gd.weapon.roundsReady === 0) startReloadBeat(g, gd);
  }
  const out = had - gd.weapon.roundsReady;
  if (out > 0) { if (!St.fired) log(g, `${gd.callsign} fires through ${d.def.name}`); St.n += out; St.fired += out; DOORFORCE_STATS.shots += out; }
  return { aim, move: 0 };
}

/** the walk to the boot's spot, the set, the boot. null = it is over (thrown, or given up): the caller's own branch goes on */
function kickStep(g: Game, S: State, gd: Guard, M: Man, dt: number): { aim: Vec3; move: number } | null {
  const K = DOORFORCE, Kk = M.kick!, d = Kk.door, c = gd.char, an = c.anim;
  const B = M.beliefs.get(d);
  const end = (why: string | null) => {
    if (why) { DOORFORCE_STATS.noKick++; log(g, `${gd.callsign} gives the boot at ${d.def.name} up: ${why}`); }
    if (S.kickers.get(d) === gd) S.kickers.delete(d);
    if (B) gd.lastKnown = [B.at[0], 0, B.at[2]];
    M.kick = null; M.on = null; M.beliefs.delete(d); M.rest.set(d, g.time + K.restSecs); gd.path = []; gd.pathGoal = null; gd.stallRef = null;
    return null;
  };
  const lock: Vec3 = [d.def.hinge[0] + Math.cos(d.def.closedDir) * (d.def.width - 0.2), 0.9, d.def.hinge[1] + Math.sin(d.def.closedDir) * (d.def.width - 0.2)];
  if (Kk.phase !== 'kick' && !shut(d)) return end('it stands open');
  if (Kk.phase === 'walk') {
    if (g.time - Kk.t0 > K.walkSecs) return end('the walk took too long');
    goTo(g, gd, Kk.spot); const arrived = followPath(g, gd, dt, g.tune.guardInvestigate);
    if (flat(c.pos, Kk.spot) < 0.3 || (arrived && flat(c.pos, Kk.spot) < 0.6)) { Kk.phase = 'set'; Kk.setT = g.time; gd.path = []; gd.pathGoal = null; }
    else if (arrived) return end('no way to the spot');
    return { aim: lock, move: gd.speed };
  }
  gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0];
  // on the spot: square to the leaf as the spot was dealt (doors.ts kickSpot's yaw — the sole goes where the chest points), his eyes on the lock
  const onIt = flat(c.pos, Kk.spot) < 0.6;
  if (Kk.phase === 'set') {
    if (!onIt) return end('he was moved off the spot');
    if (g.doors.bootHolds(d, c.pos)) return end('the frame would hold it from here');
    c.bodyYaw = approachAngle(c.bodyYaw, Kk.yaw, 6 * dt);
    const square = Math.abs(wrapAngle(Kk.yaw - c.bodyYaw)) < 0.3;
    if (square && gd.speed < 0.3) { an.kickDoor(); Kk.phase = 'kick'; } else if (g.time - Kk.setT > 1.5) return end('never got square to it');
    return { aim: lock, move: 0 };
  }
  // the sole meets the leaf at KICK_IMPACT (squad.ts RoomClear's own test) — and only a man still on his spot has a leaf under it
  if (!(an.kickImpact || an.kickTime >= KICK_IMPACT || !an.kicking)) return { aim: lock, move: 0 };
  if (!onIt) return end('he was moved off the spot');
  DOORFORCE_STATS.kicks++; S.boots.set(c.id, g.time);
  const gave = shut(d) && g.doors.kickIn(d, v3.copy(c.pos), c.id); if (gave) { DOORFORCE_STATS.gave++; kickScuff(g, d, c.pos); d.noticed = true; }   // (noticed: the keep his own side tore out is no puzzle to a colleague on a calm pass later)
  log(g, `${gd.callsign} boots ${d.def.name}: ${gave ? 'it goes in' : 'it holds'}`);
  return end(null);
}

// ---------------------------------------------------------------- QA and the panel
/** QA: what `gd` believes of `d` (null = nothing) */
export function doorForceBelief(g: Game, gd: Guard, d: Door): { sure: number; at: Vec3; seen: boolean; age: number } | null {
  const B = states.get(g)?.men.get(gd)?.beliefs.get(d); return B ? { sure: B.sure, at: v3.copy(B.at), seen: B.seen, age: g.time - B.t } : null;
}
/** QA: what `gd` is doing about a door this frame */
export function doorForceOn(g: Game, gd: Guard): { door: Door; fired: number; kick: 'walk' | 'set' | 'kick' | null } | null {
  const M = states.get(g)?.men.get(gd); if (!M) return null;
  if (M.kick) return { door: M.kick.door, fired: M.on?.fired ?? 0, kick: M.kick.phase };
  return M.on ? { door: M.on.door, fired: M.on.fired, kick: null } : null;
}
/** QA (tools/qa/doorforce-check.ts): hand `gd` the record a real sighting of his foe at `at` leaves, `age` seconds old. The game never calls it. */
export function doorForceSaw(g: Game, gd: Guard, at: Vec3, age = 0) { manOf(stateOf(g), gd).saw = { at: [at[0], 0, at[2]], t: g.time - age, used: false }; }
/** a restart or a checkpoint load (game.ts resetGuards: the roster is new men) / QA: forget everything about this game */
export function doorForceReset(g: Game) { states.delete(g); }
/** panel / console line */
export function doorForceSummary(): string {
  const s = DOORFORCE_STATS;
  return `an alerted man at a shut door ${DOORFORCE.on ? 'ON' : 'off'} ▸ stands ${s.stands} (heard ${s.heard}, seen ${s.seen}) · rounds through ${s.shots} (held for a friend ${s.heldFriend}) · boots ${s.kicks} (gave ${s.gave}; not thrown ${s.noKick})${DOORFORCE_LOG.length ? ` · last: ${DOORFORCE_LOG[DOORFORCE_LOG.length - 1]}` : ''}`;
}
