// THE STALK'S GEOMETRY, ON THE FLOOR (game/stalk.ts) — a tuning view, nothing unless STALKVIZ.on asks (the sneak lab's switch: src/host/sneaklab.ts). Round the
// man being crept on, else the nearest man within six metres: the ring a press can begin inside and the wider one past which the stalk lets go, the two edges
// of his rear arc (a press begins behind them) and the two it is over at, the point behind his back Sam is walked to, the ring inside which the hold becomes
// the grab, and, while a stalk runs, the line Sam is on. Drawn into the overlay's #traj SVG. Reads only; no state but its nodes. Never seen on a GPU.
import type { Vec3 } from '../math/vec';
import type { Game, Guard } from '../game/game';
import type { FollowCamera } from '../game/camera';
import { STALK, stalkOn, stalkBeginM, stalkOutM } from '../game/stalk';

export const STALKVIZ = { on: false };
const NS = 'http://www.w3.org/2000/svg', FLOOR = 0.05, SEG = 40;
type Part = 'begin' | 'out' | 'arc' | 'arcOut' | 'grab' | 'station' | 'line';
const PARTS: [Part, string, string | null, string][] = [['begin', '1.5', '6 5', '0.7'], ['out', '1', '2 6', '0.4'], ['arc', '2', null, '0.8'], ['arcOut', '1', '2 6', '0.5'], ['grab', '2.5', null, '0.95'], ['station', '2', null, '0.95'], ['line', '2', '0.1 7', '0.9']];

export class StalkViz {
  private root: SVGGElement; private p = {} as Record<Part, SVGPathElement>; private d = {} as Record<Part, string>; private shown = false;
  constructor(svg: SVGSVGElement, before: Element | null) {
    this.root = document.createElementNS(NS, 'g') as SVGGElement; this.root.setAttribute('class', 'stalkviz'); this.root.style.color = '#7fe3ff'; this.root.style.display = 'none';
    for (const [k, width, dash, op] of PARTS) { const e = document.createElementNS(NS, 'path') as SVGPathElement; e.setAttribute('fill', 'none'); e.setAttribute('stroke', 'currentColor'); e.setAttribute('stroke-width', width); e.setAttribute('stroke-linecap', 'round'); if (dash) e.setAttribute('stroke-dasharray', dash); e.setAttribute('opacity', op); this.root.appendChild(e); this.p[k] = e; this.d[k] = ''; }
    svg.insertBefore(this.root, before);
  }
  update(game: Game, cam: FollowCamera, w: number, h: number, edge: number) {
    const pl = game.player.char.pos; let gd: Guard | null = STALKVIZ.on ? stalkOn(game) : null;
    if (STALKVIZ.on && !gd) { let bd = 6; for (const x of game.guards) { if (x.state === 'dead' || x.civ || x.held) continue; const dd = Math.hypot(x.char.pos[0] - pl[0], x.char.pos[2] - pl[2]); if (dd < bd) { gd = x; bd = dd; } } }
    if (!gd) { if (this.shown) { this.root.style.display = 'none'; this.shown = false; } return; }
    if (!this.shown) { this.root.style.display = 'block'; this.shown = true; }
    const path = (pts: Vec3[]) => { let d = '', run = 0; for (const q of pts) { const [x, y, vis] = cam.project([q[0], FLOOR, q[2]], w, h, edge); if (!vis) { run = 0; continue; } d += `${run++ ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`; } return d.includes('L') ? d : ''; };
    const c = gd.char.pos, yaw = gd.char.bodyYaw;
    /** the point `r` m from him on the bearing `b` off his facing */
    const at = (b: number, r: number): Vec3 => [c[0] + Math.sin(yaw + b) * r, FLOOR, c[2] + Math.cos(yaw + b) * r];
    const ring = (o: ArrayLike<number>, r: number) => { const pts: Vec3[] = []; for (let i = 0; i <= SEG; i++) { const a = i / SEG * Math.PI * 2; pts.push([o[0] + Math.sin(a) * r, FLOOR, o[2] + Math.cos(a) * r]); } return path(pts); };
    const spoke = (b: number, r: number) => { const pts: Vec3[] = []; for (let i = 0; i <= 8; i++) pts.push(at(b, 0.3 + (r - 0.3) * i / 8)); return path(pts); };
    const set = (k: Part, d: string) => { if (this.d[k] !== d) { this.d[k] = d; this.p[k].setAttribute('d', d); } };
    const bBegin = Math.acos(Math.max(-1, Math.min(1, STALK.beginCos))), bOut = Math.acos(Math.max(-1, Math.min(1, STALK.outCos))), station = at(Math.PI, STALK.stationM);
    set('begin', ring(c, stalkBeginM())); set('out', ring(c, stalkOutM()));
    set('arc', spoke(bBegin, stalkBeginM()) + spoke(-bBegin, stalkBeginM())); set('arcOut', spoke(bOut, stalkOutM()) + spoke(-bOut, stalkOutM()));
    set('grab', ring(c, STALK.grabM)); set('station', ring(station, 0.12));
    set('line', stalkOn(game) === gd ? path(Array.from({ length: 9 }, (_v, i): Vec3 => [pl[0] + (station[0] - pl[0]) * i / 8, FLOOR, pl[2] + (station[2] - pl[2]) * i / 8])) : '');
  }
}
