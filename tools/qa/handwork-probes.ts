// The `handwork` probes (src/game/handwork.ts) — `bun run tools/qa/probes.ts handwork`, or one of handwork-work / handwork-radio / handwork-swap / handwork-off /
// handwork-harness. Staged headless on the real Game on the office, HANDWORK.on raised by the probe itself — the frozen stand holds it off (TPS_HANDWORK=1).
//   handwork-work     Sam's hand is on the thing while the verb runs and gone after, at each of the four: the mains breaker (the mains go with his hand, and the move is
//                     committed: Space, a step, a click change nothing), the server room's keypad (he steps in, four keys beep under his finger, the door opens), the drive
//                     (both hands in the rack for DRIVE_SECS, then put away), a breaching charge on a partition by his own hands (both hands on it for setSecs,
//                     a step breaks it off) — and the two other men who work things: a teammate setting a door charge, the guard sent to re-arm the breaker
//   handwork-radio    a guard's radio line lifts his left hand to the handset and it comes down after; a spoken line lifts nothing; a reload has the arm first;
//                     a response-team man's radio line lifts his hand too (or his long gun is up and it does not)
//   handwork-swap     the shift going up a step: the torch leaves his hand, his hand is empty for a beat, the sidearm is in it — and back the other way when
//                     the floor stands down; the torch hangs on his belt while the sidearm is out; an alerted guard's first round is no later than with the
//                     switch off
//   handwork-off      the switch off: the breaker flips on the tap, the pad's one beep then three, no step in, no pose anywhere, the swap instant — and half a
//                     minute of the shift going up a step and talking on the net digests the same on and off (the radio hand and the swap are picture only)
//   handwork-harness  the frozen stand holds it off, the page turns it on unless ?nohandwork, the table is a registered knob table a recording carries
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const HW = await import(`${ROOT}/src/game/handwork.ts`);
const { HANDWORK, HANDWORK_STATS } = HW;
const { SWAP } = await import(`${ROOT}/src/game/character.ts`);
const G = await import(`${ROOT}/src/game/guards.ts`);
const { CODE_SECS, learnCode } = await import(`${ROOT}/src/game/devices.ts`);
const { DRIVE_SECS } = await import(`${ROOT}/src/game/consts.ts`);
const { runningVerb } = await import(`${ROOT}/src/game/interact.ts`);
const { playerBusy } = await import(`${ROOT}/src/game/savestate.ts`);
const { WALLCHARGE, wallAt, wallPt } = await import(`${ROOT}/src/game/wallcharge.ts`);
const { CLOSE } = await import(`${ROOT}/src/game/close.ts`);
const { DOORTOOLS } = await import(`${ROOT}/src/game/doortools.ts`);
const { DESTRUCTION } = await import(`${ROOT}/src/game/destructionSwitch.ts`);
const { handProps, killGuard } = await import(`${ROOT}/src/game/combat.ts`);
const { requestQrf } = await import(`${ROOT}/src/game/qrf.ts`);
const { digestGame, hashDigest } = await import(`${ROOT}/src/game/digest.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
let allPass = true;
const c2deg = (r: number) => r * 180 / Math.PI;
const verdict = (pass: boolean, what: string, detail = '') => { console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${what}${detail ? `\n    ${detail}` : ''}`); if (!pass) allPass = false; };
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const flat = (a: ArrayLike<number>, b: ArrayLike<number>) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const quiet = async <T>(fn: () => T | Promise<T>): Promise<T> => { const l = console.log, w = console.warn, e = console.error; console.log = console.warn = console.error = () => { }; try { return await fn(); } finally { console.log = l; console.warn = w; console.error = e; } };

/** the office stood up, the switch as asked (and the destruction's + the wall charge's when `walls`); Sam unseen and unhurt */
async function rig(on: boolean, o: { seed?: number; walls?: boolean; ai?: boolean } = {}) {
  if (o.walls) { DESTRUCTION.on = true; WALLCHARGE.on = true; }
  const W: any = await quiet(() => standUp({ uploadEvery: 4, seed: o.seed ?? 1 }));
  HANDWORK.on = on; HANDWORK.work = HANDWORK.radio = HANDWORK.swap = true;
  const g = W.game, I = W.input, pl = g.player, c = pl.char;
  g.godMode = true; g.playerInvisible = true; g.aiEnabled = o.ai ?? false; if (o.walls) g.tune.chaos = 0.5;
  const R = { W, g, I, pl, c,
    step(n = 1, each?: (i: number) => void) { for (let i = 0; i < n; i++) { W.step(DT); each?.(i); } },
    /** a one-frame Space */
    tap() { I.keys.add('Space'); I.pressed.add('Space'); W.step(DT); I.keys.delete('Space'); },
    row(kind: string, verb?: string) { return g.nearby.find((r: any) => r.kind === kind && (!verb || r.verb === verb)); },
    rows() { return g.nearby.map((r: any) => `${r.kind}:${r.verb ?? '-'}`).join(' '); },
    work() { return c.anim.workInfo(); },
    /** the working wrists' distances to a spot */
    wrists(p: Vec3, ch: any = c) { return { L: v3.dist(ch.bones.handL, p), R: v3.dist(ch.bones.handR, p) }; },
  };
  R.step(20);
  return R;
}
async function keep(fn: () => Promise<boolean>): Promise<boolean> {
  const was = { ...HANDWORK }, st = { ...HANDWORK_STATS }, sw = DESTRUCTION.on, wc = WALLCHARGE.on;
  try { return await fn(); } catch (e) { console.log(`- FAIL — the probe threw\n    ${e instanceof Error ? e.stack : String(e)}`); return false; }
  finally { Object.assign(HANDWORK, was); Object.assign(HANDWORK_STATS, st); DESTRUCTION.on = sw; WALLCHARGE.on = wc; }
}
/** a partition of the office with floor both sides (the wall charge's own test of it), and where Sam stands to set one */
function partition(g: any): { W: any; top: Vec3 } | null {
  if (g.wallCharge.carried !== null) g.wallCharge.raiseCarried(1);   // a stand whose kit issues wall charges by the piece (the shipped one: a lone Sam is issued none) — the row is offered only to a man who carries one, and these lines are about his hands
  const free = (p: number[]) => !g.col.nav.isBlocked(p[0], p[2]);
  for (const w of g.destr.walls.all()) { if (w.kind !== 'wall') continue; const b = w.box, ax = b.h[0] >= b.h[2], L = ax ? b.h[0] : b.h[2]; if (L < 1.6) continue;
    for (let u = -L + 1.2; u <= L - 1.2 + 1e-6; u += 0.6) for (const side of [1, -1]) {
      const mid: Vec3 = ax ? [b.c[0] + u, 1.05, b.c[2]] : [b.c[0], 1.05, b.c[2] + u], n = ax ? [0, 0, side] : [side, 0, 0], off = (d: number): Vec3 => [mid[0] + n[0] * d, 0, mid[2] + n[2] * d];
      if (![0.6, 1.2, 2.4].every(d => free(off(d)) && free(off(-d)))) continue;
      const Wl = wallAt(g, mid, off(2.4)); if (Wl && Wl.ok) return { W: Wl, top: [mid[0], b.c[1] + b.h[1], mid[2]] }; } }
  return null;
}

// ================================================================ work
export async function handworkWork(): Promise<boolean> { return keep(async () => {
  console.log('\n=== handwork-work: a hand on the thing while the verb runs, gone after — the breaker, the keypad, the drive, a charge; a teammate\'s charge, a guard at the breaker ===');
  allPass = true; const K = HANDWORK;
  // ---- the mains breaker
  { const R = await rig(true), { g, pl, c } = R, bp: Vec3 = g.level.breaker.pos;
    g.teleportPlayer([bp[0], 0, bp[2] - 0.9]); pl.holstered = true; R.step(20);
    const row = !!R.row('breaker', 'breakerOff'); g.selectVerb('breaker', 'breakerOff'); R.tap();
    let f0 = -1, fB = -1, wAtB = 0, dAtB = 9, verb = '', busy: string | null = null, wBefore = 0;
    R.step(150, i => { if (f0 < 0 && pl.breakerMove) { f0 = i; verb = runningVerb(g); busy = playerBusy(g); }
      if (fB < 0 && !g.blackout.active) wBefore = Math.max(wBefore, R.work().w);
      if (fB < 0 && g.blackout.active) { fB = i; wAtB = R.work().w; const d = R.wrists(R.work().pose?.p ?? bp); dAtB = Math.min(d.L, d.R); } });
    const secs = (fB - f0) * DT, gone = !pl.breakerMove && R.work().w < 0.05;
    verdict(row && f0 >= 0 && f0 <= 2 && verb === 'breaker' && busy === 'at the breaker', 'at the panel, hands empty: the breaker row, a tap starts the move — a sustained verb, a checkpoint sees him busy', `row ${row} · move from frame ${f0} · running verb '${verb}' · busy "${busy}"`);
    verdict(fB > f0 && wAtB > 0.85 && dAtB < 0.3 && secs >= K.leverAt - 0.02 && secs <= K.leverAt + K.waitSecs + 0.6, 'the mains go with his hand: when they trip his hand is on the lever (weight > 0.85, wrist inside 0.3 m of it), within a second of the tap', `tripped ${f2(secs)} s after the tap · hand weight then ${f2(wAtB)} · wrist ${f2(dAtB)} m from the lever`);
    verdict(gone, 'two and a half seconds on: the move is over and the hand is back', `move ${pl.breakerMove ? 'STILL ON' : 'over'} · hand weight ${f2(R.work().w)}`);
    // back on, and a second Space letting go
    R.step(20); const rowOn = !!R.row('breaker', 'breakerOn'); g.selectVerb('breaker', 'breakerOn'); R.tap(); let fOn = -1; R.step(120, i => { if (fOn < 0 && !g.blackout.active) fOn = i; });
    verdict(rowOn && fOn > 0 && fOn * DT <= K.leverAt + K.waitSecs + 0.6 && !pl.breakerMove, 'the same hand puts them back on', `row ${rowOn} · mains back ${f2(fOn * DT)} s after the tap`);
    R.step(20); g.selectVerb('breaker', 'breakerOff'); R.tap(); R.step(4); const started = !!pl.breakerMove; R.tap(); R.step(2); R.I.keys.add('KeyS'); R.I.pressed.add('KeyS'); R.step(2); R.I.clicked = 1; R.step(1); const still = !!pl.breakerMove; R.step(56); R.I.keys.delete('KeyS');
    verdict(started && still && !pl.breakerMove && g.blackout.active, 'the move is committed like a kick: Space again, a step back and the trigger a few frames in stop nothing — the mains go as the row said', `started ${started} · still on after all three ${still} · move ${pl.breakerMove ? 'STILL ON' : 'over'} · blackout ${g.blackout.active}`); }
  // ---- …through a pose re-bake every frame (a prop or a leaf nudging him: Character.update(0) after his update), and with a man in reach of a takedown
  { const R = await rig(true), { g, pl, c } = R, bp: Vec3 = g.level.breaker.pos;
    g.teleportPlayer([bp[0], 0, bp[2] - 0.9]); pl.holstered = true; R.step(20); g.selectVerb('breaker', 'breakerOff'); R.tap();
    let wAt = 0, fB = -1; R.step(120, i => { c.update(0); if (fB < 0 && g.blackout.active) { fB = i; wAt = R.work().w; } });
    verdict(fB >= 0 && wAt > 0.85, 'his pose re-baked every frame of the move (dt 0, as a prop that nudges him does): the hand is still on the lever when the mains go', `tripped at frame ${fB} · hand weight then ${f2(wAt)}`);
    g.endBlackout(); R.step(30);
    const gd = g.guards[0], stand = () => { gd.char.pos = [c.pos[0] + 0.75, 0, c.pos[2]]; gd.char.bodyYaw = gd.char.aimYaw = Math.PI / 2; };   // (a man a stride to his side, his back to Sam)
    stand(); R.step(3, stand); const reach = !!g.nearby.find((r: any) => r.kind === 'guard' && r.inReach);
    g.selectVerb('breaker', 'breakerOff'); R.tap(); stand(); R.step(2, stand); const on = !!pl.breakerMove; R.I.clicked = 1; R.step(1); stand(); const tk = !!pl.takedown; R.step(60, stand);
    verdict(!reach || (on && !tk && g.blackout.active), 'a man in reach of a takedown and a click mid-move: the hand finishes the lever first (no takedown starts under it, the mains go)', reach ? `move on ${on} · takedown started ${tk} · blackout ${g.blackout.active}` : 'NOT STAGED: no guard row in reach — nothing asked'); }
  // ---- the keypad
  { const R = await rig(true), { g, pl, c, W } = R, Kp = g.devices.keypads[0], fc = Kp.door.frameCentre, n = Kp.n, pad: Vec3 = Kp.def.pos;
    learnCode(g, Kp.door.lockId, 'told'); g.teleportPlayer([fc[0] + n[0] * 0.9, 0, fc[2] + n[2] * 0.9]); pl.holstered = true; R.step(20);
    const row = !!R.row('door', 'code'), off0 = (c.pos[0] - pad[0]) * n[0] + (c.pos[2] - pad[2]) * n[2];
    W.audioLog = []; g.selectVerb('door', 'code'); R.tap(); const t0 = g.time;
    const beeps: { t: number; w: number; d: number }[] = []; let seen = 0, tOpen = -1;
    R.step(300, () => { const L = W.audioLog as any[]; for (; seen < L.length; seen++) { if (L[seen].name === 'padBeep') { const d = R.wrists(pad); beeps.push({ t: g.time - t0, w: R.work().w, d: Math.min(d.L, d.R) }); } if (L[seen].name === 'padOpen' && tOpen < 0) tOpen = g.time - t0; } });
    W.audioLog = null;
    const off1 = (c.pos[0] - pad[0]) * n[0] + (c.pos[2] - pad[2]) * n[2];
    verdict(row && beeps.length === 4 && beeps.every(b => b.w > 0.85 && b.d < 0.32), 'a code he knows: four keys beep, each with his hand on the pad (weight > 0.85, wrist inside 0.32 m — a finger\'s length and a bit)', `row ${row} · ${beeps.map(b => `${f2(b.t)} s w ${f2(b.w)} d ${f2(b.d)}`).join(' | ')}`);
    verdict(tOpen > 0 && tOpen <= CODE_SECS + K.waitSecs + 0.9 && !pl.coding && Kp.door.lockBroken !== true, 'the door opens to it, no later than the code\'s own time plus the step in', `open tone ${f2(tOpen)} s after the tap (CODE_SECS ${CODE_SECS})`);
    verdict(off0 > K.standM + 0.2 && Math.abs(off1 - K.standM) < 0.12 && R.work().w < 0.05, 'he stepped in to arm\'s length of the pad to do it, and his hand is back', `stood ${f2(off0)} m off its face → ${f2(off1)} m (standM ${K.standM}) · hand weight ${f2(R.work().w)}`); }
  // ---- the drive
  { const R = await rig(true), { g, pl, c } = R, rf: Vec3 = g.level.mission.rack.front; g.mission.stage = 'drive';
    g.teleportPlayer([rf[0], 0, rf[2] + 0.9]); pl.holstered = true; R.step(20);
    const row = !!R.row('objective', 'drive'); g.selectVerb('objective', 'drive'); R.tap();
    let fS = -1, fP = -1, both = 0, frames = 0, caddy = 0, wEnd = 1, stow = 0;
    R.step(Math.round((DRIVE_SECS + 2.5) * 60), i => { const m = g.mission, wi = R.work();
      if (fS < 0 && m.stage === 'drive' && m.driveT >= 0) fS = i;
      if (fS >= 0 && fP < 0 && m.stage !== 'drive') fP = i;
      if (fS >= 0 && fP < 0 && m.driveT > 0.7) { frames++; const d = R.wrists(rf); if (wi.two && wi.w > 0.85 && d.L < 0.36 && d.R < 0.36) both++; }
      if (fP >= 0 && i - fP < K.stowSecs * 60) { const out: any[] = []; HW.workProps(c, out); if (out.length) caddy++; if (wi.pose) stow++; }
      wEnd = wi.w; });
    const secs = (fP - fS) * DT;
    verdict(row && fS >= 0 && fP > fS && Math.abs(secs - DRIVE_SECS) < 0.1, 'at the rack: the drive row, and it comes out in DRIVE_SECS — the hands cost it no time', `row ${row} · pulled ${f2(secs)} s after his hands went in (DRIVE_SECS ${DRIVE_SECS})`);
    verdict(frames > 0 && both / frames > 0.9, 'both hands are in the rack while it comes (two-handed, weight > 0.85, each wrist inside 0.36 m of its face) for over nine tenths of the pull', `${both} of ${frames} frames`);
    verdict(caddy > 0 && stow > 0 && wEnd < 0.05, 'pulled: the drive is in his hand as it goes to his hip, and both hands are back two seconds on', `caddy drawn ${caddy} frames · put-away posed ${stow} frames · hand weight at the end ${f2(wEnd)}`); }
  // ---- the drive let go of: the trigger does it, the other button does not
  { const R = await rig(true), { g, pl } = R, rf: Vec3 = g.level.mission.rack.front;
    g.mission.stage = 'drive'; g.teleportPlayer([rf[0] + 0.5, 0, rf[2] + (rf[2] < 14 ? 0.8 : -0.8)]); pl.holstered = true; R.step(20);
    g.selectVerb('objective', 'drive'); R.tap(); R.step(50); const on0 = g.mission.driveT >= 0, yaw = c2deg(pl.char.bodyYaw), want = c2deg(Math.atan2(0, rf[2] - pl.char.pos[2] > 0 ? 1 : -1));
    R.I.clicked = 4; R.step(1); R.step(5); const afterR = g.mission.driveT >= 0; R.I.clicked = 1; R.step(1); R.step(5); const afterL = g.mission.driveT >= 0;
    verdict(on0 && afterR && !afterL, 'pulling the drive: the right button leaves his hands on it, the trigger lets go', `running ${on0} · after RMB ${afterR} · after LMB ${afterL}`);
    verdict(Math.abs(((yaw - want + 540) % 360) - 180) < 12, 'come at from half a metre off to one side he squares to the rack\'s FACE, not to the line from its middle', `body yaw ${yaw.toFixed(0)}° · the face's ${want.toFixed(0)}°`); }
  // ---- a breaching charge on a partition, his own hands
  { const R = await rig(true, { walls: true, ai: true }), { g, pl, I, W } = R, C = g.wallCharge, P = partition(g);
    if (!P) verdict(false, 'a partition of the office with floor both sides', 'none found');
    else { const W0 = P.W, aim = (n: number, each?: () => void) => { for (let i = 0; i < n; i++) { W.cursorAt(P.top); W.step(DT); each?.(); } };
      g.teleportPlayer(wallPt(W0, 0, 0.55)); pl.holstered = true; aim(24);
      const row = !!R.row('wall', 'charge'); g.selectVerb('wall', 'charge'); R.tap();
      let fS = -1, fE = -1, both = 0, frames = 0, i = 0;
      aim(Math.round((DOORTOOLS.setSecs + 1.5) * 60), () => { const wi = R.work(); if (fS < 0 && C.setting) fS = i; if (fS >= 0 && fE < 0 && !C.setting) fE = i;
        if (fS >= 0 && fE < 0 && i - fS > 30) { frames++; const d = wi.pose ? R.wrists(wi.pose.p) : { L: 9, R: 9 }; if (wi.two && wi.w > 0.85 && d.L < 0.32 && d.R < 0.32) both++; } i++; });
      const secs = (fE - fS) * DT;
      verdict(row && fS >= 0 && C.set.length === 1 && Math.abs(secs - DOORTOOLS.setSecs) < 0.1, 'at the foot of a partition: the charge row, set in setSecs — the hands cost it no time', `row ${row} · set ${C.set.length} · ${f2(secs)} s (setSecs ${DOORTOOLS.setSecs})`);
      verdict(frames > 0 && both / frames > 0.9 && R.work().w < 0.05, 'both hands are on it from half a second in until it is set, and back after', `${both} of ${frames} frames · hand weight after ${f2(R.work().w)}`); } }
  // ---- a man in arm's reach while his hands are on the charge (close.ts): no knife tell, no close carriage — the hands stay on it; the switch off, both as they were
  for (const on of [true, false]) { const was = CLOSE.on;
    try { const R = await rig(on, { walls: true }), { g, pl, c, W } = R, C = g.wallCharge, P = partition(g); CLOSE.on = true;
      if (!P) { verdict(false, 'a partition of the office with floor both sides', 'none found'); continue; }
      const gd = g.guards[0], aim = (k: number, each?: () => void) => { for (let i = 0; i < k; i++) { W.cursorAt(P.top); W.step(DT); each?.(); } };
      g.teleportPlayer(wallPt(P.W, 0, 0.55)); pl.holstered = true; const w0 = wallPt(P.W, 0, 0), ax = Math.abs(c.pos[0] - w0[0]) < Math.abs(c.pos[2] - w0[2]);
      const stand = () => { gd.hold = true; gd.char.pos = ax ? [c.pos[0] + 0.75, 0, c.pos[2]] : [c.pos[0], 0, c.pos[2] + 0.75]; gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = ax ? Math.PI / 2 : 0; };   /* a man a stride to his side along the wall, his back to Sam */
      aim(40, stand); const tell0 = c.anim.ready, creep0 = c.anim.creep;
      g.selectVerb('wall', 'charge'); R.tap(); let tell = 0, creep = 0, both = 0, frames = 0, i = 0;
      aim(90, () => { stand(); if (!C.setting || i++ < 30) return; frames++; if (c.anim.ready) tell++; if (c.anim.creep) creep++; const wi = R.work(), d = wi.pose ? R.wrists(wi.pose.p) : { L: 9, R: 9 }; if (d.L < 0.32 && d.R < 0.32) both++; });
      if (on) verdict(!!tell0 && creep0 && frames > 30 && tell === 0 && creep === 0 && both / frames > 0.9, 'a man a stride from him while he sets it: the knife tell and the close carriage were up before, neither while his hands are on the charge, and they stay on it', `before: tell ${tell0} · carriage ${creep0} · while setting: tell ${tell} · carriage ${creep} · both hands on it ${both} of ${frames} frames`);
      else verdict(!!tell0 && creep0 && frames > 30 && tell === frames && creep === frames, 'the switch off: the tell and the carriage stand through it, as they did', `before: tell ${tell0} · carriage ${creep0} · while setting: tell ${tell} · carriage ${creep} of ${frames} frames`);
      } finally { CLOSE.on = was; } }
  { const R = await rig(true, { walls: true, ai: true }), { g, pl, I, W } = R, C = g.wallCharge, P = partition(g);
    if (P) { const aim = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt(P.top); W.step(DT); } };
      g.teleportPlayer(wallPt(P.W, 0, 0.55)); pl.holstered = true; aim(24); g.selectVerb('wall', 'charge'); R.tap(); aim(30);
      const on = C.setting, planted = flat(pl.char.pos, wallPt(P.W, 0, 0)) < 0.75; I.keys.add('KeyS'); I.pressed.add('KeyS'); aim(1); aim(20); I.keys.delete('KeyS'); aim(20);
      verdict(on && planted && !C.setting && C.set.length === 0, 'a step breaks it off as ever: a movement key half a second in — nothing on the wall', `setting ${on} → ${C.setting} · set ${C.set.length}`);
      const start = () => { g.teleportPlayer(wallPt(P.W, 0, 0.55)); aim(24); g.selectVerb('wall', 'charge'); R.tap(); aim(30); return C.setting; };
      const on2 = start(); I.keys.add('Space'); I.pressed.add('Space'); aim(1); I.keys.delete('Space'); aim(3); const offSpace = !C.setting;
      const on3 = start(), p3 = v3.copy(pl.char.pos), w3 = wallPt(P.W, 0, 0), d3 = flat(p3, w3) || 1, to3: Vec3 = [p3[0] + (p3[0] - w3[0]) / d3 * 0.7, 0, p3[2] + (p3[2] - w3[2]) / d3 * 0.7]; g.teleportPlayer(to3); const far3 = flat(pl.char.pos, p3); aim(3); const offMoved = !C.setting;
      verdict(on2 && offSpace && on3 && far3 > 0.5 && offMoved && C.set.length === 0, 'so does Space again, and so does anything that shifts him off the spot (put 0.7 m back from where he stands): the spot he must not leave goes only with the step he is walked', `Space: setting ${on2} → ${offSpace ? 'off' : 'STILL ON'} · moved ${f2(far3)} m: setting ${on3} → ${offMoved ? 'off' : 'STILL ON'} · set ${C.set.length}`); } }
  // ---- a teammate's door charge
  { const { rig: dtRig } = await import('./doortools-probes.ts') as any; const R = await quiet(() => dtRig(7, { door: 'breakroom_w' })); HANDWORK.on = true;
    const { D, game: g } = R; const give = R.give('charge', 'breakroom_w'); let frames = 0, on = 0, dMin = 9, tSet = NaN, setT = NaN;
    R.until(() => { const op = D.ops[0]; if (!op) return true; if (op.phase === 'place' && !isNaN(op.setT)) { setT = op.setT; const ch = op.lead.char, wi = ch.anim.workInfo(), t = g.time - op.setT;
      if (t > 0.5 && t < DOORTOOLS.setSecs - 0.05) { frames++; const d = wi.pose ? v3.dist(wi.hand ? ch.bones.handR : ch.bones.handL, wi.pose.p) : 9; dMin = Math.min(dMin, d); if (wi.w > 0.85 && d < 0.32) on++; } }
      if (D.set.length && isNaN(tSet)) tSet = g.time; return D.set.length > 0; }, 60);
    verdict(give === null && frames > 0 && on / frames > 0.9, 'the man who sets a door charge has a hand on it at the lock from half a second in until it is set', `order ${give === null ? 'taken' : give} · ${on} of ${frames} frames · nearest wrist ${f2(dMin)} m`);
    verdict(D.set.length === 1 && Math.abs(tSet - setT - DOORTOOLS.setSecs) < 0.1, 'and it is set in setSecs as ever', `set ${D.set.length} · ${f2(tSet - setT)} s (setSecs ${DOORTOOLS.setSecs})`); }
  // ---- the guard sent to the breaker
  { const run = async (on: boolean) => { const R = await rig(on, { ai: true }), { g } = R, bp = g.level.breaker.pos; g.teleportPlayer([8, 0, 17]); R.step(30); g.setBlackout(600, 'ocp');
      let wMax = 0, dMin = 9, off = 9, who = '', upper = '', frames = 0, on2 = 0;
      for (let i = 0; i < 60 * 150 && g.blackout.active; i++) { R.step(); if (g.breakerFixT > 1.0) { const gd = g.guards.find((x: any) => x.state !== 'dead' && Math.hypot(x.char.pos[0] - bp[0], x.char.pos[2] - (bp[2] - 0.6)) < 1.3); if (!gd) continue;
        const ch = gd.char, wi = ch.anim.workInfo(), d = wi.pose ? v3.dist(ch.bones.handL, wi.pose.p) : 9; frames++; if (wi.w > 0.85 && d < 0.25) on2++; wMax = Math.max(wMax, wi.w); dMin = Math.min(dMin, d); off = flat(ch.pos, bp); who = gd.callsign; upper = ch.anim.upper; } }
      return { t: g.time, back: !g.blackout.active, wMax, dMin, off, who, upper, frames, on: on2 }; };
    const A = await run(true), B = await run(false);
    verdict(A.back && A.frames > 0 && A.on / A.frames > 0.8 && A.off < 0.8 && A.upper === 'none', 'the man sent to the breaker steps up to the panel and has his left hand on the lever for the second half of his fumble with it, his gun low', `${A.who}: mains back ${A.back} · hand on it ${A.on} of ${A.frames} frames (best weight ${f2(A.wMax)}, wrist ${f2(A.dMin)} m) · ${f2(A.off)} m from the panel · upper '${A.upper}'`);
    verdict(B.back && B.wMax === 0 && Math.abs(A.t - B.t) < 0.5, 'and the mains come back when they did with the switch off (the clock is lighting.ts\'s, untouched)', `on ${f2(A.t)} s · off ${f2(B.t)} s (off: best hand weight ${f2(B.wMax)}, ${f2(B.off)} m from the panel)`); }
  return allPass;
}); }

// ================================================================ radio
export async function handworkRadio(): Promise<boolean> { return keep(async () => {
  console.log('\n=== handwork-radio: a hand to the handset while his line is on the net, down after; nothing for a spoken line; a reload has the arm first; the response team too ===');
  allPass = true; const K = HANDWORK;
  { const R = await rig(true), { g } = R, gd = g.guards[0], ch = gd.char, an = ch.anim; R.step(30);
    const rest = v3.dist(ch.bones.handL, ch.bones.head); g.say(gd, 'control, east corridor is clear', true); const dur = gd.bubble.dur, up = Math.min(K.radioMax, Math.max(K.radioMin, dur * K.radioK));
    let tUp = -1, dMin = 9, tDown = -1;
    R.step(Math.round((up + 1.5) * 60), i => { const s = an.radioShown, t = (i + 1) * DT; if (tUp < 0 && s > 0.9) tUp = t; if (tUp >= 0 && tDown < 0 && s < 0.05) tDown = t; if (s > 0.9) dMin = Math.min(dMin, v3.dist(ch.bones.handL, ch.bones.head)); });
    verdict(tUp > 0 && tUp < 0.5 && dMin < 0.42 && dMin < rest - 0.2, 'a guard\'s radio line: his left hand is up at his collar inside half a second (weight > 0.9, the wrist well nearer his head than at rest)', `${gd.callsign}: up ${f2(tUp)} s after the line · wrist ${f2(dMin)} m from his head (at rest ${f2(rest)})`);
    verdict(tDown > up - 0.1 && tDown < up + 0.8, 'it stays up for the line\'s own share of its bubble and comes down after', `bubble ${f2(dur)} s → hand up ${f2(up)} s · down at ${f2(tDown)} s`);
    R.step(30); g.say(gd, 'must have been nothing', false); const net = !!gd.bubble?.radio; let sMax = 0; R.step(90, () => { sMax = Math.max(sMax, an.radioShown); });
    verdict(net || sMax < 0.01, 'a line said aloud lifts nothing', `on the net ${net} · best hand weight ${f2(sMax)}`);
    R.step(30); an.reload(1.6); g.say(gd, 'control, checking in', true); let sR = 0, sAfter = 0; R.step(80, () => { sR = Math.max(sR, an.radioShown); }); R.step(40, () => { sAfter = Math.max(sAfter, an.radioShown); });
    verdict(sR < 0.05, 'a reload has his hands first: no radio hand through it', `best hand weight during the reload ${f2(sR)} · after it ${f2(sAfter)}`); }
  { const R = await rig(true, { ai: true }), { g } = R; g.teleportPlayer([8, 0, 17]); g.tune.qrfEta = 15; const asked = requestQrf(g, 'panel');
    const lines: { who: string; text: string; t: number; aim: number; gd: any; best: number }[] = []; const seen = new WeakMap<any, number>();
    R.step(60 * 60, () => { for (const gd of g.qrf.men) { const b = gd.bubble; if (b?.radio && seen.get(gd) !== b.t) { seen.set(gd, b.t); lines.push({ who: gd.callsign, text: b.text, t: g.time, aim: gd.char.anim.upperW.aim, gd, best: 0 }); } }
      for (const L of lines) if (g.time - L.t < 1.2) L.best = Math.max(L.best, L.gd.char.anim.radioShown); });
    const shown = lines.filter(L => L.best > 0.5), gunUp = lines.filter(L => L.best <= 0.5 && L.gd.char.anim.longGun);
    verdict(asked && lines.length > 0 && HANDWORK_STATS.radio >= lines.length && shown.length + gunUp.length === lines.length, 'the response team: every radio line of one of its men asks for the hand — it comes up, or his long gun has both hands and it does not', `${lines.length} lines in the minute after the call · hand up for ${shown.length} · long gun up for ${gunUp.length}${lines.length ? ` · e.g. ${lines[0].who} "${lines[0].text}" best weight ${f2(lines[0].best)}` : ''}`); }
  return allPass;
}); }

// ================================================================ swap
export async function handworkSwap(): Promise<boolean> { return keep(async () => {
  console.log('\n=== handwork-swap: torch to sidearm and back is a move of his hands; the torch hangs on his belt meanwhile; the first round is no later ===');
  allPass = true;
  const pick = (g: any) => g.guards.find((x: any) => G.inHand(x) === 'torch');
  { const R = await rig(true, { ai: true }), { g } = R; g.teleportPlayer([8, 0, 17]); R.step(30);
    const gd = pick(g); if (!gd) { verdict(false, 'a man of the shift with his torch in his hand', 'none'); return allPass; }
    const ch = gd.char, an = ch.anim, seq = (rule: () => any, n: number) => { const S: { held: any; t: number }[] = []; let dHip = 9, tEnd = -1; R.step(n, i => { const h = an.swapHeld(rule()), s = an.swapInfo(); if (!S.length || S[S.length - 1].held !== h) S.push({ held: h, t: (i + 1) * DT }); if (s.a > 0.1 && s.a < 0.5) dHip = Math.min(dHip, v3.dist(ch.bones.handR, ch.bones.hips)); if (tEnd < 0 && S.length > 1 && s.a < 0) tEnd = (i + 1) * DT; }); return { S, dHip, tEnd }; };
    const before = G.inHand(gd); G.raiseEscalation(g, 1, 'device');
    const D = seq(() => G.inHand(gd), 90), words = (S: { held: any; t: number }[]) => S.map(s => `${s.held ?? 'empty'} @${f2(s.t)}`).join(' → ');
    const order = D.S.map(s => s.held).join(',');
    verdict(before === 'torch' && G.inHand(gd) === 'weapon' && /^torch,,weapon$/.test(order) && D.dHip < 0.32 && Math.abs(D.tEnd - SWAP.draw - an.swapLag) < 0.12, 'the floor up a step: the rule says sidearm at once, his hand shows torch, then nothing, then the sidearm — the hand down at his belt between — over SWAP.draw after his own beat', `${gd.callsign}: ${words(D.S)} · hand ${f2(D.dHip)} m from his hips mid-move · done ${f2(D.tEnd)} s (SWAP.draw ${SWAP.draw})`);
    { const out: any[] = []; handProps(g, out); const hip = ch.bones.hips, belt = out.filter((b: any) => b.owner === (ch.id & 0xff) && Math.abs(b.c[1] - hip[1]) < 0.2 && flat(b.c, hip) < 0.3 && Math.max(b.h[0], b.h[1], b.h[2]) < 0.09);
      HANDWORK.on = false; const off: any[] = []; handProps(g, off); HANDWORK.on = true; const n0 = off.filter((b: any) => b.owner === (ch.id & 0xff)).length, n1 = out.filter((b: any) => b.owner === (ch.id & 0xff)).length;
      verdict(n1 === n0 + 2 && belt.length >= 2, 'with the sidearm out his torch hangs on his belt (two boxes at his right hip, his own — nothing there with the switch off)', `his boxes: ${n1} on · ${n0} off · at the belt ${belt.length}`); }
    G.standDownEscalation(g); let tRule = -1; R.step(60 * 40, i => { if (tRule < 0 && G.inHand(gd) === 'torch') tRule = i; if (tRule >= 0) return; });
    if (G.inHand(gd) !== 'torch') verdict(false, 'the floor stood down: he goes back to his torch', `still ${G.inHand(gd)} · state ${gd.state}`);
    else { // (the stow began the frame the rule changed; replay it from a fresh stand-down to time it)
      G.raiseEscalation(g, 1, 'device'); R.step(120); G.standDownEscalation(g); let S: { held: any; t: number }[] = [], t0 = -1, tEnd = -1;
      R.step(60 * 40, i => { const rule = G.inHand(gd); if (t0 < 0) { if (rule !== 'torch') return; t0 = i; } const h = an.swapHeld(rule), s = an.swapInfo(), t = (i - t0 + 1) * DT; if (t < 2) { if (!S.length || S[S.length - 1].held !== h) S.push({ held: h, t }); if (tEnd < 0 && S.length > 1 && s.a < 0) tEnd = t; } });
      verdict(S.map(s => s.held).join(',') === 'weapon,,torch' && Math.abs(tEnd - SWAP.stow - an.swapLag) < 0.12, 'stood down: the sidearm goes away and the torch comes off his belt the same way, over SWAP.stow after his own beat', `${words(S)} · done ${f2(tEnd)} s (SWAP.stow ${SWAP.stow})`); } }
  // ---- a floor alarm does not move every hand on one frame
  { const R = await rig(true, { ai: true }), { g } = R; g.teleportPlayer([8, 0, 17]); R.step(30);
    const torch = g.guards.filter((x: any) => G.inHand(x) === 'torch'); G.raiseEscalation(g, 1, 'device');
    const st0: number[] = torch.map(() => -1), early0: boolean[] = torch.map(() => false);
    R.step(40, i => torch.forEach((m: any, k: number) => { if (st0[k] >= 0) return; const A = m.char.anim; if (A.swapInfo().a >= 0) st0[k] = i; else if (A.swapHeld(G.inHand(m)) !== 'torch') early0[k] = true; }));
    const keep = torch.map((x: any) => G.inHand(x) === 'weapon'), men = torch.filter((_: any, k: number) => keep[k]), st = st0.filter((_, k) => keep[k]), early = early0.filter((_, k) => keep[k]);
    const ok = men.every((m: any, k: number) => st[k] >= 0 && !early[k] && m.char.anim.swapLag <= SWAP.lag && Math.abs(st[k] * DT - m.char.anim.swapLag) < 2.5 * DT);
    verdict(men.length >= 2 && new Set(st).size >= 2 && ok, 'the floor up a step for the whole shift: each man keeps his torch for his own beat (a share of SWAP.lag off his id), so their hands do not all start on one frame', men.map((m: any, k: number) => `${m.callsign} starts frame ${st[k]} (beat ${f2(m.char.anim.swapLag)} s)`).join(' · '));
    const gd = men.slice().sort((a: any, b: any) => b.char.anim.swapLag - a.char.anim.swapLag)[0];
    if (gd) { G.standDownEscalation(g); let back = false; R.step(60 * 40, () => { back ||= G.inHand(gd) === 'torch' && gd.char.anim.swapInfo().a < 0 && !gd.char.anim.swapInfo().pending; return back; });
      G.raiseEscalation(g, 1, 'device'); R.step(3); /* (the rule turns a frame on; his beat is the longest of the shift's) */ const p0 = gd.char.anim.swapInfo(); gd.char.anim.fire(); R.step(1); const p1 = gd.char.anim.swapInfo();
      verdict(back && p0.pending && p0.a < 0 && p1.a >= 0.8, 'a round fired inside his beat: the move starts on that frame and jumps to the gun in his hand', `${gd.callsign}: before the round pending ${p0.pending}, progress ${f2(p0.a)} · the frame after ${f2(p1.a)}`); } }
  // ---- the first round is no later
  { const first = async (on: boolean) => { const R = await rig(on, { ai: true, seed: 5 }), { g, pl } = R; g.teleportPlayer([8, 0, 17]); R.step(30);
      const gd = pick(g), ch = gd.char, f: Vec3 = [Math.sin(ch.bodyYaw), 0, Math.cos(ch.bodyYaw)]; let at: Vec3 | null = null;
      for (const d of [4, 3.5, 3, 2.5]) { const p: Vec3 = [ch.pos[0] + f[0] * d, 0, ch.pos[2] + f[2] * d]; if (!g.col.nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([p[0], 1.2, p[2]], [ch.pos[0], 1.5, ch.pos[2]])) { at = p; break; } }
      if (!at) return { frames: -2, who: gd.callsign, swaps: 0, mz: [] as number[] };
      const s0 = HANDWORK_STATS.swaps, e0 = g.events.length; g.teleportPlayer(at); pl.holstered = false; g.playerInvisible = false; let frames = -1, seenE = e0; const mz: number[] = [];
      for (let i = 0; i < 60 * 20 && frames < 0; i++) { pl.visibility = 0.9; R.step(); mz.push(ch.muzzle[0], ch.muzzle[1], ch.muzzle[2]); for (; seenE < g.events.length; seenE++) { const e = g.events[seenE]; if (e.kind === 'guardShot') { frames = i; break; } } if (g.events.length < seenE) seenE = g.events.length; }
      return { frames, who: gd.callsign, swaps: HANDWORK_STATS.swaps - s0, mz }; };
    const A = await first(true), B = await first(false);
    verdict(A.frames >= 0 && B.frames >= 0 && A.frames <= B.frames && A.swaps > 0, 'Sam stood in a torch-carrying guard\'s beam: the shift\'s first round comes no later with the swap than without (the rule of what is in his hand is untouched; a shot mid-draw jumps the move)', `first round ${A.frames} frames on (${A.swaps} swaps begun) · ${B.frames} frames off · in front of ${A.who}`);
    let dm = 0; const nm = Math.min(A.mz.length, B.mz.length); for (let i = 0; i < nm; i++) dm = Math.max(dm, Math.abs(A.mz[i] - B.mz[i]));
    verdict(nm > 30 && A.mz.length === B.mz.length && dm < 1e-6, 'his muzzle through the whole draw is where it is with the swap off (the bore and a round\'s start are read under the swap\'s arm: the hand\'s trip past his belt is for the eye)', `largest difference over ${nm / 3} frames: ${dm.toExponential(1)} m`); }
  // ---- a re-bake mid-draw keeps the move; a man dropped mid-draw falls as he does with the swap off
  { const R = await rig(true, { ai: true }), { g } = R; g.teleportPlayer([8, 0, 17]); R.step(30);
    const gd = pick(g), an = gd.char.anim; G.raiseEscalation(g, 1, 'device'); R.step(10 + Math.ceil(an.swapLag * 60)); const a0 = an.swapInfo().a; gd.char.update(0); gd.char.update(0); const a1 = an.swapInfo().a; R.step(1); const a2 = an.swapInfo().a;
    verdict(a0 > 0.05 && a0 < 0.9 && a1 === a0 && a2 > a0, 'his pose re-baked mid-draw (dt 0): the move stands where it was and goes on', `progress ${f2(a0)} → ${f2(a1)} after two re-bakes → ${f2(a2)} a frame on`); }
  { const fall = async (on: boolean) => { const R = await rig(on, { ai: true, seed: 9 }), { g } = R; HANDWORK.radio = false; g.teleportPlayer([8, 0, 17]); R.step(30);   // (the swap alone: a hand at the radio is part of the body that falls)
      const gd = pick(g), ch = gd.char; G.raiseEscalation(g, 1, 'device'); R.step(12 + Math.ceil(SWAP.lag * ((ch.id * 0.6180339887) % 1) * 60)); const a = ch.anim.swapInfo().a;   // (past his own beat, the same frame count either way)
      killGuard(g, gd, [Math.sin(ch.bodyYaw + 2.6), 0, Math.cos(ch.bodyYaw + 2.6)]); R.step(150);
      const out: number[] = []; for (const k of ['hips', 'head', 'handR', 'handL', 'footL', 'footR']) { const b = ch.bones[k]; out.push(b[0], b[1], b[2]); } return { a, out, who: gd.callsign }; };
    const A = await fall(true), B = await fall(false); let d = 0; for (let i = 0; i < A.out.length; i++) d = Math.max(d, Math.abs(A.out[i] - B.out[i]));
    verdict(A.a > 0.1 && A.a < 0.9 && B.a < 0 && d < 1e-6, 'a guard shot mid-draw lies where he lies with the swap off (the body is seeded from the arm under the swap)', `${A.who}: swap at ${f2(A.a)} when hit · largest joint difference 2.5 s on: ${d.toExponential(1)} m`); }
  return allPass;
}); }

// ================================================================ off
export async function handworkOff(): Promise<boolean> { return keep(async () => {
  console.log('\n=== handwork-off: the switch off — the breaker on the tap, the pad\'s one beep then three, no pose, the swap instant; picture-only halves digest the same ===');
  allPass = true; Object.assign(HANDWORK_STATS, { work: 0, radio: 0, swaps: 0, levers: 0 });
  { const R = await rig(false), { g, pl, c, W } = R, bp: Vec3 = g.level.breaker.pos; g.teleportPlayer([bp[0], 0, bp[2] - 0.9]); pl.holstered = true; R.step(20);
    g.selectVerb('breaker', 'breakerOff'); R.tap(); let fB = -1, moved = false; R.step(30, i => { if (fB < 0 && g.blackout.active) fB = i; moved ||= !!pl.breakerMove || !!R.work().pose; });
    verdict(fB >= 0 && fB <= 2 && !moved, 'the breaker flips on the tap, no move, no pose', `blackout ${fB < 0 ? 'never' : `${fB} frames after the tap`} · move or pose seen ${moved}`);
    g.endBlackout(); R.step(10);
    const Kp = g.devices.keypads[0], fc = Kp.door.frameCentre, n = Kp.n; learnCode(g, Kp.door.lockId, 'told'); g.teleportPlayer([fc[0] + n[0] * 0.9, 0, fc[2] + n[2] * 0.9]); R.step(20);
    const p0 = v3.copy(c.pos); W.audioLog = []; g.selectVerb('door', 'code'); R.tap(); const t0 = g.time; let tOpen = -1, pose = false; R.step(150, () => { pose ||= !!R.work().pose; if (tOpen < 0 && (W.audioLog as any[]).some(a => a.name === 'padOpen')) tOpen = g.time - t0; });
    const beeps = (W.audioLog as any[]).filter(a => a.name === 'padBeep').length; W.audioLog = null;
    verdict(beeps === 4 && Math.abs(tOpen - CODE_SECS) < 0.08 && flat(c.pos, p0) < 0.02 && !pose, 'the keypad: its beep on the tap and three more, open at CODE_SECS, his feet where they were, no pose', `beeps ${beeps} · open ${f2(tOpen)} s · moved ${f2(flat(c.pos, p0))} m · pose ${pose}`);
    const rf: Vec3 = g.level.mission.rack.front; g.mission.stage = 'drive'; g.teleportPlayer([rf[0], 0, rf[2] + 0.9]); R.step(20); g.selectVerb('objective', 'drive'); R.tap(); let fP = -1; pose = false; R.step(Math.round((DRIVE_SECS + 0.5) * 60), i => { pose ||= !!R.work().pose; if (fP < 0 && g.mission.stage !== 'drive') fP = i; });
    verdict(fP > 0 && !pose, 'the drive: pulled, no pose', `pulled at frame ${fP} · pose ${pose}`); }
  { const R = await rig(false, { ai: true }), { g } = R; g.teleportPlayer([8, 0, 17]); R.step(30); const gd = g.guards.find((x: any) => G.inHand(x) === 'torch'), an = gd.char.anim;
    G.raiseEscalation(g, 1, 'device'); let bad = 0, rad = 0; g.say(gd, 'control, checking in', true); R.step(90, () => { if (an.swapHeld(G.inHand(gd)) !== G.inHand(gd) || an.swapInfo().a >= 0) bad++; rad = Math.max(rad, an.radioShown); });
    verdict(bad === 0 && rad === 0 && G.inHand(gd) === 'weapon', 'the shift up a step and a radio line: what his hand shows IS the rule on every frame, no move, no radio hand', `frames the shown thing differed from the rule ${bad} · best radio weight ${f2(rad)}`);
    verdict(Object.values(HANDWORK_STATS).every(v => v === 0), 'and the module counted nothing', JSON.stringify(HANDWORK_STATS)); }
  { const run = async (on: boolean) => { const R = await rig(on, { ai: true, seed: 3 }), { g } = R; g.teleportPlayer([8, 0, 17]); R.step(300); G.raiseEscalation(g, 1, 'device'); R.step(120); g.say(g.guards[0], 'control, nothing here', true); R.step(60 * 20); return hashDigest(digestGame(g, true)); };
    const A = await run(true), B = await run(false);
    verdict(A === B, 'twenty-seven seconds of the shift going up a step and talking on the net digest the same on and off: the radio hand and the swap move nothing of the game', `on ${A} · off ${B}`); }
  return allPass;
}); }

// ================================================================ harness
export async function handworkHarness(): Promise<boolean> { return keep(async () => {
  console.log('\n=== handwork-harness: the frozen stand holds the switch off, the page turns it on unless ?nohandwork, the table is a registered knob table ===');
  allPass = true; const P = await import(`${ROOT}/src/host/profile.ts`), K = await import(`${ROOT}/src/game/knobs.ts`), E = await import(`${ROOT}/src/host/standEnv.ts`);
  { const frozen = !process.env.TPS_PROFILE || process.env.TPS_PROFILE === 'frozen', word = process.env.TPS_HANDWORK;
    if (frozen || word !== undefined) HANDWORK.on = word !== '1';
    const before = HANDWORK.on; await quiet(() => standUp()); const want = frozen || word !== undefined ? word === '1' : before;
    verdict(HANDWORK.on === want, frozen ? 'standUp() on the frozen stand puts HANDWORK.on to what TPS_HANDWORK says (unset: off — every stored digest read the breaker on the tap and the instant swap)' : "standUp() on the shipped stand leaves HANDWORK.on to the page's boot (or to TPS_HANDWORK where it is given)", `before ${before} · after ${HANDWORK.on} · TPS_HANDWORK ${word ?? 'unset'} · TPS_PROFILE ${process.env.TPS_PROFILE ?? 'unset'}`); }
  { const row = P.FROZEN_HOLDS['HANDWORK.on']; verdict(typeof row === 'string' && /TPS_HANDWORK=1/.test(row) && E.STAND_ENV.includes('TPS_HANDWORK'), 'FROZEN_HOLDS names HANDWORK.on with the word that turns it on, and STAND_ENV carries that word', `FROZEN_HOLDS['HANDWORK.on'] = ${JSON.stringify(row)} · in STAND_ENV ${E.STAND_ENV.includes('TPS_HANDWORK')}`); }
  { const c = K.knobsCopy(); let a: unknown, b: unknown, o: unknown;
    try { HANDWORK.on = false; P.pageSwitches(new URLSearchParams('')); a = HANDWORK.on; P.pageSwitches(new URLSearchParams('nohandwork')); b = HANDWORK.on; P.pageSwitches(new URLSearchParams('noclose&nolightwall')); o = HANDWORK.on; } finally { K.knobsBack(c); }
    verdict(a === true && b === false && o === true, "the page's boot (pageSwitches): no flag → on · ?nohandwork → off · other flags leave it on", `'' → ${a} · 'nohandwork' → ${b} · 'noclose&nolightwall' → ${o}`); }
  { const reg = K.knobRegistry(), same = reg.HANDWORK === HANDWORK, inJ = K.JOURNAL_KNOBS.includes('HANDWORK'); const c = K.knobsCopy(), was = HANDWORK.standM; HANDWORK.standM = was + 1; K.knobsBack(c);
    verdict(same && inJ && HANDWORK.standM === was, 'knobRegistry().HANDWORK is the table, a recording carries it (JOURNAL_KNOBS), knobsCopy / knobsBack restore it', `registry is the table ${same} · in JOURNAL_KNOBS ${inJ} · standM put back ${HANDWORK.standM === was}`); }
  return allPass;
}); }

if (import.meta.main) {
  const which = process.argv[2] ?? 'all'; let ok = true;
  if (which === 'all' || which === 'work') ok = await handworkWork() && ok;
  if (which === 'all' || which === 'radio') ok = await handworkRadio() && ok;
  if (which === 'all' || which === 'swap') ok = await handworkSwap() && ok;
  if (which === 'all' || which === 'off') ok = await handworkOff() && ok;
  if (which === 'all' || which === 'harness') ok = await handworkHarness() && ok;
  console.log(ok ? '\n=== handwork: ALL PASS ===' : '\n=== handwork: FAILED ==='); process.exit(ok ? 0 : 1);
}
