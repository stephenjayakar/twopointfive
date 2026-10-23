// THE RESCUE'S MEN CHECK IN (defenders answer the plan the team chose: the quiet way in on a hostage rescue).
//
// WHAT WAS THERE: a rescue's cast is its own (rescue.ts: a captor on a clock, a door man, a roamer or two) and none of the squads' radio check runs on it. A
// loud way in lets the roamer off to the noise and the captor shouts his clock; a man of theirs taken without a sound is missed by nobody, for as long as the
// team cares to take.
//
// THE RULE, while a rescue is staged or running and their side is calm (no man of the cast alert or searching):
//   · A RADIO CHECK every `every` seconds (the first after `first`): the captor — or, without him, the first man who can — says "radio check — sound off".
//     A man who can answer has answered. A man who is down and whom nobody of theirs saw fall has not.
//     A man down in the hostage room itself is never asked for: that room is the rescue's own (its clock, its hand-over), and nobody is walked into it.
//   · HE IS ASKED FOR BY HIS POST `askSecs` later ("the break room, sound off … the break room?" — a defender does not say the team's label for a mate:
//     dialogue.ts placeName of where he was posted), and `goSecs` after that ONE MAN GOES THERE: a roamer still on his own post first, else the door man
//     or a guard posted outside the hostage room — "nothing from the break room — one moving there!", at a walk, his boots filed for the team's ears.
//     NEVER the captor and never a man in the room with the hostages (rescue.ts: they are the clock), never a man the rescue has already let off his post
//     or Hard's crew has dealt with, never a man another rule has (powerout.ts powerOutKept: a lane, a press, a dig-in). Nobody free: "nothing from the
//     break room — nobody to spare. Stay on your doors!" and nobody moves.
//   · ON THE WAY AND AT THE POST he looks for any man of theirs who is down and not yet found, as any finder does (guards.ts bodySeen: in his view and lit
//     enough to make out — at the post he looks about him, and a body at his feet is found in any light). FOUND: "man down, the break room — they're
//     inside!", the body is counted and written down as any found body is, he is roused, the room fight's free man and the rescue's 'learned' one like
//     any man of theirs who sees a body, and this rule lets go of him. Nothing there after `waitSecs`: "nothing at the break room — he's gone!", and he
//     walks back to his own.
//   · THE MAN WHO WENT AND DID NOT COME BACK is missed at the next check like any man — asked for where he was going — and the post he never reached is
//     a question again.
//   · A ROAMER SAYS WHERE HE IS GOING: `wordSecs` before the rescue lets a roamer who has learned of the assault off his post (rescue.ts: `setSecs` after he
//     learned) he says so on their net — "heard that — moving to cover it!", or with nothing loud to go to "on my way — moving to the hostage door!" (not a
//     man with the team in his eye: his shouts are his own). When he goes is the rescue's, as it was; a noise that comes after he spoke is said when he
//     goes. HIS WORD IS KEPT: let go with a noise known and nothing of the team seen since he learned, his fix is that noise, as the rescue gives it to a
//     man who was calm — not the doorway its echo reached him through.
//   · A fight anywhere on their side, or a shot, a boot or a charge in his ears on the way: back to his post at a run, and the rule stands down while it lasts.
//     Men who went down while their side was roused are known down: nobody is asked for after a fight.
// THE CLOCK IS NOT TOUCHED: nothing here starts it, speeds it or stops it. A man walking to a post has learned nothing of the team (rescue.ts asks
// `rescueCheckOwns` before it reads his walk as that); what he SEES there is his own.
// No man is added and nobody's eyes, aim or health change; the post he walks to is his mate's own, not where the team is. No dice (the beats are the cast's
// ids), no camera, no graphics setting, no wall clock. State per Game with its pair (rescueCheckSnapshot / rescueCheckRestore through savestate.ts).
// Type-only game imports but for functions used inside calls (src/game is one import cycle).
import { SideMap } from '../math/side';
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import { Vec3, v3 } from '../math/vec';
import { order, endGuardScript } from './squad';
import { run, boots } from './pressure';
import { calmOf, calmBack, calmSave, calmLoad, powerOutKept, type Calm, type CalmSnap } from './powerout';
import { bodySeen, resetChase } from './guards';
import { cueClass } from './cues';
import { chronRadio, chronBodyFound } from './chronicle';
import { placeName } from './dialogue';
import { tally } from './mission';
import { isBreathing } from './game';
import { runnerFled } from './runner';
import { RESCUE } from './rescue';
import { wg } from './words';   // (a leaf: the dialogue pass's one switch)

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?norescuecheck = a rescue's men never miss each other,
 *  as it was) and by the shipped stand; the harness's frozen stand leaves it off (TPS_RESCUECHECK=1 turns it on). UNTUNED by play. */
export const RESCUECHECK = {
  on: false,
  /** the first check after the staging, and the gap between checks, s (where in the band: the caller's id and the check's number — no dice) */
  first: [14, 22] as [number, number], every: [24, 36] as [number, number],
  /** the breath a man is given to answer before he is asked for by name · the breath after it before a man goes */
  askSecs: 4, goSecs: 4,
  /** how long the man who went stands at an empty post before he says so and walks back */
  waitSecs: 5,
  /** legs of a walk tried again before it is given up (the room fight ends a leg at ten seconds) */
  tries: 4,
  /** how far round his feet the man at the post finds a body in any light, m */
  feetM: 2.5,
  /** a roamer's word this long before the rescue lets him off his post */
  wordSecs: 2.5,
};

type Def = RoomFight['defs'][number];
type Phase = 'out' | 'there' | 'back';
interface Out { gd: Guard; about: Guard; goal: Vec3; from: Vec3; phase: Phase; thereT: number; tries: number; stepT: number; heard0: number; calm: Calm }
export interface RescueCheckEvent { t: number; what: 'check' | 'asks' | 'goes' | 'nobody' | 'there' | 'found' | 'empty' | 'home' | 'abort' | 'lost' | 'word' | 'kept'; who: string; why: string }
type Cast = ReturnType<Game['rescue']['cast']>;
interface State { nextAt: number; n: number; stage: 'idle' | 'called' | 'asked'; t0: number; caller: Guard | null; about: Guard | null; known: Set<Guard>;
  /** where a man who went out was going (he is looked for there, not on the post he left) */ where: Map<Guard, Vec3>;
  /** what a roamer has said of where he is going · the roamers whose letting-go this rule has seen */ worded: Map<Guard, 'noise' | 'door'>; kept: Set<Guard>; out: Out | null; events: RescueCheckEvent[] }
const STATES = new SideMap<Game, State>('rescuecheck.STATES');

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const frac = (x: number) => x - Math.floor(x);
const alive = (gd: Guard) => gd.state !== 'dead' && gd.char.alive && !runnerFled(gd);
const fit = (g: Game, gd: Guard) => alive(gd) && !gd.held && g.time >= gd.dazzledUntil && g.time >= gd.staggerUntil;
const roused = (gd: Guard) => gd.state === 'alert' || gd.state === 'search';
const loudHeard = (gd: Guard) => { const H = gd.witness.heard; return H.shots + H.kick + H.bang; };
const defOf = (g: Game, gd: Guard): Def | undefined => g.fight.defs.find(D => D.gd === gd);
/** a line on their net (enemysquads.ts onNet's shape): its class on the team's strip, a row of the debrief unless it is the routine check */
function net(g: Game, gd: Guard, text: string, cls = cueClass(text), chron = true) {
  if (gd.held) return;
  g.cues?.net(gd, text, cls); if (chron) chronRadio(g, gd, text); g.msg(`${gd.callsign} (radio): ${text}`);
}
const band = (b: [number, number], k: number) => b[0] + (b[1] - b[0]) * frac(k * 0.6180339887);
function event(g: Game, st: State, what: RescueCheckEvent['what'], gd: Guard | null, why: string) {
  st.events.push({ t: g.time, what, who: gd ? gd.callsign : '-', why }); if (st.events.length > 120) st.events.splice(0, 40);
  const L = g.fight.log; L.push({ t: g.time, who: gd ? gd.callsign : '-', what: `[rescuecheck] ${what}: ${why}` }); if (L.length > 600) L.splice(0, 200);
}
/** the rule's floor: a rescue staged or running, in live play */
function ruled(g: Game): boolean {
  if (!RESCUECHECK.on || !g.rescue.active || g.touring || g.director.showing) return false;
  const s = g.rescue.state; return s === 'staged' || s === 'running';
}

/** rescue.ts defenders(): this man is out on the check's errand and has noticed nothing — his walk is not word of the team (a thing he hears on the way is:
 *  the rescue's own test, a man no longer on patrol or with something in his ears, reads him then as it reads any man) */
export function rescueCheckOwns(g: Game, gd: Guard): boolean { return RESCUECHECK.on && STATES.get(g)?.out?.gd === gd && !roused(gd) && gd.state !== 'suspicious' && gd.awareness < 0.3; }
/** the check's and the debugger's timeline */
export function rescueCheckTimeline(g: Game): RescueCheckEvent[] { return STATES.get(g)?.events ?? []; }
/** a staging, a restart (game.ts resetGuards) */
export function rescueCheckReset(g: Game) { STATES.delete(g); }

/** who goes: a roamer on his own post first, then the door man or a guard posted outside the hostage room — the nearest by the straight line; a man any
 *  other rule has is not free (powerOutKept: the same question the breaker's two are asked) */
function goer(g: Game, cast: Cast, about: Guard, post: Vec3): { D: Def; gd: Guard } | null {
  const free = cast.filter(c => c.gd !== about && !c.inRoom && c.role !== 'captor' && isNaN(c.learnedAt) && !c.released && !c.crewed && c.gd.state !== 'suspicious')
    .map(c => ({ c, D: defOf(g, c.gd) })).filter((x): x is { c: Cast[number]; D: Def } => !!x.D && powerOutKept(g, x.D) === null);
  const pick = free.sort((a, b) => (a.c.role === 'roamer' ? 0 : 1) - (b.c.role === 'roamer' ? 0 : 1) || flat(a.c.gd.char.pos, post) - flat(b.c.gd.char.pos, post))[0];
  return pick ? { gd: pick.c.gd, D: pick.D } : null;
}
/** his own side's word for where a man is posted (dialogue.ts: no label of the team's) */
const postOf = (g: Game, st: State, cast: Cast, gd: Guard): Vec3 => st.where.get(gd) ?? cast.find(c => c.gd === gd)?.post ?? gd.char.pos;
/** nothing of the team in his eye since he learned of them (no learned time: in the last half minute) */
const unseen = (g: Game, c: Cast[number]) => !(c.gd.lastSeenT > (isNaN(c.learnedAt) ? g.time - 30 : c.learnedAt - 1));
function walk(g: Game, D: Def, to: Vec3) { run(g, D, to, null); order(D.gd, { speed: g.tune.guardInvestigate }); }

/** once a frame, before the room fight's own tick (game.ts) — a return on its first line with the switch off or no rescue on the floor */
export function rescueCheckTick(g: Game, _dt: number) {
  if (!ruled(g)) { const st = STATES.get(g); if (st) { letGo(g, st); STATES.delete(g); } return; }
  const K = RESCUECHECK, cast = g.rescue.cast(); if (cast.length < 2) return;
  let st = STATES.get(g);
  if (!st) { const lead = cast.find(c => c.role === 'captor') ?? cast[0]; STATES.set(g, st = { nextAt: g.time + band(K.first, lead.gd.char.id), n: 0, stage: 'idle', t0: 0, caller: null, about: null, known: new Set(), where: new Map(), worded: new Map(), kept: new Set(), out: null, events: [] }); }
  // a roamer about to be let off his post says where he is going (not a man with the team in his eye: he is fighting, and his shouts are his own)
  const NOISE = 'heard that — moving to cover it!', DOOR = 'on my way — moving to the hostage door!';
  for (const c of cast) if (c.role === 'roamer' && !c.released && !c.crewed && !isNaN(c.learnedAt) && !st.worded.has(c.gd) && fit(g, c.gd) && unseen(g, c) && g.time >= c.learnedAt + RESCUE.setSecs - K.wordSecs) {
    const at = g.rescue.noiseAt; st.worded.set(c.gd, at ? 'noise' : 'door'); net(g, c.gd, at ? NOISE : DOOR, 1); event(g, st, 'word', c.gd, `${K.wordSecs} s before the rescue lets him off his post`);
  }
  // HIS WORD IS KEPT: let off his post with a noise of the team's known and nothing of them seen since he learned, his fix is that noise — as the rescue
  // gives it to a man who was calm; a man already alert it leaves with the fix his ears gave him, the doorway the echo came in through, two metres from his
  // post. A noise he has not spoken of (it came after his word, or he had no breath for one) is said as he goes.
  for (const c of cast) if (c.role === 'roamer' && c.released && !c.crewed && !st.kept.has(c.gd)) {
    st.kept.add(c.gd); const at = g.rescue.noiseAt, gd = c.gd; if (!fit(g, gd) || gd.state !== 'alert' || !unseen(g, c)) continue;
    if (at) { if (st.worded.get(gd) !== 'noise') { st.worded.set(gd, 'noise'); net(g, gd, NOISE, 1); } gd.lastKnown = v3.copy(at); resetChase(gd); event(g, st, 'kept', gd, 'his fix is the noise'); }
    else if (!st.worded.has(gd)) { st.worded.set(gd, 'door'); net(g, gd, DOOR, 1); }
  }
  const fight = cast.some(c => alive(c.gd) && roused(c.gd));
  if (fight) {   // their side is in it: who is down is known, nobody is asked for, the man out runs home
    for (const c of cast) if (!alive(c.gd)) st.known.add(c.gd);
    if (st.stage !== 'idle') { st.stage = 'idle'; st.about = null; }
    st.nextAt = Math.max(st.nextAt, g.time + K.every[0]);
  }
  if (st.out) tickOut(g, st, cast, fight);
  if (fight || st.out) return;
  const caller = () => { const c = cast.find(c => c.role === 'captor' && fit(g, c.gd)) ?? cast.find(c => fit(g, c.gd)); return c?.gd ?? null; };
  if (st.stage === 'idle') {
    if (g.time < st.nextAt) return;
    const by = caller(); st.n++; st.nextAt = g.time + band(K.every, (by?.char.id ?? 1) + st.n * 7);
    if (!by) return;
    st.caller = by; st.stage = 'called'; st.t0 = g.time;
    net(g, by, 'radio check — sound off', 6, false); event(g, st, 'check', by, 'calls the radio check');
    return;
  }
  const by = st.caller && fit(g, st.caller) ? st.caller : caller(); if (!by) { st.stage = 'idle'; return; }
  if (st.stage === 'called') {
    if (g.time < st.t0 + K.askSecs) return;
    // (a man down in the hostage room is never a question on the net: that room is the rescue's own — who holds its clock, who takes it over — and nobody
    // is walked into it by this rule)
    for (const c of cast) if (c.inRoom && !alive(c.gd)) st.known.add(c.gd);
    const miss = cast.find(c => !alive(c.gd) && !st!.known.has(c.gd) && c.gd !== by);
    if (!miss) { st.stage = 'idle'; return; }
    st.about = miss.gd; st.stage = 'asked'; st.t0 = g.time;
    const place = placeName(g.level, postOf(g, st, cast, miss.gd));
    net(g, by, `${place}, sound off … ${place}?`, 2); event(g, st, 'asks', by, `no answer from ${miss.gd.callsign}: asked for by his post, ${place}`);
    return;
  }
  if (g.time < st.t0 + K.goSecs) return;
  const about = st.about!, post = postOf(g, st, cast, about), place = placeName(g.level, post); st.stage = 'idle'; st.about = null; st.known.add(about);
  const go = goer(g, cast, about, post);
  if (!go) { net(g, by, `nothing from ${place} — nobody to spare. Stay on your doors!`, 3); event(g, st, 'nobody', by, `nobody outside the hostage room is free to walk to ${about.callsign}'s post`); return; }
  st.out = { gd: go.gd, about, goal: v3.copy(post), from: v3.copy(go.D.station), phase: 'out', thereT: -1, tries: 0, stepT: -100, heard0: loudHeard(go.gd), calm: calmOf(go.D) };
  net(g, go.gd, wg(`nothing from ${place} — I'm heading over!`, `nothing from ${place} — one moving there!`), 1); walk(g, go.D, post);
  event(g, st, 'goes', go.gd, `walks to where ${about.callsign} was posted (${place}), ${flat(go.gd.char.pos, post).toFixed(0)} m off`);
}

/** the man who went, a step on */
function tickOut(g: Game, st: State, cast: Cast, fight: boolean) {
  const M = st.out!, gd = M.gd, D = defOf(g, gd), K = RESCUECHECK, drop = () => { st.out = null; };
  // (down or taken on his way: he is missed at the next check like any man, where he was going; and the post he never reached is a question again)
  if (!alive(gd) || !D || gd.held) { st.where.set(gd, v3.copy(M.goal)); if (M.phase !== 'back') st.known.delete(M.about); event(g, st, 'lost', gd, !alive(gd) ? 'down on his way' : gd.held ? 'taken on his way' : 'no man of the fight\'s any more'); return drop(); }
  if (roused(gd)) { event(g, st, 'abort', gd, 'he is roused (a body, or the team, in his eye): his own from here'); return drop(); }
  M.stepT = boots(g, gd, M.stepT);
  if (D.mode !== 'move') { event(g, st, 'abort', gd, 'the room fight has him where he stands'); return drop(); }
  const learned = !isNaN(cast.find(c => c.gd === gd)?.learnedAt ?? NaN);
  if (fight || learned || loudHeard(gd) > M.heard0) { run(g, D, M.from, null); event(g, st, 'abort', gd, `${fight ? 'a fight on their side' : learned ? 'something of the team in his ears: the rescue has him' : 'a shot, a boot or a charge in his ears'}: back to his post at a run`); return drop(); }
  // a man of theirs on the floor, not yet found: his to call, and he is his own from here
  const down = M.phase === 'back' ? undefined : cast.find(c => !alive(c.gd) && c.gd.state === 'dead' && !c.gd.found && bodySeen(g, gd, c.gd, M.phase === 'there' && c.gd === M.about ? K.feetM : false))?.gd;
  if (down) {
    const body = down.char.bones.hips ?? down.char.pos, place = placeName(g.level, body);
    down.found = true; tally(g, 'bodies'); chronBodyFound(g, down, gd); st.known.add(down);
    gd.sawBodyT = g.time; gd.witness.sawBody = { victim: down.callsign, t: g.time, breathing: isBreathing(down) };
    if (gd.script) endGuardScript(gd, 'alert');
    gd.state = 'alert'; gd.awareness = 1; gd.reactT = 0; gd.hold = false; gd.pinned = false; gd.lastKnown = [body[0], 0, body[2]]; resetChase(gd);
    D.mode = 'free'; D.freeAt = g.time; D.rallyAt = NaN;   // (the way the rescue lets a roamer go: he stays on the room fight's roster and holds again where he ends up)
    net(g, gd, `man down, ${place} — they're inside!`, 1); event(g, st, 'found', gd, `${down.callsign} on the floor in his eye, ${flat(gd.char.pos, body).toFixed(1)} m off: roused, and his own from here`);
    return drop();
  }
  const goal = M.phase === 'back' ? M.from : M.goal, reached = !!gd.script?.arrived || flat(gd.char.pos, goal) < 0.6;
  if (M.phase === 'there') {
    if (gd.script) gd.script.arrived = false; D.stallT = 0; D.moveT = 0;   // (he stands where he was sent: still his leg)
    if (g.time - M.thereT < K.waitSecs) return;
    net(g, gd, `nothing at ${placeName(g.level, M.goal)} — he's gone!`, 2); event(g, st, 'empty', gd, `${K.waitSecs} s at ${M.about.callsign}'s post and nothing in his eye: back to his own`);
    M.phase = 'back'; M.tries = 0; walk(g, D, M.from); return;
  }
  if (!reached) {
    if (D.stallT <= 1.3 && D.moveT <= 8) return;   // on his way
    if (M.tries < K.tries) { M.tries++; walk(g, D, goal); return; }
    if (M.phase === 'back') { event(g, st, 'abort', gd, 'no way back to his post: the room fight plants him where he is'); return drop(); }
    M.phase = 'back'; M.tries = 0; walk(g, D, M.from); event(g, st, 'abort', gd, 'no way to the post: back to his own'); return;
  }
  if (M.phase === 'back') { calmBack(D, M.calm, false); event(g, st, 'home', gd, 'back on his post'); return drop(); }
  M.phase = 'there'; M.thereT = g.time; if (gd.script) gd.script.arrived = false; D.stallT = 0; D.moveT = 0;
  event(g, st, 'there', gd, `at ${M.about.callsign}'s post`);
}
/** the rule let go of with a man out (the switch thrown off, the rescue over): he runs back to his post and is the room fight's from there */
function letGo(g: Game, st: State) {
  const M = st.out; st.out = null; if (!M) return;
  const D = defOf(g, M.gd); if (D && D.mode === 'move' && alive(M.gd) && !M.gd.held && !roused(M.gd)) run(g, D, M.from, null);
}

// ---------------------------------------------------------------- the state's pair (new module state the game depends on rides a snapshot)
export type RescueCheckSnap = { nextAt: number; n: number; stage: State['stage']; t0: number; caller: number; about: number; known: number[]; where: [number, Vec3][]; worded: [number, 'noise' | 'door'][]; kept: number[];
  out: { i: number; about: number; goal: Vec3; from: Vec3; phase: Phase; thereT: number; tries: number; stepT: number; heard0: number; calm: CalmSnap } | null };
export function rescueCheckSnapshot(g: Game): RescueCheckSnap | undefined {
  const st = STATES.get(g); if (!RESCUECHECK.on || !st) return undefined;
  const i = (gd: Guard | null) => gd ? g.guards.indexOf(gd) : -1, M = st.out;
  return { nextAt: st.nextAt, n: st.n, stage: st.stage, t0: st.t0, caller: i(st.caller), about: i(st.about), known: [...st.known].map(i).filter(k => k >= 0), where: [...st.where].map(([m, p]): [number, Vec3] => [i(m), v3.copy(p)]).filter(e => e[0] >= 0), worded: [...st.worded].map(([m, w]): [number, 'noise' | 'door'] => [i(m), w]).filter(e => e[0] >= 0), kept: [...st.kept].map(i).filter(k => k >= 0),   // (the timeline is the check's and the debugger's: not kept)
    out: M ? { i: i(M.gd), about: i(M.about), goal: v3.copy(M.goal), from: v3.copy(M.from), phase: M.phase, thereT: M.thereT, tries: M.tries, stepT: M.stepT, heard0: M.heard0, calm: calmSave(M.calm) } : null };
}
export function rescueCheckRestore(g: Game, s: RescueCheckSnap | null | undefined) {
  if (!s) { STATES.delete(g); return; }
  const at = (k: number) => g.guards[k] ?? null, o = s.out, gd = o ? at(o.i) : null, about = o ? at(o.about) : null;
  STATES.set(g, { nextAt: s.nextAt, n: s.n, stage: s.stage, t0: s.t0, caller: at(s.caller), about: at(s.about), known: new Set(s.known.map(at).filter((x): x is Guard => !!x)), where: new Map(s.where.filter(e => at(e[0])).map(([k, p]): [Guard, Vec3] => [at(k)!, v3.copy(p)])), worded: new Map(s.worded.filter(e => at(e[0])).map(([k, w]): [Guard, 'noise' | 'door'] => [at(k)!, w])), kept: new Set(s.kept.map(at).filter((x): x is Guard => !!x)), events: [],
    out: o && gd && about ? { gd, about, goal: v3.copy(o.goal), from: v3.copy(o.from), phase: o.phase, thereT: o.thereT, tries: o.tries, stepT: o.stepT, heard0: o.heard0, calm: calmLoad(g, o.calm) } : null });
}
