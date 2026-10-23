// A RING WITH ONE ROW IS A PILL (HANDRING.lone; the maintainer, 10-23: "the radial menus are getting better but need some work. to start they look weird
// when they just have one option"). The wheel is five places a fifth of a turn each, and a ring with one row was one slice of it with four places bare:
// on open floor his own ring was a lone slice out to one side (the whistle), and a tutorial mission's frame leaves many rings one row (every squad ring
// of the first mission).
//
// THE PICTURE (ui/cmdring.ts RingDraw draws it, index.html `.cmdring .lone …` is the look). One row: no slice. A small ring round the middle (the hole
// the wheel had, so what is pointed at still shows through) and one pill beside it, out the way that row's wedge lay, its digit at the end by the
// middle and its words inside. Lit, the pill is filled as a lit wedge is. Two rows or more: the wheel, as it was.
//
// THE CURSOR ON THE PILL IS ON THE ROW (cmdring.ts ringWant, both rings): a wedge is a fifth of a turn and a pill of words is wider than that where
// its wedge points up, so the pill's digit lay in the next wedge's fifth and a key let go there gave nothing. With one row, the cursor anywhere on
// the pill's place is that row's; the wedge's own fifth is still its too. Nothing else is added: a cursor out any other way lights nothing, so a
// row is still chosen, never fallen into.
//
// THE GAME READS A PLACE, NOT THE WORDS (`pillBox`): the place a pill may lie in is as long as the longest pill (`LONE.max` letters), whatever this
// row says, so which row a recorded cursor lit never turns on how a label is worded (a recording keeps the cursor's px, and labels are reworded).
// The pill drawn is as long as its own words and always inside that place: its width is counted from the words, never measured, and the page sets
// its words to that width (a label longer than `max` is drawn tighter, never longer).
//
// This file is the shape, with no page under it (handring-check asks it).
import { HANDRING } from './handring';
import type { RingView } from './cmdring';

/** px, in the ring's own: the wheel's hole — and the middle's own ring beside a pill */
export const RING_HOLE = 17;
/** px: the wheel's rim (a wedge is drawn from the hole out to it) */
export const RING_RIM = 44;
/** px: how far each way from its middle a ring's wedges and words may lie (ui/cmdring.ts `clear` keeps the HUD from under it) */
export const RING_BOX = { x: 190, y: 80 };
/** px: how far out the pill's digit sits · the pill's height · the room after its words · a letter's width (10 px mono, spaced) · the most letters a pill is
 *  drawn for (the place the game reads is a pill of that many: pillBox) */
export const LONE = { r: 34, h: 22, pad: 10, char: 6.6, max: 20 };
type Wedge = { key: number; text: string; opens?: boolean };
/** the way wedge `key` of `n` points (rad; 1 is up, clockwise) */
export const wedgeMid = (key: number, n: number): number => (-90 + (key - 1) * 360 / n) * Math.PI / 180;
/** the one row of a ring that has one (null: the wheel) — the page's, for what it draws */
export function loneWedge(V: RingView | null): RingView['wedges'][number] | null { return HANDRING.lone && V?.wedges.length === 1 ? V.wedges[0] : null; }
/** …and the game's: its digit, from the digits that have a wedge (a bit each, bit 1 the first; asked only while the rule is on); 0 = the wheel, or no ring */
export function loneKey(keys: () => number): number { if (!HANDRING.lone) return 0; const k = keys(); return k > 0 && !(k & (k - 1)) ? 31 - Math.clz32(k) : 0; }
/** a wedge's words as drawn */
export const wedgeWords = (w: Wedge): string => w.opens ? `${w.text} ▸` : w.text;
/** where a wedge's outline, digit and words go: on the wheel, or as a pill */
export interface RingPlace { d: string; nx: number; ny: number; tx: number; ty: number; anchor: 'start' | 'middle' | 'end' }
export interface LonePill extends RingPlace { /** its box */ x0: number; y0: number; x1: number; y1: number; /** the width its words are set to */ textW: number }
/** the box of wedge `key`'s pill on a wheel of `n`, its words `textW` px wide: over the middle for a wedge that points up or down, else out to that wedge's
 *  side */
function boxOf(key: number, n: number, textW: number): { x0: number; y0: number; x1: number; y1: number; px: number; py: number; left: boolean } {
  const L = LONE, a = wedgeMid(key, n), c = Math.cos(a), px = L.r * c, py = L.r * Math.sin(a), e = L.h / 2, wd = L.h + textW + L.pad;
  const mid = Math.abs(c) < 0.2, left = !mid && c < 0, x0 = mid ? -wd / 2 : left ? px + e - wd : px - e;
  return { x0, y0: py - e, x1: x0 + wd, y1: py + e, px, py, left };
}
/** the width a pill's words are set to */
const wordsW = (w: Wedge): number => Math.min(wedgeWords(w).length, LONE.max) * LONE.char;
/** The pill of wedge `w` on a wheel of `n` as drawn: its outline, the digit at the end by the middle, its words */
export function lonePill(w: Wedge, n: number): LonePill {
  const L = LONE, e = L.h / 2, textW = wordsW(w), { x0, y0, x1, y1, py, left } = boxOf(w.key, n, textW), f = (v: number) => v.toFixed(1);
  const d = `M${f(x0 + e)},${f(y0)} H${f(x1 - e)} A${e},${e} 0 0 1 ${f(x1 - e)},${f(y1)} H${f(x0 + e)} A${e},${e} 0 0 1 ${f(x0 + e)},${f(y0)} Z`;
  return { d, nx: left ? x1 - e : x0 + e, ny: py + 4, tx: left ? x1 - L.h : x0 + L.h, ty: py + 3.5, anchor: left ? 'end' : 'start', x0, y0, x1, y1, textW };
}
/** the place the game reads for wedge `key`'s pill: the longest pill's box (no words in it — see the head) */
export const pillBox = (key: number, n: number) => boxOf(key, n, LONE.max * LONE.char);
/** is a point of the ring's own px (from its middle) on the place of wedge `key`'s pill */
export function onPill(key: number, n: number, x: number, y: number): boolean { const P = pillBox(key, n); return x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1; }
