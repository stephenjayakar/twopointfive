// THE REAR MAN COVERS THE DOOR BEHIND (REARWATCH.on — ships on; `?norearwatch` for a visit, TPS_REARWATCH in the harness's environment).
// A stack on a door stood with every gun on that door from the moment it was let go, and the rear man's spare eyes before that were whatever the unasked
// cover (cover.ts) happened to deal him that quarter second: a door standing open at the stack's back dropped out of the deal whenever a mate was near its
// frame or in his lane, and from the boot, the can or the shove on nobody watched it at all. Traced on the warehouse with four (seed 9, the older stand): the
// squad stacked on one door of a small office with the office's other door open behind it, 'open and clear' two seconds later, and a man was shot through
// the door behind while the four of them looked at the one in front.
//
//   THE WAY BEHIND  a DOOR other than the one being worked, standing `ajar` open or off its hinges, inside REARWATCH.reach of the nearest of the stack's marks, with a face on
//                   the floor the stack stands on (stackroom.ts's floor of that face of the door). Doors onto floor the team has not been on (cleared.ts; open
//                   ground is never 'been on') come first, then the nearest. One somebody else already holds — a posted man of another order, another man's
//                   unasked cover, the stack's own lane man (doorway.ts) — is not counted. (A gap with no leaf, the slot between two shelves, a passage's
//                   mouth: those stay the unasked cover's to deal, as before — the nav grid's gaps are mostly furniture, not ways onto the floor.)
//   THE REAR MAN    of the men whose eyes the order leaves spare (orders.ts spareRear: the furthest from the frame; the last two of four), the one with a line to
//                   that way from his MARK (into the doorway, to its open leaf's edge, or to the floor just before it: rearSees). He is PINNED to it: cover.ts deals it to him ahead of everything else and past the filters that let it drop
//                   (a mate by its frame, a mate brushing his lane, the walk's own narrower list). A fight or a warm contact still takes him, as it takes any
//                   man off any opening (cover.ts free()). With no way behind, or no line to one from any rear mark, nothing is pinned: the deal as it was.
//   THROUGH THE ENTRY  (REARWATCH.through; 'open and clear', 'bang and clear', the charge; three men or more) he keeps it through the boot, the can and the
//                   shove, and FOLLOWS LAST: doortools.ts puts him at the end of the turn, and he goes on that turn — the entry is not a gun short and not
//                   a second slower for him. The first guns through the door are the ones they always were; the entry's own rule (DOORTOOLS.lastOut) then
//                   gives the door they came in by to the last man through, from the inside — him.
//                   (REARWATCH.hold, off: he is kept on it until every other man of the entry is THROUGH the frame, REARWATCH.holdSecs at most. Built first
//                   and measured: the way behind was watched a second or two longer and the room was a gun short for it — over 18 seeds of the barracks
//                   with four, 31 teammates up against 41 with the rule off, 42 with him going on his turn. So he goes on his turn.)
//                   Where the room has no point for him (a small room, four men) he is the one the entry leaves outside, and the way behind stays his
//                   from there. (The door tool files the stack again behind the man who opens: where that file leaves no rear mark a line to the way, nobody
//                   is pinned through the entry — a mark is the stack's to move, not this rule's.)
//                   He is not the man picked to go FIRST either, while the other file has a front man (doortools.ts firstIn: 'who has seen most of the
//                   room' is asked of the others).
//   A PAIR          has no spare man once the door goes: its second man watches the way behind while the stack WAITS (as above), and both go in together.
//
// Nothing here moves a mark (stackroom.ts's), deals a pod, or decides a shot: a pinned gun is an aim, and who fires is the fight's (a team that has not been
// found is held by the same rules as on any other watch). State: a book per Game, DERIVED AGAIN EVERY FRAME from the orders and the doors' state — the one
// things remembered across frames are who had the watch (so it does not hop between two men) and when he last had his line (REARWATCH.grace: the worked
// door's own leaf swings across it), and losing them changes nothing but that. Nothing to save: a load starts the book afresh.
//
// A TAKEN ROOM'S OTHER DOOR, KEPT WHILE THE SQUAD LEAVES (REARWATCH.room; `?noroomkeep`, frozen stand off: TPS_ROOMKEEP=1; off = the build as it was).
// An entry that has ended leaves a man with his gun on each other door of the room nobody of the squad has been beyond (doortools.ts otherDoors, the
// threshold's holdDoors) — and lets go of him the frame ANY new order comes. 'Fall in' is such an order, given with the squad still standing in the room:
// every gun left the room's other doors at once. With the switch on the man who HAD such a door when 'fall in' came keeps it (roomKeepTick): the cover deals
// it to him first, as a stack's rear man's pin; his feet stay where they are, with no goal (orders.ts asks roomKept — a runner held at speed 0 on a goal
// still steers his chest at his next waypoint, and the twist clamp then drags his gun off the door and off a man he has seen); he is the last of the file.
// He is let go when the squad is out of the room, when the last man has passed him (Sam is out and the men who stood behind him then are all nearer Sam now),
// REARWATCH.roomSecs after Sam left whatever the others do, once Sam is REARWATCH.roomM from him, when the squad has been beyond that door or another order works or watches it — and then
// follows, last. An order that sends him to a mark ends the keep; if it is a stack and the kept door is still shut, that door counts as a way behind that
// stack while the squad is in the room (Book.shut, read by rearWays), so a rear man of the stack gets it by the rules above. Sam standing in the room keeps
// him on it. Nothing here deals a door: who has one is the entry's own rule, read a frame late. Not saved (a load: the entry's own hold is gone too).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap, SideSet } from '../math/side';
import { Vec3, v3 } from '../math/vec';
import type { Game, Guard } from './game';
import type { Door } from './doors';
import type { DoorOp } from './doortools';
import type { Opening } from './cover';
import { COVER } from './cover';
import type { Assignment } from './orders';
import { sideOf } from './orders';
import { doorWrittenName } from './doornames';   // (a leaf: the name a level wrote for a door)
import { stackRoomProbe } from './stackroom';

export const REARWATCH = {
  /** THE switch: off = the rear man's eyes as the unasked cover alone dealt them, and every gun on the door from the moment it goes */
  on: true,
  /** … kept from the boot / the can / the shove until the others are through, and he follows last (false: pinned only while the stack waits) */
  through: true,
  /** … and HELD on it until every other man of the entry is through the frame (false, as shipped: he goes on his turn, the last of the queue — holding him
   *  left the room a gun short for a second or two and cost men in the paired fights) */
  hold: false,
  /** hold: the longest he is held back after 'go' whatever the others are doing (a man stuck in the frame does not strand him outside) */
  holdSecs: 6,
  /** how far from the stack's marks a way behind is looked for (cover.ts's own reach is the line's limit) */
  reach: 9,
  /** a leaf this far open is an open way (doorway.ts laneAjar's number) */
  ajar: 0.6,
  /** a line lost for less than this keeps the watch his (the worked door's own leaf swinging across it, a man walking through it) */
  grace: 1.5,
  /** a rear man this long within a stride of his mark and still not on it is let off the watch until he is: walking with his gun behind him he can grind on a
   *  leaf's edge where a man facing his walk slides past — and a stack waits for its last man (s) */
  short: 1.5,
  /** A TAKEN ROOM'S OTHER DOOR IS KEPT WHILE THE SQUAD LEAVES (the head comment's last part): off = the man an entry left on it turns away the frame 'fall in' is given */
  room: true,
  /** … the longest he is kept on it once Sam is out of the room (s): a mate who never leaves does not strand him */
  roomSecs: 8,
  /** … and never further than this from Sam (m): a room big enough for Sam to walk that far inside it is not one he is kept at the far end of — 0 = no limit */
  roomM: 8,
  /** 'the last man has passed him' also waits for every mate who is on his way OUT of the room (his place under 'fall in' is not in it) to be out: freed with
   *  the others a metre off, queueing at the one doorway, the keeper was through the frame ahead of one of them as often as not — he follows LAST. A mate whose
   *  place is in the room is not waited for, and `roomSecs` / `roomM` still let him go. false = freed the moment the men who stood behind him have come by, as it was */
  roomLast: true,
};
/** QA, since the page loaded: frames-with-a-group that had a way behind · … that had it pinned · … with a way and no rear mark that sees it · pins handed out
 *  (a new man or a new way) · entries the rear man was held back in · … let go on the clock instead of the others' crossing · turns he was moved to the end of ·
 *  taken rooms' other doors kept over a 'fall in' · … let go on the clock */
export const REARWATCH_STATS = { ways: 0, pinned: 0, noLine: 0, pins: 0, held: 0, late: 0, last: 0, rooms: 0, roomLate: 0, roomWays: 0, roomFar: 0 };

/** one pinned watch: the way, the door being worked and the face the stack is on, the door tool's order it is under (null: a plain 'stack') */
export interface RearPin { o: Opening; front: Vec3; door: Door; side: 1 | -1; op: DoorOp | null; cls: 0 | 1; t0: number; seenT: number; A: Assignment; going?: boolean; raised?: boolean; held?: boolean; late?: boolean; out?: boolean;
  /** a room's other door kept over 'fall in' (REARWATCH.room): the point he had his gun on when the order came — his when no other line is found */
  to?: Vec3 }
/** one kept door (REARWATCH.room): the pin the cover reads, the room it is a door of, when Sam was first seen out of it (NaN: still in) */
interface RoomKeep { pin: RearPin; room: object; outT: number; /** the men who had further to walk to Sam than he had when Sam left the room: the ones who have to pass him */ behind: Guard[] | null; /** when the leaving is next judged */ at: number }
interface Book { pins: Map<Guard, RearPin>; byOp: WeakMap<DoorOp, Guard>; short: WeakMap<Assignment, number>; letOff: WeakSet<Assignment>; log: string[]; rows: number;
  keeps: Map<Guard, RoomKeep>; was: [Guard, Door, Assignment][];
  /** a taken room's other door that was being kept when an order to stack came: SHUT, it still counts as a way behind that stack (rearWays) while the squad is in the room */
  shut: Map<Door, { o: Opening; room: object; at: Vec3 }> }
const books = new SideMap<Game, Book>('rearwatch.books');
const bookOf = (g: Game): Book => { let B = books.get(g); if (!B) books.set(g, B = { pins: new Map(), byOp: new SideMap(), short: new SideMap(), letOff: new SideSet(), log: [], rows: 0, keeps: new Map(), was: [], shut: new Map() }); return B; };

const flat = v3.distXZ, EYE = 1.55, CHEST = 1.1;   // (cover.ts's own heights)
const PRE = ['stack', 'ready', 'place', 'standoff', 'armed'], GOING = ['kick', 'toss', 'fuse', 'wait', 'enter'], ENTRIES = ['openClear', 'bangClear', 'charge'];
/** once the door is going a new man takes the watch only in these · a stack counts as on its marks with every man within this of his (m) */
const SLOW = ['toss', 'fuse', 'wait'], FORMED_M = 1.5;
const isOpenWay = (d: Door) => d.off || (!d.latched && Math.abs(d.angle) >= REARWATCH.ajar);

/** The ways behind a stack on face `side` of `door` whose marks are `marks`, best first (uncleared floor beyond, then the nearest) — whoever holds them. */
export function rearWays(g: Game, door: Door, side: 1 | -1, marks: Vec3[]): { o: Opening; front: Vec3; cls: 0 | 1; d: number }[] {
  if (!marks.length) return [];
  const K = REARWATCH, C = g.cleared, F = stackRoomProbe(g, door, side), c: Vec3 = [0, 0, 0];
  for (const m of marks) { c[0] += m[0] / marks.length; c[2] += m[2] / marks.length; }
  const out: { o: Opening; front: Vec3; cls: 0 | 1; d: number }[] = [];
  for (const o of g.cover.ready()) {
    if (!o.door || o.door === door || !(isOpenWay(o.door) || (K.room && books.get(g)?.shut.has(o.door)))) continue;   // (… or a taken room's other door a man was keeping when this stack was ordered: roomKeepTick)
    const d = Math.min(...marks.map(m => flat(o.at, m))); if (d > K.reach) continue;   // (within reach of the nearest mark: the same answer whichever of the file are still on the stack)
    const a: Vec3 = [o.at[0] + o.n[0] * 0.7, 0, o.at[2] + o.n[1] * 0.7], b: Vec3 = [o.at[0] - o.n[0] * 0.7, 0, o.at[2] - o.n[1] * 0.7];
    if (F.floor && !F.has(a) && !F.has(b)) continue;   // (a way onto some other floor: not at THIS stack's back)
    const far = F.floor && F.has(a) !== F.has(b) ? (F.has(a) ? b : a) : flat(a, c) >= flat(b, c) ? a : b, r = C.roomBy(o.door, sideOf(o.door, far));   // (what is beyond it: the face that is not this floor's)
    const near = far === a ? b : a;
    out.push({ o, front: [near[0], CHEST, near[2]], cls: r && C.isKnown(r) ? 1 : 0, d });
  }
  return out.sort((x, y) => x.cls - y.cls || x.d - y.d || (x.o.id < y.o.id ? -1 : 1));
}

interface Group { op: DoorOp | null; door: Door; side: 1 | -1; men: Guard[]; marks: Vec3[]; cands: Guard[]; going: boolean }

/** Game.update, after the door tools' tick (which says whose eyes are spare) and before the cover's (which deals). */
export function rearWatchTick(g: Game): void {
  const B = bookOf(g), K = REARWATCH, S = g.orders;
  roomKeepTick(g, B);
  // (… nor with the unasked cover off, or its stack rule off: a pin is a deal of the cover's — without it he would be held back off the door and watch nothing)
  if (!K.on || !S.active || !COVER.on || !COVER.stacked) { if (B.pins.size) { for (const P of B.pins.values()) if (P.raised && P.out) P.A.spare = false; B.pins.clear(); } return; }
  const squad = S.men().filter(m => m.state !== 'dead'), groups: Group[] = [], taken = new Set<Guard>();
  const postOf = (m: Guard) => S.of(m)?.post ?? null;
  // (SHORT OF HIS MARK: between a stride and a step from it for K.short — off the watch until he stands on it; the clock is per assignment, and one that
  //  reads later than now — a checkpoint loaded — starts again)
  const shortOf = (m: Guard): boolean => { const A = S.of(m), q = A?.post; if (!A || !q) return false; const d = flat(m.char.pos, q);
    if (d < 0.35 || d >= 1.0) { B.short.delete(A); return false; }
    const t = B.short.get(A); if (t === undefined || g.time < t) { B.short.set(A, g.time); return false; }
    if (g.time - t <= K.short) return false; B.letOff.add(A); return true; };
  // (an entry that keeps the watch through the door: three or more living men on it, not a threshold's hold)
  const carries = (op: DoorOp) => K.through && !op.thr && ENTRIES.includes(op.kind) && op.men.filter(m => m.state !== 'dead').length >= 3;
  // (the man of this order already pinned behind this stack — under the plain 'stack' before it, or an earlier order on the door — who is not its lead nor the man the doorway's manners have)
  const hadOf = (op: DoorOp, men: Guard[], lane: Guard | null | undefined) => men.find(m => { const P = B.pins.get(m); return !!P && P.door === op.door && P.side === op.side && m !== op.lead && m !== lane; });
  for (const op of g.doorTools.ops) {
    for (const m of op.men) taken.add(m);
    const men = op.men.filter(m => m.state !== 'dead' && S.of(m) === op.mine.get(m) && !!postOf(m) && !op.pod.has(m));
    const marks = op.men.filter(m => m.state !== 'dead').map(m => op.post.get(m)?.pos ?? postOf(m)).filter((p): p is Vec3 => !!p);   // (the whole file's marks, the men already sent in included: the stack is where it stood)
    if (PRE.includes(op.phase)) { let cands = men.filter(m => S.of(m)!.spare && m !== op.lane?.gd);
      // (… the man the doorway's manners have on the open door meanwhile — doortools.ts op.lane — HAD the watch if he was pinned when the order came: it is his
      //  again when he comes up to his mark, three or more on the order, since he then keeps it through the entry and follows last)
      const L = op.lane?.gd; if (L && B.pins.has(L) && men.length >= 3) B.byOp.set(op, L);
      // (NO NEW WATCH FOR A MOMENT: an entry given to a stack already on its marks files the men again and goes at once — whoever the new file leaves spare
      //  would be turned to the door behind and sent in a quarter second later. Only the man who has the watch keeps it; a stack still walking up, one
      //  that will wait for the word, and a charge being set take a new man as before)
      if (op.phase === 'stack' && !op.onWord && op.men.every(m => { if (m.state === 'dead') return true; const q = op.post.get(m)?.pos ?? postOf(m); return !q || flat(m.char.pos, q) < FORMED_M; })) cands = cands.filter(m => B.pins.has(m) || B.byOp.get(op) === m);
      // (… and THE MAN WHO HAS IT KEEPS IT over an entry order: the order files the stack again, and the new file may not leave him its rear man — he would be
      //  turned in for the second it takes the door to go, with nobody new allowed the watch. Three or more on an entry that will carry it through: his eyes
      //  stay spare, as they are once the door is going, and he follows last)
      const had = hadOf(op, men, L);
      if (had && !cands.includes(had) && carries(op)) { const A = S.of(had)!; A.spare = true; A.from ??= op.from.get(had) ?? [had.char.pos[0], 0, had.char.pos[2]]; cands.push(had); }
      // (a man let off to step onto his mark has the watch again once he is on it — unless the door then goes at once and the entry will not carry the watch
      //  through: a pair, a threshold. On again as he lands and off a quarter second later is the give-and-take-back this file is not to make)
      const brief = op.phase === 'stack' && !op.onWord && !carries(op);
      cands = cands.filter(m => !shortOf(m) && !(brief && B.letOff.has(S.of(m)!)));
      groups.push({ op, door: op.door, side: op.side, men, marks, cands, going: false }); continue; }
    if (!carries(op) || !GOING.includes(op.phase)) continue;
    // (the door is going: the one man who had the watch keeps it — or, a way come open since, the last man of the file — and in the entry itself only the
    //  man at the END of the turn: holding back one with men behind him would hold them all)
    const out = men.filter(m => !op.crossed.has(m) && m !== op.lead && m !== op.first && (op.phase !== 'enter' || op.queue[op.queue.length - 1]?.gd === m));
    const kept = B.byOp.get(op) ?? hadOf(op, men, null), dist = (m: Guard) => flat(postOf(m)!, op.door.frameCentre);   // (… or the man who had it on the plain stack, the door gone before this file saw him on it)
    // (… and a NEW man takes it only behind a can — the throw, the fuse and the burst after it are seconds; behind a shove or a boot the first man is through
    //  before a gun turned round now has settled on the door behind)
    const cands = kept && out.includes(kept) ? [kept] : SLOW.includes(op.phase) ? out.sort((a, b) => dist(b) - dist(a)).slice(0, 1) : [];
    groups.push({ op, door: op.door, side: op.side, men, marks, cands, going: true });
  }
  // (a plain 'stack' on a door — no tool on it yet: its men by door)
  const plain: { door: Door; side: 1 | -1; men: Guard[] }[] = [];
  for (const m of squad) { if (taken.has(m)) continue; const A = S.of(m); if (!A || A.order !== 'stack' || !A.door || !A.post) continue; const side = sideOf(A.door, A.post), L = plain.find(x => x.door === A.door && x.side === side); if (L) L.men.push(m); else plain.push({ door: A.door, side, men: [m] }); }
  for (const { door, side, men } of plain) groups.push({ op: null, door, side, men, marks: men.map(m => postOf(m)!), cands: men.filter(m => S.of(m)!.spare && !shortOf(m)), going: false });

  const next = new Map<Guard, RearPin>();
  const heldOut = new Set<Opening>();
  // LEFT OUTSIDE: the entry had no point inside for him (doortools.ts: the last of the turn keeps his place on the stack and is not the order's any more), or
  // the order ended with him still on his mark — the way behind is his for as long as that assignment is, it stands open, and nobody else has taken it.
  // Dealt BEFORE the stacks': a way he keeps from outside is held, and the entry takes nobody else off the door for it.
  const grouped = new Set<Guard>(); for (const G of groups) for (const m of G.men) grouped.add(m);
  for (const [m, P] of B.pins) { if (next.has(m) || grouped.has(m) || taken.has(m) || m.state === 'dead') continue;   // (a man still of a live order — a pair's second man as they go, a threshold's rear man — is that order's, not 'outside')
    const A = S.of(m); if (!A || A !== P.A || !A.post || !P.o.door || !(isOpenWay(P.o.door) || (K.room && B.shut.has(P.o.door)))) continue;
    // (he had it through a door already going — the boot, the can: doortools.ts turned every gun of the order in, his too, the tick it left him out — so his
    //  eyes are made spare again here; nobody else writes that flag for a man no order owns)
    if (P.going && !A.spare) { A.spare = true; P.raised = true; }
    if (!A.spare) continue;
    if (rearSees(g, A.post, P.o, P.front)) P.seenT = g.time; else if (g.time - P.seenT >= K.grace) continue;
    if (heldByOther(g, { op: P.op, door: P.door, side: P.side, men: [m], marks: [A.post], cands: [m], going: false }, P.o, squad)) continue;
    if (!P.out) { P.out = true; note(B, `${g.time.toFixed(1)} ${m.callsign} keeps ${P.o.id} from outside`); }
    next.set(m, P); heldOut.add(P.o); }
  for (const G of groups) {
    if (!G.cands.length || G.men.length < 2 && !G.going) continue;
    const ways = rearWays(g, G.door, G.side, G.marks).filter(w => !heldOut.has(w.o) && !heldByOther(g, G, w.o, squad));
    if (!ways.length) continue;
    REARWATCH_STATS.ways++;
    let pick: { m: Guard; o: Opening; front: Vec3; cls: 0 | 1; blind: boolean } | null = null;
    for (const w of ways) {
      let see = G.cands.filter(m => !next.has(m) && rearSees(g, postOf(m)!, w.o, w.front)), blind = false;
      if (!see.length) { const k = G.cands.find(m => { const P = B.pins.get(m); return !next.has(m) && !!P && P.o === w.o && g.time - P.seenT < K.grace; });   // (his line cut for a moment — the worked door's leaf swinging across it: still his)
        if (!k) continue; see = [k]; blind = true; }
      // (a man with a line to it from where he IS first — one still walking to a mark the door tool has just moved may have none yet; then a line into the
      //  doorway itself before one to its open leaf's edge; then the man already on it — pinned, or dealt it by the cover — keeps it; else the man furthest
      //  from the door)
      const rank = (m: Guard) => (rearSees(g, m.char.pos, w.o, w.front) ? 16 : 0) + (g.cover.sightFrom(postOf(m)!, w.o) === w.o.at ? 8 : 0) + (B.pins.get(m)?.o === w.o ? 4 : 0) + (g.cover.of(m)?.o === w.o ? 2 : 0) + (G.op && B.byOp.get(G.op) === m ? 1 : 0);
      const dist = (m: Guard) => flat(postOf(m)!, G.door.frameCentre);
      const m = see.sort((a, b) => rank(b) - rank(a) || dist(b) - dist(a))[0]; pick = { m, o: w.o, front: w.front, cls: w.cls, blind }; break;
    }
    if (!pick) { REARWATCH_STATS.noLine++; continue; }
    REARWATCH_STATS.pinned++;
    const was = B.pins.get(pick.m), P: RearPin = was && was.o === pick.o && was.op === G.op ? was : { o: pick.o, front: pick.front, door: G.door, side: G.side, op: G.op, cls: pick.cls, t0: g.time, seenT: g.time, A: S.of(pick.m)! };
    P.cls = pick.cls; P.front = pick.front; P.A = S.of(pick.m)!; P.out = false; P.going = G.going; if (!pick.blind) P.seenT = g.time; heldOut.add(pick.o); next.set(pick.m, P); if (G.op) B.byOp.set(G.op, pick.m);   // (heldOut: no second stack pins a man to the same way this tick)
    if (P !== was) { REARWATCH_STATS.pins++; note(B, `${g.time.toFixed(1)} ${pick.m.callsign} on ${pick.o.id} (${pick.cls ? 'known' : 'uncleared'} beyond) behind the stack on ${G.door.def.name}${G.going ? ' · through the entry' : ''}`); }
    // (the door is going: doortools.ts has just turned every gun in — his eyes stay spare, as on the wait)
    if (G.going) { const A = S.of(pick.m) as Assignment; A.spare = true; A.from ??= G.op!.from.get(pick.m) ?? [pick.m.char.pos[0], 0, pick.m.char.pos[2]]; }
  }
  for (const [m, P] of B.pins) if (!next.has(m)) { const G = groups.find(x => x.men.includes(m)), W = G ? rearWays(g, G.door, G.side, G.marks) : [], w = W.find(x => x.o === P.o);
    // (why, for the log: read by the checks and whoever asks why a back door went unwatched)
    const why = m.state === 'dead' ? 'down' : !G ? (P.op && P.op.crossed.has(m) ? 'through the door' : 'off the stack') : !G.cands.includes(m) ? (next.size ? 'another man has the rear' : 'not the rear man now') : !w ? 'shut, or out of reach' : heldByOther(g, G, P.o, squad) ? 'another holds it' : !rearSees(g, postOf(m)!, w.o, w.front) ? 'no line from his mark' : 'a way before it';
    note(B, `${g.time.toFixed(1)} ${m.callsign} off ${P.o.id} · ${why}`); }
  B.pins = next;
}
function note(B: Book, s: string) { B.log.push(s); B.rows++; if (B.log.length > 200) B.log.shift(); }

const FALLING = 'falling in';
/** A TAKEN ROOM'S OTHER DOOR, KEPT WHILE THE SQUAD LEAVES (REARWATCH.room). An entry that has ended leaves a man with his gun on each other door of the
 *  room nobody of the squad has been beyond (doortools.ts otherDoors, the threshold's holdDoors) — for as long as he is on that entry's order. 'Fall in' is a
 *  new order: every such gun turned away the frame it was given, with the squad still standing in the room. Here the man who HAD such a door when 'fall in'
 *  came KEEPS it: the cover deals it to him first (the pin, as a stack's rear man's), his feet stay where they are (orders.ts asks roomKept), and his place
 *  in the file is the last. He is let go when the squad is out of the room (Sam and every other living man), when Sam is out and the men who stood behind
 *  him then have come by (the last man has passed him), REARWATCH.roomSecs after Sam left it whatever the others do, when the squad has been beyond that
 *  door or another order has come to work or watch it, and by any order that is not 'fall in' — and then follows, last. Sam standing in the room keeps him
 *  on it. Nothing here deals a door: who has one is the entry's own rule, read a frame late (the entry lets go of him before this file's turn). */
function roomKeepTick(g: Game, B: Book): void {
  const K = REARWATCH, S = g.orders, D = g.doorTools;
  const let_ = (m: Guard, why: string) => { const R = B.keeps.get(m); if (!R) return; B.keeps.delete(m);
    const A = S.of(m); if (A && A === R.pin.A && A.post === null) A.going = FALLING;
    note(B, `${g.time.toFixed(1)} ${m.callsign} off ${R.pin.o.id} · ${why}`); };
  if (!K.room || !S.active || !COVER.on) { for (const m of [...B.keeps.keys()]) let_(m, 'switched off'); B.was = []; B.shut.clear(); return; }
  const now = D.doorKeepers(), sam = g.player, samUp = !sam.down, squad = S.men().filter(m => m.state !== 'dead');
  const inner = (o: Opening, p: Vec3, k: number): Vec3 => { const s = (p[0] - o.at[0]) * o.n[0] + (p[2] - o.at[2]) * o.n[1] >= 0 ? 1 : -1; return [o.at[0] + o.n[0] * s * k, CHEST, o.at[2] + o.n[1] * s * k]; };
  const others = (m: Guard, room: object) => squad.filter(x => x !== m && g.fight.roomAt(x.char.pos) === room);
  // ---- the hand-over: he had a door last frame, the entry has let go of him since, and what he has now is 'fall in'
  for (const [m, door, A0] of B.was) {
    if (B.keeps.has(m) || m.state === 'dead' || now.some(x => x[0] === m)) continue;
    const A = S.of(m); if (!A || A === A0 || A.post !== null) continue;
    const o = g.cover.ready().find(x => x.door === door); if (!o) continue;
    const p = m.char.pos, front = inner(o, p, 0.7), room = g.fight.roomAt(p) ?? g.fight.roomAt(front); if (!room) continue;
    if (g.entry.farKnown(o, inner(o, p, 0.4)) || D.ops.some(x => x.door === door)) continue;
    if (!others(m, room).length && !(samUp && g.fight.roomAt(sam.char.pos) === room)) continue;   // (nobody left in it to keep it for)
    if (K.roomM > 0 && flat(p, sam.char.pos) > K.roomM) continue;   // (… and Sam is already too far off to stay behind for)
    const to: Vec3 | undefined = A0.watch ? [A0.watch[0], A0.watch[1], A0.watch[2]] : undefined;
    B.keeps.set(m, { pin: { o, front, door, side: 1, op: null, cls: 0, t0: g.time, seenT: g.time, A, to }, room, outT: NaN, behind: null, at: 0 });
    REARWATCH_STATS.rooms++; note(B, `${g.time.toFixed(1)} ${m.callsign} keeps ${o.id} while the squad leaves the room`);
  }
  B.was = now;
  // ---- a kept door that became a stack's way behind: until the squad has been beyond it, an order works it, or the squad is out of the room
  for (const [door, W] of [...B.shut]) if (g.entry.farKnown(W.o, W.at) || D.ops.some(x => x.door === door) || !(squad.some(x => g.fight.roomAt(x.char.pos) === W.room) || (samUp && g.fight.roomAt(sam.char.pos) === W.room))) B.shut.delete(door);
  // ---- each kept door: his still?
  for (const [m, R] of [...B.keeps]) { const P = R.pin, o = P.o;
    if (m.state === 'dead') { B.keeps.delete(m); continue; }
    const A = S.of(m); if (!A || A.post !== null) { B.keeps.delete(m);
      // (sent to a mark — the stack on the room's next door: the door he was keeping is at that stack's back. Shut, it is still a way behind it: rearWays)
      const stays = !!A && !!P.door && !isOpenWay(P.door) && !g.entry.farKnown(o, inner(o, m.char.pos, 0.4)) && !D.ops.some(x => x.door === P.door) && A.door !== P.door;
      if (stays) { B.shut.set(P.door, { o, room: R.room, at: inner(o, m.char.pos, 0.4) }); REARWATCH_STATS.roomWays++; }
      note(B, `${g.time.toFixed(1)} ${m.callsign} off ${o.id} · another order${stays ? ' (still a way behind the stack)' : ''}`); continue; }
    if (A !== P.A) P.A = A;   // ('fall in' given again: the same keep, on the new order)
    if (!samUp) { let_(m, 'the player is down'); continue; }
    if (g.entry.farKnown(o, inner(o, m.char.pos, 0.4))) { let_(m, 'the squad has been beyond it'); continue; }
    if (K.roomM > 0 && flat(m.char.pos, sam.char.pos) > K.roomM) { REARWATCH_STATS.roomFar++; let_(m, 'the player has gone on'); continue; }
    if (D.ops.some(x => x.door === P.door) || squad.some(x => { if (x === m) return false; const X = S.of(x); return !!X && !!X.post && (X.door === P.door || (!!X.watch && flat(X.watch, o.at) < 1.5)); })) { let_(m, 'another order has it'); continue; }
    // (several men keeping doors of one room do not wait on each other: a keeper waits for the men who keep nothing and for the keepers DEEPER in the room
    //  than he is — the deepest goes when the rest are out, and each of the others as that man comes by. DEEPER and PASSED are by the walk to Sam, not the
    //  straight line: through a wall Sam is nearest to the man furthest from the way out. Asked four times a second)
    if (g.fight.roomAt(sam.char.pos) === R.room) { R.outT = NaN; R.behind = null; }
    else if (g.time >= R.at || R.at - g.time > 1) { R.at = g.time + 0.25;
      if (isNaN(R.outT) || g.time < R.outT) R.outT = g.time;
      const far = new Map<Guard, number>(), walk = (x: Guard) => { let l = far.get(x); if (l === undefined) far.set(x, l = walkTo(g, x.char.pos, sam.char.pos)); return l; };
      const dm = walk(m), rest = others(m, R.room).filter(x => !B.keeps.has(x) || walk(x) > dm);
      if (!rest.length) { let_(m, 'the squad is out of the room'); continue; }
      // (THE LAST MAN PASSES HIM: the men who had further to walk to Sam than he did when Sam left have all come by. With nobody behind him — he is the deepest
      //  man in the room — there is nobody to pass: he keeps it until the others are out)
      R.behind ??= rest.filter(x => walk(x) > dm + 0.3);
      // (… and he does not crowd them at the way out: REARWATCH.roomLast = a mate still in the room whose place is beyond it goes out first)
      const queue = K.roomLast && rest.some(x => { const X = S.of(x); return !!X && X.post === null && g.fight.roomAt(X.goal) !== R.room; });
      if (R.behind.length && !queue && R.behind.every(x => x.state === 'dead' || !rest.includes(x) || walk(x) < dm - 0.3)) { let_(m, 'the last man has passed him'); continue; }
      if (g.time - R.outT >= K.roomSecs) { REARWATCH_STATS.roomLate++; let_(m, 'on the clock'); continue; } }
    A.follow = 1e3; A.going = `holding · ${o.door ? doorWrittenName(o.door) ?? o.door.def.name.replace(/_/g, ' ') + ' door' : o.id}`;   // (the last place in the file — orders.ts numbers the file again each frame; a man who was last stays last once he is let go)
  }
}
/** how far it is from `a` to `b` on foot: the straight line when nothing stands in it, else the nav grid's path (no way: the straight line and a room's worth) */
function walkTo(g: Game, a: Vec3, b: Vec3): number {
  const d = flat(a, b); if (!g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]])) return d;
  const path = g.col.nav.findPath(a, b, 3000); if (!path) return d + 20;
  let l = 0, q = a; for (const r of path) { l += flat(q, r); q = r; } return l + flat(q, b);
}
/** orders.ts, the fall-in leg: this man's feet stay where they are — he keeps a taken room's other door while the squad leaves it (REARWATCH.room) */
export function roomKept(g: Game, gd: Guard): boolean { return REARWATCH.room && !!books.get(g)?.keeps.has(gd); }


/** somebody not of this stack already has that way: a posted man of another order on that door or with his watch on it, another man's unasked cover — or
 *  the stack's own lane man, sent to cover it before he comes up (doorway.ts stackCover) */
function heldByOther(g: Game, G: Group, o: Opening, squad: Guard[]): boolean {
  const L = G.op?.lane; if (L && o.door && L.door === o.door && L.gd.state !== 'dead') return true;
  return squad.some(m => { if (G.men.includes(m) || G.op?.men.includes(m)) return false;   // (… nor a man of this same entry already sent in: his sweep passing over the door from inside is not a watch on it)
    const A = g.orders.of(m); if (A && A.post && flat(m.char.pos, A.post) <= 1.5 && ((!!o.door && A.door === o.door) || (!!A.watch && flat(A.watch, o.at) < 1.5))) return true;
    const J = g.cover.of(m); return !!J && !J.off && J.o === o; });
}

/** The point of a way behind a man stood at `p` can watch: the doorway itself or its open leaf's free edge, as cover.ts sees any opening (sightFrom) — or, the
 *  frame out of his line (a door in the wall he stands along, down the corridor: the line to its frame grazes that wall), the floor just BEFORE it on the
 *  stack's side (`front`), where whoever comes through it steps out. null: none of them. */
export function rearSees(g: Game, p: Vec3, o: Opening, front: Vec3): Vec3 | null {
  return g.cover.sightFrom(p, o) ?? (flat(p, front) <= REARWATCH.reach && flat(p, front) > 0.9 && !g.col.segmentBlocked([p[0], EYE, p[2]], front) ? front : null);
}
/** cover.ts deal(): the way this man is pinned to (null: none — he is dealt as anybody) */
export function rearPinOf(g: Game, gd: Guard): RearPin | null { const B = books.get(g); return !B ? null : (REARWATCH.on ? B.pins.get(gd) : undefined) ?? (REARWATCH.room ? B.keeps.get(gd)?.pin : undefined) ?? null; }
/** … whatever the switch says (QA, the debug read-out) */
export function rearPin(g: Game, gd: Guard): RearPin | null { return books.get(g)?.pins.get(gd) ?? null; }

/** doortools.ts, the entry's queue (REARWATCH.hold): is this man held back on the way behind — pinned under this order, and somebody else of it still to come
 *  through the frame (never past REARWATCH.holdSecs from 'go') */
export function rearHolds(g: Game, op: DoorOp, gd: Guard): boolean {
  const K = REARWATCH; if (!K.on || !K.through || !K.hold) return false;
  if (rearWatcher(g, op) !== gd) return false;   // (the same entries rearLast re-orders: three or more, not worked from the threshold)
  const P = books.get(g)!.pins.get(gd)!;
  if (g.time - op.t0 >= K.holdSecs) { if (!P.late) { P.late = true; REARWATCH_STATS.late++; } return false; }
  if (!op.men.some(m => m !== gd && m.state !== 'dead' && !op.crossed.has(m))) return false;
  if (!P.held) { P.held = true; REARWATCH_STATS.held++; }
  return true;
}
/** doortools.ts enter(): the turn the men go in by, with the rear man — pinned on a way behind as the word comes — put LAST (never the man picked to go
 *  first; a pair's turn is left alone) */
export function rearLast(g: Game, op: DoorOp, turn: Guard[], first: Guard): Guard[] {
  const K = REARWATCH; if (!K.on || !K.through || turn.length < 3) return turn;
  const w = rearWatcher(g, op); if (!w || w === first || !turn.includes(w) || turn[turn.length - 1] === w) return turn;
  REARWATCH_STATS.last++;
  return [...turn.filter(m => m !== w), w];
}

/** doortools.ts firstIn(): the man of this order who is pinned on a way behind and will be held on it through the entry (null: none — a pair, the switch off) */
export function rearWatcher(g: Game, op: DoorOp): Guard | null {
  const K = REARWATCH; if (!K.on || !K.through || op.thr || !ENTRIES.includes(op.kind) || op.men.filter(m => m.state !== 'dead').length < 3) return null;
  const B = books.get(g), w = B?.byOp.get(op); return w && B!.pins.get(w)?.op === op ? w : null;
}

export function rearWatchLog(g: Game): string[] { return books.get(g)?.log ?? []; }
/** how many rows that log has ever been handed (it keeps the newest 200: a reader that prints new rows counts on this, not on its length) */
export function rearWatchRows(g: Game): number { return books.get(g)?.rows ?? 0; }
export function rearWatchSummary(g: Game): string {
  const T = REARWATCH_STATS, B = books.get(g), now = B ? [...[...B.pins].map(([m, P]) => `${m.callsign} on ${P.o.id}`), ...[...B.keeps].map(([m, R]) => `${m.callsign} keeps ${R.pin.o.id}`)].join(', ') : '';
  return `rear watch ${REARWATCH.on ? 'on' : 'OFF'}: ${now || 'nobody pinned'} · ${T.pins} pins · held back in ${T.held} entries (${T.late} let go on the clock) · put last in ${T.last} · frames with a way behind ${T.ways}, pinned ${T.pinned}, no rear mark sees it ${T.noLine} · rooms' doors kept over fall in ${REARWATCH.room ? T.rooms : 'OFF'} (${T.roomLate} let go on the clock)`;
}
