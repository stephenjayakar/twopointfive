// The 'night' family (levels/office.script.ts program 'night' — THE NIGHT SHOWCASE, run by src/game/director.ts), through probes.ts:
//   bun run tools/qa/probes.ts night | night-run | night-restore | night-tour   [--verbose]
//   bun run tools/qa/night-probes.ts trace [--seed N]     the timeline for the choreographer: every beat / note / radio row with its show second, and where Sam and the three men
//                                                        are every two seconds (the harness this show's marks were walked with)
// All headless (the Director given the harness camera and Input as main.ts hands them over, the program started with director.start('night') and stepped in
// main.ts's order: game.update — the Director ticks inside it — then the camera on the show's look-at, lights, boxes):
//   night-run       the program runs itself to the end inside its authored length with the chapters' beats in order (the script's own D.expect.order list), every
//                   tapped row actually tapped (no 'tap:missed', no capped walk, no 'late' wait), the exchange taught Sam the side door's code BEFORE the keypad beat and the pad took it
//                   (the door came off its latch), the fixture under the corridor camera really out after the OCP, the drive really out, the mains really down after
//                   the breaker and back after the restrike, Kowalski down and hauled, Novak and Reyes never alert; Sam never hit, never down, nothing NaN; the camera
//                   pinned verbatim on every frame of the show up to the hand-over and free after it; two runs on different seeds land every spine beat inside a second
//                   of each other (the guards' construction dice do not reach the show)
//   night-restore   when it ends by itself (the hand-over) the floor is a fresh live encounter under the player's own flags — three fresh guards on their routes with
//                   lit torches, switches as authored, nothing in the air, Sam at the spawn playable, input free, the mission fresh; cut off with P mid-way, the same
//                   (breach-restore's checks)
//   night-tour      the OLD 13-stop tour (game/demo.ts, tools/qa/tour.ts's lap) still runs clean on the same Game straight after a night showcase
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';
const { Demo } = await import(`${ROOT}/src/game/demo.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { manifestOf } = await import(`${ROOT}/src/game/director.ts`);
const { buildLevel } = await import(`${ROOT}/src/scene/level.ts`);
const { isDaylight } = await import(`${ROOT}/src/game/lighting.ts`);

const DT = 1 / 60;
const VERBOSE = process.argv.includes('--verbose');
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
type Verdict = (ok: boolean, label: string, detail: string) => void;
function family(title: string): { verdict: Verdict; done: () => boolean } {
  console.log(`\n=== ${title} ===`); let all = true;
  return { verdict: (ok, label, detail) => { all &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); }, done: () => { console.log(`=== ${title.split(':')[0]}: ${all ? 'ALL PASS' : 'FAILURES above'} ===`); return all; } };
}
function upload(W: any) { W.engine.lights.upload(W.game.time); }

export interface NightRun {
  started: string | null; frames: number; showSecs: number; finished: boolean | null; timedOut: boolean; handedOverAt: number;
  rows: any[]; notes: Map<string, number>; noteData: Map<string, any>;
  hits: number; downAt: number; nan: string; alerts: string[]; sawSam: string[]; pinnedFrames: number; showFrames: number; drift: number; freeAfterHandover: boolean;
  fixtureOutAfterOcp: boolean | null; mainsDownAfterBreaker: boolean | null; mainsBackAfter: boolean | null; padOpen: boolean | null; codeBeforePad: boolean | null; pulled: boolean; kowDown: boolean; kowMoved: number;
  trace: string[]; maxChars: number;
  /** the world on the first frame after the hand-over: fresh guards on their route starts, Sam at the spawn */
  atHandover: { guardsOff: number[]; samOff: number } | null;
}
/** Run the night showcase on W to its end (or `abortAt` show seconds, then a P by hand = director.stop()). Everything the probes assert on comes back in one record. */
export function runNight(W: any, opts: { abortAt?: number; maxSecs?: number; seed?: number; trace?: boolean } = {}): NightRun {
  const { game, cam, input, level } = W; const D = game.director;
  D.attach({ cam, input });
  let finished: boolean | null = null; const prevEnd = D.onProgramEnd; D.onProgramEnd = (name: string, f: boolean) => { prevEnd?.(name, f); if (name === 'night') finished = f; };
  const started = D.start('night', opts.seed !== undefined ? { seed: opts.seed } : {});
  const R: NightRun = { started, frames: 0, showSecs: 0, finished: null, timedOut: false, handedOverAt: -1, rows: [], notes: new Map(), noteData: new Map(), hits: 0, downAt: -1, nan: '', alerts: [], sawSam: [], pinnedFrames: 0, showFrames: 0, drift: 0, freeAfterHandover: true,
    fixtureOutAfterOcp: null, mainsDownAfterBreaker: null, mainsBackAfter: null, padOpen: null, codeBeforePad: null, pulled: false, kowDown: false, kowMoved: 0, trace: [], maxChars: 0, atHandover: null };
  if (started !== null) return R;
  const serial = D.run.serial;
  const maxSecs = opts.maxSecs ?? 300; let lastFlash = 0;
  const panel = game.targets.find((t: any) => t.name === 'panel_corridor_20');
  const kow0 = v3.copy(game.guards[0].char.pos); let kowDownPos: Vec3 | null = null;
  const seenNotes = new Set<string>();
  while (D.run && D.run.serial === serial && !D.run.ended && R.frames < maxSecs / DT) {
    W.step(DT, D.frame?.look ?? null); upload(W);
    R.frames++;
    const t = D.run && D.run.serial === serial ? D.run.t : R.frames * DT;
    // per-frame tripwires
    if (game.player.hitFlash > 0.99 && game.player.hitFlash > lastFlash) R.hits++; lastFlash = game.player.hitFlash;
    if (game.player.down && R.downAt < 0) R.downAt = t;
    if (!R.nan) { const c = game.player.char; if (![c.pos[0], c.pos[2], c.bodyYaw, c.aimYaw, c.aimPitch].every(Number.isFinite)) R.nan = `player at ${f2(t)}`; for (const gd of game.guards) { const cc = gd.char; if (![cc.pos[0], cc.pos[2], cc.bodyYaw, cc.aimYaw, gd.speed, gd.awareness].every(Number.isFinite)) R.nan = `${gd.callsign} at ${f2(t)}`; } if (![cam.yaw, cam.pitch, cam.distance, ...cam.target].every(Number.isFinite)) R.nan = `camera at ${f2(t)}`; }
    for (const gd of game.guards) { if (gd.state === 'alert' && !R.alerts.some(a => a.startsWith(gd.callsign + '@'))) R.alerts.push(`${gd.callsign}@${f2(t)}`); if (gd.sawPlayerThisFrame && !R.sawSam.some(s => s.startsWith(gd.callsign))) R.sawSam.push(`${gd.callsign}@${f2(t)}`); }
    R.maxChars = Math.max(R.maxChars, 1 + game.guards.length);
    const veiled = (D.frame?.fade ?? 0) > 0.98;   // (the closing veil: the last pinned shot may already be released under it)
    R.showFrames++; if (cam.pin) { R.pinnedFrames++; R.drift = Math.max(R.drift, v3.dist(cam.target, cam.pin.look)); } else if (veiled) R.pinnedFrames++;
    // notes as they land, and the world checks keyed on them
    for (const r of D.rowsOf(serial)) { if (r.kind !== 'note' && r.kind !== 'radio' && r.kind !== 'camera') continue; const key = `${r.kind}:${r.what}@${Math.round(r.t * 60)}`; if (seenNotes.has(key)) continue; seenNotes.add(key);
      if (r.kind === 'note' && !R.notes.has(r.what)) { R.notes.set(r.what, r.t); R.noteData.set(r.what, r.data); }
      if (r.kind === 'note' && r.what === 'code:entered') R.codeBeforePad = game.player.codes.has('pad_side') && R.notes.has('code') && (R.notes.get('code')! < r.t);
    }
    const since = (n: string) => R.notes.has(n) ? t - R.notes.get(n)! : -1;
    if (R.fixtureOutAfterOcp === null && since('ocp:panel') > 1.0) R.fixtureOutAfterOcp = !!panel && panel.factor < 0.05;
    if (R.mainsDownAfterBreaker === null && since('ocp:breaker') > 1.5) R.mainsDownAfterBreaker = game.blackout.active;
    if (R.mainsBackAfter === null && since('mains:back') > 7) R.mainsBackAfter = !game.blackout.active && game.targets.filter((x: any) => x.mains && x.on && !x.broken).every((x: any) => x.factor > 0.5 || x.fluorescentFlicker);
    if (R.padOpen === null && since('code:entered') > 0.5) R.padOpen = !game.doors.byName('server_manager').latched || Math.abs(game.doors.byName('server_manager').angle) > 0.2;
    if (game.mission.pulled) R.pulled = true;
    const kow = game.guards.find((x: any) => x.callsign === 'Kowalski');
    if (kow && kow.state === 'dead' && !R.kowDown) { R.kowDown = true; kowDownPos = v3.copy(kow.char.bones.hips ?? kow.char.pos); }
    if (kow && kowDownPos && since('dragged') > 0 && since('dragged') < 0.1) R.kowMoved = v3.distXZ(kow.char.bones.hips ?? kow.char.pos, kowDownPos);
    if (opts.trace && R.frames % 120 === 0) R.trace.push(`t ${f2(t).padStart(6)}  sam (${f2(game.player.char.pos[0])},${f2(game.player.char.pos[2])})${game.player.crouch ? 'c' : ''}${game.player.holstered ? 'h' : ''} ${game.player.slot}  ` + game.guards.map((gd: any) => `${gd.callsign[0]} (${f2(gd.char.pos[0])},${f2(gd.char.pos[2])}) ${gd.state}${gd.script ? '·s' : ''}${gd.task ? '·' + gd.task.kind : ''} aw${(gd.awareness * 100) | 0}`).join('  ') + `  cam yaw ${f2(cam.yaw * 180 / Math.PI)} d ${f2(cam.distance)}${game.blackout.active ? '  DARK' : ''}`);
    if (opts.abortAt !== undefined && t >= opts.abortAt) { D.stop(false); break; }
  }
  R.timedOut = !!D.run && D.run.serial === serial && !D.run.ended; if (R.timedOut) D.stop(false);
  R.finished = finished; R.showSecs = R.frames * DT;
  if (finished === true) {   // the END (no hand-over since 08-13: the program restores the night and ends; main.ts opens the start card): half a second on, nothing of the show may hold and the floor is the fresh encounter
    R.handedOverAt = R.frames * DT;
    for (let i = 0; i < 30; i++) { W.step(DT); if (cam.pin || input.lockExcept || game.playerInvisible || game.quietUtility || game.puppet) R.freeAfterHandover = false; }
    R.atHandover = { guardsOff: game.guards.map((gd: any, i: number) => v3.distXZ(gd.char.pos, level.routes[i]?.points[0] ?? gd.char.pos)), samOff: v3.distXZ(game.player.char.pos, level.playerSpawn) };
  }
  R.rows = D.rowsOf(serial);
  for (const r of R.rows) if (r.kind === 'note' && !R.notes.has(r.what)) { R.notes.set(r.what, r.t); R.noteData.set(r.what, r.data); }
  void kow0; void level;
  return R;
}
function printTimeline(R: NightRun) {
  const rows = R.rows.filter(r => ['note', 'radio', 'camera', 'program', 'error', 'trigger'].includes(r.kind) || (r.kind === 'beat' && r.what !== 'start'));
  console.log(rows.map(r => `${f2(r.t).padStart(7)}  ${r.kind.padEnd(7)} ${r.beat.padEnd(9)} ${r.what}${r.data !== undefined ? ' ' + JSON.stringify(r.data) : ''}`).join('\n'));
}

// ---------------------------------------------------------------- night-run
export async function nightRun(): Promise<boolean> {
  const F = family('night-run: the night showcase runs itself to the end — the chapters in order, every row tapped, the code learned then keyed, the pool out, the drive out, the mains down and back, nobody alert, Sam never hit, the camera pinned then freed (levels/office.script.ts program night)');
  const level = buildLevel(); const M = manifestOf(level.script); const want = (M.expects.find((e: any) => e.kind === 'order' && e.program === 'night')?.beats ?? []) as string[];
  const runs: NightRun[] = [];
  for (const seed of [11, 12]) {
    Math.random = seeded(seed);
    const W: any = await standUp(); for (let i = 0; i < 30; i++) W.step(DT);
    const R = runNight(W, { seed: 100 + seed }); runs.push(R);
    if (VERBOSE) printTimeline(R);
    { const f: string[] = [];
      if (R.started !== null) f.push(`director.start refused: ${R.started}`);
      if (R.timedOut) f.push(`still running after ${f2(R.showSecs)} s`);
      if (R.finished !== true) f.push(`finished=${R.finished}`);
      if (R.showSecs < 150 || R.showSecs > 260) f.push(`show length ${f2(R.showSecs)} s (want 150‥260)`);
      if (!R.rows.some(r => r.kind === 'note' && r.what === 'end')) f.push("no 'end' note (the spine never reached its last beat)");
      const errs = R.rows.filter(r => r.kind === 'error'); if (errs.length) f.push(`beat errors: ${errs.map(r => r.beat + ': ' + r.what).join(' | ')}`);
      F.verdict(f.length === 0, `seed ${seed}: runs to its end by itself inside the authored length (no hand-over: the start card comes back)`, f.join('; ') || `${f2(R.showSecs)} s (${R.frames} frames), ended at ${f2(R.handedOverAt)} s, finished=${R.finished}`); }
    { const f: string[] = []; let k = -1;
      for (const w of want) { const tt = R.notes.get(w); if (tt === undefined) { f.push(`no '${w}'`); continue; } if (tt < k - 1e-6) f.push(`'${w}' out of order (${f2(tt)} < ${f2(k)})`); k = Math.max(k, tt); }
      const missed = R.rows.filter(r => r.kind === 'note' && (r.what.startsWith('tap:missed') || r.what === 'walk:capped' || r.what === 'blackout:byHand' || r.what === 'late'));   // ('late' = an untilT wait that ran its clock out: the show went on without the thing it waited for)
      if (missed.length) f.push(`nets fired: ${missed.map(r => `${r.what}@${f2(r.t)}${r.data ? JSON.stringify(r.data) : ''}`).join(' | ')}`);
      F.verdict(f.length === 0, `seed ${seed}: the spine's ${want.length} beats all present and in order (D.expect.order), no tap missed, no walk capped, no wait run out, no by-hand net`, f.join('; ') || want.map(w => `${w}@${f2(R.notes.get(w)!)}`).join(' ')); }
    { const f: string[] = [];
      if (R.codeBeforePad !== true) f.push(`code learned before the keypad beat: ${R.codeBeforePad}`);
      if (R.padOpen !== true) f.push(`side door off its latch after the code row: ${R.padOpen}`);
      if (R.fixtureOutAfterOcp !== true) f.push(`panel_corridor_20 out a second after the OCP: ${R.fixtureOutAfterOcp}`);
      if (!R.pulled) f.push('the drive never came out');
      if (R.mainsDownAfterBreaker !== true) f.push(`mains down after the breaker: ${R.mainsDownAfterBreaker}`);
      if (R.mainsBackAfter !== true) f.push(`every mains fixture back after the restrike: ${R.mainsBackAfter}`);
      if (!R.kowDown) f.push('Kowalski never went down'); else if (!(R.kowMoved > 1.5)) f.push(`the body was hauled ${f2(R.kowMoved)} m (want > 1.5)`);
      const sent = R.noteData.get('reyes:sent'); if (sent?.state !== 'suspicious') f.push(`Reyes not sent to the rack (state ${sent?.state})`);
      const gap = R.noteData.get('crossed')?.gap; if (!(gap >= 2 && gap <= 6)) f.push(`the crossing ${gap} m from Novak (want 2‥6)`);
      F.verdict(f.length === 0, `seed ${seed}: the systems paid off — the code learned in the hold then taken by the pad, the camera's fixture really out, the drive really out and Reyes really sent, the mains really down then back, the body hauled, the crossing 2‥6 m from Novak`, f.join('; ') || `hauled ${f2(R.kowMoved)} m; crossing ${gap} m; reyes ${sent?.state}@${f2(sent?.t)}`); }
    { const f: string[] = [];
      if (R.hits) f.push(`Sam hit ${R.hits}×`); if (R.downAt >= 0) f.push(`Sam down at ${f2(R.downAt)}`); if (R.nan) f.push(`NaN: ${R.nan}`);
      if (R.alerts.length) f.push(`alert: ${R.alerts.join(' ')}`); if (R.sawSam.length) f.push(`eyes on Sam: ${R.sawSam.join(' ')}`);
      if (R.maxChars > 8) f.push(`${R.maxChars} characters on a frame`);
      if (R.pinnedFrames < R.showFrames * 0.97) f.push(`camera pinned on ${R.pinnedFrames}/${R.showFrames} show frames`); if (R.drift > 1e-6) f.push(`camera drifted ${R.drift.toFixed(4)} m off its pin`);
      if (R.handedOverAt < 0) f.push('never ended'); else if (!R.freeAfterHandover) f.push('after the end something of the show still held (pin / input lock / invisible / quiet / puppet)');
      F.verdict(f.length === 0, `seed ${seed}: Sam never hit or down, nobody alert (eyes are moot: the showcase runtime keeps him invisible — ears are live), nothing NaN, ≤ 8 characters, the camera pinned verbatim through the show and free after the end`, f.join('; ') || `pinned ${R.pinnedFrames}/${R.showFrames}, drift ${R.drift.toFixed(4)} m, max ${R.maxChars} characters`); }
  }
  { // determinism across the two seeds: every spine beat within a second (Sam's side is fully scripted; the men are taken in hand at fixed show seconds)
    const [A, B] = runs; const f: string[] = []; let worst = 0, worstK = '';
    if (A && B) for (const w of want) { const a = A.notes.get(w), b = B.notes.get(w); if (a === undefined || b === undefined) continue; const d = Math.abs(a - b); if (d > worst) { worst = d; worstK = w; } if (d > 1.0) f.push(`${w}: ${f2(a)} vs ${f2(b)}`); }
    F.verdict(f.length === 0, 'two seeds: every spine beat lands within a second of itself', f.join('; ') || `worst ${worstK} ±${f2(worst)} s`); }
  return F.done();
}

// ---------------------------------------------------------------- night-restore (breach-restore's checks, both ways)
function restoredCheck(W: any, label: string, walkedSecs = 2): string[] {
  const { game, engine, level, input } = W; const f: string[] = [];
  const offMax = 1.5 + walkedSecs * 1.2;   // (a man whose route has no wait at its first point is already `walkedSecs` of patrol down its first leg)
  if (game.guards.length !== 3 || level.routes.length !== 3) f.push(`${label}: ${game.guards.length} guards / ${level.routes.length} routes`);
  game.guards.forEach((gd: any, i: number) => { if (gd.routeI !== i) f.push(`${label}: guard ${i} routeI ${gd.routeI}`); if (gd.state !== 'patrol' || gd.script || gd.hold || gd.pinned || gd.task) f.push(`${label}: guard ${i} ${gd.state} script ${!!gd.script} hold ${gd.hold} pinned ${gd.pinned} task ${gd.task?.kind}`); if (gd.char.id !== 10 + i) f.push(`${label}: guard ${i} id ${gd.char.id}`); if (v3.distXZ(gd.char.pos, level.routes[i].points[0]) > offMax) f.push(`${label}: guard ${i} ${f2(v3.distXZ(gd.char.pos, level.routes[i].points[0]))} m off his route start (> ${f2(offMax)})`); if (!gd.flashlight.enabled) f.push(`${label}: guard ${i}'s torch dark`); });
  if (isDaylight(game)) f.push(`${label}: day`);
  if (Math.abs(engine.settings.hazeDensity - 0.035) > 1e-9) f.push(`${label}: haze ${engine.settings.hazeDensity}`);
  if (game.items.items.length || game.events.length) f.push(`${label}: ${game.items.items.length} items / ${game.events.length} events left`);
  if (game.player.down || v3.distXZ(game.player.char.pos, level.playerSpawn) > 0.5) f.push(`${label}: player down ${game.player.down} at ${game.player.char.pos.map(f2)}`);   // (nobody presses a key in the harness: live or not, he stands where the restart put him)
  if (game.playerInvisible || game.godMode || game.quietUtility || game.touring || game.missionInTour || game.puppet) f.push(`${label}: flags invisible ${game.playerInvisible} god ${game.godMode} quiet ${game.quietUtility} touring ${game.touring} missionInTour ${game.missionInTour} puppet ${!!game.puppet}`);
  if (input.lockExcept) f.push(`${label}: input still locked`);
  if (game.blackout.active) f.push(`${label}: blackout active`);
  if (game.mission.stage !== 'infiltrate' || game.mission.pulled) f.push(`${label}: mission ${game.mission.stage} pulled ${game.mission.pulled}`);
  if (game.player.codes.size || game.player.keys.size) f.push(`${label}: Sam kept codes ${[...game.player.codes]} keys ${[...game.player.keys]}`);
  const authored = new Map<string, boolean>(); for (const sw of level.switchables) authored.set(sw.name, sw.on); for (const l of level.lights) authored.set(l.name, l.enabled);
  const wrong = game.targets.filter((t: any) => authored.has(t.name) && authored.get(t.name) !== t.on).map((t: any) => t.name); if (wrong.length) f.push(`${label}: switches not as authored: ${wrong.slice(0, 5).join(', ')}`);
  for (const d of game.doors.list) { const a0 = d.def.angle ?? 0; if (Math.abs(d.angle - a0) > 0.05 || d.locked !== !!d.def.locked || d.lockBroken) f.push(`${label}: door ${d.def.name} angle ${f2(d.angle)} (authored ${a0}) locked ${d.locked} broken ${d.lockBroken}`); }
  const wx = game.weather; if (wx && (Math.abs(wx.storm - 0.4) > 1e-9 || Math.abs(wx.rainRate - 0.3) > 1e-9)) f.push(`${label}: storm ${wx.storm} rain ${wx.rainRate} (set 0.4 / 0.3 before the show)`);
  if (W.cam?.pin) f.push(`${label}: the camera is still pinned`); if (W.input?.lockExcept) f.push(`${label}: input still locked`);
  if (game.playerInvisible || game.quietUtility || game.puppet || game.missionInTour) f.push(`${label}: a show flag still up (invisible ${game.playerInvisible} quiet ${game.quietUtility} puppet ${!!game.puppet} missionInTour ${game.missionInTour})`);
  return f;
}
export async function nightRestore(): Promise<boolean> {
  const F = family("night-restore: after the show — handed over at its end, or cut off with P mid-way — the night floor is a fresh live encounter under the player's own flags (director.ts exitShow / handOver)");
  for (const mode of ['finished', 'aborted-30', 'aborted-140'] as const) {
    Math.random = seeded(mode === 'finished' ? 21 : mode === 'aborted-30' ? 22 : 23);
    const W: any = await standUp(); const { game } = W;
    for (let i = 0; i < 30; i++) W.step(DT);
    game.weather.storm = 0.4; game.weather.rainRate = 0.3;   // NOT the show's own numbers (0.7 / 0.55 = also the module defaults): the restore has to put THESE back
    const torches = game.guards.map((gd: any) => gd.flashlight);
    const R = runNight(W, mode === 'finished' ? {} : { abortAt: mode === 'aborted-30' ? 30 : 140 });
    for (let i = 0; i < 120; i++) W.step(DT);   // two seconds of plain play afterwards
    const f = restoredCheck(W, mode, mode === 'finished' ? 2 + 0.5 : 2);   // (finished: runNight stepped half a second past the end, plus these two)
    if (mode === 'finished') { const H = R.atHandover; if (!H) f.push('no end frame'); else { if (H.samOff > 0.9) f.push(`half a second after the end Sam stood ${f2(H.samOff)} m off the spawn`); H.guardsOff.forEach((d, i) => { if (d > 1.2) f.push(`half a second after the end guard ${i} stood ${f2(d)} m off his route start`); }); } }
    if (R.started !== null) f.push(`never started: ${R.started}`);
    if (mode === 'finished' && R.finished !== true) f.push(`finished=${R.finished}`); if (mode !== 'finished' && R.finished !== false) f.push(`aborted run reported finished=${R.finished}`);
    game.guards.forEach((gd: any, i: number) => { if (gd.flashlight !== torches[i]) f.push(`guard ${i} has a different flashlight object`); });
    if (!R.rows.some(r => r.kind === 'note' && r.what === 'restore')) f.push("no 'restore' in the log");
    if (mode === 'finished' && !R.rows.some(r => r.kind === 'note' && r.what === 'end')) f.push("no 'end' in the log");
    F.verdict(f.length === 0, `${mode === 'finished' ? 'run to its end' : `P at ${mode.slice(8)} s`}: three fresh guards on their routes with their own lit torches, night, nothing in the air, Sam at the spawn playable, every switch and door as authored, the storm as it was, the mission fresh, no code kept, input free`, f.join('; ') || `show ${f2(R.showSecs)} s; ${game.guards.map((gd: any) => gd.callsign + ':' + gd.state).join(' ')}`);
  }
  return F.done();
}

// ---------------------------------------------------------------- night-tour: the old tour still runs clean straight after
export async function nightTour(): Promise<boolean> {
  const F = family('night-tour: the old 13-stop tour (game/demo.ts) runs clean on the same Game straight after a night showcase');
  Math.random = seeded(31);
  const W: any = await standUp(); const { game, cam, input, level } = W;
  for (let i = 0; i < 30; i++) W.step(DT);
  const R = runNight(W);
  for (let i = 0; i < 60; i++) W.step(DT);
  const demo = new Demo(game, cam, W.smoke, input);
  const f: string[] = []; let hits = 0, lastFlash = 0, stops = 0, lastShot = -1, threw = '';
  if (R.started !== null || R.finished !== true) f.push(`night: started ${R.started} finished ${R.finished}`);
  demo.start(); if (!demo.active) f.push('demo.start() did not go active');
  let frames = 0;
  while (demo.active && frames < 260 / DT) {
    let p: Vec3 | null = null;
    try { p = demo.update(DT); } catch (e) { threw = `demo.update threw at stop ${demo.shotI}: ${(e as Error).message}`; break; }
    if (!demo.active) break;
    game.player.visibility = 0.05;
    try { W.step(DT, p); } catch (e) { threw = `game.update threw at stop ${demo.shotI}: ${(e as Error).message}`; break; }
    frames++;
    if (demo.shotI !== lastShot) { lastShot = demo.shotI; stops = Math.max(stops, demo.shotI + 1); }
    if (game.player.hitFlash > 0.99 && game.player.hitFlash > lastFlash) hits++; lastFlash = game.player.hitFlash;
    if (game.guards.length !== level.routes.length) { f.push(`stop ${demo.shotI}: ${game.guards.length} guards vs ${level.routes.length} routes`); break; }
  }
  if (threw) f.push(threw);
  if (demo.active) { f.push(`tour still active after ${f2(frames * DT)} s`); demo.stop(); }
  if (stops < 13) f.push(`${stops} stops reached (want 13)`);
  if (hits) f.push(`Sam hit ${hits}×`);
  F.verdict(f.length === 0, '13 stops, no throw, guards = routes throughout, Sam never hit', f.join('; ') || `${stops} stops in ${f2(frames * DT)} s of tour after a ${f2(R.showSecs)} s night showcase`);
  return F.done();
}

if (import.meta.main) {   // bun run tools/qa/night-probes.ts [trace|run|restore|tour] [--seed N]
  const pick = process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'trace';
  const seedArg = process.argv.indexOf('--seed'); const seed = seedArg >= 0 ? Number(process.argv[seedArg + 1]) : 11;
  let ok = true;
  if (pick === 'trace') {
    Math.random = seeded(seed);
    const W: any = await standUp(); for (let i = 0; i < 30; i++) W.step(DT);
    const t0 = performance.now();
    const R = runNight(W, { seed: 100 + seed, trace: true });
    printTimeline(R);
    console.log('\n' + R.trace.join('\n'));
    console.log(`\nstarted=${R.started} finished=${R.finished} timedOut=${R.timedOut} ${f2(R.showSecs)} s handedOver@${f2(R.handedOverAt)} hits ${R.hits} alerts [${R.alerts}] saw [${R.sawSam}] nan '${R.nan}' pinned ${R.pinnedFrames}/${R.showFrames} drift ${R.drift.toFixed(4)} freeAfter ${R.freeAfterHandover}`);
    console.log(`fixtureOut ${R.fixtureOutAfterOcp} padOpen ${R.padOpen} codeBeforePad ${R.codeBeforePad} pulled ${R.pulled} mainsDown ${R.mainsDownAfterBreaker} mainsBack ${R.mainsBackAfter} kowDown ${R.kowDown} hauled ${f2(R.kowMoved)} m · wall ${((performance.now() - t0) / 1000).toFixed(1)} s`);
  }
  if (pick === 'run') ok = (await nightRun()) && ok;
  if (pick === 'restore') ok = (await nightRestore()) && ok;
  if (pick === 'tour') ok = (await nightTour()) && ok;
  process.exit(ok ? 0 : 1);
}
