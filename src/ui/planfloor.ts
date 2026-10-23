// The squad's plan drawn on the floor (game/floorplan.ts says WHAT; this file draws it): per man of ours with a mark — the dotted way he will walk, a ring
// where he will stand with his two-letter tag, a fan for what he watches, a thin line to the door he is on — in his pair's colour (the HUD's green for a
// squad with no pairs), and a ring at the feet of each man an open order menu goes to (and a gold one at the feet of whoever's menu it is). Floor geometry projected through the camera into the overlay's SVG,
// under the close-in windows and the throw arc; drawn through walls (it is our own plan). Something waiting on the player's key has a bar across its
// doorway (along its wall's foot), and the key on the one the key would send now. No words but that key and the tags.
// index.html `.plan …` is the look; `PLAN.on` false (`?noplan`) = the group stays empty. An attribute is written only when it changes.
import type { Game, Guard } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { floorPlan, PLAN, capOf, type PlanKept, type PlanLeg } from '../game/floorplan';

const NS = 'http://www.w3.org/2000/svg';
const Y = 0.04;          // just off the floor
const RING_N = 48, FAN_N = 5;   // (a ring is a floor circle through the camera: enough points that no corner shows at any zoom)
const NEAR_W = 0.5;      // a point this near the camera's own plane (or behind it) is not drawn: its projection is anywhere
const TAG_DROP = 15;     // px: a standing man's tag sits under his ring, clear of his body
/** each man's kept legs and the tables the grid is searched on (game/floorplan.ts PlanKept): the PICTURE'S own — a game drawn and the same game not
 *  drawn hold the same state */
const keptLegs = new WeakMap<Guard, PlanLeg[]>();
const kept: PlanKept = { get: gd => keptLegs.get(gd), set: (gd, L) => keptLegs.set(gd, L), nav: {} };

interface ManEls { g: SVGGElement; way: SVGPathElement; mark: SVGPolygonElement; fan: SVGPolygonElement; sight: SVGLineElement; feet: SVGPolygonElement; tag: SVGTextElement }
interface ThrowEls { g: SVGGElement; reach: SVGPolygonElement; walk: SVGPathElement; spot: SVGPolygonElement; who: SVGPolygonElement; arc: SVGPathElement; land: SVGPolygonElement; tag: SVGTextElement }
interface DoorEls { g: SVGGElement; bar: SVGLineElement; cap: SVGRectElement; key: SVGTextElement }
interface LaidEls { g: SVGGElement; ways: SVGPathElement[]; feet: SVGPolygonElement[]; spot: SVGPolygonElement; bar: SVGLineElement; cap: SVGRectElement; key: SVGTextElement }

export class PlanFloor {
  private g: SVGGElement;
  private men: ManEls[] = []; private menShown = 0;
  private who: SVGPolygonElement[] = []; private whoShown = 0;
  private you: SVGPolygonElement | null = null;
  /** the gold ring at the seat's own man is drawn this frame (ui/findme.ts stands its always-on ring down under it) */
  youOn = false;
  private doors: DoorEls[] = []; private doorsShown = 0;
  private throws: ThrowEls[] = []; private throwsShown = 0;
  private laid: LaidEls[] = []; private laidShown = 0;
  private was = new WeakMap<Element, Record<string, string>>();
  constructor(svg: SVGSVGElement) {
    this.g = document.createElementNS(NS, 'g') as SVGGElement; this.g.setAttribute('class', 'plan');
    svg.insertBefore(this.g, svg.firstChild);   // the floor's plan first: everything else of the overlay's SVG draws over it
  }
  /** an attribute (`k` 'display' / 'opacity': the style), written only when it changed */
  private put(e: SVGElement, k: string, v: string) {
    let c = this.was.get(e); if (!c) this.was.set(e, c = {});
    if (c[k] === v) return; c[k] = v;
    if (k === 'display') e.style.display = v; else if (k === 'opacity') e.style.opacity = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
  }
  private show(e: SVGElement, on: boolean) { this.put(e, 'display', on ? 'block' : 'none'); }
  private el<K extends keyof SVGElementTagNameMap>(parent: SVGElement, tag: K, cls: string): SVGElementTagNameMap[K] {
    const e = document.createElementNS(NS, tag) as SVGElementTagNameMap[K]; this.put(e, 'class', cls); this.show(e, false); parent.appendChild(e); return e;
  }
  private manEls(i: number): ManEls {
    let m = this.men[i];
    if (!m) {
      const g = document.createElementNS(NS, 'g') as SVGGElement; this.g.appendChild(g);
      m = { g, fan: this.el(g, 'polygon', 'pf'), sight: this.el(g, 'line', 'pl'), way: this.el(g, 'path', 'pp'), mark: this.el(g, 'polygon', 'pm'), feet: this.el(g, 'polygon', 'pw'), tag: this.el(g, 'text', 'pt') };
      m.tag.setAttribute('text-anchor', 'middle'); m.tag.setAttribute('dominant-baseline', 'middle');
      this.men[i] = m;
    }
    return m;
  }
  private throwEls(i: number): ThrowEls {
    let E = this.throws[i];
    if (!E) {
      const g = document.createElementNS(NS, 'g') as SVGGElement; this.g.appendChild(g);
      E = { g, reach: this.el(g, 'polygon', 'pr'), walk: this.el(g, 'path', 'pp'), spot: this.el(g, 'polygon', 'pm'), who: this.el(g, 'polygon', 'pw thr'), arc: this.el(g, 'path', 'pa'), land: this.el(g, 'polygon', 'pe'), tag: this.el(g, 'text', 'pt') };
      E.tag.setAttribute('text-anchor', 'middle'); E.tag.setAttribute('dominant-baseline', 'middle');
      this.throws[i] = E;
    }
    return E;
  }
  private capSetup(E: { cap: SVGRectElement; key: SVGTextElement }) { E.key.setAttribute('text-anchor', 'middle'); E.key.setAttribute('dominant-baseline', 'central'); E.cap.setAttribute('rx', '2.5'); E.cap.setAttribute('width', '15'); E.cap.setAttribute('height', '15'); }
  private doorEls(i: number): DoorEls {
    let E = this.doors[i];
    if (!E) {
      const g = document.createElementNS(NS, 'g') as SVGGElement; this.g.appendChild(g);
      E = { g, bar: this.el(g, 'line', 'pd'), cap: this.el(g, 'rect', 'pk'), key: this.el(g, 'text', 'pkt') };
      this.capSetup(E);
      this.doors[i] = E;
    }
    return E;
  }
  private laidEls(i: number): LaidEls {
    let E = this.laid[i];
    if (!E) {
      const g = document.createElementNS(NS, 'g') as SVGGElement; this.g.appendChild(g);
      E = { g, ways: [], feet: [], spot: this.el(g, 'polygon', 'pm'), bar: this.el(g, 'line', 'pd'), cap: this.el(g, 'rect', 'pk'), key: this.el(g, 'text', 'pkt') };
      this.capSetup(E);
      this.laid[i] = E;
    }
    return E;
  }
  update(game: Game, cam: FollowCamera, w: number, h: number) {
    const bc = document.body.classList, P = PLAN.on && !(bc.contains('blinded') || bc.contains('attract')) ? floorPlan(game, kept) : null;   // (hidden by the page under those: nothing asked)
    let n = 0, k = 0, nd = 0, nt = 0, nl = 0, you = false;
    if (P) {
      const f1 = (v: number) => v.toFixed(1);
      const px = (x: number, z: number): [number, number] | null => { const [sx, sy, v] = cam.project([x, Y, z], w, h, Infinity, NEAR_W); return v ? [sx, sy] : null; };
      const pt = (x: number, z: number): string | null => { const q = px(x, z); return q ? `${f1(q[0])},${f1(q[1])}` : null; };
      const ring = (c: Vec3, r: number, N = RING_N): string | null => {
        const out: string[] = [];
        for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, s = pt(c[0] + Math.sin(a) * r, c[2] + Math.cos(a) * r); if (!s) return null; out.push(s); }
        return out.join(' ');
      };
      const half = PLAN.sectorDeg * Math.PI / 180;
      for (const m of P.men) {
        const E = this.manEls(n++); this.show(E.g, true);
        this.put(E.g, 'class', m.tone ? `t-${m.tone}` : '');
        const fresh = Math.max(0, 1 - m.age / Math.max(0.1, PLAN.freshSecs));
        const walking = !m.there && m.path.length > 1;
        const k0 = (m.held ? 0.6 : 1) * (walking ? PLAN.walkDim + (1 - PLAN.walkDim) * fresh : PLAN.restDim + (1 - PLAN.restDim) * fresh);
        this.put(E.g, 'opacity', (P.mode ? k0 : k0 * Math.min(1, fresh / 0.4)).toFixed(2));   // (outside the order mode an order just given goes out with its age)
        const c = px(m.mark[0], m.mark[2]);
        // the way: broken, never bridged, where a point of it cannot be projected
        let d = '';
        if (walking) { let pen = false, segs = 0; for (const q of m.path) { const s = pt(q[0], q[2]); if (!s) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${s}`; if (pen) segs++; pen = true; } if (!segs) d = ''; }
        this.show(E.way, !!d); if (d) this.put(E.way, 'd', d);
        // the mark
        const mr = PLAN.marks ? ring(m.mark, PLAN.ringM) : null;
        this.show(E.mark, !!mr); if (mr) { this.put(E.mark, 'points', mr); this.put(E.mark, 'class', m.there ? 'pm there' : 'pm'); }
        // what he watches: a fan from the mark; a thin line on to the point while the order is fresh, and to his door for as long as he is on it
        let fan: string | null = null;
        if (m.aim !== null && c) {
          const a: string[] = [`${f1(c[0])},${f1(c[1])}`];
          for (let i = 0; i <= FAN_N; i++) { const y = m.aim - half + (2 * half * i) / FAN_N, s = pt(m.mark[0] + Math.sin(y) * PLAN.sectorM, m.mark[2] + Math.cos(y) * PLAN.sectorM); if (s) a.push(s); }
          if (a.length === FAN_N + 2) fan = a.join(' ');
        }
        this.show(E.fan, !!fan); if (fan) { this.put(E.fan, 'points', fan); this.put(E.fan, 'class', m.there ? 'pf there' : 'pf'); }
        const b = m.watch && c && (fresh > 0 || m.onDoor) ? px(m.watch[0], m.watch[2]) : null;
        this.show(E.sight, !!b); if (b && c) { this.put(E.sight, 'x1', f1(c[0])); this.put(E.sight, 'y1', f1(c[1])); this.put(E.sight, 'x2', f1(b[0])); this.put(E.sight, 'y2', f1(b[1])); }
        // who: a ring at his feet while the order is fresh and he has somewhere to go
        const fr = walking && fresh > 0 && PLAN.who ? ring(m.path[0], PLAN.ringM * 1.35) : null;
        this.show(E.feet, !!fr); if (fr) { this.put(E.feet, 'points', fr); this.put(E.feet, 'opacity', fresh.toFixed(2)); }
        // his tag: in the ring he is walking to, under the ring he stands in
        const tag = PLAN.tags && !!m.tag && !!c;
        this.show(E.tag, tag); if (tag && c) { this.put(E.tag, 'x', f1(c[0])); this.put(E.tag, 'y', f1(c[1] + (m.there ? TAG_DROP : 0))); this.put(E.tag, 'text', m.tag); this.put(E.tag, 'class', m.there ? 'pt there' : 'pt'); }
      }
      for (const q of P.who) {
        const r = ring(q.at, PLAN.ringM * 1.35); if (!r) continue;
        let e = this.who[k]; if (!e) { e = this.el(this.g, 'polygon', 'pw'); this.who[k] = e; }
        k++; this.show(e, true); this.put(e, 'points', r); this.put(e, 'class', q.tone ? `pw t-${q.tone}` : 'pw');
      }
      // … and the one whose menu it is: the same ring, gold
      const yr = P.you ? ring(P.you, PLAN.ringM * 1.35) : null;
      if (yr) { if (!this.you) this.you = this.el(this.g, 'polygon', 'py t-gold'); this.put(this.you, 'points', yr); you = true; }
      // a teammate's throw: who (a filled ring at his feet), his way to where he throws from, the arc in the air, where it comes to rest, a frag's reach
      const way = (pts: Vec3[], air: boolean): string => {
        let d = '', pen = false, segs = 0;
        for (const q of pts) { const v = air ? cam.project([q[0], Math.max(q[1], Y), q[2]], w, h, Infinity, NEAR_W) : null, s = air ? (v![2] ? `${f1(v![0])},${f1(v![1])}` : null) : pt(q[0], q[2]); if (!s) { pen = false; continue; } d += `${pen ? 'L' : 'M'}${s}`; if (pen) segs++; pen = true; }
        return segs ? d : '';
      };
      for (const T of P.throws) {
        const E = this.throwEls(nt++); this.show(E.g, true);
        this.put(E.g, 'class', T.tone ? `t-${T.tone}` : ''); this.put(E.g, 'opacity', T.preview ? '0.60' : '0.95');
        const poly = (e: SVGPolygonElement, s: string | null) => { this.show(e, !!s); if (s) this.put(e, 'points', s); };
        const p = T.gd.char.pos, walking = T.walk.length > 1;
        poly(E.who, PLAN.who ? ring(p, PLAN.ringM * 1.35) : null);
        const dw = walking ? way(T.walk, false) : ''; this.show(E.walk, !!dw); if (dw) this.put(E.walk, 'd', dw);
        poly(E.spot, walking && PLAN.marks ? ring(T.from, PLAN.ringM) : null);
        const c = walking && PLAN.tags && T.tag ? px(T.from[0], T.from[2]) : null;
        this.show(E.tag, !!c); if (c) { this.put(E.tag, 'x', f1(c[0])); this.put(E.tag, 'y', f1(c[1])); this.put(E.tag, 'text', T.tag); }
        const da = way(T.arc, true); this.show(E.arc, !!da); if (da) this.put(E.arc, 'd', da);
        poly(E.land, ring(T.land, PLAN.ringM));
        poly(E.reach, T.reach > 0 ? ring(T.land, T.reach, RING_N * 2) : null);
      }
      // waiting on the key: a bar across the doorway, the key on the one the key would send now (a quiet pair's man waits on open ground: under PLAN.keyLit
      // the key alone, a step ahead of him — a bar there crossed the cap and read as a key struck out)
      for (const dr of P.doors) {
        const a = px(dr.a[0], dr.a[2]), b = px(dr.b[0], dr.b[2]); if (!a || !b) continue;
        const E = this.doorEls(nd++), c = capOf(dr); this.show(E.g, true);
        this.put(E.g, 'class', `pdoor w-${dr.why}${dr.tone ? ` t-${dr.tone}` : ''}${dr.now ? ' now' : ''}${c === 'lit' ? ' lit live' : c === 'dark' ? ' lit' : ''}`);
        this.show(E.bar, dr.why !== 'pair' || !PLAN.keyLit); this.put(E.bar, 'x1', f1(a[0])); this.put(E.bar, 'y1', f1(a[1])); this.put(E.bar, 'x2', f1(b[0])); this.put(E.bar, 'y2', f1(b[1]));
        const cap = c !== 'none', mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        this.show(E.cap, cap); this.show(E.key, cap);
        if (cap) { this.put(E.cap, 'x', f1(mx - 7.5)); this.put(E.cap, 'y', f1(my - 7.5)); this.put(E.key, 'x', f1(mx)); this.put(E.key, 'y', f1(my)); this.put(E.key, 'text', dr.key!); }
      }
      // a plan laid for the word (planlay.ts): each man's way from his feet, broken wide, a ring at his feet, the door's bar or the spot's ring, the key on it
      for (const L of P.laid) {
        const E = this.laidEls(nl++); this.show(E.g, true);
        this.put(E.g, 'class', `laid${L.tone ? ` t-${L.tone}` : ''}`); this.put(E.g, 'opacity', L.k.toFixed(2));
        for (let i = 0; i < Math.max(L.ways.length, E.ways.length); i++) {
          const e = E.ways[i] ?? (E.ways[i] = E.g.insertBefore(this.el(E.g, 'path', 'pp'), E.g.firstChild)), d = i < L.ways.length ? way(L.ways[i], false) : '';
          this.show(e, !!d); if (d) this.put(e, 'd', d);
        }
        for (let i = 0; i < Math.max(L.feet.length, E.feet.length); i++) {
          const e = E.feet[i] ?? (E.feet[i] = this.el(E.g, 'polygon', 'pw')), r = i < L.feet.length && PLAN.who ? ring(L.feet[i], PLAN.ringM * 1.35) : null;
          this.show(e, !!r); if (r) this.put(e, 'points', r);
        }
        const a = L.a && L.b ? px(L.a[0], L.a[2]) : null, b = L.a && L.b ? px(L.b[0], L.b[2]) : null, bar = !!a && !!b;
        this.show(E.bar, bar); if (a && b) { this.put(E.bar, 'x1', f1(a[0])); this.put(E.bar, 'y1', f1(a[1])); this.put(E.bar, 'x2', f1(b[0])); this.put(E.bar, 'y2', f1(b[1])); }
        const sr = !bar && L.at && PLAN.marks ? ring(L.at, PLAN.ringM) : null;
        this.show(E.spot, !!sr); if (sr) this.put(E.spot, 'points', sr);
        const c = a && b ? [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] : L.at ? px(L.at[0], L.at[2]) : L.feet[0] ? px(L.feet[0][0], L.feet[0][2]) : null, cap = !!c && PLAN.word;
        this.show(E.cap, cap); this.show(E.key, cap);
        if (cap && c) { const dy = bar || L.at ? 0 : TAG_DROP + 4; this.put(E.cap, 'x', f1(c[0] - 7.5)); this.put(E.cap, 'y', f1(c[1] + dy - 7.5)); this.put(E.key, 'x', f1(c[0])); this.put(E.key, 'y', f1(c[1] + dy)); this.put(E.key, 'text', L.key); }
      }
    }
    for (let i = nl; i < this.laidShown; i++) this.show(this.laid[i].g, false);
    this.laidShown = nl;
    for (let i = nd; i < this.doorsShown; i++) this.show(this.doors[i].g, false);
    for (let i = nt; i < this.throwsShown; i++) this.show(this.throws[i].g, false);
    for (let i = n; i < this.menShown; i++) this.show(this.men[i].g, false);
    for (let i = k; i < this.whoShown; i++) this.show(this.who[i], false);
    this.doorsShown = nd; this.throwsShown = nt; this.menShown = n; this.whoShown = k;
    if (this.you) this.show(this.you, you);
    this.youOn = you;
  }
}
