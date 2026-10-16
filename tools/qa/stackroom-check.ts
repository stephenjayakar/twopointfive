// A DOOR STACK KEEPS EVERY MAN INSIDE A ROOM (src/game/stackroom.ts) — the check. the maintainer, 10-10: "the guy on the left navigated to the *outside* and was
// pushing on the wall to try to get in … stacking on a door should always put everyone within a room. or maybe an adjacent one on the other side of the door
// if the room is too small".
//
//   bun run tools/qa/stackroom-check.ts [id …] [--walk | --walk-off] [--verbose]      (no id: every level a squad plays, one after another; exit 1 on a failure;
//                                                                                    --walk-off: the walks played with the switch off — the build as it was)
//
// Per level (every row of the missions' tables with a squad, and the four other-look files), per door, per face, with 1‥N men, Sam where the row starts him,
// then on the latch jamb, then on the hinge jamb — and, in a squad of four, each pair with the other holding the door:
//   MARKS   every mark of 'stack up' (orders.ts stackPosts), of the door tools' stack (doortools.ts stackPosts, and dealStack with its step-backs) and of a
//           charge's stand-off is judged by the NAV GRID'S OWN WALK from the floor before the face — not by stackroom.ts's flood: the mark's cell is floor, the
//           walk ends ON the mark (a point beyond a wall ends on the wall's far side), it goes through NO doorway, and it is no way round a wall. One
//           doorway is allowed, for the rule's 'room next door': a door other than the ordered one, into a room the team holds, the mark by that doorway.
//   HELD    all of it again with every room of the level held by the team, so the rule's 'room next door' is open to it wherever a room is too small.
//           The same judge reads where each man is SENT by 'bang and clear', 'clear from outside' and 'open and clear' the moment they are given (the
//           door tools file the men again behind the man who opens).
//   SAM     … and with Sam stood ON each place the rule dealt when he was away (the spare floor of a narrow passage). An order the build gave is never
//           refused by the rule: that is a failure.
//   OFF     the same judged with STACKROOM.on off: the build as it was (its count is the size of the flaw).
//   --dump F  no judging: every set of marks with the rule off, a line each, appended to F. Run in this checkout and in one of the build before the rule (copy
//           this file there: it runs without stackroom.ts) — the two files must be the same, byte for byte: the off switch IS the build as it was.
//   WALK    (--walk) the furniture put home, the men put on the face's floor, Sam on a jamb, the order given, 14 s played: every man is ON his mark, and none went through a doorway on
//           the way. A man the order gave up on within a stride of a mark he had open floor to is a note and a count, not a failure: the mark is good. The records office first, as he played it: the pair from the yard, Sam on the hall door's latch jamb.
import { readFileSync, appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { LOOK_LEVELS } = await import(`${ROOT}/src/scene/look.ts`);
const SRM: any = await import(`${ROOT}/src/game/stackroom.ts`).catch(() => null);   // (null in a checkout from before the rule: --dump runs there too)
const { STACKROOM, stackRoomProbe, stackRoomSummary } = SRM ?? { STACKROOM: { on: false, nextM: 0 }, stackRoomProbe: null, stackRoomSummary: () => '' };
const { crossesDoor, doorCells } = await import(`${ROOT}/src/game/guards.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

type V = [number, number, number];
const DT = 1 / 60, args = process.argv.slice(2), WALK_OFF = args.includes('--walk-off'), WALK = WALK_OFF || args.includes('--walk'), VERBOSE = args.includes('--verbose'), DUMP = args.includes('--dump') ? args[args.indexOf('--dump') + 1] : null, ids = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--dump');
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), f2 = (p: V) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

async function stage(E: any, seed = 1) {
  Math.random = seeded(0xba46 + seed * 7919);
  const W: any = await standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) }); const g = W.game;
  STACKROOM.on = true;   // (the frozen stand holds the rule off: this check is about the rule, and turns it off itself where it wants the build as it was)
  g.godMode = true; g.playerInvisible = true;
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, `roomclear=${seed}`);
  const { why } = startFromQuery(g, new URLSearchParams(q)); if (why) throw new Error(`${E.id}: start refused — ${why}`);
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  step(20);
  return { W, g, step };
}
const pt = (d: any, a: number, b: number, side: number): V => { const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), H = d.def.hinge; return [H[0] + ux * a - uz * side * b, 0, H[1] + uz * a + ux * side * b]; };

/** the doorways a walk goes through, in order (a corner of the walk ON a frame line is on neither face: the faces either side of it are compared) */
function doorsThrough(g: any, pts: V[]): any[] {
  const hits: { o: any; i: number }[] = [];
  for (const o of g.doors.list) { const th = o.def.closedDir, H = o.def.hinge, pr = (p: V) => Math.cos(th) * (p[2] - H[1]) - Math.sin(th) * (p[0] - H[0]), al = (p: V) => (p[0] - H[0]) * Math.cos(th) + (p[2] - H[1]) * Math.sin(th);
    let last: V | null = null, ls = 0;
    pts.forEach((p, i) => { const v = pr(p), sg = v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0; if (!sg) return;
      if (last && sg !== ls) { const pa = pr(last), t = pa / (pa - v), x: V = [last[0] + (p[0] - last[0]) * t, 0, last[2] + (p[2] - last[2]) * t], at = al(x); if (at >= -0.1 && at <= o.def.width + 0.1) hits.push({ o, i }); }
      last = p; ls = sg; }); }
  return hits.sort((x, y) => x.i - y.i).map(h => h.o);
}
/** the judge: null = the mark is on the floor of that face's room · 'next' = by a doorway of a held room next to it · else what is wrong with it */
function judge(g: any, d: any, side: 1 | -1, from: V, q: V, dear: Set<number>): string | null {
  const nav = g.col.nav; if (nav.isBlocked(q[0], q[2])) return 'in a wall';
  const path: V[] | null = nav.findPath(from, q, 20000, (ix: number, iz: number) => dear.has(nav.idx(ix, iz)) ? 40 : 1); if (!path) return 'no way to it';
  const end = path.length ? path[path.length - 1] : from; if (flat(end, q) > 0.6) return `the walk ends ${flat(end, q).toFixed(1)} m off it`;
  let a = from, len = 0; for (const b of path) { len += flat(a, b); a = b; }
  const through: any[] = doorsThrough(g, [from, ...path]);
  if (!through.length) return len > 3 + 2 * flat(from, q) ? `round a wall (${len.toFixed(1)} m of walking for ${flat(from, q).toFixed(1)})` : null;
  if (through.length > 1) return `through ${through.length} doorways (${through.map(o => o.def.name).join(', ')})`;
  const o = through[0]; if (o === d) return 'through the ordered door';
  const far = sideOf(o, q); if (!g.cleared.isKnown(g.cleared.roomBy(o, far))) return `in a room nobody holds, through ${o.def.name}`;
  if (flat(q, o.frameCentre) > STACKROOM.nextM + 0.05) return `through ${o.def.name}, ${flat(q, o.frameCentre).toFixed(1)} m beyond it`;
  const into = stackRoomProbe(g, d, -side as 1 | -1); if (into.floor && into.has(q)) return 'in the room about to be entered';
  return 'next';
}

interface Tally { faces: number; asked: number; marks: number; bad: number; next: number; none: number; offBad: number; offNone: number; offSame: number; offDiff: number; walks: number; walkBad: number; moved: number }
const total: Tally = { faces: 0, asked: 0, marks: 0, bad: 0, next: 0, none: 0, offBad: 0, offNone: 0, offSame: 0, offDiff: 0, walks: 0, walkBad: 0, moved: 0 };
const totalHeld: Tally = { ...total };
const fails: string[] = [];

async function level(E: any): Promise<void> {
  let S: any; try { S = await hush(() => stage(E)); } catch (e) { fails.push(`${E.id}: did not start — ${e}`); console.log(`${E.id}: did not start — ${e}`); return; }
  const { g, step } = S, O = g.orders, D = g.doorTools, nav = g.col.nav, zero = (): Tally => ({ faces: 0, asked: 0, marks: 0, bad: 0, next: 0, none: 0, offBad: 0, offNone: 0, offSame: 0, offDiff: 0, walks: 0, walkBad: 0, moved: 0 }), T0 = zero(), H = zero(); let T = T0;
  const men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (!men.length) { console.log(`${E.id}: no squad`); return; }
  await hush(() => { for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true); step(30); });
  if (!O.active) { fails.push(`${E.id}: the orders are not live with the defenders down`); return; }
  const dear = doorCells(g) as Set<number>, home: V = [...g.player.char.pos] as V, tag = `${E.id}${E.look ? ' (other look)' : ''}`;
  const fail = (s: string) => { fails.push(`${tag} ${s}`); if (fails.length <= 400) console.log(`  FAIL ${tag} ${s}`); };
  const sets: { what: string; get: (d: any, side: 1 | -1, m: any[]) => any[] | null }[] = [
    { what: 'stack up', get: (d, side, m) => O.stackPosts(d, side, m) },
    { what: 'door tools', get: (d, side, m) => D.stackPosts(d, side, m) },
    { what: 'stand-off', get: (d, side, m) => D.standoffPosts(d, side, m.length, m) },
  ];
  const sig = (P: any[] | null) => P ? P.map(q => `${q.pos[0].toFixed(3)},${q.pos[2].toFixed(3)},${q.face.toFixed(3)},${q.lead ? 1 : 0}`).join(';') : 'null';
  if (DUMP) {   // every set of marks the build deals with the rule OFF (or, in a checkout from before it, as that build deals them), one line a set: two dumps that are the same file = the off switch is the build as it was
    STACKROOM.on = false; const lines: string[] = [];
    for (const d of g.doors.list) for (const side of [1, -1] as const) { const w = d.def.width, K = O.knobs;
      for (const [where, at] of [['away', null], ['latch', pt(d, w + K.jambPast, K.jambOut, side)], ['hinge', pt(d, -K.jambPast, K.jambOut, side)]] as [string, V | null][]) { if (at && nav.isBlocked(at[0], at[2])) continue; g.teleportPlayer(at ?? home);
        for (let n = 1; n <= men.length; n++) for (const X of sets) lines.push(`${tag}|${d.def.name}|${side}|${where}|${n}|${X.what}|${sig(X.get(d, side, men.slice(0, n)))}`);
        if (O.big && O.pairs().length > 1) for (const id of O.pairs()) { const hold = O.men(id), m = men.filter((x: any) => !hold.includes(x)); if (!hold.length || !m.length) continue;
          O.clear(); const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, id));
          if (!why) { const deal = (D as any).dealStack(d, side, m); lines.push(`${tag}|${d.def.name}|${side}|${where}|${id} holds|stack up|${sig(O.stackPosts(d, side, m))}`, `${tag}|${d.def.name}|${side}|${where}|${id} holds|door tools|${deal ? sig([...deal.posts, ...deal.back.values()]) : 'null'}`); }
          O.clear(); } }
      g.teleportPlayer(home); }
    appendFileSync(DUMP, lines.join('\n') + '\n'); console.log(`${tag}: ${lines.length} sets of marks dumped`); STACKROOM.on = true; return;
  }
  const look = (d: any, side: 1 | -1, from: V, m: any[], where: string, what: string, P: any[] | null, on: boolean) => {
    if (on) T.asked++; if (!P) { if (on) T.none++; else T.offNone++; return; }
    for (const q of P) { if (on) T.marks++; const j = judge(g, d, side, from, q.pos, dear);
      if (j === 'next') { if (on) T.next++; if (VERBOSE && on) console.log(`  next room: ${tag} ${d.def.name}${side > 0 ? '+' : '−'} ${m.length} men, ${where}, ${what}: ${f2(q.pos)}`); continue; }
      if (!j) continue;
      if (on) { T.bad++; fail(`${d.def.name}${side > 0 ? '+' : '−'} ${m.length} men, ${where}, ${what}: mark ${f2(q.pos)} ${j} · all: ${P.map(x => f2(x.pos)).join(' ')}`); } else T.offBad++; }
  };
  for (const held of [false, true]) { if (held) { if (WALK) { T = T0; STACKROOM.on = !WALK_OFF; await walks(E, S, men, T, fail, dear, home); STACKROOM.on = true; } g.cleared.roomAt(home); (g.cleared as any).knownRoom.fill(1); T = H; }   // (the walks are played on the floor as the row leaves it: before every room is called held)   // (… and again with every room of the level held by the team: the rule's 'room next door' is open to it)
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    const F = stackRoomProbe(g, d, side); if (!F.floor) continue; T.faces++; const from = F.seed as V, w = d.def.width, K = O.knobs;
    const sams: [string, V | null][] = [['Sam away', null], ['Sam on the latch jamb', pt(d, w + K.jambPast, K.jambOut, side)], ['Sam on the hinge jamb', pt(d, -K.jambPast, K.jambOut, side)]];
    for (const [where, at] of sams) { if (at && nav.isBlocked(at[0], at[2])) continue; g.teleportPlayer(at ?? home);
      for (let n = 1; n <= men.length; n++) { const m = men.slice(0, n);
        for (const X of sets) { STACKROOM.on = true; const P = X.get(d, side, m); look(d, side, from, m, where, X.what, P, true);
          STACKROOM.on = false; const Q = X.get(d, side, m); look(d, side, from, m, where, X.what, Q, false);
          STACKROOM.on = true; if (sig(P) !== sig(Q)) T.moved++;
          if (!P && Q) fail(`${d.def.name}${side > 0 ? '+' : '−'} ${n} men, ${where}, ${X.what}: REFUSED with the rule on where the build stacked them — was ${Q.map((x: any) => f2(x.pos)).join(' ')}`);
          // (SAM ON THE SPARE FLOOR: the places the rule dealt with him away are tried again with him stood on each — the compound's back passage, where the
          //  one place off the opening's lane was the spot he stood on and the order was refused)
          if (!at && X.what === 'stack up' && n === men.length && P && Q && sams.length < 6) for (const q of P) if (!Q.some((o: any) => flat(o.pos, q.pos) < 0.05) && !sams.some(([, a]) => a && flat(a, q.pos) < 0.3)) sams.push(['Sam on a place the rule dealt', [...q.pos] as V]); } }
      // the door tools' orders AS GIVEN (the file behind a bang, the pair working it from outside, a man on each jamb): where each man is sent the moment the order is given
      for (const id of ['bangClear', 'outside', 'openClear']) for (const on of [true, false]) { STACKROOM.on = on; D.bangs = 9; O.clear();
        const why = await hush(() => O.give(id, { kind: 'door', door: d, side }, 'all')); const P = men.map((x: any) => O.of(x)?.post).filter((p: any) => !!p).map((p: V) => ({ pos: p }));
        if (!why && P.length === men.length && sideOf(d, P[0].pos) === side) look(d, side, from, men, where, `'${id}' as given`, P, on);
        await hush(() => { O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); O.clear(); }); } STACKROOM.on = true;
      // the squad of four: each pair with the other holding this door on a 'stack up'
      if (O.big && O.pairs().length > 1) for (const id of O.pairs()) { const hold = O.men(id), m = men.filter((x: any) => !hold.includes(x)); if (!hold.length || !m.length) continue;
        O.clear(); const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, id)); const A = O.of(hold[0]);
        if (!why && A && A.post && sideOf(d, A.post) === side) { for (const on of [true, false]) { STACKROOM.on = on;
          look(d, side, from, m, `${where}, the ${id} pair holding it`, 'stack up', O.stackPosts(d, side, m), on);
          const deal = (D as any).dealStack(d, side, m); look(d, side, from, m, `${where}, the ${id} pair holding it`, 'door tools', deal ? [...deal.posts, ...deal.back.values()] : null, on); } STACKROOM.on = true; }
        O.clear(); }
    }
    g.teleportPlayer(home);
  } }
  T = T0;
  for (const k of Object.keys(total) as (keyof Tally)[]) { total[k] += T[k]; totalHeld[k] += H[k]; }
  console.log(`${tag} [${E.level ?? 'office.json'}]: ${g.doors.list.length} doors, ${T.faces} faces, ${men.length} men · ${T.asked} asked, ${T.marks} marks: ${T.bad} off the room's floor, ${T.next} by a held room's doorway, ${T.none} 'no room' · switch off: ${T.offBad} off the floor, ${T.offNone} 'no room' · ${T.moved} sets of marks changed by the rule · every room held: ${H.marks} marks, ${H.bad} off the floor, ${H.next} by a held room's doorway${WALK ? ` · walks: ${T.walks} played, ${T.walkBad} failed` : ''}`);
}

/** WALK: the order played. Men on the face's floor (or where the row starts them: the records office as he played it), Sam on a jamb */
/** a man the ORDER gave up on within a stride of his mark (orders.ts: not moved for a second inside a metre, his mark comes to his feet) though nothing stands
 *  between him and the mark the rule dealt and a body fits on it: the mark is good floor in his room — what stopped his feet is the walk's (a rear man with
 *  the cover's watch behind him treads on the spot: the warehouse's d_n+ at real door size), counted and printed, not a failure of the marks */
let stalled = 0;
function inReach(g: any, m: any, mark: V): boolean {
  const p = m.char.pos as V, at = g.orders.of(m)?.post as V | null, q: V = [mark[0], 0, mark[2]];
  return !!at && flat(at, p) < 0.1 && !g.col.solidBlocked([p[0], 0.45, p[2]], [mark[0], 0.45, mark[2]]) && !(g.col.collideCircle(q, m.char.radius, 0.2, 1.5) && flat(q, mark) > 0.15);   // (a body pressed to the door's wall is nudged a few centimetres off a jamb mark: still on it)
}
async function walks(E: any, S: any, men: any[], T: Tally, fail: (s: string) => void, dear: Set<number>, home: V) {
  const { g, step } = S, O = g.orders, nav = g.col.nav, K = O.knobs;
  const put = (gd: any, p: V, face: V) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.path = []; gd.pathGoal = null; gd.char.update(0); };
  const play = async (d: any, side: 1 | -1, where: string, secs: number, sameRoom: boolean) => {
    const why = await hush(() => O.give('stack', { kind: 'door', door: d, side }, 'all')); if (why) return;   // (no room on that door: the marks' judge has counted it)
    const posts = men.map(m => O.of(m)?.post as V | null); if (posts.some(p => !p) || sideOf(d, posts[0]!) !== side) { O.clear(); return; }   // (the four took the other face: that face's own turn plays it)
    if (men.some(m => m.state === 'dead')) { fail(`WALK ${d.def.name}: a teammate is down — the check's own staging`); O.clear(); return; }
    T.walks++; const from = stackRoomProbe(g, d, side).seed as V, next = posts.map(p => judge(g, d, side, from, p!, dear) === 'next');
    const last = men.map(m => [...m.char.pos] as V), crossed = men.map(() => [] as string[]); let done = -1;
    await hush(() => { for (let f = 0; f < secs * 60; f++) { step(1);
      men.forEach((m, i) => { const p = m.char.pos as V; for (const o of g.doors.list) if (crossesDoor(last[i], p, o)) crossed[i].push(o.def.name); last[i] = [...p] as V; });
      if (men.every((m, i) => flat(m.char.pos, posts[i]!) < 0.45)) { if (done < 0) done = f; if (f > done + 30) break; } } });
    men.forEach((m, i) => { const gap = flat(m.char.pos, posts[i]!);
      const j = judge(g, d, side, from, posts[i]!, dear);
      if (j && j !== 'next') { T.walkBad++; fail(`WALK ${d.def.name}${side > 0 ? '+' : '−'}, ${where}: ${m.callsign}'s mark ${f2(posts[i]!)} is ${j} — he ends at ${f2(m.char.pos)}`); }
      else if (gap >= 0.6 && gap < 1.0 && inReach(g, m, posts[i]!)) { stalled++; console.log(`    note: WALK ${d.def.name}${side > 0 ? '+' : '−'}, ${where}: ${m.callsign} stalled ${gap.toFixed(1)} m short of his mark ${f2(posts[i]!)} with open floor between — the walk's, not the mark's`); }
      else if (gap >= 0.6) { if (VERBOSE || process.env.WHY) console.log(`    why: ${m.callsign} ${O.statusOf(m)} arrived=${O.of(m)?.arrived} door angle ${d.angle?.toFixed?.(2)} latched ${d.latched} sneaking ${JSON.stringify(O.of(m)?.order)}`); T.walkBad++; fail(`WALK ${d.def.name}${side > 0 ? '+' : '−'}, ${where}: ${m.callsign} is ${gap.toFixed(1)} m off his mark ${f2(posts[i]!)} after ${secs} s, at ${f2(m.char.pos)}${nav.isBlocked(posts[i]![0], posts[i]![2]) ? ' (the mark is in a wall)' : ''}`); }
      else if (sameRoom && !next[i] && crossed[i].length) { T.walkBad++; fail(`WALK ${d.def.name}${side > 0 ? '+' : '−'}, ${where}: ${m.callsign} went through ${crossed[i].join(', ')} on the way to a mark in the room he stood in`); } });
    O.clear();
  };
  if (E.id === 'records-pair') { const d = g.doors.byName('office'), side = sideOf(d, [11.5, 0, 19]); g.props.reset(); g.teleportPlayer([12.43, 0, 17.3]); step(5);
    await play(d, side, 'as he played it: the pair from the yard, Sam on the latch jamb', 30, false); }
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    const F = stackRoomProbe(g, d, side); if (!F.floor) continue; const w = d.def.width;
    for (const [where, at] of [['Sam on the latch jamb', pt(d, w + K.jambPast, K.jambOut, side)], ['Sam on the hinge jamb', pt(d, -K.jambPast, K.jambOut, side)]] as [string, V][]) {
      if (nav.isBlocked(at[0], at[2]) || !F.has(at)) continue;
      const spots: V[] = []; for (const band of [[5, 14], [2, 30]]) for (const p of F.spots(band[0], band[1])) { if (spots.length >= men.length) break; if (flat(p, at) < 1.2 || spots.some(q => flat(q, p) < 1.1) || g.col.solidBlocked([p[0], 0.45, p[2]], [p[0] + 0.01, 0.45, p[2]])) continue; spots.push(p); }
      if (spots.length < men.length) continue;
      O.clear(); g.props.reset(); g.teleportPlayer(at); men.forEach((m, i) => put(m, spots[i], d.frameCentre)); step(3);   // (the furniture home again: a play starts on the level as authored, not on what the plays before it shoved into a corner)
      await play(d, side, where, 14, true); }
  }
  g.teleportPlayer(home);
}

const rows: any[] = [];
for (const E of ALL_MISSIONS as any[]) { if (!E.squad) continue; rows.push(E); const other = E.level && (LOOK_LEVELS as any)[E.level]; if (other) rows.push({ ...E, id: `${E.id}`, level: other, look: true }); }
const pick = rows.filter(E => !ids.length || ids.includes(E.id)); if (!pick.length) { console.log(`no such level — ${[...new Set(rows.map(E => E.id))].join(', ')}`); process.exit(2); }
if (DUMP) writeFileSync(DUMP, '');
for (const E of pick) await level(E);
if (DUMP) process.exit(0);
console.log(`\n${stackRoomSummary()}`);
console.log(`ALL: ${total.faces} faces · ${total.asked} sets asked, ${total.marks} marks · ${total.bad} off the room's floor · ${total.next} by a held room's doorway · ${total.none} 'no room' (switch off: ${total.offNone}) · switch off: ${total.offBad} marks off the floor; every room held: ${totalHeld.marks} marks, ${totalHeld.bad} off the floor, ${totalHeld.next} by a held room's doorway${WALK ? ` · walks ${total.walks}, failed ${total.walkBad}${stalled ? `, ${stalled} stalled short of a mark in plain reach` : ''}` : ''}`);
if (fails.length) { console.log(`=== stackroom-check: ${fails.length} FAIL ===`); process.exit(1); }
console.log(`=== stackroom-check: ALL PASS ===`); process.exit(0);
