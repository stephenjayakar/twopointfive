// bun run tools/menu-art.ts [id …] [--size 760x475] [--spp 40] [--out public/assets/menu] [--jobs 4] [--set '{"<id>":{…}}']
//
// THE FIRST SET of the Play page's mission pictures, and still the picture of any mission tools/menu-shots has no recipe for (that tool takes the pictures
// from PLAY: the maintainer, 10-12, of this file's — "they look somewhat staged and repetitive"; running this over a mission it has a recipe for puts the
// composed picture back). One picture a mission, COMPOSED here and not captured from play. The maintainer, 10-11: "our art
// style is also AWESOME so if we could highlight it" · "use your artistic judgment though. and it can be synthetic, doesn't have to literally be a rendering of
// the level. make it awesome!"
//
// What a picture is: the mission's own level file (the look's file where it has one: boxes, paint, lamps, door leaves, furniture) lit the way the game lights
// it — sized emitters with soft shadows, one bounce, beams in haze — by a small path tracer written out below, with a cast placed for the picture: the team on
// its start with weapon lights and lasers on a loud mission, one man low in the dark and the guards' torches on a quiet one. The camera, the hour's colour and
// who stands where are CHOICES of this file (MOOD by group, PIN by mission), not facts of a run: the menu marks nothing on a picture. It runs on the CPU alone
// (no GPU, no browser: two to three minutes a picture a core at the shipped size and samples, so about half an hour for all of them on four; every picture is a
// child process that imports this file afresh, so do not edit it under a running set) and writes <out>/<id>.jpg +
// stills.json, the list ui/menuStills.ts reads. Naming missions renders only those and keeps the rest of the folder. Needs ImageMagick's `convert` for the
// JPEG. A mission added since gets a picture by running this again; without one its card shows the menu's own drawn model (ui/planArt.ts).
// KNOWN, each a choice of the picture and not the level's truth: with `lamps: 'all'` (the default) every lamp the file carries burns, emergency beacons and
// lamps the level keeps dark included; a door the file gives no angle stands ajar one time in five, by a hash, whichever way it swings and steel or not.
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { missionList, type Mission } from '../src/ui/missions';

const ROOT = join(import.meta.dir, '..'), DEG = Math.PI / 180, FOV = 28;
type V3 = [number, number, number];

// ───────────────────────────────────────────────────────────── the look, by group and by mission ─────────────────────────────────────────────────────────────
interface Mood {
  /** the far light (the level's moon, or a low sun): colour × strength, where it stands (azimuth from +x toward +z, height), its disc */
  key: V3; keyK: number; keyAz: number; keyEl: number; keySoft: number;
  /** the sky: zenith and horizon, and how much of it */
  zen: V3; hor: V3; skyK: number;
  /** the level's own lamps × · haze in the beams × · the picture's exposure × · the grade: shadows toward this, by this much */
  lampK: number; haze: number; expo: number; tint: V3; tintK: number;
  /** the shaft on the cast (irradiance at their feet, in the far light's colour); 0 = none */
  rim: number; rimC?: V3;
}
const NIGHT: Mood = { key: [0.5, 0.66, 1], keyK: 1.5, keyAz: 215, keyEl: 34, keySoft: 0.02, zen: [0.02, 0.035, 0.075], hor: [0.05, 0.065, 0.1], skyK: 1.6, lampK: 1, haze: 1, expo: 1, tint: [0.05, 0.07, 0.12], tintK: 0.5, rim: 3.2 };
const MOODS: Record<string, Mood> = {
  training: { ...NIGHT, key: [1, 0.85, 0.62], keyK: 5.5, keyEl: 24, keySoft: 0.03, zen: [0.1, 0.15, 0.26], hor: [0.5, 0.38, 0.26], skyK: 2.2, lampK: 0.5, haze: 0.8, tint: [0.1, 0.08, 0.08], tintK: 0.3 },   // early morning: a pale sun, long shadows, the one group by day
  raids: NIGHT,
  strongholds: { ...NIGHT, key: [1, 0.42, 0.2], keyK: 3.4, keyEl: 11, keySoft: 0.03, zen: [0.035, 0.035, 0.09], hor: [0.3, 0.12, 0.07], skyK: 1.5, lampK: 1.2, expo: 1.15, tint: [0.09, 0.05, 0.1], tintK: 0.3, rimC: [0.42, 0.6, 1], rim: 5 },   // last light: ember on the wall tops, the rest gone violet
  clock: { ...NIGHT, key: [0.42, 0.7, 0.86], keyK: 1.3, zen: [0.012, 0.04, 0.06], hor: [0.03, 0.075, 0.09], expo: 1.3, tint: [0.03, 0.09, 0.1], tintK: 0.75 },   // a harder, greener night
  'quiet-alone': { ...NIGHT, keyK: 0.4, skyK: 0.7, lampK: 1.5, haze: 1.0, tint: [0.035, 0.05, 0.11], tintK: 0.6 },   // deep night: the lamps' pools and the dark between them
  'quiet-two': { ...NIGHT, key: [0.5, 0.8, 0.66], keyK: 0.9, zen: [0.015, 0.045, 0.04], hor: [0.035, 0.08, 0.065], skyK: 1.2, lampK: 1.2, haze: 1.0, tint: [0.02, 0.1, 0.07], tintK: 0.8 },   // the same dark, gone green: two men's night
};
/** a mission's own picture, by hand: any of the camera (look, yaw, pitch in degrees, dist), `side` (which shoulder the camera looks over: ±1), `swing` (degrees
 *  off the line start → place), `cast` ('none' = the place alone), `lamps` ('all' = every lamp and room panel on, 'own' = as the level has them), mood fields */
interface Pin extends Partial<Mood> { look?: number[]; yaw?: number; pitch?: number; dist?: number; side?: number; swing?: number; back?: number; cast?: 'none'; lamps?: 'all' | 'own'; start?: number;
  /** the cast placed by hand: where the lead stands, the others, what they face ([x, z]); doors stood open by id (radians) */
  at?: number[]; ops?: number[][]; aim?: number[]; ajar?: Record<string, number>;
  /** `flip` = the other shoulder than the one the picture would take · `lead` = how far from the cast toward what they face the lens looks (0‥1) · `glow` =
   *  lamps of the picture's own, rows [x, y, z, r, g, b, reach] (light out of a doorway) · `guards` = men of the place stood by hand, rows [x, z, facing x, z] ·
   *  `work` = which of the cast (0 = the lead) kneel with their hands on something · `armed` = a quiet man with his rifle up · `charges` = a charge set on a
   *  wall, rows [x, y, z] */
  flip?: boolean; lead?: number; glow?: number[][]; guards?: number[][]; work?: number[]; armed?: boolean; charges?: number[][] }
const PIN: Record<string, Pin> = {
  // the office is five missions on one floor: each picture is its own corner of it
  'night-breach': { at: [38.6, 0, 21.9], ops: [[36.9, 0, 19.6], [36.9, 0, 22.0]], aim: [36.0, 20.75], ajar: { fire_exit: -0.9 }, swing: 62, glow: [[34.9, 2.0, 20.8, 14, 11, 7.5, 9]] },   // the fire exit, its light on the lot as it opens
  'room-clear-pair': { at: [25.0, 0, 18.4], ops: [[26.6, 0, 16.6], [25.6, 0, 16.2]], aim: [28.0, 17.8], rim: 6, expo: 1.4 },   // the break room, from the cubicles
  'room-clear-four': { at: [13.6, 0, 11.1], ops: [[15.6, 0, 10.6], [17.4, 0, 11.6], [19.4, 0, 10.6], [21.2, 0, 11.6]], aim: [34.0, 11.1], swing: 0, pitch: 27 },   // the file down the long corridor
  'hostage-rescue': { expo: 1.6 },
  'block-four': { at: [13.2, 0, 7.7], ops: [[13.3, 0, 9.2], [12.3, 0, 11.0], [11.6, 0, 10.3], [13.2, 0, 10.9]], aim: [16.4, 4.6], look: [14.7, 1, 7.4], yaw: -143, pitch: 63, dist: 11.5, ajar: { m_s: -1.9 } },   // the mess: the team at the room's turn
  // two missions on one level stand at its two ways in
  'block-squads': { start: 1, back: -2 }, 'warehouse-four': { start: 1 },
  // each of these is the picture of what its mission is ABOUT, not of where its team starts
  'glasshouse-four': { at: [20, 0, 24], ops: [[18.6, 0, 24.4], [21.4, 0, 24.4], [17.2, 0, 24.9], [22.8, 0, 24.9]], aim: [20.2, 18], swing: 20 },   // the lit forecourt, the dark glass
  'floodlit-four': { look: [19, 1, 17], yaw: 12, pitch: 38, dist: 24, rim: 0, at: [19, 0, 22.2], ops: [[17.5, 0, 22.6], [20.5, 0, 22.6], [16, 0, 23.1], [22, 0, 23.1]], aim: [19.4, 13] },   // the yard under its floods, the team at its dark edge
  'depot-four': { at: [14.9, 0, 17.7], ops: [[16.3, 0, 18.7], [16.9, 0, 17.8], [15.6, 0, 17.6], [17.5, 0, 17.5]], aim: [16.25, 21], look: [16.1, 1, 18.5], yaw: 12, pitch: 26, dist: 8, ajar: { bay_to_yard: 1.5 } },   // the workshop's yard door, the first man through it
  'hall-four': { at: [10.5, 0, 14], ops: [[9.4, 0, 14.3], [8.2, 0, 13.7], [7.0, 0, 14.3], [5.8, 0, 13.7]], aim: [31, 14], look: [14, 1, 14], yaw: -80, pitch: 38, dist: 17, ajar: { front: 1.4 }, guards: [[30.6, 13.5, 9, 14], [30.6, 14.5, 9, 14]] },   // the file at the one door in, the far guns' lights down the hall's length
  'mousehole-four': { charges: [[12, 1.1, 6.86]], at: [9.9, 0, 6.3], ops: [[9.0, 0, 6.3], [14.1, 0, 6.3], [15.0, 0, 6.3]], aim: [12, 7.0], look: [12, 1, 6.6], yaw: 165, pitch: 30, dist: 11 },   // either side of a charge on blank wall
  'rescue-registry': { expo: 1.8, dist: 11, pitch: 40 }, 'rescue-consulate': { expo: 1.8, dist: 11, pitch: 40 },
  'snatch-four': { at: [26.9, 0, 11.6], ops: [[26.9, 0, 9.6], [27.8, 0, 12.2], [27.8, 0, 9.0]], aim: [26.0, 10.75], look: [25.6, 1, 10.6], yaw: 90, dist: 13, pitch: 54, lampK: 0.5, ajar: { side: 0.9 } },   // the man by his lantern, the team on his side door
  'defuse-four': { at: [8.5, 0, 8.6], work: [0], lampK: 0.05, skyK: 0.4, expo: 0.7, ops: [[7.4, 0, 10.9], [10.9, 0, 12.0], [6.9, 0, 12.3], [10.2, 0, 9.4]], aim: [8.5, 7.65], pitch: 44 },   // a man's hands on charge 1
  'compound-four': { at: [2.4, 0, 14.9], ops: [[2.4, 0, 16.1], [1.6, 0, 15.5], [1.6, 0, 16.6], [2.5, 0, 13.6]], aim: [10, 14.9], ajar: { gate_w: 1.2 }, look: [3.8, 1, 15.3], yaw: -62, pitch: 36, dist: 13 },   // the west gate, the lit yard beyond it
  'train-move': { at: [5.6, 0, 14.7], aim: [7.6, 14.1], keyAz: 95, keyEl: 18, look: [6.3, 1, 14.2], yaw: -40, pitch: 30, dist: 10 },   // in the wall's long shadow, the sun through the gate
  'quiet-relay-two': { at: [16.77, 0, 15.15], ops: [[15.3, 0, 15.9]], aim: [16.77, 14.5], look: [17.6, 1, 15.6], yaw: -78, pitch: 24, dist: 8 },   // at the lock of the hut's door, under its lamp
  'solo-night': { lead: 0.2, flip: true },
  'vault-quiet': { at: [27.55, 0, 12.1], aim: [24.4, 14.6], look: [26, 1, 13], yaw: -35, pitch: 50, dist: 9.5, rim: 5 },   // the court's beam at the shin, between him and the back door
  'tut-quiet': { at: [26.1, 0, 14.15], aim: [24.0, 12.7], guards: [[24.0, 12.7, 20.5, 12.7]], look: [25.0, 1, 13.4], pitch: 36, dist: 8.5, lamps: 'own', keyK: 0.4, skyK: 0.7, lampK: 1.5, haze: 1.0, tint: [0.035, 0.05, 0.11], tintK: 0.6 },   // the tutorial's quiet house: low in the store's dark corner, the lit hall and a man's back through the doorway (the deep night of the quiet missions)
  'quiet-yard-alone': { at: [21.2, 0, 16.9], aim: [27, 13.5], guards: [[27.5, 12.6, 20, 13]], pitch: 34, rim: 7 },   // the lamp's pool, a man in it, from the dark corner
  'quiet-yard-two': { at: [17.8, 0, 19.4], ops: [[19.2, 0, 19.7]], aim: [20, 14], guards: [[20.5, 13.8, 12, 13.8]], pitch: 28 },
  'lights-out-two': { at: [19, 0, 18.5], ops: [[18, 0, 19.3]], aim: [21, 16.2], ajar: { front: 0.9 }, pitch: 40 },   // the hall's four beams through its open door
  'train-hands': { guards: [[20.2, 16.9, 20.25, 15.5]], at: [18.7, 0, 18.3], aim: [20.2, 16.9], look: [19.7, 1, 16.7], yaw: 8, pitch: 30, dist: 9 },   // behind a man at the embers
  'train-lights': { at: [22.3, 0, 18.9], aim: [24, 18.9], look: [23.2, 1, 18.4], yaw: -10, pitch: 40, dist: 9, rim: 6 },   // the alley's beam
  'police-post-quiet': { at: [26, 0, 20.3], aim: [21.2, 20.6], guards: [[21.2, 20.6, 14, 21]], look: [23.5, 1, 20.6], yaw: 120, pitch: 34, dist: 11 },   // the gate's lamp and the man under it, from the hut's dark side
  'train-kit': { at: [12.6, 0, 17.6], aim: [22, 17.6], armed: true, pitch: 30 },   // on the range
  'train-silent': { at: [25.2, 0, 12.4], ops: [[27.6, 0, 12.2]], aim: [26.8, 10.6], pitch: 34 },
};

// ───────────────────────────────────────────────────────────────────────── the scene ─────────────────────────────────────────────────────────────────────────
interface LBox { id?: string; c: number[]; h: number[]; yaw?: number; flags?: string[]; group?: string; material?: string; albedo?: number[]; emissive?: number[] }
interface LLight { id: string; kind: string; pos: number[]; dir: number[]; color: number[]; intensity: number; range: number; innerDeg: number; outerDeg: number; enabled?: boolean; volumetric?: number; radius?: number; group?: string }
interface Team { sam?: number[]; samYaw?: number; ops?: number[][]; mate?: number[] }
interface Held { hostages?: { pos: number[] }[]; captor?: { pos: number[]; aimAt?: number[] } }
interface Data {
  boxes: LBox[]; materials: Record<string, { albedo: number[] }>; lights: LLight[]; doors?: { id: string; hinge: number[]; closedDir: number; width: number; angle?: number; albedo?: number[]; steel?: boolean; height?: number }[];
  props?: { x: number; z: number; yaw?: number; parts: { off: number[]; h: number[]; yaw?: number; albedo?: number[]; material?: string; emissive?: number[] }[] }[];
  switchables?: { id: string; boxes: string[]; on?: boolean; baseEmissive?: number[] }[]; routes?: { points: (number[] | { pos: number[] })[] }[];
  mission?: { playerSpawn?: number[]; objectives?: { area?: { x0: number; x1: number; z0: number; z1: number } }[] };
  devices?: { kind: string; from?: number[]; to?: number[] }[];
  scenarios?: { defuse?: { devices?: { pos: number[]; n?: number[] }[] }; snatch?: { man?: { pos: number[]; face?: number; tint?: number[]; tint2?: number[] } }; roomClear?: { team?: Team; starts?: Team[] }; nightBreach?: { team?: Team }; rescue?: { team?: Team }; quiet?: { starts?: Team[] } };
}
const F_PRIMARY = 1, F_SHADOW = 2, F_GLASS = 4;   // (a pane is neither drawn nor a shadow: the lens tints what it sees through one)
/** boxes as flat rows: centre, half size, cos / sin of the yaw, paint, glow, flags */
class Scene {
  n = 0; c: number[] = []; h: number[] = []; cs: number[] = []; sn: number[] = []; alb: number[] = []; em: number[] = []; fl: number[] = [];
  add(c: number[], h: number[], yaw: number, alb: number[], em: number[] | undefined, fl: number) {
    this.c.push(c[0], c[1], c[2]); this.h.push(h[0], h[1], h[2]); this.cs.push(Math.cos(yaw)); this.sn.push(Math.sin(yaw)); this.alb.push(alb[0], alb[1], alb[2]); this.em.push(em?.[0] ?? 0, em?.[1] ?? 0, em?.[2] ?? 0); this.fl.push(fl); return this.n++;
  }
  // the tree: nodes as rows [min3, max3], kids or a leaf's run of `order`
  nb: Float64Array = new Float64Array(0); nk: Int32Array = new Int32Array(0); order: Int32Array = new Int32Array(0);
  C!: Float64Array; H!: Float64Array; CS!: Float64Array; SN!: Float64Array; FL!: Int32Array;
  build() {
    const n = this.n; this.C = Float64Array.from(this.c); this.H = Float64Array.from(this.h); this.CS = Float64Array.from(this.cs); this.SN = Float64Array.from(this.sn); this.FL = Int32Array.from(this.fl);
    const lo = new Float64Array(n * 3), hi = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) { const ex = Math.abs(this.CS[i]) * this.H[i * 3] + Math.abs(this.SN[i]) * this.H[i * 3 + 2], ez = Math.abs(this.SN[i]) * this.H[i * 3] + Math.abs(this.CS[i]) * this.H[i * 3 + 2], e = [ex, this.H[i * 3 + 1], ez];
      for (let a = 0; a < 3; a++) { lo[i * 3 + a] = this.C[i * 3 + a] - e[a]; hi[i * 3 + a] = this.C[i * 3 + a] + e[a]; } }
    const order = Int32Array.from({ length: n }, (_, i) => i), nb: number[] = [], nk: number[] = [];
    const make = (a: number, b: number): number => {
      const id = nk.length / 2; nk.push(0, 0); const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
      for (let k = a; k < b; k++) for (let x = 0; x < 3; x++) { mn[x] = Math.min(mn[x], lo[order[k] * 3 + x]); mx[x] = Math.max(mx[x], hi[order[k] * 3 + x]); }
      nb.push(...mn, ...mx);
      if (b - a <= 3) { nk[id * 2] = -(a + 1); nk[id * 2 + 1] = b - a; return id; }
      const ax = mx[0] - mn[0] > mx[2] - mn[2] ? (mx[0] - mn[0] > mx[1] - mn[1] ? 0 : 1) : (mx[2] - mn[2] > mx[1] - mn[1] ? 2 : 1);
      const sub = Array.from(order.subarray(a, b)).sort((p, q) => this.C[p * 3 + ax] - this.C[q * 3 + ax]); order.set(sub, a);
      const m = (a + b) >> 1, l = make(a, m), r = make(m, b); nk[id * 2] = l; nk[id * 2 + 1] = r; return id;
    };
    if (n) make(0, n); this.nb = Float64Array.from(nb); this.nk = Int32Array.from(nk); this.order = order;
  }
}
// what a ray met (kept in module scalars: nothing is allocated per ray)
let hT = 0, hI = -1, hNx = 0, hNy = 0, hNz = 0;
const stack = new Int32Array(96);
/** the nearest box a ray meets under `tmax` wearing all of `mask`'s flags; `any` = the first one will do (a shadow's question) */
function trace(S: Scene, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmax: number, mask: number, any: boolean): boolean {
  const ix = 1 / (dx || 1e-20), iy = 1 / (dy || 1e-20), iz = 1 / (dz || 1e-20), nb = S.nb, nk = S.nk, C = S.C, H = S.H; let sp = 0, best = tmax, found = false; stack[sp++] = 0; hI = -1;
  if (!S.n) return false;
  while (sp) {
    const id = stack[--sp], o = id * 6; let t0 = 0, t1 = best;
    let a = (nb[o] - ox) * ix, b = (nb[o + 3] - ox) * ix; if (a > b) { const q = a; a = b; b = q; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
    a = (nb[o + 1] - oy) * iy; b = (nb[o + 4] - oy) * iy; if (a > b) { const q = a; a = b; b = q; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
    a = (nb[o + 2] - oz) * iz; b = (nb[o + 5] - oz) * iz; if (a > b) { const q = a; a = b; b = q; } if (a > t0) t0 = a; if (b < t1) t1 = b; if (t0 > t1) continue;
    const k0 = nk[id * 2], k1 = nk[id * 2 + 1];
    if (k0 >= 0) { stack[sp++] = k0; stack[sp++] = k1; continue; }
    for (let q = -k0 - 1, e = q + k1; q < e; q++) {
      const i = S.order[q]; if ((S.FL[i] & mask) !== mask) continue;
      const cs = S.CS[i], sn = S.SN[i], px = ox - C[i * 3], py = oy - C[i * 3 + 1], pz = oz - C[i * 3 + 2];
      const lx = cs * px - sn * pz, lz = sn * px + cs * pz, ldx = cs * dx - sn * dz, ldz = sn * dx + cs * dz;
      const jx = 1 / (ldx || 1e-20), jz = 1 / (ldz || 1e-20), hx = H[i * 3], hy = H[i * 3 + 1], hz = H[i * 3 + 2];
      let u0 = 1e-4, u1 = best, ax = -1, sg = 0;
      let ta = (-hx - lx) * jx, tb = (hx - lx) * jx, s = -1; if (ta > tb) { const q2 = ta; ta = tb; tb = q2; s = 1; } if (ta > u0) { u0 = ta; ax = 0; sg = s; } if (tb < u1) u1 = tb; if (u0 > u1) continue;
      ta = (-hy - py) * iy; tb = (hy - py) * iy; s = -1; if (ta > tb) { const q2 = ta; ta = tb; tb = q2; s = 1; } if (ta > u0) { u0 = ta; ax = 1; sg = s; } if (tb < u1) u1 = tb; if (u0 > u1) continue;
      ta = (-hz - lz) * jz; tb = (hz - lz) * jz; s = -1; if (ta > tb) { const q2 = ta; ta = tb; tb = q2; s = 1; } if (ta > u0) { u0 = ta; ax = 2; sg = s; } if (tb < u1) u1 = tb; if (u0 > u1) continue;
      if (ax < 0) continue;
      best = u0; found = true; hI = i; if (any) { hT = best; return true; }
      const l0 = ax === 0 ? sg : 0, l2 = ax === 2 ? sg : 0; hNx = cs * l0 + sn * l2; hNy = ax === 1 ? sg : 0; hNz = -sn * l0 + cs * l2;
    }
  }
  hT = best; return found;
}

// ─────────────────────────────────────────────────────────────── the cast: men made of capsules ───────────────────────────────────────────────────────────────
interface Cap { a: V3; b: V3; r: number; col: V3 }
interface Man { caps: Cap[]; c: V3; rad: number }
const men: Man[] = [];
let cT = 0, cNx = 0, cNy = 0, cNz = 0, cCap: Cap | null = null;
function capHit(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, p: Cap, tmax: number): number {
  const bax = p.b[0] - p.a[0], bay = p.b[1] - p.a[1], baz = p.b[2] - p.a[2], oax = ox - p.a[0], oay = oy - p.a[1], oaz = oz - p.a[2];
  const baba = bax * bax + bay * bay + baz * baz, bard = bax * dx + bay * dy + baz * dz, baoa = bax * oax + bay * oay + baz * oaz, rdoa = dx * oax + dy * oay + dz * oaz, oaoa = oax * oax + oay * oay + oaz * oaz;
  const a = baba - bard * bard; let b = baba * rdoa - baoa * bard, c = baba * oaoa - baoa * baoa - p.r * p.r * baba, h = b * b - a * c;
  if (h < 0) return -1;
  let t = (-b - Math.sqrt(h)) / a; const y = baoa + t * bard;
  if (!(y > 0 && y < baba)) { const qx = y <= 0 ? oax : ox - p.b[0], qy = y <= 0 ? oay : oy - p.b[1], qz = y <= 0 ? oaz : oz - p.b[2]; b = dx * qx + dy * qy + dz * qz; c = qx * qx + qy * qy + qz * qz - p.r * p.r; h = b * b - c; if (h <= 0) return -1; t = -b - Math.sqrt(h); }
  return t > 1e-4 && t < tmax ? t : -1;
}
function traceMen(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, tmax: number, any: boolean): boolean {
  let best = tmax; cCap = null;
  for (const m of men) {
    const qx = m.c[0] - ox, qy = m.c[1] - oy, qz = m.c[2] - oz, along = qx * dx + qy * dy + qz * dz, d2 = qx * qx + qy * qy + qz * qz - along * along;
    if (d2 > m.rad * m.rad || along < -m.rad || along > best + m.rad) continue;
    for (const p of m.caps) { const t = capHit(ox, oy, oz, dx, dy, dz, p, best); if (t > 0) { best = t; cCap = p; if (any) return true; } }
  }
  if (!cCap) return false;
  const p: Cap = cCap, hx = ox + dx * best, hy = oy + dy * best, hz = oz + dz * best, bax = p.b[0] - p.a[0], bay = p.b[1] - p.a[1], baz = p.b[2] - p.a[2];
  const k = Math.min(1, Math.max(0, ((hx - p.a[0]) * bax + (hy - p.a[1]) * bay + (hz - p.a[2]) * baz) / (bax * bax + bay * bay + baz * baz)));
  cNx = (hx - p.a[0] - bax * k) / p.r; cNy = (hy - p.a[1] - bay * k) / p.r; cNz = (hz - p.a[2] - baz * k) / p.r; cT = best; return true;
}
interface Dress { body: V3; legs: V3; kit: V3; head: V3; hat: V3 | null }
const OPERATOR: Dress = { body: [0.105, 0.1, 0.075], legs: [0.13, 0.12, 0.088], kit: [0.032, 0.032, 0.028], head: [0.3, 0.22, 0.17], hat: [0.06, 0.058, 0.046] };   // (dark kit: under a warm lamp a paler man is a wooden figure)
const SNEAK: Dress = { body: [0.022, 0.022, 0.026], legs: [0.022, 0.022, 0.026], kit: [0.03, 0.03, 0.034], head: [0.36, 0.27, 0.21], hat: null };
const CIVIL: Dress = { body: [0.5, 0.5, 0.52], legs: [0.1, 0.11, 0.16], kit: [0.5, 0.5, 0.52], head: [0.4, 0.3, 0.23], hat: null };
const GUARD: Dress = { body: [0.42, 0.38, 0.3], legs: [0.2, 0.19, 0.18], kit: [0.1, 0.09, 0.08], head: [0.4, 0.29, 0.21], hat: [0.3, 0.27, 0.2] };
/** a man standing (or low) at `at`, his gun along `f` (a unit way on the floor) and pitched; returns his muzzle */
function addMan(at: number[], f: number[], D: Dress, pose: boolean | 'kneel' | 'work', gun: 'rifle' | 'torch' | 'none', pitch = 0): V3 {
  const knees = pose === 'kneel' || pose === 'work', low = pose === true;
  const r = [f[1], -f[0]], P = (fw: number, rt: number, y: number): V3 => [at[0] + f[0] * fw + r[0] * rt, y, at[2] + f[1] * fw + r[1] * rt], caps: Cap[] = [];
  const cap = (a: V3, b: V3, rad: number, col: V3) => caps.push({ a, b: a[0] === b[0] && a[1] === b[1] && a[2] === b[2] ? [b[0], b[1] + 0.01, b[2]] : b, r: rad, col });
  const hip = knees ? 0.5 : low ? 0.56 : 0.93, chest = knees ? 0.95 : low ? 0.98 : 1.4, lean = pose === 'work' ? 0.2 : knees ? 0.03 : low ? 0.3 : 0.07, headY = knees ? 1.16 : low ? 1.17 : 1.64, headF = pose === 'work' ? 0.3 : knees ? 0.1 : low ? 0.42 : 0.12;
  if (knees) { for (const sd of [0.1, -0.1]) { cap(P(0, sd, hip), P(0.3, sd * 1.2, 0.1), 0.08, D.legs); cap(P(0.3, sd * 1.2, 0.1), P(-0.18, sd * 1.2, 0.08), 0.065, D.legs); } }   // (both knees down, the feet behind)
  else if (low) { cap(P(0, 0.1, hip), P(0.3, 0.13, 0.48), 0.08, D.legs); cap(P(0.3, 0.13, 0.48), P(0.26, 0.13, 0.07), 0.07, D.legs); cap(P(0, -0.1, hip), P(-0.06, -0.12, 0.13), 0.08, D.legs); cap(P(-0.06, -0.12, 0.13), P(-0.44, -0.12, 0.08), 0.065, D.legs); }
  else { cap(P(0, 0.1, hip), P(0.17, 0.13, 0.5), 0.08, D.legs); cap(P(0.17, 0.13, 0.5), P(0.17, 0.14, 0.07), 0.07, D.legs); cap(P(0, -0.1, hip), P(-0.1, -0.13, 0.5), 0.08, D.legs); cap(P(-0.1, -0.13, 0.5), P(-0.2, -0.14, 0.07), 0.07, D.legs); }
  cap(P(0, 0, hip + 0.04), P(lean, 0, chest), 0.15, D.body); cap(P(lean * 0.6, 0, hip + 0.22), P(lean + 0.03, 0, chest - 0.06), 0.165, D.kit);   // the trunk, the vest over it
  cap(P(headF, 0, headY), P(headF, 0, headY + 0.01), 0.105, D.head); if (D.hat) cap(P(headF - 0.01, 0, headY + 0.045), P(headF - 0.01, 0, headY + 0.055), 0.118, D.hat);
  const sh = chest + 0.03, cp = Math.cos(pitch), sp = Math.sin(pitch), G = (fw: number, rt: number): V3 => P(lean + 0.16 + fw * cp, rt, sh - 0.04 + fw * sp), muzzle = G(gun === 'rifle' ? 0.74 : 0.42, 0.05);
  if (gun === 'rifle') { cap(P(lean, -0.18, sh), G(0.14, -0.05), 0.05, D.body); cap(P(lean, 0.18, sh), G(0.44, 0.07), 0.05, D.body); cap(G(-0.12, 0.05), muzzle, 0.03, [0.03, 0.03, 0.032]); cap(G(0.1, 0.05), G(0.14, 0.05) .map((v, i) => i === 1 ? v - 0.16 : v) as V3, 0.028, [0.03, 0.03, 0.032]); }
  else if (gun === 'torch') { cap(P(lean, -0.18, sh), G(0.3, -0.1), 0.05, D.body); cap(G(0.3, -0.1), muzzle, 0.03, [0.05, 0.05, 0.05]); cap(P(lean, 0.18, sh), P(lean + 0.05, 0.22, hip + 0.05), 0.05, D.body); }
  else if (pose === 'kneel') { cap(P(lean, -0.18, sh), P(lean - 0.2, -0.07, hip + 0.08), 0.05, D.body); cap(P(lean, 0.18, sh), P(lean - 0.2, 0.07, hip + 0.08), 0.05, D.body); }   // (wrists behind the back)
  else if (pose === 'work') { cap(P(lean, -0.18, sh), P(lean + 0.5, -0.08, sh - 0.22), 0.05, D.body); cap(P(lean, 0.18, sh), P(lean + 0.5, 0.08, sh - 0.22), 0.05, D.body); }   // (both hands out on the thing)
  else { cap(P(lean, -0.18, sh), P(lean + 0.22, -0.16, hip + 0.12), 0.05, D.body); cap(P(lean, 0.18, sh), P(lean + 0.22, 0.16, hip + 0.12), 0.05, D.body); }
  men.push({ caps, c: [at[0] + f[0] * 0.2, 0.9, at[2] + f[1] * 0.2], rad: 1.5 }); return muzzle;
}

// ────────────────────────────────────────────────────────────────────────── the lights ──────────────────────────────────────────────────────────────────────────
interface Spot { p: V3; d: V3; ci: number; co: number; I: V3; range: number; rad: number; vol: number; /** the picture's own lamp: only what the picture draws stands in its way (a ceiling the lens looks through does not) */ stage?: boolean }
interface Area { i: number; L: V3; ax: number }
const spots: Spot[] = [], areas: Area[] = []; let keyDir: V3 = [0, 1, 0], keyE: V3 = [0, 0, 0], keySoft = 0.02, zen: V3 = [0, 0, 0], hor: V3 = [0, 0, 0];
let seed = 1; const rnd = () => { let t = (seed += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const blocked = (S: Scene, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, d: number, stage = false) => trace(S, ox, oy, oz, dx, dy, dz, d, stage ? F_SHADOW | F_PRIMARY : F_SHADOW, true) || traceMen(ox, oy, oz, dx, dy, dz, d, true);
let eR = 0, eG = 0, eB = 0;
/** the light arriving at a point with normal n from every lamp, panel and the far light (into eR eG eB); `thin` = a bounce's cheaper answer */
function lightAt(S: Scene, px: number, py: number, pz: number, nx: number, ny: number, nz: number, thin: boolean) {
  eR = eG = eB = 0; const ox = px + nx * 2e-3, oy = py + ny * 2e-3, oz = pz + nz * 2e-3;
  for (const L of spots) {
    let lx = L.p[0] - px, ly = L.p[1] - py, lz = L.p[2] - pz; const d2 = lx * lx + ly * ly + lz * lz; if (d2 > L.range * L.range) continue;
    const d = Math.sqrt(d2); let cosn = (lx * nx + ly * ny + lz * nz) / d; if (cosn <= 0) continue;
    let k = 1; if (L.co > -1) { const c = -(lx * L.d[0] + ly * L.d[1] + lz * L.d[2]) / d; if (c <= L.co) continue; k = c >= L.ci ? 1 : (c - L.co) / (L.ci - L.co); k = k * k * (3 - 2 * k); }
    const w = 1 - (d / L.range) ** 4; k *= w * w * cosn / Math.max(d2, 0.2); if (k * (L.I[0] + L.I[1] + L.I[2]) < 0.004) continue;
    if (L.rad > 0) { lx += (rnd() * 2 - 1) * L.rad; ly += (rnd() * 2 - 1) * L.rad; lz += (rnd() * 2 - 1) * L.rad; }
    const dd = Math.hypot(lx, ly, lz); if (blocked(S, ox, oy, oz, lx / dd, ly / dd, lz / dd, dd - 0.02, L.stage)) continue;
    eR += L.I[0] * k; eG += L.I[1] * k; eB += L.I[2] * k;
  }
  for (const A of areas) {
    const i = A.i, cx = S.C[i * 3], cy = S.C[i * 3 + 1], cz = S.C[i * 3 + 2]; let lx = cx - px, ly = cy - py, lz = cz - pz; const far2 = lx * lx + ly * ly + lz * lz; if (far2 > 110) continue;
    if (thin && rnd() < 0.5) continue; const boost = thin ? 2 : 1;
    const h = [S.H[i * 3], S.H[i * 3 + 1], S.H[i * 3 + 2]], cs = S.CS[i], sn = S.SN[i], q = [0, 0, 0]; let area = 4;
    for (let a = 0; a < 3; a++) if (a !== A.ax) { q[a] = (rnd() * 2 - 1) * h[a]; area *= h[a]; }
    const side = A.ax === 1 ? Math.sign(py - cy) || -1 : (A.ax === 0 ? Math.sign(cs * (px - cx) - sn * (pz - cz)) : Math.sign(sn * (px - cx) + cs * (pz - cz))) || 1; q[A.ax] = side * (h[A.ax] + 0.01);
    const wx = cx + cs * q[0] + sn * q[2], wy = cy + q[1], wz = cz - sn * q[0] + cs * q[2]; lx = wx - px; ly = wy - py; lz = wz - pz; const d2 = lx * lx + ly * ly + lz * lz, d = Math.sqrt(d2);
    const ln = A.ax === 1 ? [0, side, 0] : A.ax === 0 ? [cs * side, 0, -sn * side] : [sn * side, 0, cs * side], cosn = (lx * nx + ly * ny + lz * nz) / d, cosl = -(lx * ln[0] + ly * ln[1] + lz * ln[2]) / d;
    if (cosn <= 0 || cosl <= 0) continue; const k = boost * cosn * cosl * area / Math.max(d2, 0.5);
    if (blocked(S, ox, oy, oz, lx / d, ly / d, lz / d, d - 0.03)) continue; eR += A.L[0] * k; eG += A.L[1] * k; eB += A.L[2] * k;
  }
  let kx = keyDir[0] + (rnd() * 2 - 1) * keySoft, ky = keyDir[1] + (rnd() * 2 - 1) * keySoft, kz = keyDir[2] + (rnd() * 2 - 1) * keySoft; const kl = Math.hypot(kx, ky, kz); kx /= kl; ky /= kl; kz /= kl;
  const ck = kx * nx + ky * ny + kz * nz; if (ck > 0 && !blocked(S, ox, oy, oz, kx, ky, kz, 200)) { eR += keyE[0] * ck; eG += keyE[1] * ck; eB += keyE[2] * ck; }
}
const sky = (dy: number, out: number[]) => { const k = Math.min(1, Math.max(0, dy)) ** 0.6; out[0] = hor[0] + (zen[0] - hor[0]) * k; out[1] = hor[1] + (zen[1] - hor[1]) * k; out[2] = hor[2] + (zen[2] - hor[2]) * k; };

// ───────────────────────────────────────────────────────────────────────── one picture ─────────────────────────────────────────────────────────────────────────
interface Cam { look: number[]; yaw: number; pitch: number; dist: number }
interface Opts { W: number; H: number; spp: number; out: string; set: Record<string, Pin> }
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
function levelOf(file: string): { d: Data; file: string } {
  const look = file.replace(/\.json$/, '-gwot.json'), f = existsSync(join(ROOT, 'levels', look)) ? look : file;
  return { d: JSON.parse(readFileSync(join(ROOT, 'levels', f), 'utf8')) as Data, file: f };
}
async function officeTeams(): Promise<NonNullable<Data['scenarios']>> { const m = await import('../levels/office.scenarios') as { OFFICE_SCENARIOS: NonNullable<Data['scenarios']> }; return m.OFFICE_SCENARIOS; }

async function render(m: Mission, O: Opts): Promise<Cam> {
  const file = m.scenario?.level ?? 'office.json', { d } = levelOf(file), pin: Pin = { ...(PIN[m.id] ?? {}), ...(O.set[m.id] ?? {}) }, M: Mood = { ...(MOODS[m.group ?? 'raids'] ?? NIGHT), ...pin } as Mood;
  const S = new Scene(), lampsAll = (pin.lamps ?? 'all') === 'all'; men.length = 0; spots.length = 0; areas.length = 0; seed = hash(m.id);
  const sc = file === 'office.json' ? await officeTeams() : d.scenarios ?? {}, kind = m.scenario?.kind;
  // the level: boxes, door leaves (a few ajar: light through an opening door), furniture
  const lit = new Map<string, number[]>(); for (const s of d.switchables ?? []) if (s.on !== false || lampsAll) for (const id of s.boxes) lit.set(id, s.baseEmissive ?? [8, 7.6, 7]);
  const dark = new Set<string>(); for (const s of d.switchables ?? []) if (s.on === false && !lampsAll) for (const id of s.boxes) dark.add(id);
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const b of d.boxes) {
    if (b.flags?.includes('Cutaway')) continue; if (b.flags?.includes('Glass')) { S.add(b.c, b.h, b.yaw ?? 0, b.albedo ?? [0.8, 0.9, 0.9], undefined, F_GLASS); continue; }
    const alb = b.albedo ?? d.materials[b.material ?? '']?.albedo ?? [0.4, 0.4, 0.4], em = b.id && dark.has(b.id) ? undefined : b.id && lit.has(b.id) ? lit.get(b.id) : b.emissive;
    const i = S.add(b.c, b.h, b.yaw ?? 0, alb, em, (b.flags?.includes('NoPrimary') ? 0 : F_PRIMARY) | (b.flags?.includes('NoShadow') ? 0 : F_SHADOW));
    if (b.id && lit.has(b.id) && em && em[0] + em[1] + em[2] > 6) areas.push({ i, L: [em[0] * M.lampK, em[1] * M.lampK, em[2] * M.lampK], ax: b.h[1] <= b.h[0] && b.h[1] <= b.h[2] ? 1 : b.h[0] < b.h[2] ? 0 : 2 });
    const top = b.c[1] + b.h[1]; if (!/^(ground|floors|ceiling|beacons|look)/.test(b.group ?? '') && !b.flags?.includes('NoPrimary') && top >= 1.9 && b.c[1] - b.h[1] < 1) { x0 = Math.min(x0, b.c[0] - b.h[0]); x1 = Math.max(x1, b.c[0] + b.h[0]); z0 = Math.min(z0, b.c[2] - b.h[2]); z1 = Math.max(z1, b.c[2] + b.h[2]); }
  }
  if (!(x1 > x0)) { x0 = 0; z0 = 0; x1 = 40; z1 = 28; }
  const doorAt: number[][] = [];
  (d.doors ?? []).forEach(D => { const ajar = pin.ajar?.[D.id] ?? D.angle ?? ((hash(m.id + D.id) % 5 === 0 ? 1 : 0) * (0.5 + (hash(D.id) % 50) / 100)), a = D.closedDir + ajar, hh = (D.height ?? 2.01) / 2;
    S.add([D.hinge[0] + Math.cos(a) * D.width / 2, hh, D.hinge[1] + Math.sin(a) * D.width / 2], [D.width / 2 - 0.01, hh, 0.025], -a, D.albedo ?? (D.steel ? [0.3, 0.32, 0.34] : [0.42, 0.3, 0.19]), undefined, F_PRIMARY | F_SHADOW);
    doorAt.push([D.hinge[0] + Math.cos(D.closedDir) * D.width / 2, D.hinge[1] + Math.sin(D.closedDir) * D.width / 2]); });
  for (const p of d.props ?? []) { const cs = Math.cos(p.yaw ?? 0), sn = Math.sin(p.yaw ?? 0); for (const q of p.parts) S.add([p.x + cs * q.off[0] + sn * q.off[2], q.off[1], p.z - sn * q.off[0] + cs * q.off[2]], q.h, (p.yaw ?? 0) + (q.yaw ?? 0), q.albedo ?? d.materials[q.material ?? '']?.albedo ?? [0.3, 0.3, 0.3], q.emissive, F_PRIMARY | F_SHADOW); }
  // a charge on its clock (the level's own), or one set on a wall for the picture: a small red lamp and what it lights
  for (const c of [...(kind === 'roomclear' ? d.scenarios?.defuse?.devices ?? [] : []).map(v => v.pos), ...(pin.charges ?? [])]) {
    S.add([c[0], c[1], c[2]], [0.1, 0.07, 0.05], 0, [0.04, 0.04, 0.04], undefined, F_PRIMARY | F_SHADOW); S.add([c[0], c[1] + 0.085, c[2]], [0.03, 0.015, 0.03], 0, [0.1, 0.02, 0.02], [14, 0.5, 0.3], F_PRIMARY);
    spots.push({ p: [c[0], c[1] + 0.3, c[2]], d: [0, -1, 0], ci: 2, co: -2, I: [3.2, 0.2, 0.12], range: 6, rad: 0.03, vol: 0.7, stage: true }); }
  for (const q of pin.glow ?? []) spots.push({ p: [q[0], q[1], q[2]], d: [0, -1, 0], ci: 2, co: -2, I: [q[3], q[4], q[5]], range: q[6] ?? 9, rad: 0.12, vol: 0.5 });
  S.build();
  // the lamps
  for (const L of d.lights) {
    if (L.kind === 'dir') continue; if (L.enabled === false && !lampsAll) continue;
    const dl = Math.hypot(L.dir[0], L.dir[1], L.dir[2]) || 1, k = L.intensity * M.lampK;
    spots.push({ p: [L.pos[0], L.pos[1], L.pos[2]], d: [L.dir[0] / dl, L.dir[1] / dl, L.dir[2] / dl], ci: L.kind === 'spot' ? Math.cos(L.innerDeg * DEG) : 2, co: L.kind === 'spot' ? Math.cos(L.outerDeg * DEG) : -2, I: [L.color[0] * k, L.color[1] * k, L.color[2] * k], range: L.range, rad: L.radius ?? 0.1, vol: L.volumetric ?? 0.15 });
  }
  const az = M.keyAz * DEG, el = M.keyEl * DEG; keyDir = [Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el)]; keyE = [M.key[0] * M.keyK, M.key[1] * M.keyK, M.key[2] * M.keyK]; keySoft = M.keySoft;
  zen = M.zen.map(v => v * M.skyK) as V3; hor = M.hor.map(v => v * M.skyK) as V3;
  // who stands where: the team's start for this mission's kind
  const teams: Team[] = kind === 'roomclear' ? [sc.roomClear?.team, ...(sc.roomClear?.starts ?? [])].filter(Boolean) as Team[] : kind === 'nightbreach' ? [sc.nightBreach?.team ?? sc.roomClear?.team].filter(Boolean) as Team[] : kind === 'rescue' ? [sc.rescue?.team].filter(Boolean) as Team[] : sc.quiet?.starts ?? [];
  const T: Team = pin.at ? { sam: pin.at, ops: pin.ops } : teams[Math.min(teams.length - 1, pin.start ?? 0)] ?? { sam: d.mission?.playerSpawn ?? [4, 0, 4] }, held = kind === 'rescue' ? (sc as { rescue?: Held }).rescue : undefined;
  let at = pin.at ?? T.sam ?? d.mission?.playerSpawn ?? [4, 0, 4];
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ob = d.mission?.objectives?.find(o => o.area)?.area, goal = ob && kind === 'quiet' ? [(ob.x0 + ob.x1) / 2, (ob.z0 + ob.z1) / 2] : [cx, cz];
  // what the team looks at: the nearest door ahead of it, else the place's middle
  const loud = kind !== 'quiet' && !!kind, squad = m.squad ?? 0;
  // what the picture is about: for a loud team the door it will go in by (the nearest it has a line to, a few strides off), for a quiet man the nearest lamp's
  // pool — the thing between him and the place
  let aim = [goal[0], goal[1]], bd = 1e9; const open = (q: number[]) => { const dx = q[0] - at[0], dz = q[1] - at[2], dd = Math.hypot(dx, dz); return !trace(S, at[0], 1.3, at[2], dx / dd, 0, dz / dd, dd - 0.7, F_SHADOW, true); };
  if (pin.aim) { /* by hand */ } else if (loud) for (const q of doorAt) { const dd = Math.hypot(q[0] - at[0], q[1] - at[2]), price = dd + (dd < 4.5 ? 30 : 0) + (open(q) ? 0 : 12); if (dd > 2 && dd < 22 && price < bd) { bd = price; aim = q; } }
  else for (const L of d.lights) { if (L.kind === 'dir' || L.intensity < 20) continue; const q = [L.pos[0] + L.dir[0] * 1.5, L.pos[2] + L.dir[2] * 1.5], dd = Math.hypot(q[0] - at[0], q[1] - at[2]); if (dd > 4 && dd < 24 && dd < bd) { bd = dd; aim = q; } }
  if (pin.aim) aim = pin.aim;
  const toward0 = (p: number[], q: number[]) => { const dx = q[0] - p[0], dz = q[1] - p[2], n = Math.hypot(dx, dz) || 1; return [dx / n, dz / n]; };
  const lasers: { a: V3; b: V3 }[] = [];
  const subject: number[][] = [];   // who the picture has to show
  const pt = (q: number[] | { pos: number[] }): number[] => Array.isArray(q) ? q : q.pos;
  if (pin.cast !== 'none') {
    // the guards of a quiet place: one a beat, a torch in his hand, each where his round brings him a few strides from the man hiding — and the nearest of them is
    // what that man is watching
    const guard = (p: number[], f: number[]) => { const pitch = -0.32, muzzle = addMan(p, f, GUARD, false, 'torch', pitch);
      spots.push({ p: [muzzle[0] + f[0] * 0.05, muzzle[1], muzzle[2] + f[1] * 0.05], d: [f[0] * Math.cos(pitch), Math.sin(pitch), f[1] * Math.cos(pitch)], ci: Math.cos(9 * DEG), co: Math.cos(21 * DEG), I: [30, 26, 19], range: 18, rad: 0.02, vol: 0.9 }); };
    if (pin.guards) for (const q of pin.guards) guard([q[0], 0, q[1]], toward0([q[0], 0, q[1]], [q[2], q[3]]));
    else if (!loud) { let gd = 1e9; for (const R of (d.routes ?? []).slice(0, 4)) {
      let best = -1, bp = 1e9; R.points.forEach((q, k) => { const p = pt(q), dd = Math.hypot(p[0] - at[0], p[2] - at[2]); if (dd >= 5 && dd <= 18 && Math.abs(dd - 9) < bp) { bp = Math.abs(dd - 9); best = k; } }); if (best < 0) continue;
      const p = pt(R.points[best]), q = pt(R.points[(best + 1) % R.points.length]), f = Math.hypot(q[0] - p[0], q[2] - p[2]) > 0.3 ? toward0(p, [q[0], q[2]]) : toward0(p, [at[0], at[2]]); guard(p, f);
      const dd = Math.hypot(p[0] - at[0], p[2] - at[2]) + (open([p[0], p[2]]) ? 0 : 6); if (dd < gd && !pin.aim) { gd = dd; aim = [p[0], p[2]]; }
    } }
    const places: number[][] = [at]; if (squad > 0) { const ops = T.ops ?? (T.mate ? [T.mate] : []); for (let i = 0; i < squad; i++) places.push(ops[i] ?? [at[0] - 0.9 * (i % 2 ? 1 : -1) * 0.7, 0, at[2] + 1.1 + 0.6 * i]); }
    places.forEach((p, i) => {
      const spread = [aim[0] + ((hash(m.id + i) % 100) / 100 - 0.5) * 2.2, aim[1] + ((hash(m.id + 'z' + i) % 100) / 100 - 0.5) * 2.2], f = toward0(p, spread), dist = Math.hypot(spread[0] - p[0], spread[1] - p[2]);
      const D = loud ? OPERATOR : SNEAK;
      if (pin.work?.includes(i)) { addMan(p, toward0(p, aim), D, 'work', 'none'); return; }
      if (!loud && !pin.armed) { addMan(p, f, SNEAK, true, 'none'); return; }
      // a gun comes down for a friend in its line or a wall in its face, and its light goes out (the game's own rule): only a man with a clear line shows a beam
      const friend = places.some((q, j) => { if (j === i) return false; const ax = q[0] - p[0], az = q[2] - p[2], al = ax * f[0] + az * f[1]; return al > 0.2 && al < dist && Math.abs(ax * f[1] - az * f[0]) < 0.55; });
      const wall = trace(S, p[0], 1.35, p[2], f[0], 0, f[1], 3.6, F_SHADOW, true);
      if (friend || wall) { addMan(p, f, D, false, 'rifle', -0.85);
        return; }
      const pitch = Math.atan2(1.05 - 1.4, dist), muzzle = addMan(p, f, D, false, 'rifle', pitch), dir: V3 = [f[0] * Math.cos(pitch), Math.sin(pitch), f[1] * Math.cos(pitch)];
      spots.push({ p: [muzzle[0] + dir[0] * 0.06, muzzle[1] + 0.05, muzzle[2] + dir[2] * 0.06], d: dir, ci: Math.cos(7 * DEG), co: Math.cos(17 * DEG), I: [24, 23, 21], range: 26, rad: 0.02, vol: 1.0 });
      const hit = trace(S, muzzle[0], muzzle[1], muzzle[2], dir[0], dir[1], dir[2], 40, F_SHADOW, false) ? hT : 40; lasers.push({ a: muzzle, b: [muzzle[0] + dir[0] * hit, muzzle[1] + dir[1] * hit, muzzle[2] + dir[2] * hit] });
    });
    subject.push(...places);
    // the one man a snatch is for: stood where the level has him, facing the way they come
    const his = kind === 'roomclear' ? d.scenarios?.snatch?.man : undefined; if (his) { addMan(his.pos, toward0(his.pos, [at[0], at[2]]), { ...CIVIL, body: [0.42, 0.39, 0.32], legs: [0.2, 0.18, 0.15], kit: [0.42, 0.39, 0.32] }, false, 'none'); subject.push(his.pos); }
    // a rescue's picture is the room the clock runs in: the hostages on their knees and the man over them
    if (held?.captor && !pin.at) { const cp = held.captor.pos, hs = (held.hostages ?? []).map(h => h.pos), mid = hs.length ? [hs.reduce((a, h) => a + h[0], 0) / hs.length, hs.reduce((a, h) => a + h[2], 0) / hs.length] : [cp[0] + 1, cp[2]];
      for (const h of hs) addMan(h, toward0(h, [2 * h[0] - cp[0], 2 * h[2] - cp[2]]), CIVIL, 'kneel', 'none'); addMan(cp, toward0(cp, mid), GUARD, false, 'rifle', -0.3);
      subject.length = 0; subject.push(cp, ...hs); at = cp; aim = mid; }
  }
  // a tripwire's beam is drawn as the guns' lasers are
  for (const dv of d.devices ?? []) if (dv.kind === 'laser' && dv.from && dv.to) lasers.push({ a: dv.from as V3, b: dv.to as V3 });
  // the picture's own light: a shaft of the far light's colour on the cast from beyond them, so they stand out of the ground they are on (stage light: the one
  // lamp here that no level has)
  const sx = subject.length ? subject.reduce((a, p) => a + p[0], 0) / subject.length : at[0], sz = subject.length ? subject.reduce((a, p) => a + p[2], 0) / subject.length : at[2], srad = subject.reduce((a, p) => Math.max(a, Math.hypot(p[0] - sx, p[2] - sz)), 0);
  if (pin.cast !== 'none' && M.rim > 0) { const b = toward0([sx, 0, sz], aim), p: V3 = [sx + b[0] * 5.5, 9, sz + b[1] * 5.5], dv: V3 = [sx - b[0] * 0.5 - p[0], 0.9 - p[1], sz - b[1] * 0.5 - p[2]], dl = Math.hypot(...dv), k = M.rim * dl * dl;
    spots.push({ p, d: [dv[0] / dl, dv[1] / dl, dv[2] / dl], ci: Math.cos(9 * DEG + srad * 0.03), co: Math.cos(19 * DEG + srad * 0.05), I: [(M.rimC ?? M.key)[0] * k, (M.rimC ?? M.key)[1] * k, (M.rimC ?? M.key)[2] * k], range: 30, rad: 0.25, vol: 0.12, stage: true }); }
  // the camera: close over the cast's shoulder, the place beyond them. Of the ways to stand it (either shoulder, then higher) the first that sees every one of them
  const way = toward0([sx, 0, sz], aim), reach = Math.min(Math.hypot(aim[0] - sx, aim[1] - sz), 9), lead = pin.lead ?? (loud ? 0.4 : 0.28), look = pin.look ?? [sx + way[0] * reach * lead, 1.0, sz + way[1] * reach * lead], side0 = (pin.side ?? (Math.sign(way[0] * (cz - sz) - way[1] * (cx - sx)) || 1)) * (pin.flip ? -1 : 1);   // (the shoulder that turns the lens toward the middle of the place)
  const dist = pin.dist ?? 8.5 + reach * 0.45 + srad * 1.1 + (pin.back ?? 0), camAt = (side: number, pitch: number, swing: number) => { const sw = swing * DEG * side, hx = way[0] * Math.cos(sw) - way[1] * Math.sin(sw), hz = way[0] * Math.sin(sw) + way[1] * Math.cos(sw); return { yaw: Math.atan2(-hx, -hz) / DEG, pitch }; };
  // (the height is the mission's own, off its name: a group's pictures are not all taken from one ladder)
  const p0 = 26 + (hash(m.id + 'pitch') % 3) * 7; let pick = camAt(side0, pin.pitch ?? p0, pin.swing ?? 38), bestSeen = -1;
  if (pin.yaw === undefined) for (const [sd, pt2, sw] of [[side0, p0, 38], [-side0, p0, 38], [side0, p0, 75], [-side0, p0, 75], [side0, p0 + 10, 38], [-side0, p0 + 10, 38], [side0, p0, 140], [-side0, p0, 140], [side0, 52, 38], [-side0, 52, 38]] as number[][]) {
    const c = camAt(pin.side ?? sd, pin.pitch ?? pt2, pin.swing ?? sw), sy = Math.sin(c.yaw * DEG), cy = Math.cos(c.yaw * DEG), sp = Math.sin(c.pitch * DEG), cp = Math.cos(c.pitch * DEG), e = [look[0] + sy * cp * dist, (look[1] ?? 0) + sp * dist, look[2] + cy * cp * dist];
    // (five points a man — knee, chest, head, a shoulder's width either side — so a pole or a jamb across him counts against the place)
    let seen = 0; for (const q of subject) for (const [o2, hy] of [[0, 0.5], [0, 1.0], [0, 1.5], [-0.24, 1.1], [0.24, 1.1]]) { const dx = q[0] + cy * o2 - e[0], dy = hy - e[1], dz = q[2] - sy * o2 - e[2], dd = Math.hypot(dx, dy, dz); if (!trace(S, e[0], e[1], e[2], dx / dd, dy / dd, dz / dd, dd - 0.6, F_PRIMARY, true)) seen += 0.2; }
    if (seen > bestSeen + 1e-6) { bestSeen = seen; pick = c; } if (seen >= subject.length - 1e-6) break;
  }
  const C: Cam = { look, yaw: pin.yaw ?? pick.yaw, pitch: pick.pitch, dist };
  const sy = Math.sin(C.yaw * DEG), cy = Math.cos(C.yaw * DEG), sp = Math.sin(C.pitch * DEG), cp = Math.cos(C.pitch * DEG), f: V3 = [-sy * cp, -sp, -cy * cp], rt: V3 = [cy, 0, -sy], up: V3 = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
  const eye: V3 = [C.look[0] - f[0] * C.dist, (C.look[1] ?? 0) - f[1] * C.dist, C.look[2] - f[2] * C.dist], th = Math.tan(FOV * DEG / 2), asp = O.W / O.H, { W, H, spp } = O;
  const img = new Float32Array(W * H * 3), sk = [0, 0, 0], APERTURE = 0.11, HAZE = 0.022 * M.haze, STEPS = 7;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    let r = 0, g = 0, b = 0; seed = hash(m.id) ^ Math.imul(j * W + i + 1, 2654435761);
    for (let s = 0; s < spp; s++) {
      const u = ((i + rnd()) / W * 2 - 1) * th * asp, v = (1 - (j + rnd()) / H * 2) * th; let dx = f[0] + rt[0] * u + up[0] * v, dy = f[1] + rt[1] * u + up[1] * v, dz = f[2] + rt[2] * u + up[2] * v;
      // a lens: sharp where the camera looks, soft before and behind it (the miniature's look)
      const la = rnd() * 6.2832, lr = Math.sqrt(rnd()) * APERTURE, lx = Math.cos(la) * lr, ly = Math.sin(la) * lr, ox = eye[0] + rt[0] * lx + up[0] * ly, oy = eye[1] + rt[1] * lx + up[1] * ly, oz = eye[2] + rt[2] * lx + up[2] * ly;
      dx = eye[0] + dx * C.dist - ox; dy = eye[1] + dy * C.dist - oy; dz = eye[2] + dz * C.dist - oz; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      let t = 1e9, nx = 0, ny = 1, nz = 0, ar = 0, ag = 0, ab = 0, er = 0, eg = 0, eb = 0, got = false;
      if (trace(S, ox, oy, oz, dx, dy, dz, 400, F_PRIMARY, false)) { got = true; t = hT; nx = hNx; ny = hNy; nz = hNz; const q = hI * 3; ar = S.alb[q]; ag = S.alb[q + 1]; ab = S.alb[q + 2]; er = S.em[q]; eg = S.em[q + 1]; eb = S.em[q + 2]; }
      if (traceMen(ox, oy, oz, dx, dy, dz, t, false)) { got = true; t = cT; nx = cNx; ny = cNy; nz = cNz; const col = cCap!.col; ar = col[0]; ag = col[1]; ab = col[2]; er = eg = eb = 0; }
      let cr = 0, cg = 0, cb = 0;
      if (got) {
        const px = ox + dx * t, py = oy + dy * t, pz = oz + dz * t; lightAt(S, px, py, pz, nx, ny, nz, false); let ir = eR, ig = eG, ib = eB;
        // one bounce: a cosine-weighted way off the surface; the sky where it gets out, the lit surface where it lands
        const a1 = rnd() * 6.2832, r2 = rnd(), sr = Math.sqrt(r2), tx = Math.abs(nx) > 0.9 ? 0 : 1, ty = Math.abs(nx) > 0.9 ? 1 : 0, bx0 = ny * 0 - nz * ty, by0 = nz * tx - nx * 0, bz0 = nx * ty - ny * tx, bl = Math.hypot(bx0, by0, bz0), bx = bx0 / bl, by = by0 / bl, bz = bz0 / bl, c2x = ny * bz - nz * by, c2y = nz * bx - nx * bz, c2z = nx * by - ny * bx;
        const wz = Math.sqrt(1 - r2), wx = bx * Math.cos(a1) * sr + c2x * Math.sin(a1) * sr + nx * wz, wy = by * Math.cos(a1) * sr + c2y * Math.sin(a1) * sr + ny * wz, wzz = bz * Math.cos(a1) * sr + c2z * Math.sin(a1) * sr + nz * wz, qx = px + nx * 2e-3, qy = py + ny * 2e-3, qz = pz + nz * 2e-3;
        if (trace(S, qx, qy, qz, wx, wy, wzz, 60, F_SHADOW, false)) { const q = hI * 3, br = S.alb[q], bg = S.alb[q + 1], bb = S.alb[q + 2], e0 = S.em[q], e1 = S.em[q + 1], e2 = S.em[q + 2], small = e0 + e1 + e2 < 9 ? 1 : 0, t2 = hT, n2x = hNx, n2y = hNy, n2z = hNz;
          lightAt(S, qx + wx * t2, qy + wy * t2, qz + wzz * t2, n2x, n2y, n2z, true); const cl = Math.min(1, 5 / (eR + eG + eB + 1e-6)); eR *= cl; eG *= cl; eB *= cl; const ek = small * Math.min(1, 0.5 / (e0 + e1 + e2 + 1e-6)); ir += (br * eR / Math.PI + e0 * ek) * Math.PI; ig += (bg * eG / Math.PI + e1 * ek) * Math.PI; ib += (bb * eB / Math.PI + e2 * ek) * Math.PI; }
        else if (!traceMen(qx, qy, qz, wx, wy, wzz, 60, true)) { sky(wy, sk); ir += sk[0] * Math.PI; ig += sk[1] * Math.PI; ib += sk[2] * Math.PI; }
        cr = ar * ir / Math.PI + er; cg = ag * ig / Math.PI + eg; cb = ab * ib / Math.PI + eb;
      } else { cr = 0.005; cg = 0.006; cb = 0.01; }   // (off the level's slab: the dark the game's own picture has there)
      // glass between the lens and what it sees: each pane takes a little of it, shows the light that falls on its own dust, and has a bright cut edge
      for (let gt = 0, np = 0, tg = Math.min(t, 400); np < 3 && trace(S, ox + dx * gt, oy + dy * gt, oz + dz * gt, dx, dy, dz, tg - gt, F_GLASS, false); np++) {
        const gi = hI, th2 = gt + hT, gx = ox + dx * th2, gy = oy + dy * th2, gz = oz + dz * th2, gnx = hNx, gny = hNy, gnz = hNz, cs = S.CS[gi], sn = S.SN[gi], qx = gx - S.C[gi * 3], qz = gz - S.C[gi * 3 + 2];
        const l3 = [cs * qx - sn * qz, gy - S.C[gi * 3 + 1], sn * qx + cs * qz], h3 = [S.H[gi * 3], S.H[gi * 3 + 1], S.H[gi * 3 + 2]], thin = h3[0] <= h3[1] && h3[0] <= h3[2] ? 0 : h3[1] <= h3[2] ? 1 : 2;
        let edge = 1e9; for (let a = 0; a < 3; a++) if (a !== thin) edge = Math.min(edge, h3[a] - Math.abs(l3[a]));
        const facing = Math.abs(dx * gnx + dy * gny + dz * gnz), rim = edge < 0.03, dust = rim ? 0.4 : 0.03 + 0.3 * (1 - facing) ** 3, keep = rim ? 0.35 : 1;
        lightAt(S, gx + gnx * 2e-3, gy + gny * 2e-3, gz + gnz * 2e-3, gnx, gny, gnz, true); sky(0.4, sk);
        cr = cr * 0.84 * keep + dust * 0.8 * (eR / Math.PI + sk[0]); cg = cg * 0.9 * keep + dust * 0.95 * (eG / Math.PI + sk[1]); cb = cb * 0.88 * keep + dust * (eB / Math.PI + sk[2]);
        gt = th2 + 0.04;
      }
      // the beams: every lamp's light in the haze along the way to the eye
      const tEnd = Math.min(t, 70), step = tEnd / STEPS; let vr = 0, vg = 0, vb = 0;
      for (let k = 0; k < STEPS; k++) {
        const tt = (k + rnd()) * step, px = ox + dx * tt, py = oy + dy * tt, pz = oz + dz * tt; if (py > 6) continue;
        for (const L of spots) {
          if (L.vol <= 0) continue; const lx = L.p[0] - px, ly = L.p[1] - py, lz = L.p[2] - pz, d2 = lx * lx + ly * ly + lz * lz; if (d2 > L.range * L.range) continue; const dd = Math.sqrt(d2);
          let kk = 1; if (L.co > -1) { const c = -(lx * L.d[0] + ly * L.d[1] + lz * L.d[2]) / dd; if (c <= L.co) continue; kk = c >= L.ci ? 1 : (c - L.co) / (L.ci - L.co); kk = kk * kk * (3 - 2 * kk); }
          const w = 1 - (dd / L.range) ** 4; kk *= w * w * L.vol * HAZE * step / Math.max(d2, 1); if (kk * (L.I[0] + L.I[1] + L.I[2]) < 2e-4) continue;
          if (blocked(S, px, py, pz, lx / dd, ly / dd, lz / dd, dd - 0.05, L.stage)) continue; vr += L.I[0] * kk; vg += L.I[1] * kk; vb += L.I[2] * kk;
        }
      }
      const cm = Math.min(1, 14 / Math.max(cr, cg, cb, 1e-6)); r += cr * cm + vr; g += cg * cm + vg; b += cb * cm + vb;
    }
    const o = (j * W + i) * 3; img[o] = r / spp; img[o + 1] = g / spp; img[o + 2] = b / spp;
  }
  // a lone bright pixel (one unlucky sample of a lamp close by) comes down to the second brightest of its neighbours
  { const src = Float32Array.from(img), L = (x: number, y: number) => { const o = (y * W + x) * 3; return src[o] + src[o + 1] + src[o + 2]; };
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) { let a = 0, b = 0; for (let yy = -1; yy <= 1; yy++) for (let xx = -1; xx <= 1; xx++) { if (!xx && !yy) continue; const v = L(x + xx, y + yy); if (v > a) { b = a; a = v; } else if (v > b) b = v; }
      const v = L(x, y); if (v > b * 1.25 + 0.02) { const k = (b * 1.25 + 0.02) / v, o = (y * W + x) * 3; img[o] *= k; img[o + 1] *= k; img[o + 2] *= k; } } }
  // the lasers: thin red lines, each point of one drawn only where the lens has a line to it
  const proj = (p: number[]) => { const q = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], z = q[0] * f[0] + q[1] * f[1] + q[2] * f[2]; return [(0.5 + (q[0] * rt[0] + q[1] * rt[1] + q[2] * rt[2]) / (z * th * asp) / 2) * W, (0.5 - (q[0] * up[0] + q[1] * up[1] + q[2] * up[2]) / (z * th) / 2) * H, z]; };
  const wide = 1.3 * W / 760 + 0.45, rr = Math.ceil(wide);
  for (const L of lasers) { const a = proj(L.a), b = proj(L.b), n = Math.max(2, Math.min(6000, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2) || 2)); for (let k = 0; k <= n; k++) {
    const u = k / n, w3 = [L.a[0] + (L.b[0] - L.a[0]) * u, L.a[1] + (L.b[1] - L.a[1]) * u, L.a[2] + (L.b[2] - L.a[2]) * u], pr = proj(w3); if (!(pr[2] > 0.2)) continue; const x = pr[0], y = pr[1]; if (x < -rr || y < -rr || x > W + rr || y > H + rr) continue;
    const ex = w3[0] - eye[0], ey = w3[1] - eye[1], ez = w3[2] - eye[2], ed = Math.hypot(ex, ey, ez); if (trace(S, eye[0], eye[1], eye[2], ex / ed, ey / ed, ez / ed, ed - 0.08, F_PRIMARY, true) || traceMen(eye[0], eye[1], eye[2], ex / ed, ey / ed, ez / ed, ed - 0.08, true)) continue;
    for (let yy = Math.floor(y - rr); yy <= y + rr; yy++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++) { if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const w = Math.max(0, 1 - Math.hypot(xx + 0.5 - x, yy + 0.5 - y) / wide) * 0.4 * (k === n ? 6 : 1); const o = (yy * W + xx) * 3; img[o] += 4.2 * w; img[o + 1] += 0.26 * w; img[o + 2] += 0.18 * w; } } }
  // exposure off the picture's own bright end, a glow round what is brightest, the grade, a vignette; then a black point and a soft S (on a dark page at a
  // card's size lifted shadows read as fog)
  const lum = new Float32Array(W * H); for (let p = 0; p < W * H; p++) lum[p] = 0.2126 * img[p * 3] + 0.7152 * img[p * 3 + 1] + 0.0722 * img[p * 3 + 2];
  const sorted = Float32Array.from(lum).sort(), ref = Math.max(1e-4, sorted[Math.floor(W * H * 0.965)]), expo = 0.5 * M.expo * Math.min(1.7, Math.max(0.6, 0.62 / ref / 0.5));   // (the mood's own exposure, moved at most a stop by what is in the picture: a night stays a night)
  const bw = W >> 2, bh = H >> 2, bloom = new Float32Array(bw * bh * 3), tmp = new Float32Array(bw * bh * 3);
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let c = 0; c < 3; c++) { let s = 0; for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) s += Math.max(0, Math.min(img[((y * 4 + yy) * W + x * 4 + xx) * 3 + c] * expo, 12) - 0.9); bloom[(y * bw + x) * 3 + c] = s / 16; }
  const R = Math.max(2, Math.round(bw / 38)); for (let pass = 0; pass < 2; pass++) { const src = pass ? tmp : bloom, dst = pass ? bloom : tmp;
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) for (let c = 0; c < 3; c++) { let s = 0, ws = 0; for (let k = -R * 2; k <= R * 2; k++) { const xx = pass ? x : x + k, yy = pass ? y + k : y; if (xx < 0 || yy < 0 || xx >= bw || yy >= bh) continue; const w = Math.exp(-k * k / (2 * R * R)); s += src[(yy * bw + xx) * 3 + c] * w; ws += w; } dst[(y * bw + x) * 3 + c] = s / ws; } }
  const out = Buffer.alloc(W * H * 3), film = (x: number) => Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 3, bo = (Math.min(bh - 1, y >> 2) * bw + Math.min(bw - 1, x >> 2)) * 3, vx = x / W - 0.5, vy = y / H - 0.5, vig = 1 - 0.75 * Math.pow(vx * vx + vy * vy, 0.9);
    const c = [0, 0, 0]; for (let k = 0; k < 3; k++) c[k] = (img[o + k] * expo + bloom[bo + k] * 0.6) * vig;
    const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], sh = M.tintK * 0.045 / (1 + l * 14);
    for (let k = 0; k < 3; k++) { const v0 = Math.max(0, Math.pow(film(c[k] + M.tint[k] * sh * 8), 1 / 2.2) - 0.035) / 0.965, v = v0 * 0.6 + v0 * v0 * (3 - 2 * v0) * 0.4 + (rnd() - 0.5) * 0.012; out[o + k] = Math.max(0, Math.min(255, Math.round(v * 255))); }
  }
  mkdirSync(O.out, { recursive: true }); const ppm = join(O.out, `${m.id}.ppm`); writeFileSync(ppm, Buffer.concat([Buffer.from(`P6\n${W} ${H}\n255\n`), out]));
  try { const cv = Bun.spawnSync(['convert', ppm, '-quality', '86', join(O.out, `${m.id}.jpg`)]); if (cv.exitCode !== 0) throw new Error(`convert failed for ${m.id}: ${cv.stderr.toString()}`); }
  finally { try { unlinkSync(ppm); } catch { /* (it never got written) */ } }   // (no ImageMagick on the machine throws out of the spawn: the megabyte of raw picture goes either way)
  return { look: C.look.map(v => +v.toFixed(3)), yaw: +C.yaw.toFixed(2), pitch: C.pitch, dist: +C.dist.toFixed(2) };
}

// ─────────────────────────────────────────────────────────────────────────── the run ───────────────────────────────────────────────────────────────────────────
if (import.meta.main) {
  const argv = process.argv.slice(2), flag = (k: string, d: string) => { const i = argv.indexOf(k); if (i < 0) return d; const v = argv[i + 1]; argv.splice(i, 2); return v; };
  const size = flag('--size', '760x475').split('x').map(Number), spp = Math.floor(+flag('--spp', '40')) || 40, out = resolve(ROOT, flag('--out', 'public/assets/menu')), jobs = Math.floor(+flag('--jobs', '4')) || 4, set = flag('--set', '{}'), one = flag('--one', '');
  const O: Opts = { W: size[0], H: size[1], spp, out, set: JSON.parse(set) as Record<string, Pin> }, all = missionList();
  if (one) { const m = all.find(x => x.id === one); if (!m) { console.error(`no mission '${one}'`); process.exit(2); } const t0 = Date.now(), c = await render(m, O); console.log(`${one.padEnd(22)} ${((Date.now() - t0) / 1000).toFixed(1).padStart(6)} s   look ${c.look.join(' ')} · yaw ${c.yaw} · pitch ${c.pitch} · dist ${c.dist}`); process.exit(0); }
  const unknown = argv.filter(a => !all.some(m => m.id === a)); if (unknown.length) { console.error(`no mission '${unknown.join("', '")}'. Known: ${all.map(m => m.id).join(' ')}`); process.exit(2); }
  if (process.env.MENU_ART_LIST) { for (const m of all) console.log(m.id.padEnd(22), (m.group ?? '-').padEnd(12), m.scenario?.kind ?? '-', m.scenario?.level ?? 'office.json', 'squad', m.squad ?? 0); process.exit(0); }
  const prev = (() => { try { return JSON.parse(readFileSync(join(out, 'stills.json'), 'utf8')) as { w?: number; h?: number; stills: Record<string, unknown> }; } catch { return null; } })(), was = prev ? Object.keys(prev.stills) : [];
  // a mission tools/menu-shots has a recipe for is pictured from PLAY: a run that names no mission leaves it alone
  const played = new Set(Object.keys((await import('./menu-shots/recipes.cjs')).default as Record<string, unknown>));
  const queue = all.filter(m => argv.length ? argv.includes(m.id) : !played.has(m.id)).map(m => m.id); let bad = 0;
  if (!argv.length && played.size) console.log(`${played.size} left to tools/menu-shots: ${[...played].join(' ')}`);
  // the list names ONE size for the folder: a run that leaves pictures standing (missions not named, missions pictured from play) may not relabel them
  const kept = was.filter(id => !queue.includes(id) && all.some(m => m.id === id));
  if (kept.length && prev?.w && prev.h && (prev.w !== O.W || prev.h !== O.H)) { console.error(`--size ${O.W}x${O.H}: ${kept.length} pictures this run leaves alone are ${prev.w}x${prev.h}, and stills.json names one size. Use --size ${prev.w}x${prev.h}, or another --out.`); process.exit(2); }
  await Promise.all(Array.from({ length: Math.max(1, jobs) }, async () => { for (;;) { const id = queue.shift(); if (!id) return;
    const p = Bun.spawn(['bun', 'run', import.meta.path, '--one', id, '--size', `${O.W}x${O.H}`, '--spp', String(spp), '--out', out, '--set', set], { stdout: 'inherit', stderr: 'inherit' }); if (await p.exited !== 0) { bad++; console.error(`FAILED ${id}`); } } }));
  // the list the menu reads: every picture in the folder that is a mission's (a run that names missions keeps the rest). A picture of a mission that is gone is
  // removed only if the folder's last list named it: nothing else in a folder handed to --out is this tool's to delete.
  const ids: string[] = []; for (const fn of readdirSync(out)) { if (!fn.endsWith('.jpg')) continue; const id = fn.slice(0, -4); if (all.some(m => m.id === id)) ids.push(id); else if (was.includes(id)) unlinkSync(join(out, fn)); }
  writeFileSync(join(out, 'stills.json'), JSON.stringify({ v: 1, w: O.W, h: O.H, stills: Object.fromEntries(ids.sort().map(k => [k, 1])) }, null, 1) + '\n');
  console.log(`${ids.length} pictures in ${out}${bad ? ` · ${bad} FAILED` : ''}`); process.exit(bad ? 1 : 0);
}
