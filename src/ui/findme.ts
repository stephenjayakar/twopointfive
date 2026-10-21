// FINDING YOUR OWN MAN ON THE SCREEN: what the page draws for host/findme.ts's two picture settings, and the six rows Options > Game gets for the table.
//   ring     the gold ring an open order menu puts at his feet (ui/planfloor.ts `py`), drawn here whenever that one is not up
//   outline  not drawn here: findMeOutline() fills the renderer's frame for it (render/outline.ts — a rim round the pixels that are his, from the g-buffer's
//            id target), with how strongly the light meter says to draw it and where he stands
// PICTURE ONLY: both read the player's position and his light and write nothing of the game's, and with a setting off its half returns before it has asked
// anything.
// THE FIGURE THAT WAS HERE (until 2026-10-20): the outline and his shape through a wall were drawn in this overlay from his joints, each limb a stroke, and
// that is not his silhouette — from a squad level's distance an arm was two pixels wide and the 'outline' a stick figure's. The maintainer: "it should be a
// proper silhouette". The outline is the renderer's now. His shape through a wall is SHELVED until that one has been seen on a GPU: it needs him drawn a
// second time without the walls, which is a pass of its own.
import type { Game } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { PLAN } from '../game/floorplan';
import { FINDME, FINDME_WIDTH, setFindMe, resetFindMe, outlineWant, OUTLINE_LOOK } from '../host/findme';
import type { OutlineFrame } from '../render/outline';

/** where the ring would be drawn for the seat's own man (its centre on the floor), null = none: the row off, or he is down */
export function findMeRing(game: Game): Vec3 | null {
  const pl = game.player; if (pl.down || !FINDME.ring) return null;
  return [pl.char.pos[0], 0, pl.char.pos[2]];
}

/** the outline's frame for this frame (render/outline.ts), written in place: off unless the row is on, he is up and `shown` (the page says no where no
 *  mark of his is drawn: a stun's white-out, attract mode, the kit's picture); else whose pixels, where he stands, how wide (the width row) and how strong — the light meter's
 *  word, eased over `dt` (a frame with no time in it, the world held under a card, takes the word whole: the row flipped in Options shows at once) */
export function findMeOutline(F: OutlineFrame, game: Game, dt: number, shown = true) {
  const pl = game.player;
  if (!FINDME.outline || pl.down || !shown) { F.on = false; F.strength = 0; return; }
  const L = OUTLINE_LOOK, want = outlineWant(pl.visibility, pl.nvAmount), p = pl.char.pos;
  F.on = true; F.owner = pl.char.id; F.strength = dt > 0 ? F.strength + (want - F.strength) * Math.min(1, dt * L.ease) : want;
  F.at[0] = p[0]; F.at[1] = p[1]; F.at[2] = p[2]; F.reach = L.reachM; F.top = L.topM; F.wide = FINDME.width;
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
/** the six rows under two headings; returns what Reset does for them */
export function findMeRows(K: RowKit, body: HTMLElement): () => void {
  K.sec(body, 'Finding yourself · trying out');
  K.flip(body, 'Ring at your feet', () => FINDME.ring, v => setFindMe('ring', v), 'The gold ring the orders menu puts at your feet, there all the time.', ['On', 'Off']);
  K.flip(body, 'Outline in the dark', () => FINDME.outline, v => setFindMe('outline', v), 'A pale rim round you when you stand in the dark.', ['On', 'Off']);
  K.range(body, 'Outline width', FINDME_WIDTH.min * 100, FINDME_WIDTH.max * 100, 5, () => Math.round(FINDME.width * 100), v => setFindMe('width', v / 100), v => `${v.toFixed(0)} %`, 'How wide that rim is.');
  K.sec(body, 'Camera · trying out');
  K.range(body, 'Aim pan', 0, 100, 10, () => Math.round(FINDME.pan * 100), v => setFindMe('pan', v / 100), v => v ? `${v.toFixed(0)} %` : 'None', 'How far the view leans toward where you aim. At none you stay in the middle of the screen.');
  K.seg(body, 'Turn direction', TURNS, () => FINDME.turn < 0 ? 'rev' : 'as', v => setFindMe('turn', v === 'rev' ? -1 : 1), () => 'Which way the view turns when you hold Ctrl and move the mouse.');
  K.flip(body, 'Double tap Ctrl', () => FINDME.behind, v => setFindMe('behind', v), 'Tap Ctrl twice and the view turns to put what you are facing ahead of you.', ['On', 'Off']);
  return resetFindMe;
}
