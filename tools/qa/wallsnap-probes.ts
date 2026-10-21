// The 'wallsnap' family (through probes.ts: `bun run tools/qa/probes.ts wallsnap`, or this file directly) — the wall hold's feel pass (src/game/wallsnap.ts,
// WALLSNAP.on; the harness's frozen stand holds it OFF, these turn it on):
//   wallsnap-take     the take runs its own clock (0.12‥0.30 s by distance and turn), moves on the frame of the key, the turn ahead of the glide, back and
//                     station arriving together; the feet stay planted in the world and step (they do not slide); nothing of him through the plaster
//   wallsnap-landing  the pelvis dips as the back lands and comes back; one scuff for the player's ears; NO step / noise event filed for the take
//   wallsnap-reach    walking AT a wall takes it from further off than standing does; walking PAST one does not; Q a moment early still takes it
//   wallsnap-off      Q with nothing held leaves him within a hand of where he stood; a direction held walks on at pace that frame; the stick held away
//                     lets go in a tenth of a second (a diagonal sidles; with alongDeg 0 it lets go in under a fifth, as it did); the pose is gone in ten frames; the pistol is back in the hand
//   wallsnap-stack    Q with the rifle in the hands keeps it there: 'stack' stance, low ready, facing along the wall, nothing through the plaster; walks
//                     along it; a click with a clear line fires that frame and shoulders the rifle; a click through the wall fires nothing
//   wallsnap-duo      two person stealth, the partner following: the take, the sidle back at him, off and on, the rifle stack and its step-out — the hold
//                     is never shoved or dropped, his order stays 'fall in', he is never inside Sam nor ahead of his muzzle
//   wallsnap-cover    parked at an open end, the cursor on a point the corner hides steps him out past the end with the rifle up, and back when it returns;
//                     no flutter with the cursor held on the threshold; a reload brings him in; E on the stack slings it and the hold becomes the back hold
//   wallsnap-camera   the camera turned any way (24 yaws × 8 key combinations): a stick within 55° of the wall's line sidles him and never drops him; only
//                     square-out lets go; into the wall does nothing. WALLSNAP_BREAK=1 = the rule before it (must fail)
//   wallsnap-kit      2 (or E with the rifle selected) on the back hold brings the rifle up into the stack without leaving the wall; another item chosen on the
//                     stack is the back hold again and says it waits for the step off; Q leaves with what he chose
//   wallsnap-off-same with the switch OFF nothing of the hold carries a feel-pass field and the take is the old fixed 0.22 s glide
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { WALLSNAP, wsTakeSecs } = await import(`${ROOT}/src/game/wallsnap.ts`);
const { AIM } = await import(`${ROOT}/src/game/aim.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60, DEG = Math.PI / 180, wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const f2 = (x: number) => x.toFixed(2), f3 = (x: number) => x.toFixed(3);
let allPass = true;
const verdict = (ok: boolean, label: string, detail: string) => { allPass &&= ok; console.log(`- ${ok ? 'PASS' : 'FAIL'} — ${label}\n    ${detail}`); };

// the corridor's north wall between two doorways: plane z = 10.06, n (0, 0, 1), along (−1, 0, 0); the run x ∈ [18.2, 25], open at both ends. Station z 10.51.
const WALL = { z: 10.06, station: 10.51, xLo: 18.2, xHi: 25 };
const BONES = ['hips', 'spine2', 'chest', 'neck', 'head', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'toeL', 'toeR'];

export async function world(on: boolean, seed = 95) {
  Math.random = mulberry32(seed);
  const W: any = await standUp(); const g = W.game, input = W.input;
  WALLSNAP.on = on; AIM.player.level = on ? 1 : 0;   // (with the switch on the gun is carried LEVEL along the cursor's heading, as the page ships it; off = the frozen stand as every older probe has it)
  g.playerInvisible = true; g.godMode = true; g.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); });
  const pl = g.player, c = pl.char;
  let cursor: Vec3 | null = null;
  const step = (n = 1, each?: (f: number) => void) => { for (let f = 0; f < n; f++) { if (cursor) W.cursorAt(cursor); W.step(DT); each?.(f); } };
  const keys = (...ks: string[]) => { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) input.keys.delete(k); for (const k of ks) input.keys.add(k); };
  const tap = (k: string) => input.pressed.add(k);
  const click = () => { input.clicked |= 1; };
  /** stand him at (x, z) facing yawDeg with the pistol / the rifle / nothing in the hand, settled */
  const place = (x: number, z: number, yawDeg: number, kit: 'pistol' | 'rifle' | 'empty' = 'empty') => {
    keys(); g.teleportPlayer([x, 0, z]); c.bodyYaw = c.aimYaw = yawDeg * DEG;
    pl.slot = kit === 'rifle' ? 'rifle' : 'pistol'; pl.holstered = kit === 'empty'; pl.equipT = 0; pl.crouch = false;
    pl.rifle.cancelReload?.(); cursor = [x + Math.sin(yawDeg * DEG) * 4, 1.2, z + Math.cos(yawDeg * DEG) * 4];
    step(40);
  };
  const off = (p: Vec3) => p[2] - WALL.z;   // metres into the corridor off the north wall's plane
  const minBone = () => { let m = Infinity, name = ''; for (const k of BONES) { const o = off(c.bones[k]); if (o < m) { m = o; name = k; } } return { m, name }; };
  return { W, g, input, pl, c, step, keys, tap, click, place, off, minBone, setCursor: (p: Vec3 | null) => { cursor = p; } };
}

async function take() {
  console.log('\n=== wallsnap-take ===');
  const S = await world(true); const { pl, c, g } = S;
  // (start z, start yaw°): 0° faces +z = away from the north wall (back already to it), 180° = nose to it
  const cases: [number, number][] = [[10.6, 0], [10.8, 90], [11.0, 180], [11.15, 200], [10.9, -60]];
  const fails: string[] = []; const rows: string[] = []; let through = Infinity, throughAt = '';
  let slid = 0, lift = 0, pop = 0, popAt = '';
  for (const [z, yaw] of cases) {
    S.place(21, z, yaw);
    const p0 = v3.copy(c.pos), y0 = c.bodyYaw; const feet0 = { L: v3.copy(c.bones.footL), R: v3.copy(c.bones.footR) };
    let fp = { L: v3.copy(c.bones.footL), R: v3.copy(c.bones.footR) };
    S.tap('KeyQ'); let frames = 0, first = 0, yawMid = 0, posMid = 0, firstMoveL = -1, firstMoveR = -1, prev = c.pos[2], back = false; const T = { t: 0 };
    for (let f = 0; f < 40; f++) {
      S.step(1); const w = pl.wall; if (!w) { fails.push(`from z ${z} yaw ${yaw}: no hold`); break; }
      if (f === 0) { T.t = w.takeT; first = Math.abs(c.pos[2] - p0[2]); }
      if (c.pos[2] > prev + 1e-6) back = true; prev = c.pos[2];
      const dist = Math.abs(p0[2] - WALL.station) || 1, done = 1 - Math.abs(c.pos[2] - WALL.station) / dist, turn = Math.abs(w.yawD) > 1e-3 ? wrapA(c.bodyYaw - y0) / w.yawD : 1;
      if (w.settle < 1 && Math.abs(w.settle - 0.5) < 0.5 * DT / T.t + 1e-9) { yawMid = turn; posMid = done; }
      const mb = S.minBone(); if (mb.m < through) { through = mb.m; throughAt = `${mb.name} from z ${z} yaw ${yaw} f${f}`; }
      const mL = v3.distXZ(c.bones.footL, feet0.L), mR = v3.distXZ(c.bones.footR, feet0.R);
      if (f === 0) slid = Math.max(slid, mL, mR);
      if (firstMoveL < 0 && mL > 0.03) firstMoveL = w.settle; if (firstMoveR < 0 && mR > 0.03) firstMoveR = w.settle;
      if (w.settle < 1) lift = Math.max(lift, c.bones.footL[1] - feet0.L[1], c.bones.footR[1] - feet0.R[1]);
      if (frames && f >= frames && f < frames + 10) { const j = Math.max(v3.dist(c.bones.footL, fp.L), v3.dist(c.bones.footR, fp.R)); if (j > pop) { pop = j; popAt = `z ${z} yaw ${yaw}, ${f - frames + 1} f after it landed`; } }
      fp = { L: v3.copy(c.bones.footL), R: v3.copy(c.bones.footR) };
      if (w.settle >= 1 && !frames) {
        frames = f + 1;
        const offS = Math.abs(c.pos[2] - WALL.station), yawErr = Math.abs(wrapA(c.bodyYaw - 0)) / DEG;
        if (offS > 0.005) fails.push(`from z ${z} yaw ${yaw}: ${f3(offS)} m off the station when the take ended`);
        if (yawErr > 1) fails.push(`from z ${z} yaw ${yaw}: back ${yawErr.toFixed(1)}° off square when the take ended`);
      }
    }
    if (!pl.wall) continue;
    const want = wsTakeSecs(Math.abs(p0[2] - WALL.station), pl.wall.yawD);
    const k = WALLSNAP.slow ? Math.max(0.25, WALLSNAP.slowTake) : 1;   // (the unhurried take: the same clock, times as long)
    if (Math.abs(T.t - want) > 1e-9 || T.t < 0.12 * k - 1e-9 || T.t > 0.30 * k + 1e-9) fails.push(`from z ${z} yaw ${yaw}: take clock ${f3(T.t)} s (want ${f3(want)}, within ${f2(0.12 * k)}‥${f2(0.30 * k)})`);
    if (Math.abs(frames - Math.ceil(T.t / DT - 1e-6)) > 1) fails.push(`from z ${z} yaw ${yaw}: landed after ${frames} frames, the clock is ${f3(T.t)} s`);
    const dist = Math.abs(p0[2] - WALL.station);
    if (dist > 0.05 && first < 0.1 / k * dist) fails.push(`from z ${z} yaw ${yaw}: ${f3(first)} m on the key's frame of ${f2(dist)} (want ≥ ${(10 / k).toFixed(0)} %: it must move at once)`);
    if (dist > 0.05 && Math.abs(pl.wall.yawD) > 0.3 && yawMid < posMid + 0.03) fails.push(`from z ${z} yaw ${yaw}: at half time the turn is ${f2(yawMid)} done, the glide ${f2(posMid)} (the turn must lead)`);
    if (back) fails.push(`from z ${z} yaw ${yaw}: he moved back out from the wall during the take`);
    if (dist > 0.2 && Math.max(firstMoveL < 0 ? 9 : firstMoveL, firstMoveR < 0 ? 9 : firstMoveR) < 0.15) fails.push(`from z ${z} yaw ${yaw}: both feet had left their spots by ${f2(Math.max(firstMoveL, firstMoveR))} of the take (one goes at once, the other stays planted until its turn)`);
    rows.push(`z ${z} yaw ${yaw}°: ${f3(T.t)} s / ${frames} f, ${f3(first)} m on frame 1, half-time turn ${f2(yawMid)} vs glide ${f2(posMid)}, feet first move at ${f2(firstMoveL)} / ${f2(firstMoveR)}`);
    S.tap('KeyQ'); S.step(30);
  }
  if (through < -0.02) fails.push(`a joint ${f3(-through)} m THROUGH the wall plane during a take (${throughAt})`);
  if (slid > 0.08) fails.push(`a foot jumped ${f3(slid)} m on the first frame of a take (a step starts from where the sole stood)`);
  if (lift < 0.03) fails.push(`the feet never left the floor during a take (highest ${f3(lift)} m): they must step, not slide`);
  if (pop > 0.03) fails.push(`a foot jumped ${f3(pop)} m in one frame after a take landed (${popAt}): the soles stay where they stepped to`);
  verdict(fails.length === 0, 'the take: one eased clock, the turn leading, the feet stepping', fails.length ? fails.join('\n    ') : rows.join('\n    ') + `\n    lowest joint ${f3(through)} m off the plane (${throughAt}); feet moved at most ${f3(slid)} m on the first frame, lifted ${f3(lift)} m, and moved at most ${f3(pop)} m a frame once landed`);
}

async function landing() {
  console.log('\n=== wallsnap-landing ===');
  const S = await world(true); const { pl, c, g, W } = S; const fails: string[] = [];
  S.place(21, 11.0, 180, 'pistol');
  W.audioLog = []; const ev0 = g.events.length; const noise0 = pl.noise;
  S.tap('KeyQ'); let landed = -1, dipMin = Infinity; const hips: number[] = [];
  S.step(70, f => { hips.push(c.bones.hips[1]); if (landed < 0 && pl.wall && pl.wall.settle >= 1) landed = f; });
  const rest = hips[hips.length - 1];
  for (let f = landed; f < landed + 10; f++) dipMin = Math.min(dipMin, hips[f]);
  const dip = rest - dipMin, back = Math.abs(hips[landed + 30] - rest);
  if (!(dip >= 0.02 && dip <= 0.06)) fails.push(`the pelvis dipped ${f3(dip)} m in the sixth of a second after the back landed (want 0.02‥0.06)`);
  if (back > 0.006) fails.push(`still ${f3(back)} m off its rest height half a second after landing`);
  const lands = WALLSNAP.voice ? 'wallOn' : 'footSoft';   // (heard: the wall's own sound stands in for the scuff, never beside it)
  const scuffs = (W.audioLog as any[]).filter(a => a.name === lands).length, both = WALLSNAP.voice ? (W.audioLog as any[]).filter(a => a.name === 'footSoft').length : 0;
  if (scuffs !== 1) fails.push(`${scuffs} scuffs played for one take (want exactly 1)`);
  if (both) fails.push(`${both} old scuff(s) played beside the wall's own sound`);
  const steps = g.events.slice(ev0).filter((e: any) => e.kind === 'step' || e.kind === 'prop' || e.kind === 'shot');
  if (steps.length) fails.push(`${steps.length} hearing event(s) filed by the take (${steps.map((e: any) => e.kind).join(', ')}): it must be silent to everybody but the player`);
  if (pl.noise > noise0 + 1e-6) fails.push(`the take raised his noise meter (${f3(noise0)} → ${f3(pl.noise)})`);
  if (!pl.holstered) fails.push('the pistol is still in his hand on the wall (the back hold puts it away)');
  verdict(fails.length === 0, 'the landing: a settle, one scuff for the player, silent to the floor', fails.length ? fails.join('\n    ') : `landed frame ${landed}; pelvis dipped ${f3(dip)} m, ${f3(back)} m off rest 0.5 s on; scuffs ${scuffs}; hearing events 0; noise meter unchanged`);
  W.audioLog = null;
}

async function reach() {
  console.log('\n=== wallsnap-reach ===');
  const fails: string[] = []; const rows: string[] = [];
  // The cubicles' north wall (the corridor's south wall seen from the south): plane z 12.26, the run x ∈ [9, 15], an aisle of open floor behind him at x 10.5 —
  // the corridor itself is 2.08 m wide, so there a wall is always in reach BEHIND him and takes the key. W = −z with the camera at yaw 0.
  const RW = { z: 12.26, x: 10.5 };
  const onRW = (w: any) => !!w && w.n[2] > 0.9 && Math.abs(w.d - RW.z) < 0.02;
  const walkAt = async (on: boolean, gap: number, lead = 0, reachM?: number) => {
    const S = await world(on); const { pl, c } = S; if (reachM !== undefined) WALLSNAP.reachMoving = reachM;
    S.place(RW.x, RW.z + 0.42 + 2.4, 180); S.keys('KeyW');
    let pressed = false, took = -1;
    for (let f = 0; f < 200 && took < 0; f++) {
      if (!pressed && c.pos[2] - RW.z - 0.42 <= gap + lead * 1.55) { S.tap('KeyQ'); pressed = true; var at = c.pos[2] - RW.z - 0.42, f0 = f; }
      S.step(1); if (pressed && pl.wall) took = f - f0!;
      if (pressed && f - f0! > 30) break;
    }
    const right = !pl.wall || onRW(pl.wall);
    for (let f = 0; f < 20; f++) S.step(1);
    return { took, at: at!, right, msg: S.g.messages.map((m: any) => m.text).join(' | ') };
  };
  const R0 = WALLSNAP.reachMoving; const a = await walkAt(true, 1.0), b = await walkAt(false, 1.0), d = await walkAt(true, 0.6);
  if (a.took !== 0) fails.push(`switch on, walking at the wall, Q ${f2(a.at)} m off it: ${a.took < 0 ? 'no hold' : `held ${a.took} frames late`}`);
  if (b.took === 0) fails.push(`switch OFF, Q ${f2(b.at)} m off the wall took it (the old reach is 0.7 m)`);
  if (d.took !== 0) fails.push(`switch on, Q ${f2(d.at)} m off the wall: no hold`);
  if (!a.right || !b.right || !d.right) fails.push('(staging) a hold was taken on some other wall');
  rows.push(`walking at it: on takes it from ${f2(a.at)} m off, off does not (${b.took < 0 ? 'no hold' : 'late'})`);
  // standing still at 1.0 m: not taken (the longer reach is for a wall he is walking at)
  { const S = await world(true); S.place(RW.x, RW.z + 0.42 + 1.0, 180); S.setCursor([RW.x, 1.2, 9]); S.tap('KeyQ'); S.step(12); if (onRW(S.pl.wall)) fails.push('standing still a metre off the wall, Q took it (the longer reach is only for a wall he walks at)'); else rows.push('standing a metre off: not taken'); }
  // walking PAST it, parallel, 0.9 m off: not taken
  { const S = await world(true); S.place(RW.x + 0.6, RW.z + 0.42 + 0.9, 270); S.keys('KeyA'); S.step(30); const vx = S.c.vel[0]; S.tap('KeyQ'); S.step(12);
    if (Math.abs(vx) < 0.8) fails.push(`(staging) he was not walking along the wall (vx ${f2(vx)})`);
    if (onRW(S.pl.wall)) fails.push('walking past the wall 0.9 m off, Q took it'); else rows.push('walking past it 0.9 m off: not taken'); }
  // Q a moment early (0.1 s before the face is in reach) still takes it; half a second early does not
  const e1 = await walkAt(true, R0, 0.1), e2 = await walkAt(true, R0, 0.5);
  if (!(e1.took > 0 && e1.took <= 10)) fails.push(`Q 0.1 s early (${f2(e1.at)} m off): ${e1.took < 0 ? 'never taken' : `taken after ${e1.took} frames`} (want within the 0.15 s buffer)`);
  if (e2.took >= 0) fails.push(`Q half a second early (${f2(e2.at)} m off) was still honoured ${e2.took} frames later`);
  else if (!/nothing to put your back to/.test(e2.msg)) fails.push(`Q half a second early: no 'nothing to put your back to here' line once the buffer ran out (${e2.msg})`);
  rows.push(`Q early: 0.1 s → taken ${e1.took} frames later; 0.5 s → not taken, the line said`);
  // Q with no face in reach, then a beat that takes the frame inside the buffer (a takedown; a man in his arm, walked up to the wall and let go): the key was
  // for the moment before it — when the beat ends there is no late hold and no late 'nothing to put your back to here'
  { const { startTakedown, startGrab, freeHeld } = await import(`${ROOT}/src/game/player.ts`);
    const stage = async (gz: number) => { const S = await world(true); const { pl, g, c } = S; S.place(RW.x, RW.z + 0.42 + 2.0, 180); S.keys('KeyW'); S.step(8); S.tap('KeyQ'); S.step(2);
      const gd = g.guards[0]; gd.char.pos = [c.pos[0], 0, c.pos[2] + gz]; gd.char.bodyYaw = Math.PI; gd.char.update(0); return { S, pl, g, c, gd, m0: g.messages.length as number, early: !!pl.wall }; };
    const late = (g: any, m0: number) => g.messages.slice(m0).map((m: any) => m.text as string).filter((t: string) => /put your back to|get to the wall/.test(t));
    { const { S, pl, g, gd, m0, early } = await stage(-0.8); startTakedown(g, gd); const began = !!pl.takedown; S.keys(); let over = -1, took = false;
      for (let f = 0; f < 90; f++) { S.step(1); if (over < 0 && !pl.takedown) over = f; if (pl.wall) took = true; }
      if (early || !began || over < 9) fails.push(`(staging) Q then a takedown: ${early ? 'the wall was taken at the key' : !began ? 'no takedown began' : `the takedown was over in ${over} frames, inside the buffer`}`);
      else if (took || late(g, m0).length) fails.push(`Q, then a takedown inside the buffer: ${took ? 'he took a wall' : `'${late(g, m0)[0]}' was said`} once the beat was over (${over} frames on: the buffer's clock stood still through it)`);
      else rows.push(`Q then a takedown (${over} frames): no late hold, no late line`); }
    { const { S, pl, g, c, gd, m0, early } = await stage(-0.7); startGrab(g, gd); const began = !!pl.holding; S.keys('KeyW'); let f = 0; for (; f < 400 && c.pos[2] - RW.z > 0.75; f++) S.step(1);
      S.keys(); S.step(20); const zOff = c.pos[2] - RW.z; if (pl.holding) freeHeld(g, 'cancel'); let took = false; for (let k = 0; k < 40; k++) { S.step(1); if (pl.wall) took = true; }
      if (early || !began || zOff > 0.75) fails.push(`(staging) Q then a man in his arm: ${early ? 'the wall was taken at the key' : !began ? 'no hold began' : `the pair stopped ${f2(zOff)} m off the wall`}`);
      else if (took || late(g, m0).length) fails.push(`Q, then a man taken in his arm inside the buffer, walked to ${f2(zOff)} m off the wall and let go ${f + 20} frames on: ${took ? 'he snapped to the wall' : `'${late(g, m0)[0]}' was said`} on the stale key`);
      else rows.push(`Q then a man in his arm, let go ${f2(zOff)} m off the wall ${f + 20} frames on: no late hold, no late line`); } }
  verdict(fails.length === 0, 'reach: further for a wall he walks at, and Q a moment early', fails.length ? fails.join('\n    ') : rows.join('\n    '));
}

async function offIt() {
  console.log('\n=== wallsnap-off ===');
  const S = await world(true); const { pl, c } = S; const fails: string[] = []; const rows: string[] = [];
  let nHold = 0; const hold = (kit: 'pistol' | 'empty' = 'pistol') => { nHold++; S.place(21, 10.9, 180, kit); S.tap('KeyQ'); S.step(50); if (!pl.wall) fails.push(`(staging) hold ${nHold} was not taken`); return !!pl.wall; };
  const stW = () => (c.anim as any).st.w.x as number;
  const wOut = WALLSNAP.slow ? 0.45 : 0.2;   // (the unhurried way out leaves at slowOut, not outRate: 0.41 of the pose is left ten frames on, where the quick way leaves 0.09. Later than that the pistol's own lowered carry has him, so the bar stays at frame ten)
  // Q, nothing held
  if (hold()) {
    const p0 = v3.copy(c.pos); S.tap('KeyQ'); let w9 = 1; S.step(40, f => { if (f === 9) w9 = c.anim.stance === 'none' ? stW() : 0; });   // (a stance another rule put him in meanwhile — the pistol lowered at the wall he turned to — is that rule's weight, not the wall pose's)
    const d = v3.distXZ(c.pos, p0), dz = c.pos[2] - p0[2];
    if (pl.wall) fails.push('Q did not let go');
    if (!(d >= 0.02 && d <= 0.07 && dz > 0)) fails.push(`Q with nothing held moved him ${f3(d)} m (want 0.02‥0.07 off the plaster: he chose that shadow)`);
    if (w9 > wOut) fails.push(`the pose still at ${f2(w9)} ten frames after Q (want < ${wOut})`);
    if (pl.holstered) fails.push('the pistol he had when he took the wall is not back in his hand');
    if (c.anim.stanceOut !== 0) fails.push(`the quick way out is still armed (${c.anim.stanceOut}/s) once the pose has gone: the next stance he leaves would snap off`);
    rows.push(`Q, nothing held: ${f3(d)} m off the plaster, pose ${f2(w9)} at frame 10, pistol back in hand`);
  }
  // Q with a direction held along the wall: walking that frame
  if (hold()) { S.keys('KeyD'); S.step(30); const v = Math.abs(pl.wall.v); S.tap('KeyQ'); S.step(1); const sp = Math.hypot(c.vel[0], c.vel[2]);
    if (pl.wall) fails.push('Q while sidling did not let go'); if (sp < Math.min(1.2, v - 0.05)) fails.push(`Q while sidling at ${f2(v)} m/s left him at ${f2(sp)} m/s (the momentum is kept)`);
    rows.push(`Q while sidling at ${f2(v)} m/s: ${f2(sp)} m/s the frame he lets go`); }
  // the stick square away
  if (hold()) { S.keys('KeyS'); let at = -1, sp = 0; S.step(30, f => { if (at < 0 && !pl.wall) { at = f; sp = Math.hypot(c.vel[0], c.vel[2]); } });
    if (at < 5 || at > 7) fails.push(`walking square away let go after ${at} frames (want 6 ± 1: a tenth of a second)`);
    if (sp < 1.2) fails.push(`…at ${f2(sp)} m/s (want ≥ 1.2: walking from the first frame)`);
    rows.push(`stick square away: off at frame ${at}, ${f2(sp)} m/s that frame`); }
  // a diagonal: a sidle, and it stays one (WALLSNAP.alongDeg: half the stick along the wall is a man moving along it) — with the rule off, the older answer: off in 0.18 s
  if (hold()) { const x0 = c.pos[0]; S.keys('KeyS', 'KeyD'); S.step(60);
    if (!pl.wall) fails.push('a diagonal (half along, half away) let go of the wall: it sidles'); else if (Math.abs(c.pos[0] - x0) < 0.8) fails.push(`a diagonal held a second moved him ${f2(Math.abs(c.pos[0] - x0))} m along (want ≥ 0.8)`);
    rows.push(`diagonal: still on the wall after a second, ${f2(Math.abs(c.pos[0] - x0))} m along it`); }
  if (hold()) { const was = WALLSNAP.alongDeg; WALLSNAP.alongDeg = 0; S.keys('KeyS', 'KeyD'); let at = -1; S.step(30, f => { if (at < 0 && !pl.wall) at = f; }); WALLSNAP.alongDeg = was;
    if (at < 9 || at > 12) fails.push(`alongDeg 0, a diagonal away let go after ${at} frames (want 10‥12: 0.18 s, the rule as it was)`); rows.push(`alongDeg 0 (as it was), diagonal away: off at frame ${at}`); }
  // into the wall: nothing
  if (hold()) { S.keys('KeyW'); S.step(40); if (!pl.wall) fails.push('pushing INTO the wall let go of it'); if (Math.abs(c.pos[2] - WALL.station) > 0.005) fails.push('pushing into the wall moved him'); }
  // breaking into a run
  if (hold()) { S.keys('KeyS', 'ShiftLeft'); S.step(1); const sp = Math.hypot(c.vel[0], c.vel[2]); if (pl.wall) fails.push('Shift + a direction did not let go'); if (sp < 1.2) fails.push(`breaking into a run started at ${f2(sp)} m/s`); rows.push(`Shift + away: off that frame at ${f2(sp)} m/s`); }
  S.keys();
  verdict(fails.length === 0, 'the way off keeps his momentum; Q alone leaves him where he chose to stand', fails.length ? fails.join('\n    ') : rows.join('\n    '));
}

async function stack() {
  console.log('\n=== wallsnap-stack ===');
  const S = await world(true); const { pl, c, g } = S; const fails: string[] = []; const rows: string[] = [];
  S.place(21.5, 10.9, 270, 'rifle');   // facing −x = along the wall toward its hi end (x 18.2)
  if (!pl.rifleUp) fails.push('(staging) the rifle is not in his hands');
  S.setCursor([15, 1.2, 10.9]); S.step(20);
  S.tap('KeyQ'); let through = Infinity, tb = ''; S.step(60, () => { const mb = S.minBone(); if (mb.m < through) { through = mb.m; tb = mb.name; } });
  const w = pl.wall;
  if (!w) { verdict(false, 'the stack', 'Q with the rifle up took no hold'); return; }
  if (w.kind !== 'stack') fails.push(`the hold is '${w.kind}', not a stack`);
  if (!pl.rifleUp || pl.holstered) fails.push('the rifle was slung for the wall (the stack keeps it in his hands)');
  if (c.anim.stance !== 'stack') fails.push(`the animator's stance is '${c.anim.stance}'`);
  if (c.anim.longStance !== 'lowLong') fails.push(`the rifle's carriage is '${c.anim.longStance}' (want the low ready)`);
  const along = Math.atan2(w.n[0], w.n[2]) - w.side * Math.PI / 2, yawErr = Math.abs(wrapA(c.bodyYaw - along)) / DEG;
  if (yawErr > 3) fails.push(`he faces ${yawErr.toFixed(1)}° off the wall's line`);
  if (w.side !== 1) fails.push(`he faces the lo end (side ${w.side}); he was facing the hi end when he took it`);
  if (Math.abs(c.pos[2] - WALL.station) > 0.005) fails.push(`${f3(Math.abs(c.pos[2] - WALL.station))} m off the station`);
  if (through < -0.02) fails.push(`${tb} ${f3(-through)} m through the plaster`);
  const muz = S.off(c.muzzle); if (muz < 0.02) fails.push(`the muzzle is ${f3(muz)} m off the plane (in the wall)`);
  const sh = Math.min(S.off(c.bones.upperArmL), S.off(c.bones.upperArmR)); if (sh > 0.25) fails.push(`the wall-side shoulder is ${f2(sh)} m off the plaster (want ≤ 0.25: shoulder TO the wall)`);
  rows.push(`taken: stance stack · carriage lowLong · ${yawErr.toFixed(1)}° off the wall's line · lowest joint ${f3(through)} m (${tb}) · muzzle ${f2(muz)} m · wall-side shoulder ${f2(sh)} m off the plaster`);
  // walks along it the way he faces; turns about to go the other way
  S.keys('KeyA'); S.setCursor(null); let vmax = 0; S.step(50, () => { vmax = Math.max(vmax, -c.vel[0]); });
  if (vmax < 1.2) fails.push(`walking along the wall he reached ${f2(vmax)} m/s (want the wall's pace, ≥ 1.2)`);
  if (Math.abs(c.pos[2] - WALL.station) > 0.02) fails.push('he came off the plane walking along it');
  if (pl.wall?.kind !== 'stack' || c.anim.longStance !== 'lowLong') fails.push('walking along it lost the stack / the low ready');
  // (his hips against his feet, in his body's own frame, frame to frame)
  const hipOff = () => { const h = c.bones.hips, dx = h[0] - c.pos[0], dz = h[2] - c.pos[2], cy = Math.cos(c.bodyYaw), sy = Math.sin(c.bodyYaw); return [dx * cy - dz * sy, dx * sy + dz * cy]; }; let hp = hipOff(), jump = 0;
  const watch = () => { const h = hipOff(); jump = Math.max(jump, Math.hypot(h[0] - hp[0], h[1] - hp[1])); hp = h; };
  S.keys('KeyD'); S.step(50, watch); const y2 = Math.abs(wrapA(c.bodyYaw - (Math.atan2(0, 1) + Math.PI / 2))) / DEG;
  if (pl.wall?.side !== -1 || y2 > 25) fails.push(`going the other way he did not turn about (side ${pl.wall?.side}, ${y2.toFixed(0)}° off)`);
  S.keys(); S.step(30, watch); const jTurn = jump; jump = 0; S.tap('KeyQ'); S.step(30, watch);
  if (jTurn > 0.04) fails.push(`his hips jumped ${f3(jTurn)} m against his feet in one frame through the turn-about (want ≤ 0.04: the press toward the wall walks across at 1.5 cm a frame, the stance's own mirror is the rest)`);
  if (jump > 0.05) fails.push(`his hips jumped ${f3(jump)} m against his feet in one frame at Q off (want ≤ 0.05: the pose's own quick way out, no more)`);
  rows.push(`walks along it at ${f2(vmax)} m/s, turns about for the other way; hips at most ${f3(jTurn)} m a frame against his feet through the turn, ${f3(jump)} at Q off`);
  // a click with a clear line: a round that frame, the rifle up; then back down
  S.place(21.5, 10.9, 270, 'rifle'); S.setCursor([15, 1.2, 10.9]); S.step(10); S.tap('KeyQ'); S.step(50);
  S.setCursor([21.5, 1.2, 11.9]);   // straight out into the corridor
  S.step(20); const n0 = pl.rifle.roundsReady, lowH = c.muzzle[1] - c.pos[1]; S.click();
  let upAt = -1, downAt = -1, firedAt = -1, fireH = 0;
  S.step(140, f => { if (firedAt < 0 && pl.rifle.roundsReady < n0) { firedAt = f; fireH = c.muzzle[1] - c.pos[1]; } if (upAt < 0 && c.anim.longStance === 'shoulder') upAt = f; if (upAt >= 0 && downAt < 0 && c.anim.longStance === 'lowLong') downAt = f; });
  const fired = n0 - pl.rifle.roundsReady;
  if (fired !== 1) fails.push(`one click with a clear line fired ${fired} round(s)`);
  if (firedAt < 0 || firedAt > 11) fails.push(`the round left ${firedAt} frames after the click (want ≤ 11: the rise, a sixth of a second)`);
  if (fireH < 1.05) fails.push(`the round left with the muzzle ${f2(fireH)} m up (low ready is ${f2(lowH)}; want ≥ 1.05: from the shoulder, not level from the thigh)`);
  if (upAt < 0 || upAt > 2) fails.push(`the rifle was not on its way to the shoulder within two frames of the click (${upAt})`);
  if (downAt < 60 || downAt > 85) fails.push(`it came back down after ${downAt} frames (want ~72: 1.2 s)`);
  if (!pl.wall) fails.push('firing took him off the wall');
  // a second click while it is up: that frame
  { S.place(21.5, 10.9, 270, 'rifle'); S.setCursor([15, 1.2, 10.9]); S.step(10); S.tap('KeyQ'); S.step(50); S.setCursor([21.5, 1.2, 11.9]); S.step(20); S.click(); S.step(30); const n = pl.rifle.roundsReady; S.click(); S.step(1); if (pl.rifle.roundsReady !== n - 1) fails.push('a second click with the rifle already up did not fire that frame'); }
  rows.push(`click, clear line: one round ${firedAt + 1} frames later with the muzzle ${f2(fireH)} m up (low ready ${f2(lowH)}), low again after ${downAt} frames; a second click while it is up fires that frame`);
  // a click through the wall he is stacked on: nothing leaves
  S.setCursor([21.5, 1.2, 8.5]); S.step(20); const n1 = pl.rifle.roundsReady; S.click(); S.step(1); const said = g.messages.some((m: any) => /wall is in the way/.test(m.text)); S.step(20);
  if (pl.rifle.roundsReady !== n1) fails.push('a click with the bore in the wall fired a round');
  if (c.anim.longStance !== 'lowLong') fails.push('the rifle came up pointing through the wall');
  if (!said) fails.push("no 'the wall is in the way' line");
  rows.push('click through the wall: no round, the rifle stays low, the line said');
  // off it: the rifle is still in his hands, and fires at once (no sling beat)
  S.setCursor([21.5, 1.2, 13]); S.tap('KeyQ'); S.step(2); if (pl.wall || !pl.rifleUp) fails.push('Q off the stack: still on it, or the rifle left his hands');
  if (pl.equipT > 0.02) fails.push(`off the stack there is a ${f2(pl.equipT)} s beat with nothing to fire (the rifle never left his hands)`);
  verdict(fails.length === 0, 'rifle in the hands: Q stacks on the wall in low ready, and it shoots from there', fails.length ? fails.join('\n    ') : rows.join('\n    '));
}

async function cover() {
  console.log('\n=== wallsnap-cover ===');
  const S = await world(true); const { pl, c, g } = S; const fails: string[] = []; const rows: string[] = [];
  // FIRST a shut door: the hi end of the run x ∈ [18.2, 25] is the jamb of the server room's door (x 17‥18.2, shut): the cursor over its head must NOT step him out
  { S.place(18.9, 10.8, 270, 'rifle'); S.setCursor([15, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(40); S.keys('KeyA'); S.step(60); S.keys(); S.step(20);
    const w = pl.wall; if (!w || w.kind !== 'stack' || w.atEdge !== 1) fails.push(`(staging) not parked by the shut door (atEdge ${w?.atEdge})`);
    else { S.setCursor([17.3, 1.2, 8.4]); S.step(40); if (w.leanWant || w.lean > 0) fails.push('beside a SHUT door, the cursor over the door stepped him out in front of it'); else rows.push('beside a shut door: the cursor over it does not step him out'); }
    S.tap('KeyQ'); S.step(30); }
  // the run x ∈ [10.2, 17]: its hi end is the jamb of the conference room's doorway (x 9‥10.2, the leaf standing open into the room): the corner is (10.2, 10.06)
  const CX = 10.2;
  S.place(CX + 0.7, 10.8, 270, 'rifle'); S.setCursor([7, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(40);
  S.keys('KeyA'); S.step(60); S.keys(); S.step(20);
  const w = pl.wall;
  if (!w || w.kind !== 'stack') { verdict(false, 'cover at an open end', '(staging) no stack hold'); return; }
  if (w.atEdge !== 1) { verdict(false, 'cover at an open end', `(staging) not parked at the open end (atEdge ${w.atEdge}, x ${f2(c.pos[0])})`); return; }
  const x0 = c.pos[0];
  // the cursor down the corridor, in plain view: he stays in
  S.setCursor([CX - 4, 1.2, 11.2]); S.step(40);
  if (w.lean > 0) fails.push('the cursor on a point in plain view stepped him out');
  // the cursor in the room behind the wall, through the doorway: he steps out, rifle up. The point is half a metre in from the corner he parks at, so the
  // line to it stays clear of the door's open leaf whatever the doorway's width (a point behind the leaf is one stepping out buys no line to: he stays in)
  const hidden: Vec3 = [CX - 0.5, 1.2, 8.4];
  S.setCursor(hidden); let outAt = -1, upAt = -1; S.step(40, f => { if (outAt < 0 && w.lean >= 1) outAt = f; if (upAt < 0 && c.anim.longStance === 'shoulder') upAt = f; });
  const dx = x0 - c.pos[0];
  if (outAt < 0) fails.push('the cursor round the corner did not step him out');
  else if (outAt > 20) fails.push(`he was out after ${outAt} frames (want ≤ 20: 0.06 s dwell + 0.18 s)`);
  if (!(dx > 0.4 && dx < 0.7)) fails.push(`he stands ${f2(dx)} m past his station (want ~0.6)`);
  if (upAt < 0) fails.push('the rifle did not come up as he stepped out');
  if (Math.abs(c.pos[2] - WALL.station) > 0.03) fails.push(`he came ${f3(Math.abs(c.pos[2] - WALL.station))} m off the wall's line stepping out`);
  const sees = !g.col.shotBlocked([c.pos[0], 1.3, c.pos[2]], hidden); if (!sees) fails.push('stepped out, the point is still hidden from him');
  const n0 = pl.rifle.roundsReady; S.step(10); S.click(); S.step(1); if (pl.rifle.roundsReady !== n0 - 1) fails.push('stepped out, a click fired nothing');
  rows.push(`cursor round the corner: out in ${outAt} frames, ${f2(dx)} m past his station, rifle up at frame ${upAt}, the point in view, a click fires`);
  // back in when the cursor returns — not during the beat after the round
  S.setCursor([CX - 4, 1.2, 11.2]); let inAt = -1; S.step(80, f => { if (inAt < 0 && w.lean <= 0) inAt = f; });
  if (inAt < 0) fails.push('the cursor back in plain view did not bring him in');
  else if (inAt < 24) fails.push(`he stepped back in ${inAt} frames after a round (want ≥ 0.4 s after it)`);
  if (Math.abs(c.pos[0] - x0) > 0.01) fails.push(`back in, he is ${f3(Math.abs(c.pos[0] - x0))} m off the station he left`);
  if (!pl.wall) fails.push('stepping out and back took him off the wall');
  rows.push(`cursor back: in again after ${inAt} frames, on the station he left`);
  // the threshold: a cursor wobbling ±1° about the step-out angle must not flutter him
  { const cx = CX, cz = 10.06, deg = Math.atan2(0.45, 0.42) / DEG + WALLSNAP.leanOnDeg; let flips = 0, was = w.leanWant; const rnd = mulberry32(7);
    S.step(120, () => { const a = (deg + (rnd() * 2 - 1)) * DEG, r = 1.6; S.setCursor([cx - Math.cos(a) * r, 1.2, cz - Math.sin(a) * r]); if (w.leanWant !== was) { flips++; was = w.leanWant; } });
    if (flips > 1) fails.push(`a cursor held within a degree of the threshold flipped him ${flips} times in two seconds`); rows.push(`cursor on the threshold ±1°: ${flips} change(s) in 2 s`); }
  // THE MOUSE HELD STILL: the cursor fixed on the SCREEN (projected once, never again) over points all round the corner — stepping out moves him, and must not
  // move what the cursor is on so that he steps back: at most one change in five seconds each, and the plainly hidden ones leave him out
  { const pts: Vec3[] = [hidden, [CX - 0.5, 1.2, 9.2], [CX - 1.6, 1.2, 8.8], [CX - 0.3, 1.2, 8.0], [CX - 2.2, 1.2, 9.4], [CX - 0.7, 1.2, 7.2], [CX - 1.2, 1.2, 9.7]]; const out: string[] = []; let stayed = 0;
    for (const p of pts) {
      S.setCursor([CX - 4, 1.2, 11.2]); S.step(60); if (w.lean > 0 || w.leanWant) { fails.push('(staging) not back in before a held-still case'); break; }
      S.setCursor(p); S.step(1); S.setCursor(null);
      let flips = 0, was = w.leanWant as boolean; S.step(300, () => { if (w.leanWant !== was) { flips++; was = w.leanWant; } });
      if (flips > 1) fails.push(`the mouse held still over (${f2(p[0])}, ${f2(p[2])}): he stepped out and back ${flips} times in five seconds`);
      if (w.leanWant) stayed++; out.push(`${flips}${w.leanWant ? ' out' : ' in'}`);
    }
    if (stayed < 3) fails.push(`only ${stayed} of ${pts.length} held-still points round the corner left him stepped out`);
    rows.push(`mouse held still over ${pts.length} points round the corner, 5 s each: changes ${out.join(' · ')}`); }
  // …AND WITH THE STEP CUT SHORT: a man standing just past the corner stops him part way. The camera gives back the step he really took, not the one he asked
  // for — given back whole, the look-at slid a tenth of a metre the other way and the point under a still mouse left the hidden side again, for ever
  { const gd = g.guards[0], home: Vec3 = [...gd.char.pos] as Vec3, gp: Vec3 = [x0 - 0.75, 0, c.pos[2]], pin = () => { gd.char.pos = [...gp] as Vec3; gd.char.vel = [0, 0, 0]; }; const out: string[] = [];
    const keep = [WALLSNAP.leanKeepDeg, WALLSNAP.leanKeepDist]; WALLSNAP.leanKeepDeg = 0; WALLSNAP.leanKeepDist = 0;   // (the limits' give would hide it at these points: this case is the camera's alone)
    for (const p of [[9.9, 1.2, 9.0], [10.2, 1.2, 7.65], [9.3, 1.2, 8.55]] as Vec3[]) {
      const r: Vec3 = [CX - 4, 1.2, 11.9]; S.setCursor(r); S.step(90, pin); if (w.lean > 0 || w.leanWant) { fails.push('(staging) not back in before a cut-short case'); break; }
      for (let i = 1; i <= 20; i++) { S.setCursor(r.map((v, k) => v + (p[k] - v) * i / 20) as Vec3); S.step(1); pin(); }   // (the mouse travels there, as a hand does, then stops)
      S.setCursor(null);
      let flips = 0, was = w.leanWant as boolean, got = 0; S.step(360, () => { pin(); got = Math.max(got, Math.abs(w.leanOff ?? 0)); if (w.leanWant !== was) { flips++; was = w.leanWant; } });
      if (got > WALLSNAP.leanAlong - 0.03) { fails.push(`(staging) the man past the corner did not cut the step short (${f2(got)} m of ${WALLSNAP.leanAlong})`); break; }
      if (flips > 1) fails.push(`step-out cut short at ${f2(got)} m, the mouse held still over (${f2(p[0])}, ${f2(p[2])}): he stepped out and back ${flips} times in six seconds`);
      out.push(`${flips} (${f2(got)} m)`);
    }
    [WALLSNAP.leanKeepDeg, WALLSNAP.leanKeepDist] = keep; gd.char.pos = home; S.setCursor([CX - 4, 1.2, 11.2]); S.step(90);
    rows.push(`a man 0.75 m past his station cuts the step short, mouse held still, 6 s each: changes ${out.join(' · ')}`); }
  // a reload brings him in
  S.setCursor(hidden); S.step(40); if (!(w.lean >= 1)) fails.push('(staging) not out before the reload');
  S.tap('KeyR'); S.step(30); if (!pl.rifle.reloading) fails.push('R on the stack did not start a reload'); if (w.lean > 0.05) fails.push(`reloading, he is still ${f2(w.lean)} out`);
  rows.push('a reload brings him in');
  S.step(200);
  // THE CAMERA'S AIM LEAD MOVED (the panel's slider; 0.18 as shipped): the hold-still gives back (1 − lead) of his step, so it must be worked with the lead the
  // camera that follows him REALLY has. The mouse still and the camera settled on a hidden point, a reload steps him all the way in and out again: the look-at
  // must not move (worked with another lead than the camera's, it swings most of a metre at 0.5 and the point under the still cursor twice that)
  { const lens = S.W.cam, lead0 = lens.aimLead, L = 0.5; lens.aimLead = L; S.setCursor(hidden); S.step(600); S.setCursor(null); S.step(60); S.click(); S.step(300);
    if (!(w.lean >= 1)) fails.push(`(staging) aim lead ${L}: not out before the reload`);
    else { const t0: Vec3 = [...lens.target] as Vec3; let dev = 0, wentIn = false; S.tap('KeyR');
      S.step(600, () => { dev = Math.max(dev, Math.hypot(lens.target[0] - t0[0], lens.target[2] - t0[2])); if (w.lean <= 0) wentIn = true; });
      if (!wentIn || !(w.lean >= 1)) fails.push(`(staging) aim lead ${L}: the reload did not step him in and out again`);
      else if (dev > 0.01) fails.push(`aim lead ${L}, the mouse still: a step in and out again swung the camera's look-at ${(dev * 100).toFixed(1)} cm (want none: the hold-still is not reading the camera's own lead)`);
      else rows.push(`aim lead ${L}, the mouse still: a step in and out again moves the look-at ${(dev * 100).toFixed(1)} cm`); }
    lens.aimLead = lead0; S.setCursor(hidden); S.step(240); }
  // E on the stack: slung, and the hold is the back hold
  S.setCursor([CX - 4, 1.2, 11.2]); S.step(30); S.tap('KeyE'); S.step(40);
  if (!pl.wall || pl.wall.kind === 'stack') fails.push('E on the stack: still a stack'); if (!pl.holstered) fails.push('E on the stack did not sling the rifle'); if (c.anim.stance !== 'wall') fails.push(`…and the stance is '${c.anim.stance}', not the back hold`);
  const yb = Math.abs(wrapA(c.bodyYaw - 0)) / DEG; if (yb > 60) fails.push(`…and his back is ${yb.toFixed(0)}° off the wall`);
  rows.push('E on the stack: slung, back to the wall');
  verdict(fails.length === 0, 'at an open end the cursor round the corner steps him out, and back', fails.length ? fails.join('\n    ') : rows.join('\n    '));
}

async function offSame() {
  console.log('\n=== wallsnap-off-same ===');
  const S = await world(false); const { pl, c } = S; const fails: string[] = [];
  S.place(21, 11.0, 180, 'rifle'); S.setCursor([21, 1.2, 8]); S.step(10);
  S.tap('KeyQ'); let frames = -1; S.step(40, f => { if (frames < 0 && pl.wall && pl.wall.settle >= 1) frames = f + 1; });
  const w = pl.wall; if (!w) { verdict(false, 'switch off = the hold as it was', 'no hold'); return; }
  for (const k of ['takeT', 'yaw0', 'yawD', 'hitT', 'kind', 'up', 'lean', 'leanWant', 'leanOff']) if (k in w) fails.push(`the hold carries '${k}' with the switch off`);
  if (frames !== 14) fails.push(`the take settled in ${frames} frames (the old fixed 0.22 s is 14)`);
  if (!pl.holstered || c.anim.stance !== 'wall') fails.push('with the switch off the rifle was not slung for the wall');
  if (c.anim.wallTake !== -1 || c.anim.wallHit !== 0 || c.anim.stackPress !== 0 || c.anim.stanceOut !== 0) fails.push('an animator channel of the feel pass is off its rest value');
  S.tap('KeyQ'); S.step(30); if (pl.wall) fails.push('Q did not let go'); if (c.anim.stanceOut !== 0 || c.anim.stackPress !== 0 || c.anim.wallTake !== -1) fails.push('…and off the wall a channel of the feel pass is off its rest value');
  verdict(fails.length === 0, 'switch off = the hold as it was', fails.length ? fails.join('\n    ') : `no feel-pass field on the hold; the take settles in ${frames} frames; the rifle is slung; the animator's channels at rest`);
}

// DUO: two person stealth (pairup.ts, `?pair`) with the partner following — the room clear on the office with ONE teammate, the silent order given, the pair's
// switch on (pairup-probes.ts's own rig). The wall hold is Sam's alone; what is asked here is that the partner neither breaks it nor is broken by it.
async function duo() {
  console.log('\n=== wallsnap-duo ===');
  const { rig } = await import('./pairup-probes.ts'); const fails: string[] = []; const rows: string[] = [];
  const TABLES: any[] = await Promise.all(['pairup', 'pairorders', 'sneak', 'spotted'].map(f => import(`${ROOT}/src/game/${f}.ts`)));
  const SNM: any = TABLES[2]; const flat = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[2] - b[2]);
  try {
    const R: any = await rig({ up: true }); WALLSNAP.on = true; AIM.player.level = 1;
    const g = R.game, pl = g.player, c = pl.char, m = R.mate, input = R.input, W = R.W; W.cam.yaw = 0; W.cam.rebuild();
    if (!m) { verdict(false, 'duo', '(staging) no partner'); return; }
    // every defender but one off the floor, and that one held where he stands behind his room's door: a calm floor
    { const T = R.hostiles[0]; R.pin(T, { at: [...T.char.pos], yaw: T.char.bodyYaw, state: 'patrol', aw: 0, eyesOn: null }); R.only(T); }
    let cursor: Vec3 | null = null; const step = (n = 1, each?: (f: number) => void) => { for (let f = 0; f < n; f++) { if (cursor) W.cursorAt(cursor); R.step(); each?.(f); } };
    const keys = (...ks: string[]) => { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) input.keys.delete(k); for (const k of ks) input.keys.add(k); };
    const tap = (k: string) => input.pressed.add(k);
    const order = () => R.O.of(m)?.order;
    // Sam walked down the corridor (west) so his trail lies along it, the partner a few strides behind him on it, told to fall in
    g.teleportPlayer([24.5, 0, 11.1]); R.put(m, [26.4, 0, 11.1], -Math.PI / 2); R.O.give('fallIn', R.O.targetAt(c.pos), 'all'); step(10);
    R.walk([21, 0, 10.95], 1.3, 8); c.bodyYaw = c.aimYaw = Math.PI; pl.slot = 'pistol'; pl.holstered = false; cursor = [21, 1.2, 8]; step(60);
    if (order() !== 'fallIn') fails.push(`(staging) the partner's order is '${order()}', not fall in`);
    const sneak0 = SNM.sneaking(g, m);
    // ---- quiet: the take with him at Sam's shoulder
    const said0 = R.said.length; tap('KeyQ'); let off = 0, near = Infinity; step(150, () => { if (pl.wall && pl.wall.settle >= 1) off = Math.max(off, Math.abs(c.pos[2] - WALL.station)); near = Math.min(near, flat(c.pos, m.char.pos)); });
    if (!pl.wall) fails.push('with the partner following, Q took no hold');
    else { if (off > 0.01) fails.push(`on the wall with the partner beside him Sam was pushed ${f3(off)} m off his station`);
      if (near < 0.55) fails.push(`the partner stood ${f2(near)} m from Sam on the wall (inside his body)`);
      if (order() !== 'fallIn') fails.push(`taking the wall changed the partner's order to '${order()}'`);
      const v = Math.hypot(m.char.vel[0], m.char.vel[2]); if (v > 0.2) fails.push(`2.5 s after the take the partner is still walking (${f2(v)} m/s): he never settles beside a man on a wall`);
      if (SNM.sneaking(g, m) !== sneak0) fails.push(`the sneak went ${sneak0 ? 'off' : 'on'} when Sam took the wall`);
      rows.push(`quiet take, partner following: on the station to ${f3(off)} m, the partner ${f2(flat(c.pos, m.char.pos))} m off and still, his order fall in, sneaking ${SNM.sneaking(g, m)}`); }
    // crouched on the wall, the partner goes low with him
    if (pl.wall) { tap('KeyC'); step(90); const low = (m.char.anim.crouch ?? 0) > 0.5; if (pl.crouch && SNM.SNEAK.on && SNM.SNEAK.crouch && !low) fails.push('Sam crouched on the wall and the partner stayed upright'); rows.push(`Sam low on the wall: ${pl.crouch ? `partner low ${low}` : '(C did not crouch him here)'}`); if (pl.crouch) { tap('KeyC'); step(60); } }
    // the squad's keys with the hold on: the menu (X, shut again), who (T), the quick order's key is not pressed (it would move him) — the hold stays
    if (pl.wall) { tap('KeyX'); step(3); const up = !!R.O.menu; tap('KeyX'); step(3); tap('KeyT'); step(3); tap('KeyT'); step(3); tap('KeyF'); step(3);
      if (!pl.wall) fails.push('X / T / F with the hold on took him off the wall'); if (!up) fails.push('X on the wall did not open the orders menu'); rows.push(`X opens the menu on the wall (${up}), T and F leave the hold alone`); }
    // sidling back at the partner (he stands up the corridor, +x): he lets Sam by or Sam stops against him — never off the plane, never through him
    if (pl.wall) { const x0 = c.pos[0]; keys('KeyD'); let offS = 0, nearS = Infinity; step(150, () => { if (pl.wall) offS = Math.max(offS, Math.abs(c.pos[2] - WALL.station)); nearS = Math.min(nearS, flat(c.pos, m.char.pos)); }); keys(); step(30);
      const went = c.pos[0] - x0;
      if (!pl.wall) fails.push('sidling toward the partner took Sam off the wall');
      if (offS > 0.03) fails.push(`sidling past the partner Sam came ${f3(offS)} m off the plane`);
      if (nearS < 0.5) fails.push(`sidling at the partner Sam came within ${f2(nearS)} m of him (through him)`);
      if (went < 1.5) fails.push(`sidling toward the partner Sam made ${f2(went)} m in 2.5 s (want ≥ 1.5: the partner steps off the wall for him)`);
      rows.push(`sidling back at him: ${f2(went)} m along the wall in 2.5 s, nearest ${f2(nearS)} m, ${f3(offS)} m off the plane at most`); }
    // off the wall and away: he follows again
    if (pl.wall) { tap('KeyQ'); step(5); } R.walk([15, 0, 11.1], 1.4, 8); step(180);
    { const d = flat(c.pos, m.char.pos); if (order() !== 'fallIn' || d > 4.5) fails.push(`off the wall and six metres on, the partner is ${f2(d)} m back with the order '${order()}'`); rows.push(`off the wall and on: the partner ${f2(d)} m behind, order fall in`); }
    // ---- the rifle: the stack by the conference doorway with him following; the step-out works; he does not walk into the opening Sam covers
    g.teleportPlayer([11.6, 0, 10.9]); c.bodyYaw = c.aimYaw = 270 * DEG; pl.slot = 'rifle'; pl.holstered = false; pl.equipT = 0; cursor = [7, 1.2, 10.9]; step(120);
    tap('KeyQ'); step(40); keys('KeyA'); step(70); keys(); step(40);
    const w = pl.wall;
    if (!w || w.kind !== 'stack' || w.atEdge !== 1) fails.push(`(staging) no stack parked at the doorway (kind ${w?.kind}, atEdge ${w?.atEdge})`);
    else { cursor = [9.7, 1.2, 8.4]; let nearK = Infinity, offK = 0, inFront = 0; step(120, () => { nearK = Math.min(nearK, flat(c.pos, m.char.pos)); offK = Math.max(offK, Math.abs(c.pos[2] - WALL.station)); if (m.char.pos[0] < c.pos[0] - 0.2) inFront++; });
      if (!(w.lean >= 1)) fails.push('with the partner behind him the cursor round the corner did not step Sam out');
      if (offK > 0.03) fails.push(`stepped out with the partner behind, Sam came ${f3(offK)} m off the plane`);
      if (nearK < 0.5) fails.push(`the partner came within ${f2(nearK)} m of Sam on the stack`);
      if (inFront > 0) fails.push(`the partner stood in FRONT of Sam's muzzle for ${inFront} frames while he covered the doorway`);
      if (order() !== 'fallIn') fails.push(`the stack changed the partner's order to '${order()}'`);
      rows.push(`rifle stack + step-out, partner following: out ${f2(w.lean)}, the partner ${f2(nearK)} m off at nearest and never ahead of the muzzle, ${f3(offK)} m off the plane`); }
    const own = R.said.slice(said0).filter((t: string) => /wall|back to/.test(t)); if (own.length > 2) fails.push(`the hold said ${own.length} lines: ${own.join(' | ')}`);
  } finally { for (const T of [TABLES[0].PAIRUP, TABLES[1].PAIR, TABLES[2].SNEAK, TABLES[3].SPOTTED]) T.on = false; }
  verdict(fails.length === 0, 'duo stealth: the partner following neither breaks the hold nor is broken by it', fails.length ? fails.join('\n    ') : rows.join('\n    '));
}

/** THE CAMERA TURNED (the maintainer, 10-10: "i'm getting snapped off Q when trying to move around"): the walk keys are the camera's, the wall is wherever it
 *  is. Every 15° of camera yaw × the four keys and the four diagonals, on the back hold: a stick within WALLSNAP.alongDeg of the wall's line sidles him that way
 *  and never lets go; only one nearer square-out lets go; one into the wall does nothing. WALLSNAP_BREAK=1 = the rule as it was: must fail. */
async function camera() {
  console.log('\n=== wallsnap-camera ===');
  const S = await world(true); const { pl, c, W } = S; const fails: string[] = []; let sidles = 0, offs = 0, stays = 0, worst = '';
  if (process.env.WALLSNAP_BREAK === '1') WALLSNAP.alongDeg = 0;
  const COMBOS = [['KeyW'], ['KeyA'], ['KeyS'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];
  const cam = (yawDeg: number) => { W.cam.yaw = yawDeg * DEG; W.cam.rebuild(); };
  const gotOff = new Map<string, boolean>();   // per hold and camera yaw: did SOME key get him off the wall
  for (const kitIn of ['empty', 'rifle'] as const) for (let yaw = 0; yaw < 360; yaw += kitIn === 'rifle' ? 45 : 15) for (const ks of COMBOS) {
    const hk = `${kitIn === 'rifle' ? 'stack' : 'back hold'}, camera ${yaw}°`; if (!gotOff.has(hk)) gotOff.set(hk, false);
    cam(yaw); S.place(21.5, 10.9, 180, kitIn); S.setCursor(null); S.tap('KeyQ'); S.step(40, () => cam(yaw)); if (!pl.wall) { fails.push(`(staging) ${hk}: no hold`); continue; }
    if ((pl.wall.kind === 'stack') !== (kitIn === 'rifle')) { fails.push(`(staging) ${hk}: the hold is '${pl.wall.kind ?? 'back'}'`); continue; }
    const b = W.cam.planarBasis(); let mx = 0, mz = 0; for (const k of ks) { const s = k === 'KeyW' || k === 'KeyD' ? 1 : -1, v = k === 'KeyW' || k === 'KeyS' ? b.fwd : b.right; mx += s * v[0]; mz += s * v[2]; }
    const l = Math.hypot(mx, mz); mx /= l; mz /= l; const w = pl.wall, along = mx * w.along[0] + mz * w.along[2], away = mx * w.n[0] + mz * w.n[2];
    const deg = Math.acos(Math.min(1, Math.abs(along))) / DEG;   // the stick's angle off the wall's own line
    const x0 = c.pos[0], z0 = c.pos[2]; S.keys(...ks); let offAt = -1; S.step(45, f => { cam(yaw); if (offAt < 0 && !pl.wall) offAt = f; }); S.keys();
    if (offAt >= 0) gotOff.set(hk, true);
    const moved = (c.pos[0] - x0) * w.along[0] + (c.pos[2] - z0) * w.along[2], tag = `${hk} ${ks.map(k => k[3]).join('+')} (${deg.toFixed(0)}° off the wall's line, ${away > 0 ? 'outward' : 'inward'})`;
    if (Math.abs(deg - 55) < 3) continue;   // (on the boundary itself either answer is the rule's)
    if (deg < 55) { sidles++; if (offAt >= 0) { fails.push(`${tag}: let go after ${offAt} frames — it should sidle`); if (!worst) worst = tag; } else if (moved * Math.sign(along) < 0.5) fails.push(`${tag}: moved ${f2(moved)} m along in 0.75 s (want ≥ 0.5 the stick's way)`); }
    else if (away > 0) { offs++; if (offAt < 0 || offAt > 8) fails.push(`${tag}: ${offAt < 0 ? 'never let go' : `let go after ${offAt} frames`} (want within 8: a tenth of a second)`); }
    else { stays++; if (offAt >= 0) fails.push(`${tag}: pushing into the wall let go`); else if (Math.abs(moved) > 0.05) fails.push(`${tag}: pushing into the wall moved him ${f2(moved)} m along`); }
    if (pl.wall) { S.tap('KeyQ'); S.step(12); }
  }
  for (const [hk, off] of gotOff) if (!off) fails.push(`${hk}: no walk key or diagonal let go of the wall`);
  // AT THE END OF THE RUN the outward diagonal is the way off round the corner: held from mid-run it sidles him to the end and then lets go there (it must not park him)
  let ends = 0;
  if (process.env.WALLSNAP_BREAK !== '1') for (const yaw of [0, 90, 180, 270]) for (const ks of COMBOS) {
    cam(yaw); const b = W.cam.planarBasis(); let mx = 0, mz = 0; for (const k of ks) { const s = k === 'KeyW' || k === 'KeyD' ? 1 : -1, v = k === 'KeyW' || k === 'KeyS' ? b.fwd : b.right; mx += s * v[0]; mz += s * v[2]; }
    const l = Math.hypot(mx, mz); mx /= l; mz /= l;
    S.place(21.5, 10.9, 180); S.tap('KeyQ'); S.step(40, () => cam(yaw)); const w = pl.wall; if (!w) continue;
    const along = mx * w.along[0] + mz * w.along[2], away = mx * w.n[0] + mz * w.n[2], deg = Math.acos(Math.min(1, Math.abs(along))) / DEG;
    if (!(away > 0.55 && deg > 35 && deg < 50)) { S.tap('KeyQ'); S.step(12); continue; }   // (only the outward diagonals: ~45° off the wall's line)
    const u0 = c.pos[0] * w.along[0] + c.pos[2] * w.along[2]; S.keys(...ks); let offAt = -1, uOff = 0; S.step(300, f => { cam(yaw); if (offAt < 0 && !pl.wall) { offAt = f; uOff = c.pos[0] * w.along[0] + c.pos[2] * w.along[2]; } }); S.keys(); ends++;
    const tag = `camera ${yaw}° ${ks.map(k => k[3]).join('+')} held from mid-run (an outward diagonal)`;
    if (offAt < 0) fails.push(`${tag}: parked at the end of the wall for five seconds — the diagonal should take him off round the corner`);
    else if (Math.abs(uOff - u0) < 1) fails.push(`${tag}: let go after ${f2(Math.abs(uOff - u0))} m (want it to sidle him to the end first)`);
    if (pl.wall) { S.tap('KeyQ'); S.step(12); }
  }
  cam(0);
  verdict(fails.length === 0 && sidles > 80 && offs > 28 && stays > 28 && (ends >= 4 || process.env.WALLSNAP_BREAK === '1'), 'the camera turned any way: a key that runs along the wall sidles him and never drops him; only square-out lets go',
    fails.length ? `${fails.length} cases, the first: ${fails.slice(0, 6).join('\n    ')}` : `${sidles} sticks along the wall sidled and stayed, ${offs} square-out let go inside a tenth of a second, ${stays} into the wall did nothing (24 camera yaws × 8 key combinations on the back hold, 8 × 8 on the stack; at every yaw some key lets go); ${ends} outward diagonals held from mid-run sidled to the end and left there`);
}

/** THE KIT ON THE WALL (the same note: "the transitions here between kit and all that when snapped aren't quite right"): the rifle in his hands on the wall is
 *  the stack, however it got there. 2 — or E with it selected — on the back hold brings it up and he stacks without leaving the wall; another item chosen on the
 *  stack slings it, he is back on the plaster and the words say the item waits for the step off; Q then leaves with what he chose in his hand. With WALLSNAP.stackDraw
 *  (or the stack itself) off, 2 on the wall is the older answer. WALLSNAP_BREAK=1 = stackDraw off for the lines that want the stack: must fail. */
async function kit() {
  console.log('\n=== wallsnap-kit ===');
  const S = await world(true); const { pl, c, g } = S; const fails: string[] = []; const rows: string[] = [];
  const msgs: string[] = []; const m0 = g.msg.bind(g); g.msg = (s: string, ...a: any[]) => { msgs.push(s); return m0(s, ...a); };
  pl.canisters = 2;
  const brk = process.env.WALLSNAP_BREAK === '1';
  const hold = (kitIn: 'pistol' | 'rifle' | 'empty', sel: 'pistol' | 'rifle' = 'pistol') => { S.place(21.5, 10.9, 180, kitIn); if (kitIn === 'empty') pl.slot = sel; S.tap('KeyQ'); S.step(50); msgs.length = 0; return !!pl.wall; };
  /** press a key and run `n` frames: was he ever off the wall, how far did he move */
  const press = (k: string, n = 45) => { const p0 = v3.copy(c.pos); let off = false; S.tap(k); S.step(n, () => { off ||= !pl.wall; }); return { off, d: v3.distXZ(c.pos, p0), said: msgs.splice(0).join(' | ') }; };
  const want = (r: { off: boolean; d: number; said: string }, what: string, kind: 'stack' | 'back', inHands: boolean, words?: RegExp) => {
    const k = pl.wall ? (pl.wall.kind ?? 'back') : 'off';
    if (r.off || k !== kind) fails.push(`${what}: ${r.off ? 'he came off the wall' : `the hold is '${k}'`} (want '${kind}', on the wall throughout)`);
    if (r.d > 0.12) fails.push(`${what}: he moved ${f3(r.d)} m (want < 0.12: the hold changes where he stands)`);
    if (pl.rifleUp !== inHands) fails.push(`${what}: the rifle is ${pl.rifleUp ? 'in his hands' : 'not in his hands'}`);
    if (kind === 'stack' && (c.anim.stance !== 'stack' || !c.anim.longGun)) fails.push(`${what}: stance '${c.anim.stance}', long gun ${c.anim.longGun} (want the stack's)`);
    if (kind === 'back' && (c.anim.stance !== 'wall' || !pl.holstered)) fails.push(`${what}: stance '${c.anim.stance}', holstered ${pl.holstered} (want the back hold, hands empty)`);
    if (words && !words.test(r.said)) fails.push(`${what}: the words were "${r.said}"`);
    rows.push(`${what}: ${k}${pl.rifleUp ? ', rifle in hands' : ''} — "${r.said}"`);
  };
  if (brk) WALLSNAP.stackDraw = false;
  if (hold('empty', 'pistol')) {
    want(press('Digit2'), '2 on the back hold', 'stack', true, /^(?!.*once off the wall)/);
    { const bodyAlong = Math.abs(Math.sin(c.bodyYaw)); if (bodyAlong < 0.8) fails.push(`2 on the back hold: his body is ${(Math.asin(bodyAlong) / DEG).toFixed(0)}° round toward the wall's line (want side-on, ≥ 53°)`); }
    want(press('Digit1'), '1 on the stack', 'back', false, /once off the wall/);
    want(press('Digit2'), '2 again', 'stack', true);
    want(press('KeyE'), 'E on the stack', 'back', false);
    want(press('KeyE'), 'E on the back hold, the rifle selected', 'stack', true);
    want(press('Digit3'), '3 on the stack', 'back', false, /once off the wall/);
    const r = press('KeyQ', 30); if (pl.wall) fails.push('Q did not let go'); else if (pl.slot !== 'smoke' || pl.holstered) fails.push(`off the wall after choosing the smoke can: slot ${pl.slot}, holstered ${pl.holstered} (want the can in his fist)`); rows.push(`Q: off, ${pl.slot} in hand`); void r;
  } else fails.push('(staging) no back hold');
  if (hold('empty', 'pistol')) { want(press('KeyE'), 'E on the back hold, the pistol selected', 'back', false, /once off the wall/); }
  if (hold('rifle')) { if (pl.wall.kind !== 'stack') fails.push('(staging) Q with the rifle up is not the stack');
    const x0 = c.pos[0]; S.keys('KeyD'); S.step(40); S.tap('Digit1'); let off = false; S.step(40, () => { off ||= !pl.wall; }); S.keys();
    if (off || !pl.wall || pl.wall.kind === 'stack') fails.push(`1 pressed while walking the stack: ${off ? 'he came off the wall' : `hold '${pl.wall?.kind ?? 'back'}'`}`); else rows.push(`1 while walking the stack: stayed on, back hold, ${f2(Math.abs(c.pos[0] - x0))} m along`); msgs.length = 0; }
  // 2 with the rifle already in his hands on the stack is still the attachment's key, and he stays put
  if (hold('rifle')) { S.step(40); const a0 = pl.rifle.attIdx; want(press('Digit2', 20), '2 on the stack, the rifle up', 'stack', true); if (pl.rifle.attIdx === a0) fails.push('2 on the stack, the rifle up: the attachment did not change'); }
  // STEPPED OUT ROUND A CORNER on the stack, the rifle put away and brought straight back (1 then 2, E then E): he must not be read as 'past the end of the wall'
  if (!brk) for (const [a, b] of [['Digit1', 'Digit2'], ['KeyE', 'KeyE']]) for (const gap of [2, 6, 12]) {
    const CX = 10.2, what = `stepped out round the corner, ${a.replace(/Digit|Key/, '')} then ${b.replace(/Digit|Key/, '')} ${gap} frames apart`;
    S.place(CX + 0.7, 10.8, 270, 'rifle'); S.setCursor([7, 1.2, 10.8]); S.step(10); S.tap('KeyQ'); S.step(40); S.keys('KeyA'); S.step(60); S.keys(); S.step(20);
    const w = pl.wall; if (!w || w.kind !== 'stack' || w.atEdge !== 1) { fails.push(`(staging) ${what}: not stacked at the open end`); S.setCursor(null); continue; }
    S.setCursor([CX - 0.5, 1.2, 8.4]); S.step(40); if (!(w.lean! >= 1) || !(Math.abs(w.leanOff ?? 0) > 0.4)) { fails.push(`(staging) ${what}: not stepped out (lean ${w.lean}, ${f2(w.leanOff ?? 0)} m)`); S.setCursor(null); S.tap('KeyQ'); S.step(30); continue; }
    msgs.length = 0; let off = false; S.tap(a); S.step(gap, () => { off ||= !pl.wall; }); S.tap(b); S.step(90, () => { off ||= !pl.wall; }); const said = msgs.splice(0).join(' | ');
    if (off || !pl.wall) fails.push(`${what}: he came off the wall — "${said}"`);
    else if (pl.wall.kind !== 'stack' || !pl.rifleUp) fails.push(`${what}: hold '${pl.wall.kind ?? 'back'}', rifle up ${pl.rifleUp} (want the stack again)`);
    else if (gap === 6) rows.push(`${what}: stayed on the wall, the stack again${pl.wall.lean ? ', stepped out' : ''}`);
    S.setCursor(null); if (pl.wall) { S.tap('KeyQ'); S.step(30); }
  }
  // the stack switched off: 2 on the wall is the older answer
  if (!brk) for (const key of ['stackDraw', 'stack'] as const) { WALLSNAP[key] = false; if (hold('empty', 'pistol')) want(press('Digit2'), `${key} off, 2 on the back hold`, 'back', false, /once off the wall/); WALLSNAP[key] = true; }
  g.msg = m0;
  verdict(fails.length === 0, 'the kit on the wall: the rifle in his hands is the stack however it got there, anything else is the back hold, and he never leaves the wall for it', fails.length ? fails.join('\n    ') : rows.join('\n    '));
}

const FAMILY: Record<string, () => Promise<void>> = { 'wallsnap-camera': camera, 'wallsnap-kit': kit, 'wallsnap-take': take, 'wallsnap-landing': landing, 'wallsnap-reach': reach, 'wallsnap-off': offIt, 'wallsnap-stack': stack, 'wallsnap-cover': cover, 'wallsnap-off-same': offSame, 'wallsnap-duo': duo };
/** run the family (or one of it by name); true = every check passed. The switch is left as it was found. */
export async function wallSnapProbes(only?: string): Promise<boolean> {
  const was = { ...WALLSNAP }, lvl = AIM.player.level; allPass = true;
  try { for (const [name, fn] of Object.entries(FAMILY)) if (!only || only === 'wallsnap' || only === name) await fn(); }
  finally { Object.assign(WALLSNAP, was); AIM.player.level = lvl; }
  return allPass;
}
if (import.meta.main) { const ok = await wallSnapProbes(process.argv[2]); console.log(ok ? '\n=== wallsnap: ALL PASS ===' : '\n=== wallsnap: FAILED ==='); process.exit(ok ? 0 : 1); }
