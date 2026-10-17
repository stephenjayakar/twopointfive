// THE LIGHTS GO OUT AND SOMEBODY GOES TO PUT THEM BACK ON (defenders answer the plan the team chose: the answer to the mains being cut).
//
// WHAT WAS THERE: lighting.ts setBlackout hands the walk to the breaker to the nearest calm man who can leave where he stands. A mission's defenders (the room
// fight's hostile units: a room clear, a rescue, the night breach) are every one of them held on a mark, so with workthings.ts's `posted` rule nobody is handed
// it and nobody says it: the team cuts the mains and the garrison stands in the dark for as long as the team cares to take.
//
// THE RULE, for a room fight's hostile defenders, once per blackout:
//   · WHO NOTICES: a living defender, his wits about him, with a mains-fed fixture that was burning in his plain view inside `seeM` (a clear line from his eye to
//     where it hangs) — or whose floor goes dark: the floor he stands on, watches (his aim and either edge of his look, out to `lookM`) or has about him
//     (`aboutM` every way) read `litAt` or over on the meter's scale by the place's own light at the trip and under `dropK` of that `darkAfter` seconds on (a
//     lamp over a glass roof, a fitting round a corner: what he loses is the lit floor, not the bulb). Nobody loses any: nothing is said and nobody goes — a
//     garrison in rooms with no light of the mains, or in daylight with no fitting in view, has nothing to miss.
//   · THE WORD COMES FIRST. `think` seconds after the trip (by the id of the first man to notice: no dice) one of them says on their net what they do, and
//     nobody moves for `beat` seconds after it. The net is what the team's strip shows (cues.ts), the walk files its boots for the team's ears (pressure.ts
//     boots), and the men who go burn their weapon lights for as long as the mains are down (guards.ts poseFlashlight: `powerOutLit`) — heard and seen
//     before it lands; what lands is the lights coming back on.
//   · WHO GOES: only men who are FREE (`kept` below — calm, holding a post the room fight gave them, nobody else's: no dig-in, squad's word, lane, press, buddy,
//     last stand, captor, script, Sam's arm). The breaker in a defender's own room: the man of that room nearest it, alone, and he never leaves the room.
//     Elsewhere: the `men` nearest it by the way they would walk, no further than `maxM`, A MAN LEFT IN EVERY ROOM THAT HAD ONE while that can be done; no
//     man to spare anywhere and `lone`: the nearest goes by himself and his room stands empty behind him (that is the price of the lights, and the team's
//     opening). A squad told to stay in its rooms (`mayLeave: false`: it answers no other squad's FIGHT) still sends for the lights with `stayers`.
//   · THE WALK is the room fight's own 'move' leg at the pace of a man going to look (his own senses under it: a man of the team seen close stops him to
//     fight, and he is the room fight's from there). The first man puts his hand to the lever (lighting.ts re-arms it under any man of their side who stands
//     at it: its own fumble, its own "breaker's back in"); the second stops a few paces short with a line to him and watches the way they came. The mains
//     back — by his hand, by the trip's own clock, by anybody — every man out walks back to the post he left and holds it as he held it.
//   · THE GARRISON ALREADY KNOWS (a man of them alert or searching, or with gunfire, a boot or a charge in his ears — or they are holding hostages: rescue.ts
//     has every one of them learn of the team by the dark itself): nobody walks out into a fight to mend a
//     fuse — "that's them — stay on your doors!", and THE WORD is out (below). The same the `parties`+1-th time the lights go in one fight, and after a
//     party that lost a man: a fault does not happen twice, and nobody is fed to it again.
//   · A BREAKER SHOT TO SCRAP: the man who gets there looks at it for `lookSecs`, says so, and the word is out; they go back.
//   · THE WORD (`powerOutWord`): their side holds the dark for the team's doing. darkfoe.ts takes it as the word a mate's lamp is — a man of theirs whose view
//     is dark lights his own — for as long as the mains stay down. Nothing else reads it.
//   · A MAN OF THE PARTY GOES DOWN OR IS TAKEN: nobody is sent again this fight. Nobody is told by magic either: a mate out with him who has the place he
//     fell in plain view (or who gets to his own place by the lever and finds nobody at it) says so ("he's down at the breaker — that's them!"), the word is out and he runs for his post; a fall nobody saw is only MISSED —
//     `overdue` seconds past the walk's own length with the mains still down and no word from the party, "nothing from the breaker — that's them!".
//   · THE FIRST MAN CANNOT STEP OFF when the beat is up (dazzled, taken, another rule's by then): the second goes for the lever in his place; neither can:
//     nobody goes, and the walk is not counted. A lever that will not take a hand in `leverSecs` is given up. The lights back and gone again inside a walk:
//     the party already out is the answer (a man on his way home turns back). The switch thrown off under a walk: the men out run back to their posts.
//   · FIGHT WHILE THEY ARE OUT (a man of them roused, or the walker's own ears count a shot, a boot or a charge): a man with his hand already at the lever
//     finishes; anybody else goes back to his post at a run and is the room fight's man there.
// Nothing here gives anybody better eyes, aim or health, and no man is added. What a defender acts on is a fixture he saw die, his side's net, and his own
// senses on the walk — never where the team is.
// DYNAMIC: the way to the breaker is asked of the walk grid as it stands when the word is given and again on every leg, so a wall blown open or a door
// wedged shut changes the way they come; a breaker no man can reach inside `maxM` sends nobody.
// No dice, no camera, no graphics setting, no wall clock. State per Game (powerOutSnapshot / powerOutRestore beside it, carried by savestate.ts; the timeline
// is the check's and the debugger's and is not kept). Type-only game imports but for functions used inside calls (src/game is one import cycle).
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import { Vec3, v3 } from '../math/vec';
import { isHostile } from './teams';
import { order, endGuardScript } from './squad';
import { run, boots, pressOwns } from './pressure';
import { breakerErrand } from './workthings';
import { breakerResetNear } from './lighting';
import { lightEstimateAt } from './guards';
import { darkFoeCarries } from './darkfoe';
import { squadDefers, squadStaysIn } from './enemysquads';
import { laneHolds } from './lanes';
import { digInPhase } from './digin';
import { lastStandMan } from './laststand';
import { buddyOwns } from './buddy';
import { runnerFled } from './runner';
import { netQuietHolds } from './netquiet';

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?nopowerout = the garrison stands in the dark, as it did)
 *  and by the shipped stand; the harness's frozen stand leaves it off (TPS_POWEROUT=1 turns it on). UNTUNED by play: nobody has played against it. */
export const POWEROUT = {
  on: false,
  /** m: a burning mains fixture in a man's plain view this near is one he saw die */
  seeM: 14,
  /** s between the trip and their word on the net (by id) · s between the word and the first step */
  think: [3, 6] as [number, number], beat: 2,
  /** … or the floor he stands on, watches (out to `lookM`, every `stepM`) or has about him (`aboutM` every way) read `litAt` or over by the place's light and falls under `dropK` of it, read `darkAfter` s after the trip */
  lookM: 12, aboutM: 4, stepM: 2, fanRad: 0.3, litAt: 0.3, dropK: 0.5, darkAfter: 0.3,
  /** men who go · the longest way they will walk for it, m · a garrison with nobody to spare sends its nearest man alone */
  men: 2, maxM: 60, lone: true,
  /** a squad the level tells to stay in its rooms still sends for the lights */
  stayers: true,
  /** times a garrison walks to the breaker in one fight (the next time the lights go it is no fault) */
  parties: 1,
  /** s a man looks at a breaker shot to scrap before he says so · legs a walk is tried in before it is given up */
  lookSecs: 1.5, tries: 8,
  /** s the first man stands at a lever that will not take his hand before he gives it up · s past the walk's own length before a party that lost a man and
   *  sent no word is missed ("nothing from the breaker") · the nearest men, in a straight line, whose way to the lever is worked out */
  leverSecs: 8, overdue: 15, ask: 6,
  /** the second man: how far short of the lever he stops, m (nearest free floor in that band with a line to it) */
  coverM: [1.6, 3.2] as [number, number],
};

type Def = RoomFight['defs'][number];
/** how a man held his post before he left it (enemysquads.ts's looker keeps the same) */
export interface Calm { awareness: number; hold: boolean; pinned: boolean; station: Vec3; home: Vec3; room: Def['room']; ev: number[]; watch: number; want: number; pt: Vec3 }
type Phase = 'wait' | 'out' | 'there' | 'back';
interface Man { gd: Guard; role: 'lever' | 'cover'; phase: Phase; goal: Vec3; from: Vec3; watch: Vec3 | null; tries: number; stepT: number; heard0: number; thereT: number; calm: Calm | null }
export interface PowerOutEvent { t: number; what: 'noticed' | 'said' | 'go' | 'there' | 'wrecked' | 'restored' | 'home' | 'abort' | 'lost' | 'overdue' | 'stay' | 'nobody'; who: string; why: string }
interface State {
  /** the blackout this is the answer to (Game.blackout.since) · when their word is due · when the men step off (−1 = no party) */
  since: number; decideAt: number; goAt: number;
  /** the walk's length as their word gave it, m · when a party that lost a man and has sent no word is missed (−1 = nobody is waited for) */
  wayM: number; overdueAt: number;
  /** where a man of the party went down, until a mate out with him has seen it */
  fell: Vec3 | null;
  /** men whose floor was lit at the trip (index in Game.guards, the reading) and when it is read again (−1 = read, or no need) */
  seen: { i: number; lit: number }[]; lookAt: number;
  men: Man[]; decided: boolean; word: boolean;
  /** kept over the whole fight: walks to the breaker so far, and a party that lost a man */
  parties: number; lost: boolean;
  events: PowerOutEvent[];
}
const STATES = new WeakMap<Game, State>();

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const frac = (x: number) => x - Math.floor(x);
/** his id's share of 0‥1 (no dice) */
const idShare = (gd: Guard) => frac(gd.char.id * 0.6180339887);
const alive = (gd: Guard) => gd.state !== 'dead' && gd.char.alive && !runnerFled(gd);
const fit = (g: Game, gd: Guard) => alive(gd) && !gd.held && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil;
const roused = (gd: Guard) => gd.state === 'alert' || gd.state === 'search';
const loudHeard = (gd: Guard) => { const H = gd.witness.heard; return H.shots + H.kick + H.bang; };
const defOf = (g: Game, gd: Guard): Def | undefined => g.fight.defs.find(D => D.gd === gd);
/** the rule's men: the room fight's defenders on the other side from the player, in live play */
function ruled(g: Game): Def[] {
  if (!POWEROUT.on || g.touring || g.director.showing || g.quietUtility || !g.level.breaker) return [];
  return g.fight.defs.filter(D => isHostile(D.gd.team, 'player') && !!D.gd.unit);
}
function event(g: Game, st: State, what: PowerOutEvent['what'], gd: Guard | null, why: string) {
  st.events.push({ t: g.time, what, who: gd ? gd.callsign : '-', why }); if (st.events.length > 120) st.events.splice(0, 40);
  const L = g.fight.log; L.push({ t: g.time, who: gd ? gd.callsign : '-', what: `[powerout] ${what}: ${why}` }); if (L.length > 600) L.splice(0, 200);
}

/** a mains-fed fixture that was burning, in his plain view inside `seeM` */
function sawThemDie(g: Game, gd: Guard): boolean {
  const c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]];
  for (const t of g.targets) {
    if (!t.mains || !t.on || t.broken || !(t.factor > 0.3) || t.kind === 'breaker' || t.kind === 'device') continue;   // (factor: last frame's supply — a fitting the OCP has knocked out is no light to see die)
    if (flat(t.pos, c.pos) > POWEROUT.seeM) continue;
    if (!g.col.segmentBlocked(eye, [t.pos[0], Math.max(1.2, t.pos[1] - 0.15), t.pos[2]])) return true;
  }
  return false;
}
/** the brightest floor he stands on, watches or has about him, by the place's own light (guards.ts lightEstimateAt, the CPU meter both the page and the harness run: nobody's
 *  carried lamp, no flash, no beacon) */
function floorWatched(g: Game, gd: Guard): number {
  const K = POWEROUT, c = gd.char, eye: Vec3 = [c.pos[0], 1.5, c.pos[2]], at = (x: number, z: number) => g.visibilityOf(lightEstimateAt(g, [x, 1.2, z], carried, true));
  let best = at(c.pos[0], c.pos[2]);
  for (const off of [0, -K.fanRad, K.fanRad]) { const fx = Math.sin(c.aimYaw + off), fz = Math.cos(c.aimYaw + off);
    for (let r = K.stepM; r <= K.lookM + 1e-6; r += K.stepM) { const x = eye[0] + fx * r, z = eye[2] + fz * r;
      if (g.col.segmentBlocked(eye, [x, 1.5, z])) break;
      best = Math.max(best, at(x, z)); } }
  // (… and the floor about him, whichever way he faces: a room going dark is not missed for looking at its door)
  for (let k = 0; k < 8; k++) { const fx = Math.sin(k * Math.PI / 4), fz = Math.cos(k * Math.PI / 4);
    for (let r = K.stepM; r <= K.aboutM + 1e-6; r += K.stepM) { const x = eye[0] + fx * r, z = eye[2] + fz * r;
      if (g.col.segmentBlocked(eye, [x, 1.5, z])) break;
      best = Math.max(best, at(x, z)); } }
  return best;
}
const carried = () => true;
/** why a defender is not free to go (null = he is): calm, on a post the room fight gave him, and nobody else's */
export function powerOutKept(g: Game, D: Def): string | null {
  const gd = D.gd;
  if (!fit(g, gd)) return 'not his own man';
  if (D.mode !== 'hold') return 'on the move';
  if (D.rallyAt === Infinity) return 'the mission\'s man';   // (roomfight's word for a man a mission placed and keeps: rescue's crew, a last stand)
  if (gd.script) return 'on a script';
  if (roused(gd)) return 'in a fight';
  if (g.rescue.crewHides(gd) || g.rescue.captor() === gd || lastStandMan(g, gd)) return 'the captor / lying in wait / last stand';
  if (digInPhase(g, gd) !== 'idle') return 'dug in';
  if (squadDefers(g, gd)) return 'his squad\'s';
  if (!POWEROUT.stayers && squadStaysIn(g, gd)) return 'his squad stays in its rooms';
  if (laneHolds(g, gd) || netQuietHolds(gd)) return 'holds a lane / the last man';
  const rally = D.rallyAt, press = pressOwns(g, D); D.rallyAt = rally;   // (pressOwns is roomfight's hook and may stop his rally clock as it answers: asked here it changes nothing)
  if (press || buddyOwns(g, D)) return 'the press\'s';
  return null;
}
/** where the man at the lever stands (workthings.ts: the panel's own face; the fixed spot with that rule off, as lighting.ts has it) */
function leverSpot(g: Game): Vec3 {
  const E = breakerErrand(g), bp = g.level.breaker.pos;
  return E ? v3.copy(E.goal) : [bp[0] - 0.4, 0, bp[2] - 0.9];
}
/** the way from a man to a spot as the walk grid stands, and its length; null = none that ends there */
function wayTo(g: Game, from: Vec3, to: Vec3): { path: Vec3[]; L: number } | null {
  if (flat(from, to) < 0.5) return { path: [to], L: flat(from, to) };
  const path = g.col.nav.findPath(from, to, 20000); if (!path?.length) return null;
  let L = 0, w0 = from; for (const w of path) { L += flat(w0, w); w0 = w; }
  return flat(w0, to) > 1.0 ? null : { path, L };
}
/** the second man's place: free floor `coverM` short of the lever with a line to it, nearest the way they came; and what he watches from it (that way) */
function coverSpot(g: Game, lever: Vec3, way: Vec3[], from: Vec3): { spot: Vec3; watch: Vec3 } {
  const nav = g.col.nav, cs = nav.cell, [r0, r1] = POWEROUT.coverM;
  // the point of the way about six metres before its end: where anybody following them would come from
  let back = from, left = 6; for (let i = way.length - 1; i > 0 && left > 0; i--) { left -= flat(way[i], way[i - 1]); back = way[i - 1]; }
  let best: Vec3 | null = null, bd = Infinity;
  for (let r = r0; r <= r1 + 1e-6; r += 0.8) for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6, p: Vec3 = [lever[0] + Math.sin(a) * r, 0, lever[2] + Math.cos(a) * r];
    if (nav.isBlocked(p[0], p[2]) || nav.isBlocked(p[0] + cs, p[2]) || nav.isBlocked(p[0] - cs, p[2]) || nav.isBlocked(p[0], p[2] + cs) || nav.isBlocked(p[0], p[2] - cs)) continue;
    if (g.col.segmentBlocked([p[0], 1.2, p[2]], [lever[0], 1.2, lever[2]])) continue;
    const d = flat(p, back); if (d < bd) { bd = d; best = p; }
  }
  return { spot: best ?? v3.copy(lever), watch: v3.copy(back) };
}
export function calmOf(D: Def): Calm {
  const gd = D.gd;
  return { awareness: gd.awareness, hold: gd.hold, pinned: gd.pinned, station: v3.copy(D.station), home: v3.copy(D.home), room: D.room, ev: [...D.ev], watch: D.watch, want: D.want, pt: v3.copy(D.pt) };
}
/** a leg of the walk: pressure.ts's scripted leg at the pace of a man going to look (the tick below ends it itself, before the room fight's plant would) */
function walk(g: Game, D: Def, to: Vec3) { run(g, D, to, null); order(D.gd, { speed: g.tune.guardInvestigate }); }
/** back on the post he left, as he held it — `wary`: the breaker was no fault, he is not calmed down again */
function settle(g: Game, st: State, M: Man, D: Def) {
  calmBack(D, M.calm!, st.word);   // (only a calm man steps off — powerOutKept — so the post he left was a calm one)
}
/** a man back on the post he left, as `calmOf` read it there — `wary`: he is not calmed down again (rescuecheck.ts puts its man back the same way) */
export function calmBack(D: Def, c: Calm, wary: boolean) {
  const gd = D.gd;
  if (gd.script) endGuardScript(gd, wary ? 'suspicious' : 'patrol');
  gd.awareness = wary ? Math.min(0.45, Math.max(c.awareness, 0.35)) : c.awareness; gd.hold = c.hold; gd.pinned = c.pinned;
  D.mode = 'hold'; D.station = c.station; D.home = c.home; D.room = c.room; D.ev = c.ev; D.watch = c.watch; D.want = c.want; D.pt[0] = c.pt[0]; D.pt[1] = c.pt[1]; D.pt[2] = c.pt[2];
  D.glanceUntil = -1; D.fixKeep = -1; D.rallyAt = NaN; D.lastState = gd.state; D.lastSeen = gd.lastSeenT; gd.lastKnown = D.pt;
}
/** a kept post as a checkpoint carries it (its room by id) and back */
export type CalmSnap = Omit<Calm, 'room'> & { room: number };
export const calmSave = (c: Calm): CalmSnap => ({ ...c, station: v3.copy(c.station), home: v3.copy(c.home), ev: [...c.ev], pt: v3.copy(c.pt), room: c.room ? c.room.id : -1 });
export const calmLoad = (g: Game, c: CalmSnap): Calm => ({ ...c, station: v3.copy(c.station), home: v3.copy(c.home), ev: [...c.ev], pt: v3.copy(c.pt), room: g.fight.defs.map(D => D.room).find(R => R?.id === c.room) ?? null });

/** lighting.ts setBlackout, on a trip that found the mains up: the answer's clock starts (a return on its first line with the switch off or no defenders) */
export function powerOut(g: Game) {
  const defs = ruled(g); if (!defs.length) return;
  const prev = STATES.get(g), first = defs.find(D => fit(g, D.gd) && sawThemDie(g, D.gd));
  const out = prev?.men.length ? prev : null;   // (a party of the last blackout still out — the lights back and gone again inside its walk: it is this one's answer too)
  const st: State = { since: g.time, decideAt: Infinity, goAt: out ? out.goAt : -1, wayM: out ? out.wayM : 0, overdueAt: out ? out.overdueAt : -1, fell: out ? out.fell : null, seen: [], lookAt: -1, men: prev?.men ?? [], decided: !!out,
    word: prev?.word ?? false, parties: prev?.parties ?? 0, lost: prev?.lost ?? false, events: prev?.events ?? [] };   // (their word once out stays out: a later dark is the team's doing to them from its first frame)
  STATES.set(g, st);
  if (out) {
    for (const M of st.men) { const D = defOf(g, M.gd); if (M.phase !== 'back' || !D || D.mode !== 'move') continue;
      M.phase = 'out'; M.tries = 0; walk(g, D, M.goal); event(g, st, 'go', M.gd, 'the lights go again on his way home: he turns back for the lever'); }
    return;
  }
  if (first) return noticed(g, st, first.gd, 'the lights die in his view');
  // (the lights are still burning this frame — lighting.ts updateTargets takes them down on the next: what each man's floor reads now is read again in the dark)
  for (const D of defs) { if (!fit(g, D.gd)) continue; const lit = floorWatched(g, D.gd); if (lit >= POWEROUT.litAt) st.seen.push({ i: g.guards.indexOf(D.gd), lit }); }
  if (st.seen.length) st.lookAt = g.time + POWEROUT.darkAfter; else nobody(g, st);
}
function noticed(g: Game, st: State, gd: Guard, how: string) {
  st.seen = []; st.lookAt = -1;
  st.decideAt = st.since + POWEROUT.think[0] + (POWEROUT.think[1] - POWEROUT.think[0]) * idShare(gd);
  event(g, st, 'noticed', gd, `${how}: their word is due ${(st.decideAt - g.time).toFixed(1)} s on`);
}
function nobody(g: Game, st: State) {
  st.seen = []; st.lookAt = -1; st.decided = true;
  event(g, st, 'nobody', null, 'no defender had a burning mains fixture in his view or lost the light on his floor: nobody knows the power is out');
}
/** lighting.ts setBlackout: is the walk to the breaker this rule's to hand out (so the stock errand passes this man over)? */
export function powerOutMan(g: Game, gd: Guard): boolean { return POWEROUT.on && !!gd.unit && ruled(g).some(D => D.gd === gd); }
/** guards.ts poseFlashlight: a man out for the lights burns his own while the mains are down */
export function powerOutLit(g: Game, gd: Guard): boolean {
  if (!POWEROUT.on || !g.blackout.active) return false;
  const M = STATES.get(g)?.men.find(m => m.gd === gd); return !!M && M.phase !== 'wait' && darkFoeCarries(gd);   // (a man the mission dealt no lamp at all has none to burn: darkfoe.ts `carry`)
}
/** darkfoe.ts hasWord: their side holds this dark for the team's doing */
export function powerOutWord(g: Game, gd: Guard): boolean { return POWEROUT.on && g.blackout.active && !!STATES.get(g)?.word && isHostile(gd.team, 'player'); }
/** is he out for the lights (or about to step off)? */
export function powerOutOwns(g: Game, gd: Guard): boolean { return POWEROUT.on && !!STATES.get(g)?.men.some(m => m.gd === gd); }
/** what was said and done, oldest first (the check and the debugger read it; nothing in the game does) */
export function powerOutTimeline(g: Game): PowerOutEvent[] { return STATES.get(g)?.events ?? []; }
export function powerOutReset(g: Game) { STATES.delete(g); }

/** their word: who goes, or why nobody does */
function decide(g: Game, st: State, defs: Def[]) {
  st.decided = true;
  const live = defs.filter(D => alive(D.gd)), speaker = live.find(D => fit(g, D.gd) && sawThemDie(g, D.gd)) ?? live.find(D => fit(g, D.gd));
  if (!speaker) return;
  const stay = (line: string, why: string, word: boolean) => { st.word ||= word; g.say(speaker.gd, line, true); event(g, st, 'stay', speaker.gd, why); };
  if (live.some(D => roused(D.gd) || loudHeard(D.gd) > 0 || D.gd.witness.alertedBy !== null)) return stay("power's out — that's them! Stay on your doors!", 'a man of theirs is roused or has heard the team: nobody walks out to mend a fuse', true);
  if (g.rescue.captor()) return stay("power's out — that's them! Stay on your doors!", 'men holding hostages take the dark for the assault (rescue.ts: every one of them has learned of the team by it)', true);
  if (st.lost) return stay("power's out again — nobody goes. Stay on your doors!", 'the last men sent for the lights did not all come back', true);
  if (st.parties >= POWEROUT.parties) return stay("power's out again — that's no fault. Stay on your doors!", `the lights have gone ${st.parties + 1} times this fight`, true);
  const lever = leverSpot(g), free = live.filter(D => powerOutKept(g, D) === null);
  // the breaker in a defender's own room: its nearest man, alone, without leaving it
  const R = g.fight.roomAt(lever);
  const own = R ? free.filter(D => D.room === R).sort((a, b) => flat(a.gd.char.pos, lever) - flat(b.gd.char.pos, lever))[0] : undefined;
  let go: { D: Def; way: { path: Vec3[]; L: number } }[] = [];
  if (own) { const way = wayTo(g, own.gd.char.pos, lever); if (way) go = [{ D: own, way }]; }
  const ownGoes = go.length > 0;
  if (!go.length) {
    const near = [...free].sort((a, b) => flat(a.gd.char.pos, lever) - flat(b.gd.char.pos, lever)).slice(0, POWEROUT.ask);   // (a path each is the dear part: only the nearest are asked)
    const ways = near.map(D => ({ D, way: wayTo(g, D.gd.char.pos, lever) })).filter((x): x is { D: Def; way: { path: Vec3[]; L: number } } => !!x.way && x.way.L <= POWEROUT.maxM).sort((a, b) => a.way.L - b.way.L);
    const inRoom = new Map<Def['room'], number>(); for (const D of live) if (D.mode === 'hold') inRoom.set(D.room, (inRoom.get(D.room) ?? 0) + 1);
    for (const x of ways) { if (go.length >= POWEROUT.men) break; const n = inRoom.get(x.D.room) ?? 0; if (!x.D.room || n < 2) continue; inRoom.set(x.D.room, n - 1); go.push(x); }   // (a man left in every room that had one)
    if (!go.length && POWEROUT.lone && ways.length) go = [ways[0]];
    if (!go.length) return stay("power's out — nobody to spare. Stay on your doors!", free.length ? `no way to the breaker inside ${POWEROUT.maxM} m for a man who is free` : 'no man of theirs is free to go', false);
  }
  const lead = go[0], second = go[1];
  st.men.push({ gd: lead.D.gd, role: 'lever', phase: 'wait', goal: lever, from: v3.copy(lead.D.station), watch: null, tries: 0, stepT: -100, heard0: 0, thereT: -1, calm: null });
  if (second) { const c = coverSpot(g, lever, lead.way.path, lead.D.gd.char.pos); st.men.push({ gd: second.D.gd, role: 'cover', phase: 'wait', goal: c.spot, from: v3.copy(second.D.station), watch: c.watch, tries: 0, stepT: -100, heard0: 0, thereT: -1, calm: null }); }
  st.parties++; st.goAt = g.time + POWEROUT.beat; st.wayM = lead.way.L;
  g.say(lead.D.gd, second ? "power's out — two moving to the breaker!" : "power's out — on my way to the breaker!", true);
  event(g, st, 'said', lead.D.gd, `${go.map(x => x.D.gd.callsign).join(' and ')} for the breaker, ${lead.way.L.toFixed(0)} m off by the way he walks${ownGoes ? ', in his own room' : second ? '' : ', alone'}; they step off in ${POWEROUT.beat} s`);
}

/** once a frame, before the room fight's own tick (game.ts): their word when it is due, and every man out a step on — a return on its first line with the
 *  switch off or no blackout answered */
export function powerOutTick(g: Game, _dt: number) {
  const st = STATES.get(g); if (!st) return;
  const defs = ruled(g); if (!defs.length) { if (st.men.length) standDown(g, st); return; }   // (the switch thrown off, or a show taking the floor, in the middle of a walk)
  const bo = g.blackout;
  if (!st.decided && st.lookAt >= 0 && g.time >= st.lookAt) {
    const hit = bo.active && bo.since === st.since ? st.seen.find(s => { const gd = g.guards[s.i]; return !!gd && fit(g, gd) && floorWatched(g, gd) < s.lit * POWEROUT.dropK; }) : undefined;
    if (hit) noticed(g, st, g.guards[hit.i], 'the floor he is watching goes dark'); else nobody(g, st);
  }
  if (!st.decided && bo.active && bo.since === st.since && g.time >= st.decideAt) decide(g, st, defs);
  const fight = defs.some(D => alive(D.gd) && roused(D.gd));
  if (!st.men.length) { missed(g, st, defs, fight); return; }
  if (st.men.some(m => m.phase === 'wait') && g.time >= st.goAt) stepOff(g, st, fight);
  const lever = st.men.find(m => m.role === 'lever');
  st.men = st.men.filter(M => {
    const gd = M.gd, D = defOf(g, gd);
    if (!alive(gd)) { st.lost = true; if (M.phase !== 'wait') st.fell = v3.copy(gd.char.pos); event(g, st, 'lost', gd, 'down while he was out for the lights: nobody is sent again this fight'); return false; }
    if (!D || gd.held) {   // (in Sam's arm, or no defender of the fight's any more: whoever has him has him)
      st.lost = true; if (gd.script && M.phase !== 'wait') endGuardScript(gd, gd.state === 'suspicious' || gd.state === 'alert' || gd.state === 'search' ? gd.state : 'patrol');
      event(g, st, 'lost', gd, gd.held ? 'taken while he was out for the lights: nobody is sent again this fight' : 'no man of the fight\'s any more'); return false; }
    if (M.phase === 'wait') return true;
    M.stepT = boots(g, gd, M.stepT);
    const atLever = M.role === 'lever' && M.phase === 'there';
    if (D.mode !== 'move') { event(g, st, 'abort', gd, 'the room fight has him where he stands'); return false; }   // (met on the way: tickMove planted him, roused — its man)
    if (st.fell && ((M.phase === 'there' && !lever) || (flat(gd.char.pos, st.fell) <= POWEROUT.seeM && !g.col.segmentBlocked([gd.char.pos[0], 1.5, gd.char.pos[2]], [st.fell[0], 0.4, st.fell[2]])))) {   // his mate on the floor in his plain view — or he is set short of the lever, a line to it, and no mate at it
      st.fell = null; st.word = true; g.say(gd, "he's down at the breaker — that's them! Stay on your doors!", true);
      run(g, D, M.from, null); event(g, st, 'abort', gd, 'sees the man he came with on the floor: says so, and back to his post at a run'); return false;
    }
    if ((fight || roused(gd) || loudHeard(gd) > M.heard0) && !(atLever && bo.active && !bo.permanent)) {
      run(g, D, M.from, null); event(g, st, 'abort', gd, `${roused(gd) ? 'he is roused' : loudHeard(gd) > M.heard0 ? 'a shot, a boot or a charge in his ears' : `a fight (${defs.find(X => alive(X.gd) && roused(X.gd))?.gd.callsign} is roused)`}: back to his post at a run`); return false;   // (the leg ends in the room fight's plant: its man from here)
    }
    if (M.phase !== 'back' && !bo.active) {   // the mains are back — his mate's hand, the trip's own clock, anybody's
      M.phase = 'back'; M.tries = 0; walk(g, D, M.from);
      if (M.role === 'lever' || !lever) event(g, st, 'restored', gd, `the mains are back ${(g.time - st.since).toFixed(1)} s after they went: back to their posts`);
      return true;
    }
    const goal = M.phase === 'back' ? M.from : M.goal, d = flat(gd.char.pos, goal);
    const reached = !!gd.script?.arrived || d < 0.5 || (M.phase !== 'back' && M.role === 'lever' && breakerResetNear(g, gd));
    if (M.phase === 'there') {
      // he stands where he was sent (still his leg: the room fight plants a man who has arrived, or stood a second and a half)
      if (gd.script) gd.script.arrived = false; D.stallT = 0; D.moveT = 0;
      if (M.role === 'lever') {
        if (bo.active && !bo.permanent && g.time - M.thereT > POWEROUT.leverSecs) {   // (a lever that will not take his hand — something solid between them: he does not stand at it for ever)
          event(g, st, 'abort', gd, `${POWEROUT.leverSecs} s at a lever he cannot get a hand to: back to their posts`);
          for (const X of st.men) { const XD = defOf(g, X.gd); if (XD && XD.mode === 'move' && X.phase !== 'wait') { X.phase = 'back'; X.tries = 0; walk(g, XD, X.from); } }
          return true;
        }
        const bp = g.level.breaker.pos; order(gd, { face: Math.atan2(bp[0] - gd.char.pos[0], bp[2] - gd.char.pos[2]), aimAt: null, upper: 'none' });
        if (bo.permanent && g.time - M.thereT > POWEROUT.lookSecs) {
          st.word = true; g.say(gd, "breaker's wrecked — that's them! Stay on your doors!", true); event(g, st, 'wrecked', gd, 'the breaker is shot to scrap: no fault, and nothing to mend');
          for (const X of st.men) { const XD = defOf(g, X.gd); if (XD && XD.mode === 'move' && X.phase !== 'wait') { X.phase = 'back'; X.tries = 0; walk(g, XD, X.from); } }
        }
      } else if (M.watch) order(gd, { aimAt: [M.watch[0], 1.2, M.watch[2]], upper: 'aim' });
      if (M.role === 'cover' && (!lever || lever.phase === 'back')) { M.phase = 'back'; M.tries = 0; walk(g, D, M.from); }
      return true;
    }
    if (!reached) {
      if (D.stallT <= 1.3 && D.moveT <= 8) return true;   // on his way
      if (M.tries < POWEROUT.tries) { M.tries++; walk(g, D, goal); return true; }   // (the room fight ends a leg at ten seconds, or a second and a half of going nowhere: a longer way is walked in legs, a shut way tried again)
      if (M.phase === 'back') { event(g, st, 'abort', gd, 'no way back to his post: the room fight plants him where he is'); return false; }
      M.phase = 'back'; M.tries = 0; walk(g, D, M.from); event(g, st, 'abort', gd, 'no way to the breaker: back to his post'); return true;
    }
    if (M.phase === 'back') { settle(g, st, M, D); event(g, st, 'home', gd, `back on his post ${(g.time - st.since).toFixed(1)} s after the lights went`); return false; }
    M.phase = 'there'; M.thereT = g.time; if (gd.script) gd.script.arrived = false; D.stallT = 0; D.moveT = 0;
    event(g, st, 'there', gd, M.role === 'lever' ? `at the lever ${(g.time - st.since).toFixed(1)} s after the lights went` : 'set short of the lever, watching the way they came');
    return true;
  });
}
/** the beat is up: the party steps off as one. The mains back or a fight started: nobody goes. The first man no longer free (dazzled, taken, another rule's):
 *  the second goes for the lever in his place; neither free: nobody goes. A walk nobody started is not counted against the next blackout. */
function stepOff(g: Game, st: State, fight: boolean) {
  const wait = st.men.filter(m => m.phase === 'wait'), bo = g.blackout;
  const all = !bo.active ? 'the mains are back' : fight ? 'a fight has started' : null;
  const why = new Map(wait.map(M => { const D = defOf(g, M.gd); return [M, all ?? (!D ? 'no man of the fight\'s any more' : powerOutKept(g, D))] as const; }));
  const goes = wait.filter(M => why.get(M) === null);
  for (const M of wait) if (why.get(M) !== null) event(g, st, 'abort', M.gd, `does not step off: ${why.get(M)}`);
  st.men = st.men.filter(M => M.phase !== 'wait' || goes.includes(M));
  if (!goes.length) { if (!st.men.length) st.parties = Math.max(0, st.parties - 1); return; }
  if (!st.men.some(m => m.role === 'lever')) { const M = goes[0]; M.role = 'lever'; M.goal = leverSpot(g); M.watch = null; }
  for (const M of goes) { const D = defOf(g, M.gd)!, gd = M.gd;
    M.calm = calmOf(D); M.heard0 = loudHeard(gd); M.phase = 'out'; walk(g, D, M.goal);
    event(g, st, 'go', gd, `${M.role === 'lever' ? 'walks to the lever' : 'goes with him to cover it'}, ${flat(gd.char.pos, M.goal).toFixed(0)} m off, ${(g.time - st.since).toFixed(1)} s after the lights went`); }
  st.overdueAt = g.time + st.wayM / Math.max(0.5, g.tune.guardInvestigate) + POWEROUT.overdue;
}
/** nobody is out any more. A party that lost a man and sent no word: once it is `overdue` their side says so and holds the dark for the team's doing — what they
 *  did NOT hear is what they act on, not a fall nobody saw. (A man of theirs already roused knows: no line.) */
function missed(g: Game, st: State, defs: Def[], fight: boolean) {
  if (st.overdueAt < 0) return;
  if (!st.lost || st.word || !g.blackout.active) { st.overdueAt = -1; return; }
  if (g.time < st.overdueAt) return;
  st.overdueAt = -1; st.word = true;
  const speaker = defs.find(D => fit(g, D.gd)); if (!speaker || fight) return;
  g.say(speaker.gd, "nothing from the breaker — that's them! Stay on your doors!", true); event(g, st, 'overdue', speaker.gd, 'the men sent for the lights have not been heard from and the mains are still down');
}
/** the rule let go of in the middle of a walk: every man out goes back to his post at a run, and is the room fight's from there */
function standDown(g: Game, st: State) {
  for (const M of st.men) { const D = defOf(g, M.gd); if (D && D.mode === 'move' && M.phase !== 'wait' && alive(M.gd) && !M.gd.held) run(g, D, M.from, null); }
  st.men = []; st.overdueAt = -1; st.fell = null;
}

// ---------------------------------------------------------------- the state's pair (new module state the game depends on rides a snapshot)
export type PowerOutSnap = { since: number; decideAt: number; goAt: number; wayM: number; overdueAt: number; fell: Vec3 | null; seen: { i: number; lit: number }[]; lookAt: number; decided: boolean; word: boolean; parties: number; lost: boolean;
  men: { i: number; role: Man['role']; phase: Phase; goal: Vec3; from: Vec3; watch: Vec3 | null; tries: number; stepT: number; heard0: number; thereT: number; calm: CalmSnap | null }[] };
export function powerOutSnapshot(g: Game): PowerOutSnap | undefined {
  const st = STATES.get(g); if (!POWEROUT.on || !st) return undefined;
  return { since: st.since, decideAt: st.decideAt, goAt: st.goAt, wayM: st.wayM, overdueAt: st.overdueAt, fell: st.fell ? v3.copy(st.fell) : null, seen: st.seen.map(x => ({ ...x })), lookAt: st.lookAt, decided: st.decided, word: st.word, parties: st.parties, lost: st.lost,   // (the timeline is the check's and the debugger's: not kept)
    men: st.men.map(M => ({ i: g.guards.indexOf(M.gd), role: M.role, phase: M.phase, goal: v3.copy(M.goal), from: v3.copy(M.from), watch: M.watch ? v3.copy(M.watch) : null, tries: M.tries, stepT: M.stepT, heard0: M.heard0, thereT: M.thereT,
      calm: M.calm ? calmSave(M.calm) : null })) };
}
export function powerOutRestore(g: Game, s: PowerOutSnap | null | undefined) {
  if (!s) { STATES.delete(g); return; }
  const men: Man[] = [];
  for (const m of s.men) { const gd = g.guards[m.i]; if (!gd) continue;
    men.push({ gd, role: m.role, phase: m.phase, goal: v3.copy(m.goal), from: v3.copy(m.from), watch: m.watch ? v3.copy(m.watch) : null, tries: m.tries, stepT: m.stepT, heard0: m.heard0, thereT: m.thereT,
      calm: m.calm ? calmLoad(g, m.calm) : null }); }
  STATES.set(g, { since: s.since, decideAt: s.decideAt ?? Infinity, goAt: s.goAt, wayM: s.wayM, overdueAt: s.overdueAt, fell: s.fell ? v3.copy(s.fell) : null, seen: s.seen.map(x => ({ ...x })), lookAt: s.lookAt, men, decided: s.decided, word: s.word, parties: s.parties, lost: s.lost, events: [] });   // (decideAt: Infinity is null in a file)
}
