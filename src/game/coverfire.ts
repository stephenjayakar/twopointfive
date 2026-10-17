// AIMED FIRE CHEWS COVER (the destruction goal's AI piece; record rebuild/destruction/ai-fire.md). A shooter of either side who KNOWS a man is
// behind a breakable thing — a crate, a carton stack, a fabric partition, a thin drywall wall — puts his aimed rounds into it, on one spot, until it gives: a
// cover cell at a time, a partition column to a port. Then the fight is the fight again: he sees the man or he does not.
//   KNOWS     his own knowledge and nobody else's truth: where he last really SAW the man (the fight AI's sighting / the room fight's meter, copied here the
//             frame it happens: coverfireTick), `staleSecs` old at most — or a mate of his side within `callM` who has eyes on that man now (`callSecs`: a
//             call is good for the crate a man is behind, never for a wall into a room this man has not seen him in). Never the man's position read off the
//             game. A place heard is not a place known: only sightings are kept.
//   WHAT      the engine is asked what the line from his gun to that place meets (col.raycast → walls.breakableAt → walls.workLeft): the first thing in it must
//             be a breakable the engine indexed, the man's place within `behindM` beyond its face, nothing but more breakable between it and him, at most
//             `maxLayers` pieces deep and `maxRounds` of this gun's rounds in all. Concrete, metal, a door leaf, glass, loose furniture, anything unindexed, or
//             a wall with nobody known behind it: no round. The place asked about is where he was seen; for a man seen MOVING, also a stride or two on the
//             way he was going (`leadM`, `leadSecs`: he went behind it); and when the line to where he stood is CLEAR yet shows no man, a point `lowY` off the
//             floor there (he ducked).
//   HOW       the same gun, cadence, magazine, reload beat, hands and settle law as any other round of his (his side's skill row: a defender lays slower and
//             wider than a teammate, by the rows that already say so). The aim point is held on one spot while the place he knows stays within `sameM` of it,
//             so the engine's counts add up on one cell. Rounds stop at what they hit, as ever.
//   STOPS     the piece gives (the change feed: his count starts again on what stands behind, if anything) · the knowledge goes stale · he has put
//             `slackK` × what it wanted + `slack` rounds into it and it stands (given up for `giveSecs`) · a friend, a hostage or a civilian is in the lane or
//             beyond it as far as a round that got through would fly (`lane`, `pastM`) · the silent order holds his round · and a FREE man does not start at
//             all when walking round is quicker than shooting through (`roundSecs` a round against the nav path at `walkPace`) — a man on a post or under an
//             order has no feet of his own to weigh.
// THE SWITCH is COVERFIRE.on, and it only ever runs under the destruction goal's own (wallBreakOn: DESTRUCTION.on, tune.wallBreak, chaos > 0). Off = every
// hook returns on its first line: no state, no dice, no round (play-through digests equal the base's). The page: on unless the URL carries ?nocoverfire.
// Not here: what the man behind the cover then does, charges, glass, doors.
import { conditionSup } from './condition';
import { Vec3, v3, clamp, lerp, wrapAngle, DEG } from '../math/vec';
import type { Game, Guard } from './game';
import type { Character } from './character';
import { chaosOf } from './destruction';
import { wallBreakOn, WALLS, WALL_STATS } from './wallbreak';
import { isHostile, foeCrouched, foeDown } from './teams';
import { shotOrigin, burstTrigger, roundPastColleague, tickReloadBeat, startReloadBeat } from './guards';
import { fireWeapon } from './combat';
import { AIM } from './aim';
import { guardFireMods, SUPPRESSION } from './suppression';
import { silentHolds, silentGlassHolds } from './silent';
import { pairHolds } from './pairorders';
import { spottedHolds } from './spotted';
import { FIGHT_SKILL } from './roomfight';
import { civilianBodies } from './civilians';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

export const COVERFIRE = {
  on: true,
  /** s a sighting of his own stays a place worth rounds · s a mate's eyes-on stays a call · how far a call carries between two men of a side */
  staleSecs: 5, callSecs: 1.2, callM: 14,
  /** a mate's call is good for a PARTITION too (off: for a crate or a stack only — a wall into a room he has not seen the man in is not his to open on a word) */
  callWalls: false,
  /** m from the piece's face to the man's known place, beyond which he is not 'behind it' */
  behindM: { cover: 3, wall: 4 } as Record<string, number>,
  /** pieces of breakable the line may cross before the man · this gun's rounds all of them still want, at most · the reach of it */
  maxLayers: 3, maxRounds: 20, maxM: 30, minM: 1.5,
  /** m from his shoulder to the piece, under which it is not shot at: his muzzle is against it or through it (a round fired there is nobody's) */
  nearM: 1.0,
  /** rounds he will put into a piece that stands: slackK × what it wanted when he started + slack; then it is left alone this long */
  slackK: 1.5, slack: 3, giveSecs: 20,
  /** m off the lane (wider by coneK per metre out) a friend / hostage / civilian holds the round · m past the place a round that got through is followed */
  lane: 0.6, coneK: 0.03, pastM: 8,
  /** the aim point is kept through a newer sighting within this of it · s a chew stays his with his line off it (a step of his own) */
  sameM: 1.5, lingerSecs: 1,
  /** 'he went behind it': the place a man seen moving is taken to be — this many seconds of his pace on from where he was last seen, this far at most */
  leadSecs: 0.8, leadM: 1.5,
  /** the ducked man's point above the floor */
  lowY: 0.55,
  /** a free man's sum: seconds a round (this many a round) against the walk round at this pace */
  roundSecs: 0.25, walkPace: 3, walkAskSecs: 1.5,
  /** the team's line when one of them starts (once per man per saySecs, floor-wide every 4 s); '' = said by nobody */
  line: 'he\'s behind that. going through it.', saySecs: 12,
};
export const COVERFIRE_DEFAULTS = JSON.parse(JSON.stringify(COVERFIRE)) as typeof COVERFIRE;
/** chews started · rounds fired on one · of them stopped at the piece · times a piece being chewed gave · given up (it stood) · rounds held for a friend in or
 *  past the lane · held by the silent order · starts on a mate's call · starts refused: walking is quicker */
export const COVERFIRE_STATS = { chews: 0, shots: 0, landed: 0, opened: 0, gaveUp: 0, heldFriend: 0, heldSilent: 0, calls: 0, walked: 0, opChews: 0, defChews: 0 };
export const COVERFIRE_LOG: string[] = [];
/** QA: why a known place was not worth rounds, counted per frame asked (far · clear · door · solid · close · beyond · prop · gone · behind · deep · rounds · call) */
export const COVERFIRE_WHY: Record<string, number> = {};
const no = (why: string): null => { COVERFIRE_WHY[why] = (COVERFIRE_WHY[why] ?? 0) + 1; return null; };
const ZERO: typeof COVERFIRE_STATS = { chews: 0, shots: 0, landed: 0, opened: 0, gaveUp: 0, heldFriend: 0, heldSilent: 0, calls: 0, walked: 0, opChews: 0, defChews: 0 };
/** a count, on this game's books and on the process's (the probes read the latter) */
const bump = (S: State, k: keyof typeof COVERFIRE_STATS) => { S.stats[k]++; COVERFIRE_STATS[k]++; };

type Who = Guard | 'player';
interface Know { who: Who; at: Vec3; /** the floor he stood on · how he was moving over it when seen */ y0: number; v: [number, number]; t: number; /** a mate's call, not his own eyes: good for a crate only, and for the place alone */ call?: boolean }
/** `kt` the sighting it was laid on · `n` rounds since the piece last gave, `fired` in all · `t` the last frame it was his */
interface Chew { id: number; kind: string; who: Who; to: Vec3; hit: Vec3; /** where on the piece the running count began */ h0: Vec3; kt: number; n: number; fired: number; want: number; layers: number; budget: number; fresh: boolean; lay: number; t: number; next: number; k: number; call: boolean; seen: boolean }
interface Man { know: Know[]; chew: Chew | null; gave: Map<number, number>; no: { id: number; until: number } | null; saidT: number }
interface State { /** the last frame ticked: a clock that has gone BACK (a checkpoint load) forgets every man */ lastT: number; men: Map<Guard, Man>; serial: number; base: Record<string, number>; stats: typeof COVERFIRE_STATS; byId: Map<number, { landed: number; gave: number }>; saidT: number; pruneT: number }
/** what the room fight hands over of a teammate under an order (roomfight.ts Op — the fields read or written here) */
interface OpLike { gd: Guard; meters: Map<Guard, { m: number; seenT: number }>; tgt: Guard | null; aim: Vec3; reloadUntil: number; rounds: number; next: number }

const states = new WeakMap<Game, State>();
function live(g: Game): boolean {
  if (!COVERFIRE.on || !wallBreakOn(g) || !g.aiEnabled || g.touring || chaosOf(g) <= 0) return false;
  return true;
}
function stateOf(g: Game): State {
  let S = states.get(g);
  if (S && g.time < S.lastT - 1e-6) { S.men.clear(); S.byId.clear(); S.serial = g.destr.walls.serial; S.saidT = -100; S.pruneT = g.time; S.lastT = g.time; }
  if (!S) { S = { lastT: g.time, men: new Map(), serial: g.destr.walls.serial, base: { ...WALL_STATS }, stats: { ...ZERO }, byId: new Map(), saidT: -100, pruneT: 0 }; states.set(g, S); }
  return S;
}
function manOf(S: State, gd: Guard): Man { let M = S.men.get(gd); if (!M) { M = { know: [], chew: null, gave: new Map(), no: null, saidT: -100 }; S.men.set(gd, M); } return M; }
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const charOf = (g: Game, who: Who): Character => who === 'player' ? g.player.char : who.char;
const upOf = (g: Game, who: Who): boolean => who === 'player' ? !g.player.down : who.state !== 'dead' && who.char.alive;
const nameOf = (who: Who) => who === 'player' ? 'Player' : who.callsign;
function log(g: Game, s: string) { COVERFIRE_LOG.push(`${g.time.toFixed(2)} ${s}`); if (COVERFIRE_LOG.length > 400) COVERFIRE_LOG.splice(0, 200); }
/** this gun's round in the engine's units (wallbreak.ts round(): chaos × 2, a pistol's × pistolK) */
const weightOf = (g: Game, gd: Guard) => (gd.weapon.def.cls === 'pistol' ? WALLS.pistolK : 1) * chaosOf(g) * 2;

// ---------------------------------------------------------------- what he knows
function see(g: Game, S: State, gd: Guard, who: Who, low: boolean) {
  const c = charOf(g, who); const trunk = c.bones.spine2 ?? c.bones.hips ?? c.pos;
  const at: Vec3 = [trunk[0], c.pos[1] + (low ? 0.8 : 1.25), trunk[2]];
  const M = manOf(S, gd); const K = M.know.find(k => k.who === who);
  if (K) { K.at = at; K.y0 = c.pos[1]; K.v = [c.vel[0], c.vel[2]]; K.t = g.time; K.call = false; } else M.know.push({ who, at, y0: c.pos[1], v: [c.vel[0], c.vel[2]], t: g.time });
}
/** a mate's call he is acting on becomes a place HE knows (as old as the mate's own sighting: it goes stale like one of his) — and stays a CALL: the place
 *  alone, good for a crate and not for a wall, until his own eyes have the man */
function heard(S: State, gd: Guard, K: Know) { const M = manOf(S, gd); const mine = M.know.find(k => k.who === K.who); if (mine) { if (mine.t < K.t) { mine.at = K.at; mine.y0 = K.y0; mine.v = [0, 0]; mine.t = K.t; mine.call = true; } } else M.know.push({ ...K, v: [0, 0], call: true }); }
/** the freshest place he may spend rounds on: his own sightings first, then what a mate with eyes on the man is calling (`who`: only that man) */
function known(g: Game, S: State, gd: Guard, who: Who | null): { K: Know; call: boolean }[] {
  const C = COVERFIRE, out: { K: Know; call: boolean }[] = [];
  const own = S.men.get(gd);
  if (own) for (const K of own.know) if ((!who || K.who === who) && g.time - K.t <= C.staleSecs && upOf(g, K.who)) out.push({ K, call: !!K.call });
  for (const [mate, M] of S.men) {
    if (mate === gd || mate.team !== gd.team || mate.state === 'dead' || !mate.char.alive || flat(mate.char.pos, gd.char.pos) > C.callM) continue;
    for (const K of M.know) if (!K.call && (!who || K.who === who) && g.time - K.t <= C.callSecs && upOf(g, K.who) && !out.some(o => o.K.who === K.who && o.K.t >= K.t)) out.push({ K, call: true });
  }
  return out.sort((a, b) => b.K.t - a.K.t);
}

// ---------------------------------------------------------------- what the line would hit
interface Ask { index: number; id: number; kind: string; hit: Vec3; rounds: number; layers: number }
/** The engine's answer for a round from his gun at `to`: 'clear' = nothing short of the point · null = something that is not his to chew (or too much of it) ·
 *  else the piece, where the round would stop in it, and how many of THIS gun's rounds everything breakable in the line still wants. */
function ask(g: Game, gd: Guard, to: Vec3): Ask | 'clear' | null {
  const C = COVERFIRE, W = g.destr.walls; const from = shotOrigin(gd.char);
  const d = v3.sub(to, from); const L = v3.len(d); if (L < C.minM || L > C.maxM) return no('far');
  const dir: Vec3 = [d[0] / L, d[1] / L, d[2] / L], reach = L - 0.3;
  const st = g.col.raycast(from, dir, reach); if (!st) { no('clear'); return 'clear'; }
  if (st.index >= 1e6) return no('door');                                 // a door leaf: the doors' own
  const B = W.breakableAt(st.index); if (!B) return no('solid');            // concrete, metal, glass, a fitting: nothing the engine indexed
  if (st.t < C.nearM) return no('close');                                   // pressed to it: the gun is in the wall, not laid on it
  if (L - st.t > (C.behindM[B.kind] ?? 3)) return no('beyond');              // he is not behind THIS
  if (g.props.raycast(from, dir, st.t)) return no('prop');                 // loose furniture nearer: the round would stop in that
  const w = weightOf(g, gd); if (w <= 0) return null;
  const hit = v3.mad(from, dir, st.t);
  let left = W.workLeft(st.index, hit, dir, reach - st.t); if (left === null) return no('gone');   // (every cell of it the line crosses short of the place: a stack three deep is three cells' work)
  let p = st.t + 0.04; const ids = new Set([B.id]);
  for (; ;) {                                                           // (rayBox answers nothing from inside a box: each cast finds the next piece along)
    const h = g.col.raycast(v3.mad(from, dir, p), dir, reach - p); if (!h) break;
    const Bh = h.index >= 1e6 ? null : W.breakableAt(h.index); if (!Bh) return no('behind');   // something a round cannot chew between it and him
    if (!ids.has(Bh.id)) {                                               // (another standing piece of one already counted: counted)
      ids.add(Bh.id); if (ids.size > C.maxLayers) return no('deep');
      const more = W.workLeft(h.index, v3.mad(from, dir, p + h.t), dir, reach - p - h.t); if (more === null) return no('gone');
      left += more;
    }
    p += h.t + 0.04;
  }
  const rounds = Math.ceil(left / w - 1e-6); if (rounds > C.maxRounds) return no('rounds');
  return { index: st.index, id: B.id, kind: B.kind, hit, rounds: Math.max(1, rounds), layers: ids.size };
}
/** nobody of his own side, no neutral, no hostage in the lane from `from` to the place — or past it, as far as a round that got through would fly */
function lane(g: Game, gd: Guard, from: Vec3, to: Vec3): boolean {
  const C = COVERFIRE; const dx = to[0] - from[0], dz = to[2] - from[2]; const L2 = dx * dx + dz * dz; if (L2 < 0.01) return false;
  const L = Math.sqrt(L2); const dir = v3.normalize(v3.sub(to, from));
  const on = g.col.raycast(to, dir, C.pastM); const tMax = 1 + (on ? on.t : C.pastM) / L;
  const hit = (ch: Character): boolean => {
    const h = ch.bones.hips ?? ch.pos; const t = clamp(((h[0] - from[0]) * dx + (h[2] - from[2]) * dz) / L2, 0, tMax);
    return Math.hypot(from[0] + dx * t - h[0], from[2] + dz * t - h[2]) < C.lane + C.coneK * t * L;
  };
  if (!isHostile(gd.team, 'player') && !g.player.down && hit(g.player.char)) return false;
  for (const o of g.guards) if (o !== gd && o.state !== 'dead' && o.char.alive && !isHostile(gd.team, o.team) && hit(o.char)) return false;
  for (const cv of civilianBodies(g)) if (hit(cv.char)) return false;
  for (const h of g.rescue?.hostages ?? []) if (h.state !== 'dead' && h.char.alive && hit(h.char)) return false;
  return true;
}
/** a free man's sum: is shooting through quicker than walking round */
function worth(g: Game, gd: Guard, to: Vec3, rounds: number): boolean {
  const C = COVERFIRE; const path = g.col.nav.findPath(gd.char.pos, to, 2000) as Vec3[] | null; if (!path) return true;
  let len = 0, q = gd.char.pos; for (const p of path) { len += flat(q, p); q = p; } len += flat(q, to);
  return rounds * C.roundSecs <= len / C.walkPace;
}
const stays = (gd: Guard) => gd.pinned || !!gd.hold || !!gd.script;

// ---------------------------------------------------------------- the choice
/** May he put a round through what stands between his gun and this known place — and where to. Keeps the chew's own books (the piece, the spot held, the
 *  budget). `seen`: he has the man in his eyes this frame (no ducked-man guess: the point is the man). */
function choose(g: Game, S: State, gd: Guard, K: Know, call: boolean, seen: boolean): Chew | null {
  const C = COVERFIRE, M = manOf(S, gd); let Cw = M.chew;
  if (Cw && g.time - Cw.t > C.lingerSecs) { if (Cw.fired) log(g, `${gd.callsign} off #${Cw.id} after ${Cw.fired}`); M.chew = Cw = null; }   // (not his for that long: whatever he was on, he starts again)
  // the spot is HELD while it is the same sighting, or a newer one of the man about where he was
  const held = !!Cw && Cw.who === K.who && (K.t <= Cw.kt + 1e-9 || flat(Cw.to, K.at) < C.sameM);
  let to = K.at, a: Ask | 'clear' | null = null;
  if (held && !seen) { to = Cw!.to; a = ask(g, gd, to); }   // (a man in SIGHT is where he is: the caller's round goes at him, so that is the line asked about — only the count is held)
  else {
    // where a man last seen THERE, moving SO, is now: the place itself · a stride or two on the way he was going (he went behind it) · low at the place (the
    // line to where his chest was is clear and shows no man, or meets something that is not a round's to chew — a crate's lid, a rail: he is down behind what
    // is under it). A call is the place and nothing more; a man in sight is where he is.
    a = ask(g, gd, to); const sp = Math.hypot(K.v[0], K.v[1]), age = g.time - K.t;
    if ((!a || a === 'clear') && !seen && !call && sp > 0.5) { const d = Math.min(C.leadM, sp * Math.min(age, C.leadSecs)); to = [K.at[0] + K.v[0] / sp * d, K.at[1], K.at[2] + K.v[1] / sp * d]; a = ask(g, gd, to); }
    if ((!a || a === 'clear') && !seen && !call && age > 0.3) { to = [K.at[0], K.y0 + C.lowY, K.at[2]]; a = ask(g, gd, to); }
  }
  if (a === 'clear') { if (held) { if (Cw!.fired) log(g, `${gd.callsign} off #${Cw!.id} after ${Cw!.fired}: the line is clear`); M.chew = null; } return null; }
  if (!a) return null;   // (held: his line is on something else this frame — a step of his own, a jamb — and the chew is his a little longer)
  if (call && a.kind !== 'cover' && !C.callWalls && !(held && !Cw!.call)) { if (held) M.chew = null; return no('call'); }   // (…nor for what stands behind the crate once it gives; a chew laid on his OWN sighting is his whoever is calling)   // a call is good for the crate a man is behind, not for a wall into a room he has not seen
  if ((M.gave.get(a.id) ?? -1) > g.time) { if (held) M.chew = null; return null; }
  if (!Cw || !held || Cw.id !== a.id) {
    if (!held) {
      if (M.no && M.no.id === a.id && M.no.until > g.time) return null;
      if (!stays(gd) && !worth(g, gd, to, a.rounds)) { M.no = { id: a.id, until: g.time + C.walkAskSecs }; bump(S, 'walked'); return null; }
    }
    const was = held ? Cw : null;
    Cw = M.chew = { id: a.id, kind: a.kind, who: K.who, to: v3.copy(to), hit: a.hit, h0: a.hit, kt: K.t, n: 0, fired: was?.fired ?? 0, want: a.rounds, layers: a.layers, budget: Math.ceil(a.rounds * C.slackK) + C.slack, fresh: false,
      lay: was?.lay ?? 0, t: g.time, next: was?.next ?? 0, k: was?.k ?? 0, call, seen };
  }
  Cw.hit = a.hit; Cw.t = g.time; if (K.t > Cw.kt) Cw.kt = K.t; if (seen) Cw.to = v3.copy(to);
  if (seen && v3.dist(a.hit, Cw.h0) > 0.5) Cw.fresh = true;   // (a man in sight has moved on along the piece: another cell of it, another count)
  if (Cw.fresh) { Cw.fresh = false; Cw.n = 0; Cw.h0 = a.hit; Cw.want = a.rounds; Cw.budget = Math.ceil(a.rounds * C.slackK) + C.slack; }   // (it gave: what stands behind is a new count)
  if (Cw.n >= Cw.budget) { M.gave.set(a.id, g.time + C.giveSecs); M.chew = null; bump(S, 'gaveUp'); log(g, `${gd.callsign} leaves #${a.id}: ${Cw.n} rounds in and it stands`); return null; }
  return Cw;
}

// ---------------------------------------------------------------- the hooks
/** EYES ON, NO LINE (guards.ts alert branch: chest and head both blocked · roomfight.ts tickOp: the same for a teammate under an order): may the round go at
 *  `to` anyway, because what blocks it is breakable and worth the rounds. The caller's own gates, cadence and cone fire it. */
export function coverSeen(g: Game, gd: Guard, who: Who | null, to: Vec3): boolean {
  if (!live(g) || !who) return false;
  const S = stateOf(g); const Cw = choose(g, S, gd, { who, at: to, y0: charOf(g, who).pos[1], v: [0, 0], t: g.time }, false, true); if (!Cw) return false;
  if (!lane(g, gd, gd.char.muzzle, Cw.to)) { bump(S, 'heldFriend'); return false; }
  return true;
}
/** NO EYES ON HIM (guards.ts alert branch, ahead of covering / chasing the fix): the fight AI's man lays on the place he knows and fires through what hides it
 *  — his own trigger: fireCd, the burst, the reload beat, his hands and the settle law on a point that does not move. Returns the point his gun is on (the
 *  caller stands him still on it), null = nothing to chew: the branch goes on as it always did. */
export function coverBlind(g: Game, gd: Guard, dt: number): Vec3 | null {
  if (!live(g)) return null;
  const c = gd.char, who = gd.foe; if (!who || foeDown(g, gd) || gd.held || gd.script || g.time < gd.dazzledUntil || g.time < gd.staggerUntil) return null;
  const S = stateOf(g); let Cw: Chew | null = null;
  for (const o of known(g, S, gd, who)) { Cw = choose(g, S, gd, o.K, o.call, false); if (Cw) { if (o.call) heard(S, gd, o.K); break; } }
  if (!Cw) return null;
  const to = Cw.to, P = AIM.guard; const dist = flat(c.pos, to);
  if (gd.reloadT < 0 && !lane(g, gd, c.muzzle, to)) { bump(S, 'heldFriend'); return null; }   // (a round he may not fire is no reason to stand on it: the branch goes on as it always did)
  const facingErr = Math.abs(wrapAngle(Math.atan2(to[0] - c.pos[0], to[2] - c.pos[2]) - c.aimYaw));
  const on = facingErr < 0.25 && !gd.muzzleDown;
  const settle = Math.max(P.settleSecs, 1e-3) * clamp(dist / Math.max(P.rangeRef, 0.1), P.nearK, 1) * (gd.skill ? gd.skill.settleK : 1);
  Cw.lay = !g.tune.aimModel ? (on ? 1 : 0) : on ? Math.min(1, Cw.lay + dt / settle) : Math.max(0, Cw.lay - P.loseRate * dt);
  gd.fireCd -= dt;
  if (gd.reloadT >= 0) { tickReloadBeat(g, gd, dt); return to; }
  const ok = on && Cw.lay >= P.acquireMin - 1e-9;
  if (gd.weapon.def.burst) {
    const tr = gd.aim.track; gd.aim.track = Cw.lay;   // (his lay on the SPOT, for the burst's own cone — aim.ts guardRound — and for nothing else: his track on the MAN is put back, so a man who steps out is acquired from where it stood, not from a gun settled on a crate)
    burstTrigger(g, gd, dt, to, ok, ok); gd.aim.track = tr;
  } else if (ok && gd.fireCd <= 0 && !roundPastColleague(g, gd, to) && gd.weapon.fire()) {
    const W = gd.weapon.def, M = guardFireMods(g, gd), R = W.aiSpread; gd.fireCd = (W.cd + simRandom() * W.cdJitter) * M.gap;
    const hands = (R.base + Math.max(0, dist - R.rangeFrom) * R.rangeK) * (gd.skill ? gd.skill.spreadK : 1);
    fireWeapon(g, c, to, false, g.tune.aimModel ? { steady: true, spread: hands * lerp(P.unsettledK, 1, clamp(Cw.lay, 0, 1)) + M.spread } : { spread: M.spread });
    if (gd.weapon.roundsReady === 0) startReloadBeat(g, gd);
  }
  return to;
}
/** NOBODY IN HIS SIGHT (roomfight.ts tickOp, a teammate under an order): the same choice with the room fight's own trigger — its pairs, its settle law, its
 *  cone, his magazine. `point` puts his muzzle on a place through the order's overlay and returns the bearing. True = his gun is on a piece this frame. */
export function coverOp(g: Game, O: OpLike, dt: number, speed: number, point: (to: Vec3) => number): boolean {
  if (!live(g)) return false;
  const gd = O.gd, c = gd.char, S = stateOf(g); let Cw: Chew | null = null, who: Who | null = null;
  for (const o of known(g, S, gd, null)) {
    if (o.K.who !== 'player' && (silentHolds(g, gd, o.K.who) || pairHolds(g, gd, o.K.who) || spottedHolds(g, gd, o.K.who))) { bump(S, 'heldSilent'); continue; }   // (the room fight's own three holds — silent.ts, the pair's 'watch him', spotted.ts: a round held at a man in sight is held at the wall he stepped behind)
    Cw = choose(g, S, gd, o.K, o.call, false); if (Cw) { who = o.K.who; if (o.call) heard(S, gd, o.K); break; }
  }
  if (!Cw || !who) return false;
  const to = Cw.to, P = AIM.guard, Sk = FIGHT_SKILL.operative; const dist = flat(c.pos, to);
  if (!lane(g, gd, c.muzzle, to)) { bump(S, 'heldFriend'); return false; }   // (not his round: his order's own watch goes on)
  if (who !== 'player' && silentGlassHolds(g, gd, who, c, to)) { bump(S, 'heldSilent'); return false; }   // (silent.ts: standing glass on the way to that cover and the man has raised no alarm — a silent squad breaks no pane for it)
  const brg = point(to);
  const on = Math.abs(wrapAngle(brg - c.aimYaw)) < P.onDeg * DEG + Math.atan2(0.35, Math.max(dist, 0.3)) && v3.dist(O.aim, to) < 0.3 && !gd.muzzleDown;
  const settle = Math.max(P.settleSecs, 1e-3) * clamp(dist / Math.max(P.rangeRef, 0.1), P.nearK, 1) * Sk.settleK;
  Cw.lay = !g.tune.aimModel ? (on ? 1 : 0) : on ? Math.min(1, Cw.lay + dt / settle) : Math.max(0, Cw.lay - P.loseRate * dt);
  if (!on || Cw.lay < P.acquireMin - 1e-9 || g.time < Cw.next || g.time < O.next || g.time < O.reloadUntil) return true;   // (O.next: the room fight's own gap since his last round at a man)
  if (!gd.weapon.fire()) { O.reloadUntil = g.time + gd.weapon.def.reload.dur; g.say(gd, 'reloading.'); return true; }
  const R = gd.weapon.def.aiSpread; const hands = (R.base + Math.max(0, dist - R.rangeFrom) * R.rangeK) * Sk.spreadK;
  const supK = g.tune.suppression && conditionSup(g, gd, gd.sup.v) >= SUPPRESSION.flinch ? 1.6 : 1;
  fireWeapon(g, c, to, false, { steady: true, spread: hands * lerp(P.unsettledK, 1, clamp(Cw.lay, 0, 1)) * supK + speed * P.shooterMoveK * 0.5 });
  O.rounds++; Cw.k++; if (g.fight) g.fight.stats.opRounds++;
  O.next = Cw.next = g.time + (Cw.k % 2 === 0 ? Sk.shift[0] + simRandom() * (Sk.shift[1] - Sk.shift[0]) : Sk.pair);
  return true;
}

// ---------------------------------------------------------------- once a frame (game.ts, after the guards)
/** this frame's sightings copied into what each man knows · the engine's change feed read (a piece that gave) · this frame's rounds counted on the chews */
export function coverfireTick(g: Game, dt: number) {
  if (!live(g)) return;
  const S = stateOf(g), C = COVERFIRE, W = g.destr.walls; S.lastT = g.time;
  if (W.serial !== S.serial) {
    const rows = W.since(S.serial); S.serial = W.serial;
    if (!rows || rows.some(r => r.kind === 'reset')) { S.men.clear(); S.byId.clear(); }
    else for (const r of rows) {
      if (r.kind === 'door' || r.id < 0) continue;
      const rec = S.byId.get(r.id); if (rec) rec.gave++;
      let mine = false; for (const M of S.men.values()) { if (M.chew && M.chew.id === r.id) { M.chew.fresh = true; mine = mine || g.time - M.chew.t < 1; } M.gave.delete(r.id); }
      if (mine) { bump(S, 'opened'); log(g, `#${r.id} gave (${r.kind})`); }
    }
  }
  const now = (t: number) => g.time - t < dt * 0.5 + 1e-6;
  for (const gd of g.guards) {
    if (gd.state === 'dead' || !gd.char.alive) continue;
    if (gd.state === 'alert' && gd.foe && now(gd.lastSeenT) && !foeDown(g, gd)) see(g, S, gd, gd.foe, foeCrouched(g, gd));
  }
  const notice = FIGHT_SKILL.operative.notice;
  if (g.fight?.live) for (const O of g.fight.ops as unknown as OpLike[]) {
    if (O.gd.state === 'dead' || !O.gd.script) continue;
    for (const [h, m] of O.meters) if (h.state !== 'dead' && now(m.seenT) && (h === O.tgt || m.m >= notice)) see(g, S, O.gd, h, h.char.anim.crouch > 0.5);
  }
  for (const e of g.events) {
    if (e.kind !== 'guardShot' || e.time !== g.time || !e.to) continue;
    for (const [gd, M] of S.men) {
      const Cw = M.chew; if (!Cw || gd.char.id !== e.who || Cw.t !== g.time) continue;
      if (!Cw.fired) {   // the first round of it: a chew begun (counted, logged and — a teammate — said here, not when he only laid his gun on it)
        bump(S, 'chews'); if (Cw.call) bump(S, 'calls'); bump(S, gd.team === 'operative' ? 'opChews' : 'defChews');
        log(g, `${gd.callsign} on ${Cw.kind} #${Cw.id} for ${nameOf(Cw.who)}${Cw.call ? ' (a call)' : Cw.seen ? ' (in sight)' : ''}: ${Cw.want} rounds wanted, ${Cw.layers} deep`);
        if (C.line && gd.team === 'operative' && g.time - M.saidT > C.saySecs && g.time - S.saidT > 4) { M.saidT = S.saidT = g.time; g.say(gd, C.line); }
      }
      Cw.n++; Cw.fired++; bump(S, 'shots');
      const o = shotOrigin(gd.char), el = v3.dist(o, e.to), eh = el > 0.1 ? g.col.raycast(o, v3.scale(v3.sub(e.to, o), 1 / el), el + 0.15) : null;   // (did THIS round stop in the piece — or does nothing stand there now: the round it gave on)
      if (eh && Math.abs(eh.t - el) < 0.2 ? W.breakableAt(eh.index)?.id === Cw.id : v3.dist(e.to, Cw.hit) < 0.75 && el > 0.8) { bump(S, 'landed'); const rec = S.byId.get(Cw.id); if (rec) rec.landed++; else S.byId.set(Cw.id, { landed: 1, gave: 0 }); }
      break;
    }
  }
  if (g.time - S.pruneT > 2) {
    S.pruneT = g.time;
    for (const [gd, M] of S.men) {
      if (!g.guards.includes(gd)) { S.men.delete(gd); continue; }
      M.know = M.know.filter(k => g.time - k.t <= C.staleSecs + 1);
      for (const [id, until] of M.gave) if (until <= g.time) M.gave.delete(id);
    }
  }
}
/** the run's own numbers (tools/qa/playthrough.ts RunOut.coverfire): the counters, the rounds that landed on pieces that never gave anything (`never`, over
 *  `neverPieces` of them), and the engine's own counts since this game's first frame under the switch (rounds that met a breakable by anybody's gun, what opened) */
export function coverfireReport(g: Game): Record<string, number> {
  const S = states.get(g); const out: Record<string, number> = { on: live(g) ? 1 : 0, ...(S?.stats ?? ZERO), never: 0, neverPieces: 0, pieces: 0 };
  if (S) { for (const r of S.byId.values()) { out.pieces++; if (!r.gave) { out.never += r.landed; out.neverPieces++; } } }
  const base = S?.base ?? {}; for (const k of ['rounds', 'ports', 'holes', 'coverCells', 'coverDead'] as const) out[`wall_${k}`] = (WALL_STATS as Record<string, number>)[k] - (base[k] ?? 0);
  return out;
}
/** QA (tools/qa/coverfire-probes.ts): hand `gd` the record a real sighting of `who` leaves — the man's own place as if seen `age` seconds ago, standing still.
 *  The game never calls it: what a man knows comes from coverfireTick alone. */
export function coverfireSaw(g: Game, gd: Guard, who: Who, age = 0) {
  const S = stateOf(g); see(g, S, gd, who, charOf(g, who).anim.crouch > 0.5);
  const K = manOf(S, gd).know.find(k => k.who === who)!; K.t = g.time - age; K.v = [0, 0];
}
/** QA: what `gd` is on this frame (the piece, the rounds he has put in it), null = nothing */
export function coverfireOn(g: Game, gd: Guard): { id: number; kind: string; fired: number; want: number; to: Vec3 } | null {
  const Cw = states.get(g)?.men.get(gd)?.chew; return Cw ? { id: Cw.id, kind: Cw.kind, fired: Cw.fired, want: Cw.want, to: v3.copy(Cw.to) } : null;
}
/** a restart or a checkpoint load (game.ts resetGuards: the roster is new men) / QA: forget everything about this game */
export function coverfireReset(g: Game) { states.delete(g); }
