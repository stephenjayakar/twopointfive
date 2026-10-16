#!/usr/bin/env bun
// A RESTART EQUALS A FRESH STAGING — the check the cleanup list asks for. A restart is four hand-kept lists in src/game/game.ts (restartEncounter /
// resetLevelState / resetGuards / clearAftermath) plus every newer module's own guess that one happened; what a player needs of it is one sentence: the game
// after a restart is the game a fresh staging gives. So, per mission, on one seed, two arms of the same build:
//   arm A (fresh)     stand the game up → stage the mission → N quiet frames, a digest (src/game/digest.ts digestGame) after the first frame and every BEAT frames
//   arm B (restart)   stand the game up → stage the mission → PLAY about twenty seconds (Sam walks, turns, puts rounds into the floor ahead of him, the nearest
//                     door is opened — kicked in if it would not open) → restart the way the page does → the same N quiet frames, the same digests
// and the two digest series must be equal; the first beat that is not is printed with the FIELDS that differ (digest.ts diffDigest).
//   bun run tools/qa/restart-probes.ts [--missions solo,night-breach,…] [--seed 1] [--play 20] [--quiet 10] [--own-clock] [--raw] [--verbose]   (exit 1 on any FAIL)
//   bun run tools/qa/probes.ts restart                                                                                            (the same, as a probe family)
//   RESTART_BREAK=1 bun run tools/qa/restart-probes.ts --missions solo      THE RED PATH: a chair left off its mark after the restart — must FAIL naming `props`
// THE STAND: each mission runs in a child bun under TPS_PROFILE=shipped (src/host/profile.ts: the game as the page ships it; RESTART_PROFILE=frozen = the
// harness's frozen stand instead), one child at a time. Missions are rows of src/scene/scenarioList.ts SCENARIOS by id, plus 'solo' = the plain night with no
// scenario up; the default set is the solo night and the three office missions (night-breach, room-clear-pair, hostage-rescue).
// WHAT 'THE WAY THE PAGE DOES' IS: Game.restartEncounter() — the pause card's 'Restart scenario / encounter' (ui/menu.ts), the down card's, Shift+Enter
// (game/player.ts). Under a scenario the restart re-stages it by itself: restartEncounter's tail calls nightBreach.onEncounterRestart / rescue.onEncounterRestart.
// WHAT 'A FRESH STAGING' IS: for a scenario, the page's own start (game/scenarioRun.ts startFromQuery on the row's query) on a game just stood up; its start()
// calls restartEncounter itself, so both arms stage through the same function and differ only in what the game had been through before. For the SOLO night the
// fresh arm is a game just stood up and restarted once before its first frame: the men's construction dice are drawn from Math.random in a different order at
// stand-up than at a restart, so a stood-up-and-never-restarted floor is not comparable die for die. The claim there is 'a restart after play ≡ a restart of an
// untouched game'.
// WHAT IS MADE EQUAL BY THE CHECK ITSELF (inputs, not the game's state):
//   - Math.random: seeded for the stand-up, re-seeded with one fixed word right before every staging and right before the restart of arm B
//   - the camera and the cursor: the aim ray hangs on them (the session journal files the camera as an INPUT for the same reason); arm B's camera is put back to
//     what it was at its own first staging (which is arm A's staging, die for die), the cursor to the harness's (800, 500), every key and button let go
//   - THE CLOCK: Game.time runs on through a restart by design, and some of the level is a function of the absolute clock (a flickering fixture's `factor`:
//     lighting.ts supply()). So arm B runs first and arm A's fresh game has its Game.time SET to arm B's restart time before its staging — the one write this file
//     makes into the game. `--own-clock` leaves arm A at the stand-up's 0 instead: red on `targets` for the flicker alone, which is what that mode is for
//   - the room clear's `ROOMCLEAR.reroll` is OFF in both arms: with it on (the shipped default) a restart under a room clear deals the NEXT placement of the
//     seed on purpose, which is not what this checks
//   - the event serial (and, under --own-clock, the clock's origin): Game.eventSeq runs on through a restart by design, so `seq` / a civilian's `heard` are
//     re-based to the staging's serial, and the digest's absolute stamps (t, escT, mission.sweepAt, the radio check's nextAt, a tripwire's lastTripAt, a bubble's
//     @t) to the staging's time (a no-op when the clocks are the same). `--raw` compares the digests as they come (red on `seq` alone: for reading what that covers).
// THE DIGEST TAKEN BEFORE ANY FRAME HAS RUN IS REPORTED, NOT JUDGED: a few digest fields are the LAST FRAME's derived values (a fixture's `factor`, written by
// lighting.ts updateTargets each frame: a game nobody has stepped still reads 1 for a lamp authored off) and a just-stood-up game has had no last frame.
// NOT covered: anything the digest does not hold (the squad's menu state, fog of war's memory, the renderer, audio, smoke — the harness has none), other levels
// than the ones asked for, a restart from a checkpoint load, a quit to the plain floor (scenarioRun.ts quitScenario).
import { resolve } from 'node:path';
const ROOT = resolve(import.meta.dir, '../..');
type Vec3 = [number, number, number];
const DT = 1 / 60, BEAT = 60;
export const RESTART_MISSIONS = ['solo', 'night-breach', 'room-clear-pair', 'hostage-rescue'];
const seeded = (a: number) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const STAGE_SEED = 0x51a9e;   // the one word both arms seed Math.random with right before the staging under test

interface ArmOut { series: { f: number; d: any }[]; note: string; /** Game.time at the staging under test */ t0: number }

/** One arm of one mission in THIS process (the child): see the head. `restart` = arm B; `clockAt` (arm A) = the Game.time to stage at (null: the stand-up's own 0). */
async function arm(id: string, seed: number, play: number, quietFrames: number, raw: boolean, restart: boolean, clockAt: number | null): Promise<ArmOut> {
  const { standUp } = await import('./headless.ts');
  const { SCENARIOS } = await import(`${ROOT}/src/scene/scenarioList.ts`);
  const { scenarioQuery } = await import(`${ROOT}/src/scene/scenarios.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const { rollcallState } = await import(`${ROOT}/src/game/guards.ts`);
  const { ROOMCLEAR } = await import(`${ROOT}/src/game/roomclear.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const E = id === 'solo' ? null : SCENARIOS.find((e: any) => e.id === id);
  if (E === undefined) throw new Error(`no mission '${id}' in scenarioList.ts SCENARIOS (or 'solo')`);
  let level: any;
  if (E?.level) {   // (a mission on a level of its own: loaded as playthrough.ts loads it)
    const { readFileSync } = await import('node:fs'); const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`); const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
    level = loadLevel(parseLevelData(readFileSync(resolve(ROOT, 'levels', E.level), 'utf8')));
  }
  ROOMCLEAR.reroll = false;
  const log = console.log, err = console.error, warn = console.warn; const hush = <T>(fn: () => T): T => { console.log = console.error = console.warn = () => {}; try { return fn(); } finally { console.log = log; console.error = err; console.warn = warn; } };
  Math.random = seeded(0x9137 + seed * 7919);
  console.log = console.error = console.warn = () => {}; let W: any; try { W = await standUp({ uploadEvery: 4, ...(level ? { level } : {}) }); } finally { console.log = log; console.error = err; console.warn = warn; }
  const g = W.game, input = W.input, cam = W.cam;
  const camSnap = (): Record<string, unknown> => { const o: Record<string, unknown> = {}; for (const k of Object.keys(cam)) { const v = cam[k]; if (typeof v === 'number' || typeof v === 'boolean' || v === null) o[k] = v; else if (Array.isArray(v) && v.every((x: unknown) => typeof x === 'number')) o[k] = [...v]; } return o; };
  const stageFresh = () => {
    if (!E) { g.restartEncounter(); return; }
    const { why } = startFromQuery(g, new URLSearchParams(scenarioQuery(E))); if (why) throw new Error(`start refused — ${why}`);
  };
  let note = '', t0 = g.time, seq0 = g.eventSeq;
  if (!restart) {   // ---- arm A: the fresh staging, at arm B's clock when one is given
    if (clockAt !== null) g.time = t0 = clockAt;
    Math.random = seeded(STAGE_SEED); hush(stageFresh);
  } else {          // ---- arm B: stage (the same staging as arm A's, die for die), play, restart
    Math.random = seeded(STAGE_SEED); hush(stageFresh); const camFrom = camSnap();
    const pl0 = g.player, ammo0 = `${pl0.pistol.roundsReady ?? '?'}/${pl0.rifle.roundsReady ?? '?'}`; let door: any = null, doorHow = '', shots = 0;
    const frames = Math.round(play * 60), ev = new Set<unknown>();
    hush(() => { for (let f = 0; f < frames; f++) {
      const pl = g.player, pos: Vec3 = pl.char.pos; input.keys.clear(); input.buttons = 0;
      const ph = f / frames;
      if (ph < 0.3) input.keys.add('KeyW'); else if (ph < 0.45) input.keys.add('KeyD'); else if (ph > 0.75 && ph < 0.9) input.keys.add('KeyS');   // walk, turn, back off
      if (ph >= 0.45 && ph < 0.6) {   // a gun up (E draws / unslings what is selected), then a round every third of a second into the floor four metres on
        if (f === Math.round(frames * 0.45) && pl.holstered) input.pressed.add('KeyE');
        const yaw = pl.char.bodyYaw; W.cursorAt([pos[0] + Math.cos(yaw) * 4, 0.05, pos[2] + Math.sin(yaw) * 4]);
        if (f % 20 === 10) { input.buttons |= 1; input.clicked |= 1; }
      }
      if (f === Math.round(frames * 0.62) && g.doors.list.length) {   // the nearest door: used as Sam uses one; kicked in a second later if that did not move it
        door = [...g.doors.list].sort((a: any, b: any) => Math.hypot(a.def.hinge[0] - pos[0], a.def.hinge[1] - pos[2]) - Math.hypot(b.def.hinge[0] - pos[0], b.def.hinge[1] - pos[2]))[0];
        g.doors.use(door, pos, PLAYER_ID, pl.keys); doorHow = 'used';
      }
      if (door && f === Math.round(frames * 0.62) + 60 && Math.abs(door.angle) < 0.05) { g.doors.kickIn(door, pos, PLAYER_ID, true); doorHow = 'kicked in'; }
      if (f === Math.round(frames * 0.7)) input.pressed.add('KeyG');   // …and a quick-throw of whatever can his kit has
      W.step(DT);
      for (const e of g.events) if (!ev.has(e)) { ev.add(e); if ((e as any).kind === 'shot' && (e as any).who === PLAYER_ID) shots++; }
    } });
    const pl = g.player;
    note = `played ${play} s: Sam walked ${Math.hypot(pl.char.pos[0] - g.level.playerSpawn[0], pl.char.pos[2] - g.level.playerSpawn[2]).toFixed(1)} m from the spawn, ${shots} of his shots heard (ready ${ammo0} → ${pl.pistol.roundsReady ?? '?'}/${pl.rifle.roundsReady ?? '?'}), `
      + `${door ? `door '${door.def.name}' ${doorHow} (angle ${door.angle.toFixed(2)}${door.lockBroken ? ', lock broken' : ''})` : 'no door'}, ${g.decals.list.length} marks, ${g.items.items.length} items on the floor, ${g.guards.filter((x: any) => x.state === 'dead').length} of ${g.guards.length} men down, Sam ${pl.down ? 'DOWN' : 'up'}, escalation ${g.escalation}`;
    // ---- the restart, as the page's cards and Shift+Enter make it
    input.keys.clear(); input.pressed.clear(); input.buttons = 0; input.clicked = 0; input.mouseX = 800; input.mouseY = 500;
    t0 = g.time; seq0 = g.eventSeq;
    Math.random = seeded(STAGE_SEED); hush(() => g.restartEncounter());
    for (const [k, v] of Object.entries(camFrom)) cam[k] = Array.isArray(v) ? [...v] : v; cam.rebuild?.();
    if (process.env.RESTART_BREAK === '1' && g.props.props.length) { const p = g.props.props[0]; p.x += 0.4; p.asleep = false; }   // THE RED PATH: one thing a restart 'forgot' — a piece of furniture left 0.4 m off its mark — must FAIL naming `props`
  }
  /** the digest with its absolute stamps moved to the staging's origin (see the head); `raw` = as digestGame gives it */
  const f2 = (x: number) => Number(x.toFixed(2));
  const digest = (): any => {
    const d: any = JSON.parse(JSON.stringify(digestGame(g))); if (raw) return d;
    d.t = f2(g.time - t0); d.seq = g.eventSeq - seq0;
    if (g.escalationT >= 0) d.escT = f2(g.escalationT - t0);
    if (g.mission.sweepAt > 0) d.mission.sweepAt = f2(g.mission.sweepAt - t0);
    { const R = rollcallState(g); d.rollcall = `${R.stage}:${R.nextAt >= 0 ? f2(R.nextAt - t0) : R.nextAt}:${R.checks}`; }
    const bub = (b: any) => b ? `${b.text}@${f2(b.t - t0)}` : null;
    g.guards.forEach((gd: any, i: number) => { d.guards[i].bubble = bub(gd.bubble); });
    (g.civilians ?? []).forEach((cv: any, i: number) => { d.civilians[i].bubble = bub(cv.bubble); if (typeof cv.heardUpTo === 'number') d.civilians[i].heard = cv.heardUpTo - seq0; });
    if (d.devices) d.devices.lasers = g.devices.lasers.map((l: any) => `${l.trips}:${l.lastTripAt > -50 ? f2(l.lastTripAt - t0) : l.lastTripAt}`);
    return d;
  };
  const series: { f: number; d: any }[] = [{ f: 0, d: digest() }];
  hush(() => { for (let f = 1; f <= quietFrames; f++) { W.step(DT); if (f === 1 || f % BEAT === 0 || f === quietFrames) series.push({ f, d: digest() }); } });
  return { series, note, t0 };
}

/** The child: one mission, both arms, its verdict line(s). Returns the pass. */
async function one(id: string, seed: number, play: number, quiet: number, raw: boolean, verbose: boolean, ownClock: boolean): Promise<boolean> {
  const { diffDigest } = await import(`${ROOT}/src/game/digest.ts`);
  const N = Math.round(quiet * 60);
  const B = await arm(id, seed, play, N, raw, true, null), A = await arm(id, seed, play, N, raw, false, ownClock ? null : B.t0);
  const same = (i: number) => JSON.stringify(A.series[i].d) === JSON.stringify(B.series[i]?.d);
  const tops = (ls: string[]) => [...new Set(ls.map(l => l.split(':')[0].replace(/\[\d+[^\]]*\]/g, '[]')))].join(', ');
  // (series[0] is the staging before any frame has run: reported, not judged — see the head)
  let bad = -1; for (let i = 1; i < A.series.length; i++) if (!same(i)) { bad = i; break; }
  const pre = same(0) ? '' : `      (before the first frame only, not judged — last frame's derived values: ${tops(diffDigest(A.series[0].d, B.series[0].d, 6))})`;
  const men = (A.series[0].d.guards as unknown[]).length;
  if (bad < 0) { console.log(`- PASS — ${id}: a restart equals a fresh staging — ${A.series.length - 1} digests over ${quiet} s agree (${men} men on the floor)`); console.log(`      ${B.note}`); if (pre) console.log(pre); return true; }
  const diffs: string[] = diffDigest(A.series[bad].d, B.series[bad].d, verbose ? 40 : 10).map((l: string) => { const k = l.split(':')[0]; const x = A.series[bad].d[k], y = B.series[bad].d[k];   // (the one-line fields — targets, doors, items, props — by the entries that differ)
    if (typeof x !== 'string' || typeof y !== 'string' || !/ /.test(x + y)) return l; const xs = x.split(' '), ys = new Set(y.split(' ')), xset = new Set(xs);
    return `${k}: [${xs.filter(t => !ys.has(t)).slice(0, 6).join(' ')}] ≠ [${y.split(' ').filter(t => !xset.has(t)).slice(0, 6).join(' ')}]`; });
  const last = A.series.length - 1, nBad = A.series.filter((_, i) => i > 0 && !same(i)).length;
  console.log(`- FAIL — ${id}: the restarted game is not the freshly staged one — first at frame ${A.series[bad].f} of ${N} (${nBad} of ${last} digests differ; ${same(last) ? 'equal again by the end' : `still apart at the end: ${tops(diffDigest(A.series[last].d, B.series[last].d, 40))}`}); fields at the first: ${tops(diffs)}`);
  console.log(`      ${B.note}`); if (pre) console.log(pre);
  for (const l of diffs) console.log(`      fresh ≠ restarted · ${l}`);
  return false;
}

/** THE PROBE (probes.ts `restart`): each mission in its own child under the shipped stand, one at a time; its lines relayed; false on any FAIL. */
export async function restartFresh(opts: { missions?: string[]; seed?: number; play?: number; quiet?: number; raw?: boolean; verbose?: boolean; ownClock?: boolean } = {}): Promise<boolean> {
  const missions = opts.missions ?? RESTART_MISSIONS, profile = process.env.RESTART_PROFILE ?? 'shipped';
  console.log(`\n=== restart: a restart equals a fresh staging (digestGame; ${opts.play ?? 20} s of play, then ${opts.quiet ?? 10} s quiet in both arms; the ${profile} stand, seed ${opts.seed ?? 1}) ===`);
  let ok = true;
  for (const id of missions) {
    const args = ['bun', 'run', resolve(import.meta.dir, 'restart-probes.ts'), '--one', id, '--seed', String(opts.seed ?? 1), '--play', String(opts.play ?? 20), '--quiet', String(opts.quiet ?? 10), ...(opts.raw ? ['--raw'] : []), ...(opts.verbose ? ['--verbose'] : []), ...(opts.ownClock ? ['--own-clock'] : [])];
    const pr = Bun.spawn(args, { stdout: 'pipe', stderr: 'pipe', env: { ...process.env, TPS_PROFILE: profile } });
    const [out, err] = await Promise.all([new Response(pr.stdout).text(), new Response(pr.stderr).text()]); const code = await pr.exited;
    const lines = out.split('\n').filter(l => /^- (PASS|FAIL)\b|^      /.test(l));
    for (const l of lines) console.log(l);
    if (!lines.some(l => /^- (PASS|FAIL)\b/.test(l))) { ok = false; console.log(`- FAIL — ${id}: the run left no verdict (exit ${code}) — ${(err.trim() || out.trim()).split('\n').slice(-3).join(' / ').slice(0, 400)}`); }
    else if (code !== 0 || lines.some(l => l.startsWith('- FAIL'))) ok = false;
  }
  return ok;
}

if (import.meta.main) {
  const argv = process.argv.slice(2), flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }, has = (n: string) => argv.includes(n);
  const seed = Number(flag('--seed') ?? 1), play = Number(flag('--play') ?? 20), quiet = Number(flag('--quiet') ?? 10);
  if (flag('--one')) { let ok = false; try { ok = await one(flag('--one')!, seed, play, quiet, has('--raw'), has('--verbose'), has('--own-clock')); } catch (e: any) { console.log(`- FAIL — ${flag('--one')}: threw — ${String(e?.stack ?? e).split('\n').slice(0, 3).join(' / ')}`); } process.exit(ok ? 0 : 1); }
  process.exit(await restartFresh({ missions: flag('--missions')?.split(','), seed, play, quiet, raw: has('--raw'), verbose: has('--verbose'), ownClock: has('--own-clock') }) ? 0 : 1);
}
