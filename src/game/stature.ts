// STATURE — the cast DRAWN at slightly different heights per man. The cast's meshes sit on one skeleton, so every crown, shoulder and fist lay on the same lines; this draws each man
// as a uniform scale of himself about his feet (his root on the floor), a few per cent either way, and takes everything that is drawn off his bones with him.
//
// LOOKS ONLY. The skeleton, `Character.bones`, `skel.jointData`, the hit capsules (`Character.rayHit`), eyes, muzzles, collision, sound, the lights a man carries and every Box the
// CPU ray-casts are untouched and nothing here is read back by the simulation: what moves is what the GPU is HANDED —
//   · his joint palette (a scaled copy → the raster, the mesh shadows' skin, last frame's palette for motion vectors: all read the one uploaded buffer),
//   · his shadow / reflection proxies (the round cones' ends, his own fit's radii, the cull sphere),
//   · the boxes bolted to him (rigProps through combat.ts handProps: guns, torch, goggles, holster, slung rifle, held cans): `Box.dc / dh`, which scene/boxes.ts packs and registers
//     in the trace grid in place of c / h — the Box the cursor's ray and the lasers' reach meet on the CPU stays where the simulation has it,
//   · the near end of his weapon laser (the far end stays on the simulation's hit point).
// NOT moved (the simulation's, a few centimetres from the drawn man at most): the positions of the lights he carries, where a round / a tracer / a spent case / a thrown can starts,
// bubbles and labels over his head, a wet boot's print.
//
// The table is per VARIANT of the cast (anim/gltf.ts; game/cast.ts says who wears which) + a small per-man jitter off his id (never a die). Sam is 1 exactly; with no cast loaded
// (the mannequin) everybody is 1; a man at 1 takes the code path as it was (the same buffers, no copy). While two bodies must register — a man in Sam's arm, a body hauled by the
// ankles — the held one eases to 1 and back. The eased value is presentation state: not saved, not in any digest.
import type { Game } from './game';
import type { Character } from './character';
import type { Box } from '../scene/boxes';
import type { Vec3 } from '../math/vec';
import { castVariantOf } from './cast';

/** drawn height ÷ the skeleton's, by variant name (absent = 1) */
export const STATURE: Record<string, number> = {
  civilian_1: 0.93,                                               // the cleaner
  defender_2: 0.97, defender_3: 1.04,                             // the wiry build, the big build
  operator_2: 1.02, operator_3: 0.99, operator_4: 1.03, operator_5: 1.0,
};
export const STATURE_TUNE = { jitter: 0.015, min: 0.92, max: 1.05, easePerSec: 0.25 };   // ± per man off his id · the clamp · how fast a held man goes to 1 and back (scale units a second: 7 % in ~0.3 s)

const hash01 = (n: number) => { let x = (n | 0) * 0x9E3779B1; x ^= x >>> 15; x = Math.imul(x, 0x85EBCA6B); x ^= x >>> 13; return ((x >>> 0) % 4096) / 4095; };
/** the man's own stature (1 for Sam, and for everybody with no cast loaded) */
export function statureBase(g: Game, c: Character): number {
  if (c === g.player.char) return 1;
  const v = castVariantOf(g, c); if (!v) return 1;
  const T = STATURE_TUNE; const s = (STATURE[v.name] ?? 1) + (hash01(c.id) * 2 - 1) * T.jitter;
  return Math.round(Math.min(T.max, Math.max(T.min, s)) * 1000) / 1000;
}
/** two bodies that must meet: he is in Sam's arm, or is the body Sam hauls */
function paired(g: Game, c: Character): boolean {
  if (g.player.dragging?.char === c) return true;
  const rec = g.guards.find(x => x.char === c) ?? g.civilians.find(x => x.char === c);
  return !!rec?.held;
}
const shown = new WeakMap<Character, number>();
/** once a frame, before anything of the men is drawn: every man's scale for this frame. False with no cast loaded — nothing below is then asked. */
export function statureTick(g: Game, men: Character[], dt: number): boolean {
  if (!g.ch.cast) return false;
  for (const c of men) {
    const want = paired(g, c) ? 1 : statureBase(g, c); const had = shown.get(c);
    if (had === undefined) { shown.set(c, want); continue; }
    if (had !== want) { const step = STATURE_TUNE.easePerSec * Math.max(0, dt); shown.set(c, Math.abs(want - had) <= step ? want : had + Math.sign(want - had) * step); }
  }
  return true;
}
/** the scale this man is drawn at this frame (1 = as the skeleton has him) */
export function statureOf(c: Character): number { return shown.get(c) ?? 1; }

/** where a point of the simulation's man is DRAWN: scaled about his feet */
export function drawnPoint(c: Character, p: Vec3, s = statureOf(c)): Vec3 {
  const f = c.pos; return s === 1 ? p : [f[0] + (p[0] - f[0]) * s, f[1] + (p[1] - f[1]) * s, f[2] + (p[2] - f[2]) * s];
}
const palette = new Float32Array(64 * 16);
/** his joint palette as drawn. CharacterRenderer.setInstance copies it at once, so one scratch serves every man; s 1 = the skeleton's own array. */
export function drawnJoints(c: Character, s: number): Float32Array {
  const src = c.skel.jointData; if (s === 1) return src;
  const f = c.pos, tx = f[0] * (1 - s), ty = f[1] * (1 - s), tz = f[2] * (1 - s); const out = palette.length >= src.length ? palette : new Float32Array(src.length);
  for (let o = 0; o < src.length; o += 16) {   // (column-major: A · M with A = scale s about his feet — the 3×3 and the translation by s, + (1 − s) · feet)
    out[o] = src[o] * s; out[o + 1] = src[o + 1] * s; out[o + 2] = src[o + 2] * s; out[o + 3] = src[o + 3];
    out[o + 4] = src[o + 4] * s; out[o + 5] = src[o + 5] * s; out[o + 6] = src[o + 6] * s; out[o + 7] = src[o + 7];
    out[o + 8] = src[o + 8] * s; out[o + 9] = src[o + 9] * s; out[o + 10] = src[o + 10] * s; out[o + 11] = src[o + 11];
    out[o + 12] = src[o + 12] * s + tx; out[o + 13] = src[o + 13] * s + ty; out[o + 14] = src[o + 14] * s + tz; out[o + 15] = src[o + 15];
  }
  return out.length === src.length ? out : out.subarray(0, src.length);
}
/** his proxy records as drawn: Character.capsules()' ends, radii and cull sphere through the same scale (new arrays: the character's own are never written) */
export function drawnCapsules(c: Character, P: { caps: number[][]; bound: [number, number, number, number] }, s: number): { caps: number[][]; bound: [number, number, number, number] } {
  if (s === 1) return P;
  const f = c.pos, X = (v: number) => f[0] + (v - f[0]) * s, Y = (v: number) => f[1] + (v - f[1]) * s, Z = (v: number) => f[2] + (v - f[2]) * s;
  return { caps: P.caps.map(k => k[3] > 0 ? [X(k[0]), Y(k[1]), Z(k[2]), k[3] * s, X(k[4]), Y(k[5]), Z(k[6])] : k), bound: [X(P.bound[0]), Y(P.bound[1]), Z(P.bound[2]), P.bound[3] * s] };
}
type Fit = { r0: Float32Array; r1: Float32Array; pad?: number };
const fits = new WeakMap<Character, { of: Fit; s: number; fit: Fit }>();
/** his round-cone fit (render/sdfrig.ts: metres in bind pose) at his drawn size */
export function drawnFit(c: Character, fit: Fit, s: number): Fit {
  if (s === 1) return fit;
  const had = fits.get(c); if (had && had.of === fit && had.s === s) return had.fit;
  const out: Fit = { r0: fit.r0.map(r => r * s), r1: fit.r1.map(r => r * s), pad: fit.pad === undefined ? undefined : fit.pad * s };
  fits.set(c, { of: fit, s, fit: out }); return out;
}
/** the boxes out[from‥] that carry a drawn man's owner byte (his rig, a can in his fist): where the GPU is to draw them (Box.dc / dh). The Box itself is not moved. */
export function drawnBoxes(g: Game, men: Character[], out: Box[], from: number) {
  let any = false; for (const c of men) if (statureOf(c) !== 1) { byId[c.id & 0xff] = c; any = true; }
  for (let k = from; k < out.length; k++) {
    const b = out[k]; const c = any && b.owner ? byId[b.owner & 0xff] : undefined;
    if (!c) { if (b.dc) b.dc = b.dh = undefined; continue; }   // (a box that outlives the frame — Game.fx — whose man is back at 1)
    const s = statureOf(c); b.dc = drawnPoint(c, b.c, s); b.dh = [b.h[0] * s, b.h[1] * s, b.h[2] * s];
  }
  if (any) byId.fill(undefined);
}
const byId: (Character | undefined)[] = new Array(256).fill(undefined);
/** a weapon laser's ray as drawn: it leaves the DRAWN muzzle and still ends on the simulation's point (from + dir · L). `k` = drawn length ÷ the simulation's. */
export function drawnBeam(c: Character, from: Vec3, dir: Vec3, L: number): { from: Vec3; dir: Vec3; k: number } {
  const s = statureOf(c); if (s === 1 || !(L > 1e-4)) return { from, dir, k: 1 };
  const a = drawnPoint(c, from, s); const d: Vec3 = [from[0] + dir[0] * L - a[0], from[1] + dir[1] * L - a[1], from[2] + dir[2] * L - a[2]]; const n = Math.hypot(d[0], d[1], d[2]);
  return n > 1e-4 ? { from: a, dir: [d[0] / n, d[1] / n, d[2] / n], k: n / L } : { from, dir, k: 1 };
}
