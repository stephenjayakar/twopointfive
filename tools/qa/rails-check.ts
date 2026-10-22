// A TUTORIAL MISSION'S FRAME — the check behind src/game/rails.ts (RAILS.on: on in the page, ?rails=0; off on the frozen stand, TPS_RAILS=1).
//   bun run tools/qa/rails-check.ts [--verbose]      (also `probes.ts rails`, family missions; run it on BOTH stands: plain, and TPS_PROFILE=shipped in front)
// Headless, on levels/tut-sky.json (the first tutorial mission), the switch thrown by hand after each stand-up. Nothing here looks at a picture.
//   1. the level's lesson block is whole (lesson-check's own faults, the rails keys among them);
//   2. SWITCH OFF: the level is its mission alone — no lesson, the player stands on the floor where the file starts him, nothing is locked (the command key orders the
//      squad on the first step), the level's program is not started;
//   3. SWITCH ON, the first step: the player is parked out of the picture and out of every sense, the view rides the squad, the program is running and has
//      had the step's cue (its men are on the road); the command key is LOCKED (no order, the press counted as dropped) and so are the zoom and the walk keys;
//      only the turn of the view is open;
//   4. ONE ACTION A STEP: the turn done, the zoom opens and the walk keys do not; then the walk keys shift the view and nobody's feet; then the command key
//      orders the squad, and the order reaches the program (the squad's smoke goes out);
//   5. A STEP IS DONE BY ITS DEED: nothing done for ten seconds on the first step, it is still up, and the squad has not left its trucks;
//   6. NOBODY IS LOST: a teammate who would go down is on a knee and up again after the level's seconds; a man of the other side goes down as ever;
//   7. AN AUTHORED CHECKPOINT: the first step's was kept (and no other save was taken on the way); put back from two steps on, the lesson is on that step
//      again, the program was started again and had its cue again, and only what that step unlocked is open;
//   8. the room fight goes on beside the program (ROOMFIGHT's own `on`), and the scenario does not end as taken while a step is up;
//   9. the journal: a recording from before the key replays with the frame off, one that carries it keeps its own word;
//  10. THE MISSION AGAIN: Shift rides with Enter through the gate (the restart's keys) and alone does not; the seat's unseen player is no cheat to the verdict;
//      a restart from a later step is on the first step, only its action open, before a tick has passed, and does not end; the mission left, he is seen again.
//  14. THE ROWS (`rails.rows`, on levels/tut-quiet.json): Space offers only the verbs the mission names — at a locked door the pick and no boot; without
//      the list, every row the door has anywhere; and no row at all while Space itself is locked (the gate beside the start). And his own actions' ring (handring.ts) is worked with its own digit while it is up: on the whistle's
//      step the digit alone does nothing, the key kept down and then the digit whistles. A digit pressed inside the hold, before the ring is up,
//      whistles too and is no slot's.
// RAILS_BREAK=1 = the gate lets everything through, the ring is no place, nothing keeps it in the picture and the menu lists every order: lines 3, 4, 10, 11, 12, 13 and 14, the last line's, the wall's, the first play's notes' and the card's must fail (the opening card's line is data and a screen: no break of its own).   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { ROOT, standUp } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { RAILS, RAILS_STATS } = await import(`${ROOT}/src/game/rails.ts`);
const { checkLesson } = await import(`${ROOT}/src/game/lesson.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const VERBOSE = process.argv.includes('--verbose'), LEVEL = 'tut-sky', DT = 1 / 60;
const YARD = [17.6, 0.02, 20.4];
type V = number[];
const flat = (a: V, b: V) => Math.hypot(a[0] - b[0], a[2] - b[2]);

async function rig(on: boolean, seed = 1) {
  const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
  let W: any, started: any;
  try { W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/${LEVEL}.json`, 'utf8'))), seed }); RAILS.on = on; started = startFromQuery(W.game, `?levelFile=${LEVEL}.json&roomclear=1&squad4`); }
  finally { console.log = log; console.warn = warn; console.error = err; }
  const g = W.game, I = W.input;
  const quiet = <T,>(f: () => T): T => { if (VERBOSE) return f(); const l = console.log, w = console.warn; console.log = console.warn = () => { }; try { return f(); } finally { console.log = l; console.warn = w; } };
  const run = (secs: number, keys: string[] = []) => quiet(() => { for (let i = 0; i < Math.round(secs * 60); i++) { for (const k of keys) I.keys.add(k); W.step(DT); } for (const k of keys) I.keys.delete(k); });
  const press = (k: string) => quiet(() => { I.pressed.add(k); I.keys.add(k); W.step(DT); I.keys.delete(k); W.step(DT); W.step(DT); });
  const command = (p: V) => { W.cursorAt(p); run(2 / 60); W.cursorAt(p); press('KeyB'); };
  /** the host's own turn and zoom of the view, as host/loop.ts does them: only when the frame has them open */
  const turn = (rad: number) => { for (let i = 0; i < 40; i++) { if (!g.rails.locks('camera')) W.cam.rotate(rad / 40); run(1 / 60); } };
  const zoom = () => { for (let i = 0; i < 20; i++) { if (!g.rails.locks('zoom')) W.cam.zoom(60); run(1 / 60); } };
  const squad = () => g.guards.filter((x: any) => x.unit && x.team === 'operative' && x.state !== 'dead');
  return { W, g, I, run, press, command, turn, zoom, squad, why: started?.why as string | undefined };
}

export async function railsCheck(): Promise<boolean> {
  let all = true; const keep = { on: RAILS.on, rnd: Math.random };
  const verdict = (ok: boolean, label: string, detail: string) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };
  try {
    // ---- 1, 2: the block; the switch off
    { const R = await rig(false), g = R.g, L = g.level.scenarios?.lesson, faults = checkLesson(g);
      verdict(!R.why && !!L?.rails && faults.length === 0, 'the level starts and its lesson block is whole', `${R.why ?? 'started'} · ${L?.steps.length ?? 0} steps · ${faults.length ? faults.join(' · ') : 'no faults'}`);
      R.run(0.5); const p0 = [...g.player.char.pos], n0 = g.orders.log.length; R.command(YARD); R.run(0.3);
      const start = g.level.scenarios.roomClear.team.sam;
      verdict(!g.rails.live && !g.lesson.data && !g.lesson.objective() && !g.playerInvisible && flat(p0, start) < 0.6 && g.orders.log.length === n0 + 1 && !(g.director.run && !g.director.run.ended),
        'switch off: the level is its mission alone — no lesson, the player on the floor at the file\'s start, the command key orders the squad at once, no program',
        `live ${g.rails.live} · lesson ${g.lesson.data ? 'live' : 'none'} · the player ${flat(p0, start).toFixed(2)} m from the start · orders ${n0} → ${g.orders.log.length} · program ${g.director.run && !g.director.run.ended ? 'running' : 'none'}`); }
    // ---- 3, 4, 5
    { const R = await rig(true), g = R.g, d0 = RAILS_STATS.dropped; R.run(0.5);
      const park = g.level.scenarios.lesson.rails.sky.park, mid = R.squad().reduce((c: V, m: any) => [c[0] + m.char.pos[0] / 4, 0, c[2] + m.char.pos[2] / 4], [0, 0, 0]);
      const look = g.followPos(), n0 = g.orders.log.length, crew = g.guards.filter((x: any) => /^Tango [678]$/.test(x.callsign)).length;
      const p0 = [...g.player.char.pos]; R.command(YARD); R.run(0.3, ['KeyW']);
      const A = g.rails.allowed();
      verdict(g.rails.live && g.rails.skyOn && g.playerInvisible && flat(p0, park) < 0.6 && flat(look, mid) < 1.5 && !!g.director.run && !g.director.run.ended && crew === 3
        && g.orders.log.length === n0 && RAILS_STATS.dropped > d0 && g.rails.locks('zoom') && !g.rails.locks('camera') && g.rails.panned() === 0 && flat(g.player.char.pos, p0) < 0.05 && A.size === 1,
        'switch on, the first step: the player parked and unseen, the view on the squad, the program running with its men on the road; the command key, the zoom and the walk keys locked, the turn open',
        `live ${g.rails.live} · parked ${flat(p0, park).toFixed(2)} m off its place, unseen ${g.playerInvisible} · the view ${flat(look, mid).toFixed(2)} m off the squad's middle · the road's men ${crew} · orders ${n0} → ${g.orders.log.length} · presses dropped ${RAILS_STATS.dropped - d0} · open: ${[...A].join(' ')} · the view shifted ${g.rails.panned().toFixed(2)} m`);
      const at0 = R.squad().map((m: any) => [...m.char.pos]); R.run(10); const still = g.lesson.i, drift = Math.max(...R.squad().map((m: any, i: number) => flat(m.char.pos, at0[i])));
      verdict(still === 0 && drift < 1.5 && R.squad().length === 4, 'a step is done by its deed: ten seconds of nothing and the first step is still up — and the squad is still behind its trucks (nobody falls in on the parked player)', `step ${still + 1} after ten seconds · the man who moved most: ${drift.toFixed(2)} m`);
      R.turn(1.0); R.run(0.3); const s1 = g.lesson.i, z1 = !g.rails.locks('zoom'), pan1 = g.rails.locks('pan'); R.run(0.4, ['KeyD']); const shift0 = g.rails.panned();
      R.zoom(); R.run(1.0); const s2 = g.lesson.i; const feet = [...g.player.char.pos]; R.run(2.5, ['KeyD']); const shift1 = g.rails.panned(), s3 = g.lesson.i, moved = flat(g.player.char.pos, feet);
      const n1 = g.orders.log.length, sm0 = g.items?.list?.length ?? 0; R.command(YARD); R.run(1.5);
      const rows = g.director.rowsOf().map((r: any) => r.what).join('|'), smoke = /charge|Smoke out/.test(rows) || rows.includes('signal:order:move');
      verdict(s1 === 1 && z1 && pan1 && shift0 === 0 && s2 === 2 && shift1 > 5 && moved < 0.05 && s3 === 3 && g.orders.log.length === n1 + 1 && smoke,
        'one action a step: the turn opens the zoom (the walk keys stay shut), the zoom opens the walk keys (they shift the view, never his feet), then the command key orders the squad and the program hears it',
        `after the turn: step ${s1 + 1}, zoom ${z1 ? 'open' : 'locked'}, walk keys ${pan1 ? 'locked' : 'open'} (shift ${shift0.toFixed(2)} m) · after the zoom: step ${s2 + 1} · the walk keys: view ${shift1.toFixed(1)} m, feet ${moved.toFixed(2)} m, step ${s3 + 1} · orders ${n1} → ${g.orders.log.length} · the program ${smoke ? 'heard the order' : 'heard nothing'}`);
      void sm0; }
    // ---- 6, 8
    { const R = await rig(true), g = R.g; R.run(1.0);
      const mate = R.squad()[0], foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'), secs = g.level.scenarios.lesson.rails.respawn, t0 = g.time;
      const { ROOMFIGHT } = await import(`${ROOT}/src/game/roomfight.ts`); const fightOn = ROOMFIGHT.on ? !!g.fight?.on : true;
      killGuard(g, mate, [1, 0, 0], false, 'shot', 'guard'); const knee = mate.state !== 'dead' && g.rails.isSpared(mate) && mate.staggerUntil > g.time;
      killGuard(g, foe, [1, 0, 0], false, 'shot', 'player'); const down = foe.state === 'dead';
      R.run(secs + 0.5); const up = mate.state !== 'dead' && !g.rails.isSpared(mate);
      const end0 = g.roomClear.end; for (const x of g.guards) if (x.team === 'hostile' && x.state !== 'dead') killGuard(g, x, [1, 0, 0], false, 'shot', 'player'); R.run(0.5);
      verdict(knee && down && up, 'nobody is lost: a teammate who would go down is on a knee and up again; a man of the other side goes down as ever', `the teammate: ${knee ? 'on a knee' : mate.state} then ${up ? `up after ${(g.time - t0).toFixed(1)} s` : 'not up'} (the level's ${secs} s) · the other man: ${foe.state}`);
      verdict(fightOn && !end0 && !g.roomClear.end && g.lesson.i < g.level.scenarios.lesson.steps.length, 'the room fight runs beside the program, and the scenario does not end as taken while a step is up',
        `the room fight ${fightOn ? 'on' : 'OFF'} · every man of the other side put down on step ${g.lesson.i + 1}: the end is ${g.roomClear.end ?? 'not called'}`); }
    // ---- 7
    { const R = await rig(true), g = R.g, s0 = { ...g.saves.stats }, st0 = RAILS_STATS.starts, c0 = RAILS_STATS.cues; R.run(0.5);
      const kept = g.saves.stats.autosaves - s0.autosaves; R.turn(1.0); R.run(0.3); R.zoom(); R.run(1.0);
      const at = g.lesson.i, saves = g.saves.stats.autosaves - s0.autosaves, starts0 = RAILS_STATS.starts;
      const ck = g.saves.newest(true, g.mission.stats.elapsed), why = ck ? g.saves.loadInStep(g, ck.key) : 'no checkpoint on the shelf'; R.run(0.3);
      const A = g.rails.allowed(), back = g.lesson.i, cued = g.director.rowsOf().some((r: any) => r.what === 'signal:lesson:ambush');
      verdict(kept === 1 && saves === 1 && at === 2 && !why && back === 0 && RAILS_STATS.starts === starts0 + 1 && cued && A.size === 1 && A.has('camera') && g.rails.locks('zoom') && !!g.director.run && !g.director.run.ended,
        'an authored checkpoint: the first step\'s is kept and no other; put back from two steps on, the lesson is on that step, the program started again with its cue, and only that step\'s action is open',
        `saves at the first step ${kept}, by step ${at + 1}: ${saves} · put back: ${why ?? 'ok'} → step ${back + 1} · program starts ${st0} → ${starts0} → ${RAILS_STATS.starts}, cues ${c0} → ${RAILS_STATS.cues}, its cue again ${cued} · open: ${[...A].join(' ')}`); }
    // ---- 9
    { const J = await import(`${ROOT}/src/game/journal.ts`), R = await rig(true), snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(R.g)));
      RAILS.on = true; const old = snap(); delete old.tables.RAILS; J.applyKnobs(R.g, old); const a = RAILS.on;
      RAILS.on = true; const yes = snap(); RAILS.on = false; J.applyKnobs(R.g, yes); const b = RAILS.on;
      RAILS.on = false; const no = snap(); RAILS.on = true; J.applyKnobs(R.g, no); const c = RAILS.on;
      verdict(a === false && b === true && c === false, 'the journal: a recording from before the key replays with the frame off, one made with it on replays on, one made with it off replays off', `old → ${a} · recorded on → ${b} · recorded off → ${c}`); }
    // ---- 10: the mission again, and the mission left
    { const { quitScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
      const R = await rig(true), g = R.g, I = R.I; R.run(0.5); const d0 = g.seat.cam.distance; R.turn(1.2); R.run(0.6); R.zoom(); R.run(1.2); const was = g.lesson.i, d1 = g.seat.cam.distance;
      I.keys.add('ShiftLeft'); I.keys.add('Enter'); I.pressed.add('Enter'); g.rails.gate(I, R.W.cam, DT); const shift = I.keys.has('ShiftLeft'), enter = I.pressed.has('Enter'); I.keys.delete('ShiftLeft'); I.keys.delete('Enter'); I.pressed.delete('Enter');
      I.keys.add('ShiftLeft'); g.rails.gate(I, R.W.cam, DT); const sprint = I.keys.has('ShiftLeft'); I.keys.delete('ShiftLeft');
      const cheat = g.verdict.cheat, started = g.verdict.started;
      g.restartEncounter(); const A0 = g.rails.allowed(), sum0 = g.rails.summary(); R.run(3 / 60);
      const end = g.roomClear.end, i1 = g.lesson.i, A1 = g.rails.allowed(), unseen = g.playerInvisible, d2 = g.seat.cam.distance;
      R.W.game.rails.tick(DT); quitScenario(g); R.run(3 / 60); const after = g.playerInvisible;
      verdict(was === 2 && shift && enter && !sprint && started && !cheat && A0.size === 1 && A0.has('camera') && !end && i1 === 0 && A1.size === 1 && unseen && !after && Math.abs(d1 - d0) > 1 && Math.abs(d2 - d0) < 0.01,
        'the mission again: Shift rides with Enter through the gate (and alone does not), the run is no cheat\'s, a restart from the third step is on the first step with only its action open before a tick has passed, on the view the first run opened on, and does not end, and the mission left leaves the player seen again',
        `was on step ${was + 1} · Shift+Enter through ${shift && enter}, Shift alone ${sprint} · verdict started ${started}, cheat ${cheat} · before a tick: ${sum0} · after: step ${i1 + 1}, end ${end ?? 'none'}, open ${[...A1].join(' ')} · unseen in the seat ${unseen}, after quitting ${after} · view ${d0.toFixed(1)} → ${d1.toFixed(1)} → ${d2.toFixed(1)}`); }
    // ---- 11: the ring on the screen is the place it marks; the lookout sees the road and no room
    { const R = await rig(true), g = R.g, I = R.I; R.run(0.5); R.turn(1.0); R.run(0.3); R.zoom(); R.run(1.0); R.run(2.6, ['KeyD']);   // (the fourth step: its mark is on the yard)
      const at = g.lesson.step?.at as [number, number, number] | undefined, cv = R.W.canvas, cam = R.W.cam; const [sx, sy] = at ? cam.project(at, cv.clientWidth, cv.clientHeight) : [0, 0];
      I.mouseX = sx + 12; I.mouseY = sy - 9; const on = g.rails.markUnder(I, cam, cv); I.mouseX = sx + 140; const off = g.rails.markUnder(I, cam, cv);
      const foes = g.guards.filter((x: any) => x.team !== 'operative' && x.state !== 'dead'), road = foes.filter((x: any) => x.char.pos[2] > 22), house = foes.filter((x: any) => x.char.pos[2] < 18);
      const seenRoad = road.filter((x: any) => g.fogOfWar.drawn(x)).length, seenHouse = house.filter((x: any) => g.fogOfWar.drawn(x)).length;
      verdict(!!at && on === at && off === null && g.fogOfWar.active && road.length > 0 && seenRoad === road.length && house.length > 0 && seenHouse === 0,
        'the ring on the screen is the place it marks (the cursor on it is on that place, off it is not), and with the fog of war on from the first step the lookout has the men on the road in the picture and nobody in a room',
        `step '${g.lesson.step?.id}' mark ${at ? at.join(',') : 'none'} · cursor on the ring → ${on ? 'the place' : 'nothing'}, 140 px off → ${off ? 'the place' : 'nothing'} · fog ${g.fogOfWar.active ? 'on' : 'off'} · on the road ${seenRoad}/${road.length} drawn · in the house ${seenHouse}/${house.length} drawn`); }
    // ---- the last line stays up until the mission's own end
    { const R = await rig(true), g = R.g; R.run(0.5); const L = g.level.scenarios.lesson, n = L.steps.length, first = g.rails.prompt();
      g.lesson.i = n; const fin = g.lesson.finished, over = g.lesson.over(), last = g.rails.prompt();   // (every step done, the room clear still running)
      const was = g.roomClear.end; g.roomClear.end = 'taken'; const ended = g.rails.prompt(); g.roomClear.end = was;
      verdict(first?.n === 1 && fin && !over && last?.line === L.steps[n - 1].line && last?.n === n && last?.of === n && ended === null,
        'the last line stays up: with every step done and the mission still running the big line is the last step\'s, not the small row; once the mission is over there is none',
        `first up ${first?.n}/${first?.of} · every step done ${fin}, mission over ${over} → the line "${last?.line ?? 'none'}" (${last?.n ?? '-'}/${last?.of ?? '-'}) · mission over → ${ended ? `"${ended.line}"` : 'none'}`); }
    // ---- a mission that teaches the wall keeps a walk into one from taking it until that line (the quiet mission's house wall; `wall` is put on its last
    //      step here, then among what is open from the start: no mission in the tree with a man on the floor names it yet)
    { const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
      let W: any; try { W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/tut-quiet.json`, 'utf8'))), seed: 1 }); RAILS.on = true; startFromQuery(W.game, '?levelFile=tut-quiet.json&quiet'); }
      finally { console.log = log; console.warn = warn; console.error = err; }
      const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`), was = { on: WALLSNAP.on, press: WALLSNAP.press }; WALLSNAP.on = WALLSNAP.press = true;
      const g = W.game, I = W.input, L = g.level.scenarios.lesson, T = L.steps[L.steps.length - 1], allow0 = T.allow, base0 = L.rails.allow;
      const walk = () => { g.teleportPlayer([13.6, 0, 17.0]); for (let i = 0; i < 10; i++) W.step(DT); I.keys.add('KeyW'); for (let i = 0; i < 90; i++) W.step(DT); I.keys.delete('KeyW'); const on = !!g.player.wall; g.teleportPlayer([11.0, 0, 18.5]); for (let i = 0; i < 10; i++) W.step(DT); return on; };
      const plain = walk(), free0 = g.rails.locksWall();
      T.allow = [...(allow0 ?? []), 'wall']; const locked = g.rails.locksWall(), taught = walk();
      L.rails.allow = [...base0, 'wall']; g.restartEncounter(); for (let i = 0; i < 30; i++) W.step(DT); const open = g.rails.locksWall(), after = walk();
      T.allow = allow0; L.rails.allow = base0; WALLSNAP.on = was.on; WALLSNAP.press = was.press;
      verdict(plain && !free0 && locked && !taught && !open && after,
        'a mission that teaches the wall keeps a walk into one from taking it until that line: with no step naming the wall a move key held into the house wall takes it, as on any page; with the wall on a later step it does not; with the wall open it does again',
        `no step names it: taken ${plain} (locked ${free0}) · on the last step: locked ${locked}, taken ${taught} · open from the start: locked ${open}, taken ${after}`); }
    // ---- the first play's notes (tut-sky): the squad on a knee until its first order; no teammate's laser; the hold is its own line and a tap gives nothing
    //      on it; the wall has a lookout while its charge is up; the last order hands the view back to the squad and puts the night vision up
    { const R = await rig(true), g = R.g, I = R.I, L = g.level.scenarios.lesson, { laserOn } = await import(`${ROOT}/src/game/irlaser.ts`);
      const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`), ringOn = !!CMDRING.on && CMDRING.holdSecs > 0;   // (the ring on the command key held is a switch of its own: held off on the frozen stand)
      R.run(1.0); const men = R.squad(), low = men.filter((m: any) => m.script?.crouch === true).length;
      // (a laser: a teammate in the hunt, muzzle up — on with the level's key taken away, off with it)
      const m0 = men[0], st = m0.state, md = m0.muzzleDown; m0.state = 'alert'; m0.muzzleDown = false; const lasOff = laserOn(g, m0); delete L.rails.lasers; const lasOn = laserOn(g, m0); L.rails.lasers = false; m0.state = st; m0.muzzleDown = md;
      // the hold's step: a tap on the wall's ring gives no order and its words come up; held, the ring is up and the line is the ring's
      const k = L.steps.findIndex((T: any) => T.id === 'charge'), T = L.steps[k], WALL = T.at as number[]; g.lesson.i = k; R.run(0.2);
      const line0 = g.rails.prompt(), n0 = g.orders.log.length, eye = g.rails.stepEye();
      R.W.cursorAt(WALL); R.run(2 / 60); R.W.cursorAt(WALL); R.press('KeyB'); R.run(0.1);
      const tapGave = g.orders.log.length - n0, noted = g.rails.prompt()?.note ?? null;
      R.run(3.0); const noteGone = !g.rails.prompt()?.note;
      const up = () => { R.W.cursorAt(WALL); I.pressed.add('KeyB'); R.run(0.5, ['KeyB']); }, down = () => { I.pressed.add('Tab'); R.run(0.1); if (g.orders.menu) { g.orders.menu = null; g.orders.cmdRing = null; } };
      up(); const ring = !!g.orders.menu, line1 = g.rails.prompt()?.line ?? null;
      // (a page under the ring's first: the line is what is left to press · a tap just refused: its words are not up over a ring · the ring's FIRST wedge gives the tap's own order, and is no tap)
      R.press('Digit5'); R.run(0.1); const paged = !!g.orders.menu && g.orders.menu.page !== null, line2 = g.rails.prompt()?.line ?? null; down();
      R.W.cursorAt(WALL); R.press('KeyB'); R.run(0.05); const n1 = g.orders.log.length; up(); const noteUp = !!g.rails.prompt()?.note; R.press('Digit1'); R.run(0.2); const wedgeGave = g.orders.log.length - n1; down();
      // the last step: nothing ordered, the view is the hand's and the goggles stay; ordered on the trucks, the shift eases out and the goggles come up
      const z = L.steps.length - 1, TR = L.steps[z].at as number[], hold = L.steps[z].hold; L.steps[z].hold = 999; g.lesson.i = z;
      for (const m of men) g.orders.assign(m, { order: 'hold', post: [30, 0, 14], face: 0, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding' });   // (as if in the last room: this rig's squad never left the road)
      R.run(0.1); if (!g.player.nv) R.press('KeyN');   // (the squad of this rig never left the road: the step is kept from counting)
      R.run(2.0, ['KeyD']); R.run(0.3);
      const off0 = g.rails.panned(), nv0 = g.player.nv;
      for (const m of men) g.orders.assign(m, { order: 'move', post: [TR[0], 0, TR[2]], face: 0, stance: 'lowReady', upper: 'none', going: 'moving', there: 'there' });
      R.run(4.0); const off1 = g.rails.panned(), nv1 = g.player.nv; L.steps[z].hold = hold;
      verdict(low === men.length && men.length === 4 && !lasOff && lasOn && !!eye && line0?.line === T.line && (ringOn ? tapGave === 0 && noted === T.noTap && noteGone && ring && line1 === T.menuLine && paged && line2 === T.pageLine && !noteUp && wedgeGave >= 1 : tapGave >= 1 && !noted && !ring) && off0 > 3 && nv0 && off1 < 0.5 && !nv1,
        'the first play\'s notes hold: the squad is on a knee behind its trucks before any order; no teammate shows a laser on this level; on the hold\'s step a tap of the command key gives no order and its words come up under the line, held it puts the ring up and the line is the ring\'s, a page under it has its own, and the ring\'s first wedge gives its order (a stand with no ring to hold refuses no tap); the wall has its lookout; and once the last order is given the view goes back to the squad and the night vision comes up',
        `on a knee ${low}/${men.length} · laser with the key ${lasOff}, without ${lasOn} · step '${T.id}': "${line0?.line}", lookout ${!!eye} · tap gave ${tapGave} order(s), words "${noted}" (gone after 3 s: ${noteGone}) · held: ring ${ring}${ringOn ? '' : ' (the stand has none)'}, line "${line1}", page ${paged} "${line2}", words over the ring ${noteUp}, first wedge gave ${wedgeGave} · last step: shift ${off0.toFixed(1)} m, nv ${nv0} → ordered: shift ${off1.toFixed(1)} m, nv ${nv1}`); }
    // ---- the card and the arrow (a step's `explain`, `toward`): the page's two looks at the step. The game says only what the step's card is; which cards
    //      have been read is the page's (ui/railcard.ts, here on a made-up element): up when its step is, closed by Enter once it has been up a moment, not
    //      shown again on that page — and nothing of the run moves by it
    { const R = await rig(true), g = R.g, L = g.level.scenarios.lesson;
      const k = L.steps.findIndex((T: any) => !!T.explain), T = L.steps[k], other = L.steps.findIndex((T: any, i: number) => i > 0 && !T.explain);
      R.run(0.5); const none0 = g.rails.card(); g.lesson.i = k; R.run(0.2); const owed = g.rails.card(), t0 = g.time; R.run(1.0); const still = g.rails.card(), ran = g.time - t0;   // (a headless run is never held: the clock goes on under a card nobody closed)
      g.lesson.i = other; R.run(0.1); const noneThere = g.rails.card(); g.lesson.i = k; R.run(0.1);
      // the page's half, on a made-up element and a made-up clock
      const { railCard, CARD_ARM_MS } = await import(`${ROOT}/src/ui/railcard.ts`), G = globalThis as any, doc0 = G.document;
      const fake = () => ({ id: '', className: '', innerHTML: '', offsetWidth: 0, setAttribute() {}, addEventListener() {}, appendChild() {} }); let made: any = null, clock = 1000, closedN = 0;
      G.document = { createElement: () => (made = fake()) };
      let page: any; try { const C = railCard(fake(), () => clock), caps = (x: string) => x, ent = { code: 'Enter' }; C.onClose = () => { closedN++; };
        C.update(g.rails.card(), caps); const up = C.up && made.className === 'on' && made.innerHTML.includes(T.explain.title);
        const other1 = C.key({ code: 'KeyW' }), early = C.key(ent), upEarly = C.up; clock += CARD_ARM_MS + 1; const took = C.key(ent), gone = !C.up && made.className === '';
        C.update(g.rails.card(), caps); const again = C.up; const after = C.key(ent);   // (the same card, owed again by the step: read on this page, so none — and Enter is the game's again)
        C.update({ text: 'another' }, caps); const next = C.up; C.update(null, caps); const down = !C.up;
        page = { up, other1, early, upEarly, took, gone, again, after, next, down }; } finally { G.document = doc0; }
      const pageOk = page.up && !page.other1 && page.early && page.upEarly && page.took && page.gone && closedN === 1 && !page.again && !page.after && page.next && page.down;
      // the arrow: a step with `toward` beside its `at` is drawn as one; a step without is the ring
      const ring0 = g.rails.arrow(); T.toward = [T.at[0] + 2, 0, T.at[2]]; const arrow = g.rails.arrow(); delete T.toward;
      // …and a card nobody would read is a fault of the level
      const text0 = T.explain.text; T.explain.text = 'x'.repeat(400); const long = checkLesson(g).some((f: string) => /explain/.test(f)); T.explain.text = text0; const fine = !checkLesson(g).some((f: string) => /explain/.test(f));
      const main = readFileSync(`${ROOT}/src/main.ts`, 'utf8'), ov = readFileSync(`${ROOT}/src/ui/overlay.ts`, 'utf8');
      const wired = /frozen: \(\) => \([^\n]*overlay\.cardUp[^\n]*\) && !scripted/.test(main) && /input\.keyVeto = e => \(overlay\.cardUp && !menu\.isOpen && overlay\.cardKey\(e\)\)/.test(main) && /this\.card\.update\(this\.cards \? game\.rails\.card\(\) : null/.test(ov) && /game\.rails\.arrow\(\)/.test(ov);
      verdict(k > 0 && !none0 && !!owed && owed.text === T.explain.text && !!still && ran > 0.9 && !noneThere && pageOk && !ring0 && !!arrow && long && fine && wired,
        'a step\'s card and its arrow: the step that is up says its card and a step without one says none (a headless run is not held by it); on the page it is up with its words, Enter closes it only once it has been up a moment and is then no game key, another key is the game\'s, and a card read is not shown again on that page; a step with `toward` is drawn as an arrow and one without as the ring; a card too long to read is a fault of the level; the page holds the world under a card and a scripted page does not',
        `step '${T?.id}' "${T?.explain?.title}": said ${!!owed}, after 1 s ${!!still} (the clock ran ${ran.toFixed(2)} s) · step '${L.steps[other]?.id}' → ${noneThere ? 'a card' : 'none'} · the page: up ${page.up}, W taken ${page.other1}, Enter at once taken ${page.early} and still up ${page.upEarly}, Enter after ${CARD_ARM_MS} ms closes ${page.took && page.gone} (told ${closedN}), shown again ${page.again}, another card ${page.next} · arrow without the key ${!!ring0}, with ${!!arrow} · 400 characters a fault ${long}, as written ${!fine ? 'a fault' : 'none'} · wired ${wired}`); }
    // ---- the opening card: every tutorial mission's row says where we are and what it teaches, and the load brief draws both in place of the job's line
    { const { TUTORIAL_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
      const bad: string[] = [];
      for (const e of TUTORIAL_MISSIONS as any[]) { const t: string[] = e.teaches ?? [];
        if (!e.scene || e.scene.length < 40 || e.scene.length > 240) bad.push(`${e.id}: scene ${e.scene?.length ?? 0} characters`);
        if (t.length < 3 || t.length > 5 || t.some(x => x.length > 48 || /[6-9]|\[/.test(x))) bad.push(`${e.id}: teaches ${t.length} (${t.filter(x => x.length > 48).length} long)`); }
      const lb = readFileSync(`${ROOT}/src/ui/loadbrief.ts`, 'utf8'), drawn = /const scene = m\.scenario\?\.scene, teaches = m\.scenario\?\.teaches;/.test(lb) && /el\('div', 'bscene', scene\)/.test(lb) && /for \(const line of teaches\) ul\.appendChild/.test(lb);
      verdict(!bad.length && drawn && TUTORIAL_MISSIONS.length >= 4,
        'the opening card: every tutorial mission\'s row carries a scene (a sentence or two) and what it teaches (three to five short lines, things and not keys, no digit above 5), and the load brief draws both (read as text: tools/qa/loadbrief-check.ts holds the screen)',
        bad.length ? bad.join(' · ') : `${TUTORIAL_MISSIONS.length} rows: ${(TUTORIAL_MISSIONS as any[]).map(e => `${e.id} ${e.teaches?.length}`).join(' · ')} · drawn ${drawn}`); }
    // ---- 12: the mark stays in the picture, and clear of the step's line
    { const R = await rig(true), g = R.g, cam = R.W.cam; R.run(0.5); R.turn(1.0); R.run(0.3); R.zoom(); R.run(1.0); R.run(2.6, ['KeyD']);   // (the fourth step again)
      const at = g.lesson.step?.at as [number, number, number] | undefined, at_ = () => { const [x, y] = at ? cam.project(at, 1, 1) : [9, 9]; return [x, y] as [number, number]; };
      // (the picture's kept part, as fractions of the view: off its edges, not under the squad's panel — the top left, to 0.24 across and 0.30 down at the smallest view — and above the line low in its middle — index.html #railprompt, whose top is at 0.77)
      const inPic = ([x, y]: [number, number]) => x >= 0.20 && x <= 0.90 && y >= 0.08 && y <= 0.70 && !(x < 0.25 && y < 0.31), word = ([x, y]: [number, number]) => `${x.toFixed(2)},${y.toFixed(2)}`;
      const rows: { k: string; near: boolean; held: [number, number]; let_: [number, number] }[] = [];
      for (const near of [false, true]) {
        if (near) for (let i = 0; i < 40; i++) { cam.zoom(-60); R.run(1 / 60); }   // (zoomed in: the kept ground is a few metres)
        for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) { R.run(2.5, [k]); const held = at_(); R.run(4); rows.push({ k: k.slice(3), near, held, let_: at_() }); }
      }
      const out = rows.filter(r => !inPic(r.held)).length, back = rows.filter(r => inPic(r.let_)).length, step = g.lesson.step?.id;
      verdict(!!at && out >= 4 && back === rows.length && step === 'move',
        'the mark stays in the picture: a view shifted far off the step\'s mark stays there while the walk key is held, and once it is let go the mark comes back inside the picture\'s edges, clear of the squad\'s panel and above the step\'s line, each way the view can be shifted, zoomed out and in',
        `step '${step}' · the mark on the view (0,0 top left, 1,1 bottom right), key held → let go: ${rows.map(r => `${r.near ? 'near ' : ''}${r.k} ${word(r.held)} → ${word(r.let_)}`).join(' · ')} · out while held ${out}/${rows.length}, back in ${back}/${rows.length}`); }
    // ---- 13: the menu lists only the mission's orders
    { const R = await rig(true), g = R.g; R.run(0.5); const ids = (p: number[]) => g.orders.rowsFor(g.orders.targetAt(p)).map((d: any) => d.id).join(' ');
      const door = ids([17.0, 1.0, 11.2]), yard = ids([17.6, 0.02, 20.4]), wall = ids([27.95, 1.1, 9.4]);
      verdict(door === 'stack' && yard === 'move go' && (wall === 'move go walltools' || wall === 'move go'),   // (the wall's tools are a switch of their own: held off on the frozen stand)
        'the squad\'s menu lists only the orders the mission names: a door has the stack, the yard the move and the word, the store\'s wall its tools as well where the stand has them, and nothing else is on the ring',
        `door: ${door} · yard: ${yard} · wall: ${wall}`); }
    // ---- 14: Space offers only the rows the mission names (the quiet mission's back door: locked, and a boot would open it too)
    { const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
      let W: any; try { W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/tut-quiet.json`, 'utf8'))), seed: 1 }); RAILS.on = true; startFromQuery(W.game, '?levelFile=tut-quiet.json&quiet'); }
      finally { console.log = log; console.warn = warn; console.error = err; }
      const g = W.game, R = g.lesson.data?.rails, named: string[] = R?.rows ?? [], DOOR = [27.9, 1.0, 16.5];
      const verbs = (at: number[] | null, aim: number[]) => { if (at) g.teleportPlayer(at); for (let i = 0; i < 12; i++) { W.cursorAt(aim); W.step(DT); } return [...new Set<string>(g.nearby.filter((r: any) => r.verb).map((r: any) => r.verb as string))]; };
      // (the first step, at the start beside the yard's gate: Space is not open yet, so the gate has no row; without the list it has its own)
      const GATE = [8.0, 1.0, 14.0], shut = verbs(null, GATE); if (R) R.rows = undefined; const shut0 = verbs(null, GATE); if (R) R.rows = named;
      // …and his own actions' ring (handring.ts), up under the interaction key, is worked with its own keys: on the whistle's step (the fourth: a key, two
      // places stood on) the key kept down and then the last wedge's digit whistles, though no slot's digit is open
      const { HANDRING } = await import(`${ROOT}/src/game/handring.ts`), { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`), ring0 = HANDRING.on, I = W.input, L = g.level.scenarios.lesson;
      const run = (n: number) => { for (let i = 0; i < n; i++) W.step(DT); }, tap = (k: string) => { I.pressed.add(k); I.keys.add(k); W.step(DT); I.keys.delete(k); W.step(DT); };
      // (the two places stood on are the steps' own marks, read from the level: its marks have moved once already)
      const floorOf = (id: string): number[] => { const m = L.steps.find((s: any) => s.id === id)?.at ?? [0, 0, 0]; return [m[0], 0, m[2]]; }, DARK = floorOf('dark'), WHISTLE = floorOf('whistle');
      g.restartEncounter(); run(30); HANDRING.on = true; tap('KeyC'); run(20); for (const p of [DARK, WHISTLE]) { g.teleportPlayer(p); run(90); }
      const at = L.steps[g.lesson.i]?.id, digit = `Digit${CMDRING.wedges}`;
      const on = verbs([27.9, 0, 17.2], DOOR); if (R) R.rows = undefined; const all0 = verbs(null, DOOR); if (R) R.rows = named;   // (Space is open from the whistle's step on)
      const extra = all0.filter(v => !named.includes(v)), pick = g.rails.offers('pick'), boot = g.rails.offers(extra[0] ?? 'pick'); g.teleportPlayer(WHISTLE); run(20);
      tap(digit); run(10); const early = L.steps[g.lesson.i]?.id;   // (no ring up: the digit is a slot's, and locked)
      I.pressed.add('Space'); I.keys.add('Space'); run(Math.ceil((HANDRING.holdSecs + 0.1) * 60)); I.keys.delete('Space'); const up = !!g.player.sel.ring; run(2); tap(digit); run(10);
      const after = L.steps[g.lesson.i]?.id;
      // …and a digit pressed INSIDE the hold, before the ring is up (handring.ts `early`: what a hand does with "Hold E, then 5"), is the wedge too: the gate
      // lets it through to the ring and it is no slot's
      const early0 = HANDRING.early; HANDRING.early = true; g.restartEncounter(); run(30); tap('KeyC'); run(20); for (const p of [DARK, WHISTLE]) { g.teleportPlayer(p); run(90); }
      const at2 = L.steps[g.lesson.i]?.id, slot0 = `${g.player.slot}${g.player.holstered ? ' away' : ''}`;
      I.pressed.add('Space'); I.keys.add('Space'); run(4); const notYet = !g.player.sel.ring; I.pressed.add(digit); I.keys.add(digit); W.step(DT); I.keys.delete(digit); run(2); I.keys.delete('Space'); run(10);
      const quick = L.steps[g.lesson.i]?.id, slot1 = `${g.player.slot}${g.player.holstered ? ' away' : ''}`; HANDRING.on = ring0; HANDRING.early = early0;
      verdict(at2 === 'whistle' && notYet && quick === 'grab' && slot1 === slot0 && named.length > 0 && on.includes('pick') && on.every(v => named.includes(v)) && extra.length > 0 && pick && !boot && shut.length === 0 && shut0.length > 0 && at === 'whistle' && early === 'whistle' && up && after === 'grab',
        'Space offers only the rows the mission names: at a locked door the pick is there and the boot is not; without the list the door has every row it has anywhere; and while Space itself is locked a thing in reach has no row at all. His own ring is worked with its own digit: the key kept down, then the last wedge, whistles; and the digit pressed inside the hold, before the ring is up, whistles too and draws nothing',
        `the list: ${named.join(' ')} · on the first step at the gate: ${shut.join(' ') || 'no row'} (without the list: ${shut0.join(' ') || 'no row'}) · at the back door with it: ${on.join(' ') || 'no row'} · without it: ${all0.join(' ') || 'no row'} · the ring: on step '${at}', the digit alone leaves '${early}', the key held puts the ring ${up ? 'up' : 'NOT up'}, then the digit: '${after}' · the digit 0.07 s into the hold (ring ${notYet ? 'not yet up' : 'UP'}): '${at2}' → '${quick}', in his hand ${slot0} → ${slot1}`); }
  } finally { RAILS.on = keep.on; Math.random = keep.rnd; }
  console.log(`=== rails: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await railsCheck()) ? 0 : 1);
