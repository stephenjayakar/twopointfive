// DOOR TOOLS (Game.doorTools, __doortools): a page of door rows on the squad's command menu (orders.ts — X or the middle button) when it is opened on a
// door: row 5 of the door's menu, 'door tools ▸', turns the menu to them, on 1 to 4 (no row of any menu is on a digit above 5 — orders.ts ORDER_DIGITS).
// Rows 1 to 3 are the ONE-PRESS ENTRIES; row 4 turns to a page of its own, the room WORKED FROM OUTSIDE first (X, 5, 4, then 1 to 3).
//
//   1  open and clear          the men stack on the door, the lead opens it (the boot when it is locked against the team) and they go in
//   2  bang and clear          the same, with a stun canister in first: only the man who opens is at the frame, the rest file up behind him along
//                              his wall and the man behind him throws it (`secondThrows`); the can is cooked — it goes off in the air, chest high, `airIn` inside the frame line, over the furniture that would
//                              shadow one lying on the floor; nobody crosses the threshold until it has gone off AND the defenders' blind burst through the
//                              doorway has run dry (or `entryCap` seconds are up). The men it blinds stay dazed a beat after their sight is back
//                              (roomfight.ts FIGHT_SKILL.hostile.daze): that beat is what the entry is timed into
//   3  breach with a charge    one man sets a charge by the lock, the squad stands off along the wall, and NOTHING happens until Sam's own trigger (F, or the
//                              same row — it reads 'blow the charge' while one is set on that door): the leaf goes in off a broken keep, the men near its far
//                              side are knocked down or flash-blind, and the squad goes in behind it
//   4  work it from the threshold ▸   a page (THR_PAGE) of three — the room worked from Sam's side of the frame line before anybody is in it:
//        1  hold the door until I say     WORK THE ROOM FROM THE THRESHOLD and HOLD the jambs until told what next (order id 'thresholdHold' — below)
//        2  step in once it goes quiet    the same, and they step in by themselves once the door has been quiet (order id 'threshold')
//        3  clear from outside            (order id 'outside'; it was row 4 of the tools) the door is opened and the men work the opening from Sam's side of
//                              the frame line — ONE arc from the opener's jamb out, round the front of the door and in to the far wall, a station at a time,
//                              the muzzle (and the light on it) across what each station shows of the room; the lead walks all of it, the man behind him
//                              stops two stations short — and they STAY outside until an entry order sends them in
//   5  wait for my word        the squad of four only, on the tools and on the threshold's page: a row that flips (F flips it too, with a door menu up) — a
//                              tool given with it ON stacks and waits
// WHILE A THRESHOLD IS HELD ON THE DOOR by men the menu's orders go to (thresholdHeld: the jambs manned, nobody in — either order of it), row 5 of the door's
// own menu is 'threshold held ▸' in place of 'door tools ▸' (orders.ts OrderDef.standsIn) and turns to WHAT NEXT (HELD_PAGE): 1 step in · 2 bang, then step in ·
// 3 leave it — digits 1 and 2 are the plain way in and the way in behind a bang, as on the tools — and the word's own row, on its key (F: the blind pockets
// banged, then the step in). F is that word with no menu up too, and — the pair — with any menu up.
//
// WORK THE ROOM FROM THE THRESHOLD (kind 'threshold'; `threshold(men, target, onWord)` / `thresholdHold(men, target, onWord)` + `canThreshold(target, men)`
// are the two rows' issue / valid, `thresholdOn(doorName, who?, side?, hold?)` gives it from the console or a probe, `order('threshold', …)` from a
// scenario; a room being held takes `thresholdThen('step' | 'bang' | 'leave', men, target?)` — `canThresholdThen` its valid, `thresholdTell(what, doorName?,
// who?)` the console's):
// the men stack a man on each jamb, the door is opened, and NOBODY goes in — the two jamb men hold their diagonals across the room, still, and shoot who comes
// to the noise, everybody else keeps the squad's back; when it has been quiet the floor no lit muzzle has been across — the blind pockets — is banged (cans off
// the same count, not thrown by the first man in); behind the last burst they STEP IN SHALLOW, and from there it is the entry every other tool ends in.
// TWO WAYS OF IT, both orders: the plain one goes on by itself once the door has been quiet; given to HOLD, the jambs are held — whoever comes to the door
// still shot — until Sam says what next: step in, bang the pockets and step in (the word — F — is that one), or leave the door.
// Never automatic; with it not ordered nothing of it runs (the DOORTOOLS.thr* knobs say what was measured and what is a guess).
//
// CHARGES AND BANGS ARE COUNTED per run (a staging of the squad): DOORTOOLS.charges / .bangs, shown on the rows and on the squad's HUD block; a row with none
// left is greyed. The night breach's F drill takes its stun canister from the same count. Sam's own canisters (slot 4) are his own, as ever.
//
// What this module does and does not own. It moves men ONLY through orders.ts (SquadOrders.assign: one assignment per stage — a man re-ordered by anything else
// is no longer this module's, found by his assignment no longer being the one it handed him), and it never fires a round: who a man shoots at, from the stack,
// from a slice station or inside the room, is the room fight's (roomfight.ts, through GuardScript.over). It never touches a defender's hold / pinned / facing.
// The door is opened with the game's own verbs (doors.ts kickIn; the keyed shove squad.ts RoomClear uses), the stun canister is a real item detonated by
// combat.ts detonateStun (the men of the entry kept off its list, heads turned, as the breach drill does), the charge's effect on men is the same dazzle that
// rule applies plus a knock-down ('struck': out cold) inside `knockM`. Stack marks are orders.ts stackPosts (geometry: every door, either face) — the F drill
// keeps its authored marks on the one door it knows. Every stage is capped: a man who never arrives does not hang the order.
//
// ORDERS FROM A SCENARIO (the hostage rescue's F — rescue.ts). `order(kind, men, door, side, gate)` gives one of the entry orders for Sam without the menu
// (nothing in the order log, nothing said for Sam); `together()` makes a GATE that two or more of them share: nobody opens his door until every order on the
// gate is stacked (and, made with `go` false, until somebody raises it); a door that only needs a shove waits for a boot elsewhere on the gate and opens on the
// frame it lands (two boots on one gate each start their walk-up when the gate opens and land on their own count); an open and clear beside a bang and clear (no can for that door) goes in when the men behind
// the can do, not ahead of the flash; the men of one order are not blinded by another's can; while it stands stacked a gated order waits on a man the fight
// has on his way, and a lead lost there is replaced on the frame before anything opens. `order()` asks what the menu asks (floor at a jamb, a way there for
// each man, not steel and locked). `linked`: doors whose set charges blow on ONE trigger. `lights`: a scenario's own weapon-light switch for men going in. Where a door's jambs have no floor, the stack and the stand-off take the marks a scenario registered for that face (orders.ts
// doorMarks — a fallback: never read where the geometry has an answer). With no gate, no link and no marks this module runs exactly as it did.
//
// With no operative on the floor nothing here runs (tick: a pass over the guard list and a return; the rows are orders.ts's, inert with it).
// (src/game is one import cycle: nothing below is built from another game module's exports at module load.)
import { SideMap, SideSet } from '../math/side';
import { HOLDFIRE, holdFireOrder, holdFireOnMan } from './holdfire';   // (called / read inside blow / goMen / testStacks only)
import { FRAG, exposedTo, fragRunning } from './frag';
import { moraleBlast } from './morale';
import { Vec3, v3, clamp, lerp, wrapAngle } from '../math/vec';
import type { Game, Guard, Interactable, Verb } from './game';
import type { Input } from './input';
import type { Door } from './doors';
import { DOORWAY } from './doors';
import type { Item } from './throwables';
import { GRAVITY } from './throwables';
import type { Assignment, OrderDef, OrderTarget, OrderNote, StackPost, Who } from './orders';
import { sideOf, doorWords, WORD_HEAD, OWN_EPS } from './orders';
import { CMDRING } from './cmdring';
import { BoxFlag, makeBox } from '../scene/boxes';
import { KICK_IMPACT, TOSS_QUICK } from './character';
import { killGuard, detonateStun, fireWeapon } from './combat';
import { tearOff, DOORBLAST } from './doorblast';
import { toolSpot, toolStep } from './handleside';
import { SHOTGUN, breachSpot, carriesBreacher } from './shotgun';
import { WEAPONS } from './weapons';
import { BIGSLOT, kitBig } from './kit';   // (the big slot's switch and what a staged teammate carries in it: asked inside the lock stage only)
import { carriesHammer, gunUp, gunDown, hammerBlow, bigBroken, hammerOut, hammerIn, hammerOutTick, bigWind, bigSwing, bigOutBy } from './bigkit';
import { SILENT, squadSilent, silentUrgent, silentNoBoot, silentPick, silentBoot, silentCompromised, silentEase, silentNoCans, silentTool, SILENT_STATS } from './silent';
import { doorPlan } from './roomclear';
import { NIGHTBREACH } from './nightbreach';
import { PLAYER_ID } from './consts';
import { chargeHands } from './handwork';
import { samStowing, mateStow, mateStowLead, stowFight } from './workstow';   // (called inside samTick and the 'place' stage only)
import { COVER } from './cover';
import { NVG, nvgDown, nvgWorn, nvgBlack, nvgPlaceLight, tubeVis } from './nvg';
import { irShowsAt } from './irlight';
import { ENTRY } from './entrypoints';
import { DOORPATH } from './doorpath';
import { colleagueInLine, lightEstimateAt, LIGHTS } from './guards';
import type { RoomClearPlan } from '../scene/level';
import { FloorSeen } from './floorseen';
import { DOORMANNERS, DOORMANNERS_STATS, doorwayInWay, doorwayClearNear, doorwayLane } from './doorway';
import { GLASSPEN } from './glasspen';   // (DOORWAY.kickGlass: read in bootSpot, at order time only)
import { WORDS, wg } from './words';   // (a leaf: the dialogue pass's one switch)
import { roomCall } from './squadnet';   // (called inside the entry's end only)
import { STACKROOM, stackRoomFix, stackRoomHas, stackRoomKeeps, stackViewReach, stackViewOpen } from './stackroom';
import { SAMSTUN, dazzlePlayer } from './samstun';
import { rearHolds, rearLast, rearWatcher } from './rearwatch';
import { gunFirst, gunTurn, gunBefore } from './gunroles';   // (called inside firstIn / enter only)
import { OWNCHARGE } from './owncharge';   // (a leaf: the player's own charges' one switch)
import { OWNBLOW, SAM_BY, blowKeyWord, blowTail } from './ownblow';   // (called inside rows, notes and the key's press only: his own charge is his own actions' to set off — ownblow.ts)
import { PICTURE, PICTURE_STATS, anyIdea, safestSets } from './picture';

/** `WORDCUTS_BREAK=1` (a check's own word): the rule's body left out, everything else as it is */
const WORDCUTS_BREAK = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.WORDCUTS_BREAK === '1';

export const DOORTOOLS = {
  /** per run: door charges, and the squad's stun canisters (the F drill's included) */
  charges: 2, bangs: 3,
  /** the trigger: Sam's key for a set charge (the night breach's F — a set charge has it first) */
  blowKey: 'KeyF',
  /** the squad of four: that same key is THE WORD while anything of the men the orders go to is waiting on it (a pair stacked, a tool given 'on the word', a
   *  charge set) — one press, no menu. False: the word is the menu's 'go' row alone and the key is the trigger / the drill's as before */
  wordOnKey: true,
  /** … and for this long after a word given on the key, the key does nothing else: a second tap is not the breach drill's 'stack up' */
  wordTap: 0.6,
  /** THE THRESHOLD'S MENU — the calls taken on it while the maintainer was away (rebuild/away-build/calls.md), each with the other side one switch off:
   *  `thrHoldFirst`: on the threshold's page 'hold the door until I say' is key 1 and 'step in once it goes quiet' key 2 (false = the two trade keys).
   *  `thrBangFirst`: on a HELD threshold's page 'bang, then step in' is key 1 and the plain step in — worded 'step in · no bang' — key 2 (false = as it was:
   *  1 'step in', 2 'bang, then step in'. Told to step in with no can at every held door the team kept 157 of 432 men where behind a bang it kept 208).
   *  `thrOutsideRow`: 'clear from outside' keeps its row, the last of the threshold's page (false = not on the menu; doorTools.order('outside') still gives it).
   *  `thrLeaveFallIn`: 'leave it' brings the men back to Sam, as 'fall in' does (false = as built: they stay stacked on that door).
   *  `thrHandsOff`: 'step in once it goes quiet' is hands off once given — the door's menu keeps its tools row and offers no what-next for it (false = as built:
   *  the same step in / bang / leave rows while it is on the jambs). The word's key sends it either way.
   *  `thrHeldAll`: row 5 turns to 'threshold held' only when EVERY man the menu's orders go to holds that door (false = as built: any of them does).
   *  `thrMenuWord`: the pair's key is a held threshold's word with ANY menu up (as built; false = with a menu up that is not the held door's own the key is
   *  not the word: it goes on to whatever else it is there — a set charge, the scenario's own drill, which may well take the men off the door).
   *  (thrHandsOff / thrHeldAll take the 'F: go' wording off that door's menu with the page: the word's key then sends it with NO menu up.) */
  thrHoldFirst: true, thrBangFirst: true, thrOutsideRow: true, thrLeaveFallIn: false, thrHandsOff: false, thrHeldAll: false, thrMenuWord: true,
  /** caps (s): walking to the marks (given up sooner once nobody short of his has moved for `stillSecs`) · onto the kick spot · the whole entry */
  stackCap: 60, stillSecs: 2.5, kickCap: 5, inCap: 9,
  /** the keyed shove: leaf velocity (rad/s) — and how long a door this module opened is kept from its closer */
  shove: 5.5, holdOpen: 10,
  /** the stun canister: released this long after the leaf starts to move, thrown for a spot this far inside the frame line, and going off IN THE AIR once it
   *  is `airIn` inside and has dropped to `airH` — else this long after it lands, or `tossCap` after it left the hand */
  tossAfterOpen: 0.15, bangIn: 2.4, fuseAfterLand: 0.35, airIn: 1.6, airH: 1.2, tossCap: 1.6,
  /** a door that had to be BOOTED: the can is the second man's, cooked in his fist while the lead kicks, and leaves it this long after the leaf goes in (the
   *  breach drill's own toss) — the kicker is square in the opening until it goes off, so every tenth counts (it was the kicker's own throw, 0.3 s after) */
  tossAfterKick: 0.05,
  /** the can is the SECOND man's on every door, not only a booted one: the man nearest the frame behind the first man (within `throwReach` of it) throws it
   *  past him, the first man's gun stays on the opening and he is first through with it ready (false = the man who opened the door threw it, then went first). `tossTurn`: seconds a thrower who was rear
   *  security until the shove may take to come round to the door before he throws — 0, he throws as he turns: at 0.35 the door stood open with no can in
   *  the air that much longer, and the pair holding the next room lost four of twelve where it loses none (pairs-hold) */
  secondThrows: true, throwReach: 4, tossTurn: 0,
  /** FRAG AND CLEAR — THE LEAF IS LOOKED AT BEFORE THE GRENADE LEAVES THE HAND (`fragWay`, on; off = thrown `tossAfterOpen` after the shove whatever the leaf did,
   *  as it was). The shove does not always open a door: a defender walking up behind the leaf, or furniture against it, stops it in the first tenth of a second
   *  (and the man then pushes it back out at the stack). A grenade thrown at a leaf comes back off it and lies a metre and a half outside the door, among the
   *  stack, on a 2.4 s fuse (the warehouse's `off` door: two or three of the squad killed at one instant, seeds 6 24 53 73 frag-first). So the thrower throws
   *  only with the leaf WELL ROUND AND STILL GOING, away from the team (≥ `fragWayAjar` rad and really turning that way, by its angle from one look to the next —
   *  not `Door.vel`, which a booted leaf pinned on a man keeps for 0.6 s: past ~0.5 rad a grenade that meets the leaf is turned on INTO the room, with the 0.3
   *  restitution it has, so a leaf that stops the frame after the throw no longer sends it back), or STANDING OPEN (≥ `fragWayOpen` rad either way: clear of
   *  his hand's line and of the landing's own floor scan). An unstopped shove is at ~0.72 rad turning ~3.9 rad/s at the throw: the throw as it always was,
   *  frame for frame; a boot's throw waits a frame or two for the angle. A leaf AT REST part open is refused on purpose (the grenade would drop in the doorway).
   *  Speed alone is no reason to throw, at any small angle: a booted leaf stopped at 0.37 rad on the throw's own frame, or one resting on a man that lurches
   *  when the boot's 0.6 s run out, read as 'flying open' and the grenade came back (the review's sweep of where the man stands, 0.5 to 0.62 m behind the frame).
   *  Else he waits up to `fragWayWait` s for it, then the grenade goes back on his belt and they go in without it (the rule a mate behind the door already had).
   *  Nothing of the blast, the aim or the fuse changes: a grenade that does come back still kills whoever it reaches. */
  fragWay: true, fragWayWait: 1.0, fragWayOpen: 1.15, fragWayAjar: 0.6,
  /** the same look at the leaf for a STUN canister on a bang and clear (never a threshold's cans): off = thrown on the shove whatever the leaf did, as it was.
   *  The can off a stopped leaf hurts nobody of the entry (they are off its list) but it goes off on their side of the door and the room behind is not flashed.
   *  ON since 10-11: a door the squad PULLS open swings toward the stack, and a can thrown `tossAfterOpen` after it starts to move met the leaf every time and
   *  burst outside (the maintainer: "the squad does waste a lot of bangs"). Toward the team the leaf is never 'well round and still going', so the can waits
   *  for it to STAND OPEN (`fragWayOpen`): a pulled leaf is there about 0.15 s later. A SHOVED leaf's throw is the throw as it was, frame for frame; behind a BOOT
   *  (`tossAfterKick`) the can leaves a tick or two later, once the flung leaf is past `fragWayAjar`. Beats: 'can waits: …' / 'can held' ('bang · …' is the burst) */
  bangWay: true,
  /** a bang / frag order on a door that STANDS OPEN walks nobody across the front of the opening (the maintainer's replay, 10-12: "after being ordered to
   *  frag after externally clearing, blue one crosses across a dangerous threshold" — both men held the open door from either jamb, the new order filed the
   *  second man behind the lead on the lead's wall, and he walked 3.4 m through the doorway's own view to get there). With the leaf standing open
   *  (stackroom.ts `stackViewOpen`) nobody has a handle to work, so: the lead is a man whose jamb is on the hand of the opening he already stands on, where
   *  there is one (else the latch jamb's, as ever), and a man whose place is on the OTHER hand from where he stands takes his own hand's wall instead — a
   *  place back from that jamb, flat to the wall (the next places back, then the jamb itself, where that has no floor); no place there = the place as dealt,
   *  never a refusal. A man in front of the opening, far from the door or on its other face is on no hand and is dealt as ever. The can is thrown by the
   *  second man from his own end of the opening, and they go in from both jambs. Shut doors, 'open and clear' and the threshold are untouched.
   *  false = the deal as it was */
  openHand: true,
  /** SEVERAL DOORS ON ONE SIGNAL, one of them booted, another only wanting a hand: the hand door's lead used to wait on his jamb for the boot beside him to
   *  land and only THEN step to its handle (handleside.ts toolSpot — the page, where a leaf is worked from its handle), so its leaf, can and men were that walk
   *  behind the boot's (1.8 s on the office's hostage room). On, he steps to the handle as the signal is given and has his hand on it while the boot beside
   *  him goes in, and the boot is not swung before he has (`kickCap` at most): the shove is on the boot's frame. Nothing to it where no lead has a handle to
   *  step to (the frozen stand).
   *  false = the step after the boot, as it was */
  gateHand: true,
  /** three or more left holding a room: the LAST man through keeps his gun on the door they came in by (the footage's fourth man takes the corner by the door
   *  and turns to face back out) — the rest keep the sectors their points gave them (false = every sector into the room, as it was) */
  lastOut: true, lastOutM: 3,
  /** entry behind a bang / a charge: not before `afterBang`, then once no defender has fired for `quiet` seconds (the blind burst run dry) — at `entryCap` whatever */
  afterBang: 0.6, quiet: 0.15, entryCap: 2.8,
  /** the second man starts this long after the first · on his point of domination each man's muzzle goes `sweepRad` to one hand, to the other, then onto his
   *  sector, `sweepSecs` each */
  second: 0.25, sweepRad: 0.9, sweepSecs: 0.6,
  /** CHECK THE CORNERS (the maintainer, 10-05: 'teammates clearing rooms seem to miss enemies. they need to check their corners'): from the moment a man is
   *  through the frame his muzzle is on the NEAR corner of his own side of the door, then on that side's DEEP corner — each until it has been within
   *  `cornerRad` of it for `cornerSecs` (given up `cornerCap` after he crossed) — and only then his point's sweep. False: muzzle wherever he walks, as it was */
  corners: true, cornerSecs: 0.3, cornerRad: 0.3, cornerCap: 1.6,
  /** … AND A SHOT DOES NOT COST HIM HIS CORNER (the footage, Ready or Not 7:45: the first two men 'are allowed to take a shot at that threat and then immediately
   *  collapse their corner'). `cornerOwed`: the seconds the room fight has his muzzle on a man are not seconds his corner had — `cornerCap`'s clock stands still
   *  for them (false = as it was: the cap ran from the moment he crossed, whatever his gun was doing, and a man who met somebody in the middle of the room
   *  walked on to his point with both corners of his side given up unlooked-at; the search got to them later, in whatever order needed the least turn).
   *  `collapse`: the man he was on DOWN and a corner still owed, his muzzle leaves the spot at once for the corner (false = as it was: the half second any
   *  teammate's gun rests where his man was). Only with a MATE THROUGH THE FRAME behind him — the middle of the room is that man's; alone inside he keeps the
   *  half second (where one stood the next often is: measured, a pair's first man who looked away at once lost both of them a room). A man he merely lost sight
   *  of keeps that half second either way: he is not dealt with.
   *  `cornerTurn`: stood on his point with the owed corner more than 1.3 rad round from his chest (he fought his way past it; his muzzle goes 1.5 rad round his
   *  chest and no further), he turns his body to it (false = as it was: squared to his point's facing, the muzzle against its stop until the cap ran out) */
  cornerOwed: true, collapse: true, cornerTurn: true,
  /** WHO GOES IN FIRST: the man who has already seen most of the room (the footage, Door Kickers: 'i'm going to lead with this man because he's already seen
   *  most of the room he knows what it looks like and where the threats are at'). Of the men AT the frame — the front man of the file on each jamb — the one
   *  whose own eyes have been over the most of the room's floor in the last `leadSeenSecs` (floorseen.ts: within `leadSeenM` of him, in his eye's wedge, with a
   *  line) is first through, when that is `leadSeenMin` cells (quarter square metres) more than the lead has seen; the lead follows off his own jamb. Behind
   *  a bang the can is then thrown by somebody who is not him — the lead himself, when they are two — and never is the man who threw it first through while
   *  there is another at the frame. A shut door nobody has looked through is the lead's, as ever: the man on the latch jamb, who opened it.
   *  false = as it was: the lead first whatever anybody had seen (who the lead is: the man the nearest mark put on the latch jamb) */
  leadSeen: true, leadSeenMin: 12, leadSeenSecs: 30, leadSeenM: 11,
  /** a man left holding a room swings his sector off a teammate who stands in it (off = as it was: every man on the sector his point gave him, and the gun of
   *  any man whose sector ran through a mate at the low ready for as long as they held — in one room three of the four) */
  sectors: true, sectorSecs: 0.6,
  /** … then SEARCH THE ROOM: the room's floor (the room fight's own model of it) is LOOKED OVER — a cell counts once it has been inside `lookRad` of a
   *  man's muzzle, within `lookM` of him, with a line to it — each man's muzzle travelling at `scanRate` rad/s to the floor nobody has looked at yet that
   *  needs the least turn. Floor no man can see from where he stands (`deadCells` of it or more) sends the nearest man on to where it can be seen, up to
   *  `searchMoves` times. The entry is over when the floor is looked over (or `searchCap` s after 'going in'); rooms past `searchCells` cells are open
   *  floor and get the fixed sweep alone. False: the two looks of the sweep, then every man frozen on his sector — as it was */
  search: true, scanRate: 1.4, lookRad: 0.3, lookM: 11, deadCells: 8, searchMoves: 3, searchCap: 24, searchCells: 900,
  /** this module's stacks stand this much further past the jamb than orders.ts's (a man 0.45 m past the latch is in the line of a round fired from deep in
   *  the room at an angle through the opening) · behind the bang the first man closes up to `edgeOut` past the opening's edge · behind a bang, or working a
   *  door from outside, the men who do not open it file up `bangFile` apart behind the man who does */
  tuck: 0.4, edgeOut: 0.4, bangFile: 1.1,
  /** the charge: seconds at the door to set it · how far along the wall from the jamb the squad stands off (first that has floor) */
  setSecs: 2.0, standoff: [2.6, 2.0, 1.5],
  /** … and what it does: far-side men within `knockM` of the doorway's middle go down (out cold); within `stunM` with no wall between they are flash-blind for
   *  stunSecs[0] (at the door) down to stunSecs[1] (at stunM) AND doubled over for `staggerSecs` (Guard.staggerUntil: rooted, gun down, no round — so no blind
   *  burst comes back through the doorway, which is the charge's edge over a canister); a teammate (or anybody) on the NEAR side within `backblastM` of it is
   *  dazzled `backblastSecs`; the leaf leaves at `blowVel` rad/s */
  knockM: 2.0, stunM: 8, stunSecs: [6.0, 2.5], staggerSecs: 2.0, backblastM: 1.6, backblastSecs: 1.5, blowVel: 12,
  /** clear from outside: × the arc's distances off the frame line · how long the muzzle rests on each of a station's angles with nobody in his sight · how far
   *  inside the jamb's edge the sight lines are taken · how deep into the room the points he aims at lie */
  sliceBack: 1, sliceLook: 0.35, sliceEdge: 0.12, sliceDeep: 3.5,
  /** a slicing man's step from one station to the next, m/s — the footage's men take an angle at under a metre a second (0 = the pace of any other short leg, as it was) */
  slicePace: 0.9,
  /** THE WORD (go()): the orders it releases wait this long for each other at the two moments they share — before anybody makes a sound (a pair still walking
   *  onto its door), and before anybody crosses a threshold (a bang still in the air at the other door) — then go without the one that is late */
  wordStack: 20, wordIn: 6,
  /** the squad of four: a pair stacked on a door the OTHER pair is sent to work steps back to the first of these (metres along the wall past a jamb) that has
   *  floor · two points of domination dealt to men of different orders are this far apart, or the later one takes another */
  roomBack: [2.8, 3.7, 4.6, 5.5], podApart: 1.2,
  /** WORK THE ROOM FROM THE THRESHOLD (kind 'threshold' — threshold() / thresholdHold() / thresholdOn(); the menu's THR_PAGE). A man on each jamb, the door opened, and
   *  nobody goes in. Each jamb man steps onto his own jamb's diagonal — `thrStill`: [metres past his jamb, metres off the frame line] — his muzzle down the middle
   *  of what it shows of the room, and holds it, STILL: between them the two lines cross inside, and whoever shows himself in them is the room fight's.
   *  `thrLight`: how many of the two burn a weapon light while they hold (1: the far-jamb man lights the door and the opener beside him stays dark — a lit lens
   *  is seen from anywhere in its cone, roomfight.ts lampGlare; 2: both; 0: neither, a door's own discipline — a light still comes on for a man found). The hold
   *  is over once nobody at the door has had a man in his sight, nor a defender fired within `thrShotM` of it, for `thrQuiet` s (not under `thrMin`, not past
   *  `thrCap`) — or on Sam's word (go(); its key), any time. Given to HOLD (thresholdHold) it is not over then: the lead says the door is quiet and the jambs
   *  are kept, whoever comes to the door still shot, until Sam says what next (thresholdThen: step in · bang and step in · leave it; the word = bang and step in).
   *  Then THE BLIND POCKETS — the room's floor no lit muzzle has been across from out there — are banged: `thrBangs` cans at most, while the kit has
   *  them, each thrown (not by the first man in while there is another) to go off in the air where it has a line to the most unseen floor — `thrPocket` cells
   *  of it or more, within `thrFlashM` of the burst, the burst no more than `thrThrowM` from the hand — the first `thrTurn` after the hold ends (the thrower
   *  comes round from the rear), the next not within `thrNext` of the last. `thrCover`: both jamb men stand in behind their jambs' edges for the bangs (the
   *  blind burst comes back through the opening; false = the far-jamb man keeps his diagonal through them). Behind the last burst, on a bang's own count, they
   *  STEP IN SHALLOW — the jamb men to the first free floor to either hand just inside the entry wall, the rest behind them and none past 2.5 m (`thrIn`: how
   *  many of the order step in at most; the others keep the squad's back, outside) — and from there it is an entry like any other: corners, the room looked
   *  over (what was seen from outside is not looked at twice), the sectors held.
   *  `thrSlice` (SHIPS OFF): the opener, instead of holding his diagonal, SLICES his side of the opening at `slicePace`, a station of `thrArc` at a time ([metres
   *  from his jamb's edge of the opening — negative: back along his wall —, metres off the frame line]), the muzzle across what each shows. Over the scripted
   *  play-throughs (five room-clearing scenarios × eight seeds, every held room worked this way, the plain order) it left 38 to 47 of 112 teammates standing
   *  where both men holding still left 49 to 65: a man walking a lit muzzle round a doorway is seen by every man in its cone before he has lit one of them.
   *  (The same forty runs with every room banged and cleared instead: 81. Run to run the same settings move by ten or so; nothing here is tuned past that.)
   *  The hold's length, one light or two and one can or two are guesses those runs could not sharpen (thrMin 2 s: 39; 4 s: 64; 6 s: 44; 9 s: 52 · as shipped
   *  49, both jamb men lit 50 to 54, both lit and one can a room 59 to 62 — the scatter is as wide as the trends) */
  /** A DOOR WORKED FROM THE FACE IT OPENS TOWARD (`thrPull`, on; false = as it was; nothing on the old two-way doors): its leaf comes round onto the
   *  team's own side and stands out from the hinge jamb — right across that jamb's diagonal, so the man holding it had his gun on the back of the door and was
   *  no part of the hold. He takes `thrPullAt` instead — [metres in from the hinge jamb, metres off the frame line]: past the leaf's free end, in front of
   *  the hinge half of the opening, his line still crossing the latch-jamb man's inside — and 'clear from outside' skips its stations beyond that jamb. */
  thrPull: true, thrPullAt: [0.45, 1.8],
  thrStill: [0.45, 1.2], thrArc: [[-0.45, 1.2], [0.25, 1.8]], thrMin: 4, thrQuiet: 2, thrCap: 25, thrBangs: 2, thrPocket: 12, thrShotM: 8, thrThrowM: 5, thrFlashM: 7, thrTurn: 0.5, thrNext: 0.3, thrCover: true, thrSlice: false, thrLight: 1, thrIn: 4,
  /** THE JAMB MEN SLICE THE DOORWAY BEFORE THEY CALL IT HELD (`thrPie`, on in the page; false = as it was: a diagonal each, held still — the maintainer, 10-18, of
   *  a pair that said 'holding on the door' with a defender stood square in front of it, in the wedge neither diagonal shows: "when externally clearing, men
   *  should try to pie from the outside as much as they can before considering their job done"). Each jamb man — both at once, each on his own side of the
   *  door's middle — takes his own mark's thin slice, his diagonal, and then the cuts of `thrPieArc` ([metres in from his own jamb's edge of the opening,
   *  metres off the frame line]: every one a few degrees more of the room past his own jamb), the muzzle on the ground each opens and then the middle of what
   *  it shows, at `slicePace`, resting `sliceLook` on each; a man in his sight keeps him on the angle that shows him. A cut that would show no floor the
   *  search has not had a muzzle across is not walked — he is done when none of his is left — and the hold is not quiet, nor 'holding on the door' said,
   *  until both are. No cut is nearer than `thrPieApart` to where the other man ends, and none is over the frame line. Then each holds the middle of what his
   *  last station shows.
   *  `thrLean` (on in the page; false = square on every station): THE MAN CUTTING LEANS — his hips stop `thrLeanM` short of the station, back along the
   *  wall, and his head and gun go the rest of the way (character.ts anim.lean: the eye IS the head bone, so what he sees and what sees him is what the
   *  picture shows; a right-handed man leaned to his left has his head out before his muzzle) — and THE CUTS THAT LOOK DOWN THE DOOR'S OWN LINE, where a
   *  man covering the door from inside is looking (a station further in than `thrKneeIn` from his jamb's edge), are taken ON A KNEE. The teammates' only:
   *  nothing of the player's own movement. */
  thrPie: false, thrPieArc: [[-0.2, 1.4], [-0.05, 1.6], [0.08, 1.8]], thrPieApart: 0.65, thrLean: false, thrLeanM: 0.15, thrKneeIn: -0.1,
  /** ONE MAN SLICES, THE OTHER HOLDS HIS ANGLE (`thrPieOne`, on in the page, nothing without `thrPie`; false = both jamb men cut, each leaned on every cut,
   *  the cuts down the door's own line on a knee — the maintainer, 10-19, of that: "really only one guy should be doing it. one guy holds one angle while
   *  the other pies and then does the lean? looks a bit silly now where the two of them synchronize their crouch and lean together … just do the lean, not
   *  the crouch"). The lead walks the cuts, square on every one; the far jamb's man steps onto his diagonal and stays there, his gun down the middle of
   *  what it shows, as with `thrPie` off. When the lead has no cut left that shows him new floor he LEANS, once (with `thrLean`), from where his last cut
   *  left his hips — head and gun round the edge at the ground the lean opens — for one look, then stands square and the door is called. Nobody kneels. */
  thrPieOne: false,
  /** … the seconds that one lean is held (a cut's own look is `sliceLook`: too short to be seen, or to be sure his lines are asked with his head out) */
  thrLeanLook: 1.1,
  /** THE ROOM'S OTHER DOORS ARE HELD (`thrDoors`; false = every man on the short crossing sector his shallow point gave him, as it was). The stage ends hard
   *  on the entry wall: in a long room that leaves its other ways in a room's length off, in nobody's sector — and the depot's crew room showed what that
   *  costs (thirty-two seeds: its far door, twelve metres down a dark lane from four men standing in the room's own light, let a man in unseen to shoot the
   *  first of them in twelve runs; bang and clear, three). MEASURED over the five room-clearing scenarios × 32 seeds, every held room worked this way (448
   *  teammates): 258 up before, 284 with this alone (bang and clear: 280) — the depot 63 → 95 of 128 (bang 97); watching the far door from the entry wall
   *  instead of walking up beside it (`thrDoorsM` 11) gave back most of it, 72. So once the floor is searched each other door of the room gets ONE man of the entry (never the man
   *  left on the door they came in by): the one who has a line to it from within `thrDoorsM` turns his gun onto its frame where he stands; with nobody that
   *  close a man walks up to the first free floor two to four metres from it and off its line — beside the opening, not in front of it — with a line to the
   *  frame (no walk past `thrDoorsWalk` metres by the floor; a room too big for the entry's search — open floor — hands out none; a door another order
   *  works, one already held, or one a teammate of another order stands on is left to them). `thrDoorsLit`: a man with NO GOGGLES — or one whose goggles show him nothing there (nvg.ts: black ahead) — keeps his weapon light on that door for as long as he holds it where the place does not light it; with goggles that show it he holds it dark like any sector: over thirty-two depot seeds lit and dark came out the same, 95 and 96 of 128 (the light rule's dark hold is
   *  for a sector across a searched floor; a doorway is where the next man comes from — and a lit room's men see nothing of a man in a dark frame without it) */
  /** `thrDoorsStay`: with nobody left on the door they came in by (that is the last of three or more — a pair, or a lone man, has no such man) that many of
   *  the entry's men are NOT sent: a lone survivor walked off to a side door with his back to the way in, and the registry's roamer came in behind him — 8 of
   *  32 rescues lost that had been won (hostages alive 70 → 54 of 128; with it 70 again. 0 = every man may be sent) */
  thrDoors: true, thrDoorsM: 5.5, thrDoorsLit: true, thrDoorsWalk: 16, thrDoorsStay: 1,
  /** THE ROOM'S OTHER DOOR HAS A GUN ON IT FROM THE ENTRY ITSELF (`otherDoorM`, metres; 0 = as it was: every man of a bang / open and clear on his corners,
   *  the floor and then the sector his point gave him, the room's other doors in nobody's — the warehouse's front office and the compound's garage: two men
   *  shot in the back through the connecting door within seconds of taking the room, 72 of 167 teammates lost in 48 warehouse runs). Every other door of the
   *  room being taken that NOBODY OF THE SQUAD HAS BEEN BEYOND (entrypoints.ts farKnown: one model — what the team has seen for itself) is one man's from the
   *  moment a man of the entry is on his point, his corners checked, with a line to its frame from within this many metres: the nearest such man turns his gun
   *  onto it where he stands and keeps it there — through the rest of the search (the floor is the others': while the room is still being looked over no
   *  more than half the entry's men are turned off it — one of two or three, two of four) and on the hold after, until an order takes him; if he drops, the
   *  next man with a line has it. With more doors than men to spare: a door into the building before one to the outside, the nearer first. Nobody walks
   *  anywhere for it. A door another order works, one a man already holds, or one a teammate of another order stands by or was told to watch (a man Sam
   *  posted there himself) is left to them — and given back to them if they come to it after: its man is on his sector again; so is the man of a door the
   *  squad has since gone through. The man on a door holds it as a held door is held: `thrDoorsLit` — with no goggles, his weapon light stays on it. (The threshold order's own far doors — `thrDoors`, with its walk — come after, for what is still nobody's.) */
  otherDoorM: 9,
  /** A BANG IS ITS OWN SIDE'S CAN TO EVERY TEAMMATE (`ownCan`; false = as it was). bang() takes the entry's men — the thrower among them — off the guard list
   *  for the call, so combat.ts detonateStun, looking the thrower up on that list, found nobody and took the can for a guard's: a teammate still on the list
   *  (the other pair back down the passage with a line through the doorway, a man beyond the door) got a defender's full count and fold from his own side's
   *  can, where the own-side rule is 'only a man on top of it' (FLASH.ownM). On, the can says whose it is (Item.side). THE SAME WRONG ANSWER HAD A SECOND
   *  HALF, and the switch turns both: a man of team 'guard' (the staff a quiet mission's partner is up against, a response team) was taken for the can's
   *  OWN side and spared outside ownM; on, he is a defender to it like any other. `stats.ownFlashed` counts teammates outside the entry's list that a bang
   *  of the team's FOLDED (the defender's treatment: the own-side touch never folds a man), whatever the switch says. Not touched: breach.ts's drill and
   *  qrf.ts swap the list the same way — the drill's list holds no operative, the QRF's can is a guard's by the lookup's fallback, which is right. */
  ownCan: true,
  /** NOBODY IS SENT OFF ALONE (`buddy`; false = as it was). the maintainer, 10-07, playing the four-man room clear: "squad mates will sometimes leave the group and
   *  go off on their own (which seems very risky)". Two rules here dealt ONE man a walk with no thought for where his mates were: the room search's move-on
   *  (the man nearest the unseen floor walks to where it is best seen from — on the office's open floor that was ten metres across the cubicles, or twenty to
   *  the lobby, three men one after another, each by himself: room-clear-four seed 7, a man shot in the back six metres from where he was sent) and the
   *  threshold's far doors (one man walks up to sixteen metres to hold each). With this (away()): a point within `buddyM` BY THE WAY A MAN WALKS of where a
   *  friend stands or is going (a teammate, or Sam) is still one man's — he has not left anybody. Past that it is taken BY TWO or not at all: his pair-mate
   *  goes with him to a point beside his, on a sector his partner's is not (a man who has lost his partner goes with another who has; a pair is never split
   *  to make one, and a man whose partner is in a fight does not walk off: the other pair goes; two men with nobody else of the team up do not both
   *  walk on — somebody holds what was taken). Nobody, alone or paired, is sent past `buddyPairM` from
   *  everybody outside his pair (the squad is two pairs, not two patrols), and no walk is dealt that would leave a man who has company now with nobody
   *  inside `buddyLeftM`. (The far doors: `buddyDoors`, below.) A door nobody may walk to is the room's own cover's (cover.ts COVER.inRoom); floor nobody may walk to stays unseen, and the
   *  search says so ('N cells unseen'): it is the next order's. */
  buddy: true, buddyM: 5, buddyPairM: 12, buddyLeftM: 8,
  /** THE REST OF THE ROOM IS GONE INTO, NOT LOOKED AT FROM ITS MOUTH (`flowOn`; false = as it was). the maintainer, 10-10, the consul's office taken by its side
   *  door — the team bunched on its points by the door, the other half of the room (through the gap at the end of the wall across it) dark and nobody in
   *  it: "in corner fed rooms like this, the squad should really clear the whole thing without being told". The points of domination are a couple of metres
   *  from the door whatever the room's shape, and the search's move-on sent ONE man to wherever the unseen floor was best SEEN from — the mouth of the gap —
   *  and called the room done from there. With this: unseen floor in one piece of `flowCells` cells or more (a nook behind a cabinet is still looked into
   *  from where it can be seen) is a part of the room nobody has been in, and it is TAKEN like a room: the men nearest go THROUGH its mouth — two of them
   *  when a partner is free and somebody of the team stays behind them (away(), every rule of `buddy` as it stands) — to two points past the mouth, each
   *  by a wall where there is one, to either hand of the way in, with a line to each other and to as much of that floor as there is to see (within
   *  `flowReach` of the mouth, about `flowDeep` in); they look it over from there, and what is still unseen after that is gone into the same way, up to
   *  `flowMoves` times. The men who stay hold what was taken and the door they came in by. A LONG ROOM IS GONE THROUGH IN BOUNDS: floor further off than
   *  `flowBound` by the way a man walks is walked TOWARD, a bound at a time, and when `buddy` refuses the walk for its length from the men who stay, those
   *  men CLOSE UP on the man at the front first and the walk is asked again — the squad moves down the room together, the rear behind the front, never
   *  strung along it and never past `buddyPairM` apart. Each walk gives the entry `flowSecs` more before it is called,
   *  and the time its men spent in a fight does not count against the search (up to `flowFight` s). */
  flowOn: true, flowCells: 28, flowMoves: 5, flowReach: 5.5, flowDeep: 3, flowBound: 8, flowSecs: 10, flowFight: 20,
  /** WHERE CLEARING THE WHOLE ROOM STOPS. the maintainer, 10-11: "teammates are a bit too proactive now. i like that they try to fully clear rooms now, but it doesn't
   *  make sense for outdoor spaces or very large rooms." `openAir` (false = as it was): floor with no roof over most of it — a walled yard between buildings,
   *  145 m² of the compound — is OPEN FLOOR whatever its size (openFloor(), below): the entry's fixed sweep alone, no search of it, none of its far doors
   *  dealt, like floor past `searchCells`. `flowMax` (cells of free floor, a quarter of a square metre each; 0 = no limit, as it was): a room bigger than
   *  this — a hundred square metres to walk on: the office's open floor, the warehouse's hall, the consulate's — is searched as rooms were before `flowOn`
   *  (flows(), below): looked over, a man stepping on to where unseen floor can be SEEN from up to `searchMoves` times, called on `searchCap` — and nobody
   *  is walked INTO its unseen parts by pairs or down it in bounds: the far end of such a room is the next order's. */
  openAir: true, flowMax: 400,
  /** A DOOR THAT TURNS OUT SHUT, AND 'CLEAR FROM OUTSIDE' AS ONE ORDER. The maintainer, 10-11, on the defenders' wedged doors: "the default open and clear is now just
   *  suicide. if we don't know a door is locked or barricaded then it should just halt and they'll tell you when they test the door. and then maybe
   *  x -> 5 -> 1 then kicks it?" · "oh i like in ready or not then when you tell your squad to stack on a door they check it." `testDoor` (false = as it
   *  was: the lead says 'locked. kicking it.' and boots it in the same breath): the man on the jamb TRIES THE HANDLE when the stack is made — a plain 'stack
   *  up' and every entry order alike — and says what he found; an entry order at a door the team did not KNOW was locked or wedged, which would have gone to
   *  the boot (or the shotgun), HALTS there: its men stay stacked on their marks and the door is known from then on, so the same row — worded 'kick and
   *  clear' now — is the order that boots it. What the team knows: a door one of its men has tried, and a door whose lock rows the player has stood at.
   *  Quiet ways through (a silent squad's pick, a lock picked because the frame holds a boot) go on as they did: nothing loud was about to happen.
   *  Not asked of an order given by code (a scenario's own entry) nor at a captor's last warning.
   *  `outsidePlain` (false = the threshold's page of three orders and the held page of what next, as they were). His words: "i think the externally clear
   *  menu is a bit odd. it should just clear externally w/o the additional orders of what to do after. and then the squad does waste a lot of bangs in
   *  that path. so maybe it's just one level of external clearance and then you have to give a second order for them to go in". Row 4 of the door tools is
   *  ONE order, 'clear from outside' = the jambs held until told (thresholdHold: no can of its own); going in is the page's own rows given again — 'open
   *  and clear' steps the holding men in with no can, 'bang and clear' puts ONE can in first — and a can asked for at a held door is one can, not `thrBangs`. */
  testDoor: false, outsidePlain: false,
  /** THE WORD AT A DOOR HELD FROM OUTSIDE SPENDS NO CAN (acts with `outsidePlain`; false = the word bangs the blind pockets, then they step in, as it
   *  was). The men holding a door from outside go in on the word with no can; a can goes in first only when it is asked for — 'bang and clear' given
   *  to the holding men (row 2 of the door tools: one can, then in), or the word told 'bang, then step in' where that row exists. The maintainer, 10-16,
   *  off his own tape (the word given at a held door, a can nobody ordered into an empty room): "when externally clearing a room, the men shouldn't
   *  throw a bang unless i tell them to. i can do that by doing x 5 2 again". */
  wordNoCan: false,
  /** THE WORD WAITS FOR THE CUTS (`wordCuts`, acting with `wordNoCan` and `thrPie`; the page: on — `?wordcuts=0` — false here and on the frozen harness
   *  stand, `TPS_WORDCUTS=1`; a FROZEN_HOLDS row; false = the word steps them in there and then, as it was). The word that spends no can, given while the
   *  jamb men are still slicing the doorway, does not walk them off their cuts: the step in is OWED (the owed step a grenade's wait already uses), they
   *  finish the cuts — fighting whoever a cut shows from the frame, as the hold does — and step in on their own the moment the cuts are done, or after
   *  `wordCutsCap` seconds whatever is left. The word AGAIN (outside `wordTap`) pays it at once, as an owed step always could: the player's say stands.
   *  Not under a captor's last warning, nor at a door that shares its word with another, nor with a set charge on the same word. From a lesson's sixteen runs on the page's stand (10-23): the
   *  word a second and a half into a hold, a defender awake in the band neither jamb's diagonal shows, both men walked to the door's middle at once and
   *  were shot in its width before either had seen him, on ten; the same door left to finish its cuts found him and dropped him from the frame, on all. */
  wordCuts: false, wordCutsCap: 8,
  /** THE WORD SENDS A SMALL SQUAD IN FROM ITS STACK (false = as it was: with one or two teammates the word's key does nothing for men standing on a
   *  plain 'stack up', and no line of the panel offers it — only the squad of four had it). One or two teammates stacked on a door by a plain 'stack
   *  up' (the quick key on a door, or the menu's row) wait on the word as the four do: the panel reads 'F go · … waiting', the door carries the key's
   *  mark, and the key opens the door and they go in from the marks they stand on — the same open-and-clear the four's word makes of a stack (fromStack).
   *  A stack on a door that has a charge set on it is left out: there the key is the trigger's first, as it was, and the word's after. A free set
   *  charge elsewhere goes with the word, as with the pair's word at a held threshold. The quick key on the stacked door is untouched (the squad's own
   *  pick of entry), and so are the pair's menus and the word from code (`go()`): the rule is the key's, with no menu up. The maintainer, 10-21, off his own play: "Q on a door stacks but doesn't have the F command for entering?" */
  wordSmall: false,
  /** A BANG AND CLEAR'S CAN IS THROWN INTO THE ROOM (false = as it was: the can appears in the door frame at the thrower's end of the opening, up to two
   *  metres from him, and goes off in the air `airIn` 1.6 m past the frame a third of a second later, on every door). Two things, the maintainer's
   *  ("with bang and clear for a door, they often don't really throw the flash bang into the room", 10-16, with a tape of it):
   *  WHERE IT GOES: the point of the floor beyond the door — `bangIntoMin` or more inside, no more than `thrThrowM` from the hand, a clear throw from
   *  the opening — whose burst, chest high, has a line to the most of the floor the doorway opens onto; of the points that light `bangIntoLit` of what the
   *  best one lights, the DEEPEST (a can thrown into a room goes past its middle); it goes off as it gets there, as a threshold's pocket can does. Never a
   *  point with one of ours in its flash. No such point (a doorway onto a wall, a cupboard): the landing as it was.
   *  WHERE IT LEAVES: the thrower's own hand. A thrower more than `bangHandM` from the opening's edge with a clear line to it passes the can to that edge
   *  first — a quick flat lob past the first man, `bangPassV` m/s — and it turns in off the jamb. A leaf or a wall between them: from the edge, as it was.
   *  Who throws (the second man), when (the leaf well round), and whose list the burst keeps off are as they were. */
  bangInto: false, bangIntoMin: 1.5, bangIntoLit: 0.9, bangIntoDeep: 6.0, bangIntoWide: 4.2, bangHandM: 0.9, bangPassV: 6.5,
  /** HALTED ON A DOOR THE OTHER PAIR IS CHARGING (false = as it was). A pair stacked on a door steps back to rear security when the other pair is given a
   *  charge on it — asked once, as that order is given (startCharge). A pair that came to the door AFTER, on an entry order, and halted there 'found shut'
   *  (`testDoor`) was never asked: it stayed plain-stacked a stride and a half from the frame, inside `backblastM`, and the charge Sam blew dazzled his own
   *  man. `haltBack`: the halt asks it too — the same step back by the same hands (stepBacks, makeRoom: 'rear security · <door>', the order still
   *  'stack') when a teammate's charge order is live on that face of that door, or a teammate's charge stands set on it; a man with no floor to step back
   *  to keeps his mark and nothing is said of it. Only the halted men are moved, and nobody at a door with no charge. Not asked for a charge Sam
   *  set by his own hand that no pair has been stood off from: a stacked pair is not stepped back for that one either. */
  haltBack: false,
  /** SAM IS ONE OF OURS BEYOND THE DOOR. Off the maintainer's own play (the floodlit yard, 10-13, 6:47.9): the squad held the guard room's door from
   *  outside, he walked into that room, gave the word — and their stun can came in and blinded him. `behind()` counted the squad of four's other pair
   *  beyond a door and never him, though the can that goes in first (canFirst) and a frag (fragBehind) both did. `behindSam` (false = as it was): wherever
   *  the squad's own can is decided — the pockets of a held door on the word, 'bang, then go in', a bang and clear's row — Sam beyond that door, inside
   *  the can's reach (`stunM`) with a line from the opening, is what a teammate there is: the row is refused in words ('you are behind that door.'), and
   *  on the word the can stays in the kit ('no bang · you are in there') and they step in; a bang and clear asks again as the can is about to leave the
   *  hand (he may have gone in since the row was given) and goes in without it, the same beat. Any squad size. A can HE throws, or one he watches go in
   *  from outside through the open door, blinds him as it did (samstun.ts SAMSTUN.ownSeen: not this rule's). */
  behindSam: false,
  /** NO CAN INTO A ROOM OUR OWN MEN HOLD (the maintainer, 10-22: "the second team threw a flashbang when our guys were already on the inside"): a
   *  bang and clear asks about TEAMMATES again as the can is about to leave the hand, as behindSam asks about Sam — a teammate outside this order
   *  (and outside the orders that go on its word or its gate) beyond the door, inside the can's reach with a line from the opening: the can stays
   *  in the kit ('no bang · Blue One is in there'), a man says so, and they step in. Any squad size (the row's own test at the time it is given —
   *  `behind` — asks only a squad of four, and only then). false: the row is asked when it is given and never again, as it was. Off here; the
   *  page raises it (`?tossmate=0` off) */
  tossMate: false,
  /** NO POINT OF AN ENTRY IN ANOTHER DOOR'S FRAME. The barracks (rebuild/missions/faults.md B2): the gallery entry by n_end dealt one of its points on the
   *  threshold of n4b, a door in the gallery's side wall 1.7 m on — its floor is floor to the nav grid and nothing solid stands between, so the hand of the
   *  door with no room took it; a man was left standing in an uncleared doorway, and entrypoints.ts had no floor on that hand to move him to. `podFrames`
   *  (false = as it was): a candidate point is refused when it stands in another door's opening (between its jambs, within `podFrameM` of its line) or when
   *  the line to it from this door's mouth passes through one (a point of the room BEYOND that door is no point of this room). The hand that then has no
   *  floor is dealt down the middle, as a room with a wall to that hand always was; entrypoints.ts does the rest. Authored door plans are not asked. */
  podFrames: false, podFrameM: 0.55,
  /** NO CAN FROM A HAND THAT IS NOT AT THE DOOR (`thrHand`; false = the thrower as he was picked, wherever he stands). A threshold's can leaves the hand in
   *  the doorway (handAt) whoever throws it, and the stage's pick asks no reach of the far-jamb man or of the lead: with the order's men run off the door
   *  (a frag landed by the stack: frag.ts fragFlee, which no staged order reads) the stage's clocks ran on, the lead was made the thrower from 6.6 m down
   *  the wall, the can left a doorway nobody stood at — and he was then the first man in, which the stage's own rule forbids while there is another (the
   *  depot's a_s, seed 2, as the page ships). On: the picked man throws while he is not the lead and is AT THE DOOR (thrAt: within `throwReach` of the
   *  frame, on the squad's face); otherwise ONE test (thrPick's `hand` form) says whose hand may throw now — the pick's own order of men, each at the
   *  door, and the lead only with no other man of the order still on his way back. A different man: the can is his, after his own `thrTurn`. Nobody: the
   *  can WAITS — the lead says so, the pocket step stays where it is, asked again every `thrHandEvery`, nothing else of the order moves.
   *  `thrHandWait` s is the ORDER's whole wait (the time between asks and every hand-over turn counted, over all its cans): once it is spent the stage is AS IT WAS
   *  for the rest of the order (the picked man throws from where he is — the old fault and all), so the rule can neither hang an order nor send it in
   *  without the can it would have had. A captor's last warning — before or during the wait — waits for nobody (lastStack / lastHold / rescue.lastWarning: as it
   *  was). With every man at the door or on his mark it changes nothing. THE COST: a lead who is the picked thrower waits out what is left of the order's
   *  wait for a man who is off the door and off his mark and never comes (rooted in a fight, stunned). NOT ASKED of a door that shares a word with another
   *  (the other doors of the word wait on this one's burst, and a can held here would stand their men on their jambs past their own flash — as it was
   *  there, fault and all; one door let go by the word IS asked). A hand whose own end of the doorway has no pocket for the can is no hand for it. The word's key during the wait is what it
   *  is during the pockets (not the word again). What an order should DO when a frag lands on its men — and so who is first over the line when they step
   *  in still walking back — is not decided here. */
  thrHand: false, thrHandWait: 6, thrHandEvery: 0.25,
  /** TWO ANSWERS TO A GRENADE AT THE STACK — the maintainer said yes to both, 10-16: ON in the page (?thrnocan=0, ?thrfraghold=0), false here and on the frozen
   *  stand (TPS_THRNOCAN=1, TPS_THRFRAGHOLD=1); nothing changes while both are false.
   *  `thrNoCan` (acts only under `thrHand`): the order's wait for a hand at the door is spent and still nobody is there — the can STAYS IN THE KIT, said why
   *  ('no bang · nobody at the door'), and the stage goes on as it does with no pocket worth a can (false = thrown as it was, from wherever the picked man
   *  stands). Once the wait is spent a later can of the order goes only from the picked man's own hand at the door, with no second wait.
   *  `thrFragHold`: THE ORDER WAITS FOR MEN WHO RAN FROM A GRENADE. While a man of the order who ran from one (frag.ts fragRunning) is not back at the
   *  door or on his mark (thrBack: a man down or given another order is no longer waited for), the hold does not count the door quiet (its own cap ends
   *  it as it always did), and the pockets give neither a can nor the step in ('the door waits', said by a man who did not run) — whoever sent them
   *  there: the hold's own clock, its cap, the word, Sam's 'bang, then step in'. The wait at the pockets is the ORDER's one wait (`thrHandWait` s in
   *  all, the can's own wait for a hand counted in the same sum; time in the hold is not counted): once it is spent the stage goes on as it was ('on
   *  without …'); back in time, the can's thrower is picked afresh and has his own turn. NOT held: Sam's plain 'step in', a captor's last warning, a
   *  door that shares a word with another (as under thrHand), and the step in behind a can of the order's own that has just gone off (a grenade landing
   *  while the can is in the air or its burst running is not read: they go behind their flash). The hold already waited for its LEAD to be back on his
   *  slice (he is `done` only there): this asks the same of every man. */
  thrNoCan: false, thrFragHold: false,
  /** `thrDoors` and `otherDoorM`, THE DOOR'S OWN LEAF: a man left on another door of the room is not put where that door's leaf, stood open, lies across
   *  his line to it while there is a post where it does not, and a man is not taken as holding it from where he stands if it would. The posts were
   *  tried with the leaf as it stood, which is shut: on the hinge side the door a man comes in by swings round between him and the opening and he is
   *  holding a door he cannot see (the depot's store, the man left on `c_n` 3.5 to 3.9 m down its own wall). Asked of the leaf from where a pushed
   *  leaf comes to rest, near square, to its stop, and only of one-way doors (a double-acting leaf can stand either way). It is a preference, never a
   *  refusal: a post the leaf would hide the door from costs metres of walk beside one it would not (LEAF_COST, more the more of that sweep hides
   *  it — where a door stands in a corner and every post is on its hinge side, the deep one that sees past a leaf stood square wins), and of the
   *  men who could cover a door from where they stand (`otherDoorM`) the one it would hide it from least is taken first. A door is never left
   *  unheld for it. Off = the posts as they were */
  thrDoorsLeaf: false,
  /** A GRENADE SCATTERS THE MEN OF A DOOR ORDER: THE ORDER WAITS FOR THEM (the maintainer's answer, 10-16: 'pause until they're back at the door, then go').
   *  `fragHold` is what `thrFragHold` is to a held doorway, for EVERY door order while its door is still to be opened: with a man of the order who ran from a
   *  grenade (frag.ts fragRunning) not back on his mark (fragBack; a man down or given another order is not waited for) the stack is not called, the leaf is
   *  not opened (the shove, the boot, the pick, the tool on the lock), a charge's man who ran is not given up on, 'stood off' is not said — and a word, or one
   *  signal for several doors, holds its first sound for all its doors ('the door waits', said by a man who did not run). The stage's own caps do not run
   *  meanwhile. `fragHoldCap` s of that, in all, is the order's whole wait: after it the order goes on as it was ('on without …'), so a man who cannot get
   *  back does not freeze the squad — and Sam's word given AGAIN while it is held sends them at once ('the word again'). NOT held: anything once the leaf has moved or the signal has gone (the can, the wait behind a burst, each man's turn
   *  through the frame), Sam's own trigger on a set charge, a stack still waiting for Sam's word (who ran is kept: the wait begins when the word comes), a captor's last warning, the response team's own door orders (Sam's squad only). A threshold's hold and its pockets are `thrFragHold`'s. false = the
   *  order as it was (the module's and the frozen stand's; ON in the page, ?fraghold=0 puts both off; TPS_FRAGHOLD=1). */
  fragHold: false, fragHoldCap: 8,
  /** A KNOWN THREAT FIRST. The maintainer, 10-11, on a replay (the compound's shed: a man inside shot the jamb man, the word came, and the first man through
   *  walked to his point looking 95° off where the fire had come from): "the point man here saw his buddy go down, knows roughly where the enemy is in the
   *  room and looks the wrong way going in". `threatFirst` (false = the entry as it was, run for run): while a door is worked the order REMEMBERS, for
   *  `threatSecs`, where its own men's senses put an enemy in the room beyond it — a man one of them had in sight (where he was last seen), or the muzzle a
   *  round came from that hit or passed within `threatNearM` of one of them, the man it dropped included where a man of the order still up saw him go down; never a place nobody living saw or was shot at from, and a man there counts as down only once one of them sees him down. As
   *  the men go in, the FIRST man's gun is on the known place nearest the doorway from the stack on, the second man's on the next (with one place known: on
   *  the same one, until the first man is through with a line to it); the others take their corners as ever. The first man goes on to his own corners — their
   *  clock starting then — once the man there is down, he has had his muzzle on the place with a line to it for `cornerSecs` and nobody the room fight took
   *  it for, or `threatCap` seconds after he crossed (the seconds the room fight had his gun do not count). Where he looks, never when he shoots. A man HELD UP
   *  short of the frame (`threatStuck` seconds without a stride, the room fight's seconds not counted: a leaf a defender stands behind) lets the place go and
   *  is the entry's as it was — with his gun kept on a place deep in the room he never looked round the leaf at the man stopping it (0 = kept until old news). */
  threatFirst: true, threatSecs: 12, threatCap: 1.5, threatNearM: 1.5, threatStuck: 1,
  /** the threshold's FAR DOORS under `buddy`. false (shipped) = as they were: each far door of the room the team stands in is ONE man's, whoever is nearest,
   *  up to `thrDoorsWalk` — the threshold order's own design, a short walk across a room his mates stand in. true = by the search's rule: a door away from
   *  everybody is the pair's or nobody's. Measured, threshold entries, seeds 1 to 144: the pair at a far door ends every lone walk there is (the depot: 125
   *  stretches of about five seconds each, to none) but the second man stands by a door for no gain and is shot at it — the block 303 men up of 576 as it
   *  was, 269 with the pair (his partner's deaths up by half, the killers to his side or back). A third rule tried and dropped: one man, but only where a
   *  mate who stays sees him there — it changed next to nothing (the block 296 men up with it or without, the depot 443 against 444). */
  buddyDoors: false,
  /** THE FAR GUN IS SET BEFORE THE DOOR MOVES (`thrSet`; false = both jamb men step out as the leaf swings, as it was). The far-jamb man — the still gun —
   *  steps onto his diagonal with the door still shut, his gun up on where the opening will be, as the stack's last step: 'stacked' is called, and the
   *  lead opens it, only once he stands there (or `thrSetSecs` after he was sent, whichever is first) — the gun that covers the opening is planted and
   *  pointed when the room first sees it, not walking into its own light. He is no longer the pair's rear security from that step on. A door standing
   *  open already, one that wants the boot, and an order given ON A WORD (its men wait on the wall with their rear watched) are worked as before.
   *  SHIPS OFF: over the same 448 it moved nothing (283 with it, 284 without; men lost at the frame 33 either way — the door's duel is lost to the
   *  light, not to the step) and half a second later at the door cost the night breach's scripted last hunt four men */
  thrSet: false, thrSetSecs: 1.5,
  /** GOGGLES COUNT AT THE DOOR (`thrTube`; false = only a burning weapon light or the room's own light makes floor 'seen' from the frame, as it was):
   *  floor a jamb man's gun is across with his goggles down, where the place's own light shows a man through the tube (nvg.ts tubeVis at NVG.blackAt or
   *  better), is floor that has been looked at — it is not banged as a blind pocket for want of a white light. Floor black even to the tube stays a pocket
   *  (none inside its reach is, to a man whose goggles carry an infrared light: irlight.ts irShowsAt) */
  thrTube: true,
  /** THE HOLD AT THE DOOR IS DARK UNDER GOGGLES (`thrDark`; false = `thrLight` decides for every man, as it was): a jamb man who wears goggles burns no
   *  light for the hold — a lit lens in a doorway is seen at once by every man it points at (roomfight.ts lampGlare), where the tube shows him the room by
   *  its own light — unless what he looks at is black even to the tube (nvg.ts), when the still gun's light comes on after all. A man without goggles,
   *  and any man with somebody found (the light rule), is lit as `thrLight` and the rule have it. MEASURED neutral (283 of 448 with it and `thrTube`,
   *  284 without; men lost at the frame 30 against 33): on because a quiet door worked on goggles is the team's own light rule, not for the count */
  thrDark: true,
  /** A CAN GOES IN BEFORE ANYBODY SHOWS IN THE OPENING (`thrFirst`: 0 = never — both jamb men step onto their diagonals as the leaf swings, as it was ·
   *  1 = on a HOT floor: a shot, a charge or a boot in the ears of a man of the order inside ROOMFIGHT.teamHot · 2 = on every door). A room that has heard
   *  the floor go loud has its guns on its doors: the man who steps into the opening is seen by a man already settled on it, and that duel is a coin's — it
   *  was where the stage lost its men. So on such a door the leaf is opened from the jamb and the two guns stay on their marks behind the wall; the
   *  first of the stage's cans (one of `thrBangs`, not one more) goes where its burst has a line to the most floor; the blind burst it draws is let run
   *  dry on a bang's own count (`afterBang` · `quiet` · `entryCap`); and only then do they step out onto the diagonals and work the room from the door —
   *  for `thrFirstMin` s at least (the hold's `thrMin` is for a room that can still see; this one cannot for FLASH.secs — 1 s measured worse than 2: more lost
   *  stepping in than saved at the door). No can in the kit, one of ours (a teammate, or Sam) beyond the door inside its reach, an order on a word or held
   *  until told (the cans are the player's to call there), or a gate: the stage as it was. A can that went off on the team's side earns a plain hold. `thrFirstStale`: a hold
   *  that runs on past this many seconds from that can ends with its flash worn off the far men — the floor it lit and no muzzle has been across since is
   *  a blind pocket again, and gets the stage's next can before anybody steps in (0 = floor banged once stays banged: they walked in on men who could see).
   *  `thrFirstIn`: that first can is cooked short — it goes off this far inside the frame line on its way to the pocket it was thrown at, not at the pocket
   *  (0): thrown on the shove (`tossAfterOpen`) it bursts under half a second after the leaf moves, where the flight to a pocket three metres in took most of one.
   *  `thrFirstOnly`: a can that went in first is the door's ONLY can — behind it they hold `thrFirstMin`, turn in to the jambs and step in (off = the stage's
   *  own count, as the rule first went in: floor the first can left dark got the second of `thrBangs` before anybody crossed. Measured over 96 seeds the two
   *  lose and win the same within the scatter; the one can saves about 25 of a block's 445, cans the next door has a use for — and with it on `thrFirstStale`
   *  has nothing to do. Stepping straight in off the diagonals, with no turn in to the jambs since no throw is coming, was measured too: no better on 48 seeds,
   *  19 teammates of 576 worse on the next 48 — the turn in stays). Sam's word and a told 'bang' are his to ask a can with: they get the stage's count
   *  whatever this says */
  thrFirst: 1, thrFirstMin: 2, thrFirstStale: 0, thrFirstIn: 0, thrFirstOnly: true,
  /** THE CAPTOR'S LAST WARNING IS HEARD AT THE DOOR (`thrLast`; false = the stage as it was: every man waited for, the hold held). A threshold order on a
   *  hostage room whose captor is at his last step (rescue.ts lastWarning: 'about to' — the moment the HUD says so; his "last chance! i mean it!" —, his gun
   *  on one of them, or one already shot) stops being a deliberate entry and becomes the emergency one: (1) THE STACK DOES NOT WAIT for a man still more
   *  than `thrLastM` from his mark once a jamb man is on his — the door goes with who is there (handed to that man if it was the lead still walking), and a
   *  late man whose mark is the OTHER jamb is given the lead's wall, a place behind him, where there is floor (so he does not walk across a door that is
   *  about to open); (2) THE HOLD IS NOT HELD — ONE can goes in at once, whatever the pockets say (as on Sam's 'bang and step in'), and they step in behind
   *  it; with a can already burst in there inside `thrLastFresh` s (`thrFirst`'s, on a hot floor) they step in behind THAT one and throw nothing. A first can that went off on the team's side (`Threshold.wide`) is not that one: the last-warning can still goes in, `thrFirstOnly` or not. Not for an order on a word, on a gate with other doors, or given to hold: those are Sam's to time. The cue is the scenario's step, the same one the
   *  HUD words for Sam — no sound is propagated for it (a shout through the door they stand at). TRACED (registry rescue, 48 seeds, the scripted commander):
   *  every hostage lost from the threshold was shot by the captor's own clock while the team stood at the door — the walk-up of a man 12 m back on his
   *  cover (5.2 s of stack) and the 4 s hold put the can at 35.8 s where the shortest clocks run out at 30.1 to 33.0 s */
  thrLast: true, thrLastM: 2, thrLastFresh: 3,
};
const flat = v3.distXZ, yawTo = v3.yawTo;
/** thrDoorsLeaf: the leaf is taken this much longer than it is (m: it has a thickness, and a line that grazes its tip is no line) · it is asked from
 *  this far open (rad: where a leaf pushed open and let go comes to rest, near square — doors.ts) to its stop, in steps of this (rad) · what a post
 *  the leaf hides the door from costs beside one it does not, as metres of walk: this, and as much again in proportion to how much of that sweep
 *  hides it · the posts tried last beside a door that opens into the room, [past a jamb, into the room] in m: where a door stands in a corner
 *  every post out along its wall is behind the leaf, and the floor that sees past a leaf stood square is nearer the door's own line and deep */
const LEAF_EDGE = 0.1, LEAF_FROM = 1.45, LEAF_STEP = 0.1, LEAF_COST = 4, LEAF_POSTS = [[0.2, 2.4], [0.5, 2.4]];
/** who set a charge the player put on by hand (SetCharge.by), and how far a step may take him off it before it is broken off (the wall charge's own) */
const SAM_SHIFT = 0.35;

export type DoorToolKind = 'openClear' | 'bangClear' | 'charge' | 'outside' | 'threshold';
/** the page of the command menu the tools are on (orders.ts OrderDef.page), and the id of the row that opens it */
export const TOOLS_PAGE = 'tools';
/** the big slot's own row on a door's tools (kit.ts BIGSLOT.shut): its id, and the key it is on — the page's digits are taken */
export const BIG_ORDER = 'bigClear', BIG_KEY = 'KeyH';
/** … the page behind the tools' row 4 — the room worked from outside: the threshold's two orders, and 'clear from outside' — and the page that stands in for
 *  the tools on a door whose threshold is held: what to tell the men on its jambs (each is its opening row's id too) */
export const THR_PAGE = 'thr', HELD_PAGE = 'held';
/** thrPie: how long a cut waits for his hips to be on it before its clock starts anyway (s) · a kneeling man's eye above the floor (m) */
const PIE_WAIT = 2.5, KNEE_EYE = 0.95, PIE_GUN = { after: 0.2, step: 0.12, most: 3, every: 0.4 };   // (a man on a cut who sees a man and has no round at him — the jamb is across his bore —: after `after` s the gun comes round after the eye, `step` m toward the middle of the opening, again `every` s, `most` times; then he gives the cut up)
type Phase = 'stack' | 'ready' | 'kick' | 'toss' | 'fuse' | 'wait' | 'enter' | 'place' | 'standoff' | 'armed' | 'slice' | 'held' | 'thr' | 'pocket';
/** One word of Sam's (go()) and the orders it let go together. `go1`: when they were all on their doors and the loud ones began (NaN: not yet);
 *  it is dropped from `words` once they have all crossed. */
export interface Word { t0: number; go1: number; /** DOORTOOLS.fragHold: the game time this word was last held for a door whose men ran from a grenade (unset: not held) */ fledT?: number }
type Post = StackPost;
/** the phases a stack WALKS UP and WAITS in (tick: its last man keeps the rear through these). Once the can is on its way — toss, fuse, wait — or the
 *  boot or the shove goes, every gun turns in: the man behind the lead is through the frame on his heels, not a half turn late */
const PRE: Phase[] = ['stack', 'ready', 'place', 'standoff', 'armed'];
/** One order of this module's on one door, from the menu's release to the men standing in the room (or holding outside it). */
export interface DoorOp {
  kind: DoorToolKind; door: Door; side: 1 | -1;
  /** given by code (order(): a scenario's own entry), not off the menu */
  coded?: boolean;
  men: Guard[]; lead: Guard;
  /** DOORTOOLS.fragHold: the men of the order who ran from a grenade and are not back on their marks · the seconds the order has waited for such men, in all
   *  (`fragHoldCap`) · the game time that was last counted (unset: not waiting) · 'the door waits' said and not answered yet · the order's signal has gone (a
   *  word's first sound, a gate's): nothing of it waits from here */
  fled?: Set<Guard>; fledW?: number; fledT?: number; fledSaid?: boolean; fledGo?: boolean;
  /** clear from outside by three or more: the men who do not work the opening — they watch the squad's back from the end of the file */
  rear: Set<Guard>;
  /** doorway.ts DOORMANNERS.stackCover: a man of the stack is covering a door standing open onto it (`door`) before he comes up to his mark — `cover`: the
   *  assignment that put him there (somebody else's since: he is theirs) · `back`: the stack's own for him, given him again when he comes up · `at`: when he got there */
  lane?: { gd: Guard; door: Door; cover: Assignment; back: Pick<Assignment, 'post' | 'face' | 'going' | 'there'> & Partial<Assignment>; at?: number } | null;
  /** where each man was when the order came (the stack's last man watches the way he came: orders.ts spareRear) */
  from: Map<Guard, Vec3>;
  phase: Phase; t0: number;
  /** bang and clear: the canister this order took from the count at the word and has not thrown yet (back in the bag if it ends first) */
  bangHeld: boolean;
  /** a bang and clear whose can is a FRAGMENTATION GRENADE (the 'frag and clear' row): every rule of the bang and clear, but the thing thrown is frag.ts's item on
   *  its own fuse, thrown deeper — and it spares nobody: the stack stays off the opening until it has gone */
  frag?: boolean;
  /** `fragWay` / `bangWay`: game time the thrower first found the doorway shut to his grenade (he waits `fragWayWait` from it) · the leaf's angle and the
   *  time at the last look (its real turn is read off the two) */
  fragWayT?: number; leafA?: number; leafT?: number;
  /** the assignment this module last handed each man (his being on another = he was re-ordered: he is not ours) · his mark in the stack / the stand-off */
  mine: Map<Guard, Assignment>; post: Map<Guard, Post>;
  /** the boot: where from, and when it was thrown (NaN: not yet) — or, `pick` (a SILENT squad: silent.ts), the lock worked from there instead: `at` the last
   *  frame his hands were on it, `by` the man whose hands are (his anim.lockpick is ours to clear), `doneT` when it gave (he is on his way back to his jamb) — or,
   *  `gun` (a man of the stack carries a breaching shotgun: shotgun.ts), the lock shot off from there: `by` him, `at` the lock, `n` shells gone into it, `nextT` his
   *  action is worked; `t` then is when the shell that took it went */
  kick: { pos: Vec3; yaw: number; t: number; pick?: boolean; hand?: boolean; gate?: boolean; onIt?: boolean; at?: number; by?: Guard; doneT?: number; offT?: number; gun?: { by: Guard; at: Vec3; n: number; nextT: number; silent: boolean; own?: boolean; /** it is the big slot's hammer he takes the lock with, not a shotgun (bigkit.ts) */ hammer?: boolean; /** the door was NOT locked against them when he was sent (the big slot's own row, BIGSLOT.shut): it is his while it is shut, and one blow or one shell takes its latch */ shut?: boolean } } | null;
  /** the breaching shotgun (shotgun.ts) has been tried on this door's lock and given up on: the boot */
  noGun?: boolean;
  /** given by the big slot's own row ('hammer and clear' / 'shotgun and clear' — BIGSLOT.shut, bigkit.ts): the door is opened WITH the tool whether it is
   *  locked or not, from beside the frame, and no hand tries it first */
  big?: boolean;
  /** when the leaf was opened (NaN: not yet; −Infinity: it stood open already) · the canister · when it left the hand / landed / went off, and where */
  openT: number; can: Item | null; tossT: number; landT: number; bangT: number; bangAt: Vec3 | null;
  /** the men still to be sent in, and when · the charge's clock at the door */
  queue: { gd: Guard; at: number; pod: { pos: Vec3; face: number } }[]; setT: number;
  /** (workstow.ts stowFight) since when the fight has had the setter off his charge, this stretch of it */
  stowOffT?: number;
  /** each man's point of domination once he has been sent in, and when he got onto it */
  pod: Map<Guard, { pos: Vec3; face: number }>; onPod: Map<Guard, number>;
  /** clear from outside: each man's stations, the one he is on, and since when he has held it with nobody in his sight */
  slice: Map<Guard, { pts: Vec3[]; looks: Vec3[][]; i: number; j: number; t: number; ahead: Guard | null; pie?: { eyes: Vec3[]; lean: number; /** thrPieOne: the side of the one lean that ends his cuts (0: none), and whether he has begun it */ end: number; endOn: boolean; knee: boolean[]; fin: boolean; begun: boolean; at: number; /** toward the middle of the opening from his jamb, a unit; the times the gun has come round on this cut, and when it last did */ inw: Vec3; gun: number; gunAt: number; /** he has stood on this cut · the cut he was stepping to when a man showed and stopped him (he goes on to it once nobody is in his sight) */ on: boolean; to: Vec3 | null } }>;
  /** who crossed the frame line into the far side, and when (the first is 'the first man through') */
  crossed: Map<Guard, number>;
  /** the entry: each man's corners to check, the one he is on, and since when his muzzle has been on it (NaN: not yet) · the room's floor being looked over
   *  (undefined: not asked for yet; null: no room model here, or the search is switched off) */
  corner: Map<Guard, { pts: Vec3[]; i: number; on: number; fight?: number; last?: number; turned?: boolean }>; search: RoomSearch | null | undefined;
  /** the man picked to go in first (leadSeen: picked when the can leaves a hand, or as they go) — undefined: not picked yet · the man who threw this order's can */
  first?: Guard; threw?: Guard;
  /** DOORTOOLS.bangInto: where this bang and clear's can was thrown to (it goes off as it gets there) and where it left the hand reaching round the jamb · the pass from the thrower's own hand to that point, while it is in the air */
  aim?: { at: Vec3; from: Vec3 }; pass?: { to: Vec3; v0: Vec3; T: number };
  beats: { t: number; what: string }[];
  /** given 'on my word': stacked, it waits ('ready') · the word that let it go, while that still has it in step with the others · where it stands with that
   *  word: 0 not there yet, 1 on its door with nothing begun, 2 a step from crossing */
  onWord: boolean; word: Word | null; hold: 0 | 1 | 2;
  /** when its men were all on their marks (NaN: not yet) · the gate it goes through with other doors' orders (null: on its own, the moment it is stacked) */
  readyT: number; gate: DoorGate | null;
  /** worked from the threshold (kind 'threshold'): the stage's own state, from the moment the leaf moves · given to HOLD the jambs until told what next */
  thr?: Threshold; thrHold?: boolean;
  /** the far-jamb man sent onto his diagonal ahead of the door (DOORTOOLS.thrSet), and when */
  thrPre?: { far: Guard; t: number };
  /** let go by a word (its `word` is cleared when it begins: it goes in on its own count) — the cans on such a door stay the player's to call */
  worded?: boolean;
  /** DOORTOOLS.thrLast: the stack went without waiting for its last man (said once) · the hold was not held (said once) · the cans thrown by then */
  lastStack?: boolean; lastHold?: boolean; lastTossed?: number;
  /** DOORTOOLS.otherDoorM: the room's other doors that a man of this entry has his gun on — who, and the point it is held on */
  other?: Map<Door, { gd: Guard; w: Vec3 }>;
  /** DOORTOOLS.threatFirst: what this order's men know of an enemy beyond the door (`known`), the event clock read up to, the room beyond (undefined: not asked
   *  yet), and — dealt as they go in — whose gun is on which known place (`deal`: undefined until the entry's first frame) */
  threat?: { known: KnownThreat[]; evT: number; room?: { cells: Set<number> } | null; roomT?: number; deal?: Map<Guard, ThreatWatch> };
}
/** a place the men of a door order know an enemy to be (or to have fired from) beyond their door: where, when they last knew it, the man (down = dealt with) */
export interface KnownThreat { at: Vec3; t: number; by: Guard | null; how: 'seen' | 'shot' }
/** a man going in with his gun on a known place: `lead` — null: the place is HIS to deal with; a man: he only covers it until that man has a line to it ·
 *  since when his muzzle has been on it with a line (NaN: not) · the seconds the room fight had his gun · when he was let go of it (NaN: not yet) */
export interface ThreatWatch { th: KnownThreat; lead: Guard | null; on: number; fight: number; last: number; doneT: number; faced?: boolean; /** short of the frame: where he last made a stride, and the seconds since that the room fight did not have his gun (`threatStuck`) */ at?: Vec3; still?: number }
/** A room being worked from the threshold. `jamb`: the men at the frame — [0] the lead on his own jamb's diagonal (`thrSlice`: slicing it), [1] the man on the far jamb's (absent: one jamb only has
 *  floor); everybody else of the order is `DoorOp.rear` — the squad's back — until he is wanted. `pods`: the shallow points they step in to. `quietT`: when a
 *  man at the door last had somebody in his sight, or a defender last fired near it (`evT`: the event clock read up to). `up`: their men standing when the
 *  leaf moved, and `down` how many of them have dropped in the room or its doorway since, before anybody went in. `thrower`, the cans thrown, when the next
 *  may go, where the one in the air is to burst (null: a bang and clear's own spot) and the hand it left; `banged`: the floor a burst has had a line to.
 *  `hold`: the jambs are held until Sam says what next (`told`: the door has gone quiet and the lead has said so); `force`: told to bang — a can goes in
 *  while the kit has one, blind pocket or not. */
export interface Threshold {
  jamb: Guard[]; pods: { pos: Vec3; face: number }[];
  quietT: number; evT: number; contact: Set<Guard>; up: Guard[]; down: number; sliced: boolean;
  thrower: Guard | null; tossed: number; nextT: number; aim: Vec3 | null; from: Vec3 | null; banged: Uint8Array | null;
  handed: boolean; losT: number; litC: Int8Array | null; tubeC?: Int8Array; hold: boolean; told: boolean; force: boolean;
  /** DOORTOOLS.thrHand: the seconds this order's cans have waited for a hand at the door, in all (`thrHandWait` is the order's whole wait), and the game time of the last ask of a can waiting now (unset: none is) */
  handW?: number; handT?: number;
  /** DOORTOOLS.thrHand: the order's wait is spent — its cans go as they always did from here on */
  handDone?: boolean;
  /** DOORTOOLS.thrFragHold: the men of the order who ran from a grenade and are not back yet · the game time its wait at the pockets was last counted (unset: not waiting) · 'the door waits' said, and not answered yet ('the men are back', or 'on without …') */
  fled?: Set<Guard>; fragT?: number; fragSaid?: boolean;
  /** … the word's step in (no can) is OWED: the word came while men who ran were out — it goes when they are back, the wait is spent, or the word comes again · when it became owed */
  stepOwed?: boolean; owedT?: number;
  /** DOORTOOLS.wordCuts: the owed step in is waiting for the jamb men's cuts */
  cutOwed?: boolean;
  /** DOORTOOLS.thrFirst: 'can' — the first can is still to go in, nobody on his diagonal yet · 'burst' — it has gone off, the burst it drew is running dry ·
   *  'done' — they stepped out behind it (the hold's own minimum is `thrFirstMin`) · null: the stage as it was. `out`: the step onto the diagonals, kept for then */
  first?: 'can' | 'burst' | 'done' | null; out?: (() => void) | null;
  /** … that can went off on the team's side of the door · the word came while it was in the air (taken as they step out) · Sam's word cut the hold short (the
   *  pockets are his to ask a can for: `thrFirstOnly` does not hold one back) */
  wide?: boolean; early?: boolean; asked?: boolean;
  /** the row that sends a held door in was given on the word with no can asked: the word steps them in, no bang (thenOnWord) */
  wordStep?: boolean;
  /** when a can asked for at a held door found the leaf shut again and the door was opened for it (the 'pocket' stage's leaf look, under `bangWay`) */
  shutT?: number;
}
/** A room's floor while an entry looks it over: the cells' centres, which have been looked at, each man's line-of-sight answers from where he stands (cached
 *  until he has moved), the yaw his muzzle is scanning through and when it last moved, how many times a man has been sent on to see dead floor and how much
 *  was unseen when the last was sent. Two orders into ONE room (the four's pairs on a word, the rescue's two doors) look over one floor between them. */
export interface RoomSearch { room: unknown; pts: Vec3[]; looked: Uint8Array; los: Map<Guard, { at: Vec3; ok: Int8Array }>; yaw: Map<Guard, number>; at: Map<Guard, number>; moves: number; leftAtMove: number; left: number; /** flowOn: walks into (or a bound toward) a part nobody had been in · times the rear closed up on the front · the walk was called · nav cell → index in `pts` · seconds its men have been in a fight */ flows?: number; closes?: number; flowSaid?: boolean; late?: boolean; cellAt?: Map<number, number>; fightT?: number; fightAt?: number }
/** Doors that go on ONE SIGNAL (the hostage rescue's F on both doors of its room — rescue.ts): no order on the gate opens its door until every one of them
 *  still under way has its men stacked and `go` is up (false: stacked and holding for the word); then a door that only needs a shove waits for the boot going
 *  into the door beside it, and the leaves move on one frame. An order that ends drops out; each still throws its own can and goes in on its own count. */
export interface DoorGate { ops: DoorOp[]; go: boolean; openT: number }
/** a charge on a door, waiting for Sam's trigger */
export interface SetCharge { door: Door; side: 1 | -1; t: number; by: string }

/** a point in a door's frame: `a` metres along hinge → latch, `b` out from the frame line on face `side` (orders.ts sideOf's sign) */
export function doorPt(d: Door, a: number, b: number, side: 1 | -1, y = 0): Vec3 {
  const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th), H = d.def.hinge;
  return [H[0] + ux * a - uz * side * b, y, H[1] + uz * a + ux * side * b];
}
export const alongOf = (d: Door, p: Vec3) => { const th = d.def.closedDir; return (p[0] - d.def.hinge[0]) * Math.cos(th) + (p[2] - d.def.hinge[1]) * Math.sin(th); };
/** metres off the frame line on face `side` (negative: the other face) */
export const offOf = (d: Door, p: Vec3, side: 1 | -1) => { const th = d.def.closedDir; return (Math.cos(th) * (p[2] - d.def.hinge[1]) - Math.sin(th) * (p[0] - d.def.hinge[0])) * side; };
const isOpen = (d: Door) => !d.latched && Math.abs(d.angle) >= 0.6;
const N4: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
/** is most of a room's floor under the sky (asked once per room, of every cell or about 64 of them: a line straight up from head height that meets nothing) */
const SKY = new SideMap<object, { n: number; open: boolean }>('doortools.SKY');
function underSky(g: Game, room: { cells: Set<number> }): boolean {
  const hit = SKY.get(room); if (hit && hit.n === room.cells.size) return hit.open;
  const nav = g.col.nav, cs = nav.cell, every = Math.max(1, Math.floor(room.cells.size / 64)); let k = 0, of = 0, sky = 0;
  for (const ci of room.cells) { if (k++ % every) continue; const x = (ci % nav.W + 0.5) * cs, z = (((ci / nav.W) | 0) + 0.5) * cs; of++; if (!g.col.solidBlocked([x, 2.0, z], [x, 9, z])) sky++; }
  const open = sky * 2 > of; SKY.set(room, { n: room.cells.size, open }); return open;
}
/** OPEN FLOOR, NOT A ROOM: a flood past `searchCells`, or (DOORTOOLS.openAir) floor under the sky. An entry onto it is the fixed sweep alone. */
export function openFloor(g: Game, room: { cells: Set<number> }): boolean { return room.cells.size > DOORTOOLS.searchCells || (DOORTOOLS.openAir && underSky(g, room)); }

export class DoorTools {
  readonly knobs = DOORTOOLS;
  charges = DOORTOOLS.charges; bangs = DOORTOOLS.bangs; /** the squad's fragmentation grenades (frag.ts FRAG.squad) */ frags = FRAG.squad; private fragNext = false; private bigNext = false; private bigRow: boolean | undefined = undefined;
  ops: DoorOp[] = [];
  /** the last few orders that have ended, newest last (the probes and the console read their beats) */
  done: (DoorOp & { ended: string })[] = [];
  set: SetCharge[] = [];
  /** doors whose set charges go on ONE press of the trigger (a scenario's: rescue.ts links its room's two doors; not touched by reset()) */
  linked: Door[] = [];
  /** a scenario's own switch for the weapon lights of men going in (rescue.ts: its 'team weapon lights' row) — null: the night breach's (not touched by reset()) */
  lights: boolean | null = null;
  log: { t: number; what: string }[] = [];
  stats = { orders: 0, opened: 0, kicks: 0, shot: 0, picks: 0, noBoot: 0, handKept: 0, tested: 0, halted: 0, bangs: 0, ownFlashed: 0, frags: 0, blown: 0, knocked: 0, stunned: 0, backblast: 0, entries: 0, words: 0, steppedBack: 0, podsMoved: 0, sectors: 0,
    /** DOORTOOLS.buddy's counts: men sent on to a point by a room's search or up to a far door, in all · of them (the switch OFF) away from everybody BY
     *  THEMSELVES — by the search (the walks the switch takes away), and `doorAlone` to a far door (the walks `buddyDoors` would) · (ON) partners sent with a man · deals where somebody was refused every point he could have had */
    sentOn: 0, sentAlone: 0, doorAlone: 0, sentPair: 0, notSent: 0, /** flowOn: walks INTO a part of a room nobody had been in (each also counted in sentOn / sentPair) */ flowed: 0, /** …and men sent up behind the front so that it could go on */ closedUp: 0, /** …and entries still at work past `searchCap` on the time the rule gives them */ flowLate: 0 };
  private roster: Guard[] = [];
  /** what floor each teammate's own eyes have been over, and when (floorseen.ts) — kept while `leadSeen` is on, or `seenWatch` asks for it (a probe counting
   *  what the rule WOULD have picked with it off); null until first wanted · entries begun, and how many of them the most-seen man led instead of the lead */
  seen: FloorSeen | null = null; seenWatch = false; led = { entries: 0, bySeen: 0 };
  /** the key the word's row was last registered with ('' = on a digit, null = no such row: the pair; undefined = not dealt for this cast yet) */
  private goKey: string | null | undefined = undefined;
  private words: Word[] = [];
  /** when the word was last given on Sam's key (input()) */
  private wordKeyT = -1e9;
  /** the key the word's row on a held threshold's page was dealt (sync(): undefined = not dealt for this cast yet) */
  private thrKey: string | undefined = undefined;
  private thrSig = -1;
  private thrSigNow(): number { const K = DOORTOOLS; return (K.thrHoldFirst ? 1 : 0) | (K.thrBangFirst ? 2 : 0) | (K.thrOutsideRow ? 4 : 0) | (K.outsidePlain ? 8 : 0); }

  constructor(private g: Game) {
    const S = g.orders, K = DOORTOOLS;
    const stackable = (t: OrderTarget, men: Guard[]) => this.stackable(t, men);
    S.register({ id: TOOLS_PAGE, label: 'door tools', targets: ['door'], opens: TOOLS_PAGE, issue: () => { } });   // the row (5) that turns a door's menu to the page of them
    // the two entry rows are worded by what the team KNOWS of the door (DOORTOOLS.testDoor: 'kick and clear · wedged from inside' once a man has tried it) and,
    // while the men they go to hold that door from outside (DOORTOOLS.outsidePlain), are the second order that sends them in — with no can, or with one
    const held = (t: OrderTarget) => this.heldPlain(t, S.recipients(t));
    const known = (t: OrderTarget) => t.kind === 'door' && this.entryVerb(t) !== 'open' ? ` · ${this.shutWhy(t.door)}` : '';
    S.register({ id: 'openClear', page: TOOLS_PAGE, label: t => held(t) ? 'go in and clear · no bang' : `${this.entryVerb(t)} and clear${known(t)}`, targets: ['door'], ack: ['on it.', 'moving.'], onWord: true,
      only: (_S, men, t) => this.heldPlain(t, men) ? this.heldMen(men, t) : men,
      valid: (_S, t, men) => this.heldPlain(t, men) ? this.canThresholdThen('step', t, men) : stackable(t, men),
      issue: (_S, men, t, o) => this.heldPlain(t, men) ? (o?.onWord ? this.thenOnWord('step', men, t) : this.thresholdThen('step', men, t)) : this.issue('openClear', men, t, !!o?.onWord) });
    S.register({ id: 'bangClear', page: TOOLS_PAGE, label: t => held(t) ? `bang, then go in · ${this.bangs} left` : `${this.entryVerb(t) === 'open' ? 'bang' : `${this.entryVerb(t)}, bang`} and clear · ${this.bangs} left`, targets: ['door'], ack: ['bang and clear.', 'copy, banging it.'], onWord: true,
      only: (_S, men, t) => this.heldPlain(t, men) ? this.heldMen(men, t) : men,
      valid: (_S, t, men) => { if (this.heldPlain(t, men)) return this.canThresholdThen('bang', t, men);
        if (this.bangs <= 0) return 'no bangs left.';
        const who = t.kind === 'door' ? this.canBehind(t.door, t.side, men) : null; if (who) return who === 'you' ? wg("you're behind that door.", 'you are behind that door.') : `${who} is behind that door.`;   // (the squad of four: nobody bangs a room his own men stand in — nor, behindSam, the one Sam stands in)
        return stackable(t, men); },
      issue: (_S, men, t, o) => this.heldPlain(t, men) ? (o?.onWord ? this.thenOnWord('bang', men, t) : this.thresholdThen('bang', men, t)) : this.issue('bangClear', men, t, !!o?.onWord) });
    S.register({ id: 'charge', page: TOOLS_PAGE, label: t => t.kind === 'door' && this.looseOn(t) ? 'stand off · in behind the charge' : t.kind === 'door' && this.chargeOn(t.door) ? `blow the charge${OWNCHARGE.on ? this.closeWords(this.chargeOn(t.door)!) : ''}` : `breach with a charge · ${this.charges} left`, targets: ['door'], ack: ['copy.', 'on it.'],
      gone: (_S, t) => t.kind === 'door' && !!t.door.def.steel && !this.chargeOn(t.door),   // (orders.ts OrderDef.gone: a steel door takes no charge — the flat ring does not offer one)
      valid: (_S, t, men) => {
        if (t.kind !== 'door') return false;
        if (this.looseOn(t)) return this.standoffFits(men, t, true);   // (owncharge.ts: a charge the player set by hand, from its own face: they stand off on it)
        if (this.chargeOn(t.door)) return true;
        if (t.door.def.steel) return "steel. a charge won't cut it.";
        if (isOpen(t.door)) return "it's open.";
        if (this.charges <= 0) return 'no charges left.';
        if (this.ops.some(o => o.kind === 'charge' && o.door === t.door && o.phase === 'place')) return 'already on it.';
        return this.standoffFits(men, t);
      },
      issue: (_S, men, t) => { if (t.kind !== 'door') return 'no door'; if (this.looseOn(t)) return this.startCharge(men, t, true); const c = this.chargeOn(t.door); if (c) { this.trigger(c); return; } return this.startCharge(men, t); } });
    // THE ROOM WORKED FROM OUTSIDE: row 4 of the tools turns to a page of its own (the one-press entries above keep their digits). The threshold's two
    // orders — given to HOLD first: the nearer press — and 'clear from outside', which had this row
    // (DOORTOOLS.outsidePlain: no page — row 4 IS the one order, 'clear from outside'; thrRows deals whichever of the two the switch asks for)
    // frag and clear (frag.ts): the page's digits are all taken (1‥4, and 5 is the word's with the four), so its row is on a key of its own — G, with this page up —
    // at the foot of the page: the four rows above it keep their places and digits
    S.register({ id: 'fragClear', page: TOOLS_PAGE, hotKey: FRAG.orderKey, pageOnly: true, label: () => `frag and clear · ${this.frags} left`, targets: ['door'], ack: ['frag and clear.', 'copy, fragging it.'], onWord: true,
      valid: (_S, t, men) => { if (!FRAG.on) return 'no frags in this kit.'; if (this.frags <= 0) return 'no frags left.';
        if (g.rescue?.hostages.some(h => h.state !== 'dead')) return 'not with hostages on the floor.';   // (a frag spares nobody: with hostages anywhere on the floor it stays on the belt — said whether or not they are behind THIS door, so the row gives nothing away)
        const mate = t.kind === 'door' ? this.fragBehind(t.door, t.side, men) : null; if (mate) return mate === 'you' ? wg("you're behind that door.", 'you are behind that door.') : `${mate} is behind that door.`;
        return stackable(t, men); },
      issue: (_S, men, t, o) => { this.fragNext = true; try { return this.issue('bangClear', men, t, !!o?.onWord); } finally { this.fragNext = false; } } });
    // A THRESHOLD HELD ON THE DOOR (by men the menu's orders go to): row 5 of the door's own menu is WHAT NEXT, standing in for the tools' row for as long
    // as the jambs are held — step in, bang and step in, leave it (thresholdThen), to the men holding; the word's own row is dealt in sync(), with its key
    S.register({ id: HELD_PAGE, label: 'threshold held', targets: ['door'], opens: HELD_PAGE, standsIn: { for: TOOLS_PAGE, when: (_S, t, men) => { if (DOORTOOLS.outsidePlain) return false; const ops = this.heldOn(t, men); return ops.length > 0 && (!DOORTOOLS.thrHeldAll || men.every(m => m.state === 'dead' || ops.some(op => op.men.includes(m)))); } }, issue: () => { } });
    this.thrRows();
    S.notes.push(() => this.hudNotes(), () => this.wordNote());
  }

  /** The rows of the threshold's page and of a held threshold's, registered in the order the menu's switches give them (DOORTOOLS.thrHoldFirst / thrBangFirst /
   *  thrOutsideRow — a page's digits are dealt from 1 as its rows are registered): at the start, and again from sync() whenever one of the three has moved. */
  private thrRows() {
    const S = this.g.orders, K = DOORTOOLS; this.thrSig = this.thrSigNow();
    for (const id of ['thresholdHold', 'threshold', 'outside', 'thrStep', 'thrBang', 'thrLeave', THR_PAGE]) S.unregister(id);
    if (K.outsidePlain) {
      // ONE ORDER, NO PAGE (the maintainer, 10-11: "it should just clear externally w/o the additional orders of what to do after … one level of external
      // clearance and then you have to give a second order for them to go in"): row 4 of the door's tools holds the door from outside until told; going in
      // is this page's own rows 1 and 2 while they hold it (the constructor's rows), F is still the word, and 'fall in' / 'stack up' take them off it
      S.register({ id: 'thresholdHold', page: TOOLS_PAGE, label: t => this.heldPlain(t, S.recipients(t)) ? 'clear from outside · holding it' : 'clear from outside', targets: ['door'], ack: ['on the jambs. your call after.', 'copy, holding it for you.'], ackNow: ['on the jambs. your call.', 'copy, holding it for you.'], onWord: true,
        valid: (_S, t, men) => this.heldPlain(t, men) ? 'already holding it.' : this.canThreshold(t, men), issue: (_S, men, t, o) => this.thresholdHold(men, t, !!o?.onWord) }, 'fragClear');
      this.thrKey = undefined; return;
    }
    S.register({ id: THR_PAGE, page: TOOLS_PAGE, label: 'work it from the threshold', targets: ['door'], opens: THR_PAGE, issue: () => { } }, 'fragClear');
    const hold = () => S.register({ id: 'thresholdHold', page: THR_PAGE, label: 'hold the door until I say', targets: ['door'], ack: ['on the jambs. your call after.', 'copy, holding it for you.'], ackNow: ['on the jambs. your call.', 'copy, holding it for you.'], onWord: true,
      valid: (_S, t, men) => this.canThreshold(t, men), issue: (_S, men, t, o) => this.thresholdHold(men, t, !!o?.onWord) });
    const step = () => S.register({ id: 'threshold', page: THR_PAGE, label: 'step in once it goes quiet', targets: ['door'], ack: ['on the jambs, then in.', 'copy, working it.'], onWord: true,
      valid: (_S, t, men) => this.canThreshold(t, men), issue: (_S, men, t, o) => this.threshold(men, t, !!o?.onWord) });
    if (K.thrHoldFirst) { hold(); step(); } else { step(); hold(); }
    if (K.thrOutsideRow) S.register({ id: 'outside', page: THR_PAGE, label: 'clear from outside', targets: ['door'], ack: ['working it from here.', 'slicing it.'], onWord: true,
      valid: (_S, t, men) => this.stackable(t, men), issue: (_S, men, t, o) => this.issue('outside', men, t, !!o?.onWord) });
    const then = (id: string, what: 'step' | 'bang' | 'leave', label: OrderDef['label']) => S.register({ id, page: HELD_PAGE, label, targets: ['door'],
      only: (_S, men, t) => this.heldMen(men, t), valid: (_S, t, men) => this.canThresholdThen(what, t, men), issue: (_S, men, t) => this.thresholdThen(what, men, t) });   // (the lead says it: no second voice)
    const plain = () => then('thrStep', 'step', K.thrBangFirst ? 'step in · no bang' : 'step in'), bang = () => then('thrBang', 'bang', () => `bang, then step in · ${this.bangs} left`);
    if (K.thrBangFirst) { bang(); plain(); } else { plain(); bang(); }
    then('thrLeave', 'leave', () => DOORTOOLS.thrLeaveFallIn ? 'leave it · fall in' : 'leave it');
    this.thrKey = undefined;   // (the word's own row is dealt again behind them: sync)
  }

  // ------------------------------------------------------------ counts
  /** spend one (false: none left) */
  take(what: 'charge' | 'bang' | 'frag'): boolean {
    this.sync();
    if (what === 'frag') { if (this.frags <= 0) return false; this.frags--; this.note(`frag spent · ${this.frags} left`); return true; }
    if (what === 'charge') { if (this.charges <= 0) return false; this.charges--; } else { if (this.bangs <= 0) return false; this.bangs--; }
    this.note(`${what} spent · ${this.charges} charges ${this.bangs} bangs left`); return true;
  }
  /** one back in the bag (an order that reserved it and never used it; a charge off a door that came open) */
  refund(what: 'charge' | 'bang' | 'frag') { if (what === 'frag') { this.frags++; this.note(`frag back · ${this.frags} left`); return; } if (what === 'charge') this.charges++; else this.bangs++; this.note(`${what} back · ${this.charges} charges ${this.bangs} bangs left`); }
  /** a new cast (a staging, a restart) is a fresh run — checked wherever an order or a count can come in, not only once a frame */
  sync() {
    const g = this.g; let i = 0, same = true; for (const gd of g.guards) if (g.orders.mine(gd) && this.roster[i++] !== gd) same = false;
    if (!same || i !== this.roster.length) { this.roster = g.orders.squad(); this.reset(); this.goKey = this.thrKey = undefined; this.bigRow = undefined; }
    // (A MAN ALONE — owncharge.ts: with no cast the roster never changes and no restart comes through reset(). A fresh Player is his new run, the wall
    // charge's own rule: a charge he left on a door goes with the old run, and what his hands spent is back in the bag. kit.ts kitAlone, where his card is
    // put on him, then writes the card's count over it)
    if (this.samOf !== g.player) { const first = !this.samOf; this.samOf = g.player; if (!first && OWNCHARGE.on && !this.roster.length) { this.set = []; this.charges += this.samSpent; } if (!first) this.samSpent = 0; }
    const goKey = this.roster.length > 2 ? (DOORTOOLS.wordOnKey ? DOORTOOLS.blowKey : '') : null;
    // … and under DOORTOOLS.wordSmall one or two teammates have the word too, for a plain stack only: the same order id, on the word's key, on no menu
    // (their menus are as they were: with no menu up the key gives it — input() below)
    const small = DOORTOOLS.wordSmall && this.roster.length > 0 && this.roster.length <= 2, goSig = small ? 'small' : goKey;
    if (small && goSig !== this.goKey) { this.goKey = goSig;
      g.orders.register({ id: 'go', head: WORD_HEAD, hotKey: DOORTOOLS.blowKey, label: t => { const w = this.stackWords(g.orders.recipients(t)); return w ? `go · ${w}` : 'go'; }, targets: ['floor', 'door', 'none'], listed: [], ack: ['going.', 'moving.'],
        only: (_S, men) => { const on = new Set<Guard>(); for (const x of this.stackWaits(men)) for (const m of x.men) on.add(m); const h = this.fragHeld(men); return men.filter(m => on.has(m) || h.some(o => o.men.includes(m))); },
        valid: (_S, _t, men) => this.stackWaits(men).length > 0 || this.fragHeld(men).length > 0 || 'nobody waiting.', issue: (_S, men) => this.goMen(men, this.stackWaits(men)) ?? undefined }); }
    else if (!small && goKey !== this.goKey) { this.goKey = goKey;   // (a new cast — or the word's key knob flipped: the row is dealt its key when it is registered)
      // THE WORD is an order of its own for the squad of four (the pair alone has no second door to wait on: its menu is as it was)
      // (the word is not about what the menu was opened on: its row sits under a header of its own and names who would take it. Its key is Sam's own — input()
      // below gives it, menu or no menu — so the row shows that key and has no digit; it is not LISTED on a door's menu, where that key is 'wait for my word')
      if (goKey !== null) g.orders.register({ id: 'go', head: WORD_HEAD, hotKey: goKey || undefined, label: t => { const w = this.waitingWords(g.orders.recipients(t)); return w ? `go · ${w}` : 'go'; }, targets: ['floor', 'door', 'none'], listed: ['floor', 'none'], ack: ['going.', 'moving.'],
        only: (_S, men) => { const w = this.waitingMen(men); if (w.length) return w; const h = this.fragHeld(men); return men.filter(m => h.some(o => o.men.includes(m))); },   // (a man with nothing waiting — on the F drill, say — is not this order's: his drill is not asked to let go of him)
        valid: (_S, _t, men) => this.waitingAny(men).length > 0 || this.fragHeld(men).length > 0 || 'nobody waiting.', issue: (_S, men) => { this.goMen(men); } });
      else g.orders.unregister('go'); }
    // … and on the page of a HELD THRESHOLD the word has a row for the pair too — on the key that is its word there (the four's row above is not listed on
    // a door's menu). The pair's: the blind pockets banged, then the step in (pairWord). The four's is its one word — everything of theirs that waits on
    // it goes (goMen), so the row names who, as the 'go' row does. Dealt its key when it is registered: again when the knob moves
    if (this.thrSig !== this.thrSigNow()) { this.thrRows(); this.bigRow = undefined; }   // (a menu switch moved: the pages' rows dealt their digits again — and the big slot's row, which stands after them, put back in its place)
    // THE BIG SLOT'S OWN ROW (kit.ts BIGSLOT.shut, bigkit.ts): while a man of the squad carries the hammer or the breaching shotgun, a door's tools have a
    // row that opens it WITH the tool — locked or not, from beside the frame — and goes in. The page's digits are taken, so it is on a key of its own (H),
    // which the row that opens the page shows and which works from the door's first page too: X, H.
    { const big = BIGSLOT.on && BIGSLOT.shut && this.roster.some(m => carriesHammer(m) || (m.state !== 'dead' && kitBig(m) === 'shotgun'));
      if (big !== this.bigRow) { this.bigRow = big; g.orders.unregister(BIG_ORDER);
        if (big) g.orders.register({ id: BIG_ORDER, page: TOOLS_PAGE, hotKey: BIG_KEY, label: t => `${this.bigWord(t, g.orders.recipients(t))} and clear`, targets: ['door'], ack: ['on it.', 'breaching.'], onWord: true,
          gone: (_S, t) => t.kind === 'door' && (isOpen(t.door) || !!t.door.def.steel),   // (orders.ts OrderDef.gone: nothing to breach, or no way through — the flat ring does not offer it)
          valid: (_S, t, men) => { if (t.kind !== 'door') return false; if (isOpen(t.door)) return "it's open."; if (t.door.def.steel) return 'steel. no way through.';
            if (!men.some(m => carriesHammer(m) || (SHOTGUN.on && m.state !== 'dead' && kitBig(m) === 'shotgun'))) return 'nobody here carries one.';
            if (SILENT.kicks && !SILENT.toolsLoud && squadSilent(g) && !silentUrgent(g)) return wg("not while we're silent.", 'not while we are silent.');   // (with SILENT.toolsLoud the row is one of silent.ts LOUD_ROWS: marked LOUD, and picking it is the squad going loud)
            // (a wedge is nothing the menu reads before a hand has tried the door: only the shotgun to hand and a wedge nobody knows of, the row stands and the lead's hand finds it — haltAt)
            if (t.door.locked && t.door.lockId.startsWith('wedge:') && !men.some(m => carriesHammer(m)) && (!DOORTOOLS.testDoor || this.knownShut(t.door, t.side))) return wg("it's wedged. a shell won't open it.", 'wedged. no shell shifts it.');
            return this.stackable(t, men); },
          issue: (_S, men, t, o) => { this.bigNext = true; try { return this.issue('openClear', men, t, !!o?.onWord); } finally { this.bigNext = false; } } }, 'fragClear'); } }
    const S = g.orders, thrKey = goKey === null ? DOORTOOLS.blowKey : goKey;
    if (thrKey !== this.thrKey) { this.thrKey = thrKey;
      S.register({ id: 'thrWord', page: HELD_PAGE, head: WORD_HEAD, hotKey: thrKey || undefined, targets: ['door'],
        label: t => { if (!S.big) return silentNoCans(g) || this.wordQuiet() ? 'go · step in · no bang' : 'go · bang the blind pockets, step in'; const w = this.waitingWords(S.recipients(t)); return w ? `go · ${w}` : 'go'; },
        only: (_S, men, t) => S.big ? this.waitingMen(men) : this.heldMen(men, t),
        valid: (_S, t, men) => this.heldOn(t, men).some(op => !op.word) || wg("nobody's holding that door.", 'nobody is holding that door.'),
        issue: (_S, men) => (S.big ? this.goMen(men) : this.pairWord(men) ? null : 'nobody\'s waiting for you to say go.') ?? undefined }); }
  }
  /** a fresh run: the counts back, nothing set, nothing under way (a can already in the air goes off on its own short fuse) */
  reset() {
    for (const op of this.ops) { this.defuse(op); this.offLock(op); }
    this.ops = []; this.done = []; this.set = []; this.words = []; this.held.clear(); this.watches = []; this.tried.clear(); this.samSpent = 0; this.charges = DOORTOOLS.charges; this.bangs = DOORTOOLS.bangs; this.frags = FRAG.squad; this.log = [];
    for (const k of Object.keys(this.stats) as (keyof DoorTools['stats'])[]) this.stats[k] = 0;
    this.seen = null; this.led = { entries: 0, bySeen: 0 };
  }
  /** NOBODY CAME WITH HIM (kit.ts kitAlone, owncharge.ts): the count is his card's — nothing set, nothing spent. Nothing with a teammate on the floor. */
  alone(n: number) { this.sync(); if (this.roster.length) return; this.set = []; this.samSpent = 0; this.charges = Math.max(0, Math.floor(n)); }
  /** the player whose run this is, and what his own hands have taken from the bag in it (sync: a man alone gets it back with a fresh run) */
  private samOf: object | null = null;
  samSpent = 0;
  /** a checkpoint's charge back on its door (savestate.ts, a man alone): as he set it, nothing taken from the count the file wrote */
  setBack(d: Door, side: 1 | -1) { if (d.off || this.chargeOn(d)) return; this.set.push({ door: d, side, t: this.g.time, by: SAM_BY }); }
  chargeOn(d: Door): SetCharge | null { return this.set.find(c => c.door === d) ?? null; }
  /** can these men stack on that face of that door (the entry orders' menu test: floor at a jamb, a way there for each, not steel and locked) */
  private stackable(t: OrderTarget, men: Guard[]): true | string | false {
    if (t.kind !== 'door') return false; const S = this.g.orders;
    const posts = this.dealStack(t.door, t.side, men)?.posts; if (!posts) return S.noRoomWords('no room on that door.', () => this.dealStack(t.door, t.side, men)?.posts);   // (orders.ts ORDERS.inWay: … or that it is Sam who is in the way, where it is)
    for (const [gd, p] of S.pair(men, posts.map(x => x.pos), posts.map(x => x.group ?? 0), t.door.frameCentre)) { const w = S.reach(gd, p); if (w) return w; }   // (the very deal start() makes)
    if (DOORTOOLS.testDoor && !this.knownShut(t.door, t.side)) return true;   // (nobody has tried it: the row is given, and the man at the handle says what he finds — the menu does not read a lock for him)
    if (t.door.def.steel && !isOpen(t.door) && this.lockedOut(t.door, t.side)) return 'steel, and locked.';
    if (this.frameHeld(t.door, t.side) && !this.pickable(t.door) && !this.bigOpens(t.door, men)) return this.noBoot(t.door);   // (it opens toward them and no pick opens it: every entry order would end at the door — doors.ts DOORWAY.frameHolds)
    return true;
  }
  /** is the door locked against the team from that face (Sam's ring and the codes he knows are the team's — orders.ts route) */
  private lockedOut(d: Door, side: 1 | -1): boolean {
    return this.g.doors.lockedOut(d, doorPt(d, d.def.width / 2, 0.6, side), this.g.orders.ring());
  }
  /** LOCKED AGAINST THE TEAM ON THE FACE IT OPENS TOWARD (doors.ts DOORWAY.frameHolds — bootHolds): shut in its frame, which a boot from here only drives it
   *  onto. Not steel (that has its own answer). The team's ways through are the lock picked — a cylinder (pickable) — or a charge. */
  private frameHeld(d: Door, side: 1 | -1): boolean { return !d.def.steel && !isOpen(d) && this.lockedOut(d, side) && this.g.doors.bootHolds(d, doorPt(d, d.def.width / 2, 0.6, side)); }
  /** …and what a man says to an entry order there when no pick opens it (a keypad's bolt): the charge — the one already on that door, one from the bag, or
   *  (the kit may carry none) neither */
  private noBoot(d: Door): string { return this.chargeOn(d) ? 'opens toward us. no boot. blow the charge.' : this.charges > 0 ? 'opens toward us. no boot. charge it.' : 'opens toward us. no boot, no charge.'; }
  /** open()'s answer at a door whose frame holds a boot: no pick opens it → refused aloud, the order ended as on steel; a cylinder → picked, loud squad or not.
   *  false: neither — a silent squad with its picks switched off, which gets silent.ts's own answer from open() (it never boots, and the pick is not its to use) */
  private frameAnswer(op: DoorOp): boolean {
    const g = this.g, d = op.door, lead = op.lead;
    if (!this.pickable(d)) { this.stats.noBoot++; g.say(lead, this.noBoot(d)); this.end(op, 'opens toward us · no boot'); return true; }
    if (silentNoBoot(g)) return false;
    this.toPick(op); this.beat(op, 'opens toward us: pick'); g.say(lead, 'locked, and it opens toward us. picking it.'); return true;
  }
  /** this order's door will take the boot (shut, locked against the team, not steel) — or, where its frame holds a boot, the pick: the lock a shared gate
   *  waits on either way. One that nothing of an entry order's opens (frameHeld, no cylinder) is refused at the door, and nobody waits for it. */
  private willKick(op: DoorOp): boolean { if (isOpen(op.door) || op.door.def.steel) return false;
    if (op.big && BIGSLOT.shut && !op.noGun && this.bigOpens(op.door, op.men)) return true;   // (the big slot's own row: the tool has the door whether it is locked or not)
    return this.lockedOut(op.door, op.side) && (!this.frameHeld(op.door, op.side) || this.pickable(op.door) || this.bigOpens(op.door, op.men)); }
  /** one of these men carries a big-slot tool that takes this door's lock from either face (kit.ts BIGSLOT, bigkit.ts — never with that switch off): the
   *  hammer, or the breaching shotgun where the lock is one a shell takes (not a wedge). What a door locked on the face it opens toward is NOT refused for — never for a silent squad, which
   *  keeps to the pick. */
  private bigOpens(d: Door, men: Guard[]): boolean { const g = this.g; return BIGSLOT.on && !d.def.steel && !(SILENT.kicks && squadSilent(g) && !silentUrgent(g)) /* (silent.ts silentNoBoot's own question, uncounted: a silent squad's loud tools stay slung) */ && men.some(m => carriesHammer(m) || (SHOTGUN.on && m.state !== 'dead' && kitBig(m) === 'shotgun' && !d.lockId.startsWith('wedge:'))); }
  /** the tool the big slot's row names for these men on that door: the shotgun where one of them carries it and a shell takes this door (not a known
   *  wedge), else the hammer — toGun's own order */
  private bigWord(t: OrderTarget, men: Guard[]): 'shotgun' | 'hammer' {
    const wedged = t.kind === 'door' && t.door.locked && t.door.lockId.startsWith('wedge:') && (!DOORTOOLS.testDoor || this.knownShut(t.door, t.side));
    return SHOTGUN.on && !wedged && men.some(m => m.state !== 'dead' && kitBig(m) === 'shotgun') ? 'shotgun' : 'hammer'; }
  /** where the lead boots a door from: beside its latch jamb where the floor allows and no pane stands behind him (DOORWAY.sideKick, kickGlass — he is out of the opening as the leaf goes), else
   *  square to the leaf by the lock, as it always was */
  private bootSpot(d: Door, side: 1 | -1): { pos: Vec3; yaw: number } {
    const g = this.g, sq = g.doors.kickSpot(d, doorPt(d, d.def.width - 0.25, 1, side));
    if (!DOORWAY.sideKick) return sq;
    const s = g.doors.kickSpotSide(d, sq.pos);
    if (g.col.nav.isBlocked(s.pos[0], s.pos[2]) || g.col.solidBlocked([sq.pos[0], 0.5, sq.pos[2]], [s.pos[0], 0.5, s.pos[2]])) return sq;
    if (!DOORWAY.kickGlass || GLASSPEN.stackEyes <= 0 || g.col.nav.isBlocked(sq.pos[0], sq.pos[2])) return s;
    // a pane beside the latch jamb is no wall to kick from behind: from the front, as it was — where clearly fewer of the lines through glass reach him there
    // (two spots a few lines apart are the same spot, as for the stack's hands; asked afresh, so the answer is the place's and not an earlier asker's a hand's breadth off)
    const n = g.orders.glassEyes(d, side, s.pos, false);
    return n >= GLASSPEN.stackEyes && g.orders.glassEyes(d, side, sq.pos, false) <= GLASSPEN.stackLeastK * n ? sq : s;
  }
  // ------------------------------------------------------------ what the team knows of a door (DOORTOOLS.testDoor)
  /** shut doors the team KNOWS are locked against it — one of its men tried the handle, or the player stood at its lock's rows — and the ones tried and found
   *  free (so nobody says it twice). The roster's: a fresh cast knows nothing (reset). */
  private tried = new Map<Door, number>();   // (PER FACE: bits 1 / 2 = known shut from side +1 / −1, 4 / 8 = tried and found free from there — a keyed door is locked from one face only, and the player's prompts at one face say nothing of the other)
  private knows(d: Door, side: 1 | -1, free: boolean): boolean { return ((this.tried.get(d) ?? 0) & ((side > 0 ? 1 : 2) << (free ? 2 : 0))) !== 0; }
  private learn(d: Door, side: 1 | -1, free: boolean | null) { const b = side > 0 ? 1 : 2, was = (this.tried.get(d) ?? 0) & ~(b | b << 2); this.tried.set(d, free === null ? was : was | b << (free ? 2 : 0)); }
  /** why a hand does not open it, in a man's words */
  private shutWhy(d: Door): string { return d.def.steel ? 'steel, and locked' : this.pickable(d) ? 'locked' : d.lockId.startsWith('wedge:') ? 'wedged from inside' : 'keypad lock, no code'; }
  /** does the team know this door is locked against it on that face (a door since opened, unlocked or broken is no longer that door) */
  knownShut(d: Door, side: 1 | -1): boolean {
    if (!this.knows(d, side, false)) return false;
    if (isOpen(d) || d.off || !this.lockedOut(d, side)) { this.learn(d, side, null); return false; }
    return true;
  }
  /** ORDERS.walkTries asks it of a door a walk would be refused for: nobody of the team has tried that face of it, and (testDoor) a door is learnt at its
   *  handle — false with testDoor off, where what the team knows is not kept and the walk is refused as it was */
  untried(d: Door, side: 1 | -1): boolean { return DOORTOOLS.testDoor && !this.knownShut(d, side); }
  /** THE HANDLE TRIED by a man at the jamb: the team knows from here on, and (`say`) he says what he found — once a door for as long as it stays so. A locked
   *  one works in its frame (a handle's small noise, the player's own 'try the handle'; a silent squad's hand is lighter). true: locked against the team. */
  private test(d: Door, side: 1 | -1, gd: Guard, say: boolean): boolean {
    const g = this.g; if (isOpen(d) || d.off) return false;
    const out = this.lockedOut(d, side);
    if (this.knows(d, side, !out)) return out;
    this.learn(d, side, !out); if (out) g.doors.rattle(d, gd.char.id, squadSilent(g) ? 0.06 : 0.12);
    this.stats.tested++; this.note(`${gd.callsign} tried ${d.def.name}: ${out ? this.shutWhy(d) : 'not locked'}`);
    if (say) g.say(gd, out ? `${this.shutWhy(d)}.` : "it's not locked.");
    return out;
  }
  /** a man of the stack on that door stood, at the orders' last tick, on his mark with a man in his sight whom hold fire holds (orders.ts `heldFire`). Not a man
   *  down, off his order (the fight has him: his stamp is from before it took him) or no longer counted arrived — a stamp nobody refreshes holds no hand. Never
   *  true with HOLDFIRE.on off. */
  private stackHeld(d: Door): boolean { const S = this.g.orders; return this.roster.some(m => { if (m.state === 'dead') return false; const B = S.of(m); return !!B && B.order === 'stack' && B.door === d && !!B.heldFire && B.arrived && B.yieldT < 0; }); }
  /** once a frame: a man who has come to the jamb on a plain 'stack up' tries the door (Ready or Not's stack), and a door whose lock rows the player stands at
   *  is known to the team too — what he can read off his own prompts he does not need telling */
  private testStacks() {
    const g = this.g, S = g.orders;
    for (const gd of this.roster) { if (gd.state === 'dead') continue; const A = S.of(gd);
      if (!A || A.order !== 'stack' || !A.door || !A.arrived || A.stance !== 'stack' || !A.post || flat(gd.char.pos, A.post) > 0.6) continue;
      if (HOLDFIRE.stackSet && (holdFireOnMan(g, gd) || (HOLDFIRE.stackWait && this.stackHeld(A.door)))) continue;   // (HOLDFIRE.stackSet, off: the handle is tried as before the key; stackWait off: the lead's own fresh answer only. holdfire.ts: stacked with his gun held on a man nobody may shoot yet — no hand goes to the handle, and no handle's noise to that man, until his gun is the door's; false with its switch off. … or the stamp of the orders' last tick says so of ANY man of this stack: the frame his man is lost the fresh answer is 'no' beside last frame's `arrived`, and a rattle is heard by the man the SECOND is held on as well)
      if (A.heldSet) continue;   // (silent.ts SILENT.stackSet: a silent man likewise — read off the answer his `arrived` was counted by, not asked afresh: this runs before the orders' tick, and the frame his man is lost a fresh 'no' beside last frame's `arrived` would put his hand on the handle with his gun still off the door)
      this.test(A.door, sideOf(A.door, gd.char.pos), gd, true); }
    for (const it of g.nearby) if (it.kind === 'door' && it.door && it.inReach && !isOpen(it.door) && (it.verb === 'pick' || it.verb === 'kick' || it.verb === 'rattle' || it.verb === 'nocode' || it.verb === 'code')) this.learn(it.door, sideOf(it.door, g.player.char.pos), false);
  }
  /** THE ORDER HALTS AT A DOOR THAT TURNS OUT SHUT (DOORTOOLS.testDoor): the stack is made, the lead has tried the handle, the team did not know — and what
   *  would come next is the boot or the shotgun, the whole floor told and the men in the frame. He says what he found, the order is over, its men stay
   *  stacked on their marks: the same row again is the order that boots it. true = halted (the op has ended). Not at a door the team knew, one a quiet
   *  hand opens (a silent squad's own answers; a lock picked because the frame holds a boot), an order given by code, a captor's
   *  last warning. */
  private haltAt(op: DoorOp): boolean {
    const g = this.g, d = op.door; if (!DOORTOOLS.testDoor || op.coded || isOpen(d)) return false;
    const knew = this.knownShut(d, op.side), out = this.test(d, op.side, op.lead, false);
    if (!out || knew || this.lastCall(op)) return false;
    if ((squadSilent(g) && SILENT.kicks) || this.frameHeld(d, op.side)) return false;
    const why = this.shutSaid(op.lead, d); this.beat(op, `tried the door · ${why} · halted`);
    this.end(op, 'found shut');
    this.plainStack(op, op.men.filter(m => m.state !== 'dead' && op.post.has(m) && g.orders.of(m) === op.mine.get(m)), ` · ${why}`);
    g.orders.show(op.men);   // (autopilot.ts AUTOPILOT.replan: their own change of plan is drawn for a moment — nothing with the switch off)
    if (DOORTOOLS.haltBack) this.haltBack(op.door, op.side, op.men);
    return true;
  }
  /** … what the man who tried it says of a door found shut, and the count of it: the halt's one line (here, and for a walk that came to the door) */
  private shutSaid(lead: Guard, d: Door): string { const why = this.shutWhy(d); this.stats.halted++; this.g.say(lead, `${why}. holding on it — your call.`); return why; }
  /** A WALK THAT CAME TO A DOOR NOBODY HAD TRIED (ORDERS.walkTries, orders.ts walkStacks: men on a 'move' sent to the door's stack marks, `tries` on
   *  each). Once a frame, for the walkers on one face of one door (one try, whoever's order sent them): when the man on the jamb is on his mark — he down or sent elsewhere, the
   *  first of the rest who is — he tries the handle. Locked against them: the halt of a door order, for a walk — the same line said once, the same
   *  notes in the log ('move <door>: …'), every man of them left the plain stack the halted door order leaves, stepped back from another pair's charge
   *  by the same rule. It turns (he says so, the stack's own "it's not locked."), or the leaf has come open or off on their way: the walk is asked again
   *  for each of them (orders.ts walkOn) — the 'move' he was given, the next untried door, or the refusal a fresh order would get. */
  private walkTried() {
    const g = this.g, S = g.orders, seen = new Set<Assignment>();
    for (const gd of this.roster) { const A = S.of(gd), T = A?.tries; if (!A || !T || seen.has(A) || gd.state === 'dead') continue;
      const d = T.door, men = this.roster.filter(m => { const B = S.of(m), U = B?.tries; return !!B && !!U && m.state !== 'dead' && U.door === d && U.side === T.side; });
      for (const m of men) seen.add(S.of(m)!);
      const on = (m: Guard) => { const B = S.of(m)!; return B.arrived && !!B.post && flat(m.char.pos, B.post) <= 0.6; };
      const lead = men.find(m => S.of(m)!.tries!.post.lead) ?? men.find(on);
      if (isOpen(d) || d.off) { S.walkOn(men); continue; }
      const locked = this.lockedOut(d, T.side), marks = () => new Map(men.map(m => [m, S.of(m)!.tries!.post] as [Guard, StackPost]));
      if (locked && this.knownShut(d, T.side)) {   // (the team has it already — his mates tried it while he was off on a throw, and he is back on the walk he left: he joins the stack, and nothing is said twice)
        S.newGroup(); this.stackLeft(d, marks(), men, ` · ${this.shutWhy(d)}`); if (DOORTOOLS.haltBack) this.haltBack(d, T.side, men); continue; }
      if (!lead || !on(lead)) continue;
      if (!locked) { this.test(d, T.side, lead, true); S.walkOn(men); S.show(men); continue; }
      this.test(d, T.side, lead, false); S.newGroup();   // (a group of their own from here, as an order of their own would be: another order's 'set.' does not wait on them, nor theirs on it)
      const why = this.shutSaid(lead, d); this.note(`move ${d.def.name}: tried the door · ${why} · halted`); this.note(`move ${d.def.name}: end: found shut`);
      this.stackLeft(d, marks(), men, ` · ${why}`);
      S.show(men);   // (autopilot.ts AUTOPILOT.replan, as the door order's halt has it: their own change of plan is drawn for a moment — nothing with the switch off)
      if (DOORTOOLS.haltBack) this.haltBack(d, T.side, men);
    }
  }
  /** … on a door the OTHER pair is charging (DOORTOOLS.haltBack): the men just left stacked on it are inside that charge's backblast, and the step back
   *  a stacked pair is asked for when a charge is ordered (startCharge) was asked before they came. Asked again here, of the same makers, for the halted
   *  men and nobody else, clear of what that order keeps clear — its stand-off marks — so they go to the marks a pair stacked beforehand would have been
   *  sent to, as the door's rear security. Clear, too, of every other mark a teammate has on this door: an entry's stack can put its last man further
   *  down the wall than the makers count as on the door (holders: he is out of the blast and is not asked, as he never was), and his mate is not sent
   *  to stand on him. A teammate's charge left set with its order gone asks it as well. A man with no floor to step back to keeps his mark, his mate
   *  with floor goes; nothing is said by this. */
  private haltBack(d: Door, side: 1 | -1, halted: Guard[]) {
    const S = this.g.orders, ch = this.ops.find(o => o.kind === 'charge' && o.door === d && o.side === side);
    if (!ch && !this.set.some(c => c.door === d && c.side === side && c.by !== SAM_BY)) return;
    const rest = S.men().filter(m => !halted.includes(m)), hold = this.holders(d, side, rest), taken = ch ? [...ch.post.values()].map(P => P.pos) : [];
    for (const m of S.men()) { const A = S.of(m); if (!hold.includes(m) && !ch?.men.includes(m) && A && A.door === d && A.post) taken.push(A.post); }
    const back = this.stepBacks(d, side, rest, taken); if (back) this.makeRoom(d, back);
  }
  /** an order over with its men left a plain stack on the marks they came to the door by — what 'stack up' leaves, for whatever is said next */
  private plainStack(op: DoorOp, left: Guard[], note = '') { this.stackLeft(op.door, op.post, left, note); }
  /** … the same for men with a mark each on that door, whoever dealt it (a door order's own; a walk's — walkTried) */
  private stackLeft(d: Door, post: Map<Guard, Pick<StackPost, 'pos' | 'face' | 'lead' | 'stackSide'>>, left: Guard[], note = '') {
    const S = this.g.orders, name = doorWords(d);
    for (const m of left) { const P = post.get(m)!;
      S.assign(m, { order: 'stack', post: P.pos, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], door: d, shy: d, stance: P.lead ? 'stack' : 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}${note}` }); }
    S.spareRear(left, d, null);
  }
  /** how an entry row on that door begins, by what the team knows of it: opened by hand, booted, picked */
  private entryVerb(t: OrderTarget): 'open' | 'kick' | 'pick' {
    if (!DOORTOOLS.testDoor || t.kind !== 'door' || !this.knownShut(t.door, t.side) || t.door.def.steel) return 'open';
    const pick = this.pickable(t.door);
    if (pick && silentPick(this.g)) return 'pick';
    return this.frameHeld(t.door, t.side) ? (pick ? 'pick' : 'open') : 'kick';
  }
  /** men these rows go to are holding that door from outside (DOORTOOLS.outsidePlain: the page's entry rows are then the order to go in — to the men who
   *  hold it; `thrHeldAll`: only when every one of them does) */
  private heldPlain(t: OrderTarget, men: Guard[]): boolean {
    if (!DOORTOOLS.outsidePlain || t.kind !== 'door') return false; const up = men.filter(m => m.state !== 'dead'); if (!up.length) return false;
    const ops = this.heldOn(t, up); return ops.length > 0 && (!DOORTOOLS.thrHeldAll || up.every(m => ops.some(op => op.men.includes(m))));   // (any of them, as the held page's own rule: the rows then go to the men who hold — `only`)
  }
  private note(what: string) { this.log.push({ t: this.g.time, what }); if (this.log.length > 300) this.log.splice(0, 100); }
  private beat(op: DoorOp, what: string) { op.beats.push({ t: this.g.time, what }); this.note(`${op.kind} ${op.door.def.name}: ${what}`); }

  // ------------------------------------------------------------ orders in
  /** hand a man this op's next assignment (and remember it as ours) */
  private assign(op: DoorOp, gd: Guard, a: Pick<Assignment, 'post' | 'face' | 'going' | 'there'> & Partial<Assignment>) {
    const S = this.g.orders; S.assign(gd, { order: op.kind, door: op.door, shy: op.door, ...a }); op.mine.set(gd, S.of(gd)!);   // (shy: no mark of this module's but a point of domination lies through the door itself)
  }
  private newOp(kind: DoorToolKind, d: Door, side: 1 | -1, men: Guard[], phase: Phase): DoorOp {
    for (const o of [...this.ops]) { o.men = o.men.filter(m => !men.includes(m)); if (!o.men.length) this.end(o, 're-ordered'); }   // (the men are this order's now)
    const op: DoorOp = { kind, door: d, side, men: [...men], lead: men[0], rear: new Set(), from: new Map(men.map(m => [m, [m.char.pos[0], 0, m.char.pos[2]] as Vec3])), phase, t0: this.g.time, bangHeld: false, mine: new Map(), post: new Map(), kick: null, openT: NaN, can: null, tossT: NaN, landT: NaN, bangT: NaN, bangAt: null,
      queue: [], setT: NaN, pod: new Map(), onPod: new Map(), slice: new Map(), crossed: new Map(), corner: new Map(), search: undefined, beats: [], onWord: false, word: null, hold: 0, readyT: NaN, gate: null };
    this.ops.push(op); this.stats.orders++; return op;
  }
  /** the menu's release (OrderDef.issue: a reason when it cannot be done) */
  private issue(kind: DoorToolKind, men: Guard[], t: OrderTarget, onWord = false): string | void { const r = this.start(kind, men, t, onWord); return typeof r === 'string' ? r : undefined; }
  /** A fresh gate (DoorGate): hand it to order() for each door that is to go on the one signal. `go` false = they stack and hold until somebody raises it. */
  together(go = true): DoorGate { return { ops: [], go, openT: NaN }; }
  /** One of the entry orders given by code instead of off the menu (the hostage rescue's F — rescue.ts): the same order, to exactly these men, on that face of
   *  that door; through `gate` when it is to go with other doors'. Returns the order under way, or why not. Nothing is said and orders.ts logs nothing: the
   *  caller words it. */
  order(kind: 'openClear' | 'bangClear' | 'outside' | 'threshold', men: Guard[], door: Door, side: 1 | -1, gate: DoorGate | null = null, hold = false): DoorOp | string {
    men = men.filter(gd => gd.state !== 'dead'); if (!men.length) return 'nobody to take it';
    const t: OrderTarget = { kind: 'door', at: [door.frameCentre[0], 0, door.frameCentre[2]], door, side };
    const ok = this.stackable(t, men); if (ok !== true) return ok || 'no door';   // (what the menu asks before it offers the row)
    silentTool(this.g, kind === 'bangClear');   // (a bang and clear is loud whoever starts it: a silent squad is loud from here — silent.ts)
    const op = this.start(kind, men, t, false, hold);   // (`hold`: the threshold's own — the jambs held until told what next)
    if (typeof op !== 'string') op.coded = true;   // (a scenario's own entry: never halted at a door it finds shut — DOORTOOLS.testDoor is the menu's)
    if (typeof op !== 'string' && gate) { op.gate = gate; gate.ops.push(op); }
    return op;
  }
  /** WORK THE ROOM FROM THE THRESHOLD, as an order's `issue` (orders.ts OrderDef — the THR_PAGE rows 'threshold' and 'thresholdHold'): these men, on that face of that door;
   *  `onWord`: stacked, it waits for Sam's word before the door is touched (the squad of four). A reason when it cannot be done. `canThreshold` is the same
   *  order's `valid`. TWO ORDERS: `threshold` works the room from outside and then steps in by itself (the door quiet for `thrQuiet`); `thresholdHold` works
   *  it and HOLDS the jambs — whoever comes to the door is still shot — until Sam says what next (thresholdThen, or the word). */
  threshold(men: Guard[], t: OrderTarget, onWord = false, hold = false): string | void { const r = this.start('threshold', men, t, onWord, hold); return typeof r === 'string' ? r : undefined; }
  thresholdHold(men: Guard[], t: OrderTarget, onWord = false): string | void { return this.threshold(men, t, onWord, true); }
  canThreshold(t: OrderTarget, men: Guard[]): true | string | false { return this.stackable(t, men); }
  /** … and by a door's NAME (the console, a probe: `__doortools.thresholdOn('breakroom_w')`): the men `who` names, on the face of it they can walk to (the
   *  pair: Sam's) unless `side` says; `hold`: the order that holds the jambs until told. The order under way, or why not. Nothing is said for Sam and the
   *  order log is not written. */
  thresholdOn(door: string, who: Who = 'all', side?: 1 | -1, hold = false): DoorOp | string {
    this.sync();
    const g = this.g, S = g.orders, d = g.doors.byName(door); if (!d) return `no door called ${door}`;
    const men = S.men(who); if (!men.length) return 'nobody to take it';
    const sam = sideOf(d, g.player.char.pos);
    return this.order('threshold', men, d, side ?? (S.big ? S.sideFor(d, men, sam) : sam), null, hold);
  }
  /** the rooms being worked from the threshold whose men are still outside on the jambs, among these men (and on that door, when one is named): what the
   *  word, or a follow-up, would move */
  thresholdHeld(men: Guard[], door: Door | null = null): DoorOp[] { return this.ops.filter(op => !!op.thr && op.phase === 'thr' && (!door || op.door === door) && op.men.some(m => men.includes(m))); }
  /** … on the door a menu is up on (none off a door), and the men among these who hold it: who the held page's rows go to */
  private heldOn(t: OrderTarget, men: Guard[]): DoorOp[] { return t.kind === 'door' ? this.thresholdHeld(men, t.door).filter(op => !DOORTOOLS.thrHandsOff || !!op.thr!.hold) : []; }   // (thrHandsOff: the form that steps in by itself has no what-next on the menu)
  private heldMen(men: Guard[], t: OrderTarget): Guard[] { const ops = this.heldOn(t, men); return men.filter(m => ops.some(op => op.men.includes(m))); }
  /** WHAT NEXT, to men working a room from the threshold (either order of it, any time the jambs are held): 'step' — step in now, no can; 'bang' — the
   *  blind pockets banged (a can goes in while the kit has one: with no pocket worth it, where a bang and clear's would), then the step in; 'leave' — off the
   *  door: the order over ('stood down'), its men a plain stack on their marks, the door left as it stands. Several doors told to step or bang at once cross
   *  together. An OrderDef's `issue` (`t` a door: only that door's) — `canThresholdThen` its `valid` (no cans, or one of ours behind the door: no bang). A
   *  reason when there is nothing to tell. */
  thresholdThen(what: 'step' | 'bang' | 'leave', men: Guard[], t: OrderTarget | null = null): string | void {
    this.sync();
    const ok = this.canThresholdThen(what, t, men); if (ok !== true) return ok;
    const g = this.g, S = g.orders, ops = this.thresholdHeld(men, t?.kind === 'door' ? t.door : null);
    const w: Word | null = what !== 'leave' && ops.length > 1 ? { t0: g.time, go1: g.time } : null; if (w) this.words.push(w);   // (more than one door told at once: they cross together, behind the last burst — wordTick)
    for (const op of ops) {
      this.beat(op, `told · ${what === 'step' ? 'step in' : what === 'bang' ? 'bang and step in' : 'leave it'}`);
      if (what !== 'leave') { op.word = w; op.hold = 0; }
      const owed = !!op.thr!.stepOwed; op.thr!.stepOwed = false; op.thr!.cutOwed = false;   // (the word's owed step in: his say here is the newer one)
      if (what === 'bang') { op.thr!.force = true; if (op.thr!.first || op.thr!.wide) op.thr!.tossed = 0; this.toPockets(op); }   // (… and a can that went in first, unasked, is not the one he is asking for)
      else if (what === 'step') { if (owed) this.wordStepGo(op); else { this.heldBeat(op); this.toStep(op); } }   // (owed: 'the door waits' is answered — 'on without …')
      else {   // off the door: the order over, its men a plain stack on the marks they came to the door by — what 'stack up' leaves, for whatever is said next
        this.heldBeat(op); g.say(op.lead, 'coming off the door.'); this.end(op, 'stood down');
        const d = op.door, left = op.men.filter(m => m.state !== 'dead' && op.post.has(m) && S.of(m) === op.mine.get(m));
        const fallIn = DOORTOOLS.thrLeaveFallIn ? S.defs.find(x => x.id === 'fallIn') : undefined;
        if (fallIn) { fallIn.issue(S, left, t ?? { kind: 'none', at: [d.frameCentre[0], 0, d.frameCentre[2]] }); continue; }   // (the other reading of 'leave it': back to Sam)
        this.plainStack(op, left);
      }
    }
  }
  /** … given with 'wait for my word' on (the four's menu, a door held from outside): the jambs stay held and THE WORD is then what the row said — 'step' goes
   *  in with no can, where the word alone bangs the pockets first; 'bang' is the word as it always was */
  private thenOnWord(what: 'step' | 'bang', men: Guard[], t: OrderTarget): string | void {
    const ok = this.canThresholdThen(what, t, men); if (ok !== true) return ok;
    for (const op of this.thresholdHeld(men, t.kind === 'door' ? t.door : null)) { op.thr!.wordStep = what === 'step'; if (op.thr!.stepOwed) { op.thr!.stepOwed = false; op.thr!.cutOwed = false; op.thr!.fragT = undefined; op.thr!.fragSaid = false; }   // (a step in the last word owed: this is the newer order, and waits for the word again)
      this.beat(op, `on the word · ${what === 'step' ? 'step in, no bang' : 'bang, then step in'}`); }
  }
  canThresholdThen(what: 'step' | 'bang' | 'leave', t: OrderTarget | null, men: Guard[]): true | string {
    const ops = this.thresholdHeld(men, t?.kind === 'door' ? t.door : null); if (!ops.length) return wg("nobody's holding that door.", 'nobody is holding that door.');
    if (what !== 'bang') return true;
    if (this.bangs <= 0) return 'no bangs left.';
    for (const op of ops) { const who = this.canBehind(op.door, op.side, op.men); if (who) return who === 'you' ? wg("you're behind that door.", 'you are behind that door.') : `${who} is behind that door.`; }   // (the squad of four: nobody bangs a room his own men stand in — nor, behindSam, the one Sam stands in)
    return true;
  }
  /** the step in, from the jambs: at once — or, on a word that has other doors to wait for, with them (wordTick sends an order waiting in 'wait' in) */
  private toStep(op: DoorOp) { if (op.word) { op.bangT = -1e9; op.phase = 'wait'; } else this.enter(op); }
  /** … and from the console or a probe: `__doortools.thresholdTell('bang')` — every held threshold of the men `who` names, or only the door named. Null
   *  when it went; else why not. */
  thresholdTell(what: 'step' | 'bang' | 'leave', door: string | null = null, who: Who = 'all'): string | null {
    const g = this.g, d = door ? g.doors.byName(door) : null; if (door && !d) return `no door called ${door}`;
    return this.thresholdThen(what, g.orders.men(who), d ? { kind: 'door', at: [d.frameCentre[0], 0, d.frameCentre[2]], door: d, side: sideOf(d, g.player.char.pos) } : null) ?? null;
  }
  /** open and clear / bang and clear / clear from outside / the threshold: into the stack first */
  private start(kind: DoorToolKind, men: Guard[], t: OrderTarget, onWord = false, hold = false): string | DoorOp {
    if (t.kind !== 'door') return 'no door';
    this.sync();
    const S = this.g.orders, d = t.door; const deal = this.dealStack(d, t.side, men), posts = deal?.posts; if (!deal || !posts) return S.noRoomWords('no room to stack on that door', () => this.dealStack(d, t.side, men)?.posts);
    const frag = kind === 'bangClear' && this.fragNext;
    if (kind === 'bangClear' && !this.take(frag ? 'frag' : 'bang')) return frag ? 'no frags left' : 'no bangs left';   // (the can is this order's from the word: nobody goes in behind a bang that is not there — back in the bag if the order ends before the throw)
    this.makeRoom(d, deal.back);
    const op = this.newOp(kind, d, t.side, men, 'stack'); op.bangHeld = kind === 'bangClear'; if (frag) op.frag = true; if (this.bigNext && kind === 'openClear') op.big = true; op.onWord = onWord && S.big; op.thrHold = hold && kind === 'threshold'; const name = doorWords(d), watch: Vec3 = [d.frameCentre[0], 1.05, d.frameCentre[2]];
    let lead: Guard | null = null, la = -Infinity, lx = false;
    const oh = DOORTOOLS.openHand && kind === 'bangClear' && stackViewOpen(d);   // (openHand: nobody is walked across the front of a door that stands open)
    for (const [gd, p] of S.pair(men, posts.map(x => x.pos), posts.map(x => x.group ?? 0), d.frameCentre)) { const P = posts.find(x => x.pos === p)!; op.post.set(gd, P);
      this.assign(op, gd, { post: P.pos, face: P.face, watch, stance: P.lead ? 'stack' : 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` });
      const a = P.lead ? alongOf(d, P.pos) : -Infinity, x = oh && P.lead && this.crossesOpen(d, t.side, gd.char.pos, P.pos);
      if (lead && P.lead && x !== lx ? !x : a > la) { la = a; lead = gd; lx = x; } }   // (the lead: the man on the latch-side jamb — the handle and the keep are his; a door standing open has no handle to work: a man who need not cross it first)
    op.lead = lead ?? men[0];
    if (oh) this.leadHand(op, posts, watch);
    const filed = new Set<Guard>();
    if (kind === 'outside' && men.length > 2) {
      // THREE OR MORE working a door from outside: the pair's own way of it for TWO of them — the lead on his jamb and one man (his own pair's, when he is
      // there) behind him on his wall, the two who slice the opening — and the rest on down that wall behind them, backs to the file, watching the way the
      // squad came: nobody stands on the other jamb (the open doorway gives the room's near corner a line onto it), and what comes down the corridor at the
      // noise meets two guns. A man the wall has no floor for keeps the mark he was dealt (stood back a place below, if it is the other jamb's).
      const L = op.post.get(op.lead)!, aL = alongOf(d, L.pos), W = d.def.width, dir = aL > W / 2 ? 1 : -1, mate = (m: Guard) => S.pairOf(m) !== null && S.pairOf(m) === S.pairOf(op.lead) ? 0 : 1;
      const rest = men.filter(m => m !== op.lead).sort((a, b) => mate(a) - mate(b) || flat(op.post.get(a)!.pos, L.pos) - flat(op.post.get(b)!.pos, L.pos)); let k = 0;
      for (const gd of rest) { k++; const rear = k >= 2; if (rear) op.rear.add(gd);
        const P = op.post.get(gd)!, off = offOf(d, L.pos, t.side), floor = (from: Vec3, p: Vec3) => !this.g.col.nav.isBlocked(p[0], p[2]) && !this.g.col.solidBlocked([from[0], 0.45, from[2]], [p[0], 0.45, p[2]]) && stackRoomKeeps(this.g, d, t.side, p);
        let q = doorPt(d, aL + dir * k * DOORTOOLS.bangFile, off, t.side);
        if (!floor(L.pos, q)) { if (!rear) continue;   // (the lead's wall runs out. A rear man: the same on the OTHER wall, a place or more back from its jamb — never on the jamb itself)
          const far = doorPt(d, W - aL, off, t.side); let found: Vec3 | null = null;
          for (let j = 1; j <= 4 && !found; j++) { const c = doorPt(d, W - aL - dir * j * DOORTOOLS.bangFile, off, t.side); if (floor(far, c) && !men.some(m => m !== gd && flat(op.post.get(m)!.pos, c) < 0.7)) found = c; }
          if (!found) continue; q = found; }
        const out = doorPt(d, W / 2 + (k === 2 ? dir : -dir) * 4, 7, t.side, 1.05);   // (the two of them: one out along his own wall's side of the approach, one across it)
        const Q: Post = { ...P, pos: q, face: rear ? yawTo(q, out) : L.face, stackSide: L.stackSide, lead: false }; op.post.set(gd, Q); filed.add(gd);
        this.assign(op, gd, rear ? { post: q, face: Q.face, watch: out, stance: 'none', upper: 'aim', going: `rear security · ${name}`, there: `rear security · ${name}` }
          : { post: q, face: Q.face, watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: Q.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` }); }
    }
    const split = kind === 'openClear' || kind === 'threshold';   // (a man on each jamb, the files behind them: nobody is filed up behind the opener)
    if (!split && men.length > 2) {   // three or more, behind a bang (or a man the file above had no floor for): the lead's own file is already in file behind him; the men on the OTHER jamb stand back a place along their own wall (nobody crosses the door to join the lead's file), out of the angle the open doorway gives the room onto that jamb
      const W = d.def.width, hi = (p: Vec3) => alongOf(d, p) > W / 2, L = op.post.get(op.lead)!;
      for (const gd of [...men].sort((a, b) => flat(op.post.get(b)!.pos, d.frameCentre) - flat(op.post.get(a)!.pos, d.frameCentre))) {   // (the far man first: he makes the room)
        const P = op.post.get(gd)!; if (gd === op.lead || filed.has(gd) || hi(P.pos) === hi(L.pos)) continue;
        const q = doorPt(d, alongOf(d, P.pos) + (hi(P.pos) ? 1 : -1) * DOORTOOLS.bangFile, offOf(d, P.pos, t.side), t.side);
        if (this.g.col.nav.isBlocked(q[0], q[2]) || this.g.col.solidBlocked([P.pos[0], 0.45, P.pos[2]], [q[0], 0.45, q[2]]) || men.some(m => m !== gd && flat(op.post.get(m)!.pos, q) < 0.7) || !stackRoomKeeps(this.g, d, t.side, q)) continue;   // (no floor there — or not this room's: he keeps his place)
        const Q: Post = { ...P, pos: q, lead: false }; op.post.set(gd, Q);
        this.assign(op, gd, { post: q, face: Q.face, watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: Q.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` }); }
    } else if (!split) { let k = 0;   // behind a bang, or working it from outside, only the man who opens (and throws) is at the frame: the rest file up behind him along his wall, out of the angle the open doorway gives the room's far near-corner onto the other jamb
      const L = op.post.get(op.lead)!, aL = alongOf(d, L.pos), dir = aL > d.def.width / 2 ? 1 : -1;
      for (const gd of men) { if (gd === op.lead) continue; k++;
        const P = op.post.get(gd)!, q = doorPt(d, aL + dir * k * DOORTOOLS.bangFile, offOf(d, L.pos, t.side), t.side);
        if (this.g.col.nav.isBlocked(q[0], q[2]) || this.g.col.solidBlocked([L.pos[0], 0.45, L.pos[2]], [q[0], 0.45, q[2]]) || !stackRoomKeeps(this.g, d, t.side, q)) continue;   // (no floor there — or not this room's: he keeps his own jamb)
        const Q: Post = { ...P, pos: q, face: L.face, stackSide: L.stackSide, lead: false }; op.post.set(gd, Q);
        this.assign(op, gd, { post: q, face: Q.face, watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: Q.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` }); } }
    if (oh) this.keepHands(op, posts, watch);
    this.laneCover(op);
    this.beat(op, `ordered · ${men.map(m => m.callsign).join(', ')} · lead ${op.lead.callsign}`);
    return op;
  }
  /** which hand of the opening a point is on, on this face of the door: +1 past the far jamb, -1 before the near one, 0 = on neither (in front of the
   *  opening, on the other face, too far off to matter (stackroom.ts `viewMen`), or with something solid between him and that hand's jamb: a man round
   *  a corner is on no hand of this door) */
  private handOf(d: Door, side: 1 | -1, p: Vec3): 1 | -1 | 0 {
    if (offOf(d, p, side) <= 0 || flat(p, d.frameCentre) > STACKROOM.viewMen) return 0;
    const W = d.def.width, a = alongOf(d, p), h = a >= W + 0.05 ? 1 : a <= -0.05 ? -1 : 0; if (!h) return 0;   // (a jamb man nudged a hand's width toward the opening is still on his hand)
    const j = doorPt(d, h > 0 ? W + 0.35 : -0.35, 0.45, side);
    return flat(p, j) > 0.5 && this.g.col.solidBlocked([p[0], 0.45, p[2]], [j[0], 0.45, j[2]]) ? 0 : h;
  }
  /** DOORTOOLS.openHand, A CHARGE ORDER WHOSE DOOR CAME OPEN UNDER IT (off a replay of Mousehole, 10-13: the order ended on "door's open." and three men
   *  kept walking to stand-off marks past the far jamb, across the open doorway — one was shot in it): the order is over, and its men were left on
   *  'standing off' assignments nobody would end. A man of it still on his way whose mark is on the other hand of the opening from where he stands stops
   *  where he is, gun on the doorway, as on a plain stack. A man in front of the opening or with his mark on his own hand walks on as ever. */
  private stayHands(op: DoorOp) {
    if (!DOORTOOLS.openHand) return;
    const g = this.g, S = g.orders, d = op.door, name = doorWords(d), c = d.frameCentre;
    for (const m of op.men) { const A = op.mine.get(m); if (m.state === 'dead' || !A || S.of(m) !== A || !A.post || this.arrived(op, m)) continue;
      const at: Vec3 = [m.char.pos[0], 0, m.char.pos[2]]; if (!this.crossesOpen(d, op.side, at, A.post)) continue;
      S.assign(m, { order: 'stack', post: at, face: Math.atan2(c[0] - at[0], c[2] - at[2]), watch: [c[0], 1.05, c[2]], door: d, shy: d, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: A.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` });
      this.stats.handKept++; this.beat(op, `hand kept · ${m.callsign}`); }
  }
  /** a walk from where he stands to that place changes hands in front of the opening */
  private crossesOpen(d: Door, side: 1 | -1, from: Vec3, to: Vec3): boolean {
    const h = this.handOf(d, side, from); return h !== 0 && (alongOf(d, to) > d.def.width / 2 ? 1 : -1) !== h;
  }
  /** DOORTOOLS.openHand: the door stands open. A man of the order whose place is on the other hand of the opening from where he stands takes his own
   *  hand's wall: a place (then two, three) back from that hand's jamb mark, else the jamb mark itself — floor, this room's, clear of every other man's
   *  place. With no jamb mark dealt on his hand, or no floor there, he keeps the place he was dealt */
  private keepHands(op: DoorOp, posts: Post[], watch: Vec3) {
    const g = this.g, d = op.door, side = op.side, W = d.def.width, name = doorWords(d);
    for (const gd of op.men) { const P = op.post.get(gd); if (!P || gd === op.lead || op.rear.has(gd) || !this.crossesOpen(d, side, gd.char.pos, P.pos)) continue;
      const h = this.handOf(d, side, gd.char.pos), J = posts.filter(x => (alongOf(d, x.pos) > W / 2 ? 1 : -1) === h).sort((a, b) => flat(a.pos, d.frameCentre) - flat(b.pos, d.frameCentre))[0]; if (!J) continue;
      const aJ = alongOf(d, J.pos), oJ = offOf(d, J.pos, side);
      const others = [g.orders.samStood, ...g.guards.filter(x => (g.orders.sams ? x.team === 'operative' : g.orders.mine(x)) && x.state !== 'dead' && !op.men.includes(x)).map(x => x.char.pos)];   // (Sam and teammates not on the order: nobody is sent to stand on them)
      const free = (c: Vec3) => !op.men.some(m => m !== gd && flat(op.post.get(m)?.pos ?? m.char.pos, c) < 0.7) && !others.some(p => flat(p, c) < 0.7) && !g.col.nav.isBlocked(c[0], c[2]) && stackRoomKeeps(g, d, side, c);
      let q: Vec3 | null = null;
      for (let j = 1; j <= 3 && !q; j++) { const c = doorPt(d, aJ + h * j * DOORTOOLS.bangFile, oJ, side); if (free(c) && !g.col.solidBlocked([J.pos[0], 0.45, J.pos[2]], [c[0], 0.45, c[2]])) q = c; }
      if (!q && free(J.pos)) q = J.pos; if (!q) continue;
      const Q: Post = { ...J, pos: q, lead: false }; op.post.set(gd, Q); this.stats.handKept++;
      this.assign(op, gd, { post: q, face: Q.face, watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: Q.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` });
      this.beat(op, `hand kept · ${gd.callsign}`); }
  }
  /** openHand, THE LEAD HIMSELF: keepHands leaves the lead where the deal put him, and a deal can leave him no lead mark on his own hand — a man sent
   *  ALONE is dealt the latch jamb, the one place of the face (orders.ts stackPlaces), whichever hand he stands on, and walked across the open doorway to it
   *  (a replay, 10-13: the last man of a pair at a blown storage door, shot in front of it). His place is then his own hand's jamb: a lead mark of the deal
   *  there nobody else has, else the dealt mark mirrored about the doorway's middle (the other jamb's own mark, facing the other way) — floor of this room,
   *  nothing solid between him and it, nobody standing on it. None = the place as dealt, never a refusal */
  private leadHand(op: DoorOp, posts: Post[], watch: Vec3) {
    const g = this.g, d = op.door, side = op.side, gd = op.lead, P = op.post.get(gd), W = d.def.width, name = doorWords(d);
    if (!P || !P.lead || !this.crossesOpen(d, side, gd.char.pos, P.pos)) return;
    const h = this.handOf(d, side, gd.char.pos), at = gd.char.pos;
    const others = [g.orders.samStood, ...g.guards.filter(x => (g.orders.sams ? x.team === 'operative' : g.orders.mine(x)) && x.state !== 'dead' && !op.men.includes(x)).map(x => x.char.pos)];
    const free = (c: Vec3) => !op.men.some(m => m !== gd && flat(op.post.get(m)?.pos ?? m.char.pos, c) < 0.7) && !others.some(p => flat(p, c) < 0.7) && !g.col.nav.isBlocked(c[0], c[2]) && stackRoomKeeps(g, d, side, c)
      && !g.col.solidBlocked([at[0], 0.45, at[2]], [c[0], 0.45, c[2]]);
    const J = posts.find(x => x.lead && x !== P && (alongOf(d, x.pos) > W / 2 ? 1 : -1) === h && free(x.pos));
    const q = J ? J.pos : doorPt(d, W - alongOf(d, P.pos), offOf(d, P.pos, side), side); if (!J && ((alongOf(d, q) > W / 2 ? 1 : -1) !== h || !free(q))) return;
    const Q: Post = J ?? { ...P, pos: q, face: wrapAngle(P.face + Math.PI), stackSide: -P.stackSide as 1 | -1 }; op.post.set(gd, Q); this.stats.handKept++;
    this.assign(op, gd, { post: Q.pos, face: Q.face, watch, stance: 'stack', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: Q.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` });
    this.beat(op, `hand kept · ${gd.callsign}`);
  }
  /** doorway.ts DOORMANNERS.stackCover: a mark of this stack stands in the lane of ANOTHER door standing open, with floor beyond it the team has not been on
   *  (cleared.ts) — whoever is beyond it looks, and shoots, straight down the stack. The man of the stack furthest from its door who is not the lead (nor a
   *  rear man of a file working it from outside) is sent to cover it first, from the stack's side of it; step() brings him up to his mark (laneIn). No floor
   *  there, no line from there to the opening or to his mark, a place in a doorway or at the ordered door's own opening, the stack nearer that door than the
   *  place would be, or another man's mark on it: he walks to his mark as ever */
  private laneCover(op: DoorOp) {
    const g = this.g, K = DOORMANNERS, d = op.door; if (!K.on || !K.stand || !K.stackCover || op.men.length < 2) return;
    const gd = op.men.filter(m => m !== op.lead && !op.rear.has(m) && op.post.get(m)).sort((a, b) => flat(op.post.get(b)!.pos, d.frameCentre) - flat(op.post.get(a)!.pos, d.frameCentre))[0], A = gd && op.mine.get(gd); if (!gd || !A?.post) return;
    let D: Door | null = null; for (const m of op.men) { const P = op.post.get(m); if (P && (D = doorwayLane(g, P.pos, d))) break; } if (!D) return;
    // the line a man beyond that door shoots the stack down: from the middle of the marks through the middle of its opening. He stands ON it, `coverM` short of
    // the frame, his gun (and his light: `search` — guards.ts LIGHTS) down it into the floor beyond, where whoever has a line onto the stack has to be standing
    let sx = 0, sz = 0, n = 0; for (const m of op.men) { const P = op.post.get(m); if (P) { sx += P.pos[0]; sz += P.pos[2]; n++; } }
    const c = D.frameCentre, l = Math.hypot(sx / n - c[0], sz / n - c[2]); if (l < K.coverM + 0.5) return;
    { const far = g.cleared.roomBy(D, sideOf(D, [sx / n, 0, sz / n]) > 0 ? -1 : 1); if (far && g.cleared.isKnown(far)) return; }   // (the floor beyond it is the team's already: nobody is owed a look)
    const ux = (sx / n - c[0]) / l, uz = (sz / n - c[2]) / l, q: Vec3 = [c[0] + ux * K.coverM, 0, c[2] + uz * K.coverM], w: Vec3 = [c[0] - ux * K.coverDeep, 1.05, c[2] - uz * K.coverDeep];
    if (g.col.nav.isBlocked(q[0], q[2]) || doorwayInWay(g, q) || flat(q, d.frameCentre) < d.def.width / 2 + 1 || g.col.solidBlocked([q[0], 0.45, q[2]], [c[0], 0.45, c[2]]) || g.col.solidBlocked([q[0], 0.45, q[2]], [A.post[0], 0.45, A.post[2]]) || op.men.some(m => m !== gd && flat(op.post.get(m)?.pos ?? m.char.pos, q) < 0.9)) return;
    const back = { post: A.post, face: A.face, watch: A.watch, stance: A.stance, upper: A.upper, move: A.move, stackSide: A.stackSide, going: A.going, there: A.there };
    const words = `covering ${doorWords(D)}`;
    this.assign(op, gd, { post: q, face: yawTo(q, w), watch: w, stance: 'none', upper: 'aim', move: { stance: 'none', upper: 'aim' }, stackSide: A.stackSide, going: words, there: words, search: true, searchT: g.time });   // (search: a searcher's weapon light, where guards.ts LIGHTS gives him one)
    op.lane = { gd, door: D, cover: op.mine.get(gd)!, back }; DOORMANNERS_STATS.covered++; this.beat(op, `lane:${gd.callsign} covers ${D.def.name}`);
  }
  /** … and up to his mark: the stack waits for him like for any man still walking (a man the order has since given another mark — the captor's last warning,
   *  the far gun's set — keeps that one) */
  private laneIn(op: DoorOp) { const L = op.lane; op.lane = null; if (!L || L.gd.state === 'dead' || !op.men.includes(L.gd) || op.mine.get(L.gd) !== L.cover) return; this.assign(op, L.gd, L.back); this.beat(op, `lane:${L.gd.callsign} comes up`); }
  /** breach with a charge: the nearest man to the door goes to it, the rest (and he, after) stand off along the wall */
  private startCharge(men: Guard[], t: OrderTarget, byHand = false): string | void {
    if (t.kind !== 'door') return 'no door';
    this.sync();
    const g = this.g, S = g.orders, d = t.door; const posts = this.standoffPosts(d, t.side, men.length, men); if (!posts) return 'no room to stand off from that door';
    const back = this.stepBacks(d, t.side, men, posts.map(x => x.pos), true); if (back === null) return 'no room to stand off from that door';
    this.makeRoom(d, back);
    // (byHand — owncharge.ts: a charge the PLAYER set stands on it. The order starts at its stand-off stage: the same marks, deal and words, nobody goes to
    // the lock and nothing is taken from the count. blow() sends them in behind it as behind their own — it asks only for a charge order on that door)
    const op = this.newOp('charge', d, t.side, men, byHand ? 'standoff' : 'place'); const name = doorWords(d), watch: Vec3 = [d.frameCentre[0], 1.05, d.frameCentre[2]];
    const deal = this.standoffDeal(men, d, posts); op.lead = deal[0][0];
    const rest = byHand ? men : men.filter(m => m !== op.lead);
    for (const [gd, P] of deal) op.post.set(gd, P);
    if (!byHand) this.toLock(op);
    for (const gd of rest) { const P = op.post.get(gd)!; this.assign(op, gd, { post: P.pos, face: P.face, watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: 'standing off', there: `stood off · ${name}` }); }
    this.beat(op, `ordered · ${men.map(m => m.callsign).join(', ')} · ${byHand ? 'stand off on a charge set by hand' : `${op.lead.callsign} sets it`}`);
  }
  // ------------------------------------------------------------ the player's own charge (owncharge.ts)
  /** a charge the PLAYER set by hand stands on this door with no order of the squad's on it, and the menu is on the charge's own face: the charge row is
   *  then 'stand off · in behind the charge' (a teammate's charge keeps its row: 'blow the charge') */
  private looseOn(t: OrderTarget): boolean {
    if (!OWNCHARGE.on || t.kind !== 'door') return false;
    const c = this.chargeOn(t.door);
    return !!c && c.by === SAM_BY && c.side === t.side && !this.ops.some(o => o.kind === 'charge' && o.door === t.door);
  }
  /** can these men stand off from a charge on that face of that door: the marks, a way to each, the other pair's room to step back. `own` = the charge is
   *  already on it, set by the player's hand: then a teammate beyond the door is no reason to stay close to it */
  private standoffFits(men: Guard[], t: OrderTarget, own = false): true | string {
    if (t.kind !== 'door') return 'no door';
    const posts = this.standoffPosts(t.door, t.side, men.length, men); if (!posts) return 'no room to stand off.';
    if (!own) { const mate = this.behind(t.door, t.side, men); if (mate) return `${mate.callsign} is behind that door.`; }
    if (this.stepBacks(t.door, t.side, men, posts.map(x => x.pos), true) === null) return 'no room to stand off.';   // (the other pair, stacked on this door: no floor to get it clear of the blast)
    return this.standoffWalk(men, t.door, posts) ?? true;
  }
  /** can these men walk to these stand-off marks, as the row's why-not asks it: the first why-not, or null (the very dealing the issue makes, for any count: the standoff-fit check holds it) */
  private standoffWalk(men: Guard[], d: Door, posts: Post[]): string | null {
    const S = this.g.orders;
    for (const [gd, P] of this.standoffDeal(men, d, posts)) { const w = S.reach(gd, P.pos); if (w) return w; }   // (the very dealing the issue makes, for any count — two men too: the nearest man takes the first mark, which is not always the least total walk; nor is it with the pairs kept in their files)
    return null;
  }
  /** who a charge set on a door would catch if it went now, as words for the row that offers the trigger (' · too close: you, Red One · behind the door:
   *  Red Two'): blow()'s own reach and line tests for the squad and the player, asked with the leaf out as blow() asks them. A warning, so it does not say
   *  what the blast would do to him (beyond the door a pair's man inside knockM is felled, anybody else of ours dazzled). Kept a quarter second per charge:
   *  the rows and the menu ask it every frame */
  closeWords(c: SetCharge): string {
    const g = this.g, kept = this.closeAt.get(c); if (kept && Math.abs(g.time - kept.t) < 0.25) return kept.w;
    const K = DOORTOOLS, d = c.door, W = d.def.width, into = -c.side as 1 | -1;
    const out = doorPt(d, W / 2, 0.5, c.side, 1.1), inn = doorPt(d, W / 2, 0.45, into, 1.1);
    const near: string[] = [], far: string[] = [];
    const ask = (p: Vec3, who: string, sam: boolean) => {
      const beyond = offOf(d, p, c.side) < 0, dist = flat(p, d.frameCentre);
      if (sam ? dist >= (beyond ? K.stunM : K.backblastM) : dist > K.stunM || (!beyond && dist >= K.backblastM)) return;
      if (!g.col.solidBlocked(beyond ? inn : out, [p[0], 1.1, p[2]])) (beyond ? far : near).push(who);
    };
    const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = leaves.filter(b => b !== d.box);   // (the leaf itself is what goes)
    try {
      if (SAMSTUN.on && !g.player.down && !g.puppet && !g.touring) ask(g.player.char.pos, 'you', true);
      for (const gd of g.guards) if (gd.unit && gd.team === 'operative' && gd.state !== 'dead') ask(gd.char.pos, gd.callsign, false);
    } finally { g.col.dynamicBoxes = leaves; }
    const w = (near.length ? ` · too close: ${near.join(', ')}` : '') + (far.length ? ` · behind the door: ${far.join(', ')}` : '');
    this.closeAt.set(c, { t: g.time, w }); return w;
  }
  private closeAt = new SideMap<SetCharge, { t: number; w: string }>();
  /** the face of this door the player could set a charge on by hand right now (null: none — the switch off, a show, his hands full of a body or a man, steel, off its hinges, open, a
   *  charge or a charge order already on it, nothing left in the count) */
  private samFace(d: Door): 1 | -1 | null {
    const g = this.g;
    if (!OWNCHARGE.on || g.puppet || g.touring || g.player.dragging || g.player.holding || d.off || d.def.steel || isOpen(d) || this.chargeOn(d) || this.ops.some(o => o.kind === 'charge' && o.door === d)) return null;
    this.sync(); if (this.charges <= 0) return null;
    return offOf(d, g.player.char.pos, 1) >= 0 ? 1 : -1;
  }
  /** player.ts buildInteractables, per door: a set charge is said on the door's own line (with who it would catch); else, in reach with free hands, the
   *  row 'set a charge · N left' — the count is the squad's own bag (kit.ts kitPool: his card's among it) */
  samRows(it: Interactable, d: Door, verbs: Interactable[], free: boolean, row: (base: Interactable, verb: Verb, text: string, hints?: string) => Interactable) {
    if (!OWNCHARGE.on) return;
    const c = this.chargeOn(d), F = blowKeyWord(!OWNBLOW.on, DOORTOOLS.blowKey.replace('Key', ''));   // (ownblow.ts: one his own hands set is his own actions' to blow, and the words say so)
    if (c) { const w = `${this.closeWords(c)} · charge set${blowTail(this.keyIs(c), DOORTOOLS.blowKey.replace('Key', ''))}`; it.line1 += w; for (const v of verbs) v.line1 += w; return; }   // (the warning FIRST: the door's header is one line the HUD cuts at its end — what goes is the hint, never who is in the blast)
    if (!free || this.samFace(d) === null) return;
    verbs.push(row(it, 'charge', `set a charge · ${this.charges} left`, `${F}  blows it once set`));
  }
  /** ownblow.ts: IS THIS SET CHARGE THE SQUAD'S KEY'S to blow — every one with the switch off; with it on, one the squad set, or his own while the squad
   *  works its door (stood off behind it, stacked on it: the key is their word and it goes with them). The key's press, the words and the floor plan ask */
  keyIs(c: SetCharge): boolean { return !OWNBLOW.on || c.by !== SAM_BY || this.ops.some(o => o.door === c.door) || this.stacksOf(this.g.orders.men()).some(x => x.stack === c.door); }
  /** ownblow.ts: the nearest charge his own hands set that is on no word still to go — the one his own row 'blow the charge' is for (null: none) */
  samSet(): SetCharge | null { return this.nearest(c => c.by === SAM_BY && !this.onPendingWord(c)); }
  /** …and where it is, in the row's words */
  samWhere(c: SetCharge): string { return `the ${doorWords(c.door)}`; }
  /** the charge going on under his hands: where on the leaf, and the face's normal (handwork.ts samWork plants him by it; `at` is his to move) */
  get samJob(): { p: Vec3; n: Vec3; at: Vec3 } | null {
    const s = this.g.player.charging; if (!s) return null;
    const d = s.door, o = doorPt(d, 0, 0, s.side), n1 = doorPt(d, 0, 1, s.side);
    return { p: doorPt(d, d.def.width - 0.22, 0.025, s.side, 1.05), n: [n1[0] - o[0], 0, n1[2] - o[2]], at: s.at };
  }
  /** how far along it is, 0‥1 (the running row's bar) */
  get samProgress(): number { const s = this.g.player.charging; return s ? clamp((this.g.time - s.t0) / DOORTOOLS.setSecs, 0, 1) : 0; }
  /** let go of it: nothing was spent (true: there was one) */
  cancelSam(): boolean {
    const pl = this.g.player; if (!pl.charging) return false;
    pl.charging = null; this.g.msg('charge not set'); return true;
  }
  /** each frame: the row performed starts it; the squad's own `setSecs` with his hands on it; anything that takes him off it breaks it off */
  private samTick() {
    const g = this.g, pl = g.player, K = DOORTOOLS, act = g.act;
    const mine = !!act && act.kind === 'door' && act.verb === 'charge' && !!act.door;
    const s = pl.charging;
    if (!s) {
      if (!mine || g.wallCharge?.setting) return;
      const d = act!.door!, side = this.samFace(d); if (side === null) return;
      const p = pl.char.pos; pl.charging = { door: d, side, t0: g.time, at: [p[0], 0, p[2]] };
      return;
    }
    const d = s.door, p = pl.char.pos;
    if (!OWNCHARGE.on || pl.down || pl.sprinting || !!pl.dragging || !!pl.holding || !!pl.takedown || !!pl.kick || g.puppet || d.off || isOpen(d) || this.chargeOn(d)
      || this.ops.some(o => o.kind === 'charge' && o.door === d)   // (the squad ordered onto this door with a charge of its own: theirs goes on, never two)
      || offOf(d, p, s.side) <= 0 || flat(p, s.at) > SAM_SHIFT || (act && !(mine && act.door === d))) { this.cancelSam(); return; }
    if (samStowing(g)) { s.t0 = g.time; return; }   // (workstow.ts: what was in his hand is still on its way to where it lives — the charge's clock starts with his hands free)
    const J = this.samJob!;
    chargeHands(g, pl.char, J.p, J.n, g.time - s.t0, K.setSecs, pl.pistolUp ? 0 : undefined);
    if (g.time - s.t0 < K.setSecs) return;
    pl.charging = null;
    if (!this.take('charge')) { g.msg('no charges left'); return; }
    this.samSpent++;
    this.set.push({ door: d, side: s.side, t: g.time, by: SAM_BY }); g.audio.play('lockPick', d.pos, 0.6);
    g.msg(`charge set on the ${doorWords(d)}${blowTail(!OWNBLOW.on, K.blowKey.replace('Key', ''), '. ')}`);
    this.note(`charge set by hand on ${d.def.name}`);
  }
  /** the charges that stand set: drawn, and one whose door has come open (or off its hinges) is off it — back in the count */
  private tickSet() {
    const g = this.g;
    for (const c of [...this.set]) {
      const gone = OWNCHARGE.on && c.door.off;   // (blown off its hinges by something else: the same — owncharge.ts; without it the charge stood on in the air)
      if (gone || isOpen(c.door)) {
        this.set.splice(this.set.indexOf(c), 1); this.refund('charge'); if (c.by === SAM_BY) this.samSpent = Math.max(0, this.samSpent - 1);
        g.msg(gone ? `the ${doorWords(c.door)} is off its hinges, so the charge came off with it` : `the ${doorWords(c.door)} came open, so the charge came off`); this.note(`charge off ${c.door.def.name}: the door ${gone ? 'is gone' : 'opened'}`); continue;
      }
      this.drawCharge(c);
    }
  }
  /** who stands off where for a charge: the man nearest the door (he sets it) on the first mark, the rest dealt the others (orders.ts pair) — first entry = the setter */
  private standoffDeal(men: Guard[], d: Door, posts: Post[]): [Guard, Post][] {
    const S = this.g.orders, lead = [...men].sort((a, b) => flat(a.char.pos, d.frameCentre) - flat(b.char.pos, d.frameCentre))[0];
    return [[lead, posts[0]], ...S.pair(men.filter(m => m !== lead), posts.slice(1).map(x => x.pos), posts.slice(1).map(x => x.group ?? 0)).map(([gd, p]) => [gd, posts.find(x => x.pos === p)!] as [Guard, Post])];
  }
  /** the man who sets the charge: to the lock */
  private toLock(op: DoorOp) {
    const d = op.door, ws = this.g.doors.workSpot(d, doorPt(d, d.def.width / 2, 1, op.side), 0.5);
    this.assign(op, op.lead, { post: ws.pos, face: ws.yaw, watch: null, stance: 'none', upper: 'none', going: `charge · ${doorWords(d)}`, there: 'setting the charge' });
  }
  /** a SILENT squad at a door locked against it (silent.ts SILENT.picks): the lead to the keyway, to pick it — the 'kick' stage works the lock from there */
  private toPick(op: DoorOp) {
    const d = op.door, ws = this.g.doors.workSpot(d, doorPt(d, d.def.width / 2, 1, op.side));
    op.kick = { pos: ws.pos, yaw: ws.yaw, t: NaN, pick: true }; op.phase = 'kick'; op.t0 = this.g.time;
    this.assign(op, op.lead, { post: ws.pos, face: ws.yaw, watch: null, stance: 'none', upper: 'none', going: `on the lock · ${doorWords(d)}`, there: 'picking the lock' });
  }
  /** a lock a pick opens: a cylinder — not a steel door's bolt, a keypad's (devices.ts), nor a wedge kicked under the leaf from inside (digin.ts) */
  private pickable(d: Door): boolean { return !d.def.steel && !this.g.devices?.padOf(d) && !d.lockId.startsWith('wedge:'); }
  /** his hands off the lock (whoever's were on it for this op) */
  private offLock(op: DoorOp) { const k = op.kick; if (k?.by) { k.by.char.anim.lockpick = false; k.by = undefined; } }
  /** One frame of a lock being picked for a silent squad. The lead kneels at the keyway and works it with the player's own pick (doors.ts pick(): its clicks,
   *  its seconds, its snap — heard like any door noise); the lock gives → back onto his jamb, and the order goes on as at an unlocked door. His hands come off it
   *  while the fight has him (the door keeps what was done for a moment, then loses it); the squad told loud, a loud tool picked or a captor at his last
   *  warning → he stands up and it is the boot (open()'s own question, asked again). Also a LOUD squad's way through a cylinder on the face its door
   *  opens toward (frameHeld — doors.ts DOORWAY.frameHolds): the same steps, and there the question asked again is the frame's. */
  private pickStep(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, t = g.time, lead = op.lead, c = lead.char, k = op.kick!;
    const dt = Math.min(0.05, t - (k.at ?? t)); k.at = t;
    if (k.doneT === undefined && (isOpen(d) || !this.lockedOut(d, op.side))) { this.offLock(op); this.backToJamb(op, lead); k.doneT = t; }   // (it gave — to his pick, below, or to somebody else's hand)
    if (k.doneT !== undefined) {   // unlocked: the man who opens it is on his jamb first, like at any door
      if (op.word && op.kind !== 'bangClear') { op.kick = null; op.phase = 'ready'; op.hold = 2; return; }   // (on a word: ready the moment it gives — the word's own clock is short — and he crosses with the others: wordTick)
      if (!isOpen(d) && !this.arrived(op, lead) && t - k.doneT < K.kickCap) return;
      op.kick = null; this.open(op); return; }
    if (!(silentPick(g) || this.frameHeld(d, op.side)) || !this.pickable(d)) { this.offLock(op); op.kick = null; this.beat(op, 'pick off'); this.open(op); return; }   // (loud now: the boot — or, the switch thrown / a wedge kicked in mid-pick, the refusal)
    // the fight has him — the fight AI's lease, blind, folded, or (once anything loud has reached the squad) a man the room fight has his gun on: hands on his
    // gun. Before that a gun brought onto a man is the silent hold, and the lock is still his job; and no such wait outlasts `kickCap` + 3 s at a stretch
    const A = op.mine.get(lead), busy = (A && A.yieldT >= 0) || t < lead.dazzledUntil || t < lead.staggerUntil || (!!lead.script?.over && (silentCompromised(g) || !squadSilent(g)));   // (a LOUD squad's picker — a lock on the face its door opens toward — has nothing to stay quiet for: a man in his sights takes his hands off the lock at once)
    if (!busy) k.offT = undefined;
    else if (t - (k.offT ??= t) < K.kickCap + 3) { this.offLock(op); op.t0 = t; return; }
    const on = flat(c.pos, k.pos) < 0.4 && Math.abs(wrapAngle(c.bodyYaw - k.yaw)) < 0.35;
    if (!on) { this.offLock(op);
      if (t - op.t0 < K.kickCap) return;
      if (flat(c.pos, k.pos) > 1.2) { g.say(lead, "can't get on the door."); this.end(op, 'never made the lock'); return; } }   // (near enough after `kickCap`: he works it from where he is)
    if (!k.by) this.beat(op, 'picking');
    c.anim.lockpick = true; k.by = lead;
    if (!g.doors.pick(d, c.id, dt)) return;
    if (silentPick(g)) SILENT_STATS.picked++; this.stats.picks++; this.beat(op, 'picked');   // (a loud squad's pick — a lock on the face its door opens toward, frameHeld — is not the silent squad's tally)
    this.offLock(op); this.backToJamb(op, lead); k.doneT = t;
  }
  /** A door locked against the team and a man of this order with a BREACHING SHOTGUN (shotgun.ts; the lead first, else the nearest man of the stack who has
   *  one): he goes to the lock with it — beside the frame, past the latch edge and off the opening where the wall leaves room (breachSpot), the boot's spot
   *  being square in front of the leaf — and the 'kick' stage shoots it off (gunStep). false: nobody carries one, a wedge under the leaf holds it whatever
   *  becomes of the lock, no spot has floor and a line to the lock, or the gun has been tried and given up on → the boot, as before. */
  private toGun(op: DoorOp): boolean {
    const g = this.g, d = op.door; if (op.noGun) return false;
    const shell = (m: Guard) => SHOTGUN.on && !d.lockId.startsWith('wedge:') && carriesBreacher(m), can = (m: Guard) => shell(m) || carriesHammer(m);   // (bigkit.ts: the hammer in a man's big slot takes a lock the same way, a wedged door too — nobody carries one with BIGSLOT off)
    const near = (a: Guard, b: Guard) => flat(a.char.pos, d.frameCentre) - flat(b.char.pos, d.frameCentre), held = op.men.filter(m => op.post.has(m)).sort(near);
    const by = shell(op.lead) ? op.lead : held.find(shell) ?? (can(op.lead) ? op.lead : held.find(can)); if (!by) return false;   // (a shotgun before a hammer: one shell from beside the frame)
    const hammer = !shell(by);
    const sp = breachSpot(g, d, op.side, [...op.men.filter(m => m !== by).map(m => op.post.get(m)?.pos ?? m.char.pos), g.player.char.pos], hammer ? null : op.post.get(by)?.pos ?? by.char.pos, BIGSLOT.on && BIGSLOT.moves && (hammer || kitBig(by) === 'shotgun') ? (hammer ? 'hammer' : 'shotgun') : undefined); if (!sp) return false;   // (not on a mate's mark, nor on you; his own mark: where he shoots it from when glass has the list's spots — shotgun.ts)
    op.kick = { pos: sp.pos, yaw: sp.yaw, t: NaN, gun: { by, at: sp.at, n: 0, nextT: 0, silent: squadSilent(g), own: sp.own, ...(hammer ? { hammer: true } : {}), ...(this.lockedOut(d, op.side) ? {} : { shut: true }) } }; op.phase = 'kick'; op.t0 = g.time;
    this.assign(op, by, { post: sp.pos, face: sp.yaw, watch: sp.at, stance: 'none', upper: hammer ? 'none' : 'aim', going: `on the lock · ${doorWords(d)}`, there: 'breaching' });
    const lockedNow = this.lockedOut(d, op.side);
    g.say(by, lockedNow ? (hammer ? 'locked. hammer.' : 'locked. shotgun.') : hammer ? 'hammer.' : 'shotgun.'); this.beat(op, `${hammer ? 'hammer' : 'gun'}:${by.callsign}${sp.beside ? '' : ' (in front)'}`); return true;
  }
  /** the gun is off this door's lock for good (the lock held, he never got onto it): his mark again, and open()'s question asked with the gun ruled out — the boot */
  private gunOff(op: DoorOp, why: string) {
    const by = op.kick?.gun?.by; op.noGun = true; op.kick = null; this.beat(op, `gun off: ${why}`); if (by) gunDown(by);
    if (by && by !== op.lead && op.men.includes(by)) this.backToJamb(op, by);
    this.open(op);
  }
  /** One frame of a lock being SHOT OFF. The man with the shotgun on his spot, square to the lock, muzzle inside the reach its pattern takes a lock from: a
   *  shell (combat.ts fireWeapon — its own flash, report, hearing event and nine holes; shotgun.ts fireShell throws the leaf in with doors.ts kickIn, the boot's
   *  verb, when enough of it went in by the latch) → back onto his mark, and the order goes on exactly as after the boot (a bang follows it on the boot's clock).
   *  The lock still holding after SHOTGUN.shells of them, or he cannot get onto it → the boot. His gun stays his while the fight has him. */
  private gunStep(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, t = g.time, k = op.kick!, G = k.gun!, by = G.by, c = by.char;
    if (!op.men.includes(by)) { op.kick = null; this.beat(op, 'gun off: its man is gone'); this.open(op); return; }   // (another gun in the stack, or the boot)
    if (!G.silent && squadSilent(g)) { op.kick = null; this.beat(op, 'gun off: the squad went silent'); if (by !== op.lead) this.backToJamb(op, by); this.open(op); return; }   // (silent since he was sent: open()'s question again — the pick, or no boot while silent; a rescue's last warning sends him back to it)
    if (isOpen(d) || (!G.shut && !this.lockedOut(d, op.side))) {   // somebody else opened it, or turned the lock (a door he was sent to that was not locked — `shut`, the big slot's own row — is his while it is shut)
      this.backToJamb(op, by);
      if (op.word && op.kind !== 'bangClear') { op.kick = null; op.phase = 'ready'; op.hold = 2; return; }   // (on a word: he still crosses with the others — wordTick)
      op.kick = null; this.open(op); return; }
    const A = op.mine.get(by), busy = (A && A.yieldT >= 0) || t < by.dazzledUntil || t < by.staggerUntil;   // the fight has him, he is blind or doubled over: no shell goes — up to `kickCap` + 3 s at a stretch
    if (!busy) k.offT = undefined;
    else if (t - (k.offT ??= t) < K.kickCap + 3) { gunDown(by); if (by.bigOut) { hammerIn(g, by, true); G.nextT = 0; } op.t0 = t; return; }   // (bigkit.ts: a shotgun out of his big slot is slung while the fight has him — his own gun is in his hands)
    if (G.hammer) { this.hammerStep(op); return; }
    // THE SHOTGUN OUT OF HIS BIG SLOT (bigkit.ts — a man whose own gun is the shotgun has nothing to draw): up as he comes onto his spot, and no shell before it has been up its beat
    const kit = !by.weapon.def.pellets?.breach || !!by.slung?.out, up = !kit || (flat(c.pos, k.pos) < 1.5 && kitBig(by) === 'shotgun' && gunUp(g, by));
    const B = by.weapon.def.pellets?.breach ?? (kit && kitBig(by) === 'shotgun' ? WEAPONS.m870.pellets?.breach : undefined); if (!B) { this.gunOff(op, 'no gun in his hands'); return; }
    const on = up && flat(c.pos, k.pos) < (G.own ? SHOTGUN.ownSlack : 0.4) && Math.abs(wrapAngle(c.bodyYaw - yawTo(c.pos, G.at))) < 0.35 && v3.dist(c.muzzle, G.at) <= B.reachM && offOf(d, c.muzzle, op.side) > 0.05
      && (!G.own || t - op.t0 >= SHOTGUN.ownBeat);   // (from his own side — shotgun.ts: nearer his spot, where its lines were asked; and no walk brought the gun up, so the shell waits a beat for it)
    if (!on) { if (t - op.t0 >= K.kickCap + SHOTGUN.aimCap) this.gunOff(op, 'never got onto the lock'); return; }
    if (op.word && op.kind !== 'bangClear') { op.hold = 2; return; }   // (the word has others to wait for: the shell is his crossing)
    if (t < G.nextT) return;
    if (!by.weapon.fire()) { by.weapon.rearm(); G.nextT = t + by.weapon.def.reload.dur; g.say(by, 'reloading.'); return; }   // (dry at the door: he thumbs shells in — the wait is the row's)
    const lock = d.locked && d.latched;
    if (!(kit && bigBroken())) { fireWeapon(g, c, G.at, false, { steady: true, spread: 0 });   // (BIGKIT_BREAK=1, the check's: a big slot's shotgun does nothing to a lock)
      if (!lock && G.shut && !isOpen(d)) g.doors.kickIn(d, v3.copy(c.pos), c.id, true); }   // (a latch that was not locked: the shell's own rule leaves a leaf merely shut alone — shotgun.ts; this one was put into it on purpose, and takes it as the boot does)
    G.n++; G.nextT = t + by.weapon.def.cd; op.t0 = t;
    if (!d.latched) { k.t = t; this.stats.shot++; this.beat(op, 'shotgun'); gunDown(by); this.backToJamb(op, by);
      if (!isOpen(d) && Math.abs(d.vel) < 0.5) { op.kick = null; op.noGun = true; this.open(op); }   // (the lock shot off from the face the leaf opens toward — doors.ts kickIn's `lock`: nothing flung it, it stands home unlocked; open()'s question again, which is now the hand's)
      else this.opened(op);
      return; }
    this.beat(op, 'shell: the lock held');
    if (G.n >= SHOTGUN.shells) this.gunOff(op, 'the lock held');
  }
  /** One frame of a lock being HAMMERED (bigkit.ts — gunStep's own gates have passed: his man is in the order, the squad is not newly silent, the door is
   *  still locked against them, the fight does not have him). On his spot and squared to the lock: one blow where a boot would do; where the frame
   *  holds a boot a blow every BIGSLOT.swing seconds and the last of BIGSLOT.swings breaks the lock — the leaf flung in from the push face, standing home unlocked for a hand from the face it opens toward — and the order
   *  goes on exactly as after the shotgun. Never onto it → the boot (or, where the frame holds one, the frame's own answer). */
  private hammerStep(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, t = g.time, k = op.kick!, G = k.gun!, by = G.by, c = by.char;
    // (BIGSLOT.moves, bigkit.ts: the hammer is off his back from the moment he is sent — in his hands by the time he has walked onto his place — and every
    // blow's landing is told to the animator ahead of it, so the wind-up and the swing are one move that ends on the leaf)
    const H = BIGSLOT.moves ? hammerOut(g, by, G.at) : null, tell = (at: number) => { if (H) { const rel = t - H.t0; H.blows = H.blows.filter(b => b <= rel); H.blows.push(at - H.t0); } };
    const on = flat(c.pos, k.pos) < 0.4 && Math.abs(wrapAngle(c.bodyYaw - yawTo(c.pos, G.at))) < 0.35;
    if (!on) { if (t - op.t0 >= K.kickCap + SHOTGUN.aimCap) this.gunOff(op, 'never got onto the lock'); return; }
    if (G.nextT === 0) { G.nextT = (H ? Math.max(t, H.t0 + bigOutBy('hammer')) : t) + bigWind(); op.t0 = t; tell(G.nextT); return; }   // (the wind-up is silent, and done before any word)
    if (op.word && op.kind !== 'bangClear') { op.hold = 2; if (H && t > G.nextT - WORD_LEAD) { G.nextT = t + WORD_LEAD; tell(G.nextT); } return; }   // (the word has others to wait for: nothing is heard before it — his first blow lands on it, the lock gives a beat after; the moves: held wound up, the swing let go on the word)
    if (t < G.nextT) return;
    G.n++; G.nextT = t + bigSwing(); op.t0 = t;
    if (G.n < ((G.shut ? d.locked && g.doors.bootHolds(d, c.pos) : this.frameHeld(d, op.side)) ? Math.max(1, BIGSLOT.swings) : 1)) { hammerBlow(g, by, d, false); tell(G.nextT); this.beat(op, 'hammer: a blow'); return; }   // (one blow where a boot would do, BIGSLOT.swings where the frame holds one — bigkit.ts hammerBlows)
    if (!hammerBlow(g, by, d, true)) { this.gunOff(op, 'the door held the hammer'); return; }
    k.t = t; this.beat(op, 'hammered'); this.backToJamb(op, by);
    if (!isOpen(d) && Math.abs(d.vel) < 0.5) { op.kick = null; op.noGun = true; this.open(op); }   // (from the face the leaf opens toward: nothing flung it — open()'s question again, which is now the hand's)
    else this.opened(op);
  }
  /** a breaching shotgun out of a big slot is in nobody's hands without a lock to shoot (bigkit.ts): the net under every way out of the lock stage — the
   *  order ended, its man given another, a load */
  private slingTick() { for (const gd of this.g.guards) if (gd.slung?.out && !this.ops.some(o => o.phase === 'kick' && o.kick?.gun?.by === gd && !o.kick.gun.hammer)) gunDown(gd); }
  /** the man this op turned on is gone (down, or given another order) and the next has it: a job only he was at starts over with the new man walking to it —
   *  a charge is not set, and a lock is not kicked, by a man who is not at the door */
  private newLead(op: DoorOp) {
    const t = this.g.time;
    if (op.phase === 'place') { op.setT = NaN; op.t0 = t; if (!op.post.has(op.lead)) op.post.set(op.lead, { pos: v3.copy(op.lead.char.pos), face: op.lead.char.bodyYaw, stackSide: 1, lead: false }); this.toLock(op); this.beat(op, `setter now ${op.lead.callsign}`); }
    else if (op.phase === 'kick' && op.kick?.pick) { this.offLock(op); op.t0 = t; const k = op.kick;   // (a lock half picked keeps what the door kept; one that has given only wants its new man on a jamb)
      if (k.doneT !== undefined) { k.doneT = t; this.backToJamb(op, op.lead); }
      else { k.at = undefined; this.assign(op, op.lead, { post: k.pos, face: k.yaw, watch: null, stance: 'none', upper: 'none', going: `on the lock · ${doorWords(op.door)}`, there: 'picking the lock' }); }
      this.beat(op, `picker now ${op.lead.callsign}`); }
    else if (op.phase === 'kick' && op.kick?.gun) { if (!op.men.includes(op.kick.gun.by)) { op.kick = null; this.open(op); } }   // (the man with the gun was the one lost: open()'s question again — another gun in the stack, or the boot; else he is still on the lock)
    else if (op.phase === 'kick' && op.kick) { op.kick.t = NaN; op.t0 = t;
      this.assign(op, op.lead, { post: op.kick.pos, face: op.kick.yaw, watch: null, stance: 'none', upper: 'none', going: `on the door · ${doorWords(op.door)}`, there: 'breaching' }); this.beat(op, `kicker now ${op.lead.callsign}`); }
    else if (op.phase === 'stack' && !isNaN(op.readyT)) {   // (only an order on a gate stands stacked: the man who opens it — and throws — is on the frame, so the new one walks to the old one's jamb, and the gate waits on him)
      const P = [...op.post].find(([gd, q]) => q.lead && !op.men.includes(gd))?.[1]; op.readyT = NaN; op.t0 = t; if (!P) return;
      const d = op.door, name = doorWords(d); op.post.set(op.lead, P);
      this.assign(op, op.lead, { post: P.pos, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: 'stack', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` });
      this.beat(op, `lead now ${op.lead.callsign}`); }
  }
  /** the stack for this module's entries: orders.ts's marks (stackPosts — the latch jamb first, split when both have floor), each `tuck` further along the wall
   *  from the opening where the floor allows */
  stackPosts(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[] = []): Post[] | null {
    return this.g.orders.ownMarkFirst(d, side, men, () => this.stackTucked(d, side, men, ignore));   // (doorway.ts OWN MARK: men who stand stacked — on these tucked marks too — are dealt the marks they stand on, Sam beside them or not)
  }
  private stackTucked(d: Door, side: 1 | -1, men: Guard[], ignore: Guard[]): Post[] | null {
    const g = this.g, posts = g.orders.stackPosts(d, side, men, ignore); if (!posts) return null;
    // (… and the tuck does not take a man off the mark he stands on to put him on Sam: a tucked place within a body of where Sam really stands, that nobody of the order stands on, is not tucked to)
    const sam = g.orders.samStood, own = DOORMANNERS.on && DOORMANNERS.ownMark ? g.orders.ownMarks(d, side, men) : [], mine = (q: Vec3) => own.some(o => flat(o, q) < OWN_EPS);
    const tuckedIn = (P: Post, q: Vec3) => (mine(P.pos) && flat(sam, q) < 0.7 && !mine(q))
      || (DOORMANNERS.on && DOORMANNERS.markClear && !P.lead && doorwayInWay(g, q) && !doorwayInWay(g, P.pos));   // (doorway.ts MARKS: the tuck does not put a mark where a leaf swings)
    if (posts.length > 2) {   // three or more: the files tuck as files — the far man first, each against where the others stand NOW, so a file keeps its gaps
      const out = [...posts], far = (P: Post) => Math.abs(alongOf(d, P.pos) - d.def.width / 2);
      for (const P of [...posts].sort((a, b) => far(b) - far(a))) { const a = alongOf(d, P.pos), dir = a > d.def.width / 2 ? 1 : -1; const q = doorPt(d, a + dir * DOORTOOLS.tuck, offOf(d, P.pos, side), side);
        if (!g.col.nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([P.pos[0], 0.45, P.pos[2]], [q[0], 0.45, q[2]]) && !out.some(o => o !== P && flat(o.pos, q) < 0.7) && !tuckedIn(P, q) && stackRoomKeeps(g, d, side, q)) out[out.indexOf(P)] = { ...P, pos: q }; }
      return out;
    }
    return posts.map(P => { const a = alongOf(d, P.pos), dir = a > d.def.width / 2 ? 1 : -1; const q = doorPt(d, a + dir * DOORTOOLS.tuck, offOf(d, P.pos, side), side);
      return !g.col.nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([P.pos[0], 0.45, P.pos[2]], [q[0], 0.45, q[2]]) && !posts.some(o => o !== P && flat(o.pos, q) < 0.7) && !tuckedIn(P, q) && stackRoomKeeps(g, d, side, q) ? { ...P, pos: q } : P; });
  }
  // ------------------------------------------------------------ the squad of four: a door two pairs have a hand in
  /** teammates OUTSIDE this order who are stacked on this door, this face, under a plain 'stack up' (the other pair, holding it) */
  private holders(d: Door, side: 1 | -1, men: Guard[]): Guard[] {
    const S = this.g.orders; if (!S.big) return [];
    // (stackroom.ts: past the makers' 2.6 m only a man waiting DOWN THE DOOR'S WALL out of an open door's view holds it — one stood back on the open floor
    //  is out of the files' way as he always was, and is not asked to step back)
    const held = (p: Vec3) => { const r = flat(p, d.frameCentre), off = offOf(d, p, side); return off > 0 && (r < 2.6 || (r < stackViewReach(d) && off < S.knobs.jambOut + 0.5)); };
    return S.men().filter(gd => { if (men.includes(gd)) return false; const A = S.of(gd); return !!A && A.order === 'stack' && A.door === d && A.post !== null && held(A.post); });
  }
  /** where each of them steps back to, clear of `taken` (the incoming order's own marks): along his own wall first, then the other, `roomBack` past the jamb —
   *  out of the opening's angles, out of a charge's backblast, the door still his to watch. A man with no floor to step back to is left out (he keeps his
   *  mark and the files go past him, as before) — unless `must`: then null (a charge is not set with a man inside its blast). */
  private stepBacks(d: Door, side: 1 | -1, men: Guard[], taken: Vec3[], must = false): Map<Guard, Post> | null {
    const g = this.g, S = g.orders, K = DOORTOOLS, W = d.def.width, out = new Map<Guard, Post>(), off = S.knobs.jambOut, walls = new Set<number>();
    const away = yawTo(doorPt(d, W / 2, 0, side), doorPt(d, W / 2, 1, side)), out2 = stackViewReach(d) > 2.6;   // (straight out from the door, off its wall · the open-door places are live on this door)
    for (const gd of this.holders(d, side, men)) { const from = S.of(gd)!.post!, hi = alongOf(d, from) > W / 2; let found: Post | null = null;
      for (const dir of hi ? [1, -1] : [-1, 1]) { let prev: Vec3 = dir > 0 === hi ? from : doorPt(d, dir > 0 ? W + S.knobs.jambPast : -S.knobs.jambPast, off, side);
        for (const x of K.roomBack) { const q = doorPt(d, dir > 0 ? W + x : -x, off, side);
          if (g.col.nav.isBlocked(q[0], q[2]) || g.col.solidBlocked([prev[0], 0.45, prev[2]], [q[0], 0.45, q[2]]) || !stackRoomKeeps(g, d, side, q)) break;   // (the wall — or the floor, or the room: stackroom.ts — runs out)
          prev = q; if (out2 && flat(q, d.frameCentre) < flat(from, d.frameCentre) - 0.1) continue;   // (stackroom.ts, a stack waiting out of an open door's view down its wall: a step BACK is never a step toward the door, onto a place the room beyond sees — on either wall, nor on the open floor below)
          if ([...taken, ...[...out.values()].map(P => P.pos)].some(o => flat(o, q) < 0.85) || flat(q, g.orders.samStood) < 0.7) continue;
          found = { pos: q, face: walls.has(dir) ? away : yawTo(d.frameCentre, q), stackSide: S.of(gd)!.stackSide, lead: false }; walls.add(dir); break; }   // (his back to the door: the other pair has it — he has the way anybody would come at them: on along the wall; the second man on one wall, out across the floor)
        if (found) break; }
      if (!found) { const r = S.rearPosts(d, side, STACKROOM.on ? 6 : 1, [...taken, ...[...out.values()].map(P => P.pos)]).find(R => stackRoomHas(g, d, side, R.pos) && !(out2 && flat(R.pos, d.frameCentre) < flat(from, d.frameCentre) - 0.1));   // (no wall to step back along: the open floor behind the door, to a hand of it)
        if (r) found = { pos: r.pos, face: yawTo(d.frameCentre, r.pos), stackSide: S.of(gd)!.stackSide, lead: false }; }
      if (found) out.set(gd, found); else if (must && flat(from, d.frameCentre) < K.backblastM + 0.4) return null; }
    return out;
  }
  /** the stack for an order on a door other teammates hold: its own marks as if they had stepped back already, and where they step back to */
  private dealStack(d: Door, side: 1 | -1, men: Guard[]): { posts: Post[]; back: Map<Guard, Post> } | null {
    const hold = this.holders(d, side, men); if (!hold.length) { const posts = this.stackPosts(d, side, men); return posts ? { posts, back: new Map() } : null; }
    let posts = this.stackPosts(d, side, men, hold); if (!posts) { posts = this.stackPosts(d, side, men); return posts ? { posts, back: new Map() } : null; }
    const far = posts.map(P => { const a = alongOf(d, P.pos), W = d.def.width; return doorPt(d, a > W / 2 ? a + DOORTOOLS.bangFile : a - DOORTOOLS.bangFile, offOf(d, P.pos, side), side); });   // (behind a bang the file stands a place further back: kept clear too)
    const back = this.stepBacks(d, side, men, [...posts.map(P => P.pos), ...far])!;
    if (back.size < hold.length) { posts = this.stackPosts(d, side, men, [...back.keys()]); if (!posts) return null; }   // (a man who cannot step back keeps his mark: the files go past him)
    return { posts, back };
  }
  /** … and they do: still on their 'stack up' on this door — the order stands — from a place further back along the wall, as the door's rear security: gun
   *  (and light) up along the wall AWAY from it, on the way anybody answering the noise would come */
  private makeRoom(d: Door, back: Map<Guard, Post>) {
    const g = this.g, S = g.orders, name = doorWords(d);
    for (const [gd, P] of back) { const A = S.of(gd); if (!A) continue; const grp = A.group, p = P.pos;
      const hit = g.col.raycast([p[0], 1.5, p[2]], [Math.sin(P.face), 0, Math.cos(P.face)], 8), r = Math.max(1.5, (hit ? hit.t : 8) - 0.5);
      S.assign(gd, { order: 'stack', post: p, face: P.face, watch: [p[0] + Math.sin(P.face) * r, 1.1, p[2] + Math.cos(P.face) * r], door: d, shy: d, stance: 'none', upper: 'aim', light: NIGHTBREACH.opLights, stackSide: P.stackSide, going: `making room · ${name}`, there: `rear security · ${name}` });
      S.of(gd)!.group = grp; this.stats.steppedBack++; }
    if (back.size) this.note(`made room on ${d.def.name}: ${[...back.keys()].map(m => m.callsign).join(', ')}`);
  }
  /** anybody of the team — a man not on this order, whatever the squad's size, or Sam — on the FAR side of the door with a line to where a frag thrown through it
   *  would land, inside its reach (null: nobody): his callsign, or 'you' */
  private fragBehind(d: Door, side: 1 | -1, men: Guard[]): string | null {
    const g = this.g, at = this.landFor(d, side, FRAG.orderIn), land: Vec3 = [at[0], 0.3, at[2]];   // (where it is really thrown to — the plan's own spot, or as far as the floor runs clear — and the blast's own test of a body, with a metre for the roll)
    const inIt = (p: Vec3) => offOf(d, p, side) < 0 && flat(p, land) < FRAG.woundM + 1 && (exposedTo(g, land, p, [p[0], p[1] + 1.6, p[2]]) > 0 || !g.col.solidBlocked([land[0], 0.9, land[2]], [p[0], 1.1, p[2]]));
    const mate = g.guards.find(gd => gd.team === 'operative' && gd.state !== 'dead' && !men.includes(gd) && inIt(gd.char.pos));
    return mate ? mate.callsign : !g.player.down && inIt(g.player.char.pos) ? 'you' : null;
  }
  /** a teammate outside this order on the FAR side of the door, in the open reach of a charge on it (null: none) — nobody sets one with his own men behind it */
  private behind(d: Door, side: 1 | -1, men: Guard[]): Guard | null {
    const g = this.g, S = g.orders, K = DOORTOOLS; if (!S.big) return null;
    const inn = doorPt(d, d.def.width / 2, 0.45, -side as 1 | -1, 1.1);
    return S.men().find(gd => { const p = gd.char.pos; return !men.includes(gd) && offOf(d, p, side) < 0 && flat(p, d.frameCentre) < K.stunM && !g.col.solidBlocked(inn, [p[0], 1.1, p[2]]); }) ?? null;
  }
  /** is `p` in a stun can's reach through that door: beyond it (its far side, as ever: a man beside a shut door on the squad's own face is not asked
   *  about), inside `stunM`, with a line from the opening. The line is asked without THIS door's own leaf: shoved, or standing ajar, it sweeps through
   *  the point the line starts from — and the can goes in past it. Every other leaf, and the walls, still stand in the way */
  private canReach(d: Door, side: 1 | -1, p: Vec3): boolean {
    const g = this.g; if (!(offOf(d, p, side) < 0 && flat(p, d.frameCentre) < DOORTOOLS.stunM)) return false;
    const inn = doorPt(d, d.def.width / 2, 0.45, -side as 1 | -1, 1.1), col = g.col as unknown as { dynamicBoxes: unknown[] }, keep = col.dynamicBoxes; col.dynamicBoxes = keep.filter(b => b !== d.box);
    try { return !g.col.solidBlocked(inn, [p[0], 1.1, p[2]]); } finally { col.dynamicBoxes = keep; }
  }
  /** DOORTOOLS.behindSam: Sam himself beyond the door, inside a stun can's reach with a line from the opening — the test canFirst has of him, whatever the squad's size */
  private samBehind(d: Door, side: 1 | -1): boolean {
    const g = this.g, K = DOORTOOLS; if (!K.behindSam || g.player.down) return false;
    if ((g.orders as { sams?: boolean }).sams === false) return false;   // (only Sam's own squad counts him as one of ours: `sams` is a getter that arrives with the response team's own cast of orders — undefined here, so nothing changes; a cast that reaches its orders another way must ask that one)
    return this.canReach(d, side, g.player.char.pos);
  }
  /** DOORTOOLS.tossMate: a living teammate in the can's reach who is no part of this entry — not of this order; and a man of an order on its word or its
   *  gate is no part of it only while he is still on his own side of his own door (gone through it, he is in the room like anybody). Any squad size;
   *  Sam's own squad only, as samBehind (the response team's cast throws as it did) */
  private mateBehind(op: DoorOp): Guard | null {
    const g = this.g, d = op.door; if ((g.orders as { sams?: boolean }).sams === false) return null;
    const own = (x: Guard) => op.men.includes(x) || this.ops.some(o => o !== op && ((!!op.word && o.word === op.word) || (!!op.gate && o.gate === op.gate)) && o.men.includes(x) && offOf(o.door, x.char.pos, o.side) >= 0);
    return g.orders.men().find(x => !own(x) && this.canReach(d, op.side, x.char.pos)) ?? null;
  }
  /** who of ours the squad's own can through that door would catch (null: nobody): a teammate outside the order — his callsign — or 'you' */
  private canBehind(d: Door, side: 1 | -1, men: Guard[]): string | null {
    const mate = this.behind(d, side, men); return mate ? mate.callsign : this.samBehind(d, side) ? 'you' : null;
  }

  // ------------------------------------------------------------ the word
  /** what is waiting on Sam's word among these men: an order given 'on my word' (stacked or still stacking), a pair on a plain 'stack up', a pair holding
   *  outside a door it has worked ('clear from outside'), a charge set and stood off from */
  private waiting4(men: Guard[]): (DoorOp | { stack: Door; men: Guard[] })[] {
    const S = this.g.orders, out: (DoorOp | { stack: Door; men: Guard[] })[] = [];
    for (const op of this.ops) if (op.men.some(m => men.includes(m)) && !op.word && (op.onWord || op.phase === 'held' || op.phase === 'armed' || op.phase === 'standoff' || op.phase === 'place')) out.push(op);   // (a charge still being set is waited for like a pair still walking to its stack)
    for (const x of this.stacksOf(men)) out.push(x);
    return out;
  }
  /** the men among `men` standing on a plain 'stack up', a door at a time */
  private stacksOf(men: Guard[]): { stack: Door; men: Guard[] }[] {
    const S = this.g.orders, out: { stack: Door; men: Guard[] }[] = [];
    const by = new Map<Door, Guard[][]>();   // per door, the men stacked on each face of it ([0]: Sam's face)
    for (const gd of men) { const A = S.of(gd); if (gd.state !== 'dead' && A && A.order === 'stack' && A.door && A.post && A.there.startsWith('stacked')) {
      const l = by.get(A.door) ?? [[], []]; l[sideOf(A.door, A.post) === sideOf(A.door, this.g.player.char.pos) ? 0 : 1].push(gd); by.set(A.door, l); } }
    for (const [stack, [near, far]] of by) out.push({ stack, men: near.length ? near : far });   // (pairs stacked on BOTH faces of one door: the word takes the men on Sam's face of it — the others keep their stack)
    return out;
  }
  /** THE SMALL SQUAD'S WORD (DOORTOOLS.wordSmall): what of one or two teammates' waits on it — their plain stacks, but for one on a door with a charge
   *  set on it (the key is that charge's trigger first). Nothing with the switch off, and nothing for the squad of four (its word is waitingAny's) */
  stackWaits(men: Guard[]): { stack: Door; men: Guard[] }[] { return DOORTOOLS.wordSmall && !this.g.orders.big ? this.stacksOf(men).filter(x => !this.chargeOn(x.stack)) : []; }
  private stackWords(men: Guard[]): string { const S = this.g.orders; return [...new Set(this.stackWaits(men).map(x => S.whoWords(x.men)))].join(' + '); }
  /** the men among `men` with something waiting on the word */
  private waitingMen(men: Guard[]): Guard[] { const on = new Set<Guard>(); for (const x of this.waitingAny(men)) for (const m of x.men) on.add(m); return men.filter(m => on.has(m)); }
  /** … with the rooms being worked from the threshold: the word sends those in too (the pockets, then the step in) */
  /** THE MEN THE WORD IS FOR: those the orders go to — or, with the squad's only keys (cmdring.ts `only`: there is no who key to turn to them with), whoever
   *  stands waiting on it when none of those does (the maintainer, 10-22: "pressing F only releases the people blocked on it") */
  wordMen(): Guard[] { const S = this.g.orders, men = S.recipients(); if (!CMDRING.only) return men;
    if (S.big ? this.waitingAny(men).length : this.stackWaits(men).length) return men;
    const all = S.men('all'); return (S.big ? this.waitingAny(all).some(x => 'stack' in x || !this.chargeOn(x.door)) : this.stackWaits(all).length > 0) ? all : men; }   // (a set charge with nobody else waiting is not the word's: it has its own line and F blows it, as it did)
  private waitingAny(men: Guard[]): (DoorOp | { stack: Door; men: Guard[] })[] { return [...this.waiting4(men), ...this.thresholdHeld(men).filter(op => !op.word)]; }
  /** what of these men's waits on THAT door, and who (autopilot.ts — the quick key on it): 'stack' = men on a plain 'stack up' there (the word would make an
   *  open-and-clear of it), 'word' = anything else the word would send (an order given on the word, a threshold held, a charge set or being set). Null: nothing */
  waitsOn(men: Guard[], d: Door): { kind: 'stack' | 'word'; men: Guard[]; /** a stack: every man of it stands on his mark */ set: boolean } | null {
    let st: Guard[] | null = null; const S = this.g.orders;
    for (const x of this.waitingAny(men)) { if ('stack' in x) { if (x.stack === d) st ??= x.men; } else if (x.door === d) return { kind: 'word', men: x.men.filter(m => m.state !== 'dead'), set: true }; }
    return st ? { kind: 'stack', men: st, set: st.every(m => { const A = S.of(m); return !!A?.post && (A.arrived || flat(m.char.pos, A.post) < 0.6); }) } : null;
  }
  /** that set charge is on a word that has not gone yet (the key leaves it alone: it goes with the rest) */
  wordPending(c: SetCharge): boolean { return this.onPendingWord(c); }
  /** … in the HUD's words ('red + blue'; '' when nothing of theirs is waiting) */
  private waitingWords(men: Guard[]): string { const S = this.g.orders; return [...new Set(this.waitingAny(men).map(x => S.whoWords(x.men.filter(m => m.state !== 'dead'))))].join(' + '); }
  /** THE WORD. Everything waiting on it among `who` goes TOGETHER: a pair on a plain 'stack up' opens its door and goes in (from the marks it stands on), an
   *  order given 'on my word' is let go, a pair holding outside a door goes in, a set charge is blown — and they cross their thresholds on the same frame:
   *  the loud ones (a bang, a charge) begin at once, the quiet ones do not touch their doors until the last bang's blind burst has run dry (or `wordIn`
   *  seconds). Null when something went; else why not. */
  go(who: Who = 'all'): string | null { this.sync(); const men = this.g.orders.men(who); if (!this.g.orders.big) return this.wordOnHold(men) ? null : 'nobody\'s waiting for you to say go.'; const r = this.goMen(men); return r !== null && this.wordEarly(men) ? null : r; }
  /** the word at this held door is 'step in, no can': told so ('on my word · step in'), or never told what the word is under DOORTOOLS.wordNoCan (a hold
   *  given to be HELD — a plain threshold's own word, which cuts its count short, bangs its pockets as it did; a word told 'bang' stays a bang) */
  /** every door held on the word is one the word steps into with no can (wordNoCan): what the pair's go row says */
  private wordQuiet(): boolean { const K = DOORTOOLS, held = this.ops.filter(o => o.thr); return K.outsidePlain && K.wordNoCan && held.length > 0 && held.every(o => this.wordSteps(o)); }
  /** THE WORD STEPS A HELD DOOR'S MEN IN, NO CAN (wordSteps) — but not past men of the order who ran from a grenade and are not back (thrFragHold): the step
   *  in is OWED, the hold goes on (off the word, if it was on one: it goes in on its own when it goes), and it is paid in the hold's own tick (wordOwed) when
   *  they are back or the order's one wait (`thrHandWait`) is spent. The word AGAIN — outside `wordTap` of the first — pays it at once. Sam's own 'step in'
   *  row is his say there and then, and is not held. */
  private wordStepIn(op: DoorOp) {
    const T = op.thr!, t = this.g.time;
    if (!T.stepOwed && this.cutsOwe(op)) {   // DOORTOOLS.wordCuts: the jamb men are still slicing — the step in is owed to the end of their cuts (asked before the grenade's wait: the cuts first, then wordOwed asks after the men who ran)
      T.stepOwed = true; T.owedT = t; T.cutOwed = true; T.fragT = undefined; if (op.word) { op.word = null; op.worded = true; }
      this.beat(op, 'the word waits for the cuts'); this.g.say(op.lead, 'checking the doorway first.'); return; }
    if (!T.stepOwed && this.thrFragWait(op)) { T.stepOwed = true; T.owedT = t; T.fragT = undefined; if (op.word) { op.word = null; op.worded = true; } return; }
    if (T.stepOwed && t - (T.owedT ?? -1e9) < DOORTOOLS.wordTap) { if (op.word) { op.word = null; op.worded = true; } return; }   // (a second tap of the same word)
    this.wordStepGo(op);
  }
  private wordStepGo(op: DoorOp) {
    const T = op.thr!, K = DOORTOOLS; T.stepOwed = false; T.fragT = undefined; T.cutOwed = false;
    if (T.fragSaid) { T.fragSaid = false; if (T.fled?.size) this.beat(op, `on without ${[...T.fled].map(m => m.callsign).join(', ')} · ${T.handDone || (T.handW ?? 0) >= K.thrHandWait ? "the order's wait is spent" : 'not waited for'}`); }
    this.heldBeat(op); this.toStep(op);
  }
  /** … the owed step in, once a tick of the hold: true while it is still waited on ('the door waits', said once; the wait counted into the order's one) */
  private wordOwed(op: DoorOp): boolean {
    const T = op.thr!, g = this.g, t = g.time;
    if (T.cutOwed) { if (this.cutsOwe(op)) return true; T.cutOwed = false; this.beat(op, T.sliced ? 'the cuts are done · in' : t - (T.owedT ?? -1e9) >= DOORTOOLS.wordCutsCap ? `the cuts not done in ${DOORTOOLS.wordCutsCap} s · in` : 'the cuts are not waited for · in'); }   // (DOORTOOLS.wordCuts: still cutting — the hold's tick goes on below it; done, or its cap spent: in, unless men who ran are still out)
    if (!this.thrFragWait(op)) { this.wordStepGo(op); return false; }
    if (T.fragT !== undefined) T.handW = (T.handW ?? 0) + Math.min(t - T.fragT, 0.1); T.fragT = t;
    if (!T.fragSaid) { T.fragSaid = true; this.beat(op, `the door waits: ${[...T.fled!].map(m => m.callsign).join(', ')} not back`); g.say(op.men.find(m => !T.fled!.has(m)) ?? op.lead, 'hold — back on the door.'); }
    return true;
  }
  private wordSteps(op: DoorOp): boolean { const K = DOORTOOLS; return op.thr!.wordStep ?? (K.outsidePlain && K.wordNoCan && !!op.thrHold); }
  /** … and THE PAIR's, which has no word of its own but this: a room it is working from the threshold has its hold cut short there and then — the pockets,
   *  then the step in. True when a hold of these men's took it. (The four's goes with everything else on the word: goMen.) */
  private wordOnHold(men: Guard[]): boolean {
    let any = false;
    for (const op of this.thresholdHeld(men)) { if (op.word) continue; this.beat(op, 'the word'); if (this.wordSteps(op)) this.wordStepIn(op); else { op.thr!.asked = true; this.toPockets(op); } any = true; }
    return this.wordEarly(men) || any;
  }
  /** … as Sam gives it — the key, or its row on a held threshold's page: a set charge goes with it, as with the four's, and the key is stamped (a second tap
   *  inside `wordTap` is not the drill's 'stack up'). False: nothing of these men's was held */
  /** the word while a can that went in first is still in the air or its burst running: nobody is on a diagonal to cut a hold short for yet — it is kept, and
   *  taken the moment they step out (thrOut). True when a door of these men's kept it: the press is not the drill's, nor a trigger's. */
  private wordEarly(men: Guard[]): boolean {
    const ops = this.ops.filter(op => (op.thr?.first === 'can' || op.thr?.first === 'burst') && op.men.some(m => men.includes(m))); if (!ops.length) return false;
    for (const op of ops) op.thr!.early = true; this.wordKeyT = this.g.time; return true;
  }
  /** Would the word's key, pressed now with the menu that is up, be a held threshold's word (the pair's: input()'s own test below, asked and nothing given)?
   *  orders.ts asks before it takes that key for a menu's 'wait for my word' row (planlay.ts puts the row under every menu): the word outranks the row. */
  wordKeyHeld(): boolean {
    const S = this.g.orders; if (S.big || this.g.player.down) return false;
    const own = !!S.menu && this.heldOn(S.menu.target, S.menu.men).length > 0; if (!(DOORTOOLS.thrMenuWord || !S.menu || own)) return false;
    const men = S.recipients(); return this.thresholdHeld(men).some(op => !op.word) || this.ops.some(op => (op.thr?.first === 'can' || op.thr?.first === 'burst') && op.men.some(m => men.includes(m)));
  }
  private pairWord(men: Guard[]): boolean {
    if (!this.wordOnHold(men)) return false;
    this.wordKeyT = this.g.time; for (const c of this.set.filter(c => !this.onPendingWord(c) && this.keyIs(c))) this.trigger(c); return true;   // (ownblow.ts keyIs: not a charge of his own on a door they are not at)
  }
  private goMen(men: Guard[], only?: { stack: Door; men: Guard[] }[]): string | null {
    const g = this.g;
    if (DOORTOOLS.fragHold) {   // (THE WORD AGAIN while it is held for men who ran from a grenade: Sam's call — it waits for nobody)
      const held = this.fragHeld(men);
      if (held.length) { for (const o of held) { this.beat(o, 'the word again'); this.fragOn(o); } this.wordTick(); if (!(only ?? this.waitingAny(men)).length) return null; } }   // (others of these men still waiting for their FIRST word: it is given below)
    const list = only ?? this.waitingAny(men); if (!list.length) return 'nobody\'s waiting for you to say go.';   // (`only`: the small squad's word — its plain stacks, nothing else)
    holdFireOrder(g, 'go');   // (holdfire.ts: the word, by whatever road it came — what waited on it lifted nothing until now)
    const w: Word = { t0: g.time, go1: NaN }; this.words.push(w); this.stats.words++;
    for (const x of list) { const op = 'stack' in x ? this.fromStack(x.men, x.stack) : x; if (!op) continue;
      op.onWord = false; op.word = w; if (op.phase === 'ready' || op.phase === 'held' || op.phase === 'armed' || op.phase === 'thr') op.hold = 1; this.beat(op, 'the word');
      for (const gd of op.men) { const A = op.mine.get(gd); if (A && A.there.startsWith('ready')) A.there = `stacked · ${doorWords(op.door)}`; } }   // (he has it: no longer 'on your word')
    this.note(`go · ${this.ops.filter(o => o.word === w).map(o => `${o.kind} ${o.door.def.name}`).join(' + ')}`);
    this.wordTick();   // (everybody on his door already: it is now)
    return null;
  }
  /** (planmode.ts word, CMDRING.planOne) these entries, given this tick, go on ONE word — the four's own (goMen, wordTick): nobody makes a sound until
   *  every stack on it is formed (`wordStack` at most), the cans go first, a door with no can keeps its leaf for the men behind the can beside it, and
   *  they step in together (`wordIn` at most after the first sound) */
  oneWord(ops: DoorOp[]): void { const w: Word = { t0: this.g.time, go1: NaN }; this.words.push(w); for (const op of ops) { op.word = w; this.beat(op, 'the word'); } }
  /** a pair standing on a plain 'stack up' becomes an open-and-clear from the very marks it stands on */
  private fromStack(men: Guard[], d: Door): DoorOp | null {
    const S = this.g.orders, first = S.of(men[0]); if (!first?.post) return null;
    const side = sideOf(d, first.post), name = doorWords(d), W = d.def.width;
    const posts = men.map(gd => { const A = S.of(gd)!; return { pos: v3.copy(A.post!), face: A.face ?? gd.char.bodyYaw, stackSide: A.stackSide, lead: A.stance === 'stack' } as Post; });
    const on = men.map(gd => S.of(gd)!.arrived);
    const op = this.newOp('openClear', d, side, men, 'stack');
    let lead: Guard | null = null, la = -Infinity;
    men.forEach((gd, i) => { const P = posts[i]; op.post.set(gd, P);
      this.assign(op, gd, { post: P.pos, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: P.lead ? 'stack' : 'highReady', upper: 'none', stackSide: P.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` });
      if (on[i]) { const A = op.mine.get(gd)!; A.arrived = true; A.arrT = this.g.time; }   // (he is standing on it: the word does not wait a frame for him to arrive again)
      const a = (P.lead ? 10 : 0) - Math.abs(alongOf(d, P.pos) - (W + S.knobs.jambPast)); if (a > la) { la = a; lead = gd; } });   // (the man on the latch jamb; else the nearest it)
    op.lead = lead ?? men[0];
    this.beat(op, `from the stack · ${men.map(m => m.callsign).join(', ')} · lead ${op.lead.callsign}`);
    return op;
  }
  /** once a frame (and on the word itself): the words' two moments */
  private wordTick() {
    const g = this.g, K = DOORTOOLS, t = g.time;
    for (const w of [...this.words]) {
      const ops = this.ops.filter(o => o.word === w); if (!ops.length) { this.words.splice(this.words.indexOf(w), 1); continue; }
      if (isNaN(w.go1)) {   // nobody makes a sound until everybody is on his door (or the late pair has had its time)
        if (K.fragHold && ops.some(o => this.fragWait(o))) { w.t0 += Math.min(t - (w.fledT ?? t), 0.1); w.fledT = t; continue; }   // (men of a door on this word ran from a grenade and are not back: nobody makes a sound yet — `fragHoldCap` a door at most — and the word's own clock for a late door does not run meanwhile)
        if (K.fragHold) w.fledT = undefined;
        if (!ops.every(o => o.hold >= 1) && t - w.t0 < K.wordStack) continue;
        w.go1 = t;
        for (const op of ops) { if (op.hold < 1) { op.word = null; continue; }   // (too late: it carries on alone)
          if (K.fragHold) this.fragOn(op);   // (the signal has gone: nothing of this door waits from here)
          if (op.kind === 'charge') { const c = this.chargeOn(op.door); if (c) this.blow(c); else op.word = null; }   // → 'wait'
          else if (op.phase === 'held') op.hold = 2;
          else if (op.kind === 'threshold' && op.thr) { op.hold = 0; if (op.phase === 'thr') { if (this.wordSteps(op)) this.wordStepIn(op); else { op.thr.asked = true; this.toPockets(op); } } }   // (its men on the jambs already: the pockets now, with the loud ones — and it crosses with the rest, from 'wait')
          else if (op.kind === 'threshold') { op.hold = 0; op.word = null; op.worded = true; this.open(op); }   // (it begins with the loud ones and goes in on its own count: the room is worked for as long as it takes, and nobody else's entry waits on that)
          else if (op.kind === 'bangClear') { op.hold = 0; this.open(op); }
          else if (!isOpen(op.door) && (this.lockedOut(op.door, op.side) || (op.big && BIGSLOT.shut && !op.noGun && this.bigOpens(op.door, op.men)) || toolSpot(this.g, op.door, op.side, op.lead.char.pos, true, true))) { op.hold = 0; this.open(op); }   // (a locked door: its man onto the kick spot now — the boot itself waits; an unlocked one whose lead is not at its handle: onto the handle's place now, handleside.ts — the shove waits)
          else op.hold = 2; }
      }
      const left = this.ops.filter(o => o.word === w);
      if (!left.every(o => o.hold === 2) && (t - w.go1 < K.wordIn || left.some(o => o.frag && o.hold !== 2 && !o.can?.fired))) continue;   // (a frag on this word that has not gone off yet: nobody on the word goes in on it, however long its door takes)
      this.words.splice(this.words.indexOf(w), 1);
      for (const op of left) { op.word = null; if (op.hold !== 2) continue; op.hold = 0;
        if (op.phase === 'ready') this.open(op); else if (op.phase === 'wait' || op.phase === 'held') this.enter(op); }   // (a man on his kick spot: the 'kick' stage sees the word gone and boots it)
    }
  }
  /** on his door, ready: the leaf is opened — the shove, or the boot from the kick spot when it is locked against the team */
  private open(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, t = g.time, lead = op.lead, name = doorWords(d);
    if (isOpen(d)) { this.beat(op, 'open already');
      if (Math.abs(d.angle) < 1.2) { d.closing = false; d.vel = (Math.sign(d.angle) || 1) * Math.max(Math.abs(d.vel), K.shove); d.quietT = -1; d.lastWho = lead.char.id; }   // (a leaf standing half open is pushed the rest of the way: a can thrown at it comes back off it)
      this.opened(op); return; }
    if (this.lockedOut(d, op.side)) {   // locked against the team: the boot, from the kick spot — then back onto his jamb
      if (!(op.big && this.bigOpens(d, op.men)) && this.haltAt(op)) return;   // (DOORTOOLS.testDoor — locked or wedged since the stack was made, and nobody knew; the big slot's own row asked for the tool whatever the lock: nothing to hold on)
      if (d.def.steel) { g.say(lead, "it's steel. no way through."); this.end(op, 'steel and locked'); return; }
      if (silentPick(g) && this.pickable(d)) { this.toPick(op); g.say(lead, 'locked. picking.'); return; }   // (silent.ts: a silent squad's way through a lock — the 'kick' stage, pickStep)
      if (this.frameHeld(d, op.side) && this.bigOpens(d, op.men) && this.toGun(op)) return;   // (bigkit.ts: it opens toward them and a man carries the hammer or the breaching shotgun in his big slot — the lock itself is broken and a hand pulls the leaf; a silent squad keeps to the pick below)
      if (this.frameHeld(d, op.side) && this.frameAnswer(op)) return;   // it opens toward them: the frame is behind the leaf and a boot will not shift it (doors.ts DOORWAY.frameHolds) — a cylinder is picked, loud squad or not; anything else wants a charge, and the order ends here as it does on steel
      const stuck = this.pickable(d) ? null : d.lockId.startsWith('wedge:') ? 'wedged from inside' : 'keypad, no code';   // (no pick opens it — steel has gone above)
      const boot = stuck ? silentBoot(g, d) : null;   // (silent.ts: a COMPROMISED silent squad boots the door nothing quiet opens — and stays silent)
      if (!boot && silentNoBoot(g)) { g.say(lead, stuck && SILENT.bootWedged ? `${stuck}. no quiet way in. go loud and we boot it.` : wg("locked. can't kick it while we're silent.", 'locked. no boot while we are silent.')); this.end(op, 'locked · silent: no boot'); return; }   // (silent.ts: the boot is a loud tool, and nobody picked one)
      if (!boot && this.toGun(op)) return;   // (shotgun.ts: a man of the stack with a breaching shotgun takes the lock from beside the frame — the 'kick' stage, gunStep)
      const ks = this.bootSpot(d, op.side);
      op.kick = { pos: ks.pos, yaw: ks.yaw, t: NaN }; op.phase = 'kick'; op.t0 = t;
      this.assign(op, lead, { post: ks.pos, face: ks.yaw, watch: null, stance: 'none', upper: 'none', going: `on the door · ${name}`, there: 'breaching' });
      if (!boot) g.say(lead, 'locked. kicking it.'); else { this.beat(op, 'silent boot'); if (boot === 'first') g.say(lead, `${stuck}. booting it.`); }
    } else {
      if (op.big && BIGSLOT.shut && this.bigOpens(d, op.men) && this.toGun(op)) return;   // (bigkit.ts: the big slot's own row on a door that is not locked — the latch broken with the tool from beside the frame, the 'kick' stage as on a lock)
      if (!this.toHandle(op, false)) { this.shove(op); this.opened(op); }   // (handleside.ts: a lead who is not at the handle — filed on the hinge jamb, out of reach, in its swing — steps to it first: the 'kick' stage, handStep)
    }
  }
  /** the lead of an unlocked door sent to its handle (handleside.ts toolSpot) — false: he is at it, or it cannot be walked to, and nothing is begun. `gate`
   *  (DOORTOOLS.gateHand): he is sent while the boot beside him on the same signal is still to land, and holds the shove for it (handStep) */
  private toHandle(op: DoorOp, gate: boolean): boolean {
    const g = this.g, d = op.door, lead = op.lead, hs = toolSpot(g, d, op.side, lead.char.pos, false, true);   // (`order`: a door order's lead — HANDLE.toolNear's near stand, or his own mark and no step at all)
    if (!hs) return false;
    op.kick = { pos: hs.pos, yaw: hs.yaw, t: NaN, hand: true, gate }; op.phase = 'kick'; op.t0 = g.time;
    this.assign(op, lead, { post: hs.pos, face: hs.yaw, watch: null, stance: 'none', upper: 'none', going: `on the door · ${doorWords(d)}`, there: 'on the handle' });
    return true;
  }
  /** is a door beside this one on its signal still to be booted in (its man walking to the boot, or the sole not landed): a door that only wants a hand goes with it */
  private bootBeside(op: DoorOp): boolean {
    const G = op.gate; if (!G) return false;
    return G.ops.some(o => o !== op && this.ops.includes(o) && isNaN(o.openT) && !(op.kind === 'bangClear' && o.kind === 'openClear') && ((o.phase === 'kick' && !o.kick?.gate) || (o.phase === 'stack' && this.willKick(o))));   // (a hand door waiting on the same boot is no boot)
  }
  private gateAsked = new SideSet<DoorOp>();
  /** the lead on his way to the handle of an unlocked door (open(), handleside.ts toolSpot): there — or `kickCap` run out, and then from where he has got to, as
   *  it always was — he shoves it and goes back onto his jamb, like the boot's own man; on a word he waits there for it, the shove his crossing */
  private handStep(op: DoorOp, el: number) {
    const d = op.door, lead = op.lead, word = !!op.word && op.kind !== 'bangClear';
    if (isOpen(d)) { op.kick = null; this.backToJamb(op, lead); if (word) { op.phase = 'ready'; op.hold = 2; } else this.opened(op); return; }   // (somebody else opened it)
    if (this.lockedOut(d, op.side)) { op.kick = null; this.open(op); return; }   // (locked or wedged against them while he walked: the lock's own tools)
    if (!toolStep(this.g, lead, op.kick!.pos) && el < DOORTOOLS.kickCap) return;
    if (op.kick!.gate) op.kick!.onIt = true;   // (gateHand: his hand on it — what the boot beside him was waiting for)
    if (word) { op.hold = 2; return; }
    if (op.kick!.gate && this.bootBeside(op)) return;   // (… and he for the boot)
    this.shove(op); op.kick = null; this.backToJamb(op, lead); this.opened(op);
  }

  /** n marks in file along the wall, `standoff` metres past a jamb on face `side` (the latch side first), nearest the door first — null: no wall has the floor */
  standoffPosts(d: Door, side: 1 | -1, n: number, men: Guard[] = []): Post[] | null {
    // (stackroom.ts: a stand-off mark is on the floor of the room that face is in too — dealt again clear of the backblast where it was not)
    const g = this.g, fix = (P: Post[] | null) => stackRoomFix(g, d, side, P, [g.player.char.pos, ...g.orders.heldOn(d, men)], DOORTOOLS.backblastM + 0.2);
    if (!(PICTURE.on && PICTURE.standoff && anyIdea(g, men))) return fix(this.standoffPostsAsWere(d, side, n, men));
    // (picture.ts: with an enemy known, every file the wall has room for is weighed AS THE MEN WILL STAND IT — after the room rule above has had its say — and
    // the first no known enemy has a line to is taken, the latch side's among equals; a file the men cannot walk to as it would be dealt is no file: the
    // very test the row's why-not makes of the answer (standoffWalk; orders.ts keeps a walk's answer under a second, so the row's own asking is not paid twice))
    const files: Post[][] = [], first = this.standoffPostsAsWere(d, side, n, men, files);
    const whole = files.map(fix).filter((F): F is Post[] => !!F); if (!whole.length) return fix(first);
    const ranked = safestSets(g, men, whole), pick = ranked.find(F => men.length === n ? !this.standoffWalk(men, d, F) : F.every(P => men.some(m => !g.orders.reach(m, P.pos)))) ?? whole[0];   // (a men list that is not the deal's: each mark walkable by one of them)
    if (pick !== whole[0]) PICTURE_STATS.moved++;
    return pick;
  }
  /** the marks as the wall deals them: the first file with room (`files`: every such file is also handed back, in that order) */
  private standoffPostsAsWere(d: Door, side: 1 | -1, n: number, men: Guard[] = [], files?: Post[][]): Post[] | null {
    const g = this.g, K = DOORTOOLS, W = d.def.width, nav = g.col.nav, front = doorPt(d, W / 2, g.orders.knobs.jambOut, side, 0.45);
    const th = d.def.closedDir, ux = Math.cos(th), uz = Math.sin(th);
    for (const off of K.standoff) for (const dir of [1, -1] as const) {   // dir +1: out past the latch; −1: out past the hinge
      const out: Post[] = [];
      for (let k = 0; k < n; k++) {
        const a = dir > 0 ? W + off + k * g.orders.knobs.fileGap : -off - k * g.orders.knobs.fileGap; const pos = doorPt(d, a, g.orders.knobs.jambOut, side);
        if (nav.isBlocked(pos[0], pos[2]) || g.col.solidBlocked(front, [pos[0], 0.45, pos[2]])) break;
        const fx = -ux * dir, fz = -uz * dir;   // facing back along the wall at the door
        out.push({ pos, face: Math.atan2(fx, fz), stackSide: ((uz * side) * (-fz) + (-ux * side) * fx >= 0 ? 1 : -1) as -1 | 1, lead: k === 0 });
      }
      if (out.length === n) { if (!files) return out; files.push(out); }
    }
    if (files?.length) return files[0];
    if (n > 2) for (const off of K.standoff) {   // three or more with no one wall long enough: a file out past each jamb (the longer past the latch), nearest the door first
      const fileOf = (dir: 1 | -1): Post[] => { const out: Post[] = [];
        for (let k = 0; k < n; k++) { const a = dir > 0 ? W + off + k * g.orders.knobs.fileGap : -off - k * g.orders.knobs.fileGap; const pos = doorPt(d, a, g.orders.knobs.jambOut, side);
          if (nav.isBlocked(pos[0], pos[2]) || g.col.solidBlocked(front, [pos[0], 0.45, pos[2]])) break;
          const fx = -ux * dir, fz = -uz * dir; out.push({ pos, face: Math.atan2(fx, fz), stackSide: ((uz * side) * (-fz) + (-ux * side) * fx >= 0 ? 1 : -1) as -1 | 1, lead: false, group: dir > 0 ? 0 : 1 }); }
        return out; };
      const A = fileOf(1), B = fileOf(-1); let na = Math.min(A.length, Math.ceil(n / 2)); const nb = Math.min(B.length, n - na); na = Math.min(A.length, n - nb);
      const out: Post[] = []; for (let k = 0; k < Math.max(na, nb); k++) { if (k < na) out.push(A[k]); if (k < nb) out.push(B[k]); }
      if (out.length < n) out.push(...g.orders.rearPosts(d, side, n - out.length, out.map(o => o.pos)));   // (… and a door in a corner: the rest stand back from it — rearPosts' marks are two metres and more off the frame line, outside the backblast)
      if (out.length < n) continue;
      out[0].lead = true; return out;
    }
    const M = g.orders.doorMarks.find(m => m.door === d && m.side === side);   // no wall has the floor: the marks somebody authored for this face (orders.ts doorMarks)
    const marks = M ? (M.standoff.length >= n ? M.standoff.slice(0, n) : null) : g.orders.workedPick(d, side, n, [g.player.char.pos, ...g.orders.heldOn(d, men)], K.backblastM + 0.2);   // … or, on a face with no floor at either jamb and none authored, the ones the men work out for themselves (orders.ts workedMarks), clear of the backblast
    if (marks) return marks.map((p, k) => { const face = yawTo(p, d.frameCentre), fx = Math.sin(face), fz = Math.cos(face);
      return { pos: v3.copy(p), face, stackSide: ((uz * side) * (-fz) + (-ux * side) * fx >= 0 ? 1 : -1) as -1 | 1, lead: k === 0 }; });
    if (g.orders.knobs.hallFile) {   // a face with a passage's wall behind a jamb (orders.ts hallPlaces): the file back down it, from beyond the backblast
      const sam = g.player.char.pos, held = g.orders.heldOn(d, men), hall = g.orders.hallPlaces(d, side, n, K.backblastM + 0.4, q => flat(sam, q) < 0.7 || held.some(h => flat(h, q) < 0.7));
      if (hall.length === n) return hall.map((P, k) => ({ pos: P.pos, face: P.face, stackSide: P.stackSide, lead: k === 0 }));
    }
    return null;
  }

  // ------------------------------------------------------------ once a frame
  /** Sam's key (Game.update, before the night breach reads the same one). The squad of four: it is THE WORD while anything of the men the orders go to is
   *  waiting on it — the 'go' order, given to them without the menu (a set charge of theirs goes with it; a breach drill of theirs stacked on its own door is
   *  sent in by the same press, which is left in the frame for it). Else a set charge has the press — the trigger, as ever — unless the charge is already on a
   *  word that is waiting for the other pair (the word has it: blown now, its men would stand outside a blown door until then). And the press never reaches
   *  the drill as its 'stack up' while the drill's pair is on a door order of Sam's, or within `wordTap` of a word: a second tap does not pull red out of
   *  the entry the first one sent it on. */
  /** the frag row's key (G) with the menu on the page that shows it: the press is that row's — given, or refused in the row's words — and never Sam's
   *  quick-throw. Called straight after the menu's own input and BEFORE the player reads the key (game.ts). */
  menuKey(input: Input): boolean {
    const S = this.g.orders, M = S.menu, key = FRAG.orderKey; if (!M || !input.hit(key)) return false;
    const i = M.rows.findIndex(d => d.id === 'fragClear'); if (i < 0) return false;
    input.pressed.delete(key); S.pick(i); return true;   // (true: the press was the row's — the caller keeps the rest of this key press from the quick-throw)
  }
  /** the big slot's row is on a key of its own (H — BIG_KEY) with a DOOR's menu up: on the tools page it is that row; on the door's first page — whose
   *  'door tools' row shows the key — the page is turned and the row given in the one press: X, H. Refused, it is refused in the row's words. Called beside
   *  menuKey (game.ts). True: the press was the row's. */
  bigKey(input: Input): boolean {
    const S = this.g.orders, M = S.menu; if (!M || !this.bigRow || M.target.kind !== 'door' || !input.hit(BIG_KEY)) return false;
    let i = M.rows.findIndex(d => d.id === BIG_ORDER);
    if (i < 0) { const o = M.rows.findIndex(d => d.opens === TOOLS_PAGE); if (o < 0) return false; S.pick(o); i = S.menu ? S.menu.rows.findIndex(d => d.id === BIG_ORDER) : -1; if (i < 0) return false; }
    input.pressed.delete(BIG_KEY); S.pick(i); return true;
  }
  input(input: Input) {
    this.sync();
    const K = DOORTOOLS, g = this.g, S = g.orders, NB = g.nightBreach, key = K.blowKey;
    if (!input.hit(key)) return;
    if (g.player.down) { if (this.set.some(c => this.keyIs(c))) input.pressed.delete(key); return; }   // (Sam down: nothing goes, and a set charge still keeps the press from the drill)
    // (with a menu up that shows the 'go' row, the key IS that row, as a digit is its own: the word goes to who the row names — the one man a menu opened on
    // a teammate is for — or, greyed, is refused in the row's words; either way the menu is away and the press is neither the trigger's nor the drill's)
    const four = K.wordOnKey && S.big, M = four ? S.menu : null, row = M ? M.rows.findIndex(d => d.hotKey === key) : -1;   // ('go' — or, on the page of a held threshold, its own word row)
    if (!S.big) {   // the pair working a room from the threshold: the key is its word — the pockets, then the step in — and a set charge goes with it, as with the four's
      // (on the held threshold's own page the key IS its row, as for the four: given — or, greyed, refused in the row's words — and the menu away; the press is
      // never the drill's as well)
      const i = S.menu ? S.menu.rows.findIndex(d => d.hotKey === key) : -1; if (i >= 0) { input.pressed.delete(key); S.pick(i); return; }
      if (g.time - this.wordKeyT < K.wordTap) { input.pressed.delete(key); return; }   // (a second tap is not the drill's 'stack up', nor a trigger: stamped only by the word)
      const own = !!S.menu && this.heldOn(S.menu.target, S.menu.men).length > 0;   // (the held door's OWN menu words its fifth row 'F: go': the key is the word there whatever the switch says)
      if ((K.thrMenuWord || !S.menu || own) && this.pairWord(S.recipients())) { input.pressed.delete(key); S.close(); return; }   // (with no menu, or any other: a menu that is up goes away, as it does for the four's word)
      // … and the men standing on a plain stack (wordSmall): the word sends them in, a free set charge goes with it — the pair's word again. To the men a
      // menu that is up is for (one opened on a teammate: him), and AGAIN — outside `wordTap` of the first — for a word held for men who ran from a grenade
      if (K.wordSmall) { const men = S.menu ? S.recipients(S.menu.target) : this.wordMen();
        if (this.stackWaits(men).length || (K.fragHold && g.time - this.wordKeyT >= K.wordTap && this.fragHeld(men).length > 0)) { input.pressed.delete(key); const p = g.player.char.pos; S.close();
          if (S.give('go', { kind: 'none', at: [p[0], 0, p[2]] }, undefined, { men }) === null) { this.wordKeyT = g.time; for (const c of this.set.filter(c => !this.onPendingWord(c) && this.keyIs(c))) this.trigger(c); }
          return; } }
    }
    const men = four ? (row >= 0 ? S.recipients(M!.target) : this.wordMen()) : [];
    const again = four && K.fragHold && g.time - this.wordKeyT >= K.wordTap && this.fragHeld(men).length > 0;   // (the word AGAIN, on a word held for men who ran from a grenade; a second tap inside `wordTap` of the first is not it)
    const waiting = this.waitingAny(men).length > 0 || again;
    if (waiting || row >= 0) {
      const st = NB.state; if (!(waiting && (st === 'set' || st === 'stacking') && NB.drillOps.some(m => men.includes(m)))) input.pressed.delete(key);
      if (row >= 0) S.pick(row); else { const p = g.player.char.pos; S.close(); S.give('go', { kind: 'none', at: [p[0], 0, p[2]] }, undefined, CMDRING.only ? { men } : undefined); }   // (cmdring.ts only: to the men found waiting, wordMen)
      if (waiting) this.wordKeyT = g.time;
      return;
    }
    if (four && this.wordEarly(S.recipients())) { input.pressed.delete(key); S.close(); return; }
    const mine = this.set.filter(c => this.keyIs(c));   // (ownblow.ts: a charge of his own that the squad is not at is not this key's, and does not stop the press here)
    if (mine.length) {
      input.pressed.delete(key);
      const free = mine.filter(c => !this.onPendingWord(c)); if (!free.length) return;
      const sam = g.player.char.pos; this.trigger(free.sort((a, b) => flat(a.door.frameCentre, sam) - flat(b.door.frameCentre, sam))[0]);
      return;
    }
    // (wordSmall: one or two teammates the word sent in are not the drill's to pull back out with a second press, any more than the four's are)
    if ((four || (K.wordSmall && !S.big)) && NB.state === 'staged' && (g.time - this.wordKeyT < K.wordTap || NB.drillOps.some(m => this.ops.some(o => o.men.includes(m))))) input.pressed.delete(key);
  }
  /** a set charge whose order is on a word that has not gone yet (it is waiting for the others to reach their doors) */
  private onPendingWord(c: SetCharge): boolean { return this.ops.some(o => o.kind === 'charge' && o.door === c.door && !!o.word && isNaN(o.word.go1)); }
  /** Sam's trigger as he pulls it (F, or the menu's 'blow the charge'): that charge — and, when its door is one of the `linked`, every other set charge on them
   *  (set is set: a linked charge whose men are still walking off it goes too, as the nearest one does on any F — the trigger is Sam's to time) */
  trigger(c: SetCharge | null = this.nearest()) {
    if (!c) return;
    const also = this.linked.includes(c.door) ? this.set.filter(o => o !== c && this.linked.includes(o.door)) : [];
    this.blow(c); for (const o of also) this.blow(o);
  }
  private nearest(of: (c: SetCharge) => boolean = () => true): SetCharge | null { const p = this.g.player.char.pos; return this.set.filter(of).sort((a, b) => flat(a.door.frameCentre, p) - flat(b.door.frameCentre, p))[0] ?? null; }
  /** Game.update, right before orders.tick() poses the men */
  tick() {
    const g = this.g, S = g.orders;
    this.sync();
    this.slingTick();
    hammerOutTick(g, gd => this.ops.some(o => o.phase === 'kick' && o.kick?.gun?.by === gd && !!o.kick.gun.hammer));   // (bigkit.ts, BIGSLOT.moves: a hammer off a back is in nobody's hands without a door to swing it at — and the animator is told where each beat stands)
    this.samTick();   // (owncharge.ts: a charge going on by the player's own hands — nothing runs with the switch off)
    if (!this.roster.length) { if (this.set.length) this.tickSet(); return; }   // (alone: a charge he set himself is still drawn, and still comes off a door that opens)
    if (DOORTOOLS.leadSeen || this.seenWatch) (this.seen ??= new FloorSeen(g)).tick(this.roster, DOORTOOLS.leadSeenM);
    this.keepSectors();
    if (DOORTOOLS.testDoor) this.testStacks();
    this.walkTried();   // (ORDERS.walkTries — a man carries `tries` only by that key: with it off nobody does. Asked with testDoor off too, so one turned off under a walk leaves no man on an order that cannot end)
    for (const op of [...this.watches]) if (!this.otherDoors(op, true)) this.watches.splice(this.watches.indexOf(op), 1);   // (a taken room's other doors, for as long as a man of that entry still holds it)
    this.tickSet();   // (a charge is on a SHUT leaf: one that comes open — a defender, an entry order — has dropped it)
    for (const op of [...this.ops]) {
      op.men = op.men.filter(gd => gd.state !== 'dead' && S.of(gd) === op.mine.get(gd));
      for (const gd of op.men) if (!op.crossed.has(gd) && offOf(op.door, gd.char.pos, op.side) < -0.15 && alongOf(op.door, gd.char.pos) > -0.6 && alongOf(op.door, gd.char.pos) < op.door.def.width + 0.6) { op.crossed.set(gd, g.time); this.beat(op, `cross:${gd.callsign}`); }
      if (!op.men.length) { this.end(op, 'nobody left on it'); continue; }
      if (!op.men.includes(op.lead)) { const L = op.post.get(op.lead);   // (the lead is gone: with one man left it is his; with more, the man whose mark is nearest the lead's — the next in HIS file, not the first on the roster from the far jamb)
        op.lead = L && op.men.length > 1 ? [...op.men].sort((a, b) => flat(op.post.get(a)?.pos ?? a.char.pos, L.pos) - flat(op.post.get(b)?.pos ?? b.char.pos, L.pos))[0] : op.men[0]; this.newLead(op); }
      if (!isNaN(op.openT) && g.time - op.openT < DOORTOOLS.holdOpen && op.door.quietT > -1 && isOpen(op.door)) op.door.quietT = -1;   // (kept from its closer while the entry is on)
      // REAR SECURITY while the door is worked (COVER.stacked): until the entry itself, the file's last man has his eyes spare for the way a man could come
      // at the stack — he turns in as the can, the boot or the shove goes
      if (DOORTOOLS.threatFirst) this.threatNote(op);
      if (PRE.includes(op.phase)) this.spareRear(op);
      else for (const gd of op.men) { const A = op.mine.get(gd); if (!A) continue; A.spare = !!op.thr && op.phase !== 'enter' && op.rear.has(gd); if (A.spare) A.from ??= op.from.get(gd); }   // the door is going: every gun on it (the entry's end may hand the room's openings out again, below — its last act) — but a room worked from the threshold keeps the men who are not at the frame on the squad's back until they step in
      this.step(op);
      if (this.ops.includes(op) && PRE.includes(op.phase)) this.spareRear(op);   // (a step that handed out new marks: the rear man keeps his job across it)
    }
    if (this.words.length) this.wordTick();
    for (const op of [...this.ops]) if (op.gate && op.phase === 'stack' && !isNaN(op.readyT) && op.gate.ops.some(o => o !== op && o.openT === g.time)) this.step(op);   // a door on a gate that had its turn above before the boot it was waiting on landed: with it, this frame (its turn above did nothing)
  }
  private arrived(op: DoorOp, gd: Guard) { return !!op.mine.get(gd)?.arrived; }
  /** rear security while the door is worked (orders.ts spareRear) — less the far gun a threshold has set on its diagonal (DOORTOOLS.thrSet): his eyes are the door's */
  private spareRear(op: DoorOp) {
    this.g.orders.spareRear(op.men, op.door, op.lead, op.from);
    const f = op.thrPre?.far, A = f ? op.mine.get(f) : null; if (A) A.spare = false;
    const B = op.lane ? op.mine.get(op.lane.gd) : null; if (B) B.spare = false;   // (doorway.ts stackCover: the open door is his, not the way they came)
  }
  /** is a walk to the marks still worth waiting on: somebody not yet there has moved inside the last `stillSecs` (a long way to come is not a failure), up to `stackCap` */
  private waiting(op: DoorOp, el: number): boolean {
    const g = this.g, K = DOORTOOLS; if (el >= K.stackCap) return false;
    return el < K.stillSecs || op.men.some(gd => { const A = op.mine.get(gd)!; return !A.arrived && g.time - A.movedT < K.stillSecs; });
  }
  /** somebody not yet on his mark is not walking because the fight has him, or he cannot see (an order on a gate waits on him — up to `stackCap`) */
  private busy(op: DoorOp, el: number): boolean {
    const g = this.g; return el < DOORTOOLS.stackCap && op.men.some(gd => { const A = op.mine.get(gd)!; return !A.arrived && (A.yieldT >= 0 || g.time < gd.dazzledUntil); });
  }
  private end(op: DoorOp, why: string) {
    const i = this.ops.indexOf(op); if (i < 0) return; this.ops.splice(i, 1);
    this.defuse(op); this.offLock(op); if (op.bangHeld) { op.bangHeld = false; this.refund(op.frag ? 'frag' : 'bang'); }
    this.pieOff(op);
    this.beat(op, `end: ${why}`);
    this.done.push(Object.assign(op, { ended: why })); if (this.done.length > 12) this.done.shift();
  }
  /** a canister this op threw and has not fired: left to its own short fuse (never a live can lying about for the long fuse it was thrown on) */
  private defuse(op: DoorOp) { const it = op.can; if (it && !it.fired && op.pass) { it.pos = v3.copy(op.pass.to); it.vel = v3.copy(op.pass.v0); it.heading = v3.yawOf(op.pass.v0); it.bounces = 0; it.settled = false; }   // (bangInto: an order cut short while the can is on its way to the door's edge — it goes in from there all the same, not on down the wall on our side)
    op.pass = undefined; if (it && !it.fired && it.kind !== 'frag') it.fuse = Math.min(it.fuse, DOORTOOLS.fuseAfterLand); }

  private step(op: DoorOp) {
    if (DOORTOOLS.fragHold && this.g.orders.sams && (op.phase === 'kick' || PRE.includes(op.phase)) && this.fragStep(op)) return;   // (men of the order ran from a grenade and are not back: the door is not opened yet)
    const g = this.g, K = DOORTOOLS, d = op.door, t = g.time, el = t - op.t0, lead = op.lead, name = doorWords(d);
    if (op.thr && op.phase !== 'thr') this.pieOff(op);   // (thrPie: the hold is over — the word, a step in, the pockets — with a man mid-cut)
    switch (op.phase) {
      case 'stack': {
        if (op.lane) {   // doorway.ts DOORMANNERS.stackCover: a man of this stack is on the door standing open onto it — up to his mark once the lead is on his and what is beyond it has been quiet
          const KM = DOORMANNERS, L = op.lane, gd = L.gd, A = op.mine.get(gd), mine = !!A && A === L.cover && gd.state !== 'dead' && op.men.includes(gd), O = mine ? g.fight.opOf(gd) : null; let hot = false;
          if (O) for (const [h, M] of O.meters) if (h.state !== 'dead' && t - M.seenT < KM.coverQuiet) { hot = true; break; }
          const there = mine && (A!.arrived || (hot && !!A!.post && flat(gd.char.pos, A!.post) < 0.5));   // (his gun on a man off the line he was given is not 'left his place')
          if (mine) { A!.searchT = t; if (there && L.at === undefined) L.at = t; }
          const set = lead.state === 'dead' || this.arrived(op, lead) || !this.waiting(op, el);
          if (!mine || (L.at !== undefined && t - L.at >= KM.coverCap) || this.lastCall(op) || (!hot && A!.arrived && t - A!.arrT >= KM.coverLook && set)) this.laneIn(op);
          else if (there && (hot || this.arrived(op, lead))) break;   // (a living man in his eyes, or his gun only just on the opening with the lead already on the door: the door waits for him, `coverCap` at most)
        }
        if (isNaN(op.readyT)) {
          const pre = op.thrPre;   // (once the far gun has been sent the stack WAS made: only he is waited on — and a new lead still walking to the jamb — not a man an ear has turned)
          const last = !pre && this.lastCall(op);   // (DOORTOOLS.thrLast: the captor's last warning — the door does not wait for a man still walking up, nor for the far gun's set)
          if (last && !op.lastStack) { this.lastStack(op); if (op.lead !== lead) break; }   // (the door handed to the jamb man who IS there: his from the next tick)
          if (!op.lastStack && (pre ? flat(lead.char.pos, op.post.get(lead)?.pos ?? lead.char.pos) > 0.6 : !op.men.every(gd => this.arrived(op, gd))) && (this.waiting(op, el) || (op.gate !== null && this.busy(op, el)))) break;
          if (flat(lead.char.pos, op.post.get(lead)?.pos ?? lead.char.pos) > 1.5) { g.say(lead, "can't get on that door."); this.end(op, 'never made the stack'); break; }   // (against the mark he was sent to — orders.ts moves a stuck man's own post to where he stands — and it is the man who opens it that has to be there)
          if (!pre) { if (op.kind === 'threshold' && K.thrSet && !op.onWord && !op.word && !this.canFirst(op) && !last) { this.thrSetFar(op); if (op.thrPre) break; } }   // (the far gun onto its diagonal is the stack's last step: a gate waits on it like on any man still walking)
          else { const f = pre.far, A = op.mine.get(f);   // (… and 'stacked' waits for him: there, or stopped as near it as the floor lets him with his gun round, or `thrSetSecs`)
            if (A && f !== lead && f.state !== 'dead' && !A.arrived && !isOpen(d) && t - pre.t < K.thrSetSecs && (t - Math.max(A.movedT, pre.t) < 0.3 || Math.abs(wrapAngle(f.char.aimYaw - (A.face ?? f.char.aimYaw))) > 0.2)) break; }
          if (op.lane) { this.laneIn(op); break; }   // (the stack is made with who is there — not with a man left out on a door behind it)
          op.readyT = t; this.beat(op, 'stacked');
          if (!(op.big && this.bigOpens(d, op.men)) && this.haltAt(op)) break;   // (DOORTOOLS.testDoor: the lead tries the handle — never under the big slot's own row, which asked for the tool whatever the lock — a door nobody knew was locked or wedged is said, and the order stops here)
        }
        if (op.onWord || op.word) {   // given 'on my word' (or let go by one while still walking): on the door, nothing begun — it waits
          op.phase = 'ready'; op.hold = 1; op.t0 = t; this.beat(op, 'ready');
          if (op.onWord) { g.say(lead, WORDS.on ? 'set.' : 'ready.');   // (one word for 'stacked and waiting', the squad's own: orders.ts setLine)
          for (const gd of op.men) { const A = op.mine.get(gd); if (A) A.there = `ready on your word · ${name}`; } }
          break; }
        const G = op.gate;
        if (G) {   // one signal for several doors: not before the others are stacked and the word is given
          if (isNaN(G.openT)) { if (!G.go || G.ops.some(o => this.ops.includes(o) && (isNaN(o.readyT) || this.fragWait(o)))) break; G.openT = t; if (K.fragHold) for (const o of G.ops) if (this.ops.includes(o)) this.fragOn(o); }   // (fragHold: a door beside this one on the signal is waiting for its men — and once the signal has gone nobody waits)
          const beside = G.ops.filter(o => o !== op && this.ops.includes(o));
          if (!this.willKick(op) && this.bootBeside(op)) { if (K.gateHand && !this.gateAsked.has(op) && !isOpen(d) && !this.lockedOut(d, op.side)) { this.gateAsked.add(op); this.toHandle(op, true); } break; }   // a door that only wants a hand (or stands open) goes with the boot beside it — its lead to the handle meanwhile (gateHand; asked once)   // a door that only wants a hand (or stands open) goes with the boot beside it
          if (op.kind === 'openClear' && beside.some(o => o.kind === 'bangClear' && (o.phase === 'stack' || o.phase === 'kick' || o.phase === 'toss' || o.phase === 'fuse' || o.phase === 'wait'))) break;   // and a door with no can of its own waits for the men behind the can beside it: its men go in when they do, not ahead of the flash
        }
        this.open(op);
        break;
      }
      case 'ready': if (!op.onWord && !op.word) this.open(op); break;   // (the word's own clock moves it on — wordTick; this is the op whose word gave up on it)
      case 'kick': {
        if (op.kick?.pick) { this.pickStep(op); break; }   // (a silent squad: the lock is picked, not booted)
        if (op.kick?.gun) { this.gunStep(op); break; }   // (a breaching shotgun in the stack: the lock is shot off, not booted)
        if (!op.kick) break;   // (an op its new lead's question just ended: newLead)
        if (op.kick?.hand) { this.handStep(op, el); break; }   // (an unlocked door whose lead was not at its handle: handleside.ts)
        const k = op.kick!, c = lead.char, an = c.anim;
        if (isOpen(d) && isNaN(k.t)) { this.backToJamb(op, lead);   // (somebody else opened it)
          if (op.word && op.kind !== 'bangClear') { op.phase = 'ready'; op.hold = 2; break; }   // (on a word: he still crosses with the others — wordTick)
          this.opened(op); break; }
        if (isNaN(k.t)) {
          const on = flat(c.pos, k.pos) < 0.4 && Math.abs(wrapAngle(c.bodyYaw - k.yaw)) < 0.35;
          if (!on && el < K.kickCap) break;
          if (flat(c.pos, k.pos) > 1.2) { g.say(lead, "can't get on the door."); this.end(op, 'never made the kick spot'); break; }
          if (op.word && op.kind !== 'bangClear') { op.hold = 2; break; }   // (the word has others to wait for: the boot is his crossing)
          if (el < K.kickCap && op.gate?.ops.some(o => o !== op && this.ops.includes(o) && o.phase === 'kick' && !!o.kick?.gate && !o.kick.onIt)) break;   // (gateHand: a man beside him on the same signal is still on his way to his door's handle — never past `kickCap` on his own spot)
          an.kickDoor(); k.t = t; break;
        }
        if (!(an.kickImpact || an.kickTime >= KICK_IMPACT || !an.kicking)) break;
        const gave = g.doors.kickIn(d, c.pos, c.id); this.stats.kicks++; this.beat(op, 'kick');
        this.backToJamb(op, lead);
        if (!gave && !isOpen(d)) { op.kick = null; this.beat(op, 'the frame held'); if (!this.frameHeld(d, op.side) || !this.frameAnswer(op)) this.end(op, 'the door held the boot'); break; }   // (the rule switched on, or the leaf swung home, between open()'s question and the sole landing: asked again — the pick, or the refusal — never men walked at a shut door)
        this.opened(op);
        break;
      }
      case 'toss': {
        const kicked = !!op.kick && !isNaN(op.kick.t);
        const leafA = op.leafA, leafT = op.leafT; op.leafA = d.angle; op.leafT = t;   // (the leaf's angle a look ago: kept every tick of the stage, so the throw's frame has its real turn — read only under fragWay / bangWay)
        if (t - op.openT < (kicked ? K.tossAfterKick : K.tossAfterOpen)) break;
        if (!op.bangHeld) { g.say(lead, op.frag ? 'no frag.' : 'no bang.'); this.end(op, 'no bang to throw'); break; }
        if (op.frag) {   // asked again as it is about to leave the hand (the row asked when it was given: a word, or a long walk to the stack, later somebody may be in there)
          const who = g.rescue?.hostages.some(h => h.state !== 'dead') ? 'hostages' : this.fragBehind(d, op.side, op.men);
          if (who) {   // (the door is open and the room knows: the grenade goes back on his belt and they go in without it — an order is not dropped at an open doorway)
            g.say(lead, who === 'hostages' ? 'hostages — no frag. going in.' : who === 'you' ? wg("you're in there — no frag. going in.", 'you are in there — no frag. going in.') : `${who} is in there — no frag. going in.`);
            op.bangHeld = false; op.frag = false; this.refund('frag'); this.beat(op, 'frag held'); this.note(`frag held on ${d.def.name}: ${who} in its reach — in without it`); this.enter(op); break; }
        } else if (this.samBehind(d, op.side)) {   // (behindSam — false with the switch off: the can is asked about Sam again as it is about to leave the hand, as the frag is. The row asked when it was given; 'on my word', or a long walk to the stack, later he may have gone in by another door. The can goes back in the kit and they go in without it)
          g.say(lead, wg("you're in there — no bang. going in.", 'you are in there — no bang. going in.'));
          op.bangHeld = false; this.refund('bang'); this.beat(op, 'no bang · you are in there'); this.note(`bang held on ${d.def.name}: you in its reach — in without it`);
          if (op.word) { op.phase = 'wait'; op.hold = 2; break; }   // (on a word with another door: in step with it — wordTick sends them in together, as behind a bang)
          this.enter(op); break;
        } else if (K.tossMate) {   // (tossMate: … and about the rest of the team — a pair that went in by the room's other door since the row was given)
          const mate = this.mateBehind(op);
          if (mate) {
            g.say(lead, `${mate.callsign} is in there, so no bang. going in.`);
            op.bangHeld = false; this.refund('bang'); this.beat(op, `no bang · ${mate.callsign} is in there`); this.note(`bang held on ${d.def.name}: ${mate.callsign} in its reach — in without it`);
            if (op.word) { op.phase = 'wait'; op.hold = 2; break; }
            this.enter(op); break;
          }
        }
        const first = kicked || !K.secondThrows || !K.leadSeen ? lead : (op.first = this.firstIn(op));   // (leadSeen: the man who will be first through is picked here — the can is somebody else's)
        const next = kicked || K.secondThrows ? op.men.filter(m => m !== first && m.state !== 'dead' && offOf(d, m.char.pos, op.side) > 0 && (kicked || flat(m.char.pos, d.frameCentre) < K.throwReach)).sort((a, b) => flat(a.char.pos, d.frameCentre) - flat(b.char.pos, d.frameCentre))[0] : undefined;
        const th = next ?? first, W = d.def.width;   // (the man behind the first man throws it, with it ready: the first man's gun stays on the opening — he throws it himself only when he is alone at the door)
        if (K.tossTurn > 0 && th !== lead && !kicked && t - op.openT < K.tossAfterOpen + K.tossTurn && Math.abs(wrapAngle(th.char.aimYaw - yawTo(th.char.pos, d.frameCentre))) > 1.2) break;   // (rear security until the shove: he may be given a moment to come round to the door before he throws)
        if (op.frag ? K.fragWay : K.bangWay && !op.thr) {   // (fragWay / bangWay: not thrown at a door — the leaf must be well round and still going, or standing open, as it leaves the hand)
          const away = -op.side, a = d.angle * away, swing = (leafT !== undefined && t > leafT ? (d.angle - leafA!) / (t - leafT) : d.vel) * away;   // (the way the shove sent it: off the team's face — its REAL turn since the last look)
          if (!(Math.abs(d.angle) >= K.fragWayOpen || (a >= K.fragWayAjar && swing > 0))) {
            const what = op.frag ? 'frag' : 'bang', tag = op.frag ? 'frag' : 'can';   // (a beat that starts 'bang' is the burst itself: the stun's waiting and held beats say 'can')
            if (op.fragWayT === undefined) { op.fragWayT = t; this.beat(op, `${tag} waits: the door is in the way (${d.angle.toFixed(2)} rad)`); }
            if (t - op.fragWayT < K.fragWayWait) break;
            g.say(th, wg(`the door's in the way — no ${what}. going in.`, `door is in the way — no ${what}. going in.`));
            op.bangHeld = false; op.frag = false; this.refund(what); this.beat(op, `${tag} held`); this.note(`${what} held on ${d.def.name}: the leaf is in its way (${d.angle.toFixed(2)} rad) — in without it`); this.enter(op); break; }
        }
        op.bangHeld = false;
        const from = doorPt(d, clamp(alongOf(d, th.char.pos), 0.25, W - 0.25), 0.35, op.side, 1.3);
        const into = !op.frag && !op.thr && K.bangInto ? this.bangSpot(op, from) : null, land = into?.at ?? this.landAt(op, op.frag ? FRAG.orderIn : undefined);   // (bangInto: thrown deep into the room, to the deepest point its burst lights nearly all the floor from, and off as it gets there)
        const sol = g.items.solve(from, land, 9);
        // (bangInto, the hand: a thrower off the opening's edge with a clear line to it passes the can there first — a flat lob from his own hand — and it turns in off the jamb)
        const hand: Vec3 = [th.char.pos[0] + (from[0] - th.char.pos[0]) * 0.2, 1.3, th.char.pos[2] + (from[2] - th.char.pos[2]) * 0.2], gap = flat(hand, from);
        const pass = into && gap > K.bangHandM && K.bangPassV > 0 && !g.col.solidBlocked(hand, from) ? { to: from, v0: sol.v0, T: Math.max(0.15, gap / K.bangPassV) } : undefined;
        const at0 = pass ? hand : from, v0: Vec3 = pass ? [(from[0] - hand[0]) / pass.T, (from[1] - hand[1] + 0.5 * GRAVITY * pass.T * pass.T) / pass.T, (from[2] - hand[2]) / pass.T] : sol.v0;
        op.aim = into ? { at: into.at, from } : undefined; op.pass = pass;
        const it = op.frag ? g.items.spawn('frag', from, sol.v0, { fuse: FRAG.orderFuse, who: th.char.id, heading: v3.yawOf(sol.v0) })   // (a frag: on its OWN fuse from the hand — frag.ts; nobody is kept off its list)
          : g.items.spawn('flash', at0, v0, { fuse: 99, who: th.char.id, heading: v3.yawOf(v0) });   // (the long fuse: this op fires it — bang() — with the entry's own men kept off its list)
        it.onBounce = (sp, q, g) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
        th.char.anim.tossItem(TOSS_QUICK); g.say(th, op.frag ? 'frag out!' : WORDS.on ? 'bang out!' : 'bang out.'); if (op.frag) g.msg('frag out — stay off the door');
        if (into) this.beat(op, `can into the room · ${(-offOf(d, into.at, op.side)).toFixed(1)} m in, ${(alongOf(d, into.at) - W / 2).toFixed(1)} along · ${into.n} of ${into.of} places lit${pass ? ` · passed ${gap.toFixed(1)} m to the door` : ''}`);   // (its own beat, and BEFORE the toss: 'toss:<callsign>' is read by name, and as the last beat of its tick)
        op.can = it; op.tossT = t; op.threw = th; op.phase = 'fuse'; this.beat(op, `toss:${th.callsign}`);
        break;
      }
      case 'fuse': {
        const it = op.can!;
        if (it.fired) { op.bangT = t; op.bangAt = v3.copy(it.pos); op.phase = 'wait'; this.beat(op, op.frag ? `frag · ${offOf(d, it.pos, op.side) < 0 ? 'inside' : 'OUTSIDE'} ${Math.abs(offOf(d, it.pos, op.side)).toFixed(1)} m` : 'bang (its own fuse)'); if (op.frag) { this.stats.frags++; this.closeUp(op); } if (op.thr) this.thrBanged(op); break; }
        if (op.frag) { if (!g.items.items.includes(it)) this.end(op, 'the frag is gone'); break; }   // (its own fuse, from the thrower's hand: nothing here sets it off — and one taken off the floor unfired, a restart's sweep, does not leave the men waiting on it)
        if (op.pass) {   // (bangInto: on its way from the hand to the opening's edge — there it turns in, on the throw that was solved from that point; a pass that met something is put there all the same)
          if (t - op.tossT < op.pass.T && flat(it.pos, op.pass.to) > 0.12 && !it.bounces) break;
          it.pos = v3.copy(op.pass.to); it.vel = v3.copy(op.pass.v0); it.heading = v3.yawOf(op.pass.v0); it.bounces = 0; it.settled = false; g.audio.play('canisterBounce', it.pos, 0.5); op.pass = undefined; break; }
        if (isNaN(op.landT) && (it.bounces > 0 || it.settled)) op.landT = t;
        const aim = op.thr?.aim ?? op.aim?.at, hand = op.thr?.from ?? op.aim?.from;
        const air = aim && hand ? isNaN(op.landT) && (flat(it.pos, aim) < 0.1 || flat(it.pos, hand) >= flat(aim, hand) - 0.05)   // (thrown at a pocket: it goes off as it gets there — not a step short: the floor it was thrown to light is counted from that point)
          : isNaN(op.landT) && it.vel[1] < 0 && it.pos[1] <= K.airH && offOf(d, it.pos, op.side) <= -K.airIn;   // cooked: it goes off in the air, chest high and well inside — over the furniture that would shadow a can on the floor
        if (air || (!isNaN(op.landT) && t - op.landT >= K.fuseAfterLand) || t - op.tossT >= K.tossCap) this.bang(op, it);
        break;
      }
      case 'wait': {   // behind a bang / a charge: the defenders' blind burst comes back through the doorway — nobody crosses until it has run dry
        if (!this.burstDry(op)) break;
        if (K.bangInto && op.gate?.ops.some(o => o !== op && this.ops.includes(o) && o.kind === 'bangClear' && !o.frag && (o.phase === 'fuse' || (o.phase === 'wait' && !this.burstDry(o))))) break;   // (bangInto: two doors on one signal still go in together — a can thrown deep is in the air longer than one that kept the old landing, and each door waits the other's burst out too)
        if (op.word) { op.hold = 2; break; }   // (in step with the other door: wordTick sends them in together)
        this.enter(op);
        break;
      }
      case 'enter': {
        if (K.threatFirst) this.threatDeal(op);
        for (let i = op.queue.length - 1; i >= 0; i--) { const q = op.queue[i]; if (rearHolds(g, op, q.gd) || (DOORPATH.on ? !g.doorPath.mayGo(op, q, i) : t < q.at)) continue; op.queue.splice(i, 1);   // (doorpath.ts: let go by the room the man before him has, not by the clock)
          if (op.men.includes(q.gd)) { op.pod.set(q.gd, q.pod); this.assign(op, q.gd, { post: q.pod.pos, face: q.pod.face, watch: null, shy: null, thru: op.door, pace: g.orders.knobs.entry, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: true, going: `entering · ${name}`, there: 'holding the room' }); if (DOORPATH.on) g.doorPath.sent(op, q.gd, q.pod); } }   // (weapon light on as he takes the frame, as the breach drill's man)
        // Through the frame: his CORNERS first (near, then deep, on his own side of the door), then on his point the muzzle to one hand, to the other — and then
        // the room's floor LOOKED OVER until none of it is left unseen (the room fight takes the muzzle off any of these for a man he sees)
        const SR = this.searchOf(op); if (SR) this.look(op, SR);
        const other = K.otherDoorM > 0 && !!this.otherDoors(op);
        let swept = true;
        for (const gd of op.men) { const pod = op.pod.get(gd), A = op.mine.get(gd)!; if (!pod || op.queue.some(q => q.gd === gd)) { swept = false; continue; }
          const p = gd.char.pos; A.searchT = t;
          if (op.threat?.deal?.size && this.threatStep(op, gd, A, pod)) { swept = false; continue; }   // (threatFirst: his gun is on where the team knows a man to be — his corners after)
          if (K.corners && this.cornerStep(op, gd, A, pod)) { swept = false; continue; }
          if (!this.onPoint(gd, A, pod)) { swept = false; continue; }
          const t1 = op.onPod.get(gd) ?? (op.onPod.set(gd, t), t), k = Math.floor((t - t1) / K.sweepSecs);
          if (other && this.onOther(op, gd)) continue;   // (otherDoorM: his gun is on the room's other door — the floor is the other men's)
          if (k < 2 && !SR) { swept = false;
            const yaw = pod.face + (k <= 0 ? -K.sweepRad : K.sweepRad); A.watch = [p[0] + Math.sin(yaw) * 4, 1.2, p[2] + Math.cos(yaw) * 4]; A.face = yaw; continue; }
          if (SR && this.scan(op, SR, gd, A)) { swept = false; continue; }
          this.onSector(gd, A, pod); }
        if (op.thr && !op.thr.handed && !op.queue.length && op.thr.jamb.every(m => !op.men.includes(m) || op.onPod.has(m))) { op.thr.handed = true; this.beat(op, 'handover'); }   // (the men off the jambs are on their points, corners checked: the room is the entry's own search from here)
        const flowing = !!SR && this.flows(op, SR);
        if (SR && flowing && SR.fightAt !== t) { if (this.ops.some(o => o.search === SR && o.crossed.size > 0 && o.men.some(m => !!m.script?.over))) SR.fightT = (SR.fightT ?? 0) + clamp(t - (SR.fightAt ?? t), 0, 0.05); SR.fightAt = t; }   // (one floor, one clock: counted once a frame, whichever order's men are in the fight — and only of an order with a man through the frame: with nobody in the room there is no search for the fight to have held up, and an entry stopped at a leaf a defender stands behind ended up to twenty seconds late)
        const cap = SR ? K.searchCap + (flowing ? ((SR.flows ?? 0) + (SR.closes ?? 0)) * K.flowSecs + Math.min(SR.fightT ?? 0, K.flowFight) : 0) : K.inCap;
        if (SR && flowing && el >= K.searchCap && el < cap && !SR.late) { SR.late = true; this.stats.flowLate++; }   // (counted: an entry that would have been called by now without the rule)
        if (op.queue.length || (!swept && el < cap)) break;
        if (SR && swept && el < cap && this.moveOn(op, SR)) break;   // floor nobody can see from where he stands: a man goes on to where it can be seen
        if (SR) this.beat(op, `searched · ${SR.left} of ${SR.pts.length} cells unseen · ${SR.moves} moved on`);
        if (op.threat?.deal) for (const [m, G] of op.threat.deal) if (isNaN(G.doneT)) { G.doneT = t; const A = op.mine.get(m); if (A && G.faced) A.strafe = false; }   // (threatFirst: called with his gun still on the known place — he is his sector's from here, facing as he walks)
        for (const gd of op.men) { const pod = op.pod.get(gd), A = op.mine.get(gd); if (pod && A && !op.queue.some(q => q.gd === gd)) { const face = this.onSector(gd, A, pod); this.held.set(gd, { A, face, d: 0, hitT: NaN, arrT: NaN }); } }   // (ended on the cap with a muzzle mid-room: every man is left on his sector, reading 'holding the room')
        if (K.otherDoorM > 0) { this.otherDoors(op, true, false); this.watches.push(op); }   // (… but the man on the room's other door keeps it; the door they came in by gets its man next, and what is left is dealt by tick() from here — a threshold entry's just below, ahead of its far doors' walk)
        if (K.lastOut) { const ins = op.men.filter(m => m.state !== 'dead' && this.held.has(m));
          if (ins.length >= 3) { const w = doorPt(d, d.def.width / 2, -0.2, op.side, 1.2);   // (the doorway itself, from inside it)
            // (the last man through with a line to it — the leaf they shoved in can stand between the very last man's corner and the frame. His watch point is
            //  `lastOutM` on through the door: Sam standing in the frame or the corridor beyond is in that line, and the gun comes down for him)
            for (const m of [...ins].sort((a, b) => (op.crossed.get(b) ?? -Infinity) - (op.crossed.get(a) ?? -Infinity))) { const R = this.held.get(m)!, p = m.char.pos;
              if (g.col.segmentBlocked([p[0], 1.2, p[2]], w) || (K.otherDoorM > 0 && R.door)) continue;
              const yaw = yawTo(p, w), far = flat(p, w) + K.lastOutM; R.A.watch = [p[0] + Math.sin(yaw) * far, 1.2, p[2] + Math.cos(yaw) * far]; R.A.face = yaw; R.face = yaw; R.out = true;
              this.beat(op, `door · ${m.callsign}`); break; } } }
        const RC = g.roomClear, room = RC?.active ? RC.rooms.find(r => r.def.id === RC.roomAt((WORDS.on ? lead : op.men[0]).char.pos)) : null;   // (the room the man who calls it stands in)
        if (room) { const ins = g.guards.filter(x => x.state !== 'dead' && x.team === 'hostile' && RC!.roomAt(x.char.pos) === room.def.id);
          // (squadnet.ts: with its switch on 'clear' is said only of a room whose floor the search saw all of — off, the call as it was)
          const call = roomCall(g, room.def.name, SR ? SR.left : 0, ins.length > 0, ins.some(x => (g.fogOfWar.active ? g.fogOfWar.seen(x) : !!g.fight?.teamSees(x)))); if (call) g.say(lead, call); }
        // (the room is theirs: from here each man's eyes are spare for its other ways in — cover.ts deals them; his sector stands where it deals nothing)
        if (op.thr && K.otherDoorM > 0) this.otherDoors(op, true, true, K.thrDoors);   // (a threshold entry: what a man can take where he stands is dealt before anybody is walked to a door)
        if (op.thr && K.thrDoors) this.holdDoors(op);
        if (COVER.inRoom) for (const gd of op.men) { const A = op.mine.get(gd); if (A && op.pod.has(gd) && !this.held.get(gd)?.door) A.spare = true; }
        this.beat(op, 'in'); this.stats.entries++; this.end(op, 'in');
        break;
      }
      case 'place': {   // the charge: he is at the lock for setSecs, then it is on the door and he walks off to the stand-off
        if (isOpen(d)) { g.say(lead, "door's open.");
          const P = op.post.get(lead);   // (the four: the OTHER pair opened it under him — he stands off with his mate, not at the lock of an open door reading 'setting the charge')
          if (P && g.orders.big) this.assign(op, lead, { post: P.pos, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: 'standing off', there: `stood off · ${name}` });
          this.stayHands(op); this.end(op, 'the door opened'); break; }
        const A = op.mine.get(lead)!;
        if (stowFight(g, lead, A, op)) { op.setT = NaN; op.t0 = t; break; }   // (workstow.ts: the fight has him — his hands are not on a charge; not set, nothing spent, and he starts over when it lets him go, `fightCap` at most at a stretch)
        if (isNaN(op.setT)) { if (A.arrived && flat(lead.char.pos, d.frameCentre) < 1.6) op.setT = t + mateStowLead(); else if (!this.waiting(op, el)) { g.say(lead, "can't get on that door."); this.end(op, 'never made the door'); } break; }
        if (flat(lead.char.pos, d.frameCentre) > 1.6) { op.setT = NaN; break; }   // (walked off it: not set)
        mateStow(g, lead);   // (workstow.ts: his gun is out of his hands for it — the charge's clock began `mateDown` after he came onto it)
        if (t >= op.setT) { const o = doorPt(d, 0, 0, op.side), n1 = doorPt(d, 0, 1, op.side); chargeHands(g, lead.char, doorPt(d, d.def.width - 0.22, 0.025, op.side, 1.05), [n1[0] - o[0], 0, n1[2] - o[2]], t - op.setT, K.setSecs); }   // (handwork.ts: his hands on it while it goes on)
        if (t - op.setT < K.setSecs) break;
        if (!this.take('charge')) { g.say(lead, 'no charges left.'); this.end(op, 'no charges'); break; }
        this.set.push({ door: d, side: op.side, t, by: lead.callsign }); g.audio.play('lockPick', d.pos, 0.6);
        g.say(lead, 'charge set.'); this.beat(op, 'set');
        const P = op.post.get(lead)!;
        this.assign(op, lead, { post: P.pos, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: P.stackSide, going: 'standing off', there: `stood off · ${name}` });
        op.phase = 'standoff'; op.t0 = t;
        break;
      }
      case 'standoff': {
        if (!this.chargeOn(d)) { if (isOpen(d)) this.stayHands(op); this.end(op, 'the charge is gone'); break; }
        { const near = op.men.filter(gd => flat(gd.char.pos, d.frameCentre) < K.backblastM + 0.05);   // (… and every one of them OUT of the backblast, not merely counted in on a mark a stride outside it: 'arrived' is said a foot short of the mark — so a man still inside it is waited on for as long as he is still walking, up to `stackCap`)
          if (!op.men.every(gd => this.arrived(op, gd)) ? this.waiting(op, el) : near.length > 0 && el < K.stackCap && (el < K.stillSecs || near.some(gd => g.time - op.mine.get(gd)!.movedT < K.stillSecs))) break; }
        g.say(lead, 'stood off. your call.'); g.msg(`charge set on the ${name}. press ${K.blowKey.replace('Key', '')} to blow it`);
        op.phase = 'armed'; op.t0 = t; this.beat(op, 'armed'); if (op.word) op.hold = 1;
        break;
      }
      case 'armed': if (!this.chargeOn(d)) this.end(op, 'the charge is gone'); break;   // (blow() moves the op on itself)
      case 'slice': {
        if (d.quietT > -1 && isOpen(d)) d.quietT = -1;   // (the opening they are working stays open)
        let all = true;
        for (const gd of op.men) {
          const s = op.slice.get(gd); if (!s) continue; const A = op.mine.get(gd)!;
          if (flat(gd.char.pos, s.pts[s.i]) > 0.5 && !A.arrived) { s.t = NaN; all = false; continue; }
          if (isNaN(s.t) || g.fight.contact(gd) || g.fight.engaged(gd)) s.t = t;   // a man in his sight: he stays on the angle that shows him
          if (t - s.t < K.sliceLook) { all = false; continue; }
          const looks = s.looks[s.i];
          if (s.j < looks.length - 1) { s.j++; s.t = t; all = false; A.watch = looks[s.j]; A.face = yawTo(gd.char.pos, looks[s.j]); continue; }   // the muzzle (and the light on it) across what this station shows: far jamb, middle, near jamb — the new ground last
          if (s.i >= s.pts.length - 1) continue;
          const up = s.ahead && op.men.includes(s.ahead) ? op.slice.get(s.ahead) : null;
          if (up && up.i < Math.min(up.pts.length - 1, s.i + 3)) { all = false; continue; }   // (the man ahead has not made the room: he waits on his angle)
          s.i++; s.j = 0; s.t = NaN; all = false;
          this.assign(op, gd, { post: s.pts[s.i], face: yawTo(s.pts[s.i], s.looks[s.i][0]), watch: s.looks[s.i][0], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: true, ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), going: `slicing · ${name}`, there: s.i >= s.pts.length - 1 ? `holding outside · ${name}` : `slicing · ${name}` });
        }
        if (all || el > 40) { g.say(lead, 'holding on the door.'); op.phase = 'held'; op.t0 = t; this.beat(op, 'held outside');
          for (const gd of op.men) { const s = op.slice.get(gd), A = op.mine.get(gd); if (s && A) { const L = s.looks[s.i]; A.watch = L[L.length >> 1]; A.face = yawTo(gd.char.pos, A.watch!); } } }   // (held: each man's muzzle down the middle of what he can see)
        break;
      }
      case 'held': if (d.quietT > -1 && isOpen(d)) d.quietT = -1; break;   // until an entry order (or any other) takes the men
      case 'thr': {   // the room worked from the threshold: both jambs' diagonals held (the lead's stations, if he slices), whoever comes to the noise the room fight's
        const T = op.thr!; if (d.quietT > -1 && isOpen(d)) d.quietT = -1;
        this.thrMen(op); this.thrWatch(op);
        if (T.stepOwed && !this.wordOwed(op)) break;   // (the word's step in, owed while men who ran from a grenade were out: paid — the order is in its next stage)
        if (K.thrPie && K.thrPieOne && K.thrLight === 1 && T.jamb.length && !T.jamb.some(m => op.mine.get(m)?.search)) { const m = T.jamb[0], A = op.mine.get(m); if (A && !(K.thrDark && nvgWorn(g, m))) A.search = true; }   // (thrPieOne: the door's one light was the cutting man's, and he is down — the man left on the door carries it)
        for (const m of T.jamb) { const A = op.mine.get(m); if (!A) continue; if (K.thrDark && K.thrLight > 0 && !A.search && m === (T.jamb[1] && !(op.slice.get(T.jamb[0])?.pie && !op.slice.get(T.jamb[1])) ? T.jamb[1] : T.jamb[0]) && nvgBlack(g, m)) A.search = true;   // (a dark hold whose goggles show the still gun nothing: his light after all)
          if (A.search) A.searchT = t; }   // (a light on the door burns for the whole hold: the light rule lets a searching man's lapse otherwise)
        const SR = op.search ?? null;
        if (SR) { if (t >= T.losT && !T.told) { T.losT = t + 0.5; for (const m of T.jamb) SR.los.delete(m); }   // (the leaf is still swinging, a man still settling: his lines are asked again twice a second)
          this.look(op, SR, T.jamb, (m, i) => !!m.flashlight?.enabled || this.thrLitCell(T, SR, i) || (K.thrTube && nvgDown(g, m) && (this.thrTubeCell(T, SR, i) || irShowsAt(g, m, SR.pts[i])))); }   // (floor a man's gun is across in the dark is floor nobody has seen)
        let done = true;
        const pieOp = T.jamb.some(m => !!op.slice.get(m)?.pie);   // (asked of the op, not of the switch: a hold begun with it keeps both men's cuts whatever the panel says since)
        for (const gd of pieOp ? T.jamb : [op.lead]) { const s = op.slice.get(gd), A = op.mine.get(gd); if (!s || !A) continue;
          const P = s.pie; if (P?.fin) continue;
          let fin = false; if (P) P.begun = true;
          if (P && flat(gd.char.pos, s.pts[s.i]) < 0.12) P.on = true;
          if (P && s.i > 0 && !P.on && !P.to && P.gun === 0 && (g.fight.contact(gd) || g.fight.engaged(gd))) {   // (a man shows while he is still stepping to the cut: he stops on the angle that shows him — the cut is where he stands, until nobody is in his sight)
            const p: Vec3 = [gd.char.pos[0], 0, gd.char.pos[2]], w = A.watch ?? s.looks[s.i][0]; P.to = s.pts[s.i]; s.pts[s.i] = p; P.on = true;
            this.assign(op, gd, { post: p, face: yawTo(p, w), watch: w, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: A.search, ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), ...(P.lean ? { lean: P.lean, crouch: P.knee[s.i] } : {}), going: `slicing · ${name}`, there: `slicing · ${name}` }); }
          if (P ? t - P.at <= PIE_WAIT && (!(A.arrived || flat(gd.char.pos, s.pts[s.i]) < 0.12) || (P.knee[s.i] && gd.char.anim.crouch < 0.8)) : flat(gd.char.pos, s.pts[s.i]) > 0.5 && !A.arrived) s.t = NaN;   // (thrPie: a cut's clock starts with his hips ON it — and down, where it is a knee's —, or PIE_WAIT after it was given: somebody stands there)
          else { if (isNaN(s.t) || g.fight.contact(gd) || g.fight.engaged(gd)) s.t = t;   // a man in his sight: he stays on the angle that shows him
            if (P && g.fight.noShot(gd) > PIE_GUN.after && t - P.gunAt > PIE_GUN.every) {   // (… and where the angle shows him the man and gives his gun no line — the jamb across the bore —, the gun comes round after the eye; no floor for that, or it has come round enough: the cut is given up for the one before it)
              const at = s.pts[s.i], q: Vec3 = [at[0] + P.inw[0] * PIE_GUN.step, 0, at[2] + P.inw[2] * PIE_GUN.step], other = T.jamb.find(m => m !== gd && m.state !== 'dead'), os = other ? op.slice.get(other) : undefined;
              const ok = P.gun < PIE_GUN.most && !g.col.nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([at[0], 0.45, at[2]], [q[0], 0.45, q[2]]) && !(other && (flat(other.char.pos, q) < K.thrPieApart || (!!os && flat(os.pts[os.i], q) < K.thrPieApart)));
              P.gunAt = t;
              if (ok || s.i > 0) { if (ok) { P.gun++; s.pts[s.i] = q; } else { s.i--; P.gun = 0; P.fin = true; P.to = null; }   // (on his diagonal there is no cut before it to give this one up for: he stays)
              const l = s.looks[s.i], w = ok ? A.watch ?? l[0] : l[l.length >> 1];
              this.assign(op, gd, { post: s.pts[s.i], face: yawTo(s.pts[s.i], w), watch: w, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: A.search, ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), ...(ok && P.lean && s.i > 0 ? { lean: P.lean, crouch: P.knee[s.i] } : {}), going: ok ? `slicing · ${name}` : `holding the threshold · ${name}`, there: ok ? `slicing · ${name}` : `holding the threshold · ${name}` });
              if (!ok) { this.beat(op, `no shot from the cut · ${gd.callsign} back`); continue; } } }
            const looks = s.looks[s.i];
            if (P?.to && t - s.t >= K.sliceLook) {   // (… nobody in his sight any more: on to the cut he was stopped short of)
              s.pts[s.i] = P.to; P.to = null; P.on = false; P.gun = 0; P.at = t; s.j = 0; s.t = NaN;
              this.assign(op, gd, { post: s.pts[s.i], face: yawTo(s.pts[s.i], looks[0]), watch: looks[0], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: A.search, ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), ...(P.lean ? { lean: P.lean, crouch: P.knee[s.i] } : {}), going: `slicing · ${name}`, there: `slicing · ${name}` });
              done = false; continue; }
            if (t - s.t < (P?.endOn ? K.thrLeanLook : K.sliceLook)) { /* resting on this angle (thrPieOne: … or held out on his one lean) */ }
            else if (s.j < looks.length - 1) { s.j++; s.t = t; A.watch = looks[s.j]; A.face = yawTo(gd.char.pos, looks[s.j]); }
            else { const next = !P ? (s.i < s.pts.length - 1 ? s.i + 1 : -1) : P.endOn ? -1 : this.pieNext(op, gd, s);   // (thrPie: the next cut that still shows floor nobody's muzzle has been across — none: he is done)
              if (next >= 0) { s.i = next; s.j = 0; s.t = NaN; if (P) { P.at = t; P.gun = 0; P.on = false; P.to = null; } const last = s.i >= s.pts.length - 1;
                this.assign(op, gd, { post: s.pts[s.i], face: yawTo(s.pts[s.i], s.looks[s.i][0]), watch: s.looks[s.i][0], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: P ? A.search : K.thrLight >= 2 || (K.thrLight === 1 && T.jamb.length < 2), ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), ...(P?.lean ? { lean: P.lean, crouch: P.knee[s.i] } : {}), going: `slicing · ${name}`, there: last ? `holding the threshold · ${name}` : `slicing · ${name}` }); }
              else if (P && P.end && !P.endOn && s.i > 0) { P.endOn = true; s.t = t; T.losT = Math.min(T.losT, t + 0.3);   // (thrPieOne: his cuts are done — the one lean, from where the last left his hips, toward the line past his own jamb; his lines are asked again once his head is out)
                this.assign(op, gd, { post: s.pts[s.i], face: yawTo(s.pts[s.i], looks[0]), watch: looks[0], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: A.search, lean: P.end, going: `slicing · ${name}`, there: `slicing · ${name}` }); }
              else { fin = true;
                if (P) { P.fin = true; const mid = looks[looks.length >> 1];   // (thrPie: … and he stands square where his last cut left his hips, on the middle of what it shows)
                  this.assign(op, gd, { post: s.pts[s.i], face: yawTo(s.pts[s.i], mid), watch: mid, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: A.search, going: `holding the threshold · ${name}`, there: `holding the threshold · ${name}` }); }
                else if (!T.sliced) { T.sliced = true; A.watch = looks[looks.length >> 1]; A.face = yawTo(gd.char.pos, A.watch); this.beat(op, `${K.thrSlice ? 'sliced' : 'set'}${SR ? ` · ${SR.left} of ${SR.pts.length} cells unseen` : ''}`); } } } }   // (… and holds the middle of what his last station shows)
          done &&= fin;
        }
        if (done && pieOp && !T.sliced) { T.sliced = true; this.beat(op, `sliced${SR ? ` · ${SR.left} of ${SR.pts.length} cells unseen` : ''}`); }
        if (!T.hold && this.lastCall(op)) {   // (DOORTOOLS.thrLast: no hold — a can now, whatever the pockets say, and in behind it)
          if (!op.lastHold) { op.lastHold = true; op.lastTossed = T.tossed; this.beat(op, 'last warning · no hold'); }
          T.force = true; this.toPockets(op); break; }
        const quiet = done && el >= (T.first === 'done' ? K.thrFirstMin : K.thrMin) && t - T.quietT >= K.thrQuiet;   // (behind a can that went in first the hold has its own minimum: the flash is what is being spent)
        if (T.hold) {   // given to hold: the door has gone quiet — said once — and the jambs are kept until Sam says what next (thresholdThen; the word)
          if ((quiet || el >= K.thrCap) && !T.told && !T.cutOwed) { T.told = true; this.beat(op, 'holding · on your word'); g.say(lead, 'holding on the door.');
            for (const m of T.jamb) { const J = op.mine.get(m); if (J) J.there = `holding the threshold on your word · ${name}`; } }
          break; }
        if (!(quiet || el >= K.thrCap) || T.stepOwed) break;   // (an owed step in is a word that spends no can: the hold's cap does not throw one for it)
        this.toPockets(op);
        break;
      }
      case 'pocket': {   // the blind pockets: a can for the floor nobody has had a muzzle across — then the last burst's own count, and in
        const T = op.thr!; if (d.quietT > -1 && isOpen(d)) d.quietT = -1;
        this.thrMen(op); this.thrWatch(op);
        if (T.first === 'burst') {   // (a can went in first: nobody shows in the opening until the blind burst it drew has run dry — a bang's own count — then out onto the diagonals)
          if (this.burstDry(op)) this.thrOut(op);
          break; }
        if (t < T.nextT) break;
        if (K.thrFragHold && T.fled?.size && !(T.tossed && t - op.bangT < K.entryCap)) {   // MEN OF THE ORDER RAN FROM A GRENADE AND ARE NOT BACK: neither a can nor the step in until they are, or the order's one wait is spent (not behind a can of its own that has just gone off: that flash is not thrown away)
          if (this.thrFragWait(op)) {
            if (T.fragT !== undefined) T.handW = (T.handW ?? 0) + Math.min(t - T.fragT, 0.1);   // (counted only here, where it holds the stage up — the hold's own clock is the hold's)
            T.fragT = t; T.handT = undefined;   // (… and the can's own wait is not running meanwhile)
            if (!T.fragSaid) { T.fragSaid = true; this.beat(op, `the door waits: ${[...T.fled].map(m => m.callsign).join(', ')} not back`); g.say(op.men.find(m => !T.fled!.has(m)) ?? op.lead, 'hold — back on the door.'); }
            if (this.thrFragWait(op)) break; }
          T.fragT = undefined;
          if (T.fragSaid) { T.fragSaid = false; this.beat(op, `on without ${[...T.fled].map(m => m.callsign).join(', ')} · ${T.handDone || (T.handW ?? 0) >= K.thrHandWait ? 'the order\'s wait is spent' : 'not waited for'}`); }   // (it waited, and the wait is spent or no longer asked — a last warning: the stage is as it was from here)
        } else if (T.fragSaid) {   // (it waited and they are back: the can's thrower is picked afresh from the men where they stand now, and has his own turn)
          T.fragSaid = false; T.fragT = undefined; if (!T.fled?.size) { if (T.thrower && !T.jamb.includes(T.thrower)) op.rear.add(T.thrower); T.thrower = this.thrThrower(op); op.rear.delete(T.thrower); T.nextT = t + K.thrTurn; break; } }
        const th = T.thrower ??= this.thrThrower(op), who = this.canBehind(d, op.side, op.men), mate = who === 'you' ? 'you are in there' : who ? `${who} is in there` : '', none = this.bangs <= 0 || !!who; op.rear.delete(th);   // (a thrower who dropped: the next man who is not first in, as the first was picked)
        const most = op.lastHold ? (T.tossed > 0 && !T.wide && t - op.bangT < K.thrLastFresh ? T.tossed : (op.lastTossed ?? 0) + 1) : Math.max(this.thrCans(T), T.force ? 1 : 0);   // (told to bang: one can goes in whatever the knob says, and — with no pocket worth one — where a bang and clear's would; the captor's last warning: ONE can from then, and none behind a burst still in their eyes)
        const pick = T.tossed >= most || none ? null : this.pocketOf(op, th) ?? ((T.force || T.first === 'can') && !T.tossed ? { at: null, n: 0 } : null);
        if (!pick) {
          if (T.first === 'can') { this.thrOut(op, mate || 'none left'); break; }
          if (T.tossed) { op.phase = 'wait'; break; }   // behind the last burst, as behind any bang
          this.beat(op, most <= 0 ? 'no bang · none to spend on a threshold' : mate ? `no bang · ${mate}` : none ? 'no bang · none left' : 'no bang · no blind pocket'); this.toStep(op); break; }
        if (K.bangWay && T.first !== 'can' && !d.off && (T.shutT !== undefined || !isOpen(d))) {   // THE HELD DOOR HAS COME SHUT since they opened it (a teammate told 'shut that door', a hand): the can is not thrown at the leaf — it is opened again first, the can goes once it stands open or is well round and going away (the bang and clear's own look), else back on the belt and in without it
          const away = -op.side;
          if (!(Math.abs(d.angle) >= K.fragWayOpen || (d.angle * away >= K.fragWayAjar && d.vel * away > 0))) {
            if (T.shutT === undefined) { const locked = this.lockedOut(d, op.side); T.shutT = locked ? -1e9 : t; this.beat(op, `can waits: the door has come shut (${d.angle.toFixed(2)} rad)`); if (!locked) this.shove(op); }
            if (t - T.shutT < K.fragWayWait) break;
            g.say(th, wg("the door's in the way — no bang. going in.", 'door is in the way — no bang. going in.')); this.beat(op, 'can held'); T.shutT = undefined; this.toStep(op); break;
          }
          T.shutT = undefined;
        }
        if (K.thrHand && !T.handDone && !op.lastStack && !op.lastHold && !g.rescue.lastWarning(d) && !(op.word && this.ops.some(o => o !== op && o.word === op.word))) {   // NO CAN FROM A HAND THAT IS NOT AT THE DOOR (not asked of a door that SHARES a word with another — the word's count is all its doors' — nor under a captor's last warning, sounded before or while it waits, whoever times the order: as it was)
          const fit = (m: Guard) => m === th || ((T.force || T.first === 'can') && !T.tossed) || !!this.pocketOf(op, m);   // (a hand whose own end of the doorway has no pocket for this can is no hand for it — the next man in the pick's order is asked: the can is not lost to a hand-over)
          let h = th !== op.lead && this.thrAt(op, th) ? th : this.thrPick(op, true, fit);
          if (h && h !== th && (T.handW ?? 0) >= K.thrHandWait) h = null;   // (hand-overs spend the order's wait too: with it spent there is no other)
          if (!h) {   // (no hand yet: asked again a few times a second, the time between asks counted against the order's wait — the pocket's own sweep is not run sixty times a second for a can that is not going)
            if ((T.handW ?? 0) < K.thrHandWait) {
              const every = Math.max(0.05, K.thrHandEvery);
              if (T.handT === undefined) { const off = op.men.filter(m => m !== op.lead && !this.thrAt(op, m)).map(m => m.callsign).join(', ');
                this.beat(op, `can waits: no hand at the door ${this.thrAt(op, th) ? `but the lead's own (${off || 'nobody'} not back)` : `(${th.callsign} ${flat(th.char.pos, d.frameCentre).toFixed(1)} m off)`}`); g.say(op.lead, 'hold the bang — back on the door.'); }
              else T.handW = (T.handW ?? 0) + Math.min(t - T.handT, 2 * every);
              T.handT = t;
              if ((T.handW ?? 0) < K.thrHandWait) { T.nextT = t + every; break; }
            }
            if (K.thrNoCan) {   // (the order's whole wait is spent and still no hand at the door: the can stays in the kit, said why, and the stage goes on as it does with no pocket worth one)
              T.handT = undefined; g.say(op.lead, T.first === 'can' ? 'nobody on the door — no bang.' : 'nobody on the door — no bang. going in.');
              if (T.first === 'can') this.thrOut(op, 'nobody at the door'); else { this.beat(op, 'no bang · nobody at the door'); if (T.tossed) op.phase = 'wait'; else this.toStep(op); }
              break; }
            this.beat(op, `can waited ${K.thrHandWait} s · thrown as it was`); T.handDone = true;   // (the order's whole wait is spent: this can — now — and any after it go from the man who has it, wherever he stands)
          }
          T.handT = undefined;
          if (h && h !== th) { if (!T.jamb.includes(th)) op.rear.add(th); T.thrower = h; op.rear.delete(h); T.handW = (T.handW ?? 0) + K.thrTurn; T.nextT = t + K.thrTurn; this.beat(op, `can to ${h.callsign} · at the door`); break; }   // (a hand at the door that is not the picked man's: the can is his, after his own turn — counted too)
        } else if (T.handT !== undefined) T.handT = undefined;   // (a wait the rule let go of — a last warning — is over: a later one says itself afresh)
        if (!this.take('bang')) break;
        const W = d.def.width, from = this.handAt(op, th), land = pick.at ?? this.landAt(op);
        const sol = g.items.solve(from, land, 9);
        const it = g.items.spawn('flash', from, sol.v0, { fuse: 99, who: th.char.id, heading: v3.yawOf(sol.v0) });   // (the long fuse: this op fires it — bang())
        it.onBounce = (sp, q, g) => g.audio.play('canisterBounce', q, Math.min(1, sp / 4));
        th.char.anim.tossItem(TOSS_QUICK); g.say(th, WORDS.on ? 'bang out!' : 'bang out.');
        // (the can that goes in first is cooked SHORT — `thrFirstIn` inside the frame line on its way to the pocket: every tenth of a second it flies is one a gun
        //  settled on the doorway has on the men at the jambs, and from there its flash still has the room)
        let aim = pick.at, short = false;
        if (T.first === 'can' && aim && K.thrFirstIn > 0) { const o = offOf(d, from, op.side), k = (o + K.thrFirstIn) / (o - offOf(d, aim, op.side)); if (k > 0 && k < 1) { aim = [from[0] + (aim[0] - from[0]) * k, aim[1], from[2] + (aim[2] - from[2]) * k]; short = true; } }
        op.can = it; op.tossT = t; op.landT = NaN; op.threw = th; T.aim = aim; T.from = from; T.tossed++; op.phase = 'fuse';
        this.beat(op, `toss:${th.callsign} · ${T.first === 'can' ? 'first · ' : ''}${pick.at ? `pocket · ${pick.n} cells unseen · ${(-offOf(d, pick.at, op.side)).toFixed(1)} m in, ${(alongOf(d, pick.at) - W / 2).toFixed(1)} along${short ? ` · cooked short, ${K.thrFirstIn} m in` : ''}` : op.search ? 'no blind pocket: the middle' : 'no model of the room: the middle'}`);
        break;
      }
    }
  }
  /** behind the bang the first man closes up to the very edge of the frame (still behind the wall: the blind burst goes through the opening) — the less floor to
   *  cover when it runs dry, the more of the flash is left in their eyes when he shows */
  private closeUp(op: DoorOp, gd = op.lead) {
    const g = this.g, d = op.door, W = d.def.width, P = op.post.get(gd); if (!P || !op.men.includes(gd)) return;
    const a = alongOf(d, P.pos) > W / 2 ? W + DOORTOOLS.edgeOut : -DOORTOOLS.edgeOut, q = doorPt(d, a, offOf(d, P.pos, op.side), op.side);
    if (g.col.nav.isBlocked(q[0], q[2]) || g.col.solidBlocked([P.pos[0], 0.45, P.pos[2]], [q[0], 0.45, q[2]])) return;
    this.assign(op, gd, { post: q, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: 'stack', upper: 'none', stackSide: P.stackSide, going: `closing up · ${doorWords(d)}`, there: `on the frame · ${doorWords(d)}` });
  }
  /** the lead back onto his own jamb, off the opening (after his boot) */
  private backToJamb(op: DoorOp, gd: Guard) {
    const P = op.post.get(gd); if (!P) return; const d = op.door;
    this.assign(op, gd, { post: P.pos, face: P.face, watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: 'stack', upper: 'none', stackSide: P.stackSide, going: `stacking · ${doorWords(d)}`, there: `stacked · ${doorWords(d)}` });
  }
  /** unlatched and shoved hard into the room off its hinge, from the jamb (squad.ts RoomClear's keyed shove) */
  private shove(op: DoorOp) {
    const g = this.g, d = op.door, c = op.lead.char; const s = -g.doors.side(d, doorPt(d, d.def.width / 2, 0.6, op.side));
    d.latched = false; d.closing = false; d.vel = s * Math.max(Math.abs(d.vel), DOORTOOLS.shove); d.quietT = -1.0; d.creakArmed = false; d.lastWho = c.id;
    if (silentEase(g, op.lead)) g.audio.play('doorCreak', d.pos, 0.5); else g.audio.play('doorBash', d.pos, 0.5, { rate: 1.15 });   // (a SILENT squad's hand on the leaf, not its shoulder: silent.ts)
    this.beat(op, 'shove');
  }
  /** the leaf is moving (or stood open): what comes next, by the order */
  private opened(op: DoorOp) {
    const t = this.g.time; if (isNaN(op.openT)) op.openT = t; this.stats.opened++; op.t0 = t;
    if (op.kind === 'openClear') this.enter(op);
    else if (op.kind === 'bangClear') op.phase = 'toss';
    else if (op.kind === 'outside') this.toSlice(op);
    else if (op.kind === 'threshold') this.toThreshold(op);
  }
  /** where the canister is thrown to: `bangIn` inside the frame line on the doorway's centre line, or as far as the floor runs clear */
  private landAt(op: DoorOp, deep = DOORTOOLS.bangIn): Vec3 { return this.landFor(op.door, op.side, deep); }
  /** DOORTOOLS.bangInto: where a bang and clear's can is thrown to from `from` (the hand at the opening's edge) — see the table's note. `n` of `of`: the
   *  places of the floor beyond the door its burst has a line to. Null: no point worth it (the old landing stands). */
  private bangSpot(op: DoorOp, from: Vec3): { at: Vec3; n: number; of: number } | null {
    const g = this.g, K = DOORTOOLS, d = op.door, W = d.def.width, nav = g.col.nav, far = -op.side as 1 | -1, inn = doorPt(d, W / 2, 0.6, far, 1.9);
    const room = g.fight?.roomAt(doorPt(d, W / 2, 0.9, far)) ?? null;
    // the floor the doorway opens onto: free floor beyond the frame that the doorway's own middle has a line to above the furniture (a 0.6 m lattice). The
    // burst is counted on every other cell of it, and the can is offered every row of every other file (1.2 m apart): a few hundred sight lines in a real
    // room, some four thousand at the very most, once a toss (timed on every door of three levels: 0.4 ms the median, 2.3 the worst, under a thousand lines)
    const floor: Vec3[] = [], spots: Vec3[] = []; let ib = 0;
    for (let b = 0.6; b <= K.bangIntoDeep + 1e-6; b += 0.6, ib++) { let ia = 0; for (let a = -K.bangIntoWide; a <= K.bangIntoWide + 1e-6; a += 0.6, ia++) {
      const q = doorPt(d, W / 2 + a, b, far); if (nav.isBlocked(q[0], q[2]) || g.col.solidBlocked(inn, [q[0], 1.9, q[2]])) continue;
      if (!((ia + ib) & 1)) floor.push(q);
      if ((ia & 1) && (!room || g.fight!.roomAt(q) === room)) spots.push(q); } }   // (… and only in the room the door opens onto: not through a second doorway into the next)
    if (floor.length < 6) return null;
    // ours in a flash: the men this can would blind — not the ones bang() spares (this order's, its word's and gate's, and whoever of the team stands on this side by the door, Sam by the same test)
    const word = op.word ? this.ops.filter(o => o.word === op.word) : [], near = (q: Vec3) => offOf(d, q, op.side) > 0 && flat(q, d.frameCentre) < 5;
    const spared = (x: Guard) => op.men.includes(x) || word.some(o => o.men.includes(x)) || !!op.gate?.ops.some(o => o.men.includes(x)) || near(x.char.pos);
    const ours = [...g.guards.filter(x => (g.orders.sams ? x.team === 'operative' && x.unit : g.orders.mine(x)) && x.state !== 'dead' && !spared(x)).map(x => x.char.pos), ...(g.player.down || (g.orders.sams && near(g.player.char.pos)) ? [] : [g.orders.samStood])];
    const cands: { at: Vec3; n: number; of: number; sc: number }[] = [];
    for (const P of spots) {
      if (-offOf(d, P, op.side) < K.bangIntoMin || flat(from, P) > K.thrThrowM) continue;
      const at: Vec3 = [P[0], K.airH - 0.05, P[2]]; if (g.col.solidBlocked(from, at)) continue;
      if (ours.some(q => flat(q, P) <= K.thrFlashM && !g.col.segmentBlocked(at, [q[0], 1.45, q[2]]))) continue;   // (one of ours in its flash: not there)
      let n = 0, sc = 0; for (const q of floor) { const r = flat(P, q); if (r <= K.thrFlashM && !g.col.segmentBlocked(at, [q[0], 1.45, q[2]])) { n++; sc += 1 - r / K.thrFlashM; } }
      cands.push({ at, n, of: floor.length, sc }); }
    // (of the points that light `bangIntoLit` of what the best of them lights, the DEEPEST: a can thrown into a room goes past its middle; then the nearest the most floor)
    const most = cands.reduce((m, c) => Math.max(m, c.n), 0), deep = (c: { at: Vec3 }) => Math.round(-offOf(d, c.at, op.side) * 10), good = cands.filter(c => c.n >= most * K.bangIntoLit);
    if (!room && most < floor.length * 0.5) return null;   // (no room known for that floor, and the best point lights under half of it: what the doorway sees is not one room — the landing as it was)
    good.sort((a, b) => deep(b) - deep(a) || b.sc - a.sc);
    for (const c of good.slice(0, 8)) if (g.items.solve(from, c.at, 9).points.some(q => flat(q, c.at) < 0.35 && Math.abs(q[1] - c.at[1]) < 0.6)) return c;   // (the throw's own arc gets there: not into the lintel, not onto a cabinet's top)
    return null;
  }
  private landFor(d: Door, side: 1 | -1, deep: number): Vec3 {
    const g = this.g, op = { side }, W = d.def.width; let best = doorPt(d, W / 2, 0.6, -op.side as 1 | -1), prev = best;
    const plan = doorPlan(g, d.def.name) as (RoomClearPlan & { toss?: { land: Vec3 } }) | null;   // (the breach plan's own landing spot, when this door has one from this face: open floor a can stops on)
    if (plan?.toss && sideOf(d, plan.stack[0]) === op.side && offOf(d, plan.toss.land, op.side) < -0.5) return [plan.toss.land[0], 0.1, plan.toss.land[2]];
    for (let b = 0.9; b <= deep + 1e-6; b += 0.3) { const p = doorPt(d, W / 2, b, -op.side as 1 | -1);
      if (g.col.nav.isBlocked(p[0], p[2]) || g.col.solidBlocked([prev[0], 0.45, prev[2]], [p[0], 0.45, p[2]])) break; best = prev = p; }
    return [best[0], 0.1, best[2]];
  }
  /** the canister goes off: combat.ts detonateStun, with this entry's own men off its list (heads turned off the door, as the breach drill's) */
  private bang(op: DoorOp, it: Item) {
    const g = this.g, all = g.guards; it.fired = true;
    const d = op.door, word = op.word ? this.ops.filter(o => o.word === op.word) : [];
    const ours = (x: Guard) => op.men.includes(x) || word.some(o => o.men.includes(x)) || !!op.gate?.ops.some(o => o.men.includes(x)) || ((g.orders.sams ? x.team === 'operative' : g.orders.mine(x)) && offOf(d, x.char.pos, op.side) > 0 && flat(x.char.pos, d.frameCentre) < 5);   // (and any other man of the team stood on this side of that door: he heard 'bang out' too — as have the men of every order let go on the same word or going in by another door on the same signal, at whatever door)
    const samPos = g.player.char.pos, samOurs = g.orders.sams && offOf(d, samPos, op.side) > 0 && flat(samPos, d.frameCentre) < 5;   // (the player by the same test as any other man of the team on this side of the door — samstun.ts)
    if (DOORTOOLS.ownCan) it.side = op.threw?.team ?? g.orders.team;   // (whose can it is, said before the thrower leaves the list: detonateStun would look him up on it and find a guard's)
    const rest = all.filter(x => !ours(x)), was = rest.map(x => x.staggerUntil);
    g.guards = rest; try { detonateStun(g, it, false, { side: g.orders.team, spare: samOurs }); } finally { g.guards = all; }
    rest.forEach((x, i) => { if (x.team === 'operative' && x.staggerUntil > was[i]) this.stats.ownFlashed++; });
    op.bangT = g.time; op.bangAt = v3.copy(it.pos); op.phase = 'wait'; this.stats.bangs++; if (!op.thr) this.closeUp(op);
    this.beat(op, `bang · ${offOf(op.door, it.pos, op.side) < 0 ? 'inside' : 'OUTSIDE'} ${Math.abs(offOf(op.door, it.pos, op.side)).toFixed(1)} m`);
    if (op.thr) this.thrBanged(op);
  }
  // ------------------------------------------------------------ corners, and the room looked over
  /** a man's corners on the way in — the near one on his own side of the door (the room's floor furthest to that hand within a couple of metres of the entry
   *  wall), then that side's deep one — and his muzzle's turn on them. True while he still has one to check. */
  private cornerStep(op: DoorOp, gd: Guard, A: Assignment, pod: { pos: Vec3; face: number }): boolean {
    const g = this.g, K = DOORTOOLS, t = g.time, c = gd.char;
    let C = op.corner.get(gd); if (!C) { C = { pts: this.cornersOf(op, pod), i: 0, on: NaN }; op.corner.set(gd, C); }
    if (C.i >= C.pts.length) return false;
    const pt = C.pts[C.i], yaw = yawTo(c.pos, pt);
    A.watch = pt;   // (from the stack on: the muzzle leads him round the jamb)
    const tx = Math.max(this.inAt(op, gd), op.threat?.deal?.get(gd)?.doneT ?? -Infinity); if (isNaN(tx)) return true;   // (threatFirst: a corner's clock starts when the known place let his gun go)
    if (K.cornerOwed) { if (gd.script?.over) C.fight = (C.fight ?? 0) + clamp(t - (C.last ?? t), 0, 0.05); C.last = t; }   // (the time his gun was on a man: not the corner's)
    // (cornerTurn: stood on his point with the corner behind his shoulder — a muzzle goes 1.5 rad round his chest and no further — he turns to it, and stays
    //  turned to whichever corner is owed until they are done; the sweep / the search / his sector give him his facing back)
    if (K.cornerTurn && !gd.script?.over && this.onPoint(gd, A, pod) && (C.turned || Math.abs(wrapAngle(yaw - c.bodyYaw)) > 1.3)) { C.turned = true; A.face = yaw; }
    if (!gd.script?.over && Math.abs(wrapAngle(c.aimYaw - yaw)) < K.cornerRad) { if (isNaN(C.on)) C.on = t; } else C.on = NaN;   // (a muzzle the room fight has on a man is not on the corner: its turn starts over)
    if ((!isNaN(C.on) && t - C.on >= K.cornerSecs) || t - tx - (C.fight ?? 0) > K.cornerCap * (C.i + 1) || flat(c.pos, pt) < 1.0) { C.i++; C.on = NaN; if (C.i >= C.pts.length) A.watch = null; }
    return C.i < C.pts.length;
  }
  /** stood on the point the entry gave him (or where he stopped short of it: orders.ts brings the mark to him) */
  private onPoint(gd: Guard, A: Assignment, pod: { pos: Vec3; face: number }): boolean { const p = gd.char.pos; return !(flat(p, pod.pos) > 0.6 && A.post && flat(p, A.post) > 0.6); }
  /** `collapse` (roomfight.ts asks, the moment a man this teammate was on has dropped): has he a corner of an entry still to check — then his muzzle is the
   *  corner's now, not the dead man's spot's */
  owesCorner(gd: Guard): boolean {
    if (!DOORTOOLS.collapse || !DOORTOOLS.corners) return false;
    for (const op of this.ops) { if (op.phase !== 'enter') continue; const C = op.corner.get(gd);
      if (C && C.i < C.pts.length && op.men.includes(gd)) return op.men.some(m => m !== gd && m.state !== 'dead' && op.crossed.has(m)); }   // (… with a mate through the frame behind him: the middle of the room is that man's. Alone inside, his eyes stay where the man was for the half second — where one stood, the next often is)
    return false;
  }
  // ------------------------------------------------------------ a known threat first (DOORTOOLS.threatFirst)
  /** what the order's men have LEARNT of an enemy beyond their door this frame, added to what it remembers: a man one of them has in sight (the room fight's
   *  own meters), the muzzle of a round that hit or passed one of them — the men it started with who have dropped included. Forgotten after `threatSecs`, or
   *  when the man is down. ONE MODEL: nothing here reads where an enemy IS unless one of these men has him in sight */
  private threatNote(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, t = g.time, d = op.door, nav = g.col.nav, T = op.threat ??= { known: [], evT: t - 0.5 };
    const cellOf = (p: Vec3) => Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell);
    if (T.room === undefined || t - (T.roomT ?? -Infinity) > 2) { T.roomT = t;   // (asked again every two seconds: a wall blown since joins rooms)
      T.room = g.fight?.roomAt(doorPt(d, d.def.width / 2, 0.9, -op.side as 1 | -1)) ?? null;
      if (T.room?.cells.has(cellOf(doorPt(d, d.def.width / 2, 0.9, op.side)))) T.room = null; }   // (the floor the team stands on is part of it — an arch, a hole: no model of 'beyond'; past the frame line it is, then)
    const room = T.room, far = (p: Vec3) => offOf(d, p, op.side) < 0 && flat(p, d.frameCentre) < (room ? 1.5 : K.lookM);   // (in the doorway itself; with no model of the room, anywhere past the frame line in a look's reach)
    const beyond = (p: Vec3) => !!room?.cells.has(cellOf(p)) || far(p);
    const note = (by: Guard, at: Vec3, how: 'seen' | 'shot') => { const k = T.known.find(x => x.by === by);
      if (k) { k.at = [at[0], 0, at[2]]; k.t = t; k.how = how; } else { T.known.push({ at: [at[0], 0, at[2]], t, by, how }); this.beat(op, `threat known · ${how} · ${by.callsign ?? 'a man'} (${at[0].toFixed(1)}, ${at[2].toFixed(1)})`); } };
    for (const gd of op.men) { const O = g.fight?.opOf(gd); if (!O) continue;
      for (const [h, M] of O.meters) if (h.state !== 'dead' && t - M.seenT < 0.1 && beyond(h.char.pos)) note(h, h.char.pos, 'seen'); }
    for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.time < T.evT) break;   // (rounds leave AFTER this tick in a frame: the last tick's own frame is read again)
      if (e.kind !== 'guardShot' || !e.from || !e.to || e.who === undefined || !beyond(e.from)) continue;
      const by = g.guards.find(x => x.char.id === e.who); if (!by || by.team === 'operative' || by.state === 'dead') continue;
      const a = e.from, bx = e.to[0] - a[0], bz = e.to[2] - a[2], L2 = bx * bx + bz * bz || 1e-6;
      for (const m of op.from.keys()) { if (!op.men.includes(m) && m.state !== 'dead') continue;   // (the men still on it, and the ones it has lost …
        if (m.state === 'dead' && !this.sees(op, m.char.pos)) continue;   // … where a man still up SAW him go down: a round over a body nobody can see tells nobody)
        const p = m.char.pos, k = clamp(((p[0] - a[0]) * bx + (p[2] - a[2]) * bz) / L2, 0, 1);
        if (Math.hypot(a[0] + bx * k - p[0], a[2] + bz * k - p[2]) <= K.threatNearM) { note(by, a, 'shot'); break; } } }
    T.evT = t;
    for (let i = T.known.length - 1; i >= 0; i--) { const k = T.known[i]; if (t - k.t > K.threatSecs || (k.by?.state === 'dead' && this.sees(op, k.by.char.pos))) T.known.splice(i, 1); }
  }
  /** one of the order's men still up has a line from his eyes to a man on the floor there (a mate who dropped, an enemy who did) */
  private sees(op: DoorOp, p: Vec3): boolean { const g = this.g, at: Vec3 = [p[0], 0.4, p[2]];
    return op.men.some(m => m.state !== 'dead' && !g.col.segmentBlocked(m.char.bones.head ?? [m.char.pos[0], 1.6, m.char.pos[2]], at)); }
  /** the entry's first frame: the first man in is given the known place nearest the doorway, the second the next — or, with one known, the same one until the
   *  first man has a line to it. Nothing known: nothing dealt, the entry as it was */
  private threatDeal(op: DoorOp) {
    const T = op.threat; if (!T || T.deal) return; T.deal = new Map();
    const d = op.door, known = [...T.known].sort((a, b) => flat(a.at, d.frameCentre) - flat(b.at, d.frameCentre)); if (!known.length || !op.queue.length) return;
    const m1 = op.queue[0].gd, m2 = op.queue[1]?.gd, mk = (th: KnownThreat, lead: Guard | null): ThreatWatch => ({ th, lead, on: NaN, fight: 0, last: NaN, doneT: NaN });
    T.deal.set(m1, mk(known[0], null)); if (m2) T.deal.set(m2, known[1] ? mk(known[1], null) : mk(known[0], m1));
    this.beat(op, `threat first · ${[...T.deal].map(([m, G]) => `${m.callsign} on ${G.th.by?.callsign ?? 'a man'}'s place (${G.th.at[0].toFixed(1)}, ${G.th.at[2].toFixed(1)})${G.lead ? ' until the first man has it' : ''}`).join(' · ')}`);
  }
  /** a man going in whose gun is a known place's: true while it still is (his corners wait). Where he looks only — the room fight has his trigger, and its
   *  seconds on a man are not counted against `threatCap` */
  private threatStep(op: DoorOp, gd: Guard, A: Assignment, pod: { pos: Vec3; face: number }): boolean {
    const G = op.threat!.deal!.get(gd); if (!G || !isNaN(G.doneT)) return false;
    const g = this.g, K = DOORTOOLS, t = g.time, c = gd.char, th = G.th, w: Vec3 = [th.at[0], 1.2, th.at[2]], eye = (m: Guard): Vec3 => m.char.bones.head ?? [m.char.pos[0], 1.6, m.char.pos[2]];
    const done = (why: string) => { G.doneT = t; A.watch = null; if (G.faced) { A.strafe = false; A.face = pod.face; } this.beat(op, `threat ${why} · ${gd.callsign}`); return false; };
    if (!K.threatFirst) return done('let go: switched off');
    if (t - th.t > K.threatSecs) return done('let go: old news');   // (also the bound for a man who never gets through the frame)
    if (th.by?.state === 'dead' && this.sees(op, th.by.char.pos)) return done('down');   // (seen down: a man dropped out of the team's sight is still a place to look at)
    if (G.lead) { const L = op.threat!.deal!.get(G.lead);   // (the second gun: on it until the first man has it — a first man lost leaves it his own)
      if (G.lead.state === 'dead' || !op.men.includes(G.lead) || !L) G.lead = null;
      else if (!isNaN(L.doneT)) return done('dealt with by the first man');
      else if (op.crossed.has(G.lead) && !g.col.segmentBlocked(eye(G.lead), w)) return done("is the first man's"); }
    A.watch = w;
    const tx = this.inAt(op, gd);
    if (isNaN(tx)) {   // (not through the frame yet: the muzzle leads him round the jamb onto it — unless he is held up there)
      if (K.threatStuck > 0) { if (!G.at || flat(G.at, c.pos) > 0.3) { G.at = [c.pos[0], 0, c.pos[2]]; G.still = 0; } else if (!gd.script?.over) G.still = (G.still ?? 0) + clamp(t - (isNaN(G.last) ? t : G.last), 0, 0.05);
        G.last = t; if ((G.still ?? 0) > K.threatStuck) return done('let go: held up at the frame'); }
      return true; }
    const yaw = yawTo(c.pos, w), over = !!gd.script?.over;
    if (over) G.fight += clamp(t - (isNaN(G.last) ? t : G.last), 0, 0.05); G.last = t;
    if (!G.lead || this.onPoint(gd, A, pod)) { A.face = yaw; A.strafe = !G.lead; G.faced = true; }   // (through the frame the first man's CHEST is on it too: he side-steps to his point — a walker's gun goes 1.5 rad round his chest and no further, and his point is often further round than that. The second gun only turns to it once stood)
    if (!G.lead) {
      if (!over && Math.abs(wrapAngle(c.aimYaw - yaw)) < K.cornerRad && !g.col.segmentBlocked(eye(gd), w)) { if (isNaN(G.on)) G.on = t; } else G.on = NaN;
      if (!isNaN(G.on) && t - G.on >= K.cornerSecs) return done('looked at: nobody there');
      if (flat(c.pos, w) < 1.0) return done('stood on'); }
    if (t - tx - G.fight > K.threatCap) return done('cap');
    return true;
  }
  /** WHO GOES IN FIRST (`leadSeen`): of the front man of the file on each jamb, the one who has seen most of the room behind the door — when that is
   *  `leadSeenMin` cells more than the lead has; else the lead. Not the man who threw the can while another stands at the frame. `at`: a point inside the room
   *  (the entry's first point of domination; left out, the door's first point as the room's shape gives it — only the room it lies in is read) */
  private firstIn(op: DoorOp, at?: Vec3, byGun = true): Guard {   // (`byGun` false: who it would have been by the room seen alone — asked only to say why he goes first)
    const K = DOORTOOLS, lead = op.lead, d = op.door, W = d.def.width;
    if (!K.leadSeen || op.men.length < 2) return lead;
    if (byGun && op.first && op.first.state !== 'dead' && op.men.includes(op.first)) return op.first;
    const where = (m: Guard) => op.post.get(m)?.pos ?? m.char.pos, hi = (m: Guard) => alongOf(d, where(m)) > W / 2, near = (m: Guard) => flat(where(m), d.frameCentre);
    const fronts = [true, false].map(s => op.men.filter(m => m.state !== 'dead' && hi(m) === s && offOf(d, m.char.pos, op.side) > 0).sort((a, b) => near(a) - near(b))[0]).filter((m): m is Guard => !!m);
    const hands = fronts.filter(m => m !== op.threw || m === lead || fronts.length < 2);   // (a lead who threw it himself — secondThrows off — goes first as he did)
    const rw = rearWatcher(this.g, op), able = rw && hands.some(m => m !== rw) ? hands.filter(m => m !== rw) : hands;   // (rearwatch.ts: the man on the open way at the stack's back is not the one picked to go first while another file has a front man who did not throw the can — he follows last)
    return this.seenMost(lead, byGun ? gunFirst(able) : able, at ?? this.podsAsWere(d, op.side, 2)[0]?.pos);   // (gunroles.ts: a room gun's man before a long gun's — the same men where their guns do not differ)
  }
  /** of `men`, the one who has seen most of the room `at` is in — `lead` unless another has seen `leadSeenMin` cells more than he has (a lead who is not
   *  among them — he threw the can; a man of his own file stands nearer the frame — has no claim over the men who are) */
  private seenMost(lead: Guard, men: Guard[], at: Vec3 | undefined): Guard {
    const g = this.g, K = DOORTOOLS, room = at && this.seen ? g.fight?.roomAt(at) ?? null : null;
    if (!room || !men.length) return men.includes(lead) || !men.length ? lead : men[0];
    const since = g.time - K.leadSeenSecs, n = (m: Guard) => this.seen!.count(m, room.cells, since);
    let best = men.includes(lead) ? lead : men[0], bn = best === lead ? n(lead) + Math.max(0, K.leadSeenMin - 1) : n(best);
    for (const m of men) { if (m === best) continue; const k = n(m); if (k > bn) { bn = k; best = m; } }
    return best;
  }
  /** when he came through the frame ON THIS ENTRY (a man the order found on the far side crossed nothing: NaN until 'going in') */
  private inAt(op: DoorOp, gd: Guard): number { const tx = op.crossed.get(gd); return tx === undefined || op.phase !== 'enter' ? NaN : Math.max(tx, op.t0); }
  /** on his sector, as the entry leaves him */
  private onSector(gd: Guard, A: Assignment, pod: { pos: Vec3; face: number; watch?: Vec3 }): number {
    const p = gd.char.pos, w = ENTRY.offOpenings && ENTRY.watch ? pod.watch : undefined, yaw = w ? yawTo(p, w) : pod.face;   // (a point moved off an opening nobody has been beyond: his gun is on that opening — entrypoints.ts)
    A.watch = w ? [w[0], w[1], w[2]] : [p[0] + Math.sin(yaw) * 4, 1.2, p[2] + Math.cos(yaw) * 4]; A.face = yaw; A.there = 'holding the room'; return yaw;
  }
  /** the men an entry has left holding a room, each with the sector his point gave him (`face`) and how far it has been swung off a mate (`d`) */
  private held = new Map<Guard, { A: Assignment; face: number; d: number; hitT: number; arrT: number; out?: boolean; door?: Door }>();
  /** rearwatch.ts (REARWATCH.room): the men an ended entry has holding one of its room's other doors, each with the door and the order he holds it on */
  doorKeepers(): [Guard, Door, Assignment][] { const out: [Guard, Door, Assignment][] = []; for (const [gd, R] of this.held) if (R.door) out.push([gd, R.door, R.A]); return out; }
  /** A HELD SECTOR IS KEPT OFF A MATE (DOORTOOLS.sectors): while a man holds a room on the order the entry left him, a teammate standing in his sector for
   *  `sectorSecs` (a man walking across it only dips his muzzle: the runner's discipline) swings it off him by the least turn that clears every mate — a gun
   *  held on a friend's back is a gun at the low ready, and three of four once held a room that way with nothing up. Back onto the point's own line when
   *  that is clear again. */
  private keepSectors() {
    const g = this.g, K = DOORTOOLS, t = g.time;
    for (const [gd, R] of this.held) {
      if (gd.state === 'dead' || g.orders.of(gd) !== R.A) { this.held.delete(gd); continue; }
      if (R.door && K.thrDoorsLit && (!nvgWorn(g, gd) || nvgBlack(g, gd))) R.A.searchT = t;   // (a door held for the room: his light is the light rule's as on the search, for as long as he holds it — the place's own light still puts it out)
      if (!K.sectors) continue;
      // (a swing is not a new arrival: his gun travelling to the swung line reads 'not on his mark yet' to the orders for a moment, and the stamp they put on
      //  his getting back would relight a weapon light that is meant to be dark on the hold — the first arrival's stamp stands)
      if (R.A.arrived) { if (isNaN(R.arrT)) R.arrT = R.A.arrT; else R.A.arrT = R.arrT; }
      if (!R.A.arrived || gd.script?.over || R.out) continue;   // (the man on the door they came in by keeps it: a mate in that line brings his gun down, it is not swung off the door)
      const p = gd.char.pos, hit = (y: number) => !!colleagueInLine(g, gd, [p[0] + Math.sin(y) * 4, 1.2, p[2] + Math.cos(y) * 4]);   // (the runner's own test: what would bring his gun down)
      const want = !hit(R.face) ? 0 : R.d !== 0 && !hit(R.face + R.d) ? R.d : null;
      if (want === R.d) { R.hitT = NaN; continue; }
      if (isNaN(R.hitT)) R.hitT = t; if (t - R.hitT < K.sectorSecs) continue;
      let d = want; if (d === null) for (const x of [0.25, -0.25, 0.5, -0.5, 0.75, -0.75, 1, -1]) if (!hit(R.face + x)) { d = x; break; }
      if (d === null) continue;   // (boxed in every way: the muzzle discipline has him)
      R.d = d; R.hitT = NaN; const yaw = R.face + d; R.A.watch = [p[0] + Math.sin(yaw) * 4, 1.2, p[2] + Math.cos(yaw) * 4]; R.A.face = yaw;
      if (d !== 0) { this.stats.sectors++; this.note(`${gd.callsign} swings his sector ${Math.round(d * 57.3)}° off a mate`); }   // (d 0: the mate has gone, back onto the line he was dealt)
    }
  }
  /** the entries that have ended 'in' with men still holding the room: their rooms' other doors are still dealt (otherDoors) */
  private watches: DoorOp[] = [];
  private onOther(op: DoorOp, gd: Guard): boolean { if (DOORTOOLS.otherDoorM > 0 && op.other) for (const R of op.other.values()) if (R.gd === gd) return true; return false; }
  /** THE ROOM'S OTHER DOOR, WATCHED (DOORTOOLS.otherDoorM): each other door of the room this entry is taking that nobody of the squad has been beyond gets
   *  the nearest man of the entry who is on his point with a line to its frame — his gun goes onto it where he stands (nobody walks), and stays. Asked every
   *  frame of the entry and, `ended`, for as long as a man of it holds the room after: a man down or re-ordered gives his door up, and it is dealt again; a
   *  door the squad has since been beyond, one another order has come to work, or one somebody else has been told to watch is GIVEN BACK — its man is on his
   *  sector again. While the floor is still being looked over half the entry's men stay the floor's, and both men of an entry of two. `deal` false: nothing new is dealt (the entry's last
   *  frame: the door they came in by gets its man first). False: nobody of this entry is left in the room, or the rule is off. `seen` (thrDoorsLeaf, a
   *  threshold's last act): a man the door's own open leaf would hide it from does not keep or take it here — holdDoors posts a man on it next. */
  private otherDoors(op: DoorOp, ended = false, deal = true, seen = false): boolean {
    const g = this.g, K = DOORTOOLS, d = op.door, M = op.other ??= new Map<Door, { gd: Guard; w: Vec3 }>();
    const ours = (m: Guard) => m.state !== 'dead' && op.pod.has(m) && g.orders.of(m) === op.mine.get(m) && (!ended || this.held.get(m)?.A === op.mine.get(m));
    const inside = op.men.filter(ours);
    // (given back: where he holds the room on this entry still, he is on the sector his point gave him again; mid-search the floor's look takes his gun)
    const back = (o: Door, gd: Guard) => { M.delete(o); const H = this.held.get(gd), A = op.mine.get(gd), pod = op.pod.get(gd);
      if (H && A && pod && H.A === A && H.door === o && inside.includes(gd)) { H.face = this.onSector(gd, A, pod); H.d = 0; H.out = false; H.door = undefined; } };
    if (!(K.otherDoorM > 0)) { for (const [o, R] of [...M]) back(o, R.gd); return false; }   // (the rule switched off under a held room)
    for (const [o, R] of M) if (!inside.includes(R.gd)) M.delete(o);
    if (!inside.length) return false;
    const room = this.roomIn(op);
    if (room && !openFloor(g, room)) {
      const eye = (p: Vec3): Vec3 => [p[0], 1.5, p[2]], nav = g.col.nav, inner = (e: { door: Door; out: ArrayLike<number> }): Vec3 => [e.door.frameCentre[0] - e.out[0] * 0.4, 1.2, e.door.frameCentre[2] - e.out[1] * 0.4];
      // (the rest of the squad: every living teammate who is not holding this room on this entry — a man of the entry Sam has since given another order included)
      const squad = g.guards.filter(m => m.team === 'operative' && !!m.unit && m.state !== 'dead' && !inside.includes(m));
      // (a door another order works, one somebody else already holds, one a teammate has been told to watch — Sam's own posting — is theirs …)
      const theirs = (o: Door, by?: Guard) => this.ops.some(x => x !== op && x.door === o) || [...this.held].some(([m, R]) => R.door === o && m !== by)
        || squad.some(m => { const A = g.orders.of(m); return !!A && (A.door === o || (!!A.watch && flat(A.watch, o.frameCentre) < 1.5)); });
      // (… and one a teammate stands by is not dealt while he does: a man in the file behind Sam is walking through, not standing by anything)
      const beside = (o: Door) => squad.some(m => flat(m.char.pos, o.frameCentre) < 3 && g.orders.of(m)?.post !== null);
      for (const [o, R] of [...M]) { const e = room.entries.find(x => x.door === o), O = g.cover.ready().find(x => x.door === o);
        if (!e || !O || g.entry.farKnown(O, inner(e)) || theirs(o, R.gd) || (seen && this.leafAcross(o, R.gd.char.pos, inner(e)) > 0)) { back(o, R.gd); this.beat(op, `other door · ${R.gd.callsign} off ${o.def.name}`); } }
      const free = !deal ? [] : inside.filter(m => { const H = this.held.get(m); return (op.onPod.has(m) || (ended && !!op.mine.get(m)?.arrived)) && !this.onOther(op, m) && !H?.out && !H?.door && g.time >= m.dazzledUntil; });
      // (a door into the building before one to the outside, and the nearer to the men in the room first: there may be more doors than men to spare)
      // (mid-search half the entry's guns may go to doors — and none of an entry of TWO: its first man, turned to a door a second after he crossed, was shot
      // by a man of the room the charge had only stunned. Two men keep both guns on the room until its floor is looked over; the doors are dealt at 'in')
      const spare = op.men.filter(m => m.state !== 'dead' && g.orders.of(m) === op.mine.get(m)).length < 3 ? 0 : Math.floor(inside.length / 2);
      const nearest = (o: Door) => Math.min(...inside.map(m => flat(m.char.pos, o.frameCentre))), rank = (o: Door) => (o.def.exterior ? 100 : 0) + nearest(o);
      for (const e of [...room.entries].sort((a, b) => rank(a.door) - rank(b.door))) { const o = e.door, fc = o.frameCentre; if (o === d || M.has(o) || !free.length) continue;
        if (!ended && M.size >= spare) break;   // (the floor is still being looked over: half the entry's guns stay the room's)
        const O = g.cover.ready().find(x => x.door === o), at = inner(e);
        if (!O || g.entry.farKnown(O, at) || theirs(o) || beside(o)) continue;
        if (nav.isBlocked(fc[0] + e.out[0] * 0.9, fc[2] + e.out[1] * 0.9) && nav.isBlocked(fc[0] + e.out[0] * 1.5, fc[2] + e.out[1] * 1.5)) continue;   // (no floor beyond: nobody comes that way)
        const gd = free.filter(m => flat(m.char.pos, fc) <= K.otherDoorM && !g.col.segmentBlocked(eye(m.char.pos), at) && !(seen && this.leafAcross(o, m.char.pos, at) > 0)).sort((a, b) => (this.leafAcross(o, a.char.pos, at) - this.leafAcross(o, b.char.pos, at)) || flat(a.char.pos, fc) - flat(b.char.pos, fc))[0];   // (thrDoorsLeaf: the man the door's own leaf would hide it from least, first — and with `seen`, nobody it would hide it from: the caller walks a man to a post next)
        if (!gd) continue;
        const beyond: Vec3 = [fc[0] + e.out[0], 1.2, fc[2] + e.out[1]];   // (a metre on through it where he looks down its line; from beside it, the frame itself)
        M.set(o, { gd, w: g.col.segmentBlocked(eye(gd.char.pos), beyond) ? [fc[0], 1.2, fc[2]] : beyond });
        free.splice(free.indexOf(gd), 1); this.beat(op, `other door · ${gd.callsign} on ${o.def.name}`);
      }
    } else if (room && room.cells.size <= K.searchCells) for (const [o, R] of [...M]) back(o, R.gd);   // (floor under the sky — openAir raised mid-entry, a wall gone: a door dealt before is given back, not kept)
    for (const [o, R] of M) { const A = op.mine.get(R.gd)!, yaw = yawTo(R.gd.char.pos, R.w), H = this.held.get(R.gd);
      A.watch = R.w; A.face = yaw; A.there = `holding · ${doorWords(o)}`;
      if (H) { H.face = yaw; H.d = 0; H.out = true; H.door = o; } }
    return true;
  }
  /** DOORTOOLS.thrDoorsLeaf: how much door `o`'s own leaf, stood open, would hide the door from a man at `p` — the share (0 to 1) of the angles from
   *  near square to its stop (LEAF_FROM, LEAF_STEP: where a leaf left open can stand) at which it lies across the line on the floor from `p` to the
   *  point the door is held on. 0: it never does (and a leaf that opens away from that point never does) */
  private leafAcross(o: Door, p: Vec3, at: Vec3): number {
    if (!DOORTOOLS.thrDoorsLeaf || !DOORWAY.oneWay || o.off) return 0;
    const stop = o.swing > 0 ? o.maxA : o.minA, sg = Math.sign(stop), top = Math.abs(stop), W = o.def.width + LEAF_EDGE, hx = o.def.hinge[0], hz = o.def.hinge[1], rx = at[0] - p[0], rz = at[2] - p[2];
    const cut = (a: number) => { const th = o.def.closedDir + a, lx = Math.cos(th) * W, lz = Math.sin(th) * W, den = rx * lz - rz * lx; if (Math.abs(den) < 1e-9) return 0;
      const s = ((hx - p[0]) * lz - (hz - p[2]) * lx) / den, u = ((hx - p[0]) * rz - (hz - p[2]) * rx) / den;   // (s along his line, u out along the leaf)
      return s > 0 && s < 1 && u > 0 && u < 1 ? 1 : 0; };
    let n = 1, hid = cut(stop); for (let a = Math.min(LEAF_FROM, top); a < top; a += LEAF_STEP) { n++; hid += cut(sg * a); }
    return hid / n;
  }
  /** THE ROOM'S OTHER DOORS, HELD (DOORTOOLS.thrDoors — a threshold stage's last act before 'in'): the farthest from the entry first, each to one of the men
   *  the entry has left on a sector (the man on the door they came in by keeps that). A man with a line to its frame from within `thrDoorsM` has it from
   *  where he stands; else the least walk to floor beside it — 2 to 4 m off, past a jamb's line, in this room, a line to the frame — and he goes there at the
   *  entry's pace with his gun on it. A door another order is working is that order's. */
  private holdDoors(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, nav = g.col.nav, d = op.door;
    const room = this.roomIn(op); if (!room || openFloor(g, room)) return;   // (open floor is no room: its 'doors' are whatever it met)
    const men = op.men.filter(m => m.state !== 'dead' && !!this.held.get(m) && !this.held.get(m)!.out); if (!men.length) return;
    const eye = (p: Vec3): Vec3 => [p[0], 1.5, p[2]], cell = (p: Vec3) => nav.idx(Math.floor(p[0] / nav.cell), Math.floor(p[2] / nav.cell));
    // where every one of ours stands, or is being sent (a post dealt here replaces a man's own spot) — nobody is posted on top of a mate, or of Sam
    const ours = g.guards.filter(m => m.team === 'operative' && !!m.unit && m.state !== 'dead'), stood = new Map<Guard, Vec3>(ours.map(m => [m, m.char.pos]));
    const clear = (m: Guard, p: Vec3) => flat(g.orders.samStood, p) >= 1.0 && ![...stood].some(([x, q]) => x !== m && flat(q, p) < 1.0);
    const walk = (m: Guard, p: Vec3): number => { const path = nav.findPath(m.char.pos, p); if (!path) return Infinity; let l = 0, q = m.char.pos; for (const r of path) { l += flat(q, r); q = r; } return l; };
    const taken = (o: Door) => this.ops.some(x => x !== op && x.door === o) || [...this.held.values()].some(R => R.door === o) || ours.some(m => !op.men.includes(m) && flat(m.char.pos, o.frameCentre) < 3);   // (another order's door, a door already held, a door somebody of ours stands on)
    const doors = room.entries.filter(e => e.door !== d && !taken(e.door)).sort((a, b) => flat(b.at, d.frameCentre) - flat(a.at, d.frameCentre));
    const kept = op.men.some(m => { const R = this.held.get(m); return m.state !== 'dead' && !!R && R.out && !R.door; }), stay = kept ? 0 : K.thrDoorsStay;   // (the way they came in is somebody's — or one of these men is not sent)
    const said: string[] = [], dealt = new Map<Guard, Vec3>(), where = (m: Guard): Vec3 => dealt.get(m) ?? g.orders.of(m)?.post ?? m.char.pos, len = this.walks();
    for (const e of doors) { if (men.length <= stay) break;
      const o = e.door, W = o.def.width, fc = o.frameCentre, at: Vec3 = [fc[0] - e.out[0] * 0.4, 1.2, fc[2] - e.out[1] * 0.4], w: Vec3 = [fc[0] + e.out[0], 1.2, fc[2] + e.out[1]], rs = sideOf(o, [fc[0] - e.out[0], 0, fc[2] - e.out[1]]);
      const inSwing = K.thrDoorsLeaf && DOORWAY.oneWay && !o.off && Math.sign(o.swing > 0 ? o.maxA : o.minA) === rs;   // (its leaf opens into this room: LEAF_POSTS)
      let gd: Guard | null = men.filter(m => flat(m.char.pos, fc) <= K.thrDoorsM && !g.col.segmentBlocked(eye(m.char.pos), at) && !this.leafAcross(o, m.char.pos, at)).sort((a, b) => flat(a.char.pos, fc) - flat(b.char.pos, fc))[0] ?? null, post: Vec3 | null = null;
      // (DOORTOOLS.buddyDoors: a walk that takes him away from everybody is his pair's, or nobody's — away(); a man refused one point is tried on the
      //  others, then the next man; with nobody who may go the door is left to the room's own cover, as a door past `thrDoorsWalk` is)
      let mate: { gd: Guard; pod: { pos: Vec3; face: number } } | null = null;
      if (!gd) { const tried = new Set<string>();
        for (;;) { let best = Infinity, k = 0, key = ''; gd = null; post = null;
          for (const [L, D] of [[1.5, 2.6], [2.0, 2.2], [1.1, 3.2], [2.4, 3.0], [1.8, 3.8], [0.9, 2.2], ...(inSwing ? LEAF_POSTS : [])]) { k++;
            for (const sgn of [1, -1]) { const p = doorPt(o, W / 2 + sgn * (W / 2 + L), D, rs);
              if (nav.isBlocked(p[0], p[2]) || !room.cells.has(cell(p)) || g.col.segmentBlocked(eye(p), at)) continue;
              const hid = this.leafAcross(o, p, at), behind = hid ? LEAF_COST * (1 + hid) : 0;   // (thrDoorsLeaf: a post the door's own leaf would hide it from is the last resort, and the less it would the better)
              for (const m of men) { const c = flat(m.char.pos, p) + 0.4 * k + behind; if (c < best && clear(m, p) && !tried.has(`${men.indexOf(m)}:${k}:${sgn}`)) { best = c; gd = m; post = p; key = `${men.indexOf(m)}:${k}:${sgn}`; } } } }
          if (!gd || !post || walk(gd, post) > K.thrDoorsWalk) { gd = null; break; }   // (no way there, or a walk out of all proportion: that door is left)
          if (!(K.buddy && K.buddyDoors)) { if (!K.buddy && this.away(gd, post, men.length - 2 >= stay ? men : [], where, len) !== 'alone') this.stats.doorAlone++; break; }   // (as it was: one man, whoever is nearest — off only counts the walks that take him away from everybody)
          const h = this.away(gd, post, men.length - 2 >= stay ? men : [], where, len);
          const pod = h === 'alone' || h === 'no' ? null : this.besidePod(post, yawTo(post, w), h, ours.filter(m => m !== gd && m !== h).map(where), p => room.cells.has(cell(p)));
          if (h === 'no' || (h !== 'alone' && !pod)) { tried.add(key); continue; }
          if (h !== 'alone') mate = { gd: h, pod: pod! }; break; }
        if (!gd && tried.size) this.stats.notSent++; }
      if (!gd) continue;
      men.splice(men.indexOf(gd), 1);
      if (post) this.offSwing({ pos: post }, op.door, op.side, [...[...op.pod].filter(([m]) => m !== gd && m.state !== 'dead').map(([, o]) => o.pos), ...ours.filter(m => m !== gd).map(where), ...(mate ? [mate.pod.pos] : [])], at);
      const from = post ?? gd.char.pos, yaw = yawTo(from, w), name = doorWords(o);
      if (post) this.stats.sentOn++;
      if (mate) { const b = mate.gd; this.stats.sentPair++; men.splice(men.indexOf(b), 1); stood.set(b, mate.pod.pos); dealt.set(b, mate.pod.pos);
        this.sendOn(op, b, mate.pod, `with ${gd.callsign} · ${name}`); this.held.set(b, { A: op.mine.get(b)!, face: mate.pod.face, d: 0, hitT: NaN, arrT: NaN }); said.push(`${b.callsign} with ${gd.callsign}`); }
      if (post) {
        op.pod.set(gd, { pos: post, face: yaw }); op.onPod.delete(gd); stood.set(gd, post); dealt.set(gd, post);
        this.assign(op, gd, { post, face: yaw, watch: w, shy: null, thru: op.door, pace: g.orders.knobs.entry, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: true, going: `to the far door · ${name}`, there: `holding · ${name}` }); }
      const A = op.mine.get(gd)!; A.watch = w; A.face = yaw; A.there = `holding · ${name}`;
      this.held.set(gd, { A, face: yaw, d: 0, hitT: NaN, arrT: NaN, out: true, door: o });
      said.push(`${gd.callsign} ${post ? 'up to' : 'on'} ${o.def.name}`);
    }
    if (said.length) this.beat(op, `doors · ${said.join(' · ')}`);
  }
  /** the room this entry goes into, as the room fight has it: asked at a point of domination (free floor inside by construction — the floor just inside a door
   *  can be furniture, and the nearest free cell to THAT can be the corridor's) */
  private roomIn(op: DoorOp) { const pod = op.queue[0]?.pod ?? op.pod.values().next().value; return pod ? this.g.fight?.roomAt(pod.pos) ?? null : null; }
  private cornersOf(op: DoorOp, pod: { pos: Vec3; face: number }): Vec3[] {
    const g = this.g, d = op.door, W = d.def.width;
    const room = g.fight?.roomAt(pod.pos); if (!room) return [];
    const nav = g.col.nav, cs = nav.cell, s = alongOf(d, pod.pos) >= W / 2 ? 1 : -1;
    let near: Vec3 | null = null, nb = 0, deep: Vec3 | null = null, db = 0;
    for (const ci of room.cells) { const p: Vec3 = [(ci % nav.W + 0.5) * cs, 1.1, (((ci / nav.W) | 0) + 0.5) * cs];
      const a = s * (alongOf(d, p) - W / 2), b = -offOf(d, p, op.side); if (b < 0.2 || a < 0 || a > 9 || b > 10) continue;
      if (b <= 1.8) { if (a >= 0.8 && a - b * 0.5 > nb) { nb = a - b * 0.5; near = p; } }
      else if (a * 0.7 + b > db) { db = a * 0.7 + b; deep = p; } }
    return [near, deep].filter((p): p is Vec3 => !!p);
  }
  /** the room this entry is into as floor to look over (built once, on the first tick of the entry) */
  private searchOf(op: DoorOp, at?: Vec3): RoomSearch | null {
    if (op.search !== undefined) return op.search;
    const g = this.g, K = DOORTOOLS; op.search = null; if (!K.search) return null;
    const room = at ? g.fight?.roomAt(at) ?? null : this.roomIn(op); if (!room || openFloor(g, room)) return null;   // (`at`: asked before anybody has a point in there — the threshold)
    for (const o of this.ops) if (o !== op && o.search && o.search.room === room) return op.search = o.search;   // (another order already in this room: one floor, looked over between them)
    const nav = g.col.nav, cs = nav.cell, pts: Vec3[] = [];
    for (const ci of room.cells) pts.push([(ci % nav.W + 0.5) * cs, 1.0, (((ci / nav.W) | 0) + 0.5) * cs]);
    return op.search = { room, pts, looked: new Uint8Array(pts.length), los: new Map(), yaw: new Map(), at: new Map(), moves: 0, leftAtMove: Infinity, left: pts.length };
  }
  /** has `gd` a line from where he stands to cell `i` (asked once per cell per place he stands) */
  private lineTo(SR: RoomSearch, gd: Guard, i: number): boolean {
    const hd = DOORTOOLS.thrLean && gd.script?.lean ? gd.char.bones.head ?? null : null, p = hd ?? gd.char.pos; let L = SR.los.get(gd);   // (a man leaned round an edge looks from where his head is — on a knee, from that height)
    if (!L || flat(L.at, p) > 0.35 || (hd ? Math.abs(L.at[1] - hd[1]) > 0.2 : L.at[1] !== p[1])) { L = { at: v3.copy(p), ok: new Int8Array(SR.pts.length).fill(-1) }; SR.los.set(gd, L); }
    if (L.ok[i] < 0) L.ok[i] = this.g.col.segmentBlocked([L.at[0], hd ? L.at[1] : 1.55, L.at[2]], SR.pts[i]) ? 0 : 1;
    return L.ok[i] === 1;
  }
  /** every cell a man's muzzle is on this frame is looked at (a man who cannot see, or is not through the frame yet, looks at nothing) */
  private look(op: DoorOp, SR: RoomSearch, out: Guard[] | null = null, ok: ((gd: Guard, i: number) => boolean) | null = null) {
    const g = this.g, K = DOORTOOLS;
    for (const gd of out ?? op.men) { if ((!out && isNaN(this.inAt(op, gd))) || g.time < gd.dazzledUntil) continue; const c = gd.char, p = c.pos;   // (`out`: the men working it from outside the frame — nothing counts for them but what a muzzle with a line to it is on)
      for (let i = 0; i < SR.pts.length; i++) { if (SR.looked[i]) continue; const q = SR.pts[i], dx = q[0] - p[0], dz = q[2] - p[2], dd = dx * dx + dz * dz;
        if (dd > K.lookM * K.lookM) continue;
        if ((out !== null || dd > 1.44) && (Math.abs(wrapAngle(Math.atan2(dx, dz) - c.aimYaw)) > K.lookRad || !this.lineTo(SR, gd, i))) continue;
        if (ok && !ok(gd, i)) continue;
        SR.looked[i] = 1; SR.left--; } }
  }
  /** a man on his point: his muzzle travels to the floor nobody has looked at yet that he has a line to and that needs the least turn. False when he has
   *  none left from where he stands. */
  private scan(op: DoorOp, SR: RoomSearch, gd: Guard, A: Assignment): boolean {
    const g = this.g, K = DOORTOOLS, c = gd.char, p = c.pos, dt = clamp(g.time - (SR.at.get(gd) ?? g.time), 0, 0.05); SR.at.set(gd, g.time);
    const y0 = SR.yaw.get(gd) ?? c.aimYaw; let best = -1, bd = Infinity, by = 0;
    for (let i = 0; i < SR.pts.length; i++) { if (SR.looked[i]) continue; const q = SR.pts[i], dx = q[0] - p[0], dz = q[2] - p[2];
      if (dx * dx + dz * dz > K.lookM * K.lookM || !this.lineTo(SR, gd, i)) continue;
      const y = Math.atan2(dx, dz), turn = Math.abs(wrapAngle(y - y0)); if (turn < bd) { bd = turn; best = i; by = y; } }
    if (best < 0) { SR.yaw.delete(gd); return false; }
    if (gd.script?.over || g.time < gd.dazzledUntil) return true;   // (his muzzle is on a man he has seen — or he cannot see: the floor waits)
    const yaw = y0 + clamp(wrapAngle(by - y0), -K.scanRate * dt, K.scanRate * dt); SR.yaw.set(gd, yaw);
    A.watch = [p[0] + Math.sin(yaw) * 5, 1.1, p[2] + Math.cos(yaw) * 5]; A.face = yaw; A.there = 'clearing the room';
    return true;
  }
  /** how far it is from `a` to `b` on foot — the straight line when nothing stands in it, else the nav grid's path; Infinity past `lim` or with no way */
  private walkLen(a: Vec3, b: Vec3, lim: number): number {
    const d = flat(a, b); if (d > lim) return Infinity; if (!this.g.col.solidBlocked([a[0], 0.45, a[2]], [b[0], 0.45, b[2]])) return d;
    const path = this.g.col.nav.findPath(a, b, 3000); if (!path) return Infinity; let l = 0, q = a; for (const r of path) { l += flat(q, r); q = r; } l += flat(q, b); return l > lim ? Infinity : l;
  }
  /** walkLen for one deal's worth of questions: each pair of places measured once, to the longest reach DOORTOOLS.buddy asks about */
  private walks(): (a: Vec3, b: Vec3) => number {
    const memo = new Map<string, number>(), lim = Math.max(DOORTOOLS.buddyM, DOORTOOLS.buddyPairM, DOORTOOLS.buddyLeftM), k = (p: Vec3) => `${p[0].toFixed(2)},${p[2].toFixed(2)}`;
    return (a, b) => { const key = `${k(a)}>${k(b)}`; let l = memo.get(key); if (l === undefined) memo.set(key, l = this.walkLen(a, b, lim)); return l; };
  }
  /** DOORTOOLS.buddy — `gd` would be dealt a walk to `P`. By the way a man walks (`len`), with every teammate taken where he stands or where his order has
   *  him going (`where`) and Sam where he stands:
   *    'alone'  a friend is within `buddyM` of P: one man's walk, he has left nobody
   *    a man    past that: the partner who goes with him — his pair-mate while that man is up (and then only if he is in `pool`, the men who may be sent
   *             now: busy, in a fight or already posted, and it is 'no'); a man who has lost his partner goes with another who has lost his
   *    'no'     no partner · or nobody of the team would stay behind the two (a squad of two, the last two of a four: the room they took is theirs to hold)
   *             · or the walk takes him (them) past `buddyPairM` from everybody who is not of the pair — the squad is two pairs, not two patrols · or
   *             it would leave a man who has company now with nobody inside `buddyLeftM`
   *  `pair` (flowOn: a walk INTO floor nobody has seen): a partner is wanted even with a friend within `buddyM` — every other rule as it stands, but one:
   *  `onDoor` (the men of the entry whose gun is on another door of the room): a man whose partner holds such a door goes with another whose partner does —
   *  the two who are spare, their partners in the room behind them — where without it neither could go.
   *  A classifier only: it deals nothing, and with the switch off its answer is what the callers count (`sentAlone`). */
  /** why away() last said 'no' (the beats' and the probes') */
  private awayWhy = ''; /** …and was it for the walk's length from the men who stay (the flow's close-up answers that one) */ private awayFar = false;
  private away(gd: Guard, P: Vec3, pool: Guard[], where: (m: Guard) => Vec3, len: (a: Vec3, b: Vec3) => number, pair = false, onDoor: ((m: Guard) => boolean) | null = null): 'alone' | 'no' | Guard {
    const g = this.g, K = DOORTOOLS, S = g.orders; this.awayFar = false; this.awayWhy = '';
    const squad = S.men().filter(m => m !== gd && m.state !== 'dead'), sam: Vec3[] = g.player.down ? [] : [g.orders.samStood];
    const mateOf = (m: Guard) => { const id = S.pairOf(m); return id ? [...squad, gd].find(x => x !== m && S.pairOf(x) === id) ?? null : null; };
    const own = mateOf(gd), rest = squad.filter(m => m !== own);
    const reach = (who: Guard[], lim: number, withSam: boolean) => who.some(m => len(where(m), P) <= lim) || (withSam && sam.some(q => len(q, P) <= lim));
    // nobody who has company now is left without: the men who go are at P, everybody else where he was
    const strands = (go: Guard[]) => squad.some(c => { if (go.includes(c)) return false; const at = where(c), by = (q: Vec3) => len(q, at) <= K.buddyLeftM;
      const stay = [...squad.filter(m => m !== c && !go.includes(m)).map(where), ...sam];
      return !stay.some(by) && !by(P) && [gd, ...go].some(m => by(m === gd ? gd.char.pos : where(m))); });
    let mate: Guard | null = null;
    if (pair || !reach(squad, K.buddyM, true)) { const free = pool.filter(m => m !== gd && m.state !== 'dead');
      const lent = (m: Guard) => { const o = mateOf(m); return !!o && !free.includes(o) && !!onDoor && onDoor(o); };   // (his own partner has a door of this room to hold: he is spare)
      mate = own ? (free.includes(own) ? own : lent(gd) ? free.filter(lent).sort((a, b) => flat(a.char.pos, gd.char.pos) - flat(b.char.pos, gd.char.pos))[0] ?? null : null) : free.filter(m => !mateOf(m)).sort((a, b) => flat(a.char.pos, gd.char.pos) - flat(b.char.pos, gd.char.pos))[0] ?? null;
      if (!mate) { this.awayWhy = own ? `${gd.callsign}'s partner is busy` : 'no partner free'; return pair && reach(squad, K.buddyM, true) ? 'alone' : 'no'; } }
    const others = (mate && own && mate !== own ? squad : rest).filter(m => m !== mate);   // (with a lent man his own partner is one of the men who stay)
    if (mate && !others.length) { this.awayWhy = 'nobody would stay behind the two'; return 'no'; }   // (two men with nobody of the team staying behind them: both walking on leaves the room they took to nobody — records-pair, 48 seeds: 72 men up as it was, 60 with the pair sent on, 76 with the walk not made)
    if ((others.length || sam.length) && !reach(others, K.buddyPairM, true)) { this.awayWhy = `past ${K.buddyPairM} m from the rest`; this.awayFar = true; return 'no'; }
    if (strands(mate ? [mate] : [])) { this.awayWhy = 'it would leave a man by himself'; this.awayFar = true; return 'no'; }
    return mate ?? 'alone';
  }
  /** the partner's point beside P: free floor of the same room 1.5 to 2.5 m from it with nothing between the two men, clear of every other man's place and
   *  of the line of an opening nobody has been beyond, the least walk for him — facing the longest look he has that is well off his partner's sector, away
   *  from his partner and from the men who stay (theirs is the way the pair came) */
  private besidePod(P: Vec3, face: number, mate: Guard, taken: Vec3[], inRoom: (q: Vec3) => boolean): { pos: Vec3; face: number } | null {
    const g = this.g, K = DOORTOOLS, nav = g.col.nav, apart = Math.max(1.0, K.podApart); let best: Vec3 | null = null, bc = Infinity;
    for (const r of [1.5, 2.0, 2.5]) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, q: Vec3 = [P[0] + Math.sin(a) * r, 0, P[2] + Math.cos(a) * r];
      if (nav.isBlocked(q[0], q[2]) || !inRoom(q) || g.col.solidBlocked([P[0], 0.45, P[2]], [q[0], 0.45, q[2]]) || taken.some(t => flat(t, q) < apart) || flat(g.orders.samStood, q) < 1.0) continue;
      if (ENTRY.offOpenings && ENTRY.move && g.entry.riskAt(q)) continue;
      const c = flat(mate.char.pos, q) + (r - 1.5) * 0.5; if (c < bc) { bc = c; best = q; } }
    if (!best) return null;
    const home: Vec3 = [0, 0, 0]; for (const t of taken) { home[0] += t[0] / taken.length; home[2] += t[2] / taken.length; }
    let yaw = wrapAngle(face + Math.PI), bl = -Infinity;
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; if (Math.abs(wrapAngle(a - face)) < Math.PI / 3 || Math.abs(wrapAngle(a - yawTo(best, P))) < Math.PI / 6) continue;
      let l = 0; for (const d of [2, 4, 6, 8, 10]) { if (g.col.segmentBlocked([best[0], 1.5, best[2]], [best[0] + Math.sin(a) * d, 1.5, best[2] + Math.cos(a) * d])) break; l = d; }
      if (taken.length) l -= 3 * Math.max(0, Math.cos(wrapAngle(a - yawTo(best, home))));
      if (l > bl) { bl = l; yaw = a; } }
    return { pos: best, face: yaw };
  }
  /** an entry's man sent on to a point of the room it is still looking over */
  private sendOn(op: DoorOp, gd: Guard, pod: { pos: Vec3; face: number }, going: string) {
    this.offSwing(pod, op.door, op.side, [...op.pod].filter(([m]) => m !== gd && m.state !== 'dead').map(([, o]) => o.pos));
    op.pod.set(gd, pod); op.onPod.delete(gd);
    this.assign(op, gd, { post: pod.pos, face: pod.face, watch: null, shy: null, thru: op.door, pace: this.g.orders.knobs.entry, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: true, going, there: 'holding the room' });
  }
  /** is this room's floor one the whole-room rule works (`flowOn`, and not past `flowMax`)? A room past the size is searched as before the rule — said once an order */
  private bigSaid = new SideSet<DoorOp>();
  private flows(op: DoorOp, SR: RoomSearch): boolean {
    const K = DOORTOOLS; if (!K.flowOn) return false; if (!(K.flowMax > 0) || SR.pts.length <= K.flowMax) return true;
    if (!this.bigSaid.has(op)) { this.bigSaid.add(op); this.beat(op, `flow: no · a room of ${SR.pts.length} cells is looked over, not gone through (flowMax ${K.flowMax})`); }
    return false;
  }
  /** DOORTOOLS.flowOn — the biggest piece of the floor nobody has looked at, when it is `flowCells` or more, is gone INTO: see the knob. True when men were
   *  sent (into it; toward it, a bound; or up behind the men at the front); false when there is no such piece, no way to it, no point worth standing on,
   *  or `buddy` refuses every man the walk and nobody is left to close up (the search then goes on as it did: the floor is looked at from where it can be
   *  seen, or left to the next order — the beat says which rule said no). */
  private flowIn(op: DoorOp, SR: RoomSearch, men: Guard[]): boolean {   // (`men`: the entry's men who may be sent)
    const g = this.g, K = DOORTOOLS, nav = g.col.nav, cs = nav.cell, S = g.orders; if ((SR.flows ?? 0) >= K.flowMoves) return false;
    let at = SR.cellAt; if (!at) { at = SR.cellAt = new Map(); for (let i = 0; i < SR.pts.length; i++) at.set(nav.idx(Math.floor(SR.pts[i][0] / cs), Math.floor(SR.pts[i][2] / cs)), i); }
    const cellOf = (x: number, z: number) => { const ix = Math.floor(x / cs), iz = Math.floor(z / cs); return ix < 0 || iz < 0 || ix >= nav.W ? undefined : at!.get(nav.idx(ix, iz)); };
    // the unseen floor in pieces (cells that touch by a side): the biggest
    const mark = new Uint8Array(SR.pts.length); let part: number[] = [];
    for (let i = 0; i < SR.pts.length; i++) { if (SR.looked[i] || mark[i]) continue; const c = [i]; mark[i] = 1;
      for (let h = 0; h < c.length; h++) { const p = SR.pts[c[h]];
        for (const [dx, dz] of N4) { const j = cellOf(p[0] + dx * cs, p[2] + dz * cs); if (j !== undefined && !SR.looked[j] && !mark[j]) { mark[j] = 1; c.push(j); } } }
      if (c.length > part.length) part = c; }
    if (part.length < K.flowCells) return false;
    const no = (why: string) => { this.beat(op, `flow: no · ${part.length} cells · ${why}`); return false; };
    const inPart = new Uint8Array(SR.pts.length); const mid: Vec3 = [0, 0, 0]; for (const i of part) { inPart[i] = 1; mid[0] += SR.pts[i][0] / part.length; mid[2] += SR.pts[i][2] / part.length; }
    let goal = SR.pts[part[0]], gb = Infinity; for (const i of part) { const d = flat(SR.pts[i], mid); if (d < gb) { gb = d; goal = SR.pts[i]; } }
    // its MOUTH: where the way there of the man nearest it first crosses onto floor of the piece. Within a bound of him (`flowBound`, less a step in) the
    // men go THROUGH it; further — the far end of a long room, in plain view but past where a muzzle counts as having looked — they go a bound TOWARD it
    const near = new Map<Guard, number>(), ps = Math.max(1, Math.floor(part.length / 24)); for (const m of men) { let b = Infinity; for (let k = 0; k < part.length; k += ps) b = Math.min(b, flat(m.char.pos, SR.pts[part[k]])); near.set(m, b); }
    men = [...men].sort((a, b) => near.get(a)! - near.get(b)!);   // (the man nearest THIS piece leads, not the one nearest the middle of all that is unseen)
    const lead = men[0], way = nav.findPath(lead.char.pos, goal, 4000); if (!way) return no('no way to it');
    const line: Vec3[] = [lead.char.pos, ...way, goal], walk: Vec3[] = [], cum: number[] = []; let run = 0;
    for (let k = 1; k < line.length; k++) { const a = line[k - 1], b = line[k], l = flat(a, b), n = Math.max(1, Math.ceil(l / 0.25)); for (let j = 1; j <= n; j++) { walk.push([a[0] + (b[0] - a[0]) * j / n, 0, a[2] + (b[2] - a[2]) * j / n]); cum.push(run + l * j / n); } run += l; }
    const mi = walk.findIndex(q => { const j = cellOf(q[0], q[2]); return j !== undefined && inPart[j] === 1; }); if (mi < 0) return no('no way to it');
    const into = cum[mi] <= K.flowBound - 1.5; let ai = mi;
    if (!into) { ai = 0; while (ai < mi - 4 && cum[ai] < K.flowBound - 1.5) ai++; }   // (a bound: short of the mouth)
    const M = walk[ai]; let ux = mid[0] - M[0], uz = mid[2] - M[2];
    if (!into || Math.hypot(ux, uz) < 0.75 || g.col.segmentBlocked([M[0], 1.5, M[2]], [mid[0], 1.5, mid[2]])) { const q = walk[Math.min(walk.length - 1, ai + 6)]; ux = q[0] - M[0]; uz = q[2] - M[2]; }
    const ul = Math.hypot(ux, uz); if (ul < 1e-3) return no('no way to it'); ux /= ul; uz /= ul;
    // the points: free floor of the room in plain view of the mouth, by a wall where there is one, out of the line of an opening nobody has been beyond.
    // Through the mouth: past it, about `flowDeep` in, showing a quarter or more of the piece — the more the better. A bound: within a few steps of where
    // the walk has got to, to either side of it.
    const sd = Math.max(1, Math.floor(part.length / 40)), sam = g.orders.samStood, apart = Math.max(1.0, K.podApart);
    const stay: Vec3[] = [], here: Vec3[] = []; for (const m of S.men()) if (m.state !== 'dead') { here.push(m.char.pos); if (!men.includes(m)) for (const o of this.ops) { const q = o.pod.get(m); if (q) stay.push(q.pos); } }   // (every teammate where he stands — a real move for whoever walks, and nobody stood on; the men this deal cannot move where they are going too)
    const cands: { P: Vec3; sc: number; d: number }[] = []; let n0 = 0;
    for (let i = 0; i < SR.pts.length; i++) { const P = SR.pts[i], rx = P[0] - M[0], rz = P[2] - M[2], d = Math.hypot(rx, rz), fwd = rx * ux + rz * uz;
      if (into ? d > K.flowReach || d < 1.2 || fwd < 0.5 || cum[ai] + d > K.flowBound + 1.5 : d > 2.75 || fwd < -1.0) continue;
      if (nav.isBlocked(P[0], P[2]) || flat(sam, P) < 1.0 || here.some(q => flat(q, P) < 1.5) || stay.some(q => flat(q, P) < apart) || g.col.segmentBlocked([M[0], 1.5, M[2]], [P[0], 1.5, P[2]])) continue;
      let seen = 0, of = 0; for (let k = 0; k < part.length; k += sd) { const q = SR.pts[part[k]]; of++; if (flat(P, q) <= K.lookM && !g.col.segmentBlocked([P[0], 1.55, P[2]], q)) seen++; }
      if (into && seen * 4 < of) continue; n0++;
      let w = 0; for (const [dx, dz] of N4) if (nav.isBlocked(P[0] + dx * 0.75, P[2] + dz * 0.75)) w++;
      const risk = ENTRY.offOpenings && ENTRY.move && !!g.entry.riskAt(P);
      cands.push({ P, d, sc: (into ? 10 : 4) * seen / of + (w >= 1 ? 2 : 0) + (w >= 2 ? 1 : 0) - (into ? Math.abs(d - K.flowDeep) : d * 0.5) - (risk ? 4 : 0) }); }
    if (!cands.length) return no(into ? 'no point past its mouth' : 'no point on the way to it');
    cands.sort((a, b) => b.sc - a.sc); cands.length = Math.min(cands.length, 24);
    // the pair of them: apart, to either hand of the way in, each in the other's view
    let two: [Vec3, Vec3] | null = null, tb = -Infinity;
    for (let a = 0; a < cands.length; a++) for (let b = a + 1; b < cands.length; b++) { const A = cands[a], B = cands[b], l = flat(A.P, B.P); if (l < Math.max(2.0, apart)) continue;
      const cos = ((A.P[0] - M[0]) * (B.P[0] - M[0]) + (A.P[2] - M[2]) * (B.P[2] - M[2])) / Math.max(1e-3, A.d * B.d); if (into && cos > 0.8) continue;   // (one behind the other from the mouth: the rear man's gun is on his mate's back)
      const sc = A.sc + B.sc + Math.min(l, 4) - (into ? cos : 0); if (sc <= tb || g.col.segmentBlocked([A.P[0], 1.5, A.P[2]], [B.P[0], 1.5, B.P[2]])) continue;
      tb = sc; two = [A.P, B.P]; }
    const where = (m: Guard): Vec3 => S.of(m)?.post ?? m.char.pos, len = this.walks();
    // (each man's sector: the middle of the floor of the piece that is nearer his point than his mate's)
    const faceOf = (P: Vec3, Q: Vec3 | null) => { let x = 0, z = 0, n = 0; for (const i of part) { const q = SR.pts[i]; if (Q && flat(q, Q) < flat(q, P)) continue; x += q[0]; z += q[2]; n++; } return n ? yawTo(P, [x / n, 0, z / n]) : yawTo(P, mid); };
    const onDoor = (m: Guard) => m.state !== 'dead' && op.men.includes(m) && !m.script?.over && this.onOther(op, m);
    const whys: string[] = []; let far = false;
    for (const gd of K.buddy ? men : men.slice(0, 1)) {
      const P1 = two ? two[0] : cands[0].P;
      let mate: Guard | null = null;
      if (K.buddy) { const h = this.away(gd, P1, men, where, len, true, onDoor), why = this.awayWhy, was = this.awayFar;
        if (h !== 'alone' && h !== 'no') mate = h; else if (this.away(gd, P1, men, where, len) !== 'alone') { for (const w of [why, this.awayWhy]) if (w && !whys.includes(w)) whys.push(w); far ||= was || this.awayFar; continue; } }   // (no partner to be had: one man's walk only where a friend is near — as the search ever sent him)
      let pods: [Guard, { pos: Vec3; face: number }][];
      if (mate) { let A: Vec3, B: Vec3;
        if (two) [A, B] = two; else { const q = this.besidePod(P1, yawTo(P1, mid), mate, [...stay, ...here.filter(q => q !== gd.char.pos && q !== mate!.char.pos)], (p: Vec3) => cellOf(p[0], p[2]) !== undefined); if (!q) { if (!whys.includes('no floor beside the point')) whys.push('no floor beside the point'); continue; } A = P1; B = q.pos; }
        if (flat(gd.char.pos, A) + flat(mate.char.pos, B) > flat(gd.char.pos, B) + flat(mate.char.pos, A)) [A, B] = [B, A];   // (the walks that do not cross)
        pods = [[gd, { pos: [A[0], 0, A[2]], face: faceOf(A, B) }], [mate, { pos: [B[0], 0, B[2]], face: faceOf(B, A) }]]; }
      else pods = [[gd, { pos: [P1[0], 0, P1[2]], face: faceOf(P1, null) }]];
      SR.flows = (SR.flows ?? 0) + 1; SR.leftAtMove = into ? SR.left : Infinity;   // (a bound is not judged by what it showed: the floor it is for is still ahead)
      for (const [m, pod] of pods) { g.entry.dealt(pod, null); SR.yaw.delete(m); this.sendOn(op, m, pod, 'clearing the room'); }
      this.stats.sentOn++; this.stats.flowed++; if (mate) this.stats.sentPair++;
      if (!SR.flowSaid) { SR.flowSaid = true; g.say(gd, 'pushing through.'); }
      this.beat(op, `${into ? 'flow' : 'bound'}:${gd.callsign}${mate ? ` with ${mate.callsign}` : ''} · ${part.length} cells · ${n0} points`);
      return true; }
    // refused for the walk it would be from the men who stay: THEY CLOSE UP on the man at the front, and the walk is asked again from there — the squad goes
    // through a long room in bounds, the rear behind the front, not strung along it (a man with his gun on a far door of the room comes too: the door is
    // dealt again from where the squad then stands)
    if (far && (SR.closes ?? 0) < K.flowMoves) { const own = S.pairOf(lead), taken = S.men().filter(m => m.state !== 'dead').map(where), inRoom = (p: Vec3) => cellOf(p[0], p[2]) !== undefined; let n = 0; const who: string[] = [];
      for (const m of op.men) { if (m === lead || m.state === 'dead' || isNaN(this.inAt(op, m)) || g.time < m.dazzledUntil || m.script?.over || (own && S.pairOf(m) === own && len(where(m), lead.char.pos) <= K.buddyM) || len(where(m), lead.char.pos) <= 3.5) continue;
        const pod = this.besidePod(lead.char.pos, lead.char.aimYaw, m, taken, inRoom); if (!pod) continue;
        if (op.other) for (const [o, R] of [...op.other]) if (R.gd === m) op.other.delete(o);   // (his gun was on another door of the room: given up — otherDoors deals it again from where the squad then stands)
        taken.push(pod.pos); g.entry.dealt(pod, null); SR.yaw.delete(m); this.sendOn(op, m, pod, 'closing up'); who.push(m.callsign); n++; }
      if (n) { SR.closes = (SR.closes ?? 0) + 1; SR.leftAtMove = Infinity; this.stats.closedUp += n; this.beat(op, `close up:${who.join(', ')} · on ${lead.callsign}`); return true; } }
    return no(`stay together: ${whys.join(', ') || 'nobody free'}`);
  }
  /** floor left that no man can see from where he stands: the man nearest it goes on to the point of the room it is best seen from. True when one was sent.
   *  DOORTOOLS.buddy: a point away from everybody is the pair's or nobody's (away()); a man refused every point worth his walk hands it to the next nearest. */
  private moveOn(op: DoorOp, SR: RoomSearch): boolean {
    const g = this.g, K = DOORTOOLS, nav = g.col.nav, flowing = this.flows(op, SR); if (SR.left < K.deadCells || (!flowing && SR.moves >= K.searchMoves)) return false;
    if (SR.left > SR.leftAtMove - 3) return false;   // (the last man sent on saw next to nothing new: what is left is not to be seen from this room's floor)
    const dead: Vec3[] = []; for (let i = 0; i < SR.pts.length; i++) if (!SR.looked[i]) dead.push(SR.pts[i]);
    const mid: Vec3 = [0, 0, 0]; for (const q of dead) { mid[0] += q[0] / dead.length; mid[2] += q[2] / dead.length; }
    const men = op.men.filter(m => !isNaN(this.inAt(op, m)) && g.time >= m.dazzledUntil && !m.script?.over && !this.onOther(op, m)); if (!men.length) return false;
    men.sort((a, b) => flat(a.char.pos, mid) - flat(b.char.pos, mid));
    if (flowing) { if (this.flowIn(op, SR, men)) return true; if (SR.moves >= K.searchMoves) return false; }   // (a part of the room nobody has been in is gone into; what is left is looked at from where it can be seen, as ever)
    const sd = Math.max(1, Math.floor(dead.length / 40)), sp = Math.max(1, Math.floor(SR.pts.length / 80)), S = g.orders;
    const cells = (SR.room as { cells?: Set<number> }).cells, inRoom = (q: Vec3) => !cells || cells.has(nav.idx(Math.floor(q[0] / nav.cell), Math.floor(q[2] / nav.cell)));
    const where = (m: Guard): Vec3 => S.of(m)?.post ?? m.char.pos, len = this.walks(); let refused = false;
    const seenAt = new Map<number, number>();   // (what a point shows of the unseen floor is the same whoever walks to it: counted once, however many men are asked)
    for (const gd of K.buddy ? men : men.slice(0, 1)) { const from = gd.char.pos;
      const others: Vec3[] = []; for (const m of g.orders.men()) if (m !== gd) { others.push(m.char.pos); for (const o of this.ops) { const q = o.pod.get(m); if (q) others.push(q.pos); } }   // (every teammate, whoever's order he is on: where he stands and where he is going)
      // every point that shows him enough of the unseen floor, the best first (seen, less the walk) — as ever a point must score over nothing to be worth it
      const cands: { P: Vec3; sc: number }[] = [];
      for (let i = 0; i < SR.pts.length; i += sp) { const P = SR.pts[i]; if (nav.isBlocked(P[0], P[2]) || flat(from, P) < 1.5 || others.some(q => flat(q, P) < Math.max(1.0, K.podApart))) continue;   // (a real move: a point inside his on-the-mark tolerance shows him nothing new)
        let seen = seenAt.get(i); if (seen === undefined) { seen = 0; for (let k = 0; k < dead.length; k += sd) { const q = dead[k]; if (flat(P, q) <= K.lookM * 0.8 && !g.col.segmentBlocked([P[0], 1.55, P[2]], q)) seen++; } seenAt.set(i, seen); }
        const sc = seen * sd - 0.8 * flat(from, P); if (seen * sd < K.deadCells / 2 || sc <= 0) continue;
        cands.push({ P, sc }); }
      cands.sort((a, b) => b.sc - a.sc);
      // (`clear`: the best of them that is not in the line of an opening nobody has been beyond — entrypoints.ts)
      const mates = new Map<Vec3, { gd: Guard; pod: { pos: Vec3; face: number } } | null | false>(); let no = false;
      const ok = (P: Vec3): boolean => { if (!K.buddy) return true; if (mates.has(P)) return mates.get(P) !== false;
        const h = this.away(gd, P, men, where, len), pod = h === 'alone' || h === 'no' ? null : this.besidePod(P, yawTo(P, mid), h, S.men().filter(m => m !== gd && m !== h).map(where), inRoom);
        if (h === 'no' || (h !== 'alone' && !pod)) { no = refused = true; mates.set(P, false); return false; }
        mates.set(P, h === 'alone' ? null : { gd: h, pod: pod! }); return true; };
      const top = cands.find(c => ok(c.P)); if (!top) { if (no) continue; break; }   // (nothing worth his walk at all: as ever, the search is over — only a man REFUSED his walk hands it to the next)
      const cl = ENTRY.offOpenings && ENTRY.move ? cands.find(c => !g.entry.riskAt(c.P) && ok(c.P)) : undefined;
      const swap = !!cl && cl !== top && cl.sc >= 0.6 * top.sc, best = swap ? cl!.P : top.P;   // (only for a point that shows him most of what the best one would: the search has few moves)
      const pod = { pos: [best[0], 0, best[2]] as Vec3, face: yawTo(best, mid) }; if (swap) g.entry.swapped(pod); g.entry.dealt(pod, null);
      SR.yaw.delete(gd); SR.moves++; SR.leftAtMove = SR.left; this.sendOn(op, gd, pod, 'clearing the room'); this.stats.sentOn++;
      const M = mates.get(best) || null;
      if (M) { this.stats.sentPair++; g.entry.dealt(M.pod, null); SR.yaw.delete(M.gd); this.sendOn(op, M.gd, M.pod, 'clearing the room'); this.beat(op, `on:${gd.callsign} with ${M.gd.callsign}`); }
      else { if (!K.buddy && this.away(gd, best, men, where, len) !== 'alone') this.stats.sentAlone++; this.beat(op, `on:${gd.callsign}`); }   // (off: only counted — a man sent away from everybody by himself)
      return true; }
    if (refused) this.stats.notSent++;
    return false;
  }

  /** the points of domination for a door taken from `side`: the level's clear plan when it was authored from that face, else the first free floor inside
   *  and to either hand of the doorway — each with the facing held there. `n` > 2 (the four-man squad): the first two as ever — the DEEP points, the first
   *  two men's — then one more to either hand just inside the entry wall, clear of the opening, for the third and fourth (as many as there is floor for) */
  pods(d: Door, side: 1 | -1, n = 2): { pos: Vec3; face: number }[] {
    // (entrypoints.ts: a point within 3 m and in the line of an opening nobody of the squad has been beyond is moved off it where the room has the floor)
    const W = d.def.width, out = this.g.entry.clearOf(d, this.podsAsWere(d, side, n), p => [alongOf(d, p) - W / 2, -offOf(d, p, side)]);
    for (const P of out) this.offSwing(P, d, side, out.filter(o => o !== P).map(o => o.pos));
    return out;
  }
  /** doorway.ts MARKS (DOORMANNERS.podClear): a point a man is left standing on after an entry is in no frame's strip and nowhere a leaf swings — the door
   *  they came by, or any other door of the room. Moved IN PLACE (whoever holds the point holds the new one) to the nearest floor clear of both: in the
   *  room it was in, inside the entry door's line if it was, by no opening nobody has been beyond unless it was by one, with a line to `see` if it had
   *  one, off Sam and `taken`. A point with no such floor by it stays where it is. */
  private offSwing(P: { pos: Vec3; watch?: Vec3 }, d: Door | null, side: 1 | -1, taken: Vec3[], see: Vec3 | null = null) {
    const g = this.g; if (!DOORMANNERS.on || !DOORMANNERS.podClear || !doorwayInWay(g, P.pos)) return;
    const W = P.watch && !g.col.segmentBlocked([P.pos[0], 1.5, P.pos[2]], [P.watch[0], 1.5, P.watch[2]]) ? P.watch : null;   // (the opening he was put there to watch: still in his sight from where he is moved to)
    const room = g.fight?.roomAt(P.pos) ?? null, inside = !!d && -offOf(d, P.pos, side) >= 0.3, risky = !!g.entry.riskAt(P.pos, d);
    const q = doorwayClearNear(g, P.pos, q => doorwayInWay(g, q) || (inside && -offOf(d!, q, side) < 0.3) || (!!room && g.fight.roomAt(q) !== room)
      || (!risky && ENTRY.offOpenings && !!g.entry.riskAt(q, d)) || flat(g.orders.samStood, q) < 0.7 || (!!see && g.col.segmentBlocked([q[0], 1.5, q[2]], see)) || (!!W && g.col.segmentBlocked([q[0], 1.5, q[2]], [W[0], 1.5, W[2]])), taken, 0.9);
    if (q) { P.pos[0] = q[0]; P.pos[2] = q[2]; DOORMANNERS_STATS.marks++; }
  }
  /** the points before entrypoints.ts looks at them (ENTRY.offOpenings off: what pods() answers) */
  podsAsWere(d: Door, side: 1 | -1, n = 2): { pos: Vec3; face: number }[] {
    const two = this.pods2(d, side); if (n <= 2 || !two.length) return two;
    const g = this.g, nav = g.col.nav, W = d.def.width, into = -side as 1 | -1, mid = doorPt(d, W / 2, 0.9, into, 0.45), out = [...two];
    const fits = (p: Vec3) => !nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked(mid, [p[0], 0.45, p[2]]) && !out.some(o => flat(o.pos, p) < 0.9) && !this.inFrame(d, mid, p);
    for (const s of [1, -1]) { if (out.length >= n) break;
      find: for (const D of [1.0, 1.4, 0.8, 1.9]) for (const L of [W / 2 + 0.9, W / 2 + 1.4, W / 2 + 0.55, W / 2 + 2.0]) {   // (L past the jamb: never in the opening itself)
        const p = doorPt(d, W / 2 + s * L, D, into); if (!fits(p)) continue;
        out.push({ pos: p, face: yawTo(p, doorPt(d, W / 2 - s * 0.6, 4.5, into)) }); break find; } }
    for (const b of [3.0, 2.2, 3.8]) { if (out.length >= n) break; const p = doorPt(d, W / 2, b, into); if (fits(p)) out.push({ pos: p, face: yawTo(doorPt(d, W / 2, 0, into), doorPt(d, W / 2, 1, into)) }); }   // (a room with no floor to a hand of its door: on down the middle, past the others)
    return out;
  }
  /** DOORTOOLS.podFrames: `p` stands in the opening of a door other than `d`, or the line to it from `mid` (this door's mouth) passes through one */
  private inFrame(d: Door, mid: Vec3, p: Vec3): boolean {
    const K = DOORTOOLS; if (!K.podFrames) return false;
    for (const o of this.g.doors.list) { if (o === d) continue;
      const [hx, hz] = o.def.hinge, W = o.def.width, ux = Math.cos(o.def.closedDir), uz = Math.sin(o.def.closedDir);
      const a = (p[0] - hx) * ux + (p[2] - hz) * uz, b = -(p[0] - hx) * uz + (p[2] - hz) * ux;
      if (a > -0.1 && a < W + 0.1 && Math.abs(b) < K.podFrameM) return true;
      const m = -(mid[0] - hx) * uz + (mid[2] - hz) * ux; if (m * b >= 0) continue;                 // (both on one side of its wall: no line through it)
      const t = m / (m - b), x = (mid[0] + (p[0] - mid[0]) * t - hx) * ux + (mid[2] + (p[2] - mid[2]) * t - hz) * uz;
      if (x > 0 && x < W) return true;
    }
    return false;
  }
  private pods2(d: Door, side: 1 | -1): { pos: Vec3; face: number }[] {
    const g = this.g, nav = g.col.nav, W = d.def.width, into = -side as 1 | -1;
    const plan = doorPlan(g, d.def.name);
    if (plan && sideOf(d, plan.stack[0]) === side) {
      const out = [0, 1].map(k => ({ pos: v3.copy(plan.entry[k][plan.entry[k].length - 1]), face: plan.podFace[k] })).filter(p => !nav.isBlocked(p.pos[0], p.pos[2]) && offOf(d, p.pos, side) < -0.3);
      if (out.length === 2) return out;
    }
    const mid = doorPt(d, W / 2, 0.9, into, 0.45), out: { pos: Vec3; face: number }[] = [];
    for (const s of [1, -1]) {
      find: for (const D of [1.7, 2.2, 1.2]) for (const L of [1.7, 1.3, 0.9]) {
        const p = doorPt(d, W / 2 + s * L, D, into);
        if (nav.isBlocked(p[0], p[2]) || g.col.solidBlocked(mid, [p[0], 0.45, p[2]]) || this.inFrame(d, mid, p)) continue;
        out.push({ pos: p, face: yawTo(p, doorPt(d, W / 2 - s * 1.2, 4, into)) }); break find;
      }
    }
    const inward = yawTo(doorPt(d, W / 2, 0, into), doorPt(d, W / 2, 1, into));
    for (const b of [1.5, 2.4]) { if (out.length >= 2) break; const q = doorPt(d, W / 2, b, into), f = nav.isBlocked(q[0], q[2]) ? nav.nearestFreePoint(q[0], q[2]) : q; if (f && !out.some(o => flat(o.pos, f) < 0.6)) out.push({ pos: [f[0], 0, f[2]], face: inward }); }
    return out;
  }
  /** the men go in: the lead first, the next `second` later, each to his point of domination */
  private enter(op: DoorOp) {
    if (op.thr) { this.stepIn(op); return; }   // (worked from the threshold: the shallow step, not the points of domination)
    const g = this.g, S = g.orders, t = g.time; const pods = this.pods(op.door, op.side, op.men.length > 2 || S.big ? 4 : op.men.length);   // (three men are offered both near points: the third takes the one on his own side; a pair of the four is offered them too — podsApart)
    if (!pods.length) { g.say(op.lead, 'no way in.'); this.end(op, 'no floor inside'); return; }
    const first = this.firstIn(op, pods[0].pos); this.led.entries++;
    if (first !== op.lead && gunBefore(first, op.lead) && this.firstIn(op, pods[0].pos, false) !== first) this.beat(op, `first:${first.callsign} · his gun is the room's`);   // (gunroles.ts: false with its switch off)
    else if (first !== op.lead) { this.led.bySeen++; this.beat(op, `first:${first.callsign} · has seen most of the room`); }
    let men = [first, ...op.men.filter(m => m !== first)];
    if (men.length > 2) {
      // THREE OR MORE: in turn off alternate jambs while both files have men — the lead, the front man of the other file, then the men behind them — the first
      // two to the deep points, the next two to the near ones, each couple dealt the way that walks least (a lone third: the nearer). A man with no point
      // (no floor for a third / fourth inside) keeps his place on the stack, outside, and is not this order's any more.
      const d = op.door, W = d.def.width, hi = (gd: Guard) => alongOf(d, (op.post.get(gd)?.pos ?? gd.char.pos)) > W / 2, near = (gd: Guard) => flat(op.post.get(gd)?.pos ?? gd.char.pos, d.frameCentre);
      const mine = men.filter(m => hi(m) === hi(first)).sort((a, b) => (a === first ? -1 : b === first ? 1 : near(a) - near(b))), theirs = men.filter(m => hi(m) !== hi(first)).sort((a, b) => near(a) - near(b));
      let turn: Guard[] = []; for (let k = 0; k < men.length; k++) { if (mine[k]) turn.push(mine[k]); if (theirs[k]) turn.push(theirs[k]); }
      turn = gunTurn(turn, first);   // (gunroles.ts: the long guns follow last — the turn as it was where the guns do not differ)
      turn = rearLast(g, op, turn, first);   // (rearwatch.ts: the man on the open way at the stack's back goes in last)
      const inMen = turn.slice(0, pods.length), stay = turn.slice(pods.length);
      const deal = new Map<Guard, { pos: Vec3; face: number }>();
      for (const k of [0, 2]) { const m = inMen.slice(k, k + 2), sp = pods.slice(k, k + 2); if (m.length) for (const [gd, pos] of S.pair(m, sp.map(x => x.pos))) deal.set(gd, sp.find(x => x.pos === pos)!); }
      if (stay.length) { op.men = op.men.filter(m => !stay.includes(m)); this.beat(op, `outside · ${stay.map(m => m.callsign).join(', ')}`); }
      op.queue = inMen.map((gd, i) => ({ gd, at: t + i * DOORTOOLS.second, pod: deal.get(gd) ?? pods[0] }));
      for (const q of op.queue) g.entry.dealt(q.pod, op.door);
      op.phase = 'enter'; op.t0 = t; this.beat(op, 'go');
      g.say(op.lead, 'going in.'); return;
    }
    const own = S.big ? this.podsApart(op, pods, men.length) : pods;
    const pairs = S.pair(men, own.slice(0, men.length).map(p => p.pos));
    op.queue = men.map((gd, i) => ({ gd, at: t + i * DOORTOOLS.second, pod: own.find(p => p.pos === pairs.find(x => x[0] === gd)![1]) ?? own[0] }));
    for (const q of op.queue) g.entry.dealt(q.pod, op.door);
    op.phase = 'enter'; op.t0 = t; this.beat(op, 'go');
    g.say(op.lead, 'going in.');
  }

  /** THE SQUAD OF FOUR, a pair going in: its points of domination kept `podApart` clear of the points another order's men are on their way to or standing on in
   *  there (the other pair, through the room's other door on the same word) and of any teammate already posted inside — the deep points first, then the near
   *  ones; with too few left clear it takes what there is */
  private podsApart(op: DoorOp, pods: { pos: Vec3; face: number }[], n: number): { pos: Vec3; face: number }[] {
    const S = this.g.orders, K = DOORTOOLS, taken: Vec3[] = [];
    for (const o of this.ops) { if (o === op) continue; for (const p of o.pod.values()) taken.push(p.pos); for (const q of o.queue) taken.push(q.pod.pos); }
    for (const gd of S.men()) { if (op.men.includes(gd)) continue; const A = S.of(gd); if (A?.post && A.arrived && offOf(op.door, A.post, op.side) < 0) taken.push(A.post); }
    const clear = pods.filter(p => !taken.some(q => flat(q, p.pos) < K.podApart)); if (clear.length < pods.slice(0, n).length || clear.slice(0, n).some((p, i) => p !== pods[i])) this.stats.podsMoved++;
    return clear.length >= n ? clear : [...clear, ...pods.filter(p => !clear.includes(p))];
  }

  // ------------------------------------------------------------ the charge
  /** Sam's trigger: the set charge nearest him (or the one given) goes. Returns what it did, null with none set. */
  blow(c: SetCharge | null = this.nearest()): { knocked: number; stunned: number; backblast: number } | null {
    if (!c) return null;
    const g = this.g, K = DOORTOOLS, d = c.door, side = c.side, W = d.def.width, into = -side as 1 | -1;
    const at = this.set.indexOf(c); if (at < 0) return null; this.set.splice(at, 1);
    holdFireOrder(g, 'charge', { blown: true });   // (holdfire.ts: a charge starts the fight when it GOES, not when it is set)
    const out = doorPt(d, W / 2, 0.5, side, 1.1), inn = doorPt(d, W / 2, 0.45, into, 1.1);
    // the leaf: off its hinges and into the room, a loose slab (doorblast.ts tearOff — the crack of it is the same 'kick' the floor hears) — or, with that
    // switched off, as it was: the keep torn out, the leaf flung in on its hinge
    if (tearOff(g, d, out, PLAYER_ID, DOORBLAST.chargeK)) { /* gone */ }
    else if (!d.def.steel) { g.doors.kickIn(d, out, PLAYER_ID, true); if (Math.abs(d.angle) < 1.4) d.vel = -g.doors.side(d, doorPt(d, W / 2, 0.6, side)) * K.blowVel; d.quietT = -K.holdOpen; }
    // …and it is a CALLER of the destruction goal's blast entry point where the build carries one (walls, cover and whoever listens to a blast hear of it from
    // there; this leaf is already off, so the doors' part of that call finds nothing left to take): at the charge's own small radius, and with that lane's chaos
    // left out — the stun charge below runs its bang
    if (DOORBLAST.on && DOORBLAST.chargeR > 0) (g.destr as unknown as { blast?: (at: Vec3, o: { radius: number; who: number; chaos: boolean }) => unknown }).blast?.(doorPt(d, W / 2, 0.15, side, 1.1), { radius: DOORBLAST.chargeR, who: PLAYER_ID, chaos: false });
    // the blast itself — flash, report, scorch, what it knocks about — is the stun charge's (combat.ts), at the foot of the leaf, with nobody on its list: who it
    // hurts is decided below, by which side of the door he is on
    const it = g.items.spawn('flash', doorPt(d, W * 0.7, 0.2, into, 0.5), [0, 0, 0], { fuse: 99, who: PLAYER_ID }); it.fired = true;
    const all = g.guards, last = g.messages[g.messages.length - 1]; g.guards = []; try { detonateStun(g, it, true); } finally { g.guards = all; }
    const m = g.messages[g.messages.length - 1]; if (m && m !== last && /flashbang/.test(m.text)) g.messages.pop();   // ('flashbang went off': this was not one)
    const ii = g.items.items.indexOf(it); if (ii >= 0) g.items.items.splice(ii, 1);   // (nor is there a spent can to leave on the floor)
    let knocked = 0, stunned = 0, backblast = 0, samToo = false;
    const leaves = g.col.dynamicBoxes; g.col.dynamicBoxes = leaves.filter(b => b !== d.box);   // (walls and every OTHER shut door stop it; this leaf is what is coming apart)
    try {
      for (const gd of [...g.guards]) {
        if (gd.state === 'dead') continue;
        const p = gd.char.pos, far = offOf(d, p, side) < 0, dist = flat(p, d.frameCentre), chest: Vec3 = [p[0], 1.1, p[2]];
        if (dist > K.stunM || g.col.solidBlocked(far ? inn : out, chest)) continue;
        if (!far) { if (dist < K.backblastM) { this.dazzle(gd, K.backblastSecs, inn); if (gd.team === 'operative') backblast++; else stunned++; } continue; }   // too near the charge on its own side
        if (gd.team === 'operative' && g.orders.big) { this.dazzle(gd, K.backblastSecs, inn); backblast++; continue; }   // (one of ours on the far side — the other pair, inside: the order is refused while he is there (behind()); gone in since, he is dazzled, not felled)
        if (dist < K.knockM) { const dir = v3.normalize([p[0] - d.frameCentre[0], 0.15, p[2] - d.frameCentre[2]]); killGuard(g, gd, dir, false, 'struck', 'player', `${gd.callsign ?? 'a man'} down — behind the door when it went`); knocked++; }
        else { this.dazzle(gd, lerp(K.stunSecs[0], K.stunSecs[1], clamp(dist / K.stunM, 0, 1)), inn); gd.staggerUntil = Math.max(gd.staggerUntil, g.time + K.staggerSecs); gd.weapon.burst = null; stunned++; }
      }
      // …and Sam, as one of ours (samstun.ts): too near on the charge's own side, or beyond the door when it goes — dazzled as a teammate there is, never felled
      if (SAMSTUN.on && !g.player.down && !g.puppet && !g.touring) { const p = g.player.char.pos, far = offOf(d, p, side) < 0, dist = flat(p, d.frameCentre);
        if (dist < (far ? K.stunM : K.backblastM) && !g.col.solidBlocked(far ? inn : out, [p[0], 1.1, p[2]])) { dazzlePlayer(g, K.backblastSecs, inn); samToo = true; } }
    } finally { g.col.dynamicBoxes = leaves; }
    moraleBlast(g, inn, PLAYER_ID);   // (morale.ts: the men behind the door it did not put down are shaken by it — a return on its first line with the switch off)
    this.stats.blown++; this.stats.knocked += knocked; this.stats.stunned += stunned; this.stats.backblast += backblast;
    g.msg(`charge blown — ${doorWords(d)}${knocked ? ` · ${knocked} down` : ''}${stunned ? ` · ${stunned} stunned` : ''}${backblast ? ` · ${backblast} of yours too close` : ''}${samToo ? ' · you were too close' : ''}`);
    this.note(`blow ${d.def.name}: knocked ${knocked} stunned ${stunned} backblast ${backblast}`);
    for (const op of this.ops) if (op.kind === 'charge' && op.door === d && (op.phase === 'standoff' || op.phase === 'armed')) {   // the squad that set it goes in behind it
      op.openT = g.time; op.bangT = g.time; op.bangAt = inn; op.phase = 'wait'; op.t0 = g.time; this.beat(op, `blow · ${knocked} down ${stunned} stunned`);
    }
    return { knocked, stunned, backblast };
  }
  /** flash-blind (combat.ts detonateStun's own rule for a man with the charge in his open view) */
  private dazzle(gd: Guard, secs: number, at: Vec3) {
    const g = this.g;
    gd.dazzledUntil = Math.max(gd.dazzledUntil, g.time + secs); gd.reactT = Math.max(gd.reactT, secs);
    gd.awareness = Math.max(gd.awareness, 0.6); if (gd.state !== 'alert') gd.lastKnown = v3.copy(at);
    if (g.aiEnabled) gd.witness.dazzled++;
    gd.path = []; gd.pathGoal = null; gd.speed = 0; gd.dazzledAt = v3.copy(at); gd.char.anim.hitFrom(v3.sub(gd.char.pos, at));
  }
  /** the charge on the leaf: a dark slab by the lock with a lit tell, on the face it was set from (one-frame boxes, as the breach drill's held can) */
  private drawCharge(c: SetCharge) {
    const d = c.door; if (isOpen(d)) return;
    const p = doorPt(d, d.def.width - 0.22, 0.045, c.side, 1.05), n = doorPt(d, 0, 1, c.side), o = doorPt(d, 0, 0, c.side); const yaw = Math.atan2(n[0] - o[0], n[2] - o[2]);
    this.g.fx.push({ box: makeBox({ c: p, h: [0.07, 0.11, 0.02], yaw, albedo: [0.09, 0.1, 0.08], flags: BoxFlag.Dynamic }), ttl: 1e-3 });
    this.g.fx.push({ box: makeBox({ c: [p[0] + (n[0] - o[0]) * 0.022, p[1] + 0.07, p[2] + (n[2] - o[2]) * 0.022], h: [0.012, 0.012, 0.004], yaw, albedo: [0.9, 0.12, 0.08], emissive: [2.2, 0.2, 0.1], flags: BoxFlag.Dynamic | BoxFlag.NoShadow }), ttl: 1e-3 });
  }

  // ------------------------------------------------------------ clear from outside
  /** DOORTOOLS.thrPie: the next of this man's cuts that still shows HIM floor no muzzle has been across — floor the hold would count for him from there (his
   *  light, the place's own, the goggles: look()'s own test), from a standing eye or a knee's (−1: none — he has had all the outside will give him). With
   *  no search model on the room every cut is walked. */
  private pieNext(op: DoorOp, gd: Guard, s: { pts: Vec3[]; i: number; pie?: { eyes: Vec3[]; knee: boolean[] } }): number {
    const g = this.g, K = DOORTOOLS, SR = op.search ?? null, T = op.thr!, col = g.col, E = s.pie!.eyes, lit = !!gd.flashlight?.enabled, tube = K.thrTube && nvgDown(g, gd);
    for (let k = s.i + 1; k < s.pts.length; k++) { if (!SR) return k; const e: Vec3 = [E[k][0], s.pie!.knee[k] ? KNEE_EYE : 1.55, E[k][2]];
      for (let i = 0; i < SR.pts.length; i++) { if (SR.looked[i]) continue; const q = SR.pts[i], dx = q[0] - e[0], dz = q[2] - e[2];
        if (dx * dx + dz * dz > K.lookM * K.lookM || col.segmentBlocked(e, q)) continue;
        if (lit || this.thrLitCell(T, SR, i) || (tube && (this.thrTubeCell(T, SR, i) || irShowsAt(g, gd, q)))) return k; } }
    return -1;
  }
  /** DOORTOOLS.thrPie: the hold is over (the word, a step in, the pockets, the order's end) with a man still mid-cut. He is done cutting; and if nothing has
   *  given him another place since, he stands square where his hips are, off the knee, on the middle of what his cut showed */
  private pieOff(op: DoorOp) {
    const S = this.g.orders;
    for (const [gd, s] of op.slice) { const P = s.pie; if (!P || P.fin || !P.begun) continue; P.fin = true;
      const A = S.of(gd); if (!A || A !== op.mine.get(gd) || !(A.lean || A.crouch) || gd.state === 'dead') continue;
      const p = gd.char.pos, l = s.looks[s.i], mid = l[l.length >> 1];
      this.assign(op, gd, { post: [p[0], 0, p[2]], face: yawTo(p, mid), watch: mid, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: A.search, going: A.going, there: A.there }); }
  }
  /** DOORTOOLS.thrPie: a jamb man's stations — `first` (his diagonal, stood square as with the rule off), then the cuts of thrPieArc further in than
   *  those, each with floor under it and a clear step from the one before, none within thrPieApart of `off` (where the other man stands). Each is where his
   *  EYE goes; with thrLean his hips stop thrLeanM short of it, back along his own wall (where the floor lets them), and a cut further in than thrKneeIn is
   *  a knee's. The hinge man of a leaf that stands on this face (thrPull) has no edge to lean round and no cut to take: his one spot, square. */
  private pieSet(op: DoorOp, gd: Guard, sgn: -1 | 1, first: Vec3[], off: Vec3[]): Vec3[] {
    const g = this.g, K = DOORTOOLS, d = op.door, W = d.def.width, nav = g.col.nav, pull = sgn < 0 && this.leafOurs(d, op.side), lm = K.thrLean && !pull ? K.thrLeanM : 0;
    const inOf = (p: Vec3) => sgn < 0 ? alongOf(d, p) : W - alongOf(d, p);   // metres in from his own jamb's edge of the opening
    const at = (a: number, B: number): Vec3 => doorPt(d, sgn < 0 ? a : W - a, B, op.side);
    const floor = (from: Vec3, p: Vec3) => !nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([from[0], 0.45, from[2]], [p[0], 0.45, p[2]]);
    const eyes: Vec3[] = [...first], pts: Vec3[] = []; for (const [k, e] of first.entries()) { const q = k === 0 || !lm ? e : at(inOf(e) - lm, offOf(d, e, op.side)); pts.push(q === e || floor(pts[k - 1], q) ? q : e); }
    if (!pull) for (const [a, B0] of K.thrPieArc) { const B = B0 * K.sliceBack, prev = pts[pts.length - 1];
      if (a <= inOf(eyes[eyes.length - 1]) + 0.05) continue;
      const p = at(a - lm, B), e = K.thrPieOne ? p : at(a, B);   // (thrPieOne: square on every cut, his hips where a leaning man's stop — never in front of the opening — and his eye over them; the one lean comes after the last)
      if (!floor(prev, p) || off.some(o => flat(o, p) < K.thrPieApart)) continue;
      eyes.push(e); pts.push(p); }
    const fwd = v3.sub(doorPt(d, W / 2, 1, -op.side as 1 | -1), doorPt(d, W / 2, 0, op.side)), inw = v3.sub(at(1, 0), at(0, 0));   // into the room · toward the door's middle from his jamb
    const lean = lm ? Math.sign(inw[0] * -fwd[2] + inw[2] * fwd[0]) : 0;   // (his right hand, facing in, is (−fz, fx): + = the middle is to his right)
    const looks = eyes.map((e, k) => { const l = this.sliceLooks(op, e, sgn); return k === 0 || l.length < 3 ? l : [l[2], l[1]]; });   // (a cut: the ground it opens — the line past his own jamb — then the middle)
    op.slice.set(gd, { pts, looks, i: 0, j: 0, t: NaN, ahead: null, pie: { eyes, lean: K.thrPieOne ? 0 : lean, end: K.thrPieOne ? lean : 0, endOn: false, knee: eyes.map((e, k) => !K.thrPieOne && !!lm && k > 0 && inOf(e) > K.thrKneeIn), fin: false, begun: false, at: g.time, inw: v3.normalize(inw), gun: 0, gunAt: -100, on: false, to: null } });
    return pts;
  }
  /** what a station shows through the frame: the line past the far jamb, the middle, the line past the near jamb (where the next step opens new ground) */
  private sliceLooks(op: DoorOp, p: Vec3, sgn: -1 | 1): Vec3[] {
    const K = DOORTOOLS, d = op.door, W = d.def.width, into = -op.side as 1 | -1;
    const near = sgn < 0 ? K.sliceEdge : W - K.sliceEdge, far = W - near;
    const through = (a: number): Vec3 => { const e = doorPt(d, a, 0, op.side), dx = e[0] - p[0], dz = e[2] - p[2], l = Math.hypot(dx, dz) || 1; return [e[0] + dx / l * K.sliceDeep, 1.1, e[2] + dz / l * K.sliceDeep]; };
    const F = through(far), N = through(near), M: Vec3 = [(F[0] + N[0]) / 2, 1.1, (F[2] + N[2]) / 2];
    return offOf(d, M, op.side) < -0.3 ? [F, M, N] : [doorPt(d, W / 2, K.sliceDeep, into, 1.1)];
  }
  /** each man's stations across the opening, all on Sam's side of the frame line: from wide of his own jamb toward the middle, each with the point inside his gun
   *  is on from there (pivoting through the doorway's middle: from wide of the hinge he sees the latch side of the room) */
  private toSlice(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, W = d.def.width, nav = g.col.nav, name = doorWords(d);
    const looksFrom = (p: Vec3, sgn: -1 | 1) => this.sliceLooks(op, p, sgn);
    const L = op.post.get(op.lead), start: Vec3 = L ? L.pos : [op.lead.char.pos[0], 0, op.lead.char.pos[2]];
    const sgn: -1 | 1 = alongOf(d, start) < W / 2 ? -1 : 1;
    // ONE arc for everybody, from the lead's own jamb — the thinnest slice there is — out, round the front of the door and in to the far wall, each step showing a
    // little more of the room; the lead walks all of it, each man behind him stops two stations short of the man ahead (two muzzles on the opening, two angles)
    const arc: Vec3[] = [start];
    const ours = this.leafOurs(d, op.side);
    for (const [a, B] of [...K.thrArc, [W / 2, 2.0], [W - 0.25, 1.8], [W + 0.45, 1.2]].map(([a, B]) => [a, B * K.sliceBack])) {
      const al = sgn < 0 ? a : W - a, q = doorPt(d, al, B, op.side), prev = arc[arc.length - 1];
      if (ours && al < 0) continue;   // (thrPull: a station beyond the hinge jamb is behind the leaf standing open on this face)
      if (!nav.isBlocked(q[0], q[2]) && (ours && alongOf(d, prev) < 0 || !g.col.solidBlocked([prev[0], 0.45, prev[2]], [q[0], 0.45, q[2]]))) arc.push(q); }   // (… and from a mark beyond it the way out is round that leaf's end: the floor alone is asked)
    const across = (gd: Guard) => { const P = op.post.get(gd); return op.men.length > 2 && (alongOf(d, P ? P.pos : gd.char.pos) < W / 2 ? -1 : 1) !== sgn; };   // (three or more: a man stacked on the OTHER jamb)
    for (const gd of op.men) if (across(gd) && !op.rear.has(gd)) {   // … works the opening from where he stands — his own angle through it, the half of the room the arc's men see last — and never walks across the front of the door to join the arc
      const P = op.post.get(gd), here: Vec3 = P ? P.pos : [gd.char.pos[0], 0, gd.char.pos[2]], looks = looksFrom(here, -sgn as -1 | 1);
      op.slice.set(gd, { pts: [here], looks: [looks], i: 0, j: 0, t: NaN, ahead: null });
      this.assign(op, gd, { post: here, face: yawTo(here, looks[0]), watch: looks[0], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: true, going: `slicing · ${name}`, there: `holding outside · ${name}` });
    }
    [op.lead, ...op.men.filter(m => m !== op.lead && !across(m) && !op.rear.has(m))].forEach((gd, k, file) => {
      const n = Math.max(1, arc.length - 2 * k), P = op.post.get(gd), here: Vec3 = P ? P.pos : [gd.char.pos[0], 0, gd.char.pos[2]];
      const pts = k === 0 ? arc.slice(0, n) : [here, ...arc.slice(1, n)];
      const s = { pts, looks: pts.map((q, i) => { const l = looksFrom(q, sgn); return i === 0 || l.length < 3 ? l : [l[2], l[1], l[2]]; }), i: 0, j: 0, t: NaN, ahead: k === 0 ? null : file[k - 1] ?? null };
      op.slice.set(gd, s);
      this.assign(op, gd, { post: s.pts[0], face: yawTo(s.pts[0], s.looks[0][0]), watch: s.looks[0][0], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: true, going: `slicing · ${name}`, there: `slicing · ${name}` });
    });
    op.phase = 'slice'; op.t0 = g.time; this.beat(op, 'slice');
    g.say(op.lead, 'working it from outside.');
  }

  // ------------------------------------------------------------ the room worked from the threshold
  /** The leaf is moving and nobody goes in. The LEAD — the opener — and the front man of the other jamb each step out onto their own jamb's diagonal and hold
   *  it, still: between them the two lines cross in the room (`thrSlice`: the lead walks his side of the opening a station at a time instead). Everybody else
   *  of the order keeps the squad's back (DoorOp.rear: tick leaves their eyes spare). Who shoots, and at whom, is the room fight's, as from any mark. */
  /** DOORTOOLS.thrPull: this door's leaf comes round onto face `side` — a one-way door worked from the face it opens toward */
  private leafOurs(d: Door, side: 1 | -1): boolean { const D = this.g.doors; return DOORTOOLS.thrPull && D.swingOf(d).oneWay && D.pullFace(d, doorPt(d, d.def.width / 2, 0.6, side)); }
  /** a jamb man's holding spot (`sgn` −1: the hinge jamb's, +1: the latch jamb's) and where the walk to it is asked from: his jamb's diagonal from his mark —
   *  or, the hinge jamb's on a face the leaf comes round onto, thrPullAt, asked from in front of the latch half (his mark is behind where the leaf will stand) */
  private thrSpot(op: DoorOp, sgn: -1 | 1, mark: Vec3): { q: Vec3; from: Vec3 } {
    const K = DOORTOOLS, d = op.door, W = d.def.width, B = K.thrPullAt[1] * K.sliceBack;
    return sgn < 0 && this.leafOurs(d, op.side) ? { q: doorPt(d, K.thrPullAt[0], B, op.side), from: doorPt(d, W * 0.8, B, op.side) }
      : { q: doorPt(d, sgn < 0 ? -K.thrStill[0] : W + K.thrStill[0], K.thrStill[1] * K.sliceBack, op.side), from: mark };
  }
  /** the far jamb's man (the first man on the other jamb from the lead's — null: one jamb only has floor), the side of the opening he stands off, and his
   *  diagonal: one step out from his mark, where the floor lets him */
  private thrFar(op: DoorOp): { far: Guard; fs: -1 | 1; here: Vec3 } | null {
    const g = this.g, K = DOORTOOLS, d = op.door, W = d.def.width, nav = g.col.nav, lead = op.lead;
    const mark = (gd: Guard): Vec3 => op.post.get(gd)?.pos ?? [gd.char.pos[0], 0, gd.char.pos[2]], hi = (gd: Guard) => alongOf(d, mark(gd)) > W / 2;
    const far = op.men.filter(m => m !== lead && !!op.post.get(m)?.lead && hi(m) !== hi(lead)).sort((a, b) => flat(mark(a), d.frameCentre) - flat(mark(b), d.frameCentre))[0] ?? null;
    if (!far) return null;
    const P = mark(far), fs: -1 | 1 = hi(lead) ? -1 : 1, { q, from } = this.thrSpot(op, fs, P);
    return { far, fs, here: !nav.isBlocked(q[0], q[2]) && !g.col.solidBlocked([from[0], 0.45, from[2]], [q[0], 0.45, q[2]]) ? q : P };
  }
  /** DOORTOOLS.thrSet: with the men stacked and the door still shut, the far gun steps onto its diagonal and comes up on the door (no search light asked for: the light rule's own until the leaf moves) */
  private thrSetFar(op: DoorOp) {
    const K = DOORTOOLS, d = op.door, name = doorWords(d); if (isOpen(d) || this.lockedOut(d, op.side)) return;
    const F = this.thrFar(op); if (!F) return;
    const l = this.sliceLooks(op, F.here, F.fs), mid = l[l.length >> 1];
    this.assign(op, F.far, { post: F.here, face: yawTo(F.here, mid), watch: mid, stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), going: `setting on the jamb · ${name}`, there: `set on the door · ${name}` });
    op.thrPre = { far: F.far, t: this.g.time }; this.beat(op, `far gun ${F.far.callsign} sets`);
  }
  /** DOORTOOLS.thrLast: is this a threshold order on a hostage room whose captor has given his last warning (rescue.ts) — and the order's own to time (not on
   *  a word, not on a gate with other doors, not given to hold: those are Sam's) */
  private lastCall(op: DoorOp): boolean {
    return DOORTOOLS.thrLast && op.kind === 'threshold' && !op.onWord && !op.word && !op.gate && !op.thrHold && this.g.rescue.lastWarning(op.door);
  }
  /** … heard with a man on his jamb and another still more than `thrLastM` short of his mark: the stack is made with who is there (the stack phase then waits
   *  on nobody). If the man still walking is the LEAD — the latch jamb's, who opens it — the door is handed to the jamb man who is on his mark (as when a lead
   *  drops: open() boots it from wherever its lead stands). A late man whose mark is the OTHER jamb, and who has not passed the opening yet, takes the lead's
   *  wall instead — the first free place behind him, `bangFile` apart, clear of Sam and of men who are not this order's — so nobody walks across a door that
   *  is about to open; with no floor there he keeps his mark (and is no thrower from down the wall: thrThrower) */
  private lastStack(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, W = d.def.width, name = doorWords(d);
    const on = (m: Guard) => { const P = op.post.get(m); return !!P && flat(m.char.pos, P.pos) <= 0.6; }, off2 = (m: Guard) => { const P = op.post.get(m); return !!P && !this.arrived(op, m) && flat(m.char.pos, P.pos) > K.thrLastM; };
    let lead = op.lead, handed = false;
    if (!on(lead)) { if (!off2(lead)) return;
      const sub = op.men.filter(m => m !== lead && m.state !== 'dead' && !!op.post.get(m)?.lead && on(m)).sort((a, b) => flat(a.char.pos, d.frameCentre) - flat(b.char.pos, d.frameCentre))[0]; if (!sub) return;
      lead = sub; handed = true; }
    const late = op.men.filter(m => m !== lead && m.state !== 'dead' && !this.arrived(op, m) && !!op.post.get(m));
    if (!late.length || late.some(m => !off2(m))) return;   // (a man a step from his mark is waited for as ever)
    op.lastStack = true; op.lead = lead;
    const L = op.post.get(lead)!, aL = alongOf(d, L.pos), dir = aL > W / 2 ? 1 : -1, off = offOf(d, L.pos, op.side), watch: Vec3 = [d.frameCentre[0], 1.05, d.frameCentre[2]];
    const others = [g.orders.samStood, ...g.guards.filter(x => (g.orders.sams ? x.team === 'operative' : g.orders.mine(x)) && x.state !== 'dead' && !op.men.includes(x)).map(x => x.char.pos)];
    const free = (c: Vec3, gd: Guard) => !g.col.nav.isBlocked(c[0], c[2]) && !g.col.solidBlocked([L.pos[0], 0.45, L.pos[2]], [c[0], 0.45, c[2]]) && !op.men.some(m => m !== gd && flat(op.post.get(m)?.pos ?? m.char.pos, c) < 0.7) && !others.some(p => flat(p, c) < 0.7) && stackRoomKeeps(g, d, op.side, c);
    for (const gd of late) { const P = op.post.get(gd)!, a = alongOf(d, gd.char.pos);
      if ((alongOf(d, P.pos) > W / 2) === (aL > W / 2)) continue;   // (his mark is on the lead's wall already)
      if (dir > 0 ? a < -0.2 : a > W + 0.2) continue;   // (past the opening already, on his own wall: he goes on to his jamb)
      let q: Vec3 | null = null;
      for (let j = 1; j <= 4 && !q; j++) { const c = doorPt(d, aL + dir * j * K.bangFile, off, op.side); if (free(c, gd)) q = c; }
      if (!q) continue;
      const Q: Post = { ...P, pos: q, face: L.face, stackSide: L.stackSide, lead: false }; op.post.set(gd, Q);
      this.assign(op, gd, { post: q, face: Q.face, watch, stance: 'highReady', upper: 'none', move: { stance: 'none', upper: 'aim' }, stackSide: Q.stackSide, going: `stacking · ${name}`, there: `stacked · ${name}` }); }
    this.beat(op, `last warning · not waiting for ${late.map(m => m.callsign).join(', ')}${handed ? ` · the door is ${lead.callsign}'s` : ''}`); g.say(lead, 'no time. going.');
  }
  private toThreshold(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, d = op.door, W = d.def.width, nav = g.col.nav, name = doorWords(d), t = g.time, lead = op.lead, light = this.lights ?? NIGHTBREACH.opLights;
    const mark = (gd: Guard): Vec3 => op.post.get(gd)?.pos ?? [gd.char.pos[0], 0, gd.char.pos[2]], hi = (gd: Guard) => alongOf(d, mark(gd)) > W / 2;
    const floor = (from: Vec3, p: Vec3) => !nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked([from[0], 0.45, from[2]], [p[0], 0.45, p[2]]);
    const F = this.thrFar(op), far = F?.far ?? null;
    const jamb = far ? [lead, far] : [lead]; op.rear.clear(); for (const m of op.men) if (!jamb.includes(m)) op.rear.add(m);
    // the lead: out onto his own jamb's diagonal — or, slicing, from the mark he stands on (the thinnest slice there is) out off his wall and round to just inside his own edge of the opening
    const sgn: -1 | 1 = hi(lead) ? 1 : -1, pts: Vec3[] = [mark(lead)];
    if (K.thrSlice) for (const [a, B] of K.thrArc) { const q = doorPt(d, sgn < 0 ? a : W - a, B * K.sliceBack, op.side); if (floor(pts[pts.length - 1], q)) pts.push(q); }
    else { const { q, from } = this.thrSpot(op, sgn, pts[0]); if (floor(from, q)) pts[0] = q; }   // (no slice: his own jamb's diagonal, as the far man's)
    const looks = pts.map((q, i) => { const l = this.sliceLooks(op, q, sgn); return !K.thrSlice ? [l[l.length >> 1]] : i === 0 || l.length < 3 ? l : [l[2], l[1], l[2]]; });   // (a step is taken with the muzzle on the ground it opens — the line past his own jamb — then the middle, and back)
    op.slice.set(lead, { pts, looks, i: 0, j: 0, t: NaN, ahead: null });
    if (K.thrPie) {   // (both jamb men cut the opening, each on his own side of its middle: pieSet — or, thrPieOne, the lead alone)
      const diag = (sg: -1 | 1, m: Vec3) => { const { q, from } = this.thrSpot(op, sg, m); return floor(from, q) ? q : null; };
      const lm = mark(lead), ld = diag(sgn, lm), lp = this.pieSet(op, lead, sgn, ld ? [ld] : [lm], F ? [F.here] : []);
      if (far && F && !K.thrPieOne) this.pieSet(op, far, F.fs, [F.here], [lp[lp.length - 1]]);   // (thrPieOne: the far man has no cuts — his diagonal, held, below)
    }
    const sl = op.slice.get(lead)!, sf = K.thrPie && far ? op.slice.get(far) ?? null : null;
    const lit = (gd: Guard) => !(K.thrDark && nvgWorn(g, gd)) && (K.thrLight >= 2 || (K.thrLight === 1 && gd === (K.thrPie && K.thrPieOne ? lead : far ?? lead)));   // (one light on the door: the still gun's — the opener's own when he has the door alone; thrPieOne: the one man cutting carries it, a cut shows him nothing in the dark otherwise)
    // (the step onto the diagonals — as the leaf swings; or, a can going in first, behind its burst: thrOut)
    const out = () => {
    if (op.men.includes(lead)) this.assign(op, lead, { post: sl.pts[0], face: yawTo(sl.pts[0], sl.looks[0][0]), watch: sl.looks[0][0], stance: 'none', upper: 'aim', light, search: lit(lead), ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), going: K.thrSlice || sl.pie ? `slicing · ${name}` : `on the jamb · ${name}`, there: sl.pts.length > 1 ? `slicing · ${name}` : `holding the jamb · ${name}` });
    // the far jamb's man: one step out onto his diagonal, his muzzle down the middle of what it shows — and there he stays
    if (far && sf && op.men.includes(far)) this.assign(op, far, { post: sf.pts[0], face: yawTo(sf.pts[0], sf.looks[0][0]), watch: sf.looks[0][0], stance: 'none', upper: 'aim', light, search: lit(far), ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), going: `slicing · ${name}`, there: sf.pts.length > 1 ? `slicing · ${name}` : `holding the jamb · ${name}` });
    else if (far && F && op.men.includes(far)) { const fs = F.fs, here = F.here;
      const l = this.sliceLooks(op, here, fs), mid = l[l.length >> 1];
      this.assign(op, far, { post: here, face: yawTo(here, mid), watch: mid, stance: 'none', upper: 'aim', light, search: lit(far), ...(K.slicePace > 0 ? { pace: K.slicePace } : {}), going: `on the jamb · ${name}`, there: `holding the jamb · ${name}` }); } };
    const first = !op.thrPre && this.canFirst(op); if (!first) out();
    const pods = this.shallowPods(d, op.side, Math.max(2, op.men.length));
    op.thr = { jamb, pods, quietT: t, evT: t, contact: new Set(), up: g.guards.filter(x => x.state !== 'dead' && x.team === 'hostile'), down: 0, sliced: false, thrower: null, tossed: 0, nextT: 0, aim: null, from: null, banged: null, handed: false, losT: 0, litC: null, hold: !!op.thrHold, told: false, force: false, first: first ? 'can' : null, out: first ? out : null };
    if (pods.length) this.searchOf(op, pods[0].pos);
    op.phase = first ? 'pocket' : 'thr'; op.t0 = t; if (first) op.thr.nextT = t + (op.kick && !isNaN(op.kick.t) ? K.tossAfterKick : K.tossAfterOpen);   // (a can first goes in on the shove or the boot, as a bang and clear's does: every tenth of a second the leaf stands open before it is one a settled gun in there has on the jambs)
    this.beat(op, `threshold · ${hi(lead) ? 'latch' : 'hinge'} jamb ${lead.callsign} ${K.thrSlice || K.thrPie ? 'slices' : 'holds'} · ${far ? `${hi(far) ? 'latch' : 'hinge'} jamb ${far.callsign} ${K.thrPie && !K.thrPieOne ? 'slices' : 'holds'}` : op.lastStack ? 'the other jamb not waited for' : 'no floor at the other jamb'}${op.rear.size ? ` · rear ${[...op.rear].map(m => m.callsign).join(', ')}` : ''}${op.thrHold ? ' · to hold' : ''}${first ? ' · a can first' : ''}`);
    g.say(lead, 'working it from the door.');
  }
  /** DOORTOOLS.thrFirst: does this door get a can before anybody shows in its opening — the kit has one, the stage may spend it, no teammate is in there,
   *  the order is not on a word or a gate (those keep their own count), and the floor is hot in the ears of a man of the order (or the knob says every door) */
  private canFirst(op: DoorOp): boolean {
    const K = DOORTOOLS; if (K.thrFirst <= 0 || K.thrBangs <= 0 || this.bangs <= 0 || op.word || op.onWord || op.worded || op.gate || op.thrHold) return false;
    if (silentNoCans(this.g)) return false;   // (silent.ts: nobody asked for this can)
    const g = this.g, d = op.door; if (!(K.thrFirst >= 2 || op.men.some(m => m.state !== 'dead' && g.fight.hotFor(m)))) return false;
    // (nobody asked for this can: one of ours beyond the door inside its reach with a line from the opening — a teammate of any squad's size, or Sam — and it stays in the kit)
    const inn = doorPt(d, d.def.width / 2, 0.45, -op.side as 1 | -1, 1.1), ours = [...g.guards.filter(x => (g.orders.sams ? x.team === 'operative' && x.unit : g.orders.mine(x)) && x.state !== 'dead' && !op.men.includes(x)).map(x => x.char.pos), ...(g.player.down ? [] : [g.orders.samStood])];
    return !ours.some(p => offOf(d, p, op.side) < 0 && flat(p, d.frameCentre) < K.stunM && !g.col.solidBlocked(inn, [p[0], 1.1, p[2]]));
  }
  /** … and behind that can (its burst run dry) — or with no can thrown after all — the jamb men step out onto their diagonals and the hold begins */
  /** behind a bang: has the blind burst it drew run dry — `afterBang` gone and no defender's shot for `quiet`, or `entryCap` whatever they do */
  private burstDry(op: DoorOp): boolean {
    const g = this.g, K = DOORTOOLS, t = g.time, since = t - op.bangT; let last = -Infinity;
    for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.time < op.bangT) break;
      if (e.kind === 'guardShot' && e.who !== undefined && !g.guards.some(x => x.team === 'operative' && x.char.id === e.who)) { last = e.time; break; } }
    return (since >= K.afterBang && t - last >= K.quiet) || since >= K.entryCap;
  }
  private thrOut(op: DoorOp, why = '') {
    const T = op.thr!, t = this.g.time, banged = T.first === 'burst', wide = banged && !!T.wide;
    this.thrMen(op); T.first = banged && !wide ? 'done' : null; T.out?.(); T.out = null;
    if (T.thrower && !T.jamb.includes(T.thrower)) op.rear.add(T.thrower);   // (the thrower has the squad's back again for the hold)
    T.thrower = null; op.phase = 'thr'; op.t0 = t; T.quietT = t; T.nextT = 0;
    this.beat(op, wide ? 'out onto the diagonals · the can went off outside' : banged ? 'out onto the diagonals behind the can' : `no can first · ${why}`);
    if (T.early) { T.early = false; T.asked = true; this.beat(op, 'the word'); this.toPockets(op); }   // (the word, given while the can was in the air)
  }
  /** the stage's men, kept true: a jamb man who is down or re-ordered is off it; with the lead gone the far-jamb man has the door (he holds his diagonal:
   *  nobody new starts a slice), and with both gone the order's next man turns in from the rear to hold the frame from where he stands */
  private thrMen(op: DoorOp) {
    const T = op.thr!, d = op.door; T.jamb = T.jamb.filter(m => op.men.includes(m));
    if (T.thrower && !op.men.includes(T.thrower)) T.thrower = null;
    if (T.jamb.includes(op.lead)) { if (T.jamb[0] !== op.lead) T.jamb = [op.lead, ...T.jamb.filter(m => m !== op.lead)]; return; }
    if (T.jamb.length) { op.lead = T.jamb[0]; return; }
    const gd = op.lead, p = gd.char.pos, name = doorWords(d); T.jamb = [gd]; op.rear.delete(gd);
    if (op.phase === 'enter') return;
    this.assign(op, gd, { post: [p[0], 0, p[2]], face: yawTo(p, d.frameCentre), watch: [d.frameCentre[0], 1.05, d.frameCentre[2]], stance: 'none', upper: 'aim', light: this.lights ?? NIGHTBREACH.opLights, search: !(DOORTOOLS.thrDark && nvgWorn(this.g, gd)), going: `on the door · ${name}`, there: `holding the door · ${name}` });
    this.beat(op, `the door is ${gd.callsign}'s`);
  }
  /** what the hold listens for: a man at the frame with somebody in his sight (called once a man), a defender's round fired near the door, one of theirs
   *  dropping in the room or its doorway while everybody is still outside — each puts the quiet clock back */
  private thrWatch(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, T = op.thr!, d = op.door, t = g.time;
    for (const gd of T.jamb) if (g.fight.contact(gd) || g.fight.engaged(gd)) { T.quietT = t; if (!T.contact.has(gd)) { T.contact.add(gd); this.beat(op, `contact:${gd.callsign}`); } }
    const room = op.search?.room as { cells: Set<number> } | undefined, nav = g.col.nav, inRoom = (p: Vec3) => !!room?.cells.has(Math.floor(p[2] / nav.cell) * nav.W + Math.floor(p[0] / nav.cell));
    for (let i = g.events.length - 1; i >= 0; i--) { const e = g.events[i]; if (e.time < T.evT) break;   // (the men fire AFTER this tick in a frame: the last tick's own frame is read again, which costs nothing)
      if (e.kind === 'guardShot' && e.who !== undefined && (flat(e.pos, d.frameCentre) < K.thrShotM || inRoom(e.pos)) && !g.guards.some(x => x.team === 'operative' && x.char.id === e.who)) { T.quietT = t; break; } }
    T.evT = t;
    for (let i = T.up.length - 1; i >= 0; i--) { const h = T.up[i]; if (h.state !== 'dead') continue; T.up.splice(i, 1);
      const p = h.char.pos; if (!(flat(p, d.frameCentre) < 3 || inRoom(p))) continue;
      T.quietT = t; T.down++; this.beat(op, `down from outside · ${h.callsign ?? 'a man'}`); }
    if (K.thrFragHold) {   // A GRENADE ON THE STACK: who of the order ran from one and is not back yet (thrFragWait)
      const F = T.fled ??= new Set<Guard>(), n0 = F.size;
      let came = false; for (const m of F) if (!op.men.includes(m)) F.delete(m);   // (down, or given another order: the order's men are the living ones still on it)
      for (const m of op.men) { if (fragRunning(g, m)) F.add(m); else if (F.has(m) && this.thrBack(op, m)) { F.delete(m); came = true; } }
      if (F.size && !n0) this.beat(op, `grenade on the stack · ${[...F].map(m => m.callsign).join(', ')} off the door`);
      if (!F.size && n0) this.beat(op, came ? 'the men are back' : 'nobody left to wait for');   // (the last of them down or off the order: said as that)
      if (op.phase === 'thr' && this.thrFragWait(op)) T.quietT = t;   // (the hold does not count the door quiet meanwhile; its own cap ends it as it always did)
    }
  }
  /** the cans this stage may spend on its door, the one that went in first included: `thrBangs` — or that one alone (`thrFirstOnly`) while Sam has not asked
   *  for a can since (his word, a told 'bang') */
  private thrCans(T: Threshold): number { const K = DOORTOOLS; if (!T.force && silentNoCans(this.g)) return 0;   // (a SILENT squad's cans stay in the kit, on the word too: 'bang, then step in' is the loud row — silent.ts)
    if (K.outsidePlain) return Math.min(1, K.thrBangs);   // (one can a door, on the word and when told: "the squad does waste a lot of bangs in that path")
    return T.first === 'done' && K.thrFirstOnly && !T.force && !T.asked ? Math.min(1, K.thrBangs) : K.thrBangs; }

  /** the hold is over. Both jamb men stand in behind their jambs' edges (`thrCover`: the blind burst a bang draws comes back through the opening — and it is a
   *  step from there to the frame), and the thrower — the man nearest the frame who is on neither jamb; with only the jamb men, the far one; alone, himself —
   *  comes round from the rear */
  private toPockets(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, T = op.thr!, d = op.door, t = g.time, near = (m: Guard) => flat(m.char.pos, d.frameCentre);
    this.heldBeat(op);
    if (T.first === 'done' && K.thrFirstStale > 0 && t - op.bangT >= K.thrFirstStale && T.banged && T.tossed < this.thrCans(T) && this.bangs > 0) { T.banged = null; this.beat(op, `the first can is ${(t - op.bangT).toFixed(1)} s old · its floor is blind again`); }
    T.thrower = this.thrThrower(op); op.rear.delete(T.thrower); T.handT = undefined;   // (thrHand: a fresh trip to the pockets says its own wait; what the order has already waited stays counted)
    this.closeUp(op); if (K.thrCover) for (const m of T.jamb) if (m !== op.lead) this.closeUp(op, m);
    op.phase = 'pocket'; op.t0 = t; T.nextT = t + K.thrTurn;
  }
  /** the hold's own count, as it ends (the pockets, a step in told, the door left) */
  private heldBeat(op: DoorOp) {
    const T = op.thr!, SR = op.search; this.thrMen(op);
    this.beat(op, `held ${(this.g.time - op.t0).toFixed(1)} s · ${T.contact.size} in contact · ${T.down} down${SR ? ` · ${SR.left} of ${SR.pts.length} cells unseen` : ''}`);
  }
  /** who throws: the man nearest the frame who is on neither jamb; with only the jamb men, the far one; alone, himself */
  private thrThrower(op: DoorOp): Guard { return this.thrPick(op, false)!; }
  /** DOORTOOLS.thrHand: is this man a hand AT THE DOOR — within `throwReach` of the frame, on the squad's face of it */
  /** … or BACK: at the door, or on his own mark of the order */
  private thrBack(op: DoorOp, m: Guard): boolean { const A = op.mine.get(m); return this.thrAt(op, m) || (!!A?.post && flat(m.char.pos, A.post) <= 0.6); }
  /** DOORTOOLS.wordCuts: is the word's step in (no can) waiting for the jamb men's cuts — a hold whose men slice (thrPie), the cuts not yet called done
   *  ('sliced'), the rule's cap not spent since the word. Not asked under a captor's last warning, nor of a door that shares a word with another. */
  private cutsOwe(op: DoorOp): boolean {
    const K = DOORTOOLS, T = op.thr!; if (!K.wordCuts || WORDCUTS_BREAK || !K.wordNoCan || T.sliced || T.told || op.phase !== 'thr') return false;   // (`told`: they have said 'holding on the door' — the hold's own cap — and are not sent back to cuts)
    if (!T.jamb.some(m => !!op.slice.get(m)?.pie)) return false;   // (nobody on this door cuts: there is nothing to wait for)
    if (T.cutOwed && this.g.time - (T.owedT ?? -1e9) >= K.wordCutsCap) return false;
    if (this.set.some(c => !this.onPendingWord(c) && this.keyIs(c))) return false;   // (a set charge goes on this same word: they go in behind its blast, not seconds after it)
    return !op.lastStack && !op.lastHold && !this.g.rescue.lastWarning(op.door) && !(op.word && this.ops.some(o => o !== op && o.word === op.word));
  }
  /** DOORTOOLS.thrFragHold: is the stage waiting for men who ran from a grenade — some are not back, and the order's one wait (`thrHandWait`, the can's
   *  own wait counted in it) is not spent. Not asked under a captor's last warning, nor of a door that shares a word with another (as thrHand is not). */
  private thrFragWait(op: DoorOp): boolean {
    const K = DOORTOOLS, T = op.thr!;
    return K.thrFragHold && !!T.fled?.size && !T.handDone && (T.handW ?? 0) < K.thrHandWait && !op.lastStack && !op.lastHold && !this.g.rescue.lastWarning(op.door) && !(op.word && this.ops.some(o => o !== op && o.word === op.word));
  }
  /** DOORTOOLS.fragHold: is this order waiting for men who ran from a grenade — some of them not back, the stage it is in one that holds (fragHolds), its
   *  one wait (`fragHoldCap`) not spent, its signal not gone. Sam's own squad only (the response team's cast of this module is not asked). Not asked under a
   *  captor's last warning. */
  private fragWait(op: DoorOp): boolean {
    const K = DOORTOOLS;
    return K.fragHold && !!op.fled?.size && !op.fledGo && this.g.orders.sams && (op.fledW ?? 0) < K.fragHoldCap && this.fragHolds(op) && !op.lastStack && !op.lastHold && !this.g.rescue.lastWarning(op.door);
  }
  /** … the orders on a word that has been given and is held for men who ran, where these men are on one of its doors (every door of such a word): the word
   *  given AGAIN lets them all go (goMen), and the 'go' row is not greyed for it */
  private fragHeld(men: Guard[]): DoorOp[] {
    if (!DOORTOOLS.fragHold) return [];
    const held = this.words.filter(w => isNaN(w.go1) && this.ops.some(o => o.word === w && o.men.some(m => men.includes(m))) && this.ops.some(o => o.word === w && this.fragWait(o)));
    return held.length ? this.ops.filter(o => !!o.word && held.includes(o.word)) : [];
  }
  /** … the stages that hold, each while its door is still to be opened: the walk to the stack and its call (on one signal for several doors: once the
   *  signal is raised) · a stack that is ready, once it is no longer waiting for Sam's word (the word given, or given up on) · the leaf itself — a boot,
   *  shove or tool not yet begun (a hand on a pick stays on it) · a charge whose own man ran · 'stood off' · a set charge on a word that has been given */
  private fragHolds(op: DoorOp): boolean {
    const k = op.kick;
    switch (op.phase) {
      case 'stack': return !op.gate || op.gate.go;
      case 'ready': return !op.onWord;
      case 'standoff': return !!this.chargeOn(op.door);   // (the charge gone from the door — somebody opened it — is the order's own end, not waited on)
      case 'place': return !!op.fled?.has(op.lead) && !isOpen(op.door);
      case 'armed': return !!op.word && !!this.chargeOn(op.door);
      case 'kick': return !!k && isNaN(k.t) && !k.by && !(k.gun && (k.gun.n > 0 || k.gun.nextT !== 0)) && !isOpen(op.door);   // (a shell gone or a hammer wound up is begun)
      default: return false;
    }
  }
  /** … back: on his own mark of the order (a man the order has no mark for is back once he has stopped running; one whose mark the stuck rule has moved to
   *  where he stands — orders.ts — counts as back there) */
  private fragBack(op: DoorOp, m: Guard): boolean { const A = op.mine.get(m); return !A?.post || flat(m.char.pos, A.post) <= 0.8; }
  /** … the wait that was said is over: said so once, where men are still out ('on without …') */
  private fragSaid(op: DoorOp) {
    if (!op.fledSaid) return; op.fledSaid = false; const F = op.fled;
    if (F?.size) this.beat(op, `on without ${[...F].map(m => m.callsign).join(', ')} · ${(op.fledW ?? 0) >= DOORTOOLS.fragHoldCap ? "the order's wait is spent" : 'not waited for'}`);
  }
  /** … the order's signal has gone (its word's first sound, the signal several doors share, Sam's word again): nothing of it waits from here */
  private fragOn(op: DoorOp) { this.fragSaid(op); op.fledGo = true; }
  /** DOORTOOLS.fragHold, once a tick for an order whose door is still to be opened (step): who of it ran from a grenade and is not back — and true when
   *  the order does not move this tick. The seconds held are counted, and the stage's own clock does not run. Who ran is kept while nothing holds too (a
   *  stack waiting for Sam's word): the count and 'the door waits' begin when the word comes. */
  private fragStep(op: DoorOp): boolean {
    const g = this.g, K = DOORTOOLS, t = g.time, F = op.fled ??= new Set<Guard>(), n0 = F.size, names = () => [...F].map(m => m.callsign).join(', ');
    let came = false; for (const m of F) if (!op.men.includes(m)) F.delete(m);   // (down, or given another order: the order's men are the living ones still on it)
    for (const m of op.men) { if (fragRunning(g, m)) F.add(m); else if (F.has(m) && this.fragBack(op, m)) { F.delete(m); came = true; } }
    if (F.size && !n0) this.beat(op, `grenade on the stack · ${names()} off the door`);
    if (!F.size && n0) this.beat(op, came ? 'the men are back' : 'nobody left to wait for');
    const holds = this.fragHolds(op);
    if (!holds || !this.fragWait(op)) {
      if (holds || !F.size) this.fragSaid(op);   // (a stage that holds nothing with men still out — a charge going on by a man who did not run — leaves it said: the next stage does not say it again)
      op.fledT = undefined; return false; }
    const dt = op.fledT === undefined ? 0 : Math.min(t - op.fledT, 0.1); op.fledT = t; op.fledW = (op.fledW ?? 0) + dt; op.t0 += dt;
    if (op.phase === 'place') op.setT = NaN;   // (its man is off the lock: what his hands had done of it is not kept — it goes on from the start when he is back, as it does for a man who walked off it)
    if (!op.fledSaid) { op.fledSaid = true; this.beat(op, `the door waits: ${names()} not back`); g.say(op.men.find(m => !F.has(m)) ?? op.lead, 'hold — back on the door.'); }
    return true;
  }
  private thrAt(op: DoorOp, m: Guard): boolean { return flat(m.char.pos, op.door.frameCentre) < DOORTOOLS.throwReach && offOf(op.door, m.char.pos, op.side) > 0; }
  /** the one order of men a can is thrown by. `hand` false: the stage's pick as it always was (thrThrower: never null). `hand` true (DOORTOOLS.thrHand): the
   *  hand a can may leave RIGHT NOW, or null — the same order, every man of it asked to be at the door (thrAt), and the lead's only with no other man of the
   *  order still on his way back (neither at the door nor on the mark the order gave him: a rear man standing on a mark down the wall is waited for by nobody).
   *  `fit`: a further test every man must pass (the gate's own: his end of the doorway has a pocket for the can) */
  private thrPick(op: DoorOp, hand: boolean, fit: (m: Guard) => boolean = () => true): Guard | null {
    const K = DOORTOOLS, T = op.thr!, d = op.door, near = (m: Guard) => flat(m.char.pos, d.frameCentre);
    const ok = (m: Guard) => hand ? this.thrAt(op, m) : !op.lastStack || near(m) < K.throwReach;   // (a stack that went without its far-jamb man: he throws nothing from down the wall — the lead's own hand)
    const back = (m: Guard) => this.thrBack(op, m);
    return op.men.filter(m => !T.jamb.includes(m) && this.thrAt(op, m)).sort((a, b) => near(a) - near(b)).find(fit) ?? T.jamb.find(m => m !== op.lead && ok(m) && fit(m))
      ?? (!hand || (this.thrAt(op, op.lead) && fit(op.lead) && op.men.every(m => m === op.lead || back(m))) ? op.lead : null);
  }
  /** is this cell of the room lit by the place itself — floor a man with no light of his own can see a man standing on (asked once a cell an order) */
  private thrLitCell(T: Threshold, SR: RoomSearch, i: number): boolean {
    const L = T.litC ??= new Int8Array(SR.pts.length).fill(-1), q = SR.pts[i];
    if (L[i] < 0) L[i] = this.g.visibilityOf(lightEstimateAt(this.g, [q[0], 1.2, q[2]], () => true)) >= LIGHTS.litAt ? 1 : 0;
    return L[i] === 1;
  }
  /** does this cell of the room show a standing man through the goggles by the place's own light (DOORTOOLS.thrTube; asked once a cell an order) */
  private thrTubeCell(T: Threshold, SR: RoomSearch, i: number): boolean {
    const L = T.tubeC ??= new Int8Array(SR.pts.length).fill(-1), q = SR.pts[i];
    if (L[i] < 0) L[i] = tubeVis(this.g, nvgPlaceLight(this.g, [q[0], 1.2, q[2]])) >= NVG.blackAt ? 1 : 0;
    return L[i] === 1;
  }
  /** where a can leaves the hand: in the opening's own span at the thrower's end of it, a forearm outside the frame line */
  private handAt(op: DoorOp, th: Guard): Vec3 { const d = op.door, W = d.def.width; return doorPt(d, clamp(alongOf(d, th.char.pos), 0.25, W - 0.25), 0.35, op.side, 1.3); }
  /** THE BLIND POCKET worth a can: the point in the room — a metre and more inside, within a throw of the hand, on a line a can can fly — whose burst would
   *  have a line to the most floor no muzzle has been across from outside and no earlier burst has lit. Null: nothing of `thrPocket` cells left. With no model
   *  of the room's floor (open floor; the search switched off) the first can goes where a bang and clear's does (`at` null), and there is no second. */
  private pocketOf(op: DoorOp, th: Guard): { at: Vec3 | null; n: number } | null {
    const g = this.g, K = DOORTOOLS, d = op.door, T = op.thr!, SR = op.search, nav = g.col.nav;
    if (!SR) return T.tossed ? null : { at: null, n: 0 };
    T.banged ??= new Uint8Array(SR.pts.length);
    const dark: Vec3[] = []; for (let i = 0; i < SR.pts.length; i++) if (!SR.looked[i] && !T.banged[i]) dark.push(SR.pts[i]);
    if (dark.length < K.thrPocket) return null;
    const from = this.handAt(op, th), sd = Math.max(1, Math.ceil(dark.length / 40)), cands: { at: Vec3; n: number }[] = [];
    const spots = SR.pts.filter(P => !((Math.floor(P[0] / nav.cell) | Math.floor(P[2] / nav.cell)) & 1) && -offOf(d, P, op.side) >= 1.0 && flat(from, P) <= K.thrThrowM);   // (every other cell each way: a metre's lattice of the room)
    for (let j = 0, sj = Math.max(1, Math.ceil(spots.length / 40)); j < spots.length; j += sj) { const P = spots[j];   // (a big room: no more than forty spots against forty cells in the one frame)
      const at: Vec3 = [P[0], K.airH - 0.05, P[2]]; if (g.col.solidBlocked(from, at)) continue;
      let n = 0; for (let k = 0; k < dark.length; k += sd) { const q = dark[k]; if (flat(P, q) <= K.thrFlashM && !g.col.segmentBlocked(at, [q[0], 1.45, q[2]])) n++; }
      if (n * sd >= K.thrPocket) cands.push({ at, n: Math.min(dark.length, n * sd) }); }
    cands.sort((a, b) => b.n - a.n || flat(a.at, from) - flat(b.at, from));
    for (const c of cands.slice(0, 6)) if (g.items.solve(from, c.at, 9).points.some(q => flat(q, c.at) < 0.35 && Math.abs(q[1] - c.at[1]) < 0.6)) return c;   // (the throw's own arc gets there: not into the lintel, not onto a cabinet's top)
    return null;
  }
  /** a can of the stage's has gone off: the floor its burst had a line to is no pocket any more — and the next one's turn, or the count to the step in */
  private thrBanged(op: DoorOp) {
    const g = this.g, K = DOORTOOLS, T = op.thr!, SR = op.search, at = op.bangAt; let lit = 0, dark = 0;
    if (SR && at) { T.banged ??= new Uint8Array(SR.pts.length);
      for (let i = 0; i < SR.pts.length; i++) { if (SR.looked[i] || T.banged[i]) continue; dark++; const q = SR.pts[i];
        if (flat(at, q) <= K.thrFlashM && !g.col.segmentBlocked([at[0], Math.max(0.15, at[1]), at[2]], [q[0], 1.45, q[2]])) { T.banged[i] = 1; lit++; } }   // (from where it really went off: a can that fell behind a desk lit less)
      this.beat(op, `pocket banged · ${lit} of ${dark} unseen cells in its flash`); }
    T.aim = null; T.from = null; op.phase = 'pocket'; T.nextT = g.time + K.thrNext;
    if (T.first === 'can') { T.first = 'burst'; T.wide = !at || offOf(op.door, at, op.side) >= 0; }   // (a can that clipped the leaf and went off on the team's side blinded nobody in there: the hold behind it is a plain one)
  }
  /** the SHALLOW points a threshold stage steps in to, by the door's own geometry (never a level's authored points of domination: those can be deep): first
   *  the free floor to either hand of the doorway hard on the entry wall, clear of the opening — the jamb men's — then one a little deeper to either hand, then
   *  on down the middle: none more than 2.5 m inside. A doorway with no floor like that inside gets the entry's own points (pods). */
  shallowPods(d: Door, side: 1 | -1, n = 2): { pos: Vec3; face: number }[] {
    const g = this.g, nav = g.col.nav, W = d.def.width, into = -side as 1 | -1, mid = doorPt(d, W / 2, 0.9, into, 0.45), out: { pos: Vec3; face: number }[] = [];
    const fits = (p: Vec3) => !nav.isBlocked(p[0], p[2]) && !g.col.solidBlocked(mid, [p[0], 0.45, p[2]]) && !out.some(o => flat(o.pos, p) < 0.9) && !this.inFrame(d, mid, p);
    for (const s of [1, -1]) find: for (const D of [1.0, 1.4, 0.8, 1.9]) for (const L of [W / 2 + 0.9, W / 2 + 1.4, W / 2 + 0.55, W / 2 + 2.0]) {   // (L past the jamb: never in the opening itself)
      const p = doorPt(d, W / 2 + s * L, D, into); if (!fits(p)) continue;
      out.push({ pos: p, face: yawTo(p, doorPt(d, W / 2 - s * 0.6, 4.5, into)) }); break find; }
    for (const s of [1, -1]) { if (out.length >= n) break;
      find: for (const D of [2.2, 1.7, 2.5]) for (const L of [1.7, 1.3, 2.3, 0.9]) {
        const p = doorPt(d, W / 2 + s * L, D, into); if (!fits(p)) continue;
        out.push({ pos: p, face: yawTo(p, doorPt(d, W / 2 - s * 1.2, 5, into)) }); break find; } }
    const inward = yawTo(doorPt(d, W / 2, 0, into), doorPt(d, W / 2, 1, into));
    for (const b of DOORTOOLS.podFrames ? [1.5, 2.4, 2.5] : [1.5, 2.4]) { if (out.length >= n) break; const q = doorPt(d, W / 2, b, into), f = nav.isBlocked(q[0], q[2]) ? nav.nearestFreePoint(q[0], q[2]) : q; if (f && -offOf(d, [f[0], 0, f[2]], side) > 0.3 && -offOf(d, [f[0], 0, f[2]], side) <= 2.5 && !out.some(o => flat(o.pos, f) < 0.9)) out.push({ pos: [f[0], 0, f[2]], face: inward }); }
    if (!out.length) return this.pods(d, side, n);
    const pts = out.slice(0, n); for (const P of pts) this.offSwing(P, d, side, pts.filter(o => o !== P).map(o => o.pos));
    return pts;
  }
  /** THE STEP IN: the men off the jambs first — the lead, the far-jamb man `second` behind him — each to the shallow point that is the least walk, then the
   *  rest in their turn to the points behind those (a man there is no shallow floor for keeps the squad's back, outside, and is not this order's any more).
   *  From here the op is in 'enter': the entry's own corners, search and sectors — the hand-over to the room clear. */
  private stepIn(op: DoorOp) {
    const g = this.g, S = g.orders, K = DOORTOOLS, T = op.thr!, d = op.door, t = g.time, near = (m: Guard) => flat(m.char.pos, d.frameCentre);
    this.thrMen(op);
    if (K.leadSeen && T.jamb.length > 1) { const f = this.seenMost(op.lead, gunFirst(T.jamb.filter(m => m.state !== 'dead' && (m !== op.threw || m === op.lead) && (m === op.lead || !op.lastStack || near(m) < K.throwReach))), T.pods[0]?.pos);   // (the man off the jambs who has seen most of the room steps in first — not the one who threw the pockets' cans, nor, on a last warning's stack, a man still walking up)
      if (f !== T.jamb[0]) { T.jamb = [f, ...T.jamb.filter(m => m !== f)]; this.led.bySeen++; this.beat(op, `first:${f.callsign} · has seen most of the room`); } }
    this.led.entries++;
    const pods = S.big && op.men.length <= 2 ? this.podsApart(op, T.pods, op.men.length) : T.pods;
    if (!pods.length) { g.say(op.lead, 'no way in.'); this.end(op, 'no floor inside'); return; }
    const turn = [...T.jamb, ...op.men.filter(m => !T.jamb.includes(m)).sort((a, b) => near(a) - near(b))], nIn = Math.min(pods.length, Math.max(1, K.thrIn)), inMen = turn.slice(0, nIn), stay = turn.slice(nIn);
    const deal = new Map<Guard, { pos: Vec3; face: number }>();
    for (const k of [0, 2]) { const m = inMen.slice(k, k + 2), sp = pods.slice(k, k + 2); if (m.length) for (const [gd, pos] of S.pair(m, sp.map(x => x.pos))) deal.set(gd, sp.find(x => x.pos === pos)!); }
    if (stay.length) { op.men = op.men.filter(m => !stay.includes(m)); this.beat(op, `outside · ${stay.map(m => m.callsign).join(', ')}`); }
    op.rear.clear();
    op.queue = inMen.map((gd, i) => ({ gd, at: t + i * K.second, pod: deal.get(gd) ?? pods[0] }));
    op.phase = 'enter'; op.t0 = t; this.beat(op, `step in · ${inMen.map(m => m.callsign).join(', ')}`);
    g.say(op.lead, 'stepping in.');
  }

  // ------------------------------------------------------------ the HUD, the console
  /** lines for the squad's HUD block (orders.ts hud): what is left, and a charge waiting for the trigger — 'F blows it' only while F would: with the squad
   *  of four the key is the word's while something of the addressed men's is waiting (wordNote says so; a charge of theirs goes with it), and a charge on a
   *  word already given goes when that word does */
  hudNotes(): string[] {
    const out = [`charges ${this.charges} · bangs ${this.bangs}`], S = this.g.orders, F = DOORTOOLS.blowKey.replace('Key', '');
    if (FRAG.on && FRAG.squad > 0) out.push(`frags ${this.frags}`);
    const word = DOORTOOLS.wordOnKey && S.big && this.waitingAny(this.wordMen()).length > 0;
    for (const c of this.set) out.push(`charge set · ${doorWords(c.door)}${this.onPendingWord(c) ? ' — on the word' : word ? '' : blowTail(this.keyIs(c), F, ' — ')}${OWNCHARGE.on ? this.closeWords(c).replace('too close:', 'TOO CLOSE:').replace('behind the door:', 'BEHIND THE DOOR:') : ''}`);   // (who it would catch, where a long line wraps: the door's own header is cut short)
    for (const op of this.ops) if (op.onWord && op.phase === 'ready') out.push(`${S.whoWords(op.men)} ready on your word · ${doorWords(op.door)}`);   // (what matters first: the panel clips a long line's tail)
    for (const op of this.ops) if (op.thr?.hold && op.phase === 'thr') out.push(`${S.whoWords(op.men)} ${op.thr.told ? 'holding on your word' : 'working the threshold'} · ${doorWords(op.door)}${S.big ? '' : ` — ${F} goes`}`);   // (the four's key line is the word's own: wordNote)
    for (const w of this.words) if (isNaN(w.go1)) { const late = this.ops.filter(o => o.word === w && o.hold < 1); if (late.length) out.push(`word given · waiting for ${[...new Set(late.map(o => S.whoWords(o.men.filter(m => m.state !== 'dead'))))].join(' + ')}`); }
    return out;
  }
  /** (ui/corner.ts, HANDRING.corner: the corner panel keeps of the squad only a line a key gives, and has no heading over a door's row) what
   *  hudNotes and a door's heading say that the corner would otherwise lose, each as a key and what a press of it does now, or under no key (''):
   *  a set charge while the squad's key by itself blows it, with who it would catch; a set charge that key does not blow so (his own, or one that
   *  goes with the word) only while it would catch somebody, as the warning it is; the small squad's men held at a threshold, once they have called it. A separate reader,
   *  not a change to hudNotes: the block's strings stay what every stand's checks read. Read by the page's panel only. */
  cornerNotes(): { key: string; text: string }[] {
    const out: { key: string; text: string }[] = [], S = this.g.orders, F = DOORTOOLS.blowKey.replace('Key', '');
    const word = DOORTOOLS.wordOnKey && S.big && this.waitingAny(this.wordMen()).length > 0;
    for (const c of this.set) { const close = OWNCHARGE.on ? this.closeWords(c).replace('too close:', 'TOO CLOSE:').replace('behind the door:', 'BEHIND THE DOOR:') : '';
      if (!word && !this.onPendingWord(c) && this.keyIs(c)) out.push({ key: F, text: `blow the charge · ${doorWords(c.door)}${close}` });
      else if (close) out.push({ key: '', text: `charge set · ${doorWords(c.door)}${close}` }); }
    if (!S.big) for (const op of this.ops) if (op.thr?.hold && op.phase === 'thr' && op.thr.told) out.push({ key: F, text: `go · ${S.whoWords(op.men)} waiting · ${doorWords(op.door)}` });   // (only once they have called: a key's line while they still work the threshold invites the press before their call)
    return out;
  }
  /** … and the word, while somebody is waiting on it: the key that gives it, to whom — or, with the orders going to somebody else, who to turn to (a set
   *  charge is left out of that: it has its own line, and its own key) */
  wordNote(): OrderNote[] {
    const S = this.g.orders;
    if (!S.big) {   // (the small squad's: its plain stacks, under wordSmall — the key is always the word's there)
      const F = DOORTOOLS.blowKey.replace('Key', ''), T = S.knobs.whoKey.replace('Key', ''), mine = this.stackWords(this.wordMen()); if (mine) return [{ key: F, text: `go · ${mine} waiting` }];
      const rest = this.stackWords(S.men()); return rest ? [CMDRING.only ? `${rest} waiting` : `${rest} waiting · ${T}, then ${F}`] : [];   // (cmdring.ts only: the who key is nobody's)
    }
    const F = DOORTOOLS.blowKey.replace('Key', ''), T = S.knobs.whoKey.replace('Key', ''), key = DOORTOOLS.wordOnKey;
    const mine = this.waitingWords(this.wordMen()); if (mine) return [key ? { key: F, text: `go · ${mine} waiting` } : `${mine} waiting for you to say go`];
    const rest = [...new Set(this.waitingAny(S.men()).filter(x => 'stack' in x || !this.chargeOn(x.door)).map(x => S.whoWords(x.men.filter(m => m.state !== 'dead'))))].join(' + ');
    return rest ? [CMDRING.only ? `${rest} waiting` : `${rest} waiting · ${T}, then ${key ? F : 'go'}`] : [];
  }
  summary(): string {
    return `charges ${this.charges} · bangs ${this.bangs} · set ${this.set.map(c => c.door.def.name).join(',') || 'none'} · ${this.ops.map(o => `${o.kind} ${o.door.def.name}: ${o.phase} (${o.men.map(m => m.callsign).join(', ')})`).join(' · ') || 'nothing under way'}`;
  }
}
/** BIGSLOT.moves: a hammer held wound up for the word lands this long after it (s — the swing itself) */
const WORD_LEAD = 0.15;
