// The orders ring at the cursor (game/cmdring.ts says WHEN, orders.ts `ringView` says WHAT; this file draws it): a wedge a digit, clockwise from the top,
// the lit one filled, a greyed one for a row that cannot be given now, its words outside it, the middle left open so what is pointed at shows through.
// Under it, small, who the order goes to and what the ring was opened on. Sam's own ring (Space, CMDRING.hands — interact.ts `handRingView`) is the same
// drawing in his own colour, the thing's name under it.
// Before the key, with CMDRING.hint, a small glyph beside the cursor and an outline on the floor say what the ring would open on (orders.ts `hintView`).
// Plan mode (game/planmode.ts `planView`): a frame round the view while it is up, a circle at each man's feet (bright: picked), the box being dragged, and
// each chain as a line from its men through its stops with the word's key drawn where it is still to be pressed.
// index.html `.cmdring …`, `.cmdhint …` and `.planmode …` are the look. Nothing is built until there is something to show; an attribute is written only when it changes.
// The layer is zoomed with the page's words (ui/textsize.ts): a place in the view's px is divided by that factor, and the ring is drawn at the game's own
// (cmdring.ts ringZoom), so the wedge under the cursor is the wedge the game lights.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { CMDRING, ringPin, type RingHint, type RingView } from '../game/cmdring';
import { handRingView } from '../game/interact';
import { planView } from '../game/planmode';
import { hoverKept } from './hoverkept';

const NS = 'http://www.w3.org/2000/svg';
/** a line from one point of the layer to another with a head on its far end (too short to read: nothing) */
function arrow(x0: number, y0: number, x1: number, y1: number, cls: string): string {
  const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy); if (l < 6) return '';
  const ux = dx / l, uy = dy / l, h = 7, f = (n: number) => n.toFixed(1);
  const ax = x1 - (ux * 0.87 - uy * 0.5) * h, ay = y1 - (uy * 0.87 + ux * 0.5) * h, bx = x1 - (ux * 0.87 + uy * 0.5) * h, by = y1 - (uy * 0.87 - ux * 0.5) * h;
  return `<path class="${cls}" d="M${f(x0)},${f(y0)}L${f(x1)},${f(y1)}M${f(ax)},${f(ay)}L${f(x1)},${f(y1)}L${f(bx)},${f(by)}"/>`;
}
const R0 = 17, R1 = 44, RN = 30.5, RT = 53, RC = 86;   // px: the hole, the rim, where a digit sits, where a wedge's words start, how far under the middle the caption sits
const GAP = 3;   // degrees left open each side of a wedge

const HINT_OFF = 15, HINT_N = 28, NEAR_W = 0.5;   // px: how far up and right of the cursor the glyph rides (the other way at the view's edge) · points on a floor ring · a point this near the camera's plane is not drawn
/** a glyph a kind, drawn in a 16 px box about 0,0: a leaf with its knob · courses of brick · head and shoulders · a pin on a spot · a thing to work · a man who is not ours · the squad itself */
const GLYPH: Record<RingHint, string> = {
  door: 'M-4,-6.5h8v13h-8z M1.6,0.4a0.9,0.9 0 1 0 1.8,0a0.9,0.9 0 1 0 -1.8,0',
  wall: 'M-7,-5h14v10h-14z M-7,0h14 M-1,-5v5 M3,0v5 M-4,0v5',
  man: 'M-2.6,-3.6a2.6,2.6 0 1 0 5.2,0a2.6,2.6 0 1 0 -5.2,0 M-5.5,6a5.5,5.5 0 0 1 11,0',
  floor: 'M0,6.5C-5.4,0.6 -5.2,-6 0,-6C5.2,-6 5.4,0.6 0,6.5Z M-1.7,-1.6a1.7,1.7 0 1 0 3.4,0a1.7,1.7 0 1 0 -3.4,0',
  thing: 'M0,-6l6,6l-6,6l-6,-6z M-2,0h4',
  foe: 'M0,-6l6,11h-12z',
  squad: 'M-6.4,2a1.9,1.9 0 1 0 3.8,0a1.9,1.9 0 1 0 -3.8,0 M2.6,2a1.9,1.9 0 1 0 3.8,0a1.9,1.9 0 1 0 -3.8,0 M-1.9,-3a1.9,1.9 0 1 0 3.8,0a1.9,1.9 0 1 0 -3.8,0',
};
interface WedgeEls { g: SVGGElement; path: SVGPathElement; num: SVGTextElement; text: SVGTextElement }

/** one ring's elements, built when it is first shown */
class RingDraw {
  private g: SVGGElement | null = null;
  private cap: SVGTextElement | null = null;
  private els: WedgeEls[] = [];
  private was = '';
  constructor(private svg: SVGSVGElement) { }
  private build(n: number) {
    const g = this.g = document.createElementNS(NS, 'g') as SVGGElement; g.setAttribute('class', 'cmdring'); this.svg.appendChild(g);
    const at = (r: number, deg: number) => { const a = deg * Math.PI / 180; return `${(r * Math.cos(a)).toFixed(2)},${(r * Math.sin(a)).toFixed(2)}`; };
    const step = 360 / n;
    for (let k = 0; k < n; k++) {
      const mid = -90 + k * step, a0 = mid - step / 2 + GAP, a1 = mid + step / 2 - GAP, c = Math.cos(mid * Math.PI / 180), s = Math.sin(mid * Math.PI / 180);
      const w = document.createElementNS(NS, 'g') as SVGGElement;
      const path = document.createElementNS(NS, 'path') as SVGPathElement; path.setAttribute('class', 'cw');
      path.setAttribute('d', `M${at(R1, a0)} A${R1},${R1} 0 0 1 ${at(R1, a1)} L${at(R0, a1)} A${R0},${R0} 0 0 0 ${at(R0, a0)} Z`);
      const num = document.createElementNS(NS, 'text') as SVGTextElement; num.setAttribute('class', 'cn'); num.setAttribute('x', (RN * c).toFixed(1)); num.setAttribute('y', (RN * s + 4).toFixed(1)); num.textContent = String(k + 1);
      const text = document.createElementNS(NS, 'text') as SVGTextElement; text.setAttribute('class', 'ct'); text.setAttribute('x', (RT * c).toFixed(1)); text.setAttribute('y', (RT * s + (s < -0.5 ? -2 : s > 0.5 ? 9 : 3)).toFixed(1));
      text.setAttribute('text-anchor', Math.abs(c) < 0.2 ? 'middle' : c > 0 ? 'start' : 'end');
      w.append(path, num, text); g.appendChild(w); this.els.push({ g: w, path, num, text });
    }
    const cap = this.cap = document.createElementNS(NS, 'text') as SVGTextElement; cap.setAttribute('class', 'cc'); cap.setAttribute('y', String(RC)); g.appendChild(cap);
  }
  draw(V: RingView | null, tz: number) {
    if (!V) { if (this.was) { this.was = ''; if (this.g) this.g.style.display = 'none'; } return; }
    const sc = V.zoom / tz, key = `${V.x.toFixed(0)},${V.y.toFixed(0)},${sc.toFixed(2)}|${V.lit}|${V.tone ?? ''}|${V.caption}|${V.wedges.map(w => `${w.key}${w.off ? '-' : ''}${w.opens ? '>' : ''}${w.text}`).join('|')}`;
    if (key === this.was) return; this.was = key;
    if (!this.g || this.els.length !== CMDRING.wedges) { this.g?.remove(); this.els = []; this.build(CMDRING.wedges); }
    const g = this.g!; g.style.display = ''; g.setAttribute('transform', `translate(${(V.x / tz).toFixed(1)},${(V.y / tz).toFixed(1)}) scale(${sc.toFixed(3)})`);
    g.setAttribute('class', `cmdring${V.tone && V.tone !== 'gold' ? ` t-${V.tone}` : ''}`);
    if (this.cap) this.cap.textContent = V.caption;
    this.els.forEach((e, k) => { const w = V.wedges.find(x => x.key === k + 1);
      e.g.style.display = w ? '' : 'none'; if (!w) return;
      e.g.setAttribute('class', `${V.lit === w.key ? 'lit' : ''}${w.off ? ' off' : ''}`.trim());
      e.text.textContent = w.opens ? `${w.text} ▸` : w.text; });
  }
}

export class CmdRingViz {
  private orders: RingDraw; private hands: RingDraw;   // the squad's ring, and Sam's own (CMDRING.hands)
  private hint: SVGGElement | null = null;
  private hintWorld: SVGPathElement | null = null;
  private hintGlyph: SVGPathElement | null = null;
  private hintWas = '';
  private plan: SVGGElement | null = null;
  private planWas = '';
  constructor(private svg: SVGSVGElement) { this.orders = new RingDraw(svg); this.hands = new RingDraw(svg); }
  /** the hint of what the ring would open on (orders.ts hintView): the thing's outline on the floor and a glyph beside the cursor — in the ring's middle
   *  once a ring is up */
  private updateHint(game: Game, cam: FollowCamera, w: number, h: number, tz: number) {
    const bc = document.body.classList, H = (CMDRING.on || CMDRING.hint) && !(bc.contains('blinded') || bc.contains('attract')) ? game.orders.hintView(hoverKept) : null;   // (hidden by the page under those: nothing asked)
    if (!H) { if (this.hintWas) { this.hintWas = ''; if (this.hint) this.hint.style.display = 'none'; } return; }
    const pt = (p: Vec3): string | null => { const [x, y, front] = cam.project(p, w, h, Infinity, NEAR_W); return front ? `${x.toFixed(1)},${y.toFixed(1)}` : null; };
    let d = '';
    if (H.seg) { const a = pt(H.seg[0]), b = pt(H.seg[1]); if (a && b) d += `M${a}L${b}`; }
    if (H.ring) { const out: string[] = []; for (let i = 0; i < HINT_N; i++) { const t = i / HINT_N * 2 * Math.PI, q = pt([H.ring.at[0] + Math.cos(t) * H.ring.r, H.ring.at[1], H.ring.at[2] + Math.sin(t) * H.ring.r]); if (!q) { out.length = 0; break; } out.push(q); }
      if (out.length) d += `M${out.join('L')}Z`; }
    // (the glyph: in the ring's middle once it is up; before, up and right of the cursor — clear of the reticle's own words — and the other way where the view ends)
    const mid = H.held && !H.press;   // (the ring up: the glyph is its middle · the key down and no ring yet: it stays beside the cursor)
    const P = mid ? this.pinned(game, cam, w, h, tz) : null, s = H.zoom / tz, off = HINT_OFF * s, cx = (P ? P[0] : H.x) / tz, cy = (P ? P[1] : H.y) / tz;
    const gx = mid ? cx : cx + (cx + 2 * off > w ? -off : off), gy = mid ? cy : cy + (cy - 2 * off < 0 ? off : -off);
    const key = `${H.kind}|${H.tone ?? ''}|${H.held}|${gx.toFixed(0)},${gy.toFixed(0)},${s.toFixed(2)}|${d}`;
    if (key === this.hintWas) return; this.hintWas = key;
    if (!this.hint) { const g = this.hint = document.createElementNS(NS, 'g') as SVGGElement; this.svg.appendChild(g);
      this.hintWorld = document.createElementNS(NS, 'path') as SVGPathElement; this.hintWorld.setAttribute('class', 'hw');
      this.hintGlyph = document.createElementNS(NS, 'path') as SVGPathElement; this.hintGlyph.setAttribute('class', 'hg'); g.append(this.hintWorld, this.hintGlyph); }
    const g = this.hint; g.style.display = ''; g.setAttribute('class', `cmdhint k-${H.kind}${H.held ? ' held' : ''}${H.tone && H.tone !== 'gold' ? ` t-${H.tone}` : ''}`);
    this.hintWorld!.setAttribute('d', d); this.hintGlyph!.setAttribute('d', GLYPH[H.kind]); this.hintGlyph!.setAttribute('transform', `translate(${gx.toFixed(1)},${gy.toFixed(1)}) scale(${s.toFixed(3)})`);
  }
  /** plan mode's picture (planmode.ts planView): rebuilt only when what it shows has changed */
  private updatePlan(game: Game, cam: FollowCamera, w: number, h: number, tz: number) {
    const bc = document.body.classList, V = CMDRING.plan && !(bc.contains('blinded') || bc.contains('attract')) ? planView(game.orders) : null;
    if (!V) { if (this.planWas) { this.planWas = ''; if (this.plan) this.plan.style.display = 'none'; } return; }
    const xy = (p: Vec3): [number, number] | null => { const [x, y, front] = cam.project(p, w, h, Infinity, NEAR_W); return front ? [x, y] : null; };
    const tone = (t: string | undefined) => t && t !== 'gold' ? ` t-${t}` : '';
    let s = V.frame ? `<rect class="pf" x="3" y="3" width="${(w - 6).toFixed(0)}" height="${(h - 6).toFixed(0)}" rx="4"/><text class="pt" x="${(w / 2).toFixed(0)}" y="${(h - 14).toFixed(0)}">PLAN</text>` : '';
    for (const m of V.men) { const out: string[] = [];
      for (let i = 0; i < HINT_N; i++) { const t = i / HINT_N * 2 * Math.PI, q = xy([m.at[0] + Math.cos(t) * CMDRING.hintManM, m.at[1], m.at[2] + Math.sin(t) * CMDRING.hintManM]); if (!q) { out.length = 0; break; } out.push(`${q[0].toFixed(1)},${q[1].toFixed(1)}`); }
      if (out.length) s += `<path class="pm${tone(m.tone)}${m.picked ? ' picked' : ''}" d="M${out.join('L')}Z"/>`; }
    if (V.sam) {   // Sam's own mark: a ring at his feet — or, the view gone from him, a head at its edge pointing the way back
      const q = xy(V.sam), m = 34;
      if (q && q[0] >= m && q[0] <= w - m && q[1] >= m && q[1] <= h - m) { const out: string[] = [];
        for (let i = 0; i < HINT_N; i++) { const t = i / HINT_N * 2 * Math.PI, e = xy([V.sam[0] + Math.cos(t) * CMDRING.hintManM, V.sam[1], V.sam[2] + Math.sin(t) * CMDRING.hintManM]); if (!e) { out.length = 0; break; } out.push(`${e[0].toFixed(1)},${e[1].toFixed(1)}`); }
        if (out.length) s += `<path class="pself" d="M${out.join('L')}Z"/>`;
      } else if (q) { const dx = q[0] - w / 2, dy = q[1] - h / 2, k = Math.min((w / 2 - m) / Math.max(1e-6, Math.abs(dx)), (h / 2 - m) / Math.max(1e-6, Math.abs(dy)));
        s += `<path class="pe" d="M0,-15L11,11L0,5L-11,11Z" transform="translate(${(w / 2 + dx * k).toFixed(1)},${(h / 2 + dy * k).toFixed(1)}) rotate(${(Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(0)})"/>`; }
    }
    for (const C of V.chains) {
      const pts = [C.from, ...C.stops.map(q => q.at)].map(xy), line = pts.filter((q): q is [number, number] => !!q).map(q => `${q[0].toFixed(1)},${q[1].toFixed(1)}`);
      s += `<g class="pc${tone(C.tone)}">`; if (line.length > 1) s += `<path class="pl" d="M${line.join('L')}"/>`;
      C.stops.forEach((q, i) => { const p = pts[i + 1]; if (!p) return; const [x, y] = p;
        s += q.door ? `<rect class="ps" x="${(x - 5).toFixed(1)}" y="${(y - 5).toFixed(1)}" width="10" height="10"/>` : `<circle class="ps" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5"/>`;
        for (let k = 0; k < q.keys; k++) { const bx = x + 9 + k * 17, by = y - 19;
          s += `<g class="pk${q.now && k === 0 ? ' now' : ''}"><rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="14" height="14" rx="2"/><text x="${(bx + 7).toFixed(1)}" y="${(by + 10.5).toFixed(1)}">${V.key}</text></g>`; }
        const e = q.look ? xy(q.look) : null; if (e) s += arrow(x, y, e[0], e[1], 'pa'); });   // (the way its men face once there: planmode.ts lookOrder)
      s += '</g>'; }
    if (V.aim) { const a = xy(V.aim.from), b = xy(V.aim.to); if (a && b) s += arrow(a[0], a[1], b[0], b[1], 'pa drag'); }   // (a right press being dragged: the way it will set)
    if (V.drag) { const D = V.drag; s += `<rect class="pb" x="${(Math.min(D.x0, D.x1) / tz).toFixed(1)}" y="${(Math.min(D.y0, D.y1) / tz).toFixed(1)}" width="${(Math.abs(D.x1 - D.x0) / tz).toFixed(1)}" height="${(Math.abs(D.y1 - D.y0) / tz).toFixed(1)}"/>`; }
    if (s === this.planWas) return; this.planWas = s;
    if (!this.plan) { const g = this.plan = document.createElementNS(NS, 'g') as SVGGElement; g.setAttribute('class', 'planmode'); this.svg.insertBefore(g, this.svg.firstChild); }
    this.plan.style.display = ''; this.plan.innerHTML = s;
  }
  /** A ring that stays on its point (CMDRING.pin), where THIS picture's camera puts it, in the view's px: the game's own place for it (RingState.ax / ay) was
   *  worked out before the tick's camera step, and a ring drawn there swims a few px against the floor while the view moves. null = the game's place stands */
  private pinned(game: Game, cam: FollowCamera, w: number, h: number, tz: number): [number, number] | null {
    const R = game.orders.cmdRing; if (!CMDRING.pin || !R?.at) return null;
    const [sx, sy, front] = cam.project(R.at, w * tz, h * tz); if (!front) return null;
    const c = { ...R }; ringPin(c, sx, sy, w * tz, h * tz); return [c.ax, c.ay];
  }
  /** `w`, `h`: the layer's own size · `tz`: the factor it is zoomed by (ui/textsize.ts) */
  update(game: Game, cam: FollowCamera, w: number, h: number, tz: number) {
    this.updatePlan(game, cam, w, h, tz);
    this.updateHint(game, cam, w, h, tz);
    const V0 = CMDRING.on || game.orders.cmdRing ? game.orders.ringView() : null, P = V0 ? this.pinned(game, cam, w, h, tz) : null, V = V0 && P ? { ...V0, x: P[0], y: P[1] } : V0;
    const H = game.player.sel.ring ? handRingView(game) : null;
    this.orders.draw(V, tz); this.hands.draw(H, tz); this.clear(V, H, tz);
  }
  private overKey = '';
  /** a ring is drawn (the tutorial's big line is at home under one, its step clear of your men stood down: ui/overlay.ts) */
  get ringUp(): boolean { return this.overKey !== ''; }
  private railShift = 0;
  /** the status column goes faint while the squad ring's words lie over it (a ring put up on a door near that corner was read through the column's plates);
   *  and the tutorial's big line steps out from under either ring (it lies over the ring's layer: with the cursor low in the middle, a ring's lower wedge
   *  and its caption were under the line's plate) — down if the view has the room, else up over the ring (index.html `--railshift`) */
  private clear(V: RingView | null, H: RingView | null, tz: number) {
    const rail = V || H ? document.getElementById('railprompt') : null, k = (R: RingView | null) => R ? `${R.x.toFixed(0)},${R.y.toFixed(0)},${R.zoom.toFixed(2)}` : '';
    const key = V || H ? `${k(V)}|${k(H)}|${rail?.classList.contains('on') ? rail.textContent?.length : ''}|${innerHeight}` : ''; if (key === this.overKey) return; this.overKey = key;
    const s = key ? this.svg.getBoundingClientRect() : null;
    /** a ring's words as a box of the window: wider than tall, and down to under its caption when `cap` */
    const box = (R: RingView, cap: boolean) => { const cx = s!.left + R.x / tz, cy = s!.top + R.y / tz, z = R.zoom / tz; return { l: cx - 190 * z, r: cx + 190 * z, t: cy - 80 * z, b: cy + (cap ? RC + 14 : 80) * z }; };
    const col = V ? document.getElementById('interact')?.getBoundingClientRect() : null, v = V && col && col.width > 0 && col.height > 0 ? box(V, false) : null;
    document.body.classList.toggle('ringover', !!v && v.l < col!.right && v.r > col!.left && v.t < col!.bottom && v.b > col!.top);
    let shift = 0;
    if (rail?.classList.contains('on')) { const b = rail.getBoundingClientRect(), cur = new DOMMatrixReadOnly(getComputedStyle(rail).transform).m42 * tz, top = b.top - cur, bottom = b.bottom - cur;   // (where the line is at rest: measured less the step it is on now — it may be part way there)
      for (const R of [V, H]) { if (!R) continue; const q = box(R, true); if (!(b.width > 0 && q.l < b.right && q.r > b.left && q.t < bottom && q.b > top)) continue;
        const down = q.b + 8 - top, up = q.t - 8 - bottom; shift = bottom + down <= innerHeight - 8 ? down : up; break; } }
    if (shift !== this.railShift) { this.railShift = shift; const el = document.getElementById('railprompt'); if (el) el.style.setProperty('--railshift', `${(shift / tz).toFixed(1)}px`); }
  }
}
