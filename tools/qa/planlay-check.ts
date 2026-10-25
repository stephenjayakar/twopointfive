// X IS WHERE THE PLAN IS LAID (src/game/planlay.ts, PLANLAY.on): the order menu's 'wait for my word' row through the game's own input, headless.
//   bun run tools/qa/planlay-check.ts            (also `probes.ts planlay`, in family squadorders)
//   TPS_PROFILE=shipped bun run tools/qa/planlay-check.ts      — the same lines on the page's stand
// PASS / FAIL each: the room clear on the office with its squad of four (the last line: the pair), everybody under god mode — the lines are about what
// is LAID, DRAWN and SENT, not who wins. The menu is opened with its own key on the harness cursor, the row flipped and picked with their digits, the
// plan sent with the word's key; what is read back is the plan (SquadOrders.lay), the order book, the door tools' ops and what the overlay is handed
// (`floorPlan(g)`).
// PLANLAY_BREAK=1 = the switch left off and the same lines asked: they must fail (the two that still hold: the switch off, and the snapshot pair).
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';

const PL: any = await import(`${ROOT}/src/game/planlay.ts`);
const FP: any = await import(`${ROOT}/src/game/floorplan.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { PLANLAY, PLANLAY_STATS } = PL;
const { PLAN, floorPlan } = FP;

const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const BREAK = process.env.PLANLAY_BREAK === '1', VERBOSE = process.argv.includes('--verbose');
const F = 'KeyF', X = 'KeyX';

async function rig(seed: number, squad = 4) {
  const squad0 = NIGHTBREACH.squad; let W: any, why: any;
  try {
    Object.assign(NIGHTBREACH, { squad });
    Math.random = seeded(seed);
    W = await standUp();
    (await import(`${ROOT}/src/game/cmdring.ts`)).CMDRING.wholeSquad = false;   // (these lines lay a plan for one pair and then the other with the who key, outside plan mode, as the menu's plan was built: the rule that only plan mode picks a part of the squad is held off here and has its own lines, wholesquad-check)
    PLANLAY.on = !BREAK; PLANLAY.keep = true; PLANLAY.sticky = true; PLAN.on = true; PLAN.menuOnly = true;
    W.game.godMode = true;
    why = W.game.roomClear.start(seed);
  } finally { Object.assign(NIGHTBREACH, { squad: squad0 }); }
  const game = W.game, input = W.input;
  /** a restart, as Enter makes one — the staging told the same squad (the knob is the page's, put back at once) */
  const restart = () => { const s0 = NIGHTBREACH.squad; try { Object.assign(NIGHTBREACH, { squad }); game.restartEncounter(); for (let i = 0; i < 30; i++) { game.player.visibility = 0.05; W.step(DT); } } finally { Object.assign(NIGHTBREACH, { squad: s0 }); } for (const m of game.orders.squad()) m.god = true; };
  const R = { W, game, why, restart,
    get O(): any { return game.orders; },
    get team(): any[] { return game.orders.squad(); },
    step(n = 1) { for (let i = 0; i < n; i++) { game.player.visibility = 0.05; W.step(DT); } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    key(code: string) { input.pressed.add(code); R.step(); },
    /** the order menu, opened with its key on the harness cursor at p (true: it is up, on a target of that kind) */
    menuAt(p: number[], kind: string): boolean { W.cursorAt([p[0], p[1] ?? 0, p[2]]); R.step(2); if (game.orders.menu) R.key(X); R.key(X); return game.orders.menu?.target.kind === kind; },
    /** 'wait for my word', flipped with the key the HUD shows on its row — its digit, else the word's key (false: the row is not there, or no key flips it) */
    wait(want = true): boolean { const O = game.orders, M = O.menu; if (!M || !M.wordRow) return false; if (M.onWord === want) return true; const k = O.waitDigit(M); R.key(k ? `Digit${k}` : ORDERS.waitAlt); return !!O.menu && O.menu.onWord === want; },
    /** the key the HUD shows on the open menu's 'wait for my word' row */
    waitKeyShown(): string { return (game.orders.hud().menu?.rows ?? []).flatMap((r: any) => r.opts).find((o: any) => /^wait for my word/.test(o.text))?.key ?? ''; },
    /** the open menu's row for that order, picked with its digit (false: not listed) */
    row(id: string): boolean { const M = game.orders.menu, d = M?.rows.find((r: any) => r.id === id); if (!d) return false; if (d.key) R.key(`Digit${d.key}`); else game.orders.pick(M.rows.indexOf(d)); return true; },
    laid(): any[] { return game.orders.lay.laid; },
    drawn(): any[] { return floorPlan(game).laid as any[]; },
    hudF(): string { return (game.orders.hud().status?.[0]?.opts ?? []).find((o: any) => o.key === 'F' && /plan/.test(o.text))?.text ?? ''; },
    /** everybody back on Sam, nothing of the door tools running, nothing laid */
    home() { const O = game.orders; O.close(); O.lay.laid.length = 0; O.who = 'all'; O.give('fallIn', O.targetAt(game.player.char.pos), 'all'); R.until(() => game.doorTools.ops.length === 0, 40); R.step(60); },
  };
  R.step(30);
  for (const m of R.team) m.god = true;
  return R;
}
/** a spot of free floor a few metres off Sam that everybody can walk to */
function spotNear(R: any, from = 0): number[] | null {
  const O = R.O, s = R.game.player.char.pos, move = O.defs.find((d: any) => d.id === 'move');
  for (let i = from; i < from + 16; i++) for (const r of [3, 2.2, 4]) { const a = (i / 16) * Math.PI * 2, t = O.targetAt([s[0] + Math.sin(a) * r, 0, s[2] + Math.cos(a) * r]); if (t.kind === 'floor' && !t.thing && !t.wall && O.whyNot(move, t, O.men('all')) === null) return t.at; }
  return null;
}
function doorsNear(R: any): { d: any; t: any }[] {
  const s = R.game.player.char.pos, out: { d: any; t: any }[] = [];
  for (const d of [...R.game.doors.list].sort((a: any, b: any) => dist(a.frameCentre, s) - dist(b.frameCentre, s))) { const t = R.O.targetAt(d.frameCentre); if (t.kind === 'door' && t.door === d) out.push({ d, t }); }
  return out;
}
const places = (R: any) => R.team.map((m: any) => [m.char.pos[0], 0, m.char.pos[2]]);
const moved = (a: number[][], b: number[][]) => Math.max(...a.map((p, i) => dist(p, b[i])));

let fails = 0;
const line = (ok: boolean, name: string, detail: string) => { if (!ok) fails++; console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`); };

export async function planlayCheck(): Promise<boolean> {
  fails = 0;
  const keep = { on: PLANLAY.on, keep: PLANLAY.keep, sticky: PLANLAY.sticky, plan: PLAN.on, menuOnly: PLAN.menuOnly, rnd: Math.random };
  console.log(`planlay-check: X is where the plan is laid${BREAK ? '  (PLANLAY_BREAK: the switch is left off — the lines must fail)' : ''}`);
  try {
    const R = await rig(5), g = R.game, T = g.doorTools;
    if (R.why) { line(false, 'the room clear stands up', String(R.why)); return false; }
    const O = R.O, spot = spotNear(R);
    if (!spot) { line(false, 'a spot of floor to order them to', 'none'); return false; }

    // 1. X on the floor, 'wait for my word' on, 'move there': laid — nobody moves, nothing in the order book, the clock not started
    const log0 = O.log.length, at0 = places(R), parWas = !!g.par?.started;
    const up = R.menuAt(spot, 'floor'), rowUp = !!O.menu?.wordRow, shown = R.waitKeyShown(), on = R.wait(), words = (O.hud().menu?.rows ?? []).flatMap((r: any) => r.opts.map((o: any) => o.text)).find((x: string) => /^wait · move there/.test(x)) ?? '';
    const picked = R.row('move'); R.step(120);
    const L1 = R.laid(), drift = moved(at0, places(R)), noOrder = R.team.every((m: any) => O.of(m)?.order !== 'move');
    line(up && rowUp && (shown === '5' || shown === 'F') && on && !!words && picked && !O.menu && L1.length === 1 && L1[0].id === 'move' && L1[0].who.length === 4 && O.log.length === log0 && drift < 0.3 && noOrder && !g.par?.started && !parWas,
      "an order picked with 'wait for my word' on is laid: nobody moves and the order book is empty (so no clock has started)",
      `menu on ${up ? 'the floor' : O.menu?.target.kind ?? 'nothing'} · the row offered ${rowUp}, its key '${shown}' flips it ${on}, reads '${words}' · laid ${L1.length}${L1[0] ? ` (${L1[0].id} to ${L1[0].who.length})` : ''} · order book +${O.log.length - log0} · the furthest man moved ${drift.toFixed(2)} m in 2 s · par clock ${g.par?.data ? (g.par.started ? 'STARTED' : 'not started') : 'none on this level (its rule is the order book\'s first row)'}`);

    // 2. it is drawn in the order mode only: as it is laid it shows and goes out; with the menu up it is there, with each man's way; the HUD has the key
    {
      R.step(Math.round((PLAN.freshSecs + 0.5) * 60)); const gone = R.drawn().length, hud = R.hudF();
      if (VERBOSE) { const m = R.team[0], o = R.laid()[0]; console.log('   2:', JSON.stringify(o), 'path', JSON.stringify(g.col.nav.findPath(m.char.pos, [o.at[0], 0, o.at[2]], 3000)?.length ?? null), JSON.stringify(m.char.pos)); }
      const upAgain = R.menuAt(spot, 'floor'), sticky = !!O.menu?.onWord, inMode = R.drawn(), ways = inMode[0]?.ways.length ?? 0, k = inMode[0]?.k ?? 0, key = inMode[0]?.key ?? '';
      O.close(); R.step(2); const down = R.drawn().length;
      // (and as it is laid: a second one, read the frame after)
      const spot2 = spotNear(R, 5) ?? spot; R.menuAt(spot2, 'floor'); R.wait(); R.row('move'); R.step(2); const fresh = R.drawn(), kf = fresh[0]?.k ?? 0;
      line(gone === 0 && /plan/.test(hud) && upAgain && sticky && inMode.length === 1 && ways === 4 && k === 1 && key === 'F' && down === 0 && fresh.length === 1 && kf > 0 && R.laid().length === 1,
        'the plan is drawn only with the order menu up (and for a moment as it is laid); the HUD has the key that sends it',
        `menu down, ${PLAN.freshSecs + 0.5} s after: ${gone} drawn · HUD: '${hud}' · menu up: ${inMode.length} drawn, ${ways} ways, strength ${k}, key ${key} · the row already on: ${sticky} · menu down again: ${down} · just laid: ${fresh.length} drawn at ${kf.toFixed(2)} · laid ${R.laid().length} (the second replaced the first)`);
    }

    // 3. changed before the word: a man has one laid order — red's new one takes red off the old; an order given at once takes its men off the plan
    {
      const A = doorsNear(R).find(x => O.whyNot(O.defs.find((d: any) => d.id === 'stack'), O.forMen(x.t, O.men('red')), O.men('red')) === null);
      O.who = 'red'; const ok = !!A && (O.open(A.t), R.wait(), R.row('stack')); R.step(2);
      const two = R.laid().map((o: any) => `${o.id}:${o.who.length}`).join(' '), red = O.men('red').map((m: any) => m.callsign);
      const redOnce = red.every((c: string) => R.laid().filter((o: any) => o.who.includes(c)).length === 1);
      // (a scenario's own order — give() called, not picked — leaves the plan alone; the player's own, from the menu with the row flipped off, does not)
      O.give('hold', O.targetAt(g.player.char.pos), 'blue'); R.step(2); const scripted = R.laid().map((o: any) => `${o.id}:${o.who.length}`).join(' ');
      O.who = 'blue'; const sp3 = spotNear(R, 9) ?? spot, m3 = R.menuAt(sp3, 'floor'), wasOn = !!O.menu?.onWord, off = R.wait(false); R.row('hold'); R.step(2);
      const after = R.laid().map((o: any) => `${o.id}:${o.who.length}`).join(' ');
      // (a man down is off the plan the next frame; an order nobody is left on is gone, and with it the key's line)
      const reds = O.men('red'); for (const m of reds) m.state = 'dead'; R.step(2); const dead = R.laid().length, hud = R.hudF(); for (const m of reds) m.state = 'idle'; R.step(2);
      line(ok && two === 'move:2 stack:2' && redOnce && scripted === two && m3 && wasOn && off && after === 'stack:2' && dead === 0 && hud === '',
        'a man has one laid order: a new one replaces it; an order the player gives at once takes its men off the plan (a scripted one does not); a man down is off it',
        `all laid a move, then red a stack: ${two || 'nothing'} · a scripted hold for blue: ${scripted || 'nothing'} · the menu opened with the row on ${wasOn}, flipped off ${off}, blue told to hold: ${after || 'nothing'} · red down: ${dead} laid, HUD '${hud}'`);
      R.home();
    }

    // 4. the word's key sends the plan: two door tools laid for the two pairs — on F both walk to their doors and wait; F again and both go
    {
      const tool = (id: string) => O.defs.find((d: any) => d.id === id), fits = (id: string, who: string, x: any) => O.whyNot(tool(id), O.forMen(x.t, O.men(who)), O.men(who)) === null;
      const near = doorsNear(R).filter(x => !x.d.locked), a = near.find(x => fits('openClear', 'red', x)), b = near.find(x => x !== a && fits('openClear', 'blue', x));
      const layTool = (who: string, x: any) => { O.who = who; O.open(x.t); const pg = O.menu.rows.findIndex((r: any) => !!r.opens && O.rowsFor(O.menu.target, r.opens, O.menu.men).some((d: any) => d.id === 'openClear')); if (pg >= 0) O.pick(pg); R.wait(); return R.row('openClear'); };
      const ok = !!a && !!b && layTool('red', a) && layTool('blue', b); R.step(30);
      const laid = R.laid().length, log1 = O.log.length, at1 = places(R), still = T.ops.length === 0;
      O.who = 'all'; R.key(F); R.step(2);
      const sent = O.log.slice(log1), stamped = sent.filter((r: any) => r.laid).length, left = R.laid().length, ops = T.ops.filter((o: any) => o.onWord).length;
      const waits = () => !!a && !!b && [a, b].every(x => T.ops.some((o: any) => o.door === x.d && o.phase === 'ready'));
      const ready = R.until(() => !!a && !!b && [a, b].every(x => T.ops.some((o: any) => o.door === x.d && o.onWord && o.phase === 'ready')), 40), walked = moved(at1, places(R));
      if (VERBOSE) console.log('   4 before the word:', T.summary(), '|', T.ops.map((o: any) => `${o.door.def.name} onWord ${o.onWord} word ${!!o.word} phase ${o.phase}`).join(' · '), '| msgs', JSON.stringify((g.messages ?? []).slice(-6).map((m: any) => m.text)));
      const before = waits(); R.key(F); R.step(2); const go = O.log[O.log.length - 1], went = !!a && !!b && R.until(() => [a, b].every(x => !T.ops.some((o: any) => o.door === x.d && (o.phase === 'ready' || o.phase === 'stack'))), 5);
      if (VERBOSE) console.log('   4:', JSON.stringify(O.log.slice(log1).map((r: any) => `${r.order} ${r.who.join('+')} ${r.target}${r.laid ? ' laid' : ''}`)), T.summary());
      line(ok && laid === 2 && still && sent.length === 2 && stamped === 2 && left === 0 && ops === 2 && ready && walked > 1 && before && went && go?.order === 'go' && go.who.length === 4,
        'F sends the plan: two doors laid for the two pairs are two stacks, and F again sends both in on one word',
        ok ? `laid ${laid}, nothing running ${still} · F: ${sent.map((r: any) => `${r.order} to ${r.who.length}`).join(', ') || 'nothing'} (${stamped} stamped), ${left} left laid, ${ops} tools on the word · both ready ${ready} after walking ${walked.toFixed(1)} m · F again: ${went ? 'both went' : 'STILL waiting'} (${go?.order} to ${go?.who.length})` : `no two doors the pairs can open (${a ? 'one' : 'none'})`);
      R.until(() => T.ops.length === 0, 60); R.home();
      // 4b. men ALREADY stacked on the door: the tool laid for them goes on the one press — there is nothing to walk to, so that press is the word
      O.who = 'red'; const sOk = !!a && O.give('stack', a.t, 'red') === null, set = sOk && R.until(() => T.waitsOn(O.men('red'), a!.d)?.set === true, 40);
      const lOk = set && layTool('red', a), log2 = O.log.length; R.step(60); const held = lOk && R.laid().length === 1 && T.ops.length === 0;
      R.key(F); R.step(2); const op1 = a ? T.ops.find((o: any) => o.door === a.d) : null, onWord = !!op1?.onWord, row1 = O.log[log2];
      const gone = !!op1 && R.until(() => !T.ops.some((o: any) => o.door === a!.d && (o.phase === 'ready' || o.phase === 'stack')), 6);
      line(set && held && !!op1 && !onWord && gone && row1?.laid === true && O.log.length === log2 + 1,
        'men already stacked on the door: the tool laid for them goes in on the one press of F', sOk ? `stacked ${set} · laid and waiting ${held} · F: ${op1 ? `${op1.kind}${onWord ? ', STILL on the word' : ''}` : 'no op'}, ${gone ? 'gone in' : 'NOT gone'} · order book +${O.log.length - log2}` : 'red cannot stack on it');
      R.until(() => T.ops.length === 0, 60); R.home();
    }

    // 5. it survives a restart: the plan as first sent in the try is laid again for the fresh cast; with `keep` off a try starts with nothing
    {
      R.restart();
      const O2 = R.O, back = R.laid().map((o: any) => `${o.id}:${o.who.length}:${o.kind}`).join(' '), stats = PLANLAY_STATS.relaid, at2 = places(R), logA = O2.log.length;
      R.step(90); const idle = moved(at2, places(R)) < 0.3 && T.ops.length === 0;
      R.key(F); R.step(5); const again = O2.log.slice(logA).filter((r: any) => r.laid).length, ops = T.ops.length;
      PLANLAY.keep = false; R.restart(); const none = R.laid().length; PLANLAY.keep = true;
      line(back === 'openClear:2:door openClear:2:door' && stats >= 1 && idle && again === 2 && ops === 2 && none === 0,
        'the plan survives a restart: laid again for the fresh cast, nobody moving, and F sends it as before', `after the restart: ${back || 'nothing laid'} · nobody moved ${idle} · F: ${again} sent, ${ops} tools running · with keep off: ${none} laid`);
      R.until(() => T.ops.length === 0, 60);
    }

    // 6. the pair of state functions: what is laid and kept comes back as it was, and the fresh cast a load stands up leaves it be
    {
      const O3 = R.O; O3.lay.laid.length = 0; O3.lay.kept = null;
      const s0 = { laid: [{ id: 'move', who: ['Red One'], kind: 'floor', at: [1, 0, 2], t: 3 }], kept: [{ id: 'stack', who: ['Blue One', 'Blue Two'], kind: 'door', at: [4, 0, 5], door: 1, t: 0 }], keptFor: 'x', started: true };
      const on0 = PLANLAY.on; PLANLAY.on = true;
      PL.layRestore(g, JSON.parse(JSON.stringify(s0))); const snap = PL.laySnapshot(g); PL.layFresh(g); const held = JSON.stringify(PL.laySnapshot(g)) === JSON.stringify(snap);
      R.step(12); PL.layFresh(g); const fresh = O3.lay.laid.length === 0 && O3.lay.kept === null;   // (a cast stood up later is a fresh try: and the kept plan was for another start — dropped)
      PL.layRestore(g, undefined); const bare = O3.lay.laid.length === 0 && O3.lay.started === false; PL.layClear(g); PLANLAY.on = on0;
      line(JSON.stringify(snap) === JSON.stringify(s0) && held && fresh && bare, 'snapshot / restore: the plan comes back as it was filed', `round trip ${JSON.stringify(snap) === JSON.stringify(s0)} · left be by the cast a load stands up ${held} · a later cast is a fresh try, a plan kept for another start dropped ${fresh} · a file with no slice: nothing laid ${bare}`);
    }

    // 7. the switch off: the row is the four's door tools' alone, and an order picked with it on is given at once, as it was
    {
      const on0 = PLANLAY.on; PLANLAY.on = false; R.home();
      const sp = spotNear(R) ?? spot, floorRow = R.menuAt(sp, 'floor') && !!R.O.menu?.wordRow; R.O.close();
      const O4 = R.O, x = doorsNear(R).find(y => O4.whyNot(O4.defs.find((d: any) => d.id === 'openClear'), O4.forMen(y.t, O4.men('red')), O4.men('red')) === null);
      let given = false, toolRow = false, len = O4.log.length;
      if (VERBOSE && !x) console.log('   7: no door:', doorsNear(R).slice(0, 4).map(y => `${y.d.def.name}: ${O4.whyNot(O4.defs.find((d: any) => d.id === 'openClear'), O4.forMen(y.t, O4.men('red')), O4.men('red'))}`).join(' · '), 'red', O4.men('red').length, 'squad', O4.squad().length);
      if (x) { O4.who = 'red'; O4.open(x.t); const pg = O4.menu.rows.findIndex((r: any) => !!r.opens && O4.rowsFor(O4.menu.target, r.opens, O4.menu.men).some((d: any) => d.id === 'openClear')); if (pg >= 0) O4.pick(pg); toolRow = !!O4.menu?.wordRow; if (VERBOSE) console.log('   7:', x.d.def.name, 'page', pg, 'menu', !!O4.menu, O4.menu?.page, (O4.menu?.rows ?? []).map((r: any) => `${r.id}${r.onWord ? '*' : ''}`).join(' '), 'big', O4.big, 'men', O4.menu?.men.length); R.wait(); R.row('openClear'); R.step(2); given = O4.log.length === len + 1 && O4.log[len].order === 'openClear' && T.ops.some((o: any) => o.door === x.d && o.onWord); }
      const nothing = R.laid().length === 0; len = O4.log.length; R.key(F); R.step(2); const word = O4.log.length === len + 1 && O4.log[len].order === 'go' && !O4.log[len].laid;
      PLANLAY.on = on0;
      line(!floorRow && toolRow && given && nothing && word, "the switch off: 'wait for my word' is the door tools' row, the men walk at once, F is the word — as it was", `the row on a floor menu ${floorRow} · on the door tools ${toolRow} · picked: given at once, on the word ${given} · laid ${R.laid().length} · F: ${word ? 'go' : 'NOT the word'}`);
      R.until(() => T.ops.length === 0, 60);
    }

    // 8. a wall's own order: found again by the wall when the plan is sent (asked where this stand has a wall to charge near the start; the squad handed one)
    {
      R.home(); const O5 = R.O, sam = g.player.char.pos; let wt: any = null;
      for (let r = 0.5; r < 8 && !wt; r += 0.1) for (let k = 0; k < 64 && !wt; k++) { const t = O5.targetAt([sam[0] + Math.sin(k / 64 * 6.2832) * r, 0, sam[2] + Math.cos(k / 64 * 6.2832) * r]); if (t.kind === 'floor' && t.wall?.ok) wt = t; }
      const WC = g.wallCharge, def = wt ? O5.defs.find((d: any) => d.id === 'wallCharge') : null;
      if (!wt || !def) line(PLANLAY.on, "a wall's own order is found again by its wall", 'no wall to charge near the start on this stand (its switch is off): not asked');
      else {
        const c0 = WC.carried, b0 = WC.brought; if (WC.carried !== null) { WC.carried = Math.max(1, WC.carried); WC.brought = Math.max(1, WC.brought); }
        const men = O5.men('red'), no = PLANLAY.on ? PL.layOrder(g, def, wt, men) : 'the switch is off', len = O5.log.length, o = R.laid()[0];
        R.key(F); R.step(2); const row = O5.log[len];
        line(no === null && o?.found === 'wall' && !!o.pick && row?.order === 'wallCharge' && row.laid === true, "a wall's own order is found again by its wall", `laid: ${no ?? 'yes'}${o ? ` (${o.found}, by a point ${dist(o.pick ?? o.at, o.at).toFixed(2)} m off the spot)` : ''} · F: ${row ? `${row.order}${row.laid ? ' off the plan' : ''}` : 'NOTHING given'}`);
        R.step(30); WC.carried = c0; WC.brought = b0; R.home();
      }
    }

    // 9. the pair: the row is theirs too — a stack laid, sent with F
    {
      const P = await rig(7, 2), OP = P.O;
      if (P.why) line(false, 'the pair: the room clear stands up', String(P.why));
      else {
        const x = doorsNear(P).find(y => OP.whyNot(OP.defs.find((d: any) => d.id === 'stack'), OP.forMen(y.t, OP.men('all')), OP.men('all')) === null), len = OP.log.length;
        const ok = !!x && (OP.open(x.t), P.wait(), P.row('stack')); P.step(60);
        const laid = P.laid().length, quiet = OP.log.length === len; P.key(F); P.step(5);
        const row = OP.log[OP.log.length - 1], sent = OP.log.length === len + 1 && row.order === 'stack' && row.laid === true && P.laid().length === 0;
        line(ok && laid === 1 && quiet && sent, 'the pair: a stack laid on a door waits, and F sends it', ok ? `laid ${laid}, order book +${quiet ? 0 : 1} · F: ${row?.order}${row?.laid ? ' (off the plan)' : ''} to ${row?.who?.length}` : 'no door they can stack on');
      }
    }

    // 10. a door found shut under the laid plan (doortools.ts haltAt): a tool laid on a door nobody knew was locked, sent — the lead tries the handle, says
    //     so, and its men are left the plain stack the halt leaves; the same men on the same marks as the row given at once with the switch off
    {
      const shut = async (laid: boolean) => {
        const on0 = PLANLAY.on, test0 = DOORTOOLS.testDoor; const Q = await rig(5); PLANLAY.on = laid; DOORTOOLS.testDoor = true;   // (the handle's test is the page's; the frozen stand holds it off — raised here as the rig raises the lay)
        const OQ = Q.O, TQ = Q.game.doorTools, said: string[] = [], say = Q.game.say.bind(Q.game);
        Q.game.say = (gd: any, text: string, ...rest: any[]) => { said.push(text); return say(gd, text, ...rest); };
        const tool = OQ.defs.find((d: any) => d.id === 'openClear'), x = doorsNear(Q).find(y => y.d.locked && OQ.whyNot(tool, OQ.forMen(y.t, OQ.men('red')), OQ.men('red')) === null);
        if (!x) { PLANLAY.on = on0; DOORTOOLS.testDoor = test0; return null; }
        OQ.who = 'red'; OQ.open(x.t); const pg = OQ.menu.rows.findIndex((r: any) => !!r.opens && OQ.rowsFor(OQ.menu.target, r.opens, OQ.menu.men).some((d: any) => d.id === 'openClear')); if (pg >= 0) OQ.pick(pg);
        const h0 = TQ.stats.halted, on = Q.wait(), picked = on && Q.row('openClear'); Q.step(30);
        const waited = Q.laid().length, idle = TQ.ops.length === 0; if (waited) { OQ.who = 'all'; Q.key(F); Q.step(2); }
        const halted = Q.until(() => TQ.stats.halted > h0, 40); Q.step(240);
        const men = OQ.men('red').map((m: any) => { const A = OQ.of(m); return { order: A?.order ?? '-', door: A?.door?.def.name ?? '-', post: A?.post ? [A.post[0], 0, A.post[2]] : null, pos: [m.char.pos[0], 0, m.char.pos[2]] }; });
        const out = { door: x.d.def.name as string, picked, waited, idle, halted, ops: TQ.ops.filter((o: any) => o.door === x.d).length, line: said.find(t => /holding on it/.test(t)) ?? '', men };
        PLANLAY.on = on0; DOORTOOLS.testDoor = test0; return out;
      };
      const A = PLANLAY.on ? await shut(true) : null, B = await shut(false);
      const stacked = (r: any) => r.men.length === 2 && r.men.every((m: any) => m.order === 'stack' && m.door === r.door && !!m.post && dist(m.pos, m.post) < 0.6);
      const same = !!A && !!B && A.men.every((m: any, i: number) => !!m.post && !!B.men[i].post && dist(m.post, B.men[i].post) < 0.05);
      line(!!A && !!B && A.picked && A.waited === 1 && A.idle && A.halted && A.ops === 0 && !!A.line && stacked(A) && B.waited === 0 && B.halted && stacked(B) && A.line === B.line && same,
        'a door found shut under the laid plan: the lead tries it, says so, and the pair is left the plain stack — the marks the row given at once leaves',
        A && B ? `${A.door}: laid ${A.waited}, nothing running ${A.idle} · sent: halted ${A.halted} ('${A.line}'), ${A.ops} tools left on it, ${A.men.map((m: any) => `${m.order} ${m.door}`).join(' + ')} · the switch off, given at once: halted ${B.halted}, ${B.men.map((m: any) => `${m.order} ${m.door}`).join(' + ')} · the same marks ${same}` : !B ? 'no locked door near the start that the pair may be sent to open' : 'the switch is off: nothing is laid');
    }

    // 11. a stack refused for Sam's own body (orders.ts ORDERS.inWay) under the lay: the barracks' sg_w with Sam on the last of the four places — the lay is
    //     refused in the order's own words (the stand's: in the way with the key on, no room with it off), nothing is laid; Sam off it, it is laid and F sends it
    {
      const BT: any = await import('./bang-tally.ts'), RF: any = await import(`${ROOT}/src/game/roomfight.ts`), { killGuard } = await import(`${ROOT}/src/game/combat.ts`), { IN_WAY_WORDS } = await import(`${ROOT}/src/game/orders.ts`);
      const rally0 = RF.ROOMFIGHT.rally, mute = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, e = console.error, w = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; } };
      const S: any = await mute(() => BT.stage('barracks-four', 1)); RF.ROOMFIGHT.rally = rally0; PLANLAY.on = !BREAK;
      const gb = S.g, OB = gb.orders, d = gb.doors.byName('sg_w'), side = 1 as const, nav = gb.col.nav;
      for (const x of gb.guards) if (x.state !== 'dead' && x.team === 'hostile') await mute(() => killGuard(gb, x, [0, 0, 1], true));
      const team: any[] = OB.squad().filter((x: any) => x.state !== 'dead'), said: string[] = [], say = gb.say.bind(gb); gb.say = (gd: any, text: string, ...rest: any[]) => { said.push(text); return say(gd, text, ...rest); };
      const th = d.def.closedDir, u = [Math.cos(th), Math.sin(th)], n = [-u[1] * side, u[0] * side], c = d.frameCentre, at = (b: number, l: number): number[] => [c[0] + n[0] * b + u[0] * l, 0, c[2] + n[1] * b + u[1] * l];
      const gate = at(0.7, 0), spots: number[][] = [];
      for (const back of [2.4, 3.2, 4.2, 1.6]) for (const lat of [3.5, -3.5, 4.5, -4.5, 2.6, -2.6, 5.5, -5.5, 1.5, -1.5, 0.4]) { const p = at(back, lat); if (nav.isBlocked(p[0], p[2]) || spots.some(q => dist(q, p) < 0.8)) continue;
        const path = nav.findPath(p, gate); if (!path || !path.length) continue; let len = 0, q = p; for (const w of path) { len += dist(q, w); q = w; } if (len < 9) spots.push(p); }
      team.forEach((gd, i) => { const p = spots[i]; if (!p) return; gd.char.pos[0] = p[0]; gd.char.pos[2] = p[2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; });
      await mute(() => gb.teleportPlayer([1e4, 0, 1e4] as any)); const posts: number[][] = (OB.stackPostsWait(d, side, team) ?? []).map((P: any) => [P.pos[0], 0, P.pos[2]]);
      const aside = spots.slice(team.length).find(p => posts.every(q => dist(p, q) >= 1.5)), last = posts[posts.length - 1];
      if (spots.length < team.length + 1 || !last || !aside) line(false, "a stack refused for Sam's own body is refused at the lay", `sg_w: ${spots.length} spots, ${posts.length} places with Sam away, ${aside ? 'a' : 'no'} spot off them for him`);
      else {
        const stack = OB.defs.find((x: any) => x.id === 'stack'), t = { kind: 'door', at: [c[0], 0, c[2]], door: d, side }, want = ORDERS.inWay ? IN_WAY_WORDS : 'no room on that door.';
        await mute(() => gb.teleportPlayer([last[0], 0, last[2]] as any)); const r0 = PLANLAY_STATS.refused, n0 = said.length;
        const no = PLANLAY.on ? PL.layOrder(gb, stack, t, team) : 'the switch is off', heard = said.slice(n0), none = OB.lay.laid.length === 0, counted = PLANLAY_STATS.refused === r0 + 1;
        await mute(() => S.step(60)); const unmoved = team.every((m: any) => OB.of(m)?.order !== 'stack');
        await mute(() => gb.teleportPlayer([aside[0], 0, aside[2]] as any));
        const yes = PLANLAY.on ? PL.layOrder(gb, stack, t, team) : 'the switch is off', laid = OB.lay.laid.length, len = OB.log.length; OB.who = 'all';
        S.W.input.pressed.add(F); await mute(() => S.step(5)); const row = OB.log[len], dealt = team.filter((m: any) => OB.of(m)?.order === 'stack' && OB.of(m)?.door === d).length;
        line(no === want && heard.length === 1 && heard[0] === want && none && counted && unmoved && yes === null && laid === 1 && row?.order === 'stack' && row.laid === true && dealt === team.length,
          "a stack refused for Sam's own body is refused at the lay, in the order's own words; Sam off the place, it is laid and F sends it",
          `sg_w, Sam on the last of ${posts.length} places: lay → ${no === null ? 'LAID' : `refused "${no}"`} (the stand's words: "${want}") · said: ${heard.join(' / ') || 'nothing'} · ${none ? 'nothing' : 'SOMETHING'} left laid · Sam aside: ${yes === null ? 'laid' : `refused "${yes}"`} · F: ${row ? `${row.order}${row.laid ? ' (off the plan)' : ''}` : 'nothing'}, ${dealt} of ${team.length} dealt a place`);
        OB.lay.laid.length = 0;
      }
    }
  } finally { Object.assign(PLANLAY, { on: keep.on, keep: keep.keep, sticky: keep.sticky }); PLAN.on = keep.plan; PLAN.menuOnly = keep.menuOnly; Math.random = keep.rnd; }
  console.log(fails ? `=== planlay-check: ${fails} FAIL ===` : '=== planlay-check: ALL PASS ===');
  return fails === 0;
}

if (import.meta.main) process.exit((await planlayCheck()) ? 0 : 1);
