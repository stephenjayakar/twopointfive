// THE PLAN MODE MISSION (levels/tut-plan.json, tools/levels/tut-plan.ts): what its idea leans on, asked of the game with the tick's own input.
//
//   bun run tools/qa/tutplan-check.ts [--verbose]          (probe name `tutplan`; both stands: the frame and plan mode's switches are raised by hand
//                                                            after each stand-up, as the page has them, and put back)
//
//   1. the level starts on rails, its lesson block is whole, and its first step is the mode's;
//   2. BEFORE THE MODE he has his feet and nothing else: the walk keys walk him, and both buttons, the command key alone and the word give nothing;
//   3. `plan` IS ITS OWN ACTION (game/rails.ts gate): Shift with the command key puts the mode up though neither `order` nor `sprint` is allowed, he goes
//      down on his knee, and the step is done;
//   4. THE MODE'S HANDS ARE ITS OWN: the walk keys move the view's point and not him, a right click on the floor is an order to all four and a chain,
//      a box dragged with the left button picks two men, and the word is still locked until its own step;
//   5. THE MODE DOWN AGAIN, the walk keys are his feet again and both buttons are locked again;
//   6. THE HALL: with a stack on each door the script's gun is still on the front one when the back one opens (`lesson:breach` was sent); the same doors
//      opened with no such cue get the gun laid on the front doorway, and so does a front door the back one never followed, cue or not;
//   7. A WALK KEY HELD IS A WALK (his feet are his here, and Shift with the command key out of a walk is the sprint's side — rails.ts gate): the mode stays
//      down while W is held and he goes on walking; the key let go, the same press puts the mode up;
//   8. THE WORD'S LOCK HOLDS INSIDE THE MODE: four men stacked on a door before the word's step wait there — a second right click on that door is no
//      entry, and the right button held gives no ring.
//   9. EVERY PLAN IS LAID FROM ITS SPOT, WITH THE VIEW HELD NEAR HIM (cmdring.ts `planNear`, raised here as the page has it): he is put on the gate's mark and
//      then on each spot a walk step asks for, in the lesson's own order, and from there the walk keys take the view toward every place the steps up to the
//      next walk point at — a step's mark, the end of its drag, the point its view test wants. Each mark must come onto the picture and each view test must pass.
// TUTPLAN_BREAK=1 = every step's `allow: ['plan']` is taken out of the lesson before the run: lines 3, 4, 6, 7, 8 and 9 must fail (line 5 is excused the mode's
// state under the break, and line 6's break is its own: the cue is not sent). TUTPLAN_BREAK=spots = line 9 never leaves the gate: it must fail (the three
// spots are what puts each plan inside the view).   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { ROOT, standUp } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { RAILS, RAILS_STATS } = await import(`${ROOT}/src/game/rails.ts`);
const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { checkLesson } = await import(`${ROOT}/src/game/lesson.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const VERBOSE = process.argv.includes('--verbose'), BREAK = process.env.TUTPLAN_BREAK === '1', AT_GATE = process.env.TUTPLAN_BREAK === 'spots', LEVEL = 'tut-plan', DT = 1 / 60;
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function rig(seed = 1) {
  const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
  let W: any, started: any;
  try {
    const level = loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8')));
    if (BREAK) for (const T of level.scenarios!.lesson!.steps) if (T.allow) T.allow = T.allow.filter((a: string) => a !== 'plan');
    W = await standUp({ uploadEvery: 4, level, seed });
    // (the page's own: the frame, the ring on the command key and plan mode with its three later switches — the frozen stand holds each off)
    RAILS.on = true; Object.assign(CMDRING, { on: true, tapNow: true, stay: true, plan: true, planRts: true, planRun: true, planLook: true, planWaits: true, planKnee: true, planNear: true }); AUTOPILOT.on = true;
    started = startFromQuery(W.game, `?levelFile=${LEVEL}.json&roomclear=1&squad4`);
  } finally { console.log = log; console.warn = warn; console.error = err; }
  const g = W.game, I = W.input;
  const quiet = <T,>(f: () => T): T => { if (VERBOSE) return f(); const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return f(); } finally { console.log = l; console.warn = w; } };
  const run = (secs: number, keys: string[] = []) => quiet(() => { for (let i = 0; i < Math.round(secs * 60); i++) { for (const k of keys) I.keys.add(k); W.step(DT); } for (const k of keys) I.keys.delete(k); });
  const press = (k: string, held: string[] = []) => quiet(() => { for (const h of held) I.keys.add(h); W.step(DT); I.pressed.add(k); I.keys.add(k); W.step(DT); I.keys.delete(k); W.step(DT); for (const h of held) I.keys.delete(h); W.step(DT); });
  const px = (p: V): V => { const [x, y] = W.cam.project([p[0], p[1] ?? 0, p[2]], W.canvas.clientWidth, W.canvas.clientHeight); return [x, y]; };
  const cursor = (s: V) => { I.mouseX = s[0]; I.mouseY = s[1]; };
  /** a button pressed at one place of the picture and let go at another (the same place: a click) */
  const button = (bit: 1 | 4, a: V, b: V = a) => quiet(() => { cursor(a); W.step(DT); W.step(DT); I.clicked |= bit; I.buttons |= bit; W.step(DT);
    if (b !== a) for (let k = 1; k <= 5; k++) { cursor([a[0] + (b[0] - a[0]) * k / 5, a[1] + (b[1] - a[1]) * k / 5]); W.step(DT); }
    I.buttons &= ~bit; W.step(DT); W.step(DT); });
  return { W, g, I, run, press, px, cursor, button, why: started?.why as string | undefined };
}

export async function tutplanCheck(): Promise<boolean> {
  let all = true; const keep = { on: RAILS.on, rnd: Math.random, knobs: knobsCopy(), ap: AUTOPILOT.on };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  console.log(`the plan mode mission (levels/${LEVEL}.json)${BREAK ? ' — TUTPLAN_BREAK=1: no step allows `plan`, lines 3, 4, 6, 7, 8 and 9 must fail' : AT_GATE ? ' — TUTPLAN_BREAK=spots: every plan is tried from the gate, line 9 must fail' : ''}`);
  try {
    const R = await rig(), g = R.g, I = R.I, O = g.orders, P = O.plan, L = g.level.scenarios.lesson, pl = g.player;
    // ---- 1
    { const faults = checkLesson(g); R.run(0.5);
      verdict(!R.why && !!L?.rails && faults.length === 0 && g.lesson.step?.id === 'mode' && g.rails.live, 'the level starts on rails, its lesson block is whole, and the first step is the mode\'s',
        `${R.why ?? 'started'} · ${L?.steps.length ?? 0} steps · ${faults.length ? faults.join(' · ') : 'no faults'} · step '${g.lesson.step?.id}' · rails ${g.rails.live}`); }
    const floor: V = [11.9, 0.02, 15.6];   // open ground beside the four, in the picture from the first frame
    // ---- 2
    { const p0 = [...pl.char.pos], n0 = O.log.length, shots0 = g.mission.stats.shots ?? 0, d0 = RAILS_STATS.dropped;
      R.run(0.6, ['KeyW']); const walked = flat(pl.char.pos, p0); R.run(0.6, ['KeyS']); R.run(0.3); R.button(1, R.px(floor)); R.button(4, R.px(floor)); R.cursor(R.px(floor)); R.press('KeyB'); R.press('KeyF'); R.run(0.3);
      const moved = flat(pl.char.pos, p0), gave = O.log.length - n0, shots = (g.mission.stats.shots ?? 0) - shots0;
      verdict(walked > 0.3 && gave === 0 && shots === 0 && !P.up && g.lesson.step?.id === 'mode' && RAILS_STATS.dropped > d0, 'before the mode he has his feet and nothing else: the walk keys walk him, and both buttons, the command key alone and the word give nothing',
        `W held: he walked ${walked.toFixed(2)} m (S held after it: ${moved.toFixed(2)} m off his mark) · orders +${gave} · shots +${shots} · mode up ${P.up} · step '${g.lesson.step?.id}' · the gate dropped ${RAILS_STATS.dropped - d0} press(es)`); }
    // ---- 3
    { const stood = !pl.crouch; R.press('KeyB', ['ShiftLeft']); R.run(0.3);
      verdict(P.up && stood && pl.crouch && g.lesson.step?.id === 'view' && g.rails.locks('order') && g.rails.locks('sprint'), 'Shift with the command key puts the mode up with neither `order` nor `sprint` allowed: he is on his knee and the step is done',
        `mode up ${P.up} · he stood ${stood}, on a knee now ${pl.crouch} · step '${g.lesson.step?.id}' · order locked ${g.rails.locks('order')}, sprint locked ${g.rails.locks('sprint')}`); }
    // ---- 4
    { const p0 = [...pl.char.pos], l0 = P.look ? [...P.look] : [...p0]; R.run(0.5, ['KeyD']); const panned = P.look ? flat(P.look, l0) : 0, moved = flat(pl.char.pos, p0);
      R.run(0.5, ['KeyA']);
      const n0 = O.log.length; R.button(4, R.px(floor)); R.run(0.2); const gave = O.log.length - n0, chains = P.chains.length, who = P.chains[0]?.who.length ?? 0;
      const men: any[] = O.men('all'), two = [...men].sort((a, b) => a.char.pos[0] - b.char.pos[0] || a.char.pos[2] - b.char.pos[2]).slice(0, 2);
      R.run(4.0);   // (they walk to the spot and stand: a box round two men who are still filing past each other takes a third)
      const q = two.flatMap(m => [R.px([m.char.pos[0], 0, m.char.pos[2]]), R.px([m.char.pos[0], 1.7, m.char.pos[2]])]);
      R.button(1, [Math.min(...q.map(v => v[0])) - 10, Math.min(...q.map(v => v[1])) - 10], [Math.max(...q.map(v => v[0])) + 10, Math.max(...q.map(v => v[1])) + 10]);
      const picked = O.recipients().length, d0 = RAILS_STATS.dropped; R.press('KeyF'); const word = RAILS_STATS.dropped - d0;
      verdict(panned > 3 && moved < 0.05 && gave === 1 && chains === 1 && who === 4 && picked >= 1 && picked < 4 && g.rails.locks('word') && word >= 1,
        'the mode\'s hands are its own: the walk keys move the view and not him, a right click on the floor is one order to all four and a chain, a box dragged with the left button picks some of them, and the word is locked until its step',
        `the view's point moved ${panned.toFixed(1)} m, he ${moved.toFixed(2)} m · right click: orders +${gave}, chains ${chains} of ${who} men · the box picked ${picked} of ${men.length} · word locked ${g.rails.locks('word')}, dropped ${word}`); }
    // ---- 5
    { R.press('KeyB', ['ShiftLeft']); R.run(1.0); const down = !P.up, p0 = [...pl.char.pos], n0 = O.log.length;
      R.run(0.5, ['KeyW']); R.button(4, R.px(floor)); R.button(1, R.px(floor)); R.run(0.2);
      verdict((down || BREAK) && flat(pl.char.pos, p0) > 0.3 && O.log.length === n0, 'the mode down again, the walk keys are his feet again and both buttons are locked again', `mode down ${down} · he moved ${flat(pl.char.pos, p0).toFixed(2)} m · orders +${O.log.length - n0}`); }
    // ---- 6: the hall's gun, by the script's own notes. The doors are opened by hand: what is asked is only which door the gun answers
    { const hall = async (cue: boolean, both = cue) => { const H = await rig(), hg = H.g; H.run(0.5); if (cue && !BREAK) hg.director.signal('lesson:breach'); H.run(0.2);
        const held = ['Tango 3', 'Tango 4'].every(cs => !!hg.guards.find((x: any) => x.callsign === cs)?.script);
        const swing = (n: string) => { const D = hg.doors.byName(n); D.latched = false; D.closing = false; D.angle = 1.2; D.vel = 0; D.place(); D.quietT = -3600; };
        swing('hall'); H.run(0.1); if (both) swing('hall_back'); H.run(3.0);
        const notes = (hg.director.log as { kind: string; what: string }[]).filter(r => r.kind === 'note').map(r => r.what);
        return { held, alone: notes.some(n => n.startsWith('one stack, alone')), turned: notes.some(n => n === 'signal:done:turned'), wait: notes.find(n => n.startsWith('the hall\'s wait ends')) ?? '(no note)' }; };
      const A = await hall(true), B = await hall(false), C = await hall(true, false);
      verdict(A.held && B.held && A.turned && !A.alone && B.alone && !B.turned && C.alone && !C.turned, 'the hall: both its men are the script\'s from the start; with a stack on each door the gun is still on the front one when the back one opens; with none, or with a back door that never follows, it is laid on the front doorway',
        `held ${A.held}/${B.held} · a stack on each door: ${A.wait} → ${A.turned ? 'turned to the wrong door' : A.alone ? 'LAID ON THE DOORWAY' : 'neither'} · no such cue: ${B.wait} → ${B.alone ? 'laid on the doorway' : B.turned ? 'TURNED' : 'neither'} · the cue, and the back door stays shut: ${C.alone ? 'laid on the doorway' : C.turned ? 'TURNED' : 'neither'}`); }
    // ---- 7: a walk key held is a walk (his feet are his on this mission): Shift with the command key is not the mode's then, and is once the key is let go
    { const K = await rig(), kg = K.g; K.run(0.5); const p0 = [...kg.player.char.pos];
      K.run(0.2, ['KeyW']); K.press('KeyB', ['ShiftLeft', 'KeyW']); K.run(0.2, ['KeyW']); const held = kg.orders.plan.up, walked = flat(kg.player.char.pos, p0);
      K.run(0.3); K.press('KeyB', ['ShiftLeft']); K.run(0.3);
      verdict(!held && walked > 0.3 && kg.orders.plan.up, 'a walk key held is a walk: Shift with the command key and W down leaves the mode down and him walking; the key let go, the same press puts the mode up', `W down: mode up ${held}, he walked ${walked.toFixed(2)} m · W let go: mode up ${kg.orders.plan.up} · step '${kg.lesson.step?.id}'`); }
    // ---- 8: the word's lock inside the mode. Four men are put on the guardroom's door before the word's step, by the mode's own right click
    { const Q = await rig(), qg = Q.g, QO = qg.orders, QP = QO.plan, d = qg.doors.byName('guard'), c = d.frameCentre as V, w = Q.W.canvas.clientWidth, h = Q.W.canvas.clientHeight;
      Q.run(0.5); Q.press('KeyB', ['ShiftLeft']); Q.run(0.3);
      for (let i = 0; i < 400 && QP.up; i++) { const [x, y] = Q.px([c[0], 0, c[2]]); const keys = [x > w - 260 ? 'KeyD' : x < 260 ? 'KeyA' : '', y > h - 150 ? 'KeyS' : y < 150 ? 'KeyW' : ''].filter(Boolean); if (!keys.length) break; Q.run(1 / 30, keys); }
      const onDoor = (): boolean => { for (const y of [1.0, 2.0, 0.1, 1.6]) { Q.cursor(Q.px([c[0], y, c[2]])); Q.run(1 / 30); const t = QO.targetUnder(Q.I, Q.W.cam, Q.W.canvas); if (t.kind === 'door' && t.door === d) return true; } return false; };
      const rclick = () => { if (!onDoor()) return false; Q.I.clicked |= 4; Q.I.buttons |= 4; Q.run(1 / 60); Q.I.buttons &= ~4; Q.run(0.05); return true; };
      const shut = () => !d.open && !d.broken, waits = () => QP.chains.length > 0 && QP.chains.every((C: any) => C.phase === 'wait');
      const first = rclick(); for (let i = 0; i < 40 && !waits(); i++) Q.run(0.5);
      const stacked = first && waits(), locked = qg.rails.locks('word');
      const again = rclick(); Q.run(2.5); const held1 = waits() && shut();
      // (the right button held down on the door: the ring of orders would come up here)
      const on = onDoor(); Q.I.clicked |= 4; Q.I.buttons |= 4; Q.run(0.8); const ring = !!QO.menu; Q.I.buttons &= ~4; Q.run(1.5); const held2 = waits() && shut();
      verdict(stacked && locked && again && held1 && on && !ring && held2, 'the word\'s lock holds inside the mode: four stacked on a door before the word\'s step wait there — a second right click on it is no entry, and the right button held gives no ring',
        `stacked and waiting ${stacked} (${QP.chains.map((C: any) => C.phase).join(',') || 'no chain'}) · word locked ${locked} · after a second right click: waiting ${held1} · the button held: ring ${ring}, waiting ${held2} · door shut ${shut()} · step '${qg.lesson.step?.id}'`); }
    // ---- 9: every plan from its spot, the view held near him. The spots and the places are the lesson's own, read in its order
    { const N = await rig(), ng = N.g, NP = ng.orders.plan, np = ng.player, w = N.W.canvas.clientWidth, h = N.W.canvas.clientHeight, EDGE = 40;
      const find = (t: any, is: string): any => !t ? null : t.is === is ? t : (t.of ?? []).map((x: any) => find(x, is)).find(Boolean) ?? null;
      type Ask = { from: string; spot: V; id: string; p: V; r?: number };
      const asks: Ask[] = []; let spot: V = [...np.char.pos], from = 'the gate';
      for (const T of ng.level.scenarios.lesson.steps as any[]) {
        const walk = find(T.done, 'in'), view = find(T.done, 'planView');
        if (walk && !view && !T.planLine) { if (!AT_GATE) { spot = [(walk.area.x0 + walk.area.x1) / 2, 0, (walk.area.z0 + walk.area.z1) / 2]; from = `'${T.id}'`; } continue; }
        if (view) asks.push({ from, spot, id: T.id, p: view.at, r: view.r ?? 5 });
        if (T.at) asks.push({ from, spot, id: T.id, p: T.at });
        if (T.at && T.toward) { const l = flat(T.at, T.toward); asks.push({ from, spot, id: T.id, p: [T.at[0] + (T.toward[0] - T.at[0]) / l * 3, 0, T.at[2] + (T.toward[2] - T.at[2]) / l * 3] }); }
      }
      N.run(0.5); const bad: string[] = []; let tight = 1e9, tightAt = '', spots = new Set(asks.map(a => a.from)).size, far = 0;
      for (const a of asks) {
        if (NP.up) N.press('KeyB', ['ShiftLeft']); np.char.pos[0] = a.spot[0]; np.char.pos[2] = a.spot[2]; N.run(0.3); N.press('KeyB', ['ShiftLeft']); N.run(0.2);
        if (!NP.up || !NP.look) { bad.push(`'${a.id}': the mode did not come up`); break; }
        // (the walk keys toward the place, by where it is on the picture, until it is in the middle or the view stops)
        for (let i = 0, still = 0; i < 400 && still < 12; i++) { const [x, y] = N.px([a.p[0], 0, a.p[2]]), l0 = [...NP.look];
          const keys = [x > w / 2 + 14 ? 'KeyD' : x < w / 2 - 14 ? 'KeyA' : '', y > h / 2 + 14 ? 'KeyS' : y < h / 2 - 14 ? 'KeyW' : ''].filter(Boolean); if (!keys.length) break;
          N.run(2 / 60, keys); still = flat(NP.look, l0) < 1e-3 ? still + 1 : 0; }
        N.run(0.3); far = Math.max(far, flat(NP.look, np.char.pos));
        const [x, y] = N.px(a.p), m = Math.min(x, y, w - x, h - y), off = a.r !== undefined ? flat(NP.look, a.p) : 0;
        if (a.r !== undefined) { if (off >= a.r) bad.push(`'${a.id}' from ${a.from}: the view stops ${off.toFixed(1)} m from the point its test wants within ${a.r} m`); }
        else { if (m < tight) { tight = m; tightAt = `'${a.id}' from ${a.from}`; } if (m < EDGE) bad.push(`'${a.id}' from ${a.from}: (${a.p[0].toFixed(1)}, ${a.p[2].toFixed(1)}) is ${m < 0 ? 'off the picture' : `${m.toFixed(0)} px from its edge`}`); }
      }
      const corner = Math.hypot(CMDRING.planNearSideM, Math.max(CMDRING.planNearAwayM, CMDRING.planNearBackM));
      verdict(asks.length >= 12 && (AT_GATE || spots >= 4) && !bad.length && far <= corner + 0.3, 'every plan is laid from its spot with the view held near him: each mark comes onto the picture and each view test passes from the spot the lesson has walked him to',
        `${asks.length} places from ${spots} spots · the view's point never more than ${far.toFixed(1)} m from him (the box's far corner: ${corner.toFixed(1)} m) · the tightest mark: ${tightAt}, ${tight.toFixed(0)} px inside the picture · ${bad.length ? bad.join(' · ') : 'none out of reach'}`); }
  } finally { RAILS.on = keep.on; Math.random = keep.rnd; knobsBack(keep.knobs); AUTOPILOT.on = keep.ap; }
  console.log(`=== tutplan: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await tutplanCheck()) ? 0 : 1);
