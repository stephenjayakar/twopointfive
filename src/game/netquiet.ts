// THE NET GOES QUIET — a slice of the enemy's morale (morale.ts; the maintainer, 10-13: "especially for stealth sections that aren't perfect ghost where
// enemies just don't [know] what's going on, more poorly trained ones could get really scared" · "a lot of the value from this comes with good telegraphing" ·
// "we don't want them to feel dumb" · "we should never make it adding HP etc." · "we should generally show, not tell". Approved as: "Dread from unanswered
// radio checks and bodies found. Heard in the calls getting worse, seen in beams whipping to noises. Done-test: the last man never dies standing upright
// without firing.")
//
// It needs MORALE on to do anything: every feed here is morale.ts's `moraleShock` (its cap, its nerve), and every behaviour keys off that file's rungs.
//   · FEEDS (shock, × `steadyK` for a steady man — trainingOf, nothing of this file's):
//       (enemysquads.ts's two reach this file through netquietfeed.ts, a leaf: that file sits too early in the import cycle to import this one)
//       a mate who does not answer a radio check — `unanswered` to the man who asked, `heardIt` to every man who heard the check on the net (the squad's
//         check: enemysquads.ts radioCheck · the night staff's roll call: guards.ts updateRollcall · the last defenders' own check: laststand.ts tickCheck — a
//         man too busy to answer is a man who did not answer, and so is a dead one);
//       a body found — `body` to the finder, `bodyTold` to the men he tells (enemysquads.ts event 'found' · guards.ts, the staff's body in view);
//       a mate seen to fall — `fallUnseen` with no enemy in the watcher's view, `fallSeen` with one (combat.ts killGuard, beside moraleManDown: a green man who
//         has just taken that file's leaderShock for the same fall takes only what this one adds over it).
//       ONE DEAD MAN IS ONE SHOCK to one man: the fall he saw, the check nobody answered and the body found pay the largest of the three, not their sum.
//   · THE CALLS GET WORSE, said by the man who asked, on the net, `askBeat` after his check's own line: the first silence a flat repeat of the name (the
//     name the squad's own ask uses); with two checks unanswered "why's nobody answering?"; "somebody talk to me!" only with nobody of his side left on the
//     WHOLE net — every squad's men, not the one he asked on. The finder of a body nobody heard go: "he's down. nobody heard a thing?". The tell first, then
//     the act.
//   · BEAMS WHIP TO NOISES: a jumpy or broken man who HEARS an enemy's noise (his own ears counted it: hearingCheck's gates, nothing of this file's) swings
//     to it `whipShift` after — not after the room fight's own 0.4‥0.9 s —, at `whipTurn` rad/s (broken: `whipTurnBroken`), body and all, and at where HIS
//     EARS put it: the source through open air, the doorway it came round otherwise (the source itself only when it is near that place and in plain view).
//     His fix is never truer than his hearing. `whipSecs` on it (one target `whipHold` at the least; a second noise does not send his eyes back to the door
//     and out again), then the man he was. His lamp follows his aim (guards.ts). A man holding a room has it as what he watches meanwhile (roomfight.ts
//     applyWatch → netQuietLook), so whoever then shows somewhere else catches him turned away: the beat the player can use. Nothing here is asked while he
//     has a man in his eyes.
//   · THE LAST MAN — as far as HE knows it: every man of his squad down and each of them known to him (asked for and silent, seen to fall, found, told of on
//     the net), nobody of his side at his elbow; or nobody of his side left at all AND a check gone unanswered in his hearing (if nobody has asked, he asks
//     the net himself once he has been roused `calmSecs`: "all posts, answer up" — and it is the silence that has him act). At his post, he says his line —
//     his squad's ("nobody left in here but me") or, with nobody on the net, the last one —, and `lastBeat` later stops guarding his room upright: he backs,
//     facing them, to the spot in it where every entry sits inside one `arcDeg` arc (else the narrowest arc there is), goes LOW (half down: `crouch`), on his
//     gun (roused, as any defender who has taken a new post is: roomfight.ts plant), and holds the doors in his EYES — the floor's eye sits round from a
//     man's gun, so his gun rests off the arc's middle by what that takes; no wandering glance. He does not rally to a fight next door meanwhile
//     (roomfight.ts rally → netQuietHolds), nor is he his squad's to send (enemysquads.ts home → netquietfeed.ts). `alertSecs` of nothing seen or heard and
//     he is no longer 'alert' — wary (`wary`), still low on the spot; anything he hears has him on his gun again. A living mate at his side for `calmSecs`
//     and he is up, the act dropped, his owner's again. A man morale.ts's own sequence has (`moraleOwns`) is that file's.
//   · A MAN WHO HAS RUN (runner.ts `runnerOwns`: the shout, the drop, the run, gone) is nobody's mate on the net: he hears no check, answers none (asked for by name
//     he is a silence like a dead man's), is not whipped, is never the last man — and to the man he left he is one more gone, once that man knows it. The last
//     man at his act is not stopped at a dark doorway nor called to one (darkdoor.ts asks netquietfeed.ts): his hold wins.
//   No health, aim, skill or reaction table is read or written: where he stands, how low, where he looks — and, low on his spot, the floor's own alert /
//   wary lines (rouse, ease, wary: the only writes to a man's state in this file).
// SHOW, NOT TELL: nothing is drawn or written for the player but the men themselves. One die (simRandom, only for which line of a pool), no wall clock, no
// graphics setting. The switch is off in the module and on the frozen stand: every seam returns on its first line, no man is met, no die is drawn.
// Type-only game imports but for the functions below, used inside calls only (src/game is one import cycle).
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import { Vec3, v3, clamp, wrapAngle, approachAngle, DEG } from '../math/vec';
import { simRandom } from '../math/dice';
import { MORALE, moraleShock, moraleOwns, rungOf, trainingOf, sawLeaderFall } from './morale';
import { squadOf, mate as nameOf } from './enemysquads';
import { canSee, canSeeChar } from './guards';
import { isHostile, teamOfId } from './teams';
import { order } from './squad';
import { NETFEED, netFeedTake, netFeedHold } from './netquietfeed';
import { runnerOwns } from './runner';   // (asked inside calls only: false with its switch off)

type Def = RoomFight['defs'][number];
type Room = NonNullable<Def['room']>;

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?nonetquiet) and by the shipped stand; the harness's frozen
 *  stand leaves it off (TPS_NETQUIET=1 turns it on — with TPS_MORALE=1, without which it does nothing). The shocks are morale.ts dread, 0‥1, before its nerve
 *  and cap: `unanswered` / `heardIt` a mate who does not answer (the asker / a man who heard the check), `body` / `bodyTold` a body found (the finder / the men
 *  told), `fallSeen` / `fallUnseen` a mate seen to fall with / without an enemy in view, all × `steadyK` for a steady man — and ONE dead man is one shock to
 *  one man: the largest of the three, not their sum. Seconds: `askBeat` / `bodyBeat` from the event to the line, `barkSecs` the least between two of one man's
 *  lines from this file (`sayHold` how long a line owed waits for that, or for a man to be out of his eyes, before it is dropped), `shooterSecs` how fresh a sighting makes the shooter 'in view', `whipShift` / `whipSecs` the whip's start and length, `whipHold` the
 *  least a whip stays on one noise, `lastBeat` from the last man's line to his first step, `calmSecs` with nobody in his eyes before he starts (and roused
 *  before he asks the net himself), `alertSecs` with nothing seen or heard before a last man low on his spot stops being 'alert' (he keeps the spot and the
 *  crouch), `giveUp` how long he waits for the room fight to hand him back before the act is dropped. `whipTurn` / `whipTurnBroken` rad/s; metres: `whipM`
 *  the furthest noise he whips to, `whipNearM` how near the place his EARS put a noise its true source must be (with a clear line to it) for him to look at the
 *  source itself, `bodyM` how far he knows a man lying in his view, `mateM` a living mate this near and he is not alone; `arcDeg` the arc every entry should
 *  sit in; `eyeDeg` the half-cone of a man's eyes (the floor's own number — guards.ts GUARD_EYE.halfDeg; the check holds
 *  the two equal) and `eyeSlack` the margin inside it he keeps his doors; `crouch` how far down he goes, 0‥1 — HALF: measured on
 *  the floor's eye, a man fully down on his gun (1) looks 48° round from his aim through a cone 26° either way in plan, so past the near field he loses the
 *  very man he aims at; at 0.5 it is 42° and 47°, at 0.4 41° and 49°: what he aims at stays in his eyes, with a margin;
 *  `wary` the awareness he does not fall under, low on his spot, once he is no longer alert (the floor's 'suspicious' line is 0.3; 0 = he calms right down, as
 *  a man his squad has calmed does); `backSpeed` m/s; `maxM` the furthest he walks for the spot; `doorM` the nearest he sits to a door; `eyeM` his eye that far down; `stayM` how much
 *  better than where he stands a spot must score to be walked to. UNTUNED by eye (nobody has seen it on a GPU, nobody has played it). */
export const NETQUIET = { on: false, unanswered: 0.12, heardIt: 0.06, body: 0.2, bodyTold: 0.08, fallSeen: 0.08, fallUnseen: 0.22, steadyK: 0.6,
  askBeat: 1.4, bodyBeat: 2, barkSecs: 3, sayHold: 4, shooterSecs: 1, bodyM: 10,
  whipShift: 0.12, whipSecs: 1.5, whipHold: 0.8, whipTurn: 10, whipTurnBroken: 14, whipM: 15, whipNearM: 4,
  lastBeat: 1.5, calmSecs: 2, alertSecs: 15, giveUp: 8, mateM: 5, arcDeg: 40, eyeDeg: 58, eyeSlack: 4, crouch: 0.4, wary: 0.35, backSpeed: 2, maxM: 9, doorM: 2, eyeM: 1.3, stayM: 1 };
export const NETQUIET_STATS = { asks: 0, quiet: 0, bodies: 0, falls: 0, unseen: 0, lines: 0, whips: 0, last: 0, backs: 0, low: 0, selfAsks: 0, released: 0, eased: 0,
  squadAsks: 0, squadBodies: 0, standChecks: 0, staffAsks: 0, staffBodies: 0 };   // (…and by seam: enemysquads.ts's two, laststand.ts's, guards.ts's two)
/** every line this file has had a man say (the newest 64): who, when, which kind — what the check reads */
export const NETQUIET_LOG: { id: number; t: number; kind: LineKind; text: string; radio: boolean }[] = [];
/** the check's breakage (tools/qa/netquiet-check.ts, NETQUIET_BREAK=1): every feed returns on its first line (nobody asked for, no body, no fall — so no
 *  shock, no line, no man who knows he is alone), the last man's spot is never looked for and the room fight's watch seam (netQuietLook) hands back nothing —
 *  never set by the game */
export const NETQUIET_QA = { broken: false };

/** THE LINES (placeholders in the defenders' register — the writing pass is the maintainer's). name: the first silence, the man's name again, flat. why: the
 *  second. last: nobody left on the whole net to hear him. body: the finder, of a man nobody heard go. alone: the last of his squad, every mate of it gone
 *  quiet, other squads still on the net. ask: a roused man nobody has asked anything calls the net himself. `{name}` = the man asked for, as the squad's own
 *  ask names him (enemysquads.ts mate). */
type LineKind = 'name' | 'why' | 'last' | 'body' | 'alone' | 'ask';
const KINDS: LineKind[] = ['name', 'why', 'last', 'body', 'alone', 'ask'];
const LINES: Record<LineKind, string[]> = {
  name: ['{name}. … {name}.', '{name}? … {name}.', '{name}. {name}, answer up.'],
  why: ['why\'s nobody answering?', 'where is everybody? answer me.', 'that\'s another of you quiet. come on.'],
  last: ['somebody talk to me!', 'anybody. anybody at all, talk to me!', 'is anyone left on this net?'],
  body: ['he\'s down. nobody heard a thing?', 'man down here. not a sound out of him.', 'he\'s down, and nobody heard it?'],
  alone: ['that\'s my whole squad quiet. it\'s just me in here.', 'nobody left in here but me.', 'it\'s gone quiet in here. i\'m on my own.'],
  ask: ['all posts, answer up.', 'anyone on this net, come in.', 'who\'s still up? sound off.'],
};
/** this file's lines — every kind's, or one kind's (the check: a line said came from the right pool; bubble length and the originality blocklist) */
export function netQuietLines(kind?: LineKind): string[] { return (kind ? [LINES[kind]] : Object.values(LINES)).flat(); }

/** the last man's act: nothing · his line is out and the beat runs · backing to the spot · low on it · said, and no room of his to work (nothing more) */
const NONE = 0, SAID = 1, BACK = 2, LOW = 3, DONE = 4;
/** per man. `quiet` = checks nobody answered him (`asked`: the men they were for — a man counts once); `known` = the mates he knows are gone without asking:
 *  seen to fall, found, or told of on the net; `paid` = the largest shock of this file's he has taken for each dead man (one death, one shock). The line owed
 *  (`say`: its kind's index, −1 none; seconds to it; the name in it); seconds since his last line and its kind; `bodyT` since he last found a body; `roused`
 *  seconds he has been off his calm. The whip: when his ears last counted something (`heardT`, Witness.lastT) and how much (`cs` small noises, `cl` loud
 *  ones), where he last had his fix (`fx`,`fz`: a man who holds no room), the noise (`whipAt`), seconds to the swing, left of it and on this target. The last
 *  man: the act and its seconds, how long a living mate has been with him again (`mateT`), how much he knows and since when (`news`, `newsT`), how far round from his gun his EYES sit, low on his gun (`eye`, rad) and how wide they are in plan (`eyeHalf`, rad), the spot, the arc's middle (`yaw`) and width, what he watches from it (`look`) and whether he is down on it this frame (`low`). */
interface Mind { quiet: number; asked: Set<number>; known: Set<number>; paid: Map<number, number>; say: number; sayT: number; sayName: string; bark: number; lastKind: number; bodyT: number; roused: number;
  heardT: number; cs: number; cl: number; fx: number; fz: number; whipAt: Vec3 | null; whipIn: number; whipT: number; whipHeld: number;
  last: number; t: number; mateT: number; news: number; newsT: number; eye: number; eyeHalf: number; spot: Vec3 | null; yaw: number; arc: number; look: Vec3 | null; low: boolean; }
const stateOf = new WeakMap<Guard, Mind>();

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const live = () => NETQUIET.on && MORALE.on;
/** …and the feeds reach somebody (the check's breakage cuts them) */
const fed = () => live() && !NETQUIET_QA.broken;
const loudOf = (gd: Guard) => { const H = gd.witness.heard; return H.shots + H.kick + H.bang; };
/** a man this file is about at all (morale.ts's own men): a living defender or a man of the night staff, not one of the hostage rescue's cast */
const side = (g: Game, gd: Guard) => !gd.civ && (gd.team === 'hostile' || gd.team === 'guard') && !(g.rescue?.active && g.rescue.hostiles.includes(gd));
const ours = (g: Game, gd: Guard) => gd.state !== 'dead' && side(g, gd);
/** …on the net: alive, not in Sam's arm — and not a man runner.ts has (he has said he is done, dropped it, run: he hears no check and answers none) */
const onNet = (g: Game, gd: Guard) => ours(g, gd) && !gd.held && !runnerOwns(gd);
/** GONE to his mates, whether or not they know it yet: down, taken, run (runner.ts), or off the floor altogether (a man who ran and left it) */
const lostTo = (g: Game, m: Guard) => m.state === 'dead' || !!m.held || runnerOwns(m) || !g.guards.includes(m);
function mind(gd: Guard): Mind {
  let N = stateOf.get(gd);
  if (!N) stateOf.set(gd, N = { quiet: 0, asked: new Set(), known: new Set(), paid: new Map(), say: -1, sayT: 0, sayName: '', bark: NETQUIET.barkSecs, lastKind: -1, bodyT: 60, roused: 0,
    heardT: gd.witness.heard.lastT, cs: gd.witness.heard.small, cl: loudOf(gd), fx: NaN, fz: NaN, whipAt: null, whipIn: 0, whipT: 0, whipHeld: 0,
    last: NONE, t: 0, mateT: 0, news: 0, newsT: 60, eye: 0, eyeHalf: NETQUIET.eyeDeg * DEG, spot: null, yaw: 0, arc: 0, look: null, low: false });
  return N;
}
/** a shock of this file's on one man: a steady man takes `steadyK` of it (morale.ts scales it by the nerve and caps it) */
function shock(g: Game, gd: Guard, amount: number) { if (amount > 0) moraleShock(g, gd, amount * (trainingOf(g, gd) === 'steady' ? NETQUIET.steadyK : 1)); }
/** …for one dead (or silent) man: what this one adds over the most he has already taken for that same man — the fall he saw, the check nobody answered and
 *  the body found are one death, counted once, at the largest of the three */
function pay(g: Game, gd: Guard, N: Mind, id: number, amount: number) { const had = N.paid.get(id) ?? 0; if (amount > had) { N.paid.set(id, amount); shock(g, gd, amount - had); } }
/** a line owed `after` seconds from now (a later one replaces an earlier one not yet said: the worse call is the one he makes) */
function owe(N: Mind, kind: LineKind, name: string, after: number) { N.say = KINDS.indexOf(kind); N.sayT = after; N.sayName = name; }
function speak(g: Game, gd: Guard, N: Mind, kind: LineKind, name: string, radio: boolean) {
  const pool = LINES[kind], text = pool[Math.floor(simRandom() * pool.length) % pool.length].replace(/\{name\}/g, name);
  g.say(gd, text, radio); N.bark = 0; N.lastKind = KINDS.indexOf(kind);
  NETQUIET_STATS.lines++; NETQUIET_LOG.push({ id: gd.char.id, t: g.time, kind, text, radio }); if (NETQUIET_LOG.length > 64) NETQUIET_LOG.shift();
}
/** is anybody of his side up on the net to hear him — the WHOLE net, every squad's men, not the one he asked on (the men in `but` aside) */
const netUp = (g: Game, gd: Guard, but: readonly Guard[] = []) => g.guards.some(o => o !== gd && o.team === gd.team && onNet(g, o) && !but.includes(o));

// ---------------------------------------------------------------- the feeds (seams in other files: each returns on its first line with the switch off)
/** the men of `silent` who do not answer `asker` (new to him, or to a man who heard the check), and the line he owes for it: the name again; with two checks
 *  unanswered, why is nobody answering; with nobody at all left on the net, somebody talk to me */
function quietFor(g: Game, asker: Guard, silent: Guard[], hearers: Guard[]) {
  const K = NETQUIET, N = mind(asker); let fresh: Guard | null = null;
  for (const m of silent) {
    const id = m.char.id;
    if (!N.asked.has(id)) { N.asked.add(id); N.quiet++; NETQUIET_STATS.quiet++; pay(g, asker, N, id, K.unanswered); fresh = m; }
    for (const h of hearers) { const Nh = mind(h); if (Nh.asked.has(id)) continue; Nh.asked.add(id); Nh.quiet++; pay(g, h, Nh, id, K.heardIt); }
  }
  NETQUIET_STATS.asks++;
  const rung = hearers.reduce((q, h) => Math.max(q, mind(h).quiet), N.quiet);   // (the net's count: an asker who was off it for the first silence has still heard of it from the men who were on)
  if (fresh) owe(N, !netUp(g, asker, silent) ? 'last' : rung >= 2 ? 'why' : 'name', nameOf(fresh), K.askBeat);
}
/** A RADIO CHECK'S SILENCE (enemysquads.ts radioCheck, guards.ts updateRollcall — as the asker asks for `who` by name): `men` = the net he asked on */
export function netQuietAsked(g: Game, asker: Guard | null, who: Guard, men: readonly Guard[]) {
  if (!fed() || !asker || !onNet(g, asker) || asker === who) return;
  if (asker.team === 'guard') NETQUIET_STATS.staffAsks++;
  quietFor(g, asker, [who], men.filter(m => m !== asker && m !== who && m.team === asker.team && onNet(g, m)));
}
/** THE LAST DEFENDERS' CHECK CLOSES (laststand.ts tickCheck): `silent` did not answer `asker` — the dead among them too: it is the dead who do not answer —,
 *  `heard` did */
export function netQuietClosed(g: Game, asker: Guard, silent: Guard[], heard: Guard[]) {
  if (!fed() || !onNet(g, asker)) return;
  const quiet = silent.filter(m => m !== asker && m.team === asker.team && side(g, m)); if (!quiet.length) return;
  NETQUIET_STATS.standChecks++;
  quietFor(g, asker, quiet, heard.filter(m => m !== asker && onNet(g, m)));
}
/** the man he has found: of `men`'s dead of his side, the nearest he has a line to inside `bodyM` and does not yet know of — else the nearest he does not know
 *  of at all (a mate found by ear: the squad's word for a shot heard). Whose death the shock is counted against, and a man he now knows is gone. */
function bodyOf(g: Game, finder: Guard, N: Mind, men: readonly Guard[]): Guard | null {
  const eye: Vec3 = [finder.char.pos[0], 1.5, finder.char.pos[2]]; let best: Guard | null = null, bs = Infinity;
  for (const m of men) {
    if (m === finder || m.state !== 'dead' || m.team !== finder.team || !side(g, m)) continue;
    const b = m.char.bones.hips ?? m.char.pos, d = flat(b, finder.char.pos), inView = d < NETQUIET.bodyM && !g.col.segmentBlocked(eye, [b[0], 0.3, b[2]]);
    const s = d + (inView ? 0 : 100) + (N.known.has(m.char.id) ? 1000 : 0); if (s < bs) { bs = s; best = m; }
  }
  return best;
}
/** A BODY FOUND (enemysquads.ts event 'found', guards.ts the staff's body in view): the finder, and the men of `men` he tells */
export function netQuietBody(g: Game, finder: Guard | null, men: readonly Guard[]) {
  if (!fed() || !finder || !ours(g, finder) || runnerOwns(finder)) return;
  const K = NETQUIET, N = mind(finder), body = bodyOf(g, finder, N, men), id = body ? body.char.id : -1, again = N.bodyT < 5;   // (two men lying together are one find: one shock, one line — and two men he knows are gone)
  const told = men.filter(m => m !== finder && m.team === finder.team && onNet(g, m));
  if (again) { if (body) for (const m of [finder, ...told]) { const Nm = mind(m); Nm.known.add(id); Nm.paid.set(id, Math.max(Nm.paid.get(id) ?? 0, m === finder ? K.body : K.bodyTold)); } return; }
  N.bodyT = 0; NETQUIET_STATS.bodies++; if (finder.team === 'guard') NETQUIET_STATS.staffBodies++;
  if (body) { N.known.add(id); pay(g, finder, N, id, K.body); } else shock(g, finder, K.body);
  for (const m of told) { const Nm = mind(m); if (body) { Nm.known.add(id); pay(g, m, Nm, id, K.bodyTold); } else shock(g, m, K.bodyTold); }
  const shotT = finder.witness.heard.lastShotT;
  if (!(shotT >= 0 && g.time - shotT < 3) && g.time - finder.lastSeenT > K.calmSecs) owe(N, 'body', '', K.bodyBeat);   // (a man who heard the shot does not ask who heard a thing)
}
/** has he an enemy in his eyes right now, or had one inside `shooterSecs` — whichever enemy: Sam, a teammate of his, any hostile unit */
function foeInView(g: Game, gd: Guard): boolean {
  if (g.time - gd.lastSeenT < NETQUIET.shooterSecs) return true;
  if (isHostile(gd.team, 'player') && !g.player.down && !g.playerInvisible && canSee(g, gd).visible) return true;
  for (const o of g.guards) if (o !== gd && o.state !== 'dead' && isHostile(gd.team, o.team) && canSeeChar(g, gd, o.char, false).visible) return true;
  return false;
}
/** A MAN GOES DOWN (combat.ts killGuard, beside moraleManDown, the victim not yet 'dead'): every mate with the fall in his eyes takes `fallUnseen` — or
 *  `fallSeen`, with the enemy who did it (any enemy) in view — and knows that man is gone without asking for him. A green man who took morale.ts's
 *  leaderShock for this same fall takes only the rest (and nothing more for that man later unless it is larger than that). */
export function netQuietFall(g: Game, victim: Guard) {
  if (!fed() || !ours(g, victim)) return;
  const K = NETQUIET, id = victim.char.id;
  for (const o of g.guards) {
    if (o === victim || !onNet(g, o) || o.team !== victim.team || g.time < o.dazzledUntil) continue;
    if (!canSeeChar(g, o, victim.char, false).visible) continue;
    const N = mind(o), seen = foeInView(g, o); N.known.add(id);
    if (sawLeaderFall(o) === 0) N.paid.set(id, Math.max(N.paid.get(id) ?? 0, MORALE.leaderShock));
    pay(g, o, N, id, seen ? K.fallSeen : K.fallUnseen); NETQUIET_STATS.falls++; if (!seen) NETQUIET_STATS.unseen++;
  }
}

// ---------------------------------------------------------------- the whip
/** WHERE HE WHIPS TO, for what his ears have just counted (`small` / `loud`: which of their counts went up): the place HIS EARS put it — hearingCheck's
 *  `smallWhere` for a small noise (the source through open air, the doorway or corner it came round otherwise); for a loud one the fix the room fight read off
 *  his ears this frame (`D.noiseAt`), or, for a man who holds no room, the fix his ears have just moved. Never a truer point than hearing gave him — except
 *  that when the noise's real source is inside `whipNearM` of that place AND he has a clear line to it, he looks at the source: he can see the spot. Null: he
 *  heard nothing of an enemy's (a mate's rounds, a light going out), or it is further than `whipM`. The events are read only for whose noise it was and for
 *  that near-and-in-view source: one he did not hear is never a place to look. */
function noiseOf(g: Game, gd: Guard, N: Mind, D: Def | null, small: boolean, loud: boolean): Vec3 | null {
  const K = NETQUIET, H = gd.witness.heard, p = gd.char.pos, lk = gd.lastKnown;
  const ref = small && H.smallWhere ? H.smallWhere : !loud ? null : D ? (D.noiseAt && D.noiseT >= g.time - 1e-6 ? D.noiseAt : null) : lk && (lk[0] !== N.fx || lk[2] !== N.fz) ? lk : null;
  if (!ref || flat(ref, p) > K.whipM) return null;
  const eye: Vec3 = [p[0], 1.5, p[2]]; let any = false, best: Vec3 | null = null, bd = K.whipNearM;
  for (const e of g.events) {
    if (e.kind === 'lightOut' || e.time < H.lastT - 0.05 || e.who === gd.char.id) continue;   // (the frame his ears counted, and the one before it)
    if (e.who !== undefined && !isHostile(gd.team, teamOfId(g, e.who))) continue;   // (a mate's boots and a mate's rounds are no noise to whip to)
    const big = ((e.kind === 'shot' || e.kind === 'guardShot') && (e.level ?? 0) >= 1) || e.kind === 'bang' || e.kind === 'kick';
    if (big ? !loud : !small || Math.hypot(e.pos[0] - p[0], e.pos[2] - p[2]) > 22) continue;   // (a small noise past hearingCheck's own horizon is not the one he heard)
    any = true;
    const d = flat(e.pos, ref); if (d < bd && !g.col.segmentBlocked(eye, [e.pos[0], 1, e.pos[2]])) { bd = d; best = e.pos; }
  }
  if (!any) return null;
  const at = best ?? ref; return [at[0], 0, at[2]];
}
const whipping = (gd: Guard, N: Mind) => !!N.whipAt && N.whipIn <= 0 && N.whipT > 0 && !N.low;

// ---------------------------------------------------------------- the last man's spot
/** the entries of `E` as seen from `p` by a crouched man: how many he has a line to, the arc they all sit in and its middle */
function arcAt(g: Game, E: Room['entries'], p: Vec3): { seen: number; arc: number; yaw: number; near: number } {
  const eye: Vec3 = [p[0], NETQUIET.eyeM, p[2]]; let seen = 0, near = Infinity; const yaws: number[] = [];
  for (const e of E) {
    const q: Vec3 = [e.at[0] - e.out[0] * 0.5, 1.2, e.at[2] - e.out[1] * 0.5];
    if (!g.col.segmentBlocked(eye, q)) seen++;
    yaws.push(Math.atan2(q[0] - p[0], q[2] - p[2])); near = Math.min(near, flat(q, p));
  }
  if (!yaws.length) return { seen: 0, arc: 0, yaw: 0, near: 0 };
  yaws.sort((a, b) => a - b);
  let gap = -1, at = 0; for (let i = 0; i < yaws.length; i++) { const nx = i + 1 < yaws.length ? yaws[i + 1] : yaws[0] + Math.PI * 2, d = nx - yaws[i]; if (d > gap) { gap = d; at = i; } }
  if (yaws.length === 1) return { seen, arc: 0, yaw: yaws[0], near };
  const arc = Math.PI * 2 - gap, from = at + 1 < yaws.length ? yaws[at + 1] : yaws[0];
  return { seen, arc, yaw: wrapAngle(from + arc / 2), near };
}
/** WHERE HE GOES: of his room's free floor (its nav cells — every other one of a big room's — and where he stands), the spot from which the most entries are in a crouched man's
 *  view, then with them inside the narrowest arc (any arc under `arcDeg` is as good as another), then far from the doors, near him and with a wall at his
 *  back. Where he stands wins unless another spot is better by a class, or by `stayM` of score. NEVER a spot inside `doorM` of ANY entry, wherever he
 *  starts: a man who starts inside `doorM` of one has that as his reason to move (the best spot clear of every door, better than where he stands or not). A
 *  room with no spot clear of every door: the one furthest from its nearest entry, then the best arc. Null = stay. No die. */
function lowSpot(g: Game, gd: Guard, R: Room): Vec3 | null {
  const K = NETQUIET, nav = g.col.nav, cs = nav.cell, W = nav.W, c = gd.char, E = R.entries, lim = K.arcDeg * DEG;
  const rate = (p: Vec3) => { const a = arcAt(g, E, p), back: Vec3 = [p[0] - Math.sin(a.yaw) * 1.1, 1.0, p[2] - Math.cos(a.yaw) * 1.1];
    return { p, seen: a.seen, arc: Math.max(a.arc, lim), near: a.near, score: Math.min(a.near, 8) - 0.35 * flat(p, c.pos) + (g.col.segmentBlocked([p[0], 1.0, p[2]], back) ? 1.5 : 0) }; };
  const better = (a: ReturnType<typeof rate>, b: ReturnType<typeof rate>, by = 0) => a.seen !== b.seen ? a.seen > b.seen : Math.abs(a.arc - b.arc) > 1e-6 ? a.arc < b.arc : a.score > b.score + by;
  const order = (a: ReturnType<typeof rate>, b: ReturnType<typeof rate>) => better(a, b) ? -1 : better(b, a) ? 1 : 0, clear = (r: ReturnType<typeof rate>) => r.near >= K.doorM;
  const here = rate([c.pos[0], 0, c.pos[2]]), coarse = R.cells.size > 400, mouth = !clear(here); const all: ReturnType<typeof rate>[] = [];
  for (const i of R.cells) {
    const ix = i % W, iz = (i / W) | 0; if (coarse && ((ix & 1) || (iz & 1))) continue;
    const p: Vec3 = [(ix + 0.5) * cs, 0, (iz + 0.5) * cs];
    if (nav.isBlocked(p[0], p[2]) || flat(p, c.pos) > K.maxM || flat(p, c.pos) < 0.75) continue;
    all.push(rate(p));
  }
  let C = all.filter(clear);   // (never a doorway's mouth)
  if (C.length) { if (!mouth) C = C.filter(r => better(r, here, K.stayM)); C.sort(order); }   // (in a mouth himself: out of it, to the best there is)
  else C = all.filter(r => r.near > here.near + 0.25).sort((a, b) => Math.abs(a.near - b.near) > 0.25 ? b.near - a.near : order(a, b));   // (no spot clear of every door: the furthest from its nearest one)
  for (const r of C.slice(0, 6)) { if (!mouth && r.arc > Math.PI) break; if (nav.findPath(c.pos, r.p)) return r.p; }   // (no spot with its doors in one half of the compass: he stays)
  return null;
}

// ---------------------------------------------------------------- the tick
/** may this file act on him this frame: the AI on, no show on the floor, free of Sam's arm, himself (not dazzled, not doubled over), not morale.ts's */
const free = (g: Game, gd: Guard) => g.aiEnabled && !g.touring && !g.quietUtility && !gd.held && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil && !moraleOwns(gd) && !runnerOwns(gd);
/** IS HE THE LAST: 2 = he had mates and none of his side is up anywhere (the world's truth: on its own it only has him ASK — see the tick) · 1 = his squad's
 *  men are all down or taken and he knows it of every one (asked for and silent, seen to fall, found, told of), with no living man of his side inside `mateM`
 *  of him and in the open to him · 0 = neither */
function lastKind(g: Game, gd: Guard, N: Mind): 0 | 1 | 2 {
  let had = (squadOf(g, gd)?.men.length ?? 0) > 1, up = false, near = false;   // (a squad whose other men ran and left the floor is still a squad he had)
  for (const o of g.guards) {
    if (o === gd || o.team !== gd.team || !side(g, o)) continue; had = true;
    if (!lostTo(g, o)) { up = true; if (flat(o.char.pos, gd.char.pos) < NETQUIET.mateM && !g.col.segmentBlocked([gd.char.pos[0], 1.5, gd.char.pos[2]], [o.char.pos[0], 1.5, o.char.pos[2]])) near = true; }   // (at his side: not a man through the wall)
  }
  if (had && !up) return 2;
  return !near && knowsSquad(g, gd, N) ? 1 : 0;
}
/** every man of his squad is down or taken, and he knows it of each */
function knowsSquad(g: Game, gd: Guard, N: Mind): boolean {
  const Q = squadOf(g, gd); if (!Q || Q.men.length < 2) return false;
  return Q.men.every(m => m === gd || (lostTo(g, m) && (N.asked.has(m.char.id) || N.known.has(m.char.id))));   // (a man who ran is known gone as a dead one is: asked for and silent, or told of)
}
/** the last man at his act, and this file's to keep where he is: his line said, backing, or low — not a man who has waited `giveUp` past his beat for the
 *  fight to hand him back (he is the fight's and his squad's again until he holds) */
const mine = (N: Mind) => !NETQUIET_QA.broken && N.last >= SAID && N.last <= LOW && !(N.last === SAID && N.t > NETQUIET.lastBeat + NETQUIET.giveUp);
/** at his post: holding his room, on nobody's scripted leg */
const posted = (gd: Guard, D: Def) => D.mode === 'hold' && gd.hold && !gd.script;
/** ONCE A FRAME, right after morale.ts's tick (game.ts update; the rungs are this frame's) and before anybody moves: the lines owed are said, the noises the
 *  men's ears counted last frame are read for a whip, the last man is taken a step through his act. A return on its first line with either switch off. */
export function netQuietTick(g: Game, dt: number) {
  if (!(NETFEED.live = live())) return;   // (the squads' seams file through netquietfeed.ts only while this says so)
  const K = NETQUIET, F = g.fight as RoomFight | undefined;
  for (const f of netFeedTake(g)) {   // (enemysquads.ts's two feeds, filed this frame — a book left over from a roster that is gone, a restart's, is read past)
    if (f.by && !g.guards.includes(f.by)) continue;
    if (f.what === 'asked' && f.who) { if (fed()) NETQUIET_STATS.squadAsks++; netQuietAsked(g, f.by, f.who, f.men); } else if (f.what === 'body') { if (fed()) NETQUIET_STATS.squadBodies++; netQuietBody(g, f.by, f.men); }
  }
  for (const gd of g.guards) {
    if (!ours(g, gd)) { stateOf.delete(gd); netFeedHold(gd, false); continue; }
    if (runnerOwns(gd)) { const N = stateOf.get(gd); if (N) { N.last = NONE; N.t = 0; N.mateT = 0; N.spot = null; N.look = null; N.whipAt = null; N.whipT = 0; N.say = -1; N.low = false; } netFeedHold(gd, false); continue; }   // (runner.ts has him — the shout, the drop, the run: no line of this file's, no whip, no last man's act; whatever of them he was in is dropped)
    const N = mind(gd), H = gd.witness.heard, ok = free(g, gd), eyes = g.time - gd.lastSeenT < K.calmSecs;
    const D = F?.defs.find(d => d.gd === gd) ?? null;
    N.bark = Math.min(N.bark + dt, 60); N.bodyT = Math.min(N.bodyT + dt, 60); N.low = false;
    { const news = N.quiet + N.asked.size + N.known.size; if (news !== N.news) { N.news = news; N.newsT = 0; } else N.newsT = Math.min(N.newsT + dt, 60); }   // (how long since he last learned a man was gone)
    N.roused = gd.state === 'patrol' ? 0 : Math.min(N.roused + dt, 60);
    netFeedHold(gd, mine(N));   // (every frame: a checkpoint restores the act, and this with it)
    // the line owed
    if (N.say >= 0 && (N.sayT -= dt) <= 0) {
      const kind = KINDS[N.say] ?? 'name';   // (not his moment — a man in his eyes, his last words still in the air, morale's hands on him: it WAITS, `sayHold` at the most; it was dropped, and with it a rung of the calls)
      if (ok && !eyes && (kind === 'last' || N.bark >= K.barkSecs)) { N.say = -1; speak(g, gd, N, kind, N.sayName, kind !== 'body' || netUp(g, gd)); }
      else if (N.sayT < -K.sayHold) N.say = -1;
    }
    // the whip: only to a noise HE heard (his ears' own counts went up), at the place his ears put it. A new noise while he is on one does not send his eyes
    // back to the door and out again: the swing is already made (no second `whipShift`), and one target is held `whipHold` at the least.
    if (H.lastT > N.heardT) {
      const small = H.small > N.cs, loud = loudOf(gd) > N.cl, on = whipping(gd, N);
      if ((small || loud) && ok && !eyes && rungOf(gd) >= 1 && N.last !== BACK && !(on && N.whipHeld < K.whipHold)) {
        const at = noiseOf(g, gd, N, D, small, loud);
        if (at && flat(at, gd.char.pos) > 0.5) {
          if (!on && !(N.whipAt && N.whipIn > 0)) { N.whipIn = K.whipShift; NETQUIET_STATS.whips++; }   // (a swing owed already keeps its clock)
          if (!N.whipAt || flat(at, N.whipAt) > 1) { N.whipAt = at; N.whipHeld = 0; }
          N.whipT = K.whipSecs;
        }
      }
      if (ok && N.last === LOW && (small || loud)) rouse(gd);   // (low on his spot, anything he hears has him on his gun again)
      N.heardT = H.lastT; N.cs = H.small; N.cl = loudOf(gd);
    }
    N.fx = gd.lastKnown ? gd.lastKnown[0] : NaN; N.fz = gd.lastKnown ? gd.lastKnown[2] : NaN;
    if (N.whipAt) { if (N.whipIn > 0) N.whipIn -= dt; else { N.whipHeld += dt; if ((N.whipT -= dt) <= 0 || eyes || !ok) { N.whipAt = null; N.whipT = 0; } } }
    // the last man
    if (N.last === NONE) {
      if (!ok || eyes || N.say >= 0 || NETQUIET_QA.broken) continue;   // (a line of his still owed: it is said first)
      if (gd.state === 'patrol' && !N.quiet && !N.known.size) continue;
      const L = lastKind(g, gd, N); if (!L) continue;
      if (L === 2 && !N.quiet && !knowsSquad(g, gd, N)) {
        // nobody is left, but HE cannot know it: nobody has asked the net anything in his hearing. Roused `calmSecs`, he asks it himself — and it is the
        // silence that follows (askBeat, his line for it, lastBeat) that has him act, not the world's truth
        if (N.roused >= K.calmSecs && N.bark >= K.barkSecs) { speak(g, gd, N, 'ask', '', true); N.quiet++; NETQUIET_STATS.quiet++; NETQUIET_STATS.asks++; NETQUIET_STATS.selfAsks++; shock(g, gd, K.unanswered); owe(N, 'last', '', K.askBeat); }
        continue;
      }
      if (N.newsT < K.askBeat) continue;   // (what he has just seen or heard has its beat before he speaks to it)
      const kind: LineKind = L === 2 ? 'last' : 'alone', said = N.lastKind === KINDS.indexOf(kind) && N.bark < 10;   // (the line a check's silence has just had out of him is the line)
      if (!said && N.bark < K.barkSecs) continue;   // (his last words have their room first)
      N.last = SAID; N.t = 0; NETQUIET_STATS.last++; netFeedHold(gd, mine(N));   // (from here his squad sends him nowhere: enemysquads.ts home)
      if (!said) speak(g, gd, N, kind, '', true);
      continue;
    }
    N.t += dt;
    N.mateT = lastKind(g, gd, N) ? 0 : N.mateT + dt;
    if (N.mateT >= K.calmSecs) {   // a living mate has been with him `calmSecs` (a reaction force's man at his side, a man let go and back on the net — not a man walking past): up, and his owner's again
      N.last = NONE; N.t = 0; N.mateT = 0; N.spot = null; N.look = null; netFeedHold(gd, false); NETQUIET_STATS.released++; continue;
    }
    if (N.last === SAID) {
      if (N.t < K.lastBeat || !ok || eyes) continue;
      if (!D) { N.last = DONE; netFeedHold(gd, false); continue; }   // (a man who holds no room — the night staff's: his line, and no more)
      const out = D.mode === 'free' && !gd.script;   // (let off his post to hunt or search — his squad's doing, the fight's: he comes back to his room)
      if (!posted(gd, D) && !out) continue;   // (somebody's leg has him — his squad's errand, the fight's: once he holds again; `giveUp` on, he is theirs to send meanwhile — `mine`)
      const to = NETQUIET_QA.broken || !D.room || !D.room.entries.length ? null : lowSpot(g, gd, D.room) ?? (out ? v3.copy(D.station) : null);   // (no room of his, or one with no way in: low where he stands)
      if (to && D.room) {
        const a = arcAt(g, D.room.entries, to); N.spot = v3.copy(to); N.yaw = a.yaw; N.arc = a.arc; N.last = BACK; N.t = 0; N.whipAt = null; NETQUIET_STATS.backs++;
        // (the room fight's own scripted leg, as pressure.ts `run` starts one — an enemy seen close plants him where he is — walked backwards, his gun on the doors)
        D.mode = 'move'; D.moveKind = 'fallback'; D.cameBy = null; D.moveT = 0; D.stallAt = v3.copy(gd.char.pos); D.stallT = 0; D.rallyAt = NaN; gd.pinned = false;
        order(gd, { goal: v3.copy(to), speed: K.backSpeed, face: a.yaw, strafe: true, aimAt: [to[0] + Math.sin(a.yaw) * 6, 1.1, to[2] + Math.cos(a.yaw) * 6], upper: 'aim', stance: 'none', crouch: false });
      } else settle(g, gd, N, D);
      continue;
    }
    if (N.last === BACK) { if (!D) { N.last = DONE; netFeedHold(gd, false); continue; } if (D.mode !== 'move') settle(g, gd, N, D); continue; }   // (planted: there, or stopped short by the fight's own rules)
    if (N.last !== LOW || !D || D.mode !== 'hold' || !N.spot) continue;
    if (flat(gd.char.pos, N.spot) > 1) settle(g, gd, N, D);   // (the room fight has moved him since — fallen back, taken cover: low again where he is now)
    N.low = ok;
    // where his eyes are, low on his gun: the floor's own eye (guards.ts canSeeChar / eyeContact) looks half way between a man's chest and his head, in plan —
    // and a man on his gun stands bladed, his head down on the sights: the middle of what he sees sits well round from his aim (`eye`), and the more that look
    // is pitched the narrower it is in plan (`eyeHalf`). Read off his own pose once he is down and still, eased.
    { const c = gd.char, hd = c.headDir(), lx = c.chestDir[0] + hd[0], ly = c.chestDir[1] + hd[1], lz = c.chestDir[2] + hd[2], n = Math.hypot(lx, ly, lz);
      if ((c.anim.crouch ?? 0) > K.crouch - 0.15 && gd.speed < 0.3 && n > 1e-3) { const k = Math.min(1, dt * 2), flatK = Math.hypot(lx, lz) / n;
        N.eye += (wrapAngle(Math.atan2(lx, lz) - c.aimYaw) - N.eye) * k; N.eyeHalf += (Math.acos(clamp(Math.cos(K.eyeDeg * DEG) / Math.max(flatK, 1e-3), -1, 1)) - N.eyeHalf) * k; } }
    watch(N);
    // nothing seen, nothing heard for `alertSecs`: he is no longer 'alert' (as a man his squad calms is not, for ever) — the spot, the crouch and the arc stay
    if (gd.state === 'alert' && ok && N.t > K.alertSecs && g.time - Math.max(gd.lastSeenT, H.lastT) > K.alertSecs) ease(gd);
    else if (gd.state !== 'alert' && ok) wary(gd);   // (…but a man who knows he is the last does not talk himself calm: wary, on the floor's own line for it)
  }
}
/** on his gun, as roomfight.ts plant() leaves any defender who has moved to a new post: roused, at the floor's own alert line. No beat is shortened by it —
 *  the room fight's own reaction beat for going alert is paid here, at the spot, and not in front of the man who comes in. He has cause: nobody acts as the
 *  last man who has not had a check go unanswered, seen his mates fall or found them. */
function rouse(gd: Guard) { if (gd.state !== 'alert') gd.state = 'alert'; gd.awareness = Math.max(gd.awareness, 0.92); }
/** …and off it again: wary, not alert (the next thing he sees or hears pays the floor's own beats) */
function ease(gd: Guard) { gd.state = 'suspicious'; NETQUIET_STATS.eased++; }
function wary(gd: Guard) { gd.awareness = Math.max(gd.awareness, NETQUIET.wary); }
/** down where he stands, on his gun: the arc as it reads from here (no room of his, or no way into it: no arc — the room fight's own watch stands) */
function settle(g: Game, gd: Guard, N: Mind, D: Def) {
  const p: Vec3 = [gd.char.pos[0], 0, gd.char.pos[2]], a = D.room && D.room.entries.length ? arcAt(g, D.room.entries, p) : { arc: Math.PI * 2, yaw: gd.char.bodyYaw };
  N.spot = p; N.yaw = a.yaw; N.arc = a.arc; N.last = LOW; N.t = 0; N.low = true; NETQUIET_STATS.low++; watch(N); rouse(gd);
}
/** what he watches from the spot: the middle of the arc his doors sit in — moved round, by no more than it takes, until every door of it is inside his EYES
 *  (`eye`, `eyeHalf`: they sit round from his gun, toward his chest, and narrow — measured on a crouched man: 45° round, 26° either way; with his gun on the
 *  middle of a 34° arc neither door was in them past the near field, and a man walked 2.4 m into the room unseen). So his gun rests off the middle, toward
 *  his off side, and his eyes hold the doors; an arc wider than his eyes (doors on three walls) has their middle on its middle and its ends outside them. */
function watch(N: Mind) {
  const s = N.spot!; if (N.arc > Math.PI) { N.look = null; return; }
  const room = Math.max(0, N.eyeHalf - NETQUIET.eyeSlack * DEG - N.arc / 2), y = N.yaw - Math.sign(N.eye) * Math.max(0, Math.abs(N.eye) - room);
  N.look = [s[0] + Math.sin(y) * 6, 0, s[2] + Math.cos(y) * 6];
}

// ---------------------------------------------------------------- the seams that pose him
/** IS HE THE LAST MAN AT HIS ACT (roomfight.ts rally): his line said, backing, or low — he does not walk off to a fight next door where nobody of his is
 *  left to fight it. False on its first line with the switch off. */
export function netQuietHolds(gd: Guard): boolean {
  if (!live() || NETQUIET_QA.broken) return false;
  const N = stateOf.get(gd); return !!N && mine(N);
}
/** WHAT A MAN HOLDING A ROOM WATCHES (roomfight.ts applyWatch, after it has written `pt`): the last man's arc, low on his spot; a whip's noise. Untouched
 *  otherwise — and on its first line with the switch off. */
export function netQuietLook(gd: Guard, pt: Vec3) {
  if (!live() || NETQUIET_QA.broken) return;
  const N = stateOf.get(gd); if (!N) return;
  const at = N.low && N.look ? N.look : whipping(gd, N) ? N.whipAt : null;
  if (at) { pt[0] = at[0]; pt[1] = 0; pt[2] = at[2]; }
}
/** HOW HE STANDS AND WHERE HIS GUN GOES (guards.ts updateGuard's pose, beside tactics.ts's look): a last man low on his spot is crouched; a whipping man with
 *  nobody in his eyes has the noise as his aim, and comes round to it — aim and body — at the whip's rate, not the calm one. Null = nothing of this file's
 *  (and on its first line with the switch off). `eyesOnFoe`: he sees the man he is fighting — the fight's aim stands. */
export function netQuietPose(g: Game, gd: Guard, dt: number, eyesOnFoe: boolean): { aim: Vec3 | null; crouch: number } | null {
  if (!live()) return null;
  const N = stateOf.get(gd); if (!N) return null;
  if (N.low) return { aim: null, crouch: NETQUIET.crouch };
  if (!whipping(gd, N) || eyesOnFoe || g.time - gd.lastSeenT < NETQUIET.calmSecs) return null;
  const c = gd.char, at = N.whipAt!, yaw = Math.atan2(at[0] - c.pos[0], at[2] - c.pos[2]), rate = rungOf(gd) >= 2 ? NETQUIET.whipTurnBroken : NETQUIET.whipTurn;
  c.aimYaw = approachAngle(c.aimYaw, yaw, Math.max(0, rate - 6) * dt);   // (the pose's own easing adds its 6 rad/s after this)
  if (gd.speed < 0.3) c.bodyYaw = approachAngle(c.bodyYaw, yaw, rate * dt);   // (further: the whole man comes round, not his gun as far as his waist lets it)
  return { aim: [at[0], 1.1, at[2]], crouch: 0 };
}

// ---------------------------------------------------------------- QA and the panel
/** QA: where the last man's rule would send this man now (null = he stays), and the arc from there — or from where he stands */
export function netQuietSpot(g: Game, gd: Guard): { to: Vec3 | null; arc: number; seen: number } | null {
  const R = (g.fight as RoomFight | undefined)?.defs.find(d => d.gd === gd)?.room; if (!R) return null;
  const to = lowSpot(g, gd, R), a = arcAt(g, R.entries, to ?? gd.char.pos); return { to, arc: a.arc, seen: a.seen };
}
/** QA: what the rule has of a man (null = never met) */
export function netQuietOf(gd: Guard): Readonly<Mind> | null { return stateOf.get(gd) ?? null; }
/** 'net ▸ Tango 2 quiet ×2 · Tango 4 LAST low (arc 31°)' — every living man with anything on him; '' with either switch off */
export function netQuietSummary(g: Game): string {
  if (!live()) return '';
  const acts = ['', 'LAST said', 'LAST backing', 'LAST low', 'LAST'];
  const men = g.guards.filter(gd => ours(g, gd) && stateOf.has(gd)).map(gd => [gd, stateOf.get(gd)!] as const).filter(([, N]) => N.quiet > 0 || N.last !== NONE || !!N.whipAt);
  return 'net ▸ ' + (men.map(([gd, N]) => `${gd.callsign}${N.quiet ? ` quiet ×${N.quiet}` : ''}${N.last ? ` ${acts[N.last]}${N.last === LOW ? ` (arc ${Math.round(N.arc / DEG)}°)` : ''}` : ''}${N.whipAt ? ' whip' : ''}`).join(' · ') || 'every man answered');
}

// ---------------------------------------------------------------- the visit's choice (the page: host/profile.ts pageSwitches; the debugger's Enemy nerve section)
const VISIT = 'twopointsix.netquiet.visit';
/** a choice made by hand in the debugger stands for the visit (the tab's own store), as morale.ts's does */
export function netQuietKeep() { try { globalThis.sessionStorage?.setItem(VISIT, JSON.stringify({ on: NETQUIET.on })); } catch { /* no store */ } }
/** THE PAGE'S RULE for the switch: the visit's kept choice, and over it the address — `?nonetquiet`. No flag and nothing kept (the shipped stand): on. */
export function netQuietFromQuery(q: URLSearchParams) {
  let kept: { on?: unknown } = {};
  try { kept = JSON.parse(globalThis.sessionStorage?.getItem(VISIT) ?? '{}') ?? {}; } catch { /* no store */ }
  NETQUIET.on = !q.has('nonetquiet') && kept.on !== false;
}

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): each man's count, line owed, whip and act, by roster index
export interface NetQuietSnap { men: (number[] | null)[]; pts: (number[] | null)[]; names: (string | null)[]; asked: (number[] | null)[]; known?: (number[] | null)[]; paid?: (number[] | null)[] }
const n3 = (p: Vec3 | null) => p ? [p[0], p[1], p[2]] : [NaN, NaN, NaN];
/** nothing (no key in the file) with either switch off or before the rule has met anybody */
export function netQuietSnapshot(g: Game): NetQuietSnap | undefined {
  if (!live()) return undefined;
  const Ns = g.guards.map(gd => stateOf.get(gd) ?? null); if (!Ns.some(N => N)) return undefined;
  return { men: Ns.map(N => N ? [N.quiet, N.say, N.sayT, N.bark, N.bodyT, N.heardT, N.whipIn, N.whipT, N.last, N.t, N.lastKind, N.yaw, N.arc, N.low ? 1 : 0, N.cs, N.cl, N.fx, N.fz, N.whipHeld, N.roused, N.eye, N.eyeHalf, N.news, N.newsT] : null),
    pts: Ns.map(N => N ? [...n3(N.whipAt), ...n3(N.spot), ...n3(N.look)] : null), names: Ns.map(N => N ? N.sayName : null), asked: Ns.map(N => N ? [...N.asked] : null),
    known: Ns.map(N => N ? [...N.known] : null), paid: Ns.map(N => N ? [...N.paid].flat() : null) };
}
/** …onto the fresh roster (a file without the slice: every man is met afresh on his first tick). The squads' book and the holds they ask about
 *  (netquietfeed.ts) are set HERE too: the room fight's tick — the squads' with it — runs before this file's on the first frame after a load. */
export function netQuietRestore(g: Game, s: NetQuietSnap | null | undefined) {
  const f = (x: unknown, d = 0) => typeof x === 'number' && Number.isFinite(x) ? x : d, ids = (a: unknown) => (Array.isArray(a) ? a : []).filter((x): x is number => typeof x === 'number');
  netFeedTake(g); NETFEED.live = live();   // (nothing filed for a roster that is gone is read by this one)
  g.guards.forEach((gd, i) => { const M = s?.men?.[i], P = s?.pts?.[i];
    if (!M) { stateOf.delete(gd); netFeedHold(gd, false); return; }
    const p3 = (o: number): Vec3 | null => P && Number.isFinite(P[o]) ? [P[o], P[o + 1], P[o + 2]] : null, H = gd.witness.heard;
    const paid = new Map<number, number>(), pp = ids(s?.paid?.[i]); for (let k = 0; k + 1 < pp.length; k += 2) paid.set(pp[k], pp[k + 1]);
    const last = clamp(Math.round(f(M[8])), NONE, DONE);
    stateOf.set(gd, { quiet: Math.max(0, f(M[0])), asked: new Set(ids(s?.asked?.[i])), known: new Set(ids(s?.known?.[i])), paid, say: clamp(Math.round(f(M[1], -1)), -1, KINDS.length - 1), sayT: f(M[2]), sayName: String(s?.names?.[i] ?? ''), bark: f(M[3], NETQUIET.barkSecs), bodyT: f(M[4], 60),
      heardT: f(M[5], H.lastT), whipAt: p3(0), whipIn: f(M[6]), whipT: f(M[7]), last, t: Math.max(0, f(M[9])), mateT: 0, news: f(M[22]), newsT: f(M[23], 60), eye: f(M[20]), eyeHalf: f(M[21], NETQUIET.eyeDeg * DEG), lastKind: clamp(Math.round(f(M[10], -1)), -1, KINDS.length - 1), yaw: f(M[11]), arc: f(M[12]), low: !!M[13],
      cs: f(M[14], H.small), cl: f(M[15], loudOf(gd)), fx: f(M[16], NaN), fz: f(M[17], NaN), whipHeld: f(M[18]), roused: f(M[19]), spot: p3(3), look: p3(6) });
    netFeedHold(gd, live() && mine(stateOf.get(gd)!)); });
}
