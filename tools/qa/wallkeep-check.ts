// THE WALKS A WALL'S ROW KEEPS, and THE FAR SIDE OF THE TRIGGER'S WARNING — the check behind two mends in src/game/wallcharge.ts (both under WALLCHARGE.safe).
//   bun run tools/qa/wallkeep-check.ts [--scn room-clear-four,block-squads] [--verbose]        (also `probes.ts wallkeep`, and in the `wallcharge` family)
// (1) THE KEPT WALKS, A PAIRED RUN. With the orders menu up on a wall the row's answer is a whole plan, asked again every ORDERS.refreshSecs; most of its cost
//     is walks priced man by man, mark by mark. The module now keeps those walks for as long as that menu is up and nothing a walk is judged by has changed
//     (WallCharge.keptWalks); every line and distance is still asked afresh. The claim is that this only saves the work. Two games from one seed, the same
//     presses frame for frame — one keeping, one with the keep held off (WallCharge.keep.on, the checks' own handle: `valid()` then plans as it always did) —
//     while the menu is held up through things that move the answer (a man of theirs moved, a door leaf swung, a door locked, a room become known, Sam moved):
//       · every frame the menu's rows and their why-nots are the same in both, and the game's digest is the same in both;
//       · the order then given off that menu deals the same marks to the same men in both (no mark is ever kept: an order given is planned afresh);
//       · a checkpoint: with a squad on the floor the game takes none (savestate.ts canSave: 'a spawned unit is on the floor') and a wall order needs a squad,
//         so there is no file a kept walk could ride in — the check asks for one with the menu up and shows the refusal, the same in both; and the thing a
//         load starts with, a restart, drops what was kept and the menu with it;
//       · the keeping twin really kept ACROSS re-reads: over the quiet two seconds before the first of those things (the men stood still first) it asked the orders for no walk at all,
//         where the other asked for every one again at each re-read; and it asked for fewer over the whole hold. The other never kept one.
//       · an order given BY CODE while a menu is up (the console, a probe) reads nothing kept either: it hands over a target of its own.
// (2) THE FAR SIDE. The trigger's words named who was inside the radius on the charge's own side only. Staged on a partition with a charge on it: a teammate
//     who has walked round to stand beyond the wall where it will open is named ('behind the wall: …'), and the blast then does catch him; one beyond the wall
//     but past the stun's reach is not named and not caught; Sam there is named and blinded where the player's stun rule is on, neither where it is off; the
//     switch off says nothing.
// exit 0 = all hold · 1 = one does not
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type Vec3 = [number, number, number];

export async function wallkeepCheck(scns = ['room-clear-four', 'block-squads']): Promise<boolean> {
  const { rig, outerSites, partition } = (await import('./outerwall-probes.ts')) as any;
  const { WALLCHARGE, WALL_ORDER, chargeIndoors, wallPt, wallOff, wallTarget } = await import(`${ROOT}/src/game/wallcharge.ts`);
  const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
  const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const VERBOSE = process.argv.includes('--verbose'); let all = true;
  const line = (ok: boolean, s: string, detail = '') => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${s}${detail ? `\n    ${detail}` : ''}`); };
  const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]), f2 = (x: number) => x.toFixed(2), at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
  const fnv = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193); return (h >>> 0).toString(16); };
  const was = { rnd: Math.random, sw: DESTRUCTION.on, wc: JSON.parse(JSON.stringify(WALLCHARGE)), stun: SAMSTUN.on };
  const thickOf = (W: any) => 2 * (W.alongX ? W.box.h[2] : W.box.h[0]);
  /** the wall's own target at `p`, as a cursor ON the wall gives it. `targetAt` is the rule for what is NEAR a landing point, and a follower whose place in the
   *  file falls within its reach of the point (the page's stand: room-clear-four's partition) makes it that man's menu, which has no wall row */
  const wallTgt = (O: any, g: any, p: Vec3) => { const t = O.targetAt(p); if (!(t.kind === 'none' && t.man)) return t; const at: Vec3 = [p[0], 0, p[2]], spot = O.freeSpot(at); return wallTarget(g, at, spot ? { kind: 'floor', at: spot } : { kind: 'none', at }); };
  console.log('\n=== wallkeep: the walks a wall\'s row keeps while the menu is up · the far side of the trigger\'s warning ===');
  try {
    // ------------------------------------------------------------------ (1) the kept answer, paired
    const SECS = 9, HOLD2 = 3;
    const play = async (scn: string, seed: number, keep: boolean) => {
      const R = await rig(scn, seed), g = R.game, C = R.C, O = R.O; WALLCHARGE.safe = true; R.kit(); C.keep.on = keep;
      let plans = 0, asked = 0, ms = 0, worst = 0, walks = 0;
      { const plan = C.plan.bind(C); C.plan = (...a: any[]) => { plans++; return plan(...a); }; const reach = O.reach.bind(O); O.reach = (...a: any[]) => { walks++; return reach(...a); };
        const valid = C.valid.bind(C); C.valid = (...a: any[]) => { asked++; const t0 = performance.now(); try { return valid(...a); } finally { const d = performance.now() - t0; ms += d; if (asked > 2) worst = Math.max(worst, d); } }; }
      const P0 = partition(R), sites = [...(P0 ? [P0] : []), ...outerSites(R, 'inside', 6)].filter((s: any) => chargeIndoors(g, s.W) && !!C.safePosts(s.W, 4, wallPt(s.W, 0, WALLCHARGE.setOff)));
      const P = sites[0]; if (!P) return null;
      R.gather(P.near); for (const h of R.hostiles) if (h.state !== 'dead' && flat(h.char.pos, wallPt(P.W, 0, 0)) < DOORTOOLS.stunM + 1) R.put(h, [h.char.pos[0] + 400, 0, h.char.pos[2]]); R.step(2);
      // (the men stand still before the menu goes up: gathered, a follower still shuffles the last decimetres onto his place in the file, and one who crosses
      //  into the next nav cell during the 'quiet' re-reads is a walk rightly asked again — the keep's key is his cell. Still = nobody a millimetre off for twenty frames)
      { let was = R.up.map((m: any) => [...m.char.pos]), calm = 0; for (let i = 0; i < 360 && calm < 20; i++) { R.step(); const now = R.up.map((m: any) => [...m.char.pos]); calm = now.every((q: number[], k: number) => flat(q, was[k]) < 1e-3) ? calm + 1 : 0; was = now; } }
      /** the menu up on the wall, on the page that holds the charge's row — its digit, or 0 */
      const menuUp = (): number => { O.open(wallTgt(O, g, P.p)); R.step(2);
        let row = O.menu?.rows.find((r: any) => r.id === WALL_ORDER); if (!row) { const opener = O.menu?.rows.find((r: any) => r.opens && r.key !== undefined); if (opener) { R.press(`Digit${opener.key}`); R.step(4); row = O.menu?.rows.find((r: any) => r.id === WALL_ORDER); } }
        return row && O.menu ? row.key ?? 0 : 0; };
      const sig = () => { const M = O.menu; return M ? JSON.stringify([M.page, M.rows.map((r: any) => r.id), M.why]) : 'no menu'; };
      const give = (digit: number) => { R.press(`Digit${digit}`); R.step(4); const op = C.ops[0]; return op ? { lead: op.lead.callsign, spot: op.spot, marks: [...op.post].map(([m, q]: [any, Vec3]) => [m.callsign, q]), close: !!op.close } : null; };
      const digit = menuUp(); if (!digit) return { P, noMenu: true } as any;
      const series: string[] = [], digests: string[] = [], events: string[] = []; let stayed = true, quiet = 0;
      const cs = g.col.nav.cell, cells = () => [g.player, ...R.up].map((m: any) => `${Math.floor(m.char.pos[0] / cs)},${Math.floor(m.char.pos[2] / cs)}`); let cellWas: string[] = [], crossed = 0;
      const mate = R.up.find((m: any) => m !== R.up[0]) ?? R.up[0], near = [...g.doors.list].sort((a: any, b: any) => flat(a.frameCentre, P.p) - flat(b.frameCentre, P.p)), door = near[0], lock = near.find((d: any) => d !== door && !d.locked && d.latched);
      for (let f = 0; f < SECS * 60; f++) {
        if (f === 150) { const p = mate.char.pos, q = [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]].map(([dx, dz]) => [p[0] + dx, 0, p[2] + dz]).find(q => R.free(q)); if (q) { R.put(mate, q); events.push(`${f2(f / 60)} s ${mate.callsign} moved 2.5 m`); } }
        if (f === 20) quiet = walks; if (f === 149) quiet = walks - quiet;   // (two re-reads with nothing moving: what the orders were asked for in them)
        // (… unless the level will not let the men stand: two followers dealt places a hand apart shove each other for ever — block-squads, beside the mess door,
        //  since that door's swing was authored. A man who crosses into the next nav cell is a walk rightly asked again, so the crossings are counted and allowed for)
        if (f >= 20 && f < 149) { const now = cells(); if (f > 20) for (let k = 0; k < now.length; k++) if (now[k] !== cellWas[k]) crossed++; cellWas = now; }
        if (f === 270 && door) { door.angle = 1.0; door.latched = false; events.push(`${f2(f / 60)} s ${door.def.name} swung open`); }
        if (f === 330 && lock) { lock.locked = true; events.push(`${f2(f / 60)} s ${lock.def.name} locked`); }
        if (f === 390) { const nav = g.col.nav; let q: Vec3 | null = null; for (let x = 1; x < nav.W && !q; x += 2) for (let z = 1; z < nav.H && !q; z += 2) { const p: Vec3 = [(x + 0.5) * nav.cell, 0, (z + 0.5) * nav.cell]; if (!nav.isBlocked(p[0], p[2]) && g.cleared.roomAt(p) && !g.cleared.knownAt(p)) q = p; }
          if (q) { g.cleared.mark(q); events.push(`${f2(f / 60)} s a room became known`); } }
        if (f === 450) { const p = g.player.char.pos, q = [[0.8, 0], [-0.8, 0], [0, 0.8], [0, -0.8]].map(([dx, dz]) => [p[0] + dx, 0, p[2] + dz] as Vec3).find(q => R.free(q) && wallOff(P.W, q) > 0.4); if (q) { g.teleportPlayer(q); events.push(`${f2(f / 60)} s Sam put 0.8 m aside`); } }
        R.step(); series.push(sig()); if (!O.menu) stayed = false; if (f % 30 === 29) digests.push(fnv(JSON.stringify(digestGame(g, true))));
      }
      const kept = { asks: C.keep.asks, hits: C.keep.hits };
      // (an order given by code with the menu still up: its own target, so nothing kept is read — asked through the orders' own why-not, nothing given)
      const code = (() => { const a0 = C.keep.asks, w0 = walks, why = O.whyNot(C.row, wallTgt(O, g, P.p)); return { asks: C.keep.asks - a0, walks: walks - w0, why, up: !!O.menu }; })();
      let snap: any = null, snapWhy = ''; try { snap = R.W.snapshot('wallkeep', true); } catch (e: any) { snapWhy = String(e?.message ?? e); }
      const walks0 = walks, first = give(digit);
      let second: ReturnType<typeof give> = null, loaded = false, hits2 = 0;
      if (snap) { R.W.restore(snap); loaded = true; WALLCHARGE.safe = true; R.kit(); C.keep.on = keep; R.step(2); const d2 = menuUp(); if (d2) { for (let f = 0; f < HOLD2 * 60; f++) { R.step(); series.push(sig()); } hits2 = C.keep.hits; second = give(d2); } }
      // (what a load starts with: a restart — the kept walks and the menu go with the run)
      let dropped: boolean | null = null;
      if (!snap && keep) { const R2 = await rig(scn, seed), g2 = R2.game, C2 = R2.C, O2 = R2.O; WALLCHARGE.safe = true; R2.kit(); R2.gather(P.near); R2.step(2); O2.open(wallTgt(O2, g2, P.p)); R2.step(2);
        if (!O2.menu?.rows.find((r: any) => r.id === WALL_ORDER)) { const opener = O2.menu?.rows.find((r: any) => r.opens && r.key !== undefined); if (opener) { R2.press(`Digit${opener.key}`); R2.step(4); } }
        R2.step(130); const had = !!(C2 as any).walks && (C2 as any).walks.map.size > 0 && !!O2.menu && C2.keep.hits > 0; g2.restartEncounter(); R2.step(2); dropped = had && (C2 as any).walks === null && !O2.menu && C2.keep.hits === 0; }
      return { P, series, digests, events, stayed, kept, quiet, crossed, code, plans, asked, ms, worst, walks: walks0, first, second, snapWhy, loaded, dropped, hits2 };
    };
    for (const scn of scns) {
      console.log(`  — ${scn}`);
      const A = await play(scn, 5, true), B = await play(scn, 5, false);
      if (!A || !B || A.noMenu || B.noMenu) { line(false, `${scn}: a wall indoors with room to stand off, and its menu up on the charge's row`, !A || !B ? 'no such wall' : 'the menu has no wall charge row there'); continue; }
      const W = A.P.W, c0 = wallPt(W, 0, 0);
      let diff = -1; for (let i = 0; i < Math.max(A.series.length, B.series.length) && diff < 0; i++) if (A.series[i] !== B.series[i]) diff = i;
      const dg = A.digests.findIndex((d: string, i: number) => d !== B.digests[i]);
      line(A.stayed && B.stayed && diff < 0 && dg < 0 && A.digests.length === B.digests.length,
        'the menu held up on the wall: every frame its rows and their why-nots are the same kept and not kept, and so is the game',
        `wall ${W.index} at ${at(c0)} · ${A.series.length} frames, ${A.digests.length} digests · ${A.events.join(' · ') || 'no events'}${diff >= 0 ? ` · ROWS DIFFER at frame ${diff}: kept ${A.series[diff]} · not ${B.series[diff]}` : ''}${dg >= 0 ? ` · DIGESTS DIFFER at ${f2((dg + 1) / 2)} s` : ''}${A.stayed ? '' : ' · the menu did not stay up'}`);
      line(A.kept.hits > 0 && B.kept.hits === 0 && B.kept.asks === 0 && A.plans === B.plans && A.walks < B.walks && (A.crossed === 0 ? A.quiet === 0 : A.quiet <= 4 * A.crossed && A.quiet < B.quiet) && B.quiet > 0,
        'the keeping game kept its walks across re-reads — with nothing moving it asked the orders for none — and asked for fewer over the whole hold; the other kept none and asked for every walk at every re-read, as it always did',
        `two quiet re-reads: kept ${A.quiet} walks asked of the orders, not kept ${B.quiet}${A.crossed ? ` (${A.crossed} time(s) a man crossed into the next nav cell in them: those walks are rightly asked again, at most 4 a crossing)` : ''} · ${A.plans} plans each · kept: ${A.kept.asks} walks wanted, ${A.kept.hits} given again, ${A.walks} asked of the orders, ${f2(A.ms)} ms in the row's test (worst re-read ${f2(A.worst)} ms) · not kept: ${B.walks} asked of the orders, ${f2(B.ms)} ms (worst ${f2(B.worst)} ms)`);
      line(A.code.up && A.code.asks === 0 && A.code.walks > 0 && A.code.why === B.code.why, 'an order asked by code while the menu is up reads nothing kept: it is planned afresh, and answered the same in both', `kept twin: ${A.code.asks} kept walks wanted, ${A.code.walks} asked of the orders, answer ${JSON.stringify(A.code.why)} · not kept: ${JSON.stringify(B.code.why)}`);
      const m1 = JSON.stringify(A.first), m1b = JSON.stringify(B.first), words = (o: any) => o ? `${o.lead} sets it · ${o.marks.map(([n, q]: [string, Vec3]) => `${n} ${at(q)}`).join(' ')}${o.close ? ' · close' : ''}` : 'refused';
      line(!!A.first && m1 === m1b, 'the order given off that menu deals the same marks to the same men, kept and not kept', `kept: ${words(A.first)}${m1 === m1b ? '' : ` · NOT KEPT: ${words(B.first)}`}`);
      if (!A.loaded || !B.loaded) line(A.snapWhy === B.snapWhy && !!A.snapWhy && A.dropped === true, 'a checkpoint with the menu up is refused the same way in both (a squad on the floor: no file a kept walk could ride in), and a restart — what a load starts with — drops what was kept and the menu with it', `kept: '${A.snapWhy}' · not kept: '${B.snapWhy}' · a menu up with walks kept, then a restart: ${A.dropped ? 'nothing kept, no menu' : 'NOT DROPPED (or nothing was kept to drop)'}`);
      else { const m2 = JSON.stringify(A.second), m2b = JSON.stringify(B.second);
        line(!!A.second && m2 === m2b && A.hits2 > 0, 'a checkpoint taken with the menu up, loaded, the menu up again and the order given: the same marks kept and not kept', `after the load, kept: ${words(A.second)}${m2 === m2b ? '' : ` · NOT KEPT: ${words(B.second)}`} · ${A.hits2} walks given again since the load`);
        line(m2 === m1 && m2b === m1b, 'the load itself deals the marks the run dealt', m2 === m1 ? `both: ${words(A.second)}` : `before: ${words(A.first)} · after: ${words(A.second)}${m2b === m1b ? ' (the game not keeping: the same before and after)' : ' (the game not keeping differs the same way: the load\'s own, not the keep\'s)'}`); }
      if (VERBOSE) console.log(`    series tail: ${A.series[A.series.length - 1]}`);
    }

    // ------------------------------------------------------------------ (2) the far side of the warning
    for (const scn of scns) {
      const R = await rig(scn, 5), g = R.game, C = R.C, pl = g.player, col = g.col; WALLCHARGE.safe = true; R.kit();
      const P0 = partition(R), sites = [...(P0 ? [P0] : []), ...outerSites(R, 'inside', 6)];
      const far = (gd: any, i: number) => R.put(gd, [gd.char.pos[0] + 400 + i, 0, gd.char.pos[2]]);
      let staged = false;
      for (const P of sites) { const W = P.W, T = thickOf(W), c0 = wallPt(W, 0, 0), inn = wallPt(W, 0, -(T + 0.45), 1.1), K = DOORTOOLS;
        const lined = (q: number[]) => !col.solidBlocked(inn, [q[0], 1.1, q[2]]);
        const beyond = (lo: number, hi: number, not: number[][] = []): Vec3 | null => { for (const du of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) for (let off = 0.8; off <= 3.2; off += 0.4) { const q = wallPt(W, du, -(T + off)) as Vec3, d = flat(q, c0); if (d >= lo && d <= hi && R.free(q) && lined(q) && !not.some(n => flat(n, q) < 0.8)) return q; } return null; };
        const past = (): Vec3 | null => { for (const du of [0, 2, -2, 4, -4, 6, -6]) for (let off = 1.0; off <= 9; off += 0.5) { const q = wallPt(W, du, -(T + off)) as Vec3; if (flat(q, c0) > K.stunM + 0.4 && R.free(q)) return q; } return null; };
        const own = [6.5, -6.5, 7.5, -7.5, 8.5, -8.5].map(d => wallPt(W, d, 0.9) as Vec3).find(q => R.free(q) && C.blastShare(W, q) === 0);
        const pA = beyond(1.0, K.stunM - 0.6), pS = pA && beyond(1.0, K.stunM - 0.6, [pA]), pB = past();
        if (!pA || !pS || !pB || !own) continue; staged = true;
        const [A, B] = R.up; g.guards.forEach((gd: any, i: number) => { if (gd.state !== 'dead' && gd !== A && gd !== B) far(gd, i); });
        const note = () => (C as any).hudNotes().map((n: any) => n.text).join(' / ');
        const set = () => { const c = { wall: W, t: g.time, by: 'check', paid: 0 }; C.set.push(c); return c; };
        // a teammate beyond the wall inside the stun's reach, one beyond it past the reach; Sam clear on the charge's own side
        R.put(A, pA); R.put(B, pB); for (const gd of [A, B]) gd.dazzledUntil = -1; g.teleportPlayer(own); pl.dazzledUntil = -1;
        let c = set(); const near1: string[] = C.tooClose(c), far1: string[] = C.behind(c), n1 = note(), row1 = (C as any).row.label(wallTgt(g.orders, g, P.p));
        const r1 = C.blow(c), caughtA = A.state === 'dead' || A.dazzledUntil > g.time, caughtB = B.state === 'dead' || B.dazzledUntil > g.time;
        line(!!r1?.hole && far1.includes(A.callsign) && !far1.includes(B.callsign) && !far1.includes('you') && !near1.length && new RegExp(`BEHIND THE WALL: ${A.callsign}$`).test(n1) && !/TOO CLOSE/.test(n1) && caughtA && !caughtB,
          'a teammate who walked round to stand beyond the wall where it will open is named before it goes, and is caught when it does; one beyond it past the stun\'s reach is neither',
          `${scn}, wall ${W.index} at ${at(c0)} (stun reach ${K.stunM} m) · ${A.callsign} ${f2(flat(pA, c0))} m beyond: ${caughtA ? 'caught' : 'CLEAR'} · ${B.callsign} ${f2(flat(pB, c0))} m beyond: ${caughtB ? 'CAUGHT' : 'clear'} · note: '${n1}' · row: '${row1}' · hole ${!!r1?.hole}`);
        // (the wall is open there now: the rest is asked of the words alone, on a fresh charge record — and of the blast through the hole it already has)
        for (const on of [true, false]) { SAMSTUN.on = on; for (const gd of [A, B]) { far(gd, 0); gd.dazzledUntil = -1; } g.teleportPlayer(pS); pl.dazzledUntil = -1; R.step(1);
          c = set(); const farS: string[] = C.behind(c), nS = note(); C.blow(c); const blind = pl.dazzledUntil > g.time;
          line(on ? farS.includes('you') && /BEHIND THE WALL: you/.test(nS) && blind : !farS.includes('you') && !/BEHIND/.test(nS) && !blind,
            on ? 'Sam beyond the wall, the player\'s stun rule on: he is named, and blinded when it goes' : 'Sam beyond the wall, the player\'s stun rule off: nothing reaches him through it, and nothing is said',
            `Sam ${f2(flat(pS, c0))} m beyond · named ${farS.join(', ') || 'nobody'} · blind ${f2(Math.max(0, pl.dazzledUntil - g.time))} s · note: '${nS}'`); pl.dazzledUntil = -1; }
        SAMSTUN.on = true; WALLCHARGE.safe = false; R.put(A, pA); g.teleportPlayer(pS); c = set(); const off: string[] = C.behind(c), nOff = note(); C.set.splice(C.set.indexOf(c), 1); WALLCHARGE.safe = true;
        line(!off.length && !/BEHIND|CLOSE/.test(nOff), 'the switch off: nobody is named, the note as it was', `named ${off.join(', ') || 'nobody'} · note: '${nOff}'`);
        break; }
      if (!staged) console.log(`    (${scn}: no wall with free floor beyond it inside and past the stun's reach — the far side is staged on the other level)`);
      if (staged) break;
      if (scn === scns[scns.length - 1]) line(false, 'a wall to stage the far side on', 'none found on any level asked');
    }
  } finally { Object.assign(WALLCHARGE, was.wc); DESTRUCTION.on = was.sw; SAMSTUN.on = was.stun; Math.random = was.rnd; }
  console.log(`=== wallkeep: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) { const i = process.argv.indexOf('--scn'); process.exit((await wallkeepCheck(i >= 0 ? process.argv[i + 1].split(',') : undefined)) ? 0 : 1); }
