// A KNOWN THREAT FIRST — src/game/doortools.ts DOORTOOLS.threatFirst, the maintainer's replay note (the compound on hard, 10-11): "the point man here saw his
// buddy go down, knows roughly where the enemy is in the room and looks the wrong way going in".
//   [TPS_PROFILE=shipped] bun run tools/qa/threatfirst-check.ts [--seed N] [--at x,z] [--verbose]        exit 0 = holds, 1 = it does not
// The compound's room clear with four, every defender but one off the floor (the one left stands in his own room across the compound: he is only the name
// on the round). The four are stood outside the shed's south door `shed_s` and told to HOLD it from the threshold; once they hold, a round is FILED as fired
// from inside the shed past the far-jamb man (a 'guardShot' event with its muzzle and where it stopped: what combat.ts files for a real round — nobody is
// hurt), and a second later the word is given. Watched from there: the first man over the frame line, and how far his gun is off the bearing to where that
// round came from, every frame from the one he crosses until the order lets his gun go ('threat …' beat) — at most the cap.
//   (1) rule ON: the order knows the place ('threat known' beat), deals it to the first two in, and the first man's gun is within 30° of it the whole way
//   (2) rule OFF, the same staging: no such beat, and his gun is more than 30° off it somewhere in the same stretch — the fault the note is about
//   (3) nothing known (no round filed): the entry is the same entry with the rule on and off — every man's place and gun, frame for frame
// THREATFIRST_BREAK=1 runs (1) with the rule off: must fail.
import { ROOT } from './headless.ts';
import { stage } from './bang-tally.ts';
const { DOORTOOLS, doorPt, offOf, alongOf } = await import(`${ROOT}/src/game/doortools.ts`);
const CBM = await import(`${ROOT}/src/game/combat.ts`);

const args = process.argv.slice(2), flag = (n: string) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const VERBOSE = args.includes('--verbose'), SEED = Number(flag('--seed') ?? 1), BREAK = process.env.THREATFIRST_BREAK === '1';
const AT = flag('--at')?.split(',').map(Number);
const SCN = 'compound-four', DOOR = 'shed_s', DEG = 180 / Math.PI;
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { if (VERBOSE) return await fn(); const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => {}; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };

interface Arm {
  note: string; beats: string[]; first: string; known: boolean; dealt: boolean; at: number[];
  /** the first man's gun off the bearing to the known place, degrees, per frame from the one he crossed on · the frames the order had his gun on it · why it let go */
  off: number[]; held: number; let: string;
  /** every man's place and gun on every frame from the word on (case 3's compare) */
  trace: string[];
}

async function arm(on: boolean, shot: boolean): Promise<Arm> {
  const keep = DOORTOOLS.threatFirst;
  const A: Arm = { note: '', beats: [], first: '', known: false, dealt: false, at: [], off: [], held: 0, let: '', trace: [] };
  try {
    const S: any = await quiet(() => stage(SCN, SEED)); DOORTOOLS.threatFirst = on; const g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav, step = S.step;
    const d = g.doors.list.find((x: any) => x.def.name === DOOR); if (!d) { A.note = `no door ${DOOR}`; return A; }
    const W = d.def.width, mid = (side: 1 | -1) => doorPt(d, W / 2, 1.0, side), cells = (side: 1 | -1) => g.fight.roomAt(mid(side))?.cells.size ?? Infinity;
    const side: 1 | -1 = cells(1) > cells(-1) ? 1 : -1, into = -side as 1 | -1, room = g.fight.roomAt(mid(into));   // (the squad's face: the yard, not the shed)
    if (!room) { A.note = 'no room behind the door'; return A; }
    const inRoom = (p: number[]) => room.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell));
    // every defender but the one furthest from the shed is taken off the floor; he is the name on the round
    const hostiles: any[] = g.guards.filter((x: any) => x.state !== 'dead' && x.team === 'hostile').sort((a: any, b: any) => flat(b.char.pos, d.frameCentre) - flat(a.char.pos, d.frameCentre));
    const by = hostiles.find(h => !inRoom(h.char.pos) && flat(h.char.pos, d.frameCentre) > 12); if (!by) { A.note = 'no defender far from the shed to name on the round'; return A; }
    for (const x of hostiles) if (x !== by) await quiet(() => CBM.killGuard(g, x, [0, 0, 1], true));
    // the team a few steps outside the door, the commander behind them
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
    // … until they hold the jambs with the door open
    let i = 0; await quiet(() => { for (; i < 60 * 40 && !(op.phase === 'thr' && op.thr?.jamb.length >= 2 && op.thr.jamb.every((m: any) => op.mine.get(m)?.arrived)); i++) step(); });
    if (op.phase !== 'thr') { A.note = `never held the door (phase ${op.phase}, ${op.beats.map((b: any) => b.what).slice(-3).join(' | ')})`; return A; }
    await quiet(() => step(45));
    const jamb: any[] = op.thr.jamb, lead = jamb[0], far = jamb[1];
    // WHERE THE ROUND CAME FROM: inside the shed, to the hand of the doorway the first man's own point is NOT on (the replay's picture: his point one way, the
    // fire from the other), on floor, well inside — or `--at x,z`
    const pods: { pos: number[] }[] = op.thr.pods, p1 = pods[0]?.pos ?? mid(into), hand = Math.sign(alongOf(d, p1) - W / 2) || 1;
    let from: number[] | null = AT ? [AT[0], 1.3, AT[1]] : null;
    if (!from) for (const [L, deep] of [[2.2, 3.0], [1.8, 3.4], [2.6, 2.6], [1.4, 3.2], [1.0, 3.6], [2.0, 2.2], [3.0, 3.0]]) { const p = doorPt(d, W / 2 - hand * L, deep, into); if (inRoom(p) && !nav.isBlocked(p[0], p[2]) && !g.col.segmentBlocked([p[0], 1.3, p[2]], doorPt(d, W / 2, 0.3, into, 1.3))) { from = [p[0], 1.3, p[2]]; break; } }
    if (!from) { A.note = 'no floor in the shed to fire the round from'; return A; }
    A.at = [from[0], from[2]];
    if (shot) { const tp = far.char.pos, to = [tp[0] + (tp[0] - from[0]) * 0.2, 1.2, tp[2] + (tp[2] - from[2]) * 0.2];   // (past the far-jamb man, a stride on)
      g.events.push({ kind: 'guardShot', pos: [from[0], 0, from[2]], time: g.time, loud: true, level: 1, from: [...from], to, who: by.char.id }); }
    await quiet(() => step(60));
    const r = await quiet(() => D.thresholdTell('step', DOOR, 'all')); if (typeof r === 'string' && r) { A.note = `the word was refused: ${r}`; return A; }
    // watched: the first man over the frame line, his gun against the bearing to the place, until the order lets it go (or 4 s)
    let first: any = null, letT = NaN, n0 = op.beats.length; const men: any[] = [...op.men];
    await quiet(() => { for (let k = 0; k < 60 * 8; k++) { step();
      A.trace.push(men.map(m => `${m.char.pos[0].toFixed(4)},${m.char.pos[2].toFixed(4)},${m.char.aimYaw.toFixed(4)}`).join(' '));
      if (!first) first = men.find(m => m.state !== 'dead' && offOf(d, m.char.pos, side) < -0.15 && alongOf(d, m.char.pos) > -0.6 && alongOf(d, m.char.pos) < W + 0.6) ?? null;
      for (; n0 < op.beats.length; n0++) { const b = op.beats[n0].what; if (first && isNaN(letT) && b.startsWith('threat ') && b.endsWith(`· ${first.callsign}`)) { letT = g.time; A.let = b; } }
      if (first && isNaN(letT) && A.off.length < 60 * DOORTOOLS.threatCap) { const p = first.char.pos; A.off.push(Math.abs(wrap(first.char.aimYaw - Math.atan2(from![0] - p[0], from![2] - p[2]))) * DEG); }
      if (!D.ops.includes(op) && k > 240) break; } });
    A.first = first?.callsign ?? ''; A.beats = op.beats.map((b: any) => `${b.t.toFixed(2)} ${b.what}`);
    A.known = op.beats.some((b: any) => b.what.startsWith('threat known')); A.dealt = op.beats.some((b: any) => b.what.startsWith('threat first'));
    A.held = A.off.length; if (!first) A.note = 'nobody crossed the frame'; else if (lead !== first && VERBOSE) console.log(`  (first through was ${first.callsign}, the lead ${lead.callsign})`);
    return A;
  } finally { DOORTOOLS.threatFirst = keep; }
}

const max = (a: number[]) => a.reduce((m, x) => Math.max(m, x), 0), show = (A: Arm) => A.note ? A.note : `first through ${A.first} · place (${A.at.map(x => x.toFixed(1)).join(', ')}) · ${A.known ? 'known' : 'not known'}${A.dealt ? ', dealt' : ''} · gun off it: worst ${max(A.off).toFixed(0)}°, at the frame line ${(A.off[0] ?? NaN).toFixed(0)}° over ${A.off.length} frames${A.let ? ` · let go: ${A.let}` : ''}`;
export async function threatfirstCheck(): Promise<boolean> {
  let fails = 0; const line = (ok: boolean, what: string) => { console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${what}`); if (!ok) fails++; };

  console.log(`=== threatfirst-check · ${SCN} ${DOOR} · seed ${SEED}${BREAK ? ' · THREATFIRST_BREAK: the rule off where it should be on' : ''} ===`);
  const onA = await arm(!BREAK, true), offA = await arm(false, true);
  console.log(`  on:  ${show(onA)}\n  off: ${show(offA)}`);
  if (VERBOSE) console.log(`  on, per frame: ${onA.off.map(x => x.toFixed(0)).join(" ")}\n  off, per frame: ${offA.off.map(x => x.toFixed(0)).join(" ")}`);
  if (VERBOSE) { console.log('  on beats:\n    ' + onA.beats.join('\n    ')); console.log('  off beats:\n    ' + offA.beats.join('\n    ')); }
  line(!onA.note && onA.known && onA.dealt, `rule on: the order knows where the round came from and deals it to the first men in${onA.note ? ` (${onA.note})` : ''}`);
  line(!onA.note && onA.off.length >= 6 && max(onA.off) <= 30, `rule on: the first man through has his gun within 30° of that place from the frame he crosses until it is let go (worst ${max(onA.off).toFixed(0)}° over ${onA.off.length} frames)`);
  line(!onA.note && !!onA.let, `rule on: his gun is let go for his corners (${onA.let || 'never'})`);
  line(!offA.note && !offA.known && !offA.dealt && max(offA.off) > 30, `rule off: nothing is known or dealt, and the first man's gun is more than 30° off that place going in — the fault (worst ${max(offA.off).toFixed(0)}°)`);
  const onN = await arm(true, false), offN = await arm(false, false);
  let diff = -1; for (let i = 0; i < Math.max(onN.trace.length, offN.trace.length); i++) if (onN.trace[i] !== offN.trace[i]) { diff = i; break; }
  line(!onN.note && !offN.note && !onN.known && !onN.dealt && onN.trace.length > 120 && diff < 0, `nothing known: the entry is the same with the rule on and off, every man's place and gun over ${onN.trace.length} frames${onN.note || offN.note ? ` (${onN.note || offN.note})` : diff >= 0 ? ` (they part at frame ${diff})` : ''}`);
  console.log(fails ? `=== threatfirst-check: ${fails} FAILED ===` : '=== threatfirst-check: ALL PASS ===');
  return fails === 0;
}
if (import.meta.main) process.exit((await threatfirstCheck()) ? 0 : 1);
