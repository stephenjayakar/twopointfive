// A BANG IS ITS OWN SIDE'S CAN TO EVERY TEAMMATE (doortools.ts DOORTOOLS.ownCan; throwables.ts Item.side; combat.ts detonateStun).
//   bun run tools/qa/own-can-check.ts [--scn barracks-four] [--seed 1]        exit 0 = every line PASS, 1 = a FAIL line
// Headless, on the door rules' stand. The door tools take an entry's own men — the thrower among them — off the guard list for the bang, so detonateStun,
// looking the thrower up on that list, used to take the can for a guard's: a teammate still on the list got a defender's count and fold from his own side's can.
//   rule    detonateStun asked directly, the thrower off the list as bang() leaves him: a teammate 4 m off with a line, one 1.5 m off, a defender 4 m off —
//           with the can unsigned (the fault) and signed 'operative' (the mend). The defender's count must not move
//           (and the wrong answer's other half: a man of team 'guard' — a quiet mission's staff — was taken for the can's own side and spared)
//   bang    the real order: one pair bangs and clears a door, the other pair stood more than 5 m back on the same face with a line through the doorway to
//           where the can bursts — blinded and folded with ownCan OFF (the fault, which must be there to be mended), untouched with it ON
//   OWNCAN_BREAK=1 = the switch held off through the 'on' halves: the check must FAIL
export {};   // (a module: the top-level awaits below need it for the tools/qa typecheck)
for (const k of ['QA_DOORMANNERS', 'QA_DOORSTAY', 'QA_DOORBLAST', 'QA_FRAMEHOLDS', 'ONEWAY']) process.env[k] ??= '1';
const { ROOT } = await import('./headless.ts');
const BT: any = await import('./bang-tally.ts');
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { killGuard, detonateStun, FLASH } = await import(`${ROOT}/src/game/combat.ts`);

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SCN = arg('--scn', 'barracks-four'), SEED = +arg('--seed', '1'), BREAK = process.env.OWNCAN_BREAK === '1';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const put = (gd: any, p: number[]) => { gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.speed = 0; };
const frame = (d: any, side: 1 | -1) => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre;
  return { at: (b: number, l: number): number[] => [c[0] + n[0] * b + u[0] * l, 0, c[2] + n[1] * b + u[1] * l], off: (p: number[]) => (p[0] - c[0]) * n[0] + (p[2] - c[2]) * n[1] }; };
const s1 = (x: number) => x.toFixed(1);

log(`=== own-can-check: ${SCN}, seed ${SEED} ===`);
// ---------------------------------------------------------------- rule
{ const res: string[] = []; let ok = true, staged = false;
  for (const signed of [false, true]) { const S: any = await quiet(() => BT.stage(SCN, SEED)), g = S.g, nav = g.col.nav;
    const ops: any[] = g.orders.squad().filter((x: any) => x.state !== 'dead'), foes: any[] = g.guards.filter((x: any) => x.state !== 'dead' && x.team === 'hostile'), foe = foes[0], staff = foes[1];
    if (ops.length < 3 || !foe || !staff) break;
    // open floor: a centre with three places round it, each with a line to the burst
    let at: number[] | null = null, spots: number[][] = [];
    for (const c of [g.player.char.pos, ...ops.map(x => x.char.pos)]) { if (at) break;
      for (let ox = -6; ox <= 6 && !at; ox += 1.5) for (let oz = -6; oz <= 6 && !at; oz += 1.5) { const o = [c[0] + ox, 0, c[2] + oz]; if (nav.isBlocked(o[0], o[2])) continue;
        const ring = (r: number) => { const out: number[][] = []; for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, p = [o[0] + Math.sin(a) * r, 0, o[2] + Math.cos(a) * r];
          if (!nav.isBlocked(p[0], p[2]) && !g.col.segmentBlocked([o[0], 0.55, o[2]], [p[0], 1.6, p[2]])) out.push(p); } return out; };
        const far = ring(4), near = ring(1.5); const a = far[0], b = far.find(p => flat(p, a) > 2.5), c2 = far.find(p => flat(p, a) > 2.5 && !!b && flat(p, b) > 2.5);
        if (a && b && c2 && near.length) { at = o; spots = [a, b, near[0], c2]; } } }
    if (!at) break; staged = true;
    const [thrower, mate, close] = ops; const away = (i: number) => [at![0] + 40 + i * 2, 0, at![2] + 40];
    for (const x of g.guards) if (x !== mate && x !== close && x !== foe && x !== staff) put(x, away(g.guards.indexOf(x)));
    await quiet(() => g.teleportPlayer(away(30) as any));
    const pin = () => { put(mate, spots[0]); put(foe, spots[1]); put(close, spots[2]); put(staff, spots[3]); }; pin(); await quiet(() => { for (let i = 0; i < 3; i++) { S.step(1); pin(); } });
    for (const x of [mate, foe, close, staff]) { x.dazzledUntil = 0; x.staggerUntil = 0; } staff.team = 'guard';   // (a staff man: what a quiet mission's partner is up against)
    const it = g.items.spawn('stun', [at[0], 0.25, at[2]], [0, 0, 0], { fuse: 99, heading: 0 }); it.who = thrower.char.id; it.fired = true; if (signed && !BREAK) it.side = 'operative';
    const list = g.guards; g.guards = list.filter((x: any) => x !== thrower); try { await quiet(() => detonateStun(g, it)); } finally { g.guards = list; }
    const secs = (x: any) => Math.max(0, x.dazzledUntil - g.time), fold = (x: any) => Math.max(0, x.staggerUntil - g.time);
    res.push(`${signed ? "signed 'operative'" : 'unsigned'}: teammate at 4 m blind ${s1(secs(mate))} s, folded ${s1(fold(mate))} s · teammate at 1.5 m blind ${s1(secs(close))} s, folded ${s1(fold(close))} s · defender at 4 m blind ${s1(secs(foe))} s, folded ${s1(fold(foe))} s · a man of team 'guard' at 4 m blind ${s1(secs(staff))} s, folded ${s1(fold(staff))} s`);
    const foeFull = secs(foe) >= FLASH.secs[1] - 0.01 && fold(foe) >= FLASH.stagger[1] - 0.01;
    ok &&= foeFull && (signed ? secs(mate) === 0 && fold(mate) === 0 && secs(close) > 0 && secs(close) <= FLASH.ownSecs + 0.01 && fold(close) === 0 && secs(staff) >= FLASH.secs[1] - 0.01 && fold(staff) > 0
      : secs(mate) >= FLASH.secs[1] - 0.01 && fold(mate) > 0 && secs(staff) === 0 && fold(staff) === 0); }
  verdict(staged && res.length === 2 && ok, 'the rule: an unsigned can with its thrower off the list is a guard\'s to his mates; signed, it is their own side\'s', staged ? res.join('\n    ') : 'could not stage both halves: four men, two defenders and open floor with four places round a burst (a pair scenario has too few men: use a squad of four)');
}
// ---------------------------------------------------------------- bang
{ let done = false; const tried: string[] = [];
  const play = async (name: string, side: 1 | -1, on: boolean) => { const S: any = await quiet(() => BT.stage(SCN, SEED)), g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav; DOORTOOLS.ownCan = on && !BREAK;
    for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true));
    const d = g.doors.list.find((x: any) => x.def.name === name), X = frame(d, side), red: any[] = O.men('red'), blue: any[] = O.men('blue'); if (red.length < 2 || blue.length < 2) return null;
    const posts = O.stackPosts(d, side, red); if (!posts) return null;
    // the other pair: more than 5 m back from the frame on this face, a line through the doorway to a spot the can will be near
    const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = []; const inside = X.at(-2.3, 0), back: number[][] = [];
    for (const b of [5.3, 5.6, 6.0]) for (const l of [0, 0.35, -0.35, 0.7, -0.7]) { const p = X.at(b, l);
      if (flat(p, d.frameCentre) > 5.1 && !nav.isBlocked(p[0], p[2]) && !g.col.segmentBlocked([inside[0], 0.55, inside[2]], [p[0], 1.6, p[2]]) && back.every(q => flat(q, p) > 0.6)) back.push(p); }
    g.col.dynamicBoxes = leaves; if (back.length < 2) return null;
    const far = X.at(3, 9), sam = nav.isBlocked(far[0], far[2]) ? nav.nearestFreePoint(far[0], far[2]) : far; if (!sam) return null; await quiet(() => g.teleportPlayer([sam[0], 0, sam[2]] as any));
    posts.forEach((P: any, i: number) => put(red[i], P.pos)); const pin = () => blue.forEach((x, i) => put(x, back[i])); pin(); await quiet(() => { for (let i = 0; i < 10; i++) { S.step(1); pin(); } });
    const n0 = D.stats.ownFlashed, why = await quiet(() => D.order('bangClear', red, d, side)); if (typeof why === 'string') return { why };
    let op: any = null; await quiet(() => { for (let i = 0; i < 60 * 30; i++) { S.step(1); pin(); op = [...D.ops, ...D.done].find((o: any) => o.door === d && !isNaN(o.bangT)); if (op) break; } });
    if (!op) return { why: 'no bang inside 30 s' };
    return { why: null, at: op.bangAt as number[], dist: blue.map(x => Math.hypot(x.char.pos[0] - op.bangAt[0], x.char.pos[2] - op.bangAt[2])), blind: blue.map(x => Math.max(0, x.dazzledUntil - g.time)), fold: blue.map(x => Math.max(0, x.staggerUntil - g.time)),
      red: red.map(x => Math.max(0, x.dazzledUntil - g.time)), counted: D.stats.ownFlashed - n0, names: blue.map(x => x.callsign ?? '?') }; };
  const S0: any = await quiet(() => BT.stage(SCN, SEED)); const doors: { name: string; side: 1 | -1 }[] = [];
  for (const d of S0.g.doors.list) for (const side of [1, -1] as const) doors.push({ name: d.def.name, side });
  for (const F of doors) { if (done) break; const tag = F.name + (F.side > 0 ? '+' : '−');
    const off = await play(F.name, F.side, false); if (!off) continue; if (off.why) { tried.push(`${tag}: ${off.why}`); continue; }
    if (!off.blind!.some(s => s > 0)) { tried.push(`${tag}: burst ${off.dist!.map(s1).join(' / ')} m from the pair, no line`); continue; }
    const on = await play(F.name, F.side, true); if (!on || on.why) { tried.push(`${tag}: ${on?.why ?? 'not staged the second time'}`); continue; }
    done = true; const row = (r: any) => r.names.map((n: string, i: number) => `${n} ${s1(r.dist[i])} m from the burst: blind ${s1(r.blind[i])} s, folded ${s1(r.fold[i])} s`).join(' · ');
    const fault = off.blind!.some((s, i) => s >= 2 && off.fold![i] > 0) && off.counted! > 0;
    const mended = on.blind!.every((s, i) => on.dist![i] > FLASH.ownM ? s === 0 && on.fold![i] === 0 : true) && on.counted === 0 && on.red!.every(s => s === 0);
    verdict(fault, `bang and clear on ${tag}, ownCan OFF: the pair stood back down the line is blinded by its own side's can (the fault)`, `${row(off)} · counted ${off.counted}`);
    verdict(mended, `the same order, ownCan ON: nobody of the team outside the can's own reach (${FLASH.ownM} m) is touched`, `${row(on)} · counted ${on.counted} · the entry's own two: ${on.red!.map(s1).join(' / ')} s`);
  }
  if (!done) verdict(false, 'a door face to show it on', `none of ${doors.length} faces could be staged with the other pair in the can's line (${tried.slice(0, 8).join(' · ')})`);
}
DOORTOOLS.ownCan = true;
log(`=== own-can-check: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
process.exit(all ? 0 : 1);
