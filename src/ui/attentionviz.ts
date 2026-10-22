// WHERE A GUARD'S ATTENTION IS, ON THE FLOOR (game/attention.ts attentionMarks — this file draws exactly that list). The maintainer, 10-13: "we should make sure
// it's legible and fun". No word and no number (show, not tell): a dotted thread from the man's feet to the place his attention went — along the way he will walk when he is going over — and a ring there. The
// ring is a clock: whole while he walks over, running down once he is at the thing, starting part-spent when the same trick has been played on him lately,
// and it flickers for the last beat — he has said he is done and his eye is about to widen. A thing he only turns his head to gets the same ring, small and
// brief; an attention another file holds (a man at a lit screen) a steady dim one. Amber, the HUD's colour for a wary man (STYLE.md). Drawn into the overlay's
// #traj SVG under the squad's marks. Reads only; no state but its nodes. Never seen on a GPU: the weights and the colour are guesses.
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from '../game/game';
import type { FollowCamera } from '../game/camera';
import { ATTENTION, attentionMarks, attentionWay, type AttentionWayKept, type AttentionWayStore } from '../game/attention';

const NS = 'http://www.w3.org/2000/svg';
const SEG = 28, FLOOR = 0.05, AMBER = '#ffd866';
type Part = 'thread' | 'track' | 'arc';
interface Els { g: SVGGElement; p: Record<Part, SVGPathElement>; d: Record<Part, string>; op: string }
/** each man's kept way and the tables the grid is searched on (attention.ts attentionWay): the PICTURE'S own — a game drawn and the same game not drawn hold
 *  the same state */
const keptWays = new WeakMap<Guard, AttentionWayKept>();
const ways: AttentionWayStore = { get: gd => keptWays.get(gd), set: (gd, w) => keptWays.set(gd, w), nav: {} };

/** the thread along `way` (game/attention.ts attentionWay: straight for a man who only looks, the way he will walk for one going over), from `head` m along
 *  it to `tail` m short of its end, in half-metre pieces — so the part of it in the view is drawn when an end is out of it. Empty for a man all but at the ring. */
export function threadPoints(way: Vec3[], head: number, tail: number): Vec3[] {
  let len = 0; for (let i = 1; i < way.length; i++) len += Math.hypot(way[i][0] - way[i - 1][0], way[i][2] - way[i - 1][2]);
  const to = len - tail, pts: Vec3[] = []; if (!(to - head > 0.15)) return pts;
  let s = 0;
  for (let i = 1; i < way.length; i++) {
    const a = way[i - 1], b = way[i], l = Math.hypot(b[0] - a[0], b[2] - a[2]), s0 = Math.max(head, s), s1 = Math.min(to, s + l);
    if (l > 1e-6 && s1 > s0) { const n = Math.max(1, Math.ceil((s1 - s0) / 0.5)); for (let k = pts.length ? 1 : 0; k <= n; k++) { const u = (s0 + (s1 - s0) * k / n - s) / l; pts.push([a[0] + (b[0] - a[0]) * u, FLOOR, a[2] + (b[2] - a[2]) * u]); } }
    s += l;
  }
  return pts;
}

export class AttentionViz {
  private root: SVGGElement; private els: Els[] = []; private shown = 0;
  constructor(svg: SVGSVGElement, before: Element | null) {
    this.root = document.createElementNS(NS, 'g') as SVGGElement; this.root.setAttribute('class', 'attention'); this.root.style.color = AMBER;
    svg.insertBefore(this.root, before);
  }
  private make(): Els {
    const mk = (width: string, dash?: string, op?: string) => { const e = document.createElementNS(NS, 'path') as SVGPathElement; e.setAttribute('fill', 'none'); e.setAttribute('stroke', 'currentColor'); e.setAttribute('stroke-width', width); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round'); if (dash) e.setAttribute('stroke-dasharray', dash); if (op) e.setAttribute('stroke-opacity', op); return e; };
    const g = document.createElementNS(NS, 'g') as SVGGElement;
    const p: Els['p'] = { thread: mk('2.5', '0.1 6', '0.85'), track: mk('1.5', undefined, '0.25'), arc: mk('3') };
    for (const k of ['thread', 'track', 'arc'] as Part[]) g.appendChild(p[k]);
    const E: Els = { g, p, d: { thread: '', track: '', arc: '' }, op: '' };
    this.root.appendChild(g); return E;
  }
  update(game: Game, cam: FollowCamera, w: number, h: number, edge: number) {
    const bc = document.body.classList, marks = bc.contains('blinded') || bc.contains('attract') ? [] : attentionMarks(game);   // (hidden by the page under those, as every mark over a man is)
    // a point out of the view breaks the line there (never a chord across the gap)
    const path = (pts: Vec3[]) => {
      let d = '', run = 0;
      for (const p of pts) { const [x, y, vis] = cam.project([p[0], FLOOR, p[2]], w, h, edge); if (!vis) { run = 0; continue; } d += `${run++ ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; }
      return d.includes('L') ? d : '';   // (a lone point is no line)
    };
    const thread = (way: Vec3[], head: number, tail: number) => path(threadPoints(way, head, tail));
    /** the part `frac` of a ring of radius r about c, from the far side of it round (a clock running down) */
    const ring = (c: Vec3, r: number, frac: number) => {
      const n = Math.max(1, Math.round(SEG * frac)); if (frac <= 0.01) return '';
      const pts: Vec3[] = []; for (let i = 0; i <= n; i++) { const a = i / SEG * Math.PI * 2; pts.push([c[0] + Math.sin(a) * r, FLOOR, c[2] - Math.cos(a) * r]); }
      return path(pts);
    };
    const set = (E: Els, k: Part, d: string) => { if (E.d[k] !== d) { E.d[k] = d; E.p[k].setAttribute('d', d); } };
    for (let i = 0; i < marks.length; i++) {
      const M = marks[i], E = this.els[i] ?? (this.els[i] = this.make());
      if (i >= this.shown) E.g.style.display = 'block';
      const r = M.mode === 'go' ? ATTENTION.ringM : ATTENTION.ringM * 0.7;
      const op = M.mode === 'lent' ? '0.55' : M.ending ? (Math.floor(game.time * 10) % 2 ? '0.35' : '1') : '0.95';   // (the last beat flickers: he has said he is done)
      if (E.op !== op) { E.op = op; E.g.setAttribute('opacity', op); }
      // the thread starts off his feet and stops at the ring's edge, not its middle
      set(E, 'thread', thread(attentionWay(game, M, ways), 0.35, r));
      set(E, 'track', ring(M.at, r, 1)); set(E, 'arc', ring(M.at, r, M.left));
    }
    for (let i = marks.length; i < this.shown; i++) this.els[i].g.style.display = 'none';
    this.shown = marks.length;
  }
}
