// The 'entrypoints' family: ENTRY POINTS STAY OFF UNCLEARED OPENINGS (game/entrypoints.ts; the footage page: "a man standing still within about 3 m of an
// opening an enemy gets the first look through" — both operator deaths in the hostage-rescue video).
//   entrypoints-known   the tracker: a side of an opening is known once one of the squad has stood on it with a line to it, in a doorway both; nothing known
//                       through a wall or from too far; a restart forgets it.
//   entrypoints-count   THE COUNT, across the seven start-card scenarios: every entry of every held room, taken from outside by that scenario's squad as if
//                       it were the first door of the run (known ground = the stack's own marks and nothing else: the worst case), its points of domination
//                       as they were against as they are now — how many stand within ENTRY.nearM and in the line of an opening nobody has been beyond.
//                       Holds: fewer after than before in total and never more on any door; every point left risky is one the room has no floor for (the
//                       same search finds none); every moved point is on free floor, inside the room, clear of the other points, walkable from the door,
//                       no further than ENTRY.moveM from where it was and not risky. Printed, not judged: the threshold stage's shallow step and the
//                       stack's own marks, which this change leaves where they were.
//   entrypoints-off     ENTRY.offOpenings off: pods() answers the old points, object for object, on every door of every scenario; and a seeded entry on
//                       the manager's door plays the same game with the switch off as the tracker alone leaves it (digest for digest).
//   bun run tools/qa/entrypoints-probes.ts table      the count's rows as markdown (the page's table)
// The same-seed play-through numbers (points dealt in play, deaths at such points) are tools/qa/playthrough.ts's: RunOut.entry and Death.open.
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { ENTRY } = await import(`${ROOT}/src/game/entrypoints.ts`);
const { sideOf } = await import(`${ROOT}/src/game/orders.ts`);
const { wallBetween } = await import(`${ROOT}/src/game/roomclear.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

type Vec3 = [number, number, number];
const VERBOSE = process.argv.includes('--verbose');
const keep = { ...ENTRY };
const lineTo = (g: any, p: number[], w: number[]) => !wallBetween(g, [p[0], 1.55, p[2]], [w[0], 1.1, w[2]]);
function family(title: string) {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAIL'} ===`); return all; } };
}
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } finally { Object.assign(ENTRY, keep); } };
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const alongOf = (d: any, p: number[]) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
const offOf = (d: any, p: number[], side: number) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };

export interface Row { scn: string; doors: number; pts: number; before: number; after: number; moved: number; kept: number; shallow: number; shallowRisky: number; stack: number; stackRisky: number; bad: string[]; lines: string[] }

/** one scenario: every entry of every held room from outside, the worst case (nothing known but the stack's own marks) */
export async function countScenario(scnId: string): Promise<Row> {
  const S: any = await quiet(() => stage(scnId, 1)); const g = S.g, D = g.doorTools, EP = g.entry, O = g.orders, men = O.men(), nav = g.col.nav;
  const row: Row = { scn: scnId, doors: 0, pts: 0, before: 0, after: 0, moved: 0, kept: 0, shallow: 0, shallowRisky: 0, stack: 0, stackRisky: 0, bad: [], lines: [] };
  const rooms = [...new Set(S.defs.map((d: any) => d.room))] as any[];
  for (const room of rooms) for (const ent of room.entries) {
    const d = ent.door, side = sideOf(d, [ent.at[0] + ent.out[0] * 1.2, 0, ent.at[2] + ent.out[1] * 1.2]) as 1 | -1, n = men.length > 2 || O.big ? 4 : men.length, W = d.def.width, name = d.def.name;
    const posts = O.stackPosts(d, side, men) as any[] | null; if (!posts) continue;   // (no floor at its jambs from outside: the squad takes the room's other door)
    const known = () => { EP.reset(); for (const p of posts) EP.mark(p.pos); };
    known(); ENTRY.offOpenings = false; const was = D.pods(d, side, n) as any[];
    const rb = was.map((p: any) => EP.riskAt(p.pos, d));
    ENTRY.offOpenings = true; const now = D.pods(d, side, n) as any[], ra = now.map((p: any) => EP.riskAt(p.pos, d));
    row.doors++; row.pts += was.length; row.before += rb.filter(Boolean).length; row.after += ra.filter(Boolean).length;
    if (now.length !== was.length) row.bad.push(`${name}: ${was.length} points became ${now.length}`);
    if (ra.filter(Boolean).length > rb.filter(Boolean).length) row.bad.push(`${name}: more risky points after than before`);
    const gate: Vec3 = [ent.at[0] - ent.out[0] * 0.7, 0, ent.at[2] - ent.out[1] * 0.7];
    for (let i = 0; i < Math.min(was.length, now.length); i++) { const a = was[i], b = now[i], same = a.pos[0] === b.pos[0] && a.pos[2] === b.pos[2];
      if (same) { if (rb[i]) { row.kept++;
          // nowhere to go: the same search, asked again of this one point with the others where they ended
          const again = EP.clearOf(d, [a], (p: number[]) => [alongOf(d, p) - W / 2, -offOf(d, p, side)]); const alone = again[0].pos[0] !== a.pos[0] || again[0].pos[2] !== a.pos[2];
          row.lines.push(`${name}: ${at(a.pos)} stays, ${flat(a.pos, rb[i].at).toFixed(1)} m in the line of ${rb[i].id}${alone ? ' (floor only where another point stands)' : ' (no clear floor within reach)'}`); }
        continue; }
      row.moved++; const path = nav.findPath(gate, b.pos); let L = 0, q: number[] = gate; if (path) { for (const w of path) { L += flat(q, w); q = w; } L += flat(q, b.pos); }
      const why = !rb[i] ? 'moved though it was not risky' : ra[i] ? 'moved onto another risky spot' : nav.isBlocked(b.pos[0], b.pos[2]) ? 'not on free floor' : -offOf(d, b.pos, side) < 0.3 ? 'not inside the room' : flat(a.pos, b.pos) > ENTRY.moveM + 0.01 ? 'moved too far'
        : now.some((o: any, j: number) => j !== i && flat(o.pos, b.pos) < ENTRY.apart) ? 'on top of another point' : !path || L > flat(gate, b.pos) * 2 + 3 ? 'no short walk from the door' : b.face !== a.face ? 'entry facing changed' : !b.watch ? 'no opening to hold' : !lineTo(g, b.pos, b.watch) ? 'no line to the opening he holds' : '';
      if (why) row.bad.push(`${name}: ${at(a.pos)} → ${at(b.pos)}: ${why}`);
      row.lines.push(`${name}: ${at(a.pos)} → ${at(b.pos)} (${flat(a.pos, b.pos).toFixed(1)} m), off ${rb[i]?.id ?? '?'} (it was ${rb[i] ? flat(a.pos, rb[i].at).toFixed(1) : '?'} m from it)`); }
    // printed, not judged: the threshold's shallow step and the stack itself
    known(); for (const p of D.shallowPods(d, side, Math.max(2, men.length)) as any[]) { row.shallow++; if (EP.riskAt(p.pos, d)) row.shallowRisky++; }
    EP.reset(); for (const p of posts) { row.stack++; if (EP.riskAt(p.pos, d)) row.stackRisky++; }
  }
  EP.reset(); Object.assign(ENTRY, keep);
  return row;
}

export const entrypointsCount = guarded(async () => {
  const { verdict, done } = family('entrypoints-count: points of domination within 3 m and in the line of an opening nobody has been beyond, the seven scenarios');
  const rows: Row[] = []; for (const E of SCENARIOS as any[]) rows.push(await countScenario(E.id));
  const sum = (k: keyof Row) => rows.reduce((n, r) => n + (r[k] as number), 0);
  const table = rows.map(r => `${r.scn}: ${r.doors} entries, ${r.pts} points · risky ${r.before} → ${r.after} · ${r.moved} moved, ${r.kept} with nowhere to go · (shallow step ${r.shallowRisky} of ${r.shallow}, stack marks ${r.stackRisky} of ${r.stack}: not moved)`);
  verdict(rows.length === (SCENARIOS as any[]).length && rows.every(r => r.doors > 0 && r.pts > 0), 'all the start card\'s scenarios stage and have held rooms with entries', table.join('\n    '));
  verdict(sum('after') < sum('before') && rows.every(r => r.after <= r.before), 'fewer risky points after than before, and no scenario with more', `all seven: ${sum('before')} of ${sum('pts')} points risky before, ${sum('after')} after · ${sum('moved')} moved · ${sum('kept')} kept for want of floor`);
  verdict(rows.every(r => r.after === r.kept), 'every point still risky is one the room has no clear floor for', rows.flatMap(r => r.lines.filter(l => l.includes('stays')).map(l => `${r.scn} · ${l}`)).join('\n    ') || 'none left');
  const bad = rows.flatMap(r => r.bad.map(b => `${r.scn} · ${b}`));
  verdict(!bad.length, 'every moved point: was risky, is not now, on free floor inside the room, clear of the others, a short walk from the door, within the move\'s reach, facing kept', bad.length ? bad.join('\n    ') : rows.flatMap(r => r.lines.filter(l => l.includes('→')).map(l => `${r.scn} · ${l}`)).join('\n    '));
  return done();
});

export const entrypointsKnown = guarded(async () => {
  const { verdict, done } = family('entrypoints-known: the side of an opening one of the squad has stood on is known');
  const S: any = await quiet(() => stage('room-clear-pair', 1)); const g = S.g, EP = g.entry; EP.reset();
  const d = g.doors.list.find((x: any) => x.def.name === 'manager') ?? g.doors.list[0], o = EP.openings().find((x: any) => x.door === d);
  const pt = (s: number, b: number): Vec3 => [o.at[0] + o.n[0] * s * b, 0, o.at[2] + o.n[1] * s * b];
  const free = (s: number) => [1.2, 1.6, 2.0].map(b => pt(s, b)).find(p => !g.col.nav.isBlocked(p[0], p[2]))!;
  const A = free(1), B = free(-1);
  const none = !EP.farKnown(o, A) && !EP.farKnown(o, B);
  EP.mark(A); const one = EP.farKnown(o, B) && !EP.farKnown(o, A);
  EP.reset(); EP.mark(pt(-1, 9)); const far = !EP.farKnown(o, A) && !EP.farKnown(o, B);   // (nine metres off: not this opening's)
  EP.mark([o.at[0], 0, o.at[2]]); const both = EP.farKnown(o, A) && EP.farKnown(o, B);
  verdict(none && one && far && both, 'nothing known at the start; a man 1–2 m off one face makes that face known and not the other; nine metres off, nothing; in the doorway, both', `${d.def.name}: start ${none} · one face ${one} · far ${far} · doorway ${both}`);
  EP.reset(); const forgot = !EP.farKnown(o, A) && !EP.farKnown(o, B);
  // through a wall: a point within reach of some door but with no line to it marks nothing
  let walled = 0, tried = 0; for (const x of EP.openings()) { if (x.kind !== 'door') continue; for (const [dx, dz] of [[3, 0], [-3, 0], [0, 3], [0, -3], [2.5, 2.5], [-2.5, 2.5]]) { const p: Vec3 = [x.at[0] + dx, 0, x.at[2] + dz]; if (g.col.nav.isBlocked(p[0], p[2])) continue;
      const s = (p[0] - x.at[0]) * x.n[0] + (p[2] - x.at[2]) * x.n[1]; if (Math.abs(s) < 0.3) continue; const keepDyn = g.col.dynamicBoxes; g.col.dynamicBoxes = [];
      const blocked = g.col.segmentBlocked([p[0], 1.55, p[2]], [x.at[0] + x.n[0] * Math.sign(s) * 0.3, 1.1, x.at[2] + x.n[1] * Math.sign(s) * 0.3]); g.col.dynamicBoxes = keepDyn; if (!blocked) continue;
      tried++; EP.reset(); EP.mark(p); const q: Vec3 = [x.at[0] - x.n[0] * Math.sign(s), 0, x.at[2] - x.n[1] * Math.sign(s)]; if (EP.farKnown(x, q)) walled++; } }
  EP.reset();
  verdict(forgot && tried > 0 && walled === 0, 'a restart forgets it; a man with a wall between him and a door makes nothing of it known', `forgotten ${forgot} · ${tried} walled stands tried, ${walled} marked`);
  // live: the pair falls in and the tracker follows them
  for (let i = 0; i < 120; i++) S.step();
  const n = EP.summary();
  verdict(/[1-9]\d* openings known/.test(n), 'in play the tracker runs by itself: two seconds after the scenario starts the openings round the squad are known', n);
  return done();
});

export const entrypointsOff = guarded(async () => {
  const { verdict, done } = family('entrypoints-off: the switch off is the points as they were');
  let doors = 0, diff = 0, stayBad = 0, watched = 0, mvBad = 0, movedOnly = 0;
  for (const E of SCENARIOS as any[]) { const S: any = await quiet(() => stage(E.id, 1)); const g = S.g, D = g.doorTools; ENTRY.offOpenings = false;
    for (const d of g.doors.list) for (const side of [1, -1] as const) for (const n of [2, 4]) { doors++; const b = D.podsAsWere(d, side, n), same = (a: any[]) => a.length === b.length && a.every((p: any, i: number) => p.pos[0] === b[i].pos[0] && p.pos[2] === b[i].pos[2] && p.face === b[i].face);
      Object.assign(ENTRY, keep, { offOpenings: false }); const off = D.pods(d, side, n); if (!same(off) || off.some((p: any) => p.watch)) diff++;
      Object.assign(ENTRY, keep, { offOpenings: true, move: false, watch: true }); const stay = D.pods(d, side, n); if (!same(stay)) stayBad++; watched += stay.filter((p: any) => p.watch).length;
      Object.assign(ENTRY, keep, { offOpenings: true, move: true, watch: false }); const mv = D.pods(d, side, n); if (mv.some((p: any) => p.watch) || mv.some((p: any, i: number) => p.face !== b[i].face)) mvBad++; movedOnly += same(mv) ? 0 : 1; }
    Object.assign(ENTRY, keep); }
  // (that the switch off PLAYS as the build before it is threshold-identity's business: fourteen runs against digests frozen at af55d89, pinned with ENTRY.offOpenings off)
  verdict(doors > 0 && diff === 0, 'pods() with the switch off: the points the old function deals and none with an opening to hold, on every door of every scenario, either face, for two and for four', `${doors} askings, ${diff} differ`);
  verdict(stayBad === 0 && watched > 0 && mvBad === 0 && movedOnly > 0, 'the two halves switch apart: with the move off every point stays and the risky ones are given their opening to hold; with the watch off points move and none is given one, each keeping the facing it was dealt', `move off: ${stayBad} askings moved a point, ${watched} points given an opening · watch off: ${mvBad} askings wrong, ${movedOnly} moved a point`);
  // the tracker alone changes nothing: one seeded entry, the switch off, with the tracker ticking and with it stopped
  const play = async (track: boolean) => { const S: any = await quiet(() => stage('room-clear-pair', 3)); const g = S.g, O = g.orders, D = g.doorTools; ENTRY.offOpenings = false; if (!track) g.entry.tick = () => {};
    const d = g.doors.list.find((x: any) => x.def.name === 'manager') ?? S.defs[0].room.entries[0].door; let h = '';
    await quiet(() => { O.give('stack', O.targetAt(d.frameCentre)); for (let i = 0; i < 60 * 8; i++) S.step(); O.give(D.bangs > 0 ? 'bangClear' : 'openClear', O.targetAt(d.frameCentre)); for (let i = 0; i < 60 * 20; i++) { S.step(); if (i % 30 === 0) h = String(hashDigest(h + JSON.stringify(digestGame(g, true)))); } });
    Object.assign(ENTRY, keep); return { h, dealt: g.entry.stats.pods }; };
  const a = await play(true), b = await play(false);
  verdict(a.h === b.h && a.dealt > 0, 'a seeded entry with the switch off plays the same game whether the tracker runs or not', `digest ${a.h} against ${b.h} · ${a.dealt} points dealt`);
  return done();
});

if (import.meta.main) {
  if (process.argv[2] === 'table') { const rows: Row[] = []; for (const E of SCENARIOS as any[]) rows.push(await countScenario(E.id));
    console.log('| scenario | entries | points | risky before | risky after | moved | kept, no floor | shallow step risky | stack marks risky |\n|---|---|---|---|---|---|---|---|---|');
    for (const r of rows) console.log(`| ${r.scn} | ${r.doors} | ${r.pts} | ${r.before} | ${r.after} | ${r.moved} | ${r.kept} | ${r.shallowRisky} of ${r.shallow} | ${r.stackRisky} of ${r.stack} |`);
    const s = (k: keyof Row) => rows.reduce((n, r) => n + (r[k] as number), 0);
    console.log(`| **all seven** | ${s('doors')} | ${s('pts')} | ${s('before')} | ${s('after')} | ${s('moved')} | ${s('kept')} | ${s('shallowRisky')} of ${s('shallow')} | ${s('stackRisky')} of ${s('stack')} |\n`);
    for (const r of rows) for (const l of r.lines) console.log(`- ${r.scn} · ${l}`); for (const r of rows) for (const b of r.bad) console.log(`- BAD ${r.scn} · ${b}`); }
  else { let ok = true; for (const f of [entrypointsKnown, entrypointsCount, entrypointsOff]) ok = (await f()) && ok; process.exit(ok ? 0 : 1); }
}
