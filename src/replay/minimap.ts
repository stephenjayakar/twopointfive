// THE ENGINE REPLAY'S MAP (engineplay.ts): the floor as the replay file drew it (format.ts ReplayMap) with the men and doors of the game THAT IS PLAYING laid on it —
// the corner minimap and the large map it opens into are this one drawing at two sizes. Pure 2D: it is handed plain numbers and a canvas, reads nothing of the game
// and writes nothing anywhere. Colours and the plan's sense (X = x, Y = z) are the 2D viewer's (viewer.ts drawMap), so the two maps read as one.
import type { ReplayMap } from './format';

export interface MapMan { x: number; z: number; /** radians, 0 = +z */ aim: number; team: string; kind: 'player' | 'man' | 'civ'; down: boolean; name: string; ring: string | null }
export interface MapDoor { hx: number; hz: number; /** the plan direction its leaf points from the hinge, as it stands (unit) */ ux: number; uz: number; width: number; locked: boolean; broken: boolean; off: boolean }
export interface MapShot { x: number; z: number; to: [number, number] | null; kind: string; /** 0 = this instant → 1 = about to fade out */ age: number }
export interface MapNote { x: number; z: number; i: number }
export interface MapScene {
  men: MapMan[]; doors: MapDoor[]; shots: MapShot[]; notes: MapNote[];
  /** the picture's camera: the floor point it looks at and the plan direction it looks along (unit) */
  cam: { x: number; z: number; fx: number; fz: number };
}
export interface MapFit { s: number; ox: number; oy: number }

const TEAM: Record<string, string> = { player: '#f4fff8', operative: '#7ab8ff', guard: '#ff7a6a', hostile: '#ff7a6a', civilian: '#9be08a' };
export const mapColour = (m: { kind: string; team: string }): string => m.kind === 'player' ? TEAM.player : TEAM[m.team] ?? '#d8c08a';
export const MAP_RING: Record<string, string> = { alert: '#ff4a3a', search: '#ff9c3a', suspicious: '#f2cf6b' };
const ACCENT = '#e8833a';

/** the CSS size a map of these bounds takes inside a box of maxW × maxH (the plan's own shape, a margin round it) */
export function mapSize(b: number[], maxW: number, maxH: number, pad: number): [number, number] {
  const w = Math.max(1, b[2] - b[0]), h = Math.max(1, b[3] - b[1]), s = Math.min((maxW - 2 * pad) / w, (maxH - 2 * pad) / h);
  return [Math.max(24, Math.round(w * s + 2 * pad)), Math.max(24, Math.round(h * s + 2 * pad))];
}
export function mapFit(b: number[], W: number, H: number, pad: number): MapFit {
  const w = Math.max(1, b[2] - b[0]), h = Math.max(1, b[3] - b[1]), s = Math.min((W - 2 * pad) / w, (H - 2 * pad) / h);
  return { s, ox: W / 2 - (b[0] + b[2]) / 2 * s, oy: H / 2 - (b[1] + b[3]) / 2 * s };
}
/** a CSS point of the map → the floor point under it */
export const mapToWorld = (f: MapFit, X: number, Y: number): [number, number] => [(X - f.ox) / f.s, (Y - f.oy) / f.s];

/** the floor alone (walls, low things, glass): drawn once a size into a canvas of its own and blitted every frame */
export function drawFloor(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, map: ReplayMap, f: MapFit): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.setTransform(dpr * f.s, 0, 0, dpr * f.s, dpr * f.ox, dpr * f.oy);
  const B = map.boxes, px = 1 / f.s;
  for (const pass of [1, 0, 2]) for (let i = 0; i + 5 < B.length; i += 6) {
    if (B[i + 5] !== pass) continue;
    // never thinner than a pixel and a half: a 0.24 m wall on a 5 px/m minimap would be a hair
    const hw = Math.max(B[i + 2], pass === 1 ? 0 : 0.75 * px), hd = Math.max(B[i + 3], pass === 1 ? 0 : 0.75 * px);
    ctx.save(); ctx.translate(B[i], B[i + 1]); if (B[i + 4]) ctx.rotate(-B[i + 4] * Math.PI / 180);
    if (pass === 2) { ctx.strokeStyle = 'rgba(140,200,255,0.75)'; ctx.lineWidth = 1.2 * px; ctx.strokeRect(-B[i + 2], -B[i + 3], B[i + 2] * 2, B[i + 3] * 2); }
    else { ctx.fillStyle = pass === 0 ? '#66797d' : '#1c292c'; ctx.fillRect(-hw, -hd, hw * 2, hd * 2); }
    ctx.restore();
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/** everything that moves, over the floor. `big` = the large map: names under the men, thicker marks. */
export function drawScene(ctx: CanvasRenderingContext2D, dpr: number, S: MapScene, f: MapFit, big: boolean): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const X = (x: number) => f.ox + x * f.s, Y = (z: number) => f.oy + z * f.s, k = big ? 1.6 : 1;
  // doors: the leaf from its hinge
  ctx.lineCap = 'round';
  for (const d of S.doors) {
    if (d.off) continue;
    ctx.strokeStyle = d.broken ? '#ff7a6a' : d.locked ? '#f2cf6b' : '#c9a36a'; ctx.lineWidth = Math.max(1.5, 0.07 * f.s);
    ctx.beginPath(); ctx.moveTo(X(d.hx), Y(d.hz)); ctx.lineTo(X(d.hx + d.ux * d.width), Y(d.hz + d.uz * d.width)); ctx.stroke();
  }
  // the picture's camera: where it looks, and a wedge the way it looks
  {
    const c = S.cam, cx = X(c.x), cy = Y(c.z), a = Math.atan2(c.fz, c.fx), L = Math.max(big ? 46 : 26, 5 * f.s), half = 0.42;
    ctx.fillStyle = 'rgba(232,131,58,0.16)'; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, L, a - half, a + half); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ACCENT; ctx.lineWidth = 1.2 * k; ctx.beginPath(); ctx.arc(cx, cy, 3.2 * k, 0, 6.2832); ctx.stroke();
  }
  // rounds and blasts of the last moments
  for (const e of S.shots) {
    const al = Math.max(0, 1 - e.age);
    if (e.kind === 'bang' || e.kind === 'frag') { ctx.strokeStyle = `rgba(255,156,58,${al})`; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.arc(X(e.x), Y(e.z), (4 + 10 * e.age) * k, 0, 6.2832); ctx.stroke(); }
    else if (e.to) { ctx.strokeStyle = e.kind === 'guardShot' ? `rgba(255,122,106,${al})` : `rgba(255,236,160,${al})`; ctx.lineWidth = 1.1 * k; ctx.beginPath(); ctx.moveTo(X(e.x), Y(e.z)); ctx.lineTo(X(e.to[0]), Y(e.to[1])); ctx.stroke(); }
  }
  // notes with a spot
  for (const n of S.notes) {
    const x = X(n.x), y = Y(n.z), r = 4 * k;
    ctx.fillStyle = '#f2cf6b'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - r, y - 2.2 * r); ctx.lineTo(x + r, y - 2.2 * r); ctx.closePath(); ctx.fill();
    if (big) { ctx.fillStyle = '#16181b'; ctx.font = '700 9px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(n.i), x, y - 1.55 * r); }
  }
  // the men: down first so the living are on top; the player last
  const order = [...S.men].sort((a, b) => (a.down ? 0 : a.kind === 'player' ? 2 : 1) - (b.down ? 0 : b.kind === 'player' ? 2 : 1));
  for (const m of order) {
    const x = X(m.x), y = Y(m.z), r = Math.max(big ? 4.5 : 2.6, 0.28 * f.s) * (m.kind === 'player' ? 1.15 : 1);
    if (m.down) { ctx.strokeStyle = '#6b7678'; ctx.lineWidth = 1.3 * k; ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); continue; }
    const col = mapColour(m);
    ctx.strokeStyle = col; ctx.lineWidth = 1.3 * k; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(m.aim) * r * 2.3, y + Math.cos(m.aim) * r * 2.3); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    if (m.ring) { ctx.strokeStyle = m.ring; ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.arc(x, y, r + 2.2 * k, 0, 6.2832); ctx.stroke(); }
    if (m.kind === 'player') { ctx.strokeStyle = '#16181b'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.stroke(); }
  }
  if (big) {
    ctx.font = '11px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const m of order) {
      if (m.down || !m.name) continue; const x = X(m.x), y = Y(m.z) + Math.max(4.5, 0.28 * f.s) + 3;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,11,13,0.85)'; ctx.strokeText(m.name, x, y); ctx.fillStyle = mapColour(m); ctx.fillText(m.name, x, y);
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------------- the timeline's marks
export interface LineMark { /** 0‥1 along the timeline */ at: number; kind: 'shot' | 'guardShot' | 'blast' | 'other' | 'order' | 'mark' | 'error' }
/** the strip under the playhead: what happened when, one stroke each (the 2D viewer's colours) */
export function drawLine(ctx: CanvasRenderingContext2D, W: number, H: number, dpr: number, marks: LineMark[], kept?: [number, number] | null): void {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  if (kept !== undefined) {
    // `kept` = the stretch (0‥1) the marks can speak for: solid there, hatched where nothing was kept (null = nowhere)
    const a = kept ? Math.round(Math.min(kept[0], kept[1]) * W) : 0, b = kept ? Math.round(Math.max(kept[0], kept[1]) * W) : 0;
    ctx.fillStyle = 'rgba(233,226,214,.1)'; ctx.fillRect(a, 0, b - a, H);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, a, H); ctx.rect(b, 0, W - b, H); ctx.clip();
    ctx.strokeStyle = 'rgba(233,226,214,.13)'; ctx.lineWidth = 1; ctx.beginPath(); for (let x = -H; x < W; x += 7) { ctx.moveTo(x, H); ctx.lineTo(x + H, 0); } ctx.stroke(); ctx.restore();
  }
  for (const m of marks) {
    const x = Math.round(m.at * (W - 1)) + 0.5;
    if (m.kind === 'order') { ctx.fillStyle = '#f2cf6b'; ctx.fillRect(x - 1, 2, 2, 3); continue; }
    const tall = m.kind === 'blast' || m.kind === 'mark' || m.kind === 'error';
    ctx.strokeStyle = m.kind === 'error' ? '#ff6b6b' : m.kind === 'mark' ? '#ffffff' : m.kind === 'blast' ? '#ff9c3a' : m.kind === 'guardShot' ? '#ff7a6a' : m.kind === 'shot' ? '#ffeca0' : '#3f6a8f';
    ctx.globalAlpha = tall ? 0.95 : 0.7; ctx.lineWidth = tall ? 1.5 : 1;
    ctx.beginPath(); ctx.moveTo(x, tall ? 3 : H * 0.42); ctx.lineTo(x, H - 3); ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
