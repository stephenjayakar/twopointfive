// LESSON-RUN: a scripted player through a Training level (game/lesson.ts), headless. For each step of the level's `scenarios.lesson` block, in order:
//   1. half a second of doing nothing — the step must still be up ("the line moves on when the thing is done, not on a timer")
//   2. the level's script for that step (tools/qa/lessons/<name>.ts `steps[<id>]`): what a player would do, through the INPUT only — movement keys toward a
//      nav path, one-frame key presses, the cursor, clicks, the wheel
//   3. half a second more, and the step must have gone by (FAIL names it and says what the lesson saw)
// then the script's `finish` plays the mission out and the run must END (`ended`, default: the mission's stage is 'done').
//
//   bun run tools/qa/lesson-run.ts <name> [--seed N] [--unseen] [--god] [--plain] [--verbose] [--digest] [--nolesson] [--pace N]
//     --unseen     his light meter pinned at 0.05 (default: fed every frame from the CPU's estimate of the light on him — guards.ts lightEstimateAt — so the
//                  floor's own lamps decide what the shift sees and what a `meter` test reads)
//     --god        rounds do not drop him
//     --plain      neither, whatever the script's own `mode` asks for
//     --digest     print one word folded from game/digest.ts's digest of every half second
//     --pace N     N seconds of reading before each step's deed (a person, not a script: the floor goes on meanwhile — lesson-gate plays one such run on the shipped stand)
//     --nolesson   the switch off: the SAME keys with no lesson (nothing asserted about steps) — its --digest must equal the lesson-on run's
//     --moon       the MOON on his meter too: the CPU's estimate leaves it out (guards.ts lightEstimateAt), so a mark in the open yard read 0 here and 56 % on the
//                  page (a player's tape, 10-13: the scripted run went by unseen where he was spotted). One ray up the moon's own direction from his chest and his
//                  head; unshadowed it adds the moon's direct light (0.54 on the meter, the page's 0.56 less its bounce). A script asks for it with `mode.moon`
//     --sky        THE SKY'S LIGHT ON EVERY METER: --moon for his own, and the same sum (the CPU's estimate where the man is — an authored hour's sun and
//                  sky are in it — plus the night's moon where nothing solid is up its direction) for every man an AI eye looks at and every man's own.
//                  And THE NIGHT SKY'S OWN LIGHT where a point has open sky (about 0.08 W/m2 in the open, LIGHT 20; --noglow = the moon alone).
//                  ON BY DEFAULT FOR A TUTORIAL MISSION (--nosky, or the script's `mode.sky: false` with why). Still not the page's: no bounce (a lane the page's meter calls lit by bounce reads dark here: --floor), no bodies' shadows,
//                  no smoke between a light and a man
//     --floor N    his meter never under N (0‥1): the bounce neither estimate has — a moon shadow in the open yard read 0.16 on the page, the walled wood store 0 to 0.06
//                  (and every other meter with it — a unit's own, a body's: a partner reads the light on himself, and on the page that is the renderer's.
//                  Give it what a GPU showed)
//     --hard       the level's name set to hard before the game is stood up (game/difficulty.ts setDifficulty: what the page's ?difficulty=hard does on a lesson)
//   exit 0 = every step went by on its deed and the run ended · 1 = a step did not / moved on by itself / the run did not end · 2 = no such level or script
//
// A SCRIPT (tools/qa/lessons/<name>.ts) exports
//   query: string                              what the page's URL would carry besides levelFile: '?quiet', '?quiet&squad=1', '?roomclear=1&squad=2' …
//   steps: Record<stepId, (B: Bot) => void>    one per step of the block, by id. A script NEVER reads g.lesson (the --nolesson arm must press the same keys)
//   finish?(B: Bot): void                      after the last step: on to the mission's end
//   ended?(g): boolean                         the run is over (default g.mission.stage === 'done')
//   idleOk?: string[]                          step ids that may already be true when they come up (said why in the script)
//   fightOk?: string[]                         step ids a fight on the floor may finish before the player does (a line inside a live fight: the room can fall
//                                              while it is up, or before it comes up; said why in the script). Such a step is logged as gone by with the fight
//   mode?: { unseen?: boolean; god?: boolean; moon?: boolean; sky?: boolean; glow?: boolean; floor?: number }   the arm this lesson's run needs when no flag says otherwise (said why in the script; --plain overrides unseen / god; --floor N overrides floor)
//   raises?: Record<string, string>   words raised for this lesson's run alone on the frozen stand, put back after it (a switch the level's one way on rides on)
//                                       (PT_DESTR: '1' among them raises the destruction's one switch for the run, which no stand word reaches)
//   pageKit?: boolean                 the run wears what the mission's own page deals him (kit.ts kitIssuedPage, then the solo card as main.ts deals it after
//                                     the start): for a mission whose lines lean on its own card. Without it he is the Player as built, on either stand
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { standUp } from './headless';
import type { Vec3 } from '../../src/math/vec';

const ROOT = resolve(import.meta.dir, '../..'), DT = 1 / 60;
const argv = process.argv.slice(2), has = (f: string) => argv.includes(f), flag = (f: string) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };
const PACE = Math.max(0, Number(flag('--pace') ?? 0) || 0);   // seconds a reader spends on each line before he acts (0 = the scripted player's own half second)
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: ArrayLike<number>) => `(${p[0].toFixed(1)}, ${p[2].toFixed(1)})`;
function seeded(a: number) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/** the scripted player's hands: everything goes in through the input */
export interface Bot {
  g: any; I: any; W: any; cam: any;
  t(): number; pos(): number[];
  /** n frames (default 1) with the movement keys toward the current goal */
  step(n?: number): void;
  wait(secs: number): void;
  /** step until `pred` (true) or `secs` pass (false) */
  until(pred: () => boolean, secs: number): boolean;
  /** one-frame press of a key code ('KeyC', 'Space', 'Digit2' …) and that frame stepped */
  press(code: string, after?: number): void;
  /** keys held for `secs` (movement keys are the walk's own: use go / nudge) */
  hold(codes: string[], secs: number, stop?: () => boolean): void;
  /** the cursor on a world point */
  aim(p: number[]): void;
  /** a one-frame mouse click: 1 = left, 2 = right */
  click(button?: 1 | 2, at?: number[]): void;
  /** wheel notches: +1 = one notch slower pace, −1 = faster */
  wheel(notches: number): void;
  /** walk the nav path to p (opening shut doors on the way: push, or `door` verb); false = did not get there in `max` s. `sprint` holds Shift */
  go(p: number[], max?: number, o?: { stop?: () => boolean; sprint?: boolean; doorVerb?: string; near?: number; noDoors?: boolean }): boolean;
  /** walk straight at p for up to secs, no path */
  nudge(p: number[], secs: number, stop?: () => boolean): void;
  /** make sure he is / is not crouched (C is a press) */
  crouch(on: boolean): void;
  /** the row of `kind` with `verb` among the nearby interactables: highlight it and tap Space. False = no such row came up within a second */
  verb(kind: string, verb: string, aimAt?: number[]): boolean;
  /** open a shut door from where he stands (walks to it first): 'push' unless told */
  openDoor(name: string, verb?: string): boolean;
  door(name: string): any;
  say(s: string): void;
  /** (asserted by the script itself) */
  fail(why: string): never;
}

if (import.meta.main) {
  const name = argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--seed' && argv[i - 1] !== '--cap' && argv[i - 1] !== '--pace' && argv[i - 1] !== '--floor');
  if (name && process.env.TPS_PROFILE !== 'shipped' && process.env.TPS_RAILS !== '1' && tutorial(resolve(ROOT, 'levels', `${name.replace(/\.json$/, '')}.json`))) {   // (a tutorial mission: the same run, as the page stands it)
    console.log(`${name}: a tutorial mission, run as the page opens it (the shipped stand)`);
    const r = Bun.spawnSync(['bun', 'run', import.meta.path, ...argv], { env: { ...process.env, TPS_PROFILE: 'shipped' }, stdout: 'inherit', stderr: 'inherit' }); process.exit(r.exitCode ?? 1);
  }
  const floorArg = (): number => { const v = Number(flag('--floor')); if (!(v >= 0 && v <= 1)) { console.error(`lesson-run: --floor wants a number from 0 to 1 (0 = no floor), got '${flag('--floor')}'`); process.exit(2); } return v; };
  if (!name) { console.error('usage: bun run tools/qa/lesson-run.ts <name> [--seed N] [--cap SECS] [--plain] [--unseen] [--god] [--verbose] [--digest] [--nolesson]'); process.exit(2); }
  const r = await runLesson(name.replace(/\.json$/, ''), { seed: Number(flag('--seed') ?? 1), unseen: has('--unseen'), god: has('--god'), plain: has('--plain'), verbose: has('--verbose'), digest: has('--digest'), lesson: !has('--nolesson'), moon: has('--moon'), sky: has('--sky') ? true : has('--nosky') ? false : undefined, glow: has('--noglow') ? false : undefined, hard: has('--hard'), floor: has('--floor') ? floorArg() : undefined });
  for (const l of r.lines) console.log(l);
  console.log(r.code === 0 ? `\n=== lesson-run ${name}: ALL PASS ===` : r.code === 2 ? `\n=== lesson-run ${name}: NO VERDICT (${r.why}) ===` : `\n=== lesson-run ${name}: FAIL — ${r.why} ===`);
  process.exit(r.code);
}

/** a level whose lesson carries a `rails` record */
function tutorial(file: string): boolean { try { return /"rails"\s*:/.test(readFileSync(file, 'utf8')); } catch { return false; } }

export interface LessonRunOpts { seed?: number; unseen?: boolean; god?: boolean; plain?: boolean; verbose?: boolean; digest?: boolean; lesson?: boolean; moon?: boolean; /** the sky's light on EVERY meter (the head: --sky) */ sky?: boolean; /** false: --sky without the night sky's own light, the moon alone (--noglow) */ glow?: boolean; hard?: boolean; floor?: number }
export interface LessonRunOut { code: 0 | 1 | 2; why: string; lines: string[]; digest?: string; steps: { id: string; t: number }[]; secs: number }

/** A scripted player may name the words its level cannot be played without on the frozen stand (`raises`, e.g. a switch its one door row rides on). They are
 *  raised for that run alone and put back after it: said at the script's own import they stayed up for every row the same process played next */
export async function runLesson(name: string, o: LessonRunOpts = {}): Promise<LessonRunOut> {
  const scriptFile = resolve(import.meta.dir, 'lessons', `${name}.ts`), up: string[] = [];
  if (existsSync(scriptFile) && process.env.TPS_PROFILE !== 'shipped') for (const [k, v] of Object.entries(((await import(scriptFile)).raises ?? {}) as Record<string, string>)) if (process.env[k] === undefined) { process.env[k] = v; up.push(k); }
  // (…and THE ONE SWITCH of the destruction goal is no word of the stand's: playthrough.ts raises it only as the program itself. A lesson that cannot be
  //  played without it — a wall charge the squad is ordered to set — names PT_DESTR in its `raises`, and it is raised here, before the level loads, with the
  //  page's chaos once the game stands, and put back)
  const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`), destr = DESTRUCTION.on, loud = process.env.PT_DESTR === '1' /* (the script's `raises`, or a hand's) */; if (loud) DESTRUCTION.on = true;
  try { return await playLesson(name, o, loud); } finally { for (const k of up) delete process.env[k]; DESTRUCTION.on = destr; }
}
/** A mission whose lines lean on its own card is played wearing what its page deals (`pageKit` in the scripted player's file). The page's kit and the solo
 *  card's flag (kitSoloIf raises KIT_SOLO.on) are module state every later game in this process would wear: both are put back after the run */
async function playLesson(name: string, o: LessonRunOpts = {}, loud = false): Promise<LessonRunOut> {
  const scriptFile = resolve(import.meta.dir, 'lessons', `${name}.ts`), K = existsSync(scriptFile) && (await import(scriptFile)).pageKit === true ? await import(`${ROOT}/src/game/kit.ts`) : null;
  const solo = K?.KIT_SOLO.on; K?.kitIssuedPage(true);
  try { return await playLessonAs(name, o, loud); } finally { if (K) { K.kitIssuedPage(false); K.KIT_SOLO.on = !!solo; } }
}
async function playLessonAs(name: string, o: LessonRunOpts = {}, loud = false): Promise<LessonRunOut> {
  const lines: string[] = [], out: LessonRunOut = { code: 0, why: '', lines, steps: [], secs: 0 };
  const file = resolve(ROOT, 'levels', `${name}.json`), scriptFile = resolve(import.meta.dir, 'lessons', `${name}.ts`);
  if (!existsSync(file)) return { ...out, code: 2, why: `no levels/${name}.json` };
  if (!existsSync(scriptFile)) return { ...out, code: 2, why: `no tools/qa/lessons/${name}.ts` };
  const script = await import(scriptFile);
  if (script.mode && !o.plain) o = { ...o, unseen: o.unseen || !!script.mode.unseen, god: o.god || !!script.mode.god };
  if (script.mode?.moon) o = { ...o, moon: true };
  // THE SKY'S LIGHT ON EVERY METER (--sky; the head). The CPU's estimate has an authored hour's sun and sky (hours.ts hourLight) and NOTHING OF THE NIGHT'S
  // MOON (guards.ts lightEstimateAt skips directional lights), and the page's meter has both: a scripted run by night played a darker floor than the page
  // shows — and by day too when its stand did not apply the row's hour (lesson-gate's frozen arm, mended there) — and its ALL PASS did not speak for
  // what a player sees (a squad that never saw what the page's shot; a partner who followed down a lane the page's meter called lit). ON for a tutorial
  // mission unless its script says `mode.sky: false` and why, or --nosky; a Training row asks for it (`mode.sky`, --sky). --moon is then on too.
  const sky = o.sky ?? script.mode?.sky ?? tutorial(file); if (sky) o = { ...o, moon: true };
  if (script.mode?.glow === false && o.glow === undefined) o = { ...o, glow: false };   // (a mission whose own claim about a dark place does not stand under the night sky's light yet: said why in its script)
  if (script.mode?.floor && o.floor === undefined) o = { ...o, floor: script.mode.floor };   // (--floor 0 on the command line = the run as it was, no floor)
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  // A TUTORIAL MISSION IS THE PAGE'S (a lesson with a `rails` record — src/game/rails.ts): it teaches the rules the page opens with, the frame among them, and
  // with the frame off its level has no lesson at all. The stand is set as this process starts, so the command line runs such a level again on the shipped
  // stand (the entry above) and a caller that asks for one on the frozen stand is told to. A run that raises the frame itself on the frozen stand (TPS_RAILS=1,
  // as lesson-gate does for a mission whose rules that stand has) is left on it.
  if (tutorial(file) && process.env.TPS_PROFILE !== 'shipped' && process.env.TPS_RAILS !== '1') return { ...out, code: 2, why: 'a tutorial mission is the page\'s: run it under TPS_PROFILE=shipped' };
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { lightEstimateAt } = await import(`${ROOT}/src/game/guards.ts`);
  const { isHourSun, hourOf } = await import(`${ROOT}/src/game/hours.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { digestGame } = await import(`${ROOT}/src/game/digest.ts`);
  const { LESSON, checkLesson } = await import(`${ROOT}/src/game/lesson.ts`);
  const log = console.log, err = console.error, warn = console.warn;
  const hush = () => { if (!o.verbose) console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };
  const lessonOn = o.lesson !== false; LESSON.on = lessonOn;
  const seed = o.seed ?? 1;
  Math.random = seeded(0x9137 + seed * 7919);
  if (o.hard) (await import(`${ROOT}/src/game/difficulty.ts`)).setDifficulty('hard', false);
  hush();
  let W: any;
  try { W = await standUp({ uploadEvery: 4, level: loadLevel(parseLevelData(readFileSync(file, 'utf8'))), seed }); } finally { unhush(); }
  const g = W.game, I = W.input, cam = W.cam;
  g.godMode = !!o.god; if (loud) g.tune.chaos = 0.5;   // (…and with the switch, the page's chaos: the harness stands a frozen game up at 0, where nothing breaks)
  hush(); const started = startFromQuery(g, `?levelFile=${name}.json&${String(script.query ?? '?quiet').replace(/^\?/, '')}`); unhush();
  if (!started.spec || started.why) return { ...out, code: 1, why: `the mission did not start: ${started.why ?? 'the script\'s query names no scenario'}` };
  if (script.pageKit === true) (await import(`${ROOT}/src/game/kit.ts`)).kitSoloIf(g, false);   // (main.ts, straight after the page's start: a quiet mission alone wears its card)
  const L = g.level.scenarios?.lesson;
  if (!L) return { ...out, code: 2, why: 'the level carries no scenarios.lesson block' };
  { const faults = checkLesson(g); if (faults.length) return { ...out, code: 1, why: `lesson-check: ${faults.join(' · ')}` }; }
  for (const T of L.steps) if (typeof script.steps?.[T.id] !== 'function') return { ...out, code: 2, why: `the script has no steps['${T.id}']` };

  let t = 0, goal: number[] | null = null, sprint = false, fold = 0x811c9dc5, frames = 0;
  const held = new Set<string>();
  const was = new Map<any, string>(); let downSaid = false, downT = 0;
  const say = (s: string) => { lines.push(`${t.toFixed(1).padStart(6)}  ${s}`); };
  class Stop extends Error { }
  const eyeOf = (c: any): Vec3 => c.bones?.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]], chestOf = (c: any): Vec3 => c.bones?.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
  const pos = (): number[] => g.player.char.pos;
  /** the moon's direct light on a point (--moon): nothing solid up its own direction, and the meter's best face of it */
  const moon = o.moon ? g.engine.lights.lights.find((l: any) => l.kind === 2 && l.enabled && l.intensity > 0 && !isHourSun(g, l)) : null;   // (an hour's own sun is in the estimate already: hours.ts hourLight — added here too it lit a midday man twice)
  const moonAt = (P: Vec3): number => { if (!moon) return 0; const d = moon.dir, c = moon.color;
    return g.col.segmentBlocked(P, [P[0] - d[0] * 60, P[1] - d[1] * 60, P[2] - d[2] * 60]) ? 0 : (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * moon.intensity * Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2])); };
  /** THE NIGHT SKY'S OWN LIGHT on a point (--sky; --noglow takes it out): what the page's meter has under open sky with the moon behind a wall, through its
   *  bounce cache — a level's open moon shadow read LIGHT 8 to 16 on the page at the presets a player uses, and 0 here, so a man the page's guards could
   *  see stood unseen in every run. By the sky's own numbers (common.wgsl skyRadiance: the zenith's colour from 24 degrees up, read live — a weather greys
   *  it): pi times its luminance on a face that looks up, times how much of the sky the point has — five rays against the statics and the leaves, the
   *  zenith's cap (a quarter of an up face's light) and four at 60 degrees off it (three sixteenths each). About 0.08 W/m2 in the open, 0.05 in a lane
   *  between two walls (the page there: 0.044 to 0.05), nothing under a roof. Nothing by day: an authored hour's sky is in the estimate (hours.ts hourLight).
   *  STILL NOT IN IT: the moon's bounce off lit ground into a shadow beside it (the page's low wall, 0.1), which is what --floor is for */
  const GLOW: [number, number, number, number][] = [[0, 1, 0, 0.25], ...[0, 1, 2, 3].map((k): [number, number, number, number] => [Math.cos(k * Math.PI / 2 + 0.6) * 0.866, 0.5, Math.sin(k * Math.PI / 2 + 0.6) * 0.866, 0.1875])];
  const glowAt = (P: Vec3): number => { if (!sky || o.glow === false || hourOf(g) !== 'night') return 0; const z = g.engine.settings.skyZenith; if (!z) return 0;
    let open = 0; for (const [x, y, zz, w] of GLOW) if (!g.col.segmentBlocked(P, [P[0] + x * 60, P[1] + y * 60, P[2] + zz * 60])) open += w;
    return Math.PI * (0.2126 * z[0] + 0.7152 * z[1] + 0.0722 * z[2]) * open; };
  // EVERY OTHER MAN'S METER, BY THE SAME ARITHMETIC AS THE PLAYER'S BELOW (--sky, --floor): each unit's own, a body's, a held man's, a civilian's (every probe
  // key but the player's, which is fed below, and a search light's). On the page those are the renderer's, sky and bounce and all (guards.ts meterOf), and a
  // partner reads his own before he sets off for a man's back (sneak.ts stalkAmbient); here they were the CPU's estimate, with no moon or sun and no bounce
  // in it — a mission whose partner hung back on a real GPU (lit, and a man had a line) went by on every seed. The probe's answer is stood in for: the
  // estimate where it was asked about (as guards.ts falls back to it: an authored hour's sun and sky are in it), plus the moon with --sky, never under the
  // floor with --floor. ONE hook and
  // one sum for him and for them: two models of one floor would let a man be lit to the squad and dark to himself.
  if (sky || o.floor) { const asked = new Map<string, Vec3>(), q0 = g.lightQuery.bind(g), a0 = g.lightAt.bind(g), f0 = g.lightForget.bind(g), Ef = o.floor ? g.tune.visFloor * Math.exp(o.floor / g.tune.visSlope) : 0;
    const mine = (k: string) => !k.startsWith('player') && !k.startsWith('srch:');
    g.lightQuery = (k: string, p: Vec3, skip?: number) => { if (mine(k)) asked.set(k, [p[0], p[1], p[2]]); q0(k, p, skip); };
    g.lightAt = (k: string) => { const p = mine(k) ? asked.get(k) : undefined; return p ? Math.max(Ef, lightEstimateAt(g, p) + (sky ? moonAt(p) + glowAt(p) : 0)) : a0(k); };   // (--nosky with a floor: the floor alone)
    g.lightForget = (k: string) => { asked.delete(k); f0(k); }; }
  const cap = Number(flag('--cap') ?? 600);
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
      const P = g.player;
      if (goal && !P.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
        if (d > 0.1) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
      if (sprint && goal) I.keys.add('ShiftLeft'); else if (!held.has('ShiftLeft')) I.keys.delete('ShiftLeft');
      for (const k of held) I.keys.add(k);
      { const c = P.char, own = (id: number) => id === PLAYER_ID; P.visibility = o.unseen ? 0.05 : Math.max(o.floor ?? 0, g.visibilityOf(Math.max(lightEstimateAt(g, chestOf(c), own) + moonAt(chestOf(c)) + glowAt(chestOf(c)), lightEstimateAt(g, eyeOf(c), own) + moonAt(eyeOf(c)) + glowAt(eyeOf(c))))); }
      W.step(DT); t += DT; frames++;
      for (const x of [g.player, ...g.guards]) { const p = x.char.pos; if (!Number.isFinite(p[0] + p[1] + p[2])) throw new Error(`NaN position on ${x.callsign ?? 'the player'}`); }
      for (const x of g.guards) { const st = x.state, w = was.get(x); if (w !== st) { was.set(x, st); if (w !== undefined) say(`   ${x.callsign ?? 'a man'}: ${w} → ${st} at ${at(x.char.pos)} (player at ${at(pos())}, lit ${g.player.visibility.toFixed(2)})`); } }
      if (g.player.down && !downSaid) { downSaid = true; say(`   !! the player is down at ${at(pos())}`); }
      if (g.player.down && (downT += DT) > 2) throw new Stop(`the player went down at ${at(pos())} (mission stage ${g.mission.stage})`);
      if (o.digest && frames % 30 === 0) { const s = JSON.stringify(digestGame(g, true)); for (let k = 0; k < s.length; k++) { fold ^= s.charCodeAt(k); fold = Math.imul(fold, 0x01000193); } }
      if (t >= cap) throw new Stop(`time cap (${cap} s) at ${at(pos())}, mission stage ${g.mission.stage}`);
    }
  }
  const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
  const aim = (p: number[]) => { W.cursorAt([p[0], p[1], p[2]]); };
  const door = (nm: string) => { const d = g.doors.byName(nm); if (!d) throw new Stop(`the script names a door '${nm}' the level does not have`); return d; };
  const free = (p: number[]): number[] => { const nav = g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; };
  /** the first shut door a path crosses (solo-night.ts's test: a leg of the path crosses the leaf's line, jamb to jamb) */
  const doorOnPath = (path: number[][]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
      for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
        const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
        const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
      if (best) return best; a = b; } return null; };
  function verb(kind: string, v: string, aimAt?: number[]): boolean {
    for (let i = 0; i < 60; i++) { if (aimAt) aim(aimAt); step();
      if (g.nearby.some((r: any) => r.kind === kind && r.verb === v) && g.selectVerb(kind, v)) { I.pressed.add('Space'); step(2); say(`  Space: ${kind} ▸ ${v}`); return true; } }
    say(`  no '${kind} ▸ ${v}' row (rows: ${g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`); return false;
  }
  function openDoor(nm: string, v = 'push'): boolean {
    const d = door(nm); if (!d.isClosed()) return true;
    const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
    walk(free([c[0] + nx * s * 0.95, 0, c[2] + nz * s * 0.95]), 25, { stop: () => !d.isClosed(), noDoors: true }); if (!d.isClosed()) return true;
    if (!verb('door', v, [c[0], 1.0, c[2]])) return false;
    until(() => !d.isClosed(), 6); step(20); return !d.isClosed();
  }
  function walk(p: number[], max: number, w: { stop?: () => boolean; sprint?: boolean; doorVerb?: string; near?: number; noDoors?: boolean } = {}, again = 0): boolean {
    const path: number[][] = g.col.nav.findPath(pos(), p, 8000) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
    if (!w.noDoors) { const d = doorOnPath(path); if (d && flat(pos(), d.frameCentre) < 40) { const was = sprint; sprint = false; const ok = openDoor(d.def.name, w.doorVerb ?? 'push'); sprint = was; if (!ok) { say(`  door ${d.def.name} would not open`); return false; } return walk(p, max, w, again); } }
    const t0 = t; let mark = [...pos()], markT = t; sprint = !!w.sprint;
    try {
      for (const wp of path) { goal = [wp[0], 0, wp[2]];
        while (flat(pos(), wp) > (wp === path[path.length - 1] ? (w.near ?? 0.3) : 0.55)) {
          aim([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max) return false; if (w.stop && w.stop()) return false;
          if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.5) {
            if (again >= 5) { say(`  stuck at ${at(pos())} short of ${at(wp)}`); return false; }
            const dx = wp[0] - pos()[0], dz = wp[2] - pos()[2], Ln = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, r = 0.9 + 0.25 * again;
            goal = [pos()[0] + dz / Ln * sd * r, 0, pos()[2] - dx / Ln * sd * r]; step(35);
            return walk(p, max - (t - t0), w, again + 1); } } }
      return true;
    } finally { goal = null; sprint = false; }
  }
  const B: Bot = {
    g, I, W, cam, t: () => t, pos, step, until, aim, verb, openDoor, door, say,
    wait: (secs) => step(Math.round(secs * 60)),
    press: (code, after = 1) => { I.pressed.add(code); step(1 + after); },
    hold: (codes, secs, stop) => { for (const c of codes) held.add(c); try { for (let i = 0; i < secs * 60; i++) { step(); if (stop && stop()) break; } } finally { for (const c of codes) { held.delete(c); I.keys.delete(c); } } },
    click: (button = 1, p) => { if (p) { aim(p); step(); if (p) aim(p); } I.clicked |= button === 2 ? 4 : 1; step(2); },   // (Input's bits: 1 left · 2 middle · 4 right)
    wheel: (n) => { for (let i = 0; i < Math.abs(n); i++) { I.wheel += Math.sign(n) * 100; step(2); } },
    go: (p, max = 40, w = {}) => walk(free(p), max, w),
    nudge: (p, secs, stop) => { goal = [p[0], 0, p[2]]; try { for (let i = 0; i < secs * 60; i++) { aim([p[0], 1.1, p[2]]); step(); if (stop && stop()) break; } } finally { goal = null; } },
    crouch: (on) => { for (let i = 0; i < 3 && !!g.player.crouch !== on; i++) { I.pressed.add('KeyC'); step(4); } },
    fail: (why) => { throw new Stop(why); },
  };

  const idleOk = new Set<string>(script.idleOk ?? []), fightOk = new Set<string>(script.fightOk ?? []);
  // (two gears — player.ts TWOGEARS — gives the wheel to nobody, so a step that asks for a pace has nothing to ask for and goes by, as lesson.ts says: it is run all the same)
  if ((await import(`${ROOT}/src/game/player.ts`)).TWOGEARS.on) for (const T of L.steps) if (T.done?.is === 'pace') idleOk.add(T.id);
  try {
    step(20);   // the start's first frames (poses, the deal's lines)
    for (let i = 0; i < L.steps.length; i++) {
      const T = L.steps[i];
      const byFight = () => { say(`step ${i + 1}/${L.steps.length} '${T.id}' went by with the fight`); out.steps.push({ id: T.id, t: Number(t.toFixed(2)) }); };
      if (lessonOn && g.lesson.i > i && fightOk.has(T.id)) { byFight(); continue; }
      // (a step whose honest alternative an earlier deed already made true may have GONE BY when its turn comes — `idleOk`: its half second, its reader's pause and
      //  its script are run all the same, frame for frame as the arm with no lesson runs them)
      const gone = lessonOn && g.lesson.i > i && idleOk.has(T.id);
      if (lessonOn && !gone && g.lesson.i !== i) throw new Stop(`step ${i + 1} '${T.id}' is not the step that is up (the lesson is on ${g.lesson.i + 1}: ${g.lesson.summary()})`);
      step(30);   // half a second of nothing: the line must not move on by itself
      if (lessonOn && g.lesson.i !== i && fightOk.has(T.id)) { byFight(); continue; }
      if (lessonOn && g.lesson.i !== i && !idleOk.has(T.id)) throw new Stop(`step ${i + 1} '${T.id}' went by with nothing done (its test was already true when it came up)`);
      if (PACE > 0) step(Math.round(PACE * 60));   // --pace: a reader's seconds on the line (a step that only WAITS for the floor may well go by while he reads: its script then finds its wait already over)
      say(`step ${i + 1}/${L.steps.length} '${T.id}': ${g.lesson.objective()?.text.split(' ▸ ')[1] ?? T.line}${gone ? ' (it had already gone by: idleOk)' : ''}`);   // (the line as the row reads it: a step may carry another for the keys as they stand)
      script.steps[T.id](B);
      step(30);   // (the same half second in both arms — a step with a `hold` longer than that waits in its own script)
      if (lessonOn && g.lesson.i <= i) throw new Stop(`step ${i + 1} '${T.id}' did not go by after its script (player at ${at(pos())}, stage ${g.mission.stage}; test ${JSON.stringify(T.done)})`);
      out.steps.push({ id: T.id, t: Number(t.toFixed(2)) });
      if (g.player.down) throw new Stop(`the player went down in step '${T.id}'`);
    }
    if (lessonOn && !g.lesson.finished) throw new Stop('the lesson does not say it is finished after its last step');
    if (lessonOn && g.lesson.objective()) throw new Stop('the lesson still holds the objective row after its last step');
    say('every step done; playing the mission out');
    const ended = script.ended ?? ((gg: any) => gg.mission.stage === 'done');
    if (!ended(g)) script.finish?.(B);
    if (!until(() => ended(g), 5)) throw new Stop(`the run did not end after the script's finish (stage ${g.mission.stage}, player at ${at(pos())}${g.player.down ? ', DOWN' : ''})`);
    say(`ended: ${g.objectiveText()}`);
  } catch (e) {
    unhush();
    if (!(e instanceof Stop)) { out.code = 1; out.why = `threw: ${(e as Error).stack ?? e}`; }
    else { out.code = 1; out.why = e.message; }
    if (lessonOn) lines.push(...(g.lesson.log as string[]).slice(-6).map(l => `   lesson log: ${l}`));
  }
  out.secs = Number(t.toFixed(1));
  if (o.digest) { out.digest = (fold >>> 0).toString(16).padStart(8, '0'); lines.push(`digest ${out.digest} over ${frames} frames (${lessonOn ? 'lesson on' : 'lesson OFF'})`); }
  lines.push(`${name}: ${out.steps.length}/${L.steps.length} steps · ${out.secs} s of play · ${o.unseen ? 'meter pinned (unseen)' : `meter fed from the floor\'s lights${o.moon ? ' and the moon' : ''}`}${sky ? ` · the sky\'s light on every man\'s meter${o.glow === false ? ' (the moon alone)' : ''}` : ''}${o.floor ? ` · never under ${o.floor}` : ''}${o.hard ? ' · hard' : ''}${o.god ? ' · god mode' : ''} · seed ${seed}`);
  return out;
}
