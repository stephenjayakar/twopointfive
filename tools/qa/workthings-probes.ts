// The `workthings` probes (src/game/workthings.ts: a teammate is sent to work the breaker, or the mission's thing) — `bun run tools/qa/probes.ts workthings`,
// or one of work-breaker / work-four / work-objective / work-edges / work-posted / work-face / work-held / work-defuse / work-off / work-harness. All headless on the real Game (nothing is drawn: the menu is read as the data
// the panel is built from), every order given THROUGH THE INPUT as the page writes it — the harness cursor on the thing, then one-frame presses. WORK.on is
// raised by the probe itself: the frozen stand holds it off (TPS_WORKTHINGS=1).
//   work-breaker    the room clear's pair on the office: X with the cursor on the breaker panel lists the thing's own order on digit 1 where 'move there' is
//                   on floor, no row on a digit above 5; 1 gives it — one man walks to the panel (never sprinting), squares to it, puts a hand on it and the
//                   mains go; his partner covers behind him; he then HOLDS by the panel and the breaker STAYS thrown (a teammate standing by it does not re-arm
//                   it, and the 'go and check it' errand is not handed to a teammate); then B on the panel is 're-arm the mains', and he puts them back
//   work-four       the squad of four: the order to all goes to ONE pair — one works, one covers — and the other pair is left exactly as it was
//   work-objective  a quiet mission with a partner: once the objective is to take the thing, X on its holder lists 'take …' on 1, the partner goes and takes
//                   it (the mission moves on to the way out, in the level's own words); before that stage the holder is plain floor
//   work-edges      what is NOT the breaker (the top of its wall, the next room's floor behind it, a metre in front), Sam standing at it with the cursor on
//                   himself is himself, and a man the orders stop short of it holds where he is: the breaker is not thrown from there
//   work-defuse     a mission's charge (defuse.ts): sent to it he makes it safe and says so; the run ending under his hand (Sam down) leaves the charge armed,
//                   and he neither says 'charge is safe.' nor is a job counted done; the same for a quiet mission's partner with his hands in the holder
//                   (he does not take it, and does not say it is already gone)
//   work-held       the squad's fire held and a defender who has noticed nobody stood in plain sight of the panel: the man sent still throws the breaker (his
//                   partner's gun on that man, no round fired), his footfalls turn nobody at the panel, and the moment that man notices he is the squad's to shoot again. Asserts the fault with
//                   WORK.heldPass off (his muzzle stays on the man, the mains stay on); WORKHELD_BREAK=1 leaves the rule off for the rule's own lines: must fail
//   work-off        the switch off: the menu on the panel is the floor's (or nothing), the order cannot be given, no thing is listed
//   work-harness    the frozen stand holds it off, the page turns it on unless ?noworkthings, the table is a registered knob table a recording carries
import { readFileSync, readdirSync } from 'node:fs';
import { standUp, ROOT } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { WORK, WORK_STATS, workHand, workJob, breakerErrand, workPasses } = await import(`${ROOT}/src/game/workthings.ts`);
const { HOLDFIRE } = await import(`${ROOT}/src/game/holdfire.ts`);
const { breakerResetNear } = await import(`${ROOT}/src/game/lighting.ts`);
const { NIGHTBREACH } = await import(`${ROOT}/src/game/nightbreach.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { quietWords } = await import(`${ROOT}/src/game/quiet.ts`);
const { ORDERS } = await import(`${ROOT}/src/game/orders.ts`);
const { killGuard, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);

const DT = 1 / 60, VERBOSE = !!process.env.WORK_VERBOSE;
let allPass = true;
const verdict = (pass: boolean, what: string, detail = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!pass) allPass = false; };
const f2 = (x: number) => x.toFixed(2), flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
function seeded(seed: number) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** one game with a scenario staged and the switch as asked; step() keeps Sam dark and the other side dazzled (this is about the order, not the fight) */
async function rig(stage: (g: any) => string | null | undefined, on = true, squad: 2 | 4 = 2, level: string | null = null) {
  Math.random = seeded(21); const was = NIGHTBREACH.squad; NIGHTBREACH.squad = squad;
  const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = () => { };
  let W: any, why: string | null | undefined;
  try { W = await standUp(level ? { level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${level}.json`, 'utf8'))), seed: 1 } : undefined); W.game.godMode = true; WORK.on = on; why = stage(W.game); } finally { console.log = log; console.warn = warn; console.error = err; NIGHTBREACH.squad = was; }
  const g = W.game, input = W.input, O = g.orders, said: string[] = [];
  { const om = g.msg.bind(g); g.msg = (t: string) => { said.push(t); return om(t); }; const os = g.say.bind(g); g.say = (gd: any, t: string, r?: boolean) => { said.push(`${gd.callsign}: ${t}`); return os(gd, t, r); }; }
  const R = { W, g, input, O, why, said, aim: null as number[] | null, held: 0, fastest: 0, handUp: new Set<string>(), jobs: new Map<string, { verb: string; secs: number; need: number; bad: number }>(),
    step(n = 1) { const l = console.log; if (!VERBOSE) console.log = () => { };
      try { for (let i = 0; i < n; i++) {
        g.player.visibility = 0.05; for (const gd of g.guards) if (gd.team !== 'operative' && gd.state !== 'dead') gd.dazzledUntil = g.time + 5;
        if (R.aim) W.cursorAt([R.aim[0], R.aim[1], R.aim[2]]);
        R.held = Math.max(R.held, input.keys.size + (input.buttons ? 1 : 0));
        W.step(DT);
        for (const gd of O.squad()) { R.fastest = Math.max(R.fastest, Math.hypot(gd.char.vel[0], gd.char.vel[2])); // (the hand as the module gives it out — whichever layer of the animator poses it — and the read that goes with it)
          const wh = workHand(g, gd.char), wj = workJob(g, gd.char);
          if (wh && wh.w > 0 && g.work.working(gd)) R.handUp.add(gd.callsign);
          if (!!wh !== !!wj) { const o = R.jobs.get(gd.callsign) ?? { verb: '', secs: 0, need: 0, bad: 0 }; o.bad++; R.jobs.set(gd.callsign, o); }
          if (wh && wj && wh.w > 0) { const o = R.jobs.get(gd.callsign) ?? { verb: wj.verb, secs: 0, need: wj.need, bad: 0 }; if (wj.secs + 1e-9 < o.secs && wj.verb === o.verb) o.bad++; o.verb = wj.verb; o.secs = wj.secs; o.need = wj.need; R.jobs.set(gd.callsign, o); } } } } finally { console.log = l; } },
    until(pred: () => boolean, secs: number) { for (let i = 0; i < secs * 60 && !pred(); i++) R.step(); return pred(); },
    press(code: string) { input.pressed.add(code); R.step(); },
    rows(): any[] { return O.menu ? O.menu.rows : []; },
    last(): any { return O.log[O.log.length - 1] ?? null; },
    /** the men called to Sam first (X on himself, 3), so an order finds them with a way to go, as in play */
    gather(secs = 6) { const p = g.player.char.pos; R.aim = [p[0], 0.9, p[2]]; R.step(2); R.press('KeyX'); R.press('Digit3'); R.step(secs * 60); R.aim = null; },
  };
  R.step(20);
  return R;
}
async function keep(fn: () => Promise<void>): Promise<boolean> {
  const was = { ...WORK }; allPass = true;
  try { await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); allPass = false; }
  finally { Object.assign(WORK, was); }
  return allPass;
}
/** the office's storage room (where its breaker is) unlocked, as a kicked or picked lock leaves it */
const unlock = (g: any) => { const d = g.doors.list.find((x: any) => x.def.name === 'storage'); if (d) d.locked = false; };
/** the middle of the breaker's own panel: where a player's cursor is when it is on the thing as drawn */
const panel = (g: any): number[] => [...g.engine.world.statics[g.level.breaker.boxes[0]].c];
/** the camera turned (the player's Q / E) to look AT the panel's face: on the office the stock view is from the far side of its wall, where it is not drawn */
const lookAtPanel = (R: any) => { R.W.cam.yaw = Math.PI; R.step(20); };
const menuWords = (R: any) => R.rows().map((d: any) => `${d.key ?? '·'} ${d.id}`).join(' | ');
const labelOf = (R: any, d: any) => typeof d.label === 'string' ? d.label : d.label(R.O.menu.target);

export const workBreaker = () => keep(async () => {
  console.log('\n=== work-breaker: the pair is sent to the breaker, throws it, holds; then re-arms it ===');
  const R = await rig(g => { g.fogOfWar.on = true; return g.roomClear.start(21); });
  const { g, O } = R; const bp = g.level.breaker.pos, ops: any[] = O.squad();
  verdict(!R.why && ops.length === 2, 'staged: the room clear on the office with its pair', `refusal ${R.why} · teammates ${ops.map(o => o.callsign).join(', ')}`);
  R.gather(); lookAtPanel(R);
  // the office keeps its breaker behind the storage room's LOCKED door: with it locked the row is there, greyed, in the man's own words
  { R.aim = panel(g); R.step(2); R.press('KeyX'); const i = R.rows().findIndex((d: any) => d.id === 'work'), why = O.menu?.why[i] ?? null; O.close(); R.aim = null;
    verdict(i === 0 && typeof why === 'string' && /locked/.test(why), 'behind a locked door the row is listed greyed, with why: the men cannot get to it', `row ${i} · "${why}"`); }
  unlock(g); R.step(70);
  const th = g.work.things().find((x: any) => x.kind === 'breaker');
  verdict(!!th && !!th.stand && flat(th.stand, bp) < 1.0 && !g.col.nav.isBlocked(th.stand[0], th.stand[2]), 'the breaker is a thing to work, with a free spot to stand on within arm\'s reach of its face', th ? `face ${th.face.map(f2)} · normal ${th.n.map(f2)} · stand ${th.stand?.map(f2)} (${th.stand ? f2(flat(th.stand, bp)) : '-'} m off)` : 'not listed');
  // --- the menu on it
  R.aim = panel(g); R.step(2); R.press('KeyX');
  const rows = R.rows(), t = O.menu?.target;
  verdict(!!O.menu && t.kind === 'floor' && t.thing?.kind === 'breaker' && rows[0]?.id === 'work' && rows[0].key === 1 && labelOf(R, rows[0]) === 'throw the breaker' && !rows.some((d: any) => d.id === 'move') && rows.every((d: any) => !d.key || d.key <= 5),
    'X on the panel: the menu is the breaker\'s — "throw the breaker" on 1 where "move there" is on floor, no digit above 5', `${menuWords(R)} · "${rows[0] ? labelOf(R, rows[0]) : ''}" · hud "${O.hud().menu?.rows?.[1]?.label ?? ''}"`);
  const hud = O.hud().menu; verdict(!!hud && JSON.stringify(hud.rows).includes('the breaker'), 'the panel names it: on the breaker', hud ? hud.rows.map((r: any) => r.label).filter(Boolean).join(' / ') : 'no menu');
  // --- given
  const posBefore = ops.map(o => [...o.char.pos]);
  R.press('Digit1'); R.aim = null;
  const L = R.last(), worker = ops.find(o => g.work.working(o)), mate = ops.find(o => o !== worker);
  verdict(!O.menu && L?.order === 'work' && L.target === 'thing:breaker' && !!worker, '1 gives it: logged as the order on the breaker, the menu gone, one man at work', `log ${JSON.stringify(L)} · worker ${worker?.callsign}`);
  if (!worker) return;
  verdict(flat(worker.char.pos, th.stand) <= flat(mate.char.pos, th.stand) + 0.01, 'the nearer man is the one sent', `${worker.callsign} ${f2(flat(posBefore[ops.indexOf(worker)], th.stand))} m · ${mate.callsign} ${f2(flat(posBefore[ops.indexOf(mate)], th.stand))} m`);
  R.fastest = 0;
  const went = R.until(() => g.blackout.active, 60), tDark = g.time;
  verdict(went && !g.blackout.permanent, 'he gets there and the mains go (a hand-thrown breaker: not for good)', `blackout ${g.blackout.active} after ${f2(g.time)} s on the clock · ${worker.callsign} ${f2(flat(worker.char.pos, bp))} m from the panel · ${O.statusOf(worker)}`);
  verdict(flat(worker.char.pos, bp) < 1.15 && R.handUp.has(worker.callsign), 'he was at the panel, inside Sam\'s own reach of it, with his hand out to it', `${f2(flat(worker.char.pos, bp))} m · hand seen out: ${[...R.handUp].join(', ') || 'nobody'}`);
  { const J = R.jobs.get(worker.callsign);
    verdict(!!J && J.verb === 'breakerOff' && J.bad === 0 && Math.abs(J.need - (WORK.handSecs + WORK.breakerSecs)) < 1e-9 && J.secs > J.need - 0.05 && J.secs <= J.need + 0.05, 'the read beside the hand (workJob): throwing it, a clock that only runs forward, to the end of the time the work takes, and there whenever the hand is', J ? `${J.verb} · ${f2(J.secs)} of ${f2(J.need)} s · ${J.bad} bad frames` : 'never read'); }
  verdict(R.fastest <= ORDERS.brisk + 0.25 && R.held === 0, 'nobody went faster than an ordered man\'s brisk walk, and no key was ever held', `fastest ${f2(R.fastest)} m/s (brisk ${ORDERS.brisk}) · most keys down on a frame ${R.held}`);
  verdict(R.said.some((m: string) => /breaker thrown/.test(m)) && R.said.some((m: string) => /lights out/.test(m)), 'the game says so as it does for Sam\'s own hand, and the man says it is done', R.said.filter((m: string) => /breaker|lights out/.test(m)).join(' | '));
  R.step(90);
  const A = O.of(worker), B = O.of(mate);
  verdict(A?.order === 'hold' && !g.work.working(worker) && flat(worker.char.pos, bp) < 1.3, 'done, he holds by the panel on a plain hold', `${worker.callsign}: ${A?.order} · ${O.statusOf(worker)}`);
  verdict(B?.order === 'move' && !!B.post && flat(B.post, th.stand) > 0.8 && flat(B.post, th.stand) < 2.4 && B.spare === true, 'his partner was sent to a mark behind him, eyes spare for the ways in', `${mate.callsign}: ${B?.order} · post ${B?.post?.map(f2)} (${B?.post ? f2(flat(B.post, th.stand)) : '-'} m from the man at work) · ${O.statusOf(mate)}`);
  // --- it stays thrown: no teammate re-arms it by standing there, none is handed the errand
  R.step(8 * 60);
  const errand = g.guards.filter((gd: any) => gd.task?.kind === 'breaker');
  verdict(g.blackout.active && errand.every((gd: any) => gd.team !== 'operative'), 'eight seconds on it is still dark with a teammate standing by the panel, and the "check the breaker" errand is nobody of the squad\'s', `blackout ${g.blackout.active} (${f2(g.time - tDark)} s after) · errand: ${errand.map((gd: any) => `${gd.callsign || gd.id} [${gd.team}]`).join(', ') || 'nobody'}`);
  // --- and back: B (the quick order) on the panel
  R.aim = panel(g); R.step(2); R.press('KeyX');
  const lab = R.rows()[0] ? labelOf(R, R.rows()[0]) : ''; R.press('KeyX'); if (O.menu) O.close();
  const n0 = O.log.length; R.press('KeyB'); R.aim = null;
  const back = R.until(() => !g.blackout.active, 30);
  verdict(lab === 're-arm the mains' && O.log.length === n0 + 1 && R.last().order === 'work' && back, 'dark, the row reads "re-arm the mains"; B on the panel gives it and the mains come back', `row "${lab}" · log +${O.log.length - n0} ${JSON.stringify(R.last())} · blackout ${g.blackout.active}`);
  // --- a wrecked breaker is nobody's
  g.setBlackout(Infinity, 'shot'); R.step(2); R.aim = panel(g); R.step(2); R.press('KeyX');
  verdict(!R.rows().some((d: any) => d.id === 'work'), 'a breaker a round has wrecked is no thing to work (Sam has no row for it either)', menuWords(R));
  console.log(`    stats: ${JSON.stringify(WORK_STATS)} · ${g.work.summary()}`);
});

/** THE SQUAD'S FIRE IS HELD AND A MAN NOBODY MAY SHOOT YET STANDS IN SIGHT OF THE THING (WORK.heldPass; workPasses, asked by roomfight.ts's eyes and its mate's
 *  call). The fault it holds, asserted with the key off: the man sent to the breaker stands at the panel with his muzzle on that man, his chest turned to and
 *  fro between the two, and the mains stay on for as long as the hold stands. WORKHELD_BREAK=1 leaves the rule off and asks the rule's lines: must fail. */
export const workHeld = () => keep(async () => {
  console.log("\n=== work-held: fire held, a defender who has noticed nobody in sight of the panel — the man sent still throws the breaker ===");
  const RULE = !process.env.WORKHELD_BREAK, hf0 = HOLDFIRE.on; let quietAt = -1;
  const foes = (g: any): any[] => g.guards.filter((gd: any) => gd.team !== 'operative' && gd.state !== 'dead');
  /** the room clear's pair on the office, the squad's fire held (holdfire.ts, as the page has it), the storage door open to them, one defender set down in
   *  plain sight of where the breaker is worked from, his back to it — and the order given */
  const stage = async (pass: boolean, steps = false) => {
    const R = await rig(g => { g.fogOfWar.on = true; return g.roomClear.start(21); }); const { g, O } = R; HOLDFIRE.on = true; WORK.heldPass = pass;
    R.gather(); unlock(g); R.step(70);
    const th = g.work.things().find((x: any) => x.kind === 'breaker'), st = th.stand as number[];
    // a spot 3 to 6 m off the stand with floor under it and nothing solid between the two chests (the office's own first)
    const ok = (q: number[]) => !g.col.nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([st[0], 1.2, st[2]], [q[0], 1.2, q[2]]);
    let at: number[] | null = ok([31.8, 0, 5.3]) ? [31.8, 0, 5.3] : null;
    for (let r = 3; r <= 6 && !at; r += 0.5) for (let k = 0; k < 24 && !at; k++) { const q = [st[0] + Math.cos(k * Math.PI / 12) * r, 0, st[2] + Math.sin(k * Math.PI / 12) * r]; if (ok(q)) at = q; }
    const X = at ? foes(g).sort((a, b) => flat(a.char.pos, at!) - flat(b.char.pos, at!))[0] : null, away = at ? Math.atan2(at[0] - st[0], at[2] - st[2]) : 0;
    let fr = 0;   // (`steps`: he shifts his feet where he stands — a walking man's footfall filed twice a second, as guards.ts files one, for the squad's ears)
    const pin = (alert = false) => { if (!X || !at || X.state === 'dead') return; X.char.pos[0] = at[0]; X.char.pos[2] = at[2]; X.char.vel = [0, 0, 0]; X.char.bodyYaw = X.char.aimYaw = away; if (alert) { X.state = 'alert'; X.awareness = 1; }
      if (steps && fr++ % 30 === 0) g.events.push({ kind: 'step', pos: [at[0], 0, at[2]], time: g.time, loud: false, level: 0.33, who: X.char.id }); };
    pin(); R.step(30);
    const why = O.give('work', { kind: 'floor', at: st, thing: th }, 'all'), ops: any[] = O.squad(), worker = ops.find(o => g.work.working(o)), mate = ops.find(o => o !== worker);
    return { R, g, O, th, st, at, X, pin, why, worker, mate };
  };
  /** played until the mains go or `secs` are up: frames the man at work stood at his thing with his muzzle that man's, frames his partner's was while his hand was out, rounds the squad fired */
  const play = (S: Awaited<ReturnType<typeof stage>>, secs: number) => {
    const { R, g, X, worker, mate } = S; const r0 = g.fight.stats.opRounds; let onHim = 0, at = 0, covered = 0, hand = 0, noticed = false;
    for (let i = 0; i < secs * 60 && !g.blackout.active; i++) { S.pin(); R.step();
      if (g.work.atThing(worker)) { at++; if (g.fight.opOf(worker)?.tgt === X) onHim++; }
      if (workHand(g, worker.char)) { hand++; if (g.fight.opOf(mate)?.tgt === X) covered++; }
      if (X.state === 'alert' || X.state === 'search' || X.state === 'dead') noticed = true; }
    return { dark: g.blackout.active as boolean, onHim, at, covered, hand, noticed, rounds: g.fight.stats.opRounds - r0,
      words: `mains ${g.blackout.active ? 'out' : 'on'} at ${f2(g.time)} s · ${worker.callsign} at the panel ${at} frames, ${onHim} of them with his muzzle on ${X.callsign} · hand out ${hand} frames, ${mate?.callsign}'s gun on ${X.callsign} for ${covered} of them · ${g.fight.stats.opRounds - r0} rounds · ${X.callsign} ${X.state}` };
  };
  try {
    // --- the fault, the key off
    { const S = await stage(false);
      verdict(!S.R.why && !S.why && !!S.at && !!S.X && !!S.worker && !!S.mate && HOLDFIRE.on, 'staged: the pair sent to the breaker with the squad\'s fire held, a defender set down in sight of the panel with his back to it', `refusal ${S.R.why} ${S.why} · ${S.X?.callsign} at ${S.at?.map(f2)} · ${S.at ? f2(flat(S.at, S.st)) : '-'} m from the stand · worker ${S.worker?.callsign}`);
      if (!S.worker || !S.X || !S.mate) return;
      const r = play(S, 45);
      verdict(!r.dark && r.onHim > 600 && r.hand === 0 && r.rounds === 0 && !r.noticed, 'THE FAULT, key off: he stands at the panel with his muzzle on a man he may not shoot, and the mains stay on', r.words);
      verdict(workPasses(S.g, S.worker, S.X) === false, 'key off: the room fight is told nothing (workPasses false)', `${workPasses(S.g, S.worker, S.X)}`); }
    // --- the rule
    { const S = await stage(RULE); if (!S.worker || !S.X || !S.mate) { verdict(false, 'staged again for the rule', `${S.R.why} ${S.why}`); return; }
      const r = play(S, 45); quietAt = r.at;
      verdict(r.dark && r.rounds === 0 && !r.noticed, 'key on: he throws the breaker with that man in sight — no round fired, the man neither alert nor searching', r.words);
      verdict(r.hand > 0 && r.onHim === 0, 'stood at the panel his muzzle was never that man\'s: his hand went out to the panel', `${r.onHim} of ${r.at} frames · hand out ${r.hand}`);
      verdict(r.hand > 0 && r.covered === r.hand, 'for every frame his hand was out, the gun of the man who covers him was on that man', `${r.covered} of ${r.hand}`);
      verdict(r.hand > 0 && r.hand <= Math.round((WORK.handSecs + WORK.breakerSecs) * 60) + 3, 'the hand went out once and stayed out for the time the work takes', `${r.hand} frames out · the work takes ${Math.round((WORK.handSecs + WORK.breakerSecs) * 60)}`); }
    // --- … and with that man shifting his feet (footfalls in the squad's ears twice a second): no look for him either — the same frames at the panel as with
    //     him silent (a look for those steps, or a look dropped and made again every frame, costs seconds: 755 frames more with the seam in cue() taken out)
    { const F = await stage(false, true); if (!F.worker || !F.X || !F.mate) { verdict(false, 'staged with footfalls, key off', `${F.R.why} ${F.why}`); return; }
      const f = play(F, 45), S = await stage(RULE, true); if (!S.worker || !S.X || !S.mate) { verdict(false, 'staged with footfalls', `${S.R.why} ${S.why}`); return; }
      const r = play(S, 45);
      verdict(!f.dark && f.onHim > 600, 'footfalls, key off: the fault again', f.words);
      verdict(r.dark && r.rounds === 0 && !r.noticed && r.onHim === 0 && r.hand > 0 && r.hand <= Math.round((WORK.handSecs + WORK.breakerSecs) * 60) + 3 && Math.abs(r.at - quietAt) <= 3, 'footfalls, key on: never his target, the hand out once, and the mains out in the frames it took with the man silent', `${r.words} · silent: ${quietAt} frames at the panel`); }
    // --- and the pass ends when the hold does: the same again, the man made to notice with the hand out
    { const S = await stage(RULE); if (!S.worker || !S.X || !S.mate) { verdict(false, 'staged a third time', `${S.R.why} ${S.why}`); return; }
      const { R, g, X, worker } = S; let out = false, took = false;
      for (let i = 0; i < 45 * 60 && !out; i++) { S.pin(); R.step(); out = g.work.atThing(worker) && !!workHand(g, worker.char); }
      const before = workPasses(g, worker, X); S.pin(true); const after = workPasses(g, worker, X), r0 = g.fight.stats.opRounds;
      for (let i = 0; i < 180 && X.state !== 'dead'; i++) { S.pin(true); R.step(); if (g.fight.opOf(worker)?.tgt === X) took = true; }
      verdict(out && before === true && after === false && took && (X.state === 'dead' || g.fight.stats.opRounds > r0), 'the man notices with the hand out: that frame he is passed over no longer — he is the worker\'s target, and the squad\'s rounds go at him', `hand out at the panel ${out} · passed before ${before}, after ${after} · the worker\'s target ${took} · ${g.fight.stats.opRounds - r0} rounds in 3 s · ${X.callsign} ${X.state}`); }
  } finally { HOLDFIRE.on = hf0; }
});

export const workFour = () => keep(async () => {
  console.log('\n=== work-four: the squad of four — one pair goes, the other is left as it was ===');
  const R = await rig(g => { g.fogOfWar.on = true; return g.roomClear.start(21); }, true, 4);
  const { g, O } = R; const bp = g.level.breaker.pos, ops: any[] = O.squad();
  verdict(!R.why && ops.length === 4, 'staged: the room clear with the four', `refusal ${R.why} · ${ops.map(o => `${o.callsign}[${o.unit?.pair}]`).join(', ')}`);
  R.gather(); lookAtPanel(R); unlock(g); R.step(70);
  const before = new Map(ops.map(o => [o, O.of(o)]));
  R.aim = panel(g); R.step(2); R.press('KeyX'); R.press('Digit1'); R.aim = null;
  const L = R.last(), worker = ops.find(o => g.work.working(o));
  const sent = ops.filter(o => O.of(o) !== before.get(o)), left = ops.filter(o => O.of(o) === before.get(o));
  verdict(L?.order === 'work' && !!worker && sent.length === 2 && sent.every(o => o.unit?.pair === worker.unit?.pair) && left.length === 2, 'the order to all goes to one pair — one works, his partner covers — and the other pair keeps the order it had', `log ${JSON.stringify(L)} · sent ${sent.map(o => o.callsign).join(', ')} · left ${left.map(o => `${o.callsign}: ${O.statusOf(o)}`).join(', ')}`);
  const went = R.until(() => g.blackout.active, 60);
  verdict(went && [...R.handUp].length === 1, 'the mains go, and one man only ever had a hand on the panel', `blackout ${g.blackout.active} · hands ${[...R.handUp].join(', ')}`);
});

export const workObjective = () => keep(async () => {
  console.log('\n=== work-objective: the partner of a quiet mission takes the thing ===');
  const R = await rig(g => startFromQuery(g, '?levelFile=quiet-yard.json&quiet&squad=1').why, true, 2, 'quiet-yard');
  const { g, O } = R; const ops: any[] = O.squad(), Wd = quietWords(g);
  verdict(!R.why && ops.length === 1 && !!Wd, 'staged: a quiet mission (levels/quiet-yard.json) with one partner', `refusal ${R.why} · partner ${ops.map(o => o.callsign).join(', ')} · thing "${Wd?.thing}" in "${Wd?.holder}" (${Wd?.place})`);
  if (!Wd || !ops.length) return;
  const rf = g.level.mission.rack.front;
  verdict(g.mission.stage !== 'drive' && !g.work.things().some((x: any) => x.kind === 'objective'), 'before the objective is to take it, the holder is no thing to work (as Sam\'s own row)', `stage ${g.mission.stage} · things ${g.work.things().map((x: any) => x.name).join(', ')}`);
  // Sam walks in (the mission's own reach test): put him in the room and let the stage move
  const A = g.level.mission.serverRoom; let spot: number[] | null = null;
  for (let x = A.x0 + 0.5; x < A.x1 && !spot; x += 0.4) for (let z = A.z0 + 0.5; z < A.z1 && !spot; z += 0.4) if (!g.col.nav.isBlocked(x, z) && flat([x, 0, z], rf) > 1.6) spot = [x, 0, z];
  g.teleportPlayer(spot ?? [(A.x0 + A.x1) / 2, 0, (A.z0 + A.z1) / 2]); R.step(30);
  const th = g.work.things().find((x: any) => x.kind === 'objective');
  verdict(g.mission.stage === 'drive' && !!th && !!th.stand, 'Sam in the place: the objective is to take it, and it is a thing to work with a spot to stand on', `stage ${g.mission.stage} · ${th ? `${th.name} · stand ${th.stand?.map(f2)} (${th.stand ? f2(flat(th.stand, rf)) : '-'} m off its face)` : 'not listed'}`);
  if (!th) return;
  R.gather(8);
  R.aim = [rf[0], Math.max(0.9, rf[1] || 1.0), rf[2]]; R.step(2); R.press('KeyX');
  const rows = R.rows(), lab = rows[0] ? labelOf(R, rows[0]) : '';
  verdict(rows[0]?.id === 'work' && rows[0].key === 1 && lab === `take ${Wd.thing}` && rows.every((d: any) => !d.key || d.key <= 5), 'X on the holder: "take …" in the level\'s own words on 1, no digit above 5', `${menuWords(R)} · "${lab}"`);
  R.press('Digit1'); R.aim = null;
  const worker = ops.find(o => g.work.working(o));
  const took = R.until(() => g.mission.stage === 'exfil', 60);
  verdict(!!worker && took && g.mission.pulled === true && R.handUp.has(worker.callsign), 'he goes, puts a hand to it for as long as Sam\'s own would take, and the mission moves on to the way out', `stage ${g.mission.stage} · pulled ${g.mission.pulled} · ${worker ? `${worker.callsign} ${f2(flat(worker.char.pos, rf))} m off · ${O.statusOf(worker)}` : 'nobody at work'} · last line "${g.messages[g.messages.length - 1]?.text}"`);
  { const J = worker ? R.jobs.get(worker.callsign) : null;
    verdict(!!J && J.verb === 'drive' && J.bad === 0 && J.secs > J.need - 0.05, 'the read beside the hand says he is taking it, to the end', J ? `${J.verb} · ${f2(J.secs)} of ${f2(J.need)} s · ${J.bad} bad frames` : 'never read'); }
  R.step(30);
  verdict(!!worker && O.of(worker)?.order === 'hold' && !g.work.things().some((x: any) => x.kind === 'objective'), 'done, he holds there and the holder is plain floor again', worker ? O.statusOf(worker) : '');
});

export const workEdges = () => keep(async () => {
  console.log('\n=== work-edges: what is NOT the breaker, and a man who cannot get to it ===');
  const R = await rig(g => { g.fogOfWar.on = true; return g.roomClear.start(21); });
  const { g, O } = R; const ops: any[] = O.squad();
  R.gather(); lookAtPanel(R); unlock(g); R.step(70);
  const th = g.work.things().find((x: any) => x.kind === 'breaker'), f = th.face, n = th.n;
  // --- the far side of its wall, the wall's top, the floor well in front of it: none is the breaker; the floor at its foot is
  const at = (k: number, side = 0): number[] => [f[0] + n[0] * k + n[2] * side, 0, f[2] + n[2] * k - n[0] * side];
  const is = (p: number[]) => !!O.targetAt(p).thing;
  verdict(!is(at(-0.14)) && !is(at(-0.4)) && !is(at(-0.6, 0.2)) && !is(at(0.9)) && is(at(0.2)) && is(at(0.0, 0.2)),
    'a point on the top of its wall, on the floor of the next room behind it, or a metre in front is not the breaker; its own face and the floor at its foot are',
    `behind 0.14 ${is(at(-0.14))} · behind 0.4 ${is(at(-0.4))} · behind 0.6 off 0.2 ${is(at(-0.6, 0.2))} · in front 0.9 ${is(at(0.9))} · in front 0.2 ${is(at(0.2))} · on the face 0.2 along ${is(at(0, 0.2))}`);
  // --- Sam standing at it with the cursor on himself is Sam (fall in), not the breaker
  { const was = [...g.player.char.pos] as [number, number, number]; g.teleportPlayer([th.stand[0], 0, th.stand[2]]); R.step(3);
    const p = g.player.char.pos, t = O.targetAt([p[0], 0, p[2]]), on = O.targetAt([f[0], 0, f[2]]);
    verdict(t.kind === 'none' && !t.thing && !!on.thing, 'Sam standing at the panel: the point at his own feet is himself (the orders he gives there are fall in / hold), the panel itself is still the breaker', `at his feet: ${t.kind}${t.thing ? ' (thing)' : ''} · on the face: ${on.thing ? 'the breaker' : on.kind}`);
    g.teleportPlayer(was); R.step(3); }
  // --- a man who cannot get to it does not work it from where he stops: the door is locked again once he is on his way
  const n0 = O.log.length; R.aim = panel(g); R.step(2); R.press('KeyX'); R.press('Digit1'); R.aim = null;
  const worker = ops.find(o => g.work.working(o));
  verdict(O.log.length === n0 + 1 && !!worker, 'the order is given', `${JSON.stringify(R.last())} · worker ${worker?.callsign}`);
  if (!worker) return;
  // (what orders.ts does for a man who is stuck short of his mark — a shut way, somebody on it: 'the mark comes to him', and he is called arrived)
  R.step(240); { const A = O.of(worker), p = worker.char.pos; A.there = 'stopped short'; A.post = [p[0], 0, p[2]]; A.goal = [p[0], 0, p[2]]; A.via.length = 0; A.arrived = true; }
  R.until(() => !g.work.working(worker), 10); R.step(120);
  const d = flat(worker.char.pos, th.stand);
  verdict(!g.blackout.active && !g.work.working(worker) && O.of(worker)?.order === 'hold' && d > 1.5, 'stopped short of it (the orders bring his mark to him and call him arrived) he holds where he is, and the breaker is NOT thrown from there', `blackout ${g.blackout.active} · ${worker.callsign} ${f2(d)} m from his mark · ${O.statusOf(worker)} · said: ${R.said.filter((m: string) => m.startsWith(worker.callsign)).slice(-2).join(' | ')} · ${g.work.log.slice(-1).map((l: any) => l.what).join('')}`);
  R.step(600);
  verdict(!g.blackout.active && !R.handUp.has(worker.callsign), 'ten seconds on it is still not thrown, and his hand never went out', `blackout ${g.blackout.active} · hands ${[...R.handUp].join(', ') || 'nobody'}`);
});

export const workPosted = () => keep(async () => {
  console.log('\n=== work-posted: the mains go, and no man who cannot leave his post says he is off to check the breaker ===');
  const errandOf = (g: any) => g.guards.filter((gd: any) => gd.task?.kind === 'breaker');
  const lineIn = (R: any) => R.said.filter((t: string) => /checking the breaker/.test(t));
  const plain = (R: any, secs: number) => { for (let i = 0; i < secs * 60; i++) { R.g.player.visibility = 0.05; R.W.step(DT); } };
  const { POWEROUT } = await import(`${ROOT}/src/game/powerout.ts`); const po0 = POWEROUT.on;   // (a blackout sends defenders to the breaker, a later rule: held off for the two room clears here, after each stand-up — powerout-check.ts holds it, with WORK.posted on)
  try {
  // --- a room clear: every defender is held on his mark
  { const R = await rig(g => { g.fogOfWar.on = true; POWEROUT.on = false; return g.roomClear.start(21); });
    const { g } = R; const foes = g.guards.filter((gd: any) => gd.team !== 'operative' && gd.state !== 'dead');
    verdict(!R.why && foes.length > 0 && foes.every((gd: any) => gd.hold || gd.pinned), 'staged: the room clear, every defender held on his mark', `refusal ${R.why} · ${foes.map((gd: any) => `${gd.callsign}[${gd.hold ? 'hold' : ''}${gd.pinned ? ' pinned' : ''}]`).join(', ')}`);
    g.setBlackout(86400, 'hand'); plain(R, 1);
    verdict(g.blackout.active && errandOf(g).length === 0 && lineIn(R).length === 0, 'the mains thrown: nobody is handed the errand, nobody says he is checking the breaker', `errand ${errandOf(g).map((gd: any) => gd.callsign).join(', ') || 'nobody'} · lines ${JSON.stringify(lineIn(R))}`);
    plain(R, 6);
    verdict(g.blackout.active && lineIn(R).length === 0, 'six seconds on it is still dark and still nobody has said it', `lines ${JSON.stringify(lineIn(R))}`); }
  // --- the fault, with the rule off: a held man is handed it, says it, and stands there
  { WORK.posted = false;
    const R = await rig(g => { g.fogOfWar.on = true; POWEROUT.on = false; return g.roomClear.start(21); });
    const { g } = R; g.setBlackout(86400, 'hand'); plain(R, 1);
    const man = errandOf(g)[0], at0 = man ? [...man.char.pos] : null; plain(R, 6);
    verdict(!!man && (man.hold || man.pinned) && lineIn(R).length >= 1 && flat(man.char.pos, at0!) < 0.5 && g.blackout.active, 'WORK.posted off = as it was: a held defender says he is checking the breaker and never leaves his mark',
      man ? `${man.callsign} moved ${f2(flat(man.char.pos, at0!))} m · lines ${JSON.stringify(lineIn(R))}` : 'nobody was handed it');
    WORK.posted = true; }
  // --- a man who can walk still gets it and still goes: the office's night shift
  { const R = await rig(() => null);
    const { g } = R; const bp = g.level.breaker.pos;
    g.setBlackout(86400, 'hand'); plain(R, 1);
    const man = errandOf(g)[0], d0 = man ? flat(man.char.pos, bp) : 0; plain(R, 10);
    verdict(!!man && !man.hold && !man.pinned && lineIn(R).length >= 1 && d0 - flat(man.char.pos, bp) > 1, "the solo night: the nearest of the shift is handed it, says it, and walks for the breaker",
      man ? `${man.callsign}: ${f2(d0)} m → ${f2(flat(man.char.pos, bp))} m · lines ${JSON.stringify(lineIn(R))}` : 'nobody was handed it'); }
  } finally { POWEROUT.on = po0; }
});

/** lighting.ts's own 'check the breaker' errand (the other side's, nobody ordered): walked to the panel's own face, and the mains re-armed only by a man with
 *  nothing solid between him and the panel. The fault it holds, asserted with WORK.ownFace off: on the relay station the panel hangs on the inside of the
 *  compound wall facing +x, the fixed spot is in that wall, and the gate man re-armed the mains from the road (its first patrol set) or never (its second).
 *  WORKFACE_BREAK=1 leaves the rule off and asks the same lines: must fail. */
export const workFace = () => keep(async () => {
  console.log("\n=== work-face: the breaker errand goes to the panel's own face, and the mains come back only from a man with a line to it ===");
  const RULE = !process.env.WORKFACE_BREAK;
  const quiet = <T>(f: () => T): T => { const l = console.log, w = console.warn; if (!VERBOSE) console.log = console.warn = () => { }; try { return f(); } finally { console.log = l; console.warn = w; } };
  const stand = async (level: string | null, own: boolean, stage?: (g: any) => void) => {
    Math.random = seeded(21); const l = console.log, w = console.warn; if (!VERBOSE) console.log = console.warn = () => { };
    try { const W: any = await standUp(level ? { level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${level}.json`, 'utf8'))), seed: 1 } : undefined);
      W.game.godMode = true; WORK.on = true; WORK.ownFace = own; stage?.(W.game); return W; } finally { console.log = l; console.warn = w; } };
  /** the panel as it hangs: a point just off its face at chest height, and the normal out of it */
  const panelOf = (g: any) => { const th = g.work.things().find((x: any) => x.kind === 'breaker'); return { n: th.n as number[], face: th.face as number[], at: [th.face[0] + th.n[0] * 0.05, 1.0, th.face[2] + th.n[2] * 0.05] }; };
  /** the mains thrown by hand and the floor left to itself: who was sent, when and from where the mains came back, and the frames a man worked the lever with something solid between him and it */
  const play = (W: any, secs: number) => quiet(() => {
    const g = W.game; for (let i = 0; i < 120; i++) { g.player.visibility = 0; W.step(DT); }
    const P = panelOf(g); g.setBlackout(86400, 'hand'); const t0 = g.time; let who: any = null, through = 0, back = -1, from: number[] | null = null, by: any = null;
    for (let i = 0; i < secs * 60 && back < 0; i++) {
      g.player.visibility = 0; W.step(DT); who ??= g.guards.find((x: any) => x.task?.kind === 'breaker') ?? null;
      const at = g.guards.filter((gd: any) => g.blackout.active && breakerResetNear(g, gd));
      for (const gd of at) { by = gd; from = [...gd.char.pos]; if (g.col.solidBlocked([gd.char.pos[0], 1.0, gd.char.pos[2]], P.at)) through++; }
      if (!g.blackout.active) back = g.time - t0;
    }
    const side = from ? (from[0] - P.face[0]) * P.n[0] + (from[2] - P.face[2]) * P.n[2] : 0;
    return { who: who?.callsign ?? 'nobody', by: by?.callsign ?? 'nobody', back, from, through, side, words: `sent ${who?.callsign ?? 'nobody'} · ${back < 0 ? `still out after ${secs} s` : `back at +${f2(back)} s by ${by?.callsign} from (${f2(from![0])}, ${f2(from![2])}), ${f2(side)} m in front of the face`} · ${through} frames at the lever through something solid` };
  });
  // --- the relay station: a pin for each of its first two patrol sets (the third plays the breaker as the first does)
  const pins: number[] = [];
  { const W = await stand('quiet-relay', true); quiet(() => { for (let pin = 1; pin <= 24 && (pins[0] === undefined || pins[1] === undefined); pin++) { W.game.quiet.stop(); startFromQuery(W.game, `?levelFile=quiet-relay.json&quiet=${pin}`); const k = W.game.quiet.deal.patrol; if (k === 0 || k === 1) pins[k] ??= pin; } }); }
  verdict(pins[0] !== undefined && pins[1] !== undefined, "the relay station: a pin found for each of its first two patrol sets", `pins ${JSON.stringify(pins)}`);
  const relay = (set: number, own: boolean) => stand('quiet-relay', own, g => startFromQuery(g, `?levelFile=quiet-relay.json&quiet=${pins[set]}`));
  { const W = await relay(0, false), g = W.game, P = panelOf(g), fx = [g.level.breaker.pos[0] - 0.4, g.level.breaker.pos[2] - 0.9];
    verdict(g.col.nav.isBlocked(fx[0], fx[1]) && P.n[0] === 1, 'the relay station: the panel faces +x off the compound wall and the fixed spot is not floor', `n ${P.n} · fixed spot (${f2(fx[0])}, ${f2(fx[1])}) blocked ${g.col.nav.isBlocked(fx[0], fx[1])}`);
    const r = play(W, 45);
    verdict(r.back > 0 && r.through > 0 && r.side < 0, 'THE FAULT, rule off, first patrol set: the mains are re-armed from the far side of the wall the panel hangs on', r.words); }
  { const r = play(await relay(1, false), 45);
    verdict(r.who !== 'nobody' && r.back < 0, 'THE FAULT, rule off, second patrol set: a man is sent, stands off it, and the mains stay out', r.words); }
  for (const set of [0, 1]) { const r = play(await relay(set, RULE), 45);
    verdict(r.who !== 'nobody' && r.back > 0 && r.through === 0 && r.side > 0, `rule on, patrol set ${set + 1}: the man sent re-arms the mains from in front of the panel, nothing solid between`, r.words); }
  // --- where the fixed spot was right, nothing moves: the office's night
  { const a = play(await stand(null, false), 30), W = await stand(null, RULE), E = quiet(() => breakerErrand(W.game)), bp = W.game.level.breaker.pos, b = play(W, 30);
    verdict(!!E && E.goal[0] === bp[0] - 0.4 && E.goal[2] === bp[2] - 0.9 && E.mid[2] === bp[2] - 0.6, 'the office: the errand keeps the fixed spot and reach (a man has floor there and a line to the panel)', E ? `goal (${f2(E.goal[0])}, ${f2(E.goal[2])}) mid (${f2(E.mid[0])}, ${f2(E.mid[2])})` : 'no errand read');
    verdict(a.back > 0 && a.who === b.who && Math.abs(a.back - b.back) < 1e-9 && !!a.from && !!b.from && flat(a.from as any, b.from as any) < 1e-9 && b.through === 0, 'the office: rule off and on, the same man re-arms it at the same moment from the same place', `off: ${a.words}\n    on:  ${b.words}`); }
  // --- every level with a panel: the errand's spot is floor a man can stand on with a line to it, inside the reach
  { const names = readdirSync(`${ROOT}/levels`).filter((f: string) => f.endsWith('.json') && !f.endsWith('-gwot.json')).map((f: string) => f.slice(0, -5)).sort();
    const bad: string[] = [], moved: string[] = [], wrong: string[] = [], skipped: string[] = []; let n = 0;
    for (const name of names) {
      let W: any; try { W = await stand(name, RULE); } catch { skipped.push(name); continue; }
      const g = W.game; if (!g.level.breaker || !g.engine.world.statics[g.level.breaker.boxes[0]]) continue; n++;
      const E = quiet(() => breakerErrand(g)), P = panelOf(g), bp = g.level.breaker.pos, dyn = g.col.dynamicBoxes;
      if (!E) { bad.push(`${name}: no errand read`); continue; }
      const fx = bp[0] - 0.4, fz = bp[2] - 0.9;
      g.col.dynamicBoxes = []; const line = !g.col.solidBlocked([E.goal[0], 1.0, E.goal[2]], P.at), fixedOk = !g.col.nav.isBlocked(fx, fz) && !g.col.solidBlocked([fx, 1.0, fz], P.at); g.col.dynamicBoxes = dyn;
      const floor = !g.col.nav.isBlocked(E.goal[0], E.goal[2]), reach = Math.hypot(E.goal[0] - E.mid[0], E.goal[2] - E.mid[2]);
      // where a walk to it can really end: a nav cell's centre and the arrival band round it, so a stride round the spot
      let short = 0; for (let k = 0; k < 8; k++) { const q: [number, number] = [E.goal[0] + Math.cos(k * Math.PI / 4) * 0.35, E.goal[2] + Math.sin(k * Math.PI / 4) * 0.35];
        if (g.col.nav.isBlocked(q[0], q[1])) continue; g.col.dynamicBoxes = []; const cut = g.col.solidBlocked([q[0], 1.0, q[1]], P.at); g.col.dynamicBoxes = dyn; if (cut) short++; }
      if (short) bad.push(`${name}: ${short} of 8 places a stride round the spot have no line to the panel`);
      if (!floor || !line || reach >= 1.3) bad.push(`${name}: goal (${f2(E.goal[0])}, ${f2(E.goal[2])}) floor ${floor} line ${line} reach ${f2(reach)}`);
      const isMoved = E.goal[0] !== fx || E.goal[2] !== fz; if (isMoved) moved.push(name);
      if (isMoved === fixedOk) wrong.push(`${name}: fixed spot ${fixedOk ? 'good' : 'bad'}, errand ${isMoved ? 'moved' : 'kept'}`);
    }
    verdict(n >= 30 && skipped.length <= 2 && bad.length === 0, `every level with a breaker (${n}): the errand's spot is floor with a line to the panel, inside the reach it is re-armed from`, bad.join('\n    ') || `moved off the fixed spot on ${moved.length}: ${moved.join(', ')}${skipped.length ? ` · files that do not load as a level, not asked: ${skipped.join(', ')}` : ''}`);
    verdict(wrong.length === 0 && moved.includes('quiet-relay') && !moved.includes('office'), 'the spot moved exactly where the fixed one is not floor or has something solid between it and the panel (the relay station yes, the office no)', wrong.join('\n    ') || `${moved.length} of ${n}: ${moved.join(', ')}`); }
});

/** the squad's work order on a mission's charge (defuse.ts) when the run ends under the man's hand: he says nothing was made safe, because nothing was */
export const workDefuse = () => keep(async () => {
  console.log('\n=== work-defuse: a run that ends under his hand — no charge called safe, no thing called gone ===');
  const stageIt = (g: any) => { const D = g.level.scenarios?.defuse; if (D) D.secs = 900; return startFromQuery(g, '?levelFile=defuse.json&roomclear=1&squad4').why; };
  const sweep = (g: any) => { for (const x of g.guards) if (x.unit && x.team === 'hostile' && x.state !== 'dead') killGuard(g, x, [1, 0, 0], false, 'shot', 'player'); };
  const send = (R: any) => { const { g } = R, d = g.level.scenarios.defuse.devices[0], T = g.work.near([d.pos[0] + d.n[0] * 0.4, 0, d.pos[2] + d.n[1] * 0.4])?.target; return { T, why: T ? g.orders.give('work', T, 'red') : 'no thing there' }; };
  // (a) the run goes on: he makes it safe and says so — the line the second half must not say
  { const R = await rig(stageIt, true, 4, 'defuse'); const { g } = R, DF = g.defuse; sweep(g); R.step(30); g.teleportPlayer([20, 0, 15]); R.step(12);
    const done0 = WORK_STATS.done, { T, why } = send(R);
    verdict(!R.why && !!T?.thing && T.thing.kind === 'device' && !why, 'staged: the two charges with the four, red sent to charge 1', `refusal ${R.why} · thing ${T?.thing?.name} · order ${why}`);
    R.until(() => DF.states[0] !== 'armed', 90);
    verdict(DF.states[0] === 'safe' && R.said.some((s: string) => /charge is safe/.test(s)) && WORK_STATS.done === done0 + 1, 'the run going on: the charge is safe, he says so, one job counted done', `state ${DF.states[0]} · said ${R.said.filter((s: string) => /safe|charge/.test(s)).join(' | ')} · done +${WORK_STATS.done - done0}`); }
  // (b) Sam goes down with the man's hand on it: the run is over, the charge stays armed, and he does not call it safe
  { const R = await rig(stageIt, true, 4, 'defuse'); const { g } = R, DF = g.defuse; sweep(g); R.step(30); g.teleportPlayer([20, 0, 15]); R.step(12);
    const { why } = send(R);
    const on = R.until(() => !!g.work.onDevice(0)?.on, 90), n0 = R.said.length, done0 = WORK_STATS.done, moot0 = WORK_STATS.moot;
    g.godMode = false; for (let k = 0; k < 12 && !g.player.down; k++) hitPlayer(g, [1, 0, 0]);
    R.step(Math.round((DF.workSecs + 4) * 60));
    const after = R.said.slice(n0);
    verdict(!why && on && g.player.down && DF.end === 'over' && DF.states[0] === 'armed', 'staged: his hand on the charge, then Sam down — the run is over and the charge is still armed', `order ${why} · on it ${on} · down ${g.player.down} · end ${DF.end} · state ${DF.states[0]}`);
    verdict(!after.some((s: string) => /charge is safe|it's (already|gone)/.test(s)) && WORK_STATS.done === done0 && WORK_STATS.moot === moot0 + 1, 'he says nothing of the charge, no job is counted done, and his job ended as moot', `said after: ${after.join(' | ') || 'nothing'} · done +${WORK_STATS.done - done0} · moot +${WORK_STATS.moot - moot0}`);
    verdict(!g.work.onDevice(0) && !g.work.things().some((x: any) => x.kind === 'device'), 'nobody is left at it, and the charge is no longer a thing to work', `at it ${g.work.onDevice(0)?.gd?.callsign ?? 'nobody'} · things ${g.work.things().map((x: any) => x.name).join(', ') || 'none'}`); }
  // (c) the same on a quiet mission as two: the partner's hands in the holder, then Sam down — he neither takes it nor says it is 'already gone'
  { const R = await rig(g => startFromQuery(g, '?levelFile=quiet-yard.json&quiet&squad=1').why, true, 2, 'quiet-yard'); const { g, O } = R, rf = g.level.mission.rack.front, A = g.level.mission.serverRoom;
    let spot: number[] | null = null;
    for (let x = A.x0 + 0.5; x < A.x1 && !spot; x += 0.4) for (let z = A.z0 + 0.5; z < A.z1 && !spot; z += 0.4) if (!g.col.nav.isBlocked(x, z) && flat([x, 0, z], rf) > 1.6) spot = [x, 0, z];
    g.teleportPlayer(spot ?? [(A.x0 + A.x1) / 2, 0, (A.z0 + A.z1) / 2]); R.step(30); R.gather(8);
    const th = g.work.things().find((x: any) => x.kind === 'objective'), T = th?.stand ? g.work.near(th.stand)?.target : null, why = T ? O.give('work', T, 'all') : 'no thing there';
    const man = () => O.squad().find((o: any) => g.work.working(o));
    const on = R.until(() => { const m = man(), j = m ? workJob(g, m.char) : null; return !!j && j.secs > 0.3; }, 60), n0 = R.said.length, done0 = WORK_STATS.done, moot0 = WORK_STATS.moot;
    g.godMode = false; for (let k = 0; k < 12 && !g.player.down; k++) hitPlayer(g, [1, 0, 0]);
    R.step(8 * 60);
    const after = R.said.slice(n0);
    verdict(!R.why && !why && on && g.player.down && g.mission.stage === 'failed', 'staged: the partner\'s hands in the holder, then Sam down — the mission has failed', `refusal ${R.why} · order ${why} · hands in ${on} · down ${g.player.down} · stage ${g.mission.stage}`);
    verdict(!g.mission.pulled && !after.some((s: string) => /already (gone|out)|^\w[\w ]*: got /.test(s)) && WORK_STATS.done === done0 && WORK_STATS.moot === moot0 + 1 && !man(), 'he does not take it and does not say it is already gone; his job ended as moot', `pulled ${g.mission.pulled} · said after: ${after.join(' | ') || 'nothing'} · done +${WORK_STATS.done - done0} · moot +${WORK_STATS.moot - moot0} · at work ${man()?.callsign ?? 'nobody'}`); }
});
export const workOff = () => keep(async () => {
  console.log('\n=== work-off: the switch off — the menu and the errand as they were ===');
  const R = await rig(g => { g.fogOfWar.on = true; return g.roomClear.start(21); }, false);
  const { g, O } = R; const bp = g.level.breaker.pos;
  R.gather(); lookAtPanel(R); unlock(g); R.step(70);
  R.aim = panel(g); R.step(2); R.press('KeyX');
  const t = O.menu?.target;
  verdict(!!O.menu && !t.thing && !R.rows().some((d: any) => d.id === 'work') && g.work.things().length === 0, 'X on the panel: no thing on the target, no such row, nothing listed', `target ${t?.kind}${t?.wall ? ' (wall)' : ''} · ${menuWords(R)}`);
  if (O.menu) O.close();
  const th = { kind: 'breaker', face: [bp[0], bp[1], bp[2]], n: [0, 0, -1], stand: [bp[0], 0, bp[2] - 0.6], name: 'the breaker' };
  const why = O.give('work', { kind: 'floor', at: th.stand, thing: th });
  verdict(typeof why === 'string' && !g.blackout.active && !O.squad().some((o: any) => g.work.working(o)), 'given by hand all the same, it is refused and nobody goes', `"${why}"`);
});

export const workHarness = () => keep(async () => {
  console.log('\n=== work-harness: the two stands, the page switch, the knob table ===');
  const P = await import(`${ROOT}/src/host/profile.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`), K = await import(`${ROOT}/src/game/knobs.ts`);
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_WORKTHINGS;
    if (frozen || word !== undefined) WORK.on = word !== '1';
    const before = WORK.on; const l = console.log; console.log = () => { }; try { await standUp(); } finally { console.log = l; } const want = frozen || word !== undefined ? word === '1' : before;
    verdict(WORK.on === want, frozen ? 'standUp() on the frozen stand puts WORK.on to what TPS_WORKTHINGS says (unset: off)' : "standUp() on the shipped stand leaves WORK.on to the page's boot (or to TPS_WORKTHINGS where it is given)", `before ${before} · after ${WORK.on} · TPS_WORKTHINGS ${word ?? '(unset)'}`); }
  { const row = P.FROZEN_HOLDS['WORK.on']; verdict(typeof row === 'string' && /TPS_WORKTHINGS=1/.test(row) && E.STAND_ENV.includes('TPS_WORKTHINGS'), 'FROZEN_HOLDS names WORK.on with the word that turns it on, and STAND_ENV carries that word', `FROZEN_HOLDS['WORK.on'] = ${JSON.stringify(row)}`); }
  { const c = K.knobsCopy(); let a = false, b = true, o = false;
    try { WORK.on = false; P.pageSwitches(new URLSearchParams('')); a = WORK.on; P.pageSwitches(new URLSearchParams('noworkthings')); b = WORK.on; P.pageSwitches(new URLSearchParams('nohands&noclose')); o = WORK.on; } finally { K.knobsBack(c); }
    verdict(a && !b && o, 'the page turns it on, ?noworkthings alone turns it off', `plain ${a} · ?noworkthings ${b} · other switches off ${o}`); }
  { const reg = K.knobRegistry(), same = reg.WORK === WORK, inJ = K.JOURNAL_KNOBS.includes('WORK'); const c = K.knobsCopy(), was = WORK.standM; WORK.standM = was + 1; K.knobsBack(c);
    verdict(same && inJ && WORK.standM === was, 'knobRegistry().WORK is the table, a recording carries it (JOURNAL_KNOBS), knobsCopy / knobsBack restore it', `registry is the table ${same} · in JOURNAL_KNOBS ${inJ} · standM put back ${WORK.standM === was}`); }
});
