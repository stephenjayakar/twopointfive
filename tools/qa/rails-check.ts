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
// RAILS_BREAK=1 = the gate lets everything through, the ring is no place, nothing keeps it in the picture and the menu lists every order: lines 3, 4, 10, 11, 12 and 13 must fail.   exit 0 = all hold · 1 = one does not
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
  } finally { RAILS.on = keep.on; Math.random = keep.rnd; }
  console.log(`=== rails: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await railsCheck()) ? 0 : 1);
