// A CHARGE ORDER WHOSE DOOR COMES OPEN UNDER IT — src/game/doortools.ts `stayHands`, under DOORTOOLS.openHand. Off a replay of Mousehole (10-13): the
// order ended on "door's open." and three men kept walking to stand-off marks past the far jamb, across the open doorway; one was shot in it.
//   [TPS_PROFILE=shipped] bun run tools/qa/chargeopen-check.ts [--scn id] [--door name] [--hand hinge|latch] [--seed N] [--verbose]        exit 0 = holds, 1 = it does not
// The compound's room clear with four (door a_s), every defender off the floor but one far from the door. The four stand in file along the wall past one
// jamb of a shut door — the hand the charge's stand-off marks are NOT dealt on (past the hinge first, else past the latch: it hangs on the floor either
// side, and the two stands differ in furniture) — are told to breach it with a charge, and half a second later the leaf is put open by hand. Watched for eight seconds:
//   (1) rule ON: no man of the order is in front of the opening after it came open, and the order says whose hand it kept
//   (2) rule OFF, the same staging: men walk across the open doorway — the fault
//   (3) the door left shut: the same beats with the rule on and off (the charge is set, they stand off)
// CHARGEOPEN_BREAK=1 runs (1) with the rule off: must fail.
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { DOORTOOLS, doorPt, offOf, alongOf } = await import(`${ROOT}/src/game/doortools.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VERBOSE = args.includes('--verbose'), SEED = Number(flag('--seed') ?? 1), BREAK = process.env.CHARGEOPEN_BREAK === '1';
const SCN = flag('--scn') ?? 'compound-four', DOOR = flag('--door') ?? 'a_s', HANDS: (-1 | 1)[] = flag('--hand') === 'latch' ? [1] : flag('--hand') === 'hinge' ? [-1] : [-1, 1];
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Arm { note: string; beats: string[]; front: string[]; kept: number; ended: string; marks: string }

async function arm(on: boolean, open: boolean, hand: -1 | 1): Promise<Arm> {
  const keep = DOORTOOLS.openHand;
  const A: Arm = { note: '', beats: [], front: [], kept: 0, ended: '', marks: '' };
  try {
    const S: any = await quiet(() => stage(SCN, SEED)); DOORTOOLS.openHand = on; const g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav, step = S.step;
    const d = g.doors.list.find((x: any) => x.def.name === DOOR); if (!d) { A.note = `no door ${DOOR}`; return A; }
    const W = d.def.width, mid = (side: 1 | -1) => doorPt(d, W / 2, 1.0, side), cells = (side: 1 | -1) => g.fight.roomAt(mid(side))?.cells.size ?? Infinity;
    const side: 1 | -1 = cells(1) > cells(-1) ? 1 : -1, into = -side as 1 | -1, room = g.fight.roomAt(mid(into));
    const inRoom = (p: number[]) => !!room && room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell));
    const hostiles: any[] = g.guards.filter((x: any) => x.state !== 'dead' && x.team === 'hostile').sort((a: any, b: any) => flat(b.char.pos, d.frameCentre) - flat(a.char.pos, d.frameCentre));
    const by = hostiles.find(h => !inRoom(h.char.pos) && flat(h.char.pos, d.frameCentre) > 12); if (!by) { A.note = 'no defender far from the door to leave standing'; return A; }
    for (const x of hostiles) if (x !== by) await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
    const fc = d.frameCentre, team: any[] = O.squad().filter((x: any) => x.state !== 'dead'), spots: number[][] = [];
    // (in file along the wall out past one jamb, nearest the door first; then Sam behind them. HAND: -1 = past the hinge, 1 = past the latch)
    const front = doorPt(d, W / 2, 0.75, side, 1.1);
    for (let k = 0; k < 14 && spots.length < team.length + 1; k++) { const a = hand < 0 ? -1.3 - k * 0.9 : W + 1.3 + k * 0.9, p = doorPt(d, a, 0.75, side);
      if (!nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.1, p[2]], front)) spots.push([p[0], 0, p[2]]); }
    if (team.length < 4 || spots.length < team.length + 1) { A.note = `staging: ${team.length} men, ${spots.length} places along the wall past the ${hand < 0 ? 'hinge' : 'latch'}`; return A; }
    const th = d.def.closedDir, face = Math.atan2(Math.cos(th), Math.sin(th));
    team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.bodyYaw = gd.char.aimYaw = face; });
    await quiet(() => g.teleportPlayer(spots[team.length] as any));
    await quiet(() => step(30));
    const r = await quiet(() => O.give('charge', { kind: 'door', at: [fc[0], 0, fc[2]], door: d, side }, 'all')); if (typeof r === 'string' && r) { A.note = `refused: ${r}`; return A; }
    const op: any = D.ops[D.ops.length - 1]; if (!op || op.door !== d) { A.note = 'no charge order on the door'; return A; }
    A.marks = [...op.men].map((m: any) => { const P = op.mine.get(m)?.post; return P ? `${m.callsign} ${alongOf(d, P).toFixed(1)}` : `${m.callsign} -`; }).join(', ');
    await quiet(() => step(30));
    if (open) { d.latched = false; d.angle = (d.swing || 1) * 1.4; d.vel = 0; d.closing = false; }
    const men: any[] = [...op.men], seen = new Set<string>();
    await quiet(() => { for (let f = 0; f < 60 * 8; f++) { step(); if (open && f > 6) for (const m of men) { if (m.state === 'dead') continue; const a = alongOf(d, m.char.pos), o = offOf(d, m.char.pos, side); if (a > 0.1 && a < W - 0.1 && o > 0 && o < 3) seen.add(m.callsign); } } });
    A.front = [...seen]; A.beats = op.beats.map((b: any) => String(b.what)); A.kept = A.beats.filter(b => b.startsWith('hand kept')).length; A.ended = D.ops.includes(op) ? `still ${op.phase}` : 'ended';
    return A;
  } finally { DOORTOOLS.openHand = keep; }
}

export async function chargeopenCheck(): Promise<boolean> {
  let ok = true; const line = (pass: boolean, what: string, more = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}`); if (more) console.log(`    ${more}`); if (!pass) ok = false; };
  const say = (A: Arm) => A.note ? A.note : `in front of the opening: ${A.front.length ? A.front.join(', ') : 'nobody'} · hands kept ${A.kept} · ${A.ended} · marks along the wall ${A.marks}${VERBOSE ? ' · ' + A.beats.join(' | ') : ''}`;
  // (which hand of the door the marks are dealt on hangs on the floor either side of it, and the stands differ in furniture: the men are staged on the
  //  hand the order then walks them ACROSS from — the first of hinge, latch where the rule-off run shows men in front of the opening)
  let hand: -1 | 1 = HANDS[0], b = await arm(false, true, hand);
  for (const h of HANDS.slice(1)) { if (!b.note && b.front.length > 0) break; hand = h; b = await arm(false, true, h); }
  const where = `${SCN} ${DOOR}, the men past the ${hand < 0 ? 'hinge' : 'latch'}`;
  if (BREAK) { line(!b.note && b.front.length === 0 && b.kept > 0, `a charge order whose door comes open under it (${where}): nobody walks across the open doorway to a stand-off mark`, say(b)); return ok; }
  const a = await arm(true, true, hand);
  line(!a.note && a.front.length === 0 && a.kept > 0, `a charge order whose door comes open under it (${where}): nobody walks across the open doorway to a stand-off mark`, say(a));
  line(!b.note && b.front.length > 0 && b.kept === 0, 'without the rule the same order walks men across the open doorway', say(b));
  const c = await arm(true, false, hand), e = await arm(false, false, hand);
  line(!c.note && !e.note && c.kept === 0 && c.beats.includes('set') && c.beats.join('|') === e.beats.join('|'), 'a door that stays shut is charged the same with the rule on and off', `on ${say(c)} · off ${say(e)}`);
  return ok;
}

if (import.meta.main) { const ok = await chargeopenCheck(); console.log(`=== chargeopen: ${ok ? 'ALL PASS' : 'FAILED'} ===`); process.exit(ok ? 0 : 1); }
