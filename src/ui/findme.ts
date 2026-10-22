// FINDING YOUR OWN MAN ON THE SCREEN (and, by the outline, your teammates): what the page draws for host/findme.ts's two picture settings, and the twelve
// rows Options > Game gets for the table.
//   ring     the gold ring an open order menu puts at his feet (ui/planfloor.ts `py`), drawn here whenever that one is not up
//   outline  not drawn here: findMeOutline() fills the renderer's frame for it (render/outline.ts — a rim round the pixels that are his, from the g-buffer's
//            id target), with how strongly the light meter says to draw it and where he stands, and the same for each teammate by his own light
// PICTURE ONLY: both read where the men stand and the light on them and write nothing of the game's, and with a setting off its half returns before it has asked
// anything.
// THE FIGURE THAT WAS HERE (until 2026-10-20): the outline and his shape through a wall were drawn in this overlay from his joints, each limb a stroke, and
// that is not his silhouette — from a squad level's distance an arm was two pixels wide and the 'outline' a stick figure's. The maintainer: "it should be a
// proper silhouette". The outline is the renderer's now. His shape through a wall is SHELVED until that one has been seen on a GPU: it needs him drawn a
// second time without the walls, which is a pass of its own.
import type { Game, Guard } from '../game/game';
import type { FollowCamera } from '../game/camera';
import type { Vec3 } from '../math/vec';
import { PLAN } from '../game/floorplan';
import { camCap } from '../host/keymap';
import { FINDME, FINDME_WIDTH, FINDME_MATES, setFindMe, resetFindMe, outlineWant, outlineInk, OUTLINE_LOOK } from '../host/findme';
import { makeOutlineMan, type OutlineFrame, type OutlineMan } from '../render/outline';

/** where the ring would be drawn for the seat's own man (its centre on the floor), null = none: the row off, or he is down */
export function findMeRing(game: Game): Vec3 | null {
  const pl = game.player; if (pl.down || !FINDME.ring) return null;
  return [pl.char.pos[0], 0, pl.char.pos[2]];
}

/** one man's part of the outline's frame: where he stands, how wide and in what ink, and how strong — his own light's word, eased over `dt` (a frame
 *  with no time in it, the world held under a card, takes the word whole: a row moved in Options shows at once) */
function outlineMan(M: OutlineMan, pos: Vec3, light: number, nv: number, dt: number, times: number, hue: 'you' | 'red' | 'blue') {
  const L = OUTLINE_LOOK, want = outlineWant(light, nv);
  M.on = true; M.strength = dt > 0 ? M.strength + (want - M.strength) * Math.min(1, dt * L.ease) : want;
  M.at[0] = pos[0]; M.at[1] = pos[1]; M.at[2] = pos[2]; M.reach = L.reachM; M.top = L.topM; M.wide = FINDME.width; M.times = times; M.alpha = FINDME.opacity; outlineInk(M.ink, hue);
}
/** the outline's frame for this frame (render/outline.ts), written in place: off unless the row is on, its width and strength rows are over none, he is
 *  up and `shown` (the page says no where no mark of his is drawn: a stun's white-out, attract mode, the kit's picture); else his own man — whose pixels,
 *  where, how wide, in what ink, how strong — and with him the living men of his squad (SquadOrders.men: the roster, whatever the orders menu is doing),
 *  each by his own light meter, in his pair's colour (red for the red pair; blue for the blue pair, a duo's partner and a squad not in pairs), his rim
 *  covering the teammates' row's share of what the player's does (none = no teammates). A man who has left the list gives his place up. */
export function findMeOutline(F: OutlineFrame, game: Game, dt: number, shown = true) {
  const pl = game.player, pool = F.mates;
  if (!FINDME.outline || !(FINDME.width > 0) || !(FINDME.opacity > 0) || pl.down || !shown) { F.on = false; F.strength = 0; for (const m of pool) { m.on = false; m.strength = 0; m.owner = 0; } return; }
  F.picture = FINDME.picture; F.lit = FINDME.picLit; F.dark = FINDME.picDark; F.whole = Math.max(0, Math.min(1, 1 - pl.nvAmount));   // (by the picture the meter is not asked: only the goggles take the rims out)
  F.owner = pl.char.id; outlineMan(F, pl.char.pos, pl.visibility, pl.nvAmount, dt, 1, 'you');
  const S = game.orders, men = FINDME.mates > 0 ? S.men() : NOBODY;
  for (const m of pool) m.on = false;
  for (const gd of men) {
    let m: OutlineMan | undefined, free: OutlineMan | undefined;
    for (const x of pool) { if (x.owner === gd.char.id) { m = x; break; } if (!x.owner) free ??= x; }
    if (!m) { m = free; if (!m) pool.push(m = makeOutlineMan()); m.owner = gd.char.id; m.strength = 0; }
    outlineMan(m, gd.char.pos, gd.visibility, pl.nvAmount, dt, FINDME.mates, S.pairOf(gd) === 'red' ? 'red' : 'blue');
  }
  for (const m of pool) if (!m.on) { m.strength = 0; m.owner = 0; }
}
const NOBODY: Guard[] = [];

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
const FADES: { v: 'pic' | 'meter'; label: string }[] = [{ v: 'pic', label: 'Picture' }, { v: 'meter', label: 'Light meter' }];
/** the twelve rows under two headings; returns what Reset does for them */
export function findMeRows(K: RowKit, body: HTMLElement): () => void {
  /** a row that is a share shown in per cent, from none (`zero`: 0 reads 'None') to `max` */
  const pct = (label: string, key: 'pan' | 'width' | 'opacity' | 'mates' | 'colour' | (() => 'lit' | 'dark' | 'picLit' | 'picDark'), max: number, step: number, zero: boolean, describe: string) => {
    const k = typeof key === 'string' ? () => key : key;
    K.range(body, label, 0, max, step, () => Math.round(FINDME[k()] * 100), v => setFindMe(k(), v / 100), v => zero && !v ? 'None' : `${v.toFixed(0)} %`, describe); };
  K.sec(body, 'Finding yourself · trying out');
  K.flip(body, 'Ring at your feet', () => FINDME.ring, v => setFindMe('ring', v), 'The gold ring the orders menu puts at your feet, there all the time.', ['On', 'Off']);
  K.flip(body, 'Outline in the dark', () => FINDME.outline, v => setFindMe('outline', v), 'A rim round you, and round each teammate, while he stands in the dark.', ['On', 'Off']);
  pct('Outline width', 'width', FINDME_WIDTH.max * 100, 5, true, 'How wide your rim is.');
  pct('Outline strength', 'opacity', 100, 5, true, 'How strongly the rims are drawn.');
  K.seg(body, 'Outline fades by', FADES, () => FINDME.picture ? 'pic' : 'meter', v => setFindMe('picture', v === 'pic'), () => 'By how dark each part of the man looks on the screen, or by the light meter\'s one number for him.');
  pct('Outline shows under light', () => FINDME.picture ? 'picLit' : 'lit', 100, 2, false, 'A rim starts to show under this much light.');   // (the pair of whichever the row above says: each keeps its own numbers)
  pct('Outline full under light', () => FINDME.picture ? 'picDark' : 'dark', 100, 2, false, 'A rim is at its full under this much light.');
  pct('Teammate outline width', 'mates', FINDME_MATES.max * 100, 10, true, 'How wide the rim round each teammate is, against yours. At none they have no rim.');
  pct('Outline colour', 'colour', 100, 5, true, 'How much colour the rims have: yellow for you, red and blue for your teammates.');
  K.sec(body, 'Camera · trying out');
  pct('Aim pan', 'pan', 100, 10, true, 'How far the view leans toward where you aim. At none you stay in the middle of the screen.');
  K.seg(body, 'Turn direction', TURNS, () => FINDME.turn < 0 ? 'rev' : 'as', v => setFindMe('turn', v === 'rev' ? -1 : 1), () => `Which way the view turns when you hold ${camCap()} and move the mouse.`);
  K.flip(body, `Double tap ${camCap()}`, () => FINDME.behind, v => setFindMe('behind', v), `Tap ${camCap()} twice and the view turns to put what you are facing ahead of you.`, ['On', 'Off']);   // (the camera's key as the board has it: host/keymap.ts camCap)
  return resetFindMe;
}
