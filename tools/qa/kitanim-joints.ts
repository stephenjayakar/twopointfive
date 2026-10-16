// How Sam's JOINTS and the things he carries move through every kit change (src/game/kitanim.ts): the whole Game stepped headless, and per frame of each
// change — how far each elbow is folded, how far each wrist is bent off its forearm, how fast each hand travels, how fast the chest turns over the hips, and how
// fast the long gun's line swings. The worst of each per change is the table; a human arm does not fold past ~35° between upper arm and forearm, a wrist does
// not bend 90° off the forearm, and three kilos of rifle are not flipped end for end in a tenth of a second.
//
//   bun run tools/qa/kitanim-joints.ts [--only 'rifle>frag,rifle>pistol'] [--trace 'rifle>frag'] [--loud] [--off]
//     --trace = that change frame by frame · --loud = staged as a loud mission's kit (the sling in front) · --off = KITANIM off (the build before it)
//   exit 1 when a change breaks a bound of LIMITS below (the probes ask the same through jointsOf()).
import { standUp, ROOT } from './headless.ts';
const { mulberry32 } = await import(`${ROOT}/src/math/dice.ts`);
const { KITANIM } = await import(`${ROOT}/src/game/kitanim.ts`);
const { MOVES, KIT } = await import(`${ROOT}/src/game/character.ts`);
if (process.env.KITSET) for (const [k, v] of Object.entries(JSON.parse(process.env.KITSET))) { const ks = k.split('.'); let o: any = KIT; for (const x of ks.slice(0, -1)) o = o[x]; o[ks[ks.length - 1]] = v; }   // (a sweep: KITSET='{"arc.rifle":[-0.1,0.25,0.05]}')
const { handProps } = await import(`${ROOT}/src/game/combat.ts`);
const { quat } = await import(`${ROOT}/src/math/vec.ts`);
type P3 = [number, number, number];
const DT = 1 / 60, DEG = 180 / Math.PI;
/** elbow: the least angle between upper arm and forearm (°) · wrist: the most the hand's line is off the forearm's (°) · hand: m/s · gun: °/s of the long gun's
 *  line · joint: m/s of the elbow JOINT (an elbow that changes side in a frame) · chest: °/s of the shoulder line over the hips */
export const LIMITS = { elbow: 38, wrist: 82, hand: 6.5, joint: 6.5, gun: 760, chest: 420 };
export type Kit = 'none' | 'pistol' | 'rifle' | 'smoke' | 'flash' | 'frag';
const KEY: Record<Kit, string> = { none: 'KeyE', pistol: 'Digit1', rifle: 'Digit2', smoke: 'Digit3', flash: 'Digit4', frag: 'Digit5' };
export interface JointRow { f: number; hold: string; elbowR: number; elbowL: number; wristR: number; wristL: number; handR: number; handL: number; jointR: number; jointL: number; gun: number; chest: number; }
export interface JointWorst { name: string; frames: number; secs: number; elbowR: [number, number]; elbowL: [number, number]; wristR: [number, number]; wristL: [number, number]; handR: [number, number]; handL: [number, number]; jointR: [number, number]; jointL: [number, number]; gun: [number, number]; chest: [number, number]; rows: JointRow[]; }

const sub = (a: P3, b: P3): P3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], len = (a: P3) => Math.hypot(a[0], a[1], a[2]);
const ang = (a: P3, b: P3) => { const d = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / ((len(a) * len(b)) || 1); return Math.acos(Math.max(-1, Math.min(1, d))) * DEG; };

/** Sam stood at (21, 12) with `from` in his hands and settled, then `to` asked for: every frame until the hands are still again (≤ 150) */
export async function jointsOf(from: Kit, to: Kit, o: { on?: boolean; loud?: boolean } = {}): Promise<JointWorst> {
  Math.random = mulberry32(5);
  const W: any = await standUp(); const g = W.game, input = W.input;
  KITANIM.on = o.on ?? true; MOVES.on = 1;
  if (o.loud !== undefined) KITANIM.sling = o.loud ? 1 : 2;
  g.playerInvisible = true; g.godMode = true; g.aiEnabled = false; g.infiniteAmmo = true; W.cam.yaw = 0; W.cam.rebuild();
  for (let i = 0; i < 5; i++) W.step(DT);
  g.guards.forEach((gd: any, i: number) => { gd.hold = true; gd.char.pos = [38.5, 0, 1.5 + i * 1.2]; gd.char.update(0); });
  const pl = g.player, c = pl.char, an = c.anim;
  g.teleportPlayer([10, 0, 19]); c.bodyYaw = c.aimYaw = 0;   // (open floor: at a wall the guns-at-walls rule keeps his gun down)
  const step = (n: number) => { for (let i = 0; i < n; i++) { W.cursorAt([10, 1.2, 45]); W.step(DT); } };
  const tap = (k: Kit) => { if (k === 'none') { if (!pl.holstered) input.pressed.add('KeyE'); } else if (k === 'pistol') { input.pressed.add(pl.slot === 'pistol' && pl.holstered ? 'KeyE' : 'Digit1'); } else input.pressed.add(KEY[k]); };
  step(10);
  if (from !== 'none') { tap(from); step(2); if (from === 'pistol' && !pl.pistolUp) { input.pressed.add('KeyE'); } if (from === 'rifle' && !pl.rifleUp) input.pressed.add('KeyE'); step(100); }
  const gunAxis = (): P3 | null => { const all: any[] = []; handProps(g, all); let best: any = null, bl = 0; for (const x of all) { if ((x.owner & 0xff) !== (c.id & 0xff) || x.name !== 'sc20k') continue; const m = Math.max(x.h[0], x.h[1], x.h[2]); if (m > bl) { bl = m; best = x; } }
    if (!best) return null; const q = best.rot ?? [0, Math.sin((best.yaw ?? 0) / 2), 0, Math.cos((best.yaw ?? 0) / 2)]; const i = best.h[0] >= best.h[1] && best.h[0] >= best.h[2] ? 0 : best.h[1] >= best.h[2] ? 1 : 2; const a: P3 = [0, 0, 0]; a[i] = 1; return quat.rotate(q, a) as P3; };
  const snap = () => { const b = c.bones; return { hR: [...b.handR] as P3, hL: [...b.handL] as P3, eR: [...b.forearmR] as P3, eL: [...b.forearmL] as P3, sh: sub(b.upperArmL as P3, b.upperArmR as P3), hip: sub(b.thighL as P3, b.thighR as P3), gun: gunAxis() }; };
  const yawOf = (v: P3) => Math.atan2(v[0], v[2]);
  const rows: JointRow[] = []; let pv = snap(), still = 0, f = 0;
  tap(to); if (to === from) throw new Error('same kit');
  for (f = 1; f <= 150; f++) {
    step(1); const b = c.bones, s = snap();
    const el = (S: 'L' | 'R') => ang(sub(b['upperArm' + S], b['forearm' + S]), sub(b['hand' + S], b['forearm' + S]));
    const wr = (S: 'L' | 'R') => ang(sub(b['hand' + S], b['forearm' + S]), sub(b['finger' + S], b['hand' + S]));
    let gun = 0; if (s.gun && pv.gun) { const a = ang(s.gun, pv.gun); gun = Math.min(a, 180 - a) / DT; }
    let dy = (yawOf(s.sh) - yawOf(s.hip)) - (yawOf(pv.sh) - yawOf(pv.hip)); dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const r: JointRow = { f, hold: an.kitHold === undefined ? '—' : String(an.kitHold), elbowR: el('R'), elbowL: el('L'), wristR: wr('R'), wristL: wr('L'), handR: len(sub(s.hR, pv.hR)) / DT, handL: len(sub(s.hL, pv.hL)) / DT, jointR: len(sub(s.eR, pv.eR)) / DT, jointL: len(sub(s.eL, pv.eL)) / DT, gun, chest: Math.abs(dy) * DEG / DT };
    rows.push(r); pv = s;
    still = !an.kitBusy && r.handR < 0.12 && r.handL < 0.12 ? still + 1 : 0; if (still > 12) break;
  }
  const lo = (k: keyof JointRow): [number, number] => { let m = Infinity, at = -1; for (const r of rows) if ((r[k] as number) < m) { m = r[k] as number; at = r.f; } return [m, at]; };
  const hi = (k: keyof JointRow): [number, number] => { let m = -Infinity, at = -1; for (const r of rows) if ((r[k] as number) > m) { m = r[k] as number; at = r.f; } return [m, at]; };
  KITANIM.on = false;
  return { name: `${from}>${to}`, frames: rows.length, secs: Math.max(0, rows.length - 13) * DT, elbowR: lo('elbowR'), elbowL: lo('elbowL'), wristR: hi('wristR'), wristL: hi('wristL'), handR: hi('handR'), handL: hi('handL'), jointR: hi('jointR'), jointL: hi('jointL'), gun: hi('gun'), chest: hi('chest'), rows };
}
/** the bounds a change breaks, in words (empty = within them) */
export function jointFaults(w: JointWorst): string[] {
  const o: string[] = [], L = LIMITS;
  for (const S of ['R', 'L'] as const) { const e = w[('elbow' + S) as 'elbowR'], r = w[('wrist' + S) as 'wristR'], h = w[('hand' + S) as 'handR'];
    if (e[0] < L.elbow) o.push(`${S} elbow folded to ${e[0].toFixed(0)}° @f${e[1]}`); if (r[0] > L.wrist) o.push(`${S} wrist bent ${r[0].toFixed(0)}° @f${r[1]}`); if (h[0] > L.hand) o.push(`${S} hand at ${h[0].toFixed(1)} m/s @f${h[1]}`);
    const j = w[('joint' + S) as 'jointR']; if (j[0] > L.joint) o.push(`${S} elbow joint at ${j[0].toFixed(1)} m/s @f${j[1]}`); }
  if (w.gun[0] > L.gun) o.push(`long gun swung at ${w.gun[0].toFixed(0)}°/s @f${w.gun[1]}`); if (w.chest[0] > L.chest) o.push(`chest turned at ${w.chest[0].toFixed(0)}°/s @f${w.chest[1]}`);
  return o;
}
export const ALL_CHANGES: [Kit, Kit][] = [['none', 'pistol'], ['pistol', 'none'], ['none', 'rifle'], ['rifle', 'none'], ['rifle', 'pistol'], ['pistol', 'rifle'], ['rifle', 'smoke'], ['rifle', 'frag'], ['frag', 'rifle'], ['pistol', 'smoke'], ['smoke', 'pistol'], ['smoke', 'frag']];

if (import.meta.main) {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : null; };
  const only = arg('--only')?.split(',') ?? null, trace = arg('--trace'), loud = process.argv.includes('--loud') ? true : undefined, on = !process.argv.includes('--off');
  const p = (s: string, n: number) => s.padEnd(n), v = (x: [number, number], d = 0) => `${x[0].toFixed(d)} @${x[1]}`;
  console.log(p('change', 16) + p('secs', 6) + p('elbow R min°', 14) + p('elbow L min°', 14) + p('wrist R max°', 14) + p('wrist L max°', 14) + p('hand R m/s', 13) + p('hand L m/s', 13) + p('elbow R m/s', 13) + p('gun °/s', 12) + p('chest °/s', 12) + 'faults');
  let bad = 0;
  for (const [a, b] of ALL_CHANGES) { const name = `${a}>${b}`; if (only && !only.includes(name)) continue;
    const w = await jointsOf(a, b, { on, loud }), fl = jointFaults(w); if (fl.length) bad++;
    console.log(p(name, 16) + p(w.secs.toFixed(2), 6) + p(v(w.elbowR), 14) + p(v(w.elbowL), 14) + p(v(w.wristR), 14) + p(v(w.wristL), 14) + p(v(w.handR, 1), 13) + p(v(w.handL, 1), 13) + p(v(w.jointR, 1), 13) + p(v(w.gun), 12) + p(v(w.chest), 12) + (fl.join(' · ') || 'none'));
    if (trace === name) for (const r of w.rows) console.log(`  f${String(r.f).padStart(3)} ${p(r.hold, 7)} elbow ${r.elbowR.toFixed(0).padStart(3)} / ${r.elbowL.toFixed(0).padStart(3)}  wrist ${r.wristR.toFixed(0).padStart(3)} / ${r.wristL.toFixed(0).padStart(3)}  hand ${r.handR.toFixed(1)} / ${r.handL.toFixed(1)} m/s  elbow ${r.jointR.toFixed(1)} m/s  gun ${r.gun.toFixed(0).padStart(4)}°/s  chest ${r.chest.toFixed(0).padStart(4)}°/s`); }
  console.log(bad ? `\n${bad} change(s) outside the bounds (elbow ≥ ${LIMITS.elbow}°, wrist ≤ ${LIMITS.wrist}°, hand ≤ ${LIMITS.hand} m/s, elbow joint ≤ ${LIMITS.joint} m/s, gun ≤ ${LIMITS.gun}°/s, chest ≤ ${LIMITS.chest}°/s)` : '\nevery change inside the bounds');
  process.exit(bad ? 1 : 0);
}
