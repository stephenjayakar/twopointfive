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
//  THE SECOND PLAY'S NOTES (tut-sky): the roadblock's fire lands over many places and none by a man; Shift down with the command key gives the order while
//      the plan is locked (RAILS.shiftTap); a line says what the men are doing once its order is out and asks again when nothing comes of it (a step's
//      `after`, RAILS.afterSecs / afterMax); a line with no key in it is one to watch; the page's input lets go of a modifier the system says is up.
//  THE GATE'S BEAT: the squad set in the yard, the roadblock comes down the road (the script's `direct` walk) and the line is gone within eight seconds;
//      with that word taken off its men, and covered lanes on (the page's stand), it is long. No break of its own: the second run is its proof.
//  THE BIG LINE AND YOUR OWN MEN (ui/railclear.ts, Rails.lineMen, RAILS.lineClear): the line has two places, where it lies and the bottom edge, and is at
//      the edge while a man of yours is under where it lies; the frame lists the squad, and the player when he is on the floor. And a deed can name the
//      man an order was given on. RAILS_BREAK=1 reaches this line through the list alone (nobody on it); the rule on boxes and the deed have no break.
//  THE FRAME'S EYES ARE THE PLAYER'S VIEW (fogofwar.ts update, RAILS.eyeFirst, RAILS.eyeView): a step's eye has a place among the fog's five, and a man
//      only a frame's eye has is drawn, not seen: the squad's entry on his room's door is the one it would take with no eye there. RAILS_BREAK=1 reaches
//      both lines through the step's eye (none is named under it).
// RAILS_BREAK=1 = the gate lets everything through, the ring is no place, nothing keeps it in the picture and the menu lists every order: lines 3, 4, 10, 11, 12, 13 and 14, the last line's, the wall's, the first play's notes', the second play's, the card's, the card's beat's, the big line's, the two of the step's eye and the plan on the move must fail (the opening card's line is data and a screen: no break of its own).   exit 0 = all hold · 1 = one does not
import { readFileSync } from 'node:fs';
import { ROOT, standUp } from './headless.ts';
const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { RAILS, RAILS_STATS } = await import(`${ROOT}/src/game/rails.ts`);
const { checkLesson } = await import(`${ROOT}/src/game/lesson.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const VERBOSE = process.argv.includes('--verbose'), LEVEL = 'tut-sky', DT = 1 / 60;
const YARD = [11.4, 0.02, 16.4];
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
      const look = g.followPos(), n0 = g.orders.log.length, crew = g.guards.filter((x: any) => /^Tango (8|9|10)$/.test(x.callsign)).length;
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
    // ---- 11: the ring on the screen is the place it marks; the mission has no fog of war (the level's `rails.fog: false`): every man on the floor is in the picture
    { const R = await rig(true), g = R.g, I = R.I; R.run(0.5); R.turn(1.0); R.run(0.3); R.zoom(); R.run(1.0); R.run(2.6, ['KeyD']);   // (the fourth step: its mark is on the yard)
      const at = g.lesson.step?.at as [number, number, number] | undefined, cv = R.W.canvas, cam = R.W.cam; const [sx, sy] = at ? cam.project(at, cv.clientWidth, cv.clientHeight) : [0, 0];
      I.mouseX = sx + 12; I.mouseY = sy - 9; const on = g.rails.markUnder(I, cam, cv); I.mouseX = sx + 140; const off = g.rails.markUnder(I, cam, cv);
      const foes = g.guards.filter((x: any) => x.team !== 'operative' && x.state !== 'dead'), road = foes.filter((x: any) => x.char.pos[2] > 22), house = foes.filter((x: any) => x.char.pos[2] < 18);
      const seenRoad = road.filter((x: any) => g.fogOfWar.drawn(x)).length, seenHouse = house.filter((x: any) => g.fogOfWar.drawn(x)).length;
      verdict(!!at && on === at && off === null && !g.fogOfWar.active && road.length > 0 && seenRoad === road.length && house.length > 0 && seenHouse === house.length,
        'the ring on the screen is the place it marks (the cursor on it is on that place, off it is not), and the mission is played with no fog of war: the men on the road and the men in the rooms are all in the picture',
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
    { const R = await rig(true), g = R.g, I = R.I, L = g.level.scenarios.lesson, { laserOn, IR } = await import(`${ROOT}/src/game/irlaser.ts`);
      const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`), ringOn = !!CMDRING.on && CMDRING.holdSecs > 0;   // (the ring on the command key held is a switch of its own: held off on the frozen stand)
      R.run(1.0); const men = R.squad(), low = men.filter((m: any) => m.script?.crouch === true).length;
      // (a laser: a teammate in the hunt, muzzle up — on with the level's key taken away, off with it)
      // (the page now shows no teammate's laser anywhere, IR.teamOff: the level's own key is asked with that switch held off, as `?teamlasers` would have it —
      //  the mission keeps its word whichever way the page's switch stands)
      const m0 = men[0], st = m0.state, md = m0.muzzleDown, tOff = IR.teamOff; IR.teamOff = false; m0.state = 'alert'; m0.muzzleDown = false; const lasOff = laserOn(g, m0); delete L.rails.lasers; const lasOn = laserOn(g, m0); L.rails.lasers = false; m0.state = st; m0.muzzleDown = md; IR.teamOff = tOff;
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
      for (const m of men) g.orders.assign(m, { order: 'hold', post: [32, 0, 16.5], face: 0, stance: 'lowReady', upper: 'none', going: 'holding', there: 'holding' });   // (as if in the last room: this rig's squad never left the road)
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
    // ---- the card's beat (RAILS.cardBeat; "we show the modals too quickly. like it should happen a beat after something happens on screen"): THE STEP
    //      BEFORE A CARD SETTLES. Its deed done, the lesson stays on it — no card, the next step's keys still shut, its line something to watch — for the
    //      beat; then the next step comes up with its card. A fight holds a card only where the card asks (`explain.quiet`): there it waits while his
    //      squad is still firing or a man has just gone down, until that has been quiet a couple of seconds, and `cardMax` ends any wait; the other
    //      side's rounds alone hold nothing. A card marked `explain.now` and a step whose next one has no card wait for nothing. What he does while the
    //      step settles is NOT the next step's (a step counts from the tick it comes up); a step that only waited for the script keeps its own line
    //      while it settles; a step moved by hand under a done deed is not done by it. The word ?cardbeat=0, the stand's word TPS_CARDBEAT and a
    //      recording from before the key: the rule is off in the module and on the frozen stand, and raised here for the question. Nobody's ears are on
    //      (aiEnabled off) and the level's script is stopped: every round here is the check's own, filed as combat.ts files one. RAILS_BREAK=1: no
    //      step settles.
    { const J = await import(`${ROOT}/src/game/journal.ts`), PR = await import(`${ROOT}/src/host/profile.ts`), { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`), { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`), k0 = knobsCopy();
      const R = await rig(true), g = R.g, L = g.level.scenarios.lesson, stood = RAILS.cardBeat, holds = (PR.FROZEN_HOLDS as Record<string, string>)['RAILS.cardBeat']; g.aiEnabled = false; R.run(0.5); g.director?.stop?.(false); RAILS.cardBeat = true;
      const k = L.steps.findIndex((T: any, i: number) => i > 1 && !!T.explain && !T.explain.now && !L.steps[i - 1].explain), plain = L.steps.findIndex((_: any, i: number) => i > 0 && i !== k - 1 && !!L.steps[i + 1] && !L.steps[i + 1].explain);
      const title = 'the step before a card settles: its deed done, the lesson stays on it for a beat (the next step not up, no card, nothing asked) and then the card lands, his squad firing or not; a card marked quiet also waits while his squad is firing or a man has just gone down, until that has been quiet for a couple of seconds, and the longest wait is capped; the other side\'s rounds alone hold nothing; a card marked to cut in, a step with no card after it and the switch off wait for nothing; what he does while it settles is not the next step\'s; a step that only waited for the script keeps its line; a step moved by hand is not done by the last one\'s deed; the rule is on as the page stands and off on the frozen stand, and the word and an older recording put it off';
      if (k < 2 || plain < 1) verdict(false, title, `this level has no card after a step without one (${k}) or no step without a card after it (${plain})`);
      else { const T = L.steps[k], E = T.explain, tests = [L.steps[k - 1].done, L.steps[plain].done], marks = { quiet: E.quiet, now: E.now }, max = RAILS.cardMax;
        try {
          const mate = R.squad()[0], foe0 = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead');
          /** a round as combat.ts files it: a teammate's (his side's fight), or a man of the other side's (a level's staged fire: nothing waits on it) */
          const round = (who: any) => { g.events.push({ kind: 'guardShot', pos: [...who.char.pos], time: g.time, loud: true, level: 1, weapon: 'fn2000', from: [...who.char.pos], to: [...who.char.pos], who: who.char.id }); };
          const fight = (secs: number, who: any = mate) => { for (let t = 0; t < secs - 1e-6; t += 0.25) { round(who); R.run(0.25); } };
          /** step `i` is up with its deed not done · its deed is done (the level's own test stood in for: this line is about what comes after it) */
          const put = (i: number) => { L.steps[i].done = { is: 'any', of: [] }; g.lesson.i = i; (g.lesson as any).seen = null; R.run(2 / 60); }, deed = (i: number) => { L.steps[i].done = { is: 'all', of: [] }; R.run(2 / 60); };
          type Look = { at: number; settling: boolean; card: boolean; line: string | null; watch: boolean };
          const look = (): Look => { const p = g.rails.prompt(); return { at: g.lesson.i, settling: g.lesson.settling, card: !!g.rails.card(), line: p?.line ?? null, watch: !!p?.watch }; };
          const held = (x: Look) => x.at === k - 1 && x.settling && !x.card && x.watch && x.line === '', there = (x: Look) => x.at === k && !x.settling && x.card && !!x.line;
          const B = RAILS.cardBeatSecs, Q = RAILS.cardQuiet;
          // ---- a card with no word of its own: the beat, whatever is playing
          delete E.quiet; delete E.now;
          R.run(Q + 0.5); put(k - 1); const a0 = look(); deed(k - 1); const q0 = look(); R.run(B - 0.3); const q1 = look(); R.run(0.5); const q2 = look();   // a quiet floor
          put(k - 1); fight(0.5); deed(k - 1); const b0 = look(); fight(B + 0.25); const b1 = look();   // his squad firing all the while: the beat and no more
          // (a deed of his own while it settles — a whistle, filed as the game files one — is the next step's when it comes up)
          R.run(Q + 0.5); put(k - 1); deed(k - 1); g.events.push({ kind: 'whistle', pos: [...g.player.char.pos], time: g.time, loud: false, level: 0.3, who: PLAYER_ID } as any); const own = L.steps[k - 1].done; L.steps[k - 1].done = { is: 'cue', name: 'none' }; const cue = g.rails.prompt(); L.steps[k - 1].done = own;   // (…and a step that only waited for the script keeps its own line while it settles)
          R.run(B + 0.2); const carried = g.lesson.i === k ? (g.lesson as any).seen?.n.get('event:whistle') ?? 0 : -1;
          // (the step moved by hand while one settles: the step put up is not done by the other's deed)
          put(k - 1); deed(k - 1); L.steps[plain].done = { is: 'any', of: [] }; g.lesson.i = plain; R.run(4 / 60); const moved = { at: g.lesson.i, settling: g.lesson.settling };
          // ---- a card marked quiet: the fight his deed set off is watched to its end
          E.quiet = true;
          R.run(Q + 0.5); put(k - 1); deed(k - 1); R.run(B - 0.3); const u1 = look(); R.run(0.5); const u2 = look();   // a quiet floor: still the beat alone
          put(k - 1); fight(0.5); deed(k - 1); const f0 = look(); fight(2.5); const f1 = look(); R.run(Q - 0.5); const f2 = look(); R.run(0.6); const f3 = look();   // his squad firing as the deed is done
          R.run(Q + 0.5); put(k - 1); fight(0.5, foe0); deed(k - 1); fight(B + 0.25, foe0); const e1 = look();   // the other side's rounds alone
          R.run(Q + 0.5); put(k - 1); deed(k - 1); R.run(0.3); fight(B); const s0 = look(); R.run(Q + 0.1); const s1 = look();   // his fight begun after the deed
          RAILS.cardMax = 3; put(k - 1); fight(0.5); deed(k - 1); fight(2.5); const c0 = look(); fight(1.0); const c1 = look(); RAILS.cardMax = max;   // the cap
          R.run(Q + 0.5); put(k - 1); const foe = g.guards.find((x: any) => x.team === 'hostile' && x.state !== 'dead'); killGuard(g, foe, [1, 0, 0], false, 'shot', 'player'); R.run(0.1); deed(k - 1); R.run(B + 0.2); const d0 = look(); R.run(Q - B + 0.3); const d1 = look();   // a man going down
          E.now = true; put(k - 1); fight(0.5); deed(k - 1); const n0 = look(); delete E.now;   // a card that cuts in, whatever else it says
          R.run(Q + 0.5); put(plain); fight(0.5); deed(plain); const p0 = g.lesson.i;   // a step whose next one has no card
          RAILS.cardBeat = false; put(k - 1); fight(0.5); deed(k - 1); const o0 = look(); RAILS.cardBeat = true;   // the switch off
          const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(g)));
          const was = snap(); delete was.tables.RAILS.cardBeat; J.applyKnobs(g, was); const old = RAILS.cardBeat;
          RAILS.cardBeat = true; const made = snap(); RAILS.cardBeat = false; J.applyKnobs(g, made); const kept = RAILS.cardBeat;
          const read = (q: string) => { RAILS.cardBeat = !RAILS.cardBeat; PR.pageSwitches(new URLSearchParams(q)); return RAILS.cardBeat; }, word = `${read('')}/${read('cardbeat=0')}`;
          const say = (x: Look) => x.at === k ? (x.card ? 'the card' : 'the next step, NO CARD') : x.settling ? `settles${x.line ? ` ("${x.line}")` : ''}` : 'its ask';
          verdict(a0.at === k - 1 && !a0.settling && !!a0.line && !a0.watch && held(q0) && held(q1) && there(q2) && held(b0) && there(b1) && carried === 0 && !!cue?.watch && !!cue.line && stood === (process.env.TPS_PROFILE === 'shipped') && /TPS_CARDBEAT=1/.test(holds ?? '') && moved.at === plain && !moved.settling
            && held(u1) && there(u2) && held(f0) && held(f1) && held(f2) && there(f3) && there(e1) && held(s0) && there(s1) && held(c0) && there(c1) && held(d0) && there(d1) && there(n0) && p0 > plain && there(o0) && old === false && kept === true && word === 'true/false',
            title,
            `'${L.steps[k - 1]?.id}' before '${T?.id}' "${E?.title}"${marks.quiet ? ' (the level marks it quiet)' : ''}, beat ${B} s, quiet ${Q} s · deed not done: ${say(a0)} · A PLAIN CARD, quiet floor: at once ${say(q0)}, ${(B - 0.3).toFixed(1)} s ${say(q1)}, ${(B + 0.2).toFixed(1)} s ${say(q2)} · his squad firing throughout: at once ${say(b0)}, ${(B + 0.25).toFixed(2)} s ${say(b1)} · a whistle of his while it settles: ${carried} counted by the next step · a step that waited for the script, settling: "${cue?.line}"${cue?.watch ? ' (to watch)' : ' (AN ASK)'} · as this stand comes up: ${stood ? 'on' : 'off'} (the frozen stand's word: ${holds ?? 'NONE'}) · the step moved by hand while one settles: step ${moved.at + 1} up, ${moved.settling ? 'SETTLING' : 'not done'} · A QUIET CARD, quiet floor: ${(B - 0.3).toFixed(1)} s ${say(u1)}, ${(B + 0.2).toFixed(1)} s ${say(u2)} · his squad firing: at once ${say(f0)}, 2.5 s of it ${say(f1)}, ${(Q - 0.25).toFixed(2)} s quiet ${say(f2)}, ${(Q + 0.35).toFixed(2)} s quiet ${say(f3)} · only the other side firing: ${say(e1)} · his fight begun after the deed: ${say(s0)}, then ${(Q + 0.1).toFixed(1)} s quiet ${say(s1)} · a cap of 3 s: at 2.5 s ${say(c0)}, at 3.5 s ${say(c1)} · a man down: ${(B + 0.3).toFixed(1)} s ${say(d0)}, ${(Q + 0.6).toFixed(1)} s ${say(d1)} · marked now: ${say(n0)} · '${L.steps[plain]?.id}', no card after it, his squad firing: ${p0 > plain ? 'on at once' : 'STILL UP'} · switch off: ${say(o0)} · older recording → ${old ? 'ON' : 'off'}, one made with it → ${kept ? 'on' : 'OFF'} · the word '' / cardbeat=0 → ${word}`);
        } finally { L.steps[k - 1].done = tests[0]; L.steps[plain].done = tests[1]; if (marks.quiet === undefined) delete E.quiet; else E.quiet = marks.quiet; if (marks.now === undefined) delete E.now; else E.now = marks.now; RAILS.cardMax = max; knobsBack(k0); } } }
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
    // ---- the second play's notes (tut-sky): the roadblock's fire is walked over many places and none near a man; Shift with the command key is the command
    //      key while the plan is locked (before, the press was thrown away with its row still on the panel); a line stops asking once its order is out and
    //      asks again when nothing comes of it; a line with no key in it is one to watch; the page's input lets go of a modifier the system says is up
    { const R = await rig(true), g = R.g, I = R.I, L = g.level.scenarios.lesson;
      const marks: number[][] = [], add = g.decals.add.bind(g.decals); g.decals.add = (k: any, p: number[], ...r: any[]) => { marks.push([p[0], p[2]]); return add(k, p, ...r); };
      R.run(14); g.decals.add = add;
      const bins = new Map<string, number>(); for (const m of marks) { const k = `${Math.round(m[0])},${Math.round(m[1])}`; bins.set(k, (bins.get(k) ?? 0) + 1); }
      const top = Math.max(0, ...bins.values()), men = R.squad(); let near = 99; for (const m of marks) for (const o of men) near = Math.min(near, flat([m[0], 0, m[1]], o.char.pos));
      const spread = marks.length >= 30 && top / marks.length <= 0.3 && bins.size >= 10 && near >= 1.5 && men.length === 4;   // (before: 12 metres marked in thirty seconds, 58% in one — ten in fourteen is far from that and a bin clear of this script's dice)
      // the stack's step: Shift down and the command key on the door — nothing with the rule off (the build as it was), the order with it
      const k = L.steps.findIndex((T: any) => T.id === 'stack'), T = L.steps[k], DOOR = T.at as number[]; g.lesson.i = k; R.run(0.3);
      const ask = g.rails.prompt();
      // (an order pointed somewhere else is not the step being done: its line stays the ask. And a step's own line with no key in it is an ask, not a line to watch)
      R.command([13.5, 0, 23.4]); R.run(0.3); const wrong = g.rails.prompt(), wrongGiven = g.orders.log.length > 0;
      const was = T.line; T.line = 'Get up to the door'; const plain = g.rails.prompt(); T.line = was;
      const shifted = (on: boolean) => { RAILS.shiftTap = on; const n = g.orders.log.length; R.W.cursorAt(DOOR); R.run(3 / 60, ['ShiftLeft']); R.W.cursorAt(DOOR); I.pressed.add('KeyB'); R.run(3 / 60, ['ShiftLeft', 'KeyB']); R.run(0.2, ['ShiftLeft']); return g.orders.log.slice(n).map((o: any) => o.order); };
      const tap0 = RAILS.shiftTap; let off: string[] = [], on: string[] = []; try { off = shifted(false); on = shifted(true); } finally { RAILS.shiftTap = tap0; }
      // …and its line: the ask before, what the men are doing after — and the ask again once that has stood too long with the step not done
      const aft = g.rails.prompt(), max = RAILS.afterMax; let again: ReturnType<typeof g.rails.prompt> = null; try { RAILS.afterMax = 1.5; R.run(2.0); again = g.rails.prompt(); } finally { RAILS.afterMax = max; }
      // the stack's door on the floor plan: its bar, and no key on it while the step holds the word shut; the key once a step opens the word
      const { floorPlan } = await import(`${ROOT}/src/game/floorplan.ts`), caps = () => floorPlan(g).doors.filter((d: any) => d.door).map((d: any) => `${d.why}:${d.key ?? '-'}`).join(' ');
      const shut = g.rails.locks('word'), capShut = caps(), kw = L.steps.findIndex((_: any, j: number) => { g.lesson.i = j; return j > k && !g.rails.locks('word'); }), capOpen = kw >= 0 ? caps() : 'no step opens the word'; g.lesson.i = k;
      verdict(shut && /\bstack:-/.test(capShut) && !/:F/.test(capShut) && /\bstack:F/.test(capOpen),
        'a key is named on the floor only once its lesson has opened it: at the stack\'s step the word is shut, the stack\'s door has its bar and no key on it; at the first step that opens the word the same door carries the key',
        `the word shut ${shut} · the doors then: ${capShut || 'none'} · at step ${kw >= 0 ? L.steps[kw].id : '-'}: ${capOpen || 'none'}`);
      const kg = L.steps.findIndex((T: any) => T.id === 'gate'); g.lesson.i = kg; const gate = g.rails.prompt();   // (read as it comes up: its cue is long past on this floor and the step is done on its first tick)
      // the page's input (game/input.ts), on a made-up window: a Shift whose key-up never came goes with the next event that says it is up; a key that goes down again unrepeated is a fresh press
      const { Input } = await import(`${ROOT}/src/game/input.ts`); const G: any = globalThis, had: Record<string, unknown> = {}, names = ['window', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement'];
      for (const n of names) had[n] = G[n];
      const ls = new Map<string, ((e: any) => void)[]>(), hear = (t: string, f: (e: any) => void) => { ls.set(t, [...(ls.get(t) ?? []), f]); };
      const fire = (t: string, e: Record<string, unknown>) => { for (const f of ls.get(t) ?? []) f({ preventDefault() { }, stopPropagation() { }, target: null, repeat: false, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, clientX: 0, clientY: 0, movementX: 0, movementY: 0, ...e }); };
      let keysOk = false, keysWhy = '';
      try { const win: any = { addEventListener: hear }; win.top = win.self = win; G.window = win; for (const n of names.slice(1)) G[n] ??= class { };
        const inp: any = new Input({ addEventListener: hear, getBoundingClientRect: () => ({ left: 0, top: 0 }) } as any);
        fire('keydown', { code: 'ShiftLeft', key: 'Shift', shiftKey: true }); const held = inp.keys.has('ShiftLeft');
        fire('keydown', { code: 'KeyW', key: 'w', shiftKey: true }); const kept = inp.keys.has('ShiftLeft');            // (really down: it stays)
        fire('keyup', { code: 'KeyW', key: 'w', shiftKey: true });
        fire('keydown', { code: 'KeyW', key: 'w' }); const gone = !inp.keys.has('ShiftLeft') && inp.keys.has('KeyW');     // (its key-up never came, and the next key says it is up)
        fire('keydown', { code: 'ShiftLeft', key: 'Shift', shiftKey: true }); fire('mousemove', {}); const mouse = !inp.keys.has('ShiftLeft');
        inp.endFrame(); fire('keydown', { code: 'KeyW', key: 'w', repeat: true }); const rep = !inp.pressed.has('KeyW');   // (a held key repeating is no press)
        fire('keydown', { code: 'KeyW', key: 'w' }); const fresh = inp.pressed.has('KeyW');                               // (down again with no repeat in it: its key-up was lost)
        keysOk = held && kept && gone && mouse && rep && fresh; keysWhy = `held ${held} · kept while down ${kept} · let go by the next key ${gone} · by the mouse ${mouse} · a repeat is no press ${rep} · a key down again is one ${fresh}`;
      } catch (e) { keysWhy = `threw: ${String(e).slice(0, 120)}`; } finally { for (const n of names) { if (had[n] === undefined) delete G[n]; else G[n] = had[n]; } }
      verdict(spread && off.length === 0 && on.includes('stack') && !!ask && !ask.watch && /stack/.test(ask.line) && wrongGiven && wrong?.line === ask.line && !wrong?.watch && !!plain && !plain.watch && !!aft?.watch && aft.line === "They're stacking up on the door" && !!again && !again.watch && again.line === ask.line && !!gate?.watch && /holding the gate/.test(gate.line) && keysOk,
        'the second play\'s notes hold: the roadblock\'s rounds land over many places and none by a man; Shift down with the command key on the door gives the stack order (and nothing with the rule off, as it was); the line then says what the men are doing, and asks again when nothing has come of it; the gate\'s line is one to watch; the page lets go of a Shift the system says is up',
        `the fire: ${marks.length} marks in 14 s over ${bins.size} metres, the busiest ${(100 * top / Math.max(1, marks.length)).toFixed(0)}% of them, the nearest to a man ${near.toFixed(1)} m · an order to the road on the door's step: the line "${wrong?.line}"${wrong?.watch ? ' (to watch)' : ''} · a keyless ask is ${plain?.watch ? 'a line to watch' : 'an ask'} · Shift + the key: rule off [${off.join(' ')}], on [${on.join(' ')}] · the line: "${ask?.line}" → "${aft?.line}"${aft?.watch ? ' (to watch)' : ''} → "${again?.line}" · the gate: "${gate?.line}"${gate?.watch ? ' (to watch)' : ''} · the keys: ${keysWhy}`); }
    // ---- the third play's notes (tut-sky): the sky seat is drawn as plan mode is; the last step's men run back to the trucks
    { const R = await rig(true), g = R.g, L = g.level.scenarios.lesson, men = R.squad();
      const { planView } = await import(`${ROOT}/src/game/planmode.ts`), { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`), { TEAMPACE } = await import(`${ROOT}/src/game/teampace.ts`);
      R.run(0.5);
      // (plan mode is a switch of its own, held off on the frozen stand: raised here for the question, the mode itself never put up)
      const c0 = { on: CMDRING.on, plan: CMDRING.plan }, sp0 = RAILS.skyPlan; let pic: any = null, off: any = 'unread';
      try { CMDRING.on = CMDRING.plan = true; pic = planView(g.orders); RAILS.skyPlan = false; off = planView(g.orders); } finally { CMDRING.on = c0.on; CMDRING.plan = c0.plan; RAILS.skyPlan = sp0; }
      const toned = pic ? pic.men.filter((m: any) => !!m.tone).length : 0;
      verdict(g.rails.skyOn && !g.orders.plan.up && !!pic && pic.frame === true && pic.up === false && pic.men.length === men.length && men.length === 4 && toned === 4 && !pic.sam && !pic.drag && pic.chains.length === 0 && off === null,
        'the sky seat is drawn as plan mode is, with the mode down: its frame is up, each of the four men has his ring in his pair\'s colour, there is no mark for the parked player and no pick box; with RAILS.skyPlan off there is no such picture',
        `the mode ${g.orders.plan.up ? 'UP' : 'down'} · the picture ${pic ? `frame ${pic.frame}, says the mode is ${pic.up ? 'up' : 'down'} · ${pic.men.length} rings, ${toned} in a pair's colour · player's mark ${pic.sam ? 'drawn' : 'none'}` : 'none'} · switch off: ${off === null ? 'none' : 'still drawn'}`);
      // the way out: nobody runs before the order, every man sent to the trucks runs once it is given, none with the switch off, none at another step
      const ko = L.steps.findIndex((T: any) => T.id === 'out'), To = L.steps[ko], count = () => men.filter((m: any) => g.rails.runs(m)).length;
      g.lesson.i = L.steps.findIndex((T: any) => T.id === 'move'); R.run(0.3); R.command(YARD); R.run(5);   // (off the trucks first: a man holding beside the mark is under an order to it already)
      g.lesson.i = ko; R.run(0.3); const before = count();
      R.command(To.at as number[]); R.run(0.4); const told = count(); let top = 0; for (let i = 0; i < 150; i++) { R.run(1 / 60); for (const m of men) top = Math.max(top, m.speed); }
      // (each asked on the tick after it is set: the frame says once a tick whether the step's order is out)
      const wr = RAILS.wayRun; let offRun = -1; try { RAILS.wayRun = false; R.run(2 / 60); offRun = count(); } finally { RAILS.wayRun = wr; } R.run(2 / 60);
      const r0 = To.onWay.run; let unasked = -1; try { To.onWay.run = false; R.run(2 / 60); unasked = count(); } finally { To.onWay.run = r0; } R.run(2 / 60);
      const again = count(), paced = !!TEAMPACE.on;   // (the team's own pace is a newer rule: where the stand holds it off the legs keep their old cap, and only the frame's answer is asked)
      // a man with somebody in his sights does not run (teampace.ts teamTold, as a run to cover): asked of the rule with the fight's answer forced
      const { teamTold } = await import(`${ROOT}/src/game/teampace.ts`), own = Object.prototype.hasOwnProperty.call(g.fight, 'engaged'), e0 = g.fight.engaged; let free = -1, fought = -1;
      try { free = men.filter((m: any) => teamTold(g, m) !== null).length; g.fight.engaged = () => true; fought = men.filter((m: any) => teamTold(g, m) !== null).length; } finally { if (own) g.fight.engaged = e0; else delete g.fight.engaged; }
      // (a man the roadblock has in a fight on this floor is not given the run: at least one is)
      verdict(To?.onWay?.run === true && before === 0 && told === men.length && again === men.length && (!paced || (top >= TEAMPACE.runAt && free >= 1 && fought === 0)) && offRun === 0 && unasked === 0,
        'the job done, the squad runs back: on the last step nobody runs before the order, every man of the squad is told to run once it is given and (where the team\'s pace is the rule\'s) is at a run inside two and a half seconds, and none of them while he has a man in his sights; nobody with RAILS.wayRun off, nobody when the step does not ask',
        `told to run: ${before} before the order · ${told} of ${men.length} after · top ${top.toFixed(1)} m/s${paced ? ` (a run is ${TEAMPACE.runAt}) · the rule gives a run to ${free}, to ${fought} with a man in his sights` : ' (the pace rule is off here)'} · switch off ${offRun} · the step not asking ${unasked}`);
    }

    // ---- the gate's beat is short (tut-sky): once the squad sets in the yard the roadblock's men come DOWN THE ROAD for the gate (the script's `direct`
    //      walk, through the gap in their own sandbags) and the fight is over in seconds. Left to the covered-lane price they go round the whole halt, which
    //      is what the maintainer sat through ("this beat is too long, unclear what to do"). On the floor the mission has now the road is the one way from the
    //      roadblock to the gate, so the walk with the word taken off is the same road and is only told; the run that must be long is the third, where the
    //      script's men are kept at their sandbags: the line is gone because they came, not because the step lets go of it
    { const beat = async (how: 'direct' | 'plain' | 'kept') => { const plain = how === 'plain'; const R = await rig(true), g = R.g, L = g.level.scenarios.lesson, km = L.steps.findIndex((T: any) => T.id === 'move'), kg = L.steps.findIndex((T: any) => T.id === 'gate');
        R.run(6); g.lesson.i = km; R.run(0.5); R.command(L.steps[km].at as V);
        const seen = new Set<unknown>(), home = new Map<unknown, number[]>(); let t0 = -1, t1 = -1, priced = 0, unpriced = 0;
        for (let i = 0; i < 60 * 60 && t1 < 0; i++) {
          if (plain) for (const gd of g.guards as any[]) if (/^Tango (8|9|10)$/.test(gd.callsign ?? '') && gd.script?.direct) { gd.script.direct = false; if (!seen.has(gd)) { seen.add(gd); gd.path = []; gd.pathGoal = null; } }
          // (THE WORD'S OWN GUARD, away from this floor's roads: what lanes.ts prices a walk at for a man the script sent, with the word and without it —
          //  with it never a price; without it, on a stand with covered lanes, the lanes' price while his side knows one)
          if (plain) for (const gd of seen as Set<any>) { if (!gd.script || gd.state === 'dead') continue; gd.script.direct = true; const a = lanePenalty(g, gd, undefined); gd.script.direct = false; const b = lanePenalty(g, gd, undefined); if (a !== undefined) unpriced = -1e9; else if (typeof b === 'function') priced++; else unpriced++; }
          if (how === 'kept') for (const gd of g.guards as any[]) if (/^Tango (8|9|10)$/.test(gd.callsign ?? '')) { const at = home.get(gd) ?? [gd.char.pos[0], gd.char.pos[2]]; home.set(gd, at); gd.char.pos[0] = at[0]; gd.char.pos[2] = at[1]; }   // (alive, armed, and where they stood)
          R.run(1 / 60); if (t0 < 0 && g.lesson.i === kg) t0 = g.time; if (t0 >= 0 && g.lesson.i > kg) t1 = g.time; }
        return { secs: t0 < 0 ? -1 : t1 < 0 ? 99 : t1 - t0, up: R.squad().length, nav: g.col.nav, sent: seen.size, priced, unpriced }; };
      const { LANES, lanePenalty } = await import(`${ROOT}/src/game/lanes.ts`);   // (covered lanes are a newer rule: where the stand holds them off there is no price to take the word off)
      const A = await beat('direct'), B = await beat('plain'), C = await beat('kept');
      const way = A.nav.findPath([30, 0, 23.6], [14.6, 0, 19.2], 6000) as number[][] | null; let m = 0; if (way) { let q = [30, 0, 23.6]; for (const w of way) { m += flat(q, w); q = w; } }
      verdict(A.secs >= 0 && A.secs <= 8 && A.up === 4 && B.secs >= 0 && B.secs <= 8 && C.secs > 12 && !!way && m < 20 && B.sent > 0 && B.unpriced >= 0 && (B.priced > 0 || !LANES.on),
        'the gate\'s beat is short: the squad set in the yard, the roadblock comes down the road and the line that only watches is gone within eight seconds, all four on their feet (as short with the script\'s direct walk taken off its men: the road is the one way there; and long with them kept at their sandbags); and the script\'s word still reaches its men and takes the covered lanes\' price off their walk',
        `the gate's line stood ${A.secs.toFixed(1)} s, ${A.up} of the squad up · with the direct walk off ${B.secs.toFixed(1)} s${LANES.on ? '' : ' (covered lanes are off on this stand)'} · with its men kept at their sandbags ${C.secs.toFixed(1)} s · the word: on ${B.sent} of the script's men, their walk priced by the lanes without it on ${B.priced} man-frames, not priced on ${B.unpriced}${B.unpriced < 0 ? ' (PRICED WITH THE WORD)' : ''} · the road from the roadblock to the gate ${way ? m.toFixed(1) + ' m' : 'has no path'}`); }
    // ---- the big line stays clear of your own men (ui/railclear.ts, rails.ts lineMen; the pair mission's pictures: with the view led up the screen the
    //      plate lay over the player and his partner). The rule is pure — boxes in, a step down out — so it is read here on made-up boxes of a 1280 by 720
    //      layer (a man's box by his feet); the frame's list of men is read on the mission, with the player on the floor and in the sky seat. And a deed
    //      can name the man an order was given on (`order:<id>@foe:<callsign>`): the check knows the floor's men, and the step counts that order only
    { const { railClear, RAILCLEAR } = await import(`${ROOT}/src/ui/railclear.ts`);
      const rest = { l: 400, r: 880, t: 513, b: 608 }, H = 720, low = H - RAILCLEAR.gap - rest.b, man = (x: number, y: number) => ({ l: x - 26, r: x + 26, t: y - 78, b: y + 8 });
      const none = railClear(rest, [], H, false), far = railClear(rest, [man(200, 560), man(640, 300)], H, false), under = railClear(rest, [man(700, 560)], H, false);
      let was = under, drift = 0; for (let k = 0; k < 240; k++) { const s = railClear(rest, [man(700 + 30 * Math.sin(k / 9), 550 + 20 * Math.sin(k / 5))], H, was > 0); if (s !== was) drift++; was = s; }   // (an aim that wanders: the man drifts under where it lay)
      const near = railClear(rest, [man(700, 480)], H, true), gone = railClear(rest, [man(700, 440)], H, true);   // (just above where it lies: it stays at the edge; well clear: home)
      const both = railClear(rest, [man(700, 560), man(700, 700)], H, false), short = railClear(rest, [man(700, 560)], rest.b + RAILCLEAR.gap, false);   // (a second man at the bottom edge, and a layer with no room under it: it lies where it lies)
      const walk = (from: number, to: number) => { let at = 0, n = 0, top = 9e9; for (let y = from; from < to ? y <= to : y >= to; y += from < to ? 3 : -3) { const s = railClear(rest, [man(700, y)], H, at > 0); if (s !== at) n++; at = s; top = Math.min(top, rest.t + s); } return { n, top }; };
      const dn = walk(300, 800), up = walk(800, 300);   // (a man walks down the whole picture through both places, and back up: two moves each way, and never up into the picture)
      const R = await rig(true), g = R.g; R.run(0.5); const squad = R.squad().length, men = g.rails.lineMen(), RD = g.lesson.data.rails, sky = RD.sky;
      RD.sky = undefined; const floor = g.rails.lineMen(); RD.sky = sky; const lc = RAILS.lineClear; RAILS.lineClear = false; const off = g.rails.lineMen().length; RAILS.lineClear = lc;
      const foes = g.guards.filter((x: any) => x.team !== 'operative' && x.state !== 'dead'), cs = foes[0]?.callsign as string, other = foes[1]?.callsign as string;
      const T = g.lesson.step, done0 = T.done, what = (w: string) => { T.done = { is: 'did', what: w }; const f = checkLesson(g).filter((x: string) => /what:|on:/.test(x)); T.done = done0; return f.length; };
      const named = what(`order:cover@foe:${cs}`), thing = what('order:work@thing:breaker'), plainDeed = what('order:stack'), noMan = what('order:cover@foe:Nobody 99'), door = what('order:stack@door:north door'), bad = what('order:stack@nowhere'), trail = what(`order:cover@foe:${cs} `);
      // (the step's own count: an order on ANOTHER man does not pass a deed that names one; the order on him does)
      const i0 = g.lesson.index; T.done = { is: 'did', what: `order:cover@foe:${cs}` }; g.orders.log.push({ t: g.time, order: 'cover', who: [], target: `foe:${other}` }); R.run(0.2); const i1 = g.lesson.index;
      g.orders.log.push({ t: g.time, order: 'cover', who: [], target: `foe:${cs}` }); R.run(0.2); const i2 = g.lesson.index; T.done = done0;
      verdict(none === 0 && far === 0 && under === low && low > 0 && drift === 0 && near === low && gone === 0 && both === 0 && short === 0 && dn.n === 2 && up.n === 2 && dn.top === rest.t && up.top === rest.t
        && squad > 0 && men.length === squad && floor.length === squad + 1 && floor[floor.length - 1] === g.player.char && off === 0
        && !!cs && !!other && named === 0 && thing === 0 && plainDeed === 0 && noMan > 0 && door > 0 && bad > 0 && trail > 0 && i1 === i0 && i2 === i0 + 1,
        'the big line stays clear of your own men: it lies where it lies with nobody under it, goes to the bottom edge from over a man, does not move again while he drifts, comes home only when he is well clear, lies where it lies with both places taken, and moves twice and never up while a man walks the whole picture; the frame lists the squad for it, and the player on the floor (nobody with the knob off); and a deed can name the man an order was given on, and only that order counts',
        `nobody ${none} · men elsewhere ${far} · a man under it ${under} px (the edge is ${low}) · moves in 240 frames of drift ${drift} · just above it ${near}, well clear ${gone} · both places taken ${both} · no room under it ${short} · a walk down ${dn.n} moves, up ${up.n}, highest top ${Math.min(dn.top, up.top)} (it lies at ${rest.t}) · the frame's men ${men.length} of a squad of ${squad}, on the floor ${floor.length}, knob off ${off} · faults: named man ${named}, thing ${thing}, plain ${plainDeed}, no such man ${noMan}, a door after @ ${door}, no kind ${bad}, a space at the end ${trail} · the step: ${i0 + 1}, after an order on ${other} ${i1 + 1}, after the order on ${cs} ${i2 + 1}`); }
    // ---- a step's own eye has a place among the fog's (fogofwar.ts update, RAILS.eyeFirst): the fog takes five, and with four men up and the seat's
    //      lookout in, the step's eye was the one dropped — the squad's own wall charge went off in the fog, twice, in the maintainer's play. The mission's
    //      own fog word is the level's to choose, so this rig puts the fog on itself
    { const R = await rig(true), g = R.g, L = g.level.scenarios.lesson; L.rails.fog = true; for (const T of L.steps) delete T.fog; R.run(0.5);
      const lk = g.rails.eye(), lookIn = !!lk && !g.rails.stepEye() && g.fogOfWar.eyes.includes(lk), lookAt = L.rails.sky.eye.at as number[], lookSees = g.fogOfWar.spotSeen(lookAt[0], lookAt[2]);   // (a step with no eye of its own: the seat's lookout is one of the fog's)
      const k = L.steps.findIndex((T: any) => T.id === 'charge'), T = L.steps[k]; g.lesson.i = k; R.run(0.4);
      const s = g.rails.stepEye(), at = (T.eye?.at ?? T.at) as number[], look = !!g.rails.eye(), men = R.squad().length, on = g.fogOfWar.on;
      const eyes1 = g.fogOfWar.eyes.length, in1 = !!s && g.fogOfWar.eyes.includes(s), seen1 = g.fogOfWar.spotSeen(at[0], at[2]);
      let in0 = false, seen0 = false; RAILS.eyeFirst = false; try { R.run(0.4); in0 = !!s && g.fogOfWar.eyes.includes(s); seen0 = g.fogOfWar.spotSeen(at[0], at[2]); } finally { RAILS.eyeFirst = true; }
      verdict(on && men === 4 && look && lookIn && lookSees && !!s && eyes1 === 5 && in1 && !in0 && seen1 && !seen0,
        'a step\'s own eye has a place among the fog\'s five: on a step with none the seat\'s lookout is one of them and its own ground is seen; with four men up, on the wall\'s step, the step\'s eye is one of them and where it looks is seen (and it is the one dropped, and the place in the fog, with the rule off, as it was)',
        `fog ${on ? 'on' : 'OFF'} · ${men} men up, the lookout ${look ? 'named' : 'absent'}, on the first step among the fog's eyes ${lookIn}, its ground ${lookSees ? 'seen' : 'not seen'} · the step's eye ${s ? 'named' : 'none'} · the fog's eyes ${eyes1}, the step's among them ${in1} (rule off: ${in0}) · where it looks ${seen1 ? 'seen' : 'not seen'} (rule off: ${seen0 ? 'seen' : 'not seen'})`); }
    // ---- the frame's eyes are the player's VIEW, not the squad's KNOWLEDGE (fogofwar.ts update, RAILS.eyeView): a step's lookout in a hall the squad then
    //      entered put the hall's gunner in the fog's seen(), which the squad's own entry pick reads (autopilot.ts contactBehind) — the stack at the front door
    //      threw its last can at a man nobody of the team had seen and went in three seconds behind the pair at the back. Here: a man of the other side stood
    //      in the step's eye, in a room behind a door, with one can left
    { const { autoEntries } = await import(`${ROOT}/src/game/autopilot.ts`);
      const R = await rig(true), g = R.g, L = g.level.scenarios.lesson, F = g.fogOfWar; L.rails.fog = true; for (const T of L.steps) delete T.fog; R.run(0.5);
      g.lesson.i = L.steps.findIndex((T: any) => T.id === 'charge'); R.run(0.4);
      const s = g.rails.stepEye(), foe = g.guards.find((h: any) => h.team !== 'operative' && h.state !== 'dead' && !h.script && !h.civ);
      // (the first place down the eye's own line that is a room's floor with nothing between)
      const at = (m: number): [number, number, number] => [s.pos[0] + s.look[0] * m, 0, s.pos[2] + s.look[2] * m];
      const m = s ? [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5].find(d => g.cleared.roomAt(at(d)) > 0 && !g.col.nav.isBlocked(at(d)[0], at(d)[2]) && !g.col.segmentBlocked(s.pos, [at(d)[0], 1.1, at(d)[2]])) : undefined;
      const stand = (n: number) => { for (let i = 0; i < n; i++) { if (m && foe) { foe.char.pos[0] = at(m)[0]; foe.char.pos[2] = at(m)[2]; } R.run(1 / 60); } };
      stand(8); g.doorTools.bangs = 1;
      const room = foe ? g.cleared.roomAt(foe.char.pos) : 0, sides = [1, -1] as const;
      const way = g.doors.list.flatMap((d: any) => sides.map(side => ({ d, side }))).find((w: any) => g.cleared.roomBy(w.d, w.side > 0 ? -1 : 1) === room && g.cleared.isKnown(g.cleared.roomBy(w.d, w.side)));
      const read = () => ({ seen: !!foe && F.seen(foe), drawn: !!foe && F.drawn(foe), hidden: !foe || F.hidden(foe), known: !!foe && !!F.sighting(foe), lit: !!foe && F.spotSeen(foe.char.pos[0], foe.char.pos[2]),
        pick: way ? autoEntries(g, { kind: 'door', at: way.d.frameCentre, door: way.d, side: way.side }) : { ids: [] as string[], why: 'no door' } });
      const on = read(); let off = on; RAILS.eyeView = false; try { stand(8); off = read(); } finally { RAILS.eyeView = true; }   // (put back whatever the stand throws: every line after this one is read with the rule on)
      const word = (r: ReturnType<typeof read>) => `seen ${r.seen}, a sighting ${r.known}, drawn ${r.drawn}, hidden ${r.hidden}, his floor lit ${r.lit}, the entry ${r.pick.ids.join(' then ') || 'none'} (${r.pick.why})`;
      verdict(!!s && !!foe && !!m && !!way && room > 0 && on.lit && on.drawn && !on.hidden && !on.seen && !on.known && on.pick.why !== 'contact' && on.pick.ids[0] === 'openClear' && off.seen && off.pick.why === 'contact' && off.pick.ids[0] === 'bangClear',
        'the frame\'s eyes are the player\'s view, not the squad\'s knowledge: a man of the other side in a step\'s eye stands on lit floor and is in the picture, the team has not seen him and has no sighting of him, and the squad\'s entry on his room\'s door with one can left is the one it would take with no eye there (with the rule off he is seen, and the stack throws its last can: as it was)',
        `the step's eye ${s ? 'named' : 'none'} · a man stood in it ${foe && m ? `${m} m down its line, in room ${room}` : 'none'} · a door into his room from a known one ${way ? 'found' : 'none'} · ${word(on)} · rule off: ${word(off)}`); }
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
      const door = ids([9.0, 1.0, 11.7]), yard = ids([11.4, 0.02, 16.4]), wall = ids([21.95, 1.1, 9.6]);
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
      const BEAT = Math.ceil((RAILS.cardBeatSecs + 0.2) * 60);
      const run = (n: number) => { for (let i = 0; i < n; i++) W.step(DT); }, tap = (k: string) => { I.pressed.add(k); I.keys.add(k); W.step(DT); I.keys.delete(k); W.step(DT); };
      // (the two places stood on are the steps' own marks, read from the level: its marks have moved once already)
      const floorOf = (id: string): number[] => { const m = L.steps.find((s: any) => s.id === id)?.at ?? [0, 0, 0]; return [m[0], 0, m[2]]; }, DARK = floorOf('dark'), WHISTLE = floorOf('whistle');
      g.restartEncounter(); run(30); HANDRING.on = true; tap('KeyC'); run(20); for (const p of [DARK, WHISTLE]) { g.teleportPlayer(p); run(90); }
      const at = L.steps[g.lesson.i]?.id, digit = `Digit${CMDRING.wedges}`;
      const on = verbs([27.9, 0, 17.2], DOOR); if (R) R.rows = undefined; const all0 = verbs(null, DOOR); if (R) R.rows = named;   // (Space is open from the whistle's step on)
      const extra = all0.filter(v => !named.includes(v)), pick = g.rails.offers('pick'), boot = g.rails.offers(extra[0] ?? 'pick'); g.teleportPlayer(WHISTLE); run(20);
      tap(digit); run(10); const early = L.steps[g.lesson.i]?.id;   // (no ring up: the digit is a slot's, and locked)
      I.pressed.add('Space'); I.keys.add('Space'); run(Math.ceil((HANDRING.holdSecs + 0.1) * 60)); I.keys.delete('Space'); const up = !!g.player.sel.ring; run(2); tap(digit); run(10 + BEAT);
      const after = L.steps[g.lesson.i]?.id;   // (the step after the whistle opens on a card: the whistle's settles for the card's beat first — RAILS.cardBeat)
      // …and a digit pressed INSIDE the hold, before the ring is up (handring.ts `early`: what a hand does with "Hold E, then 5"), is the wedge too: the gate
      // lets it through to the ring and it is no slot's
      const early0 = HANDRING.early; HANDRING.early = true; g.restartEncounter(); run(30); tap('KeyC'); run(20); for (const p of [DARK, WHISTLE]) { g.teleportPlayer(p); run(90); }
      const at2 = L.steps[g.lesson.i]?.id, slot0 = `${g.player.slot}${g.player.holstered ? ' away' : ''}`;
      I.pressed.add('Space'); I.keys.add('Space'); run(4); const notYet = !g.player.sel.ring; I.pressed.add(digit); I.keys.add(digit); W.step(DT); I.keys.delete(digit); run(2); I.keys.delete('Space'); run(10 + BEAT);
      const quick = L.steps[g.lesson.i]?.id, slot1 = `${g.player.slot}${g.player.holstered ? ' away' : ''}`; HANDRING.on = ring0; HANDRING.early = early0;
      verdict(at2 === 'whistle' && notYet && quick === 'grab' && slot1 === slot0 && named.length > 0 && on.includes('pick') && on.every(v => named.includes(v)) && extra.length > 0 && pick && !boot && shut.length === 0 && shut0.length > 0 && at === 'whistle' && early === 'whistle' && up && after === 'grab',
        'Space offers only the rows the mission names: at a locked door the pick is there and the boot is not; without the list the door has every row it has anywhere; and while Space itself is locked a thing in reach has no row at all. His own ring is worked with its own digit: the key kept down, then the last wedge, whistles; and the digit pressed inside the hold, before the ring is up, whistles too and draws nothing',
        `the list: ${named.join(' ')} · on the first step at the gate: ${shut.join(' ') || 'no row'} (without the list: ${shut0.join(' ') || 'no row'}) · at the back door with it: ${on.join(' ') || 'no row'} · without it: ${all0.join(' ') || 'no row'} · the ring: on step '${at}', the digit alone leaves '${early}', the key held puts the ring ${up ? 'up' : 'NOT up'}, then the digit: '${after}' · the digit 0.07 s into the hold (ring ${notYet ? 'not yet up' : 'UP'}): '${at2}' → '${quick}', in his hand ${slot0} → ${slot1}`); }
    // ---- THE PLAN ON THE MOVE (RAILS.planWalk; levels/tut-plan.json, its first step given his feet as well as the mode — the mission gives them at 'up1',
    //      and from there every plan is made at the end of a walk; seed 1): Shift with the command key puts the mode up with a walk key still down and
    //      he stops there; the pair again takes it down and no tick of it is a run; the key kept down with no press holds nobody's feet. Rule off: the
    //      pair does nothing while he walks. The word `?planwalk=0` and a recording from before the key. RAILS_BREAK=1: the gate is open, Shift with a
    //      walk key is a sprint and the pair an order
    { const { CMDRING } = await import(`${ROOT}/src/game/cmdring.ts`), { knobsCopy, knobsBack } = await import(`${ROOT}/src/game/knobs.ts`), { planLoaded } = await import(`${ROOT}/src/game/planmode.ts`), J = await import(`${ROOT}/src/game/journal.ts`), PR = await import(`${ROOT}/src/host/profile.ts`);
      const k0 = knobsCopy(); let on: any, off: any, walk0: any, cut1: any, still: any, still0: any, first: any, authored = false, word = '', old = true, kept = false;
      const walked = async (rule: boolean, feet = true, down = rule) => { const log = console.log, warn = console.warn, err = console.error; if (!VERBOSE) console.log = console.warn = console.error = () => { };
        let W: any; try { const level = loadLevel(parseLevelData(readFileSync(`${ROOT}/levels/tut-plan.json`, 'utf8'))), L = level.scenarios!.lesson! as any;
          // (the level as authored: the mode and his feet are given, his sprint never — the ground this rule stands on)
          const given = [...(L.rails?.allow ?? []), ...L.steps.flatMap((T: any) => T.allow ?? [])]; authored = given.includes('plan') && given.includes('move') && !given.includes('sprint');
          if (feet) for (const T of L.steps) if (T.allow?.includes('plan')) T.allow = [...T.allow, 'move'];
          W = await standUp({ uploadEvery: 4, level, seed: 1 }); RAILS.on = true; RAILS.planWalk = rule; RAILS.planDown = down;
          Object.assign(CMDRING, { on: true, tapNow: true, stay: true, plan: true, planRts: true, planRun: true, planLook: true, planWaits: true, planKnee: true, planNear: true }); startFromQuery(W.game, '?levelFile=tut-plan.json&roomclear=1&squad4'); }
        finally { console.log = log; console.warn = warn; console.error = err; }
        const g = W.game, I = W.input, pl = g.player, P = g.orders.plan; let ran = false;
        const run = (secs: number, keys: string[]) => { const p = [...pl.char.pos]; for (let i = 0; i < Math.round(secs * 60); i++) { for (const k of keys) I.keys.add(k); W.step(DT); ran ||= !!pl.sprinting; } for (const k of keys) I.keys.delete(k); return flat(pl.char.pos, p); };
        const pair = (keys: string[]) => { for (const k of keys) I.keys.add(k); I.pressed.add('KeyB'); I.keys.add('KeyB'); W.step(DT); ran ||= !!pl.sprinting; I.keys.delete('KeyB'); for (const k of keys) I.keys.delete(k); };
        const HELD = ['KeyS', 'ShiftLeft'];
        // (the step as the level has it — the mode his, his feet and his sprint locked: the tick the mode comes DOWN, by the pair and by the back key, with a walk key held)
        if (!feet) { const back = () => { I.keys.add('KeyS'); I.pressed.add('Escape'); I.pressed.add('Tab'); W.step(DT); ran ||= !!pl.sprinting; I.keys.delete('KeyS'); };
          const O = g.orders, read = O.readInput.bind(O), tools = g.doorTools, mk = tools.menuKey.bind(tools), from = () => { pair(['ShiftLeft']); run(0.3, ['KeyS']); return [!!P.up, [...pl.char.pos]] as [boolean, number[]]; };
          run(0.5, []); pair(['ShiftLeft']); run(0.3, HELD); const up1 = !!P.up, a = [...pl.char.pos]; pair(HELD); run(0.3, []); const down1 = !P.up, byPair = flat(pl.char.pos, a);
          const [up2, b] = from(); back(); run(0.3, []); const down2 = !P.up, byBack = flat(pl.char.pos, b);   // (no Shift: his feet alone)
          // …and a road nobody's key is on: the mode put down as a loaded save puts it (planmode.ts planLoaded), at the head of the orders' own read of the tick, a walk key, Shift and the trigger held
          const [up3, c] = from(); let shot = 0; O.readInput = (...x: any[]) => { O.readInput = read; planLoaded(O); return read(...x); }; tools.menuKey = (inp: any) => { shot = (inp.buttons | inp.clicked) & 1; tools.menuKey = mk; return mk(inp); };   // (the first reader after the orders: what of the button is left in the tick)
          for (const k of HELD) I.keys.add(k); I.buttons |= 1; I.clicked |= 1; W.step(DT); ran ||= !!pl.sprinting; I.buttons &= ~1; I.clicked &= ~1; for (const k of HELD) I.keys.delete(k);
          run(0.3, []); const down3 = !P.up, byOther = flat(pl.char.pos, c);
          return { ok: up1 && down1 && up2 && down2 && up3 && down3 && g.rails.locks('move') && g.rails.locks('sprint') && g.rails.locks('fire'), byPair, byBack, byOther, shot, ran } as any; }
        // (each walk from where he starts, at pace: there is a wall two metres behind him)
        run(0.5, []); const home = [...pl.char.pos], from = () => { g.teleportPlayer(home); run(0.4, ['KeyS']); };
        from(); const walk = run(0.5, ['KeyS']); from(); const shifted = run(0.5, HELD);
        // (the key down a tick before Shift, then both kept down: no press with Shift in it, so nothing toggles and his feet are his)
        from(); pair(['KeyS']); const sloppy = run(0.5, [...HELD, 'KeyB']), sloppyUp = !!P.up;
        from(); const d0 = RAILS_STATS.dropped; pair(HELD); const held = run(0.3, HELD), up = !!P.up, knee = !!pl.crouch, step = g.lesson.step?.id as string, dropped = RAILS_STATS.dropped - d0;
        g.teleportPlayer(home); pair(HELD); run(0.3, HELD); const again = !!P.up;   // (rule on: the mode was up and comes down — rule off: it was never up, and the pair is dropped again)
        // …and the back key takes it down the same way, Shift and the walk key still held (whichever key the stand's back key is)
        run(0.3, []); pair(['ShiftLeft']); run(0.3, HELD); const reup = !!P.up; for (const k of HELD) I.keys.add(k); I.pressed.add('Escape'); I.pressed.add('Tab'); W.step(DT); ran ||= !!pl.sprinting; run(0.3, HELD); const backed = !P.up;
        return { walk, shifted, sloppy, sloppyUp, ran, up, knee, step, held, dropped, again, reup, backed, locked: g.rails.locks('sprint') && !g.rails.locks('move'), g }; };
      try { on = await walked(true); off = await walked(false); walk0 = await walked(false, true, true); cut1 = await walked(true, true, false); still = await walked(true, false); still0 = await walked(false, false); first = await walked(true, false, false);
        const snap = () => JSON.parse(JSON.stringify(J.knobsSnapshot(on.g)));
        RAILS.planWalk = RAILS.planDown = true; const was = snap(); delete was.tables.RAILS.planWalk; delete was.tables.RAILS.planDown; J.applyKnobs(on.g, was); old = RAILS.planWalk || RAILS.planDown;
        RAILS.planWalk = RAILS.planDown = true; const now = snap(); RAILS.planWalk = RAILS.planDown = false; J.applyKnobs(on.g, now); kept = RAILS.planWalk && RAILS.planDown;
        const read = (q: string) => { RAILS.planWalk = !RAILS.planWalk; RAILS.planDown = !RAILS.planDown; PR.pageSwitches(new URLSearchParams(q)); return `${RAILS.planWalk}${RAILS.planDown}`; }; word = `${read('')}/${read('planwalk=0')}/${read('plandown=0')}`;
      } finally { knobsBack(k0); }
      const said = (r: any) => `walked ${r.walk.toFixed(2)} m in half a second, ${r.shifted.toFixed(2)} m with Shift down, ${r.sloppy.toFixed(2)} m with the key kept down as well (mode ${r.sloppyUp ? 'UP' : 'down'})${r.ran ? ' · A TICK AT A RUN' : ''} · the pair: mode ${r.up ? 'up' : 'down'}${r.knee ? ', on a knee' : ''}, step '${r.step}', ${r.held.toFixed(2)} m after it, presses dropped ${r.dropped} · the pair again: mode ${r.again ? 'up' : 'down'} · up once more ${r.reup}, the back key takes it down ${r.backed}`;
      verdict(authored && on.locked && on.walk > 0.5 && !on.ran && off.ran && on.sloppy > 0.5 && !on.sloppyUp && on.up && on.knee && on.held < 0.15 && on.step !== off.step && !on.again && on.reup && on.backed && !off.up && !off.again && off.dropped > 0 && off.held > 0.3 && old === false && kept === true && word === 'truetrue/falsetrue/truefalse' && !walk0.up && !walk0.ran && walk0.dropped > 0 && cut1.up && cut1.knee && cut1.held < 0.15 && !cut1.again && cut1.reup && cut1.backed && !cut1.ran && cut1.sloppy > 0.5 && !cut1.sloppyUp && still.ok && still0.ok && first.ok && !still.ran && !still.shot && still.byPair < 0.001 && still.byBack < 0.001 && still.byOther < 0.001 && still0.byPair > 0.004 && still0.byBack > 0.004 && still0.byOther > 0.004 && !!still0.shot && first.byBack > 0.004,
        'the plan on the move: with his feet and the mode his and his sprint locked, Shift with the command key puts the mode up while a walk key is down and he stops on his knee, the pair again or the back key takes it down, and no tick of any of it is a run; the key kept down with no press holds nobody\'s feet; with both rules off the pair does nothing until he stands still, and the tick the back key takes the mode down with Shift and a walk key held is a tick at a run, as it was. And on the step that locks his feet (RAILS.planDown), the tick the mode comes down moves him nowhere and fires nothing, by the pair, by the back key and by a road no key is on (rule off: a tick on his feet, and the button his); the first cut of the rule, a recording\'s, still leaks there as it did and still holds where his feet are his; RAILS.planWalk off alone, the pair is dropped while he walks and no tick is a run. The page\'s word puts the rule off and a recording from before it replays without it',
        `the level gives plan and move and never sprint: ${authored} · ${said(on)} · both rules off: ${said(off)} · planWalk off alone: ${said(walk0)} · planWalk alone, the first cut: ${said(cut1)} · feet locked, the mode taken down with a walk key held: he moved ${(still.byPair * 100).toFixed(2)} cm by the pair, ${(still.byBack * 100).toFixed(2)} cm by the back key, ${(still.byOther * 100).toFixed(2)} cm by another road${still.shot ? ', THE BUTTON HIS' : ''}${still.ran ? ', A TICK AT A RUN' : ''} (rule off: ${(still0.byPair * 100).toFixed(2)}, ${(still0.byBack * 100).toFixed(2)} and ${(still0.byOther * 100).toFixed(2)} cm, the button ${still0.shot ? 'his' : 'not his'}${still0.ran ? ', a tick at a run' : ''}; planWalk alone, as first cut: ${(first.byBack * 100).toFixed(2)} cm by the back key) · a recording from before the key: ${old ? 'ON' : 'off'}, one with it: ${kept ? 'on' : 'OFF'} · the page / ?planwalk=0 / ?plandown=0 (planWalk, planDown): ${word}`); }
  } finally { RAILS.on = keep.on; Math.random = keep.rnd; }
  console.log(`=== rails: ${all ? 'ALL PASS' : 'FAILURES above'} ===`);
  return all;
}

if (import.meta.main) process.exit((await railsCheck()) ? 0 : 1);
