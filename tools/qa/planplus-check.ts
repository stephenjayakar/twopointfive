// PLAN MODE'S THREE LATER RULES (src/game/planmode.ts; the maintainer, 10-22) —
//   CMDRING.planLook  "you should be able to right click drag on a path and have them check that direction, like door kickers" · "if they're given
//                     an angle while not moving, they should probably just cover that"
//   CMDRING.planWaits "let's also make it possible to add and remove F waits in the plan. and then I think we can change the flow to be that
//                     pressing F only releases the people blocked on it"
//   CMDRING.planKnee  "plan mode should also show the player taking a knee and talking on the radio, and then camera can decouple from them and move
//                     (up to some limit) with wasd and then gently snap back when exiting the mode"
// Each is on in the page (?planlook=0 · ?planwaits=0 · ?planknee=0) and off in the module and on the frozen stand (TPS_PLANLOOK=1 · TPS_PLANWAITS=1 ·
// TPS_PLANKNEE=1, each with TPS_QRING=1 TPS_QPLAN=1). Driven by the real buttons and keys on the office room clear, a squad of four:
//   (1) the stand; (2) a right drag on the floor: the order, and the men cover that way once they stand there; (3) a right click with no drag is the
//   order it was; (4) a right drag on a standing man: he covers that way and walks nowhere; (5) a stop with a way and a stop after it: the look held
//   `planLookSecs`, then on; (6) a click on a door's stop takes its wait off — the men go in with no word; (7) … taken off under men stood on it, they
//   go in at once — off a door they cannot go through it is back on; (8) a click on a floor stop puts a hold there — they stay until the word; (9) a word given early is not kept: they wait at the
//   door all the same, and the word then sends them in; (10) he takes a knee, the hand at the radio, the gun low — and stands again on leaving, or
//   stays down if he was; (11) the view left away from him eases back over `planBackSecs`; (12) the journal and the page's flags.
//   bun run tools/qa/planplus-check.ts        (also `probes.ts planplus`, family squadorders)
//   PLANPLUS_BREAK=1 …  the three switches left off: the lines below must fail
//   exit 0 = all hold · 1 = one does not
import { standUp, ROOT } from './headless.ts';
import { rig, doorsNear, aimOf, floorSpot, dist } from './planmode-check.ts';

const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const PM: any = await import(`${ROOT}/src/game/planmode.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const PROFILE: any = await import(`${ROOT}/src/host/profile.ts`), { FROZEN_HOLDS } = PROFILE;
const JOURNAL: any = await import(`${ROOT}/src/game/journal.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { PLAN_STATS, planView } = PM;

const BREAK = process.env.PLANPLUS_BREAK === '1';
const KEYS: [string, string][] = [['planLook', 'TPS_PLANLOOK'], ['planWaits', 'TPS_PLANWAITS'], ['planKnee', 'TPS_PLANKNEE']];

export async function planplusCheck(): Promise<boolean> {
  let fails = 0;
  const line = (ok: boolean, what: string, got: string) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${what} — ${got}`); if (!ok) fails++; };
  const C = CMDRING as any, knobs0 = knobsCopy(), rnd0 = Math.random, ap0 = AUTOPILOT.on, log = console.log;
  const quiet = async <T>(f: () => Promise<T>): Promise<T> => { console.log = () => {}; try { return await f(); } finally { console.log = log; } };
  console.log(`plan mode: a way to look, its own waits, the knee at the radio (src/game/planmode.ts)${BREAK ? ' — PLANPLUS_BREAK=1: the switches left off, the lines below must fail' : ''}`);
  try {
    // (1) the stand, read off the first stand-up before the check sets anything
    { await quiet(() => standUp({})); const shipped = process.env.TPS_PROFILE === 'shipped', E = process.env;
      const got = KEYS.map(([k]) => `${k} ${C[k]}`).join(' · '), want = KEYS.every(([k, w]) => C[k] === (E[w] !== undefined ? E[w] === '1' && C.plan && (k === 'planWaits' || C.planRts) : shipped && C.plan));
      const rows = KEYS.every(([k, w]) => String(FROZEN_HOLDS[`CMDRING.${k}`] ?? '').includes(`${w}=1`) && PROFILE.STAND_ENV.includes(w));
      line(want && rows, `the stand: the three switches ${shipped ? 'on, as the page opens' : 'held off, as every frozen tally was recorded'}; FROZEN_HOLDS carries each row and word`,
        `after the stand-up: ${got} (plan mode ${C.plan}) · TPS_PROFILE ${E.TPS_PROFILE ?? 'unset'} · rows and words ${rows ? 'there' : 'MISSING'}`); }

    const R = await quiet(() => rig(1, true)), g = R.game, O = R.O, P = R.P, I = R.input, W = R.W, pl = g.player;
    C.planLook = C.planWaits = C.planKnee = !BREAK;
    const px = (p: number[]): number[] => { const [x, y] = W.cam.project([p[0], p[1] ?? 0, p[2]], W.canvas.clientWidth, W.canvas.clientHeight); return [x, y]; };
    const at = (s: number[]) => { I.mouseX = s[0]; I.mouseY = s[1]; R.step(2); };
    /** a right press at one place on the screen, dragged to another, let go */
    const rdrag = (a: number[], b: number[], shift = false) => { if (shift) I.keys.add('ShiftLeft'); at(a); I.clicked |= 4; I.buttons |= 4; R.step();
      for (let k = 1; k <= 4; k++) { I.mouseX = a[0] + (b[0] - a[0]) * k / 4; I.mouseY = a[1] + (b[1] - a[1]) * k / 4; R.step(); }
      I.buttons &= ~4; R.step(); if (shift) { I.keys.delete('ShiftLeft'); R.step(); } };
    /** a left click on the stop a chain's step is drawn at */
    const clickStop = (p: number[]) => { at(px([p[0], 0, p[2]])); R.click(1); };
    const view = () => planView(O), keys = (c = 0, i = 0) => view()?.chains[c]?.stops[i]?.keys;
    const WAYS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]], yaw = (w: number[]) => Math.atan2(w[0], w[1]), off = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
    const covers = (men: any[], way: number[]) => men.map((m: any) => { const A = O.of(m), t = A?.watch ?? null; return A?.order === 'cover' && t ? off(yaw([t[0] - m.char.pos[0], t[2] - m.char.pos[2]]), yaw(way)) : 9; });
    const used = new Set<any>(), doors = () => { const all = doorsNear(R).filter((x: any) => !x.d.locked && !x.d.def?.locked && aimOf(R, x.d)), fresh = all.filter((x: any) => !used.has(x.d)); const x = fresh[0] ?? all[0]; if (x) used.add(x.d); return x ? [x] : []; };   // (a door nobody has been through yet: an entry is asked of each)
    const entries = ['bangClear', 'openClear', 'charge', 'bigClear', 'fragClear'], entered = (n: number) => O.log.slice(n).some((r: any) => entries.includes(r.order));

    /** a second place on the same floor as `a`: the cursor's own hit is the place asked for (not ground past a wall, seen over it) */
    const near2 = (a: number[]): number[] | null => { const s0 = pl.char.pos;
      for (const [dx, dz] of [[-2.5, 0], [0, -2.5], [2.5, 0], [0, 2.5], [-2, -2], [2, -2], [-2, 2], [2, 2], [-3.5, 0], [0, -3.5]]) { const q = [s0[0] + dx, 0.04, s0[2] + dz]; if (dist(q, a) < 1.8) continue;
        const h = R.aim(q); if (h?.kind === 'floor' && !h.wall && !h.thing && dist(h.at, q) < 0.4 && O.defaultFor(h)?.id === 'move' && O.whyNot(O.defaultFor(h), h) === null) return q; }
      return null; };

    // (2) a right drag on the floor
    { let got = '', ok = false;
      for (const way of WAYS) { R.home(true); const spot = floorSpot(R); if (!spot) { got = 'no floor spot'; break; }
        const n0 = PLAN_STATS.looks, l0 = O.log.length; rdrag(px(spot), px([spot[0] + way[0] * 3, 0, spot[2] + way[1] * 3]));
        const S0 = P.chains[0]?.steps[0], kept = !!S0?.look && off(yaw(S0.look), yaw(way)) < 0.2, went = O.log[l0]?.order === 'move', drawn = !!view()?.chains[0]?.stops[0]?.look;
        R.until(() => P.chains.length === 0, 30); R.step(30); const c = covers(R.team, way), near = R.team.every((m: any) => dist(m.char.pos, spot) < 4);
        got = `way ${way}: the stop keeps it ${kept}, drawn ${drawn}, first order ${O.log[l0]?.order ?? '(none)'} · there: looks ${PLAN_STATS.looks - n0}, each man's cover off the way ${c.map(x => x.toFixed(2)).join(' / ')} rad, all within 4 m of the spot ${near}`;
        if (kept && went && drawn && PLAN_STATS.looks === n0 + 1 && c.every(x => x < 0.35) && near) { ok = true; break; } }
      line(ok, 'a right press dragged on the floor: the order goes there, its stop keeps the way and draws it, and the men cover that way once they stand there', got); }

    // (3) a right click with no drag
    { R.home(true); const spot = floorSpot(R)!, n0 = PLAN_STATS.looks; R.aim(spot); R.click(4); const S0 = P.chains[0]?.steps[0], plain = !!S0 && S0.look === undefined, went = R.tail()?.order;
      R.until(() => P.chains.length === 0, 30); R.step(20);
      line(plain && went === 'move' && PLAN_STATS.looks === n0 && R.team.every((m: any) => O.of(m)?.order !== 'cover'), 'a right click with no drag is the order it was: no way kept, nobody set to cover', `the stop's way ${S0?.look ?? 'none'} · order ${went} · looks +${PLAN_STATS.looks - n0}`); }

    // (4) a right drag on a standing man
    { let got = '', ok = false;
      for (const way of WAYS) { R.home(true); const m = R.team[1], p0 = [...m.char.pos], n0 = PLAN_STATS.looks, c0 = P.chains.length;
        rdrag(px([p0[0], 1.0, p0[2]]), px([p0[0] + way[0] * 3, 0, p0[2] + way[1] * 3])); R.step(90);
        const c = covers([m], way)[0], others = R.team.filter((x: any) => x !== m).every((x: any) => O.of(x)?.order !== 'cover'), moved = dist(m.char.pos, p0);
        got = `way ${way}: ${m.callsign} cover off the way ${c.toFixed(2)} rad, moved ${moved.toFixed(2)} m, chains +${P.chains.length - c0}, looks +${PLAN_STATS.looks - n0}, the others left alone ${others}`;
        if (c < 0.35 && moved < 0.4 && P.chains.length === c0 && PLAN_STATS.looks === n0 + 1 && others) { ok = true; break; } }
      line(ok, 'a right press dragged off a standing man: he covers that way from where he stands, nobody walks, no chain is made', got); }

    // (5) a stop with a way and a stop after it
    { let got = '', ok = false;
      for (const way of WAYS) { R.home(true); const a = floorSpot(R), b = a ? near2(a) : null; if (!a || !b) { got = 'no two floor spots'; break; }
        rdrag(px(a), px([a[0] + way[0] * 3, 0, a[2] + way[1] * 3])); R.aim(b); R.click(4, true); const Ch = P.chains[0], two = Ch?.steps.length === 2;
        const seen = R.until(() => Ch?.phase === 'look', 30), t0 = g.time, n = O.log.length; R.until(() => Ch?.phase !== 'look', 6); const held = g.time - t0, on = O.log.slice(n).some((r: any) => r.order === 'move');
        R.until(() => P.chains.length === 0, 30);
        got = `way ${way}: two stops ${two} · the look reached ${seen}, held ${held.toFixed(2)} s (planLookSecs ${C.planLookSecs}), then a move ${on}, the chain done ${P.chains.length === 0}`;
        if (two && seen && Math.abs(held - C.planLookSecs) < 0.15 && on && P.chains.length === 0) { ok = true; break; } }
      line(ok, 'a stop with a way and a stop after it: the men look that way for planLookSecs, then walk on by themselves', got); }

    // (6) a door's wait taken off before they are there
    { R.home(true); const A = doors()[0]; let got = 'no door to aim at', ok = false;
      if (A) { R.aim(aimOf(R, A.d)!); R.click(4); const Ch = P.chains[0], k0 = keys(), n0 = PLAN_STATS.waits, n = O.log.length; clickStop(A.d.frameCentre); const off1 = Ch?.steps[0]?.wait === false, k1 = keys();
        const done = R.until(() => entered(n), 45); R.until(() => P.chains.length === 0, 45);
        got = `the stop's keys ${k0} → ${k1}, its wait off ${off1}, waits stepped +${PLAN_STATS.waits - n0} · with no word: an entry ordered ${done}, the chain done ${P.chains.length === 0}`;
        ok = k0 === 1 && k1 === 0 && off1 && done && P.chains.length === 0; }
      line(ok, "a click on a door's stop takes its wait off: the mark goes, and the men go in when they are stacked with no word from him", got); }

    // (7) … and under men stood on it
    { R.home(true); const A = doors()[0]; let got = 'no door to aim at', ok = false;
      if (A) { R.aim(aimOf(R, A.d)!); R.click(4); const Ch = P.chains[0]; const waited = R.until(() => Ch?.phase === 'wait', 30); R.step(60); const n = O.log.length, still = Ch?.phase === 'wait'; clickStop(A.d.frameCentre); R.step(2);
        const went = entered(n), ph = Ch?.phase, w = Ch?.steps[0]?.wait, sp = px([A.d.frameCentre[0], 0, A.d.frameCentre[2]]).map((x: number) => Math.round(x)); R.until(() => P.chains.length === 0, 45);
        got = `stacked and waiting ${waited}, a second later still ${still} · the click (at ${sp} px): the wait ${w === false ? 'off' : 'on'}, phase ${ph}, an entry ordered ${went}, the chain done ${P.chains.length === 0}`; ok = waited && still && went && P.chains.length === 0; }
      line(ok, 'the wait taken off under men stood on it: they go in at once', got); }

    // (7b) … off a door they cannot go through: the wait is back on it
    { R.home(true); const L = doorsNear(R).find((x: any) => x.d.locked && aimOf(R, x.d)); let got = 'no locked door on this floor: nothing to ask', ok = true;
      if (L) { R.aim(aimOf(R, L.d)!); R.click(4); const Ch = P.chains[0]; const waited = R.until(() => Ch?.phase === 'wait', 40); R.step(30); const n = O.log.length; clickStop(L.d.frameCentre); R.step(2);
        const back = Ch?.steps[0]?.wait !== false, k = keys(), quiet = !entered(n), ph = Ch?.phase; R.step(120); const calm = O.log.length === n;
        got = `stacked on a locked door ${waited} · the click: no entry ${quiet}, phase ${ph}, the wait ${back ? 'back on' : 'left off'}, the stop's keys ${k}, two seconds on nothing more ordered ${calm}`; ok = BREAK ? false : waited && quiet && back && k === 1 && ph === 'wait' && calm; }
      line(ok, 'the wait taken off a door the men cannot go through: they say why once, stay, and the wait and its mark are back', got); }

    // (8) a hold put on a floor stop
    { R.home(true); const spot = floorSpot(R); let got = 'no floor spot', ok = false;
      if (spot) { R.aim(spot); R.click(4); const Ch = P.chains[0], k0 = keys(); clickStop(Ch?.steps[0]?.at ?? spot); const k1 = keys(), on = Ch?.steps[0]?.hold === true;
        const held = R.until(() => Ch?.phase === 'held', 30); R.step(150); const still = Ch?.phase === 'held' && P.chains.includes(Ch); R.word(); R.step(5); const freed = !P.chains.includes(Ch);
        got = `the stop's keys ${k0} → ${k1}, a hold on it ${on} · there: held ${held}, two and a half seconds on still ${still} · the word: the chain let go ${freed}`; ok = k0 === 0 && k1 === 1 && on && held && still && freed; }
      line(ok, 'a click on a floor stop puts a wait there: its mark shows, the men hold on it, and the word lets them go', got); }

    // (9) a word given early is not kept
    { R.home(true); const A = doors()[0]; let got = 'no door to aim at', ok = false;
      if (A) { R.aim(aimOf(R, A.d)!); R.click(4); const Ch = P.chains[0]; R.step(20); const early = Ch?.phase === 'go'; R.word(); const spent = !!Ch?.spent;
        const waited = R.until(() => Ch?.phase === 'wait', 30); R.step(90); const still = Ch?.phase === 'wait', n = O.log.length; R.word(); R.step(2); const went = entered(n), ph = Ch?.phase, tl = O.log.slice(n).map((r: any) => r.order).join(',') || '(nothing)'; R.until(() => P.chains.length === 0, 45);
        got = `the word while they walk (phase go ${early}): kept ${spent} · at the door they wait ${waited}, a second and a half on still ${still} · the word then: an entry ordered ${went} (phase ${ph}, orders since: ${tl}; door ${A.d.name ?? '?'})`; ok = early && !spent && waited && still && went; }
      line(ok, 'the word frees only men who are waiting on it: given while they walk it is not kept, they wait at the door all the same, and the word there sends them in', got); }

    // (10) the knee at the radio
    { R.home(false); pl.crouch = false; R.step(30); const A = pl.char.anim, r0 = A.radioShown; R.toggle(); const c1 = pl.crouch, stood = P.stood; R.step(50); const r1 = A.radioShown, low = A.crouchTarget, up1 = A.upper;
      R.toggle(); const c2 = pl.crouch; R.step(120); const r2 = A.radioShown;
      pl.crouch = true; R.step(20); R.toggle(); R.step(10); R.toggle(); const c3 = pl.crouch; pl.crouch = false; R.step(20);
      line(!c1 === BREAK && c1 && stood === true && r1 > 0.6 && r0 < 0.1 && up1 === 'none' && !c2 && r2 < 0.2 && c3,
        'the mode up: he is down on a knee, the gun low, his hand at the radio; the mode down: he stands again and the hand comes off — a man who was already down stays down',
        `standing, the hand at the radio ${r0.toFixed(2)} · up: crouch ${c1} (stood before ${stood}), the hand ${r1.toFixed(2)}, crouch pose ${Number(low).toFixed(2)}, the gun's upper pose '${up1}' · down: crouch ${c2}, the hand ${r2.toFixed(2)} · crouched before and after: ${c3}`); }

    // (11) the view eases back
    { R.home(true); I.keys.add('KeyD'); R.step(70); I.keys.delete('KeyD'); R.step(2); const sam = pl.char.pos, d0 = P.look ? dist(P.look, sam) : 0;
      R.toggle(); const a = PM.planLook(O), da = a ? dist(a, sam) : -1; R.step(Math.round(C.planBackSecs * 30) - 2); const b = PM.planLook(O), db = b ? dist(b, sam) : -1;
      R.step(Math.round(C.planBackSecs * 30) + 4); const c = PM.planLook(O), gone = P.back === null, f = g.followPos(), home = dist(f, sam) < 1e-6;
      line(d0 > 3 && da > d0 * 0.8 && db > d0 * 0.2 && db < d0 * 0.8 && c === null && gone && home, 'the view left away from him, the mode put down: it comes back to him over planBackSecs, eased, and is his again',
        `the view ${d0.toFixed(1)} m off him · the mode down: ${da.toFixed(1)} m · half way through ${db.toFixed(1)} m · after ${C.planBackSecs} s: ${c === null ? 'his' : 'still away'}, the state let go ${gone}, the camera follows him ${home}`); }

    // (12) the journal and the page's flags
    { const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      for (const [k] of KEYS) C[k] = true; const old = snap(); for (const [k] of KEYS) delete old.tables.CMDRING[k]; JOURNAL.applyKnobs(g, old); const without = KEYS.map(([k]) => C[k]).join();
      const own = snap(); for (const [k] of KEYS) own.tables.CMDRING[k] = true; JOURNAL.applyKnobs(g, own); const withIt = KEYS.map(([k]) => C[k]).join();
      const flags = (q: string) => { PROFILE.pageSwitches(new URLSearchParams(q)); return KEYS.map(([k]) => (C[k] ? 1 : 0)).join(''); };
      const a = flags(''), b = flags('planlook=0'), c = flags('planwaits=0'), d = flags('planknee=0'), e = flags('qplan=0');
      line(without === 'false,false,false' && withIt === 'true,true,true' && a === '111' && b === '011' && c === '101' && d === '110' && e === '000',
        'a recording from before the keys replays with them off, one with them keeps them; the page opens with all three on — ?planlook=0, ?planwaits=0 and ?planknee=0 each put one off, ?qplan=0 all three',
        `applyKnobs with no keys → ${without} · with them → ${withIt} · (look, waits, knee) '' → ${a} · planlook=0 → ${b} · planwaits=0 → ${c} · planknee=0 → ${d} · qplan=0 → ${e}`); }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; AUTOPILOT.on = ap0; }
  const all = fails === 0;
  console.log(`=== planplus: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await planplusCheck()) ? 0 : 1);
