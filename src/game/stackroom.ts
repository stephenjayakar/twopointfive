// A DOOR STACK KEEPS EVERY MAN INSIDE A ROOM. the maintainer, 10-10, the records office, the pair sent to the hall door with him on its latch jamb: "the guy on the
// left navigated to the *outside* and was pushing on the wall to try to get in. seems like a bug -- stacking on a door should always put everyone within a
// room. or maybe an adjacent one on the other side of the door if the room is too small". Measured on the build before this file (tools/qa/stackroom-check.ts):
// a pair with only one jamb free was dealt its second place a `fileGap` further along the wall with NOTHING asked of the floor there (orders.ts stackPostsOn's
// last line) — in a corner that is a point inside the side wall or beyond it, and a walk to a point beyond a wall ends on the wall's far side: the yard. The same
// held, more rarely, for a mark tucked along the wall (doortools.ts), a place stood back from a door (rearPosts), a charge's stand-off and the marks the men
// work out for a jambless face: each was asked for floor and a line to the doorway's front, never WHOSE floor — a line through the next doorway standing open
// is a line, and its far side is another room.
//
//   THE FACE'S FLOOR   the nav cells a man can walk to from the floor before that face of the door without going through ANY doorway (this one included) —
//                      flooded once per face, cell to cell, a step across a frame line inside its opening never taken. A room, or a yard: 'the room (or
//                      space) that face of the door is in'. A mark is ON it when its own cell is free and in the flood and the walk to that cell from
//                      the doorway is not a way round a wall (`roundM` + `roundK` × the straight line: a yard that wraps a building is one flood).
//   THE RULE           every mark a door order deals — the stack, its tucked form, a charge's stand-off, where the other pair steps back to — is on the
//                      face's floor. One that is not is dealt again, the first of these that has floor a body's room (`apart`) from every other mark, from
//                      Sam and from marks teammates hold on this door, out of every leaf's swing and off the opening's own lane:
//                        1 the next place along the wall on the OTHER jamb's side, past whoever stands there (Sam on a jamb has a man fall in behind him);
//                        2 the file turns the corner: behind the nearest man of his own file, straight off the door's wall;
//                        3 back from the door, to a hand of it (orders.ts rearPosts' places) — not the man who has the door to open;
//                        4 any floor of the face within `walkM` of walking, the nearest with a line to the doorway first;
//                        5 THE ROOM IS TOO SMALL: by a doorway of a room next to it that the team already holds (cleared.ts: one of ours has stood in it) —
//                          through one of the face's OTHER doors, the nearest by walking and one standing open first, within `nextM` of that doorway on its
//                          far face, never through a door locked against the team. That is the reading of his "an adjacent one on the other side of the door": the door BEHIND the stack, the way the team
//                          came — never the room about to be entered, never a room nobody has been in (open floor — a yard, a hall —
//                          only while one of the team stands on it), and outdoors only right by a door, never round the building;
//                        6 anywhere on the face's floor, off the opening's own lane, a body fits (`squeeze` apart).
//                        7 A PASSAGE NO WIDER THAN ITS DOOR (every cell before the door is in the opening's lane): down it in file, `laneBack` from the
//                          doorway, the nearest first — the build stacked men there, and an order is not refused where there is floor to stand on.
//                      A mark dealt again takes the facing, the wall shoulder and the file of the place it is dealt (the other wall's; his file-mate's;
//                      a stood-back man's); the man who has the door to open (`lead`) is only ever dealt floor of the face itself (1, 2, 4, 6, 7).
//                      A jamb man dealt again keeps `lead` only where no other mark of the set has it: the door has one opener, the man still on a jamb.
//                      With none of them the order has no room on that door, in the order's own words, as for any face without floor.
// STACKROOM.on off = none of it runs: every mark as the build before this file dealt it. On in the page; the frozen harness stand holds it off (TPS_STACKROOM=1
// turns it on for any headless tool), the shipped stand has it on; a recording carries it. Nothing here is state the game depends on: the floods are worked out
// again from the nav grid whenever its cells change (a wall blown, furniture gone), so there is nothing to save. Nothing is rolled: no die.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { Vec3, v3 } from '../math/vec';
import type { Game } from './game';
import type { Door } from './doors';
import type { StackPost } from './orders';
import { doorwayInWay } from './doorway';
import { doorPt, alongOf, offOf } from './doortools';
import { propGap } from './roomclear';
import { crossesDoor } from './guards';
import { REARWATCH, rearWays, rearSees } from './rearwatch';

export const STACKROOM = {
  /** THE switch: off = every door order's marks as they were dealt before this file */
  on: true,
  /** a body's room between a mark dealt again and every other mark, Sam and marks held on the door · … in the last resort (6) */
  apart: 0.75, squeeze: 0.5,
  /** a mark is round a wall, not on the face's floor, when the walk to it from the doorway is over `roundM` + `roundK` × the straight line */
  roundM: 2.0, roundK: 1.6,
  /** (4) how far a man walks from the doorway for a place on the face's floor · (5) how far the next room's doorway may be by walking, and how far from that
   *  doorway its places are */
  walkM: 9, nextWalkM: 14, nextM: 3.5,
  /** (7) how far back from the doorway a place in the opening's own lane is, down a passage no wider than its door */
  laneBack: 1.6,
  /** OUT OF THE ROOM'S VIEW (stackViewFix, below; needs `on`): a plain 'stack up' on a door whose leaf STANDS OPEN deals its places along the door's own wall
   *  out of what the floor beyond sees through the opening, where the face's floor has such places. Off = the open door's stack as it was dealt. */
  view: true,
  /** … and (`viewHand`) a hand of the opening dealt more places than it has men to take them without crossing its front gives the rest to the other hand, so
   *  no place asks a man to cross the front of an open door where the wall has room. Off = each place moves along its own hand only. */
  viewHand: true,
  /** a leaf at this angle or more (rad), unlatched, stands open (one off its hinges always does) · a place is IN VIEW when `viewCells` nav cells of the floor
   *  within `viewFar` m beyond the door have a line to it through the opening at `viewEye` m, the leaves as they stand (the play-through watcher's measure) */
  viewAjar: 0.6, viewCells: 3, viewFar: 7, viewEye: 1.2,
  /** the places tried: from the jamb on along the wall every `viewStep` m to `viewPast` m, at the makers' own distance off the wall, then `viewOff` · a body's
   *  room between one of them and every other mark · a man is ON a hand of the opening when he stands `viewOut` m or more past that jamb, on this face
   *  within `viewMen` m of the door (before the opening, or further off, he can take a place on either hand without crossing) · the door's wall stands behind
   *  a place when something solid is met between it and `viewWall` m beyond the door's line */
  viewStep: 0.3, viewPast: 4.2, viewOff: 0.4, viewApart: 0.85, viewOut: 0.3, viewMen: 12, viewWall: 0.35,
};
/** QA, since the page loaded — a menu's questions included (a row asks for its marks to know whether it can be given): marks asked about · found off the
 *  face's floor · dealt again by rule 1‥7 (`other` jamb's wall, `behind` his file, `rear`, `floor`, `next` room, `squeezed`, down the `lane`) · orders left without room ·
 *  tucks, re-files and step-backs not taken */
export const STACKROOM_STATS = { asked: 0, off: 0, other: 0, behind: 0, rear: 0, floor: 0, next: 0, squeezed: 0, lane: 0, none: 0, kept: 0, unled: 0,
  /** stackViewFix: open-door stacks asked about · marks in view of the floor beyond · marks across the opening from the men · … moved out of view · … onto the
   *  men's hand · … left where they were (no such floor) · places a man already stood on, kept his (counted in the two before as well) */
  viewAsked: 0, viewIn: 0, viewAcross: 0, viewOut: 0, viewOver: 0, viewLeft: 0, viewStood: 0 };

const flat = v3.distXZ, yawTo = v3.yawTo;
/** a face's floor: per nav cell the steps of walking from the cell it was flooded from (−1: not on it) · its cells, the nearest first */
interface Floor { seed: number; dist: Int16Array; cells: number[] }
interface Book { nav: unknown; sig: number; doors: number; near: Uint8Array | null; floors: Map<Door, [Floor | null | undefined, Floor | null | undefined]> }
const books = new WeakMap<Game, Book>();

/** orders.ts ORDERS.inWay: an ask made only to be looked at leaves the book as it stood. The floors and the doorway cells such an ask read for the first
 *  time are forgotten again, so the ask that later reads them for a deal reads them when it always did (a floor's seed is taken off the leaves as they stand
 *  at the reading). Call the answer to put the book back. */
export function stackRoomBookKeep(g: Game): () => void {
  const K = books.get(g); if (!K) return () => { books.delete(g); };
  const near = K.near, floors = new Map([...K.floors].map(([d, pair]) => [d, [pair[0], pair[1]] as [Floor | null | undefined, Floor | null | undefined]]));
  return () => { K.near = near; K.floors = floors; books.set(g, K); };
}

function bookOf(g: Game): Book {
  const nav = g.col.nav, sig = (g.engine.world as { geomSerial?: number }).geomSerial ?? 0;   // (the grid's cells change in place — a wall blown, furniture gone: wallbreak.ts and furnblast.ts move the serial as they rebake)
  let K = books.get(g);
  if (!K || K.nav !== nav || K.sig !== sig || K.doors !== g.doors.list.length) { K = { nav, sig, doors: g.doors.list.length, near: null, floors: new Map() }; books.set(g, K); }
  return K;
}
const centre = (g: Game, c: number): Vec3 => { const nav = g.col.nav; return [((c % nav.W) + 0.5) * nav.cell, 0, (((c / nav.W) | 0) + 0.5) * nav.cell]; };
/** some doorway's frame line lies between a and b, inside its opening — or one of them is ON it (guards.ts crossesDoor's own question, but a point on the
 *  line is on neither face: a nav cell whose middle is on a frame line would else join the two rooms) */
function doorBetween(g: Game, a: Vec3, b: Vec3): boolean {
  for (const o of g.doors.list) { if (flat(a, o.frameCentre) > o.def.width + 1.5) continue;
    const pa = offOf(o, a, 1), pb = offOf(o, b, 1); if ((pa > ON_LINE && pb > ON_LINE) || (pa < -ON_LINE && pb < -ON_LINE)) continue;
    const t = Math.abs(pa - pb) < 1e-9 ? 0.5 : Math.min(1, Math.max(0, pa / (pa - pb))), at = alongOf(o, [a[0] + (b[0] - a[0]) * t, 0, a[2] + (b[2] - a[2]) * t]);
    if (at >= -0.1 && at <= o.def.width + 0.1) return true; }
  return false;
}
const ON_LINE = 0.02;

/** the floor before face `side` of `d` (null: that face has none) */
function floorOf(g: Game, d: Door, side: 1 | -1): Floor | null {
  const K = bookOf(g); let pair = K.floors.get(d); if (!pair) { pair = [undefined, undefined]; K.floors.set(d, pair); }
  const at = side > 0 ? 0 : 1; if (pair[at] !== undefined) return pair[at]!;
  const nav = g.col.nav, W = nav.W, H = nav.H, cs = nav.cell;
  if (!K.near) { K.near = new Uint8Array(W * H);   // (cells a frame line can pass by: the only steps asked about a doorway)
    for (const o of g.doors.list) { const r = o.def.width / 2 + 1.0, c = o.frameCentre;
      for (let z = Math.max(0, Math.floor((c[2] - r) / cs)); z <= Math.min(H - 1, Math.floor((c[2] + r) / cs)); z++) for (let x = Math.max(0, Math.floor((c[0] - r) / cs)); x <= Math.min(W - 1, Math.floor((c[0] + r) / cs)); x++) K.near[nav.idx(x, z)] = 1; } }
  const near = K.near, free = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && nav.blocked[nav.idx(x, z)] !== 1;
  // the cell it is flooded from: the free cell nearest the doorway's front whose middle is on this face, before the opening
  // (… with a line to that front, where any has one: not the floor beyond a thin wall or a parapet by the door)
  let seed = -1, best = Infinity; const w = d.def.width, front = doorPt(d, w / 2, 0.55, side);
  const fx = Math.floor(front[0] / cs), fz = Math.floor(front[2] / cs);
  for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) { const x = fx + dx, z = fz + dz; if (!free(x, z)) continue;
    const c = centre(g, nav.idx(x, z)), b = offOf(d, c, side), a = alongOf(d, c); if (b < 0.05 || b > 1.8 || a < -0.3 || a > w + 0.3) continue;
    const s = flat(c, front) + (g.col.solidBlocked([front[0], 0.45, front[2]], [c[0], 0.45, c[2]]) ? 10 : 0); if (s < best) { best = s; seed = nav.idx(x, z); } }
  if (seed < 0) { pair[at] = null; return null; }
  const dist = new Int16Array(W * H).fill(-1), cells = [seed]; dist[seed] = 0;
  for (let qi = 0; qi < cells.length; qi++) { const c = cells[qi], x = c % W, z = (c / W) | 0, here = centre(g, c);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, nz = z + dz; if (!free(nx, nz)) continue; const n = nav.idx(nx, nz); if (dist[n] >= 0) continue;
      if ((near[c] || near[n]) && doorBetween(g, here, centre(g, n))) continue;   // (no step through a doorway: this one's or any other's)
      dist[n] = Math.min(32000, dist[c] + 1); cells.push(n); } }
  const F: Floor = { seed, dist, cells }; pair[at] = F; return F;
}
/** steps of walking from the doorway to `p` on that floor (−1: p is not on it) — by p's own cell, or one beside it with nothing between its middle and p */
function stepsTo(g: Game, F: Floor, p: Vec3): number {
  const nav = g.col.nav, x = Math.floor(p[0] / nav.cell), z = Math.floor(p[2] / nav.cell); if (x < 0 || z < 0 || x >= nav.W || z >= nav.H || nav.blocked[nav.idx(x, z)] === 1) return -1;
  const own = nav.idx(x, z); if (F.dist[own] >= 0 && !doorBetween(g, centre(g, own), p)) return F.dist[own];
  let best = -1;   // (a mark by a frame line: its cell's middle can be the other face's)
  for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, nz = z + dz; if ((!dx && !dz) || nx < 0 || nz < 0 || nx >= nav.W || nz >= nav.H) continue;
    const c = nav.idx(nx, nz); if (F.dist[c] < 0 || (best >= 0 && F.dist[c] + 1 >= best)) continue; const m = centre(g, c);
    if (doorBetween(g, m, p) || g.col.solidBlocked([m[0], 0.45, m[2]], [p[0], 0.45, p[2]])) continue; best = F.dist[c] + 1; }
  return best;
}
function onFloor(g: Game, F: Floor, p: Vec3): boolean {
  const s = stepsTo(g, F, p); return s >= 0 && s * g.col.nav.cell <= STACKROOM.roundM + STACKROOM.roundK * flat(centre(g, F.seed), p);
}

/** is `p` on the floor of face `side` of `d` — the room (or the space) that face is in. True with the switch off, and for a face with no floor at all
 *  (nothing to hold a mark to: the makers' own answer stands). */
export function stackRoomHas(g: Game, d: Door, side: 1 | -1, p: Vec3): boolean {
  if (!STACKROOM.on) return true; const F = floorOf(g, d, side); return !F || onFloor(g, F, p);
}
/** … the same, counted: a tuck or a step back that was not taken for it (doortools.ts) */
export function stackRoomKeeps(g: Game, d: Door, side: 1 | -1, p: Vec3): boolean { const ok = stackRoomHas(g, d, side, p); if (!ok) STACKROOM_STATS.kept++; return ok; }

/** two places are the SAME mark within this. Under the least step between two places the open-door rule deals — 0.15 m, the two rows off the wall
 *  (`jambOut`, `viewOff`); along it the step is `viewStep` — so a place exactly one step from a man's is never 'his' by a rounding. (It was 0.15 itself:
 *  7.85 − 7.70 is a hair under it and 0.55 − 0.40 a hair over, so whether a man a row nearer the wall 'stood on' the dealt mark hung on the door's coordinates.) */
const SAME_M = 0.1;
/** is `q` the mark a man of the squad already STANDS on at this door (his order's post, he on it)? The same mark, not one a step along */
function stoodAt(g: Game, d: Door, q: Vec3): boolean {
  const O = g.orders;
  for (const m of O.squad()) { const A = O.of(m); if (A && m.state !== 'dead' && A.door === d && A.post && flat(A.post, q) < SAME_M && flat(m.char.pos, A.post) < 0.6) return true; }
  return false;
}
/** doorway.ts FURNITURE (the doors' rule: a place a piece of furniture stands on is the furniture's), asked of a place THIS file deals — only in a tree
 *  whose orders carry that rule, and never of the mark a man of the squad already stands on at this door (he shoved the thing aside: asked again, he keeps it) */
function furnished(g: Game, d: Door, q: Vec3): boolean {
  const O = g.orders as typeof g.orders & { onFurniture?(p: Vec3): boolean }; return !!O.onFurniture?.(q) && !stoodAt(g, d, q);
}
/** THE RULE over a dealt set of marks (the head comment): every one of `posts` that is not on the floor of face `side` of `d` is dealt again; the rest are
 *  returned as they came, in their order. `taken`: Sam, and the marks teammates hold on this door. `minM`: no mark dealt again is nearer the doorway's middle
 *  than this (a charge's stand-off). Null: one of them has no room at all. */
export function stackRoomFix<P extends StackPost>(g: Game, d: Door, side: 1 | -1, posts: P[] | null, taken: Vec3[], minM = 0): P[] | null {
  if (!posts || !STACKROOM.on) return posts;
  const F = floorOf(g, d, side); if (!F) return posts;
  const S = STACKROOM, T = STACKROOM_STATS; T.asked += posts.length;
  const bad = posts.map(P => !onFloor(g, F, P.pos)); if (!bad.some(b => b)) return posts;
  const out = [...posts], w = d.def.width, c = d.frameCentre, K = g.orders.knobs, front: Vec3 = doorPt(d, w / 2, K.jambOut, side, 0.45), th = d.def.closedDir;
  const sees = (a: Vec3, q: Vec3) => !g.col.solidBlocked([a[0], 0.45, a[2]], [q[0], 0.45, q[2]]);
  const offLane = (q: Vec3) => Math.abs(alongOf(d, q) - w / 2) >= w / 2 + 0.25;
  const handOf = (q: Vec3) => alongOf(d, q) > w / 2 ? 1 : -1;
  /** a place along the door's wall, as orders.ts deals one: faced down the wall at the doorway, the wall on the shoulder that side gives */
  const onWall = (q: Vec3, hand: number): { face: number; stackSide: -1 | 1 } => { const fx = -Math.cos(th) * hand, fz = -Math.sin(th) * hand, nx = -Math.sin(th) * side, nz = Math.cos(th) * side;
    return { face: Math.atan2(fx, fz), stackSide: (nx * fz - nz * fx >= 0 ? 1 : -1) as -1 | 1 }; };
  for (let i = 0; i < out.length; i++) { if (!bad[i]) continue; T.off++;
    const P = out[i], used = [...taken, ...out.filter((_, j) => j !== i && !bad[j]).map(o => o.pos)], hand = handOf(P.pos);
    let got: Partial<StackPost> | null = null;
    // (GLASS IS NOT COVER — orders.ts behindGlass: first with the places a round reaches through a pane counted as no floor, as the makers do; and each of
    //  those first with the places furniture stands on left to the furniture — never at the price of an answer)
    for (const [glass, shy] of [[true, true], [true, false], [false, true], [false, false]]) { if (got) break;
      const fits = (q: Vec3, apart = S.apart) => onFloor(g, F, q) && flat(q, c) >= minM && !used.some(o => flat(o, q) < apart) && !doorwayInWay(g, q) && !(glass && g.orders.behindGlass(d, side, q)) && !(shy && furnished(g, d, q));
      const clear = (q: Vec3) => !g.props.props.some(pr => propGap(pr, q) < 0.3);   // (a cell's middle, not a place by a wall: not up against the furniture)
      // 1 the other jamb's wall, the next place past whoever stands there
      for (let k = 0; k < 4 && !got; k++) { const a = hand > 0 ? -K.jambPast - k * K.fileGap : w + K.jambPast + k * K.fileGap, p = doorPt(d, a, K.jambOut, side);
        if (g.col.nav.isBlocked(p[0], p[2]) || !sees(front, p)) break;   // (the wall — or the floor — runs out)
        if (fits(p)) { got = { pos: p, ...onWall(p, -hand), group: P.group === undefined ? undefined : hand > 0 ? 1 : 0 }; T.other++; } }
      // 2 the file turns the corner: behind the nearest man of his own file, straight off the door's wall
      if (!got) for (const M of out.filter((o, j) => j !== i && !bad[j] && handOf(o.pos) === hand).sort((a, b) => flat(a.pos, P.pos) - flat(b.pos, P.pos))) {
        let prev = M.pos; for (let k = 1; k <= 3 && !got; k++) { const p = doorPt(d, alongOf(d, M.pos), offOf(d, M.pos, side) + k * K.fileGap, side);
          if (g.col.nav.isBlocked(p[0], p[2]) || !sees(prev, p)) break; prev = p;
          if (fits(p) && offLane(p)) { got = { pos: p, face: yawTo(p, c), stackSide: M.stackSide, group: M.group }; T.behind++; } }
        if (got) break; }
      // 3 back from the door, to a hand of it — not the man who has the door to open: he stays as near it as there is floor (4)
      if (!got && !P.lead) { const r = g.orders.rearPosts(d, side, 6, []).find(R => fits(R.pos)); if (r) { got = { pos: r.pos, face: r.face, stackSide: r.stackSide, group: r.group }; T.rear++; } }
      // 4 any floor of the face within a walk, the nearest with a line to the doorway first
      if (!got) { let bs = Infinity, q: Vec3 | null = null; for (const cc of F.cells) { const steps = F.dist[cc] * g.col.nav.cell; if (steps > S.walkM || steps >= bs) break; const p = centre(g, cc);
          if (offOf(d, p, side) < K.jambOut - 0.1 || !offLane(p) || !fits(p) || !clear(p)) continue; const s = steps + (sees(front, p) ? 0 : 3); if (s < bs) { bs = s; q = p; } }
        if (q) { got = { pos: q, face: yawTo(q, c), group: P.group === undefined ? undefined : 2 }; T.floor++; } }
      // 5 the room is too small: by a doorway of a room next to it that the team already holds — never the man who has the door to open
      if (!got && !P.lead && !glass) { const N = nextRoom(g, d, side, F, used, minM, shy); if (N) { got = { ...N, group: P.group === undefined ? undefined : 2 }; T.next++; } }
      // 6 anywhere on the face's floor, off the opening's lane, a body fits
      if (!got && !glass) for (const cc of F.cells) { const p = centre(g, cc); if (offLane(p) && fits(p, S.squeeze) && clear(p)) { got = { pos: p, face: yawTo(p, c), group: P.group === undefined ? undefined : 2 }; T.squeezed++; break; } }
      // 7 a passage no wider than its door: down it in file, stood back from the doorway past where a leaf swings, the nearest first
      if (!got && !glass) for (const apart of [S.apart, S.squeeze]) { if (got) break; for (const cc of F.cells) { if (F.dist[cc] * g.col.nav.cell > S.walkM) break; const p = centre(g, cc);
          if (offOf(d, p, side) >= S.laneBack && fits(p, apart) && clear(p)) { got = { pos: p, face: yawTo(p, c), group: P.group === undefined ? undefined : 2 }; T.lane++; break; } } }
    }
    if (!got) { T.none++; return null; }
    // (the door has ONE opener: a jamb man dealt again is off his jamb, and with a man still on the other jamb the handle is that man's — doortools.ts picks
    //  its lead among the `lead` marks by how far along the door's wall each is, and a mark dealt past the latch jamb would have taken it from him)
    const lead = P.lead && !out.some((o, j) => j !== i && !bad[j] && o.lead); if (P.lead && !lead) T.unled++;
    out[i] = { ...P, ...got, lead }; bad[i] = false; }
  return out;
}

// ---------------------------------------------------------------- OUT OF THE ROOM'S VIEW (STACKROOM.view)
// A stack told to wait on a door that already STANDS OPEN was dealt the same jamb marks as on a shut one — and a jamb mark is a body's width from the opening:
// over every open door face of the squad levels 56 % of the places dealt were in plain view of the floor beyond (tools/qa/stackview-trace.ts), the jamb men
// nearly always, and two in five were across the opening from where the men stood. A shut leaf stops a round and hides a man; an open one does neither.
// So, for the plain 'stack up' only (the door tools file their own stacks and the entry is theirs): each place the floor beyond SEES is dealt again further
// along the door's own wall, the first place from that jamb the floor beyond does not see — on the face's own floor (the rule above), a body clear of every
// other mark, of Sam and of marks held on the door, never where another door swings, never behind glass a round reaches through, and never losing the line a
// place had to an open way at the stack's back (rearwatch.ts: the rear man's watch is dealt from his MARK). With `viewHand` a hand of the opening that was
// dealt more places than it has men to take them without crossing gives the ones nearest the frame to the other hand first, behind the file already there,
// so nobody is asked to cross the front of an open door to stand and wait. A place with no such floor stays where it was. Nothing else of the mark changes but its facing (down the wall at the doorway, as any wall mark);
// the door's one opener is the place nearest the frame. No pace, no sound, no gun: a silent team is exactly as quiet as before. Shut doors: not asked.
/** is `p` (on face `side`) in view of the floor beyond the door through its opening */
function inView(g: Game, d: Door, far: Vec3[], p: Vec3): boolean {
  const S = STACKROOM, P: Vec3 = [p[0], S.viewEye, p[2]]; let n = 0;
  for (const q of far) if (crossesDoor(q, p, d) && !g.col.segmentBlocked([q[0], S.viewEye, q[2]], P) && ++n >= S.viewCells) return true;
  return false;
}
/** the nav cells within `viewFar` of the doorway on the face the men are NOT on */
function farCells(g: Game, d: Door, side: 1 | -1): Vec3[] {
  const S = STACKROOM, nav = g.col.nav, c = d.frameCentre, n = Math.ceil(S.viewFar / nav.cell), cx = Math.floor(c[0] / nav.cell), cz = Math.floor(c[2] / nav.cell), L: Vec3[] = [];
  for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) { const q: Vec3 = [(cx + dx + 0.5) * nav.cell, 0, (cz + dz + 0.5) * nav.cell];
    if (flat(q, c) <= S.viewFar && !nav.isBlocked(q[0], q[2]) && (offOf(d, q, 1) >= 0 ? 1 : -1) !== side) L.push(q); }
  return L;
}
export function stackViewOpen(d: Door): boolean { return !!d.off || (!d.latched && Math.abs(d.angle) >= STACKROOM.viewAjar); }
/** doortools.ts `holders`: how far from the frame's centre a plain stack's mark on this door can be — the makers' 2.6 m, and with the leaf standing open as far
 *  along the wall as this rule deals (a man waiting out of view down the wall still holds the door, and steps back with his mate when a tool comes onto it) */
export function stackViewReach(d: Door): number { return STACKROOM.on && STACKROOM.view && stackViewOpen(d) ? Math.max(2.6, d.def.width / 2 + STACKROOM.viewPast + 0.7) : 2.6; }
/** QA: is this place in the view the rule measures (whatever the switches say) */
export function stackViewSees(g: Game, d: Door, side: 1 | -1, p: Vec3): boolean { return inView(g, d, farCells(g, d, side), p); }
/** orders.ts, the plain 'stack up': `posts` as the room rule left them → the same marks with the ones in view (and, `viewHand`, the ones across the opening
 *  from `men`) dealt again along the door's wall. Returned as they came when the leaf does not stand open, with the switch off, or with nothing to move. */
export function stackViewFix<P extends StackPost>(g: Game, d: Door, side: 1 | -1, posts: P[] | null, taken: Vec3[], men: { char: { pos: Vec3 } }[]): P[] | null {
  const S = STACKROOM; if (!posts || !S.on || !S.view || !stackViewOpen(d)) return posts;
  const F = floorOf(g, d, side); if (!F) return posts;
  const T = STACKROOM_STATS, K = g.orders.knobs, w = d.def.width, c = d.frameCentre, th = d.def.closedDir, far = farCells(g, d, side); T.viewAsked++;
  const front: Vec3 = doorPt(d, w / 2, K.jambOut, side, 0.45), handOf = (q: Vec3) => alongOf(d, q) > w / 2 ? 1 : -1;
  // A STACK THAT STANDS DOES NOT CREEP. A place a man of this order already stands on as his mark on this face, that is no mark as dealt now — one this rule
  // gave him before a walker nudged the leaf or shoved a chair, or before the makers' own answer shifted under it — is his while it still stands as a place
  // (floor, out of the floor's view, off every swing, clear of Sam and of the marks that stand): it takes the place of a dealt mark nobody stands on, its
  // own hand's nearest first. Asked again, a stack that stands is told to stand where it stands; a man whose place has come into view is dealt again.
  const pre = new Map<number, Vec3>();
  { const O = g.orders, stood: Vec3[] = [];
    for (const m of men as Parameters<typeof O.of>[0][]) { const A = O.of(m); if (A && A.order === 'stack' && A.door === d && A.post && flat(m.char.pos, A.post) < 0.6 && offOf(d, A.post, side) > 0) stood.push(A.post); }
    const loose = posts.map((_, i) => i).filter(i => !stood.some(q => flat(q, posts[i].pos) < SAME_M));
    // (only a place this rule could have dealt, give or take the half step a shouldered man's mark is nudged: by the door's own wall, no further along it than
    //  the rule reaches — never where a man waits on open floor)
    const mine = stood.filter(q => offOf(d, q, side) < K.jambOut + 0.5 && Math.abs(alongOf(d, q) - w / 2) <= w / 2 + S.viewPast + 0.05 && !posts.some(P => flat(P.pos, q) < SAME_M)).sort((p, q) => flat(p, c) - flat(q, c));
    for (const q of loose.length ? mine : []) {
      if (g.col.nav.isBlocked(q[0], q[2]) || !onFloor(g, F, q) || g.col.solidBlocked(front, [q[0], 0.45, q[2]]) || doorwayInWay(g, q) || taken.some(o => flat(o, q) < S.apart) || inView(g, d, far, q)) continue;
      if ([...posts.filter((_, i) => !loose.includes(i)).map(P => P.pos), ...pre.values()].some(o => flat(o, q) < S.apart)) continue;
      const h = handOf(q), u = loose.filter(i => !pre.has(i)).sort((x, y) => (handOf(posts[x].pos) === h ? 0 : 1) - (handOf(posts[y].pos) === h ? 0 : 1) || flat(posts[x].pos, q) - flat(posts[y].pos, q))[0];
      if (u === undefined) break;
      // (nor a body's width from a dealt mark that will stand where it is — one out of view whose man is still on his way to it)
      if (loose.some(j => j !== u && !pre.has(j) && flat(posts[j].pos, q) < S.apart && !inView(g, d, far, posts[j].pos))) continue;
      pre.set(u, q); } }
  const at = (i: number) => pre.get(i) ?? posts[i].pos;
  const seen = posts.map((P, i) => !pre.has(i) && inView(g, d, far, P.pos)), across = posts.map(() => false);
  // ACROSS: a place a man would have to cross the front of the opening to reach. Each man near this face is on one hand of the opening or before it (free to go
  // to either; so is a man still far off); a hand dealt more places than it has men to take them without crossing gives up the ones nearest the frame (the same ones however often it is asked: the man who did cross stands on the outer one).
  if (S.viewHand) { const near = men.map(m => m.char.pos).filter(p => offOf(d, p, side) > 0 && flat(p, c) <= S.viewMen), hs = near.map(p => { const a = alongOf(d, p); return a >= w + S.viewOut ? 1 : a <= -S.viewOut ? -1 : 0; });
    for (const h of [1, -1]) { const room = men.length - hs.filter(x => x === -h).length;
      const mine = posts.map((_, i) => i).filter(i => handOf(at(i)) === h && Math.abs(alongOf(d, at(i)) - w / 2) < w / 2 + S.viewPast + 1).sort((a, b) => flat(at(a), c) - flat(at(b), c));
      let over = mine.length - room; for (const i of mine) { if (over <= 0) break; if (pre.has(i)) continue; across[i] = true; over--; } } }
  T.viewIn += seen.filter(Boolean).length; T.viewAcross += across.filter(Boolean).length;
  if (!seen.some(Boolean) && !across.some(Boolean) && !pre.size) return posts;
  // (rearwatch.ts: the ways at the stack's back as the marks stand — a place that has a line to one keeps a line to it)
  const ways = REARWATCH.on ? rearWays(g, d, side, posts.map(P => P.pos)) : [], keeps = posts.map(P => ways.filter(W => rearSees(g, P.pos, W.o, W.front)));
  const move = posts.map((_, i) => seen[i] || across[i]);
  // the places along each hand of the door's wall the floor beyond does not see, from the jamb out (made once a hand)
  const cands = new Map<number, { q: Vec3; glass: boolean }[]>(), candsOf = (h: number) => { let L = cands.get(h); if (L) return L; L = [];
    for (let past = K.jambPast; past <= S.viewPast + 1e-6; past += S.viewStep) { const a = h > 0 ? w + past : -past;
      // (the door's own wall must stand behind the place: where it ends, or another doorway opens in it, the file ends too — as the makers' files do)
      if (!g.col.solidBlocked(doorPt(d, a, K.jambOut, side, 0.45), doorPt(d, a, -S.viewWall, side, 0.45))) break;
      for (const off of [K.jambOut, S.viewOff]) { const q = doorPt(d, a, off, side);
      if (!g.col.nav.isBlocked(q[0], q[2]) && onFloor(g, F, q) && !g.col.solidBlocked(front, [q[0], 0.45, q[2]]) && !doorwayInWay(g, q) && !taken.some(o => flat(o, q) < S.apart) && !inView(g, d, far, q) && !furnished(g, d, q))
        L.push({ q, glass: g.orders.behindGlass(d, side, q) }); } }
    cands.set(h, L); return L; };
  /** the first such place on hand `h` a body clear of every place that stands (not behind glass a round reaches through while another will do — and, where
   *  rounds do go through panes, NEVER unless the mark as dealt is behind such glass already: the makers hold a place a pane gives away worse than one the
   *  opening does, so the rule moves no man from the one to the other; such a mark stays) */
  const place = (i: number, h: number, fixed: Vec3[]): Vec3 | null => {
    for (const shy of [true, false]) for (const C of candsOf(h)) if (!(shy && C.glass) && !fixed.some(o => flat(o, C.q) < S.viewApart) && keeps[i].every(W => rearSees(g, C.q, W.o, W.front))) return C.q;
    return null; };
  // dealt nearest the frame first (and by nothing else: asked again with the men on their places, the answer is the same). A place with nowhere to go STAYS, and then stands in the others' way:
  // the deal is run again with it standing (so no place is ever dealt onto a mark that turned out to stay); once that has settled, the places that stayed are
  // asked again against everything as it ended up (below), so `stay` at the end is the places with no room among the final ones.
  const order = posts.map((_, i) => i).filter(i => move[i]).sort((a, b) => flat(posts[a].pos, c) - flat(posts[b].pos, c));
  const stay = new Set<number>(); let got = new Map<number, { q: Vec3; h: number; over: boolean }>();
  const deal = (i: number, fixed: Vec3[]) => { const h0 = handOf(posts[i].pos); let h = -h0, q = across[i] ? place(i, h, fixed) : null;
    if (!q && seen[i]) { h = h0; q = place(i, h, fixed); }
    return q ? { q, h, over: h !== h0 } : null; };
  for (;;) { const fixed = posts.map((_, i) => i).filter(i => !move[i] || stay.has(i)).map(at); let failed = -1; got = new Map();
    for (const [i, q] of pre) got.set(i, { q, h: handOf(q), over: handOf(q) !== handOf(posts[i].pos) });
    for (const i of order) { if (stay.has(i)) continue; const G = deal(i, fixed);
      if (!G) { failed = i; break; } fixed.push(G.q); got.set(i, G); }
    if (failed < 0) break; stay.add(failed); }
  // (a place may have stayed only because one nearer the frame held the floor it wanted, in a pass that one then found no room in itself. So every place
  //  that stayed is asked again with all the others where they ended up, nearest the frame first, until none of them moves — else which of two places
  //  moved hung on where the men stood when the order came, and a stack asked again from its marks shuffled a step: the barracks' bunk room door, the jamb man)
  for (let again = stay.size > 0; again;) { again = false;
    for (const i of order) { if (!stay.has(i)) continue; const G = deal(i, posts.map((_, j) => j).filter(j => j !== i).map(j => got.get(j)?.q ?? at(j)));
      if (G) { stay.delete(i); got.set(i, G); again = true; break; } } }
  T.viewLeft += stay.size; T.viewStood += pre.size; if (!got.size) return posts;
  const out = [...posts]; let led = false;
  for (const [i, G] of got) { const P = posts[i], h = G.h; if (G.over) T.viewOver++; else T.viewOut++;
    const fx = -Math.cos(th) * h, fz = -Math.sin(th) * h, nx = -Math.sin(th) * side, nz = Math.cos(th) * side;   // (as a wall mark is faced: down the wall at the doorway)
    // (a place given to the other hand joins that hand's file: 0 past the far jamb, 1 before the hinge — as the room rule's own change of wall writes it)
    const group = G.over && P.group !== undefined && P.group !== 2 ? (h > 0 ? 0 : 1) : P.group;
    out[i] = { ...P, pos: G.q, face: Math.atan2(fx, fz), stackSide: (nx * fz - nz * fx >= 0 ? 1 : -1) as -1 | 1, group }; led = led || P.lead; }
  // (the door has one opener, the man nearest its frame: a jamb man dealt again down the wall is no longer he)
  if (led) { let best = 0; for (let i = 1; i < out.length; i++) if (flat(out[i].pos, c) < flat(out[best].pos, c)) best = i; for (let i = 0; i < out.length; i++) if (out[i].lead !== (i === best)) out[i] = { ...out[i], lead: i === best }; }
  return out;
}

/** (5) a place by a doorway of a room next to the face's own, one the team holds: through one of the face's other doors — never the ordered one, never into
 *  the room it opens on, never a room nobody of the team has stood in (open floor — a yard, a hall: where one of the team stands now), never through a door
 *  locked against the team — on that doorway's far face, within `nextM` of it */
function nextRoom(g: Game, d: Door, side: 1 | -1, F: Floor, used: Vec3[], minM: number, shy: boolean): { pos: Vec3; face: number } | null {
  const S = STACKROOM, K = g.orders.knobs, cs = g.col.nav.cell, into = floorOf(g, d, -side as 1 | -1), ways: { o: Door; far: 1 | -1; G: Floor; cost: number }[] = [];
  const Pl = g.player, ring = Pl.codes.size ? new Set([...Pl.keys, ...Pl.codes]) : Pl.keys;
  const ours: Vec3[] = [...(Pl.down ? [] : [Pl.char.pos]), ...g.orders.squad().filter(m => m.state !== 'dead').map(m => m.char.pos)];
  for (const o of g.doors.list) { if (o === d) continue;
    for (const s of [1, -1] as const) { const near = floorOf(g, o, s), far = -s as 1 | -1, G = floorOf(g, o, far); if (!near || !G || F.dist[near.seed] < 0) continue;
      const walk = F.dist[near.seed] * cs; if (walk > S.nextWalkM) continue;
      if (G.dist[F.seed] >= 0 || (into && G.dist[into.seed] >= 0)) continue;   // (its far face is this very floor, or the room about to be entered)
      const room = g.cleared.hasFloor(o, far) ? g.cleared.roomBy(o, far) : -1;
      if (room < 0 || (room ? !g.cleared.isKnown(room) : !ours.some(p => onFloor(g, G, p)))) continue;   // (held: one of ours has stood in it)
      if (o.latched && g.doors.lockedOut(o, doorPt(o, o.def.width / 2, 0.6, s), ring)) continue;
      ways.push({ o, far, G, cost: walk + (o.latched ? 6 : 0) }); } }
  ways.sort((a, b) => a.cost - b.cost);
  for (const { o, far, G } of ways) { const w = o.def.width, c = o.frameCentre, front = doorPt(o, w / 2, K.jambOut, far, 0.45);
    const fits = (q: Vec3) => onFloor(g, G, q) && flat(q, c) <= S.nextM && flat(q, d.frameCentre) >= minM && !used.some(u => flat(u, q) < S.apart) && !doorwayInWay(g, q) && !g.col.solidBlocked(front, [q[0], 0.45, q[2]]) && !(shy && furnished(g, d, q));
    for (let k = 0; k < 3; k++) for (const a of [w + K.jambPast + k * K.fileGap, -K.jambPast - k * K.fileGap]) { const q = doorPt(o, a, K.jambOut, far); if (fits(q)) return { pos: q, face: yawTo(q, c) }; }
    for (const back of [1.6, 2.5]) for (const lat of [w / 2 + 0.8, -w / 2 - 0.8, w / 2 + 1.5, -w / 2 - 1.5]) { const q = doorPt(o, w / 2 + lat, back, far); if (fits(q)) return { pos: q, face: yawTo(q, c) }; } }
  return null;
}

/** QA (tools/qa/stackroom-check.ts): the floor of a face as the rule reads it, whatever the switch says — is `p` on it · steps of walking to it · the middles
 *  of its cells between `lo` and `hi` steps from the doorway, the nearest first · where it was flooded from */
export function stackRoomProbe(g: Game, d: Door, side: 1 | -1) {
  const F = floorOf(g, d, side);
  return { floor: !!F, cells: F ? F.cells.length : 0, seed: F ? centre(g, F.seed) : null, has: (p: Vec3) => !!F && onFloor(g, F, p), steps: (p: Vec3) => F ? stepsTo(g, F, p) : -1,
    spots: (lo: number, hi: number): Vec3[] => F ? F.cells.filter(c => F.dist[c] >= lo && F.dist[c] <= hi).map(c => centre(g, c)) : [] };
}
export function stackRoomSummary(): string { const T = STACKROOM_STATS; return `stack rooms: ${T.off} of ${T.asked} marks off the face's floor · dealt again ${T.other} other jamb, ${T.behind} behind the file, ${T.rear} back, ${T.floor} floor, ${T.next} next room, ${T.squeezed} squeezed, ${T.lane} down the passage · ${T.none} no room · ${T.kept} tucks/step-backs not taken · ${T.unled} jamb men dealt again gave the door to the other jamb`; }
