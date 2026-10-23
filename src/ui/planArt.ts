// THE MAP SHEET'S PICTURE (ui/missions.ts drawPlan, the `map` path): the place as a MODEL on a dark table, made from the level file's own boxes — nothing
// authored for it, no asset. The game's own view: from the south, straight on (no yaw: the plan stays a plan, and back to front is a sort by z), a box's top
// shifted up the page by its height. Walls are CUT at ART.cut so every room is open, nothing that hangs above the cut is drawn (lintels, ceilings, lamp
// heads), the ground's slabs are flat fills, furniture is low masses, glass is a pale sliver, a door is a short bright leaf in its gap. One narrow ramp of warm
// greys up to the page's sand, each box nudged a little toward its own paint, so mud and steel differ and it is still one drawing. The page's accent is
// never used here: the caller lays the way in over it (`artGround` projects a point of the floor).
// Reads a parsed level file and a 2D context; writes nothing but pixels.

/** what the picture takes from a level file (scene/levelData.ts LevelData, the keys read here) */
export interface ArtData {
  meta?: { bounds?: { min?: number[]; max?: number[] } };
  materials?: Record<string, { albedo?: number[] }>;
  boxes?: { group?: string; c: number[]; h: number[]; yaw?: number; flags?: string[]; material?: string; albedo?: number[]; emissive?: unknown }[];
  doors?: { hinge: number[]; closedDir: number; width: number }[];
  lights?: { kind?: string; pos?: number[]; dir?: number[]; range?: number; group?: string; enabled?: boolean }[];
}
/** the numbers picked by eye (the menu's picture only: nothing of the game reads them) */
export const ART = {
  /** the camera's pitch off the ground, degrees: depth is drawn × sin, height × cos */ tiltDeg: 58,
  /** walls are cut here, m */ cut: 1.5,
  /** nothing that starts at or above this is drawn, m */ above: 1.9,
  /** a shadow's reach on the ground per metre of height, [east, south] (the one soft light is over the viewer's left shoulder: tops lit, south faces in their own shade) */ shadow: [0.3, -0.42],
  /** how far a box's own paint moves its grey's hue (0 = one grey) / its lightness */ tint: 0.14, lift: 0.3,
};
type RGB = [number, number, number];
interface Flat { x: number; z: number; hx: number; hz: number; yaw: number; y: number; area: number; fill: string }
interface Solid { x: number; z: number; hx: number; hz: number; yaw: number; y0: number; y1: number; top: string; face: string; side: string; shade: boolean;
  /** its box on the plan and in height, for the paint order */ x0: number; x1: number; z0: number; z1: number }
export interface PlanArt { flats: Flat[]; solids: Solid[]; /** pools of the place's own lamps on the ground: x, z, radius */ lamps: number[][]; /** the level's lot, x0 z0 x1 z1 */ lot: number[] }

const lum = (a: number[]) => 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
const WARM: RGB = [1.07, 0.995, 0.86];   // the ramp's own hue (the page's sand), luminance 1
/** one step of the ramp: lightness v (0‥1), nudged by the box's own paint */
function ink(alb: number[] | undefined, v: number, tint = ART.tint, lift = ART.lift): RGB {
  const a = alb && alb.length >= 3 ? alb : [0.3, 0.3, 0.3], L = Math.max(lum(a), 0.004), s = Math.sqrt(Math.min(1, L));
  const k = v * (1 + lift * (s - 0.45)), n = a.map(c => Math.min(1.8, c / L));
  return [0, 1, 2].map(i => Math.max(0, Math.min(255, Math.round(255 * k * (WARM[i] + (n[i] - WARM[i]) * tint)))) ) as RGB;
}
const css = (c: RGB, a = 1) => (a >= 1 ? `rgb(${c[0]},${c[1]},${c[2]})` : `rgba(${c[0]},${c[1]},${c[2]},${a})`);

const SKIP = /^(ceiling|beacons|exterior\.lamps)/, GROUND = /^(ground|floors)/;
export function artFrom(d: ArtData): PlanArt {
  const A: PlanArt = { flats: [], solids: [], lamps: [], lot: [0, 0, 40, 28] };
  { const b = d.meta?.bounds; if (b?.min && b.max && b.max[0] > b.min[0] && b.max[2] > b.min[2]) A.lot = [b.min[0], b.min[2], b.max[0], b.max[2]]; }
  const solid = (x: number, z: number, hx: number, hz: number, yaw: number, y0: number, y1: number, top: string, face: string, side: string, shade: boolean) => {
    const cs = Math.abs(Math.cos(yaw)), sn = Math.abs(Math.sin(yaw)), ex = cs * hx + sn * hz, ez = sn * hx + cs * hz;
    A.solids.push({ x, z, hx, hz, yaw, y0, y1, top, face, side, shade, x0: x - ex, x1: x + ex, z0: z - ez, z1: z + ez });
  };
  for (const b of d.boxes ?? []) {
    const grp = b.group ?? '', F = b.flags ?? [];
    if (F.includes('NoPrimary') || SKIP.test(grp) || !(b.c?.length >= 3 && b.h?.length >= 3)) continue;
    const alb = b.albedo ?? (b.material ? d.materials?.[b.material]?.albedo : undefined), yaw = b.yaw ?? 0, [hx, , hz] = b.h, top = b.c[1] + b.h[1], bot = b.c[1] - b.h[1], thin = Math.min(hx, hz), long = Math.max(hx, hz);
    if (GROUND.test(grp) || top <= 0.07) {   // the ground: the lot's slabs and each room's floor, and what lies flat on them (a rug, a painted bay) if it is big enough to be a place
      const area = 4 * hx * hz, base = GROUND.test(grp); if (!base && area < 1.2) continue;
      A.flats.push({ x: b.c[0], z: b.c[2], hx, hz, yaw, y: top, area, fill: css(ink(alb, grp.startsWith('ground') ? 0.098 : 0.148, 0.25, 0.6)) }); continue;
    }
    if (bot >= Math.min(ART.cut, ART.above) - 0.05) continue;   // (hangs over the cut: a lintel, the wall over a door, a lamp's head)
    if (F.includes('Glass')) { const y1 = Math.min(top, ART.cut); solid(b.c[0], b.c[2], hx, hz, yaw, bot, y1, 'rgba(168,206,222,0.92)', 'rgba(136,178,198,0.16)', 'rgba(136,178,198,0.16)', false); continue; }
    if (top >= 1.9 && bot < 1) {   // what stands to the ceiling, cut: thin = a wall (its cut is the drawing's line, the page's sand), thick = a mass (a pillar, a stack, a hut)
      const wall = thin <= 0.2;
      if (wall) solid(b.c[0], b.c[2], hx, hz, yaw, bot, ART.cut, css(ink(alb, 0.74, 0.1, 0.12)), css(ink(alb, 0.3)), css(ink(alb, 0.36)), true);
      else solid(b.c[0], b.c[2], hx, hz, yaw, bot, ART.cut, css(ink(alb, 0.42)), css(ink(alb, 0.215)), css(ink(alb, 0.26)), true);
      continue;
    }
    if (thin < 0.035 && bot > 0.25) continue;   // (a flat thing hung on a wall: a notice, a switch plate)
    if (long < 0.075) continue;   // (a mug, a table's leg: under a pixel)
    const y1 = Math.min(top, ART.cut), h = Math.max(0, Math.min(1, y1 / ART.cut));
    if (thin <= 0.2 && long >= 0.45 && bot < 0.1 && top >= 0.6) solid(b.c[0], b.c[2], hx, hz, yaw, bot, y1, css(ink(alb, 0.5, 0.12, 0.15)), css(ink(alb, 0.26)), css(ink(alb, 0.31)), true);   // a low wall: a sill under a window, a partition, a parapet
    else solid(b.c[0], b.c[2], hx, hz, yaw, bot, y1, css(ink(alb, 0.25 + 0.1 * h)), css(ink(alb, 0.165)), css(ink(alb, 0.2)), bot < 0.3 && y1 - bot > 0.25);   // furniture and cover: low masses, the higher the lighter
  }
  for (const o of d.doors ?? []) {   // a door: its leaf shut in its gap, lower than the cut so the gap still reads, the brightest line of the drawing
    if (!(o.hinge?.length >= 2 && o.width > 0)) continue;
    const cx = o.hinge[0] + Math.cos(o.closedDir) * o.width / 2, cz = o.hinge[1] + Math.sin(o.closedDir) * o.width / 2;
    solid(cx, cz, o.width / 2, 0.035, -o.closedDir, 0, ART.cut * 0.6, 'rgb(240,233,217)', 'rgb(62,57,48)', 'rgb(74,68,57)', false);
  }
  for (const l of d.lights ?? []) {   // the place's own lamps, as soft pools where their light lands
    if (l.enabled === false || !l.pos || l.pos.length < 3 || (l.kind !== 'spot' && l.kind !== 'point')) continue;
    const [x, y, z] = l.pos, dy = l.dir && l.dir[1] < -0.2 ? l.dir[1] : 0, t = dy ? y / -dy : 0, high = y > 3;
    A.lamps.push([x + (dy ? l.dir![0] * t : 0), z + (dy ? l.dir![2] * t : 0), high ? 5.5 : Math.max(1.6, Math.min(3.2, (l.range ?? 5) * 0.5))]);
  }
  A.flats.sort((a, b) => a.y - b.y || b.area - a.area);
  A.solids = inOrder(A.solids);
  return A;
}

/** back to front for a view from the south and above: of two boxes that share a stretch of x, the one wholly south of the other is painted after it; where
 *  their depths overlap, the one wholly above. (Neither = they cut each other: the order they come in.) A sort by one key cannot hold both, so: who must
 *  come before whom, then each after all it waits for. */
function inOrder(S: Solid[]): Solid[] {
  const e = 0.012, n = S.length, by = S.map((_, i) => i).sort((a, b) => S[a].z1 - S[b].z1 || S[a].y1 - S[b].y1), first: number[][] = S.map(() => []);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = S[i], b = S[j]; if (a.x0 >= b.x1 - e || b.x0 >= a.x1 - e) continue;
    if (a.z0 >= b.z1 - e) first[i].push(j); else if (b.z0 >= a.z1 - e) first[j].push(i);
    else if (a.y0 >= b.y1 - e) first[i].push(j); else if (b.y0 >= a.y1 - e) first[j].push(i);
  }
  const out: Solid[] = [], state = new Uint8Array(n);   // 1 = waiting on its own list (met again = a ring: let it be), 2 = out
  for (const r of by) {
    if (state[r]) continue;
    const stack = [r], at = [0]; state[r] = 1;
    while (stack.length) {
      const i = stack[stack.length - 1], L = first[i]; let k = at[at.length - 1];
      while (k < L.length && state[L[k]]) k++;
      if (k < L.length) { at[at.length - 1] = k + 1; state[L[k]] = 1; stack.push(L[k]); at.push(0); } else { state[i] = 2; out.push(S[i]); stack.pop(); at.pop(); }
    }
  }
  return out;
}

/** how a view is fitted to a canvas: `x(wx)`, `y(wz, height)`, the scale in px per metre along x, and the stretch of floor it shows */
export interface ArtView { k: number; x(wx: number): number; y(wz: number, wy?: number): number; rect: number[] }
/** fit the stretch of floor [x0, z0, x1, z1] (clamped to the lot) into a W × H canvas, leaving `foot` px clear at the bottom */
export function artView(A: PlanArt, W: number, H: number, want: number[], foot = 0): ArtView {
  const t = ART.tiltDeg * Math.PI / 180, CZ = Math.sin(t), CY = Math.cos(t);
  const r = [Math.max(A.lot[0], want[0]), Math.max(A.lot[1], want[1]), Math.min(A.lot[2], want[2]), Math.min(A.lot[3], want[3])];
  if (!(r[2] > r[0] && r[3] > r[1])) { r[0] = A.lot[0]; r[1] = A.lot[1]; r[2] = A.lot[2]; r[3] = A.lot[3]; }
  const w = r[2] - r[0], d = (r[3] - r[1]) * CZ + ART.cut * CY + SLAB * CY, k = Math.min(W / w, (H - foot) / d);
  const ox = (W - w * k) / 2 - r[0] * k, oy = (H - foot - d * k) / 2 + ART.cut * CY * k - r[1] * CZ * k;
  return { k, rect: r, x: wx => ox + wx * k, y: (wz, wy = 0) => oy + (wz * CZ - wy * CY) * k };
}
const SLAB = 0.5;   // the model's base: the cut piece of ground has this much thickness, m

/** the picture. `g` is cleared by the caller. */
export function drawArt(g: CanvasRenderingContext2D, A: PlanArt, V: ArtView) {
  const { k, rect: R } = V, X = V.x, Y = V.y, px = Math.max(1, k / 33);
  const inside = (x: number, z: number) => x >= R[0] && x <= R[2] && z >= R[1] && z <= R[3];
  /** a box is drawn where any of it stands on the stretch shown (a long wall whose middle is off it still shows its end) */
  const on = (s: Solid) => s.x1 >= R[0] && s.x0 <= R[2] && s.z1 >= R[1] && s.z0 <= R[3];
  /** a box's footprint corners on the plan (a box's yaw turns world → local by +yaw about Y — scene/collision.ts — so local → world is a turn by −yaw) */
  const foot = (x: number, z: number, hx: number, hz: number, yaw: number, out: number[]) => {
    const c = yaw ? Math.cos(yaw) : 1, s = yaw ? Math.sin(yaw) : 0;
    out[0] = x - hx * c - hz * s; out[1] = z + hx * s - hz * c; out[2] = x + hx * c - hz * s; out[3] = z - hx * s - hz * c;
    out[4] = x + hx * c + hz * s; out[5] = z - hx * s + hz * c; out[6] = x - hx * c + hz * s; out[7] = z + hx * s + hz * c;   // (NW, NE, SE, SW when unturned)
  };
  const q = new Array<number>(8).fill(0);
  const quad = (wy: number) => { g.beginPath(); g.moveTo(X(q[0]), Y(q[1], wy)); for (let i = 2; i < 8; i += 2) g.lineTo(X(q[i]), Y(q[i + 1], wy)); g.closePath(); };
  // THE BASE: the cut piece of ground — its slabs clipped to the stretch shown, its south edge a face like any other
  g.save(); g.beginPath(); g.rect(X(R[0]), Y(R[1]), (R[2] - R[0]) * k, Y(R[3]) - Y(R[1])); g.clip();
  g.fillStyle = 'rgb(27,25,21)'; g.fillRect(X(R[0]), Y(R[1]), (R[2] - R[0]) * k, Y(R[3]) - Y(R[1]));
  for (const f of A.flats) { foot(f.x, f.z, f.hx, f.hz, f.yaw, q); quad(0); g.fillStyle = f.fill; g.fill(); }
  // the one soft light over the table: the middle of the ground a little lifted, its edges let go into the dark
  if (typeof g.createRadialGradient === 'function') { const cx = X((R[0] + R[2]) / 2), cy = (Y(R[1]) + Y(R[3])) / 2, rr = (R[2] - R[0]) * k * 0.62;
    g.save(); g.translate(cx, cy); g.scale(1, Math.max(0.3, (Y(R[3]) - Y(R[1])) / ((R[2] - R[0]) * k)));
    const G = g.createRadialGradient(0, 0, 0, 0, 0, rr); G.addColorStop(0, 'rgba(255,240,212,0.045)'); G.addColorStop(0.5, 'rgba(255,240,212,0.012)'); G.addColorStop(0.72, 'rgba(8,7,5,0.1)'); G.addColorStop(1, 'rgba(8,7,5,0.42)');
    g.fillStyle = G; g.fillRect(-rr * 2, -rr * 2, rr * 4, rr * 4); g.restore(); }
  // the lamps' pools: where the place is lit at night
  if (typeof g.createRadialGradient === 'function') for (const [x, z, r] of A.lamps) {
    if (!inside(x, z)) continue;
    g.save(); g.translate(X(x), Y(z)); g.scale(1, (Y(1) - Y(0)) / k);
    const G = g.createRadialGradient(0, 0, 0, 0, 0, r * k); G.addColorStop(0, 'rgba(255,236,196,0.17)'); G.addColorStop(0.45, 'rgba(255,236,196,0.075)'); G.addColorStop(1, 'rgba(255,236,196,0)');
    g.fillStyle = G; g.beginPath(); g.arc(0, 0, r * k, 0, Math.PI * 2); g.fill(); g.restore();
  }
  // shadows: every standing thing's, as ONE shape filled once (so two that cross are no darker than one)
  { const [sx, sz] = ART.shadow; g.beginPath();
    for (const s of A.solids) {
      if (!s.shade || !on(s)) continue;
      foot(s.x, s.z, s.hx, s.hz, s.yaw, q); const dx = sx * s.y1, dz = sz * s.y1, P: number[][] = [];
      for (let i = 0; i < 8; i += 2) { P.push([q[i], q[i + 1]], [q[i] + dx, q[i + 1] + dz]); }
      const hull = hullOf(P); g.moveTo(X(hull[0][0]), Y(hull[0][1])); for (let i = 1; i < hull.length; i++) g.lineTo(X(hull[i][0]), Y(hull[i][1])); g.closePath();
    }
    g.fillStyle = 'rgba(6,5,4,0.42)'; g.fill(); }
  g.restore();
  g.fillStyle = 'rgb(17,15,13)'; g.fillRect(X(R[0]), Y(R[3]), (R[2] - R[0]) * k, Y(R[3], -SLAB) - Y(R[3]));
  // WHAT STANDS, back to front: each box its faces that look south, then its top
  g.lineJoin = 'round'; g.lineWidth = px * 0.7;
  for (const s of A.solids) {
    if (!on(s)) continue;
    foot(s.x, s.z, s.hx, s.hz, s.yaw, q);
    if (s.y1 > s.y0) for (let i = 0; i < 4; i++) {   // (corners run clockwise on the page: the face i → i+1 looks south where its run goes west)
      const a = i * 2, b = ((i + 1) % 4) * 2, run = q[a] - q[b]; if (run <= 1e-4) continue;
      const len = Math.hypot(q[b] - q[a], q[b + 1] - q[a + 1]), south = run / len;
      g.beginPath(); g.moveTo(X(q[a]), Y(q[a + 1], s.y1)); g.lineTo(X(q[b]), Y(q[b + 1], s.y1)); g.lineTo(X(q[b]), Y(q[b + 1], s.y0)); g.lineTo(X(q[a]), Y(q[a + 1], s.y0)); g.closePath();
      g.fillStyle = g.strokeStyle = south > 0.75 ? s.face : s.side; g.fill(); g.stroke();
    }
    quad(s.y1); g.fillStyle = g.strokeStyle = s.top; g.fill(); g.stroke();
  }
}
/** the convex hull of a few points on the plan, always wound the same way (so many of them fill as one shape) */
function hullOf(P: number[][]): number[][] {
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo: number[][] = [], up: number[][] = [];
  for (const p of P) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  lo.pop(); up.pop(); return lo.concat(up);
}

/** the sheet's own view of the place on a canvas W by H (drawSheet below draws through it; a caller that pins a word on a drawn sheet asks for the same one) */
export function sheetView(A: PlanArt, W: number, H: number, ext: number[], all: number[][], small = false): ArtView {
  const pad = small ? 1.6 : 2.2, r = small ? 2.6 : 1.4, want = [ext[0] - pad, ext[1] - pad, ext[2] + pad, ext[3] + pad];
  for (const [x, z] of all) { want[0] = Math.min(want[0], x - r); want[1] = Math.min(want[1], z - r); want[2] = Math.max(want[2], x + r); want[3] = Math.max(want[3], z + r); }
  return artView(A, W, H, want, small ? 0 : 11 * (W / 480));
}
/** THE SHEET: the model fitted to the canvas round what stands (`ext` = the walls' own extent on the plan, min then max) and every place a team may start
 *  from, a 10 m scale at its foot (true along x), and the way in — the page's accent, its only use on the sheet: a dot where the team stands, `dealt` = a ring
 *  at each. `u` = the canvas's px per px of a 480 px sheet. */
export function drawSheet(g: CanvasRenderingContext2D, W: number, H: number, A: PlanArt, ext: number[], all: number[][], pts: number[][], dealt: boolean, small = false) {
  const V = sheetView(A, W, H, ext, all, small);
  if (small) { drawArt(g, A, V); startMarks(g, V, pts, dealt, W / 210); return; }   // a card's picture: the model alone, no scale, the way in drawn for a picture a third the size
  const u = W / 480, k = V.k, line = Math.max(1, Math.round(u * 0.5));
  drawArt(g, A, V);
  const len = 10 * k, x1 = W - 2 * u, y = H - 3 * u, tick = 3 * u;
  g.fillStyle = 'rgba(214,200,170,0.6)'; g.fillRect(x1 - len, y, len, line * 2); g.fillRect(x1 - len, y - tick, line * 2, tick); g.fillRect(x1 - line * 2, y - tick, line * 2, tick);
  g.font = `${Math.round(9 * u)}px ui-monospace, SFMono-Regular, Menlo, monospace`; g.textAlign = 'right'; g.textBaseline = 'alphabetic'; g.fillStyle = 'rgba(214,200,170,0.8)'; g.fillText('10 M', x1 - len - 4 * u, y + line * 2);
  startMarks(g, V, pts, dealt, u);
}
function startMarks(g: CanvasRenderingContext2D, V: ArtView, pts: number[][], dealt: boolean, u: number) {
  const r = 5.5 * u;
  for (const [x, z] of pts) { const px = V.x(x), pz = V.y(z); g.beginPath(); g.arc(px, pz, r + 2.2 * u, 0, Math.PI * 2); g.fillStyle = '#0c0b09'; g.fill();
    g.beginPath(); g.arc(px, pz, dealt ? r - 1.1 * u : r, 0, Math.PI * 2); if (dealt) { g.strokeStyle = '#f0912e'; g.lineWidth = 2.2 * u; g.stroke(); } else { g.fillStyle = '#f0912e'; g.fill(); } }
}
