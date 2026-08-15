// Gait report: numbers for judging how NATURAL the locomotion looks, taken off the real Character stepped at a fixed dt while its root moves
// at a fixed ground speed exactly as player.ts / guards.ts drive it — no renderer, no browser.
//
//   bun run tools/qa/gait.ts                 → the whole report (clip natural speeds, then per state × speed: cadence, stride, foot slip, pelvis, trunk / gaze, jerk)
//   bun run tools/qa/gait.ts natural         → only the clips' natural ground speeds (what walkSpeed / jogSpeed / crouchSpeed / sprintSpeed should be)
//   bun run tools/qa/gait.ts states          → only the state table
//   bun run tools/qa/gait.ts --json          → machine-readable
//
// Definitions (all in metres / seconds / degrees, 120 Hz):
//   natural speed  the ground speed at which a loop's planted foot does not slide: the clip sampled in place at rate 1, the toe's ROOT-space
//                  backward velocity averaged over the frames it is on the floor (y < 2.2 cm) and travelling back — i.e. what the floor would have
//                  to do under him. Driving the character at that speed with the phase rate the animator derives from P.*Speed = natural gives zero slip.
//   slip           mean world-space speed of a planted toe (should be ~0); drift = the worst single plant's total travel; plants = how many were seen
//                  (a plant = the toe within 2.2 cm of the floor and travelling back in root space for ≥ 0.05 s — a run's whole stance is only ~0.1 s,
//                  so the old 0.12 s floor saw none and reported a vacuous 0.000 for every run row); stance = the share of the recorded time a foot
//                  is in such a plant, per foot (a walk ~45 %, a real run 25–35 %, the raw run clips ~7 %); reach = the longest hip→ankle seen (the
//                  leg is 0.83 m: at that the IK has clamped and the knee is locked straight)
//   cadence        steps per second (two per cycle); stride = ground covered per cycle
//   pelvis         mean hips height; bob = its peak-to-peak over the cycle
//   trunk / gaze   forward pitch of hips→neck, and of the head's rest gaze direction (0 = the standing idle's level look); gazeBob = peak-to-peak
//   jerk           95th percentile of the per-frame second difference of hand / head position (mm at 120 Hz) — pops and hitches show up here
const ROOT = new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
const { loadCharacter } = await import(`${ROOT}/tools/qa/headless.ts`);
const CH = await import(`${ROOT}/src/game/character.ts`);
const { Pose, PoseFK, sampleClip, restPose } = await import(`${ROOT}/src/anim/skeleton.ts`);
const { v3, quat } = await import(`${ROOT}/src/math/vec.ts`);
const ch: any = await loadCharacter();
const args = process.argv.slice(2); const want = args.find(a => !a.startsWith('--')) ?? 'all'; const asJson = args.includes('--json');
const DT = 1 / 120, R2D = 180 / Math.PI;
const P = { ...CH.defaultAnimParams };

const headI = ch.nodeByName.get('DEF-head');
const gazeLocal = (() => { const p = restPose(ch, new Pose(ch.nodes.length)); sampleClip(ch.clips.get('Idle_Loop'), 0, false, p); const fk = new PoseFK(ch).run(p); return quat.rotate(quat.conj(fk.rot[headI]), [0, 0, 1]); })();
const pct = (a: number[], q: number) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—'), f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—'), f3 = (x: number) => (Number.isFinite(x) ? x.toFixed(3) : '—');

// ---------------------------------------------------------------- natural clip speeds (clip sampled in place, root fixed)
function naturalSpeed(clipName: string): { speed: number; period: number; plantedFrac: number } {
  const clip = ch.clips.get(clipName); if (!clip) return { speed: NaN, period: NaN, plantedFrac: NaN };
  const pose = new Pose(ch.nodes.length); const fk = new PoseFK(ch);
  const toeL = ch.nodeByName.get('DEF-toe.L'), toeR = ch.nodeByName.get('DEF-toe.R');
  const T = clip.duration; const N = Math.max(2, Math.round(T / DT));
  // two passes: the toes' lowest height over the cycle sets the 'on the floor' threshold per clip (a run's toe never sinks to the walk's rest height),
  // then the backward root-space velocity while on the floor; the MEDIAN of those (mid-stance, not the flick at push-off) is the floor's speed under him
  const ys: number[][] = [[], []], zs: number[][] = [[], []];
  for (let i = 0; i <= N; i++) {
    restPose(ch, pose); sampleClip(clip, (i / N) * T, true, pose); fk.run(pose);
    ys[0].push(fk.pos[toeL][1]); ys[1].push(fk.pos[toeR][1]); zs[0].push(fk.pos[toeL][2]); zs[1].push(fk.pos[toeR][2]);
  }
  const vs: number[] = []; let planted = 0;
  for (let k = 0; k < 2; k++) {
    const y0 = Math.min(...ys[k]) + 0.02;
    for (let i = 1; i <= N; i++) { const vz = (zs[k][i] - zs[k][i - 1]) / (T / N); if (ys[k][i] < y0 && vz < -0.05) { vs.push(-vz); planted++; } }
  }
  return { speed: vs.length ? pct(vs, 0.5) : NaN, period: T, plantedFrac: planted / (2 * N) };
}

// ---------------------------------------------------------------- a driven run: state × ground speed
interface Run { name: string; speed: number; crouch: number; upper?: string; deliberate?: number }
function measure(r: Run) {
  const c = new CH.Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [0, 0, 0], yaw: 0 });
  const an: any = c.anim; an.phase = 0; an.speed = r.speed; an.crouchTarget = r.crouch; an.upper = r.upper ?? 'relaxed'; if ('deliberate' in an) an.deliberate = r.deliberate ?? 0;
  const adv = () => { c.pos = [0, 0, c.pos[2] + r.speed * DT]; c.update(DT); };
  for (let i = 0; i < Math.round(2.5 / DT); i++) adv();
  const rows: any[] = []; let prev = an.phase, wraps = 0; const wrapT: number[] = []; const maxT = r.speed > 0.05 ? 30 : 4;
  for (let i = 0; i * DT < maxT && wraps < 4; i++) {
    adv(); const phz = an.phase; if (phz - prev < -0.5) { wraps++; wrapT.push(i * DT); } prev = phz;
    if (wraps < 1 && r.speed > 0.05) continue;
    const b: any = c.bones; const g = quat.rotate(c.skel.globalRot[headI], gazeLocal); const d = v3.sub(b.neck, b.hips);
    rows.push({ t: i * DT, root: c.pos[2], toeL: [...b.toeL], toeR: [...b.toeR], hips: [...b.hips], head: [...b.head], handL: [...b.handL], handR: [...b.handR],
      gaze: Math.asin(Math.max(-1, Math.min(1, g[1]))) * R2D, gazeYaw: Math.atan2(g[0], g[2]) * R2D, torso: Math.atan2(d[2], d[1]) * R2D,
      reach: Math.max(v3.dist(b.thighL, b.footL), v3.dist(b.thighR, b.footR)) });
  }
  const period = wrapT.length >= 2 ? (wrapT[wrapT.length - 1] - wrapT[0]) / (wrapT.length - 1) : NaN;
  // plants: toe on the floor and travelling back in root space, runs ≥ 0.05 s (a run's stance is ~0.1 s; walks' plants are 0.3 s+ and read the same either way)
  let slipNum = 0, slipDen = 0, maxDrift = 0, plants = 0;
  for (const key of ['toeL', 'toeR']) {
    let s = -1;
    for (let i = 0; i <= rows.length; i++) {
      const on = i < rows.length && i > 0 && rows[i][key][1] < 0.022 && ((rows[i][key][2] - rows[i].root) - (rows[i - 1][key][2] - rows[i - 1].root)) < -1e-5;
      if (on && s < 0) s = i;
      if (!on && s >= 0) { const dur = (i - s) * DT; if (dur >= 0.05 - 1e-9) { const dz = rows[i - 1][key][2] - rows[s][key][2]; slipNum += Math.abs(dz); slipDen += dur; maxDrift = Math.max(maxDrift, Math.abs(dz)); plants++; } s = -1; }
    }
  }
  const jerk = (key: string) => { const a: number[] = []; for (let i = 2; i < rows.length; i++) { const p0 = rows[i - 2][key], p1 = rows[i - 1][key], p2 = rows[i][key]; a.push(1000 * Math.hypot(p2[0] - 2 * p1[0] + p0[0], p2[1] - 2 * p1[1] + p0[1], (p2[2] - rows[i].root) - 2 * (p1[2] - rows[i - 1].root) + (p0[2] - rows[i - 2].root))); } return pct(a, 0.95); };
  const hipsY = rows.map(x => x.hips[1]), gaze = rows.map(x => x.gaze), gy = rows.map(x => x.gazeYaw);
  return {
    name: r.name, speed: r.speed, period, cadence: Number.isFinite(period) ? 2 / period : 0, stride: Number.isFinite(period) ? r.speed * period : 0,
    slip: slipDen ? slipNum / slipDen : 0, drift: maxDrift, plants, stance: rows.length ? slipDen / (2 * rows.length * DT) : 0,
    pelvis: mean(hipsY), bob: hipsY.length ? Math.max(...hipsY) - Math.min(...hipsY) : 0,
    torso: mean(rows.map(x => x.torso)), gaze: mean(gaze), gazeBob: gaze.length ? Math.max(...gaze) - Math.min(...gaze) : 0, gazeYawBob: gy.length ? Math.max(...gy) - Math.min(...gy) : 0,
    jerkHand: Math.max(jerk('handL'), jerk('handR')), jerkHead: jerk('head'), reach: rows.length ? Math.max(...rows.map(x => x.reach)) : 0,
  };
}

const out: any = {};
if (want === 'all' || want === 'natural') {
  const clips = ['Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Fwd_Loop'];
  const nat = clips.map(n => ({ clip: n, ...naturalSpeed(n) }));
  out.natural = nat; out.params = P;
  if (!asJson) {
    console.log('\n=== natural ground speed per loop (planted-toe backward velocity, clip in place at rate 1) vs the animator\'s P.*Speed ===');
    const pmap: Record<string, number> = { Walk_Loop: P.walkSpeed, Jog_Fwd_Loop: P.jogSpeed, Sprint_Loop: P.sprintSpeed, Crouch_Fwd_Loop: P.crouchSpeed };
    for (const r of nat) console.log(`  ${r.clip.padEnd(16)} natural ${f2(r.speed)} m/s · period ${f2(r.period)} s · stride ${f2(r.speed * r.period)} m · planted ${f1(100 * r.plantedFrac)} % of frames   | param ${f2(pmap[r.clip])} → drive at param = ${f1(100 * (pmap[r.clip] / r.speed - 1))} % skate`);
  }
}
if (want === 'all' || want === 'states') {
  const runs: Run[] = [
    { name: 'walk 0.8', speed: 0.8, crouch: 0 }, { name: 'walk 1.2', speed: 1.2, crouch: 0 }, { name: 'walk 1.55 (playerWalk)', speed: 1.55, crouch: 0 },
    { name: 'jog 2.4', speed: 2.4, crouch: 0 }, { name: 'jog 3.3', speed: 3.3, crouch: 0 }, { name: 'sprint 4.7', speed: 4.7, crouch: 0 },
    { name: 'crouch 0.6', speed: 0.6, crouch: 1 }, { name: 'crouch 1.0', speed: 1.0, crouch: 1 }, { name: 'crouch 1.3 (playerCrouch)', speed: 1.3, crouch: 1 },
    { name: 'crouch 1.0 deliberate', speed: 1.0, crouch: 1, deliberate: 1 },
    { name: 'guard walk 1.15', speed: 1.15, crouch: 0, upper: 'none' }, { name: 'guard investigate 1.75', speed: 1.75, crouch: 0, upper: 'none' }, { name: 'guard chase 2.7', speed: 2.7, crouch: 0, upper: 'aim' },
    { name: 'idle', speed: 0, crouch: 0 }, { name: 'crouch idle', speed: 0, crouch: 1 },
  ];
  const res = runs.map(measure); out.states = res;
  if (!asJson) {
    console.log('\n=== per state × ground speed (driven like the game drives it) ===');
    console.log('  state                        period  cad/s  stride  slip m/s  drift m  plants  stance%  pelvis  bob cm  trunk°  gaze°  gazeBob°  gYawBob°  jerkHand  jerkHead  reach m   (jerk: mm @120Hz, p95)');
    for (const r of res) console.log(`  ${r.name.padEnd(28)} ${f2(r.period).padStart(6)}  ${f2(r.cadence).padStart(5)}  ${f2(r.stride).padStart(6)}  ${f3(r.slip).padStart(8)}  ${f3(r.drift).padStart(7)}  ${String(r.plants).padStart(6)}  ${f1(100 * r.stance).padStart(7)}  ${f2(r.pelvis).padStart(6)}  ${f1(100 * r.bob).padStart(6)}  ${f1(r.torso).padStart(6)}  ${f1(r.gaze).padStart(5)}  ${f1(r.gazeBob).padStart(8)}  ${f1(r.gazeYawBob).padStart(8)}  ${f1(r.jerkHand).padStart(8)}  ${f1(r.jerkHead).padStart(8)}  ${f2(r.reach).padStart(7)}`);
  }
}
// ---------------------------------------------------------------- transitions: start / stop / turn on the spot (the life layer + the shuffle)
function transitions() {
  const mk = () => { const c = new CH.Character(ch, { id: 1, tint: [0, 0, 0], tint2: [0, 0, 0], pos: [0, 0, 0], yaw: 0 }); const an: any = c.anim; an.phase = 0; an.upper = 'relaxed'; an.crouchTarget = 0; return { c, an }; };
  const res: any = {};
  { // start then stop: 1 s still, ramp to 1.55 m/s the way player.ts does (damp rate 6), hold 2 s, release (vel decays exp(-14 dt), speed follows), 2 s still.
    // What is wanted is the LIFE layer's mass spring — the pelvis hanging back into the start, carrying on and dipping at the stop — but the walk clip itself
    // carries the pelvis ~3.7 cm further forward (and a little lower) than the idle it blends from, which swamps a 2–3 cm spring: measured against the idle's
    // own offset the start read 'hangs back 0.0 cm' whether the spring worked or not (review #20). So the ramp runs twice over the same frames, LIFE as authored
    // and LIFE.on = 0 (the layer's identity: no mass spring, no tip, no breathing), and lag / carry / dip / settle are the on − off DIFFERENCE — the layer's own
    // contribution, which a zeroed massGain duly reads as 0.0. The clip's pose offset is reported beside it, and the sole slide after the stop off the live run.
    const ramp = (lifeOn: number) => {
      const keep = CH.LIFE.on; CH.LIFE.on = lifeOn;
      try {
        const { c, an } = mk(); let v = 0, target = 0, z = 0; const rows: any[] = [];
        for (let i = 0; i * DT < 6.5; i++) {
          const t = i * DT; target = t < 1 ? 0 : t < 3.2 ? 1.55 : 0;
          v = target > v ? v + (target - v) * (1 - Math.exp(-6 * DT)) : v * Math.exp(-14 * DT); an.speed = v; z += v * DT; c.pos = [0, 0, z]; c.update(DT);
          const b: any = c.bones; rows.push({ t, v, hipsRel: b.hips[2] - z, hipsY: b.hips[1], toeL: [...b.toeL], toeR: [...b.toeR] });
        }
        return rows;
      } finally { CH.LIFE.on = keep; }
    };
    const on = ramp(CH.LIFE.on), off = ramp(0);
    const idx = (t0: number, t1: number) => on.map((r: any, i: number) => i).filter((i: number) => on[i].t >= t0 && on[i].t < t1);
    const dz = (i: number) => on[i].hipsRel - off[i].hipsRel, dy = (i: number) => on[i].hipsY - off[i].hipsY;
    const startLag = Math.min(...idx(1.0, 1.8).map(dz));            // most the pelvis hangs BACK of the life-less pose while accelerating (m, negative)
    const stopCarry = Math.max(...idx(3.2, 4.0).map(dz));           // most it carries FORWARD of it on the stop
    const stopDip = Math.min(...idx(3.2, 4.0).map(dy));             // and dips below it
    let settle = NaN; for (const i of idx(3.4, 6.5)) { if (Math.abs(dz(i)) < 0.004) { settle = on[i].t - 3.2; break; } }
    const at = (rows: any[], t: number) => rows[Math.round(t / DT)];
    const poseFwd = at(off, 3.0).hipsRel - at(off, 0.9).hipsRel, poseDrop = at(off, 0.9).hipsY - at(off, 3.0).hipsY;   // the walk clip's own pelvis offset against the idle's (why the raw reading was vacuous)
    // sole slide after the stop: toes' world travel from 0.6 s after release to the end (should be ~0: standing) — off the live (LIFE on) run
    const a = at(on, 3.9), bnd = on[on.length - 1]; const slide = Math.max(Math.hypot(bnd.toeL[0] - a.toeL[0], bnd.toeL[2] - a.toeL[2]), Math.hypot(bnd.toeR[0] - a.toeR[0], bnd.toeR[2] - a.toeR[2]));
    res.startStop = { startLag, stopCarry, stopDip, settle, slideAfter: slide, poseFwd, poseDrop };
  }
  { // turn on the spot: still, then the body yaw swings 180° at 3 rad/s (as approachAngle does it), then still — do the feet re-plant (lift) or skate round?
    const { c, an } = mk(); an.speed = 0; const rows: any[] = [];
    for (let i = 0; i * DT < 4; i++) {
      const t = i * DT; if (t > 1 && c.bodyYaw < Math.PI - 1e-3) c.bodyYaw = Math.min(Math.PI, c.bodyYaw + 3 * DT);
      c.pos = [0, 0, 0]; c.update(DT); const b: any = c.bones; rows.push({ t, yaw: c.bodyYaw, toeL: [...b.toeL], toeR: [...b.toeR], shuffle: an.feet?.w ?? 0 });
    }
    let lifts = 0, maxLift = 0, skate = 0; for (let i = 1; i < rows.length; i++) { for (const k of ['toeL', 'toeR']) { const y = rows[i][k][1]; maxLift = Math.max(maxLift, y); if (rows[i - 1][k][1] < 0.03 && y >= 0.03) lifts++; if (y < 0.025) skate += Math.hypot(rows[i][k][0] - rows[i - 1][k][0], rows[i][k][2] - rows[i - 1][k][2]); } }
    res.turn = { lifts, maxLift, soleTravelOnFloor: skate, peakShuffle: Math.max(...rows.map(r => r.shuffle)) };   // (peakShuffle: the foot lock's weight)
  }
  { // lunge with speed 0 (the takedown / grab reach: player.ts lerps pos half a metre at rate 14 with anim.speed = 0): worst hip→ankle stretch and how far a foot trails the root
    const { c, an } = mk(); an.speed = 0; let worstReach = 0, worstTrail = 0, restTrail = 0;
    for (let i = 0; i * DT < 3.2; i++) {
      const t = i * DT; if (t > 2) { const goal = 0.5; c.pos = [0, 0, c.pos[2] + (goal - c.pos[2]) * (1 - Math.exp(-14 * DT))]; }
      c.update(DT); const b: any = c.bones; const trail = c.pos[2] - Math.min(b.footL[2], b.footR[2]);
      if (t <= 2) restTrail = trail; else { for (const [f, th] of [[b.footL, b.thighL], [b.footR, b.thighR]]) worstReach = Math.max(worstReach, v3.dist(f, th)); worstTrail = Math.max(worstTrail, trail); }
    }
    res.lunge = { worstReach, worstTrail, restTrail };
  }
  { // one-shots over planted feet (review #18): standing 2 s (feet locked), the body turned 22° in place — under FEET.turnDeg, so no re-step: the soles stay put and
    // LAG the body, as after any mouse turn — then an upper-body one-shot fires (Hit_Chest via hit()/flinch(), Punch_Cross via strike(), the procedural throw). Those
    // pose nothing below the hips, so a planted sole must not move: worst horizontal travel of either toe from where it stood when the one-shot fired, over the
    // next 1.5 s, and its worst per-frame speed. The kick is the control: it has the legs, the lock is released for it by design (reported, not judged).
    const oneShot = (fire: (an: any) => void) => {
      const { c, an } = mk(); an.speed = 0;
      for (let i = 0; i * DT < 2; i++) { c.pos = [0, 0, 0]; c.update(DT); }
      const yaw1 = 22 * Math.PI / 180; for (let i = 0; i * DT < 0.6; i++) { c.bodyYaw = Math.min(yaw1, c.bodyYaw + 3 * DT); c.pos = [0, 0, 0]; c.update(DT); }   // 22° at 3 rad/s, then settle
      const b0: any = c.bones; const t0 = { L: [...b0.toeL], R: [...b0.toeR] }; let prev = { L: [...b0.toeL], R: [...b0.toeR] };
      fire(an);
      let travel = 0, speed = 0;
      for (let i = 0; i * DT < 1.5; i++) {
        c.pos = [0, 0, 0]; c.update(DT); const b: any = c.bones;
        for (const k of ['L', 'R'] as const) { const p = k === 'L' ? b.toeL : b.toeR; travel = Math.max(travel, Math.hypot(p[0] - t0[k][0], p[2] - t0[k][2])); speed = Math.max(speed, Math.hypot(p[0] - prev[k][0], p[2] - prev[k][2]) / DT); prev[k] = [...p]; }
      }
      return { travel, speed };
    };
    res.oneShot = { hit: oneShot(an => an.hit()), strike: oneShot(an => an.strike()), throw: oneShot(an => an.throwItem()), kick: oneShot(an => an.kickDoor()), none: oneShot(() => {}) };
  }
  { // a 6 m teleport from standing + update(0) (teleportPlayer): does any foot start from the old room?
    const { c, an } = mk(); an.speed = 0; for (let i = 0; i * DT < 2; i++) c.update(DT);
    c.pos = [6, 0, 2]; c.update(0); let worst = 0;
    for (let i = 0; i < 40; i++) { c.update(DT); const b: any = c.bones; worst = Math.max(worst, Math.hypot(b.footL[0] - c.pos[0], b.footL[2] - c.pos[2]), Math.hypot(b.footR[0] - c.pos[0], b.footR[2] - c.pos[2])); }
    res.teleport = { worstFootFromRoot: worst };
  }
  { // a mouse-flick turn: 180° at 9 rad/s standing — worst planted-foot yaw lag behind the pelvis
    const { c, an } = mk(); an.speed = 0; for (let i = 0; i * DT < 2; i++) c.update(DT);
    let worstLag = 0; const fy = (r: number[]) => { const f = quat.rotate(r as any, [0, 1, 0]); return Math.atan2(f[0], f[2]); };
    for (let i = 0; i * DT < 1.5; i++) { if (c.bodyYaw < Math.PI - 1e-3) c.bodyYaw = Math.min(Math.PI, c.bodyYaw + 9 * DT); c.update(DT); const rots: any = (c as any).skel?.globalRot; if (rots) { const nL = ch.nodeByName.get('DEF-foot.L'), nR = ch.nodeByName.get('DEF-foot.R'); for (const n of [nL, nR]) { const lag = Math.abs(((c.bodyYaw + fy(rots[n]) - c.bodyYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI); worstLag = Math.max(worstLag, Math.abs(((fy(rots[n]) ) + Math.PI * 3) % (2 * Math.PI) - Math.PI)); } } }
    res.flick = { worstFootYawOffModelFwdDeg: worstLag * R2D };
  }
  { // the jog → sprint hand-off: 2.5 s settled at 2.5 m/s, then the ground speed rises linearly to 4.7 over 1 s (about what player.ts's damp does on Shift) and
    // holds 1 s. Worst per-frame second difference — a pop — of the pelvis and of either ankle, root-relative (mm at 120 Hz), over the ramp + hold, against the
    // same statistic holding a steady 4.7 the whole time (the sprint cycle's own worst corner: the library keys are linear, so it is not small)
    const run = (v0: number, v1: number) => {
      const { c, an } = mk(); let z = 0; const rows: any[] = [];
      for (let i = 0; i * DT < 4.5; i++) {
        const t = i * DT; const v = t < 2.5 ? v0 : t < 3.5 ? v0 + (v1 - v0) * (t - 2.5) : v1;
        an.speed = v; z += v * DT; c.pos = [0, 0, z]; c.update(DT);
        if (t >= 2.4) { const b: any = c.bones; rows.push({ ph: an.phase, hips: [b.hips[0], b.hips[1], b.hips[2] - z], footL: [b.footL[0], b.footL[1], b.footL[2] - z], footR: [b.footR[0], b.footR[1], b.footR[2] - z] }); }
      }
      const d2 = (key: string) => { let worst = 0, at = NaN; for (let i = 2; i < rows.length; i++) { const p0 = rows[i - 2][key], p1 = rows[i - 1][key], p2 = rows[i][key]; const d = Math.hypot(p2[0] - 2 * p1[0] + p0[0], p2[1] - 2 * p1[1] + p0[1], p2[2] - 2 * p1[2] + p0[2]); if (d > worst) { worst = d; at = rows[i - 1].ph; } } return { worst: 1000 * worst, at }; };
      const h = d2('hips'), l = d2('footL'), r = d2('footR');
      return { hips: h.worst, hipsAt: h.at, foot: Math.max(l.worst, r.worst) };
    };
    const ramp = run(2.5, 4.7), steady = run(4.7, 4.7);
    res.sprintRamp = { worstHips: ramp.hips, worstFoot: ramp.foot, steadyHips: steady.hips, steadyFoot: steady.foot };
    // the run cycle's loop seam: holding a steady 3.0 m/s (all jog, its stride warp full on) and a steady 2.5 (the walk still has a sixth of the pose), the
    // worst per-frame pop of the pelvis and of either ankle and the phase it happens at — Jog_Fwd_Loop's last key does not meet its first (23 mm at the hips,
    // 1–3° at the legs), which read as a hitch once a cycle at phase 0 until the sampling spread the mismatch round the loop
    const s30 = run(3.0, 3.0), s25 = run(2.5, 2.5);
    res.seam = { hips30: s30.hips, hipsAt30: s30.hipsAt, foot30: s30.foot, hips25: s25.hips, hipsAt25: s25.hipsAt, foot25: s25.foot };
  }
  return res;
}
if (want === 'all' || want === 'transitions') {
  const tr = transitions(); out.transitions = tr;
  if (!asJson) {
    console.log('\n=== transitions ===');
    const s = tr.startStop; console.log(`  start → 1.55 → stop, the life layer's share (LIFE on − off, same frames): pelvis hangs back ${f1(-s.startLag * 100)} cm on the start · carries ${f1(s.stopCarry * 100)} cm forward and dips ${f1(-s.stopDip * 100)} cm on the stop · back within 4 mm of the life-less pose ${f2(s.settle)} s after release · soles then slide ${f1(s.slideAfter * 100)} cm   (the walk clip itself carries the pelvis ${f1(s.poseFwd * 100)} cm ahead of and ${s.poseDrop >= 0 ? f1(s.poseDrop * 100) + ' cm below' : f1(-s.poseDrop * 100) + ' cm above'} the idle's — not the spring's doing, and why the raw offset used to read 0.0)`);
    const t = tr.turn; console.log(`  180° on the spot at 3 rad/s: ${t.lifts} foot lifts (peak ${f1(t.maxLift * 100)} cm), soles travel ${f2(t.soleTravelOnFloor)} m along the floor while down · foot-lock weight ${f2(t.peakShuffle)}`);
    console.log(`  lunge 0.5 m at rate 14 with speed 0 (takedown / grab reach): rear foot trails the root ${f2(tr.lunge.worstTrail)} m at worst vs ${f2(tr.lunge.restTrail)} m in the stance at rest (+${f1((tr.lunge.worstTrail - tr.lunge.restTrail) * 100)} cm); hip→ankle ${f2(tr.lunge.worstReach)} m (rest ≈ 0.82)`);
    const os = tr.oneShot; const osf = (k: string) => `${k} ${f1(os[k].travel * 1000)} mm (${f2(os[k].speed)} m/s)`;
    console.log(`  one-shot over planted, 22°-lagging feet — worst toe travel along the floor over 1.5 s (per-frame peak speed): ${['hit', 'strike', 'throw'].map(osf).join(' · ')} — want < 5 mm each | control: ${osf('none')} · ${osf('kick')} (the kick has the legs: released by design)`);
    console.log(`  6 m teleport from standing: worst foot-from-root over the next 40 frames ${f2(tr.teleport.worstFootFromRoot)} m (≈ 0.2 = under him)`);
    console.log(`  180° flick at 9 rad/s standing: worst foot yaw off the body's forward ${f1(tr.flick.worstFootYawOffModelFwdDeg)}°`);
    const sr = tr.sprintRamp; console.log(`  2.5 → 4.7 m/s over 1 s (jog → sprint hand-off): worst per-frame pop pelvis ${f1(sr.worstHips)} mm · ankle ${f1(sr.worstFoot)} mm   | holding a steady 4.7: pelvis ${f1(sr.steadyHips)} · ankle ${f1(sr.steadyFoot)} (the cycle's own worst corner)`);
    const sm = tr.seam; console.log(`  run loop seam, steady 3.0 m/s: worst per-frame pop pelvis ${f1(sm.hips30)} mm (at phase ${f2(sm.hipsAt30)}) · ankle ${f1(sm.foot30)} mm   | steady 2.5: pelvis ${f1(sm.hips25)} mm (at phase ${f2(sm.hipsAt25)}) · ankle ${f1(sm.foot25)} mm`);
  }
}
if (asJson) console.log(JSON.stringify(out));
