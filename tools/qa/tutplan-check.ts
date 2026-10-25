// THE PLAN MODE MISSION (levels/tut-plan.json, tools/levels/tut-plan.ts): what its idea leans on, asked of the game with the tick's own input.
//
//   bun run tools/qa/tutplan-check.ts [--verbose]          (probe name `tutplan`; both stands: the frame and plan mode's switches are raised by hand
//                                                            after each stand-up, as the page has them, and put back)
//
//   1. the level starts on rails with its lesson block whole, AND NOBODY OF THE PLAYER'S IS ON THE FLOOR: the seat that holds plan mode up is on
//      (`rails.sky.plan`, rails.ts RAILS.skyUp), the player stands parked where the level says, unseen and unmarked, the mode is up within the first
//      half second with no key pressed, and its view starts on the middle of the four — not on him;
//   2. NO KEY PUTS THE MODE DOWN, AND NONE IS HIS: Shift with the command key (with a walk key held too), the back key and Esc leave it up; the command
//      key alone and the word give no order; he does not move; and the game says there is nothing for the back key to back out of (so Esc and Tab are
//      the page's own: its pause, its objectives card);
//   3. THE MODE'S HANDS ARE ITS OWN: the walk keys move the view's point and not him, a right click on the floor is an order to all four and a chain,
//      a box dragged with the left button picks nobody before the step that teaches picking (rails.ts RAILS.planDigits: the digits and the picks under the
//      frame are rails-check's line), and the word is still locked until its own step;
//   4. THE VIEW REACHES EVERY PLACE BY THE WALK KEYS ALONE: with the lesson on each step in turn, the walk keys take the view from where the step before
//      left it toward every place that step points at — its mark, the end of its drag, the point its view test wants. Each mark must come onto the
//      picture and each view test must pass;
//   5. THE HALL: with a stack on each door the script's gun is still on the front one when the back one opens (`lesson:breach` was sent); the same doors
//      opened with no such cue get the gun laid on the front doorway, and so does a front door the back one never followed, cue or not;
//   6. THE WORD'S LOCK HOLDS INSIDE THE MODE: four men stacked on a door before the word's step wait there — a second right click on that door is no
//      entry, and the right button held gives no ring;
//   7. A SAVE PUT BACK TAKES THE MODE DOWN (planmode.ts planLoaded) AND THE SEAT HAS IT UP AGAIN ON THE NEXT TICK, its view on the four;
//   8. NOTHING IN THE LESSON ASKS FOR HIS FEET OR FOR A KEY THAT OPENS OR CLOSES THE MODE: no step's test reads where he stands or whether the squad
//      follows him, neither the frame nor a step gives `move` or `sprint`, no step carries a line for the mode being down, and no line or card names
//      Tab, the command key, a walk of his, "yourself" or a click on bare ground (the men are picked by the digits: the click that picked everyone is out
//      of the mode).
// TUTPLAN_BREAK=1 = RAILS.skyUp is off (the seat is the plain sky seat, the mode down): lines 1, 2, 3, 4, 6, 7 and 9 must fail (line 5 opens its doors by
// hand, line 8 reads the file).   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { ROOT, standUp } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { RAILS, RAILS_STATS, railsFaults } = await import(`${ROOT}/src/game/rails.ts`);
const { WORLD } = await import(`${ROOT}/src/scene/world.ts`);
const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`);
const { AUTOPILOT } = await import(`${ROOT}/src/game/autopilot.ts`);
const { checkLesson } = await import(`${ROOT}/src/game/lesson.ts`);
const { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`);
const { planView, planLoaded } = await import(`${ROOT}/src/game/planmode.ts`);
const VERBOSE = process.argv.includes('--verbose'), BREAK = process.env.TUTPLAN_BREAK === '1', LEVEL = 'tut-plan', DT = 1 / 60;
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function rig(seed = 1) {
  const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
  let W: any, started: any;
  try {
    const level = loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8')));
    W = await standUp({ uploadEvery: 4, level, seed });
    // (the page's own: the frame, the ring on the command key and plan mode with its three later switches — the frozen stand holds each off)
    RAILS.on = true; RAILS.planDigits = true; Object.assign(CMDRING, { on: true, tapNow: true, stay: true, plan: true, planRts: true, planRun: true, planLook: true, planWaits: true, planKnee: true, planNear: true, planDigits: true, planClear: true, wholeSquad: true }); AUTOPILOT.on = true;
    if (BREAK) RAILS.skyUp = false;   // (the seat does not hold the mode up: the plain sky seat, as the build was)
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
  console.log(`the plan mode mission (levels/${LEVEL}.json)${BREAK ? ' — TUTPLAN_BREAK=1: the seat does not hold the mode up, lines 1, 2, 3, 4, 6, 7 and 9 must fail' : ''}`);
  try {
    const R = await rig(), g = R.g, O = g.orders, P = O.plan, L = g.level.scenarios.lesson, pl = g.player;
    const mid = (): V => { const men: any[] = O.men('all'), c = [0, 0, 0]; for (const m of men) { c[0] += m.char.pos[0] / men.length; c[2] += m.char.pos[2] / men.length; } return c; };
    // ---- 1
    { const faults = checkLesson(g); R.run(0.5); const park: V | undefined = L?.rails?.sky?.park, at = pl.char.pos, V0 = planView(O);
      const seat = !!g.rails.planSeat && !!g.rails.skyOn, parked = !!park && flat(at, park) < 0.3 && g.playerInvisible, onMen = !!P.look && flat(P.look, mid()) < 1.0 && flat(P.look, at) > 5;
      verdict(!R.why && !!L?.rails && faults.length === 0 && g.lesson.step?.id === 'view' && g.rails.live && seat && parked && P.up && onMen && !!V0 && V0.sam === null,
        'the level starts on rails with its lesson whole, and nobody of the player\'s is on the floor: the seat holds plan mode up from the start, he stands parked, unseen and unmarked, and the view starts on the four',
        `${R.why ?? 'started'} · ${L?.steps.length ?? 0} steps · ${faults.length ? faults.join(' · ') : 'no faults'} · step '${g.lesson.step?.id}' · rails ${g.rails.live} · the seat ${seat} · parked at (${at[0].toFixed(1)}, ${at[2].toFixed(1)}), unseen ${g.playerInvisible} · mode up ${P.up} · the view ${P.look ? `${flat(P.look, mid()).toFixed(1)} m from the four's middle, ${flat(P.look, at).toFixed(1)} m from him` : 'has no point'} · his mark in the mode's picture: ${V0?.sam ? 'DRAWN' : 'none'}`); }
    const floor: V = [11.9, 0.02, 15.6];   // open ground beside the four, in the picture from the first frame
    // ---- 2
    { const p0 = [...pl.char.pos], n0 = O.log.length, shots0 = g.mission.stats.shots ?? 0;
      R.press('KeyB', ['ShiftLeft']); const a = P.up; R.press('KeyB', ['ShiftLeft', 'KeyW']); const b = P.up; R.press('Tab'); const c = P.up; R.press('Escape'); const d = P.up;
      R.cursor(R.px(floor)); R.press('KeyB'); R.press('KeyF'); R.run(0.3);
      const moved = flat(pl.char.pos, p0), gave = O.log.length - n0, shots = (g.mission.stats.shots ?? 0) - shots0, back = O.planBack() || g.backable();
      verdict(a && b && c && d && P.up && moved < 0.05 && gave === 0 && shots === 0 && !back && g.lesson.step?.id === 'view',
        'no key puts the mode down and none is his: Shift with the command key (a walk key held too), the back key and Esc leave it up, the command key alone and the word give no order, and nothing is there for the back key to back out of',
        `mode after Shift + the command key ${a ? 'up' : 'DOWN'}, with W held ${b ? 'up' : 'DOWN'}, after Tab ${c ? 'up' : 'DOWN'}, after Esc ${d ? 'up' : 'DOWN'} · he moved ${moved.toFixed(2)} m · orders +${gave} · shots +${shots} · something to back out of: ${back} · step '${g.lesson.step?.id}'`); }
    // ---- 3
    { const p0 = [...pl.char.pos], l0 = P.look ? [...P.look] : [...p0]; R.run(0.5, ['KeyD']); const panned = P.look ? flat(P.look, l0) : 0, moved = flat(pl.char.pos, p0);
      R.run(0.5, ['KeyA']);
      const n0 = O.log.length; R.button(4, R.px(floor)); R.run(0.2); const gave = O.log.length - n0, chains = P.chains.length, who = P.chains[0]?.who.length ?? 0;
      const men: any[] = O.men('all'), two = [...men].sort((a, b) => a.char.pos[0] - b.char.pos[0] || a.char.pos[2] - b.char.pos[2]).slice(0, 2);
      R.run(4.0);   // (they walk to the spot and stand: a box round two men who are still filing past each other takes a third)
      const q = two.flatMap(m => [R.px([m.char.pos[0], 0, m.char.pos[2]]), R.px([m.char.pos[0], 1.7, m.char.pos[2]])]);
      R.button(1, [Math.min(...q.map(v => v[0])) - 10, Math.min(...q.map(v => v[1])) - 10], [Math.max(...q.map(v => v[0])) + 10, Math.max(...q.map(v => v[1])) + 10]);
      const boxIt = () => R.button(1, [Math.min(...q.map(v => v[0])) - 10, Math.min(...q.map(v => v[1])) - 10], [Math.max(...q.map(v => v[0])) + 10, Math.max(...q.map(v => v[1])) + 10]);
      // (CONTROL: the same box with the step that teaches picking up picks some of them — so the box above was on the men, and it was the lesson that held it)
      const picked = O.recipients().length, i0 = g.lesson.i; g.lesson.i = (L.steps as any[]).findIndex(T => T.id === 'pick'); R.run(2 / 60); boxIt(); const taught = O.recipients().length; R.press('Digit5'); g.lesson.i = i0; R.run(2 / 60);
      const d0 = RAILS_STATS.dropped; R.press('KeyF'); const word = RAILS_STATS.dropped - d0;
      verdict(panned > 3 && moved < 0.05 && gave === 1 && chains === 1 && who === 4 && picked === men.length && taught >= 1 && taught < men.length && g.rails.locks('word') && word >= 1,
        'the mode\'s hands are its own: the walk keys move the view and not him, a right click on the floor is one order to all four and a chain, a box dragged with the left button picks nobody before the step that teaches picking (rails.ts RAILS.planDigits; rails-check has the digits), and the word is locked until its step',
        `the view's point moved ${panned.toFixed(1)} m, he ${moved.toFixed(2)} m · right click: orders +${gave}, chains ${chains} of ${who} men · after the box an order would still go to ${picked} of ${men.length} (step '${g.lesson.step?.id}'); the same box with 'pick' up picks ${taught} · word locked ${g.rails.locks('word')}, dropped ${word}`); }
    // ---- 7 (on the same game, last): a save put back takes the mode down as the key would; the seat has it up again on the next tick, its view on the four
    { planLoaded(O); const down = !P.up; R.run(2 / 60); const off = P.look ? flat(P.look, mid()) : NaN;
      verdict(down && P.up && off < 1.0, 'a save put back takes the mode down, and the seat has it up again on the next tick with its view on the four', `down as the save went in ${down} · up two ticks on ${P.up} · the view ${Number.isFinite(off) ? `${off.toFixed(1)} m from the four's middle` : 'has no point'}`); }
    // ---- 9 (the same game): the view never leaves the level; where he is parked is no target of an order; a frame that holds the mode up and does not give
    //      `plan` is a fault; the page's word puts the rule off and a recording from before the key replays without it
    { const J = await import(`${ROOT}/src/game/journal.ts`), PR = await import(`${ROOT}/src/host/profile.ts`), k0 = knobsCopy();
      const outs: string[] = []; let reach = 0;
      for (const ks of [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA']]) { R.run(8, ks); const l = P.look;
        if (!l) { outs.push('no point'); break; } reach = Math.max(reach, flat(l, mid()));
        if (l[0] < WORLD.min[0] - 1e-6 || l[0] > WORLD.max[0] + 1e-6 || l[2] < WORLD.min[2] - 1e-6 || l[2] > WORLD.max[2] + 1e-6) outs.push(`(${l[0].toFixed(1)}, ${l[2].toFixed(1)})`); }
      const park: V = [pl.char.pos[0], 0, pl.char.pos[2]], T: any = O.targetAt(park), stop = P.up && !!P.look && outs.length === 0;
      const noPlan = JSON.parse(JSON.stringify(L)); noPlan.rails.allow = (noPlan.rails.allow ?? []).filter((a: string) => a !== 'plan'); const denied = JSON.parse(JSON.stringify(L)); denied.steps[1].deny = ['plan'];
      const f0 = railsFaults(L as any).length, f1 = railsFaults(noPlan).filter((s: string) => s.includes('sky.plan')).length, f2 = railsFaults(denied).filter((s: string) => s.includes('sky.plan')).length;
      let old = true, kept = false, word = '';
      try { const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
        RAILS.skyUp = true; const was = snap(); delete was.tables.RAILS.skyUp; J.applyKnobs(g, was); old = RAILS.skyUp;
        RAILS.skyUp = true; const now = snap(); RAILS.skyUp = false; J.applyKnobs(g, now); kept = RAILS.skyUp;
        const read = (q: string) => { RAILS.skyUp = !RAILS.skyUp; PR.pageSwitches(new URLSearchParams(q)); return RAILS.skyUp; }; word = `${read('')}/${read('skyup=0')}`;
      } finally { knobsBack(k0); }
      verdict(stop && T.kind !== 'none' && f0 === 0 && f1 === 1 && f2 === 1 && old === false && kept === true && word === 'true/false',
        'the view never leaves the level, where he is parked is no target of an order, a frame that holds the mode up without giving `plan` is a fault, the page\'s word puts the rule off and a recording from before the key replays without it',
        `walk keys held eight seconds each way: ${outs.length ? `the view's point OUTSIDE the level at ${outs.join(', ')}` : `the view's point stays inside (0, 0) to (${WORLD.max[0]}, ${WORLD.max[2]}), as far as ${reach.toFixed(1)} m from the four`} · a point on his parked spot is a target of kind '${T.kind}' · faults: the level ${f0}, \`plan\` not given ${f1}, a step that takes it away ${f2} · a recording from before the key: ${old ? 'ON' : 'off'}, one with it: ${kept ? 'on' : 'OFF'} · the page / ?skyup=0: ${word}`); }
    // ---- 4: the view reaches every place by the walk keys alone. The places are the lesson's own
    { const N = await rig(), ng = N.g, NP = ng.orders.plan, w = N.W.canvas.clientWidth, h = N.W.canvas.clientHeight, EDGE = 40, steps = ng.level.scenarios.lesson.steps as any[];
      const find = (t: any, is: string): any => !t ? null : t.is === is ? t : (t.of ?? []).map((x: any) => find(x, is)).find(Boolean) ?? null;
      type Ask = { i: number; id: string; p: V; r?: number };
      const asks: Ask[] = [];
      steps.forEach((T, i) => {
        const view = find(T.done, 'planView'); if (view) asks.push({ i, id: T.id, p: view.at, r: view.r ?? 5 });
        if (T.at) asks.push({ i, id: T.id, p: T.at });
        if (T.at && T.toward) { const l = flat(T.at, T.toward); asks.push({ i, id: T.id, p: [T.at[0] + (T.toward[0] - T.at[0]) / l * 3, 0, T.at[2] + (T.toward[2] - T.at[2]) / l * 3] }); }
      });
      N.run(0.5); const start: V = NP.look ? [...NP.look] : [0, 0, 0];
      const bad: string[] = []; let tight = 1e9, tightAt = '', far = 0;
      for (const a of asks) {
        ng.lesson.i = a.i; N.run(0.1); ng.lesson.i = a.i;
        if (!NP.up || !NP.look) { bad.push(`'${a.id}': the mode is not up`); break; }
        // (the walk keys toward the place, by where it is on the picture, until it is in the middle or the view stops)
        for (let i = 0, still = 0; i < 400 && still < 12; i++) { const [x, y] = N.px([a.p[0], 0, a.p[2]]), l0 = [...NP.look];
          const keys = [x > w / 2 + 14 ? 'KeyD' : x < w / 2 - 14 ? 'KeyA' : '', y > h / 2 + 14 ? 'KeyS' : y < h / 2 - 14 ? 'KeyW' : ''].filter(Boolean); if (!keys.length) break;
          N.run(2 / 60, keys); ng.lesson.i = a.i; still = flat(NP.look, l0) < 1e-3 ? still + 1 : 0; }
        N.run(0.3); far = Math.max(far, flat(NP.look, start));
        const [x, y] = N.px(a.p), m = Math.min(x, y, w - x, h - y), off = a.r !== undefined ? flat(NP.look, a.p) : 0;
        if (a.r !== undefined) { if (off >= a.r) bad.push(`'${a.id}': the view stops ${off.toFixed(1)} m from the point its test wants within ${a.r} m`); }
        else { if (m < tight) { tight = m; tightAt = `'${a.id}'`; } if (m < EDGE) bad.push(`'${a.id}': (${a.p[0].toFixed(1)}, ${a.p[2].toFixed(1)}) is ${m < 0 ? 'off the picture' : `${m.toFixed(0)} px from its edge`}`); }
      }
      verdict(asks.length >= 12 && !bad.length,
        'the view reaches every place by the walk keys alone: each step\'s mark comes onto the picture and each view test passes',
        `${asks.length} places over ${new Set(asks.map(a => a.id)).size} steps · the view's point went as far as ${far.toFixed(1)} m from where it started on the four · the tightest mark: ${tightAt || '—'}, ${tight < 1e9 ? `${tight.toFixed(0)} px inside the picture` : '—'}${bad.length ? ` · ${bad.join(' · ')}` : ''}`); }
    // ---- 5: the hall's gun, by the script's own notes. The doors are opened by hand: what is asked is only which door the gun answers
    { const hall = async (cue: boolean, both = cue) => { const H = await rig(), hg = H.g; H.run(0.5); if (cue) hg.director.signal('lesson:breach'); H.run(0.2);
        const held = ['Tango 3', 'Tango 4'].every(cs => !!hg.guards.find((x: any) => x.callsign === cs)?.script);
        const swing = (n: string) => { const D = hg.doors.byName(n); D.latched = false; D.closing = false; D.angle = 1.2; D.vel = 0; D.place(); D.quietT = -3600; };
        swing('hall'); H.run(0.1); if (both) swing('hall_back'); H.run(3.0);
        const notes = (hg.director.log as { kind: string; what: string }[]).filter(r => r.kind === 'note').map(r => r.what);
        return { held, alone: notes.some(n => n.startsWith('one stack, alone')), turned: notes.some(n => n === 'signal:done:turned'), wait: notes.find(n => n.startsWith('the hall\'s wait ends')) ?? '(no note)' }; };
      const A = await hall(true), B = await hall(false), C = await hall(true, false);
      verdict(A.held && B.held && A.turned && !A.alone && B.alone && !B.turned && C.alone && !C.turned, 'the hall: both its men are the script\'s from the start; with a stack on each door the gun is still on the front one when the back one opens; with none, or with a back door that never follows, it is laid on the front doorway',
        `held ${A.held}/${B.held} · a stack on each door: ${A.wait} → ${A.turned ? 'turned to the wrong door' : A.alone ? 'LAID ON THE DOORWAY' : 'neither'} · no such cue: ${B.wait} → ${B.alone ? 'laid on the doorway' : B.turned ? 'TURNED' : 'neither'} · the cue, and the back door stays shut: ${C.alone ? 'laid on the doorway' : C.turned ? 'TURNED' : 'neither'}`); }
    // ---- 6: the word's lock inside the mode. Four men are put on the guardroom's door before the word's step, by the mode's own right click
    { const Q = await rig(), qg = Q.g, QO = qg.orders, QP = QO.plan, d = qg.doors.byName('guard'), c = d.frameCentre as V, w = Q.W.canvas.clientWidth, h = Q.W.canvas.clientHeight;
      Q.run(0.5);
      for (let i = 0; i < 400 && QP.up; i++) { const [x, y] = Q.px([c[0], 0, c[2]]); const keys = [x > w - 260 ? 'KeyD' : x < 260 ? 'KeyA' : '', y > h - 150 ? 'KeyS' : y < 150 ? 'KeyW' : ''].filter(Boolean); if (!keys.length) break; Q.run(1 / 30, keys); }
      const onDoor = (): boolean => { for (const y of [1.0, 2.0, 0.1, 1.6]) { Q.cursor(Q.px([c[0], y, c[2]])); Q.run(1 / 30); const t = QO.targetUnder(Q.I, Q.W.cam, Q.W.canvas); if (t.kind === 'door' && t.door === d) return true; } return false; };
      const rclick = () => { if (!onDoor()) return false; Q.I.clicked |= 4; Q.I.buttons |= 4; Q.run(1 / 60); Q.I.buttons &= ~4; Q.run(0.05); return true; };
      const shut = () => !d.open && !d.broken, waits = () => QP.chains.length > 0 && QP.chains.every((C: any) => C.phase === 'wait');
      const first = QP.up && rclick(); for (let i = 0; i < 40 && first && !waits(); i++) Q.run(0.5);
      const stacked = first && waits(), locked = qg.rails.locks('word');
      const again = stacked && rclick(); Q.run(2.5); const held1 = waits() && shut();
      // (the right button held down on the door: the ring of orders would come up here)
      const on = onDoor(); Q.I.clicked |= 4; Q.I.buttons |= 4; Q.run(0.8); const ring = !!QO.menu; Q.I.buttons &= ~4; Q.run(1.5); const held2 = waits() && shut();
      verdict(stacked && locked && again && held1 && on && !ring && held2, 'the word\'s lock holds inside the mode: four stacked on a door before the word\'s step wait there — a second right click on it is no entry, and the right button held gives no ring',
        `stacked and waiting ${stacked} (${QP.chains.map((C: any) => C.phase).join(',') || 'no chain'}) · word locked ${locked} · after a second right click: waiting ${held1} · the button held: ring ${ring}, waiting ${held2} · door shut ${shut()} · step '${qg.lesson.step?.id}'`); }
    // ---- 8: nothing in the lesson asks for his feet or for a key that opens or closes the mode (the file's own words and tests)
    { const steps = L.steps as any[], has = (t: any, is: string): boolean => !!t && (t.is === is || (t.of ?? []).some((x: any) => has(x, is)));
      const words = (T: any): string[] => [T.line, T.planLine, T.noTap, T.menuLine, T.pageLine, T.flatLine, T.explain?.title, T.explain?.text, T.after?.line, T.after?.word].filter((s: unknown) => typeof s === 'string');
      const NAMES = /\[Tab\]|\[B\]|\[Escape\]|walk to|walk into the|yourself|(open|close) plan mode|click[^.]*\bground\b|\bground to pick/i;   // ([Shift] is named: it adds a man to the picked — and Shift alone opens nothing, the command key is what the pair needs)
      const feet = steps.filter(T => has(T.done, 'in') || has(T.done, 'following') || (has(T.done, 'flag') && JSON.stringify(T.done).includes('"plan"'))).map(T => T.id);
      const gives = [...(L.rails.allow ?? []), ...steps.flatMap(T => T.allow ?? [])].filter((a: string) => a === 'move' || a === 'sprint');
      const downLines = steps.filter(T => T.planLine !== undefined).map(T => T.id), named = steps.filter(T => words(T).some(s => NAMES.test(s))).map(T => T.id);
      verdict(!feet.length && !gives.length && !downLines.length && !named.length, 'nothing in the lesson asks for his feet or for a key that opens or closes the mode',
        `${steps.length} steps · tests that read him: ${feet.join(', ') || 'none'} · \`move\` or \`sprint\` given: ${gives.join(', ') || 'no'} · steps with a line for the mode being down: ${downLines.join(', ') || 'none'} · lines or cards that name Tab, the command key, a walk, "yourself" or a click on bare ground: ${named.join(', ') || 'none'}`); }
  } finally { RAILS.on = keep.on; Math.random = keep.rnd; knobsBack(keep.knobs); AUTOPILOT.on = keep.ap; }
  console.log(`=== tutplan: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await tutplanCheck()) ? 0 : 1);
