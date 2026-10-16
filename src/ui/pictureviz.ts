// ONE MAN'S PICTURE OF THE FIGHT, ON THE FLOOR (game/picture.ts pictureViews — this file draws exactly that list). A debug view: off unless PICTURE.show says
// otherwise (?picture on the address, or the panel's row), then the picture of the fighter nearest the cursor, either side's. No word and no number:
//   · a ring at the feet of the man whose picture it is;
//   · each enemy he has an idea of: a dotted thread to the place he BELIEVES the man to be and a ring there, fainter as the idea ages — coral for his own
//     eyes, amber for his ears (gunfire, a noise his senses are working from), blue for what his net told him; a broken ring once he has looked at the place
//     and found it empty; a thin dashed circle = how far the man may have walked since, with a dot at each place he may be;
//   · the floor round him that he counts in a believed enemy's line: coral dots, heavier the fresher the idea;
//   · the cover he rates: green rings (broken = kneeling only), a dot in the ones with an edge to fight from.
// The marks are where he THINKS things are: an enemy standing somewhere else than his ring is the picture being out of date, which is the point of the view.
// Drawn into the overlay's #traj SVG under the squad's marks. Reads only; no state but its nodes. Never seen on a GPU: the weights and colours are guesses.
import type { Vec3 } from '../math/vec';
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import { pictureViews } from '../game/picture';

const NS = 'http://www.w3.org/2000/svg';
const SEG = 20, FLOOR = 0.05, CORAL = '#ff8a70', AMBER = '#ffd866', BLUE = '#8fd0ff', GREEN = '#8fe3a0', WHITE = '#e8eef0';
type Key = 'self' | 'tSeen' | 'tHeard' | 'tTold' | 'rSeen' | 'rSeenOld' | 'rHeard' | 'rHeardOld' | 'rTold' | 'rToldOld' | 'rLost' | 'reach' | 'maybe' | 'un1' | 'un2' | 'un3' | 'cov' | 'covLow' | 'covEdge';
const STYLE: Record<Key, { c: string; w: string; dash?: string; op: string }> = {
  self: { c: WHITE, w: '2.5', op: '0.9' },
  tSeen: { c: CORAL, w: '2', dash: '0.1 6', op: '0.8' }, tHeard: { c: AMBER, w: '2', dash: '0.1 6', op: '0.8' }, tTold: { c: BLUE, w: '2', dash: '0.1 6', op: '0.8' },
  rSeen: { c: CORAL, w: '3', op: '1' }, rSeenOld: { c: CORAL, w: '3', op: '0.45' }, rHeard: { c: AMBER, w: '3', op: '1' }, rHeardOld: { c: AMBER, w: '3', op: '0.45' }, rTold: { c: BLUE, w: '3', op: '1' }, rToldOld: { c: BLUE, w: '3', op: '0.45' },
  rLost: { c: WHITE, w: '2', dash: '4 5', op: '0.6' }, reach: { c: WHITE, w: '1', dash: '3 6', op: '0.35' }, maybe: { c: WHITE, w: '5', op: '0.5' },
  un1: { c: CORAL, w: '5', op: '0.22' }, un2: { c: CORAL, w: '6', op: '0.45' }, un3: { c: CORAL, w: '7', op: '0.75' },
  cov: { c: GREEN, w: '2.5', op: '0.95' }, covLow: { c: GREEN, w: '2.5', dash: '3 4', op: '0.95' }, covEdge: { c: GREEN, w: '6', op: '0.95' },
};

export class PictureViz {
  private root: SVGGElement; private p = {} as Record<Key, SVGPathElement>; private d = {} as Record<Key, string>; private on = false;
  constructor(svg: SVGSVGElement, before: Element | null) {
    this.root = document.createElementNS(NS, 'g') as SVGGElement; this.root.setAttribute('class', 'picture'); this.root.style.display = 'none';
    for (const k of Object.keys(STYLE) as Key[]) { const S = STYLE[k], e = document.createElementNS(NS, 'path') as SVGPathElement;
      e.setAttribute('fill', 'none'); e.setAttribute('stroke', S.c); e.setAttribute('stroke-width', S.w); e.setAttribute('stroke-linecap', 'round'); e.setAttribute('stroke-linejoin', 'round'); e.setAttribute('opacity', S.op); if (S.dash) e.setAttribute('stroke-dasharray', S.dash);
      this.root.appendChild(e); this.p[k] = e; this.d[k] = ''; }
    svg.insertBefore(this.root, before);
  }
  update(game: Game, cam: FollowCamera, w: number, h: number, edge: number) {
    const bc = document.body.classList, views = bc.contains('blinded') || bc.contains('breaching') || bc.contains('attract') ? [] : pictureViews(game);
    if (!views.length) { if (this.on) { this.on = false; this.root.style.display = 'none'; } return; }
    if (!this.on) { this.on = true; this.root.style.display = 'block'; }
    const D = {} as Record<Key, string>; for (const k of Object.keys(STYLE) as Key[]) D[k] = '';
    const path = (pts: Vec3[]) => { let s = '', run = 0; for (const q of pts) { const [x, y, vis] = cam.project([q[0], FLOOR, q[2]], w, h, edge); if (!vis) { run = 0; continue; } s += `${run++ ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; } return s.includes('L') ? s : ''; };
    const thread = (a: Vec3, b: Vec3) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.5)), pts: Vec3[] = []; for (let i = 0; i <= n; i++) pts.push([a[0] + (b[0] - a[0]) * i / n, FLOOR, a[2] + (b[2] - a[2]) * i / n]); return path(pts); };
    const ring = (c: Vec3, r: number) => { const pts: Vec3[] = []; for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI * 2; pts.push([c[0] + Math.sin(a) * r, FLOOR, c[2] - Math.cos(a) * r]); } return path(pts); };
    const dot = (x: number, z: number) => { const [sx, sy, vis] = cam.project([x, FLOOR, z], w, h, edge); return vis ? `M${sx.toFixed(1)} ${sy.toFixed(1)}l0.01 0` : ''; };
    for (const V of views) {
      D.self += ring(V.from, 0.5);
      for (const I of V.ideas) {
        const kind = I.how === 'seen' ? 'Seen' : I.how === 'told' ? 'Told' : 'Heard', L = Math.hypot(I.at[0] - V.from[0], I.at[2] - V.from[2]);
        if (L > 1) D[`t${kind}` as Key] += thread([V.from[0] + (I.at[0] - V.from[0]) / L * 0.55, FLOOR, V.from[2] + (I.at[2] - V.from[2]) / L * 0.55], [I.at[0] - (I.at[0] - V.from[0]) / L * 0.4, FLOOR, I.at[2] - (I.at[2] - V.from[2]) / L * 0.4]);
        if (I.lost) D.rLost += ring(I.at, 0.4); else D[`r${kind}${I.w < 0.75 ? 'Old' : ''}` as Key] += ring(I.at, 0.4);
        if (I.reach >= 1) D.reach += ring(I.at, I.reach);
        for (const q of I.maybe) D.maybe += dot(q[0], q[2]);
      }
      for (const [x, z, e] of V.unsafe) D[e > 0.7 ? 'un3' : e > 0.35 ? 'un2' : 'un1'] += dot(x, z);
      for (const C of V.cover) { D[C.stand > 0 ? 'covLow' : 'cov'] += ring(C.at, 0.28); if (C.edge) D.covEdge += dot(C.at[0], C.at[2]); }
    }
    for (const k of Object.keys(STYLE) as Key[]) if (this.d[k] !== D[k]) { this.d[k] = D[k]; this.p[k].setAttribute('d', D[k]); }
  }
}
