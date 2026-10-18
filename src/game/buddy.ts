// A LONE DEFENDER RADIOS FOR A BUDDY (the maintainer, 10-07: "and then if someone is alone in a room, they could radio for a buddy"). Behind `BUDDY.on`
// (shipped OFF — see the measured note below; off: nothing here runs, no die is drawn, and the room fight is roomfight.ts run for run as it was — its seams are `buddyTick` at the tail of tick(),
// `buddyStop` in stop() and one clause in rally()).
//
//   THE CALL. A scenario defender holding a room with nobody of his side left in it — his room mates down, or gone to a fight elsewhere (`staged`: also a man
//     who was posted alone, once the floor has gone loud in his own ears) — and nobody of the team in his sight these `quiet` seconds, says so on their net
//     after his own beat — and not while his own room is being hit (`calm`): 'I'm on my own in here — somebody get to me!'. That is `g.say(…, radio)`, the line every other defender call is ('<callsign>
//     (radio): …' in the log): the player hears of a room held by one man.
//   THE ANSWER. The nearest FREE colleague by the way a man walks answers after a beat of his own ('on my way to you — hold on!') and comes: a man holding a
//     post with nobody in his sight, whom nobody else has (a squad about to give its word, a squad whose men stay in its rooms, the harder defenders' press,
//     the rescue's men with the hostages), inside `maxM` of path, on a way that does not pass where the team was last seen or heard (`clearM`). Who is free is
//     situation, not dice: a man alone himself may come (`loners`: the two pair up in the caller's room, and — `emptyRoom`, shipped on — so may a squad's last man in one of its
//     rooms or a man set on a door he has wedged: his room is left empty behind him), one of a room that keeps two men holding it behind him may come, one of a PAIR stays (`fromPair` off: he would
//     leave his own mate calling). Nobody free: the call stands `again` seconds and the first man to come free answers it.
//   THE WALK is pressure.ts's leg (`run`: a script with his own senses under it — roomfight.ts tickMove: an enemy seen close stops him to fight), his boots
//     filed for the team's ears (`boots`), run again in legs when the room fight's ten-second move plants him short. The caller down or gone before he is
//     there: 'he's not answering — going back!', and back to the post he left.
//   MEANWHILE the caller waits for him: he does not walk off to a fight next door by himself (roomfight.ts rally asks `buddyOwns`), nor does the pair for
//     `again` seconds after it is made. That is the stock rally only: his squad's word (enemysquads.ts) or a press (pressure.ts) still takes him, and the
//     man coming finds him where he stops, if there is still a way that is not past the team.
//   THERE he is the room fight's holder of that room ('with you — two on this room!'), told what the caller knows of its doors (the caller's evidence is his),
//     put on a door the caller is not watching.
//
// What the counts mean (`buddyStats`, tools/qa/playthrough.ts files them per run): `calls` = the line said · `answered` = a colleague set off · `arrived` =
// he planted in the caller's room with the caller up · `metOnWay` = the team stopped him first · `turnedBack` = the caller was down or gone before he got
// there · `diedOnWay` · `noOne` = a call nobody could answer inside `again` · `secs` / `metres` = call to arrival, and the way walked, summed over arrivals.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { RoomFight } from './roomfight';
import { run, boots, pressOwns } from './pressure';
import { squadOwns, squadStaysIn, squadDefers } from './enemysquads';
import { DIGIN, digInSet } from './digin';
import { lastStandMan } from './laststand';
import { simRandom } from '../math/dice';   // the simulation's die (math/dice.ts): the Game's own when it has one, Math.random otherwise

export const BUDDY = {
  /** the switch: off = none of this file runs. SHIPPED OFF, the maintainer's call: on, a scripted team keeps clearly MORE men on the compound and the barracks
   *  and somewhat more on the block (seeds the knobs never saw) — a man who answers a call holds a room where, left alone, he went to the fight. Numbers:
   *  rebuild/telegraphing/buddy.md */
  on: false,
  /** a man POSTED alone calls too, once a loud thing has reached his own ears inside `loudSecs` (false = only a man whose room mates are down or gone) */
  staged: false, loudSecs: 30,
  /** s alone before he calls · s since the team was last in his sight before he may (a man in a fight does not radio for company) */
  beat: [2, 4.5] as [number, number], quiet: 3,
  /** s since a loud thing last reached his ears from INSIDE his room or from one of its doors (inside `calmM` of it) before he may call: a room being hit is a
   *  fight to come to — the rally's business — not a man asking for company (0 = he calls whatever is at his door) */
  calm: 6, calmM: 4,
  /** the colleague's beat between the call and setting off */
  answer: [1, 2.5] as [number, number],
  /** the way he will walk at most (m) · he takes no way that passes this near where the team was last seen or heard (0 = any way) */
  maxM: 30, clearM: 3,
  /** who may answer: a man alone in his own room (the two pair up in the caller's) · one of a pair (he leaves his mate alone) — one of three or more always may */
  loners: true, fromPair: false,
  /** a squad's last man in one of its rooms, or a man set on a door he has wedged, may answer as well: his room is left empty behind him and the two hold the
   *  caller's (off = those two stay: on a squads level nearly every lone man is one, and 192 of 255 calls on the warehouse then went unanswered) */
  emptyRoom: true,
  /** s a call nobody could answer stands before he may call again · calls a man makes at most */
  again: 20, calls: 2,
};
export const BUDDY_DEFAULTS: typeof BUDDY = JSON.parse(JSON.stringify(BUDDY));
const LS = 'twopointsix.buddy';
/** the panel's four rows are kept per machine (a scenario pick is a page load); `?buddy` / `?nobuddy` set the switch for the visit */
const KEPT = ['on', 'staged', 'emptyRoom', 'calls'] as const;   // (the panel's rows)
export function saveBuddy() { try { const o: Record<string, boolean | number> = {}; for (const k of KEPT) if (BUDDY[k] !== BUDDY_DEFAULTS[k]) o[k] = BUDDY[k]; if (Object.keys(o).length) globalThis.localStorage?.setItem(LS, JSON.stringify(o)); else globalThis.localStorage?.removeItem(LS); } catch { /* no store */ } }
try { const o = JSON.parse(globalThis.localStorage?.getItem(LS) ?? 'null'); if (o) for (const k of KEPT) if (typeof o[k] === typeof BUDDY[k]) (BUDDY as Record<string, unknown>)[k] = o[k]; } catch { /* no store, or not ours */ }
try { const q = new URLSearchParams(location.search); if (q.has('buddy')) BUDDY.on = q.get('buddy') !== '0'; if (q.has('nobuddy')) BUDDY.on = false; } catch { /* no page (the harness) */ }

type Def = RoomFight['defs'][number];
type Room = NonNullable<Def['room']>;
interface Man { had: boolean; callAt: number; calledT: number; calls: number; open: boolean; lookT: number; /** when his last errand as somebody's buddy ended */ doneT: number; /** the pair just made stays put until then */ keepT: number }
interface Errand { caller: Def; buddy: Def; phase: 'beat' | 'run' | 'back'; goAt: number; spot: Vec3; home: Vec3; tries: number; stepT: number; t0: number; L: number }
const newStats = () => ({ calls: 0, answered: 0, arrived: 0, metOnWay: 0, turnedBack: 0, diedOnWay: 0, short: 0, noOne: 0, secs: 0, metres: 0 });
interface State { men: Map<Def, Man>; errands: Errand[]; stats: ReturnType<typeof newStats>; stale: boolean }
const STATES = new SideMap<Game, State>('buddy.STATES');
const stateOf = (g: Game): State => { let s = STATES.get(g); if (!s) { s = { men: new Map(), errands: [], stats: newStats(), stale: false }; STATES.set(g, s); } return s; };

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const pick = (r: [number, number]) => r[0] + simRandom() * (r[1] - r[0]);
const alive = (D: Def) => D.gd.state !== 'dead';
const note = (g: Game, F: RoomFight, gd: Guard, what: string) => { F.log.push({ t: g.time, who: gd.callsign, what: `[buddy] ${what}` }); if (F.log.length > 600) F.log.splice(0, 200); };
const cellOf = (g: Game, p: Vec3) => { const nav = g.col.nav; return nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell)); };
/** his own wits about him, and nobody else's man: alive, holding a post, not in Sam's arm, not blinded or reeling, not pinned to his room by a stager (the
 *  rescue's men with the hostages: their rally clock is parked at Infinity) */
const own = (g: Game, D: Def) => alive(D) && D.mode === 'hold' && !D.gd.held && g.time >= D.gd.dazzledUntil && g.time >= D.gd.staggerUntil && D.rallyAt !== Infinity;
/** the men of his side holding the room he holds, himself not counted (a man off on the fight AI's hunt has left it) */
const mates = (F: RoomFight, D: Def) => F.defs.filter(X => X !== D && alive(X) && X.mode !== 'free' && !!D.room && X.room === D.room);

/** where the team is, as far as the defenders know: where each living man of theirs last had one of it in his sight, or last heard a loud thing — these few
 *  seconds (enemysquads.ts's own rule for a way round). Never the team's true positions */
function teamKnown(g: Game, F: RoomFight): Vec3[] {
  const out: Vec3[] = [];
  for (const D of F.defs) {
    const gd = D.gd; if (!alive(D)) continue;
    if (g.time - gd.lastSeenT < 4 && gd.lastKnown && gd.lastKnown !== D.pt) out.push(gd.lastKnown);
    if (D.noiseAt && g.time - D.noiseT < 4) out.push(D.noiseAt);
  }
  return out;
}
/** a free spot of the caller's room a couple of strides from him, off its doorways */
function spotBy(g: Game, F: RoomFight, C: Def): Vec3 {
  const nav = g.col.nav, p0 = C.gd.char.pos, R = C.room as Room | null;
  for (const r of [1.8, 2.6, 1.2]) for (let a = 0; a < 8; a++) {
    const p: Vec3 = [p0[0] + Math.cos(a * Math.PI / 4) * r, 0, p0[2] + Math.sin(a * Math.PI / 4) * r];
    if (nav.isBlocked(p[0], p[2]) || (R && !R.cells.has(cellOf(g, p)))) continue;
    if (R && R.entries.some(e => flat(e.at, p) < 1.5)) continue;
    if (F.defs.some(X => alive(X) && flat(X.gd.char.pos, p) < 0.9)) continue;
    if (g.col.segmentBlocked([p0[0], 1.2, p0[2]], [p[0], 1.2, p[2]])) continue;   // (beside him: not the far side of a rack from him)
    return p;
  }
  return [p0[0], 0, p0[2]];
}
/** his way to `spot`: its length, or null — none, too long, or past where the team is known to be */
function wayTo(g: Game, D: Def, spot: Vec3, known: Vec3[]): number | null {
  const path = g.col.nav.findPath(D.gd.char.pos, spot); if (!path?.length || flat(path[path.length - 1], spot) > 0.8) return null;
  let L = 0, q: Vec3 = D.gd.char.pos, bad = false; const m = BUDDY.clearM;
  for (const w of path) {
    const d = flat(q, w), n = Math.max(1, Math.ceil(d / 0.5));
    if (m > 0) for (let i = 1; i <= n && !bad; i++) { const p: Vec3 = [q[0] + (w[0] - q[0]) * i / n, 0, q[2] + (w[2] - q[2]) * i / n]; if (known.some(f => flat(f, p) < m)) bad = true; }
    L += d; q = w;
  }
  return bad || L > BUDDY.maxM ? null : L;
}
/** may this man answer a call: his own man, nobody in his sight, on nobody else's errand (`mine` = the errand he is on his beat for), and not the one who
 *  would leave a mate alone — a room keeps two men FIRMLY holding it (not walking a leg, not about to go to somebody themselves) behind the one who goes */
function free(g: Game, F: RoomFight, st: State, X: Def, mine: Errand | null = null): boolean {
  const gd = X.gd;
  if (!own(g, X) || g.time - gd.lastSeenT < BUDDY.quiet || st.errands.some(e => e !== mine && (e.buddy === X || e.caller === X))) return false;
  if (g.time - (st.men.get(X)?.doneT ?? -100) < BUDDY.again) return false;   // (he has only just come to somebody: not off again on the next call)
  if (pressOwns(g, X) || squadStaysIn(g, gd) || squadDefers(g, gd) || lastStandMan(g, gd)) return false;   // (laststand.ts, default off: a man of the last stand answers nobody's call)
  const set = digInSet(g, gd);
  if (set && (DIGIN.stay || DIGIN.reachM > 0)) return false;                  // (digin.ts's own rules for who holds his room, when they are on, keep him)
  const all = mates(F, X), firm = all.filter(m => m.mode === 'hold' && !st.errands.some(e => e.buddy === m)).length;
  if (firm >= 2) return true;
  if (all.length) return BUDDY.fromPair && firm >= 1;
  return BUDDY.loners && (BUDDY.emptyRoom || (!squadOwns(g, gd) && !set));   // (alone himself: the two pair up in the caller's room; with `emptyRoom` off a squad's last man in a room does not leave it empty, nor does a man set on a wedged door)
}
/** the nearest free colleague with a way to the caller */
function answerer(g: Game, F: RoomFight, st: State, C: Def): { X: Def; spot: Vec3; L: number } | null {
  const spot = spotBy(g, F, C); let known: Vec3[] | null = null, best: { X: Def; spot: Vec3; L: number } | null = null;
  // (nearest by the crow first: a way is never shorter than that, so most men are ruled out without a path search)
  const near = F.defs.filter(X => X !== C && X.room !== C.room && alive(X)).map(X => ({ X, d: flat(X.gd.char.pos, spot) })).filter(c => c.d <= BUDDY.maxM).sort((a, b) => a.d - b.d);
  for (const { X, d } of near) {
    if (best && d >= best.L) break;
    if (!free(g, F, st, X)) continue;
    const L = wayTo(g, X, spot, known ??= teamKnown(g, F)); if (L === null || (best && L >= best.L)) continue;
    best = { X, spot, L };
  }
  return best;
}
function send(g: Game, F: RoomFight, st: State, C: Def, a: { X: Def; spot: Vec3; L: number }, t0: number) {
  const own0 = st.men.get(a.X); if (own0) { own0.open = false; own0.callAt = NaN; }   // (a man alone himself who answers: his own call is dropped — the two of them are the pair)
  st.errands.push({ caller: C, buddy: a.X, phase: 'beat', goAt: g.time + pick(BUDDY.answer), spot: a.spot, home: v3.copy(a.X.station), tries: 0, stepT: -100, t0, L: a.L });
  note(g, F, a.X.gd, `will answer ${C.gd.callsign} (${a.L.toFixed(1)} m)`);
}

/** a man holding a room by himself: after his beat, with nobody in his sight, he calls it */
function consider(g: Game, F: RoomFight, st: State, D: Def) {
  let M = st.men.get(D); if (!M) { M = { had: false, callAt: NaN, calledT: -100, calls: 0, open: false, lookT: 0, doneT: -100, keepT: -100 }; st.men.set(D, M); }
  const gd = D.gd;
  if (M.open && g.time - M.calledT > BUDDY.again) { M.open = false; M.callAt = NaN; st.stats.noOne++; note(g, F, gd, 'nobody could come'); }
  if (D.mode !== 'hold' || !D.room) { M.callAt = NaN; return; }   // (walking a leg of somebody's: a call he has made stands meanwhile)
  if (lastStandMan(g, gd)) { M.callAt = NaN; M.open = false; return; }   // (laststand.ts, default off: the last stand has its own radio check — he makes no buddy call)
  if (mates(F, D).length) { M.had = true; M.callAt = NaN; M.open = false; return; }
  if (st.errands.some(e => e.caller === D || e.buddy === D)) return;
  if (!own(g, D)) return;
  if (M.open) {   // his call stands: the first man to come free answers it
    if (g.time < M.lookT) return;
    M.lookT = g.time + 1;
    const a = answerer(g, F, st, D); if (a) { M.open = false; send(g, F, st, D, a, M.calledT); }
    return;
  }
  const roused = M.had || (BUDDY.staged && !!D.noiseAt && g.time - D.noiseT < BUDDY.loudSecs);
  if (!roused || M.calls >= BUDDY.calls || g.time - M.calledT < BUDDY.again) { M.callAt = NaN; return; }
  if (isNaN(M.callAt)) { M.callAt = g.time + pick(BUDDY.beat); return; }
  if (g.time < M.callAt || g.time - gd.lastSeenT < BUDDY.quiet) return;
  if (BUDDY.calm > 0 && D.noiseAt && g.time - D.noiseT < BUDDY.calm && (!D.noiseOut || D.room.entries.some(e => flat(e.at, D.noiseAt!) < BUDDY.calmM))) return;
  M.callAt = NaN; M.calledT = g.time; M.calls++; M.lookT = g.time + 1; st.stats.calls++;
  g.say(gd, M.calls > 1 ? 'still on my own in here — anybody!' : 'I\'m on my own in here — somebody get to me!', true);
  const a = answerer(g, F, st, D);
  note(g, F, gd, `alone in room ${D.room.id}: calls for a buddy${a ? '' : ' (nobody free)'}`);
  if (a) send(g, F, st, D, a, g.time); else M.open = true;
}

/** the colleague's errand, a frame of it; true = over */
function tickErrand(g: Game, F: RoomFight, st: State, e: Errand): boolean {
  const B = e.buddy, C = e.caller, gd = B.gd, S = st.stats;
  const there = () => !!B.room && B.room === C.room && C.mode === 'hold';
  const wanted = alive(C) && F.defs.includes(C) && C.mode !== 'free';   // the caller is still a man holding somewhere (he may have given ground: he is found where he now is)
  const reopen = () => { const M = st.men.get(C); if (M && wanted && !mates(F, C).length) { M.open = true; M.lookT = g.time + 1; } };   // the call stands for the next man (inside its own `again` seconds)
  if (!alive(B) || !F.defs.includes(B)) { if (e.phase === 'run') { S.diedOnWay++; note(g, F, gd, 'down on the way'); } if (e.phase !== 'back') reopen(); return true; }
  if (e.phase === 'beat') {
    if (g.time < e.goAt) return false;
    if (!wanted || mates(F, C).length || !free(g, F, st, B, e)) { reopen(); return true; }   // (he has his own trouble now, or somebody else's word)
    e.phase = 'run'; S.answered++;
    run(g, B, e.spot, null);
    g.say(gd, 'on my way to you — hold on!', true); note(g, F, gd, `sets off for ${C.gd.callsign}`);
    return false;
  }
  if (B.mode === 'move') {
    e.stepT = boots(g, gd, e.stepT);
    if (e.phase === 'run' && !wanted) {   // the man he was going to is down, or gone: back to the post he left
      e.phase = 'back'; e.tries = 0; S.turnedBack++;
      run(g, B, e.home, null);
      g.say(gd, 'he\'s not answering — going back!', true); note(g, F, gd, `${C.gd.callsign} is down or gone: back to his post`);
    }
    return false;
  }
  if (B.mode === 'free') return true;   // (somebody else has let him off on the fight AI's hunt: theirs)
  // planted (roomfight.ts tickMove): there, in contact on the way, or stopped short
  const contact = g.time - gd.lastSeenT < 2;
  if (e.phase === 'back') {
    if (!contact && flat(gd.char.pos, e.home) > 2 && ++e.tries < 3 && own(g, B)) { run(g, B, e.home, null); return false; }
    return true;
  }
  if (!wanted) { S.turnedBack++; note(g, F, gd, `${C.gd.callsign} is down or gone: holds where he stopped`); return true; }
  if (C.mode === 'move') return false;   // (the caller is on a leg of somebody's — his squad's word, a press, his own door to wedge: where he stops is where he is found)
  if (there()) {
    S.arrived++; S.secs += g.time - e.t0; S.metres += e.L;
    // what the caller knows of the room's doors is told him, and he takes one the caller is not on
    const R = B.room as Room, mine = C.watch >= 0 ? C.watch : nearestEntry(R, C.pt);
    B.ev = R.entries.map((_, i) => C.ev[i] ?? 0); B.watch = B.want = -1;
    let other = -1, bv = -1; R.entries.forEach((_, i) => { if (i !== mine && B.ev[i] > bv) { bv = B.ev[i]; other = i; } });
    const at = R.entries[other >= 0 ? other : mine]?.at; if (at) { B.home = v3.copy(at); B.pt[0] = at[0]; B.pt[1] = 0; B.pt[2] = at[2]; }
    for (const X of [B, C]) { const M = st.men.get(X); if (M) M.keepT = g.time + BUDDY.again; }
    g.say(gd, 'with you — two on this room!', true); note(g, F, gd, `with ${C.gd.callsign} in room ${R.id}, ${(g.time - e.t0).toFixed(1)} s after the call`);
    return true;
  }
  if (!contact && ++e.tries < 3 && own(g, B)) { const spot = spotBy(g, F, C); if (wayTo(g, B, spot, teamKnown(g, F)) !== null) { e.spot = spot; run(g, B, spot, null); return false; } }   // (the room fight's move is ten seconds long: a longer way is walked in legs — and to where the caller now is)
  if (contact) { S.metOnWay++; note(g, F, gd, 'met on the way: fights where he is'); } else { S.short++; note(g, F, gd, 'stopped short of him'); }
  return true;
}
function nearestEntry(R: Room, p: Vec3): number { let best = -1, bd = Infinity; R.entries.forEach((e, i) => { const d = flat(e.at, p); if (d < bd) { bd = d; best = i; } }); return best; }

/** roomfight.ts rally() asks: true = this man has a colleague on his way to him, or the two of them have only just paired up — he does not walk off to a
 *  fight next door by himself meanwhile (the man who asked for company waits for it). False on its first line with the switch off */
export function buddyOwns(g: Game, D: Def): boolean {
  if (!BUDDY.on) return false;
  const st = STATES.get(g); if (!st) return false;
  return g.time < (st.men.get(D)?.keepT ?? -100) || st.errands.some(e => e.caller === D);
}
/** once a frame from RoomFight.tick, after the defenders', the teammates' and the press's own ticks */
export function buddyTick(g: Game, F: RoomFight) {
  if (!BUDDY.on) return;
  const st = stateOf(g);
  if (st.stale) { st.stale = false; st.stats = newStats(); }
  for (const D of F.defs) if (alive(D)) consider(g, F, st, D);
  if (st.errands.length) st.errands = st.errands.filter(e => { const over = tickErrand(g, F, st, e); if (over && e.phase !== 'beat') { const M = st.men.get(e.buddy); if (M) M.doneT = g.time; } return !over; });
}
/** the fight is over (RoomFight.stop): every call forgotten. The counts stay for whoever reads them after the run; a new fight starts them again */
export function buddyStop(g: Game) { const st = STATES.get(g); if (!st) return; st.men.clear(); st.errands = []; st.stale = true; }
/** the counts of this run (tools/qa/playthrough.ts files them per run) */
export function buddyStats(g: Game): Record<string, number> { const s = STATES.get(g)?.stats ?? newStats(); return { ...s, secs: +s.secs.toFixed(1), metres: +s.metres.toFixed(1) }; }
export function buddySummary(g: Game): string {
  if (!BUDDY.on) return 'off';
  const st = STATES.get(g); if (!st) return 'on · nothing yet';
  const s = st.stats;
  return `${s.calls} call${s.calls === 1 ? '' : 's'} · ${s.answered} answered · ${s.arrived} arrived · ${st.errands.length} on the way`;
}
