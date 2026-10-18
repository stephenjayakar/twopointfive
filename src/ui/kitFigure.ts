// THE PICKED MAN, IN 3D, ON THE TEAM & KIT STEP (the maintainer, 10-11: "can you add more visuals to the menus? like door kickers has some 2d art, ready or not
// has a 3d character view for kit menu"; 10-12: "cell shading here doesn't match the RT lighting look we're going for" · "should also have a breathing animation").
//
// The game's renderer is busy compiling behind the menus and has one view; this is a small SOFTWARE view of one man in a 2D canvas, made of the game's own
// parts so it cannot drift from what deploys: the cast's mesh in the variant, parts and palette the game will give that man (anim/gltf.ts, game/cast.ts's
// rules, render/charMaterials.ts), posed and kept alive by the game's own animator (game/character.ts: he breathes and shifts his weight as a man at rest in
// play does), with the boxes the game bolts to him for the gun his card names (game/rigProps.ts).
//
// LIT BY RAYS, LIKE THE GAME (ui/figureTrace.ts): he stands on a patch of the mission's ground under a sized lamp and a cool back light. Every point of a
// ~2 cm lattice over him and the ground (a LUMEL) keeps how much of each lamp it sees (shadow rays to points across the emitter: soft shadows that sharpen at
// a contact) and what light reaches it second hand (a gather ray a pass: the lit ground, his own lit kit, the sky — the colour of the ground comes up under
// his chin). The lattice is traced a slice a frame against the pose he was built in and keeps improving for some seconds; the light stays on his surface as
// traced (lamps and second-hand light alike, against the built pose), and a frame only re-poses him and rasters. The picture goes through the game's own tone curve, and frames are jittered and blended as the game's
// resolve does it.
//
// PICTURE ONLY. It reads the kit card it is handed and writes nothing anywhere; the game's die is not rolled (the Character it poses is its own, built and stepped under a die of this file's).
// Two things here are drawn by this file alone, because the game draws them only on a staged man: the ballistic shield's plate (game/shield.ts's numbers) and
// the pouches on his belt for what the card carries a COUNT of (no such boxes exist in play: a can is drawn only in the fist).
// Nothing is drawn until the cast has loaded (main.ts hands it over: setFigureCast) and nowhere without a 2D canvas (the probes' DOM).
import type { GltfCharacter, CastInfo, CastVariant } from '../anim/gltf';
import { castSide, castSuit, castGoggles, castFile, loadGltfCast } from '../anim/gltf';
import { Character } from '../game/character';
import { rigBoxes, gogglesBoxes, sc20kGrip, sc20kMuzzleAhead, carbineGrip, carbineMuzzleAhead, longHold, RIG, type RigNodeMeta } from '../game/rigProps';
import { charSlots, writeCharPalette, CHAR_MAT_FLOATS } from '../render/charMaterials';
import { SUITS, TRIMS, kitGun, type MemberKit } from '../game/kit';
import { rosterOf, type SquadSize } from '../game/loadout';
import { SQUAD4 } from '../game/nightbreach';
import { operatorAt } from '../game/cast';
import { WEAPONS } from '../game/weapons';
import { SHIELD } from '../game/shield';
import { KITANIM } from '../game/kitanim';
import { INHAND, IN_PISTOL, type InHandWord } from '../game/inhand';
import { CLOSE } from '../game/close';
import { GEAR } from '../game/gear';
import { LOOK, lookDress, setLookPlace } from '../scene/look';
import { PLAYER_ID } from '../game/consts';
import { HOURS, cloudLight, cloudSoft, cloudSun, greyed, type HourId } from '../game/hours';
import type { Box } from '../scene/boxes';
import { quat, type Vec3 } from '../math/vec';
import { buildBvh, occluded, closest, hitT, hash01, R2A, R2B, toneInto, type Bvh } from './figureTrace';

/** who to draw: the picked member (0 = you, 1‥squad), the team's size (it names him: his pair's colours), whether this mission wears the sneaking suit,
 *  whether its level is one of the look's places (scene/look.ts placeOfQuery: the dress the men deploy in), and the card he will be staged with */
/** `hour` = the mission's hour as picked on its sheet: he stands in that hour's own sun and sky (game/hours.ts HOURS); none, or night, = under the lamp;
 *  `cloud` = the cover of the weather picked with it (0‥1), which dims that sun and hands its light to the sky as the game's does */
export interface FigureAsk { member: number; squad: SquadSize; suit: boolean; look: boolean; card: MemberKit; hour?: HourId; cloud?: number }
export interface KitFigure { show(ask: FigureAsk | null): void; close(): void; readonly canvas: HTMLElement | null }

/** a sized lamp: where it hangs, the emitter's radius (m: its shadows' softness), colour × strength (the light on a surface facing it a metre off), where it points and
 *  the half-angles (°) its pool is full inside and gone outside */
export interface Lamp { p: Vec3; r: number; col: Vec3; aim: Vec3; cone: [number, number] }

/** the look's numbers (judged on headless sheets and the software adapter's screenshots only: tools/qa/kit-figure-sheet.ts) */
export const FIGURE = {
  /** camera: turn about him at rest (rad; 0 = square on), pitch down (the game looks down at 55°: this is part of the way there), distance */
  yaw: -0.6, yawPistol: -1.1, yawShield: -1.6, pitch: 0.26, dist: 7,
  /** his height's share of the canvas, where his feet stand in it (0 top ‥ 1 bottom), and the width kept for him and his gun at any turn, m; `lead` = how far in front of him the
   *  camera looks in a pistol's or a shield's view, m */
  fill: 0.84, feet: 0.89, wide: 1.1, tall: 1.9, lead: 0.13,
  /** the lamps, in his world (he faces +z; they stay put while a drag walks the camera round him): a warm work lamp high in front, a paler one high behind his other
   *  shoulder (it draws his outline, it does not paint him) */
  lamps: [
    { p: [1.7, 2.35, 2.4], r: 0.22, col: [38, 30.5, 22], aim: [0, 1.4, 0], cone: [9, 30] },
    { p: [-1.5, 2.5, -2.8], r: 0.2, col: [96, 110, 134], aim: [0, 1.15, 0], cone: [11, 27] },
  ] as Lamp[],
  /** the sky over him (what a ray that leaves the scene brings back), overhead and at the horizon */
  sky: [[0.1, 0.13, 0.2], [0.035, 0.04, 0.055]] as [Vec3, Vec3],
  /** BY NIGHT, the room's own return on his dark side: a soft warm glow in the sky a ray leaves by, brightest toward `dir`, falling off as cos^`pow` (no ray of its
   *  own: it rides the second-hand rays, so a view dragged round to his far side is never lit by the back lamp alone) */
  glow: { dir: [-0.72, 0.2, 0.66] as Vec3, col: [0.13, 0.112, 0.09] as Vec3, pow: 2 },
  /** BY DAY the light is the mission's hour's own (game/hours.ts HOURS: the sun's height, colour, strength and width, the sky's two colours, the exposure) in the
   *  game's own units — the sun on a face is its strength × N·L ∕ π (`sunK`), the sky is what a ray that leaves brings back (`skyK`), rising from the horizon's colour
   *  to the zenith's over the first 1 ∕ `ramp` of the way up, as the game's sky does — so `exK` 1 is the game's exposure. The sun stands `off` degrees round from
   *  straight ahead of him toward the lamp's side (the picture's key side at any hour: an hour changes its height and colour, not which side of him is lit).
   *  `far` = how far off the sun's lamp hangs (m), `soft` = the least angular radius it is drawn with (rad). `rimSun` / `rimSky` = the sky-coloured rim where the
   *  night's hangs, as shares of the sun and the sky; `ground` = the ground's paint under a high sun (a sunlit pale floor outshone him; a low sun grazes it, so it is let up as the sun comes down), `groundCloud` = under a closed deck (no sun on it: at the sunny share he stood on black); `lift` = under a picked weather's
   *  cloud the exposure rises by the lost light to that power (0 = the game's: a downpour at dusk left him a silhouette). */
  day: { off: 38, far: 600, soft: 0.02, sunK: 0.4, skyK: 0.7, exK: 0.6, lift: 1, ramp: 2.5, rimSun: 2, rimSky: 2.5, ground: 0.28, groundCloud: 0.7 },
  /** the air behind him: a soft glow he is seen against (so a dark suit has an outline on the page's black). `at` = its middle down the picture and its half width
   *  and half height as shares of it; by night its own colour (as light, before the tone curve) and how solid; by day the hour's horizon × `dayK`, `dayA` solid */
  back: { at: [0.44, 0.5, 0.46], night: [0.125, 0.125, 0.137] as Vec3, nightA: 0.85, dayK: 0.45, dayA: 0.55 },
  /** second-hand light is evened over a lumel's neighbours that face its way, this many times over (one ray a pass a lumel is grainy; its shadows are not touched);
   *  the share of its own cell a lumel on him asks its shadow rays from after the first pass (a shadow's edge then crosses the lattice as a soft step) */
  smooth: 2, cell: 0.9,
  /** exposure into the game's tone curve */
  exposure: 0.45,
  /** the ground he stands on: its paint in a place of the look / elsewhere (× `night` under the lamps: his boots and his shadow need a floor to stand on), its radius (m), rings × sectors of lumels, how the rings crowd to his feet, and the share of
   *  the radius where it starts to melt into the page, and the pool it is seen in on the picture (centre down the height, half width, half height as shares of the picture; the share of the way out over which it melts) */
  ground: { look: [0.1, 0.09, 0.076] as Vec3, plain: [0.075, 0.08, 0.09] as Vec3, night: 1.15, r: 1.7, rings: 44, sectors: 128, pow: 1.5, fade: 0.25, pool: [0.87, 0.5, 0.15, 0.9] },
  /** lumel spacing over him, m, and the most a triangle's edge is cut into */
  lumel: 0.03, cuts: 7,
  /** tracing: passes the lattice is refined for, ms of it a frame, a ray's start off the surface (m), and the weight of the first guess at second-hand light */
  passes: 40, sliceMs: 5, firstMs: 14, earlyMs: 9, early: 8, sliceGap: 12, lift: 0.004, prior: 3, grain: 0.3,
  /** frames a second he is redrawn at (30: every second frame of a 60 Hz display, every fourth of a 120 Hz one — 24 fell on a 60 Hz display's frames 3, 2, 3, 2 apart,
   *  which reads as judder), and on a machine where one of his frames costs more than `slowMs` of the main thread, `fpsSlow` (back to `fps` under `fastMs`); how much
   *  of a new frame the resolve takes once it has settled, where he is still; how much more a pixel of him takes for each canvas pixel that spot of him moved since the
   *  last frame (so what moves does not smear); the pace his idle is played at */
  fps: 30, fpsSlow: 20, slowMs: 16, fastMs: 11, blend: 0.2, smear: 1.6, pace: 0.7,
  /** drag: radians a CSS pixel */
  drag: 0.011,
  /** how he stands for the picture, over the game's own carriage: his chin (rad, + = down) and his head's turn (rad) off where the idle leaves them, and the
   *  game's carriage the pistol is held at ('none' = its relaxed carry) */
  pose: { chin: -0.3, turn: -0.3, pistol: 'lowReady' as 'none' | 'lowReady' | 'highReady' },
  /** faces turned from the camera are not drawn */
  cull: true,
  /** backing pixels a CSS pixel at the least (a display with more gets its own), and the most backing pixels */
  ss: 1.5, maxPx: 1_000_000,
};

let cast: GltfCharacter | null = null;
const live = new Set<() => void>();
/** the cast has loaded (main.ts): figures already up draw now */
export function setFigureCast(ch: GltfCharacter | null): void { cast = ch; other = null; otherAsked = false; for (const f of live) f(); }

// THE DRESS IS THE MISSION'S, NOT THIS PAGE'S: the page that shows the menus loaded the cast file of ITS level (the title's: the office's dress), and a
// mission on one of the look's places deploys in the other file. That one is fetched the first time a figure asks for it, over the skeleton already loaded.
let other: GltfCharacter | null = null, otherAsked = false;
/** the cast a mission of that dress deploys with: null while the other file is on its way (a figure draws when it lands); this page's own if it never comes */
function castFor(look: boolean): GltfCharacter | null {
  const ch = cast; if (!ch || !ch.cast || look === lookDress()) return ch;
  if (other) return other;
  if (otherAsked) return otherFailed ? ch : null;
  otherAsked = true; otherFailed = false;
  let url: string; try { url = new URL('assets/chars/' + castFile(look), document.baseURI).href; } catch { otherFailed = true; return ch; }
  void loadGltfCast(url, ch).then(c => { if (cast === ch) other = c; }, () => { if (cast === ch) otherFailed = true; }).then(() => { for (const f of live) f(); });
  return null;
}
let otherFailed = false;
/** `fn` with the look's place set to the mission's (the palette tables ask it: render/charMaterials.ts charMatsOf). Synchronous, put back before it returns:
 *  the place is the PAGE's fact and nothing else may see it moved. */
function inDress<T>(look: boolean, fn: () => T): T {
  const was = lookDress(); if (!LOOK.on || was === look) return fn();
  setLookPlace(look); try { return fn(); } finally { setLookPlace(was); }
}
/** A DIE OF ITS OWN for `fn`: a Character draws its stride's phase when it is made and may roll while it is stepped, and the game's die (math/dice.ts) is drawn only
 *  while Math.random is the function it was when that die was made — so with another in its place for these lines the page's game, a seeded visit and a recording
 *  roll nothing here. (Nothing inside may ever await.) */
let die = 0x2f6e2b1;
function ownDie<T>(fn: () => T, seed?: number): T {
  const sys = Math.random; if (seed !== undefined) die = seed;
  Math.random = () => (die = (Math.imul(die, 1664525) + 1013904223) >>> 0) / 4294967296;
  try { return fn(); } finally { Math.random = sys; }
}

// ------------------------------------------------------------ the model: a posed man, the coarse triangles he is made of, the lumels over them

type Bx = Pick<Box, 'c' | 'h' | 'albedo'> & { yaw?: number; rot?: Box['rot'] };

interface Fig {
  key: string; ch: GltfCharacter; c: Character; top: number;
  /** how far in front of him the camera looks, m (a pistol held out, a shield: the view is turned to his side and what he holds needs the room) */
  lead: number;
  /** a short word for what he is made of (the page checks read it: another kit is another word, whatever frame he is on) */
  word: string;
  /** the cast's vertices he wears, in coarse order; then 24 a box */
  uv: Uint32Array; nBody: number; nBodyTri: number; flip: number; boxes: () => Bx[]; nBox: number;
  /** the game's own boxes for what he holds and wears, before the screen's dress, with the drawer's names for them (a measuring hook: figureHold) */
  rigged: () => { bx: Box[]; meta: RigNodeMeta[] };
  /** coarse: points, normals, triangles, a paint a triangle (an index into `mats`, three floats each) */
  CP: Float32Array; CN: Float32Array; cI: Uint32Array; cM: Uint16Array; mats: Float32Array; matGround: number;
  /** lumels: nL over him (each a weighted mix of three coarse points), then nG on the ground; `corner` = a coarse point's own lumel */
  nL: number; nG: number; LA: Uint32Array; LB: Uint32Array; LC: Uint32Array; LWb: Float32Array; LWc: Float32Array; corner: Int32Array;
  /** where each lumel was, and faced, in the pose the rays were traced in (the light is that pose's: it rides his surface as he breathes); how solid (the ground melts out at its rim) */
  LP0: Float32Array; LN0: Float32Array; LAl: Float32Array;
  /** a coarse triangle's lattice: its cuts, and (cuts > 1) where its (cuts + 1)² table of lumels starts in `grid`; the ground's own triangles over its lumels */
  gN: Uint8Array; gOff: Int32Array; grid: Int32Array; GI: Uint32Array;
  /** the colour, as shown (0‥255), of each corner of an uncut triangle and of each place in `grid` — toned once when the light changes, not once a pixel; what they were toned for */
  tc1: Float32Array; tcg: Float32Array; toned: number;
  /** the light he stands in (lightOf: the lamp's by night, the hour's by day) */
  lamps: Lamp[]; sky: [Vec3, Vec3]; ex: number; ramp: number; fill: typeof FIGURE.glow | null; back: Vec3; backA: number;
  /** a lumel's neighbours on the lattice (lumel i's are nb[nb0[i] ‥ nb0[i + 1]]), the size of its cell (m; lumels on him), and the second-hand light evened over them */
  nb0: Uint32Array; nb: Uint32Array; LS: Float32Array; indS: Float32Array; indT: Float32Array;
  /** a coarse triangle's winding: 1 = its corners turn the way its outward normal says, -1 = the other way */
  cW: Int8Array;
  bvh: Bvh;
  /** what the rays found: the share of each lamp a lumel sees, the light that reaches it second hand; this frame's light on it; how far the tracing is */
  vis: Float32Array; ind: Float32Array; E: Float32Array; pass: number; cursor: number; hs: Float32Array;
  /** screen places: of the coarse points (this frame), of the ground's lumels */
  X: Float32Array; Y: Float32Array; Z: Float32Array; GX: Float32Array; GY: Float32Array;
  /** where each coarse point was on the canvas last frame (no sub-pixel offset), how far it has moved since (canvas pixels), and whether last frame's is known */
  PX: Float32Array; PY: Float32Array; mv: Float32Array; pOk: boolean;
}

const FACES = [[0, 2, 3, 1], [4, 5, 7, 6], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
/** a box's 24 points (four a face) and their normals into the coarse arrays at point `v0` */
function boxPoints(b: Bx, P: Float32Array, N: Float32Array, v0: number): void {
  const q = b.rot ?? [0, Math.sin((b.yaw ?? 0) / 2), 0, Math.cos((b.yaw ?? 0) / 2)];
  const cn = BOXC;
  for (let k = 0; k < 8; k++) { const x = (k & 1 ? 1 : -1) * b.h[0], y = (k & 2 ? 1 : -1) * b.h[1], z = (k & 4 ? 1 : -1) * b.h[2];
    const tx = 2 * (q[1] * z - q[2] * y), ty = 2 * (q[2] * x - q[0] * z), tz = 2 * (q[0] * y - q[1] * x);
    cn[k * 3] = b.c[0] + x + q[3] * tx + q[1] * tz - q[2] * ty; cn[k * 3 + 1] = b.c[1] + y + q[3] * ty + q[2] * tx - q[0] * tz; cn[k * 3 + 2] = b.c[2] + z + q[3] * tz + q[0] * ty - q[1] * tx; }
  for (let f = 0; f < 6; f++) {
    const F = FACES[f], a = F[0] * 3, bb = F[1] * 3, c = F[2] * 3;
    let nx = (cn[bb + 1] - cn[a + 1]) * (cn[c + 2] - cn[a + 2]) - (cn[bb + 2] - cn[a + 2]) * (cn[c + 1] - cn[a + 1]), ny = (cn[bb + 2] - cn[a + 2]) * (cn[c] - cn[a]) - (cn[bb] - cn[a]) * (cn[c + 2] - cn[a + 2]), nz = (cn[bb] - cn[a]) * (cn[c + 1] - cn[a + 1]) - (cn[bb + 1] - cn[a + 1]) * (cn[c] - cn[a]);
    const mx = (cn[a] + cn[c]) / 2 - b.c[0], my = (cn[a + 1] + cn[c + 1]) / 2 - b.c[1], mz = (cn[a + 2] + cn[c + 2]) / 2 - b.c[2];
    const L = Math.hypot(nx, ny, nz) || 1, s = (nx * mx + ny * my + nz * mz < 0 ? -1 : 1) / L; nx *= s; ny *= s; nz *= s;
    for (let k = 0; k < 4; k++) { const o = (v0 + f * 4 + k) * 3, s3 = F[k] * 3; P[o] = cn[s3]; P[o + 1] = cn[s3 + 1]; P[o + 2] = cn[s3 + 2]; N[o] = nx; N[o + 1] = ny; N[o + 2] = nz; }
  }
}
const BOXC = new Float32Array(24);

/** what rides his belt for the card's counts: small boxes round the hips, from his right front (the side the picture looks at) round the back (this file's own drawing) */
function pouches(c: Character, m: MemberKit, out: Bx[], slim = false): void {
  const hip = c.bones.hips; if (!hip) return;
  const f = c.forward(), l: Vec3 = [-f[2], 0, f[0]], RX = slim ? 0.168 : 0.185, RZ = slim ? 0.132 : 0.15, y0 = hip[1] + 0.03;   // (slim: the sneaking suit has no vest under the belt)
  let phi = 0.55;
  const put = (w: number, h: number, d: number, dy: number, body: Vec3, band: Vec3 | null, bandY = 0.55) => {
    phi += w / 0.17;
    const cs = Math.cos(phi), sn = Math.sin(phi), nx = f[0] * cs + l[0] * sn, nz = f[2] * cs + l[2] * sn, yaw = Math.atan2(nx, nz);
    const x = hip[0] + f[0] * cs * RZ + l[0] * sn * RX + nx * d, z = hip[2] + f[2] * cs * RZ + l[2] * sn * RX + nz * d;
    out.push({ c: [x, y0 + dy, z], h: [w, h, d], yaw, albedo: body });
    if (band) out.push({ c: [x + nx * 0.002, y0 + dy + h * bandY, z + nz * 0.002], h: [w + 0.002, h * 0.16, d + 0.002], yaw, albedo: band });
    phi += w / 0.17 + 0.07;
  };
  const n = (k: number) => Math.max(0, Math.min(6, k | 0));
  for (let i = 0; i < n(m.bangs); i++) put(0.024, 0.05, 0.024, -0.02, [0.07, 0.075, 0.08], [0.3, 0.3, 0.28]);
  for (let i = 0; i < n(m.smoke); i++) put(0.024, 0.05, 0.024, -0.02, [0.17, 0.2, 0.14], [0.32, 0.07, 0.05]);
  for (let i = 0; i < n(m.frags); i++) put(0.028, 0.034, 0.028, -0.03, [0.11, 0.14, 0.07], [0.36, 0.3, 0.07], 0.8);
  for (let i = 0; i < n(m.shells); i++) put(0.02, 0.04, 0.02, -0.02, [0.26, 0.21, 0.09], [0.07, 0.1, 0.22], 0.75);
  for (let i = 0; i < n(m.charges); i++) put(0.045, 0.06, 0.014, -0.03, [0.3, 0.26, 0.17], [0.05, 0.05, 0.05], 0);
  if (m.wand) put(0.012, 0.13, 0.012, -0.09, [0.035, 0.035, 0.04], [0.16, 0.16, 0.17], 0.9);
  // the wall charge is a slab on his back, under the shoulders
  const ch = c.bones.chest ?? c.bones.spine;
  if (n(m.walls) && ch) for (let i = 0; i < n(m.walls); i++) { const yaw = Math.atan2(-f[0], -f[2]), back = 0.17 + i * 0.03;
    out.push({ c: [ch[0] - f[0] * back, ch[1] - 0.06, ch[2] - f[2] * back], h: [0.085, 0.11, 0.014], yaw, albedo: [0.2, 0.22, 0.12] });
    out.push({ c: [ch[0] - f[0] * (back + 0.003), ch[1] - 0.06, ch[2] - f[2] * (back + 0.003)], h: [0.087, 0.012, 0.016], yaw, albedo: [0.05, 0.05, 0.05] }); }
}

/** the ballistic shield's plate where game/shield.ts stands it (that file draws it only on a staged man) */
function plate(c: Character, out: Bx[], mark: Vec3): void {
  const sl = c.bones.upperArmL, sr = c.bones.upperArmR; if (!sl || !sr) return;
  const dx = sl[0] - sr[0], dz = sl[2] - sr[2], L = Math.hypot(dx, dz) || 1, fx = -dz / L, fz = dx / L, S = SHIELD, P = PLATE;
  const cx = (sl[0] + sr[0]) / 2 + fx * S.ahead + fz * S.left, cz = (sl[2] + sr[2]) / 2 + fz * S.ahead - fx * S.left, cy = c.pos[1] + S.bottom + S.half[1], yaw = Math.atan2(fx, fz);
  const [hx, hy, hz] = S.half, b: Bx = { c: [cx, cy, cz], h: [hx, hy, hz], yaw, albedo: P.face }, py = hy - S.portBelowTop, [pw, ph] = S.portHalf, e = P.edge;
  out.push(b,
    sub(b, [0, hy - e, 0], [hx + 0.003, e, hz + 0.004], P.rim), sub(b, [0, -hy + e, 0], [hx + 0.003, e, hz + 0.004], P.rim),            // the rubber edge: top, bottom,
    sub(b, [hx - e, 0, 0], [e + 0.003, hy - 2 * e, hz + 0.004], P.rim), sub(b, [-hx + e, 0, 0], [e + 0.003, hy - 2 * e, hz + 0.004], P.rim),   // and the two sides
    sub(b, [0, py, 0], [pw + 0.018, ph + 0.018, hz + 0.003], P.bezel), sub(b, [0, py, 0], [pw, ph, hz + 0.0035], P.glass),                 // the viewport in its bezel
    sub(b, [-pw * 0.15, py, hz + 0.0037], [pw * 0.55, 0.0035, 0.0003], P.glint, 0.42),                                                  // a glint across the glass
    sub(b, [0, py - ph - 0.055, hz + 0.0015], [pw + 0.018, 0.011, 0.0018], mark),                                                       // his pair's colour under it
    sub(b, [0.03, S.grip, -hz - 0.03], [0.012, 0.09, 0.012], P.strap), sub(b, [0.17, S.grip - 0.14, -hz - 0.012], [0.02, 0.07, 0.012], P.strap)); // behind it: the grip in his fist (shieldLayer's wrist), the strap his forearm lies in
  for (const [x, y] of [[0.03, S.grip + 0.09], [0.03, S.grip - 0.09], [0.17, S.grip - 0.07], [0.17, S.grip - 0.21]]) out.push(sub(b, [x, y, hz + 0.001], [0.013, 0.013, 0.0025], P.bolt));   // their bolts, through the face
}
/** the shield as this view draws it (the game's own is one dark slab and a strip: from across a room that is all it is): a matt face in a rubber edge, a glass
 *  viewport in its bezel, the grip and the forearm strap behind, their bolt heads on the face */
const PLATE = { face: [0.015, 0.016, 0.018] as Vec3, rim: [0.045, 0.046, 0.048] as Vec3, bezel: [0.06, 0.063, 0.068] as Vec3, glass: [0.15, 0.21, 0.24] as Vec3, glint: [0.5, 0.58, 0.62] as Vec3, strap: [0.09, 0.08, 0.06] as Vec3, bolt: [0.2, 0.2, 0.2] as Vec3, edge: 0.011 };

/** a box in another box's own frame: `off` from its centre along its axes, half sizes `h`, rolled `roll` about its long (z) axis */
function sub(b: Bx, off: Vec3, h: Vec3, albedo: Vec3, roll = 0): Bx {
  const q = b.rot ?? quat.yaw(b.yaw ?? 0), o = quat.rotate(q, off);
  return { c: [b.c[0] + o[0], b.c[1] + o[1], b.c[2] + o[2]], h, rot: roll ? quat.mul(q, quat.axisAngle([0, 0, 1], roll)) : q, albedo };
}
/** THE SIDEARM UP CLOSE. The game draws a pistol as a slab and a square can, which is all its camera ever shows; this view is a metre away, so the SAME boxes
 *  (where the rig puts them, at their sizes) are dressed here: a steel slide over a polymer frame with its sights and trigger guard, the can as an eight-sided
 *  tube with a bore, and on the thigh a holster round the gun (no can on a holstered gun: it would hang to the knee). The figure's own picture; the game's rig is not touched. */
const DRESS = { slide: [0.085, 0.085, 0.088] as Vec3, frame: [0.016, 0.016, 0.017] as Vec3, can: [0.075, 0.063, 0.048] as Vec3, canSuit: [0.05, 0.05, 0.053] as Vec3, bore: [0.008, 0.008, 0.008] as Vec3,
  shell: [0.21, 0.17, 0.115] as Vec3, shellSuit: [0.03, 0.03, 0.033] as Vec3 };
function dress(bx: Bx[], meta: RigNodeMeta[], suit: boolean): Bx[] {
  const drop = new Set<number>(), add: Bx[] = [], D = DRESS;
  const at = (p: string) => { const m = meta.find(m => m.path === p); return m && m.boxCount > 0 && bx[m.boxStart] ? m : null; };
  for (const p of ['pistol.slide', 'guardPistol.slide']) { const m = at(p); if (!m) continue;
    const b = bx[m.boxStart], [th, ta, ln] = b.h; drop.add(m.boxStart);
    add.push(sub(b, [0, ta * 0.4, 0], [th * 0.94, ta * 0.6, ln], D.slide),                                 // the slide
      sub(b, [0, -ta * 0.58, -ln * 0.06], [th * 0.86, ta * 0.42, ln * 0.92], D.frame),                     // the frame under it
      sub(b, [0, ta + 0.0025, ln - 0.007], [0.0018, 0.0028, 0.004], D.slide),                              // front sight
      sub(b, [0, ta + 0.0025, -ln + 0.008], [th * 0.6, 0.0028, 0.004], D.slide),                           // rear sight
      sub(b, [0, -ta - 0.02, -ln * 0.29], [0.004, 0.0026, ln * 0.23], D.frame),                            // trigger guard: its bar,
      sub(b, [0, -ta - 0.0105, -ln * 0.06 - 0.0026], [0.004, 0.0105, 0.0026], D.frame)); }                 // and its front
  { const m = at('pistol.suppressor'); if (m) { const b = bx[m.boxStart], a = Math.min(b.h[0], b.h[1]) * 0.93, ln = b.h[2]; drop.add(m.boxStart);
    for (let k = 0; k < 4; k++) add.push(sub(b, [0, 0, 0], [a, a * 0.4142, ln], suit ? D.canSuit : D.can, k * Math.PI / 4));
    add.push(sub(b, [0, 0, ln + 0.0006], [a * 0.3, a * 0.3, 0.0008], D.bore)); } }
  { const m = at('holster'); if (m) { const b = bx[m.boxStart], [th, ta, ln] = b.h; if (m.boxCount > 2) drop.add(m.boxStart + 2);
    add.push(sub(b, [0, -ta * 0.1, ln * 0.24], [th + 0.005, ta + 0.004, ln * 0.8], suit ? D.shellSuit : D.shell)); } }
  if (!drop.size && !add.length) return bx;
  return bx.filter((_, i) => !drop.has(i)).concat(add);
}

/** the coarse points and normals of the pose he is in now: the worn vertices skinned, the boxes where the rig puts them */
function coarse(F: Fig, normals = false): void {
  const { uv, CP, CN, cI, nBody } = F, m = F.ch.mesh, jd = F.c.skel.jointData, pos = m.positions, jn = m.joints, wt = m.weights;
  for (let i = 0; i < nBody; i++) {
    const vi = uv[i], px = pos[vi * 3], py = pos[vi * 3 + 1], pz = pos[vi * 3 + 2]; let x = 0, y = 0, z = 0;
    for (let k = 0; k < 4; k++) { const w = wt[vi * 4 + k]; if (w === 0) continue; const q = jn[vi * 4 + k] * 16;
      x += w * (jd[q] * px + jd[q + 4] * py + jd[q + 8] * pz + jd[q + 12]); y += w * (jd[q + 1] * px + jd[q + 5] * py + jd[q + 9] * pz + jd[q + 13]); z += w * (jd[q + 2] * px + jd[q + 6] * py + jd[q + 10] * pz + jd[q + 14]); }
    const o = i * 3; CP[o] = x; CP[o + 1] = y; CP[o + 2] = z;
  }
  if (normals) CN.fill(0, 0, nBody * 3);
  for (let t = 0, T = normals ? F.nBodyTri * 3 : 0; t < T; t += 3) {
    const a = cI[t] * 3, b = cI[t + 1] * 3, c = cI[t + 2] * 3, ux = CP[b] - CP[a], uy = CP[b + 1] - CP[a + 1], uz = CP[b + 2] - CP[a + 2], vx = CP[c] - CP[a], vy = CP[c + 1] - CP[a + 1], vz = CP[c + 2] - CP[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    CN[a] += nx; CN[a + 1] += ny; CN[a + 2] += nz; CN[b] += nx; CN[b + 1] += ny; CN[b + 2] += nz; CN[c] += nx; CN[c + 1] += ny; CN[c + 2] += nz;
  }
  for (let i = 0; normals && i < nBody; i++) { const o = i * 3, L = (Math.hypot(CN[o], CN[o + 1], CN[o + 2]) || 1) * F.flip; CN[o] /= L; CN[o + 1] /= L; CN[o + 2] /= L; }
  let bx: Bx[] = []; try { bx = F.boxes(); } catch { /* a rig the cast has no bone for: the boxes stay where they were */ }
  if (bx.length === F.nBox) for (let k = 0; k < bx.length; k++) boxPoints(bx[k], CP, CN, nBody + k * 24);
}
/** the lumels over him, where the coarse points are (the build's pose: the one the rays are traced in) */
function lumels(F: Fig): void {
  const { LA, LB, LC, LWb, LWc, CP, CN, LP0: LP, LN0: LN } = F;
  for (let i = 0, n = F.nL; i < n; i++) {
    const a = LA[i] * 3, b = LB[i] * 3, c = LC[i] * 3, wb = LWb[i], wc = LWc[i], wa = 1 - wb - wc, o = i * 3;
    LP[o] = wa * CP[a] + wb * CP[b] + wc * CP[c]; LP[o + 1] = wa * CP[a + 1] + wb * CP[b + 1] + wc * CP[c + 1]; LP[o + 2] = wa * CP[a + 2] + wb * CP[b + 2] + wc * CP[c + 2];
    const x = wa * CN[a] + wb * CN[b] + wc * CN[c], y = wa * CN[a + 1] + wb * CN[b + 1] + wc * CN[c + 1], z = wa * CN[a + 2] + wb * CN[b + 2] + wc * CN[c + 2], L = Math.hypot(x, y, z) || 1;
    LN[o] = x / L; LN[o + 1] = y / L; LN[o + 2] = z / L;
  }
}

/** which man of the cast stands on the kit screen for a roster place (0 = you): the game's own deal — `tools/qa/kit-figure-roster-check.ts` holds it against the men a mission stages */
export const figureMan = (cast: CastInfo, member: number): CastVariant | null => member === 0 ? castSide(cast, 'operator')[0] ?? null : operatorAt(cast, member - 1);

function build(ask: FigureAsk, key: string): Fig | null {
  const ch = castFor(ask.look); if (!ch) return null;
  const look = ch === other ? ask.look : lookDress();   // (the other file never came: this page's own dress, cast and palette together)
  return ownDie(() => inDress(look, () => buildOf(ch, ask, key, look)), 0x2f6e2b1);
}
function buildOf(ch: GltfCharacter, ask: FigureAsk, key: string, look: boolean): Fig | null {
  const m = ask.card, me = ask.member === 0, id = me ? PLAYER_ID : 20 + ask.member - 1;
  const man = me ? null : rosterOf(ask.squad)[ask.member - 1], sq = man ? SQUAD4.find(s => s.name === man.name) : null;
  let tint: Vec3 = me ? [0.05, 0.06, 0.07] : sq?.tint ?? [0.06, 0.075, 0.13], tint2: Vec3 = me ? [0.1, 0.32, 0.18] : sq?.tint2 ?? [0.07, 0.2, 0.6];
  if (m.suit !== 'issued' && SUITS[m.suit]) tint = SUITS[m.suit].tint;
  if (m.trim !== 'issued' && TRIMS[m.trim]) tint2 = TRIMS[m.trim].tint;
  const c = new Character(ch, { id, tint, tint2, pos: [0, 0, 0], yaw: 0 });
  if (ch.cast) {   // (game/cast.ts's deal: Sam the first operator, a teammate one of the rest by his place on the roster — `operatorAt`, the game's own)
    const v = figureMan(ch.cast, ask.member);
    if (v) c.parts = ask.suit ? castSuit(ch.cast, v.mask) : castGoggles(ch.cast, v.mask, me || m.nvg); }
  // the gun his card names, as the game hands it out (kit.ts kitGun, kitPlayer; guards.ts rigOf)
  const shield = !me && m.shield && SHIELD.on, fit = KITANIM.on && KITANIM.grips;
  const rig = me ? (m.weapon === 'pistol' ? 'pistol' : 'sc20k') : WEAPONS[kitGun(m)].rig;
  const a = c.anim; a.phase = 0; a.trained = 1; a.upper = 'none'; a.stance = 'none';
  for (let i = 0; i < 30; i++) c.update(1 / 60);
  if (rig === 'sc20k') { a.longGun = true; a.longSteady = 1; a.longGrip = sc20kGrip(undefined, fit); c.muzzleAhead = sc20kMuzzleAhead(); a.stance = 'lowReady'; }
  else if (rig === 'carbine') { a.longGun = true; a.longSteady = 0; a.longGrip = carbineGrip(); c.muzzleAhead = carbineMuzzleAhead(); a.stance = 'lowReady'; }
  else { a.upper = 'relaxed'; a.stance = FIGURE.pose.pistol; }   // (the pistol in both hands at the game's own low ready, as the rifle is: the relaxed carry points it across his chest)
  a.lookPitchExtra = FIGURE.pose.chin; a.lookYawExtra = FIGURE.pose.turn;
  if (shield) a.shield = true;
  // IN HAND (game/inhand.ts): the word the game's drawer says of his right hand, row for row (combat.ts: handPropsRaw for you, guardKit for a teammate) — said before
  // the pose is baked, so the figure's own look-only pass has the hand where the game's has it: a long gun stays put and the trigger hand goes onto its grip (yours
  // is drawn fitted into the hand by kit handling instead, as in the game), a pistol is laid out in the hand's own frame. Off (`?inhand=0`): no word, the figure as it was.
  const hold: InHandWord | null = !INHAND.on ? null
    : me ? (rig === 'pistol' ? IN_PISTOL : !fit && INHAND.long ? longHold('sc20k') : null)
    : rig === 'sc20k' || rig === 'carbine' ? (INHAND.long ? longHold(rig) : null) : IN_PISTOL;
  c.inHand = hold;
  for (let i = 0; i < 100; i++) c.update(1 / 60);
  c.pos = [0, 0, 0]; c.update(0);

  // the body: the worn parts' triangles, a paint a material slot
  const mesh = ch.mesh, sd = charSlots(ch), part = mesh.part, mask = c.parts, worn = (v: number) => !part || !ch.cast || ((mask >>> part[v]) & 1) === 1;
  const pal = new Float32Array(CHAR_MAT_FLOATS); writeCharPalette(pal, 0, 'operator', tint, tint2, id, !sd.authored, ask.suit);
  const mats: number[] = [], matKey = new Map<string, number>();
  const paint = (r: number, g: number, b: number): number => {
    if (Math.max(r, g, b) < 0.02) { r += 0.012; g += 0.012; b += 0.012; }   // (the kit's black is black: lifted a hair so a gun reads against the dark ground)
    const k = `${r.toFixed(4)},${g.toFixed(4)},${b.toFixed(4)}`; let i = matKey.get(k); if (i === undefined) { i = mats.length / 3; mats.push(r, g, b); matKey.set(k, i); } return i; };
  const slotMat: number[] = []; for (let s = 0; s <= 10; s++) slotMat.push(paint(pal[8 + s * 8], pal[8 + s * 8 + 1], pal[8 + s * 8 + 2]));
  const idx = mesh.indices, remap = new Int32Array(mesh.vertexCount).fill(-1), uv: number[] = [], cI: number[] = [], cM: number[] = [];
  const vert = (i: number) => { let r = remap[i]; if (r < 0) { r = remap[i] = uv.length; uv.push(i); } return r; };
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2]; if (!worn(i0) || !worn(i1) || !worn(i2)) continue;
    cI.push(vert(i0), vert(i1), vert(i2)); cM.push(slotMat[Math.min(sd.slot[i0], 10)]);
  }
  const nBody = uv.length, nBodyTri = cM.length;

  // what is bolted to him: the game's own boxes for the gun, the holster, the goggles — asked again every frame, where his hands are then
  const suitOn = ask.suit, pouchSlim = ask.suit && !!ch.cast;
  const rigged = (): { bx: Box[]; meta: RigNodeMeta[] } => {
    const bx: Box[] = [], meta: RigNodeMeta[] = [];
    if (me) rigBoxes(c, { goggles: !suitOn || !ch.cast, nv: false, slot: rig === 'pistol' ? 1 : 0, lightOn: false, isGuard: false, holster: true, held: null, knife: false, rifle: rig === 'sc20k' ? 'hand' : null, rifleBlack: suitOn, rifleLight: false, ...(CLOSE.on ? { sheath: true } : null), ...(fit ? { fit } : null), ...(INHAND.on ? { inHand: true } : null) }, bx, RIG, meta);
    else if (rig === 'sc20k') rigBoxes(c, { goggles: m.nvg, nv: false, slot: 0, lightOn: false, isGuard: false, holster: true, rifle: 'hand', rifleBlack: suitOn, rifleLight: false }, bx, RIG, meta);
    else if (rig === 'pistol') rigBoxes(c, { goggles: m.nvg, nv: false, slot: 1, lightOn: false, isGuard: false, ...(hold ? { inHand: true, ...(INHAND.fit ? { fit: true } : null) } : null) }, bx, RIG, meta);
    else { rigBoxes(c, { goggles: false, nv: false, slot: 1, lightOn: false, isGuard: true, torch: false, weapon: rig === 'carbine' ? 'carbine' : 'pistol', ...(hold === IN_PISTOL ? { inHand: true } : null) }, bx, RIG, meta); if (m.nvg) gogglesBoxes(c, false, bx, RIG.goggles); }
    return { bx, meta };
  };
  const boxes = (): Bx[] => {
    const { bx, meta } = rigged();
    const out: Bx[] = dress(bx, meta, suitOn); if (shield) plate(c, out, tint2); pouches(c, m, out, pouchSlim);
    return out;
  };
  let first: Bx[] = []; try { first = boxes(); } catch { /* a rig the cast has no bone for: the man alone */ }
  const nBox = first.length, nC = nBody + nBox * 24;
  for (let k = 0; k < nBox; k++) { const mt = paint(first[k].albedo[0], first[k].albedo[1], first[k].albedo[2]);
    for (let f = 0; f < 6; f++) { const v0 = nBody + k * 24 + f * 4; cI.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3); cM.push(mt, mt); } }
  const G = FIGURE.ground, gp = look && LOOK.on ? G.look : G.plain, day = ask.hour && ask.hour !== 'night' ? HOURS[ask.hour] : null, gc = day ? cloudSoft(Math.max(ask.cloud ?? 0, day.cloud ?? 0)) : 0,
    gs = day ? Math.min(FIGURE.day.groundCloud, FIGURE.day.ground * 0.83 / Math.max(0.2, Math.sin(day.sun.elevDeg * Math.PI / 180))) : 0,
    gk = day ? gs + (FIGURE.day.groundCloud - gs) * gc : G.night, matGround = paint(gp[0] * gk, gp[1] * gk, gp[2] * gk);   // (by day the whole ground is in the sun: held down, or he stands on a white disc)

  const F = { key, ch, c, top: FIGURE.tall, lead: yawOf(ask) !== FIGURE.yaw ? FIGURE.lead : 0, word: '', uv: new Uint32Array(uv), nBody, nBodyTri, flip: 1, boxes: nBox ? boxes : () => [], nBox, rigged,
    CP: new Float32Array(nC * 3), CN: new Float32Array(nC * 3), cI: new Uint32Array(cI), cM: new Uint16Array(cM), mats: new Float32Array(mats), matGround } as Fig;
  Object.assign(F, lightOf(ask.hour, ask.cloud, yawOf(ask) - FIGURE.yaw));
  coarse(F, true);
  { // which way the mesh is wound (6 × its signed volume): the normals point out
    let vol = 0; const P = F.CP;
    for (let t = 0; t < nBodyTri * 3; t += 3) { const a = cI[t] * 3, b = cI[t + 1] * 3, cc = cI[t + 2] * 3;
      vol += P[a] * ((P[b + 1] - P[a + 1]) * (P[cc + 2] - P[a + 2]) - (P[b + 2] - P[a + 2]) * (P[cc + 1] - P[a + 1])) + P[a + 1] * ((P[b + 2] - P[a + 2]) * (P[cc] - P[a]) - (P[b] - P[a]) * (P[cc + 2] - P[a + 2])) + P[a + 2] * ((P[b] - P[a]) * (P[cc + 1] - P[a + 1]) - (P[b + 1] - P[a + 1]) * (P[cc] - P[a])); }
    if (vol < 0) { F.flip = -1; coarse(F, true); } }
  lattice(F);
  { let h = 0x811c9dc5; const feed = (v: number) => { h ^= v & 0xffff; h = Math.imul(h, 0x01000193) >>> 0; };   // (his word: every coarse point to the millimetre, every paint)
    for (let i = 0; i < F.CP.length; i++) feed(Math.round(F.CP[i] * 1000)); for (let i = 0; i < F.mats.length; i++) feed(Math.round(F.mats[i] * 4096)); for (let i = 0; i < F.cM.length; i++) feed(F.cM[i]);
    F.word = h.toString(16).padStart(8, '0'); }
  return F;
}

/** Cut the coarse triangles into the lumel lattice (a triangle's edges into equal parts by its longest; points on an edge two triangles cut alike are shared), lay the ground's
 *  rings, freeze the pose for the rays, and start the light with nothing traced. */
function lattice(F: Fig): void {
  const { CP, cI } = F, nC = CP.length / 3, nT = cI.length / 3, S = FIGURE.lumel, CUT = FIGURE.cuts;
  const LA: number[] = [], LB: number[] = [], LC: number[] = [], LWb: number[] = [], LWc: number[] = [], GI: number[] = [], grid: number[] = [];
  const gN = new Uint8Array(nT), gOff = new Int32Array(nT).fill(-1);
  const corner = new Int32Array(nC).fill(-1), edges = new Map<number, number>();
  const lum = (a: number, b: number, c: number, wb: number, wc: number) => { LA.push(a); LB.push(b); LC.push(c); LWb.push(wb); LWc.push(wc); return LA.length - 1; };
  const cornerOf = (v: number) => corner[v] >= 0 ? corner[v] : (corner[v] = lum(v, v, v, 0, 0));
  const edge = (p: number, q: number, n: number, k: number) => { const lo = p < q ? p : q, hi = p < q ? q : p, kk = p < q ? k : n - k, key = ((lo * nC + hi) * 16 + n) * 16 + kk;
    let l = edges.get(key); if (l === undefined) { l = lum(lo, hi, lo, kk / n, 0); edges.set(key, l); } return l; };
  const row: number[] = [], pairs: number[] = [], LSa: number[] = [];
  for (let t = 0; t < nT; t++) {
    const a = cI[t * 3], b = cI[t * 3 + 1], c = cI[t * 3 + 2], d = (i: number, j: number) => Math.hypot(CP[i * 3] - CP[j * 3], CP[i * 3 + 1] - CP[j * 3 + 1], CP[i * 3 + 2] - CP[j * 3 + 2]);
    const long = Math.max(d(a, b), d(b, c), d(a, c)), n = Math.max(1, Math.min(CUT, Math.ceil(long / S))), cell = long / n;
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++)
      row[i * (n + 1) + j] = i === 0 && j === 0 ? cornerOf(a) : i === n ? cornerOf(b) : j === n ? cornerOf(c) : j === 0 ? edge(a, b, n, i) : i === 0 ? edge(a, c, n, j) : i + j === n ? edge(b, c, n, j) : lum(a, b, c, i / n, j / n);
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) { const l = row[i * (n + 1) + j]; if (!(LSa[l] <= cell)) LSa[l] = cell;
      if (i + j < n) { const r = row[(i + 1) * (n + 1) + j], u = row[i * (n + 1) + j + 1]; pairs.push(l, r, l, u, r, u); } }
    gN[t] = n; if (n > 1) { gOff[t] = grid.length; for (let k = 0, K = (n + 1) * (n + 1); k < K; k++) grid.push(row[k] ?? 0); }
  }
  const nL = LA.length, G = FIGURE.ground, nG = 1 + G.rings * G.sectors, nA = nL + nG;
  F.nL = nL; F.nG = nG; F.corner = corner;
  F.LA = new Uint32Array(LA); F.LB = new Uint32Array(LB); F.LC = new Uint32Array(LC); F.LWb = new Float32Array(LWb); F.LWc = new Float32Array(LWc);
  F.LP0 = new Float32Array(nA * 3); F.LN0 = new Float32Array(nA * 3); F.LAl = new Float32Array(nA).fill(1); F.gN = gN; F.gOff = gOff; F.grid = new Int32Array(grid);
  // the ground: a point under him, then rings that crowd to his feet
  const ring = (i: number, s: number) => i === 0 ? nL : nL + 1 + (i - 1) * G.sectors + (s % G.sectors);
  F.LN0[nL * 3 + 1] = 1;
  for (let i = 1; i <= G.rings; i++) { const r = G.r * Math.pow(i / G.rings, G.pow), k = Math.min(1, Math.max(0, (r / G.r - G.fade) / (1 - G.fade)));
    for (let s = 0; s < G.sectors; s++) { const l = ring(i, s), th = s / G.sectors * Math.PI * 2; F.LP0[l * 3] = r * Math.cos(th); F.LP0[l * 3 + 2] = r * Math.sin(th); F.LN0[l * 3 + 1] = 1; F.LAl[l] = 1 - k * k * (3 - 2 * k); } }
  for (let s = 0; s < G.sectors; s++) GI.push(ring(0, 0), ring(1, s), ring(1, s + 1));
  for (let i = 1; i < G.rings; i++) for (let s = 0; s < G.sectors; s++) GI.push(ring(i, s), ring(i + 1, s), ring(i + 1, s + 1), ring(i, s), ring(i + 1, s + 1), ring(i, s + 1));
  F.GI = new Uint32Array(GI);
  for (let t = 0; t < GI.length; t += 3) pairs.push(GI[t], GI[t + 1], GI[t + 1], GI[t + 2], GI[t], GI[t + 2]);
  { // who is beside whom (each pair once a triangle that has it: an edge two triangles share counts twice, which only leans the mean toward it)
    const nb0 = new Uint32Array(nA + 1); for (let k = 0; k < pairs.length; k++) nb0[pairs[k] + 1]++; for (let i = 0; i < nA; i++) nb0[i + 1] += nb0[i];
    const nb = new Uint32Array(pairs.length), at = nb0.slice(0, nA); for (let k = 0; k < pairs.length; k += 2) { const a = pairs[k], b = pairs[k + 1]; nb[at[a]++] = b; nb[at[b]++] = a; }
    F.nb0 = nb0; F.nb = nb; F.LS = new Float32Array(nL); for (let i = 0; i < nL; i++) F.LS[i] = LSa[i] ?? S;
    F.indS = new Float32Array(nA * 3); F.indT = new Float32Array(nA * 3); }
  lumels(F);
  F.tc1 = new Float32Array(nT * 9); F.tcg = new Float32Array(grid.length * 3); F.toned = -1;
  F.cW = new Int8Array(nT);
  for (let t = 0; t < nT; t++) { const a = cI[t * 3] * 3, b = cI[t * 3 + 1] * 3, c = cI[t * 3 + 2] * 3, N = F.CN, ux = CP[b] - CP[a], uy = CP[b + 1] - CP[a + 1], uz = CP[b + 2] - CP[a + 2], vx = CP[c] - CP[a], vy = CP[c + 1] - CP[a + 1], vz = CP[c + 2] - CP[a + 2];
    F.cW[t] = (uy * vz - uz * vy) * (N[a] + N[b] + N[c]) + (uz * vx - ux * vz) * (N[a + 1] + N[b + 1] + N[c + 1]) + (ux * vy - uy * vx) * (N[a + 2] + N[b + 2] + N[c + 2]) >= 0 ? 1 : -1; }
  F.bvh = buildBvh(F.CP, F.cI);
  const K = F.lamps.length, sky = F.sky;
  F.vis = new Float32Array(nA * K).fill(1); F.ind = new Float32Array(nA * 3); F.E = new Float32Array(nA * 3); F.pass = 0; F.cursor = 0;
  F.hs = new Float32Array(nA * 4); for (let i = 0; i < nA; i++) for (let k = 0; k < 4; k++) F.hs[i * 4 + k] = hash01(i, k);
  for (let i = 0; i < nA; i++) { const u = Math.min(1, Math.max(0, F.LN0[i * 3 + 1]) * F.ramp); for (let k = 0; k < 3; k++) F.ind[i * 3 + k] = sky[1][k] + (sky[0][k] - sky[1][k]) * u; }   // (the first guess at second-hand light: the sky his normal faces)
  F.X = new Float32Array(nC); F.Y = new Float32Array(nC); F.Z = new Float32Array(nC); F.GX = new Float32Array(nG); F.GY = new Float32Array(nG);
  F.PX = new Float32Array(nC); F.PY = new Float32Array(nC); F.mv = new Float32Array(nC); F.pOk = false;
  shade(F);
}
/** the ground lumel nearest a spot on it */
function groundAt(F: Fig, x: number, z: number): number {
  const G = FIGURE.ground, r = Math.hypot(x, z), i = Math.min(G.rings, Math.round(G.rings * Math.pow(r / G.r, 1 / G.pow)));
  if (i <= 0) return F.nL;
  let s = Math.round(Math.atan2(z, x) / (Math.PI * 2) * G.sectors) % G.sectors; if (s < 0) s += G.sectors;
  return F.nL + 1 + (i - 1) * G.sectors + s;
}

// ------------------------------------------------------------ the light

/** The light he stands in. Night (and no hour): this view's own lamp and back light under a night sky, the room's warm return on his dark side. An hour of the day:
 *  that hour's sun as one far lamp — its height, its colour and strength on a face turned to it, its width — and that hour's sky for everything a ray leaves by, in
 *  the game's own units at the game's own exposure; `cloud` (0‥1, the picked weather's cover) dims the sun and moves its light to the sky as the game's does. */
function lightOf(hour: HourId | undefined, cloud = 0, turn = 0): Pick<Fig, 'lamps' | 'sky' | 'ex' | 'ramp' | 'fill' | 'back' | 'backA'> {
  const B = FIGURE.back, co = Math.cos(turn), si = Math.sin(turn);
  // (the lamps hang where the VIEW has them: a man shown from another side — the pistol, the shield — keeps his key on the camera's one hand and his rim on the other)
  const round = (v: Vec3): Vec3 => [v[0] * co + v[2] * si, v[1], v[2] * co - v[0] * si], hung = (l: Lamp): Lamp => ({ ...l, p: round(l.p), aim: round(l.aim) });
  if (!hour || hour === 'night') return { lamps: FIGURE.lamps.map(hung), sky: FIGURE.sky, ex: FIGURE.exposure, ramp: 1, fill: { ...FIGURE.glow, dir: round(FIGURE.glow.dir) }, back: B.night, backA: B.nightA };
  const H = HOURS[hour], D = FIGURE.day, rad = Math.PI / 180, b = D.off * rad, e = H.sun.elevDeg * rad, d = D.far, [cs, ck] = cloudLight(H, cloud), w = cloudSoft(Math.max(cloud, H.cloud ?? 0));
  // (under a picked weather's cloud the hour's colours drain toward a deck's grey, as the game's own do: hours.ts underWeather)
  const soft = Math.max(0, cloudSoft(cloud) - cloudSoft(H.cloud ?? 0)), sc = greyed(H.sun.color, soft), zen = greyed(H.sky.zenith, soft), hor = greyed(H.sky.horizon, soft);
  const k = H.sun.intensity * D.sunK * cs * d * d;
  // (he faces +z, +x is the side the night's lamp hangs on)
  const p: Vec3 = round([Math.sin(b) * Math.cos(e) * d, 1 + Math.sin(e) * d, Math.cos(b) * Math.cos(e) * d]);
  const sun: Lamp = { p, r: Math.tan(Math.max(H.sun.radius + (0.25 - H.sun.radius) * (H.sun.radius < 0.25 ? w : 0), D.soft)) * d, col: [sc[0] * k, sc[1] * k, sc[2] * k], aim: [0, 1, 0], cone: [50, 70] };
  const sk = (c: Vec3, q = D.skyK * ck): Vec3 => [c[0] * q, c[1] * q, c[2] * q];
  // (the sky's own colour as a rim from his other side, where the night's hangs: his outline at any hour)
  const R = hung(FIGURE.lamps[1]), lum = (c: Vec3) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], zm = Math.max(zen[0], zen[1], zen[2]) || 1;
  const rd = Math.hypot(R.p[0] - R.aim[0], R.p[1] - R.aim[1], R.p[2] - R.aim[2]), rk = (lum(sc) * H.sun.intensity * D.sunK * cs * D.rimSun + lum(zen) * D.skyK * ck * D.rimSky) * rd * rd / zm;
  const rim: Lamp = { ...R, col: [zen[0] * rk, zen[1] * rk, zen[2] * rk] };
  return { lamps: [sun, rim], sky: [sk(zen), sk(hor)], ex: H.exposure * D.exK * Math.pow(cloudSun(Math.max(cloud, H.cloud ?? 0)) / cloudSun(H.cloud ?? 0), -D.lift), ramp: D.ramp, fill: null, back: sk(hor, D.skyK * ck * B.dayK), backA: B.dayA };
}

/** a lamp's light on a spot with that normal, before its colour and before anything in the way (falls with the square of the distance; its cone's soft edge) */
function lampOn(k: number, x: number, y: number, z: number, nx: number, ny: number, nz: number): number {
  const q = LQ[k], lx = q[5] - x, ly = q[6] - y, lz = q[7] - z, nl = nx * lx + ny * ly + nz * lz; if (nl <= 0) return 0;
  const d2 = lx * lx + ly * ly + lz * lz, d = Math.sqrt(d2), ca = -(lx * q[0] + ly * q[1] + lz * q[2]) / d; if (ca <= q[4]) return 0;
  const t = ca >= q[3] ? 1 : (ca - q[4]) / (q[3] - q[4]);
  return nl / (d * d2) * t * t * (3 - 2 * t);
}
/** each lamp's axis, the cosines of its cone and its place, read off the table once a call of shade / refine (the table is the tuner's to edit) */
let LQ: Float64Array[] = [];
function lampsNow(F: Fig): void {
  LQ = F.lamps.map(L => { const ax = L.aim[0] - L.p[0], ay = L.aim[1] - L.p[1], az = L.aim[2] - L.p[2], al = Math.hypot(ax, ay, az) || 1;
    return new Float64Array([ax / al, ay / al, az / al, Math.cos(L.cone[0] * Math.PI / 180), Math.cos(L.cone[1] * Math.PI / 180), L.p[0], L.p[1], L.p[2]]); });
}
/** the light on every lumel as the tracing stands: each lamp by the share of it the rays found, plus the second-hand light */
function shade(F: Fig): void {
  const { LP0: LP, LN0: LN, vis, E, nb0, nb } = F, lamps = F.lamps, K = lamps.length, n = F.nL + F.nG; lampsNow(F);
  // the second-hand light, evened over each lumel's neighbours by how alike they face
  let ind = F.ind;
  for (let it = 0; it < FIGURE.smooth; it++) { const dst = it & 1 ? F.indT : F.indS;
    for (let i = 0; i < n; i++) { const o = i * 3, nx = LN[o], ny = LN[o + 1], nz = LN[o + 2]; let r = ind[o], g = ind[o + 1], b = ind[o + 2], w = 1;
      for (let q = nb0[i], q1 = nb0[i + 1]; q < q1; q++) { const j = nb[q] * 3; let d = nx * LN[j] + ny * LN[j + 1] + nz * LN[j + 2]; if (d <= 0) continue; d *= d; r += ind[j] * d; g += ind[j + 1] * d; b += ind[j + 2] * d; w += d; }
      dst[o] = r / w; dst[o + 1] = g / w; dst[o + 2] = b / w; }
    ind = dst; }
  for (let i = 0; i < n; i++) {
    const o = i * 3, x = LP[o], y = LP[o + 1], z = LP[o + 2], nx = LN[o], ny = LN[o + 1], nz = LN[o + 2];
    let r = ind[o], g = ind[o + 1], b = ind[o + 2];
    for (let k = 0; k < K; k++) { const v = vis[i * K + k]; if (v <= 0) continue; const L = lamps[k], e = lampOn(k, x, y, z, nx, ny, nz) * v; if (e > 0) { r += e * L.col[0]; g += e * L.col[1]; b += e * L.col[2]; } }
    E[o] = r; E[o + 1] = g; E[o + 2] = b;
  }
  F.toned = -1;
}
/** the shown colour of every lattice place of every triangle: its paint under the light on its lumel, through the game's tone curve */
function tint(F: Fig): void {
  const { E, mats, cM, cI, corner, gN, gOff, grid, tc1, tcg } = F, ex = F.ex, c8 = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v;
  for (let t = 0, nT = cM.length; t < nT; t++) {
    const m = cM[t] * 3, ar = mats[m] * ex, ag = mats[m + 1] * ex, ab = mats[m + 2] * ex, n = gN[t];
    if (n <= 1) for (let k = 0; k < 3; k++) { const l = corner[cI[t * 3 + k]] * 3, o = t * 9 + k * 3; toneInto(tc1, o, ar * E[l], ag * E[l + 1], ab * E[l + 2]); tc1[o] = c8(tc1[o]); tc1[o + 1] = c8(tc1[o + 1]); tc1[o + 2] = c8(tc1[o + 2]); }
    else for (let i = 0, q0 = gOff[t]; i <= n; i++) for (let j = 0; j <= n - i; j++) { const q = q0 + i * (n + 1) + j, l = grid[q] * 3, o = q * 3; toneInto(tcg, o, ar * E[l], ag * E[l + 1], ab * E[l + 2]); tcg[o] = c8(tcg[o]); tcg[o + 1] = c8(tcg[o + 1]); tcg[o + 2] = c8(tcg[o + 2]); }
  }
  F.toned = ex;
}
/** Trace: lumels from where the last call stopped, until `ms` have gone (or, `whole`, to the end of the pass it is in). True once every pass is done. */
function refine(F: Fig, ms: number, whole = false): boolean {
  const Q = FIGURE; if (F.pass >= Q.passes) return true;
  const { LP0, LN0, vis, ind, E, hs, bvh, cI, cM, mats, corner } = F, lamps = F.lamps, K = lamps.length, n = F.nL + F.nG, sky = F.sky, G = Q.ground;
  const now = typeof performance !== 'undefined' ? () => performance.now() : () => Date.now(), t0 = now();
  const mg = F.matGround * 3, ramp = F.ramp, fill = F.fill; lampsNow(F);
  while (F.pass < Q.passes) {
    const p = F.pass, wv = 1 / (Math.min(p, 255) + 1), wi = 1 / (Q.prior + Math.min(p, 4095) + 1);
    for (let i = F.cursor; i < n; i++) {
      if (!whole && (i & 127) === 0 && i > F.cursor && now() - t0 > ms) { F.cursor = i; return false; }
      const o = i * 3, nx = LN0[o], ny = LN0[o + 1], nz = LN0[o + 2], ox = LP0[o] + nx * Q.lift, oy = LP0[o + 1] + ny * Q.lift, oz = LP0[o + 2] + nz * Q.lift;
      const u = (0.5 + p * R2A + (hs[i * 4] - 0.5) * Q.grain) % 1, v = (0.5 + p * R2B + (hs[i * 4 + 1] - 0.5) * Q.grain) % 1;
      // a place on the ground asks from somewhere in its own cell after the first pass: a shadow's edge then lies across the lattice as a soft step, not as the lattice's own stairs
      let qx = ox, qy = oy, qz = oz;
      if (i < F.nL && p > 0) { const cs = F.LS[i] * Q.cell;   // (on him: somewhere in its cell on its own plane, lifted a little more the further out — the surface curves away under it)
        let ax: number, ay: number, az: number; if (nx > 0.9 || nx < -0.9) { ax = 0; ay = 1; az = 0; } else { ax = 1; ay = 0; az = 0; }
        let ex = ny * az - nz * ay, ey = nz * ax - nx * az, ez = nx * ay - ny * ax; const el = Math.hypot(ex, ey, ez) || 1; ex /= el; ey /= el; ez /= el;
        const fx = ny * ez - nz * ey, fy = nz * ex - nx * ez, fz = nx * ey - ny * ex;
        const ja = ((hs[i * 4 + 3] + p * R2A) % 1 - 0.5) * cs, jb = ((hs[i * 4 + 2] + p * R2B) % 1 - 0.5) * cs, up = 0.25 * (Math.abs(ja) + Math.abs(jb));
        qx += ex * ja + fx * jb + nx * up; qy += ey * ja + fy * jb + ny * up; qz += ez * ja + fz * jb + nz * up; }
      else if (i > F.nL && p > 0) { const r = Math.hypot(ox, oz), dr = G.r * G.pow * Math.pow(r / G.r, 1 - 1 / G.pow) / G.rings, da = Math.PI * 2 * r / G.sectors, ir = 1 / (r || 1);
        const jr = ((hs[i * 4 + 3] + p * R2A) % 1 - 0.5) * dr, ja = ((hs[i * 4 + 2] + p * R2B) % 1 - 0.5) * da; qx += (ox * jr - oz * ja) * ir; qz += (oz * jr + ox * ja) * ir; }
      // each lamp: a ray to a point on its emitter (the first pass: its middle — a hard shadow at once, softened by the passes after)
      for (let k = 0; k < K; k++) {
        const L = lamps[k]; let s = 1;
        if (lampOn(k, ox, oy, oz, nx, ny, nz) > 0) {
          let tx = L.p[0], ty = L.p[1], tz = L.p[2];
          if (p > 0) { const lx = tx - ox, ly = ty - oy, lz = tz - oz, ll = Math.hypot(lx, ly, lz) || 1, ax = lx / ll, ay = ly / ll, az = lz / ll;
            let bx = ay, by = -ax, bz = 0, bl = Math.hypot(bx, by); if (bl < 1e-4) { bx = 1; by = 0; bl = 1; } bx /= bl; by /= bl;
            const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx, rr = Math.sqrt((u + k * 0.37) % 1) * L.r, th = v * Math.PI * 2, c = Math.cos(th) * rr, sn = Math.sin(th) * rr;
            tx += bx * c + cx * sn; ty += by * c + cy * sn; tz += bz * c + cz * sn; }
          if (occluded(bvh, qx, qy, qz, tx - qx, ty - qy, tz - qz, 1)) s = 0;
        }
        vis[i * K + k] += (s - vis[i * K + k]) * wv;
      }
      // second-hand light: one ray into the half-space he faces, thicker toward the normal; it brings back the lit thing it meets
      const u2 = (hs[i * 4 + 2] + p * 0.8191725133961645) % 1, v2 = (hs[i * 4 + 3] + p * 0.6710436067037893) % 1, rr = Math.sqrt(u2), th = v2 * Math.PI * 2, hx = rr * Math.cos(th), hy = rr * Math.sin(th), hz = Math.sqrt(1 - u2);
      let bx: number, by: number, bz: number; if (nx > 0.9 || nx < -0.9) { bx = 0; by = 1; bz = 0; } else { bx = 1; by = 0; bz = 0; }
      let tx = ny * bz - nz * by, ty = nz * bx - nx * bz, tz = nx * by - ny * bx; const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const sx = ny * tz - nz * ty, sy = nz * tx - nx * tz, sz = nx * ty - ny * tx;
      const dx = tx * hx + sx * hy + nx * hz, dy = ty * hx + sy * hy + ny * hz, dz = tz * hx + sz * hy + nz * hz;
      const tri = closest(bvh, ox, oy, oz, dx, dy, dz, 40), tg = dy < -1e-6 ? -oy / dy : Infinity;
      let er: number, eg: number, eb: number;
      if (tri >= 0 && hitT < tg) { const a = corner[cI[tri * 3]] * 3, b = corner[cI[tri * 3 + 1]] * 3, c = corner[cI[tri * 3 + 2]] * 3, m = cM[tri] * 3;
        er = mats[m] * (E[a] + E[b] + E[c]) / 3; eg = mats[m + 1] * (E[a + 1] + E[b + 1] + E[c + 1]) / 3; eb = mats[m + 2] * (E[a + 2] + E[b + 2] + E[c + 2]) / 3; }
      else if (tg < Infinity) { const gx = ox + dx * tg, gz = oz + dz * tg;
        if (gx * gx + gz * gz < G.r * G.r) { const g = groundAt(F, gx, gz) * 3; er = mats[mg] * E[g]; eg = mats[mg + 1] * E[g + 1]; eb = mats[mg + 2] * E[g + 2]; }
        else { er = sky[0][0]; eg = sky[0][1]; eb = sky[0][2];   // (ground past the patch: what the sky and the lamps put on it, nothing in the way)
          for (let k = 0; k < K; k++) { const L = lamps[k], e = lampOn(k, gx, 0, gz, 0, 1, 0); er += e * L.col[0]; eg += e * L.col[1]; eb += e * L.col[2]; }
          er *= mats[mg]; eg *= mats[mg + 1]; eb *= mats[mg + 2]; } }
      else { const k = Math.min(1, (dy > 0 ? dy : 0) * ramp); er = sky[1][0] + (sky[0][0] - sky[1][0]) * k; eg = sky[1][1] + (sky[0][1] - sky[1][1]) * k; eb = sky[1][2] + (sky[0][2] - sky[1][2]) * k;
        if (fill) { const f = dx * fill.dir[0] + dy * fill.dir[1] + dz * fill.dir[2]; if (f > 0) { const ff = Math.pow(f, fill.pow); er += fill.col[0] * ff; eg += fill.col[1] * ff; eb += fill.col[2] * ff; } } }
      ind[o] += (er - ind[o]) * wi; ind[o + 1] += (eg - ind[o + 1]) * wi; ind[o + 2] += (eb - ind[o + 2]) * wi;
    }
    F.cursor = 0; F.pass++;
    if (whole) break;
  }
  return F.pass >= Q.passes;
}

// ------------------------------------------------------------ the picture: a z-buffer over the lumels' triangles, the game's tone curve, frames blended

interface Buf { w: number; h: number; z: Float32Array; id: Int32Array; b0: Float32Array; b1: Float32Array;
  /** him: the frames so far, blended (colour times cover, cover), and how many; the ground under him (the same form), what it was drawn for; last frame's box */
  hist: Float32Array; n: number; g: Float32Array; gKey: string; box: Int32Array; /** the pixels the last frame wrote (x0, y0, x1, y1): all a page has to lay on its canvas */ up: Int32Array; img: ImageData }
const makeBuf = (w: number, h: number, img: ImageData): Buf => ({ w, h, z: new Float32Array(w * h).fill(Infinity), id: new Int32Array(w * h).fill(-1), b0: new Float32Array(w * h), b1: new Float32Array(w * h),
  hist: new Float32Array(w * h * 4), n: 0, g: new Float32Array(w * h * 4), gKey: '', box: new Int32Array([0, 0, w - 1, h - 1]), up: new Int32Array([0, 0, w - 1, h - 1]), img });
const HALTON = [[0.5, 1 / 3], [0.25, 2 / 3], [0.75, 1 / 9], [0.125, 4 / 9], [0.625, 7 / 9], [0.375, 2 / 9], [0.875, 5 / 9], [0.0625, 8 / 9]];
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const tmp3 = new Float32Array(3), CAM = new Float64Array(14);

/** the camera for a canvas that size: where it is, its axes, the scale that stands his height on `fill` of the canvas (or his width's allowance across it) and his feet on `feet` */
function camera(M: Fig, w: number, h: number, yaw: number): void {
  const F = FIGURE, sy = Math.sin(yaw), cy = Math.cos(yaw), sp = Math.sin(F.pitch), cp = Math.cos(F.pitch);
  const ex = sy * cp * F.dist, ey = M.top * 0.5 + sp * F.dist, ez = cy * cp * F.dist;
  const rx = cy, rz = -sy, wx = -sy * cp, wy = -sp, wz = -cy * cp;       // right; forward (into the picture)
  const upx = -rz * wy, upy = rz * wx - rx * wz, upz = rx * wy;            // up = right × forward
  const dTop = (M.top - ey) * wy - ex * wx - ez * wz, dFoot = -ey * wy - ex * wx - ez * wz;
  const vTop = ((M.top - ey) * upy - ex * upx - ez * upz) / dTop, vFoot = (-ey * upy - ex * upx - ez * upz) / dFoot;
  const f = Math.min(h * F.fill / (vTop - vFoot), w / F.wide * F.dist);
  CAM.set([ex, ey, ez, rx, rz, wx, wy, wz, upx, upy, upz, f, w / 2 + M.lead * sy * f / F.dist, h * F.feet + vFoot * f]);
}
/** points i0 ‥ i1 of `P` onto the canvas (into X, Y, and Z if given, from index 0), (jx, jy) of a pixel off */
function project(P: Float32Array, i0: number, i1: number, X: Float32Array, Y: Float32Array, Z: Float32Array | null, jx: number, jy: number): void {
  const C = CAM, ex = C[0], ey = C[1], ez = C[2], rx = C[3], rz = C[4], wx = C[5], wy = C[6], wz = C[7], upx = C[8], upy = C[9], upz = C[10], f = C[11], cx = C[12] + jx, oy = C[13] + jy;
  for (let i = i0, o = 0; i < i1; i++, o++) { const dx = P[i * 3] - ex, dy = P[i * 3 + 1] - ey, dz = P[i * 3 + 2] - ez, d = dx * wx + dy * wy + dz * wz, k = f / d; X[o] = cx + (dx * rx + dz * rz) * k; Y[o] = oy - (dx * upx + dy * upy + dz * upz) * k; if (Z) Z[o] = d; }
}
/** The ground under him, drawn once for a camera and a state of the tracing (nothing on it moves with his breath: its light is the traced pose's). */
function ground(M: Fig, B: Buf): void {
  const { w, h, g } = B, I = M.GI, X = M.GX, Y = M.GY, E = M.E, Al = M.LAl, nL = M.nL, m = M.matGround * 3, ar = M.mats[m] * M.ex, ag = M.mats[m + 1] * M.ex, ab = M.mats[m + 2] * M.ex;
  g.fill(0); project(M.LP0, nL, nL + M.nG, X, Y, null, 0, 0);
  if (M.backA > 0) { // the air behind him
    const K = FIGURE.back.at, c8 = (v: number) => v < 0 ? 0 : v > 255 ? 255 : v, bx = w / 2, by = K[0] * h, bw = Math.max(1, K[1] * w), bh = Math.max(1, K[2] * h);
    toneInto(tmp3, 0, M.back[0] * M.ex, M.back[1] * M.ex, M.back[2] * M.ex); const cr = c8(tmp3[0]), cg = c8(tmp3[1]), cb = c8(tmp3[2]);
    for (let y = 0; y < h; y++) { const vy = (y + 0.5 - by) / bh, v2 = vy * vy; if (v2 >= 1) continue;
      for (let x = 0; x < w; x++) { const vx = (x + 0.5 - bx) / bw, d = 1 - vx * vx - v2; if (d <= 0) continue; const al = d * d * d * M.backA, o = (y * w + x) * 4; g[o] = cr * al; g[o + 1] = cg * al; g[o + 2] = cb * al; g[o + 3] = al * 255; } } }
  const pool = FIGURE.ground.pool, poolX = w / 2, poolY = pool[0] * h, poolW = Math.max(1, pool[1] * w), poolH = Math.max(1, pool[2] * h), poolSoft = pool[3];   // (a round pool that melts into the page before the picture's own edges cut it)
  for (let t = 0; t < I.length; t += 3) {
    const a = I[t], b = I[t + 1], c = I[t + 2], x0 = X[a - nL], y0 = Y[a - nL], x1 = X[b - nL], y1 = Y[b - nL], x2 = X[c - nL], y2 = Y[c - nL];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (area === 0) continue;
    let minx = x0 < x1 ? x0 : x1, maxx = x0 < x1 ? x1 : x0, miny = y0 < y1 ? y0 : y1, maxy = y0 < y1 ? y1 : y0;
    if (x2 < minx) minx = x2; else if (x2 > maxx) maxx = x2; if (y2 < miny) miny = y2; else if (y2 > maxy) maxy = y2;
    const xa = minx < 0 ? 0 : Math.ceil(minx - 0.5), xb = maxx > w ? w - 1 : Math.floor(maxx - 0.5), ya = miny < 0 ? 0 : Math.ceil(miny - 0.5), yb = maxy > h ? h - 1 : Math.floor(maxy - 0.5);
    if (xa > xb || ya > yb) continue;
    const inv = 1 / area, al0 = Al[a], al1 = Al[b], al2 = Al[c]; if (al0 + al1 + al2 <= 0) continue;
    for (let y = ya; y <= yb; y++) { const py = y + 0.5;
      for (let x = xa; x <= xb; x++) { const px = x + 0.5;
        const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv; if (w0 < 0) continue;
        const w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv; if (w1 < 0) continue;
        const w2 = 1 - w0 - w1; if (w2 < 0) continue;
        const ex = (px - poolX) / poolW, ey = (py - poolY) / poolH, ed = (1 - Math.sqrt(ex * ex + ey * ey)) / poolSoft, ef = ed <= 0 ? 0 : ed >= 1 ? 1 : ed * ed * (3 - 2 * ed); if (ef <= 0) continue;
        const o = (y * w + x) * 4, al = (w0 * al0 + w1 * al1 + w2 * al2) * ef;
        toneInto(tmp3, 0, ar * (w0 * E[a * 3] + w1 * E[b * 3] + w2 * E[c * 3]), ag * (w0 * E[a * 3 + 1] + w1 * E[b * 3 + 1] + w2 * E[c * 3 + 1]), ab * (w0 * E[a * 3 + 2] + w1 * E[b * 3 + 2] + w2 * E[c * 3 + 2]));
        const ia = 1 - al; g[o] = (tmp3[0] < 0 ? 0 : tmp3[0] > 255 ? 255 : tmp3[0]) * al + g[o] * ia; g[o + 1] = (tmp3[1] < 0 ? 0 : tmp3[1] > 255 ? 255 : tmp3[1]) * al + g[o + 1] * ia; g[o + 2] = (tmp3[2] < 0 ? 0 : tmp3[2] > 255 ? 255 : tmp3[2]) * al + g[o + 2] * ia; g[o + 3] = al * 255 + g[o + 3] * ia;
      } }
  }
}

/** One frame of him into `B`: his coarse triangles rastered a sub-pixel off (`frame` picks where), each pixel's colour read off the lattice inside its triangle (toned by the
 *  game's curve when the light last changed), blended into what the frames before left (`B.n` = how many: 0 = start over), laid over the ground. Only the box he is in is
 *  touched, unless the ground was drawn again. */
function raster(M: Fig, B: Buf, yaw: number, frame: number): void {
  const { w, h, z, id, b0, b1 } = B, F = FIGURE;
  camera(M, w, h, yaw);
  const gKey = `${M.key}|${yaw}|${M.pass}|${M.ex}`; let all = B.n <= 0;
  if (B.gKey !== gKey) { B.gKey = gKey; ground(M, B); all = true; }
  const J = HALTON[frame % HALTON.length], X = M.X, Y = M.Y, Z = M.Z, nC = X.length; project(M.CP, 0, nC, X, Y, Z, J[0] - 0.5, J[1] - 0.5);
  // the box he is in this frame; with last frame's, the pixels that can change
  let bx0 = w, by0 = h, bx1 = -1, by1 = -1;
  for (let i = 0; i < nC; i++) { const x = X[i], y = Y[i]; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
  bx0 = Math.max(0, Math.floor(bx0) - 1); by0 = Math.max(0, Math.floor(by0) - 1); bx1 = Math.min(w - 1, Math.ceil(bx1) + 1); by1 = Math.min(h - 1, Math.ceil(by1) + 1);
  // how far each point of him moved on the canvas since the last frame (a turn of the camera, a new man or a new canvas: nothing is known, and the blend starts over anyway)
  const PX = M.PX, PY = M.PY, mv = M.mv, jx = J[0] - 0.5, jy = J[1] - 0.5, known = M.pOk && B.n > 1; let moved = false;
  for (let i = 0; i < nC; i++) { const x = X[i] - jx, y = Y[i] - jy, dx = x - PX[i], dy = y - PY[i], m = known ? Math.sqrt(dx * dx + dy * dy) * F.smear : 0; mv[i] = m; if (m > 0.02) moved = true; PX[i] = x; PY[i] = y; }
  M.pOk = true;
  // (swept: this frame's box with the box kept from before — which stays as wide as it got for as long as a pixel he has left is still fading out)
  const P = B.box, kx0 = Math.min(bx0, P[0]), ky0 = Math.min(by0, P[1]), kx1 = Math.max(bx1, P[2]), ky1 = Math.max(by1, P[3]);
  const ux0 = all ? 0 : kx0, uy0 = all ? 0 : ky0, ux1 = all ? w - 1 : kx1, uy1 = all ? h - 1 : ky1; let fading = false;
  for (let y = uy0; y <= uy1; y++) { z.fill(Infinity, y * w + ux0, y * w + ux1 + 1); id.fill(-1, y * w + ux0, y * w + ux1 + 1); }
  const I = M.cI, cW = M.cW, cull = F.cull;
  for (let t = 0, T = 0; t < I.length; t += 3, T++) {
    const a = I[t], b = I[t + 1], c = I[t + 2], x0 = X[a], y0 = Y[a], x1 = X[b], y1 = Y[b], x2 = X[c], y2 = Y[c];
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (cull ? area * cW[T] >= 0 : area === 0) continue;   // (a face turned away: its normal, out of him, points from the camera)
    let minx = x0 < x1 ? x0 : x1, maxx = x0 < x1 ? x1 : x0, miny = y0 < y1 ? y0 : y1, maxy = y0 < y1 ? y1 : y0;
    if (x2 < minx) minx = x2; else if (x2 > maxx) maxx = x2; if (y2 < miny) miny = y2; else if (y2 > maxy) maxy = y2;
    const xa = minx < 0 ? 0 : Math.ceil(minx - 0.5), xb = maxx > w ? w - 1 : Math.floor(maxx - 0.5), ya = miny < 0 ? 0 : Math.ceil(miny - 0.5), yb = maxy > h ? h - 1 : Math.floor(maxy - 0.5);
    if (xa > xb || ya > yb) continue;
    // the two weights and the depth are straight lines across the canvas: stepped, not worked out afresh, a pixel
    const inv = 1 / area, z0 = Z[a], z1 = Z[b], z2 = Z[c], A0 = (y1 - y2) * inv, B0 = (x2 - x1) * inv, C0 = (x1 * y2 - x2 * y1) * inv, A1 = (y2 - y0) * inv, B1 = (x0 - x2) * inv, C1 = (x2 * y0 - x0 * y2) * inv;
    const dA = A0 * (z0 - z2) + A1 * (z1 - z2), px0 = xa + 0.5;
    for (let y = ya; y <= yb; y++) { const py = y + 0.5; let w0 = A0 * px0 + B0 * py + C0, w1 = A1 * px0 + B1 * py + C1, d = z2 + w0 * (z0 - z2) + w1 * (z1 - z2);
      for (let x = xa, i = y * w + xa; x <= xb; x++, i++, w0 += A0, w1 += A1, d += dA) {
        if (w0 < 0 || w1 < 0 || w0 + w1 > 1 || d >= z[i]) continue;
        z[i] = d; id[i] = T; b0[i] = w1; b1[i] = 1 - w0 - w1;
      } }
  }
  // what is seen of him into the blend of frames; then him over the ground, as bytes (a 4 × 4 dither under the rounding: the ground's falloff has no bands)
  if (M.toned !== M.ex) tint(M);
  const D = B.img.data, H = B.hist, G = B.g, gN = M.gN, gOff = M.gOff, tc1 = M.tc1, tcg = M.tcg, al0 = B.n <= 0 ? 1 : Math.max(1 / (B.n + 1), F.blend), alGone = Math.max(al0, 0.5); B.n++; let al = al0;
  for (let y = uy0; y <= uy1; y++) for (let x = ux0, i = y * w + ux0; x <= ux1; x++, i++) {
    const k = id[i], o = i * 4; let r = 0, g = 0, b = 0, a = 0;
    if (k >= 0) {
      // the three lattice places round this spot of the triangle, and its weights among them
      const n = gN[k], w1 = b0[i], w2 = b1[i];
      if (n <= 1) { const q = k * 9, w0 = 1 - w1 - w2; r = w0 * tc1[q] + w1 * tc1[q + 3] + w2 * tc1[q + 6]; g = w0 * tc1[q + 1] + w1 * tc1[q + 4] + w2 * tc1[q + 7]; b = w0 * tc1[q + 2] + w1 * tc1[q + 5] + w2 * tc1[q + 8]; }
      else { const fb = w1 * n, fc = w2 * n; let gi = fb | 0, gj = fc | 0; if (gi > n - 1) gi = n - 1; if (gj > n - 1 - gi) gj = n - 1 - gi;
        const u = fb - gi, v = fc - gj, q = gOff[k] + gi * (n + 1) + gj; let qa: number, qb: number, qc: number, wa: number, wb: number, wc: number;
        if (u + v <= 1 || gi + gj >= n - 1) { qa = q * 3; qb = (q + n + 1) * 3; qc = (q + 1) * 3; wa = 1 - u - v; wb = u; wc = v; }
        else { qa = (q + n + 1) * 3; qb = (q + n + 2) * 3; qc = (q + 1) * 3; wa = 1 - v; wb = u + v - 1; wc = 1 - u; }
        r = wa * tcg[qa] + wb * tcg[qb] + wc * tcg[qc]; g = wa * tcg[qa + 1] + wb * tcg[qb + 1] + wc * tcg[qc + 1]; b = wa * tcg[qa + 2] + wb * tcg[qb + 2] + wc * tcg[qc + 2]; }
      a = 255;
      if (moved) { const t3 = k * 3, m = (1 - w1 - w2) * mv[I[t3]] + w1 * mv[I[t3 + 1]] + w2 * mv[I[t3 + 2]]; al = m <= al0 ? al0 : m >= 1 ? 1 : m; } else al = al0;
    } else al = moved ? alGone : al0;
    let hr = H[o], hg = H[o + 1], hb = H[o + 2], ha = H[o + 3];
    if (a !== 0 || ha !== 0) { hr += (r - hr) * al; hg += (g - hg) * al; hb += (b - hb) * al; ha += (a - ha) * al; if (ha < 0.7) hr = hg = hb = ha = 0; else if (a === 0) fading = true; H[o] = hr; H[o + 1] = hg; H[o + 2] = hb; H[o + 3] = ha; }
    else if (!all) continue;
    // (both layers: a colour 0‥255 times its cover 0‥1, then the cover 0‥255)
    const k1 = 1 - ha / 255, oa = ha + G[o + 3] * k1; if (oa < 0.7) { D[o + 3] = 0; continue; }
    const dt = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16 - 0.5, q = 255 / oa;
    D[o] = (hr + G[o] * k1) * q + dt; D[o + 1] = (hg + G[o + 1] * k1) * q + dt; D[o + 2] = (hb + G[o + 2] * k1) * q + dt; D[o + 3] = oa + dt;
  }
  if (fading) { P[0] = kx0; P[1] = ky0; P[2] = kx1; P[3] = ky1; } else { P[0] = bx0; P[1] = by0; P[2] = bx1; P[3] = by1; }
  const U = B.up; U[0] = ux0; U[1] = uy0; U[2] = ux1; U[3] = uy1;
}

// ------------------------------------------------------------ the mount

const sigOf = (a: FigureAsk) => JSON.stringify([a.member, a.squad, a.suit, a.look, a.hour ?? 'night', a.hour && a.hour !== 'night' ? a.cloud ?? 0 : 0, a.card, LOOK.on, GEAR.on, CLOSE.on, KITANIM.on && KITANIM.grips, SHIELD.on, INHAND.on && [INHAND.long, INHAND.fit]]);
const yawOf = (a: FigureAsk) => (a.card.shield && a.member > 0 && SHIELD.on ? FIGURE.yawShield : a.card.weapon === 'pistol' ? FIGURE.yawPistol : FIGURE.yaw);
/** a frame of his life: the game's animator stepped, his surface moved with it */
function live1(M: Fig, dt: number): void { if (dt > 0) ownDie(() => M.c.update(dt * FIGURE.pace)); coarse(M); }

/** A figure in `host` (it fills it). Nothing is drawn where there is no 2D canvas, or before the cast has come. */
export function mountKitFigure(host: HTMLElement): KitFigure {
  let cv: HTMLCanvasElement | null = null, cx: CanvasRenderingContext2D | null = null;
  try { cv = document.createElement('canvas') as HTMLCanvasElement; cx = typeof cv.getContext === 'function' ? cv.getContext('2d') : null; } catch { cv = null; }
  if (!cv || !cx) return { show() { /* no canvas here */ }, close() { /* nothing up */ }, canvas: null };
  cv.className = 'kitfig'; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
  const view = cv, ctx = cx;
  let ask: FigureAsk | null = null, model: Fig | null = null, buf: Buf | null = null, turn = 0, turned = 0, queued = false, gone = false, tries = 0, drawn = '', bad = '', last = 0, due = 0, traced = 0, lit = true, sizeAt = 0, sizeW = 0, sizeH = 0, frame = 0, cost = 0, slow = false;
  let still = false; try { still = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* no window */ }
  const later = (fn: (t: number) => void) => { if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn); else setTimeout(() => fn(Date.now()), 16); };
  const clear = () => { if (drawn) { ctx.clearRect(0, 0, view.width, view.height); drawn = ''; view.removeAttribute('data-fig'); view.removeAttribute('data-word'); } };
  const draw = (now: number) => {
    queued = false; if (gone) return;
    const wCss = host.clientWidth | 0, hCss = host.clientHeight | 0;
    if (!ask || !cast) { clear(); model = null; return; }
    if (wCss < 40 || hCss < 80) { if (tries++ < 40) queue(); return; }   // (the step is still folding open: the host has no size yet)
    tries = 0;
    const key = sigOf(ask), F = FIGURE;
    // his light is traced a slice a display frame (more of the frame while it is young), whether or not this is one of the frames he is drawn on
    const trace = (M: Fig): void => { if (M.pass >= F.passes || now - traced < F.sliceGap) return; traced = now; lit = false; refine(M, M.pass < 1 ? F.firstMs : M.pass < F.early ? F.earlyMs : F.sliceMs); };
    if (drawn === key && now < due - 2) { try { if (model && model.key === key) trace(model); } catch (e) { fail(key, e); return; } queue(); return; }   // (his own frame rate, whatever the display's)
    if ((!model || model.key !== key) && bad !== key) { try { model = build(ask, key); } catch (e) { model = null; bad = key; console.warn('kit figure:', e); } if (buf) buf.n = 0; last = now; traced = 0; }   // (a build that threw is not tried again for the same ask)
    if (!model || model.key !== key) { clear(); model = null; return; }   // (no man yet — his dress still loading — is an empty stand, never the last man)
    let ss = F.ss; try { ss = Math.max(ss, window.devicePixelRatio || 1); } catch { /* no window */ }
    while (ss > 1 && wCss * hCss * ss * ss > F.maxPx) ss -= 0.125;
    const w = Math.round(wCss * ss), h = Math.round(hCss * ss);
    // (a window being dragged to another size: the picture he has is stretched until the size has stood still a moment — a new set of buffers a frame is a lot to throw away)
    if (buf && (buf.w !== w || buf.h !== h)) { if (w !== sizeW || h !== sizeH) { sizeW = w; sizeH = h; sizeAt = now; } if (now - sizeAt < 160) { queue(); return; } }
    try {
      trace(model);
      if (model.pass < 1) { queue(); return; }   // (a new man: the last picture stays up the few frames his first shadows take)
      if (view.width !== w || view.height !== h) { view.width = w; view.height = h; }
      if (!buf || buf.w !== w || buf.h !== h) buf = makeBuf(w, h, ctx.createImageData(w, h));
      const t0 = performance.now(), period = 1000 / (slow ? F.fpsSlow : F.fps), dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now; due = Math.max(due + period, now - period);
      const fresh = !lit; if (fresh) { shade(model); lit = true; }
      if (!still) live1(model, dt);
      if (turn !== turned) { turned = turn; if (buf.n > 1) buf.n = 1; }   // (the camera moved: the frames before count for one)
      raster(model, buf, yawOf(ask) + turn, frame++);
      const U = buf.up; if (U[2] >= U[0] && U[3] >= U[1]) ctx.putImageData(buf.img, 0, 0, U[0], U[1], U[2] - U[0] + 1, U[3] - U[1] + 1);   // (only the box that changed: the rest of the canvas has it already)
      // what a frame of him costs the page's one thread, eased: a machine it is too much for gets fewer of them
      // (not the frames his light has just been traced further on: those shade him again, lay the whole canvas again once a pass is whole, and stop once the tracing has)
      if (!fresh && (U[0] > 0 || U[1] > 0 || U[2] < buf.w - 1 || U[3] < buf.h - 1)) { const ms = performance.now() - t0; cost = cost > 0 ? cost + (ms - cost) * 0.1 : ms; if (slow ? cost < F.fastMs : cost > F.slowMs) slow = !slow; }
    } catch (e) { fail(key, e); return; }
    view.setAttribute('data-ms', cost.toFixed(1)); view.setAttribute('data-fps', String(slow ? F.fpsSlow : F.fps));
    drawn = key; view.setAttribute('data-fig', `${ask.member}`); view.setAttribute('data-tris', String(model.cI.length / 3)); view.setAttribute('data-word', model.word); view.setAttribute('data-pass', String(model.pass));
    if (!still || model.pass < F.passes || buf.n < 16) queue();   // (he is alive: the next frame is always owed, until he is put away — or, where motion is not wanted, until the light has settled)
  };
  /** a frame of him threw: the stand goes empty and that man is not tried again (until another cast comes), rather than a frozen picture and an error a frame */
  const fail = (key: string, e: unknown) => { model = null; bad = key; clear(); console.warn('kit figure:', e); };
  const queue = () => { if (queued || gone) return; queued = true; later(draw); };
  const wake = () => { bad = ''; if (model) model.key = ''; queue(); };   // (another cast has come: what was built on the old one, or failed on it, is asked again)
  live.add(wake);
  // drag turns him (the mouse only: no key is taken)
  let dragX: number | null = null;
  view.addEventListener('pointerdown', e => { dragX = e.clientX; try { view.setPointerCapture(e.pointerId); } catch { /* not capturable */ } e.preventDefault(); });
  view.addEventListener('pointermove', e => { if (dragX === null) return; turn += (e.clientX - dragX) * FIGURE.drag; dragX = e.clientX; queue(); });
  const up = () => { dragX = null; }; view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up);
  view.addEventListener('dblclick', () => { turn = 0; queue(); });
  const onSize = () => queue(); try { window.addEventListener('resize', onSize); } catch { /* no window */ }
  return {
    show(a) { const was = ask; ask = a; if (a && (!was || a.member !== was.member)) turn = 0; queue(); },
    close() { gone = true; live.delete(wake); try { window.removeEventListener('resize', onSize); } catch { /* no window */ } view.remove?.(); },
    canvas: view,
  };
}

/** The model and the picture without a page (tools/qa/kit-figure-sheet.ts): `casts` = this dress and the other look's. `secs` of his idle are played first, the light
 *  is traced for `passes`, `frames` jittered frames are blended (`moving`: his idle plays on between them, as on the page). `stats` (if given) is filled with what it cost. */
export function figureOffline(casts: { own: GltfCharacter; other?: GltfCharacter | null }, ask: FigureAsk, w: number, h: number, turn = 0,
  o: { passes?: number; frames?: number; secs?: number; moving?: boolean; stats?: Record<string, number> } = {}): Uint8ClampedArray | null {
  const was = [cast, other, otherAsked] as const; cast = casts.own; other = casts.other ?? null; otherAsked = true;
  try {
    const t0 = performance.now(), M = build(ask, 'offline'); if (!M) return null;
    const t1 = performance.now(), passes = Math.min(o.passes ?? FIGURE.passes, FIGURE.passes);
    for (let p = 0; p < passes; p++) { refine(M, 0, true); shade(M); }
    const t2 = performance.now();
    for (let t = 0, T = Math.round((o.secs ?? 0) * 30); t < T; t++) live1(M, 1 / 30);
    const t3 = performance.now(); live1(M, 1 / 30); const t4 = performance.now(); shade(M); const t5 = performance.now();
    const B = makeBuf(w, h, { data: new Uint8ClampedArray(w * h * 4), width: w, height: h } as unknown as ImageData), frames = o.frames ?? 8;
    for (let f = 0; f < frames; f++) { if (o.moving && f) live1(M, 1 / FIGURE.fps); raster(M, B, yawOf(ask) + turn, f); }
    const t6 = performance.now();
    if (o.stats) Object.assign(o.stats, { build: t1 - t0, pass: (t2 - t1) / Math.max(1, passes), pose: t4 - t3, shade: t5 - t4, raster: (t6 - t5) / Math.max(1, frames), lumels: M.nL, ground: M.nG, coarse: M.cI.length / 3 });
    return B.img.data as Uint8ClampedArray;
  } finally { cast = was[0]; other = was[1]; otherAsked = was[2]; }
}

/** How he moves at rest, without a page (a measuring hook for tools: nothing on the page calls it): his idle played for `secs` at `hz`, and per step the farthest any point of him is from where it
 *  started and the farthest any point went in that step (metres). */
export function figureMotion(casts: { own: GltfCharacter; other?: GltfCharacter | null }, ask: FigureAsk, secs: number, hz = 30): { off: number[]; step: number[] } | null {
  const was = [cast, other, otherAsked] as const; cast = casts.own; other = casts.other ?? null; otherAsked = true;
  try {
    const M = build(ask, 'offline'); if (!M) return null;
    const P0 = M.CP.slice(), prev = M.CP.slice(), off: number[] = [], step: number[] = [];
    for (let t = 0, T = Math.round(secs * hz); t < T; t++) {
      live1(M, 1 / hz); let a = 0, b = 0;
      for (let i = 0; i < P0.length; i += 3) { const d = Math.hypot(M.CP[i] - P0[i], M.CP[i + 1] - P0[i + 1], M.CP[i + 2] - P0[i + 2]), e = Math.hypot(M.CP[i] - prev[i], M.CP[i + 1] - prev[i + 1], M.CP[i + 2] - prev[i + 2]); if (d > a) a = d; if (e > b) b = e; }
      prev.set(M.CP); off.push(a); step.push(b);
    }
    return { off, step };
  } finally { cast = was[0]; other = was[1]; otherAsked = was[2]; }
}

/** What he holds and the hand that holds it, without a page (a measuring hook for tools/qa/kit-figure-roster-check.ts: nothing on the page calls it): the figure as the screen
 *  builds it, his idle played for `secs`, then per step `each` is handed the posed figure and the game's own boxes for his kit (the drawer's names in `meta`). */
export function figureHold(casts: { own: GltfCharacter; other?: GltfCharacter | null }, ask: FigureAsk, secs: number, each: (c: Character, bx: Box[], meta: RigNodeMeta[]) => void, hz = 30): boolean {
  const was = [cast, other, otherAsked] as const; cast = casts.own; other = casts.other ?? null; otherAsked = true;
  try {
    const M = build(ask, 'offline'); if (!M) return false;
    for (let t = 0, T = Math.round(secs * hz); t <= T; t++) { if (t) live1(M, 1 / hz); const r = M.rigged(); each(M.c, r.bx, r.meta); }
    return true;
  } finally { cast = was[0]; other = was[1]; otherAsked = was[2]; }
}
