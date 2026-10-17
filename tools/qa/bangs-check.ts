// A BANG AND CLEAR'S CAN IS THROWN INTO THE ROOM — the check behind DOORTOOLS.bangInto (src/game/doortools.ts bangSpot and the 'toss' / 'fuse' phases: on
// in the page, ?banginto=0; off on the frozen stand, TPS_BANGINTO=1) — and the stand, journal and boot lines of DOORTOOLS.wordNoCan (the word at a door
// held from outside spends no can: ?wordnocan=0, TPS_WORDNOCAN=1; what the word then DOES is asked in `probes.ts threshold-hold`, WORDNOCAN_BREAK=1 there).
//   bun run tools/qa/bangs-check.ts        (also `probes.ts bangs`)
// The maintainer's own case (10-16, with a tape of it: "with bang and clear for a door, they often don't really throw the flash bang into the room"): on
// his tape the thrower stood two metres down the wall, the can appeared in the door frame and went off in the air 1.75 m inside a third of a second later.
// Staged on the block, the squad of four set down outside a shut door, anybody who sees the stack taken off the floor, 'bang and clear' given:
//   (1) the stand: each switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) the rule off, a door with a deep room behind it: the can first shows more than a metre from the man who threw it and goes off inside two metres of
//       the frame — the fault as he met it;
//   (3) the rule on, the same door: the can first shows at the thrower's own hand, is passed to the door's edge, and goes off chest high a metre or more
//       deeper than it did, inside the room, where the toss said it would; nobody of ours is dazzled;
//   (4) the rule on, a second door: thrown into the room there too (1.5 m or more inside, at the point named), from the hand;
//   (5) the pair given the order, a third man of the team standing in the room where their can went: it is still thrown, and not to a point that would blind him;
//   (6) recordings from before each key replay with it off; the page's boot: no flag = on, ?banginto=0 / ?wordnocan=0 = off.
// BANGINTO_BREAK=1 = the switch left off where the lines want it on: they are asked all the same and must fail on what they find.   exit 0 = all hold · 1 = one does not
// Headless: lines are the collision's own. Never seen on a GPU; nobody has played it.
import { standUp, ROOT } from './headless.ts';
const BT: any = await import(`${ROOT}/tools/qa/bang-tally.ts`);
const { DOORTOOLS, doorPt, alongOf, offOf } = await import(`${ROOT}/src/game/doortools.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
type Vec3 = [number, number, number];

/** the block's doors the tally showed the most of: a hall door with a deep room behind it, and one the can is passed along the wall to */
const SCN = 'block-four', DEEP: [string, 1 | -1] = ['b_s', 1], SECOND: [string, 1 | -1] = ['s_n', -1];

export async function bangsCheck(): Promise<boolean> {
  const BREAK = process.env.BANGINTO_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== bangs: a bang and clear's can is thrown into the room, from the hand${BREAK ? ' — BANGINTO_BREAK: the rule never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const knobs0 = knobsCopy(), rnd0 = Math.random;
  const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), f1 = (x: number) => x.toFixed(1);
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { const W: any = await quiet(() => standUp({})); void W; const shipped = process.env.TPS_PROFILE === 'shipped';
      for (const [key, word] of [['bangInto', 'TPS_BANGINTO'], ['wordNoCan', 'TPS_WORDNOCAN']] as const) { const stood = (DOORTOOLS as any)[key], env = process.env[word], want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS[`DOORTOOLS.${key}`];
        line(stood === want && typeof row === 'string' && row.includes(`${word}=1`), `the stand, DOORTOOLS.${key}: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${stood} · ${word} ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); } }

    /** one bang and clear on a shut door, watched to its burst */
    const run = async (name: string, side: 1 | -1, rule: boolean, who: 'all' | 'red' = 'all', mateAt: number[] | null = null) => {
      const S: any = await quiet(() => BT.stage(SCN, 1)); const { g, step } = S; DOORTOOLS.bangInto = rule;   // (after the stand-up: the frozen stand holds it off)
      const O = g.orders, D = g.doorTools, nav = g.col.nav, d = g.doors.list.find((x: any) => x.def.name === name), W = d.def.width;
      const free = (p: number[]): number[] | null => { const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : null; };
      const gate = doorPt(d, W / 2, 0.7, side), clearTo = (p: number[]) => !g.col.solidBlocked([p[0], 1.1, p[2]], [gate[0], 1.1, gate[2]]);
      const team: any[] = O.squad().filter((x: any) => x.state !== 'dead'), spots: number[][] = [];
      for (const back of [3.2, 4.2, 2.4, 5.2, 6.2]) for (const lat of [1.1, -1.1, 0.4, -0.4, 1.9, -1.9]) { const p = free(doorPt(d, W / 2 + lat, back, side)); if (p && offOf(d, p, side) > 0.9 && clearTo(p) && flat(p, d.frameCentre) > 1.8 && !spots.some(s => flat(s, p) < 0.8)) spots.push(p); }
      { const far = [...spots].sort((x, y) => flat(y, d.frameCentre) - flat(x, d.frameCentre))[0]; spots.splice(spots.indexOf(far), 1); spots.splice(Math.min(team.length, spots.length), 0, far); }   // (Sam on the farthest spot: out of the stack's way)
      if (spots.length < team.length + 1) return null;
      const yawIn = Math.atan2(d.frameCentre[0] - spots[0][0], d.frameCentre[2] - spots[0][2]);
      team.forEach((x, i) => { const p = spots[i]; x.char.pos[0] = p[0]; x.char.pos[2] = p[2]; x.char.vel = [0, 0, 0]; x.path = []; x.pathGoal = null; x.speed = 0; x.char.bodyYaw = x.char.aimYaw = yawIn; });
      await quiet(() => g.teleportPlayer(spots[team.length] as any));
      d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place();
      for (const x of g.guards) { if (x.state === 'dead' || x.team !== 'hostile') continue;   // (the entry is counted, not the building: whoever sees the stack gather is taken off the floor)
        const c = [x.char.pos[0], 1.5, x.char.pos[2]]; if ([...spots.slice(0, team.length + 1), gate].some(p => !g.col.solidBlocked(c as any, [p[0], 1.3, p[2]]))) await quiet(() => killGuard(g, x, [0, 0, 1], true)); }
      step(10);
      const mate: any = mateAt ? team.find(x => /^Blue/.test(x.callsign)) : null;
      const t0 = g.time, dz0 = new Map<any, number>(g.guards.map((x: any) => [x, x.dazzledUntil ?? 0])), kf = ORDERS.knownFace, cl = ORDERS.cleared; ORDERS.knownFace = false; ORDERS.cleared = false;   // (the men were set down here by the staging: the face is theirs)
      let why: any; try { why = await quiet(() => O.give('bangClear', { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side }, who)); } finally { ORDERS.knownFace = kf; ORDERS.cleared = cl; }
      if (why) return { why: String(why) } as any;
      let op: any = null, can: any = null, out: any = { why: null, beats: [] as string[] }, nb = 0, passTo: number[] | null = null;
      for (let i = 0; i < 60 * 40; i++) { step();
        op ??= [...D.ops, ...D.done].find((o: any) => o.door === d && o.kind === 'bangClear');
        if (!op) continue;
        // (5): a man of the team who is NOT on the order walks into the room once it is given (given with him in there it is refused in words: 'behind that door'), to where the can went the time before
        if (mate && !out.mate) { out.mate = mate.callsign; mate.char.pos[0] = mateAt![0]; mate.char.pos[2] = mateAt![2]; mate.path = []; mate.pathGoal = null; await quiet(() => O.give('hold', { kind: 'point', at: [mateAt![0], 0, mateAt![2]] }, [mate])); }
        while (nb < op.beats.length) { const b = op.beats[nb++]; out.beats.push(`${(b.t - t0).toFixed(1)} ${b.what}`); if (/^toss:/.test(b.what)) { out.toss = b.what; out.tToss = b.t; } }
        if (!can && op.can) { can = op.can; const th = op.threw.char.pos; out.thrower = op.threw.callsign; out.handM = flat(th, can.pos); out.aim = op.aim ? { in: -offOf(d, op.aim.at, op.side), at: op.aim.at } : null; out.passed = !!op.pass; out.opSide = op.side;
          passTo = op.pass ? [...op.pass.to] : null; out.passMin = passTo ? flat(can.pos, passTo) : null;
          if (mate) { const m = mate.char.pos; out.mateIn = -offOf(d, m, op.side); out.mateM = out.aim ? flat(out.aim.at, m) : null; out.mateLine = out.aim ? flat(out.aim.at, m) <= DOORTOOLS.thrFlashM && !g.col.segmentBlocked(out.aim.at, [m[0], 1.45, m[2]]) : false; } }
        if (can && passTo && op.pass) out.passMin = Math.min(out.passMin, flat(can.pos, passTo));   // (the pass, while it is one: how near the door's edge the can FLEW before it was turned in there)
        if (can && can.fired) { const p = op.bangAt ?? can.pos; out.in = -offOf(d, p, op.side); out.y = p[1]; out.at = [p[0], p[1], p[2]]; out.flight = g.time - out.tToss; step(20);
          out.own = team.filter(x => (x.dazzledUntil ?? 0) > (dz0.get(x) ?? 0) + 1e-6).length; break; } }
      return out;
    };
    const say = (r: any) => !r ? 'no floor for the team at that door' : r.why ? `refused — ${r.why}` : r.in === undefined ? `no burst: ${r.beats.join(' → ')}` : `${r.thrower} threw · the can first shows ${f1(r.handM)} m from him${r.passed ? ` (passed to the door: flew to ${r.passMin.toFixed(2)} m of its edge)` : ''} · burst ${f1(r.in)} m inside at ${f1(r.y)} m up, ${r.flight.toFixed(2)} s after the toss · ours dazzled ${r.own} · ${r.toss}`;

    // (2) the rule off: the fault as he met it
    const off = await run(DEEP[0], DEEP[1], false);
    line(!!off && !off.why && off.in > 1.0 && off.in < 2.0 && off.handM > 1.0, `the rule off, ${DEEP[0]}: the can first shows more than a metre from the man who threw it and goes off inside two metres of the frame`, say(off));
    // (3) the rule on, the same door
    const on = await run(DEEP[0], DEEP[1], RULE);
    line(!!on && !on.why && !!off && on.handM < 0.6 && on.passed && on.passMin < 0.3 && !!on.aim && on.in >= off.in + 1.0 && Math.abs(on.in - on.aim.in) < 0.4 && flat(on.at, on.aim.at) < 0.4 && on.y > 0.9 && on.y < 1.4 && on.own === 0,
      `the rule on, ${DEEP[0]}: the can first shows at the thrower's own hand, is passed to the door's edge, and goes off chest high a metre or more deeper than it did, where the toss said it would; nobody of ours dazzled`, say(on) + (on?.aim ? ` · aimed ${f1(on.aim.in)} m in` : ' · no aim'));
    // (4) a second door
    const two = await run(SECOND[0], SECOND[1], RULE);
    line(!!two && !two.why && !!two.aim && two.in >= DOORTOOLS.bangIntoMin - 0.1 && flat(two.at, two.aim.at) < 0.4 && two.handM < 0.6 + (two.passed ? 0 : DOORTOOLS.bangHandM) && two.own === 0,
      `the rule on, ${SECOND[0]}: thrown into the room there too — ${DOORTOOLS.bangIntoMin} m or more inside, at the point named, from the hand (or from the door's edge by a man who stands at it)`, say(two) + (two?.aim ? ` · aimed ${f1(two.aim.in)} m in` : ' · no aim'));
    // (5) one of ours in its flash
    { const first = await run(DEEP[0], DEEP[1], RULE, 'red'), at = first?.aim?.at ?? null, r = at ? await run(DEEP[0], DEEP[1], RULE, 'red', at) : null;
      line(!!r && !r.why && r.thrower !== undefined && r.mateIn > 0.5 && !r.mateLine && (!r.aim || flat(r.aim.at, at) > 0.5),
        'a man of the team who is not on the order, standing in the room where the can went: the pair still throws, and not at him — the landing as it was, or a point with no line to him inside the flash',
        !first ? 'no floor for the team at that door' : !at ? `the pair alone: no point picked to ask it of — ${first.why ?? first.toss ?? first.beats.slice(-2).join(' → ')}` : r.why ? `the order refused — ${r.why}` : r.thrower === undefined ? `no can thrown: ${r.beats.slice(-3).join(' → ')}`
          : `the pair alone aimed ${f1(first.aim.in)} m in · ${r.mate} put there (${f1(r.mateIn)} m inside) · ${r.aim ? `the can then aimed ${f1(r.mateM)} m from him, a line to him inside the flash: ${r.mateLine}` : 'no point picked: the landing as it was'} · ${r.toss}`); }
    // (6) recordings from before the keys; the page's own boot
    { const S: any = await quiet(() => BT.stage(SCN, 1)), g = S.g, snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      for (const [key, flag] of [['bangInto', 'banginto'], ['wordNoCan', 'wordnocan']] as const) { const T = DOORTOOLS as any;
        T[key] = true; const old = snap(); delete old.tables.DOORTOOLS[key]; JOURNAL.applyKnobs(g, old); const without = T[key];
        const own = snap(); own.tables.DOORTOOLS[key] = true; JOURNAL.applyKnobs(g, own); const withIt = T[key];
        PROFILE.pageSwitches(new URLSearchParams('')); const a = T[key]; PROFILE.pageSwitches(new URLSearchParams(`${flag}=0`)); const b = T[key]; PROFILE.pageSwitches(new URLSearchParams('standfire=0')); const c = T[key];
        line(without === false && withIt === true && a === true && b === false && c === true, `DOORTOOLS.${key}: a recording from before the key replays with it off, one that carries it on plays with it on; the page's boot: no flag → on · ?${flag}=0 → off · another flag leaves it on`,
          `applyKnobs with no key → ${without} · with the key on → ${withIt} · '' → ${a} · '${flag}=0' → ${b} · 'standfire=0' → ${c}`); } }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== bangs: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await bangsCheck()) ? 0 : 1);
