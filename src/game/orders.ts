// SQUAD ORDERS (Game.orders, __orders): Sam's live orders to the operatives on his side — a SWAT 4 / Ready or Not command menu over whatever he is aiming at,
// given to the whole squad (gold), one pair of it (red / blue) or one man.
//
// THE GRAMMAR — Ready or Not's command menu, for a top-down mouse and keyboard (NO KEY IS EVER HELD: the maintainer, 10-04 — "the current approach of needing to hold
// down a key doesn't feel great"). PRESS X (or the MIDDLE MOUSE BUTTON, RoN's own): the menu opens on what the CURSOR is on at that moment (its own world
// point — never the auto-aim's snap) — a DOOR (within ORDERS.doorPickM of a doorway or its leaf; or the cursor on its leaf, or on the floor seen THROUGH its
// doorway: ORDERS.doorRay), a spot on the FLOOR, or NOTHING (himself, a teammate, or nowhere a man can stand) — listing only the orders that fit that target, and STAYS UP, frozen on that target, while Sam walks, aims and turns the camera,
// until an order is PICKED or it is dismissed. A PICK: the row's digit at once (X then 2 — two presses, nothing held), or the wheel / ↑ ↓ to move the highlight
// and SPACE or the MIDDLE BUTTON AGAIN to give the highlighted row (the middle button twice = the target's own first row: move there / stack up / fall in —
// a whole order off the mouse). DISMISSED: X again, Esc or a RIGHT click (from a page of it: back to the first page), the cancel row; also by the page losing focus (Input's one-frame 'Blur' code), by Sam
// going down — and by THE TRIGGER: the left button is Sam's at all times, a left click with the menu up puts it away and fires (one-shot kills both ways: the
// reflex shot at a man coming round the corner must never be read as an order; ORDERS.clickGives turns that round for an A/B — the click gives the highlighted
// row and fires nothing). While it is up the digits are not Sam's weapon slots, the wheel not his pace, a Space press not the selector's, the right click not
// the OCP — everything else of his (WASD, the aim, the trigger, Q / E, F) is his as ever; and the frame the menu OPENS on takes nothing else from the input
// (a digit or a click sharing that frame was meant for the game without it). B = the target's first row AT ONCE, with no menu (RoN's default command). WHO TAKES THE ORDERS (`who`; the HUD always names it): T
// steps RoN's ELEMENT — GOLD (the whole squad) → RED (the red pair) → BLUE (the blue pair) → gold, for a squad dealt into pairs (Guard.unit.pair; the one-pair
// squad of ?roomclear / ?nightbreach steps all → each man, as it always did) — and T with the cursor ON A TEAMMATE addresses that ONE MAN until T is pressed
// again (on him again, or — for a squad in pairs — anywhere: back to everyone); it works with the menu up too (the list is re-read for the new men). The menu
// OPENED on a teammate is that man's alone for that one order, whatever `who` says (T on it: back to everyone; he goes down while it is up: the menu goes too). THE DIGITS ARE FIXED (OrderDef.key): 1 = the target's own order (move there / stack up), 2 = cover, 3 = fall in,
// 4 = hold, on every target — and NO ROW IS EVER ON A DIGIT ABOVE ORDER_DIGITS (5: the maintainer, 10-04 — "it's hard to hit numbers bigger than 5 when left hand is on
// wasd"). A menu with more to offer than that is in PAGES, Ready or Not's way: a row that OPENS a page (OrderDef.opens — 'door tools ▸', digit 5 on a door)
// swaps the list for that page's own rows on 1 up (OrderDef.page), the menu still up on the same target; Esc or a right click there steps BACK to the first
// page — from a page behind a page, to the page it was opened from (X closes it from anywhere). A row may STAND IN for another while something lasts
// (OrderDef.standsIn: on a door whose threshold is held, row 5 is 'threshold held ▸' — what to tell the men on its jambs — where 'door tools ▸' was). register() deals the first page's spare digit (5) and a page's digits from 1, and a row that finds none left has no digit
// (the wheel still reaches it). A row with a key of its own (OrderDef.hotKey — the word: F) shows that key and takes no digit. An order that fits the target but cannot be carried out right now (no path to the spot, a door locked
// against Sam on every way to it, no room at the jambs, no line to cover from) keeps its row, GREYED with the reason (re-asked every ORDERS.refreshSecs while
// the menu stays up, with the door's face re-read off where Sam now stands), and giving it is refused aloud by one of the men ("can't get there."); where only
// ONE man cannot do his part (OrderDef.can) he says so and is left exactly as he was while the others go. A spot whose short way in is locked but which has
// another way round is offered, and the man is walked round (route()).
//
// THE ORDERS (built in below; a later part adds the door tools through register()):
//   fall in      follow Sam: the men file down the trail he has walked (through whatever doors he took) at his own pace plus what closes the gap, close up
//                behind him when he stops — the first man looking on the way the file was going, the last the way they came — at the low ready. When Sam
//                turns back down the file a man in his way steps off his line, lets him through and falls in behind (aside()); once Sam has stopped, a man
//                already near him in plain sight stays where he is (no walking round Sam to an exact place — a lean out past a corner is not followed)
//   hold         stop where he stands, facing as he faces, low ready
//   move there   go to the spot at once, gun up the way he goes (the pair side by side across the line Sam pointed along), and cover on from it the way they were sent
//   cover        stay where he stands and put the gun on the named spot / the named door: a flank watched for as long as the order stands
//   stack up     onto the door's jambs on Sam's side of it, muzzle on the door all the way in — one man a jamb (both in file on the one free side when the other
//                is walled off), bladed to the wall, muzzles on the opening
// The men take turns saying so in a word ('moving.', 'covering.'); a move or a stack is called 'set.' by the last man on once everybody sent is on his mark.
// A man whose gun line Sam walks into (ORDERS.laneIn) lowers the muzzle until he is clear.
// AN ORDER SETS WHERE A MAN IS AND WHERE HE WATCHES — never when he shoots. The men are moved through squad.ts's script runner (Guard.script: nav path, settle
// on the mark, facing, aim point, stance), which has no senses and no trigger. THE SEAM FOR A FIGHT LAYER: a man under orders whose script somebody has ended
// with his state 'alert' (endGuardScript(gd, 'alert') — handed to the fight AI) is left to it while his fight is warm — eyes on somebody, a shot in his ear or
// the hand-over itself inside ORDERS.coldSecs, or mid-reload; or for as long as `fight.engaged(gd)` says, when a fight layer sets the lease (`fight`: engaged /
// yielded / retaken) — rooted on his post by Guard.pinned (ORDERS.pinPosted; free to move under 'fall in'), and taken back onto his order after; `of(gd)` says
// where his order wants him, what it has him watch and (faceNow) which way a follower is facing. assign() lifts whatever hold / pin another owner left on him.
//
// OTHER OWNERS OF THE MEN (`owners`): a drill that moves the squad itself says so here — while it owns a man an order to him first asks it to let go (the night
// breach, nightbreach.ts: a stack not yet sent in is called off, a pair already inside is recalled, the seconds of boot and charge are refused), and a man a drill
// has taken (F: stack up) drops his order.
//
// With no operative on the floor none of this runs: input() and tick() are one pass over the guard list and a return, X, T and the middle button are dead, the HUD gains
// nothing. NOT DONE HERE: who owns a man's script is settled case by case (`owners`, and nightbreach.ts asking has()) — a Director play program or the QRF
// ordering an operative under one of Sam's orders is not arbitrated; the stack's marks are geometry (stackPosts), not tactics.ts's authored clear-plan marks.
// (src/game is one import cycle: nothing below is built from another game module's exports at module load — the knobs are a plain literal, the order table is
// built in the constructor.)
import { Vec3, v3, wrapAngle } from '../math/vec';
import type { Game, Guard, GuardScript, Interactable, PairId } from './game';
import type { Team } from './teams';
import type { Input } from './input';
import { backTake, backName } from './backkey';
import type { Door } from './doors';
import { lostOf, lostShown, type LostMan } from './deathrecap';
import { BoxFlag } from '../scene/boxes';
import type { FollowCamera } from './camera';
import type { View } from '../host/hud';
import { order } from './squad';
import { crossesDoor, frameOf } from './guards';
import { PLAYER_ID, INTERACT_KEY } from './consts';
import { NIGHTBREACH } from './nightbreach';
import { COVER } from './cover';
import { GLASSPEN, GLASSPEN_STATS, glassPenLive, shotThroughGlass, glassTollSig } from './glasspen';   // (GLASS IS NOT COVER: stackPosts → behindGlass; used at order time only, nothing touched at load)
import { shieldDeal } from './shield';
import { sneakFollow, sneakWay, sneaking, sneakLow, sneakPost, sneakTick, sneakWord } from './sneak';
import { unseenMan, unseenLow, unseenFollow, unseenPost, unseenWallSlot, unseenWallLost } from './unseen';
import { roomKept } from './rearwatch';
import { pairUp } from './pairup';
import { spottedFeet } from './spotted';
import { wallTarget, wallRows } from './wallcharge';
import type { WallSpot } from './wallcharge';
import { workNear, workOn, workRows } from './workthings';
import type { WorkThing } from './workthings';
import { DOORMANNERS, DOORMANNERS_STATS, STACK_OWN, doorwayStand, doorwayFile, doorwayLane, doorwayOffLane, doorwayLanePrice, doorwayInWay, doorwayClearNear, doorwayHeld } from './doorway';
import { PICTURE, PICTURE_STATS, anyIdea, exposedFor, pictureQuiet, pictureStep } from './picture';   // (asked inside stackSeen and the file's pose only: src/game is one import cycle)
import { stackLinePace } from './stackline';
import { handleHeld } from './handleside';
import { clearLineFeet, clearLineLive } from './clearline';
import { fitSpots, fitGroups, fitTick, type Fit } from './roomfit';   // (used inside the 'move' order only: nothing of roomfit.ts is touched at load)
import { WORDS } from './words';   // (a leaf: the dialogue pass's one switch)
import { doorSaidName } from './doornames';   // (a leaf: a shorthand door id's said name)
import { propGap } from './roomclear';   // (used inside workedMarks only: nothing of roomclear.ts is touched at load)
import { stackRoomFix, stackViewFix, stackRoomBookKeep, stackRoomHas, stackViewOpen, STACKROOM, STACKROOM_STATS } from './stackroom';
import { HOLDFIRE, holdFireOrder, holdFireOnMan, holdFireSilent } from './holdfire';   // (called / read inside give / tick only)
import { silentOnMan } from './silent';   // (called inside tick only)
import { AUTOPILOT, AUTOPILOT_STATS, autoQuick, autoHint } from './autopilot';   // (read inside input(), hud() and show() only)
import type { LayState } from './planlay';
import { PLANLAY, layable, layOrder, laySend, layGiven, layFresh, layNote, layKey, layPrune } from './planlay';   // (planlay.ts: the menu's 'wait for my word' row lays an order — all read inside methods only)
import { CLOSE } from './close';   // (read inside input() only: the left click that shuts the menu with a man in the arm)
/** where Sam 'stands' while the stack's makers are asked as if he were not there (ownMarkFirst): a place no mark is near */
const NOWHERE: Vec3 = [1e7, 0, 1e7];
/** … and how near a mark handed out must be to the post a man stands on to be that same mark, metres */
export const OWN_EPS = 0.15;
/** ORDERS.inWay: what a man says where the one thing on the stack's places is Sam (the words live here and nowhere else: `noRoomWords` hands them out) */
export const IN_WAY_WORDS = "you're in the way.";
/** … and how near a piece of furniture's footprint a place must be to be the furniture's (onFurniture), metres: a hand's breadth — a place a body's width
 *  off a chair is still a place, the chair is shoved a little */
export const FUR_M = 0.12;
/** how many times a man shouldered off a mark he had goes back for it before the mark comes to him (doorway.ts DOORMANNERS.backOn) */
export const BACK_TRIES = 2;

/** The knobs (__orders.knobs). */
export const ORDERS = {
  /** press: the order menu opens on what the cursor is on and stays up · press again: it closes */
  key: 'KeyX',
  /** the middle mouse button opens it too (Ready or Not's own default) — and, pressed again while it is up, gives the highlighted row */
  mouseOpens: true,
  /** a LEFT click with the menu up: false = it is Sam's trigger as ever (the menu goes away and he fires) · true = it gives the highlighted row and fires nothing */
  clickGives: false,
  /** press: who the orders go to — gold → red → blue for a squad in pairs (all → each man for the one pair) · on a teammate under the cursor: that man */
  whoKey: 'KeyT',
  /** press: the target's own first order at once, no menu (RoN's 'issue default command') — move there on floor, stack up on a door, fall in on nothing */
  quickKey: 'KeyB',
  /** the wheel over the open menu: false = it moves the highlight (the middle button then gives that row: the whole order off the mouse); true = RoN's own — it steps
   *  the element, gold / red / blue, and the rows are picked by their digits (↑ ↓ still move the highlight) */
  wheelElement: false,
  /** press, with the menu up on a door's tools (the squad of four): the door tools given from this page WAIT on the door for the word (a row of its own,
   *  toggled — never a key held down). The menu stays up; the rows it changes say so. `waitKey`: the row's digit, on its page (taken only while no order of
   *  the page is on it; a digit above ORDER_DIGITS is no key at all — nothing of the menu is up there; a key that is not a digit works and is shown as itself). `waitAlt`: a second key for it — the word's own (doortools.ts blowKey), so 'on F' is one key to learn: with a DOOR menu up it is
   *  'wait for my word' (on the door's first page it turns to the tools with the row already on; on the tools it flips it) and it gives the word everywhere
   *  else ('' = none) */
  waitKey: 'Digit5', waitAlt: 'KeyF',
  /** the open menu's men, door face and why-nots are re-read this often (game seconds; a path search per man per row each time) */
  refreshSecs: 1.0,
  /** the reticle within this of a doorway's centre (or of its leaf) is ON that door; within `selfM` of Sam or `manM` of a teammate it is on nobody's floor */
  doorPickM: 1.0, selfM: 1.0, manM: 0.8,
  /** the cursor ON A DOORWAY AS IT IS DRAWN is that door (doorOnRay): its ray crosses the doorway's own rectangle — the frame's width (+ `doorRayPad` a side),
   *  the floor to the leaf's top — with nothing of the scene drawn in front of it there, and lands no farther than `doorRayReachM` from the doorway (and not
   *  by another door, nor with a teammate's or Sam's own body under the cursor). Through an OPEN doorway the ray lands on the room's floor a stride or two past the frame line: by `doorPickM` alone that
   *  is a spot of floor, and the floor's menu has no door rows. The cursor on a door's own LEAF is that door too, wherever Sam stands. False: `doorPickM`
   *  alone, as it was */
  doorRay: true, doorRayPad: 0.08, doorRayReachM: 3.0,
  /** a reticle on something a man cannot stand on (a wall's top, a desk) means the nearest free floor within this of it */
  floorSnapM: 1.0,
  /** the stack: how far off the wall a man stands, how far past the jamb, and the gap to the second man when both file on one side */
  jambOut: 0.55, jambPast: 0.45, fileGap: 0.9,
  /** a stack place needs its line to the doorway's front clear this far to either hand as well (metres; 0 = the one line, as it was): a line along the seam
   *  between two abutting boxes of a wall is no line (stackPostsOn) */
  seamM: 0.03,
  /** THE PAIR'S SECOND PLACE IS FLOOR: with one jamb taken away (a corner, a leaf standing open over it) both of a pair file on the other, and the second
   *  man's place — a stride further along the wall — was handed out unasked: it could lie beyond the next wall, a hundred metres' walk from the door it was a
   *  stack mark for (the office's stair door standing open, the records room's fire exit). True: it is asked like every other place (floor, a line from the
   *  doorway's front, not Sam's); where it is none, he stands behind the jamb man a stride further off the wall, else back from the door (rearPosts), else
   *  the place as it was (never a refusal the older marks did not give). Two of four sent to a door alone are a pair here too. False: handed out unasked */
  secondFloor: true,
  /** a door face with no floor at EITHER jamb and no marks authored for it (a door at the end of an aisle, furniture on its wall): the men work their own
   *  marks out (workedMarks) — the free floor near the door, off the line of the opening, where the room beyond sees least of them; `workSeenM`: metres of
   *  walk a mark the whole far room can see is worth giving up for one it cannot. False: such a face cannot be stacked on and its door tools are refused, as it was */
  workOut: true, workSeenM: 4,
  /** A STACK ON A DOOR ACROSS A PASSAGE (a door that fills the end of a corridor about as wide as itself: room at a jamb for one man or two, no wall to
   *  file along and no floor to either hand for the men behind): the men the jambs have no room for file up BEHIND the jamb men, back down the passage
   *  against its wall, `fileGap` apart — the stack a hallway gets (hallPlaces). Only asked where every older answer was 'no room on that door', so a door
   *  that stacked before stacks as it did. A charge's stand-off, on a face with no other room for one, is such a file from beyond the backblast (any
   *  number of men; a stretch of passage too short for it still refuses the charge). False: 'no room', as it was — three or four men on such a door, and
   *  its door tools with them */
  hallFile: true,
  /** fall in: each man's place back along Sam's trail (metres), a crumb every `crumb` metres of his walking, `trailM` of trail kept */
  followBack: [1.3, 2.4], crumb: 0.4, trailM: 10,
  /** fall in's pace: Sam's own speed plus `gain` × how far the man is off his place, between the walk and `run` — which is no run: the most a teammate's legs
   *  are asked for (guards.ts PACE.max), so a Sam who sprints (4.7) leaves his file behind and it closes up at its own pace when he stops (it was 4.7: the file
   *  sprinted with him) — no gear changes in view */
  run: 2.2, walk: 1.5, gain: 1.5,
  /** Sam stopped: a follower already between `nearM` and his file distance + `bandM` of him, with nothing between them, stays where he is — he does not walk
   *  round Sam to an exact place (Sam leans out past a corner and back: nobody follows the lean into the open) */
  nearM: 0.6, bandM: 0.6,
  /** the squad row's WORD for a follower ('with you' / 'falling in'), which is not `arrived`: 'in place' is a bare 0.8 m line and his goal is dealt again in half
   *  metre jumps, so on a walk it flipped five times a second. The word is latched: on when he is in place, off only once he is `wordFarM` off his place or has
   *  been out of place for `wordHoldS` seconds of game time. Both 0 = the word is `arrived` again. Only the HUD row and the replay trace read it. (Measured
   *  on a 1.55 m/s walk, four men, both stands: out of place 0.05‥0.25 s at a time and up to 1.2 m, three times a second — and, every few seconds a man,
   *  for 1.3‥1.7 s and up to 1.7 m, which is still the file walking: 1.5 m / 0.5 s let those through, four to seven word changes in ten seconds) */
  wordFarM: 2.0, wordHoldS: 2.5,
  /** `fileSpread` (ON in the page — `?filespread=0` — off here and on the frozen harness stand, `TPS_FILESPREAD=1`; a FROZEN_HOLDS row) = Sam stopped: no
   *  two places of the file fall on one spot. The places run back along his trail and, past its end, straight on while there is floor —
   *  so with little or no trail behind him ('fall in' given fresh, a wall or a corner at Sam's back) the last places all stop where the floor does, a
   *  quarter metre apart, and two men shoved each other over one of them for as long as he stood there. A place within this of the place of a man ahead
   *  in the file (`fileApart`), with nothing solid between the two, is dealt again: the nearest floor to it this far from those places and from Sam, out of every
   *  door frame and doorway lane, in Sam's plain view (just over doorway.ts DOORMANNERS.apart, so the manners' own 'standing on a mate' test
   *  passes it). Off = the places as they fall, as it was */
  /** `fileHold` (ON in the page — `?filehold=0` — off here and on the frozen harness stand, `TPS_FILEHOLD=1`; a FROZEN_HOLDS row) = the spread found no floor
   *  for his place and he cannot stop short by its bar (a corner: he stands half a metre from the mate's place, the bar wants `fileApart`): he was handed
   *  the place as it fell, inside a body's room of the mate's, and the two shoved each other over it for as long as Sam stood there (room-clear-four's
   *  storage corner on the page's stand). On: within a stride or two of that place and off every door frame and lane he HOLDS WHERE HE STANDS — asked live
   *  each frame, never kept — and further off he walks on toward it as before. Off = the place as it fell, as it was */
  fileHold: false,
  fileSpread: false, fileApart: 0.9, fileTight: 0.75,
  /** Sam stopped: nobody's place in the file is IN an open doorway — a place that falls within this of a frame's line, inside its span, goes back along the
   *  trail to the first floor clear of it, and the men behind him go back with him (0: places fall where they fall — a man stood in the frame for as long as
   *  Sam stood still: the one way in or out blocked, and the fatal funnel his to stand in) */
  offDoor: 0.8,
  /** `backEnd` (ON in the page — `?backend=0` — off here and on the frozen harness stand, `TPS_BACKEND=1`; a FROZEN_HOLDS row) = `offDoor`'s further back
   *  ENDS WITH THE FLOOR: asking for a place further back along the trail stops the moment it no longer moves the place (the trail and the floor behind it
   *  have run out — Sam stood with no trail beside an open door: every place fell in its frame however far back it was asked). A back distance that cannot
   *  move the place is not a distance the file stands at: it was added in full (2.4 m a man, each man inheriting the one ahead's), the third man's file
   *  distance read 8.3 m, and the 'near enough already' band took a man standing 8.9 m off in plain sight for one in his place. No place moves by this key:
   *  only the number. Off = the full count, as it was */
  backEnd: false,
  /** `inWay` (ON in the page — `?inway=0` — off here and on the frozen harness stand, `TPS_INWAY=1`; a FROZEN_HOLDS row) = a door order refused 'no room on
   *  that door' ONLY because Sam's own body is on a place of the stack is refused in other words: the man says `IN_WAY_WORDS`. The places are asked a second
   *  time as if Sam were not there (`noRoomWords`, by the `samOut` the own-mark rule asks with); where that ask finds a place for every man, the one thing
   *  on the door is him, and the man who speaks says so — in the menu's greyed row too. WORDS ONLY: the order is refused exactly as it was, no place is
   *  dealt from the second ask and no man moves by this key. A door with no room without him says 'no room' as before. Off = 'no room on that door.' */
  inWay: false,
  /** `walkTries` (ON in the page — `?walktries=0` — off here and on the frozen harness stand, `TPS_WALKTRIES=1`; a FROZEN_HOLDS row) = a 'move there' whose
   *  way runs at a door locked against the team that NOBODY HAS TRIED is not refused with the door's name. The refusal read the door's real lock, and told
   *  the player of a lock or a wedge no hand had been on ("store door is locked." on the Mousehole) — where doortools.ts testDoor has the team learn a door
   *  only at its handle. On, and only where DOORTOOLS.testDoor is on: the row is live and the order is taken; the men whose way runs at that door are sent
   *  to its stack marks at a walk (`walkStacks`), the man on the jamb tries the handle as he comes onto his mark, and the order ends there as a door order
   *  ends 'found shut' (doortools.ts walkTried: the same line, the same log, the men left a plain stack on the door). The team knows from then on, and the
   *  same order is refused as it was. A door the team knows, one Sam's ring opens, a spot with another way in, and every other order that asks the same
   *  walk (they would walk a man through the leaf): as they were. No room to stack on that door: 'no room on that door.', the stack's own refusal. Off =
   *  refused at once with the door's name */
  walkTries: false,
  /** Sam walking at a follower inside `asideM` of him and within `asideLane` of his line: the man stands `asideOff` off that line until Sam is past */
  asideM: 2.6, asideLane: 0.8, asideOff: 0.95,
  /** … and he keeps going for that spot this long after Sam's own pace last said so: a man at the team's walk is not always off the line before Sam is on him,
   *  and Sam stopped BY him reads as Sam stopped — the man then took where he stood for his place and the two stood chest to chest in a doorway */
  asideHold: 1.5,
  /** a leg to a mark (move, stack, a point of domination): a brisk, deliberate walk (it was the breach drill's 3.4 run, and 1.7 onto the mark) down to the last
   *  `briskIn` metres, then the slow walk onto it */
  brisk: 2.0, briskIn: 1.8, onto: 1.3,
  /** THROUGH A DOOR (doortools.ts: a man's leg from the stack to his point of domination): the one leg taken at the team's full pace, all the way onto the
   *  point — a deliberate stack, then a committed entry */
  entry: 2.2,
  /** move there, to the pair: the gap between the two spots */
  moveSpread: 0.9,
  /** a man the fight AI has (the seam in the head comment) is back on his order this long after he last saw anybody / heard a shot / was handed over — never
   *  mid-reload; `pinPosted`: he fights from his post (false: the fight layer moves him as it likes and he walks back after) */
  coldSecs: 2.5, pinPosted: true,
  /** Sam within this of the line a man's gun is on (`laneOut` to come back up): the muzzle goes down until he is clear */
  laneIn: 0.45, laneOut: 0.7,
  /** hold: a man on the move stops a stride on (this × his velocity), not on the spot */
  holdStride: 0.15,
  /** a man stopped this long short of his mark is as near as he will get: the mark moves to him */
  stuckSecs: 4,
  /** the squad of four, left holding (holdArcs): men within `holdGroupM` of one another share the approaches out · a doorway this near in a man's arc has his
   *  gun on it (further off, the gun — and its light — is up along the arc: a light on a door three metres away leaves the corridor past it dark) */
  holdGroupM: 4, holdDoorM: 2.0,
  /** THE WAY THERE KEEPS TO CLEARED FLOOR (cleared.ts; the maintainer, 10-08: "they'll route to the room through a different door … even worse they'll go through
   *  uncleared rooms to get there"). `cleared`: a walk to a mark (a stack, a spot, a point inside, his place in the file) goes ROUND a room nobody of the team
   *  has stood in where there is a way round by known floor — each of its cells `clearedDear` times a cell of known floor; the room his mark is in is never
   *  dear, and with no way round he walks through as before (false = the shortest way, as it was). `knownFace`: the squad of four stacks on the face of a
   *  door whose floor the team KNOWS when the other face's it does not — sideFor's count of the men's walks decides only between two known faces or two
   *  unknown (false = the walks alone: with a room's other door standing open the stack was dealt the face INSIDE the room it was sent to clear).
   *  `ownDoor`: a man sent to his point by an entry goes in THROUGH THE ORDERED DOOR — not at it when the word comes, he is walked to its mouth by known
   *  floor first (false = the shortest way to his point from wherever he stands, by whichever door).
   *  `roundCap` (the page: ROUND_CAP — `?roundcap=0` — 0 here and on the frozen harness stand, `TPS_ROUNDCAP=1`; a FROZEN_HOLDS row) = THE WAY ROUND IS TAKEN
   *  ONLY WHEN IT IS WORTH IT (the owner's tape, the floodlit yard 033934 at 1:56.6: a wall charge ordered after a clear from outside, no room yet stood in —
   *  the 12.8 m way, 3.7 m of it across the hall, lost to 28 to 36 m round the outside of the building by the back door and the shut store door, which went
   *  through the store nobody had been in either). A way round that still crosses floor nobody has been on buys nothing unless it crosses clearly less of it (ROUND_LESS of the short way's), and one longer than `roundCap` times
   *  the short way + ROUND_PLUS_M costs more than the room is worth: either is refused and he walks the short way, as he does where there is no way round at
   *  all. Never where the short way is at a lock or through the door he is to stack on. 0 = any way round with less unknown floor on it, as it was.
   *  `roundOwn` (true here: nothing while roundCap is 0; `?roundown=0`): that last holds for a PAIR too, where its way round keeps off that door. The four were always kept from the short way
   *  through the door they are to stack on (`round`); a pair was not, went round it only for the unknown floor beyond, and under the cap lost that way
   *  round — a pair behind the ordered door pulled it open and walked through it to stack on it. false = the cap as it was first made */
  cleared: true, clearedDear: 20, knownFace: true, ownDoor: true, roundCap: 0, roundOwn: true,
};
const WHEEL_STEP = 60;   // px of wheel travel a row (interact.ts)
/** the highest digit a row is ever put on: the number row as far as the left hand reaches off W A S D (the head comment) */
export const ORDER_DIGITS = 5;
const digitOf = (code: string) => /^Digit[1-9]$/.test(code) ? Number(code.slice(5)) : 0;
const keyName = (code: string) => code.replace(/^Key|^Digit/, '');
const COMPASS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];   // yaw 0 = +z = south, π/2 = +x = east
const flat = v3.distXZ, yawTo = v3.yawTo;
const compass = (yaw: number) => COMPASS[((Math.round(yaw / (Math.PI / 4)) % 8) + 8) % 8];

/** What the menu was opened on. `man`: the reticle was on that teammate — the order is his alone. */
export type OrderTarget =
  | { kind: 'floor'; at: Vec3; wall?: WallSpot; thing?: WorkThing }   // (wall: the point is on a wall a charge might go on — wallcharge.ts · thing: it is the spot a man stands on to work a thing — workthings.ts)
  | { kind: 'door'; at: Vec3; door: Door; side: 1 | -1 }
  | { kind: 'none'; at: Vec3; man?: Guard }
  /** a man of the other side (pairorders.ts: only while its switch offers him — SquadOrders.people; `at` is where he stood when the menu was opened) */
  | { kind: 'foe'; at: Vec3; foe: Guard };
export type TargetKind = OrderTarget['kind'];
/** who the orders go to: the whole squad, one PAIR of it ('red' / 'blue' — Guard.unit.pair, dealt at the staging: nightbreach.ts), or one man by his place on
 *  the roster (0 = the first operative on the guard list). SquadOrders.men() is the one place that turns any of these into a list of men. */
export type Who = 'all' | PairId | number;
/** how an order is given. `onWord`: the men get ready for it and WAIT — a door tool stacks and holds on the door until the word (doortools.ts go(), the 'go'
 *  order); an order with nothing to wait for takes no notice */
export interface GiveOpts { onWord?: boolean; /** the men it goes to, exactly (autopilot.ts: the men standing on the door — not the standing choice, which may hold a man left elsewhere) */ men?: Guard[] }
/** a stack mark (stackPosts): where, facing, which shoulder the wall is on, whether he is the man ON the jamb — and, for three men or more, which file he is in
 *  (0 = the latch jamb's, 1 = the hinge jamb's, 2 = the second rank): pair() keeps a pair in one file where it can */
export interface StackPost { pos: Vec3; face: number; stackSide: -1 | 1; lead: boolean; group?: number }

/** One order on the menu. `issue` hands each man his assignment (SquadOrders.assign) — or runs something of its own — and returns a reason when it cannot be done. */
export interface OrderDef {
  id: string;
  /** the row's words (may read the target: 'cover this door') */
  label: string | ((t: OrderTarget) => string);
  /** the targets it is offered on */
  targets: TargetKind[];
  /** its digit on the menu, 1 to ORDER_DIGITS — the same on every target it is offered on (1 the target's own order, 2 cover, 3 fall in, 4 hold; register()
   *  deals the first page's 5, and a page's own from 1). Absent: none (the wheel reaches the row; `hotKey` may) */
  key?: number;
  /** the page of the menu its row is on (absent: the first) — it is listed only once the row that `opens` that page has been picked */
  page?: string;
  /** it is not an order: picking its row turns the menu to this page (the menu stays up, on the same target). `issue` is never run */
  opens?: string;
  /** the targets whose MENU lists it, when that is fewer than it fits (absent: `targets`) — the word fits a door (give('go') with the reticle on one) and has
   *  no row on a door's menu */
  listed?: TargetKind[];
  /** a key of its own that gives it with or without the menu (the word: doortools.ts blowKey — read there, where it picks this row while a menu shows it):
   *  its row shows that key and takes no digit */
  hotKey?: string;
  /** a `hotKey` row whose key works only while its own page is the one showing: the row that opens that page does not advertise it (the frag row: G) */
  pageOnly?: boolean;
  /** this man can do his part of it (absent / true), or the word he says for why not ("can't get there."): he is left out — and keeps whatever he was doing,
   *  his drill included — while the others go */
  can?: (S: SquadOrders, gd: Guard, t: OrderTarget) => true | string;
  /** the men among those addressed this order is FOR (absent: all of them) — the rest are left exactly as they were, without a word and with no owner asked
   *  to let go of them (the word: only the men waiting on it) */
  only?: (S: SquadOrders, men: Guard[], t: OrderTarget) => Guard[];
  /** the men who can, together, can carry it out here (absent / true), or not: false, or the word for why not. With nobody able, or this failing, its row is
   *  greyed — not gone — with the reason */
  valid?: (S: SquadOrders, t: OrderTarget, men: Guard[]) => boolean | string;
  /** hand each man his assignment */
  issue: (S: SquadOrders, men: Guard[], t: OrderTarget, opts?: GiveOpts) => string | void;
  /** once a frame for each man under it, before he is posed: a door tool's own stages (it may rewrite his Assignment, or re-assign him) */
  tick?: (S: SquadOrders, gd: Guard, A: Assignment) => void;
  /** what the man who takes it says (one of, in turn) */
  ack?: string[];
  /** it can be given ON THE WORD (GiveOpts.onWord means something to its issue): with the menu's 'wait for my word' row on, its row says so and gives it that way */
  onWord?: boolean;
  /** it moves nobody (the squad's posture: silent.ts): no drill that owns a man is asked to let go of him for it, and it is not logged as an order (a
   *  scenario that starts its clock on Sam's first order does not start it on this) */
  free?: boolean;
  /** the header its row sits under on the menu when it is not about what the menu was opened on (the word: WORD_HEAD) — absent: 'on <the target>' */
  head?: string;
  /** it STANDS IN for another row while `when` says so: listed in that row's place, on that row's digit and page, and that row is not listed (a door whose
   *  threshold is held — doortools.ts: 'threshold held ▸', what to tell the men on its jambs, where 'door tools ▸' is otherwise). Registered after the row
   *  it stands in for (and seated again with it if that row is registered again). `men`: who the menu's orders go to. The menu re-reads its list the frame
   *  a stand-in comes or goes, and a page OPENED by one every frame */
  standsIn?: { for: string; when: (S: SquadOrders, t: OrderTarget, men: Guard[]) => boolean };
}
/** the menu's header over the rows that are about the WORD rather than the target (doortools.ts's 'go' row, the 'wait for my word' row) */
export const WORD_HEAD = 'on your word';
/** Where an order has a man. `post` null = he follows Sam (`follow` = his place in the file); `watch` = the point his gun is on once there (null: none — he faces
 *  `face`); `goal` is the Vec3 object the script runner is walking him to this leg. */
export interface Assignment {
  order: string; t0: number;
  post: Vec3 | null; follow: number;
  face: number | null; watch: Vec3 | null; door: Door | null;
  /** on the way to his mark he keeps his chest on `face` and side-steps his path (the runner's strafe) — doortools.ts threatFirst: the first man in, on a
   *  place the team knows an enemy to be; unset = a walker faces the way he goes, as ever */
  strafe?: boolean;
  /** his carriage once there, and (`move`, when it differs) on the way: a leg to a mark is run with the gun up — ahead, or on `watch` */
  stance: NonNullable<GuardScript['stance']>; upper: NonNullable<GuardScript['upper']>; stackSide: -1 | 1;
  move: { stance: NonNullable<GuardScript['stance']>; upper: NonNullable<GuardScript['upper']> } | null;
  /** the HUD's words for him: on his way, and once there */
  going: string; there: string;
  /** what is called once every man of the order (`group`) is on his mark — said once, by one of them */
  setLine: string | null; group: number; setSaid: boolean;
  goal: Vec3; arrived: boolean;
  /** `arrived` is by the silent order this frame: on his stack mark with his round held on a man, his gun not on the door (silent.ts silentOnMan) */
  heldSet?: boolean;
  /** as of the orders' last tick: on his stack mark with the man the room fight has him on one hold fire will not let him shoot (holdfire.ts holdFireOnMan), his gun on the door or not — doortools.ts testStacks reads it for every man of the stack */
  heldFire?: boolean;
  /** when he got onto his mark (who calls 'set.': the last man on) · when he last moved (a man stopped short) · his weapon light as the order found it ·
   *  the muzzle is down for Sam in its line · when the fight layer was handed him (−1: it has not got him) · which way he faces right now under 'fall in' */
  arrT: number; movedT: number; light: boolean | undefined; low: boolean; yieldT: number; faceNow: number | null;
  /** he is SEARCHING on this order (going into a room, slicing one from outside): the one thing an order can say that lights his weapon light (guards.ts LIGHTS) */
  search?: boolean;
  /** … and the last time whoever runs that search said he was still at it (a man on his point with his muzzle still going over the room has not settled) */
  searchT?: number;
  /** waypoints to his post, in order, when the plain shortest way there runs through a door locked against Sam (route()) — empty otherwise · where he was when he last moved */
  via: Vec3[]; anchor: Vec3; mark: Vec3; markT: number;
  /** the mark he has stood on (the very `post` object: a mark dealt again is another) · how often he has gone back for it since he last stood square on it (DOORMANNERS.backOn) */
  had?: Vec3 | null; backN?: number;
  /** the squad of four: a doorway his walk to the mark must not go through while there is another way (the door he is sent to STACK on: a pair sent to a
   *  room's second door goes round to it, not through the room) — null: none */
  shy: Door | null;
  /** the door an entry sends him in by (ORDERS.ownDoor: his way to a point inside goes through it, whatever is shorter) — undefined / null: none */
  thru?: Door | null;
  /** fall in, a way round an uncleared room (ORDERS.cleared): the place in the file `via` was worked out for · when it was last asked */
  viaFor?: Vec3; viaT?: number;
  /** his pace for the whole leg (an entry: ORDERS.entry) — undefined: `brisk` down to the last `briskIn` metres, then `onto` */
  pace?: number;
  /** his EYES are spare on this order: his feet and his mark are the order's, but the unasked cover (cover.ts) may deal him an opening to watch — a stack's
   *  last man (the way they came, not the door three guns are already on), the men an entry has left holding a room (its other doors, not the wall across
   *  it). With nothing dealt the order's own `watch` stands. `from`: where he was when the order came (a stack's last man: his rear is the way he came). */
  spare?: boolean; from?: Vec3;
  /** pairorders.ts: the man of the other side this order is about · he walks it, and holds it, on a knee (undefined: standing, as every other order) */
  foe?: Guard; crouch?: boolean;
  /** roomfit.ts: the place and the watch a 'move' dealt him — taken up as he comes onto his mark, looked at again while he stands (undefined: none) */
  fit?: Fit;
  /** ORDERS.walkTries: his walk runs at a door nobody of the team has tried — the door and the face he comes to it by, the stack mark he was dealt on it,
   *  the spot the order named (`at`) and (`on`) the order he was given, his again if the handle turns after all and the walk asks nothing more of him
   *  (doortools.ts walkTried, walkOn; undefined: none) */
  tries?: { door: Door; side: 1 | -1; post: StackPost; at: Vec3; on: Pick<Assignment, 'order' | 'post' | 'face' | 'going' | 'there'> & Partial<Assignment> };
}
/** What a SECOND CAST of these orders and the door tools says of itself (squadcast.ts — men who are not Sam's, run through this class and doortools.ts as
 *  they stand): who its men are, whose side a can of theirs is, and the keys they carry. With none (Sam's squad) every answer is what it always was. */
export interface OtherCast { mine(gd: Guard): boolean; team: Team; ring: ReadonlySet<string> }
/** Somebody else who moves the squad (a drill): see the head comment. */
export interface SquadOwner {
  name: string;
  /** it is moving this man right now */
  owns(gd: Guard): boolean;
  /** an order has come for him: let go (null), or say why not. `ctx`: the order, its target, everybody it is going to */
  release(gd: Guard, ctx?: { order: OrderDef; target: OrderTarget; men: Guard[] }): string | null;
  /** the HUD's words for a man with no order of Sam's (null: none) */
  status?(gd: Guard): string | null;
}
/** which of RoN's elements a row is about, for the panel's colours: 'gold' the whole squad, 'red' / 'blue' a pair or a man of it (absent: the panel's own green) */
export type Tone = 'gold' | PairId;
/** the interaction panel's row (ui/overlay.ts InteractRow, structurally — this module imports nothing from the UI). `tone` on the row colours its header, on an
 *  option that line. */
export interface OrderHudRow { kind: Interactable['kind']; label: string; opts: { key: string; text: string; tone?: Tone; /** a man of the squad who is down, while deathrecap.ts's live rule draws: the panel strikes his line · his record there, if the game kept one: the way it came from once the squad has it */ gone?: boolean; lost?: LostMan }[]; inReach: boolean; off: boolean; cont?: boolean; tone?: Tone; }
/** the panel while the menu is up (hud().menu): its rows, the highlighted one, the line over the list and the cancel row's words */
export interface OrderHudMenu { rows: OrderHudRow[]; primary: number; more: number; open: boolean; hint: string; cancel: string; }
/** a line for the squad's HUD block (SquadOrders.notes): plain words, or a key with what it does */
export type OrderNote = string | { key: string; text: string };
/** The menu while it is up. `target` is what it was opened on (a door's `side` is re-read off where Sam stands, refresh()); `men` who an order from it goes to
 *  now; `why` per row: why it cannot be done here (greyed), or null; `sel` the highlighted row (rows.length = the cancel row); `readT` when men / why were last read. */
interface Menu { target: OrderTarget; men: Guard[]; rows: OrderDef[]; why: (string | null)[]; sel: number; wheelAcc: number; readT: number;
  /** the page of it that is showing (null: the first — turn()) */
  page: string | null;
  /** the 'wait for my word' row is offered (a door, the squad of four, a row of this page that can wait) — it sits at index rows.length, the cancel row after it · it is on */
  wordRow: boolean; onWord: boolean;
  /** a door, the squad of four: the face of it `men` will work from (forMen — path searches, so kept: asked again only when `sideKey`, the men + Sam's own
   *  face, changes) — null: Sam's own face (the pair build; not a door) */
  menSide: 1 | -1 | null; sideKey: string; }
/** The fight layer's lease on a man under orders (SquadOrders.fight — the head comment's seam, made explicit). */
export interface FightLease {
  /** he is still fighting: leave him to it (absent: the built-in test — eyes / a shot / the hand-over inside coldSecs, or mid-reload) */
  engaged?(gd: Guard, A: Assignment): boolean;
  /** the orders have stood back from him · have taken him back */
  yielded?(gd: Guard, A: Assignment): void; retaken?(gd: Guard, A: Assignment): void;
}

/** a follower's latched word (ORDERS.wordFarM / wordHoldS), by the order it is of. Held HERE and not on the Assignment: nothing that copies, spreads, prints or
 *  compares an order's state can pick it up, and a new order starts without one. Written by the squad's tick alone (`followWord`), read by `shownThere` */
const FOLLOW_WORD = new WeakMap<Assignment, { on: boolean; outT: number }>();

export class SquadOrders {
  readonly knobs = ORDERS;
  /** the menu's orders, top to bottom (register() adds to it) */
  readonly defs: OrderDef[] = [];
  readonly owners: SquadOwner[] = [];
  /** more lines for the squad's HUD block, from whoever has something to say there (doortools.ts: what is left, a charge waiting for the trigger) */
  readonly notes: (() => OrderNote[])[] = [];
  /** the squad's posture (silent.ts): its word for the HUD block's header ('SILENT' / 'loud'; null: none shown), the mark a row carries on the menu, and
   *  what giving a row does to it (a loud tool ends silent) — null: no posture */
  posture: { word(): string | null; mark(def: OrderDef): string; given(def: OrderDef): void } | null = null;
  /** the men of the OTHER side a menu can be opened on (pairorders.ts — null, or both answering null: nobody; a person is never a target): the one nearest a
   *  point, with how near · the one a cursor ray lands on nearer than `max` along it */
  people: { near(at: Vec3): { gd: Guard; d: number } | null; ray(ro: Vec3, rd: Vec3, max: number): Guard | null } | null = null;
  who: Who = 'all';
  menu: Menu | null = null;
  /** what was ordered when (the probes read it; capped) */
  log: { t: number; order: string; who: string[]; target: string; /** the quick key gave it with the autopilot on (autopilot.ts: its plan is drawn a little longer) */ auto?: boolean; /** the word's key sent it off a laid plan (planlay.ts) */ laid?: boolean }[] = [];
  /** the plan laid for the word, and the one kept for the next try (planlay.ts — nothing is ever in it with that switch off) */
  readonly lay: LayState = { laid: [], kept: null, keptFor: '', tryKey: '', started: false, sending: false, restoredT: -1 };
  /** the order being given is the SEAT's own, at once (the menu's pick, the quick key) — not a scenario's, a tool's or the plan's (planlay.ts strikes its men off a laid plan) */
  private byHand = false;
  /** the squad's own changes of plan, newest last: who, when (autopilot.ts AUTOPILOT.replan — PICTURE ONLY: floorplan.ts draws these men for a moment as it
   *  does an order just given; nothing of the game reads it, it is no order and starts no clock) */
  shows: { t: number; who: string[] }[] = [];
  /** a module that changed these men's plan with nobody asking says so (doortools.ts haltAt): drawn for a moment, with the autopilot's switch on */
  show(men: Guard[]) { if (!AUTOPILOT.on || !AUTOPILOT.replan) return; this.shows.push({ t: this.g.time, who: men.filter(m => m.state !== 'dead').map(m => m.callsign) }); if (this.shows.length > 16) this.shows.splice(0, 8); AUTOPILOT_STATS.shows++; }
  private asg = new Map<Guard, Assignment>();
  private trail: Vec3[] = [];
  private back: Vec3 = [0, 0, -1];   // which way 'behind Sam' lies past the trail's end: fixed when the trail is seeded, never his live facing (he turns with the reticle)
  private view: { input: Input | null; cam: FollowCamera | null; canvas: View | null } = { input: null, cam: null, canvas: null };
  private hov: { x: number; y: number; t: number; v: OrderTarget } | null = null;   // hover()'s last answer, while the cursor rests   // this frame's cursor and camera, kept for the HUD's own look at what the cursor is on (hud() — never read by the simulation)
  private escUsed = false;  // Esc closed the menu since the last frame (Game.escape, from the page's key handler): that press is not the selector's as well
  private ours = new WeakSet<Guard>();   // men whose Guard.pinned this module set (the fight seam): unpinned when their order goes
  private acks = 0; private group = 0;
  private roster: Guard[] = [];
  private samP: Vec3 = [0, 0, 0]; private samT = -1; private samV = 0; private samDir: Vec3 = [0, 0, 1];   // Sam's speed over the ground, measured (fall in's pace: his own vel reads 0 under a teleporting harness)
  /** the fight layer's lease (null: the built-in cold test) */
  fight: FightLease | null = null;
  /** authored marks for a door face whose jambs have no floor (stackPosts finds none there): where the men stack on it — the first opens it, the rest file up
   *  behind him — and, for the door tools' charge, where they stand off. Whoever stages a scenario on such a door adds them and takes them away again
   *  (rescue.ts: the side door from the server room, its racks at both jambs); empty otherwise, and never read where the geometry has an answer */
  readonly doorMarks: { door: Door; side: 1 | -1; stack: Vec3[]; standoff: Vec3[] }[] = [];
  constructor(private g: Game, private cast: OtherCast | null = null) {
    const low = LOW;
    this.defs.push(
      { id: 'move', key: 1, label: 'move there', targets: ['floor'], ack: ['moving.', 'on it.'], can: (S, gd, t) => S.walkTry(gd, t.at) ? true : S.reach(gd, t.at) ?? true,
        valid: (S, t, men) => { const w = S.walkStacks(men, t.at); return typeof w === 'string' ? w : true; },   // (ORDERS.walkTries: a door nobody has tried is walked up to — where it has room for them)
        issue: (S, men, t) => {
        const sam = g.player.char.pos; const face = flat(sam, t.at) > 0.3 ? yawTo(sam, t.at) : g.player.char.bodyYaw;
        // (roomfit.ts: a place and a watch each that fit the room — its ways in, what is cleared beyond them; null with its switch off: the line abreast)
        const rest = S.men().filter(m => !men.includes(m)), fits = fitSpots(g, t.at, men.length, face, sam, [sam, ...rest.map(m => S.of(m)?.post ?? m.char.pos)], rest.map(m => S.of(m)?.fit?.key ?? '').filter(k => k));   // (the room kept: Sam's, and every other man's mark — where he is walking to, not where he is)
        const spots = fits ? null : S.spotsAt(t.at, face, men.length), deal = fits ? S.pair(men, fits.map(f => f.pos), fitGroups(fits)) : S.pair(men, spots!, spots!.map((_, i) => i >> 1));
        const at = S.walkStacks(men, t.at); if (typeof at === 'string') return at;   // (ORDERS.walkTries; null with the key off — every man his place, as ever)
        for (const [gd, p] of deal) { const on = { order: 'move', post: p, face, stance: 'none' as const, upper: 'aim' as const, going: 'moving', there: 'in position', setLine: 'set.', ...(fits ? { fit: fits.find(f => flat(f.pos, p) < 1e-6) } : {}) }, T = at?.get(gd);
          if (T) S.walkSend(gd, T, t.at, on); else S.assign(gd, on); }
      }, tick: (_S, gd, A) => fitTick(g, gd, A) },
      { id: 'stack', key: 1, label: 'stack up', targets: ['door'], ack: ['stacking up.', 'on the door.'], valid: (S, t, men) => {
        if (t.kind !== 'door') return false;
        const posts = S.stackPostsWait(t.door, t.side, men); if (!posts) return S.noRoomWords('no room on that door.', () => S.stackPostsWait(t.door, t.side, men));   // (ORDERS.inWay: … or that it is Sam who is in the way, where it is)
        for (const [gd, p] of shieldDeal(S.pair(men, posts.map(x => x.pos), posts.map(x => x.group ?? 0)), posts, t.door, m => S.pairOf(m))) { const w = S.reach(gd, p); if (w) return w; }
        return true;
      }, issue: (S, men, t) => {
        if (t.kind !== 'door') return 'no door';
        const posts = S.stackPostsWait(t.door, t.side, men); if (!posts) return S.noRoomWords('no room to stack on that door', () => S.stackPostsWait(t.door, t.side, men));
        const name = doorWords(t.door);
        shieldDeal(S.pair(men, posts.map(p => p.pos), posts.map(p => p.group ?? 0)), posts, t.door, m => S.pairOf(m)).forEach(([gd, p]) => { const P = posts.find(x => x.pos === p)!;   // (shieldDeal — shield.ts: a man carrying the shield takes the lead's mark)
          S.assign(gd, { order: 'stack', post: P.pos, face: P.face, watch: [t.door.frameCentre[0], 1.05, t.door.frameCentre[2]], door: t.door, shy: t.door, stance: P.lead ? 'stack' : 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}`, setLine: 'set.' }); });
        S.spareRear(men, t.door, null);
      } },
      { id: 'cover', key: 2, label: t => t.kind === 'door' ? 'cover this door' : 'cover that way', targets: ['floor', 'door'], ack: ['covering.', "i've got it."],
        can: (S, gd, t) => S.hasLine(gd, t) || 'no line from here.', issue: (S, men, t) => {
        const watch: Vec3 = [t.at[0], 1.1, t.at[2]];
        for (const gd of men) { const p = gd.char.pos; const yaw = yawTo(p, watch); const words = `covering ${t.kind === 'door' ? doorWords(t.door) : compass(yaw)}`;
          S.assign(gd, { order: 'cover', post: [p[0], 0, p[2]], face: yaw, watch, door: t.kind === 'door' ? t.door : null, stance: 'none', upper: 'aim', going: words, there: words }); }
      } },
      { id: 'fallIn', key: 3, label: 'fall in', targets: ['floor', 'door', 'none'], ack: ['on you.', 'with you.'], issue: (S, men) => {
        const taken = new Set<number>(); for (const [gd, A] of S.asg) if (A.post === null && !men.includes(gd)) taken.add(A.follow);   // (a man already in the file keeps his place)
        const near = (gd: Guard) => flat(gd.char.pos, g.player.char.pos);
        const pairNear = (gd: Guard) => { const id = S.pairOf(gd); return men.length > 2 && id ? Math.min(...men.filter(m => S.pairOf(m) === id).map(near)) : near(gd); };   // (three or more: a pair files together — the pair with the nearer man first)
        let k = 0; for (const gd of [...men].sort((a, b) => pairNear(a) - pairNear(b) || (men.length > 2 && S.pairOf(a) !== S.pairOf(b) ? (S.pairOf(a) ?? '').localeCompare(S.pairOf(b) ?? '') : 0) || near(a) - near(b))) { while (taken.has(k)) k++; taken.add(k);
          S.assign(gd, { order: 'fallIn', post: null, follow: k, face: null, ...low, going: 'falling in', there: 'with you' }); }
      } },
      { id: 'hold', key: 4, label: 'hold position', targets: ['floor', 'door', 'none'], ack: ['holding.'], issue: (S, men) => {
        const posts = men.map(gd => { const p = gd.char.pos, v = gd.char.vel, k = ORDERS.holdStride;   // (a running man plants a stride on, not on the spot)
          const on: Vec3 = [p[0] + v[0] * k, 0, p[2] + v[2] * k], ok = !g.col.nav.isBlocked(on[0], on[2]) && !g.col.solidBlocked([p[0], 0.45, p[2]], [on[0], 0.45, on[2]]);
          return ok ? on : [p[0], 0, p[2]] as Vec3; });
        const arcs = S.big && men.length > 1 ? S.holdArcs(posts) : null;   // (the squad of four: men left holding together take an approach each — holdArcs)
        men.forEach((gd, i) => { const arc = arcs?.[i] ?? null;
          if (arc?.door) S.assign(gd, { order: 'hold', post: posts[i], face: arc.yaw, watch: [arc.door.frameCentre[0], 1.1, arc.door.frameCentre[2]], door: arc.door, stance: 'none', upper: 'aim', light: NIGHTBREACH.opLights, going: 'holding', there: `holding · ${doorWords(arc.door)}` });   // (a door close by in his arc: the gun — and the light on it: a man in a dark doorway is not seen without — is ON it)
          else if (arc) S.assign(gd, { order: 'hold', post: posts[i], face: arc.yaw, watch: [posts[i][0] + Math.sin(arc.yaw) * arc.reach, 1.1, posts[i][2] + Math.cos(arc.yaw) * arc.reach], stance: 'none', upper: 'aim', light: NIGHTBREACH.opLights, going: 'holding', there: `holding · ${compass(arc.yaw)}` });   // (… else out along his arc)
          else S.assign(gd, { order: 'hold', post: posts[i], face: gd.char.bodyYaw, ...low, going: 'holding', there: 'holding' }); });
      } },
    );
    // the night breach's drill (nightbreach.ts) owns the pair from Sam's 'stack up' (F) until the room is called or lost
    this.owners.push({ name: 'nightbreach',
      owns: gd => { const NB = g.nightBreach; return !!NB?.active && NB.drillOps.includes(gd) && NB.ownsPair; },   // (of four, the drill's are the first pair alone: nightbreach.ts drillOps)
      release: gd => { const NB = g.nightBreach; return NB?.active && NB.drillOps.includes(gd) ? NB.callOff() : null; },   // (the drill is the pair's: letting go of one man ends it for both — the other is handed to the fight AI, nightbreach.ts)
      status: gd => { const NB = g.nightBreach; if (!NB?.active || !NB.ops.includes(gd)) return null;
        if (!NB.drillOps.includes(gd)) return NB.state === 'off' ? null : 'standing by';
        switch (NB.state) { case 'staged': return 'waiting'; case 'stacking': return 'stacking · the breach'; case 'set': return 'set · F sends them in'; case 'going': case 'inside': return 'breaching';
          case 'clear': return 'holding the room'; default: return 'holding'; } },
    });
  }

  // ------------------------------------------------------------ the squad
  /** is there a squad to order at all (a living operative unit, outside any show) — the first test of everything here */
  get active(): boolean {
    const g = this.g; if (g.touring || g.quietUtility || g.puppet || g.director?.showing) return false;
    for (const gd of g.guards) if (this.mine(gd) && gd.state !== 'dead') return true;
    return false;
  }
  /** the roster: every operative unit on the guard list, in its order, down or up (a man's place on it is his number for `who`) */
  squad(): Guard[] { return this.g.guards.filter(gd => this.mine(gd)); }
  /** IS HE ONE OF THE MEN THESE ORDERS MOVE: an operative unit — Sam's squad, the one cast there was. A second cast of this class and the door tools
   *  (squadcast.ts: the response team run through the squad's own door and room code) is built with its own answer (OtherCast); every roster here and in
   *  doortools.ts is read through this one test. */
  mine(gd: Guard): boolean { return this.cast ? this.cast.mine(gd) : !!gd.unit && gd.team === 'operative'; }
  /** the player is one of these men's own — nobody stands in his line with a gun up, a can of theirs spares him on their side of the door (Sam's squad: yes) */
  get sams(): boolean { return !this.cast; }
  /** whose side a can of theirs is (combat.ts detonateStun) */
  get team(): Team { return this.cast?.team ?? 'operative'; }
  /** the keys a locked door is tried with for them: Sam's ring and the codes he has learned */
  ring(): ReadonlySet<string> { if (this.cast) return this.cast.ring; const P = this.g.player; return P.codes.size ? new Set([...P.keys, ...P.codes]) : P.keys; }
  /** the living men an order would go to: the teammate under the reticle, else `who` */
  recipients(t?: OrderTarget | null, who: Who = this.who): Guard[] {
    if (t?.kind === 'none' && t.man) return t.man.state !== 'dead' && this.squad().includes(t.man) ? [t.man] : [];
    return this.men(who);
  }
  /** THE ONE PLACE TO ASK FOR MEN: the squad ('all'), a pair ('red' / 'blue'), or a man (his place on the roster, or the Guard himself) → the list, in roster
   *  order. The living by default; `down: true` counts the men down too (a roster for a HUD). Everything that addresses an order — give(), recipients(), the
   *  menu, a later part's pair / man rows — comes through here. */
  men(sel: Who | Guard = 'all', opts: { down?: boolean } = {}): Guard[] {
    const S = this.squad();
    const list = sel === 'all' ? S : typeof sel === 'string' ? S.filter(gd => gd.unit?.pair === sel) : typeof sel === 'number' ? [S[sel]] : S.includes(sel) ? [sel] : [];
    return list.filter(gd => !!gd && (opts.down || gd.state !== 'dead'));
  }
  /** THE SQUAD OF FOUR (any roster of more than two): what a pair does APART from the other — the men's own side of a door (sideFor), an approach each when
   *  left holding (holdArcs), the muzzle down for a teammate in its line, the door tools' word (doortools.ts) — is all behind this; the pair alone never asks */
  get big(): boolean { return this.men('all', { down: true }).length > 2; }
  /** the pair a man was dealt into (null: none — not a teammate, or a squad that is not in pairs) */
  pairOf(gd: Guard): PairId | null { return gd.unit?.pair ?? null; }
  /** the pairs on the roster, in its order (['red', 'blue'] for the four-man squad; ['blue'] for the pair) */
  pairs(): PairId[] { const out: PairId[] = []; for (const gd of this.squad()) { const id = gd.unit?.pair; if (id && !out.includes(id)) out.push(id); } return out; }
  /** is the squad dealt into more than one pair (the four: its elements are gold / red / blue) — or the one pair, stepped man by man */
  get paired(): boolean { return this.pairs().length > 1; }
  /** T: the next ELEMENT — gold → red → blue → gold for a squad in pairs (a pair with nobody standing is passed over; from one man: back to gold); the one
   *  pair: all → the first living man → the next → … → all */
  cycleWho(dir: 1 | -1 = 1): Who {
    const S = this.squad();
    const ring: Who[] = this.paired ? ['all', ...this.pairs().filter(id => this.men(id).length > 0)] : ['all', ...S.map((gd, k) => gd.state !== 'dead' ? k : -1).filter(k => k >= 0)];
    const i = ring.indexOf(this.who);   // (a man of a squad in pairs is not on the ring: −1 → gold, either way)
    return this.who = i < 0 ? 'all' : ring[(i + dir + ring.length) % ring.length];
  }
  /** T with the cursor on a teammate: the orders go to that one man until T is pressed again (false: not a living man of the squad) */
  address(gd: Guard): boolean { const k = this.squad().indexOf(gd); if (k < 0 || gd.state === 'dead') return false; this.who = k; return true; }
  /** who these men are, in a word or two: 'gold' (the whole of a squad in pairs; 'all' for the one pair), 'red' / 'blue' (a whole pair of it), else their callsigns */
  whoWords(men: Guard[] = this.recipients()): string { const S = this.squad().filter(gd => gd.state !== 'dead'); if (men.length === S.length && men.length > 1) return this.paired ? 'gold' : 'all';
    const id = men.length > 1 ? this.pairOf(men[0]) : null; if (id && men.every(gd => this.pairOf(gd) === id) && men.length === this.men(id).length) return id;   // (a whole pair of a bigger squad)
    return men.map(gd => gd.callsign).join(', ') || 'nobody'; }
  /** the element's colour for the panel: gold for the whole of a squad in pairs, a pair's own for that pair or a man of it (undefined: the one pair — no colours) */
  toneOf(men: Guard[]): Tone | undefined { if (!this.paired || !men.length) return undefined; const id = this.pairOf(men[0]); return id && men.every(gd => this.pairOf(gd) === id) ? id : 'gold'; }
  has(gd: Guard): boolean { return this.asg.has(gd); }
  of(gd: Guard): Assignment | null { return this.asg.get(gd) ?? null; }
  /** the tick's one write of a follower's latched word, right after his `arrived`: `d` is how far he is off his place */
  private followWord(A: Assignment, d: number): void {
    const t = this.g.time; let W = FOLLOW_WORD.get(A); if (!W) FOLLOW_WORD.set(A, W = { on: false, outT: -1 });
    if (A.arrived) { W.on = true; W.outT = -1; }
    else if (W.on) { if (W.outT < 0 || t < W.outT) W.outT = t; if (d > ORDERS.wordFarM || t - W.outT >= ORDERS.wordHoldS) W.on = false; }   // (t < outT: a checkpoint took the clock back)
  }
  /** is he SHOWN as there: which of `there` / `going` the squad row and the replay trace print. A follower's is the latch; every other order's is `arrived` */
  shownThere(A: Assignment): boolean { return A.post === null ? FOLLOW_WORD.get(A)?.on ?? A.arrived : A.arrived; }
  /** Add an order to the menu: at the foot (or before the row `before`), on the next free digit of its page — from 5 on the first page (the built-in rows keep
   *  their places and digits whatever is added), from 1 on a page of its own (`page`) — unless it brings its own `key`, and never above ORDER_DIGITS. A row with
   *  a `hotKey` takes none. A later part's door tools come in here: one row that `opens` their page, and the tools on it. */
  register(def: OrderDef, before?: string) {
    this.unregister(def.id);
    const on = (d: OrderDef) => d.listed ?? d.targets, clash = (k: number) => this.defs.some(d => d.key === k && !d.standsIn && (d.page ?? '') === (def.page ?? '') && on(d).some(t => on(def).includes(t)));
    if (def.standsIn) {   // a stand-in: the other row's digit, page and place — the two are never listed together (`before` is not asked)
      const stood = this.defs.find(d => d.id === def.standsIn!.for);
      if (stood) { this.seat(def, stood); return; }
      console.error(`orders: '${def.id}' stands in for '${def.standsIn.for}', which is not registered — listed as a row of its own`); delete def.standsIn;
    }
    if (def.hotKey) def.key = undefined;
    else if (def.key === undefined || def.key < 1 || def.key > ORDER_DIGITS || clash(def.key)) { let k = def.page ? 1 : 5; while (k <= ORDER_DIGITS && clash(k)) k++; def.key = k <= ORDER_DIGITS ? k : undefined; }   // (no digit left: the wheel still reaches the row)
    const i = before ? this.defs.findIndex(d => d.id === before) : -1; this.defs.splice(i < 0 ? this.defs.length : i, 0, def);
    for (const s of this.defs.filter(d => d.standsIn?.for === def.id)) { this.defs.splice(this.defs.indexOf(s), 1); this.seat(s, def); }   // (registered again: its stand-ins move with it)
  }
  /** open a fresh group (the men whose arrival one 'set.' waits on) — give() does it for every order; a tool that re-assigns men in stages may want its own */
  newGroup(): number { return ++this.group; }
  unregister(id: string) { const i = this.defs.findIndex(d => d.id === id); if (i >= 0) this.defs.splice(i, 1); }
  /** Take the men off their orders (all of them by default): they stop where they are, still on the runner's script, until somebody orders or releases them. */
  clear(men: Guard[] = [...this.asg.keys()]) { for (const gd of men) { if (this.asg.has(gd) && gd.script && gd.state !== 'dead') order(gd, { goal: null }); this.drop(gd); } if (![...this.asg.values()].some(A => A.post === null)) this.trail.length = 0; }

  // ------------------------------------------------------------ targets and the menu
  /** What a point in the world is, as a target: the nearest of a door (the point within doorPickM of its frame's centre or its leaf), a teammate (manM) and Sam
   *  himself (selfM) — so the reticle on a man stacked beside a door is the man, on the leaf an arm's length ahead of Sam the door; else the free floor at (or
   *  nearest) it; else nothing. (The cursor's own answer is targetUnder: a leaf or a doorway drawn under it is that door.) */
  targetAt(p: Vec3): OrderTarget {
    const g = this.g, K = ORDERS, sam = g.player.char.pos, at: Vec3 = [p[0], 0, p[2]];
    let door: Door | null = null, dd = K.doorPickM;
    for (const d of g.doors.list) { const m = Math.min(flat(d.frameCentre, at), flat(d.pos, at)); if (m < dd) { dd = m; door = d; } }
    let man: Guard | null = null, dm = K.manM;
    for (const gd of this.squad()) { const m = flat(gd.char.pos, at); if (gd.state !== 'dead' && m < dm) { dm = m; man = gd; } }
    const ds = flat(sam, at);
    const fo = this.people?.near(at) ?? null;   // (pairorders.ts: a man of the other side nearer the point than a door, a teammate or Sam himself)
    if (fo && !(door && dd < fo.d) && !(man && dm < fo.d) && !(ds < K.selfM && ds < fo.d)) return { kind: 'foe', at: [fo.gd.char.pos[0], 0, fo.gd.char.pos[2]], foe: fo.gd };
    const wk = workNear(g, at);   // (workthings.ts: a thing a teammate can work — the breaker, the mission's thing — nearer the point than a door, a teammate or Sam himself; null with its switch off)
    if (wk && !(door && dd < wk.d) && !(man && dm < wk.d) && !(ds < K.selfM && ds < wk.d)) return wk.target;
    if (man && !(door && dd < dm) && !(ds < K.selfM && ds < dm)) return { kind: 'none', at, man };
    if (door && !(ds < K.selfM && ds < dd)) return { kind: 'door', at: [door.frameCentre[0], 0, door.frameCentre[2]], door, side: sideOf(door, sam) };
    if (ds < K.selfM) return { kind: 'none', at };
    const spot = this.freeSpot(at); return wallTarget(this.g, at, spot ? { kind: 'floor', at: spot } : { kind: 'none', at });   // (wallcharge.ts: a floor target under a wall carries the wall)
  }
  /** The door a ray is ON AS DRAWN (ORDERS.doorRay): the nearest door whose doorway rectangle — the frame line across its width, the floor to the leaf's top —
   *  the ray crosses with nothing of the scene nearer along it than a hand's width short of the frame line (a shut leaf lies in that plane; a wall or a desk
   *  in front of the doorway hides it). `tScene`: how far the ray runs before it lands on the scene (Infinity: on nothing). */
  doorOnRay(ro: Vec3, rd: Vec3, tScene = Infinity): Door | null {
    const pad = ORDERS.doorRayPad; let best: Door | null = null, bt = Infinity;
    for (const d of this.g.doors.list) {
      const th = d.def.closedDir, ax = Math.cos(th), az = Math.sin(th), c = d.frameCentre;   // (the frame line's own direction; its normal is (−az, ax))
      const dn = rd[2] * ax - rd[0] * az; if (Math.abs(dn) < 1e-4) continue;   // (along the wall: no face of the doorway is shown)
      const t = ((c[2] - ro[2]) * ax - (c[0] - ro[0]) * az) / dn; if (!(t > 0) || t >= bt) continue;
      if ((t - tScene) * Math.abs(dn) > 0.1) continue;   // the scene is drawn in front of the frame line there
      const y = ro[1] + rd[1] * t; if (y < 0 || y > d.height) continue;
      const u = (ro[0] + rd[0] * t - c[0]) * ax + (ro[2] + rd[2] * t - c[2]) * az; if (Math.abs(u) > d.def.width * 0.5 + pad) continue;
      bt = t; best = d;
    }
    return best;
  }
  /** What the CURSOR is on, for the menu: the teammate its ray lands on, else targetAt of the world point under it — the cursor's own point, not Game.aimPoint
   *  (the auto-aim snaps that to a man's chest within 60 px or a light under the cursor: an order for the floor under a ceiling panel's dot would go to the panel) — and where that
   *  is not a door and the cursor is on a door's own leaf, or on the room seen THROUGH a doorway (doorOnRay), that door: what is DRAWN under the cursor (a
   *  teammate's body, Sam's own, a leaf, a doorway) comes before what is only near its point (a teammate within manM, Sam's feet). */
  targetUnder(input: Input, cam: FollowCamera, canvas: View): OrderTarget {
    const g = this.g, K = ORDERS; if (g.puppet?.aim) return this.targetAt(g.aimPoint);
    const ray = cam.ray(input.mouseX / Math.max(1, canvas.clientWidth), input.mouseY / Math.max(1, canvas.clientHeight));
    const hit = g.engine.world.raycast(ray.ro, ray.rd, 200, undefined, PLAYER_ID);
    const p: Vec3 = hit ? v3.mad(ray.ro, ray.rd, hit.t) : cam.groundPoint(input.mouseX / Math.max(1, canvas.clientWidth), input.mouseY / Math.max(1, canvas.clientHeight), 0) ?? g.aimPoint;
    let man: Guard | null = null, best = hit ? hit.t + 0.3 : 200;
    for (const gd of this.squad()) { if (gd.state === 'dead') continue; const t = gd.char.rayHit(ray.ro, ray.rd, best); if (t >= 0 && t < best) { best = t; man = gd; } }
    const fo = this.people?.ray(ray.ro, ray.rd, best) ?? null;   // (pairorders.ts: a man of the other side under the cursor, nearer than any teammate there)
    if (fo) return { kind: 'foe', at: [fo.char.pos[0], 0, fo.char.pos[2]], foe: fo };
    if (man) return { kind: 'none', at: [man.char.pos[0], 0, man.char.pos[2]], man };
    const wt = hit ? workOn(g, g.engine.world.all[hit.index]) : null; if (wt) return wt;   // (workthings.ts: the cursor on the breaker's own panel is the breaker)
    const base = this.targetAt(p);
    // a door by the point, Sam's own body under the cursor: as ever. Else — floor, Sam's feet, or a teammate only NEAR the point (his body under the cursor was
    // taken above): is the cursor on a door's own leaf, or on the room seen through a doorway? What is drawn under the cursor comes before what is near its point
    if (!K.doorRay || base.kind === 'door' || g.player.char.rayHit(ray.ro, ray.rd, best) >= 0) return base;
    const S = this.sceneHit(ray.ro, ray.rd, hit), box = S.index >= 0 ? g.engine.world.all[S.index] : null, land = S.index >= 0 ? v3.mad(ray.ro, ray.rd, S.t) : p;
    const own = box ? g.doors.list.find(d => d.box === box) : undefined;
    const leaf = own ? (own.off ? null : own) : box ? g.fogOfWar.doorOfBox(box) : null;   // (a door off its hinges: the slab on the floor is not the door — its doorway still is, below; else the leaf under the cursor — or, in the fog of war, the leaf drawn where the team last saw it)
    if (!leaf && base.kind === 'floor' && base.thing) return base;   // (a thing to be worked that the cursor's point is on — workthings.ts — is that thing, seen through a doorway or not; a leaf the cursor is ON is still the door)
    const door = leaf || this.doorOnRay(ray.ro, ray.rd, S.t);
    return door && (door === leaf || flat(door.frameCentre, land) <= K.doorRayReachM) ? { kind: 'door', at: [door.frameCentre[0], 0, door.frameCentre[2]], door, side: sideOf(door, g.player.char.pos) } : base;
  }
  /** what a cursor ray lands on of the SCENE — a wall, a leaf, furniture, the floor — and how far along it: looking through glass and past the men and what they
   *  carry (a box with an owner: the ray is taken on from where it met it, that owner's boxes skipped). `first`: the ray's plain landing, when the caller has it
   *  (the scene's own unless it is glass or a man's). index −1, t Infinity: on nothing. */
  private sceneHit(ro: Vec3, rd: Vec3, first?: { t: number; index: number } | null): { t: number; index: number } {
    const W = this.g.engine.world, skip = BoxFlag.NoShadow | BoxFlag.NoPrimary | BoxFlag.Glass;
    if (first) { const b = W.all[first.index]; if (b && !b.owner && !(b.flags & BoxFlag.Glass)) return { t: first.t, index: first.index }; }
    let t0 = 0, owner = PLAYER_ID;
    for (let k = 0; k < 16; k++) {
      const hit = W.raycast(k ? v3.mad(ro, rd, t0) : ro, rd, 200, skip, owner); if (!hit) break;
      owner = W.all[hit.index]?.owner ?? 0; t0 += hit.t; if (!owner) return { t: t0, index: hit.index };
    }
    return { t: Infinity, index: -1 };
  }
  /** the rows that fit a target's kind on one page of the menu (null: the first), top to bottom (an order that cannot be carried out there right now is still
   *  listed — greyed, with whyNot's word) */
  rowsFor(t: OrderTarget, page: string | null = null, men?: Guard[]): OrderDef[] {
    const on = workRows(this.g, t, page, wallRows(this.g, t, page, this.defs.filter(d => (d.listed ?? d.targets).includes(t.kind) && (d.page ?? null) === page)));   // (wallcharge.ts: a wall's menu · workthings.ts: a thing's own order where 'move there' is)
    if (!on.some(d => d.standsIn)) return on;
    // a row that STANDS IN for another (OrderDef.standsIn): in while its `when` says so — the row it stands in for out — and out otherwise
    const who = men ?? this.recipients(t), ins = on.filter(d => d.standsIn?.when(this, t, who)), out = new Set(ins.map(d => d.standsIn!.for));
    return on.filter(d => d.standsIn ? ins.includes(d) : !out.has(d.id));
  }
  /** a stand-in row put where the row it stands in for is: that row's digit and page, the next place in the table */
  private seat(def: OrderDef, stood: OrderDef) { def.key = stood.key; def.hotKey = stood.hotKey; def.page = stood.page; this.defs.splice(this.defs.indexOf(stood) + 1, 0, def); }
  /** is the 'wait for my word' row offered under these rows (a door, the squad of four, a row among them that can wait) */
  private wordRowOf(t: OrderTarget, rows: OrderDef[]): boolean { return PLANLAY.on ? t.kind !== 'foe' && rows.some(layable) : t.kind === 'door' && this.big && rows.some(d => d.onWord); }   // (planlay.ts: with its switch on, under every menu with an order in it — the row LAYS)
  /** the open menu's page that has the 'wait for my word' row, seen from its first page (null: none, or not on the first page) */
  private wordPage(M: Menu): string | null { return M.page !== null ? null : M.rows.find(d => d.opens && this.wordRowOf(M.target, this.rowsFor(M.target, d.opens, M.men)))?.opens ?? null; }
  /** the digit the open menu's 'wait for my word' row is on (0: none — a row of the page has it, or the knob is not a digit: `waitAlt` flips it) */
  private waitDigit(M: Menu): number { const k = digitOf(ORDERS.waitKey); return M.wordRow && k <= ORDER_DIGITS && !M.rows.some(d => d.key === k) ? k : 0; }
  /** why these men cannot carry that order out on that target (null: they can) */
  whyNot(d: OrderDef, t: OrderTarget, men: Guard[] = this.recipients(t)): string | null {
    if (!d.targets.includes(t.kind)) return 'not here.'; if (!men.length) return 'nobody to take it.';
    let first: string | null = null; const able = d.can ? men.filter(gd => { const w = d.can!(this, gd, t); if (w !== true) first ??= w; return w === true; }) : men;
    if (!able.length) return first ?? 'not here.';
    const v = d.valid ? d.valid(this, t, able) : true; return v === true ? null : typeof v === 'string' ? v : 'not here.';
  }
  private labelOf(d: OrderDef, t: OrderTarget) { return typeof d.label === 'string' ? d.label : d.label(t); }

  /** Issue an order by id (the menu's release, the console, a probe): to `who` (default: the standing choice), on `t` (default: what Game.aimPoint is on now —
   *  the auto-aim's snap included; the menu itself uses targetUnder). Returns null when given, else why not. An order that cannot be carried out there must say
   *  so in `valid`, not from `issue`: by the time issue runs, a drill that owned the men has already let go of them. */
  give(id: string, t: OrderTarget = this.targetAt(this.g.aimPoint), who: Who = this.who, opts?: GiveOpts): string | null {
    const g = this.g; if (!this.active) return 'no squad';
    const def = this.defs.find(d => d.id === id); if (!def) return `no such order '${id}'`;
    if (def.opens) return `'${id}' is a page of the menu, not an order`;
    if (!def.targets.includes(t.kind)) return `'${id}' does not fit a ${t.kind} target`;
    let asked = opts?.men ? opts.men.filter(gd => gd.state !== 'dead' && this.mine(gd)) : this.recipients(t, who); if (!asked.length) { g.msg('nobody to take that order'); return 'nobody to take it'; }
    if (def.only) { const o = def.only(this, asked, t); if (o.length) asked = o; }   // (none of them: `valid` says why)
    this.faceFlip = false; t = this.forMen(t, asked); const flipped = this.faceFlip;
    // the men who can do their part: one who cannot says so and is left exactly as he was (no owner is asked to let go of him)
    const cant: [Guard, string][] = []; const all = def.can ? asked.filter(gd => { const w = def.can!(this, gd, t); if (w !== true) cant.push([gd, w]); return w === true; }) : asked;
    const no = all.length ? this.whyNot(def, t, all) : cant[0][1];
    if (no) { g.say(all.length ? all[this.acks++ % all.length] : cant[0][0], no); return no; }   // (said by a man, not printed: 'can't get there.')
    for (const [gd, w] of cant) g.say(gd, w);
    let why: string | null = null; const men: Guard[] = [];
    for (const gd of all) { const o = def.free ? undefined : this.owners.find(x => x.owns(gd)); const w = o ? o.release(gd, { order: def, target: t, men: all }) : null; if (w) why = w; else men.push(gd); }
    if (!men.length) { g.msg(`${this.whoWords(all)}: ${why}`); return why; }
    this.group++;
    const wasSilent = holdFireSilent(g, def.id);   // (holdfire.ts: 'go loud' told to a squad that IS silent — asked before the row takes it out; false for every other row and with the switch off)
    const refused = def.issue(this, men, t, opts);
    if (typeof refused === 'string') { g.msg(`${this.whoWords(men)}: ${refused}`); return refused; }
    if (flipped) g.cleared.stats.face++;
    const label = this.labelOf(def, t);
    if (!def.free) this.log.push({ t: g.time, order: id, who: men.map(gd => gd.callsign), target: t.kind === 'door' ? `door:${t.door.def.name}` : t.kind === 'floor' ? (t.thing ? `thing:${t.thing.kind}` : `floor:${t.at[0].toFixed(1)},${t.at[2].toFixed(1)}`) : t.kind === 'foe' ? `foe:${t.foe.callsign}` : 'none' }); if (this.log.length > 200) this.log.splice(0, 50);
    if (!def.free && this.byHand) layGiven(g, men);   // (planlay.ts: an order the player gives at once takes its men off a laid plan — never a scenario's own 'fall in'; a return on its first line with the switch off)
    // (Sam's own words, not the menu row's: he does not read out the stock count, the mark is HIS, and a door with no name of its own is not named)
    const said = WORDS.on ? label.replace(/ · (\d+ left|uses .+)$/, '').replace('on your mark', 'on my mark') : label;
    g.msg(`you: ${this.whoWords(men)} — ${said}${t.kind === 'door' && !(WORDS.on && doorWords(t.door) === 'door') ? ` · ${doorWords(t.door)}` : ''}`);
    if (def.ack?.length) { const k = this.acks++; g.say(men[k % men.length], def.ack[Math.floor(k / men.length) % def.ack.length]); }   // (the men take turns answering, each through the lines in turn)
    this.posture?.given(def);
    holdFireOrder(g, def.id, { waits: !!opts?.onWord && this.big, silent: wasSilent });   // (holdfire.ts: an order that means fire starts the fight for a squad nobody has found — a return on its first line with the switch off)
    return null;
  }
  /** Hand a man his assignment (an OrderDef's issue calls this): whatever he was ordered before is replaced, and whatever another owner left on him to keep
   *  him still (Guard.hold / pinned) is lifted — he is ours to move now. */
  assign(gd: Guard, a: Pick<Assignment, 'order' | 'post' | 'face' | 'going' | 'there'> & Partial<Assignment>) {
    const g = this.g, p = gd.char.pos, t = g.time, was = this.asg.get(gd), fighting = !gd.script && gd.state === 'alert';
    gd.hold = gd.pinned = false; this.ours.delete(gd);
    const R = a.post ? this.route(gd, a.post, a.shy ?? null, a.thru ?? null) : null, via = R ? R.via : [];
    if (R?.how) g.cleared.stats[R.how]++;
    this.asg.set(gd, { follow: 0, watch: null, door: null, shy: null, stance: 'lowReady', upper: 'none', stackSide: 1, move: null, setLine: null, light: gd.script ? gd.script.light : was?.light, ...a, group: this.group, setSaid: false, t0: t,
      goal: via.length ? via[0] : a.post ? v3.copy(a.post) : [p[0], 0, p[2]], arrived: false, arrT: -1, movedT: t, low: false, yieldT: was && fighting ? was.yieldT : -1, faceNow: null, via, anchor: [p[0], 0, p[2]], mark: [p[0], 0, p[2]], markT: t });   // (re-ordered while the fight has him: the lease is the same lease)
  }

  /** REAR SECURITY at a door (COVER.stacked): of the men an order has put on it, the last of the file — the one furthest from the frame who is not `lead`
   *  (null: the man nearest it) — and with four or more the last two, have their eyes spare (Assignment.spare): the cover deals them the other ways a man
   *  could come at the stack, and the door stays the others'. One man alone on a door keeps his eyes on it. Returns who. */
  spareRear(men: Guard[], door: Door, lead: Guard | null, from?: Map<Guard, Vec3>): Guard[] {
    const live = men.filter(m => m.state !== 'dead' && this.asg.get(m)?.post); for (const m of live) this.asg.get(m)!.spare = false;
    if (!COVER.stacked || live.length < 2) return [];
    const dist = (m: Guard) => flat(this.asg.get(m)!.post!, door.frameCentre);
    const first = lead && live.includes(lead) ? lead : live.reduce((a, b) => dist(b) < dist(a) ? b : a);
    const rear = live.filter(m => m !== first).sort((a, b) => dist(b) - dist(a) || live.indexOf(b) - live.indexOf(a)).slice(0, live.length >= 4 ? 2 : 1);
    for (const m of rear) { const A = this.asg.get(m)!; A.spare = true; A.from ??= from?.get(m) ?? [A.anchor[0], 0, A.anchor[2]]; }   // (with no way come handed in: where he stands as the order is given)
    return rear;
  }

  /** Esc (Game.escape, ahead of the pause menu): the menu, if it is up, steps back a page — from its first page it is dismissed. True = the press was used here. */
  escape(): boolean { if (!this.menu) return false; if (!this.pageBack()) this.menu = null; this.escUsed = true; return true; }
  /** the page's Esc went to the pause (backkey.ts: Esc is only the pause): that press is nobody's in the tick */

  /** Open the menu on a target (X / the middle button over the cursor's; the console, a probe): it stays up until pick() or close(). False: no squad to order. */
  open(target: OrderTarget = this.targetAt(this.g.aimPoint)): boolean {
    if (!this.active || this.g.player.down) return false;
    const rows = this.rowsFor(target);
    this.menu = { target, men: [], rows, why: [], sel: 0, wheelAcc: 0, readT: -1, page: null, wordRow: this.wordRowOf(target, rows), onWord: false, menSide: null, sideKey: '' }; this.refresh();   // (the highlight starts on the first row — the target's own order: the button twice gives it)
    if (this.menu && PLANLAY.on && PLANLAY.sticky && this.menu.wordRow && this.lay.laid.length) this.menu.onWord = true;   // (planlay.ts: a plan is being laid — the next order is for it too)
    return !!this.menu;
  }
  close() { this.menu = null; }
  /** The open menu turned to a page of it (null: back to its first): that page's rows, on the same target and for the same men, the highlight on its first
   *  row (back on the first page: on the row that opened the page it came from). `onWord`: with its 'wait for my word' row already on, where it has one.
   *  'Wait for my word' is the MENU's, not the page's: flipped on, it stays on through a step back and into the tools again (the first page says so). */
  turn(page: string | null, onWord = false) {
    const M = this.menu; if (!M) return; const from = M.page;
    M.page = page; M.rows = this.rowsFor(M.target, page, M.men); M.wordRow = this.wordRowOf(M.target, M.rows); M.onWord ||= M.wordRow && onWord;
    // (stepped back: the highlight on the row that opened the page it came from — or, that row gone with what it stood in for, on the row now on its digit)
    const opener = from !== null ? this.defs.find(d => d.opens === from) : undefined;
    let sel = M.rows.findIndex(d => !!d.opens && d.opens === from); if (sel < 0 && opener?.key !== undefined) sel = M.rows.findIndex(d => d.key === opener.key && (d.page ?? null) === (opener.page ?? null));
    M.sel = Math.max(0, sel); M.wheelAcc = 0; this.refresh();
  }
  /** a page of the open menu → the page it was opened from: the first, or — a page behind a row of another page ('door tools ▸', then 'work it from the
   *  threshold ▸') — that one (false: there is no menu, or it is on its first page already) */
  pageBack(): boolean { const M = this.menu; if (!M || M.page === null) return false; this.turn(this.defs.find(d => d.opens === M.page)?.page ?? null); return true; }
  /** Give the open menu's row `i` (default: the highlighted one; the cancel row, or none such: nothing) and take the menu down. Null = given, else why not.
   *  Two rows are not orders and leave the menu UP: the 'wait for my word' row (index rows.length, where it is offered) flips, for the row it is meant for —
   *  and a row that opens a page (OrderDef.opens) turns the menu to it ('opened'). */
  pick(i: number = this.menu?.sel ?? -1): string | null {
    const M = this.menu; if (!M) return 'no menu';
    if (M.wordRow && i === M.rows.length) { M.onWord = !M.onWord; return M.onWord ? 'on the word' : 'at once'; }
    const page = M.rows[i]?.opens; if (page) { this.turn(page); return this.menu ? 'opened' : 'nobody to take it'; }
    const there = this.reread(); this.menu = null;
    if (!there) return 'nobody to take it';
    if (i < 0 || i >= M.rows.length) return 'cancelled';
    const d = M.rows[i];
    if (PLANLAY.on && M.onWord && layable(d)) return layOrder(this.g, d, M.target, M.men);   // (planlay.ts: laid — nobody moves until the word's key sends the plan)
    this.byHand = true; try { return this.give(d.id, M.target, undefined, d.onWord && M.onWord ? { onWord: true } : undefined); } finally { this.byHand = false; }   // (give() works the refusals out afresh)
  }
  /** the open menu's target as its men will work it: a door, for the squad of four, with THEIR face of it (null: no menu) */
  private menuTarget(): OrderTarget | null { const M = this.menu; return !M ? null : M.target.kind === 'door' && M.menSide !== null ? { ...M.target, side: M.menSide } : M.target; }
  /** the open menu's cheap half, re-read against the floor as it now stands: the door's face off where Sam is, who it goes to (`who` may have been stepped).
   *  False: it was a menu for one man and he is down — the menu is gone (never widened to everybody else) */
  private reread(): boolean {
    const M = this.menu; if (!M) return false; const t = M.target;
    if (t.kind === 'none' && t.man && t.man.state === 'dead') { this.menu = null; return false; }
    if (t.kind === 'door') t.side = sideOf(t.door, this.g.player.char.pos);
    M.men = this.recipients(t);
    return true;
  }
  /** … and the whole of it: each row's why-not as well (a path search per man per row — on the press, on a change of who, and every ORDERS.refreshSecs) */
  private refresh() {
    const M = this.menu; if (!M || !this.reread()) return; const t = M.target;
    // the squad of four on a door: the rows are greyed — and worded — for the face of it the MEN will work from, as give() will have it (forMen), not Sam's.
    // Asked when the menu opens and again only when who it goes to has changed, or a man of theirs — or Sam — has crossed to the door's other face: it is two
    // path searches a man
    if (t.kind === 'door' && this.big && M.men.length) { const key = `${t.side}|${M.men.map(gd => `${gd.char.id}${sideOf(t.door, gd.char.pos) > 0 ? '+' : '-'}`).join(',')}`; if (key !== M.sideKey) { M.sideKey = key; M.menSide = this.sideFor(t.door, M.men, t.side); } }
    else { M.menSide = null; M.sideKey = ''; }
    const mt = this.menuTarget()!;
    // (a row that stands in for another while something lasts — OrderDef.standsIn — comes and goes with it: the page's list is re-read with the rest, the
    // highlight kept on its row, or on the row now on that row's digit)
    const rows = this.rowsFor(mt, M.page, M.men);
    if (rows.length !== M.rows.length || rows.some((d, i) => d !== M.rows[i])) { const was = M.rows[M.sel]; M.rows = rows; M.wordRow = this.wordRowOf(M.target, rows);
      const i = was ? rows.findIndex(d => d === was || (d.key !== undefined && d.key === was.key)) : -1; M.sel = i >= 0 ? i : Math.min(M.sel, rows.length + (M.wordRow ? 1 : 0)); }
    M.why = M.rows.map(d => { const o = d.only ? d.only(this, M.men, mt) : M.men; return this.whyNot(d, mt, o.length ? o : M.men); }); M.readT = this.g.time;   // (an order for some of them only: as give() asks it)
  }
  /** is the open menu's list stale NOW, not at the next re-read: a stand-in row (OrderDef.standsIn) has come or gone on its page — or the page itself was
   *  opened by one, and its rows live and die with what that row stands for (re-read every frame: no path search is behind them) */
  private due(M: Menu): boolean {
    if (M.page !== null && this.defs.some(d => d.opens === M.page && !!d.standsIn)) return true;
    const rows = this.rowsFor(this.menuTarget()!, M.page, M.men);
    return rows.length !== M.rows.length || rows.some((d, i) => d !== M.rows[i]);
  }
  /** what the cursor is on (null: no squad, or before the first frame) — the HUD's lines under the squad block; the simulation never reads it. Kept while the
   *  cursor has not moved, for a tenth of a second: the page asks every frame */
  hover(): OrderTarget | null {
    const v = this.view; if (!v.input || !v.cam || !v.canvas || !this.active) return null;
    const c = this.hov, x = v.input.mouseX, y = v.input.mouseY, t = this.g.time;
    if (c && c.x === x && c.y === y && t >= c.t && t - c.t < 0.1) return c.v;
    const out = this.targetUnder(v.input, v.cam, v.canvas); this.hov = { x, y, t, v: out }; return out;
  }
  /** the order the quick key gives on a target: its first row (null: none fits) */
  defaultFor(t: OrderTarget): OrderDef | null { return this.rowsFor(t).find(d => !d.opens) ?? null; }
  /** What T would make of `who` with the cursor on `point`: a teammate under it = that man (already him: back to everyone); a menu that was opened on one man
   *  = back to everyone (its line says so); else the next element (cycleWho) */
  whoAfterT(point: OrderTarget | null, dir: 1 | -1 = 1): Who {
    const S = this.squad(), man = point?.kind === 'none' ? point.man : undefined, k = man && man.state !== 'dead' ? S.indexOf(man) : -1;
    const mt = this.menu?.target, menuMan = mt?.kind === 'none' ? mt.man : undefined;
    if (k >= 0) return (k === this.who && !menuMan) || man === menuMan ? 'all' : k;
    if (menuMan) return 'all';
    const was = this.who, next = this.cycleWho(dir); this.who = was; return next;
  }
  /** who the next order goes to is stepped (T; the wheel under ORDERS.wheelElement) — and a menu that is up is theirs from here on */
  private stepWho(dir: 1 | -1, point: OrderTarget | null) {
    this.who = this.whoAfterT(point, dir);
    const M = this.menu; if (M) { if (M.target.kind === 'none' && M.target.man) M.target = { kind: 'none', at: M.target.at }; this.refresh(); }
  }

  /** Once a frame right after the aim is known (Game.update, between updateAim and the Space selector): T, B, the press that opens or closes the menu, and —
   *  while it is up — its digits / wheel / arrows / Space / right click / Esc, each taken OUT of the frame's input (a digit is not Sam's weapon slot, the wheel
   *  not his pace; every digit is taken, the ones above ORDER_DIGITS to do nothing). Nothing here waits on a key coming up: every act is a press. THE LEFT BUTTON STAYS SAM'S TRIGGER: a left click with the menu up puts it away
   *  and fires (ORDERS.clickGives: it gives the highlighted row instead, and fires nothing). */
  /** after a tick (Game.update): whoever asks between ticks what the cursor is on — the HUD, a tool — is answered off the host's live input and camera, not the tick's record */
  hostView(input: Input, cam: FollowCamera, canvas: View): void { const v = this.view; if (v.input) { v.input = input; v.cam = cam; v.canvas = canvas; } }
  input(_dt: number, input: Input, cam: FollowCamera, canvas: View) {
    const K = ORDERS;
    this.sync();
    if (this.escUsed) { this.escUsed = false; input.pressed.delete('Escape'); }
    const g = this.g, v = this.view;
    if (!this.active || g.player.down) { this.menu = null; v.input = v.cam = v.canvas = null; return; }
    v.input = input; v.cam = cam; v.canvas = canvas;
    if (this.lay.laid.length) layPrune(g);   // (planlay.ts: a man who is down is off the plan)
    if (input.hit(K.whoKey)) this.stepWho(1, this.targetUnder(input, cam, canvas));   // who: the man under the cursor, else the next element
    const key = input.hit(K.key), mid = K.mouseOpens && input.mmbHit();
    const M = this.menu;
    if (!M) {   // no menu at the top of the frame: the quick key, or the press that puts it up — and nothing else in this frame is the menu's
      if (PLANLAY.on && this.lay.laid.length && !!layKey() && input.pressed.delete(layKey())) laySend(g);   // (planlay.ts: the word's key, a plan laid — sent, and the press is nobody else's)
      else if (input.hit(K.quickKey)) { const t = this.targetUnder(input, cam, canvas); this.byHand = true; try { if (!(AUTOPILOT.on && autoQuick(g, t))) { const d = this.defaultFor(t); if (d) this.give(d.id, t); } } finally { this.byHand = false; } }   // the target's own order, at once (autopilot.ts: on a door they wait on, they go in — by the entry they pick)
      else if ((key || mid) && g.player.sel.downT < 0) this.open(this.targetUnder(input, cam, canvas));   // (never over a Space press in hand: one list at a time)
      return;
    }
    // the menu is up: everything it answers to is taken out of the frame FIRST (whichever of them then acts, none is Sam's as well) …
    const esc = backTake(input), blur = input.pressed.has('Blur'), space = input.pressed.delete(INTERACT_KEY);
    const rmb = input.rmbHit(); if (rmb) input.clicked &= ~4;
    const lmb = input.lmbHit(); if (lmb && K.clickGives) { input.clicked &= ~1; input.buttons &= ~1; if (input === g.seat.input) g.seat.swallow(1); }   // (the held button stays taken until he lets go: the seat remembers, cmd.ts)
    if (g.time - M.readT >= K.refreshSecs || this.due(M)) { this.refresh(); if (!this.menu) return; }   // (before any key of the frame is read against its rows)
    const waitD = this.waitDigit(M), wordPage = this.wordPage(M);
    let digit = 0, wait = false; for (let d = 1; d <= 9; d++) if (input.pressed.delete(`Digit${d}`)) { if (d === waitD) wait = true; else if (!digit) digit = d; }
    if (!digitOf(K.waitKey) && input.pressed.delete(K.waitKey) && M.wordRow) wait = true;   // (the knob on a key that is not a digit)
    const altRow = PLANLAY.on && (M.rows.some((d, i) => d.hotKey === K.waitAlt && !M.why[i]) || g.doorTools.wordKeyHeld());   // (planlay.ts: a row of this page is on that key and can be given now — 'go' with somebody waiting, a held threshold's word: the key stays that row's. And the pair's held threshold takes the key as its word with a menu up that has no such row — the held door's first page, another menu under DOORTOOLS.thrMenuWord: the word outranks the 'wait' row, the key is left for doortools.ts input())
    const alt = (M.wordRow || wordPage !== null) && !altRow && !!K.waitAlt && input.pressed.delete(K.waitAlt);   // the word's key, with a door menu of the four's up: 'wait for my word'
    let dSel = 0; if (input.pressed.delete('ArrowDown')) dSel++; if (input.pressed.delete('ArrowUp')) dSel--;
    let wheel = 0; if (input.wheel) { M.wheelAcc = Math.max(-2 * WHEEL_STEP, Math.min(2 * WHEEL_STEP, M.wheelAcc + input.wheel)); input.wheel = 0;
      if (Math.abs(M.wheelAcc) >= WHEEL_STEP) { wheel = Math.sign(M.wheelAcc); M.wheelAcc -= wheel * WHEEL_STEP; } }
    // … then the first of them, in this order: away with it (the page lost focus, X again, the trigger) · back a page, or away with it (Esc, a right click) ·
    // a digit · the highlight · give it
    if (lmb && !K.clickGives && CLOSE.heldClicks && g.player.holding?.variant === 'arm') input.clicked &= ~1;   // (close.ts CLOSE.heldClicks: with a man in the arm the left click is the knife, a commit — the click that shuts the menu is not that click as well)
    if (blur || key || (lmb && !K.clickGives)) { this.menu = null; return; }
    if (esc || rmb) { if (!this.pageBack()) this.menu = null; return; }
    if (alt && wordPage !== null && !(PLANLAY.on && M.wordRow)) { this.turn(wordPage, true); return; }   // on the door's first page: to its tools, 'wait for my word' on
    if (wait || alt) this.pick(M.rows.length);   // 'wait for my word' flipped: the menu stays, and a digit in the same frame is given that way
    if (digit) { const i = M.rows.findIndex(r => r.key === digit); if (i >= 0) { this.pick(i); return; } }   // (a row that opens a page: the menu stays, on that page)
    if (wheel && K.wheelElement) this.stepWho(wheel as 1 | -1, null); else dSel += wheel;
    const n = M.rows.length + (M.wordRow ? 1 : 0);   // (index n = the cancel row; with the 'wait for my word' row, that is the one before it)
    if (dSel) M.sel = ((M.sel + dSel) % (n + 1) + (n + 1)) % (n + 1);
    if (space || mid || lmb) this.pick(M.sel);   // Space, the middle button again, or (clickGives) the left click: the highlighted row
  }

  // ------------------------------------------------------------ the men
  /** The roster as it stands. A new cast (a staging, a restart, a despawn) starts clean: nothing of the old one's — the choice of man, an open menu, the trail,
   *  the orders of men no longer on it — carries over. */
  private sync(): Guard[] {
    const R = this.roster; let i = 0, same = true;
    for (const gd of this.g.guards) if (this.mine(gd) && R[i++] !== gd) same = false;
    if (!same || i !== R.length) { const S = this.roster = this.squad(); this.who = 'all'; this.menu = null; this.trail.length = 0; for (const gd of [...this.asg.keys()]) if (!S.includes(gd)) this.drop(gd); layFresh(this.g); }   // (planlay.ts: nothing laid — or, a restart, the plan kept from the last try)
    if (typeof this.who === 'number' ? this.roster[this.who]?.state !== 'dead' : this.who === 'all' || this.men(this.who).length > 0) return this.roster;
    this.who = 'all'; this.menu = null;   // (the man — the pair — the orders went to is down: and a menu that was theirs goes with them, never on to everybody else)
    return this.roster;
  }
  /** Sam is standing (the file's own reading of his pace: tick()) */
  get samStopped(): boolean { return this.samV <= 0.3; }
  /** a man's order goes: and with it the pin the fight seam put on him */
  private drop(gd: Guard) { this.asg.delete(gd); if (this.ours.delete(gd)) gd.pinned = false; }
  /** Once a frame before the guards move (Game.update, after the drills that may own them): each man under an order is walked to it and posed on it. */
  tick() {
    const g = this.g, K = ORDERS;
    this.sync();
    if (!this.asg.size) return;
    if (!this.active) { this.clear(); return; }   // a show has taken the floor
    const sam = g.player.char;
    sneakTick(g);   // (sneak.ts: Sam's trail, kept while the silent squad sneaks — nothing with its switch off)
    const mates = this.big ? this.men() : [];   // (the squad of four: a teammate in the line of a man's gun lowers it as Sam does)
    const file = [...this.asg].filter(([, A]) => A.post === null).sort((a, b) => a[1].follow - b[1].follow);
    file.forEach(([, A], i) => { A.follow = i; });   // (the file closes up when a man ahead of him is taken off it)
    const followers = file.map(([gd]) => gd);
    if (followers.length) {
      this.crumb(sam.pos, followers);
      const step = this.samT >= 0 ? flat(sam.pos, this.samP) : 0, el = g.time - this.samT;
      if (this.samT >= 0 && el > 1e-6 && step < 1) { this.samV += (step / el - this.samV) * 0.25;   // (a jump of a metre is a teleport, not a pace)
        if (step > 1e-3) { this.samDir[0] = (sam.pos[0] - this.samP[0]) / step; this.samDir[2] = (sam.pos[2] - this.samP[2]) / step; } }
      this.samP[0] = sam.pos[0]; this.samP[2] = sam.pos[2]; this.samT = g.time;
    } else { this.trail.length = 0; this.samT = -1; this.samV = 0; }
    for (const [gd, A] of this.asg) {
      if (gd.state === 'dead') { this.drop(gd); continue; }
      if (this.owners.some(o => o.owns(gd))) { this.drop(gd); continue; }   // a drill has taken him (the night breach's F): its order stands, ours is dropped
      if (A.thru && A.post) { const r = g.cleared.roomAt(A.post); if (r && r === g.cleared.roomAt(gd.char.pos)) A.thru = null; }   // (ORDERS.ownDoor: he is in the room — by its door; from here on his point is a short walk, whatever takes him out again)
      if (!gd.script && gd.state === 'alert') {   // the fight AI has him (the head comment's seam): rooted on his post, or free to move while he follows — until his fight has gone cold
        if (A.yieldT < 0) { A.yieldT = g.time; this.fight?.yielded?.(gd, A); }
        if (A.post !== null && K.pinPosted) { gd.pinned = true; this.ours.add(gd); }
        const hot = this.fight?.engaged ? this.fight.engaged(gd, A) : gd.reloadT >= 0 || g.time - Math.max(gd.lastSeenT, gd.witness?.heard.lastShotT ?? -1e9, A.yieldT) < K.coldSecs;
        if (hot) continue;
        gd.state = 'search';
      }
      if (A.yieldT >= 0) { A.yieldT = -1; A.arrived = false; FOLLOW_WORD.delete(A); A.movedT = A.markT = g.time; A.mark[0] = gd.char.pos[0]; A.mark[2] = gd.char.pos[2]; this.fight?.retaken?.(gd, A);
        if (A.post && (K.cleared || (K.ownDoor && A.thru))) { const R = this.route(gd, A.post, A.shy, A.thru ?? null); if (!R.why) { A.via = R.via; if (R.how) g.cleared.stats[R.how]++; } }
        else if (!A.post) A.viaT = A.viaFor = undefined; }   // back on his order (we took him, or the fight AI let go of him itself) — by the way an order walks him (cleared.ts), from wherever the fight left him
      if (this.ours.delete(gd)) gd.pinned = false;
      const def = this.defs.find(x => x.id === A.order); if (def?.tick) { def.tick(this, gd, A); if (this.asg.get(gd) !== A) continue; }   // (it re-assigned him: his new order's turn is next frame)
      let speed = K.brisk, face = A.face, d: number, sGoal: Vec3 | null = null, low = false, stepping = false, keep = false;
      if (A.post === null) {   // fall in: his place back along the trail; a fresh leg whenever it has moved half a metre
        const p = gd.char.pos, toSam = flat(p, sam.pos), stopped = this.samStopped;
        const backM = this.backOf(A.follow) + (stopped ? this.clearBack(A.follow) : 0);
        let slot = this.slot(backM);
        const onWall = sneaking(g, gd) || roomKept(g, gd) ? null : unseenWallSlot(g, gd, backM, followers); if (onWall) slot = onWall;   // (unseen.ts: Sam on a wall and nobody has found the squad — his place is along that face behind Sam, not back down the trail; null with its switch off)
        const off = stopped || DOORMANNERS.laneMove ? doorwayOffLane(g, slot, p, A.follow, this.ahead(gd, A)) : null; if (off) { slot = off; if (onWall) unseenWallLost(gd); }   // (doorway.ts STAND, the lane: no place in the file is where a man beyond a door standing open shoots straight down — through the frame on Sam's trail, then off it)
        let spread = false; if (K.fileSpread && stopped && !off && !onWall) { const q = this.apartSlot(gd, A, slot); spread = q !== slot; slot = q; }   // (two places on one spot: his is dealt again, a body's room from the men ahead of him)
        const aside = this.aside(gd); stepping = !!aside;   // Sam walking back down the file at him: he steps off Sam's line, lets him through, and falls in behind
        // Sam stopped and he is near enough already, in plain sight of him: where he stands is his place (no walking round Sam to the exact spot on the trail)
        const st0 = stopped && !aside && !sneaking(g, gd) && !unseenMan(g, gd) ? g.cover.stepOf(gd, A) : null;   // (cover.ts COVER.step: Sam standing, he is a step or two off his place, where he sees through the open door he was dealt)
        // (picture.ts PICTURE.step: Sam standing, the place he has in the file — where he stands, when that is his place, else his slot — that he believes is in an
        //  enemy's line is left for cover a step or two off it. Not a man cover.ts has stepped to watch a door (that is a job), not the silent squad's men, not
        //  a man keeping a door or held short, never out of Sam's way)
        let nearV: boolean | null = null;
        const nearP = () => nearV ??= !aside && !onWall && stopped && toSam > K.nearM && toSam < backM + K.bandM && !this.inFrame(p) && !(doorwayLane(g, p) && (off || !DOORMANNERS.laneLeaf || !doorwayLane(g, slot))) && !g.col.solidBlocked([p[0], 0.45, p[2]], [sam.pos[0], 0.45, sam.pos[2]]) && !(doorwayFile() && this.onTop(gd, A));
        const ps = !st0 && PICTURE.on && PICTURE.step && stopped && !aside && !onWall && !sneaking(g, gd) && !unseenMan(g, gd) && !roomKept(g, gd) && !g.fight.short(gd)
          ? pictureStep(g, gd, A, nearP() ? p : slot, q => !(this.inFrame(q) || doorwayInWay(g, q) || !!doorwayLane(g, q)), g.fight.busy(gd, 0.5)) : null;
        const st = ps?.at ?? st0;
        const near = !st && nearP();
        if (st) { if (flat(st, A.goal) > 0.05) A.goal = [st[0], 0, st[2]]; }
        else if (near) { if (flat(p, A.goal) > 0.4) A.goal = [p[0], 0, p[2]]; }
        else { let want = aside ?? slot;
          // (ORDERS.cleared: a follower a walk away from his place does not cut through a room nobody has been in — round it, a corner at a time, until his place has moved on)
          if (K.cleared && !aside) {
            // (asked when he is a walk from his place — or a wall is between them — and again when his place has moved on from the one the corners were for, or
            // every few seconds while he walks them: never more than twice a second a man)
            const since = g.time - (A.viaT ?? -1e9), had = A.via.length > 0;
            if (had ? !A.viaFor || (flat(A.viaFor, slot) > 2.5 && since > 0.5) || since > 3 : since > 0.75 && (flat(p, slot) > 3 || !g.col.nav.walkable(p, slot))) {
              A.viaT = g.time; A.via = this.roundRooms(gd, slot); A.viaFor = [slot[0], 0, slot[2]]; if (A.via.length && !had) g.cleared.stats.round++; }
            if (A.via.length && flat(p, A.via[0]) < 0.9) A.via.shift();
            if (A.via.length) want = A.via[0];
          } else if (A.via.length) A.via.length = 0;
          if (flat(want, A.goal) > (aside ? 0.25 : spread ? 0.05 : 0.5)) A.goal = want; }   // (a place dealt again is a kept point: taken to the centimetre, or a deal a short step from his goal would be dropped and the two stay a shove apart)
        if (DOORMANNERS.on && DOORMANNERS.restClear && !aside && !st) this.restClear(gd, A, near ? [p[0], 0, p[2]] : slot, slot, stopped);   // (doorway.ts REST: he is not left standing in a frame or where a leaf swings)
        d = flat(p, A.goal);
        if (A.via.length && !st && !near && !aside) { let q = A.via[0]; for (let i = 1; i < A.via.length; i++) { d += flat(q, A.via[i]); q = A.via[i]; } d += flat(q, slot); }   // (on a way round: his pace and 'in place' are by the whole walk left, not by the next corner)
        speed = aside ? K.brisk : st ? K.onto : Math.max(K.walk, Math.min(K.run, this.samV + K.gain * (d - 0.3)));
        const sn = aside ? null : sneakFollow(g, gd, backM, this.samV, stopped, speed);   // (sneak.ts: the silent squad's follower, low in Sam's own steps, waiting short of a lit stretch somebody is looking at — null with its switch off)
        if (sn) { speed = sn.speed; low = sn.crouch; if (sn.goal) { sGoal = sn.goal; d = flat(p, sn.goal); } }
        else { const un = aside ? null : unseenFollow(g, gd, this.samV, d, K.walk, speed);   // (unseen.ts: a squad nobody has found, Sam sneaking — low with him, at his pace plus what closes the gap; null with its switch off)
          if (un) { speed = un.speed; low = un.crouch; } else low = sneakLow(g, gd) || unseenLow(g, gd); }   // Sam's own pace plus what closes the gap: no gear changes
        if (ps?.low && d < 0.5) low = true;   // (picture.ts: the cover he stepped to hides a man on a knee)
        keep = !aside && !sn?.must && roomKept(g, gd);   // (rearwatch.ts REARWATCH.room: he had one of a taken room's other doors when 'fall in' came — he keeps it, where he stands, until the squad is out of the room, and follows last)
        if (keep) speed = 0;   // (…and STOOD, with no goal: a runner held at speed 0 still steers his chest at his next waypoint, and the twist clamp then drags his gun off the door — and off a man he has seen)
        // (wallcharge.ts WALLCHARGE.menClear: the place he is being sent to — or kept on — is inside the blast of a charge set on a wall: he walks to a stand-off
        //  mark instead and keeps it until his place is clear. Asked last, of the place the lines above settled on, so everything above runs as it always
        //  did; null with its switch off or nothing set. Never out of Sam's way, never a man the sneak has mid-crossing; at the pace he steps aside at — the
        //  silent squad and a squad nobody has found at a walk, low with Sam)
        const wb = aside || sn?.must ? null : g.wallCharge?.clearOf(gd, () => keep ? p : sGoal ?? st ?? (near ? p : slot)) ?? null;
        if (wb) { if (flat(wb, A.goal) > 0.05) A.goal = [wb[0], 0, wb[2]]; sGoal = null; keep = false; d = flat(p, wb); low = sneakLow(g, gd) || unseenLow(g, gd);
          speed = sneaking(g, gd) || unseenMan(g, gd) ? (low ? K.onto : K.walk) : K.brisk; }
        if (!aside && !sn?.must && g.fight.short(gd)) speed = 0;   // (guards.ts LIGHTS.litMan, roomfight.ts holdShort: in the dark on a lit man with Sam in his line — he does not close on him; stepping out of Sam's own way still comes first)
        // stopped: the first man looks on past Sam (never swinging with his reticle), the rest back the way they came
        face = !stopped || d > 0.6 ? null : toSam < 0.3 ? A.faceNow ?? sam.bodyYaw : A.follow === 0 ? yawTo(p, sam.pos) : yawTo(sam.pos, p);
        A.arrived = d < 0.8; this.followWord(A, d);
      } else {
        const p = gd.char.pos;
        // (cover.ts COVER.step: a plain holder is walked the step or two to where he sees through an open door — his MARK stays where the order put it, and
        //  he goes back to it when the step is void)
        const plain = A.order === 'hold' && !A.watch && !A.spare && !A.via.length, st = plain ? g.cover.stepOf(gd, A) : null, mark = st ?? A.post;
        if (plain && flat(A.goal, mark) > 0.05) { A.goal = [mark[0], 0, mark[2]]; A.markT = A.movedT = g.time; A.mark[0] = p[0]; A.mark[2] = p[2]; }
        if (A.via.length) { if (flat(p, A.via[0]) < 0.9) A.via.shift(); A.goal = A.via[0] ?? v3.copy(A.post); }   // (the way round a locked door, a waypoint at a time)
        d = flat(p, mark); speed = A.pace ?? (d > K.briskIn ? K.brisk : stackLinePace(g, gd, A, d, K.brisk) ?? K.onto);
        { const sp = sneakPost(g, gd, A.order) ?? unseenPost(g, gd, A.order); if (sp !== null) { low = true; speed = Math.min(speed, sp); } }   // (sneak.ts: sent to a mark while the silent squad sneaks, he goes there low with Sam — nothing with its switch off)
        const short = g.fight.short(gd);   // (LIGHTS.litMan, roomfight.ts holdShort: in the dark on a lit man with Sam in his line — his walk waits, and so do the clocks that would call a standing man stuck)
        if (short) { speed = 0; A.movedT = A.markT = g.time; A.mark[0] = p[0]; A.mark[2] = p[2]; }
        else if (DOORMANNERS.on && DOORMANNERS.shortClear && (doorwayHeld(g, gd) || handleHeld(g, gd)) && this.heldWait(A)) { A.movedT = A.markT = g.time; A.mark[0] = p[0]; A.mark[2] = p[2]; }   // (doorway.ts SHORT: held at a frame for a man in it or beyond it, or by the handle rule for the man working the leaf, is a wait, not a shut way — the clocks that would call him stuck start when the hold ends)
        if (clearLineLive(g, gd)) { A.movedT = A.markT = g.time; A.mark[0] = p[0]; A.mark[2] = p[2]; }   // (clearline.ts: off his mark on purpose, for a line to the man a friend masks — nobody calls him stuck)
        // has he MOVED (his commanded speed says nothing: a man grinding on a wall is still told to walk) — at all in the last second, beside his mark; 30 cm in
        // the last `stuckSecs`, short of it
        if (flat(p, A.anchor) > 0.05) { A.anchor[0] = p[0]; A.anchor[2] = p[2]; A.movedT = g.time; }
        let stuck = false; if (g.time - A.markT >= K.stuckSecs) { stuck = flat(p, A.mark) < 0.3; A.mark[0] = p[0]; A.mark[2] = p[2]; A.markT = g.time; }
        if (d >= 0.35 && (d < 1.0 && !A.via.length ? g.time - Math.max(A.movedT, A.t0) > 1 : stuck) && !(!st && DOORMANNERS.on && DOORMANNERS.shortClear && this.restShort(gd, A, d))) {   // as near his mark as he will get (somebody is standing on it; the way is shut): the mark comes to him — he does not keep lunging at it (doorway.ts REST: never in a frame or where a leaf swings)
          if (st) g.cover.stepHalt(gd);   // (a step nobody ordered that he cannot make is no failed order: it ends where he stands, and he says nothing)
          else if (d < 1.0 && A.had === A.post && (A.backN ?? 0) < BACK_TRIES && !A.via.length && DOORMANNERS.on && DOORMANNERS.backOn) {   // (doorway.ts BACK ON: he HAD this mark and was shouldered off it — he steps back onto it; the mark comes to him only once somebody has kept it from him)
            A.backN = (A.backN ?? 0) + 1; A.goal = v3.copy(A.post); A.movedT = g.time; STACK_OWN.back++; }
          else { if (d >= 1.0) { A.there = 'stopped short'; g.say(gd, "can't get through."); }
            A.post = [p[0], 0, p[2]]; A.goal = v3.copy(A.post); A.via.length = 0; d = 0; }
        }
        if (!st && d < 0.35) { A.had = A.post; if (d < 0.1) A.backN = 0; }
        const was = A.arrived;
        A.arrived = d < 0.35 && (A.watch === null || !!A.fit || (!!A.spare && g.cover.has(gd)) || Math.abs(wrapAngle(gd.char.aimYaw - yawTo(gd.char.pos, A.watch))) < 0.2);   // (… or his gun is on what the cover dealt him; a 'move' is there by his feet, as it was before roomfit.ts gave him a watch)
        A.heldFire = HOLDFIRE.stackSet && (HOLDFIRE.stackWait || !A.arrived) && d < 0.35 && A.order === 'stack' && holdFireOnMan(g, gd); if (A.heldFire) A.arrived = true;   // (HOLDFIRE.stackSet, off: not asked — he is there by his gun alone, as before the key; stackWait off: asked only of a man his gun has not set, the stamp read by nobody. holdfire.ts: on his mark, his gun on a man nobody may shoot yet and not on the door — he is stacked; false with its switch off. Stamped, as the silent order's below: the handle test runs before this tick and reads the stamp)
        A.heldSet = !A.arrived && d < 0.35 && A.order === 'stack' && silentOnMan(g, gd); if (A.heldSet) A.arrived = true;   // (silent.ts: the same for a silent man under the order's own fire hold — SILENT.stackSet, false with it off)
        if (A.arrived && !was) A.arrT = g.time;
      }
      let pose: { stance: Assignment['stance']; upper: Assignment['upper'] } = A.move && d > 0.6 ? A.move : A;   // on the way to a mark: the gun up and leading; the mark's own carriage as he settles onto it
      // UNASKED COVER (cover.ts): a man following, or holding with nothing named to watch, has an opening dealt him — his gun, light and eyes go onto it (stopped:
      // squared up to it; walking: over his shoulder, or backwards with it in front of him); his feet stay the order's
      let watch = A.watch, strafe = !!A.strafe && A.post !== null && face !== null;
      const cov = (A.watch === null && (A.post === null || A.order === 'hold')) || A.spare ? g.cover.poseFor(gd, A.spare ? d < 0.6 : A.post !== null || face !== null || keep, speed) : null;   // (a man with spare eyes: on his mark squared up to it, on the walk there over his shoulder or backwards)
      if (cov) { watch = cov.at; face = cov.face; strafe = cov.strafe; pose = AIM; }
      const sp = spottedFeet(g, gd, A.post === null, stepping);   // (spotted.ts: a silent man with a suspicious defender about goes low / still / out of his line; caught, he steps to a line — null with its switch off)
      if (sp?.watch && !g.pair.finishing(gd)) { watch = sp.watch; face = yawTo(gd.char.pos, sp.watch); strafe = false; pose = AIM; }
      // (doorway.ts DOORMANNERS.watch: the rear man's gun is the cover's for his whole walk now, doors and corners included, and a back-pedal has no stuck
      //  watchdog — the runner's strafe keeps the path it has. So: his next corner behind a wall — a handle walked him off his way — and the way is found
      //  again from where he stands; a second without moving, short of his mark, and he walks it the plain way for three: followPath's side-step and re-path)
      if (strafe && A.post !== null && d > 0.6 && DOORMANNERS.on && DOORMANNERS.stand && DOORMANNERS.watch) {
        const q = gd.char.pos, wp = gd.path[gd.pathI], t = g.time, W = this.backFix.get(A) ?? { plain: -1, path: -1 };
        if (wp && t - W.path > 1 && g.col.solidBlocked([q[0], 0.45, q[2]], [wp[0], 0.45, wp[2]])) { gd.path = []; gd.pathGoal = null; W.path = t; }
        if (t - A.movedT > 1) W.plain = t + 3;
        this.backFix.set(A, W);
        if (W.plain > t) { strafe = false; face = null; }
      }
      A.faceNow = face;
      let cl = clearLineFeet(g, gd);   // (clearline.ts: a friend masks his shot at a man he sees — the step to a clear line, to cover, or the knee; null with its switch off)
      if (cl && A.post === null && this.aside(gd)) cl = null;   // (stepping out of Sam's own way still comes first)
      if (cl && sp) cl = null;   // (…and so does the silent partner's rule: whenever spotted.ts has his feet, his gun or his knee, this rule neither moves nor turns him)
      if (cl) { face = cl.face; strafe = cl.strafe; }
      if (pose.upper === 'aim' || pose.stance === 'stack') {   // Sam in the line of his gun: the muzzle comes down until he is clear of it
        const p = gd.char.pos, yaw = watch ? yawTo(p, watch) : gd.char.bodyYaw, fx = Math.sin(yaw), fz = Math.cos(yaw), len = watch ? flat(p, watch) : 5;
        const inLine = (q: Vec3) => { const sx = q[0] - p[0], sz = q[2] - p[2], along = sx * fx + sz * fz; return along > 0.15 && along < len && Math.abs(sx * fz - sz * fx) < (A.low ? K.laneOut : K.laneIn); };
        A.low = (this.sams && inLine(sam.pos)) || (A.arrived && LANE_ORDERS.includes(A.order) && mates.some(m => m !== gd && this.pairOf(m) !== this.pairOf(gd) && inLine(m.char.pos)));   // (… a man of the OTHER pair, across a gun that is posted — cover / stack / move: never a file's own second man, never an entry under way)
        if (A.low) pose = LOW;
      } else A.low = false;
      // (who has the follower's feet: spotted.ts's freeze / slip / step when it gives a spot — a defender is suspicious of the pair, or has it —, else the sneak's
      //  step along Sam's trail, else the order's own goal; low if any of the three says low. A take / dark job (pairorders.ts) is not a follower: spotted only kneels him.) Then clearline.ts's step to a clear line of fire when a friend masks his shot (null with its switch off).
      order(gd, { goal: sp?.goal ?? cl?.goal ?? (keep ? null : sGoal ?? A.goal), speed: sp?.speed ?? cl?.speed ?? speed, face, strafe, aimAt: watch, stance: pose.stance, upper: pose.upper, stackSide: A.stackSide, crouch: (A.crouch ?? false) || low || !!sp?.crouch || !!cl?.crouch, hot: false, light: A.light });
      if (sGoal && !sp?.goal && !cl?.goal) sneakWay(g, gd, sGoal);
    }
    for (const A of this.asg.values()) {   // 'set.': once, from the last man on, when everybody the order sent is on his mark
      if (!A.setLine || A.setSaid || !A.arrived) continue;
      let all = true, last: Guard | null = null, lastT = -Infinity;
      for (const [m, B] of this.asg) if (B.group === A.group) { if (!B.arrived || B.tries) { all = false; break; }   // (`tries`, ORDERS.walkTries: a man of them still has a door to try — the order is not set before his hand is on it)
        if (B.arrT > lastT) { lastT = B.arrT; last = m; } }
      if (all && last) {
        let short = false; if (WORDS.on) for (const B of this.asg.values()) if (B.group === A.group && B.there === 'stopped short') { short = true; break; }   // (one of them said "can't get through": the group is not where it was sent, and nobody calls it set)
        if (!short) g.say(last, A.setLine); for (const B of this.asg.values()) if (B.group === A.group) B.setSaid = true; }
    }
  }
  /** Where a follower stands to let Sam through: Sam is walking AT him (the man ahead of Sam's motion, inside asideM, within asideLane of his line) — a spot
   *  abreast of where he is, asideOff (or, in a tight place, a shoulder's width) off Sam's line on the side he is already on, else the other. Null: not in the way,
   *  or no floor either side (he stays put and Sam squeezes by). */
  private aside(gd: Guard): Vec3 | null {
    const g = this.g, K = ORDERS, sam = g.player.char.pos, p = gd.char.pos;
    const held = (): Vec3 | null => {   // the spot he was already stepping to, while Sam has not got past him (ORDERS.asideHold)
      const m = this.asideMem.get(gd); if (!m || g.time - m.t > K.asideHold || g.time < m.t) return null;
      return (p[0] - sam[0]) * m.dir[0] + (p[2] - sam[2]) * m.dir[2] > -0.3 && flat(p, sam) < K.asideM + 0.5 ? m.q : null; };
    if (this.samV < 0.3) return held();
    const dir = this.samDir, mx = p[0] - sam[0], mz = p[2] - sam[2];
    const ahead = mx * dir[0] + mz * dir[2], off = mx * dir[2] - mz * dir[0];
    if (ahead <= 0 || ahead > K.asideM || Math.abs(off) > K.asideLane) return held();
    for (const w of [K.asideOff, 0.65]) for (const side of off >= 0 ? [1, -1] : [-1, 1]) {
      const q: Vec3 = [sam[0] + dir[0] * ahead + dir[2] * side * w, 0, sam[2] + dir[2] * ahead - dir[0] * side * w];
      if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([p[0], 0.45, p[2]], [q[0], 0.45, q[2]])) { this.asideMem.set(gd, { q, t: g.time, dir: [dir[0], 0, dir[2]] }); return q; }
    }
    return null;
  }
  private asideMem = new WeakMap<Guard, { q: Vec3; t: number; dir: Vec3 }>();
  /** Sam's trail: a crumb every `crumb` metres he has moved, `trailM` metres of it kept (newest last) */
  private crumb(p: Vec3, men: Guard[]) {
    const T = this.trail, K = ORDERS, last = T[T.length - 1];
    if (last && flat(last, p) > 3) T.length = 0;   // (a teleport: the old trail leads nowhere he walked)
    if (!T.length) {   // no trail yet: 'behind him' is the side his men are on — they close up to him from where they stand and stop short, whichever way he is looking
      let cx = 0, cz = 0; for (const gd of men) { cx += gd.char.pos[0] - p[0]; cz += gd.char.pos[2] - p[2]; }
      const l = Math.hypot(cx, cz); const c = this.g.player.char;
      this.back = l > 0.3 ? [cx / l, 0, cz / l] : [-Math.sin(c.bodyYaw), 0, -Math.cos(c.bodyYaw)];
    }
    if (!T.length || flat(T[T.length - 1], p) >= K.crumb) T.push([p[0], 0, p[2]]);
    let len = 0; for (let i = T.length - 1; i > 0; i--) { len += flat(T[i], T[i - 1]); if (len > K.trailM) { T.splice(0, i - 1); break; } }
  }
  /** doorway.ts STAND: stopped 'near enough' within a body and a bit of a man ahead of him in the file (or one on a post) — not his place: he walks on to his own */
  /** where the men ahead of him in the fall-in file are bound (doorway.ts doorwayOffLane: his place off a lane keeps clear of theirs) */
  /** (DOORMANNERS.watch) a back-pedalling walker's two clocks: until when he walks the plain way, when his way was last found again */
  private backFix = new WeakMap<Assignment, { plain: number; path: number }>();
  private ahead(gd: Guard, A: Assignment): Vec3[] { const out: Vec3[] = []; for (const [o, B] of this.asg) if (o !== gd && B.post === null && B.follow < A.follow && B.goal && o.state !== 'dead') out.push(B.goal); return out; }
  private onTop(gd: Guard, A: Assignment): boolean {
    for (const [o, B] of this.asg) if (o !== gd && o.state !== 'dead' && (B.post !== null || B.follow < A.follow) && flat(o.char.pos, gd.char.pos) < DOORMANNERS.apart) return true;
    return false;
  }
  /** the open doorway `p` stands in, for a place in the file (ORDERS.offDoor of the frame's line, inside its span; a shut leaf is a wall) */
  private inFrame(p: Vec3): boolean {
    if (doorwayStand(this.g, p)) return true;   // (doorway.ts STAND: nor in any frame's strip, nor where a leaf swings)
    const m = ORDERS.offDoor; if (!(m > 0)) return false;
    for (const d of this.g.doors.list) {
      if (d.latched || Math.abs(d.angle) < 0.6 || flat(p, d.frameCentre) > d.def.width + m) continue;
      const F = frameOf(d), along = (p[0] - F.hx) * F.ux + (p[2] - F.hz) * F.uz, off = (p[0] - F.hx) * F.nx + (p[2] - F.hz) * F.nz;
      if (along > -0.05 && along < F.W + 0.05 && Math.abs(off) < m) return true;
    }
    return false;
  }
  /** doorway.ts REST (DOORMANNERS.restClear): a follower is not left standing in a doorway or where a leaf swings. (1) Sam stopped, and the place he is
   *  walking to — left where it was by the half-metre slack — is in a frame or a swing: his place (`slot`: on the trail, or where he stands when that is
   *  near enough) if that is free, else the nearest clear floor. (2) He has stood `restSecs` where he is, in a frame's strip or a swing, short of his place (held behind the file, his way shut): he steps to
   *  the nearest clear floor, and that is his place until the file's has moved on a metre or four seconds are up. Never on a way round (`via`). */
  private restOf = new WeakMap<Assignment, { x: number; z: number; t: number; step: Vec3 | null; until: number; from: Vec3; n: number; hold: Vec3 | null; holdFor: Vec3 }>();
  private restClear(gd: Guard, A: Assignment, place: Vec3, trail: Vec3, stopped: boolean) {
    const g = this.g, K = DOORMANNERS, p = gd.char.pos, t = g.time;
    let R = this.restOf.get(A); if (!R) this.restOf.set(A, R = { x: p[0], z: p[2], t, step: null, until: 0, from: [0, 0, 0], n: 0, hold: null, holdFor: [0, 0, 0] });
    if (Math.hypot(p[0] - R.x, p[2] - R.z) > 0.2) { R.x = p[0]; R.z = p[2]; R.t = t; }
    if (A.via.length) { R.step = R.hold = null; return; }
    if (R.step) { if (t > R.until || flat(trail, R.from) > 1.0) { R.step = null; R.t = t; } else { A.goal = R.step; return; } }   // (the same point every frame: one leg — and when it ends his standing is counted afresh: he gets his walk first)
    if (R.n && flat(trail, R.from) > 1.0) R.n = 0;
    const bad = (q: Vec3) => this.inFrame(q) || doorwayInWay(g, q) || !!doorwayLane(g, q);
    const others = (): Vec3[] => { const out: Vec3[] = [this.samStood]; for (const [o, B] of this.asg) if (o !== gd && o.state !== 'dead') { out.push(o.char.pos); if (B.goal) out.push(B.goal); } return out; };
    if (!stopped || flat(trail, R.holdFor) > 0.5) R.hold = null;
    if (stopped && (this.inFrame(A.goal) || doorwayInWay(g, A.goal))) {
      if (R.hold) { A.goal = R.hold; return; }   // (dealt once for where the file stands: the same point every frame, not a new leg each)
      const T = others(), q = !bad(place) && T.every(o => flat(o, place) >= K.apart) ? place : doorwayClearNear(g, A.goal, bad, T, K.apart, p);
      if (q) { A.goal = R.hold = q; R.holdFor = [trail[0], 0, trail[2]]; DOORMANNERS_STATS.rest++; }
      return;
    }
    if (doorwayHeld(g, gd)) { R.t = t; return; }   // (short of a frame for a man in it: the gate's own patience runs, and its own step to a jamb)
    if (t - R.t >= K.restSecs * (1 + R.n) && flat(p, A.goal) < 1.0 && doorwayInWay(g, p)) {   // (at rest by his place — a man still a walk from it who is slow in a swing is pushing the leaf open, or held by the gate: neither is resting · stepped off and come back to the same stand: each time he waits longer before he steps again)
      const q = doorwayClearNear(g, p, bad, others(), K.apart, g.player.char.pos);
      if (q) { R.step = q; R.until = t + 4; R.from = [trail[0], 0, trail[2]]; R.n = Math.min(R.n + 1, 4); A.goal = q; DOORMANNERS_STATS.rest++; } else R.t = t;
    }
  }
  /** doorway.ts SHORT: the seconds of one order's walk the PASS gate's holds may keep its stuck clocks from running — `heldCap` in all, so a frame that
   *  never clears still ends in "can't get through" */
  private heldOf = new WeakMap<Assignment, { last: number; total: number }>();
  private heldWait(A: Assignment): boolean {
    const t = this.g.time; let H = this.heldOf.get(A); if (!H) this.heldOf.set(A, H = { last: t, total: 0 });
    H.total += Math.min(Math.max(t - H.last, 0), 0.1); H.last = t;
    return H.total <= DOORMANNERS.heldCap;
  }
  /** doorway.ts SHORT, a man on his way to a mark who is as near it as he will get: his mark does not come to him while he stands in a frame's strip or where
   *  a leaf swings (a mark there is a man planted in the doorway: whoever is behind him stays behind him, and the fight's step off the opening walks him
   *  straight back onto it). Well short of his mark he first gets `stuckSecs` more (a wait behind a door a mate was working, or behind Sam in its mouth, is
   *  no shut way); still there, his mark goes to the nearest clear floor — on his mark's face of a frame he stands in — and he gives
   *  it up there. True = dealt with here; false = he is not in a doorway's way, or there is no such floor: as it was. */
  private shortOf = new WeakMap<Assignment, { x: number; z: number; n: number; k: number }>();
  private restShort(gd: Guard, A: Assignment, d: number): boolean {
    const g = this.g, p = gd.char.pos; if (!A.post || d < 1.0 || !doorwayInWay(g, p)) return false;   // (a stride from his mark he has as good as made it: the mark comes to him as ever — a jamb man's mark is by the frame on purpose)
    let R = this.shortOf.get(A); if (!R) this.shortOf.set(A, R = { x: p[0], z: p[2], n: 0, k: 0 });
    if (R.k >= 2) return false;   // (his mark has been moved for him twice on this order: the old rule ends it)
    if (Math.hypot(p[0] - R.x, p[2] - R.z) > 1) R.n = 0;
    R.x = p[0]; R.z = p[2];
    if (R.n++ === 0) { A.markT = A.movedT = g.time; return true; }
    const T: Vec3[] = [this.samStood]; for (const [o, B] of this.asg) if (o !== gd && o.state !== 'dead') { T.push(o.char.pos); if (B.post) T.push(B.post); }
    const sam = this.samStood, face: Vec3 = flat(sam, p) < 1.3 ? [2 * p[0] - sam[0], 0, 2 * p[2] - sam[2]] : A.post;   // (in a frame Sam stands in the mouth of: back off it, away from him)
    const q = doorwayClearNear(g, p, x => this.inFrame(x) || doorwayInWay(g, x), T, DOORMANNERS.apart, face);
    if (!q) return false;
    R.k++; A.there = 'stopped short'; g.say(gd, "can't get through.");
    A.post = q; A.goal = v3.copy(q); A.via.length = 0; A.markT = A.movedT = g.time; DOORMANNERS_STATS.rest++;
    return true;
  }
  /** Sam stopped: how much further back along the trail the `follow`-th place stands so that it, and every place ahead of it, is clear of a doorway (the
   *  frame Sam has just walked through and stopped beyond: his file closes up on the far side of it or the near one, never in it). Worked out once a frame. */
  private clearBack(follow: number): number {
    if (!(ORDERS.offDoor > 0)) return 0;
    if (this.clearT !== this.g.time) { this.clearT = this.g.time; this.clearBy.length = 0; }
    for (let i = this.clearBy.length; i <= follow; i++) {
      let e = i > 0 ? this.clearBy[i - 1] : 0; const base = this.backOf(i);
      for (let k = 0; k < 8; k++) { const q = this.slot(base + e); if (!this.inFrame(q)) break;
        if (ORDERS.backEnd && flat(q, this.slot(base + e + 0.3)) < 0.01) break;   // (ORDERS.backEnd: further back no longer moves the place — the trail and the floor behind it have run out: the count stops here, and the men behind inherit only what moved a place)
        e += 0.3; }
      this.clearBy.push(e);
    }
    return this.clearBy[follow];
  }
  private clearT = -1; private clearBy: number[] = [];
  /** a follower's place in the file, in metres back along the trail (the third and fourth men 1.1 m apart behind the second) */
  private backOf(follow: number): number { const K = ORDERS; return K.followBack[Math.min(follow, K.followBack.length - 1)] + Math.max(0, follow - K.followBack.length + 1) * 1.1; }
  /** the way they came: the point `extra` metres further back along Sam's trail than this follower's own place (cover.ts: the rear a file's last man watches) —
   *  null: he is not following */
  trailBack(gd: Guard, extra: number): Vec3 | null { const A = this.asg.get(gd); return A && A.post === null ? this.slot(this.backOf(A.follow) + extra) : null; }
  /** ORDERS.fileSpread: a follower's place that fell within a body's room of where a man ahead of him in the file — or a teammate on a post — will stand
   *  (the trail ran out and the floor with it) → the nearest clear floor to it that is not: in Sam's sight first, else in sight of the place itself, else
   *  (a corner with no such floor) the same two asked with a bare body's width between places; and where the floor has none of it he STOPS SHORT — where
   *  he stands once he is within a stride or two of the place and a body's room from the others. One point per assignment, kept while his place and
   *  theirs stand and the point is off every door's frame and lane, so he walks to it once; a deal that found no floor is not searched again for a second */
  private apartOf = new WeakMap<Assignment, { at: Vec3; q: Vec3 | null; t: number; m: number; short?: boolean }>();
  private apartSlot(gd: Guard, A: Assignment, slot: Vec3): Vec3 {
    const g = this.g, m = ORDERS.fileApart, sam = g.player.char.pos, p = gd.char.pos, T = this.ahead(gd, A);
    for (const [o, B] of this.asg) if (o !== gd && o.state !== 'dead' && B.post !== null) T.push(B.goal ?? o.char.pos);   // (the men the manners' 'on top of a mate' counts: the file ahead, and anybody on a post)
    const open = (a: Vec3, b: Vec3) => !g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]]);
    if (!T.some(t => flat(t, slot) < m && open(t, slot))) return slot;
    const bad = (x: Vec3) => this.inFrame(x) || !!doorwayLane(g, x), clear = (x: Vec3, by: number) => T.every(t => flat(t, x) >= by - 0.05);
    const short = (): Vec3 | null => flat(p, slot) < 1.5 && !bad(p) && clear(p, m) && open(p, slot) ? [p[0], 0, p[2]] : null;
    const hold = (): Vec3 => { if (!ORDERS.fileHold || flat(p, slot) >= 1.5 || bad(p) || !open(p, slot)) return slot;   // (ORDERS.fileHold: no floor and no stopping short by that bar — within a stride or two of the place he holds where he stands, asked live and never kept, rather than be handed a place inside a body's room of a mate's; a place the far side of a wall from him is not one he is near: he walks on round to it)
      const here: Vec3 = [p[0], 0, p[2]], by = Math.min(m, ORDERS.fileTight); let t: Vec3 | null = null; for (const o of T) if (flat(o, p) < by - 0.05 && open(o, p) && (!t || flat(o, p) < flat(t, p))) t = o;
      const d = t ? flat(t, p) : 0; if (!t || d < 1e-3) return here;   // (…and a mate's place nearer him than a bare body's width: the step straight away from it that makes it one — or as much of one as the floor has, 5 cm at a time — where that floor is free, in his sight and no nearer another's)
      for (let r = by; r > d + 0.02; r -= 0.05) for (const ang of [0, 0.4, -0.4, 0.8, -0.8]) { const c = Math.cos(ang), sn = Math.sin(ang), ux = (p[0] - t[0]) / d, uz = (p[2] - t[2]) / d, x: Vec3 = [t[0] + (ux * c + uz * sn) * r, 0, t[2] + (uz * c - ux * sn) * r];   // (straight away first, then a little either side of it)
        if (!bad(x) && !g.col.nav.isBlocked(x[0], x[2]) && open(p, x) && T.every(o => o === t || flat(o, x) >= by - 0.05) && flat(sam, x) >= by - 0.05) return x; }   // (…nor onto Sam: the bar the others are held to)
      return here; };
    const R = this.apartOf.get(A);
    if (R && flat(R.at, slot) < 0.5) {
      if (R.q) { if ((R.short || clear(R.q, R.m)) && !bad(R.q)) return R.q; }
      else if (Math.abs(g.time - R.t) < 1) { const q = short(); if (!q) return hold(); R.q = q; R.short = true; return q; } }
    const taken = [...T, [sam[0], 0, sam[2]] as Vec3]; let q: Vec3 | null = null, by = m, stop = false;
    for (const a of ORDERS.fileTight < m ? [m, ORDERS.fileTight] : [m]) {   // (doorwayClearNear itself wants a clear line from the place to the point)
      q = doorwayClearNear(g, slot, x => bad(x) || !open(x, sam), taken, a, p) ?? doorwayClearNear(g, slot, bad, taken, a, p); if (q) { by = a; break; } }
    if (!q) { q = short(); stop = !!q; }
    this.apartOf.set(A, { at: [slot[0], 0, slot[2]], q, t: g.time, m: by, short: stop }); return q ?? hold();
  }
  /** the point `back` metres behind Sam along his trail — past its end, on straight the way it was going (behind his back while there is no trail), as far as the floor is free */
  private slot(back: number): Vec3 {
    const g = this.g, sam = g.player.char, T = this.trail;
    let prev: Vec3 = [sam.pos[0], 0, sam.pos[2]], left = back, dir: Vec3 = this.back;
    for (let i = T.length - 1; i >= 0; i--) {
      const seg = flat(prev, T[i]); if (seg < 1e-4) continue;
      const sd: Vec3 = [(T[i][0] - prev[0]) / seg, 0, (T[i][2] - prev[2]) / seg];
      if (seg > 0.2) dir = sd;
      if (seg >= left) return [prev[0] + sd[0] * left, 0, prev[2] + sd[2] * left];
      left -= seg; prev = T[i];
    }
    if (left <= 1e-3) return [prev[0], 0, prev[2]];
    // off the end of the trail: straight on, a quarter metre at a time, while a man can stand there and walk there — and where straight on is cut short (a
    // partition behind him), the first of a few headings either side of it that has the room (else the longest)
    const reach = (ang: number): [Vec3, number] => {
      const c = Math.cos(ang), sn = Math.sin(ang), d: Vec3 = [dir[0] * c + dir[2] * sn, 0, dir[2] * c - dir[0] * sn]; let p = prev, rem = left;
      while (rem > 1e-3) { const s = Math.min(0.25, rem), nx: Vec3 = [p[0] + d[0] * s, 0, p[2] + d[2] * s];
        if (g.col.nav.isBlocked(nx[0], nx[2]) || g.col.solidBlocked([p[0], 0.45, p[2]], [nx[0], 0.45, nx[2]])) break;
        p = nx; rem -= s; }
      return [p, rem];
    };
    let best = reach(0);
    for (const ang of [0.7, -0.7, 1.4, -1.4]) { if (best[1] <= 1e-3) break; const r = reach(ang); if (r[1] < best[1] - 0.2) best = r; }
    return [best[0][0], 0, best[0][2]];
  }

  // ------------------------------------------------------------ geometry
  /** the free floor at p, else the nearest within floorSnapM (the candidate nearest Sam among equals: the side of a wall he is looking at) — null: nowhere */
  freeSpot(p: Vec3): Vec3 | null {
    const nav = this.g.col.nav; if (!nav.isBlocked(p[0], p[2])) return [p[0], 0, p[2]];
    const sam = this.g.player.char.pos; let best: Vec3 | null = null, bs = Infinity;
    for (let r = 0.25; r <= ORDERS.floorSnapM + 1e-6; r += 0.25) { for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, q: Vec3 = [p[0] + Math.sin(a) * r, 0, p[2] + Math.cos(a) * r];
      if (nav.isBlocked(q[0], q[2])) continue; const s = r + 0.05 * flat(q, sam); if (s < bs) { bs = s; best = q; } } if (best) break; }
    return best;
  }
  /** n spots for a move order round `at`, abreast across the facing; a spot that is not free floor in the same space falls back along the line, then onto `at` itself */
  spotsAt(at: Vec3, face: number, n: number): Vec3[] {
    if (n <= 1) return [v3.copy(at)];
    const g = this.g, f: Vec3 = [Math.sin(face), 0, Math.cos(face)], r: Vec3 = [-f[2], 0, f[0]], h = ORDERS.moveSpread / 2;
    const ok = (q: Vec3) => !g.col.nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([at[0], 0.45, at[2]], [q[0], 0.45, q[2]]);
    const out: Vec3[] = [];
    const apart = (q: Vec3) => !out.some(o => flat(o, q) < 0.6);
    if (n > 2) {   // three or more: ranks of two across the facing, each rank fileGap behind the one ahead (four abreast is a wall of men no aisle has the width for) — spots 2k and 2k+1 are one rank: a pair's
      for (let i = 0; i < n; i++) { const row = i >> 1, lone = i === n - 1 && !(i & 1), s = lone ? 0 : (i & 1 ? h : -h), b = row * ORDERS.fileGap;
        const tries: Vec3[] = [[at[0] + r[0] * s - f[0] * b, 0, at[2] + r[2] * s - f[2] * b], [at[0] - f[0] * (b + 0.45), 0, at[2] - f[2] * (b + 0.45)]];
        for (let ring = 1; ring <= 4; ring++) for (let k = 0; k < 8; k++) { const a = face + Math.PI + k * Math.PI / 4; tries.push([at[0] + Math.sin(a) * 0.7 * ring, 0, at[2] + Math.cos(a) * 0.7 * ring]); }   // (a tight corner: anywhere free round the point, behind it first)
        out.push(tries.find(q => ok(q) && apart(q)) ?? v3.copy(at)); }
      return out;
    }
    for (let i = 0; i < n; i++) { const s = (i - (n - 1) / 2) * 2 * h;
      const tries: Vec3[] = [[at[0] + r[0] * s, 0, at[2] + r[2] * s], [at[0] - f[0] * h * 2 * (i + 1), 0, at[2] - f[2] * h * 2 * (i + 1)], [at[0] + f[0] * h * 2 * (i + 1), 0, at[2] + f[2] * h * 2 * (i + 1)]];
      for (let ring = 1; ring <= 3; ring++) for (let k = 0; k < 8; k++) { const a = face + k * Math.PI / 4; tries.push([at[0] + Math.sin(a) * 0.7 * ring, 0, at[2] + Math.cos(a) * 0.7 * ring]); }   // (a tight corner: anywhere free round the point)
      out.push(tries.find(q => ok(q) && apart(q)) ?? v3.copy(at)); }
    return out;
  }
  /** The stack's marks on `side` of a door for these men: the latch-side jamb and the hinge-side jamb (ORDERS.jambPast beyond each, jambOut off the wall), one man
   *  each; a jamb with no free floor at it (a wall running off the frame) sends both to the other, in file; one man takes the latch side unless a teammate
   *  already holds it on this door. No jamb on that side has floor: the marks somebody authored for the face (doorMarks), else the ones the men work out
   *  for themselves (workedMarks), else — a door across a passage, ORDERS.hallFile — a file back down the passage behind the jamb men (hallPlaces), else null.
   *  `lead` = the man on a jamb
   *  (stance 'stack'); the second in a file is at the high ready. `ignore`: teammates whose marks on this door do not count as held (doortools.ts: men about to
   *  step back and make room). */
  stackPosts(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[] = []): StackPost[] | null {
    return this.ownMarkFirst(d, side, men, () => this.stackSeen(d, side, men, ignore, () => this.stackPostsRoom(d, side, men, ignore)));
  }
  /** the plain 'stack up' on a door (the order below, nothing else): the marks above, and where its leaf STANDS OPEN the ones the floor beyond sees dealt again
   *  along the door's wall out of its view, on the men's own hand of the opening (stackroom.ts stackViewFix; a shut door: the marks above as they are).
   *  Asked inside the own-mark rule like the marks above: a man who stands on his mark with Sam come to stand by it keeps it. */
  stackPostsWait(d: Door, side: 1 | -1, men: Guard[]): StackPost[] | null {
    return this.ownMarkFirst(d, side, men, () => this.stackSeen(d, side, men, [], () => stackViewFix(this.g, d, side, this.stackPostsRoom(d, side, men, []), [this.samPlace, ...this.heldOn(d, men, [])], men)));
  }
  /** THE HAND OF THE DOOR NO KNOWN ENEMY SEES (picture.ts PICTURE.stack). `ask` is the whole chain that hands a stack its marks (the makers, the own-leaf
   *  rule, the MARKS pass, the room rule, and for the plain 'stack up' the view rule). Its answer stands unless the men know of an enemy AND a mark of it is
   *  in a firm believed line (exposedFor summed over the marks handed out: 0.5 or more). Then the chain is asked again with the whole order filed on ONE
   *  hand of the door (`fileHand`, read by stackPostsLeafIn: stackFileOn builds the file there, under the same boxes as the marks it replaces, and never
   *  where those were null) — the latch hand, then the hinge hand — and the file is dealt whose marks AS THE CHAIN HANDS THEM OUT sum to PICTURE.stackK of
   *  the dealt ones' or less (the lesser; the latch hand, the handle's, on a tie). So the choice is made on where the men end up, with the world's real
   *  boxes. While men of the order stand on their marks at this door the choice is KEPT: they are dealt the marks they stand on (the file, if that is what
   *  they were given), and nothing is chosen afresh. As it was: for another cast, and with no idea of any enemy. The trial asks put the makers' counters
   *  and the room rule's book back as they stood (what the glass rule learnt of a place is kept: the same answer whoever asks) and tick none of the
   *  picture's counts but `filed`; the answer given is the winning trial's own, so the makers' counters are the dealt ask's. */
  private stackSeen<P extends StackPost>(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[], ask: () => P[] | null): P[] | null {
    const g = this.g;
    if (!PICTURE.on || !PICTURE.stack || this.cast || this.fileHand || !men.length || !anyIdea(g, men)) return ask();
    const dealt = ask(); if (!dealt) return dealt;
    const th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side], H = d.def.hinge, c = d.frameCentre;
    const handOf = (p: Vec3, out: number): 0 | 1 | -1 => { const a = (p[0] - H[0]) * u[0] + (p[2] - H[1]) * u[1]; return a >= d.def.width + out ? 1 : a <= -out ? -1 : 0; };
    /** the chain asked with the whole order on hand `h`, nothing left behind but what the glass rule has learnt of a place (a kept answer, the same whoever asks) */
    const trial = (h: 1 | -1): P[] | null => { let P: P[] | null = null; const keep = this.marksKeep(); this.fileHand = h; this.fileGave = false; try { P = ask(); } finally { this.fileHand = 0; keep(); } return P && this.fileGave ? P : null; };
    // THE CHOICE IS KEPT: men of the order who stand on their marks at this door are dealt the marks they stand on — the file they were given, when the walls' own
    // marks are not theirs — and nothing is chosen afresh because an idea moved (nobody is walked across a door's front mid-stack)
    const own = this.ownMarks(d, side, men);
    if (own.length) { if (own.every(q => dealt.some(P => flat(P.pos, q) < OWN_EPS))) return dealt;
      const hs = own.map(q => handOf(q, 0)), h = hs[0]; if (!h || hs.some(x => x !== h)) return dealt;
      const P = trial(h); return P && own.every(q => P.some(X => flat(X.pos, q) < OWN_EPS)) ? P : dealt; }
    const sum = (P: P[]) => pictureQuiet(() => P.reduce((a, q) => a + exposedFor(g, men, q.pos), 0));
    const s0 = sum(dealt); if (s0 < 0.5) return dealt;
    // (stackroom.ts stackViewFix, a door that stands open: nobody is asked to cross its front — a hand is offered only if no man of the order stands ON the other)
    const on = stackViewOpen(d) ? men.map(m => m.char.pos).filter(p => (p[0] - c[0]) * n[0] + (p[2] - c[2]) * n[1] > 0 && flat(p, c) <= STACKROOM.viewMen).map(p => handOf(p, STACKROOM.viewOut)) : [];
    let best: P[] | null = null, bestS = PICTURE.stackK * s0, hinge = false;
    for (const h of [1, -1] as const) { if (on.includes(-h as 1 | -1)) continue;
      const P = trial(h); if (!P) continue; const s = sum(P); if (best ? s < bestS : s <= bestS) { best = P; bestS = s; hinge = h < 0; } }
    if (!best) return dealt;
    if (!this.samOut) { PICTURE_STATS.filed++; if (hinge) PICTURE_STATS.filedHinge++; }
    return best;   // (the trial's own answer: the makers' counters stay the dealt ask's)
  }
  /** the whole order on one hand (stackSeen's trial): 1 = the latch hand, -1 = the hinge hand; `fileGave` = the last answer of stackPostsLeafIn was that file */
  private fileHand: 0 | 1 | -1 = 0; private fileGave = false;
  /** what the makers of marks tick, and the room rule's book, as they stand: the returned call puts them back, once (noRoomWords' list but for the glass
   *  rule's kept answers, which a trial may leave: a place's answer is the same whoever asks it) */
  private marksKeep(): () => void {
    const tabs: Record<string, number>[] = [STACK_OWN, DOORMANNERS_STATS, STACKROOM_STATS, GLASSPEN_STATS], was = tabs.map(T => ({ ...T })), leaf = this.leafOutGave;
    const book = stackRoomBookKeep(this.g);
    return () => { this.leafOutGave = leaf; tabs.forEach((T, i) => Object.assign(T, was[i])); book(); };
  }
  /** THE WHOLE ORDER FILED ON ONE HAND OF THE DOOR, by the walk stackLeastGlass makes: a file down the wall from that jamb, fileGap between men, past a place
   *  Sam stands on or a teammate outside the order holds, stopping where the wall or the floor runs out — and where the room does (stackroom.ts
   *  stackRoomHas: the room rule has nothing to move in a file), by the line the walls' own places are asked by (three lines a hand apart, ORDERS.seamM)
   *  and off furniture as theirs are. Null — no such layout — with fewer places than men; on the hinge hand of the face the leaf opens toward (the file
   *  would stand in its arc and its front man cross the door to the handle); and by the glass rule against the
   *  marks it would replace: no place behind glass unless one of those was, and no more lines through glass than theirs (GLASS IS NOT COVER). */
  private stackFileOn(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[], latch: boolean, replaced: StackPost[]): StackPost[] | null {
    const g = this.g, K = ORDERS, th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side], H = d.def.hinge, w = d.def.width;
    const at = (along: number): Vec3 => [H[0] + u[0] * along + n[0] * K.jambOut, 0, H[1] + u[1] * along + n[1] * K.jambOut];
    const toward = latch ? -1 : 1, f: [number, number] = [u[0] * toward, u[1] * toward], face = Math.atan2(f[0], f[1]), stackSide = ((-n[0]) * (-f[1]) + (-n[1]) * f[0] >= 0 ? 1 : -1) as -1 | 1;
    const front: Vec3 = [d.frameCentre[0] + n[0] * K.jambOut, 0.45, d.frameCentre[2] + n[1] * K.jambOut], sam = this.samPlace, held = this.heldOn(d, men, ignore);
    if (!latch && !d.off && (side > 0 ? d.maxA > 0.05 : d.minA < -0.05)) return null;   // (guards.ts frameOf: the leaf's arc lies on the face its stops open toward)
    const seam = K.seamM, line = (q: Vec3): boolean => { if (g.col.solidBlocked(front, [q[0], 0.45, q[2]])) return false; if (!(seam > 0)) return true;
      const dx = q[0] - front[0], dz = q[2] - front[2], L = Math.hypot(dx, dz) || 1, ox = -dz / L * seam, oz = dx / L * seam;
      return !g.col.solidBlocked([front[0] + ox, 0.45, front[2] + oz], [q[0] + ox, 0.45, q[2] + oz]) && !g.col.solidBlocked([front[0] - ox, 0.45, front[2] - oz], [q[0] - ox, 0.45, q[2] - oz]); };
    const out: StackPost[] = [];
    for (let k = 0; k < men.length + 3 && out.length < men.length; k++) { const pos = at(latch ? w + K.jambPast + k * K.fileGap : -K.jambPast - k * K.fileGap);
      if (g.col.nav.isBlocked(pos[0], pos[2]) || !line(pos) || !stackRoomHas(g, d, side, pos)) break;
      if (flat(sam, pos) < 0.7 || held.some(q => flat(q, pos) < 0.7) || this.onFurniture(pos)) continue;
      out.push({ pos, face, stackSide, lead: k === 0, ...(men.length > 2 ? { group: out.length >> 1 } : {}) }); }
    if (out.length < men.length) return null;
    const lines = (P: StackPost[]) => P.reduce((a, q) => a + this.glassEyes(d, side, q.pos), 0);
    if ((!replaced.some(q => this.behindGlass(d, side, q.pos)) && out.some(q => this.behindGlass(d, side, q.pos))) || lines(out) > lines(replaced)) return null;
    if (!held.length && !out[0].lead) out[0].lead = true;
    return out;
  }
  // (stackroom.ts: every mark is on the floor of the room that face of the door is in — one dealt beyond a wall, or through the next doorway, is dealt again;
  //  asked INSIDE the own-mark rule, so both of its asks get room-checked marks and Sam's place in the room rule's taken list follows `samPlace`)
  private stackPostsRoom(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[] = []): StackPost[] | null {
    return stackRoomFix(this.g, d, side, this.stackPostsMarks(d, side, men, ignore), [this.samPlace, ...this.heldOn(d, men, ignore)]);
  }
  /** doorway.ts OWN MARK, asked where a stack's marks are handed out (here, and for the door tools' tucked stack in doortools.ts), whichever maker dealt
   *  them — a jamb and its file, a corner door's places back from it, the marks men work out, a mark the MARKS pass moved. Only with a man of the order
   *  standing on his mark on this face and Sam come to stand by it. The plain answer stands where it leaves every such man the mark he stands on. Else the
   *  marks are asked as if Sam were not there (`samOut`: every maker reads `samPlace`), and that answer is given when every mark of it within a body of Sam
   *  is EXACTLY a mark such a man stands on: the men are dealt the marks they stand on. Any other mark under Sam (one a man is still walking to, a spare
   *  place): Sam's place is his, and the plain answer stands — so with some of the order still walking, a standing man can still be moved along. */
  ownMarkFirst<P extends { pos: Vec3 }>(d: Door, side: 1 | -1, men: Guard[], ask: () => P[] | null): P[] | null {
    if (!DOORMANNERS.on || !DOORMANNERS.ownMark || this.samOut) return ask();
    const sam = this.g.player.char.pos, own = this.ownMarks(d, side, men);
    if (!own.some(q => flat(sam, q) < 1.3)) return ask();   // (nobody of the order stands on a mark by him: nothing to ask twice)
    const stats = () => [STACK_OWN.leaf, DOORMANNERS_STATS.marks, STACK_OWN.mark], c0 = stats(), plain = ask(), c1 = stats();
    if (plain && own.every(q => plain.some(P => flat(P.pos, q) < OWN_EPS))) return plain;
    let blind: P[] | null; this.samOut = true; try { blind = ask(); } finally { this.samOut = false; }
    const c2 = stats(), took = !!blind && blind.every(P => flat(sam, P.pos) >= 0.75 || own.some(q => flat(q, P.pos) < OWN_EPS));
    if (!took) { [STACK_OWN.leaf, DOORMANNERS_STATS.marks, STACK_OWN.mark] = c1; return plain; }
    const changed = !plain || plain.length !== blind!.length || plain.some((P, i) => flat(P.pos, blind![i].pos) > 0.01);
    [STACK_OWN.leaf, DOORMANNERS_STATS.marks, STACK_OWN.mark] = [c0[0] + c2[0] - c1[0], c0[1] + c2[1] - c1[1], c0[2] + (changed || c1[2] > c0[2] ? 1 : 0)];   // (one answer given: one ask counted, and the rule once where it gave a man his mark)
    return blind!;
  }
  /** the marks men of an order STAND on, on this face of this door (within a pace of the post their order on the door gave them) */
  ownMarks(d: Door, side: 1 | -1, men: Guard[]): Vec3[] {
    const th = d.def.closedDir, nx = -Math.sin(th) * side, nz = Math.cos(th) * side, c = d.frameCentre, out: Vec3[] = [];
    for (const gd of men) { const A = this.asg.get(gd);
      if (A && gd.state !== 'dead' && A.door === d && A.post !== null && flat(gd.char.pos, A.post) < 0.6 && (A.post[0] - c[0]) * nx + (A.post[2] - c[2]) * nz > 0) out.push(A.post); }
    return out;
  }
  private samOut = false;
  /** ORDERS.inWay: the words of a 'no room' refusal on a door. `ask` is the very ask that has just found no places; it is asked once more as if Sam were
   *  not there (`samOut`, as the own-mark rule's second ask: every maker of marks reads `samPlace`). Places for every man that way: the one thing on the
   *  door is Sam's own body, and the man says so. The second answer is only looked at for being there — nothing is dealt from it, the counters the makers
   *  tick and the memos they fill (the floors of stackroom.ts, the shots asked through glass) are put back as they stood, no die is thrown — so the order is refused exactly as it was and no man's place can differ by the key. */
  noRoomWords(plain: string, ask: () => unknown): string {
    if (!ORDERS.inWay || this.samOut) return plain;
    const tabs: Record<string, number>[] = [STACK_OWN, DOORMANNERS_STATS, STACKROOM_STATS, GLASSPEN_STATS], was = tabs.map(T => ({ ...T })), leaf = this.leafOutGave;
    const book = stackRoomBookKeep(this.g), glass = new Map(this.glassAt), glassSig = this.glassSig;   // (… and the memos the makers fill: the floors of stackroom.ts, the shots asked through glass)
    let free = false; this.samOut = true;
    try { free = !!ask(); } finally { this.samOut = false; this.leafOutGave = leaf; tabs.forEach((T, i) => Object.assign(T, was[i])); book(); this.glassAt = glass; this.glassSig = glassSig; }
    return free ? IN_WAY_WORDS : plain;
  }
  /** where Sam stands, as the makers of marks ask it ('a place Sam stands on is his') — nowhere during ownMarkFirst's second ask */
  get samPlace(): Vec3 { return this.samOut ? NOWHERE : this.samStood; }
  /** where Sam stands, to the marks the door code makes (one of ours nobody is sent to stand on). To another cast he is no friend of theirs and they are
   *  not told where he is: nowhere */
  get samStood(): Vec3 { return this.cast ? NOWHERE : this.g.player.char.pos; }
  private stackPostsMarks(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[] = []): StackPost[] | null {
    const out = this.stackPostsAsWere(d, side, men, ignore); if (!out || !DOORMANNERS.on || !DOORMANNERS.markClear) return out;
    // (doorway.ts MARKS: a mark of a man who is not at a jamb is in no frame's strip and nowhere a leaf swings — this door's or the next one's — where there
    //  is floor by it on this face with a line to the doorway's front; the jamb men's marks are the door's own and stay)
    const g = this.g, c = d.frameCentre, th = d.def.closedDir, n: [number, number] = [-Math.sin(th) * side, Math.cos(th) * side];
    const front: Vec3 = [c[0] + n[0] * ORDERS.jambOut, 0.45, c[2] + n[1] * ORDERS.jambOut], sam = this.samPlace, held = this.heldOn(d, men, ignore);
    // (OWN LEAF: marks dealt with the door's own open leaf left out are moved by the same line — the one they were given by)
    const all = g.col.dynamicBoxes, lines = this.leafOutGave ? all.filter(b => b !== d.box) : all;
    const cut = (q: Vec3) => { g.col.dynamicBoxes = lines; try { return g.col.solidBlocked(front, [q[0], 0.45, q[2]]); } finally { g.col.dynamicBoxes = all; } };
    for (let i = 0; i < out.length; i++) { const P = out[i]; if (P.lead || !doorwayInWay(g, P.pos)) continue;   // (one at a time: the next is kept off where this one went)
      const q = doorwayClearNear(g, P.pos, q => doorwayInWay(g, q) || (q[0] - c[0]) * n[0] + (q[2] - c[2]) * n[1] < 0.3 || cut(q), [sam, ...held, ...out.filter((_, j) => j !== i).map(o => o.pos)], 0.75);   // (a body's room from every other mark)
      if (q) { DOORMANNERS_STATS.marks++; out[i] = { ...P, pos: q }; } }
    return out;
  }
  private stackPostsAsWere(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[] = []): StackPost[] | null {
    const out = this.stackPostsLeafIn(d, side, men, ignore); this.leafOutGave = false;
    if (out || !DOORMANNERS.on || !DOORMANNERS.ownLeaf || Math.abs(d.angle) < 0.3 || d.off) return out;
    // (doorway.ts OWN LEAF: the door's own leaf, standing open across this face, is no wall to its own stack. Every mark is asked for a line from the doorway's
    //  front, and a leaf open at a right angle cuts the whole hinge-side file off from it — in a passage the latch side has one place, so the answer was 'no room
    //  on that door' on a door anybody could see four men standing at. Only where that was the answer: the marks are then the ones the door has when it is shut
    //  — where the men stand the moment after one of them has pulled it open — every OTHER leaf still a wall)
    const g = this.g, all = g.col.dynamicBoxes; g.col.dynamicBoxes = all.filter(b => b !== d.box);
    try { const marks = this.stackPostsLeafIn(d, side, men, ignore); if (marks) { STACK_OWN.leaf++; this.leafOutGave = true; } return marks; } finally { g.col.dynamicBoxes = all; }
  }
  private leafOutGave = false;   // (the last answer of stackPostsAsWere was the OWN LEAF rule's: its caller moves marks by the same line)
  private stackPostsLeafIn(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[] = []): StackPost[] | null {
    const as = (glassPenLive(this.g) && GLASSPEN.stackEyes > 0 ? this.stackPostsOn(d, side, men, ignore, true) ?? this.stackLeastGlass(d, side, men, ignore) : null) ?? this.stackPostsOn(d, side, men, ignore, false);   // (GLASS IS NOT COVER: first with the places a round reaches through a pane counted as no floor; a door with glass at both hands: everybody on the hand fewer of those lines reach (stackLeastGlass); no such hand, or no room on it: the walls' own marks)
    const out = as ?? (ORDERS.hallFile ? this.stackPostsOn(d, side, men, ignore, false, true) : null);   // (… and only where both said 'no room': a door across a passage — the men the jambs have no room for file up behind them, back down it)
    if (!this.fileHand || !out) return out;   // (stackSeen's trial: the whole order on one hand, only where there were marks to replace)
    const file = this.stackFileOn(d, side, men, ignore, this.fileHand > 0, out); if (file) this.fileGave = true;
    return file ?? out;
  }
  /** GLASS IS NOT COVER (rebuild/glass/tuning.md round one; glasspen.ts shotThroughGlass): is a man stood at `pos` on face `side` of this door in a line of fire
   *  THROUGH GLASS from the floor beyond it — a sidelight beside the frame, a glazed partition the jamb runs into? The floor beyond is workedMarks' lattice
   *  (7.5 m deep, 6 m to either hand, chest height); GLASSPEN.stackEyes of its points with such a line make the place no place to wait at. Level geometry and
   *  the glass rule alone, so worked out once per place and kept until a pane's toll changes (glasspen.ts glassTollSig). False while rounds stop in glass (the switch off): the stack is then the one it always was. */
  behindGlass(d: Door, side: 1 | -1, pos: Vec3): boolean { return this.glassEyes(d, side, pos) >= GLASSPEN.stackEyes && GLASSPEN.stackEyes > 0; }
  /** … and how many of the lattice's points have such a line onto him (0 while rounds stop in glass, or with the rule off) */
  glassEyes(d: Door, side: 1 | -1, pos: Vec3, kept = true): number {
    const g = this.g; if (!glassPenLive(g) || GLASSPEN.stackEyes <= 0) return 0;
    const sig = glassTollSig(g); if (sig !== this.glassSig) { this.glassAt.clear(); this.glassSig = sig; }   // (a pane holed, come apart or made whole again since — a restart included: what a round pays there has moved, so the places are asked afresh)
    const key = `${g.doors.list.indexOf(d)}:${side}:${Math.round(pos[0] * 10)}:${Math.round(pos[2] * 10)}`; let v = kept ? this.glassAt.get(key) : undefined; if (v !== undefined) return v;   // (`kept` false: counted for this very point and not kept — the kept answer is the first asker's in its 10 cm cell)
    const th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side], c = d.frameCentre, eyes: Vec3[] = [];
    for (let b = 0.75; b <= 7.5; b += 0.75) for (let l = -6; l <= 6; l += 0.75) { const q: Vec3 = [c[0] - n[0] * b + u[0] * l, 1.3, c[2] - n[1] * b + u[1] * l]; if (!g.col.nav.isBlocked(q[0], q[2])) eyes.push(q); }
    v = shotThroughGlass(g, eyes, [pos[0], 1.3, pos[2]]); if (kept) this.glassAt.set(key, v);
    return v;
  }
  /** GLASS AT BOTH HANDS OF A DOOR (GLASSPEN.stackLeast; a front door with a sidelight a rifle reaches either jamb through): the glass pass found no place
   *  — both jambs are in such lines — and the walls' own marks would put a man on each, one of them at the window. Instead everybody stacks on the ONE hand
   *  fewer of those lines reach: a file down its wall from the jamb, fileGap between men, past a place Sam stands on or a teammate outside the order holds
   *  on this door — so the hand with the pane is nobody's, and nobody has to cross the door front to join a file behind it. Taken only where it is plainly
   *  the better stack: the lines onto the places dealt, summed, are at most `stackLeastK` of those onto the walls' own marks for the same men (the counts
   *  are a lattice's: two hands a few lines apart are the same hand). Null — the walls' own marks, as it was — with the switch off, where a jamb is NOT in
   *  such a line (the glass pass ran out of room for another reason), where that wall has no floor for every man, and where the file is no such gain. */
  private stackLeastGlass(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[]): StackPost[] | null {
    if (!GLASSPEN.stackLeast || !men.length) return null;
    const g = this.g, K = ORDERS, th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side], H = d.def.hinge, w = d.def.width;
    const at = (along: number): Vec3 => [H[0] + u[0] * along + n[0] * K.jambOut, 0, H[1] + u[1] * along + n[1] * K.jambOut];
    const nL = this.glassEyes(d, side, at(w + K.jambPast)), nH = this.glassEyes(d, side, at(-K.jambPast));
    if (nL < GLASSPEN.stackEyes || nH < GLASSPEN.stackEyes || nL === nH) return null;
    const base = this.stackPostsOn(d, side, men, ignore, false); if (!base) return null;   // (what it would be instead; nothing there: the passage's file is the answer, not this)
    const latch = nH > nL, toward = latch ? -1 : 1, f: [number, number] = [u[0] * toward, u[1] * toward], face = Math.atan2(f[0], f[1]), stackSide = ((-n[0]) * (-f[1]) + (-n[1]) * f[0] >= 0 ? 1 : -1) as -1 | 1;
    const front: Vec3 = [d.frameCentre[0] + n[0] * K.jambOut, 0.45, d.frameCentre[2] + n[1] * K.jambOut], sam = this.samPlace, held = this.heldOn(d, men, ignore);
    const out: StackPost[] = [];
    for (let k = 0; k < men.length + 3 && out.length < men.length; k++) { const pos = at(latch ? w + K.jambPast + k * K.fileGap : -K.jambPast - k * K.fileGap);
      if (g.col.nav.isBlocked(pos[0], pos[2]) || g.col.solidBlocked(front, [pos[0], 0.45, pos[2]])) break;   // (the wall — or the floor — runs out)
      if (flat(sam, pos) < 0.7 || held.some(q => flat(q, pos) < 0.7)) continue;   // (his, or theirs: the file goes on past it)
      out.push({ pos, face, stackSide, lead: k === 0, ...(men.length > 2 ? { group: out.length >> 1 } : {}) }); }
    if (out.length < men.length) return null;
    const lines = (P: StackPost[]) => P.reduce((a, q) => a + this.glassEyes(d, side, q.pos), 0);
    if (lines(out) > GLASSPEN.stackLeastK * lines(base)) return null;
    if (!held.length && !out[0].lead) out[0].lead = true;   // (Sam on the jamb: the front man of the file behind him has the door — as stackPostsOn's files have it)
    return out;
  }
  /** A DOOR ACROSS A PASSAGE (ORDERS.hallFile): may a man wait at `pos` on face `side` of it — floor, a clear line from the doorway's front a hand's width
   *  to either side of the straight one as well (two boxes meeting edge to edge let the one line through), and not on another door's threshold (a doorway
   *  is floor to the nav grid; nobody waits in front of a room nobody has opened: within its opening's width and a stride of its wall) */
  private hallStands(d: Door, side: 1 | -1, pos: Vec3): boolean {
    const g = this.g, K = ORDERS, th = d.def.closedDir, nx = -Math.sin(th) * side, nz = Math.cos(th) * side;
    if (g.col.nav.isBlocked(pos[0], pos[2])) return false;
    const fx = d.frameCentre[0] + nx * K.jambOut, fz = d.frameCentre[2] + nz * K.jambOut, dx = pos[0] - fx, dz = pos[2] - fz, len = Math.hypot(dx, dz) || 1;
    for (const k of [0, 0.08, -0.08]) { const ox = -dz / len * k, oz = dx / len * k; if (g.col.solidBlocked([fx + ox, 0.45, fz + oz], [pos[0] + ox, 0.45, pos[2] + oz])) return false; }
    for (const o of g.doors.list) { if (o === d) continue;
      const t = o.def.closedDir, ux = Math.cos(t), uz = Math.sin(t), rx = pos[0] - o.def.hinge[0], rz = pos[2] - o.def.hinge[1];
      if (Math.abs(rx * ux + rz * uz - o.def.width / 2) < o.def.width / 2 + 0.35 && Math.abs(-rx * uz + rz * ux) < 1.1) return false; }
    return true;
  }
  /** A DOOR ACROSS A PASSAGE: up to `k` places back down the passage on face `side`, behind the door's jamb marks — a column behind each jamb a man can
   *  stand at, a man every `fileGap`, the first `from` metres off the door's wall, nearest the door first, closing up to or stepping past a side door's
   *  threshold (shut or open), until the passage runs out. A PASSAGE: each place has a wall at its outer shoulder (within 0.8 m, on the hand away from the
   *  opening) — a room's open floor gives none, so a door onto a room gets no column out into it. The men face the door, off the straight line through the
   *  opening by the jamb's own margin: in a passage the width of its door that is all the cover there is (a hallway's stack; whoever is behind the door
   *  sees the file once it opens). `taken`: a place somebody else has — with Sam on the jamb the first man of the file has the door from where the file
   *  starts. Used for the stack (stackPostsOn's last pass, any number of men the older marks had no room for) and for a charge's stand-off
   *  (doortools.ts standoffPosts' last answer, any number of men: a face with such a column and no other room to stand off). */
  hallPlaces(d: Door, side: 1 | -1, k: number, from: number, taken: (p: Vec3) => boolean): StackPost[] {
    const g = this.g, K = ORDERS, th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side];
    const H = d.def.hinge, w = d.def.width, c = d.frameCentre, out: StackPost[] = []; if (k <= 0) return out;
    const at = (s: number, off: number): Vec3 => { const along = s === 0 ? w + K.jambPast : -K.jambPast; return [H[0] + u[0] * along + n[0] * off, 0, H[1] + u[1] * along + n[1] * off]; };
    const HALL_GAP = 2.6;
    const walled = (s: number, p: Vec3) => { const wd = s === 0 ? 1 : -1;   // (three lines a hand apart: a wall's boxes meet edge to edge at a post, and one line can slip between two)
      return [0, 0.08, -0.08].some(e => g.col.solidBlocked([p[0] + n[0] * e, 0.45, p[2] + n[1] * e], [p[0] + n[0] * e + u[0] * wd * 0.8, 0.45, p[2] + n[1] * e + u[1] * wd * 0.8])); };
    const cols: { off: number; P: StackPost }[] = [];
    for (const s of [0, 1]) { const j = at(s, K.jambOut); if (!this.hallStands(d, side, j) || !walled(s, j)) continue;   // (a column only behind a jamb a man can stand at)
      // the next place: a `fileGap` behind the last; where that is no place to wait (another door's threshold — shut or standing open —, somebody's place)
      // the nearest one that is: closer, up to 0.7 m behind the last, else on past it. The column ends where no place turns up within a side door's width
      // and its margins (HALL_GAP): the passage's wall or floor has run out, or it has opened into a room
      const good = (off: number) => { const p = at(s, off); return this.hallStands(d, side, p) && walled(s, p) && !taken(p) ? p : null; };
      let last = -Infinity;
      for (let n0 = 0; n0 < k; n0++) { const o = n0 ? last + K.fileGap : from; let off = o, p = good(o);
        for (let b = o - 0.05; !p && n0 > 0 && b >= last + 0.7 - 1e-6; b -= 0.05) if ((p = good(b))) off = b;
        for (let a = o + 0.05; !p && a <= o + HALL_GAP && a <= from + 9; a += 0.05) if ((p = good(a))) off = a;
        if (!p) break;
        const f: [number, number] = [c[0] - p[0], c[2] - p[2]], wd = s === 0 ? 1 : -1;   // (he faces the door; the passage's wall is on the shoulder away from the opening)
        cols.push({ off, P: { pos: p, face: Math.atan2(f[0], f[1]), stackSide: (u[0] * wd * -f[1] + u[1] * wd * f[0] >= 0 ? 1 : -1) as -1 | 1, lead: false, group: 2 } });
        last = off; }
    }
    cols.sort((a, b) => a.off - b.off);
    for (const C of cols) { if (out.length >= k) break; if (!out.some(o => flat(o.pos, C.P.pos) < 0.7)) out.push(C.P); }
    return out;
  }
  private glassAt = new Map<string, number>();
  private glassSig = 0;
  /** doorway.ts FURNITURE never costs a door its stack: where keeping the places off the furniture leaves 'no room', the same places are asked again with
   *  the furniture left in — the men shove it, as they always did */
  private stackPostsOn(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[], glass: boolean, hall = false): StackPost[] | null {
    const out = this.stackPlaces(d, side, men, ignore, glass, hall); if (out || this.furIn || !DOORMANNERS.on || !DOORMANNERS.offFurniture) return out;
    this.furIn = true; try { return this.stackPlaces(d, side, men, ignore, glass, hall); } finally { this.furIn = false; }
  }
  private furIn = false;
  private stackPlaces(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[], glass: boolean, hall: boolean): StackPost[] | null {
    const g = this.g, K = ORDERS, th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side];
    const H = d.def.hinge, w = d.def.width, front: Vec3 = [d.frameCentre[0] + n[0] * K.jambOut, 0.45, d.frameCentre[2] + n[1] * K.jambOut];
    const mk = (along: number, toward: 1 | -1, off = K.jambOut): StackPost => {   // `along`: metres from the hinge down the closed leaf's line; `toward`: which way along it the doorway lies; `off`: metres off the wall
      const pos: Vec3 = [H[0] + u[0] * along + n[0] * off, 0, H[1] + u[1] * along + n[1] * off];
      const f: [number, number] = [u[0] * toward, u[1] * toward];
      return { pos, face: Math.atan2(f[0], f[1]), stackSide: ((-n[0]) * (-f[1]) + (-n[1]) * f[0] >= 0 ? 1 : -1) as -1 | 1, lead: true };   // (the wall is on his right when it lies along his facing's right-hand normal)
    };
    const sam = this.samPlace;   // (a jamb Sam is standing on is his)
    // (doorway.ts OWN MARK: … unless a man of this very order already STANDS on it as his mark on this door — stacked, with Sam come to stand by him. The mark
    //  is the man's: a door tool given to a squad that stands stacked on the door is dealt the marks it stands on, where it used to be told 'no room on that
    //  door' the moment Sam's body covered the one spare place of a file. A mark a man is still walking to is not his yet: Sam on it sends the file on past)
    const ownMark = DOORMANNERS.on && DOORMANNERS.ownMark, samOn = (p: Vec3) => { if (flat(sam, p) >= 0.7) return false;
      if (!ownMark || !this.stoodOn(d, men, p)) return true;
      STACK_OWN.mark++; return false; };
    // (the line from the doorway's front to a place is asked THREE times, a hand's width apart, when `seamM` is set: a single line that runs exactly along the
    //  seam where two boxes of one wall abut passes between them — the barracks' gallery door, hung as a real 0.86 m leaf, had its second latch-side place land
    //  on free floor BEYOND a waist-high wall that way, eleven metres' walk from the door it was a stack mark for)
    const seam = K.seamM, line = (q: Vec3): boolean => { if (g.col.solidBlocked(front, [q[0], 0.45, q[2]])) return false; if (!(seam > 0)) return true;
      const dx = q[0] - front[0], dz = q[2] - front[2], L = Math.hypot(dx, dz) || 1, ox = -dz / L * seam, oz = dx / L * seam;
      return !g.col.solidBlocked([front[0] + ox, 0.45, front[2] + oz], [q[0] + ox, 0.45, q[2] + oz]) && !g.col.solidBlocked([front[0] - ox, 0.45, front[2] - oz], [q[0] - ox, 0.45, q[2] - oz]); };
    const floor = (p: { pos: Vec3 }) => !g.col.nav.isBlocked(p.pos[0], p.pos[2]) && line(p.pos) && !(glass && this.behindGlass(d, side, p.pos));   // (… and, GLASS IS NOT COVER, no place a round reaches through a pane from beyond the door)
    // (doorway.ts FURNITURE: … and a place a piece of furniture stands on is the furniture's: the file goes on past it as it does past Sam — with the same
    //  exception: a mark a man of this order already stands on is his, whatever has since been shoved up against it)
    const fur = (p: Vec3) => this.onFurniture(p) && !(ownMark && this.stoodOn(d, men, p));
    const free = (p: { pos: Vec3 }) => floor(p) && !samOn(p.pos) && !fur(p.pos);
    const latch = mk(w + K.jambPast, -1), hinge = mk(-K.jambPast, 1);
    const okL = free(latch), okH = free(hinge);
    const heldBy = (p: { pos: Vec3 }) => [...this.asg].some(([gd, A]) => !men.includes(gd) && !ignore.includes(gd) && A.door === d && A.post !== null && flat(A.post, p.pos) < (A.order === 'stack' ? 0.4 : 0.9));   // (a man on that jamb under any order on this door — the door tools tuck theirs a little along the wall)
    // the SQUAD OF FOUR's part-orders (one pair, one man): the marks teammates outside this order already hold on this door are theirs — the files go on past them
    const held: Vec3[] = this.big ? [...this.asg].filter(([gd, A]) => !men.includes(gd) && !ignore.includes(gd) && gd.state !== 'dead' && A.door === d && A.post !== null).map(([, A]) => A.post!) : [];
    const pick1 = okL && !(heldBy(latch) && okH) ? latch : hinge;
    if (men.length > 2 ? floor(latch) || floor(hinge) : held.length > 0 && (okL || okH) && (men.length === 2 || heldBy(pick1))) {
      // THREE OR MORE (or fewer, on a door other teammates hold): a file on each jamb, fileGap between men, the latch file the longer by one; a jamb whose wall
      // (or floor) runs out sends the rest to the other file; still short, a second rank a stride further off the wall behind the files' second places. A place
      // Sam stands on is his, and one a teammate outside the order holds is that man's: the file goes on past it. Null: not enough floor for all of them.
      // `group` says which file (pair() keeps a pair in one); `lead` = the man AT a jamb.
      const N = men.length, theirs = (P: StackPost) => samOn(P.pos) || fur(P.pos) || held.some(q => flat(q, P.pos) < 0.7);
      const file = (latchSide: boolean, off = K.jambOut, k0 = 0): StackPost[] => { const out: StackPost[] = [];
        for (let k = k0; k < N + 3 && out.length < N; k++) { const P = latchSide ? mk(w + K.jambPast + k * K.fileGap, -1, off) : mk(-K.jambPast - k * K.fileGap, 1, off);
          if (!floor(P)) break; if (theirs(P)) continue; P.lead = k === 0 && off === K.jambOut; out.push(P); }
        return out; };
      const L = file(true), Hf = file(false);
      if (N === 1) { const a = L[0], b = Hf[0]; return !a && !b ? null : [!b || (a && flat(a.pos, latch.pos) <= flat(b.pos, hinge.pos)) ? a : b]; }   // (one man: the free place nearest a jamb, the latch's first)
      let nl = Math.min(L.length, Math.ceil(N / 2)); const nh = Math.min(Hf.length, N - nl); nl = Math.min(L.length, N - nh);
      const split = nl > 0 && nh > 0;
      const out: StackPost[] = [...L.slice(0, nl).map((P, i) => ({ ...P, group: split ? 0 : i >> 1 })), ...Hf.slice(0, nh).map((P, i) => ({ ...P, group: split ? 1 : i >> 1 }))];
      if (out.length < N) for (const P of [...file(true, K.jambOut + K.fileGap, 1), ...file(false, K.jambOut + K.fileGap, 1)]) { if (out.length >= N) break; if (!out.some(o => flat(o.pos, P.pos) < 0.7)) out.push({ ...P, lead: false, group: 2 }); }
      if (out.length && out.length < N) out.push(...this.rearPosts(d, side, N - out.length, [...out.map(o => o.pos), ...held]));   // (a door in a corner: the men the wall has no room for stand back from it)
      if (hall && out.length < N) {   // (a door across a passage, and the answer was 'no room': the rest file up behind the jamb men, back down the passage — hallPlaces)
        // What the older marks did find is looked at again first, harder (hallStands: a 'place' beyond a sill two boxes let one line through to, a place on
        // another door's threshold), then the file. One column: pairs in the order they stand; a column behind each jamb: a group a column.
        const kept = out.filter(P => this.hallStands(d, side, P.pos) && floor(P)); out.length = 0; out.push(...kept);
        out.push(...this.hallPlaces(d, side, N - out.length, K.jambOut + K.fileGap, q => samOn(q) || fur(q) || held.some(h => flat(h, q) < 0.7) || out.some(o => flat(o.pos, q) < 0.7)));
        const col = (P: StackPost) => (P.pos[0] - H[0]) * u[0] + (P.pos[2] - H[1]) * u[1] > w / 2 ? 0 : 1, off = (P: StackPost) => (P.pos[0] - H[0]) * n[0] + (P.pos[2] - H[1]) * n[1];
        const both = out.some(P => col(P) === 0) && out.some(P => col(P) === 1);
        out.sort((a, b) => off(a) - off(b)); out.forEach((P, k) => { P.group = both ? col(P) : k >> 1; });
      }
      if (out.length < N) return null;
      if (!held.length && !out.some(P => P.lead)) out[0].lead = true;   // (Sam on the only jamb with floor: the front man of the file behind him has the door)
      return out;
    }
    if (!okL && !okH && ((floor(latch) && fur(latch.pos)) || (floor(hinge) && fur(hinge.pos)))) return null;   // (a jamb with floor, and furniture on it: no answer OFF the furniture for these few — stackPostsOn asks again with it left in. A furnished jamb is never 'no floor at either jamb': those marks are for a face the LEVEL leaves none)
    if (!okL && !okH) {   // no floor at either jamb: the marks somebody authored for this face, if anybody did (doorMarks) — else the ones the men work out
      const M = this.doorMarks.find(m => m.door === d && m.side === side);
      if (!M || !M.stack.length) return this.workedStack(d, side, men.length, [sam, ...this.heldOn(d, men, ignore)]);   // (… where the level itself leaves neither jamb floor — a leaf standing across one is no such face)
      const taken = (p: Vec3) => [...this.asg].some(([gd, A]) => !men.includes(gd) && !ignore.includes(gd) && A.door === d && A.post !== null && flat(A.post, p) < 0.45);   // (one man: not the mark another of the squad stands on under an order on this door)
      const marks = men.length <= 1 ? [M.stack.find(p => !taken(p)) ?? M.stack[0]] : M.stack.slice(0, men.length);
      return marks.map((p, i) => ({ ...mk((p[0] - H[0]) * u[0] + (p[2] - H[1]) * u[1], (p[0] - H[0]) * u[0] + (p[2] - H[1]) * u[1] > w / 2 ? -1 : 1), pos: v3.copy(p), lead: i === 0 }));
    }
    if (men.length <= 1) return [pick1];
    if (okL && okH) return [latch, hinge];
    const first = okL ? latch : hinge, second = okL ? mk(w + K.jambPast + K.fileGap, -1) : mk(-K.jambPast - K.fileGap, 1); second.lead = false;
    if (K.secondFloor && !free(second)) {   // (the pair's second place in the file was never asked whether it is floor with a line to the door — ORDERS.secondFloor)
      const rank = okL ? mk(w + K.jambPast, -1, K.jambOut + K.fileGap) : mk(-K.jambPast, 1, K.jambOut + K.fileGap); rank.lead = false;
      if (free(rank)) return [first, rank];   // (behind the jamb man, a stride further off the wall — the second rank three or more get)
      const rear = this.rearPosts(d, side, 4, [first.pos]).filter(floor);   // (… else stood back from the door, as the men a corner has no room for — in the glass pass only a place no round reaches through a pane)
      if (rear.length) return [first, rear[0]];
      // (… else the nearest floor on the jamb man's hand of the opening with a line to the doorway: a lattice out from the wall and along it, never before the opening)
      let near: StackPost | null = null, nearD = Infinity;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 6; j++) { const P = okL ? mk(w + K.jambPast + j * 0.3, -1, K.jambOut + i * 0.3) : mk(-K.jambPast - j * 0.3, 1, K.jambOut + i * 0.3), D = flat(P.pos, first.pos);
        if (D < K.fileGap - 0.1 || D >= nearD || !free(P) || g.props.props.some(pr => propGap(pr, P.pos) < 0.3)) continue; near = P; nearD = D; }
      if (near) { near.lead = false; return [first, near]; }
      if (glass) return null;   // (the glass pass has no place for him: the hand fewer panes look at, then the walls' own marks, decide — stackPostsAsWere)
    }
    if (fur(second.pos)) return null;   // (the pair's second place is on furniture: asked again with the furniture left in, as above)
    return [first, second];   // (… else the place as it always was: he stands as near it as the floor lets him. Never a refusal the older marks did not give)
  }
  /** A DOOR FACE WITH NO FLOOR AT EITHER JAMB, and no marks authored for it: every place the men could stand for it instead. The free floor on that face
   *  within a few metres of the frame — a clear walk from the doorway's front, clear of the furniture where it rests, and OFF THE LINE OF THE OPENING (what
   *  comes out of a doorway comes out down its middle) — each with its `walk` from the door and how much of the floor BEYOND the door sees it through the open
   *  doorway (`seen`, 0 to 1: a sight line, so glass does not hide a man, and the leaf is not asked — the marks are for when it has swung), so the stack forms
   *  where the room it is about to enter sees least of it. Level geometry alone (statics, the nav grid, props at home — never where a leaf happens to stand):
   *  worked out once per face. `jambless` false (a jamb has floor): no marks, the walls' own posts stand. */
  workedMarks(d: Door, side: 1 | -1): { jambless: boolean; marks: { pos: Vec3; walk: number; seen: number }[] } {
    const key = side > 0 ? 0 : 1; let both = this.worked.get(d); if (!both) this.worked.set(d, both = [null, null]);
    const had = both[key]; if (had) return had;
    const g = this.g, K = ORDERS, nav = g.col.nav, th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side];
    const c = d.frameCentre, w = d.def.width, h = w / 2, at = (b: number, l: number, y = 0): Vec3 => [c[0] + n[0] * b + u[0] * l, y, c[2] + n[1] * b + u[1] * l];   // `b` metres out from the wall on this face (negative: beyond the door), `l` along it from the doorway's middle (positive: the latch's way)
    const front = at(K.jambOut, 0, 0.45), walk = (p: Vec3) => !nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked(front, [p[0], 0.45, p[2]]);
    const res = { jambless: false, marks: [] as { pos: Vec3; walk: number; seen: number }[] };
    const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = [];   // (statics alone: a leaf standing open across the floor is not the level's shape)
    try {
      res.jambless = !walk(at(K.jambOut, h + K.jambPast)) && !walk(at(K.jambOut, -h - K.jambPast));   // (stackPosts' two jamb marks)
      if (res.jambless) {
        const eyes: [number, number][] = [];   // the floor beyond the door that looks at the opening
        for (let b = 0.75; b <= 7.5; b += 0.75) for (let l = -6; l <= 6; l += 0.75) { const q = at(-b, l, 1.3); if (!nav.isBlocked(q[0], q[2]) && !g.col.segmentBlocked(q, [c[0], 1.3, c[2]])) eyes.push([b, l]); }
        for (let b = K.jambOut; b <= 3.9; b += 0.3) for (let k = 0; k < 7; k++) for (const sg of [1, -1]) { const l = sg * (h + 0.25 + k * 0.3), pos = at(b, l);
          if (!walk(pos) || g.props.props.some(pr => propGap(pr, pos) < 0.3)) continue;
          let saw = 0; for (const [eb, el] of eyes) if (Math.abs(el + (l - el) * eb / (eb + b)) < h && !g.col.segmentBlocked(at(-eb, el, 1.3), [pos[0], 1.3, pos[2]])) saw++;   // (a line that crosses the wall's plane inside this doorway, and nothing else in it)
          res.marks.push({ pos, walk: flat(front, pos), seen: eyes.length ? saw / eyes.length : 0 }); }
      }
    } finally { g.col.dynamicBoxes = leaves; }
    return both[key] = res;
  }
  private worked = new WeakMap<Door, ({ jambless: boolean; marks: { pos: Vec3; walk: number; seen: number }[] } | null)[]>();
  /** the marks teammates OUTSIDE `men` hold on this door under an order (theirs: nobody else is sent to stand on one) */
  heldOn(d: Door, men: Guard[], ignore: Guard[] = []): Vec3[] { return [...this.asg].filter(([gd, A]) => !men.includes(gd) && !ignore.includes(gd) && gd.state !== 'dead' && A.door === d && A.post !== null).map(([, A]) => A.post!); }
  /** … `n` of them for such a face, the best first by walk + ORDERS.workSeenM × seen: a body's room apart, clear of `taken` (Sam, marks teammates hold on this
   *  door) and at least `minM` from the doorway's middle (a charge's stand-off asks that); returned the nearest the door first. Null: the face has floor at a
   *  jamb, or not that many marks, or ORDERS.workOut is off. */
  workedPick(d: Door, side: 1 | -1, n: number, taken: Vec3[], minM = 0): Vec3[] | null {
    if (!ORDERS.workOut || n < 1) return null;
    const W = this.workedMarks(d, side); if (!W.jambless) return null;
    const score = (m: { walk: number; seen: number }) => m.walk + ORDERS.workSeenM * m.seen, out: Vec3[] = [];
    for (const m of [...W.marks].sort((a, b) => score(a) - score(b))) { if (out.length >= n) break;
      if (flat(m.pos, d.frameCentre) < minM || taken.some(q => flat(q, m.pos) < 0.7) || out.some(q => flat(q, m.pos) < ORDERS.fileGap - 0.1)) continue;
      out.push(v3.copy(m.pos)); }
    return out.length < n ? null : out.sort((a, b) => flat(a, d.frameCentre) - flat(b, d.frameCentre));
  }
  /** … as a stack: the first man (the nearest the door) has it to open, everybody faces it; the men to one hand of the opening are one file */
  private workedStack(d: Door, side: 1 | -1, n: number, taken: Vec3[]): StackPost[] | null {
    const marks = this.workedPick(d, side, n, taken); if (!marks) return null;
    const th = d.def.closedDir, H = d.def.hinge, w = d.def.width, c = d.frameCentre;
    return marks.map((p, i) => { const hi = (p[0] - H[0]) * Math.cos(th) + (p[2] - H[1]) * Math.sin(th) > w / 2;
      return { pos: p, face: yawTo(p, c), stackSide: ((hi ? 1 : -1) * side) as -1 | 1, lead: i === 0, group: n > 2 ? (hi ? 0 : 1) : undefined }; });
  }
  /** is this place the mark a man of the order already STANDS on, on this door (doorway.ts OWN MARK's per-place test)? */
  private stoodOn(d: Door, men: Guard[], p: Vec3): boolean {
    for (const [gd, A] of this.asg) if (men.includes(gd) && gd.state !== 'dead' && A.door === d && A.post !== null && flat(A.post, p) < 0.3 && flat(gd.char.pos, A.post) < 0.6) return true;
    return false;
  }
  /** doorway.ts FURNITURE: does a piece of furniture stand on this place, where it is now (its footprint, and a hand's breadth round it)? A carton or a
   *  chair on open floor is shoved aside by the man who walks onto his mark; one wedged in a corner is not, and he stood short of a mark he could never
   *  reach with the man behind him held a body off his own. The makers of a stack's places never dealt one onto Sam; they do not deal one onto a crate */
  onFurniture(p: Vec3): boolean {
    if (this.furIn || !DOORMANNERS.on || !DOORMANNERS.offFurniture) return false;
    for (const pr of this.g.props.props) { const dx = p[0] - pr.x, dz = p[2] - pr.z; if (Math.abs(dx) > pr.radius + FUR_M || Math.abs(dz) > pr.radius + FUR_M) continue;
      const lx = pr.cs * dx - pr.sn * dz, lz = pr.sn * dx + pr.cs * dz;   // (the place in the prop's own frame: props.ts circleContact's)
      if (Math.hypot(Math.max(0, Math.abs(lx) - pr.hx), Math.max(0, Math.abs(lz) - pr.hz)) < FUR_M) { STACK_OWN.fur++; return true; } }
    return false;
  }
  /** `k` marks BACK from a door on face `side` for men its walls have no room for (a door in a corner, taken by four): the free floor two to four metres off the
   *  frame line with a clear line to the doorway's front, to either hand of the opening and never before it (the middle is where rounds come out), a
   *  body's room clear of `taken` and of each other and of Sam; each faces the door. As many as there are (≤ k).
   *  Floor with no furniture on it first (doorway.ts FURNITURE); a place a carton stands on only when there is no other */
  rearPosts(d: Door, side: 1 | -1, k: number, taken: Vec3[]): StackPost[] {
    const g = this.g, K = ORDERS, th = d.def.closedDir, u: [number, number] = [Math.cos(th), Math.sin(th)], n: [number, number] = [-u[1] * side, u[0] * side];
    const c = d.frameCentre, front: Vec3 = [c[0] + n[0] * K.jambOut, 0.45, c[2] + n[1] * K.jambOut], sam = this.samPlace, out: StackPost[] = [];
    const h = d.def.width / 2;
    const clear = !this.furIn && DOORMANNERS.on && DOORMANNERS.offFurniture;
    for (const any of clear ? [false, true] : [true]) for (const back of [2.2, 3.1, 4.0]) for (const lat of [h + 1.3, -h - 1.3, h + 0.8, -h - 0.8, h + 1.9, -h - 1.9]) { if (out.length >= k) return out;   // (never in front of the opening: what comes out of a doorway comes out down its middle)
      const pos: Vec3 = [c[0] + n[0] * back + u[0] * lat, 0, c[2] + n[1] * back + u[1] * lat];
      if (g.col.nav.isBlocked(pos[0], pos[2]) || g.col.solidBlocked(front, [pos[0], 0.45, pos[2]]) || flat(sam, pos) < 0.7 || (!any && this.onFurniture(pos)) || [...taken, ...out.map(o => o.pos)].some(q => flat(q, pos) < 0.85)) continue;
      out.push({ pos, face: yawTo(pos, c), stackSide: 1, lead: false, group: 2 }); }
    return out;
  }
  /** THE SQUAD OF FOUR: a door order is carried out from the side of the door THE MEN IT GOES TO are on — a pair sent to a door from across the floor stacks on
   *  the face it can walk to, not on Sam's (he may be in another room, with the other pair). Each face's cost: every man's walk to the floor before it, a walk
   *  that goes through this doorway itself, or through any other door standing shut, counted as all but barred. Sam's side on a near tie, and always for the
   *  pair alone. `forMen` is the target give() acts on (a menu that greys rows for a pair should ask it too). */
  /** the last sideFor: ORDERS.knownFace changed the face the walks alone would have dealt (give() counts it) */
  private faceFlip = false;
  forMen(t: OrderTarget, men: Guard[]): OrderTarget { return t.kind === 'door' && this.big && men.length ? { ...t, side: this.sideFor(t.door, men, t.side) } : t; }
  sideFor(d: Door, men: Guard[], samSide: 1 | -1): 1 | -1 {
    const g = this.g, nav = g.col.nav, W = d.def.width, H = d.def.hinge, th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th);
    const dear = new Set<number>();   // this doorway, and every doorway whose leaf is shut
    for (const o of g.doors.list) { if (o !== d && !o.latched) continue; const h = o.def.hinge, a = o.def.closedDir, x = Math.cos(a), z = Math.sin(a);
      for (let s = 0; s <= o.def.width + 1e-6; s += 0.2) for (const n of [-0.3, 0, 0.3]) dear.add(nav.idx(Math.floor((h[0] + x * s - z * n) / nav.cell), Math.floor((h[1] + z * s + x * n) / nav.cell))); }
    const cost = (side: 1 | -1): number => {
      const f: Vec3 = [H[0] + ux * W / 2 - uz * side * 0.9, 0, H[1] + uz * W / 2 + ux * side * 0.9], to = nav.isBlocked(f[0], f[2]) ? this.freeSpot(f) : f; if (!to || sideOf(d, to) !== side) return Infinity;
      let c = 0;
      for (const gd of men) { const p = gd.char.pos, from = nav.isBlocked(p[0], p[2]) ? this.freeSpot(p) ?? p : p;
        if (flat(from, to) < 0.5) continue;
        const C = g.cleared, tr = C.roomAt(to), unk = ORDERS.cleared ? C.dearFor(from, to, ORDERS.clearedDear, C.isKnown(tr) ? [] : [tr]) : null;   // (cleared.ts: a walk through a room nobody has been in — the face's own room too — is all but barred as well)
        const path = nav.findPath(from, to, unk ? ROUND_ITER : 6000, (ix, iz) => dear.has(nav.idx(ix, iz)) ? 20 : unk ? unk(ix, iz) : 1); if (!path) { c += 200; continue; }
        if (unk) c += g.cleared.dearAlong(from, path, unk) * 10;
        let a: Vec3 = from; for (const b of path) { c += flat(a, b); for (const o of g.doors.list) if ((o === d || o.latched) && crossesDoor(a, b, o)) c += o === d ? 60 : 25; a = b; } }
      return c; };
    const mine = cost(samSide), other = cost(-samSide as 1 | -1), pick = other + 1.5 < mine ? -samSide as 1 | -1 : samSide;
    // (ORDERS.knownFace: one face on floor the team has been on, the other in a room nobody has — the stack is the known face's, whatever the walks come to)
    if (ORDERS.knownFace) { const C = g.cleared, a = C.isKnown(C.roomBy(d, samSide)), b = C.isKnown(C.roomBy(d, -samSide as 1 | -1));
      if (a !== b && C.hasFloor(d, samSide) && C.hasFloor(d, -samSide as 1 | -1)) { const face = a ? samSide : -samSide as 1 | -1;
        if (Number.isFinite(face === samSide ? mine : other)) { this.faceFlip = face !== pick; return face; } } }   // (a face with no floor at its jambs for a stack is nobody's to stand on, known or not)
    this.faceFlip = false; return pick;
  }
  /** THE SQUAD OF FOUR, left holding: which way each man of a group faces — an APPROACH each, not all the way they happened to be looking. Men standing within
   *  `4 m` of one another are one group; round its middle the open floor is measured (how far a man sees each way at eye height) and every doorway in plain
   *  view within 10 m weighed in on its bearing (the nearer the heavier: what comes through a door 2 m off is on a man before a corridor's far end is); the
   *  group's cones (a man watches ~50° to a hand) are laid on the heaviest bearings in turn, none on ground a cone before it has, and dealt so each man watches
   *  out past his own shoulder of the group — no man's line across a mate; a doorway within `holdDoorM` in a man's arc is his to put the gun on (`door`), else the gun is up along the arc as far as it runs clear (`reach`). A man
   *  alone keeps the way he faces (null). `at`: where each man will stand. */
  holdArcs(at: Vec3[]): ({ yaw: number; door: Door | null; reach: number } | null)[] {
    const g = this.g, n = at.length, out: ({ yaw: number; door: Door | null; reach: number } | null)[] = at.map(() => null), grp = at.map(() => -1), B = 36, step = 2 * Math.PI / B;
    let ng = 0; for (let i = 0; i < n; i++) { if (grp[i] >= 0) continue; const q = [i]; grp[i] = ng; while (q.length) { const a = q.pop()!; for (let j = 0; j < n; j++) if (grp[j] < 0 && flat(at[a], at[j]) < ORDERS.holdGroupM) { grp[j] = ng; q.push(j); } } ng++; }
    for (let k = 0; k < ng; k++) {
      const I = at.map((_, i) => i).filter(i => grp[i] === k); if (I.length < 2) continue;
      const c: Vec3 = [0, 1.5, 0]; for (const i of I) { c[0] += at[i][0] / I.length; c[2] += at[i][2] / I.length; }
      if (g.col.segmentBlocked([at[I[0]][0], 1.5, at[I[0]][2]], c)) { c[0] = at[I[0]][0]; c[2] = at[I[0]][2]; }   // (a wall between them: measured from the first man)
      const w = new Array<number>(B).fill(0), seen: Door[] = [];
      for (let b = 0; b < B; b++) { const hit = g.col.raycast(c, [Math.sin(b * step), 0, Math.cos(b * step)], 14), t = hit ? hit.t : 14; w[b] = t < 1.6 ? 0 : t; }
      for (const d of g.doors.list) { const fc = d.frameCentre, dist = flat(c, fc); if (dist > 10 || dist < 0.3) continue;
        const k2 = Math.max(0, 1 - 0.7 / dist); if (g.col.segmentBlocked(c, [c[0] + (fc[0] - c[0]) * k2, 1.5, c[2] + (fc[2] - c[2]) * k2])) continue;
        w[((Math.round(yawTo(c, fc) / step) % B) + B) % B] += 14 * (1 - dist / 12); seen.push(d); }
      const score = (b: number) => { let s = 0; for (let j = -5; j <= 5; j++) s += w[((b + j) % B + B) % B] * (1 - 0.06 * Math.abs(j)); return s; };
      const yaws: number[] = [];
      for (let m = 0; m < I.length; m++) { let best = 0, bs = -1; for (let b = 0; b < B; b++) { const s = score(b); if (s > bs) { bs = s; best = b; } }
        if (bs < 2 && yaws.length) { let fb = 0, fd = -1;   // (nothing left to watch: the bearing farthest from the others' — his mate's back, for two)
          for (let b = 0; b < B; b++) { const gap = Math.min(...yaws.map(y => Math.abs(wrapAngle(b * step - y)))); if (gap > fd) { fd = gap; fb = b; } }
          yaws.push(wrapAngle(fb * step)); continue; }
        yaws.push(wrapAngle(best * step)); for (let j = -6; j <= 6; j++) w[((best + j) % B + B) % B] = 0; }
      // each man the bearing that lies out past his own side of the group (every dealing tried: four men at most in a group that matters)
      const used = yaws.map(() => false), cur: number[] = []; let bestDeal: number[] = [], bd = -Infinity;
      const rec = (i: number, s: number) => { if (i === I.length) { if (s > bd) { bd = s; bestDeal = [...cur]; } return; }
        for (let j = 0; j < yaws.length; j++) { if (used[j]) continue; used[j] = true; cur[i] = j; const p = at[I[i]]; rec(i + 1, s + (p[0] - c[0]) * Math.sin(yaws[j]) + (p[2] - c[2]) * Math.cos(yaws[j])); used[j] = false; } };
      if (I.length <= 6) rec(0, 0); else bestDeal = I.map((_, i) => i);
      const mine = new Set<Door>();
      I.forEach((i, m) => { const yaw = yaws[bestDeal[m]], p = at[i]; let door: Door | null = null, dd = ORDERS.holdDoorM;
        for (const d of seen) { const dist = flat(p, d.frameCentre); if (dist < dd && !mine.has(d) && Math.abs(wrapAngle(yawTo(p, d.frameCentre) - yaw)) < 0.96) { dd = dist; door = d; } }
        if (door) mine.add(door);
        const hit = g.col.raycast([p[0], 1.5, p[2]], [Math.sin(yaw), 0, Math.cos(yaw)], 8);
        out[i] = { yaw: door ? yawTo(p, (door as Door).frameCentre) : yaw, door, reach: Math.max(1.5, (hit ? hit.t : 8) - 0.5) }; });
    }
    return out;
  }
  /** How he gets there. `why` (the word he says): no nav path at all, or a door locked against Sam on every way (the men carry no keys of their own: Sam's ring
   *  and the codes he knows are the team's). `via`: waypoints, when the plain shortest way runs through such a door but a longer one does not — he is walked
   *  round by them (the script runner's own path would take the short way, and the leaf opens to anybody in uniform). */
  route(gd: Guard, to: Vec3, shy: Door | null = null, thru: Door | null = null, whyOnly = false): { why: string | null; via: Vec3[]; how?: 'round' | 'through' | 'mouth'; lock?: { door: Door; side: 1 | -1 } } {
    const g = this.g, nav = g.col.nav, at = gd.char.pos; if (flat(at, to) < 0.5) return { why: null, via: [] };
    const from = nav.isBlocked(at[0], at[2]) ? this.freeSpot(at) ?? at : at;
    const ring = this.ring();
    const shut = (path: Vec3[]): Door | null => { let a: Vec3 = from;
      for (const b of path) { for (const d of g.doors.list) if (d.locked && d.latched && crossesDoor(a, b, d) && g.doors.lockedOut(d, a, ring)) return d; a = b; }
      return null; };
    let path = nav.findPath(from, to); if (!path) return { why: "can't get there.", via: [] };
    if (thru && ORDERS.ownDoor) { const m = this.byDoor(from, to, thru, path); if (m && !shut(m)) return { why: null, via: m, how: 'mouth' }; }   // (… never at a door locked against him: then the way an order always found)
    const through = (p: Vec3[], d: Door) => { let a: Vec3 = from; for (const b of p) { if (crossesDoor(a, b, d)) return true; a = b; } return false; };
    const own = !!shy && through(path, shy), round = own && this.big;   // (`round`, the squad of four: the short way to his mark runs through the very door he is to stack on; `own`: so it does for anybody)
    // (cleared.ts: the short way runs through a room nobody of the team has been in — `offM` metres of it)
    const C = g.cleared, unk = ORDERS.cleared ? C.dearFor(from, to, ORDERS.clearedDear) : null, offM = unk ? C.dearAlong(from, path, unk) : 0, off = offM > OFF_M;
    // (doorway.ts STAND, the lane: nor down the lane of a door standing open onto floor nobody of the team has been on, where there is a way round its edge)
    const doorsOn = (q: Vec3[]) => g.doors.list.filter(d => through(q, d));
    const len = (q: Vec3[]) => { let m = 0, a: Vec3 = from; for (const b of q) { m += flat(a, b); a = b; } return m; };
    // (`base` = the way he would be walked without this rule, found under `pen`: the way round is never through a door `base` does not take, never at a
    //  lock, never through more uncleared room than `base`, at most laneLong times as long + 1 m, and a metre of lane the less — else null: `base` it is)
    const laneWay = (base: Vec3[], pen: ((ix: number, iz: number) => number) | null): Vec3[] | null => {
      if (whyOnly || !DOORMANNERS.on || !DOORMANNERS.laneWalk) return null;   // (`whyOnly`: a menu asking whether he CAN get there — a lane never changes that, and its search is the dear one)
      const mine = doorsOn(base), lanes = doorwayLanePrice(g, d => mine.includes(d)), laneM = lanes ? C.dearAlong(from, base, lanes) : 0; if (!lanes || laneM < 1) return null;
      const way = nav.findPath(from, to, ROUND_ITER, pen ? (ix, iz) => pen(ix, iz) * lanes(ix, iz) : lanes);
      if (!way || shut(way) || doorsOn(way).some(d => !mine.includes(d)) || C.dearAlong(from, way, lanes) > laneM - 1 || len(way) > len(base) * DOORMANNERS.laneLong + 1 || (unk && C.dearAlong(from, way, unk) > Math.max(OFF_M, C.dearAlong(from, base, unk)))) return null;
      return way;
    };
    if (!shut(path) && !round && !off) { const way = laneWay(path, unk); return { why: null, via: way ? way.slice(0, -1).map(q => [q[0], 0, q[2]] as Vec3) : [] }; }
    const dear = new Set<number>();   // every doorway locked against him (and the one he is shy of), made all but a wall: is there another way?
    for (const d of g.doors.list) { if (!(round && d === shy) && (!d.locked || !d.latched || ring.has(d.lockId))) continue;
      const H = d.def.hinge, th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th);
      for (let s = 0; s <= d.def.width + 1e-6; s += 0.2) for (const n of [-0.3, 0, 0.3]) dear.add(nav.idx(Math.floor((H[0] + ux * s - uz * n) / nav.cell), Math.floor((H[1] + uz * s + ux * n) / nav.cell))); }
    const plain = path, wall = unk ? 1000 : 20;   // (with rooms priced too, a doorway locked against him stays the dearer: he is never sent at a lock to keep him out of a room)
    const pen = (ix: number, iz: number) => dear.has(nav.idx(ix, iz)) ? wall : unk ? unk(ix, iz) : 1;
    path = nav.findPath(from, to, unk ? ROUND_ITER : 6000, pen);
    if (round && (!path || through(path, shy!))) { if (!shut(plain) && (!off || !path)) return { why: null, via: [] }; }   // (no way round it: through it, as ever)
    if (!path && off && !shut(plain)) return { why: null, via: [] };   // (the search gave out: the short way, as it was)
    const still = path ? shut(path) : null;
    if (still && off && !shut(plain)) return { why: null, via: [] };   // (the way round the room runs at a lock and the short way does not: the short way — an order is never refused for a room)
    if (!path || still) { let lock: { door: Door; side: 1 | -1 } | undefined;   // (`lock`: the door that refusal is about and the face the way comes to it by — walkTry asks what the team knows of it)
      if (path && still) { let a: Vec3 = from; for (const b of path) { if (crossesDoor(a, b, still)) break; a = b; } lock = { door: still, side: sideOf(still, a) }; }
      return { why: still ? `${WORDS.on && doorWords(still) === 'door' ? 'that door' : doorWords(still)} is locked.` : "can't get there.", via: [], lock }; }
    let how: 'round' | 'through' | undefined;
    if (off) { const left = C.dearAlong(from, path, unk!);
      if (left > OFF_M) { how = 'through'; if (left > offM - OFF_M && !shut(plain) && !round) return { why: null, via: [], how }; }   // (no way round that room: the short way through it, as before)
      else how = 'round';
      // (ORDERS.roundCap: a way round far longer than the short way is not worth it, nor one still through unknown floor unless it crosses clearly less of it
      //  than the short way does — at most ROUND_LESS of the short way's: 1 m against 10 m is worth a metre more of walking, 3 m against 3.7 m is not. The short
      //  way then, as with no way round)
      if (ORDERS.roundCap > 0 && !shut(plain) && !round && !(own && ORDERS.roundOwn && !through(path, shy!)) && ((left > OFF_M && left > offM * ROUND_LESS) || len(path) > len(plain) * ORDERS.roundCap + ROUND_PLUS_M)) return { why: null, via: [], how: 'through' }; }
    path = laneWay(path, pen) ?? path;   // (the way round a room or a lock, and off the lanes on it where that costs it nothing of either)
    return { why: null, via: path.slice(0, -1).map(q => [q[0], 0, q[2]] as Vec3), how };
  }
  /** THE ORDERED DOOR (ORDERS.ownDoor): the way to a point inside for a man an entry sends in by `d` — null when the short way is the right one (he stands in
   *  that room already, or his short way crosses `d` over known floor: the man at the stack); else the corners of a walk to the door's mouth on the face
   *  away from the point — the room the point is in priced as uncleared whatever is known of it, so he does not come to its door through it — and a step
   *  inside the frame: from there his point is his own short walk. */
  private byDoor(from: Vec3, to: Vec3, d: Door, plain: Vec3[]): Vec3[] | null {
    const g = this.g, nav = g.col.nav, C = g.cleared, room = C.roomAt(to), here = C.roomAt(from);
    if (room ? here === room : sideOf(d, from) === sideOf(d, to)) return null;
    // (a man standing IN a doorway of that room — the door he was sent to hold — is in it)
    if (room && !here) for (const o of g.doors.list) if (flat(o.frameCentre, from) < o.def.width / 2 + 0.3 && Math.abs(offLine(o, from)) < 0.45 && (C.roomBy(o, 1) === room || C.roomBy(o, -1) === room)) return null;
    const crosses = (p: Vec3[]) => { let a: Vec3 = from; for (const b of p) { if (crossesDoor(a, b, d)) return true; a = b; } return false; };
    const unk = ORDERS.cleared ? C.dearFor(from, to, ORDERS.clearedDear) : null;
    if (crosses(plain) && (!unk || C.dearAlong(from, plain, unk) <= OFF_M)) return null;
    const side = sideOf(d, to), H = d.def.hinge, th = d.def.closedDir, W = d.def.width, mouth = (off: number): Vec3 => [H[0] + Math.cos(th) * W / 2 - Math.sin(th) * off, 0, H[1] + Math.sin(th) * W / 2 + Math.cos(th) * off];
    const out0 = mouth(-side * MOUTH_M), out = nav.isBlocked(out0[0], out0[2]) ? this.freeSpot(out0) : out0, inn = mouth(side * MOUTH_M); if (!out || sideOf(d, out) === side) return null;
    // (the walk to the mouth: the room the entry is FOR is dear whatever is known of it; with ORDERS.cleared, so is every room nobody has been in)
    const pen = (ORDERS.cleared ? C.dearFor(from, out, ORDERS.clearedDear, room ? [room] : []) : room ? C.dearOnly(room, ORDERS.clearedDear) : null) ?? undefined;
    const way = nav.findPath(from, out, ROUND_ITER, pen); if (!way || crosses(way)) return null;   // (no way to its mouth but out through the door itself: he is as good as inside — the short way)
    const via = way.map(q => [q[0], 0, q[2]] as Vec3); if (flat(via[via.length - 1], out) > 0.3) via.push(out);
    if (!nav.isBlocked(inn[0], inn[2])) via.push(inn);
    return via;
  }
  /** fall in (ORDERS.cleared): the corners of the way to his place in the file that keeps out of rooms nobody has been in — [] when the short way does, or
   *  there is no such way (locks are not asked about: a follower's short way is the script runner's, as ever) */
  private roundRooms(gd: Guard, to: Vec3): Vec3[] {
    const g = this.g, nav = g.col.nav, C = g.cleared, at = gd.char.pos; if (!ORDERS.cleared) return [];
    const from = nav.isBlocked(at[0], at[2]) ? this.freeSpot(at) ?? at : at, unk = C.dearFor(from, to, ORDERS.clearedDear); if (!unk) return [];
    const plain = nav.findPath(from, to); if (!plain) return []; const offM = C.dearAlong(from, plain, unk); if (offM <= OFF_M) return [];
    const path = nav.findPath(from, to, ROUND_ITER, unk); if (!path) return [];
    if (C.dearAlong(from, path, unk) > OFF_M) return [];
    if (ORDERS.roundCap > 0) { const len = (q: Vec3[]) => { let m = 0, a: Vec3 = from; for (const b of q) { m += flat(a, b); a = b; } return m; };
      if (len(path) > len(plain) * ORDERS.roundCap + ROUND_PLUS_M) return []; }   // (ORDERS.roundCap: nor a way round far longer than the short way — the short way, as with no way round)
    return path.slice(0, -1).map(q => [q[0], 0, q[2]] as Vec3);
  }
  reach(gd: Guard, to: Vec3): string | null { return this.asked(gd, to).why; }
  /** ORDERS.walkTries: the door his walk to `to` would be refused for, where nobody of the team has tried it on the face he comes to it by (doortools.ts
   *  untried: only where DOORTOOLS.testDoor is on) — null: the key is off, the walk is not refused for a lock, or the team knows that door. Sam's squad only. */
  walkTry(gd: Guard, to: Vec3): { door: Door; side: 1 | -1 } | null {
    if (!ORDERS.walkTries || this.cast) return null;
    const L = this.asked(gd, to).lock; return L && this.g.doorTools.untried(L.door, L.side) ? L : null;
  }
  /** … and for the men of a 'move' to `to` (the spot the order names: what the menu asked of each, whatever place round it he is then dealt): the ones
   *  whose way runs at such a door, each dealt a stack mark on the face he comes to it by, as 'stack up' deals them. null: none of them (the key off:
   *  always). A string: that door has no room for them, in the stack's words. */
  walkStacks(men: Guard[], to: Vec3): Map<Guard, { door: Door; side: 1 | -1; post: StackPost }> | string | null {
    if (!ORDERS.walkTries || this.cast) return null;
    let out: Map<Guard, { door: Door; side: 1 | -1; post: StackPost }> | null = null; const at: { door: Door; side: 1 | -1; men: Guard[] }[] = [];
    for (const gd of men) { const L = this.walkTry(gd, to); if (!L) continue; const k = at.find(x => x.door === L.door && x.side === L.side); if (k) k.men.push(gd); else at.push({ ...L, men: [gd] }); }
    for (const { door, side, men } of at) { const posts = this.stackPostsWait(door, side, men); if (!posts) return this.noRoomWords('no room on that door.', () => this.stackPostsWait(door, side, men));
      for (const [gd, p] of shieldDeal(this.pair(men, posts.map(x => x.pos), posts.map(x => x.group ?? 0)), posts, door, m => this.pairOf(m))) (out ??= new Map()).set(gd, { door, side, post: posts.find(x => x.pos === p)! }); }
    return out;
  }
  /** … a man of them sent: to his stack mark on that door, in the stack's carriage, still on his 'move' — and 'moving' by the HUD, on his mark too — until
   *  a hand is on the handle. `on`: the order he was given, kept for him */
  walkSend(gd: Guard, T: { door: Door; side: 1 | -1; post: StackPost }, at: Vec3, on: NonNullable<Assignment['tries']>['on']) {
    this.assign(gd, { order: 'move', post: T.post.pos, face: T.post.face, watch: [T.door.frameCentre[0], 1.05, T.door.frameCentre[2]], door: T.door, shy: T.door, stance: T.post.lead ? 'stack' : 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: T.post.stackSide, going: 'moving', there: 'moving', tries: { ...T, at: v3.copy(at), on } });
  }
  /** … and the door they came to turned out free, or stands open (doortools.ts walkTried): the walk is asked again for each of them, as the order would be
   *  asked fresh. Another door nobody has tried on the way: that door's marks, the next try. Refused (a door the team knows, no way, no room on the next
   *  door): one of them says why, as a refused order is answered, and they stop where they stand ('stopped short'). Nothing against it: his 'move', as
   *  it was given. */
  walkOn(men: Guard[]) {
    const g = this.g, all = men.filter(m => this.asg.get(m)?.tries); if (!all.length) return;
    const spot = (m: Guard) => this.asg.get(m)!.tries!.at, held = all.filter(m => flat(spot(m), spot(all[0])) < 1e-6);   // (the men of one order; another order's walkers on the same door: asked after them)
    if (held.length < all.length) this.walkOn(all.filter(m => !held.includes(m)));
    this.newGroup();   // (a group of their own from here, each order's men theirs: another order's 'set.' does not wait on them, nor theirs on it)
    const stop = (m: Guard) => { const p = m.char.pos; this.assign(m, { ...this.asg.get(m)!.tries!.on, post: [p[0], 0, p[2]], there: 'stopped short', setLine: null, fit: undefined }); };
    const at = this.asg.get(held[0])!.tries!.at, next = this.walkStacks(held, at);
    if (typeof next === 'string') { g.say(held[this.acks++ % held.length], next); held.forEach(stop); return; }
    let said = false;
    for (const m of held) { const T = this.asg.get(m)!.tries!, N = next?.get(m), why = N ? null : this.reach(m, at);
      if (N) this.walkSend(m, N, at, T.on);
      else if (why) { if (!said) g.say(m, why); said = true; stop(m); }
      else this.assign(m, T.on); }
  }
  /** what route() says of his walk there, for a menu (`whyOnly`): why not, and the lock that is about */
  private asked(gd: Guard, to: Vec3): { why: string | null; lock?: { door: Door; side: 1 | -1 } } {
    if (!ORDERS.cleared) return this.route(gd, to, null, null, true);
    // (a menu asks this of every man for every row, again each second: with rooms priced a walk is two searches — the answer for the same two cells is kept a second)
    const g = this.g, nav = g.col.nav, at = gd.char.pos, P = g.player; let locks = 0; for (const d of g.doors.list) if (d.locked && d.latched) locks++;   // (… while nothing a walk is judged by has changed: his ring, the locks, what is known)
    const key = `${gd.char.id}|${Math.floor(at[0] / nav.cell)},${Math.floor(at[2] / nav.cell)}|${Math.floor(to[0] / nav.cell)},${Math.floor(to[2] / nav.cell)}|${P.keys.size},${P.codes.size},${locks},${g.cleared.known}`, t = g.time, hit = this.reached.get(key);
    if (hit && Math.abs(t - hit.t) < 1) return hit;
    if (this.reached.size > 96) this.reached.clear();
    const R = this.route(gd, to, null, null, true), kept = { t, why: R.why, lock: R.lock }; this.reached.set(key, kept); return kept;
  }
  private reached = new Map<string, { t: number; why: string | null; lock?: { door: Door; side: 1 | -1 } }>();
  /** Has he a line to cover it from where he stands: to a door, the way to it clear at eye height; 'that way', nothing in his face for the first two metres */
  hasLine(gd: Guard, t: OrderTarget): boolean {
    const p = gd.char.pos, d = flat(p, t.at); if (d < 0.6) return true;
    const k = (t.kind === 'door' ? d - 0.6 : Math.min(d, 2)) / d;
    return !this.g.col.segmentBlocked([p[0], 1.5, p[2]], [p[0] + (t.at[0] - p[0]) * k, 1.5, p[2] + (t.at[2] - p[2]) * k]);
  }
  /** men to spots, the pairing that walks the least in all (two men: both ways tried; three or four: every way tried, and — where `groups` says which spots
   *  belong together: a jamb's file, a rank — each PAIR of the squad kept in one group before any walking is saved; otherwise each man in turn his nearest free
   *  spot) */
  pair(men: Guard[], spots: Vec3[], groups?: number[]): [Guard, Vec3][] {
    if (men.length > 2 && men.length <= 4 && spots.length >= men.length) {
      const n = men.length, used = spots.map(() => false), cur: number[] = []; let best: number[] = [], bc = Infinity;
      const ids = this.pairs().map(id => men.map((gd, i) => this.pairOf(gd) === id ? i : -1).filter(i => i >= 0)).filter(l => l.length > 1);
      const rec = (i: number, walk: number) => {
        if (i === n) { let c = walk; if (groups) for (const l of ids) c += 1000 * (new Set(l.map(m => groups[cur[m]])).size - 1); if (c < bc) { bc = c; best = [...cur]; } return; }
        for (let j = 0; j < spots.length; j++) { if (used[j]) continue; used[j] = true; cur[i] = j; rec(i + 1, walk + flat(men[i].char.pos, spots[j])); used[j] = false; }
      };
      rec(0, 0);
      if (best.length === n) return men.map((gd, i) => [gd, spots[best[i]]] as [Guard, Vec3]);   // (none found — a position that is not a number: the plain rule below)
    }
    if (men.length === 2 && spots.length === 2) { const d = (i: number, j: number) => flat(men[i].char.pos, spots[j]);
      return d(0, 0) + d(1, 1) <= d(0, 1) + d(1, 0) ? [[men[0], spots[0]], [men[1], spots[1]]] : [[men[0], spots[1]], [men[1], spots[0]]]; }
    const left = [...spots]; return men.map(gd => { let bi = 0; left.forEach((s, i) => { if (flat(gd.char.pos, s) < flat(gd.char.pos, left[bi])) bi = i; }); return [gd, left.length > 1 ? left.splice(bi, 1)[0] : left[0]] as [Guard, Vec3]; });
  }

  // ------------------------------------------------------------ the HUD
  /** what one man is doing, in a few words */
  statusOf(gd: Guard): string {
    if (gd.state === 'dead') return gd.wound ? 'wounded' : 'down';
    const A = this.asg.get(gd);
    if (A) { const w = A.post === null && pairUp('word') ? sneakWord(this.g, gd) : null;   // (pairup.ts 'word': why a following partner is not at Sam's shoulder — the sneak's own word for it)
      const word = this.shownThere(A) ? A.there : A.going;   // (a follower's is latched — followWord)
      return !gd.script && gd.state === 'alert' ? 'in contact' : w ? `${word} · ${w}` : word; }
    for (const own of [true, false]) for (const o of this.owners) { if (o.owns(gd) !== own) continue; const s = o.status?.(gd); if (s) return s; }   // (the one moving him now speaks first)
    return 'no orders';
  }
  /** who the next order goes to, as the panel names it: GOLD / RED / BLUE for a squad in pairs ('all' for the one pair), or one man's callsign (`one`) — the
   *  man the menu was opened on, else the standing `who` */
  private whoTag(): { tag: string; one: boolean } {
    const t = this.menu?.target, man = t?.kind === 'none' && t.man ? t.man : typeof this.who === 'number' ? this.squad()[this.who] : null;
    if (man) return { tag: man.callsign, one: true };
    return { tag: this.who === 'all' ? (this.paired ? 'GOLD' : 'all') : String(this.who).toUpperCase(), one: false };
  }
  /** the panel's line for T: its choices in the order it steps them, the standing one in brackets — '[GOLD] · red · blue'; with one man of a squad in pairs
   *  addressed, '[Red One] · gold' (T goes back to gold) */
  private whoStrip(): string {
    const { tag, one } = this.whoTag(), t = this.menu?.target, menuMan = t?.kind === 'none' && !!t.man;
    if (one && (this.paired || menuMan)) return `[${tag}] · ${this.paired ? 'gold' : 'all'}`;
    if (this.paired) return ['GOLD', ...this.pairs().filter(id => this.men(id).length > 0).map(id => id.toUpperCase())].map(x => x === tag ? `[${x}]` : x.toLowerCase()).join(' · ');
    return ['all', ...this.men().map(gd => gd.callsign)].map(x => x === tag ? `[${x}]` : x).join(' · ');
  }
  /** a target in the panel's words: what an order from the menu would be about */
  private hoverWords(t: OrderTarget | null): string { return !t ? '' : t.kind === 'door' ? doorWords(t.door) : t.kind === 'floor' ? (t.thing ? t.thing.name : t.wall ? 'that wall' : 'that spot') : t.kind === 'foe' ? t.foe.callsign || 'that man' : t.man ? `${t.man.callsign} alone` : 'the squad itself'; }
  /** For the interaction panel (ui/overlay.ts and the native overlay's deriveInteractions): the menu, while it is up, as the panel's rows in place of the Space
   *  rows — a line for WHO (T's choices, the standing one bracketed, in its element's colour), the orders under a header naming WHAT they are about, each with
   *  its digit (one that cannot be done here greyed with the reason), the cancel row — and, otherwise, one block under the Space rows: who the next order goes
   *  to, every man with what he is doing (the addressed ones marked when it is not all of them), what X would open on under the cursor right now, the keys.
   *  Nothing without a squad. */
  hud(): { menu: OrderHudMenu | null; status: OrderHudRow[] } {
    if (!this.active) return { menu: null, status: [] };
    const M = this.menu, key = keyName(ORDERS.key), whoKey = keyName(ORDERS.whoKey);
    if (M) {
      const kind = M.target.kind === 'door' ? 'door' : 'objective', men = M.men, tone = this.toneOf(men), n = men.length;
      const whoRow: OrderHudRow = { kind: 'objective', label: `orders to ${this.whoTag().tag}${this.paired && n > 1 ? ` · ${n} men` : ''}`, opts: [{ key: whoKey, text: this.whoStrip(), tone }], inReach: n > 0, off: false, tone };
      const mt = this.menuTarget()!, far = mt.kind === 'door' && M.target.kind === 'door' && mt.side !== M.target.side;   // (the men work the door's other face from Sam's)
      const opener = M.page !== null ? this.defs.find(d => d.opens === M.page) : undefined;   // (on a page: the row that opened it names it)
      const where = `on ${this.hoverWords(M.target)}${far ? ' · far side' : ''}`, head = opener ? `${this.labelOf(opener, mt)} · ${where}` : where, headOf = (d: OrderDef) => d.head ?? head;
      const alt = ORDERS.waitAlt ? keyName(ORDERS.waitAlt) : '', waitD = this.waitDigit(M), wordPage = this.wordPage(M);
      const carries = (d: OrderDef) => M.page !== null && M.onWord && this.wordRowOf(M.target, this.rowsFor(mt, d.opens ?? null, M.men));   // (a page behind a page: 'wait for my word', on, goes in with it)
      const hot = (d: OrderDef) => { const h = this.rowsFor(mt, d.opens ?? null, M.men).find(x => !!x.hotKey && !x.pageOnly); return h ? ` · ${keyName(h.hotKey!)}: ${this.labelOf(h, mt).split(' · ')[0]}` : ''; };   // (a page with a row on a key of its own — the word, on a held threshold's: that key works from here too)
      const words = (d: OrderDef) => d.opens ? `${this.labelOf(d, mt)} ▸${d.opens !== wordPage ? (carries(d) ? ' · on my word: ON' : hot(d)) : M.onWord ? ' · on my word: ON' : alt && !(PLANLAY.on && M.wordRow) ? ` · ${alt}: on my word` : ''}${d.opens === wordPage ? hot(d) : ''}` : (M.onWord && (PLANLAY.on ? layable(d) : d.onWord) ? 'wait · ' : '') + this.labelOf(d, mt);
      const altLive = PLANLAY.on && (M.rows.some((d, i) => d.hotKey === ORDERS.waitAlt && !M.why[i]) || this.g.doorTools.wordKeyHeld()), altDead = (d: OrderDef, i: number) => PLANLAY.on && M.wordRow && d.hotKey === ORDERS.waitAlt && !!M.why[i];   // (planlay.ts, as input() has it: the key is a row's own while that row can be given, else the 'wait for my word' row's — and is shown on one of them only)
      const rows: OrderHudRow[] = M.rows.map((d, i) => ({ kind, label: headOf(d), opts: [{ key: d.key ? String(d.key) : d.hotKey && !altDead(d, i) ? keyName(d.hotKey) : '', text: words(d) + (this.posture?.mark(d) ?? '') + (M.why[i] ? ` — ${M.why[i]}` : '') }], inReach: n > 0 && !M.why[i], off: !!M.why[i], cont: i > 0 && headOf(M.rows[i - 1]) === headOf(d) }));
      if (!rows.length) rows.push({ kind, label: head, opts: [{ key: '', text: 'no order fits' }], inReach: false, off: false });
      if (M.wordRow) rows.push({ kind, label: WORD_HEAD, opts: [{ key: waitD ? String(waitD) : !digitOf(ORDERS.waitKey) && ORDERS.waitKey ? keyName(ORDERS.waitKey) : altLive ? '' : alt, text: `wait for my word${waitD && alt && !altLive ? ` (${alt})` : ''} · ${M.onWord ? 'ON' : 'off'}` }], inReach: n > 0, off: false, cont: M.rows.length > 0 && headOf(M.rows[M.rows.length - 1]) === WORD_HEAD });
      rows.push({ kind: 'cancel', label: '', opts: [], inReach: true, off: false });
      const back = backName().toLowerCase(), closes = M.page !== null ? `${back} / right click: back · ${key.toLowerCase()} closes` : `${key.toLowerCase()} / ${back} / right click closes`;
      return { menu: { rows: [whoRow, ...rows], primary: M.sel + 1, more: 0, open: true, hint: `${ORDERS.wheelElement ? 'digit picks · wheel: who' : ORDERS.clickGives ? 'digit, or wheel + click' : `digit, or wheel + space${ORDERS.mouseOpens ? ' / middle click' : ''}`} · ${closes}`, cancel: 'close — no order' }, status: [] };
    }
    const S = this.squad(), men = this.recipients(), tone = this.toneOf(men), some = men.length < S.filter(gd => gd.state !== 'dead').length;
    const hov = this.hover(), onMan = hov?.kind === 'none' && hov.man ? hov.man : null;
    const next = onMan ? this.whoAfterT(hov) : null;   // (what T would do with the cursor on a teammate: him — or, already him, back to everyone)
    const posture = this.posture?.word() ?? null;   // (silent.ts: which of the two the squad is in, at a glance)
    const def = hov && !AUTOPILOT.on ? this.defaultFor(hov) : null, words = hov && AUTOPILOT.on ? autoHint(this.g, hov) : hov && def ? this.labelOf(def, hov) : null;   // (autopilot.ts: the squad's first choice on a door it waits on)
    const quick = hov && words ? `${words}${hov.kind === 'none' && !hov.man ? '' : ` · ${this.hoverWords(hov)}`}` : null;   // (what the quick key would give on what the cursor is on)
    return { menu: null, status: [{ kind: 'objective', label: `squad · ${posture ? `${posture} · ` : ''}orders to ${this.whoTag().tag}`, inReach: true, off: false, tone,
      opts: [...S.map(gd => ({ key: '', text: `${some ? (men.includes(gd) ? '▸ ' : '· ') : ''}${gd.callsign} · ${this.statusOf(gd)}${this.g.cover.tail(gd)}`, tone: this.paired ? this.pairOf(gd) ?? undefined : undefined, gone: gd.state === 'dead' && lostShown(), lost: gd.state === 'dead' ? lostOf(this.g, gd.char.id) ?? undefined : undefined })), ...this.notes.flatMap(f => f()).map(x => typeof x === 'string' ? { key: '', text: x } : x), ...layNote(this.g, keyName(layKey())),   // (planlay.ts: the key's line while a plan waits on it)
        ...(quick ? [{ key: keyName(ORDERS.quickKey), text: quick }] : []), { key, text: hov ? `orders · ${this.hoverWords(hov)}` : 'orders' }, { key: whoKey, text: onMan && next === S.indexOf(onMan) ? `who · ${onMan.callsign} (under the cursor)` : onMan && next === 'all' ? `who · back to ${this.paired ? 'gold' : 'all'}` : `who · ${this.whoStrip()}` }] }] };
  }
  /** Where the menu that is up is frozen, for a mark in the world (the page's overlay rings it — Sam may have walked on and be aiming elsewhere): the point, a
   *  word for it, the addressed element's colour. Null: no menu, or one opened on nothing (himself, nowhere). */
  mark(): { at: Vec3; text: string; tone?: Tone } | null {
    const M = this.menu; if (!M) return null; const t = M.target;
    if (t.kind === 'none') return t.man ? { at: [t.man.char.pos[0], 1.0, t.man.char.pos[2]], text: t.man.callsign, tone: this.toneOf(M.men) } : null;
    if (t.kind === 'foe') return { at: [t.foe.char.pos[0], 1.0, t.foe.char.pos[2]], text: `${this.whoTag().tag} → ${this.hoverWords(t)}`, tone: this.toneOf(M.men) };   // (the ring rides the man)
    return { at: [t.at[0], t.kind === 'door' ? 1.0 : 0.03, t.at[2]], text: `${this.whoTag().tag} → ${this.hoverWords(t)}`, tone: this.toneOf(M.men) };
  }
  /** one line for the console */
  summary(): string { return this.active ? `orders to ${this.whoWords()} · ${this.menu ? `menu up on ${this.hoverWords(this.menu.target)} · ` : ''}${this.squad().map(gd => `${gd.callsign}: ${this.statusOf(gd)}`).join(' · ')}` : 'no squad'; }
}

const LOW = { stance: 'lowReady' as const, upper: 'none' as const };
const AIM = { stance: 'none' as const, upper: 'aim' as const };
const LANE_ORDERS = ['cover', 'stack', 'move', 'hold'];
/** ORDERS.cleared: this much of a walk through an uncleared room is none (a corner clipped) · the search's cap when rooms are priced · ORDERS.ownDoor: how far
 *  either side of the frame line the two steps of 'through the ordered door' lie */
const OFF_M = 0.3, ROUND_ITER = 30000, MOUTH_M = 0.8;
/** ORDERS.roundCap as the page plays it (src/host/profile.ts pageSwitches; the frozen stand's TPS_ROUNDCAP=1 raises it to the same): a way round an uncleared
 *  room at most this many times the short way · … and these metres over, so that a short walk is not held to a step more (a 2 m way may go 6.2 m round).
 *  Chosen between the ways round the checks hold to (the office's corridor: 11.5 to 13.1 m for 7.2 to 7.7 m short: 14.5 m allowed) and the tape's (28 to 36 m
 *  for 8.6 to 12.8 m: 23.5 m allowed at the most; the check's fourth man, 27.1 m for 14.2 m: 25.7 m allowed) */
export const ROUND_CAP = 1.6, ROUND_PLUS_M = 3;
/** … and a way round that still crosses floor nobody has been on is worth taking only when that is at most this much of the short way's unknown floor */
export const ROUND_LESS = 0.5;
/** how far off a door's frame line a point is (signed: sideOf's sign) */
const offLine = (d: Door, p: Vec3) => Math.cos(d.def.closedDir) * (p[2] - d.def.hinge[1]) - Math.sin(d.def.closedDir) * (p[0] - d.def.hinge[0]);
/** which face of the door's FRAME a point is on (+1 = the CCW side of the closed leaf — doors.ts Doors.side's convention, taken with the leaf shut) */
export function sideOf(d: Door, p: Vec3): 1 | -1 { const th = d.def.closedDir; return Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0]) >= 0 ? 1 : -1; }
/** a door's name as the squad says it: the words of its id ('server_manager' → 'server manager door'), a compass letter said as its word ('breakroom_w' →
 *  'break room west door'); every other token is kept as it stands ('n4a' → 'n4a door'). words.ts off: the id as it stands ('breakroom w door'). */
export function doorWords(d: Door): string { return (WORDS.on ? doorSaidName(d) : undefined) ?? doorIdWords(d.def.name); }   // (doornames.ts: a shorthand id — 'm_w', 'n4a' — is said as the rooms the door joins, 'hall-side mess door')
export function doorIdWords(id: string): string {
  if (!WORDS.on) return `${id.replace(/_/g, ' ')} door`;
  // (the dialogue pass: a level file's compass letters are said as words and nothing is said twice — but no token is DROPPED: two doors of one room must still read as two)
  const t = id.split('_').map(x => DOOR_SAID[x] ?? x); if (t[t.length - 1] !== 'door') t.push('door');
  return t.join(' ');
}
const DOOR_SAID: Record<string, string> = { n: 'north', s: 'south', e: 'east', w: 'west', ne: 'north-east', nw: 'north-west', se: 'south-east', sw: 'south-west', ext: 'outside', breakroom: 'break room', mgr: "manager's" };
