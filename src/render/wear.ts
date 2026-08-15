// The TRAFFIC MAP the detail layer's floor terms read (renderer v3 phase 4; render/shaders/detail.wgsl, bound by the g-buffer at its group 1 binding 6):
// two bytes per texel over the world's grid footprint at WEAR_RES texels a metre —
//   r = TRAFFIC 0‥255: where the shift walks. Every patrol route's legs traced over the nav grid (the paths the men actually take, waypoint to waypoint and
//       back round), stamped with a walking lane's width, plus every door's threshold (everybody funnels through a doorway) — the polish there wears matte;
//   g = WALL PROXIMITY 0‥255: how close the texel is to something standing on the floor (walls, cabinets, counters, plinths — the statics whose foot is at
//       floor level), 255 at contact → 0 at GRIME_REACH: the band a mop does not reach.
// A pure function of the level + its nav grid (nothing random: the same level draws the same wear); built once at boot by game.ts. The viewer / editor build
// none, so their g-buffer keeps its 1×1 zero and the floor terms do nothing there.
import type { Level } from '../scene/level';
import type { NavGrid } from '../scene/collision';
import { WORLD } from '../scene/world';
import { BoxFlag } from '../scene/boxes';

export const WEAR_RES = 8;          // texels per metre (12.5 cm: a lane's edge is soft over twice that anyway)
const LANE_SIGMA = 0.34;            // a walking lane's Gaussian half-width (m): two feet and some wander
const DOOR_SIGMA = 0.55;            // a threshold's blob (m)
const DOOR_AMP = 1.4;               // … and its weight against one route pass
const TRAFFIC_K = 1.1;              // saturation: traffic = 1 − exp(−K × passes) — two overlapping routes read as well worn, not twice as worn
const GRIME_REACH = 0.16;           // wall proximity falls to 0 this far from the foot of the wall (m)

export interface WearMap { data: Uint8Array; w: number; h: number }

export function buildWearMap(level: Level, nav: NavGrid | null): WearMap {
  const w = Math.round(WORLD.gridW * WORLD.gridCell * WEAR_RES), h = Math.round(WORLD.gridH * WORLD.gridCell * WEAR_RES);
  const ox = WORLD.min[0], oz = WORLD.min[2];
  const T = new Float32Array(w * h);
  // ---- traffic: Gaussian stamps along polylines ----
  const stamp = (x: number, z: number, sigma: number, amp: number) => {
    const r = sigma * 2.5, s2 = 2 * sigma * sigma;
    const x0 = Math.max(0, Math.floor((x - r - ox) * WEAR_RES)), x1 = Math.min(w - 1, Math.ceil((x + r - ox) * WEAR_RES));
    const z0 = Math.max(0, Math.floor((z - r - oz) * WEAR_RES)), z1 = Math.min(h - 1, Math.ceil((z + r - oz) * WEAR_RES));
    for (let tz = z0; tz <= z1; tz++) {
      const pz = oz + (tz + 0.5) / WEAR_RES; const dz = pz - z;
      for (let tx = x0; tx <= x1; tx++) { const px = ox + (tx + 0.5) / WEAR_RES; const dx = px - x; const d2 = dx * dx + dz * dz; if (d2 <= r * r) T[tz * w + tx] += amp * Math.exp(-d2 / s2); }
    }
  };
  /** stamp a segment a→b every ~10 cm; `amp` is per metre walked so a leg's weight does not depend on the step */
  const walk = (ax: number, az: number, bx: number, bz: number, amp: number) => {
    const len = Math.hypot(bx - ax, bz - az); const n = Math.max(1, Math.ceil(len / 0.1)); const per = amp * (len / n) / (LANE_SIGMA * 2.5);
    for (let i = 0; i <= n; i++) { const t = i / n; stamp(ax + (bx - ax) * t, az + (bz - az) * t, LANE_SIGMA, per); }
  };
  for (const route of level.routes) {
    const pts = route.points; if (pts.length < 2) continue;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];   // the loop closes: the last waypoint walks back to the first
      const path = nav?.findPath(a, b, 6000) ?? null;
      const poly = path && path.length >= 2 ? path : [a, b];
      for (let k = 0; k + 1 < poly.length; k++) walk(poly[k][0], poly[k][2], poly[k + 1][0], poly[k + 1][2], 1);
      // a man stands and turns at each waypoint for his wait: a worn patch there
      stamp(a[0], a[2], LANE_SIGMA * 1.3, 0.35 + Math.min(1, (route.wait[i] ?? 0) / 20));
    }
  }
  for (const d of level.doors) {   // thresholds: the frame centre (doors.ts frameCentre), both faces
    const cx = d.hinge[0] + Math.cos(d.closedDir) * d.width * 0.5, cz = d.hinge[1] + Math.sin(d.closedDir) * d.width * 0.5;
    stamp(cx, cz, DOOR_SIGMA, DOOR_AMP);
  }
  // ---- wall proximity: occupancy of statics standing on the floor, then a 3-4 chamfer distance transform ----
  const occ = new Uint8Array(w * h);
  for (const b of level.boxes) {
    if (b.flags & BoxFlag.NoShadow) continue;                            // glow cards, decals
    const bottom = b.c[1] - b.h[1], top = b.c[1] + b.h[1];
    if (bottom > 0.06 || top < 0.25) continue;                           // not standing on the floor / a floor slab or a rug itself
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const ex = Math.abs(c) * b.h[0] + Math.abs(s) * b.h[2], ez = Math.abs(s) * b.h[0] + Math.abs(c) * b.h[2];
    const x0 = Math.max(0, Math.floor((b.c[0] - ex - ox) * WEAR_RES)), x1 = Math.min(w - 1, Math.ceil((b.c[0] + ex - ox) * WEAR_RES));
    const z0 = Math.max(0, Math.floor((b.c[2] - ez - oz) * WEAR_RES)), z1 = Math.min(h - 1, Math.ceil((b.c[2] + ez - oz) * WEAR_RES));
    for (let tz = z0; tz <= z1; tz++) {
      const pz = oz + (tz + 0.5) / WEAR_RES - b.c[2];
      for (let tx = x0; tx <= x1; tx++) {
        const px = ox + (tx + 0.5) / WEAR_RES - b.c[0];
        const lx = c * px - s * pz, lz = s * px + c * pz;                 // world → box local (Box.yaw convention: local +x → (cos, 0, −sin))
        if (Math.abs(lx) <= b.h[0] + 0.5 / WEAR_RES && Math.abs(lz) <= b.h[2] + 0.5 / WEAR_RES) occ[tz * w + tx] = 1;
      }
    }
  }
  const INF = 1e6; const D = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) D[i] = occ[i] ? 0 : INF;
  const d1 = 1, d2 = Math.SQRT2;
  for (let z = 0; z < h; z++) for (let x = 0; x < w; x++) {              // forward pass
    const i = z * w + x; let v = D[i];
    if (x > 0) v = Math.min(v, D[i - 1] + d1); if (z > 0) { v = Math.min(v, D[i - w] + d1); if (x > 0) v = Math.min(v, D[i - w - 1] + d2); if (x < w - 1) v = Math.min(v, D[i - w + 1] + d2); }
    D[i] = v;
  }
  for (let z = h - 1; z >= 0; z--) for (let x = w - 1; x >= 0; x--) {    // backward pass
    const i = z * w + x; let v = D[i];
    if (x < w - 1) v = Math.min(v, D[i + 1] + d1); if (z < h - 1) { v = Math.min(v, D[i + w] + d1); if (x < w - 1) v = Math.min(v, D[i + w + 1] + d2); if (x > 0) v = Math.min(v, D[i + w - 1] + d2); }
    D[i] = v;
  }
  const data = new Uint8Array(w * h * 2);
  for (let i = 0; i < w * h; i++) {
    const traffic = 1 - Math.exp(-TRAFFIC_K * T[i]);
    const distM = Math.max(0, D[i] / WEAR_RES - 0.5 / WEAR_RES);          // texel centre → metres from the occupied texel's edge
    const prox = occ[i] ? 1 : Math.max(0, 1 - distM / GRIME_REACH);
    data[i * 2] = Math.max(0, Math.min(255, Math.round(traffic * 255)));
    data[i * 2 + 1] = Math.max(0, Math.min(255, Math.round(prox * 255)));
  }
  return { data, w, h };
}
