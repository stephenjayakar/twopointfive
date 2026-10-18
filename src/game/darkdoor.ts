// NOT IN THERE ALONE — THE DARK DOORWAY (the maintainer, 10-13, of the morale work: "especially for stealth sections that aren't perfect ghost where enemies just
// don't [know] what's going on, more poorly trained ones could get really scared and refuse to go into dark rooms" — and "a lot of the value from this comes with
// good telegraphing": he SAYS it, then he DOES it, with a beat the player can act on).
//
//   · WHO BALKS: a GREEN man (greenMan: morale.ts trainingOf) who is ALARMED (suspicious, searching or alert: he knows something is
//     out there — a calm man on his own beat walks his dark rooms as he always has), who is ALONE (no living mate inside `pairM` with a line to him), who stands
//     in the LIGHT (his own place reads `darkAt` on the meter, or `litBy` brighter than the room ahead: a man already in the dark has no lit side of a door to
//     stop on — and in a blackout nobody balks at all), and whose walk's next doorway, inside `stopM` ahead, stands OPEN onto a room that is DARK (a shut leaf
//     he opens as he always did: he cannot know what is behind it — then he balks, and steps back). His own torch does not exempt him. A steady man, a man with
//     a mate at his shoulder, a lit room: all walk in exactly as they did. Never a choreographed man, a trained one (the response team), a man of the hostage
//     rescue's cast, a man morale.ts has in a sequence, a man in the standoff over a held colleague, a man on an errand he was SENT on (the breaker, a silent
//     colleague's route, a body he was called to). IN A FIGHT only a chase to a last-known fix is stopped: not a man with a sighting newer than `seenSecs`, not
//     a walk to cover, not a man closing on a foe who is down.
//   · THE DARK ROOM: the room on the far face of the doorway (cleared.ts's rooms: a flood from the door's floor; open floor is nobody's room and never counts),
//     `samples` of its floor cells read for the PLACE's steady light (calmtorch.ts placeLight: nothing anybody carries, no flash) — dark when `darkShare` of
//     them read under `darkAt` on the meter. Read once per `askSecs` a room, whoever asks; the readings ride a checkpoint.
//   · THE BALK: he stops a stride short of the frame (`standM`), off the middle of the doorway toward his own jamb (`sideM`) — not in the opening, with a view
//     through it — and SAYS it as he stops. With a mate to call the line IS the call: spoken if that man is inside `earM`, on the net with the handset's chirp
//     otherwise; the mate answers after `copySecs`. With nobody to call it is a different line, said to himself. Then he SWEEPS: his aim, and his light with it,
//     goes slowly across the opening and back (`sweepSecs` a pass) for as long as he waits. The mate is the free man of his side with the shortest WALK to him
//     inside `mateM` (of the `mateTry` nearest; asked again every `callSecs` while nobody is coming): he walks to him (the floor's own 'suspicious' walk to a
//     fix, the fix kept on the caller — what guards.ts sendCheckOn does to a man, less the errand). When that mate, or any man free to come, is inside `pairM`
//     with a line to him, the mate says so and they go in together: the first man's walk resumes and the mate's fix is the first man's goal for `withSecs`. A
//     mate who dies, is taken by something else, or covers no ground for `lagSecs` is dropped and the next man called.
//   · NEVER A SAFE ROOM FOR GOOD: nobody inside `waitSecs` and he says so and GIVES THE ROOM UP: every spot of his search in it is struck off, and the leg is
//     dropped by the walk's own rule for a leg that goes nowhere (a suspicion's fix is where he stands; a chase is dropped to a search of where he stands —
//     never with a foe in his eyes: the wait's clock stands while he has one). The `fedUpN`th time he is sent at that ROOM inside `fedUpSecs` he NERVES
//     HIMSELF: says it, stands `nerveSecs`, and goes in alone at `slowK` of his pace, light first. A door he has gone through, with a mate or alone, does not
//     stop him again for `againSecs`. An enemy seen INSIDE the room while he waits does not take him in: he fires from where he stands by the floor's own alert
//     rules, untouched.
//   · A man called, and a pair going in, are never balked: two men sent to look are not alone.
// SHOW, NOT TELL: nothing is drawn or written for the player but the men themselves. No die at all, no wall clock, no graphics setting: the light is the CPU's
// steady estimate (the same number on the page and in the harness); the clocks are seconds COUNTED and ride a checkpoint (darkDoorSnapshot / Restore).
// It only ever acts with MORALE.on as well. The switch is off in the module and on the frozen stand: every seam returns on its first line, no man is met.
// Nothing here touches health, aim, skill or a reaction beat.
// Type-only game imports but for the functions below, used inside calls only (src/game is one import cycle).
import { SideMap } from '../math/side';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { Character } from './character';
import { Vec3, v3, clamp, damp, approachAngle } from '../math/vec';
import { crossesDoor, frameOf, dropToSearch } from './guards';
import { placeLight, workLit } from './calmtorch';
import { hourOf } from './hours';
import { MORALE, moraleOwns, trainingOf } from './morale';
import { needsBusy } from './needs';
import { foeDown } from './teams';
import { w } from './words';
import { netFeedHolds } from './netquietfeed';   // (the leaf, not netquiet.ts: false on its first line with that rule off)

/** the switch and its numbers: off in the module, raised by the page (host/profile.ts pageSwitches; ?nodarkdoor = every man walks into the dark as he did) and by
 *  the shipped stand; the harness's frozen stand leaves it off (TPS_DARKDOOR=1 turns it on — with TPS_MORALE=1: it acts only under MORALE.on). `who` = who is
 *  green: 'rest' (morale.ts trainingOf: the knob, the squad's key, the difficulty's mix) · 'all' · 'none'. Metres, seconds and shares as the
 *  head of the file names them; `openRad` = how far a leaf must stand off its frame to be an open door, `armSecs` how long a shut door he
 *  reached in the light stays his to balk at once it opens; `keepAw` = the awareness a waiting man's suspicion is
 *  held at (it must not drain away under him at the frame); `keepSecs` = how long a balk outlasts his walk not asking (a reaction beat, a clear shot), and
 *  `resumeSecs` how long after that the same door takes the same wait up again without a word. UNTUNED by eye (nobody has seen it on a GPU, nobody has played it). */
export const DARKDOOR = { on: false, who: 'rest' as 'rest' | 'all' | 'none', stopM: 2.5, pairM: 4, darkAt: 0.2, darkShare: 0.7, litBy: 0.1, samples: 40, askSecs: 0.5, openRad: 0.35, armSecs: 3,
  standM: 1.3, sideM: 0.3, sweepSecs: 3.2, earM: 12, mateM: 40, mateTry: 3, callSecs: 2, copySecs: 1.2, lagSecs: 5, withSecs: 10, keepAw: 0.3, keepSecs: 2, resumeSecs: 12, seenSecs: 2,
  waitSecs: 20, againSecs: 45, fedUpSecs: 300, fedUpN: 2, nerveSecs: 1.5, slowK: 0.5 };
export const DARKDOOR_STATS = { balks: 0, calls: 0, pairs: 0, quits: 0, solos: 0, drops: 0, asks: 0 };

/** what the rule has a man doing: nothing · stopped at a frame · going in alone, slowly · called, walking to the man who balked · going in with him */
export type DarkDoorAct = 'none' | 'balk' | 'solo' | 'come' | 'with';
const ACTS: DarkDoorAct[] = ['none', 'balk', 'solo', 'come', 'with'];
/** per man. The act and its seconds `t` (a balk's: seconds WAITED); the door (its index in the level's list), the
 *  face he is on and where he stands by it (`at`: he is there); the other man of the pair (the mate he called / the man who called him). A balker's: has the
 *  call been said, seconds since he last looked for a man to call, the men dropped on the way to him, when the balk was last let go unresolved (`left`). A
 *  shut door he is opening onto a dark room, noted while he still stood in the light, and when (`armed`, `armT`: he is owed the balk when it stands open). A
 *  mate's: has he answered, the place he last made half a metre of ground from (`spot`) and the seconds since (`lag`). The rooms he gave up and when; the doors that will not
 *  stop him and until when; lines said (deals the next); seconds since his walk last had the gate hold him, and since he last asked the room and for a mate. */
interface Fear { act: DarkDoorAct; t: number; door: number; side: 1 | -1; spot: Vec3 | null; at: boolean; other: Guard | null;
  called: boolean; callT: number; tried: Guard[]; left: number; told: boolean; lag: number;
  armed: number; armT: number; quits: { room: number; t: number }[]; pass: { door: number; until: number }[]; said: number; idle: number; ask: number; }
const stateOf = new SideMap<Guard, Fear>('darkdoor.stateOf');
interface Read { t: number; dark: boolean; share: number; mean: number }
/** a room's reading, kept `askSecs`: by game and room number */
const readsOf = new SideMap<Game, Map<number, Read>>('darkdoor.readsOf');
/** a level's rooms as floor cells to read, dealt once a nav grid: room number → cell centres (x, z pairs) */
const cellsOf = new SideMap<object, Map<number, number[]>>('darkdoor.cellsOf');

/** THE LINES (placeholders in the register the advisor's round set — the writing pass is the maintainer's). `say` = the lines that name nobody; `he` / `they`
 *  as morale.ts has them (words.ts: a scenario's defender under the pass is up against a team). call: as he stops, to the mate he calls. self: as he stops,
 *  nobody to call. copy: the mate, setting off. with: the mate, at his shoulder. nobody: the wait is over and no one came. alone: sent at the room he gave
 *  up — said, then he goes in. */
type LineKind = 'call' | 'self' | 'copy' | 'with' | 'nobody' | 'alone';
const LINES: Record<LineKind, { say: string[]; he?: string[]; they?: string[] }> = {
  call: { say: ['I\'m not going in there alone. get up here.', 'not in there. not on my own — get up here!'], he: ['he could be anywhere in that. somebody get up here.'], they: ['they could be anywhere in that. somebody get up here.'] },
  self: { say: ['no. not in there. not on my own.', 'pitch black. no. not alone.', 'not a chance. not by myself.'] },
  copy: { say: ['copy. coming.', 'on my way. stay put.', 'hold there — coming to you.'] },
  with: { say: ['on you. get a light in there.', 'I\'m here. lights on — go.', 'right behind you. go on.'] },
  nobody: { say: ['nobody\'s coming.', 'no one. all right — leave it.', 'nobody. forget that room.'] },
  alone: { say: ['fine. fine — I\'ll do it myself.', 'nobody ever comes. going in.', 'all right. slow. going in.'] },
};
/** this file's lines — every kind's, or one kind's (the check: a line said came from the right pool; the words lint's bubble length and blocklist) */
export function darkDoorLines(kind?: LineKind): string[] { return (kind ? [LINES[kind]] : Object.values(LINES)).flatMap(l => [...l.say, ...(l.he ?? []), ...(l.they ?? [])]); }
/** one line of a kind from this man, the next of its pool by his own count (no die) — spoken, or on the net with the handset's chirp */
function bark(g: Game, gd: Guard, S: Fear, kind: LineKind, radio: boolean) {
  const L = LINES[kind], pool = [...L.say, ...((gd.team !== 'guard' ? w(L.they, L.he) : L.he) ?? [])];   // (words.ts: 'they' is a scenario's defender under the pass — off, every man's intruder is 'he')
  g.say(gd, pool[(gd.char.id + S.said++) % pool.length], radio);
  if (radio) g.audio.play('radio', headOf(gd.char), 0.5, { rate: 1.05 });
}

const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const chestOf = (c: Character): Vec3 => c.bones.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
const headOf = (c: Character): Vec3 => c.bones.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]];
/** a man this file is about at all: a living defender or a man of the night staff — never a civilian, an operative, a body, a man in Sam's arm */
const ours = (gd: Guard) => gd.state !== 'dead' && !gd.civ && !gd.held && (gd.team === 'hostile' || gd.team === 'guard');
const rescued = (g: Game, gd: Guard) => !!g.rescue?.active && g.rescue.hostiles.includes(gd);
const alarmed = (gd: Guard) => gd.state === 'suspicious' || gd.state === 'search' || gd.state === 'alert';
/** nobody's but his own: no choreography, no order to stand, no standoff, no errand, no body, not morale.ts's, not the rescue's */
const own = (g: Game, gd: Guard) => !gd.script && !gd.hold && !gd.pinned && !gd.standoff && !gd.task && !gd.bodyDuty && !rescued(g, gd) && !moraleOwns(gd) && !netFeedHolds(gd);   // (…nor the last man at his act, netquiet.ts: his hold wins — never stopped at a doorway, never called to one)
/** may the rule have him at all this frame: the AI on, no show on the floor, alarmed, his own man, not a trained one */
function able(g: Game, gd: Guard): boolean {
  if (!g.aiEnabled || g.touring || g.quietUtility || !ours(gd) || !alarmed(gd)) return false;
  return !gd.trained && own(g, gd);
}
/** IN A FIGHT: what his walk this frame is. 'chase' = to his last-known fix with no sighting inside `seenSecs` (the one walk a balk may BEGIN on); 'seen' = he
 *  has a sighting that new (a balk already his holds him at the frame; none begins); 'other' = to cover, to a role, on a foe who is down: never this file's. */
function fightWalk(g: Game, gd: Guard): 'chase' | 'seen' | 'other' {
  if (foeDown(g, gd)) return 'other';
  if (g.time - gd.lastSeenT < DARKDOOR.seenSecs) return 'seen';
  return gd.pathGoal && gd.lastKnown && flat(gd.pathGoal, gd.lastKnown) < 0.8 ? 'chase' : 'other';
}
/** free to come to a mate, or to go in with one: his own man, calm or merely suspicious, not following a leader, holding a post or off on a need of his own,
 *  in no act of this file's */
function canCome(g: Game, o: Guard): boolean {
  if (!ours(o) || (o.state !== 'patrol' && o.state !== 'suspicious') || !own(g, o) || o.leader || o.post || needsBusy(o)) return false;
  const So = stateOf.get(o); return !So || So.act === 'none';
}
function mind(gd: Guard): Fear {
  let S = stateOf.get(gd);
  if (!S) stateOf.set(gd, S = { act: 'none', t: 0, door: -1, side: 1, spot: null, at: false, other: null, called: false, callT: 0, tried: [], left: -1e9, told: false, lag: 0, armed: -1, armT: -1e9, quits: [], pass: [], said: 0, idle: 0, ask: 0 });
  return S;
}
/** IS HE GREEN — morale.ts's own answer (trainingOf: the knob, the squad's key, the difficulty's mix), asked fresh each time and kept nowhere here. `who`
 *  'all' / 'none' overrides. With MORALE.training 'none' (a recording from before a man was green or steady) trainingOf calls every man steady: nobody balks. */
function greenMan(g: Game, gd: Guard): boolean {
  if (DARKDOOR.who !== 'rest') return DARKDOOR.who === 'all';
  return trainingOf(g, gd) === 'green';
}
/** the nearest living man of his side inside `pairM` with nothing solid between his eyes and that man's chest (`fit`: of those the test passes) */
function mateBy(g: Game, gd: Guard, fit?: (o: Guard) => boolean): Guard | null {
  const c = gd.char, eye = headOf(c); let best: Guard | null = null, bd = DARKDOOR.pairM;
  for (const o of g.guards) { if (o === gd || !ours(o) || o.team !== gd.team || (fit && !fit(o))) continue;
    const d = flat(o.char.pos, c.pos); if (d <= bd && !g.col.segmentBlocked(eye, chestOf(o.char))) { bd = d; best = o; } }
  return best;
}
/** the man to call: of the `mateTry` nearest men of his side free to come and not yet dropped, the one with the shortest WALK to him inside `mateM` */
function freeMate(g: Game, gd: Guard, S: Fear): Guard | null {
  const K = DARKDOOR, p = gd.char.pos;
  const near = g.guards.filter(o => o !== gd && o.team === gd.team && canCome(g, o) && !S.tried.includes(o) && flat(o.char.pos, p) <= K.mateM).sort((a, b) => flat(a.char.pos, p) - flat(b.char.pos, p)).slice(0, Math.max(1, Math.round(K.mateTry)));
  let best: Guard | null = null, bl = K.mateM;
  for (const o of near) { const path = g.col.nav.findPath(o.char.pos, p); if (!path) continue;
    let l = 0, a = o.char.pos; for (const b of path) { l += flat(a, b); a = b; }
    if (l <= bl) { bl = l; best = o; } }
  return best;
}

/** the level's rooms as lists of floor cells (cleared.ts's flood, asked cell by cell once a nav grid) */
function roomCells(g: Game, room: number): number[] {
  const nav = g.col.nav; let M = cellsOf.get(nav);
  if (!M) { cellsOf.set(nav, M = new Map());
    for (let z = 0; z < nav.H; z++) for (let x = 0; x < nav.W; x++) { const px = (x + 0.5) * nav.cell, pz = (z + 0.5) * nav.cell, r = g.cleared.roomAt([px, 0, pz]); if (!r) continue;
      let L = M.get(r); if (!L) M.set(r, L = []); L.push(px, pz); } }
  return M.get(room) ?? [];
}
/** IS THE ROOM DARK — the one place this file reads a room's light: `samples` of its floor cells, evenly through its list, each the place's own steady light
 *  on the meter's scale (calmtorch.ts placeLight: lightEstimateAt with every carried lamp and every transient light left out); dark = `darkShare` of them
 *  under `darkAt`; `mean` = their mean. By day a cell under the bar that the hour's daylight reaches (calmtorch.ts workLit: the estimate has no sun in it) is
 *  not dark: it counts at the bar. Kept `askSecs`. Open floor (room 0) is never dark. */
export function darkRoom(g: Game, room: number): Readonly<Read> {
  const K = DARKDOOR; if (!room) return { t: g.time, dark: false, share: 0, mean: 1 };
  let R = readsOf.get(g); if (!R) readsOf.set(g, R = new Map());
  const was = R.get(room); if (was && g.time >= was.t && g.time - was.t < K.askSecs) return was;
  const L = roomCells(g, room), n = L.length / 2, take = Math.max(1, Math.min(n, Math.round(K.samples))), day = hourOf(g) !== 'night'; let under = 0, sum = 0;
  for (let i = 0; i < take && n > 0; i++) { const j = Math.min(n - 1, Math.floor((i + 0.5) * n / take)), x = L[j * 2], z = L[j * 2 + 1]; let v = placeLight(g, x, z);
    if (v < K.darkAt && day && workLit(g, x, z, K.darkAt)) v = K.darkAt; sum += v; if (v < K.darkAt) under++; }
  const share = n > 0 ? under / take : 0, now = { t: g.time, dark: n > 0 && share >= K.darkShare, share, mean: n > 0 ? sum / take : 1 };
  R.set(room, now); DARKDOOR_STATS.asks++;
  return now;
}
/** does he stand in the light, against the room ahead: his own place lit on the meter (by day, daylit), or `litBy` brighter than that room's floor */
function standsLit(g: Game, gd: Guard, R: Readonly<Read>): boolean {
  const K = DARKDOOR, p = gd.char.pos, here = placeLight(g, p[0], p[2]);
  return here >= K.darkAt || here >= R.mean + K.litBy || (hourOf(g) !== 'night' && workLit(g, p[0], p[2], K.darkAt));
}
/** an open doorway: the leaf off its hinges, or standing `openRad` off its frame */
const open = (d: Door) => d.off || (!d.latched && Math.abs(d.angle) >= DARKDOOR.openRad);
/** the next doorway on his walk inside `reach` metres of path: the door, the face he is on, where his path cuts the frame, how far along the path that is */
function doorAhead(g: Game, gd: Guard, reach: number): { d: Door; side: 1 | -1; at: Vec3; dist: number } | null {
  let run = 0, a = gd.char.pos;
  for (let i = gd.pathI; i < gd.path.length && run < reach; i++) { const b = gd.path[i];
    let hit: { d: Door; t: number; side: 1 | -1; at: Vec3 } | null = null;
    for (const d of g.doors.list) { const x = crossesDoor(a, b, d); if (x && (!hit || x.t < hit.t)) hit = { d, ...x }; }
    if (hit) { const dist = run + flat(a, hit.at); return dist <= reach ? { d: hit.d, side: hit.side, at: hit.at, dist } : null; }
    run += flat(a, b); a = b; }
  return null;
}
/** where he waits: `standM` short of the frame on his face of it, `sideM` off the middle of the opening toward the jamb nearer him (the other one failing
 *  that, then a step further back) — floor that is free, with nothing solid between him and it; null = nowhere but where he stands */
function standSpot(g: Game, gd: Guard, d: Door, side: 1 | -1): Vec3 | null {
  const K = DARKDOOR, F = frameOf(d), p = gd.char.pos, along = (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz, s = along <= F.W / 2 ? -1 : 1;
  for (const off of [K.standM, K.standM + 0.5]) for (const a of [F.W / 2 + s * K.sideM, F.W / 2 - s * K.sideM]) {
    const x = F.hx + F.ux * a + F.nx * side * off, z = F.hz + F.uz * a + F.nz * side * off;
    if (g.col.nav.isBlocked(x, z) || g.col.solidBlocked([p[0], 0.45, p[2]], [x, 0.45, z])) continue;
    if (g.guards.some(o => o !== gd && o.state !== 'dead' && flat(o.char.pos, [x, 0, z]) < 0.6)) continue;
    return [x, 0, z]; }
  return null;
}
const passes = (S: Fear, door: number, t: number) => S.pass.some(p => p.door === door && t < p.until);
function pass(g: Game, S: Fear, door: number) { S.pass = S.pass.filter(p => p.door !== door && g.time < p.until); S.pass.push({ door, until: g.time + DARKDOOR.againSecs }); }
/** a mate is let go where he is (his suspicion wears off on its own) */
function drop(M: Fear) { M.act = 'none'; M.t = 0; M.other = null; M.told = false; M.spot = null; M.lag = 0; }
/** the act is over: he is his own man again, and a mate still on his way to him with him. `unresolved`: nothing came of it — the same door inside
 *  `resumeSecs` takes the same wait up again */
function end(g: Game, S: Fear, unresolved = false) {
  const o = S.other, So = o ? stateOf.get(o) : null;
  if (o && So && So.other && stateOf.get(So.other) === S && So.act === 'come') drop(So);
  S.left = unresolved && S.act === 'balk' ? g.time : -1e9;
  S.act = 'none'; S.spot = null; S.at = false; S.other = null; if (!unresolved) { S.t = 0; S.called = false; S.tried = []; }
}
/** a mate is told to come: the floor's own walk to a fix, the fix on the man who called (what guards.ts sendCheckOn does to a man, less the errand). The line
 *  is the call — spoken if he is in earshot, on the net otherwise */
function call(g: Game, gd: Guard, S: Fear, m: Guard) {
  const M = mind(m); M.act = 'come'; M.t = 0; M.other = gd; M.told = false; M.spot = v3.copy(m.char.pos); M.lag = 0; S.other = m; DARKDOOR_STATS.calls++;
  m.lastKnown = v3.copy(gd.char.pos); m.awareness = Math.max(m.awareness, 0.42);
  if (m.state !== 'suspicious') { m.state = 'suspicious'; m.reactT = 0.8; m.searchPlan = null; m.pieing = null; }
  m.searchT = 0; m.path = []; m.pathGoal = null; m.stallRef = null;
  if (!S.called) { S.called = true; bark(g, gd, S, 'call', flat(m.char.pos, gd.char.pos) > DARKDOOR.earM); }
}

/** THE WALK'S SEAM (guards.ts followPath, beside the other gates): the pace he walks at this frame (≤ `speed`), or null — this file has his feet (he is stepping
 *  to, or standing at, his place by a dark doorway). `speed` back at once with either switch off, and for every man who is not alarmed. */
export function darkDoorGate(g: Game, gd: Guard, dt: number, speed: number): number | null {
  const K = DARKDOOR; if (!K.on || !MORALE.on) return speed;
  const S0 = stateOf.get(gd);
  if (S0 && (S0.act === 'come' || S0.act === 'with')) return speed;   // a man called, a pair going in: never balked
  if (!able(g, gd)) return speed;   // (a balk of his outlasts this by `keepSecs`: the tick lets it go)
  const X = S0 && S0.act === 'balk' ? null : doorAhead(g, gd, K.stopM), di = X ? g.doors.list.indexOf(X.d) : -1;
  if (S0 && S0.act === 'solo') {   // nerved: the beat at the frame, then in — slowly, until the frame is behind him
    if (!X || di !== S0.door) { pass(g, S0, S0.door); end(g, S0); return speed; }
    S0.idle = 0; if (gd.state === 'suspicious') gd.awareness = Math.max(gd.awareness, K.keepAw);   // (he does not talk himself calm a stride short of the frame)
    S0.t += dt; if (S0.t >= K.nerveSecs) return speed * K.slowK;
    gd.speed = damp(gd.speed, 0, 8, dt); gd.char.vel = [0, 0, 0]; gd.stallRef = null; gd.alertStallT = 0; gd.chaseT = 0; return null;
  }
  const fight = gd.state === 'alert' ? fightWalk(g, gd) : 'chase';
  if (fight === 'other') return speed;
  if (S0 && S0.act === 'balk') return hold(g, gd, S0, dt, speed, fight === 'seen');
  if (!X || fight === 'seen' || g.blackout.active || (S0 && passes(S0, di, g.time))) return speed;
  const room = g.cleared.roomBy(X.d, -X.side as 1 | -1); if (!room || room === g.cleared.roomAt(gd.char.pos)) return speed;
  if (!greenMan(g, gd) || mateBy(g, gd)) return speed;
  const R = darkRoom(g, room); if (!R.dark) return speed;
  if (!open(X.d)) { if (standsLit(g, gd, R)) { const A = mind(gd); A.armed = di; A.armT = g.time; } return speed; }   // a shut leaf: he opens it as he always did — he cannot know what is behind it — and is owed the balk once it stands open
  if (!(S0 && S0.armed === di && g.time - S0.armT < K.armSecs) && !standsLit(g, gd, R)) return speed;
  const S = mind(gd), again = S.door === di && g.time - S.left < K.resumeSecs;   // (the same wait, let go a moment ago for want of his walk asking: taken up where it stood, without a word)
  S.quits = S.quits.filter(q => g.time - q.t < K.fedUpSecs);
  S.door = di; S.side = X.side; S.idle = 0; S.ask = 0; S.callT = 0; S.other = null; S.left = -1e9; S.armed = -1;
  if (!again) { S.t = 0; S.called = false; S.tried = []; DARKDOOR_STATS.balks++; }
  if (!again && S.quits.filter(q => q.room === room).length >= K.fedUpN - 1) { S.act = 'solo'; bark(g, gd, S, 'alone', false); DARKDOOR_STATS.solos++; return darkDoorGate(g, gd, 0, speed); }
  S.act = 'balk'; S.spot = standSpot(g, gd, X.d, X.side); S.at = !S.spot;
  if (!again) {   // say, then do: the line as he stops — the call to the man who can come, or a word to himself
    const m = freeMate(g, gd, S); if (m) call(g, gd, S, m); else bark(g, gd, S, 'self', false);
  }
  return hold(g, gd, S, 0, speed, false);
}
/** one frame at the frame: is the wait over (his walk no longer wants this door, the room is lit, a mate is here, nobody came), else his feet. `seen` = he has
 *  a foe in his eyes: the wait's clock stands, and nothing here ends his fight */
function hold(g: Game, gd: Guard, S: Fear, dt: number, speed: number, seen: boolean): number | null {
  const K = DARKDOOR, c = gd.char, d = g.doors.list[S.door];
  const X = d ? doorAhead(g, gd, K.stopM + 4) : null;
  if (!d || !X || X.d !== d || X.side !== S.side) return speed;   // (re-planned some other way: no longer this door's — the tick lets the balk go once nothing asks)
  const room = g.cleared.roomBy(d, -S.side as 1 | -1);
  S.idle = 0; if (!seen) S.t += dt; S.ask += dt; S.callT += dt;
  if (S.ask >= K.askSecs) { S.ask = 0;
    if (g.blackout.active || !darkRoom(g, room).dark) { end(g, S); return speed; }   // somebody found the switch — or the mains went, and every room is the same dark
    const m = mateBy(g, gd, o => o === S.other || canCome(g, o));
    if (m) {   // a man at his shoulder who can come: he says so, and they go in together — the mate's fix is this man's goal from here
      const M = mind(m); if (S.other && S.other !== m) { const So = stateOf.get(S.other); if (So && So.other === gd) drop(So); }
      M.act = 'with'; M.t = 0; M.other = gd; M.spot = v3.copy(m.char.pos); M.lag = 0; bark(g, m, M, 'with', false);
      pass(g, S, S.door); S.act = 'none'; S.t = 0; S.spot = null; S.at = false; S.other = m; S.called = false; S.tried = []; DARKDOOR_STATS.pairs++;
      return speed;
    }
  }
  if (!S.other && S.callT >= K.callSecs && S.t < K.waitSecs) { S.callT = 0; const f = freeMate(g, gd, S); if (f) call(g, gd, S, f); }   // (nobody was free when he stopped, or his man was dropped: the next who is, comes)
  if (S.t >= K.waitSecs) {   // nobody came: said, the room given up — its spots struck off his search, the leg dropped by its own walk's rule for a leg that goes nowhere
    bark(g, gd, S, 'nobody', false); S.quits.push({ room, t: g.time }); end(g, S); DARKDOOR_STATS.quits++;
    if (gd.searchPlan) for (const s of gd.searchPlan.spots) if (g.cleared.roomAt(s.pos) === room) { s.unreachable = true; s.by = c.id; }
    if (gd.state === 'alert') { dropToSearch(g, gd, null); gd.lastKnown = v3.copy(c.pos); }
    else { gd.stallRef = v3.copy(c.pos); gd.stallT = 1e3; }   // (guards.ts notGettingAnywhere, asked by his walk's owner this very frame: the spot is as looked-at as it will get / his fix is where he stands)
    gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; return null;
  }
  // his feet: to his place a stride short of the frame, then still — squared to the opening. His clocks for a leg going nowhere stand (he is standing on purpose).
  gd.stallRef = null; gd.alertStallT = 0; gd.chaseT = 0;
  if (gd.state === 'suspicious') gd.awareness = Math.max(gd.awareness, K.keepAw); else if (gd.state === 'search') gd.searchT = Math.max(0, gd.searchT - dt);
  const to = S.spot, dS = to ? flat(c.pos, to) : 0, face = v3.yawTo(c.pos, d.frameCentre);
  if (to && !S.at && dS > 0.15 && S.t < 4) {   // (stepping back from a leaf he has just opened he keeps his chest on it: he walks to the place only from further off)
    const yaw = v3.yawTo(c.pos, to), back = dS < 1.6 && Math.cos(yaw - face) < 0.3; c.bodyYaw = approachAngle(c.bodyYaw, back ? face : yaw, 5.5 * dt);
    gd.speed = damp(gd.speed, Math.min(speed, g.tune.guardInvestigate) * clamp(dS / 0.8, 0.35, 1) * (back ? 0.6 : clamp(Math.cos(yaw - c.bodyYaw) * 1.5, 0.15, 1)), 4, dt);
    c.vel = [Math.sin(yaw) * gd.speed, 0, Math.cos(yaw) * gd.speed]; c.pos = v3.mad(c.pos, c.vel, dt);
  } else { S.at = true; gd.speed = damp(gd.speed, 0, 8, dt); c.vel = [0, 0, 0]; c.bodyYaw = approachAngle(c.bodyYaw, face, 3 * dt); }
  return null;
}

/** THE EYES' SEAM (guards.ts updateGuard, beside tactics.ts's look): where his aim — and his light with it — goes this frame, null = his own. Stopped at the
 *  frame it sweeps the opening from jamb to jamb and back; going in alone it is held on the middle of the opening, ahead of his feet. */
export function darkDoorLook(g: Game, gd: Guard): Vec3 | null {
  if (!DARKDOOR.on || !MORALE.on) return null;
  const S = stateOf.get(gd); if (!S || (S.act !== 'balk' && S.act !== 'solo') || netFeedHolds(gd)) return null;
  const d = g.doors.list[S.door]; if (!d) return null;
  const K = DARKDOOR, F = frameOf(d), a = S.act === 'solo' ? F.W / 2 : F.W * (0.5 - 0.5 * Math.cos(S.t * Math.PI / Math.max(0.2, K.sweepSecs)));
  return [F.hx + F.ux * a, 1.1, F.hz + F.uz * a];
}

/** ONCE A FRAME (game.ts update, after morale.ts's tick and before anybody moves): every man of ours is met; the men called and the men
 *  going in with somebody are kept on their man, or dropped; a stopped man whose walk has not asked the gate for `keepSecs` is let go. A return on its first
 *  line with either switch off. */
export function darkDoorTick(g: Game, dt: number) {
  if (!DARKDOOR.on || !MORALE.on) return;
  const K = DARKDOOR;
  for (const gd of g.guards) {
    if (!ours(gd)) { const S = stateOf.get(gd); if (S && S.act !== 'none') { if (S.act === 'come' || S.act === 'with') lose(gd, S); else end(g, S); } continue; }
    const S = mind(gd);
    if (S.act === 'none') continue;
    if (!g.aiEnabled) { if (S.act === 'come' || S.act === 'with') lose(gd, S); else end(g, S); continue; }
    if (S.act === 'balk' || S.act === 'solo') { S.idle += dt; if (S.idle > K.keepSecs || netFeedHolds(gd)) end(g, S, true); continue; }   // (calmed, taken by another script, turned to a fight for good: nothing of this file's holds him)
    const o = S.other, So = o ? stateOf.get(o) : null; S.t += dt;
    const goal = !o ? null : S.act === 'come' ? o.char.pos : o.pathGoal ?? o.lastKnown ?? o.char.pos, dG = goal ? flat(gd.char.pos, goal) : 0;
    if (!S.spot || flat(gd.char.pos, S.spot) > 0.5) { S.spot = v3.copy(gd.char.pos); S.lag = 0; } else S.lag += dt;
    if (!o || !goal || !ours(o) || gd.state === 'alert' || gd.state === 'search' || !own(g, gd) || S.lag > K.lagSecs) { lose(gd, S); continue; }   // taken by a fight, an order, an errand — or covering no ground
    if (S.act === 'come') {   // on his way to the man who called: his fix is that man, his suspicion does not wear off under him, and he answers once
      if (!So || So.act !== 'balk' || So.other !== gd) { drop(S); continue; }
      if (!S.told && S.t >= K.copySecs) { S.told = true; bark(g, gd, S, 'copy', dG > K.earM); }
    } else if (S.t >= K.withSecs || !alarmed(o) || dG < 1.5) { drop(S); continue; }   // going in with him: his fix is where that man is going, for `withSecs` or until he is there
    if (!gd.lastKnown || flat(gd.lastKnown, goal) > 0.5) gd.lastKnown = v3.copy(goal);
    if (gd.state !== 'suspicious') { gd.state = 'suspicious'; gd.searchPlan = null; gd.pieing = null; gd.path = []; gd.pathGoal = null; }
    gd.awareness = Math.max(gd.awareness, 0.42); gd.searchT = 0;
  }
}
/** a mate is lost on the way (dead, taken, stuck): dropped, and the man who called him will not call him again for this wait — he calls the next */
function lose(gd: Guard, S: Fear) {
  const o = S.other, So = o ? stateOf.get(o) : null;
  if (So && So.other === gd) { So.other = null; if (So.act === 'balk' && S.act === 'come') { So.tried.push(gd); So.callT = DARKDOOR.callSecs; } }
  drop(S); DARKDOOR_STATS.drops++;
}
/** QA: what the rule has of a man (null = never met) */
export function darkDoorOf(gd: Guard): Readonly<Fear> | null { return stateOf.get(gd) ?? null; }
/** QA: is he green as the rule deals it */
export function darkDoorGreen(g: Game, gd: Guard): boolean { return greenMan(g, gd); }
/** 'dark door ▸ Novak balk 6.2 s at breakroom_w (Reyes coming) · Reyes come' — every man the rule has; '' with either switch off */
export function darkDoorSummary(g: Game): string {
  if (!DARKDOOR.on || !MORALE.on) return '';
  const men = g.guards.filter(gd => { const S = stateOf.get(gd); return !!S && S.act !== 'none'; }).map(gd => { const S = stateOf.get(gd)!, d = g.doors.list[S.door];
    return `${gd.callsign} ${S.act}${S.act === 'balk' || S.act === 'solo' ? ` ${S.t.toFixed(1)} s at ${d?.def.name ?? '?'}` : ''}${S.other ? ` (${S.act === 'balk' ? `${S.other.callsign} coming` : `with ${S.other.callsign}`})` : ''}`; });
  return 'dark door ▸ ' + (men.join(' · ') || 'nobody stopped');
}

// ---------------------------------------------------------------- checkpoints (game/savestate.ts): each man by roster index — green or not, his act, door, place
// and clocks, the rooms he gave up, the doors open to him, the men he dropped — the rooms' readings still in hand (a file from before morale.ts's training carries a green flag a man and a `dealt` count: read past, never kept)
export interface DarkDoorSnap { men: (number[] | null)[]; quits: (number[] | null)[]; pass: (number[] | null)[]; tried: (number[] | null)[]; reads: number[][]; dealt?: number }
/** nothing (no key in the file) with either switch off or before the rule has met anybody */
export function darkDoorSnapshot(g: Game): DarkDoorSnap | undefined {
  if (!DARKDOOR.on || !MORALE.on) return undefined;
  const of = (gd: Guard) => stateOf.get(gd); if (!g.guards.some(gd => of(gd))) return undefined;
  const fin = (x: number, d: number) => Number.isFinite(x) ? x : d;
  return { men: g.guards.map(gd => { const S = of(gd); return S ? [-1, ACTS.indexOf(S.act), S.t, S.door, S.side, S.spot ? S.spot[0] : NaN, S.spot ? S.spot[2] : NaN, S.at ? 1 : 0, S.other ? g.guards.indexOf(S.other) : -1,
      S.called ? 1 : 0, S.callT, fin(S.left, -1e9), S.told ? 1 : 0, S.lag, S.said, S.idle, S.ask, S.armed, fin(S.armT, -1e9)] : null; }),
    quits: g.guards.map(gd => { const S = of(gd); return S ? S.quits.flatMap(q => [q.room, q.t]) : null; }), pass: g.guards.map(gd => { const S = of(gd); return S ? S.pass.flatMap(p => [p.door, p.until]) : null; }),
    tried: g.guards.map(gd => { const S = of(gd); return S ? S.tried.map(o => g.guards.indexOf(o)) : null; }),
    reads: [...(readsOf.get(g) ?? [])].map(([room, r]) => [room, r.t, r.dark ? 1 : 0, r.share, r.mean]) };
}
/** …onto the fresh roster (a file without the slice: every man is met afresh — dealt on the first tick, nobody stopped, no room read) */
export function darkDoorRestore(g: Game, s: DarkDoorSnap | null | undefined) {
  const f = (x: unknown, d = 0) => typeof x === 'number' && Number.isFinite(x) ? x : d;
  const R = new Map<number, Read>(); for (const r of s?.reads ?? []) R.set(f(r[0]), { t: f(r[1]), dark: !!r[2], share: f(r[3]), mean: f(r[4], 1) });
  if (R.size) readsOf.set(g, R); else readsOf.delete(g);
  g.guards.forEach((gd, i) => { const M = s?.men?.[i], Q = s?.quits?.[i] ?? [], P = s?.pass?.[i] ?? [], T = s?.tried?.[i] ?? [];
    if (!M) { stateOf.delete(gd); return; }
    const quits: Fear['quits'] = []; for (let k = 0; k + 1 < Q.length; k += 2) quits.push({ room: f(Q[k]), t: f(Q[k + 1]) });
    const pass: Fear['pass'] = []; for (let k = 0; k + 1 < P.length; k += 2) pass.push({ door: f(P[k], -1), until: f(P[k + 1]) });
    stateOf.set(gd, { act: ACTS[f(M[1])] ?? 'none', t: Math.max(0, f(M[2])), door: f(M[3], -1), side: M[4] === -1 ? -1 : 1, spot: Number.isFinite(M[5]) && Number.isFinite(M[6]) ? [M[5], 0, M[6]] : null, at: !!M[7],
      other: g.guards[f(M[8], -1)] ?? null, called: !!M[9], callT: f(M[10]), left: f(M[11], -1e9), told: !!M[12], lag: f(M[13]), said: f(M[14]), idle: f(M[15]), ask: f(M[16]), armed: f(M[17], -1), armT: f(M[18], -1e9),
      quits, pass, tried: T.map(k => g.guards[k]).filter((o): o is Guard => !!o) }); });
}
