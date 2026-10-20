// FINDING YOUR OWN MAN ON THE SCREEN: what the HUD draws for host/findme.ts's three picture settings, and the six rows Options > Game gets for the table.
//   ring     the gold ring an open order menu puts at his feet (ui/planfloor.ts `py`), drawn here whenever that one is not up
//   outline  a faint rim round his figure, coming up as the light on him goes down (the light meter's own number: nothing new is measured)
//   shape    his figure, faint and rimmed, through whatever stands between the eye and him: a wall, a door leaf, furniture (glass and the ceilings the
//            camera already looks through do not count) — as strong as the share of him that is hidden
// The figure is his own joints (character.ts `bones`, the ones the head marks and the bubbles stand on) joined by round-ended strokes as wide as the limb,
// in the overlay's SVG; the rim is that shape grown by a pixel and a half with the shape itself cut out (one SVG filter over a box round him). So it is
// the HUD's picture of where he is, not the renderer's of what he looks like: no shader, no pass, no pipeline, nothing a quality tier changes.
// PICTURE ONLY: it reads the player's position, joints and light number and asks the level four sight lines from the eye; it writes nothing, and with the
// three settings off update() returns before it has asked anything. findMeLook is kept apart from the DOM so a headless check can ask what would be drawn.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { BoxFlag } from '../scene/boxes';
import { PLAN } from '../game/floorplan';
import { FINDME, setFindMe, resetFindMe } from '../host/findme';

/** the look: the light number at and under which the outline is at its full, and at and over which there is none; the rim's opacity at full dark and over a
 *  man wholly hidden; the hidden shape's fill; the rim's width (px); the limbs' widths (m) */
export const FINDME_LOOK = { darkFull: 0.12, darkNone: 0.3, rim: 0.5, rimHid: 0.85, fill: 0.2, rimPx: 1.5, torsoM: 0.34, headM: 0.22, armM: 0.11, legM: 0.15 };

export interface FindMeLook { /** the ring's centre on the floor, null = no ring */ ring: Vec3 | null; /** the rim's opacity */ rim: number; /** the shape's own */ fill: number; /** the share of him the eye cannot see, 0‥1 (asked only with `shape` on) */ hid: number; /** how dark he stands, 0‥1 (asked only with `outline` on) */ dark: number }
const NONE: FindMeLook = { ring: null, rim: 0, fill: 0, hid: 0, dark: 0 };
/** what would be drawn for the seat's own man, seen from `eye` */
export function findMeLook(game: Game, eye: Vec3): FindMeLook {
  const pl = game.player;
  if (pl.down || !(FINDME.ring || FINDME.outline || FINDME.shape)) return NONE;
  const p = pl.char.pos, B = pl.char.bones, L = FINDME_LOOK;
  const dark = FINDME.outline ? Math.max(0, Math.min(1, (L.darkNone - pl.visibility) / (L.darkNone - L.darkFull))) : 0;
  let hid = 0;
  if (FINDME.shape) {
    const at = (b: Vec3 | undefined, y: number): Vec3 => b ?? [p[0], p[1] + y, p[2]], sL = B.shinL, sR = B.shinR;
    const pts = [at(B.headTop, 1.75), at(B.chest, 1.3), at(B.hips, 0.95), sL && sR ? [(sL[0] + sR[0]) / 2, (sL[1] + sR[1]) / 2, (sL[2] + sR[2]) / 2] as Vec3 : at(undefined, 0.45)];
    for (const q of pts) if (game.col.segmentBlocked(eye, q, 0.02, BoxFlag.Glass | BoxFlag.NoPrimary)) hid += 1 / pts.length;
  }
  return { ring: FINDME.ring ? [p[0], 0, p[2]] : null, rim: Math.max(L.rim * dark, FINDME.shape ? L.rimHid * hid : 0), fill: L.fill * hid, hid, dark };
}

/** the figure as strokes: [the stroke's width key, the joints it runs through] */
const LIMBS: [keyof typeof FINDME_LOOK, string[]][] = [
  ['torsoM', ['hips', 'spine2', 'chest', 'neck']],
  ['headM', ['head', 'headTop']],
  ['armM', ['handL', 'forearmL', 'upperArmL', 'upperArmR', 'forearmR', 'handR']],
  ['legM', ['toeL', 'footL', 'shinL', 'thighL', 'thighR', 'shinR', 'footR', 'toeR']],
];
const NS = 'http://www.w3.org/2000/svg';
const CSS = `
.findme { color: var(--h-hi, #f0e9d9); pointer-events: none; }
.findme .fr { fill: none; stroke: #f2cf6b; stroke-width: 1.5; stroke-linejoin: round; }
.findme path { fill: none; stroke: currentColor; stroke-linecap: round; stroke-linejoin: round; }
.findme feFlood { flood-color: var(--h-hi, #f0e9d9); }
`;

export class FindMeViz {
  private g: SVGGElement; private ring: SVGPolygonElement; private paths: SVGPathElement[] = []; private fill: SVGUseElement; private rim: SVGUseElement; private filter: SVGFilterElement;
  private k = { rim: 0, fill: 0 }; private at = 0; private was = new Map<Element, Record<string, string>>();
  constructor(svg: SVGSVGElement) {
    if (!document.getElementById('findme-css')) { const s = document.createElement('style'); s.id = 'findme-css'; s.textContent = CSS; document.head.appendChild(s); }
    const mk = <K extends keyof SVGElementTagNameMap>(parent: Element, tag: K, attrs: Record<string, string> = {}): SVGElementTagNameMap[K] => { const e = document.createElementNS(NS, tag) as SVGElementTagNameMap[K]; for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
    this.g = document.createElementNS(NS, 'g') as SVGGElement; this.g.setAttribute('class', 'findme'); this.put(this.g, 'display', 'none');
    svg.insertBefore(this.g, svg.firstChild?.nextSibling ?? null);   // (over the squad's plan on the floor, under everything else the overlay draws)
    const defs = mk(this.g, 'defs'), body = mk(defs, 'g', { id: 'findme-body' });
    for (let i = 0; i < LIMBS.length; i++) this.paths.push(mk(body, 'path'));
    this.filter = mk(defs, 'filter', { id: 'findme-rim', filterUnits: 'userSpaceOnUse', 'color-interpolation-filters': 'sRGB' });
    mk(this.filter, 'feMorphology', { in: 'SourceAlpha', operator: 'dilate', radius: String(FINDME_LOOK.rimPx), result: 'big' });
    mk(this.filter, 'feComposite', { in: 'big', in2: 'SourceAlpha', operator: 'out', result: 'edge' });
    mk(this.filter, 'feFlood', { result: 'ink' });
    mk(this.filter, 'feComposite', { in: 'ink', in2: 'edge', operator: 'in' });
    this.ring = mk(this.g, 'polygon', { class: 'fr' });
    this.fill = mk(this.g, 'use', { class: 'ff', href: '#findme-body' });
    this.rim = mk(this.g, 'use', { class: 'fo', href: '#findme-body', filter: 'url(#findme-rim)' });
  }
  /** an attribute (`display` / `opacity`: the style), written only when it changed — a man standing still under a still camera costs the page nothing */
  private put(e: SVGElement, k: string, v: string) {
    let c = this.was.get(e); if (!c) this.was.set(e, c = {});
    if (c[k] === v) return; c[k] = v;
    if (k === 'display') e.style.display = v; else if (k === 'opacity') e.style.opacity = v; else e.setAttribute(k, v);
  }
  /** `planRing`: the order menu's own gold ring is drawn this frame (planfloor.ts `youOn`): ours stands down under it */
  update(game: Game, cam: FollowCamera, w: number, h: number, planRing = false) {
    const bc = document.body.classList;
    if (!(FINDME.ring || FINDME.outline || FINDME.shape) || bc.contains('blinded') || bc.contains('attract')) { this.put(this.g, 'display', 'none'); this.k.rim = this.k.fill = 0; return; }   // (nothing asked: the three off, and under a stun's white-out or attract mode as the plan on the floor)
    const L = findMeLook(game, cam.pos), now = performance.now(), e = Math.min(1, Math.max(0, now - this.at) / 1000 * 10); this.at = now;
    this.k.rim += (L.rim - this.k.rim) * e; this.k.fill += (L.fill - this.k.fill) * e;   // (a wall coming between eye and man brings the shape up over a tenth of a second or two, not in one frame)
    const f1 = (v: number) => v.toFixed(1);
    // the ring: the order menu's own, wherever that one is not up
    let ring = '';
    if (L.ring && !planRing) {
      const r = PLAN.ringM * 1.35, N = 48, out: string[] = [];
      for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, [x, y, v] = cam.project([L.ring[0] + Math.sin(a) * r, 0.04, L.ring[2] + Math.cos(a) * r], w, h, Infinity, 0.5); if (!v) { out.length = 0; break; } out.push(`${f1(x)},${f1(y)}`); }
      ring = out.join(' ');
    }
    this.put(this.ring, 'display', ring ? 'block' : 'none'); if (ring) this.put(this.ring, 'points', ring);
    // the figure
    let body = this.k.rim > 0.01 || this.k.fill > 0.01;
    if (body) {
      const B = game.player.char.bones, hips = B.hips ?? game.player.char.pos, R = cam.planarBasis().right;
      const a = cam.project(hips, w, h, Infinity, 0.5), b = cam.project([hips[0] + R[0], hips[1], hips[2] + R[2]], w, h, Infinity, 0.5), pxM = Math.hypot(b[0] - a[0], b[1] - a[1]);   // (pixels a metre covers where he stands)
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const ds: string[] = []; body = a[2] && b[2] && pxM > 1;
      for (let i = 0; body && i < LIMBS.length; i++) {
        let d = '';
        for (const name of LIMBS[i][1]) { const q = B[name]; if (!q) continue; const [x, y, v] = cam.project(q, w, h, Infinity, 0.5); if (!v) { body = false; break; } d += `${d ? 'L' : 'M'}${f1(x)},${f1(y)}`; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
        if (d && !d.includes('L')) d += `L${d.slice(1)}`;   // (a lone joint is a dot as wide as its limb)
        ds.push(d);
      }
      if (body && x1 >= x0) {   // (written only once every joint is known to be in front of the eye: half a figure is never left standing)
        for (let i = 0; i < LIMBS.length; i++) { this.put(this.paths[i], 'd', ds[i]); this.put(this.paths[i], 'stroke-width', f1(FINDME_LOOK[LIMBS[i][0]] * pxM)); }
        const pad = FINDME_LOOK.torsoM * pxM / 2 + FINDME_LOOK.rimPx + 3;
        this.put(this.filter, 'x', f1(x0 - pad)); this.put(this.filter, 'y', f1(y0 - pad)); this.put(this.filter, 'width', f1(x1 - x0 + 2 * pad)); this.put(this.filter, 'height', f1(y1 - y0 + 2 * pad));
        this.put(this.fill, 'opacity', this.k.fill.toFixed(2)); this.put(this.rim, 'opacity', this.k.rim.toFixed(2));
      } else body = false;
    }
    this.put(this.fill, 'display', body && this.k.fill > 0.01 ? 'block' : 'none'); this.put(this.rim, 'display', body && this.k.rim > 0.01 ? 'block' : 'none');
    this.put(this.g, 'display', ring || body ? 'block' : 'none');
  }
}

// ---- the rows (ui/options.ts, GAME tab): the screen's own row makers handed in, so the rows look and key as every other row there
export interface RowKit {
  sec(parent: HTMLElement, text: string): unknown;
  flip(parent: HTMLElement, label: string, get: () => boolean, set: (v: boolean) => void, describe: string, words?: [string, string]): void;
  seg<T extends string>(parent: HTMLElement, label: string, opts: { v: T; label: string; line?: string }[], get: () => T, set: (v: T) => void, describe: () => string): void;
  range(parent: HTMLElement, label: string, min: number, max: number, step: number, get: () => number, set: (v: number) => void, fmt: (v: number) => string, describe: string): void;
}
const TURNS: { v: 'as' | 'rev'; label: string }[] = [{ v: 'as', label: 'Normal' }, { v: 'rev', label: 'Reversed' }];
/** the six rows under two headings; returns what Reset does for them */
export function findMeRows(K: RowKit, body: HTMLElement): () => void {
  K.sec(body, 'Finding yourself · trying out');
  K.flip(body, 'Ring at your feet', () => FINDME.ring, v => setFindMe('ring', v), 'The gold ring the orders menu puts at your feet, there all the time.', ['On', 'Off']);
  K.flip(body, 'Outline in the dark', () => FINDME.outline, v => setFindMe('outline', v), 'A faint line round you once the light on you is low. Only you see it.', ['On', 'Off']);
  K.flip(body, 'Shape through walls', () => FINDME.shape, v => setFindMe('shape', v), 'Your shape, shown through a wall or furniture that stands between you and the camera. Only you see it.', ['On', 'Off']);
  K.sec(body, 'Camera · trying out');
  K.range(body, 'Aim pan', 0, 100, 10, () => Math.round(FINDME.pan * 100), v => setFindMe('pan', v / 100), v => v ? `${v.toFixed(0)} %` : 'None', 'How far the view leans toward where you aim. At none you stay in the middle of the screen.');
  K.seg(body, 'Turn direction', TURNS, () => FINDME.turn < 0 ? 'rev' : 'as', v => setFindMe('turn', v === 'rev' ? -1 : 1), () => 'Which way the view turns when you hold Ctrl and move the mouse.');
  K.flip(body, 'Double tap Ctrl', () => FINDME.behind, v => setFindMe('behind', v), 'Tap Ctrl twice and the view turns to put what you are facing ahead of you.', ['On', 'Off']);
  return resetFindMe;
}
