// THE RESPONSE TEAM TAKES A ROOM BY THE SQUAD'S OWN CODE — the check behind qrf.ts `startDrill` / `phaseDrill` (`tune.qrfSquad`, src/game/squadcast.ts).
//   bun run tools/qa/qrf-squad-check.ts   (`probes.ts qrfsquad`, in the `qrf` family)     exit 0 = all hold · 1 = one does not
// The switch is raised here, so the lines hold on BOTH stands (run it plain and under TPS_PROFILE=shipped). Headless: nothing here has been seen on a GPU.
//   (1) the element at a door is a second cast of the very classes Sam's squad runs — a DoorTools and a SquadOrders of its own, not the squad's instances,
//       not another class; it says of itself: the player is not theirs, the cans are the guards', every lock opens
//   (2) the room that holds the fix: BANG AND CLEAR off the squad's menu — stacked, the can in, in behind it, the room's floor searched, all four inside,
//       called clear; the pool one can down
//   (3) that can is THEIRS to the shift: no 'bang' report is left for a colleague to answer, a loud door-kind report carrying a response man's id is
//   (4) a room that does not hold the fix: worked from THE THRESHOLD first — the jambs held, floor seen from outside before anybody is in, then the step in
//   (5) contact in the stack: every man to the fight inside 1.5 s, the entry let go of (no order, nobody on the cast's books), the unthrown can back in the pool
//   (6) Sam's own squad code never hears of it: its door tools ran no order, spent no can, hold no entry
//   (7) the switch off: no cast is ever built and the room is taken by the element's own drill (its 'squeeze' / 'flow' beats), as it was
//   (8) a restart of a night that built a cast leaves nothing: no cast, no entry
//   (9) a man leaves the element under an entry (the roster the tools were dealt changes): the entry is let go of, the cans are the element's own count and
//       not a fresh bag's, and who is left re-forms and takes the room
//   (10) where Sam stands is not theirs to know: unseen on one of their stack marks, or a street away, the marks they are dealt are the same marks
//   (11) 'clear — negative contact' uses the fix up: the room they went into on it is not the next room on the same word (the element's own drill goes
//       back into it for as long as the fix stands)
//   (12) their can does to Sam what a can does to anyone (samstun.ts, raised here): stood in the room in the open when it goes, he is dazzled — the door
//       code spares the thrower's own side, and to this cast he is not on it
// QRFSQUAD_BREAK=1 = the switch left off for the 'on' lines (and on for the 'off' line): every line but (3) and (6) must fail.
import { standUp, ROOT } from './headless.ts';
const { requestQrf } = await import(`${ROOT}/src/game/qrf.ts`);
const { DoorTools } = await import(`${ROOT}/src/game/doortools.ts`);
const { SquadOrders } = await import(`${ROOT}/src/game/orders.ts`);
const { inBounds } = await import(`${ROOT}/src/game/squad.ts`);
const { SAMSTUN } = await import(`${ROOT}/src/game/samstun.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, BREAK = process.env.QRFSQUAD_BREAK === '1';
const f1 = (x: number) => x.toFixed(1);
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Sam out of it: on the lot's far corner, dark, invisible to the AI (the men are the subject) */
function hideSam(game: any) { game.teleportPlayer([37.5, 0, 26.5]); game.player.visibility = 0.02; game.playerInvisible = true; game.player.crouch = true; }
/** a floor with the response called from the panel and the alarm's place — the element's fix — put at `fix` */
async function called(seed: number, fix: Vec3, on: boolean) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.aiEnabled = true; game.tune.qrf = true; game.tune.qrfEta = 14; game.tune.qrfSize = 4; game.tune.perimeter = false; game.tune.qrfSquad = on;
  for (let i = 0; i < 20; i++) W.step(DT);
  hideSam(game); game.alarm.placed = true; game.alarm.pos = [...fix]; game.alarm.raisedAt = game.time;
  requestQrf(game, 'panel');
  return W;
}
const beats = (Q: any) => Q.log.map((l: any) => l.what as string);

export async function qrfSquadCheck(): Promise<boolean> {
  let all = true;
  const line = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`\n=== qrf-squad-check: the response team takes a room by the squad's own door and room code (tune.qrfSquad)${BREAK ? ' · QRFSQUAD_BREAK: the switch left off' : ''} ===`);
  let after11 = { room: '', next: '' };
  let restart: (() => { built: boolean; cast: unknown; op: unknown; state: string; held: number }) | null = null;
  let squadOrders = 0, squadOps = 0, squadBangs: number | null = null, squadBangsEnd: number | null = null;
  const watchSquad = (game: any) => { squadOps = Math.max(squadOps, game.doorTools.ops.length); squadOrders = Math.max(squadOrders, game.doorTools.stats.orders); squadBangs ??= game.doorTools.bangs; squadBangsEnd = game.doorTools.bangs; };

  // ---- (1) (2) (3): the room that holds the fix
  { const W = await called(41, [8, 0, 8], !BREAK); const { game } = W; const Q = game.qrf;
    let cast: any = null, kind = '', tStack = NaN, tIn = NaN, room = '', inside = 0, bangsAt = -1, strayBang = 0, theirs = 0, pool0 = -1;
    for (let f = 0; f < 60 * 90 && isNaN(tIn); f++) {
      hideSam(game); W.step(DT); watchSquad(game);
      if (Q.state === 'deployed' && pool0 < 0) pool0 = Q.bangs;
      if (Q.op && !cast) { cast = Q.cast; kind = Q.op.kind; tStack = game.time; room = Q.target.room; }
      const ids = new Set(Q.men.map((m: any) => m.char.id));
      for (const e of game.events) { if (e.time !== game.time) continue; if (e.kind === 'bang') strayBang++; if (e.kind === 'door' && e.loud && ids.has(e.who) && beats(Q).includes('bang')) theirs++; }
      if (cast && beats(Q).includes(`clear:${room}`)) { tIn = game.time; const B = Q.target.plan.bounds; inside = Q.men.filter((m: any) => m.state !== 'dead' && inBounds(m.char.pos, B, 0.2)).length; bangsAt = Q.bangs; }
    }
    const sameCode = !!cast && cast.tools instanceof DoorTools && cast.orders instanceof SquadOrders && cast.tools !== game.doorTools && cast.orders !== game.orders;
    const says = !!cast && cast.orders.sams === false && cast.orders.team === 'guard' && cast.orders.ring().has('any lock at all') && cast.orders.squad().length === Q.men.length;
    line(sameCode && says, '(1) at the door the element is a second cast of the squad\'s own DoorTools and SquadOrders — its own instances, its own answers', `cast ${cast ? 'built' : 'never built'} · same classes ${sameCode} · player not theirs / guards\' cans / every lock / roster the element ${says}`);
    const B = beats(Q), has = (re: RegExp) => B.some((b: string) => re.test(b));
    const ok2 = kind === 'bangClear' && has(/^drill:stacked/) && has(/^drill:toss:/) && has(/^drill:bang · inside/) && has(/^drill:go$/) && has(/^drill:searched · 0 of/) && has(/^drill-end:in$/) && inside === 4 && pool0 === 4 && bangsAt === 3 && tIn - tStack < 25;
    line(ok2, '(2) the room that holds the fix: bang and clear — stacked, the can in, in behind it, its floor searched, all four inside, called; the pool one can down', `order ${kind || '—'} on ${room || '—'} · stack→called ${f1(tIn - tStack)} s · inside at the call ${inside}/4 · cans ${pool0} → ${bangsAt} · ${B.filter((b: string) => /^drill[:-]/.test(b) && !/cross|hand kept|ordered/.test(b)).map((b: string) => b.replace(/^drill:/, '')).join(' | ').slice(0, 260)}`);
    let next = ''; for (let f = 0; f < 60 * 20 && !next && !isNaN(tIn); f++) { hideSam(game); W.step(DT); const L = Q.log.filter((l: any) => l.t > tIn && /^target:/.test(l.what)); if (L.length) next = L[0].what; }
    after11 = { room, next };
    line(strayBang === 0 && theirs >= 1, '(3) the can is theirs to the shift: no \'bang\' report left on the floor, a loud door-kind report with a response man\'s id in its place', `'bang' reports left ${strayBang} · re-filed as theirs ${theirs}`); }

  // ---- (4): a room that does not hold the fix is worked from the threshold
  { const W = await called(42, [30, 0, 11.2], !BREAK); const { game } = W; const Q = game.qrf;
    let done = false, kind = '', room = '';
    for (let f = 0; f < 60 * 150 && !done; f++) { hideSam(game); W.step(DT); watchSquad(game); if (Q.op) { kind = Q.op.kind; room = Q.target.room; } done = beats(Q).includes('drill-end:in'); }
    // (the jamb men either hold a diagonal each — 'holds', then 'set · N of M' and the floor seen during the hold — or, with the doorway cut on (DOORTOOLS.thrPie, the page's
    //  stand), cut the opening toward its middle first — 'slices', then 'sliced · N of M' with the floor already seen. Either way: less floor unseen, before anybody crosses)
    const B = beats(Q), set = B.find((b: string) => /^drill:(set|sliced) · \d+ of \d+ cells unseen/.test(b)) ?? '', m = /(?:set|sliced) · (\d+) of (\d+)/.exec(set), cut = /^drill:sliced/.test(set);
    const jambs = B.some((b: string) => /^drill:threshold · latch jamb .* (holds|slices)/.test(b)), iSet = B.indexOf(set), iCross = B.findIndex((b: string) => /^drill:cross:/.test(b)), stepIn = B.some((b: string) => /^drill:step in/.test(b));
    const held = B.find((b: string) => /^drill:held .* (\d+) of \d+ cells unseen/.test(b)) ?? '', h = /(\d+) of \d+ cells unseen/.exec(held), iHeld = B.indexOf(held);
    const sliced = !!m && !!h && iHeld >= 0 && (iCross < 0 || iHeld < iCross) && (cut ? Number(m[1]) < Number(m[2]) && Number(h[1]) <= Number(m[1]) && iSet < iHeld : Number(h[1]) < Number(m[1]));
    const ok = kind === 'threshold' && jambs && sliced && stepIn && done;
    line(ok, '(4) a room that does not hold the fix: the threshold — jambs held, floor seen from outside before anybody crosses, then the step in, the room taken', `order ${kind || '—'} on ${room || '—'} · jambs held ${jambs} · ${set.replace(/^drill:/, '') || 'never set'} → ${held.replace(/^drill:/, '') || 'never held'} · less unseen before the first man crossed ${sliced} · stepped in ${stepIn} · taken ${done}`); }

  // ---- (5): contact in the stack
  { const W = await called(43, [8, 0, 8], !BREAK); const { game } = W; const Q = game.qrf;
    let cast: any = null, tShown = NaN, tFight = NaN, pool = -1, alert = 0, left = -1, opLeft = true;
    for (let f = 0; f < 60 * 90; f++) {
      if (isNaN(tShown)) hideSam(game); else game.player.visibility = 1;
      W.step(DT); watchSquad(game);
      if (Q.op && !cast) cast = Q.cast;
      if (cast && isNaN(tShown) && Q.op && Q.op.phase === 'stack' && game.time - Q.op.t0 > 1.0) {   // stood up lit in the corridor a few strides from the man on the door, in his view
        const lead = Q.op.lead, p = lead.char.pos; game.playerInvisible = false; game.player.crouch = false; game.teleportPlayer([p[0] + 3.2, 0, 11.2]); game.player.visibility = 1; tShown = game.time;
        for (const m of Q.men) { m.char.setYaw?.(Math.PI / 2); } }
      if (!isNaN(tShown) && isNaN(tFight) && Q.phase === 'fight') { tFight = game.time; pool = Q.bangs; alert = Q.men.filter((m: any) => m.state === 'alert' && !m.script).length; left = Q.men.filter((m: any) => cast.orders.has(m)).length + cast.tools.ops.length; opLeft = !!Q.op; }
      if (!isNaN(tFight) || (!isNaN(tShown) && game.time - tShown > 6)) break;
    }
    const ok5 = !!cast && tFight - tShown <= 1.5 && alert === 4 && left === 0 && !opLeft && pool === 4; restart = () => { game.resetGuards(); for (let i = 0; i < 5; i++) W.step(DT); return { built: !!cast, cast: game.qrf.cast, op: game.qrf.op, state: game.qrf.state as string, held: cast ? cast.tools.ops.length + cast.orders.squad().filter((m: any) => cast.orders.has(m)).length : -1 }; };
    line(ok5, '(5) contact in the stack: all four to the fight inside 1.5 s, the entry let go of, the unthrown can back in the pool', `shown at ${f1(tShown)} · fight ${isNaN(tFight) ? 'NEVER' : `${(tFight - tShown).toFixed(2)} s later`} · alert and off the script ${alert}/4 · still on the cast's books ${left} · entry kept ${opLeft} · cans ${pool}`); }

  // ---- (6): Sam's own squad code
  line(squadOps === 0 && squadOrders === 0 && squadBangs === squadBangsEnd, '(6) Sam\'s own door tools never heard of it: no order run, no entry held, no can spent', `squad door tools: most entries at once ${squadOps} · orders run ${squadOrders} · cans ${squadBangs} → ${squadBangsEnd}`);

  // ---- (7): the switch off = the element's own drill
  { const W = await called(41, [8, 0, 8], BREAK); const { game } = W; const Q = game.qrf;
    let done = false, built = false;
    for (let f = 0; f < 60 * 90 && !done; f++) { hideSam(game); W.step(DT); built ||= !!Q.cast; done = beats(Q).some((b: string) => b.startsWith('clear:')); }
    const B = beats(Q);
    line(!built && done && B.includes('squeeze') && B.includes('flow') && !B.some((b: string) => b.startsWith('drill')), '(7) the switch off: no cast is built, the room is taken by the element\'s own drill', `cast built ${built} · own drill's beats squeeze ${B.includes('squeeze')} flow ${B.includes('flow')} · squad-drill beats ${B.filter((b: string) => b.startsWith('drill')).length} · room called ${done}`);
  }
  { const R = restart!();
    line(R.built && R.cast === null && R.op === null && R.state === 'idle' && R.held === 0, '(8) a restart of a night that built a cast leaves nothing: no cast, no entry, nobody on the old cast\'s books, the response idle', `a cast had been built ${R.built} · cast ${R.cast === null ? 'none' : 'LEFT'} · entry ${R.op === null ? 'none' : 'LEFT'} · on the old cast's books ${R.held} · state ${R.state}`); }

  line(!!after11.room && !!after11.next && after11.next !== `target:room:${after11.room}`, '(11) the room called clear on the fix is not the next room on the same word', `called clear: ${after11.room || '—'} · next: ${after11.next || 'nothing picked in 20 s'}`);

  // ---- (9): a man leaves the element under an entry
  { const W = await called(44, [8, 0, 8], !BREAK); const { game } = W; const Q = game.qrf;
    let cut = NaN, pool = -1, most = -1, gone = false, cleared = false, left = 0, inside = 0, out: any = null;
    for (let f = 0; f < 60 * 150 && !cleared; f++) {
      hideSam(game); W.step(DT);
      if (isNaN(cut) && Q.op && Q.op.phase === 'stack' && game.time - Q.op.t0 > 1.0) { cut = game.time; pool = Q.bangs; out = Q.men[Q.men.length - 1]; Q.men = Q.men.slice(0, -1); out.script = null; out.hold = true; }   // the rear man taken off the element where he stands
      if (!isNaN(cut)) { most = Math.max(most, Q.bangs); gone ||= beats(Q).includes('drill-end:gone'); if (game.time > cut + 0.5 && beats(Q).some((b: string) => b.startsWith('clear:'))) { cleared = true; left = Q.men.length; const B = Q.target.plan.bounds; inside = Q.men.filter((m: any) => inBounds(m.char.pos, B, 0.2)).length; } }
    }
    line(gone && cleared && left === 3 && inside === 3 && pool === 4 && most <= pool && !Q.cast.orders.has(out), '(9) a man leaves the element under an entry: it is let go of, the cans stay the element\'s own count, the three left re-form and take the room', `entry ended 'gone' ${gone} · cans at the cut ${pool}, most held after ${most} · room called ${cleared} with ${inside}/${left} inside · the man who left on the cast's books ${out ? Q.cast?.orders.has(out) : '—'}`); }

  // ---- (10): where Sam stands is not theirs to know
  { const marks = async (onMark: Vec3 | null) => { const W = await called(45, [8, 0, 8], !BREAK); const { game } = W; const Q = game.qrf; let P: Vec3[] | null = null;
      for (let f = 0; f < 60 * 90 && !P; f++) { hideSam(game);
        if (onMark && Q.state === 'deployed') game.teleportPlayer(onMark);
        W.step(DT); if (Q.op) P = Q.men.map((m: any) => Q.op.post.get(m)?.pos).filter(Boolean).map((p: Vec3) => [p[0], p[1], p[2]] as Vec3); }
      return P; };
    const far = await marks(null), on = far?.length ? await marks(far[far.length - 1]) : null;   // (the rear man's mark: with the seam out — SquadOrders.samStood answering for any cast — the marks move 5.9 m here)
    const worst = far && on && far.length === on.length ? Math.max(...far.map((p, i) => Math.hypot(p[0] - on[i][0], p[2] - on[i][2]))) : NaN;
    line(!!far && far.length === 4 && worst < 1e-6, '(10) where Sam stands is not theirs to know: unseen on their rear man\'s stack mark, the four marks they are dealt are the ones dealt with him a street away', `marks dealt ${far?.length ?? 0} · furthest any mark moved with Sam stood on the rear man's ${isNaN(worst) ? '—' : worst.toFixed(3) + ' m'}`); }

  // ---- (12): their can and Sam
  { const was = SAMSTUN.on;
    try { const W = await called(46, [8, 0, 8], !BREAK); const { game } = W; const Q = game.qrf; SAMSTUN.on = true;   // (after the stand-up: the frozen stand holds it off)
      let at: Vec3 | null = null, banged = false, dazzled = 0, far = NaN;
      for (let f = 0; f < 60 * 90 && !(banged && game.time > (Q.log.find((l: any) => l.what === 'bang')?.t ?? 1e9) + 0.5); f++) {
        if (!at) hideSam(game); else { game.teleportPlayer(at); game.player.visibility = 0.02; game.playerInvisible = true; game.player.crouch = false; }
        W.step(DT);
        if (!at && (Q.op || Q.phase === 'stack')) { const P = Q.target.plan, B = P.bounds, d = game.doors.byName(P.door).frameCentre, c: Vec3 = [(B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2], l = Math.hypot(c[0] - d[0], c[2] - d[2]) || 1; at = [d[0] + (c[0] - d[0]) / l * 2.6, 0, d[2] + (c[2] - d[2]) / l * 2.6]; }
        if (beats(Q).includes('bang')) { banged = true; dazzled = Math.max(dazzled, game.player.dazzledUntil - game.time); const b = [...game.events].reverse().find((e: any) => e.kind === 'door' && e.loud && e.level === 1.0); if (b && at) far = Math.hypot(b.pos[0] - at[0], b.pos[2] - at[2]); }
      }
      line(banged && dazzled > 0.5, '(12) their can does to Sam what a can does to anyone: stood in the open in the room when it goes, he is dazzled', `the can went ${banged} · ${isNaN(far) ? '—' : far.toFixed(1) + ' m'} from him · dazzled ${dazzled.toFixed(1)} s`);
    } finally { SAMSTUN.on = was; } }

  console.log(`=== qrf-squad-check: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}
if (import.meta.main) process.exit((await qrfSquadCheck()) ? 0 : 1);
