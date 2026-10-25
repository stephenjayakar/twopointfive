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
import { FINDME, FINDME_WIDTH, FINDME_MATES, AUTOVIEW, setAutoView, setFindMe, resetFindMe, outlineWant, outlineInk, OUTLINE_LOOK } from '../host/findme';
import { AUTOCAM, AUTOTUNE, AUTO_MODES, AUTO_RANGE, setAutoMode, setAutoTune, autoTuneOwn, resetAutoTune, type AutoKey, type AutoMode } from '../host/autocam';
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
/** THE AUTO CAMERA'S OWN ROWS (host/autocam.ts AUTOCAM.tune): a mode, then every number of it the hand may want — how much the view turns by itself
 *  and how fast, how far the frame leans, how far the zoom travels. Each row reads the table as it stands and writes through setAutoTune, so a mode
 *  chosen moves the rows under it and a row moved is kept over the mode (which stays lit: its line says some of the numbers are the player's own). */
const MODES: { v: AutoMode; label: string; line: string }[] = [
  { v: 'never', label: 'Never', line: 'The camera never turns by itself. It still moves and zooms to frame things.' },
  { v: 'rest', label: 'When you stop', line: 'The camera only turns when you stand still and a wall is hiding you.' },
  { v: 'gentle', label: 'Gentle', line: 'The camera turns when a wall is hiding you, and it leans a little toward a fight. Every turn is slow.' },
  { v: 'free', label: 'Free', line: 'The camera turns as much and as fast as it did when it first shipped.' },
];
const PER_RAD = 180 / Math.PI;
function autoRows(K: RowKit, body: HTMLElement) {
  /** a number's row: the slider's range is the table's own (AUTO_RANGE) in the row's unit, and a notch is the value nearest it — so the notch the
   *  mode's own number shows as puts back the mode's own number, not the notch's */
  const num = (label: string, key: keyof typeof AUTO_RANGE, step: number, unit: number, fmt: (v: number) => string, describe: string, quick = false) => {
    const lo = Math.round(AUTO_RANGE[key][0] * unit / step) * step, top = Math.round(AUTO_RANGE[key][1] * unit / step) * step, hi = quick ? top + step : top;   // (quick: one notch past the fastest is the turn as built, the table's 0)
    const notch = (t: number) => (quick && !(t > 0) ? hi : Math.max(lo, Math.min(top, Math.round(t * unit / step) * step)));
    K.range(body, label, lo, hi, step, () => notch(AUTOCAM[key]), v => { const own = AUTO_MODES[AUTOTUNE.mode][key]; setAutoTune(key, Math.abs(notch(own) - v) < step / 2 ? own : quick && v > top + step / 2 ? 0 : v / unit); }, v => (quick && v > top + step / 2 ? 'Quick' : fmt(v)), describe);
  };
  const flag = (label: string, key: 'rest' | 'restAhead' | 'swing', describe: string) => K.flip(body, label, () => AUTOCAM[key], v => setAutoTune(key, v), describe, ['On', 'Off']);
  const none = (word: (v: number) => string) => (v: number) => (v ? word(v) : 'None'), pct = (v: number) => `${v.toFixed(0)} %`, degs = (v: number) => `${v.toFixed(0)}°`, secs = (v: number) => `${v.toFixed(1)} s`, rate = (v: number) => `${v.toFixed(0)}° a second`;
  const of = (key: 'lean' | 'zoomRate') => (v: number) => `${Math.round(v / AUTO_MODES.free[key] * 100)} %`;
  K.sec(body, 'Auto camera · trying out');
  K.seg(body, 'Camera turning', MODES, () => AUTOTUNE.mode, v => setAutoMode(v), () => { const M = MODES.find(m => m.v === AUTOTUNE.mode)!; return autoTuneOwn() ? `You've changed some of the settings below. Pick a mode to go back to its settings.` : M.line; });
  flag('Turn when a wall hides you', 'rest', 'When you stop behind a wall, the camera turns until it can see you again.');
  flag('Turn to face the door ahead', 'restAhead', 'When you stop at a door on the camera\'s side of you, the camera turns to look through it.');
  num('Turn speed', 'turnCap', 10, PER_RAD, rate, 'How fast the camera turns when it turns by itself. Quick is the snap it first shipped with.', true);
  num('Wait before it turns', 'still', 0.5, 1, secs, 'How long you have to stand still before the camera turns.');
  num('Time between turns', 'gap', 0.5, 1, secs, 'How long the camera waits after one turn ends before it starts another.');
  num('Turn in a fight', 'swayFightMax', 1, PER_RAD, none(degs), 'How far the camera may lean toward the enemies you can see. It comes back when the fight is over.');
  num('Lean when you move sideways', 'swayMove', 2, PER_RAD, none(degs), 'How far the camera leans toward the side you walk to.');
  num('Lean speed', 'swayRate', 1, PER_RAD, rate, 'How fast those two leans move.');
  flag('Swing when you double tap', 'swing', `When you tap ${camCap()} twice to turn the auto camera on, the view swings around to look where you look.`);
  num('Swing speed', 'swingCap', 30, PER_RAD, rate, `How fast the view swings around when you tap ${camCap()} twice. Quick is the snap it first shipped with.`, true);
  num('Framing', 'leanK', 10, 100, none(pct), 'How far the view moves toward the door, squad or fight it\'s framing. At none, it stays on you.');
  num('Framing speed', 'lean', 0.5, 1, of('lean'), 'How fast the view moves to what it\'s framing.');
  num('Zoom', 'zoomAmt', 10, 100, none(pct), 'How much the camera zooms in and out by itself. At none, the zoom stays where you set it.');
  num('Zoom speed', 'zoomRate', 0.4, 1, of('zoomRate'), 'How fast the camera zooms.');
  num('Stay on the squad', 'beatSecs', 0.5, 1, secs, 'How long the view stays on a door your squad is working after you give the order.');
  if (AUTOCAM.lock) {
    num('Zoom in when you sneak up', 'lockIn', 10, 100, none(pct), 'How much closer the camera comes as you sneak up on someone who hasn\'t noticed you. At none, it doesn\'t come in.');
    num('Start zooming in from', 'lockM', 1, 1, v => `${v.toFixed(0)} m`, 'How far away from an enemy the camera starts to come in.');
  }
}
const TURNS: { v: 'as' | 'rev'; label: string }[] = [{ v: 'as', label: 'Normal' }, { v: 'rev', label: 'Reversed' }];
const FADES: { v: 'pic' | 'meter'; label: string }[] = [{ v: 'pic', label: 'Picture' }, { v: 'meter', label: 'Light meter' }];
/** the rows under their headings (the auto camera's own section last, where it is on); returns what Reset does for them */
export function findMeRows(K: RowKit, body: HTMLElement): () => void {
  /** a row that is a share shown in per cent, from none (`zero`: 0 reads 'None') to `max` */
  const pct = (label: string, key: 'pan' | 'width' | 'opacity' | 'mates' | 'colour' | (() => 'lit' | 'dark' | 'picLit' | 'picDark'), max: number, step: number, zero: boolean, describe: string) => {
    const k = typeof key === 'string' ? () => key : key;
    K.range(body, label, 0, max, step, () => Math.round(FINDME[k()] * 100), v => setFindMe(k(), v / 100), v => zero && !v ? 'None' : `${v.toFixed(0)} %`, describe); };
  K.sec(body, 'Finding yourself · trying out');
  K.flip(body, 'Ring at your feet', () => FINDME.ring, v => setFindMe('ring', v), 'Keep the gold ring from the orders menu at your feet all the time.', ['On', 'Off']);
  K.flip(body, 'Outline in the dark', () => FINDME.outline, v => setFindMe('outline', v), 'Draw a rim around anyone on your team, including you, who\'s standing in the dark.', ['On', 'Off']);
  pct('Outline width', 'width', FINDME_WIDTH.max * 100, 5, true, 'How wide your rim is.');
  pct('Outline strength', 'opacity', 100, 5, true, 'How strongly the rims are drawn.');
  K.seg(body, 'Outline fades by', FADES, () => FINDME.picture ? 'pic' : 'meter', v => setFindMe('picture', v === 'pic'), () => 'Fade it by how dark each part of the character looks on screen, or by the light meter\'s single number for him.');
  pct('Outline shows under light', () => FINDME.picture ? 'picLit' : 'lit', 100, 2, false, 'A rim starts to show under this much light.');   // (the pair of whichever the row above says: each keeps its own numbers)
  pct('Outline full under light', () => FINDME.picture ? 'picDark' : 'dark', 100, 2, false, 'A rim is at its full under this much light.');
  pct('Teammate outline width', 'mates', FINDME_MATES.max * 100, 10, true, 'How wide the rim around each teammate is compared with yours. At none, they have no rim.');
  pct('Outline colour', 'colour', 100, 5, true, 'How much colour the rims have: yellow for you, red and blue for your teammates.');
  K.sec(body, 'Camera · trying out');
  pct('Aim pan', 'pan', 100, 10, true, 'How far the view leans toward where you aim. At none you stay in the middle of the screen.');
  K.seg(body, 'Turn direction', TURNS, () => FINDME.turn < 0 ? 'rev' : 'as', v => setFindMe('turn', v === 'rev' ? -1 : 1), () => `Which way the view turns when you hold ${camCap()} and move the mouse.`);
  if (AUTOCAM.on) K.flip(body, 'Auto camera', () => AUTOVIEW.on, v => setAutoView(v), `Tap ${camCap()} twice and the camera frames things for you. Hold ${camCap()} and move the mouse to take it back.`, ['On', 'Off']);   // (host/autocam.ts: the double tap is the mode's, and it turns the view as the row below did)
  else K.flip(body, `Double tap ${camCap()}`, () => FINDME.behind, v => setFindMe('behind', v), `Tap ${camCap()} twice and the view turns to put what you are facing ahead of you.`, ['On', 'Off']);   // (the camera's key as the board has it: host/keymap.ts camCap)
  if (AUTOCAM.on && AUTOCAM.tune) autoRows(K, body);
  return () => { resetFindMe(); if (AUTOCAM.on) setAutoView(false); if (AUTOCAM.on && AUTOCAM.tune) resetAutoTune(); };   // (the row above is not one of FINDME's: its start is Off)
}
