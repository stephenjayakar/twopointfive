// The 'wall-pose' probe (run through probes.ts: `bun run tools/qa/probes.ts wall-pose`, or this file directly, `--report` for every number): the back-to-the-wall
// hold (Q) judged off the finished skeleton, not the controller — engage a straight run of corridor wall standing and crouched, from a drawn pistol and from a
// holstered one, let it settle a second, and measure the bones against the wall plane the hold names (player.wall: n out of the wall, d): the pelvis and the
// neck a back's thickness off the plane (0.10‥0.30 m: the joints sit inside the body, the shoulder blades and the seat are on the wall), the shoulder line
// parallel to the wall within 15°, both wrists within 0.2 m of the plane and below the chest, the feet gathered (ankles ≤ 0.45 m apart standing, ≤ 0.55
// crouched), nothing of him THROUGH the plane (every joint ≥ −2 cm: an elbow or a heel in the plaster is what the camera would catch), the head turned along
// the wall the way he leads (≥ 25° off the normal toward `side`), no NaN anywhere; the pistol holstered for as long as he is on it whatever it was before, a
// left click firing nothing, and the kit back as it was (drawn → drawn, holstered → holstered) the frame he steps off. Then the same measures sampled while
// he SIDLES (the legs walk under a torso that must stay on the wall: pelvis / neck / shoulder line / hands, looser feet) and a flip of direction mid-wall.
import { standUp, ROOT } from './headless.ts';
const { v3 } = await import(`${ROOT}/src/math/vec.ts`);

type Vec3 = [number, number, number];
const DT = 1 / 60; const DEG = Math.PI / 180;
function seeded(a: number) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const f2 = (x: number) => x.toFixed(2), f1 = (x: number) => x.toFixed(1);
const wrapA = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/** One frame's geometry of the hold, off character.bones against the plane {p·n = d}: distances INTO the room (− = through the wall), the shoulder line's angle
 *  to the wall, the head's yaw off the normal toward the lead side, hand heights against the chest, the feet's spread along the wall, the lowest joint. */
export interface WallPoseSample {
  pelvis: number; chest: number; neck: number; head: number;
  shoulderDeg: number;            // angle between the shoulder line and the wall's tangent (0 = parallel), degrees, unsigned
  chestYawDeg: number;            // chest facing off the wall normal, degrees, unsigned
  gazeDeg: number;                // head yaw off the normal, + = toward the lead side (player.wall.side)
  handL: number; handR: number; handLy: number; handRy: number; chestY: number; fingerMin: number; elbowMin: number;
  feetApart: number; feetAlong: number; footMinOff: number; kneeMin: number;
  minOff: number; minBone: string; nan: string[];
}
export function sampleWallPose(game: any): WallPoseSample | null {
  const pl = game.player, c = pl.char, w = pl.wall; if (!w) return null;
  const b = c.bones as Record<string, Vec3>; const n: Vec3 = w.n, t: Vec3 = w.along, s: number = w.side;
  const off = (p: Vec3) => p[0] * n[0] + p[2] * n[2] - w.d;
  const along = (p: Vec3) => p[0] * t[0] + p[2] * t[2];
  const nan: string[] = []; for (const k in b) { const p = b[k]; if (!Number.isFinite(p[0]) || !Number.isFinite(p[1]) || !Number.isFinite(p[2])) nan.push(k); }
  let minOff = Infinity, minBone = '';
  for (const k of ['hips', 'spine2', 'chest', 'neck', 'head', 'upperArmL', 'upperArmR', 'forearmL', 'forearmR', 'handL', 'handR', 'fingerL', 'fingerR', 'thighL', 'thighR', 'shinL', 'shinR', 'footL', 'footR', 'toeL', 'toeR']) { const o = off(b[k]); if (o < minOff) { minOff = o; minBone = k; } }
  const sh = v3.sub(b.upperArmR, b.upperArmL); const shl = Math.hypot(sh[0], sh[2]) || 1;
  const shoulderDeg = Math.abs(Math.asin(Math.min(1, Math.abs((sh[0] * n[0] + sh[2] * n[2]) / shl)))) / DEG;
  const cd: Vec3 = c.chestDir; const chestYawDeg = Math.abs(wrapA(Math.atan2(cd[0], cd[2]) - Math.atan2(n[0], n[2]))) / DEG;
  const hd: Vec3 = c.headDir(); const gyaw = wrapA(Math.atan2(hd[0], hd[2]) - Math.atan2(n[0], n[2]));   // + = turned toward +yaw = toward the world's… measure it against `side` through the tangent instead:
  const gazeDeg = Math.atan2(hd[0] * t[0] + hd[2] * t[2], hd[0] * n[0] + hd[2] * n[2]) / DEG * s;    // (t = his right when flat to the wall; side + = leads right)
  void gyaw;
  return {
    pelvis: off(b.hips), chest: off(b.chest), neck: off(b.neck), head: off(b.head), shoulderDeg, chestYawDeg, gazeDeg,
    handL: off(b.handL), handR: off(b.handR), handLy: b.handL[1], handRy: b.handR[1], chestY: b.chest[1], fingerMin: Math.min(off(b.fingerL), off(b.fingerR)), elbowMin: Math.min(off(b.forearmL), off(b.forearmR)),
    feetApart: v3.distXZ(b.footL, b.footR), feetAlong: Math.abs(along(b.footR) - along(b.footL)), footMinOff: Math.min(off(b.footL), off(b.footR), off(b.toeL), off(b.toeR)), kneeMin: Math.min(off(b.shinL), off(b.shinR)),
    minOff, minBone, nan,
  };
}
const line = (S: WallPoseSample) => `pelvis ${f2(S.pelvis)} chest ${f2(S.chest)} neck ${f2(S.neck)} head ${f2(S.head)} · shoulders ${f1(S.shoulderDeg)}° chest ${f1(S.chestYawDeg)}° gaze ${f1(S.gazeDeg)}° · hands L ${f2(S.handL)} @${f2(S.handLy)} R ${f2(S.handR)} @${f2(S.handRy)} (chest @${f2(S.chestY)}) fingers ≥ ${f2(S.fingerMin)} elbows ≥ ${f2(S.elbowMin)} · feet ${f2(S.feetApart)} apart (${f2(S.feetAlong)} along, ≥ ${f2(S.footMinOff)} off) knees ≥ ${f2(S.kneeMin)} · lowest ${S.minBone} ${f2(S.minOff)}${S.nan.length ? ' · NaN: ' + S.nan.join(',') : ''}`;

/** the parked hold's bars (crouched: the feet may sit a little wider and the hands lower) */
function judgeParked(S: WallPoseSample, crouch: boolean): string[] {
  const f: string[] = [];
  if (S.nan.length) f.push(`NaN in ${S.nan.join(', ')}`);
  if (S.pelvis < 0.10 || S.pelvis > 0.30) f.push(`pelvis ${f2(S.pelvis)} m off the wall plane (want 0.10‥0.30)`);
  if (S.neck < 0.10 || S.neck > 0.30) f.push(`neck ${f2(S.neck)} m off the wall plane (want 0.10‥0.30)`);
  if (S.shoulderDeg > 15) f.push(`shoulder line ${f1(S.shoulderDeg)}° off parallel to the wall (want ≤ 15°)`);
  if (S.handL > 0.20 || S.handR > 0.20) f.push(`hands ${f2(S.handL)} / ${f2(S.handR)} m off the plane (want both ≤ 0.20)`);
  if (S.handLy > S.chestY || S.handRy > S.chestY) f.push(`a hand above the chest joint (L ${f2(S.handLy)} R ${f2(S.handRy)} vs chest ${f2(S.chestY)})`);
  if (S.feetApart > (crouch ? 0.55 : 0.45)) f.push(`feet ${f2(S.feetApart)} m apart (want ≤ ${crouch ? 0.55 : 0.45})`);
  if (S.minOff < -0.02) f.push(`${S.minBone} ${f2(S.minOff)} m THROUGH the wall plane`);
  if (S.gazeDeg < 25) f.push(`head only ${f1(S.gazeDeg)}° along the wall toward the lead side (want ≥ 25°)`);
  return f;
}
/** on the move: the torso's bars only (the legs are the cycle's), the feet merely not through the wall */
function judgeSliding(S: WallPoseSample): string[] {
  const f: string[] = [];
  if (S.nan.length) f.push(`NaN in ${S.nan.join(', ')}`);
  if (S.pelvis < 0.08 || S.pelvis > 0.36) f.push(`pelvis ${f2(S.pelvis)} m off the plane sidling (want 0.08‥0.36)`);
  if (S.neck < 0.08 || S.neck > 0.34) f.push(`neck ${f2(S.neck)} m off the plane sidling (want 0.08‥0.34)`);
  if (S.shoulderDeg > 20) f.push(`shoulder line ${f1(S.shoulderDeg)}° off the wall sidling (want ≤ 20°)`);
  if (S.handL > 0.26 || S.handR > 0.26) f.push(`hands ${f2(S.handL)} / ${f2(S.handR)} m off the plane sidling (want ≤ 0.26)`);
  if (S.handLy > S.chestY || S.handRy > S.chestY) f.push(`a hand above the chest sidling`);
  if (S.minOff < -0.03) f.push(`${S.minBone} ${f2(S.minOff)} m through the wall plane sidling`);
  return f;
}

export async function wallPose(opts: { report?: boolean } = {}) {
  console.log('\n=== wall-pose: the hold measured off the bones — back on the wall, shoulders parallel, hands low on the wall, feet gathered, nothing through the plaster; holstered on it, the kit restored off it ===');
  Math.random = seeded(93);
  const W = await standUp(); const { game, input } = W;
  game.playerInvisible = true; game.godMode = true; game.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); });
  let allPass = true;
  const report = (name: string, fails: string[], extra: string) => { const pass = fails.length === 0; allPass &&= pass; console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${name}\n    ${extra}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const clearKeys = () => { for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) input.keys.delete(k); input.buttons = 0; };
  // the corridor's north wall (face z 10.06, n +z) from x 21, and its south wall (face z 12.14, n −z) — one of each facing so a sign slip in the layer shows
  type C = { note: string; p: Vec3; crouch: boolean; drawn: boolean; n: [number, number] };
  const cases: C[] = [
    { note: 'standing, pistol drawn, north wall', p: [21.0, 0, 10.7], crouch: false, drawn: true, n: [0, 1] },
    { note: 'standing, holstered, south wall', p: [19.0, 0, 11.5], crouch: false, drawn: false, n: [0, -1] },
    { note: 'crouched, pistol drawn, south wall', p: [19.6, 0, 11.5], crouch: true, drawn: true, n: [0, -1] },
    { note: 'crouched, holstered, north wall', p: [21.0, 0, 10.7], crouch: true, drawn: false, n: [0, 1] },
  ];
  for (const c of cases) {
    clearKeys(); game.teleportPlayer(v3.copy(c.p)); const pl = game.player; pl.crouch = c.crouch; pl.slot = 'pistol'; pl.holstered = !c.drawn; pl.char.bodyYaw = pl.char.aimYaw = Math.atan2(c.n[0], c.n[1]); W.step(DT);
    const rounds0 = pl.pistol.roundsReady; const shots0 = (W.audioCounts.get('pistolSuppressed') ?? 0) + (W.audioCounts.get('pistolLoud') ?? 0) + (W.audioCounts.get('dryFire') ?? 0);   // (the pistol's report voices as sfx names them — 'pistol'/'shot' never existed, which made this check vacuous: review finding)
    input.pressed.add('KeyQ'); W.step(DT);
    const fails: string[] = [];
    if (!pl.wall) { report(c.note, ['Q did not take hold'], `at (${f2(pl.char.pos[0])}, ${f2(pl.char.pos[2])})`); continue; }
    let drawnOnWall = 0;
    for (let i = 0; i < 60; i++) { W.step(DT); if (!pl.holstered) drawnOnWall++; }
    // a left click on the wall: nothing leaves the pistol (cursor out in the corridor so no takedown / fixture is under it)
    W.cursorAt([pl.char.pos[0] + c.n[0] * 3, 1.0, pl.char.pos[2] + c.n[1] * 3]); W.step(DT); input.clicked |= 1; input.buttons = 1; W.step(DT); input.buttons = 0;
    for (let i = 0; i < 20; i++) { W.step(DT); if (!pl.holstered) drawnOnWall++; }
    const S = sampleWallPose(game)!;
    fails.push(...judgeParked(S, c.crouch));
    if (drawnOnWall) fails.push(`pistol in the hand for ${drawnOnWall} frames while on the wall`);
    if (pl.pistol.roundsReady < rounds0) fails.push(`a round left the pistol on the wall (${rounds0} → ${pl.pistol.roundsReady})`);
    const shots1 = (W.audioCounts.get('pistolSuppressed') ?? 0) + (W.audioCounts.get('pistolLoud') ?? 0) + (W.audioCounts.get('dryFire') ?? 0); if (shots1 > shots0) fails.push(`the click made a gun sound (${shots1 - shots0})`);
    if (!pl.wall) fails.push('the click (or something) let go of the wall');
    if (pl.char.anim.stance !== 'wall') fails.push(`animator stance '${pl.char.anim.stance}'`);
    // off it (Q): the kit as it was, from the very frame he is free
    input.pressed.add('KeyQ'); W.step(DT);
    if (pl.wall) fails.push('Q did not let go');
    if (pl.holstered !== !c.drawn) fails.push(`came off the wall ${pl.holstered ? 'holstered' : 'drawn'} — went on ${c.drawn ? 'drawn' : 'holstered'}`);
    for (let i = 0; i < 30; i++) W.step(DT);
    if (pl.holstered !== !c.drawn) fails.push(`half a second off the wall: ${pl.holstered ? 'holstered' : 'drawn'}, expected ${c.drawn ? 'drawn' : 'holstered'}`);
    { const b = pl.char.bones; const bad: string[] = []; for (const k in b) if (!b[k].every(Number.isFinite)) bad.push(k); if (bad.length) fails.push(`NaN after release in ${bad.join(', ')}`); }
    report(`parked · ${c.note}`, fails, line(S));
  }
  // ---- sidling: take the north wall at x 20 standing (then crouched), hold D 1.5 s sampling every frame from 0.4 s on (the legs are walking by then), flip to A
  //      for 1.2 s (the turn-about), let go of the keys and sample the re-park after 0.6 s
  for (const crouch of [false, true]) {
    clearKeys(); game.teleportPlayer([20.0, 0, 10.7]); const pl = game.player; pl.crouch = crouch; pl.slot = 'pistol'; pl.holstered = false; pl.char.bodyYaw = pl.char.aimYaw = 0; W.step(DT);
    input.pressed.add('KeyQ'); W.step(DT); for (let i = 0; i < 40; i++) W.step(DT);
    const fails: string[] = []; if (!pl.wall) { report(`sidling${crouch ? ' crouched' : ''}`, ['Q did not take hold'], ''); continue; }
    let worst: WallPoseSample | null = null, worstN = 0, frames = 0, drawn = 0; const seen = new Set<string>();
    const watch = (tag: string) => { const S = sampleWallPose(game); if (!S) return; frames++; if (!pl.holstered) drawn++; const f = judgeSliding(S); for (const x of f) seen.add(`${tag}: ${x}`); if (f.length > worstN || !worst) { if (f.length >= worstN) { worst = S; worstN = f.length; } } };
    input.keys.add('KeyD'); for (let i = 0; i < 90; i++) { W.step(DT); if (i >= 24) watch('D'); }
    input.keys.delete('KeyD'); input.keys.add('KeyA'); for (let i = 0; i < 72; i++) { W.step(DT); watch('flip to A'); }
    input.keys.delete('KeyA'); for (let i = 0; i < 36; i++) W.step(DT);
    const P = sampleWallPose(game); if (P) { const f = judgeParked(P, crouch); for (const x of f) seen.add(`re-parked: ${x}`); } else fails.push('lost the wall while sidling');
    fails.push(...seen); if (drawn) fails.push(`pistol drawn for ${drawn} of ${frames} sidling frames`);
    report(`sidling east, about, west, re-park · ${crouch ? 'crouched' : 'standing'}`, fails, `worst sidling frame: ${worst ? line(worst) : '—'}\n    re-parked: ${P ? line(P) : '—'}`);
    if (pl.wall) { input.pressed.add('KeyQ'); W.step(DT); }
  }
  // ---- the peek is left as it was: parked at the manager door's west jamb pushing on, sample at full peek — only NaN / through-the-wall / holstered are judged
  {
    clearKeys(); game.teleportPlayer([24.3, 0, 10.7]); const pl = game.player; pl.crouch = false; pl.holstered = false; W.step(DT);
    input.pressed.add('KeyQ'); W.step(DT); input.keys.add('KeyD'); for (let i = 0; i < 80; i++) W.step(DT);
    const fails: string[] = []; const S = sampleWallPose(game);
    if (!S || !pl.wall) fails.push('not on the wall at the jamb'); else {
      if (pl.wall.peek < 0.95) fails.push(`peek only ${f2(pl.wall.peek)}`);
      if (S.nan.length) fails.push(`NaN in ${S.nan.join(', ')}`);
      if (S.minOff < -0.03) fails.push(`${S.minBone} ${f2(S.minOff)} m through the wall plane at full peek`);
      if (!pl.holstered) fails.push('drawn while peeking');
    }
    input.keys.delete('KeyD');
    report('peeking round the manager door\'s west jamb (pose untouched — hygiene only)', fails, S ? line(S) : '—');
    if (pl.wall) { input.pressed.add('KeyQ'); W.step(DT); }
  }
  console.log(`=== wall-pose: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

if (import.meta.main) { const ok = await wallPose({ report: process.argv.includes('--report') }); process.exit(ok ? 0 : 1); }
