// THE ORDERS RING — a PROTOTYPE to play before it is committed to (the maintainer, 10-20: "want to play with it in game a bit before we commit to it"; the
// design: rebuild/commanding/command-mode.md). OFF unless asked for: `?cmd` on the address or the debugger's tick; off in the module and on BOTH stands, so
// no digest, tally or fixture moves and the quick key, the order menu and the who key are untouched with it off — and work beside it on.
//
// ONE KEY, AND NOTHING ON A TIMER. The key going DOWN puts the order menu up as a ring at the cursor: its target fixed, everyone it would go to, the first
// wedge lit. The key coming UP gives the lit wedge. So a tap is the quick key's own order (autopilot.ts: what the squad would do for that thing), and the
// key kept down a moment is the order menu: a digit, or the cursor out of the ring's middle toward a wedge, lights another one; a wedge that opens a page
// turns the ring to it at once and lights nothing (a tool is chosen, never fallen into); the wheel changes who it goes to, and so does a left click on a
// man — the ring then starts again for him, its first wedge lit; a right click on the first page gives nothing, and so does Esc where an Esc reaches the
// game (on the page Esc is the pause, backkey.ts: the ring is gone when play comes back). The cursor counts from the ring's MIDDLE, and only once it has
// been back there since the ring last changed under it, so the hand coming back from a page's wedge or a man picks nothing on the way. A left click
// anywhere else is Sam's trigger, as it is with the menu up: the ring goes and he fires.
//
// BEFORE THE KEY (the maintainer, 10-20: "we should some visual indication of what type of menu will open when you hit tab on the cursor. this could be a
// door icon, a wall icon, etc on the cursor"): with the switch on, wherever the key would open a ring now (orders.ts ringFree: no menu up, Shift not down,
// nothing the key backs out of instead), a small glyph rides beside the cursor for what the ring would open on — a door, a wall a charge can go on, a man,
// a thing to work, the floor, or the squad itself where the cursor is on nothing an order goes to — and that thing is outlined on the floor, in the colour
// the ring would open in (`hint`; orders.ts hintView). With the ring up the glyph sits in its middle. Words are not put on the cursor: the panel's line
// has them.
//
// THE RING'S SIZE FOLLOWS THE WINDOW (`ref`, ringZoom): its px — the flick, the edge it stands in from, a click near a man's feet — and its picture grow
// together in a window larger than 1920 × 1080, as the page's words do, so the wedge under the cursor is the wedge the game lights.
//
// THE KEY IS ALSO THE BACK KEY (backkey.ts, BACKKEY.tab): with an order menu up, a Space list open, a verb running or the launcher's arc held, the press
// backs out of that and no ring opens; with nothing to back out of it is the ring's.
//
// WHAT IS WHOSE. The ring IS the order menu (orders.ts `menu`), opened and picked through that file's own `open` / `turn` / `pick` — so every row, refusal
// and reason is the menu's — with `SquadOrders.cmdRing` beside it saying where it was opened and which wedge is lit; `ringInput` (orders.ts) reads the keys,
// ahead of the menu's own input, and `ringView` hands the picture to ui/cmdring.ts. A wedge is a row on a digit, 1 to `wedges`; a row on a letter of its own
// (the throw page, 'go') is not drawn on the ring yet. 'Wait for my word' is not the ring's: an order from it goes at once.
//
// STATE: `cmdRing` is a key held down — nothing of it is filed, so there is no snapshot; `ringRestore` is the other half (a load finds the key up: no ring, no menu).
import type { Game } from './game';

export const CMDRING = {
  /** the ring's key puts the order menu up as a ring at the cursor and, let go, gives the lit wedge (false: the key is nobody's, as it was) */
  on: false,
  /** the key */
  key: 'Tab',
  /** wedges on the ring, clockwise from the top: the digits 1 … this (never above ORDER_DIGITS) */
  wedges: 5,
  /** the ring's middle: the cursor this far (CSS px) out of it lights the wedge it is out toward — once it has been back inside since the ring last changed
   *  under it (a page turned, a digit, a man clicked, or a ring opened at the view's edge with the cursor out of its middle) */
  flickPx: 24,
  /** a ring opened nearer the view's sides (edgeX) or its top and bottom (edgeY) than this stands this far in, whole (CSS px) */
  edgeX: 150, edgeY: 100,
  /** a left click within this many CSS px of a man's feet on the screen is a click on him */
  manPx: 24,
  /** the window the ring's px are for: a larger one makes every px above — and the ring as drawn — larger by the same ratio, never smaller (the page's
   *  words grow the same way, ui/textsize.ts; this is the window alone, so what the cursor does on the ring is the same wherever a recording is played) */
  ref: [1920, 1080] as [number, number],
  /** before the key: a small glyph beside the cursor for the kind of thing the ring would open on, and that thing outlined on the floor (the glyph sits in
   *  the ring's middle once it is up). A picture only. Off here; the page raises it with the ring (`?nocmdhint` leaves it off) */
  hint: false,
  /** the outline: half the stretch of wall drawn (m), the ring on a spot and the ring at a man's feet (m) */
  hintWallM: 0.6, hintSpotM: 0.3, hintManM: 0.5,
};
export const CMDRING_STATS = { opened: 0, quick: 0, given: 0, pages: 0, cancelled: 0, who: 0, fired: 0 };

/** `ax, ay`: its middle (CSS px of the view) · `z`: how much larger than its px it stands (ringZoom, as it was opened) · `lit`: the lit wedge's digit
 *  (0: none) · `armed`: the cursor may light a wedge (it has been in the middle) */
export interface RingState { ax: number; ay: number; z: number; lit: number; armed: boolean }
/** how much larger than CMDRING's px a ring stands in a view this size (1 up to `ref`) */
export function ringZoom(w: number, h: number): number { return Math.max(1, Math.min(w / CMDRING.ref[0], h / CMDRING.ref[1])); }

/** what a ring would open on, as the hint names it (orders.ts hintView) */
export type RingHint = 'door' | 'wall' | 'man' | 'floor' | 'thing' | 'foe' | 'squad';

/** the wedge a direction points at: 1 at the top, clockwise, `n` of them */
export function wedgeAt(dx: number, dy: number, n: number): number {
  const k = Math.round(Math.atan2(dx, -dy) / (2 * Math.PI / n));
  return ((k % n) + n) % n + 1;
}

/** a file holds no ring (a held key is not state): a load, or the switch put off, finds the key up — savestate.ts, ui/bindings.ts */
export function ringRestore(g: Game): void { if (g.orders.cmdRing) { g.orders.cmdRing = null; g.orders.close(); } }
