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
import { rig, doorsNear, aimOf, dist } from './planmode-check.ts';

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

    /** a place on the floor he stands on, clear of the men (and of `a`): the cursor's own hit is the place asked for (not ground past a wall, seen over it) */
    const near2 = (a: number[] | null): number[] | null => { const s0 = pl.char.pos;
      for (const [dx, dz] of [[-2.5, 0], [0, -2.5], [2.5, 0], [0, 2.5], [-2, -2], [2, -2], [-2, 2], [2, 2], [-3.5, 0], [0, -3.5]]) { const q = [s0[0] + dx, 0.04, s0[2] + dz]; if ((a && dist(q, a) < 1.8) || R.team.some((m: any) => dist(m.char.pos, q) < 1.2)) continue;
        const h = R.aim(q); if (h?.kind === 'floor' && !h.wall && !h.thing && dist(h.at, q) < 0.4 && O.defaultFor(h)?.id === 'move' && O.whyNot(O.defaultFor(h), h) === null) return q; }
      return null; };

    /** the view walked (the mode's own W A S D) until a place is on the picture, as a hand would before clicking it */
    const panTo = (p: number[]): boolean => { const w = W.canvas.clientWidth, h = W.canvas.clientHeight, M = 140; let ok = false;
      for (let i = 0; i < 400 && !ok; i++) { const q = px([p[0], 0, p[2]]); const ks = [q[1] < M ? 'KeyW' : q[1] > h - M ? 'KeyS' : '', q[0] < M ? 'KeyA' : q[0] > w - M ? 'KeyD' : ''].filter(Boolean); if (!ks.length) { ok = true; break; }
        for (const k of ks) I.keys.add(k); R.step(2); for (const k of ks) I.keys.delete(k); }
      R.step(40); const q = px([p[0], 0, p[2]]); return q[0] > 0 && q[1] > 0 && q[0] < w && q[1] < h; };
    /** the men round him, the mode up, the view on him again */
    const fresh = () => { R.home(true); if (P.look) { P.look = [pl.char.pos[0], 0, pl.char.pos[2]]; } R.step(50); };

    // (2) a right drag on the floor (every way tried: one along x and one along z must hold — a man with a wall at his shoulder that way refuses the cover)
    { const got: string[] = []; let okX = false, okZ = false;
      for (const way of WAYS) { fresh(); const spot = near2(null); if (!spot) { got.push('no floor spot'); break; }
        const n0 = PLAN_STATS.looks, l0 = O.log.length; rdrag(px(spot), px([spot[0] + way[0] * 3, 0, spot[2] + way[1] * 3]));
        const S0 = P.chains[0]?.steps[0], kept = !!S0?.look && off(yaw(S0.look), yaw(way)) < 0.2, went = O.log[l0]?.order === 'move', drawn = !!view()?.chains[0]?.stops[0]?.look;
        R.until(() => P.chains.length === 0, 30); R.step(30); const c = covers(R.team, way), near = R.team.every((m: any) => dist(m.char.pos, spot) < 4);
        const ok = kept && went && drawn && PLAN_STATS.looks === n0 + 1 && c.every(x => x < 0.35) && near; if (ok) { if (way[0]) okX = true; else okZ = true; }
        got.push(`way ${way}: ${ok ? 'holds' : 'NOT'} (kept ${kept}, drawn ${drawn}, first order ${O.log[l0]?.order ?? '(none)'}, looks +${PLAN_STATS.looks - n0}, cover off the way ${c.map(x => x === 9 ? 'none' : x.toFixed(2)).join(' / ')} rad, near the spot ${near})`); }
      line(okX && okZ, 'a right press dragged on the floor: the order goes there, its stop keeps the way and draws it, and the men cover that way once they stand there', got.join(' · ')); }

    // (3) a right click with no drag
    { fresh(); const spot = near2(null)!, n0 = PLAN_STATS.looks; R.aim(spot); R.click(4); const S0 = P.chains[0]?.steps[0], plain = !!S0 && S0.look === undefined, went = R.tail()?.order;
      R.until(() => P.chains.length === 0, 30); R.step(20);
      line(plain && went === 'move' && PLAN_STATS.looks === n0 && R.team.every((m: any) => O.of(m)?.order !== 'cover'), 'a right click with no drag is the order it was: no way kept, nobody set to cover', `the stop's way ${S0?.look ?? 'none'} · order ${went} · looks +${PLAN_STATS.looks - n0}`); }

    /** is the place three metres `way` of `p` floor the cursor can be let go on (not ground past a wall, seen over it) */
    const open3 = (p: number[], way: number[]): boolean => { const q = [p[0] + way[0] * 3, 0.04, p[2] + way[1] * 3], h = R.aim(q); return h?.kind === 'floor' && dist(h.at, q) < 0.4; };

    /** the man of the four with the most open floor round him (one stood past a wall from the view has none the cursor can reach) */
    const roomy = (): any => [...R.team].sort((a: any, b: any) => WAYS.filter(w => open3(b.char.pos, w)).length - WAYS.filter(w => open3(a.char.pos, w)).length)[0];

    // (4) a right drag on a standing man (all four ways: each one a man takes must be right, and two at least are taken)
    { const got: string[] = [], STEP = 0.75; let n = 0, bad = 0;   // (a man settling into his place shuffles under half a metre; a walk to the place dragged to would be three)
      for (const way of WAYS) { fresh(); const m = roomy(), p0 = [...m.char.pos], n0 = PLAN_STATS.looks, c0 = P.chains.length;
        if (!open3(p0, way)) { got.push(`way ${way}: no open floor three metres that way of him`); continue; }
        rdrag(px([p0[0], 1.0, p0[2]]), px([p0[0] + way[0] * 3, 0, p0[2] + way[1] * 3])); R.step(90);
        const c = covers([m], way)[0], others = R.team.filter((x: any) => x !== m).every((x: any) => O.of(x)?.order !== 'cover'), moved = dist(m.char.pos, p0);
        const took = PLAN_STATS.looks === n0 + 1, ok = took && c < 0.35 && moved < STEP && P.chains.length === c0 && others; if (ok) n++; else if (took || moved >= STEP || P.chains.length !== c0 || !others) bad++;   // (a man with a wall at his shoulder that way refuses the cover: not a failure of the drag)
        got.push(`way ${way}: ${ok ? 'holds' : 'NOT'} (${m.callsign} cover off the way ${c === 9 ? 'none' : c.toFixed(2)} rad, moved ${moved.toFixed(2)} m, chains +${P.chains.length - c0}, looks +${PLAN_STATS.looks - n0}, the others left alone ${others})`); }
      line(n >= 2 && bad === 0, 'a right press dragged off a standing man: he covers that way from where he stands, nobody walks, no chain is made', got.join(' · ')); }

    // (4b) Shift and a right drag off a man who is on a plan: he stays on it, and its last stop keeps the way
    { fresh(); const a = near2(null), b = a ? near2(a) : null; let got = 'no two floor spots', ok = false;
      if (a && b) { R.aim(a); R.click(4); const Ch = P.chains[0]; clickStop(Ch.steps[0].at); R.aim(b); R.click(4, true); const who0 = Ch.who.length, held = R.until(() => Ch.phase === 'held', 30);
        const m = roomy(), p0 = [...m.char.pos], wy = WAYS.find(w => open3(p0, w)) ?? WAYS[0], n0 = PLAN_STATS.looks; rdrag(px([p0[0], 1.0, p0[2]]), px([p0[0] + wy[0] * 3, 0, p0[2] + wy[1] * 3]), true);
        const still = P.chains.length === 1 && P.chains[0] === Ch && Ch.who.length === who0 && Ch.steps.length === 2 && Ch.phase === 'held', way = Ch.steps[1]?.look, set = !!way && off(yaw(way), yaw(wy)) < 0.45, calm = O.of(m)?.order !== 'cover';
        R.word(); R.until(() => P.chains.length === 0, 30); R.step(20); const looked = PLAN_STATS.looks === n0 + 1;
        got = `held on the first of two stops ${held} · the drag (way ${wy}): one chain with its ${who0} men and both stops ${still}, its last stop's way ${way ? way.map((x: number) => x.toFixed(1)) : 'none'}, he is not turned yet ${calm} · the word, and at the last stop they look that way ${looked}`; ok = held && still && set && calm && looked; }
      line(ok, 'Shift and a right press dragged off a man on a plan: nobody is taken off it, its last stop keeps the way, and they look that way when they get there', got); }

    // (5) a stop with a way and a stop after it
    { let got = '', ok = false;
      for (const way of WAYS) { fresh(); const a = near2(null), b = a ? near2(a) : null; if (!a || !b) { got = 'no two floor spots'; break; }
        rdrag(px(a), px([a[0] + way[0] * 3, 0, a[2] + way[1] * 3])); R.aim(b); R.click(4, true); const Ch = P.chains[0], two = Ch?.steps.length === 2;
        const seen = R.until(() => Ch?.phase === 'look', 30), t0 = g.time, n = O.log.length; R.until(() => Ch?.phase !== 'look', 6); const held = g.time - t0, on = O.log.slice(n).some((r: any) => r.order === 'move');
        R.until(() => P.chains.length === 0, 30);
        got = `way ${way}: two stops ${two} · the look reached ${seen}, held ${held.toFixed(2)} s (planLookSecs ${C.planLookSecs}), then a move ${on}, the chain done ${P.chains.length === 0}`;
        if (two && seen && Math.abs(held - C.planLookSecs) < 0.15 && on && P.chains.length === 0) { ok = true; break; } }
      line(ok, 'a stop with a way and a stop after it: the men look that way for planLookSecs, then walk on by themselves', got); }

    // (5b) a hold put on the stop while they look: they stay, and the word sends them on
    { let got = 'no two floor spots', ok = false;
      for (const way of WAYS) { fresh(); const a = near2(null), b = a ? near2(a) : null; if (!a || !b) break;
        rdrag(px(a), px([a[0] + way[0] * 3, 0, a[2] + way[1] * 3])); R.aim(b); R.click(4, true); const Ch = P.chains[0]; if (!R.until(() => Ch?.phase === 'look', 30)) { got = `way ${way}: no look reached`; R.until(() => P.chains.length === 0, 30); continue; }
        clickStop(Ch.steps[0].at); const on = Ch.steps[0].hold === true, k = keys(); R.step(Math.round(C.planLookSecs * 60) + 60); const held = Ch.phase === 'held' && Ch.steps.length === 2; R.word(); R.step(3); const went = Ch.steps.length === 1 && Ch.phase === 'go';
        R.until(() => P.chains.length === 0, 30); got = `way ${way}: the click while they look put a hold on ${on} (keys ${k}) · a second past the look they are held ${held} · the word: on to the next stop ${went}`; ok = on && k === 1 && held && went; break; }
      line(ok, 'a wait put on a stop while the men look that way is kept: they stay past the look, and the word sends them on', got); }

    // (6) a door's wait taken off before they are there
    { fresh(); const A = doors()[0]; let got = 'no door to aim at', ok = false;
      if (A) { panTo(A.d.frameCentre); R.aim((aimOf(R, A.d) ?? A.d.frameCentre)); R.click(4); const Ch = P.chains[0], k0 = keys(), n0 = PLAN_STATS.waits, n = O.log.length; clickStop(A.d.frameCentre); const off1 = Ch?.steps[0]?.wait === false, k1 = keys();
        const done = R.until(() => entered(n), 45); R.until(() => P.chains.length === 0, 45);
        got = `the stop's keys ${k0} → ${k1}, its wait off ${off1}, waits stepped +${PLAN_STATS.waits - n0} · with no word: an entry ordered ${done}, the chain done ${P.chains.length === 0}`;
        ok = k0 === 1 && k1 === 0 && off1 && done && P.chains.length === 0; }
      line(ok, "a click on a door's stop takes its wait off: the mark goes, and the men go in when they are stacked with no word from him", got); }

    // (7) … and under men stood on it (a door the men do not hold a stack at on this stand is passed over for the next)
    { let got = 'no door to aim at', ok = false; const passed: string[] = [];
      for (let i = 0; i < 4 && !ok; i++) { fresh(); const A = doors()[0]; if (!A) break;
        panTo(A.d.frameCentre); R.aim((aimOf(R, A.d) ?? A.d.frameCentre)); R.click(4); const Ch = P.chains[0]; const waited = R.until(() => Ch?.phase === 'wait', 30); R.step(60); const n = O.log.length, still = Ch?.phase === 'wait';
        if (!waited || !still) { passed.push(A.d.def?.name ?? '?'); got = `no stack held at ${passed.join(', ')}`; R.until(() => P.chains.length === 0, 20); continue; }
        clickStop(A.d.frameCentre); R.step(2);
        const went = entered(n), ph = Ch?.phase, w = Ch?.steps[0]?.wait; R.until(() => P.chains.length === 0, 45);
        got = `${passed.length ? `(no stack held at ${passed.join(', ')}) ` : ''}${A.d.def?.name ?? '?'}: stacked and waiting a second on · the click: the wait ${w === false ? 'off' : 'on'}, phase ${ph}, an entry ordered ${went}, the chain done ${P.chains.length === 0}`; ok = went && P.chains.length === 0; break; }
      line(ok, 'the wait taken off under men stood on it: they go in at once', got); }

    // (7b) … off a door they cannot go through: refused at once or tried and given up, the wait and its mark are back
    { fresh(); const L = doorsNear(R).find((x: any) => x.d.locked && aimOf(R, x.d)), seen = !!L && panTo(L.d.frameCentre) && !!aimOf(R, L.d); let got = 'no locked door on this floor: nothing to ask', ok = true;
      if (L && !seen) got = 'the locked door of this floor cannot be brought onto the picture and aimed at: nothing to ask';
      if (L && seen) { R.aim(aimOf(R, L.d)!); R.click(4); const Ch = P.chains[0]; const waited = R.until(() => Ch?.phase === 'wait', 40); R.step(30); clickStop(L.d.frameCentre); R.step(2); const off1 = PLAN_STATS.waits, ph = Ch?.phase;
        const through = R.until(() => !P.chains.includes(Ch) || (Ch.phase === 'wait' && Ch.steps[0]?.wait !== false), 40) && !P.chains.includes(Ch), back = P.chains.includes(Ch) && Ch.phase === 'wait' && Ch.steps[0]?.wait !== false, k = back ? keys() : -1;
        got = `stacked on a locked door ${waited} · the click (waits stepped ${off1}): phase ${ph} · then ${through ? 'they got through and the plan is done' : back ? `they are back waiting on it, the wait on again, the stop's keys ${k}` : `phase ${Ch?.phase}, the wait ${Ch?.steps[0]?.wait}`}`; ok = BREAK ? false : waited && (through || (back && k === 1)); P.chains = []; }
      line(ok, 'the wait taken off a door the men cannot simply go through: they get through, or they are back waiting with the wait and its mark on again', got); }

    // (8) a hold put on a floor stop
    { fresh(); const spot = near2(null); let got = 'no floor spot', ok = false;
      if (spot) { R.aim(spot); R.click(4); const Ch = P.chains[0], k0 = keys(); clickStop(Ch?.steps[0]?.at ?? spot); const k1 = keys(), on = Ch?.steps[0]?.hold === true;
        const held = R.until(() => Ch?.phase === 'held', 30); R.step(150); const still = Ch?.phase === 'held' && P.chains.includes(Ch); R.word(); R.step(5); const freed = !P.chains.includes(Ch);
        got = `the stop's keys ${k0} → ${k1}, a hold on it ${on} · there: held ${held}, two and a half seconds on still ${still} · the word: the chain let go ${freed}`; ok = k0 === 0 && k1 === 1 && on && held && still && freed; }
      line(ok, 'a click on a floor stop puts a wait there: its mark shows, the men hold on it, and the word lets them go', got); }

    // (9) a word given early is not kept (a door the men do not hold a stack at on this stand is passed over for the next)
    { let got = 'no door to aim at', ok = false; const passed: string[] = [];
      for (let i = 0; i < 4 && !ok; i++) { fresh(); const A = doors()[0]; if (!A) break;
        panTo(A.d.frameCentre); R.aim((aimOf(R, A.d) ?? A.d.frameCentre)); R.click(4); const Ch = P.chains[0]; R.step(20); const early = Ch?.phase === 'go'; R.word(); const spent = !!Ch?.spent;
        const waited = R.until(() => Ch?.phase === 'wait', 30); R.step(90); const still = Ch?.phase === 'wait', n = O.log.length;
        if (early && !spent && (!waited || !still)) { /* the word was not kept, and yet they did not wait: the stand's own stack, as line 7 passes over */ passed.push(A.d.def?.name ?? '?'); got = `no stack held at ${passed.join(', ')}`; R.until(() => P.chains.length === 0, 20); continue; }
        R.word(); R.step(2); const went = entered(n), ph = Ch?.phase, tl = O.log.slice(n).map((r: any) => r.order).join(',') || '(nothing)'; R.until(() => P.chains.length === 0, 45);
        got = `${passed.length ? `(no stack held at ${passed.join(', ')}) ` : ''}${A.d.def?.name ?? '?'}: the word while they walk (phase go ${early}): kept ${spent} · at the door they wait ${waited}, a second and a half on still ${still} · the word then: an entry ordered ${went} (phase ${ph}, orders since: ${tl})`; ok = early && !spent && waited && still && went; break; }
      line(ok, 'the word frees only men who are waiting on it: given while they walk it is not kept, they wait at the door all the same, and the word there sends them in', got); }

    // (10) the knee at the radio
    { R.home(false); pl.crouch = false; R.step(30); const A = pl.char.anim, r0 = A.radioShown; R.toggle(); const c1 = pl.crouch, stood = P.stood; R.step(50); const r1 = A.radioShown, low = A.crouchTarget, up1 = A.upper;
      R.toggle(); const c2 = pl.crouch; R.step(120); const r2 = A.radioShown;
      pl.crouch = true; R.step(20); R.toggle(); R.step(10); R.toggle(); const c3 = pl.crouch; pl.crouch = false; R.step(20);
      line(c1 && stood === true && r1 > 0.6 && r0 < 0.1 && up1 === 'none' && !c2 && r2 < 0.2 && c3,
        'the mode up: he is down on a knee, the gun low, his hand at the radio; the mode down: he stands again and the hand comes off — a man who was already down stays down',
        `standing, the hand at the radio ${r0.toFixed(2)} · up: crouch ${c1} (stood before ${stood}), the hand ${r1.toFixed(2)}, crouch pose ${Number(low).toFixed(2)}, the gun's upper pose '${up1}' · the mode's own word for it ${PM.planKnee(O)} · down: crouch ${c2}, the hand ${r2.toFixed(2)} · crouched before and after: ${c3}`); }

    // (11) the view eases back
    { fresh(); I.keys.add('KeyD'); R.step(70); I.keys.delete('KeyD'); R.step(2); const sam = pl.char.pos, d0 = P.look ? dist(P.look, sam) : 0;
      R.toggle(); const a = PM.planLook(O), da = a ? dist(a, sam) : -1; R.step(Math.round(C.planBackSecs * 30) - 2); const b = PM.planLook(O), db = b ? dist(b, sam) : -1;
      R.step(Math.round(C.planBackSecs * 30) + 4); const c = PM.planLook(O), gone = P.back === null, f = g.followPos(), home = dist(f, sam) < 1e-6;
      line(d0 > 3 && da > d0 * 0.8 && db > d0 * 0.2 && db < d0 * 0.8 && c === null && gone && home, 'the view left away from him, the mode put down: it comes back to him over planBackSecs, eased, and is his again',
        `the view ${d0.toFixed(1)} m off him · the mode down: ${da.toFixed(1)} m · half way through ${db.toFixed(1)} m · after ${C.planBackSecs} s: ${c === null ? 'his' : 'still away'}, the state let go ${gone}, the camera follows him ${home}`); }

    // (11b) the plan's new words are in the file: a snapshot restored is the plan it was
    { fresh(); const a = near2(null), b = a ? near2(a) : null; let got = 'no two floor spots', ok = false;
      if (a && b) { rdrag(px(a), px([a[0] + 3, 0, a[2]])); R.aim(b); R.click(4, true); const Ch = P.chains[0]; clickStop(Ch.steps[1].at); I.keys.add('KeyD'); R.step(20); I.keys.delete('KeyD'); R.step(2);
        const show = () => JSON.stringify([P.up, P.stood, P.look?.map((x: number) => +x.toFixed(2)), P.chains.map((c: any) => [c.phase, c.who, c.steps.map((x: any) => [x.kind, x.look ?? null, x.looked ?? null, x.wait ?? null, x.hold ?? null])])]);
        const before = show(), snap = JSON.parse(JSON.stringify(PM.planSnapshot(O))), marks = !!Ch.steps[0].look && Ch.steps[1].hold === true; P.chains = []; P.stood = null; P.look = null; PM.planRestore(O, snap); const after = show();
        got = `a way on the first stop and a hold on the second ${marks}, kneeling ${P.stood !== null} · restored the same ${before === after}`; ok = marks && before === after && P.stood === true; P.chains = []; }
      line(ok, 'a snapshot carries the way, the waits and the knee: restored, the plan is the one it was', got); }

    // (12) the journal and the page's flags
    { const snap = () => JSON.parse(JSON.stringify(JOURNAL.knobsSnapshot(g)));
      for (const [k] of KEYS) C[k] = true; const old = snap(); for (const [k] of KEYS) delete old.tables.CMDRING[k]; JOURNAL.applyKnobs(g, old); const without = KEYS.map(([k]) => C[k]).join();
      const own = snap(); for (const [k] of KEYS) own.tables.CMDRING[k] = true; JOURNAL.applyKnobs(g, own); const withIt = KEYS.map(([k]) => C[k]).join();
      const flags = (q: string) => { PROFILE.pageSwitches(new URLSearchParams(q)); return KEYS.map(([k]) => (C[k] ? 1 : 0)).join(''); };
      const a = flags(''), b = flags('planlook=0'), c = flags('planwaits=0'), d = flags('planknee=0'), e = flags('qplan=0');
      line(without === 'false,false,false' && withIt === 'true,true,true' && a === '111' && b === '011' && c === '101' && d === '110' && e === '000',
        'a recording from before the keys replays with them off, one with them keeps them; the page opens with all three on — ?planlook=0, ?planwaits=0 and ?planknee=0 each put one off, ?qplan=0 all three',
        `applyKnobs with no keys → ${without} · with them → ${withIt} · (look, waits, knee) '' → ${a} · planlook=0 → ${b} · planwaits=0 → ${c} · planknee=0 → ${d} · qplan=0 → ${e}`); }

    // (13) a restart with the mode up: the new man is down on the knee too; and the view is not left away from him
    { for (const [k] of KEYS) C[k] = !BREAK; C.on = true; C.plan = true; C.planRts = true; fresh(); const up0 = P.up && pl.crouch; g.restart(); R.step(20); const p2 = g.player, c1 = p2.crouch, r1 = p2.char.anim.radioShown, f = g.followPos(), home = dist(f, p2.char.pos) < 0.5;
      line(up0 && P.up && c1 && r1 > 0.5 && home, 'a restart with the mode up: the man stood up afresh is down on the knee with his hand at the radio, and the view is on him', `before: up and kneeling ${up0} · after the restart: up ${P.up}, crouch ${c1}, the hand ${r1.toFixed(2)}, the view on him ${home}`); }

    // (14) the mode taken down by the squad going, not by his hand: he is off the knee
    { const p2 = g.player; if (!P.up) R.toggle(); R.step(10); const k0 = p2.crouch && P.stood === true; for (const m of [...O.squad()]) { m.god = false; m.state = 'dead'; } R.step(10); const gone = !O.active, c2 = p2.crouch, st2 = P.stood;
      line(k0 && gone && !P.up && !c2 && st2 === null, 'the squad gone with the mode up: the mode is down and he is on his feet again', `kneeling with the mode up ${k0} · nobody left to order ${gone}: the mode up ${P.up}, crouch ${c2}, the stand kept ${st2}`); }
  } finally { console.log = log; knobsBack(knobs0); Math.random = rnd0; AUTOPILOT.on = ap0; }
  const all = fails === 0;
  console.log(`=== planplus: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await planplusCheck()) ? 0 : 1);
