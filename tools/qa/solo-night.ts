// THE SOLO NIGHT PLAYED TO ITS END — the plain office after dark (the start card's Start, the mission list's first row, `?solo`), with a scripted Sam ON THE
// FLOOR who does the whole mission: from the spawn to the server room, the drive out of the marked rack, out through the fire exit. A measuring tool: nothing
// of the game is edited. It answers 'does the solo night play to an end' as a check instead of an inference, and files what the shift did on the way.
//   bun run tools/qa/solo-night.ts [--plan walk|sneak|rush] [--seeds 1-24] [--jobs 4] [--cap 420] [--json out.json] [--md] [--level kit-yard.json] [--base]
//   bun run tools/qa/solo-night.ts --trace <seed> [--plan …]       one run in this process with its timeline
//   --unseen (below) · --query '?hour=midday&weather=rain' = the page's own hour / weather keys laid on the plain night (his meter's stand-in counts no sun:
//   a daylight arm is for 'does it run', with --unseen, not for what the shift sees)
// THE STAND: the game as the PAGE stands it, not as the harness does (tools/qa/ships.ts's own list: GLASSFX=on, TPS_MOVES=1, TPS_TURN=1, TPS_CAST=1, chaos
// 0.5) — `--base` is the harness's own stand. The shift, the civilians, the devices and the needs are whatever the plain boot gives.
// THE SCRIPTED PLAYER (one man, his own feet and keys: WASD along the nav grid's path, Shift, C, Space on a row, the pistol's right button). He is MORTAL AND
// SEEN: no god mode, and his light meter is fed every frame from the CPU's estimate of the direct light on him (guards.ts lightEstimateAt, his own lights
// skipped — no bounce, no moon), through the game's own curve. He never fires a round, never throws, never grabs anybody. Three plans:
//   walk    a first-time player: upright at the default pace by the shortest way, shut doors pushed, the server room's lock picked, straight to the rack, out
//   sneak   a careful one: crouched all the way, doors eased, the lock picked, the pistol's OCP on the corridor tripwire's emitter before he crosses it and on
//           the server room's camera before he goes in (each skipped if the device is not on this level)
//   careful the sneak plan with eyes: what a player reads off the top-down picture — where each man is and which way he faces. He holds short of any stretch a
//           man's eye covers (his cone widened to 72°, anything inside 4.5 m whichever way he faces, a clear line to chest or head), steps back out of one
//           that sweeps onto him, and goes on when it has passed (45 s of patience a hold). No light, no sound in the rule: only lines of sight. Control sends the nearest
//           calm man to look at the dead rack 7 s after the pull, and the room's camera is out for 9 s only: `--out back` (default) he leaves at once by the
//           door he came in by and is careful again from the corridor on · `--out dash` he stands up and runs the shortest way, doors pushed · `--out
//           short` careful by the shortest way
//   rush    the loud one: sprinting, doors pushed, the server door KICKED
//   loud    the rush plan with the FN2000 in his hands: a round every 0.22 s at any man of the shift (never a civilian) he has a clear line of fire to inside
//           16 m, walking on as he fires; the drive pulled, he HOLDS the server room `--linger` seconds (60) and then for the response team if one was called (to 'deployed' + 20 s, 150 s
//           at most) and then leaves through whatever came. The arm that takes the night through its loud half: the alarm, the QRF, the perimeter
// `--god` = the sandbox's god mode (rounds do not drop him): with `loud`, the check that the loud half RUNS to the mission's end whatever his aim is worth.
// `--stand N` (with `loud --god`) = THE STAND: god carries him to the server room and through the shift; the moment the response team is on the floor he is
// mortal and holds the room N seconds, firing as before but not while a flashbang has his eyes. The run ends 'stood' or 'down', and its `stand` block says how
// long he lasted, what hit him, how many of the team he dropped and what drill they ran — the tally that sets one QRF drill against another on the same seeds.
// `--unseen` pins his light meter at 0.05 (the squad play-through's own commander: a man in the dark) — the arm that checks the MISSION'S MACHINERY end to end
// (door rows, the drive, the exit, the debrief) whatever the shift would have done to a man they can see; they still hear him.
// HE KNOWS THE FLOOR (where the door, the rack and the exit are: the objective marker shows a player the same) but nothing of where the men are.
// WHAT A RUN IS CALLED: done (out through the fire exit: the debrief card) · down (Sam dropped: the down card) · stalled (the script ran out of ways, or the
// time cap) · error (an exception, with its stack). Every run carries the debrief's own numbers (score, rating, counts), the chronicle's timeline in the
// card's words, every guard's first suspicious / search / alert second, the floor's highest escalation, the QRF's state, the civilians' states.
// THE HARNESS HAS NO GPU: no bounce light and no moon on his meter (a lit room reads darker than the page's meter would have it), no smoke, no picture, no sound.
import { resolve } from 'node:path';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const argv = process.argv.slice(2); const flag = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; }; const has = (n: string) => argv.includes(n);
const BASE = has('--base'), UNSEEN = has('--unseen'), GOD = has('--god'), GHOST = has('--ghost'), LINGER = Number(flag('--linger') ?? 60), OUT = flag('--out') ?? 'back', QUERY = flag('--query') ?? '', HARD = has('--hard'), STAND = Number(flag('--stand') ?? 0), STAND_AT = flag('--stand-at')?.split(',').map(Number) ?? null;   // --stand-at x,z: where in the room he makes the stand (default: where the drive left him, in the door's own line)   // --hard: the run on HARD (difficulty.ts setDifficulty('hard') once the game stands — its tables are the defenders' pressure and dig-in and the fog's cone)
// --quiet [N]: the level's QUIET MISSION (game/quiet.ts — its scenarios.quiet block) instead of the plain night: dealt off the run's seed, or pinned to deal N;
// --squad 1: with the one partner (the pair rules on, silent from the first frame; he follows by himself). The same scripted Sam, the mission's places read from the deal.
const EXIT = flag('--exit') ?? '';   // (--quiet only) leave by the way out whose name holds this, or whose door is named this; absent = the nearest on foot
const QUIET = has('--quiet'), QUIET_PIN = QUIET && /^\d+$/.test(flag('--quiet') ?? '') ? Number(flag('--quiet')) : null, MATE = QUIET && flag('--squad') === '1';
if (!BASE) for (const [k, v] of [['GLASSFX', 'on'], ['TPS_MOVES', '1'], ['TPS_TURN', '1'], ['TPS_CAST', '1'], ['TPS_OPENING', '1'], ['TPS_QRFSILENT', '1'], ['TPS_QRFSQUAD', '1']]) process.env[k] ??= v;   // (before any game module loads: they read these once)
const PLANS = ['walk', 'sneak', 'careful', 'rush', 'loud'] as const; type Plan = typeof PLANS[number];
const DT = 1 / 60;
type Vec3 = [number, number, number];
const f1 = (x: number) => x.toFixed(1), r2 = (x: number) => +x.toFixed(2);
const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const at = (p: number[]) => `(${f1(p[0])}, ${f1(p[2])})`;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
class Done extends Error { constructor(public end: string, public why = '') { super(end); } }

export interface SoloRun { quiet?: string; mate?: string; seed: number; plan: Plan; level: string; end: string; why: string; t: number; stage: string; pulledAt: number | null; roomAt: number | null; hits: number; downAt: number | null; stand?: { from: number; secs: number; hits: number; dazzled: number; downDazzled: boolean; teamDown: number; team: number; drills: number; drillsIn: number; beats: string[] };
  score: number | null; rating: string | null; summary: string | null; counts: Record<string, unknown> | null; escalation: number; qrf: string; firsts: Record<string, Record<string, number>>;
  civ: Record<string, string[]>; doors: Record<string, number>; held: number; rounds: number; qrfLog: string[]; god: boolean; lit: number; frames: number; unseen: boolean; ocp: Record<string, boolean>; stuck: number; timeline: string[]; trace: string[]; chars: number }

async function one(seed: number, plan: Plan, cap: number, verbose: boolean, levelFile: string | null): Promise<SoloRun> {
  const { standUp, ROOT } = await import('./headless.ts');
  // DESTRUCTION (src/game/destructionSwitch.ts, on builds that have it): the page raises the goal's one switch at boot unless the URL says ?nodestruction, the harness leaves
  // it off — so the as-shipped stand raises it here, before the level loads (SOLO_DESTR=0 = the page under ?nodestruction; --base never raises it)
  let DESTR = false;
  if (!BASE && process.env.SOLO_DESTR !== '0') { try { (await import(`${ROOT}/src/game/destructionSwitch.ts`)).DESTRUCTION.on = DESTR = true; } catch { /* a build from before the destruction goal: no such switch */ } }
  if (process.env.SOLO_CLEAR_M) { try { (await import(`${ROOT}/src/game/opening.ts`)).OPENING.clearM = Number(process.env.SOLO_CLEAR_M); } catch { /* a build from before the opening rule */ } }   // (the opening's clear radius, for a sweep: SOLO_CLEAR_M=8 — before the Game exists, its constructor places the men)
  const { lightEstimateAt, escalationOf } = await import(`${ROOT}/src/game/guards.ts`);
  const { debriefOf, fmtEvent } = await import(`${ROOT}/src/game/chronicle.ts`);
  const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);
  const { parseLevelData } = await import(`${ROOT}/src/scene/levelData.ts`);
  const { loadLevel } = await import(`${ROOT}/src/scene/levelLoad.ts`);
  const { withOfficeScript, isOfficeFamily } = await import(`${ROOT}/src/scene/level.ts`);
  const out: SoloRun = { seed, plan, level: levelFile ?? 'office.json', end: 'error', why: '', t: 0, stage: '', pulledAt: null, roomAt: null, hits: 0, downAt: null, score: null, rating: null, summary: null, counts: null, escalation: 0, qrf: 'idle', firsts: {}, civ: {}, doors: { pushed: 0, eased: 0, picked: 0, kicked: 0, refused: 0 }, held: 0, rounds: 0, qrfLog: [], god: GOD, lit: 0, frames: 0, unseen: UNSEEN, ocp: {}, stuck: 0, timeline: [], trace: [], chars: 0 };
  const log = console.log, err = console.error, warn = console.warn; const hush = () => { if (!verbose) console.log = console.error = console.warn = () => { }; }, unhush = () => { console.log = log; console.error = err; console.warn = warn; };
  let t = 0, standAt = -1, standHits = 0, standDazzled = 0; const say = (s: string) => { const line = `${f1(t).padStart(6)}  ${s}`; out.trace.push(line); if (verbose) log(line); };
  let g: any = null;
  try {
    Math.random = seeded(0x9137 + seed * 7919);   // (playthrough.ts's own seeding)
    const levelOf = (file: string): any => { const data = parseLevelData(readFileSync(resolve(ROOT, 'levels', file), 'utf8')); return isOfficeFamily(data) ? withOfficeScript(loadLevel(data)) : loadLevel(data); };
    hush(); const W: any = await standUp({ uploadEvery: 4, ...(levelFile ? { level: levelOf(levelFile) } : {}) }); unhush();
    g = W.game; const I = W.input, cam = W.cam, level = W.level; let M = level.mission;
    if (HARD) (await import(`${ROOT}/src/game/difficulty.ts`)).setDifficulty('hard', false);
    g.godMode = GOD || GHOST; if (GHOST) g.playerInvisible = true; if (!BASE) g.tune.chaos = 0.5;   // (--ghost: no eye finds him and nothing hurts him — the mission's own machinery start to debrief; --unseen is only DARK, and a man he walks into still sees him)
    if (QUERY) { const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); hush(); const r = startFromQuery(g, QUERY); unhush(); if (r.spec) throw new Done('stalled', `--query names a scenario (${r.spec.kind}): this tool plays the plain night only (a quiet mission: --quiet)`); }
    if (QUIET) { const { startFromQuery } = await import(`${ROOT}/src/game/scenarioRun.ts`); hush(); const r = startFromQuery(g, `?quiet${QUIET_PIN === null ? '' : '=' + QUIET_PIN}${MATE ? '&squad=1' : ''}`); unhush();
      if (r.why) throw new Done('stalled', `the quiet mission did not start: ${r.why}`); M = g.level.mission; out.quiet = g.quiet.summary(); }   // (the page's own road for ?hour= / ?sun= / ?weather= on a plain night)
    const pl = () => g.player, pos = (): number[] => g.player.char.pos;
    if (!M) throw new Done('stalled', 'this level has no mission block: nothing to pull, nowhere to leave by');
    const eyeOf = (c: any): Vec3 => c.bones?.head ?? [c.pos[0], c.pos[1] + 1.6, c.pos[2]], chestOf = (c: any): Vec3 => c.bones?.chest ?? [c.pos[0], c.pos[1] + 1.2, c.pos[2]];
    const everyone = (): any[] => [...g.guards, ...(g.civilians ?? [])];
    /** whose eyes Sam holds short of: everyone but the quiet mission's own partner (he is in g.guards and follows inside 4.5 m — careful Sam waited on his own man) */
    const eyes = (): any[] => { const ops: any[] = g.quiet?.ops ?? []; return ops.length ? everyone().filter(x => !ops.includes(x)) : everyone(); };
    const heardMsg = new WeakSet<object>();
    const was = new Map<any, string>(), civWas = new Map<any, string>(); let qrfWas = 'idle', escWas = 0, chronSeen = 0, goal: Vec3 | null = null, lastHit = -1;
    const after = () => {
      for (const x of g.guards) { const s = x.state, w = was.get(x); if (w !== s) { was.set(x, s); if (w !== undefined || s !== 'patrol') { const who = x.callsign ?? `id${x.char.id}`; (out.firsts[who] ??= {})[s] ??= r2(t); say(`   ${who}: ${w ?? '—'} → ${s} at ${at(x.char.pos)}${x.witness?.alertedBy ? ` (${x.witness.alertedBy})` : ''}`); } } }
      for (const x of g.civilians ?? []) { const s = x.civ?.state ?? x.state, w = civWas.get(x); if (w !== s) { civWas.set(x, s); const who = x.callsign ?? `civ${x.char.id}`; if (w !== undefined) { (out.civ[who] ??= []).push(`${f1(t)} ${s}`); say(`   ${who} (civilian): ${w} → ${s}`); } } }
      { const e = escalationOf(g); if (e !== escWas) { say(`   the floor: escalation ${escWas} → ${e}`); escWas = e; } out.escalation = Math.max(out.escalation, e); }
      for (const m of g.messages as { text: string }[]) { if (heardMsg.has(m)) continue; heardMsg.add(m); if (m.text.startsWith('radio: CONTROL')) { out.qrfLog.push(`${f1(t)} ${m.text.slice(7)}`); say(`   ${m.text}`); } }   // (control's own lines on the net — the cue a player hears: the HUD draws exactly these)
      { const q = g.qrf?.state ?? 'idle'; if (q !== qrfWas) { say(`   QRF: ${qrfWas} → ${q}`); out.qrfLog.push(`${f1(t)} ${q}`); qrfWas = q; out.qrf = q; } }
      { const h = g.player.hitFlash ?? 0; if (h > 0 && lastHit <= 0) { out.hits++; say(`   !! Sam is hit at ${at(pos())}`); } lastHit = h; }
      { const ev = g.chronicle.events as any[]; for (; chronSeen < ev.length; chronSeen++) { const line = fmtEvent(ev[chronSeen]); out.timeline.push(line); say(`   · ${line}`); } }
      out.chars = Math.max(out.chars, everyone().length + 1);
      for (const x of [g.player, ...everyone()]) { const p = x.char.pos; if (!Number.isFinite(p[0] + p[1] + p[2])) throw new Error(`NaN position on ${x.callsign ?? 'Sam'}`); }
    };
    let downT = -1, fireTick = 0, dash = false;
    function step(n = 1) {
      for (let i = 0; i < n; i++) {
        for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) I.keys.delete(k);
        const P = pl();
        if (goal && !P.down) { const dx = goal[0] - pos()[0], dz = goal[2] - pos()[2], d = Math.hypot(dx, dz);
          if (d > 0.12) { const { fwd, right } = cam.planarBasis(), a = (dx * fwd[0] + dz * fwd[2]) / d, b = (dx * right[0] + dz * right[2]) / d, T = 0.3827; if (a > T) I.keys.add('KeyW'); if (a < -T) I.keys.add('KeyS'); if (b > T) I.keys.add('KeyD'); if (b < -T) I.keys.add('KeyA'); } }
        if (plan === 'loud' && !P.down && !(standAt >= 0 && g.time < (P.dazzledUntil ?? 0))) { const gun = P.rifle, me = chestOf(P.char); let tg: any = null, bd = 16;
          for (const x of g.guards) { if (x.state === 'dead' || x.ko || x.char.alive === false) continue; const c = chestOf(x.char), d = Math.hypot(c[0] - me[0], c[2] - me[2]); if (d < bd && !g.col.shotBlocked(me, c)) { bd = d; tg = x; } }
          if (gun && gun.chamber === 0 && (gun.mag ?? 0) === 0 && gun.reloadT < 0 && (gun.spare.length || gun.infinite)) I.pressed.add('KeyR');
          if (tg && P.rifleUp) { W.cursorAt(chestOf(tg.char)); if (++fireTick % 13 === 0) { I.clicked |= 1; out.rounds += 1; } } }
        if ((plan === 'rush' || plan === 'loud' || dash) && goal) I.keys.add('ShiftLeft'); else I.keys.delete('ShiftLeft');
        { const low = (plan === 'sneak' || plan === 'careful') && !dash; if (!!P.crouch !== low && !P.takedown && !P.down && !P.picking) I.pressed.add('KeyC'); }   // (C is a press, never held)
        { const c = P.char, own = (o: number) => o === PLAYER_ID; P.visibility = UNSEEN ? 0.05 : g.visibilityOf(Math.max(lightEstimateAt(g, chestOf(c), own), lightEstimateAt(g, eyeOf(c), own))); out.lit += P.visibility; out.frames++; }
        W.step(DT); t += DT; after();
        if (g.mission.stage === 'done') throw new Done('done', QUIET ? String(g.chronicle.events[g.chronicle.events.length - 1]?.data?.text ?? 'out') : 'out through the fire exit');
        if (g.player.down) { if (downT < 0) { downT = t; out.downAt = r2(t); say(`   !! Sam is down at ${at(pos())}`); } if (t - downT > 3) throw new Done('down', `Sam dropped at ${at(pos())} in stage ${g.mission.stage}`); }
        if (t >= cap) throw new Done('stalled', `time cap in stage ${g.mission.stage} at ${at(pos())}`);
      }
    }
    const until = (pred: () => boolean, secs: number): boolean => { for (let i = 0; i < secs * 60 && !pred(); i++) step(); return pred(); };
    const cursor = (p: number[]) => W.cursorAt([p[0], p[1], p[2]]);
    const free = (p: number[]): Vec3 => { const nav = g.col.nav; const q = nav.isBlocked(p[0], p[2]) ? nav.nearestFreePoint(p[0], p[2]) : p; return q ? [q[0], 0, q[2]] : [p[0], 0, p[2]]; };
    const pathTo = (p: number[]): number[][] | null => g.col.nav.findPath(pos(), p, 8000);
    /** the first SHUT door the walk goes through (pair-sneak.ts's own test: a leg of the path crosses the leaf's line, jamb to jamb) */
    const doorOnPath = (path: number[][]): any | null => { let a = pos(); for (const b of path) { let best: any = null, bk = 2;
        for (const d of g.doors.list) { if (!d.isClosed()) continue; const H = d.def.hinge, th = d.def.closedDir, w = d.def.width + 0.15, hx = H[0] - Math.cos(th) * 0.15, hz = H[1] - Math.sin(th) * 0.15, ux = Math.cos(th) * (w + 0.15), uz = Math.sin(th) * (w + 0.15);
          const rx = b[0] - a[0], rz = b[2] - a[2], den = rx * uz - rz * ux; if (Math.abs(den) < 1e-9) continue;
          const k = ((hx - a[0]) * uz - (hz - a[2]) * ux) / den, m = ((hx - a[0]) * rz - (hz - a[2]) * rx) / den; if (k >= 0 && k <= 1 && m >= 0 && m <= 1 && k < bk) { bk = k; best = d; } }
        if (best) return best; a = b; } return null; };
    /** careful: is the spot `p` under a man's (or a civilian's) eye right now — what a player reads off the picture */
    const watched = (p: number[]): boolean => { for (const x of eyes()) { const c = x.char; if (c.alive === false || x.ko || x.state === 'dead') continue; const eye = eyeOf(c), d = flat(eye, p); if (d > 17) continue;
        if (d > 4.5) { const hd = c.headDir ? c.headDir() : c.chestDir, lx = (c.chestDir[0] + hd[0]) / 2, lz = (c.chestDir[2] + hd[2]) / 2, L = Math.hypot(lx, lz) || 1; if (((p[0] - eye[0]) * lx + (p[2] - eye[2]) * lz) / (L * d) < 0.31) continue; }
        if (g.col.segmentBlocked(eye, [p[0], 1.1, p[2]]) && g.col.segmentBlocked(eye, [p[0], 1.6, p[2]])) continue; return true; } return false; };
    /** --ghost only: the man Sam is wedged against on the way to `wp` (no eye finds a ghost, but a body still stands in a gap). Never the quiet mission's own
     *  partner, who follows at his back */
    const inWay = (wp: number[]): any | null => { if (!GHOST) return null; const me = pos(), ops: any[] = g.quiet?.ops ?? []; let best: any = null, bd = 1.1;
      for (const x of everyone()) { const c = x.char; if (ops.includes(x) || c.alive === false || x.state === 'dead') continue; const d = flat(c.pos, me);
        if (d < bd && (c.pos[0] - me[0]) * (wp[0] - me[0]) + (c.pos[2] - me[2]) * (wp[2] - me[2]) > 0) { bd = d; best = x; } } return best; };
    /** … the walk that keeps a metre off him where the floor has another way (the nav grid's own per-cell price), and how near a walk passes him */
    const pathRound = (p: number[], man: any): number[][] | null => { const c = g.col.nav.cell, m = man.char.pos; return g.col.nav.findPath(pos(), p, 8000, (ix: number, iz: number) => Math.hypot((ix + 0.5) * c - m[0], (iz + 0.5) * c - m[2]) < 1.0 ? 60 : 1); };
    const passes = (path: number[][], m: number[]): number => { let a = pos(), best = Infinity; for (const b of path) { const ux = b[0] - a[0], uz = b[2] - a[2], L2 = ux * ux + uz * uz, k = L2 > 1e-9 ? Math.max(0, Math.min(1, ((m[0] - a[0]) * ux + (m[2] - a[2]) * uz) / L2)) : 0;
        best = Math.min(best, Math.hypot(m[0] - a[0] - ux * k, m[2] - a[2] - uz * k)); a = b; } return best; };
    /** walk the nav path to `p`; false when `stop()` says so, `max` seconds pass, or he is wedged. `round`: a man to keep off (the ghost's way round him) */
    function go(p: number[], max: number, stop: (() => boolean) | null = null, again = 0, round: any = null): boolean {
      const path: number[][] = (round ? pathRound(p, round) : null) ?? pathTo(p) ?? [p]; if (!path.length || flat(path[path.length - 1], p) > 0.05) path.push(p);
      const t0 = t; let mark = [...pos()], markT = t, held = 0, safe: Vec3 | null = null;
      for (const wp of path) { goal = [wp[0], 0, wp[2]];
        while (flat(pos(), wp) > (wp === path[path.length - 1] ? 0.3 : 0.55)) {
          if (plan === 'careful' && !dash && held < 45) { const me = pos(), d = flat(me, wp), k = Math.min(1, 1.8 / (d || 1)), ah: Vec3 = [me[0] + (wp[0] - me[0]) * k, 0, me[2] + (wp[2] - me[2]) * k], here = watched(me);
            if (!here) safe = [me[0], 0, me[2]];
            if (!here && watched(ah)) { if (held === 0) say(`(holds at ${at(me)}: the way ahead is watched)`); goal = null; held += DT; out.held += DT; markT = t; max += DT; step(); if (stop && stop()) return false; continue; }
            if (here && safe && flat(me, safe) > 0.35 && flat(me, safe) < 4) { goal = safe; held += DT; out.held += DT; markT = t; max += DT; step(); if (stop && stop()) { goal = null; return false; } continue; }
            if (!here) held = 0; goal = [wp[0], 0, wp[2]]; }
          cursor([wp[0], 1.1, wp[2]]); step(); if (t - t0 > max || (stop && stop())) { goal = null; return false; }
          if (flat(pos(), mark) > 0.15) { mark = [...pos()]; markT = t; } else if (t - markT > 1.2) {
            if (g.doors.list.some((d: any) => d.isClosed() && flat(pos(), d.frameCentre) < 1.6)) { goal = null; return false; }   // (a shut leaf: the caller opens it)
            { const man = inWay(wp);   // (the ghost against a standing man: round him where the floor has another way, else stand off until he walks on — a sidestep in a one-cell gap goes nowhere)
              if (man) { const alt = pathRound(p, man), m0 = [...man.char.pos];
                if (alt && passes(alt, m0) > 0.8 && again < 5) { say(`(goes round ${man.callsign ?? 'a man'} standing at ${at(m0)})`); return go(p, max - (t - t0), stop, again + 1, man); }
                say(`(waits: ${man.callsign ?? 'a man'} stands in the only way at ${at(m0)})`);
                const me = pos(), dx = me[0] - m0[0], dz = me[2] - m0[2], L = Math.hypot(dx, dz) || 1; goal = [m0[0] + dx / L * 1.6, 0, m0[2] + dz / L * 1.6];
                const w0 = t;   // (his stand is not Sam's walking time: the wait has its own minute, and a stand longer than that in the only way is a stall with his name on it)
                while (flat(man.char.pos, m0) < 1.2 && man.char.alive !== false && man.state !== 'dead') { step(); if (goal && flat(pos(), goal) < 0.3) goal = null;
                  if (t - w0 > 60 || (stop && stop())) { if (t - w0 > 60) { out.stuck++; say(`(${man.callsign ?? 'a man'} never left the only way at ${at(m0)})`); } goal = null; return false; } }
                return go(p, max - (w0 - t0), stop, again); } }
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
    /** stand a stride back from a shut door on his own side and open it the plan's way. False: no way through it */
    function openDoor(d: any): boolean {
      const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? 1 : -1;
      go(free([c[0] + nx * s * 0.95, 0, c[2] + nz * s * 0.95]), 25, () => !d.isClosed()); if (!d.isClosed()) return true;
      if (flat(pos(), c) > 2.2) { say(`door ${d.def.name}: Sam cannot get to it (he is at ${at(pos())})`); return false; }
      const ring = () => { const P = pl(); return P.codes?.size ? new Set([...P.keys, ...P.codes]) : P.keys; };
      if (g.doors.lockedOut(d, pos(), ring())) {
        if ((plan === 'rush' || plan === 'loud') && doorVerb(d, 'kick')) { out.doors.kicked++; until(() => !d.isClosed(), 4); return !d.isClosed() || !g.doors.lockedOut(d, pos(), ring()); }
        if (!doorVerb(d, 'pick')) { if (doorVerb(d, 'kick')) { out.doors.kicked++; until(() => !d.isClosed(), 4); return !d.isClosed(); } out.doors.refused++; say(`door ${d.def.name}: locked (${String(d.lockId)}), and neither a pick nor a boot is on offer`); return false; }
        if (!until(() => !g.doors.lockedOut(d, pos(), ring()) || !d.isClosed(), 10)) { out.doors.refused++; say(`door ${d.def.name}: the pick did not finish`); return false; }
        out.doors.picked++; say(`door ${d.def.name}: picked`); step(10); if (!d.isClosed()) return true; }
      const [first, second] = (plan === 'sneak' || plan === 'careful') && !dash ? ['ease', 'push'] : ['push', 'ease'];
      for (const v of [first, second]) if (d.isClosed() && doorVerb(d, v)) { out.doors[v === 'ease' ? 'eased' : 'pushed']++; until(() => Math.abs(d.angle) > 0.9, 4); if (!d.isClosed()) return true; }
      if (d.isClosed()) { out.doors.refused++; say(`door ${d.def.name}: it has not given`); return false; }
      return true;
    }
    /** to `p` by the shortest way, every shut door on it opened as he comes to it */
    function travel(p: number[], max: number, stop: (() => boolean) | null = null): boolean {
      const t0 = t, failed = new Map<any, number>();
      for (let tries = 0; tries < 24 && t - t0 < max; tries++) {
        if (flat(pos(), p) < 0.35) return true; if (stop && stop()) return false;
        const d = doorOnPath(pathTo(p) ?? [p]);
        if (!d) { let ahead: any = null, k = 0; if (go(p, max - (t - t0), () => (stop ? stop() : false) || (++k % 15 === 0 && !!(ahead = doorOnPath(pathTo(p) ?? [p])) && flat(pos(), ahead.frameCentre) < 2.2))) return true; if (stop && stop()) return false; if (!ahead && !g.doors.list.some((x: any) => x.isClosed() && flat(pos(), x.frameCentre) < 1.6)) { const n = (failed.get(null) ?? 0) + 1; failed.set(null, n); if (n > 3) return false; } continue; }
        if (!openDoor(d)) { const n = (failed.get(d) ?? 0) + 1; failed.set(d, n); if (n >= 2) return false; continue; }
        const c = d.frameCentre, th = d.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), s = (pos()[0] - c[0]) * nx + (pos()[2] - c[2]) * nz >= 0 ? -1 : 1;
        go(free([c[0] + nx * s * 1.0, 0, c[2] + nz * s * 1.0]), 6, stop);   // (across the frame before the closer brings the leaf back)
      }
      return flat(pos(), p) < 0.35;
    }
    /** the pistol's OCP on a device or a fixture by name (pairsneak.ts's own: the cursor on it, the right button once the reticle has snapped to it) */
    function ocp(name: string): boolean {
      const tg = g.targets.find((x: any) => x.name === name); if (!tg) return false;
      const P = pl(); if (P.slot !== 'pistol' || P.holstered) { I.pressed.add('Digit1'); step(40); }
      for (let i = 0; i < 120; i++) { cursor(tg.pos); step(); if (g.aimTarget === tg && g.player.ocp.ready()) { cursor(tg.pos); I.clicked |= 4; step(2); break; } }
      const ok = tg.disabledUntil > g.time; out.ocp[name] = ok; say(`OCP on ${name}: ${ok ? `out for ${f1(tg.disabledUntil - g.time)} s` : `NOT out (reticle on ${g.aimTarget?.name ?? 'nothing'})`}`); return ok;
    }

    // ───────────────────────────── the mission
    hush();
    try {
      if (Number(process.env.SOLO_WAIT) > 0) { say(`(stands on the spawn ${process.env.SOLO_WAIT} s before he moves)`); until(() => false, Number(process.env.SOLO_WAIT)); }   // SOLO_WAIT=S: the same plan begun S seconds into the patrols' lap — a fixed script against a fixed schedule is one sample; a sweep of this is the plan against every phase
      step(20); if (plan === 'loud') { I.pressed.add('Digit2'); step(60); }
      say(`the solo night · plan ${plan} · seed ${seed} · ${g.guards.length} guards, ${(g.civilians ?? []).length} civilians · Sam at ${at(pos())} · stage ${g.mission.stage}${DESTR ? " · destruction on" : ""}`);
      const R = M.serverRoom, entry = g.doors.byName(M.entryDoor), exit = g.doors.byName(M.exfilDoor);
      const inside: Vec3 = free([Math.min(R.x1 - 0.8, Math.max(R.x0 + 0.8, entry ? entry.frameCentre[0] : (R.x0 + R.x1) / 2)), 0, entry ? (entry.frameCentre[2] > R.z1 - 0.5 ? R.z1 - 1.2 : entry.frameCentre[2] < R.z0 + 0.5 ? R.z0 + 1.2 : (R.z0 + R.z1) / 2) : (R.z0 + R.z1) / 2]);
      if (plan === 'sneak' || plan === 'careful') {   // the tripwire across the way in, put out from where he first has a line to its emitter
        const laser = g.targets.find((x: any) => x.kind === 'device' && /laser_corridor/.test(x.name));
        if (laser && entry) { const stand = free([laser.pos[0] - (entry.frameCentre[0] > laser.pos[0] ? 3.2 : -3.2), 0, entry.frameCentre[2] + 1.0]); travel(stand, 90, () => g.mission.stage !== 'infiltrate'); ocp(laser.name); }
      }
      if (!travel(inside, 150, () => g.mission.stage !== 'infiltrate') && g.mission.stage === 'infiltrate') throw new Done('stalled', `never reached ${QUIET ? g.quiet.spot?.place ?? 'the room' : 'the server room'} (at ${at(pos())})`);
      if (g.mission.stage === 'infiltrate') until(() => g.mission.stage !== 'infiltrate', 2);
      if (g.mission.stage === 'failed') until(() => false, 5);   // (down on the way: the step's own 3 s calls it)
      out.roomAt = r2(t); say(`in ${QUIET ? g.quiet.spot?.place ?? 'the room' : 'the server room'} at ${f1(t)} s · stage ${g.mission.stage}`);
      if (plan === 'sneak' || plan === 'careful') { const camS = g.targets.find((x: any) => x.kind === 'device' && /cam_server/.test(x.name)); if (camS) ocp(camS.name); }
      // the drive: at the rack's face, the row tapped, hands on it until it is out
      const rack = M.rack.front as number[]; let stand: Vec3 | null = null;
      for (const [dx, dz] of [[0, 0.65], [0, -0.65], [0.65, 0], [-0.65, 0], [0, 0.9], [0, -0.9]]) { const q: Vec3 = [rack[0] + dx, 0, rack[2] + dz]; if (!g.col.nav.isBlocked(q[0], q[2]) && pathTo(q)) { stand = q; break; } }
      if (!stand) stand = free([rack[0], 0, rack[2]]);
      if (!travel(stand, 40) && flat(pos(), rack) > 1.0) throw new Done('stalled', `could not reach the rack's face (at ${at(pos())}, ${f1(flat(pos(), rack))} m off)`);
      { let pressed = false; for (let i = 0; i < 9 * 60 && !g.mission.pulled; i++) { cursor(rack); if (!pressed && g.selectVerb('objective', 'drive')) { I.pressed.add('Space'); pressed = true; say(QUIET ? `${g.quiet.thing}: Space on the holder's row` : 'the drive: Space on the rack\'s row'); } step(); if (pressed && g.mission.driveT < 0 && !g.mission.pulled && i % 60 === 59) pressed = false; }   // (knocked off it — a hit, a shove: the row again)
        if (!g.mission.pulled) throw new Done('stalled', `the drive did not come out (pressed ${pressed}, driveT ${f1(g.mission.driveT)}, ${f1(flat(pos(), rack))} m off the rack)`); }
      out.pulledAt = r2(t); say(`${QUIET ? g.quiet.thing : 'the drive'} is out at ${f1(t)} s · stage ${g.mission.stage}`);
      if (plan === 'careful' && OUT === 'dash') { dash = true; say('(the drive is out: he runs for the exit before the man sent to look at the rack gets there)'); }
      if (plan === 'careful' && OUT === 'back' && entry) {   // out the way he came, before the camera's 9 s are up, then careful again by whatever way the floor gives
        const c = entry.frameCentre, th = entry.def.closedDir, nx = -Math.sin(th), nz = Math.cos(th), mid = [(R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2], sIn = (mid[0] - c[0]) * nx + (mid[2] - c[2]) * nz >= 0 ? 1 : -1;
        say('(the drive is out: back out by the door he came in by)'); dash = true; go(free([c[0] + nx * sIn * 0.95, 0, c[2] + nz * sIn * 0.95]), 10);
        if (entry.isClosed()) openDoor(entry); go(free([c[0] - nx * sIn * 1.3, 0, c[2] - nz * sIn * 1.3]), 6); dash = false; }
      if (plan === 'loud' && LINGER > 0) { say(`(holds the server room ${LINGER} s: what comes?)`); until(() => false, LINGER); }
      if (plan === 'loud' && (g.qrf?.state ?? 'idle') !== 'idle') { say(`(waits in the server room for the response team: QRF ${g.qrf.state})`); const t1 = t; until(() => g.qrf.state === 'deployed' || t - t1 > 130, 131);
        // --stand N: THE STAND — from the moment the team is on the floor he is mortal (whatever --god carried him here), and holds the room N seconds or
        // until he is down or the team is; the run ends there ('stood' / 'down'), and `stand` on the run says how it went
        if (STAND > 0 && g.qrf.state === 'deployed') { g.godMode = false; g.playerInvisible = false; standAt = t; standHits = out.hits; if (STAND_AT) goal = [STAND_AT[0], 0, STAND_AT[1]]; say(`(mortal from here: stands in the server room up to ${STAND} s against the team)`);
          const up = () => g.qrf.men.filter((x: any) => x.state !== 'dead').length; until(() => { if (g.time < (g.player.dazzledUntil ?? 0)) standDazzled++; return up() === 0; }, STAND);
          throw new Done('stood', up() === 0 ? `the team is down ${f1(t - standAt)} s in` : `stood ${STAND} s: ${up()} of the team standing`); }
        until(() => false, 20); say(`(goes for the exit: QRF ${g.qrf.state}, ${g.guards.filter((x: any) => x.state !== 'dead').length} of the shift and the team standing)`); }
      // out: through the fire exit's frame and a stride past it
      // (a quiet mission: whichever of its ways out is the shortest walk from here, each facing its own way — game/quiet.ts; else the level's one exit, east unless it says)
      let o: number[] = M.exfilOut ?? [1, 0], xx = M.exfilX, xz = M.exfilZ, xd = exit;
      if (QUIET) { let bl = Infinity; for (const X of (g.quiet.exits as any[]).filter(X => !EXIT || X.name.includes(EXIT) || X.door === EXIT)) { const p = pathTo([X.x - X.out[0] * 0.8, 0, X.z - X.out[1] * 0.8]); if (!p) continue; let l = 0, a = pos(); for (const b of p) { l += flat(a, b); a = b; } if (l < bl) { bl = l; o = X.out; xx = X.x; xz = X.z; xd = g.doors.byName(X.door); } } say(`(makes for the way out at ${at([xx, 0, xz])})`); }
      const ex: Vec3 = [xx + o[0] * 0.9, 0, xz + o[1] * 0.9];
      if (xd) { const c = xd.frameCentre; travel(free([c[0] - o[0] * 1.0, 0, c[2] - o[1] * 1.0]), 200); if (xd.isClosed()) openDoor(xd); }
      goal = ex; until(() => false, 1); travel(ex, 60); goal = ex; until(() => false, 6);
      throw new Done('stalled', `past the drive but never out (at ${at(pos())}, stage ${g.mission.stage})`);
    } finally { unhush(); }
  } catch (e) {
    if (e instanceof Done) { out.end = e.end; out.why = e.why; } else { out.end = 'error'; out.why = e instanceof Error ? `${e.message}\n${(e.stack ?? '').split('\n').slice(1, 7).join('\n')}` : String(e); }
  }
  unhush(); out.t = r2(t);
  if (g && standAt >= 0) { const Q = g.qrf, P = g.player; out.stand = { from: r2(standAt), secs: r2((out.downAt ?? t) - standAt), hits: out.hits - standHits, dazzled: r2(standDazzled / 60), downDazzled: !!P.down && (P.dazzledUntil ?? 0) > (out.downAt ?? t), teamDown: Q.men.filter((x: any) => x.state === 'dead').length, team: Q.men.length, drills: Q.drills ?? 0, drillsIn: Q.drillsIn ?? 0, beats: Q.log.map((l: any) => `${f1(l.t)} ${l.what}`) }; }
  if (g && QUIET) { try { out.quiet = g.quiet.summary(); const m = g.quiet.ops[0]; if (m) out.mate = `${m.state === 'dead' ? 'down' : m.state} ${f1(flat(m.char.pos, g.player.char.pos))} m from Sam`; } catch { /* the summary is a courtesy */ } }
  if (g) { try { out.stage = g.mission.stage; const D = debriefOf(g); out.score = D.score; out.rating = D.rating; out.summary = D.summary; out.counts = D.counts as unknown as Record<string, unknown>; out.qrf = g.qrf?.state ?? 'idle'; } catch (e) { out.why += ` · debrief threw: ${e instanceof Error ? e.message : String(e)}`; if (out.end !== 'error') out.end = 'error'; } }
  if (verbose) log(`${f1(t).padStart(6)}  END ${out.end} — ${out.why}${out.summary ? ` · ${out.summary}` : ''}`);
  return out;
}

function report(runs: SoloRun[], md: boolean): string {
  const L: string[] = []; const by = new Map<string, SoloRun[]>(); for (const r of runs) { const k = `${r.level} · ${r.quiet ? `quiet${r.mate !== undefined ? ' + partner' : ''} · ` : ''}${r.plan}${r.unseen ? ' (unseen)' : ''}${r.god ? ' (god mode)' : ''}`; (by.get(k) ?? by.set(k, []).get(k)!).push(r); }
  const med = (a: number[]) => { if (!a.length) return '—'; const s = [...a].sort((x, y) => x - y); return f1(s[Math.floor(s.length / 2)]); };
  const head = ['level · plan', 'runs', 'done', 'down', 'stalled', 'error', 'secs p50 (done)', 'score p50 (done)', 'ratings', 'a guard alert', 'floor ≥ 1', 'QRF called', 'civilian frightened', 'stuck'];
  L.push(md ? `| ${head.join(' | ')} |\n|${head.map(() => '---').join('|')}|` : head.join('\t'));
  for (const [k, rs] of by) { const n = (e: string) => rs.filter(r => r.end === e).length, done = rs.filter(r => r.end === 'done');
    const rat: Record<string, number> = {}; for (const r of done) rat[r.rating ?? '?'] = (rat[r.rating ?? '?'] ?? 0) + 1;
    const row = [k, rs.length, n('done'), n('down'), n('stalled'), n('error'), med(done.map(r => r.t)), med(done.map(r => r.score ?? 0)), Object.entries(rat).map(([a, b]) => `${b} ${a}`).join(', ') || '—',
      rs.filter(r => Object.values(r.firsts).some(f => f.alert !== undefined)).length, rs.filter(r => r.escalation >= 1).length, rs.filter(r => r.qrf !== 'idle').length, rs.filter(r => Object.keys(r.civ).length > 0).length, rs.reduce((a, r) => a + r.stuck, 0)];
    L.push(md ? `| ${row.join(' | ')} |` : row.join('\t')); }
  for (const r of runs) if (r.quiet) L.push(`${md ? '- ' : '  '}${r.plan}:${r.seed} ${r.quiet}${r.mate ? ` · partner at the end: ${r.mate}` : ''}`);
  for (const r of runs) if (r.end !== 'done') L.push(`${md ? '- ' : '  '}${r.level} ${r.plan}:${r.seed} ${r.end} at ${r.t} s — ${r.why.split('\n')[0]}`);
  return L.join('\n');
}

const seedsOf = (s: string): number[] => s.split(',').flatMap(p => { const m = p.match(/^(\d+)-(\d+)$/); if (m) { const o: number[] = []; for (let i = +m[1]; i <= +m[2]; i++) o.push(i); return o; } return [Number(p)]; });
const cap = Number(flag('--cap') ?? 420), levelFile = flag('--level') ?? null;
const plans = (flag('--plan') ?? 'walk').split(',') as Plan[]; for (const p of plans) if (!PLANS.includes(p)) { console.error(`--plan is one of ${PLANS.join(', ')}`); process.exit(2); }
if (has('--one')) {   // a child: one run, its JSON to --outfile
  const [p, s] = flag('--one')!.split(':'); const r = await one(Number(s), p as Plan, cap, false, levelFile); writeFileSync(flag('--outfile')!, JSON.stringify(r)); process.exit(0);
} else if (has('--trace')) {
  const r = await one(Number(flag('--trace')), plans[0], cap, true, levelFile); process.exit(r.end === 'error' ? 1 : 0);
} else {
  const seeds = seedsOf(flag('--seeds') ?? '1-6'), jobs = Math.max(1, Number(flag('--jobs') ?? 4)), dir = mkdtempSync(resolve(tmpdir(), 'solo-night-'));
  const todo: { plan: Plan; seed: number }[] = plans.flatMap(plan => seeds.map(seed => ({ plan, seed }))), runs: SoloRun[] = []; let next = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: jobs }, async () => { for (;;) { const j = todo[next++]; if (!j) return; const f = resolve(dir, `${j.plan}-${j.seed}.json`);
    const pr = Bun.spawn(['bun', 'run', import.meta.path, '--one', `${j.plan}:${j.seed}`, '--outfile', f, '--cap', String(cap), ...(levelFile ? ['--level', levelFile] : []), ...(BASE ? ['--base'] : []), ...(EXIT ? ['--exit', EXIT] : []), ...(UNSEEN ? ['--unseen'] : []), ...(GOD ? ['--god'] : []), ...(GHOST ? ['--ghost'] : []), ...(HARD ? ['--hard'] : []), ...(STAND > 0 ? ['--stand', String(STAND)] : []), ...(STAND_AT ? ['--stand-at', STAND_AT.join(',')] : []), '--out', OUT, '--linger', String(LINGER), ...(QUERY ? ['--query', QUERY] : []), ...(QUIET ? (QUIET_PIN === null ? ['--quiet'] : ['--quiet', String(QUIET_PIN)]) : []), ...(MATE ? ['--squad', '1'] : [])], { stdout: 'ignore', stderr: 'pipe' }); const code = await pr.exited;
    let r: SoloRun; try { r = JSON.parse(readFileSync(f, 'utf8')); } catch { r = { seed: j.seed, plan: j.plan, level: levelFile ?? 'office.json', end: 'error', why: `the run's process exited ${code}: ${(await new Response(pr.stderr).text()).slice(-600)}`, t: 0, stage: '', pulledAt: null, roomAt: null, hits: 0, downAt: null, score: null, rating: null, summary: null, counts: null, escalation: 0, qrf: 'idle', firsts: {}, civ: {}, doors: {}, held: 0, rounds: 0, qrfLog: [], god: GOD, lit: 0, frames: 0, unseen: UNSEEN, ocp: {}, stuck: 0, timeline: [], trace: [], chars: 0 }; }
    runs.push(r); console.log(`  ${r.plan}:${r.seed} ${r.end} ${r.t} s${r.rating ? ` · ${r.rating} ${r.score}` : ''}${r.end !== 'done' ? ` — ${r.why.split('\n')[0]}` : ''}`); } }));
  rmSync(dir, { recursive: true, force: true });
  runs.sort((a, b) => plans.indexOf(a.plan) - plans.indexOf(b.plan) || a.seed - b.seed);
  console.log(report(runs, has('--md'))); console.log(`${runs.length} runs in ${Math.round((Date.now() - t0) / 1000)} s`);
  if (flag('--json')) writeFileSync(flag('--json')!, JSON.stringify({ tool: 'solo-night', stand: BASE ? 'harness' : 'as shipped', destruction: process.env.SOLO_DESTR === '0' ? 'off (SOLO_DESTR=0)' : BASE ? 'off (--base)' : 'on where the build has the switch', unseen: UNSEEN, god: GOD, query: QUERY, cap, runs }));
  process.exit(runs.some(r => r.end === 'error') ? 1 : 0);
}
