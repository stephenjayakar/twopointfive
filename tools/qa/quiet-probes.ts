// The 'quiet' family (THE QUIET MISSION on any level — game/quiet.ts; data scene/scenarios.ts QuietData), run through probes.ts:
//   bun run tools/qa/probes.ts quiet | quiet-data | quiet-start | quiet-run | quiet-pair | quiet-checkpoint | quiet-own
// PASS / FAIL each, all headless on levels/quiet-yard.json (the mission's own test floor) and the bundled office. Nothing here looks at a picture or hears a sound.
//   quiet-data        the file validates; broken blocks are refused by name; the block against the built floor is clean and a start moved into a wall is caught;
//                     the office (no block) refuses a quiet start with the reason and stays the plain night
//   quiet-start       alone: Sam on the dealt start, the dealt patrol set on the list and the other routes' men off it, the level's devices and civilians live,
//                     the mission the dealt spot's with the level's own words; a pinned deal is the same every restart, pins and unpinned restarts vary it;
//                     stop puts the level, the roster and every switch back
//   quiet-run         the mission played to its end by each way out: the room reached, the thing taken, out past that exit's line → done, the exit named
//   quiet-pair        with one partner: an operative beside Sam, silent from the first frame, the pair rules on for the run, staff hostile to him — he follows
//                     Sam across the floor, a guard he stands in front of notices HIM; stop takes him and every switch back
//   quiet-checkpoint  a save carries the deal; a load puts the same start / spot / patrol set and every man back; the plain night refuses the file and the
//                     mission refuses a plain file; the autosave's own gate passes on a calm quiet run (the manned roster is the roster)
//   quiet-fixes       the review of the join (10-10): the hunt goes on after the partner drops, where a man stands at a holder, the card's checkpoint offer, the
//                     autosave's words, `quiet` beside `squad4`, the switches a partner run holds (two Games, a hand's word, this visit's word), the failure paths
//   quiet-own         the office-only places: on a level with the block the shift's errands, the civilians' phones and ways out, the response team, the weather
//                     and the room names are the level's own (or off); on the office they are the tables they always were
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp, ROOT } from './headless.ts';

const { parseLevelData, validateLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
const QM = await import(`${ROOT}/src/game/quiet.ts`);
const { startFromQuery, quitScenario, activeScenario, runningScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { objectiveText, rackDist } = await import(`${ROOT}/src/game/mission.ts`);
const { HOSTILE } = await import(`${ROOT}/src/game/teams.ts`);
const { PAIRUP } = await import(`${ROOT}/src/game/pairup.ts`);
const { PAIR } = await import(`${ROOT}/src/game/pairorders.ts`);
const { SNEAK } = await import(`${ROOT}/src/game/sneak.ts`);
const { SPOTTED } = await import(`${ROOT}/src/game/spotted.ts`);
const { SILENT, squadSilent } = await import(`${ROOT}/src/game/silent.ts`);
const SAVE = await import(`${ROOT}/src/game/savestate.ts`);
const NEEDS = await import(`${ROOT}/src/game/needs.ts`);
const CIVS = await import(`${ROOT}/src/game/civilians.ts`);
const QRF = await import(`${ROOT}/src/game/qrf.ts`);
const DIALOGUE = await import(`${ROOT}/src/game/dialogue.ts`);
const { specOfQuery } = await import(`${ROOT}/src/scene/scenarioList.ts`);
const { fogOfQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
const { sendRackCheck } = await import(`${ROOT}/src/game/mission.ts`);
const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);

type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
const guarded = (fn: () => Promise<boolean>) => async () => { try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; } };
const hushed = async <T>(fn: () => Promise<T> | T): Promise<T> => { const log = console.log, err = console.error, warn = console.warn; console.log = console.error = console.warn = () => { }; try { return await fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const DT = 1 / 60, FILE = 'quiet-yard.json';
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
const text = () => readFileSync(resolve(ROOT, 'levels', FILE), 'utf8');
/** the game stood up on the test yard (or the office: `file` null), seeded */
async function stand(seed: number, file: string | null = FILE) {
  Math.random = seeded(0x51ed + seed * 7919);
  const W: any = await hushed(() => standUp({ uploadEvery: 4, ...(file ? { level: loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8'))) } : {}) }));
  return W;
}
const start = (W: any, q: string) => hushed(() => startFromQuery(W.game, q));
const steps = (W: any, secs: number, until?: () => boolean) => { for (let i = 0; i < Math.round(secs * 60); i++) { W.step(DT); if (until?.()) return true; } return !!until?.(); };
const manned = (g: any): string[] => g.guards.filter((x: any) => !x.unit).map((x: any) => g.level.routes[x.routeI]?.name);
const dealKey = (g: any) => `${g.quiet.deal.start}/${g.quiet.deal.spot}/${g.quiet.deal.patrol}`;
const freeNear = (g: any, p: number[], r = 1.4): [number, number, number] | null => { let best: [number, number, number] | null = null, bd = Infinity;
  for (let dx = -r; dx <= r; dx += 0.2) for (let dz = -r; dz <= r; dz += 0.2) { const q: [number, number, number] = [p[0] + dx, 0, p[2] + dz]; if (g.col.nav.isBlocked(q[0], q[2])) continue; const d = Math.hypot(dx, dz); if (d < bd) { bd = d; best = q; } } return best; };

// ───────────────────────────────────────────────────────────── data ─────────────────────────────────────────────────────────────
export const quietData = guarded(async () => {
  const F = family('quiet-data: the block in the level file — the validator, the block against the built floor, a level without one');
  const raw = JSON.parse(text()), errs: string[] = validateLevelData(raw);
  F.verdict(errs.length === 0 && !!raw.scenarios?.quiet, `levels/${FILE} validates and carries the block`, errs.length ? errs.slice(0, 4).join(' · ') : `${raw.scenarios.quiet.starts.length} starts · ${raw.scenarios.quiet.spots.length} spots · ${raw.scenarios.quiet.exits.length} exits · ${raw.scenarios.quiet.patrols.length} patrol sets · thing '${raw.scenarios.quiet.thing}'`);
  { const broke = (label: string, edit: (q: any, d: any) => void) => { const d = JSON.parse(text()); edit(d.scenarios.quiet, d); const e: string[] = validateLevelData(d).filter((x: string) => /quiet|exfil/.test(x)); return { label, e }; };
    const cases = [
      broke('a patrol set names a route the level has not', q => { q.patrols[0] = ['yard', 'nobody']; }),
      broke('no start', q => { q.starts = []; }),
      broke('no way out', q => { q.exits = []; }),
      broke('a spot behind a door the level has not', q => { q.spots[0].door = 'no_such_door'; }),
      broke('a way out whose `out` is not a unit vector', q => { q.exits[0].out = [1, 1]; }),
      broke('a key nobody reads', q => { q.colour = 'blue'; }),
      broke('seven men in a patrol set', (q, d) => { for (let i = 0; i < 5; i++) d.routes.push({ ...d.routes[0], id: `extra${i}` }); q.patrols = [d.routes.map((r: any) => r.id)]; }),
      broke('a lap of the lobby with no loop', q => { q.needs.stretch = { name: 'the yard', pos: [12, 0, 16], face: 0 }; }),
    ];
    F.verdict(cases.every(c => c.e.length > 0), 'a broken block is refused by the file validator, each fault named', cases.map(c => `${c.label}: ${c.e[0] ?? 'NOT CAUGHT'}`).join('\n    ')); }
  { // a route the file NAMES (name ≠ id): the game knows it by its name, so that is what a patrol set says — and a run on it mans who the set says
    const d = JSON.parse(text()); d.routes[0].name = 'yard loop';
    const byId: string[] = validateLevelData(d).filter((x: string) => /quiet/.test(x));
    d.scenarios.quiet.patrols = d.scenarios.quiet.patrols.map((set: string[]) => set.map(n => n === d.routes[0].id ? 'yard loop' : n));
    const byName: string[] = validateLevelData(d).filter((x: string) => /quiet/.test(x));
    const W = await hushed(() => standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(JSON.stringify(d))) })) as any, g = W.game;
    let ok = true; const seenSets: string[] = [];
    for (let pin = 0; pin < 8; pin++) { const r = await hushed(() => startFromQuery(g, `?quiet=${pin}`)); const on = g.guards.filter((x: any) => !x.unit).map((x: any) => x.route.name).sort().join(','), want = [...g.quiet.patrol].sort().join(',');
      if (r.why || on !== want) ok = false; seenSets.push(on); await hushed(() => quitScenario(g)); }
    F.verdict(byId.length > 0 && byName.length === 0 && ok && seenSets.some(x => /yard loop/.test(x)), 'a route with a name of its own is named in a patrol set by that name (the validator refuses its bare id), and a run mans exactly the set',
      `by id: ${byId[0] ?? 'NOT REFUSED'} · by name: ${byName[0] ?? 'validates'} · on the floor over 8 pins: ${[...new Set(seenSets)].join(' | ')}`); }
  { const W = await stand(1), g = W.game, clean: string[] = QM.checkQuiet(g);
    const Q = g.level.scenarios.quiet, was = Q.starts[0].sam; let wall: number[] = [0, 0, 0]; for (let x = 8; x < 12 && !wall[0]; x += 0.1) if (g.col.nav.isBlocked(x, 9)) wall = [x, 0, 9]; Q.starts[0].sam = wall;   // (into the bunkhouse's west wall)
    const walled: string[] = QM.checkQuiet(g); Q.starts[0].sam = was;
    const wasF = Q.spots[0].front; Q.spots[0].front = [12.0, 1, 16.0]; const outside: string[] = QM.checkQuiet(g); Q.spots[0].front = wasF;
    F.verdict(clean.length === 0 && walled.some(s => /starts\[0\]/.test(s)) && outside.some(s => /spots\[0\]/.test(s)), 'the block against the built floor (checkQuiet): clean as authored; a start put in a wall and a holder put outside its room are each named',
      `as authored: ${clean.length ? clean.join(' · ') : 'no faults'}\n    a start in a wall: ${walled[0] ?? 'NOT CAUGHT'}\n    a holder outside its room: ${outside[0] ?? 'NOT CAUGHT'}`); }
  { const W = await stand(2, null), g = W.game, n = g.guards.length, why = g.quiet.canStart(0), r = await start(W, '?quiet');
    F.verdict(typeof why === 'string' && why.length > 8 && r.why === why && !g.quiet.active && activeScenario(g) === null && g.guards.length === n && n === g.level.routes.length, 'the office carries no block: ?quiet is refused with the reason and the floor stays the plain night',
      `refused: '${r.why}' · scenario ${activeScenario(g)} · ${g.guards.length} guards of ${g.level.routes.length} routes`); }
  return F.done();
});

// ───────────────────────────────────────────────────────────── start (alone) ─────────────────────────────────────────────────────────────
export const quietStart = guarded(async () => {
  const F = family('quiet-start: a quiet mission alone, off the level\'s own data — the deal, the roster, the words, the stop');
  const W = await stand(3), g = W.game, L = g.level, Q = L.scenarios.quiet;
  const authored = JSON.stringify({ spawn: L.playerSpawn, mission: L.mission }), flags0 = [PAIRUP.on, PAIR.on, SNEAK.on, SPOTTED.on, SILENT.on, SILENT.start, HOSTILE.guard.operative];
  const r = await start(W, '?quiet=7'), d = g.quiet.deal, S = Q.starts[d.start], P = Q.spots[d.spot], set: string[] = Q.patrols[d.patrol], on = manned(g);
  F.verdict(!r.why && g.quiet.active && activeScenario(g) === 'quiet' && runningScenario(g, FILE)?.entry?.id === 'quiet-yard-alone', '?quiet=7 starts unrefused as the list\'s own row', `${r.why ?? 'started'} · ${g.quiet.summary()} · row ${runningScenario(g, FILE)?.entry?.id}`);
  F.verdict(flat(g.player.char.pos, S.sam) < 0.05 && Math.abs(g.player.char.bodyYaw - S.samYaw) < 1e-6 && !g.guards.some((x: any) => x.unit) && g.quiet.ops.length === 0, 'Sam stands on the dealt start facing its way, alone', `start ${d.start} '${S.name}' ${at(S.sam)} · Sam ${at(g.player.char.pos)} yaw ${g.player.char.bodyYaw.toFixed(2)}`);
  F.verdict(on.length === set.length && set.every(n => on.includes(n)) && g.guards.every((x: any) => x.state === 'patrol' && !x.hold && !x.pinned), 'the dealt patrol set is on the floor as on a plain night (patrolling, nobody posted or held) and the other routes\' men are off the list',
    `set ${d.patrol} [${set.join(', ')}] · on the floor [${on.join(', ')}] of routes [${L.routes.map((x: any) => x.name).join(', ')}]`);
  F.verdict(((g.devices?.cameras?.length ?? 0) + (g.devices?.lasers?.length ?? 0) + (g.devices?.keypads?.length ?? 0)) === (L.devices?.length ?? 0) && (g.civilians?.length ?? 0) === (L.civilians?.length ?? 0) && (L.civilians?.length ?? 0) > 0, 'the level\'s devices and civilians are live',
    `${g.devices?.list?.length ?? g.devices?.devices?.length ?? 0} device(s) of ${L.devices?.length ?? 0} · ${g.civilians?.length ?? 0} civilian(s) of ${L.civilians?.length ?? 0}`);
  { const M = L.mission, words = QM.quietWords(g), line = objectiveText(g);
    F.verdict(M.entryDoor === P.door && M.rack.index === P.rackIndex && flat(M.rack.front, P.front) < 1e-6 && M.serverRoom.x0 === P.area.x0 && words?.place === P.place && words?.holder === P.holder && words?.thing === Q.thing && line.includes(P.place) && !/server room|drive|fire exit/i.test(line),
      'the mission in force is the dealt spot\'s, said in the level\'s own words (nothing of the office\'s)', `objective: '${line}' · place '${words?.place}' · holder '${words?.holder}' · thing '${words?.thing}' · out by ${words?.outs}`); }
  { const k0 = dealKey(g), same: string[] = []; for (let i = 0; i < 3; i++) { await hushed(() => g.restartEncounter()); same.push(dealKey(g)); }
    const starts = new Set<number>(), spots = new Set<number>(), sets = new Set<number>();
    for (let pin = 0; pin < 24; pin++) { await hushed(() => quitScenario(g)); await start(W, `?quiet=${pin}`); starts.add(g.quiet.deal.start); spots.add(g.quiet.deal.spot); sets.add(g.quiet.deal.patrol); }
    (await import(`${ROOT}/src/game/samestart.ts`)).SAMESTART.on = false;   // (the deal BEHIND 'every mission starts the same way': with that switch on — the shipped stand — an unpinned run is the first of each list on every restart, samestart-check.ts; the runner puts the table back)
    await hushed(() => quitScenario(g)); await start(W, '?quiet'); const free = new Set<string>(); for (let i = 0; i < 12; i++) { await hushed(() => g.restartEncounter()); free.add(dealKey(g)); }
    F.verdict(same.every(k => k === k0) && starts.size === Q.starts.length && spots.size === Q.spots.length && sets.size >= 2 && free.size >= 3, 'a pinned deal is the same on every restart; over 24 pins every start and every spot comes up; unpinned, restarts deal afresh off the run\'s die',
      `pin 7 → ${k0}, restarted ${same.join(' ')} · 24 pins: ${starts.size} starts, ${spots.size} spots, ${sets.size} patrol sets · 12 unpinned restarts: ${free.size} different deals`); }
  { await hushed(() => quitScenario(g));
    const flags1 = [PAIRUP.on, PAIR.on, SNEAK.on, SPOTTED.on, SILENT.on, SILENT.start, HOSTILE.guard.operative];
    F.verdict(!g.quiet.active && activeScenario(g) === null && JSON.stringify({ spawn: L.playerSpawn, mission: L.mission }) === authored && g.guards.length === L.routes.length && g.guards.every((x: any, i: number) => x.routeI === i && g.engine.lights.lights.includes(x.flashlight)) && flags1.join() === flags0.join(),
      'stop: the level\'s own spawn and mission are back, every route\'s man is on the list in route order with his torch, every switch as it stood', `${g.guards.length} guards of ${L.routes.length} routes · switches ${flags1.join(' ')} (were ${flags0.join(' ')})`); }
  return F.done();
});

// ───────────────────────────────────────────────────────────── the run to its end ─────────────────────────────────────────────────────────────
/** the mission walked through by its stages with Sam put where each needs him (the scripted WALK of it is tools/qa/solo-night.ts --quiet): the room, the
 *  holder's row, out past exit `k`'s line. Returns what happened. */
async function playOut(W: any, k: number) {
  const g = W.game, Q = g.quiet, P = Q.spot, X = Q.exits[k], I = W.input, note: string[] = [];
  g.godMode = true; g.playerInvisible = true;
  const stand = freeNear(g, P.front, 1.2)!; g.teleportPlayer(stand);
  const reached = steps(W, 3, () => g.mission.stage !== 'infiltrate'); note.push(`reached: ${reached} (${g.mission.stage})`);
  let pressed = false; const took = steps(W, 12, () => { W.cursorAt?.(P.front); if (!pressed && g.selectVerb('objective', 'drive')) { I.pressed.add('Space'); pressed = true; } return !!g.mission.pulled; });
  note.push(`taken: ${took} (${g.mission.stage})`);
  const inn = freeNear(g, [X.x - X.out[0] * 1.0, 0, X.z - X.out[1] * 1.0], 0.8)!; g.teleportPlayer(inn); steps(W, 0.5);
  const notYet = g.mission.stage !== 'done';
  g.teleportPlayer(QM.exitPoint(X, 0.9)); const out = steps(W, 2, () => g.mission.stage === 'done');
  const last = String(g.chronicle.events[g.chronicle.events.length - 1]?.data?.text ?? g.messages[g.messages.length - 1]?.text ?? '');
  return { reached, took, notYet, out, last, note: note.join(' · '), exit: X.name };
}
export const quietRun = guarded(async () => {
  const F = family('quiet-run: the mission to its end by each way out — the room, the thing taken, out past that exit\'s own line');
  const W = await stand(4), g = W.game, n = g.level.scenarios.quiet.exits.length;
  for (let k = 0; k < n; k++) {
    await hushed(() => quitScenario(g)); const r = await start(W, `?quiet=${11 + k}`); if (r.why) { F.verdict(false, `exit ${k}`, `refused: ${r.why}`); continue; }
    const R = await hushed(() => playOut(W, k)), msgs = (g.messages as { text: string }[]).map(m => m.text).join(' | ');
    F.verdict(R.reached && R.took && R.notYet && R.out && g.mission.stage === 'done' && msgs.includes(R.exit) && !/fire exit|server room|the drive/i.test(msgs), `out by ${R.exit}: reached, taken, not done a stride SHORT of the line, done a stride past it, and the last word names that way out`,
      `${R.note} · short of the line done: ${!R.notYet} · past it: ${g.mission.stage} · deal ${dealKey(g)} · said: ${(g.messages as { text: string }[]).slice(-3).map(m => `'${m.text}'`).join(' ')}`);
  }
  { await hushed(() => quitScenario(g)); await start(W, '?quiet=5'); g.godMode = true; g.playerInvisible = true;
    const X = g.quiet.exits[0]; g.teleportPlayer(QM.exitPoint(X, 0.9)); steps(W, 1.5);
    F.verdict(g.mission.stage !== 'done', 'walking out before the thing is taken ends nothing', `past '${X.name}' with nothing taken: stage ${g.mission.stage}`); }
  { // the thing is not taken THROUGH A WALL: the far shelf stands against the store's south wall, and a man outside it is inside the bare radius
    const Q = g.level.scenarios.quiet; let pin = 0; for (; pin < 200; pin++) { await hushed(() => quitScenario(g)); await start(W, `?quiet=${pin}`); if (g.quiet.deal.spot === 2) break; }
    const P = g.quiet.spot, inside = freeNear(g, P.front, 1.2)!; let outside: number[] | null = null;
    for (let z = P.front[2] + 0.9; z < P.front[2] + 2.0 && !outside; z += 0.1) if (z > P.area.z1 + 0.3 && !g.col.nav.isBlocked(P.front[0], z)) outside = [P.front[0], 0, z];
    const dIn = rackDist(g, inside), dOut = outside ? rackDist(g, outside) : NaN, bare = outside ? Math.max(0, flat(outside, P.front) - P.halfW) : NaN;
    F.verdict(g.quiet.deal.spot === 2 && dIn < 1.1 && !!outside && bare < 1.1 && dOut === Infinity, 'the holder is reached from the floor before it and NOT through the wall behind it',
      `${P.holder} of ${Q.spots[2].place}: from ${at(inside)} inside ${dIn.toFixed(2)} m · from ${outside ? at(outside) : '— (no free floor outside)'} beyond the wall the bare radius says ${Number.isFinite(bare) ? bare.toFixed(2) : '—'} m, the reach says ${dOut}`); }
  { // a dealt start is where the camera is from the first frame (the follow camera does not fly across the level from the authored spawn)
    const cam = W.cam, far: number[] = []; let ok = !!cam;
    for (const pin of [0, 1, 2, 3, 4, 5]) { await hushed(() => quitScenario(g)); await start(W, `?quiet=${pin}`); W.step(DT); if (cam) { const d = flat(cam.target, g.player.char.pos); far.push(d); if (d > 0.5) ok = false; } }
    F.verdict(ok, 'the camera is on Sam on the first frame of every deal', cam ? `camera to Sam after one frame, six pins: ${far.map(d => d.toFixed(2)).join(' ')} m` : 'the harness has no camera to read'); }
  return F.done();
});

// ───────────────────────────────────────────────────────────── with one partner ─────────────────────────────────────────────────────────────
export const quietPair = guarded(async () => {
  const F = family('quiet-pair: with one partner — staged beside Sam, silent from the first frame, the pair rules on for the run, sneaking as two');
  const W = await stand(5), g = W.game, Q = g.level.scenarios.quiet;
  const flags0 = [PAIRUP.on, PAIR.on, SNEAK.on, SPOTTED.on, SILENT.on, SILENT.start, HOSTILE.guard.operative];
  const r = await start(W, '?quiet=2&squad=1'), d = g.quiet.deal, S = Q.starts[d.start], m = g.quiet.ops[0];
  F.verdict(!r.why && g.quiet.ops.length === 1 && !!m && m.team === 'operative' && !!m.unit && flat(m.char.pos, g.player.char.pos) < 2.5 && g.col.nav.walkable(g.player.char.pos, m.char.pos) && runningScenario(g, FILE)?.entry?.id === 'quiet-yard-two',
    '?quiet&squad=1 starts as the list\'s own row with ONE operative staged beside Sam on floor he can walk to', `${r.why ?? 'started'} · ${g.quiet.summary()} · partner ${m ? at(m.char.pos) : '—'}, ${m ? flat(m.char.pos, g.player.char.pos).toFixed(2) : '—'} m from Sam at ${at(S.sam)} · row ${runningScenario(g, FILE)?.entry?.id}`);
  W.step(DT); W.step(DT);
  F.verdict(PAIRUP.on && PAIR.on && SNEAK.on && SPOTTED.on && SILENT.on && squadSilent(g) && HOSTILE.guard.operative && HOSTILE.operative.guard, 'the pair rules are on for this run, the squad is silent from the first frame, and the shift is hostile to the partner (he is no colleague of theirs)',
    `pairup ${PAIRUP.on} · orders ${PAIR.on} · sneak ${SNEAK.on} · spotted ${SPOTTED.on} · silent ${squadSilent(g)} · guard↔operative ${HOSTILE.guard.operative}/${HOSTILE.operative.guard}`);
  { g.godMode = true; g.playerInvisible = true;
    const calm0 = g.guards.filter((x: any) => !x.unit).every((x: any) => x.state === 'patrol');
    // Sam walks (put) 9 m into the yard by its own floor: the partner follows on his own feet
    const to = freeNear(g, [S.sam[0] + Math.sin(S.samYaw) * 9, 0, S.sam[2] + Math.cos(S.samYaw) * 9], 2)!;
    const path = g.col.nav.findPath(g.player.char.pos, to, 20000) as number[][] | null; let far = 0;
    if (path) for (const p of path) { g.teleportPlayer([p[0], 0, p[2]]); steps(W, 0.7); far = Math.max(far, flat(m.char.pos, g.player.char.pos)); }
    steps(W, 6); const gap = flat(m.char.pos, g.player.char.pos);
    F.verdict(!!path && gap < 3.5 && flat(m.char.pos, S.mate ?? S.sam) > 4 && m.state !== 'dead', 'told to fall in at the start, he follows Sam across the floor on his own feet and closes up when Sam stops',
      `Sam to ${at(to)} · partner at ${at(m.char.pos)}, ${gap.toFixed(1)} m from Sam (furthest behind on the way ${far.toFixed(1)} m) · the shift calm at the start: ${calm0}`); }
  { // a guard with the partner standing lit a few metres in front of him notices the PARTNER (Sam is out of every eye: invisible, as the probes' own flag)
    const gd = g.guards.find((x: any) => !x.unit && x.state === 'patrol')!, yaw = gd.char.bodyYaw;
    const front = freeNear(g, [gd.char.pos[0] + Math.sin(yaw) * 3.0, 0, gd.char.pos[2] + Math.cos(yaw) * 3.0], 1.0);
    const light = g.lightAt; g.lightAt = () => 1.2;   // (a lit floor: the harness has no GPU meter — the CPU stand-in every teammate's meter falls back on)
    g.orders.give('hold', g.orders.targetAt(m.char.pos), 'all');
    if (front) { m.char.pos = [front[0], 0, front[2]]; m.char.update(0); }
    const a0 = gd.awareness, saw = !!front && steps(W, 5, () => gd.state !== 'patrol' || gd.awareness > 0.5);
    g.lightAt = light;
    F.verdict(saw, 'a guard with the partner standing lit three metres in front of him NOTICES him — the partner can get the pair seen, so sneaking as two is a thing to do', `${gd.callsign}: awareness ${a0.toFixed(2)} → ${gd.awareness.toFixed(2)}, state ${gd.state}${front ? '' : ' (no free floor in front of him)'}`); }
  { // the cast despawned under it by something short of a restart (a bare resetGuards): staged again on the next tick, partner and all
    await hushed(() => { g.resetGuards(); steps(W, 0.3); }); const m2 = g.quiet.ops[0];
    F.verdict(!!m2 && g.guards.includes(m2) && m2.state !== 'dead' && flat(m2.char.pos, g.player.char.pos) < 3.5 && HOSTILE.guard.operative, 'a bare resetGuards under the run stages it again: the partner is back beside Sam',
      `${g.quiet.summary()} · partner ${m2 ? `${at(m2.char.pos)}, on the list ${g.guards.includes(m2)}` : 'GONE'}`); }
  { await hushed(() => quitScenario(g));
    const flags1 = [PAIRUP.on, PAIR.on, SNEAK.on, SPOTTED.on, SILENT.on, SILENT.start, HOSTILE.guard.operative];
    F.verdict(!g.guards.some((x: any) => x.unit) && flags1.join() === flags0.join() && g.guards.length === g.level.routes.length, 'stop: the partner is gone, the shift is whole, every switch and the shift\'s view of operatives as they stood', `switches ${flags1.join(' ')} (were ${flags0.join(' ')}) · ${g.guards.length} guards`); }
  { // a Game DROPPED mid-run (a probe that never stops what it started): the next Game stands up with the switches as they stood — they are modules' tables, not a Game's
    const A = await stand(6); await start(A, '?quiet=1&squad=1'); const held = HOSTILE.guard.operative && PAIRUP.on;
    const B = await stand(7), flags2 = [PAIRUP.on, PAIR.on, SNEAK.on, SPOTTED.on, SILENT.on, SILENT.start, HOSTILE.guard.operative];
    F.verdict(held && flags2.join() === flags0.join() && !B.game.quiet.active, 'a Game dropped with a partner run up leaves nothing on for the next Game', `held while up: ${held} · the next Game's switches ${flags2.join(' ')} (were ${flags0.join(' ')})`); }
  return F.done();
});

// ───────────────────────────────────────────────────────────── checkpoints ─────────────────────────────────────────────────────────────
export const quietCheckpoint = guarded(async () => {
  const F = family('quiet-checkpoint: a save carries the deal, a load deals it back');
  const W = await stand(6), g = W.game;
  await start(W, '?quiet'); steps(W, 4);
  const gate = SAVE.canSave(g, false);
  const to = freeNear(g, [g.player.char.pos[0] + 1.5, 0, g.player.char.pos[2] + 0.5], 1.5)!; g.teleportPlayer(to); steps(W, 1);
  const k0 = dealKey(g), S = await hushed(() => W.snapshot('probe', true)), men0 = g.guards.map((x: any) => ({ n: x.callsign, r: x.routeI, p: [...x.char.pos] })), sam0 = [...g.player.char.pos], t0 = g.time;
  F.verdict(gate === null && !!S.quiet && `${S.quiet.deal.start}/${S.quiet.deal.spot}/${S.quiet.deal.patrol}` === k0 && S.guards.length === g.guards.length, 'on a calm quiet run the autosave\'s own gate passes (the manned roster IS the roster), and the file carries the deal',
    `canSave: ${gate ?? 'ok'} · deal ${k0} in the file: ${JSON.stringify(S.quiet)} · ${S.guards.length} men filed of ${g.level.routes.length} routes`);
  // restarts until the run stands on ANOTHER deal, then some play, then the load
  (await import(`${ROOT}/src/game/samestart.ts`)).SAMESTART.on = false;   // (so a restart CAN deal another: with the switch on every unpinned restart is the same deal — the runner puts the table back)
  let tries = 0; do { await hushed(() => g.restartEncounter()); tries++; } while (dealKey(g) === k0 && tries < 40);
  const other = dealKey(g); steps(W, 3);
  const why = SAVE.canLoad(g, S); await hushed(() => W.restore(S));
  const men1 = g.guards.map((x: any) => ({ n: x.callsign, r: x.routeI, p: [...x.char.pos] }));
  const same = men1.length === men0.length && men1.every((a: any, i: number) => a.r === men0[i].r && flat(a.p, men0[i].p) < 0.05);
  F.verdict(other !== k0 && why === null && dealKey(g) === k0 && same && flat(g.player.char.pos, sam0) < 0.05 && Math.abs(g.time - t0) < 1e-6 && g.quiet.active && JSON.stringify(g.level.mission.rack.front) === JSON.stringify(g.level.scenarios.quiet.spots[S.quiet.deal.spot].front),
    'loaded over a run standing on another deal: the file\'s start, spot and patrol set are in force again, every man and Sam where they were filed', `the run stood on ${other} · canLoad: ${why ?? 'ok'} · after the load ${dealKey(g)} · men ${men1.map((x: any) => `${x.n}@${at(x.p)}`).join(' ')} · Sam ${at(g.player.char.pos)}`);
  { await hushed(() => quitScenario(g)); const plain = SAVE.canLoad(g, S), P = await hushed(() => W.snapshot('plain', true));
    await start(W, '?quiet'); const cross = SAVE.canLoad(g, P);
    await hushed(() => quitScenario(g)); await start(W, '?quiet&squad=1'); steps(W, 0.5);
    const two = SAVE.canSave(g, false), solo = SAVE.canLoad(g, S);
    F.verdict(typeof plain === 'string' && typeof cross === 'string' && typeof two === 'string' && typeof solo === 'string', 'the plain night refuses a quiet mission\'s file and the mission refuses a plain file, each with the reason; with the partner on the floor nothing is saved (a spawned unit, as in every squad scenario) and a file made alone is refused',
      `plain night ← quiet file: '${plain}' · quiet ← plain file: '${cross}' · with the partner, save: '${two}' · with the partner ← a file made alone: '${solo}'`); }
  return F.done();
});

// ───────────────────────────────────────────────────────────── the office-only places ─────────────────────────────────────────────────────────────
export const quietOwn = guarded(async () => {
  const F = family('quiet-own: the office-only places — the level\'s own on a level with the block (or off), the office\'s tables on the office');
  { const W = await stand(7), g = W.game, Q = g.level.scenarios.quiet;
    const spots = Object.fromEntries(NEEDS.NEED_KINDS.map((k: string) => [k, NEEDS.needSpot(g, k)]));
    F.verdict(spots.coffee === null && spots.stretch === null && flat(spots.smoke.pos, Q.needs.smoke.pos) < 1e-6 && flat(spots.water.pos, Q.needs.water.pos) < 1e-6, 'the shift\'s errands go to the level\'s own stands; a kind the level does not give is not dealt (nobody walks to the office\'s coffee machine)',
      NEEDS.NEED_KINDS.map((k: string) => `${k}: ${spots[k] ? at(spots[k].pos) : 'none'}`).join(' · '));
    const C = CIVS.civSpots(g);
    F.verdict(C.phones.length === 0 && C.exits.length === Q.wayouts.length && flat(C.exits[0].pos, Q.wayouts[0].pos) < 1e-6, 'a frightened civilian has the level\'s own ways out and phones (here: one way out, no phone)', `phones ${C.phones.length} · ways out ${C.exits.map((x: any) => at(x.pos)).join(' ')}`);
    const asked = await hushed(() => QRF.requestQrf(g, 'panel'));
    F.verdict(QRF.hasResponse(g) === false && asked === false && g.qrf.state === 'idle', 'no stairwell door on this level: the response team has nowhere to come from, so none is called', `hasResponse ${QRF.hasResponse(g)} · asked: ${asked} · state ${g.qrf.state}`);
    F.verdict(g.weather.rainRate === 0 && g.weather.storm === 0, 'no weather picked: a dry still night, not the office\'s storm by the office\'s rectangles', `storm ${g.weather.storm} · rain ${g.weather.rainRate} · wind ${g.weather.wind}`);
    const name = typeof DIALOGUE.roomName === 'function' ? DIALOGUE.roomName(g.level, [Q.spots[1].front[0], 0, Q.spots[1].front[2]]) : Q.spots[1].place;
    F.verdict(name === Q.spots[1].place && !/server/i.test(name), 'a man standing in a spot\'s room names it as the level does', `at spots[1]: '${name}'`);
    steps(W, 2); await start(W, '?quiet=1'); steps(W, 20);
    F.verdict(g.guards.every((x: any) => x.state === 'patrol') && g.qrf.state === 'idle', 'twenty seconds of the mission with Sam on his start: the shift walks its routes, nobody roused, nothing called', g.guards.map((x: any) => `${x.callsign} ${x.state} ${at(x.char.pos)}`).join(' · ')); }
  { const W = await stand(8, null), g = W.game;
    const C = CIVS.civSpots(g);
    F.verdict(NEEDS.NEED_KINDS.every((k: string) => NEEDS.needSpot(g, k) === NEEDS.NEED_SPOTS[k]) && C.phones === CIVS.CIV_SPOTS.phones && C.exits === CIVS.CIV_SPOTS.exits && QRF.hasResponse(g) === true, 'on the office every one of them is the table it always was', `needs: the office's four · civilians: ${C.phones.length} phones, ${C.exits.length} exits · response team: ${QRF.hasResponse(g)}`); }
  return F.done();
});

// ───────────────────────────────────────────────────────────── the review of the join ─────────────────────────────────────────────────────────────
export const quietFixes = guarded(async () => {
  const F = family('quiet-fixes: the review of the join — the hunt after the partner drops, the holder\'s floor, the checkpoint offer, the words, the switches, the failure paths');
  const flagsNow = () => [PAIRUP.on, PAIR.on, SNEAK.on, SPOTTED.on, SILENT.on, SILENT.start, HOSTILE.guard.operative];
  { // (1) a staff man who is on the PARTNER and sees him drop is back on Sam, his hunt standing — not 'that's all of them' and a walk back to his mark
    const W = await stand(11), g = W.game; await start(W, '?quiet=2&squad=1'); steps(W, 0.2);
    g.godMode = true; g.playerInvisible = true;
    const m = g.quiet.ops[0], gd = g.guards.find((x: any) => !x.unit && x.state === 'patrol')!;
    gd.state = 'alert'; gd.awareness = 1; gd.foe = m; gd.lastKnown = [m.char.pos[0], 0, m.char.pos[2]]; gd.lastSeenT = g.time;
    await hushed(() => killGuard(g, m, [0, 0, 1], false, 'shot', 'ai')); m.killerId = gd.char.id;
    const said: string[] = []; const states: string[] = [];
    let fired = 0, seenSam = false; g.playerInvisible = false; g.lightAt = () => 0; g.player.visibility = 0;   // (Sam there to be shot at for the first two thirds of a second, in the dark where he started)
    for (let i = 0; i < 360; i++) { W.step(DT); if (i < 40) { fired += g.events.filter((e: any) => e.kind === 'shot' && e.who === gd.char.id && e.time >= g.time - DT / 2).length; seenSam ||= gd.sawPlayerThisFrame; } if (i === 40) g.playerInvisible = true; if (gd.bubble && !said.includes(gd.bubble.text)) said.push(gd.bubble.text); if (states[states.length - 1] !== gd.state) states.push(gd.state); }
    F.verdict(seenSam || fired === 0, 'in the half second after the partner falls he puts no round at a Sam he has not seen (the sighting was of the man who fell)', `rounds from ${gd.callsign} in the first 0.67 s: ${fired} · saw Sam in that time: ${seenSam}`);
    F.verdict(m.state === 'dead' && gd.foe === 'player' && !states.includes('suspicious') && !states.includes('patrol') && !said.some(t => /all of them/.test(t)), 'a guard on the partner who sees him drop is on Sam again and goes on hunting: no \'that\'s all of them\', no walk back to his mark',
      `${gd.callsign}: states over six seconds ${states.join(' → ')} · on ${gd.foe === 'player' ? 'Sam' : gd.foe ? 'the partner' : 'nobody'} · said: ${said.map(t => `'${t}'`).join(' ') || 'nothing'}`); }
  { // (2, 3) one rule for the floor at a holder's face: the checker's cell is the cell the man sent to look stands on, and it has the face in reach
    const W = await stand(12), g = W.game, Q = g.level.scenarios.quiet; const rows: string[] = []; let ok = true;
    for (let k = 0; k < Q.spots.length; k++) {
      let pin = 0; for (; pin < 400; pin++) { await start(W, `?quiet=${pin}`); if (g.quiet.deal.spot === k) break; await hushed(() => quitScenario(g)); }
      const P = Q.spots[k], H = QM.holderStand(g, P.front, P.area); steps(W, 0.2);
      await hushed(() => sendRackCheck(g)); const who = g.guards.find((x: any) => x.task?.kind === 'rack'), goal = who?.task?.pos;
      const line = !!goal && !g.col.solidBlocked([goal[0], 1.0, goal[2]], [P.front[0], 1.0, P.front[2]]), same = !!goal && !!H.pos && flat(goal, H.pos) < 1e-6;
      ok &&= H.ok && line && same; rows.push(`'${P.place}' face ${at(P.front)}: ${who?.callsign ?? 'nobody'} sent to ${goal ? at(goal) : '—'} · the checker's cell ${H.pos ? at(H.pos) : '—'} · a clear line to the face ${line}`);
      await hushed(() => quitScenario(g)); }
    F.verdict(ok, 'the man sent to look at the holder stands on the cell the level\'s check validated: free floor in the room with nothing solid between him and the face', rows.join('\n    ')); }
  { // (4) the cards' checkpoint offer: an earlier run's slot only if this game would load it
    const W = await stand(13), g = W.game; steps(W, 1);
    const wrote = await hushed(() => g.saves.write(g, 'manual', 'the plain night', true)); steps(W, 0.5);
    await start(W, '?quiet=1'); steps(W, 0.5);
    const any = g.saves.newest(true, g.mission.stats.elapsed), off = g.saves.offer(g, g.mission.stats.elapsed);
    await hushed(() => quitScenario(g)); steps(W, 0.5); const back = g.saves.offer(g, g.mission.stats.elapsed);
    F.verdict(!!any && off === null && !!back && back.key === any.key, 'a plain-night slot is no offer under the level\'s quiet mission (it would be refused); back on the plain night it is', `stored: ${wrote?.ok ?? !!any} · under the quiet mission newest() names '${any?.label ?? '—'}', offer() ${off ? `'${off.label}'` : 'nothing'} · on the plain night again: ${back ? `'${back.label}'` : 'nothing'}`); }
  { // (5) the autosave's own words on a quiet mission: the level's room and thing, the level's places
    const W = await stand(14), g = W.game, Q = g.level.scenarios.quiet; await start(W, '?quiet=1'); steps(W, 0.5);
    g.godMode = true; g.playerInvisible = true; const P = Q.spots[g.quiet.deal.spot], labels: string[] = [];
    const seen = () => { const L = g.saves.pending?.label; if (L && labels[labels.length - 1] !== L) labels.push(L); };
    const inRoom = freeNear(g, [(P.area.x0 + P.area.x1) / 2, 0, (P.area.z0 + P.area.z1) / 2], 2)!; g.teleportPlayer(inRoom);
    for (let i = 0; i < 30; i++) { W.step(DT); seen(); }
    F.verdict(g.mission.stage === 'drive' && labels.some(t => t.includes(P.place.replace(/^the /, ''))) && !labels.some(t => /server room|the drive|lobby|corridor|cubicle/.test(t)), 'the autosave asked for on reaching the room is labelled in the level\'s own words', `stage ${g.mission.stage} · labels asked for: ${labels.map(t => `'${t}'`).join(' ') || 'none'}`); }
  { // (6) quiet beside a stale squad4
    const sp = specOfQuery('?levelFile=bazaar.json&quiet&squad4'), fq = (s: string) => fogOfQuery(new URLSearchParams(s));
    // the fog a quiet mission's own link asks for (none on the frozen stand; the quiet default on the page's), never the room clear's
    const fog = fq('?levelFile=bazaar.json&quiet&squad4'), own = fq('?levelFile=bazaar.json&quiet'), off = fq('?levelFile=bazaar.json&quiet&squad4&quietfog=off');
    F.verdict(sp?.kind === 'quiet' && sp.squad === 0 && fog === own && off === false && specOfQuery('?squad4')?.kind === 'roomclear', '?quiet beside a stale squad4 is the quiet mission, alone, under the fog its own link asks for and no other: none with quietfog=off (squad4 alone is still the room clear)', `spec ${JSON.stringify(sp)} · fog ${fog} (the same link without squad4: ${own}) · with quietfog=off ${off}`); }
  { // (7, 8) the switches a partner run holds
    const flags0 = flagsNow();
    const A = await stand(15); await start(A, '?quiet=1&squad=1'); const up = HOSTILE.guard.operative && PAIRUP.on && SNEAK.on;
    const B = await stand(16), atB = flagsNow().join(); A.step(DT); const backA = HOSTILE.guard.operative && PAIRUP.on && PAIR.on && SNEAK.on && SPOTTED.on && SILENT.on; B.step(DT); const atB2 = flagsNow().join();
    A.step(DT); await hushed(() => quitScenario(A.game)); const end = flagsNow().join();
    F.verdict(up && atB === flags0.join() && backA && atB2 === flags0.join() && end === flags0.join(), 'two Games in one process: the switches are the partner run\'s on ITS Game\'s frames and as they stood on the other\'s; stopped, as they stood', `up ${up} · the second Game stood up: ${atB} · the first Game's next frame: held ${backA} · the second's frame: ${atB2} · after the stop: ${end} (were ${flags0.join()})`);
    const s0 = SILENT.on; SILENT.on = true; const C = await stand(17); await start(C, '?quiet=1&squad=1'); steps(C, 0.2); SILENT.on = false; steps(C, 0.2); await hushed(() => quitScenario(C.game)); const kept = SILENT.on === false && !PAIRUP.on === !flags0[0]; SILENT.on = s0;
    F.verdict(kept, 'a row moved by hand during the run stays where the hand put it when the run stops (the rest go back as they stood)', `SILENT.on true before the run, switched off during it → ${kept ? 'off' : 'put back on'} after the stop`);
    const env = (globalThis as any).process.env, e0 = env.SNEAK; env.SNEAK = 'off'; const D = await stand(18); await start(D, '?quiet=1&squad=1'); const part = PAIR.on && SPOTTED.on && !SNEAK.on; await hushed(() => quitScenario(D.game)); if (e0 === undefined) delete env.SNEAK; else env.SNEAK = e0;
    F.verdict(part && flagsNow().join() === flags0.join(), 'this visit\'s word against one part (SNEAK=off) stands under a partner run: an A/B of that part measures something', `orders ${part} · sneak held off: ${part}`); }
  { // (9, 10) the failure paths
    const W = await stand(19), g = W.game, spawn = [...g.level.playerSpawn], M0 = g.level.mission, flags0 = flagsNow().join();
    const orig = g.resetGuards; let n = 0; g.resetGuards = function (this: any, ...a: any[]) { if (n++ === 0) throw new Error('the probe\'s throw'); return orig.apply(this, a); };
    const r = await start(W, '?quiet=1&squad=1'); g.resetGuards = orig;
    F.verdict(typeof r.why === 'string' && !g.quiet.active && g.level.mission === M0 && flat(g.player.char.pos, spawn) < 0.05 && g.guards.length === g.level.routes.length && !g.guards.some((x: any) => x.unit) && flagsNow().join() === flags0,
      'a start that throws outside its staging leaves the plain night whole: the reason returned, the authored mission and spawn back, a fresh encounter with every route manned, the switches as they stood', `'${r.why}' · Sam ${at(g.player.char.pos)} (spawn ${at(spawn)}) · ${g.guards.length} of ${g.level.routes.length} on the list`);
    await start(W, '?quiet=1'); const nb = g.nightBreach.canStart(), rs = g.rescue.canStart();
    F.verdict(typeof nb === 'string' && /quiet/.test(nb) && typeof rs === 'string' && /quiet/.test(rs), 'with a quiet mission up the night breach and the rescue refuse to start over it (as it refuses over them)', `night breach: '${nb}' · rescue: '${rs}'`);
    await hushed(() => quitScenario(g)); }
  { // (the owners' by-eye note on the join) the sheet's Defenders row is live only where the pick changes something: greyed on the solo night AND on a quiet row
    const UI = await import(`${ROOT}/src/ui/missions.ts`); const L = UI.missionList();
    const quiet = L.filter((m: any) => m.scenario?.kind === 'quiet'), squad = L.filter((m: any) => m.scenario && m.scenario.kind !== 'quiet'), solo = L.filter((m: any) => !m.scenario);
    F.verdict(quiet.length > 0 && squad.length > 0 && solo.length > 0 && quiet.every((m: any) => !UI.diffLive(m)) && solo.every((m: any) => !UI.diffLive(m)) && squad.every((m: any) => UI.diffLive(m)),
      'Standard | Hard is live on every squad row and greyed on the solo night and on every quiet row (its shift is the level\'s own on either)', `${squad.length} squad rows live · ${quiet.length} quiet + ${solo.length} solo greyed`); }
  return F.done();
});
