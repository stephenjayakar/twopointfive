// EACH MAN'S OWN PICTURE OF THE FIGHT (the maintainer, 10-14, of two teammates who stood off a wall charge in a known enemy's line: "i wonder if we need to
// solve this stuff more generally in a systems way. each actor has ideas of where other enemies are (which may be out of date), where is safe, what good cover
// points are, etc.").
//
// Before it a man held ONE enemy and ONE place (Guard.foe / lastKnown), a teammate under an order held no place at all (the room fight's meters), and nearly
// every rule that picks a spot was geometry with no enemy in the sum (docs/agents/team-feel.md, 'Each man's own picture'). This file is the one memory the spot
// rules ask instead:
//   · AN IDEA per enemy, per man: where that man was when THIS man last saw him, heard him fire, or was told of him — and when. It is never refreshed from the
//     truth: an enemy who walks off unseen leaves his idea where it was, growing older. An idea whose place the man has since looked at and found empty is LOST
//     (he is somewhere about); an enemy who went down out of his sight is still believed up until he sees the body or is told.
//   · HIS SIDE TELLS HIM: a man who has had eyes on an enemy for `tellSecs` passes the place to the men on his net (the squad's radio — and Sam's own eyes, who
//     is on it; the staff's; a defender squad's own men, or a defender in shouting distance). A told idea is as old as the teller's sighting.
//   · WHAT IS SAFE: a spot is EXPOSED, as far as he knows, when a place he believes an enemy to be (or one the man may have walked to since, for an old idea)
//     has a line to it — weighed down by the idea's age (exposedAt / exposedFor).
//   · WHERE COVER IS: floor beside something solid that none of those places has a line to, better with an edge to fight from (coverNear).
//
// ONE switch, PICTURE.on: ON in the page (?nopicture = the build as it was), OFF here and on the frozen harness stand (TPS_PICTURE=1; a FROZEN_HOLDS row). The
// memory alone moves nothing: each rule that asks it has its own key below (off = that rule as it was). No dice, no camera, no graphics setting, nothing off
// the GPU; state per Game in a WeakMap with a reset and a snapshot / restore pair. Type-only game imports but for functions called inside functions.
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import { isHostile } from './teams';
import { canSee, canSeeChar, sightGain, sightGainOn, pointInView, bodyPos, lightEstimateAt, teamThrough } from './guards';
import { runnerFled, runnerOwns } from './runner';
import { squadOf } from './enemysquads';
import { PLAYER_ID } from './consts';

/** the switch and every number of it (UNTUNED by play) */
export const PICTURE = {
  on: false,
  /** how often each man looks about him for it (s; the men take turns) and the sight rate that counts (the game's own glimpse line) */
  lookSecs: 0.2, glimpse: 0.05,
  /** a man tells his net of an enemy once he has known of him this long; a defender with no squad of his own tells the men inside `shoutM` */
  tellSecs: 1, shoutM: 16,
  /** a report under the gunshot line is placed by ear out to this far along the way the sound takes (× how well that way carries: guards.ts's own rule);
   *  gunfire is heard over the whole floor, as the game's hearing has it */
  popM: 7,
  /** a place he looks at tells him something (it is empty; a man lies there) only if it is lit this well on the light meter's scale, or is this near (m) */
  madeOut: 0.2, madeOutM: 3,
  /** an idea counts whole for `freshSecs`, falls to `staleK` of itself by `staleSecs` and is forgotten at `forgetSecs`; one whose place he has seen empty × `lostK` */
  freshSecs: 2, staleSecs: 20, staleK: 0.4, forgetSecs: 90, lostK: 0.5,
  /** an unseen man may have walked: the places he may be by now stand `walkMps` × the idea's age off it, up to `walkMax` (a heard one starts `heardM` wide), and count × `maybeK` */
  walkMps: 1.2, walkMax: 6, heardM: 2, maybeK: 0.6,
  /** a believed enemy's line reaches this far; his eye, a standing / kneeling man's chest, and his head above it (m): in a line = either shows */
  reachM: 30, eyeH: 1.6, chestH: 1.15, lowH: 0.7, headUp: 0.45,
  /** THE RULES THAT ASK IT (each off = that rule as it was; none acts with `on` off) */
  /** standing off a door charge: of the files the wall has room for, the first no known enemy has a line to (doortools.ts standoffPosts; the wall charge's
   *  marks are wallcharge.ts's own rule) */
  standoff: true,
  /** a pinned man's shift to cover is to a place hidden from every enemy he knows of, not only the one whose rounds came in (no such place: as it was) */
  cover: true,
  /** the wall charge's stand-off (wallcharge.ts knownFoes, WALLCHARGE.outOfFire): under the fog of war, who is known and where is answered by knownPlaces —
   *  what the fog has shown AND what the squad's men saw, heard or were told, the freshest of each man: a man heard firing after he was last seen, a man
   *  nobody saw, what a loaded game still remembers (off = the fog's record alone, as it was; the fog off: that rule's own 'everybody', as it was) */
  wall: true,
  /** getting off a live grenade (frag.ts fleeSpot): of the spots the blast has no line to, one no enemy he knows of has a line to either is worth
   *  `fleeCost` of the spot score (a metre of extra leg is 2: so four metres; a hidden spot scores about 100, so it only reorders them) — asked of the man
   *  down at the spot, as the blast is; never a spot in the blast's line for it; a spot at the very end of his legs gains nothing by it; the leg he is
   *  already on is left only for a firm line (half or more) (off = the spot as it was) */
  flee: true, fleeCost: 8,
  /** a defender giving his room up (roomfight.ts breakOff): the door he leaves by and the spot he holds it from are judged against every enemy he has a
   *  firm idea of, not the one threat point — no door within 3 m of one or opening into one's firm line, no walk within 2 m of one, a spot beyond the door none has a line to when there
   *  is one; no door left, cover in the room (off = the one threat point, as it was) */
  fallback: true,
  /** a stack's marks (orders.ts stackSeen): where a mark the walls deal is in a firm believed line (the marks' exposure summed is 0.5 or more), the whole
   *  order filed on ONE hand of the door is dealt instead when that file's marks, as they are finally handed out, sum to `stackK` of the dealt ones' or
   *  less — the latch hand on a tie. Not while a man of the order stands on his mark at the door, not for another cast (off = the walls' marks, as it was) */
  stack: true, stackK: 0.5,
  /** A STEP OFF A PLACE THE SQUAD CHOSE FOR ITSELF (pictureStep; the maintainer's call 1, built on its lean while he was away — off = the place as it was):
   *  a man standing where no order of Sam's pointed — his place in the file behind Sam while Sam stands (orders.ts), his stand-off mark while a wall charge
   *  waits for the word (wallcharge.ts repick: that rule's own marks, dealt again) — who has believed for `stepAfter` s that the place is in a firm line
   *  (`stepAt` or more exposed) takes the best cover inside `stepM` of it that no enemy he knows of has a line to (standing; else on a knee) and that
   *  holds a foot either way, a straight walk off the place, a stride nearer a believed man at most, a body's room from everybody. He keeps it while the place he left is still `stepFree` or more exposed (and Sam stands), and
   *  looks again if the cover itself comes into a firm line. Never a spot Sam pointed at (move there, hold), never a stack, never a man with a target in
   *  his eyes, never the silent squad's men (spotted.ts has those). No cover: he stays, and looks again in `stepRest` s. */
  step: true, stepAt: 0.5, stepFree: 0.25, stepM: 2.5, stepAfter: 0.6, stepRest: 1.5, stepSecs: 5,
  /** A COLLEAGUE'S SHOTS PLACE THE ENEMY WHERE THE SHOOTER BELIEVES HIM (guards.ts colleagueFirePos; the maintainer's call 3, built on its lean while he was
   *  away — the first of the other side's all-seeing reads to go): a man who hears a colleague fire was handed the true live place of the man fired at,
   *  through any wall. With this he is handed the SHOOTER'S OWN IDEA of that man — where he sees him, or last saw, heard or was told of him — as old as it
   *  is, and keeps his own word of the man when that is the newer (a fix he works from, or with none his own idea). A shooter with no idea of his man, or a
   *  show (no pictures kept): as it was. A shooter with eyes on his man gives the same place to a fifth of a second (off = the true place, as it was) */
  shot: true,
  /** THE MAN WHO DROPS HIS GUN AND RUNS GOES BY HIS OWN PICTURE (runner.ts known; the maintainer, of the next all-seeing read to go: "keep" — off = as it
   *  was): his way out was planned round every living enemy's TRUE place, through any wall — the floor he may reach, the outside nobody has a line to,
   *  the corner farthest from them, the look ahead for a man in his way. With this each is reckoned from the men he KNOWS of, where he believes each to be
   *  (every idea he still holds but a place he has seen empty); a man he knows nothing of turns him only once he sees him. The world's own rule keeps
   *  the truth: he leaves the floor only when no enemy truly has a line to him — and stopped outside with a man's eyes on him he has that man. A man
   *  that file has is off his side's net here too (`onNet`): he is told nothing and calls nothing, as netquiet.ts and enemysquads.ts have him */
  run: true,
  /** pinned cover with rounds passing thin walls (suppression.ts coverFrom, wallpen.ts): with no place hidden from every man he knows of, a place that
   *  STOPS the shooter's round though another known man has a line to it is kept over one the round goes through (off = whichever came first, as it
   *  was). A mend with a key so that a recording from before it replays as it played; no flag, no toggle */
  coverHard: true,
  /** the floor view of one man's picture (ui/pictureviz.ts): 'off' · 'cursor' = the fighter nearest the aim point · 'all' = every teammate's ideas */
  show: 'off' as 'off' | 'cursor' | 'all',
  /** the view's reach round the man (m) */
  showM: 9,
};

export type Who = Guard | 'player';
export type IdeaHow = 'seen' | 'heard' | 'told' | 'fix';
/** one man's idea of one enemy */
export interface Idea {
  who: Who;
  /** where he believes him to be (on the floor), when that was true as far as he knows, and since when he has known of him at all */
  at: Vec3; t: number; since: number;
  /** his own eyes · his own ears (gunfire) · a mate's call (`by`) · the place his own senses have him working from (Guard.lastKnown) */
  how: IdeaHow; by: Guard | null;
  /** he has looked at the place since and the man was not there */
  lost: boolean;
}
/** one man's picture: his ideas, the enemies he knows are down (and since when), when he last placed each by ear, his next look */
interface Pic { owner: Guard | null; ideas: Map<Who, Idea>; downs: Map<Who, number>; heard: Map<Who, number>; lookT: number; step?: Step | null; stepAsk?: number; stepIn?: number; stepNext?: number; /** the mark last asked about (the count starts again when it moves) · a cover he could not get onto (not picked again while the same order asks) */ stepFor?: Vec3; stepBad?: Vec3 | null; }
/** the step a man has taken off his place (PICTURE.step): whose asking it is (`key`: the order that has him — null: a loaded game's, the first asker's), the place he left, the cover, on a knee there, his next look at both */
interface Step { key: object | null; mark: Vec3; at: Vec3; low: boolean; lookT: number; /** when it was dealt */ t0: number; }
interface State { men: Map<Guard, Pic>; sam: Pic; tellT: number; done: WeakSet<object>; view: PictureView | null; viewT: number; }
const STATES = new SideMap<Game, State>('picture.STATES');
function stateOf(g: Game): State { let S = STATES.get(g); if (!S) { S = { men: new Map(), sam: { owner: null, ideas: new Map(), downs: new Map(), heard: new Map(), lookT: -1e9 }, tellT: -1e9, done: new SideSet(), view: null, viewT: -1e9 }; STATES.set(g, S); } return S; }
function picOf(S: State, gd: Guard, now: number): Pic { let P = S.men.get(gd); if (!P) { P = { owner: gd, ideas: new Map(), downs: new Map(), heard: new Map(), lookT: now + (S.men.size % 8) * PICTURE.lookSecs / 8 }; S.men.set(gd, P); } return P; }
export const PICTURE_STATS = { looks: 0, seen: 0, heard: 0, told: 0, fixes: 0, lost: 0, downs: 0, forgot: 0, asks: 0, lines: 0, /** a rule's pick the picture changed */ moved: 0, /** a colleague's shots heard with the shooter's own idea of his man to go by (PICTURE.shot; one a hearer), those a metre or more from the true place, and those the hearer kept his own newer word over */ shotPlaced: 0, shotOff: 0, shotKept: 0, /** ways a running man planned from his own picture (PICTURE.run), and those planned on a picture that was not the truth (an enemy he did not know of, or one a metre or more from where he believed him) */ ran: 0, ranOff: 0, /** steps taken off a place in a believed line (PICTURE.step: the file's men, a wall charge's stand-off marks dealt again) */ stepped: 0, /** stack asks answered with a one-hand file (menu re-reads included), and those on the hinge hand */ filed: 0, filedHinge: 0 };
export function pictureReset(g: Game) { STATES.delete(g); }

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const floor = (p: Vec3): Vec3 => [p[0], 0, p[2]];
const nameOf = (w: Who) => w === 'player' ? 'Player' : w.callsign;
const up = (g: Game, w: Who) => w === 'player' ? !g.player.down : w.state !== 'dead' && w.char.alive;
const posOf = (g: Game, w: Who): Vec3 => w === 'player' ? g.player.char.pos : w.char.pos;
/** no longer anybody's enemy to place: a unit taken off the floor, a man who dropped his gun and ran (runner.ts — guards.ts acquireFoe lets go of him the same) */
const gone = (g: Game, w: Who) => w !== 'player' && (!g.guards.includes(w) || runnerFled(w));
/** can his eye make anything out AT a place it has a line to: near enough, or lit (the light meter's CPU stand-in of the place, any lamp counted) */
const madeOut = (g: Game, gd: Guard, p: Vec3) => flat(gd.char.pos, p) <= PICTURE.madeOutM || g.visibilityOf(lightEstimateAt(g, [p[0], 1.1, p[2]])) >= PICTURE.madeOut;
/** a man who keeps a picture: a living armed man of an AI side (never a civilian, never a man in somebody's arm) */
const fighter = (gd: Guard) => gd.state !== 'dead' && gd.char.alive && !gd.civ && gd.team !== 'civilian';
/** the enemies there are for a side, as a list of men (and Sam) */
function foesOf(g: Game, team: Guard['team'] | 'player'): Who[] {
  const out: Who[] = []; if (team !== 'player' && isHostile(team, 'player')) out.push('player');
  for (const o of g.guards) if (!o.civ && isHostile(team, o.team)) out.push(o);
  return out;
}

// ---------------------------------------------------------------- what reaches him
function learn(g: Game, P: Pic, who: Who, at: Vec3, t: number, how: IdeaHow, by: Guard | null) {
  const I = P.ideas.get(who);
  if (I) { I.at = floor(at); I.t = t; I.how = how; I.by = by; I.lost = false; }
  else P.ideas.set(who, { who, at: floor(at), t, since: g.time, how, by, lost: false });
  P.downs.delete(who);
}
/** one man's look about him: every enemy his eye has (the game's own sight test and rate), the place his own senses have him working from, the believed places
 *  he can see are empty, the men he knows are down. His OWN pass, not guards.ts acquireFoe's: a teammate under an order runs the room fight's meters and
 *  keeps no place, so the picture does its own looking for every man alike (five times a second a man). */
function look(g: Game, P: Pic, gd: Guard) {
  const K = PICTURE, now = g.time; PICTURE_STATS.looks++;
  if (gd.held) return;   // (in Sam's arm: no senses — what he knew he still knows)
  for (const who of foesOf(g, gd.team)) {
    if (!up(g, who) || gone(g, who)) continue;
    const vis = who === 'player' ? canSee(g, gd) : canSeeChar(g, gd, who.char, false); if (!vis.visible) continue;
    const rate = who === 'player' ? sightGain(g, gd, vis.dist) : sightGainOn(g, gd, who, vis.dist);
    if (rate > K.glimpse) { learn(g, P, who, posOf(g, who), now, 'seen', null); PICTURE_STATS.seen++; }
  }
  // (the place his own senses put his man at — a footfall, a door, a call the older rules pushed at him: the same belief the rest of his AI walks to. It is a
  // PLACE, not a person: it stands for his man where nothing of his own says otherwise — no idea of him yet, an idea that was itself a fix or a call, or a
  // place the man could have walked to since he was last seen or heard. A noise somewhere else does not move a man he saw.)
  const F = gd.foe;
  if (F && !gd.script && gd.lastKnown && up(g, F) && !gone(g, F) && now - gd.fixT < K.forgetSecs) {
    const I = P.ideas.get(F), own = !!I && (I.how === 'seen' || I.how === 'heard');
    if (!I || (gd.fixT > I.t + 0.05 && !(I.how === 'seen' && now - I.t < 0.5) && (!own || flat(gd.lastKnown, I.at) <= K.heardM + 2 + (gd.fixT - I.t) * K.walkMps * 2))) { learn(g, P, F, gd.lastKnown, Math.min(now, gd.fixT), 'fix', null); PICTURE_STATS.fixes++; }
  }
  const blind = now < gd.dazzledUntil;
  for (const [who, I] of P.ideas) {
    if (now - I.t > K.forgetSecs || gone(g, who)) { P.ideas.delete(who); PICTURE_STATS.forgot++; continue; }
    if (!up(g, who)) {   // down: he knows it if he had eyes on him as he fell, or has the body in view now, where he can make it out
      const fell = who === 'player' ? now : who.diedAt, body = who === 'player' ? floor(g.player.char.pos) : bodyPos(who);
      if ((I.how === 'seen' && fell - I.t < 1) || (!blind && (pointInView(g, gd, [body[0], 0.3, body[2]], 16, 75) || pointInView(g, gd, [body[0], 0.9, body[2]], 16, 75)) && madeOut(g, gd, body))) { P.ideas.delete(who); P.downs.set(who, now); PICTURE_STATS.downs++; }
      continue;
    }
    // he is looking at the place and the man is not there — which he can only say of a place he can make things out at; and a man who IS there and is not seen
    // (the dark on him, smoke between them: his sight pass above said no) is not 'gone from it'
    if (!I.lost && now - I.t > 1 && !blind && flat(posOf(g, who), I.at) > 1.2 && pointInView(g, gd, [I.at[0], 1.1, I.at[2]], 14, 58) && pointInView(g, gd, [I.at[0], 0.4, I.at[2]], 14, 58) && madeOut(g, gd, I.at)) { I.lost = true; PICTURE_STATS.lost++; }
  }
}
/** Sam's own eyes, for the squad's net: a hostile the fog of war shows him (one model: what the picture shows) with a line from his head — or, with no fog
 *  on this run, a line to a man in front of him who stands in light (his own light meter) or close by */
function lookSam(g: Game, P: Pic) {
  const now = g.time, c = g.player.char; if (g.player.down) return;
  const eye = c.bones.head ?? v3.add(c.pos, [0, 1.65, 0]), fog = g.fogOfWar, fwd = c.forward(), thr = teamThrough();   // (FOG.mates: his line to a man passes the thin things the picture's does)
  for (const o of g.guards) {
    if (o.civ || !isHostile('player', o.team) || !isHostile(o.team, 'operative')) continue;   // (the squad's enemies: a quiet floor's staff are Sam's own business)
    if (!up(g, o)) { if (P.ideas.has(o) && !g.col.segmentBlocked(eye, [o.char.pos[0], 0.3, o.char.pos[2]])) { P.ideas.delete(o); P.downs.set(o, now); } continue; }
    if (runnerFled(o)) continue;
    const p = o.char.pos, d = flat(p, c.pos); if (d > PICTURE.reachM) continue;
    const shown = fog?.active ? !fog.hidden(o) : d < PICTURE.madeOutM || ((p[0] - c.pos[0]) * fwd[0] + (p[2] - c.pos[2]) * fwd[2] > 0 && o.visibility >= PICTURE.madeOut);
    if (shown && (!g.col.segmentBlocked(eye, [p[0], 1.1, p[2]], 0.02, thr) || !g.col.segmentBlocked(eye, [p[0], 1.6, p[2]], 0.02, thr))) learn(g, P, o, p, now, 'seen', null);
  }
  for (const [who, I] of P.ideas) if (now - I.t > PICTURE.forgetSecs || gone(g, who)) P.ideas.delete(who);
}
/** this frame's gunfire, placed by ear: each man who has not just seen the shooter puts him where the sound came from — the muzzle through open air, the
 *  doorway or corner it came round otherwise (as every noise is placed); a report that reaches him only through solid mass he hears and cannot place.
 *  WHETHER he hears it is guards.ts hearingCheck's own rule: gunfire over the whole floor, a quieter report along the way the sound takes, stretched by a
 *  picked weather's noise at his ear (weather.ts hearPath's two lines, asked of the Game here: an import of weather.ts from this file moves the cycle's order) */
function hear(g: Game, S: State) {
  const K = PICTURE, now = g.time;
  for (const e of g.events) {
    if ((e.kind !== 'shot' && e.kind !== 'guardShot') || e.who === undefined || S.done.has(e)) continue; S.done.add(e);
    const who: Who | null = e.who === PLAYER_ID ? 'player' : g.guards.find(x => x.char.id === e.who) ?? null; if (!who) continue;
    const team = who === 'player' ? 'player' : who.team, loud = (e.level ?? 0) >= 1;
    for (const gd of g.guards) {
      if (gd === who || !fighter(gd) || gd.held || !isHostile(gd.team, team)) continue;
      const P = picOf(S, gd, now), I = P.ideas.get(who); if (I && I.how === 'seen' && now - I.t < 1) continue;   // (his eyes have the man)
      if (now - (P.heard.get(who) ?? -1e9) < 0.8) continue; P.heard.set(who, now);   // (… or he placed him by ear a moment ago)
      if (flat(e.pos, gd.char.pos) > (loud ? 80 : 22)) continue;
      const ear = v3.add(gd.char.pos, [0, 1.5, 0]), prop = g.col.sound.propagate(v3.add(e.pos, [0, 1, 0]), ear);
      if (!loud && prop.pathLen * (g.weather ? g.weather.hearMask(ear) : 1) >= K.popM * prop.carry * Math.max(0.3, (e.level ?? 0.6) / 0.6) + 0.5) continue;
      if (!prop.direct && !prop.routed) continue;
      // (WHERE: the muzzle through open air. Round a corner, gunfire says roughly where — the two-metre square it came from, as guards.ts places a routed shot
      // near its source and not at his own doorway; no die here, the memory draws none — and a quieter report only the doorway or corner it came round.)
      let at: Vec3 = prop.direct ? e.pos : prop.via;
      if (!prop.direct && loud) { const q: Vec3 = [Math.round(e.pos[0] / 2) * 2, 0, Math.round(e.pos[2] / 2) * 2]; if (!g.col.nav.isBlocked(q[0], q[2])) at = q; }
      learn(g, P, who, at, now, 'heard', null); PICTURE_STATS.heard++;
    }
  }
}
/** are two men on one net (a's call reaches b) */
function onNet(g: Game, a: Pic, b: Pic): boolean {
  if (a === b || !b.owner) return false;   // (nobody tells Sam: the player's picture is the screen)
  const B = b.owner; if (!fighter(B) || B.held) return false;
  if (PICTURE.run && (runnerOwns(B) || (!!a.owner && runnerOwns(a.owner)))) return false;   // (runner.ts: a man who has dropped his gun and run is off the net, as netquiet.ts and enemysquads.ts have him — what he tells his mates he shouts, that file's own tell)
  if (!a.owner) return B.team === 'operative';   // Sam's eyes are on the squad's radio
  const A = a.owner; if (!fighter(A) || A.held || A.team !== B.team) return false;
  if (A.team !== 'hostile') return true;   // the squad's radio, the staff's
  const qa = squadOf(g, A), qb = squadOf(g, B); return (!!qa && !!qb && qa.def === qb.def) || flat(A.char.pos, B.char.pos) <= PICTURE.shoutM;
}
/** the calls: what a man has SEEN or HEARD himself for `tellSecs` reaches his net, as old as it is (a call is not passed on, and the place his senses work
 *  from is not a man he can name); a man he knows is down reaches it the same way. In roster order, so a loaded game calls as the saved one would have. */
function tell(g: Game, S: State) {
  const K = PICTURE, now = g.time, all = [S.sam]; for (const gd of g.guards) { const P = S.men.get(gd); if (P) all.push(P); }
  for (const a of all) {
    if (a.owner && (!fighter(a.owner) || a.owner.held)) continue;
    for (const b of all) {
      if (!onNet(g, a, b)) continue;
      for (const [who, I] of a.ideas) {
        const J = b.ideas.get(who);
        if (I.lost) { if (J && !J.lost && J.t <= I.t + 1e-6) J.lost = true; continue; }   // ('he is not there': it un-says what the net holds of that same sighting or an older one)
        if (I.how === 'told' || I.how === 'fix' || now - I.since < K.tellSecs || b.downs.has(who)) continue;
        if (J && J.t >= I.t - K.tellSecs) continue;
        learn(g, b, who, I.at, I.t, 'told', a.owner); PICTURE_STATS.told++;
      }
      for (const [who, t] of a.downs) if (now - t >= K.tellSecs && !b.downs.has(who)) { b.ideas.delete(who); b.downs.set(who, now); }
    }
  }
}

/** AN IDEA HANDED TO ONE MAN from outside his senses (a check's staging, the page's `__picture.tell`): an enemy put in his picture as told, at `at`, `age`
 *  seconds old. Nothing with the switch off. */
export function pictureTell(g: Game, gd: Guard, who: Who, at: Vec3, age = 0) { if (!PICTURE.on || !fighter(gd)) return; const S = stateOf(g); learn(g, picOf(S, gd, g.time), who, at, g.time - age, 'told', null); }
/** once a frame, after everybody has moved (game.ts step) */
export function pictureTick(g: Game, _dt: number) {
  if (!PICTURE.on || !g.aiEnabled || g.touring) return;
  const S = stateOf(g), K = PICTURE, now = g.time;
  for (const gd of S.men.keys()) if (!g.guards.includes(gd)) S.men.delete(gd);   // (a despawned unit)
  let ops = false;
  for (const gd of g.guards) {
    if (!fighter(gd)) continue; if (gd.team === 'operative') ops = true;
    const P = picOf(S, gd, now); if (now >= P.lookT) { P.lookT = Math.max(P.lookT + K.lookSecs, now - K.lookSecs); look(g, P, gd); }
    if ((P.step || P.stepBad) && now - (P.stepAsk ?? -1e9) > 0.25) { P.step = null; P.stepBad = null; P.stepIn = -1; }   // (PICTURE.step: nobody has asked for a while — another order has him, the fight has, Sam walked on: the step is over, and no other man's search steers round it)
  }
  if (ops && now >= S.sam.lookT) { S.sam.lookT = now + K.lookSecs; lookSam(g, S.sam); }
  if (g.events.length) hear(g, S);
  if (now - S.tellT >= 0.5) { S.tellT = now; tell(g, S); }
}

// ---------------------------------------------------------------- what the rules ask
/** a man's ideas (nothing with the switch off, or of a man with none) */
export function ideasOf(g: Game, gd: Guard): Idea[] { if (!PICTURE.on) return []; const P = STATES.get(g)?.men.get(gd); return P ? [...P.ideas.values()] : []; }
/** what an idea counts for now: whole while fresh, less as it ages, less again once its place was seen empty; 0 = forgotten */
export function ideaWeight(g: Game, I: Idea): number {
  const K = PICTURE, age = g.time - I.t; if (age >= K.forgetSecs) return 0;
  const w = age <= K.freshSecs ? 1 : age <= K.staleSecs ? 1 - (1 - K.staleK) * (age - K.freshSecs) / (K.staleSecs - K.freshSecs) : K.staleK * (1 - (age - K.staleSecs) / (K.forgetSecs - K.staleSecs));
  return w * (I.lost ? K.lostK : 1);
}
/** how far the man may have walked since (m) */
export function ideaReach(g: Game, I: Idea): number { const K = PICTURE, age = g.time - I.t; return Math.min(K.walkMax, (I.how === 'heard' || I.how === 'fix' ? K.heardM : 0) + Math.max(0, age - K.freshSecs) * K.walkMps); }
/** the places he may be by now: six ways off the idea at its reach in whole metres, each one a straight walk from it. Dealt afresh at every ask and kept
 *  nowhere: the floor view asks it from the draw, and a rule's answer must not turn on whether the view is up or the game was loaded. */
function maybeOf(g: Game, I: Idea): Vec3[] {
  const r = Math.floor(ideaReach(g, I)), out: Vec3[] = []; if (r < 1) return out;
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, q: Vec3 = [I.at[0] + Math.sin(a) * r, 0, I.at[2] + Math.cos(a) * r]; if (!g.col.nav.isBlocked(q[0], q[2]) && g.col.nav.walkable(I.at, q)) out.push(q); }
  return out;
}
/** (the floor view's own asks are not counted: the panel's numbers are the rules') */
let VIEWING = false;
function lineTo(g: Game, from: Vec3, p: Vec3, h: number): boolean { if (!VIEWING) PICTURE_STATS.lines++; if (flat(from, p) > PICTURE.reachM) return false; const e: Vec3 = [from[0], PICTURE.eyeH, from[2]]; return !g.col.segmentBlocked(e, [p[0], h, p[2]]) || !g.col.segmentBlocked(e, [p[0], h + PICTURE.headUp, p[2]]); }   // (the guards' own rule the other way about: hidden only if chest AND head are)
function exposedTo(g: Game, I: Idea, p: Vec3, h: number): number {
  const w = ideaWeight(g, I); if (w <= 0) return 0;
  if (!I.lost && lineTo(g, I.at, p, h)) return w;
  for (const q of maybeOf(g, I)) if (lineTo(g, q, p, h)) return w * PICTURE.maybeK;
  return I.lost && lineTo(g, I.at, p, h) ? w * PICTURE.maybeK : 0;
}
/** HOW EXPOSED IS THIS SPOT, AS FAR AS HE KNOWS (0 = no enemy he knows of has a line to it … 1 = one he has eyes on does): the heaviest idea with a line to a
 *  man standing there (`low`: kneeling). 0 with the switch off or no idea at all. */
export function exposedAt(g: Game, gd: Guard, p: Vec3, low = false): number {
  if (!PICTURE.on) return 0; const P = STATES.get(g)?.men.get(gd); if (!P || !P.ideas.size) return 0;
  if (!VIEWING) PICTURE_STATS.asks++; let e = 0; const h = low ? PICTURE.lowH : PICTURE.chestH;
  for (const I of P.ideas.values()) { if (e >= 1) break; e = Math.max(e, exposedTo(g, I, p, h)); }
  return e;
}
/** THE SAME QUESTION ASKED OF MANY SPOTS AT ONE MOMENT (a rule scoring a ring of candidates: frag.ts fleeSpot): each idea's weight and the places its man
 *  may have walked to are dealt once, the heaviest idea asked first, and every answer is exposedAt's own. Null = the switch off or nothing known. */
export function exposureAsker(g: Game, gd: Guard, low = false): ((p: Vec3) => number) | null {
  if (!PICTURE.on) return null; const P = STATES.get(g)?.men.get(gd); if (!P || !P.ideas.size) return null;
  const h = low ? PICTURE.lowH : PICTURE.chestH, L: { I: Idea; w: number; maybe: Vec3[] | null }[] = [];
  for (const I of P.ideas.values()) { const w = ideaWeight(g, I); if (w > 0) L.push({ I, w, maybe: null }); }
  if (!L.length) return null; L.sort((a, b) => b.w - a.w);
  return p => { PICTURE_STATS.asks++; let e = 0;
    for (const X of L) { if (e >= X.w) break; const I = X.I;
      if (!I.lost && lineTo(g, I.at, p, h)) { e = X.w; continue; }
      const k = X.w * PICTURE.maybeK; if (e >= k) continue;
      if ((X.maybe ??= maybeOf(g, I)).some(q => lineTo(g, q, p, h)) || (I.lost && lineTo(g, I.at, p, h))) e = k; }
    return e; };
}
/** WHERE HE BELIEVES HIS ENEMIES TO BE, the ideas firm enough to steer a walk by: not seen empty, no staler than `staleSecs` (the places, on the floor) */
export function believedOf(g: Game, gd: Guard): Vec3[] { const out: Vec3[] = []; for (const I of ideasOf(g, gd)) if (!I.lost && g.time - I.t <= PICTURE.staleSecs) out.push(I.at); return out; }
/** a rule's dry asks (orders.ts stackSeen, asked from menus many times a second and inside asks that promise to leave nothing behind): no count ticked */
export function pictureQuiet<T>(fn: () => T): T { const was = VIEWING; VIEWING = true; try { return fn(); } finally { VIEWING = was; } }
/** the same for several men deciding together (an order's men): the worst any of them knows of the spot */
export function exposedFor(g: Game, men: readonly Guard[], p: Vec3, low = false): number { let e = 0; for (const gd of men) { if (e >= 1) break; e = Math.max(e, exposedAt(g, gd, p, low)); } return e; }
/** WHERE THESE MEN, BETWEEN THEM, BELIEVE THEIR ENEMIES TO BE: each enemy once, at the freshest word any of them has of him no older than `maxAge` — a
 *  man's own idea, Sam's own eyes for the squad's men (he is on their net), and for them what the fog of war has shown while it is up (fogofwar.ts sighting:
 *  the squad's shared sight, the one record the player is shown) — and nobody whose freshest place one of them has since seen empty. What they BELIEVE: a man
 *  who fell out of everybody's sight is still in it. One function answers 'who does the squad know of, and where'. Nothing with the switch off. */
export function knownPlaces(g: Game, men: readonly Guard[], maxAge: number): { who: Who; at: Vec3; age: number }[] {
  if (!PICTURE.on) return []; const S = stateOf(g), now = g.time, squad = men.some(gd => gd.team === 'operative'), fog = g.fogOfWar;
  const best = new Map<Who, { at: Vec3; t: number; lost: boolean }>();
  const put = (who: Who, at: Vec3, t: number, lost: boolean) => { const J = best.get(who); if (!J || t > J.t + 1e-6) best.set(who, { at, t, lost }); else if (lost && t >= J.t - 1e-6) J.lost = true; };
  const of = (P: Pic | undefined) => { if (P) for (const I of P.ideas.values()) if (now - I.t <= maxAge && !gone(g, I.who)) put(I.who, I.at, I.t, I.lost); };
  for (const gd of men) if (fighter(gd)) of(S.men.get(gd));
  if (squad) { of(S.sam);
    if (fog?.active) for (const h of g.guards) { if (h.civ || !isHostile('operative', h.team) || gone(g, h)) continue; const s = fog.sighting(h); if (s && s.age >= 0 && s.age <= maxAge) put(h, s.at, now - s.age, false); } }
  const out: { who: Who; at: Vec3; age: number }[] = []; for (const [who, J] of best) if (!J.lost) out.push({ who, at: v3.copy(J.at), age: now - J.t });
  return out;
}
/** do these men know of any enemy at all */
export function anyIdea(g: Game, men: readonly Guard[]): boolean { if (!PICTURE.on) return false; const S = STATES.get(g); return !!S && men.some(gd => (S.men.get(gd)?.ideas.size ?? 0) > 0); }
/** SEVERAL WHOLE DEALS OF MARKS (a file past the latch, the file past the hinge), SAFEST FIRST: by the worst any of the men knows of a deal's worst mark, in
 *  tenths; their own order kept among equals. The list as it came with the switch off, nothing known, or one deal. */
export function safestSets<T extends { pos: Vec3 }>(g: Game, men: readonly Guard[], sets: readonly T[][]): T[][] {
  if (sets.length < 2 || !anyIdea(g, men)) return sets.slice();
  return sets.map((S, i) => { let e = 0; for (const q of S) e = Math.max(e, exposedFor(g, men, q.pos)); return { S, i, e: Math.round(e * 10) }; }).sort((a, b) => a.e - b.e || a.i - b.i).map(x => x.S);
}
/** a place to fight from, as he knows the fight */
export interface CoverSpot { at: Vec3; /** exposed standing / kneeling there (0‥1) */ stand: number; low: number; /** a step from it has a line to an enemy he knows of */ edge: boolean; score: number; }
/** WHERE GOOD COVER IS, AS FAR AS HE KNOWS: floor inside `r` of `around`, beside something solid, that no enemy he knows of has a line to (whole, or kneeling:
 *  low cover) — best first: hidden over low, with an edge to fight from over a hole, nearer over further. Nothing with no idea of any enemy. */
export function coverNear(g: Game, gd: Guard, around: Vec3, r: number, n = 6, ok?: (q: Vec3) => boolean): CoverSpot[] {
  if (!PICTURE.on || !ideasOf(g, gd).length) return [];
  const nav = g.col.nav, cell = nav.cell, out: CoverSpot[] = [], x0 = Math.round(around[0] / cell) * cell + cell / 2, z0 = Math.round(around[2] / cell) * cell + cell / 2, m = Math.ceil(r);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let ix = -m; ix <= m; ix++) for (let iz = -m; iz <= m; iz++) {
    const q: Vec3 = [x0 + ix, 0, z0 + iz], d = flat(q, around); if (d > r || nav.isBlocked(q[0], q[2])) continue;
    if (!N4.some(([dx, dz]) => nav.isBlocked(q[0] + dx * 0.75, q[2] + dz * 0.75))) continue;   // (beside something solid)
    if (ok && !ok(q)) continue;
    const stand = exposedAt(g, gd, q), low = stand > 0 ? exposedAt(g, gd, q, true) : 0; if (stand > 0 && low > 0) continue;
    const edge = N4.some(([dx, dz]) => { const s: Vec3 = [q[0] + dx, 0, q[2] + dz]; return !nav.isBlocked(s[0], s[2]) && nav.walkable(q, s) && exposedAt(g, gd, s) > 0; });
    out.push({ at: q, stand, low, edge, score: (stand > 0 ? 0.7 : 1) + (edge ? 0.4 : 0) - 0.3 * d / Math.max(1, r) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, n);
}
/** A STEP OFF A PLACE IN A KNOWN ENEMY'S LINE (PICTURE.step). Asked every frame of a man who stands — or is about to stand — on `mark`, a place the squad
 *  chose for itself, by whoever has his feet (`key`: the order's own object; another key, or a frame nobody asked, and the step is over). Null: his place is
 *  his. Else the cover he has taken and whether he is on a knee there. `ok`: the asker's own word on a spot (a doorway, a leaf's swing); `busy`: he has
 *  a man in his eyes (no new step is looked for). No dice; the looks
 *  are a few lines a quarter second, the search one coverNear when the place has been in a firm line for `stepAfter` s. */
export function pictureStep(g: Game, gd: Guard, key: object, mark: Vec3, ok?: (q: Vec3) => boolean, busy = false): { at: Vec3; low: boolean } | null {
  const K = PICTURE; if (!K.on || !K.step) return null;
  const S = STATES.get(g), P = S?.men.get(gd); if (!S || !P) return null;
  const now = g.time, asked = P.stepAsk ?? -1e9, gap = now - asked > 0.25 || now < asked; P.stepAsk = now;
  if (P.step && P.step.key === null) P.step.key = key;   // (a loaded game: the order that has him now is the one that had him)
  if (P.step && (P.step.key !== key || gap)) P.step = null;   // (another order has him, or nobody asked for a while: Sam walked on)
  if (gap) { P.stepIn = -1; P.stepBad = null; }
  if (!P.ideas.size) { P.step = null; P.stepIn = -1; return null; }
  const X = P.step;
  if (X) {
    if (now >= X.lookT) { X.lookT = now + 0.5;
      if (exposedAt(g, gd, X.mark) < K.stepFree) { P.step = null; P.stepIn = -1; P.stepNext = now + K.stepRest; return null; }   // (nobody he knows of has the place any more: it is his again)
      // (he cannot get onto it — a chair rolled there, a mate, a leaf: that cover is no cover; another, from the place he left, and never that one again)
      const off = flat(gd.char.pos, X.at) > 0.6 && now - X.t0 > K.stepSecs; if (off) P.stepBad = X.at;
      if (off || exposedAt(g, gd, X.at, X.low) >= K.stepAt) { P.step = null; P.stepIn = now - K.stepAfter; P.stepNext = now; mark = X.mark; }   // (… or the cover itself has come into a firm line)
    }
    if (P.step) return { at: X.at, low: X.low };
  }
  if (busy) { P.stepIn = -1; return null; }   // (a man in his eyes: the step he is on stands, a new one waits)
  if (!P.stepFor || flat(P.stepFor, mark) > 0.4) { P.stepFor = floor(mark); if (X === P.step) P.stepIn = -1; }   // (the place asked about has moved: he is walking — the count is of one place)
  if (now < (P.stepNext ?? -1e9)) return null; P.stepNext = now + 0.25;
  if (exposedAt(g, gd, mark) < K.stepAt) { P.stepIn = -1; return null; }
  if ((P.stepIn ?? -1) < 0 || now < P.stepIn!) P.stepIn = now;
  if (now - P.stepIn! < K.stepAfter) return null;
  const nav = g.col.nav, sam = g.player.char.pos, firm: Vec3[] = [], bad = P.stepBad; for (const I of P.ideas.values()) if (!I.lost && ideaWeight(g, I) >= K.stepAt) firm.push(I.at);
  const free = (q: Vec3) => {
    if (flat(q, mark) > 0.05 && !nav.walkable(mark, q)) return false; if (flat(q, sam) < 0.9 || (bad && flat(q, bad) < 0.6)) return false;
    for (const f of firm) { const d = flat(q, f); if (d < 3 || d < flat(mark, f) - 1) return false; }   // (never up to a man he believes there, and a stride nearer him at most: suppression.ts coverFrom's own rule)
    // (a body's room from his own side — where each stands, the step each is on, the place each is walking to; of the other side he has only what he believes)
    for (const o of g.guards) { if (o === gd || o.state === 'dead' || isHostile(gd.team, o.team)) continue; if (flat(o.char.pos, q) < 0.8) return false;
      const os = S.men.get(o)?.step; if (os && flat(os.at, q) < 0.9) return false; const og = o.script?.goal; if (og && flat(og, q) < 0.8) return false; }
    return !ok || ok(q); };
  // (the cover has to hold a foot either way: a man stops within a stride of the spot, not on it — a spot hidden to the centimetre is no cover)
  const holds = (c: CoverSpot, low: boolean) => [[0.3, 0], [-0.3, 0], [0, 0.3], [0, -0.3]].every(([dx, dz]) => nav.isBlocked(c.at[0] + dx, c.at[2] + dz) || exposedAt(g, gd, [c.at[0] + dx, 0, c.at[2] + dz], low) <= 0);
  const C = coverNear(g, gd, mark, K.stepM, 8, free), best = C.find(c => c.stand <= 0 && holds(c, false)) ?? C.find(c => c.low <= 0 && holds(c, true));
  if (!best) { P.stepNext = now + K.stepRest; return null; }
  P.step = { key, mark: floor(mark), at: floor(best.at), low: !(best.stand <= 0 && holds(best, false)), lookT: now + 0.5, t0: now }; PICTURE_STATS.stepped++;
  return { at: P.step.at, low: P.step.low };
}
/** the step he is on, if any (the floor view, the check, the panel's line) */
export function pictureStepOf(g: Game, gd: Guard): { at: Vec3; mark: Vec3; low: boolean } | null { const X = PICTURE.on ? STATES.get(g)?.men.get(gd)?.step : null; return X ? { at: X.at, mark: X.mark, low: X.low } : null; }

// ---------------------------------------------------------------- showing it (ui/pictureviz.ts draws exactly this; the check reads it)
export interface PictureView {
  gd: Guard; from: Vec3;
  ideas: { who: string; at: Vec3; age: number; how: IdeaHow; w: number; reach: number; lost: boolean; maybe: Vec3[] }[];
  /** the floor round him he counts in an enemy's line ([x, z, how exposed]) and the cover he rates */
  unsafe: [number, number, number][]; cover: CoverSpot[];
}
/** whose picture the floor shows: the fighter nearest the aim point ('cursor'), null with the view off */
export function pictureShown(g: Game): Guard | null {
  if (!PICTURE.on || PICTURE.show !== 'cursor') return null;
  let best: Guard | null = null, bd = 2.5;
  for (const gd of g.guards) { if (!fighter(gd)) continue; const d = flat(gd.char.pos, g.aimPoint); if (d < bd) { bd = d; best = gd; } }
  return best;
}
function viewOf(g: Game, gd: Guard, ground: boolean): PictureView { VIEWING = true; try { return viewOf1(g, gd, ground); } finally { VIEWING = false; } }
function viewOf1(g: Game, gd: Guard, ground: boolean): PictureView {
  const K = PICTURE, c = gd.char.pos, nav = g.col.nav;
  const ideas = ideasOf(g, gd).map(I => ({ who: nameOf(I.who), at: v3.copy(I.at), age: g.time - I.t, how: I.how, w: ideaWeight(g, I), reach: ideaReach(g, I), lost: I.lost, maybe: maybeOf(g, I).map(q => v3.copy(q)) }));
  const unsafe: [number, number, number][] = [];
  if (ground && ideas.length) { const x0 = Math.round(c[0]), z0 = Math.round(c[2]), m = Math.ceil(K.showM);
    for (let ix = -m; ix <= m; ix++) for (let iz = -m; iz <= m; iz++) { const q: Vec3 = [x0 + ix + 0.25, 0, z0 + iz + 0.25]; if (flat(q, c) > K.showM || nav.isBlocked(q[0], q[2])) continue; const e = exposedAt(g, gd, q); if (e > 0) unsafe.push([q[0], q[2], e]); } }
  return { gd, from: [c[0], 0.05, c[2]], ideas, unsafe, cover: ground ? coverNear(g, gd, c, K.showM, 6) : [] };
}
/** what the floor view draws this frame (the ground and the cover re-read four times a second) */
export function pictureViews(g: Game): PictureView[] {
  if (!PICTURE.on || PICTURE.show === 'off' || g.touring) return [];
  if (PICTURE.show === 'all') return g.guards.filter(gd => fighter(gd) && gd.team === 'operative').map(gd => viewOf(g, gd, false));
  const gd = pictureShown(g), S = stateOf(g); if (!gd) { S.view = null; return []; }
  if (!S.view || S.view.gd !== gd || g.time - S.viewT >= 0.25 || g.time < S.viewT) { S.view = viewOf(g, gd, true); S.viewT = g.time; }
  else { const c = gd.char.pos; S.view.from = [c[0], 0.05, c[2]]; }
  return [S.view];
}

// ---------------------------------------------------------------- checkpoints (savestate.ts): every man's ideas by roster index (−1 = Sam), clocks as ages
type IdeaSnap = { who: number; at: Vec3; age: number; known: number; how: IdeaHow; by: number; lost: boolean };
/** (look: seconds to his next look; heard: who he last placed by ear and how long ago) */
type PicSnap = { ideas: IdeaSnap[]; downs: [number, number][]; heard: [number, number][]; look: number; /** the step he is on (PICTURE.step), the seconds to his next look at it · how long his place has been in a line (absent: it is not) · seconds to his next ask */ step?: { mark: Vec3; at: Vec3; low: boolean; look: number; since?: number }; stepBad?: Vec3; stepIn?: number; stepNext?: number };
export type PictureSnap = { men: (PicSnap | null)[]; sam: PicSnap; /** seconds since the last round of calls */ tell: number };
export function pictureSnapshot(g: Game): PictureSnap | undefined {
  if (!PICTURE.on) return undefined; const S = STATES.get(g); if (!S) return undefined;
  const ix = (w: Who | null) => w === 'player' || !w ? -1 : g.guards.indexOf(w), now = g.time, here = (w: Who) => w === 'player' || ix(w) >= 0;
  const ages = (M: Map<Who, number>, cap: number) => [...M].filter(([w, t]) => here(w) && now - t < cap).map(([w, t]) => [ix(w), now - t] as [number, number]);
  const snap = (P: Pic): PicSnap => ({
    ideas: [...P.ideas.values()].filter(I => here(I.who)).map(I => ({ who: ix(I.who), at: v3.copy(I.at), age: now - I.t, known: now - I.since, how: I.how, by: ix(I.by), lost: I.lost })),
    downs: ages(P.downs, Infinity), heard: ages(P.heard, 0.8), look: P.lookT - now,
    ...(P.step ? { step: { mark: v3.copy(P.step.mark), at: v3.copy(P.step.at), low: P.step.low, look: P.step.lookT - now, since: now - P.step.t0 } } : null), ...(P.stepBad ? { stepBad: v3.copy(P.stepBad) } : null), ...((P.stepIn ?? -1) >= 0 ? { stepIn: now - P.stepIn! } : null), ...((P.stepNext ?? -1e9) > now ? { stepNext: P.stepNext! - now } : null) });
  return { men: g.guards.map(gd => { const P = S.men.get(gd); return P ? snap(P) : null; }), sam: snap(S.sam), tell: now - S.tellT };
}
export function pictureRestore(g: Game, s: PictureSnap | null | undefined) {
  STATES.delete(g); if (!s || !PICTURE.on) return;
  const S = stateOf(g), now = g.time, whoOf = (i: number): Who | null => i < 0 ? 'player' : g.guards[i] ?? null;
  const put = (P: Pic, X: PicSnap | null | undefined) => { if (!X) return;
    for (const I of X.ideas ?? []) { const who = whoOf(I.who); if (!who || !Array.isArray(I.at)) continue; P.ideas.set(who, { who, at: v3.copy(I.at), t: now - (I.age || 0), since: now - (I.known || 0), how: I.how, by: I.by >= 0 ? g.guards[I.by] ?? null : null, lost: !!I.lost }); }
    for (const [w, age] of X.downs ?? []) { const who = whoOf(w); if (who) P.downs.set(who, now - (age || 0)); }
    for (const [w, age] of X.heard ?? []) { const who = whoOf(w); if (who) P.heard.set(who, now - (age || 0)); }
    if (Number.isFinite(X.look)) P.lookT = now + X.look;
    if (X.step && Array.isArray(X.step.at) && Array.isArray(X.step.mark)) { P.step = { key: null, mark: v3.copy(X.step.mark), at: v3.copy(X.step.at), low: !!X.step.low, lookT: now + (X.step.look || 0), t0: now - (X.step.since || 0) }; P.stepAsk = now; }
    if (Array.isArray(X.stepBad)) { P.stepBad = v3.copy(X.stepBad); P.stepAsk = now; }
    if (Number.isFinite(X.stepIn)) { P.stepIn = now - X.stepIn!; P.stepAsk = now; } if (Number.isFinite(X.stepNext)) P.stepNext = now + X.stepNext!; };
  g.guards.forEach((gd, i) => { const X = s.men?.[i]; if (X) put(picOf(S, gd, now), X); });   // (in roster order, every man who had a picture: the next man's turn falls where it would have)
  put(S.sam, s.sam); if (Number.isFinite(s.tell)) S.tellT = now - s.tell;
}

// ---------------------------------------------------------------- panel / QA
/** 'picture ▸ Blue One: Tango 3 seen 0.2 s, Tango 5 told 6 s (lost) · …' — the squad's men, then how many of the other side know of anybody */
export function pictureSummary(g: Game): string {
  if (!PICTURE.on) return 'picture ▸ off'; const S = STATES.get(g); if (!S) return 'picture ▸ nobody yet';
  const parts: string[] = []; let foes = 0, know = 0;
  for (const [gd, P] of S.men) {
    if (!fighter(gd)) continue;
    if (gd.team !== 'operative') { foes++; if (P.ideas.size) know++; continue; }
    parts.push(`${gd.callsign}: ${[...P.ideas.values()].map(I => `${nameOf(I.who)} ${I.how} ${(g.time - I.t).toFixed(g.time - I.t < 10 ? 1 : 0)} s${I.lost ? ' (lost)' : ''}`).join(', ') || 'nobody'}`);
  }
  if (foes) parts.push(`${know} of ${foes} of the other side know of somebody`);
  const T = PICTURE_STATS; parts.push(`${T.seen} seen, ${T.heard} heard, ${T.told} told, ${T.lost} lost, ${T.asks} asks`);
  return 'picture ▸ ' + parts.join(' · ');
}
/** for the check: one man's idea of one enemy */
export function ideaOf(g: Game, gd: Guard, who: Who): Idea | null { return PICTURE.on ? STATES.get(g)?.men.get(gd)?.ideas.get(who) ?? null : null; }
