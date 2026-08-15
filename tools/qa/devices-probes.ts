// The level-design devices (game/devices.ts, STATUS G4) headless: `bun run tools/qa/probes.ts devices` (family) or one of devices-camera / devices-keypad /
// devices-laser / devices-editor / devices-vision. Staged like the other families: the whole Game over the fake GPU, real inputs, the light meter as the
// script's knob (player.visibility — the renderer never answers headless), the probe's smoke answer planted by hand (probe.results) where a plume is wanted.
//   devices-camera   Sam lit in the corridor camera's picture: 'movement in …' at ~0.8 lit-s + a calm man sent (task 'device'), the floor up a step by ~2 lit-s
//                    with the fix broadcast; Sam DARK in the same spot: nothing; a plume between (transmittance 0.15): nothing; the OCP: blind for its spell, then
//                    it sees again; a round: dead, sparks, 'went dark' + a man sent to it; a blackout: the mains cameras dark, the UPS one alive; the panel switch
//                    and the tour's flag: nothing reported; the integrator drains out of view and the camera re-arms
//   devices-keypad   the side door on its pad: against Sam from the office (rows 'keypad — no code' + kick, the deny), a thumb-turn from the server room, staff
//                    walk it; the code off a questioned man (intel 'code' → Player.codes) and off the sticky-note pair said within earshot (col.sound) — not from
//                    two rooms off; 'enter the code': four keys, the pad takes it at CODE_SECS, unlock + creak, through, and it springs locked behind him
//   devices-laser    the corridor shin beam: walked through standing AND crouched = a trip each (radio + a man sent), guards never; the storage chest beam:
//                    crouch-walked under = nothing, walked = a trip; a canister thrown through the corridor beam trips it; a hauled body trips it; OCP / a round /
//                    the mains (battery survives) as the cameras; 'alarm' beams put the floor up
//   devices-editor   __ed.device: add camera / keypad (locks its door) / laser, move / rotate / aim / end / duplicate / delete (the door comes off the pad's
//                    lock), undo back to the original digest, validate + lint clean, planted lint faults reported
//   devices-vision   the guards' OWN sight is untouched by the eye factoring: canSee / canSeeChar / sightGain over 4000 seeded stagings hash to the digest
//                    recorded off main before the lane (d7745582)
import { readFileSync } from 'node:fs';
import { standUp, ROOT, fake } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const DEV = await import(`${ROOT}/src/game/devices.ts`);
const D = await import(`${ROOT}/src/game/dialogue.ts`);
const { startGrab, heldTalk } = await import(`${ROOT}/src/game/player.ts`);
const { rollcallState, canSee, canSeeChar, sightGain } = await import(`${ROOT}/src/game/guards.ts`);
const { PLAYER_ID } = await import(`${ROOT}/src/game/consts.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2);
function place(gd: any, p: Vec3, yaw: number) { gd.char.pos = v3.copy(p); gd.char.vel = [0, 0, 0]; gd.speed = 0; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.path = []; gd.pathGoal = null; gd.char.update(0); gd.char.update(DT); }
/** parked out on the lot east of the building, held (scripted), facing east, deaf */
function park(gd: any, i: number) { gd.hold = true; place(gd, [37.5, 0, 6 + i * 1.5], Math.PI / 2); gd.heardUpTo = 1e12; }
/** a calm floor with everyone FREE on their routes but deaf to Sam's staging noises up to now, no radio check soon; msgs tapped */
async function world(seed: number) {
  Math.random = seeded(seed);
  const W = await standUp(); const { game } = W;
  game.godMode = true; game.player.visibility = 0.02;
  game.tune.civilians = false; game.civilians.length = 0;   // (the civilians lane: these worlds deafen the STAFF to Sam's staging — a civilian left hearing Kowalski's rounds runs and tells a man, and 'the nearest calm man' is then nobody; devices are what is on trial here, so the floor is the shift alone)
  for (let i = 0; i < 5; i++) W.step(DT);
  rollcallState(game).nextAt = game.time + 600;
  const msgs: { t: number; text: string }[] = []; const orig = game.msg.bind(game); game.msg = (text: string) => { msgs.push({ t: game.time, text }); return orig(text); };
  return { W, game, msgs };
}
const steps = (W: any, secs: number, until?: () => boolean) => { const n = Math.max(1, Math.round(secs / DT)); for (let i = 0; i < n; i++) { W.step(DT); if (until?.()) return true; } return !until || until(); };

let allPassGlobal = true;
function verdictFn(name: string) { let all = true; const v = (ok: boolean, label: string, detail: string, fails: string[]) => { all &&= ok; allPassGlobal &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); }; return { v, done: () => all }; }

// ================================================================================================================================ camera
export async function devicesCamera() {
  console.log("\n=== devices-camera: the corridor camera's picture through the guards' eye test and Sam's meter — lit / dark / smoke / OCP / shot / mains / switched off / re-arm ===");
  const { v, done } = verdictFn('camera');
  const stage = async (seed: number, opts: { vis: number; smoke?: number; at?: Vec3 } = { vis: 1 }) => {
    const S = await world(seed); const { W, game } = S;
    const cam = game.devices.cameras[0];   // cam_corridor: east end, looking west, pans ±0.45
    game.teleportPlayer(opts.at ?? [30, 0, 11.1]); game.player.crouch = false; W.step(DT); game.player.visibility = opts.vis;
    if (opts.smoke !== undefined) game.probe.results.set(cam.smokeKey, [opts.smoke, 0, 0]);   // the probe's answer for the lens → chest segment, as the renderer would give it through a plume
    return { ...S, cam };
  };
  // (a) lit, in the picture: suspicion by ~0.8 lit-s (a fully lit man 5.7 m off fills ~0.9/s), a calm man sent with a 'device' task, the floor up a step by ~2 lit-s, everybody's fix on him
  {
    const { W, game, msgs, cam } = await stage(801); const fails: string[] = [];
    if (game.devices.cameras.length !== 3 || game.devices.lasers.length !== 2 || game.devices.keypads.length !== 1) fails.push(`level: ${game.devices.cameras.length} cameras / ${game.devices.lasers.length} beams / ${game.devices.keypads.length} pads (want 3 / 2 / 1)`);
    if (!game.targets.some((t: any) => t.kind === 'device' && t.name === 'cam_corridor' && t.mains) || !game.targets.some((t: any) => t.name === 'cam_lobby' && !t.mains)) fails.push('targets: cam_corridor (mains) / cam_lobby (UPS) not registered as device targets');
    let tSus = -1, tAl = -1, seenAtSus = 0; const esc0 = game.escalation; const t0 = game.time;
    for (let i = 0; i < 60 * 5; i++) { W.step(DT); game.player.visibility = 1; if (tSus < 0 && cam.state === 'suspect') { tSus = game.time - t0; seenAtSus = cam.seen; } if (tAl < 0 && cam.state === 'alarm') tAl = game.time - t0; }
    const sent = game.guards.find((g: any) => g.task?.kind === 'device');
    const radioSus = msgs.find(m => /CONTROL — camera 1 has movement in the corridor/.test(m.text)), radioAl = msgs.find(m => /CONTROL — camera 1: that's him/.test(m.text));
    const SUS = DEV.DEVICE_TUNE_DEFAULTS.cameraSuspicionSecs, AL = DEV.DEVICE_TUNE_DEFAULTS.cameraAlarmSecs;   // (the shipped lit-seconds — 1.5 / 3.5 since 08-12, 0.8 / 2.0 before; a fully lit man 5.7 m off fills ~0.9 lit-s a second, so the times scale with them)
    if (tSus < SUS / 0.9 * 0.65 || tSus > SUS / 0.9 * 1.6) fails.push(`suspicion at +${f2(tSus)} s (want ≈ ${f2(SUS / 0.9)}: ${SUS} lit-s at ~0.9/s)`);
    if (!radioSus) fails.push(`no 'camera 1 has movement in the corridor' radio line (log: ${msgs.slice(0, 4).map(m => m.text).join(' | ')})`);
    if (!sent && !radioSus?.text.includes('go and look')) { /* nobody free is legitimate only if the line says so */ } if (!sent) fails.push('no calm man was handed the device errand');
    else if (v3.distXZ(sent.task.pos, [30, 0, 11.1]) > 1.2 || sent.state !== 'suspicious' && sent.state !== 'alert') fails.push(`the errand goes to (${f2(sent.task.pos[0])}, ${f2(sent.task.pos[2])}) / he is ${sent.state} (want Sam's spot, suspicious)`);
    if (tAl < AL / 0.9 * 0.75 || tAl > AL / 0.9 * 1.5) fails.push(`alarm at +${f2(tAl)} s (want ≈ ${f2(AL / 0.9)}: ${AL} lit-s at ~0.9/s)`);
    if (game.escalation !== esc0 + 1) fails.push(`escalation ${esc0} → ${game.escalation} (want +1)`);
    if (!radioAl) fails.push("no 'camera 1: that's him' line"); if (!msgs.some(m => /copy, control — weapons out/.test(m.text))) fails.push("the floor's spokesman never answered control ('copy, control — weapons out…')");
    const fixes = game.guards.filter((g: any) => g.lastKnown && v3.distXZ(g.lastKnown, game.player.char.pos) < 1.5).length;
    if (fixes < game.guards.length - 1) fails.push(`only ${fixes} men have the fix on him after the alarm`);
    const chron = game.chronicle.events.map((e: any) => e.kind);
    if (!chron.includes('cameraSpotted') || !chron.includes('cameraAlarm') || !chron.includes('alarm')) fails.push(`chronicle kinds [${chron.join(',')}] (want cameraSpotted, cameraAlarm, alarm)`);
    if (game.chronicle.counts.devices !== 1) fails.push(`counts.devices ${game.chronicle.counts.devices} (want 1: the suspicion; the alarm is esc1)`);
    v(fails.length === 0, '(a) lit at (30, 11.1), 5.7 m into the corridor camera\'s picture: control radios "movement in the corridor" at ~0.9 s and a calm man is sent to the spot; held in view, "that\'s him" at ~2.5 s, the floor goes up one step, everybody has the fix; chronicle rows + the score\'s count',
      `suspicion +${f2(tSus)} s (integrator ${f2(seenAtSus)}), alarm +${f2(tAl)} s, esc ${esc0}→${game.escalation}, sent ${sent?.callsign ?? '—'} → (${sent ? f2(sent.task.pos[0]) + ', ' + f2(sent.task.pos[2]) : '—'})\n    radio: ${msgs.filter(m => /^radio/.test(m.text)).slice(0, 4).map(m => `+${f2(m.t - t0)} ${m.text}`).join(' | ')}`, fails);
  }
  // (b) DARK in the same spot (meter 0.03): five seconds in the picture and the integrator never moves — the light meter IS its exposure
  {
    const { W, game, msgs, cam } = await stage(802, { vis: 0.03 }); const fails: string[] = [];
    let peak = 0, inCone = 0; for (let i = 0; i < 60 * 5; i++) { W.step(DT); game.player.visibility = 0.03; peak = Math.max(peak, cam.seen); const look = DEV.lensDir(cam.yaw, cam.def.pitch ?? -0.35); const to = v3.sub(game.player.char.pos, cam.def.pos); if (v3.dot([look[0], 0, look[2]], v3.normalize([to[0], 0, to[2]])) > Math.cos(35 * Math.PI / 180)) inCone++; }
    if (peak > 0.05) fails.push(`integrator peaked at ${f2(peak)} in the dark`); if (cam.state !== 'idle') fails.push(`camera state ${cam.state}`); if (msgs.some(m => /CONTROL/.test(m.text))) fails.push('control spoke');
    if (inCone < 60) fails.push(`staging: Sam was inside the pan's cone only ${inCone} frames`);
    v(fails.length === 0, '(b) the same spot in the DARK (meter 0.03): in the cone for seconds, nothing — integrator flat, no radio, nobody sent', `peak ${f2(peak)}, in cone ${inCone}/300 frames, state ${cam.state}`, fails);
  }
  // (c) lit but a plume between lens and chest (the probe's transmittance 0.15 planted under the camera's key): the eye test says no as it does for a man
  {
    const { W, game, msgs, cam } = await stage(803, { vis: 1, smoke: 0.15 }); const fails: string[] = [];
    let peak = 0; for (let i = 0; i < 60 * 4; i++) { W.step(DT); game.player.visibility = 1; game.probe.results.set(cam.smokeKey, [0.15, 0, 0]); peak = Math.max(peak, cam.seen); }
    if (peak > 0.05 || cam.state !== 'idle' || msgs.some(m => /CONTROL/.test(m.text))) fails.push(`through smoke: peak ${f2(peak)}, state ${cam.state}`);
    // and the ramp: at 0.55 transmittance it fills at half the clear-air rate (the same 0.3‥0.8 ramp sightGain has)
    game.probe.results.set(cam.smokeKey, [0.55, 0, 0]); cam.seen = 0; const s0 = cam.seen; for (let i = 0; i < 30; i++) { W.step(DT); game.player.visibility = 1; game.probe.results.set(cam.smokeKey, [0.55, 0, 0]); } const half = cam.seen - s0;
    game.probe.results.set(cam.smokeKey, [1, 0, 0]); cam.seen = 0; cam.state = 'idle'; cam.reportedAt = -100; for (let i = 0; i < 30; i++) { W.step(DT); game.player.visibility = 1; game.probe.results.set(cam.smokeKey, [1, 0, 0]); } const full = cam.seen;
    if (!(half > 0.15 * full && half < 0.7 * full)) fails.push(`ramp: 0.5 s at T 0.55 filled ${f2(half)} vs ${f2(full)} clear (want about half)`);
    v(fails.length === 0, '(c) lit but a plume between (transmittance 0.15 on the lens → chest segment): nothing; at 0.55 it fills at about half the clear-air rate', `peak ${f2(peak)} · half-smoke ${f2(half)} vs clear ${f2(full)} per 0.5 s`, fails);
  }
  // (d) the OCP: blind for its spell (LED dark, integrator reset, the pan holds), then it sees again and calls him in
  {
    const { W, game, msgs, cam } = await stage(804, { vis: 1 }); const fails: string[] = [];
    game.ocp(cam.target); W.step(DT);
    if (!(cam.target.disabledUntil > game.time)) fails.push('the OCP did not knock the camera out (disabledUntil not set)');
    let peakBlind = 0; const yaw0 = cam.yaw; steps(W, 3, () => { game.player.visibility = 1; peakBlind = Math.max(peakBlind, cam.seen); return false; });
    if (peakBlind > 0.02) fails.push(`integrator moved while blind (${f2(peakBlind)})`); if (Math.abs(cam.yaw - yaw0) > 1e-6) fails.push('the pan kept turning without power');
    if (DEV.alive(cam.target)) fails.push('alive() true while OCP\'d');
    const back = steps(W, game.tune.ocpDuration + 2, () => { game.player.visibility = 1; return cam.state !== 'idle'; });
    if (!back) fails.push(`after the OCP's ${game.tune.ocpDuration} s (+ restrike) it never called him in again`);
    if (!msgs.some(m => /OCP → cam_corridor disabled/.test(m.text))) fails.push('no OCP log line');
    v(fails.length === 0, "(d) the OCP on it: blind for the OCP's spell — LED dark, integrator flat, the pan holds — then the restrike and it calls him in", `blind peak ${f2(peakBlind)}, back ${back} at +${f2(game.time)}, state ${cam.state}`, fails);
  }
  // (e) a round through it: dead for the encounter, sparks, control loses the feed and sends a man to IT; repairLights (restart) mends it
  {
    const { W, game, msgs, cam } = await stage(805, { vis: 0.03 }); const fails: string[] = [];
    const sparks0 = game.sparks.live;
    cam.target.broken = true;   // (combat.ts's light pass does exactly this when Sam's round passes within 0.3 m of the lens; the round itself is fireWeapon's business)
    W.step(DT); W.step(DT);
    const sent = game.guards.find((g: any) => g.task?.kind === 'device');
    if (!msgs.some(m => /CONTROL — camera 1 just went dark/.test(m.text))) fails.push(`no 'camera 1 just went dark' line (${msgs.map(m => m.text).slice(-3).join(' | ')})`);
    if (!sent) fails.push('nobody sent to the dead camera'); else if (v3.distXZ(sent.task.pos, cam.def.pos) > 2.5) fails.push(`sent to (${f2(sent.task.pos[0])}, ${f2(sent.task.pos[2])}), ${f2(v3.distXZ(sent.task.pos, cam.def.pos))} m from the camera`);
    if (!(game.sparks.live > sparks0)) fails.push('no sparks');
    let peak = 0; steps(W, 3, () => { game.player.visibility = 1; peak = Math.max(peak, cam.seen); return false; }); if (peak > 0.02) fails.push('a dead camera still integrates');
    const twice = msgs.filter(m => /went dark/.test(m.text)).length; if (twice !== 1) fails.push(`'went dark' ×${twice}`);
    game.restartEncounter(); W.step(DT); if (cam.target.broken || cam.deadCalled || cam.seen !== 0) fails.push('restart did not mend it');
    v(fails.length === 0, '(e) shot dead: sparks, "camera 1 just went dark — X, get eyes on it" once, the man is sent to the floor under it, nothing more integrates; a restart mends it', `sent ${sent?.callsign ?? '—'}, sparks ${game.sparks.live - sparks0 > 0}, dead peak ${f2(peak)}`, fails);
  }
  // (f) the mains: a blackout takes the two mains cameras down and leaves the UPS one; the restrike brings them back
  {
    const { W, game } = await stage(806, { vis: 0.03 }); const fails: string[] = [];
    game.setBlackout(20, 'debug'); steps(W, 1.5);
    const st = game.devices.cameras.map((c: any) => `${c.def.name}:${DEV.alive(c.target) ? 'up' : 'dark'}`).join(' ');
    if (DEV.alive(game.devices.cameras[0].target) || DEV.alive(game.devices.cameras[1].target)) fails.push(`mains cameras alive in the blackout (${st})`);
    if (!DEV.alive(game.devices.cameras[2].target)) fails.push('the UPS camera (cam_lobby) died with the mains');
    if (DEV.alive(game.devices.lasers[0].target) || !DEV.alive(game.devices.lasers[1].target)) fails.push(`beams: corridor ${DEV.alive(game.devices.lasers[0].target)} (want dark) storage ${DEV.alive(game.devices.lasers[1].target)} (want up, battery)`);
    game.endBlackout(); steps(W, 4);
    if (!game.devices.cameras.every((c: any) => DEV.alive(c.target))) fails.push('not all back after the restrike');
    v(fails.length === 0, '(f) the breaker: mains-fed cameras (corridor, server) and the corridor beam go dark, the UPS camera and the battery beam stay up; the restrike brings the rest back', st, fails);
  }
  // (g) the panel switch (tune.devices off) and the tour's flag (quietUtility): in the picture, lit, for seconds — drawn and panning, nothing reported
  {
    const { W, game, msgs, cam } = await stage(807, { vis: 1 }); const fails: string[] = [];
    game.tune.devices = false; let peak = 0; steps(W, 3, () => { game.player.visibility = 1; peak = Math.max(peak, cam.seen); return false; });
    const yawMoved = Math.abs(cam.yaw - cam.def.yaw) > 0.01; if (peak > 0.02 || msgs.some(m => /CONTROL/.test(m.text))) fails.push(`devices off: peak ${f2(peak)}`); if (!yawMoved) fails.push('the pan stopped with the switch (it should only stop reporting)');
    game.tune.devices = true; game.quietUtility = true; steps(W, 3, () => { game.player.visibility = 1; peak = Math.max(peak, cam.seen); return false; });
    if (peak > 0.02 || msgs.some(m => /CONTROL/.test(m.text))) fails.push(`quietUtility: peak ${f2(peak)}`);
    game.quietUtility = false; const boxes = game.dynBoxes.length; if (boxes < 20) fails.push(`dynBoxes ${boxes}: devices not drawn?`);
    v(fails.length === 0, '(g) tune.devices off, then the tour\'s quietUtility: still drawn and panning, nothing integrates, control silent', `peak ${f2(peak)}, pan moved ${yawMoved}, dynBoxes ${boxes}`, fails);
  }
  // (h) re-arm: called in once, he steps out of the picture — the integrator drains at CAMERA_DECAY and after the quiet spell it will call him in afresh
  {
    const { W, game, msgs, cam } = await stage(808, { vis: 1 }); const fails: string[] = [];
    steps(W, DEV.DEVICE_TUNE_DEFAULTS.cameraSuspicionSecs / 0.9 * 1.8, () => { game.player.visibility = 1; return cam.state === 'suspect'; }); if (cam.state !== 'suspect') fails.push('staging: no first report');   // (time enough for the shipped lit-seconds at ~0.9/s)
    game.teleportPlayer([20, 0, 21]); game.player.visibility = 0.02;   // out of every picture, dark
    steps(W, 25); const drained = cam.seen === 0 && cam.state === 'idle';
    if (!drained) fails.push(`after 25 s away: seen ${f2(cam.seen)} state ${cam.state} (want drained, idle)`);
    game.teleportPlayer([30, 0, 11.1]); W.step(DT); const n0 = msgs.filter(m => /has movement/.test(m.text)).length;
    steps(W, DEV.DEVICE_TUNE_DEFAULTS.cameraSuspicionSecs / 0.9 * 1.8, () => { game.player.visibility = 1; return cam.state !== 'idle'; });
    if (msgs.filter(m => /has movement/.test(m.text)).length !== n0 + 1) fails.push('no second report after re-arming');
    v(fails.length === 0, '(h) re-arm: reported once, out of view the integrator drains and the camera goes back to idle; back in the light it calls him in again', `drained ${drained}, reports ${msgs.filter(m => /has movement/.test(m.text)).length}`, fails);
  }
  console.log(`=== devices-camera: ${done() ? 'ALL PASS' : 'FAILURES above'} ===`);
}

// ================================================================================================================================ keypad
export async function devicesKeypad() {
  console.log('\n=== devices-keypad: the side door on its pad — against Sam without the code, a thumb-turn from inside, staff walk it; the code off a questioned man / overheard within earshot (not through walls); keyed in, it swings and springs locked behind ===');
  const { v, done } = verdictFn('keypad');
  const IK = 'Space';
  // (a) rows and sides
  {
    const { W, game, msgs } = await world(821); const fails: string[] = [];
    const sd = game.doors.byName('server_manager'); const K = game.devices.padOf(sd);
    if (!K || sd.lockId !== 'pad_side' || !sd.locked || sd.keySide !== -1) fails.push(`level: pad ${K?.def.name} lockId ${sd.lockId} locked ${sd.locked} keySide ${sd.keySide}`);
    game.guards.forEach((o: any, i: number) => park(o, i));
    game.teleportPlayer([22.7, 0, 8.6]); game.player.crouch = false; W.cursorAt(sd.pos); W.step(DT); W.step(DT);
    const rows = game.nearby.map((r: any) => `${r.verb ?? '-'}${r.off ? '(off)' : ''}`).join(',');
    const marker = game.interactables.find((x: any) => x.door === sd);
    if (rows !== 'nocode(off),kick') fails.push(`office side, no code: rows [${rows}] (want nocode(off),kick — no pick, no rattle)`);
    if (!/keypad · locked/.test(marker?.line1 ?? '')) fails.push(`marker '${marker?.line1}'`);
    if (!game.doors.lockedOut(sd, game.player.char.pos, game.player.keys)) fails.push('lockedOut false from the office side');
    // the deny
    game.selectVerb('door', 'nocode'); W.input.pressed.add(IK); W.step(DT); W.step(DT);
    if (!msgs.some(m => /pad wants a code you don't have/.test(m.text)) || (W.audioCounts.get('deny') ?? 0) < 1) fails.push('the refusing pad: no word / no deny tone');
    if (!sd.latched || !sd.locked) fails.push('the deny opened something');
    // walking into it: a wall
    game.puppet = { goal: [21.0, 0, 8.6], aim: null }; steps(W, 3); game.puppet = null;
    if (game.player.char.pos[0] < 22.2) fails.push(`walked through a keypad door without the code (x ${f2(game.player.char.pos[0])})`);
    // from the server room side: a thumb-turn — push / ease rows, and it opens
    game.teleportPlayer([21.35, 0, 8.55]); W.cursorAt(sd.pos); W.step(DT); W.step(DT);
    const rowsIn = game.nearby.filter((r: any) => r.door === sd).map((r: any) => r.verb).join(',');
    if (!/push/.test(rowsIn) || game.doors.lockedOut(sd, game.player.char.pos)) fails.push(`server side: rows [${rowsIn}] lockedOut ${game.doors.lockedOut(sd, game.player.char.pos)} (want push/ease, false)`);
    // staff: a guard scripted from the office through it
    sd.reset(); const A = game.guards[0]; A.hold = false; A.heardUpTo = game.eventSeq; place(A, [23.2, 0, 8.6], -Math.PI / 2); A.script = { goal: [19.5, 0, 8.6], speed: 1.3, upper: 'relaxed' };
    game.teleportPlayer([8, 0, 20]); steps(W, 8);
    if (A.char.pos[0] > 21.0) fails.push(`the guard did not get through the keypad door (x ${f2(A.char.pos[0])}, leaf ${f2(sd.angle)})`);
    v(fails.length === 0, "(a) from the office without the code: 'keypad — no code' (a deny tone and a word) + the boot, no pick / rattle, and walking into it is a wall; from the server room it pushes open; a guard walks straight through it", `rows office [${rows}] · server side [${rowsIn}] · guard x ${f2(A.char.pos[0])}`, fails);
  }
  // (b) the code off a questioned man: Novak (nervy, the cubicles — no keyed door on his beat, so the pad is his first useful thing) in the arm, two taps
  {
    const { W, game, msgs } = await world(822); const fails: string[] = [];
    game.player.slot = 'pistol'; game.player.holstered = true;
    const B = game.guards[1]; game.guards.forEach((o: any, i: number) => { if (o !== B) park(o, i); });
    B.hold = false; place(B, [20, 0, 18.0], Math.PI / 2); B.wp = 2; B.heardUpTo = game.eventSeq;
    game.teleportPlayer([19.2, 0, 18.0]); game.player.crouch = true; W.step(DT); game.player.visibility = 0.02;
    if (D.temperamentOf(B) !== 'nervy') fails.push(`staging: ${B.callsign} is ${D.temperamentOf(B)}`);
    const ctx = D.gather(game, B); const codeItem = ctx.intel.find((i: any) => i.kind === 'code');
    if (!codeItem?.live || ctx.tokens.code !== '7391' || ctx.tokens.padDoor !== 'the office side door') fails.push(`gather: code live ${codeItem?.live} tokens ${ctx.tokens.code} / ${ctx.tokens.padDoor}`);
    startGrab(game, B); steps(W, 2, () => game.player.holding?.phase === 'held'); game.player.fHeld = false; W.step(DT);
    if (game.player.holding?.phase !== 'held') fails.push(`staging: hold ${game.player.holding?.phase}`);
    const answers: any[] = [];
    for (let k = 0; k < 3 && !game.player.codes.has('pad_side'); k++) {
      const st0 = B.talk.stage; W.input.pressed.add(IK); W.step(DT);
      steps(W, 4, () => B.talk.stage > st0); answers.push(B.talk.last);
      steps(W, 8, () => { const H = game.player.holding; return !!H && !H.after && heldTalk(game, H).settled; }); steps(W, 0.4);
    }
    const gave = answers.find(a => a?.kind === 'code');
    if (!gave) fails.push(`no 'code' answer in ${answers.length} (kinds ${answers.map(a => a?.kind ?? '·').join('/')})`);
    if (!game.player.codes.has('pad_side')) fails.push('Player.codes never got pad_side');
    if (!msgs.some(m => /gave up the side door code — 7-3-9-1/.test(m.text))) fails.push(`no 'gave up the side door code' line (${msgs.slice(-4).map(m => m.text).join(' | ')})`);
    if (!game.chronicle.events.some((e: any) => e.kind === 'codeLearned' && e.data.how === 'told')) fails.push('no codeLearned/told chronicle row');
    const again = D.gather(game, B).intel.find((i: any) => i.kind === 'code'); if (again?.live) fails.push("'code' still live after Sam has it (he would give it twice)");
    v(fails.length === 0, "(b) Novak in the arm: his useful thing is the pad ('…it's 7391…') and SAYING it teaches it — Player.codes has pad_side, the log line, the debrief row; not live twice", `answers ${answers.map(a => `${a?.kind ?? '·'}@${a?.stage}`).join(' ')} · "${gave ? B.bubble?.text ?? '' : ''}"`, fails);
  }
  // (c) overheard: the sticky-note pair between two calm men in the corridor — Sam crouched dark 5 m up the corridor learns it; Sam in the break room behind two shut doors does not
  for (const [label, samAt, want] of [['5 m up the same corridor', [16.5, 0, 11.3], true], ['in the break room, two shut doors and 15 m of wall away', [33.5, 0, 21.5], false]] as [string, Vec3, boolean][]) {
    const { W, game } = await world(823); const fails: string[] = [];
    const [A, B2, C] = game.guards; park(C, 2);
    for (const d of game.doors.list) if (/breakroom/.test(d.def.name)) { d.angle = 0; d.vel = 0; d.latched = true; d.closing = false; d.place(); }
    A.hold = false; B2.hold = false; place(A, [21.0, 0, 11.2], Math.PI / 2); place(B2, [23.5, 0, 11.3], -Math.PI / 2); A.wp = 3; B2.wp = 0; A.wait = 30; B2.wait = 30; A.heardUpTo = B2.heardUpTo = game.eventSeq;
    game.teleportPlayer(samAt); game.player.crouch = true; W.step(DT); game.player.visibility = 0.02; A.heardUpTo = B2.heardUpTo = game.eventSeq + 100;
    const S = D.ambientState(game); for (const p of D.AMBIENT_PAIRS) S.played.set(p.id, p.id === 'pin' ? 0 : 3); S.next = game.time + 0.1;
    let said = ''; const ok = steps(W, 20, () => { const r = S.run; if (r?.talk.id === 'pin' && r.i >= 1 && !said) said = (r.a.bubble?.text ?? ''); return game.player.codes.has('pad_side') || (!!S.run && S.run.talk.id === 'pin' && S.run.i >= 3); });
    steps(W, 1);
    const learned = game.player.codes.has('pad_side');
    if (!S.run && !said && !learned) fails.push(`staging: the pair never started 'pin' (run ${S.run?.talk.id ?? 'none'}, states ${A.state}/${B2.state}, dist ${f2(v3.distXZ(A.char.pos, B2.char.pos))})`);
    if (learned !== want) fails.push(`learned ${learned} (want ${want})`);
    if (want && !/7391/.test(said)) fails.push(`the opener's line "${said}" does not carry the digits`);
    if (want && !game.chronicle.events.some((e: any) => e.kind === 'codeLearned' && e.data.how === 'overheard')) fails.push('no codeLearned/overheard row');
    v(fails.length === 0, `(c) the pair say the digits out loud, Sam ${label}: ${want ? 'he has the code (the propagation carried it)' : 'nothing learned (it did not carry)'}`, `said "${said}" · learned ${learned} · finished ${ok}`, fails);
  }
  // (d) keying it in: the row, four keys over CODE_SECS, unlock + creak (nothing loud), it swings, through, and it latches LOCKED behind him; a step breaks it off midway
  {
    const { W, game, msgs } = await world(824); const fails: string[] = [];
    game.guards.forEach((o: any, i: number) => park(o, i));
    const sd = game.doors.byName('server_manager'); game.player.codes.add('pad_side');
    const ev: any[] = []; const orig = game.onDoorEvent.bind(game); game.onDoorEvent = (e: any) => { orig(e); ev.push({ sound: e.sound, level: e.level, t: game.time }); };
    game.teleportPlayer([22.7, 0, 8.7]); game.player.crouch = false; W.cursorAt(sd.pos); W.step(DT); W.step(DT);
    const rows = game.nearby.filter((r: any) => r.door === sd).map((r: any) => r.verb).join(',');
    if (rows !== 'code,kick') fails.push(`rows with the code [${rows}] (want code,kick)`);
    // a step breaks it off
    game.selectVerb('door', 'code'); W.input.pressed.add(IK); W.step(DT); steps(W, 0.4);
    if (!game.player.coding) fails.push('the tap did not start keying'); const running = game.nearby[0]; if (!running?.running || running.verb !== 'code') fails.push(`the running row is ${running?.verb}/${running?.running}`);
    W.input.keys.add('KeyS'); W.step(DT); W.step(DT); W.input.keys.delete('KeyS'); steps(W, 0.2);
    if (game.player.coding) fails.push('a step into it did not break it off'); if (!sd.latched) fails.push('breaking off opened it');
    // now for real
    game.teleportPlayer([22.7, 0, 8.7]); W.cursorAt(sd.pos); W.step(DT); W.step(DT); game.player.fHeld = false;
    const beeps0 = W.audioCounts.get('padBeep') ?? 0; const tTap = game.time;
    game.selectVerb('door', 'code'); W.input.pressed.add(IK); W.step(DT);
    let openAt = -1; steps(W, 3, () => { if (openAt < 0 && !sd.latched && Math.abs(sd.angle) > 0.25) openAt = game.time - tTap; return openAt >= 0; });
    const beeps = (W.audioCounts.get('padBeep') ?? 0) - beeps0, opens = W.audioCounts.get('padOpen') ?? 0;
    if (openAt < DEV.CODE_SECS - 0.05 || openAt > DEV.CODE_SECS + 0.5) fails.push(`opened at +${f2(openAt)} s (want ≈ ${DEV.CODE_SECS} + the swing)`);
    if (beeps !== 4 || opens !== 1) fails.push(`padBeep ×${beeps} padOpen ×${opens} (want 4 / 1)`);
    const loud = ev.filter(e => e.t >= tTap && e.level > 0.31); if (loud.length) fails.push(`door events louder than a creak: ${loud.map(e => `${e.sound} ${e.level}`).join(' ')}`);
    if (!ev.some(e => e.sound === 'unlock' && Math.abs(e.level - 0.12) < 1e-6)) fails.push('no key-level unlock clack');
    if (!sd.locked || sd.lockBroken) fails.push(`the lock changed: locked ${sd.locked} broken ${sd.lockBroken} (want merely opened)`);
    if (!msgs.some(m => /7-3-9-1 — the side door takes it/.test(m.text))) fails.push('no acceptance line');
    // through, and it springs locked behind
    game.puppet = { goal: [19.6, 0, 8.6], aim: null }; steps(W, 5); game.puppet = null;
    const through = game.player.char.pos[0] < 21.2; steps(W, 8, () => sd.latched);
    if (!through) fails.push(`never got through (x ${f2(game.player.char.pos[0])})`);
    if (!sd.latched || !game.doors.lockedOut(sd, [22.7, 0, 8.7])) fails.push(`behind him: latched ${sd.latched}, against the office side ${game.doors.lockedOut(sd, [22.7, 0, 8.7])} (want both)`);
    if (!game.chronicle.events.some((e: any) => e.kind === 'codeEntered')) fails.push('no codeEntered row');
    v(fails.length === 0, "(d) with the code: rows [code, kick]; a step breaks the keying off; keyed for real — four keys, the pad takes it at CODE_SECS, a key-level clack + the creak (nothing louder), it swings, he walks through, and it latches locked against the office again", `open +${f2(openAt)} s · beeps ${beeps} · through ${through} · relatched ${sd.latched}`, fails);
  }
  console.log(`=== devices-keypad: ${done() ? 'ALL PASS' : 'FAILURES above'} ===`);
}

// ================================================================================================================================ laser
export async function devicesLaser() {
  console.log('\n=== devices-laser: the corridor shin beam and the storage chest beam — walked, crouched, thrown through, a body hauled through; guards never; OCP / a round / the mains (battery survives); alarm beams ===');
  const { v, done } = verdictFn('laser');
  const walk = (game: any, W: any, from: Vec3, to: Vec3, crouch: boolean, secs = 5) => { game.teleportPlayer(from); game.player.crouch = crouch; steps(W, crouch ? 0.7 : 0.1); game.puppet = { goal: to, aim: null, crouch }; steps(W, secs, () => v3.distXZ(game.player.char.pos, to) < 0.3); game.puppet = null; };
  // (a) corridor shin beam: standing walk east through x 14.5 → a trip (chirp, radio, a man sent to the beam), then crouched → another (nobody gets under 35 cm); the drawn beam is cut while he stands in it
  {
    const { W, game, msgs } = await world(841); const fails: string[] = [];
    const L = game.devices.lasers[0]; if (Math.abs(L.def.from[1] - 0.35) > 1e-6 || L.def.mains === false) fails.push(`level: corridor beam y ${L.def.from[1]} mains ${L.def.mains}`);
    for (const o of game.guards) o.heardUpTo = 1e12;   // (deaf: his footsteps are not what this measures)
    walk(game, W, [13.0, 0, 11.1], [16.2, 0, 11.1], false);
    const sent = game.guards.find((g: any) => g.task?.kind === 'device');
    if (L.trips !== 1) fails.push(`standing walk: trips ${L.trips} (want 1)`);
    if (!msgs.some(m => /CONTROL — beam broken in the corridor/.test(m.text))) fails.push('no radio line'); if ((W.audioCounts.get('alarmChirp') ?? 0) < 1) fails.push('no chirp at the emitter');
    if (!sent || v3.distXZ(sent.task.pos, [14.5, 0, 11.1]) > 1.5) fails.push(`sent ${sent?.callsign ?? 'nobody'} to (${sent ? f2(sent.task.pos[0]) + ', ' + f2(sent.task.pos[2]) : '—'}) (want the beam's middle)`);
    if (!game.devices.log.some((r: any) => r.what === 'trip' && r.device === 'laser_corridor')) fails.push('no trip row in the devices log');   // (the debrief's chronicle row is written in live play only — mission.ts missionLive is down under the puppet that walks him here; (d) checks it without one)
    // cut short while standing in it
    game.teleportPlayer([14.5, 0, 11.1]); steps(W, 0.2); const cut = L.cut; if (!(cut < L.len - 0.3)) fails.push(`beam not cut by his shins standing in it (cut ${f2(cut)} of ${f2(L.len)})`);
    // crouched, after the cooldown (waited out AWAY from the beam): still trips
    game.teleportPlayer([13.0, 0, 11.4]); steps(W, 4.5); walk(game, W, [13.0, 0, 11.4], [16.2, 0, 11.4], true, 7);
    if (L.trips !== 2) fails.push(`crouched walk: trips ${L.trips} (want 2 — a shin beam is not ducked)`);
    v(fails.length === 0, '(a) the corridor beam at 0.35: walked through standing = a trip (chirp, "beam broken in the corridor — X, check it", the man sent to it, the debrief row), the picture of it cut at his shins; crouch-walked = a trip all the same', `trips ${L.trips}, sent ${sent?.callsign ?? '—'}, cut ${f2(cut)}/${f2(L.len)}`, fails);
  }
  // (b) guards walk their own beams: the corridor man's route crosses x 14.5 twice a lap — a minute of patrol, no trip
  {
    const { W, game, msgs } = await world(842); const fails: string[] = [];
    game.teleportPlayer([8, 0, 20]); const L = game.devices.lasers[0];
    let crossings = 0; let lastX = game.guards[0].char.pos[0];
    steps(W, 75, () => { const x = game.guards[0].char.pos[0]; if ((lastX - 14.5) * (x - 14.5) < 0 && Math.abs(game.guards[0].char.pos[2] - 11.2) < 1) crossings++; lastX = x; return false; });
    if (crossings < 1) fails.push(`staging: the corridor man crossed the beam ${crossings} times in 75 s`);
    if (L.trips || msgs.some(m => /beam broken/.test(m.text))) fails.push(`a guard tripped it (${L.trips})`);
    v(fails.length === 0, '(b) staff walk through their own beams: the corridor route crosses it, nothing', `crossings ${crossings}, trips ${L.trips}`, fails);
  }
  // (c) storage chest beam (1.25, battery): crouch-walked under from the door to the shelves = nothing; walked back standing = a trip
  {
    const { W, game } = await world(843); const fails: string[] = [];
    const L = game.devices.lasers[1]; game.guards.forEach((o: any, i: number) => park(o, i));
    if (Math.abs(L.def.from[1] - 1.25) > 1e-6 || L.def.mains !== false) fails.push(`level: storage beam y ${L.def.from[1]} mains ${L.def.mains}`);
    game.player.keys.add('floor');   // (the storage door is keyed against him: with the floor key his crouched contact pushes it open — the beam is the subject here, not the lock)
    walk(game, W, [32.6, 0, 11.2], [32.6, 0, 8.6], true, 9);   // from the corridor, on his knees, under the beam across the doorway's corridor face and through the door
    const under = L.trips; if (under !== 0) fails.push(`crouch-walked under: trips ${under}`);
    if (game.player.char.pos[2] > 9.0) fails.push(`staging: he never got in crouched (z ${f2(game.player.char.pos[2])}, leaf ${f2(game.doors.byName('storage').angle)})`);
    steps(W, 6, () => game.doors.byName('storage').latched);   // (let the closer take the leaf — swung out into the corridor by his push from inside it would cut the picture of the beam and shield him, which is true of any leaf and not what this measures)
    walk(game, W, [32.6, 0, 8.6], [32.6, 0, 11.2], false, 8);
    if (L.trips !== 1) fails.push(`walked standing: trips ${L.trips} (want 1)`);
    v(fails.length === 0, '(c) the storage beam at 1.25 (UPS) across the doorway: in on his knees under it, nothing; back out through it standing, a trip', `crouched ${under}, standing ${L.trips}, ended z ${f2(game.player.char.pos[2])}`, fails);
  }
  // (d) a canister thrown along the corridor through the shin beam trips it (its flight segment against the beam), Sam nowhere near
  {
    const { W, game, msgs } = await world(844); const fails: string[] = [];
    const L = game.devices.lasers[0]; game.guards.forEach((o: any, i: number) => park(o, i)); game.teleportPlayer([8, 0, 20]); steps(W, 0.1);
    game.items.spawn('smoke', [12.5, 0.4, 11.0], [7, 1.2, 0.05], { who: PLAYER_ID, fuse: 99 });   // a low fast lob east along the corridor at knee height
    steps(W, 2);
    if (L.trips !== 1) fails.push(`trips ${L.trips} (want 1)`); if (!game.chronicle.events.some((e: any) => e.kind === 'laserTripped' && e.data.by === 'smoke')) fails.push('no laserTripped/by smoke row');
    if (!msgs.some(m => /beam broken in the corridor/.test(m.text))) fails.push('no radio');
    v(fails.length === 0, '(d) a smoke canister lobbed along the corridor through the beam: a trip by the can (its flight against the beam), radio as ever', `trips ${L.trips}`, fails);
  }
  // (e) a body hauled through it: a dead man dragged by the ankles across the beam trips it (who = body)
  {
    const { W, game } = await world(845); const fails: string[] = [];
    const L = game.devices.lasers[0]; const [A, B, C] = game.guards; park(B, 1); park(C, 2);
    const { killGuard } = await import(`${ROOT}/src/game/combat.ts`);
    place(A, [13.75, 0, 11.1], -Math.PI / 2); killGuard(game, A, [-1, 0, 0], true); steps(W, 2.5);   // dropped just WEST of the beam, falling away from it
    for (const o of game.guards) o.heardUpTo = 1e12;
    game.teleportPlayer([14.95, 0, 11.1]); game.player.crouch = true; steps(W, 0.5);   // Sam crouched EAST of it, clear of it himself
    if (L.trips) fails.push(`staging: something broke the beam before the haul (trips ${L.trips}, body hips x ${f2((A.char.bones.hips ?? A.char.pos)[0])})`);
    game.toggleDrag(A); const got = game.player.dragging === A;
    if (!got) fails.push('staging: never got hold of the body');
    const whoBroke: string[] = []; const origTrip = L.lastTripAt;
    game.puppet = { goal: [17.0, 0, 11.1], aim: null, crouch: true };
    steps(W, 12, () => { if (L.lastTripAt !== origTrip && L.lastTripAt === game.time) { const hitBody = !!DEV.bodyBreaks(A.char, L.def.from, L.def.to), hitSam = !!DEV.bodyBreaks(game.player.char, L.def.from, L.def.to); whoBroke.push(hitSam ? 'player' : hitBody ? 'body' : '?'); } return whoBroke.includes('body') || game.player.char.pos[0] > 16.8; });
    // Sam backs through it first hauling the ankles (a trip of his own); the corpse follows a body-length behind — wait out the cooldown mid-beam if need be and it breaks it too
    if (!whoBroke.includes('body')) { steps(W, 5, () => { if (L.lastTripAt === game.time) whoBroke.push(DEV.bodyBreaks(A.char, L.def.from, L.def.to) ? 'body' : 'player'); return whoBroke.includes('body'); }); }
    game.puppet = null;
    if (!L.trips) fails.push('nothing tripped'); if (!whoBroke.includes('body')) fails.push(`the corpse never broke it (breaks: ${whoBroke.join(',') || 'none'}; body at x ${f2((A.char.bones.hips ?? A.char.pos)[0])})`);
    v(fails.length === 0, '(e) a body lying west of the corridor beam, Sam crouched east of it: hauled through by the ankles, the CORPSE breaks it (who = body)', `trips ${L.trips}, breaks ${whoBroke.join(',')}, got hold ${got}`, fails);
  }
  // (f) OCP → off for the spell (walk through: nothing), then back; a round → dead ('the corridor beam just went dark', a man sent), nothing trips it again; a restart mends it
  {
    const { W, game, msgs } = await world(846); const fails: string[] = [];
    const L = game.devices.lasers[0]; for (const o of game.guards) o.heardUpTo = 1e12;
    game.ocp(L.target); steps(W, 0.2); if (DEV.alive(L.target)) fails.push('OCP did not put it out');
    walk(game, W, [13.0, 0, 11.1], [16.2, 0, 11.1], false); if (L.trips) fails.push('tripped while OCP\'d');
    if (L.cut !== 0 && !DEV.alive(L.target)) { /* cut is 0 while dark: nothing drawn */ } if (game.dynBoxes.some((b: any) => Math.abs(b.c[0] - 14.5) < 0.01 && Math.abs(b.c[1] - 0.35) < 0.01 && b.h[2] > 0.5)) fails.push('the beam is still drawn while dark');
    steps(W, game.tune.ocpDuration + 1.5); if (!DEV.alive(L.target)) fails.push('not back after the OCP');
    walk(game, W, [13.0, 0, 11.1], [16.2, 0, 11.1], false); if (L.trips !== 1) fails.push(`back on: trips ${L.trips} (want 1)`);
    L.target.broken = true; steps(W, 0.1);
    const sent = game.guards.find((g: any) => g.task?.kind === 'device' && v3.distXZ(g.task.pos, L.def.from) < 2);
    if (!msgs.some(m => /the corridor beam just went dark/.test(m.text))) fails.push(`no 'went dark' line (${msgs.slice(-3).map(m => m.text).join(' | ')})`); if (!sent) fails.push('nobody sent to the dead emitter');
    steps(W, 4.5); walk(game, W, [13.0, 0, 11.1], [16.2, 0, 11.1], false); if (L.trips !== 1) fails.push('a dead beam tripped');
    game.restartEncounter(); steps(W, 0.1); if (!DEV.alive(L.target) || L.trips !== 0) fails.push('restart did not mend / reset it');
    v(fails.length === 0, "(f) OCP: dark for the spell (walked through, nothing; nothing drawn), back after; a round: 'the corridor beam just went dark' + a man to the emitter, dead for the encounter; the restart mends it", `trips ${L.trips}, sent ${sent?.callsign ?? '—'}`, fails);
  }
  // (g) an 'alarm' beam puts the floor up at once (the office authors none: flip the corridor beam's level for the test)
  {
    const { W, game, msgs } = await world(847); const fails: string[] = [];
    const L = game.devices.lasers[0]; L.def.alarm = 'alarm'; for (const o of game.guards) o.heardUpTo = 1e12; const esc0 = game.escalation;
    walk(game, W, [13.0, 0, 11.1], [16.2, 0, 11.1], false);
    if (game.escalation !== esc0 + 1) fails.push(`escalation ${esc0} → ${game.escalation}`); if (!msgs.some(m => /that's an intruder/.test(m.text))) fails.push('no alarm wording');
    if (!msgs.some(m => /copy, control — weapons out, everyone sharp/.test(m.text))) fails.push("the floor's spokesman never answered with the 'device' wording");
    v(fails.length === 0, "(g) a beam authored alarm: 'suspicion' → 'alarm': breaking it puts the floor up a step at once (raiseEscalation cause 'device'), everyone gets the fix", `esc ${esc0}→${game.escalation}`, fails);
  }
  console.log(`=== devices-laser: ${done() ? 'ALL PASS' : 'FAILURES above'} ===`);
}

// ================================================================================================================================ editor
export async function devicesEditor() {
  console.log('\n=== devices-editor: __ed.device add / move / rotate / aim / end / duplicate / delete + undo to the digest, validate + lint, planted lint faults ===');
  const { v, done } = verdictFn('editor');
  const { OFFICE_DATA } = await import(`${ROOT}/src/scene/level.ts`);
  const { Editor } = await import(`${ROOT}/src/editor/editor.ts`);
  const { makeApi } = await import(`${ROOT}/src/editor/api.ts`);
  const { Scene } = await import(`${ROOT}/src/editor/scene.ts`);
  const { View } = await import(`${ROOT}/src/editor/view.ts`);
  const { Tools } = await import(`${ROOT}/src/editor/tools.ts`);
  const { BoxWorld } = await import(`${ROOT}/src/scene/boxes.ts`);
  const { LightSet } = await import(`${ROOT}/src/render/lights.ts`);
  const { defaultSettings } = await import(`${ROOT}/src/engine.ts`);
  const { lintLevel } = await import(`${ROOT}/src/editor/lint.ts`);
  const { clonePlain } = await import(`${ROOT}/src/editor/doc.ts`);
  const officeAllow = JSON.parse(readFileSync(`${ROOT}/levels/office.lint.json`, 'utf8')).allow;
  const device = fake('device'); const engine: any = { device, world: new BoxWorld(device), lights: new LightSet(device), settings: defaultSettings() };
  const ed = new Editor(clonePlain(OFFICE_DATA), { lintAllow: officeAllow }); const scene = new Scene(engine, ed); const view = new View(); view.w = 1600; view.h = 1000; const tools = new Tools(ed, scene, view);
  const api: any = makeApi({ ed, tools, view, scene, step: () => { scene.sync(); } });
  const d0 = api.digest();
  {
    const fails: string[] = [];
    // camera
    const cid = api.device.add({ kind: 'camera', pos: [20, 0, 13.0], yaw: Math.PI, sweep: [Math.PI - 0.4, Math.PI + 0.4] });
    let c = api.device.get(cid); if (!c || c.kind !== 'camera' || Math.abs(c.pos[1] - 2.6) > 1e-6 || api.selection()[0] !== `device:${cid}`) fails.push(`camera add: ${JSON.stringify(c)}`);
    api.device.move(cid, [1, 0, 0.5]); c = api.device.get(cid); if (Math.abs(c.pos[0] - 21) > 1e-6 || Math.abs(c.pos[2] - 13.5) > 1e-6) fails.push(`move: ${c.pos}`);
    api.device.rotate(cid, Math.PI / 2); c = api.device.get(cid); if (Math.abs(c.yaw - Math.PI * 1.5) > 1e-5 || Math.abs(c.sweep[0] - (Math.PI * 1.5 - 0.4)) > 1e-5) fails.push(`rotate: yaw ${c.yaw} sweep ${c.sweep}`);
    api.device.aim(cid, [21, 0, 20]); c = api.device.get(cid); if (Math.abs(c.yaw - 0) > 1e-5 || !(c.pitch < 0) || Math.abs((c.sweep[0] + c.sweep[1]) / 2 - c.yaw) > 1e-5) fails.push(`aim south-and-down: yaw ${c.yaw} pitch ${c.pitch} sweep ${c.sweep}`);
    // laser
    const lid = api.device.add({ kind: 'laser', from: [18, 0, 13], to: [18, 0, 16], alarm: 'alarm', mains: false });
    let l = api.device.get(lid); if (!l || Math.abs(l.from[1] - 0.35) > 1e-6 || l.alarm !== 'alarm' || l.mains !== false) fails.push(`laser add: ${JSON.stringify(l)}`);
    api.device.end(lid, 1, [18, 0.35, 17]); l = api.device.get(lid); if (Math.abs(l.to[2] - 17) > 1e-6) fails.push('end move');
    api.device.rotate(lid, Math.PI / 2); l = api.device.get(lid); if (Math.abs(l.from[2] - l.to[2]) > 1e-5 || Math.abs(Math.abs(l.from[0] - l.to[0]) - 4) > 1e-5) fails.push(`laser rotate about its middle: ${l.from} → ${l.to}`);
    let threw = ''; try { api.device.add({ kind: 'laser', from: [1, 0, 1], to: [1, 0, 1] }); } catch (e: any) { threw = String(e.message); } if (!/coincide/.test(threw)) fails.push('a zero-length beam was accepted');
    // keypad: on the storage door → the door goes on the pad's lock; re-link to the manager door; delete → the door comes off it
    const kid = api.device.add({ kind: 'keypad', door: 'storage', code: '2468' });
    let k = api.device.get(kid); let sd = api.door.get('storage');
    if (!k || k.door !== 'storage' || sd.lock !== kid || !sd.locked || Math.abs(k.pos[1] - 1.4) > 1e-6) fails.push(`keypad add: ${JSON.stringify(k)} door ${JSON.stringify(sd)}`);
    if (api.validate().length) fails.push(`validate after adds: ${api.validate().slice(0, 2).join(' | ')}`);
    threw = ''; try { api.device.add({ kind: 'keypad', door: 'storage' }); } catch (e: any) { threw = String(e.message); } if (!/already has keypad/.test(threw)) fails.push('a second pad on one door was accepted');
    threw = ''; try { api.device.update(kid, { code: '12' }); } catch (e: any) { threw = String(e.message); } if (api.validate().length === 0 && api.device.get(kid).code === '12') fails.push('a two-digit code passed validate');
    if (api.device.get(kid).code === '12') api.undo();
    api.device.update(kid, { door: 'manager' }); k = api.device.get(kid); sd = api.door.get('storage'); const md = api.door.get('manager');
    if (k.door !== 'manager' || md.lock !== kid || sd.lock !== undefined) fails.push(`re-link: pad → ${k.door}, manager.lock ${md.lock}, storage.lock ${sd.lock}`);
    if (api.validate().length) fails.push(`validate after re-link: ${api.validate().slice(0, 2).join(' | ')}`);
    const dup = api.device.duplicate(cid); if (dup.length !== 1 || !api.device.get(dup[0])) fails.push('camera duplicate');
    const dupK = api.device.duplicate(kid); if (dupK.length) fails.push('a keypad duplicated (one pad per door)');
    api.device.delete(kid); if (api.device.get(kid) || api.door.get('manager').lock !== undefined) fails.push('keypad delete left the door on its lock');
    if (api.validate().length) fails.push(`validate after delete: ${api.validate().join(' | ')}`);
    const lint = api.lint(); if (lint.errors) fails.push(`lint errors after the edits: ${lint.lines.slice(1, 3).join(' | ')}`);
    scene.sync(); const picked = scene.refOfIndex(scene.devRanges.find((r: any) => r.id === cid)?.start ?? -1); if (picked !== `device:${cid}`) fails.push(`scene pick of the camera's stand-in → ${picked}`);
    // undo everything back to the original digest, redo to the end and undo again
    let n = 0; while (api.undo() && n < 200) n++; const back = api.digest() === d0;
    if (!back) fails.push(`after ${n} undos the digest is ${api.digest()} (want ${d0})`);
    v(fails.length === 0, '(a) camera add (2.6 m up) / move / rotate (sweep follows) / aim (yaw + pitch, sweep re-centred); laser add (0.35) / end / rotate about its middle / zero length refused; keypad add locks its door on the pad, a second pad refused, re-link moves the lock, delete takes the door off it, duplicate refused; validate + lint clean throughout; the stand-in picks as device:<id>; undo × N back to the original digest', `undos ${n}, digest back ${back}`, fails);
  }
  {
    const fails: string[] = []; const base = JSON.stringify(OFFICE_DATA);
    const plant = (name: string, mut: (d: any) => void, code: string) => { const d = JSON.parse(base); mut(d); const r = lintLevel(d, { allow: officeAllow }); const hit = r.findings.find((f: any) => f.code === code); if (!hit) fails.push(`${name}: no '${code}' finding (${r.findings.slice(0, 3).map((f: any) => f.code).join(',')})`); return hit?.message ?? ''; };
    const notes = [
      plant('camera inside the corridor wall', d => { d.devices.find((x: any) => x.id === 'cam_corridor').pos = [20, 1.5, 12.2]; }, 'camera-in-solid'),
      plant('laser receiver inside the south wall', d => { d.devices.find((x: any) => x.id === 'laser_corridor').to = [14.5, 0.35, 12.2]; }, 'laser-in-solid'),
      plant('a beam straight through the cubicle partition', d => { const l = d.devices.find((x: any) => x.id === 'laser_corridor'); l.from = [11.0, 0.35, 15.0]; l.to = [13.5, 0.35, 15.0]; }, 'laser-blocked'),
      plant('the pad moved into the lobby', d => { d.devices.find((x: any) => x.id === 'pad_side').pos = [8, 1.4, 18]; }, 'keypad-far'),
      plant('the pad on the server-room face', d => { d.devices.find((x: any) => x.id === 'pad_side').pos = [21.93, 1.4, 9.36]; }, 'keypad-side'),
      plant('no routes: nobody to give the code up', d => { d.routes = []; }, 'keypad-orphan'),
      plant('a waist beam nobody can duck', d => { const l = d.devices.find((x: any) => x.id === 'laser_storage'); l.from[1] = 0.9; l.to[1] = 0.9; }, 'laser-height'),
    ];
    const clean = lintLevel(JSON.parse(base), { allow: officeAllow });
    if (clean.errors || clean.warnings) fails.push(`the office itself: ${clean.errors} errors ${clean.warnings} warnings`);
    v(fails.length === 0, '(b) lint: the office clean; planted — a camera in a wall, a beam end in a wall, a beam through a partition, a pad far from its door, a pad on the always-open face, a pad no route can name, a beam at an in-between height — each reported under its code', notes.map(x => x.slice(0, 70)).join('\n    '), fails);
  }
  console.log(`=== devices-editor: ${done() ? 'ALL PASS' : 'FAILURES above'} ===`);
}

// ================================================================================================================================ vision digest
/** the digest recorded off MAIN (b737470, before this lane) with this very sweep: the eye factoring must leave every guard's sight what it was */
export const VISION_DIGEST_MAIN = 'd7745582';
export async function devicesVision() {
  console.log("\n=== devices-vision: canSee / canSeeChar / sightGain over 4000 seeded stagings — the guards' own sight byte for byte what it was before the eye was factored out for the cameras ===");
  const { v, done } = verdictFn('vision');
  Math.random = seeded(99);
  const W = await standUp(); const { game } = W;
  for (let i = 0; i < 3; i++) W.step(DT);
  game.aiEnabled = false;
  const rnd = seeded(7);
  let h = 0x811c9dc5 >>> 0; const mix = (x: number) => { const s = String(x); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } };
  let n = 0, vis = 0, cone = 0;
  const gd = game.guards[0], other = game.guards[1];
  for (const o of game.guards) o.hold = true;
  for (let k = 0; k < 4000; k++) {
    const gp: Vec3 = [4.5 + rnd() * 31, 0, 4.5 + rnd() * 19]; const yaw = rnd() * Math.PI * 2 - Math.PI;
    const sp: Vec3 = [gp[0] + (rnd() * 2 - 1) * 14, 0, gp[2] + (rnd() * 2 - 1) * 10];
    gd.char.pos = v3.copy(gp); gd.char.vel = [0, 0, 0]; gd.char.bodyYaw = gd.char.aimYaw = yaw; gd.char.aimPitch = 0; gd.char.update(0);
    gd.smokeTrans = rnd() < 0.2 ? rnd() : 1; gd.dazzledUntil = rnd() < 0.05 ? game.time + 1 : -1; gd.state = rnd() < 0.3 ? 'alert' : 'patrol';
    game.player.char.pos = v3.copy(sp); game.player.crouch = rnd() < 0.4; game.player.char.update(0); game.player.visibility = rnd();
    other.char.pos = [sp[0] + 0.7, 0, sp[2] + 0.4]; other.char.update(0);
    const r = canSee(game, gd); const r2 = canSeeChar(game, gd, other.char, false);
    mix(r.visible ? 1 : 0); mix(r.inCone ? 1 : 0); mix(r.dist); mix(r2.visible ? 1 : 0); mix(r2.inCone ? 1 : 0); mix(r2.dist);
    if (r.visible) { vis++; mix(sightGain(game, gd, r.dist)); } if (r.inCone) cone++;
    n++;
  }
  const digest = h.toString(16);
  v(digest === VISION_DIGEST_MAIN, `the sweep's digest equals main's (${VISION_DIGEST_MAIN})`, `digest ${digest} over ${n} stagings · visible ${vis} · in cone ${cone}`, digest === VISION_DIGEST_MAIN ? [] : [`digest ${digest} ≠ ${VISION_DIGEST_MAIN}: a guard's canSee / sightGain changed`]);
  console.log(`=== devices-vision: ${done() ? 'ALL PASS' : 'FAILURES above'} ===`);
}

export function devicesAllPass() { return allPassGlobal; }
