// A MAN SHOULDERED OFF A MARK HE HAD STEPS BACK ONTO IT (doorway.ts DOORMANNERS.backOn; orders.ts, the order tick's 'as near his mark as he will get').
//   bun run tools/qa/stack-back-check.ts [id …] [--faces 3]        exit 0 = every line PASS, 1 = a FAIL line     (no id: the five squad levels below)
//   STACKBACK_BREAK=1 in front = the rule held off in the arm that should have it: the check must FAIL
// Headless, on the door rules' stand (the five door switches on, set below before anything is imported): nothing here looks at a picture.
//   shove   a few door faces of each level: the level's own team put on that face's floor, 'stack' given, the stack let form, and then every man moved
//           half a metre off his mark at once — what a mate walking along the wall to the far jamb does to him with his shoulder — at two moments
//           after the stack formed (0.4 s and 2.0 s: whether he steps back by himself hangs on where the runner's settle watchdog is in its own
//           3.6 s round, which nothing here sets — two moments and many men land all over it), and six seconds watched.
//           Rule OFF: counted, the men whose MARK was moved to where they were pushed (the fault: it must be there to be mended). Rule ON: no mark
//           moves, every man ends back within 0.35 m of the mark he had, and the rule was the one that sent him (its counter moved)
//   taken   a shove of ONE man with the rule on, half a metre from his MARK (not from his feet), and he is HELD where he was pushed to (a body he
//           cannot get past; Sam will not do: a teammate shoulders Sam off his mark): he goes back for it no more than BACK_TRIES times, and then
//           the mark comes to him as it always did — he is 'arrived' where he stands, not lunging at it for ever
//   never   one man stopped half a metre or more short of his mark on the way in — a mark he never had — and held there: the rule sends him nowhere,
//           the mark comes to him (the older rule, as it was)
//   off     the same shove with the door manners off: the rule sends nobody (its counter stands still)
export {};   // (a module: the top-level awaits below need it for the tools/qa typecheck)
for (const k of ['QA_DOORMANNERS', 'QA_DOORSTAY', 'QA_DOORBLAST', 'QA_FRAMEHOLDS', 'ONEWAY']) process.env[k] ??= '1';
const { ROOT } = await import('./headless.ts');
const BT: any = await import('./bang-tally.ts');
const { DOORMANNERS, STACK_OWN } = await import(`${ROOT}/src/game/doorway.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { BACK_TRIES } = await import(`${ROOT}/src/game/orders.ts`);

const argv = process.argv.slice(2), FACES = (() => { const i = argv.indexOf('--faces'); return i >= 0 ? +argv[i + 1] : 3; })(), BREAK = !!process.env.STACKBACK_BREAK;
const named = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--faces');
const IDS = named.length ? named : ['depot-four', 'warehouse-four', 'barracks-four', 'room-clear-four', 'records-pair'];
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]), at = (p: V) => `(${p[0].toFixed(2)}, ${p[2].toFixed(2)})`;
const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const SHOVE = 0.5, NEAR = 0.35, WATCH = 6, FORM = 14, PHASES = [0.4, 2.0];
const stage = async (id: string) => { const S: any = await quiet(() => BT.stage(id, 1)); const g = S.g; for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true)); await quiet(() => S.step(30)); return S; };

log(`=== stack-back-check: ${IDS.join(', ')}${BREAK ? ' (STACKBACK_BREAK: the rule held off)' : ''} ===`);
let played = 0, pushed = 0, movedOff = 0, movedOn = 0, farOn = 0, sentOn = 0, sentOffStand = 0, offPlayed = 0, takenPlayed = 0, takenOk = 0, neverPlayed = 0, neverOk = 0; const bad: string[] = [], shown: string[] = [];
for (const id of IDS) {
  let S: any; try { S = await stage(id); } catch (e) { all = false; log(`- FAIL — ${id} does not stage: ${(e as Error).message.slice(0, 120)}`); continue; }
  const g = S.g, O = g.orders, men: any[] = O.squad().filter((x: any) => x.state !== 'dead'), home: V = [...g.player.char.pos];
  const free = (p: V, from: V) => !g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([from[0], 0.45, from[2]], [p[0], 0.45, p[2]]);
  // where the team stands before the order: the face's own floor, a few metres back from the door
  const spotsOf = (d: any, side: 1 | -1): V[] | null => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre as V, spots: V[] = [];
    for (let back = 2.2; back < 7 && spots.length < men.length; back += 0.8) for (const along of [0, -0.8, 0.8, -1.6, 1.6]) { const p: V = [c[0] + n[0] * back + u[0] * along, 0, c[2] + n[1] * back + u[1] * along];
      if (spots.length < men.length && free(p, [c[0] + n[0] * 0.6, 0, c[2] + n[1] * 0.6]) && !spots.some(q => flat(q, p) < 0.7) && !g.doors.list.some((x: any) => x !== d && flat(p, x.frameCentre) < 1.4)) spots.push(p); }
    return spots.length >= men.length ? spots : null; };
  const reset = async (d: any, spots: V[]) => { await quiet(() => { O.give('fallIn', O.targetAt(g.player.char.pos), 'all'); O.clear(); for (const x of g.doors.list) { x.angle = 0; x.vel = 0; x.latched = true; x.place(); }
    g.teleportPlayer(home); men.forEach((m, i) => { m.char.pos = [spots[i][0], 0, spots[i][2]]; m.char.vel = [0, 0, 0]; m.speed = 0; m.path = []; m.pathGoal = null; m.char.update(0); }); S.step(3); }); };
  /** the stack formed on that face: the marks the men stand on, or null (refused, or not formed inside FORM s: not judged) */
  const form = async (d: any, side: 1 | -1, spots: V[]): Promise<V[] | null> => { await reset(d, spots);
    const why = await quiet(() => O.give('stack', { kind: 'door', at: [...d.frameCentre], door: d, side }, 'all')); if (why || men.some(m => !O.of(m)?.post)) return null;
    await quiet(() => { for (let f = 0; f < FORM * 60 && !men.every(m => O.of(m)?.arrived); f++) S.step(1); });
    return men.every(m => O.of(m)?.arrived && O.of(m).post) ? men.map(m => [...O.of(m).post]) : null; };
  /** half a metre off his mark, the way a shoulder sends him: back from the wall first, else the first of eight ways with floor under it and nobody on it */
  const shoveOf = (d: any, side: 1 | -1, m: any, taken: V[], from?: V): V | null => { const th = d.def.closedDir, n = Math.atan2(Math.cos(th) * side, -Math.sin(th) * side), p = from ?? m.char.pos as V;
    for (let k = 0; k < 8; k++) { const a = n + (k % 2 ? -1 : 1) * Math.ceil(k / 2) * Math.PI / 4, q: V = [p[0] + Math.cos(a) * SHOVE, 0, p[2] + Math.sin(a) * SHOVE];
      if (free(q, m.char.pos) && !taken.some(t => flat(t, q) < 0.5) && flat(q, g.player.char.pos) > 0.7) return q; }
    return null; };
  const shove = (d: any, side: 1 | -1, who: any[], from?: V): number => { const taken: V[] = men.filter(m => !who.includes(m)).map(m => [...m.char.pos]); let n = 0;
    for (const m of who) { const q = shoveOf(d, side, m, taken, from); if (!q) { taken.push([...m.char.pos]); continue; } taken.push(q); m.char.pos[0] = q[0]; m.char.pos[2] = q[2]; n++; } return n; };
  const faces: { d: any; side: 1 | -1; spots: V[] }[] = [];
  for (const d of g.doors.list) for (const side of [1, -1] as const) { const sp = spotsOf(d, side); if (sp) faces.push({ d, side, spots: sp }); }
  const pick = faces.filter((_, i, a) => FACES >= a.length || Math.floor(i * FACES / a.length) !== Math.floor((i - 1) * FACES / a.length));
  let lvl = 0, last: (typeof pick)[number] | null = null;
  for (const C of pick) for (const phase of PHASES) { const tag = `${id} ${C.d.def.name}${C.side > 0 ? '+' : '−'}, shoved ${phase} s after the stack formed`; const res: Record<string, { moved: number; far: number; sent: number; n: number }> = {};
    for (const on of [false, true]) { DOORMANNERS.backOn = on && !BREAK;
      const marks = await form(C.d, C.side, C.spots); if (!marks) break;
      await quiet(() => S.step(Math.round(phase * 60))); const sent0 = STACK_OWN.back, n = shove(C.d, C.side, men); if (!n) break;
      await quiet(() => S.step(WATCH * 60));
      const moved = men.filter((m, i) => flat(O.of(m)?.post ?? marks[i], marks[i]) > 0.05), far = men.filter((m, i) => flat(m.char.pos, marks[i]) > NEAR);
      res[on ? 'on' : 'off'] = { moved: moved.length, far: far.length, sent: STACK_OWN.back - sent0, n };
      if (on) for (const m of far) bad.push(`${tag}: ${m.callsign} ends ${flat(m.char.pos, marks[men.indexOf(m)]).toFixed(2)} m off the mark he had ${at(marks[men.indexOf(m)])}`);
      else if (moved.length && shown.length < 6) shown.push(`${tag}: ${moved.map(m => `${m.callsign} ${flat(m.char.pos, marks[men.indexOf(m)]).toFixed(2)} m`).join(', ')}`);
    }
    DOORMANNERS.backOn = true; if (!res.off || !res.on) continue;
    played++; lvl++; last = C; pushed += res.on.n; movedOff += res.off.moved; movedOn += res.on.moved; farOn += res.on.far; sentOn += res.on.sent;
  }
  // taken: one man pushed off and held where he was pushed to — half a metre from his MARK, not from where he stands: a man counts as arrived anywhere within
  // NEAR of it, and a shove measured from his feet could leave him still inside that band (as the page ships, one did: 0.30 m), where he has his mark and
  // the rule rightly sends nobody
  if (last) { DOORMANNERS.backOn = !BREAK; const marks = await form(last.d, last.side, last.spots);
    if (marks) { const m = men[men.length - 1], mk = marks[men.length - 1]; await quiet(() => S.step(24)); const sent0 = STACK_OWN.back;
      if (shove(last.d, last.side, [m], mk)) { const q: V = [...m.char.pos]; await quiet(() => { for (let f = 0; f < 6 * 60; f++) { S.step(1); m.char.pos[0] = q[0]; m.char.pos[2] = q[2]; } });
        const A = O.of(m), sent = STACK_OWN.back - sent0, ok = !!A?.arrived && sent >= 1 && sent <= BACK_TRIES && !!A.post && flat(A.post, q) < 0.05;
        takenPlayed++; if (ok) takenOk++; else bad.push(`${id} ${last.d.def.name}, ${m.callsign} held ${flat(q, mk).toFixed(2)} m off his mark: sent back ${sent} times, ${A?.arrived ? 'arrived' : 'not arrived'}, his mark ${A?.post ? flat(A.post, q).toFixed(2) : '?'} m from him`); } }
    // never: a man held short of a mark he never had — the old rule, untouched
    { DOORMANNERS.backOn = !BREAK; await reset(last.d, last.spots); const why = await quiet(() => O.give('stack', { kind: 'door', at: [...last.d.frameCentre], door: last.d, side: last.side }, 'all')), m = men[men.length - 1], A0 = O.of(m);
      if (!why && A0?.post) { const mk: V = [...A0.post], sent0 = STACK_OWN.back; let q: V | null = null;
        await quiet(() => { for (let f = 0; f < (FORM + 4) * 60; f++) { S.step(1); const k = flat(m.char.pos, mk); if (!q && k < 0.8 && k > 0.5) q = [...m.char.pos]; if (q) { m.char.pos[0] = q[0]; m.char.pos[2] = q[2]; if (O.of(m)?.arrived && f % 60 === 59) break; } } });
        if (q) { const A = O.of(m); neverPlayed++; if (A?.arrived && A.post && flat(A.post, q) < 0.05 && STACK_OWN.back === sent0) neverOk++; else bad.push(`${id} ${last.d.def.name}, ${m.callsign} held ${flat(q, mk).toFixed(2)} m short of a mark he never had: sent back ${STACK_OWN.back - sent0} times, ${A?.arrived ? 'arrived' : 'not arrived'}`); } } }
    // off: the door manners off, the rule sends nobody
    DOORMANNERS.backOn = true; DOORMANNERS.on = false; const m2 = await form(last.d, last.side, last.spots);
    if (m2) { await quiet(() => S.step(24)); const sent0 = STACK_OWN.back; if (shove(last.d, last.side, men)) { await quiet(() => S.step(WATCH * 60)); offPlayed++; sentOffStand += STACK_OWN.back - sent0; } }
    DOORMANNERS.on = true; }
  log(`  ${id}: ${lvl} shoves played on ${pick.length} faces`);
}
for (const s of shown) log(`    the fault, rule off — ${s}`);
for (const s of bad.slice(0, 12)) log(`    ${s}`);
verdict(played > 0 && movedOff > 0, 'the fault is there with the rule off', `${played} shoves of a formed stack played both ways, ${pushed} men pushed half a metre off their marks: with the rule off ${movedOff} had their MARK moved to where they were pushed`);
verdict(played > 0 && movedOn === 0 && farOn === 0 && sentOn > 0, 'with the rule on a man pushed off his mark steps back onto it', `marks moved ${movedOn} · men ending more than ${NEAR} m off the mark they had ${farOn} · sent back by the rule ${sentOn} times`);
verdict(takenPlayed > 0 && takenOk === takenPlayed, 'a man KEPT from his mark goes back for it no more than twice, then the mark comes to him', `${takenOk} of ${takenPlayed} (one man pushed off and held where he was pushed to for six seconds)`);
verdict(neverPlayed > 0 && neverOk === neverPlayed, 'a man held short of a mark he NEVER had is not sent anywhere: the mark comes to him, as it always did', `${neverOk} of ${neverPlayed} (one man stopped 0.5 to 0.8 m short on his way in and held there)`);
verdict(offPlayed > 0 && sentOffStand === 0, 'with the door manners off the rule sends nobody', `${offPlayed} shoves played with DOORMANNERS.on false: sent back ${sentOffStand} times`);
log(all ? '=== stack-back-check: ALL PASS ===' : '=== stack-back-check: FAIL ===');
process.exit(all ? 0 : 1);
