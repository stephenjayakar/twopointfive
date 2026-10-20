// FINDING YOUR OWN MAN ON THE SCREEN: what the HUD draws for host/findme.ts's one picture setting, and the four rows Options > Game gets for the table.
//   ring     the gold ring an open order menu puts at his feet (ui/planfloor.ts `py`), drawn here whenever that one is not up
// PICTURE ONLY: it reads the player's position and writes nothing, and with the setting off update() returns before it has asked anything.
// SHELVED (2026-10-20), and not here: an outline of him in the dark and his shape through a wall. They were drawn in this overlay from his joints, each limb
// a stroke, and that is not his silhouette — from a squad level's distance an arm was two pixels wide and the 'outline' a stick figure's. The maintainer:
// "it should be a proper silhouette". A proper one is the renderer's to draw, from the pixels that are his (the G-buffer's id target holds the owner of every
// pixel, his kit and gun with him), not this file's.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { PLAN } from '../game/floorplan';
import { FINDME, setFindMe, resetFindMe } from '../host/findme';

/** where the ring would be drawn for the seat's own man (its centre on the floor), null = none: the row off, or he is down */
export function findMeRing(game: Game): Vec3 | null {
  const pl = game.player; if (pl.down || !FINDME.ring) return null;
  return [pl.char.pos[0], 0, pl.char.pos[2]];
}

const NS = 'http://www.w3.org/2000/svg';
const CSS = `
.findme { pointer-events: none; }
.findme .fr { fill: none; stroke: #f2cf6b; stroke-width: 1.5; stroke-linejoin: round; }
`;

export class FindMeViz {
  private g: SVGGElement; private ring: SVGPolygonElement; private shown = false; private points = '';
  constructor(svg: SVGSVGElement) {
    if (!document.getElementById('findme-css')) { const s = document.createElement('style'); s.id = 'findme-css'; s.textContent = CSS; document.head.appendChild(s); }
    this.g = document.createElementNS(NS, 'g') as SVGGElement; this.g.setAttribute('class', 'findme'); this.g.style.display = 'none';
    svg.insertBefore(this.g, svg.firstChild?.nextSibling ?? null);   // (over the squad's plan on the floor, under everything else the overlay draws)
    this.ring = document.createElementNS(NS, 'polygon') as SVGPolygonElement; this.ring.setAttribute('class', 'fr'); this.g.appendChild(this.ring);
  }
  private show(on: boolean) { if (on !== this.shown) { this.shown = on; this.g.style.display = on ? 'block' : 'none'; } }
  /** `planRing`: the order menu's own gold ring is drawn this frame (planfloor.ts `youOn`): ours stands down under it */
  update(game: Game, cam: FollowCamera, w: number, h: number, planRing = false) {
    const bc = document.body.classList;
    if (!FINDME.ring || planRing || bc.contains('blinded') || bc.contains('attract')) { this.show(false); return; }   // (nothing asked; and under a stun's white-out or attract mode as the plan on the floor)
    const at = findMeRing(game); if (!at) { this.show(false); return; }
    const r = PLAN.ringM * 1.35, N = 48, out: string[] = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, [x, y, v] = cam.project([at[0] + Math.sin(a) * r, 0.04, at[2] + Math.cos(a) * r], w, h, Infinity, 0.5); if (!v) { this.show(false); return; } out.push(`${x.toFixed(1)},${y.toFixed(1)}`); }
    const pts = out.join(' '); if (pts !== this.points) { this.points = pts; this.ring.setAttribute('points', pts); }   // (written only when it moved: a man standing still under a still camera costs the page nothing)
    this.show(true);
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
/** the four rows under two headings; returns what Reset does for them */
export function findMeRows(K: RowKit, body: HTMLElement): () => void {
  K.sec(body, 'Finding yourself · trying out');
  K.flip(body, 'Ring at your feet', () => FINDME.ring, v => setFindMe('ring', v), 'The gold ring the orders menu puts at your feet, there all the time.', ['On', 'Off']);
  K.sec(body, 'Camera · trying out');
  K.range(body, 'Aim pan', 0, 100, 10, () => Math.round(FINDME.pan * 100), v => setFindMe('pan', v / 100), v => v ? `${v.toFixed(0)} %` : 'None', 'How far the view leans toward where you aim. At none you stay in the middle of the screen.');
  K.seg(body, 'Turn direction', TURNS, () => FINDME.turn < 0 ? 'rev' : 'as', v => setFindMe('turn', v === 'rev' ? -1 : 1), () => 'Which way the view turns when you hold Ctrl and move the mouse.');
  K.flip(body, 'Double tap Ctrl', () => FINDME.behind, v => setFindMe('behind', v), 'Tap Ctrl twice and the view turns to put what you are facing ahead of you.', ['On', 'Off']);
  return resetFindMe;
}
