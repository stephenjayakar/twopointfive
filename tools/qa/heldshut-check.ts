// A BANG TOLD AT A HELD DOOR THAT HAS COME SHUT — src/game/doortools.ts, the 'pocket' stage's leaf look under DOORTOOLS.bangWay. Off a replay of Mousehole
// (10-13): the squad held a door from outside, a teammate shut it, and the 'bang, then go in' that followed threw the can at the shut leaf.
//   [TPS_PROFILE=shipped] bun run tools/qa/heldshut-check.ts [--seed N] [--verbose]        exit 0 = holds, 1 = it does not
// The compound's room clear with four, every defender off the floor but one across the compound. The four are told to HOLD the shed's south door from the
// threshold; once they hold it open the leaf is put shut and latched (a hand's work: nothing of the order is touched), and ten frames later they are told
// 'bang, then go in'. Read off the order's own beats:
//   (1) rule ON: 'can waits: the door has come shut', the leaf is opened again, and no can bursts on the team's side ('bang · OUTSIDE' never; 'bang · inside'
//       or the can kept, 'can held'); a man of the order is over the frame line within twelve seconds
//   (2) rule OFF, the same staging: the can bursts outside — the fault
//   (3) the door left standing open: no wait, the can bursts inside, the same beats with the rule on and off
// HELDSHUT_BREAK=1 runs (1) with the rule off: must fail.
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { DOORTOOLS, doorPt, offOf } = await import(`${ROOT}/src/game/doortools.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VERBOSE = args.includes('--verbose'), SEED = Number(flag('--seed') ?? 1), BREAK = process.env.HELDSHUT_BREAK === '1';
const SCN = 'compound-four', DOOR = flag('--door') ?? 'shed_s';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Arm { note: string; beats: string[]; waits: boolean; outside: boolean; inside: boolean; held: boolean; crossed: number; angle: number }

async function arm(on: boolean, shut: boolean): Promise<Arm> {
  const keep = DOORTOOLS.bangWay;
  const A: Arm = { note: '', beats: [], waits: false, outside: false, inside: false, held: false, crossed: -1, angle: 0 };
  try {
    const S: any = await quiet(() => stage(SCN, SEED)); DOORTOOLS.bangWay = on; const g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav, step = S.step;
    const d = g.doors.list.find((x: any) => x.def.name === DOOR); if (!d) { A.note = `no door ${DOOR}`; return A; }
    const W = d.def.width, mid = (side: 1 | -1) => doorPt(d, W / 2, 1.0, side), cells = (side: 1 | -1) => g.fight.roomAt(mid(side))?.cells.size ?? Infinity;
    const side: 1 | -1 = cells(1) > cells(-1) ? 1 : -1, into = -side as 1 | -1, room = g.fight.roomAt(mid(into));
    if (!room) { A.note = 'no room behind the door'; return A; }
    const inRoom = (p: number[]) => room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell));
    const hostiles: any[] = g.guards.filter((x: any) => x.state !== 'dead' && x.team === 'hostile').sort((a: any, b: any) => flat(b.char.pos, d.frameCentre) - flat(a.char.pos, d.frameCentre));
    const by = hostiles.find(h => !inRoom(h.char.pos) && flat(h.char.pos, d.frameCentre) > 12); if (!by) { A.note = 'no defender far from the door to leave standing'; return A; }
    for (const x of hostiles) if (x !== by) await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
    const at = d.frameCentre, o0 = doorPt(d, W / 2, 0, side), o1 = doorPt(d, W / 2, 1, side), ox = o1[0] - o0[0], oz = o1[2] - o0[2], lx = -oz, lz = ox;
    const outPt = (back: number, lat: number): number[] => [at[0] + ox * back + lx * lat, 0, at[2] + oz * back + lz * lat], gate = outPt(0.7, 0);
    const free = (p: number[]): number[] | null => { const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; };
    const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'), spots: number[][] = [];
    for (const back of [3.2, 4.2, 2.4, 5.2, 6.2]) for (const lat of [1.1, -1.1, 0.4, -0.4, 1.9, -1.9]) { const p = free(outPt(back, lat)); if (p && !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]) && flat(p, at) > 1.8 && !spots.some(s => flat(s, p) < 0.8)) spots.push(p); }
    if (team.length < 4 || spots.length < team.length + 1) { A.note = `staging: ${team.length} men, ${spots.length} spots outside`; return A; }
    team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(-ox, -oz); });
    await quiet(() => g.teleportPlayer(spots[team.length] as any));
    await quiet(() => step(30));
    const op: any = await quiet(() => D.thresholdOn(DOOR, 'all', side, true)); if (typeof op === 'string') { A.note = `refused: ${op}`; return A; }
    let i = 0; await quiet(() => { for (; i < 60 * 40 && !(op.phase === 'thr' && op.thr?.jamb.length >= 2 && op.thr.jamb.every((m: any) => op.mine.get(m)?.arrived)); i++) step(); });
    if (op.phase !== 'thr') { A.note = `never held the door (phase ${op.phase}, ${op.beats.map((b: any) => b.what).slice(-3).join(' | ')})`; return A; }
    await quiet(() => step(45));
    const n0 = op.beats.length;
    if (shut) { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.pullT = 0; await quiet(() => step(10)); A.angle = d.angle; if (!d.latched) { A.note = 'the leaf would not stay shut'; return A; } }
    const r = await quiet(() => D.thresholdTell('bang', DOOR, 'all')); if (typeof r === 'string' && r) { A.note = `the word was refused: ${r}`; return A; }
    const men: any[] = [...op.men];
    await quiet(() => { for (let f = 0; f < 60 * 12; f++) { step(); if (A.crossed < 0 && men.some(m => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.3)) A.crossed = f / 60; } });
    A.beats = op.beats.slice(n0).map((b: any) => String(b.what));
    A.waits = A.beats.some(b => b.startsWith('can waits: the door has come shut')); A.held = A.beats.includes('can held');
    A.outside = A.beats.some(b => b.startsWith('bang · OUTSIDE')); A.inside = A.beats.some(b => b.startsWith('bang · inside'));
    return A;
  } finally { DOORTOOLS.bangWay = keep; }
}

export async function heldshutCheck(): Promise<boolean> {
  let ok = true; const line = (pass: boolean, what: string, more = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}`); if (more) console.log(`    ${more}`); if (!pass) ok = false; };
  const say = (A: Arm) => A.note ? A.note : `${A.waits ? 'waited for the leaf · ' : ''}${A.outside ? 'burst OUTSIDE' : A.inside ? 'burst inside' : A.held ? 'can kept' : 'no burst'} · first man over the line ${A.crossed < 0 ? 'never' : A.crossed.toFixed(1) + ' s'}${VERBOSE ? ' · ' + A.beats.join(' | ') : ''}`;
  const a = await arm(!BREAK, true);
  line(!a.note && a.waits && !a.outside && (a.inside || a.held) && a.crossed >= 0, 'a bang told at a held door that has come shut: the leaf is opened first, no can bursts on the team\'s side, and they go in', say(a));
  if (BREAK) return ok;
  const b = await arm(false, true);
  line(!b.note && b.outside && !b.waits, 'without the rule the same order throws its can at the shut leaf', say(b));
  const c = await arm(true, false), e = await arm(false, false);
  line(!c.note && !e.note && !c.waits && c.inside && !c.outside && c.beats.join('|') === e.beats.join('|'), 'a held door left standing open is banged the same with the rule on and off', `on ${say(c)} · off ${say(e)}`);
  return ok;
}

if (import.meta.main) { const ok = await heldshutCheck(); console.log(`=== heldshut: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1); }
