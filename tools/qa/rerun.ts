// A REPLAY RE-RUN: a headless game walked through the same run a replay was saved from, up to a chosen step, off the replay's RUN TAPE (src/game/runtape.ts —
// the recipe, then per step its dt, the player's input and camera, the values the game read off the GPU, what was done to it from outside a step). Used by
// `bun run tools/qa/replay-at.ts <file> --rerun` and importable by a probe:   const R = await rerun(file, { toN });  R.W.game is the live game at that step.
// IT MEASURES ITSELF: wherever the replay's TRACE has a sample on a step the re-run passes, every man's place is compared with where the page had him; the report
// says how far apart they were at worst and from which moment they parted (`drift`). An exact re-run reads 0.00 m. A re-run that parted from the page is still a
// game in a state — its own — and the report says so instead of passing it off as what was on the screen.
// THE STAND: the game is stood as the tape's game stood — the page's rules for a tape made on the page (src/host/profile.ts shippedBoot + pageSwitches for its query),
// the tool's own stand for one made headless — and then given the tape's own knob tables (the whole registry) and kit cards. ONE RE-RUN AT A TIME, and the process
// is LEFT on the tape's tables and kit (the live game handed back goes on reading them): stand nothing else in it afterwards and expect this process's own stand.
// REFUSED, in words (`refuse`): a replay with no tape (saved before the tape existed, or its tape ended — a scenario switched from a menu, a checkpoint loaded,
// a session past the tape's length), and a level that is not this checkout's (the fingerprint differs: the words name the commit to check out).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Headless } from './headless.ts';   // (the harness itself is imported inside rerun(), once the stand the tape was made on is known: it reads TPS_PROFILE as it loads)
import type { ReplayFile, RunTape, Decoded } from '../../src/replay/format.ts';
import { decode, clock, tapeShield, TAPE_SHIELD } from '../../src/replay/format.ts';
import { TapeWalk } from '../../src/replay/tapewalk.ts';

const ROOT = resolve(import.meta.dir, '../..');

export interface Drift { r: number; n: number; who: string; metres: number; }
export interface RerunReport {
  /** steps run, and the step asked for */
  ticks: number; toN: number;
  /** trace samples the re-run was held against, the worst a man stood from his traced place over them (and who, when), and the first sample one stood > `tol` off */
  compared: number; worst: Drift | null; drift: Drift | null; tol: number;
  /** men the trace has that the re-run does not (or the other way) at the last compared sample */
  castDiffers: string;
  /** sensor reads the re-run made that the page had not made on that step (served the key's last value) */
  unjournaled: number;
  /** a tape made with the senses on the CPU: the reads the re-run's game answered ITSELF, and how many of them were not the value the page's game had read */
  ownSenses: { on: boolean; reads: number; differ: number };
  /** what the stand-up had to say (a scenario that did not start, a build that differs) */
  warnings: string[];
}
export interface Rerun { W: Headless | null; refuse: string; report: RerunReport | null; D: Decoded; }

/** the level a page's `?levelFile=` names, as the page loads it (the look's file where it has one) */
export async function levelOf(file: string): Promise<any> {
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`), { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const L = await import(`${ROOT}/src/scene/level.ts`), look = await import(`${ROOT}/src/scene/look.ts`).catch(() => null);
  const named = resolve(ROOT, 'levels', file), lk = look?.lookLevelFile ? resolve(ROOT, 'levels', look.lookLevelFile(file)) : named;
  const data = parseLevelData(readFileSync(existsSync(lk) ? lk : named, 'utf8'));
  return L.isOfficeFamily?.(data) ? L.withOfficeScript(loadLevel(data)) : loadLevel(data);
}

/** walk a fresh headless game through the replay's run up to step `toN` (a sample's / a note's `n`; default: the replay's last sample). `each` is called after every step. */
export async function rerun(F: ReplayFile, opts: { toN?: number; tol?: number; each?: (W: Headless, f: number) => void; force?: boolean; served?: (v: number | undefined) => void } = {}): Promise<Rerun> {
  const D = decode(F), tol = opts.tol ?? 0.15, T = F.rerun;
  const out = (refuse: string): Rerun => ({ W: null, refuse, report: null, D });
  if (!T) return out('this replay has no run tape (it was saved by a build from before the tape): it reads as a trace — drop --rerun');
  if ('dead' in T) return out(`this replay's run tape ended at step ${T.tick}: ${T.dead}. It reads as a trace — drop --rerun`);
  if (!opts.force && tapeShield(T as RunTape)) return out(`${TAPE_SHIELD.replace(/^This/, 'this')}: it reads as a trace — drop --rerun`);
  const tape = T as RunTape, lastN = F.samples.length ? F.samples[F.samples.length - 1].n : tape.ticks, toN = Math.min(tape.ticks, Math.max(0, Math.round(opts.toN ?? lastN)));
  const J = await import(`${ROOT}/src/game/journal.ts`), K = await import(`${ROOT}/src/game/knobs.ts`), { levelFingerprint } = await import(`${ROOT}/src/game/savestate.ts`);
  const { startFromQuery, activeScenario } = await import(`${ROOT}/src/game/scenarioRun.ts`), { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
  const warnings: string[] = [], rc = tape.recipe as RunTape['recipe'] & { env: any; knobs: any };
  // ---- THE STAND the tape was made on: the real page plays the shipped rules, a headless tool the frozen ones unless it said TPS_PROFILE=shipped (src/host/profile.ts).
  // A page tape walked on the frozen stand parts on its first step (a room clear's fresh deal alone puts every defender on another mark), so the harness is
  // loaded and the game stood under the tape's own stand word and its other stand words (the harness reads them as it loads and as it stands), the page's boot
  // switches are written for the tape's query, then the tape's own tables and kit. A harness this process had ALREADY loaded on another stand is brought over only
  // as far as those tables reach: a tape that carries none says so in its report.
  const want = rc.stand ?? (F.userAgent ? 'page' : 'frozen'), need = want === 'frozen' ? 'frozen' : 'shipped', env = process.env;
  const loaded = typeof require !== 'undefined' && !!(require as unknown as { cache?: Record<string, unknown> }).cache?.[resolve(ROOT, 'tools/qa/headless.ts')], stoodAs = env.TPS_PROFILE === 'shipped' ? 'shipped' : 'frozen';
  const { STAND_ENV } = await import(`${ROOT}/src/host/standEnv.ts`), kept: Record<string, string | undefined> = { TPS_PROFILE: env.TPS_PROFILE };
  const setEnv = (k: string, v: string | undefined) => { if (v === undefined) delete env[k]; else env[k] = v; };
  setEnv('TPS_PROFILE', need === 'shipped' ? 'shipped' : undefined);
  if (rc.words) for (const w of STAND_ENV as string[]) if (w !== 'TPS_PROFILE' && w !== 'TPS_SEED') { kept[w] = env[w]; setEnv(w, rc.words[w]); }
  let W: Headless, level: any;
  // ---- every knob table as the tape's game had it — BEFORE the game is built (a constructor may read one), after the stand-up's own writes, and after the scenario
  // is staged (a staging writes tables itself: the difficulty of the level it stands on) — and the kit cards the staging deals
  const reg = K.knobsNamed() as Record<string, Record<string, unknown>>, plain = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
  /** K.assignDeep, but a null on the tape is written too (a knob that is `number | null`: the wall charges carried) — only for tapes that carry their own tables */
  const put = (dst: Record<string, unknown>, src: Record<string, unknown>) => { for (const k of Object.keys(src)) { if (!(k in dst)) continue; const a = dst[k], b = src[k];
    if (plain(a) && plain(b)) put(a, b); else if (typeof a === typeof b || a === null || b === null) dst[k] = b !== null && typeof b === 'object' ? JSON.parse(JSON.stringify(b)) : b; } };
  const RD = await import(`${ROOT}/src/scene/round.ts`);   // (a tape from before round things were round: the switch is read as the level is stood up)
  const CL = await import(`${ROOT}/src/game/carlamps.ts`);   // (a tape from before a vehicle's lamps were light targets: the switch is read as the Game is built)
  const tables = () => { const src = { ...(rc.knobs?.tables ?? {}), ...(rc.tables ?? {}) } as Record<string, unknown>, into = rc.tables ? reg : J.knobTables() as Record<string, Record<string, unknown>>;
    for (const [name, Tb] of Object.entries(into)) { const t = src[name]; if (plain(t)) { if (rc.tables) put(Tb, t); else K.assignDeep(Tb, t); } }
    if (!plain(src.EXACT)) (reg.EXACT as { on: boolean }).on = false;
    if (!plain(src.SENSE)) (reg.SENSE as { cpu: boolean }).cpu = false; if (!plain(src.CMDCHECK)) (reg.CMDCHECK as { on: boolean }).on = false; CL.carLampsTape(src); RD.roundTape(src); };   // (a tape from before the game's own maths: the engine's functions, said before the level and the game are built — as the page's player does, src/replay/engineplay.ts tables())
  const Kt = await import(`${ROOT}/src/game/kit.ts`);
  const kitOf = (k: unknown) => { const c = k as { on?: unknown; members?: unknown; own?: unknown; stealth?: unknown } | undefined; if (!c || !Array.isArray(c.members)) return;
    Kt.kitMission(null);   // (no mission's card stands first in the table while the tape's cards are written into it)
    Kt.kitOwn(c.own === true); Kt.KIT.on = c.on !== false; const cards = Array.from({ length: Kt.KIT_MEMBERS }, (_, i) => Kt.kitSanitize(i, (c.members as unknown[])[i])); Kt.KIT.members.length = 0; Kt.KIT.members.push(...cards);
    Kt.kitStealthSet(c.stealth); };   // (kit.ts KITDEAL.stealth: the stealth card the tape's run wore beside the loud one, or none — never this process's; as the page's player does, engineplay.ts kitOf)
  const RT = await import(`${ROOT}/src/game/runtape.ts`);
  // (A SNEAK LAB TAPE FROM BEFORE THE TAPE CARRIED WHERE THE PLAYER WAS PUT — the page's address has the lab's word and no 'pose' row is on it: the lab's page stood
  // him at its scenario's start at boot and after every restart, host/sneaklab.ts stage, and nothing of that was taped. Done here from the address's own scene, with
  // THIS checkout's lab (its scenarios and its staging: the level's fingerprint does not cover them); a scenario picked on the lab's panel later is not on such a
  // tape, and the men's buttons — a gap, a seat, the lamps — are on no tape)
  const labQ = new URLSearchParams(rc.search ?? ''), labOld = labQ.has('sneaklab') && !tape.x.some(r => r[1] === 'pose');
  const LAB = labOld ? await import(`${ROOT}/src/host/sneaklab.ts`) : null, labStage = () => { if (LAB) LAB.stage(g); };
  let g: Headless['game'], poses: { row(f: number, kind: string, data: unknown): boolean } | null = null;
  /** the tables and the game's tune just before and just after journal.ts applyKnobs (which, beside the tape's own keys, writes the older value of some keys a file lacks) */
  const knobsWere: unknown[] = [], knobShot = (): unknown => JSON.parse(JSON.stringify({ ...reg, tune: g.tune }));
  try {
    const { standUp } = await import('./headless.ts');
    if (need === 'shipped') { const P = await import(`${ROOT}/src/host/profile.ts`); P.shippedBoot(); if (want === 'page') P.pageSwitches(new URLSearchParams(rc.search ?? '')); }
    tables(); kitOf(rc.kit);
    { const { LESSON_MISSIONS: TRAINING_MISSIONS } = await import(`${ROOT}/src/scene/scenarioList.ts`); if (want === 'page') Kt.kitIssuedPage(false); Kt.kitLessonPage(want === 'page' ? TRAINING_MISSIONS.find((e: any) => e.level === rc.levelFile) ?? null : null); }   // (a Training level's page plays the issue kit whatever the cards are — all but a lesson he packs for, read at each staging with the rule as the tape's knobs leave it: kit.ts kitLessonPage; any other re-run names no page, also after one that did)
    if (want === 'page' && !rc.tables) warnings.push('this replay was saved before the tape carried every switch: the re-run plays the page\'s rules for its address, not what this browser kept (Team feel rows, a kit, a difficulty picked on the card)');
    if (loaded && stoodAs !== need && !rc.tables) warnings.push(`this process had already stood the harness as ${stoodAs} and the tape was made as ${want}, with no tables of its own on it: run it in a process of its own (replay-at.ts) to stand it right`);
    if (rc.levelFile) { try { level = await levelOf(rc.levelFile); } catch (e) { return out(`the replay's level file ${rc.levelFile} could not be loaded here: ${(e as Error).message}`); } }
    if (rc.seed === null) Math.random = mulberry32(0x7e9a);
    W = await standUp({ seed: rc.seed, env: rc.env, ...(level ? { level } : {}) });
    g = W.game;
    { const fpo = levelFingerprint(g) as any, fp = typeof fpo === 'string' ? fpo : fpo?.fp; if (F.level.fp && fp !== F.level.fp && !opts.force) return out(`the replay was saved on another level than this checkout's (${F.level.file ?? 'the office'}: fingerprint ${F.level.fp} there, ${fp} here)${F.commit ? `. Check out ${F.commit} (git worktree add ../at-replay ${F.commit}) and run this there` : ''}; --force walks it anyway`); }
    knobsWere.push(knobShot()); J.applyKnobs(g, rc.knobs); knobsWere.push(knobShot()); tables(); J.applyEnvGame(g, rc.env);
    if (rc.search && rc.search.length > 1) { const r = startFromQuery(g, rc.search); if (r.why) warnings.push(`the page's scenario did not start here: ${r.why}`); tables(); }
    if (LAB) { const n = Number(labQ.get('scene')); LAB.SNEAKLAB.scene = n >= 1 && n <= LAB.SCENES.length ? n - 1 : 0; labStage();
      { const back = g.restart.bind(g); g.restart = (said?: string) => { back(said); labStage(); }; }   // (a restart the run makes itself, Shift+Enter: wrapped as the lab's page wraps it)
      warnings.push(`a sneak lab replay from before the tape carried where the player was put: he is stood at the start of the address's scenario (${LAB.SCENES[LAB.SNEAKLAB.scene].name}) as THIS checkout's lab stages it, at the first step and after every restart${F.commit ? ` — the replay's own build is ${F.commit}` : ''}. A scenario picked on the lab's panel during the run is not on this tape`); }
    poses = RT.tapePoses(g);
  } finally { for (const [k, v] of Object.entries(kept)) setEnv(k, v); }
  // ---- a tape OLDER (or newer) than this build's knobs. tables() and applyKnobs write only the keys the tape has, so a key added to a table (or to Game.tune)
  // since the tape was saved is played at THIS build's value — and what such a key was 'before it existed' is its author's knowledge alone (journal.ts applyKnobs
  // keeps that for some keys of a recording's tables; nobody does for the rest: the Team feel rows, the room fit, the orders). Nothing in a tape can fill it in, so
  // it is SAID: every such key by name — apart from those applyKnobs was seen to write just now —, every key of the tape this build does not play (gone, renamed, or
  // of another kind here: put() passes those over), and the commit that walks the tape as recorded. Asked with the game stood and staged, which is where the tape
  // took its own tables
  { const { FROZEN_HOLDS } = await import(`${ROOT}/src/host/profile.ts`) as { FROZEN_HOLDS: Record<string, string> };
    const into = rc.tables ? reg : J.knobTables() as Record<string, Record<string, unknown>>, src = { ...(rc.knobs?.tables ?? {}), ...(rc.tables ?? {}) } as Record<string, unknown>;
    const live: Record<string, Record<string, unknown>> = { ...into, tune: g.tune as unknown as Record<string, unknown> }, tp: Record<string, unknown> = { ...src, tune: rc.knobs?.tune };
    const lacks: string[] = [], mended: string[] = [], odd: string[] = [], kind = (x: unknown) => Array.isArray(x) ? 'list' : x === null ? 'null' : typeof x;
    const at = (o: unknown, path: string[]) => path.reduce<unknown>((v, k) => plain(v) ? v[k] : undefined, o), wrote = (path: string[]) => JSON.stringify(at(knobsWere[0], path)) !== JSON.stringify(at(knobsWere[1], path));
    const walk = (path: string[], A: Record<string, unknown>, B: Record<string, unknown>, skip?: readonly string[]): void => {
      for (const k of Object.keys(A)) { const v = A[k], w = B[k], p = [...path, k]; if (v === undefined || typeof v === 'function' || skip?.includes(k)) continue;   // (JSON keeps neither: never on a tape)
        if (!Object.hasOwn(B, k)) (wrote(p) ? mended : lacks).push(p.join('.')); else if (plain(v) && plain(w)) walk(p, v, w);
        else if (!(typeof v === typeof w || v === null || w === null)) odd.push(`${p.join('.')} (a ${kind(w)} on the tape, a ${kind(v)} here)`); }
      for (const k of Object.keys(B)) if (!(k in A)) odd.push([...path, k].join('.')); };
    for (const [name, Tb] of Object.entries(live)) { const t = tp[name]; if (plain(t)) walk([name], Tb, t, (K.NOT_KNOBS as Record<string, readonly string[]>)[name]);
      else lacks.push(`${name} (the whole table${wrote([name]) ? '; journal.ts sets part of it for a file from before it' : ''})`); }
    for (const name of Object.keys(src)) if (!(name in into)) odd.push(`${name} (the whole table)`);
    lacks.sort((x, y) => +(y in FROZEN_HOLDS) - +(x in FROZEN_HOLDS));   // (the switches the two stands differ in — whole rules — ahead of their numbers)
    const some = (l: string[]) => `${l.slice(0, 40).join(', ')}${l.length > 40 ? ` and ${l.length - 40} more` : ''}`, n = (l: string[]) => `${l.length} knob${l.length === 1 ? '' : 's'}`, notes: string[] = [];
    if (lacks.length) notes.push(`this build has ${n(lacks)} the tape does not carry (${some(lacks)}): played here at THIS build's value — a re-run that parts from the page may be parting on exactly that.`);
    if (mended.length) notes.push(`${mended.length} more knob${mended.length === 1 ? '' : 's'} the tape does not carry ${mended.length === 1 ? 'was' : 'were'} given the value of a file from before ${mended.length === 1 ? 'it' : 'them'} by journal.ts (${some(mended)}).`);
    if (odd.length) notes.push(`the tape carries ${n(odd)} this build does not play (${some(odd)}): renamed, dropped or changed in kind between the tape's build and this checkout.`);
    if (notes.length && F.commit) notes[notes.length - 1] += ` To walk it as recorded: git worktree add ../at-replay ${F.commit}, and run this there.`;
    warnings.push(...notes); }
  if (activeScenario(g) !== rc.scenario) warnings.push(`the page had scenario ${rc.scenario ?? 'none'} up at its first step; this game has ${activeScenario(g) ?? 'none'}`);
  // ---- the tape's streams and the sensors served off it: src/replay/tapewalk.ts, the one walk this tool and the engine replay (src/replay/engineplay.ts) share
  const walk = new TapeWalk(tape, { cam: [W.cam.target[0], W.cam.target[1], W.cam.target[2], W.cam.yaw, W.cam.pitch, W.cam.distance, W.cam.aspect, W.cam.fov, W.cam.aimLead], mouse: [W.input.mouseX, W.input.mouseY] });
  walk.served = opts.served ?? null;
  // (a tape made with the senses on the CPU — src/game/sense.ts — needs none of its values: the game answers itself, from its seed and its inputs alone, and what the
  //  tape kept is only HELD AGAINST those answers — as f32, the tape's own width)
  const SENSE = reg.SENSE as { cpu?: boolean } | undefined, ownSenses = { on: !!SENSE?.cpu, reads: 0, differ: 0 };
  { const S = g.sensors, mine = S.read.bind(S);   // (asked of the switch at every read: a tape may move it between two steps)
    S.read = (key: string): number | undefined => { const t = walk.read(key); if (!SENSE?.cpu) return t;
      const v = mine(key); ownSenses.reads++; if (!Object.is(v === undefined ? v : Math.fround(v), t === undefined ? t : Math.fround(t))) ownSenses.differ++; return v; }; }
  const byN = new Map<number, number>(); F.samples.forEach((s, i) => byN.set(s.n, i));
  const idOf = new Map<number, number>(); F.cast.forEach((c, ci) => idOf.set(c.id, ci));
  let compared = 0, worst: Drift | null = null, drift: Drift | null = null, castDiffers = '';
  const placeOf = (ci: number): [number, number] | null => { const c = F.cast[ci]; if (c.kind === 'player') return [g.player.char.pos[0], g.player.char.pos[2]];
    const m = (c.kind === 'civ' ? g.civilians : g.guards).find((x: any) => x.char?.id === c.id) ?? [...g.guards, ...g.civilians].find((x: any) => x.char?.id === c.id); return m ? [m.char.pos[0], m.char.pos[2]] : null; };
  for (let f = 0; f < toN; f++) {
    // from outside the step, as the page did it
    for (const [, kind, data] of walk.outside()) {
      if (kind === 'restart') { g.restartEncounter(); labStage(); }
      else if (poses?.row(f, kind, data)) { /* where the player was put from outside a step, or by a restart inside the coming one: runtape.ts */ }
      else if (kind === 'flags') { const fl = data as any; g.godMode = !!fl.godMode; g.aiEnabled = fl.aiEnabled !== false; g.infiniteAmmo = !!fl.infiniteAmmo; g.playerInvisible = !!fl.playerInvisible; }
      else if (kind === 'tune') K.assignDeep(g.tune, data as any);
      else if (kind === 'table') { const [name, src] = data as [string, any]; const Tb = reg[name]; if (Tb && plain(src)) put(Tb, src); }
      else if (kind === 'kit') kitOf(data); }
    const dt = walk.step(W.canvas, W.input);
    walk.layCamera(W.cam);   // (tapewalk.ts: the pose, and the matrices the page's step read — an orbit's or a pan's lag a step behind its yaw)
    g.update(dt, W.input, W.cam, W.canvas);
    walk.done();
    // between two steps, as the page (host/loop.ts) and a tool's W.step do: flashes age, the world is packed again (the cursor's ray reads the boxes as of the last pack: without it
    // it lands on men, leaves and props where they stood at stand-up), and under the page's HUD an expired bubble is let go
    W.engine.lights.update(dt, g.time); if (want !== 'page') W.engine.world.dynamics = g.dynBoxes; W.engine.world.upload();   // (a headless tool's own step hands the world the game's whole list — headless.ts W.step; the page packs the list the step itself handed over, which under the fog of war is not the whole one)
    if (want === 'page') J.hudExpireBubbles(g);
    opts.each?.(W, f);
    // ---- held against the trace
    const si = byN.get(f + 1);
    if (si !== undefined) { compared++; const miss: string[] = [];
      D.men[si].forEach((m, ci) => { if (!m) return; const p = placeOf(ci); if (!p) { miss.push(F.cast[ci].name); return; }
        const d = Math.hypot(p[0] - m.x, p[1] - m.z), row = { r: D.r[si], n: f + 1, who: F.cast[ci].name, metres: d };
        if (!worst || d > worst.metres) worst = row; if (!drift && d > tol) drift = row; });
      castDiffers = miss.length ? `the trace has ${miss.join(', ')} on the floor; the re-run does not` : '';
      if (miss.length && !drift) drift = { r: D.r[si], n: f + 1, who: miss[0], metres: Infinity }; }
  }
  return { W, refuse: '', D, report: { ticks: toN, toN, compared, worst, drift, tol, castDiffers, unjournaled: walk.unjournaled, ownSenses, warnings } };
}

/** the report in words: the first line is the verdict */
export function rerunWords(R: RerunReport, F: ReplayFile): string[] {
  const out: string[] = [], w = R.worst as Drift | null, d = R.drift as Drift | null;
  if (!R.compared) out.push(`RE-RUN: ${R.ticks} steps walked; the trace has no sample on a step it passed, so how close it is to the page is NOT KNOWN`);
  else if (!d) out.push(`RE-RUN MATCHES THE PAGE: ${R.ticks} steps walked, held against ${R.compared} trace samples, no man more than ${w ? w.metres.toFixed(2) : '0.00'} m from where the page had him${w && w.metres > 0.011 ? ` (${w.who} at ${clock(w.r)})` : ''}`);
  else out.push(`RE-RUN PARTED FROM THE PAGE at ${clock(d.r)} (step ${d.n}): ${d.who} ${Number.isFinite(d.metres) ? `${d.metres.toFixed(2)} m from where the page had him` : 'is not on the floor'}; worst ${w ? `${Number.isFinite(w.metres) ? w.metres.toFixed(2) + ' m' : 'a man missing'} (${w.who} at ${clock(w.r)})` : '–'} over ${R.compared} samples. From ${clock(d.r)} on this game is its OWN run, not what was on the screen — trust the trace for that`);
  if (R.castDiffers) out.push(`  ${R.castDiffers}`);
  if (R.unjournaled) out.push(`  ${R.unjournaled} sensor read${R.unjournaled === 1 ? '' : 's'} the page had not made on that step (served the last value)`);
  for (const x of R.warnings) out.push(`  NOTE: ${x}`);
  if (F.commit) out.push(`  (saved on build ${F.commit})`);
  return out;
}
