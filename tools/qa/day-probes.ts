// The 'day' family (levels/office.script.ts program 'breach' — THE DAY SHOWCASE: the drill, then its LOUD HALF; src/game/director.ts runs it, src/game/breach.ts is the drill and the facade),
// through probes.ts:
//   bun run tools/qa/probes.ts day | day-run | day-destruction | day-restore     [--verbose]
//   bun run tools/qa/day-probes.ts trace [--seed N] [--rounds]    the loud half's timeline for the choreographer: every note / radio / camera / stimulus row with its show second, where the
//                                                                  two operatives and the four are every two seconds, every burst's rounds (who, into what, how near an operative it passed) —
//                                                                  the harness the loud half's marks and lines of fire were walked and traced with
// All headless (the Breach facade constructed as main.ts builds it, started with breach.start(), stepped breach.update → game.update → camera → lights, exactly as breach-probes.ts):
//   day-run          the whole day show runs itself to its end inside its authored length; the loud half's beats land in the script's own D.expect.order; four hostiles spawned, real rounds
//                    both ways (≥ 40 each way), all four down by the cut, both operatives out through breakroom_ext ALIVE and never hit, no capped leg / late wait on the spine, nothing NaN,
//                    the character budget (8) and MAX_LIGHTS held on every frame; and two seeds land every spine beat inside a second and a half of each other
//   day-destruction  what the loud minute did to the office UNDER the show (chaos 0.8 by the program's own knob while the player's reads 0): damage decals, paper stacks converted to
//                    sheets, a monitor dead, dust puffs, a ceiling tile from the charge, conference panes starred — counted off DESTR_STATS and the world; and NOTHING of it after the
//                    restore: statics' flags as authored, debris and hidden pools empty, showChaos null, chaosOf back to the harness's 0, no cast, night back (breach-restore's own checks)
//   day-restore      = breach-restore run past the loud half: finished, and cut off with P inside the firefight
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const { Breach } = await import(`${ROOT}/src/game/breach.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { isDaylight } = await import(`${ROOT}/src/game/lighting.ts`);
const { MAX_LIGHTS } = await import(`${ROOT}/src/render/lights.ts`);
const { DESTR_STATS, chaosOf } = await import(`${ROOT}/src/game/destruction.ts`);
const { manifestOf } = await import(`${ROOT}/src/game/director.ts`);
const { buildLevel } = await import(`${ROOT}/src/scene/level.ts`);
const { BoxFlag } = await import(`${ROOT}/src/scene/boxes.ts`);

const DT = 1 / 60;
const argv = process.argv.slice(2);
const VERBOSE = argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function upload(W: any) { W.engine.lights.upload(W.game.time); }

/** one round as the trace sees it: whose, where it stopped, whom it went into (a callsign, or ''), and how near each operative's chest the segment passed */
interface Round { t: number; who: string; team: string; to: Vec3; into: string; nearOne: number; nearTwo: number }
export interface DayRun {
  started: boolean; frames: number; showSecs: number; finished: boolean | null; timedOut: boolean; loudAt: number;
  rows: any[]; notes: Map<string, number>; noteData: Map<string, any>; radio: string[];
  rounds: Round[]; opRounds: number; redRounds: number; opHit: string; redsSpawned: number; redsDownAtCut: number; opsAliveAtCut: boolean | null; opsOutside: boolean | null;
  nan: string; maxChars: number; maxWanted: number; maxSteady?: number; pinnedFrames: number; drift: number; capped: string[]; late: string[]; errors: string[];
  destrDuring: Record<string, number>; hiddenDuring: number; debrisPeak: number; glassStars: number; chaosDuring: number; screensDead: number;
  trace: string[]; log: { t: number; what: string }[];
}
const segDist = (a: Vec3, b: Vec3, p: Vec3) => { const ab = v3.sub(b, a), ap = v3.sub(p, a); const L2 = v3.dot(ab, ab); const t = L2 > 1e-9 ? Math.max(0, Math.min(1, v3.dot(ap, ab) / L2)) : 0; return v3.dist(v3.mad(a, ab, t), p); };

/** Run the day show on W to its end (or `abortAt` show seconds → stop() by hand). Everything the probes and the trace read comes back in one record. */
export function runDay(W: any, opts: { abortAt?: number; maxSecs?: number; trace?: boolean; leaveRunningAt?: number; preRuns?: number } = {}): DayRun {
  const { game, cam, input } = W; const D = game.director;
  const breach = new Breach(game, cam, W.smoke, input);
  let finished: boolean | null = null; breach.onStop = (f: boolean) => { finished = f; };
  // `preRuns` shows started and stopped first: the Director keys a run's OWN dice (c.rand — the beats' waits) on its serial, not on Math.random, so a probe that wants a second
  // choreography stream (the page draws a new one on every P / replay) burns a serial or two before the run it measures
  for (let i = 0; i < (opts.preRuns ?? 0); i++) { breach.start(); W.step(1 / 60); breach.stop(); W.step(1 / 60); }
  const s0 = { ...DESTR_STATS };
  breach.start();
  const R: DayRun = { started: breach.active, frames: 0, showSecs: 0, finished: null, timedOut: false, loudAt: -1, rows: [], notes: new Map(), noteData: new Map(), radio: [], rounds: [], opRounds: 0, redRounds: 0, opHit: '', redsSpawned: 0, redsDownAtCut: -1, opsAliveAtCut: null, opsOutside: null,
    nan: '', maxChars: 0, maxWanted: 0, pinnedFrames: 0, drift: 0, capped: [], late: [], errors: [], destrDuring: {}, hiddenDuring: 0, debrisPeak: 0, glassStars: 0, chaosDuring: 0, screensDead: 0, trace: [], log: [] };
  if (!R.started) return R;
  const serial = D.run.serial; const maxSecs = opts.maxSecs ?? 200;
  const evSeen = new WeakSet<object>(); for (const e of game.events) evSeen.add(e); const seenRows = new Set<string>(); let lastTrace = -10;
  const cs = (id: number) => game.guards.find((x: any) => x.char.id === id)?.callsign ?? (id === 1 ? 'Sam' : `#${id}`);
  const teamOf = (id: number) => game.guards.find((x: any) => x.char.id === id)?.team ?? '?';
  while (breach.active && R.frames < maxSecs / DT) {
    const p = breach.update(DT);
    if (!breach.active) break;
    const deadBefore = new Set(game.guards.filter((x: any) => x.state === 'dead').map((x: any) => x.char.id));
    W.step(DT, p); upload(W);
    R.frames++;
    const t = D.run && D.run.serial === serial ? D.run.t : R.frames * DT;
    // budgets / NaN / camera
    R.maxChars = Math.max(R.maxChars, 1 + game.guards.length);
    R.maxWanted = Math.max(R.maxWanted, W.engine.lights.lights.filter((l: any) => l.enabled && l.intensity > 0).length);
    R.maxSteady = Math.max(R.maxSteady ?? 0, W.engine.lights.lights.filter((l: any) => !(l.ttl > 0)).length);   // the STEADY count spawnUnit throws on at MAX_LIGHTS (guards.ts) — the margin the show's cast lives inside
    if (!R.nan) { for (const gd of game.guards) { const c = gd.char; if (![c.pos[0], c.pos[2], c.bodyYaw, c.aimYaw, c.aimPitch, gd.speed].every(Number.isFinite)) R.nan = `${gd.callsign} at ${f2(t)}`; } if (![cam.yaw, cam.pitch, cam.distance, ...cam.target].every(Number.isFinite)) R.nan = `camera at ${f2(t)}`; }
    if (cam.pin) { R.pinnedFrames++; R.drift = Math.max(R.drift, v3.dist(cam.target, cam.pin.look)); }
    // the cast
    const units = D.run && D.run.serial === serial ? [...D.run.units.values()].map((u: any) => u.gd) : [];
    const ops = units.filter((x: any) => x.team === 'operative'), reds = units.filter((x: any) => x.team === 'hostile' && /^Red /.test(x.callsign));
    R.redsSpawned = Math.max(R.redsSpawned, reds.length);
    if (!R.opHit) for (const o of ops) if (o.state === 'dead') R.opHit = `${o.callsign} down at show ${f2(t)}`;
    // rounds this frame (guardShot events carry muzzle → where it stopped, and who fired)
    for (const e of game.events) {   // (the queue prunes itself: membership, not an index)
      if (evSeen.has(e)) continue; evSeen.add(e); if (e.kind !== 'guardShot' || !e.from || !e.to) continue;
      const one = ops.find((o: any) => o.callsign === 'Blue One'), two = ops.find((o: any) => o.callsign === 'Blue Two');
      const chest = (o: any) => o ? (o.char.bones.chest ?? v3.add(o.char.pos, [0, 1.1, 0])) : null;
      const c1 = chest(one), c2 = chest(two);
      let into = ''; for (const gd of game.guards) if (gd.state === 'dead' && !deadBefore.has(gd.char.id) && v3.dist(gd.char.bones.chest ?? gd.char.pos, e.to) < 0.9) into = gd.callsign;
      const rd: Round = { t, who: cs(e.who), team: teamOf(e.who), to: v3.copy(e.to), into, nearOne: c1 && e.who !== one.char.id ? segDist(e.from, e.to, c1) : NaN, nearTwo: c2 && e.who !== two.char.id ? segDist(e.from, e.to, c2) : NaN };
      if (R.loudAt >= 0) { R.rounds.push(rd); if (rd.team === 'operative') R.opRounds++; else if (rd.team === 'hostile') R.redRounds++; }
    }
    // rows as they land
    for (const r of D.rowsOf(serial)) {
      const key = `${r.kind}:${r.beat}:${r.what}@${Math.round(r.t * 60)}`; if (seenRows.has(key)) continue; seenRows.add(key);
      if (r.kind === 'note' && !R.notes.has(r.what)) { R.notes.set(r.what, r.t); R.noteData.set(r.what, r.data); if (r.what === 'loud') R.loudAt = r.t; }
      if (r.kind === 'note' && r.what === 'leg:capped') R.capped.push(`${r.data?.who}→(${r.data?.to}) @${f1(r.t)} (${r.beat})`);
      if (r.kind === 'note' && r.what === 'late') R.late.push(`${r.data?.what} @${f1(r.t)} (${r.beat})`);
      if (r.kind === 'error') R.errors.push(`${r.beat}: ${r.what}`);
      if (r.kind === 'radio') R.radio.push(`${f1(r.t)} ${r.what}`);
      if (opts.trace && R.loudAt >= 0 && (r.kind === 'note' || r.kind === 'radio' || r.kind === 'camera' || r.kind === 'stimulus' || r.kind === 'spawn' || r.kind === 'error' || r.kind === 'beat')) R.trace.push(`${f2(r.t).padStart(7)} L${f1(r.t - R.loudAt).padStart(5)}  ${r.kind.padEnd(8)} ${r.beat.padEnd(7)} ${r.what}${r.data !== undefined ? ' ' + JSON.stringify(r.data) : ''}`);
    }
    // destruction under the show
    if (R.loudAt >= 0) {
      R.chaosDuring = Math.max(R.chaosDuring, chaosOf(game));
      R.hiddenDuring = Math.max(R.hiddenDuring, (game.destr as any).hidden.size); R.debrisPeak = Math.max(R.debrisPeak, game.destr.debris.list.length);
      R.glassStars = Math.max(R.glassStars, game.decals.list ? game.decals.list.filter((d: any) => d.kind === 'glassHit').length : (game.decals.count ?? 0));
      R.screensDead = Math.max(R.screensDead, game.targets.filter((tg: any) => tg.broken && /^monitor/.test(tg.name)).length);
    }
    if (opts.trace && R.loudAt >= 0 && t - lastTrace >= 2) { lastTrace = t;
      const P = (gd: any) => gd ? `${gd.callsign.replace('Blue ', 'B').replace('Red ', 'R')}${gd.state === 'dead' ? '✝' : ''}(${f1(gd.char.pos[0])},${f1(gd.char.pos[2])}${gd.char.anim.crouch > 0.5 ? 'c' : ''})` : '';
      R.trace.push(`${f2(t).padStart(7)} L${f1(t - R.loudAt).padStart(5)}  · ${[...ops, ...reds].map(P).join(' ')} · doorN ${f2(game.doors.byName("breakroom_n")?.angle ?? NaN)} W ${f2(game.doors.byName("breakroom_w")?.angle ?? NaN)} · rounds op ${R.opRounds} red ${R.redRounds} · destr dec ${DESTR_STATS.decals - s0.decals} pap ${DESTR_STATS.papers - s0.papers} puf ${DESTR_STATS.puffs - s0.puffs} scr ${DESTR_STATS.screens - s0.screens} til ${DESTR_STATS.tiles - s0.tiles} deb ${game.destr.debris.list.length}`); }
    // the cut: who is standing
    if (R.notes.has('exfil:cut') && R.redsDownAtCut < 0) { R.redsDownAtCut = reds.filter((x: any) => x.state === 'dead').length + (4 - reds.length); R.opsAliveAtCut = ops.length === 2 && ops.every((o: any) => o.state !== 'dead'); R.opsOutside = ops.length === 2 && ops.every((o: any) => o.char.pos[2] > 24.2); }
    if (opts.abortAt !== undefined && t >= opts.abortAt) { breach.stop(); break; }
    if (opts.leaveRunningAt !== undefined && t >= opts.leaveRunningAt) return R;   // (the trace's freeze-frame: the show left mid-air for inspection)
  }
  R.timedOut = breach.active; if (R.timedOut) breach.stop();
  R.finished = finished; R.showSecs = R.frames * DT; R.rows = D.rowsOf(serial); R.log = breach.log;
  for (const k of Object.keys(DESTR_STATS)) R.destrDuring[k] = (DESTR_STATS as any)[k] - (s0 as any)[k];
  return R;
}

// ---------------------------------------------------------------- day-run
/** the loud half's spine beats, in the script's own D.expect.order (the second 'breach' order list in levels/office.script.ts) */
function loudOrder(): string[] { const M = manifestOf(buildLevel().script); const lists = M.expects.filter((e: any) => e.kind === 'order' && e.program === 'breach').map((e: any) => e.beats as string[]); return lists.find((l: any) => l[0] === 'loud') ?? []; }
export async function dayRun(): Promise<boolean> {
  const F = family("day-run: the day showcase runs itself to its end — the drill, then it goes loud: the loud half's beats in order, four spawned and four down by real rounds, both operatives out through the south door alive and never touched, budgets held, two seeds alike (levels/office.script.ts 'breach', director.ts)");
  const runs: DayRun[] = [];
  for (const seed of [11, 12]) {
    Math.random = seeded(seed);
    const W: any = await standUp(); for (let i = 0; i < 30; i++) W.step(DT);
    const R = runDay(W, { preRuns: seed === 12 ? 1 : 0 }); runs.push(R);   // (seed 12's run is the Director's SECOND: another c.rand stream for every wait in the beats, as a replay in the page gets — the cross-seed tolerance below then compares two choreographies, not one)
    const order = loudOrder(); const notes = [...R.notes.keys()];
    { const f: string[] = [];
      if (!R.started) f.push('the show did not start');
      if (R.timedOut) f.push(`still running after ${f2(R.showSecs)} s`); if (R.finished !== true) f.push(`finished=${R.finished}`);
      if (R.showSecs < 118 || R.showSecs > 150) f.push(`show length ${f2(R.showSecs)} s (want 118‥150 — the drill's ~28 s and the loud half's ~100)`);
      if (R.loudAt < 26 || R.loudAt > 31) f.push(`it went loud at show ${f2(R.loudAt)} s (want 26‥31: straight off the drill's cut)`);
      if (!order.length) f.push("no D.expect.order list beginning 'loud' in the script");
      let k = -1; for (const w of order) { const i = notes.indexOf(w); if (i < 0) { f.push(`no '${w}'`); continue; } if (i < k) f.push(`'${w}' out of order`); k = Math.max(k, i); }
      if (R.errors.length) f.push(`beat errors: ${R.errors.join(' | ')}`);
      if (R.capped.length) f.push(`capped legs: ${R.capped.join(' | ')}`);
      const spineLate = R.late.filter(x => /\((show|two)\)/.test(x)); if (spineLate.length) f.push(`late waits on the spine / Two: ${spineLate.join(' | ')}`);
      F.verdict(f.length === 0, `seed ${seed}: runs to its end inside the authored length; '${order.join(' → ')}' all logged in that order; no beat threw, no leg capped, nothing the spine or Two waited on came late`, f.join('; ') || `${f2(R.showSecs)} s of show (${R.frames} frames), loud at ${f2(R.loudAt)}; ${order.map(w => `${w}@${f1((R.notes.get(w) ?? NaN) - R.loudAt)}`).join(' ')}`); }
    { const f: string[] = [];
      if (R.redsSpawned !== 4) f.push(`${R.redsSpawned} hostiles spawned (want 4)`);
      if (R.opRounds < 40 || R.redRounds < 40) f.push(`rounds: operatives ${R.opRounds}, hostiles ${R.redRounds} (want ≥ 40 each way)`);
      const kills = R.rounds.filter(r => r.into && /^Red /.test(r.into) && r.team === 'operative'); if (new Set(kills.map(r => r.into)).size < 4) f.push(`operatives' rounds went into ${[...new Set(kills.map(r => r.into))].join(', ') || 'nobody'} (want all four)`);
      if (R.redsDownAtCut !== 4) f.push(`${R.redsDownAtCut} of the four down at the cut`);
      for (const w of ['h1:down', 'h2:down', 'h3:down', 'h4:down']) if (R.noteData.get(w)?.ok !== true) f.push(`${w} logged ok=${R.noteData.get(w)?.ok}`);
      if (R.opHit) f.push(`operative hit: ${R.opHit}`); if (R.opsAliveAtCut !== true) f.push('an operative dead at the cut'); if (R.opsOutside !== true) f.push(`operatives not both outside (south of the wall) at the cut: ${JSON.stringify(R.noteData.get('out')?.at)}`);
      const near = R.rounds.filter(r => r.team === 'hostile').map(r => Math.min(Number.isFinite(r.nearOne) ? r.nearOne : 99, Number.isFinite(r.nearTwo) ? r.nearTwo : 99)); const minNear = Math.min(...near);
      if (!(minNear >= 0.45)) f.push(`a hostile round passed ${f2(minNear)} m from an operative's chest (doctrine: ≥ 0.45 — their rounds are laid on the cover, never through him)`);
      const strays = R.rounds.filter(r => r.team === 'hostile' && r.into); if (strays.length) f.push(`hostile rounds went into ${strays.map(r => r.into).join(', ')}`);
      if (!R.noteData.get('bang')?.heard) f.push("the charge's bang never came (note bang.heard false)");
      if (!R.notes.has('smoke') || !R.notes.has('smoke2')) f.push('a smoke can missing');
      F.verdict(f.length === 0, `seed ${seed}: four spawned; ≥ 40 real rounds each way; every one of the four dropped by an OPERATIVE's round (h1‥h4 ok); no hostile round inside 0.45 m of an operative and none into anybody; the bang heard; both cans; both operatives alive and out past the south wall at the cut`, f.join('; ') || `rounds ${R.opRounds} / ${R.redRounds}; kills ${kills.map(r => `${r.who.replace('Blue ', 'B')}→${r.into.replace('Red ', 'R')}@L${f1(r.t - R.loudAt)}`).join(' ')}; nearest hostile pass ${f2(minNear)} m; out at ${JSON.stringify(R.noteData.get('out')?.at)}`); }
    { const f: string[] = [];
      if (R.nan) f.push(`NaN: ${R.nan}`);
      if (R.maxChars > 8) f.push(`${R.maxChars} characters on a frame (budget 8)`);
      if (R.maxWanted > MAX_LIGHTS) f.push(`${R.maxWanted} lights wanted a slot (MAX_LIGHTS ${MAX_LIGHTS})`);
      if ((R.maxSteady ?? 0) >= MAX_LIGHTS) f.push(`steady lights peaked at ${R.maxSteady} = the cap (MAX_LIGHTS): the next steady light in the level makes a spawn throw`);
      if (R.pinnedFrames < R.frames * 0.97) f.push(`camera pinned on ${R.pinnedFrames}/${R.frames} frames`); if (R.drift > 1e-6) f.push(`camera drifted ${R.drift.toFixed(4)} m off its pinned look-at`);
      if (W.cam.pin) f.push('camera still pinned after the show');
      const cams = R.rows.filter((r: any) => r.kind === 'camera').map((r: any) => r.what); for (const t of ['10:03 · corridor', 'contact front', 'the glass', '10:04 · cubicles', 'the aisle', 'the mouth', 'the charge', 'the south aisle', 'four down', 'smoke', 'bounds', '10:05 · south lot']) if (!cams.includes(t)) f.push(`no shot '${t}'`);   // (= every title in office.script.ts LS)
      F.verdict(f.length === 0, `seed ${seed}: nothing NaN; characters ≤ 8 and lights ≤ MAX_LIGHTS on every frame; the camera pinned verbatim throughout and free after; all twelve of the loud half's set-ups cut to`, f.join('; ') || `max ${R.maxChars} characters, ${R.maxWanted}/${MAX_LIGHTS} lights; pinned ${R.pinnedFrames}/${R.frames}; shots: ${cams.slice(5).join(' · ')}`); }
  }
  { // determinism across the harness's seeds: the show films the same (the guards' construction dice never reach it) — every spine beat inside a second and a half
    const [A, B] = runs; const order = loudOrder(); const f: string[] = []; let worst = 0, worstW = '';
    for (const w of order) { const a = (A.notes.get(w) ?? NaN) - A.loudAt, b = (B.notes.get(w) ?? NaN) - B.loudAt; const d = Math.abs(a - b); if (!(d <= 1.5)) f.push(`'${w}' at L${f1(a)} vs L${f1(b)}`); if (d > worst) { worst = d; worstW = w; } }
    F.verdict(f.length === 0, 'seeds 11 and 12 land every loud beat inside 1.5 s of each other', f.join('; ') || `worst: '${worstW}' ${f2(worst)} s apart; show ${f2(A.showSecs)} vs ${f2(B.showSecs)} s`);
  }
  return F.done();
}

// ---------------------------------------------------------------- day-destruction
export async function dayDestruction(): Promise<boolean> {
  const F = family("day-destruction: what the loud minute breaks UNDER the show at the program's own chaos 0.8 (the harness's knob reads 0), and that none of it outlives the veil (destruction.ts showChaos, director.ts c.chaos / restoreChaos, resetLevelState)");
  Math.random = seeded(11);
  const W: any = await standUp(); const { game } = W;
  for (let i = 0; i < 30; i++) W.step(DT);
  const flags0 = game.col.boxes.map((b: any) => b.flags);
  const stars0 = game.decals.list.filter((d: any) => d.kind === 'glassHit').length;
  if (chaosOf(game) !== 0) { F.verdict(false, 'the harness stands at chaos 0 before the show', `chaosOf ${chaosOf(game)}`); return F.done(); }
  const R = runDay(W);
  { const f: string[] = []; const d = R.destrDuring;
    if (!(R.chaosDuring >= 0.79 && R.chaosDuring <= 0.81)) f.push(`chaos read ${R.chaosDuring} under the show (want 0.8: the program's own)`);
    if (!(d.rounds >= 100)) f.push(`${d.rounds} rounds reached destruction.round (want ≥ 100)`);
    if (!(d.decals >= 15)) f.push(`${d.decals} damage decals (want ≥ 15)`);
    if (!(d.puffs >= 40)) f.push(`${d.puffs} dust puffs into the smoke solver (want ≥ 40)`);
    if (!(d.screens >= 1) || !(R.screensDead >= 1)) f.push(`screens: ${d.screens} hit, ${R.screensDead} lit monitor dead (want ≥ 1 each)`);
    if (!(d.tiles >= 1)) f.push(`${d.tiles} ceiling tiles (want ≥ 1: the charge alone is E 14 at 0.8)`);
    if (d.bangs !== 1) f.push(`${d.bangs} bangs reached destruction (want 1)`);
    if (!(R.glassStars - stars0 >= 2)) f.push(`${R.glassStars - stars0} conference panes starred (want ≥ 2)`);
    if (!(d.papers >= 1)) f.push(`${d.papers} paper stacks converted (want ≥ 1 — the burst Two walks over the stack behind Red 3)`);
    F.verdict(f.length === 0, 'under the show: chaos reads 0.8; ≥ 100 rounds stoke the heat; damage decals ≥ 15, dust puffs ≥ 40, a lit monitor dead, a paper stack up in sheets, ≥ 1 ceiling tile, the one bang, ≥ 2 conference panes starred', f.join('; ') || `decals ${d.decals} · puffs ${d.puffs} (−${d.puffsRefused}) · papers ${d.papers} (${d.sheets} sheets) · screens ${d.screens} (${R.screensDead} lit dead) · knocks ${d.knocks} · tiles ${d.tiles} · chairs spun ${d.chairSpins} · debris peak ${R.debrisPeak} · hidden statics peak ${R.hiddenDuring} · panes starred ${R.glassStars - stars0}`); }
  for (let i = 0; i < 120; i++) W.step(DT);   // two seconds of the night floor after the veil
  { const f: string[] = [];
    if (game.destr.showChaos !== null) f.push(`showChaos ${game.destr.showChaos} after the program`); if (chaosOf(game) !== 0) f.push(`chaosOf ${chaosOf(game)} after (the harness's 0 expected back)`);
    if (game.destr.debris.list.length) f.push(`${game.destr.debris.list.length} debris chunks left`); if ((game.destr as any).hidden.size) f.push(`${(game.destr as any).hidden.size} statics still hidden`);
    const changed = game.col.boxes.map((b: any, i: number) => b.flags !== flags0[i] ? i : -1).filter((i: number) => i >= 0); if (changed.length) f.push(`${changed.length} statics' flags differ from before the show (first #${changed[0]})`);
    const stars1 = game.decals.list.filter((d: any) => d.kind === 'glassHit').length; if (stars1) f.push(`${stars1} glass stars left on the panes`);
    if (game.decals.count) f.push(`${game.decals.count} decals left`);
    if (game.guards.some((x: any) => x.unit) || game.guards.length !== 3) f.push(`cast left: ${game.guards.map((x: any) => x.callsign).join(', ')}`);
    if (isDaylight(game)) f.push('still day');
    if (game.touring || game.quietUtility || game.godMode || game.playerInvisible) f.push('show flags still up');
    const brokenMon = game.targets.filter((t: any) => t.broken).map((t: any) => t.name); if (brokenMon.length) f.push(`broken targets left: ${brokenMon.slice(0, 4).join(', ')}`);
    F.verdict(f.length === 0, 'two seconds after the veil: showChaos null and chaosOf back to 0, no debris, no hidden static, every static flag as before the show, no decal or glass star, no broken screen, no cast, night, the show flags down', f.join('; ') || `statics ${flags0.length} all as before; guards ${game.guards.map((x: any) => x.callsign).join('/')}`); }
  return F.done();
}

// ---------------------------------------------------------------- day-restore (breach-restore's own checks, past the loud half: finished, and cut off inside the firefight)
export async function dayRestore(): Promise<boolean> {
  const F = family("day-restore: after the whole day show — run to its end, or cut off with P in the middle of the firefight — the night floor is exactly the start card's (breach-probes.ts restoredCheck)");
  const { restoredCheck } = await import('./breach-probes.ts');
  for (const mode of ['finished', 'aborted'] as const) {
    Math.random = seeded(mode === 'finished' ? 21 : 22);
    const W: any = await standUp(); const { game } = W;
    for (let i = 0; i < 30; i++) W.step(DT);
    const torches = game.guards.map((gd: any) => gd.flashlight);
    const R = runDay(W, mode === 'aborted' ? { abortAt: 62 } : {});   // (62 s of show: One trading down the aisle, four hostiles up, chaos 0.8, debris on the floor, a plume of dust in the solver)
    for (let i = 0; i < 120; i++) W.step(DT);
    const f: string[] = restoredCheck(W, mode);
    if (!R.started) f.push('never started');
    if (mode === 'finished' && R.finished !== true) f.push(`finished=${R.finished}`); if (mode === 'aborted' && R.finished !== false) f.push(`aborted run reported finished=${R.finished}`);
    if (mode === 'aborted' && !(R.loudAt > 0 && R.redsSpawned === 4)) f.push(`the abort came before the firefight (loud at ${R.loudAt}, ${R.redsSpawned} spawned)`);
    game.guards.forEach((gd: any, i: number) => { if (gd.flashlight !== torches[i]) f.push(`guard ${i} has a different flashlight object`); if (!gd.flashlight.enabled) f.push(`guard ${i}'s torch dark two seconds into play`); });
    if (game.destr.showChaos !== null || chaosOf(game) !== 0) f.push(`chaos: showChaos ${game.destr.showChaos}, chaosOf ${chaosOf(game)}`);
    if (game.destr.debris.list.length || (game.destr as any).hidden.size) f.push(`destruction left: ${game.destr.debris.list.length} chunks, ${(game.destr as any).hidden.size} hidden`);
    if (!R.log.some(b => b.what === 'restore')) f.push("no 'restore' in the log");
    F.verdict(f.length === 0, `${mode === 'finished' ? 'run to the end' : 'P at 62 s, inside the firefight'}: three fresh guards on three routes with their own lit torches, no sun / cast, night sky, nothing in the air, Sam at the spawn playable, switches as authored, input free, chaos back, nothing broken left`, f.join('; ') || `show ${f2(R.showSecs)} s; ${game.guards.map((gd: any) => gd.callsign + ':' + gd.state).join(' ')}`);
  }
  return F.done();
}

// ---------------------------------------------------------------- trace (the choreographer's timeline)
async function trace() {
  const si = argv.indexOf('--seed'); const seed = si >= 0 ? +argv[si + 1] : 11;
  Math.random = seeded(seed);
  const W: any = await standUp(); for (let i = 0; i < 30; i++) W.step(DT);
  W.game.director.strict = false;   // (a trace of a broken beat is still worth reading to its end)
  const pre = Math.max(0, +(argv[argv.indexOf('--pre') + 1] ?? 0) || 0);   // --pre N: burn N Director serials first (another c.rand stream)
  const R = runDay(W, { trace: true, preRuns: argv.includes('--pre') ? pre : 0 });
  console.log(R.trace.join('\n'));
  if (argv.includes('--rounds')) { console.log('\n--- rounds (loud half): t who → stopped at (into) · nearest pass to One / Two'); for (const r of R.rounds) console.log(`${f2(r.t).padStart(7)} ${r.who.padEnd(9)} → (${r.to.map(f1).join(', ')})${r.into ? ' INTO ' + r.into : ''} · one ${f2(r.nearOne)} two ${f2(r.nearTwo)}`); }
  const near = R.rounds.filter(r => r.team === 'hostile').map(r => Math.min(Number.isFinite(r.nearOne) ? r.nearOne : 99, Number.isFinite(r.nearTwo) ? r.nearTwo : 99));
  console.log(`\nshow ${f2(R.showSecs)} s (${R.frames} frames) finished=${R.finished} timedOut=${R.timedOut} · loud at ${f2(R.loudAt)} · reds spawned ${R.redsSpawned}, down at cut ${R.redsDownAtCut} · ops alive at cut ${R.opsAliveAtCut}, outside ${R.opsOutside} · opHit '${R.opHit}'`);
  console.log(`rounds: operatives ${R.opRounds}, hostiles ${R.redRounds} · hostile rounds' nearest pass to an operative: min ${f2(Math.min(...near))} m, under 0.5 m: ${near.filter(d => d < 0.5).length} · into men: ${R.rounds.filter(r => r.into).map(r => `${r.who}→${r.into}@${f1(r.t)}`).join(' ')}`);
  console.log(`destruction during: ${JSON.stringify(R.destrDuring)} · hidden statics peak ${R.hiddenDuring} · debris peak ${R.debrisPeak} · glass stars ${R.glassStars} · dead monitors ${R.screensDead} · chaos read ${R.chaosDuring}`);
  const kinds: Record<string, number> = {}; for (const r of R.rows) kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  console.log(`capped legs: ${R.capped.join(' | ') || 'none'}\nlate waits: ${R.late.join(' | ') || 'none'}\nerrors: ${R.errors.join(' | ') || 'none'}\nmax chars ${R.maxChars} · max lights wanted ${R.maxWanted}/${MAX_LIGHTS} · pinned ${R.pinnedFrames}/${R.frames} drift ${R.drift.toFixed(4)} · log rows ${R.rows.length} ${JSON.stringify(kinds)}`);
  console.log('\nradio:\n' + R.radio.join('\n'));
}

if (import.meta.main) {
  const pick = argv.find(a => !a.startsWith('--') && Number.isNaN(+a));
  if (pick === 'trace') { await trace(); process.exit(0); }
  let ok = true;
  if (!pick || pick === 'run') ok = (await dayRun()) && ok;
  if (!pick || pick === 'destruction') ok = (await dayDestruction()) && ok;
  if (!pick || pick === 'restore') ok = (await dayRestore()) && ok;
  process.exit(ok ? 0 : 1);
}
void BoxFlag; void VERBOSE;
