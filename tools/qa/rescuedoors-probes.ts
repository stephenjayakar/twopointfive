// 'rescue-doortools' (family 'rescue'): the room clear's door tools (game/doortools.ts) on the hostage rescue's doors (game/rescue.ts behind ?rescue), through probes.ts:
//   bun run tools/qa/probes.ts rescue-doortools   [--verbose]
// PASS / FAIL each, all headless, on rescue-probes.ts's rig (Sam teleported, planted dark; what anybody SEES is guards.ts's direct-light estimate, not the page's).
//   the menu      X pressed on the hostage room's corridor door under ?rescue lists the same rows — five, and the four door tools on the page behind 5 — digits and counts (3 bangs, 2 charges) as the same door under
//                 ?roomclear; from inside the server room every door row is open on the side door too (its jambs have no floor: the scenario's marks stand in)
//   bang          X, 5, 2 on the corridor door: the menu's own bang and clear — stacked → boot → can → off INSIDE the room → go → in, one can spent, nothing
//                 of F's entry involved; F meanwhile is refused in words and spends nothing
//   the clock     the same order with the captor's clock running and the room fight's daze at its default: while that can has him dazzled his clock stands still
//   charge        X, 5, 3: set, armed, and NOTHING until Sam's trigger; then F is the trigger (the rescue's own F order does not get the press), the leaf is in,
//                 the men go in behind it
//   side door     a charge on each of the room's two doors, one man each, from the menu; ONE F blows both on the same frame (the two doors are linked for the
//                 scenario) and both men go in; a bang and clear on the side door alone
//   two doors     one F with a man posted in the server room: two bang and clears through one gate, both leaves on one frame, a can through each; with ONE can left it is the
//                 corridor door's and the side door's man goes in when the men behind it do; the rescue's weapon-light switch is the door tools' men's too
//   a lost lead   a gated order held stacked whose lead is shot: the next man walks to that jamb before the gate's doors open
//   the panel     rescue.press() (the panel's F) blows a set charge as the key does; two men sent to the side door's marks one at a time get one each
import { standUp, ROOT } from './headless.ts';
import { rig, family, staged, up, dist, f1, DT } from './rescue-probes.ts';
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { FIGHT_SKILL } = await import(`${ROOT}/src/game/roomfight.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

const OFFICE = { x0: 22.12, x1: 29.94, z0: 4.12, z1: 9.94 }, SERVER = { x0: 14.12, x1: 21.88, z0: 4.12, z1: 9.94 };
const INSIDE = (p: number[], B: { x0: number; x1: number; z0: number; z1: number }) => p[0] > B.x0 && p[0] < B.x1 && p[2] > B.z0 && p[2] < B.z1;
const CORRIDOR = [24.0, 0, 11.2], WEST = [19.5, 0, 11.2];   // Sam off the corridor door's line · and west of the side door's plane (its server-room face is his face of it)
/** press X with the cursor on p (the order menu comes up and stays, nothing held — orders.ts's press menu), read its order rows — and, through its row 5, the
 *  door tools' page behind it — Esc (the door tools probes' own idiom) */
function menuOn(W: any, step: () => void, p: number[]) {
  const O = W.game.orders, input = W.input;
  W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); step(); for (let i = 0; i < 24; i++) { W.cursorAt([p[0], p[1], p[2]]); step(); }
  const read = () => { const M = O.menu, hud = O.hud().menu; return M ? { ids: M.rows.map((r: any) => r.id).join(' ') as string, kind: M.target.kind as string, rows: (hud?.rows ?? []).slice(1).filter((r: any) => r.kind !== 'cancel').map((r: any) => `${r.opts[0]?.key} ${r.opts[0]?.text}${r.off ? ' (off)' : ''}`).join(' | ') as string } : null; };   // (row 0 = who the order goes to)
  const first = read(); if (!first) { input.pressed.add('Escape'); step(); return null; }
  const opener = O.menu.rows.find((r: any) => r.opens); let page: ReturnType<typeof read> = null;
  if (opener) { input.pressed.add(`Digit${opener.key}`); step(); step(); page = O.menu?.page === opener.opens ? read() : null; input.pressed.add('Escape'); step(); }
  input.pressed.add('Escape'); step();
  return { ...first, toolIds: page?.ids ?? '', tools: page?.rows ?? '' };
}
/** press X on p, then the digits a third of a second later, one a frame (5, 2 = the door tools' page, its second row) */
function pick(W: any, step: () => void, p: number[], ...n: number[]) {
  const input = W.input; W.cursorAt([p[0], p[1], p[2]]); input.pressed.add(ORDERS.key); step(); for (let i = 0; i < 20; i++) { W.cursorAt([p[0], p[1], p[2]]); step(); }
  for (const k of n) { input.pressed.add(`Digit${k}`); step(); }
}
const beatT = (op: any, what: string | RegExp): number => { const b = op?.beats.find((b: any) => typeof what === 'string' ? b.what === what || b.what.startsWith(what) : what.test(b.what)); return b ? b.t : NaN; };
/** the room taken (a run that ended LOST is not) */
const won = (R: any) => R.state === 'secured' || R.result?.state === 'rescued';
const inOrder = (op: any, whats: (string | RegExp)[]) => { let last = -Infinity; for (const w of whats) { const t = beatT(op, w); if (!(t >= last)) return false; last = t; } return true; };
const beats = (op: any, t0: number) => (op?.beats ?? []).map((b: any) => `${(b.t - t0).toFixed(1)} ${b.what}`).join(' | ');
/** the scenario with the men who matter to a door probe: the captor and the door man in the room, no roamer, the pair on Sam, Sam where he gives the order from */
async function doorRig(seed: number, knobs: Record<string, unknown> = {}, sam = CORRIDOR) {
  const T = await rig(seed, { doorMan: 'inside', roamers: 0, clock: false, flow: false, ...knobs }); const R = T.R, g = T.game; g.godMode = true; T.secs(0.3);
  T.walkSam([8.2, 0, 11.2]); T.walkSam(sam); T.secs(3);
  return { T, R, g, DTL: g.doorTools, O: g.orders, fd: g.doors.byName('manager'), sd: g.doors.byName('server_manager') };
}

export const rescueDoorTools = staged(['DOORWAY.oneWay', 'DOORTOOLS.testDoor', 'DOORTOOLS.outsidePlain'], async () => {
  const F = family('rescue-doortools: the order menu\'s door tools on the hostage rescue\'s doors — the same rows, keys and counts as under ?roomclear');
  // ---- the menu, against ?roomclear's on the same door
  { const { T, R, g, DTL, O, fd, sd } = await doorRig(31);
    const mine = menuOn(T.W, () => T.step(), fd.frameCentre);
    Math.random = (() => { let a = 31; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
    const log = console.log; console.log = () => { }; let W2: any; try { W2 = await standUp(); } finally { console.log = log; }
    const why2 = W2.game.roomClear.start(31); const step2 = () => { W2.game.player.visibility = 0.05; W2.step(DT); }; W2.game.godMode = true;
    for (let i = 0; i < 30; i++) step2(); W2.game.teleportPlayer(CORRIDOR); for (const k of ['yaw', 'pitch', 'distance', 'desiredDistance']) W2.cam[k] = T.W.cam[k];   // (the same view of the door as the rescue's camera has: the reticle's ray is the menu's target)
    for (let i = 0; i < 40; i++) step2();
    const theirs = menuOn(W2, step2, W2.game.doors.byName('manager').frameCentre), c2 = `${W2.game.doorTools.charges}/${W2.game.doorTools.bangs}`;
    const four = (t: string) => String(t).split(' | ').slice(0, 4).join(' | '), fifth = (t: string) => String(t).split(' | ')[4] ?? '';
    F.verdict(!!mine && !!theirs && why2 === null && mine.kind === 'door' && mine.ids === 'stack cover fallIn hold tools' && mine.ids === theirs.ids && mine.toolIds === 'openClear bangClear charge thr fragClear' && mine.toolIds === theirs.toolIds && four(mine.tools) === four(theirs.tools) && four(mine.tools) === `1 open and clear | 2 bang and clear · ${DOORTOOLS.bangs} left | 3 breach with a charge · ${DOORTOOLS.charges} left | 4 work it from the threshold ▸` && !/\(off\)/.test(mine.rows + four(mine.tools))
      && /^G frag and clear · \d left — not with hostages on the floor\. \(off\)$/.test(fifth(mine.tools)) && /^G frag and clear · \d left$/.test(fifth(theirs.tools))   // (the frag row, on G under the four: never offered with hostages on the floor)
      && DTL.charges === DOORTOOLS.charges && DTL.bangs === DOORTOOLS.bangs && `${DTL.charges}/${DTL.bangs}` === c2 && DTL.charges === 2 && DTL.bangs === 3,
      'X pressed on the hostage room\'s corridor door: the same five rows, and the same page of four door tools behind 5, under ?rescue as under ?roomclear on the same door — the tools on the same digits (1 to 4) with the same counts, none greyed', `?rescue: ${mine?.rows} ▸ ${mine?.tools} · ?roomclear: ${theirs?.rows} ▸ ${theirs?.tools} · charges/bangs ${DTL.charges}/${DTL.bangs} vs ${c2}`);   // (the menu's own rows 1–4 may be greyed differently: its pair stands elsewhere)
    const notes = O.hud().status.flatMap((r: any) => r.opts.map((o: any) => o.text));
    F.verdict(notes.includes(`charges ${DTL.charges} · bangs ${DTL.bangs}`), 'the counts stand on the squad\'s HUD block under ?rescue', notes.join(' / ').slice(0, 200));
    // from inside the server room, on the side door
    g.doors.kickIn(g.doors.byName('server'), [17.6, 0, 11.0], g.player.char.id); T.secs(0.6);
    T.walkSam([17.6, 0, 11.2]); T.walkSam([17.6, 0, 8.8], 2.5); T.walkSam([19.2, 0, 9.3], 2.5); T.secs(4);
    const t = O.targetAt(sd.frameCentre), ids = ['stack', 'openClear', 'bangClear', 'charge', 'thresholdHold', 'threshold', 'outside'];
    const whys = ids.map(id => O.whyNot(O.defs.find((x: any) => x.id === id), t));
    const M = O.doorMarks.splice(0); const own = O.whyNot(O.defs.find((x: any) => x.id === 'stack'), t); O.knobs.workOut = false; const bare = O.whyNot(O.defs.find((x: any) => x.id === 'stack'), t); O.knobs.workOut = true; O.doorMarks.push(...M);
    F.verdict(t.kind === 'door' && t.door === sd && t.side === 1 && whys.every(w => w === null) && own === null && typeof bare === 'string', 'from inside the server room every door row is open on the side door — by the scenario\'s marks (without them its jambs have no floor: the men work their own marks out, and with that switched off the stack is refused)',
      `target ${t.kind} ${t.door?.def.name} face ${t.side} · ${ids.map((id, i) => `${id}: ${whys[i] ?? 'ok'}`).join(' · ')} · with the marks taken away, stack: ${own ?? 'ok'} · and ORDERS.workOut off: '${bare}'`);
    R.stop(); }
  // ---- X, 5, 2: bang and clear from the menu on the corridor door
  { const { T, R, g, DTL, O, fd } = await doorRig(32); const t0 = g.time;
    pick(T.W, () => T.step(), fd.frameCentre, 5, 2); const op = DTL.ops[0];
    const taken = !!op && op.kind === 'bangClear' && op.door === fd && op.men.length === 2 && R.ops.every((o: any) => O.of(o)?.order === 'bangClear') && DTL.bangs === 2;
    T.secs(1.5); const did = R.orderDoor(), said = g.messages[g.messages.length - 1]?.text ?? '';
    F.verdict(taken && R.entry === null && did === null && /on that door already/.test(said) && DTL.bangs === 2 && DTL.ops.length === 1 && DTL.ops[0] === op,
      'X, 5, 2 on the corridor door: the menu\'s bang and clear has both men, a can spent on the word; F meanwhile is refused in words, takes nobody and spends nothing', `op ${op?.kind} on ${op?.door.def.name}, ${op?.men.length} men · F: ${did} — '${said}' · bangs ${DTL.bangs}`);
    let bangAt: number[] | null = null; T.secs(40, () => { if (!bangAt && op.bangAt) bangAt = [...op.bangAt]; return !DTL.ops.includes(op); }); T.secs(8, () => R.state === 'secured' || !!R.result);
    F.verdict(inOrder(op, ['ordered', 'stacked', 'kick', 'toss:', 'bang · inside', 'go', 'cross:', 'in']) && !!bangAt && INSIDE(bangAt, OFFICE) && fd.lockBroken && DTL.bangs === 2,
      'stacked → the boot (the door is locked) → the can → it goes off INSIDE the hostage room → go → over the line → in, in that order', beats(op, t0).slice(0, 420));
    F.verdict(T.at('order:bang') === undefined && T.at('enter1') === undefined && R.entry === null && won(R) && up(R.hostages) === 2 && !T.bad,
      'it is the menu\'s order and none of F\'s (nothing of F\'s entry in the scenario\'s log) — and the room is taken with both hostages alive', `'${R.summary().slice(0, 170)}'`);
    R.stop(); }
  // ---- the captor's clock under that can, the room fight's daze at its default
  { const { T, R, g, DTL, O, fd } = await doorRig(33, { clock: true, resolveSpread: 0 }); const cap = R.hostiles[0];
    const daze = JSON.stringify(FIGHT_SKILL.hostile.daze);
    T.secs(2); const r0 = R.resolve; T.secs(1); const rising = R.resolve - r0;
    const w = O.give('bangClear', O.targetAt(fd.frameCentre), 'all'); const op = DTL.ops[0];
    let lo = Infinity, hi = -Infinity, frames = 0, before = NaN, after = NaN, afterN = 0;
    T.secs(30, () => { const dz = g.time < cap.dazzledUntil && cap.state !== 'dead';
      if (dz) { if (!frames) before = R.resolve; frames++; lo = Math.min(lo, R.resolve); hi = Math.max(hi, R.resolve); }
      else if (frames && cap.state !== 'dead' && afterN < 60) { afterN++; after = R.resolve; }
      return !DTL.ops.includes(op) && (cap.state === 'dead' || afterN >= 60); });
    const byCan = !isNaN(beatT(op, 'bang · inside')) && frames > 0;
    F.verdict(w === null && daze === '[1,2]' && rising > 0.01 && byCan && frames >= 20 && hi - lo < 1e-9, 'the captor dazzled by the door tools\' can (the room fight\'s daze at its default): his clock was running, and stands still for every frame he is dazzled',
      `FIGHT_SKILL.hostile.daze ${daze} · resolve +${rising.toFixed(3)} in the second before the order · dazzled ${(frames * DT).toFixed(1)} s: resolve ${f1(lo * 100)} % → ${f1(hi * 100)} % (moved ${(hi - lo).toExponential(1)}) · ${cap.state === 'dead' ? 'he was shot before it wore off' : `a second after it wore off: ${before.toFixed(3)} → ${after.toFixed(3)}`}`);
    F.verdict(cap.state === 'dead' || after > before, 'and it runs again once he can see (or he did not live to)', `captor ${cap.state} · step ${R.clockStep} · hostages ${up(R.hostages)}/2`);
    R.stop(); }
  // ---- X, 5, 3: a charge from the menu on the corridor door; F is its trigger
  { const { T, R, g, DTL, O, fd } = await doorRig(34); const t0 = g.time;
    pick(T.W, () => T.step(), fd.frameCentre, 5, 3); const op = DTL.ops[0];
    const armed = T.secs(40, () => op?.phase === 'armed'); const c1 = DTL.charges; T.secs(5);
    const quiet = Math.abs(fd.angle) < 0.05 && fd.latched && !fd.lockBroken && DTL.set.length === 1 && R.ops.every((o: any) => !INSIDE(o.char.pos, OFFICE)) && isNaN(beatT(op, 'blow'));
    F.verdict(!!op && op.kind === 'charge' && armed && c1 === 1 && quiet, 'X, 5, 3: a man at the lock, the charge on the door (one of two spent), the pair stood off — and five seconds of nothing: no blast until Sam says', `${beats(op, t0)} · charges ${c1} · door ${fd.angle.toFixed(2)} rad latched ${fd.latched}`);
    T.press('KeyF'); T.step(2);
    const blown = DTL.set.length === 0 && !isNaN(beatT(op, 'blow')) && fd.lockBroken;
    F.verdict(blown && R.entry === null && T.at('order:bang') === undefined && DTL.bangs === 3, 'F is the trigger: the charge blows, and the rescue\'s own F order does not get the press (no entry of F\'s, no can spent)', `${beats(op, t0).split(' | ').slice(-2).join(' | ')} · entry ${R.entry ? 'F\'s' : 'none'} · bangs ${DTL.bangs}`);
    let swung = Math.abs(fd.angle); T.secs(30, () => { swung = Math.max(swung, Math.abs(fd.angle)); return !DTL.ops.includes(op); }); T.secs(8, () => R.state === 'secured' || !!R.result);   // (the leaf's widest: its closer has it shut again behind them)
    F.verdict(inOrder(op, ['set', 'armed', 'blow', 'go', 'in']) && swung > 0.6 && won(R) && up(R.hostages) === 2, 'the leaf is in and the men go in behind it; the room is taken, both hostages alive (a charge on a door stuns: the scenario\'s rounds pass them)', `${beats(op, t0).slice(0, 300)} · the leaf swung ${swung.toFixed(2)} rad · '${R.summary().slice(0, 120)}'`);
    R.stop(); }
  // ---- a charge on each door, one man each; one F for both
  { const { T, R, g, DTL, O, fd, sd } = await doorRig(35, {}, WEST); const t0 = g.time;
    g.doors.kickIn(g.doors.byName('server'), [17.6, 0, 11.0], g.player.char.id); T.secs(0.6);
    const w0 = O.give('charge', O.targetAt(fd.frameCentre), 0), w1 = O.give('charge', O.targetAt(sd.frameCentre), 1);
    const opF = DTL.ops.find((o: any) => o.door === fd), opS = DTL.ops.find((o: any) => o.door === sd);
    const armed = T.secs(60, () => opF?.phase === 'armed' && opS?.phase === 'armed'); T.secs(1);
    F.verdict(w0 === null && w1 === null && armed && DTL.set.length === 2 && DTL.charges === 0 && DTL.linked.includes(fd) && DTL.linked.includes(sd) && INSIDE(opS.men[0].char.pos, SERVER),
      'the menu\'s charge to one man on the corridor door and to the other on the side door (from the server room\'s floor): both set, both men stood off, the squad\'s two charges spent', `front: ${w0 ?? 'given'} · side: ${w1 ?? 'given'} · set ${DTL.set.length} · charges ${DTL.charges} · side man at ${opS?.men[0].char.pos.map((v: number) => v.toFixed(1))}`);
    T.press('KeyF'); T.step(2);
    const bF = beatT(opF, 'blow'), bS = beatT(opS, 'blow');
    F.verdict(DTL.set.length === 0 && Math.abs(bF - bS) < 1e-9 && fd.lockBroken && Math.abs(sd.angle) > 0.2 && R.entry === null, 'ONE F: both charges blow on the same frame (the room\'s two doors are linked for the scenario), both leaves in', `blown at ${(bF - t0).toFixed(2)} / ${(bS - t0).toFixed(2)} s · corridor door ${fd.angle.toFixed(2)} rad · side door ${sd.angle.toFixed(2)} rad`);
    T.secs(30, () => !DTL.ops.includes(opF) && !DTL.ops.includes(opS)); T.secs(8, () => R.state === 'secured' || !!R.result);
    const gF = beatT(opF, 'go'), gS = beatT(opS, 'go');
    F.verdict(!isNaN(gF) && !isNaN(gS) && Math.abs(gF - gS) < 0.3 && won(R) && up(R.hostages) === 2 && !T.bad, 'both men go in behind them, together, one by each door; the room is taken', `go ${(gF - t0).toFixed(2)} / ${(gS - t0).toFixed(2)} s · '${R.summary().slice(0, 140)}'`);
    R.stop(); }
  // ---- bang and clear on the side door alone, from the server room (two seeds: the second is the one that lost both men at the stack while the marks were in
  //      the corner past the latch — in the room's view through the open door)
  for (const seed of [36, 46]) { const { T, R, g, DTL, O, sd } = await doorRig(seed, {}, WEST); const t0 = g.time;
    g.doors.kickIn(g.doors.byName('server'), [17.6, 0, 11.0], g.player.char.id); T.secs(0.6);
    T.walkSam([17.6, 0, 11.2]); T.walkSam([17.6, 0, 8.8], 2.5); T.walkSam([19.2, 0, 9.3], 2.5); T.secs(4);
    const w = O.give('bangClear', O.targetAt(sd.frameCentre), 'all'); const op = DTL.ops[0]; let bangAt: number[] | null = null, atGo = -1;
    T.secs(40, () => { if (!bangAt && op?.bangAt) bangAt = [...op.bangAt]; if (atGo < 0 && !isNaN(beatT(op, 'go'))) atGo = up(R.ops); return !DTL.ops.includes(op); }); T.secs(8, () => R.state === 'secured' || !!R.result);
    F.verdict(w === null && !!op && op.door === sd && inOrder(op, ['ordered', 'stacked', 'shove', 'toss:', 'bang · inside', 'go', 'cross:', 'in']) && !!bangAt && INSIDE(bangAt, OFFICE) && !sd.lockBroken && DTL.bangs === 2 && atGo === 2 && won(R),
      `bang and clear on the side door from the server room (seed ${seed}): stacked on the marks → the leaf shoved (it is unlocked) → the can off inside the hostage room → both men still up at the go → in, the room taken`, `${w ?? beats(op, t0).slice(0, 360)} · up at the go ${atGo}/2 · at the end ${up(R.ops)}/2 · ${R.state}`);
    R.stop(); }
  // ---- one F, both doors
  { const { T, R, g, DTL, O, fd, sd } = await doorRig(40, {}, [8.2, 0, 11.2]);
    g.doors.kickIn(g.doors.byName('server'), [17.6, 0, 11.0], g.player.char.id); T.secs(0.6);
    O.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1); T.secs(14, () => INSIDE(R.ops[1].char.pos, SERVER) && dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
    T.press('KeyF'); const E = R.entry, ops = E?.ops.map((e: any) => e.op) ?? [];
    let atGo = -1; const oF = ops.find((o: any) => o.door === fd), oS = ops.find((o: any) => o.door === sd);
    T.secs(40, () => { if (atGo < 0 && !isNaN(beatT(oF, 'go')) && !isNaN(beatT(oS, 'go'))) atGo = up(R.ops); return !!T.at('clear') || !!R.result || (!!T.at('enter1') && g.time - T.at('enter1')! > 16); });
    const kF = beatT(oF, 'kick'), kS = beatT(oS, 'shove');
    F.verdict(ops.length === 2 && !!oF && !!oS && oF.kind === 'bangClear' && oS.kind === 'bangClear' && oF.gate === oS.gate && !!oF.gate && Math.abs(kF - kS) < 1e-9 && !isNaN(beatT(oF, 'bang · inside')) && !isNaN(beatT(oS, 'bang · inside')) && Math.abs(beatT(oF, 'go') - beatT(oS, 'go')) < 0.1 && DTL.bangs === 1 && atGo === 2,
      'one F with a man posted in the server room: two of the menu\'s bang and clears through one gate — both leaves on the same frame, a can through each, both men up at the go and in together', `up at the go ${atGo}/2 · front: ${beats(oF, R.t0).slice(0, 200)} · side: ${beats(oS, R.t0).slice(0, 200)} · bangs left ${DTL.bangs}`);
    F.verdict(T.order(['split:set', 'split:go', 'kick', 'door-flung', 'toss', 'bang', 'enter1']) && !!T.at('door-flung:side') && !!T.at('bang:side') && !!T.at('enter:side') && !T.bad, 'and the scenario\'s log reads it under its own names', R.log.filter((l: any) => /^(split|stacked|kick|door|toss|bang|enter|clear)/.test(l.what)).map((l: any) => `${f1(l.t - R.t0)} ${l.what}`).join(' · ').slice(0, 400));
    R.stop(); }
  // ---- one F, both doors, ONE can left: it is the corridor door's, and the side door's man goes in when the men behind it do (and RESCUE.opLights off is the door tools' men's switch too)
  { const { T, R, g, DTL, O, fd, sd } = await doorRig(40, { opLights: false }, [8.2, 0, 11.2]);
    g.doors.kickIn(g.doors.byName('server'), [17.6, 0, 11.0], g.player.char.id); T.secs(0.6);
    O.give('move', { kind: 'floor', at: [20.4, 0, 8.7] }, 1); T.secs(14, () => INSIDE(R.ops[1].char.pos, SERVER) && dist(R.ops[1].char.pos, [20.4, 0, 8.7]) < 1.2);
    DTL.bangs = 1; T.press('KeyF'); const E = R.entry, ops = E?.ops.map((e: any) => e.op) ?? [], lit: unknown[] = [];
    T.secs(40, () => { for (const o of ops) if (o.phase === 'enter') for (const m of o.men) { const A = o.mine.get(m); if (A?.there === 'holding the room') lit.push(A.light); }
      return !!T.at('clear') || !!R.result || (!!T.at('enter1') && g.time - T.at('enter1')! > 16); });
    const oF = ops.find((o: any) => o.door === fd), oS = ops.find((o: any) => o.door === sd), bang = beatT(oF, 'bang · inside'), goF = beatT(oF, 'go'), shS = beatT(oS, 'shove'), goS = beatT(oS, 'go');
    F.verdict(ops.length === 2 && oF?.kind === 'bangClear' && oS?.kind === 'openClear' && oF.gate === oS.gate && DTL.bangs === 0 && !isNaN(bang) && shS >= goF - 1e-9 && goS >= goF - 1e-9 && goS - goF < 0.5 && isNaN(beatT(oS, 'toss:')) && !T.bad,
      'with one can left one F still takes both doors: the can goes in by the corridor door, and the side door is not opened until the men behind the can go — then its man goes in with them, not into the flash', `front: ${beats(oF, R.t0).slice(0, 200)} · side: ${beats(oS, R.t0).slice(0, 160)} · bangs left ${DTL.bangs}`);
    F.verdict(lit.length > 0 && lit.every(x => x === false), 'the rescue\'s weapon-light switch off: the men the door tools send in go in dark (the night breach\'s switch is not asked)', `${lit.length} frames of a man on his point · lights ${[...new Set(lit)].join(' / ')}`);
    R.stop(); }
  // ---- what F does, from the panel's button: a set charge has the press there too; and two men sent to the side door one at a time do not get one mark
  { const { T, R, g, DTL, O, fd, sd } = await doorRig(37, {}, WEST);
    g.doors.kickIn(g.doors.byName('server'), [17.6, 0, 11.0], g.player.char.id); T.secs(0.6);
    const w = O.give('charge', O.targetAt(fd.frameCentre), 0), op = DTL.ops[0];
    const s0 = O.give('stack', O.targetAt(sd.frameCentre), 1), p1 = O.of(R.ops[1])?.post ? [...O.of(R.ops[1]).post] : null; T.secs(0.2);
    const armed = T.secs(40, () => op?.phase === 'armed'); const none = R.orderDoor(), c0 = DTL.set.length; const did = R.press(); T.step(2);
    F.verdict(w === null && armed && none === null && c0 === 1 && did === 'blow' && DTL.set.length === 0 && fd.lockBroken && R.entry === null && DTL.bangs === 3, 'the panel\'s F (rescue.press): the set charge blows — the rescue\'s own order, asked directly, leaves it be and spends nothing', `charge: ${w ?? 'given'} · orderDoor → ${none} with ${c0} set · press → ${did} · set ${DTL.set.length} · bangs ${DTL.bangs}`);
    const s1 = O.give('stack', O.targetAt(sd.frameCentre), 0), p0 = O.of(R.ops[0])?.post ? [...O.of(R.ops[0]).post] : null;
    F.verdict(s0 === null && s1 === null && !!p0 && !!p1 && dist(p0, p1) > 0.6 && INSIDE(p0, SERVER) && INSIDE(p1, SERVER), 'two men sent to stack on the side door one at a time: the second takes the mark the first is not on', `first man ${p1?.map((v: number) => v.toFixed(2))} (${s0 ?? 'given'}) · second ${p0?.map((v: number) => v.toFixed(2))} (${s1 ?? 'given'})`);
    R.stop(); }
  // ---- an order held stacked on a gate loses the man on the frame: the next one walks to that jamb before anything opens
  { const { T, R, g, DTL, fd } = await doorRig(38);
    const t0 = g.time, gate = DTL.together(false), op = DTL.order('bangClear', R.ops, fd, 1, gate); const ok = typeof op !== 'string';
    const set = ok && T.secs(30, () => !isNaN(op.readyT)); T.secs(2); const held = ok && op.phase === 'stack' && Math.abs(fd.angle) < 0.05 && fd.latched;
    const first = ok ? op.lead : null, jamb = ok ? [...op.post.get(first).pos] : [0, 0, 0];
    if (first) killGuard(g, first, [1, 0, 0], false, 'shot', 'guard'); T.step(3);
    const passed = ok && op.lead !== first && isNaN(op.readyT) && !isNaN(beatT(op, 'lead now')) && op.phase === 'stack';
    const again = ok && T.secs(20, () => !isNaN(op.readyT)), at = ok ? dist(op.lead.char.pos, jamb) : NaN; T.secs(1); const still = Math.abs(fd.angle) < 0.05 && fd.latched;
    gate.go = true; T.secs(30, () => !DTL.ops.includes(op));
    F.verdict(ok && set && held && passed && again && at < 0.7 && still && inOrder(op, ['lead now', 'kick', 'toss:', 'bang · inside', 'go']) && op.beats.filter((b: any) => b.what === 'stacked').length === 2 && !T.bad,
      'a bang and clear held stacked on a gate, its lead shot: the other man takes the jamb before the word, and the door is opened and the can thrown from there', ok ? `${beats(op, t0).slice(0, 420)} · new lead ${at.toFixed(2)} m off the first one's mark` : String(op));
    R.stop(); }
  return F.done();
});
