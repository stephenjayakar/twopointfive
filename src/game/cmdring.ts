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
import type { Vec3 } from '../math/vec';
import { onPill, RING_BOX, RING_HOLE } from './ringlone';

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
  /** … and A DIGIT INSIDE THAT PRESS IS THE RING'S (a quick hand: the key, then 2 before the hold is over, the key still down): the ring goes up at
   *  once and that digit gives its wedge — it is not his gun's slot. Only the digits a ring carries (1 to `wedges`), only with the key still down, and
   *  only where a ring can go up; a tap let go before the digit is still a tap, and the digit after it the gun's. false: until the hold is over a
   *  digit is the gun's, as it was. Off here and on the frozen stand; the page raises it with `stay` (`?qstay=0` leaves both off) */
  stayDigit: false,
  /** THE RING STAYS ON ITS POINT (the maintainer, 10-22: "radial menu should stick on the point for the action, not move with the camera"): it keeps
   *  its place over the thing it was opened on as the view moves — he walks on, the view pans — still standing whole inside the view's edge. The
   *  cursor lights a wedge only as the HAND moves it: a ring sliding under a cursor at rest changes nothing. false: it stays where it was opened on
   *  the screen. Off here and on the frozen stand; the page raises it (`?ringpin=0` leaves it off) */
  pin: false,
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
  /** ONE WORD IS ONE SIGNAL (the maintainer, 10-22, of a plan with a pair on each of a room's two doors: "simultaneous breach on mission 2 didn't
   *  really work. and the second team threw a flashbang when our guys were already on the inside"): the press that frees two or more chains waiting
   *  at doors puts the entries it starts on ONE word of the door tools (doortools.ts oneWord — the four's own word, wordTick): nobody makes a sound
   *  until every stack on it is formed, the cans go first, a door with no can keeps its leaf shut for the men behind the can beside it, and they
   *  step in together. A press that frees one door is the entry it always was. false: every chain's entry is its own order with its own clock, as
   *  it was built — the stack that needs no can, or forms sooner, is inside before the other's can lands. Off here; the page raises it with the
   *  mode (`?planone=0` off) */
  planOne: false,
  /** PLAN MODE REACHES ONE ROOM, NOT THE LEVEL (the maintainer, 10-23: "balancing plan mode: it's too easy to just play this like an RTS. we should
   *  instead make it so you can only move a bounded amount from the player. like maybe the player has to roughly be on screen but can be in a corner.
   *  the mental model is that it should be good for clearing one room but not the whole level"): with the mode up the view's point stays where SAM
   *  IS STILL ON THE SCREEN — a box round him in the camera's own basis (below), whichever way the men have gone — in place of `planPanReachM`
   *  outside the box he and the men stand in, which walked the view down the level behind them. At an edge the view stops going out and slides
   *  along it; in a corner of the box he is in a corner of the screen. A view found outside the box (a file from before, a frame's lock let go) is
   *  walked in at twice the pan's speed, not jumped. He is parked while the mode is up, so to plan further on he puts it down and walks. NOT
   *  where a tutorial frame has taken his feet (rails `move` locked: he cannot walk nearer, so the frame's view is the old one). false: the reach as
   *  it was built. Off here; the page raises it with the mode (`?plannear=0` off) */
  planNear: false,
  /** … that box, metres from him to the view's point AT THE CAMERA'S OWN DISTANCE (21): to either side · with the view pushed away from the camera
   *  (he is then at the bottom of the screen) · with it pulled toward the camera (he is at the top). Zoomed IN the box shrinks with the camera's
   *  distance, so he stays on the screen; zoomed out it does not grow (a room's worth is metres, not a screen's). At the camera's tilt the ground on a
   *  16:10 screen runs 8.4 m to either side of its middle (7.4 along its bottom edge), 5.5 m toward the camera and 7.8 m away: these leave his body
   *  on it. What is drawn from an edge then runs to about 15 m from him */
  planNearSideM: 6.5, planNearAwayM: 4.5, planNearBackM: 6,
  /** PLAN MODE'S REACH IS THE SAME AT ANY ZOOM (planmode.ts pan; the maintainer, 10-25: "max distance for plan mode seems to be based on the zoom
   *  level? should be zoom invaraitn"): the box above is its metres whatever the camera's distance. It was made smaller as the camera came in, so
   *  that he stayed on the screen; zoomed in he can now be off the screen's edge with the view at the box's. false: the box shrinks with the
   *  camera's distance, as `planNear` was built. Off here and on the frozen stand (`TPS_PLANNEARFLAT=1`, beside `TPS_PLANNEAR=1`); the page
   *  raises it with `planNear` (`?plannearflat=0` off) */
  planNearFlat: false,
  /** PLAN MODE: THE DIGITS PICK THE MEN (planmode.ts planInput; the maintainer, 10-24: "1 2 3 4 in plan mode should select the appropriate squad
   *  members, and 5 selects all of them? and then we should remove clicking on the ground selects all"): with the mode up and no ring or menu up, a
   *  digit 1 to 4 picks that man of the squad alone (the squad's own order: a man keeps his digit when another is down), Shift + the digit puts him in
   *  the picked set or takes him out, 5 picks everyone — and a left click on bare ground picks nobody new: the men picked stay picked (a drag still
   *  boxes, a click on a man is still him). His digit is drawn by each man's circle. On a tutorial mission the same holds, once its lesson
   *  has taught picking (rails.ts RAILS.planDigits, locksPicks: its frame lets the digits through, and nothing picks before that lesson). false: no digit is the mode's, and a click on nothing is everyone, as it was built. Off
   *  here and on the frozen stand (`TPS_PLANDIGITS=1`, beside `TPS_QPLAN=1`); the page raises it with the mode (`?plandigits=0` off) */
  planDigits: false,
  /** PLAN MODE: A CLICK ON BARE GROUND DESELECTS (planmode.ts planInput; the maintainer, 10-25, with the digits picking the men and the ground click
   *  doing nothing: "clicking on the ground to deselect is pretty key"): with `planDigits` on, a left click on bare ground leaves NOBODY picked: no
   *  circle is lit, a right click orders nobody ("nobody to take that order") and no ring opens, until a man is picked again by a click, a box or
   *  his digit, or 5 picks everyone. Shift + a click or Shift + a digit adds to the empty set. The mode put down forgets it: it comes up with
   *  everyone. On a tutorial mission the same, once its lesson has taught picking: before that the click does nothing (rails.ts locksPicks). false: the click picks nobody new and who was
   *  picked stays picked, as `planDigits` was built. Off here and on the frozen stand (`TPS_PLANCLEAR=1`, beside `TPS_PLANDIGITS=1`); the page
   *  raises it with the digits (`?planclear=0` off) */
  planClear: false,
  /** … how long the view's point takes to come back to him (s) */
  planBackSecs: 0.7,
  /** THE TREE IS TWO RINGS DEEP (the maintainer, 10-23, at a wall with three rings between him and one greyed row: "radial menu tree needs some
   *  work, way too nested"; "loud and quiet should be an option on squad wheel"). With `only`: the ring is not the menu's pages any more — it holds
   *  every order of the thing it was opened on (orders.ts flatRows: the first page's rows and the rows of every page behind it), seated by flatSeats:
   *  wedge 1 what a tap gives there, wedges 2 to 4 the same orders on every thing of that kind (FLAT_TOP), wedge 5 'more', ONE ring of the rest — or,
   *  with the rest fitting the wedges left, no 'more' at all (a ring never has one row: that row is on a wedge of the first). A row for kit the squad
   *  never carried, or for a tool this door never takes, is not offered (OrderDef.gone); one that is off only for now stays, greyed. The squad's
   *  posture row (go silent / go loud) closes every second ring, and is on the first where the ring is the squad's own (fall in stays on wedge 3 and
   *  hold position on 4 there, as fingers have them; a row that says what wedge 1 says has no wedge of its own, and its digit is wedge 1's:
   *  orders.ts seats `same`). Not on a tutorial mission (rails live: its lines name the digits of the tree as it was, "[X], then press [3]"; the tutorial's own
   *  to move) unless its level takes it (`rails.flatRing`, rails.ts RAILS.flatRing: the first mission does). false: the menu's pages, as built. Off here and on the frozen
   *  stand (`TPS_RINGFLAT=1` beside `TPS_QRING=1 TPS_QONLY=1`); the page raises it with `only` (`?ringflat=0` off) */
  flat: false,
  /** NO GLYPH AT THE CURSOR (the maintainer, 10-23: "let's remove the icons on mouse position from squad orders entirely"): the mark of what the
   *  key orders on is the thing's own outline on the floor and nothing else — no glyph beside the cursor, none in the ring's middle (orders.ts
   *  hintView `glyph`; a picture only). false: the glyph, as built. Off here and on the frozen stand (`TPS_PLAINHINT=1`); the page raises it
   *  (`?plainhint=0` off) */
  plainHint: false,
  /** … AND NO OUTLINE EITHER (the maintainer, 10-23, at a wall with the ring up: "the line and circle are weird, don't need them"): the squad's
   *  cursor mark is not drawn at all — no line along a wall or a door, no circle on a spot or a man, before the key, with it down or under an open
   *  ring (orders.ts hintView answers null; a picture only). What a tap would order, and on what, is the corner's line on the key. false: the
   *  outline, as built. Off here and on the frozen stand (`TPS_BAREHINT=1`); the page raises it (`?barehint=0` off) */
  bareHint: false,
  /** THE WHEEL WITH THE RING UP STEPS NOBODY (orders.ts ringInput; the maintainer, 10-24, after a two-finger scroll with the ring still up: "got into a
   *  weird state where my command modes (not plan mode) only selected blue team"): a scroll with the squad's ring up used to step who the orders go
   *  to (everyone, one pair, the other), the choice stayed after the ring had gone, and under `only` no key steps it back. true: the scroll is still
   *  taken out of the frame (it is not his walking pace under the ring) and changes nobody's choice; a click on a man with the ring up is still him, and the
   *  who key, where it has one, still steps (both until `wholeSquad`, below). false: the wheel steps who, as it was built. Off here and on the frozen stand (`TPS_WHEELIDLE=1`); the
   *  page raises it (`?wheelidle=0` off) */
  wheelIdle: false,
  /** QUICK ORDERS ARE THE WHOLE SQUAD'S (orders.ts whole(); the maintainer, 10-24: "quick Q mode should always do the whole squad. you should only be
   *  able to issue commands to parts of the squad in plan mode"): with plan mode down, an order from the squad's key or its ring goes to everyone.
   *  Nothing outside plan mode narrows the choice: a click on a man with the ring up is the ring's own click and picks nobody, the who key steps
   *  nobody, a tap or a ring on a teammate is the squad's and not his alone, and plan mode put down puts the orders back with everyone (a chain laid
   *  in the mode keeps the men it was laid for). In plan mode the picks are as they were. false: the choice is stepped and kept, as it was built.
   *  Off here and on the frozen stand (`TPS_WHOLESQUAD=1`, beside `TPS_QPLAN=1`); the page raises it with the mode (`?wholesquad=0` off) */
  wholeSquad: false,
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
  /** (CMDRING.only) it shows the rows its page has no wedge for: ringSeats `over` */ more?: boolean;
  /** (CMDRING.pin) the place it was opened on, and how far from that place's own px its middle stood (CSS px) · the cursor as the ring last read it */
  at?: Vec3; ox?: number; oy?: number; mx?: number; my?: number;
  /** (ringWant `shapes`) the cursor has been off every wedge's shape since the ring last changed under it: on a shape now, it lights it */ clear?: boolean;
  /** (interact.ts, a ring on its thing) the wedge the hand last put the cursor on: a ring that slides under a resting cursor points at no other */ pt?: number }
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
/** (CMDRING.pin) the ring put back over its place — `sx, sy`: where that place is in the view now — whole inside the view's edge, as it was opened */
export function ringPin(R: RingState, sx: number, sy: number, w: number, h: number): void {
  const C = CMDRING, cl = (v: number, m: number, max: number) => max > 2 * m ? Math.max(m, Math.min(max - m, v)) : v;
  R.ax = cl(sx + (R.ox ?? 0), C.edgeX * R.z, w); R.ay = cl(sy + (R.oy ?? 0), C.edgeY * R.z, h);
}
/** The wedge this frame asks for (0: none): a digit's own — which disarms the cursor — else the one the cursor is out of the ring's middle toward, once
 *  the key has been down `tapSecs` and the cursor has been in the middle since the ring last changed under it (a page, a digit, a man, new rows).
 *  `lone`: the digit of the ring's one row where it has one and is drawn as a pill (ringlone.ts loneKey; 0 = the wheel) — the cursor on that pill's
 *  place is on that row. Only the digit: the game reads no words of a ring.
 *  `shapes` (a ring that did not come up under the cursor: handring.ts `onThing`): the digits that have a wedge, a bit each (0 = by direction only, as
 *  above). The cursor ON a drawn wedge — its fifth of the wheel from the hole out as far as its words may lie (the ring's own box, RING_BOX: a row is
 *  pointed at on its words as well as on its slice), or the pill's place — is on that wedge with no visit to the middle, once it has been off every
 *  drawn wedge since the ring last changed under it; a place of the wheel with no wedge is not one, nor anywhere outside the ring's box. */
export function ringWant(R: RingState, input: Input, digit: number, time: number, lone = 0, shapes = 0): number {
  const C = CMDRING, dx = input.mouseX - R.ax, dy = input.mouseY - R.ay, d = Math.hypot(dx, dy), out = d >= C.flickPx * R.z, early = time - R.t0 < C.tapSecs - 1e-6;
  const pill = lone > 0 && onPill(lone, C.wedges, dx / R.z, dy / R.z), at = wedgeAt(dx, dy, C.wedges);
  const on = shapes !== 0 && (lone ? pill : d >= RING_HOLE * R.z && Math.abs(dx) <= RING_BOX.x * R.z && Math.abs(dy) <= RING_BOX.y * R.z && (shapes >> at & 1) === 1);
  if (shapes && !on) R.clear = true;
  if (early) { if (out) R.armed = false; } else if (!out) R.armed = true;
  if (digit) { R.armed = false; R.clear = false; return digit <= C.wedges ? digit : 0; }
  if (early) return 0;
  if (on && R.clear) return lone || at;
  if (!out || !R.armed) return 0;
  return pill ? lone : at;
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

/** a row as the flat tree reads it (orders.ts OrderDef) */
export interface FlatRow extends SeatRow { id: string }
/** (CMDRING.flat) THE FIRST RING'S OWN ORDERS, by the kind of thing it was opened on: each on the same wedge on every thing of that kind — 'fall in'
 *  is 3 and 'hold position' 4 wherever the ring has them, as the menu's digits always had them (a row the level leaves out leaves its wedge empty for
 *  the rest) */
export const FLAT_TOP: Readonly<Record<string, Readonly<Record<string, number>>>> = { floor: { cover: 2, fallIn: 3, hold: 4 }, door: { cover: 2, openClear: 3, bangClear: 4 }, none: { fallIn: 3, hold: 4 }, foe: {} };
/** … and the orders a kind's ring does not carry: they are not about the thing (on a door 'fall in' and 'hold position' gave their wedges to the two
 *  entries; they are on every ring that is not a door's) */
export const FLAT_LEFT: Readonly<Record<string, readonly string[]>> = { door: ['fallIn', 'hold'] };
/** WHICH ROW IS ON WHICH WEDGE OF THE FLAT TREE (CMDRING.flat; the shape ringSeats gives). `rows`: every order of the thing, no row that opens a
 *  page among them · `lead`: the row a tap gives (wedge 1; -1 none — and on its own wedge too where FLAT_TOP names it: on the squad's own ring 3 is
 *  still 'fall in'). FLAT_TOP's rows on their wedges. The rest: where they fit the wedges left, on them — the squad's posture rows (free, the
 *  squad's own menu's) from the last wedge back, so 'go silent' is 5 where the ring has room; else the wedges short of the last take the first of
 *  them and the last is 'more', ONE ring of what remains from wedge 1, the posture row its last. A 'more' never has one row (that row is on the
 *  last wedge itself), and with more left than a ring holds the posture row gives up its place first (it is on the squad's own ring), then the last
 *  tools. The word's own rows are left out (`wordKey`: its key gives them) */
export function flatSeats(rows: readonly FlatRow[], kind: string, wordKey: string, lead: number): { row: number[]; more: number; over: number[] } {
  const W = CMDRING.wedges, row = new Array<number>(W + 1).fill(-1), top = FLAT_TOP[kind] ?? {}, left = FLAT_LEFT[kind] ?? [], rest: number[] = [], last: number[] = [];
  if (lead >= 0) row[1] = lead;
  rows.forEach((r, i) => {
    if (r.opens || r.hotKey === wordKey || left.includes(r.id)) return;
    const k = top[r.id] ?? 0; if (k >= 2 && k <= W && row[k] < 0) { row[k] = i; return; }
    if (i === lead) return;
    (r.free && !r.hotKey && (r.listed ?? r.targets).includes('none') ? last : rest).push(i);   // (the squad's own: its posture — as ringSeats tells them)
  });
  const spare: number[] = []; for (let d = 2; d <= W; d++) if (row[d] < 0) spare.push(d);
  if (rest.length + last.length <= spare.length) { rest.forEach((i, n) => { row[spare[n]] = i; }); last.forEach((i, n) => { row[spare[spare.length - last.length + n]] = i; }); return { row, more: 0, over: [] }; }
  for (const d of spare) if (d < W && rest.length) row[d] = rest.shift()!;   // (wedges a level's own list left empty: the first of the rest)
  const over = rest.length + last.length > W ? rest.slice(0, W) : [...rest, ...last];
  if (over.length === 1) { row[W] = over[0]; return { row, more: 0, over: [] }; }
  return { row, more: over.length ? W : 0, over };
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
