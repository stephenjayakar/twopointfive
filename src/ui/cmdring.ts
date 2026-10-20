// The orders ring at the cursor (game/cmdring.ts says WHEN, orders.ts `ringView` says WHAT; this file draws it): a wedge a digit, clockwise from the top,
// the lit one filled, a greyed one for a row that cannot be given now, its words outside it, the middle left open so what is pointed at shows through.
// Under it, small, who the order goes to and what the ring was opened on.
// Before the key, with CMDRING.hint, a small glyph beside the cursor and an outline on the floor say what the ring would open on (orders.ts `hintView`).
// index.html `.cmdring …` and `.cmdhint …` are the look. Nothing is built until there is something to show; an attribute is written only when it changes.
// The layer is zoomed with the page's words (ui/textsize.ts): a place in the view's px is divided by that factor, and the ring is drawn at the game's own
// (cmdring.ts ringZoom), so the wedge under the cursor is the wedge the game lights.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { CMDRING, type RingHint } from '../game/cmdring';

const NS = 'http://www.w3.org/2000/svg';
const R0 = 17, R1 = 44, RN = 30.5, RT = 53, RC = 86;   // px: the hole, the rim, where a digit sits, where a wedge's words start, how far under the middle the caption sits
const GAP = 3;   // degrees left open each side of a wedge

const HINT_OFF = 15, HINT_N = 28, NEAR_W = 0.5;   // px: how far up and right of the cursor the glyph rides (the other way at the view's edge) · points on a floor ring · a point this near the camera's plane is not drawn
/** a glyph a kind, drawn in a 16 px box about 0,0: a leaf with its knob · courses of brick · head and shoulders · a spot · a thing to work · a man who is not ours · the squad itself */
const GLYPH: Record<RingHint, string> = {
  door: 'M-4,-6.5h8v13h-8z M1.6,0.4a0.9,0.9 0 1 0 1.8,0a0.9,0.9 0 1 0 -1.8,0',
  wall: 'M-7,-5h14v10h-14z M-7,0h14 M-1,-5v5 M3,0v5 M-4,0v5',
  man: 'M-2.6,-3.6a2.6,2.6 0 1 0 5.2,0a2.6,2.6 0 1 0 -5.2,0 M-5.5,6a5.5,5.5 0 0 1 11,0',
  floor: 'M-1.6,0a1.6,1.6 0 1 0 3.2,0a1.6,1.6 0 1 0 -3.2,0 M-6,0a6,3.4 0 1 0 12,0a6,3.4 0 1 0 -12,0',
  thing: 'M0,-6l6,6l-6,6l-6,-6z M-2,0h4',
  foe: 'M0,-6l6,11h-12z',
  squad: 'M-6.4,2a1.9,1.9 0 1 0 3.8,0a1.9,1.9 0 1 0 -3.8,0 M2.6,2a1.9,1.9 0 1 0 3.8,0a1.9,1.9 0 1 0 -3.8,0 M-1.9,-3a1.9,1.9 0 1 0 3.8,0a1.9,1.9 0 1 0 -3.8,0',
};
interface WedgeEls { g: SVGGElement; path: SVGPathElement; num: SVGTextElement; text: SVGTextElement }

export class CmdRingViz {
  private g: SVGGElement | null = null;
  private cap: SVGTextElement | null = null;
  private els: WedgeEls[] = [];
  private was = '';
  private hint: SVGGElement | null = null;
  private hintWorld: SVGPathElement | null = null;
  private hintGlyph: SVGPathElement | null = null;
  private hintWas = '';
  constructor(private svg: SVGSVGElement) { }
  /** the hint of what the ring would open on (orders.ts hintView): the thing's outline on the floor and a glyph beside the cursor — in the ring's middle
   *  once a ring is up */
  private updateHint(game: Game, cam: FollowCamera, w: number, h: number, tz: number) {
    const bc = document.body.classList, H = CMDRING.on && CMDRING.hint && !(bc.contains('blinded') || bc.contains('attract')) ? game.orders.hintView() : null;   // (hidden by the page under those: nothing asked)
    if (!H) { if (this.hintWas) { this.hintWas = ''; if (this.hint) this.hint.style.display = 'none'; } return; }
    const pt = (p: Vec3): string | null => { const [x, y, front] = cam.project(p, w, h, Infinity, NEAR_W); return front ? `${x.toFixed(1)},${y.toFixed(1)}` : null; };
    let d = '';
    if (H.seg) { const a = pt(H.seg[0]), b = pt(H.seg[1]); if (a && b) d += `M${a}L${b}`; }
    if (H.ring) { const out: string[] = []; for (let i = 0; i < HINT_N; i++) { const t = i / HINT_N * 2 * Math.PI, q = pt([H.ring.at[0] + Math.cos(t) * H.ring.r, H.ring.at[1], H.ring.at[2] + Math.sin(t) * H.ring.r]); if (!q) { out.length = 0; break; } out.push(q); }
      if (out.length) d += `M${out.join('L')}Z`; }
    // (the glyph: in the ring's middle once it is up; before, up and right of the cursor — clear of the reticle's own words — and the other way where the view ends)
    const s = H.zoom / tz, off = HINT_OFF * s, cx = H.x / tz, cy = H.y / tz;
    const gx = H.held ? cx : cx + (cx + 2 * off > w ? -off : off), gy = H.held ? cy : cy + (cy - 2 * off < 0 ? off : -off);
    const key = `${H.kind}|${H.tone ?? ''}|${H.held}|${gx.toFixed(0)},${gy.toFixed(0)},${s.toFixed(2)}|${d}`;
    if (key === this.hintWas) return; this.hintWas = key;
    if (!this.hint) { const g = this.hint = document.createElementNS(NS, 'g') as SVGGElement; this.svg.appendChild(g);
      this.hintWorld = document.createElementNS(NS, 'path') as SVGPathElement; this.hintWorld.setAttribute('class', 'hw');
      this.hintGlyph = document.createElementNS(NS, 'path') as SVGPathElement; this.hintGlyph.setAttribute('class', 'hg'); g.append(this.hintWorld, this.hintGlyph); }
    const g = this.hint; g.style.display = ''; g.setAttribute('class', `cmdhint k-${H.kind}${H.held ? ' held' : ''}${H.tone && H.tone !== 'gold' ? ` t-${H.tone}` : ''}`);
    this.hintWorld!.setAttribute('d', d); this.hintGlyph!.setAttribute('d', GLYPH[H.kind]); this.hintGlyph!.setAttribute('transform', `translate(${gx.toFixed(1)},${gy.toFixed(1)}) scale(${s.toFixed(3)})`);
  }
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
  /** `w`, `h`: the layer's own size · `tz`: the factor it is zoomed by (ui/textsize.ts) */
  update(game: Game, cam: FollowCamera, w: number, h: number, tz: number) {
    this.updateHint(game, cam, w, h, tz);
    const V = CMDRING.on || game.orders.cmdRing ? game.orders.ringView() : null;
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
