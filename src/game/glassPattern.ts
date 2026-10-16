// THE FRACTURE PATTERN of a pane (game/glassbreak.ts owns the state; this file is the pure geometry, no Game — tools/qa/glass-plot.ts and the probes import it alone, and
// common.wgsl's gb* functions repeat it statement for statement: keep the two in step, `probes.ts glassbreak-open` compares them over the very rows handed to the GPU).
//
// A blow leaves a SITE on the pane's face, in pane-local (u along the pane, v up) metres: n RADIAL cracks out of it at hashed bearings, and CHORDS — straight cracks joining
// neighbouring radials at hashed radii, the 'concentric' cracks of real glass (which are straight between the radials they stop at, and do not all close: in a hashed share
// of the sectors the middle chord is missing). So round a site the glass is cut into pieces named (sector s between radials s and s+1, band b):
//     band 0 = the crater wedges (pulverised: they go together when a round punches the pane) · bands 1, 2 = the ring pieces round the hole (ONE piece, band 1, where the
//     middle chord is missing) · and, once the pane has RUN (glassbreak.ts: enough energy taken that the radials reach the frame), the DAGGERS: past chord 2 every sector
//     forks once — a branch crack at a hashed bearing splits it into a left and a right half — and each half runs out to wherever the site's territory ends (the frame, or
//     the next site's cracks), most of them snapped across once on the way by a short tilted crack of their own at a hashed distance: bands 3, 4 = the NEAR daggers (left,
//     right: chord 2 out to that snap, or all the way where there is none), bands 5, 6 = the FAR ones beyond it. Until the pane runs everything past chord 2 is the whole
//     sheet still, with the radials drawn part of the way into it.
// Territories: the POWER diagram of the sites weighted by their ring-zone radius rz (a site's ring zone always lies inside its own cell — glassbreak.ts fits rz to the room
// there is when a site is added), so a later blow's cracks stop at the earlier ones' and no piece is ever re-cut. Every piece is a CONVEX polygon (a wedge under 180° cut by
// half-planes), which is what the release hook hands on and what the support rule walks.
//
// Tempered glass does not use sites: it DICES (gpDice*) — the sheet lets go in irregular clumps, the cells of a jittered lattice, in order of a hashed key that grows with
// the distance from the blow.
//
// Everything hashed comes from gpHash — 32-bit integer arithmetic that WGSL's u32 repeats exactly — over the site's 24-bit seed; the float work after it (a cos, a product)
// differs between f64 here and f32 there by parts in 10⁷: micrometres on a pane, only ever at a crack line itself.

export const GP_MAX_SITES = 8, GP_MAX_SECTORS = 12, GP_BANDS = 7;
export const GP_FRAGS_PER_SITE = GP_BANDS * GP_MAX_SECTORS;   // 84: fid = site × 84 + band × 12 + sector
/** how far a radial's bearing strays from the even fan, in sectors (±0.3: no sector wider than 1.6 / n of a turn — under 180° for n ≥ 4) */
export const GP_ANG_JIT = 0.6;
/** a chord meets a radial at its base radius × (GP_RHO_LO + GP_RHO_SPAN × hash): ±22 %, so neighbouring bases must stand ≥ 1.57× apart for the chords of one sector to nest */
export const GP_RHO_LO = 0.78, GP_RHO_SPAN = 0.44;
/** the branch crack that forks a sector past chord 2 sits this far across it (a fraction of the sector: LO + SPAN × hash) */
export const GP_SPLIT_LO = 0.35, GP_SPLIT_SPAN = 0.3;
/** a dagger's snap: missing in this share of the half-sectors; else at rho[3] × (LO + SPAN × hash) along the half's middle bearing, its normal tilted ± TILT / 2 rad off that bearing */
export const GP_CUT_NONE = 0.45, GP_CUT_LO = 0.9, GP_CUT_SPAN = 1.0, GP_CUT_TILT = 0.9;
/** before a pane runs chord 2 is DRAWN in this share of the sectors only (the piece inside it exists either way: a partial arc, not a closed ring) */
export const GP_C2_DRAWN = 0.45;
/** the share of a web's sectors whose outer ring crack is drawn */
export const GP_WEB_RING = 0.45;
export const GP_REMAINDER = -2;   // 'neighbour' id of the uncut sheet beyond chord 2 of a pane that has not run

export interface GpSite {
  u: number; v: number;
  /** bearing of radial 0's even position (rad) */ rot: number;
  /** radials (5‥12) */ n: number;
  /** 24-bit */ seed: number;
  /** base radii of chords 0‥2 (m), each ≥ 1.57× the last; [3] = the base distance of the daggers' snaps (annealed) / of the web's outer ring (laminated), ≥ 2× [2] */ rho: [number, number, number, number];
  /** ring-zone radius = the power-diagram weight: ≥ any chord-2 point's distance */ rz: number;
  /** energy taken here (1 = a pistol round); 0 never happens for a real site */ e: number;
  /** share of the sectors whose middle chord is missing (their two ring pieces are one) */ merge: number;
  hits: number;
}
export type Pt = [number, number];
type FrameSide = 'bottom' | 'right' | 'top' | 'left';
type Tag = FrameSide | 0;

/** the one hash: (seed, a, b) → 24 bits. WGSL: h = seed ^ ((a + 1u) * 0x9E3779B1u) ^ ((b + 1u) * 0x85EBCA77u); h = (h ^ (h >> 15u)) * 0x2C1B3C6Du; h = (h ^ (h >> 12u)) * 0x297A2D39u; (h ^ (h >> 15u)) >> 8u */
export function gpHash(seed: number, a: number, b: number): number {
  let h = (seed ^ Math.imul(a + 1, 0x9E3779B1) ^ Math.imul(b + 1, 0x85EBCA77)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2C1B3C6D) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297A2D39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) >>> 8;
}
export const gpJit = (seed: number, a: number, b: number) => gpHash(seed, a, b) / 16777216;
const wrap = (k: number, n: number) => ((k % n) + n) % n;
/** where radial k sits, in sectors (k may be −1 ‥ n: the fan wraps) */
export function gpBound(S: GpSite, k: number): number { return k + GP_ANG_JIT * (gpJit(S.seed, wrap(k, S.n), 7) - 0.5); }
export function gpAngle(S: GpSite, k: number): number { return S.rot + 2 * Math.PI * gpBound(S, k) / S.n; }
/** the radius at which chord b (0‥3) meets radial k */
export function gpRho(S: GpSite, k: number, b: number): number { return S.rho[b] * (GP_RHO_LO + GP_RHO_SPAN * gpJit(S.seed, wrap(k, S.n), b)); }
export function gpChordPt(S: GpSite, k: number, b: number): Pt { const a = gpAngle(S, k), r = gpRho(S, k, b); return [S.u + r * Math.cos(a), S.v + r * Math.sin(a)]; }
/** how far radial k is DRAWN into the uncut sheet before the pane runs (m from the site): past chord 2 by a hashed 1.25‥3.25×, longer for a harder blow */
export function gpReach(S: GpSite, k: number): number { return gpRho(S, k, 2) * (1.25 + 2.0 * gpJit(S.seed, wrap(k, S.n), 9)) * Math.min(1.6, 0.6 + 0.4 * S.e); }
/** sector s has no middle chord: its two ring pieces are one (band 1) */
export function gpMerged(S: GpSite, s: number): boolean { return gpJit(S.seed, s, 21) < S.merge; }
/** where sector s's branch crack sits, in sectors (between gpBound(s) and gpBound(s + 1)) */
export function gpSplit(S: GpSite, s: number): number { const b0 = gpBound(S, s), b1 = gpBound(S, s + 1); return b0 + (b1 - b0) * (GP_SPLIT_LO + GP_SPLIT_SPAN * gpJit(S.seed, s, 23)); }
/** the snap across half h (0 left, 1 right) of sector s: a line through P with unit normal N pointing AWAY from the site (the far dagger is the side N points to); null = this dagger runs unbroken */
export function gpCut(S: GpSite, s: number, h: number): { px: number; py: number; nx: number; ny: number } | null {
  if (gpJit(S.seed, s, 27 + h) < GP_CUT_NONE) return null;
  const sp = gpSplit(S, s); const mid = h === 0 ? (gpBound(S, s) + sp) / 2 : (sp + gpBound(S, s + 1)) / 2;
  const am = S.rot + 2 * Math.PI * mid / S.n; const rc = S.rho[3] * (GP_CUT_LO + GP_CUT_SPAN * gpJit(S.seed, s, 25 + h));
  const an = am + (gpJit(S.seed, s, 29 + h) - 0.5) * GP_CUT_TILT;
  return { px: S.u + rc * Math.cos(am), py: S.v + rc * Math.sin(am), nx: Math.cos(an), ny: Math.sin(an) };
}

/** whose territory (u, v) is in: the least POWER distance |p − c|² − rz² (−1 = no sites) */
export function gpNearest(sites: readonly GpSite[], u: number, v: number): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < sites.length; i++) { const s = sites[i]; const d = (s.u - u) ** 2 + (s.v - v) ** 2 - s.rz * s.rz; if (d < bd) { bd = d; best = i; } }
  return best;
}
const beyond = (A: Pt, B: Pt, u: number, v: number) => (B[0] - A[0]) * (v - A[1]) - (B[1] - A[1]) * (u - A[0]) < 0;   // past the chord A → B (the site is to the LEFT of A → B, radials counted anticlockwise)
/** the sector of (u, v) round site S and its position t across the fan (in sectors, the same unit as gpBound) */
export function gpSector(S: GpSite, u: number, v: number): { s: number; t: number } {
  const n = S.n; let t = (Math.atan2(v - S.v, u - S.u) - S.rot) / (2 * Math.PI); t = (t - Math.floor(t)) * n;
  const s0 = Math.min(n - 1, Math.floor(t));
  if (t < gpBound(S, s0)) return s0 === 0 ? { s: n - 1, t: t + n } : { s: s0 - 1, t };
  if (t >= gpBound(S, s0 + 1)) return s0 === n - 1 ? { s: 0, t: t - n } : { s: s0 + 1, t };
  return { s: s0, t };
}
/** the sector and band of (u, v) round site S */
export function gpSectorBand(S: GpSite, u: number, v: number): { s: number; b: number } {
  const { s, t } = gpSector(S, u, v);
  if (!beyond(gpChordPt(S, s, 0), gpChordPt(S, s + 1, 0), u, v)) return { s, b: 0 };
  const merged = gpMerged(S, s);
  if (!merged && !beyond(gpChordPt(S, s, 1), gpChordPt(S, s + 1, 1), u, v)) return { s, b: 1 };
  if (!beyond(gpChordPt(S, s, 2), gpChordPt(S, s + 1, 2), u, v)) return { s, b: merged ? 1 : 2 };
  const h = t >= gpSplit(S, s) ? 1 : 0; const c = gpCut(S, s, h);
  return { s, b: (c && c.nx * (u - c.px) + c.ny * (v - c.py) > 0 ? 5 : 3) + h };
}
export const gpFid = (i: number, s: number, b: number) => i * GP_FRAGS_PER_SITE + b * GP_MAX_SECTORS + s;
export const gpUnfid = (fid: number) => ({ i: Math.floor(fid / GP_FRAGS_PER_SITE), b: Math.floor((fid % GP_FRAGS_PER_SITE) / GP_MAX_SECTORS), s: fid % GP_MAX_SECTORS });
/** the piece (u, v) is in: fid, or GP_REMAINDER (the uncut sheet: past chord 2 of a pane that has not run), or −1 (no sites) */
export function gpClassify(sites: readonly GpSite[], run: boolean, u: number, v: number): number {
  const i = gpNearest(sites, u, v); if (i < 0) return -1;
  const { s, b } = gpSectorBand(sites[i], u, v);
  if (b >= 3 && !run) return GP_REMAINDER;
  return gpFid(i, s, b);
}

// ---------------------------------------------------------------- polygons
/** Sutherland–Hodgman against one half-plane n·p ≤ d; tags[k] names what made the edge pts[k] → pts[k+1] (a frame side, or 0 = a crack) */
function clip(pts: Pt[], tags: Tag[], nx: number, ny: number, d: number): { pts: Pt[]; tags: Tag[] } {
  if (pts.length < 3) return { pts: [], tags: [] };
  const inside = (p: Pt) => nx * p[0] + ny * p[1] <= d + 1e-12;
  const np: Pt[] = [], nIn: Tag[] = [];   // nIn[k] = tag of the edge ARRIVING at np[k]
  for (let k = 0; k < pts.length; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length], t = tags[k]; const ain = inside(a), bin = inside(b);
    if (ain && bin) { np.push(b); nIn.push(t); }
    else if (ain && !bin) { np.push(isect(a, b, nx, ny, d)); nIn.push(t); }
    else if (!ain && bin) { np.push(isect(a, b, nx, ny, d)); nIn.push(0); np.push(b); nIn.push(t); }
  }
  return { pts: np, tags: nIn.map((_, k) => nIn[(k + 1) % nIn.length]) };
}
function isect(a: Pt, b: Pt, nx: number, ny: number, d: number): Pt {
  const da = nx * a[0] + ny * a[1] - d, db = nx * b[0] + ny * b[1] - d; const t = da / (da - db);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
type Poly = { pts: Pt[]; tags: Tag[] };
const rectPoly = (hu: number, hv: number): Poly => ({ pts: [[-hu, -hv], [hu, -hv], [hu, hv], [-hu, hv]], tags: ['bottom', 'right', 'top', 'left'] });
/** site i's territory: its power cell clipped to the pane */
export function gpRegion(sites: readonly GpSite[], i: number, hu: number, hv: number): Poly {
  let P = rectPoly(hu, hv); const a = sites[i];
  for (let j = 0; j < sites.length && P.pts.length >= 3; j++) {
    if (j === i) continue; const b = sites[j];
    P = clip(P.pts, P.tags, b.u - a.u, b.v - a.v, (b.u * b.u + b.v * b.v - a.u * a.u - a.v * a.v + a.rz * a.rz - b.rz * b.rz) / 2);
  }
  return P;
}

export interface GpNb { /** the piece across the crack (or GP_REMAINDER) */ fid: number; /** metres of crack shared */ len: number; /** the v component of this edge's outward normal (−1 = the neighbour is straight below) */ ny: number; /** the u extent of the shared stretch */ u0: number; u1: number }
export interface GpFrag {
  fid: number; i: number; s: number; b: number;
  pts: Pt[]; area: number; cen: Pt; perim: number; uMin: number; uMax: number; vMin: number; vMax: number;
  /** metres of this piece's edge on each frame side */ frame: { bottom: number; right: number; top: number; left: number };
  /** the u extent of its edge on the sill (null = not on the sill) */ foot: [number, number] | null;
  /** what lies across each of its cracks, intact or not */ nb: GpNb[];
}
const NB_SAMPLES = 6;
/** every piece the sites cut the pane into: bands 0‥2 always, the daggers (3‥6) once `run`. Pieces with no area (a ring zone hanging over the frame, a snap past the frame)
 *  are left out. Neighbours are found by asking gpClassify just across each crack at NB_SAMPLES points along it and then made symmetric, so both sides of a crack agree on
 *  who is across it whatever made the crack. */
export function gpFragments(sites: readonly GpSite[], run: boolean, hu: number, hv: number): GpFrag[] {
  const out: GpFrag[] = [];
  const add = (i: number, s: number, b: number, P: Poly) => {
    const pts = P.pts; if (pts.length < 3) return;
    let area = 0, cx = 0, cy = 0, perim = 0, uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity;
    const fid = gpFid(i, s, b); const frame = { bottom: 0, right: 0, top: 0, left: 0 }; const nb: GpNb[] = []; let foot: [number, number] | null = null;
    for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; const cr = p[0] * q[1] - q[0] * p[1]; area += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr; }
    area /= 2; if (area < 1e-7) return;
    for (let k = 0; k < pts.length; k++) {
      const p = pts[k], q = pts[(k + 1) % pts.length]; const ex = q[0] - p[0], ey = q[1] - p[1]; const len = Math.hypot(ex, ey); perim += len;
      uMin = Math.min(uMin, p[0]); uMax = Math.max(uMax, p[0]); vMin = Math.min(vMin, p[1]); vMax = Math.max(vMax, p[1]);
      if (len < 1e-7) continue;
      const t = P.tags[k];
      if (t !== 0) { frame[t] += len; if (t === 'bottom') foot = foot ? [Math.min(foot[0], p[0], q[0]), Math.max(foot[1], p[0], q[0])] : [Math.min(p[0], q[0]), Math.max(p[0], q[0])]; continue; }
      const nx = ey / len, ny = -ex / len;   // (anticlockwise polygon: the outward normal of p → q is (ey, −ex) / len)
      for (let j = 0; j < NB_SAMPLES; j++) {
        const a = j / NB_SAMPLES, c = (j + 1) / NB_SAMPLES, m = (a + c) / 2;
        const f = gpClassify(sites, run, p[0] + ex * m + nx * 1e-4, p[1] + ey * m + ny * 1e-4); if (f === -1 || f === fid) continue;
        const ua = p[0] + ex * a, ub = p[0] + ex * c; const last = nb[nb.length - 1];
        if (last && last.fid === f && last.ny === ny) { last.len += len / NB_SAMPLES; last.u0 = Math.min(last.u0, ua, ub); last.u1 = Math.max(last.u1, ua, ub); }
        else nb.push({ fid: f, len: len / NB_SAMPLES, ny, u0: Math.min(ua, ub), u1: Math.max(ua, ub) });
      }
    }
    out.push({ fid, i, s, b, pts, area, cen: [cx / (6 * area), cy / (6 * area)], perim, uMin, uMax, vMin, vMax, frame, foot, nb });
  };
  const half = (P: Poly, A: Pt, B: Pt, far: boolean): Poly => { const ex = B[0] - A[0], ey = B[1] - A[1]; return far ? clip(P.pts, P.tags, -ey, ex, -ey * A[0] + ex * A[1]) : clip(P.pts, P.tags, ey, -ex, ey * A[0] - ex * A[1]); };   // far = the side away from the site of chord A → B
  const ray = (P: Poly, S: GpSite, ang: number, left: boolean): Poly => { const dx = Math.cos(ang), dy = Math.sin(ang); return left ? clip(P.pts, P.tags, dy, -dx, dy * S.u - dx * S.v) : clip(P.pts, P.tags, -dy, dx, -dy * S.u + dx * S.v); };   // left = anticlockwise of the ray
  for (let i = 0; i < sites.length; i++) {
    const S = sites[i]; const region = run ? gpRegion(sites, i, hu, hv) : null;
    for (let s = 0; s < S.n; s++) {
      const a0 = gpAngle(S, s), a1 = gpAngle(S, s + 1);
      const C = [0, 1, 2].map(b => [gpChordPt(S, s, b), gpChordPt(S, s + 1, b)] as [Pt, Pt]);
      const wedge = ray(ray(rectPoly(hu, hv), S, a0, true), S, a1, false); const merged = gpMerged(S, s);
      add(i, s, 0, half(wedge, C[0][0], C[0][1], false));
      add(i, s, 1, half(half(wedge, C[0][0], C[0][1], true), C[merged ? 2 : 1][0], C[merged ? 2 : 1][1], false));
      if (!merged) add(i, s, 2, half(half(wedge, C[1][0], C[1][1], true), C[2][0], C[2][1], false));
      if (!run) continue;
      const as = S.rot + 2 * Math.PI * gpSplit(S, s) / S.n;
      for (let h = 0; h < 2; h++) {
        let P: Poly = { pts: region!.pts.slice(), tags: region!.tags.slice() };
        P = h === 0 ? ray(ray(P, S, a0, true), S, as, false) : ray(ray(P, S, as, true), S, a1, false);
        P = half(P, C[2][0], C[2][1], true);
        const c = gpCut(S, s, h);
        if (!c) { add(i, s, 3 + h, P); continue; }
        const d = c.nx * c.px + c.ny * c.py;
        add(i, s, 3 + h, clip(P.pts, P.tags, c.nx, c.ny, d)); add(i, s, 5 + h, clip(P.pts, P.tags, -c.nx, -c.ny, -d));
      }
    }
  }
  // symmetric: what A says of B, B says of A (the longer of the two measures of their shared crack)
  const by = new Map<number, GpFrag>(); for (const f of out) by.set(f.fid, f);
  for (const f of out) for (const n of f.nb.slice()) {
    if (n.fid < 0) continue; const o = by.get(n.fid); if (!o) { f.nb.splice(f.nb.indexOf(n), 1); continue; }   // (a sliver too thin to be a piece — under 0.1 mm² — is nobody's neighbour)
    const back = o.nb.find(m => m.fid === f.fid && Math.abs(m.ny + n.ny) < 0.05);
    if (!back) o.nb.push({ fid: f.fid, len: n.len, ny: -n.ny, u0: n.u0, u1: n.u1 });
    else { const len = Math.max(back.len, n.len), u0 = Math.min(back.u0, n.u0), u1 = Math.max(back.u1, n.u1); back.len = n.len = len; back.u0 = n.u0 = u0; back.u1 = n.u1 = u1; }
  }
  return out;
}

// ---------------------------------------------------------------- the crack picture (the CPU reference of composite.wgsl gbCracks: the 2D plot draws with it)
export interface GpCrack { /** distance to the nearest crack line (m) */ d: number; /** 0‥1 how heavy that line is */ w: number; /** the piece under the point (fid / GP_REMAINDER / −1) */ fid: number }
const lineDist = (A: Pt, B: Pt, u: number, v: number) => { const ex = B[0] - A[0], ey = B[1] - A[1]; return Math.abs(ex * (v - A[1]) - ey * (u - A[0])) / Math.max(1e-6, Math.hypot(ex, ey)); };
/** nearest drawn crack at (u, v). Annealed (`web` false): the two radials of its sector — each as far as it has run before the pane runs, to the end after — the chords
 *  either side of its piece (chord 2 only in a share of the sectors until the pane runs), and once run the sector's branch crack, its half's snap and the territory line.
 *  Laminated (`web`): a tight web that never runs — the radials to their reach, all three chords, an outer ring at rho[3] in most sectors and a hashed sub-chord inside
 *  each band. */
export function gpCrackAt(sites: readonly GpSite[], run: boolean, web: boolean, u: number, v: number): GpCrack {
  const i = gpNearest(sites, u, v); if (i < 0) return { d: Infinity, w: 0, fid: -1 };
  const S = sites[i]; const { s, t } = gpSector(S, u, v); const { b } = gpSectorBand(S, u, v);
  const dx = u - S.u, dy = v - S.v; const full = run && !web;
  let d = Infinity, w = 0; const take = (dd: number, ww: number) => { if (ww > 0 && dd < d) { d = dd; w = ww; } };
  for (const k of [s, s + 1]) {   // the radials: perpendicular distance, while the crack has run this far (tapering over its last third)
    const a = gpAngle(S, k); const along = dx * Math.cos(a) + dy * Math.sin(a); const perp = Math.abs(dx * Math.sin(a) - dy * Math.cos(a));
    const reach = full ? Infinity : gpReach(S, k);
    if (along <= reach) take(perp, full ? 1 : Math.min(1, (reach - along) / (0.33 * reach) + 0.25));
    else take(Math.hypot(along - reach, perp), 0.25);
  }
  const P = [0, 1, 2, 3].map(cb => [gpChordPt(S, s, cb), gpChordPt(S, s + 1, cb)] as [Pt, Pt]);
  if (web) {
    let wb = 0; while (wb < 4 && beyond(P[wb][0], P[wb][1], u, v)) wb++;
    for (let cb = Math.max(0, wb - 1); cb <= Math.min(2, wb); cb++) take(lineDist(P[cb][0], P[cb][1], u, v), cb === 0 ? 1 : 0.8);
    if (wb >= 3 && gpJit(S.seed, s, 33) < GP_WEB_RING) take(lineDist(P[3][0], P[3][1], u, v), 0.6);
    if (wb >= 1 && wb <= 3 && gpJit(S.seed, s, 11 + wb) > 0.35) {   // a sub-chord inside the band
      const f0 = 0.3 + 0.4 * gpJit(S.seed, s, 15 + wb), f1 = 0.3 + 0.4 * gpJit(S.seed, wrap(s + 1, S.n), 15 + wb);
      const A: Pt = [P[wb - 1][0][0] + (P[wb][0][0] - P[wb - 1][0][0]) * f0, P[wb - 1][0][1] + (P[wb][0][1] - P[wb - 1][0][1]) * f0];
      const B: Pt = [P[wb - 1][1][0] + (P[wb][1][0] - P[wb - 1][1][0]) * f1, P[wb - 1][1][1] + (P[wb][1][1] - P[wb - 1][1][1]) * f1];
      take(lineDist(A, B, u, v), 0.55);
    }
  } else {
    const merged = gpMerged(S, s);
    const inner = b === 0 ? -1 : b >= 3 ? 2 : b === 2 ? 1 : 0, outer = b === 0 ? 0 : b === 1 ? (merged ? 2 : 1) : b === 2 ? 2 : -1;
    const drawn = (cb: number) => cb >= 0 && (cb < 2 || full || gpJit(S.seed, s, 31) < GP_C2_DRAWN);
    if (drawn(inner)) take(lineDist(P[inner][0], P[inner][1], u, v), inner === 0 ? 1 : 0.8);
    if (drawn(outer)) take(lineDist(P[outer][0], P[outer][1], u, v), outer === 0 ? 1 : 0.8);
  }
  if (full && b >= 3) {
    const as = S.rot + 2 * Math.PI * gpSplit(S, s) / S.n; take(Math.abs(dx * Math.sin(as) - dy * Math.cos(as)), 0.9);   // the branch crack
    const c = gpCut(S, s, t >= gpSplit(S, s) ? 1 : 0); if (c) take(Math.abs(c.nx * (u - c.px) + c.ny * (v - c.py)), 0.8);   // this half's snap
  }
  if (full && sites.length >= 2) {   // the territory line toward the next-nearest site
    let j2 = -1, d2 = Infinity; const d1 = dx * dx + dy * dy - S.rz * S.rz;
    for (let j = 0; j < sites.length; j++) { if (j === i) continue; const q = sites[j]; const dd = (q.u - u) ** 2 + (q.v - v) ** 2 - q.rz * q.rz; if (dd < d2) { d2 = dd; j2 = j; } }
    if (j2 >= 0) take((d2 - d1) / (2 * Math.max(1e-6, Math.hypot(sites[j2].u - S.u, sites[j2].v - S.v))), 0.8);
  }
  return { d, w, fid: b >= 3 && !run ? GP_REMAINDER : gpFid(i, s, b) };
}

// ---------------------------------------------------------------- tempered: the dice
/** how far a clump's centre strays from its lattice cell's centre (a fraction of the cell, each axis: ±0.3 keeps the nearest centre inside the 3 × 3 cells round a point),
 *  and how much a hashed delay shuffles the order clumps let go in (a fraction of a cell) */
export const GP_DICE_JIT = 0.6, GP_DICE_DELAY = 1.4;
export interface GpDice { /** the blow */ u: number; v: number; cols: number; rows: number; /** 24-bit */ seed: number; hu: number; hv: number }
/** the centre of clump (c, r): its lattice cell's centre, jittered */
export function gpDiceCentre(D: GpDice, c: number, r: number): Pt {
  const du = 2 * D.hu / D.cols, dv = 2 * D.hv / D.rows;
  return [-D.hu + (c + 0.5 + GP_DICE_JIT * (gpJit(D.seed, c, r) - 0.5)) * du, -D.hv + (r + 0.5 + GP_DICE_JIT * (gpJit(D.seed ^ 0x5bd1e9, c, r) - 0.5)) * dv];
}
/** the clump (u, v) belongs to (index r × cols + c): the nearest jittered centre among the 3 × 3 cells round its own */
export function gpDiceClump(D: GpDice, u: number, v: number): number {
  const c0 = Math.max(0, Math.min(D.cols - 1, Math.floor((u + D.hu) / (2 * D.hu) * D.cols))), r0 = Math.max(0, Math.min(D.rows - 1, Math.floor((v + D.hv) / (2 * D.hv) * D.rows)));
  let best = r0 * D.cols + c0, bd = Infinity;
  for (let r = Math.max(0, r0 - 1); r <= Math.min(D.rows - 1, r0 + 1); r++) for (let c = Math.max(0, c0 - 1); c <= Math.min(D.cols - 1, c0 + 1); c++) {
    const p = gpDiceCentre(D, c, r); const d = (p[0] - u) ** 2 + (p[1] - v) ** 2; if (d < bd) { bd = d; best = r * D.cols + c; }
  }
  return best;
}
/** the order key of clump (c, r): metres from the blow to its centre, shuffled by a hashed share of a cell — the wave front is ragged, not a circle */
export function gpDiceKey(D: GpDice, c: number, r: number): number {
  const p = gpDiceCentre(D, c, r); const cell = Math.min(2 * D.hu / D.cols, 2 * D.hv / D.rows);
  return Math.hypot(p[0] - D.u, p[1] - D.v) + GP_DICE_DELAY * cell * gpJit(D.seed ^ 0x3c6ef3, c, r);
}
/** clump (c, r)'s outline: the cell of its centre among its neighbours' (a convex polygon, anticlockwise, ≤ 12 points), clipped to the pane */
export function gpDicePoly(D: GpDice, c: number, r: number): Pt[] {
  const du = 2 * D.hu / D.cols, dv = 2 * D.hv / D.rows; const a = gpDiceCentre(D, c, r);
  const u0 = Math.max(-D.hu, -D.hu + (c - 1) * du), u1 = Math.min(D.hu, -D.hu + (c + 2) * du), v0 = Math.max(-D.hv, -D.hv + (r - 1) * dv), v1 = Math.min(D.hv, -D.hv + (r + 2) * dv);
  let P: Poly = { pts: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], tags: [0, 0, 0, 0] };
  for (let rr = Math.max(0, r - 2); rr <= Math.min(D.rows - 1, r + 2); rr++) for (let cc = Math.max(0, c - 2); cc <= Math.min(D.cols - 1, c + 2); cc++) {
    if (cc === c && rr === r) continue; const b = gpDiceCentre(D, cc, rr);
    P = clip(P.pts, P.tags, b[0] - a[0], b[1] - a[1], (b[0] * b[0] + b[1] * b[1] - a[0] * a[0] - a[1] * a[1]) / 2);
  }
  return P.pts.filter((p, k, arr) => { const q = arr[(k + 1) % arr.length]; return Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9; });
}
/** the DICE as drawn: distance to the nearest edge of a jittered cellular pattern of cell size `grain` (F2 − F1 of a 3 × 3 Worley; composite.wgsl gbDice) */
export function gpDiceEdge(u: number, v: number, grain: number, seed: number): number {
  const x = u / grain, y = v / grain; const ix = Math.floor(x), iy = Math.floor(y);
  let f1 = Infinity, f2 = Infinity;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const cx = ix + i, cy = iy + j; const px = cx + 0.15 + 0.7 * gpJit(seed, cx & 0xffff, cy & 0xffff), py = cy + 0.15 + 0.7 * gpJit(seed ^ 0x5bd1e9, cx & 0xffff, cy & 0xffff);
    const d = Math.hypot(px - x, py - y); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d;
  }
  return (f2 - f1) * 0.5 * grain;
}

/** convex hull (Andrew's chain), anticlockwise — the crater's outline for the release hook */
export function gpHull(pts: Pt[]): Pt[] {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (P.length < 3) return P;
  const cr = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Pt[] = []; for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up: Pt[] = []; for (let k = P.length - 1; k >= 0; k--) { const p = P[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}
export function gpClipRect(pts: Pt[], hu: number, hv: number): Pt[] {
  let P: Poly = { pts, tags: pts.map(() => 0 as Tag) };
  P = clip(P.pts, P.tags, 0, -1, hv); P = clip(P.pts, P.tags, 1, 0, hu); P = clip(P.pts, P.tags, 0, 1, hv); P = clip(P.pts, P.tags, -1, 0, hu);
  return P.pts;
}
export function gpPolyArea(pts: Pt[]): { area: number; cen: Pt } {
  let area = 0, cx = 0, cy = 0;
  for (let k = 0; k < pts.length; k++) { const p = pts[k], q = pts[(k + 1) % pts.length]; const cr = p[0] * q[1] - q[0] * p[1]; area += cr; cx += (p[0] + q[0]) * cr; cy += (p[1] + q[1]) * cr; }
  area /= 2; return { area: Math.abs(area), cen: Math.abs(area) > 1e-12 ? [cx / (6 * area), cy / (6 * area)] : (pts[0] ?? [0, 0]) };
}
