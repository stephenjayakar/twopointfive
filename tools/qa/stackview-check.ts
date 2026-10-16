// A STACK WAITING ON AN OPEN DOOR STANDS OUT OF THE ROOM'S VIEW (src/game/stackroom.ts stackViewFix, STACKROOM.view / viewHand) — the check.
//   TPS_PROFILE=shipped bun run tools/qa/stackview-check.ts [level ids…] [--walk] [--max N] [--verbose]      exit 0 = ALL PASS · 1 = a FAIL · 2 = bad flags
// Every door of every squad level, each face a squad can stack on, the defenders put down and the squad stood on that face's floor a walk from the door.
//   SHUT   the plain stack's marks with the rule on are the marks with it off, to the bit (a shut leaf is not asked about).
//   OPEN   the same marks asked with the rule off and on. With it on: as many marks; every one on the face's own floor, on free floor, a body clear of every
//          other and of Sam, off every door's swing; a mark the rule MOVED is out of the floor's view by the play-through watcher's own measure
//          (stackline-watch.ts cellsOnLine, not the rule's); no more marks in view than with it off and no more men who must cross the front of the opening to reach one; one opener
//          where there was one; every open way at the stack's back (rearwatch.ts rearWays) is seen from as many marks as before; and asked again with the
//          men stood ON the marks, the marks are the same (a stack does not creep).
//   --walk on `--max` faces a level (6) where the rule moved a mark, the door open, both arms: 'stack up' is WALKED (inside 14 s, every man on the mark his order has him on), then 'open and
//          clear' given on the same door: the men are through the doorway inside 25 s with the rule on as with it off (at most one fewer, never fewer than two: who gets a point inside is the entry's deal). For a squad of four also Sam's
//          word given to the plain stack (the entry from the very marks), and one pair left waiting on its marks while the other is given the entry on the
//          same face: no two men are sent to marks under 0.6 m apart. Seconds to form and to the first man through are printed, off → on.
export {};
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const { standUp, ROOT } = await import('./headless.ts');
const { ALL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
const { farFloor, cellsOnLine, LINE_MIN_CELLS } = await import('./stackline-watch.ts');
const { stackRoomProbe, stackViewOpen, STACKROOM, STACKROOM_STATS } = await import(`${ROOT}/src/game/stackroom.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { alongOf } = await import(`${ROOT}/src/game/doortools.ts`);
const { doorwayInWay, DOORMANNERS } = await import(`${ROOT}/src/game/doorway.ts`);
const { rearWays, rearSees } = await import(`${ROOT}/src/game/rearwatch.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

type V = [number, number, number];
const DT = 1 / 60, args = process.argv.slice(2), VERBOSE = args.includes('--verbose'), WALK = args.includes('--walk'), OPT = ['--max'];
const bad = args.filter(a => a.startsWith('--') && !['--verbose', '--walk', '--max'].includes(a)); if (bad.length) { console.error(`unknown ${bad.join(' ')} — --walk --max N --verbose`); process.exit(2); }
const MAX = args.includes('--max') ? Number(args[args.indexOf('--max') + 1]) : 6, ids = args.filter((a, i) => !a.startsWith('--') && !OPT.includes(args[i - 1]));
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), f1 = (x: number) => x.toFixed(1);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const levelOfFile = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
const hush = async <T>(fn: () => T | Promise<T>): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const shut = (d: any) => { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.quietT = 10; d.locked = false; d.place(); };
const open = (d: any) => { const a = Math.abs(d.maxA) >= Math.abs(d.minA) ? Math.min(d.maxA, 1.3) : Math.max(d.minA, -1.3); d.latched = false; d.closing = false; d.angle = a; d.vel = 0; d.quietT = -3600; d.place(); };
let fails = 0; const fail = (s: string) => { fails++; console.log(`  FAIL ${s}`); };
const tot = { faces: 0, open: 0, shutSame: 0, marks: 0, seenOff: 0, seenOn: 0, acrossOff: 0, acrossOn: 0, moved: 0, ways: 0, walks: 0, formOff: 0, formOn: 0, inOff: 0, inOn: 0, words: 0, thruOff: 0, thruOn: 0, own: 0, pairs: 0, backs: 0, paneOff: 0, paneOn: 0, stood: 0, pairsWere: 0 };

async function level(E: any): Promise<void> {
  Math.random = seeded(0xba46 + 7919);
  const W: any = await hush(() => standUp({ uploadEvery: 4, ...(E.level ? { level: levelOfFile(E.level) } : {}) })); const g = W.game;
  g.godMode = true; g.playerInvisible = true; STACKROOM.view = true; STACKROOM.viewHand = true;
  if (!STACKROOM.on) { console.log(`${E.id}: STACKROOM.on is off on this stand — run under TPS_PROFILE=shipped (or TPS_STACKROOM=1)`); fails++; return; }
  let q = scenarioQuery(E) as string; if (E.kind === 'roomclear') q = q.replace(/roomclear(=\d+)?/, 'roomclear=1');
  const { why } = await hush(() => startFromQuery(g, new URLSearchParams(q))); if (why) { console.log(`${E.id}: start refused — ${why}`); return; }
  const step = (n = 1) => { for (let i = 0; i < n; i++) { g.player.visibility = 0.05; W.step(DT); } };
  await hush(() => step(20));
  const O = g.orders, men: any[] = O.squad().filter((x: any) => x.state !== 'dead'); if (men.length < 2) return;
  await hush(() => { for (const x of g.guards) if ((x.team === 'hostile' || x.team === 'guard') && x.state !== 'dead') killGuard(g, x, [0, 0, 1], true); step(30); });
  const home: V = [...g.player.char.pos] as V, tag = E.id;
  const put = (gd: any, p: number[], face: number[]) => { gd.char.pos = [p[0], 0, p[2]]; gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(face[0] - p[0], face[2] - p[2]); gd.path = []; gd.pathGoal = null; gd.char.update(0); };
  const spotsOf = (d: any, F: any): V[] => { const spots: V[] = []; for (const band of [[9, 16], [5, 30]]) for (const p of F.spots(band[0], band[1]) as V[]) { if (spots.length >= men.length) break; if (spots.some(s => flat(s, p) < 1.1) || g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.6)) continue; spots.push(p); } return spots; };
  const rest = async () => { await hush(() => { O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); O.clear(); step(2); }); };
  const stage = async (d: any, spots: V[], leaf: 'open' | 'shut' | 'all') => { for (const x of g.doors.list) leaf === 'all' ? open(x) : shut(x); if (leaf === 'open') open(d); await rest(); g.props.reset(); g.teleportPlayer(home); men.forEach((m, i) => { put(m, spots[i], d.frameCentre); g.cleared.mark(spots[i]); }); await hush(() => step(3)); };   // (the furniture home again: a staging starts on the level as authored, not on what the plays before it shoved onto this door's marks — the block's w_w+ at a real-size door: the staging yard's hand truck pushed two metres onto the far hand's places, the stack formed in neither arm and the word's wait on two wedged men was the arms' only difference)
  const ask = (d: any, side: 1 | -1, view: boolean): any[] | null => { STACKROOM.view = view; const P = O.stackPostsWait(d, side, men); STACKROOM.view = true; return P; };
  const faces: { d: any; side: 1 | -1; spots: V[]; moved?: number }[] = [];
  for (const d of g.doors.list) for (const side of [1, -1] as const) { const F = stackRoomProbe(g, d, side); if (!F.floor) continue; const spots = spotsOf(d, F); if (spots.length >= men.length) faces.push({ d, side, spots }); }
  const L = { open: 0, moved: 0, seenOff: 0, seenOn: 0, acrossOff: 0, acrossOn: 0 };
  for (const C of faces) { const { d, side, spots } = C, name = `${tag} ${d.def.name}${side > 0 ? '+' : '−'}`, F = stackRoomProbe(g, d, side), w = d.def.width as number; tot.faces++;
    // SHUT: the rule is not asked
    await stage(d, spots, 'shut'); { const a = ask(d, side, false), b = ask(d, side, true);
      if (JSON.stringify(a?.map((P: any) => [P.pos, P.face, P.lead])) !== JSON.stringify(b?.map((P: any) => [P.pos, P.face, P.lead]))) fail(`${name} shut: the marks differ with the rule on`); else tot.shutSame++; }
    // OPEN
    await stage(d, spots, 'open'); const off = ask(d, side, false), m0 = STACKROOM_STATS.viewOut + STACKROOM_STATS.viewOver, on = ask(d, side, true); if (!off) { if (on) fail(`${name} open: no room with the rule off, marks with it on`); continue; }
    if (!on) { fail(`${name} open: marks with the rule off, none with it on`); continue; } tot.open++; L.open++;
    if (on.length !== off.length) { fail(`${name} open: ${off.length} marks with the rule off, ${on.length} with it on`); continue; }
    const far = farFloor(g, d, side) as number[][], inLine = (p: number[]) => cellsOnLine(g, d, far, p)[0] >= LINE_MIN_CELLS, sam = g.player.char.pos;
    // (men who would have to cross the front of the opening: per hand, the marks on it past the men who can take one without crossing)
    const hs = spots.map(p => { const a = alongOf(d, p); return a >= w + STACKROOM.viewOut ? 1 : a <= -STACKROOM.viewOut ? -1 : 0; });
    const crossers = (L: any[]) => [1, -1].reduce((s, h) => s + Math.max(0, L.filter(P => (alongOf(d, P.pos) > w / 2 ? 1 : -1) === h).length - (men.length - hs.filter(x => x === -h).length)), 0);
    const moved = on.filter((P: any, i: number) => flat(P.pos, off[i].pos) > 0.01); tot.marks += on.length; tot.moved += moved.length; L.moved += moved.length; C.moved = moved.length;
    if (moved.length !== STACKROOM_STATS.viewOut + STACKROOM_STATS.viewOver - m0) fail(`${name} open: ${moved.length} marks moved, the rule's own count says ${STACKROOM_STATS.viewOut + STACKROOM_STATS.viewOver - m0}`);
    for (const P of on as any[]) { const at = `(${P.pos[0].toFixed(2)}, ${P.pos[2].toFixed(2)})`;
      if (!F.has(P.pos)) fail(`${name} open: a mark at ${at} is off the face's floor`);
      if (g.col.nav.isBlocked(P.pos[0], P.pos[2])) fail(`${name} open: a mark at ${at} is not on free floor`);
      if (sideOf(d, P.pos) !== side) fail(`${name} open: a mark at ${at} is on the other face`); }
    for (const P of moved as any[]) { const at = `(${P.pos[0].toFixed(2)}, ${P.pos[2].toFixed(2)})`;
      if (inLine(P.pos)) fail(`${name} open: a mark the rule moved to ${at} is in the floor's view (${cellsOnLine(g, d, far, P.pos)[0]} cells)`);
      if (doorwayInWay(g, P.pos)) fail(`${name} open: a mark the rule moved to ${at} is where a door swings`);
      if (flat(P.pos, sam) < 0.7) fail(`${name} open: a mark the rule moved to ${at} is on Sam`);
      for (const Q of on as any[]) if (Q !== P && flat(Q.pos, P.pos) < 0.7) fail(`${name} open: two marks ${f1(flat(Q.pos, P.pos))} m apart at ${at}`); }
    const sOff = off.filter((P: any) => inLine(P.pos)).length, sOn = on.filter((P: any) => inLine(P.pos)).length, aOff = crossers(off), aOn = crossers(on);
    tot.seenOff += sOff; tot.seenOn += sOn; tot.acrossOff += aOff; tot.acrossOn += aOn; L.seenOff += sOff; L.seenOn += sOn; L.acrossOff += aOff; L.acrossOn += aOn;
    if (sOn > sOff) fail(`${name} open: ${sOn} marks in view with the rule on, ${sOff} with it off`);
    // (a tally, no verdict: marks behind glass a round reaches through, as dealt and after the rule)
    const pOff = off.filter((P: any) => O.behindGlass(d, side, P.pos)).length, pOn = on.filter((P: any) => O.behindGlass(d, side, P.pos)).length; tot.paneOff += pOff; tot.paneOn += pOn;
    if (aOn > aOff) fail(`${name} open: ${aOn} men must cross the opening with the rule on, ${aOff} with it off`);
    if (off.filter((P: any) => P.lead).length === 1 && on.filter((P: any) => P.lead).length !== 1) fail(`${name} open: ${on.filter((P: any) => P.lead).length} openers with the rule on`);
    // asked again with the men ON the marks: the same marks
    { const was = men.map(m => [...m.char.pos]); men.forEach((m, i) => put(m, on[i].pos, d.frameCentre)); const again = ask(d, side, true);
      const same = !!again && again.length === on.length && on.every((P: any) => again.some((Q: any) => flat(P.pos, Q.pos) < 0.02));
      if (!same) fail(`${name} open: asked again with the men on their marks, the marks moved (${on.map((P: any) => `${P.pos[0].toFixed(2)},${P.pos[2].toFixed(2)}`).join(' ')} → ${again ? again.map((P: any) => `${P.pos[0].toFixed(2)},${P.pos[2].toFixed(2)}`).join(' ') : 'none'})`);
      men.forEach((m, i) => put(m, was[i], d.frameCentre)); }
    // every door of the level open: each open way at the stack's back is seen from as many marks as before, mark for mark
    { await stage(d, spots, 'all'); const a = ask(d, side, false), b = ask(d, side, true);
      if (a && b && a.length === b.length) for (const Wy of rearWays(g, d, side, a.map((P: any) => P.pos)) as any[]) { tot.ways++;
        const lost = a.filter((P: any, i: number) => rearSees(g, P.pos, Wy.o, Wy.front) && !rearSees(g, b[i].pos, Wy.o, Wy.front)).length;
        if (lost) fail(`${name} every door open: ${lost} marks lost their line to the way behind (${Wy.o?.door?.def?.name ?? "an opening"}) with the rule on`); }
      else if (a && !b) fail(`${name} every door open: marks with the rule off, none with it on`); }
    if (VERBOSE && moved.length) console.log(`  ${name}: ${moved.length} of ${on.length} moved · in view ${sOff} → ${sOn} · crossing ${aOff} → ${aOn}`);
  }
  console.log(`${tag} [${E.level ?? 'office.json'}], ${men.length} men: ${faces.length} faces, ${L.open} judged open · ${L.moved} marks moved · in view ${L.seenOff} → ${L.seenOn} · men who must cross the opening ${L.acrossOff} → ${L.acrossOn}`);
  if (!WALK) return;
  // THE WALK: both arms, 'stack up' walked, then the entry
  const pick = faces.filter(C => C.moved).filter((_, i, a) => !MAX || MAX >= a.length || Math.floor(i * MAX / a.length) !== Math.floor((i - 1) * MAX / a.length));
  type Res = { form: number | null; short: number; first: number | null; thru: number };
  const play = async (C: (typeof faces)[number], view: boolean, how: 'tool' | 'word'): Promise<Res | null> => { const { d, side, spots } = C; STACKROOM.view = view; await stage(d, spots, 'open');
    const t = { kind: 'door', door: d, side }, why = await hush(() => O.give('stack', t, 'all')); if (why || men.some(m => !O.of(m)?.post || sideOf(d, O.of(m).post) !== side)) { STACKROOM.view = true; return null; }
    const R: Res = { form: null, short: 0, first: null, thru: 0 };
    // (the mark CAME TO HIM: orders.ts replaces a post with the man's own feet where he is as near it as he will get — said aloud from a metre short
    //  ('stopped short'), silently under that)
    const lastPost = new Map<any, any>(men.map(m => [m, O.of(m)?.post])), came = new Set<any>();
    await hush(() => { for (let f = 0; f < 14 * 60; f++) { step(1);
      for (const m of men) { const p = O.of(m)?.post, was = lastPost.get(m); if (p && p !== was) { if (was && flat(p, was) >= 0.3) { if (flat(p, m.char.pos) < 0.05) came.add(m); else came.delete(m); } lastPost.set(m, p); } }
      if (men.every(m => !O.of(m)?.post || O.of(m).arrived)) { R.form = (f + 1) * DT; break; } } });
    R.short = men.filter(m => { const p = O.of(m)?.post; return !p || flat(m.char.pos, p) > 0.6; }).length;   // (off the mark his order has him on: the order itself moves a mark a leaf stands on)
    // (A STACK THAT STANDS DOES NOT CREEP: walked onto their marks, the leaf still standing open — a walker may have pushed it to — the marks asked again:
    //  every man keeps the mark he stands on, unless it has come into the floor's view or under a swing since, whatever the walk nudged or shoved)
    const farC = view ? farFloor(g, d, side) : [], stands = (m: any) => { const p = O.of(m)?.post; return !!p && O.of(m).there !== 'stopped short' && !came.has(m) && flat(m.char.pos, p) <= 0.6 && cellsOnLine(g, d, farC, p)[0] < LINE_MIN_CELLS && !doorwayInWay(g, p); };   // (a man who stopped short, or whose mark came to him, is not standing on a mark of the stack's: the order brought his mark to where he was wedged — the block's w_w+, a stride off a mate's mark beside the hand truck; the barracks' n4b−, 0.76 m short behind his mate — and no deal owes him that spot)
    const keeps = (again: any[] | null) => men.filter(m => stands(m) && !(again && again.some((P: any) => flat(P.pos, O.of(m).post) < 0.1)));   // (the SAME mark: the rule's two rows off a wall are 0.15 m apart)
    const marks = (L: any[] | null) => L ? L.map((P: any) => `${P.pos[0].toFixed(2)},${P.pos[2].toFixed(2)}`).join(' ') : 'none', posts = () => men.map(m => { const p = O.of(m)?.post; return p ? `${p[0].toFixed(2)},${p[2].toFixed(2)}` : 'none'; }).join(' ');
    if (view && R.form !== null && stackViewOpen(d)) { const again = O.stackPostsWait(d, side, men), lost = keeps(again); tot.stood++;
      if (lost.length) fail(`${C.d.def.name}${side > 0 ? '+' : '−'} (${how}): walked onto their marks and asked again, ${lost.map(m => m.callsign).join(', ')} ${lost.length > 1 ? 'are' : 'is'} dealt off the mark he stands on (${posts()} → ${marks(again)})`); }
    // (only in a tree that has the own-mark rule: Sam come to stand by a man on his mark, the marks asked again — every man keeps the mark he stands on)
    if (view && how === 'tool' && R.form !== null && stackViewOpen(d) && DOORMANNERS.on && (DOORMANNERS as any).ownMark) { const th = d.def.closedDir, n = [-Math.sin(th) * side, 0, Math.cos(th) * side];
      const far1 = [...men].sort((a, b) => flat(b.char.pos, d.frameCentre) - flat(a.char.pos, d.frameCentre))[0], p = O.of(far1).post as V, at: V = [p[0] + n[0] * 0.85, 0, p[2] + n[2] * 0.85];
      if (!g.col.nav.isBlocked(at[0], at[2]) && men.every(m => flat(O.of(m).post, at) >= 0.8)) { g.teleportPlayer(at); const again = O.stackPostsWait(d, side, men); tot.own++;
        const lost = keeps(again); if (lost.length) fail(`${C.d.def.name}${side > 0 ? '+' : '−'}: Sam come to stand by ${far1.callsign} on his mark, the marks asked again are not the ones the men stand on (${posts()} → ${marks(again)}; Sam at ${at[0].toFixed(2)},${at[2].toFixed(2)})`);
        g.teleportPlayer(home); await hush(() => step(2)); } }
    const w2 = await hush(() => how === 'word' ? (g.doorTools.go('all'), '') : O.give('openClear', t, 'all')); if (w2) { STACKROOM.view = true; return R; }
    const thru = new Set<any>(); await hush(() => { for (let f = 0; f < 25 * 60 && thru.size < men.length; f++) { step(1); for (const m of men) if (!thru.has(m) && sideOf(d, m.char.pos) !== side && flat(m.char.pos, d.frameCentre) > 0.6) { thru.add(m); if (R.first === null) R.first = (f + 1) * DT; } } });
    R.thru = thru.size; STACKROOM.view = true; return R; };
  // (the four) red waits on the open door on its marks, blue is given the entry on the same face: red steps back for it, and no two men are ever sent to one spot
  // (… and the same with the rule OFF first: two men the door tools send to one spot whatever this rule says are the door tools' — counted, not failed here)
  const pairs = async (C: (typeof faces)[number]) => { const off = await pairsOne(C, false), on = await pairsOne(C, true); if (on === null) return; tot.pairs++;
    if (on < 0) { if (off !== null && off < 0) tot.pairsWere++; else fail(pairsWhy); } };
  let pairsWhy = '';
  const pairsOne = async (C: (typeof faces)[number], view: boolean): Promise<number | null> => { const { d, side, spots } = C, name = `${tag} ${d.def.name}${side > 0 ? '+' : '−'} pairs`; STACKROOM.view = view; await stage(d, spots, 'open'); const done = <T,>(x: T): T => { STACKROOM.view = true; return x; };
    const t = { kind: 'door', door: d, side }, red = O.men('red') as any[], why = await hush(() => O.give('stack', t, 'red')); if (why || red.some(m => !O.of(m)?.post || sideOf(d, O.of(m).post) !== side)) return done(null);
    await hush(() => { for (let f = 0; f < 14 * 60 && !red.every(m => O.of(m)?.arrived); f++) step(1); });
    const was = red.map(m => [...O.of(m).post] as V);
    if (await hush(() => O.give('openClear', t, 'blue'))) return done(null); let near = 9, who = '';
    await hush(() => { for (let f = 0; f < 3 * 60; f++) { step(1); if (f % 6) continue;
      for (const a of men) for (const b of men) { const pa = O.of(a)?.post, pb = O.of(b)?.post; if (a === b || !pa || !pb || sideOf(d, pa) !== side || sideOf(d, pb) !== side) continue; const x = flat(pa, pb); if (x < near) { near = x; who = `${a.callsign} and ${b.callsign}`; } } } });
    if (near < 0.6) { if (view) pairsWhy = `${name}: ${who} are sent to marks ${near.toFixed(2)} m apart, and are not with the rule off`; return done(-1); } if (!view) return done(1);
    // (the pair that waited steps back for the entry — along its own wall never TOWARD the door: doortools.ts stepBacks)
    red.forEach((m, i) => { const p = O.of(m)?.post as V | null, w = d.def.width; if (!p || flat(p, was[i]) < 0.05 || (alongOf(d, p) > w / 2) !== (alongOf(d, was[i]) > w / 2)) return; tot.backs++;
      if (flat(p, d.frameCentre) < flat(was[i], d.frameCentre) - 0.15) fail(`${name}: ${m.callsign} waited ${flat(was[i], d.frameCentre).toFixed(1)} m from the doorway and is stepped 'back' to ${flat(p, d.frameCentre).toFixed(1)} m`); }); return done(1); };
  if (men.length > 2) for (const C of pick) await pairs(C);
  for (const [i, C] of pick.entries()) for (const how of (men.length > 2 ? ['tool', 'word'] : ['tool']) as ('tool' | 'word')[]) { const name = `${tag} ${C.d.def.name}${C.side > 0 ? '+' : '−'} ${how}`;
    const first = (i % 2 === 0) === (how === 'tool'), a = await play(C, first, how), b = await play(C, !first, how), on = first ? a : b, off = first ? b : a; if (!on || !off) continue; tot.walks++; if (how === 'word') tot.words++;
    if (off.form !== null && on.form === null) fail(`${name}: the stack forms in ${f1(off.form)} s with the rule off and not in 14 s with it on`);
    if (on.short > off.short) fail(`${name}: ${on.short} men off their marks with the stack formed with the rule on, ${off.short} with it off`);
    // (who goes in is the entry's own deal — a man it gives no point inside stays out, and which man that is turns on where they started: one fewer is not a fault, nobody or two fewer is)
    if (on.thru < Math.min(off.thru, 2) || on.thru < off.thru - 1) fail(`${name}: ${on.thru} men through the doorway with the rule on, ${off.thru} with it off`);
    tot.thruOff += off.thru; tot.thruOn += on.thru;
    if (on.form !== null && off.form !== null) { tot.formOff += off.form; tot.formOn += on.form; } if (on.first !== null && off.first !== null) { tot.inOff += off.first; tot.inOn += on.first; }
    if (VERBOSE) console.log(`  ${name}: formed ${off.form === null ? 'never' : f1(off.form)} → ${on.form === null ? 'never' : f1(on.form)} s · first man through ${off.first === null ? 'never' : f1(off.first)} → ${on.first === null ? 'never' : f1(on.first)} s · through ${off.thru} → ${on.thru}`);
  }
}

const rows: any[] = (ALL_MISSIONS as any[]).filter(E => E.squad), picked = rows.filter(E => !ids.length || ids.includes(E.id)); if (!picked.length) { console.log(`no such level — ${rows.map(E => E.id).join(', ')}`); process.exit(2); }
for (const E of picked) await level(E);
const pc = (a: number, b: number) => b ? `${Math.round(100 * a / b)} %` : '—';
console.log(`\nALL: ${tot.faces} faces · shut: ${tot.shutSame} the same marks · open: ${tot.open} judged, ${tot.marks} marks, ${tot.moved} moved · in view ${tot.seenOff} → ${tot.seenOn} (${pc(tot.seenOff, tot.marks)} → ${pc(tot.seenOn, tot.marks)}) · men who must cross the opening ${tot.acrossOff} → ${tot.acrossOn} · behind glass a round reaches through ${tot.paneOff} → ${tot.paneOn} · ${tot.ways} ways behind held`
  + (WALK ? ` · walks ${tot.walks} (${tot.words} on the word): formed in ${f1(tot.formOff / Math.max(1, tot.walks))} → ${f1(tot.formOn / Math.max(1, tot.walks))} s, first man through ${f1(tot.inOff / Math.max(1, tot.walks))} → ${f1(tot.inOn / Math.max(1, tot.walks))} s after the entry was given, men through ${tot.thruOff} → ${tot.thruOn}${tot.pairs ? ` · one pair waiting and the other given the entry ${tot.pairs} times: no two marks on one spot${tot.pairsWere ? ` but the ${tot.pairsWere} the door tools deal so with the rule off too` : ''}, ${tot.backs} steps back along a man's own wall and none toward the door` : ''}${tot.stood ? ` · a stack walked onto its marks asked again ${tot.stood} times: nobody dealt off the mark he stands on` : ''}${tot.own ? ` · Sam stood by a stacked man ${tot.own} times: every mark kept` : ''}` : ''));
if (!tot.open || !tot.moved) { console.log('=== stackview-check: NO VERDICT (nothing judged) ==='); process.exit(1); }
if (WALK && tot.walks >= 10 && !tot.stood) fail(`${tot.walks} walks and no stack that formed was asked again: the 'does not creep' line judged nothing`);
console.log(fails ? `=== stackview-check: ${fails} FAIL ===` : '=== stackview-check: ALL PASS ==='); process.exit(fails ? 1 : 0);
