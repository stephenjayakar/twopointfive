// The gait lab, folded into the viewer (it was /gait, src/gaitlab.ts): every 'to taste' constant of the animation's naturalism pass as a knob over the
// very objects character.ts reads each frame (LIFE / FEET / GAZE / GAZE_EL / BOB / BLEND / RUN_WARP / SPRINT_WARP / RUN_LINGER / SNEAK / the natural clip
// speeds), the 'all tweaks off' identity values for an instant before / after, the live gait numbers measured off the figure the way tools/qa/gait.ts
// measures them (planted-foot slip, cadence, stance share, pelvis bob, eye line), the 25 cm floor marks, and 'copy constants' → the paste-able block for
// character.ts (byte-for-byte the block the stand-alone lab emitted).
import { Vec3, v3, quat, clamp } from '../math/vec';
import { Pose, PoseFK, restPose, sampleClip } from '../anim/skeleton';
import { GltfCharacter } from '../anim/gltf';
import { Character, defaultAnimParams, BLEND, BOB, RUN_WARP, SPRINT_WARP, RUN_LINGER, GAZE, GAZE_EL, LIFE, FEET, SNEAK, SOFT_KNEE } from '../game/character';
import { Box, BoxFlag, makeBox } from '../scene/boxes';

const R2D = 180 / Math.PI;
const AP = defaultAnimParams as unknown as Record<string, number>;
const RL = RUN_LINGER as unknown as Record<string, number>;
const SN = SNEAK as unknown as Record<string, number>;

/** every tunable the lab turns: the live object, its key, the row's label and range; `slider` = a bounded weight / angle (a slider is honest there),
 *  otherwise a scrub field */
export interface Knob { o: Record<string, number>; k: string; label: string; min: number; max: number; step: number; tip?: string; slider?: boolean }
export interface KnobGroup { id: string; name: string; open: boolean; knobs: Knob[] }
export const GAIT_GROUPS: KnobGroup[] = [
  { id: 'gait.clips', name: 'Clip speeds (natural, m/s at rate 1)', open: false, knobs: [
    { o: AP, k: 'walkSpeed', label: 'walk', min: 0.6, max: 2.5, step: 0.01, tip: 'measured 1.06: the planted toe stays put at this ground speed' },
    { o: AP, k: 'crouchSpeed', label: 'crouch', min: 0.4, max: 1.6, step: 0.01, tip: 'measured 0.72' },
    { o: AP, k: 'jogSpeed', label: 'jog', min: 2, max: 6, step: 0.05 },
    { o: AP, k: 'sprintSpeed', label: 'sprint', min: 3, max: 9, step: 0.05 },
  ] },
  { id: 'gait.blend', name: 'Gait blend (m/s)', open: false, knobs: [
    { o: BLEND, k: 'walkIn0', label: 'walk in from', min: 0, max: 0.6, step: 0.01 }, { o: BLEND, k: 'walkIn1', label: 'walk full by', min: 0.1, max: 1.2, step: 0.01 },
    { o: BLEND, k: 'walkTop', label: 'walk only up to', min: 1, max: 2.6, step: 0.05 }, { o: BLEND, k: 'jogAt', label: 'full jog at', min: 1.8, max: 3.5, step: 0.05 },
  ] },
  { id: 'gait.gaze', name: 'Head: gaze stabiliser', open: true, knobs: [
    { o: GAZE, k: 'keep', label: 'pitch keep', min: 0, max: 1, step: 0.02, tip: 'share of the eye-line error taken out (0 = the clip’s own head)', slider: true },
    { o: GAZE, k: 'yawDamp', label: 'yaw wobble damp', min: 0, max: 1, step: 0.02, slider: true },
    { o: GAZE_EL, k: 'stand', label: 'eye line ° down: walk', min: -10, max: 30, step: 0.5 }, { o: GAZE_EL, k: 'crouch', label: '… crouch', min: -10, max: 40, step: 0.5 }, { o: GAZE_EL, k: 'sprint', label: '… sprint', min: -10, max: 40, step: 0.5 },
  ] },
  { id: 'gait.run', name: 'Run: bounce, stride warps, linger', open: true, knobs: [
    { o: BOB, k: 'keep', label: 'run bounce keep', min: 0, max: 1, step: 0.02, tip: 'share of the run clip’s 23 cm pelvis bounce kept (1 = as authored)', slider: true },
    { o: RUN_WARP, k: 'stride', label: 'jog stride ×', min: 0.4, max: 1, step: 0.01, tip: 'feet travel this fraction of the clip’s excursion; cadence rises by 1/×', slider: true },
    { o: SPRINT_WARP, k: 'stride', label: 'sprint stride ×', min: 0.4, max: 1, step: 0.01, slider: true },
    { o: RL, k: 'depth', label: 'stance linger', min: 0, max: 0.8, step: 0.01, tip: '0 = off — the whole run correction: the re-timing AND the stance-foot pin (the run cycle as it was); above 0 the pin is on in full and this sets how deep the cycle dwells over each plant and hurries the flight (same period)', slider: true },
    { o: RL, k: 'bleed', label: 'toe-off bleed s', min: 0.02, max: 0.4, step: 0.01 },
  ] },
  { id: 'gait.life', name: 'Standing: breathing, mass, weight shift', open: true, knobs: [
    { o: LIFE, k: 'on', label: 'life layer ×', min: 0, max: 1.5, step: 0.05, tip: '0 = off (the pose as the clips have it)', slider: true },
    { o: LIFE, k: 'breathRate', label: 'breath Hz (rest)', min: 0.1, max: 0.6, step: 0.01 }, { o: LIFE, k: 'breathRateRun', label: 'breath Hz (winded)', min: 0.2, max: 1.2, step: 0.01 },
    { o: LIFE, k: 'breathAmp', label: 'breath depth (rest)', min: 0, max: 4, step: 0.1 }, { o: LIFE, k: 'breathAmpRun', label: 'breath depth (winded)', min: 0, max: 6, step: 0.1 },
    { o: LIFE, k: 'massGain', label: 'pelvis lag m per m/s²', min: 0, max: 0.03, step: 0.001 }, { o: LIFE, k: 'massBack', label: '… max back m', min: 0, max: 0.1, step: 0.005 }, { o: LIFE, k: 'massFwd', label: '… max carry m', min: 0, max: 0.1, step: 0.005 },
    { o: LIFE, k: 'massDip', label: 'dip m per m/s²', min: 0, max: 0.015, step: 0.0005 }, { o: LIFE, k: 'tipGain', label: 'trunk tip ° per m/s²', min: 0, max: 3, step: 0.05 },
    { o: LIFE, k: 'restAfter', label: 'shift after s still', min: 0.2, max: 6, step: 0.1 }, { o: LIFE, k: 'shiftMin', label: 'shift period min s', min: 1, max: 15, step: 0.5 }, { o: LIFE, k: 'shiftSpan', label: '… + up to s', min: 0, max: 15, step: 0.5 },
    { o: LIFE, k: 'shiftTravel', label: 'shift travel m', min: 0, max: 0.08, step: 0.002 }, { o: LIFE, k: 'hipDrop', label: 'hip drop °', min: 0, max: 6, step: 0.1 }, { o: LIFE, k: 'spineCounter', label: 'spine counter °', min: 0, max: 4, step: 0.1 },
  ] },
  { id: 'gait.feet', name: 'Standing: planted feet, step-across', open: false, knobs: [
    { o: FEET, k: 'on', label: 'foot lock (0/1)', min: 0, max: 1, step: 1, slider: true },
    { o: FEET, k: 'swing', label: 'step time s', min: 0.1, max: 0.5, step: 0.01 }, { o: FEET, k: 'lift', label: 'step arc m', min: 0, max: 0.12, step: 0.005 },
    { o: FEET, k: 'dist', label: 're-step at m', min: 0.04, max: 0.3, step: 0.01 }, { o: FEET, k: 'turnDeg', label: 're-step at °', min: 8, max: 60, step: 1 },
    { o: FEET, k: 'pivot', label: 'sole pivot rad/s', min: 0, max: 6, step: 0.1 }, { o: FEET, k: 'lagCapDeg', label: 'max lag °', min: 20, max: 120, step: 1 },
  ] },
  { id: 'gait.sneak', name: 'Crouch walk (deliberate / sneak)', open: false, knobs: [
    { o: SN, k: 'stride', label: 'stride +', min: 0, max: 0.6, step: 0.01 }, { o: SN, k: 'linger', label: 'linger', min: 0, max: 0.4, step: 0.01 },
    { o: SN, k: 'surge', label: 'surge', min: 0, max: 1.2, step: 0.02 }, { o: SN, k: 'drop', label: 'pelvis drop m', min: 0, max: 0.12, step: 0.005 },
    { o: SN, k: 'lean', label: 'lean °', min: 0, max: 15, step: 0.5 },
  ] },
];
/** the run's soft knee (character.ts SOFT_KNEE) — not part of the lab's paste block (that stays byte-compatible); it copies as its own line */
export const SOFT_KNEE_GROUP: KnobGroup = { id: 'gait.softknee', name: 'Run: soft knee (push-off leg)', open: false, knobs: [
  { o: SOFT_KNEE, k: 'on', label: 'soft knee (0/1)', min: 0, max: 1, step: 1, slider: true },
  { o: SOFT_KNEE, k: 'from', label: 'ease from × leg', min: 0.85, max: 1, step: 0.005 }, { o: SOFT_KNEE, k: 'to', label: '… toward × leg', min: 0.9, max: 1, step: 0.005 },
] };
export const ALL_GAIT_GROUPS = [...GAIT_GROUPS, SOFT_KNEE_GROUP];
export const DEFAULTS = new Map<Knob, number>(); for (const g of ALL_GAIT_GROUPS) for (const k of g.knobs) DEFAULTS.set(k, k.o[k.k]);
/** 'all tweaks off': the values that make each layer the identity (the animator before the pass, near enough), for an instant before/after */
const NEUTRAL: [Record<string, number>, string, number][] = [
  [GAZE, 'keep', 0], [GAZE, 'yawDamp', 0], [BOB, 'keep', 1], [RUN_WARP, 'stride', 1], [SPRINT_WARP, 'stride', 1], [RL, 'depth', 0],   // (depth 0 = the re-timing and the stance pin both off: character.ts RUN_LINGER)
  [SOFT_KNEE as unknown as Record<string, number>, 'on', 0],   // the run's soft knee is its own layer (not in the paste block, its own copy line) — off with the rest, or the before/after keeps a re-solved push-off leg
  [LIFE, 'on', 0], [FEET, 'on', 0], [AP, 'walkSpeed', 1.45], [AP, 'crouchSpeed', 1.05],
];   // (WALK_PHASE, the walk clip's +0.22 phase alignment to the jog, is a bare constant and stays on: it moves no foot along the floor, only which walk frame blends with which jog frame)
const savedNeutral = new Map<string, number>();
/** flip every layer to its identity value (true) or back to what it was (false); the caller re-reads defaultAnimParams into the figure */
export function setAllOff(on: boolean) {
  NEUTRAL.forEach(([o, k, nv], i) => { const key = k + '@' + i; if (on) { savedNeutral.set(key, o[k]); o[k] = nv; } else if (savedNeutral.has(key)) o[k] = savedNeutral.get(key)!; });
  if (!on) savedNeutral.clear();
}
export function resetGaitGroup(g: KnobGroup) { for (const k of g.knobs) k.o[k.k] = DEFAULTS.get(k)!; }
export function gaitGroupChanged(g: KnobGroup) { return g.knobs.some(k => Math.abs(k.o[k.k] - DEFAULTS.get(k)!) > 1e-9); }
/** any knob of the paste block off its default */
export function gaitChanged() { return GAIT_GROUPS.some(gaitGroupChanged); }
/** the paste-able block for src/game/character.ts — exactly what the stand-alone lab emitted */
export function gaitSource(): string {
  const f = (o: object) => JSON.stringify(o, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v).replace(/"([a-zA-Z0-9_]+)":/g, '$1: ').replace(/,/g, ', ');
  return [
    `// gait lab, ${new Date().toISOString().slice(0, 16)} — paste over the matching lines in src/game/character.ts`,
    `export const defaultAnimParams: AnimParams = ${f(defaultAnimParams)};`,
    `export const BLEND = ${f(BLEND)};`, `export const BOB = ${f(BOB)};`, `export const RUN_WARP = ${f(RUN_WARP)};`, `export const SPRINT_WARP = ${f(SPRINT_WARP)};`,
    `export const RUN_LINGER = ${f(RUN_LINGER)};`, `export const GAZE_EL = ${f(GAZE_EL)}; export const GAZE = ${f(GAZE)};`,
    `export const LIFE = ${f(LIFE)};`, `export const FEET = ${f(FEET)};`,
    `// SNEAK (crouch): stride ${SNEAK.stride}, linger ${SNEAK.linger}, surge ${SNEAK.surge}, drop ${SNEAK.drop}, lean ${SNEAK.lean}`,
  ].join('\n');
}
export function softKneeSource(): string { return `export const SOFT_KNEE = { on: ${SOFT_KNEE.on}, from: ${+SOFT_KNEE.from.toFixed(4)}, to: ${+SOFT_KNEE.to.toFixed(4)} };   // src/game/character.ts`; }

/** thin strips every 25 cm across the walking direction (about the stage centre, ±3 m), so a planted foot can be judged against the floor by eye */
export function floorMarks(center: Vec3): Box[] {
  const marks: Box[] = [];
  for (let i = -12; i <= 12; i++) marks.push(makeBox({ c: [center[0], 0.002, center[2] + i * 0.25], h: [1.6, 0.002, i % 4 === 0 ? 0.012 : 0.005], albedo: i % 4 === 0 ? [0.55, 0.6, 0.55] : [0.32, 0.36, 0.34], flags: BoxFlag.NoShadow }));
  return marks;
}

/** Live gait numbers over the last 3 s (the tools/qa/gait.ts detector, running on the figure in front of you). */
export class GaitMeter {
  slip = 0; cadence = 0; stance = 0; bob = 0; gaze = 0; gazeBob = 0;
  private samples: { t: number; toeL: Vec3; toeR: Vec3; hipsY: number; gaze: number; phase: number }[] = []; private wraps: number[] = []; private lastPhase = 0;
  private headI: number; private gazeLocal: Vec3;
  constructor(ch: GltfCharacter) {
    this.headI = ch.nodeByName.get('DEF-head') ?? -1;
    const pz = restPose(ch, new Pose(ch.nodes.length)); const idle = ch.clips.get('Idle_Loop'); if (idle) sampleClip(idle, 0, false, pz); const fk = new PoseFK(ch).run(pz);
    this.gazeLocal = this.headI >= 0 ? quat.rotate(quat.conj(fk.rot[this.headI]), [0, 0, 1]) : [0, 0, 1];   // the head's level look in the standing idle = 0° (as tools/qa/gait.ts)
  }
  reset() { this.samples.length = 0; this.wraps.length = 0; this.slip = this.cadence = this.stance = this.bob = this.gaze = this.gazeBob = 0; }
  /** one sample after char.update(); `ground` = the floor's velocity under him (treadmill: −speed along his travel; real paths: null = still) */
  sample(char: Character, simT: number, ground: Vec3 | null) {
    const b = char.bones; if (!b.toeL || !b.toeR || !b.hips) return;
    let gz = 0;
    if (this.headI >= 0) { const g = quat.rotate(char.skel.globalRot[this.headI], this.gazeLocal); gz = Math.asin(clamp(g[1], -1, 1)) * R2D; }
    this.samples.push({ t: simT, toeL: v3.copy(b.toeL), toeR: v3.copy(b.toeR), hipsY: b.hips[1], gaze: gz, phase: char.anim.phase });
    if (char.anim.phase < this.lastPhase - 0.5) this.wraps.push(simT); this.lastPhase = char.anim.phase;
    while (this.samples.length && simT - this.samples[0].t > 3) this.samples.shift(); while (this.wraps.length && simT - this.wraps[0] > 6) this.wraps.shift();
    const S = this.samples; if (S.length < 10) return;
    // slip: horizontal speed of a toe while it is within 2.5 cm of its lowest point in the window (planted), relative to the GROUND
    let minY = Infinity; for (const s of S) minY = Math.min(minY, s.toeL[1], s.toeR[1]);
    let slipSum = 0, slipN = 0, planted = 0; const gv = ground ?? [0, 0, 0];
    for (let i = 1; i < S.length; i++) { const ddt = S[i].t - S[i - 1].t; if (ddt <= 0) continue;
      for (const k of ['toeL', 'toeR'] as const) { if (S[i][k][1] < minY + 0.025) { const vx = (S[i][k][0] - S[i - 1][k][0]) / ddt, vz = (S[i][k][2] - S[i - 1][k][2]) / ddt; slipSum += Math.hypot(vx - gv[0], vz - gv[2]); slipN++; planted++; } } }
    this.slip = slipN ? slipSum / slipN : 0; this.stance = 100 * planted / (2 * (S.length - 1));
    let lo = Infinity, hi = -Infinity, glo = Infinity, ghi = -Infinity, gsum = 0; for (const s of S) { lo = Math.min(lo, s.hipsY); hi = Math.max(hi, s.hipsY); glo = Math.min(glo, s.gaze); ghi = Math.max(ghi, s.gaze); gsum += s.gaze; }
    this.bob = (hi - lo) * 100; this.gaze = gsum / S.length; this.gazeBob = ghi - glo;
    this.cadence = this.wraps.length >= 2 ? 2 * (this.wraps.length - 1) / (this.wraps[this.wraps.length - 1] - this.wraps[0]) : 0;   // two steps a cycle
  }
  line(): string { return `slip ${this.slip.toFixed(2)} m/s ${this.slip < 0.15 ? '(planted)' : this.slip < 0.5 ? '(a little slide)' : '(SKATING)'} · cadence ${this.cadence.toFixed(2)} steps/s · stance ${this.stance.toFixed(0)} % · bob ${this.bob.toFixed(1)} cm · eye line ${this.gaze.toFixed(1)}° (swings ${this.gazeBob.toFixed(1)}°)`; }
}
