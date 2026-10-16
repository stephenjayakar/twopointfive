// A QUIET MISSION PLAYED AS A PAIR, BESIDE THE SAME RUN ALONE — a level's quiet mission (game/quiet.ts: its `scenarios.quiet` block) taken to its end by ONE scripted
// careful Sam in three arms: alone, with the one partner following, and with the partner USED (a scripted commander giving the pair's quiet orders). A measuring
// tool: nothing of the game is edited. The question it answers per level: is two the better way, or a liability?
//   bun run tools/qa/quiet-pair.ts --level quiet-yard.json --seeds 1-12 [--arms alone,follow,orders] [--quiet N] [--jobs 4] [--cap 600] [--json out.json] [--md]
//   bun run tools/qa/quiet-pair.ts --level quiet-yard.json --trace 3 --arm orders        one run in this process with its timeline
//   --level takes a file under levels/, or a path (a level exported to a scratch folder)
//   --rig double | double-dark (with --trace / --seeds, arm orders): THE DOUBLE'S OWN CHECK, STAGED — see RIG below. Not a run of the mission.
// THE STAND: the game as the PAGE stands it (solo-night.ts's own list: GLASSFX=on, TPS_MOVES=1, TPS_TURN=1, TPS_CAST=1, TPS_OPENING=1, TPS_QRFSILENT=1, TPS_QRFSQUAD=1, chaos 0.5,
// destruction on unless SOLO_DESTR=0), the level loaded from its file, the mission started as the page starts it: startFromQuery(g, '?quiet[=N][&squad=1]').
// THE PAIR SWITCHES ARE THE MISSION'S (quiet.ts holds PAIRUP / PAIR / SNEAK / SPOTTED and the silent posture on for a run with a partner): nothing here sets them;
// every run carries `sw` = what they read when it ended.
// THE SCRIPTED SAM (the same in all three arms; solo-night.ts's `careful` plan with `--out short`, copied): on his own feet and keys (WASD along the nav path, C,
// Space on a row, the pistol's OCP), MORTAL AND SEEN — no god mode, his light meter fed every frame from the CPU's estimate of the direct light on him
// (guards.ts lightEstimateAt, his own lights skipped: no bounce, no moon). Crouched all the way, doors eased, a lock picked, the OCP on `laser_corridor` /
// `cam_server` where the level has them — and on ANY live camera that has the next steps in its picture (see A CAMERA ON THE WAY) —, the thing taken, out by the nearest exit. He HOLDS short of any stretch a man's eye covers (solo-night's rule: lines of
// sight only, light-blind, a cone of 72°, anything inside 4.5 m), steps back out of an eye that sweeps onto him, and after 45 s of one hold walks anyway.
// ARMS
//   alone    squad 0
//   follow   squad 1: the partner follows under the pair rules; no order is ever given
//   orders   squad 1 and A SCRIPTED COMMANDER, as a player would use the partner:
//     1. Held short of a watched stretch for more than QP_HOLD (4) s: the WATCHERS are named (the living guards whose eye covers the next stretch, by the rule
//        that holds him). The nearest that is an order target (g.pair.up, g.pair.isFoe: the menu's own test) is given 'take him · on your mark' — row `pairMark`
//        through g.orders.give, as the menu's digit gives it; the row's own refusals apply. Sam stays still and low, his reticle off the man (and steps back out
//        of an eye that sweeps onto him, as careful does).
//     2. The partner says 'set.' (g.pair.jobOf(mate).set) → THE MARK (g.pair.mark('api'), as F). Up to QP_GO (8) s for the man to go down, then 'fall in'.
//     3. THE DOUBLE. The job reports a WATCHER (Job.watcher: 'hold. Y has eyes on him.'): Sam takes Y himself. He holsters (E), works to Y's back over floor no
//        living man's eye would raise awareness on — asked of the game's own tests: guards.ts pointInView for the eye (58° + 10, 100° inside 3.5 m, 16 m, a line)
//        and guards.ts sightGain for what that eye would make of him THERE (his meter set to that floor's light for the ask, put back before the game steps) —
//        and clicks with his hands empty on the man in reach behind: the player's own silent takedown, the KNOCKOUT (game.ts updateDoors → player.ts
//        startTakedown) — the left button, or the RIGHT one where the two-button blow is live (close.ts closeLethal: the page's stand; there the left
//        click is the knife, a kill on the card, which no quiet run of this tool means). His hands going on are the mark (PAIR.markOnHands), so both men drop on one beat. Not at Y's back inside QP_DOUBLE (40) s: the job is
//        cancelled ('fall in') and he waits as careful does.
//     4. A refusal, a job the partner calls off, a set that never comes (QP_SET 60 s), a watched hold nobody resolves (QP_WATCH 20 s): logged with the partner's
//        own words (his bubble), then 'fall in'. At most QP_ORDERS (6) orders a run, QP_COOL (8) s between two, two tries a man.
//   Every knob is the environment's: QP_HOLD · QP_ORDERS · QP_COOL · QP_SET · QP_GO · QP_WATCH · QP_DOUBLE · QP_STILL=1 (only a watcher who is STANDING is given: a
//   man walking his beat toward the pair has no back to get to) · QP_ANYWAY=1 (a watched hold past QP_WATCH ends in a
//   second mark, 'going anyway', instead of the cancel) · QP_WHERE=a-b (with --trace: where everybody stands and looks between those seconds, the partner's status line and what
//   g.pair.watcher answers) · SOLO_WAIT=S (or QP_WAIT): he stands on the start S seconds before he moves — the same script begun S
//   seconds into the patrols' lap. A FIXED SCRIPT AGAINST A FIXED SCHEDULE IS ONE SAMPLE: sweep this.
// THE DOUBLE IS PLANNED BEFORE THE MARK: at 'set.' the commander first asks who would SEE the takedown — g.pair.watcher(foe, partner), and besides it any living
//   guard of the man's side within 12 m with a clear line to his hips (or a hand above them — guards.ts bodySeen's own point — or his head) whose CHEST holds him within 70° (a head that glances away comes back), looked for over
//   QP_LOOK (0.6) s. Somebody would: NO mark is given; Sam goes to that man's back and gives it from there (below); not there inside
//   QP_DOUBLE s: 'fall in', never the bare mark. Nobody would: the mark at 'set' as before, and the double only if the partner then reports a watcher.
//   AT Y'S BACK the order is a player's: F (g.pair.mark('api')) — F again, 'going anyway', if the partner answers that he is held by a watcher — then Sam keeps
//   still until the partner's hands are on his man (g.pair.gripped, ≤ 1.5 s) and ONLY THEN clicks his own takedown: Sam's man dropping a beat before the partner's
//   hands go on is a body the partner's man, facing it, finds on the spot. QP_HANDSMARK=1 = the older order (Sam's click is the mark: PAIR.markOnHands).
//   QP_MARKFIRST=1 = the old order (the mark at 'set' whoever is looking), kept so the difference can be shown.
// A CAMERA ON THE WAY (all three arms): while he walks, a LIVE camera (g.devices.cameras: powered, not broken, not already out) that has the 1.8 m ahead of him —
//   or himself — inside its reach and its field of view over its whole pan (range, fovDeg / 2 in plan and in elevation off the lens's pitch, a clear line from the
//   lens: devices.ts updateCamera's Eye, asked of a POINT here since eyeContact takes Sam's own body) stops him short; he puts the OCP on it by name and goes on
//   at once; again when it wakes with him still in its picture and the OCP ready (≥ 2.5 s between tries on one lens). Each is logged and counted (`cams`).
// WHAT A RUN IS CALLED
//   end      done (out by an exit: the debrief card) · down (Sam dropped) · stalled (the script ran out of ways, or the time cap) · error (an exception)
//   noticed  the WORST of, by pair-sneak.ts's own bars (its `cls`), the shift being the level's staff (team 'guard') and the cleaner counted beside them:
//     loud     an unsuppressed round (a 'shot' at level ≥ 1), any guard's round, a stun charge, a boot
//     spotted  a guard went ALERT or to SEARCH, or his awareness passed 0.75 — or the floor's escalation rose (a camera's alarm, a body found), or a civilian was
//              frightened (alarmed / flee / report / phone / gone / cower)
//     looked   a guard's awareness reached 0.5 (silent.ts's `noticed`) — or a civilian was startled
//     turned   a guard went SUSPICIOUS under that bar (he turned to a noise and walks over)
//     ghost    none of it: no guard ever left his calm. (A man put out cold is not 'noticed' by himself: his body found is, through the alert it raises.)
//   NOT COUNTED: the man control sends to look at the emptied holder 7 s after the take (mission.ts sendRackCheck: suspicious with task 'rack'; since 10-12 only where the holder is wired — game/takecheck.ts — before that on EVERY run that
//   takes the thing — the mission's own errand; `errand` names him). He counts like anybody the moment he goes further (awareness ≥ 0.5, search, alert).
//   clean    ghost — or 'turned' where every man who turned was put out cold within 2.5 s of turning (he started at the hands that took him and told nobody).
//   first    the first of those, with WHO it was that was noticed — Sam or the partner: whose body the guard's eyes were gaining on over the last second and a
//            half (guards.ts canSeeChar × sightGain / sightGainOn, asked beside the game, never written), else whose noise he last heard — where, and by whom.
//   also     every guard put out and by whom (Sam's hands, the partner's hands, a round), the orders' books (given / refused / set / marks / landed / called off,
//            doubles tried / landed), seconds, the debrief's score and rating, the deal (g.quiet.summary()), how far the partner was from Sam at the end and
//            whether he was out through an exit himself. THE MISSION ASKS NOTHING OF THE PARTNER AT THE EXIT (mission.ts: Sam past an exit's point is 'done').
// RIG (`--rig double` | `--rig double-dark`): the levels on this branch were not built for the double; this stages one so the path is exercised end to end. After the
//   start, two living guards A and B are stood on open floor 5 m apart SIDE BY SIDE, looking the same way — A on the floor nearest QP_RIG_LIT (0.3 on the meter's scale: dim) the level has
//   room for the figure on (`double`), or its DARKEST (`double-dark`: the watcher has only his own torch on his mate) — held still (Guard.hold / pinned, the
//   scripted-only flags), the partner 7 m behind A, Sam 7 m behind B, and the commander is run on A at once. The moment the partner is SET, B is turned to look
//   at A: the watcher who turns up after 'set.', which is the case the game's watched rule is for (before it, the stalk's own route rule refuses first). It reports order → set → mark → 'hold. Y has eyes on him.' → Sam's hands on Y → both down.
//   It is a check of the tool's own double (and of markOnHands), not a result about any level.
// THE HARNESS HAS NO GPU: no bounce light and no moon on anybody's meter, no smoke, no picture, no sound. Nothing here was seen or heard.
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }; const has = (n: string) => argv.includes(n);
const ARMS = ['alone', 'follow', 'orders'] as const; type Arm = typeof ARMS[number];
const QUIET_PIN = /^\d+$/.test(flag('--quiet') ?? '') ? Number(flag('--quiet')) : null, RIG = flag('--rig') ?? '';
for (const [k, v] of [['GLASSFX', 'on'], ['TPS_MOVES', '1'], ['TPS_TURN', '1'], ['TPS_CAST', '1'], ['TPS_OPENING', '1'], ['TPS_QRFSILENT', '1'], ['TPS_QRFSQUAD', '1']]) process.env[k] ??= v;   // (before any game module loads: they read these once)
const env = (k: string, d: number) => { const v = Number(process.env[k]); return process.env[k] !== undefined && Number.isFinite(v) ? v : d; };
/** the commander's clocks (s) and counts */
const K = { hold: env('QP_HOLD', 4), max: env('QP_ORDERS', 6), cool: env('QP_COOL', 8), set: env('QP_SET', 60), go: env('QP_GO', 8), watch: env('QP_WATCH', 20), double: env('QP_DOUBLE', 40), anyway: process.env.QP_ANYWAY === '1', still: process.env.QP_STILL === '1', markFirst: process.env.QP_MARKFIRST === '1', handsMark: process.env.QP_HANDSMARK === '1', look: env('QP_LOOK', 0.6), wait: env('QP_WAIT', env('SOLO_WAIT', 0)) };
const PATIENCE = 45, DT = 1 / 60;
type Vec3 = [number, number, number];
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—'), r2 = (x: number) => +x.toFixed(2);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
class Done extends Error { constructor(public end: string, public why = '') { super(end); } }
const NOTICED = ['ghost', 'turned', 'looked', 'spotted', 'loud'] as const; type Noticed = typeof NOTICED[number];

export interface First { t: number; how: string; by: string; on: 'sam' | 'partner' | '?'; via: string; where: string; sam: string; mate: string | null }
export interface PairRun {
  level: string; arm: Arm; seed: number; rig: string; end: string; why: string; t: number; stage: string; noticed: Noticed; clean: boolean; errand: string | null; first: First | null;
  deal: string | null; guards: number; civilians: number; wait: number;
  aw: Record<string, number>; firsts: Record<string, Record<string, number>>; escalation: number; loud: string[]; civ: Record<string, string[]>;
  out: { who: string; by: string; how: string; t: number; where: string }[];
  orders: { given: number; refused: number; set: number; marks: number; landed: number; calledOff: number; watchedHolds: number; anyway: number; doubles: number; doublesLanded: number; planned: number; why: Record<string, number>; none: Record<string, number>; log: string[] };
  stats: Record<string, unknown> | null; sw: Record<string, boolean> | null;
  mate: { state: string; dSam: number; out: boolean; words: string[] } | null;
  held: number; doors: Record<string, number>; ocp: Record<string, boolean>; cams: { tried: number; out: number; log: string[] }; stuck: number; hits: number; lit: number;
  score: number | null; rating: string | null; summary: string | null; timeline: string[]; trace: string[];
}

async function one(seed: number, arm: Arm, cap: number, verbose: boolean, levelFile: string): Promise<PairRun> {
  const { standUp, ROOT } = await import('./headless.ts');
  if (process.env.SOLO_DESTR !== '0') { try { (await import(`${ROOT}/src/game/destructionSwitch.ts`)).DESTRUCTION.on = true; } catch { /* a build from before the destruction goal */ } }
  if (process.env.SOLO_CLEAR_M) { try { (await import(`${ROOT}/src/game/opening.ts`)).OPENING.clearM = Number(process.env.SOLO_CLEAR_M); } catch { /* a build from before the opening rule */ } }
  const { lightEstimateAt, escalationOf, canSeeChar, sightGain, sightGainOn, pointInView } = await import(`${ROOT}/src/game/guards.ts`);
  const { debriefOf, fmtEvent } = await import(`${ROOT}/src/game/chronicle.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { alive: deviceAlive } = await import(`${ROOT}/src/game/devices.ts`);
  const { DEVICE_DEFAULTS } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`);
  const { outThrough } = await import(`${ROOT}/src/game/quiet.ts`);
  let closeLethal: (g: any) => boolean = () => false; try { closeLethal = (await import(`${ROOT}/src/game/close.ts`)).closeLethal ?? closeLethal; } catch { /* a build from before the two-button blow */ }
  const PO: any = await import(`${ROOT}/src/game/pairorders.ts`), PU: any = await import(`${ROOT}/src/game/pairup.ts`), SN: any = await import(`${ROOT}/src/game/sneak.ts`), SP: any = await import(`${ROOT}/src/game/spotted.ts`);
  const out: PairRun = { level: levelFile, arm, seed, rig: RIG, end: 'error', why: '', t: 0, stage: '', noticed: 'ghost', clean: false, errand: null, first: null, deal: null, guards: 0, civilians: 0, wait: K.wait, aw: {}, firsts: {}, escalation: 0, loud: [], civ: {}, out: [],
    orders: { given: 0, refused: 0, set: 0, marks: 0, landed: 0, calledOff: 0, watchedHolds: 0, anyway: 0, doubles: 0, doublesLanded: 0, planned: 0, why: {}, none: {}, log: [] }, stats: null, sw: null, mate: null,
    held: 0, doors: { pushed: 0, eased: 0, picked: 0, kicked: 0, refused: 0 }, ocp: {}, cams: { tried: 0, out: 0, log: [] }, stuck: 0, hits: 0, lit: 0, score: null, rating: null, summary: null, timeline: [], trace: [] };
  const log = console.log, err = console.error, warn = console.warn; const hush = () => { if (!verbose) console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };
  let t = 0; const say = (s: string) => { const line = `${f1(t).padStart(6)}  ${s}`; out.trace.push(line); if (verbose) log(line); };
  const bump = (o: Record<string, number>, k: string) => { o[k] = (o[k] ?? 0) + 1; };
  let g: any = null, mate: any = null; const O = out.orders; let frames = 0, litSum = 0;
  try {
    Math.random = seeded(0x9137 + seed * 7919);   // (playthrough.ts's own seeding, solo-night.ts's: a seed is the same dice there and here)
    const file = levelFile.includes('/') ? resolve(levelFile) : resolve(ROOT, 'levels', levelFile);
    const levelOf = (): any => { const data = parseLevelData(readFileSync(file, 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
    hush(); const W: any = await standUp({ uploadEvery: 4, level: levelOf() }); unhush();
    g = W.game; const I = W.input, cam = W.cam;
    g.godMode = false; g.tune.chaos = 0.5;
    { hush(); const r = startFromQuery(g, `?quiet${QUIET_PIN === null ? '' : '=' + QUIET_PIN}${arm === 'alone' ? '' : '&squad=1'}`); unhush(); if (r.why) throw new Done('stalled', `the quiet mission did not start: ${r.why}`); }
    const M = g.level.mission; out.deal = g.quiet.summary(); mate = g.quiet.ops[0] ?? null;
    if (!M) throw new Done('stalled', 'no mission after the deal');
    if (arm !== 'alone' && !mate) throw new Done('error', 'squad 1 asked for and no partner staged');
    const pl = () => g.player, pos = (): number[] => g.player.char.pos;
    const eyeOf = (c: any): Vec3 => c.bones?.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]], chestOf = (c: any): Vec3 => c.bones?.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
    /** the shift: the level's own men (never the partner) */
    const shift = (): any[] => g.guards.filter((x: any) => x.team !== 'operative');
    const up = (x: any) => x.state !== 'dead' && !x.ko && x.char.alive !== false;
    const everyone = (): any[] => [...shift(), ...(g.civilians ?? [])];
    const mateUp = () => !!mate && mate.state !== 'dead';
    const roused = (h: any) => h.state === 'alert' || h.state === 'search' || h.awareness >= 0.5;
    out.guards = shift().length; out.civilians = (g.civilians ?? []).length;

    // ───────────────────────────── the run's books (read beside the game every frame: nothing written)
    const heardMsg = new WeakSet<object>(), seenEv = new WeakSet<object>(), plSeen = new WeakSet<object>();
    const was = new Map<any, string>(), civWas = new Map<any, string>(), heardT = new Map<any, number>(), lastHeard = new Map<any, { T: number; kind: string; src: string }>(), eyes = new Map<any, { s: number; m: number }>();
    let escWas = 0, chronSeen = 0, lastHit = -1, wordWas: any = null; const words: string[] = [];
    let susp = 0, hot = 0, looked = false, civScared = false, civStartled = false; const suspAt: { who: string; t: number }[] = [];
    const srcOf = (e: any): string => { if (e.who === PLAYER_ID || e.who === g.player.char.id) return 'sam'; if (mate && e.who === mate.char.id) return 'partner';
      if (g.guards.some((x: any) => x.char.id === e.who && x.team !== 'operative')) return 'theirs';
      const dS = flat(e.pos, pos()), dM = mateUp() ? flat(e.pos, mate.char.pos) : Infinity; return dS < 1.3 && dS <= dM ? 'sam' : dM < 1.3 ? 'partner' : 'world'; };
    const first = (how: string, by: string, on: First['on'], via: string, where: number[]) => { if (out.first) return;
      out.first = { t: r2(t), how, by, on, via, where: at(where), sam: at(pos()), mate: mateUp() ? `${at(mate.char.pos)} ${f1(flat(mate.char.pos, pos()))} m from Sam` : mate ? 'down' : null };
      say(`   !! FIRST NOTICED · ${by}: ${how} · on ${on} · ${via} · he is at ${at(where)} · Sam ${at(pos())}${mateUp() ? ` · ${mate.callsign} ${at(mate.char.pos)}` : ''}`); };
    /** whom a guard's notice is ON: the body his eyes have been gaining on, else the noise he last heard */
    const onWhom = (h: any): { on: First['on']; via: string } => { const E = eyes.get(h), lh = lastHeard.get(h);
      if (E && Math.max(E.s, E.m) > 0.02) return { on: E.s >= E.m ? 'sam' : 'partner', via: `sight (his eyes' gain over 1.5 s: Sam ${E.s.toFixed(2)}, partner ${E.m.toFixed(2)})` };
      if (lh && g.time - lh.T < 3) return { on: lh.src === 'sam' ? 'sam' : lh.src === 'partner' ? 'partner' : '?', via: `sound: ${lh.kind} by ${lh.src} ${f1(g.time - lh.T)} s before` };
      return { on: '?', via: `no sight, no sound booked${h.witness?.alertedBy ? ` (${h.witness.alertedBy})` : ''}` }; };
    const WHERE = process.env.QP_WHERE ? process.env.QP_WHERE.split('-').map(Number) : null; let wf = 0;
    const deg = (c: any) => Math.round(Math.atan2(c.chestDir[0], c.chestDir[2]) * 180 / Math.PI);
    const after = () => {
      const decay = Math.exp(-DT / 1.5);
      if (WHERE && t >= WHERE[0] && t <= WHERE[1] && ++wf % 15 === 0) { const A0 = mateUp() ? g.orders.of(mate) : null, J = mateUp() ? g.pair?.jobOf?.(mate) : null;   // (QP_WHERE=a-b: where everybody stands and looks, four times a second)
        say(`   @ Sam ${at(pos())} vis ${r2(pl().visibility)}${pl().holstered ? ' hands empty' : ''}${mateUp() ? ` · ${mate.callsign} ${at(mate.char.pos)} vis ${r2(mate.visibility)} [${A0 ? (A0.arrived ? A0.there : A0.going) : '—'}]${J ? ` job: go ${J.go} set ${J.set} watcher ${J.watcher?.callsign ?? '—'} · pair.watcher now: ${g.pair.watcher(J.foe, mate)?.callsign ?? 'nobody'} (${shift().filter(h => up(h) && h !== J.foe).map(h => { const hp = J.foe.char.bones.hips ?? J.foe.char.pos, q: Vec3 = [hp[0], 0.35, hp[2]]; return `${h.callsign}: his floor ${pointInView(g, h, q) ? 'IN view' : 'not in view'}, lamps ${r2(g.pair.litAt(q))}`; }).join('; ')})` : ''}` : ''} · ${shift().filter(up).map(h => `${h.callsign} ${at(h.char.pos)} looks ${deg(h.char)}° ${h.state} aw ${r2(h.awareness)}`).join(' | ')}`); }
      for (const e of g.events as any[]) { if (seenEv.has(e)) continue; seenEv.add(e);
        if ((e.kind === 'shot' && (e.level ?? 0) >= 1) || e.kind === 'guardShot' || e.kind === 'bang' || e.kind === 'kick') { const s = srcOf(e); out.loud.push(`${f1(t)} ${e.kind} by ${s}`); say(`   !! LOUD · ${e.kind} by ${s} at ${at(e.pos)}`); first(`loud: ${e.kind}`, s, s === 'sam' ? 'sam' : s === 'partner' ? 'partner' : '?', 'a loud noise', e.pos); } }
      for (const x of shift()) { const who = x.callsign ?? `id${x.char.id}`;
        if (x.state !== 'dead') {   // his eyes: what they have of each of the two, by the game's own test and rate
          const E = eyes.get(x) ?? eyes.set(x, { s: 0, m: 0 }).get(x)!; const a = canSeeChar(g, x, g.player.char, true), b = mateUp() ? canSeeChar(g, x, mate.char, false) : null;
          E.s = E.s * decay + (a.visible ? sightGain(g, x, a.dist) * DT : 0); E.m = E.m * decay + (b?.visible ? sightGainOn(g, x, mate, b.dist) * DT : 0);
          const hT = x.witness?.heard?.lastT ?? -1; if (hT > (heardT.get(x) ?? -1) + 1e-9) { heardT.set(x, hT); let best: any = null, bd = Infinity;
            for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (g.time - e.time > 0.12) break; if (e.kind === 'lightOut' || srcOf(e) === 'theirs') continue; const d = flat(e.pos, x.char.pos); if (d < bd) { bd = d; best = e; } }
            if (best) { lastHeard.set(x, { T: g.time, kind: best.kind, src: srcOf(best) }); if (verbose) say(`   · ${who} hears ${best.kind} (${srcOf(best)}, level ${best.level ?? '?'}, ${f1(bd)} m) · awareness ${r2(x.awareness)}`); } }
          out.aw[who] = Math.max(out.aw[who] ?? 0, r2(x.awareness));
          if (x.awareness >= 0.5 && !looked) { looked = true; const w = onWhom(x); first(`awareness ${r2(x.awareness)}`, who, w.on, w.via, x.char.pos); } }
        const s = x.state, w = was.get(x); if (w === s) continue; was.set(x, s);
        if (w === undefined && s === 'patrol') continue;
        (out.firsts[who] ??= {})[s] ??= r2(t); say(`   ${who}: ${w ?? '—'} → ${s} at ${at(x.char.pos)}${x.witness?.alertedBy ? ` (${x.witness.alertedBy})` : ''}`);
        if (s === 'suspicious' && x.task?.kind === 'rack') { out.errand = who; say(`   (${who} is the man control sends to look at the emptied holder: the mission's own errand, not a notice)`); }
        else if (s === 'suspicious' || s === 'alert' || s === 'search') { if (s === 'suspicious') { susp++; suspAt.push({ who, t }); } else hot++; const o = onWhom(x); first(`went ${s}`, who, o.on, o.via, x.char.pos); }
        if (s === 'dead') { const hands = PO.PAIR_LOG.some((L: any) => g.time - L.t < 0.1 && L.what.startsWith(`down:${x.callsign || 'that man'} by `)), kind = x.downKind ?? '?';
          const by = hands || (mate && x.killerId === mate.char.id) ? 'partner' : x.downBy === 'player' || x.killerId === PLAYER_ID ? 'sam' : x.downBy === 'guard' ? 'his own side' : 'world';
          const how = kind === 'struck' || kind === 'choked' ? `${by === 'partner' && hands ? 'hands' : kind} (out cold)` : kind;
          out.out.push({ who, by, how, t: r2(t), where: at(x.char.pos) }); say(`   + ${who} is down at ${at(x.char.pos)} · ${how} · by ${by}`); } }
      for (const x of g.civilians ?? []) { const s = x.civ?.state ?? x.state, w = civWas.get(x); if (w === s) continue; civWas.set(x, s); const who = x.callsign ?? `civ${x.char.id}`; if (w === undefined) continue;
        (out.civ[who] ??= []).push(`${f1(t)} ${s}`); say(`   ${who} (civilian): ${w} → ${s}`);
        if (s === 'startled') { civStartled = true; first('civilian startled', who, 'sam', 'a civilian (they sense the player only)', x.char.pos); }
        else if (s !== 'work' && s !== 'dead') { civScared = true; first(`civilian ${s}`, who, 'sam', 'a civilian (they sense the player only)', x.char.pos); } }
      { const e = escalationOf(g); if (e !== escWas) { say(`   the floor: escalation ${escWas} → ${e}`); if (e > escWas) first(`the floor's escalation ${escWas} → ${e}`, 'control', '?', 'the net (a camera, a body, a report)', pos()); escWas = e; } out.escalation = Math.max(out.escalation, e); }
      for (const m of g.messages as { text: string }[]) { if (heardMsg.has(m)) continue; heardMsg.add(m); if (m.text.startsWith('radio: CONTROL')) say(`   ${m.text}`); }
      { const h = g.player.hitFlash ?? 0; if (h > 0 && lastHit <= 0) { out.hits++; say(`   !! Sam is hit at ${at(pos())}`); } lastHit = h; }
      { const ev = g.chronicle.events as any[]; for (; chronSeen < ev.length; chronSeen++) { const line = fmtEvent(ev[chronSeen]); out.timeline.push(line); say(`   · ${line}`); } }
      if (mate) { const b = mate.bubble; if (b && b !== wordWas) { wordWas = b; words.push(`${f1(t)} “${b.text}”`); say(`   ${mate.callsign}: “${b.text}”`); } }   // (the partner's own words: every line he says, as his bubble carries it)
      { const L0 = PO.PAIR_LOG as any[], fresh: any[] = []; for (let i = L0.length - 1; i >= 0 && !plSeen.has(L0[i]); i--) { plSeen.add(L0[i]); fresh.unshift(L0[i]); }
        for (const L of fresh) { say(`   ~ orders: ${L.what}`); if (O.log.length < 80) O.log.push(`${f1(t)} ${L.what}`); } }
      for (const x of [g.player, ...g.guards, ...(g.civilians ?? [])]) { const p = x.char.pos; if (!Number.isFinite(p[0] + p[1] + p[2])) throw new Error(`NaN position on ${x.callsign ?? 'Sam'}`); }
    };

    // ───────────────────────────── Sam's hands and feet (solo-night.ts's careful plan, copied)
    let goal: Vec3 | null = null, downT = -1, dash = false, low = true, replan = false;
    function step(n = 1) {
      for (let i = 0; i < n; i++) {
        for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
        const P = pl();
        if (goal && !P.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
          if (d > 0.12) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
        if (dash && goal) I.keys.add('ShiftLeft'); else I.keys.delete('ShiftLeft');
        { const want = low && !dash; if (!!P.crouch !== want && !P.takedown && !P.down && !P.picking) I.pressed.add('KeyC'); }   // (C is a press, never held)
        { const c = P.char, own = (o: number) => o === PLAYER_ID; P.visibility = g.visibilityOf(Math.max(lightEstimateAt(g, chestOf(c), own), lightEstimateAt(g, eyeOf(c), own))); litSum += P.visibility; frames++; }
        W.step(DT); t += DT; after();
        if (g.mission.stage === 'done') throw new Done('done', String(g.chronicle.events[g.chronicle.events.length - 1]?.data?.text ?? 'out'));
        if (g.player.down) { if (downT < 0) { downT = t; say(`   !! Sam is down at ${at(pos())}`); } if (t - downT > 3) throw new Done('down', `Sam dropped at ${at(pos())} in stage ${g.mission.stage}`); }
        if (t >= cap) throw new Done('stalled', `time cap in stage ${g.mission.stage} at ${at(pos())}`);
      }
    }
    const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
    const cursor = (p: number[]) => W.cursorAt([p[0], p[1], p[2]]);
    const free = (p: number[]): Vec3 => { const nav = g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; };
    const pathTo = (p: number[]): number[][] | null => g.col.nav.findPath(pos(), p, 8000);
    const doorOnPath = (path: number[][]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
        for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
          const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
          const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
        if (best) return best; a = b; } return null; };
    /** careful's own rule (solo-night.ts `watched`, with the men named): who has the spot `p` under his eye right now — what a player reads off the picture */
    const watchers = (p: number[], firstOnly = false): any[] => { const r: any[] = []; for (const x of everyone()) { const c = x.char; if (!up(x)) continue; const eye = eyeOf(c), d = flat(eye, p); if (d > 17) continue;
        if (d > 4.5) { const hd = c.headDir ? c.headDir() : c.chestDir, lx = (c.chestDir[0] + hd[0]) / 2, lz = (c.chestDir[2] + hd[2]) / 2, L = Math.hypot(lx, lz) || 1; if (((p[0] - eye[0]) * lx + (p[2] - eye[2]) * lz) / (L * d) < 0.31) continue; }
        if (g.col.segmentBlocked(eye, [p[0], 1.1, p[2]]) && g.col.segmentBlocked(eye, [p[0], 1.6, p[2]])) continue; r.push(x); if (firstOnly) break; } return r; };
    const watched = (p: number[]) => watchers(p, true).length > 0;

    // ───────────────────────────── the commander (arm `orders`)
    let nextOrderT = 0, noWhy = '', rigOnSet: (() => void) | null = null; const triedN = new Map<any, number>();
    const fallIn = (why: string) => { if (!mateUp()) return; const w = g.orders.give('fallIn', g.orders.targetAt(pos()), 'all'); say(`order: fall in (${why})${w ? ` — REFUSED: ${w}` : ''}`); };
    const lastWords = () => words.length ? words[words.length - 1].replace(/^\S+ /, '') : '(he said nothing)';
    const anyRoused = () => shift().some(x => up(x) && roused(x));
    /** THE GAME'S OWN TESTS for Sam's stalk: would this man's eye raise his awareness on a low Sam standing at `p` (guards.ts pointInView for the eye — the body
     *  rule's cone opened to the eye's own, the near field's inside 3.5 m — and guards.ts sightGain with his meter set to that floor's light for the ask) */
    const visMemo = new Map<number, [number, number]>();
    const visAt = (p: number[]): number => { const k = Math.round(p[0] * 2) + 8192 * Math.round(p[2] * 2), m = visMemo.get(k); if (m && g.time - m[1] < 3 && g.time >= m[1]) return m[0];
      const own = (o: number) => o === PLAYER_ID, v = g.visibilityOf(Math.max(lightEstimateAt(g, [p[0], 0.8, p[2]], own), lightEstimateAt(g, [p[0], 1.15, p[2]], own))); visMemo.set(k, [v, g.time]); return v; };
    const seenBy = (p: number[], but: any = null): any | null => { for (const h of shift()) { if (!up(h) || h === but) continue; const d = flat(h.char.pos, p); if (d > 16) continue; const half = d < 3.5 ? 100 : 68;
        if (!pointInView(g, h, [p[0], 0.8, p[2]], 16, half) && !pointInView(g, h, [p[0], 1.15, p[2]], 16, half)) continue;
        const P = pl(), was0 = P.visibility; P.visibility = visAt(p); const rate = sightGain(g, h, Math.max(0.3, d)); P.visibility = was0;   // (put back before the game steps: asked, never written)
        if (rate >= 0.15) return h; } return null; };
    /** Sam to Y's back by unseen floor, then the player's own takedown: hands empty, the knockout's button on the man in reach behind (the right one where the left is the knife) */
    function stalkTake(W0: any, Y: any): string {
      const nav = g.col.nav, c = nav.cell, t0 = t; let path: number[][] | null = null, planT = -1e9, waited = 0;
      if (!pl().holstered) { I.pressed.add('KeyE'); step(25); }
      if (!pl().holstered) return 'he could not empty his hands';
      for (; t - t0 < K.double;) {
        if (Y.state === 'dead') return 'the watcher went down by another hand';
        if (W0.state === 'dead') return 'the partner went alone on a clear moment';
        if (roused(Y) || anyRoused()) return 'a man roused';
        { const J = g.pair.jobOf(mate); if (!J || J.foe !== W0) return `the job was called off (${lastWords()})`; }
        const row = g.nearby.find((it: any) => it.kind === 'guard' && it.inReach);
        if (row && row.guard === Y && !pl().takedown && !K.handsMark) {   // in reach at Y's back: F first, and Sam's own hands only once the partner's are on his man (a body dropped a beat early is found by the man facing it)
          goal = null; cursor(chestOf(Y.char)); const J0 = g.pair.jobOf(mate);
          if (J0 && J0.foe === W0 && J0.t0 < 0 && !J0.force) { g.pair.mark('api'); O.marks++; step(3); const J = g.pair.jobOf(mate);   // (once: working round again finds the partner already going or already told 'anyway' — no second F, no second count)
            if (J && J.foe === W0 && J.t0 < 0 && J.watcher) { const by = J.watcher.callsign ?? 'a watcher'; g.pair.mark('api'); O.anyway++; say(`F, F again: going anyway (${mate.callsign} was held by ${by}; Sam is at ${Y.callsign}'s back)`); } else say(`F: the mark, from ${Y.callsign}'s back`); }
          const tg = t; while (!g.pair.gripped(W0) && W0.state !== 'dead' && t - tg < 1.5) { if (roused(Y) || anyRoused()) return 'a man roused'; cursor(chestOf(Y.char)); step(); }
          const r1 = g.nearby.find((it: any) => it.kind === 'guard' && it.inReach);
          if (!r1 || r1.guard !== Y) { say(`(${Y.callsign} is no longer in reach behind: Sam works round again)`); continue; }
          say(g.pair.gripped(W0) || W0.state === 'dead' ? `the partner's hands are on ${W0.callsign}: Sam takes ${Y.callsign}` : `(${mate.callsign}'s hands are not on ${W0.callsign} 1.5 s after the mark — ${lastWords()} — Sam takes ${Y.callsign} anyway)`); }
        if (row && row.guard === Y && !pl().takedown) { cursor(chestOf(Y.char)); I.clicked |= closeLethal(g) && process.env.QUIETPAIR_BREAK !== '1' ? 4 : 1; step(); if (pl().takedown) { say(`Sam's hands are on ${Y.callsign}${K.handsMark ? ' (the mark)' : ''}`); until(() => Y.state === 'dead' && W0.state === 'dead', 5); return Y.state === 'dead' && W0.state === 'dead' ? 'landed' : Y.state === 'dead' ? `Sam's man down, the partner's not (${lastWords()})` : 'the takedown did not land'; } continue; }
        const yp = Y.char.pos, yaw = Y.char.bodyYaw; let spot: Vec3 | null = null;
        for (const m of [0.75, 0.6, 0.9]) { const q: Vec3 = [yp[0] - Math.sin(yaw) * m, 0, yp[2] - Math.cos(yaw) * m]; if (!nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([q[0], 1, q[2]], [yp[0], 1, yp[2]])) { spot = q; break; } }
        if (!spot) { goal = null; step(6); continue; }
        if (t - planT > 0.35 || !path) { planT = t; path = nav.findPath(pos(), spot, 6000, (ix: number, iz: number) => seenBy([(ix + 0.5) * c, 0, (iz + 0.5) * c]) ? 14 : 1) ?? null; }
        if (!path) { goal = null; step(6); continue; }
        // the next 1.5 m of the way: walked only while no eye would gain on him there (the last pace to the man's back is his own blind side)
        let a = pos(), left = 1.5, bad: any = null, nextWp: number[] = spot; let got = false;
        for (const b of [...path, spot]) { const L = flat(a, b); if (!got && flat(pos(), b) > 0.4) { nextWp = b; got = true; }
          for (let s = 0.3; s <= Math.min(L, left) && !bad; s += 0.3) { const q = [a[0] + (b[0] - a[0]) * s / (L || 1), 0, a[2] + (b[2] - a[2]) * s / (L || 1)]; if (flat(q, spot) > 0.35) bad = seenBy(q); }
          left -= L; a = b; if (left <= 0 || bad) break; }
        if (bad) { if (waited === 0) say(`(the double: Sam waits at ${at(pos())}: ${bad.callsign} would see the next steps)`); waited += DT; goal = null; } else { waited = 0; goal = [nextWp[0], 0, nextWp[2]]; }
        cursor([nextWp[0], 0.2, nextWp[2]]); step();
      }
      return `not at his back inside ${K.double} s`;
    }
    /** WHO WOULD SEE IT, asked at 'set' BEFORE any mark (what a player reads off two men facing each other): the game's own answer (g.pair.watcher: eyes on the
     *  partner, or the man's floor in a mate's body view and lit) — and besides it any living guard of the man's side within 12 m of him with a clear line to
     *  his hips whose CHEST (not his head: a glance comes back) holds him within 70° */
    const wouldSee = (foe: any): any | null => { const w = g.pair.watcher(foe, mate); if (w) return w; const hp = foe.char.bones?.hips ?? [foe.char.pos[0], 1.0, foe.char.pos[2]];
      for (const h of shift()) { if (!up(h) || h === foe || h.held || h.team !== foe.team || flat(h.char.pos, hp) > 12) continue; const eye = eyeOf(h.char), cd = h.char.chestDir, dx = hp[0] - eye[0], dz = hp[2] - eye[2];
        if ((dx * cd[0] + dz * cd[2]) / ((Math.hypot(dx, dz) || 1) * (Math.hypot(cd[0], cd[2]) || 1)) < Math.cos(70 * Math.PI / 180)) continue;
        if (!g.col.segmentBlocked(eye, [hp[0], hp[1], hp[2]]) || !g.col.segmentBlocked(eye, [hp[0], hp[1] + 0.3, hp[2]]) || !g.col.segmentBlocked(eye, eyeOf(foe.char))) return h; } return null; };   // (his hips — or a hand above them, the point bodySeen asks for a man going down, or his head: a low crate hides the first and nothing else)
    /** one order on the watcher `Wm`: true when Sam left his spot over it (the walk is planned again) */
    function command(Wm: any, safe: Vec3 | null): boolean {
      const name = Wm.callsign ?? 'that man'; triedN.set(Wm, (triedN.get(Wm) ?? 0) + 1); let moved = false;
      const still = () => { const me = pos(); goal = safe && watched(me) && flat(me, safe) > 0.35 && flat(me, safe) < 4 ? safe : null;
        const cp = Wm.char.pos, dx = cp[0] - me[0], dz = cp[2] - me[2], L = Math.hypot(dx, dz) || 1, ca = Math.cos(1.1), sa = Math.sin(1.1); cursor([me[0] + (dx * ca - dz * sa) / L * 2.5, 0.2, me[2] + (dx * sa + dz * ca) / L * 2.5]); step(); };
      const off = (why: string) => { bump(O.why, why); say(`(the order on ${name} is off: ${why})`); };
      for (let i = 0; i < 60 && Math.hypot(pl().char.vel[0], pl().char.vel[2]) > 0.1; i++) still();
      const whyNot = g.orders.give('pairMark', { kind: 'foe', at: [Wm.char.pos[0], 0, Wm.char.pos[2]], foe: Wm }, 'all');
      O.given++; nextOrderT = t + K.cool;
      if (whyNot) { O.refused++; bump(O.why, `refused: ${whyNot}`); say(`order: take ${name} · on your mark — REFUSED: ${whyNot}`); fallIn('the order was refused'); return false; }
      say(`order: take ${name} · on your mark (Sam ${f1(flat(pos(), Wm.char.pos))} m from him; ${mate.callsign} ${f1(flat(mate.char.pos, Wm.char.pos))} m)`);
      const t0 = t; let marked = false, goT = 0, heldT = 0, wasHeld = false, anyway = false, doubled = false, setSeen = false;
      try {
        for (;;) {
          still();
          if (Wm.state === 'dead') { const by = out.out.find(o => o.who === name)?.by; if (by === 'partner') { O.landed++; say(`(${name} is down ${f1(t - t0)} s after the order: landed)`); } else off(`he went down by ${by ?? 'another hand'}`); break; }
          if (!mateUp()) { off('the partner is down'); break; }
          const J = g.pair.jobOf(mate);
          if (J && J.foe === Wm && J.t0 >= 0) { goT += DT; if (goT > K.go) { off('slow: his hands were on and the man is still up'); break; } continue; }   // (hands on: nothing calls that off)
          if (!J || J.foe !== Wm) { O.calledOff++; off(`called off by the partner: ${lastWords()}`); break; }
          if (anyRoused()) { off(roused(Wm) ? 'he roused' : 'another man roused'); break; }
          if (J.set && !setSeen) { setSeen = true; O.set++; if (rigOnSet) { const fn: () => void = rigOnSet; rigOnSet = null; fn(); for (let i = 0; i < (K.markFirst ? 8 : 45); i++) still(); continue; } }
          if (!marked) { if (J.set) { const w0 = g.pair.watcher(Wm, mate), fp = Wm.char.pos, torch = shift().filter(x => up(x) && x !== Wm && x.flashlight?.enabled && pointInView(g, x, [fp[0], 0.35, fp[2]])).map(x => x.callsign);
              say(`(at the mark: pair.watcher says ${w0 ? w0.callsign : 'nobody'} · where the man would lie reads ${r2(g.visibilityOf(lightEstimateAt(g, [fp[0], 0.35, fp[2]], () => true, true)))} on the steady lamps, ${r2(g.visibilityOf(lightEstimateAt(g, [fp[0], 0.35, fp[2]])))} with every light, torches too (the body rule's own reading; its bar is 0.22 from 5 m, 0.04 at 2 m) · men with that floor in their body view (12 m, 60°, a line) and a torch lit: ${torch.join(', ') || 'none'} · the chest rule: ${shift().filter(x => up(x) && x !== Wm).map(x => { const hp = Wm.char.bones?.hips ?? [fp[0], 1, fp[2]], eye = eyeOf(x.char), cd = x.char.chestDir, dx = hp[0] - eye[0], dz = hp[2] - eye[2]; return `${x.callsign} ${f1(flat(x.char.pos, hp))} m, chest ${Math.round(Math.acos(Math.max(-1, Math.min(1, (dx * cd[0] + dz * cd[2]) / ((Math.hypot(dx, dz) || 1) * (Math.hypot(cd[0], cd[2]) || 1))))) * 180 / Math.PI)}° off him, line to his hips ${g.col.segmentBlocked(eye, [hp[0], hp[1], hp[2]]) ? 'BLOCKED' : 'clear'}, a hand above them ${g.col.segmentBlocked(eye, [hp[0], hp[1] + 0.3, hp[2]]) ? 'BLOCKED' : 'clear'}`; }).join('; ') || 'nobody else up'})`);
              if (!K.markFirst) { let Y: any = wouldSee(Wm); for (let i = 0; i < K.look * 60 && !Y && Wm.state !== 'dead'; i++) { still(); Y = wouldSee(Wm); }   // (a look round before the word, as a player takes one)
                if (Y) { doubled = true; moved = true; O.doubles++; O.planned++; say(`NO MARK: ${Y.callsign} would see it (${g.pair.watcher(Wm, mate) === Y ? "the game's own watcher test" : `his chest holds ${name} inside 70°, ${f1(flat(Y.char.pos, Wm.char.pos))} m off, a line to him`}). THE DOUBLE, planned: Sam goes for ${Y.callsign}'s back (${f1(flat(pos(), Y.char.pos))} m off); the mark is given from there`);
                  const r = stalkTake(Wm, Y); goal = null; say(`the double: ${r}`);
                  if (r === 'landed') { O.doublesLanded++; O.landed++; } else { bump(O.why, `double (planned): ${r.replace(/\(.*\)/, '').trim()}`); if (Wm.state === 'dead' && out.out.find(o => o.who === name)?.by === 'partner') O.landed++; else say(`(no bare mark: the order on ${name} is cancelled)`); }
                  break; } }
              g.pair.mark('api'); marked = true; O.marks++; say(`the mark (${mate.callsign} set ${f1(t - t0)} s after the order)`); } else if (t - t0 > K.set) { off(`no 'set' in ${K.set} s (${lastWords()})`); break; } continue; }
          if (J.watcher) { const Y = J.watcher; if (!wasHeld) { O.watchedHolds++; say(`   (held: ${Y.callsign} has eyes on ${name})`); } wasHeld = true; heldT += DT;
            if (!doubled) { doubled = true; O.doubles++; say(`THE DOUBLE: Sam goes for ${Y.callsign}'s back himself (${f1(flat(pos(), Y.char.pos))} m off)`); moved = true;
              const r = stalkTake(Wm, Y); goal = null; say(`the double: ${r}`); if (r === 'landed') { O.doublesLanded++; O.landed++; } else bump(O.why, `double: ${r.replace(/\(.*\)/, '').trim()}`);
              if (Wm.state === 'dead' || r.startsWith('the job was called off') || r === 'a man roused') { if (r !== 'landed' && Wm.state === 'dead' && out.out.find(o => o.who === name)?.by === 'partner') O.landed++; break; }
              continue; }
            if (heldT > K.watch) { if (K.anyway && !anyway) { anyway = true; heldT = 0; g.pair.mark('api'); O.anyway++; say('the mark again: go anyway'); } else { off(`watched by ${Y.callsign} for ${K.watch} s`); break; } } }
          else { wasHeld = false; goT += DT; if (goT > K.go) { off(`slow: no takedown ${K.go} s after the mark (${lastWords()})`); break; } }
        }
      } finally { goal = null; if (pl().holstered && !pl().down && !pl().takedown) { I.pressed.add('KeyE'); try { step(25); } catch (e) { if (!(e instanceof Done)) throw e; } }   // (the pistol back in his hand: the OCP is its right button)
        fallIn(Wm.state === 'dead' ? 'on to the next' : 'the order is off'); }
      return moved;
    }
    /** held short for long enough, with an order left: the nearest watcher the menu would take */
    function tryOrder(held: number, me: number[], ah: number[], safe: Vec3 | null): 'none' | 'stayed' | 'moved' {
      if (arm !== 'orders' || held < K.hold || t < nextOrderT || !mateUp()) return 'none';
      const no = (why: string): 'none' => { if (why !== noWhy) { noWhy = why; bump(O.none, why); say(`(no order: ${why})`); } return 'none'; };
      if (O.given >= K.max) return no(`${K.max} orders given already`); if (!g.pair?.up) return no('the rows are not on the menu (g.pair.up is false)'); if (anyRoused()) return no('a man is roused');
      const all = [...new Set([...watchers(ah), ...watchers(me)])], men = all.filter(h => g.guards.includes(h));
      if (!men.length) return no(`the watcher is no guard (${all.map(x => x.callsign ?? 'a civilian').join(', ') || 'nobody'})`);
      const Ws = men.filter(h => g.pair.isFoe(h) && (triedN.get(h) ?? 0) < 2 && (!K.still || Math.hypot(h.char.vel[0], h.char.vel[2]) < 0.2)).sort((a, b) => flat(a.char.pos, me) - flat(b.char.pos, me));
      if (!Ws.length) return no(`${men.map(h => `${h.callsign}: ${!g.pair.isFoe(h) ? 'no order target (the fog of war hides him, or he is held)' : (triedN.get(h) ?? 0) >= 2 ? 'tried twice' : 'walking (QP_STILL)'}`).join(' · ')}`);
      noWhy = '';
      return command(Ws[0], safe) ? 'moved' : 'stayed';
    }

    /** A CAMERA ON THE WAY, as a player with the OCP reads one: a LIVE lens (not out, not broken) that has `p` inside its reach and its field of view — across
     *  its whole pan, in plan and in elevation (devices.ts updateCamera's Eye: range, fovDeg / 2 both ways off the lens's line) — with a clear line to a crouched man there */
    const camTried = new Map<any, number>();
    const camOn = (p: number[]): any | null => { for (const c of (g.devices?.cameras ?? []) as any[]) { const d = c.def, tg = c.target; if (!deviceAlive(tg) || tg.disabledUntil > g.time) continue;
        const range = d.range ?? DEVICE_DEFAULTS.range, half = (d.fovDeg ?? DEVICE_DEFAULTS.fovDeg) / 2 * Math.PI / 180, q: Vec3 = [p[0], 0.9, p[2]], to = [q[0] - d.pos[0], q[1] - d.pos[1], q[2] - d.pos[2]], L = Math.hypot(to[0], to[1], to[2]); if (L > range || L < 0.05) continue;
        const yawTo0 = Math.atan2(to[0], to[2]), wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a)), [y0, y1] = d.sweep ? [Math.min(d.sweep[0], d.sweep[1]), Math.max(d.sweep[0], d.sweep[1])] : [d.yaw, d.yaw], mid = (y0 + y1) / 2, off = Math.abs(wrap(yawTo0 - mid));
        if (off > (y1 - y0) / 2 + half) continue; if (Math.abs(Math.asin(to[1] / L) - (d.pitch ?? DEVICE_DEFAULTS.pitch)) > half) continue;
        if (g.col.segmentBlocked(d.pos, q) && g.col.segmentBlocked(d.pos, [p[0], 1.3, p[2]])) continue; return c; } return null; };
    /** stops short and puts it out; true when he spent time on it (the walk's clocks are moved on) */
    const camera = (me: number[], ah: number[]): boolean => { const c = camOn(ah) ?? camOn(me); if (!c || !g.player.ocp.ready() || t - (camTried.get(c) ?? -1e9) < 2.5 || pl().takedown) return false;
      camTried.set(c, t); goal = null; const nm = c.target.name, where = camOn(me) === c ? 'he is in its view' : 'the next steps are in its view'; say(`(camera ${nm}: ${where} — he stops at ${at(me)} and puts the OCP on it)`);
      const ok = ocp(nm); out.cams.tried++; if (ok) out.cams.out++; out.cams.log.push(`${f1(t)} ${nm} ${ok ? 'out' : 'NOT out'} from ${at(me)}`); return true; };
    /** walk the nav path to `p`; false when `stop()` says so, `max` seconds pass, he is wedged — or an order moved him (`replan`) */
    function go(p: number[], max: number, stop: (() => boolean) | null = null, again = 0): boolean {
      const path: number[][] = pathTo(p) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
      let t0 = t, mark = [...pos()], markT = t, held = 0, safe: Vec3 | null = null;
      for (const wp of path) { goal = [wp[0], 0, wp[2]];
        while (flat(pos(), wp) > (wp === path[path.length - 1] ? 0.3 : 0.55)) {
          { const me = pos(), d = flat(me, wp), k = Math.min(1, 1.8 / (d || 1)), tc = t; if (camera(me, [me[0] + (wp[0] - me[0]) * k, 0, me[2] + (wp[2] - me[2]) * k])) { t0 += t - tc; markT = t; goal = [wp[0], 0, wp[2]]; continue; } }
          if (!dash && held < PATIENCE) { const me = pos(), d = flat(me, wp), k = Math.min(1, 1.8 / (d || 1)), ah: Vec3 = [me[0] + (wp[0] - me[0]) * k, 0, me[2] + (wp[2] - me[2]) * k], here = watched(me);
            if (!here) safe = [me[0], 0, me[2]];
            const holding = !here && watched(ah), back = here && !!safe && flat(me, safe) > 0.35 && flat(me, safe) < 4;
            if (holding || back) {
              if (holding && held === 0) say(`(holds at ${at(me)}: the way ahead is watched by ${watchers(ah).map(x => x.callsign ?? 'a civilian').join(', ')})`);
              const tc = t, r = tryOrder(held, me, ah, safe); if (r !== 'none') { t0 += t - tc; markT = t; if (r === 'moved') { replan = true; goal = null; return false; } continue; }   // (the order's own seconds are not the walk's, nor the hold's patience)
              goal = holding ? null : safe; held += DT; out.held += DT; markT = t; max += DT; step(); if (stop && stop()) { goal = null; return false; } continue; }
            if (!here) held = 0; goal = [wp[0], 0, wp[2]]; }
          cursor([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max || (stop && stop())) { goal = null; return false; }
          if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.2) {
            if (g.doors.list.some((d: any) => d.isClosed() && flat(pos(), d.frameCentre) < 1.6)) { goal = null; return false; }   // (a shut leaf: the caller opens it)
            if (again >= 5) { out.stuck++; say(`(Sam is stuck at ${at(pos())} short of ${at(wp)})`); goal = null; return false; }
            const dx = wp[0] - pos()[0], dz = wp[2] - pos()[2], L = Math.hypot(dx, dz) || 1, sd = again % 2 ? -1 : 1, r = 0.9 + 0.25 * again;
            goal = [pos()[0] + dz / L * sd * r, 0, pos()[2] - dx / L * sd * r]; step(35);
            return go(p, max - (t - t0), stop, again + 1); } } }
      goal = null; return true;
    }
    function doorVerb(d: any, verb: string): boolean {
      for (let i = 0; i < 40; i++) { cursor([d.frameCentre[0], 1.0, d.frameCentre[2]]); step();
        if (g.nearby.some((r: any) => r.kind === 'door' && r.door === d && r.verb === verb) && g.selectVerb('door', verb)) { I.pressed.add('Space'); step(2); say(`door ${d.def.name}: ${verb}`); return true; } }
      say(`door ${d.def.name}: no '${verb}' row (rows: ${g.nearby.map((r: any) => `${r.kind}:${r.verb}`).join(' ') || 'none'})`); return false;
    }
    function openDoor(d: any): boolean {
      const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
      go(free([c[0] + nx * s * 0.95, 0, c[2] + nz * s * 0.95]), 25, () => !d.isClosed()); if (!d.isClosed()) return true; if (replan) return false;
      if (flat(pos(), c) > 2.2) { say(`door ${d.def.name}: Sam cannot get to it (he is at ${at(pos())})`); return false; }
      const ring = () => { const P = pl(); return P.codes?.size ? new Set([...P.keys, ...P.codes]) : P.keys; };
      if (g.doors.lockedOut(d, pos(), ring())) {
        if (!doorVerb(d, 'pick')) { out.doors.refused++; say(`door ${d.def.name}: locked (${String(d.lockId)}), and no pick is on offer (a careful man does not kick)`); return false; }
        if (!until(() => !g.doors.lockedOut(d, pos(), ring()) || !d.isClosed(), 10)) { out.doors.refused++; say(`door ${d.def.name}: the pick did not finish`); return false; }
        out.doors.picked++; say(`door ${d.def.name}: picked`); step(10); if (!d.isClosed()) return true; }
      for (const v of ['ease', 'push']) if (d.isClosed() && doorVerb(d, v)) { out.doors[v === 'ease' ? 'eased' : 'pushed']++; until(() => Math.abs(d.angle) > 0.9, 4); if (!d.isClosed()) return true; }
      if (d.isClosed()) { out.doors.refused++; say(`door ${d.def.name}: it has not given`); return false; }
      return true;
    }
    function travel(p: number[], max: number, stop: (() => boolean) | null = null): boolean {
      const t0 = t, failed = new Map<any, number>();
      for (let tries = 0; tries < 40 && t - t0 < max; tries++) {
        if (flat(pos(), p) < 0.35) return true; if (stop && stop()) return false;
        const d = doorOnPath(pathTo(p) ?? [p]);
        if (!d) { let ahead: any = null, k = 0; replan = false; if (go(p, max - (t - t0), () => (stop ? stop() : false) || (++k % 15 === 0 && !!(ahead = doorOnPath(pathTo(p) ?? [p])) && flat(pos(), ahead.frameCentre) < 2.2))) return true; if (stop && stop()) return false; if (replan) { replan = false; continue; }
          if (!ahead && !g.doors.list.some((x: any) => x.isClosed() && flat(pos(), x.frameCentre) < 1.6)) { const n = (failed.get(null) ?? 0) + 1; failed.set(null, n); if (n > 3) return false; } continue; }
        replan = false; if (!openDoor(d)) { if (replan) { replan = false; continue; } const n = (failed.get(d) ?? 0) + 1; failed.set(d, n); if (n >= 2) return false; continue; }
        const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? -1 : 1;
        go(free([c[0] + nx * s * 1.0, 0, c[2] + nz * s * 1.0]), 6, stop);   // (across the frame before the closer brings the leaf back)
      }
      return flat(pos(), p) < 0.35;
    }
    function ocp(name: string): boolean {
      const tg = g.targets.find((x: any) => x.name === name); if (!tg) return false;
      const P = pl(); if (P.slot !== 'pistol' || P.holstered) { I.pressed.add('Digit1'); step(40); }
      for (let i = 0; i < 120; i++) { cursor(tg.pos); step(); if (g.aimTarget === tg && g.player.ocp.ready()) { cursor(tg.pos); I.clicked |= 4; step(2); break; } }
      const ok = tg.disabledUntil > g.time; out.ocp[name] = ok; say(`OCP on ${name}: ${ok ? `out for ${f1(tg.disabledUntil - g.time)} s` : `NOT out (reticle on ${g.aimTarget?.name ?? 'nothing'})`}`); return ok;
    }

    // ───────────────────────────── the run
    hush();
    try {
      if (K.wait > 0) { say(`(stands on the start ${K.wait} s before he moves)`); until(() => false, K.wait); }
      step(20);
      say(`quiet pair · ${levelFile} · arm ${arm} · seed ${seed} · ${out.deal} · ${out.guards} guards, ${out.civilians} civilians · Sam at ${at(pos())}${mate ? ` · ${mate.callsign} at ${at(mate.char.pos)} (${g.orders.of(mate)?.order ?? 'no order'})` : ''}`);
      if (RIG) {   // ── the staged double (see the head): not a run of the mission
        if (arm !== 'orders' || !mate) throw new Done('error', '--rig wants the orders arm');
        const H = shift().filter(up); if (H.length < 2) throw new Done('stalled', 'the rig wants two living guards on this deal');
        const nav = g.col.nav, [A, B] = H, ok = (p: number[]) => !nav.isBlocked(p[0], p[2]), los = (a: number[], b: number[]) => !g.col.solidBlocked([a[0], 1.2, a[2]], [b[0], 1.2, b[2]]);
        let stage: { a: Vec3; b: Vec3; s: Vec3; m: Vec3; f: number[]; r: number[]; lit: number; litB: number } | null = null; const wantLit = RIG === 'double', RIG_LIT = env('QP_RIG_LIT', 0.3);
        const r = seeded(seed * 31 + 7), anchors: number[][] = [...(g.level.routes as any[]).flatMap(R0 => R0.points as number[][]), ...(g.quiet.block?.starts ?? []).map((S0: any) => S0.sam as number[])];   // (floor the level is known to have: its beats and its starts, and 7 m round them)
        for (let i = 0; i < 8000 && !(stage && (wantLit ? Math.abs(stage.lit - RIG_LIT) < 0.03 : stage.lit < 0.02)); i++) { const q = anchors[Math.floor(r() * anchors.length) % anchors.length], x = q[0] + (r() - 0.5) * 14, z = q[2] + (r() - 0.5) * 14, th = Math.floor(r() * 8) * Math.PI / 4, f = [Math.sin(th), Math.cos(th)], rt = [f[1], -f[0]];
          const P = (kr: number, kf: number): Vec3 => [x + rt[0] * kr + f[0] * kf, 0, z + rt[1] * kr + f[1] * kf], a = P(0, 0), b = P(5, 0), m = P(0, -7), s = P(3.5, -7), bb = P(5.8, 0);
          if (![a, b, m, s, bb, P(0, -1.2), P(0, -3.5), P(4.6, -3.5), P(5.8, -3.5)].every(ok) || !los(a, b) || !los(m, a) || !los(s, P(5.8, -3.5)) || !los(P(5.8, -3.5), bb) || !los(bb, b)) continue;
          const lit = g.pair.litAt(a); if (!stage || (wantLit ? Math.abs(lit - RIG_LIT) < Math.abs(stage.lit - RIG_LIT) : lit < stage.lit)) stage = { a, b, s, m, f, r: rt, lit, litB: g.pair.litAt(b) }; }
        if (!stage) throw new Done('stalled', 'the rig found no open floor for its figure (5 m × 7 m) on this level');
        const put = (x: any, p: Vec3, yaw: number) => { x.char.pos[0] = p[0]; x.char.pos[2] = p[2]; x.char.bodyYaw = x.char.aimYaw = yaw; x.hold = true; x.pinned = true; x.awareness = 0; x.state = 'patrol'; x.path = []; };
        const yawF = Math.atan2(stage.f[0], stage.f[1]), yawBA = Math.atan2(stage.a[0] - stage.b[0], stage.a[2] - stage.b[2]);
        put(A, stage.a, yawF); put(B, stage.b, yawF);
        for (const x of H.slice(2)) { x.hold = true; x.pinned = true; }   // (the others stand where they are: the rig is about two men)
        g.teleportPlayer([stage.s[0], 0, stage.s[2]]); mate.char.pos[0] = stage.m[0]; mate.char.pos[2] = stage.m[2];
        step(30); say(`RIG ${RIG}: ${A.callsign} at ${at(stage.a)} (his floor reads ${r2(stage.lit)} on the steady lamps) and ${B.callsign} 5 m to his right at ${at(stage.b)} (${r2(stage.litB)}), both looking the same way; ${mate.callsign} 7 m behind ${A.callsign}, Sam 7 m behind and 1.5 m inside ${B.callsign}. When ${mate.callsign} is set, ${B.callsign} is turned to look at ${A.callsign}${B.flashlight?.enabled ? ` (his torch is lit)` : ''}`);
        rigOnSet = () => { B.char.bodyYaw = B.char.aimYaw = yawBA; say(`RIG: ${B.callsign} turns to look at ${A.callsign}`); };
        const moved = command(A, null); try { step(120); } catch (e) { if (!(e instanceof Done)) throw e; }
        throw new Done(A.state === 'dead' && B.state === 'dead' ? 'done' : 'stalled', `rig ${RIG}: ${A.callsign} ${A.state === 'dead' ? 'down' : 'UP'}, ${B.callsign} ${B.state === 'dead' ? 'down' : 'UP'}${moved ? '' : ' (Sam never left his spot: no watcher was reported)'}`);
      }
      const R = M.serverRoom, entry = g.doors.byName(M.entryDoor);
      const inside: Vec3 = free([Math.min(R.x1 - 0.8, Math.max(R.x0 + 0.8, entry ? entry.frameCentre[0] : (R.x0 + R.x1) / 2)), 0, entry ? (entry.frameCentre[2] > R.z1 - 0.5 ? R.z1 - 1.2 : entry.frameCentre[2] < R.z0 + 0.5 ? R.z0 + 1.2 : (R.z0 + R.z1) / 2) : (R.z0 + R.z1) / 2]);
      { const laser = g.targets.find((x: any) => x.kind === 'device' && /laser_corridor/.test(x.name));   // the tripwire across the way in, put out from where he first has a line to its emitter
        if (laser && entry) { const stand = free([laser.pos[0] - (entry.frameCentre[0] > laser.pos[0] ? 3.2 : -3.2), 0, entry.frameCentre[2] + 1.0]); travel(stand, 90, () => g.mission.stage !== 'infiltrate'); ocp(laser.name); } }
      if (!travel(inside, 240, () => g.mission.stage !== 'infiltrate') && g.mission.stage === 'infiltrate') throw new Done('stalled', `never reached ${g.quiet.spot?.place ?? 'the place'} (at ${at(pos())})`);
      if (g.mission.stage === 'infiltrate') until(() => g.mission.stage !== 'infiltrate', 2);
      if (g.mission.stage === 'failed') until(() => false, 5);   // (down on the way: the step's own 3 s calls it)
      say(`in ${g.quiet.spot?.place ?? 'the place'} at ${f1(t)} s · stage ${g.mission.stage}`);
      { const camS = g.targets.find((x: any) => x.kind === 'device' && /cam_server/.test(x.name)); if (camS) ocp(camS.name); }
      const rack = M.rack.front as number[]; let stand: Vec3 | null = null;
      for (const [dx, dz] of [[0, 0.65], [0, -0.65], [0.65, 0], [-0.65, 0], [0, 0.9], [0, -0.9]]) { const q: Vec3 = [rack[0] + dx, 0, rack[2] + dz]; if (!g.col.nav.isBlocked(q[0], q[2]) && pathTo(q)) { stand = q; break; } }
      if (!stand) stand = free([rack[0], 0, rack[2]]);
      if (!travel(stand, 60) && flat(pos(), rack) > 1.0) throw new Done('stalled', `could not reach the holder's face (at ${at(pos())}, ${f1(flat(pos(), rack))} m off)`);
      { let pressed = false; for (let i = 0; i < 9 * 60 && !g.mission.pulled; i++) { cursor(rack); if (!pressed && g.selectVerb('objective', 'drive')) { I.pressed.add('Space'); pressed = true; say('the thing: Space on the holder\'s row'); } step(); if (pressed && g.mission.driveT < 0 && !g.mission.pulled && i % 60 === 59) pressed = false; }
        if (!g.mission.pulled) throw new Done('stalled', `the thing did not come out (pressed ${pressed}, driveT ${f1(g.mission.driveT)}, ${f1(flat(pos(), rack))} m off the holder)`); }
      say(`the thing is out at ${f1(t)} s · stage ${g.mission.stage}`);
      // out: whichever of the mission's ways out is the shortest walk from here, through its frame and a stride past it (careful, `--out short`)
      let o: number[] = M.exfilOut ?? [1, 0], xx = M.exfilX, xz = M.exfilZ, xd = g.doors.byName(M.exfilDoor), xn = 'the exit';
      { let bl = Infinity; for (const X of g.quiet.exits as any[]) { const p = pathTo([X.x - X.out[0] * 0.8, 0, X.z - X.out[1] * 0.8]); if (!p) continue; let l = 0, a = pos(); for (const b of p) { l += flat(a, b); a = b; } if (l < bl) { bl = l; o = X.out; xx = X.x; xz = X.z; xd = g.doors.byName(X.door); xn = X.name; } } say(`(makes for ${xn} at ${at([xx, 0, xz])})`); }
      const ex: Vec3 = [xx + o[0] * 0.9, 0, xz + o[1] * 0.9];
      if (xd) { const c = xd.frameCentre; travel(free([c[0] - o[0] * 1.0, 0, c[2] - o[1] * 1.0]), 300); if (xd.isClosed()) openDoor(xd); }
      goal = ex; until(() => false, 1); travel(ex, 60); goal = ex; until(() => false, 6);
      throw new Done('stalled', `past the thing but never out (at ${at(pos())}, stage ${g.mission.stage})`);
    } finally { unhush(); out.noticed = out.loud.length ? 'loud' : hot > 0 || Math.max(0, ...Object.values(out.aw)) > 0.75 || out.escalation >= 1 || civScared ? 'spotted' : looked || civStartled ? 'looked' : susp > 0 ? 'turned' : 'ghost';
      out.clean = out.noticed === 'ghost' || (out.noticed === 'turned' && suspAt.every(a => out.out.some(o => o.who === a.who && o.t - a.t >= 0 && o.t - a.t < 2.5))); }
  } catch (e) {
    if (e instanceof Done) { out.end = e.end; out.why = e.why; } else { out.end = 'error'; out.why = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 7).join('\n')}` : String(e); }
  }
  unhush(); out.t = r2(t); out.lit = frames ? r2(litSum / frames) : 0; out.held = r2(out.held);
  if (g) {
    try { out.stage = g.mission.stage; out.deal = g.quiet.summary(); const D = debriefOf(g); out.score = D.score; out.rating = D.rating; out.summary = D.summary; } catch (e) { out.why += ` · debrief threw: ${e instanceof Error ? e.message : String(e)}`; out.end = 'error'; }
    try { out.sw = { PAIRUP: !!PU.PAIRUP.on, PAIR: !!PO.PAIR.on, SNEAK: !!SN.SNEAK.on, SPOTTED: !!SP.SPOTTED.on }; out.stats = { pair: { ...PO.PAIR_STATS }, pairup: { ...(PU.PAIRUP_STATS ?? {}) }, sneak: { ...(SN.SNEAK_STATS ?? {}) }, spotted: { ...(SP.SPOTTED_STATS ?? {}) } };
      if (mate) { const p = mate.char.pos; out.mate = { state: mate.state === 'dead' ? 'down' : mate.state, dSam: r2(flat(p, g.player.char.pos)), out: (g.quiet.exits as any[]).some(x => outThrough(x, p)), words: [] }; } } catch { /* a courtesy */ }
  }
  if (out.mate) { const tr = out.trace.filter(l => / “/.test(l) && mate && l.includes(`${mate.callsign}: “`)); out.mate.words = tr.map(l => l.trim()).slice(-40); }
  if (verbose) { log(`${f1(t).padStart(6)}  END ${out.end} · noticed: ${out.noticed} — ${out.why}${out.summary ? ` · ${out.summary}` : ''}`);
    log(`        orders: given ${O.given} · refused ${O.refused} · set ${O.set} · marks ${O.marks} · landed ${O.landed} · called off ${O.calledOff} · watched holds ${O.watchedHolds} · doubles ${O.doublesLanded}/${O.doubles} (${O.planned} planned at 'set')${K.markFirst ? ' · QP_MARKFIRST' : ''} · cameras ${out.cams.out}/${out.cams.tried}${out.cams.log.length ? ` [${out.cams.log.join('; ')}]` : ''}${Object.keys(O.why).length ? ` · ${Object.entries(O.why).map(([k, n]) => `${n}× ${k}`).join(' · ')}` : ''}`);
    log(`        put out: ${out.out.map(o => `${o.who} by ${o.by} (${o.how}) at ${o.t}`).join(' · ') || 'nobody'} · switches ${JSON.stringify(out.sw)}${out.mate ? ` · partner ${out.mate.state}, ${out.mate.dSam} m from Sam, ${out.mate.out ? 'out through an exit' : 'still inside'}` : ''}`); }
  return out;
}

function report(runs: PairRun[], md: boolean, arms: Arm[]): string {
  const L: string[] = []; const med = (a: number[]) => { if (!a.length) return '—'; const s = [...a].sort((x, y) => x - y); return f1(s[Math.floor(s.length / 2)]); };
  const head = ['arm', 'runs', 'done', 'down', 'stalled', 'error', 'done+ghost', 'done+clean', 'ghost', 'turned', 'looked', 'spotted', 'loud', 'first noticed: Sam', 'partner', 'other', 'secs p50 (done)', 'score p50 (done)', 'out cold by Sam / partner', 'orders given / set / landed', 'refused / called off', 'doubles landed / tried (planned at set)', 'cameras put out / tried'];
  L.push(md ? `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|` : head.join('\t'));
  for (const arm of arms) { const rs = runs.filter(r => r.arm === arm); if (!rs.length) continue; const n = (e: string) => rs.filter(r => r.end === e).length, c = (k: Noticed) => rs.filter(r => r.noticed === k).length, done = rs.filter(r => r.end === 'done');
    const sum = (f: (r: PairRun) => number) => rs.reduce((a, r) => a + f(r), 0), fo = (w: string) => rs.filter(r => r.first && (w === 'other' ? r.first.on === '?' : r.first.on === w)).length;
    const row = [arm, rs.length, n('done'), n('down'), n('stalled'), n('error'), rs.filter(r => r.end === 'done' && r.noticed === 'ghost').length, rs.filter(r => r.end === 'done' && r.clean).length, c('ghost'), c('turned'), c('looked'), c('spotted'), c('loud'), fo('sam'), fo('partner'), fo('other'), med(done.map(r => r.t)), med(done.map(r => r.score ?? 0)),
      `${sum(r => r.out.filter(o => o.by === 'sam').length)} / ${sum(r => r.out.filter(o => o.by === 'partner').length)}`, `${sum(r => r.orders.given)} / ${sum(r => r.orders.set)} / ${sum(r => r.orders.landed)}`, `${sum(r => r.orders.refused)} / ${sum(r => r.orders.calledOff)}`, `${sum(r => r.orders.doublesLanded)} / ${sum(r => r.orders.doubles)} (${sum(r => r.orders.planned)})`, `${sum(r => r.cams.out)} / ${sum(r => r.cams.tried)}`];
    L.push(md ? `| ${row.join(' | ')} |` : row.join('\t')); }
  const b = md ? '- ' : '  ';
  for (const r of runs) if (!(r.end === 'done' && r.noticed === 'ghost')) { const F = r.first, deal = (r.deal ?? '').replace(/^on · /, '').replace(/ · \d+ ways? out.*$/, '');
    L.push(`${b}${r.arm}:${r.seed} ${r.end} at ${r.t} s · ${r.noticed}${r.clean ? ' (clean: the man who turned was out cold inside 2.5 s)' : ''}${F ? ` · first at ${F.t} s: ${F.by} ${F.how}, on ${F.on === '?' ? 'neither named' : F.on === 'sam' ? 'Sam' : 'the partner'} (${F.via}) at ${F.where}` : ''}${r.end !== 'done' ? ` — ${r.why.split('\n')[0]}` : ''}${r.out.length ? ` · put out: ${r.out.map(o => `${o.who} by ${o.by}, ${o.how}`).join('; ')}` : ''} · [${deal}]`); }
  const why: Record<string, number> = {}; for (const r of runs) for (const [k, n] of Object.entries(r.orders.why)) why[k] = (why[k] ?? 0) + n;
  const none: Record<string, number> = {}; for (const r of runs) for (const [k, n] of Object.entries(r.orders.none ?? {})) none[k] = (none[k] ?? 0) + n;
  if (Object.keys(none).length) L.push(`${b}held long enough and no order given, by reason: ${Object.entries(none).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k, n]) => `${n}× ${k}`).join(' · ')}`);
  if (Object.keys(why).length) L.push(`${b}orders that did not land, by reason: ${Object.entries(why).sort((a, c) => c[1] - a[1]).map(([k, n]) => `${n}× ${k}`).join(' · ')}`);
  const sw = runs.find(r => r.arm !== 'alone' && r.sw)?.sw, sa = runs.find(r => r.arm === 'alone' && r.sw)?.sw;
  if (sw || sa) L.push(`${b}switches at a run's end — with the partner: ${sw ? JSON.stringify(sw) : '—'} · alone: ${sa ? JSON.stringify(sa) : '—'}`);
  return L.join('\n');
}

const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
const cap = Number(flag('--cap') ?? 600), levelFile = flag('--level');
if (!levelFile) { console.error('usage: bun run tools/qa/quiet-pair.ts --level <file.json> [--seeds 1-12] [--arms alone,follow,orders] [--quiet N] [--jobs 4] [--cap 600] [--json out.json] [--md] | --trace <seed> --arm <arm> [--rig double]'); process.exit(2); }
const arms = (flag('--arms') ?? flag('--arm') ?? (RIG ? 'orders' : ARMS.join(','))).split(',') as Arm[]; for (const a of arms) if (!ARMS.includes(a)) { console.error(`an arm is one of ${ARMS.join(', ')}`); process.exit(2); }
if (RIG && RIG !== 'double' && RIG !== 'double-dark') { console.error('--rig is: double (a lit lane) | double-dark (the darkest lane)'); process.exit(2); }
const blank = (arm: Arm, seed: number, why: string): PairRun => ({ level: levelFile, arm, seed, rig: RIG, end: 'error', why, t: 0, stage: '', noticed: 'ghost', clean: false, errand: null, first: null, deal: null, guards: 0, civilians: 0, wait: K.wait, aw: {}, firsts: {}, escalation: 0, loud: [], civ: {}, out: [], orders: { given: 0, refused: 0, set: 0, marks: 0, landed: 0, calledOff: 0, watchedHolds: 0, anyway: 0, doubles: 0, doublesLanded: 0, planned: 0, why: {}, none: {}, log: [] }, stats: null, sw: null, mate: null, held: 0, doors: {}, ocp: {}, cams: { tried: 0, out: 0, log: [] }, stuck: 0, hits: 0, lit: 0, score: null, rating: null, summary: null, timeline: [], trace: [] });
if (has('--one')) {   // a child: one run, its JSON to --outfile
  const [a, s] = flag('--one')!.split(':'); const r = await one(Number(s), a as Arm, cap, false, levelFile); writeFileSync(flag('--outfile')!, JSON.stringify(r)); process.exit(0);
} else if (has('--trace')) {
  const r = await one(Number(flag('--trace')), arms[0], cap, true, levelFile); process.exit(r.end === 'error' ? 1 : 0);
} else {
  const seeds = seedsOf(flag('--seeds') ?? '1-12'), jobs = Math.max(1, Number(flag('--jobs') ?? 4)), dir = mkdtempSync(resolve(tmpdir(), 'quiet-pair-'));
  const todo: { arm: Arm; seed: number }[] = arms.flatMap(arm => seeds.map(seed => ({ arm, seed }))), runs: PairRun[] = []; let next = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: jobs }, async () => { for (;;) { const j = todo[next++]; if (!j) return; const f = resolve(dir, `${j.arm}-${j.seed}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.arm}:${j.seed}`, '--outfile', f, '--cap', String(cap), '--level', levelFile, ...(QUIET_PIN === null ? [] : ['--quiet', String(QUIET_PIN)]), ...(RIG ? ['--rig', RIG] : [])], { stdout: 'ignore', stderr: 'pipe' }); const errText = new Response(pr.stderr).text(), code = await pr.exited;   // (the pipe is drained while the child runs: a chatty one never blocks on it)
    let r: PairRun; try { r = JSON.parse(readFileSync(f, 'utf8')); } catch { r = blank(j.arm, j.seed, `the run's process exited ${code}: ${(await errText).slice(-600)}`); }
    runs.push(r); console.log(`  ${r.arm}:${r.seed} ${r.end} ${r.t} s · ${r.noticed}${r.rating ? ` · ${r.rating} ${r.score}` : ''}${r.orders.given ? ` · orders ${r.orders.landed}/${r.orders.given}` : ''}${r.end !== 'done' ? ` — ${r.why.split('\n')[0]}` : ''}`); } }));
  rmSync(dir, { recursive: true, force: true });
  runs.sort((a, b) => arms.indexOf(a.arm) - arms.indexOf(b.arm) || a.seed - b.seed);
  console.log(`${levelFile} · quiet mission${QUIET_PIN === null ? '' : ` (deal pinned ${QUIET_PIN})`} · careful Sam${K.wait ? ` · begun ${K.wait} s into the lap` : ''}${RIG ? ` · RIG ${RIG}` : ''} · seeds ${flag('--seeds') ?? '1-12'}`);
  console.log(report(runs, has('--md'), arms)); console.log(`${runs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ tool: 'quiet-pair', level: levelFile, stand: 'as shipped', pin: QUIET_PIN, knobs: K, rig: RIG, cap, bars: 'the rack errand (task rack) is not counted · clean = ghost, or turned with every man who turned out cold inside 2.5 s · pair-sneak.ts cls: loud = shot level ≥ 1 / guardShot / bang / kick · spotted = alert or search, awareness > 0.75, escalation ≥ 1, a civilian frightened · looked = awareness ≥ 0.5, a civilian startled · turned = suspicious · ghost = none', runs }));
  process.exit(runs.some(r => r.end === 'error') ? 1 : 0);
}
