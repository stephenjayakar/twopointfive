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
const { v3, m4 } = await import(`${ROOT}/src/math/vec.ts`);

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

// ---- 'wall-pose-mend' (`bun run tools/qa/probes.ts wall-pose-mend`, also under wall-pose / wall-snap / player): the hold's poses as mended (WALLSNAP.pose, on with the feel
//      pass; character.ts WALL_POSE.mend / .gait). The maintainer, 10-12: "snapped to wall animations could also use some work, looks weird when crouched in particular". What was
//      wrong, off the bones: crouched and parked the upper arms stood 47‥52° out from his sides with the elbows 0.81 m apart (a man holding two buckets), and the crouched sidle was
//      the crouch walk cycle turned 55°: a knee to 12 cm off the floor every stride, a shin laid flat, the feet sliding under him; standing it was the walk cycle turned the same way, the legs crossing
//      over each other along the plaster. Mended: the arms hang beside the hips, and the sidle, standing and crouched, is a side step of the hold's own — each foot on its own
//      track along the wall, planted while it bears, the lead foot reaching and the other closing up to it, never past it — that sets off, stops and turns round without a foot
//      or the trunk jumping. Asked with the feel pass raised here (so it passes on both stands), each line with the mend ON and, where the fault was, with it OFF (the fault
//      must still be there: the switch is real). `WALLPOSE_BREAK=1` = the ON lines asked with the mend off: must fail.
export async function wallPoseMend() {
  console.log('\n=== wall-pose-mend: the hold\'s mended poses — arms beside the hips, the sidle a side step on its own tracks that never crosses its feet; the mend off = the poses as they were ===');
  const { WALLSNAP } = await import(`${ROOT}/src/game/wallsnap.ts`);
  Math.random = seeded(93);
  const W = await standUp(); const { game, input } = W;
  game.playerInvisible = true; game.godMode = true; game.aiEnabled = false; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  game.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.vel = [0, 0, 0]; gd.path = []; gd.pathGoal = null; gd.char.update(0); });
  const was = { on: WALLSNAP.on, pose: WALLSNAP.pose }; WALLSNAP.on = true;
  const brk = !!process.env.WALLPOSE_BREAK;
  let allPass = true;
  const report = (name: string, fails: string[], extra: string) => { const pass = fails.length === 0; allPass &&= pass; console.log(`- ${pass ? 'PASS' : 'FAIL'} — ${name}\n    ${extra}${fails.length ? '\n    ✗ ' + fails.join('\n    ✗ ') : ''}`); };
  const ang = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, v3.dot(a, b) / ((v3.len(a) * v3.len(b)) || 1)))) / DEG;
  type Arms = { upL: number; upR: number; flexL: number; flexR: number; elbows: number; handY: number };
  const arms = (b: Record<string, Vec3>): Arms => ({
    upL: ang(v3.sub(b.forearmL, b.upperArmL), [0, -1, 0]), upR: ang(v3.sub(b.forearmR, b.upperArmR), [0, -1, 0]),
    flexL: ang(v3.sub(b.forearmL, b.upperArmL), v3.sub(b.handL, b.forearmL)), flexR: ang(v3.sub(b.forearmR, b.upperArmR), v3.sub(b.handR, b.forearmR)),
    elbows: v3.dist(b.forearmL, b.forearmR), handY: (b.handL[1] + b.handR[1]) / 2 });
  const armLine = (A: Arms) => `upper arm off his side L ${f1(A.upL)}° R ${f1(A.upR)}° · elbow bent L ${f1(A.flexL)}° R ${f1(A.flexR)}° · elbows ${f2(A.elbows)} m apart · hands at ${f2(A.handY)}`;
  type Run = { parked: Arms; parkedPose: WallPoseSample; kneeMin: number; headMax: number; headMin: number; hipsPP: number; travel: [number, number]; stepMax: number; track: [[number, number], [number, number]]; armsWorst: Arms; gapMin: number; slide: string[]; nan: boolean; fan: [number, number]; tipOff: number };
  // one take of the north corridor wall: park 1.5 s, sidle `key` 3 s (sampled from 0.8 s on; the other way after a sidle out to make room); `gapMin` = the least the lead foot was ahead of the other along the wall, from the set-off on (under 0 = they crossed)
  const take = (crouch: boolean, pose: boolean, key: 'KeyD' | 'KeyA'): Run | null => {
    WALLSNAP.pose = pose;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) input.keys.delete(k); input.buttons = 0;
    game.teleportPlayer([20.0, 0, 10.7]); const pl = game.player; pl.crouch = crouch; pl.slot = 'pistol'; pl.holstered = true; pl.char.bodyYaw = pl.char.aimYaw = 0; W.step(DT);
    input.pressed.add('KeyQ'); W.step(DT); for (let i = 0; i < 90; i++) W.step(DT);
    if (!pl.wall) return null;
    const b = pl.char.bones as Record<string, Vec3>; const parked = arms(b), parkedPose = sampleWallPose(game)!;
    // the HANDS as they lie on the wall: how far the fingers fan (the index and little fingers' last joints apart, over their knuckles apart, per hand: 1 = side by side, over 1 = fanned open) and how deep the deepest fingertip joint is past the wall's plane
    const fan: [number, number] = [0, 0]; let tipOff = 9;
    { const ch = pl.char as any, fg: number[][][] = ch.anim.fingers, wpos = (nd: number): Vec3 => m4.transformPoint(ch.world, ch.skel.nodePos(nd)), w = pl.wall;
      for (const sd of [0, 1]) { const ix = fg[sd][0], lt = fg[sd][3]; fan[sd] = v3.dist(wpos(ix[2]), wpos(lt[2])) / (v3.dist(wpos(ix[0]), wpos(lt[0])) || 1);
        // every digit, the thumb too: its last joint and the tip beyond it (the last bone carried on 0.8 of the one before)
        for (const f of [...fg[sd], ch.anim.thumbs[sd]]) { const a = wpos(f[1]), q = wpos(f[2]), tp: Vec3 = [q[0] + (q[0] - a[0]) * 0.8, q[1], q[2] + (q[2] - a[2]) * 0.8];
          for (const x of [q, tp]) tipOff = Math.min(tipOff, x[0] * w.n[0] + x[2] * w.n[2] - w.d); } } }
    const R: Run = { fan, tipOff, parked, parkedPose, kneeMin: 9, headMax: 0, headMin: 9, hipsPP: 0, travel: [0, 0], stepMax: 0, track: [[9, -9], [9, -9]], armsWorst: parked, gapMin: 9, slide: [], nan: false };
    if (key === 'KeyA') { input.keys.add('KeyD'); for (let i = 0; i < 170; i++) W.step(DT); input.keys.delete('KeyD'); for (let i = 0; i < 30; i++) W.step(DT); }   // room behind him: the run of wall ends a few metres that way
    (pl.char.anim as any).phase = 0;   // the stride clock from the same place every take (a take is compared with its twin, the mend off)
    input.keys.add(key); let prev: { L: number; R: number; fL: number; fR: number } | null = null; let hMin = 9, hMax = 0, worst = -1; const DUTY = 0.6;
    for (let i = 0; i < 180; i++) {
      W.step(DT); const w = pl.wall; if (!w) { R.nan = true; break; }
      const t: Vec3 = w.along, n: Vec3 = w.n; const al = (p: Vec3) => p[0] * t[0] + p[2] * t[2], off = (p: Vec3) => p[0] * n[0] + p[2] * n[2] - w.d;
      const g: number = (pl.char.anim as any).wallGait ?? 0; const cur = { L: al(b.footL), R: al(b.footR), fL: g % 1, fR: (g + 0.5) % 1 };
      for (const k in b) if (!b[k].every(Number.isFinite)) R.nan = true;
      { const sg = Math.sign(al(b.thighR) - al(b.thighL)) || 1; R.gapMin = Math.min(R.gapMin, sg * (al(b.footR) - al(b.footL))); }
      if (i >= 48) {
        if (prev) {   // a foot's travel along the wall while the hold's own gait clock has it bearing (the clock is the mend's: with the mend off this is not read)
          if (cur.fL < DUTY && prev.fL < DUTY && cur.fL > prev.fL - 0.5 && cur.fL < prev.fL + 0.5) { const d = Math.abs(cur.L - prev.L); R.travel[0] += d; R.stepMax = Math.max(R.stepMax, d); }
          if (cur.fR < DUTY && prev.fR < DUTY && cur.fR > prev.fR - 0.5 && cur.fR < prev.fR + 0.5) { const d = Math.abs(cur.R - prev.R); R.travel[1] += d; R.stepMax = Math.max(R.stepMax, d); }
        }
        R.kneeMin = Math.min(R.kneeMin, b.shinL[1], b.shinR[1]); R.headMax = Math.max(R.headMax, b.head[1]); R.headMin = Math.min(R.headMin, b.head[1]);
        hMin = Math.min(hMin, b.hips[1]); hMax = Math.max(hMax, b.hips[1]);
        R.track[0] = [Math.min(R.track[0][0], off(b.footL)), Math.max(R.track[0][1], off(b.footL))]; R.track[1] = [Math.min(R.track[1][0], off(b.footR)), Math.max(R.track[1][1], off(b.footR))];
        const A = arms(b), bad = Math.max(A.upL, A.upR); if (bad > worst) { worst = bad; R.armsWorst = A; }
        const S = sampleWallPose(game); if (S) for (const x of judgeSliding(S)) if (!R.slide.includes(x)) R.slide.push(x);
      }
      prev = cur;
    }
    R.hipsPP = hMax - hMin; input.keys.delete(key); for (let i = 0; i < 40; i++) W.step(DT);
    if (pl.wall) { input.pressed.add('KeyQ'); W.step(DT); } for (let i = 0; i < 30; i++) W.step(DT);
    return R;
  };
  const handLine = (r: Run) => `fingers fanned L ×${f2(r.fan[0])} R ×${f2(r.fan[1])} · deepest fingertip or thumb tip ${(r.tipOff * 100).toFixed(1)} cm off the wall's plane (under 0 = in the plaster)`;
  // the hands on the wall (the maintainer's still of the standing hold: two fanned gloves out at his hips): fingers side by side, no fingertip joint in the plaster; the mend off = the fanned hand
  const judgeHands = (a: Run, o: Run): string[] => { const f: string[] = [];
    if (a.fan[0] > 1.1 || a.fan[1] > 1.1) f.push(`fingers fanned ×${f2(a.fan[0])} / ×${f2(a.fan[1])} (want ≤ ×1.10: side by side; they were ×1.31)`);
    if (a.fan[0] < 0.85 || a.fan[1] < 0.85) f.push(`fingers pinched together ×${f2(a.fan[0])} / ×${f2(a.fan[1])} (want ≥ ×0.85)`);
    if (a.tipOff < 0.005) f.push(`a fingertip or the thumb's tip ${(a.tipOff * 100).toFixed(1)} cm off the wall's plane (want ≥ 0.5 cm on the room's side; the thumb's was ${(o.tipOff * 100).toFixed(1)}: in the plaster)`);
    if (!(o.fan[0] > 1.2 && o.fan[1] > 1.2)) f.push(`with the mend off the hands are not the old fanned ones (×${f2(o.fan[0])} / ×${f2(o.fan[1])})`);
    return f; };
  const ON = !brk;
  // (1) crouched, parked: the arms hang beside the hips
  {
    const a = take(true, ON, 'KeyD'), o = take(true, false, 'KeyD'); const f: string[] = [];
    if (!a || !o) f.push('Q did not take hold'); else {
      if (a.parked.upL > 32 || a.parked.upR > 32) f.push(`an upper arm ${f1(Math.max(a.parked.upL, a.parked.upR))}° out from his side (want ≤ 32; it was 47‥52)`);
      if (a.parked.elbows > 0.68) f.push(`elbows ${f2(a.parked.elbows)} m apart (want ≤ 0.68; it was 0.81)`);
      f.push(...judgeHands(a, o));
      if (a.parked.flexL > 55 || a.parked.flexR > 55) f.push(`an elbow bent ${f1(Math.max(a.parked.flexL, a.parked.flexR))}° (want ≤ 55; it was 75‥78)`);
      f.push(...judgeParked(a.parkedPose, true).map(x => `the hold's own bars: ${x}`));
      if (!(o.parked.upL > 40 && o.parked.upR > 40 && o.parked.elbows > 0.74)) f.push(`with the mend off the arms are not the old ones (${armLine(o.parked)}): the switch does not put the pose back`);
    }
    report('crouched and parked: the arms beside the hips; the mend off = out from his sides as before', f, a && o ? `mended: ${armLine(a.parked)} · ${handLine(a)}\n    as it was: ${armLine(o.parked)} · ${handLine(o)}` : '—');
  }
  // (2) standing, parked: a little closer in, never wider than it was
  {
    const a = take(false, ON, 'KeyD'), o = take(false, false, 'KeyD'); const f: string[] = [];
    if (!a || !o) f.push('Q did not take hold'); else {
      if (a.parked.elbows > 0.58) f.push(`elbows ${f2(a.parked.elbows)} m apart standing (want ≤ 0.58; it was 0.62)`);
      if (a.parked.flexL > 40 || a.parked.flexR > 40) f.push(`an elbow bent ${f1(Math.max(a.parked.flexL, a.parked.flexR))}° standing (want ≤ 40)`);
      f.push(...judgeHands(a, o));
      f.push(...judgeParked(a.parkedPose, false).map(x => `the hold's own bars: ${x}`));
      if (a.armsWorst.flexL < 12 && a.armsWorst.flexR < 12) f.push(`both arms dead straight in the standing sidle (${f1(a.armsWorst.flexL)}° / ${f1(a.armsWorst.flexR)}°)`);
    }
    report('standing and parked: the arms hang, never wider than they were', f, a && o ? `mended: ${armLine(a.parked)} · ${handLine(a)}\n    as it was: ${armLine(o.parked)} · ${handLine(o)}` : '—');
  }
  // (3) sidling either way, crouched and standing: the bearing foot planted, each foot on its own track, the feet never past each other, the head no higher than it rode;
  //     crouched, no knee to the floor
  for (const crouch of [true, false]) for (const key of ['KeyD', 'KeyA'] as const) {
    const a = take(crouch, ON, key), o = take(crouch, false, key); const f: string[] = [];
    if (!a || !o) f.push('Q did not take hold'); else {
      if (a.nan) f.push('lost the wall or a NaN while sidling');
      if (crouch && a.kneeMin < 0.2) f.push(`a knee ${f2(a.kneeMin)} m off the floor (want ≥ 0.20; it was 0.12‥0.16: a kneel every stride)`);
      if (a.travel[0] > 0.1 || a.travel[1] > 0.1) f.push(`a bearing foot slid ${f2(Math.max(...a.travel))} m along the wall in 2.2 s (want ≤ 0.10: only the roll onto its ball)`);
      if (a.stepMax > 0.008) f.push(`a bearing foot moved ${(a.stepMax * 1000).toFixed(1)} mm in one frame (want ≤ 8)`);
      for (const [i, tr] of a.track.entries()) if (tr[1] - tr[0] > 0.06) f.push(`${i ? 'right' : 'left'} foot wandered ${f2(tr[1] - tr[0])} m toward and from the wall (want ≤ 0.06: a track of its own)`);
      if (Math.abs((a.track[0][0] + a.track[0][1]) / 2 - (a.track[1][0] + a.track[1][1]) / 2) < 0.1) f.push('the two feet share a track (want ≥ 0.10 m between them)');
      if (Math.min(a.track[0][0], a.track[1][0]) < 0.1) f.push(`a foot ${f2(Math.min(a.track[0][0], a.track[1][0]))} m off the wall plane (want ≥ 0.10: not in the plaster)`);
      if (a.gapMin < 0.02) f.push(`the lead foot was ${f2(a.gapMin)} m ahead of the other at their closest (want ≥ 0.02: a side step closes up, it never crosses)`);
      if (a.headMax > o.headMax + 0.01) f.push(`the head rides ${f2(a.headMax)} m, higher than the ${f2(o.headMax)} it rode (sight reads his head: no more of him over low cover)`);
      if (a.hipsPP > 0.04) f.push(`the hips bob ${f2(a.hipsPP)} m (want ≤ 0.04)`);
      if (a.armsWorst.upL > 38 || a.armsWorst.upR > 38) f.push(`an upper arm ${f1(Math.max(a.armsWorst.upL, a.armsWorst.upR))}° out sidling (want ≤ 38; crouched it was 39‥57)`);
      if (!crouch && a.armsWorst.flexL < 12 && a.armsWorst.flexR < 12) f.push(`both arms dead straight in the standing sidle (${f1(a.armsWorst.flexL)}° / ${f1(a.armsWorst.flexR)}°)`);
      f.push(...a.slide.map(x => `the hold's own bars: ${x}`));
      if (crouch && !(o.kneeMin < 0.2)) f.push(`with the mend off the knee is ${f2(o.kneeMin)} m up: the old cycle is not back`);
      if (!(o.gapMin < 0)) f.push(`with the mend off the feet do not cross (${f2(o.gapMin)} m): the old cycle is not back`);
    }
    report(`${crouch ? 'crouched' : 'standing'} sidle ${key === 'KeyD' ? 'one way' : 'the other way'}: a side step on its own tracks, the feet never crossing; the mend off = the turned ${crouch ? 'crouch' : 'walk'} cycle`, f,
      a && o ? `mended: knee ≥ ${f2(a.kneeMin)} · bearing foot travel ${f2(a.travel[0])} / ${f2(a.travel[1])} m (≤ ${(a.stepMax * 1000).toFixed(1)} mm a frame) · tracks ${f2(a.track[0][0])}‥${f2(a.track[0][1])} and ${f2(a.track[1][0])}‥${f2(a.track[1][1])} m off the wall · feet closest ${f2(a.gapMin)} m · head ${f2(a.headMin)}‥${f2(a.headMax)} · hips bob ${f2(a.hipsPP)} · worst ${armLine(a.armsWorst)}\n    as it was: knee ≥ ${f2(o.kneeMin)} · feet closest ${f2(o.gapMin)} m (under 0 = crossed) · head ${f2(o.headMin)}‥${f2(o.headMax)} · hips bob ${f2(o.hipsPP)} · worst ${armLine(o.armsWorst)}` : '—');
  }
  // (4) setting off, stopping at five places in the stride, back the other way, turned round mid-stride, stopped again: no foot POPS (the change of a foot's step from one
  //     frame to the next — a stride's own swing is ~2 cm of it, a foot put somewhere else in one frame is the whole jump) and neither the hips, the head nor a hand jumps
  //     against the body's own travel. The turned clips re-seat a foot by 14‥43 cm when he turns round.
  const trans = (crouch: boolean, pose: boolean, stopAt: number): { pop: number; popAt: string; jump: number; jumpAt: string; lost: boolean } => {
    WALLSNAP.pose = pose;
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'Space']) input.keys.delete(k); input.buttons = 0;
    game.teleportPlayer([20.0, 0, 10.7]); const pl = game.player; pl.crouch = crouch; pl.slot = 'pistol'; pl.holstered = true; pl.char.bodyYaw = pl.char.aimYaw = 0; W.step(DT);
    input.pressed.add('KeyQ'); W.step(DT); for (let i = 0; i < 90; i++) W.step(DT);
    const b = pl.char.bones as Record<string, Vec3>; const KEYS = ['footL', 'footR', 'hips', 'head', 'handL', 'handR'];
    type Fr = { pos: Vec3 } & Record<string, Vec3>; let p1: Fr | null = null, p2: Fr | null = null; const T = { pop: 0, popAt: '', jump: 0, jumpAt: '', lost: !pl.wall };
    const seg = (name: string, n: number, keys: string[]) => {
      for (const k of ['KeyA', 'KeyD']) input.keys.delete(k); for (const k of keys) input.keys.add(k);
      for (let i = 0; i < n; i++) {
        W.step(DT); const cur = { pos: [...pl.char.pos] } as Fr; for (const k of KEYS) cur[k] = [...b[k]] as Vec3;
        if (p1 && p2) for (const k of ['footL', 'footR']) { const d = Math.hypot(cur[k][0] - 2 * p1[k][0] + p2[k][0], cur[k][1] - 2 * p1[k][1] + p2[k][1], cur[k][2] - 2 * p1[k][2] + p2[k][2]); if (d > T.pop) { T.pop = d; T.popAt = `${k} ${name}+${i}`; } }
        if (p1) { const bx = cur.pos[0] - p1.pos[0], bz = cur.pos[2] - p1.pos[2]; for (const k of ['hips', 'head', 'handL', 'handR']) { const d = Math.hypot(cur[k][0] - p1[k][0] - bx, cur[k][1] - p1[k][1], cur[k][2] - p1[k][2] - bz); if (d > T.jump) { T.jump = d; T.jumpAt = `${k} ${name}+${i}`; } } }
        p2 = p1; p1 = cur;
      }
    };
    seg('set off', stopAt, ['KeyD']); seg('stop', 45, []); seg('back', 50 + stopAt % 7, ['KeyA']); seg('turn round', 50, ['KeyD']); seg('stop again', 45, []);
    T.lost ||= !pl.wall; for (const k of ['KeyA', 'KeyD']) input.keys.delete(k);
    if (pl.wall) { input.pressed.add('KeyQ'); W.step(DT); } for (let i = 0; i < 30; i++) W.step(DT);
    return T;
  };
  for (const crouch of [true, false]) {
    const f: string[] = []; let pop = 0, popAt = '', jump = 0, jumpAt = '', oPop = 0, oJump = 0;
    for (const stopAt of [31, 37, 43, 49, 55]) {
      const a = trans(crouch, ON, stopAt), o = trans(crouch, false, stopAt);
      if (a.lost) f.push(`lost the wall (stop after ${stopAt} frames)`);
      if (a.pop > pop) { pop = a.pop; popAt = `${a.popAt}, stopped after ${stopAt} frames`; } if (a.jump > jump) { jump = a.jump; jumpAt = `${a.jumpAt}, stopped after ${stopAt} frames`; }
      oPop = Math.max(oPop, o.pop); oJump = Math.max(oJump, o.jump);
    }
    if (pop > 0.05) f.push(`a foot popped ${(pop * 100).toFixed(1)} cm in a frame (${popAt}; want ≤ 5: a swing's own change of step is ~2‥3.5)`);
    if (jump > 0.04) f.push(`${jumpAt.split(' ')[0]} jumped ${(jump * 100).toFixed(1)} cm in a frame against the body's travel (${jumpAt}; want ≤ 4)`);
    if (!(oPop > 0.12)) f.push(`with the mend off the worst foot pop is ${(oPop * 100).toFixed(1)} cm: the old turn-round is not back`);
    report(`${crouch ? 'crouched' : 'standing'}: set off, stop at five places in the stride, back, turn round mid-stride, stop — no foot pops, the trunk does not jump`, f,
      `mended: worst foot pop ${(pop * 100).toFixed(1)} cm (${popAt}) · worst hips / head / hand jump ${(jump * 100).toFixed(1)} cm (${jumpAt})\n    as it was: worst foot pop ${(oPop * 100).toFixed(1)} cm · worst jump ${(oJump * 100).toFixed(1)} cm`);
  }
  WALLSNAP.on = was.on; WALLSNAP.pose = was.pose;
  console.log(`=== wall-pose-mend: ${allPass ? 'ALL PASS' : 'FAILURES above'} ===`);
  return allPass;
}

if (import.meta.main) { const ok = (await wallPose({ report: process.argv.includes('--report') })) && (process.argv.includes('--mend') ? await wallPoseMend() : true); process.exit(ok ? 0 : 1); }
