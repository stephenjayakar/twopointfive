// The orders ring at the cursor (game/cmdring.ts says WHEN, orders.ts `ringView` says WHAT; this file draws it): a wedge a digit, clockwise from the top,
// the lit one filled, a greyed one for a row that cannot be given now, its words outside it, the middle left open so what is pointed at shows through.
// Under it, small, who the order goes to and what the ring was opened on.
// index.html `.cmdring …` is the look. Nothing is built or shown until a ring is up; an attribute is written only when it changes.
import type { Game } from '../game/game';
import { CMDRING } from '../game/cmdring';

const NS = 'http://www.w3.org/2000/svg';
const R0 = 17, R1 = 44, RN = 30.5, RT = 53, RC = 86;   // px: the hole, the rim, where a digit sits, where a wedge's words start, how far under the middle the caption sits
const GAP = 3;   // degrees left open each side of a wedge

interface WedgeEls { g: SVGGElement; path: SVGPathElement; num: SVGTextElement; text: SVGTextElement }

export class CmdRingViz {
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
  update(game: Game) {
    const V = CMDRING.on || game.orders.cmdRing ? game.orders.ringView() : null;
    if (!V) { if (this.was) { this.was = ''; if (this.g) this.g.style.display = 'none'; } return; }
    const key = `${V.x.toFixed(0)},${V.y.toFixed(0)}|${V.lit}|${V.tone ?? ''}|${V.caption}|${V.wedges.map(w => `${w.key}${w.off ? '-' : ''}${w.opens ? '>' : ''}${w.text}`).join('|')}`;
    if (key === this.was) return; this.was = key;
    if (!this.g || this.els.length !== CMDRING.wedges) { this.g?.remove(); this.els = []; this.build(CMDRING.wedges); }
    const g = this.g!; g.style.display = ''; g.setAttribute('transform', `translate(${V.x.toFixed(1)},${V.y.toFixed(1)})`);
    g.setAttribute('class', `cmdring${V.tone && V.tone !== 'gold' ? ` t-${V.tone}` : ''}`);
    if (this.cap) this.cap.textContent = V.caption;
    this.els.forEach((e, k) => { const w = V.wedges.find(x => x.key === k + 1);
      e.g.style.display = w ? '' : 'none'; if (!w) return;
      e.g.setAttribute('class', `${V.lit === w.key ? 'lit' : ''}${w.off ? ' off' : ''}`.trim());
      e.text.textContent = w.opens ? `${w.text} ▸` : w.text; });
  }
}
