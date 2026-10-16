// AN ENEMY ON ALERT DOES NOT SIT BLIND IN THE DARK (the maintainer, 10-13, from play: "i do think enemies are a bit too comfortable in the dark when they know
// adversaries are out there. if they can't see around them (do we model that?), they should use their flashlight if they have it. if they don't have one they
// should stumble around to somewhere with light (?)").
//
// WHAT WAS MODELLED: an eye's sight of a man goes by the light ON THAT MAN (guards.ts sightGain / sightGainOn: detectRate × light^1.5 …) — nothing asks how much the
// watcher himself can see, and nobody acted on it. The level's own staff burn a light whenever they are not calm, but a mission's defenders (hostile units:
// rescue.ts, nightbreach.ts, stress.ts) are dealt their weapon lights OFF (`defLights` false) and never touch them: a man who has heard the door go stands at his
// mark, gun on a doorway he cannot see a shape in, and waits.
//
// THE RULE, for a living enemy unit whose light the mission left off, once he KNOWS and is BLIND:
//   · KNOWS, for good = his own senses have had it: he has been alert or searching, or gunfire, a kick or a bang has reached him (his witness record). KNOWS, for
//     now (`word`) = `byLamp`, the burning lamp of a mate WHO KNOWS is in his view (his cone, a clear line, `lampM`): a lamp going on
//     down a corridor is the word. A lamp lit on the word passes none on (no ring of lamps keeps itself lit) and goes out when that view is lost or lit.
//   · BLIND = the floor he is watching is dark: along his aim and `fanRad` either side of it, every `stepM` out to `lookM` or the first wall, less than `seeShare`
//     of the floor reads `litAt` or over on the meter's scale by the place's steady light and anybody's carried light but HIS OWN (a mate's beam down his lane, the
//     team's own lights, light him a view; his own is left out so the answer does not chase the switch). A man in a dark room watching a lit doorway is NOT blind:
//     he has the better of it and stays as he was.
//   · HE CARRIES A LIGHT (`carry` of them, by his id: no dice): it comes on after `onSecs` (+ his id's share of `onJitter`: a room's lamps do not click as one),
//     and goes off after `offSecs` (stretched by his id) of a lit view or of not knowing, never twice inside `holdSecs`. ONE MODEL: it is the same weapon light
//     every unit has — the meter reads it, it lights him and the room for the player, and pointed at an eye it gives him away (roomfight.ts lampGlare). That
//     trade is the point.
//   · HE CARRIES NONE (`seek`): after `blindSecs` of it, a defender who knows for good, is alert, holds a post the room fight gave him and whom
//     nothing else has (dig-in under way or set, his squad's word pending, a covered lane's mouth, a press, a buddy on his way; the captor; a last stand; Sam's
//     arm; magnesium; a script), with nobody in his eyes for `quietSecs`, no shot heard for `calmSecs` and no rounds going past him, walks — at `stumbleK` of the
//     investigating pace — to the nearest floor IN HIS OWN ROOM he can see from, unless where he stands already is such floor: `edge` — the nearest spot still in
//     the dark with lit floor in plain view within `edgeM` (he stops at the dark edge of a pool of light, not under the lamp) — else the nearest the place's own
//     light reaches; failing that, to the shoulder of a mate in the room whose lamp is burning. Never by way of a doorway or out of the room (`roam` lifts that: off as shipped), never to a spot
//     nearer the trouble than he stands, a way no longer than `walkM`. The walk is the room fight's own 'move' leg (roomfight.ts tickMove: his senses run, a
//     man seen close stops him, where he gets to is his post and he is alert there — as he was: only an alert man is sent, so the walk raises no
//     alarm of its own). At most `moves` such walks a man, `againSecs` apart.
//   · WHAT IT DOES NOT DO: a man with no light whose room has no lit floor and no lamp in it stays where he is, blind, as before.
// Nothing here gives anybody better eyes, aim or health: the eye, the meter and the sight gain are untouched.
// No dice, no camera, no graphics setting, no wall clock: the CPU's light estimate, counted seconds. Per-man state rides darkFoeSnapshot / darkFoeRestore (units
// are in no checkpoint today — savestate.ts canSave refuses with one on the floor — so nothing calls the pair but the check).
// Type-only game imports but for functions used inside calls (src/game is one import cycle).
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import type { Vec3 } from '../math/vec';
import { v3 } from '../math/vec';
import { lightEstimateAt, GUARD_EYE } from './guards';
import { isHostile } from './teams';
import { order } from './squad';
import { lastStandMan } from './laststand';
import { digInPhase } from './digin';
import { squadDefers, squadStaysIn } from './enemysquads';
import { laneHolds, laneWarns } from './lanes';
import { pressOwns } from './pressure';
import { buddyOwns } from './buddy';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?nodarkfoe = defenders leave their lights alone and stand
 *  where they were put, as they did) and by the shipped stand; the harness's frozen stand leaves it off (TPS_DARKFOE=1 turns it on). `litAt` is on the meter's
 *  0‥1 scale. UNTUNED by eye: nobody has seen it on a GPU, and the estimate has no bounce (it errs dark, so toward the lamp on). */
export const DARKFOE = {
  on: false,
  /** the share of them that carry a light (by id); 1 = every man, 0 = nobody */
  carry: 1,
  litAt: 0.3, lookM: 12, stepM: 2, fanRad: 0.3, seeShare: 0.34, askSecs: 0.25,
  onSecs: 0.6, onJitter: 2.5, offSecs: 15, offJitter: 0.4, holdSecs: 2,
  /** a mate's lamp coming on in his plain view within `lampM` is the word */
  byLamp: true, lampM: 16,
  /** true = a man who is only SUSPICIOUS (heard something, has found nobody) has the word too, as the first cut had it; off, the lamp waits until he is alerted */
  suspect: false,
  /** a man with no light walks to where he can see */
  seek: true, blindSecs: 3, seekM: 10, walkM: 12, edgeM: 3, stumbleK: 0.75, againSecs: 20, moves: 2, quietSecs: 4, calmSecs: 6,
  roam: false,   // true = he may leave his room for it, by its doorways (the lean as first put: "stumble around to somewhere with light"); false = only inside the room he defends
  /** he stops at the dark edge of the light (floor still dark, lit floor in plain view) where there is one in reach; false = the nearest floor he can see from, lit or not */
  edge: true,
};
export const DARKFOE_STATS = { asks: 0, clicksOn: 0, clicksOff: 0, walks: 0, toMate: 0, noSpot: 0 };

type Def = RoomFight['defs'][number];
/** per man: he knows for good, or for now (`word`: suspicious this moment, a mate's lamp in his view); the last reading of his view (true = blind) and seconds since it was read; his lamp, seconds the reading has stood against it, seconds since
 *  it last moved; seconds he has been blind with no light; walks taken, seconds since the last search, and where the last walk was sent */
interface FoeState { knows: boolean; word: boolean; blind: boolean; ask: number; lit: boolean; against: number; held: number; blindFor: number; moves: number; since: number; to: Vec3 | null; }
const stateOf = new WeakMap<Guard, FoeState>();

const frac = (x: number) => x - Math.floor(x);
/** his id's share of 0‥1: spread so that neighbours in the roster differ (no dice) */
const idShare = (gd: Guard, salt = 0) => frac((gd.char.id + salt) * 0.6180339887);
/** does this man carry a light of his own to switch on (a unit the mission dealt a dark weapon light: `carry` of them by id) */
export function darkFoeCarries(gd: Guard): boolean { return !!gd.unit && idShare(gd) < DARKFOE.carry; }
/** is he this rule's: a living enemy unit whose light the mission left off, in live play */
export function darkFoeRuled(g: Game, gd: Guard): boolean {
  return DARKFOE.on && !!gd.unit && !gd.unit.light && gd.state !== 'dead' && gd.char.alive && isHostile(gd.team, 'player') && !g.touring && !g.director.showing && !g.quietUtility
    && !g.rescue.crewHides(gd);   // (Hard's crew lying in wait is dark on purpose: rescue.ts)
}
/** THE SEAM (guards.ts poseFlashlight): his lamp burns by this rule this frame — a read, nothing counted; never for a man the rule has let go of (a show taken
 *  the floor, a light the mission has since dealt him) */
export function darkFoeLit(g: Game, gd: Guard): boolean { return DARKFOE.on && stateOf.get(gd)?.lit === true && darkFoeCarries(gd) && darkFoeRuled(g, gd); }

const mine = (gd: Guard) => (owner: number) => owner === gd.char.id;
const placeOnly = () => true;
/** the meter's reading of a point of floor: everything steady but the lights `skip` names */
const floorLight = (g: Game, x: number, z: number, skip: (owner: number) => boolean) => g.visibilityOf(lightEstimateAt(g, [x, 1.2, z], skip, true));

/** is the floor he is watching dark to him: under `seeShare` of it at `litAt` along his aim and either edge of his look, his own lamp left out (no floor in view at
 *  all — a wall at his nose — reads by where he stands) */
export function darkFoeBlind(g: Game, gd: Guard): boolean {
  const K = DARKFOE, c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]], skip = mine(gd); let n = 0, lit = 0; DARKFOE_STATS.asks++;
  for (const off of [0, -K.fanRad, K.fanRad]) { const fx = Math.sin(c.aimYaw + off), fz = Math.cos(c.aimYaw + off);
    for (let r = K.stepM; r <= K.lookM + 1e-6; r += K.stepM) { const x = eye[0] + fx * r, z = eye[2] + fz * r;
      if (g.col.segmentBlocked(eye, [x, 1.5, z])) break;
      n++; if (floorLight(g, x, z, skip) >= K.litAt) lit++; } }
  if (!n) return floorLight(g, c.pos[0], c.pos[2], skip) < K.litAt;
  return lit / n < K.seeShare;
}
/** has it reached him for good: he is or has been alert or searching, his ears have counted gunfire, a kick or a bang */
function learns(gd: Guard): boolean {
  const H = gd.witness.heard;
  return gd.state === 'alert' || gd.state === 'search' || H.shots + H.kick + H.bang > 0 || gd.witness.alertedBy !== null;
}
/** …or for now: a mate's burning lamp in his view (his eye's cone about his aim, a clear line, `lampM`) — and, only with `suspect`, being suspicious this moment */
function hasWord(g: Game, gd: Guard): boolean {
  if (DARKFOE.suspect && gd.state === 'suspicious') return true;   // (the maintainer, 10-13: the lamp only once he is alerted — a man who has merely heard something keeps it off, and a partner told to hold still stays in the dark)
  if (!DARKFOE.byLamp) return false;
  const c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]], cos = Math.cos(GUARD_EYE.halfDeg * Math.PI / 180), fx = Math.sin(c.aimYaw), fz = Math.cos(c.aimYaw);
  for (const o of g.guards) { if (o === gd || o.team !== gd.team || o.state === 'dead' || !stateOf.get(o)?.knows || !darkFoeLit(g, o) || !o.flashlight?.enabled) continue;   // (a lamp lit by one who KNOWS, and really burning: word of a word is no word, so a ring of lamps cannot keep itself lit)
    const dx = o.char.pos[0] - c.pos[0], dz = o.char.pos[2] - c.pos[2], d = Math.hypot(dx, dz); if (d > DARKFOE.lampM || d < 1e-3 || (dx * fx + dz * fz) / d < cos) continue;
    if (!g.col.segmentBlocked(eye, [o.char.pos[0], 1.5, o.char.pos[2]])) return true; }
  return false;
}
/** the switch under his thumb, for the player's ears only: no event is filed, nobody hears it */
function click(g: Game, gd: Guard, on: boolean) { if (on) DARKFOE_STATS.clicksOn++; else DARKFOE_STATS.clicksOff++; g.audio.play('click', gd.char.pos, 0.25); }

/** lit floor in plain view of a point within `edgeM` (eight ways, at half of it and at all of it) */
function litInView(g: Game, p: Vec3): boolean {
  const K = DARKFOE, eye: Vec3 = [p[0], 1.5, p[2]];
  for (let ring = 1; ring <= 2; ring++) { const r = K.edgeM * ring / 2;
    for (let k = 0; k < 8; k++) { const a = (k + (ring & 1) * 0.5) * Math.PI / 4, qx = p[0] + Math.sin(a) * r, qz = p[2] + Math.cos(a) * r;
      if (!g.col.segmentBlocked(eye, [qx, 1.5, qz]) && floorLight(g, qx, qz, placeOnly) >= K.litAt) return true; } }
  return false;
}
/** floor a man can see from: the place's own light on it, or lit floor in plain view within `edgeM` — `edge`: only the second, the floor itself still dark */
export function darkFoeSees(g: Game, p: Vec3, edge = false): boolean {
  const lit = floorLight(g, p[0], p[2], placeOnly) >= DARKFOE.litAt;
  return edge ? !lit && litInView(g, p) : lit || litInView(g, p);
}
const inRoom = (g: Game, D: Def, p: Vec3) => { const nav = g.col.nav; return !D.room || D.room.cells.has(nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell))); };
/** where the trouble is, as the room fight reads it for him (roomfight.ts threatOf): a man seen lately, the muzzle of the rounds past him, the entry he fears most, else what he watches */
function threatOf(g: Game, D: Def): Vec3 {
  const gd = D.gd;
  if (g.time - gd.sightT < 6) return gd.sightPos;
  if (gd.sup.src && g.time - gd.sup.srcT < 6) return gd.sup.src;
  let bi = -1, bv = 0.3; D.ev.forEach((v, i) => { if (v > bv) { bv = v; bi = i; } });
  return bi >= 0 && D.room ? D.room.entries[bi].at : D.pt;
}
/** his room is his fence: always, unless `roam` — and then still for a man of a squad that may not leave (enemysquads.ts mayLeave false) */
const fenced = (g: Game, gd: Guard) => !DARKFOE.roam || squadStaysIn(g, gd);
/** a way of no more than `walkM` to a spot — never by way of a doorway of his room, nor out of it (digin.ts's own rule) — or nothing */
function wayTo(g: Game, D: Def, q: Vec3): boolean {
  const c = D.gd.char, path = g.col.nav.findPath(c.pos, q, 6000); if (!path?.length) return false;
  let L = 0, w0: Vec3 = c.pos;
  for (const w of path) { L += v3.distXZ(w0, w); w0 = w;
    if (D.room && fenced(g, D.gd) && (!inRoom(g, D, w) && v3.distXZ(w, q) > 0.8 || D.room.entries.some(e => v3.distXZ(w, e.at) < 0.9))) return false; }
  return v3.distXZ(w0, q) <= 0.8 && L <= DARKFOE.walkM;
}
const WAY_TRIES = 6;
/** where a man with no light goes: the nearest floor of his room he can see from, else the shoulder of a mate in it whose lamp burns; null = nowhere in reach */
export function darkFoeSpot(g: Game, D: Def): { spot: Vec3; mate: boolean } | null {
  const K = DARKFOE, gd = D.gd, c = gd.char, nav = g.col.nav, cs = nav.cell, threat = threatOf(g, D), far = v3.distXZ(c.pos, threat) - 0.5;
  const free = (p: Vec3) => { const x = p[0], z = p[2];
    return !nav.isBlocked(x, z) && !nav.isBlocked(x + cs, z) && !nav.isBlocked(x - cs, z) && !nav.isBlocked(x, z + cs) && !nav.isBlocked(x, z - cs)   // (room for his shoulders)
      && (!fenced(g, gd) || inRoom(g, D, p)) && !laneWarns(g, gd, p) && !(D.room?.entries.some(e => v3.distXZ(p, e.at) < 1.2)) && v3.distXZ(p, threat) >= far   // (his own room, off its doorways, no nearer the trouble than he stands)
      && !g.guards.some(o => { if (o === gd || o.state === 'dead') return false; const t = stateOf.get(o)?.to; return v3.distXZ(o.char.pos, p) < 0.9 || (!!t && v3.distXZ(t, p) < 0.9); }); };   // (nor where another man stands or was sent)
  for (const edge of K.edge ? [true, false] : [false]) { let tries = 0;   // the dark edge of the light first, then any floor he can see from
    for (let r = 2; r <= K.seekM + 1e-6 && tries < WAY_TRIES; r += 1.5) { const n = Math.max(8, Math.round(r * 2.5));   // rings outward: the first that passes is the nearest
      for (let k = 0; k < n && tries < WAY_TRIES; k++) { const a = (k + (r % 3 ? 0.5 : 0)) * 2 * Math.PI / n, p: Vec3 = [c.pos[0] + Math.sin(a) * r, 0, c.pos[2] + Math.cos(a) * r];
        if (!free(p) || !darkFoeSees(g, p, edge)) continue;
        tries++; if (wayTo(g, D, p)) return { spot: p, mate: false }; } } }
  let best: Vec3 | null = null, bd = Infinity;
  for (const o of g.guards) { if (o === gd || o.team !== gd.team || o.state === 'dead' || !darkFoeLit(g, o) || !o.flashlight?.enabled) continue;
    const d = v3.distXZ(o.char.pos, c.pos); if (d < 2.5 || d > K.walkM || d >= bd) continue;
    const f = o.char.forward();
    for (const side of [1, -1]) { const p: Vec3 = [o.char.pos[0] - f[0] * 0.9 + f[2] * 1.1 * side, 0, o.char.pos[2] - f[2] * 0.9 - f[0] * 1.1 * side];   // (at his shoulder, a pace back: behind the lens, out of his line)
      if (free(p) && wayTo(g, D, p)) { best = p; bd = d; break; } } }
  return best ? { spot: best, mate: true } : null;
}
/** the room fight's own 'move' leg (digin.ts move, pressure.ts run): his script's legs, his own senses, planted where he gets to */
function walk(g: Game, D: Def, goal: Vec3) {
  const gd = D.gd;
  D.mode = 'move'; D.moveKind = 'fallback'; D.cameBy = null; D.moveT = 0; D.stallAt = v3.copy(gd.char.pos); D.stallT = 0; D.rallyAt = NaN; gd.pinned = false;
  order(gd, { goal: v3.copy(goal), speed: g.tune.guardInvestigate * DARKFOE.stumbleK, face: null, strafe: false, aimAt: null, upper: 'aim', stance: 'none', crouch: false });
}
/** why a blind man with no light may not leave his post now (null = he may): only an alert defender the room fight has holding, whom nothing else
 *  has, with nobody in his eyes for `quietSecs`, no shot heard for `calmSecs` and no rounds going past him */
export function darkFoeKept(g: Game, gd: Guard, D: Def | undefined = g.fight.defs.find(d => d.gd === gd)): string | null {
  if (!D) return 'not a room\'s defender';
  if (D.mode !== 'hold') return 'on the move';
  if (D.rallyAt === Infinity) return 'the mission\'s man';   // (roomfight's word for a man a mission placed and keeps: rescue's crew, a last stand)
  if (!D.room && !DARKFOE.roam) return 'no room of his own';   // (a picket out on the floor has no fence to keep him: he stays)
  if (gd.script || gd.held || g.time < gd.dazzledUntil) return 'not his own man';
  if (gd.state !== 'alert') return 'not alert';   // (the walk ends in the room fight's plant(), which makes a man alert: only one who is already is sent)
  if (g.time - gd.lastSeenT < DARKFOE.quietSecs || g.time - gd.witness.heard.lastShotT < DARKFOE.calmSecs || gd.sup.v > 0.05) return 'in a fight';
  if (digInPhase(g, gd) !== 'idle') return 'dug in';
  if (squadDefers(g, gd)) return 'his squad\'s';
  if (laneHolds(g, gd)) return 'holds a lane';
  const rally = D.rallyAt, press = pressOwns(g, D); D.rallyAt = rally;   // (pressOwns is roomfight's hook and may stop his rally clock as it answers: asked here it changes nothing)
  if (press || buddyOwns(g, D)) return 'the press\'s';
  if (g.rescue.captor() === gd || lastStandMan(g, gd)) return 'the captor / last stand';
  return null;
}

/** each frame, after the room fight (game.ts): who knows, who is blind, whose lamp moves, who walks — a return on its first line with the switch off */
export function darkFoeTick(g: Game, dt: number) {
  if (!DARKFOE.on || dt <= 0) return;
  const K = DARKFOE;
  for (const gd of g.guards) {
    let S = stateOf.get(gd);
    if (!darkFoeRuled(g, gd)) { if (S) S.lit = false; continue; }
    if (!S) { S = { knows: false, word: false, blind: false, ask: idShare(gd, 7) * K.askSecs, lit: false, against: 0, held: K.holdSecs, blindFor: 0, moves: 0, since: K.againSecs, to: null }; stateOf.set(gd, S); }
    S.held = Math.min(S.held + dt, 60); S.since = Math.min(S.since + dt, 600); S.ask += dt;
    if (S.ask >= K.askSecs) { S.ask = 0; if (!S.knows) S.knows = learns(gd); S.word = !S.knows && hasWord(g, gd); S.blind = (S.knows || S.word) && darkFoeBlind(g, gd); }
    if (!darkFoeCarries(gd)) S.lit = false;   // (`carry` turned down under a burning lamp)
    if (darkFoeCarries(gd)) {
      if (S.blind === S.lit) S.against = 0;   // (the reading agrees with the lamp)
      else { S.against += dt; if (S.against >= (S.lit ? K.offSecs * (1 + idShare(gd, 9) * K.offJitter) : K.onSecs + idShare(gd, 3) * K.onJitter) && S.held >= K.holdSecs) { S.lit = !S.lit; S.against = 0; S.held = 0; click(g, gd, S.lit); } }
      continue;
    }
    if (!K.seek || !S.knows) continue;
    S.blindFor = S.blind ? S.blindFor + dt : 0;   // (blind = the way he is looking is dark; whether WALKING would mend it is asked below, of the floor he stands on)
    if (S.blindFor < K.blindSecs + idShare(gd, 5) * 2 || S.moves >= K.moves || S.since < K.againSecs) continue;
    const D = g.fight.defs.find(d => d.gd === gd); if (!D || darkFoeKept(g, gd, D)) continue;
    S.since = 0; S.blindFor = 0;   // (found or not, the search is not asked again inside `againSecs`)
    if (darkFoeSees(g, gd.char.pos)) continue;   // (there is light in plain view of where he stands: no walk shows him more — which way he looks from there is the room fight's)
    const to = darkFoeSpot(g, D);
    if (!to) { DARKFOE_STATS.noSpot++; continue; }
    S.moves++; S.to = v3.copy(to.spot); DARKFOE_STATS.walks++; if (to.mate) DARKFOE_STATS.toMate++;
    walk(g, D, to.spot);
  }
}

/** QA / the panel: what the rule has of a man (null = never asked of him) */
export function darkFoeOf(gd: Guard): Readonly<FoeState> | null { return stateOf.get(gd) ?? null; }
/** 'dark ▸ Captor lamp ON · Door man no light, walked · Guard 1 can see · Roamer does not know' */
export function darkFoeSummary(g: Game): string {
  if (!DARKFOE.on) return 'dark ▸ defenders leave their lights alone (off)';
  const men = g.guards.filter(gd => darkFoeRuled(g, gd));
  return 'dark ▸ ' + (men.map(gd => { const S = stateOf.get(gd), has = darkFoeCarries(gd);
    return `${gd.callsign} ${!S || !(S.knows || S.word) ? 'does not know' : S.lit ? 'lamp ON' : !S.blind ? 'can see' : has ? 'blind, lamp coming' : S.moves ? 'no light, walked' : `no light, blind${darkFoeSees(g, gd.char.pos) ? ' by lit floor' : darkFoeKept(g, gd) ? ` (${darkFoeKept(g, gd)})` : ''}`}`; }).join(' · ') || 'no defender with a dark light');
}

// ---------------------------------------------------------------- snapshot / restore, by roster index (nothing saves a floor with units on it today)
export type DarkFoeSnap = (number[] | null)[];
export function darkFoeSnapshot(g: Game): DarkFoeSnap | undefined {
  if (!DARKFOE.on) return undefined;
  const men = g.guards.map(gd => { const S = stateOf.get(gd); return S ? [S.knows ? 1 : 0, S.blind ? 1 : 0, S.ask, S.lit ? 1 : 0, S.against, S.held, S.blindFor, S.moves, S.since, S.to ? 1 : 0, S.to?.[0] ?? 0, S.to?.[2] ?? 0, S.word ? 1 : 0] : null; });
  return men.some(m => m) ? men : undefined;
}
export function darkFoeRestore(g: Game, s: DarkFoeSnap | null | undefined) {
  const fin = (x: number, d = 0) => Number.isFinite(x) ? Math.max(0, x) : d;
  g.guards.forEach((gd, i) => { const M = s?.[i];
    if (!M) { stateOf.delete(gd); return; }
    stateOf.set(gd, { knows: !!M[0], word: !!M[12], blind: !!M[1], ask: fin(M[2]), lit: !!M[3], against: fin(M[4]), held: fin(M[5], DARKFOE.holdSecs), blindFor: fin(M[6]), moves: fin(M[7]), since: fin(M[8], DARKFOE.againSecs), to: M[9] ? [Number(M[10]) || 0, 0, Number(M[11]) || 0] : null }); });
}
