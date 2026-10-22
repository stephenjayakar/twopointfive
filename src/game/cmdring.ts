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
// IT STAYS UP WITHOUT THE KEY (`stay`, on in the page since 10-22; the maintainer: "longer press for Q opens up squad, doesn't require holding it"): a
// plainer hold (`stayHoldSecs`) puts it up and the key coming up leaves it there. A digit gives its wedge at once (a page's wedge turns the ring), a left
// click anywhere but on a man gives the lit wedge and is not his trigger, the key again gives the lit wedge, a right click steps a page back or puts it
// away. Kept down, taken out to a wedge and let go, it still gives that wedge. Plan mode's ring on the right button is not latched.
//
// STATE: `cmdRing` is a key held down or a ring left up — nothing of it is filed, so there is no snapshot; `ringRestore` is the other half (a load finds the key up: no ring, no menu).
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
  /** THE RING STAYS UP WITHOUT ITS KEY (the maintainer, 10-22: "longer press for Q opens up squad, doesn't require holding it"): the press kept down
   *  `stayHoldSecs` puts the ring up and the key coming up leaves it there — a digit gives its wedge at once, a left click or the key again gives the
   *  lit one, a right click steps a page back or puts it away. The hand that keeps the key down, goes out to a wedge and lets go still gives that wedge
   *  (ringLatch). false: the ring is up only while its key is down and the key coming up gives the lit wedge, as it was built. Off here and on the
   *  frozen stand; the page raises it (`?qstay=0` leaves it off) */
  stay: false,
  /** … and how long that press is (s), in place of `holdSecs`: a ring that stays costs a press to put away, so it asks for a plainer hold than one that goes with the key */
  stayHoldSecs: 0.3,
  /** A PRESS ALREADY UP IN ITS OWN FRAME IS A TAP, GIVEN IN THAT FRAME (the key in `pressed` and not down: a press and its release inside one tick,
   *  which is also every one-frame press a script makes): nothing is waited for, so the order is filed on the tick it was on with the ring off. false:
   *  it is filed on the next tick, where the key is first seen up, as it was built. Off here; the page raises it with the ring */
  tapNow: false,
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
   *  room that has something chained after it. Off here; the page raises it with the ring (the maintainer, 10-22: "shift Q for plan mode"; `?qplan=0`
   *  or `?nocmdplan` leaves it off) */
  plan: false,
  /** … but not out of a sprint: Shift + the key with a walk key down and the mode down is the key's own order, as it is at a walk — Shift there is his
   *  run, and a run that stopped him in a view he did not ask for would cost him the fight (the mode is left by Shift + the key whatever else is
   *  down: the walk keys are its view's). And the back key (backkey.ts) takes the mode down, once no menu or ring is up to back out of first.
   *  false: Shift + the key is always the mode's and only it leaves the mode, as it was built. Off here; the page raises it with the mode */
  planRun: false,
  /** PLAN MODE: A RIGHT PRESS DRAGGED IS AN ORDER WITH A WAY TO LOOK (planmode.ts lookOrder; the maintainer, 10-22: "you should be able to right
   *  click drag on a path and have them check that direction, like door kickers", "if they're given an angle while not moving, they should probably
   *  just cover that"): down on the floor and dragged, the men go there and face the way of the drag; down on a man (or on Sam: the picked men) and
   *  dragged, they cover that way from where they stand. false: a right press is a click or, kept down, the ring, as it was built. Off here; the
   *  page raises it with the mode (`?planlook=0` off) */
  planLook: false,
  /** … and how far the right press is dragged before it is that and not a click (px, × the ring's own zoom): well past a click's own slip on a trackpad */
  planLookPx: 24,
  /** … how long a chain's men check the way of a stop that has more stops after it and no wait on it, before they walk on (s) */
  planLookSecs: 1.2,
  /** … how far out the point they cover is put (m): far enough that men stood apart look the same way */
  planLookM: 30,
  /** PLAN MODE: THE WORD'S WAITS ARE THE PLAN'S OWN (planmode.ts waitsAt / holds / cycle; the maintainer, 10-22: "let's also make it possible to add
   *  and remove F waits in the plan. and then I think we can change the flow to be that pressing F only releases the people blocked on it"): a left
   *  click on a stop of a chain steps its waits on (a door: at its threshold, and once its room is taken; any other stop: a hold there), a wait
   *  taken off under men stood on it lets them go, and the word's key frees the chains that are stood waiting and is never kept for a wait to come.
   *  false: a threshold always waits, a room in the middle of a chain always holds, and an early press counts for the next pause, as it was built.
   *  Off here; the page raises it with the mode (`?planwaits=0` off) */
  planWaits: false,
  /** … how near the cursor must be to where a stop is drawn for a left click to be the stop's (CSS px, × ringZoom) */
  planStopPx: 14,
  /** PLAN MODE: HE TAKES A KNEE AT THE RADIO, AND THE VIEW COMES BACK GENTLY (planmode.ts up / down / planLook, player.ts; the maintainer, 10-22:
   *  "plan mode should also show the player taking a knee and talking on the radio, and then camera can decouple from them and move (up to some
   *  limit) with wasd and then gently snap back when exiting the mode"): with the mode up (and its view the hand's, `planRts`) Sam crouches — his real
   *  crouch, put back as it was when the mode comes down if there is room to stand — with the gun low and his left hand at the handset; and the
   *  mode put down, the view's point eases back to him over `planBackSecs` in place of jumping to him. The limit he asks for is `planPanReachM`.
   *  false: he stands as he stood and the view's point is on him the tick the mode goes down, as it was built. Off here; the page raises it with
   *  the mode (`?planknee=0` off) */
  planKnee: false,
  /** … how long the view's point takes to come back to him (s) */
  planBackSecs: 0.7,
  /** THE SQUAD'S ONLY KEYS (the maintainer, 10-22: "squad is now just q and f. everything is through the radial menu (which is 1-5? is that
   *  sufficient) so we don't need all the other keys"): the ring carries EVERY order of the menu it is — a row the menu had on a letter of its own
   *  (throw there on G, frag and clear on G, the big slot's tool on H, a look under the door on V) takes a spare wedge of its page, and where a page has
   *  more rows than wedges its last wedge is 'more', a ring of the rest (ringSeats). The squad's posture rows (go silent / go loud) are the squad's
   *  own: on the ring opened on Sam or on a man, not on a place's. While a ring is up those letters are nobody's, and the middle button opens no menu.
   *  (The orders menu's own key and the who key have no key on the page's board with it: host/keymap.ts qOnly — the game's reads of them stand, as
   *  every recording holds them.) false: the wedges are the rows the menu has on digits, the letters work beside the ring, as it was built. Off here
   *  and on the frozen stand; the page raises it with the ring (`?qonly=0` off) */
  only: false,
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
export interface RingState { ax: number; ay: number; z: number; t0: number; lit: number; armed: boolean; /** kept up by the right button, not the key (plan mode's: orders.ts ringByButton) */ rmb?: boolean;
  /** (CMDRING.stay) the press that opened it has come up and it stands by itself: ringLatch */ free?: boolean;
  /** (CMDRING.only) it shows the rows its page has no wedge for: ringSeats `over` */ more?: boolean }
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

/** a menu row as the seats read it (orders.ts OrderDef) */
export interface SeatRow { key?: number; hotKey?: string; opens?: string; free?: boolean; targets: readonly string[]; listed?: readonly string[] }
/** WHICH ROW IS ON WHICH WEDGE. `row[d]`: the index of the row on wedge d (1 … CMDRING.wedges; -1 none) · `more`: the wedge that is 'more' (0: none) ·
 *  `over`: the rows 'more' holds, in order (its ring seats them from wedge 1). As built: a row is on the wedge of its own digit and nowhere else.
 *  CMDRING.only: the rows with digits keep them; the rows with none take the spare wedges in order; with more of those than spare wedges the last
 *  spare wedge is 'more' — no wedge spare, the last wedge is, and its own row leads the rest. Left out: the word's own rows (`wordKey`: F gives
 *  them). On a place (`place`) the rows that move nobody and belong to the squad's own ring (free, on no page, on no letter, listed for 'none') come
 *  last and only onto a wedge nothing else wants: they never make a 'more'. `first`: the menu's first page, whose wedge 1 is the quick order's. */
export function ringSeats(rows: readonly SeatRow[], place: boolean, wordKey: string, first = true): { row: number[]; more: number; over: number[] } {
  const W = CMDRING.wedges, row = new Array<number>(W + 1).fill(-1), rest: number[] = [], last: number[] = [];
  rows.forEach((r, i) => {
    if (CMDRING.only && r.hotKey === wordKey) return;
    if (CMDRING.only && place && !!r.free && !r.opens && !r.hotKey && (r.listed ?? r.targets).includes('none')) { last.push(i); return; }
    const k = r.key; if (k !== undefined && k >= 1 && k <= W && row[k] < 0) row[k] = i; else rest.push(i);
  });
  if (!CMDRING.only) return { row, more: 0, over: [] };
  const spare: number[] = []; for (let d = first ? 2 : 1; d <= W; d++) if (row[d] < 0) spare.push(d);   // (a first page's wedge 1 is the quick order's, whatever the rows are)
  if (rest.length <= spare.length) { [...rest, ...last].slice(0, spare.length).forEach((i, n) => { row[spare[n]] = i; }); return { row, more: 0, over: [] }; }
  const more = spare.length ? spare.pop()! : W, over = [...rest];
  if (row[more] >= 0) { over.unshift(row[more]); row[more] = -1; }
  for (const d of spare) row[d] = over.shift()!;
  return { row, more, over: over.slice(0, W) };
}

/** how long the key is kept down before its ring goes up (s): `stayHoldSecs` for a ring that stays, `holdSecs` for one that goes with its key */
export function ringHoldSecs(): number { return CMDRING.stay ? CMDRING.stayHoldSecs : CMDRING.holdSecs; }
/** THE LATCH of a ring that stays (CMDRING.stay), one frame of it — `keyDown`: its key is down · `keyHit`: its key went down this frame · `pointed`: the
 *  cursor is out of the middle on the lit wedge. The press that opened it still down: 'hold'. That press coming up with the cursor out on a wedge:
 *  'give' (hold, go out, let go — the ring as it was built); coming up in the middle: the ring is free, 'stay'. Free, the key again: 'give' (the lit
 *  wedge; with none lit the caller puts the ring away). Digits, clicks and what closes it are the caller's own. */
export function ringLatch(R: RingState, keyDown: boolean, keyHit: boolean, pointed: boolean): 'hold' | 'stay' | 'give' {
  if (R.free) return keyHit ? 'give' : 'stay';
  if (keyDown) return 'hold';
  if (pointed) return 'give';
  R.free = true; return 'stay';
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
