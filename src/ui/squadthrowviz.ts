// A SQUAD THROW ON THE FLOOR — who throws, his walk, the arc, where it rests (game/squadthrow.ts squadThrowPlans). The maintainer, 10-13: "(and maybe
// visualize who's doing it and the path on the ground?)". No words: a ring at the thrower's feet in his element's colour, a dashed line along his walk to a
// small ring where he will throw from, the arc, a ring where the thing comes to rest and, for a frag, two dotted ones: the radius it kills in and, fainter, the radius it wounds in. Fainter while it
// is only the highlighted row of the throw page; full from the order until the thing leaves his hand. Drawn into the overlay's #traj SVG, under Sam's own
// throw arc. SQUADTHROW.draw off = nothing here (a module that draws the squad's whole plan may read squadThrowPlans itself). Reads only; no state but its nodes.
import type { Vec3 } from '../math/vec';
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import { SQUADTHROW, squadThrowPlans } from '../game/squadthrow';
import { SQUAD40, squad40Plans } from '../game/squad40';
import { FRAG } from '../game/frag';
import { planDrawsThrows } from '../game/floorplan';

const NS = 'http://www.w3.org/2000/svg';
const TONE: Record<string, string> = { red: '#ff9a8a', blue: '#9cc8ff', gold: '#f2cf6b' };
const RING = 20, BIG = 48, FLOOR = 0.03;
type Part = 'who' | 'walk' | 'spot' | 'arc' | 'land' | 'kill' | 'wound';
interface Els { g: SVGGElement; p: Record<Part, SVGPathElement>; d: Record<Part, string>; tone: string; op: string }

export class SquadThrowViz {
  private root: SVGGElement; private els: Els[] = []; private shown = 0;
  constructor(svg: SVGSVGElement, before: Element | null) {
    this.root = document.createElementNS(NS, 'g') as SVGGElement; this.root.setAttribute('class', 'squadthrow');
    svg.insertBefore(this.root, before);
  }
  private make(): Els {
    const mk = (width: string, dash?: string, op?: string, fill?: string) => { const e = document.createElementNS(NS, 'path') as SVGPathElement; e.setAttribute('fill', fill ? 'currentColor' : 'none'); if (fill) e.setAttribute('fill-opacity', fill); e.setAttribute('stroke', 'currentColor'); e.setAttribute('stroke-width', width); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round'); if (dash) e.setAttribute('stroke-dasharray', dash); if (op) e.setAttribute('stroke-opacity', op); return e; };
    const g = document.createElementNS(NS, 'g') as SVGGElement;
    const p: Els['p'] = { wound: mk('1', '2 9', '0.3'), kill: mk('1', '2 7', '0.6'), walk: mk('2', '7 6'), spot: mk('1.5'), who: mk('2.5', undefined, undefined, '0.14'), arc: mk('2', '5 6'), land: mk('1.5', undefined, undefined, '0.18') };
    for (const k of ['wound', 'kill', 'walk', 'spot', 'who', 'arc', 'land'] as Part[]) g.appendChild(p[k]);
    const E: Els = { g, p, d: { who: '', walk: '', spot: '', arc: '', land: '', kill: '', wound: '' }, tone: '', op: '' };
    this.root.appendChild(g); return E;
  }
  update(game: Game, cam: FollowCamera, w: number, h: number, edge: number) {
    const throws = SQUADTHROW.draw && SQUADTHROW.on && !planDrawsThrows() ? squadThrowPlans(game) : [];   // (the floor plan draws them itself while it is on: ui/planfloor.ts)
    const plans = SQUAD40.draw ? [...throws, ...squad40Plans(game)] : throws;   // (a teammate's 40 mm on order — game/squad40.ts: who fires, the arc, where it goes off; empty unless a card brought a round)
    // one path per part: a point out of the view BREAKS the line there (never a chord across the gap), and a ring the view's edge cuts keeps the part of it in view
    const path = (pts: Vec3[] | undefined, closed: boolean) => {
      if (!pts || pts.length < 2) return '';
      let d = '', run = 0, all = true;
      for (const p of pts) {
        const [x, y, vis] = cam.project([p[0], Math.max(p[1], FLOOR), p[2]], w, h, edge);
        if (!vis) { run = 0; all = false; continue; }
        d += `${run++ ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
      }
      return closed && all ? d + 'Z' : d;
    };
    const ring = (c: Vec3 | null, r: number, n = RING) => {
      if (!c) return '';
      const pts: Vec3[] = []; for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2; pts.push([c[0] + Math.cos(a) * r, FLOOR, c[2] + Math.sin(a) * r]); }
      return path(pts, false);
    };
    const set = (E: Els, k: Part, d: string) => { if (E.d[k] !== d) { E.d[k] = d; E.p[k].setAttribute('d', d); } };   // (a still plan writes nothing)
    for (let i = 0; i < plans.length; i++) {
      const P = plans[i], E = this.els[i] ?? (this.els[i] = this.make()), tone = TONE[game.orders.pairOf(P.gd) ?? 'gold'] ?? TONE.gold, walking = !!P.walk && P.walk.length > 1, op = P.preview ? '0.6' : '0.95';
      if (i >= this.shown) E.g.style.display = 'block';
      if (E.tone !== tone) { E.tone = tone; E.g.style.color = tone; }
      if (E.op !== op) { E.op = op; E.g.setAttribute('opacity', op); }
      set(E, 'who', ring(P.gd.char.pos, 0.42));
      set(E, 'walk', walking ? path(P.walk, false) : ''); set(E, 'spot', ring(walking ? P.from : null, 0.2));
      set(E, 'arc', path(P.points, false));
      set(E, 'land', ring(P.land, 0.3));
      const frag = P.kind !== 'stun';   // (a frag's burst — and a 40 mm round's, which is the same one)
      set(E, 'kill', ring(frag ? P.land : null, FRAG.lethalM, BIG)); set(E, 'wound', ring(frag ? P.land : null, FRAG.woundM, BIG));
    }
    for (let i = plans.length; i < this.shown; i++) this.els[i].g.style.display = 'none';
    this.shown = plans.length;
  }
}
