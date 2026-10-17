// AN ORDERED WALK KEEPS OFF LIT FLOOR THAT AN UNCLEARED ROOM CAN SEE — the check behind SEENWALK (src/game/seenwalk.ts, asked in src/game/orders.ts route():
// on in the page, ?seenwalk=0; off on the frozen stand, TPS_SEENWALK=1).
//   bun run tools/qa/seenwalk-check.ts        (also `probes.ts seenwalk`)
// The maintainer, of the squad's walk past lit glass at the glasshouse (10-16): "can that just work with the regular visibility systems? men will consider
// themselves visible in that condition". Staged on the office floor (room-clear-four) and at the glasshouse, nobody left to shoot, the squad where it starts:
//   (1) the stand: the switch as the stand says, and FROZEN_HOLDS carries its row and word;
//   (2) the office floor, the walk to a door's face that is most in view: with the rule off its way crosses metres of lit floor a room nobody has been in
//       has a sight line to; with it on, the way to THE SAME POINT is `less` metres or more the less in view, at most `long` times as long + 1 m, and takes
//       no door the short way does not — and BY HAND, with none of the rule's own price (the place's light on the meter at each half metre of the way,
//       a line cast to it from every floor cell of every room nobody has been in), the way it gives is a metre or more the less in view;
//   (3) … and a man given that move WALKS it: fewer metres of his walk are on such floor with the rule on than off, and he gets there both times;
//   (3b) … and the same walk with the picture asking walks of its own between the ticks (as the page's drawn throw plans do, and a headless run never
//       does) is the same walk to the bit: nothing read is kept past the tick;
//   (4) the regular systems: with nothing called lit (the bar over the meter's top) the way is the way as it was — and with every room walked through
//       (nobody left who has not been looked at) too;
//   (5) the glasshouse, the walk to the front door across the floodlit forecourt: in view all the way and no way round by the same doors — the way as it
//       was, the mark where it was, the order not refused;
//   (6) a recording from before the table replays with it off; the page's boot: no flag = on, ?seenwalk=0 = off;
//   (7) what is read is kept for the tick and no longer: the same walk asked again in the same tick casts no line and is the same way; a door moved, or
//       the clock moved, it is read again; read cold (seenReset, as a restart and a checkpoint loaded do) it is the same way.
// SEENWALK_BREAK=1 = the switch left off where the lines want it on: they are asked all the same and must fail on what they find.   exit 0 = all hold · 1 = one does not
// Headless: the light is the CPU stand-in's, the lines the collision's. Never seen on a GPU; nobody has played it.
import { ROOT } from './headless.ts';
const BT: any = await import(`${ROOT}/tools/qa/bang-tally.ts`);
const { doorPt } = await import(`${ROOT}/src/game/doortools.ts`);
const { SEENWALK, SEENWALK_STATS, seenPrice, seenReset } = await import(`${ROOT}/src/game/seenwalk.ts`);
const { squadThrowPlans } = await import(`${ROOT}/src/game/squadthrow.ts`);
const { placeLight } = await import(`${ROOT}/src/game/calmtorch.ts`);
const { eyeReach } = await import(`${ROOT}/src/game/guards.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const PROFILE = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
type Vec3 = [number, number, number];

export async function seenwalkCheck(): Promise<boolean> {
  const BREAK = process.env.SEENWALK_BREAK === '1', RULE = !BREAK;
  console.log(`\n=== seenwalk: an ordered walk keeps off lit floor that an uncleared room can see${BREAK ? ' — SEENWALK_BREAK: the rule never on' : ''} ===`);
  let all = true; const line = (ok: boolean, label: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? `\n    ${detail}` : ''}`); };
  const knobs0 = knobsCopy(), rnd0 = Math.random;
  const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { console.log = () => { }; try { return await fn(); } finally { console.log = log; } };
  const f1 = (x: number) => x.toFixed(1);
  try {
    /** a level with nobody left to shoot (the rooms stay nobody's: a room is known when one of ours has stood in it) */
    const stage = async (scn: string) => { const S: any = await quiet(() => BT.stage(scn, 1)); const g = S.g;
      for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true));
      S.step(5); return S; };
    /** the way an order would walk `gd` to `to`, by its corners · its length · the metres of it on floor the rule prices (read with the rule's own price, over a box that holds every way asked about) */
    const way = (g: any, gd: any, to: Vec3) => { const r = g.orders.route(gd, to), from = gd.char.pos; return { why: r.why as string | null, pts: (r.via.length ? [...r.via, to] : g.col.nav.findPath(from, to) ?? [to]) as Vec3[] }; };
    const len = (from: Vec3, q: Vec3[]) => { let m = 0, a = from; for (const b of q) { m += Math.hypot(b[0] - a[0], b[2] - a[2]); a = b; } return m; };
    const seenM = (g: any, from: Vec3, q: Vec3[]) => { const m0 = SEENWALK.margin; SEENWALK.margin = 200; try { const p = seenPrice(g, from, q); return p ? g.cleared.dearAlong(from, q, p) : 0; } finally { SEENWALK.margin = m0; } };
    const doorsOn = (g: any, from: Vec3, q: Vec3[]) => { const out = new Set<string>(); let a = from; for (const b of q) { for (const d of g.doors.list) { const c = d.frameCentre, t = ((c[0] - a[0]) * (b[0] - a[0]) + (c[2] - a[2]) * (b[2] - a[2])) / Math.max(1e-6, (b[0] - a[0]) ** 2 + (b[2] - a[2]) ** 2), u = Math.max(0, Math.min(1, t));
      if (Math.hypot(a[0] + (b[0] - a[0]) * u - c[0], a[2] + (b[2] - a[2]) * u - c[2]) < 0.45) out.add(d.def.name); } a = b; } return out; };
    const targets = (g: any): { name: string; to: Vec3 }[] => { const nav = g.col.nav, out: { name: string; to: Vec3 }[] = [];
      for (const d of g.doors.list) for (const side of [1, -1] as const) { let p = doorPt(d, d.def.width / 2, 1.4, side); if (nav.isBlocked(p[0], p[2])) { const q = nav.nearestFreePoint(p[0], p[2]); if (!q) continue; p = [q[0], 0, q[2]]; } out.push({ name: `${d.def.name} ${side > 0 ? '+' : '−'}`, to: [p[0], 0, p[2]] }); }
      return out; };

    // (1) the stand, read off the first staging before the check sets anything
    const A: any = await stage('room-clear-four');
    { const shipped = process.env.TPS_PROFILE === 'shipped', env = process.env.TPS_SEENWALK, want = env !== undefined ? env === '1' : shipped, row = FROZEN_HOLDS['SEENWALK.on'];
      line(SEENWALK.on === want && typeof row === 'string' && row.includes('TPS_SEENWALK=1'), `the stand: ${want ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries the row and its word`, `after the stand-up: ${SEENWALK.on} · TPS_SEENWALK ${env ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'} · row ${row ?? 'MISSING'}`); }

    // (2) the office floor: the walk most in view
    const g = A.g, gd = g.orders.squad().filter((x: any) => x.state !== 'dead')[0], from: Vec3 = [gd.char.pos[0], 0, gd.char.pos[2]];
    let pick: any = null;
    for (const T of targets(g)) { SEENWALK.on = false; const off = way(g, gd, T.to); if (off.why) continue; SEENWALK.on = true; const on = way(g, gd, T.to); SEENWALK.on = false;
      const m0 = seenM(g, from, off.pts), m1 = seenM(g, from, on.pts); if (!pick || m0 - m1 > pick.m0 - pick.m1) pick = { ...T, off, on, m0, m1 }; }
    SEENWALK.on = RULE; const ruled = pick ? way(g, gd, pick.to) : null, mR = ruled ? seenM(g, from, ruled.pts) : NaN, l0 = pick ? len(from, pick.off.pts) : NaN, lR = ruled ? len(from, ruled.pts) : NaN;
    const d0 = pick ? doorsOn(g, from, pick.off.pts) : new Set<string>(), dR = ruled ? doorsOn(g, from, ruled.pts) : new Set<string>(), endR = ruled ? ruled.pts[ruled.pts.length - 1] : null;
    line(!!pick && !!ruled && !ruled.why && pick.m0 >= 3 && mR <= pick.m0 - SEENWALK.less && lR <= l0 * SEENWALK.long + 1 + 1e-6 && [...dR].every(n => d0.has(n)) && !!endR && Math.hypot(endR[0] - pick.to[0], endR[2] - pick.to[2]) < 1e-6,
      `the office floor, the walk most in view: off, metres of it cross lit floor a room nobody has been in can see; on, the way to the same point is ${SEENWALK.less} m or more the less in view, at most ${SEENWALK.long} times as long + 1 m, by no door the short way does not take`,
      pick && ruled ? `${gd.callsign} to ${pick.name} (${f1(pick.to[0])}, ${f1(pick.to[2])}) · off ${f1(l0)} m, ${f1(pick.m0)} in view, by ${[...d0].join(', ') || 'no door'} · ${RULE ? 'on' : 'the rule left off'} ${f1(lR)} m, ${f1(mR)} in view, by ${[...dR].join(', ') || 'no door'}` : 'no walk to ask it of');

    // (2b) by hand: the meter and the collision's lines at each half metre of the way, from EVERY floor cell of every room nobody has been in
    { const eyes = g.cleared.unknownEyes(1) as { x: number; z: number }[];
      const hand = (q: Vec3[]) => { let m = 0, a = from; for (const b of q) { const L = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.round(L / 0.5));
          for (let k = 0; k < n; k++) { const u = (k + 0.5) / n, x = a[0] + (b[0] - a[0]) * u, z = a[2] + (b[2] - a[2]) * u, lit = placeLight(g, x, z); if (lit < 0.1 || !g.cleared.knownAt([x, 0, z])) continue;
            const reach = eyeReach(g, lit); if (eyes.some(e => Math.hypot(e.x - x, e.z - z) <= reach && !g.col.segmentBlocked([e.x, 1.6, e.z], [x, 1.5, z]))) m += L / n; } a = b; } return m; };
      const h0 = pick ? hand(pick.off.pts) : NaN, hR = ruled ? hand(ruled.pts) : NaN;
      line(!!pick && !!ruled && h0 >= 3 && hR <= h0 - 1, 'by hand, with none of the rule\'s own price (the meter at each half metre of the way, a line to it from every floor cell of every room nobody has been in): the way it gives is a metre or more the less in view',
        `${eyes.length} cells of uncleared floor · off ${f1(h0)} m lit and in view · ${RULE ? 'on' : 'the rule left off'} ${f1(hR)} m (the rule's own count: ${pick ? f1(pick.m0) : '-'} → ${f1(mR)})`); }

    // (3) he walks it
    const walk = async (rule: boolean, picture = false) => { const S: any = await stage('room-clear-four'); const G = S.g, m = G.orders.squad().filter((x: any) => x.state !== 'dead')[0]; SEENWALK.on = rule;
      let seen = 0, gone = 0, last: Vec3 = [m.char.pos[0], 0, m.char.pos[2]], t = 0; const start: Vec3 = [...last] as Vec3;
      // (the floor in view as he sets off, read once over the whole floor BEFORE a tick is stepped: nothing of this check's is on the table while the game runs)
      const cs = G.col.nav.cell, dearCells = new Set<number>(), m0 = SEENWALK.margin; SEENWALK.margin = 200;
      try { const price = seenPrice(G, start, [pick.to]); if (price) for (let iz = 0; iz < G.col.nav.H; iz++) for (let ix = 0; ix < G.col.nav.W; ix++) if (G.col.nav.blocked[G.col.nav.idx(ix, iz)] !== 1 && price(ix, iz) > 1) dearCells.add(iz * 8192 + ix); } finally { SEENWALK.margin = m0; }
      seenReset(G);
      const why = await quiet(() => G.orders.give('move', { kind: 'floor', at: pick.to }, 'all', { men: [m] }));
      const others = G.orders.squad().filter((x: any) => x !== m && x.state !== 'dead'), trail: number[] = [];
      for (; t < 60 * 60 && Math.hypot(m.char.pos[0] - pick.to[0], m.char.pos[2] - pick.to[2]) > 0.8; t++) { S.step(); trail.push(m.char.pos[0], m.char.pos[2]);
        // (what the page's picture does between ticks and a headless run never does: it asks the router walks of its own — here the same walk for every man, and the throw planner's drawn plans)
        if (picture) await quiet(() => { for (const o of [m, ...others]) G.orders.route(o, pick.to); squadThrowPlans(G); });
        if (t % 6 === 0) { const p: Vec3 = [m.char.pos[0], 0, m.char.pos[2]], dd = Math.hypot(p[0] - last[0], p[2] - last[2]);
          if (dearCells.has(Math.floor(p[2] / cs) * 8192 + Math.floor(p[0] / cs))) seen += dd; gone += dd; last = p; } }
      return { why, seen, gone, trail, there: Math.hypot(m.char.pos[0] - pick.to[0], m.char.pos[2] - pick.to[2]) <= 0.8, secs: t / 60 }; };
    if (pick) { const off = await walk(false), on = await walk(RULE);
      line(!off.why && !on.why && off.there && on.there && on.seen <= off.seen - 1, 'a man given that move walks it: fewer metres of his walk are on lit floor in view with the rule on than off (a metre or more), and he gets there both times',
        `off: walked ${f1(off.gone)} m in ${f1(off.secs)} s, ${f1(off.seen)} m of it in view, ${off.there ? 'there' : 'NOT there'}${off.why ? ` · refused: ${off.why}` : ''} · ${RULE ? 'on' : 'the rule left off'}: walked ${f1(on.gone)} m in ${f1(on.secs)} s, ${f1(on.seen)} m in view, ${on.there ? 'there' : 'NOT there'}${on.why ? ` · refused: ${on.why}` : ''}`); }
    else line(false, 'a man given that move walks it', 'no walk to ask it of');

    // (3b) what is drawn never decides what the game reads
    if (pick) { const plain = await walk(RULE), drawn = await walk(RULE, true), asks0 = SEENWALK_STATS.asks; let diff = -1;
      for (let i = 0; i < Math.max(plain.trail.length, drawn.trail.length) && diff < 0; i++) if (plain.trail[i] !== drawn.trail[i]) diff = i >> 1;
      line(RULE && plain.there && drawn.there && diff < 0 && plain.trail.length === drawn.trail.length && asks0 > 0, 'the picture asks walks of its own between the ticks (the same walk of every man, the throw planner\'s drawn plans): the man\'s walk is the same to the bit, tick for tick',
        `${plain.trail.length / 2} ticks plain · ${drawn.trail.length / 2} with the picture asking · ${diff < 0 ? 'no tick differs' : `FIRST DIFFERENCE at tick ${diff}`}${RULE ? '' : ' · the rule left off: nothing to ask'}`); }
    else line(false, 'the picture\'s asks do not move the walk', 'no walk to ask it of');

    // (4) the regular systems: nothing lit, nobody left unlooked-at
    { const B: any = await stage('room-clear-four'), G = B.g, m = G.orders.squad().filter((x: any) => x.state !== 'dead')[0], f: Vec3 = [m.char.pos[0], 0, m.char.pos[2]];
      const same = (a: Vec3[], b: Vec3[]) => a.length === b.length && a.every((p, i) => Math.hypot(p[0] - b[i][0], p[2] - b[i][2]) < 1e-6);
      SEENWALK.on = false; const off = pick ? way(G, m, pick.to) : null; SEENWALK.on = RULE; const on = pick ? way(G, m, pick.to) : null;
      const lit0 = SEENWALK.litAt; SEENWALK.litAt = 2; G.time += 1; const dark = pick ? way(G, m, pick.to) : null; SEENWALK.litAt = lit0;
      for (const e of G.cleared.unknownEyes(1)) G.cleared.mark([e.x, 0, e.z]); G.time += 1; const known = pick ? way(G, m, pick.to) : null, eyes = G.cleared.unknownEyes(1).length;
      line(!!off && !!on && !!dark && !!known && !same(off.pts, on.pts) && same(off.pts, dark.pts) && same(off.pts, known.pts) && eyes === 0,
        'the regular systems: with nothing called lit (the bar over the meter\'s top) the way is the way as it was, and with every room one of ours has stood in too — while lit and unknown, it is another way',
        off && on && dark && known ? `off ${f1(len(f, off.pts))} m · on ${f1(len(f, on.pts))} m (${same(off.pts, on.pts) ? 'THE SAME WAY' : 'another way'}) · nothing lit ${same(off.pts, dark.pts) ? 'the way as it was' : 'ANOTHER WAY'} · every room known (${eyes} eyes left) ${same(off.pts, known.pts) ? 'the way as it was' : 'ANOTHER WAY'}` : 'no walk to ask it of'); }

    // (5) the glasshouse: in view all the way, no way round by the same doors
    { const H: any = await stage('glasshouse-four'), G = H.g, m = G.orders.squad().filter((x: any) => x.state !== 'dead')[0], f: Vec3 = [m.char.pos[0], 0, m.char.pos[2]];
      const front = G.doors.list.find((d: any) => d.def.name === 'front'), T = front ? targets(G).filter(t => t.name.startsWith('front ')) : [];
      const asked0 = SEENWALK_STATS.inView; const rows = T.map(t => { SEENWALK.on = false; const off = way(G, m, t.to); SEENWALK.on = RULE; const on = way(G, m, t.to); SEENWALK.on = false; return { t, off, on, m0: seenM(G, f, off.pts), same: off.pts.length === on.pts.length && off.pts.every((p, i) => Math.hypot(p[0] - on.pts[i][0], p[2] - on.pts[i][2]) < 1e-6) }; });
      const asked = SEENWALK_STATS.inView - asked0;
      line(rows.length === 2 && rows.every(r => !r.off.why && !r.on.why && r.same) && rows.some(r => r.m0 >= 5) && asked > 0,
        'the glasshouse, the walk to the front door across the floodlit forecourt: metres of it in view of the glazed rooms and no way round by the same doors — the way as it was, the mark where it was, the order not refused (and the rule WAS asked of it)',
        `the rule asked of ${asked} walk${asked === 1 ? '' : 's'} with metres in view · ` + rows.map(r => `${r.t.name}: ${f1(len(f, r.off.pts))} m, ${f1(r.m0)} in view · on: ${r.on.why ? `REFUSED ${r.on.why}` : r.same ? 'the same way' : 'ANOTHER WAY'}`).join(' · ') || 'no front door on that level'); }

    // (6) recordings from before the table; the page's own boot
    { const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      SEENWALK.on = true; const old = snap(); delete old.tables.SEENWALK; JOURNAL.applyKnobs(g, old); const without = SEENWALK.on;
      SEENWALK.on = true; const own = snap(); SEENWALK.on = false; JOURNAL.applyKnobs(g, own); const withIt = SEENWALK.on;
      PROFILE.pageSwitches(new URLSearchParams('')); const a = SEENWALK.on; PROFILE.pageSwitches(new URLSearchParams('seenwalk=0')); const b = SEENWALK.on; PROFILE.pageSwitches(new URLSearchParams('standfire=0')); const c = SEENWALK.on;
      line(without === false && withIt === true && a === true && b === false && c === true, 'a recording from before the table replays with the rule off, one that carries it on plays with it on; the page\'s boot: no flag → on · ?seenwalk=0 → off · another flag leaves it on',
        `applyKnobs with no table → ${without} · with it on → ${withIt} · '' → ${a} · 'seenwalk=0' → ${b} · 'standfire=0' → ${c}`); }

    // (7) what is read is kept, and thrown away with a door moved or a reset
    if (pick) { const B: any = await stage('room-clear-four'), G = B.g, m = G.orders.squad().filter((x: any) => x.state !== 'dead')[0];
      const same = (a: Vec3[], b: Vec3[]) => a.length === b.length && a.every((p, i) => Math.hypot(p[0] - b[i][0], p[2] - b[i][2]) < 1e-6), T = SEENWALK_STATS;
      SEENWALK.on = RULE; seenReset(G); const l0 = T.lines, cold = way(G, m, pick.to), l1 = T.lines, again = way(G, m, pick.to), l2 = T.lines;
      const d = G.doors.list[0], a0 = d.angle; d.angle = a0 + 0.2; const moved = way(G, m, pick.to), l3 = T.lines; d.angle = a0;
      seenReset(G); const fresh = way(G, m, pick.to), l4 = T.lines; G.time += 1 / 60; const later = way(G, m, pick.to), l5 = T.lines; SEENWALK.on = false; const off = way(G, m, pick.to);
      line(l1 > l0 && l2 === l1 && same(cold.pts, again.pts) && l3 > l2 && l4 > l3 && same(cold.pts, fresh.pts) && l5 > l4 && same(cold.pts, later.pts) && !same(cold.pts, off.pts),
        'what is read is kept for the tick and no longer: the same walk asked again in the same tick casts no line and is the same way; a door moved, or the clock moved, it is read again; read cold again (a restart, a checkpoint loaded) it is the same way',
        `lines cast: cold ${l1 - l0} · again ${l2 - l1} (${same(cold.pts, again.pts) ? 'the same way' : 'ANOTHER WAY'}) · a door moved ${l3 - l2} · after a reset ${l4 - l3} (${same(cold.pts, fresh.pts) ? 'the same way' : 'ANOTHER WAY'}) · a tick later ${l5 - l4} (${same(cold.pts, later.pts) ? 'the same way' : 'ANOTHER WAY'}) · ${same(cold.pts, off.pts) ? 'AND THAT IS THE WAY WITH THE RULE OFF' : 'not the way with the rule off'}`); }
    else line(false, 'what is read is kept', 'no walk to ask it of');
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; }   // (pageSwitches and applyKnobs wrote every table: each back as this check found it)
  console.log(`=== seenwalk: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await seenwalkCheck()) ? 0 : 1);
