// The showcase tour, end to end, without a GPU: the real Demo (src/game/demo.ts) constructed the way main.ts does it — the headless Game, the real
// FollowCamera, the harness Input, the Game's null smoke object — started with demo.start() and stepped in main.ts's step() order (demo.update →
// game.update → camera with the tour's look-at → lights → boxes → input.endFrame) until it stops by itself, asserting on the way what the lead checks
// by hand after every merge:
//   - no exception, nothing NaN (player, guards, camera, doors, fade); player.hitFlash never rises (hits counted per stop — Sam must never be hit);
//   - stops 0‥12 entered in order, each for its authored duration, and the tour ends on its own at the hand-over stop (handedOver, quietUtility off);
//   - per stop: 2 (doors) the fire exit shut at enter, walked open by Sam with his hand on the leaf (anim.doorPush live ≥ 0.5 s), swung past a radian, Sam
//     through it onto the lot, and pulled back to a sliver, still swinging shut (or latched), by the cut · 3 (takedown) Sam holstered at enter (the takedown is a click with the hands
//     empty), the strike begun through that click (player.takedown seen), exactly one guard dead by its end, the staged one · 4 (the hold) the staged man grabbed in the arm variant
//     and 'held' inside 3 s (a warning if it took the beat's startGrab net rather than the Space tap on his 'grab him' row), ≥ 2 answers out of him, a colleague in the standoff with the alarm going
//     0 → 2 on the very frame he saw it (the hostage call's path), the hold ending by the shove, not one guard round in the stop (before the shove or after
//     it), and at exit nobody held / in a standoff / paired / posted, the tour flag back up, the alarm calm, the player's own mission object back, the
//     pistol drawn again, no key left down · 5 (firefight) the two posted men dead, zero hits · 6 (room clear) the conference door
//     pulled to, breached (unlatched) during, back at its authored angle after, ≥ 10 barks, the drill reaching 'resolve', nobody left scripted · 8 (drive
//     pull) a scratch mission that really gets pulled (by Space on the rack's row, not the beat's net), the rack's LEDs going dark, and the player's own mission
//     object / rack lights / server panel put back at exit; the alarm level stays 0 through every stop but 4;
//   - after the end: fresh calm patrols (no script / hold / pinned / task on anyone), puppet null, missionInTour off, escalation 0, no blackout, every
//     door at its authored angle + lock and every switchable at its authored state (both compared with a snapshot taken right after a fresh
//     restartEncounter()), a fresh 'infiltrate' mission, live controls (lockExcept null), the sandbox flags back as they were — checked the moment the
//     tour lets go and again after two more seconds of plain play.
// Headless artefact, set the way the browser would plausibly read it: the light meter never answers here, so player.visibility is pinned to --vis
// (default 0.05 = standing in the dark) on every Player the game creates.
//
//   bun run tools/qa/tour.ts [--hz 60] [--runs 1] [--seed N] [--laps 1] [--jitter 0.5] [--dirty] [--abort-at S[:frac]] [--vis 0.05] [--quiet] [--selftest]
//   exit code 1 if any run FAILs (so it can gate a merge); ≈ 3 s wall per lap at 60 Hz
//
// The tour has its own dice (guard reactT / spread / search wander, ragdoll twist): every run seeds Math.random (seed printed; --seed S replays run 1
// with S, run k with S+k-1), so a failure is reproducible from its seed with the same flags. --laps N presses P again after each finish on the same
// game (re-entrancy: does lap 3 still have rounds, canisters, a live guard to take down?). --jitter feeds an uneven clock (see JITTER). --dirty presses P
// on a played-on floor (see DIRTY). --abort-at S[:frac] presses P a second time `frac` (default 0.5) of the way through stop S of the last lap and checks
// what Demo.stop() hands back instead (see abortChecks). --selftest proves the tripwires are live: one aimed guard round into Sam during stop 1 and a NaN
// into a guard's awareness during stop 10 — exit 0 only if BOTH were reported (the run itself then FAILs, as it should).
import { standUp, ROOT } from './headless.ts';
import type { Vec3 } from './headless.ts';

const { Demo } = await import(`${ROOT}/src/game/demo.ts`);
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { fireWeapon, killGuard, hitPlayer } = await import(`${ROOT}/src/game/combat.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

// ---------------------------------------------------------------- args
const argv = process.argv.slice(2);
const arg = (k: string, d: string) => { const i = argv.indexOf(`--${k}`); return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : d; };
const HZ = Number(arg('hz', '60'));
const RUNS = Math.max(1, Number(arg('runs', '1')) | 0);
const LAPS = Math.max(1, Number(arg('laps', '1')) | 0);
const SEED0 = Number(arg('seed', String((Date.now() % 1000000) + 1)));
const VIS = Number(arg('vis', '0.05'));
const QUIET = argv.includes('--quiet');
const SELFTEST = argv.includes('--selftest');
const DIRTY = argv.includes('--dirty');   // press P on a floor that has been played on: a lock kicked in, a man dead, the mains tripped, the alarm up, Sam elsewhere, a lamp group off — the tour must still run clean and hand back the level as authored
const DOWN = argv.includes('--down');     // press P lying dead (Demo.start() then goes through restartEncounter instead of resetGuards)
const JITTER = Number(arg('jitter', '0'));  // 0 = fixed step; e.g. 0.5 = every frame's dt uniform in (1/hz)×[0.5, 1.5], plus a 50 ms hitch (main.ts's dt clamp) about every 3 s — the browser's clock, roughly
const ABORT = (() => { const s = arg('abort-at', ''); if (!s) return null; const [a, b] = s.split(':'); return { stop: Number(a), frac: b !== undefined ? Number(b) : 0.5 }; })();
const AIM_MODEL = arg('aim', 'on') !== 'off';   // --aim off: Game.tune.aimModel = false for the run (aim.ts — the same seed on / off is how 'the beats do not change under the model' is checked: the posted men are pinned, so lined up from their marks)
const DT = 1 / HZ;
const MAX_DT = 1 / 20;       // main.ts: dt = min(1/20, raw)
const STOPS = 13;            // the tour's contract: 13 stops, the last one the hand-over
/** the stops this harness knows by what they stage (demo.ts build() order): asserted per stop below, and the alarm level may only move inside HOLD */
const S = { torches: 1, doors: 2, takedown: 3, hold: 4, firefight: 5, clear: 6, smoke: 7, drive: 8, restrike: 10, handover: STOPS - 1 } as const;
const SETTLE_SECS = 2;       // plain live play after the tour has let go, still watched
if (ABORT && !(ABORT.stop >= 0 && ABORT.stop <= STOPS - 2 && ABORT.frac >= 0 && ABORT.frac < 1)) { console.error(`--abort-at S[:frac]: S in 0‥${STOPS - 2} (stopping in the hand-over stop ${STOPS - 1} is a normal finish), frac in [0, 1)`); process.exit(2); }

function mulberry32(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => (Number.isFinite(x) ? Number(x.toFixed(2)) : x);
const fin = (...xs: number[]) => xs.every(Number.isFinite);

interface StopRec { lap: number; i: number; caption: string; tDemo: number; tGame: number; tSim: number; simDur: number; frame: number; frames: number; dur: number; hits: number; says: number; notes: string[]; aborted?: boolean; }
interface RunReport { seed: number; pass: boolean; failures: string[]; warnings: string[]; stops: StopRec[]; frames: number; simSeconds: number; wallSeconds: number; lapsEnded: number; }

async function runOnce(seed: number, runIdx: number): Promise<RunReport> {
  Math.random = mulberry32(seed * 2654435761 + 97);
  const rngJ = mulberry32(seed ^ 0x5bd1e995);   // the clock's own dice (jitter), apart from the game's
  const nextDt = () => JITTER <= 0 ? DT : rngJ() < DT / 3 ? MAX_DT : Math.min(MAX_DT, Math.max(1e-4, DT * (1 + (rngJ() * 2 - 1) * JITTER)));
  const t0wall = performance.now();
  const W = await standUp();
  const { game, input, cam, level } = W;
  game.tune.aimModel = AIM_MODEL;
  const failures: string[] = []; const warnings: string[] = []; const failKeys = new Set<string>();
  let frame = 0; let simT = 0; let demo: any = null; let lap = 0;   // simT: simulated seconds fed to demo.update so far
  const where = () => `${LAPS > 1 ? `lap ${lap} ` : ''}f${frame} t=${game.time.toFixed(2)}s${demo?.active ? ` stop ${demo.shotI} +${demo.shotT.toFixed(2)}s` : ''}`;
  const fail = (key: string, msg: string) => { key = `${lap > 1 ? `lap${lap}:` : ''}${key}`; if (failKeys.has(key)) return; failKeys.add(key); failures.push(`[${key}] ${where()}: ${msg}`); console.log(`!! run ${runIdx} (seed ${seed}) FAIL [${key}] ${where()}: ${msg}`); };
  const warn = (msg: string) => { warnings.push(`${where()}: ${msg}`); if (!QUIET) console.log(`   run ${runIdx} warn ${where()}: ${msg}`); };
  const info = (msg: string) => { if (!QUIET) console.log(`   run ${runIdx} ${where()}: ${msg}`); };
  const routeName = (gd: any) => level.routes[gd.routeI]?.name ?? `g${gd.char.id}`;
  const doorByName = (n: string) => game.doors.byName(n);
  const guardsBrief = () => game.guards.map((g: any) => g.state[0] + (g.script ? 's' : '') + (g.hold ? 'h' : '') + (g.pinned ? 'p' : '')).join('');

  // ---- reference: the level right after a fresh restartEncounter() (what the hand-over stop promises to leave behind)
  game.restartEncounter();
  const refDoors = new Map<string, { angle: number; latched: boolean; locked: boolean }>();
  for (const d of game.doors.list) refDoors.set(d.def.name, { angle: d.angle, latched: d.latched, locked: d.locked });
  const refLights = new Map<any, boolean>(); for (const t of game.targets) refLights.set(t, t.on);
  for (const [t, on] of game.initialOn as Map<any, boolean>) if (refLights.get(t) !== on) fail('reference', `restartEncounter() left ${t.name} on=${refLights.get(t)} but the level authors it on=${on}`);
  const rackTargets: any[] = game.rackTargets;
  const confDoor = doorByName('conference'); const confAuth = refDoors.get('conference');
  const fireExit = doorByName('fire_exit');

  // ---- instrumentation: barks per stop (RoomClear and the AI both speak through game.say)
  let curStop = -1; let says: number[] = []; const sayLog: string[] = [];
  const origSay = game.say.bind(game);
  game.say = (gd: any, text: string, radio = false) => { if (curStop >= 0) says[curStop]++; sayLog.push(`${game.time.toFixed(1)}s [${LAPS > 1 ? `lap ${lap} ` : ''}stop ${curStop}] ${routeName(gd)}${radio ? ' (radio)' : ''}: ${text}`); return origSay(gd, text, radio); };

  // ---- the light meter never answers headless: pin the knob on every Player the game makes (restartEncounter replaces it)
  let lastPlayer: any = null; let prevHit = 0; let allowDownUntilP = false;   // (--down: lying dead until P is pressed is the point, not a failure)
  const pinVisibility = () => { if (game.player !== lastPlayer) { lastPlayer = game.player; game.player.visibility = VIS; prevHit = game.player.hitFlash; } };

  /** doors + switchables + fixtures + blackout vs the fresh-restart reference ('' entries filtered) */
  function levelDiff(opts: { doorAngles?: boolean } = {}): string[] {
    const bad: string[] = [];
    for (const d of game.doors.list) {
      const r = refDoors.get(d.def.name)!;
      if (opts.doorAngles !== false && (Math.abs(d.angle - r.angle) > 1e-3 || d.latched !== r.latched)) bad.push(`door ${d.def.name} angle ${d.angle.toFixed(3)} (authored ${r.angle.toFixed(3)}) latched=${d.latched}${d.lastWho >= 0 ? ` lastWho=${d.lastWho}` : ''}`);
      if (d.locked !== r.locked || d.lockBroken || d.pick !== 0 || d.picking) bad.push(`door ${d.def.name} locked=${d.locked} (authored ${r.locked}) broken=${d.lockBroken} pick=${d.pick}`);
    }
    const offGroups = new Map<string, string[]>();
    for (const [t, on] of refLights) if (t.on !== on) { const k = `${t.group} → ${t.on ? 'ON' : 'off'} (authored ${on ? 'on' : 'off'})`; offGroups.set(k, [...(offGroups.get(k) ?? []), t.name]); }
    for (const [k, names] of offGroups) bad.push(`lights ${k}: ${names.join(', ')}`);
    if (game.targets.some((t: any) => t.broken || t.disabledUntil !== -1)) bad.push('a fixture is still broken / OCP-disabled');
    if (game.blackout.active) bad.push('blackout active');
    return bad;
  }

  // ---- per-frame tripwires (every lap, and the plain play around the laps)
  let hits: number[] = []; const acc: any = {};
  function perFrame(dt: number) {
    const i = curStop;
    pinVisibility();
    const hf = game.player.hitFlash;   // only ever decays (game.update) unless a round found Sam (combat.ts fireWeapon sets it to 1, god mode or not)
    if (hf > prevHit + 1e-9) { hits[i >= 0 ? i : STOPS]++; fail(`hit@${frame}`, `Sam was hit (hitFlash ${prevHit.toFixed(2)} → ${hf.toFixed(2)}) at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}) crouch=${game.player.crouch}; guards ${game.guards.map((g: any) => `${routeName(g)}:${g.state}@(${f2(g.char.pos[0])},${f2(g.char.pos[2])})`).join(' ')}`); }
    prevHit = hf;
    if (game.player.down && !allowDownUntilP) fail('player-down', `the player is down${demo?.active ? ' during the tour' : ''}`);
    const pc = game.player.char;
    if (!fin(pc.pos[0], pc.pos[1], pc.pos[2], pc.bodyYaw, pc.aimYaw, pc.aimPitch, pc.vel[0], pc.vel[2])) fail('nan-player', `player pos ${pc.pos} yaw ${pc.bodyYaw} aim ${pc.aimYaw}/${pc.aimPitch} vel ${pc.vel}`);
    for (const gd of game.guards) { const c = gd.char; if (!fin(c.pos[0], c.pos[1], c.pos[2], c.bodyYaw, c.aimYaw, c.aimPitch, gd.speed, gd.awareness)) fail(`nan-guard-${routeName(gd)}`, `guard ${routeName(gd)} pos ${c.pos} yaw ${c.bodyYaw} aim ${c.aimYaw}/${c.aimPitch} speed ${gd.speed} aw ${gd.awareness} (${gd.script ? 'scripted' : gd.state})`); const hb = c.bones.hips; if (hb && !fin(hb[0], hb[1], hb[2])) fail(`nan-bones-${routeName(gd)}`, `guard ${routeName(gd)} hips ${hb} (${gd.state})`); }
    if (!fin(cam.target[0], cam.target[1], cam.target[2], cam.yaw, cam.distance, cam.desiredDistance, cam.pos[0], cam.pos[2])) fail('nan-camera', `camera target ${cam.target} yaw ${cam.yaw} dist ${cam.distance}/${cam.desiredDistance}`);
    if (demo?.active && !fin(demo.fade, demo.t, demo.shotT)) fail('nan-demo', `demo fade ${demo.fade} t ${demo.t} shotT ${demo.shotT}`);
    for (const d of game.doors.list) if (!fin(d.angle, d.vel, d.pick)) fail(`nan-door-${d.def.name}`, `door ${d.def.name} angle ${d.angle} vel ${d.vel} pick ${d.pick}`);
    if (i < 0) return;
    // per-stop accumulators (read after this frame's game step, so the last value before a cut is the state the stop ended in)
    acc.deadMen = game.guards.filter((g: any) => g.state === 'dead'); acc.deadLast = acc.deadMen.length;   // (kept per frame: by the time a stop's exit checks run, the next stop's enter may have swapped the men for fresh ones)
    if (i === S.doors) {   // the fire exit walked open: Sam's hand on the leaf (game.ts handsOnDoors → anim.doorPush, w 1 while he pushes, hand ≥ 0 once settled on one), how far the leaf went, where he got to
      const dp = game.player.char.anim.doorPush; const t = demo.shotT;
      if (dp && dp.w > 0.5) { acc.dPushT = (acc.dPushT ?? 0) + dt; acc.dPushFrom ??= t; acc.dPushTo = t; if (dp.hand >= 0) acc.dHandT = (acc.dHandT ?? 0) + dt; }
      if (fireExit) { if (fireExit.angle < (acc.dMinAngle ?? 0)) { acc.dMinAngle = fireExit.angle; acc.dWideAt = t; } if (!fireExit.latched && acc.dOpenAt === undefined) acc.dOpenAt = t; if (acc.dOpenAt !== undefined && fireExit.latched && acc.dShutAt === undefined && t > acc.dOpenAt) acc.dShutAt = t; }
      acc.dEnd = v3.copy(game.player.char.pos); acc.dLatchedLast = fireExit?.latched; acc.dAngleLast = fireExit?.angle;
    }
    if (i === S.takedown) {   // the beat's milestones on the shot clock (timeline notes; and where an --abort-at 3:frac lands), plus what must NOT happen: a round out of the click, a grab out of a Space
      if (game.player.takedown && acc.tdAt === undefined) acc.tdAt = demo.shotT;
      if (acc.deadLast > 0 && acc.deadAt === undefined) acc.deadAt = demo.shotT;
      acc.tdShots = (acc.tdShots ?? 0) + game.events.filter((e: any) => e.kind === 'shot' && e.loud && e.time === game.time).length;   // (combat.ts fireWeapon: a player round is a loud 'shot'; a canister's pop is a quiet one)
      if (game.player.holding) acc.tdGrabbed = true;
      if (game.player.dragging && !acc.grabbedEver) { acc.grabbedEver = true; acc.grabAt = demo.shotT; }
      if (acc.grabbedEver && !game.player.dragging && acc.dropAt === undefined) acc.dropAt = demo.shotT;
    }
    if (i === S.hold) {   // the hold: when he was grabbed / held / let go on the shot clock, who, what he said (his bubbles: the answers come forced through guards.ts say, not Game.say), the standoff and the alarm, rounds
      const H = game.player.holding; const t = demo.shotT;
      if (H && acc.hGrabAt === undefined) { acc.hGrabAt = t; acc.hMan = H.g; acc.hVariant = H.variant; }
      if (H?.phase === 'held' && acc.hHeldAt === undefined) acc.hHeldAt = t;
      if (acc.hMan && acc.hReleaseAt === undefined && (!H || H.phase === 'choke')) { acc.hReleaseAt = t; acc.hReleaseHow = H ? H.phase : acc.hMan.state === 'dead' ? 'dead' : 'gone'; }
      const hm = acc.hMan; if (hm?.bubble && hm.bubble.t === game.time && hm.held) (acc.hAnswers ??= []).push(hm.bubble.text);   // (a held man's only bubbles are his answers)
      const so = game.guards.find((g: any) => g.standoff);
      if (so && acc.hSoAt === undefined) { acc.hSoAt = t; acc.hSoMan = so; acc.hSoFrame = frame; }
      if (game.escalation === 2 && acc.hEsc2At === undefined) { acc.hEsc2At = t; acc.hEsc2Frame = frame; }
      if (acc.hSoMan?.standoff) { acc.hOrbitM = acc.hSoMan.standoff.orbitM; acc.hSoShots = acc.hSoMan.standoff.shots; }
      const rounds = game.events.filter((e: any) => e.kind === 'guardShot' && e.time === game.time).length;
      if (rounds) { if (acc.hReleaseAt === undefined) acc.hRoundsBefore = (acc.hRoundsBefore ?? 0) + rounds; else acc.hRoundsAfter = (acc.hRoundsAfter ?? 0) + rounds; }
      if (H?.phase === 'held') { const y = game.player.char.bodyYaw; if (acc.hLastYaw !== undefined && acc.hSoAt !== undefined) { let d = y - acc.hLastYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); acc.hTurned = (acc.hTurned ?? 0) + Math.abs(d); } acc.hLastYaw = y; }   // radians the pair came round through while the colleague circled (the shield being kept on him)
      if (!game.quietUtility && acc.hLiveAt === undefined) acc.hLiveAt = t;
    }
    if (i === S.firefight) { acc.guardShots = (acc.guardShots ?? 0) + game.events.filter((e: any) => e.kind === 'guardShot' && e.time === game.time).length; acc.playerShots = (acc.playerShots ?? 0) + game.events.filter((e: any) => e.kind === 'shot' && e.time === game.time).length; for (const gd of acc.posted ?? []) if (gd.state === 'dead' && !(acc.killAt ??= new Map()).has(gd)) acc.killAt.set(gd, demo.shotT); }   // (killAt: the shot clock each posted man went down at — the beat's timing, compared across changes to how Sam moves)
    if (i === S.clear) { if (confDoor && !confDoor.latched) acc.sawUnlatched = true; if (demo.drill) acc.phases.add(demo.drill.phase); }
    if (i === S.drive) {
      const m = game.mission;
      if (m.driveT >= 0 && !acc.sawDriveT) { acc.sawDriveT = true; acc.pullAt = demo.shotT; acc.usedNet = demo.shotT > 6; }   // the Space-on-the-row path starts it ≈ 3 s in; the beat's own net (driveT = 0 directly) only fires past 6 s
      if (m.pulled) acc.sawPulled = true;
      if (acc.sawPulled && rackTargets.length && rackTargets.every((t: any) => !t.on)) acc.sawRackOff = true;
      if (game.guards.some((g: any) => g.task?.kind === 'rack')) acc.rackCheckSent = true;
    }
    if (i !== S.clear && game.guards.some((g: any) => g.script)) fail(`script-outside-${S.clear}@${i}`, `a guard carries a script during stop ${i} (${game.guards.filter((g: any) => g.script).map(routeName).join(',')})`);
    if (game.escalation !== 0 && i !== S.hold) fail('escalation-in-tour', `escalation ${game.escalation} during stop ${i} (quietUtility=${game.quietUtility}) — only the hold (stop ${S.hold}) plays live`);
    if (game.player.holding && i !== S.hold) fail(`holding-outside-${S.hold}@${i}`, `Sam holds a man (${routeName(game.player.holding.g)}, ${game.player.holding.phase}) during stop ${i}`);
  }
  /** plain live play for `secs`, still watched (the page before P, between laps, after the hand-over / an abort) */
  function settle(secs: number) {
    for (const tEnd = simT + secs; simT < tEnd; frame++) {
      const dt = nextDt(); simT += dt;
      try { const p = demo ? demo.update(dt) : null; if (p !== null || demo?.active) fail('settle-demo', 'demo.update returned a look-at / went active by itself outside a lap'); W.step(dt, p); perFrame(dt); }
      catch (e: any) { fail(`exception-settle-${String(e?.message ?? e).slice(0, 60)}`, `outside the tour: ${e?.stack ?? e}`); }
    }
  }

  // ---- the page before P is pressed: a second of plain play (the ?demo boot starts the tour 1.5 s in)
  pinVisibility(); settle(1);
  if (DIRTY) {   // a played-on floor under the P press (all through the game's own live-play entry points)
    const sd = doorByName('server'); if (sd) game.doors.kickIn(sd, [17.6, 0, 10.9], PLAYER_ID);
    const victim = game.guards[game.guards.length - 1]; if (victim) killGuard(game, victim, [1, 0, 0], false);
    game.setBlackout(40, 'ocp'); game.escalate();
    game.teleportPlayer([20.5, 0, 11.3]); game.player.crouch = true; game.setGroup('lobby', false);
    settle(2);
    info(`dirty floor before P: ${game.escalationSummary()}; blackout ${game.blackout.active}; server door broken ${sd?.lockBroken}; guards ${game.guards.map((g: any) => g.state).join('/')}; player at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`);
  }
  if (DOWN) { game.godMode = false; hitPlayer(game, [1, 0, 0]); allowDownUntilP = true; settle(1.5); if (!game.player.down) fail('down-setup', '--down: the player did not go down'); info(`P pressed lying dead at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])})`); }
  const sandboxBefore = { ai: game.aiEnabled, god: game.godMode, invisible: game.playerInvisible };

  // ---- the Demo, constructed once as main.ts does: (game, cam, smoke, input) — smoke is the Game's own null object (clearAll exists and drops)
  demo = new Demo(game, cam, W.smoke, input);
  const stops: StopRec[] = []; let lapsEnded = 0;

  function runLap(abortAt: { stop: number; frac: number } | null) {
    says = new Array(STOPS + 1).fill(0); hits = new Array(STOPS + 1).fill(0); for (const k of Object.keys(acc)) delete acc[k];
    const order: number[] = []; const lapStops: StopRec[] = [];
    const missionAtStart = game.mission; const posAtStart = v3.copy(game.player.char.pos); const holsteredAtStart = game.player.holstered;
    demo.start(); allowDownUntilP = false;
    if (!demo.active || demo.shotI !== 0) { fail('start', `demo.start() left active=${demo.active} shotI=${demo.shotI}`); return; }
    if (game.player.down) fail('start-down', 'demo.start() left the player down (the restartEncounter path did not run)');
    const shots: any[] = demo.shots; const totalDur = shots.reduce((a: number, s: any) => a + s.dur, 0);
    if (shots.length !== STOPS) fail('stops', `the tour builds ${shots.length} shots, expected ${STOPS}`);
    const CAP_SECS = totalDur + 25;   // authored length + a generous margin: past this the tour did not end by itself
    info(`P — tour: ${shots.length} stops, ${totalDur.toFixed(0)} s authored; cap ${CAP_SECS.toFixed(0)} s${JITTER > 0 ? ` · jitter ±${JITTER} (+ 50 ms hitches)` : ''}${abortAt ? ` · will abort in stop ${abortAt.stop} at ${Math.round(abortAt.frac * 100)}%` : ''}`);

    function enter(i: number, missionBefore: any) {
      curStop = i; order.push(i);
      lapStops.push({ lap, i, caption: String(demo.caption ?? ''), tDemo: demo.t, tGame: game.time, tSim: simT, simDur: 0, frame, frames: 0, dur: shots[i]?.dur ?? NaN, hits: 0, says: 0, notes: [] });
      info(`enter stop ${i}: "${String(demo.caption).slice(0, 60)}"`);
      if (i === S.takedown) { acc.tdTarget = game.guards[1 % game.guards.length]; if (!game.player.holstered) fail(`stop${i}-holstered`, 'takedown: Sam enters with the pistol drawn — the takedown is a click with the hands EMPTY (drawn, the beat\'s click would put a round in his back)'); }
      if (i === S.doors) {
        if (!fireExit) fail(`stop${i}-door-missing`, "no door named 'fire_exit'");
        else if (!fireExit.latched || Math.abs(fireExit.angle) > 1e-3) fail(`stop${i}-door-shut`, `doors: the fire exit is not shut at enter (angle ${fireExit.angle.toFixed(2)}, latched ${fireExit.latched})`);
        if (!game.puppet) fail(`stop${i}-puppet`, 'doors: no puppet after enter (Sam is meant to walk the leaf open himself)');
        const p = game.player.char.pos; if (p[0] > 35.7 || p[0] < 30 || Math.abs(p[2] - 20.6) > 1.5) fail(`stop${i}-staging`, `doors: Sam enters at (${f2(p[0])}, ${f2(p[2])}), not inside the break room in front of the fire exit`);
      }
      if (i === S.hold) {
        acc.hMissionBefore = missionBefore; acc.hTarget = game.guards[1 % game.guards.length];
        if (game.mission === missionBefore) fail(`stop${i}-scratch`, 'the hold: game.mission was not swapped for a scratch copy at enter (the stop\'s live half would tick the player\'s own run)');
        if (!game.player.holstered) fail(`stop${i}-holstered`, 'the hold: Sam enters with the pistol drawn (the grab would be the gun variant, its row a pistol-whip and no question)');
        if (!game.playerInvisible) fail(`stop${i}-invisible`, 'the hold: Sam is seeable at enter (the creep runs unseen, like the takedown; beat C opens their eyes)');
        if (game.escalation !== 0 || game.guards.some((g: any) => g.state !== 'patrol' || g.standoff || g.held)) fail(`stop${i}-staging`, `the hold: not a calm fresh floor at enter — ${game.escalationSummary()}; ${game.guards.map((g: any) => `${routeName(g)}:${g.state}${g.standoff ? '+standoff' : ''}${g.held ? '+held' : ''}`).join(' ')}`);
      }
      if (i === S.firefight) {
        acc.posted = game.guards.filter((g: any) => g.state !== 'dead' && g.pinned && !g.hold);
        if (acc.posted.length !== 2) fail(`stop${i}-posted`, `firefight: expected 2 posted (alert, pinned) guards after enter, found ${acc.posted.length} (${game.guards.map((g: any) => `${routeName(g)}:${g.state}${g.pinned ? '+pinned' : ''}${g.hold ? '+hold' : ''}`).join(' ')})`);
        if (game.playerInvisible) fail(`stop${i}-visible`, 'firefight: playerInvisible still on after enter (the beat is meant to be seen)');
        const p = game.player.pistol; if ((p.mag ?? 0) + p.chamber < 6) fail(`stop${i}-kit`, `firefight: Sam enters with mag ${p.mag} chamber ${p.chamber} (rearm() should have topped him up)`);
        if (game.player.holstered) fail(`stop${i}-holstered`, 'firefight: Sam enters holstered (the hold before it must draw the pistol again at exit) — he would never fire');
      }
      if (i === S.clear) {
        acc.sawUnlatched = false; acc.phases = new Set<string>();
        if (!confDoor) fail(`stop${i}-door-missing`, "no door named 'conference'"); else if (!confDoor.latched || Math.abs(confDoor.angle) > 1e-3) fail(`stop${i}-door-shut`, `room clear: conference door not pulled to at enter (angle ${confDoor.angle.toFixed(2)}, latched ${confDoor.latched})`);
        if (!demo.drill) fail(`stop${i}-drill-null`, 'room clear: demo.drill is null after enter (no RoomClear constructed — fewer than 2 guards?)');
      }
      if (i === S.smoke) { if (game.player.canisters < 1) fail(`stop${i}-kit`, 'smoke stop: Sam enters with no smoke canister'); acc.cans0 = game.player.canisters; }
      if (i === S.firefight) acc.bangs0 = game.player.flashbangs;
      if (i === S.drive) {
        acc.missionBefore = missionBefore; acc.sawPulled = false; acc.sawRackOff = false; acc.sawDriveT = false; acc.rackCheckSent = false;
        if (game.mission === missionBefore) fail(`stop${i}-scratch`, 'drive pull: game.mission was not swapped for a scratch copy at enter (the beat would spend the player\'s own run)');
        if (!game.missionInTour) fail(`stop${i}-missionInTour`, 'drive pull: missionInTour not raised at enter');
        if (!rackTargets.length) fail(`stop${i}-rack-none`, 'no rack targets (game.rackTargets empty)'); else if (!rackTargets.every((t: any) => t.on)) fail(`stop${i}-rack-lit`, 'drive pull: rack LEDs not lit at enter');
        if (game.mission.stage !== 'infiltrate' || game.mission.pulled) fail(`stop${i}-scratch-stage`, `scratch mission starts at stage ${game.mission.stage} pulled=${game.mission.pulled}`);
      }
      if (i === S.handover) {   // the hand-over: restartEncounter() has just run inside enter — this is the moment the level must read as authored (before live patrols touch it)
        const bad = levelDiff();
        if (bad.length) fail('handover-state', `hand-over stop entered but the level is not as authored: ${bad.slice(0, 6).join(' · ')}`);
        if (game.quietUtility) fail('handover-quiet', 'hand-over stop entered but quietUtility is still up');
        if (input.lockExcept) fail('handover-input', 'hand-over stop entered but real input is still locked (lockExcept set)');
        if (!demo.handedOver) fail('handover-flag', 'hand-over stop entered but demo.handedOver is false');
        if (game.puppet) fail('handover-puppet', 'hand-over stop entered with a puppet still set');
      }
    }

    function exit(i: number, aborted = false) {
      const rec = lapStops[lapStops.length - 1];
      if (rec && rec.i === i) { rec.frames = frame - rec.frame; rec.simDur = simT - rec.tSim; rec.hits = hits[i]; rec.says = says[i]; rec.aborted = aborted; }
      if (hits[i] > 0) fail(`stop${i}-hit`, `Sam was hit ${hits[i]}× during stop ${i} (player.hitFlash rose)`);
      if (aborted) { rec?.notes.push(`ABORTED (P) at +${f2(rec.simDur)} s`); info(`abort in stop ${i} at +${rec ? rec.simDur.toFixed(2) : '?'} s; guards ${guardsBrief()}`); return; }
      // a stop runs until the first frame its clock reaches the authored length: never shorter, never more than one (longest possible) frame over
      if (rec && Number.isFinite(rec.dur) && (rec.simDur < rec.dur - 1e-6 || rec.simDur > rec.dur + Math.max(DT, MAX_DT) + 1e-6)) fail(`stop${i}-dur`, `stop ${i} ran ${rec.simDur.toFixed(3)} s, authored ${rec.dur} s`);
      const at = (x: number | undefined) => x === undefined ? '—' : `+${f2(x)}s`;
      if (i === S.doors) {
        const pushT = acc.dPushT ?? 0, handT = acc.dHandT ?? 0, wide = acc.dMinAngle ?? 0, end: Vec3 | undefined = acc.dEnd;
        if (pushT < 0.5) fail(`stop${i}-hand`, `doors: Sam's hand was on the leaf (anim.doorPush.w > 0.5) for ${f2(pushT)} s (want ≥ 0.5 s) — the puppet never walked him into the fire exit?`);
        else if (handT < 0.3) warn(`stop ${i}: the push settled on a hand for only ${f2(handT)} s of the ${f2(pushT)} s it was fed (doorPush.hand stayed −1: he never squared up to the leaf?)`);
        if (acc.dOpenAt === undefined) fail(`stop${i}-open`, 'doors: the fire exit never came unlatched during the stop');
        else if (wide > -1.0) fail(`stop${i}-wide`, `doors: the fire exit only swung to ${f2(wide)} rad (want past −1.0: walked wide open onto the lot)`);
        if (!end || end[0] < 36.4) fail(`stop${i}-through`, `doors: Sam ended the stop at (${end ? `${f2(end[0])}, ${f2(end[2])}` : '?'}) — still inside, he never got through the fire exit`);
        if (Math.abs(acc.dAngleLast ?? 1) > 0.1 || !(acc.dLatchedLast || fireExit?.closing)) fail(`stop${i}-reshut`, `doors: the fire exit is not back to a sliver and swinging shut by the cut (angle ${f2(acc.dAngleLast ?? NaN)}, latched ${acc.dLatchedLast}, closing ${fireExit?.closing}) — the pull-to at 6.2 s did not happen?`);   // (a sliver, not the latch: a sprung close from wide open takes ~5 s to the last centimetre; the old flung-open beat latched at 9.6 s, this one about a second into the next stop's black)
        rec?.notes.push(`fire exit: creaks ${at(acc.dOpenAt)} → widest ${f2(wide)} rad ${at(acc.dWideAt)} → ${acc.dShutAt !== undefined ? `latched again ${at(acc.dShutAt)}` : `${f2(Math.abs(acc.dAngleLast ?? NaN) * 116)} cm off the jamb at the cut, ${fireExit?.closing ? 'closing' : 'NOT closing'}`} · hand on the leaf ${at(acc.dPushFrom)}‥${at(acc.dPushTo)} (${f2(pushT)} s fed, ${f2(handT)} s settled on a hand) · Sam ended at (${end ? `${f2(end[0])}, ${f2(end[2])}` : '?'})`);
      }
      if (i === S.takedown) {
        const dead: any[] = acc.deadMen ?? [];
        if ((acc.deadLast ?? 0) !== 1) fail(`stop${i}-takedown`, `takedown: ${acc.deadLast ?? 0} guards dead at the end of the stop (expected exactly 1)`);
        else if (dead.length === 1 && dead[0] !== acc.tdTarget) fail(`stop${i}-takedown-who`, `takedown: the dead man is ${routeName(dead[0])}, not the staged target ${routeName(acc.tdTarget)}`);
        else if (acc.tdAt === undefined) fail(`stop${i}-takedown-how`, 'takedown: the staged man is down but player.takedown was never seen — he did not go by the beat\'s click (startTakedown)');
        else if (dead.length === 1 && dead[0].downKind !== 'struck') fail(`stop${i}-takedown-kind`, `takedown: the staged man went down '${dead[0].downKind}' (want struck — the silent cross, not a round)`);
        if ((acc.tdShots ?? 0) > 0) fail(`stop${i}-takedown-shots`, `takedown: ${acc.tdShots} round(s) left Sam's pistol during the stop (the click is meant to find the hands empty)`);
        if (acc.tdGrabbed) fail(`stop${i}-takedown-grab`, 'takedown: Sam GRABBED a man during the stop (a Space reached the guard\'s row — the beat is meant to click)');
        rec?.notes.push(`dead: ${dead.map(routeName).join(',') || 'none'} · takedown ${at(acc.tdAt)} → down ${at(acc.deadAt)} → grabbed ${at(acc.grabAt)} → dropped ${at(acc.dropAt)}${acc.grabbedEver ? '' : ' · body NEVER dragged'}`);
        if (!acc.grabbedEver) warn(`stop ${i}: the body was never dragged (player.dragging stayed null the whole stop)`);
      }
      if (i === S.hold) {
        // inside the stop (accumulated per frame): the grab and the hold proper on the clock, the answers, the standoff and the alarm's cause, the rounds
        const hm = acc.hMan, so = acc.hSoMan; const answers: string[] = acc.hAnswers ?? [];
        if (acc.hGrabAt === undefined) fail(`stop${i}-grab`, 'the hold: nobody was ever grabbed (player.holding stayed null the whole stop)');
        else {
          if (hm !== acc.hTarget) fail(`stop${i}-grab-who`, `the hold: the man grabbed is ${routeName(hm)}, not the staged ${routeName(acc.hTarget)}`);
          if (acc.hVariant !== 'arm') fail(`stop${i}-variant`, `the hold: '${acc.hVariant}' variant (want the arm — Sam holstered)`);
          if (acc.hGrabAt > 4.5) warn(`stop ${i}: the grab only came at +${f2(acc.hGrabAt)} s — that is the beat's net (startGrab() past 5 s); the Space-tapped-on-his-row path did not take`);
        }
        if (acc.hHeldAt === undefined || acc.hHeldAt > 3) fail(`stop${i}-held`, `the hold: holding.phase reached 'held' at ${at(acc.hHeldAt)} (want by +3 s)`);
        if (answers.length < 2 || (hm && hm.talk.presses < 2)) fail(`stop${i}-answers`, `the hold: ${answers.length} answer bubble(s), talk.presses ${hm?.talk.presses ?? '—'} (want ≥ 2 exchanges out of him): ${answers.map(a => `"${a}"`).join(' · ') || 'none'}`);
        if (acc.hSoAt === undefined) fail(`stop${i}-standoff`, `the hold: no colleague ever entered the standoff (guards at exit: ${guardsBrief()})`);
        else if (so?.witness && so.witness.sawHeld?.who !== hm?.callsign) fail(`stop${i}-sawHeld`, `the hold: the standoff man's witness.sawHeld is ${JSON.stringify(so.witness.sawHeld)} (want who ${hm?.callsign})`);
        if (acc.hEsc2At === undefined) fail(`stop${i}-lockdown`, 'the hold: the alarm never reached lockdown (2) during the stop');
        else if (acc.hSoFrame === undefined || acc.hEsc2Frame !== acc.hSoFrame) fail(`stop${i}-hostage-cause`, `the hold: the alarm went to 2 at ${at(acc.hEsc2At)} (frame ${acc.hEsc2Frame}) but the standoff began at ${at(acc.hSoAt)} (frame ${acc.hSoFrame}) — lockdown by the hostage call happens on the frame the colleague sees the pair; anything else raised it`);
        if (acc.hLiveAt !== undefined && acc.hSoAt !== undefined && acc.hSoAt < acc.hLiveAt - 1e-6) fail(`stop${i}-live-order`, `the hold: a standoff at ${at(acc.hSoAt)} before the tour flag dropped at ${at(acc.hLiveAt)}`);
        if ((acc.hRoundsBefore ?? 0) > 0) fail(`stop${i}-rounds-held`, `the hold: ${acc.hRoundsBefore} guard round(s) fired while the man was still held square between (before the choke at ${at(acc.hReleaseAt)})`);
        if ((acc.hRoundsAfter ?? 0) > 0) fail(`stop${i}-rounds-shove`, `the hold: ${acc.hRoundsAfter} guard round(s) between the choke starting (${at(acc.hReleaseAt)}) and the cut — the beat everybody takes at the body dropping did not hold`);
        if (acc.hReleaseAt === undefined) warn(`stop ${i}: the man was still held at the cut (no choke seen — the choke row was never tapped?)`);
        else if (acc.hReleaseHow !== 'choke') fail(`stop${i}-release-how`, `the hold ended by '${acc.hReleaseHow}' at ${at(acc.hReleaseAt)} (want the choke — there is no letting him go any more)`);
        if (acc.hMan && (acc.hMan.state !== 'dead' || acc.hMan.downKind !== 'choked')) fail(`stop${i}-choked`, `the hold: at the cut ${routeName(acc.hMan)} is ${acc.hMan.state}/${acc.hMan.downKind ?? '-'} (want out cold: dead/choked)`);
        // after the stop's exit (this frame): the floor the firefight stages from
        if (game.player.holding || game.guards.some((g: any) => g.held || g.standoff)) fail(`stop${i}-residue`, `the hold: after exit Sam holds ${game.player.holding ? routeName(game.player.holding.g) : 'nobody'}; guards ${game.guards.map((g: any) => `${routeName(g)}${g.held ? '+held' : ''}${g.standoff ? '+standoff' : ''}`).join(' ')}`);
        if (game.player.char.anim.holdPose) fail(`stop${i}-pose`, 'the hold: Sam\'s animator still carries a holdPose after exit');
        if (!game.quietUtility) fail(`stop${i}-quiet`, 'the hold: quietUtility left down at exit (every later stop would run live)');
        if (game.escalation !== 0 || game.escalationT !== -1 || game.alarm.episode || game.alarm.placed || game.clearing) fail(`stop${i}-alarm`, `the hold: the alarm not calm after exit — ${game.escalationSummary()} T=${game.escalationT}`);
        if (game.guards.some((g: any) => g.leader || g.post || g.task || g.bodyDuty || g.script)) fail(`stop${i}-guards`, `the hold: guards after exit still carry lockdown duties / errands: ${game.guards.map((g: any) => `${routeName(g)}:${g.state}${g.leader ? ' +leader' : ''}${g.post ? ' +post' : ''}${g.task ? ' +task' : ''}${g.bodyDuty ? ' +body' : ''}`).join(' ')}`);   // (their states are the firefight's own staging by now — its enter ran in the same frame as this exit — but pairs, posts and errands would be the lockdown's residue)
        if (game.mission !== acc.hMissionBefore) fail(`stop${i}-restore-mission`, `the hold: the player's own mission object was not put back at exit (stage now ${game.mission.stage})`);
        if (input.keys.has('Space')) fail(`stop${i}-key`, 'the hold: a Space is still down after exit (the beat only taps)');
        if (game.player.holstered) fail(`stop${i}-holster`, 'the hold: Sam left holstered at exit (the firefight needs the pistol in his hand)');
        const turnedDeg = Math.round((acc.hTurned ?? 0) * 180 / Math.PI);
        rec?.notes.push(`grab ${at(acc.hGrabAt)}${acc.hGrabAt > 4.5 ? ' (NET: startGrab)' : ' (Space on his row)'} ${acc.hVariant ?? ''} → held ${at(acc.hHeldAt)} → ${answers.length} answers ${answers.map(a => `"${a.slice(0, 46)}${a.length > 46 ? '…' : ''}"`).join(' / ')} → live ${at(acc.hLiveAt)} → ${so ? routeName(so) : 'nobody'} in the standoff ${at(acc.hSoAt)}, alarm 2 ${at(acc.hEsc2At)} → he walked ${f2(acc.hOrbitM ?? 0)} m round them, the pair came round ${turnedDeg}° keeping the shield on him → ${acc.hReleaseHow ?? 'still held'} ${at(acc.hReleaseAt)} · rounds ${acc.hRoundsBefore ?? 0} before / ${acc.hRoundsAfter ?? 0} after · ${says[i]} barks+radio`);
        if (so && (acc.hOrbitM ?? 0) < 3) warn(`stop ${i}: the standoff man walked only ${f2(acc.hOrbitM ?? 0)} m round the pair (cornered where he stood? the orbit is the point of the framing)`);
      }
      if (i === S.smoke && game.player.canisters !== (acc.cans0 ?? 4) - 1) fail(`stop${i}-thrown`, `smoke stop: ${acc.cans0} canisters at enter, ${game.player.canisters} at exit — the beat's key (3, the smoke slot since the 08-08 re-slot) never put one in his hand / the click never threw it`);
      if (i === S.firefight && game.player.flashbangs !== (acc.bangs0 ?? 2) - 1) fail(`stop${i}-stun`, `firefight: ${acc.bangs0} stun canisters at enter, ${game.player.flashbangs} at exit — the beat's key (4, the stun slot) never selected one / it was never lobbed`);
      if (i === S.firefight) {
        const posted: any[] = acc.posted ?? []; const alive = posted.filter((g: any) => g.state !== 'dead');
        if (alive.length) fail(`stop${i}-firefight`, `firefight: ${alive.length} of the ${posted.length} posted men still alive at the end (${alive.map((g: any) => `${routeName(g)}:${g.state} dazzled=${game.time < g.dazzledUntil}`).join(' ')}); player at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}) mag ${game.player.pistol.mag} chamber ${game.player.pistol.chamber}`);
        rec?.notes.push(`posted ${posted.map(routeName).join('+')}: ${posted.map((g: any) => g.state).join('/')}, down at ${posted.map((g: any) => acc.killAt?.has(g) ? `+${f2(acc.killAt.get(g))} s` : '—').join(' / ')}; guard rounds ${acc.guardShots ?? 0}, Sam's ${acc.playerShots ?? 0}`);
      }
      if (i === S.clear) {
        if (!acc.sawUnlatched) fail(`stop${i}-breach`, 'room clear: the conference door never came unlatched during the stop (no breach)');
        if (says[i] < 10) fail(`stop${i}-barks`, `room clear: only ${says[i]} barks during the stop (expected ≥ 10)`);
        if (!acc.phases?.has('resolve')) fail(`stop${i}-drill-resolve`, `room clear: the drill never reached 'resolve' (phases seen: ${[...(acc.phases ?? [])].join('→') || 'none'})`);
        if (confDoor && confAuth && (Math.abs(confDoor.angle - confAuth.angle) > 1e-3 || confDoor.latched !== confAuth.latched || confDoor.locked !== confAuth.locked || confDoor.lockBroken)) fail(`stop${i}-restore`, `room clear: conference door not restored at exit — angle ${confDoor.angle.toFixed(3)} (authored ${confAuth.angle.toFixed(3)}) latched=${confDoor.latched} locked=${confDoor.locked} broken=${confDoor.lockBroken}`);
        for (const t of game.targets) if (t.group === 'conference' && t.on !== refLights.get(t)) { fail(`stop${i}-lights`, `room clear: ${t.name} left on=${t.on} at exit (authored ${refLights.get(t)})`); break; }
        if (game.guards.some((g: any) => g.script)) fail(`stop${i}-script`, `room clear: a guard still carries a script after exit (${game.guards.filter((g: any) => g.script).map(routeName).join(',')})`);
        if (demo.drill) fail(`stop${i}-drill-cleared`, 'room clear: demo.drill not cleared at exit');
        rec?.notes.push(`phases ${[...(acc.phases ?? [])].join('→')}; ${says[i]} barks`);
      }
      if (i === S.drive) {
        if (!acc.sawDriveT) fail(`stop${i}-pull-start`, 'drive pull: the pull never started (mission.driveT never went ≥ 0)');
        if (!acc.sawPulled) fail(`stop${i}-pulled`, 'drive pull: mission.pulled never became true during the stop');
        if (acc.sawPulled && !acc.sawRackOff) fail(`stop${i}-rack-dark`, 'drive pull: the rack LEDs never went dark after the pull');
        if (game.mission !== acc.missionBefore) fail(`stop${i}-restore-mission`, `drive pull: the player's own mission object was not put back at exit (stage now ${game.mission.stage}, pulled ${game.mission.pulled})`);
        if (game.missionInTour) fail(`stop${i}-restore-missionInTour`, 'drive pull: missionInTour still up after exit');
        const wantOn = !acc.missionBefore?.pulled;
        if (rackTargets.some((t: any) => t.on !== wantOn)) fail(`stop${i}-restore-rack`, `drive pull: rack targets on=${rackTargets.map((t: any) => t.on).join('/')} after exit, expected all ${wantOn} (player's mission pulled=${acc.missionBefore?.pulled})`);
        for (const t of game.targets) if (t.group === 'server' && t.on !== refLights.get(t)) { fail(`stop${i}-lights`, `drive pull: ${t.name} (server group) left on=${t.on} at exit (authored ${refLights.get(t)})`); break; }
        rec?.notes.push(`pull started ${acc.sawDriveT ? `+${f2(acc.pullAt)} s${acc.usedNet ? ' (late: the t>6 s net, not the Space tap?)' : ' (Space on the row)'}` : 'never'}, pulled ${acc.sawPulled}, rack dark ${acc.sawRackOff}, rack check sent ${acc.rackCheckSent}`);
        if (acc.usedNet) warn(`stop ${i}: the pull only started at +${f2(acc.pullAt)} s — that is the beat's fallback (m.driveT = 0 past 6 s), the F-on-the-hovered-marker path did not take`);
      }
      info(`exit stop ${i}: ${rec ? `${rec.simDur.toFixed(2)} s / ${rec.frames} f` : '?'}; hits ${hits[i]}; says ${says[i]}; guards ${guardsBrief()}`);
    }

    /** what a FINISHED tour must leave: checked the frame it lets go, and again after SETTLE_SECS of the live game it handed over */
    function endChecks(label: string) {
      if (demo.active) fail(`${label}-active`, 'demo still active');
      if (!demo.handedOver) fail(`${label}-handedOver`, 'demo.handedOver is false: the tour stopped before the hand-over stop (an abort, not a finish)');
      commonAfter(label);
      const m = game.mission;
      if (m.stage !== 'infiltrate' || m.pulled || m.driveT !== -1 || m === missionAtStart) fail(`${label}-mission`, `mission after the tour: stage ${m.stage} pulled ${m.pulled} driveT ${m.driveT}${m === missionAtStart ? ' (still the pre-tour object: restartEncounter did not start a fresh run)' : ''}`);
      // doors / lights vs the fresh-restart reference: locks and switches strictly; an angle moved since the hand-over by a patrolling guard (lastWho ≥ 10) is live play, not tour residue
      for (const d of game.doors.list) {
        const r = refDoors.get(d.def.name)!;
        if (d.locked !== r.locked || d.lockBroken || d.pick !== 0) fail(`${label}-door-lock-${d.def.name}`, `door ${d.def.name} locked=${d.locked} (authored ${r.locked}) broken=${d.lockBroken} pick=${d.pick}`);
        if (Math.abs(d.angle - r.angle) > 1e-3 || d.latched !== r.latched) { if (d.lastWho >= 10) warn(`door ${d.def.name} at ${d.angle.toFixed(2)} (authored ${r.angle.toFixed(2)}): moved by guard ${d.lastWho} in live play since the hand-over`); else fail(`${label}-door-angle-${d.def.name}`, `door ${d.def.name} angle ${d.angle.toFixed(3)} (authored ${r.angle.toFixed(3)}) latched=${d.latched} lastWho=${d.lastWho}`); }
      }
      const ld = levelDiff({ doorAngles: false }).filter(s => !s.startsWith('door'));
      if (ld.length) fail(`${label}-level`, ld.join(' · '));
    }
    /** what BOTH a finish and an abort must leave: the tour's hands off everything */
    function commonAfter(label: string) {
      if (game.quietUtility) fail(`${label}-quiet`, 'quietUtility still true after the tour');
      if (game.puppet !== null) fail(`${label}-puppet`, `game.puppet not null after the tour: ${JSON.stringify(game.puppet)}`);
      if (game.missionInTour) fail(`${label}-missionInTour`, 'missionInTour still true after the tour');
      if (input.lockExcept) fail(`${label}-input`, 'input.lockExcept still set after the tour (controls locked)');
      if (input.keys.size) fail(`${label}-keys`, `synthetic keys left held after the tour: ${[...input.keys].join(',')}`);
      if (demo.drill) fail(`${label}-drill`, 'demo.drill still set after the tour');
      if (game.escalation !== 0 || game.escalationT !== -1 || game.alarm.episode || game.alarm.placed || game.clearing) fail(`${label}-escalation`, `escalation ${game.escalationSummary()} T=${game.escalationT} clearing=${!!game.clearing}`);
      const badG = game.guards.filter((g: any) => g.state !== 'patrol' || g.script || g.hold || g.pinned || g.leader || g.post || g.task || g.awareness > 0.3);
      if (badG.length) fail(`${label}-guards`, `guards not calm patrols: ${badG.map((g: any) => `${routeName(g)}:${g.state} aw ${f2(g.awareness)}${g.script ? ' +script' : ''}${g.hold ? ' +hold' : ''}${g.pinned ? ' +pinned' : ''}${g.task ? ' +task:' + g.task.kind : ''}`).join(' ')}`);
      if (game.guards.length !== level.routes.length) fail(`${label}-guards-count`, `${game.guards.length} guards, ${level.routes.length} routes`);
      if (game.godMode !== sandboxBefore.god || game.playerInvisible !== sandboxBefore.invisible || game.aiEnabled !== sandboxBefore.ai) fail(`${label}-sandbox`, `sandbox flags after the tour: god ${game.godMode} invisible ${game.playerInvisible} ai ${game.aiEnabled} (before: ${JSON.stringify(sandboxBefore)})`);
      if (game.player.down) fail(`${label}-player`, 'player down after the tour');
      if (game.player.dragging || game.player.takedown || game.player.pendingThrow || game.player.throwHeld) fail(`${label}-player-busy`, `player still mid-action after the tour: dragging ${!!game.player.dragging} takedown ${!!game.player.takedown} throw ${!!game.player.pendingThrow}/${game.player.throwHeld}`);
      if (game.blackout.active) fail(`${label}-blackout`, 'blackout still active after the tour');
      if (!label.endsWith('settled') && game.items.items.length) fail(`${label}-aftermath`, `${game.items.items.length} live items (${game.items.items.map((it: any) => it.kind).join(',')}) survive the tour`);   // (canisters, magazines, dropped pistols of the beats; live play afterwards may of course make its own)
    }
    /** what an ABORT (P mid-tour → Demo.stop() unfinished) must leave: fresh guards, the player back where P found him and mortal again, his own mission
     *  untouched, nothing in the air — and, once things have had SETTLE_SECS to come to rest, the level as authored: a leaf with a closer still swinging to
     *  is only noted, but a switch group left flipped or a closer-less door left moved is tour residue in the live game and fails */
    function abortChecks(label: string, abortedIn: number, settled: boolean) {
      if (demo.active) fail(`${label}-active`, 'demo still active after stop()');
      if (demo.handedOver) fail(`${label}-handedOver`, 'handedOver true on an abort');
      commonAfter(label);
      const m = game.mission;
      if (m !== missionAtStart) fail(`${label}-mission`, `abort in stop ${abortedIn}: the player's mission object was replaced (stage ${m.stage} pulled ${m.pulled})`);
      if (m.driveT !== -1 || m.pulled !== acc.pulledAtStart) fail(`${label}-mission-state`, `abort in stop ${abortedIn}: mission driveT ${m.driveT} pulled ${m.pulled} (was ${acc.pulledAtStart})`);
      if (rackTargets.some((t: any) => t.on !== !m.pulled)) fail(`${label}-rack`, `abort in stop ${abortedIn}: rack targets on=${rackTargets.map((t: any) => t.on).join('/')}, mission pulled=${m.pulled}`);
      if (!settled && v3.distXZ(game.player.char.pos, posAtStart) > 0.6) fail(`${label}-player-pos`, `abort in stop ${abortedIn}: player left at (${f2(game.player.char.pos[0])}, ${f2(game.player.char.pos[2])}), P found him at (${f2(posAtStart[0])}, ${f2(posAtStart[2])})`);
      if (!settled && game.player.crouch) fail(`${label}-player-crouch`, 'player left crouched after the abort');
      if (!settled && game.player.holstered !== holsteredAtStart) fail(`${label}-player-holster`, `abort in stop ${abortedIn}: player handed back holstered=${game.player.holstered}, P found him holstered=${holsteredAtStart} (the takedown / hold beats holster him; Demo.stop restores what it saved)`);
      if (!settled) return;
      for (const d of game.doors.list) {
        const r = refDoors.get(d.def.name)!;
        if (d.locked !== r.locked || d.lockBroken || d.pick !== 0) fail(`${label}-door-lock-${d.def.name}`, `abort in stop ${abortedIn} hands back door ${d.def.name} locked=${d.locked} (authored ${r.locked}) broken=${d.lockBroken} pick=${d.pick}`);
        if (Math.abs(d.angle - r.angle) > 1e-3 || d.latched !== r.latched) {
          const why = `door ${d.def.name} at ${d.angle.toFixed(2)} (authored ${r.angle.toFixed(2)}) latched=${d.latched} lastWho=${d.lastWho}`;
          if (d.def.closer !== false) warn(`abort in stop ${abortedIn}: ${why} — has a closer, on its way shut`); else fail(`${label}-door-angle-${d.def.name}`, `abort in stop ${abortedIn} hands back ${why} — no closer: it stays there`);
        }
      }
      for (const s of levelDiff({ doorAngles: false }).filter(x => !x.startsWith('door'))) fail(`${label}-level:${s.split(' ').slice(0, 3).join(' ')}`, `abort in stop ${abortedIn} hands back: ${s}`);
    }

    // ---- the lap
    acc.pulledAtStart = missionAtStart.pulled;
    const f0 = frame; frame = f0 - 1; enter(0, game.mission); frame = f0;   // (stop 0 is entered inside start(), before this lap's first update — one frame back keeps its frame count honest)
    let ended = false; let abortedIn = -1; let exceptions = 0; const injected = { hit: false, nan: false }; const tCap = simT + CAP_SECS;
    for (; simT < tCap; frame++) {
      const dt = nextDt();
      const missionBefore = game.mission; const prevShot = demo.shotI;
      if (SELFTEST) {   // deliberate faults the tripwires must report: a guard put 2.5 m in front of Sam fires one aimed round at his chest; later a guard's awareness goes NaN
        if (!injected.hit && demo.shotI === S.torches && demo.shotT >= 3) { injected.hit = true; const gd = game.guards.find((g: any) => g.state !== 'dead'); const pc = game.player.char; const f = pc.forward();
          if (gd) { gd.char.pos = [pc.pos[0] + f[0] * 2.5, 0, pc.pos[2] + f[2] * 2.5]; gd.char.bodyYaw = gd.char.aimYaw = Math.atan2(-f[0], -f[2]); gd.char.aimPitch = 0; gd.char.update(0); fireWeapon(game, gd.char, v3.add(pc.pos, [0, 1.2, 0]), false); info('selftest: guard round fired at Sam'); } }
        if (!injected.nan && demo.shotI === S.restrike && demo.shotT >= 2) { injected.nan = true; const gd = game.guards[game.guards.length - 1]; if (gd) { gd.awareness = NaN; info(`selftest: NaN put into ${routeName(gd)}'s awareness`); } }
      }
      if (abortAt && abortedIn < 0 && demo.shotI === abortAt.stop && demo.shotT >= abortAt.frac * (shots[abortAt.stop]?.dur ?? 0)) {   // P again, mid-beat (main.ts handles KeyP just before demo.update in the same step)
        abortedIn = demo.shotI;
        try { demo.stop(); } catch (e: any) { fail('exception-stop', `demo.stop() threw: ${e?.stack ?? e}`); }
        exit(abortedIn, true); curStop = -1;
      }
      let demoPos: Vec3 | null = null;
      try { demoPos = demo.update(dt); }
      catch (e: any) { exceptions++; fail(`exception-demo-${String(e?.message ?? e).slice(0, 60)}`, `demo.update threw: ${e?.stack ?? e}`); if (exceptions > 30) { fail('abort-run', 'too many exceptions'); break; } }
      simT += dt;
      if (abortedIn < 0 && (demo.shotI !== prevShot || !demo.active)) {
        exit(prevShot);
        if (demo.active) { for (let k = prevShot + 1; k < demo.shotI; k++) { order.push(k); fail('skipped-stop', `stop ${k} was skipped in one frame`); } enter(demo.shotI, missionBefore); }
        else curStop = -1;
      }
      try { W.step(dt, demoPos); }
      catch (e: any) { exceptions++; fail(`exception-step-${String(e?.message ?? e).slice(0, 60)}`, `game step threw: ${e?.stack ?? e}`); if (exceptions > 30) { fail('abort-run', 'too many exceptions'); break; } }
      try { perFrame(dt); } catch (e: any) { exceptions++; fail('exception-harness', `perFrame threw: ${e?.stack ?? e}`); }
      if (!demo.active) { ended = abortedIn < 0; frame++; break; }
    }
    stops.push(...lapStops);
    if (abortedIn >= 0) {
      abortChecks('abort', abortedIn, false); settle(SETTLE_SECS); abortChecks('abort-settled', abortedIn, true);
      return;
    }
    if (!ended) { fail('no-end', `the tour did not end by itself within ${CAP_SECS.toFixed(0)} s of tour clock: active=${demo.active} stop ${demo.shotI} +${f2(demo.shotT)} s`); try { demo.stop(); } catch { /* reported above if it matters */ } return; }
    lapsEnded++;
    const wantOrder = Array.from({ length: STOPS }, (_, k) => k);
    if (order.length !== STOPS || order.some((v, k) => v !== wantOrder[k])) fail('order', `stops visited: [${order.join(',')}], expected [${wantOrder.join(',')}]`);
    endChecks('end'); settle(SETTLE_SECS); endChecks('settled');
  }

  for (lap = 1; lap <= LAPS; lap++) { runLap(lap === LAPS ? ABORT : null); if (lap < LAPS) settle(3); }   // (a few seconds of the handed-over game between a finish and the next P)

  const wallSeconds = (performance.now() - t0wall) / 1000;
  if (!QUIET && sayLog.length) { console.log(`   run ${runIdx} barks (${sayLog.length}):`); for (const l of sayLog) console.log(`     ${l}`); }
  return { seed, pass: failures.length === 0, failures, warnings, stops, frames: frame, simSeconds: simT, wallSeconds, lapsEnded };
}

// ---------------------------------------------------------------- runs + report
const reports: RunReport[] = [];
const flags = `${HZ} Hz${JITTER > 0 ? ` ±${JITTER} jitter` : ''} · vis ${VIS}${LAPS > 1 ? ` · ${LAPS} laps` : ''}${DIRTY ? ' · dirty floor' : ''}${ABORT ? ` · abort in stop ${ABORT.stop} @${Math.round(ABORT.frac * 100)}%` : ''}${SELFTEST ? ' · SELFTEST (planted faults)' : ''}`;
for (let r = 0; r < RUNS; r++) {
  const seed = SEED0 + r;
  console.log(`\n=== run ${r + 1}/${RUNS} · seed ${seed} · ${flags} ===`);
  const rep = await runOnce(seed, r + 1);
  reports.push(rep);
  console.log(`--- timeline (run ${r + 1}, seed ${seed}) ---`);
  console.log(`${LAPS > 1 ? 'lap ' : ''}stop  start(tour s)  start(game s)  dur(s)  authored  frames  hits  barks  caption / notes`);
  for (const s of rep.stops) {
    console.log(`${LAPS > 1 ? String(s.lap).padStart(3) + ' ' : ''}${String(s.i).padStart(3)}   ${s.tDemo.toFixed(2).padStart(12)}  ${s.tGame.toFixed(2).padStart(13)}  ${s.simDur.toFixed(2).padStart(6)}  ${String(s.dur).padStart(8)}  ${String(s.frames).padStart(6)}  ${String(s.hits).padStart(4)}  ${String(s.says).padStart(5)}  ${s.caption.slice(0, 52)}${s.caption.length > 52 ? '…' : ''}`);
    for (const n of s.notes) console.log(`${' '.repeat(LAPS > 1 ? 82 : 78)}↳ ${n}`);
  }
  console.log(`--- run ${r + 1}: ${rep.pass ? 'PASS' : 'FAIL'} · ${rep.frames} frames (${rep.simSeconds.toFixed(1)} s sim) in ${rep.wallSeconds.toFixed(2)} s wall · laps ended by themselves: ${rep.lapsEnded}/${LAPS}${ABORT ? ' (last lap aborted on purpose)' : ''} · ${rep.failures.length} failure(s), ${rep.warnings.length} warning(s)`);
  for (const f of rep.failures) console.log(`  FAIL ${f.split('\n')[0].slice(0, 400)}`);
  for (const w of rep.warnings) console.log(`  warn ${w}`);
}
const failed = reports.filter(r => !r.pass);
console.log(`\n=== summary: ${reports.length - failed.length}/${reports.length} PASS${failed.length ? ` — FAIL seeds: ${failed.map(r => r.seed).join(', ')}` : ''} · ${flags} · wall ${reports.reduce((a, r) => a + r.wallSeconds, 0).toFixed(1)} s total ===`);
if (SELFTEST) {   // the verdict that matters here: were the two planted faults reported?
  const ok = reports.every(r => r.failures.some(f => /\[hit@\d+\]/.test(f)) && r.failures.some(f => f.startsWith('[stop1-hit]')) && r.failures.some(f => f.startsWith('[nan-guard-')));
  console.log(`=== selftest: ${ok ? 'OK — the planted hit (per-frame + per-stop) and the planted NaN were both reported' : 'BROKEN — a planted fault went unreported: the tripwires are not live'} ===`);
  process.exit(ok ? 0 : 1);
}
const replay = [`--hz ${HZ}`, JITTER > 0 ? `--jitter ${JITTER}` : '', LAPS > 1 ? `--laps ${LAPS}` : '', VIS !== 0.05 ? `--vis ${VIS}` : '', DIRTY ? '--dirty' : '', ABORT ? `--abort-at ${ABORT.stop}:${ABORT.frac}` : ''].filter(Boolean).join(' ');
console.log(`replay a run: bun run tools/qa/tour.ts --seed <seed> ${replay}`);
process.exit(failed.length ? 1 : 0);
