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
// been back there since the ring last changed under it, so the hand coming back from a page's wedge or a man picks nothing on the way. One guard is on
// the clock (`tapSecs`): the cursor lights nothing in the key's first moment, so a tap made with the hand sweeping is still the first wedge. A left click
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
// HIS OWN HANDS, THE SAME WAY (`hands`; the maintainer, 10-20: "i'm curious if we can unify some of these squad command interactions with ours. our space
// menu feels really clumsy today"): the ring's key is "they do it", Space is "I do it". Space down puts the rows Space already had (player.ts
// buildInteractables) up as a ring at the cursor, the highlighted one lit; Space up does the lit one, so a tap is the tap it was; a digit, or the cursor out
// of the ring's middle, lights another. interact.ts holds it (Player.sel.ring), and nothing else of the selector changes: the rows, their order, what a
// row does, the sustained verbs and how they stop are all as they were.
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
import type { Input } from './input';

export const CMDRING = {
  /** the ring's key puts the order menu up as a ring at the cursor and, let go, gives the lit wedge (false: the key is nobody's, as it was) */
  on: false,
  /** the key: the squad's command key — the quick order's own code (orders.ts ORDERS.quickKey), which the page's board has on Q (host/keymap.ts; the
   *  maintainer, 10-21: "let's move the squad command button to Q then too", "from tab"). It was Tab until then: a recording carries its own table, so
   *  one made on Tab replays on Tab. Tab itself is the page's again — the way back (backkey.ts) and what ui/tabkey.ts has it do */
  key: 'KeyB',
  /** wedges on the ring, clockwise from the top: the digits 1 … this (never above ORDER_DIGITS) */
  wedges: 5,
  /** the ring's middle: the cursor this far (CSS px) out of it lights the wedge it is out toward — once it has been back inside since the ring last changed
   *  under it (a page turned, a digit, a man clicked, or a ring opened at the view's edge with the cursor out of its middle) */
  flickPx: 24,
  /** A TAP IS THE QUICK KEY'S ORDER AND NO RING (the maintainer, 10-20, after playing it: "we shouldn't open the radial menu on just a single tab press,
   *  only after some (very short) delay"): the key let go inside this long (s) gives what the quick key gives on what the cursor was on when it went
   *  down — no menu was ever up, so nothing is drawn and no other key or button of those moments is the menu's — and the key still down after it puts
   *  the ring up for that thing, at the cursor. 0 = the ring the moment the key goes down, as it was first built (`tapSecs` then guards the tap) */
  holdSecs: 0.2,
  /** (with `holdSecs` 0) a TAP IS THE FIRST WEDGE HOWEVER THE HAND IS MOVING: the cursor lights nothing until the key has been down this long (s), and one already out of the
   *  middle by then lights nothing until it has been back. A digit counts from the first frame. 0 = the cursor counts at once */
  tapSecs: 0.15,
  /** a ring opened nearer the view's sides (edgeX) or its top and bottom (edgeY) than this stands this far in, whole (CSS px) */
  edgeX: 150, edgeY: 100,
  /** a left click within this many CSS px of a man's feet on the screen is a click on him */
  manPx: 24,
  /** the window the ring's px are for: a larger one makes every px above — and the ring as drawn — larger by the same ratio, never smaller (the page's
   *  words grow the same way, by the page's own rule; this is the window alone, so what the cursor does on the ring is the same wherever a recording is played) */
  ref: [1920, 1080] as [number, number],
  /** before the key: a small glyph beside the cursor for the kind of thing the ring would open on, and that thing outlined on the floor (the glyph sits in
   *  the ring's middle once it is up). A picture only. Off here and in the page unless chosen: a game setting (Options ▸ Game, kept on that machine; `?cmdhint` for a
   *  visit), with the ring or without (the maintainer, 10-21, of the mark that was always at the cursor: "I don't really like the always on icon", "we
   *  can make the always on icon a game setting"). With it off the outline and glyph are drawn only while the key is
   *  down — the press seen to land — and in the ring's middle */
  hint: false,
  /** SAM'S OWN HANDS ON THE SAME RING (interact.ts): Space DOWN puts his rows up as a ring at the cursor at once and Space UP does the lit one — a tap is
   *  the tap it was; a digit or the cursor out of the middle lights another; no quarter second to wait, no list to scroll, no cancel row (a right click or
   *  the back key gives nothing), and his feet are his own while it is up. Off here; the page raises it with the ring (`?nocmdhands` leaves Space as it was) */
  hands: false,
  /** PLAN MODE (planmode.ts): Shift + the key toggles it; while it is up the left button picks men (a click, Shift click, a drag), the right button gives
   *  the quick key's order to them — Shift adds it to the end of their chain — and a chain pauses for the word's key at a door's threshold and after a
   *  room that has something chained after it. Off here; the page raises it when asked for beside the ring (`?cmd&cmdplan`) */
  plan: false,
  /** plan mode: a left press that has moved less than this (CSS px, × ringZoom) by the time it is let go is a click, not a box */
  planDragPx: 8,
  /** plan mode: seconds the chains are drawn with the mode down after the word's key or an order changed them */
  planShowSecs: 1.5,
  /** PLAN MODE AS AN RTS's (planmode.ts; the maintainer, 10-20: "your player character is stuck, wasd moves the camera around, and then right click
   *  moves people, long right click opens the radial menu"): with the mode up Sam stands and goes on facing what he faced, the walk keys move the view,
   *  and the right button is read as it comes up — kept down, it is the ring. false: the mode as it was first built (he walks, the view is on him, a
   *  right click orders as it goes down). Off here; the page raises it with the mode (`?nocmdrts` leaves it off) */
  planRts: false,
  /** plan mode: the right button kept down this long (s) is the ring at the cursor; let go sooner it is a click, the first wedge's order */
  planHoldSecs: 0.25,
  /** plan mode: the walk keys move the view this fast over the floor (m/s), no further than this (m) outside the box Sam and the men stand in */
  planPanMps: 14, planPanReachM: 25,
  /** the outline: half the stretch of wall drawn (m), the ring on a spot and the ring at a man's feet (m) */
  hintWallM: 0.6, hintSpotM: 0.3, hintManM: 0.5,
};
export const CMDRING_STATS = { opened: 0, quick: 0, given: 0, pages: 0, cancelled: 0, who: 0, fired: 0 };

/** `ax, ay`: its middle (CSS px of the view) · `z`: how much larger than its px it stands (ringZoom, as it was opened) · `t0`: the game's clock when its
 *  key went down · `lit`: the lit wedge's digit (0: none) · `armed`: the cursor may light a wedge (it has been in the middle) */
export interface RingState { ax: number; ay: number; z: number; t0: number; lit: number; armed: boolean; /** kept up by the right button, not the key (plan mode's: orders.ts ringByButton) */ rmb?: boolean }
/** what a ring shows (orders.ts ringView, interact.ts handRingView → ui/cmdring.ts): where, how much larger than its px, the lit wedge, whose colour, the
 *  words under it, and the wedge on each digit */
export interface RingView { x: number; y: number; zoom: number; lit: number; tone: string | undefined; caption: string; wedges: { key: number; text: string; off: boolean; opens: boolean }[] }
/** how much larger than CMDRING's px a ring stands in a view this size (1 up to `ref`) */
export function ringZoom(w: number, h: number): number { return Math.max(1, Math.min(w / CMDRING.ref[0], h / CMDRING.ref[1])); }

/** A ring opened at the cursor, `lit` its first lit wedge: at the edge of the view it stands whole just inside it — and the cursor, then out of its
 *  middle, lights nothing until it has come back in (`w`, `h`: the view; 0 = not known, no edge) */
export function ringOpen(input: Input, w: number, h: number, time: number, lit = 1): RingState {
  const C = CMDRING, z = w && h ? ringZoom(w, h) : 1, cl = (v: number, m: number, max: number) => max > 2 * m ? Math.max(m, Math.min(max - m, v)) : v;
  const ax = cl(input.mouseX, C.edgeX * z, w), ay = cl(input.mouseY, C.edgeY * z, h);
  return { ax, ay, z, t0: time, lit, armed: Math.hypot(input.mouseX - ax, input.mouseY - ay) < C.flickPx * z };
}
/** The wedge this frame asks for (0: none): a digit's own — which disarms the cursor — else the one the cursor is out of the ring's middle toward, once
 *  the key has been down `tapSecs` and the cursor has been in the middle since the ring last changed under it (a page, a digit, a man, new rows) */
export function ringWant(R: RingState, input: Input, digit: number, time: number): number {
  const C = CMDRING, dx = input.mouseX - R.ax, dy = input.mouseY - R.ay, out = Math.hypot(dx, dy) >= C.flickPx * R.z, early = time - R.t0 < C.tapSecs - 1e-6;
  if (early) { if (out) R.armed = false; } else if (!out) R.armed = true;
  if (digit) { R.armed = false; return digit <= C.wedges ? digit : 0; }
  return !early && out && R.armed ? wedgeAt(dx, dy, C.wedges) : 0;
}

/** what a ring would open on, as the hint names it (orders.ts hintView) */
export type RingHint = 'door' | 'wall' | 'man' | 'floor' | 'thing' | 'foe' | 'squad';

/** the wedge a direction points at: 1 at the top, clockwise, `n` of them */
export function wedgeAt(dx: number, dy: number, n: number): number {
  const k = Math.round(Math.atan2(dx, -dy) / (2 * Math.PI / n));
  return ((k % n) + n) % n + 1;
}

/** a file holds no ring (a held key is not state): a load, or the switch put off, finds the key up — savestate.ts, ui/bindings.ts */
export function ringRestore(g: Game): void {
  g.orders.cmdPress = null;
  if (g.orders.cmdRing) { g.orders.cmdRing = null; g.orders.close(); }
  const S = g.player.sel; if (S.ring) { S.ring = null; S.open = false; S.downT = -1; S.moved = false; g.player.fHeld = true; }   // (his own ring: the press is spent, as a teleport spends it)
}
