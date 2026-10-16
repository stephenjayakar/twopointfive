// DOES AN ENTRY CLEAR THE WHOLE ROOM — the room-clearing rule (src/game/doortools.ts DOORTOOLS.flowOn) played on every door of a scenario's level that lets
// into a room with a part its points of domination cannot see:
//   bun run tools/qa/wholeroom-check.ts [scenario …] [--door name] [--verbose] [--json out.json] [--min N]
// (default: the four-man scenarios of the start card). Per such door face (the room fight's own flood, ≤ DOORTOOLS.searchCells; a hidden part of
// DOORTOOLS.flowCells cells or more — `--min N` asks for another size): the scenario is stood up, EVERY man of the other side is taken off the floor (the
// question is where the team goes, not who wins), the team is put a few steps outside the door and told 'open and clear' — once with the rule off, once
// with it on. Read off each: how much of the room's floor nobody has looked at when the entry is over, how many men stand in the part the entry's own
// points could not see, how many walked on, how long it took.
// THE VERDICT (exit 1 when it fails): with the rule on no door leaves more floor unseen than with it off (3 cells' grace; and a room the search itself calls looked over —
// fewer than DOORTOOLS.deadCells cells left, its own stopping rule with the rule on or off — is not 'worse': the long hall ends 4 cells short after one
// bound where three walks to look end on 0), every entry that ended with it
// off ends with it on (240 s of play each), and less is left in all. No such door on the levels asked for: nothing is checked, and it says so.
// WHERE THE RULE STOPS (DOORTOOLS.openAir / flowMax — the maintainer, 10-11: not "outdoor spaces or very large rooms"): a face onto floor under the sky, or onto a room
// past `flowMax` cells, is played a third time with both limits off ('as it was'), and is NOT one of the first verdict's doors (there the rule on and off
// are the same entry by design). Its own verdict, of the faces whose entry was played: as shipped no pair is walked INTO the unseen part of such floor (the
// room past the size is searched as before the rule — a man may still step on to where unseen floor can be seen from), and floor under the sky is not
// searched at all; if no such face had men go in with the limits off either, that line checks nothing and says so.
// Printed beside it, not judged: how many rooms end with a man standing in the part the entry's points could not see, the seconds an entry takes, and
// the doors still not looked over to the last corner (--verbose: where each man ends and what the search said — which rule refused a walk).
import { writeFileSync } from 'node:fs';
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { DOORTOOLS, doorPt, openFloor } = await import(`${ROOT}/src/game/doortools.ts`);
const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VERBOSE = args.includes('--verbose'), only = flag('--door'), out = flag('--json'), MIN = Number(flag('--min') ?? DOORTOOLS.flowCells);
const ids = args.filter((a, i) => !a.startsWith('--') && !['--door', '--json', '--min'].includes(args[i - 1] ?? ''));
const scns: string[] = ids.length ? ids : SCENARIOS.filter((e: any) => e.squad === 4).map((e: any) => e.id);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Arm { left: number; inFar: number; flowed: number; moved: number; secs: number; end: string; where: string; note: string }
interface Row { scn: string; door: string; side: number; cells: number; hidden: number; /** floor the rule leaves alone: under the sky · a room past flowMax */ lim: '' | 'sky' | 'big'; off: Arm; on: Arm; /** both limits off */ wide?: Arm }

/** the cells of the room behind face `side` of door `d` that none of the entry's own points has a line to */
function hiddenOf(g: any, d: any, side: 1 | -1): { room: any; hidden: Set<number> } | null {
  const nav = g.col.nav, cs = nav.cell, into = -side as 1 | -1, mid = doorPt(d, d.def.width / 2, 1.0, into), room = g.fight.roomAt(mid);
  if (!room || room.cells.size > DOORTOOLS.searchCells || nav.isBlocked(mid[0], mid[2])) return null;
  const pods = g.doorTools.pods(d, side, 4) as { pos: number[] }[]; if (!pods.length) return null;
  const hidden = new Set<number>();
  for (const ci of room.cells) { const q = [(ci % nav.W + 0.5) * cs, 1.0, (((ci / nav.W) | 0) + 0.5) * cs]; if (!pods.some(P => flat(P.pos, q) <= DOORTOOLS.lookM && !g.col.segmentBlocked([P.pos[0], 1.55, P.pos[2]], q))) hidden.add(ci); }
  return { room, hidden };
}

async function arm(scn: string, door: string, side: 1 | -1, on: boolean, wide = false): Promise<Arm> {
  const keep = DOORTOOLS.flowOn, air = DOORTOOLS.openAir, max = DOORTOOLS.flowMax;
  try {
    const S: any = await quiet(() => stage(scn, 1)); DOORTOOLS.flowOn = on; if (wide) { DOORTOOLS.openAir = false; DOORTOOLS.flowMax = 0; } const g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav, step = S.step;
    const A: Arm = { left: -1, inFar: 0, flowed: 0, moved: 0, secs: 0, end: '', where: '', note: '' };
    for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
    const d = g.doors.list.find((x: any) => x.def.name === door), H = hiddenOf(g, d, side)!;
    const at = d.frameCentre, o0 = doorPt(d, d.def.width / 2, 0, side), o1 = doorPt(d, d.def.width / 2, 1, side), ox = o1[0] - o0[0], oz = o1[2] - o0[2], lx = -oz, lz = ox;
    const outPt = (back: number, lat: number): number[] => [at[0] + ox * back + lx * lat, 0, at[2] + oz * back + lz * lat], gate = outPt(0.7, 0);
    const free = (p: number[]): number[] | null => { const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; };
    const clearTo = (p: number[]) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
    const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'), spots: number[][] = [];
    for (const back of [3.2, 4.2, 2.4, 5.2, 6.2]) for (const lat of [1.1, -1.1, 0.4, -0.4, 1.9, -1.9]) { const p = free(outPt(back, lat)); if (p && clearTo(p) && flat(p, at) > 1.8 && !spots.some(s => flat(s, p) < 0.8)) spots.push(p); }
    if (spots.length < team.length + 1) { A.note = `no floor outside for the team (${spots.length} spots)`; return A; }
    team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(-ox, -oz); });
    await quiet(() => g.teleportPlayer(spots[team.length] as any));
    await quiet(() => step(30));
    const s0 = { ...D.stats }, t0 = g.time, why = await quiet(() => O.give('openClear', O.targetAt(at), 'all'));
    if (why) { A.note = `refused: ${why}`; return A; }
    let idle = 0, began = false;
    await quiet(() => { for (let i = 0; i < 60 * 240; i++) { step(); if (D.ops.length) { began = true; idle = 0; } else if (++idle > (began ? 90 : 240)) break; } });
    const op = D.done[D.done.length - 1]; A.end = op?.ended ?? 'no order ended'; A.secs = +(g.time - t0 - idle / 60).toFixed(1);
    A.left = op?.search ? op.search.left : -1; A.flowed = D.stats.flowed - s0.flowed; A.moved = D.stats.sentOn - s0.sentOn - A.flowed;
    const cell = (p: number[]) => nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell));
    const up = team.filter(x => x.state !== 'dead'); A.inFar = up.filter(x => H.hidden.has(cell(x.char.pos))).length;
    A.where = up.map(x => `${VERBOSE ? `${x.callsign} ` : ''}(${x.char.pos[0].toFixed(1)}, ${x.char.pos[2].toFixed(1)})${VERBOSE ? ` ${O.of(x)?.there ?? '-'}` : ''}`).join(VERBOSE ? ' · ' : ' ');
    if (up.length < team.length) A.note = `${team.length - up.length} of the team down`;
    if (op) { const b = (op.beats as { what: string }[] | undefined)?.map(x => x.what).filter(x => /^(flow|bound|close up|on):|^flow: no|searched/.test(x)).join(' | '); if (b) A.note += (A.note ? ' · ' : '') + b; }
    return A;
  } finally { DOORTOOLS.flowOn = keep; DOORTOOLS.openAir = air; DOORTOOLS.flowMax = max; }
}

const rows: Row[] = [];
for (const scn of scns) {
  const S: any = await quiet(() => stage(scn, 1)); const g = S.g, faces: { door: string; side: 1 | -1; cells: number; hidden: number; lim: '' | 'sky' | 'big' }[] = [];
  for (const d of g.doors.list) for (const side of [1, -1] as const) { if (only && d.def.name !== only) continue; const H = hiddenOf(g, d, side); if (H && H.hidden.size >= MIN) faces.push({ door: d.def.name, side, cells: H.room.cells.size, hidden: H.hidden.size, lim: openFloor(g, H.room) ? 'sky' : DOORTOOLS.flowMax > 0 && H.room.cells.size > DOORTOOLS.flowMax ? 'big' : '' }); }
  console.log(`\n${scn}: ${faces.length} door face${faces.length === 1 ? '' : 's'} onto a room with ${MIN}+ cells its entry points cannot see`);
  for (const f of faces) { const off = await arm(scn, f.door, f.side, false), on = await arm(scn, f.door, f.side, true), wide = f.lim ? await arm(scn, f.door, f.side, true, true) : undefined; rows.push({ scn, ...f, off, on, wide });
    const show = (A: Arm) => A.left < 0 ? `— ${A.note || A.end}` : `${String(A.left).padStart(3)} unseen · ${A.inFar} in the far part · ${A.flowed} went in, ${A.moved} moved to look · ${A.secs} s`;
    console.log(`  ${f.door.padEnd(18)} ${f.side > 0 ? '+' : '-'}  ${String(f.cells).padStart(4)} cells, ${String(f.hidden).padStart(3)} hidden   off: ${show(off)}\n  ${''.padEnd(48)}on:  ${show(on)}${wide ? `\n  ${(f.lim === 'sky' ? 'under the sky' : 'past flowMax').padEnd(48)}was: ${show(wide)}` : ''}`);
    if (VERBOSE) console.log(`      off ${off.where} ${off.note}\n      on  ${on.where} ${on.note}`); }
}
if (!rows.length) { console.log(`\nno door face with ${MIN}+ cells its entry points cannot see: nothing to check`); process.exit(0); }
const ran = rows.filter(r => !r.lim && r.off.left >= 0 && r.on.left >= 0), sum = (f: (r: Row) => number) => ran.reduce((n, r) => n + f(r), 0);
const done = (A: Arm) => A.left < DOORTOOLS.deadCells;
const worse = ran.filter(r => r.on.left > r.off.left + 3 && !done(r.on)), lost = rows.filter(r => !r.lim && r.off.left >= 0 && r.on.left < 0);   // (lost: an entry that ended with the rule off and did not with it on)
console.log(`\n${rows.length} door faces · ${rows.filter(r => r.lim).length} of them onto floor the rule leaves alone · ${ran.length} of the others played both ways (the rest: ${rows.filter(r => !r.lim && !ran.includes(r)).map(r => `${r.scn} ${r.door}${r.side > 0 ? '+' : '-'}: ${r.on.note || r.off.note || r.on.end}`).join('; ') || 'none'})`);
console.log(`                                      rule off   rule on\n  floor nobody looked at (cells)      ${String(sum(r => r.off.left)).padStart(7)}   ${String(sum(r => r.on.left)).padStart(7)}\n  rooms looked over to the last corner ${String(ran.filter(r => done(r.off)).length).padStart(6)}   ${String(ran.filter(r => done(r.on)).length).padStart(7)}\n  rooms with a man in the hidden part ${String(ran.filter(r => r.off.inFar > 0).length).padStart(7)}   ${String(ran.filter(r => r.on.inFar > 0).length).padStart(7)}\n  … with two or more there            ${String(ran.filter(r => r.off.inFar > 1).length).padStart(7)}   ${String(ran.filter(r => r.on.inFar > 1).length).padStart(7)}\n  seconds per entry (mean)            ${(sum(r => r.off.secs) / Math.max(1, ran.length)).toFixed(1).padStart(7)}   ${(sum(r => r.on.secs) / Math.max(1, ran.length)).toFixed(1).padStart(7)}`);
const ok = !ran.length ? null : !worse.length && !lost.length && sum(r => r.on.left) < sum(r => r.off.left);
console.log(`- ${ok === null ? 'NO VERDICT' : ok ? 'PASS' : 'FAIL'} — with the rule on no door leaves more floor unseen than with it off, and less is left in all\n    ${[...worse.map(r => `${r.scn} ${r.door}${r.side > 0 ? '+' : '-'}: ${r.off.left} → ${r.on.left} unseen`), ...lost.map(r => `${r.scn} ${r.door}${r.side > 0 ? '+' : '-'}: no entry ended with the rule on (${r.on.note || r.on.end})`)].join('; ') || (ran.length ? `${ran.length} doors · ${sum(r => r.off.left)} → ${sum(r => r.on.left)} cells` : 'no door onto a room the rule works was played')}`);
// (the floor the rule leaves alone: only faces whose entry was played count — a refused order or no floor outside proves nothing)
const played = (A?: Arm) => !!A && !!A.end && A.end !== 'no order ended', lim = rows.filter(r => r.lim && played(r.on));
const went = lim.filter(r => r.on.flowed > 0 || (r.lim === 'sky' && r.on.left >= 0)), was = lim.filter(r => played(r.wide) && r.wide!.flowed > 0);
const kind = (k: 'sky' | 'big', words: string) => { const of = lim.filter(r => r.lim === k), w = was.filter(r => r.lim === k); return `${words}: ${of.length} played${of.length ? `, with both limits off men went in at ${w.length} (${w.reduce((n, r) => n + r.wide!.flowed, 0)} walks)` : ''}`; };
console.log(`- ${went.length ? 'FAIL' : !was.length ? 'NO VERDICT' : 'PASS'} — as shipped no pair is walked into the unseen part of floor under the sky or of a room past ${DOORTOOLS.flowMax} cells, and floor under the sky is not searched\n    ${went.map(r => `${r.scn} ${r.door}${r.side > 0 ? '+' : '-'} (${r.lim}): ${r.on.flowed} went in${r.lim === 'sky' && r.on.left >= 0 ? ', searched' : ''}`).join('; ') || `${kind('sky', 'under the sky')} · ${kind('big', 'past the size')}`}`);
const open = ran.filter(r => !done(r.on));
if (open.length) console.log(`  not looked over to the last corner with the rule on (${open.length}): ${open.map(r => `${r.scn} ${r.door}${r.side > 0 ? '+' : '-'} (${r.on.left} of ${r.cells} unseen)`).join(', ')}`);
if (out) writeFileSync(out, JSON.stringify(rows, null, 1));
process.exit(ok === false || went.length ? 1 : 0);
