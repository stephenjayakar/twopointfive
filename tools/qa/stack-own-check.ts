// A STACK IS NOT REFUSED FOR THE DOOR'S OWN LEAF, NOR FOR SAM'S OWN BODY (doorway.ts DOORMANNERS.ownLeaf / ownMark; orders.ts stackPosts).
//   bun run tools/qa/stack-own-check.ts [--scn barracks-four] [--seed 1]        exit 0 = every line PASS, 1 = a FAIL line
// Headless, on the door rules' stand (the five door switches on, set below before anything is imported): nothing here looks at a picture.
//   leaf    every door of the scenario's level, both faces, four men: the leaf stood open toward its swing side at 1.45 / 1.6 / 1.75 rad (inside its stops).
//           With ownLeaf OFF some faces that have marks when the door is shut answer 'no room' (the fault, counted: it must be there to be mended);
//           with it ON none does, and the marks such a face is dealt are the ones it has when shut
//   entry   the first three such faces, played: the four put on that face, the leaf set open, 'open and clear' — taken, ends 'in', every man beyond the door
//   mark    every door face with marks: the four stood stacked on it under a 'stack' order, Sam put half a metre off each man's mark at every free bearing,
//           and the door tools asked for their marks. With ownMark OFF some asks hand a man another mark than the one he stands on, or 'no room' (the
//           fault, counted); with it ON none does — each man is handed his own mark, one a man, within the door tools' tuck — and no mark handed out is
//           on Sam unless a man stands on exactly it. The charge's stand-off is asked the same way and must be the same answer on and off (the rule
//           does not touch it). Then played on three refusing faces: 'open and clear' given for real is refused OFF (in the stand's own words: 'no room on
//           that door.', or with ORDERS.inWay "you're in the way." — Sam's body is the one thing on the places) and taken ON, each man dealt the
//           mark he stood on, and with Sam left standing there the entry ends 'in' with every man beyond the door (but one the room has no point for).
//           Which maker dealt a face's marks (a jamb's file, a corner door's places back from it, worked marks, marks the MARKS pass moved) is the
//           level's; the glass makers (stackLeastGlass) are not on this stand and are not covered
export {};   // (a module: the top-level awaits below need it for the tools/qa typecheck)
for (const k of ['QA_DOORMANNERS', 'QA_DOORSTAY', 'QA_DOORBLAST', 'QA_FRAMEHOLDS', 'ONEWAY']) process.env[k] ??= '1';
const { ROOT } = await import('./headless.ts');
const BT: any = await import('./bang-tally.ts');
const { DOORMANNERS, STACK_OWN } = await import(`${ROOT}/src/game/doorway.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { OWN_EPS, ORDERS, IN_WAY_WORDS } = await import(`${ROOT}/src/game/orders.ts`);

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SCN = arg('--scn', 'barracks-four'), SEED = +arg('--seed', '1');
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const log = console.log, quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = e; console.warn = w; } };
let all = true; const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
const rules = (leaf: boolean, mark: boolean) => { DOORMANNERS.ownLeaf = leaf; DOORMANNERS.ownMark = mark; };
const fresh = async () => { const S: any = await quiet(() => BT.stage(SCN, SEED)); const g = S.g; for (const x of g.guards) if (x.state !== 'dead' && x.team === 'hostile') await quiet(() => killGuard(g, x, [0, 0, 1], true)); return S; };
const frame = (d: any, side: 1 | -1) => { const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre;
  return { u, n, c, at: (b: number, l: number): number[] => [c[0] + n[0] * b + u[0] * l, 0, c[2] + n[1] * b + u[1] * l], off: (p: number[]) => (p[0] - c[0]) * n[0] + (p[2] - c[2]) * n[1] }; };
const setLeaf = (g: any, d: any, a: number) => { d.angle = a; d.latched = a === 0; d.vel = 0; d.closing = false; d.place(); g.col.dynamicBoxes = g.doors.leafBoxes(); };
const openAngles = (d: any) => [...new Set([1.45, 1.6, 1.75].map(a => Math.max(d.minA, Math.min(d.maxA, a * (d.swing || 1)))))].filter(a => Math.abs(a) >= 1);
const same = (a: any[] | null, b: any[] | null) => !!a && !!b && a.length === b.length && a.every(p => b.some(q => flat(p.pos, q.pos) < 0.02));

log(`=== stack-own-check: ${SCN}, seed ${SEED} ===`);
// ---------------------------------------------------------------- leaf
const faces: { name: string; side: 1 | -1 }[] = [];
{ const S = await fresh(), g = S.g, O = g.orders, men = O.squad().filter((x: any) => x.state !== 'dead');
  let asked = 0, refusedOff = 0, refusedOn = 0, differ = 0; const bad: string[] = [];
  for (const d of g.doors.list) for (const side of [1, -1] as const) {
    setLeaf(g, d, 0); rules(true, true); const shut = O.stackPosts(d, side, men); if (!shut) continue;
    let fault = false;
    for (const a of openAngles(d)) { setLeaf(g, d, a); asked++;
      rules(false, true); const off = O.stackPosts(d, side, men);
      rules(true, true); const on = O.stackPosts(d, side, men);
      if (!off) { refusedOff++; fault = true; if (on && !same(on, shut)) { differ++; bad.push(`${d.def.name}${side > 0 ? '+' : '−'}@${a.toFixed(2)} marks differ from shut`); } }
      else if (!same(on, off)) { differ++; bad.push(`${d.def.name}${side > 0 ? '+' : '−'}@${a.toFixed(2)} a face that had marks was dealt others`); }
      if (!on) { refusedOn++; bad.push(`${d.def.name}${side > 0 ? '+' : '−'}@${a.toFixed(2)} still refused`); } }
    setLeaf(g, d, 0); if (fault) faces.push({ name: d.def.name, side });
  }
  verdict(refusedOff > 0, 'the fault is there with the rule off', `${asked} asks (every door face with marks when shut × its leaf open on its swing side): ${refusedOff} answer 'no room' with ownLeaf off, on ${faces.length} faces: ${faces.map(f => f.name + (f.side > 0 ? '+' : '−')).join(' ')}`);
  verdict(refusedOn === 0 && differ === 0, 'with the rule on no such face is refused, and nothing else moves', `${refusedOn} refused with ownLeaf on; ${differ} asks whose marks are not the ones expected (a refused face: its shut marks; any other: what it had)${bad.length ? ' — ' + bad.slice(0, 6).join('; ') : ''}`);
}
// ---------------------------------------------------------------- entry
for (const F of faces.slice(0, 3)) { const S = await fresh(), g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav; rules(true, true);
  const d = g.doors.list.find((x: any) => x.def.name === F.name), X = frame(d, F.side), team: any[] = O.squad().filter((x: any) => x.state !== 'dead');
  const gate = X.at(0.7, 0), spots: number[][] = [];
  for (const back of [1.0, 1.6, 2.4, 3.2, 4.2]) for (const lat of [3.5, -3.5, 4.5, -4.5, 2.6, -2.6, 5.5, -5.5, 1.5, -1.5, 0.4]) { const p = X.at(back, lat); if (nav.isBlocked(p[0], p[2]) || spots.some(s => flat(s, p) < 0.8)) continue;
    const path = nav.findPath(p, gate); if (!path || !path.length) continue; let len = 0, q = p; for (const w of path) { len += flat(q, w); q = w; } if (len < 9) spots.push(p); }
  if (spots.length < team.length + 1) { log(`    (${F.name}: no floor to put the team on that face — skipped)`); continue; }
  team.forEach((gd, i) => { const p = spots[i]; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; });
  await quiet(() => g.teleportPlayer(spots[team.length] as any));
  setLeaf(g, d, openAngles(d)[1] ?? openAngles(d)[0]); await quiet(() => S.step(20));
  const why = await quiet(() => D.order('openClear', team, d, F.side)); let ended = -1;
  if (typeof why !== 'string') await quiet(() => { for (let i = 0; i < 60 * 45; i++) { S.step(1); if (!D.ops.length) { ended = i / 60; break; } } S.step(120); });
  const beats: string[] = []; for (const op of [...D.done, ...D.ops]) beats.push(...(op.beats ?? []).map((b: any) => b.what));
  const beyond = team.filter(x => X.off(x.char.pos) < -0.3).length;
  verdict(typeof why !== 'string' && ended >= 0 && beats.includes('end: in') && beyond === team.length, `open and clear on ${F.name}${F.side > 0 ? '+' : '−'} with its own leaf open across the face`,
    `${typeof why === 'string' ? `REFUSED: ${why}` : `taken, ended ${ended < 0 ? 'never' : ended.toFixed(1) + ' s'} · ${beats.filter(b => /^end|^stacked|^open already|^shove|^go$/.test(b)).join(' · ')}`} · ${beyond} of ${team.length} beyond the door · leaf at ${d.angle.toFixed(2)} rad`);
}
// ---------------------------------------------------------------- mark
{ const S0 = await fresh(); const cand: { name: string; side: 1 | -1 }[] = [];
  { const g = S0.g, O = g.orders, men = O.squad().filter((x: any) => x.state !== 'dead'); rules(true, true);
    for (const d of g.doors.list) for (const side of [1, -1] as const) { setLeaf(g, d, 0); if (O.stackPosts(d, side, men)) cand.push({ name: d.def.name, side }); } }
  // the four stood stacked on face F under a 'stack' order, Sam well away — a string: why the face could not be staged
  const stacked = async (F: { name: string; side: 1 | -1 }) => { const S = await fresh(), g = S.g, O = g.orders, D = g.doorTools, nav = g.col.nav; rules(true, true);
    const d = g.doors.list.find((x: any) => x.def.name === F.name), X = frame(d, F.side), team: any[] = O.squad().filter((x: any) => x.state !== 'dead');
    const posts0 = O.stackPosts(d, F.side, team); if (!posts0) return 'no stack on a fresh level';
    const far = X.at(7, 0), away = nav.isBlocked(far[0], far[2]) ? nav.nearestFreePoint(far[0], far[2]) : far; if (!away) return 'no floor to stand Sam away on';
    await quiet(() => g.teleportPlayer([away[0], 0, away[2]] as any));
    posts0.forEach((P: any, i: number) => { const gd = team[i]; gd.char.pos[0] = P.pos[0]; gd.char.pos[2] = P.pos[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; });
    const w0 = await quiet(() => O.give('stack', { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: F.side }, 'all')); if (w0) return `the stack order was refused (${w0})`;
    await quiet(() => { for (let i = 0; i < 60 * 12 && !team.every(x => O.of(x)?.arrived); i++) S.step(1); });
    if (!team.every(x => O.of(x)?.arrived && O.of(x)?.post && flat(x.char.pos, O.of(x).post) < 0.3)) return 'the men did not settle on their marks';
    return { S, g, O, D, d, X, team, nav, own: team.map(x => [...O.of(x).post] as number[]) }; };
  const TUCK = 0.45, BODY = 0.7, EXACT: number = OWN_EPS;
  // every man is handed a mark of his own within the door tools' tuck of the one he stands on (one mark a man: the nearest pairs first)
  const keeps = (own: number[][], posts: any[] | null) => { if (!posts || posts.length !== own.length) return false; const left = posts.map((P: any) => P.pos as number[]);
    const pairs = own.flatMap((q, i) => left.map((p, k) => ({ i, k, d: flat(p, q) }))).sort((a, b) => a.d - b.d), mi = new Set<number>(), pk = new Set<number>();
    for (const e of pairs) { if (e.d > TUCK) break; if (mi.has(e.i) || pk.has(e.k)) continue; mi.add(e.i); pk.add(e.k); }
    return mi.size === own.length; };
  // no mark handed out is on Sam, but for a mark a man already stands on
  const onSam = (own: number[][], posts: any[] | null, at: number[]) => !!posts && posts.some((P: any) => flat(P.pos, at) < BODY && !own.some(q => flat(q, P.pos) < EXACT));
  let staged = 0, asks = 0, faultAsks = 0, refusedOff = 0, onSamOff = 0, onBad = 0, soOff = 0, soOn = 0, soBad = 0; const bad: string[] = [], unstaged: string[] = [], show: { F: { name: string; side: 1 | -1 }; who: string; by: number[] }[] = [], faultFaces = new Set<string>();
  for (const F of cand) { const T = await stacked(F), tag = F.name + (F.side > 0 ? '+' : '−'); if (typeof T === 'string') { unstaged.push(`${tag} (${T})`); continue; }
    const { g, D, d, team, nav, own } = T; rules(true, true);
    if (!keeps(own, D.stackPosts(d, F.side, team))) { unstaged.push(`${tag} (the door tools deal other marks with Sam away)`); continue; }
    staged++; const so0 = !!D.standoffPosts(d, F.side, team.length, team); let shown = false;
    // Sam half a metre off each man's mark, every bearing with free floor that is not inside another man (nothing is stepped: his place is written, then asked about)
    for (let m = 0; m < team.length; m++) for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8, p = [own[m][0] + Math.sin(a) * 0.5, 0, own[m][2] + Math.cos(a) * 0.5];
      if (nav.isBlocked(p[0], p[2]) || team.some((x, i) => i !== m && flat(x.char.pos, p) < 0.6)) continue;
      g.player.char.pos[0] = p[0]; g.player.char.pos[2] = p[2]; asks++;
      rules(true, false); const off = D.stackPosts(d, F.side, team), soA = D.standoffPosts(d, F.side, team.length, team);
      rules(true, true); const on = D.stackPosts(d, F.side, team), soB = D.standoffPosts(d, F.side, team.length, team);
      if (onSam(own, off, p)) onSamOff++;
      if (!keeps(own, off)) { faultAsks++; faultFaces.add(tag); if (!off) { refusedOff++; if (!shown && show.length < 3) { shown = true; show.push({ F, who: team[m].callsign, by: p }); } } }
      const why = !on ? 'REFUSED' : !keeps(own, on) ? 'a man dealt a mark that is not the one he stands on' : onSam(own, on, p) ? 'a man dealt a mark on Sam that nobody stands on' : '';
      if (why) { onBad++; if (bad.length < 6) bad.push(`${tag} Sam by ${team[m].callsign} @${k}: ${why}`); }
      if (so0 && !soA) soOff++; if (so0 && !soB) soOn++;
      const same = (!soA && !soB) || (!!soA && !!soB && soA.length === soB.length && soA.every((P: any, i: number) => flat(P.pos, soB[i].pos) < 0.01));
      if (!same) { soBad++; if (bad.length < 6) bad.push(`${tag} Sam by ${team[m].callsign} @${k}: the stand-off differs with the rule on`); } } }
  verdict(staged * 10 >= cand.length * 7, 'most faces could be staged', `${staged} of ${cand.length} faces with the four stood stacked on them${unstaged.length ? ` · not staged: ${unstaged.join(', ')}` : ''}`);
  verdict(faultAsks > 0, 'the fault is there with the rule off', `Sam stood half a metre off each man's mark at every free bearing (${asks} asks of the door tools' marks): with ownMark off ${faultAsks} asks on ${faultFaces.size} faces hand a man another mark than his own, ${refusedOff} of them 'no room'; ${onSamOff} hand out a mark on Sam that nobody stands on`);
  verdict(onBad === 0, 'with the rule on every stacked man keeps the mark he stands on, wherever Sam stands by them, and nobody is put on Sam', `${onBad} asks refused, or handing a man another mark than his own, or a mark on Sam that nobody stands on${bad.length ? ' — ' + bad.join(' · ') : ''}`);
  verdict(soBad === 0, 'a charge\'s stand-off is the same answer with the rule on and off', `${soBad} asks differ · (not this rule's: of the asks where the stand-off is there with Sam away, ${soOff} are refused with him by a man, ${soOn} with the rule on — Sam on a stand-off place nobody stands on)`);
  // … and played: a door tool given for real at the first refusing place of three such faces, Sam left standing there until the entry ends
  for (const { F, who, by } of show) { const res: string[] = []; let ok = true;
    for (const on of [false, true]) { const T = await stacked(F); if (typeof T === 'string') { ok = false; res.push(`could not be staged again (${T})`); break; }
      const { S, g, O, D, d, X, team, own } = T; rules(true, on); await quiet(() => g.teleportPlayer([by[0], 0, by[2]] as any)); const n0 = STACK_OWN.mark;
      const why = await quiet(() => D.order('openClear', team, d, F.side));
      if (!on) { res.push(`ownMark off: ${typeof why === 'string' ? `REFUSED: ${why}` : 'taken'}`); ok &&= why === (ORDERS.inWay ? IN_WAY_WORDS : 'no room on that door.'); continue; }   // (the refusal's words are the stand's own: with ORDERS.inWay — on as the page ships — a stack refused only for Sam's body says so, and Sam's body is all that is in the way here)
      const posts = team.map(x => ({ pos: O.of(x)?.post ?? [1e6, 0, 1e6] })), kept = typeof why !== 'string' && team.every((x, i) => flat(own[i], posts[i].pos) < TUCK) && !onSam(own, posts, by), asked = STACK_OWN.mark - n0;
      let ended = -1; if (typeof why !== 'string') await quiet(() => { for (let i = 0; i < 60 * 45; i++) { S.step(1); if (!D.ops.length) { ended = i / 60; break; } } S.step(60); });
      const beats: string[] = []; for (const op of [...D.done, ...D.ops]) beats.push(...(op.beats ?? []).map((b: any) => b.what));
      const beyond = team.filter(x => X.off(x.char.pos) < -0.3).length, out = beats.filter(b => b.startsWith('outside')).length, moved = flat(g.player.char.pos, by);
      res.push(`ownMark on: ${typeof why === 'string' ? `REFUSED: ${why}` : `taken${kept ? ', every man dealt the mark he stood on' : ', but a man was dealt a place off his own mark or on Sam'} (the rule answered ${asked} asks) · ended ${ended < 0 ? 'never' : ended.toFixed(1) + ' s'}${beats.includes('end: in') ? ' in' : ''} · ${beyond} of ${team.length} beyond the door${out ? `, ${out} with no point inside left outside` : ''} · Sam shouldered ${moved.toFixed(2)} m`}`);
      ok &&= typeof why !== 'string' && kept && ended >= 0 && beats.includes('end: in') && beyond >= 2 && beyond + out >= team.length; }
    verdict(ok, `'open and clear' given to four stacked on ${F.name}${F.side > 0 ? '+' : '−'} with Sam stood by ${who}'s mark`, res.join(' · ')); }
  if (!show.length) verdict(false, 'a face to play it on', `no staged face refused the stack with ownMark off`);
}
rules(true, true);
log(`=== stack-own-check: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
process.exit(all ? 0 : 1);
